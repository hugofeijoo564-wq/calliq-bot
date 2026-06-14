const fs = require("fs");
const { generarInformeWord } = require("./src/wordGenerator");

const analisis = {
  resumenEjecutivo: "Llamada de descubrimiento con Metalurgias del Norte. El cliente expone un problema claro de precisión en cortes (2.000€/mes en material perdido) y muestra interés real en el CX-3000. Pide demo presencial para el miércoles. Pendiente de validación de presupuesto con dirección financiera.",
  scoreGlobal: 78,
  scoreDesglose: { escucha: 85, presentacion: 75, manejoObjeciones: 70, cierre: 80, empatia: 82 },
  sentimiento: {
    positivo: 60, negativo: 10, neutro: 30,
    evolucion: [
      { segmento: "Apertura", score: 70, nota: "Cliente receptivo, comparte el problema sin reservas" },
      { segmento: "Desarrollo", score: 65, nota: "Cuantifica el coste del problema (2.000€/mes)" },
      { segmento: "Objeciones", score: 55, nota: "Duda por el presupuesto, pero no rechaza" },
      { segmento: "Cierre", score: 85, nota: "Pide demo presencial activamente" },
    ],
  },
  temperaturaLead: { nivel: "caliente", score: 74, razones: ["Pidió demo presencial sin que se lo propusieran", "Confirmó que hay presupuesto reservado para equipamiento", "Usó 'cuando lo tengamos' al hablar del CX-3000"] },
  ratioConversacion: { comercial: 48, cliente: 52, alerta: null },
  metricas: {
    preguntasRealizadas: 6, distribucionPreguntas: "repartidas", problemasExplorados: 2,
    minutoMencionPrecio: 9, intentosCierre: 1, intercambiosTurno: "alto",
    alertas: ["Solo se hicieron 6 preguntas; el benchmark recomienda 11-14 para profundizar mejor en las necesidades"],
  },
  perfilCliente: { nombre: "Luis Martínez", empresa: "Metalurgias del Norte S.L.", rol: "Responsable de producción", nivelDecision: "influencer", industria: "Metalurgia / fabricación industrial" },
  mapaPoder: { decisor: "Director financiero (mencionado, no presente)", influenciadores: ["Luis Martínez (responsable de producción)"], frenos: ["Socio (debe aprobar la inversión)"] },
  objeciones: [
    { texto: "Uff, es bastante. No sé si tenemos presupuesto ahora mismo.", respuesta: "El comercial preguntó si había presupuesto reservado para equipamiento este año", resultado: "neutralizada", mejora: "Aprovechar para cuantificar el ROI: 45.000€ vs 24.000€/año perdidos actualmente" },
  ],
  senalesCompra: ["Pidió una demostración en sus instalaciones sin que se lo pidieran", "Confirmó presupuesto reservado para equipamiento industrial", "Propuso fecha y hora concreta para la demo"],
  redFlags: ["El cliente necesita aprobación de su socio y del director financiero antes de decidir"],
  competidores: [],
  puntosDolor: [
    { dolor: "Pérdida de material por imprecisión de corte (~2.000€/mes)", urgencia: "alta" },
    { dolor: "3 horas semanales de reprocesos por piezas defectuosas", urgencia: "media" },
  ],
  gestionPrecio: { justificoValor: false, cedioDescuento: false, momentoMencion: "Minuto 9, cuando el cliente preguntó directamente", valoracion: "El precio se mencionó muy pronto (minuto 9) y sin justificar el valor antes (ROI, ahorro mensual). Aun así el cliente no descartó la propuesta." },
  presupuestoTimeline: { presupuesto: "Presupuesto reservado para equipamiento industrial este año (cantidad no especificada)", fechaDecision: "Respuesta en aproximadamente 2 semanas" },
  probabilidadCierre: 65,
  frasessPeligrosas: [],
  preguntasNoHechas: ["¿Qué pasaría si esta inversión no se aprueba este trimestre?", "¿Quién más participa en la decisión además de tu socio?"],
  upsell: ["El cliente mencionó reprocesos manuales: posible interés en el módulo de control de calidad automatizado"],
  actionItems: [
    { tarea: "Enviar confirmación por email de la demo del miércoles a las 10:00", responsable: "comercial", fecha: "Hoy", urgencia: "alta" },
    { tarea: "Preparar cálculo de ROI (45.000€ inversión vs 24.000€/año de pérdidas actuales)", responsable: "comercial", fecha: "Antes de la demo", urgencia: "alta" },
    { tarea: "Confirmar disponibilidad del director financiero para la demo o una llamada posterior", responsable: "cliente", fecha: "En 2 semanas", urgencia: "media" },
  ],
  emailSeguimiento: "Hola Luis,\n\nGracias por tu tiempo hoy. Como hablamos, confirmo nuestra visita el miércoles a las 10:00 para la demostración del CX-3000 en vuestras instalaciones.\n\nAntes de la demo os preparo un cálculo del ahorro estimado frente al coste actual de reprocesos (~2.000€/mes), para que podáis valorarlo junto al presupuesto reservado.\n\nCualquier duda, aquí estoy.\n\nUn saludo,\nCarlos",
  guionProximaLlamada: [
    "Empezar mostrando el cálculo de ROI antes de cualquier otra cosa",
    "Preguntar directamente quién más participa en la decisión aparte del socio",
    "Profundizar en los problemas de calidad (reprocesos) para detectar el interés en el módulo de control de calidad",
    "Pedir fecha límite real para la decisión del comité",
    "Cerrar con una propuesta formal por escrito tras la demo",
  ],
  recomendaciones: [
    "En el minuto 9 se habló de precio demasiado pronto (benchmark: minuto 40-49). En la próxima llamada, retrasar la cifra hasta haber cuantificado el ahorro.",
    "Solo se hicieron 6 preguntas (óptimo 11-14). Profundizar más en el impacto del problema antes de presentar el producto.",
    "El cliente mencionó reprocesos manuales sin que se explorara como oportunidad de upsell del módulo de calidad.",
    "Aprovechar la señal de compra ('cuando lo tengamos') para intentar un segundo cierre más ambicioso: proponer fecha de instalación tentativa.",
    "Preparar de antemano respuestas a la objeción de presupuesto con cifras de ROI, ya que es muy probable que reaparezca con el director financiero.",
  ],
  resumenManager: "Deal en estado caliente (65% probabilidad de cierre) con demo presencial confirmada para el miércoles. El comercial gestionó bien la objeción de presupuesto sin ceder en precio. Acción crítica: preparar el cálculo de ROI antes de la demo para neutralizar la futura revisión del director financiero.",
};

const meta = {
  comercial: "Carlos García",
  cliente: "Luis Martínez — Metalurgias del Norte S.L.",
  canal: "Zoom",
  producto: "Maquinaria láser CX-3000",
  fecha: new Date().toISOString().split("T")[0],
  duracion: 18,
};

(async () => {
  const buffer = await generarInformeWord(analisis, meta);
  fs.writeFileSync("/home/claude/calliq-bot/test-output.docx", buffer);
  console.log("OK, generado test-output.docx, tamaño:", buffer.length, "bytes");
})();
