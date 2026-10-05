declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void };
// @ts-ignore -- Supabase Edge npm resolution
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createPublicationHandler } from '../_shared/ugc-screening.mjs';
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
Deno.serve(createPublicationHandler({ client, supabaseUrl: url, publishableKey: Deno.env.get('SUPABASE_ANON_KEY'), openaiKey: Deno.env.get('OPENAI_API_KEY'), catalogImageHosts: (Deno.env.get('NOVORI_CATALOG_IMAGE_HOSTS') ?? '').split(',').map(host=>host.trim().toLowerCase()).filter(Boolean), legalVersion: Deno.env.get('NOVORI_LEGAL_VERSION') ?? '2026-10-05-moderation' }));
