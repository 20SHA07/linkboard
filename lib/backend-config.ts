import { isStaticExport } from './urls';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

export const hasSupabaseConfiguration = Boolean(supabaseUrl && supabaseKey);
/** An exported site has no local API; account features need its hosted backend. */
export const needsBackendSetup = isStaticExport && !hasSupabaseConfiguration;
export const usesSupabase = isStaticExport || Boolean(supabaseUrl || supabaseKey);
