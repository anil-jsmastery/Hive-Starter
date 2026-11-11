# Step 06: Auth, profiles and onboarding (Clerk + Supabase)

| | |
| --- | --- |
| What you'll learn | Identity: link anonymous visitors to real accounts |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 05 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** Clerk sign-up and sign-in, Clerk's session token accepted by Supabase, a profile row per user, the stack picker, and identity linked in PostHog.

**Identity lesson (optional):** first build this step with `AnalyticsIdentity` left out of the layout, sign up once, and look in PostHog at how the anonymous visit and the signed-in user look like two different people. Then add it, and watch them merge.

## Clerk setup (development instance)

1. **The user** creates an application named `Hive` (an account login, so it's the user's job).
2. **The user** puts its publishable and secret keys in `.env.local`, plus the four `NEXT_PUBLIC_CLERK_*` URL variables from `CONTRACT.md`.
3. **The agent applies the User & authentication settings below**, so nobody has to click through every tab. Use the Clerk CLI and Clerk's instance configuration API, as the installed `clerk-cli` skill describes (log the CLI in to the `Hive` application if it asks). Run a **dry run first**, show the user exactly which settings change, and apply only after they agree (AGENTS.md rule 11). The API also accepts a username minimum of **3**, which the dashboard doesn't allow. If a setting can't be applied this way, give the user its dashboard path from the table instead. Afterwards, read the settings back and report them.

   The settings, exactly:

   | Tab | Setting |
   | --- | --- |
   | Email | Sign-up with email **on**, Require email address **on**, Verify at sign-up **on** with **Email verification code** only. Sign-in with email **on**, Email verification code **on**, Email verification link **off** |
   | Phone | Everything **off** |
   | Username | Sign-up with username **on**, Require username **on**, Sign-in with username **off**. In the panel beside them, set **Minimum length** to **3** (the default of 4 rejects the test username `ada`) |
   | Password | **On** |
   | Passkeys, Biometric | **Off** |
   | User model | Defaults (first and last name on but not required, account deletion and email changes allowed), except **Allow users to change their username: off**. Hive copies the username into the profile once, at sign-up, as the `@handle`, so a later change in Clerk would leave the two out of step |
   | SSO connections (sidebar) | All social connections **off** |

4. **Clerk side of the Supabase integration** (the user, in the dashboard): open **Integrations → Supabase** and turn **Activate Supabase integration** on. Check that it shows as on: if it's off, Clerk's session token has no `role: authenticated` claim and every Supabase request from a signed-in user fails. Copy the **Clerk domain** it shows (it looks like `https://<name>.clerk.accounts.dev`).
5. Keep the instance in **development**. The swarm needs its test emails (`+clerk_test`, code `424242`) and test mode.

## Dashboard checklist (Supabase)

1. **Supabase side of the integration:** in the `hive` project, **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk**. Paste the Clerk domain from the Clerk setup and create the connection. Use the domain of the Clerk **development** instance, the one whose keys are in `.env.local`.

Together, the two halves form one handshake: Clerk signs its session tokens in the shape Supabase expects, and Supabase trusts tokens from that Clerk domain. No JWT secrets are copied and no users are synced: RLS reads the user straight from the Clerk token (`auth.jwt()->>'sub'`).

**If signed-in pages fail after this step:** Supabase answering 401, `PGRST301` or "permission denied" for a signed-in user means the handshake is broken. Check that the Clerk integration toggle is on, and that the domain in Supabase matches the Clerk instance whose keys are in `.env.local` (no trailing slash). Signed-out pages keep working either way, which is why the error only shows up after sign-in.

## Files

