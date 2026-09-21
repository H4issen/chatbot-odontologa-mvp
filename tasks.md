# tasks.md — Chatbot Paola MVP (v2, corregido)
> Derivado de `plan.md` aprobado. Regla: **1 tarea = 1 commit atómico en español**.
> Tags: `[db]` `[backend]` `[frontend]` `[infra]` `[RIESGO]`
> Orden real de dependencia: **DB → webhook → bot → API panel → auth endpoints → frontend → deploy**
> Nota: `lib/auth.ts` y `middleware.ts` van antes de webhook porque son librerías base, no auth endpoints.

---

## BLOQUE 0 — Repositorio e infraestructura base
> Sin esto no hay nada. Primero siempre.

---

### T-01 `[infra]`
**Objetivo:** Crear repo privado, bootstrapear Next.js 14 con TypeScript y blindar secretos desde el primer commit.

**Archivos a tocar:**
- `git init` + repo privado en GitHub
- `.gitignore` → `.env*`, `node_modules/`, `.next/`, `*.tsbuildinfo`
- `package.json` → dependencias: `next@14`, `typescript`, `@prisma/client`, `prisma`, `zod`, `bcrypt` (nativo; T-03 lo cambió desde `bcryptjs` — ver plan B en T-46), `iron-session`, `nodemailer`, `@types/*`
- `tsconfig.json` → `strict: true`, `paths: { "@/*": ["./*"] }`
- `.env.example` → las 15 keys exactas del plan §7.1, valores vacíos, comentarios explicativos
- `README.md` → comandos: `npm i`, `cp .env.example .env`, `npx prisma migrate dev`, `npm run dev`

**Dependencias:** ninguna

**Criterio testeable:**
- `git status` no muestra `.env` (`.gitignore` funciona)
- `npm install` termina sin errores
- `npx tsc --noEmit` no falla en proyecto vacío
- `.env.example` tiene exactamente las 15 keys del plan §7.1

**Commit:** `infra: repo inicial Next.js 14 con .gitignore y .env.example`

---

## BLOQUE 1 — Base de datos
> Schema + migración + seed. Todo lo demás depende de esto.

---

### T-02 `[db]` `[RIESGO]`
**Objetivo:** Definir schema Prisma exacto del plan §1 y correr la migración inicial en dev.

**Archivos a tocar:**
- `prisma/schema.prisma` → 3 enums (`TipoContacto`, `Consentimiento`, `EstadoPaciente`) + 7 modelos: `Paciente`, `Consulta`, `DoctorReferidor`, `Servicio`, `ConsultorioInfo`, `UsuarioAdmin`, `LogWebhook`

**Dependencias:** T-01

**Criterio testeable:**
- `npx prisma migrate dev --name init` ejecuta sin error y genera `prisma/migrations/`
- `npx prisma studio` muestra exactamente 7 tablas
- `Paciente` tiene campo `bot_state String @default("BIENVENIDA")`
- `LogWebhook` **no** tiene campo `payload` (dato de salud protegido)
- `ConsultorioInfo` tiene `id Int @id @default(1)` (fila única por diseño)
- `UsuarioAdmin` tiene `reset_token String? @unique` y `reset_token_at DateTime?`

**Commit:** `db: schema Prisma 7 modelos, 3 enums y migración init`

---

### T-03 `[db]` `[RIESGO]`
**Objetivo:** Seed que crea la usuaria admin, los 5 servicios por defecto y la fila única de `ConsultorioInfo`.

**Archivos a tocar:**
- `prisma/seed.ts`
  - Lee `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` de `process.env` (falla explícito si faltan)
  - `bcrypt.hash(password, 12)` → inserta `UsuarioAdmin` (nunca guarda plano)
  - Inserta `Servicio` × 5: slugs `corona`, `limpieza`, `blanqueamiento`, `brackets`, `implante`; `descripcion_corta` = placeholder; `precio_desde = null`
  - Inserta `ConsultorioInfo { id: 1 }` con valores placeholder
- `package.json` → añadir `"prisma": { "seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts" }`

**Dependencias:** T-02

**Criterio testeable:**
- `npx prisma db seed` termina sin error
- `UsuarioAdmin` tiene 1 fila; `password_hash` empieza con `$2b$12$`
- `Servicio` tiene 5 filas con `precio_desde = NULL`
- `ConsultorioInfo` tiene exactamente 1 fila con `id = 1`
- Correr seed dos veces no duplica filas (usar `upsert`)

**Commit:** `db: seed admin, 5 servicios y consultorio_info`

---

## BLOQUE 2 — Librerías base (sin auth aún)
> Helpers compartidos. No escriben endpoints todavía.

---

### T-04 `[backend]`
**Objetivo:** Singleton `PrismaClient` para evitar conexiones múltiples en dev con hot-reload.

**Archivos a tocar:**
- `lib/prisma.ts` → patrón `global.__prisma ?? new PrismaClient()` estándar Next.js

**Dependencias:** T-02

**Criterio testeable:**
- Importar `prisma` desde dos módulos distintos → misma instancia (`===`)
- Ningún otro archivo fuera de `lib/prisma.ts` instancia `new PrismaClient()`

**Commit:** `backend: singleton PrismaClient`

---

### T-05 `[backend]`
**Objetivo:** Rate-limiter en memoria genérico por clave `(IP | email | wa_id)`.

**Archivos a tocar:**
- `lib/ratelimit.ts`
  - `isRateLimited(key: string, maxRequests: number, windowMs: number): boolean`
  - Limpia entradas expiradas en cada invocación (sin `setInterval`, evita leaks en serverless)
  - Exportar también `resetKey(key: string): void` para tests

**Dependencias:** T-01

**Criterio testeable:**
- 5 llamadas misma key, window 60s → las 5 retornan `false` (permitidas)
- 6ª llamada → retorna `true` (bloqueada)
- Después de `windowMs` ms → vuelve a retornar `false`
- `resetKey` limpia la ventana de esa key

**Commit:** `backend: rate-limiter en memoria por clave`

---

### T-06 `[backend]`
**Objetivo:** Helper `calcularVentana` — lógica 24h pura sin columna DB ni job.

**Archivos a tocar:**
- `lib/ventana.ts` → `calcularVentana(last: Date | null): { horasRestantes, expirada, semaforo, cierraAt }` exacto del plan §5

**Dependencias:** T-01

**Criterio testeable:**
- `calcularVentana(null)` → `{ expirada: true, semaforo: "expirado", cierraAt: null }`
- `calcularVentana(Date.now() - 23.5h)` → `semaforo: "rojo"`, `expirada: false`
- `calcularVentana(Date.now() - 19h)` → `semaforo: "amarillo"` (< 6h restantes)
- `calcularVentana(Date.now() - 10h)` → `semaforo: "verde"`
- `calcularVentana(Date.now() - 25h)` → `expirada: true`, `horasRestantes: 0`

**Commit:** `backend: calcularVentana 24h sin job ni columna extra`

---

### T-07 `[backend]`
**Objetivo:** Helper de envío de mensajes WhatsApp vía Meta Cloud API.

**Archivos a tocar:**
- `lib/whatsapp.ts`
  - `sendText(to: string, body: string): Promise<void>` → `POST graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages`
  - `sendTemplate(to: string, nombre: string, motivo: string): Promise<void>` → body con `type: "template"`, parámetros `{{1}}` y `{{2}}`
  - Headers: `Authorization: Bearer META_TOKEN`, `Content-Type: application/json`
  - Lanza `Error` descriptivo si respuesta no es 2xx (no traga errores)
  - Sin `META_TOKEN` en env → lanza al importar (fail fast)

**Dependencias:** T-01

**Criterio testeable:**
- `sendText` construye body JSON correcto: `{ messaging_product: "whatsapp", to, type: "text", text: { body } }`
- `sendTemplate` construye body con `type: "template"`, `name`, `language`, `components`
- Respuesta 4xx de Meta → lanza con mensaje que incluye status y body
- Sin `META_TOKEN` → `ReferenceError` al cargar el módulo

**Commit:** `backend: helper envío mensajes Meta Cloud API`

---

### T-08 `[backend]`
**Objetivo:** Helper SMTP Gmail para emails transaccionales (reset + alerta a doctora).

**Archivos a tocar:**
- `lib/mail.ts`
  - `sendResetEmail(to: string, resetUrl: string): Promise<void>`
  - `sendNewPatientAlert(patientName: string, motivo: string): Promise<void>` → destinatario = `DOCTOR_EMAIL`
  - Nodemailer transport: `smtp.gmail.com:587`, `starttls`
  - Sin `SMTP_PASS` → lanza al inicializar transport (fail fast)

**Dependencias:** T-01

**Criterio testeable:**
- Transport se configura con `host: "smtp.gmail.com"`, `port: 587`, `secure: false`
- `sendResetEmail` produce email con `?token=` en el cuerpo
- `sendNewPatientAlert` usa `DOCTOR_EMAIL` como destinatario
- Sin `SMTP_PASS` → error al importar el módulo (no silencioso)

**Commit:** `backend: helper SMTP Gmail reset y alertas`

---

