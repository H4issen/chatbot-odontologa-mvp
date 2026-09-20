import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSessionResponse } from '@/lib/auth';
import { isRateLimited } from '@/lib/ratelimit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Hash ficticio para timing-safe cuando el email no existe
const FAKE_HASH = '$2b$12$LK8QZq8YqZqZqZqZqZqZqOZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ';

export async function POST(request: Request) {
  // Extraer IP del request
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';

  // Rate-limit: 5 intentos por 15 minutos por IP
  if (isRateLimited(`login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429 }
    );
  }

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

  const validation = loginSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = validation.data;

  try {
    // Buscar usuario por email
    const user = await prisma.usuarioAdmin.findUnique({
      where: { email },
    });

    // Verificar password (timing-safe)
    const hashToVerify = user?.password_hash || FAKE_HASH;
    const passwordValid = await verifyPassword(password, hashToVerify);

    if (!passwordValid) {
      // Mensaje genérico para no revelar si el email existe
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Si el usuario no existe pero el hash ficticio pasó (imposible), rechazar
    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Crear sesión
    const baseResponse = NextResponse.json(
      { success: true, message: 'Login exitoso' },
      { status: 200 }
    );

    return createSessionResponse(user.id, baseResponse);
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
