# filpgf.io

Filecoin Public Goods Funding — the public site at [www.filpgf.io](https://www.filpgf.io).
Built with [Astro](https://astro.build) and Tailwind CSS v4, deployed to Netlify as
a fully static site with no client-side JavaScript.

## Commands

| Command        | Action                                        |
| -------------- | --------------------------------------------- |
| `pnpm install` | Install dependencies                          |
| `pnpm dev`     | Dev server at `localhost:4321`                |
| `pnpm build`   | Type-check (`astro check`) and build to `dist/` |
| `pnpm preview` | Serve the production build locally            |
| `pnpm format`  | Format with Prettier                          |

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

## Data seam

**Every figure on the site is static.** Headline stats, Kernel SLA percentages,
the function inventory, and program metrics all live in `src/data/*.ts` as typed
exports transcribed from the published design.

Components import only those types, so moving to live data means replacing the
exports in `src/data/` with API reads — no component or page changes required.
The relevant modules are `landing.ts`, `kernel.ts` and `programs.ts`.

### Known data gaps

The design mockups do not legibly list every inventory row, and rows were not
invented to fill the gaps. `src/data/kernel.ts` currently holds:

- **4 of 5** declared Irreplaceable functions
- **14 of the 17** Essential functions the design lists (of 24 declared)

The inventory renders a "Showing N of M functions in this tier" note wherever
listed rows fall short of the declared count, so the gap is visible on the page
rather than silent. Fill these in from the source inventory before launch.

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

Netlify builds `pnpm run build` and publishes `dist/`. `netlify.toml` also
carries the CSP, cache headers, and 301s from the retired Hugo URLs
(`/propgf/*`, `/batches/*`).
