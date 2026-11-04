import type { APIRoute } from "astro";
import { homeMarkdown, postSummaries } from "../lib/agent-markdown";

/** Served for `/` when the request asks for Markdown; see markdown-negotiation. */
export const GET: APIRoute = async ({ site }) =>
  new Response(homeMarkdown(await postSummaries(), site!), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
