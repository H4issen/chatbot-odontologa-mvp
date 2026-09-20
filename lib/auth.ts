// lib/auth.ts — T-09
// Helper de sesión con iron-session y helpers bcrypt.

import { getIronSession, SessionOptions } from "iron-session";
import { sessionConfig } from "./session.config";

// bcrypt nativo no carga en Edge Runtime (middleware): importación lazy.
// Solo las rutas API (Node runtime) llaman hash/verify, nunca el middleware.

export interface SessionData {
  userId: number;
}

export async function getSession(req: Request): Promise<SessionData | null> {
  if (!process.env.SESSION_SECRET) {
    throw new Error("auth.ts: falta SESSION_SECRET en process.env");
  }
  const session = await getIronSession<SessionData>(req, new Response(), sessionConfig as SessionOptions);
  return session.userId ? { userId: session.userId } : null;
}

export function createSessionResponse(userId: number, baseResponse: Response): Response {
  const session = { userId };
  const response = new Response(baseResponse.body, baseResponse);
  response.headers.append(
    "Set-Cookie",
    `chatbot_session=${JSON.stringify(session)}; HttpOnly; Secure; SameSite=Lax; Max-Age=43200; Path=/`
  );
  return response;
}

export function clearSessionResponse(baseResponse: Response): Response {
  const response = new Response(baseResponse.body, baseResponse);
  response.headers.append(
    "Set-Cookie",
    `chatbot_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  );
  return response;
}

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import("bcrypt");
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcrypt");
  return bcrypt.compare(plain, hash);
}
