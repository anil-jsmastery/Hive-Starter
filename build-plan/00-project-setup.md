# Step 00: Project setup, memory, MCP servers and skills

| | |
| --- | --- |
| Starts from | nothing (see "Before you start") |
| What you'll learn | Set up a project everyone can reproduce exactly |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Follow `build-plan/START_HERE.md`: the `hive` folder holds only `build-plan/` and `.claude/` (`settings.json` and `commands/step.md`), and Claude Code is open in it.

**Goal:** Claude Code turns a folder that holds only `build-plan/` and `.claude/` into an empty Next.js app with pinned packages, the project memory files, the three MCP servers and the agent skills. You only step in for the two things an agent can't do: logging in to PostHog and approving the MCP servers.

**Starting state** (from `START_HERE.md`): the `hive` folder contains only `build-plan/` and `.claude/` (`settings.json` and `commands/step.md`). Claude Code is updated (`claude update`, v2.1.280 or later) and open in this folder.

## 1. Create the app

`create-next-app` refuses to run in a folder that already has files, so create it in a temporary subfolder and move it up:

```bash
npx create-next-app@latest app-tmp --ts --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Move everything from `app-tmp/` into this folder, **including dotfiles and `.git`**, then delete `app-tmp/`. Set `"name": "hive"` in `package.json`. Keep the `AGENTS.md` that `create-next-app` wrote (its Next.js block stays; see step 4). If it also wrote a `CLAUDE.md`, replace that file with ours in step 4.

**Replace `next.config.ts`.** Next.js 16's `create-next-app` turns on Cache Components and partial prefetching. Every Hive page is rendered per user (it reads the Clerk session, and every Supabase query carries the user's token), and later steps rely on classic dynamic rendering. Replace the whole file, **VERBATIM**. It keeps the two things `create-next-app` set up that the project needs: the React Compiler, and the Turbopack rule that runs Tailwind on CSS files (there's no `postcss.config` file).

```ts
import type { NextConfig } from 'next';

// Hive renders every page per user (Clerk session + Supabase RLS), so it uses
// classic dynamic rendering: Cache Components and partial prefetching stay off.
const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
```

## 2. Pin everything

`.npmrc`, **VERBATIM**:

```text
save-exact=true
```

`.nvmrc`: the Node major version on this machine (`node -v`), for example `24`.

```bash
npm install @clerk/nextjs @clerk/ui @supabase/supabase-js posthog-js posthog-node zod react-markdown remark-gfm server-only
npm install -D @tailwindcss/typography tsx dotenv supabase
npx shadcn@4.22.1 init -b radix --preset bIkeymG -y
npx shadcn@4.22.1 add button input textarea label card badge tabs select radio-group dropdown-menu avatar separator dialog alert sonner -y
```

`create-next-app` wrote its own dependencies with `^`, and `.npmrc` only affects new installs. Replace every `^` and `~` in `package.json` with the version actually installed (`npm ls --depth=0`), then run `npm install` so `package-lock.json` matches.

`.claude/commands/step.md` is also already in place: it's the `/step` command (see `START_HERE.md`). Don't change it.

`.claude/settings.json` is already in place, **VERBATIM**. Don't change it:

```json
{
  "model": "claude-opus-5-5",
  "effortLevel": "medium",
  "ultracode": false
}
```

## 3. Install the skills

Run the skill installers non-interactively (check `npx skills add --help` for the exact flags): **project** scope, for **Claude Code, Codex and Cursor**. Install only the skills Hive uses, so the agent isn't distracted by guidance for platforms it never touches:

```bash
npx skills add clerk/skills
npx skills add supabase/agent-skills
```

- **Clerk:** only the skills for Next.js, billing, organizations, custom sign-in flows and the Clerk CLI. List the available names first (`npx skills add clerk/skills --list`, or the installer's selection prompt) and pick those whose names mention `nextjs`, `billing`, `organization`, `custom` or `cli`. Skip the rest (Expo, Chrome extension, React Native, Astro and other frameworks).
- **Supabase:** all of its skills (they're all about Postgres, RLS and the Supabase platform Hive uses).
- **PostHog:** these four, installed the same way: `integration-nextjs-app-router`, `feature-flags-nextjs`, `error-tracking-nextjs` and `audit-events`. (`identify-users` currently fails with "has no downloadable archive"; leave it out.)

Skills land in `.agents/skills/`, linked from `.claude/skills/`. **They're not committed:** they're reading material for the agent, never part of the app, and every person building Hive installs them in this step. Add these two lines to `.gitignore`, **VERBATIM**:

```text
.agents/
.claude/skills/
```

**Stop here and ask the user** to run the PostHog CLI installer in their own terminal, because it needs a login:

```bash
npx -y @posthog/wizard@latest cli add     # choose Claude Code when asked
```

It installs the PostHog CLI on the user's machine and writes a `<posthog>` block into their **global** `~/.claude/CLAUDE.md`. When the user says it's done, copy that `<posthog>` block unchanged into the bottom of `AGENTS.md` (step 4).

The login can pick any PostHog project for now: Hive's own project is created in Step 05, and Step 05 logs the CLI in to it.

## 4. Project memory files

`.env.example`: the environment variable block from `build-plan/CONTRACT.md`, **VERBATIM**. `create-next-app`'s `.gitignore` ignores `.env*`, so add the line `!.env.example` directly below `.env*`. The example file is committed; `.env.local` stays ignored.

`CLAUDE.md`, **VERBATIM** (Claude Code loads this automatically in every session):

```text
@AGENTS.md
@MEMORY.md
@build-plan/CONTRACT.md
@build-plan/DESIGN.md
```

`AGENTS.md`: our rules below, **VERBATIM**, at the top; then the Next.js block `create-next-app` wrote; then the `<posthog>` block, both unchanged:

```md
# Rules for coding agents working on Hive

