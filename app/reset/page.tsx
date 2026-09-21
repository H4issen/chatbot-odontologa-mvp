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
    return (
      <div className="alert alert-danger" role="alert">
        Link inválido, solicita uno nuevo
      </div>
    );
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
      <div className="alert alert-success text-center" role="alert">
        <p className="mb-3">Contraseña actualizada</p>
        <a href="/login" className="btn btn-primary">
          Ir al inicio de sesión
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="password" className="form-label">
          Nueva contraseña (mínimo 8 caracteres)
        </label>
        <input
          id="password"
          className="form-control"
          type="password"
          name="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="mb-3">
        <label htmlFor="password_confirm" className="form-label">
          Confirmar contraseña
        </label>
        <input
          id="password_confirm"
          className="form-control"
          type="password"
          name="password_confirm"
          required
          minLength={8}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p className="alert alert-danger mb-3" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-100" type="submit" disabled={cargando}>
        {cargando ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <main
      className="container d-flex flex-column justify-content-center align-items-center px-3"
      style={{ minHeight: "100dvh" }}
    >
      <div className="w-100" style={{ maxWidth: "420px" }}>
        <h1 className="h3 mb-4 text-center">Restablecer contraseña</h1>
        <Suspense fallback={<p className="text-center">Cargando...</p>}>
          <ResetFormWithToken />
        </Suspense>
      </div>
    </main>
  );
}

function ResetFormWithToken() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  return <ResetForm token={token} />;
}
