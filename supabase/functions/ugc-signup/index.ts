import { getServerKey, getPublishableKey } from "../_shared/supabase-keys.mjs";
declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void };
// @ts-ignore -- Supabase Edge npm resolution
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createSignupHandler } from '../_shared/ugc-signup.mjs';
const url = Deno.env.get('SUPABASE_URL')!;
const client = createClient(url, getServerKey(name => Deno.env.get(name))!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
Deno.serve(createSignupHandler({ client, supabaseUrl: url, publishableKey: getPublishableKey(name => Deno.env.get(name)), openaiKey: Deno.env.get('OPENAI_API_KEY'), legalVersion: Deno.env.get('NOVORI_LEGAL_VERSION') ?? '2026-10-05-moderation' }));
