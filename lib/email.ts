import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "SignVivo <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient() {
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing, logging instead:\n", opts);
    return { id: "dev-noop" };
  }
  return getClient().emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export function signRequestEmail(args: {
  senderName: string;
  recipientName: string;
  documentTitle: string;
  signUrl: string;
}) {
  const subject = `${args.senderName} sent you "${args.documentTitle}" to sign`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">
      <h1 style="font-size:20px;margin:0 0 16px">${escape(args.senderName)} sent you a document to sign</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Hi ${escape(args.recipientName)},</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">
        Please review and sign <strong>${escape(args.documentTitle)}</strong>.
      </p>
      <p style="margin:24px 0">
        <a href="${args.signUrl}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600">Review &amp; Sign</a>
      </p>
      <p style="font-size:12px;color:#6b7280;margin-top:32px">Powered by SignVivo</p>
    </div>`;
  const text = `${args.senderName} sent you "${args.documentTitle}" to sign.\n\nSign here: ${args.signUrl}`;
  return { subject, html, text };
}

export function completionEmail(args: {
  recipientName: string;
  documentTitle: string;
  viewUrl: string;
}) {
  const subject = `"${args.documentTitle}" has been signed by all parties`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">
      <h1 style="font-size:20px;margin:0 0 16px">Document completed</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Hi ${escape(args.recipientName)},</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">
        <strong>${escape(args.documentTitle)}</strong> has been signed by all parties. You can download the signed copy and audit log below.
      </p>
      <p style="margin:24px 0">
        <a href="${args.viewUrl}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600">View document</a>
      </p>
    </div>`;
  return { subject, html };
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
