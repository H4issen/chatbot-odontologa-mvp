# Checklist de deploy — Chatbot Paola MVP (plan §7.2)

> Prerequisito: Meta número virtual + Business Manager verificado.
> Marcar cada paso al completarlo. No hay go-live sin los 15.

- [ ] 1. Crear repo GitHub privado. `.gitignore` con `.env*` desde commit 0.
- [ ] 2. Crear proyecto en Railway → "Deploy from GitHub repo".
- [ ] 3. Crear plugin Postgres en Railway (o conectar Neon externo).
- [ ] 4. En Railway dashboard → Variables: pegar todos los valores de `.env.example` (15 keys) con valores reales.
- [ ] 5. Verificar en `package.json`: `postinstall: prisma generate`, `start: next start`, `build: next build`.
- [ ] 6. Railway detecta Next.js y configura build automáticamente.
- [ ] 7. Primer deploy → esperar URL pública (ej. `chatbot-paola.up.railway.app`).
- [ ] 8. Correr migraciones: `railway run npx prisma migrate deploy`.
- [ ] 9. Correr seed (una vez): `railway run npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts`.
- [ ] 10. En Meta Developers → WhatsApp → Configuración: Webhook URL `https://<url>/api/whatsapp`, Verify Token (valor de `VERIFY_TOKEN`), suscribir a `messages`, `message_deliveries`, `message_reads`.
- [ ] 11. Registrar plantilla `reactivacion_consulta` en Meta Business Manager (72h antes de go-live — bloqueante).
- [ ] 12. Verificar `https://<url>/privacidad` muestra el aviso correcto.
- [ ] 13. Probar flujo completo con número de prueba de Meta (ver `docs/test-e2e.md` en T-48).
- [ ] 14. Entregar a doctora: URL + `ADMIN_EMAIL` + contraseña temporal.
- [ ] 15. Doctora cambia contraseña en primer login vía `/reset`.

> Nunca commitear `.env`. Nunca hardcodear secretos. Solo `.env.example` con valores vacíos va al repositorio.
