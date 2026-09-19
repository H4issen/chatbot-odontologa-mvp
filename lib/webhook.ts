// lib/webhook.ts — T-12
// Helpers del webhook Meta: extracción de wa_id, validación de firma y log.
// Validación lazy de META_APP_SECRET por llamada (política fixups T-07/T-08/T-09):
// nada al importar, error explícito (no silencioso) en el primer POST.
// LogWebhook guarda SOLO metadata (wa_id + event_type + error): nunca payload con datos de salud (spec §13).

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

export function getMetaAppSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    throw new Error("webhook.ts: falta META_APP_SECRET en process.env");
  }
  return secret;
}

export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getMetaAppSecret();
  const signature = signatureHeader ?? "";
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return timingSafeEqual(sigBuf, expBuf);
}

export function extractWaId(body: unknown): string | null {
  try {
    const b = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{ wa_id?: string }>;
            messages?: Array<{ from?: string }>;
          };
        }>;
      }>;
    };
    const value = b?.entry?.[0]?.changes?.[0]?.value;
    const waId = value?.contacts?.[0]?.wa_id ?? value?.messages?.[0]?.from ?? null;
    return waId ? String(waId) : null;
  } catch {
    return null;
  }
}

export async function logWebhookEvent(
  waId: string | null,
  eventType: string,
  error?: string
): Promise<void> {
  try {
    await prisma.logWebhook.create({
      data: {
        wa_id: waId ?? "unknown",
        event_type: eventType,
        error: error ?? null,
      },
    });
  } catch (e) {
    console.error("logWebhookEvent: fallo al escribir LogWebhook", e);
  }
}
