// ===========================================================
// server.js
// Este es el "cerebro central" de CallIQ:
//
// 1) Expone una pagina sencilla (public/index.html) donde el
//    comercial pega el enlace de la reunion y pulsa un boton.
// 2) Manda el "asistente" (bot de Recall.ai) a esa reunion.
// 3) Cuando el bot entra, escribe el aviso de consentimiento.
// 4) Va recibiendo la transcripcion en tiempo real.
// 5) Cuando la llamada termina, analiza todo con IA, genera
//    el Word y lo envia por email automaticamente.
// ===========================================================

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const recall = require("./src/recallClient");
const { analizarLlamada } = require("./src/analysis");
const { generarInformeWord } = require("./src/wordGenerator");
const { enviarInforme } = require("./src/emailSender");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const WEBHOOK_URL = `${PUBLIC_URL}/api/webhook/recall`;

// ------------------------------------------------------------------
// "Memoria" de llamadas en curso. Guardamos aqui los datos de cada
// llamada mientras esta activa: quien es el comercial, el cliente,
// la transcripcion que va llegando, etc.
// En una version mas avanzada esto se guardaria en una base de datos,
// pero para empezar (y para que funcione ya) esto es suficiente.
// ------------------------------------------------------------------
const llamadasActivas = new Map();

// ------------------------------------------------------------------
// PASO 1: el comercial pulsa "Enviar asistente a la llamada"
// ------------------------------------------------------------------
app.post("/api/lanzar-bot", async (req, res) => {
  try {
    const { meetingUrl, comercial, cliente, canal, producto, email, idioma } = req.body;

    if (!meetingUrl || !comercial || !email) {
      return res.status(400).json({ error: "Faltan datos obligatorios: enlace de la reunion, comercial y email." });
    }

    const bot = await recall.crearBot({
      meetingUrl,
      webhookUrl: WEBHOOK_URL,
      languageCode: idioma === "en" ? "en" : "es",
    });

    llamadasActivas.set(bot.id, {
      comercial,
      cliente: cliente || "Cliente",
      canal: canal || "Videollamada",
      producto: producto || "",
      email,
      idioma: idioma || "es",
      transcripcion: [], // aqui se va acumulando lo que se dice
      consentimientoEnviado: false,
      procesada: false,
      inicio: null,
    });

    console.log(`Bot creado (${bot.id}) para la llamada de ${comercial} con ${cliente}`);
    res.json({ ok: true, botId: bot.id });
  } catch (err) {
    console.error("Error creando el bot:", err.response?.data || err.message);
    res.status(500).json({ error: "No se pudo enviar el asistente a la llamada. Revisa el enlace y la configuracion." });
  }
});

// ------------------------------------------------------------------
// PASO 2: Recall.ai nos avisa de todo lo que pasa en la llamada
// ------------------------------------------------------------------
app.post("/api/webhook/recall", async (req, res) => {
  // Respondemos rapido siempre, y procesamos despues.
  res.sendStatus(200);

  try {
    const { event, data } = req.body;
    const botId = data?.bot?.id;
    if (!botId) return;

    const llamada = llamadasActivas.get(botId);
    if (!llamada) return; // bot que no lanzamos nosotros, o ya procesado

    // --- Cambios de estado del bot (entra, empieza a grabar, termina) ---
    if (event === "bot.status_change") {
      const status = data?.status?.code;
      console.log(`[${botId}] estado: ${status}`);

      if (status === "in_call_recording" && !llamada.consentimientoEnviado) {
        llamada.consentimientoEnviado = true;
        llamada.inicio = Date.now();
        const mensaje = process.env.CONSENT_MESSAGE || "Esta llamada se esta grabando y transcribiendo con fines de calidad y analisis comercial.";
        // Pequeña espera para asegurarnos de que el chat esta listo
        setTimeout(() => recall.enviarMensajeChat(botId, mensaje), 3000);
      }

      if ((status === "call_ended" || status === "done") && !llamada.procesada) {
        llamada.procesada = true;
        procesarLlamadaFinalizada(botId, llamada).catch((e) => console.error(`[${botId}] Error procesando la llamada:`, e));
      }
    }

    // --- Fragmentos de transcripcion en tiempo real ---
    if (event === "transcript.data") {
      const palabras = data?.data?.words || [];
      const hablante = data?.data?.participant?.name || "Participante";
      const texto = palabras.map((w) => w.text).join(" ").trim();
      if (texto) {
        llamada.transcripcion.push({ hablante, texto });
      }
    }
  } catch (err) {
    console.error("Error procesando webhook de Recall:", err);
  }
});

// ------------------------------------------------------------------
// PASO 3: la llamada ha terminado -> analizar, generar Word, enviar email
// ------------------------------------------------------------------
async function procesarLlamadaFinalizada(botId, llamada) {
  console.log(`[${botId}] Llamada finalizada. Procesando...`);

  // 1) Construir el texto de la transcripcion en formato "Nombre: texto"
  const lineas = [];
  let actual = null;
  for (const trozo of llamada.transcripcion) {
    if (actual && actual.hablante === trozo.hablante) {
      actual.texto += " " + trozo.texto;
    } else {
      if (actual) lineas.push(`${actual.hablante}: ${actual.texto}`);
      actual = { hablante: trozo.hablante, texto: trozo.texto };
    }
  }
  if (actual) lineas.push(`${actual.hablante}: ${actual.texto}`);
  const transcripcionTexto = lineas.join("\n\n");

  if (!transcripcionTexto.trim()) {
    console.warn(`[${botId}] No se recibio transcripcion. No se genera informe.`);
    llamadasActivas.delete(botId);
    return;
  }

  // 2) Calcular duracion aproximada
  const duracionMin = llamada.inicio ? Math.max(1, Math.round((Date.now() - llamada.inicio) / 60000)) : "-";

  const meta = {
    comercial: llamada.comercial,
    cliente: llamada.cliente,
    canal: llamada.canal,
    producto: llamada.producto,
    fecha: new Date().toISOString().split("T")[0],
    duracion: duracionMin,
  };

  // 3) Analizar con IA
  const analisis = await analizarLlamada(transcripcionTexto, meta);

  // 4) Generar el Word
  const docxBuffer = await generarInformeWord(analisis, meta);

  // 5) Enviar por email
  const destinatarios = [llamada.email, process.env.DEFAULT_REPORT_EMAIL].filter(Boolean).join(",");
  await enviarInforme({
    destinatarios,
    docxBuffer,
    meta,
    resumen: analisis.resumenEjecutivo,
    scoreGlobal: analisis.scoreGlobal,
    temperatura: analisis.temperaturaLead?.nivel,
    probabilidadCierre: analisis.probabilidadCierre,
  });

  console.log(`[${botId}] Informe generado y enviado a ${destinatarios}`);
  llamadasActivas.delete(botId);
}

// ------------------------------------------------------------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`CallIQ escuchando en el puerto ${PORT}`);
  console.log(`URL del webhook que hay que tener accesible: ${WEBHOOK_URL}`);
});
