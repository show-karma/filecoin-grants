/*
 * A small client for the Boat sandbox API (https://docs.boat.dev/api/v1).
 *
 * Only the calls the site editor uses. Plain fetch, no SDK, and no Astro or
 * Vite imports, so `scripts/editor/build-template.ts` can run it under plain
 * `node` as well as from the editor's API routes.
 */

export const BOAT_API_BASE = "https://boat.dev/api/v1";

export type SandboxState =
  | "init"
  | "provisioning"
  | "provisioned"
  | "cloning"
  | "ready"
  | "idle"
  | "running"
  | "archiving"
  | "archived"
  | "error";

/** States in which a sandbox is alive or about to be. */
export const LIVE_STATES: SandboxState[] = [
  "init",
  "provisioning",
  "provisioned",
  "cloning",
  "ready",
  "idle",
  "running",
];

export type Sandbox = {
  id: string;
  name?: string;
  state: SandboxState;
  error?: string | null;
  labels?: Record<string, string>;
  setupStatus?: "pending" | "running" | "done" | "failed" | null;
  setupError?: string | null;
  createdAt?: string;
  archiveAfter?: string | null;
};

export type CommandResult = {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  stdoutTruncated?: boolean;
};

export type DetachedCommand = { processId: number; pid: number };

export type CommandStatus = {
  status: "running" | "exited" | "lost";
  running: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type PromptRun = {
  promptId: string;
  status:
    "sending" | "queued" | "running" | "finished" | "failed" | "interrupted";
  done: boolean;
  conversationId?: string | null;
};

export type BoatEvent = {
  id: string;
  type: string;
  timestamp: number;
  taskId?: string | null;
  conversationId?: string | null;
  data?: Record<string, unknown>;
};

export class BoatError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "BoatError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

type CallOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  headers?: Record<string, string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Boat {
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey: string, base: string = BOAT_API_BASE) {
    if (!apiKey) throw new Error("BOAT_API_KEY is not set");
    this.apiKey = apiKey;
    this.base = base.replace(/\/+$/, "");
  }

  async call<T>(
    method: string,
    path: string,
    opts: CallOptions = {},
  ): Promise<T> {
    const url = new URL(this.base + path);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value))
        value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(opts.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let json: Record<string, any> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // A non-JSON body (a proxy error page) still has a useful status.
    }
    if (!res.ok || json.ok === false) {
      const code = json.code ?? json.error?.code ?? `http_${res.status}`;
      const message =
        json.message ??
        json.error?.message ??
        (text.slice(0, 200) || res.statusText);
      const retryable =
        json.error?.details?.retryable === true ||
        json.retryable === true ||
        code === "sandbox_starting" ||
        res.status === 503;
      throw new BoatError(
        res.status,
        code,
        `Boat ${method} ${path}: ${message}`,
        retryable,
      );
    }
    return json as T;
  }

  // ---- Sandboxes -----------------------------------------------------------

  async listSandboxes(query: {
    namePrefix?: string;
    state?: string;
    label?: string[];
  }) {
    const res = await this.call<{ sandboxes: Sandbox[] }>("GET", "/sandboxes", {
      query: { ...query, limit: 50 },
    });
    return res.sandboxes;
  }

  async createSandbox(body: Record<string, unknown>, idempotencyKey?: string) {
    return this.call<{
      sandbox: Sandbox;
      hostedPorts?: {
        port: number;
        url?: string;
        error?: string;
        message?: string;
      }[];
    }>("POST", "/sandboxes", {
      body,
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
    });
  }

  async getSandbox(id: string) {
    return (await this.call<{ sandbox: Sandbox }>("GET", `/sandboxes/${id}`))
      .sandbox;
  }

  /** Moves the auto-stop deadline to now + ttlSeconds. */
  async extend(id: string, ttlSeconds: number) {
    await this.call("PATCH", `/sandboxes/${id}`, { body: { ttlSeconds } });
  }

  /** Irreversible: deletes the machine and its snapshots. Saved snapshots stay. */
  async deleteSandbox(id: string) {
    await this.call("DELETE", `/sandboxes/${id}`, {
      headers: { "X-Ascii-Confirm-Delete": id },
    });
  }

  async host(id: string, port: number, opts: { public?: boolean } = {}) {
    return this.call<{ url: string }>("POST", `/sandboxes/${id}/host`, {
      body: { port, public: opts.public ?? false, title: "Site preview" },
    });
  }

  // ---- Commands and files --------------------------------------------------

  /**
   * Runs a command and waits for it. Retries the refusals Boat marks as safe to
   * resend (the sandbox is still mounting its disk); never retries one that may
   * have run.
   */
  async exec(
    id: string,
    command: string,
    opts: { timeoutSeconds?: number; cwd?: string } = {},
  ) {
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        return await this.call<CommandResult>(
          "POST",
          `/sandboxes/${id}/commands`,
          {
            body: {
              command,
              cwd: opts.cwd,
              timeoutSeconds: opts.timeoutSeconds ?? 30,
            },
          },
        );
      } catch (e) {
        if (
          !(e instanceof BoatError) ||
          !e.retryable ||
          Date.now() + 1500 > deadline
        )
          throw e;
      }
      await sleep(1500);
    }
  }

  async execDetached(id: string, command: string, opts: { cwd?: string } = {}) {
    return this.call<DetachedCommand>("POST", `/sandboxes/${id}/commands`, {
      body: { command, cwd: opts.cwd, detached: true },
    });
  }

  async commandStatus(id: string, processId: number, tailBytes = 4000) {
    return this.call<CommandStatus>(
      "GET",
      `/sandboxes/${id}/commands/${processId}`,
      {
        query: { tailBytes },
      },
    );
  }

  /** Writes a file (needs the key's file.write permission). */
  async writeFileBase64(id: string, path: string, base64: string) {
    await this.call("PUT", `/sandboxes/${id}/files`, {
      body: { path, content: base64, encoding: "base64" },
    });
  }

  async readFileBase64(id: string, path: string) {
    const res = await this.call<{ content: string; size: number }>(
      "GET",
      `/sandboxes/${id}/files`,
      { query: { path, encoding: "base64" } },
    );
    return res.content;
  }

  // ---- Integrated agent ----------------------------------------------------

  async prompt(
    id: string,
    body: {
      provider: string;
      prompt: string;
      model?: string;
      reasoningEffort?: string;
      new?: boolean;
      conversationId?: string;
    },
  ) {
    return this.call<{ promptId: string; conversationId?: string | null }>(
      "POST",
      `/sandboxes/${id}/prompt`,
      { body },
    );
  }

  async promptRun(id: string, promptId: string) {
    return (
      await this.call<{ promptRun: PromptRun }>(
        "GET",
        `/sandboxes/${id}/prompts/${promptId}`,
      )
    ).promptRun;
  }

  async events(
    id: string,
    query: { cursor?: string; type?: string; limit?: number },
  ) {
    return this.call<{ events: BoatEvent[]; pageInfo?: { hasMore: boolean } }>(
      "GET",
      `/sandboxes/${id}/events`,
      {
        query: {
          sort: "asc",
          limit: query.limit ?? 100,
          cursor: query.cursor,
          type: query.type,
        },
      },
    );
  }

  async interrupt(id: string) {
    await this.call("POST", `/sandboxes/${id}/interrupt`);
  }

  // ---- Snapshots and environments (template build) -------------------------

  async saveSnapshot(sandboxId: string, name: string) {
    return this.call<{ snapshot: { status: string } }>(
      "POST",
      "/saved-snapshots",
      {
        body: { sandboxId, name },
      },
    );
  }

  /** A saved snapshot that is ready to start from, or null. */
  async readySnapshot(name: string): Promise<boolean> {
    try {
      return (await this.getSnapshot(name)).status === "ready";
    } catch (e) {
      if (e instanceof BoatError && e.status === 404) return false;
      throw e;
    }
  }

  async getSnapshot(name: string) {
    return (
      await this.call<{
        snapshot: { status: string; error?: string | null; sizeBytes?: number };
      }>("GET", `/saved-snapshots/${encodeURIComponent(name)}`)
    ).snapshot;
  }

  async listEnvironments() {
    return (
      await this.call<{
        environments: {
          id: string;
          name: string;
          safeForThirdParties: boolean;
          proxyAiCredentials?: boolean;
        }[];
      }>("GET", "/environments")
    ).environments;
  }

  async createEnvironment(name: string) {
    return this.call<{ environments: { id: string; name: string }[] }>(
      "POST",
      "/environments",
      {
        body: { name },
      },
    );
  }

  async updateEnvironment(envId: string, body: Record<string, unknown>) {
    return this.call("PUT", `/environments/${envId}`, { body });
  }
}

/** Boat's event cursor: base64url of `<timestamp>:<id>` of the last event read. */
export function eventCursor(event: { timestamp: number; id: string }): string {
  return Buffer.from(`${event.timestamp}:${event.id}`, "utf8").toString(
    "base64url",
  );
}
