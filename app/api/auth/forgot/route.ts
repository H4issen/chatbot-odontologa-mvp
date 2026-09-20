// app/api/auth/forgot/route.ts — T-34
// POST /api/auth/forgot — genera token sha256, lo guarda y envía email de reset

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isRateLimited } from '@/lib/ratelimit';
import { sendResetEmail } from '@/lib/mail';
import { createHash, randomBytes } from 'crypto';

const forgotSchema = z.object({
  email: z.string().email(),
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

  const validation = forgotSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Email inválido', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { email } = validation.data;

  // Rate-limit: 3 intentos por hora por email
  if (isRateLimited(`forgot:${email}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 1 hora.' },
      { status: 429 }
    );
  }

  try {
    // Buscar usuario por email
    const user = await prisma.usuarioAdmin.findUnique({
      where: { email },
    });

    // Si el usuario existe, generar token y enviar email
    if (user) {
      // Generar token aleatorio (32 bytes hex)
      const token = randomBytes(32).toString('hex');

      // Hashear token con sha256
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Guardar tokenHash y timestamp en UsuarioAdmin
      await prisma.usuarioAdmin.update({
        where: { id: user.id },
        data: {
          reset_token: tokenHash,
          reset_token_at: new Date(),
        },
      });

      // Construir URL de reset
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset?token=${token}`;

      // Enviar email (fire-and-forget, no bloquear respuesta)
      sendResetEmail(email, resetUrl).catch((error) => {
        console.error('Error enviando email de reset:', error);
      });
    }

    // Responder 200 SIEMPRE (no revelar si email existe)
    return NextResponse.json(
      { success: true, message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en forgot:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
