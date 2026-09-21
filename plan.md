# plan.md — Chatbot Paola MVP
> Generado desde `spec.md` v0.1 + `AGENTS.md`. MODO CRÍTICO aplicado.
> Decisiones de aclaración incorporadas el 2026-09-16.

---

## 0. Arquitectura resumen

**Monolítica Next.js 14 (App Router)** — un solo repositorio, un solo deploy.
Sin split, sin CORS entre dominios, sin infra duplicada.

```
┌──────────────────────────────────────────────────────────┐
│                  Next.js (App Router)                    │
│                                                          │
│  /app                                                    │
 │  ├── panel/            → UI privada, requiere sesión     │
│  │   ├── page.tsx      → lista pacientes (poll 60s)      │
│  │   ├── [phone]/      → detalle paciente                │
│  │   └── contenido/    → editar servicios + info         │
│  ├── privacidad/       → aviso privacidad (estático)     │
│  ├── login/            → auth                            │
│  └── reset/            → reset password                  │
│                                                          │
│  /app/api                                                │
│  ├── whatsapp/route.ts → webhook Meta (GET + POST)       │
│  ├── pacientes/        → CRUD panel                      │
│  ├── auth/             → login / logout / reset          │
│  └── admin/            → servicios, info, doctores QR    │
│                                                          │
│  /lib                                                    │
│  ├── prisma.ts         → Prisma Client singleton         │
│  ├── bot/              → máquina de estados              │
│  ├── auth.ts           → sesión + bcrypt                 │
│  ├── whatsapp.ts       → envío mensajes Meta API         │
│  ├── mail.ts           → SMTP Gmail                      │
│  └── ratelimit.ts      → rate-limit en memoria (Map)     │
└──────────────────────────────────────────────────────────┘
         │                          │
    Postgres (Neon)          Meta WhatsApp Cloud API
```

**Stack validado:**
| Pieza | Elección | Justificación |
|-------|----------|---------------|
| Framework | Next.js 14 App Router | spec §2, AGENTS.md |
| ORM | Prisma | AGENTS.md (no SQL crudo) |
| DB | Neon Postgres (serverless) | spec §10, backup diario gratis |
| Auth | cookies httpOnly propias | spec §8, sin OAuth de terceros |
| Email reset | Nodemailer + Gmail SMTP App Password | spec §8 + aclaración A5 |
| Hosting | Railway o Render (monolítico) | evita CORS, URL fija HTTPS |
| Rate-limit | `Map` en memoria por proceso | MVP 1 instancia, suficiente |

> [!WARNING]
> **[RIESGO]** Rate-limit en memoria (`Map`) falla si se escala a >1 instancia.
> Para MVP con 1 instancia es aceptable. Al escalar: reemplazar con Redis o Upstash.

---

## 1. Esquema DB — Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUM ───────────────────────────────────────────────

enum TipoContacto {
  referido
  conocido
  empresa
}

enum Consentimiento {
  pendiente
  aceptado
  rechazado
}

enum EstadoPaciente {
  nuevo
  registrado
  citado_externo
  archivado
}

// ─── TABLAS ─────────────────────────────────────────────

model Paciente {
  phone_number       String          @id                   // wa_id, nunca se pregunta
  nombre             String?         @db.VarChar(500)      // NULL hasta consentimiento
  tipo_contacto      TipoContacto?
  doctor_referidor_id Int?
  doctor_referidor   DoctorReferidor? @relation(fields: [doctor_referidor_id], references: [id])
  consentimiento     Consentimiento  @default(pendiente)
  consentimiento_at  DateTime?
  last_patient_msg_at DateTime?                            // actualizar en cada msg entrante
  estado             EstadoPaciente  @default(nuevo)
  bot_state          String          @default("BIENVENIDA") // estado actual máquina de estados
  created_at         DateTime        @default(now())
  updated_at         DateTime        @updatedAt

  consultas          Consulta[]
}

// [RIESGO] phone_number como PK: si el paciente cambia número, rompe FK.
// Es exigencia de spec §3. Se documenta; sin solución alternativa en MVP.

