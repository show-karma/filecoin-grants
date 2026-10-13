import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The bundle ships one manifest per client (Agent Plugins at the root, Claude
 * Code under .claude-plugin/). They have to describe the same plugin, so the
 * shared fields are checked here instead of trusted to stay in sync by hand.
 */
const read = (path: string) => JSON.parse(readFileSync(path, "utf-8"));

const portable = read("plugin.json");
const claude = read(".claude-plugin/plugin.json");
const portableMcp = read("mcp.json");

describe("plugin manifests", () => {
  it.each(["name", "version", "description", "license"])(
    "agree on %s",
    (field) => {
      expect(claude[field]).toBe(portable[field]);
    },
  );

  it("register the same MCP servers", () => {
    expect(Object.keys(claude.mcpServers)).toEqual(
      Object.keys(portableMcp.mcpServers),
    );
    for (const [name, server] of Object.entries(claude.mcpServers)) {
      expect((server as { url: string }).url).toBe(
        portableMcp.mcpServers[name].url,
      );
    }
  });

  it("list the plugin in both marketplaces", () => {
    for (const path of [
      ".claude-plugin/marketplace.json",
      ".agents/plugins/marketplace.json",
    ]) {
      expect(read(path).plugins.map((p: { name: string }) => p.name)).toContain(
        portable.name,
      );
    }
  });
});
