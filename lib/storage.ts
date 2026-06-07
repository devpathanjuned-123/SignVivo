import type { AnySupabase } from "@/lib/supabase/types";

export const DOCUMENTS_BUCKET = "documents";

/**
 * Upload a Buffer/Blob to the documents bucket. Returns the storage path.
 * `client` should be the RLS-scoped server client when the action is on
 * behalf of a signed-in user, or the admin client for signer/finalize flows.
 */
export async function uploadToDocuments(
  client: AnySupabase,
  path: string,
  body: Buffer | Blob,
  contentType: string,
): Promise<string> {
  const { error } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Create a short-lived signed URL so the browser can fetch a private PDF.
 */
export async function createSignedUrl(
  client: AnySupabase,
  path: string,
  expiresInSeconds = 60 * 30,
): Promise<string> {
  const { data, error } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

/**
 * Download an object to a Node Buffer (used by the finalizer to read the
 * original PDF before stamping).
 */
export async function downloadFromDocuments(
  client: AnySupabase,
  path: string,
): Promise<Buffer> {
  const { data, error } = await client.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message}`);
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

export function documentPath(args: {
  workspaceId: string;
  documentId: string;
  kind: "original" | "signed" | "audit";
}) {
  return `${args.workspaceId}/${args.documentId}/${args.kind}.pdf`;
}
