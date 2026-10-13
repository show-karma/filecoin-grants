/**
 * The agent skills in this repo's `skills/` folder, read at build time so
 * /llms.txt lists exactly what `npx skills add show-karma/filecoin-grants`
 * installs. The SKILL.md files are the one source; nothing here restates them.
 */

export type Skill = { name: string; description: string; path: string };

const FILES = import.meta.glob<string>("/skills/*/SKILL.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The `name` and `description` lines of a SKILL.md's YAML frontmatter. */
export const frontmatter = (source: string): Record<string, string> => {
  const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^(\w+):\s*(.+)$/gm)].map(([, key, value]) => [
      key,
      value.trim(),
    ]),
  );
};

export const SKILLS: Skill[] = Object.entries(FILES)
  .map(([path, source]) => {
    const { name = "", description = "" } = frontmatter(source);
    return {
      name,
      description,
      path,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
