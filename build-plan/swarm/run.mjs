// Hive swarm: AI agents using the deployed app in real browsers.
//
//   node swarm/run.mjs --url=https://your-app.vercel.app --cohort=A --agents=10
//   node swarm/run.mjs --url=... --cohort=A --agents=300 --spread-minutes=90
//   node swarm/run.mjs --url=... --return-wave=A --cohort-size=300
//   node swarm/run.mjs --url=... --cohort=T --agents=10 --only=builder
//   node swarm/run.mjs --url=... --cohort=B --agents=90 --only=builder --exclude=builder-private,builder-team
//
// Prints one line per agent. Details go to swarm/results/<run>-<start time>/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { chromium } from 'playwright';
import { buildPersonas, returnWave, seeded, TEST_CARD } from './personas.mjs';
import { observe, act, normalizeTarget, settle } from './observe.mjs';
import { callModel, checkSpec, priceOf, splitSpec } from './providers.mjs';
import { evidenceClient, succeeded } from './evidence.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(HERE, '..', '.env.local'), quiet: true });
config({ path: path.join(HERE, '.env'), override: true, quiet: true });

// ---------- arguments ----------
const arg = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || 'true'];
}));
const URL_BASE = (arg.url || '').replace(/\/$/, '');
const RETURN_OF = arg['return-wave'] || null;
// Default to the test cohort, so a run without --cohort can never mix into Cohort A or B.
const COHORT = RETURN_OF || arg.cohort || 'T';
const AGENTS = Number(arg.agents || 10);
const CONCURRENCY = Number(arg.concurrency || 10);
const SPREAD_MIN = Number(arg['spread-minutes'] || 0);
const MAX_USD = Number(arg['max-usd'] || 10);
const SEED = Number(arg.seed || 42);
const MODEL = arg.model || process.env.SWARM_MODEL || '';
const HEADED = arg.headed === 'true';
const ONLY = arg.only ? String(arg.only).split(',').map((x) => x.trim()) : null;
const EXCLUDE = arg.exclude ? String(arg.exclude).split(',').map((x) => x.trim()) : null;
const STATE_DIR = path.join(HERE, 'state');
// Every run gets its own results folder, so runs never overwrite each other.
const RUN_NAME = RETURN_OF ? `return-wave-${RETURN_OF}` : `cohort-${COHORT}`;
const STAMP = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const OUT_DIR = path.join(HERE, 'results', `${RUN_NAME}-${STAMP}`);

const fail = (msg) => { console.error(msg); process.exit(1); };
if (!URL_BASE) fail('Pass --url=<your deployed Hive URL>.');
const specProblem = checkSpec(MODEL);
if (specProblem) fail(specProblem);

// ---------- personas ----------
// --only=builder (or builder-private, consumer, ...) runs just those personas, and
// --exclude=builder-private,builder-team leaves some out (by variant or type).
const keep = (p) =>
  (!ONLY || ONLY.includes(p.type) || ONLY.includes(p.variant)) &&
  (!EXCLUDE || (!EXCLUDE.includes(p.variant) && !EXCLUDE.includes(p.type)));

let personas;
if (RETURN_OF) {
  const cohortAgents = buildPersonas({ n: Number(arg['cohort-size'] || 100), cohort: RETURN_OF, seed: SEED })
    .filter((p) => fs.existsSync(path.join(STATE_DIR, `${p.cohort}-${p.id}.json`)));
  personas = returnWave(cohortAgents).filter(keep);
  if (!personas.length) fail(`No saved sessions for cohort ${RETURN_OF} in swarm/state/ that match the filters. Run that cohort first.`);
} else if (ONLY || EXCLUDE) {
  // --agents always counts the agents that run. With filters, build a bigger mix
  // until enough personas pass them, then run exactly --agents of those.
  let n = AGENTS;
  personas = [];
  for (let tries = 0; tries < 12 && personas.length < AGENTS; tries++) {
    personas = buildPersonas({ n, cohort: COHORT, seed: SEED }).filter(keep);
    n *= 2;
  }
  if (!personas.length) fail(`No personas match --only=${ONLY ? ONLY.join(',') : ''} --exclude=${EXCLUDE ? EXCLUDE.join(',') : ''}.`);
  personas = personas.slice(0, AGENTS);
} else {
  personas = buildPersonas({ n: AGENTS, cohort: COHORT, seed: SEED });
}

