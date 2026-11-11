# Hive build plan (Next.js, shadcn/ui, Clerk, Supabase, PostHog)

One file per step. Run them in order with your coding agent. Each step builds one small piece of Hive, teaches one product engineering idea, updates the project memory, and ends with one commit.

## What's in this folder

| File | What it is |
| --- | --- |
| `START_HERE.md` | How to start from an empty folder, and the first prompt |
| `README.md` | This guide |
| `CONTRACT.md` | Locked decisions: routes, data model, plans, events, environment variables. Read before every step |
| `DESIGN.md` | The design system: tokens, fonts, layout, components, Clerk theming, UI text rules |
| `00-…` to `19-…` | The steps, in order |
| `design/hive-night.html` | The designer's static prototype of every page: the visual source of truth that `DESIGN.md` points to |
| `seed-skills/` | The 30 skill files Step 04 copies into `seed/skills/` |
| `swarm/` | The tested swarm harness Step 17 copies into the project |

## How this plan keeps builds identical

1. **Same starting point.** Step 00 starts from a folder holding only `build-plan/` and `.claude/settings.json`, pins every package (`save-exact`, a committed `package-lock.json`) and uses a fixed shadcn preset code.
2. **Same contracts.** Everything that must match is written out in full and marked **VERBATIM**: SQL migrations, analytics helpers, Supabase clients, validation rules, design tokens and every piece of UI text. Agents copy these and never rewrite them.
3. **Same memory.** `CLAUDE.md` and `AGENTS.md` load the rules, the contract, the design system and `MEMORY.md` into every fresh session. Each step ends by appending a VERBATIM block to `MEMORY.md`. Agents never write their own notes.
4. **Same dashboards.** Steps that need Clerk, Supabase or PostHog dashboard settings list them as an exact checklist. Wrong settings produce a different app even with identical code.
5. **One commit per step.** Every finished step is a single commit, "step NN: …", with nothing left uncommitted. If a step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` and run it again in a new conversation.

## The prompt (same for every step)

Start a **fresh agent session** for each step (in Claude Code, `/clear`), then paste this, changing only the file name:

The `/step` command (`.claude/commands/step.md`) sends exactly this prompt: type `/step 07` instead of pasting it, with any extra instructions after the number.

```text
Read build-plan/07-landing.md. Implement that step exactly as written: every file
path, component name, label, piece of copy and rule. Copy every block marked
VERBATIM without changes. Use the Clerk, Supabase and PostHog MCP servers and
skills only for what this step asks. Do not start any other step, do not add or
upgrade packages, and do not change files from earlier steps unless this step
says so. When you finish, run this step's checks, report each one as pass or
fail, append this step's memory block to MEMORY.md, and commit if every check
passes.
```

Step 00 has its own first prompt, in `START_HERE.md`. The rules, contract, design system and memory load automatically through `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex, Cursor and others).

## The steps

| # | File | Product lesson |
| --- | --- | --- |
| 00 | `00-project-setup.md` | Set up a project everyone can reproduce exactly |
| 01 | `01-product-docs.md` | Project vs product: define the outcome and the tracking plan before code |
| 02 | `02-design-system.md` | A small, consistent design system |
| 03 | `03-database.md` | Model only the data the product needs, and secure it with RLS |
| 04 | `04-seed-data.md` | Never launch to an empty shelf |
| 05 | `05-posthog-foundation.md` | Instrument on purpose: a typed tracking plan instead of autocapture |
| 06 | `06-auth-and-profiles.md` | Identity: link anonymous visitors to real accounts |
| 07 | `07-landing.md` | One page, one job: does the landing page convert? |
| 08 | `08-explore-search.md` | Search as the voice of the user |
| 09 | `09-skill-page.md` | The value moment: tracking installs on the server |
| 10 | `10-fork-comments.md` | Deep engagement, and the notifications that bring people back |
| 11 | `11-publish.md` | Activation, and where builders give up |
| 12 | `12-profiles-follow.md` | Not everything needs tracking |
| 13 | `13-dashboard-notifications.md` | Retention loops |
| 14 | `14-organizations.md` | B2B analytics: measure teams, not just people |
| 15 | `15-deploy-and-settings.md` | Verify your data before users arrive |
| 16 | `16-billing.md` | Would someone pay? The paywall-to-subscription funnel |
| 17 | `17-swarm.md` | Rehearse launch day with synthetic users |
| 18 | `18-feature-flag.md` | Ship reversibly: server-side flags and experiments |
| 19 | `19-the-fix.md` | Decide with evidence |

## Files you add along the way

| What | Step | Where it goes |
| --- | --- | --- |
| The swarm harness (in `build-plan/swarm/`) | 17 | Copied to `swarm/` |
| Any LLM API key (OpenAI, Anthropic, Google, DeepSeek, Moonshot, OpenRouter, or any OpenAI-compatible provider) | 17 | `swarm/.env` |

Steps 03, 05, 06 and 16 depend most on exact library and dashboard behaviour. The agent rules say to stop and report instead of improvising when something doesn't match.
