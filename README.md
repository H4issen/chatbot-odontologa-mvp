# chatbot-odontologa-mvp

MVP: asistente WhatsApp para consultorio odontológico (Next.js 14 + Postgres + Prisma).
Fuente de verdad: `spec.md`. Reglas de trabajo: `AGENTS.md`.

## Requisitos

- Node.js 18+
- Postgres (local o Neon)

## Instalación (dev)

```bash
npm i
cp .env.example .env
npx prisma migrate dev
npm run dev
```

1. `npm i` — instala dependencias.
2. `cp .env.example .env` — crea tu archivo local de secretos (nunca se commitea).
3. `npx prisma migrate dev` — corre la migración inicial (desde T-02).
4. `npm run dev` — levanta Next.js en `http://localhost:3000`.

## Notas

- Nunca commitear `.env`. Solo `.env.example` con valores vacíos va al repo.
- Commits atómicos en español (1 tarea = 1 commit).
