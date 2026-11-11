# Hive contract

Read before every step. Step files add detail; they never override this file.

## Product

Hive is a public registry for agent skills, the Markdown playbooks AI agents run on. People publish, browse, search, install (copy a command), star, fork, comment on and share skills, follow each other, and work in teams. Private skills are the paid feature.

## Stack (locked)

Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, Clerk (auth, organizations, billing), Supabase (Postgres, Row Level Security), PostHog (analytics, replay, flags, experiments, error tracking), Vercel. npm with `save-exact`. No other libraries unless a step adds them.

## Routes (no others)

| Route | Page | Access |
| --- | --- | --- |
| `/` | Landing | Everyone |
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | Clerk sign-in and sign-up | Signed out |
| `/onboarding` | Pick your stack | Signed in |
| `/explore` | Browse and search | Everyone |
| `/s/[slug]` | Skill page | Everyone (private skills: owner or active team only) |
| `/publish` | Publish a skill | Signed in |
| `/u/[handle]` | User profile | Everyone |
| `/o/[slug]` | Team page | Everyone |
| `/dashboard` | Notifications, your skills, your forks, team skills | Signed in |
| `/pricing` | Plans for people and teams | Everyone |
| `/api/webhooks/clerk` | Clerk webhooks | Clerk only (signature verified) |

## Identity and data rules

- Clerk is the source of truth for users and organizations. A Clerk user's `id` is `profiles.id`. Their Clerk **username** is their Hive handle.
- A `profiles` row is created on the first signed-in request (`ensureProfile`). A team's `organizations` row is created the first time it's used (`ensureOrganization`) and by the `organization.created` webhook.
- All reads and writes from the app use the Supabase client authenticated with the Clerk session token, so RLS always applies. The secret key is used only by the seed script and the webhook route.
- Side effects (activities, notifications, star counts) happen in database triggers, never in app code.
- A team's private skills are visible only while that team is the **active organization** in the user's session.

## Plans and features (Clerk Billing)

| Payer | Plan key | Price | Feature key | Unlocks |
| --- | --- | --- | --- | --- |
| User | `free_user` (default) | $0 | none | Public skills |
| User | `pro` | $8/month | `private_skills` | Private personal skills |
| Organization | `free_org` (default) | $0 | none | Public team skills |
| Organization | `team` | $20/month | `team_private_skills` | Private team skills |

Plan checks happen on the server with Clerk's `has({ feature })`, with one exception: while a team is active, Clerk's session token carries only that team's features, so a personal Pro plan is invisible to `has()`. For a personal private skill published while a team is active, `publishSkill` asks Clerk for the user's own subscription (`clerkClient().billing.getUserBillingSubscription`) and allows it if the `pro` plan is active. RLS controls who can see a row; billing controls who can create a private one.

## Stacks

Exactly `Next.js`, `React`, `Node.js`, `Python`, `Go`, `Any`.

## Events (PostHog)

| Event | Fired from | Groups |
| --- | --- | --- |
| landing_cta_clicked | client | |
| user_signed_up | server, when the profile row is created | |
| search_performed | client | |
| search_result_opened | client | |
| skill_viewed | client | |
| share_link_opened | client | |
| skill_installed | server | organization, if active |
| skill_starred | server | organization, if active |
| skill_forked | server | organization, if active |
| comment_posted | server | organization, if active |
| publish_started | client | organization, if active (automatic) |
| skill_published | server | organization, if published as a team |
| notification_clicked | server | |
| paywall_shown | client | organization, if active (automatic) |
| pricing_viewed | client | organization, if active (automatic) |
| organization_created | server (webhook) | organization |
| subscription_started, subscription_canceled | server (webhook) | organization, for team plans |

Also: `identify` (client, Clerk user id), `group('organization', …)` (client, active org), person properties set from the server. Autocapture is off. Never send emails or passwords.

## Environment variables

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/explore
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/onboarding
CLERK_WEBHOOK_SIGNING_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_PROJECT_REF=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com for an EU project
```

## Out of scope

Editing or deleting skills, image uploads, a light theme or theme toggle, threaded comments, pagination, a real `npx hive` CLI, social sign-in, seat-based pricing.