1. Before any step, read build-plan/CONTRACT.md, build-plan/DESIGN.md and MEMORY.md.
   Implement only the step file you are asked for, from build-plan/.
2. Never add, remove or upgrade packages unless the step says so.
3. Copy every block marked VERBATIM exactly. Do not rename, reformat or "improve" it.
4. Use the exact file paths, component names, labels, button text, toasts, error
   messages, SQL, event names and property names in the step.
5. Do not add pages, features, events, analytics calls, colors or components that
   the step and DESIGN.md don't list.
6. All analytics go through lib/analytics/. Only lib/analytics/,
   components/analytics/ and instrumentation-client.ts may import posthog-js or
   posthog-node. Never send emails or passwords to PostHog.
7. Server Components never send analytics events, because Next.js prefetching would
   fire them without a real visit. The one exception is user_signed_up, sent only
   when a profile row is actually created. Views are tracked on the client.
   Actions are tracked in Server Actions or the webhook route.
8. App code reads and writes Supabase only through createServerSupabase() in
   lib/supabase/server.ts, so Row Level Security always applies. The secret key is
   used only in seed/seed.ts and app/api/webhooks/clerk/route.ts.
9. MCP servers and skills (Clerk, Supabase, PostHog) are for documentation and for
   the exact actions a step names, such as applying a given migration. If an MCP
   answer or a skill suggests a different approach than a VERBATIM block, the
   VERBATIM block wins. Never run SQL a step didn't give you. Never connect MCP
   servers to a production project.
10. Memory: never create notes, memory files or progress logs. At the end of a
    step, append that step's memory block to MEMORY.md, word for word. Never edit
    earlier blocks.
11. Dashboard work (Clerk, Supabase, PostHog, Vercel), logins and API keys belong
    to the user. When a step needs one, stop, tell the user exactly what to do,
    and wait for them to confirm. Never ask the user to paste a secret key into
    the chat; they put keys in .env.local themselves. Exception: when a step says
    the agent applies settings through an official CLI or API, do a dry run
    first, show the user exactly what will change, and apply only after they
    agree.
12. If something can't work with the pinned versions or the dashboard settings,
    stop and report the problem instead of improvising.
13. When done, run the step's checks and report each one as pass or fail. If every
    check passes, commit everything the step changed (git add -A; secrets and
    generated files are git-ignored) with the message "step NN: <step name>".
    Afterwards, git status must be clean.
14. The look is fixed by build-plan/DESIGN.md and build-plan/design/hive-night.html.
    Don't use design skills or plugins (for example frontend-design) to choose or
    change fonts, colors, layout or animation. Match the design file instead.
