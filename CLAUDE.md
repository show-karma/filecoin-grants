# CLAUDE.md — filpgf.io (filecoin-grants)

Astro 5 static site for Filecoin Public Goods Funding, deployed on Vercel.

## The navbar is shared with the app — change both or neither

`www.filpgf.io` (this repo) and `app.filpgf.io` (**gap-app-v2**) are deliberately
built to read as one product: same header, same wording, same order. They are two
codebases, and **nothing enforces the match but the reviewer**.

| Surface | Where its nav lives |
|---|---|
| `www.filpgf.io` | this repo — `src/data/nav.ts` |
| `app.filpgf.io` | gap-app-v2 — `src/infrastructure/config/tenant-navigation-config.ts`, the `filecoin` tenant's `navigation.items` |

**A change to any label, ordering, grouping or destination in one needs the same
change in the other, in the same batch of work.** A nav change that lands in only
one repo is a bug rather than a partial delivery: the header rearranges under
anyone moving between the two sites. Historically this has been missed — the
Funding menu was restructured here and left stale in the app.

Known structural difference, not an oversight: the app appends its social menu
("Connect") after every tenant item, hardcoded in `whitelabel-navbar.tsx`, so
nothing can sit *after* Connect there the way `Blog` does here. Closing that gap
means changing a component shared by every whitelabel tenant.

Two other things mirror across the repos, each with a comment saying so:

- **Identity hint** — `src/data/site.ts` `IDENTITY_HINT` ↔ gap-app-v2
  `tenantIdentityHintCookieDomain.filecoin` in `tenant-config.ts`.
- **Ask Karma token bridge** — `src/data/site.ts` `TOKEN_BRIDGE` ↔ gap-app-v2
  `src/features/token-bridge/protocol.ts` and `utilities/token-bridge/origins.ts`.

## Data

Live figures come from the Karma indexer through `src/lib/api-origin.ts` — one
origin for `/v2/communities/*`, `/v2/kernel/*` and `/v2/indicators/*`. Override
with `KARMA_API_ORIGIN` (a **runtime** var on Vercel, since these pages render on
demand); unset, it falls back to the committed host in `src/data/site.ts`.

`/kernel` and `/` render on demand via Vercel ISR on an hourly window; every other
route is prerendered. An unreachable API must never fail the build or render
zeros — the page drops the affected section instead and logs why.

Figures that disagree with the API (`FINANCIALS`, `PORTFOLIO` in
`src/data/landing.ts`) are kept as fallbacks and as the record of the
discrepancy. Read the comments there before "fixing" a number.

## Commands

```bash
pnpm dev      # astro dev — `astro preview` does NOT work with the Vercel adapter
pnpm build    # astro check && astro build
pnpm test     # vitest
```
