// app/reset/page.tsx — T-38
// Formulario de nueva contraseña con token en query param.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (!token) {
    return <p>Link inválido, solicita uno nuevo</p>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        setExito(true);
        return;
      }
      setError(typeof data.error === "string" ? data.error : "No se pudo actualizar la contraseña");
    } catch {
      setError("No se pudo actualizar la contraseña");
    } finally {
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <div>
        <p>Contraseña actualizada</p>
        <a href="/login">Ir al inicio de sesión</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nueva contraseña (mínimo 8 caracteres)
        <input
          className="form-control"
          type="password"
          name="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirmar contraseña
        <input
          className="form-control"
          type="password"
          name="password_confirm"
          required
          minLength={8}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="alert alert-danger" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={cargando}>
        {cargando ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="container">
      <h1>Restablecer contraseña</h1>
      <Suspense fallback={<p>Cargando...</p>}>
        <ResetFormWithToken />
      </Suspense>
    </main>
  );
}

function ResetFormWithToken() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  return <ResetForm token={token} />;
}
