"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import SignaturePadModal from "@/components/signer/SignaturePadModal";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type FieldType = "SIGNATURE" | "DATE" | "TEXT";

interface SignerField {
  id: string;
  type: FieldType;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

interface Props {
  token: string;
  pdfUrl: string;
  documentTitle: string;
  senderName: string;
  recipientName: string;
  fields: SignerField[];
}

export default function SignerView({ token, pdfUrl, documentTitle, senderName, recipientName, fields }: Props) {
  const router = useRouter();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState(800);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const today = new Date().toLocaleDateString();
    for (const f of fields) if (f.type === "DATE") initial[f.id] = today;
    return initial;
  });
  const [signing, setSigning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onResize() {
      const el = document.getElementById("signer-pdf-wrap");
      if (el) setWidth(Math.min(900, el.clientWidth));
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const allFilled = useMemo(
    () => fields.every((f) => !!values[f.id] && values[f.id].length > 0),
    [fields, values],
  );

  async function submit() {
    setErr(null);
    if (!allFilled) { setErr("Please complete every field before submitting."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Submit failed");
      router.push(`/sign/${token}/done`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }

  // FiX BUG TEST
console.log("Fields received:", fields);
  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">From {senderName}</p>
            <h1 className="font-semibold">{documentTitle}</h1>
          </div>
          <button
            onClick={submit}
            disabled={submitting || !allFilled}
            className="btn-primary"
          >
            {submitting ? "Submitting…" : "Finish signing"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <p className="text-sm text-gray-600 mb-4">
          Hi {recipientName}, please complete the highlighted fields below and click <strong>Finish signing</strong>.
        </p>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <div id="signer-pdf-wrap" className="card p-2">
          <Document file={pdfUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)} loading={<p className="p-8 text-sm text-gray-500">Loading…</p>}>
            {Array.from(new Array(numPages ?? 0), (_, i) => {
              const pageNum = i + 1;
              const pageFields = fields.filter((f) => f.page === pageNum);

              // FIX BUG TEST
              console.log("Page:", pageNum, pageFields);
              return (
                <div key={pageNum} className="relative mb-4 mx-auto shadow-sm" style={{ width }}>
                  <Page pageNumber={pageNum} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
                  {pageFields.map((f) => (
                    <SignerFieldBox
                      key={f.id}
                      field={f}
                      value={values[f.id]}
                      onChange={(v) => setValues((cur) => ({ ...cur, [f.id]: v }))}
                      onOpenSig={() => setSigning(f.id)}
                    />
                  ))}
                </div>
              );
            })}
          </Document>
        </div>
      </div>

      {signing && (
        <SignaturePadModal
          onCancel={() => setSigning(null)}
          onSave={(dataUrl) => {
            setValues((cur) => ({ ...cur, [signing!]: dataUrl }));
            setSigning(null);
          }}
        />
      )}
    </main>
  );
}

function SignerFieldBox({
  field,
  value,
  onChange,
  onOpenSig,
}: {
  field: SignerField;
  value?: string;
  onChange: (v: string) => void;
  onOpenSig: () => void;
}) {
  const style = {
    left: `${field.xPct}%`,
    top: `${field.yPct}%`,
    width: `${field.widthPct}%`,
    height: `${field.heightPct}%`,
  } as const;
  const base = "absolute rounded ring-2 ring-amber-500 bg-amber-100/40 flex items-center justify-center text-xs";

  if (field.type === "SIGNATURE") {
    return (
      <button type="button" className={`${base} ${value ? "bg-white" : "hover:bg-amber-200/60"}`} style={style} onClick={onOpenSig}>
        {value ? <img src={value} alt="signature" className="max-h-full max-w-full" /> : <span className="font-medium text-amber-900">Click to sign</span>}
      </button>
    );
  }
  return (
    <input
      className={`${base} bg-white px-1 text-sm`}
      style={style}
      placeholder={field.type === "DATE" ? "Date" : "Type here"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
