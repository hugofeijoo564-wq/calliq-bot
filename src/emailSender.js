// ===========================================================
// emailSender.js
// Envia el informe Word adjunto por correo electronico
// cuando termina el analisis de la llamada.
// ===========================================================

const nodemailer = require("nodemailer");

function crearTransportador() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envia el informe por email.
 * destinatarios: string con uno o varios emails separados por coma
 * docxBuffer: el archivo Word ya generado
 * meta: datos de la llamada (comercial, cliente, fecha...)
 * resumen: el resumenEjecutivo del analisis, para el cuerpo del email
 */
async function enviarInforme({ destinatarios, docxBuffer, meta, resumen, scoreGlobal, temperatura, probabilidadCierre }) {
  const transporter = crearTransportador();

  const nombreArchivo = `CallIQ_${meta.comercial.replace(/\s+/g, "_")}_${meta.fecha}.docx`;

  const html = `
    <div style="font-family: Arial, sans-serif; color:#1a1a1a; max-width:600px">
      <h2 style="color:#1a3a6b">Informe de llamada comercial</h2>
      <p><b>Comercial:</b> ${meta.comercial}<br/>
         <b>Cliente:</b> ${meta.cliente}<br/>
         <b>Canal:</b> ${meta.canal}<br/>
         <b>Fecha:</b> ${meta.fecha}<br/>
         <b>Duración:</b> ${meta.duracion} min</p>
      <table style="margin:12px 0">
        <tr>
          <td style="padding:6px 12px; background:#eef2ff; border-radius:4px"><b>Score:</b> ${scoreGlobal}/100</td>
          <td style="padding:6px 12px"></td>
          <td style="padding:6px 12px; background:#fef9c3; border-radius:4px"><b>Temperatura:</b> ${temperatura}</td>
          <td style="padding:6px 12px"></td>
          <td style="padding:6px 12px; background:#dcfce7; border-radius:4px"><b>Prob. cierre:</b> ${probabilidadCierre}%</td>
        </tr>
      </table>
      <p>${resumen}</p>
      <p>El informe completo va adjunto en formato Word (.docx).</p>
      <p style="color:#aaa; font-size:12px; margin-top:24px">CallIQ — informe generado automáticamente</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: destinatarios,
    subject: `Informe de llamada — ${meta.comercial} / ${meta.cliente} (${meta.fecha})`,
    html,
    attachments: [
      {
        filename: nombreArchivo,
        content: docxBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  });
}

module.exports = { enviarInforme };
