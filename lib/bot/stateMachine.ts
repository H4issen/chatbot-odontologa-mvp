// lib/bot/stateMachine.ts — T-14
// Dispatcher de mensajes + handleBienvenida.
// Máquina de estados: spec §4.

import { prisma } from "../prisma";
import {
  MENSAJE_BIENVENIDA,
  MENSAJE_CONSENTIMIENTO,
  MENSAJE_REFERIDO_CODIGO,
  MENSAJE_SOLICITUD_NOMBRE,
  MENSAJE_SOLICITUD_MOTIVO,
  MENSAJE_RECHAZADO,
  buildMessage,
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
    case "CONSENTIMIENTO":
      return handleConsentimiento(paciente, text);
    case "RECHAZADO":
      return handleRechazado(paciente, text);
    case "NOMBRE":
      return handleNombre(paciente, text);
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

function normalizarTexto(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function sanitizarTexto(text: string): string {
  // Eliminar tags HTML y su contenido (especialmente scripts)
  let limpio = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Eliminar tags HTML restantes
  limpio = limpio.replace(/<[^>]*>/g, "");
  return limpio;
}

async function handleConsentimiento(paciente: Paciente, text: string): Promise<string> {
  const normalizado = normalizarTexto(text);

  if (normalizado === "si" || normalizado === "aceptar" || normalizado === "acepto") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: {
        consentimiento: "aceptado",
        consentimiento_at: new Date(),
        bot_state: "NOMBRE",
        estado: "registrado",
      },
    });
    return MENSAJE_SOLICITUD_NOMBRE;
  }

  if (normalizado === "no") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: {
        consentimiento: "rechazado",
        consentimiento_at: new Date(),
        bot_state: "RECHAZADO",
      },
    });
    return MENSAJE_RECHAZADO;
  }

  return MENSAJE_CONSENTIMIENTO;
}

async function handleRechazado(paciente: Paciente, text: string): Promise<string> {
  const normalizado = normalizarTexto(text);

  if (normalizado === "aceptar" || normalizado === "acepto" || normalizado === "si") {
    if (paciente.nombre !== null) {
      await prisma.paciente.update({
        where: { phone_number: paciente.phone_number },
        data: { bot_state: "BIENVENIDA" },
      });
      return MENSAJE_BIENVENIDA;
    }

    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: {
        consentimiento: "aceptado",
        consentimiento_at: new Date(),
        bot_state: "NOMBRE",
      },
    });
    return MENSAJE_SOLICITUD_NOMBRE;
  }

  return MENSAJE_RECHAZADO;
}

async function handleNombre(paciente: Paciente, text: string): Promise<string> {
  const sanitizado = sanitizarTexto(text);
  
  if (!sanitizado) {
    return MENSAJE_SOLICITUD_NOMBRE;
  }

  await prisma.paciente.update({
    where: { phone_number: paciente.phone_number },
    data: {
      nombre: sanitizado,
      bot_state: "MOTIVO",
    },
  });

  return buildMessage(MENSAJE_SOLICITUD_MOTIVO, { Nombre: sanitizado });
}
