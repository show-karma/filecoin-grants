/*
 * The shell the editor runs inside a Boat sandbox, and the names it shares
 * with scripts/editor/build-template.ts.
 *
 * Rule for everything here: no text from the person or the agent is ever
 * pasted into a command as text. Commands are constants; the only values
 * spliced in are git object ids (checked against /^[0-9a-f]{40}$/), short
 * generated ids, and base64 (checked against its alphabet, which the shell
 * gives no meaning to).
 */
import { isSha } from "./git-changes.ts";

export const REPO_URL = "https://github.com/show-karma/filecoin-grants.git";
/** The checkout inside the sandbox. */
export const SITE_DIR = "/home/user/site";
/** Where the editor keeps its own state inside the sandbox. */
export const STATE_DIR = "/home/user/.editor";
export const DEV_PORT = 4321;
export const DEV_SERVICE = "filpgf-dev";
/** Name prefix of every editing sandbox, so the server can find the live one. */
export const SESSION_NAME = "filpgf-editor-session";
export const DRAFT_BRANCH = "editor/draft";

/** Where the save step exports changed files for the server to read. */
export const BLOB_DIR = "/tmp/editor-blobs";
/** The editor's preview tooling, copied into the checkout and hidden from git. */
export const TOOLS_DIR = `${STATE_DIR}/files`;
export const SHOTS_DIR = `${STATE_DIR}/shots`;
export const CARDS_FILE = `${STATE_DIR}/changes.jsonl`;
export const DIFF_FILE = `${STATE_DIR}/last-diff`;
/** The Anthropic SDK for quick edits (sandbox/quick-edit.mjs), outside the site so it is never saved. */
export const SDK_DIR = `${STATE_DIR}/sdk`;
export const SDK_PACKAGE = "@anthropic-ai/sdk@0.135.0";
const SDK_INSTALL = `mkdir -p ${SDK_DIR} && cd ${SDK_DIR} && { [ -f package.json ] || echo '{"private":true}' > package.json; } && npm install --silent --no-audit --no-fund ${SDK_PACKAGE}`;

/*
 * Paths the editor never commits, whatever the agent did. Changes to them
 * stay in the sandbox (the preview shows them) but are never saved, and
 * Publish refuses while any are pending.
 *
 * - CI config and env files: a workflow or env file can reach secrets.
 * - Build and server code: package scripts, the Astro/Vercel config,
 *   middleware and API routes run during the Vercel build or on the server,
 *   where the project's secrets are. Pages and components also run at build,
 *   but they are what the editor exists to change; this list removes the
 *   places where a change is never needed for content.
 * - The editor itself, so a request can't lock the customer out.
 *
 * Enforced twice: as git pathspecs when staging (`excludePathspecs`), and on
 * the diff the server reads back (`isProtected`). A test runs both against a
 * real repository to keep them in step.
 */
export const PROTECTED_DIRS = [
  ".github",
  "scripts",
  "src/pages/api",
  "src/lib/editor",
  "src/components/editor",
  "src/middleware",
];
export const PROTECTED_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  "astro.config.mjs",
  "vercel.json",
  "tsconfig.json",
  "src/pages/edit.astro",
];
/** For people: the list as the README and the UI describe it. */
export const PROTECTED = [
  ...PROTECTED_DIRS,
  ...PROTECTED_FILES,
  ".env files anywhere",
  "src/middleware.*",
];

/*
 * Also protected, but already ignored by git (.gitignore, .git/info/exclude),
 * so they can never be staged. They must stay out of the staging pathspecs:
 * git refuses a pathspec that names an ignored path that exists.
 */
export const IGNORED_PROTECTED_DIRS = [".editor", ".vercel"];

export function isProtected(path: string): boolean {
  if (
    IGNORED_PROTECTED_DIRS.some((d) => path === d || path.startsWith(`${d}/`))
  )
    return true;
  const segments = path.split("/");
  if (segments.some((s) => s === ".env" || s.startsWith(".env."))) return true;
  if (/^src\/middleware\.[^/]+$/.test(path)) return true;
  if (PROTECTED_FILES.includes(path)) return true;
  return PROTECTED_DIRS.some((d) => path === d || path.startsWith(`${d}/`));
}

function excludePathspecs(): string {
  return [
    ...PROTECTED_DIRS.map((d) => `':(exclude)${d}'`),
    ...PROTECTED_FILES.map((f) => `':(exclude)${f}'`),
    "':(exclude,glob)**/.env'",
    "':(exclude,glob)**/.env.*'",
    "':(exclude,glob)src/middleware.*'",
  ].join(" ");
}

