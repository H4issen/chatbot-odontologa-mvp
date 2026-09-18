// app/api/whatsapp/route.ts — T-11
// GET: verificación inicial de Meta (handshake único al registrar el webhook).
// POST se añade en T-12 (HMAC + ack inmediato).

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
