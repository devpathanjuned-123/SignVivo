"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PdfCanvas from "@/components/pdf/PdfCanvas";
import type { EditorField, EditorRecipient, FieldType } from "@/components/editor/types";

const RECIPIENT_COLORS = [
  "ring-blue-500 bg-blue-100/60",
  "ring-emerald-500 bg-emerald-100/60",
  "ring-amber-500 bg-amber-100/60",
  "ring-purple-500 bg-purple-100/60",
];

let localIdCounter = 0;
const localId = () => `local-${++localIdCounter}-${Math.random().toString(36).slice(2, 8)}`;

interface Props {
  documentId: string;
  title: string;
  pdfUrl: string;
  initialRecipients: EditorRecipient[];
  initialFields: EditorField[];
}

export default function Editor({ documentId, title, pdfUrl, initialRecipients, initialFields }: Props) {
  const router = useRouter();
  const [docTitle, setDocTitle] = useState(title);
  const [recipients, setRecipients] = useState<EditorRecipient[]>(
    initialRecipients.length ? initialRecipients : [{ id: localId(), name: "", email: "" }],
  );
  const [fields, setFields] = useState<EditorField[]>(initialFields);
  const [activeRecipientId, setActiveRecipientId] = useState<string>(
    initialRecipients[0]?.id ?? recipients[0].id,
  );
  const [pendingTool, setPendingTool] = useState<FieldType | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    recipients.forEach((r, i) => map.set(r.id, RECIPIENT_COLORS[i % RECIPIENT_COLORS.length]));
    return map;
  }, [recipients]);

  function addRecipient() {
    const id = localId();
    setRecipients((rs) => [...rs, { id, name: "", email: "" }]);
    setActiveRecipientId(id);
  }
  function updateRecipient(id: string, patch: Partial<EditorRecipient>) {
    setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRecipient(id: string) {
    if (recipients.length === 1) return;
    setRecipients((rs) => rs.filter((r) => r.id !== id));
    setFields((fs) => fs.filter((f) => f.recipientId !== id));
    if (activeRecipientId === id) setActiveRecipientId(recipients.find((r) => r.id !== id)!.id);
  }

  function onPlaceField(page: number, xPct: number, yPct: number) {
    if (!pendingTool) return;
    const defaults: Record<FieldType, { w: number; h: number }> = {
      SIGNATURE: { w: 18, h: 6 },
      DATE: { w: 12, h: 4 },
      TEXT: { w: 18, h: 4 },
    };
    const { w, h } = defaults[pendingTool];
    setFields((fs) => [
      ...fs,
      {
        id: localId(),
        recipientId: activeRecipientId,
        type: pendingTool,
        page,
        xPct: Math.max(0, Math.min(100 - w, xPct - w / 2)),
        yPct: Math.max(0, Math.min(100 - h, yPct - h / 2)),
        widthPct: w,
        heightPct: h,
      },
    ]);
    setPendingTool(null);
  }

  function removeField(id: string) {
    setFields((fs) => fs.filter((f) => f.id !== id));
  }

  function validate(): string | null {
    if (!docTitle.trim()) return "Title is required.";
    for (const r of recipients) {
      if (!r.name.trim() || !r.email.trim()) return "Every recipient needs a name and email.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return `Invalid email: ${r.email}`;
    }
    if (fields.length === 0) return "Place at least one field on the document.";
    return null;
  }

  async function save(then?: "send") {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    const setBusy = then === "send" ? setSending : setSaving;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: docTitle, recipients, fields }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      if (then === "send") {
        const sendRes = await fetch(`/api/documents/${documentId}/send`, { method: "POST" });
        if (!sendRes.ok) throw new Error((await sendRes.json()).error ?? "Send failed");
        router.push(`/documents/${documentId}`);
      } else {
        router.refresh();
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="input text-lg font-semibold max-w-md"
            placeholder="Document title"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-gray-600 mr-2">Add field for active recipient:</span>
          {(["SIGNATURE", "DATE", "TEXT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPendingTool((cur) => (cur === t ? null : t))}
              className={`btn ${pendingTool === t ? "btn-primary" : "btn-secondary"} text-xs`}
            >
              {t === "SIGNATURE" ? "Signature" : t === "DATE" ? "Date" : "Text"}
            </button>
          ))}
          {pendingTool && (
            <span className="text-xs text-brand-700">Click on the page to place</span>
          )}
        </div>

        <PdfCanvas
          url={pdfUrl}
          fields={fields}
          colorFor={colorFor}
          placing={!!pendingTool}
          onPlace={onPlaceField}
          onRemoveField={removeField}
        />
      </div>

      <aside className="space-y-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recipients</h2>
            <button className="btn-ghost text-xs" onClick={addRecipient} type="button">+ Add</button>
          </div>
          <div className="space-y-3">
            {recipients.map((r) => (
              <div
                key={r.id}
                className={`rounded-md border p-3 cursor-pointer ${activeRecipientId === r.id ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"}`}
                onClick={() => setActiveRecipientId(r.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-block h-3 w-3 rounded-full ring-2 ${colorFor.get(r.id)}`} />
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); removeRecipient(r.id); }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  className="input mb-2"
                  placeholder="Name"
                  value={r.name}
                  onChange={(e) => updateRecipient(r.id, { name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="email@company.com"
                  type="email"
                  value={r.email}
                  onChange={(e) => updateRecipient(r.id, { email: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-2">Fields placed</h2>
          <p className="text-sm text-gray-600 mb-3">{fields.length} field{fields.length === 1 ? "" : "s"}</p>
          <div className="space-y-2">
            <button
              type="button"
              disabled={saving || sending}
              onClick={() => save()}
              className="btn-secondary w-full"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={saving || sending}
              onClick={() => save("send")}
              className="btn-primary w-full"
            >
              {sending ? "Sending…" : "Send for signature"}
            </button>
          </div>
          {err && <p className="text-xs text-red-600 mt-3">{err}</p>}
        </div>
      </aside>
    </div>
  );
}
