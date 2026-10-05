declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void };
// @ts-ignore -- Supabase Edge npm resolution
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createMediaHandler } from '../_shared/ugc-media.mjs';
const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
Deno.serve(createMediaHandler({ client, openaiKey: Deno.env.get('OPENAI_API_KEY'), legalVersion: Deno.env.get('NOVORI_LEGAL_VERSION') ?? '2026-10-05-moderation' }));
