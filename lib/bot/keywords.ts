// lib/bot/keywords.ts — T-13
// Palabras clave de info bajo demanda (plan §4). Matching insensible a mayúsculas y tildes.

export const KEYWORDS = {
  direccion: [
    "dirección",
    "direccion",
    "donde están",
    "donde estan",
    "ubicación",
    "ubicacion",
    "cómo llego",
    "como llego",
  ],
  horario: ["horario", "cuando abren", "qué días", "que dias", "horarios"],
  servicios: [
    "corona",
    "limpieza",
    "blanqueamiento",
    "brackets",
    "implante",
    "precio",
    "servicio",
    "costo",
    "cuánto cuesta",
  ],
} as const;

export type KeywordCategoria = "direccion" | "horario" | "servicio";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchKeyword(text: string): KeywordCategoria | null {
  const normalizado = normalizar(text);

  const categorias: Array<{ categoria: KeywordCategoria; claves: readonly string[] }> = [
    { categoria: "direccion", claves: KEYWORDS.direccion },
    { categoria: "horario", claves: KEYWORDS.horario },
    { categoria: "servicio", claves: KEYWORDS.servicios },
  ];

  for (const { categoria, claves } of categorias) {
    for (const clave of claves) {
      if (normalizado.includes(normalizar(clave))) {
        return categoria;
      }
    }
  }

  // Respaldo por palabra significativa (≥4 letras): cubre variantes como "donde quedan".
  const palabras = new Set(normalizado.split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  for (const { categoria, claves } of categorias) {
    for (const clave of claves) {
      const partes = normalizar(clave)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4);
      if (partes.some((p) => palabras.has(p))) {
        return categoria;
      }
    }
  }

  return null;
}
