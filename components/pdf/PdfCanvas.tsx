"use client";

import { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { EditorField } from "@/components/editor/types";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
  fields: EditorField[];
  colorFor: Map<string, string>;
  placing: boolean;
  onPlace: (page: number, xPct: number, yPct: number) => void;
  onRemoveField: (id: string) => void;
}

export default function PdfCanvas({ url, fields, colorFor, placing, onPlace, onRemoveField }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    function onResize() {
      const el = document.getElementById("pdf-wrap");
      if (el) setWidth(Math.min(900, el.clientWidth));
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleClick = useCallback(
    (pageNum: number) => (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placing) return;
      const target = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - target.left) / target.width) * 100;
      const yPct = ((e.clientY - target.top) / target.height) * 100;
      onPlace(pageNum, xPct, yPct);
    },
    [placing, onPlace],
  );

  return (
    <div id="pdf-wrap" className="card p-2">
      <Document file={url} onLoadSuccess={({ numPages: n }) => setNumPages(n)} loading={<p className="p-8 text-sm text-gray-500">Loading PDF…</p>}>
        {Array.from(new Array(numPages ?? 0), (_, i) => {
          const pageNum = i + 1;
          const pageFields = fields.filter((f) => f.page === pageNum);
          return (
            <div
              key={pageNum}
              className={`relative mb-4 mx-auto shadow-sm ${placing ? "cursor-crosshair" : ""}`}
              style={{ width }}
              onClick={handleClick(pageNum)}
            >
              <Page pageNumber={pageNum} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
              {pageFields.map((f) => (
                <div
                  key={f.id}
                  className={`absolute rounded ring-2 text-[10px] font-medium flex items-center justify-center select-none ${colorFor.get(f.recipientId) ?? "ring-gray-400 bg-gray-100/60"}`}
                  style={{
                    left: `${f.xPct}%`,
                    top: `${f.yPct}%`,
                    width: `${f.widthPct}%`,
                    height: `${f.heightPct}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveField(f.id);
                  }}
                  title="Click to remove"
                >
                  {f.type}
                </div>
              ))}
            </div>
          );
        })}
      </Document>
    </div>
  );
}
