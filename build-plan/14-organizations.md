# Step 14: Organizations (teams)

| | |
| --- | --- |
| What you'll learn | B2B analytics: measure teams, not just people |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 13 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** Clerk organizations as Hive teams: switch teams, publish as a team, a public team page, and every team action attached to the team in PostHog.

## Dashboard checklist (Clerk)

Do this at the start of this step, not earlier: until now Hive has been for individuals only.

1. **Organizations → Settings → Enable organizations.** In the dialog, choose **Membership optional** (this keeps **personal accounts**), then enable. Don't keep the default, Membership required: it sends every signed-in user through a "choose an organization" screen before they can use Hive, which would break sign-up for individuals and the swarm.
2. Then, on the same settings page:

   | Setting | Value | Why |
   | --- | --- | --- |
   | Allow personal accounts | **On** | People use Hive on their own as well as in teams |
   | Organization slugs | **On** (off by default in new applications) | Team pages live at `/o/[slug]` |
   | Allow user-created organizations | **On** (the default) | Any user can create a team from the switcher |
   | Organization creation limit, default membership limit | Defaults | Not used by Hive |
   | Verified domains | **Off** | Not used by Hive |
   | Allow new members to delete organizations | Default | Not used by Hive |
   | Roles & Permissions | Defaults (`admin`, `member`) | Hive doesn't check roles |

3. Check: as a signed-in user, the header's organization switcher shows your personal account and "Create organization", and signing in doesn't ask you to pick an organization.

## Files

| File | Change |
| --- | --- |
| `components/site-header.tsx` | Signed in: in `.bar-right`, add `<OrganizationSwitcher hidePersonal={false} afterCreateOrganizationUrl="/dashboard" afterSelectOrganizationUrl="/dashboard" afterSelectPersonalUrl="/dashboard" appearance={{ elements: { organizationSwitcherTrigger: 'org' } }} />` before `<UserMenu>`, with a 16px gap |
| `app/o/[slug]/page.tsx` | New: the team page (spec below) |
| `components/publish/publish-form.tsx` | Add "Publish as" (spec below) |
| `app/publish/page.tsx` | Pass the active team's name to the form: `const org = await ensureOrganization()` |
| `app/dashboard/page.tsx` | When a team is active, call `ensureOrganization()` and add the "Team skills" section |

**`/o/[slug]` page:** load `organizations` by `slug`; `notFound()` if missing.

- **Look:** the skill view's header pattern, inside `<PageShell>`: `header.d-top` > `.d-head` with `<span className="org-av p-av">` (the team's first letter on the ember gradient), then `.d-intro` with `h1.d-title` (team name) and `.d-by` holding `span.tag` "Team".
- **Team skills:** `section.section` with `.section-head h2` "Team skills", then a `.grid` of `SkillCard`s for skills where `org_id` = the team's id, newest first. RLS shows private team skills only to members with this team active.
- Empty: `EmptyState` with title "No team skills yet" and body "Skills published for {team name} show up here."

**"Publish as"** (only rendered when a team is active), placed directly after the Title field: a `.fld` with a native `<select className="inp" name="owner">` (controlled by React state, as Step 11 describes), label "Publish as", options "Personal (@{handle})" with value `personal` and "{team name}" with value `team`. Default `personal`. Help text: "Team skills show your team’s name and live on its team page."

**Dashboard "Team" tab** (only when a team is active): a third tab in the dashboard panel's `.cl-switch`, after "Forks": "Team: {team name}" with its `span.tab-n` count, listing that team's skills as rows (the same row as Step 13). Empty: `li.srows-empty` with `<strong>` "No team skills yet" and "Publish a skill as your team to see it here." plus a link "Publish a skill" to `/publish`.

**Analytics:** nothing new to write. `AnalyticsIdentity` already calls `posthog.group('organization', …)`, server actions already pass `orgId`, and `ensureOrganization()` already calls `identifyOrganization()`. Group analytics may be a paid PostHog add-on; check your project. The group is recorded on events either way.

## Checks

- Signed in with the switcher showing (your personal account or a team), every header link (Explore, Pricing, Publish, Dashboard) can be clicked at 320px, 390px, 768px and 1280px wide: up to 700px the header is two rows, and up to 900px the switcher shows only its avatar.
- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- Create a team "Acme Labs" from the switcher. You land on `/dashboard`, where the panel has a "Team: Acme Labs" tab.
- Publish a skill with "Publish as: Acme Labs". `skill_published` has `owner: team` and `$groups.organization` set. The skill shows the team badge and appears on `/o/acme-labs`.
- Supabase `organizations` has one row for Acme Labs.
- Switch to your personal account: the dashboard has no team section.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 14
- Clerk organizations are Hive teams. OrganizationSwitcher in the header (personal accounts allowed, slugs on).
- /o/[slug] team page (skill-view header pattern). Publish as personal or team (native owner select). Dashboard panel gets a "Team: {name}" tab when a team is active.
- Team actions carry the PostHog organization group (client group + server orgId + identifyOrganization).
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 14: organizations` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `15-deploy-and-settings.md`
