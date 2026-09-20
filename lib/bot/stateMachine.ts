// lib/bot/stateMachine.ts — T-14
// Dispatcher de mensajes + handleBienvenida.
// Máquina de estados: spec §4.

import { prisma } from "../prisma";
import { sendNewPatientAlert } from "../mail";
import { matchKeyword } from "./keywords";
import {
  MENSAJE_BIENVENIDA,
  MENSAJE_CONSENTIMIENTO,
  MENSAJE_REFERIDO_CODIGO,
  MENSAJE_SOLICITUD_NOMBRE,
  MENSAJE_SOLICITUD_MOTIVO,
  MENSAJE_RECHAZADO,
  MENSAJE_CIERRE_HORARIO,
  MENSAJE_DIRECCION,
  MENSAJE_HORARIO,
  DISCLAIMER_SERVICIO,
  MENSAJE_RECURRENTE,
  buildMessage,
} from "./messages";

type BotState =
  | "BIENVENIDA"
  | "REFERIDO_CODIGO"
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
    case "REFERIDO_CODIGO":
      return handleReferidoCodigo(paciente, text);
    case "CONSENTIMIENTO":
      return handleConsentimiento(paciente, text);
    case "RECHAZADO":
      return handleRechazado(paciente, text);
    case "NOMBRE":
      return handleNombre(paciente, text);
    case "MOTIVO":
      return handleMotivo(paciente, text);
    case "CIERRE":
      return handleCierre(paciente, text);
    case "RECURRENTE":
      return handleRecurrente(paciente, text);
    default:
      return handleBienvenida(paciente, text);
  }
}

