import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const originalGuard="CREATE OR REPLACE FUNCTION public.novori_preserve_reading_recap_snapshot()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nbegin\n  if auth.uid() is null and exists(select 1 from public.account_deletion_requests r where r.user_id=old.author_id and r.state='processing' and r.user_id::text=current_setting('novori.account_deletion_user',true)) then return new;end if;\n  if old.reading_recap is not null and (new.reading_recap is distinct from old.reading_recap\n    or new.recap_share_key is distinct from old.recap_share_key) then\n    raise exception 'Shared recap statistics cannot be changed. Delete the post to remove them.';\n  end if;\n  return new;\nend $function$\n";
test('recap guard permits reader edits without granting deletion-table access and still protects snapshots',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.reader',true),'')::uuid$$;
 select set_config('test.reader','11111111-1111-4111-8111-111111111111',false);
 create table account_deletion_requests(user_id uuid,state text);
 create table posts(id integer primary key,author_id uuid,body text,reading_recap jsonb,recap_share_key text);
 insert into posts values(1,auth.uid(),'Before',null,null),(2,auth.uid(),'Recap','{"books":2}','key');
 grant usage on schema auth,public to authenticated;grant select,update on posts to authenticated;`);
 await db.exec(originalGuard);
 await db.exec('create trigger recap_guard before update on posts for each row execute function novori_preserve_reading_recap_snapshot();set role authenticated;');
 await db.query("select set_config('test.reader','',false)");
 await assert.rejects(db.exec("update posts set body='After' where id=1"),/permission denied for table account_deletion_requests/);
 await db.exec('reset role;');
 await db.exec(await readFile(new URL('../../supabase/migrations/20261007014500_recap_guard_permissions.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated;');
 await db.query("select set_config('test.reader','11111111-1111-4111-8111-111111111111',false)");
 await db.exec("update posts set body='After' where id=1;update posts set body='New caption' where id=2;");
 assert.equal((await db.query('select body from posts where id=1')).rows[0].body,'After');
 await assert.rejects(db.exec(`update posts set reading_recap='{"books":9}' where id=2`),/Shared recap statistics cannot be changed/);
 await assert.rejects(db.exec('select * from account_deletion_requests'),/permission denied/);
 assert.deepEqual((await db.query('select reading_recap from posts where id=2')).rows[0].reading_recap,{books:2});
 }finally{await db.close();}
});
