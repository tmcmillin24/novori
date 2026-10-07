import { test } from 'node:test';
import assert from 'node:assert/strict';
import {getServerKey,getPublishableKey} from '../../supabase/functions/_shared/supabase-keys.mjs';
const read = values => name => values[name];
test('explicit rotated server key overrides all injected legacy/default keys',()=>{
 assert.equal(getServerKey(read({NOVORI_SERVER_KEY:'sb_secret_rotated',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_old"}',SUPABASE_SERVICE_ROLE_KEY:'legacy'})),'sb_secret_rotated');
});
test('named modern keys work without default or legacy credentials',()=>{
 assert.equal(getServerKey(read({SUPABASE_SECRET_KEYS:'{"novori-server":"sb_secret_named"}'})),'sb_secret_named');
 assert.equal(getPublishableKey(read({SUPABASE_PUBLISHABLE_KEYS:'{"app":"sb_publishable_app"}'})),'sb_publishable_app');
});
test('public selection never uses server credentials and accepts explicit public override',()=>{
 assert.equal(getPublishableKey(read({SUPABASE_SECRET_KEYS:'{"default":"sb_secret_server"}'})),undefined);
 assert.equal(getPublishableKey(read({NOVORI_PUBLISHABLE_KEY:'sb_publishable_new',SUPABASE_ANON_KEY:'legacy'})),'sb_publishable_new');
 assert.throws(()=>getPublishableKey(read({NOVORI_PUBLISHABLE_KEY:'sb_secret_server'})),/publishable/);
});
test('bad explicit or injected key config fails instead of silently reviving legacy keys',()=>{
 assert.throws(()=>getServerKey(read({NOVORI_SERVER_KEY:'legacy'})),/secret key/);
 assert.throws(()=>getServerKey(read({SUPABASE_SECRET_KEYS:'bad',SUPABASE_SERVICE_ROLE_KEY:'legacy'})),/invalid/);
});
test('legacy fallback supports staged deployment until migration is completed',()=>{
 assert.equal(getServerKey(read({SUPABASE_SERVICE_ROLE_KEY:'legacy'})),'legacy');
 assert.equal(getPublishableKey(read({SUPABASE_ANON_KEY:'anon'})),'anon');
});
