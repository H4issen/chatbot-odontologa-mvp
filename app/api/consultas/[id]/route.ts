// app/api/consultas/[id]/route.ts — T-26
// PATCH /api/consultas/[id] — actualizar diagnóstico de la doctora

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

// Schema Zod para PATCH
const updateConsultaSchema = z.object({
  diagnostico_doctora: z.string().max(2000),
});

// PATCH /api/consultas/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parsear id
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Parsear y validar body con Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validation = updateConsultaSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { diagnostico_doctora } = validation.data;

  // Verificar que la consulta existe
  const consultaExistente = await prisma.consulta.findUnique({
    where: { id },
  });

  if (!consultaExistente) {
    return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  }

  // Actualizar consulta
  const consultaActualizada = await prisma.consulta.update({
    where: { id },
    data: { diagnostico_doctora },
  });

  return NextResponse.json(consultaActualizada);
}
