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
    <div className="container">
      <header>
        <span>Chatbot Paola — Panel</span>
        <nav>
          <a href="/panel">Pacientes</a>
          {" | "}
          <a href="/panel/contenido">Contenido</a>
        </nav>
        <form action="/api/auth/logout" method="POST">
          <button className="btn btn-secondary" type="submit">Cerrar sesión</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
