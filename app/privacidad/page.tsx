// app/privacidad/page.tsx — T-36
// Aviso de privacidad estático. Sin autenticación, sin links externos, sin datos de pacientes.

export default function PrivacidadPage() {
  const doctorName = process.env.DOCTOR_NAME || "la doctora responsable";
  const contactEmail = process.env.DOCTOR_EMAIL || "el correo del consultorio";

  return (
    <main>
      <h1>Aviso de Privacidad</h1>

      <p>
        {doctorName} es responsable del tratamiento de sus datos personales
        recabados a través de WhatsApp y de este sitio.
      </p>

      <h2>Datos que recabamos</h2>
      <p>
        Únicamente su número de teléfono, su nombre y el motivo de consulta
        que usted nos comparte por escrito. Solo la Dra. emite diagnósticos
        en consulta, nunca por chat.
      </p>

      <h2>Finalidad</h2>
      <p>
        Registrar su información para que {doctorName} pueda revisar su caso
        y confirmar su cita por el mismo medio. Sus datos no se comparten
        con terceros ni se usan con fines distintos.
      </p>

      <h2>Derechos ARCO</h2>
      <p>
        Usted tiene derecho de Acceso, Rectificación, Cancelación y Oposición
        (Derechos ARCO) respecto de sus datos personales. Para ejercerlos,
        escriba a {contactEmail} indicando su número de teléfono y el
        derecho que desea ejercer.
      </p>
      <p>
        Si solicita la cancelación de sus datos, se eliminan su nombre,
        motivo de consulta y consultas registradas; solo se conserva su
        número de teléfono como registro de bloqueo para no volver a
        escribirle, salvo que usted nos contacte de nuevo.
      </p>

      <h2>Contacto</h2>
      <p>
        Medio de contacto para dudas o derechos ARCO: {contactEmail}.
      </p>
    </main>
  );
}
