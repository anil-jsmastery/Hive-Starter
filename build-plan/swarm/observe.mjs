// Turns the current page into a short text snapshot the model can read, and
// labels every interactive element so the model can point at it. Payment fields
// live in iframes, so every frame on the page is included.

function collectInFrame({ fi, limit }) {
  const SELECTOR = [
    'a[href]', 'button', 'input:not([type=hidden])', 'textarea', 'select', '[contenteditable="true"]',
    '[role=button]', '[role=link]', '[role=combobox]', '[role=option]', '[role=radio]', '[role=checkbox]',
    '[role=tab]', '[role=menuitem]', '[role=switch]',
  ].join(',');

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const clean = (s, n = 70) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

  // Styled radio and checkbox cards often hide the real input (opacity 0) and show a
  // <label> instead. People click the label, so the snapshot lists the visible label
  // in place of the hidden input, with the input's type and checked state.
  const labelFor = (el) => (el.labels && el.labels[0]) || el.closest('label');
  const seen = new Set();
  const picks = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (visible(el)) { picks.push({ el, target: el }); continue; }
    const t = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'INPUT' && (t === 'radio' || t === 'checkbox')) {
      const lab = labelFor(el);
      if (lab && visible(lab) && !seen.has(lab)) { seen.add(lab); picks.push({ el, target: lab }); }
    }
  }
  const els = picks.slice(0, limit);

  const items = els.map(({ el, target }, i) => {
    const id = `${fi}:${i}`;
    target.setAttribute('data-sw', id);
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const type = el.getAttribute('type') || '';
    const label = clean(
      (target !== el && target.innerText)
      || el.getAttribute('aria-label')
      || (el.labels && el.labels[0] && el.labels[0].innerText)
      || el.innerText
      || el.getAttribute('placeholder')
      || el.getAttribute('title')
      || el.getAttribute('name')
      || el.getAttribute('autocomplete')
      || '',
    );
    let state = '';
    if (tag === 'input' || tag === 'textarea') {
      if (type === 'checkbox' || type === 'radio') state = el.checked ? ' (checked)' : ' (not checked)';
      else if (type === 'password') state = el.value ? ` (filled: ${el.value.length} characters, hidden)` : ' (empty)';
      else if (!el.value) state = ' (empty)';
      else {
        const v = el.value;
        state = v.length > 300
          ? ` = "${clean(v, 300)}…" (only the start is shown in this list; the field holds all ${v.length} characters)`
          : ` = "${clean(v, 300)}"`;
      }
    }
    if (tag === 'select') {
      const current = el.selectedIndex >= 0 ? clean(el.options[el.selectedIndex].text, 40) : '';
      state = `${current ? ` = "${current}"` : ' (nothing selected)'} options: ${[...el.options].map((o) => clean(o.text, 20)).join(' | ')}`;
    }
    const aria = el.getAttribute('aria-checked') || el.getAttribute('aria-selected') || el.getAttribute('aria-expanded');
    if (aria === 'true') state += ' (selected)';
    const pressed = el.getAttribute('aria-pressed');
    if (pressed === 'true') state += ' (pressed)';
    else if (pressed === 'false') state += ' (not pressed)';
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') state += ' (disabled)';
    const kind = role || (type && tag === 'input' ? `input:${type}` : tag);
    return `[${id}] ${kind} "${label}"${state}`;
  });

  const text = fi === 0 ? clean((document.querySelector('main') || document.body).innerText, 900) : '';
  const toasts = fi === 0
    ? [...document.querySelectorAll('[data-sonner-toast]')].map((t) => clean(t.innerText, 140)).join(' | ')
    : '';
  const dialog = fi === 0
    ? clean([...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText).join(' | '), 500)
    : '';
  const errors = fi === 0
    ? [...document.querySelectorAll('.text-destructive, [role=alert]')].map((e) => clean(e.innerText, 120)).filter(Boolean).join(' | ')
    : '';
  const openList = fi === 0 ? [...document.querySelectorAll('[role=listbox]')].some(visible) : false;

  return { items, text, toasts, dialog, errors, openList };
}

export async function observe(page) {
  const frames = page.frames();
  const out = {
    url: '',
    title: '',
    text: '',
    toasts: '',
    dialog: '',
    errors: '',
    openList: false,
    items: [],
    frames,
  };
  try {
    const u = new URL(page.url());
    out.url = u.pathname + u.search;
  } catch { out.url = page.url(); }
  out.title = await page.title().catch(() => '');

  for (let fi = 0; fi < frames.length; fi++) {
    let res;
    try {
      res = await frames[fi].evaluate(collectInFrame, { fi, limit: fi === 0 ? 60 : 15 });
    } catch {
      continue; // detached or unreachable frame
    }
    if (fi === 0) {
      out.text = res.text;
      out.toasts = res.toasts;
      out.dialog = res.dialog;
      out.errors = res.errors;
      out.openList = res.openList;
    }
    if (res.items.length) {
      if (fi > 0) out.items.push(`-- inside frame ${fi} (for example a payment form) --`);
      out.items.push(...res.items);
    }
  }
  return out;
}

