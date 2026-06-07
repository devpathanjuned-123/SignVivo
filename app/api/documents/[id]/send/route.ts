import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, signRequestEmail } from "@/lib/email";
import { logAuditEventFromRequest } from "@/lib/audit";
import { appUrl } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("documents")
    .select(`
      id, title, status, created_by,
      recipients(id, name, email, signing_token),
      fields(id)
    `)
    .eq("id", id)
    .maybeSingle();
  const doc = data as unknown as {
    id: string;
    title: string;
    status: string;
    created_by: string;
    recipients: Array<{ id: string; name: string; email: string; signing_token: string }>;
    fields: Array<{ id: string }>;
  } | null;
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "DRAFT") return NextResponse.json({ error: "Already sent" }, { status: 409 });
  if ((doc.recipients ?? []).length === 0 || (doc.fields ?? []).length === 0) {
    return NextResponse.json({ error: "Add at least one recipient and field before sending" }, { status: 400 });
  }

  const senderName = user.user_metadata?.full_name ?? user.email ?? "Someone";

  const upd = await supabase
    .from("documents")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

  await logAuditEventFromRequest(req, { documentId: id, type: "SENT" });

  await Promise.all(
    (doc.recipients ?? []).map((r) =>
      sendEmail({
        to: r.email,
        ...signRequestEmail({
          senderName,
          recipientName: r.name,
          documentTitle: doc.title,
          signUrl: appUrl(`/sign/${r.signing_token}`),
        }),
      }).catch((e) => console.error("sendEmail failed for", r.email, e)),
    ),
  );

  return NextResponse.json({ ok: true });
}
