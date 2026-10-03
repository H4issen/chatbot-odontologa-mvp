# Prompts recortados T-01 a T-49 — chatbot-odontologa-mvp

Regla: adjunta SOLO lo indicado por T. 1 tarea=1 commit. Prompt base siempre:
`Ejecuta SOLO T-XX. Guardia: confirma modelo, si no coincides detente y pide cambio. Al terminar diff + criterio + espera.`

## Spark free (bulk visual/simple)
- T-01: repo + GitHub privado chatbot-odontologa-mvp. Adj: tasks T-01 + plan §7 + AGENTS git
- T-03: seed admin + 5 servicios. Adj: tasks T-03 + plan §1
- T-04: singleton Prisma. Adj: tasks T-04 + plan §1
- T-06: calcularVentana. Adj: tasks T-06 + plan §5
- T-13: mensajes + keywords. Adj: tasks T-13 + plan §4 + spec §4
- T-36: /privacidad. Adj: tasks T-36 + plan §6
- T-37: /login toggle. Adj: tasks T-37 + plan §6
- T-38: /reset token. Adj: tasks T-38 + plan §6
- T-39: layout panel. Adj: tasks T-39 + plan §6
- T-40: lista semáforo 60s. Adj: tasks T-40 + plan §5
- T-41: detalle + consultas. Adj: tasks T-41 + plan §2,5
- T-43: contenido servicios. Adj: tasks T-43 + plan §2
- T-44: consultorio + QR. Adj: tasks T-44 + plan §2
- T-44b: pase Bootstrap solo-CSS en todas las rutas (solo tras T-44). Adj: tasks T-44b
- T-44c: QR Perú con número del bot + env (bloqueante go-live). Adj: tasks T-44c
- T-45: package prod. Adj: tasks T-45 + plan §7
- T-48: E2E doc 9 puntos. Adj: tasks T-48 + spec §7
- T-49: guía doctora. Adj: tasks T-49

## Qwen3.7 Plus (backend medio)
- T-05: ratelimit. Adj: tasks T-05 + plan §6
- T-07: helper Meta. Adj: tasks T-07 + plan §3
- T-08: helper SMTP. Adj: tasks T-08 + plan §6
- T-10: middleware. Adj: tasks T-10 + plan §6
- T-22: GET pacientes. Adj: tasks T-22 + plan §2
- T-23: GET detalle. Adj: tasks T-23 + plan §2
- T-26: consultas API. Adj: tasks T-26 + plan §2
- T-27: admin servicios. Adj: tasks T-27 + plan §2
- T-28: admin consultorio. Adj: tasks T-28 + plan §2
- T-29: admin doctores QR. Adj: tasks T-29 + plan §2
- T-29b: parseo QR en bot. Adj: tasks T-29b + plan §2
- T-32: login. Adj: tasks T-32 + plan §6
- T-33: logout. Adj: tasks T-33 + plan §6

## Qwen3.7 Plus (medio-difícil barato + ex-Sonnet rebajadas)
- T-09: sesión + bcrypt. Adj: tasks T-09 + plan §6
- T-11: webhook GET verify. Adj: tasks T-11 + plan §3
- T-14: dispatcher + bienvenida. Adj: tasks T-14 + plan §4
- T-15: consentimiento. Adj: tasks T-15 + plan §4
- T-17: nombre. Adj: tasks T-17 + plan §4
- T-19: cierre. Adj: tasks T-19 + plan §4
- T-21: processWebhook. Adj: tasks T-21 + plan §3-4
- T-24: PATCH paciente. Adj: tasks T-24 + plan §2
- T-25: DELETE ARCO. Adj: tasks T-25 + plan §2
- T-30: mensajes libre. Adj: tasks T-30 + plan §5
- T-31: mensajes plantilla. Adj: tasks T-31 + plan §5
- T-34: forgot sha256. Adj: tasks T-34 + plan §6

## Qwen3.7/3.8 Max — OBLIGATORIAS (8, RIESGO duro)
- T-12: webhook POST HMAC. Adj: tasks T-12 + plan §3
- T-16: rechazado ARCO. Adj: tasks T-16 + plan §4
- T-18: motivo + SMTP. Adj: tasks T-18 + plan §4
- T-20: recurrente. Adj: tasks T-20 + plan §4
- T-35: reset 1h. Adj: tasks T-35 + plan §6
- T-42: acciones ARCO. Adj: tasks T-42 + plan §2,5
- T-46: deploy Railway migraciones + seed prod. Adj: tasks T-46 (leer el bloque "Estado 2026-10-02" COMPLETO: incluye trampas de `.env`, chip y pagos) + plan §7
- T-47a: registrar plantilla Meta (manual guiado, YA en paralelo a T-46). Adj: tasks T-47a
- T-47b: webhook Meta con URL de T-46 (manual guiado). Adj: tasks T-47b

