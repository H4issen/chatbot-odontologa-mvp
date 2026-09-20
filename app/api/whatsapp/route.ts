// app/api/whatsapp/route.ts — T-11 (GET) + T-12 (POST) + T-21 (processWebhook)
// GET: verificación inicial de Meta (handshake único al registrar el webhook).
// POST: firma HMAC-SHA256 timing-safe, rate-limit por wa_id, ack inmediato y despacho background.

import { isRateLimited } from "../../../lib/ratelimit";
import { verifySignature, extractWaId, logWebhookEvent } from "../../../lib/webhook";
import { processWebhook } from "../../../lib/bot/processor";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  // 1. Leer body crudo ANTES de cualquier parseo
  const rawBody = await req.text();

  // 2. Validar firma (timing-safe). Sin META_APP_SECRET → error explícito, no silencioso.
  const signature = req.headers.get("x-hub-signature-256");
  let signatureOk: boolean;
  try {
    signatureOk = verifySignature(rawBody, signature);
  } catch (e) {
    console.error("webhook POST:", (e as Error).message);
    return new Response("Server misconfigured: META_APP_SECRET", { status: 500 });
  }

  if (!signatureOk) {
    await logWebhookEvent(null, "auth_failure", "Firma inválida o ausente");
    return new Response("Unauthorized", { status: 401 });
  }

  // 3. Parsear body y extraer wa_id
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Deuda T-12 resuelta: JSON inválido → 200 silencioso + log (evita loop de reintentos de Meta)
    await logWebhookEvent(null, "invalid_json", "JSON inválido");
    return new Response("OK", { status: 200 });
  }

  const waId = extractWaId(body);

  // 4. Status callback (waId null) → skip silencioso, sin rate-limit
  if (!waId) {
    await logWebhookEvent(null, "status");
    return new Response("OK", { status: 200 });
  }

  // 5. Rate-limit 30/min por wa_id → 200 silencioso si excede (Meta no reintenta)
  if (isRateLimited(waId, 30, 60_000)) {
    return new Response("OK", { status: 200 });
  }

  // 6. Procesar en background (sin await) + ACK inmediato (< 5s o Meta reintenta)
  processWebhook(body, waId).catch((e) =>
    logWebhookEvent(waId, "process_error", (e as Error).message)
  );

  return new Response("OK", { status: 200 });
}
