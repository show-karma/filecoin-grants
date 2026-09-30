---
title: "What we’re building into filpgf.io"
date: 2026-09-30
description: "The filpgf.io roadmap, in short."
---

_Three objectives, three partners, and one loop that makes every funding decision better informed than the last._

Filecoin Public Goods Funding (PGF) is moving into its next phase. With Simocracy [now live in our review process](https://www.filpgf.io/blog/from-funding-history-to-digital-twins-launching-simocracy-for-propgf/), we’re building filpgf.io into the place where the program shows its work: what’s funded, how those projects are doing, and how decisions get made.

Over the next six months, that work is organized around three objectives and built together with three partners: [Karma](https://www.karmahq.org/), [Simocracy](https://www.simocracy.org/), and [OSO](https://www.oso.xyz/).

The full plan, with every feature, team, and delivery window, lives in the [filpgf.io roadmap](/roadmap/). This post is the short version.

## What we’re building toward

The build is organized around three objectives:

- **Measure impact and maintenance.** Funding only matters if what it produces lasts. OSO tracks impact and maintenance for every funded project across [Kernel](https://www.filpgf.io/kernel/), [R&D](https://www.filpgf.io/rnd/), and [Revenue Development](https://www.filpgf.io/revenue-development/), and is being built out to flag stalled data sources before anyone has to go looking. Verified outcomes will also be captured as project-level hypercerts.
- **Make applications and reviews AI-native.** Applications adapt to each project’s scope of work, and a Simocracy sim drafts the first review of every milestone. A person always makes the call, and every review is captured in filpgf.io.
- **Track every funded project, keep ops light.** Karma gives the program team one admin view of every application, milestone, and invoice, queued by priority and age. Feedback from Slack, Telegram, and Simocracy attaches to the item it belongs to, so there’s less chasing for everyone.

Underneath all three sits one principle: a single source of truth for the program, so funded teams, reviewers, and the program team all work from the same information.

## One loop, three partners

These pieces are being built to work together. Applications, reviews, and impact data all feed one system, so what we learn at each step informs the next.

- **Karma hosts the data.** Karma, the AI-powered funding platform behind filpgf.io, holds the program’s records: incoming applications and milestone reports, along with the metrics and sim reviews collected through OSO and Simocracy.
- **Simocracy takes the first pass.** Each submission syncs to Simocracy, where a reviewer’s sim drafts an assessment. The reviewer sees it next to the full application and decides whether to accept, adjust, or reject it. We covered how this works in [our Simocracy launch post](https://www.filpgf.io/blog/from-funding-history-to-digital-twins-launching-simocracy-for-propgf/).
- **OSO measures what happens next.** Once a project is funded, OSO tracks its impact and maintenance over time and flags when a data source stalls or drops below a threshold. For Kernel, this already runs in public: the functions each project stewards and their metric definitions are registered in the [pgf-monitor repository](https://github.com/filecoin-project/pgf-monitor), which powers the [Kernel health monitoring on filpgf.io](https://www.filpgf.io/kernel/).
- **Karma surfaces what’s collected.** Sim assessments and OSO metrics come together in Karma, where they show up in admin queues, project cover pages, reports, and Ask Karma.

Every time the loop comes around, the next review starts with better data than the last one. A reviewer looking at a renewal can see what the project delivered last time, and the program team can see early when a project could use support. The same process helps us efficiently track and showcase the ecosystem’s needs and priorities, and keep applicants and stakeholders informed about them.

## Faster decisions, fewer nudges

The day-to-day test of all this is how funding support feels for funded teams and reviewers. With sims preparing the first pass and admins working from one queue, people can spend their time on judgment calls rather than chasing updates. These are the service commitments filpgf.io is designed to support, helping us keep SLAs consistent across a decentralized environment:

- Project milestone reviewers are notified of their sim’s assessment within one business day.
- Standard milestone reviews are completed within one week. Reviews that require changes or further discussion may take additional time, with a target ceiling of two weeks.
- We’re targeting a two-week payout window for invoices on verified milestones.

Admin views will report performance against these every two weeks. Feedback from Simocracy and from selected Slack and Telegram automations will be incorporated through successive iterations of this build-out.

## When it ships

The roadmap runs in three windows, and each one builds on the last.

_September and October._ Simocracy integration for milestone reviews, funding metrics on cover pages, project views, and reports, live admin queues for applications, milestones, and invoices, and the first AI-native application flow.

_November and December._ Slack and Telegram integration, automated project health monitoring, and dashboards that show how AI assessments line up with human sign-off.

_January and February._ Project-level hypercerts for verified outcomes, and a look back at what shipped and what it changed.

## What comes next

This is a rolling roadmap, and we’re treating it like one. We revisit priorities every week based on what we hear from funded teams, reviewers, and admins, so sequencing and dates may shift.

If the next six months go to plan, anyone will be able to see where PGF money went and how those projects are doing without having to ask. A funded team will be able to check a milestone without sending an email, and a reviewer will be able to decide from a single page.

[Explore filpgf.io](https://app.filpgf.io), and read the full roadmap for every feature, team, and delivery window. We’ll share progress as each window closes.
