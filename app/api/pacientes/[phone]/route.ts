// app/api/pacientes/[phone]/route.ts — T-23 + T-24
// GET /api/pacientes/[phone] — detalle completo de un paciente con consultas y ventana
// PATCH /api/pacientes/[phone] — actualizar estado o nombre del paciente

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { calcularVentana } from "../../../../lib/ventana";
import { getSession } from "../../../../lib/auth";

// Schema Zod para PATCH (T-24)
const updatePacienteSchema = z.object({
  estado: z.enum(["nuevo", "registrado", "citado_externo", "archivado"]).optional(),
  nombre: z.string().max(500).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { phone: string } }
) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Decodificar phone (URI-encoded)
  const phone = decodeURIComponent(params.phone);

  // Buscar paciente con todas sus consultas y doctor referidor
  const paciente = await prisma.paciente.findUnique({
    where: { phone_number: phone },
    include: {
      consultas: {
        orderBy: { created_at: "desc" },
      },
      doctor_referidor: true,
    },
  });

  // Si no existe → 404
  if (!paciente) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // Calcular ventana
  const ventana = calcularVentana(paciente.last_patient_msg_at);

  // Construir respuesta
  const respuesta = {
    phone_number: paciente.phone_number,
    nombre: paciente.nombre,
    tipo_contacto: paciente.tipo_contacto,
    consentimiento: paciente.consentimiento,
    consentimiento_at: paciente.consentimiento_at,
    estado: paciente.estado,
    bot_state: paciente.bot_state,
    last_patient_msg_at: paciente.last_patient_msg_at,
    created_at: paciente.created_at,
    updated_at: paciente.updated_at,
    ventana,
    doctor_referidor: paciente.doctor_referidor,
    consultas: paciente.consultas,
  };

  return NextResponse.json(respuesta);
}

// PATCH /api/pacientes/[phone] — actualizar estado o nombre (T-24)
export async function PATCH(
  request: Request,
  { params }: { params: { phone: string } }
) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Decodificar phone (URI-encoded)
  const phone = decodeURIComponent(params.phone);

  // Parsear y validar body con Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validation = updatePacienteSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { estado, nombre } = validation.data;

  // Verificar que el paciente existe
  const pacienteExistente = await prisma.paciente.findUnique({
    where: { phone_number: phone },
  });

  if (!pacienteExistente) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // Sanitizar nombre si se proporciona (trim + escape básico de HTML)
  let nombreSanitizado: string | undefined;
  if (nombre !== undefined) {
    nombreSanitizado = nombre
      .trim()
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  // Construir objeto de actualización (solo campos permitidos)
  const data: { estado?: "nuevo" | "registrado" | "citado_externo" | "archivado"; nombre?: string } = {};
  if (estado !== undefined) data.estado = estado;
  if (nombreSanitizado !== undefined) data.nombre = nombreSanitizado;

  // Actualizar paciente
  const pacienteActualizado = await prisma.paciente.update({
    where: { phone_number: phone },
    data,
  });

  return NextResponse.json(pacienteActualizado);
}
