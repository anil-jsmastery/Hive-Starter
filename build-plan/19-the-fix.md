# Step 19: The fix

| | |
| --- | --- |
| What you'll learn | Decide with evidence |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 18 is committed (`git status` is clean), and Clerk has room for a few new test users (the cleanup before Step 18 freed it; if a check sign-up hits the 100-user limit, ask the user to run the cleanup again). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** ship the fix that Cohort A's data points to, only in the `test` variant of `signup-return`, then run Cohort B to see whether it works.

## What Cohort A showed

Every new sign-up went from `/onboarding` to `/explore`, whatever page had asked them to sign in. Shared-link visitors were hit hardest: they arrived on a skill a friend had sent, clicked Install, signed up, and never saw that skill again. None of them installed it; some installed a different skill, the rest gave up. Builders who signed up from `/publish` lost their way to the form too, and needed extra steps to find it again.

**Hypothesis:** if people go back to the page that asked them to sign in, more shared-link visitors install the skill they were sent.

**One change only.** The test variant changes where people go after onboarding. Everything else stays identical, so a difference in the result can be traced to this change.

## Rules

- Only the `test` variant changes. The control stays exactly as built: after onboarding, `/explore`.
- No new events. The experiment reads the exposure (`$feature_flag_called` for `signup-return`) and `skill_installed`.
- Clerk's settings, onboarding's look and `RememberReturn` don't change.

## Files

| File | Change |
| --- | --- |
| `lib/return-to.ts` | Replace with the version below, **VERBATIM**. Only the last two lines change: the test variant now returns the saved page |

`lib/return-to.ts`, **VERBATIM**:

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { getFlag } from '@/lib/analytics/server';

// Where a new user goes after onboarding. Only people who had a page to return to
// (saved by RememberReturn) enter the signup-return experiment: getFlag assigns
// their variant and records the exposure. The test variant goes back to the saved
// page; the control goes to /explore, as before.
export async function pathAfterOnboarding(userId: string): Promise<string> {
  const jar = await cookies();
  const saved = jar.get('hive_return_to')?.value;
  jar.delete('hive_return_to');
  const returnTo = saved ? decodeURIComponent(saved) : '';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/explore';

  const variant = await getFlag(userId, 'signup-return');
  return variant === 'test' ? returnTo : '/explore';
}
```

## Checks (before the commit)

**How to run the sign-up checks.** The agent runs them itself, without asking the user: a temporary Playwright script (Playwright is installed for the swarm in Step 17), saved outside the project, against `npm run dev`. It signs up new test users as `agent-s19-NNN+clerk_test@example.com` with verification code `424242`, and keeps signing up from a skill page until both variants have appeared (the variant is in each user's `$feature_flag_called` event for `signup-return`). Launch the browser the way `swarm/run.mjs` does (its user agent and settings), or posthog-js may drop its browser events as a bot; the checks themselves only rely on server events. If Clerk answers "You have reached your limit of 100 users", stop and ask the user to run the cleanup. It reports each user's PostHog person link, then deletes the script.

- `git diff HEAD --stat` shows only `lib/return-to.ts`.
- `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.
- On the dev server, with new test users who sign up from a skill page (clicking Install while signed out), one in each variant:
  - **Control:** after onboarding, they land on `/explore`, exactly as before.
  - **Test:** after onboarding, they land back on that skill page (`/s/<slug>`: the page the sign-in link carried, which has no `?ref=share`), and Install now works.
- A test user in the `test` variant who signs up from `/publish` lands back on `/publish`. **Skip for now** returns them the same way as **Continue**.
- A test user who signs up from the home page lands on `/explore` in either variant (nothing specific to return to).

When every check passes, append the memory block below and commit as `step 19: the fix`. Cohort B comes after this commit, because it needs the fix deployed.

## Run the experiment (after the commit)

