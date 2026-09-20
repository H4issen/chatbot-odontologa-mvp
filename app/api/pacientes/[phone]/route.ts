// app/api/pacientes/[phone]/route.ts — T-23
// GET /api/pacientes/[phone] — detalle completo de un paciente con consultas y ventana

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { calcularVentana } from "../../../../lib/ventana";
import { getSession } from "../../../../lib/auth";

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
