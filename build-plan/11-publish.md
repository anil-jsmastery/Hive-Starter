# Step 11: Publish (with visibility and the paywall)

| | |
| --- | --- |
| What you'll learn | Activation, and where builders give up |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 10 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** the editor, preview, validation and publishing. The action already handles team ownership and private skills; the form only shows those choices from Steps 14 and 16.

## Files

`app/publish/page.tsx`, `app/publish/actions.ts`, `components/publish/publish-form.tsx`, `components/publish/publish-started.tsx`, `lib/validation.ts`, `lib/organization.ts`.

`lib/validation.ts`, **VERBATIM**:

```ts
import { z } from 'zod';
import { STACKS } from './constants';

export const publishSchema = z.object({
  title: z.string().trim()
    .min(3, 'Title needs at least 3 characters.')
    .max(60, 'Title can be at most 60 characters.'),
  description: z.string().trim()
    .min(10, 'Description needs at least 10 characters.')
    .max(160, 'Description can be at most 160 characters.'),
  stack: z.enum(STACKS, { message: 'Choose a stack.' }),
  tags: z.string()
    .transform((v) => [...new Set(v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.string().regex(/^[a-z0-9-]{1,20}$/, 'Tags use lowercase letters, numbers and dashes, up to 20 characters each.'))
      .min(1, 'Add at least one tag.')
      .max(5, 'Use at most 5 tags.')),
  content: z.string().trim()
    .min(80, 'Skill content needs at least 80 characters.')
    .max(20000, 'Skill content can be at most 20,000 characters.'),
  visibility: z.enum(['public', 'private']).catch('public'),
});
```

`lib/organization.ts`, **VERBATIM** (used from Step 14):

```ts
import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { identifyOrganization } from '@/lib/analytics/server';

// Makes sure the active Clerk organization has a row in Supabase.
// Returns it, or null when no team is active.
export async function ensureOrganization() {
  const { orgId } = await auth();
  if (!orgId) return null;
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.from('organizations').select('id, slug, name').eq('id', orgId).maybeSingle();
  if (existing) return existing;

  const org = await (await clerkClient()).organizations.getOrganization({ organizationId: orgId });
  const row = { id: org.id, slug: org.slug ?? org.id, name: org.name, image_url: org.imageUrl };
  const { data, error } = await supabase.from('organizations').upsert(row).select('id, slug, name').single();
  if (error) return null;
  await identifyOrganization(org.id, { name: org.name, slug: row.slug });
  return data;
}
```

`app/publish/actions.ts`, **VERBATIM**:

```ts
'use server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/profile';
import { ensureOrganization } from '@/lib/organization';
import { trackServer } from '@/lib/analytics/server';
import type { Variant } from '@/lib/analytics/events';
import { FEATURES } from '@/lib/constants';
import { publishSchema } from '@/lib/validation';
import { slugify, uniqueSlug } from '@/lib/slug';

export type PublishField = 'title' | 'description' | 'stack' | 'tags' | 'content';
export type PublishState = {
  errors?: Partial<Record<PublishField, string>>;
  formError?: string;
  values?: Record<string, string>;
  paywall?: (typeof FEATURES)[keyof typeof FEATURES];
};

const FIELDS = ['title', 'description', 'stack', 'tags', 'content', 'visibility', 'owner'] as const;

// While a team is active, Clerk's session token carries only the team's features, so
// has() can't see a personal Pro plan. Ask Clerk for the user's own subscription instead.
async function hasActivePro(userId: string) {
  const subscription = await (await clerkClient()).billing.getUserBillingSubscription(userId);
  return subscription.subscriptionItems.some((item) => item.status === 'active' && item.plan?.slug === 'pro');
}

export async function publishSkill(variant: Variant, _prev: PublishState, formData: FormData): Promise<PublishState> {
  const { userId, orgId, has } = await auth();
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in?redirect_url=/publish');

  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? '')]));
  const parsed = publishSchema.safeParse(values);
  if (!parsed.success) {
    const errors: NonNullable<PublishState['errors']> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as PublishField;
      if (!errors[field]) errors[field] = issue.message;
    }
    return { errors, formError: 'Fix the highlighted fields to publish.', values };
  }
  const { title, description, stack, tags, content, visibility } = parsed.data;
  const asTeam = values.owner === 'team' && Boolean(orgId);

  // Billing decides who may create a private skill. RLS decides who may see it.
  if (visibility === 'private') {
    const feature = asTeam ? FEATURES.team : FEATURES.personal;
    if (!asTeam && orgId && userId) {
      let pro: boolean;
      try {
        pro = await hasActivePro(userId);
      } catch {
        return { formError: 'We couldn’t check your plan. Try again.', values };
      }
      if (!pro) return { paywall: feature, values };
    } else if (!has({ feature })) {
      return { paywall: feature, values };
    }
  }

  const org = asTeam ? await ensureOrganization() : null;
  if (asTeam && !org) return { formError: 'Could not publish for this team. Try again.', values };

  const supabase = await createServerSupabase();
  const slug = await uniqueSlug(
    slugify(title),
    'skill',
    async (candidate) => (await supabase.rpc('slug_taken', { candidate })).data === true,
  );
  const { error } = await supabase.from('skills').insert({
    slug, title, description, stack, tags, content, visibility,
    author_id: profile.id,
    org_id: org?.id ?? null,
  });
  if (error) return { formError: 'Could not publish your skill. Try again.', values };

  await trackServer(
    profile.id,
    'skill_published',
    {
      slug, stack, tag_count: tags.length, content_length: content.length, visibility,
      owner: asTeam ? 'team' : 'personal', variant,
    },
    org?.id ?? null,
  );
  redirect(`/s/${slug}?published=1`);
}
```

