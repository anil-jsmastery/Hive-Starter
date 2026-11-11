# Hive design system: Hive Night

Every page and component follows this file. **The visual source of truth is `build-plan/design/hive-night.html`**, a static prototype from our designer: open it in a browser to see every page. Hive must look exactly like it: same layout, colors, type, spacing and animation. The prototype's data, routing and sign-in are fake; the app's real logic, data, events and routes come from the step files and never change for design reasons.

Don't use design skills or plugins (such as frontend-design) to make visual choices: the designer has made them already (AGENTS.md rule 14).

If a step and this file disagree about how something **looks**, this file wins. If they disagree about what something **does** (data, events, labels the code depends on, routes), the step wins.

## Direction

Night in the hive: a warm, near-black background, one ember-amber accent that glows, and honeycomb cells that light up like windows at night. Dark theme only. Glow is used for focus and for things that are alive (the live dot, lit cells, the primary button, stars on hover), never as decoration on text.

## The CSS (two files)

1. **`app/hive-night.css`:** the design file's entire `<style>` block, copied **unchanged** (everything between `<style>` and `</style>` in `build-plan/design/hive-night.html`). It defines every class this file names. Never edit it; add or override in the second file.
2. **`app/hive-night-app.css`:** the integration rules below, **VERBATIM**.

Both are imported in `app/globals.css` right after `@import "tailwindcss";` (see Step 02). Imported this way they sit outside Tailwind's layers, so they win over Tailwind's base styles.

`app/hive-night-app.css`, **VERBATIM**:

