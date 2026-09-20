// app/api/pacientes/[phone]/consultas/route.ts — T-26
// GET /api/pacientes/[phone]/consultas — lista de consultas del paciente

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

// GET /api/pacientes/[phone]/consultas
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

  // Verificar que el paciente existe
  const paciente = await prisma.paciente.findUnique({
    where: { phone_number: phone },
  });

  if (!paciente) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // Obtener consultas del paciente ordenadas por created_at DESC
  const consultas = await prisma.consulta.findMany({
    where: { paciente_phone: phone },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(consultas);
}
