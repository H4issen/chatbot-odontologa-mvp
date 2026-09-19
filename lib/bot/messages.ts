// lib/bot/messages.ts — T-13
// Textos del bot (spec §4). El bot informa; no emite valoraciones clínicas ni precio cerrado.
// Los textos con [variable] se resuelven con buildMessage().

export const MENSAJE_BIENVENIDA =
  "Hola, buena tarde. Soy Denti, el asistente virtual de la Dra. [Nombre]. Le ayudo a registrar su información para que ella pueda atenderle mejor. ¿Cómo llegó con nosotros? Escriba el número: 1. Me recomendó un doctor 2. Soy paciente / conocido 3. Somos empresa / marca";

export const MENSAJE_REFERIDO_CODIGO =
  "Gracias. ¿Me indica el nombre o código de quien le refirió? Viene junto a su QR. Si no lo tiene, continuamos igual.";

export const MENSAJE_CONSENTIMIENTO =
  "Antes de anotar sus datos, le comparto el aviso de privacidad: [link]. Solo la Dra. atiende en consulta, no por chat. ¿Acepta que guardemos su nombre y motivo para agendarle? Escriba SÍ o NO";

export const MENSAJE_RECHAZADO =
  "Sin problema, lo respeto. No guardaré su información y no le volveré a escribir. Si cambia de opinión, escriba ACEPTAR.";

export const MENSAJE_SOLICITUD_NOMBRE =
  "Gracias. ¿Me indica su nombre completo, por favor?";

export const MENSAJE_SOLICITUD_MOTIVO =
  "Mucho gusto, [Nombre]. Cuénteme con sus palabras, ¿qué molestia presenta o qué le gustaría revisar? Puedo orientarle sobre nuestros servicios: corona, limpieza, blanqueamiento, brackets, implante.";

export const MENSAJE_MOTIVO_ANOTADO =
  "Entendido, ya lo anoté tal cual para que la Dra. lo revise.";

export const MENSAJE_CIERRE_HORARIO =
  "Listo, [Nombre]. Ya quedó registrado. La Dra. revisa su caso y le confirma su cita por aquí mismo. Dirección: [maps_url]";

export const MENSAJE_CIERRE_FUERA_HORARIO =
  "Ya quedó registrada. Ahorita el consultorio está cerrado, mañana a primera hora la Dra. revisa su mensaje y le confirma su cita por aquí.";

export const MENSAJE_RECURRENTE =
  "Hola [Nombre], qué gusto saludarle de nuevo. Veo que nos contactó antes por [ultimo_motivo]. ¿Es por el mismo tema o es algo nuevo?";

export const MENSAJE_RECURRENTE_REGISTRADO =
  "Veo que ya quedó registrado. La Dra. le confirma por aquí. ¿Desea agregar algo más?";

export const MENSAJE_DIRECCION =
  "Con gusto, estamos en [direccion_texto]. Aquí le dejo cómo llegar: [maps_url]";

export const MENSAJE_HORARIO =
  "Atendemos [horarios_texto]. La Dra. le confirma su cita por aquí mismo.";

export const DISCLAIMER_SERVICIO =
  "Sin compromiso, el costo final solo lo define la Dra. en consulta.";

export function buildMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\[([^\]]+)\]/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
}
