# Step 07: Landing page

| | |
| --- | --- |
| What you'll learn | One page, one job: does the landing page convert? |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 06 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** one sentence, one call to action and a live activity rail.

## Files

`app/page.tsx`, `components/landing/hero-cta.tsx`, `components/landing/activity-feed.tsx`, `components/landing/fit-lead.tsx`, `lib/queries/activity.ts`.

**`lib/queries/activity.ts`, VERBATIM:**

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import { ACTIVITY_LIMIT } from '@/lib/constants';

export async function latestActivity() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, created_at, actor:profiles!activities_actor_id_fkey(display_name, handle), skill:skills!activities_skill_id_fkey(slug, title)')
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);
  if (error) throw error;
  return data ?? [];
}
```

**Look:** the design file's home view, exactly. Two columns on desktop (the hero text, then the "Happening now" card), stacked below 900px, over the glowing honeycomb.

**`app/page.tsx`** (server component, `export const dynamic = 'force-dynamic'`):

```text
<section className="hero">
  <Honeycomb fx={0.7} fy={0.45} />
  <div className="hero-inner">
    <div className="intro">
      <h1>The registry for agent skills.</h1>
      <p className="lead">Find, install and share the Markdown playbooks your AI agents run on, from code reviews to commit messages.</p>
      <HeroCta />
    </div>
    <ActivityFeed rows={await latestActivity()} />
  </div>
  <FitLead />
</section>
```

**`hero-cta.tsx`** (client): `<Link className="btn-ember cta" href="/explore">Explore skills</Link>`, calling `trackClient('landing_cta_clicked', { cta: 'hero' })` on click.

`components/landing/activity-feed.tsx`, **VERBATIM**. It shows the 8 latest rows, refreshes the page data every 15 seconds while the tab is visible (pausing while the card is hovered or focused), and animates new rows exactly like the design: the new row slides in at the top while the oldest slides out of view below, and the first rows' rise-in never replays:

```tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { timeAgo } from '@/lib/time';

export type FeedRow = {
  id: string;
  type: 'published' | 'forked' | 'starred' | 'commented';
  created_at: string;
  actor: { display_name: string; handle: string } | null;
  skill: { slug: string; title: string } | null;
};

const VERBS: Record<FeedRow['type'], string> = {
  published: 'published',
  forked: 'forked',
  starred: 'starred',
  commented: 'commented on',
};
const ROWS = 8;
const REFRESH_MS = 15000;
const FRESH_MS = 1500;

