// app/panel/contenido/page.tsx — T-43 (servicios) + T-44 (consultorio + doctores QR)
// Sin imagen QR (aclaración T-44): solo link wa.me copyable.

"use client";

import { useEffect, useState } from "react";

interface Servicio {
  slug: string;
  nombre: string;
  descripcion_corta: string;
  precio_desde: string | null;
}

interface Consultorio {
  direccion_texto: string;
  maps_url: string;
  horarios_texto: string;
  whatsapp_number: string | null;
}

interface Doctor {
  id: number;
  codigo_qr: string;
  nombre: string;
}

function esUrlValida(valor: string): boolean {
  try {
    const url = new URL(valor.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkDoctor(codigo: string, numero: string | null): string {
  const texto = encodeURIComponent(`REF_${codigo}`);
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

export default function ContenidoPage() {
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [formularios, setFormularios] = useState<
    Record<string, { descripcion: string; precio: string }>
  >({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [consultorio, setConsultorio] = useState<Consultorio | null>(null);
  const [formConsultorio, setFormConsultorio] = useState<Omit<Consultorio, "whatsapp_number">>({
    direccion_texto: "",
    maps_url: "",
    horarios_texto: "",
  });
  const [avisoConsultorio, setAvisoConsultorio] = useState<string | null>(null);
  const [doctores, setDoctores] = useState<Doctor[] | null>(null);
  const [nuevoDoctor, setNuevoDoctor] = useState("");
  const [avisoDoctores, setAvisoDoctores] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;

    async function cargar() {
      try {
        const res = await fetch("/api/admin/servicios");
        if (!vivo || !res.ok) return;
        const data: Servicio[] = await res.json();
        setServicios(data);
        const inicial: Record<string, { descripcion: string; precio: string }> = {};
        for (const s of data) {
          inicial[s.slug] = { descripcion: s.descripcion_corta, precio: s.precio_desde ?? "" };
        }
        setFormularios(inicial);
      } catch {
        // Se reintenta recargando la página
      }
    }

    cargar();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;

    async function cargarConsultorio() {
      try {
        const res = await fetch("/api/admin/consultorio");
        if (!vivo || !res.ok) return;
        const data: Consultorio = await res.json();
        setConsultorio(data);
        setFormConsultorio({
          direccion_texto: data.direccion_texto,
          maps_url: data.maps_url,
          horarios_texto: data.horarios_texto,
        });
      } catch {
        // Se reintenta recargando la página
      }
    }

    async function cargarDoctores() {
      try {
        const res = await fetch("/api/admin/doctores");
        if (!vivo || !res.ok) return;
        const data: Doctor[] = await res.json();
        setDoctores(data);
      } catch {
        // Se reintenta recargando la página
      }
    }

    cargarConsultorio();
    cargarDoctores();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(slug: string) {
    const form = formularios[slug];
    if (!form) return;

    if (form.descripcion.length > 300) {
      setAvisos((prev) => ({
        ...prev,
        [slug]: `Máximo 300 caracteres (llevas ${form.descripcion.length})`,
      }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/servicios/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion_corta: form.descripcion,
          precio_desde: form.precio.trim() === "" ? null : form.precio.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAvisos((prev) => ({
          ...prev,
          [slug]: typeof err.error === "string" ? err.error : "No se pudo guardar",
        }));
        return;
      }
      const actualizado: Servicio = await res.json();
      setServicios((prev) =>
        prev ? prev.map((s) => (s.slug === slug ? actualizado : s)) : prev
      );
      setAvisos((prev) => ({ ...prev, [slug]: "Guardado" }));
    } catch {
      setAvisos((prev) => ({ ...prev, [slug]: "No se pudo guardar" }));
    }
  }

  async function guardarConsultorio() {
    if (!esUrlValida(formConsultorio.maps_url)) {
      setAvisoConsultorio("La URL de Maps no es válida (debe empezar con http:// o https://)");
      return;
    }
    try {
      const res = await fetch("/api/admin/consultorio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion_texto: formConsultorio.direccion_texto,
          maps_url: formConsultorio.maps_url.trim(),
          horarios_texto: formConsultorio.horarios_texto,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAvisoConsultorio(typeof err.error === "string" ? err.error : "No se pudo guardar");
        return;
      }
      const actualizado: Omit<Consultorio, "whatsapp_number"> = await res.json();
      setConsultorio((prev) =>
        prev ? { ...prev, ...actualizado } : { ...actualizado, whatsapp_number: null }
      );
      setAvisoConsultorio("Guardado");
    } catch {
      setAvisoConsultorio("No se pudo guardar");
    }
  }

  async function crearDoctor() {
    const nombre = nuevoDoctor.trim();
    if (nombre.length < 2) {
      setAvisoDoctores("El nombre debe tener al menos 2 caracteres");
      return;
    }
    try {
      const res = await fetch("/api/admin/doctores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAvisoDoctores(typeof err.error === "string" ? err.error : "No se pudo crear");
        return;
      }
      const creado: Doctor = await res.json();
      setDoctores((prev) => (prev ? [...prev, creado] : [creado]));
      setNuevoDoctor("");
      setAvisoDoctores(`Doctor creado: ${creado.codigo_qr}`);
    } catch {
      setAvisoDoctores("No se pudo crear");
    }
  }

  async function eliminarDoctor(id: number, nombre: string) {
    if (!window.confirm(`¿Eliminar al doctor "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/admin/doctores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setAvisoDoctores("No se pudo eliminar");
        return;
      }
      setDoctores((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
      setAvisoDoctores("Doctor eliminado");
    } catch {
      setAvisoDoctores("No se pudo eliminar");
    }
  }

  async function copiarLink(id: number, codigo: string) {
    const link = linkDoctor(codigo, consultorio?.whatsapp_number ?? null);
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(id);
      setTimeout(() => setCopiado((v) => (v === id ? null : v)), 2000);
    } catch {
      setAvisoDoctores("No se pudo copiar; copia el link manualmente");
    }
  }

  if (!servicios) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Cargando contenido...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h3 mb-4">Contenido</h1>

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Servicios</h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {servicios.map((s) => {
              const form = formularios[s.slug] ?? { descripcion: "", precio: "" };
              return (
                <div key={s.slug} className="col-12 col-lg-6">
                  <div className="border rounded p-3 h-100 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h3 className="h6 mb-0 fw-bold">{s.nombre}</h3>
                        <span className="badge bg-light text-dark border">{s.slug}</span>
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">
                          Descripción corta (máximo 300 caracteres)
                        </label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={form.descripcion}
                          maxLength={400}
                          onChange={(e) =>
                            setFormularios((prev) => ({
                              ...prev,
                              [s.slug]: { ...prev[s.slug], descripcion: e.target.value },
                            }))
                          }
                        />
                        <div className="text-muted small text-end mt-1">
                          {form.descripcion.length}/300
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label small mb-1">
                          Precio desde (opcional)
                        </label>
                        <input
                          className="form-control"
                          type="text"
                          value={form.precio}
                          onChange={(e) =>
                            setFormularios((prev) => ({
                              ...prev,
                              [s.slug]: { ...prev[s.slug], precio: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => guardar(s.slug)}
                      >
                        Guardar
                      </button>
                      {avisos[s.slug] && (
                        <p className="alert alert-info py-1 px-2 mt-2 mb-0 small">
                          {avisos[s.slug]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Consultorio</h2>
        </div>
        <div className="card-body">
          {!consultorio ? (
            <p className="text-muted mb-0">Cargando consultorio...</p>
          ) : (
            <div style={{ maxWidth: "600px" }}>
              <div className="mb-3">
                <label className="form-label">Dirección</label>
                <input
                  className="form-control"
                  type="text"
                  value={formConsultorio.direccion_texto}
                  onChange={(e) =>
                    setFormConsultorio((prev) => ({ ...prev, direccion_texto: e.target.value }))
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label">URL de Maps</label>
                <input
                  className="form-control"
                  type="url"
                  value={formConsultorio.maps_url}
                  onChange={(e) =>
                    setFormConsultorio((prev) => ({ ...prev, maps_url: e.target.value }))
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Horarios</label>
                <input
                  className="form-control"
                  type="text"
                  value={formConsultorio.horarios_texto}
                  onChange={(e) =>
                    setFormConsultorio((prev) => ({ ...prev, horarios_texto: e.target.value }))
                  }
                />
              </div>
              <button className="btn btn-primary" onClick={guardarConsultorio}>
                Guardar
              </button>
              {avisoConsultorio && (
                <p className="alert alert-info mt-3 mb-0">{avisoConsultorio}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">Doctores referidores</h2>
        </div>
        <div className="card-body">
          {consultorio && !consultorio.whatsapp_number && (
            <p className="alert alert-warning">
              Configura BOT_WHATSAPP_NUMBER en el servidor (formato Perú: 51 + 9 dígitos)
              para que los links incluyan el número del bot.
            </p>
          )}
          {!doctores ? (
            <p className="text-muted mb-0">Cargando doctores...</p>
          ) : doctores.length === 0 ? (
            <p className="text-muted mb-3">Sin doctores registrados aún</p>
          ) : (
            <div className="table-responsive mb-4">
              <table className="table table-hover table-striped align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th style={{ minWidth: "260px" }}>Link</th>
                    <th style={{ width: "100px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {doctores.map((d) => (
                    <tr key={d.id}>
                      <td className="fw-semibold">{d.nombre}</td>
                      <td>
                        <span className="badge bg-secondary">{d.codigo_qr}</span>
                      </td>
                      <td>
                        <div className="input-group input-group-sm">
                          <input
                            className="form-control"
                            type="text"
                            readOnly
                            value={linkDoctor(d.codigo_qr, consultorio?.whatsapp_number ?? null)}
                          />
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => copiarLink(d.id, d.codigo_qr)}
                          >
                            {copiado === d.id ? "Copiado" : "Copiar link"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => eliminarDoctor(d.id, d.nombre)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card bg-light border-light p-3" style={{ maxWidth: "420px" }}>
            <h3 className="h6 mb-3">Nuevo doctor</h3>
            <div className="mb-3">
              <label className="form-label">Nombre</label>
              <input
                className="form-control"
                type="text"
                value={nuevoDoctor}
                onChange={(e) => setNuevoDoctor(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={crearDoctor}>
              Nuevo doctor
            </button>
            {avisoDoctores && (
              <p className="alert alert-info mt-3 mb-0">{avisoDoctores}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
