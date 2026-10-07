import { readLimited, classify, digest, ScreeningError, screeningResponse } from './ugc-screening.mjs';
/** Signup names are public too. Passwords never enter a moderation input or log. */
export function createSignupHandler({ client, supabaseUrl, publishableKey, openaiKey, legalVersion, transport = fetch }) {
  return async request => {
    if (request.method === 'OPTIONS') return screeningResponse('',200);
    if (request.method !== 'POST') return screeningResponse('Unsupported method.',405);
    let ticket;
    try {
      const raw = new TextDecoder().decode(await readLimited(request,16000));
      if(raw.length>16000) throw new ScreeningError('Invalid signup.',413);
      const body=JSON.parse(raw), meta=body.data;
      if(typeof body.email!=='string'||typeof body.password!=='string'||!meta||typeof meta.username!=='string'||typeof meta.display_name!=='string') throw new ScreeningError('Email, password and profile names are required.');
      if(meta.terms_version!==legalVersion||meta.privacy_version!==legalVersion||meta.adult_confirmed!==true) throw new ScreeningError('Accept the current terms and confirm you are 18 or older.',403);
      if(meta.username.length>100||meta.display_name.length>100) throw new ScreeningError('Profile names are too long.');
      const rate=await client.rpc('novori_claim_registration', { p_email: await digest(body.email.trim().toLowerCase()) });
      if(rate.error||!rate.data) throw new ScreeningError('Too many signups. Please retry in a minute.',429);
      const result=await classify(`username: ${meta.username}\ndisplay name: ${meta.display_name}`,openaiKey,transport);
      if(result.flagged) return screeningResponse('Choose different profile names. Contact support@novori.link if you need help.',422);
      const receipt=await client.rpc('novori_issue_registration_ticket',{p_email:body.email.trim().toLowerCase(),p_names:{username:meta.username,display_name:meta.display_name},p_version:legalVersion});
      if(receipt.error||!receipt.data) throw new ScreeningError('Could not authorize signup. Please retry.',503);
      ticket=receipt.data;
      const query=new URL(request.url).searchParams;
      const redirect=query.get('redirect_to');
      const upstream=new URL('/auth/v1/signup',supabaseUrl);
      if(redirect) upstream.searchParams.set('redirect_to',redirect); // Auth enforces its configured redirect allowlist.
      const response=await transport(upstream,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({...body,data:{...meta,novori_registration_ticket:ticket}}),signal:AbortSignal.timeout(20000)});
      return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    } catch(error) {return screeningResponse(error instanceof ScreeningError ? error.message : 'Could not confirm signup. Try signing in before creating another account.',error instanceof ScreeningError ? error.status : 503);}
    finally {if(ticket) await client.from('novori_registration_tickets').delete().eq('id',ticket);}
  };
}
