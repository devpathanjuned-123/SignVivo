import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuditEventRow } from "@/types/database";

export async function buildAuditPdfBytes(args: {
  documentTitle: string;
  events: AuditEventRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([612, 792]);
  let y = 740;
  const margin = 48;

  const draw = (s: string, opts: { size?: number; bold?: boolean; gray?: boolean } = {}) => {
    const size = opts.size ?? 11;
    if (y < 60) { page = pdf.addPage([612, 792]); y = 740; }
    page.drawText(s, {
      x: margin,
      y,
      size,
      font: opts.bold ? bold : font,
      color: opts.gray ? rgb(0.4, 0.4, 0.45) : rgb(0.1, 0.12, 0.18),
    });
    y -= size + 6;
  };

  draw("SignVivo Audit Log", { size: 20, bold: true });
  draw(args.documentTitle, { size: 13, bold: true });
  draw(`Generated ${new Date().toISOString()}`, { gray: true });
  y -= 12;
  draw("Event history", { size: 13, bold: true });

  for (const e of args.events) {
    draw(`[${e.type}] ${new Date(e.created_at).toISOString()}`, { bold: true });
    draw(`  IP ${e.ip ?? "—"}`, { gray: true, size: 10 });
    if (e.user_agent) draw(`  UA ${e.user_agent.slice(0, 110)}`, { gray: true, size: 9 });
    y -= 4;
  }

  return pdf.save();
}
