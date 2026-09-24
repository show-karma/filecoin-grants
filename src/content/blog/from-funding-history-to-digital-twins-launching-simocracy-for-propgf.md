---
title: "From Funding History to Digital Twins: Launching Simocracy for ProPGF"
date: 2026-09-24
description: "Simocracy is now live on filpgf.io: digital twins of our active reviewers take the first pass at evaluating applications, while humans keep the final say. Here is how it works, what made it possible, and what comes next."
author: "PLFIF Team"
---

Every grant program has the same bottleneck: the attention of the people making decisions. Reviewers can deliberate carefully, but only over so many applications, and much of their time goes to first-pass reads instead of the hard calls where their judgment matters most.

This year we set out to test a different approach. We are happy to share that the integration of Simocracy, developed in partnership with PL R&D and Karma, is now complete on [filpgf.io](https://www.filpgf.io/). Simocracy builds sims, or digital twins, of our active reviewers, and lets them take the first pass at evaluating applications while humans keep the final say.

Simocracy has already been tested with real money in community settings, most recently allocating $10,000 across ten days at [Edge Esmeralda](https://blog.cosmos-institute.org/p/we-gave-a-village-personal-ai-agents). ProPGF is the first standing grant program to run it as part of its regular review process.

## How Simocracy works at ProPGF

The goal is not a generic AI reviewer but one that reflects a specific person's priorities, standards, and judgment.

![Sim evaluations panel in Karma: marginal value curves for each reviewer's sim on one scale from $0 to $280,000, and a "Where the council lands" bar chart showing each sim's total value relative to the highest](/blog/from-funding-history-to-digital-twins-launching-simocracy-for-propgf/sim-evaluations.png)

In practice, a sim is not a separate AI model trained on each reviewer. It is a profile, a written record of that reviewer's priorities, standards, and red lines, built from their past decisions, call transcripts, and a structured interview, combined with the evaluation skills described below. [Karma](https://karmahq.xyz), the grants platform behind filpgf.io, handles the workflow from start to finish. Teams submit applications and milestone reports in Karma as usual. From there:

- **Sims take the first pass.** Each submission syncs automatically from Karma to Simocracy, where each reviewer's sim evaluates it and produces a recommendation, a suggested amount, and its reasoning.
- **Humans stay in charge.** The sim's evaluation appears back in Karma next to the full application. Reviewers decide whether to accept, adjust, or reject it there, instead of reviewing every application end to end.
- **Human time goes where it matters most.** With the first pass handled, reviewers can spend their attention on the hard calls, the edge cases, and the conversations and negotiations with teams that no model can replace.

We see this as a way to scale careful judgment without diluting it. Simocracy lets a committee's capacity stretch further while keeping accountability with the people who hold it.

## What makes this possible: our funding history, turned into skills

A sim is only as good as the context it reasons from. Two pieces of groundwork over the last few months made Simocracy workable at ProPGF.

_Making our funding history usable._ Every grant program sits on a quiet asset it rarely uses: its own history. Every application, committee debate, milestone report, and funding decision is a record of what a community values and how well its bets paid off.

Most programs let that record scatter across spreadsheets. We did the unglamorous work of pulling our past funding data into one place, cleaning it, and categorizing it so it can be queried, compared, and reused. The dataset combines public information, such as funded projects, grant amounts, rounds, and reported outcomes, and data teams shared with us during application and reporting.

_From research to agent skills._ Data on its own doesn't evaluate anything; it needs a method. Over several rounds, ProPGF has built one: in our program design and evaluation criteria, in research like our work on the [Filecoin Kernel](/blog/introducing-the-filecoin-kernel/), which clarified which functions make the network resilient, and in knowledge that has mostly lived in reviewers' heads. We have packaged that knowledge, together with our funding data, into skills: bundles of instructions, context, and data that AI agents can load when evaluating an application. An agent reviewing a proposal can check what we've funded before and what it delivered, place the proposal in the wider ecosystem, and apply our criteria consistently. These skills are the shared foundation every sim reasons from, and they compound: each round adds data, each committee decision sharpens the method, and each improvement flows back into the sims.

## What comes next for Simocracy

This is an experiment, and we're treating it like one. Over the coming rounds we will:

- **Keep using sims in live evaluations**, so they are tested against real decisions rather than hypothetical ones.
- **Collect feedback from each sim's human counterpart**, capturing where the sim got it right, where it missed, and why, and feeding that back into improving it.
- **Run blind evaluations** that compare sim and human judgments without either side knowing which is which, and use the results to fine-tune the sims.

We'll publish more detailed research on the method and results soon.
