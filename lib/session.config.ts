// lib/session.config.ts — T-09
// Opciones iron-session: cookieName, password, cookieOptions.

export const sessionConfig = {
  cookieName: "chatbot_session",
  password: process.env.SESSION_SECRET || "temp_secret_at_least_32_characters_long",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 43200, // 12 horas en segundos
  },
};