// Spread arrivals: each agent gets a start time, never all at once, in the order a
// real launch happens.
// - A cohort: creators (builders) arrive in the first third of the window and the
//   audience from a quarter of the way in to the end, so the audience can actually
//   find skills that new creators have just published.
// - A return wave: the audience comes back first (over the first minute) and the
//   authors 3 to 4 minutes later, after others have had time to react to their skills.
// Nobody is told what to do: agents still choose freely what to look at and react to.
const rand = seeded(SEED + 7);
const isCreator = (p) => p.type === 'builder';
function startAfterMs(p) {
  if (RETURN_OF) {
    const min = isCreator(p) ? 3 + rand() : rand();
    return Math.floor(min * 60_000);
  }
  if (SPREAD_MIN <= 0) return 0;
  const share = isCreator(p) ? rand() * (1 / 3) : 0.25 + rand() * 0.75;
  return Math.floor(share * SPREAD_MIN * 60_000);
}
const jobs = personas
  .map((p) => ({ p, startAfterMs: startAfterMs(p) }))
  .sort((a, b) => a.startAfterMs - b.startAfterMs);

// ---------- the prompt ----------
const SYSTEM = `You are a real person using Hive, a website where developers find, install and publish
"skills" (Markdown instructions for AI coding agents). Stay in character as the persona you are given.
You see a text snapshot of the current page. Interactive elements have ids like [0:12]; elements
inside a frame (such as a payment form) have ids like [2:3].
Reply with one JSON object only, with these fields:
- thought: up to 15 words, what you think right now
- action: one of click, type, select, keyboard, press_enter, scroll, back, wait, done, give_up
- target: the element id for click, type or select, without brackets (for example 0:12), otherwise ""
- text: what to type, or the option to select, otherwise ""
"type" replaces everything in a field with your text. "keyboard" adds to whatever is focused:
use it only for verification codes.
To choose from a dropdown, use "select" with the dropdown's id and the exact option text.
Long field values are shortened in this list: you see the first 300 characters, then "…" and the field's full length.
That only shortens the list, not the field: if a field's length matches your text, the field holds all of it. Don't type it again.
Use "done" only when your goal is truly achieved. Use "give_up" when a real person like you would leave.
Never invent element ids. Never type anything you were not given or would not know.`;

function prompt(p, obs, history, step) {
  const lines = [
    `PERSONA: ${p.name}, ${p.type}${p.mobile ? ', on a phone' : ''}. Arrived from: ${p.source}.`,
    `GOAL: ${p.goal}`,
    RETURN_OF
      ? `YOU ALREADY HAVE A HIVE ACCOUNT: email ${p.email}, username ${p.username}, password ${p.password}. You may still be signed in; if not, sign in (don't sign up again).`
      : `YOU DON'T HAVE A HIVE ACCOUNT YET. If you need one, sign up (not sign in) with email ${p.email}, username ${p.username}, password ${p.password}.`,
    'If asked for a verification code, it is 424242.',
  ];
  if (p.canPay) {
    lines.push(`IF YOU DECIDE TO PAY: card ${TEST_CARD.number}, expiry ${TEST_CARD.expiry}, CVC ${TEST_CARD.cvc}, ZIP ${TEST_CARD.zip}.`);
  }
  if (p.draft) {
    lines.push('YOUR SKILL DRAFT:', `Title: ${p.draft.title}`, `Description: ${p.draft.description}`,
      `Stack: ${p.draft.stack}`, `Tags: ${p.draft.tags}`, `Content:\n${p.draft.content}`);
  }
  lines.push('', `RECENT ACTIONS:\n${history.slice(-6).join('\n') || 'none yet'}`, '',
    `PAGE: ${obs.url} | ${obs.title}`);
  if (obs.toasts) lines.push(`NOTIFICATIONS ON SCREEN: ${obs.toasts}`);
  if (obs.dialog) lines.push(`DIALOG: ${obs.dialog}`);
  if (obs.openList) lines.push('A DROPDOWN LIST IS OPEN: pick an option, or it will close when you click elsewhere.');
  if (obs.errors) lines.push(`ERRORS SHOWN: ${obs.errors}`);
  lines.push(`TEXT: ${obs.text}`, 'ELEMENTS:', obs.items.join('\n') || '(none)', '',
    `Step ${step + 1} of at most ${p.budget}.`);
  return lines.join('\n');
}