1. **Push and confirm the deploy** (the user, rule 11): `git push origin main`. Wait until Vercel shows the new deployment as Ready **and** its commit is `step 19: the fix`. Then, on the live site, sign up a new test user from a skill page until one lands in the `test` variant: after onboarding they must land back on that skill. If they don't, the live site is still serving the old code, and a cohort would measure nothing.
2. **Restart the experiment's clock.** In PostHog, reset the `signup-return` experiment (or move its start date to now), so exposures from testing don't count. Only Cohort B should be in the result.
3. **Release Cohort B: the visitors the fix can affect, and enough of them.** The experiment compares control and test *inside* Cohort B; Cohort A was the baseline that showed what to fix, not part of the experiment. Decide two things **before** you run, and write them down:
   - **Who's in the sample.** The fix matters most to people who arrive for one specific thing, so the sample is **shared-link visitors** (the `consumer-shared` persona): each arrives on a skill a friend shared, rotating through five skills, and succeeds only by installing that very skill.
   - **How many.** Enough for the difference you're looking for:

   | Run | Command | Shared-link visitors | Per variant |
   | --- | --- | --- | --- |
   | Rehearsal | `--agents=24 --only=consumer-shared` | 24 | about 12 |
   | Recorded video | `--agents=90 --only=consumer-shared`, **run twice** | 90 per batch, 180 in total | about 90 |

   Clerk's development instance holds at most 100 users, so the recorded run is two batches of 90 with a cleanup in between. PostHog keeps both batches' events, so the experiment counts all 180. At about 90 per variant, a difference like 50% against 80% is detected almost every time, and 50% against 65% about half the time; at 12 per variant (the rehearsal), only large differences show.

   Run each `cleanup.mjs` line yourself, in your terminal (the agent can't run it); the agent runs each batch.

   ```bash
   node swarm/cleanup.mjs --yes
   node swarm/run.mjs --cohort=B --agents=90 --only=consumer-shared --spread-minutes=2 --concurrency=30 --url=<deployed URL>
   node swarm/cleanup.mjs --yes
   node swarm/run.mjs --cohort=B --agents=90 --only=consumer-shared --spread-minutes=2 --concurrency=30 --url=<deployed URL>
   ```

   `--agents` counts the agents that run, so each batch runs exactly 90 shared-link visitors. Use the concurrency that passed Step 17's speed check (30, or 20 if it showed retries or failed sign-ups).

   Keep "inconclusive, keep testing" as a possible and honest outcome, and keep the earlier runs and the sample decision visible: they're the proof the result wasn't cherry-picked.

   Don't promote a subgroup you found *after* looking at the results: with enough slices, something always looks significant by chance. If a subgroup looks promising, make it the pre-declared sample of the next run, as above.

   **Check the instrument before trusting the result.** In the run's `agents.jsonl`, visitors who failed should have failed on the product (sent to `/explore` and unable to find the shared skill again, or deciding it wasn't useful), not on the test tool. If failed visitors have many failed actions around one control (Clerk's sign-up form, say) and successful ones have none, the harness is distorting the experiment: fix the harness, restart the experiment's clock and run Cohort B again.
4. **Read the result** in PostHog (the experiment, or through the PostHog MCP server): the goal metric, exposure to `skill_installed`, for control and for test, and whether the difference is significant. Also read the stricter number: shared-link visitors who installed **the skill they were sent**, per variant (the slug of their `share_link_opened` matches the slug of their `skill_installed`; the swarm's summary counts the same thing as success for `consumer-shared`).
5. **Decide, then record it.** Significance is one input, not the whole decision. Weigh four things:

   | Question | What to look at |
   | --- | --- |
   | Is the effect real? | The significance test, on the sample you declared before the run |
   | Do we know why? | Replays: do control visitors lose the shared skill after onboarding, and do test visitors land back on it? |
   | What does being wrong cost? | Can the change break anything, or only fail to help? |
   | Can we undo it? | A change behind a flag can be switched off instantly |

   Write the decision as a new row in `DECISIONS.md`: the date, what you'll do (for example "ship the test variant to 100% through the flag and keep watching", "keep testing" or "drop it") and the evidence behind it, including how borderline it is. An inconclusive result is a valid result: write it down as such. Earlier rows stay as history. Commit the row on its own.

6. **Act on the decision** (dashboard work, the user's job under rule 11). To ship, open the experiment in PostHog and use **Ship variant** with `test` (or end the experiment and ship it): the flag goes to 100% `test`, with no redeploy, because the flag is read on every sign-up. Then sign up a new test user from a skill page and check they land back on it. To keep testing instead, leave the flag at 50/50 and plan the next run's sample before it starts.

`DECISIONS.md` should already have the row recording why this fix was chosen (added after Cohort A, before Step 18). If it's missing, add it first, written from your own Cohort A data.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**, before the `step 19: the fix` commit:

```md
## After step 19
- signup-return test variant: after onboarding, pathAfterOnboarding() returns the saved page (hive_return_to) instead of /explore. The control still goes to /explore. No new events.
- The experiment's result is recorded in DECISIONS.md once Cohort B (shared-link visitors only, sample decided before the run) has run against the deployed fix.
```

## Finish this step

1. The agent commits the fix as `step 19: the fix` when the checks pass. Review it with `git show --stat HEAD`.
2. Deploy: `git push origin main`.
3. After Cohort B, the agent commits the result row as `decision: signup-return result`.
