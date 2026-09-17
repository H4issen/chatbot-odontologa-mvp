-- CreateEnum
CREATE TYPE "TipoContacto" AS ENUM ('referido', 'conocido', 'empresa');

-- CreateEnum
CREATE TYPE "Consentimiento" AS ENUM ('pendiente', 'aceptado', 'rechazado');

-- CreateEnum
CREATE TYPE "EstadoPaciente" AS ENUM ('nuevo', 'registrado', 'citado_externo', 'archivado');

-- CreateTable
CREATE TABLE "Paciente" (
    "phone_number" TEXT NOT NULL,
    "nombre" VARCHAR(500),
    "tipo_contacto" "TipoContacto",
    "doctor_referidor_id" INTEGER,
    "consentimiento" "Consentimiento" NOT NULL DEFAULT 'pendiente',
    "consentimiento_at" TIMESTAMP(3),
    "last_patient_msg_at" TIMESTAMP(3),
    "estado" "EstadoPaciente" NOT NULL DEFAULT 'nuevo',
    "bot_state" TEXT NOT NULL DEFAULT 'BIENVENIDA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("phone_number")
);

-- CreateTable
CREATE TABLE "Consulta" (
    "id" SERIAL NOT NULL,
    "paciente_phone" TEXT NOT NULL,
    "motivo_reportado" TEXT,
    "servicio_interes" VARCHAR(100),
    "diagnostico_doctora" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorReferidor" (
    "id" SERIAL NOT NULL,
    "codigo_qr" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorReferidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion_corta" VARCHAR(300) NOT NULL,
    "precio_desde" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultorioInfo" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "direccion_texto" TEXT NOT NULL,
    "maps_url" TEXT NOT NULL,
    "horarios_texto" TEXT NOT NULL,
    "scheduling_app_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultorioInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioAdmin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "reset_token" TEXT,
    "reset_token_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogWebhook" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wa_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "LogWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReferidor_codigo_qr_key" ON "DoctorReferidor"("codigo_qr");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_slug_key" ON "Servicio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioAdmin_email_key" ON "UsuarioAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioAdmin_reset_token_key" ON "UsuarioAdmin"("reset_token");

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_doctor_referidor_id_fkey" FOREIGN KEY ("doctor_referidor_id") REFERENCES "DoctorReferidor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_paciente_phone_fkey" FOREIGN KEY ("paciente_phone") REFERENCES "Paciente"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;