```css
/* Hive Night: integration rules for the Next.js app. The design file's own CSS
   lives in app/hive-night.css, copied unchanged. */
:root {
  --sans: var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
body { font-family: var(--sans); }
code, kbd, pre, samp { font-family: var(--mono); }

/* Activity feed: forks get their own marker color */
.dot.forked { color: var(--ember-soft); filter: drop-shadow(0 0 4px rgba(255,199,104,.6)); }

/* Header: unread count next to "Dashboard" */
.dash-link .new-count { margin-left: 6px; vertical-align: 1px; }

/* Toasts (sonner), styled like the design's .toast */
[data-sonner-toast].hive-toast {
  background: #241D14; color: var(--text);
  border: 1px solid rgba(246,166,35,.35); border-radius: 12px; padding: 11px 18px;
  font-family: var(--sans); font-size: 14px; font-weight: 500;
  box-shadow: 0 20px 40px -16px rgba(0,0,0,.9), 0 0 24px -8px rgba(246,166,35,.5);
}
[data-sonner-toast].hive-toast [data-description] { font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
[data-sonner-toast].hive-toast [data-icon] { color: var(--ember); }

/* Form-level error, at the top of a form */
.form-alert {
  border: 1px solid rgba(229,103,75,.55); background: rgba(229,103,75,.08); color: #F08A70;
  border-radius: 12px; padding: 12px 14px; font-size: 14px;
}

/* Dialogs (the paywall), styled like the design's sign-in card */
.hive-dialog {
  background: #1E1811 !important; border: 1px solid var(--line-2) !important; border-radius: 16px !important;
  color: var(--text);
  box-shadow: 0 40px 90px -30px rgba(0,0,0,.95), 0 0 0 1px rgba(246,166,35,.05) !important;
}
.hive-dialog::before {
  content: ""; position: absolute; top: 0; left: 32px; right: 32px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,199,104,.85), transparent);
}

/* Clerk components */
.hive-clerk-card {
  position: relative; border: 1px solid var(--line-2); background: rgba(20,16,11,.82);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border-radius: 16px;
  box-shadow: 0 40px 90px -30px rgba(0,0,0,.95), 0 0 0 1px rgba(246,166,35,.05);
}
.hive-clerk-card::before {
  content: ""; position: absolute; top: 0; left: 32px; right: 32px; height: 1px; z-index: 1;
  background: linear-gradient(90deg, transparent, rgba(255,199,104,.85), transparent);
}
.hive-clerk-primary {
  background: var(--ember) !important; color: #1E1406 !important;
  box-shadow: 0 0 0 1px rgba(255,199,104,.6), 0 8px 28px -10px rgba(246,166,35,.7) !important;
}
.hive-clerk-avatar { box-shadow: 0 0 0 2px rgba(246,166,35,.25); transition: box-shadow .2s; }
.hive-clerk-avatar:hover { box-shadow: 0 0 0 2px rgba(246,166,35,.6), 0 0 16px -2px rgba(246,166,35,.6); }

/* The design's sign-in mock reuses Clerk's class names (.cl-card, .cl-main,
   .cl-footer). Inside Clerk's real components the card look lives on
   .hive-clerk-card instead, so undo the mock's box styles there. */
.cl-rootBox .cl-card { border: 0; border-radius: 0; box-shadow: none; background: transparent; overflow: visible; }
.cl-rootBox .cl-main { padding: 0; background: none; border-bottom: 0; }
.cl-rootBox .cl-footer { background: rgba(255,255,255,.02); }

/* Profile and team headers reuse the skill header look */
.p-av { width: 78px; height: 78px; border-radius: 22px; font-size: 30px; }
.p-counts { display: flex; gap: 16px; margin-top: 14px; font-size: 14px; color: var(--muted); }
.p-counts b { color: var(--text); font-variant-numeric: tabular-nums; }

/* Dashboard notifications: each row is a form button */
.dash .notes li.note-li { display: block; padding: 0; }
.note-btn {
  display: grid; grid-template-columns: 36px minmax(0,1fr); gap: 12px; align-items: start;
  width: 100%; padding: 14px 0; background: none; border: 0; text-align: left; cursor: pointer; color: inherit;
}
.note-btn:hover .note-text b { color: var(--ember-soft); }
.dash .notes li:not(.unread) .note-btn .note-text { color: #8C8170; }

/* Paywall dialog (Step 16): one centred column, like the design's sign-in card.
   It positions and sizes itself completely, so shadcn DialogContent's own
   width, grid and transform classes can't push it off a small screen. */
.hive-dialog.paywall {
  position: fixed !important; left: 50% !important; top: 50% !important;
  transform: translate(-50%, -50%) !important; margin: 0 !important;
  box-sizing: border-box !important;
  width: calc(100vw - 32px) !important; max-width: 420px !important;
  max-height: calc(100dvh - 32px) !important; overflow-y: auto;
  display: flex !important; flex-direction: column; gap: 20px;
  padding: 32px 24px 24px !important;
}
.paywall-head { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.paywall-icon {
  width: 44px; height: 44px; margin-bottom: 4px; border-radius: 12px; display: grid; place-items: center;
  color: var(--ember); background: rgba(246,166,35,.1); box-shadow: inset 0 0 0 1px rgba(246,166,35,.3);
}
.paywall-icon svg { width: 20px; height: 20px; }
.paywall-title { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -.01em; color: var(--text); overflow-wrap: anywhere; }
.paywall-sub { margin: 0; max-width: 32ch; font-size: 14.5px; line-height: 1.5; color: var(--muted); }
.paywall-plan {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px;
  padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(246,166,35,.35); background: rgba(246,166,35,.06);
}
.paywall-plan-name { font-weight: 600; color: var(--ember-soft); }
.paywall-plan-price { font-size: 14px; color: var(--muted); white-space: nowrap; }
.paywall-plan-price b { margin-right: 2px; font-size: 18px; font-weight: 600; color: var(--text); }
.paywall-actions { display: flex; flex-direction: column; gap: 10px; }
.paywall-actions .btn-ember, .paywall-actions .btn-ghost {
  width: 100%; height: 44px; padding: 0 18px; border-radius: 12px; font-size: 15px; justify-content: center;
  text-align: center;
}
@media (max-width: 360px) {
  .hive-dialog.paywall { padding: 28px 18px 18px !important; gap: 16px; }
  .paywall-title { font-size: 18px; }
}

/* Responsive guards for things the design file doesn't cover (DESIGN.md › Responsive) */
img, video { max-width: 100%; height: auto; }
.md { overflow-wrap: anywhere; }
.md pre {
  max-width: 100%; overflow-x: auto; margin: 16px 0; padding: 14px 16px; border-radius: 10px;
  background: rgba(255,255,255,.03); border: 1px solid var(--line); font-size: 13px; line-height: 1.55;
}
.md pre code { background: none; padding: 0; color: var(--text); font-size: inherit; overflow-wrap: normal; }
.md table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 16px 0; }
.md th, .md td { padding: 6px 10px; border: 1px solid var(--line); text-align: left; }
.cl-rootBox, .cl-cardBox { max-width: calc(100vw - 32px); }
[data-sonner-toast].hive-toast { max-width: calc(100vw - 32px); }
.p-counts { flex-wrap: wrap; }
.bar-right .org { min-width: 0; max-width: 40vw; overflow: hidden; }
.bar-right .org * { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Header: the account controls never cover the links (DESIGN.md › Responsive).
   Up to 900px the team switcher shows only its avatar (Clerk uses organization- or
   user-preview classes for its label, depending on what's selected). Up to 700px the
   header is two rows: logo and account controls, then the four links. */
@media (max-width: 900px) {
  .bar-right [class*="PreviewTextContainer"],
  .bar-right [class*="PreviewMainIdentifier"] { display: none; }
}
@media (max-width: 700px) {
  .bar-inner { height: auto; flex-wrap: wrap; row-gap: 0; padding-top: 10px; }
  .bar-inner > .logo { order: 1; }
  .bar-inner > .bar-right { order: 2; margin-left: auto; }
  .bar-inner > .nav-links {
    order: 3; width: 100%; height: 44px; align-items: center; justify-content: space-between;
    overflow-x: auto; scrollbar-width: none;
  }
  .bar-inner > .nav-links::-webkit-scrollbar { display: none; }
  .nav-links a[aria-current="page"]::after { bottom: -12px; }
}

/* Signed-out prompt under comments */
.c-signin { margin-top: 20px; font-size: 14px; color: var(--muted); }
.c-signin a { color: var(--ember-soft); font-weight: 500; }
```

