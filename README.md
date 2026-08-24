# filpgf.io

Filecoin Public Goods Funding — the public site at [www.filpgf.io](https://www.filpgf.io).
Built with [Astro](https://astro.build) and Tailwind CSS v4, deployed to Vercel.
Every page is prerendered except `/` and `/kernel`, which read the GAP API and
are served on demand behind ISR. The only client-side JavaScript is the header:
menu behaviour and the light/dark theme toggle.

## Commands

| Command        | Action                                          |
| -------------- | ----------------------------------------------- |
| `pnpm install` | Install dependencies                            |
| `pnpm dev`     | Dev server at `localhost:4321`                  |
| `pnpm build`   | Type-check (`astro check`) and build to `dist/` |
| `pnpm preview` | Serve the production build locally              |
| `pnpm format`  | Format with Prettier                            |

## Structure

```
src/
  data/          Site content and figures (see "Data seam" below)
  components/    Presentational components; kernel/ and revdev/ hold page-specific ones
  layouts/       BaseLayout — head tags, header, footer, program accent
  pages/         Routes: /, /kernel, /rnd, /revenue-development, /blog
  content/blog/  Blog posts as Markdown
  styles/        global.css — design tokens and shared utilities
public/          Static assets served as-is (favicons, robots.txt, CNAME)
```

## Live data

Two of the landing-page headline stats are read from the Karma GAP API **at
build time** (`src/lib/karma.ts`), so pages stay static and ship no client
JavaScript. A scheduled rebuild is what keeps them fresh.

| Stat                | Source                                                      |
| ------------------- | ----------------------------------------------------------- |
| Total Projects      | distinct `projectUID` across `/communities/filecoin/grants` |
| Checkpoints cleared | completed milestones ÷ total, truncated to a whole percent  |
| Committed to date   | supplied by the programme team, by round (see `FINANCIALS`) |
| Funding Initiatives | static (Kernel, Revenue Development, R&D)                   |

The API can never break a build: any failure falls back to `FALLBACK_COUNTS`
and logs a warning. Update those constants when the real numbers move, so a
fallback build is never far off.

Known discrepancy: app.filpgf.io shows `98/195` where this computes `98/197`.
The completed count matches exactly; the totals differ by two, so the two are
reading the same data with a slightly different filter. Worth reconciling.

## Data seam

**Every figure on the site is static.** Headline stats, Kernel SLA percentages,
the function inventory, and program metrics all live in `src/data/*.ts` as typed
exports transcribed from the published design.

Components import only those types, so moving to live data means replacing the
exports in `src/data/` with API reads — no component or page changes required.
The relevant modules are `landing.ts`, `kernel.ts` and `programs.ts`.

### Held back pending live data

Per review feedback, some built sections are deliberately not rendered yet:

- **Kernel inventory and metrics** — `Inventory.astro`, `MetricGrid.astro` and
  their data are intact; `src/pages/kernel.astro` just does not render them.
  Re-add both sections, their nav entries and the "See the function inventory"
  button to switch them back on.
- **Objective card figures** — `initiatives` and `amount` stay in
  `src/data/landing.ts` but are not rendered by `ObjectiveCard.astro`.
- **Health & impact metrics** — the card shows "Coming soon" instead of a link,
  via an optional `href` on `ReportCadence`.

### Known data gaps

The Kernel report declares **5 Irreplaceable** and **24 Essential** functions,
and states that **22** of them are listed. The design mockups only render 18 —
4 Irreplaceable and 14 Essential. The remaining 4 rows do not appear anywhere in
the design doc, whose Kernel section is still three comments reading "can be
added next week when metrics are finalized". Rows have not been invented to
close the gap.

So that the page cannot contradict itself, the overview table derives
**listed**, **measured** and the **rolling SLA** from `FUNCTIONS` via
`tierStats()`. The only externally sourced figure is each tier's declared
total. The table therefore reads "5 / 4 listed" and "24 / 14 listed", matching
the inventory below it, and each tier carries a "Showing N of M" note.

Two consequences worth knowing when the missing rows arrive:

- The tier SLA percentages (96.3% and 96.0%) are the mean across listed
  measured rows. The report quotes 97.3% and 96.5% over the full inventory, so
  these will move as rows are added.
- `KERNEL_METRICS` is still verbatim from the report and references "22 listed"
  and "29 declared". Those tiles are program-level figures, not derived from
  `FUNCTIONS`, so they will disagree with the table until the inventory is
  complete.

Kernel's `Important` and `Nice to have` tiers are intentionally empty — they are
not inventoried yet, and the page says so.

## Design system

Tokens are defined in `src/styles/global.css` under `@theme`.

- **Type** — Inter Tight (display), Inter (body), JetBrains Mono (labels,
  figures, and `→` links). All self-hosted via Fontsource.
- **Accents** — each program page sets `--color-accent` through `BaseLayout`'s
  `accent` prop: blue for the landing page and Kernel, red for R&D, steel blue
  for Revenue Development.
- **Tiers** — Kernel tier colours are separate tokens (`--color-tier-*`).

## Deploys

Vercel builds `pnpm run build`. The `@astrojs/vercel` adapter emits the static
routes as files and `/` and `/kernel` as ISR functions revalidating every hour.

Set `KARMA_API_ORIGIN` on the Vercel project to point the site at a staging or
tunnelled indexer. One variable covers every read — `/v2/communities/*`,
`/v2/kernel/*` and `/v2/indicators/*` are all served by the same API. It must be
a **runtime** variable: these two pages render on demand, and a build-only value
never reaches the function. Unset, the committed host in `src/data/site.ts` is
used, which is what production wants.

The CSP, cache headers, and the 301s from the retired Hugo URLs (`/propgf/*`,
`/batches/*`) still need porting to Vercel; the `netlify.toml` that declared
them was dead config and has been removed.
