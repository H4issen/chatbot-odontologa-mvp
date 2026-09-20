// app/panel/[phone]/page.tsx — T-41 (parte 1: visualización)
// Datos del paciente, ventana 24h y lista de consultas. Acciones en T-42.

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Consulta {
  id: number;
  motivo_reportado: string | null;
  diagnostico_doctora: string | null;
  created_at: string;
}

interface DetallePaciente {
  phone_number: string;
  nombre: string | null;
  tipo_contacto: string | null;
  consentimiento: string;
  consentimiento_at: string | null;
  estado: string;
  last_patient_msg_at: string | null;
  ventana: {
    semaforo: string;
    horasRestantes: number;
    expirada: boolean;
    cierraAt: string | null;
  };
  doctor_referidor: { nombre: string; codigo_qr: string } | null;
  consultas: Consulta[];
}

function formatoFecha(fecha: string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-MX");
}

function formatoRestante(horas: number): string {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${m}m`;
}

export default function DetallePacientePage() {
  const params = useParams();
  const phone = Array.isArray(params.phone) ? params.phone[0] : (params.phone as string);
  const [detalle, setDetalle] = useState<DetallePaciente | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    let vivo = true;

    async function cargar() {
      try {
        const res = await fetch(`/api/pacientes/${encodeURIComponent(phone)}`);
        if (!vivo) return;
        if (res.status === 404) {
          setNoEncontrado(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setDetalle(data);
      } catch {
        // Se reintenta manualmente recargando la página
      }
    }

    if (phone) cargar();
    return () => {
      vivo = false;
    };
  }, [phone]);

  if (noEncontrado) {
    return (
      <main>
        <p>Paciente no encontrado</p>
        <a href="/panel">Volver a la lista</a>
      </main>
    );
  }

  if (!detalle) {
    return (
      <main>
        <p>Cargando paciente...</p>
      </main>
    );
  }

  const consultasOrdenadas = [...detalle.consultas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <main>
      <a href="/panel">Volver a la lista</a>

      <section>
        <h1>{detalle.nombre ?? "Sin nombre"}</h1>
        <p>Teléfono: {detalle.phone_number}</p>
        <p>Tipo de contacto: {detalle.tipo_contacto ?? "—"}</p>
        {detalle.doctor_referidor && (
          <p>
            Doctor referidor: {detalle.doctor_referidor.nombre} (
            {detalle.doctor_referidor.codigo_qr})
          </p>
        )}
        <p>
          Consentimiento: {detalle.consentimiento}
          {detalle.consentimiento_at ? ` (${formatoFecha(detalle.consentimiento_at)})` : ""}
        </p>
        <p>Estado: {detalle.estado}</p>
      </section>

      <section>
        <h2>Ventana de conversación</h2>
        {detalle.ventana.expirada ? (
          <p>Ventana cerrada</p>
        ) : (
          <p>
            Último mensaje: {formatoFecha(detalle.last_patient_msg_at)}. Cierra:{" "}
            {formatoFecha(detalle.ventana.cierraAt)} (
            {formatoRestante(detalle.ventana.horasRestantes)}).
          </p>
        )}
      </section>

      <section>
        <h2>Consultas</h2>
        {consultasOrdenadas.length === 0 ? (
          <p>Sin consultas registradas</p>
        ) : (
          <ul>
            {consultasOrdenadas.map((c) => (
              <li key={c.id}>
                <p>{formatoFecha(c.created_at)}</p>
                <p>{c.motivo_reportado ?? "—"}</p>
                {c.diagnostico_doctora && <p>Diagnóstico: {c.diagnostico_doctora}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