| File | Contains |
| --- | --- |
| `proxy.ts` (`middleware.ts` if the pinned Next.js is 15 or lower) | VERBATIM below |
| `lib/supabase/server.ts` | VERBATIM below |
| `lib/profile.ts` | VERBATIM below |
| `components/analytics/analytics-identity.tsx` | VERBATIM below |
| `components/user-menu.tsx` | VERBATIM below (the header's user menu, a client component) |
| `app/layout.tsx` | Wrap everything in `<ClerkProvider>` with the appearance in DESIGN.md › Clerk components, VERBATIM (`shadcn` from `@clerk/ui/themes`). Call `getCurrentProfile()` and render `<AnalyticsIdentity stack={profile?.stack ?? null} />` after the footer |
| `app/sign-in/[[...sign-in]]/page.tsx` | `<section className="page signin-page"><Honeycomb fx={0.5} fy={0.5} max={0.22} seed={29} /><div className="center"><SignIn /></div></section>` (the design's Sign in view) |
| `app/sign-up/[[...sign-up]]/page.tsx` | The same as sign-in, with `<SignUp />` |
| `app/onboarding/page.tsx` | The stack picker page (spec below) |
| `components/onboarding/stack-picker.tsx` | Client component: radio cards plus buttons |
| `app/onboarding/actions.ts` | `saveStack(stack)` |
| `components/site-header.tsx` | Wire in Clerk (spec below) |

`proxy.ts`, **VERBATIM**:

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
};
```

`lib/supabase/server.ts`, **VERBATIM**:

```ts
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Every app read and write goes through this client, so RLS always applies.
// Signed-out visitors get the anon role; signed-in users get their Clerk session token.
export async function createServerSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    },
  );
}
```

`lib/profile.ts`, **VERBATIM**:

```ts
import 'server-only';
import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { trackServer } from '@/lib/analytics/server';

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  stack: string | null;
};

const FIELDS = 'id, handle, display_name, avatar_url, stack';

// The signed-in user's profile. Created on their first signed-in request, which is
// also the only place user_signed_up is sent.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const supabase = await createServerSupabase();

  const { data: existing } = await supabase.from('profiles').select(FIELDS).eq('id', userId).maybeSingle();
  if (existing) return existing;

  const user = await currentUser();
  if (!user?.username) return null; // Username is required in the Clerk dashboard settings.

  const base = { id: userId, display_name: user.fullName || user.username, avatar_url: user.imageUrl };
  let result = await supabase.from('profiles').insert({ ...base, handle: user.username }).select(FIELDS).single();
  if (result.error) {
    // Either another request created the profile first, or the handle belongs to a seed author.
    const { data: raced } = await supabase.from('profiles').select(FIELDS).eq('id', userId).maybeSingle();
    if (raced) return raced;
    const fallback = `${user.username}-${userId.slice(-6).toLowerCase()}`;
    result = await supabase.from('profiles').insert({ ...base, handle: fallback }).select(FIELDS).single();
    if (result.error) return null;
  }

  await trackServer(userId, 'user_signed_up', { method: 'email' });
  return result.data;
});
```

`components/analytics/analytics-identity.tsx`, **VERBATIM**:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';

// Links the anonymous visitor to the Clerk user, resets on sign-out,
// and attaches the active team as a PostHog group.
export function AnalyticsIdentity({ stack }: { stack: string | null }) {
  const { isLoaded, user } = useUser();
  const { organization } = useOrganization();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      if (lastUserId.current) posthog.reset();
      lastUserId.current = null;
      return;
    }
    lastUserId.current = user.id;
    if (posthog.get_distinct_id() === user.id) return;
    posthog.identify(user.id, {
      handle: user.username ?? '',
      name: user.fullName ?? user.username ?? '',
      ...(stack ? { stack } : {}),
      cohort: posthog.get_property('cohort') ?? 'human',
      persona: posthog.get_property('persona') ?? 'none',
    });
  }, [isLoaded, user, stack]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      posthog.resetGroups();
      return;
    }
    posthog.group('organization', organization.id, { name: organization.name, slug: organization.slug ?? '' });
  }, [isLoaded, organization]);

  return null;
}
```

**`/onboarding` page:** if signed out, `redirect('/sign-in')`.

