import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Body = z.object({
  title: z.string().min(1).max(200),
  recipients: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(120),
      email: z.string().email(),
    }),
  ).min(1),
  fields: z.array(
    z.object({
      id: z.string(),
      recipientId: z.string(),
      type: z.enum(["SIGNATURE", "DATE", "TEXT"]),
      page: z.number().int().min(1),
      xPct: z.number().min(0).max(100),
      yPct: z.number().min(0).max(100),
      widthPct: z.number().min(0.1).max(100),
      heightPct: z.number().min(0.1).max(100),
    }),
  ).min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "DRAFT") return NextResponse.json({ error: "Document already sent" }, { status: 409 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { title, recipients, fields } = parsed.data;

  const recipientIds = new Set(recipients.map((r) => r.id));
  for (const f of fields) {
    if (!recipientIds.has(f.recipientId)) {
      return NextResponse.json({ error: "Field references unknown recipient" }, { status: 400 });
    }
  }

  // Wipe and re-insert recipients + fields. Cheaper than diffing for MVP.
  const wipeFields = await supabase.from("fields").delete().eq("document_id", id);
  if (wipeFields.error) return NextResponse.json({ error: wipeFields.error.message }, { status: 500 });
  const wipeRecipients = await supabase.from("recipients").delete().eq("document_id", id);
  if (wipeRecipients.error) return NextResponse.json({ error: wipeRecipients.error.message }, { status: 500 });

  const recipientRows = recipients.map((r, idx) => ({
    document_id: id,
    name: r.name,
    email: r.email,
    ord: idx,
  }));
  const { data: createdRecipients, error: rErr } = await supabase
    .from("recipients")
    .insert(recipientRows)
    .select("id, ord");
  if (rErr || !createdRecipients) {
    return NextResponse.json({ error: rErr?.message ?? "Recipient insert failed" }, { status: 500 });
  }

  // Map local recipient ids → newly-created DB ids by their order index.
  const localOrderToDb = new Map<number, string>();
  createdRecipients.forEach((r) => localOrderToDb.set(r.ord, r.id));
  const localToDb = new Map<string, string>();
  recipients.forEach((r, idx) => {
    const dbId = localOrderToDb.get(idx);
    if (dbId) localToDb.set(r.id, dbId);
  });

  const fieldRows = fields.map((f) => ({
    document_id: id,
    recipient_id: localToDb.get(f.recipientId)!,
    type: f.type,
    page: f.page,
    x_pct: f.xPct,
    y_pct: f.yPct,
    width_pct: f.widthPct,
    height_pct: f.heightPct,
  }));
  const fInsert = await supabase.from("fields").insert(fieldRows);
  if (fInsert.error) return NextResponse.json({ error: fInsert.error.message }, { status: 500 });

  const tUpdate = await supabase.from("documents").update({ title }).eq("id", id);
  if (tUpdate.error) return NextResponse.json({ error: tUpdate.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
