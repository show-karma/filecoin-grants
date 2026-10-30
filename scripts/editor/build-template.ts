/*
 * Builds the Boat template that every /edit session starts from: the site
 * cloned, packages installed, the preview service installed and warmed. Run it
 * once, and again whenever dependencies change a lot (sessions still work with
 * a stale template; they just spend longer on `pnpm install`).
 *
 *   node scripts/editor/build-template.ts            # AI key passed to the sandbox
 *   node scripts/editor/build-template.ts --proxy    # AI key stays with Boat (paid proxy)
 *
 * Reads BOAT_API_KEY and PUBLIC_SANITY_* from the environment, .env.local or
 * .env. Optional: BOAT_TEMPLATE, BOAT_ENVIRONMENT (defaults filpgf-editor).
 */
import { readFile } from "node:fs/promises";
import { Boat, BoatError } from "../../src/lib/editor/boat.ts";
import {
  DEV_PORT,
  DEV_SERVICE,
  SITE_DIR,
  installScript,
} from "../../src/lib/editor/sandbox-scripts.ts";

const env = {
  ...(await loadDotEnv(".env")),
  ...(await loadDotEnv(".env.local")),
  ...process.env,
};
const apiKey = env.BOAT_API_KEY ?? "";
const templateName = env.BOAT_TEMPLATE ?? "filpgf-editor";
const environmentName = env.BOAT_ENVIRONMENT ?? "filpgf-editor";
const sanityProject = env.PUBLIC_SANITY_PROJECT_ID ?? "86k25j71";
const sanityDataset = env.PUBLIC_SANITY_DATASET ?? "production";
const useProxy = process.argv.includes("--proxy");

if (!apiKey) fail("BOAT_API_KEY is not set (environment, .env.local or .env).");
// These two are spliced into a shell command below, so they must be plain.
if (
  !/^[a-z0-9]+$/.test(sanityProject) ||
  !/^[a-z0-9_-]+$/.test(sanityDataset)
) {
  fail("PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_DATASET look wrong.");
}

const boat = new Boat(apiKey);
// Set when Boat refuses the snapshot for a known reason; reported after cleanup.
let trialMessage: string | null = null;
const started = Date.now();
const log = (msg: string) =>
  console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${msg}`);

// 1. The environment sessions run in: none of the account's secrets, no
//    GitHub access. The agent needs an AI credential, passed either as a
//    placeholder through Boat's proxy (--proxy) or as the key itself.
log(`environment "${environmentName}"`);
let environment: { id: string; name: string } | undefined = (
  await boat.listEnvironments()
).find((e) => e.name === environmentName);
if (!environment) {
  const res = await boat.createEnvironment(environmentName);
  environment = res.environments.find((e) => e.name === environmentName);
  if (!environment) fail("Boat did not return the new environment.");
}
try {
  await boat.updateEnvironment(
    environment.id,
    useProxy
      ? { safeForThirdParties: true, proxyAiCredentials: true }
      : {
          safeForThirdParties: false,
          passGithub: false,
          passSecrets: false,
          passSandboxCredentials: false,
          passAgentsCredentials: true,
        },
  );
} catch (e) {
  if (e instanceof BoatError && e.code === "ai_proxy_off") {
    fail(
      "The AI credentials proxy is off. Turn it on (dashboard, or `boat ai proxy on`), or run without --proxy.",
    );
  }
  throw e;
}

// 2. A sandbox to build the template in.
log("creating build sandbox");
const { sandbox } = await boat.createSandbox({
  environment: environmentName,
  name: "filpgf-editor-template-build",
  ttlSeconds: 3600,
});
const id = sandbox.id;
log(`sandbox ${id}`);

try {
  await waitReady(id);

  await run(
    "tool versions",
    "node --version && pnpm --version && git --version",
  );
  await run(
    "install the site (clone, packages, preview service)",
    installScript({ projectId: sanityProject, dataset: sanityDataset }),
    600,
  );
  // Warm Vite's dependency cache so it is in the snapshot, then stop: each
  // session starts the service itself after checking out its draft.
  await run(
    "warm the preview",
    [
      `sudo systemctl start ${DEV_SERVICE}`,
      `for i in $(seq 1 120); do curl -fsS -o /dev/null --max-time 10 http://127.0.0.1:${DEV_PORT}/rnd && break; sleep 1; done`,
      `for p in /rnd / /kernel /propgf /revenue-development /roadmap /blog; do printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' --max-time 60 http://127.0.0.1:${DEV_PORT}$p; done`,
      `sudo systemctl stop ${DEV_SERVICE}`,
    ].join("\n"),
    400,
  );
  await run(
    "clean checkout",
    `cd ${SITE_DIR} && git status --porcelain && echo clean`,
  );

  log(`saving snapshot "${templateName}"`);
  try {
    await boat.saveSnapshot(id, templateName);
  } catch (e) {
    if (
      e instanceof BoatError &&
      e.code === "trial_saved_snapshots_not_allowed"
    ) {
      trialMessage =
        "Boat does not allow saved snapshots during the free trial. The install itself worked.\n" +
        "  The editor still works: without a template each session installs the site at start (~40 s instead of ~15 s).\n" +
        "  Rerun this script after the trial ends to make sessions faster.";
    } else throw e;
  }
  if (!trialMessage) {
    for (;;) {
      await sleep(5000);
      const snap = await boat.getSnapshot(templateName);
      if (snap.status === "ready") {
        log(`snapshot ready (${Math.round((snap.sizeBytes ?? 0) / 1e6)} MB)`);
        break;
      }
      if (snap.status === "failed")
        throw new Error(`snapshot failed: ${snap.error ?? "unknown"}`);
      if (Date.now() - started > 30 * 60_000)
        throw new Error("snapshot took too long");
    }
  }
} finally {
  log("deleting build sandbox");
  await boat
    .deleteSandbox(id)
    .catch((e) => console.warn("could not delete build sandbox:", e.message));
}

if (trialMessage) fail(trialMessage);
log("done");
console.log(`
Template "${templateName}" is ready. Sessions use environment "${environmentName}".
AI credentials: ${useProxy ? "placeholders through Boat's proxy" : "passed to the sandbox (only the AI key; no GitHub access, no other secrets)"}.
Make sure an agent is connected under Agents & Proxying in the Boat dashboard.`);

// ---- helpers --------------------------------------------------------------------

async function run(label: string, command: string, timeoutSeconds = 60) {
  log(label);
  const res = await boat.exec(id, command, { timeoutSeconds });
  const out = `${res.stdout}${res.stderr ? `\n${res.stderr}` : ""}`.trim();
  if (out)
    console.log(
      out
        .split("\n")
        .slice(-15)
        .map((l) => `    ${l}`)
        .join("\n"),
    );
  if (res.exitCode !== 0 || res.timedOut) {
    throw new Error(
      `"${label}" failed (exit ${res.exitCode}${res.timedOut ? ", timed out" : ""})`,
    );
  }
}

async function waitReady(sandboxId: string) {
  for (;;) {
    const s = await boat.getSandbox(sandboxId);
    if (["ready", "idle", "running"].includes(s.state)) return;
    if (["error", "archived"].includes(s.state))
      fail(`sandbox entered ${s.state}: ${s.error ?? ""}`);
    await sleep(2000);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function loadDotEnv(path: string): Promise<Record<string, string>> {
  try {
    const text = await readFile(path, "utf8");
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
    return out;
  } catch {
    return {};
  }
}
