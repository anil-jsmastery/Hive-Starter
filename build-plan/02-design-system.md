# Step 02: Design system and app shell

| | |
| --- | --- |
| What you'll learn | A small, consistent design system |
| Run it with | The prompt in `build-plan/README.md`, with this file's name |

**Before you start.** Step 01 is committed (`git status` is clean). If this step goes wrong before its commit, discard its changes with `git restore . && git clean -fd -e build-plan` (your plan files are kept) and run it again in a new conversation.

**Goal:** the Hive Night look: the design's CSS, fonts, colors, the shared shell, and the shared visual components, all from `build-plan/DESIGN.md` and `build-plan/design/hive-night.html`.

Open `build-plan/design/hive-night.html` in a browser before you start. It's the designer's static prototype of every page, and it's what Hive must look like.

## Files

| File | Contains |
| --- | --- |
| `app/hive-night.css` | The design file's entire `<style>` block, copied unchanged |
| `app/hive-night-app.css` | The integration rules in DESIGN.md, VERBATIM |
| `app/globals.css` | Keep what `shadcn init` generated. Replace the `:root` values with the tokens in DESIGN.md (VERBATIM), delete shadcn's `--muted` line (the design uses `--muted` for secondary text, see DESIGN.md), delete the `.dark` block, and add the imports below |
| `app/layout.tsx` | Fonts, the shell and the toaster (spec below) |
| `lib/hash.ts` | VERBATIM below |
| `components/hive-mark.tsx` | VERBATIM below |
| `components/night/glow-defs.tsx` | VERBATIM below |
| `components/night/honeycomb.tsx` | VERBATIM below |
| `components/night/skill-glyph.tsx` | VERBATIM below |
| `components/night/avatar-initial.tsx` | VERBATIM below |
| `components/night/page-shell.tsx` | VERBATIM below |
| `components/empty-state.tsx` | VERBATIM below |
| `components/nav-link.tsx` | VERBATIM below |
| `components/night/icons.tsx` | VERBATIM below: the design's inline icons |
| `components/site-header.tsx` | Signed-out version only in this step (Step 06 wires in Clerk) |
| `components/site-footer.tsx` | `<footer className="site-footer"><div className="footer-inner">Hive is a demo app built for a JS Mastery course.</div></footer>` |
| `app/not-found.tsx` | Spec below |

**Copy the design CSS:** take everything between `<style>` and `</style>` in `build-plan/design/hive-night.html` and save it as `app/hive-night.css`, unchanged. Check with `diff`: the file must match that block byte for byte.

**`app/globals.css`:** add these lines, **VERBATIM**, right after the existing `@import "tailwindcss";` line:

```css
@import '@clerk/ui/themes/shadcn.css';
@import './hive-night.css';
@import './hive-night-app.css';
```

**`app/layout.tsx`:** fonts `Geist` (variable `--font-geist-sans`) and `Geist_Mono` (variable `--font-geist-mono`) from `next/font/google`, `subsets: ['latin']`, both variables on `<html lang="en">`. No classes on `<body>`: the design CSS styles it. Inside `<body>`, in order: `<GlowDefs />`, `<SiteHeader />`, `<main className="app">{children}</main>`, `<SiteFooter />`, `<Toaster position="bottom-center" toastOptions={{ className: 'hive-toast' }} />`. Metadata title: "Hive · Skills for AI agents".

`lib/hash.ts`, **VERBATIM**:

```ts
// Small deterministic hash (FNV-1a). The same input gives the same number on
// the server and in every browser, so generated art never mismatches.
export function hashStr(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Park-Miller random numbers from a seed: deterministic, unlike Math.random.
export function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
```

`components/hive-mark.tsx`, **VERBATIM**:

```tsx
export function HiveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M16 2 28.1 9v14L16 30 3.9 23V9z" fill="#F6A623" />
    </svg>
  );
}
```

`components/night/glow-defs.tsx`, **VERBATIM**:

```tsx
// The glow filter the honeycomb cells use. Rendered once, in the root layout.
export function GlowDefs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
```

`components/night/honeycomb.tsx`, **VERBATIM**:

