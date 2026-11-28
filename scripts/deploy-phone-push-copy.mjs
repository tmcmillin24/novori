import { readFileSync } from 'node:fs';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN first.');
const query = readFileSync(new URL('../supabase/migrations/20261125190000_phone_push_copy.sql', import.meta.url), 'utf8');
const response = await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Push wording update failed (${response.status}): ${(await response.text()).slice(0, 900)}`);
console.log('Phone push wording updated. Existing schedules and preferences are unchanged.');
