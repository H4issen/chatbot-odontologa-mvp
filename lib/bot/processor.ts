// lib/bot/processor.ts — T-21
// Conecta webhook POST con la máquina de estados y el envío de respuesta.
// Nunca guarda payload/texto del mensaje: protección de datos de salud (spec §13).

import { handleMessage } from "./stateMachine";
import { sendText } from "../whatsapp";
import { logWebhookEvent } from "../webhook";

export async function processWebhook(body: unknown, waId: string | null): Promise<void> {
  // Si no hay waId (status callback), skip silencioso
  if (!waId) {
    await logWebhookEvent(null, "status");
    return;
  }

  try {
    // Extraer texto del payload Meta
    const text = extractText(body);
    
    // Si no es mensaje de texto (status, imagen, etc.), ignorar
    if (text === null) {
      return;
    }

    // Procesar mensaje a través de la máquina de estados
    const respuesta = await handleMessage(waId, text);

    // Enviar respuesta vía WhatsApp
    await sendText(waId, respuesta);
  } catch (error) {
    // Loguear error sin exponer datos de salud
    await logWebhookEvent(waId, "process_error", (error as Error).message);
  }
}

function extractText(body: unknown): string | null {
  try {
    const payload = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              type?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      }>;
    };

    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    // Solo procesar mensajes de texto
    if (!message || message.type !== "text" || !message.text?.body) {
      return null;
    }

    return message.text.body;
  } catch {
    return null;
  }
}
