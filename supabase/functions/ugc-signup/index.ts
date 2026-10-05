declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void };
// @ts-ignore -- Supabase Edge npm resolution
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createSignupHandler } from '../_shared/ugc-signup.mjs';
const url = Deno.env.get('SUPABASE_URL')!;
const client = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
Deno.serve(createSignupHandler({ client, supabaseUrl: url, publishableKey: Deno.env.get('SUPABASE_ANON_KEY'), openaiKey: Deno.env.get('OPENAI_API_KEY'), legalVersion: Deno.env.get('NOVORI_LEGAL_VERSION') ?? '2026-10-05-moderation' }));
