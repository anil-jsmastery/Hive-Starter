# Step 05: PostHog foundation

| | |
| --- | --- |
| What you'll learn | Instrument on purpose: a typed tracking plan instead of autocapture |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 04 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** PostHog wired in through small typed helpers that every later step uses.

## Dashboard checklist (PostHog)

1. Create a **new project** named `Hive`, used only for this app.
2. Copy the project API key and host into `.env.local` as `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`. The host depends on your project's region: `https://us.i.posthog.com` or `https://eu.i.posthog.com` (your PostHog address shows which: `us.posthog.com` or `eu.posthog.com`). The wrong region makes every server event and flag call fail.
3. **Settings → Project → Web analytics:**

   | Setting | Value | Why |
   | --- | --- | --- |
   | Enable cookieless tracking | **Off** | Hive identifies signed-in users, which needs the normal PostHog cookie |
   | Bounce rate duration | **10** (the default) | Leave it |
   | Enable web vitals autocapture | **Off** | It's a project setting that `autocapture: false` doesn't cover, and it sends a `$web_vitals` event after every page view |

4. **Point the PostHog CLI and MCP server at this project.** Step 00 logged the CLI in before this project existed, so it's linked to another one. In your own terminal, run `posthog-cli login`, choose the region (EU or US, as in item 2) and pick the new `Hive` project. Then, in Claude Code, run `/mcp` and make sure the PostHog server is on the same project (log out and in again if it isn't). The app, the CLI and the MCP server must all use this one project, or events, flags and insights end up in different places.
5. Some PostHog features are switched on from the project settings rather than from code. If live events shows any `$` event other than `$pageview`, `$pageleave` or `$exception`, find its setting in **Settings → Project** and turn it off. Session replay, heatmaps and exception autocapture are turned on deliberately in Step 15.

## Try the wizard first, then discard it

Run `npx -y @posthog/wizard@latest` and look at what it proposes: far more tracking than Hive needs. Then throw away its code changes so everyone continues from the same files:

```bash
git checkout . && git clean -fd -e build-plan     # keeps .env.local (git-ignored) and any new plan files
```

## Files, all VERBATIM

`lib/analytics/events.ts`

```ts
// The tracking plan as code. Adding an event here requires a row in TRACKING_PLAN.md.
export type Variant = 'control' | 'test';

export type EventProps = {
  landing_cta_clicked: { cta: 'hero' };
  user_signed_up: { method: 'email' };
  search_performed: { query: string; stack: string; result_count: number };
  search_result_opened: { query: string; rank: number; slug: string };
  skill_viewed: { slug: string; stack: string; author_handle: string; visibility: 'public' | 'private' };
  share_link_opened: { slug: string };
  skill_installed: { slug: string; stack: string };
  skill_starred: { slug: string };
  skill_forked: { slug: string; fork_slug: string };
  comment_posted: { slug: string; length: number };
  publish_started: { variant: Variant };
  skill_published: {
    slug: string;
    stack: string;
    tag_count: number;
    content_length: number;
    visibility: 'public' | 'private';
    owner: 'personal' | 'team';
    variant: Variant;
  };
  notification_clicked: { type: 'fork' | 'comment' | 'follow' };
  paywall_shown: { feature: 'private_skills' | 'team_private_skills' };
  pricing_viewed: { tab: 'personal' | 'team' };
  organization_created: { slug: string };
  subscription_started: { plan: string; payer: 'user' | 'organization' };
  subscription_canceled: { plan: string; payer: 'user' | 'organization' };
};

export type EventName = keyof EventProps;
```

`lib/analytics/server.ts`

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { PostHog } from 'posthog-node';
import type { EventName, EventProps } from './events';

// Swarm agents carry a hive_cohort cookie (set in instrumentation-client.ts), so
// events sent from the server get the same cohort and persona as their browser
// events. Real visitors never have it. Outside a request (no cookies), it's skipped.
async function swarmProperties(): Promise<Record<string, string>> {
  try {
    const jar = await cookies();
    const cohort = jar.get('hive_cohort')?.value;
    if (!cohort) return {};
    const persona = jar.get('hive_persona')?.value;
    return { cohort, ...(persona ? { persona } : {}) };
  } catch {
    return {};
  }
}

function client() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