/**
 * The preview server. With the editor's tooling in place it runs through
 * .editor/editor.config.mjs, which adds the in-page layer; without it (the
 * template build) it is the site's plain dev server.
 */
export const DEV_SCRIPT = `#!/usr/bin/env bash
cd ${SITE_DIR}
if [ -f .editor/editor.config.mjs ]; then
  exec pnpm exec astro dev --host 0.0.0.0 --port ${DEV_PORT} --allowed-hosts .on.boat.dev --config .editor/editor.config.mjs
fi
exec pnpm exec astro dev --host 0.0.0.0 --port ${DEV_PORT} --allowed-hosts .on.boat.dev
`;

/** The systemd unit runs this, so the dev command can change without a new template. */
export const DEV_COMMAND = `exec /bin/bash ${STATE_DIR}/dev.sh`;

export type SanitySettings = { projectId: string; dataset: string };

/** Sanity ids are spliced into a command, so they must be plain. */
export function checkSanity(s: SanitySettings): SanitySettings {
  if (!/^[a-z0-9]+$/.test(s.projectId) || !/^[a-z0-9_-]+$/.test(s.dataset)) {
    throw new Error(
      "PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_DATASET look wrong",
    );
  }
  return s;
}

/**
 * Everything the template holds, as one script: pnpm 11, the site cloned with
 * its packages, the preview's .env, and the preview service (installed, not
 * started). The template builder runs it once and snapshots the result; a
 * session with no template runs it at start, which costs about 30 seconds.
 */
export function installScript(sanity: SanitySettings): string {
  const { projectId, dataset } = checkSanity(sanity);
  return `set -euo pipefail
echo "[editor] installing the site"
npm i -g pnpm@11.18.0 >/dev/null 2>&1 || sudo npm i -g pnpm@11.18.0 >/dev/null
hash -r
echo "[editor] node $(node --version), pnpm $(pnpm --version)"
rm -rf ${SITE_DIR}
git clone --quiet ${REPO_URL} ${SITE_DIR}
printf 'PUBLIC_SANITY_PROJECT_ID=${projectId}\nPUBLIC_SANITY_DATASET=${dataset}\nASTRO_TELEMETRY_DISABLED=1\n' > ${SITE_DIR}/.env
cd ${SITE_DIR}
pnpm install --frozen-lockfile
mkdir -p ${STATE_DIR}
( ${SDK_INSTALL} ) >/dev/null 2>&1 || echo "[editor] could not install the model SDK; quick edits will use the agent"
cat > ${STATE_DIR}/dev.sh <<'DEV'
${DEV_SCRIPT}DEV
cp pnpm-lock.yaml ${STATE_DIR}/template-lock.yaml
NODE_DIR=$(dirname "$(command -v node)")
PNPM_DIR=$(dirname "$(command -v pnpm)")
sudo tee /etc/systemd/system/${DEV_SERVICE}.service >/dev/null <<UNIT
[Unit]
Description=filpgf.io editor preview (astro dev)
After=network.target
[Service]
User=user
WorkingDirectory=${SITE_DIR}
Environment=PATH=$PNPM_DIR:$NODE_DIR:/usr/local/bin:/usr/bin:/bin
Environment=ASTRO_TELEMETRY_DISABLED=1
ExecStart=/bin/bash -c '${DEV_COMMAND}'
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
echo "[editor] installed"
`;
}

/**
 * Runs once when a session sandbox is created: installs the site if there is
 * no template (`install`), brings the checkout up to date (the draft branch if there is one, else main), installs
 * packages only if the lockfile changed since the template was built, starts
 * the preview and waits until it answers. Boat reports the outcome as the
 * sandbox's setupStatus.
 */
