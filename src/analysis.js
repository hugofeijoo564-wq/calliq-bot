// ===========================================================
// analysis.js
// Aqui la IA (Claude) lee la transcripcion completa de la llamada
// y devuelve un analisis estructurado: sentimientos, score,
// objeciones, señales de compra, recomendaciones, etc.
// ===========================================================

const axios = require("axios");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function construirPrompt(transcript, meta) {
  return `Eres un analista experto en llamadas comerciales B2B con 30 años de experiencia y conocimiento profundo de la investigación de Gong (519.000 llamadas analizadas), McKinsey y HubSpot. Analiza la siguiente transcripción de una llamada comercial real.

DATOS DE LA LLAMADA:
- Comercial: ${meta.comercial}
- Cliente / Empresa: ${meta.cliente}
- Canal: ${meta.canal}
- Fecha: ${meta.fecha}
- Producto/Servicio: ${meta.producto || "No especificado"}

IMPORTANTE: en la transcripción los hablantes aparecen con sus nombres reales tal y como figuran en la videollamada. Identifica cuál de ellos es "${meta.comercial}" (el comercial, de nuestra empresa) y trata a los demás como el cliente/interlocutores.

TRANSCRIPCIÓN:
${transcript}

Devuelve ÚNICAMENTE un JSON válido (sin texto adicional, sin markdown, sin \`\`\`) con esta estructura exacta. Todos los campos deben estar rellenados con información ESPECÍFICA extraída de esta llamada concreta, nunca genérica:

{
  "resumenEjecutivo": "4 líneas máximo, específicas a esta llamada",
  "scoreGlobal": numero_0_a_100,
  "scoreDesglose": {"escucha": n, "presentacion": n, "manejoObjeciones": n, "cierre": n, "empatia": n},
  "sentimiento": {
    "positivo": n, "negativo": n, "neutro": n,
    "evolucion": [
      {"segmento": "Apertura", "score": n, "nota": "específico"},
      {"segmento": "Desarrollo", "score": n, "nota": "específico"},
      {"segmento": "Objeciones", "score": n, "nota": "específico"},
      {"segmento": "Cierre", "score": n, "nota": "específico"}
    ]
  },
  "temperaturaLead": {"nivel": "frio|tibio|caliente|listo", "score": n, "razones": ["frase o comportamiento concreto 1","2","3"]},
  "ratioConversacion": {"comercial": n, "cliente": n, "alerta": "texto o null"},
  "metricas": {
    "preguntasRealizadas": n, "distribucionPreguntas": "repartidas|acumuladas_inicio|acumuladas_final",
    "problemasExplorados": n, "minutoMencionPrecio": n_o_null, "intentosCierre": n,
    "intercambiosTurno": "alto|medio|bajo", "alertas": ["texto"]
  },
  "perfilCliente": {"nombre": "string", "empresa": "string", "rol": "string", "nivelDecision": "decision_maker|influencer|usuario|desconocido", "industria": "string"},
  "mapaPoder": {"decisor": "string", "influenciadores": ["string"], "frenos": ["string"]},
  "objeciones": [{"texto": "objeción exacta", "respuesta": "cómo respondió el comercial", "resultado": "neutralizada|pendiente|mal_gestionada", "mejora": "mejora específica"}],
  "senalesCompra": ["frase o comportamiento específico"],
  "redFlags": ["riesgo específico con contexto"],
  "competidores": [{"nombre": "string", "tono": "positivo|negativo|neutro", "contexto": "string"}],
  "puntosDolor": [{"dolor": "específico", "urgencia": "alta|media|baja"}],
  "gestionPrecio": {"justificoValor": true_o_false, "cedioDescuento": true_o_false, "momentoMencion": "cuando", "valoracion": "evaluación"},
  "presupuestoTimeline": {"presupuesto": "string o null", "fechaDecision": "string o null"},
  "probabilidadCierre": numero_0_a_100,
  "frasessPeligrosas": ["frases exactas del comercial"],
  "preguntasNoHechas": ["pregunta clave no realizada"],
  "upsell": ["oportunidad detectada"],
  "actionItems": [{"tarea": "específica", "responsable": "comercial|cliente|ambos", "fecha": "string o null", "urgencia": "alta|media|baja"}],
  "emailSeguimiento": "Email de seguimiento completo, listo para enviar, en español",
  "guionProximaLlamada": ["punto 1","2","3","4","5"],
  "recomendaciones": ["recomendación específica referenciando un momento exacto de la llamada 1","2","3","4","5"],
  "resumenManager": "3 frases: estado del deal + probabilidad. Punto fuerte del comercial. Acción crítica siguiente."
}`;
}

async function analizarLlamada(transcript, meta) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Falta configurar ANTHROPIC_API_KEY en el archivo .env");
  }

  const response = await axios.post(
    ANTHROPIC_URL,
    {
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: construirPrompt(transcript, meta) }],
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 120000,
    }
  );

  const raw = response.data.content[0].text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(raw);
}

module.exports = { analizarLlamada };
