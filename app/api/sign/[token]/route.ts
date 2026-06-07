import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAuditEventFromRequest } from "@/lib/audit";
import { finalizeIfReady } from "@/lib/pdf/finalize";

export const runtime = "nodejs";

// Hard caps to keep a malicious signer from pushing a multi-megabyte
// payload into the DB. A normal drawn signature serialises to <30KB; a
// generous 256KB ceiling tolerates high-DPI screens without exposing us
// to abuse. Text/date fields are bounded by what a human types into a
// PDF stamp.
const MAX_SIGNATURE_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 500;

const Body = z.object({
  values: z.record(z.string(), z.string().max(MAX_SIGNATURE_BYTES)),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // Signers are unauthenticated. We bypass RLS with the service-role
  // client and gate access purely on possession of the signing_token.
  const admin = getSupabaseAdminClient();

  const { data } = await admin
    .from("recipients")
    .select(`
      id, status, token_expires_at,
      document:documents!inner(id, status,
        fields(id, recipient_id, type)
      )
    `)
    .eq("signing_token", token)
    .maybeSingle();

  const recipient = data as unknown as {
    id: string;
    status: "PENDING" | "VIEWED" | "SIGNED";
    token_expires_at: string;
    document: {
      id: string;
      status: "DRAFT" | "SENT" | "COMPLETED" | "VOIDED";
      fields: Array<{ id: string; recipient_id: string; type: "SIGNATURE" | "DATE" | "TEXT" }>;
    } | null;
  } | null;

  if (!recipient || !recipient.document) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }
  // Replay guard: a signed recipient can never resubmit.
  if (recipient.status === "SIGNED") {
    return NextResponse.json({ error: "Already signed" }, { status: 409 });
  }
  if (new Date(recipient.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  const doc = recipient.document;
  if (doc.status === "VOIDED") {
    return NextResponse.json({ error: "Document voided" }, { status: 409 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const myFields = doc.fields.filter((f) => f.recipient_id === recipient.id);
  for (const f of myFields) {
    const v = parsed.data.values[f.id];
    if (!v || v.length === 0) {
      return NextResponse.json({ error: `Missing value for field ${f.id}` }, { status: 400 });
    }
    // Per-type validation: signatures must be data URLs, text/date stay
    // short and printable.
    if (f.type === "SIGNATURE") {
      if (!v.startsWith("data:image/")) {
        return NextResponse.json({ error: "Signature must be an image data URL" }, { status: 400 });
      }
      if (v.length > MAX_SIGNATURE_BYTES) {
        return NextResponse.json({ error: "Signature too large" }, { status: 413 });
      }
    } else {
      if (v.length > MAX_TEXT_LENGTH) {
        return NextResponse.json({ error: `Field ${f.id} too long` }, { status: 400 });
      }
    }
  }

  // Persist values. Signature data URLs stay inline so the finalizer
  // can embed them directly with pdf-lib.
  for (const f of myFields) {
    const v = parsed.data.values[f.id];
    const upd = await admin.from("fields").update({ value: v }).eq("id", f.id);
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }

  await admin
    .from("recipients")
    .update({ status: "SIGNED", signed_at: new Date().toISOString() })
    .eq("id", recipient.id);

  await logAuditEventFromRequest(req, {
    documentId: doc.id,
    type: "SIGNED",
    recipientId: recipient.id,
  });

  // Finalize in the background; don't make the signer wait on PDF
  // generation + email delivery.
  finalizeIfReady(doc.id).catch((e) => console.error("finalize failed", e));

  return NextResponse.json({ ok: true });
}