model Consulta {
  id                 Int      @id @default(autoincrement())
  paciente_phone     String
  paciente           Paciente @relation(fields: [paciente_phone], references: [phone_number])
  motivo_reportado   String?  @db.Text
  servicio_interes   String?  @db.VarChar(100)
  diagnostico_doctora String? @db.Text                    // solo la doctora en panel
  created_at         DateTime @default(now())
}

model DoctorReferidor {
  id         Int       @id @default(autoincrement())
  codigo_qr  String    @unique                            // ej. DR_GARCIA_042
  nombre     String
  created_at DateTime  @default(now())

  pacientes  Paciente[]
}

model Servicio {
  id                Int      @id @default(autoincrement())
  slug              String   @unique                      // corona|limpieza|blanqueamiento|brackets|implante
  nombre            String
  descripcion_corta String   @db.VarChar(300)
  precio_desde      String?                               // NULL = sin precio cerrado
  updated_at        DateTime @updatedAt
}

model ConsultorioInfo {
  id                Int     @id @default(1)               // siempre 1 fila
  direccion_texto   String
  maps_url          String
  horarios_texto    String
  scheduling_app_url String? @default(null)               // NULL en plan gratuito
  updated_at        DateTime @updatedAt
}

model UsuarioAdmin {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  password_hash String                                    // bcrypt cost 12
  reset_token   String?   @unique
  reset_token_at DateTime?
  created_at    DateTime  @default(now())
}

model LogWebhook {
  id         Int      @id @default(autoincrement())
  at         DateTime @default(now())
  wa_id      String
  event_type String                                       // message|status|etc.
  error      String?  @db.Text
  // [RIESGO] NO guardar payload completo: puede contener datos de salud (spec §13).
  // Solo metadata: wa_id + event_type + error.
}
```

> [!IMPORTANT]
> **config_bot** no existe como tabla DB (aclaración A2). Los mensajes del bot son constantes en `/lib/bot/messages.ts`. El nombre de la doctora se lee de `ConsultorioInfo` o de una variable `.env` (`DOCTOR_NAME`).

> [!CAUTION]
> `LogWebhook.payload` fue **eliminado** deliberadamente. `spec §12` dice guardarlo, pero `spec §13` prohíbe datos de salud en logs. El payload de WhatsApp contiene el texto del mensaje. Se guarda solo metadata.

---

## 2. Endpoints — Método / Ruta / Auth / Validación

### 2.1 Webhook Meta (público, validado por firma)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/whatsapp` | Verify Token | Verificación inicial de Meta |
| `POST` | `/api/whatsapp` | Firma HMAC-SHA256 | Recibir mensajes entrantes |

### 2.2 Auth

| Método | Ruta | Auth | Body / Validación |
|--------|------|------|-------------------|
| `POST` | `/api/auth/login` | Ninguna | `{ email: z.string().email(), password: z.string().min(1) }` · Rate-limit 5/15min por IP |
| `POST` | `/api/auth/logout` | Sesión | — |
| `POST` | `/api/auth/forgot` | Ninguna | `{ email: z.string().email() }` · Rate-limit 3/hora por email |
| `POST` | `/api/auth/reset` | Token 1h | `{ token: z.string(), password: z.string().min(8) }` |

### 2.3 Pacientes (panel)

| Método | Ruta | Auth | Validación |
|--------|------|------|------------|
| `GET` | `/api/pacientes` | Sesión | query: `page`, `limit` opcionales |
| `GET` | `/api/pacientes/[phone]` | Sesión | phone = wa_id URI-encoded |
| `PATCH` | `/api/pacientes/[phone]` | Sesión | `{ estado?, diagnostico_doctora?, nombre? }` · zod |
| `DELETE` | `/api/pacientes/[phone]` | Sesión | ARCO: borra nombre/motivo/consultas, deja `phone+rechazado` |

### 2.4 Consultas

| Método | Ruta | Auth | Validación |
|--------|------|------|------------|
| `GET` | `/api/pacientes/[phone]/consultas` | Sesión | — |
| `PATCH` | `/api/consultas/[id]` | Sesión | `{ diagnostico_doctora: z.string().max(2000) }` |

### 2.5 Admin — Servicios, Info, Doctores QR

