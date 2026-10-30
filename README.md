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
  sanity/        Sanity schema (the blog post document type)
  styles/        global.css — design tokens and shared utilities
public/          Static assets served as-is (favicons, robots.txt, CNAME)
sanity.config.ts Sanity Studio, served at /studio
```

## Blog

Posts live in Sanity, not in the repo. Editors sign in at `/studio` with the
account they were invited with (sanity.io/manage → Members) and publish from
there; publishing triggers a Vercel deploy hook, so the site rebuilds on its own.

The build reads published posts through the `blog` content collection
(`src/lib/sanity-blog.ts`). It needs `PUBLIC_SANITY_PROJECT_ID` and
`PUBLIC_SANITY_DATASET` (see `.env.example`). Drafts never reach the build:
Sanity only returns published documents.

`scripts/migrate-blog-to-sanity.ts` is the one-off that moved the original
Markdown posts across; it needs an editor token in `SANITY_WRITE_TOKEN`.

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

## Site editor

`/edit` lets the programme team change the site without a developer. They
describe a change in a chat, watch it appear in a live preview of the real
site, and press Publish. It is a coding agent working on this repository, so
anything the code can do is in reach: copy, layout, new sections, new pages.

### What it feels like

- **Point and ask.** Hover the preview and elements light up with what they
  are (Heading, Text, Image…). Click one and ask for a change right there, or
  pick a quick action (Edit text, Shorter, Rewrite, Replace image, Remove).
  Shift-click selects several. The request carries the element's exact source
  file and line, so the agent goes straight to it.
- **Type over text.** Double-click any text, type, press Enter. The page
  shows it at once and it is written into the source and saved in the
  background, with no AI involved, so the next edit can start straight away.
  Text with a link or bold words in it is matched piece by piece. When the
  words can't be matched safely (they appear twice, or need escaping) it hands
  the change to the agent instead.
- **Quick wording changes.** A request that only changes words ("make this
  punchier", "rename Programs funded to Active programs") goes first to a fast
  model (Claude Haiku, `EDITOR_FAST_MODEL`), which reads the text on the page
  and returns new text for the pieces it changes: about 2 seconds instead of
  a full agent turn. The model never sees or writes code; its text goes
  through the same exact-match edit as typing over the page, and anything it
  can't do that way (styling, layout, images, new elements) goes to the agent.
- **Watch it happen.** The area being changed shimmers while the agent works;
  progress reads as plain steps; when the change lands it flashes, and the
  preview moves to the page it is on.
- **Change cards.** Every saved change becomes a card with a before/after
  screenshot slider, the words that changed, **Show me** and **Undo**.
- **Richer input.** Drop a photo on an image to replace it, paste or attach
  screenshots for reference, dictate with the mic, or paste a Google Doc
  (headings and lists are kept).
- **Studio polish.** Full-width preview with desktop, tablet and phone frames;
  the assistant floats beside it (⌘J); ⌘K opens every command, page and
  action; quick requests use low reasoning effort and structural ones high.

### How it works

```
/edit (browser) ──► /api/editor/* (Vercel) ──► Boat sandbox ──► agent edits ~/site
     ▲                       │                     │            astro dev :4321
     └──── preview iframe ◄──┼──── https://<id>-4321.on.boat.dev (hot reload)
                             └──► GitHub: editor/draft branch ──► PR ──► squash-merge to main ──► Vercel
```

1. **Start.** Opening `/edit` starts a [Boat](https://docs.boat.dev) sandbox
   from a saved template (repo cloned, packages installed). It checks out the
   draft branch if there is one, else `main`, and starts `astro dev`. The
   preview appears in about 15–30 seconds.
2. **Edit.** Each chat message goes to the agent inside the sandbox (Claude Code
   by default). Its file changes show in the preview within a second. Its
   house rules are in `src/lib/editor/agent-rules.md`.
3. **Save.** After every reply the server copies the changed files into one
   commit on the `editor/draft` branch through the GitHub API. Closing the tab
   loses nothing; the next session resumes the draft.
4. **Publish.** Runs `pnpm run build` (astro check + build) in the sandbox on
   the exact draft. If it passes, the server opens a pull request from
   `editor/draft`, squash-merges it into `main`, deletes the branch and the
   sandbox. Vercel deploys `main` as usual. A failed check publishes nothing
   and offers to have the agent fix it. With `EDITOR_PUBLISH_MODE=review`,
   the pull request is left open for a developer instead.

The preview's in-page layer lives only in the sandbox: the session writes
`src/lib/editor/sandbox/*` to `site/.editor/`, which `.git/info/exclude` hides
from git, and runs `astro dev` with `.editor/editor.config.mjs` (the site's
config plus an injected script). Astro's dev mode tags every element with
`data-astro-source-file`/`-loc`, which is what turns a click into a line of
code. Screenshots come from the sandbox's Chrome over the DevTools protocol;
change cards are a JSON-lines log in the sandbox.

Nothing is stored on our side: the live sandbox is found by name on Boat, and
the draft is a branch on GitHub. One workspace runs at a time; a second person
opening `/edit` joins it.

### Safety

- The sandbox holds **no GitHub credentials**. It clones the public repo
  anonymously; only the server's `GITHUB_TOKEN` writes to GitHub.
- The editor never commits CI config, env files (at any depth), build and
  server code (`package.json`, the lockfile, `astro.config.mjs`,
  `vercel.json`, `tsconfig.json`, `scripts/`, `src/pages/api/`, middleware)
  or its own code. Publish refuses while such changes are pending, so the
  check always builds what gets merged. Symlinks are refused. The lists are in
  `src/lib/editor/sandbox-scripts.ts`.
- Publish merges only the exact tree the check built (it compares git tree
  ids), and only when the agent is idle.
- **Trust model.** Pages and components run during the Vercel build, where the
  project's environment variables are readable, and the editor exists to let
  the agent change them. Anyone with the editor password can therefore change
  code that runs at build time. Treat the password like commit access: long
  and random (12 characters minimum is enforced), shared only with the team,
  and rotated when someone leaves (changing it signs everyone out). Add a
  Vercel Firewall rate-limit rule on `/api/editor/login`. Set
  `EDITOR_PUBLISH_MODE=review` to have Publish open a pull request for a
  developer instead of merging.
- No text from the chat is ever pasted into a shell command; commands are
  constants, and only validated git ids are spliced in.
- Sign-in is one shared password plus the person's name (used as the commit
  author), in a signed `HttpOnly`, `SameSite=Strict` cookie. Writes also
  check the `Origin` header.
- The preview URL is public but unguessable, so it can load in an iframe. It
  shows the unpublished draft of a public site.
- `/edit` and `/api/editor/*` are excluded from ISR (`astro.config.mjs`), so
  nothing personal is cached at the edge.

### Setup (once)

1. **Boat.** Create an API key (dashboard → API keys). Under **Agents &
   Proxying**, connect the agent: an Anthropic API key with a spend limit is
   the simplest.
2. **Template.** With `BOAT_API_KEY` in `.env.local`:
   `node scripts/editor/build-template.ts`. It creates the `filpgf-editor`
   environment and the `filpgf-editor` template (about 5 minutes). Rerun it
   after big dependency changes. Sessions still work with a stale template;
   they just spend longer installing.
   - By default the sandbox receives the AI key itself and nothing else, so an
     agent told to could read it. Use a dedicated key with a spend limit. With
     `--proxy`, Boat keeps the key and the sandbox gets a placeholder, so even
     someone with the editor password cannot read it. Recommended; the proxy
     costs about $1/day plus $1 per 1,000 AI requests on Boat.
3. **GitHub token.** A fine-grained token for `show-karma/filecoin-grants`
   only, with Contents and Pull requests set to read & write.
4. **Vercel.** Add `BOAT_API_KEY`, `GITHUB_TOKEN`, `EDITOR_PASSWORD` (12+
   characters, random) and `EDITOR_SESSION_SECRET` (`openssl rand -base64
   32`) as Production variables. Optional ones are listed in `.env.example`.
   For local runs, `BOAT_API_BASE` and `GITHUB_API_BASE` point the editor at
   stand-ins.

### Costs

About $0.02 per 30-minute session on Boat's default machine ($0.036/hour,
billed per second, deleted after publish or after an hour idle). The AI agent's
usage is the larger cost and depends on the model chosen on Boat.

### Limits

- Pages that read the Karma API (`/`, `/kernel`) call it on every request in
  the preview, so they load in about 1–6 seconds there.
- Blog posts stay in Sanity (`/studio`); the agent points people there.
- Files over 5 MB are refused; photos are shrunk in the browser before
  upload. Without the key's `file.write` permission, uploads travel in ~100 KB
  pieces (a 300 KB photo takes about 3 seconds).
- Change cards, Undo and screenshots belong to one session; a new session
  shows earlier unpublished work as part of the draft, not as cards.
- If `main` moved in a way that conflicts with the draft, Publish leaves the
  pull request open for a developer instead of merging.
