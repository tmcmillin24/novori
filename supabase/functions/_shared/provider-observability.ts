type Trace={hits:number;misses:number;upstream:Record<string,number>;decisions:{provider:string;status:string;key:string}[]};
const traces=new WeakMap<object,Trace>();
export function startProviderTrace(admin:object){traces.delete(admin);return providerTrace(admin);}
export function providerTrace(admin:object):Trace{
 let value=traces.get(admin);if(!value){value={hits:0,misses:0,upstream:{},decisions:[]};traces.set(admin,value);}return value;
}
export function noteProviderCache(admin:object,provider:string,status:string,key:string){
 const trace=providerTrace(admin);if(status.startsWith('hit'))trace.hits++;if(status==='miss')trace.misses++;
 // Keep keys out of response/logs: search text and ISBNs can be embedded in them.
 const kind=key.split(':')[0];if(trace.decisions.length<24)trace.decisions.push({provider,status,key:kind});
 console.info?.(`[Novori cache] ${status.toUpperCase()}`,{provider,kind});
}
export function noteProviderUpstream(admin:object,provider:string,route:string){
 const trace=providerTrace(admin);trace.upstream[provider]=(trace.upstream[provider]??0)+1;
 console.info?.('[Novori cache] UPSTREAM',{provider,route});
}
export function hardcoverDailyUsage(headers:Headers,now=new Date()){
 const bucket=(value:string|null,name:string)=>{
  const part=(value??'').split(',').find(value=>/^\s*"?daily"?\s*;/.test(value));
  const match=part?.match(new RegExp('(?:^|;)\\s*'+name+'=(\\d+)'));return match?Number(match[1]):null;
 };
 const number=(name:string)=>{const value=headers.get(name);return value!==null&&/^\d+$/.test(value)?Number(value):null;};
 const limit=bucket(headers.get('RateLimit-Policy'),'q')??number('X-RateLimit-Daily-Limit');
 const remaining=bucket(headers.get('RateLimit'),'r')??number('X-RateLimit-Daily-Remaining');
 if(limit===null||remaining===null||!Number.isSafeInteger(limit)||!Number.isSafeInteger(remaining)||remaining>limit)return null;
 const serverDate=new Date(headers.get('Date')??'');
 const day=Number.isFinite(serverDate.getTime())?serverDate:now;
 return{provider:'hardcover',usage_date:day.toISOString().slice(0,10),reported_used:limit-remaining,reported_limit:limit,remaining,observed_at:now.toISOString(),source:'response_headers'};
}
export async function finishProviderAttempt(admin:any,id:string,response:Response,provider:string){
 try {
 const {error}=await admin.from('novori_provider_request_log').update({status_code:response.status,completed_at:new Date().toISOString()}).eq('id',id);
 if(error)console.warn('Could not complete provider audit event');
 if(provider==='hardcover'){
  const observation=hardcoverDailyUsage(response.headers);
  if(observation){const {error}=await admin.rpc('novori_store_provider_usage_observation',{p_observation:observation});if(error)console.warn('Could not store provider-reported usage');}
 }
 }catch{console.warn('Could not complete provider audit metadata');}
}