| Método | Ruta | Auth | Validación |
|--------|------|------|------------|
| `GET` | `/api/admin/servicios` | Sesión | — |
| `PATCH` | `/api/admin/servicios/[slug]` | Sesión | `{ descripcion_corta: z.string().max(300), precio_desde? }` |
| `GET` | `/api/admin/consultorio` | Sesión | — |
| `PATCH` | `/api/admin/consultorio` | Sesión | `{ direccion_texto, maps_url, horarios_texto }` · zod |
| `GET` | `/api/admin/doctores` | Sesión | — |
| `POST` | `/api/admin/doctores` | Sesión | `{ nombre: z.string().min(2) }` → genera `codigo_qr` auto |
| `DELETE` | `/api/admin/doctores/[id]` | Sesión | — |

### 2.6 Mensajes (respuesta doctora)

| Método | Ruta | Auth | Validación |
|--------|------|------|------------|
| `POST` | `/api/mensajes/[phone]/libre` | Sesión | `{ texto: z.string().max(4096) }` · solo si ventana activa |
| `POST` | `/api/mensajes/[phone]/plantilla` | Sesión | `{ nombre, motivo }` · solo si ventana expirada |

> [!NOTE]
> Todos los endpoints `/api/*` excepto `/api/whatsapp` y `/api/auth/login` y `/api/auth/forgot` requieren sesión válida. Sin sesión → `401 Unauthorized`. Implementar en `middleware.ts` de Next.js.

---

## 3. Validación Webhook Meta

### 3.1 GET — Verificación (setup inicial)

```typescript
// /app/api/whatsapp/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}
```

### 3.2 POST — Firma HMAC-SHA256 + ack rápido

```typescript
export async function POST(req: Request) {
  // 1. Leer body crudo ANTES de cualquier parseo
  const rawBody   = await req.text();

  // 2. Validar firma (timing-safe)
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const expected  = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET!)
                      .update(rawBody).digest("hex");

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    await logWebhook(null, "auth_failure", "Firma inválida");
    return new Response("Unauthorized", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // 3. Rate-limit 30/min por wa_id (200 silencioso si excede)
  const waId = extractWaId(body);
  if (waId && isRateLimited(waId, 30, 60_000)) {
    return new Response("OK", { status: 200 }); // silencioso, no loguear como error
  }

  // 4. Procesar en background (no awaiteado) — requiere servidor persistente
  processWebhook(body, waId).catch((e) => logWebhook(waId, "process_error", e.message));

  // 5. ACK inmediato (< 5s o Meta reintenta)
  return new Response("OK", { status: 200 });
}
```

> [!IMPORTANT]
> `META_APP_SECRET` ≠ `META_TOKEN`. El primero verifica la firma del webhook entrante; el segundo (Bearer token) se usa para enviar mensajes salientes. Ambos obligatorios en `.env`.

> [!WARNING]
> **[RIESGO R2]** `processWebhook` en background sin `await`. En Vercel Serverless la función puede terminar antes de completar. **Desplegar en Railway/Render** (servidor persistente), no en Vercel Functions para el webhook.

---

## 4. Máquina de estados del bot

### Diagrama de estados

```
                    ┌─────────────┐
     primer msg ───►│  BIENVENIDA │
                    └──────┬──────┘
                           │ respuesta 1/2/3
                    ┌──────▼──────────┐
                    │  CONSENTIMIENTO │
                    └──────┬──────────┘
              ┌────────────┼────────────┐
             NO            SÍ/         recurrente
              │           ACEPTAR       │ (consentimiento=aceptado)
       ┌──────▼──────┐  ┌──▼──────┐   │
       │  RECHAZADO  │  │ NOMBRE  │   │
       └──────┬──────┘  └──┬──────┘   │
    ACEPTAR*  │             │ nombre   │
  (si no ARCO)│      ┌──────▼──────┐  │
              │      │   MOTIVO    │◄─┘
              │      └──────┬──────┘
              │             │ motivo
              │      ┌──────▼──────┐
              └─────►│    CIERRE   │
                     └──────┬──────┘
                            │ nuevo msg
                     ┌──────▼──────┐
                     │ RECURRENTE  │─── nuevo motivo ──► MOTIVO
                     └─────────────┘   (nueva Consulta)
```

*ACEPTAR posterior desde RECHAZADO: solo posible si `consentimiento ≠ rechazado-arco` (no fue borrado por ARCO). Si fue borrado → tratar como BIENVENIDA (paciente nuevo).

