import { readFileSync } from 'node:fs';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Copy and export your Supabase CLI token first.');
const response = await fetch('https://api.supabase.com/v1/projects/oanpmuiuuwljknwvyzev/database/query', {
 method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ query: readFileSync(new URL('../supabase/migrations/20261113050000_preserve_comment_replies.sql',import.meta.url),'utf8'), read_only:false }),
 signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Comment deletion update failed (${response.status}): ${await response.text()}`);
console.log('Comment deletion backend updated. Reload the updated development app to test the confirmation and preserved replies.');
