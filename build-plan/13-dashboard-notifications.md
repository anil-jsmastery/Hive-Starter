# Step 13: Dashboard and notifications

| | |
| --- | --- |
| What you'll learn | Retention loops |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 12 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** your skills, your forks, notifications, and the event that shows whether notifications bring people back.

## Files

`app/dashboard/page.tsx`, `app/dashboard/actions.ts`, `components/dashboard/notification-list.tsx`, `components/dashboard/skills-panel.tsx`, `components/dashboard/sparkline.tsx`, `lib/queries/notifications.ts`, `lib/queries/dashboard.ts`, `supabase/migrations/0006_dashboard_stats.sql`. Update `components/site-header.tsx`.

**The dashboard stats need one read-only database function.** The design shows four stats with "this week" numbers and trend lines. Some of that data is hidden by RLS (you can't read who starred your skills), so `dashboard_stats()` returns **counts only**, for the signed-in user. Apply it with the Supabase MCP `apply_migration` tool, unchanged, then regenerate the types with `npm run db:types`.

`supabase/migrations/0006_dashboard_stats.sql`, **VERBATIM**:

```sql
-- Dashboard stats for the signed-in user: totals, this week's additions and an
-- 8-week cumulative series per stat. Returns counts only (never who starred,
-- forked or followed), so it can safely read past RLS on stars.
create or replace function public.dashboard_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.requesting_user_id() as id
  ),
  my_skills as (
    select s.id, s.stars_count, s.forked_from_id, s.created_at
    from public.skills s, me
    where s.author_id = me.id
  ),
  events as (
    select 'stars' as stat, st.created_at
    from public.stars st
    where st.skill_id in (select id from my_skills)
    union all
    select 'forks', f.created_at
    from public.skills f
    where f.forked_from_id in (select id from my_skills)
      and f.author_id <> (select id from me)
    union all
    select 'followers', fo.created_at
    from public.follows fo, me
    where fo.following_id = me.id
    union all
    select 'published', ms.created_at
    from my_skills ms
    where ms.forked_from_id is null
  ),
  weeks as (
    select generate_series(7, 0, -1) as w
  ),
  per_stat as (
    select
      stat,
      count(*) as total,
      count(*) filter (where created_at > now() - interval '7 days') as week,
      (
        select json_agg(c order by w desc)
        from (
          select w, count(*) filter (where e2.created_at <= now() - make_interval(weeks => w)) as c
          from weeks
          left join events e2 on e2.stat = e.stat
          group by w
        ) series
      ) as series
    from events e
    group by stat
  ),
  stats as (
    select s.stat, coalesce(p.total, 0) as total, coalesce(p.week, 0) as week,
           coalesce(p.series, '[0,0,0,0,0,0,0,0]'::json) as series
    from (values ('stars'), ('forks'), ('followers'), ('published')) as s(stat)
    left join per_stat p on p.stat = s.stat
  )
  select json_object_agg(
    stat,
    json_build_object(
      'total', case when stat = 'stars'
                    then (select coalesce(sum(stars_count), 0) from my_skills)
                    else total end,
      'week', week,
      'series', series
    )
  )
  from stats;
$$;

revoke execute on function public.dashboard_stats() from public, anon;
grant execute on function public.dashboard_stats() to authenticated;
```

`lib/queries/dashboard.ts`, **VERBATIM**:

```ts
import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export type StatKey = 'stars' | 'forks' | 'followers' | 'published';
export type Stat = { total: number; week: number; series: number[] };
export type DashboardStats = Record<StatKey, Stat>;

const EMPTY: Stat = { total: 0, week: 0, series: [0, 0, 0, 0, 0, 0, 0, 0] };

// Totals, this week's additions and 8-week series, from the dashboard_stats()
// database function (counts only, for the signed-in user).
export async function dashboardStats(): Promise<DashboardStats> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('dashboard_stats');
  if (error) throw error;
  const d = (data ?? {}) as Partial<DashboardStats>;
  return {
    stars: d.stars ?? EMPTY,
    forks: d.forks ?? EMPTY,
    followers: d.followers ?? EMPTY,
    published: d.published ?? EMPTY,
  };
}

export type SkillRow = {
  id: string;
  slug: string;
  title: string;
  stack: string;
  stars_count: number;
  visibility: 'public' | 'private';
  created_at: string;
  forked_from: { slug: string; author: { handle: string } | null } | null;
  fork_count: number;
};

// Dashboard rows: your original skills, your forks, or a team's skills, newest
// first, each with how many visible forks it has.
export async function skillRows(filter: { authorId?: string; orgId?: string; forks?: boolean }): Promise<SkillRow[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('skills')
    .select('id, slug, title, stack, stars_count, visibility, created_at, forked_from:forked_from_id(slug, author:profiles!skills_author_id_fkey(handle))');
  if (filter.authorId) query = query.eq('author_id', filter.authorId);
  if (filter.orgId) query = query.eq('org_id', filter.orgId);
  if (filter.forks === true) query = query.not('forked_from_id', 'is', null);
  if (filter.forks === false) query = query.is('forked_from_id', null);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Omit<SkillRow, 'fork_count'>[];
  if (!rows.length) return [];
  const { data: forks } = await supabase
    .from('skills')
    .select('forked_from_id')
    .in('forked_from_id', rows.map((r) => r.id));
  const counts = new Map<string, number>();
  for (const f of forks ?? []) {
    const id = f.forked_from_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, fork_count: counts.get(r.id) ?? 0 }));
}
```

`components/dashboard/sparkline.tsx`, **VERBATIM**:

```tsx
// A small trend line under each dashboard stat (the design file's spark()).
export function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [i * (w / (values.length - 1)), h - 3 - ((v - min) / (max - min || 1)) * (h - 8)]);
  const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="rgba(246,166,35,.12)" />
      <polyline points={line} fill="none" stroke="#F6A623" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```


`app/dashboard/actions.ts`, **VERBATIM**:

```ts
'use server';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/profile';
import { trackServer } from '@/lib/analytics/server';

export async function openNotification(id: string) {
  const me = await getCurrentProfile();
  if (!me) redirect('/sign-in?redirect_url=/dashboard');
  const supabase = await createServerSupabase();
  const { data: n } = await supabase
    .from('notifications')
    .select('id, type, read_at, actor:profiles!notifications_actor_id_fkey(handle), skill:skills!notifications_skill_id_fkey(slug)')
    .eq('id', id)
    .maybeSingle();
  if (!n) redirect('/dashboard');

  if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  await trackServer(me.id, 'notification_clicked', { type: n.type as 'fork' | 'comment' | 'follow' });

  if (n.type === 'follow' || !n.skill) redirect(`/u/${n.actor?.handle ?? ''}`);
  redirect(`/s/${n.skill.slug}`);
}
```

**Append to `app/dashboard/actions.ts`**, **VERBATIM** (and add `import { revalidatePath } from 'next/cache';` to its imports). No event: marking as read isn't a decision anyone measures.

```ts
export async function markAllNotificationsRead() {
  const me = await getCurrentProfile();
  if (!me) redirect('/sign-in?redirect_url=/dashboard');
  const supabase = await createServerSupabase();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me.id)
    .is('read_at', null);
  revalidatePath('/dashboard');
}
```

**`lib/queries/notifications.ts`:** `listNotifications()` (up to 30, newest first, with actor handle and skill slug and title, using the same FK hints as above) and `unreadCount()` (`count: 'exact', head: true` where `read_at` is null). RLS limits both to the current user.

**Look:** the design file's dashboard view, exactly.

**Page:** signed out → `redirect('/sign-in?redirect_url=/dashboard')`. Inside `<PageShell className="dash">`:

1. **`.dash-top`:** `h1.page-title` "Dashboard" and `p.dash-sub` "Welcome back, @{handle}. Here’s how your skills are doing.", with `Link.btn-ember.dash-cta` (`<PlusIcon />` "Publish a skill", to `/publish`) on the right.
2. **`.stats`:** four `.stat` cards from `dashboardStats()`, in this order: "Stars received" (`stars`), "Skills published" (`published`), "Forks of your skills" (`forks`), "Followers" (`followers`). Each: `span.stat-label`, `span.stat-value` (the total), and `span.stat-foot` with `span.stat-delta` ("+{week} this week", or "No change this week" when 0) and `<Sparkline values={series} />`.
3. **`.dash-grid`:**
   - **`section.panel`** (`aria-label="Your skills and forks"`), `components/dashboard/skills-panel.tsx` (client, for the tabs): `.panel-head` with a `.cl-switch` of tabs "Your skills" and "Forks", each with `span.tab-n` (the count). Step 14 adds a team tab. Below, `ul.srows`, one row per skill from `skillRows()` (`{ authorId: me.id, forks: false }` and `{ authorId: me.id, forks: true }`): `li` > `Link.srow` to `/s/[slug]` with `span.glyph.sm` + `SkillGlyph`, `span.srow-main` (`span.srow-title` with `<b>` title and `span.priv` when private; `span.srow-sub` "Published {timeAgo}" or, for a fork, "Forked from @{handle}, published {timeAgo}"), `span.fw.srow-fw` stack, `span.srow-stat` with `<StarIcon />` and stars, `span.srow-stat.srow-forks` with `<ForkIcon />` and `fork_count`, then `<ChevronIcon />`.
     - Empty "Your skills": `li.srows-empty` with `<strong>` "No skills yet" and "You haven’t published a skill yet." plus a link "Publish a skill" to `/publish`.
     - Empty "Forks": `li.srows-empty` with `<strong>` "No forks yet" and "Fork a skill to make your own version." plus a link "Explore skills" to `/explore`.
   - **`aside.panel`** (`aria-label="Activity"`): `.panel-head` with `h2` "Activity" and `span.new-count` "{n} new" (only when unread), and, only when unread, a `<form action={markAllNotificationsRead}>` with `button.link-btn` "Mark all as read". Below, `ul.notes`, one `li.note-li` per notification (add `unread` when unread), each a `<form action={openNotification.bind(null, id)}>` with `button.note-btn`:
     - `span.note-av`: `<AvatarInitial handle={actor} />` and `span.badge.{type}` with `<ForkIcon />`, `<CommentIcon />` or `<FollowIcon />`.
     - `div.note-main`: `span.note-text` with the text below (the handle in `<b>`, the skill title in `<b>`), then `span.note-time` with `span.udot` (`role="img"`, `aria-label="Unread"`) when unread and `timeAgo`.

     | Type | Text |
     | --- | --- |
     | fork | "@{actor} forked {skill title}" |
     | comment | "@{actor} commented on {skill title}" |
     | follow | "@{actor} followed you" |

     Empty: `li.srows-empty` with `<strong>` "Nothing yet" and "When someone forks, comments or follows, it shows up here."

**Header:** after "Dashboard" in the nav, `span.new-count` with `unreadCount()`, hidden at 0.

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- The page matches the design file's dashboard view: four stats with trend lines, the skills panel with tabs, and the Activity panel.
- Supabase MCP `list_migrations` shows `0006_dashboard_stats`, and `npx tsc --noEmit` passes after `npm run db:types`. The security advisor's note that signed-in users can execute `dashboard_stats` is expected: it returns counts for the caller only.
- As user A, fork a seed skill. As user B, fork one of A's skills. A sees one unread notification and the header shows 1.
- A's "Forks of your skills" stat shows 1 with "+1 this week".
- "Mark all as read" clears the unread markers and the header count, and sends no event.
- Clicking it sends `notification_clicked` with `type: fork`, marks it read and opens the skill.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 13
- /dashboard (Hive Night dashboard view): four stats from dashboard_stats() (migration 0006, counts only) with sparklines; skills panel with tabs (Your skills, Forks) from skillRows(); Activity panel (openNotification marks read, sends notification_clicked, redirects; markAllNotificationsRead sends no event).
- Header shows unreadCount() from lib/queries/notifications.ts after the Dashboard link.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 13: dashboard notifications` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `14-organizations.md`
