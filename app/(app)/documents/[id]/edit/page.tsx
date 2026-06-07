import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/storage";
import Editor from "@/components/editor/Editor";
import type { DocumentStatus, FieldType } from "@/types/database";

interface DocForEditor {
  id: string;
  title: string;
  status: DocumentStatus;
  original_pdf_path: string;
  recipients: Array<{ id: string; name: string; email: string; ord: number }>;
  fields: Array<{
    id: string;
    recipient_id: string;
    type: FieldType;
    page: number;
    x_pct: number;
    y_pct: number;
    width_pct: number;
    height_pct: number;
  }>;
}

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("documents")
    .select("id, title, status, original_pdf_path, recipients(id, name, email, ord), fields(id, recipient_id, type, page, x_pct, y_pct, width_pct, height_pct)")
    .eq("id", id)
    .maybeSingle();

  const doc = data as unknown as DocForEditor | null;
  if (!doc) notFound();
  if (doc.status !== "DRAFT") redirect(`/documents/${doc.id}`);

  const pdfUrl = await createSignedUrl(supabase, doc.original_pdf_path, 60 * 60);

  const sortedRecipients = (doc.recipients ?? [])
    .slice()
    .sort((a, b) => a.ord - b.ord);

  return (
    <Editor
      documentId={doc.id}
      title={doc.title}
      pdfUrl={pdfUrl}
      initialRecipients={sortedRecipients.map((r) => ({ id: r.id, name: r.name, email: r.email }))}
      initialFields={(doc.fields ?? []).map((f) => ({
        id: f.id,
        recipientId: f.recipient_id,
        type: f.type,
        page: f.page,
        xPct: f.x_pct,
        yPct: f.y_pct,
        widthPct: f.width_pct,
        heightPct: f.height_pct,
      }))}
    />
  );
}
