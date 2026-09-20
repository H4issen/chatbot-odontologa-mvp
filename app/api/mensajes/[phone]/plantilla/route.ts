import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTemplate } from '@/lib/whatsapp';
import { getSession } from '@/lib/auth';

// POST /api/mensajes/[phone]/plantilla
export async function POST(
  request: Request,
  { params }: { params: { phone: string } }
) {
  // Verificar sesión (aunque el middleware ya lo protege)
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { phone } = params;

  try {
    // Buscar paciente
    const paciente = await prisma.paciente.findUnique({
      where: { phone_number: phone },
    });

    if (!paciente) {
      return NextResponse.json(
        { error: 'Paciente no encontrado' },
        { status: 404 }
      );
    }

    // Buscar última consulta del paciente
    const ultimaConsulta = await prisma.consulta.findFirst({
      where: { paciente_phone: phone },
      orderBy: { created_at: 'desc' },
    });

    // Preparar parámetros con fallbacks
    const nombre = paciente.nombre ?? 'paciente';
    const motivo = ultimaConsulta?.motivo_reportado ?? 'su consulta';

    // Enviar plantilla
    await sendTemplate(phone, nombre, motivo);

    return NextResponse.json(
      { success: true, message: 'Plantilla enviada correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error enviando plantilla:', error);
    return NextResponse.json(
      { error: 'Error al enviar plantilla' },
      { status: 500 }
    );
  }
}
