import { KARMA } from "../data/site";

/**
 * Where every build-time and per-render read of the Karma API goes.
 *
 * One indexer serves all of it — `/v2/communities/*`, `/v2/kernel/*` and
 * `/v2/indicators/*` — so there is one origin and one override for it. This
 * used to be two resolvers with two variable names, which meant a deployment
 * could be pointed half at one host and half at another.
 *
 * Overridable so a deployment can be aimed at a staging or tunnelled indexer
 * without editing committed config — the same escape hatch the chat widget
 * has. Unset, which is the normal case including production, it is the real
 * API from src/data/site.ts.
 *
 * `process.env` is read first because it is the only source that exists at
 * request time: Vite inlines `import.meta.env` at build, so on a deployed
 * function that value is frozen to whatever the build machine saw and would
 * ignore the Vercel dashboard forever. The inlined value still covers
 * `astro dev` and `astro build`, where Astro loads `.env` into
 * `import.meta.env` and not into `process.env`.
 *
 * To override on Vercel, set `KARMA_API_ORIGIN` as a runtime variable on the
 * project — a build-only value never reaches the ISR function.
 */
export function apiOrigin(): string {
  const atRuntime = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.KARMA_API_ORIGIN;
  const atBuild = import.meta.env?.KARMA_API_ORIGIN as string | undefined;
  return (atRuntime || atBuild || KARMA.apiHost).replace(/\/+$/, "");
}
