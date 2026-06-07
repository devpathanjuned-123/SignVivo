import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Concrete client types derived from our factories. Use these for
 * helper functions that accept "a Supabase client" so the type stays
 * in sync with @supabase/supabase-js without us hand-stitching generics.
 */
export type SsrClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
export type AnySupabase = SsrClient | AdminClient;
