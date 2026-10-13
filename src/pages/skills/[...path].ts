import type { APIRoute, GetStaticPaths } from "astro";

/**
 * Serves every file under the repo's `skills/` folder at
 * filpgf.io/skills/<name>/..., so an agent can fetch a skill straight from the
 * site that /llms.txt points it to. Built from the same files the plugin
 * installs; nothing is copied.
 */
const FILES = import.meta.glob<string>("/skills/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

const TYPES: Record<string, string> = {
  md: "text/markdown; charset=utf-8",
  py: "text/x-python; charset=utf-8",
};

export const getStaticPaths = (() =>
  Object.entries(FILES).map(([file, body]) => ({
    params: { path: file.replace(/^\/skills\//, "") },
    props: { body },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, props }) =>
  new Response(props.body as string, {
    headers: {
      "Content-Type":
        TYPES[params.path?.split(".").pop() ?? ""] ??
        "text/plain; charset=utf-8",
    },
  });