**`/publish` page:** signed out → `redirect('/sign-in?redirect_url=/publish')`. `const variant: Variant = 'control'`: the experiment in Steps 18 and 19 is about sign-up, not this form, so the variant stays `control`; the property is kept so a future publish experiment needs no new events. Render `<PublishStarted variant={variant} />` (sends `publish_started` once on mount, built on `TrackOnMount`) and `<PublishForm variant={variant} />`.

**Look:** the design file's publish view, exactly: the form on the left, a live preview of the Explore card on the right (stacked below 960px).

**`app/publish/page.tsx`:** `<PageShell className="publish">`, `h1.page-title` "Publish a skill", then `.publish-grid` with the form and the preview aside.

**`PublishForm`** (client), using `useActionState(publishSkill.bind(null, variant), {})`. `form.pform` (`noValidate`), top to bottom:

1. `formError` as `div.form-alert` (`role="alert"`).
2. **Title:** `.fld` with label "Title" and `input.inp`. Under it, `p.hint`: "Your skill will live at <code>/s/{slugify(title) or "your-skill"}</code>", live.
3. **Description:** `.fld` with `input.inp` and `p.hint` "One sentence on what the skill does."
4. **Stack:** `.fld` with a native `<select className="inp" name="stack">`: an empty first option "Choose a stack", then the `STACKS` options.
5. **Tags:** `.fld` with `input.inp` and `p.hint` "Comma-separated, up to 5. Example: auth, nextjs". When more than 5 tags are typed, the hint turns into `p.hint.warn` "Only the first 5 tags will be saved. You have {n}."
6. **Skill content:** `.fld` with `span.lbl` "Skill content" and `.editor`: `.editor-bar` with `span.editor-file` "{slug or "your-skill"}.md" and `.editor-tools` (`button.link-btn` "Insert template", shown only on Write when the content is empty, and `.cl-switch` with tabs "Write" and "Preview"). Write: `textarea.code` (`name="content"`), placeholder `# Skill name` then a new line and `When should an agent use this skill?`. Preview: `markdown.tsx` inside `div.md.md-preview`, or `<p>Nothing to preview yet. Write some Markdown first.</p>` when empty.
7. `button.btn-ember.p-submit` "Publish skill" (pending: "Publishing…").

"Insert template" fills the content with, **VERBATIM** (using the current title and description, or the placeholders in brackets when empty):

```md
# {title or "Skill name"}

{description or "One sentence on what the skill does."}

## When to use

Describe the situations where an agent should reach for this skill.

## Steps

1. The first thing the agent should do.
2. The next step.

## Output

What the agent should hand back when it's done.
```

**Preview aside** (`aside.p-aside`, `aria-label="Card preview"`): `p.aside-lbl` "How it will look in Explore", then the card exactly as `SkillCard` draws it, but as a `div.skill` (not a link), built from the current values: title or "Your skill title", description or "Your one-sentence description shows up here.", "@{your handle}", the stack, the tags and 0 stars. While the title is empty the card gets `ghost`.

Each field error shows under its field: add `err` to the field's `.fld` and put the message in `p.err-msg`. The form keeps its values after a failed submit (from `state.values`). In this step the form ignores `state.paywall`; Step 16 handles it.

**Submit through `onSubmit`, not the form's `action` prop.** React 19 resets a form after its `action` runs, which would empty the text fields after every failed submit or paywall. Instead: `<form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => formAction(data)); }}>`, where `formAction` comes from `useActionState` and `startTransition` from `useTransition`. Every field added to this form in later steps follows the same pattern.

**Selects and radio buttons are native and controlled.** Stack is a native `<select name="stack">` whose value lives in React state (`value` and `onChange`, initialised from `state.values`). A native control always submits its own value, and controlled state keeps it after a failed submit. Later steps add Publish as (a native `<select name="owner">`) and Visibility (native radios, `name="visibility"`) the same way.

## Checks

- A skill you've just published is the first card on `/explore` with no search (Explore lists the newest skills first).
- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- The page matches the design file's publish view, and the preview card updates as you type.
- "Insert template" fills the editor with the template and disappears.
- Pick a Stack, leave Title empty and submit: the Title error shows and the Stack select still shows your choice.
- Publishing works with each of the six stacks, including straight after a failed submit. "Choose a stack." never appears while a stack is showing.
- Opening `/publish` sends one `publish_started` with `variant: control`.
- Submitting an empty form shows 5 field errors and the top alert, and sends no `skill_published`.
- A valid submit creates the skill, sends `skill_published` with `visibility: public` and `owner: personal`, and lands on the skill page with the "Published" toast.
- A title "Code Review!!" becomes slug `code-review`; a second one becomes `code-review-2`.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 11
- /publish: PublishForm (useActionState) with title, description, stack, tags, Write/Preview content. publish_started on mount.
- PublishForm (Hive Night publish view: form plus live card preview) submits through onSubmit + startTransition(formAction), never the form's action prop.
- Stack, Publish as and Visibility are native controls (select and radios) whose values live in React state, so they submit reliably and survive a failed submit.
- app/publish/actions.ts publishSkill(variant, ...): validates with lib/validation.ts, checks plan features for private skills (returns paywall), publishes as team via ensureOrganization() when owner=team, sends skill_published.
- lib/organization.ts ensureOrganization() upserts the active Clerk organization into Supabase and identifies the PostHog group.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 11: publish` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `12-profiles-follow.md`
