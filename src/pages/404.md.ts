import type { APIRoute } from "astro";
import { notFoundMarkdown } from "../lib/agent-markdown";

/** Served with a 404 status to Markdown requests; see markdown-negotiation. */
export const GET: APIRoute = ({ site }) =>
  new Response(notFoundMarkdown(site!), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