```tsx
import type { CSSProperties } from 'react';
import { seeded } from '@/lib/hash';

type HoneycombProps = { fx: number; fy: number; max?: number; seed?: number };

// Honeycomb background: cells light up like windows at night. A port of drawComb
// in build-plan/design/hive-night.html. Deterministic, so the server and the
// browser draw the same cells.
export function Honeycomb({ fx, fy, max = 0.26, seed = 11 }: HoneycombProps) {
  const W = 1400;
  const H = 760;
  const r = 36;
  const w = Math.sqrt(3) * r;
  const vs = 1.5 * r;
  const focusX = W * fx;
  const focusY = H * fy;
  const ri = r - 3;
  const rand = seeded(seed);
  const cells: { points: string; o?: string; d?: string }[] = [];

  for (let row = -1; row <= Math.ceil(H / vs) + 1; row++) {
    for (let col = -1; col <= Math.ceil(W / w) + 1; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * vs;
      const pts: string[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 90);
        pts.push(`${(cx + ri * Math.cos(a)).toFixed(1)},${(cy + ri * Math.sin(a)).toFixed(1)}`);
      }
      const dist = Math.hypot(cx - focusX, cy - focusY);
      const chance = Math.max(0.04, max - dist / 2600);
      if (rand() < chance) {
        const o = (0.18 + rand() * 0.6).toFixed(2);
        const d = (0.2 + dist / 700 + rand() * 0.3).toFixed(2);
        cells.push({ points: pts.join(' '), o, d });
      } else {
        cells.push({ points: pts.join(' ') });
      }
    }
  }

  return (
    <svg className="comb" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {cells.map((c, i) =>
        c.o ? (
          <polygon key={i} className="cell lit" points={c.points} style={{ '--o': c.o, '--d': `${c.d}s` } as CSSProperties} />
        ) : (
          <polygon key={i} className="cell" points={c.points} />
        ),
      )}
    </svg>
  );
}
```

`components/night/skill-glyph.tsx`, **VERBATIM**:

```tsx
import type { CSSProperties } from 'react';
import { hashStr, seeded } from '@/lib/hash';

// Each skill gets its own little honeycomb emblem: the pattern comes from the
// title, and busier emblems mean more stars. A port of glyph() in the design file.
export function SkillGlyph({ title, stars }: { title: string; stars: number }) {
  const r = 9;
  const w = Math.sqrt(3) * r;
  const ri = 8;
  const c = 28;
  const centers: [number, number][] = [
    [c, c], [c + w, c], [c - w, c],
    [c + w / 2, c - 1.5 * r], [c - w / 2, c - 1.5 * r],
    [c + w / 2, c + 1.5 * r], [c - w / 2, c + 1.5 * r],
  ];
  const rand = seeded(hashStr(title || 'skill') || 1);
  // Deterministic shuffle (Fisher-Yates), identical in every browser.
  const order = [0, 1, 2, 3, 4, 5, 6];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const lit = new Set(order.slice(0, Math.min(7, 3 + Math.round(stars / 18))));

  return (
    <svg viewBox="0 0 56 56" aria-hidden="true">
      {centers.map(([x, y], i) => {
        const pts: string[] = [];
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 180) * (60 * k - 90);
          pts.push(`${(x + ri * Math.cos(a)).toFixed(1)},${(y + ri * Math.sin(a)).toFixed(1)}`);
        }
        const on = lit.has(i);
        const o = on ? (0.35 + rand() * 0.55).toFixed(2) : '0';
        return (
          <polygon key={i} className={on ? 'g-cell on' : 'g-cell'} points={pts.join(' ')}
            style={{ '--i': i, '--o': o } as CSSProperties} />
        );
      })}
    </svg>
  );
}
```

`components/night/avatar-initial.tsx`, **VERBATIM**:

```tsx
import { hashStr } from '@/lib/hash';

const AV_COLORS = ['#F6A623', '#E8894A', '#D9B56A', '#8FA3B8', '#C9A0DC', '#7FC8A9'];

// A tinted circle with the handle's first letter. The color comes from the handle.
export function AvatarInitial({ handle, className = 'av' }: { handle: string; className?: string }) {
  const color = AV_COLORS[hashStr(handle) % AV_COLORS.length];
  return (
    <span className={className} style={{ background: `${color}26`, color }} aria-hidden="true">
      {(handle[0] ?? '?').toUpperCase()}
    </span>
  );
}
```

`components/night/page-shell.tsx`, **VERBATIM**:

```tsx
import type { ReactNode } from 'react';

// Every inner page: the soft ember glow at the top, then the centered content.
export function PageShell({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`page ${className}`.trim()}>
      <div className="glow" aria-hidden="true" />
      <div className="wrap">{children}</div>
    </section>
  );
}
```

