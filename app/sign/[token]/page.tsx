import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSignedUrl } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { readIp } from "@/lib/utils";
import SignerView from "@/components/signer/SignerView";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Anonymous signers can't use RLS, so we read with the service role and
  // gate access on the signing token alone.
  const admin = getSupabaseAdminClient();

  const { data: recipient } = await admin
    .from("recipients")
    .select(`
      id, name, email, status, token_expires_at,
      document:documents!inner(
        id, title, status, original_pdf_path,
        owner:profiles!documents_created_by_fkey(full_name, email),
        fields(id, recipient_id, type, page, x_pct, y_pct, width_pct, height_pct)
      )
    `)
    .eq("signing_token", token)
    .maybeSingle();

  if (!recipient || !recipient.document) notFound();

  const doc = recipient.document as unknown as {
    id: string;
    title: string;
    status: string;
    original_pdf_path: string;
    owner: { full_name: string | null; email: string } | null;
    fields: Array<{
      id: string;
      recipient_id: string;
      type: "SIGNATURE" | "DATE" | "TEXT";
      page: number;
      x_pct: number;
      y_pct: number;
      width_pct: number;
      height_pct: number;
    }>;
  };

  if (doc.status === "VOIDED") return <SignerInfo title="Document voided" body="The sender has cancelled this request." />;
  if (recipient.status === "SIGNED") return <SignerInfo title="Already signed" body="You've already signed this document. Thanks!" />;
  if (new Date(recipient.token_expires_at) < new Date()) {
    return <SignerInfo title="Link expired" body="Please ask the sender to resend the request." />;
  }

  if (recipient.status === "PENDING") {
    const h = await headers();
    const now = new Date().toISOString();
    await admin.from("recipients").update({ status: "VIEWED", viewed_at: now }).eq("id", recipient.id);
    await logAuditEvent({
      documentId: doc.id,
      recipientId: recipient.id,
      type: "VIEWED",
      ip: readIp(h),
      userAgent: h.get("user-agent"),
    });
  }

  const pdfUrl = await createSignedUrl(admin, doc.original_pdf_path, 60 * 60);
  const myFields = doc.fields.filter((f) => f.recipient_id === recipient.id);

  return (
    <SignerView
      token={token}
      pdfUrl={pdfUrl}
      documentTitle={doc.title}
      senderName={doc.owner?.full_name ?? doc.owner?.email ?? "Sender"}
      recipientName={recipient.name}
      fields={myFields.map((f) => ({
        id: f.id,
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

function SignerInfo({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-gray-600">{body}</p>
      </div>
    </main>
  );
}
