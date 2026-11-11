# Step 17: The swarm harness

| | |
| --- | --- |
| What you'll learn | Rehearse launch day with synthetic users |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 16 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** the swarm harness that sends AI agents through the deployed Hive, each in its own real browser, signing up through Clerk like a person would.

**The harness is copied, not generated.** The tested harness ships with this plan in `build-plan/swarm/`. Copy it to `swarm/` in the project root, unchanged, rather than asking an agent to write it: agent behaviour has to be identical every time the swarm runs.

## Install

```bash
cp -r build-plan/swarm swarm
npm install -D playwright @clerk/testing
npx playwright install chromium
cp swarm/.env.example swarm/.env
```

Add these three lines to `.gitignore`:

```text
swarm/.env
swarm/state/
swarm/results/
```

The user fills in `swarm/.env` (rule 11): `SWARM_MODEL` and the API key for that provider. The harness also reads `.env.local` for the Clerk keys (testing tokens) and the Supabase URL and secret key. `swarm/evidence.mjs` is the one place outside the app that reads the secret key, and it only runs read-only queries to check what agents actually did.

## Files (copied from `build-plan/swarm/`; don't regenerate them)

| File | What it does |
| --- | --- |
| `swarm/run.mjs` | The runner: personas, parallel browsers (`--concurrency`), spread arrivals (`--spread-minutes`), saved sessions, the budget cap, and one results folder per run (`swarm/results/<run>-<start time>/summary.json`), so runs never overwrite each other |
| `swarm/personas.mjs` | The persona list for a cohort. Same cohort and seed, same personas |
| `swarm/observe.mjs` | Turns the page, including payment iframes, into text with element ids, and performs the agent's actions |
| `swarm/providers.mjs` | One function for every model provider: structured output, retries on rate limits and errors, real token usage |
| `swarm/evidence.mjs` | Read-only success checks in Supabase |
| `swarm/cleanup.mjs` | Deletes swarm test accounts, the teams they created and their data. Dry run unless `--yes` |
| `swarm/prices.json` | Prices per million tokens. Never guessed |
| `swarm/.env.example` | The settings to copy into `swarm/.env` |
| `swarm/README.md` | Every command and flag |

## Rules the harness follows

| Area | Rule |
| --- | --- |
| Target | `--url=` the deployed Hive URL |
| Start URL | `/?swarm={cohort}&persona={type}&model={model}&utm_source={source}&utm_medium=swarm&utm_campaign=launch-rehearsal`. 10% of consumers start at `/s/{random seed slug}?ref=share` with the same parameters |
| Clerk | Calls `clerkSetup()` once and `setupClerkTestingToken({ page })` on every page, so Clerk's bot protection lets agents through. Requires the development instance |
| Accounts | Each agent's prompt includes: "If you need an account, sign up with email agent-{cohort}-{id}+clerk_test@example.com, username {name}-{cohort}{id}, password {16 random characters}. The verification code is 424242." |
| Payments | Agents who may pay (private and team builders) are told: "card 4242 4242 4242 4242, expiry 12/34, CVC 123, ZIP 10001" (development gateway only). The payment fields live in iframes, which the harness reads too |
| Personas | consumer 40%, builder 25%, curator 15%, mobile 15% (390×844 viewport, phone user agent), lurker 5%. Consumers, mobile users and curators each have their own interest (a topic), so a model-driven audience doesn't act like copies of one person. One in ten consumers arrives on a shared skill link (rotating through five skills) and succeeds only by installing that skill. Of the builders, one in five wants a **private** skill for themselves and one in five wants a private skill **for their company's team** |
| Goals | Agents get a goal and a patience limit, never a click path |
| Arrivals | Agents start at random times across `--spread-minutes`: 0 for test batches, 90 for cohorts. Never all at once in a cohort |
| Return wave | `--return-wave=A` reloads saved state for about half of Cohort A's signed-in agents (sessions are saved only for agents that ended up signed in); the audience returns first and authors 3 to 4 minutes later, so others have reacted to their skills by then, starts on `/dashboard` with the goal "See what happened to your skills and react to anything interesting." |
| Ground truth | Success comes from evidence, never from what the agent claims: the "Install command copied" toast seen in the page, or rows in Supabase (skills, comments, stars) authored by the agent's profile |
| Browser identity | posthog-js drops headless Chrome as a bot (it checks `navigator.webdriver` and the browser brands, not just the user agent). The harness launches Chrome without the automation flag and reports a normal browser brand and user agent, so sessions are recorded. Agents stay identifiable through `cohort: swarm-<name>` on every event |
| Clipboard | Every agent's browser gets clipboard permission, because "Install" copies a command before showing its toast |
| What agents see | Each element is listed with its state: a dropdown's current value, `(checked)` / `(not checked)` for radios and checkboxes, `(pressed)` / `(not pressed)` for toggles. Styled radio cards that hide the real input (Hive's Visibility cards) are listed by their visible label, and clicking it checks the radio. Long values are shown in full up to 300 characters; longer ones say the list shows only the start, so agents don't retype what's already there. Failed actions save their error in the trace and in a `failures` list, and the harness lets each page finish loading before the next step (after clicking a link, it waits until the new page has actually arrived, since server-rendered pages can take seconds). Trace steps are timestamped. After every action the harness waits for the page to settle; a vanished element fails at once with a clear message; actions interrupted because the page changed or closed under the agent are reported separately, not as failures; passwords are never written to logs (the model sees "your full password" and a filled password field's length instead); and each agent is told plainly whether it already has an account |
| Element ids | The snapshot shows ids as `[0:12]`; the harness accepts any form a model replies with (`0:12`, `[0:12]`, `#0:12`, `12`), so one model's formatting habit can't turn into failed actions |
| Dropdowns | shadcn/Radix dropdowns: the `select` action opens a list only if it isn't open already (clicking an open trigger closes it), picks the visible option, and leaves the list closed. Before any click outside an open list, the harness presses Escape, because the list's invisible overlay would swallow the click. The snapshot tells the agent when a list is open |
| Step limits | Signing up takes about 12 steps, so limits leave room for the goal: consumers and curators 30, mobile 20, lurkers 8, builders 36, private builders 50, team builders 60, return visits 14 |

## Models (any LLM API)

Local models are too slow for a swarm, so the harness uses a paid API, and **any provider works**: use whichever key you have. On the provider's pricing page, pick the cheapest model that supports **structured outputs** or **JSON mode**, set it in `swarm/.env` as `SWARM_MODEL`, add its price to `swarm/prices.json`, and record the choice in `DECISIONS.md`. The course itself runs on **`openai:gpt-6-luna`** (GPT-6 Luna, OpenAI's cheapest current model with structured outputs, already priced in `swarm/prices.json`) at reasoning effort `low`. If agents struggle with simple goals in the 10-agent batch, move up to GPT-6 Sol.

