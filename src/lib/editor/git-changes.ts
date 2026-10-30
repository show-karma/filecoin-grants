/*
 * Turns `git diff --raw -z --no-renames --no-abbrev` output from the sandbox
 * into the file changes the editor commits to GitHub.
 *
 * Pure, so it is tested without a sandbox.
 */

export type FileChange =
  | { kind: "write"; path: string; mode: GitMode; blobSha: string }
  | { kind: "delete"; path: string };

export type GitMode = "100644" | "100755";

const SHA = /^[0-9a-f]{40}$/;
// Symlinks (120000) are refused: a link to a file outside the site could
// carry it into the build output.
const MODES = new Set(["100644", "100755"]);

export function isSha(value: string): boolean {
  return SHA.test(value);
}

/**
 * Raw format, one record per changed path, NUL-separated with `-z`:
 *
 *   :<old mode> <new mode> <old sha> <new sha> <status>\0<path>\0
 *
 * Status is A, M, D or T (type change). Renames and copies cannot appear with
 * --no-renames. Submodules (160000) and symlinks (120000) are refused: the
 * site has none, and the agent adding one is not something to publish
 * silently.
 */
export function parseRawDiff(output: string): FileChange[] {
  const parts = output.split("\0");
  const changes: FileChange[] = [];
  for (let i = 0; i < parts.length; i++) {
    const header = parts[i];
    if (!header) continue;
    if (!header.startsWith(":")) {
      throw new Error(
        `Unexpected git diff output near "${header.slice(0, 40)}"`,
      );
    }
    const path = parts[++i];
    if (!path) throw new Error("git diff record has no path");
    const [, newMode, , newSha, status] = header.slice(1).split(" ");
    if (status === "D") {
      changes.push({ kind: "delete", path });
      continue;
    }
    if (!MODES.has(newMode)) {
      throw new Error(
        `${path} is a link or submodule, which the editor does not publish`,
      );
    }
    if (!isSha(newSha)) throw new Error(`Bad blob id for ${path}`);
    changes.push({
      kind: "write",
      path,
      mode: newMode as GitMode,
      blobSha: newSha,
    });
  }
  return changes;
}

/** A short human list for commit messages and the chat: "3 files: a, b, c". */
export function describeChanges(changes: FileChange[], max = 6): string {
  if (changes.length === 0) return "no files";
  const names = changes
    .slice(0, max)
    .map((c) => (c.kind === "delete" ? `${c.path} (deleted)` : c.path));
  const more = changes.length > max ? `, and ${changes.length - max} more` : "";
  return `${changes.length} file${changes.length === 1 ? "" : "s"}: ${names.join(", ")}${more}`;
}
