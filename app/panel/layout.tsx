// app/(panel)/layout.tsx — T-39
// Layout del panel: verifica sesión server-side y ofrece logout (funciona sin JS).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const cookie = headers().get("cookie") ?? "";
  const req = new Request("http://localhost/panel", {
    headers: { cookie },
  });
  const session = await getSession(req);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container py-3">
      <header className="navbar navbar-expand-sm navbar-light bg-light rounded px-3 py-2 mb-4 border d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="navbar-brand mb-0 fs-5 fw-bold">Chatbot Paola — Panel</span>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <nav className="nav nav-pills gap-1">
            <a href="/panel" className="nav-link">
              Pacientes
            </a>
            <a href="/panel/contenido" className="nav-link">
              Contenido
            </a>
          </nav>
          <form action="/api/auth/logout" method="POST" className="m-0">
            <button className="btn btn-outline-secondary btn-sm" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