### Reglas de transición

```typescript
// /lib/bot/stateMachine.ts

type BotState = "BIENVENIDA" | "CONSENTIMIENTO" | "NOMBRE" | "MOTIVO"
              | "CIERRE" | "RECURRENTE" | "RECHAZADO";

async function handleMessage(waId: string, rawText: string): Promise<string> {
  // Sanitizar input siempre
  const text = rawText.trim().slice(0, 500);

  // Upsert paciente (primer contacto crea registro mínimo)
  const paciente = await prisma.paciente.upsert({
    where:  { phone_number: waId },
    create: { phone_number: waId, bot_state: "BIENVENIDA" },
    update: { last_patient_msg_at: new Date() },
  });

  // Actualizar timestamp en cada mensaje
  await prisma.paciente.update({
    where: { phone_number: waId },
    data:  { last_patient_msg_at: new Date() },
  });

  // Dispatch por estado
  switch (paciente.bot_state as BotState) {
    case "BIENVENIDA":     return handleBienvenida(paciente, text);
    case "CONSENTIMIENTO": return handleConsentimiento(paciente, text);
    case "RECHAZADO":      return handleRechazado(paciente, text);
    case "NOMBRE":         return handleNombre(paciente, text);
    case "MOTIVO":         return handleMotivo(paciente, text);
    case "CIERRE":         return handleCierre(paciente, text);
    case "RECURRENTE":     return handleRecurrente(paciente, text);
    default:               return handleBienvenida(paciente, text);
  }
}
```

### Reglas de negocio críticas

| Regla | Detalle |
|-------|---------|
| **Nunca diagnosticar** | Ningún handler emite diagnóstico, patología ni tratamiento |
| **Nunca precio cerrado** | Solo `precio_desde` o "el costo lo define la Dra. en consulta" |
| **Nunca link de agenda** | Cierre: "La Dra. le confirma por aquí mismo" |
| **Info bajo demanda** | Activada en CIERRE y RECURRENTE: dirección, horario, servicio |
| **Recurrente sin re-consentimiento** | Si `consentimiento=aceptado`: crear nueva `Consulta`, no nuevo `Paciente` |
| **Sanitización** | `text.trim().slice(0, 500)` + escape XSS antes de render en panel |

### Info bajo demanda — palabras clave

```typescript
// /lib/bot/keywords.ts
const KEYWORDS = {
  direccion: ["dirección", "direccion", "donde están", "donde estan", "ubicación", "ubicacion", "cómo llego", "como llego"],
  horario:   ["horario", "cuando abren", "qué días", "que dias", "horarios"],
  servicios: ["corona", "limpieza", "blanqueamiento", "brackets", "implante", "precio", "servicio", "costo", "cuánto cuesta"],
};
```

---

## 5. Ventana 24h — Cálculo backend puro

**Decisión A6:** sin columna extra, sin cron job. Lógica en cada request.

```typescript
// /lib/ventana.ts

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
  const cierraAt     = new Date(last_patient_msg_at.getTime() + 24 * 60 * 60 * 1000);
  const ahora        = Date.now();
  const diffMs       = cierraAt.getTime() - ahora;
  const horasRestantes = Math.max(0, diffMs / (1000 * 60 * 60));

  let semaforo: Semaforo;
  if (horasRestantes <= 0)        semaforo = "expirado";
  else if (horasRestantes < 1)    semaforo = "rojo";
  else if (horasRestantes < 6)    semaforo = "amarillo";
  else                             semaforo = "verde";

  return {
    horasRestantes: Math.round(horasRestantes * 10) / 10,
    expirada: horasRestantes <= 0,
    semaforo,
    cierraAt,
  };
}
```

### UI semáforo (CSS puro, sin sonido)

| Semáforo | Condición | Comportamiento UI |
|----------|-----------|-------------------|
| `verde` | >12h restantes | Punto verde, estático |
| `amarillo` | <6h restantes | Punto amarillo, `animation: pulse 2s infinite` |
| `rojo` | <1h restantes | Fondo rojo tenue, fila sube al tope de la lista |
| `expirado` | 0h / null | Fondo gris, botón "Responder libre" `disabled` |

