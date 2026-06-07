import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface RenderField {
  type: "SIGNATURE" | "DATE" | "TEXT";
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  value: string | null;
}

/**
 * Stamp `fields` onto a copy of the original PDF and return the bytes.
 * Caller is responsible for uploading the result to storage.
 */
export async function stampPdf(originalBytes: Buffer, fields: RenderField[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalBytes);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of fields) {
    if (!f.value) continue;
    const page = pages[f.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    const x = (f.xPct / 100) * pw;
    const w = (f.widthPct / 100) * pw;
    const h = (f.heightPct / 100) * ph;
    // PDF origin is bottom-left; field coords are top-down.
    const y = ph - (f.yPct / 100) * ph - h;

    if (f.type === "SIGNATURE" && f.value.startsWith("data:image/")) {
      const imgBytes = Buffer.from(f.value.split(",")[1], "base64");
      const img = f.value.startsWith("data:image/png")
        ? await pdf.embedPng(imgBytes)
        : await pdf.embedJpg(imgBytes);
      const scale = Math.min(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      page.drawImage(img, {
        x: x + (w - drawW) / 2,
        y: y + (h - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } else {
      const fontSize = Math.min(h * 0.7, 14);
      page.drawText(f.value, {
        x: x + 2,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        font: helv,
        color: rgb(0.07, 0.09, 0.15),
        maxWidth: w - 4,
      });
    }
  }

  return pdf.save();
}
