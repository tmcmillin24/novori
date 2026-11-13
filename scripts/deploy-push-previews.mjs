import { readFileSync } from 'node:fs';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Copy and export your Supabase CLI token first.');
const response = await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query', {
 method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ query: readFileSync(new URL('../supabase/migrations/20261113040000_push_activity_previews.sql',import.meta.url),'utf8') + '\n' + readFileSync(new URL('../supabase/migrations/20261113060000_push_inbox_wording.sql',import.meta.url),'utf8'), read_only:false }),
 signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Notification preview update failed (${response.status}). Your CLI token needs Database Read/write. No credentials were printed.`);
console.log('Notification previews updated. Named activity alerts and anonymous grouped upvotes are enabled; downvotes do not send phone alerts. No app rebuild or catalog changes.');