// Models write element ids in different ways: "0:32", "[0:32]", "#0:32", " 0 : 32 ",
// or just "32" for the main page. All of them mean the same element.
export function normalizeTarget(target) {
  const t = String(target ?? '').replace(/[\[\]#\s]/g, '');
  const m = t.match(/^(\d+):(\d+)$/) || t.match(/^(\d+)$/);
  if (!m) return t;
  return m.length === 3 ? `${m[1]}:${m[2]}` : `0:${m[1]}`;
}

function pathOf(url) {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}
function sameSite(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

async function openListbox(frame) {
  return (await frame.locator('[role="listbox"]').filter({ visible: true }).count()) > 0;
}

// While a shadcn/Radix dropdown is open, an invisible layer covers the page and the
// next click only closes the dropdown. People close dropdowns without thinking, so
// the harness does too, unless the click is on something inside the open list.
async function closeDropdownUnlessInside(page, frame, el) {
  if (!(await openListbox(frame))) return;
  const inside = await el.evaluate((n) => Boolean(n.closest('[role="listbox"]'))).catch(() => false);
  if (!inside) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

export async function act(page, frames, a) {
  const timeout = 8000;
  switch (a.action) {
    case 'back': await page.goBack({ timeout }).catch(() => {}); break;
    case 'keyboard': await page.keyboard.type(String(a.text ?? ''), { delay: 25 }); break;
    case 'press_enter': await page.keyboard.press('Enter'); break;
    case 'scroll': await page.mouse.wheel(0, 700); break;
    case 'wait': await page.waitForTimeout(2000); break;
    case 'click':
    case 'type':
    case 'select': {
      const target = normalizeTarget(a.target);
      const fi = Number(target.split(':')[0]);
      const frame = frames[fi];
      if (!frame) throw new Error(`no frame for ${a.target}`);
      const el = frame.locator(`[data-sw="${target}"]`).first();
      // If the page changed since the snapshot, say so at once instead of waiting
      // for Playwright's timeout. The agent sees the new page on its next step.
      if ((await el.count().catch(() => 0)) === 0) {
        throw new Error(`element ${target} is no longer on the page (the page changed)`);
      }
      const text = String(a.text ?? '');
      if (a.action === 'click') {
        await closeDropdownUnlessInside(page, frame, el);
        const before = page.url();
        const href = await el.evaluate((n) => n.closest('a[href]')?.href || '').catch(() => '');
        await el.click({ timeout });
        // A link to another page: wait until the browser has really arrived. A
        // server-rendered page can take seconds, and until then the old page stays on
        // screen, so the next snapshot would show it and the agent would click again.
        if (href && sameSite(href, before) && pathOf(href) !== pathOf(before)) {
          await page.waitForURL((u) => pathOf(u.href) === pathOf(href), { timeout: 15000 }).catch(() => {});
        }
      } else if (a.action === 'type') {
        // "type" always replaces the field's content, never adds to it.
        try {
          await el.fill(text, { timeout });
        } catch {
          await el.click({ timeout });
          await page.keyboard.press('ControlOrMeta+A');
          await page.keyboard.press('Backspace');
          await page.keyboard.type(text, { delay: 15 });
        }
      } else {
        const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
        if (tag === 'select') {
          await el.selectOption({ label: text }, { timeout })
            .catch(() => el.selectOption(text, { timeout }));
        } else {
          // Custom dropdowns (shadcn/Radix Select). Open it only if it isn't open already:
          // clicking the trigger of an open dropdown closes it again.
          if (!(await openListbox(frame))) await el.click({ timeout });
          // Only visible options: Radix also renders a hidden native <select> with the same options.
          const option = frame.getByRole('option', { name: text, exact: true }).filter({ visible: true }).first();
          await option.click({ timeout }).catch(async () => {
            await frame.getByRole('option', { name: text }).filter({ visible: true }).first().click({ timeout });
          });
          // Never leave a dropdown open: its overlay would swallow the next click.
          if (await openListbox(frame)) await page.keyboard.press('Escape');
        }
      }
      break;
    }
    default:
      throw new Error(`unknown action ${a.action}`);
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
}

// Wait until the page stops changing: no DOM updates for quietMs, at most maxMs.
// Covers in-page updates (a search or filter re-rendering a list) as well as new
// pages, so the next snapshot never shows elements that are about to be replaced.
export async function settle(page, quietMs = 400, maxMs = 6000) {
  for (let tries = 0; tries < 2; tries++) {
    try {
      await page.evaluate(({ quietMs, maxMs }) => new Promise((resolve) => {
        const start = Date.now();
        let timer;
        const done = () => { obs.disconnect(); clearTimeout(timer); resolve(); };
        const obs = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, Math.max(0, Math.min(quietMs, maxMs - (Date.now() - start))));
        });
        obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
        timer = setTimeout(done, quietMs);
        setTimeout(done, maxMs);
      }), { quietMs, maxMs });
      return;
    } catch {
      // A navigation replaced the page mid-wait: let the new one load, then try once more.
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    }
  }
}
