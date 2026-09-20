// app/(panel)/page.tsx — T-40
// Lista de pacientes con semáforo 24h y polling cada 60s.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Semaforo = "verde" | "amarillo" | "rojo" | "expirado";

interface PacienteLista {
  phone_number: string;
  nombre: string | null;
  estado: string;
  ventana: {
    semaforo: Semaforo;
    horasRestantes: number;
    expirada: boolean;
    cierraAt: string | null;
  };
  ultimaConsulta?: { motivo_reportado?: string | null } | null;
}

const ORDEN_SEMAFORO: Record<Semaforo, number> = {
  expirado: 0,
  rojo: 1,
  amarillo: 2,
  verde: 3,
};

const CLASE_FILA: Record<Semaforo, string> = {
  verde: "",
  amarillo: "",
  rojo: "bg-red-50",
  expirado: "bg-gray-100",
};

const CLASE_PUNTO: Record<Semaforo, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-400 animate-pulse",
  rojo: "bg-red-500 animate-pulse",
  expirado: "bg-gray-400",
};

function formatoRestante(horas: number): string {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${m}m`;
}

export default function PanelPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<PacienteLista[] | null>(null);

  useEffect(() => {
    let vivo = true;

    async function cargar() {
      try {
        const res = await fetch("/api/pacientes");
        if (!res.ok) return;
        const data = await res.json();
        if (!vivo) return;
        setPacientes(Array.isArray(data) ? data : data.pacientes ?? []);
      } catch {
        // Se reintenta en el siguiente intervalo
      }
    }

    cargar();
    const intervalo = setInterval(cargar, 60_000);
    return () => {
      vivo = false;
      clearInterval(intervalo);
    };
  }, []);

  if (pacientes === null) {
    return (
      <main>
        <style>{`
          .bg-green-500{background-color:#22c55e}
          .bg-yellow-400{background-color:#facc15}
          .bg-red-500{background-color:#ef4444}
          .bg-red-50{background-color:#fef2f2}
          .bg-gray-100{background-color:#f3f4f6}
          .bg-gray-400{background-color:#9ca3af}
          .animate-pulse{animation:pulse 2s infinite}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        `}</style>
        <p>Cargando pacientes...</p>
      </main>
    );
  }

  if (pacientes.length === 0) {
    return (
      <main>
        <p>Sin pacientes registrados aún</p>
      </main>
    );
  }

  const ordenados = [...pacientes].sort(
    (a, b) =>
      ORDEN_SEMAFORO[a.ventana.semaforo] - ORDEN_SEMAFORO[b.ventana.semaforo] ||
      a.ventana.horasRestantes - b.ventana.horasRestantes
  );

  return (
    <main>
      <style>{`
        .bg-green-500{background-color:#22c55e}
        .bg-yellow-400{background-color:#facc15}
        .bg-red-500{background-color:#ef4444}
        .bg-red-50{background-color:#fef2f2}
        .bg-gray-100{background-color:#f3f4f6}
        .bg-gray-400{background-color:#9ca3af}
        .animate-pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
      <h1>Pacientes</h1>
      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Situación</th>
            <th>Tiempo restante</th>
            <th>Última consulta</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((p) => (
            <tr
              key={p.phone_number}
              className={CLASE_FILA[p.ventana.semaforo]}
              onClick={() => router.push(`/panel/${encodeURIComponent(p.phone_number)}`)}
            >
              <td>
                <span className={CLASE_PUNTO[p.ventana.semaforo]} />
              </td>
              <td>{p.nombre ?? "—"}</td>
              <td>{p.phone_number}</td>
              <td>{p.estado}</td>
              <td>{p.ventana.expirada ? "Ventana cerrada" : formatoRestante(p.ventana.horasRestantes)}</td>
              <td>{(p.ultimaConsulta?.motivo_reportado ?? "").slice(0, 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
