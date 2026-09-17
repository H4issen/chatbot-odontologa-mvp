// lib/prisma.ts — T-04
// Singleton PrismaClient: evita agotar conexiones en dev con hot-reload.
// Todos los módulos deben importar `prisma` desde aquí; prohibido `new PrismaClient()` fuera.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
