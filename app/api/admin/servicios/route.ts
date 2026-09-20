// app/api/admin/servicios/route.ts — T-27
// GET /api/admin/servicios — lista los 5 servicios

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

// La sesión se verifica por request: nunca prerenderizar en build.
export const dynamic = "force-dynamic";

// GET /api/admin/servicios
export async function GET(request: Request) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Obtener todos los servicios
  const servicios = await prisma.servicio.findMany({
    orderBy: { slug: "asc" },
  });

  return NextResponse.json(servicios);
}
