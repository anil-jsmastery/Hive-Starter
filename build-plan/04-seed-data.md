# Step 04: Seed data

| | |
| --- | --- |
| What you'll learn | Never launch to an empty shelf |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 03 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** 8 authors and 30 real skills, identical for everyone. The seed authors exist only in Supabase, not in Clerk, so nobody can sign in as them.

## Files

| File | Contains |
| --- | --- |
| `seed/authors.json` | VERBATIM below |
| `seed/skills/*.md` | Copy all 30 files from `build-plan/seed-skills/` into `seed/skills/`, unchanged. The file name is the slug |
| `seed/seed.ts` | VERBATIM below |

`seed/authors.json`, **VERBATIM**:

```json
[
  { "id": "seed_priya", "handle": "priya", "display_name": "Priya Raman", "stack": "Next.js" },
  { "id": "seed_marco", "handle": "marco", "display_name": "Marco Bellini", "stack": "React" },
  { "id": "seed_lena", "handle": "lena", "display_name": "Lena Hoffmann", "stack": "Python" },
  { "id": "seed_sam", "handle": "sam", "display_name": "Sam Okafor", "stack": "Node.js" },
  { "id": "seed_aisha", "handle": "aisha", "display_name": "Aisha Khan", "stack": "Any" },
  { "id": "seed_tom", "handle": "tom", "display_name": "Tom Varga", "stack": "Go" },
  { "id": "seed_kenji", "handle": "kenji", "display_name": "Kenji Mori", "stack": "Next.js" },
  { "id": "seed_nora", "handle": "nora", "display_name": "Nora Lind", "stack": "Python" }
]
```

**Skill file format** (frontmatter, then the Markdown body, which must be at least 80 characters):

```md
---
title: Next.js auth review
description: Checks a Next.js app for auth mistakes like unprotected routes and leaked tokens.
author: priya
stack: Next.js
tags: [nextjs, auth, security]
stars: 41
---
# Next.js auth review

Use this skill when reviewing authentication in a Next.js app...
```

`seed/seed.ts`, **VERBATIM**:

```ts
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

// The secret key bypasses RLS. Only this script and the webhook route may use it.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

type Author = { id: string; handle: string; display_name: string; stack: string };

function parse(file: string) {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No frontmatter in ${file}`);
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const tags = (meta.tags ?? '').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  return { meta, tags, content: match[2].trim() };
}

function must(result: { error: unknown }) {
  if (result.error) throw result.error;
}

async function main() {
  // 1. Reset the shelf. Real users' profiles stay; seed authors are recreated.
  for (const table of ['activities', 'notifications', 'follows', 'comments', 'stars', 'skills']) {
    must(await db.from(table).delete().not('created_at', 'is', null));
  }
  must(await db.from('profiles').delete().like('id', 'seed_%'));

  // 2. Authors
  const authors: Author[] = JSON.parse(readFileSync('seed/authors.json', 'utf8'));
  must(await db.from('profiles').insert(authors));

  // 3. Skills in file-name order. Skill i was published (i * 7 + 3) hours ago.
  //    The skills trigger creates one "published" activity per skill with the same time.
  const dir = 'seed/skills';
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const now = Date.now();
  const rows = files.map((file, i) => {
    const { meta, tags, content } = parse(join(dir, file));
    const author = authors.find((a) => a.handle === meta.author);
    if (!author) throw new Error(`Unknown author "${meta.author}" in ${file}`);
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title,
      description: meta.description,
      content,
      tags,
      stack: meta.stack,
      visibility: 'public',
      author_id: author.id,
      stars_count: Number(meta.stars ?? 0),
      created_at: new Date(now - (i * 7 + 3) * 3_600_000).toISOString(),
    };
  });
  must(await db.from('skills').insert(rows));

  console.log(`Seeded ${authors.length} authors and ${rows.length} skills.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add `"db:seed": "tsx seed/seed.ts"` to `package.json` scripts.

## Checks

- `seed/skills/` holds the same 30 files as `build-plan/seed-skills/` (`diff -r build-plan/seed-skills seed/skills` prints nothing).
- `npm run db:seed` prints `Seeded 8 authors and 30 skills.`
- Running it twice in a row still gives exactly 30 skills and 30 activities (check with Supabase MCP `execute_sql`: `select count(*) from skills;` and `select count(*) from activities;`).

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 04
- seed/skills/ holds the 30 skill files copied from build-plan/seed-skills/.
- npm run db:seed resets all skills, stars, comments, follows, notifications and activities, then loads 8 seed authors (ids start with seed_) and 30 public skills.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 04: seed data` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `05-posthog-foundation.md`
