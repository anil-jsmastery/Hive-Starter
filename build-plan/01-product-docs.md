# Step 01: Product docs (no code)

| | |
| --- | --- |
| What you'll learn | Project vs product: define the outcome and the tracking plan before code |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 00 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** write down who Hive is for, what success means and what we'll measure, before any app code.

`PRODUCT.md`, **VERBATIM**:

```md
# Hive

## Who it's for
Developers who use AI coding agents and want reusable instructions (skills) for
them, alone or with their team.

## The problem
Good agent skills live in random repos and gists. They're hard to find, hard to
trust, and nobody knows which ones actually get used.

## The value moment
A developer finds a skill for their task and installs it (copies the command).

## Activation
- Consumers: first skill installed.
- Builders: first skill published.
- Teams: first skill published as a team.

## Business model
Public skills are free. Private skills are paid: Pro for individuals, Team for
organizations.

## Success metric for launch week
Share of new sign-ups who install or publish a skill within their first visit.

## Not building in v1
Editing or deleting skills, uploads, dark mode, threaded comments, a real CLI,
social sign-in, seat-based pricing.
```

`TRACKING_PLAN.md`, **VERBATIM**:

```md
# Tracking plan

Rule: an event with no decision attached is a line on a bill.

| Event | Where | Question it answers | Decision it informs |
| --- | --- | --- | --- |
| landing_cta_clicked | client, / | Does the landing page convert, and from which source? | Rewrite the landing page or change channels |
| user_signed_up (+ identify) | server, first profile | Who signs up, with which stack, from where? | Which audiences to build for |
| search_performed | client, /explore | What do people want, and what returns nothing? | Which skills to seed or commission |
| search_result_opened | client, /explore | Is ranking putting good results first? | Change search ranking |
| skill_viewed | client, /s/[slug] | Which skills attract attention? | What to feature |
| share_link_opened | client, /s/[slug] | Does sharing bring people in? | Invest in the referral loop |
| skill_installed | server, /s/[slug] | Do people get value? (consumer value event) | Our north-star input |
| skill_starred, comment_posted | server, /s/[slug] | Who engages socially and returns? | Invest in community features |
| skill_forked | server, /s/[slug] | Do people engage deeply? | Invest in remixing features |
| publish_started, skill_published | client / server, /publish | Where do builders give up? (builder activation) | Fix the publish flow |
| notification_clicked | server, /dashboard | Do notifications bring people back? | Keep or change notifications |
| organization_created | server, webhook | Do teams adopt Hive? | Invest in team features |
| paywall_shown | client, /publish | How many people want a paid feature? | Price and position Pro and Team |
| pricing_viewed | client, /pricing | Do people who hit the paywall look at plans? | Fix the upgrade path |
| subscription_started, subscription_canceled | server, webhook | Would someone pay, and do they stay? | Keep, change or drop the paid plans |

Not tracked on purpose: follows, profile views, log-ins. No decision depends on them yet.
Groups: every event sent while a team is active is attached to that organization.
```

`DECISIONS.md`, **VERBATIM**:

```md
# Decision log

One entry per decision: the date, the decision and the evidence behind it.

| Date | Decision | Evidence |
| --- | --- | --- |
```

## Checks

The three files exist with exactly this content.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 01
- PRODUCT.md, TRACKING_PLAN.md and DECISIONS.md exist. The tracking plan is the only source of event names.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 01: product docs` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `02-design-system.md`
