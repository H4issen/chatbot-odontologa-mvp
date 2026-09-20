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

export default function ContenidoPage() {
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [formularios, setFormularios] = useState<
    Record<string, { descripcion: string; precio: string }>
  >({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [consultorio, setConsultorio] = useState<Consultorio | null>(null);
  const [formConsultorio, setFormConsultorio] = useState<Consultorio>({
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
      const actualizado: Consultorio = await res.json();
      setConsultorio(actualizado);
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
    const link = `https://wa.me/?text=${encodeURIComponent(`REF_${codigo}`)}`;
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
      <main>
        <p>Cargando contenido...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Contenido</h1>

      <section>
        <h2>Servicios</h2>
        {servicios.map((s) => {
          const form = formularios[s.slug] ?? { descripcion: "", precio: "" };
          return (
            <article key={s.slug}>
              <h3>{s.nombre}</h3>
              <p>Identificador: {s.slug}</p>
              <label>
                Descripción corta (máximo 300 caracteres)
                <textarea
                  value={form.descripcion}
                  maxLength={400}
                  onChange={(e) =>
                    setFormularios((prev) => ({
                      ...prev,
                      [s.slug]: { ...prev[s.slug], descripcion: e.target.value },
                    }))
                  }
                />
              </label>
              <p>
                {form.descripcion.length}/300
              </p>
              <label>
                Precio desde (opcional)
                <input
                  type="text"
                  value={form.precio}
                  onChange={(e) =>
                    setFormularios((prev) => ({
                      ...prev,
                      [s.slug]: { ...prev[s.slug], precio: e.target.value },
                    }))
                  }
                />
              </label>
              <button onClick={() => guardar(s.slug)}>Guardar</button>
              {avisos[s.slug] && <p>{avisos[s.slug]}</p>}
            </article>
          );
        })}
      </section>

      <section>
        <h2>Consultorio</h2>
        {!consultorio ? (
          <p>Cargando consultorio...</p>
        ) : (
          <div>
            <label>
              Dirección
              <input
                type="text"
                value={formConsultorio.direccion_texto}
                onChange={(e) =>
                  setFormConsultorio((prev) => ({ ...prev, direccion_texto: e.target.value }))
                }
              />
            </label>
            <label>
              URL de Maps
              <input
                type="url"
                value={formConsultorio.maps_url}
                onChange={(e) =>
                  setFormConsultorio((prev) => ({ ...prev, maps_url: e.target.value }))
                }
              />
            </label>
            <label>
              Horarios
              <input
                type="text"
                value={formConsultorio.horarios_texto}
                onChange={(e) =>
                  setFormConsultorio((prev) => ({ ...prev, horarios_texto: e.target.value }))
                }
              />
            </label>
            <button onClick={guardarConsultorio}>Guardar</button>
            {avisoConsultorio && <p>{avisoConsultorio}</p>}
          </div>
        )}
      </section>

      <section>
        <h2>Doctores referidores</h2>
        {!doctores ? (
          <p>Cargando doctores...</p>
        ) : doctores.length === 0 ? (
          <p>Sin doctores registrados aún</p>
        ) : (
          <ul>
            {doctores.map((d) => (
              <li key={d.id}>
                <p>{d.nombre}</p>
                <p>Código: {d.codigo_qr}</p>
                <label>
                  Link para compartir
                  <input
                    type="text"
                    readOnly
                    value={`https://wa.me/?text=${encodeURIComponent(`REF_${d.codigo_qr}`)}`}
                  />
                </label>
                <button onClick={() => copiarLink(d.id, d.codigo_qr)}>
                  {copiado === d.id ? "Copiado" : "Copiar link"}
                </button>
                <button onClick={() => eliminarDoctor(d.id, d.nombre)}>Eliminar</button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <h3>Nuevo doctor</h3>
          <label>
            Nombre
            <input
              type="text"
              value={nuevoDoctor}
              onChange={(e) => setNuevoDoctor(e.target.value)}
            />
          </label>
          <button onClick={crearDoctor}>Nuevo doctor</button>
          {avisoDoctores && <p>{avisoDoctores}</p>}
        </div>
      </section>
    </main>
  );
}
