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
      <div className="alert alert-warning my-4">
        <p className="mb-2">Paciente no encontrado</p>
        <a href="/panel" className="btn btn-outline-primary btn-sm">
          Volver a la lista
        </a>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Cargando paciente...</p>
      </div>
    );
  }

  const consultasOrdenadas = [...detalle.consultas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div>
      <a href="/panel" className="btn btn-link px-0 mb-3 text-decoration-none">
        &larr; Volver a la lista
      </a>

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <h1 className="h3 card-title mb-0">{detalle.nombre ?? "Sin nombre"}</h1>
            <span className="badge bg-primary fs-6">{detalle.estado}</span>
          </div>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <p className="mb-1">
                <strong>Teléfono:</strong> {detalle.phone_number}
              </p>
              <p className="mb-1">
                <strong>Tipo de contacto:</strong> {detalle.tipo_contacto ?? "—"}
              </p>
              {detalle.doctor_referidor && (
                <p className="mb-1">
                  <strong>Doctor referidor:</strong> {detalle.doctor_referidor.nombre} (
                  {detalle.doctor_referidor.codigo_qr})
                </p>
              )}
            </div>
            <div className="col-12 col-md-6">
              <p className="mb-1">
                <strong>Consentimiento:</strong> {detalle.consentimiento}
                {detalle.consentimiento_at ? ` (${formatoFecha(detalle.consentimiento_at)})` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Ventana de conversación</h2>
        </div>
        <div className="card-body">
          {detalle.ventana.expirada ? (
            <p className="text-danger fw-semibold mb-0">Ventana cerrada</p>
          ) : (
            <p className="mb-0">
              Último mensaje: {formatoFecha(detalle.last_patient_msg_at)}. Cierra:{" "}
              {formatoFecha(detalle.ventana.cierraAt)} (
              {formatoRestante(detalle.ventana.horasRestantes)}).
            </p>
          )}
        </div>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Acciones</h2>
        </div>
        <div className="card-body">
          {mensaje && <p className="alert alert-info">{mensaje}</p>}
          <div className="mb-4">
            <h3 className="h6 mb-2">Responder</h3>
            <textarea
              className="form-control mb-3"
              rows={3}
              value={textoLibre}
              onChange={(e) => setTextoLibre(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={detalle.ventana.expirada}
            />
            <div className="d-flex gap-2 flex-wrap mb-2">
              <button
                className="btn btn-primary"
                onClick={enviarLibre}
                disabled={detalle.ventana.expirada}
              >
                Enviar mensaje libre
              </button>
              <button className="btn btn-secondary" onClick={enviarPlantilla}>
                Enviar plantilla
              </button>
            </div>
            {detalle.ventana.expirada && (
              <p className="text-muted small mb-0">
                Mensaje libre deshabilitado (ventana expirada)
              </p>
            )}
          </div>
          <hr />
          <div>
            <h3 className="h6 mb-2">Gestionar paciente</h3>
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-danger"
                onClick={archivar}
                disabled={detalle.estado === "archivado"}
              >
                {detalle.estado === "archivado" ? "Archivado" : "Archivar"}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setMostrarModalARCO(true)}
              >
                Eliminar paciente (ARCO)
              </button>
            </div>
          </div>
        </div>
      </div>

      {mostrarModalARCO && (
        <div
          className="modal show"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title h5">Confirmar eliminación ARCO</h3>
              </div>
              <div className="modal-body">
                <p>
                  Esta acción eliminará todos los datos del paciente (nombre, motivo,
                  consultas) y dejará solo el teléfono como registro de bloqueo.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalARCO(false)}
                >
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={eliminarARCO}>
                  Confirmar eliminación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Consultas</h2>
        </div>
        <div className="card-body">
          {consultasOrdenadas.length === 0 ? (
            <p className="text-muted mb-0">Sin consultas registradas</p>
          ) : (
            <div className="list-group list-group-flush">
              {consultasOrdenadas.map((c) => (
                <div key={c.id} className="list-group-item px-0 py-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted small">{formatoFecha(c.created_at)}</span>
                  </div>
                  <p className="mb-2">
                    <strong>Motivo:</strong> {c.motivo_reportado ?? "—"}
                  </p>
                  {c.diagnostico_doctora ? (
                    <div className="alert alert-light border mb-0">
                      <strong>Diagnóstico:</strong> {c.diagnostico_doctora}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <textarea
                        className="form-control mb-2"
                        rows={2}
                        value={diagnosticos[c.id] || ""}
                        onChange={(e) =>
                          setDiagnosticos((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Escribe el diagnóstico..."
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => guardarDiagnostico(c.id)}
                      >
                        Guardar diagnóstico
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
