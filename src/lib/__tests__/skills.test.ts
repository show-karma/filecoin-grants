import { describe, expect, it } from "vitest";
import { SKILLS } from "../skills";

/*
 * The Agent Skills spec (agentskills.io) and Claude's skill loader reject a
 * SKILL.md whose frontmatter breaks these rules, so check them here rather
 * than at install time.
 */
describe("skills/", () => {
  it("has skills", () => {
    expect(SKILLS.length).toBeGreaterThan(0);
  });

  it.each(SKILLS.map((skill) => [skill.name || "(unnamed)", skill]))(
    "%s has valid frontmatter",
    (_, skill) => {
      expect(skill.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(skill.name.length).toBeLessThanOrEqual(64);
      expect(skill.name).not.toMatch(/anthropic|claude/);
      expect(skill.path).toBe(`/skills/${skill.name}/SKILL.md`);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeLessThanOrEqual(1024);
      expect(skill.description).not.toMatch(/<[^>]+>/);
    },
  );
});
