# Arranque obra — chatbot-odontologa-mvp

## Repo
- Nombre: `chatbot-odontologa-mvp` (privado)
- Archivos fuente: `spec.md` + `plan.md` + `tasks.md` + `AGENTS.md`

## Mapa por modelo
- **Spark free:** T-01, T-03, T-04, T-06, T-13, T-36, T-37, T-38, T-39, T-40, T-41, T-43, T-44, T-45, T-48, T-49
- **V4 Flash Latest:** T-05, T-07, T-08, T-10, T-22, T-23, T-26, T-27, T-28, T-29, T-32, T-33
- **Qwen3.7 Plus:** T-09, T-24, T-30, T-31
- **Sonnet 4.5:** T-02, T-11, T-12, T-14, T-15, T-16, T-17, T-18, T-19, T-20, T-21, T-25, T-34, T-35, T-42, T-46, T-47

## Contexto (recortado, no los 4 completos)
- Es **una vez por tarea**: adjunta solo `tasks T-XX + plan §Y + prompts-tareas.md (mapa)`. Ver detalle por T en `prompts-tareas.md`.
- Estado: `Retomamos desde T-YY (commit real, ej. 9001d60)`.

## Prompt T-01 (Spark, hecho)
> Eres ejecutor. Adjunto: tasks T-01 + plan §7 + AGENTS git.
> Tarea: SOLO T-01. Repo + GitHub privado `chatbot-odontologa-mvp`. 1 commit, no avances.
> Guardia: "Soy Spark, T-01 es mía. ¿Coincido?". Al terminar: diff + criterio + espera.

## Prompt T-XX (plantilla corta)
> Retomamos desde T-YY (commit real). Adjunto: tasks T-XX + plan §Y + prompts-tareas.md.
> Ejecuta SOLO T-XX de tu grupo. 1 commit, no avances.
> Guardia: confirma tu modelo contra el mapa del adjunto. Si no es tuya, detente.
> Al terminar: diff + criterio + espera "siguiente".

Grupos cortos para pegar (solo el tuyo):
- Spark: T-01,03,04,06,13,36-41,43-45,48,49
- V4 Flash: T-05,07,08,10,22,23,26-29,32,33
- Qwen Plus: T-09,24,30,31
- Sonnet: T-02,11,12,14-21,25,34,35,42,46,47

## Prompt T-02 (ejemplo Sonnet 4.5, recortado para agilizar)
> Retomamos desde T-01 (commit 9001d60). Adjunto: tasks T-02 + plan §1 + spec §3.
> Eres Sonnet 4.5. Ejecuta SOLO T-02: schema Prisma 7 modelos + 3 enums + migrate dev. 1 commit, no avances.
> Guardia: "Soy Sonnet 4.5, T-02 es mía (grupo Sonnet: T-02,11,12,14-21,25,34,35,42,46,47). ¿Coincido?". Si no, detente.
> Al terminar: diff + criterio (7 tablas en studio, sin payload en Log) + espera "siguiente".

## Alternativas si Sonnet 4.5 se agota (mismo rigor, menor costo)
Orden de fallback para cualquier T de arriba:
1. Qwen3.7 Max (OpenRouter / Go) — mejor reemplazo razonamiento pesado multi-archivo
2. DeepSeek V4 Pro (Go/ClinePass) — planificación + refactors grandes
3. Kimi K3 (Go/ClinePass) — secuencias largas agénticas, E2E T-46/47
4. Muse Spark 1.2/1.3 (Go, 45k req) — riesgo medio con alto límite

Regla fallback: pide `audita en modo crítico y marca [RIESGO]/[ACLARAR]` y no despliegues a prod sin una revisión Sonnet o Qwen Max posterior en T-12, T-21, T-25, T-35, T-42.

Con Go para seguir:
- Bulk (T-03, T-04): Spark o DeepSeek V4 Flash (barato, rápido).
- Medio (T-05 en adelante): Qwen3.7 Plus.
- RIESGO próximos (T-11/T-12 webhook, T-14-21 bot): DeepSeek V4 Pro (mejor que Flash para multi-archivo y seguridad) o Qwen3.7 Max si necesitas razonamiento largo.
DeepSeek Flash = día a día, Pro = lo crítico.