`components/empty-state.tsx`, **VERBATIM**:

```tsx
import type { ReactNode } from 'react';

export function EmptyState({ title, body, action, small = false }: {
  title: string;
  body: string;
  action?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className={small ? 'empty small' : 'empty'}>
      <strong>{title}</strong>
      {body}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
```

`components/nav-link.tsx`, **VERBATIM**:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// A header link that marks itself as the current page (the glowing underline).
export function NavLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
```

`components/night/icons.tsx`, **VERBATIM**:

```tsx
// The design's inline icons, from build-plan/design/hive-night.html.
type P = { className?: string };

export const StarIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" /></svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const ForkIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="11.5" cy="3.5" r="1.5" /><circle cx="8" cy="12.5" r="1.5" /><path d="M4.5 5v1a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V5M8 8v3" /></svg>
);
export const CommentIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3h11v7.5H7L3.5 13v-2.5h-1z" /></svg>
);
export const FollowIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="6.5" cy="5.5" r="2.5" /><path d="M2 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5M12.5 5v4M10.5 7h4" /></svg>
);
export const LinkIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" /></svg>
);
export const InstallIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" /></svg>
);
export const BackIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
);
export const LockIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
);
export const PlusIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
);
export const ChevronIcon = ({ className = 'chev' }: P) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const HexIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28.1 9v14L16 30 3.9 23V9z" fill="#F6A623" /></svg>
);
```

**`components/site-header.tsx` in this step** (the design's header markup):

```text
<header class="site-header">
  <div class="bar-inner">
    logo:   <Link className="logo" href="/"> <HiveMark /> <span className="logo-text">Hive</span>
    nav:    <nav className="nav-links" aria-label="Main">
              <NavLink href="/explore">Explore</NavLink>
              <NavLink href="/publish">Publish</NavLink>
    right:  <div className="bar-right"> <Link className="signin" href="/sign-in">Sign in</Link>
```

Step 16 adds "Pricing" between Explore and Publish, and Step 06 adds "Dashboard" (signed in) after Publish, so the final order is the design's: Explore, Pricing, Publish, Dashboard. The design CSS handles small screens: the links shrink, and below 480px only the logo mark shows.

**`app/not-found.tsx`:** `<PageShell>` with `h1.page-title` "Page not found", `p.dash-sub` "This page doesn’t exist. Head back to Explore to find a skill.", and a link `className="btn-ember dash-cta"` "Explore skills" to `/explore`, placed below the text with a 28px top margin.

## Checks

- At 320px and 390px wide, the page has no sideways scroll and nothing is cut off or overlapping (DESIGN.md › Responsive).
- `npm run build` passes.
- `diff` between `app/hive-night.css` and the design file's `<style>` block shows nothing.
- The page background is `#14100B`, text is Geist, and the header matches the design file's header (logo glow, ember "Sign in", the underline on the current link).
- `app/globals.css` defines no `--muted`, and `getComputedStyle(document.documentElement).getPropertyValue('--muted')` is `#A99D8A`: the nav links, the footer and the not-found text are clearly visible.
- At 1280px and 390px wide, the header fits with no horizontal scroll.
- Keyboard focus shows the ember focus ring on every link and button.
- `/does-not-exist` shows the not-found page with the exact text.

## Update project memory

Append this block to the end of `MEMORY.md`, **VERBATIM**:

```md
## After step 02
- Hive Night design: app/hive-night.css is the design file's <style> block, unchanged; app/hive-night-app.css holds the integration rules. Dark only, Geist and Geist Mono.
- build-plan/design/hive-night.html is the visual source of truth for every page. DESIGN.md wins on looks; the steps win on behaviour.
- Shared: HiveMark, GlowDefs, Honeycomb, SkillGlyph, AvatarInitial, PageShell, EmptyState, NavLink, SiteHeader, SiteFooter, components/night/icons.tsx (the design's icons); lib/hash.ts. Toasts are sonner, bottom-center, class hive-toast.
```

## Finish this step

The agent runs the checks and, if all of them pass, commits with the message `step 02: design system` (AGENTS.md rule 13). Then:

1. Review what changed: `git show --stat HEAD`. Only this step's files and `MEMORY.md` should appear, plus this step's plan file in `build-plan/` if you added it for this step.

**Next:** `03-database.md`
