import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import type { AuditEventType, DocumentStatus, RecipientStatus } from "@/types/database";

const recipientBadge: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  VIEWED: "bg-amber-100 text-amber-800",
  SIGNED: "bg-emerald-100 text-emerald-800",
};

interface DocDetail {
  id: string;
  title: string;
  status: DocumentStatus;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  original_pdf_path: string;
  signed_pdf_path: string | null;
  audit_pdf_path: string | null;
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    status: RecipientStatus;
    signed_at: string | null;
    ord: number;
  }>;
  audit_events: Array<{
    id: string;
    type: AuditEventType;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
  }>;
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("documents")
    .select(`
      id, title, status, created_at, sent_at, completed_at,
      original_pdf_path, signed_pdf_path, audit_pdf_path,
      recipients(id, name, email, status, signed_at, ord),
      audit_events(id, type, ip, user_agent, created_at)
    `)
    .eq("id", id)
    .maybeSingle();

  const doc = data as unknown as DocDetail | null;
  if (!doc) notFound();

  const recipients = (doc.recipients ?? []).slice().sort((a, b) => a.ord - b.ord);
  const events = (doc.audit_events ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const [originalUrl, signedUrl, auditUrl] = await Promise.all([
    createSignedUrl(supabase, doc.original_pdf_path).catch(() => null),
    doc.signed_pdf_path ? createSignedUrl(supabase, doc.signed_pdf_path).catch(() => null) : null,
    doc.audit_pdf_path ? createSignedUrl(supabase, doc.audit_pdf_path).catch(() => null) : null,
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:underline">← Dashboard</Link>
        <h1 className="text-2xl font-semibold mt-2">{doc.title}</h1>
        <p className="text-sm text-gray-600">
          Status: <strong>{doc.status}</strong> · Created {formatDate(doc.created_at)}
          {doc.sent_at && <> · Sent {formatDate(doc.sent_at)}</>}
          {doc.completed_at && <> · Completed {formatDate(doc.completed_at)}</>}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="space-y-6">
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Files</h2>
            <ul className="space-y-2 text-sm">
              {originalUrl && (
                <li><a className="text-brand-600 hover:underline" href={originalUrl} target="_blank">Original PDF</a></li>
              )}
              {signedUrl && (
                <li><a className="text-brand-600 hover:underline font-medium" href={signedUrl} target="_blank">Signed PDF (download)</a></li>
              )}
              {auditUrl && (
                <li><a className="text-brand-600 hover:underline" href={auditUrl} target="_blank">Audit log (PDF)</a></li>
              )}
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold mb-3">Audit trail</h2>
            <ol className="space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">{e.type}</span>
                  <div className="flex-1">
                    <div className="text-gray-700">{formatDate(e.created_at)}</div>
                    <div className="text-xs text-gray-500">
                      {e.ip ? `IP ${e.ip}` : "IP —"} · {e.user_agent?.slice(0, 80) ?? "agent —"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="card p-4 h-fit">
          <h2 className="font-semibold mb-3">Recipients</h2>
          <ul className="space-y-3">
            {recipients.map((r) => (
              <li key={r.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${recipientBadge[r.status]}`}>{r.status}</span>
                </div>
                {r.signed_at && (
                  <div className="text-xs text-gray-500 mt-1">Signed {formatDate(r.signed_at)}</div>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
