// app/api/auth/reset/route.ts — T-35
// POST /api/auth/reset — valida token, cambia contraseña, invalida token (un solo uso)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createHash } from 'crypto';

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  // Validar body con Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'JSON inválido' },
      { status: 400 }
    );
  }

  const validation = resetSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { token, password } = validation.data;

  try {
    // Hashear token con sha256
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Buscar usuario por reset_token
    const user = await prisma.usuarioAdmin.findUnique({
      where: { reset_token: tokenHash },
    });

    // Si no existe → 400 "Token inválido"
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 400 }
      );
    }

    // Verificar expiración (1 hora)
    if (user.reset_token_at) {
      const now = new Date();
      const tokenAge = now.getTime() - user.reset_token_at.getTime();
      const oneHourMs = 60 * 60 * 1000;

      if (tokenAge > oneHourMs) {
        // Token expirado → limpiar en DB y retornar 400
        await prisma.usuarioAdmin.update({
          where: { id: user.id },
          data: {
            reset_token: null,
            reset_token_at: null,
          },
        });

        return NextResponse.json(
          { error: 'Token expirado' },
          { status: 400 }
        );
      }
    }

    // Actualizar password con bcrypt
    const password_hash = await hashPassword(password);

    // Actualizar usuario: password_hash + limpiar reset_token
    await prisma.usuarioAdmin.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_token: null,
        reset_token_at: null,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Contraseña actualizada correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en reset:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
