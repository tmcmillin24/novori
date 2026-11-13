const fs = require('node:fs');
const vm = require('node:vm');
it('uses the privileged query role for Vault decryption and never prints the secret', async () => {
 const secret='a'.repeat(64), calls=[], logs=[];
 const source=fs.readFileSync('scripts/deploy-phone-push.mjs','utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'file:///project/scripts/deploy-phone-push.mjs'");
 const run = (fetch,readFileSync,randomBytes,spawnSync,fileURLToPath,process,URL,console) => vm.runInNewContext('(async () => {'+source+'})()', {fetch,readFileSync,randomBytes,spawnSync,fileURLToPath,process,URL,console,AbortSignal});
 await run(async (url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  let data=[];
  if(body.query?.includes('as ready'))data=[{ready:true}];
  if(body.query?.includes('decrypted_secret as value'))data=[{value:secret}];
  return {ok:true,status:url.endsWith('/secrets')?204:200,json:async()=>data};
 },()=> 'select 1',()=>{throw Error('Must reuse existing credential');},()=>({status:0}),()=>'/project',{env:{SUPABASE_ACCESS_TOKEN:'fake-token'}},URL,{log:(...args)=>logs.push(args),table:(...args)=>logs.push(args)});
 const vault=calls.find(c=>c.body.query?.includes('decrypted_secret as value'));
 expect(vault.body.read_only).toBe(false);
 expect(calls.some(c=>c.body.query?.includes("cron.schedule('novori-phone-push'"))).toBe(true);
 expect(JSON.stringify(logs)).not.toContain(secret);
});
