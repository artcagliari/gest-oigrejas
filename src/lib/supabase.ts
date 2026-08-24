import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const forceDemo = import.meta.env.VITE_FORCE_DEMO === "true";

export const supabase: SupabaseClient | null =
  !forceDemo && url && anonKey ? createClient(url, anonKey) : null;

export const isDemoMode = !supabase;
