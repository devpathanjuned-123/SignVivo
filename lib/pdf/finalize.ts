import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { downloadFromDocuments, uploadToDocuments, documentPath, createSignedUrl } from "@/lib/storage";
import { stampPdf } from "@/lib/pdf/render";
import { buildAuditPdfBytes } from "@/lib/pdf/audit";
import { sendEmail, completionEmail } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit";
import { appUrl } from "@/lib/utils";

/**
 * If every recipient on the document has signed, build the signed PDF,
 * build the audit-trail PDF, store both, and notify sender + signers.
 * Safe to call repeatedly — short-circuits once status is COMPLETED.
 */
export async function finalizeIfReady(documentId: string) {
  const admin = getSupabaseAdminClient();

  const { data: doc, error } = await admin
    .from("documents")
    .select(`
      id, title, status, workspace_id, original_pdf_path, created_by,
      owner:profiles!documents_created_by_fkey(email, full_name),
      recipients(id, name, email, status),
      fields(id, recipient_id, type, page, x_pct, y_pct, width_pct, height_pct, value)
    `)
    .eq("id", documentId)
    .maybeSingle();
  if (error || !doc) {
    console.error("finalize: doc lookup failed", error);
    return;
  }
  if (doc.status === "COMPLETED") return;
  const recipients = doc.recipients ?? [];
  if (recipients.length === 0 || recipients.some((r) => r.status !== "SIGNED")) return;

  // 1. Stamp the signed PDF
  const originalBytes = await downloadFromDocuments(admin, doc.original_pdf_path);
  const signedBytes = await stampPdf(
    originalBytes,
    (doc.fields ?? []).map((f) => ({
      type: f.type,
      page: f.page,
      xPct: f.x_pct,
      yPct: f.y_pct,
      widthPct: f.width_pct,
      heightPct: f.height_pct,
      value: f.value,
    })),
  );
  const signedPath = documentPath({
    workspaceId: doc.workspace_id,
    documentId: doc.id,
    kind: "signed",
  });
  await uploadToDocuments(admin, signedPath, Buffer.from(signedBytes), "application/pdf");

  // 2. Insert a COMPLETED audit event so the audit PDF includes it.
  await logAuditEvent({ documentId: doc.id, type: "COMPLETED" });

  const { data: events } = await admin
    .from("audit_events")
    .select("*")
    .eq("document_id", doc.id)
    .order("created_at", { ascending: true });

  const auditBytes = await buildAuditPdfBytes({
    documentTitle: doc.title,
    events: events ?? [],
  });
  const auditPath = documentPath({
    workspaceId: doc.workspace_id,
    documentId: doc.id,
    kind: "audit",
  });
  await uploadToDocuments(admin, auditPath, Buffer.from(auditBytes), "application/pdf");

  // 3. Mark the document complete
  await admin
    .from("documents")
    .update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      signed_pdf_path: signedPath,
      audit_pdf_path: auditPath,
    })
    .eq("id", doc.id);

  // 4. Notify sender + signers with signed URLs to the completed PDF.
  const owner = (doc.owner as unknown as { email: string; full_name: string | null } | null);
  const signedUrl = await createSignedUrl(admin, signedPath, 60 * 60 * 24 * 7);
  const senderViewUrl = appUrl(`/documents/${doc.id}`);

  await Promise.all([
    owner?.email
      ? sendEmail({
          to: owner.email,
          ...completionEmail({
            recipientName: owner.full_name ?? "there",
            documentTitle: doc.title,
            viewUrl: senderViewUrl,
          }),
        }).catch((e) => console.error("owner completion email failed", e))
      : Promise.resolve(),
    ...recipients.map((r) =>
      sendEmail({
        to: r.email,
        ...completionEmail({
          recipientName: r.name,
          documentTitle: doc.title,
          viewUrl: signedUrl,
        }),
      }).catch((e) => console.error("recipient completion email failed", e)),
    ),
  ]);
}
