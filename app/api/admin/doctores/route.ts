// app/api/admin/doctores/route.ts — T-29
// GET + POST /api/admin/doctores

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

// Schema para validación de POST
const doctorSchema = z.object({
  nombre: z.string().min(2).max(100),
});

// GET /api/admin/doctores
export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const doctores = await prisma.doctorReferidor.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        codigo_qr: true,
        nombre: true,
        created_at: true,
      },
    });

    return NextResponse.json(doctores);
  } catch (error) {
    console.error('Error en GET /api/admin/doctores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/admin/doctores
export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar con Zod
    const validation = doctorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { nombre } = validation.data;

    // Generar codigo_qr único URL-safe: DR_NOMBRE_TIMESTAMP
    // Normalización: mayúsculas + remover acentos + espacios a guiones bajos
    const nombreNormalizado = nombre
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos/diacríticos
      .replace(/\s+/g, '_');
    const timestamp = Date.now().toString(36).toUpperCase();
    let codigo_qr = `DR_${nombreNormalizado}_${timestamp}`;

    // Verificar unicidad (muy improbable colisión, pero por seguridad)
    let existe = await prisma.doctorReferidor.findUnique({
      where: { codigo_qr },
    });

    // Si por alguna razón existe, agregar un sufijo adicional
    if (existe) {
      codigo_qr = `DR_${nombreNormalizado}_${timestamp}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    // Crear doctor
    const doctor = await prisma.doctorReferidor.create({
      data: {
        codigo_qr,
        nombre,
      },
    });

    return NextResponse.json(doctor, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/admin/doctores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
