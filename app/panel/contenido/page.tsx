// app/panel/contenido/page.tsx — T-43 (sección servicios; consultorio+doctores en T-44)
// Editar descripciones de servicios con validación de 300 chars y feedback en línea.

"use client";

import { useEffect, useState } from "react";

interface Servicio {
  slug: string;
  nombre: string;
  descripcion_corta: string;
  precio_desde: string | null;
}

export default function ContenidoPage() {
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [formularios, setFormularios] = useState<
    Record<string, { descripcion: string; precio: string }>
  >({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});

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
    </main>
  );
}
