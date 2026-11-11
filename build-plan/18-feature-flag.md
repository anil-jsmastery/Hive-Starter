# Step 18: Feature flag and experiment

| | |
| --- | --- |
| What you'll learn | Ship reversibly: server-side flags and experiments |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 17 is committed (`git status` is clean), `DECISIONS.md` has the row recording the decision this experiment tests (added after reading Cohort A's data), and the user has run the swarm cleanup (`node swarm/cleanup.mjs --yes`) since the return wave: Cohort A's accounts fill most of Clerk's 100-user development limit, and this step's checks sign up new test users. Cohort A's data stays in PostHog. If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** after sign-up, Hive can send people to one of two places, assigned on the server: `/explore` (control) or back to the page that asked them to sign in (test). In this step both variants still go to `/explore`; Step 19 switches the test variant on.

## What Cohort A showed

Clerk sends every new sign-up to `/onboarding` (`NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL`), and onboarding always continued to `/explore`. The page that asked them to sign in was lost: a skill page, `/publish`, a comment form. Shared-link visitors were hit hardest: none of them installed the skill a friend had sent, because nothing brought them back to it.

**The question:** sending newcomers to `/explore` shows them more of Hive. Sending them back gives them what they came for. Which leads more of them to install the skill they came for?

## Do it with the PostHog MCP

1. **Create the experiment, which creates its flag.** Use the PostHog MCP's experiment tool (`experiment-create`) in one call; don't create the flag separately. Settings:

   | Setting | Value |
   | --- | --- |
   | Name | `Sign-up return` |
   | Flag key | `signup-return` |
   | Variants | `control` 50%, `test` 50% |
   | Release condition | 100% of users, no property filters |
   | Goal metric | A funnel from exposure to `skill_installed` (did a new user who had a page to return to install a skill?), where an increase is good |

   If the experiment tool doesn't accept the metric when creating the experiment, add it straight after with the experiment update tool.

2. **Include the swarm in the results.** New experiments filter out test accounts, and Step 15's filter removes everything tagged `cohort: swarm-…`. Here the swarm *is* the traffic, so turn **Filter test accounts off** for this experiment. Do it on purpose and say so: in a real launch you'd keep test traffic out.

3. **Launch it.** A draft experiment keeps its flag inactive, so `getFlag` returns nothing and everyone falls back to `control`. Launch the experiment (through the MCP or in the PostHog app) before the checks. There are no real users yet, so launching affects only test accounts and the swarm.

4. **Confirm both exist in the PostHog app:** the flag is active, and the experiment is running with the funnel metric.

## Code

| File | Change |
| --- | --- |
| `components/auth/remember-return.tsx` | New, VERBATIM below |
| `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx` | Render `<RememberReturn />` beside Clerk's form |
| `lib/return-to.ts` | New, VERBATIM below |
| `app/onboarding/actions.ts` | `saveStack` ends with `redirect(await pathAfterOnboarding(userId))` instead of `redirect('/explore')`. New `skipOnboarding()`: if signed out, `redirect('/sign-in')`; otherwise `redirect(await pathAfterOnboarding(userId))` |
| `components/onboarding/stack-picker.tsx` | "Skip for now" becomes `<form action={skipOnboarding}><button type="submit" className="link-btn">Skip for now</button></form>`, so skipping goes through the same path. Same label and look |

Clerk's settings don't change: `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/onboarding` stays, so every new user still sees onboarding (and Hive still learns their stack). Only what happens after onboarding changes.

`components/auth/remember-return.tsx`, **VERBATIM**:

```tsx
'use client';
import { useEffect } from 'react';

// Remembers the page that sent someone to sign in (Clerk's redirect_url), so
// onboarding can send them back there after sign-up (the signup-return experiment,
// Steps 18 and 19). Sign-up's forced redirect to /onboarding would otherwise lose it.
export function RememberReturn() {
  useEffect(() => {
    // Clerk's links use ?redirect_url=…, but its header button opens
    // /sign-in#/?redirect_url=… (the parameters after the #), so read both.
    const hash = window.location.hash;
    const fromHash = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
    const raw =
      new URLSearchParams(window.location.search).get('redirect_url') ??
      new URLSearchParams(fromHash).get('redirect_url');
    if (!raw) return;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return;
      // Only a specific page is worth returning to: not the home page, the auth pages or onboarding.
      if (url.pathname === '/' || /^\/(sign-in|sign-up|onboarding)\b/.test(url.pathname)) return;
      const path = url.pathname + url.search;
      document.cookie = `hive_return_to=${encodeURIComponent(path)}; path=/; max-age=3600; samesite=lax`;
    } catch {
      // Not a valid address: nothing to remember.
    }
  }, []);
  return null;
}
```

`lib/return-to.ts`, **VERBATIM**:

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { getFlag } from '@/lib/analytics/server';

// Where a new user goes after onboarding. Only people who had a page to return to
// (saved by RememberReturn) enter the signup-return experiment: getFlag assigns
// their variant and records the exposure. Step 18: everyone still goes to /explore.
// Step 19 sends the test variant back to the saved page.
export async function pathAfterOnboarding(userId: string): Promise<string> {
  const jar = await cookies();
  const saved = jar.get('hive_return_to')?.value;
  jar.delete('hive_return_to');
  const returnTo = saved ? decodeURIComponent(saved) : '';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/explore';

  await getFlag(userId, 'signup-return');
  return '/explore';
}
```

Every entry point already sends people to `/sign-in?redirect_url=…` (Install, Star and Fork on a skill page, the comment form, `/publish`, the header's Sign in button), so `RememberReturn` on the two auth pages catches them all. Only a specific same-site page is remembered: never the home page, the auth pages or onboarding, so only people the change can affect enter the experiment. The cookie lasts an hour.

## Checks

**How to run the sign-up checks.** The agent runs them itself, without asking the user: a temporary Playwright script (Playwright is installed for the swarm in Step 17), saved outside the project, against `npm run dev`. It signs up new test users as `agent-s18-NNN+clerk_test@example.com` with verification code `424242`, and keeps signing up from a skill page until both variants have appeared (the variant is in each user's `$feature_flag_called` event for `signup-return`). Launch the browser the way `swarm/run.mjs` does (its user agent and settings), or posthog-js may drop its browser events as a bot; the checks themselves only rely on server events. If Clerk answers "You have reached your limit of 100 users", stop and ask the user to run the cleanup. It reports each user's PostHog person link, then deletes the script.

- The experiment "Sign-up return" is **running** (not draft), its flag `signup-return` is active, and **Filter test accounts** is off for this experiment.
- Signed out, open a skill page and click Install: `/sign-in?redirect_url=/s/<slug>` sets the `hive_return_to` cookie to `/s/<slug>`. Sign up a new test user from there: after onboarding (with **Continue** or with **Skip for now**) you land on `/explore`, the cookie is gone, and the experiment shows an exposure for that user (`$feature_flag_called` for `signup-return`).
- Signed out on a skill page, the header's **Sign in** button (Clerk puts its parameters after a `#`: `/sign-in#/?redirect_url=…`) also sets `hive_return_to` to that skill's path.
- A new test user with nothing specific to return to gets no exposure and lands on `/explore`: one who signs up from the header's Sign in button on `/` (the home page isn't remembered), and one who opens `/sign-up` directly.
- Two test users who signed up from a skill page land in different variants (with 50/50 it can take a few users to get one of each). Both still end on `/explore` in this step.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 18
- Experiment "Sign-up return" (created with its flag signup-return in one PostHog MCP call): control/test 50/50, goal = funnel from exposure to skill_installed, test-account filter off so the swarm counts, launched.
- RememberReturn (on /sign-in and /sign-up) saves Clerk's redirect_url in the hive_return_to cookie. lib/return-to.ts pathAfterOnboarding() is used by saveStack and skipOnboarding: only users with a saved page call getFlag (exposure); in Step 18 every variant still goes to /explore.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 18: feature flag` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `19-the-fix.md`