- Inside `<PageShell>`: `h1.page-title` "Pick your stack", then `p.dash-sub`: "We’ll use it to show skills that fit how you build."
- One radio card per stack in `STACKS` order, in a `.vis` grid with three columns on desktop (one below 560px): `label.vis-opt` with a native radio (`name="stack"`), `.radio` and `.vis-title` with the stack name. The selected card gets the design's checked style automatically. 36px below the title.
- `btn-ember p-submit` "Continue" (max-width 320px), disabled until a stack is chosen, pending label "Saving…". It calls `saveStack`. Beside it, `link-btn` "Skip for now" to `/explore`.

**`saveStack(stack)`:** reject anything not in `STACKS`. Update the user's `profiles.stack` through `createServerSupabase()`, call `setPersonProperties(userId, { stack })`, then `redirect('/explore')`.

**Header, signed out:** in `.bar-right`, `<Show when="signed-out"><SignInButton><button type="button" className="signin">Sign in</button></SignInButton></Show>`.

**Header, signed in** (`<Show when="signed-in">`):

1. In `.nav-links`, after "Publish": `<NavLink href="/dashboard">Dashboard</NavLink>`. In Step 13 it gets an unread count.
2. In `.bar-right`: `<UserMenu handle={profile?.handle ?? null} />` from `components/user-menu.tsx`: Clerk's `<UserButton>` with one extra menu item, "Profile", linking to `/u/{handle}`. Its avatar gets the design's glow through the ClerkProvider appearance.

**The user menu must be a client component.** Clerk only recognises `<UserButton.MenuItems>` and `<UserButton.Link>` inside a client component, and `SiteHeader` is a server component (it awaits `getCurrentProfile()`). Written straight into `SiteHeader`, Clerk ignores the custom item and logs two console errors. So `SiteHeader` passes the handle to this small client component.

`components/user-menu.tsx`, **VERBATIM**:

```tsx
'use client';
import { UserButton } from '@clerk/nextjs';
import { UserIcon } from 'lucide-react';

// Clerk only recognises <UserButton.MenuItems> and <UserButton.Link> inside a
// client component, and SiteHeader is a server component (it awaits the
// profile). So the user menu lives here and gets the handle as a prop.
export function UserMenu({ handle }: { handle: string | null }) {
  if (!handle) return <UserButton />;
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link label="Profile" labelIcon={<UserIcon className="size-4" />} href={`/u/${handle}`} />
      </UserButton.MenuItems>
    </UserButton>
  );
}
```

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- Sign up with `ada+clerk_test@example.com`, username `ada`, any password, verification code `424242`. You land on `/onboarding`.
- Supabase has a `profiles` row with `id` = your Clerk user id and `handle` = `ada`. (This proves the Clerk and Supabase handshake works: the row was inserted through RLS with Clerk's token.)
- PostHog shows exactly one `user_signed_up`, and your earlier anonymous `$pageview`s are merged into the identified person.
- Choosing "Python" and Continue sets `stack: Python` on the PostHog person and in `profiles`.
- Signed in, the browser console shows no Clerk errors, and the avatar menu has a "Profile" item linking to `/u/ada`.
- Sign out from the user menu, then sign in again: still one person in PostHog, no second `user_signed_up`.
- In the Supabase SQL editor, running `set role anon; insert into profiles (id, handle, display_name) values ('x', 'x', 'x');` fails with a row-level security error.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 06
- Clerk: ClerkProvider (shadcn theme), proxy.ts with clerkMiddleware, /sign-in and /sign-up pages, username required, development instance.
- Supabase accepts Clerk session tokens (third-party auth). lib/supabase/server.ts createServerSupabase() is the only app client.
- lib/profile.ts getCurrentProfile() creates the profile on first sign-in and sends user_signed_up once.
- AnalyticsIdentity identifies the Clerk user, resets on sign-out and sets the organization group.
- /onboarding saves the stack to profiles and to PostHog person properties.
- Header user menu: components/user-menu.tsx is a client component (Clerk's UserButton custom items only work in client components); SiteHeader passes it the handle.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 06: auth and profiles` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `07-landing.md`
