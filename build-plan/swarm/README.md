# Hive swarm

AI agents that use the deployed Hive app in real browsers, so PostHog records real sessions, events and replays. Each agent gets a persona, a goal and a patience limit, never a click path. Success is checked against evidence (Supabase rows, or what the browser showed), never against what the agent claims.

## Setup

```bash
npm install -D playwright @clerk/testing
npx playwright install chromium
cp swarm/.env.example swarm/.env      # then fill in SWARM_MODEL and your API key
```

- **Choose the model:** the course uses `openai:gpt-6-luna` (GPT-6 Luna, OpenAI's cheapest structured-output model, already in `prices.json`) at reasoning effort `low`. You can use any LLM API you have a key for. On its pricing page, pick the cheapest model that supports **structured outputs** or **JSON mode**, set `SWARM_MODEL` in `swarm/.env`, and add its price to `swarm/prices.json` so costs are reported.

| Provider | `SWARM_MODEL` | Key in `swarm/.env` |
| --- | --- | --- |
| OpenAI | `openai:<model id>` | `SWARM_OPENAI_API_KEY` |
| Anthropic (Claude) | `anthropic:<model id>` | `SWARM_ANTHROPIC_API_KEY` |
| Google Gemini | `gemini:<model id>` | `SWARM_GEMINI_API_KEY` |
| DeepSeek | `deepseek:<model id>` | `SWARM_DEEPSEEK_API_KEY` |
| Moonshot (Kimi) | `moonshot:<model id>` | `SWARM_MOONSHOT_API_KEY` |
| OpenRouter (hundreds of models, one key) | `openrouter:<vendor/model>` | `SWARM_OPENROUTER_API_KEY` |
| Any OpenAI-compatible API (Groq, Together, Mistral, xAI, Fireworks…) | `compat:<model id>` | `SWARM_API_KEY`, plus `SWARM_BASE_URL` (the base URL from the provider's docs) |

  The harness asks every OpenAI-compatible provider for a strict JSON schema first. If a model rejects that, it falls back to JSON mode, then to reading the JSON from plain text, once per run. Claude replies through one forced tool call (`act`) whose input is the action format, so its replies always parse too. Gemini uses its own response schema.

- **One provider per run.** You can keep several keys in `swarm/.env`; only the provider in `SWARM_MODEL` is used, and the other keys are ignored. To try another model for a single run, add `--model=provider:model` (for example `--model=anthropic:claude-haiku-5-5`). Each run's `summary.json` records its model, and each run has its own results folder, so comparing models means comparing two folders. Never mix models inside one experiment.
- **Keys stay in `swarm/.env`**, with a `SWARM_` prefix. Never export them in the terminal where your coding agent runs.
- **The harness also reads `.env.local`** (project root) for the Clerk keys (testing tokens let agents past Clerk's bot protection) and the Supabase URL and secret key (read-only success checks).

## Run

```bash
# 10-agent test batch: always do this first with a new model.
# Test batches use cohort T, so they never mix with Cohort A's data.
node swarm/run.mjs --url=https://your-app.vercel.app --cohort=T --agents=10

# Cohort A: 100 agents arriving over 30 minutes (fits Clerk's 100-user development limit)
node swarm/run.mjs --url=https://your-app.vercel.app --cohort=A --agents=100 --spread-minutes=8 --concurrency=30

# Return wave: about half of Cohort A comes back, using their saved sessions
node swarm/run.mjs --url=https://your-app.vercel.app --return-wave=A --cohort-size=100

# Cohort B (after the fix ships behind the flag)
node swarm/run.mjs --url=https://your-app.vercel.app --cohort=B --agents=90 --only=consumer-shared --spread-minutes=2 --concurrency=30
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--url` | required | The deployed Hive URL |
| `--cohort` | T | Cohort name, sent to PostHog as `cohort: swarm-<name>` |
| `--agents` | 10 | Number of agents |
| `--concurrency` | 10 | Browsers at once. Lower it if you hit rate limits or your laptop slows down |
| `--spread-minutes` | 0 | Spread arrivals over this many minutes |
| `--max-usd` | 10 | Stop starting agents once this much has been spent |
| `--model` | `SWARM_MODEL` | Override the model for one run, as `provider:model` |
| `--return-wave` | off | Re-run about half of a cohort from saved sessions, starting at `/dashboard` |
| `--cohort-size` | 100 | With `--return-wave`: how many agents the original cohort had |
| `--only` | all | Run only some personas, by type or variant, for example `--only=builder` or `--only=builder-private,builder-team`. `--agents` still counts the agents that run: `--agents=90 --only=builder` runs 90 builders |
| `--exclude` | none | Leave out personas by variant or type, for example `--exclude=builder-private,builder-team` for plain builders only |
| `--seed` | 42 | Same seed, same personas |
| `--headed` | off | Show the browsers (for debugging) |

Free dry run without any API key: `--cohort=T --model=mock:random`. Runs without `--cohort` default to the test cohort `T`, so they never mix into Cohort A or B.

## Clean up between runs

Each run creates real Clerk accounts (and, for team builders, teams). Remove them before the next run:

```bash
node swarm/cleanup.mjs          # shows what would be deleted
node swarm/cleanup.mjs --yes    # deletes it
```

It only touches accounts with `agent-<cohort>-<id>+clerk_test@example.com` emails and the teams they created. Their Supabase profiles are deleted too, which removes their skills, stars, comments and notifications, and saved sessions in `swarm/state/` are cleared. PostHog keeps earlier events: filter them out by `cohort`, or use a fresh project.

## How agents stay visible to PostHog

Headless Chrome announces itself (`navigator.webdriver` and a "HeadlessChrome" browser brand), and posthog-js drops those visitors as bots before any event is sent. The harness launches Chrome without the automation flag and reports a normal browser brand, so the sessions are recorded. The agents aren't hidden: every event carries `cohort: swarm-<name>`, and the test-account filter removes them in one click. Each browser also gets clipboard permission, because "Install" copies a command.

## How agents handle dropdowns

shadcn/Radix dropdowns behave differently from a plain `<select>`, and two of their habits used to trip agents up (and distort results):

- **Clicking the trigger of an open dropdown closes it.** The harness's `select` action now opens a dropdown only if it isn't open already, picks the option, and makes sure the list is closed afterwards.
- **While a dropdown is open, an invisible layer covers the page,** so the next click only closes the dropdown. Before any click outside an open list, the harness presses Escape first, which is what a person does without thinking. The page snapshot also tells the agent when a list is open.

If builders rack up failed actions around a dropdown, suspect the harness before the product: a person wouldn't get stuck there.

## Running faster

Speed comes from how many agents run at once (`--concurrency`, default 10) and how close together they arrive (`--spread-minutes`). Cost doesn't change: you pay per model call, not per minute. `--concurrency=30` cuts the time to about a third. Before a real cohort, run a speed check at that concurrency with at least as many agents (`--cohort=T --agents=30 --concurrency=30`), then clean up, and watch each run's Reliability line: if API retries climb (the model provider is rate-limiting) or many sign-ups fail (Clerk's development instance is throttling), use 20. Each agent is a real Chrome page, so 30 at once wants 16 GB of RAM or more. The harness retries automatically, so results stay accurate; only the time grows. The short pauses between an agent's actions stay on purpose: they keep session replays watchable and the timing human.

## Arrival order

Agents arrive in the order a real launch happens. In a cohort, creators (builders) arrive in the first third of the `--spread-minutes` window, and the audience (consumers, curators, mobile users, lurkers) from a quarter of the way in to the end, so the audience can find skills that new creators have just published. In a return wave, the audience comes back first (over the first minute) and authors 3 to 4 minutes later, after others have had time to comment on or fork their skills. Nobody is told what to do: agents still choose freely what to look at and react to. With an 8-minute window, about 70 of Cohort A's 75 audience agents arrive after the first skills are published.

## What the model is told

- **Personas are described in plain words** ("a developer looking for skills to use"), never by their internal label: a model reads "consumer" as "not a developer".
- **Shared-link visitors have the need that matches their skill** ("You're working on speeding up some slow SQL queries. A friend who knows that shared this skill with you."). Real people get a shared link because a friend knows they need it; without a need, an agent can leave after one look.
- **Element numbers are fresh in every snapshot.** Each snapshot erases the previous numbers before giving out new ones, so an element that's no longer listed (a header button under a dialog, say) can't share a number with one that is.
- **Covered elements aren't offered.** An element whose centre is on screen but covered by something else (Clerk's checkout drawer, a modal) isn't listed until it's uncovered, so agents don't click a button hidden under a drawer. Off-screen elements are still listed, because clicking scrolls them into view. If a click still fails, the trace keeps Playwright's line saying what covered the element.

## Why every persona has an interest

All agents run on the same model, so agents with identical goals behave like copies of one person: given the same page, they all pick the same "obvious" option (in one test, 29 of 30 curator comments went to the most-starred skill). Consumers, mobile users and curators each get a topic of their own, so their choices spread out the way a real audience's do. The topic only sets what they care about: what they actually do is still up to them.

## Clerk's user limit

Clerk development instances hold at most **100 users**, and every agent that signs up is one of them, as are your own test accounts. Before a cohort, run `node swarm/cleanup.mjs --yes` (it removes only `agent-*+clerk_test` accounts), and keep your own test accounts to five or fewer. Then:

- **100 agents** fit: lurkers (5%) never sign up, so about 95 accounts are created.
- **Single-persona batches**, like Cohort B's `--agents=90 --only=consumer-shared`, create 90 accounts each. For a bigger experiment, run several batches with a cleanup in between: PostHog keeps every batch's events, so the experiment adds them up.

## What agents see

Each step, the harness turns the page into a list of buttons, links and fields, with their state, so the agent can see whether a choice took:

- **Dropdowns** show their current value: `select "Publish as" = "Tom’s Studio" options: …`.
- **Radios and checkboxes** show `(checked)` or `(not checked)`. When a design hides the real input and shows a styled `<label>` card instead (like Hive's Visibility cards), the card is listed in its place, and clicking it checks the radio, just as a person would.
- **Toggle buttons** (like Star) show `(pressed)` or `(not pressed)`.
- **Long field values** are shown in full up to 300 characters. Longer ones end with "…" and say the list shows only the start while the field holds every character, so agents don't retype text that's already there.
- **A failed action** saves its error in the agent's trace (`failed: …`) and in the agent's `failures` list (step, action, target, error) in `agents.jsonl`, so every failure can be diagnosed.
- After every action the harness waits for the page to finish loading. After clicking a link to another page, it waits until the browser has actually arrived there (up to 15 seconds), because a server-rendered page can take seconds while the old page stays on screen. So the next list never points at elements that are about to disappear.
- **Every trace step has a timestamp** (`at`, seconds since the agent started), so timing questions can be answered exactly.
- **After every action, the harness waits for the page to settle:** no updates for 0.4 seconds, at most 6 seconds. That covers in-page updates (a search or filter re-rendering a list) as well as new pages.
- **A vanished element fails at once,** with "element 0:44 is no longer on the page (the page changed)", instead of a long timeout. The agent sees the new page on its next step.
- **Interrupted actions aren't counted as failures.** When the page changes under the agent (an element vanishes after a click already worked), Clerk's checkout replaces its card form, or the agent's own browser closes as it finishes, the action is logged with `kind: interrupted` and reported separately in the Reliability line.
- **Passwords are never logged:** typing into a password field, or typing the agent's own password, is saved as `••••` in the trace. The model itself (which already knows the password from its instructions) sees "(your full password)" in its history, and a filled password field shows as "(filled: 16 characters, hidden)", so it can tell the field holds the whole password.
- **Only signed-in agents return.** A session is saved for the return wave only if the agent ended up signed in (Clerk's `__client_uat` cookie isn't "0"), so visitors who never made an account, like lurkers, don't come back to a dashboard they don't have.
- **Each agent is told plainly whether it has an account:** new agents "don't have a Hive account yet" and sign up; return-wave agents already have one and sign in.

If an agent repeats the same action many times, check this list in its trace first: it usually means the agent couldn't see that its action worked.

## Element ids

The page snapshot lists each element as `[0:12]`. Models answer with the id in different forms (`0:12`, `[0:12]`, `#0:12`, or just `12` for the main page), and the harness accepts all of them. If a new model shows many failed actions with 0 crashes, open a few traces in its `agents.jsonl` and check what it put in `target` before blaming the model.

## Retesting one part of the product

To check a fix cheaply, run only the personas it affects. `--agents` counts the agents that run, so `--agents=10 --only=builder` runs 10 builders (6 public, 2 private, 2 team) for about $0.05:

```bash
node swarm/run.mjs --url=https://your-app.vercel.app --cohort=T --agents=10 --only=builder
```

## Is the model good enough?

After the 10-agent batch, read the **Reliability** line and the run's `summary.json` (the last line of the output gives its path):

- `crashed` should be 0, and `parseErrors` close to 0.
- If many agents give up early or fail at simple goals (installing a skill), move up one model tier and run the batch again.
- Read a few `thought` lines in the run's `agents.jsonl`: they should sound like a person trying to get something done.
- Signing up takes about 12 steps, so step limits (30 for consumers, 36 to 60 for builders) leave room for the goal itself. If agents still run out of steps right before succeeding, that's friction worth looking at in the product, not a reason to raise the limits further.

## Personas

| Persona | Share | Goal | Success means |
| --- | --- | --- | --- |
| consumer | 40% | Find a skill for a topic and install it | The "Install command copied" toast appeared |
| consumer-shared | 1 in 10 consumers | Arrive on a skill a friend shared (rotating through five skills), decide whether it's useful, and install it if it is | The toast appeared on **that** skill's page: installing a different skill doesn't count |
| builder | 25% | Publish their own skill (1 in 5 want it private, 1 in 5 want a private team skill) | A matching row in `skills` |
| curator | 15% | Star a skill and leave a helpful comment, guided by their own interest (a topic, like consumers) | A row in `comments` |
| mobile | 15% | Same as consumer, on a phone, impatient | The toast appeared |
| lurker | 5% | Read about one skill and leave | Opened a skill page |

Agents sign up with `agent-<cohort>-<id>+clerk_test@example.com` and code `424242`, which only works in a Clerk development instance. Agents who decide to pay use the test card `4242 4242 4242 4242`.

## Files

| File | What it does |
| --- | --- |
| `run.mjs` | The runner: personas, parallel browsers, spread arrivals, saved sessions, summary |
| `personas.mjs` | The persona list for a cohort |
| `observe.mjs` | Turns the page (and payment iframes) into text and performs the agent's actions |
| `providers.mjs` | One function for every model provider, with structured output and retries |
| `evidence.mjs` | Read-only success checks in Supabase |
| `cleanup.mjs` | Deletes swarm test accounts, their teams and their data |
| `prices.json` | Prices per million tokens. Never guessed |
| `state/`, `results/` | Saved sessions, and one results folder per run (`results/<run>-<start time>/` with `summary.json` and `agents.jsonl`), so runs never overwrite each other. `summary.json` records the run's settings (agents, spread, concurrency, seed), so the next cohort can match them. Both git-ignored |
