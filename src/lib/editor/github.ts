/*
 * The GitHub side of the editor: saving a draft commit and publishing it.
 *
 * Everything goes through the REST API with a token that lives only on the
 * server (Vercel). The sandbox never holds GitHub credentials: it clones the
 * public repo anonymously, and the server reads the changed files out of it
 * and writes them here.
 */

export type GitHubConfig = { token: string; repo: string; apiBase?: string };

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export type TreeEntry = {
  path: string;
  mode: "100644" | "100755" | "120000";
  type: "blob";
  sha: string | null;
};

/** Branch names go into URL paths unencoded (GitHub wants `heads/a/b`), so keep them plain. */
function refName(branch: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes(".."))
    throw new Error(`Bad branch name: ${branch}`);
  return branch;
}

export class GitHub {
  private readonly token: string;
  readonly repo: string;
  private readonly apiBase: string;

  constructor(config: GitHubConfig) {
    if (!config.token) throw new Error("GITHUB_TOKEN is not set");
    this.token = config.token;
    this.repo = config.repo;
    this.apiBase = (config.apiBase ?? "https://api.github.com").replace(
      /\/+$/,
      "",
    );
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.apiBase}/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new GitHubError(
        res.status,
        `GitHub ${method} ${path}: ${json.message ?? res.statusText}`,
      );
    }
    return json as T;
  }

  /** The commit a branch points at, or null when the branch does not exist. */
  async branchHead(branch: string): Promise<string | null> {
    try {
      const ref = await this.call<{ object: { sha: string } }>(
        "GET",
        `/git/ref/heads/${refName(branch)}`,
      );
      return ref.object.sha;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  async commitTree(sha: string): Promise<string> {
    const commit = await this.call<{ tree: { sha: string } }>(
      "GET",
      `/git/commits/${sha}`,
    );
    return commit.tree.sha;
  }

  async createBlob(base64: string): Promise<string> {
    const blob = await this.call<{ sha: string }>("POST", "/git/blobs", {
      content: base64,
      encoding: "base64",
    });
    return blob.sha;
  }

  async createTree(baseTree: string, entries: TreeEntry[]): Promise<string> {
    const tree = await this.call<{ sha: string }>("POST", "/git/trees", {
      base_tree: baseTree,
      tree: entries,
    });
    return tree.sha;
  }

  async createCommit(input: {
    message: string;
    tree: string;
    parent: string;
    author: { name: string; email: string };
  }): Promise<string> {
    const commit = await this.call<{ sha: string }>("POST", "/git/commits", {
      message: input.message,
      tree: input.tree,
      parents: [input.parent],
      author: input.author,
    });
    return commit.sha;
  }

  /**
   * Points `branch` at `sha`, creating it if needed. Never forced: if the
   * branch moved since we read it, GitHub refuses and the save is retried
   * from the new head rather than overwriting someone else's commit.
   */
  async setBranch(branch: string, sha: string, exists: boolean): Promise<void> {
    if (exists) {
      await this.call("PATCH", `/git/refs/heads/${refName(branch)}`, {
        sha,
        force: false,
      });
    } else {
      await this.call("POST", "/git/refs", {
        ref: `refs/heads/${branch}`,
        sha,
      });
    }
  }

  async deleteBranch(branch: string): Promise<void> {
    try {
      await this.call("DELETE", `/git/refs/heads/${refName(branch)}`);
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 422))
        return;
      throw e;
    }
  }

  /** Files that differ between two refs, as GitHub sees them. */
  async compare(base: string, head: string) {
    return this.call<{
      ahead_by: number;
      behind_by: number;
      files?: { filename: string; status: string }[];
    }>("GET", `/compare/${refName(base)}...${refName(head)}`);
  }

  async findOpenPull(head: string, base: string) {
    const owner = this.repo.split("/")[0];
    const pulls = await this.call<{ number: number; html_url: string }[]>(
      "GET",
      `/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`,
    );
    return pulls[0] ?? null;
  }

  async createPull(input: {
    head: string;
    base: string;
    title: string;
    body: string;
  }) {
    return this.call<{ number: number; html_url: string }>(
      "POST",
      "/pulls",
      input,
    );
  }

  async updatePull(number: number, input: { title: string; body: string }) {
    return this.call<{ number: number; html_url: string }>(
      "PATCH",
      `/pulls/${number}`,
      input,
    );
  }

  /** Squash-merges a pull request. Only merges if the head is still `sha`. */
  async mergePull(
    number: number,
    input: { sha: string; title: string; message: string },
  ) {
    return this.call<{ sha: string; merged: boolean }>(
      "PUT",
      `/pulls/${number}/merge`,
      {
        merge_method: "squash",
        sha: input.sha,
        commit_title: input.title,
        commit_message: input.message,
      },
    );
  }
}