const parseAction = (t) => {
  const m = (t || '').match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
};

// ---------- browsers ----------
// Normal user agents: headless Chrome's default UA gets filtered out as a bot by analytics.
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// Headless Chrome announces itself (navigator.webdriver = true, a "HeadlessChrome" brand),
// and posthog-js drops those visitors as bots before any event is sent. The agents are not
// hidden: every event carries cohort: swarm-<name>. This only stops the bot filter from
// discarding them before that tag can be seen.
function realBrowserSignals({ mobile }) {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  if (mobile) {
    // Safari on iPhone has no userAgentData.
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined, configurable: true });
    return;
  }
  const real = navigator.userAgentData;
  if (!real) return;
  const brands = [
    { brand: 'Chromium', version: '130' },
    { brand: 'Google Chrome', version: '130' },
    { brand: 'Not?A_Brand', version: '99' },
  ];
  const platform = real.platform || 'macOS';
  const fake = {
    brands,
    mobile: false,
    platform,
    getHighEntropyValues: (hints) => real.getHighEntropyValues(hints)
      .then((v) => ({ ...v, brands, fullVersionList: brands })),
    toJSON: () => ({ brands, mobile: false, platform }),
  };
  Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => fake, configurable: true });
}

// Clerk testing tokens let agents past Clerk's bot protection (development instances only).
let clerkTesting = null;
async function setupClerk() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    console.log('Clerk keys not found in .env.local: running without Clerk testing tokens.');
    return;
  }
  process.env.CLERK_PUBLISHABLE_KEY ||= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  try {
    const mod = await import('@clerk/testing/playwright');
    await mod.clerkSetup();
    clerkTesting = mod;
  } catch (e) {
    console.log(`Clerk testing tokens unavailable (${String(e.message).slice(0, 80)}). Install @clerk/testing.`);
  }
}

function startUrl(p) {
  const u = new URL(URL_BASE + p.startPath);
  u.searchParams.set('swarm', p.cohort);
  u.searchParams.set('persona', p.variant);
  u.searchParams.set('model', splitSpec(MODEL).model);
  u.searchParams.set('utm_source', p.source);
  u.searchParams.set('utm_medium', 'swarm');
  u.searchParams.set('utm_campaign', 'launch-rehearsal');
  return u.toString();
}

// ---------- one agent ----------
let spent = 0;
let stopped = false;
const startedAtIso = new Date().toISOString();

