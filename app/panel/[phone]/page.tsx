// app/panel/[phone]/page.tsx — T-41 + T-42
// Datos del paciente, ventana 24h, lista de consultas y acciones (responder, plantilla, diagnóstico, archivar, ARCO).

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  const router = useRouter();
  const phone = Array.isArray(params.phone) ? params.phone[0] : (params.phone as string);
  const [detalle, setDetalle] = useState<DetallePaciente | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [textoLibre, setTextoLibre] = useState("");
  const [diagnosticos, setDiagnosticos] = useState<Record<number, string>>({});
  const [mostrarModalARCO, setMostrarModalARCO] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

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

  async function enviarLibre() {
    if (!textoLibre.trim()) return;
    const res = await fetch(`/api/mensajes/${encodeURIComponent(phone)}/libre`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoLibre }),
    });
    if (res.ok) {
      setTextoLibre("");
      setMensaje("Mensaje enviado");
      setTimeout(() => setMensaje(null), 3000);
    } else {
      const err = await res.json();
      setMensaje(err.error || "Error al enviar");
    }
  }

  async function enviarPlantilla() {
    const res = await fetch(`/api/mensajes/${encodeURIComponent(phone)}/plantilla`, {
      method: "POST",
    });
    if (res.ok) {
      setMensaje("Plantilla enviada");
      setTimeout(() => setMensaje(null), 3000);
    } else {
      const err = await res.json();
      setMensaje(err.error || "Error al enviar plantilla");
    }
  }

  async function guardarDiagnostico(consultaId: number) {
    const texto = diagnosticos[consultaId];
    if (!texto?.trim()) return;
    const res = await fetch(`/api/consultas/${consultaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostico_doctora: texto }),
    });
    if (res.ok) {
      setDetalle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          consultas: prev.consultas.map((c) =>
            c.id === consultaId ? { ...c, diagnostico_doctora: texto } : c
          ),
        };
      });
      setDiagnosticos((prev) => ({ ...prev, [consultaId]: "" }));
      setMensaje("Diagnóstico guardado");
      setTimeout(() => setMensaje(null), 3000);
    }
  }

  async function archivar() {
    const res = await fetch(`/api/pacientes/${encodeURIComponent(phone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "archivado" }),
    });
    if (res.ok) {
      setDetalle((prev) => (prev ? { ...prev, estado: "archivado" } : prev));
      setMensaje("Paciente archivado");
      setTimeout(() => setMensaje(null), 3000);
    }
  }

  async function eliminarARCO() {
    const res = await fetch(`/api/pacientes/${encodeURIComponent(phone)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/panel");
    } else {
      setMensaje("Error al eliminar paciente");
      setTimeout(() => setMensaje(null), 3000);
    }
  }

  if (noEncontrado) {
    return (
      <main className="container">
        <p>Paciente no encontrado</p>
        <a href="/panel">Volver a la lista</a>
      </main>
    );
  }

  if (!detalle) {
    return (
      <main className="container">
        <p>Cargando paciente...</p>
      </main>
    );
  }

  const consultasOrdenadas = [...detalle.consultas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <main className="container">
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
        <h2>Acciones</h2>
        {mensaje && <p className="alert alert-info">{mensaje}</p>}
        <div>
          <h3>Responder</h3>
          <textarea
            className="form-control"
            value={textoLibre}
            onChange={(e) => setTextoLibre(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={detalle.ventana.expirada}
          />
          <button className="btn btn-primary" onClick={enviarLibre} disabled={detalle.ventana.expirada}>
            Enviar mensaje libre
          </button>
          <button className="btn btn-secondary" onClick={enviarPlantilla}>
            Enviar plantilla
          </button>
          {detalle.ventana.expirada && (
            <p>Mensaje libre deshabilitado (ventana expirada)</p>
          )}
        </div>
        <div>
          <h3>Gestionar paciente</h3>
          <button className="btn btn-danger" onClick={archivar} disabled={detalle.estado === "archivado"}>
            {detalle.estado === "archivado" ? "Archivado" : "Archivar"}
          </button>
          <button className="btn btn-danger" onClick={() => setMostrarModalARCO(true)}>
            Eliminar paciente (ARCO)
          </button>
        </div>
      </section>

      {mostrarModalARCO && (
        <div className="modal" style={{ display: "block" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Confirmar eliminación ARCO</h3>
              </div>
              <div className="modal-body">
                <p>
                  Esta acción eliminará todos los datos del paciente (nombre, motivo,
                  consultas) y dejará solo el teléfono como registro de bloqueo.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setMostrarModalARCO(false)}>Cancelar</button>
                <button className="btn btn-danger" onClick={eliminarARCO}>Confirmar eliminación</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                {c.diagnostico_doctora ? (
                  <p>Diagnóstico: {c.diagnostico_doctora}</p>
                ) : (
                  <div>
                    <textarea
                      className="form-control"
                      value={diagnosticos[c.id] || ""}
                      onChange={(e) =>
                        setDiagnosticos((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Escribe el diagnóstico..."
                    />
                    <button className="btn btn-primary" onClick={() => guardarDiagnostico(c.id)}>
                      Guardar diagnóstico
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
