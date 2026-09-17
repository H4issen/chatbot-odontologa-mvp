// prisma/seed.ts — T-03
// Seed idempotente: admin + 5 servicios + fila única ConsultorioInfo.
// Uso: npx prisma db seed (lee ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD de process.env).

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SERVICIOS = [
  {
    slug: "corona",
    nombre: "Corona dental",
    descripcion_corta:
      "Corona dental: restaura la forma y función del diente. Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta.",
  },
  {
    slug: "limpieza",
    nombre: "Limpieza dental",
    descripcion_corta:
      "Limpieza dental profesional. Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta.",
  },
  {
    slug: "blanqueamiento",
    nombre: "Blanqueamiento dental",
    descripcion_corta:
      "Blanqueamiento dental estético. Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta.",
  },
  {
    slug: "brackets",
    nombre: "Brackets / Ortodoncia",
    descripcion_corta:
      "Tratamiento de ortodoncia con brackets. Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta.",
  },
  {
    slug: "implante",
    nombre: "Implante dental",
    descripcion_corta:
      "Implante dental para reemplazar piezas perdidas. Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta.",
  },
] as const;

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!adminEmail || adminEmail.trim() === "") {
    throw new Error("Seed abortado: falta ADMIN_EMAIL en process.env");
  }
  if (!adminPassword || adminPassword.trim() === "") {
    throw new Error("Seed abortado: falta ADMIN_INITIAL_PASSWORD en process.env");
  }

  const password_hash = await bcrypt.hash(adminPassword, 12);

  await prisma.usuarioAdmin.upsert({
    where: { email: adminEmail },
    update: { password_hash },
    create: { email: adminEmail, password_hash },
  });

  for (const s of SERVICIOS) {
    await prisma.servicio.upsert({
      where: { slug: s.slug },
      update: { nombre: s.nombre, descripcion_corta: s.descripcion_corta, precio_desde: null },
      create: {
        slug: s.slug,
        nombre: s.nombre,
        descripcion_corta: s.descripcion_corta,
        precio_desde: null,
      },
    });
  }

  await prisma.consultorioInfo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      direccion_texto: "Dirección pendiente de definir por la doctora",
      maps_url: "https://maps.google.com/?q=consultorio",
      horarios_texto: "Lun-Vie 9am-5pm (pendiente de confirmar)",
      scheduling_app_url: null,
    },
  });

  console.log("Seed OK: 1 admin + 5 servicios + consultorio_info id=1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