// "Happening now": the latest activity, refreshed while the page is visible.
// As in the design: the first rows rise in one by one; a new row slides in at
// the top with the sweep while the oldest slides out below; the live dot pings
// and one lit honeycomb cell flares. Hovering or focusing the card pauses it.
export function ActivityFeed({ rows }: { rows: FeedRow[] }) {
  const router = useRouter();
  const paused = useRef(false);
  const liveDot = useRef<HTMLSpanElement>(null);
  const [list, setList] = useState(rows);
  const listRef = useRef(rows);
  const [introIds] = useState(() => new Set(rows.map((r) => r.id)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => {
      if (!paused.current && document.visibilityState === 'visible') router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const known = new Set(listRef.current.map((r) => r.id));
    const added = rows.filter((r) => !known.has(r.id));
    if (!added.length) return;

    // Keep the old rows for now: the fixed-height list hides the extras, so the
    // oldest row slides out of view while the new one slides in.
    const next = [...added, ...listRef.current];
    listRef.current = next;
    setList(next);
    setFresh(new Set(added.map((r) => r.id)));

    const dot = liveDot.current;
    if (dot) {
      dot.classList.remove('ping');
      void dot.offsetWidth;
      dot.classList.add('ping');
    }
    const cells = [...document.querySelectorAll<SVGPolygonElement>('.hero .comb .cell.lit')]
      .filter((c) => parseFloat(c.getAttribute('points') ?? '0') > 820);
    const cell = cells[Math.floor(Math.random() * cells.length)];
    if (cell) {
      cell.classList.remove('flare');
      void cell.getBoundingClientRect();
      cell.classList.add('flare');
      setTimeout(() => cell.classList.remove('flare'), 1700);
    }

    const t = setTimeout(() => {
      const trimmed = listRef.current.slice(0, ROWS);
      listRef.current = trimmed;
      setList(trimmed);
      setFresh(new Set());
    }, FRESH_MS);
    return () => clearTimeout(t);
  }, [rows]);

  const pause = () => { paused.current = true; };
  const resume = () => { paused.current = false; };

  // Intro rows keep their class (so the rise-in never replays); new rows get
  // "enter fresh" while they animate, then no animation class at all.
  const rowClass = (id: string) => (fresh.has(id) ? 'enter fresh' : introIds.has(id) ? 'intro' : undefined);

  return (
    <section className="feed" aria-labelledby="feed-title"
      onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
      <div className="feed-head">
        <h2 id="feed-title">Happening now</h2>
        <span className="live" ref={liveDot} aria-hidden="true" />
      </div>
      {list.length === 0 ? (
        <div className="empty small">
          <strong>It’s quiet in here</strong>
          New skills will show up here as people publish them.
        </div>
      ) : (
        <ol style={{ '--rows': ROWS } as CSSProperties}>
          {list.map((r, i) => (
            <li key={r.id} className={rowClass(r.id)} style={{ '--i': i } as CSSProperties}>
              <span className={`dot ${r.type}`} aria-hidden="true"><i /></span>
              <span className="text">
                <span className="user">{r.actor?.display_name ?? 'Someone'}</span>{' '}
                {VERBS[r.type]}{' '}
                {r.skill ? <Link href={`/s/${r.skill.slug}`}>{r.skill.title}</Link> : 'a skill'}
              </span>
              <span className="time">{timeAgo(r.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

`components/landing/fit-lead.tsx`, **VERBATIM**:

```tsx
'use client';
import { useEffect } from 'react';

// Keeps the hero subheading as wide as the heading's longest line, and never
// more than two lines (the design file's fitLead).
export function FitLead() {
  useEffect(() => {
    const fit = () => {
      const h = document.querySelector<HTMLElement>('.hero h1');
      const l = document.querySelector<HTMLElement>('.hero .lead');
      if (!h || !l) return;
      l.style.maxWidth = '';
      const range = document.createRange();
      range.selectNodeContents(h);
      const w = range.getBoundingClientRect().width;
      if (w) l.style.maxWidth = `${Math.ceil(w)}px`;
      const lh = parseFloat(getComputedStyle(l).lineHeight);
      if (l.getBoundingClientRect().height > lh * 2.5) l.style.maxWidth = '';
    };
    fit();
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return null;
}
```

Pass `latestActivity()`'s rows to `ActivityFeed` as `FeedRow[]` (cast the embedded `actor` and `skill` objects). Each row's skill title links to `/s/[slug]`; each type gets its marker from the design (`.dot.published`, `.dot.starred`, `.dot.commented`, and `.dot.forked` from `hive-night-app.css`).

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- The page matches the design file's home view: the honeycomb lights up from the right, the feed rows rise in one by one, and the live dot breathes.
- With seed data, the feed shows 8 "published" rows, newest first.
- The live feed: there's no Star button until Step 09, so with `/` open, the user runs this in Supabase's **SQL Editor** (it adds one star; the star trigger creates the "starred" activity):

  ```sql
  insert into stars (user_id, skill_id)
  select (select id from profiles limit 1),
         (select id from skills order by created_at desc limit 1);
  ```

  Within about 15 seconds the new row slides in at the top with the sweep while the oldest slides out below, the live dot pings and one honeycomb cell flares. No other row flickers or replays its animation.
- Clicking "Explore skills" sends exactly one `landing_cta_clicked`.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 07
- Landing page (Hive Night home view): hero with one CTA (landing_cta_clicked) over the Honeycomb, and ActivityFeed: 8 rows from latestActivity() in lib/queries/activity.ts, refreshed every 15 seconds with the design's animations.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 07: landing` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `08-explore-search.md`
