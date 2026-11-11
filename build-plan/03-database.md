# Step 03: Database schema, RLS and triggers (Supabase)

| | |
| --- | --- |
| What you'll learn | Model only the data the product needs, and secure it with RLS |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 02 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** a Supabase database with Hive's tables, Row Level Security that works with Clerk's session token, triggers for every side effect, and a search function.

## Dashboard checklist (Supabase)

1. Create a new project named `hive` in the region closest to you.
2. From **Project Settings → API Keys**, copy the project URL, the **publishable** key and the **secret** key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`.
3. **Find the project ref:** the project's short ID (about 20 lowercase letters), shown in **Project Settings → General → Project ID**. It's also the part after `/project/` in the dashboard's address bar, and the start of the project URL (`https://<ref>.supabase.co`). It isn't a secret.
4. **Put it in two places:**
   - `.env.local`: `SUPABASE_PROJECT_REF=<ref>` (for the app's scripts, such as type generation).
   - **Your shell environment,** because `.mcp.json` reads `${SUPABASE_PROJECT_REF}` from the environment Claude Code starts in, not from `.env.local`. With the VS Code extension, run these in the project folder. They take the ref from `NEXT_PUBLIC_SUPABASE_URL` (letters and digits only, so no hidden characters such as a pasted carriage return can sneak in), replace any older line in `~/.zshrc` (for example from a previous project), and make `.env.local` use the same value:

     ```bash
     REF=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | sed -E 's#.*https://([a-z0-9]+)\.supabase\.co.*#\1#')
     echo "[$REF]"
     sed -i '' '/SUPABASE_PROJECT_REF/d' ~/.zshrc
     echo "export SUPABASE_PROJECT_REF=$REF" >> ~/.zshrc
     sed -i '' "s/^SUPABASE_PROJECT_REF=.*/SUPABASE_PROJECT_REF=$REF/" .env.local
     ```

     `echo "[$REF]"` must print only the ref inside the brackets. Then quit VS Code completely (Cmd+Q) and reopen it. (On Linux, use `sed -i` without the `''`.) With `claude` in a terminal: `export SUPABASE_PROJECT_REF=<ref>` in that terminal before starting it.
5. Run `/mcp`: the Supabase server no longer warns about `SUPABASE_PROJECT_REF`. Log in to it (again, if you used Supabase's MCP with another project before). If MCP calls fail with "You do not have permission to perform this action", the shell's ref and `.env.local`'s ref differ: repeat item 4.

## Apply the migrations

Create these five files **VERBATIM**, then apply them **in order** with the Supabase MCP tool `apply_migration`, using the file name without `.sql` as the migration name and the file's contents as the query. (Alternative without MCP: `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` then `npx supabase db push`.)

`supabase/migrations/0001_schema.sql`

```sql
create extension if not exists pgcrypto;

-- Clerk session token helpers. 'o' is the organization claim in Clerk's v2 session token.
create or replace function public.requesting_user_id() returns text
language sql stable as $$ select nullif(auth.jwt()->>'sub', '') $$;

create or replace function public.requesting_org_id() returns text
language sql stable as $$ select nullif(coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'), '') $$;

create table public.profiles (
  id text primary key default public.requesting_user_id(),
  handle text not null unique,
  display_name text not null,
  avatar_url text,
  stack text check (stack in ('Next.js', 'React', 'Node.js', 'Python', 'Go', 'Any')),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id text primary key,
  slug text not null unique,
  name text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 60),
  description text not null check (char_length(description) between 10 and 160),
  content text not null check (char_length(content) between 80 and 20000),
  tags text[] not null default '{}',
  stack text not null check (stack in ('Next.js', 'React', 'Node.js', 'Python', 'Go', 'Any')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  author_id text not null references public.profiles(id) on delete cascade,
  org_id text references public.organizations(id) on delete set null,
  forked_from_id uuid references public.skills(id) on delete set null,
  stars_count integer not null default 0 check (stars_count >= 0),
  created_at timestamptz not null default now()
);
create index skills_author_idx on public.skills(author_id);
create index skills_org_idx on public.skills(org_id);

create table public.stars (
  user_id text not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_skill_idx on public.comments(skill_id, created_at);

create table public.follows (
  follower_id text not null references public.profiles(id) on delete cascade,
  following_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null references public.profiles(id) on delete cascade,
  actor_id text not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('fork', 'comment', 'follow')),
  skill_id uuid references public.skills(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('published', 'forked', 'starred', 'commented')),
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index activities_created_idx on public.activities(created_at desc);
```

`supabase/migrations/0002_rls.sql`

```sql
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.skills enable row level security;
alter table public.stars enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.activities enable row level security;

-- profiles
create policy "profiles are public" on public.profiles
  for select using (true);
create policy "users create their own profile" on public.profiles
  for insert to authenticated with check (id = (select public.requesting_user_id()));
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select public.requesting_user_id()))
  with check (id = (select public.requesting_user_id()));

-- organizations
create policy "organizations are public" on public.organizations
  for select using (true);
create policy "members create their active organization" on public.organizations
  for insert to authenticated with check (id = (select public.requesting_org_id()));
create policy "members update their active organization" on public.organizations
  for update to authenticated
  using (id = (select public.requesting_org_id()))
  with check (id = (select public.requesting_org_id()));

-- skills: public ones for everyone; private ones for the author, or for the
-- owning team while it's the active organization. No update or delete (out of scope).
create policy "skills are visible to the right people" on public.skills
  for select using (
    visibility = 'public'
    or author_id = (select public.requesting_user_id())
    or (org_id is not null and org_id = (select public.requesting_org_id()))
  );
create policy "authors publish as themselves or their active team" on public.skills
  for insert to authenticated with check (
    author_id = (select public.requesting_user_id())
    and (org_id is null or org_id = (select public.requesting_org_id()))
  );

-- stars: you only see and change your own
create policy "users see their own stars" on public.stars
  for select to authenticated using (user_id = (select public.requesting_user_id()));
create policy "users star visible skills" on public.stars
  for insert to authenticated with check (
    user_id = (select public.requesting_user_id())
    and exists (select 1 from public.skills s where s.id = skill_id)
  );
create policy "users unstar" on public.stars
  for delete to authenticated using (user_id = (select public.requesting_user_id()));

-- comments: visible wherever the skill is visible
create policy "comments follow skill visibility" on public.comments
  for select using (exists (select 1 from public.skills s where s.id = skill_id));
create policy "users comment as themselves on visible skills" on public.comments
  for insert to authenticated with check (
    author_id = (select public.requesting_user_id())
    and exists (select 1 from public.skills s where s.id = skill_id)
  );

-- follows
create policy "follows are public" on public.follows
  for select using (true);
create policy "users follow as themselves" on public.follows
  for insert to authenticated with check (follower_id = (select public.requesting_user_id()));
create policy "users unfollow" on public.follows
  for delete to authenticated using (follower_id = (select public.requesting_user_id()));

-- notifications: created only by triggers
create policy "users read their notifications" on public.notifications
  for select to authenticated using (recipient_id = (select public.requesting_user_id()));
create policy "users mark their notifications read" on public.notifications
  for update to authenticated
  using (recipient_id = (select public.requesting_user_id()))
  with check (recipient_id = (select public.requesting_user_id()));

-- activities: created only by triggers, shown only for public skills
create policy "activity on public skills is public" on public.activities
  for select using (
    exists (select 1 from public.skills s where s.id = skill_id and s.visibility = 'public')
  );

-- grants
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.organizations to authenticated;
grant insert on public.skills to authenticated;
grant insert, delete on public.stars to authenticated;
grant insert on public.comments to authenticated;
grant insert, delete on public.follows to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant execute on function public.requesting_user_id(), public.requesting_org_id() to anon, authenticated;
```

`supabase/migrations/0003_triggers.sql`

```sql
create or replace function public.on_skill_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare original_author text;
begin
  insert into public.activities (actor_id, type, skill_id, created_at)
  values (new.author_id, case when new.forked_from_id is null then 'published' else 'forked' end, new.id, new.created_at);
  if new.forked_from_id is not null then
    select author_id into original_author from public.skills where id = new.forked_from_id;
    if original_author is not null and original_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, skill_id)
      values (original_author, new.author_id, 'fork', new.forked_from_id);
    end if;
  end if;
  return new;
end $$;
create trigger skills_after_insert after insert on public.skills
  for each row execute function public.on_skill_created();

create or replace function public.on_star_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.skills set stars_count = stars_count + 1 where id = new.skill_id;
  insert into public.activities (actor_id, type, skill_id) values (new.user_id, 'starred', new.skill_id);
  return new;
end $$;
create trigger stars_after_insert after insert on public.stars
  for each row execute function public.on_star_created();

create or replace function public.on_star_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.skills set stars_count = greatest(stars_count - 1, 0) where id = old.skill_id;
  return old;
end $$;
create trigger stars_after_delete after delete on public.stars
  for each row execute function public.on_star_deleted();

create or replace function public.on_comment_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare skill_author text;
begin
  insert into public.activities (actor_id, type, skill_id) values (new.author_id, 'commented', new.skill_id);
  select author_id into skill_author from public.skills where id = new.skill_id;
  if skill_author is not null and skill_author <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, skill_id)
    values (skill_author, new.author_id, 'comment', new.skill_id);
  end if;
  return new;
end $$;
create trigger comments_after_insert after insert on public.comments
  for each row execute function public.on_comment_created();

create or replace function public.on_follow_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end $$;
create trigger follows_after_insert after insert on public.follows
  for each row execute function public.on_follow_created();
```

`supabase/migrations/0004_search.sql`

```sql
create or replace function public.search_skills(q text default '', stack_filter text default null)
returns setof public.skills
language sql stable security invoker set search_path = public as $$
  with params as (
    select case when coalesce(trim(q), '') = '' then null
                else websearch_to_tsquery('english', q) end as tsq
  )
  select s.*
  from public.skills s, params p
  where (p.tsq is null
         or to_tsvector('english', s.title || ' ' || s.description || ' ' || array_to_string(s.tags, ' ')) @@ p.tsq)
    and (stack_filter is null or s.stack = stack_filter)
  order by
    -- A search ranks by relevance, then stars. With no search, Explore shows the
    -- newest skills first, so a newly published skill is seen instead of sitting
    -- below every established one.
    case when p.tsq is null then 0
         else ts_rank(to_tsvector('english', s.title || ' ' || s.description || ' ' || array_to_string(s.tags, ' ')), p.tsq)
    end desc,
    case when p.tsq is null then s.created_at end desc nulls last,
    s.stars_count desc,
    s.created_at desc
  limit 30
$$;
grant execute on function public.search_skills(text, text) to anon, authenticated;

-- Slug checks must see every skill, including private ones the caller can't read.
create or replace function public.slug_taken(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.skills where slug = candidate)
$$;
grant execute on function public.slug_taken(text) to authenticated;
```

`supabase/migrations/0005_hardening.sql`: the last migration. It clears the security advisor's warnings: it pins the session helpers' search path, removes API access to the trigger functions (triggers still fire, because Postgres doesn't check permission when a trigger runs), and lets only signed-in users call `slug_taken`.

```sql
-- Security hardening, so Supabase's security advisor has nothing to flag that
-- the app doesn't need.

-- 1. Pin the search path of the session helpers. Every RLS policy calls them,
--    so a fixed search path stops a look-alike function in another schema from
--    being picked up instead.
alter function public.requesting_user_id() set search_path = '';
alter function public.requesting_org_id() set search_path = '';

-- 2. Trigger functions only run through their triggers, so nobody needs to call
--    them through the API. Postgres doesn't check EXECUTE when a trigger fires,
--    so the triggers keep working.
revoke execute on function public.on_skill_created() from public, anon, authenticated;
revoke execute on function public.on_star_created() from public, anon, authenticated;
revoke execute on function public.on_star_deleted() from public, anon, authenticated;
revoke execute on function public.on_comment_created() from public, anon, authenticated;
revoke execute on function public.on_follow_created() from public, anon, authenticated;

-- 3. slug_taken answers only "is this slug used?". The app calls it when a
--    signed-in user publishes or forks, so signed-out visitors don't need it.
revoke execute on function public.slug_taken(text) from public, anon;
grant execute on function public.slug_taken(text) to authenticated;
```

## Types and helpers

Generate the database types (log in once with `npx supabase login`):

```bash
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > lib/supabase/types.ts
```

Add `"db:types"` to `package.json` scripts with that same command. Never edit `lib/supabase/types.ts` by hand.

The Supabase CLI keeps machine-specific state in `supabase/.temp/`. Add the line `supabase/.temp/` to `.gitignore` so it's never committed.

`lib/constants.ts`, **VERBATIM**:

```ts
export const STACKS = ['Next.js', 'React', 'Node.js', 'Python', 'Go', 'Any'] as const;
export type Stack = (typeof STACKS)[number];
export const INSTALL_COMMAND = (slug: string) => `npx hive add ${slug}`;
export const ACTIVITY_LIMIT = 8;
export const FEATURES = { personal: 'private_skills', team: 'team_private_skills' } as const;
```

`lib/slug.ts`, **VERBATIM**:

```ts
export function slugify(input: string, max = 40): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export async function uniqueSlug(
  base: string,
  fallback: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = base || fallback;
  if (!(await exists(root))) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
}
```

`lib/time.ts`: `timeAgo(date: string | Date)` returns "just now" (under a minute), "5 min ago", "3 h ago", "2 days ago", or a date like "12 Oct 2026" after 7 days.

## Checks

- Supabase MCP `list_tables` shows exactly 8 tables in `public`.
- Supabase MCP `list_migrations` shows `0001_schema` to `0005_hardening`.
- Supabase MCP `get_advisors` (security) shows no "RLS disabled" and no "function search path mutable" warnings, and the trigger functions aren't executable by signed-out or signed-in users. One note is expected and intentional: signed-in users can execute `slug_taken`, which only answers whether a slug is used.
- In the SQL editor, `select public.search_skills('');` runs without error.
- `npx tsc --noEmit` passes.
- `git check-ignore supabase/.temp` prints `supabase/.temp`.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 03
- Supabase tables: profiles, organizations, skills, stars, comments, follows, notifications, activities. All have RLS.
- Migration 0005_hardening: session helpers have a fixed search_path; trigger functions aren't callable through the API; slug_taken is callable by signed-in users only.
- RLS reads Clerk's session token: requesting_user_id() = sub, requesting_org_id() = active organization.
- Triggers create activities and notifications and keep skills.stars_count correct. App code never does these.
- search_skills(q, stack_filter) RPC returns up to 30 visible skills, ranked. slug_taken(candidate) checks every slug, including private ones.
- lib/supabase/types.ts is generated (npm run db:types). lib/constants.ts, lib/slug.ts, lib/time.ts exist.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 03: database` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `04-seed-data.md`
