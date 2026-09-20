// app/api/pacientes/route.ts — T-22
// GET /api/pacientes — lista paginada con ventana calculada

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { calcularVentana } from "../../../lib/ventana";
import { getSession } from "../../../lib/auth";

// La sesión se verifica por request: nunca prerenderizar en build.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parsear query params
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  // Obtener pacientes paginados
  const pacientes = await prisma.paciente.findMany({
    skip,
    take: limit,
    orderBy: {
      last_patient_msg_at: {
        sort: "desc",
        nulls: "last",
      },
    },
    include: {
      _count: {
        select: { consultas: true },
      },
      consultas: {
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });

  // Calcular ventana para cada paciente
  const pacientesConVentana = pacientes.map((paciente) => {
    const ventana = calcularVentana(paciente.last_patient_msg_at);
    const ultimaConsulta = paciente.consultas[0] || null;

    return {
      phone_number: paciente.phone_number,
      nombre: paciente.nombre,
      tipo_contacto: paciente.tipo_contacto,
      consentimiento: paciente.consentimiento,
      estado: paciente.estado,
      bot_state: paciente.bot_state,
      last_patient_msg_at: paciente.last_patient_msg_at,
      created_at: paciente.created_at,
      ventana,
      _count: paciente._count,
      ultimaConsulta,
    };
  });

  return NextResponse.json(pacientesConVentana);
}
