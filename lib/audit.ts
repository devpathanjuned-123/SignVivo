import "server-only";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditEventType, Json } from "@/types/database";
import { readIp } from "@/lib/utils";

/**
 * Single, server-only entry point for recording an audit event.
 *
 * Why this exists:
 *   - The audit_events table denies INSERT to the `authenticated` role
 *     and to `anon`. Only the service-role client can write to it.
 *   - Channelling every write through one helper means the "must use
 *     the admin client" rule is enforced by the codebase, not by
 *     convention. If a Route Handler tries to log an event with the
 *     SSR client, it will fail at the RLS layer; this helper makes
 *     the right path obvious.
 *   - The `server-only` import means a stray import of this file from
 *     a client component will throw at build time.
 *
 * The function is intentionally fire-and-forget for the caller — it
 * logs errors but does not throw. Audit failures must never break the
 * user-facing flow that triggered them.
 */
const Schema = z.object({
  documentId: z.string().uuid(),
  type: z.enum([
    "CREATED", "SENT", "VIEWED", "SIGNED", "COMPLETED", "DOWNLOADED", "VOIDED",
  ]),
  recipientId: z.string().uuid().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogAuditInput = {
  documentId: string;
  type: AuditEventType;
  recipientId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, Json>;
};

export async function logAuditEvent(input: LogAuditInput): Promise<void> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    console.error("logAuditEvent: invalid input", parsed.error.flatten());
    return;
  }
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("audit_events").insert({
    document_id: parsed.data.documentId,
    type: parsed.data.type,
    recipient_id: parsed.data.recipientId ?? null,
    ip: parsed.data.ip ?? null,
    user_agent: parsed.data.userAgent ?? null,
    metadata: (parsed.data.metadata ?? null) as Json | null,
  });
  if (error) {
    console.error("logAuditEvent: insert failed", { type: input.type, error });
  }
}

/**
 * Convenience: log directly from a Request, pulling IP + UA from headers.
 */
export async function logAuditEventFromRequest(
  req: Request,
  args: Omit<LogAuditInput, "ip" | "userAgent">,
): Promise<void> {
  return logAuditEvent({
    ...args,
    ip: readIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });
}
