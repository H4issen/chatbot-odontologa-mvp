// app/api/admin/doctores/[id]/route.ts — T-29
// DELETE /api/admin/doctores/[id]

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// DELETE /api/admin/doctores/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    
    // Validar que el ID sea un número válido
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el doctor existe
    const doctor = await prisma.doctorReferidor.findUnique({
      where: { id },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor no encontrado' }, { status: 404 });
    }

    // Eliminar doctor
    await prisma.doctorReferidor.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Doctor eliminado correctamente' 
    });
  } catch (error) {
    console.error('Error en DELETE /api/admin/doctores/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
