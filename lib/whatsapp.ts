// lib/whatsapp.ts — T-07
// Helper envío mensajes WhatsApp vía Meta Cloud API.
// Validación lazy: sin META_TOKEN/PHONE_NUMBER_ID → lanza al primer envío.

// template: {
//   name: "reactivacion_consulta",
// IMPORTANTE (T-47): este code debe coincidir exacto con la plantilla aprobada en Meta
//  language: { code: "es" },

async function sendRequest(body: Record<string, unknown>): Promise<void> {
  const META_TOKEN = process.env.META_TOKEN;
  if (!META_TOKEN) {
    throw new ReferenceError("whatsapp.ts: falta META_TOKEN en process.env");
  }

  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  if (!PHONE_NUMBER_ID) {
    throw new ReferenceError("whatsapp.ts: falta PHONE_NUMBER_ID en process.env");
  }

  const GRAPH_API_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(GRAPH_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Meta Cloud API error ${response.status}: ${errorBody}`
    );
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await sendRequest({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

export async function sendTemplate(
  to: string,
  nombre: string,
  motivo: string
): Promise<void> {
  await sendRequest({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "reactivacion_consulta",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: nombre },
            { type: "text", text: motivo },
          ],
        },
      ],
    },
  });
}
