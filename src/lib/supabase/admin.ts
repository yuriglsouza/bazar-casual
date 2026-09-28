import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("A automação ainda não foi configurada no servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
