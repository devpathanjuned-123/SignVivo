"use client";

import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

interface Props {
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

export default function SignaturePadModal({ onCancel, onSave }: Props) {
  const ref = useRef<SignatureCanvas>(null);

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-20 p-6" onClick={onCancel}>
      <div className="card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-2">Draw your signature</h2>
        <p className="text-sm text-gray-600 mb-4">Use your mouse or finger to sign below.</p>
        <div className="border rounded-md bg-white">
          <SignatureCanvas
            ref={ref}
            penColor="#111827"
            canvasProps={{ width: 480, height: 180, className: "w-full h-44 rounded-md" }}
          />
        </div>
        <div className="flex items-center justify-between mt-4">
          <button type="button" className="btn-ghost" onClick={() => ref.current?.clear()}>Clear</button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!ref.current || ref.current.isEmpty()) return;
                const data = ref.current.getCanvas().toDataURL("image/png");
                onSave(data);
              }}
            >
              Save signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
