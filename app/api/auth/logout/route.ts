import { NextResponse } from 'next/server';
import { clearSessionResponse } from '@/lib/auth';

export async function POST() {
  const baseResponse = NextResponse.json(
    { success: true, message: 'Logout exitoso' },
    { status: 200 }
  );

  return clearSessionResponse(baseResponse);
}
