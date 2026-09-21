// app/login/page.tsx — T-37
// Formulario de login con toggle ver/ocultar contraseña.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 200) {
        router.push("/panel");
        return;
      }
      if (res.status === 429) {
        setError("Demasiados intentos. Espera 15 minutos.");
        return;
      }
      setError("Credenciales incorrectas");
    } catch {
      setError("Credenciales incorrectas");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main
      className="container d-flex flex-column justify-content-center align-items-center px-3"
      style={{ minHeight: "100dvh" }}
    >
      <div className="w-100" style={{ maxWidth: "420px" }}>
        <h1 className="h3 mb-4 text-center">Iniciar sesión</h1>
        <noscript>
          <p className="alert alert-warning mb-3">
            Esta página necesita JavaScript para el inicio de sesión.
          </p>
        </noscript>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="email"
              className="form-control"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="input-group">
              <input
                id="password"
                className="form-control"
                type={mostrarPassword ? "text" : "password"}
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          {error && (
            <p className="alert alert-danger mb-3" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={cargando}
          >
            {cargando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