## Hechas (no tocar)
- T-02: schema Prisma (Sonnet 4.5, cerrada)

## T-50 post-MVP — doctores que escriben al bot (NO ejecutar en MVP)
Hueco: el bot solo atiende pacientes; un doctor referidor caería en flujo
de paciente. Decisión: fallback mínimo, la doctora reparte los QR en persona.
- Keywords: "soy doctor", "refiero", "mi código", "mi qr" → mensaje:
  "Con gusto. La Dra. le envía su código directamente por este medio."
  Fin del flujo, sin crear Paciente ni Consulta ni solicitud.
- NO opción 4 en menú (fricción al 95% de pacientes), NO derivar "empresa"
  como doctor (desajuste semántico + contamina segmento), NO auto-QR.
- Adj cuando toque: tasks T-50 (crear al planificar v2) + plan §4.

## Alternativas si Max se agota (mismo rigor, menor costo)
Orden de fallback para las 8 obligatorias:
1. Sonnet 4.5 free (Antigravity, por cuota) — mejor auditor
2. Kimi K3 (Go/ClinePass) — secuencias largas agénticas, E2E T-48
3. DeepSeek V4 Pro (Go/ClinePass) — solo si aceptas su opt-in China; evita en auth/datos
4. Muse Spark (Go, 45k req) — riesgo medio con alto límite

Regla fallback: pide `audita en modo crítico y marca [RIESGO]/[ACLARAR]` y no despliegues a prod sin una revisión Max/Sonnet posterior en T-12, T-35, T-42, T-46, T-47b.

## Excepción de mapa — T-46
`plan_legacy/asignar_tareas.md:11` asigna T-46 a Sonnet 4.5 (grupo legacy). El dueño la delegó a Qwen Max el 2026-10-02: encaja en el fallback de línea 42 y no cambia el rigor, porque escribe en la DB de producción. Para T-46 aplica el mismo criterio que las demás obligatorias: revisión Max/Sonnet antes de dar por cerrada.

## T-46 — notas de continuidad (leer antes de ejecutar)
- El bloque "Estado 2026-10-02" de `tasks.md` T-46 tiene el detalle completo. No repetir: el bump de `next`, el deploy, el registro del webhook y la suscripción de `messages` ya están hechos.
- Migraciones + seed son el ÚNICO bloqueo del bot (`stateMachine.ts:44-48` hace upsert antes de responder).
- Trampas documentadas ahí: `.env` con comentario en línea, chip desconectado por WABA sin verificar, widget de Meta solo outbound, y la regla de no configurar pagos en sandbox.
- **Actualizado 2026-10-03:** migraciones y seed YA ESTÁN aplicados (commit `3c21d82`). Los 7 criterios de T-46 pasaron, salvo el 1 que se corrigió con `a5ade5b` (raíz → redirect a `/login`). Leer el bloque "Diagnóstico 2026-10-03" de `tasks.md` antes de tocar nada.

## T-47b — estado real al 2026-10-03 (NO empezar de cero)
Todo lo siguiente YA ESTÁ HECHO y verificado. **No lo repitas:**
- Deploy Railway activo y sano: `Deployment successful`, `main` en `a5ade5b`.
- `GET /privacidad` → 200. `GET /` → redirige a `/login`.
- Webhook REGISTRADO y handshake verificado (`challenge` devolvió `test123`).
- Migraciones + seed aplicados en Neon prod. 7 tablas.
- Healthcheck Path corregido a `/privacidad` (el `/` + redirect mataba el contenedor con SIGTERM).

**ÚNICO BLOQUEO: la lista de Destinatarios en Meta se reinició.** En modo desarrollo Meta solo entrega inbound de números verificados ahí, así que el bot está mudo aunque todo lo demás esté sano. Cierra con los 4 pasos y el árbol de decisión por status del POST que están en `tasks.md` (sección T-47b).

Regla de método que salió de esta sesión, aplica a todo lo que siga: **para diagnosticar, consultar el servicio con un comando y mirar el deployment ACTIVO.** El título del deploy y los logs en HISTORY mienten; de ahí vinieron cuatro hipótesis fallidas seguidas.
