// middleware.ts — T-10
// Middleware Next.js que protege /panel/* y /api/* protegidos (excepto rutas públicas).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await getSession(request);

  if (!session) {
    if (pathname.startsWith("/panel")) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith("/api")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/api/pacientes/:path*",
    "/api/consultas/:path*",
    "/api/admin/:path*",
    "/api/mensajes/:path*",
    "/api/auth/logout",
  ],
};
