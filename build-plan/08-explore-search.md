# Step 08: Explore and search

| | |
| --- | --- |
| What you'll learn | Search as the voice of the user |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 07 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** browse and search skills with a stack filter, and track what people search for.

## Files

`app/explore/page.tsx`, `components/explore/search-form.tsx`, `components/explore/stack-filter.tsx`, `components/explore/skill-card.tsx`, `lib/queries/search.ts`.

**`lib/queries/search.ts`, VERBATIM:**

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export type SkillCardData = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  stack: string;
  stars_count: number;
  visibility: 'public' | 'private';
  author: { handle: string } | null;
  org: { slug: string; name: string } | null;
};

export const CARD_FIELDS =
  'slug, title, description, tags, stack, stars_count, visibility, author:profiles!skills_author_id_fkey(handle), org:organizations!skills_org_id_fkey(slug, name)';

export async function searchSkills(q: string, stack: string | null): Promise<SkillCardData[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc('search_skills', { q, ...(stack ? { stack_filter: stack } : {}) })
    .select(CARD_FIELDS);
  if (error) throw error;
  return (data ?? []) as unknown as SkillCardData[];
}
```

Every embedded relation in this plan names its foreign key (for example `profiles!skills_author_id_fkey`). Skills and profiles are linked in several ways (author, stars, comments), so without the hint Supabase can't tell which link you mean.

**The URL is the state:** `/explore?q=<query>&stack=<stack>`. `stack` is missing or one of `STACKS`; anything else counts as "All".

**Look:** the design file's Explore view, exactly. Everything sits inside `<PageShell className="explore">`.

**Page, top to bottom:**

1. `h1.page-title` "Explore skills".
2. **Search form** (client): `form.search` with `role="search"`, label "Search skills", then `.field` holding `<SearchIcon />`, an `<input type="search">` with placeholder `Try “code review” or “auth”`, and `button.btn-ember` "Search". Submitting goes to `/explore?q=…` and keeps the current `stack`. An empty search removes `q`.
3. **Stack filter:** `.chips` (`role="group"`, `aria-label="Filter by stack"`) with `Link`s, `className="chip"`, for "All" and each stack. The current one has `aria-pressed="true"`. Clicking keeps `q`.
4. **Count:** `p.count`: "{n} skills" ("1 skill" when singular).
5. **Results:** `.grid` of `SkillCard`s (two columns, one below 820px).
6. **Empty state** (only when `q` is set and there are 0 results): `EmptyState` with title `No skills match “{q}”`, body "Try a shorter search, or browse every skill." and a link `className="link-btn"` "Browse all skills" to `/explore`. It spans the whole grid.

**`SkillCard`** (client component, so it can track clicks), exactly as DESIGN.md › SkillCard. The whole card is one `<Link className="skill" href="/s/[slug]">` (nested links aren't allowed, so the author and team are shown as text; their pages are linked from the skill page):

- `.skill-top`: `<span className="glyph"><SkillGlyph title={title} stars={stars_count} /></span>` and `.skill-name` with `h2` title and `span.author` "@{author.handle}".
- `p`: the description.
- `.meta`: `span.fw` stack, `span.tag` team name when `org` is set, `span.priv` with `<LockIcon />` and "Private" when `visibility` is `private`, a `span.tag` per tag, then `span.stars` (`aria-label="{n} stars"`) with `<StarIcon />` and the count.
- When the card receives a `query` prop, clicking it calls `trackClient('search_result_opened', { query, rank, slug })`, where `rank` is the 1-based position.

**Tracking searches** (only when `q` is set):

```tsx
<TrackOnMount key={`${q}|${stack ?? 'All'}`} event="search_performed"
  properties={{ query: q, stack: stack ?? 'All', result_count: results.length }} />
```

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- The page matches the design file's Explore view: the search field glows on focus, the active chip is ember, and cards lift with their emblem lighting up on hover.
- Searching "auth" returns the auth skills.
- Searching "terraform" shows the empty state and sends `search_performed` with `result_count: 0`.
- Changing the stack filter while a query is set sends a new `search_performed`.
- Opening `/explore` with no query sends no search event.
- With no search, Explore lists skills newest first: the card order matches `created_at`, newest first (check the first three with the Supabase MCP server). A search still ranks by relevance, then stars.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 08
- /explore: URL state (q, stack), search form, stack filter pills, SkillCard list from searchSkills() in lib/queries/search.ts (search_skills RPC).
- Events: search_performed (TrackOnMount keyed by query and stack), search_result_opened (SkillCard).
- SkillCard shows author, stack, team badge, Private badge, tags and stars.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 08: explore search` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `09-skill-page.md`
