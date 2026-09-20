// lib/bot/stateMachine.ts — T-14
// Dispatcher de mensajes + handleBienvenida.
// Máquina de estados: spec §4.

import { prisma } from "../prisma";
import {
  MENSAJE_BIENVENIDA,
  MENSAJE_CONSENTIMIENTO,
  MENSAJE_REFERIDO_CODIGO,
} from "./messages";

type BotState =
  | "BIENVENIDA"
  | "CONSENTIMIENTO"
  | "NOMBRE"
  | "MOTIVO"
  | "CIERRE"
  | "RECURRENTE"
  | "RECHAZADO";

interface Paciente {
  phone_number: string;
  bot_state: string;
  nombre: string | null;
  tipo_contacto: "referido" | "conocido" | "empresa" | null;
  consentimiento: "pendiente" | "aceptado" | "rechazado";
}

export async function handleMessage(waId: string, rawText: string): Promise<string> {
  const text = rawText.trim().slice(0, 500);

  const paciente = await prisma.paciente.upsert({
    where: { phone_number: waId },
    create: { phone_number: waId, bot_state: "BIENVENIDA" },
    update: { last_patient_msg_at: new Date() },
  });

  await prisma.paciente.update({
    where: { phone_number: waId },
    data: { last_patient_msg_at: new Date() },
  });

  switch (paciente.bot_state as BotState) {
    case "BIENVENIDA":
      return handleBienvenida(paciente, text);
    default:
      return handleBienvenida(paciente, text);
  }
}

async function handleBienvenida(paciente: Paciente, text: string): Promise<string> {
  if (text === "1") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: { tipo_contacto: "referido", bot_state: "CONSENTIMIENTO" },
    });
    return MENSAJE_REFERIDO_CODIGO;
  }

  if (text === "2") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: { tipo_contacto: "conocido", bot_state: "CONSENTIMIENTO" },
    });
    return MENSAJE_CONSENTIMIENTO;
  }

  if (text === "3") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: { tipo_contacto: "empresa", bot_state: "CONSENTIMIENTO" },
    });
    return MENSAJE_CONSENTIMIENTO;
  }

  return MENSAJE_BIENVENIDA;
}