## Tailwind's role

Tailwind stays installed: `create-next-app` and shadcn set it up, and its base reset, shadcn's `Dialog` and `sonner`, and Clerk's shadcn theme rely on it. But Hive's look comes from the design's classes, not from Tailwind utilities:

- **Style with the design's classes first** (`btn-ember`, `skill`, `field`, `chip`, `panel`, `hero` and the rest in `hive-night.css`).
- **Tailwind utilities only for small layout glue** the design has no class for: spacing, gaps and alignment (for example `mt-4 flex justify-center`).
- **Never use Tailwind for colors, fonts, font sizes, borders, radii or shadows.** Those come from the design CSS, and Tailwind values would drift from the designer's.
- Anything a page needs that neither covers goes in `app/hive-night-app.css` as a named class, never inline styles.

## Color tokens

The design's own colors live in `hive-night.css` (`--night`, `--line`, `--line-2`, `--ember`, `--ember-soft`, `--text`, `--muted`, `--cool`). shadcn and Clerk's shadcn theme read their own tokens, so those are mapped onto the same palette in `app/globals.css` `:root`, **VERBATIM** (Step 02 replaces shadcn's `:root` values with these and deletes the `.dark` block).

**There is no shadcn `--muted` token.** The design already uses `--muted` as its secondary **text** color (`#A99D8A`), and shadcn's `--muted` is a background color with the same name. `app/globals.css` loads last, so a shadcn `--muted` would win and turn all secondary text nearly invisible. Delete shadcn's `--muted` line wherever `shadcn init` generated one. Nothing in Hive uses it: shadcn's Dialog and sonner only read `--muted-foreground`, Clerk's shadcn theme doesn't read it, and Tailwind color classes such as `bg-muted` aren't used (see Tailwind's role).

```css
:root {
  --radius: 0.75rem;
  --background: #14100B;
  --foreground: #F4ECDD;
  --card: #1C1710;
  --card-foreground: #F4ECDD;
  --popover: #1E1811;
  --popover-foreground: #F4ECDD;
  --primary: #F6A623;
  --primary-foreground: #1E1406;
  --secondary: #241D14;
  --secondary-foreground: #F4ECDD;
  --muted-foreground: #A99D8A;
  --accent: #2A2117;
  --accent-foreground: #FFC768;
  --destructive: #E5674B;
  --border: #2F271C;
  --input: #3B3124;
  --ring: #F6A623;
}
```

| Color | Hex | Used for |
| --- | --- | --- |
| Night | `#14100B` | Page background |
| Ember | `#F6A623` | Primary buttons, active chips and tabs, lit cells, stars, the live dot, unread markers |
| Ember soft | `#FFC768` | Links on dark, the stack badge, code |
| Text | `#F4ECDD` | Headings and primary text |
| Muted | `#A99D8A` | Secondary text, timestamps, help text |
| Cool | `#8FA3B8` | Comment markers |
| Lines | `#2F271C`, `#3B3124` | Borders and dividers |
| Errors | `#E5674B` (border), `#F08A70` (text) | Field and form errors only |

## Typography

Geist and Geist Mono, from `next/font/google` (`Geist` and `Geist_Mono`, which `create-next-app` already sets up), with the variables `--font-geist-sans` and `--font-geist-mono`. `hive-night-app.css` points the design's `--sans` and `--mono` at them.

| Style | Class (from the design) |
| --- | --- |
| Hero heading | `.hero h1` |
| Page title | `.page-title` |
| Skill title | `.d-title` |
| Section heading | `.section-head h2`, `.panel-head h2`, `.comments > h2` |
| Lead text | `.lead`, `.d-desc`, `.dash-sub`, `.pricing .sub` |
| Handles, file names, tags, commands | Geist Mono (`.author`, `.tag`, `.editor-file`, `.doc-bar`, `code`) |

## Layout

- **Shell:** `<body>` holds `<GlowDefs />`, `<SiteHeader />`, `<main className="app">`, `<SiteFooter />` and the `<Toaster />`. `body` is a column (from the design CSS), so the footer stays at the bottom.
- **Header:** `.site-header` > `.bar-inner` (sticky, 68px, blurred night background): `.logo` on the left, `.nav-links` in the middle, `.bar-right` on the right. The current page's link gets `aria-current="page"`, which draws the glowing ember underline.
- **Inner pages:** `<PageShell>` (a `.page` section with the `.glow` and a `.wrap` container, max 1160px). The home page uses `.hero` instead, and sign-in and sign-up use `.page.signin-page` with a `.center` wrapper.
- **Honeycomb backgrounds:** `<Honeycomb fx={0.7} fy={0.45} />` on the home hero; `<Honeycomb fx={0.5} fy={0.5} max={0.22} seed={29} />` on sign-in and sign-up.
- **Breakpoints:** exactly the design's media queries (900px, 820px, 760px, 640px, 560px and 480px), which come with `hive-night.css`.

## Components

Native elements with the design's classes, not shadcn's styled components. shadcn stays only for `Dialog` (the paywall) and `sonner` (toasts).

| Need | Markup |
| --- | --- |
| Primary button or link | `className="btn-ember"`, plus the page-specific class from the design (`.cta`, `.d-install`, `.p-submit`, `.dash-cta`, `.cl-primary`), or inside a container the design sizes (`.field`, `.d-actions`, `.c-row`). `.btn-ember` sets colour and glow only, **no size**: a `btn-ember` anywhere else needs its height, padding and radius in `hive-night-app.css` (like the paywall's) |
| Secondary button | `className="btn-ghost"`. Pressed state with `aria-pressed="true"` (the star button) |
| Icon-only button | `className="btn-ghost icon-btn"` with an `aria-label` |
| Small text action | `className="link-btn"` |
| Text input | `className="inp"` |
| Textarea | `className="inp"` (comments) or `className="code"` inside `.editor` (skill content) |
| Select | a native `<select className="inp">` |
| Radio cards | `.vis` > `label.vis-opt` with a native `<input type="radio">`, `.radio`, `.vis-title`, `.vis-sub` |
| Field wrapper | `.fld` with `<label>`, the control, `.hint` and `.err-msg`. Add `err` to `.fld` to show the error |
| Segmented tabs | `.cl-switch` with `<button role="tab" aria-selected>` (Write/Preview, For you/For teams, Your skills/Forks/Team) |
| Filter chips | `.chips` > `.chip` with `aria-pressed` (links, because the URL is the state) |
| Search field | `.search` > `.field` (icon, input, `btn-ember` "Search") |
| Skill card | `.skill` (see SkillCard below) |
| Skill emblem | `<SkillGlyph>` inside `span.glyph` (`.glyph.sm`, `.glyph.xs`, `.glyph.lg` sizes) |
| Stack badge | `span.fw` |
| Tag | `span.tag` |
| Private badge | `span.priv` with the lock icon from the design and the text "Private" |
| Team badge | `span.tag` with the team name |
| Stars | `span.stars` with the design's star icon and the count |
| Avatar | `<AvatarInitial handle>` (`.av`), or Clerk's `<UserButton>` in the header (inside the client component `<UserMenu>`, Step 06) |
| Empty state | `<EmptyState>` (`.empty`, `.empty.small`) |
| Count pill | `span.new-count` ("2 new"), `span.c-count` |
| Card panel | `.panel` with `.panel-head`, `.side-card`, `.stat`, `.doc` |
| Toast | `sonner` with the `hive-toast` class (see Step 02) |
| Form error | `div.form-alert` with `role="alert"` |
| Icons | the design's inline SVGs (star, fork, link, install, back, check, lock, plus, chevron). Use lucide only where the design has no icon |

**SkillCard** (`.skill`, the whole card is one link to `/s/[slug]`): `.skill-top` with `span.glyph` + `SkillGlyph` and `.skill-name` (`h2` title, `.author` "@{handle}", or "forked from @{handle}" for a fork); then the description `p`; then `.meta` with the stack `.fw`, the team badge, the private badge, the tags and `.stars` on the right. Hover and focus lift the card, light its emblem and fill the star, all from the design CSS.

## Responsive

Every page and dialog must work from a 320px phone to a wide desktop. The design CSS already handles the page layouts, with breakpoints at 1060, 960, 900, 820, 760, 640, 560 and 480px: two-column pages stack, grids drop columns, the header shrinks. The responsive guards in `hive-night-app.css` cover what the design file doesn't show: code blocks, tables and images inside skill content, Clerk's card and team switcher, toasts, profile counts, and the paywall.

**Rules for anything new** (a component, a dialog, a style in `hive-night-app.css`):

- Never fixed widths wider than the screen: use `max-width: 100%`, or `calc(100vw - 32px)` for overlays.
- Flex and grid children that hold text get `min-width: 0`, so they can shrink. Long text wraps (`overflow-wrap: anywhere`) or ends in an ellipsis.
- Wide content (code, tables) scrolls inside its own box (`overflow-x: auto`), never the whole page.
- A dialog or overlay positions and sizes itself (`position: fixed`, centred with `transform`, `width: calc(100vw - 32px)`, a `max-width`, and `max-height: calc(100dvh - 32px)` with `overflow-y: auto`), like the paywall, instead of relying on a library's classes.
- Buttons and tappable rows stay at least 40px tall on phones.
- Nothing in the header may cover the links. Up to 900px Clerk's team switcher shows only its avatar, and up to 700px the header is two rows (logo and account controls, then the links). Clerk's components are positioned, so if they overflow they paint *over* the links rather than under them.

**The check, for every page and dialog:** at **320px, 390px, 768px and 1280px** wide, `document.documentElement.scrollWidth <= window.innerWidth` (no sideways scroll), and nothing is cut off or overlapping. Look at least at 390px and 1280px yourself, next to the same view in `design/hive-night.html`.

## Motion

All motion comes from `hive-night.css` and respects `prefers-reduced-motion` (its last media query turns animation off).

| Animation | Where | How |
| --- | --- | --- |
| Lit honeycomb cells fade in, nearest the focus point first | Home hero, sign-in, sign-up | `.cell.lit` with `--o` (brightness) and `--d` (delay), from `<Honeycomb>` |
| Feed rows rise in one by one | Home, first load | `li.intro` with `--i` |
| New feed rows slide in, sweep and pop | Home, when a refresh brings a new row | `li.enter.fresh` (`<ActivityFeed>`, Step 07) |
| Live dot breathes, and pings on a new row | Home | `.live`, `.live.ping` |
| One lit cell flares on a new row | Home | `.cell.lit.flare` |
| Card lift, emblem lights up, star fills | Every skill card and row | `.skill:hover`, `.srow:hover` |
| Logo glows and turns 60° on hover | Header | `.logo:hover svg` |
| Primary button glows on hover | Everywhere | `.btn-ember:hover` |
| Toasts slide up at the bottom center | Everywhere | `sonner`'s own enter animation, styled as the design's `.toast` (`hive-toast`) |
| Hero lead keeps the heading's width | Home | `<FitLead>` (the design's `fitLead`) |

## Clerk components

- `ClerkProvider` appearance, **VERBATIM**: `appearance={{ theme: shadcn, elements: { cardBox: 'hive-clerk-card', formButtonPrimary: 'hive-clerk-primary', userButtonAvatarBox: 'hive-clerk-avatar' } }}`. The shadcn theme reads the dark tokens above, so every Clerk component is dark and ember automatically. If an element key doesn't exist in the pinned Clerk version, look up the matching key with the Clerk MCP docs.
- The design's `cl-*` rules copy Clerk's own class names (Clerk adds a `cl-<element>` class to each element). The form rules (`.cl-form` inputs and labels) are meant to style Clerk's sign-in form; the box rules are undone inside Clerk by `hive-night-app.css`, so Clerk's layout stays intact while its card gets the design's look.
- Clerk components used: `<SignIn />`, `<SignUp />`, `<UserButton />`, `<OrganizationSwitcher />`, `<PricingTable />`, `<Show>`, `<SignInButton>`. No others.
- The OrganizationSwitcher trigger should look like the design's `.org` button (muted text, the `.org-av` gradient square): pass `organizationSwitcherTrigger: 'org'` in its own `appearance.elements`.

## States

| State | Pattern |
| --- | --- |
| Empty | `EmptyState` with the exact text from the step |
| Loading | No spinners in lists. Buttons show their pending label (for example "Publishing…") and are disabled |
| Field error | `.fld.err` with the message in `.err-msg` |
| Form error | `div.form-alert` at the top of the form |
| Not found | `app/not-found.tsx` (Step 02) |

## UI text rules

- Sentence case everywhere: "Publish a skill", not "Publish A Skill".
- Buttons say what they do: "Publish skill", "Post comment", "See plans".
- Use the typographic apostrophe (’) and curly quotes (“ ”) in UI text.
- Never use a middle dot (·) to join metadata. Use separate elements. The only exception is the browser tab title.
- No exclamation marks, except the publish success toast "Published".
- Toast texts, button labels and `aria-label`s named in the steps stay exactly as written: the swarm and the checks depend on them.

## Accessibility

- Every input has a visible label. Icon-only buttons have an `aria-label` matching the text they replace.
- The ember focus ring (`:focus-visible` in the design CSS) stays visible on every focusable element.
- Text contrast meets WCAG AA. Text on ember is always `#1E1406`.