### Respuesta libre vs plantilla

```
Ventana activa  → POST /api/mensajes/[phone]/libre    → texto libre
Ventana expirada → POST /api/mensajes/[phone]/plantilla → plantilla Meta aprobada

Plantilla: "Hola {{1}}, soy la Dra. [DOCTOR_NAME],
            retomo su consulta sobre {{2}}. ¿Continuamos con su cita?"
Params: {{1}}=nombre, {{2}}=motivo de la última Consulta
```

> [!IMPORTANT]
> La plantilla debe estar **aprobada por Meta antes de ir a producción**. Registrar en Meta Business Manager con mínimo 72h de anticipación al go-live (R4).

---

## 6. Auth + Reset por Gmail con rate-limits

### 6.1 Sesión

```
Cookie: httpOnly + Secure + SameSite=Lax + Max-Age=43200 (12h)
Firmada con SESSION_SECRET usando iron-session (o jose HS256)
Sin JWT en localStorage, sin cookies accesibles desde JS

middleware.ts matcher:
  '/panel/:path*'
  '/api/pacientes/:path*'
  '/api/consultas/:path*'
  '/api/admin/:path*'
  '/api/mensajes/:path*'
  '/api/auth/logout'
```

### 6.2 Flujo Login

```
POST /api/auth/login  { email, password }

1. Rate-limit 5/15min por IP → 429 si excede
2. Validar con zod
3. Buscar UsuarioAdmin por email
4. Si no existe → 401 (mismo mensaje que si existe, no revelar emails)
5. bcrypt.compare(password, password_hash)  [cost 12]
6. Si OK → set-cookie sesión 12h → 200
7. Si fail → 401 genérico sin detalle
```

### 6.3 Reset password (Gmail SMTP, aclaración A5)

```
POST /api/auth/forgot  { email }

1. Rate-limit 3/hora por email → 429 si excede
2. Validar zod
3. Si email existe:
   a. token = crypto.randomBytes(32).toString('hex')
   b. Guardar { reset_token: sha256(token), reset_token_at: now() }
   c. Enviar email con: https://dominio/reset?token=TOKEN_PLANO
      Asunto: "Recupera tu acceso — Consultorio Dra. [DOCTOR_NAME]"
4. Responder 200 siempre (no revelar si email existe)
```

```
POST /api/auth/reset  { token, password }

1. Validar zod: password min 8 chars
2. Buscar UsuarioAdmin donde reset_token = sha256(token)
3. Si no existe → 400 "Token inválido"
4. Si reset_token_at < now() - 1h → 400 "Token expirado" + limpiar token
5. bcrypt.hash(password, 12) → actualizar password_hash
6. Limpiar reset_token + reset_token_at (un solo uso)
7. Responder 200 → frontend redirige a /login
```

> [!NOTE]
> Token en URL = valor plano. En DB = `sha256(token)`. Si la DB se filtra, el token de la URL no sirve directamente.

### 6.4 Usuario inicial (sin registro público)

```bash
# prisma/seed.ts — ejecutar 1 vez en prod
# Lee ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD de proceso.env
# Inserta UsuarioAdmin con bcrypt.hash(password, 12)
# Insertar también los 5 servicios por defecto (corona, limpieza, etc.)
# Insertar 1 fila ConsultorioInfo con valores placeholder
```

---

## 7. Secretos `.env` y despliegue nube

### 7.1 `.env.example` (completo, valores vacíos)