## BLOQUE 3 — Auth librería + middleware
> Prerequisito para cualquier endpoint protegido. Va antes del webhook.

---

### T-09 `[backend]` `[RIESGO]`
**Objetivo:** Helper de sesión con iron-session (cookie httpOnly + Secure + SameSite=Lax + 12h) y helpers bcrypt.

**Archivos a tocar:**
- `lib/auth.ts`
  - `getSession(req: Request): Promise<{ userId: number } | null>`
  - `createSessionResponse(userId: number, baseResponse: Response): Response` → set-cookie iron-session
  - `clearSessionResponse(baseResponse: Response): Response` → Max-Age=0
  - `hashPassword(plain: string): Promise<string>` → `bcrypt.hash(plain, 12)`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>` → `bcrypt.compare`
- `lib/session.config.ts` → opciones iron-session: `cookieName`, `password: SESSION_SECRET`, `cookieOptions: { httpOnly, secure, sameSite: "lax", maxAge: 43200 }`

**Dependencias:** T-01

**Criterio testeable:**
- `hashPassword("test")` → string que empieza con `$2b$12$`
- `verifyPassword("test", hash)` → `true`
- `verifyPassword("wrong", hash)` → `false`
- Cookie generada por iron-session tiene flags `HttpOnly; Secure; SameSite=Lax; Max-Age=43200`
- Sin `SESSION_SECRET` → error lazy al crear/leer sesión, nada al importar (fixup: el fail-fast al importar tumbaba el middleware en Edge)

**Observación auditoría (fixup T-09 aplicado):** `createSessionResponse` OBLIGATORIAMENTE sella con iron-session (`sealData`, misma password/opciones) — la versión inicial escribía JSON plano y ningún login real validaba (T-32/T-33/T-39 verdes por separado, flujo roto). Verificado: login → cookie sellada → `/panel` sin redirect. Además `bcrypt` nativo se importa lazy (`await import`) porque el estático crashea el middleware en Edge.

**Commit:** `backend(auth): helper sesión iron-session y bcrypt cost 12`

---

### T-10 `[backend]` `[RIESGO]`
**Objetivo:** Middleware Next.js que protege `/panel/*` y `/api/*` protegidos (excepto rutas públicas).

**Archivos a tocar:**
- `middleware.ts`
  - matcher: `/panel/:path*`, `/api/pacientes/:path*`, `/api/consultas/:path*`, `/api/admin/:path*`, `/api/mensajes/:path*`, `/api/auth/logout`
  - Rutas públicas (no en matcher): `/api/whatsapp`, `/api/auth/login`, `/api/auth/forgot`, `/api/auth/reset`, `/privacidad`, `/login`, `/reset`
  - Sin sesión válida → redirect 302 a `/login` para rutas `/panel/`; `401` para rutas `/api/`

**Dependencias:** T-09

**Criterio testeable:**
- `GET /panel` sin cookie → 302 a `/login`
- `GET /api/pacientes` sin cookie → 401
- `GET /api/whatsapp` sin cookie → pasa al handler (no bloqueado)
- `GET /privacidad` sin cookie → pasa al handler (no bloqueado)
- `GET /panel` con cookie válida → 200

**Commit:** `backend: middleware auth protege panel y api`

---

## BLOQUE 4 — Webhook Meta
> Puerta de entrada de todos los mensajes. Requiere T-05 (rate-limit) y T-07 (whatsapp helper).

---

### T-11 `[backend]` `[RIESGO]`
**Objetivo:** `GET /api/whatsapp` — verificación inicial de Meta (handshake único al registrar el webhook).

**Archivos a tocar:**
- `app/api/whatsapp/route.ts` → solo función `GET`
  - Compara `hub.mode === "subscribe"` y `hub.verify_token === VERIFY_TOKEN`
  - Si OK → responde con `hub.challenge` (texto plano, status 200)
  - Si no → 403

**Dependencias:** T-01

**Criterio testeable:**
- `GET /api/whatsapp?hub.mode=subscribe&hub.verify_token=<correcto>&hub.challenge=abc` → 200, body = `"abc"`
- `GET /api/whatsapp?hub.verify_token=<incorrecto>` → 403
- `GET /api/whatsapp` sin parámetros → 403

**Commit:** `backend(webhook): GET verify token Meta`

---

### T-12 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/whatsapp` — validación HMAC-SHA256 timing-safe, rate-limit por wa_id, ack inmediato y despacho background.

**Archivos a tocar:**
- `app/api/whatsapp/route.ts` → añadir función `POST`
  - Lee body crudo con `req.text()` **antes** de cualquier parseo
  - Valida firma `X-Hub-Signature-256` con `timingSafeEqual` (evita timing attacks)
  - Firma inválida → 401 + log en `LogWebhook` (`event_type: "auth_failure"`)
  - Extrae `wa_id` del body parseado
  - Rate-limit 30/min por `wa_id` → 200 silencioso si excede (Meta no reintenta)
  - Llama `processWebhook(body, waId)` sin `await` (background)
  - Retorna 200 inmediatamente (< 5s o Meta reintenta)
- `lib/webhook.ts` → `extractWaId(body): string | null`, `logWebhookEvent(waId, type, error?)`

**Dependencias:** T-05, T-04, T-11

**Criterio testeable:**
- `POST` con firma HMAC válida → 200, latencia < 200ms
- `POST` con firma inválida → 401 + nueva fila en `LogWebhook`
- `POST` sin header `X-Hub-Signature-256` → 401
- 31er `POST` del mismo `wa_id` en 60s → 200 silencioso (no procesa)
- `META_APP_SECRET` ausente → error al importar (no silencioso)

**Commit:** `backend(webhook): POST HMAC-SHA256 timing-safe + ack inmediato`

---

## BLOQUE 5 — Bot (máquina de estados)
> Requiere T-04 (Prisma), T-07 (WhatsApp), T-08 (SMTP), T-06 (ventana), T-12 (webhook POST).

---

### T-13 `[backend]`
**Objetivo:** Constantes de mensajes del bot y función de detección de palabras clave (info bajo demanda).

**Archivos a tocar:**
- `lib/bot/messages.ts`
  - Constantes con texto exacto de spec §4 para cada mensaje: bienvenida, consentimiento, solicitud nombre, solicitud motivo, cierre en horario, cierre fuera de horario, rechazado, recurrente, dirección, horario, servicio, disclaimer sin diagnóstico
  - `buildMessage(template: string, vars: Record<string, string>): string` (sustituye `[variable]`)
  - Ninguna constante contiene: "diagnóstico", "padece", "tiene caries", "precio exacto", "cuesta $"
- `lib/bot/keywords.ts`
  - `KEYWORDS` exacto del plan §4: `direccion`, `horario`, `servicios`
  - `matchKeyword(text: string): "direccion" | "horario" | "servicio" | null` (case-insensitive, normaliza tildes)

**Dependencias:** T-01

**Criterio testeable:**
- `matchKeyword("donde quedan")` → `"direccion"`
- `matchKeyword("CUÁNTO CUESTA blanqueamiento")` → `"servicio"`
- `matchKeyword("cuando abren")` → `"horario"`
- `matchKeyword("hola")` → `null`
- `buildMessage("Hola [nombre]", { nombre: "Ana" })` → `"Hola Ana"`
- Buscar `"diagnóstico"` en todo `messages.ts` → 0 resultados

**Commit:** `backend(bot): mensajes constantes y matching palabras clave`

---

### T-14 `[backend]`
**Objetivo:** `handleMessage` dispatcher + `handleBienvenida` — segmentación tipo de contacto y código doctor.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → crear archivo con:
  - `handleMessage(waId: string, rawText: string): Promise<string>` — sanitiza (`text.trim().slice(0, 500)`), upsert `Paciente`, actualiza `last_patient_msg_at`, dispatch por `bot_state`
  - `handleBienvenida(paciente, text)` → valida respuesta 1/2/3; guarda `tipo_contacto`; si tipo = referido, solicita código QR; avanza `bot_state → "CONSENTIMIENTO"`

**Dependencias:** T-04, T-13

**Criterio testeable:**
- `wa_id` nuevo → crea `Paciente` con `bot_state: "BIENVENIDA"` y responde mensaje de bienvenida
- Mensaje `"1"` → `tipo_contacto = "referido"`, `bot_state = "CONSENTIMIENTO"`, respuesta pide código doctor
- Mensaje `"2"` → `tipo_contacto = "conocido"`, `bot_state = "CONSENTIMIENTO"`
- Mensaje `"3"` → `tipo_contacto = "empresa"`, `bot_state = "CONSENTIMIENTO"`
- Mensaje inválido (`"hola"`) en estado BIENVENIDA → re-envía mensaje de bienvenida

**Commit:** `backend(bot): handleMessage dispatcher y handleBienvenida`

---

### T-15 `[backend]` `[RIESGO]`
**Objetivo:** `handleConsentimiento` — registra decisión, actualiza DB, bifurca flujo.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleConsentimiento(paciente, text)`
  - Normaliza texto (trim, lower, quitar tildes)
  - `"si"` / `"sí"` / `"aceptar"` / `"acepto"` → `consentimiento = "aceptado"`, `consentimiento_at = now()`, `bot_state = "NOMBRE"`, `estado = "registrado"`
  - `"no"` → `consentimiento = "rechazado"`, `consentimiento_at = now()`, `bot_state = "RECHAZADO"`, guarda solo `phone + rechazado`
  - Cualquier otra respuesta → re-envía mensaje de consentimiento

**Dependencias:** T-14

**Criterio testeable:**
- Mensaje `"SÍ"` → `consentimiento = "aceptado"` en DB, `bot_state = "NOMBRE"`
- Mensaje `"ACEPTO"` → mismo resultado
- Mensaje `"NO"` → `consentimiento = "rechazado"` en DB, `bot_state = "RECHAZADO"`
- Mensaje `"quizás"` → bot re-envía mensaje de consentimiento, estado no cambia
- `nombre` y `motivo` siguen siendo `null` después del NO

**Commit:** `backend(bot): handleConsentimiento bifurca aceptado/rechazado`

---

### T-16 `[backend]` `[RIESGO]`
**Objetivo:** `handleRechazado` — lógica de reactivación con verificación de borrado ARCO.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleRechazado(paciente, text)`
  - Si texto normalizado = `"aceptar"` / `"acepto"` / `"si"`:
    - Si `nombre !== null` (fue borrado por ARCO) → el nombre ya no existe, tratar como paciente nuevo: `bot_state = "BIENVENIDA"` (spec §14 + plan A3)
    - Si `nombre === null` pero `consentimiento = "rechazado"` sin borrado → puede reactivar: `consentimiento = "aceptado"`, `bot_state = "NOMBRE"`
  - Cualquier otro texto → responde mensaje de rechazado + recuerda que puede escribir ACEPTAR

**Dependencias:** T-15

**Criterio testeable:**
- `RECHAZADO` + mensaje `"ACEPTAR"` sin ARCO previo → `bot_state = "NOMBRE"`, `consentimiento = "aceptado"`
- `RECHAZADO` + ARCO (nombre borrado) + mensaje `"ACEPTAR"` → `bot_state = "BIENVENIDA"` (flujo nuevo)
- `RECHAZADO` + mensaje `"hola"` → re-envía mensaje de estado rechazado

**Observación auditoría (T-16 cerrada con reserva):** la rama `nombre !== null → BIENVENIDA` es hoy inalcanzable — ningún flujo vivo deja nombre en un RECHAZADO — y además contradice la forma que T-25 produce (post-ARCO = `nombre = null`, que cae en reactivación a NOMBRE, no a BIENVENIDA como pide el criterio de arriba). No reabrir T-16: resolver en T-25 antes de construirlo. Árbitro final: T-48 punto 8.

**Commit:** `backend(bot): handleRechazado con lógica ARCO`

---

### T-17 `[backend]`
**Objetivo:** `handleNombre` — captura y persiste nombre del paciente.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleNombre(paciente, text)`
  - Sanitiza: `text.trim().slice(0, 500)`
  - Guarda `nombre` en `Paciente`
  - Avanza `bot_state = "MOTIVO"`
  - Responde con `"Mucho gusto, [nombre]. Cuénteme con sus palabras, ¿qué molestia presenta..."`

**Dependencias:** T-15

**Criterio testeable:**
- Cualquier texto no vacío → se guarda en `Paciente.nombre`, `bot_state = "MOTIVO"`
- Texto > 500 chars → truncado a 500 antes de guardar
- Texto vacío (solo espacios) → bot repite la solicitud de nombre
- Nombre guardado no contiene HTML ni scripts (XSS sanitizado)

**Commit:** `backend(bot): handleNombre captura y persiste nombre`

---

### T-18 `[backend]` `[RIESGO]`
**Objetivo:** `handleMotivo` — crea `Consulta`, envía email alerta a doctora, avanza a CIERRE.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleMotivo(paciente, text)`
  - Sanitiza `text.trim().slice(0, 500)`
  - Crea nueva `Consulta { paciente_phone, motivo_reportado: text }`
  - Avanza `bot_state = "CIERRE"`, `estado = "registrado"` en `Paciente`
  - Llama `sendNewPatientAlert(paciente.nombre, text)` de `lib/mail.ts` (no awaiteado, fire-and-forget con catch)
  - **[ACLARAR]** Mensaje de cierre: spec §4 distingue "en horario" vs "fuera de horario" pero `horarios_texto` es texto libre, no parseable. Por ahora: usar siempre el mensaje de horario activo. Si se quiere detección por hora del servidor, agregar `horario_inicio` y `horario_fin` como campos `Int` (hora en formato 0-23) a `ConsultorioInfo` — fuera de alcance MVP actual.

**Dependencias:** T-17, T-08, T-04

**Criterio testeable:**
- Mensaje de motivo → nueva `Consulta` en DB con `motivo_reportado` correcto
- `bot_state = "CIERRE"`, `estado = "registrado"` en `Paciente`
- Error en `sendNewPatientAlert` → loguea pero no rompe el flujo (paciente igual recibe respuesta)
- Texto vacío → bot repite solicitud de motivo
- `motivo_reportado` no contiene HTML sin escapar

**Observación auditoría (T-18 cerrada):** el `motivo_reportado` (dato de salud) viaja en el email a `DOCTOR_EMAIL` — es el canal notificador decidido (A5, solo equipo tratante), aceptado para MVP. Además el `catch` del fire-and-forget hace `console.error` con el objeto de error SMTP, que podría arrastrar contenido a logs: vigilar en T-46 que ningún log persista datos de salud.

**Commit:** `backend(bot): handleMotivo crea Consulta y envía alerta SMTP`

---

### T-19 `[backend]`
**Objetivo:** `handleCierre` — responde info bajo demanda (keywords) o avanza a RECURRENTE.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleCierre(paciente, text)`
  - Llama `matchKeyword(text)` de `lib/bot/keywords.ts`
  - Si `"direccion"` → lee `ConsultorioInfo.direccion_texto` + `maps_url` de DB y responde
  - Si `"horario"` → lee `ConsultorioInfo.horarios_texto` de DB y responde
  - Si `"servicio"` → busca `Servicio` por slug que coincida con keyword, responde `descripcion_corta` + disclaimer `"Sin compromiso, el costo final y diagnóstico solo los define la Dra. en consulta."`
  - Cualquier otro texto → avanza `bot_state = "RECURRENTE"`, responde mensaje recurrente
  - Bot **nunca** menciona precio cerrado ni diagnóstico en este handler

**Dependencias:** T-13, T-17, T-04

**Criterio testeable:**
- Mensaje `"donde quedan"` en CIERRE → responde con `maps_url` de DB, `bot_state` sigue en `"CIERRE"`
- Mensaje `"limpieza"` → responde `Servicio.descripcion_corta` donde `slug = "limpieza"` + disclaimer
- Respuesta de servicio no contiene `"diagnóstico"`, `"necesita"`, ni precio numerico final
- Mensaje `"hola"` → `bot_state = "RECURRENTE"`

**Commit:** `backend(bot): handleCierre info bajo demanda y avance a RECURRENTE`

---

### T-20 `[backend]`
**Objetivo:** `handleRecurrente` — crea nueva consulta sin duplicar paciente, sin pedir consentimiento.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir `handleRecurrente(paciente, text)`
  - Si `matchKeyword(text)` → igual que `handleCierre` (info bajo demanda)
  - Si texto no es keyword y es el primer mensaje en RECURRENTE → responde pregunta recurrente spec §4
  - Si paciente ya tiene contexto recurrente → interpreta el texto como nuevo motivo: crea nueva `Consulta { motivo_reportado: text }`, llama `sendNewPatientAlert`, queda en `bot_state = "CIERRE"`
  - NO crea nuevo `Paciente` bajo ninguna circunstancia
  - NO pide consentimiento si `consentimiento = "aceptado"`

**Dependencias:** T-19, T-04, T-08

**Criterio testeable:**
- Mismo `wa_id` dos mensajes distintos completos → 1 `Paciente`, 2 `Consulta`
- En RECURRENTE, mensaje de motivo → nueva `Consulta` creada, `bot_state = "CIERRE"` de nuevo
- En RECURRENTE, `"donde quedan"` → responde info dirección sin crear consulta

**Commit:** `backend(bot): handleRecurrente sin duplicar paciente`

---

### T-21 `[backend]` `[RIESGO]`
**Objetivo:** `processWebhook` — conectar webhook POST con la máquina de estados y el envío de respuesta.

**Archivos a tocar:**
- `lib/bot/processor.ts` (o inlinear en `app/api/whatsapp/route.ts`)
  - `processWebhook(body: unknown, waId: string | null): Promise<void>`
  - Extrae `waId` y `text` del payload Meta (formato `entry[0].changes[0].value.messages[0]`)
  - Ignora si tipo de mensaje ≠ `"text"` (status updates, read receipts, reacciones)
  - Llama `handleMessage(waId, text)` → obtiene `respuesta: string`
  - Llama `sendText(waId, respuesta)` de `lib/whatsapp.ts`
  - Cualquier error → loguea en `LogWebhook { wa_id, event_type: "process_error", error: message }` sin exponer datos de salud
- `app/api/whatsapp/route.ts` → referenciar `processWebhook` en el `POST`
  - Resolver deuda T-12: `JSON.parse` dentro de try/catch → JSON inválido con firma válida devuelve 200 silencioso + fila en `LogWebhook` (`event_type: "invalid_json"`), nunca 4xx/5xx (evita loop de reintentos de Meta)
  - `waId === null` (status callbacks) → skip: no rate-limit, no upsert de paciente, solo log como `eventType: "status"`

**Dependencias:** T-12, T-20, T-07

**Criterio testeable:**
- Payload de mensaje de texto de Meta → bot procesa y responde vía WhatsApp
- Payload de `status: "delivered"` → no genera respuesta, no crea consulta
- Error en `handleMessage` → `LogWebhook` tiene nueva fila, `processWebhook` no lanza
- `sendText` falla (Meta down) → loguea error, no rompe el proceso
- Body no-JSON con firma válida → 200 silencioso + fila `invalid_json` (deuda T-12 cerrada)

**Commit:** `backend(bot): processWebhook conecta webhook con máquina de estados`

---

## BLOQUE 6 — API REST panel
> Requiere T-10 (middleware) y T-04 (Prisma). El middleware ya protege estas rutas.

---

### T-22 `[backend]`
**Objetivo:** `GET /api/pacientes` — lista paginada con ventana calculada.

**Archivos a tocar:**
- `app/api/pacientes/route.ts` (GET)
  - Query params: `page` (default 1), `limit` (default 20)
  - Orden: `last_patient_msg_at DESC NULLS LAST`
  - Por cada paciente: `calcularVentana(last_patient_msg_at)` incluido en respuesta
  - Incluye `_count: { consultas: true }` y última consulta

**Dependencias:** T-06, T-10, T-04

**Criterio testeable:**
- `GET /api/pacientes` sin sesión → 401
- `GET /api/pacientes` con sesión → 200, array con campo `ventana.semaforo` por ítem
- Paciente con `last_patient_msg_at` hace 25h → `ventana.expirada = true` en respuesta
- Respeta `?limit=5` → máximo 5 resultados

**Observación auditoría (T-22 cerrada):** `limit` sin tope máximo (`?limit=100000` pesado). Irrelevante con volumen MVP; si se endurece, una línea: `Math.min(limit, 100)`. No reabrir por esto.

**Commit:** `backend(api): GET /api/pacientes lista paginada con ventana`

---

### T-23 `[backend]`
**Objetivo:** `GET /api/pacientes/[phone]` — detalle completo de un paciente con consultas y ventana.

**Archivos a tocar:**
- `app/api/pacientes/[phone]/route.ts` (solo GET aquí)
  - Retorna paciente + todas sus `consultas` ordenadas por `created_at DESC`
  - Incluye `calcularVentana(last_patient_msg_at)` + `doctor_referidor` si existe
  - Phone llega URI-encoded → `decodeURIComponent` antes de query

**Dependencias:** T-22

**Criterio testeable:**
- `GET /api/pacientes/<phone>` con sesión → 200 con objeto paciente + `ventana` + `consultas[]`
- `GET /api/pacientes/<phone_inexistente>` → 404
- `ventana.cierraAt` es fecha válida o `null`

**Commit:** `backend(api): GET /api/pacientes/[phone] detalle con consultas y ventana`

---

### T-24 `[backend]` `[RIESGO]`
**Objetivo:** `PATCH /api/pacientes/[phone]` — actualizar estado o nombre del paciente.

**Archivos a tocar:**
- `app/api/pacientes/[phone]/route.ts` → añadir PATCH
  - Zod: `{ estado: z.enum(["nuevo","registrado","citado_externo","archivado"]).optional(), nombre: z.string().max(500).optional() }`
  - Sanitiza `nombre` antes de guardar (trim, escape básico)
  - No permite editar `phone_number`, `consentimiento`, `bot_state` desde este endpoint

**Dependencias:** T-23

**Criterio testeable:**
- `PATCH` con `{ estado: "archivado" }` → persiste en DB, responde 200
- `PATCH` con `nombre` de 501 chars → 400 zod
- `PATCH` con campo no permitido (`bot_state`) → ignorado o 400
- `PATCH` sin sesión → 401 (middleware)

**Commit:** `backend(api): PATCH /api/pacientes/[phone] estado y nombre`

---

### T-25 `[backend]` `[RIESGO]`
**Objetivo:** `DELETE /api/pacientes/[phone]` — borrado ARCO total (sin fila de bloqueo).

**Archivos a tocar:**
- `app/api/pacientes/[phone]/route.ts` → añadir DELETE
  - Borra todas las `Consulta` del paciente (cascada manual con `deleteMany`)
  - Borra la fila `Paciente` completa (cero PII retenida; sin registro de bloqueo)

**Dependencias:** T-24

**DECISIÓN TOMADA: opción b — borrado total de la fila (+ cascada de consultas).** Sin fila de bloqueo: el próximo mensaje hace upsert fresco = BIENVENIDA full (segmentación + consentimiento con link). Criterio T-16 queda válido tal cual. Se pierde el stonewall de "debe decir ACEPTAR" a cambio de cero PII retenida tras cancelación.

**Criterio testeable:**
- `DELETE /api/pacientes/<phone>` → 200; ni la fila `Paciente` ni sus `Consulta` existen en DB
- El bot, al recibir mensaje de ese `wa_id`, hace upsert fresco = BIENVENIDA full (coherente con criterio T-16 y decisión A3)

**Commit:** `backend(api): DELETE ARCO deja phone+rechazado como bloqueo`

---

### T-26 `[backend]`
**Objetivo:** `GET + PATCH /api/pacientes/[phone]/consultas` y `PATCH /api/consultas/[id]` (diagnóstico doctora).

**Archivos a tocar:**
- `app/api/pacientes/[phone]/consultas/route.ts` (GET) → lista ordenada por `created_at DESC`
- `app/api/consultas/[id]/route.ts` (PATCH)
  - Zod: `{ diagnostico_doctora: z.string().max(2000) }`
  - Solo la doctora lo escribe desde el panel; el bot nunca llama a este endpoint

**Dependencias:** T-25, T-10

**Criterio testeable:**
- `GET /api/pacientes/<phone>/consultas` → array ordenado `created_at DESC`
- `PATCH /api/consultas/<id>` con `diagnostico_doctora` → guardado en DB, responde 200
- `PATCH /api/consultas/<id>` con texto > 2000 chars → 400 zod
- `PATCH /api/consultas/<id_inexistente>` → 404

**Observación auditoría (T-26 cerrada):** verificado que ningún handler del bot (T-13–T-21) llama a este PATCH — el diagnóstico entra solo vía panel de doctora. Mantenerlo así: si un futuro handler necesitara escribirlo, es cambio de diseño, no fix.

**Commit:** `backend(api): consultas GET lista y PATCH diagnostico doctora`

---

### T-27 `[backend]`
**Objetivo:** `GET + PATCH /api/admin/servicios` y `PATCH /api/admin/servicios/[slug]`.

**Archivos a tocar:**
- `app/api/admin/servicios/route.ts` (GET) → lista los 5 servicios
- `app/api/admin/servicios/[slug]/route.ts` (PATCH)
  - Zod: `{ descripcion_corta: z.string().max(300), precio_desde: z.string().optional().nullable() }`
  - No permite cambiar `slug` ni `nombre`
  - Guard de contenido (ver observación T-19): rechazar con 400 si `descripcion_corta` contiene ["diagnóstico", "diagnostico", "padece", "necesita"] (case-insensitive, con/sin tildes) — la validación vive en escritura, nunca se muta texto en lectura

**Dependencias:** T-10, T-04

**Criterio testeable:**
- `GET /api/admin/servicios` → array de 5 servicios con `slug`, `nombre`, `descripcion_corta`, `precio_desde`
- `PATCH /api/admin/servicios/corona` con `descripcion_corta` de 300 chars → 200
- `PATCH /api/admin/servicios/corona` con `descripcion_corta` de 301 chars → 400 zod
- `PATCH /api/admin/servicios/corona` con `descripcion_corta` conteniendo "diagnóstico" → 400 con mensaje claro
- `PATCH /api/admin/servicios/inexistente` → 404

**Commit:** `backend(api): admin GET y PATCH servicios`

---

### T-28 `[backend]`
**Objetivo:** `GET + PATCH /api/admin/consultorio`.

**Archivos a tocar:**
- `app/api/admin/consultorio/route.ts` (GET + PATCH)
  - GET → retorna la fila única `ConsultorioInfo`
  - PATCH Zod: `{ direccion_texto: z.string().min(1), maps_url: z.string().url(), horarios_texto: z.string().min(1) }`
  - Usa `update` con `id = 1` (fila única)

**Dependencias:** T-10, T-04

**Criterio testeable:**
- `GET /api/admin/consultorio` → objeto con `direccion_texto`, `maps_url`, `horarios_texto`
- `PATCH` actualiza los 3 campos → bot usa el nuevo `maps_url` en siguiente mensaje de dirección
- `PATCH` con `maps_url` inválida (no es URL) → 400 zod

**Commit:** `backend(api): admin GET y PATCH consultorio_info`

---

### T-29 `[backend]`
**Objetivo:** `GET + POST /api/admin/doctores` y `DELETE /api/admin/doctores/[id]`.

**Archivos a tocar:**
- `app/api/admin/doctores/route.ts` (GET + POST)
  - POST Zod: `{ nombre: z.string().min(2).max(100) }`
  - Genera `codigo_qr = "DR_" + nombre.toUpperCase().replace(/\s+/g, "_") + "_" + Date.now().toString(36).toUpperCase()`
  - Verifica unicidad de `codigo_qr` antes de insertar
- `app/api/admin/doctores/[id]/route.ts` (DELETE) → verifica existencia → `deleteById`

**Dependencias:** T-10, T-04

**Criterio testeable:**
- `POST /api/admin/doctores` con `{ nombre: "García López" }` → crea con `codigo_qr` único empezando con `DR_`
- Dos doctores con mismo nombre → `codigo_qr` distintos (timestamp diferente)
- `DELETE /api/admin/doctores/<id_inexistente>` → 404
- `GET /api/admin/doctores` → lista todos los doctores con `codigo_qr` y `nombre`

**Commit:** `backend(api): admin doctores GET, POST genera QR, DELETE`

---

### T-29b `[backend]`
**Objetivo:** Parseo de código QR en el bot y asignación de `doctor_referidor_id` al paciente.

**Archivos a tocar:**
- `lib/bot/stateMachine.ts` → añadir estado `REFERIDO_CODIGO` y handler `handleReferidoCodigo`
  - Nuevo estado entre `BIENVENIDA` y `CONSENTIMIENTO`
  - Parsea código QR con regex: `/(?:REF_)?(DR_[A-Z0-9_]+)/i`
  - Busca `DoctorReferidor` por `codigo_qr` en DB
  - Asigna `doctor_referidor_id` al `Paciente`
  - Avanza a `CONSENTIMIENTO`
  - Si no hay código o es inválido, continúa sin asignar doctor

**Dependencias:** T-29

**Criterio testeable:**
- Paciente elige "1" (referido) → avanza a `REFERIDO_CODIGO`
- Envía código QR válido (ej: `DR_GARCIA_LOPEZ_MUA9R7X1`) → asigna `doctor_referidor_id` y avanza a `CONSENTIMIENTO`
- Envía código con prefijo `REF_` → parsea correctamente
- No tiene código o envía texto sin código → continúa a `CONSENTIMIENTO` sin asignar doctor
- Código inválido (no existe en DB) → continúa a `CONSENTIMIENTO` sin asignar doctor

**Commit:** `feat(T-29b): parseo de código QR y asignación doctor_referidor_id en bot`

---

### T-30 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/mensajes/[phone]/libre` — doctora responde con texto libre si ventana activa.

**Archivos a tocar:**
- `app/api/mensajes/[phone]/libre/route.ts`
  - Busca paciente; si no existe → 404
  - `calcularVentana(last_patient_msg_at)` → si `expirada` → 403 `"Ventana cerrada, use plantilla"`
  - Zod: `{ texto: z.string().min(1).max(4096) }`
  - Llama `sendText(phone, texto)` de `lib/whatsapp.ts`
  - Responde 200

**Dependencias:** T-06, T-07, T-10

**Criterio testeable:**
- `POST libre` con ventana activa → 200 + mensaje enviado a WhatsApp
- `POST libre` con ventana expirada → 403
- `POST libre` con `texto` vacío → 400 zod
- `POST libre` sin sesión → 401 (middleware)

**Commit:** `backend(api): POST mensajes libre con validación ventana activa`

---

### T-31 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/mensajes/[phone]/plantilla` — doctora reactiva conversación expirada.

**Archivos a tocar:**
- `app/api/mensajes/[phone]/plantilla/route.ts`
  - Busca paciente + última consulta (para `motivo`)
  - Llama `sendTemplate(phone, paciente.nombre ?? "paciente", ultimaConsulta?.motivo_reportado ?? "su consulta")`
  - Responde 200

**Dependencias:** T-07, T-10, T-04

**Criterio testeable:**
- `POST plantilla` → 200 + plantilla enviada (verificar en WhatsApp número de prueba)
- `POST plantilla` con paciente sin nombre (`nombre = null`) → usa fallback `"paciente"` (no lanza)
- `POST plantilla` sin consultas previas → usa fallback `"su consulta"`

**Commit:** `backend(api): POST mensajes plantilla para ventana expirada`

---

## BLOQUE 7 — Auth endpoints
> Los endpoints de login/logout/reset. Requieren T-09 (lib/auth.ts) y T-05 (rate-limit).

---

### T-32 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/auth/login` con rate-limit por IP, bcrypt y cookie de sesión.

**Archivos a tocar:**
- `app/api/auth/login/route.ts`
  - Rate-limit 5/15min por IP → 429 si excede
  - Zod: `{ email: z.string().email(), password: z.string().min(1) }`
  - Busca `UsuarioAdmin` por email; si no existe → `verifyPassword` contra hash ficticio (timing-safe, no revela existencia)
  - `verifyPassword(password, hash)` → si false → 401 genérico
  - Si OK → `createSessionResponse(userId)` → set-cookie sesión 12h → 200

**Dependencias:** T-05, T-09, T-04

**Criterio testeable:**
- Credenciales correctas → 200 + `Set-Cookie` con flags `HttpOnly; Secure; SameSite=Lax`
- Credenciales incorrectas → 401, **mismo mensaje** que si el email no existe
- 6to intento en 15min desde misma IP → 429
- Body sin email → 400 zod

**Commit:** `backend(auth): POST login rate-limit bcrypt cookie 12h`

---

### T-33 `[backend]`
**Objetivo:** `POST /api/auth/logout` — invalida la cookie de sesión.

**Archivos a tocar:**
- `app/api/auth/logout/route.ts`
  - Llama `clearSessionResponse` → `Set-Cookie` con `Max-Age=0`
  - Responde 200

**Dependencias:** T-09, T-10

**Criterio testeable:**
- `POST /api/auth/logout` con cookie válida → 200 + `Set-Cookie: ...; Max-Age=0`
- `POST /api/auth/logout` sin cookie → 401 (middleware lo bloquea)

**Commit:** `backend(auth): POST logout invalida cookie`

---

### T-34 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/auth/forgot` — genera token sha256, lo guarda y envía email de reset.

**Archivos a tocar:**
- `app/api/auth/forgot/route.ts`
  - Rate-limit 3/hora por email → 429 si excede
  - Zod: `{ email: z.string().email() }`
  - Si email existe en `UsuarioAdmin`:
    - `token = crypto.randomBytes(32).toString("hex")` (plano, para la URL)
    - `tokenHash = sha256(token)` (guardado en DB)
    - `UsuarioAdmin.update({ reset_token: tokenHash, reset_token_at: now() })`
    - `sendResetEmail(email, ${BASE_URL}/reset?token=${token})`
  - Responde 200 **siempre** (no revela si email existe)

**Dependencias:** T-08, T-05, T-04

**Criterio testeable:**
- `POST /forgot` con email existente → 200 + email enviado (verificar SMTP log)
- `POST /forgot` con email inexistente → 200 igual (indistinguible)
- `reset_token` en DB es `sha256(token)`, no el plano
- 4to intento mismo email en 1h → 429

**Commit:** `backend(auth): POST forgot token sha256 y email reset`

---

### T-35 `[backend]` `[RIESGO]`
**Objetivo:** `POST /api/auth/reset` — valida token, cambia contraseña, invalida token (un solo uso).

**Archivos a tocar:**
- `app/api/auth/reset/route.ts`
  - Zod: `{ token: z.string().min(1), password: z.string().min(8) }`
  - `tokenHash = sha256(token)` → busca `UsuarioAdmin` por `reset_token = tokenHash`
  - Si no existe → 400 `"Token inválido"`
  - Si `reset_token_at < now() - 1h` → 400 `"Token expirado"` + limpia token en DB
  - `hashPassword(password)` → `bcrypt.hash(password, 12)`
  - Actualiza: `password_hash`, limpia `reset_token = null`, `reset_token_at = null`
  - Responde 200

**Dependencias:** T-34, T-09

**Criterio testeable:**
- Token válido y vigente → 200, password cambiado en DB, `reset_token = null`
- Token expirado (> 1h) → 400 "Token expirado", `reset_token` limpiado en DB
- Token ya usado → 400 "Token inválido" (ya no existe en DB)
- `password` < 8 chars → 400 zod
- Mismo token usado dos veces → segunda vez retorna 400

**Commit:** `backend(auth): POST reset valida token 1h un solo uso`

---

## BLOQUE 8 — Frontend
> Requiere: T-10 (middleware), T-32 (login API), T-22–T-31 (panel APIs), T-33 (logout).

---

### T-36 `[frontend]`
**Objetivo:** Página `/privacidad` — aviso estático sin autenticación.

**Archivos a tocar:**
- `app/privacidad/page.tsx`
  - Texto aviso de privacidad con derechos ARCO (acceso, rectificación, cancelación, oposición)
  - Nombre de la doctora (desde `DOCTOR_NAME` env o hardcodeado) y datos de contacto para ejercer derechos
  - Sin login requerido, sin links externos, sin datos de pacientes

**Dependencias:** T-01

**Criterio testeable:**
- `GET /privacidad` sin cookie → 200 (no redirige a login)
- El bot puede incluir `${NEXT_PUBLIC_BASE_URL}/privacidad` en el mensaje de consentimiento
- Página menciona "Derechos ARCO", nombre de la doctora y medio de contacto

**Commit:** `frontend: página aviso de privacidad estático`

---

### T-37 `[frontend]`
**Objetivo:** Página `/login` — formulario con toggle ver/ocultar contraseña.

**Archivos a tocar:**
- `app/login/page.tsx`
  - `<form>` con `email` (type=email) + `password` (toggle entre `type=password` y `type=text` con ícono ojo)
  - Submit → `POST /api/auth/login`
  - 200 → `router.push("/panel")`
  - 401 → muestra `"Credenciales incorrectas"` (mensaje genérico, no revela si email existe)
  - 429 → muestra `"Demasiados intentos. Espera 15 minutos."`
  - Sin JS → `<noscript>` advisory (no se requiere JS puro pero el toggle sí lo necesita)

**Dependencias:** T-32

**Criterio testeable:**
- Login correcto → redirige a `/panel`
- Login incorrecto → mensaje de error, no se revela si email existe
- Toggle ojo → `input.type` alterna entre `password` y `text`
- Campo email con formato inválido → error de validación HTML nativo antes de submit

**Commit:** `frontend: página login con toggle contraseña`

---

### T-38 `[frontend]`
**Objetivo:** Página `/reset` — formulario de nueva contraseña con token en query param.

**Archivos a tocar:**
- `app/reset/page.tsx`
  - Lee `?token=` de `useSearchParams()`
  - Si no hay token → muestra `"Link inválido, solicita uno nuevo"`
  - `<form>` con `password` (min 8 chars) + `password_confirm`
  - Valida `password === password_confirm` en cliente antes de submit
  - Submit → `POST /api/auth/reset { token, password }`
  - 200 → `"Contraseña actualizada"` + link a `/login`
  - 400 → muestra mensaje de error del servidor

**Dependencias:** T-35

**Criterio testeable:**
- Token válido en URL + nueva contraseña ≥ 8 chars → 200, redirige a `/login`
- Token expirado → muestra "Token expirado"
- `password` ≠ `password_confirm` → error en UI, no hace fetch
- `?token=` ausente → muestra "Link inválido"

**Commit:** `frontend: página reset contraseña con token`

---

### T-39 `[frontend]`
**Objetivo:** Layout del panel — verifica sesión server-side y ofrece logout.

**Archivos a tocar:**
- `app/panel/layout.tsx` (Server Component)
  - `getSession(req)` en server → si null → `redirect("/login")`
  - Header: nombre de la app + nav `Pacientes | Contenido` + botón `"Cerrar sesión"`
  - Botón logout → `<form action="/api/auth/logout" method="POST">` (funciona sin JS)

**Dependencias:** T-09, T-33

**Criterio testeable:**
- `GET /panel` sin cookie → 302 a `/login`
- `GET /panel` con cookie válida → 200 con header y navegación
- Click en `"Cerrar sesión"` → POST logout → redirige a `/login`
- Layout aparece en todas las rutas `/panel/*` sin repetir código

**Commit:** `frontend(panel): layout verificación sesión y logout`

---

### T-40 `[frontend]`
**Objetivo:** Página `/panel` — lista de pacientes con semáforo 24h y polling cada 60s.

**Archivos a tocar:**
- `app/panel/page.tsx`
  - `useEffect` con `setInterval(fetch, 60_000)` → `GET /api/pacientes` + cleanup en unmount
  - Tabla: nombre, teléfono, estado, semáforo (punto coloreado), tiempo restante (`Xh Ym`), última consulta (motivo truncado)
  - Clases CSS por semáforo:
    - `verde` → punto `bg-green-500`, sin animación
    - `amarillo` → punto `bg-yellow-400 animate-pulse`
    - `rojo` → fila `bg-red-50`, punto `bg-red-500 animate-pulse`, sube al tope (sort)
    - `expirado` → fila `bg-gray-100`, punto `bg-gray-400`, al tope con rojos
  - Sort: `expirado` → `rojo` → `amarillo` → `verde` (por `horasRestantes ASC`)
  - Click en fila → `router.push("/panel/<phone>")`
  - Sin pacientes → `"Sin pacientes registrados aún"`

**Dependencias:** T-22, T-39

**Criterio testeable:**
- Lista se carga al montar, sin estado vacío visible
- En Network DevTools: nueva request a `/api/pacientes` cada ~60s
- Paciente expirado aparece primero, fila gris
- Paciente rojo tiene `animate-pulse` y aparece antes que amarillo
- Sin pacientes → mensaje placeholder visible

**Commit:** `frontend(panel): lista pacientes semáforo 24h y poll 60s`

---

### T-41 `[frontend]`
**Objetivo:** Página `/panel/[phone]` — datos del paciente, ventana y lista de consultas.

**Archivos a tocar:**
- `app/panel/[phone]/page.tsx` (parte 1: visualización)
  - Fetch `GET /api/pacientes/<phone>` al montar
  - Sección info: nombre, teléfono, tipo contacto, doctor referidor (si tiene), consentimiento (fecha)
  - Sección ventana: `"Último mensaje: [fecha]. Cierra: [fecha] ([Xh Ym])."`
  - Lista consultas: fecha + `motivo_reportado` + `diagnostico_doctora` (si tiene)

**Dependencias:** T-23, T-39

**Criterio testeable:**
- `GET /panel/<phone_existente>` → 200, muestra nombre y ventana
- `GET /panel/<phone_inexistente>` → redirige a `/panel` o muestra 404
- Ventana expirada → texto "Ventana cerrada" visible en la sección ventana
- Consultas ordenadas más reciente primero

**Commit:** `frontend(panel): detalle paciente datos y lista consultas`

---

### T-42 `[frontend]` `[RIESGO]`
**Objetivo:** Acciones del paciente — responder, plantilla, diagnóstico, archivar, ARCO.

**Archivos a tocar:**
- `app/panel/[phone]/page.tsx` (parte 2: acciones)
  - Botón `[Responder libre]` → textarea + submit `POST /api/mensajes/<phone>/libre`; **`disabled`** si `ventana.expirada`
  - Botón `[Enviar plantilla]` → submit `POST /api/mensajes/<phone>/plantilla`; **siempre activo** si `ventana.expirada`
  - Por cada consulta: textarea `diagnostico_doctora` + botón `[Guardar diagnóstico]` → `PATCH /api/consultas/<id>`; actualiza sin recargar página
  - Botón `[Archivar]` → `PATCH /api/pacientes/<phone> { estado: "archivado" }` → feedback en UI
  - Botón `[Eliminar paciente (ARCO)]` → modal de confirmación → `DELETE /api/pacientes/<phone>` → redirige a `/panel`

**Dependencias:** T-30, T-31, T-24, T-25, T-26, T-41

**Criterio testeable:**
- `ventana.expirada = true` → `[Responder libre]` tiene atributo `disabled`
- `ventana.expirada = true` → `[Enviar plantilla]` está habilitado
- `[Guardar diagnóstico]` actualiza sin recargar la página entera
- `[Eliminar (ARCO)]` muestra modal antes de DELETE
- Después de DELETE → redirige a `/panel`

**Commit:** `frontend(panel): acciones detalle paciente libre plantilla ARCO`

---

### T-43 `[frontend]`
**Objetivo:** Página `/panel/contenido` — editar servicios (sección 1 de 2).

**Archivos a tocar:**
- `app/panel/contenido/page.tsx` (parcial: sección servicios)
  - Fetch `GET /api/admin/servicios` al montar
  - Por cada servicio: `nombre` (readonly), textarea `descripcion_corta` (max 300 chars, counter visible), input `precio_desde` (opcional), botón `[Guardar]` → `PATCH /api/admin/servicios/<slug>`
  - Validación client: `descripcion_corta > 300` → error antes de submit
  - Feedback: "Guardado" o error en línea por servicio (no toast global)

**Dependencias:** T-27, T-39

**Criterio testeable:**
- `GET /panel/contenido` → muestra 5 servicios con sus datos actuales
- Editar `descripcion_corta` + Guardar → DB actualizada, campo muestra nuevo valor
- 301 chars en textarea → error visible, botón no hace fetch
- Counter de chars visible: `ej. 45/300`

**Commit:** `frontend(panel): contenido sección editar servicios`

---

### T-44 `[frontend]`
**Objetivo:** Página `/panel/contenido` — consultorio info y gestión de doctores QR (sección 2 de 2).

**Archivos a tocar:**
- `app/panel/contenido/page.tsx` (completar con secciones consultorio y doctores)
  - Sección Consultorio: inputs `direccion_texto`, `maps_url`, `horarios_texto` + botón `[Guardar]` → `PATCH /api/admin/consultorio`
  - Sección Doctores Referidores:
    - Lista doctores con `nombre` + `codigo_qr` + link copyable `wa.me/<BOT_WHATSAPP_NUMBER>?text=REF_<codigo_qr>` (Perú: `51` + 9 dígitos; prohibido `521`) [ACLARAR]
    - **[ACLARAR]** spec §11 dice "QR imprimible" pero ninguna librería QR está en el plan ni en `package.json`. ¿Generar imagen QR con `npm qrcode`? ¿O solo mostrar el link wa.me copyable es suficiente para MVP? Sin respuesta → solo link copyable, sin imagen QR.
    - `[Nuevo doctor]` → input nombre → `POST /api/admin/doctores` → muestra `codigo_qr` generado
    - `[Eliminar]` por doctor → `DELETE /api/admin/doctores/<id>` + confirmación

**Dependencias:** T-28, T-29, T-43

**Criterio testeable:**
- Editar `maps_url` + Guardar → DB actualizada; bot usa nuevo valor en siguiente mensaje de dirección
- Nuevo doctor → muestra `codigo_qr` + link wa.me copyable inmediatamente
- `[Eliminar]` doctor → pide confirmación, luego desaparece de la lista
- `maps_url` inválida (no URL) → error en UI antes de submit

**Commit:** `frontend(panel): contenido consultorio info y doctores QR`

---

### T-44b `[frontend]`
**Objetivo:** Pase único de estilo Bootstrap sobre TODAS las rutas (solo cuando T-36–T-44 existan; no adelantar — ver decisión registrada).

**Archivos a tocar:**
- `package.json` → `npm i bootstrap` (solo CSS; prohibido `react-bootstrap` y bundle JS)
- Layout raíz → importar `bootstrap/dist/css/bootstrap.min.css`
- `app/globals.css` (nuevo, mínimo) → solo keyframes pulse del semáforo (mapear a `bg-success/warning/danger/secondary`)
- Todas las rutas (privacidad, login, reset, panel lista/detalle/contenido): clases `table, btn, badge, form-control, alert`; modal ARCO con markup Bootstrap + state React (sin JS de Bootstrap)
- Prohibido tocar lógica de componentes; solo clases + CSS

**Dependencias:** T-44 (todas las secciones concebidas)

**Criterio testeable:**
- `npm run dev` + revisión visual ruta por ruta: lista legible, semáforo con pulse, botones/estados claros, formularios y modal ARCO presentables
- `npm run build` verde (el CSS no rompe el build)
- Sin `react-bootstrap` en `package.json`, sin imports de JS de Bootstrap

**Commit:** `frontend: pase Bootstrap solo-CSS en todas las rutas`

---

### T-44c `[frontend]` (bloqueante go-live: sin número en el QR no hay captación ni atribución)
**Objetivo:** Números Perú + QR con número del bot.

**Archivos a tocar:**
- `.env.example` → añadir `BOT_WHATSAPP_NUMBER=""` (Perú: `51` + 9 dígitos, móviles empiezan con 9, ej. `51987654321`). Actualizar conteos T-01/plan §7.1 a 15 keys.
- `app/api/admin/consultorio/route.ts` (GET) → incluir `whatsapp_number` leído del env (solo lectura). Validar formato `/^51\d{8,9}$/`; forma esperada móviles `519XXXXXXXX`.
- `app/panel/contenido/page.tsx` (~225, ~407) → links `https://wa.me/${numero}?text=${encodeURIComponent("REF_" + codigo)}`.
- Prohibido hardcodear `521` o asumir México en links, ejemplos o validaciones. Los `wa_id` de Meta se pasan tal cual (ya vienen normalizados).

**Dependencias:** T-44, T-28

**Criterio testeable:**
- `.env.example` trae 15 keys con `BOT_WHATSAPP_NUMBER` vacía
- GET consultorio incluye `whatsapp_number` del env
- QR renderiza `wa.me/51…?text=REF_…` exacto (con número, nunca `wa.me/?text=` solo)
- Verificación manual documentada: escaneo abre chat con el bot + texto REF precargado (hacer antes de imprimir tiraje)

**Commit:** `fix(qr): links Perú con número del bot + env`

---

## BLOQUE 9 — Deploy
> Requiere todos los bloques anteriores completos y E2E verificado.

---

### T-45 `[infra]` `[RIESGO]`
**Objetivo:** Preparar `package.json` para producción en Railway y documentar checklist de deploy.

**Archivos a tocar:**
- `package.json` → verificar/añadir:
  - `"postinstall": "prisma generate"`
  - `"start": "next start"`
  - `"build": "next build"`
- `docs/deploy.md` → checklist con pasos exactos del plan §7.2 (15 pasos)

**Dependencias:** T-21 (bot completo), T-35 (auth completo), T-44 (frontend completo)

**Criterio testeable:**
- `npm run build` termina sin errores en local con `.env` completo
- `package.json` tiene los 3 scripts de producción

**Commit:** `infra: package.json producción y checklist deploy`

---

### T-46 `[infra]` `[RIESGO]`
**Objetivo:** Deploy inicial en Railway — variables de entorno, migraciones y seed en producción.

**Archivos a tocar:**
- No crea archivos de código. Acciones en Railway dashboard:
  1. Crear proyecto Railway → "Deploy from GitHub repo" (rama `main`)
  2. Crear plugin Postgres en Railway (o conectar Neon)
  3. Pegar todas las variables de `.env.example` con valores reales en Railway Variables
  4. Esperar primer deploy exitoso → obtener URL pública
  5. `railway run npx prisma migrate deploy`
  6. `railway run npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts`

**Dependencias:** T-45

**Criterio testeable:**
- URL pública responde `200` en `GET /`
- `GET /privacidad` accesible sin login desde URL pública
- Panel accesible con `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` del seed
- `npx prisma studio --schema=prisma/schema.prisma` conectado a DB prod muestra las 7 tablas
- Plan B bcrypt: si el build en Railway falla compilando `bcrypt` nativo (T-03 lo usa en vez de `bcryptjs`), volver a `bcryptjs` — el criterio de hash `$2b$12$` se mantiene igual
- Higiene de logs (ver observación T-18): revisar logs de prod y confirmar que ningún `console.error`/catch persiste `motivo_reportado` ni cuerpos SMTP con datos de salud

**Commit:** `infra: deploy Railway migraciones y seed producción`

---

### T-47 `[infra]` `[RIESGO]`
**Objetivo:** Configurar webhook en Meta Developers y registrar plantilla de reactivación.

**Archivos a tocar:**
- No crea archivos de código. Acciones en Meta Developers:
  1. En Meta Developers → App → WhatsApp → Configuración → Webhook:
     - Callback URL: `https://<url-railway>/api/whatsapp`
     - Verify Token: valor exacto de `VERIFY_TOKEN`
  2. Suscribir a: `messages`, `message_deliveries`, `message_reads`
  3. Meta hace `GET /api/whatsapp?hub.mode=subscribe&hub.verify_token=...` → debe retornar challenge
   4. Registrar plantilla en Meta Business Manager:
      - Nombre: `reactivacion_consulta` (o similar)
      - Cuerpo: `"Hola {{1}}, soy la Dra. [DOCTOR_NAME], retomo su consulta sobre {{2}}. ¿Continuamos con su cita?"`
      - Código de idioma exactamente `es` — debe coincidir letra por letra con `language: { code: "es" }` de `lib/whatsapp.ts` (T-07); si se aprueba como `es_MX`, actualizar el código antes del go-live
      - Esperar aprobación (24–72h) — **BLOQUEANTE para go-live**

**Dependencias:** T-46

**Criterio testeable:**
- Meta muestra webhook como `"Connected"` (punto verde)
- Enviar mensaje de prueba desde Meta → bot responde con BIENVENIDA
- Plantilla aparece como `"Aprobada"` en Meta Business Manager (puede tardar 72h)

**Commit:** `infra: webhook Meta configurado y plantilla registrada`

---

### T-48 `[infra]`
**Objetivo:** Test E2E completo con número de prueba de Meta antes del go-live.

**Archivos a tocar:**
- `docs/test-e2e.md` → resultado de cada punto del checklist (no va a producción)

**Checklist (los 8 criterios de aceptación de spec §7):**
1. Nuevo paciente → flujo completo BIENVENIDA → CONSENTIMIENTO → NOMBRE → MOTIVO → CIERRE
2. Mismo número segunda vez → RECURRENTE, sin pedir consentimiento, nueva `Consulta` en DB
3. Paciente escribe NO → RECHAZADO; luego ACEPTAR → retoma desde NOMBRE
4. QR de doctor distinto atribuye `doctor_referidor_id` correctamente en DB
5. Panel muestra semáforo correcto según `last_patient_msg_at`
6. Doctora responde libre desde panel → mensaje llega al WhatsApp de prueba
7. Ventana expirada → `[Responder libre]` disabled, `[Enviar plantilla]` funciona
8. `DELETE` ARCO → bot trata al `wa_id` como nuevo en siguiente contacto
9. Middleware T-10 (re-prueba diferida): sin cookie, `GET /panel` → redirect a `/login` (Next usa 307, no 302) y `GET /api/pacientes` → 401 con `app/` ya existente

**Dependencias:** T-47, T-42, T-40

**Criterio testeable:** los 9 puntos del checklist pasan sin error y quedan documentados en `docs/test-e2e.md`

**Commit:** `test: checklist E2E con número de prueba Meta`

---

### T-49 `[infra]`
**Objetivo:** Entrega a la doctora — guía de primer uso y cambio de contraseña temporal.

**Archivos a tocar:**
- `docs/guia-doctora.md` (entregar por separado, no al repo si tiene datos reales)
  - URL del panel
  - Cómo hacer primer login y cambiar contraseña
  - Cómo ver y responder a pacientes desde el panel
  - Cómo agregar doctor referidor y compartir link QR
  - Cómo editar servicios, horarios y dirección
  - Qué hace el bot (nunca diagnostica, nunca agenda, confirma la Dra. por WhatsApp)
  - Qué hacer si una paciente quiere borrar sus datos (ARCO)
  - QR: prohibido imprimir tiraje sin escaneo físico verificado con teléfono real (chat abre + REF precargado; evidencia en T-44c)

**Dependencias:** T-48

**Criterio testeable:**
- Doctora entra al panel desde **su** dispositivo (no la laptop de desarrollo)
- Doctora cambia contraseña temporal exitosamente en primer login
- Plantilla Meta está aprobada antes de este paso (R4 del plan)
- Un QR de prueba escaneado con teléfono real abre el chat + REF precargado antes de autorizar cualquier tiraje

**Commit:** `infra: guia entrega a doctora`

---

## Resumen de cambios respecto a tasks.md v1

| Problema original | Corrección |
|-------------------|------------|
| T-13: `forgot` + `reset` en 1 commit | → T-34 (forgot) + T-35 (reset) separados |
| T-14: GET verify + POST HMAC en 1 commit | → T-11 (GET) + T-12 (POST) separados |
| T-16: 7 handlers en 1 commit (el más grave) | → T-14 a T-20 (1 handler por commit) |
| T-20: 3 grupos admin en 1 commit | → T-27 (servicios) + T-28 (consultorio) + T-29 (doctores) |
| T-21: libre + plantilla en 1 commit | → T-30 (libre) + T-31 (plantilla) separados |
| T-27: datos + 5 acciones en 1 commit | → T-41 (visualización) + T-42 (acciones) |
| T-28: 3 secciones frontend en 1 commit | → T-43 (servicios) + T-44 (consultorio+doctores) |
| T-29: processWebhook en BLOQUE 6 (tarde) | → T-21 en BLOQUE 5, justo después del bot |
| T-31: deploy + webhook Meta + seed en 1 commit | → T-46 (deploy) + T-47 (webhook+plantilla) separados |
| Orden: auth antes que webhook/bot | → Reordenado: DB → webhook → bot → panel → auth → frontend → deploy |
| Sin [ACLARAR] en tasks | → [ACLARAR] en T-18 (horario) y T-44 (QR imprimible) |

---

## Diagrama de dependencias

```
T-01 (repo)
  └─► T-02 (schema) ─► T-03 (seed)
        └─► T-04 (prisma singleton)
              ├─► T-05 (ratelimit) ─────────────────────────────────┐
              ├─► T-06 (ventana) ──────────────────────────────────┐│
              ├─► T-07 (whatsapp helper) ──────────────────────────┐││
              ├─► T-08 (smtp helper) ──────────────────────────────┐│││
              ├─► T-09 (auth lib) ─► T-10 (middleware) ──────────┐ ││││
              │                                                    │ ││││
              ├─► T-11 (webhook GET) ──────────────────────────── │─┘│││
              └─► T-12 (webhook POST) ◄──── T-05, T-04 ───────── │──┘││
                    │                                              │   ││
              T-13 (messages/keywords)                            │   ││
              T-14 (handleBienvenida) ─────────────────────────── │───┘│
              T-15 (handleConsentimiento) ◄─── T-14 ─────────────┤    │
              T-16 (handleRechazado) ◄──────── T-15 ─────────────┤    │
              T-17 (handleNombre) ◄─────────── T-15 ─────────────┤    │
              T-18 (handleMotivo) ◄──── T-17, T-08 ──────────────┤    │
              T-19 (handleCierre) ◄──── T-13, T-17, T-04 ────────┤    │
              T-20 (handleRecurrente) ◄─ T-19, T-04, T-08 ───────┤    │
              T-21 (processWebhook) ◄── T-12, T-20, T-07 ────────┘    │
                                                                        │
              T-22–T-31 (APIs panel) ◄──── T-10 (middleware) ──────────┘
              T-32–T-35 (auth endpoints) ◄── T-09, T-05, T-08
              T-36–T-44 (frontend) ◄──── T-22–T-35
              T-45–T-49 (deploy) ◄──── T-21, T-35, T-44
```

---

## Índice rápido (49 tareas)

| ID | Layer | Commit |
|----|-------|--------|
| T-01 | infra | `infra: repo inicial Next.js 14 con .gitignore y .env.example` |
| T-02 | db | `db: schema Prisma 7 modelos, 3 enums y migración init` |
| T-03 | db | `db: seed admin, 5 servicios y consultorio_info` |
| T-04 | backend | `backend: singleton PrismaClient` |
| T-05 | backend | `backend: rate-limiter en memoria por clave` |
| T-06 | backend | `backend: calcularVentana 24h sin job ni columna extra` |
| T-07 | backend | `backend: helper envío mensajes Meta Cloud API` |
| T-08 | backend | `backend: helper SMTP Gmail reset y alertas` |
| T-09 | backend | `backend(auth): helper sesión iron-session y bcrypt cost 12` |
| T-10 | backend | `backend: middleware auth protege panel y api` |
| T-11 | backend | `backend(webhook): GET verify token Meta` |
| T-12 | backend | `backend(webhook): POST HMAC-SHA256 timing-safe + ack inmediato` |
| T-13 | backend | `backend(bot): mensajes constantes y matching palabras clave` |
| T-14 | backend | `backend(bot): handleMessage dispatcher y handleBienvenida` |
| T-15 | backend | `backend(bot): handleConsentimiento bifurca aceptado/rechazado` |
| T-16 | backend | `backend(bot): handleRechazado con lógica ARCO` |
| T-17 | backend | `backend(bot): handleNombre captura y persiste nombre` |
| T-18 | backend | `backend(bot): handleMotivo crea Consulta y envía alerta SMTP` |
| T-19 | backend | `backend(bot): handleCierre info bajo demanda y avance a RECURRENTE` |
| T-20 | backend | `backend(bot): handleRecurrente sin duplicar paciente` |
| T-21 | backend | `backend(bot): processWebhook conecta webhook con máquina de estados` |
| T-22 | backend | `backend(api): GET /api/pacientes lista paginada con ventana` |
| T-23 | backend | `backend(api): GET /api/pacientes/[phone] detalle con consultas y ventana` |
| T-24 | backend | `backend(api): PATCH /api/pacientes/[phone] estado y nombre` |
| T-25 | backend | `backend(api): DELETE ARCO borrado total sin bloqueo` |
| T-26 | backend | `backend(api): consultas GET lista y PATCH diagnostico doctora` |
| T-27 | backend | `backend(api): admin GET y PATCH servicios` |
| T-28 | backend | `backend(api): admin GET y PATCH consultorio_info` |
| T-29 | backend | `backend(api): admin doctores GET, POST genera QR, DELETE` |
| T-30 | backend | `backend(api): POST mensajes libre con validación ventana activa` |
| T-31 | backend | `backend(api): POST mensajes plantilla para ventana expirada` |
| T-32 | backend | `backend(auth): POST login rate-limit bcrypt cookie 12h` |
| T-33 | backend | `backend(auth): POST logout invalida cookie` |
| T-34 | backend | `backend(auth): POST forgot token sha256 y email reset` |
| T-35 | backend | `backend(auth): POST reset valida token 1h un solo uso` |
| T-36 | frontend | `frontend: página aviso de privacidad estático` |
| T-37 | frontend | `frontend: página login con toggle contraseña` |
| T-38 | frontend | `frontend: página reset contraseña con token` |
| T-39 | frontend | `frontend(panel): layout verificación sesión y logout` |
| T-40 | frontend | `frontend(panel): lista pacientes semáforo 24h y poll 60s` |
| T-41 | frontend | `frontend(panel): detalle paciente datos y lista consultas` |
| T-42 | frontend | `frontend(panel): acciones detalle paciente libre plantilla ARCO` |
| T-43 | frontend | `frontend(panel): contenido sección editar servicios` |
| T-44 | frontend | `frontend(panel): contenido consultorio info y doctores QR` |
| T-45 | infra | `infra: package.json producción y checklist deploy` |
| T-46 | infra | `infra: deploy Railway migraciones y seed producción` |
| T-47 | infra | `infra: webhook Meta configurado y plantilla registrada` |
| T-48 | infra | `test: checklist E2E con número de prueba Meta` |
| T-49 | infra | `infra: guia entrega a doctora` |
