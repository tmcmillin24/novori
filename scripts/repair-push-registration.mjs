import { readFileSync } from 'node:fs';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Copy and export your Supabase CLI token first.');
const response = await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query', {
 method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ query: readFileSync(new URL('../supabase/migrations/20261113030000_push_registration_reinstall.sql',import.meta.url),'utf8'), read_only:false }),
 signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Registration repair failed (${response.status}). Your CLI token needs Database Read/write. No credentials were printed.`);
console.log('Push registration repair applied. Reopen Novori, then retry Enable phone notifications in Settings. No app rebuild or catalog changes.');
