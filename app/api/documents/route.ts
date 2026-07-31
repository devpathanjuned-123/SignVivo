import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadToDocuments, documentPath } from "@/lib/storage";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { logAuditEventFromRequest } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "Untitled").slice(0, 200);

  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  const workspaceId = await getDefaultWorkspaceId(supabase);
  console.log(workspaceId)
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Create the document row first so we have an id for the storage path.
  const { data: created, error: insertErr } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      created_by: user.id,
      title,
      // Placeholder; updated immediately below once we know the path.
      original_pdf_path: "pending",
    })
    .select("id, workspace_id")
    .single();
  if (insertErr || !created) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const path = documentPath({
    workspaceId: created.workspace_id,
    documentId: created.id,
    kind: "original",
  });
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await uploadToDocuments(supabase, path, bytes, "application/pdf");
  } catch (e: unknown) {
    // Clean up the orphan document row if storage write failed.
    await supabase.from("documents").delete().eq("id", created.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }

  await supabase.from("documents").update({ original_pdf_path: path }).eq("id", created.id);

  // Audit writes go through the dedicated helper, which uses the service-
  // role client. RLS + table privileges deny audit_events writes to every
  // other role.
  await logAuditEventFromRequest(req, {
    documentId: created.id,
    type: "CREATED",
  });

  return NextResponse.json({ id: created.id });
}
