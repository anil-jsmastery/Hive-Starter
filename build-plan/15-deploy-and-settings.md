# Step 15: Deploy and dashboard settings

| | |
| --- | --- |
| What you'll learn | Verify your data before users arrive |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 14 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** Hive live on Vercel, PostHog configured for replays and testing traffic, and every tracked event checked by hand before any agents arrive.

## Dashboard checklist

**GitHub**
1. Push the repo: `git remote add origin <your repo URL>`, then `git push -u origin main`. A private repo is fine.

**Vercel**
1. Import the repo and add every variable from `CONTRACT.md` except `SUPABASE_PROJECT_REF`. Leave `CLERK_WEBHOOK_SIGNING_SECRET` empty until Step 16.
2. Deploy, and note the production URL.

**Clerk**
1. Keep the **development instance**. It works on the Vercel URL (you'll see Clerk's "development mode" badge), and the swarm needs its test emails and test payment gateway. Moving to a production instance is out of scope for this build.

**PostHog**
1. **Turn off autocapture.** Go to **Settings → Project → Autocapture** and switch **Enable autocapture for web** off (Hive's code already sets `autocapture: false`; this makes it a project rule too). Leave web vitals autocapture off. Then in **Settings → Products → Heatmaps**, make sure heatmaps are on.
2. **Check session replay is on.** Go to **Settings → Products → Session replay** and make sure recording is on, so every session is recorded.
3. **Turn on exception autocapture.** Go to **Settings → Products → Error tracking** and switch **Exception autocapture** on.
4. **Add the swarm filter** (after the deploy, because it needs the live site for the setup visit below). Go to **Settings → Project → Customization** and find **Filter out internal and test users** (or type "internal" in the settings search box, or open `/settings/project#internal-user-filtering`). It's the section that already lists the "Internal / Test users" filter. Click **Add filter**.
   - Choose **Event properties**, then type `cohort` and pick it. **If it's not listed** ("No results"), PostHog hasn't seen it yet, because no swarm traffic has arrived. Teach it with one visit: open a **private window**, visit `/?swarm=setup` on the live site (that registers `cohort: swarm-setup` and sends one page view), close the window, wait a minute or two and refresh this page. Private matters: the tag sticks to that browser. The test visit is hidden by this filter too.
   - Set the operator to **doesn't match regex** and the value to `^swarm`. PostHog has no "starts with" operator, and this filter keeps the events that pass it, so "doesn't match `^swarm`" removes every event whose `cohort` starts with `swarm`. Events without a `cohort` (human traffic) still pass.
   - Leave the existing "Internal / Test users" cohort filter as it is.
   - Leave **Enable this filter on all new insights** unchecked. It stays off by default, and Step 17 turns it on per insight.
   - Save.

## Verify the data

1. Run `npm run db:seed` once against the project (same Supabase project as local).
2. On the deployed site, click through every row of `TRACKING_PLAN.md` that exists so far (everything except `paywall_shown`, `pricing_viewed`, `organization_created` and the subscription events).
3. Ask the PostHog MCP: "List all custom events received in the last hour with one example of their properties." Compare the list with `TRACKING_PLAN.md`: names and property names must match exactly, and nothing extra may appear.
4. Open one session recording and confirm it shows your clicks.

## Checks

- Every tracking-plan row built so far has at least one event in PostHog with the right properties.
- `identify` merged your anonymous visit, and team events show the organization group.
- At least one session recording exists.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 15
- Deployed on Vercel with the Clerk development instance. PostHog: replays, heatmaps and exception autocapture on, autocapture off, a test-account filter for cohort starting with swarm.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 15: deploy and settings` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `16-billing.md`
