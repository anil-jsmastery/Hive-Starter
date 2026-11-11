# Step 10: Fork and comments

| | |
| --- | --- |
| What you'll learn | Deep engagement, and the notifications that bring people back |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 09 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** forking and comments. Notifications and activity rows are created by the database triggers from Step 03, so the app code stays small.

## Append to `app/s/[slug]/actions.ts`, VERBATIM

```ts
export async function forkSkill(slug: string): Promise<NeedsAuth | Failed | { slug: string }> {
  const { orgId } = await auth();
  const profile = await getCurrentProfile();
  if (!profile) return { needsAuth: true };
  const { supabase, skill } = await visibleSkill(slug);
  if (!skill) return { error: 'Skill not found.' };
  if (skill.visibility === 'private') return { error: 'Private skills can’t be forked.' };

  const forkSlug = await uniqueSlug(
    slugify(`${skill.slug}-${profile.handle}`, 70),
    'fork',
    async (candidate) => (await supabase.rpc('slug_taken', { candidate })).data === true,
  );
  const { error } = await supabase.from('skills').insert({
    slug: forkSlug,
    title: skill.title,
    description: skill.description,
    content: skill.content,
    tags: skill.tags,
    stack: skill.stack,
    visibility: 'public',
    author_id: profile.id,
    forked_from_id: skill.id,
  });
  if (error) return { error: 'Could not fork this skill.' };
  await trackServer(profile.id, 'skill_forked', { slug, fork_slug: forkSlug }, orgId);
  return { slug: forkSlug };
}

export async function postComment(slug: string, body: string): Promise<NeedsAuth | Failed | { ok: true }> {
  const { orgId } = await auth();
  const profile = await getCurrentProfile();
  if (!profile) return { needsAuth: true };
  const text = body.trim();
  if (!text) return { error: 'Write a comment first.' };
  if (text.length > 500) return { error: 'Comments can be at most 500 characters.' };
  const { supabase, skill } = await visibleSkill(slug);
  if (!skill) return { error: 'Skill not found.' };
  const { error } = await supabase.from('comments').insert({ skill_id: skill.id, author_id: profile.id, body: text });
  if (error) return { error: 'Could not post your comment.' };
  await trackServer(profile.id, 'comment_posted', { slug, length: text.length }, orgId);
  revalidatePath(`/s/${slug}`);
  return { ok: true };
}
```

## UI

**Look:** the design file's skill view (the comments under the document).

- **Fork button:** in `.d-actions`, after Star: `button.btn-ghost.icon-btn` with `aria-label="Fork"`, `title="Fork"` and `<ForkIcon />`, public skills only. On success: go to `/s/{slug}` of the fork and toast "Forked to your skills". On error: toast the error text.
- **Comments section** (`components/skill/comments.tsx`, in `.d-main` below the article): `section.comments`.
  - `h2` "Comments" with `span.c-count` holding the count.
  - The list, oldest first. Each comment is a `.c-card`: `<AvatarInitial handle>`, then `.c-head` (`<b>` "@{handle}" linking to `/u/[handle]`, then `timeAgo`) and `p.c-body` with the body as plain text, line breaks kept (`whitespace-pre-line`).
  - No comments yet: `EmptyState` with `small`, title "No comments yet", body "Tried this skill? Share how it went."
  - Signed in (`components/skill/comment-form.tsx`): `form.c-form` with label "Add a comment", `textarea.inp` (3 rows, placeholder "What worked, what didn’t, what you’d add"), and `.c-row` with `button.btn-ember` "Post comment" (pending: "Posting…"). Wrap the textarea in a `.fld`; on an error, add `err` to it so the message shows in `p.err-msg`. On success the textarea clears.
  - Signed out: `p.c-signin` "Sign in to comment." with "Sign in" linking to `/sign-in?redirect_url=/s/{slug}`.
- Comments query: `comments` with `author:profiles!comments_author_id_fkey(handle)`, filtered by `skill_id`, ordered by `created_at` ascending.

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- Forking `nextjs-auth-review` as `ada` creates `nextjs-auth-review-ada`; a second fork gets `nextjs-auth-review-ada-2`.
- The seed author gets one notification per fork or comment (check with Supabase MCP `execute_sql`: `select type, count(*) from notifications group by type;`).
- A 501-character comment shows the error and sends no event.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 10
- forkSkill (public skills only, forks are public and personal, skill_forked) and postComment (1–500 chars, comment_posted) in app/s/[slug]/actions.ts.
- Comments section on the skill page. Notifications and activities for forks and comments come from triggers.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 10: fork comments` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `11-publish.md`
