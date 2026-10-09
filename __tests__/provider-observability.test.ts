import {hardcoverDailyUsage} from '../supabase/functions/_shared/provider-observability';
test('uses the daily policy rather than the minute burst to report actual provider usage',()=>{
 const headers=new Headers({'RateLimit-Policy':'"Free";q=10;w=60;burst=10, "daily";q=5000;w=86400','RateLimit':'"Free";r=3;t=0, "daily";r=4860;t=10000'});
 expect(hardcoverDailyUsage(headers,new Date('2026-10-09T18:00:00Z'))).toMatchObject({usage_date:'2026-10-09',reported_used:140,reported_limit:5000,remaining:4860});
});
test('missing or malformed daily headers are unknown, not a guessed counter',()=>{
 expect(hardcoverDailyUsage(new Headers({'RateLimit':'"Free";r=3;t=0'}))).toBeNull();
 expect(hardcoverDailyUsage(new Headers({'X-RateLimit-Daily-Limit':'5000','X-RateLimit-Daily-Remaining':'6000'}))).toBeNull();
 expect(hardcoverDailyUsage(new Headers({'X-RateLimit-Daily-Limit':'5000','X-RateLimit-Daily-Remaining':'4860'}))).toMatchObject({reported_used:140});
});
test('a response completed across UTC midnight belongs to its provider response day',()=>{
 const headers=new Headers({'Date':'Fri, 09 Oct 2026 23:59:59 GMT','X-RateLimit-Daily-Limit':'5000','X-RateLimit-Daily-Remaining':'4860'});
 expect(hardcoverDailyUsage(headers,new Date('2026-10-10T00:00:01Z'))).toMatchObject({usage_date:'2026-10-09',reported_used:140});
});