async function runAgent(browser, p) {
  const rec = {
    id: p.id, cohort: p.cohort, type: p.type, variant: p.variant, username: p.username, success: p.success,
    model: MODEL, steps: 0, inTok: 0, outTok: 0, cost: 0, priceKnown: true, retries: 0,
    parseErrors: 0, actionErrors: 0, interrupted: 0, failures: [], outcome: null, lastThought: '', trace: [],
    sharedSlug: p.sharedSlug,
    seen: { installToast: false, installedSlugs: [], skillPage: false, dashboard: false, leftDashboardTo: false },
  };
  const t0 = Date.now();
  const statePath = path.join(STATE_DIR, `${p.cohort}-${p.id}.json`);
  let context;
  try {
    context = await browser.newContext({
      ...(p.mobile
        ? { viewport: { width: 390, height: 844 }, userAgent: MOBILE_UA, isMobile: true, hasTouch: true }
        : { viewport: { width: 1280, height: 800 }, userAgent: DESKTOP_UA }),
      ...(RETURN_OF && fs.existsSync(statePath) ? { storageState: statePath } : {}),
      // "Install" copies a command; without this permission the copy fails and no toast appears.
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.addInitScript(realBrowserSignals, { mobile: p.mobile });
    const page = await context.newPage();
    if (clerkTesting) await clerkTesting.setupClerkTestingToken({ page });
    await page.goto(startUrl(p), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1200);

    const history = [];
    for (let step = 0; step < p.budget; step++) {
      if (stopped) { rec.outcome = 'budget_stop'; break; }
      const obs = await observe(page);
      if (obs.toasts.includes('Install command copied')) {
        rec.seen.installToast = true;
        const slug = obs.url.startsWith('/s/') ? obs.url.split('/')[2].split('?')[0] : null;
        if (slug && !rec.seen.installedSlugs.includes(slug)) rec.seen.installedSlugs.push(slug);
      }
      if (obs.url.startsWith('/s/')) rec.seen.skillPage = true;
      if (obs.url.startsWith('/dashboard')) rec.seen.dashboard = true;
      else if (rec.seen.dashboard && (obs.url.startsWith('/s/') || obs.url.startsWith('/u/'))) rec.seen.leftDashboardTo = true;

      const r = await callModel(MODEL, SYSTEM, prompt(p, obs, history, step));
      rec.steps++;
      rec.inTok += r.inTok;
      rec.outTok += r.outTok;
      rec.retries += r.retries || 0;
      const c = priceOf(MODEL, r.inTok, r.outTok);
      if (c === null) rec.priceKnown = false; else { rec.cost += c; spent += c; }
      if (spent >= MAX_USD) stopped = true;

      const a = parseAction(r.text);
      if (!a || !a.action) { rec.parseErrors++; history.push(`${step + 1}. (my reply was unclear)`); continue; }
      if (a.target) a.target = normalizeTarget(a.target);
      rec.lastThought = a.thought || '';
      // Never log a password: catch it by the field's type, or by matching the agent's own password.
      const line = obs.items.find((l) => l.startsWith(`[${a.target}]`)) || '';
      const secret = a.action === 'type' && (/input:password/.test(line) || (p.password && String(a.text) === p.password));
      rec.trace.push({ at: Math.round((Date.now() - t0) / 100) / 10, url: obs.url, action: a.action, target: a.target, text: secret ? '••••' : a.text, thought: a.thought });
      if (a.action === 'done' || a.action === 'give_up') { rec.outcome = a.action; break; }
      try {
        await act(page, obs.frames, a);
        const shown = secret ? ' (your full password)' : a.text && a.action !== 'select' ? ` "${String(a.text).slice(0, 30)}"` : '';
        history.push(`${step + 1}. ${a.action}${a.target ? ` [${a.target}]` : ''}${shown} (${a.thought || ''})`);
      } catch (e) {
        const why = String(e?.message || e).split('\n')[0].slice(0, 160);
        // A frame being replaced (Clerk's checkout reloading its card form) or the
        // agent's own browser closing interrupts an action without the agent doing
        // anything wrong. Those are logged, but not counted as failed actions.
        const interrupted = /has been closed|detached|Execution context was destroyed|no longer on the page/i.test(why) || page.isClosed();
        if (interrupted) rec.interrupted++; else rec.actionErrors++;
        rec.trace[rec.trace.length - 1][interrupted ? 'interrupted' : 'failed'] = why;
        rec.failures.push({ step: step + 1, at: rec.trace[rec.trace.length - 1].at, action: a.action, target: a.target, error: why, kind: interrupted ? 'interrupted' : 'failed' });
        history.push(`${step + 1}. ${a.action} [${a.target}] did not work`);
        if (page.isClosed()) break;
      }
      // Human-ish pacing, so session replays are watchable. After a navigation, also
      // let the new page finish loading, so the next snapshot's element ids are fresh.
      await page.waitForTimeout(400 + Math.floor(Math.random() * 800));
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
      await settle(page);
    }
    rec.outcome ||= 'out_of_steps';
    if (!RETURN_OF) {
      // Save the session only for agents that ended up signed in, so the return wave
      // brings back real members, not visitors who never made an account. Clerk's
      // __client_uat cookie is "0" when signed out and a timestamp when signed in.
      const cookies = await context.cookies().catch(() => []);
      const signedIn = cookies.some((c) => c.name.startsWith('__client_uat') && c.value && c.value !== '0');
      if (signedIn) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
        await context.storageState({ path: statePath });
      } else if (fs.existsSync(statePath)) {
        fs.rmSync(statePath);
      }
    }
  } catch (e) {
    rec.outcome = 'crashed';
    rec.error = String(e.message || e).slice(0, 200);
  } finally {
    await context?.close().catch(() => {});
  }
  rec.seconds = Math.round((Date.now() - t0) / 1000);
  fs.appendFileSync(path.join(OUT_DIR, 'agents.jsonl'), `${JSON.stringify(rec)}\n`);
  console.log(`#${p.id} ${p.variant.padEnd(16)} ${rec.outcome.padEnd(12)} ${String(rec.steps).padStart(2)} steps  ${rec.priceKnown ? `$${rec.cost.toFixed(4)}` : 'no price'}${rec.error ? `  (${rec.error.slice(0, 60)})` : ''}`);
  return rec;
}

// ---------- run ----------
const reachable = await fetch(URL_BASE, { method: 'GET' }).then((r) => r.status < 500).catch(() => false);
if (!reachable) fail(`Can't reach ${URL_BASE}. Check the URL and that the site is deployed.`);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'agents.jsonl'), '');
await setupClerk();
console.log(`Swarm ${RETURN_OF ? `return wave of ${RETURN_OF}` : `cohort ${COHORT}`}: ${jobs.length} agents, ${CONCURRENCY} at a time, spread over ${SPREAD_MIN} min, model ${MODEL}, budget cap $${MAX_USD}`);

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--disable-blink-features=AutomationControlled'],
});
const runStart = Date.now();
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const wait = runStart + job.startAfterMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (stopped) break;
    results.push(await runAgent(browser, job.p));
  }
}));
await browser.close();

