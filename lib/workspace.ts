import type { SsrClient } from "@/lib/supabase/types";

/**
 * Find the calling user's default workspace id. Relies on the signup
 * trigger having created one, but falls back to selecting the oldest
 * membership row directly.
 */
export async function getDefaultWorkspaceId(
  supabase: SsrClient,
): Promise<string | null> {
  const rpc = await supabase.rpc("my_default_workspace");
  if (!rpc.error && rpc.data) return rpc.data;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.workspace_id;
}
