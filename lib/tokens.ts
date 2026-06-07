import { randomBytes, timingSafeEqual } from "crypto";

export function newSigningToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function tokenExpiry(daysFromNow = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}
