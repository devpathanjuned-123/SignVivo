"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", file.name.replace(/\.pdf$/i, ""));
      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { id } = await res.json();
      router.push(`/documents/${id}/edit`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "Upload PDF"}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
