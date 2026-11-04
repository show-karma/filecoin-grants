/*
 * Editor settings, read at request time.
 *
 * `process.env` first because on Vercel it is the only source that exists at
 * request time; `import.meta.env` covers `astro dev`, where Astro loads .env
 * files into it and not into process.env. (Same reasoning as api-origin.ts.)
 */

function read(name: string): string | undefined {
  const runtime = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
  const build = (import.meta.env as Record<string, string | undefined>)[name];
  const value = runtime || build;
  return value && value.trim() ? value.trim() : undefined;
}

export type EditorConfig = {
  boatApiKey: string;
  githubToken: string;
  githubRepo: string;
  password: string;
  sessionSecret: string;
  /** Boat saved snapshot that new sessions start from. */
  template: string;
  /** Boat environment: marked safe for third parties, AI keys as placeholders. */
  environment: string;
  /** Agent harness on Boat: claude, codex, pi, opencode, ... */
  agentProvider: string;
  agentModel?: string;
  /** Per mode: small pointed edits vs structural work. */
  quick: { model?: string; effort?: string };
  deep: { model?: string; effort?: string };
  /** Fast model for quick wording changes, run in the sandbox; null turns them off. */
  fastModel: string | null;
  /** "merge": Publish merges to main. "review": Publish opens a pull request for a developer. */
  publishMode: "merge" | "review";
  /** Public Sanity ids, for sessions that install the site without a template. */
  sanity: { projectId: string; dataset: string };
  /** API base overrides, for pointing a local run at stand-ins. Unset in production. */
  boatApiBase?: string;
  githubApiBase?: string;
};

const REQUIRED = [
  "BOAT_API_KEY",
  "GITHUB_TOKEN",
  "EDITOR_PASSWORD",
  "EDITOR_SESSION_SECRET",
] as const;

/** Which required settings are missing, for a readable setup error. */
export function missingSettings(): string[] {
  return REQUIRED.filter((name) => !read(name));
}

export function editorConfig(): EditorConfig {
  const missing = missingSettings();
  if (missing.length)
    throw new Error(`Editor is not configured: set ${missing.join(", ")}`);
  return {
    boatApiKey: read("BOAT_API_KEY")!,
    githubToken: read("GITHUB_TOKEN")!,
    githubRepo: read("GITHUB_REPO") ?? "show-karma/filecoin-grants",
    password: read("EDITOR_PASSWORD")!,
    sessionSecret: read("EDITOR_SESSION_SECRET")!,
    template: read("BOAT_TEMPLATE") ?? "filpgf-editor",
    environment: read("BOAT_ENVIRONMENT") ?? "filpgf-editor",
    agentProvider: read("EDITOR_AGENT_PROVIDER") ?? "claude",
    agentModel: read("EDITOR_AGENT_MODEL"),
    quick: {
      model: read("EDITOR_MODEL_QUICK") ?? read("EDITOR_AGENT_MODEL"),
      effort: read("EDITOR_EFFORT_QUICK") ?? "low",
    },
    deep: {
      model: read("EDITOR_MODEL_DEEP") ?? read("EDITOR_AGENT_MODEL"),
      effort: read("EDITOR_EFFORT_DEEP") ?? "high",
    },
    fastModel: fastModel(read("EDITOR_FAST_MODEL")),
    publishMode: read("EDITOR_PUBLISH_MODE") === "review" ? "review" : "merge",
    sanity: {
      projectId: read("PUBLIC_SANITY_PROJECT_ID") ?? "86k25j71",
      dataset: read("PUBLIC_SANITY_DATASET") ?? "production",
    },
    boatApiBase: read("BOAT_API_BASE"),
    githubApiBase: read("GITHUB_API_BASE"),
  };
}

/** The two settings sign-in needs, so /edit can explain a half-done setup. */
export function authConfig(): { password?: string; sessionSecret?: string } {
  return {
    password: read("EDITOR_PASSWORD"),
    sessionSecret: read("EDITOR_SESSION_SECRET"),
  };
}

function fastModel(value: string | undefined): string | null {
  if (value === "off") return null;
  // It is spliced into a command (base64, but checked anyway).
  return value && /^[a-z0-9][a-z0-9.@-]{0,80}$/.test(value)
    ? value
    : "claude-haiku-5-5";
}