export function setupScript(install?: SanitySettings): string {
  return `#!/usr/bin/env bash
set -euo pipefail
mkdir -p ${STATE_DIR}
exec > >(tee -a ${STATE_DIR}/setup.log) 2>&1
echo "[editor] setup started $(date -Is)"
${install ? `if [ ! -d ${SITE_DIR}/.git ]; then\n( ${installScript(install)} )\nfi` : ""}
cd ${SITE_DIR}
git remote set-url origin ${REPO_URL}
git fetch --quiet --prune origin '+refs/heads/main:refs/remotes/origin/main'
if git fetch --quiet origin '+refs/heads/${DRAFT_BRANCH}:refs/remotes/origin/${DRAFT_BRANCH}' 2>/dev/null; then
  START=origin/${DRAFT_BRANCH}
else
  START=origin/main
fi
git checkout --quiet --force -B work "$START"
git tag -f editor-saved HEAD >/dev/null
git rev-parse HEAD > ${STATE_DIR}/base-sha
echo "[editor] checked out $START at $(git rev-parse --short HEAD)"
# The editor's preview tooling: inside the checkout (Astro wants its config
# there) but excluded from git, so it can never be saved or published.
mkdir -p .editor ${SHOTS_DIR}
cp ${TOOLS_DIR}/* .editor/ 2>/dev/null || true
grep -qxF '.editor/' .git/info/exclude 2>/dev/null || echo '.editor/' >> .git/info/exclude
: > ${CARDS_FILE}
# Quick edits need the model SDK. Not needed to open the preview, so it
# installs alongside (a template already has it).
if [ ! -d ${SDK_DIR}/node_modules/@anthropic-ai/sdk ]; then
  ( ( ${SDK_INSTALL} ) >/dev/null 2>&1 || true ) &
fi
cat > ${STATE_DIR}/dev.sh <<'DEV'
${DEV_SCRIPT}DEV
if ! cmp -s pnpm-lock.yaml ${STATE_DIR}/template-lock.yaml; then
  echo "[editor] lockfile changed since the template was built; installing"
  pnpm install --frozen-lockfile --prefer-offline
  cp pnpm-lock.yaml ${STATE_DIR}/template-lock.yaml
fi
sudo systemctl restart ${DEV_SERVICE}
# Any HTTP answer means the server is up. A draft can break a page; that must
# not stop the editor from opening, or there would be no way to fix it.
code=000
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:${DEV_PORT}/ || true)
  if [ "$code" != "000" ]; then
    echo "[editor] preview answered $code after \${i}s"
    break
  fi
  sleep 1
done
[ "$code" != "000" ]
# Compile the other pages in the background so the first click is quick.
( for p in / /kernel /propgf /revenue-development /roadmap /blog; do
    curl -s -o /dev/null --max-time 60 "http://127.0.0.1:${DEV_PORT}$p" || true
  done ) >/dev/null 2>&1 &
touch ${STATE_DIR}/ready
echo "[editor] ready"
`;
}

/** Setup for a session started from the template. */
export const SETUP_SCRIPT = setupScript();

type Dirs = { site: string; state: string; blobs: string };
const DIRS: Dirs = { site: SITE_DIR, state: STATE_DIR, blobs: BLOB_DIR };

/**
 * Stages everything the agent changed (minus protected paths), commits it
 * locally so the content is frozen, and exports the changed blobs for the
 * server to read. Prints the frozen commit and its tree, then any changes
 * left out. The NUL-separated diff goes to a file because it does not survive
 * a JSON stdout field intact. A lock keeps two saves from interleaving.
 */
export function saveScript(dirs: Dirs = DIRS): string {
  return `set -euo pipefail
cd ${dirs.site}
exec 9>${dirs.state}/save.lock
flock -w 40 9
git add -A -- . ${excludePathspecs()}
P=$(git rev-parse editor-saved)
git -c user.name=editor -c user.email=editor@localhost commit --quiet --allow-empty --no-verify -m "editor save"
C=$(git rev-parse HEAD)
git diff --no-color --no-ext-diff --unified=1 editor-saved "$C" | head -c 60000 > ${dirs.state}/last-diff || true
git diff --raw -z --no-renames --no-abbrev editor-saved "$C" > ${dirs.state}/changes
rm -rf ${dirs.blobs} && mkdir -p ${dirs.blobs}
git diff --raw --no-renames --no-abbrev editor-saved "$C" | awk '$4 !~ /^0+$/ {print $4}' | sort -u | while read -r sha; do
  git cat-file blob "$sha" > "${dirs.blobs}/$sha"
done
echo "PREV $P"
echo "COMMIT $C"
echo "TREE $(git rev-parse "$C^{tree}")"
git status --porcelain --untracked-files=all | sed 's/^/LEFT /'
`;
}

export const SAVE_SCRIPT = saveScript();

/**
 * The publish check: records the tree it is about to build (what a save would
 * commit right now), then runs the same type check and build as CI and
 * Vercel. Publish refuses if the saved tree differs from the built one.
 */
export function buildCommand(dirs: Dirs = DIRS): string {
  return [
    `cd ${dirs.site}`,
    `git add -A -- . ${excludePathspecs()}`,
    `git write-tree > ${dirs.state}/built-tree`,
    "pnpm run build",
  ].join(" && ");
}

