// Removes swarm test accounts so the next run starts clean:
//   - Clerk users whose email is agent-<cohort>-<id>+clerk_test@example.com
//   - Clerk organizations those users created
//   - their Supabase rows (deleting a profile also deletes its skills, stars,
//     comments, follows, notifications and activity)
//   - saved sessions in swarm/state/
// Real accounts are never touched. Dry run by default: pass --yes to delete.
//
//   node swarm/cleanup.mjs          shows what would be deleted
//   node swarm/cleanup.mjs --yes    deletes it
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(HERE, '..', '.env.local'), quiet: true });

const YES = process.argv.includes('--yes');
const SECRET = process.env.CLERK_SECRET_KEY;
if (!SECRET) {
  console.error('CLERK_SECRET_KEY not found in .env.local.');
  process.exit(1);
}
const AGENT_EMAIL = /^agent-[a-z0-9]+-\d{3}\+clerk_test@example\.com$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clerk(method, route) {
  const res = await fetch(`https://api.clerk.com/v1${route}`, {
    method,
    headers: { authorization: `Bearer ${SECRET}` },
  });
  if (res.status === 429) { await sleep(2000); return clerk(method, route); }
  if (!res.ok) throw new Error(`Clerk ${method} ${route}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json();
}

async function listAll(route) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const sep = route.includes('?') ? '&' : '?';
    const page = await clerk('GET', `${route}${sep}limit=100&offset=${offset}`);
    const items = Array.isArray(page) ? page : (page?.data ?? []);
    out.push(...items);
    if (items.length < 100) return out;
  }
}

const users = (await listAll(`/users?query=${encodeURIComponent('clerk_test')}`))
  .filter((u) => (u.email_addresses || []).some((e) => AGENT_EMAIL.test(e.email_address)));
const userIds = new Set(users.map((u) => u.id));
const orgs = (await listAll('/organizations')).filter((o) => userIds.has(o.created_by));
const stateDir = path.join(HERE, 'state');
const stateFiles = fs.existsSync(stateDir) ? fs.readdirSync(stateDir).filter((f) => f.endsWith('.json')) : [];

console.log(`Swarm test users in Clerk: ${users.length}`);
console.log(`Teams they created: ${orgs.length}`);
console.log(`Saved sessions in swarm/state/: ${stateFiles.length}`);

if (!YES) {
  for (const u of users.slice(0, 10)) console.log(`  ${u.email_addresses[0]?.email_address}`);
  if (users.length > 10) console.log(`  … and ${users.length - 10} more`);
  console.log('\nDry run: nothing deleted. Run again with --yes to delete.');
  process.exit(0);
}

for (const o of orgs) { await clerk('DELETE', `/organizations/${o.id}`); await sleep(120); }
for (const u of users) { await clerk('DELETE', `/users/${u.id}`); await sleep(120); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (url && key) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const ids = [...userIds];
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('profiles').delete().in('id', ids.slice(i, i + 100));
    if (error) console.log(`Supabase profiles: ${error.message}`);
  }
  if (orgs.length) {
    const { error } = await db.from('organizations').delete().in('id', orgs.map((o) => o.id));
    if (error) console.log(`Supabase organizations: ${error.message}`);
  }
} else {
  console.log('Supabase keys not found in .env.local: Supabase rows were not deleted.');
}
for (const f of stateFiles) fs.rmSync(path.join(stateDir, f));

console.log(`\nDeleted ${users.length} users, ${orgs.length} teams and ${stateFiles.length} saved sessions.`);
console.log('PostHog keeps the events from earlier runs: filter them out with cohort, or start a fresh project.');