```

`MEMORY.md`, **VERBATIM** (starts with only this header; every step appends one block):

```md
# Project memory

What exists in this project right now. Each step appends one block at the end.
Never edit earlier blocks.
```

`.mcp.json`, **VERBATIM**:

```json
{
  "mcpServers": {
    "clerk": {
      "type": "http",
      "url": "https://mcp.clerk.com/mcp"
    },
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&features=database,docs,development,debugging"
    },
    "posthog": {
      "type": "http",
      "url": "https://mcp.posthog.com/mcp"
    }
  }
}
```

The Supabase server is scoped to one project, so the agent can never touch another one. `SUPABASE_PROJECT_REF` is set in Step 03.

## 5. Verify a clean install, record versions, commit

1. `rm -rf node_modules && npm ci && npm run build`. This proves a clean install from the lockfile works.
2. Fill in the table below from `npm ls --depth=0` and `claude --version`.
3. Run the checks, then commit (rule 13). The Step 00 commit includes `build-plan/`, `.claude/settings.json` and `.claude/commands/step.md`: the plan, the agent settings and the `/step` command are part of the repo. Only the git-ignored files (`.env.local`, `.agents/`, `.claude/skills/`, `node_modules/`, `.next/`) stay out.

| Package | Version | Package | Version |
| --- | --- | --- | --- |
| node | | @supabase/supabase-js | |
| next | | supabase (CLI) | |
| react / react-dom | | posthog-js | |
| tailwindcss | | posthog-node | |
| @clerk/nextjs | | zod | |
| @clerk/ui | | react-markdown / remark-gfm | |
| shadcn (CLI) | 4.22.1 | @tailwindcss/typography | |
| shadcn preset code | bIkeymG | shadcn base | radix |
| Claude Code | | | |

**After the commit, tell the user** to start a new conversation, approve the three MCP servers Claude Code asks about, and log in to PostHog with `/mcp`. Supabase warns about `SUPABASE_PROJECT_REF` until Step 03.

## Checks

- `npm ci && npm run build` passes from a clean `node_modules`.
- `grep -E '"[\^~]' package.json` prints nothing, and `package.json` has `"name": "hive"`.
- `next.config.ts` matches the VERBATIM block exactly.
- `components.json` exists and says `radix`; `components/ui/` has the 15 components.
- `.agents/skills/` has the chosen Clerk skills, the Supabase skills and the four PostHog skills, linked from `.claude/skills/`, and no Expo or Chrome-extension skills.
- `git check-ignore .agents .claude/skills` lists both: the skills are installed but never committed.
- After the commit, `git ls-files build-plan .claude/settings.json .claude/commands` lists the plan files, the settings and `step.md`, and `git status --short` prints nothing.
- `AGENTS.md` has our rules at the top, then the Next.js block, then the `<posthog>` block.
- `CLAUDE.md`, `MEMORY.md`, `.mcp.json`, `.env.example` and `.claude/settings.json` exist exactly as given.
- `git check-ignore .env.example` prints nothing (it will be committed), and `git check-ignore .env.local` prints `.env.local`.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 00
- Next.js App Router app with Tailwind CSS and shadcn/ui (Radix base, preset bIkeymG). Packages are pinned; install with npm ci only.
- .claude/settings.json pins the coding agent to claude-opus-5-5 at medium effort, ultracode off.
- next.config.ts is fixed (VERBATIM): Cache Components and partial prefetching off, React Compiler on, Tailwind runs through the Turbopack CSS rule (no postcss.config). Pages render dynamically per user.
- Memory: CLAUDE.md imports AGENTS.md, MEMORY.md, build-plan/CONTRACT.md and build-plan/DESIGN.md.
- AGENTS.md: our rules on top (rule 14: no design skills or plugins; the design file decides the look); the Next.js and PostHog blocks below are tool-managed and never edited.
- MCP servers in .mcp.json: clerk, supabase (scoped by SUPABASE_PROJECT_REF), posthog.
- Agent skills in .agents/skills/ (Clerk: Next.js, billing, organizations, custom flows, CLI; Supabase; four PostHog skills). Git-ignored: each person installs them in Step 00.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 00: project setup` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files, plus `MEMORY.md`, should appear.

**Next:** `01-product-docs.md`