| Provider | `SWARM_MODEL` | Key in `swarm/.env` | Watch out for |
| --- | --- | --- | --- |
| OpenAI | `openai:<model id>` | `SWARM_OPENAI_API_KEY` | New accounts start with low rate limits. Check your usage tier |
| Anthropic (Claude) | `anthropic:<model id>`, for example `anthropic:claude-haiku-5-5` | `SWARM_ANTHROPIC_API_KEY` | Tier 1 allows 50 requests a minute per model. For a 100-agent cohort, use Tier 2 or higher, or `--concurrency=5` |
| Google Gemini | `gemini:<model id>` | `SWARM_GEMINI_API_KEY` | Use the paid tier for cohorts. Free-tier daily limits are too low |
| DeepSeek | `deepseek:<model id>` | `SWARM_DEEPSEEK_API_KEY` | Turn thinking mode off. Check the price on the day you run |
| Moonshot (Kimi) | `moonshot:<model id>` | `SWARM_MOONSHOT_API_KEY` | New accounts allow 1 request at a time. Too slow for a cohort |
| OpenRouter | `openrouter:<vendor/model>` | `SWARM_OPENROUTER_API_KEY` | One key for hundreds of models. Prices are per model on OpenRouter's site |
| Any OpenAI-compatible API (Groq, Together, Mistral, xAI, Fireworks…) | `compat:<model id>` | `SWARM_API_KEY`, plus `SWARM_BASE_URL` | The base URL is in the provider's docs: the part before `/chat/completions` |

**Why it won't crash:**

- **Every reply parses.** Each provider is asked for structured output: a fixed JSON schema for OpenAI-compatible APIs and Gemini, and a single forced tool call for Claude. If a model doesn't support it, the harness falls back (to JSON mode, then to reading the JSON from plain text), once per run.
- **Rejected settings fall back.** If a model rejects `reasoning_effort` or a structured format, the harness drops that setting once and carries on.
- **Busy APIs are retried.** Rate limits (429), server errors, timeouts and network failures are retried with backoff, respecting `retry-after`.
- **Failures are contained.** One agent crashing never stops the others. The summary counts crashes, unclear replies, failed actions and API retries.
- **Spending is capped.** `--max-usd` (default 10) stops new agents once the cap is reached.

**Check the model before a cohort:** run the 10-agent batch first. `crashed` should be 0 and unclear replies close to 0. If many agents give up early on simple goals, such as installing a skill, move up one model tier and run the batch again.

