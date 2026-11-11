# Step 09: Skill page: view, install, star, share

| | |
| --- | --- |
| What you'll learn | The value moment: tracking installs on the server |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 08 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** the skill page and its main actions: install, star and share.

## Files

`app/s/[slug]/page.tsx`, `app/s/[slug]/actions.ts`, `components/skill/skill-actions.tsx`, `components/skill/markdown.tsx`, `components/skill/share-tracker.tsx`, `components/skill/more-like-this.tsx`, `lib/queries/skill.ts`, `lib/queries/related.ts`.

`lib/queries/skill.ts`, **VERBATIM**:

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

const SKILL_FIELDS = `id, slug, title, description, content, tags, stack, visibility, stars_count, author_id, org_id, created_at,
  author:profiles!skills_author_id_fkey(handle, display_name),
  org:organizations!skills_org_id_fkey(slug, name),
  forked_from:forked_from_id(slug, title, author:profiles!skills_author_id_fkey(handle))`;

// RLS decides visibility: a private skill the viewer can't see comes back as null.
// forked_from embeds by column name: skills references itself, and a constraint-name
// hint can't tell "the skill this was forked from" from "the skills that fork this".
export async function getSkill(slug: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('skills').select(SKILL_FIELDS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function hasStarred(skillId: string, userId: string | null) {
  if (!userId) return false;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('stars')
    .select('skill_id')
    .eq('skill_id', skillId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}
```

`app/s/[slug]/actions.ts`, **VERBATIM** (Step 10 appends two more actions to this file):

```ts
'use server';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/profile';
import { trackServer } from '@/lib/analytics/server';
import { INSTALL_COMMAND } from '@/lib/constants';
import { slugify, uniqueSlug } from '@/lib/slug';

type NeedsAuth = { needsAuth: true };
type Failed = { error: string };

async function visibleSkill(slug: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('skills')
    .select('id, slug, title, description, content, tags, stack, visibility')
    .eq('slug', slug)
    .maybeSingle();
  return { supabase, skill: data };
}

export async function installSkill(slug: string): Promise<NeedsAuth | Failed | { command: string }> {
  const { orgId } = await auth();
  const profile = await getCurrentProfile();
  if (!profile) return { needsAuth: true };
  const { skill } = await visibleSkill(slug);
  if (!skill) return { error: 'Skill not found.' };
  await trackServer(profile.id, 'skill_installed', { slug, stack: skill.stack }, orgId);
  return { command: INSTALL_COMMAND(slug) };
}

export async function toggleStar(slug: string): Promise<NeedsAuth | Failed | { starred: boolean; starsCount: number }> {
  const { orgId } = await auth();
  const profile = await getCurrentProfile();
  if (!profile) return { needsAuth: true };
  const { supabase, skill } = await visibleSkill(slug);
  if (!skill) return { error: 'Skill not found.' };

  let starred = true;
  const inserted = await supabase.from('stars').insert({ user_id: profile.id, skill_id: skill.id });
  if (inserted.error) {
    if (inserted.error.code !== '23505') return { error: 'Could not update the star.' };
    await supabase.from('stars').delete().eq('user_id', profile.id).eq('skill_id', skill.id);
    starred = false;
  }
  const { data: fresh } = await supabase.from('skills').select('stars_count').eq('id', skill.id).single();
  if (starred) await trackServer(profile.id, 'skill_starred', { slug }, orgId);
  revalidatePath(`/s/${slug}`);
  return { starred, starsCount: fresh?.stars_count ?? 0 };
}
```

(`slugify` and `uniqueSlug` are imported now because Step 10's fork action uses them.)

`lib/queries/related.ts`, **VERBATIM** (a read-only query for the "More like this" card):

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { CARD_FIELDS, type SkillCardData } from '@/lib/queries/search';

// "More like this": up to 3 original skills that share the stack or a tag, most
// starred first. RLS decides which ones the viewer can see.
export async function relatedSkills(skill: { slug: string; stack: string; tags: string[] }): Promise<SkillCardData[]> {
  const supabase = await createServerSupabase();
  const filters: string[] = [];
  if (skill.stack !== 'Any') filters.push(`stack.eq."${skill.stack}"`);
  if (skill.tags.length) filters.push(`tags.ov.{${skill.tags.join(',')}}`);
  let query = supabase.from('skills').select(CARD_FIELDS).neq('slug', skill.slug).is('forked_from_id', null);
  if (filters.length) query = query.or(filters.join(','));
  const { data, error } = await query.order('stars_count', { ascending: false }).limit(3);
  if (error) throw error;
  return (data ?? []) as unknown as SkillCardData[];
}
```

**Look:** the design file's skill view, exactly.

**Page:** `notFound()` when `getSkill` returns null. Inside `<PageShell className="detail">`, top to bottom:

1. `Link.back` to `/explore`: `<BackIcon />` "Explore skills".
2. **`header.d-top`:**
   - `.d-head`: `<span className="glyph lg"><SkillGlyph title={title} stars={stars_count} /></span>`, then `.d-intro` with `h1.d-title` (the title), `p.d-desc` (the description) and `.d-by`: `<AvatarInitial handle>`, "by @{handle}" (the handle in `<b>`, linking to `/u/[handle]`); for a fork, ", forked from {title} by @{handle}" with the title linking to the original; then the team badge (`span.tag`, linking to `/o/[slug]`) and `span.priv` when private.
   - `.d-actions` (`skill-actions.tsx`, client), in this order: **Star** as `button.btn-ghost.star-btn` with `aria-pressed`, `<StarIcon className="star-ic" />`, `span.star-lbl` "Star" or "Starred" and `span.star-n` with the count; **Fork** (Step 10); **Share** (public skills only) as `button.btn-ghost.icon-btn` with `aria-label="Share"`, `title="Copy link"` and `<LinkIcon />`; **Install** as `button.btn-ember.d-install` with `<InstallIcon />` "Install".
3. **`.d-grid`:**
   - `.d-main`: `article.doc` with `.doc-bar` (`<HexIcon />` and "{slug}.md"), then the content: `markdown.tsx` renders `content` with `react-markdown` + `remark-gfm` inside `<div className="md">` (the design's Markdown styles). Raw HTML is not rendered. Step 10 adds the comments below the article.
   - `aside.d-side`: a `section.side-card` with `h2.side-title` "About" and `dl.side-meta`: Stack (`span.fw`), Tags (`span.tag` each), Stars (count), Comments (count), Published (`timeAgo(created_at)`). Then `more-like-this.tsx`: when `relatedSkills()` returns any, a second `section.side-card` with `h2.side-title` "More like this" and `ul.mini-list`, one `li` > `Link` per skill: `span.glyph.xs` with its `SkillGlyph`, `span.mini-txt` (`<b>` title, `<span>` "@{handle}"), and `span.mini-stars` with `<StarIcon />` and the count.

**Client behaviour:**

- Any action returning `needsAuth`: go to `/sign-in?redirect_url=/s/{slug}`.
- **Install:** copy `command` to the clipboard, then toast "Install command copied" with the command (in `font-mono`) as its description.
- **Star:** update the button (`aria-pressed`, label and `span.star-n`) and the About card's star count from the result, then toast "Starred" or "Star removed".
- **Share:** copy `${location.origin}/s/${slug}?ref=share`, toast "Link copied". No event; the open is what's tracked.
- `?published=1` in the URL: toast "Published" once, then remove the parameter with `router.replace` (no scroll).

**Tracking** (client): `<TrackOnMount event="skill_viewed" properties={{ slug, stack, author_handle, visibility }} />`. `share-tracker.tsx`: when the URL has `?ref=share`, send `share_link_opened` once and remove `ref` with `router.replace` (no scroll).

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- The page matches the design file's skill view: emblem, title and actions on top, the document with its file bar, and the About and More like this cards on the right (below the document under 960px).
- With `/` open in another tab, starring a skill makes "{you} starred {skill}" slide into the home page's feed within about 15 seconds.
- Signed out, Install goes to sign-in and comes back to the skill. Signed in, Install copies `npx hive add <slug>` and `skill_installed` arrives with `source: server`.
- Star then unstar: the count goes up then down, and exactly one `skill_starred` is sent.
- Opening `/s/<slug>?ref=share` sends `share_link_opened` once.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 09
- /s/[slug]: getSkill() and hasStarred() in lib/queries/skill.ts (RLS decides visibility).
- app/s/[slug]/actions.ts: installSkill (skill_installed), toggleStar (skill_starred on star only). Star counts come from the trigger.
- Client events: skill_viewed, share_link_opened. Toasts: "Install command copied", "Starred", "Star removed", "Link copied", "Published".
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 09: skill page` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `10-fork-comments.md`
