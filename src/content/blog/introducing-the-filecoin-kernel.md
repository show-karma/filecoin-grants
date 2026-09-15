---
title: "Introducing the Filecoin Kernel"
date: 2026-09-14
description: "Kernel is a new approach to funding the Filecoin network's essential infrastructure: defined by functions rather than projects, monitored through a public health dashboard, and funded on a stable annual retainer."
author: "Protocol Labs Filecoin Impact Fund & Open Source Observer"
---

## A kernel at the heart of every decentralized software ecosystem

Today we're launching Kernel, a new approach to funding the Filecoin network's essential infrastructure.

Most ecosystem funding programs optimize for growth. They are designed to attract new ideas, builders, and applications, but not necessarily to sustain the infrastructure everyone quietly depends on.

The objective of the Filecoin Kernel is stability and resilience. We want the protocol's core infrastructure to be boring and unstoppable. Stable infrastructure lowers the cost of building, encourages interoperability, and gives developers the confidence to invest for the long term. We believe it should be funded as a shared public good rather than as a collection of unrelated grant proposals.

Vibrant software ecosystems emerge on top of stable foundations. The [Linux kernel](https://www.redhat.com/en/topics/linux/what-is-the-linux-kernel) is a remarkably small piece of software relative to everything built on top of it, yet it powers a **trillion-dollar software economy** because it is treated as irreplaceable infrastructure. Millions of applications compete and innovate above it because they can rely on the same foundation below. The healthier the Linux kernel became, the less anyone had to think about it.

There isn't a playbook for building this kind of program. Standing up the first Filecoin Kernel round took months of technical interviews, debate, and iteration. Along the way, we drew inspiration from the Linux kernel and the Ethereum Foundation's [research](https://www.youtube.com/watch?v=CM1FGBgJerw) into defining Ethereum's own kernel.

We hope what we've learned helps other protocol ecosystems build stable foundations of their own. Filecoin may be one of the first networks to take this approach, but it shouldn't be the last.

_There should be a well-funded kernel at the heart of every decentralized software ecosystem!_

## From projects to functions

It wasn't difficult to identify valuable infrastructure. The harder question was determining what actually belongs in the Kernel.

We started with a long list of teams, repositories, and dependencies. To narrow it down, we had to distinguish infrastructure that is foundational to the network's continued operation from infrastructure that, while valuable, serves a different role.

The distinction between functions and projects matters. Functions are abstract; projects are concrete implementations. A project may change, evolve, or eventually be replaced. The underlying function the network depends on may remain.

The Kernel is therefore defined by functions, not by permanent recipients of funding. Projects are today's stewards of those functions.

## Drawing the boundary

Once we began looking at the ecosystem through the lens of functions, the next question was where to draw the boundary.

We developed a set of tests to guide those decisions:

- **What happens if this function disappears?** Does the network immediately fail, gradually degrade, or continue operating?
- **What would it actually cost to sustain this function?** Rather than relying only on historical funding levels, we wanted to understand its underlying operational requirements.
- **How recoverable is failure?** If this function failed, could the network realistically recover?

These questions helped us group functions into four broad tiers:

- **Irreplaceable —** its disappearance creates an immediate security concern and may halt the network.
- **Essential —** the network can survive temporarily without it, but only at significant cost or risk.
- **Important —** it improves resilience or usability, but the network can ultimately recover without it.
- **Nice-to-have —** valuable work that supports growth and experimentation.

![The four Kernel tiers: Irreplaceable, Essential, Important, and Nice-to-have](/blog/introducing-the-filecoin-kernel/kernel-tiers.png)

## A framework that evolves with the network

Defining a Kernel is not a purely mechanical exercise.

Networks evolve. Implementations change. New dependencies emerge. Infrastructure that is essential today may become less critical as alternatives mature.

Throughout this process, we tested the framework against difficult questions involving client diversity, shared infrastructure, dependencies outside the protocol itself, and how the Kernel should change over time.

## Monitoring that the Kernel is healthy

Defining the Kernel is only half the problem. The other half is determining whether each function remains healthy over time.

We mapped every Kernel function to measurable health indicators and public sources of operational data. Together, these provide a public view into the health of Filecoin's critical infrastructure.

The result is a public health dashboard for the Filecoin Kernel, available at [filpgf.io/kernel](/kernel/).

Most days, it should quietly show that everything is operating as expected. When something degrades, the goal is to make both the issue and the progress toward recovery visible.

Making this data public has two important benefits.

**First**, anyone—not just the funder—can independently evaluate whether the Kernel is healthy.

**Second**, it reduces reporting overhead by replacing narrative grant reporting with continuously updated operational data.

**How the Kernel is funded**

Because Kernel functions need to be stable, the funding model is designed to be stable too. Starting in 2027, Kernel projects move to an annual retainer. Applications are pre-filled by ProPGF, so teams confirm and correct rather than write from scratch. Applications are reviewed first by agents using Kernel health metrics, with final decisions made by the review group. Once funded, projects are evaluated continuously through monthly performance reports built on the same health data behind the dashboard, with a mid-year check-in to adjust budgets as the network evolves.

![Kernel funding timeline: selection in Oct–Nov 2026 (application, review, agreement), then the 2027 term (retainer starts, monthly reports, mid-year check-in), with next year's round opening each fall](/blog/introducing-the-filecoin-kernel/kernel-funding.png)

## What's next?

This post is an introduction to the Filecoin Kernel and the thinking behind it. There is much more to unpack.

In future Kernel updates, we'll go deeper into:

- **Kernel funding:** the dedicated Kernel funding round, the 2027 funding term, and how we are approaching long-term support for essential infrastructure.
- **Kernel governance:** what the functions are, how functions enter and leave the Kernel, and how infrastructure outside the Kernel should evolve and be funded over time.
- **The methodology:** how we tested difficult boundary cases and developed the framework for classifying infrastructure.
- **Kernel health:** the metrics, monitoring systems, and public infrastructure behind the health dashboard.

The Filecoin Kernel is only a beginning.

Our hope is that the ideas behind it prove useful well beyond a single ecosystem. We'll continue to share updates from the Kernel—and other learnings from Filecoin PGF programs—through future posts and on filpgf.io.