**One provider per run.** Only the provider in `SWARM_MODEL` is used; other keys in `swarm/.env` are ignored. Switch for a single run with `--model=provider:model`. Never mix models inside one experiment: a different model behaves differently.

Keys live only in `swarm/.env`, with the `SWARM_` prefix. Never export them in the terminal where your coding agent runs: if `ANTHROPIC_API_KEY` is set there, Claude Code bills that key instead of your Claude plan.

Match `--concurrency` to your rate limit: 10 for a new account, 20–40 once your tier allows it.

Results differ between models. That's expected: the code must match, the data doesn't have to.

## Honesty rules

- The first minute says the users are AI agents.
- Agents get goals, never click paths. Never tune a persona to fail at a specific step.
- Persona prompts are public in the repo.

## Clerk's user limit

Clerk development instances hold at most **100 users**, counting every agent that signs up and your own test accounts. The swarm needs the development instance (its `+clerk_test` emails and code `424242`), so:

- **The user** runs `node swarm/cleanup.mjs` (to see the list), then `node swarm/cleanup.mjs --yes`, in their own terminal, before every cohort and after every test run. Claude Code's permission system blocks scripts that delete accounts, so the agent never runs it: when a run needs a clean slate, it stops and asks. Keep your own test accounts to five or fewer.
- Cohort A is **100 agents**: lurkers (5%) never sign up, so about 95 accounts are created.
- Run the return wave **before** any cleanup: it signs back in as Cohort A's agents. After the return wave and the decision, clean up before Step 18: Steps 18 and 19 sign up new test users, and Cohort A's accounts would leave no room. Their data stays in PostHog.

**Running faster:** for the recorded run, use `--concurrency=30`. Before the real cohort, run a **speed check**: 30 test agents at once (`node swarm/run.mjs --cohort=T --agents=30 --concurrency=30 --url=<deployed URL>`, about 5 minutes, about $0.12), then `node swarm/cleanup.mjs --yes`. A 10-agent batch can't show what 30 at once does. If its Reliability line shows climbing API retries (the model provider is rate-limiting) or failed sign-ups (Clerk is throttling), use `--concurrency=20` instead. Then Cohort A: `--agents=100 --spread-minutes=8 --concurrency=30`, about 11 minutes, about $0.30. Agents arrive like a real launch: builders first, the audience after (see the harness README's "Arrival order"), so new skills get found. Cost doesn't depend on speed.

## Checks

- `swarm/` matches `build-plan/swarm/` exactly (`diff -r build-plan/swarm swarm` shows only the new `.env`, `state/` and `results/`).
- `git check-ignore swarm/.env swarm/state swarm/results` lists all three.
- A free dry run works: `node swarm/run.mjs --url=<deployed URL> --cohort=T --agents=3 --model=mock:random` finishes with 0 crashed. (Every test run uses cohort `T`, so nothing it sends is tagged `swarm-A`; runs without `--cohort` default to `T` too.)
- The 10-agent batch with the real model (`node swarm/run.mjs --url=<deployed URL> --cohort=T --agents=10`). Test batches always use cohort `T`, so they never mix with Cohort A's data:
  - 0 crashed, and unclear replies close to 0.
  - Clerk shows new users with `+clerk_test` emails.
  - PostHog shows browser events (`$pageview`, `skill_viewed`, `search_performed`) with `cohort: swarm-T`, not only server events, and a session recording per agent. Server events alone mean agents were filtered as bots.
  - At least some consumers and builders succeed. 0% across every persona means a harness problem, not product friction.
  - The run's `summary.json` (in `swarm/results/cohort-T-<start time>/`) shows the cost per agent and the success rate per persona.
- `node swarm/cleanup.mjs` lists the swarm's test users and teams, and `node swarm/cleanup.mjs --yes` deletes them. Run it before every new batch or cohort.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 17
- swarm/ harness copied unchanged from build-plan/swarm/: Playwright agents with personas, Clerk testing tokens and +clerk_test accounts, test card for payments (iframes included), spread arrivals, saved sessions for the return wave, evidence-based success, structured output and retries. Browsers present as normal Chrome (so posthog-js doesn't drop them as bots) and have clipboard permission.
- node swarm/cleanup.mjs --yes removes swarm test users, their teams and their data before each run.
- Model: SWARM_MODEL in swarm/.env, any provider (openai, anthropic, gemini, deepseek, moonshot, openrouter, or compat for any OpenAI-compatible API); keys as SWARM_* in swarm/.env (git-ignored, never in the coding agent's shell). The chosen model is recorded in DECISIONS.md.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 17: swarm` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `18-feature-flag.md`
