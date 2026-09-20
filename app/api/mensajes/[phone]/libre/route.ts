// app/api/mensajes/[phone]/libre/route.ts — T-30
// POST /api/mensajes/[phone]/libre — doctora responde con texto libre si ventana activa

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { calcularVentana } from "../../../../../lib/ventana";
import { sendText } from "../../../../../lib/whatsapp";
import { getSession } from "../../../../../lib/auth";

const schema = z.object({
  texto: z.string().min(1).max(4096),
});

export async function POST(
  request: Request,
  { params }: { params: { phone: string } }
) {
  // Verificar sesión
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const phone = params.phone;

  // Buscar paciente
  const paciente = await prisma.paciente.findUnique({
    where: { phone_number: phone },
  });

  if (!paciente) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  // Calcular ventana
  const ventana = calcularVentana(paciente.last_patient_msg_at);

  // Si ventana expirada → 403
  if (ventana.expirada) {
    return NextResponse.json(
      { error: "Ventana cerrada, use plantilla" },
      { status: 403 }
    );
  }

  // Validar body con Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validation = schema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { texto } = validation.data;

  // Enviar mensaje vía WhatsApp
  try {
    await sendText(phone, texto);
  } catch (error) {
    console.error("Error enviando mensaje:", error);
    return NextResponse.json(
      { error: "Error enviando mensaje" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
