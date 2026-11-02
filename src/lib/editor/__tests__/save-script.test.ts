import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCommand,
  isProtected,
  markSavedScript,
  saveScript,
} from "../sandbox-scripts";
import { parseRawDiff } from "../git-changes";

/*
 * The save and build scripts against a real git repository: what gets
 * committed, what is left out, and that a save with nothing new still
 * succeeds. (The sandbox has flock; macOS does not, so a stand-in goes on
 * PATH.)
 */

type Repo = {
  root: string;
  dirs: { site: string; state: string; blobs: string };
  env: NodeJS.ProcessEnv;
};
const repos: Repo[] = [];
afterEach(() =>
  repos
    .splice(0)
    .forEach((r) => rmSync(r.root, { recursive: true, force: true })),
);

function write(repo: Repo, path: string, content: string) {
  const full = join(repo.dirs.site, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function git(repo: Repo, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: repo.dirs.site,
    env: repo.env,
    encoding: "utf8",
  });
}

function makeRepo(): Repo {
  const root = mkdtempSync(join(tmpdir(), "editor-save-"));
  const dirs = {
    site: join(root, "site"),
    state: join(root, "state"),
    blobs: join(root, "blobs"),
  };
  const bin = join(root, "bin");
  [dirs.site, dirs.state, bin].forEach((d) =>
    mkdirSync(d, { recursive: true }),
  );
  writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "flock"), 0o755);
  const repo: Repo = {
    root,
    dirs,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  };
  repos.push(repo);
  git(repo, "init", "-q", "-b", "work");
  git(repo, "config", "user.name", "t");
  git(repo, "config", "user.email", "t@t");
  write(repo, "src/data/site.ts", "export const A = 1;\n");
  write(repo, "src/pages/rnd.astro", "<h1>R&D</h1>\n");
  write(repo, "package.json", '{"name":"x"}\n');
  write(repo, ".github/workflows/ci.yml", "on: push\n");
  write(repo, "src/lib/editor/auth.ts", "export {};\n");
  // Like the real checkout: ignored folders that exist (.vercel after a
  // build, the editor's own .editor/ via info/exclude) and an ignored .env.
  write(repo, ".gitignore", ".vercel\n.env\n");
  write(repo, ".vercel/output/config.json", "{}\n");
  write(repo, ".env", "PUBLIC_SANITY_PROJECT_ID=x\n");
  write(repo, ".editor/overlay.js", "// tooling\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "init");
  git(repo, "tag", "editor-saved");
  writeFileSync(join(dirs.site, ".git/info/exclude"), ".editor/\n");
  return repo;
}

function save(repo: Repo) {
  const stdout = execFileSync("bash", ["-c", saveScript(repo.dirs)], {
    env: repo.env,
    encoding: "utf8",
  });
  const commit = /^COMMIT ([0-9a-f]{40})$/m.exec(stdout)![1];
  const tree = /^TREE ([0-9a-f]{40})$/m.exec(stdout)![1];
  const left = stdout
    .split("\n")
    .filter((l) => l.startsWith("LEFT "))
    .map((l) => l.slice(8).trim());
  const changes = parseRawDiff(
    readFileSync(join(repo.dirs.state, "changes"), "utf8"),
  );
  return { commit, tree, left, changes };
}

function markSaved(repo: Repo, commit: string) {
  execFileSync(
    "bash",
    ["-c", markSavedScript(commit).replace("/home/user/site", repo.dirs.site)],
    { env: repo.env },
  );
}

describe("save script on a real repository", () => {
  it("commits content changes and leaves every protected path out", () => {
    const repo = makeRepo();
    write(repo, "src/data/site.ts", "export const A = 2;\n");
    write(repo, "public/images/new.svg", "<svg/>\n");
    rmSync(join(repo.dirs.site, "src/pages/rnd.astro"));
    write(
      repo,
      "package.json",
      '{"name":"x","scripts":{"postinstall":"curl evil"}}\n',
    );
    write(repo, ".github/workflows/ci.yml", "on: [push, pull_request]\n");
    write(repo, "src/lib/editor/auth.ts", "export const open = true;\n");
    write(
      repo,
      "src/pages/api/leak.ts",
      "export const GET = () => new Response(process.env.X);\n",
    );
    write(repo, "src/middleware.ts", "export const onRequest = () => {};\n");
    write(repo, "src/data/.env", "SECRET=1\n");
    write(repo, ".env.production", "SECRET=1\n");

    const { changes, left } = save(repo);

    expect(changes.map((c) => `${c.kind} ${c.path}`).sort()).toEqual([
      "delete src/pages/rnd.astro",
      "write public/images/new.svg",
      "write src/data/site.ts",
    ]);
    for (const c of changes) {
      expect(isProtected(c.path)).toBe(false);
      if (c.kind === "write")
        expect(existsSync(join(repo.dirs.blobs, c.blobSha))).toBe(true);
    }
    // .gitignore-less test repo: untracked env files show as left, as do the rest.
    expect(left.length).toBeGreaterThanOrEqual(6);
    for (const path of left)
      expect(isProtected(path.replace(/\/$/, ""))).toBe(true);
  });

  it("succeeds with nothing new to save, and after a delete-only change", () => {
    const repo = makeRepo();
    write(repo, "src/data/site.ts", "export const A = 3;\n");
    const first = save(repo);
    markSaved(repo, first.commit);

    const again = save(repo);
    expect(again.changes).toEqual([]);
    markSaved(repo, again.commit);

    rmSync(join(repo.dirs.site, "src/data/site.ts"));
    const deleted = save(repo);
    expect(deleted.changes).toEqual([
      { kind: "delete", path: "src/data/site.ts" },
    ]);
  });

  it("refuses a symlink rather than publishing it", () => {
    const repo = makeRepo();
    symlinkSync("/etc/passwd", join(repo.dirs.site, "public-link"));
    expect(() => save(repo)).toThrow(/link or submodule/);
  });
});

describe("build fingerprint", () => {
  const recordBuiltTree = (repo: Repo) => {
    const cmd = buildCommand(repo.dirs).replace(" && pnpm run build", "");
    execFileSync("bash", ["-c", cmd], { env: repo.env });
    return readFileSync(join(repo.dirs.state, "built-tree"), "utf8").trim();
  };

  it("matches the saved tree when nothing changed after the check", () => {
    const repo = makeRepo();
    write(repo, "src/data/site.ts", "export const A = 4;\n");
    write(repo, "package.json", '{"name":"changed"}\n');
    const built = recordBuiltTree(repo);
    expect(save(repo).tree).toBe(built);
  });

  it("differs when a file changed after the check started", () => {
    const repo = makeRepo();
    write(repo, "src/data/site.ts", "export const A = 5;\n");
    const built = recordBuiltTree(repo);
    write(repo, "src/data/site.ts", "export const A = 6;\n");
    expect(save(repo).tree).not.toBe(built);
  });
});
