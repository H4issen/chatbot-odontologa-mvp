// lib/mail.ts — T-08
// Helper SMTP Gmail para emails transaccionales (reset + alerta a doctora).
// Validación lazy: sin SMTP_PASS/SMTP_USER → lanza al primer envío, no al importar.

import * as nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_USER) {
    throw new Error("mail.ts: falta SMTP_USER en process.env");
  }
  if (!SMTP_PASS) {
    throw new Error("mail.ts: falta SMTP_PASS en process.env");
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const SMTP_FROM = process.env.SMTP_FROM;
  const transporter = getTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Recupera tu acceso — Consultorio Dra. Paola",
    html: `
      <p>Hola,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Este enlace expira en 1 hora y es de un solo uso.</p>
      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
    `,
  });
}

export async function sendNewPatientAlert(
  patientName: string,
  motivo: string
): Promise<void> {
  const SMTP_FROM = process.env.SMTP_FROM;
  const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL;
  const transporter = getTransporter();

  if (!DOCTOR_EMAIL) {
    throw new Error("mail.ts: falta DOCTOR_EMAIL en process.env");
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: DOCTOR_EMAIL,
    subject: `Nuevo paciente registrado: ${patientName}`,
    html: `
      <p>Hola Dra.,</p>
      <p>Un nuevo paciente se ha registrado en el sistema:</p>
      <ul>
        <li><strong>Nombre:</strong> ${patientName}</li>
        <li><strong>Motivo:</strong> ${motivo}</li>
      </ul>
      <p>Por favor revisa su caso y confirma su cita por WhatsApp.</p>
    `,
  });
}