```bash
# ── Base de datos ──────────────────────────────────────
DATABASE_URL=""                  # postgresql://USER:PASS@HOST:5432/DB?sslmode=require

# ── Meta WhatsApp Cloud API ────────────────────────────
META_TOKEN=""                    # Bearer token para ENVIAR mensajes (Graph API)
META_APP_SECRET=""               # Para validar firma X-Hub-Signature-256 (WEBHOOK)
VERIFY_TOKEN=""                  # Token secreto para verificación GET de Meta
PHONE_NUMBER_ID=""               # ID del número virtual registrado en Meta
BOT_WHATSAPP_NUMBER=""          # Número Perú del bot para QRs: 51 + 9 dígitos (ej. 51987654321). Ver T-44c.

# ── Sesión ─────────────────────────────────────────────
SESSION_SECRET=""                # Mín. 32 chars aleatorios. Rotar si se compromete.

# ── Email reset (Gmail App Password) ───────────────────
SMTP_USER=""                     # ej. paola@gmail.com
SMTP_PASS=""                     # App Password de Google (16 chars), no la contraseña real
SMTP_FROM=""                     # ej. "Consultorio Dra. Paola <paola@gmail.com>"

# ── Admin inicial (solo para seed, no compartir) ───────
ADMIN_EMAIL=""                   # Email de acceso al panel
ADMIN_INITIAL_PASSWORD=""        # Contraseña temporal, cambiar en primer login

# ── Doctora (notificación email en nuevo registro) ─────
DOCTOR_EMAIL=""                  # Email donde llegan alertas de nuevos pacientes
DOCTOR_NAME=""                   # ej. "Paola García" — aparece en mensajes del bot

# ── App ────────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=""          # ej. https://chatbot-paola.up.railway.app
```

### 7.2 Pasos de despliegue (Railway, monolítico)

```
Prerequisito: Meta número virtual + Business Manager verificado

1.  Crear repo GitHub privado. .gitignore con .env* desde commit 0.
2.  Crear proyecto en Railway → "Deploy from GitHub repo"
3.  Crear plugin Postgres en Railway (o conectar Neon externo)
4.  En Railway dashboard → Variables: pegar todos los valores de .env.example
5.  Agregar en package.json:
      "postinstall": "prisma generate"
      "start": "next start"
6.  Railway detecta Next.js y configura build automáticamente
7.  Primer deploy → esperar URL pública (ej. chatbot-paola.up.railway.app)
8.  Correr migraciones:  railway run npx prisma migrate deploy
9.  Correr seed (una vez): railway run npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
10. En Meta Developers → WhatsApp → Configuración:
      Webhook URL:  https://chatbot-paola.up.railway.app/api/whatsapp
      Verify Token: [valor de VERIFY_TOKEN]
      Suscribir a:  messages, message_deliveries, message_reads
11. Registrar plantilla en Meta Business Manager (72h antes de go-live)
12. Verificar https://chatbot-paola.up.railway.app/privacidad muestra aviso correcto
13. Probar flujo completo con número de prueba de Meta
14. Entregar a doctora: URL + ADMIN_EMAIL + contraseña temporal
15. Doctora cambia contraseña en primer login vía /reset
```

> [!CAUTION]
> Nunca commitear `.env`. Nunca hardcodear secretos. Solo `.env.example` con valores vacíos va al repositorio.

---

## 8. Riesgos [RIESGO] y fuera de alcance

### 8.1 Tabla de riesgos

| ID | Riesgo | Impacto | Mitigación MVP |
|----|--------|---------|----------------|
| R1 | `phone_number` como PK: paciente cambia número → FK huérfana en `consultas` | Medio | Spec lo exige. Documentado. Futuro: `id` interno + `phone` unique. |
| R2 | `processWebhook` background en Serverless puede cortarse antes de completar | Alto | Desplegar en Railway/Render (servidor persistente), **no Vercel** para webhook. |
| R3 | Rate-limit en `Map` de memoria falla con >1 instancia | Bajo MVP | 1 instancia. Escalar → Upstash Redis. |
| R4 | Plantilla Meta no aprobada antes de go-live → sin fallback para ventana expirada | Alto | Registrar plantilla ≥72h antes del go-live. Bloquear go-live hasta aprobación. |
| R5 | Confundir `META_APP_SECRET` con `META_TOKEN` en config | Medio | `.env.example` con comentarios explícitos diferenciando ambos. |
| R6 | Gmail SMTP bloqueado si supera 500 emails/día (límite Google) | Bajo MVP | Con 1 usuaria admin es imposible alcanzar. Escalar → Resend o SendGrid. |
| R7 | `LogWebhook` sin payload dificulta debug de errores de Meta | Bajo | Usar Meta Webhook Debugger en dashboard para replay. Suficiente para MVP. |
| R8 | Aviso de privacidad en `/privacidad` sin revisión legal real | Legal | La doctora debe validar el texto con asesor antes de go-live. No hay plantilla legal garantizada aquí. |

### 8.2 Fuera de alcance MVP

