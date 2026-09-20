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
    <main>
      <h1>Iniciar sesión</h1>
      <noscript>
        <p>Esta página necesita JavaScript para el inicio de sesión.</p>
      </noscript>
      <form onSubmit={handleSubmit}>
        <label>
          Correo electrónico
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Contraseña
          <input
            type={mostrarPassword ? "text" : "password"}
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button
          type="button"
          onClick={() => setMostrarPassword((v) => !v)}
          aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {mostrarPassword ? "Ocultar" : "Mostrar"}
        </button>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={cargando}>
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
