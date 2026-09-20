import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

// Schema para validación de PATCH
const consultorioSchema = z.object({
  direccion_texto: z.string().min(1),
  maps_url: z.string().url(),
  horarios_texto: z.string().min(1),
});

// GET /api/admin/consultorio
export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const consultorio = await prisma.consultorioInfo.findUnique({
      where: { id: 1 },
    });

    if (!consultorio) {
      return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 });
    }

    return NextResponse.json(consultorio);
  } catch (error) {
    console.error('Error en GET /api/admin/consultorio:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/admin/consultorio
export async function PATCH(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar con Zod
    const validation = consultorioSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { direccion_texto, maps_url, horarios_texto } = validation.data;

    // Actualizar la fila única (id = 1)
    const consultorio = await prisma.consultorioInfo.update({
      where: { id: 1 },
      data: {
        direccion_texto,
        maps_url,
        horarios_texto,
      },
    });

    return NextResponse.json(consultorio);
  } catch (error) {
    console.error('Error en PATCH /api/admin/consultorio:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
