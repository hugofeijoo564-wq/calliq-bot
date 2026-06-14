// ===========================================================
// recallClient.js
// Aqui esta toda la logica para hablar con Recall.ai:
// - Mandar al "asistente" (bot) a una llamada de Zoom/Meet/Teams
// - Hacer que el bot mande el mensaje de consentimiento
// - Pedir la transcripcion cuando la llamada termina
// ===========================================================

const axios = require("axios");

const REGION = process.env.RECALL_REGION || "us-west-2";
const API_KEY = process.env.RECALL_API_KEY;
const BASE_URL = `https://${REGION}.recall.ai/api/v1`;

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Token ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Manda el bot a una reunion (Zoom, Google Meet o Microsoft Teams).
 * meetingUrl: el enlace de la reunion, tal cual lo copias de Zoom/Meet/Teams
 * webhookUrl: la URL publica de nuestro servidor que recibira los avisos
 * languageCode: "es" para espanol, "en" para ingles
 */
async function crearBot({ meetingUrl, webhookUrl, languageCode = "es", botName = "Asistente CallIQ" }) {
  const payload = {
    meeting_url: meetingUrl,
    bot_name: botName,
    recording_config: {
      // Pedimos transcripcion en tiempo real con el motor de Recall.
      transcript: {
        provider: {
          recallai_streaming: {
            language_code: languageCode,
          },
        },
      },
      // Guardamos tambien el video/audio mezclado (util como respaldo)
      video_mixed_mp4: {},
      // Estos eventos (la transcripcion en vivo) llegan a nuestro webhook
      // en tiempo real, directamente desde esta peticion.
      // IMPORTANTE: el evento "bot.status_change" (que nos dice cuando
      // la llamada ha terminado) NO se configura aqui. Se configura UNA
      // VEZ en el panel de Recall.ai (Webhooks), apuntando a esta misma
      // URL. Ver GUIA_RAPIDA.md, paso de configuracion de Recall.ai.
      realtime_endpoints: [
        {
          type: "webhook",
          url: webhookUrl,
          events: ["transcript.data", "participant_events.join"],
        },
      ],
    },
  };

  const { data } = await client().post("/bot/", payload);
  return data; // contiene data.id -> el ID del bot
}

/**
 * El bot escribe un mensaje en el chat de la reunion.
 * Lo usamos para el aviso de consentimiento de grabacion.
 */
async function enviarMensajeChat(botId, mensaje) {
  try {
    await client().post(`/bot/${botId}/send_chat_message/`, {
      message: mensaje,
    });
  } catch (err) {
    console.error("No se pudo enviar el mensaje de consentimiento:", err.response?.data || err.message);
  }
}

/**
 * Recupera toda la informacion del bot (incluye grabaciones y transcripcion)
 */
async function obtenerBot(botId) {
  const { data } = await client().get(`/bot/${botId}/`);
  return data;
}

/**
 * Pide a Recall que transcriba la grabacion despues de que la llamada termine
 * (transcripcion "asincrona", se usa si no pedimos transcripcion en tiempo real
 * o como respaldo si el tiempo real fallo).
 */
async function crearTranscripcionAsincrona(recordingId, webhookUrl) {
  const { data } = await client().post(`/recording/${recordingId}/create_transcript/`, {
    provider: {
      recallai_async: {
        language_code: "es",
      },
    },
    realtime_endpoints: [
      {
        type: "webhook",
        url: webhookUrl,
        events: ["transcript.data"],
      },
    ],
  });
  return data;
}

/**
 * Descarga el contenido de una transcripcion ya generada
 */
async function descargarTranscripcion(downloadUrl) {
  const { data } = await axios.get(downloadUrl, { timeout: 60000 });
  return data;
}

/**
 * Convierte el JSON de transcripcion de Recall en texto plano
 * con formato "Nombre: lo que dijo", que es lo que necesita
 * nuestro analizador de IA.
 */
function transcripcionATexto(transcriptJson) {
  if (!Array.isArray(transcriptJson)) return "";

  const lineas = [];
  for (const bloque of transcriptJson) {
    const hablante = bloque.participant?.name || bloque.speaker || "Participante";
    const palabras = (bloque.words || []).map((w) => w.text).join(" ").trim();
    if (palabras) {
      lineas.push(`${hablante}: ${palabras}`);
    }
  }
  return lineas.join("\n\n");
}

module.exports = {
  crearBot,
  enviarMensajeChat,
  obtenerBot,
  crearTranscripcionAsincrona,
  descargarTranscripcion,
  transcripcionATexto,
};
