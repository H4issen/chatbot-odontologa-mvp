// app/api/admin/servicios/[slug]/route.ts — T-27
// PATCH /api/admin/servicios/[slug] — actualizar descripcion_corta y precio_desde

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";

// Schema Zod para PATCH
const updateServicioSchema = z.object({
  descripcion_corta: z.string().max(300),
  precio_desde: z.string().optional().nullable(),
});

// Palabras prohibidas en descripcion_corta (guard de contenido)
const PALABRAS_PROHIBIDAS = ["diagnóstico", "diagnostico", "padece", "necesita"];

// Función para normalizar texto (quitar tildes y convertir a minúsculas)
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Quitar tildes
}

// Función para verificar si el texto contiene palabras prohibidas
function contienePalabrasProhibidas(texto: string): string | null {
  const textoNormalizado = normalizarTexto(texto);
  
  for (const palabra of PALABRAS_PROHIBIDAS) {
    const palabraNormalizada = normalizarTexto(palabra);
    if (textoNormalizado.includes(palabraNormalizada)) {
      return palabra;
    }
  }
  
  return null;
}

// PATCH /api/admin/servicios/[slug]
export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } }
) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = params;

  // Parsear y validar body con Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validation = updateServicioSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { descripcion_corta, precio_desde } = validation.data;

  // Guard de contenido: verificar palabras prohibidas
  const palabraProhibida = contienePalabrasProhibidas(descripcion_corta);
  if (palabraProhibida) {
    return NextResponse.json(
      { 
        error: "Contenido no permitido",
        message: `La descripción no puede contener la palabra "${palabraProhibida}"`
      },
      { status: 400 }
    );
  }

  // Verificar que el servicio existe
  const servicioExistente = await prisma.servicio.findUnique({
    where: { slug },
  });

  if (!servicioExistente) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  // Actualizar servicio (solo descripcion_corta y precio_desde)
  const servicioActualizado = await prisma.servicio.update({
    where: { slug },
    data: {
      descripcion_corta,
      precio_desde,
    },
  });

  return NextResponse.json(servicioActualizado);
}