// ---------- evidence and summary ----------
const db = evidenceClient();
for (const r of results) r.verified = await succeeded(db, r, startedAtIso).catch(() => null);

const round = (n, d = 4) => Number(n.toFixed(d));
const byVariant = {};
for (const r of results) {
  const g = (byVariant[r.variant] ||= { agents: 0, succeeded: 0, unverified: 0, steps: 0, cost: 0 });
  g.agents++;
  g.steps += r.steps;
  g.cost += r.cost;
  if (r.verified === true) g.succeeded++;
  if (r.verified === null) g.unverified++;
}
for (const g of Object.values(byVariant)) {
  g.successRate = `${Math.round((100 * g.succeeded) / g.agents)}%`;
  g.avgSteps = round(g.steps / g.agents, 1);
  g.avgCostUSD = round(g.cost / g.agents);
  delete g.steps;
  g.cost = round(g.cost);
}
const steps = results.reduce((a, r) => a + r.steps, 0) || 1;
const priced = results.every((r) => r.priceKnown);
const summary = {
  ranAt: new Date().toISOString(),
  target: URL_BASE,
  run: RUN_NAME,
  model: MODEL,
  // The settings this run used, so the next cohort can match them exactly.
  settings: {
    agents: RETURN_OF ? Number(arg['cohort-size'] || 100) : AGENTS,
    spreadMinutes: SPREAD_MIN,
    concurrency: CONCURRENCY,
    seed: SEED,
    maxUsd: MAX_USD,
    only: ONLY,
    exclude: EXCLUDE,
  },
  agents: results.length,
  wallClockMinutes: round((Date.now() - runStart) / 60000, 1),
  totalCostUSD: priced ? round(spent) : 'add the model to swarm/prices.json',
  costPerAgentUSD: priced && results.length ? round(spent / results.length) : null,
  avgInputTokensPerStep: Math.round(results.reduce((a, r) => a + r.inTok, 0) / steps),
  avgOutputTokensPerStep: Math.round(results.reduce((a, r) => a + r.outTok, 0) / steps),
  stoppedByBudget: stopped,
  reliability: {
    crashed: results.filter((r) => r.outcome === 'crashed').length,
    parseErrors: results.reduce((a, r) => a + r.parseErrors, 0),
    actionErrors: results.reduce((a, r) => a + r.actionErrors, 0),
    interrupted: results.reduce((a, r) => a + (r.interrupted || 0), 0),
    apiRetries: results.reduce((a, r) => a + r.retries, 0),
  },
  evidence: db ? 'supabase + browser' : 'browser only (no Supabase keys in .env.local)',
  byVariant,
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`\nDone in ${summary.wallClockMinutes} min. Cost: ${typeof summary.totalCostUSD === 'number' ? `$${summary.totalCostUSD}` : summary.totalCostUSD}.`);
console.log(`Reliability: ${summary.reliability.crashed} crashed, ${summary.reliability.parseErrors} unclear replies, ${summary.reliability.actionErrors} failed actions (${summary.reliability.interrupted} more interrupted because the page changed or closed under the agent), ${summary.reliability.apiRetries} API retries.`);
for (const [v, g] of Object.entries(byVariant)) {
  console.log(`  ${v.padEnd(18)} ${String(g.agents).padStart(3)} agents  success ${g.successRate.padStart(4)}${g.unverified ? ` (${g.unverified} unverified)` : ''}  ${g.avgSteps} steps  $${g.avgCostUSD}/agent`);
}
console.log(`Details: ${path.relative(path.join(HERE, '..'), OUT_DIR)}/summary.json and agents.jsonl`);