export const BUILD_COMMAND = buildCommand();
export const BUILT_TREE_FILE = `${STATE_DIR}/built-tree`;

/** Marks a frozen commit as saved to GitHub, so the next save diffs from it. */
export function markSavedScript(localCommit: string): string {
  if (!isSha(localCommit)) throw new Error("bad commit id");
  return `cd ${SITE_DIR} && git tag -f editor-saved ${localCommit} >/dev/null && echo ok`;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ID = /^[a-z0-9]{6,32}$/;

/** Base64 is spliced into commands as-is; only its own alphabet may get through. */
export function checkB64(value: string, max = 110_000): string {
  if (!B64.test(value) || value.length > max) throw new Error("bad payload");
  return value;
}

export function checkId(value: string): string {
  if (!ID.test(value)) throw new Error("bad id");
  return value;
}

/** Replace text in the source directly (see sandbox/text-edit.mjs). */
export function textEditCommand(payloadB64: string): string {
  return `cd ${SITE_DIR} && node .editor/text-edit.mjs ${checkB64(payloadB64, QUICK_EDIT_MAX)}`;
}

/** Commands are capped at ~128 KB; this leaves room for the rest. */
export const QUICK_EDIT_MAX = 110_000;

/** A wording change by the fast model (see sandbox/quick-edit.mjs). */
export function quickEditCommand(payloadB64: string): string {
  return `cd ${SITE_DIR} && node .editor/quick-edit.mjs ${checkB64(payloadB64, QUICK_EDIT_MAX)}`;
}

/** A full-page screenshot of `path` in the preview (see sandbox/shot.mjs). */
export function shotCommand(payloadB64: string): string {
  return `cd ${SITE_DIR} && node .editor/shot.mjs ${checkB64(payloadB64, 2_000)}`;
}

export function shotPath(id: string, which: "before" | "after"): string {
  return `${SHOTS_DIR}/${checkId(id)}-${which}.jpg`;
}

/** Appends one JSON line (a change card or a patch to one) to the card log. */
export function appendCardCommand(lineB64: string): string {
  return `printf %s ${checkB64(lineB64)} | base64 -d >> ${CARDS_FILE} && echo >> ${CARDS_FILE}`;
}

/**
 * Reverses one saved change in the working tree: the diff from the save
 * before it to it, applied backwards. Fails (nothing changed) if a later
 * change touched the same lines.
 */
export function undoScript(prev: string, commit: string): string {
  if (!isSha(prev) || !isSha(commit)) throw new Error("bad commit id");
  return `set -euo pipefail
cd ${SITE_DIR}
git diff --binary ${prev} ${commit} -- . ${excludePathspecs()} > /tmp/editor-undo.patch
git apply -R --check /tmp/editor-undo.patch
git apply -R /tmp/editor-undo.patch
echo undone`;
}

/** Re-applies the last undo patch: rolls an undo back when its save failed. */
export function redoScript(): string {
  return `cd ${SITE_DIR} && git apply /tmp/editor-undo.patch && echo redone`;
}

/** Writes one chunk of an upload; chunks are joined by `joinUploadScript`. */
export function uploadChunkCommand(
  id: string,
  index: number,
  chunkB64: string,
): string {
  if (!Number.isInteger(index) || index < 0 || index > 99)
    throw new Error("bad chunk");
  return `mkdir -p /tmp/editor-up && printf %s ${checkB64(chunkB64)} > /tmp/editor-up/${checkId(id)}.${String(index).padStart(2, "0")}`;
}

export function joinUploadScript(id: string, dest: string): string {
  if (
    !/^\/home\/user\/(site\/public\/images\/uploads|attachments)\/[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(
      dest,
    )
  ) {
    throw new Error("bad destination");
  }
  const safeId = checkId(id);
  return `set -euo pipefail
mkdir -p "$(dirname ${dest})"
cat /tmp/editor-up/${safeId}.* | base64 -d > /tmp/editor-up/${safeId}.out
mv /tmp/editor-up/${safeId}.out ${dest}
rm -f /tmp/editor-up/${safeId}.*
echo ok`;
}

/** Fallback readiness check when Boat reports no setup status. */
export const READY_CHECK = `test -f ${STATE_DIR}/ready && echo ready || echo waiting`;

export const SETUP_LOG_TAIL = `tail -n 40 ${STATE_DIR}/setup.log 2>/dev/null || true`;
