// lib/ventana.ts — T-06
// Ventana 24h: cálculo backend puro. Sin columna extra, sin cron job (plan §5).

export type Semaforo = "verde" | "amarillo" | "rojo" | "expirado";

export function calcularVentana(last_patient_msg_at: Date | null): {
  horasRestantes: number;
  expirada: boolean;
  semaforo: Semaforo;
  cierraAt: Date | null;
} {
  if (!last_patient_msg_at) {
    return { horasRestantes: 0, expirada: true, semaforo: "expirado", cierraAt: null };
  }
  const cierraAt = new Date(last_patient_msg_at.getTime() + 24 * 60 * 60 * 1000);
  const ahora = Date.now();
  const diffMs = cierraAt.getTime() - ahora;
  const horasRestantes = Math.max(0, diffMs / (1000 * 60 * 60));

  let semaforo: Semaforo;
  if (horasRestantes <= 0) semaforo = "expirado";
  else if (horasRestantes < 1) semaforo = "rojo";
  else if (horasRestantes < 6) semaforo = "amarillo";
  else semaforo = "verde";

  return {
    horasRestantes: Math.round(horasRestantes * 10) / 10,
    expirada: horasRestantes <= 0,
    semaforo,
    cierraAt,
  };
}
