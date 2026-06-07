import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses RLS — only ever import from
 * server-side code (Route Handlers, Server Actions, background tasks,
 * the signer flow).
 *
 * Defenses against accidental browser exposure:
 *   1. `import "server-only"` — any client component that imports this
 *      file (transitively) fails the Next.js build.
 *   2. `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix, so
 *      Next.js refuses to inline it into client bundles.
 *   3. Runtime check: throws if somehow invoked with a `window` global,
 *      so the failure is loud rather than silently shipping a key.
 */
let admin: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdminClient() called in a browser context. The service-role key must never reach the client.",
    );
  }
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to use the admin client.",
    );
  }
  admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}
