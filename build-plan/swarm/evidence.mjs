// Success comes from evidence, never from what an agent claims: rows in Supabase
// (read-only queries) or what the browser actually showed. This is the one place
// outside the app that reads the Supabase secret key, and it only reads.
import { createClient } from '@supabase/supabase-js';

export function evidenceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function profileId(db, username) {
  const { data } = await db.from('profiles').select('id, handle').like('handle', `${username}%`).limit(1);
  return data?.[0]?.id ?? null;
}

// Returns true, false, or null when there's no way to check.
export async function succeeded(db, record, startedAtIso) {
  const seen = record.seen;
  switch (record.success) {
    case 'install':
      return seen.installToast;
    case 'install-shared':
      // A shared-link visitor succeeds only by installing the very skill they were sent.
      return Boolean(record.sharedSlug) && seen.installedSlugs.includes(record.sharedSlug);
    case 'view-skill':
      return seen.skillPage;
    case 'return-visit':
      return seen.dashboard && seen.leftDashboardTo;
    default:
      break;
  }
  if (!db) return null;
  const id = await profileId(db, record.username);
  if (!id) return false;

  if (record.success === 'comment') {
    const { count } = await db.from('comments').select('id', { count: 'exact', head: true })
      .eq('author_id', id).gte('created_at', startedAtIso);
    return (count ?? 0) > 0;
  }

  let q = db.from('skills').select('id', { count: 'exact', head: true }).eq('author_id', id).gte('created_at', startedAtIso);
  if (record.success === 'publish') q = q.is('forked_from_id', null);
  if (record.success === 'publish-private') q = q.eq('visibility', 'private').is('org_id', null);
  if (record.success === 'publish-team') q = q.eq('visibility', 'private').not('org_id', 'is', null);
  const { count } = await q;
  return (count ?? 0) > 0;
}