```
❌ Diagnósticos del bot (cualquier sugerencia médica/odontológica)
❌ Agenda automática o self-booking
❌ Integración API con consultorio.me (plan gratuito sin API)
❌ Links externos de agenda en mensajes del bot
❌ WebSockets / push / sonido en panel
❌ Multi-usuario o roles distintos (1 usuaria admin)
❌ Edición en vivo de mensajes del bot
❌ Notificación WhatsApp automática a la doctora (reemplazada por email SMTP)
❌ Importación masiva del histórico de consultorio.me
❌ Precio final cerrado en respuestas del bot
❌ CRM propio ni integración externa
❌ config_bot como tabla DB (es código en /lib/bot/messages.ts)
```

---

## 9. Mapa de archivos — referencia para tasks.md

```
/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/            (auto-generado)
│   └── seed.ts                (admin + servicios + consultorio_info iniciales)
│
├── app/
│   ├── api/
│   │   ├── whatsapp/route.ts  (GET verify + POST webhook)
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── forgot/route.ts
│   │   │   └── reset/route.ts
│   │   ├── pacientes/
│   │   │   ├── route.ts             (GET lista)
│   │   │   └── [phone]/
│   │   │       ├── route.ts         (GET detalle + PATCH + DELETE ARCO)
│   │   │       └── consultas/route.ts
│   │   ├── consultas/
│   │   │   └── [id]/route.ts        (PATCH diagnostico_doctora)
│   │   ├── admin/
│   │   │   ├── servicios/
│   │   │   │   ├── route.ts
│   │   │   │   └── [slug]/route.ts
│   │   │   ├── consultorio/route.ts
│   │   │   └── doctores/
│   │   │       ├── route.ts
│   │   │       └── [id]/route.ts
│   │   └── mensajes/
│   │       └── [phone]/
│   │           ├── libre/route.ts
│   │           └── plantilla/route.ts
│   │
 │   ├── panel/
│   │   ├── layout.tsx               (verifica sesión, redirige a /login si no)
│   │   ├── page.tsx                 (lista pacientes + semáforo, poll 60s)
│   │   ├── [phone]/page.tsx         (detalle + botones guardar diag + archivar + ARCO)
│   │   └── contenido/page.tsx       (editar servicios + consultorio_info)
│   ├── login/page.tsx               (email + password + toggle ver/ocultar)
│   ├── reset/page.tsx               (nueva contraseña con token)
│   └── privacidad/page.tsx          (aviso estático, sin auth)
│
├── lib/
│   ├── prisma.ts                    (singleton PrismaClient)
│   ├── auth.ts                      (sesión iron-session + bcrypt helpers)
│   ├── mail.ts                      (Nodemailer + Gmail SMTP)
│   ├── whatsapp.ts                  (envío mensajes Graph API)
│   ├── ratelimit.ts                 (Map en memoria, por IP / email / wa_id)
│   ├── ventana.ts                   (calcularVentana — §5)
│   └── bot/
│       ├── stateMachine.ts          (handleMessage + dispatch por estado)
│       ├── messages.ts              (textos del bot, constantes)
│       └── keywords.ts              (palabras clave info bajo demanda)
│
├── middleware.ts                    (protege /panel/* + /api/* con sesión)
├── .env.example                     (keys vacías)
└── .gitignore                       (.env* desde día 0)
```

---

## 10. Checklist — listo para tasks.md

- [ ] Todos los `[ACLARAR]` resueltos (A1–A7)
- [ ] Schema Prisma completo y alineado con spec §3
- [ ] Máquina de estados cubre todos los flujos de spec §4 (incluye recurrente + ARCO)
- [ ] Ventana 24h: sin columna extra, sin cron job, lógica pura
- [ ] Rate-limits definidos en todos los endpoints sensibles (login, forgot, webhook)
- [ ] `LogWebhook` sin payload (dato de salud protegido, decisión justificada)
- [ ] `.env.example` completo con comentarios, `.env` en `.gitignore`
- [ ] Plantilla Meta documentada como bloqueante antes de prod (R4)
- [ ] Aviso privacidad en `/privacidad` resuelto (A1)
- [ ] Notificación doctora → email SMTP, no WhatsApp (A5)
- [ ] config_bot → archivo de código, no tabla DB (A2)