// distinctId is the Clerk user id. Pass orgId when the action happens inside a team.
export async function trackServer<E extends EventName>(
  distinctId: string,
  event: E,
  properties: EventProps[E],
  orgId?: string | null,
) {
  const ph = client();
  ph.capture({
    distinctId,
    event,
    properties: { ...(await swarmProperties()), ...properties, source: 'server' },
    ...(orgId ? { groups: { organization: orgId } } : {}),
  });
  await ph.shutdown();
}

export async function setPersonProperties(userId: string, properties: Record<string, string>) {
  const ph = client();
  ph.identify({ distinctId: userId, properties });
  await ph.shutdown();
}

export async function identifyOrganization(orgId: string, properties: { name: string; slug: string }) {
  const ph = client();
  ph.groupIdentify({ groupType: 'organization', groupKey: orgId, properties });
  await ph.shutdown();
}

export async function getFlag(userId: string, key: string) {
  const ph = client();
  const value = await ph.getFeatureFlag(key, userId);
  await ph.shutdown();
  return value;
}
```

`lib/analytics/client.ts`

```ts
'use client';
import posthog from 'posthog-js';
import type { EventName, EventProps } from './events';

export function trackClient<E extends EventName>(event: E, properties: EventProps[E]) {
  posthog.capture(event, properties);
}
```

`instrumentation-client.ts` (project root)

```ts
import posthog from 'posthog-js';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  autocapture: false,
  capture_pageview: 'history_change',
  capture_pageleave: true,
  capture_exceptions: true,
  person_profiles: 'identified_only',
});

// Swarm agents arrive with ?swarm=A&persona=builder&model=... so their traffic can be
// isolated or excluded in one click. Real visitors never have these parameters.
const params = new URLSearchParams(window.location.search);
const swarm = params.get('swarm');
if (swarm) {
  posthog.register({
    cohort: `swarm-${swarm}`,
    persona: params.get('persona') ?? 'unknown',
    model: params.get('model') ?? 'unknown',
  });
  // The same tag as cookies, so server-side events carry it too (lib/analytics/server.ts).
  const year = 60 * 60 * 24 * 365;
  document.cookie = `hive_cohort=swarm-${encodeURIComponent(swarm)}; path=/; max-age=${year}; samesite=lax`;
  document.cookie = `hive_persona=${encodeURIComponent(params.get('persona') ?? 'unknown')}; path=/; max-age=${year}; samesite=lax`;
}
```

`components/analytics/track-on-mount.tsx`

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { trackClient } from '@/lib/analytics/client';
import type { EventName, EventProps } from '@/lib/analytics/events';

// Fires once per mount. Give it a `key` when the same page can show new content
// (for example a new search) so it remounts and fires again.
export function TrackOnMount<E extends EventName>({ event, properties }: { event: E; properties: EventProps[E] }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackClient(event, properties);
  }, [event, properties]);
  return null;
}
```

If the pinned `posthog-js` doesn't support an option above (for example `capture_pageview: 'history_change'` or `capture_exceptions`), stop and report it. Don't substitute another approach.

## Checks

- Visiting `/?swarm=T&persona=test` sets the `hive_cohort` and `hive_persona` cookies, and a server-side event from that browser (for example the `user_signed_up` from Step 06 later) carries `cohort: swarm-T`. A normal visit sets neither cookie.
- `npm run build` passes.
- The PostHog CLI (`posthog-cli`), the PostHog MCP server and `NEXT_PUBLIC_POSTHOG_KEY` all point at the same project: the agent reports each one's project name or ID.
- Opening `/` shows a `$pageview` in PostHog's live events, and nothing else: no `$autocapture` and no `$web_vitals`.
- Ask the PostHog MCP: "List the events received in the last hour". It returns only `$pageview` (and `$pageleave`).

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 05
- PostHog helpers: lib/analytics/events.ts (the only event list), server.ts (trackServer with optional orgId, setPersonProperties, identifyOrganization, getFlag), client.ts (trackClient).
- instrumentation-client.ts initializes posthog-js with autocapture off, registers swarm properties from the URL and saves them as hive_cohort / hive_persona cookies; trackServer adds them to server events, so every swarm event (browser and server) carries cohort.
- TrackOnMount fires a client event once per mount.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 05: posthog foundation` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `06-auth-and-profiles.md`