async function handleBienvenida(paciente: Paciente, text: string): Promise<string> {
  if (text === "1") {
    await prisma.paciente.update({
      where: { phone_number: paciente.phone_number },
      data: { tipo_contacto: "referido", bot_state: "REFERIDO_CODIGO" },
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

async function handleReferidoCodigo(paciente: Paciente, text: string): Promise<string> {
  // Buscar código QR en el texto (formato: REF_DR_... o DR_...)
  const codigoMatch = text.match(/(?:REF_)?(DR_[A-Z0-9_]+)/i);
  
  if (codigoMatch && codigoMatch[1]) {
    const codigo_qr = codigoMatch[1].toUpperCase();
    
    // Buscar doctor por codigo_qr
    const doctor = await prisma.doctorReferidor.findUnique({
      where: { codigo_qr },
    });
    
    if (doctor) {
      // Asignar doctor_referidor_id al paciente
      await prisma.paciente.update({
        where: { phone_number: paciente.phone_number },
        data: { 
          doctor_referidor_id: doctor.id,
          bot_state: "CONSENTIMIENTO" 
        },
      });
      return MENSAJE_CONSENTIMIENTO;
    }
  }
  
  // Si no se encontró código o no es válido, continuar sin asignar doctor
  await prisma.paciente.update({
    where: { phone_number: paciente.phone_number },
    data: { bot_state: "CONSENTIMIENTO" },
  });
  return MENSAJE_CONSENTIMIENTO;
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

async function handleMotivo(paciente: Paciente, text: string): Promise<string> {
  const sanitizado = sanitizarTexto(text);
  
  if (!sanitizado) {
    return MENSAJE_SOLICITUD_MOTIVO;
  }

  await prisma.consulta.create({
    data: {
      paciente_phone: paciente.phone_number,
      motivo_reportado: sanitizado,
    },
  });

  await prisma.paciente.update({
    where: { phone_number: paciente.phone_number },
    data: {
      bot_state: "CIERRE",
      estado: "registrado",
    },
  });

  // Fire-and-forget: enviar alerta SMTP sin bloquear el flujo
  sendNewPatientAlert(paciente.nombre ?? "Paciente", sanitizado).catch((err) => {
    console.error("Error enviando alerta SMTP:", err);
  });

  return MENSAJE_CIERRE_HORARIO;
}

async function handleCierre(paciente: Paciente, text: string): Promise<string> {
  const keyword = matchKeyword(text);

  if (keyword === "direccion") {
    const info = await prisma.consultorioInfo.findUnique({ where: { id: 1 } });
    if (!info) {
      return "Lo siento, no tengo la información de dirección disponible en este momento.";
    }
    return buildMessage(MENSAJE_DIRECCION, {
      direccion_texto: info.direccion_texto,
      maps_url: info.maps_url,
    });
  }

  if (keyword === "horario") {
    const info = await prisma.consultorioInfo.findUnique({ where: { id: 1 } });
    if (!info) {
      return "Lo siento, no tengo la información de horarios disponible en este momento.";
    }
    return buildMessage(MENSAJE_HORARIO, {
      horarios_texto: info.horarios_texto,
    });
  }

  if (keyword === "servicio") {
    const textLower = text.toLowerCase();
    const serviceSlugs = ["corona", "limpieza", "blanqueamiento", "brackets", "implante"];
    const matchedSlug = serviceSlugs.find((slug) => textLower.includes(slug));

    if (matchedSlug) {
      const servicio = await prisma.servicio.findUnique({ where: { slug: matchedSlug } });
      if (servicio) {
        return `${servicio.descripcion_corta} ${DISCLAIMER_SERVICIO}`;
      }
    }

    // Si no se encontró un servicio específico, listar opciones
    return `Puedo orientarle sobre nuestros servicios: corona, limpieza, blanqueamiento, brackets, implante. ¿Sobre cuál le gustaría saber más?`;
  }

  // Cualquier otro texto → avanzar a RECURRENTE
  await prisma.paciente.update({
    where: { phone_number: paciente.phone_number },
    data: { bot_state: "RECURRENTE" },
  });

  return buildMessage(MENSAJE_RECURRENTE, {
    Nombre: paciente.nombre ?? "paciente",
    ultimo_motivo: "su consulta anterior",
  });
}

async function handleRecurrente(paciente: Paciente, text: string): Promise<string> {
  const keyword = matchKeyword(text);

  // Si es keyword → info bajo demanda (igual que handleCierre)
  if (keyword === "direccion") {
    const info = await prisma.consultorioInfo.findUnique({ where: { id: 1 } });
    if (!info) {
      return "Lo siento, no tengo la información de dirección disponible en este momento.";
    }
    return buildMessage(MENSAJE_DIRECCION, {
      direccion_texto: info.direccion_texto,
      maps_url: info.maps_url,
    });
  }

  if (keyword === "horario") {
    const info = await prisma.consultorioInfo.findUnique({ where: { id: 1 } });
    if (!info) {
      return "Lo siento, no tengo la información de horarios disponible en este momento.";
    }
    return buildMessage(MENSAJE_HORARIO, {
      horarios_texto: info.horarios_texto,
    });
  }

  if (keyword === "servicio") {
    const textLower = text.toLowerCase();
    const serviceSlugs = ["corona", "limpieza", "blanqueamiento", "brackets", "implante"];
    const matchedSlug = serviceSlugs.find((slug) => textLower.includes(slug));

    if (matchedSlug) {
      const servicio = await prisma.servicio.findUnique({ where: { slug: matchedSlug } });
      if (servicio) {
        return `${servicio.descripcion_corta} ${DISCLAIMER_SERVICIO}`;
      }
    }

    return `Puedo orientarle sobre nuestros servicios: corona, limpieza, blanqueamiento, brackets, implante. ¿Sobre cuál le gustaría saber más?`;
  }

  // Si no es keyword → interpretar como nuevo motivo
  const sanitizado = text.trim().slice(0, 500);
  
  if (!sanitizado) {
    return buildMessage(MENSAJE_RECURRENTE, {
      Nombre: paciente.nombre ?? "paciente",
      ultimo_motivo: "su consulta anterior",
    });
  }

  // Crear nueva consulta
  await prisma.consulta.create({
    data: {
      paciente_phone: paciente.phone_number,
      motivo_reportado: sanitizado,
    },
  });

  // Avanzar a CIERRE
  await prisma.paciente.update({
    where: { phone_number: paciente.phone_number },
    data: {
      bot_state: "CIERRE",
      estado: "registrado",
    },
  });

  // Fire-and-forget: enviar alerta SMTP
  sendNewPatientAlert(paciente.nombre ?? "Paciente", sanitizado).catch((err) => {
    console.error("Error enviando alerta SMTP:", err);
  });

  return MENSAJE_CIERRE_HORARIO;
}
