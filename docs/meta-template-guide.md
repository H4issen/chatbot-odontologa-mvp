# Guía de registro de plantilla Meta — T-47a

> **Fecha de creación:** 2026-09-21 09:40 (PE)
> **Estado:** Pendiente de ejecución manual en Meta Business Manager

## Contexto

Esta plantilla se usa en `lib/whatsapp.ts` (línea 59-60) para reactivar conversaciones expiradas desde el panel. El código espera:
- Nombre: `reactivacion_consulta`
- Idioma: `es` (español)
- Parámetros: `{{1}}` = nombre del paciente, `{{2}}` = motivo de consulta

## Pasos para registrar en Meta Business Manager

### 1. Acceder a Meta Business Manager
- Ir a https://business.facebook.com/
- Seleccionar la cuenta de negocio asociada al número virtual de WhatsApp

### 2. Navegar a plantillas
- Menú lateral → **WhatsApp Manager** → **Message Templates**
- Clic en **Create Template**

### 3. Configurar plantilla
- **Name:** `reactivacion_consulta`
- **Language:** `es` (español) — **CRÍTICO:** debe ser exactamente `es`, no `es_MX` ni otro código
- **Category:** **Utility** (no Marketing)

### 4. Cuerpo del mensaje
Copiar y pegar exactamente:

```
Hola {{1}}, soy la Dra. [DOCTOR_NAME], retomo su consulta sobre {{2}}. ¿Continuamos con su cita?
```

**Nota:** Reemplazar `[DOCTOR_NAME]` con el nombre real de la doctora (ej: "Paola García") antes de enviar a revisión.

### 5. Parámetros
Meta detectará automáticamente `{{1}}` y `{{2}}` como variables de texto. Verificar:
- `{{1}}` → tipo: **text** (nombre del paciente)
- `{{2}}` → tipo: **text** (motivo de consulta)

### 6. Enviar a revisión
- Clic en **Submit**
- Meta mostrará estado: **In Review** (En revisión)
- Anotar fecha/hora de envío: **2026-09-21 09:40 PE** (referencia)

## Criterios de aceptación

- [ ] Plantilla creada con nombre `reactivacion_consulta`
- [ ] Idioma configurado como `es` (no `es_MX`)
- [ ] Cuerpo coincide exactamente con el texto de arriba
- [ ] Estado: **In Review** o **Approved**
- [ ] Captura de pantalla guardada en `docs/meta-template-screenshot.png` (pendiente)

## Gate de dependencias

- **T-48 (E2E test):** requiere plantilla **Approved** (puede tardar 24-72h)
- **T-49 (guía doctora):** requiere plantilla **Approved**
- **T-47b (webhook Meta):** NO depende de esta plantilla

## Verificación de código

El código en `lib/whatsapp.ts` ya está listo:
```typescript
template: {
  name: "reactivacion_consulta",
  language: { code: "es" },
  components: [
    {
      type: "body",
      parameters: [
        { type: "text", text: nombre },
        { type: "text", text: motivo },
      ],
    },
  ],
}
```

## Próximos pasos

1. Ejecutar esta guía manualmente en Meta Business Manager
2. Esperar aprobación (24-72h)
3. Guardar captura de pantalla en `docs/meta-template-screenshot.png`
4. Actualizar este documento con fecha/hora real de envío y estado final
5. Proceder con T-48 (E2E) cuando la plantilla esté **Approved**
