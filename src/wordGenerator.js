// ===========================================================
// wordGenerator.js
// Convierte el analisis (JSON) de la IA en un documento Word
// (.docx) profesional, listo para enviar por email.
// ===========================================================

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  LevelFormat,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
} = require("docx");

// --- Paleta de colores (sin "#") ---
const C = {
  navy: "1A3A6B",
  navyLight: "EEF2FF",
  navyBorder: "C8D4EE",
  green: "166534",
  greenBg: "DCFCE7",
  amber: "854D0E",
  amberBg: "FEF9C3",
  red: "991B1B",
  redBg: "FEE2E2",
  gray: "555555",
  grayBorder: "DDDDDD",
  textDark: "1A1A1A",
};

// A4 con margenes de 1.5cm para aprovechar espacio (informe compacto)
const PAGE = { width: 11906, height: 16838 };
const MARGIN = 850; // ~1.5cm
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const FS = { tiny: 16, small: 18, base: 18, label: 16, h1: 28, h2: 18 }; // en half-points

function scoreColor(v) {
  if (v >= 80) return C.green;
  if (v >= 60) return C.amber;
  return C.red;
}
function scoreBg(v) {
  if (v >= 80) return C.greenBg;
  if (v >= 60) return C.amberBg;
  return C.redBg;
}

// --- Helpers de construccion ---

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.navy, space: 1 } },
    children: [new TextRun({ text, color: C.navy, bold: true, size: FS.h2 })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 30 },
    children: [
      new TextRun({
        text,
        size: opts.size || FS.base,
        bold: opts.bold || false,
        italics: opts.italics || false,
        color: opts.color || C.textDark,
      }),
    ],
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: opts.size || FS.small, color: opts.color || C.textDark })],
  });
}

function numbered(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 30 },
    children: [new TextRun({ text, size: FS.base })],
  });
}

function badge(text, bg, fg) {
  return new TextRun({
    text: ` ${text} `,
    size: FS.tiny,
    bold: true,
    color: fg,
    shading: { type: ShadingType.CLEAR, fill: bg },
  });
}

// Celda de tabla generica
function cell(children, opts = {}) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.noBorder
      ? { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
      : undefined,
    children: Array.isArray(children) ? children : [children],
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: C.grayBorder };
const tableBorders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const noBorders = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};

// Tabla simple de 2 columnas (etiqueta / valor) para metricas
function metricsTable(rows) {
  const w1 = Math.round(CONTENT_WIDTH * 0.34);
  const w2 = Math.round(CONTENT_WIDTH * 0.22);
  const w3 = Math.round(CONTENT_WIDTH * 0.22);
  const w4 = CONTENT_WIDTH - w1 - w2 - w3;

  const header = new TableRow({
    children: [
      cell([p("Indicador", { bold: true, size: FS.tiny })], { width: w1, fill: "F3F3F3" }),
      cell([p("Esta llamada", { bold: true, size: FS.tiny })], { width: w2, fill: "F3F3F3" }),
      cell([p("Óptimo (Gong)", { bold: true, size: FS.tiny })], { width: w3, fill: "F3F3F3" }),
      cell([p("Estado", { bold: true, size: FS.tiny })], { width: w4, fill: "F3F3F3" }),
    ],
  });

  const body = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell([p(r.label, { size: FS.tiny })], { width: w1 }),
          cell([p(r.value, { size: FS.tiny, bold: true })], { width: w2 }),
          cell([p(r.optimal, { size: FS.tiny })], { width: w3 }),
          cell(
            [
              new Paragraph({
                children: [badge(r.statusLabel, r.statusOk ? C.greenBg : r.statusWarn ? C.amberBg : C.redBg, r.statusOk ? C.green : r.statusWarn ? C.amber : C.red)],
              }),
            ],
            { width: w4 }
          ),
        ],
      })
  );

  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [w1, w2, w3, w4], borders: tableBorders, rows: [header, ...body] });
}

// Tabla generica de N columnas con cabecera
function genericTable(headers, widthsPct, rowsData) {
  const widths = widthsPct.map((pct) => Math.round(CONTENT_WIDTH * pct));
  const header = new TableRow({
    children: headers.map((htext, i) => cell([p(htext, { bold: true, size: FS.tiny })], { width: widths[i], fill: "F3F3F3" })),
  });
  const body = rowsData.map(
    (row) =>
      new TableRow({
        children: row.map((content, i) => cell(Array.isArray(content) ? content : [content], { width: widths[i] })),
      })
  );
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths, borders: tableBorders, rows: [header, ...body] });
}

// Caja resaltada (para resumen del manager / email de seguimiento)
function highlightBox(title, text, bg, borderColor) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p(title, { bold: true, size: FS.small, color: C.navy }),
              ...text.split("\n").filter((l) => l.trim()).map((line) => p(line, { size: FS.small })),
            ],
            { width: CONTENT_WIDTH, fill: bg }
          ),
        ],
      }),
    ],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 0 }, children: [] });
}

function twoColumns(leftChildren, rightChildren, halfW) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [halfW, CONTENT_WIDTH - halfW],
    borders: noBorders,
    rows: [new TableRow({ children: [cell(leftChildren, { width: halfW, noBorder: true }), cell(rightChildren, { width: CONTENT_WIDTH - halfW, noBorder: true })] })],
  });
}

// === FUNCION PRINCIPAL ===
async function generarInformeWord(a, meta) {
  const skillNames = { escucha: "Escucha activa", presentacion: "Presentación", manejoObjeciones: "Manejo de objeciones", cierre: "Intento de cierre", empatia: "Empatía" };

  const children = [];

  // --- Titulo y cabecera ---
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: "Informe de llamada comercial — CallIQ", bold: true, size: FS.h1, color: C.navy })],
    })
  );

  const headerW = Math.round(CONTENT_WIDTH / 6);
  children.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [headerW, headerW, headerW, headerW, headerW, CONTENT_WIDTH - headerW * 5],
      borders: tableBorders,
      rows: [
        new TableRow({
          children: [
            cell([p("Comercial", { bold: true, size: FS.tiny }), p(meta.comercial, { size: FS.tiny })], { width: headerW, fill: C.navyLight }),
            cell([p("Cliente", { bold: true, size: FS.tiny }), p(meta.cliente, { size: FS.tiny })], { width: headerW, fill: C.navyLight }),
            cell([p("Fecha", { bold: true, size: FS.tiny }), p(meta.fecha, { size: FS.tiny })], { width: headerW, fill: C.navyLight }),
            cell([p("Canal", { bold: true, size: FS.tiny }), p(meta.canal, { size: FS.tiny })], { width: headerW, fill: C.navyLight }),
            cell([p("Duración", { bold: true, size: FS.tiny }), p(`${meta.duracion} min`, { size: FS.tiny })], { width: headerW, fill: C.navyLight }),
            cell(
              [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${a.scoreGlobal}`, bold: true, size: 36, color: scoreColor(a.scoreGlobal) }), new TextRun({ text: " /100", size: FS.tiny, color: C.gray })],
                }),
              ],
              { width: CONTENT_WIDTH - headerW * 5, fill: C.navyLight }
            ),
          ],
        }),
      ],
    })
  );

  // --- Linea de estado: temperatura, prob. cierre, ratio ---
  const tempLabels = { frio: "FRÍO", tibio: "TIBIO", caliente: "CALIENTE", listo: "LISTO PARA CERRAR" };
  const tempColors = {
    frio: [C.navyLight, C.navy],
    tibio: [C.amberBg, C.amber],
    caliente: [C.amberBg, C.amber],
    listo: [C.greenBg, C.green],
  };
  const [tBg, tFg] = tempColors[a.temperaturaLead?.nivel] || tempColors.tibio;

  children.push(
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({ text: "Temperatura: ", size: FS.small, bold: true }),
        badge(`${tempLabels[a.temperaturaLead?.nivel] || a.temperaturaLead?.nivel} (${a.temperaturaLead?.score}/100)`, tBg, tFg),
        new TextRun({ text: "    Probabilidad de cierre: ", size: FS.small, bold: true }),
        badge(`${a.probabilidadCierre}%`, scoreBg(a.probabilidadCierre), scoreColor(a.probabilidadCierre)),
        new TextRun({ text: "    Ratio conversación: ", size: FS.small, bold: true }),
        new TextRun({ text: `Comercial ${a.ratioConversacion?.comercial}% / Cliente ${a.ratioConversacion?.cliente}%`, size: FS.small }),
        ...(a.ratioConversacion?.alerta ? [new TextRun({ text: "  ⚠ " + a.ratioConversacion.alerta, size: FS.tiny, color: C.red, bold: true })] : []),
      ],
    })
  );

  // --- Resumen ejecutivo ---
  children.push(h2("Resumen ejecutivo"));
  children.push(p(a.resumenEjecutivo));

  // --- Score por habilidad + Sentimiento (dos columnas con tabla) ---
  const halfW = Math.round(CONTENT_WIDTH / 2) - 100;

  const scoreRows = Object.entries(a.scoreDesglose || {}).map(([k, v]) =>
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `${skillNames[k] || k}: `, size: FS.tiny }),
        new TextRun({ text: `${v}/100`, size: FS.tiny, bold: true, color: scoreColor(v) }),
      ],
    })
  );

  const sentParts = [
    new Paragraph({
      spacing: { after: 30 },
      children: [
        badge(`Positivo ${a.sentimiento?.positivo}%`, C.greenBg, C.green),
        new TextRun({ text: "  " }),
        badge(`Neutro ${a.sentimiento?.neutro}%`, "F3F3F3", C.gray),
        new TextRun({ text: "  " }),
        badge(`Negativo ${a.sentimiento?.negativo}%`, C.redBg, C.red),
      ],
    }),
  ];
  for (const e of a.sentimiento?.evolucion || []) {
    sentParts.push(
      new Paragraph({
        spacing: { after: 15 },
        children: [
          new TextRun({ text: `${e.segmento}: `, size: FS.tiny, bold: true }),
          new TextRun({ text: `${e.score}/100 — `, size: FS.tiny, color: scoreColor(e.score) }),
          new TextRun({ text: e.nota, size: FS.tiny, italics: true, color: C.gray }),
        ],
      })
    );
  }

  children.push(h2("Score por habilidad y evolución del sentimiento"));
  children.push(twoColumns(scoreRows, sentParts, halfW));

  // --- Metricas Gong ---
  const m = a.metricas || {};
  const distOk = m.distribucionPreguntas === "repartidas";
  const preguntasOk = m.preguntasRealizadas >= 11 && m.preguntasRealizadas <= 14;
  const problemasOk = m.problemasExplorados >= 3 && m.problemasExplorados <= 4;
  const precioOk = m.minutoMencionPrecio >= 40 && m.minutoMencionPrecio <= 49;
  const cierreOk = m.intentosCierre >= 1;
  const intercambioOk = m.intercambiosTurno === "alto";

  children.push(h2("Métricas de calidad (benchmark Gong, 519.000 llamadas)"));
  children.push(
    metricsTable([
      { label: "Preguntas realizadas", value: `${m.preguntasRealizadas ?? "-"}`, optimal: "11–14", statusOk: preguntasOk, statusWarn: !preguntasOk && m.preguntasRealizadas > 14, statusLabel: preguntasOk ? "OK" : m.preguntasRealizadas < 11 ? "Pocas" : "Muchas" },
      { label: "Distribución de preguntas", value: distOk ? "Repartidas" : "Acumuladas", optimal: "Repartidas", statusOk: distOk, statusWarn: false, statusLabel: distOk ? "OK" : "Mejorar" },
      { label: "Problemas explorados", value: `${m.problemasExplorados ?? "-"}`, optimal: "3–4", statusOk: problemasOk, statusWarn: !problemasOk && m.problemasExplorados > 4, statusLabel: problemasOk ? "OK" : m.problemasExplorados < 3 ? "Poco fondo" : "Excesivo" },
      { label: "Minuto mención precio", value: m.minutoMencionPrecio ? `${m.minutoMencionPrecio}` : "No mencionado", optimal: "Min. 40–49", statusOk: precioOk, statusWarn: !m.minutoMencionPrecio, statusLabel: !m.minutoMencionPrecio ? "Sin dato" : precioOk ? "OK" : "Demasiado pronto" },
      { label: "Intentos de cierre", value: `${m.intentosCierre ?? 0}`, optimal: "≥ 1 claro", statusOk: cierreOk, statusWarn: false, statusLabel: cierreOk ? "OK" : "Ninguno" },
      { label: "Intercambio de turno", value: m.intercambiosTurno || "-", optimal: "Alto", statusOk: intercambioOk, statusWarn: m.intercambiosTurno === "medio", statusLabel: intercambioOk ? "OK" : m.intercambiosTurno === "medio" ? "Regular" : "Bajo" },
    ])
  );
  if ((m.alertas || []).length) {
    children.push(...m.alertas.map((al) => bullet(al, { color: C.amber, size: FS.tiny })));
  }

  // --- Objeciones ---
  if ((a.objeciones || []).length) {
    children.push(h2("Objeciones detectadas"));
    children.push(
      genericTable(
        ["Objeción del cliente", "Resultado", "Cómo mejorarlo"],
        [0.34, 0.16, 0.5],
        a.objeciones.map((o) => [
          p(`"${o.texto}"`, { size: FS.tiny, italics: true }),
          new Paragraph({ children: [badge(o.resultado === "neutralizada" ? "Neutralizada" : o.resultado === "pendiente" ? "Pendiente" : "Mal gestionada", o.resultado === "neutralizada" ? C.greenBg : o.resultado === "pendiente" ? C.amberBg : C.redBg, o.resultado === "neutralizada" ? C.green : o.resultado === "pendiente" ? C.amber : C.red)] }),
          p(o.mejora, { size: FS.tiny }),
        ])
      )
    );
  }

  // --- Señales de compra / Red flags / Puntos de dolor / Mapa de poder (dos columnas) ---
  const leftCol2 = [];
  leftCol2.push(p("Señales de compra", { bold: true, color: C.navy, size: FS.small }));
  if ((a.senalesCompra || []).length) leftCol2.push(...a.senalesCompra.map((s) => bullet(s, { size: FS.tiny })));
  else leftCol2.push(p("No detectadas", { size: FS.tiny, color: C.gray }));

  leftCol2.push(emptyLine());
  leftCol2.push(p("Red flags", { bold: true, color: C.red, size: FS.small }));
  if ((a.redFlags || []).length) leftCol2.push(...a.redFlags.map((r) => bullet(r, { size: FS.tiny, color: C.red })));
  else leftCol2.push(p("Sin alertas críticas", { size: FS.tiny, color: C.gray }));

  const rightCol2 = [];
  rightCol2.push(p("Puntos de dolor del cliente", { bold: true, color: C.navy, size: FS.small }));
  if ((a.puntosDolor || []).length) {
    rightCol2.push(
      ...a.puntosDolor.map((pd) =>
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 20 },
          children: [badge(pd.urgencia.toUpperCase(), pd.urgencia === "alta" ? C.redBg : pd.urgencia === "media" ? C.amberBg : "F3F3F3", pd.urgencia === "alta" ? C.red : pd.urgencia === "media" ? C.amber : C.gray), new TextRun({ text: ` ${pd.dolor}`, size: FS.tiny })],
        })
      )
    );
  } else rightCol2.push(p("No identificados", { size: FS.tiny, color: C.gray }));

  rightCol2.push(emptyLine());
  rightCol2.push(p("Mapa de poder", { bold: true, color: C.navy, size: FS.small }));
  rightCol2.push(p(`Decisor: ${a.mapaPoder?.decisor || "No identificado"}`, { size: FS.tiny }));
  if ((a.mapaPoder?.influenciadores || []).length) rightCol2.push(p(`Influenciadores: ${a.mapaPoder.influenciadores.join(", ")}`, { size: FS.tiny }));
  if ((a.mapaPoder?.frenos || []).length) rightCol2.push(p(`Frenos: ${a.mapaPoder.frenos.join(", ")}`, { size: FS.tiny, color: C.red }));

  children.push(emptyLine());
  children.push(twoColumns(leftCol2, rightCol2, halfW));

  // --- Frases peligrosas / preguntas no hechas ---
  if ((a.frasessPeligrosas || []).length || (a.preguntasNoHechas || []).length) {
    children.push(h2("Atención: frases del comercial y preguntas no realizadas"));
    if ((a.frasessPeligrosas || []).length) {
      children.push(p("Frases que pueden alejar al cliente:", { bold: true, size: FS.tiny }));
      children.push(...a.frasessPeligrosas.map((f) => bullet(`"${f}"`, { size: FS.tiny, color: C.red })));
    }
    if ((a.preguntasNoHechas || []).length) {
      children.push(p("Preguntas clave que faltó hacer:", { bold: true, size: FS.tiny }));
      children.push(...a.preguntasNoHechas.map((q) => bullet(q, { size: FS.tiny, color: C.amber })));
    }
  }

  // --- Presupuesto / timeline / precio ---
  children.push(h2("Presupuesto, timeline y gestión del precio"));
  children.push(p(`Presupuesto detectado: ${a.presupuestoTimeline?.presupuesto || "No mencionado"}`, { size: FS.tiny }));
  children.push(p(`Fecha de decisión estimada: ${a.presupuestoTimeline?.fechaDecision || "No mencionada"}`, { size: FS.tiny }));
  children.push(p(`Gestión del precio: ${a.gestionPrecio?.valoracion || "-"}`, { size: FS.tiny }));
  if ((a.competidores || []).length) {
    children.push(p(`Competidores mencionados: ${a.competidores.map((c2) => `${c2.nombre} (${c2.tono})`).join(", ")}`, { size: FS.tiny }));
  }
  if ((a.upsell || []).length) {
    children.push(p("Oportunidades de upsell / cross-sell:", { bold: true, size: FS.tiny }));
    children.push(...a.upsell.map((u) => bullet(u, { size: FS.tiny })));
  }

  // --- Action items ---
  if ((a.actionItems || []).length) {
    children.push(h2("Action items y próximos pasos"));
    children.push(
      genericTable(
        ["Tarea", "Responsable", "Fecha", "Urgencia"],
        [0.5, 0.18, 0.16, 0.16],
        a.actionItems.map((it) => [
          p(it.tarea, { size: FS.tiny }),
          p(it.responsable === "comercial" ? "Comercial" : it.responsable === "cliente" ? "Cliente" : "Ambos", { size: FS.tiny }),
          p(it.fecha || "-", { size: FS.tiny }),
          new Paragraph({ children: [badge(it.urgencia.toUpperCase(), it.urgencia === "alta" ? C.redBg : it.urgencia === "media" ? C.amberBg : C.navyLight, it.urgencia === "alta" ? C.red : it.urgencia === "media" ? C.amber : C.navy)] }),
        ])
      )
    );
  }

  // --- Recomendaciones / guion (dos columnas) ---
  const recoCol = [p("Recomendaciones de mejora", { bold: true, color: C.navy, size: FS.small })];
  (a.recomendaciones || []).forEach((r) => recoCol.push(numbered(r, "numReco")));

  const guionCol = [p("Guión para la próxima llamada", { bold: true, color: C.navy, size: FS.small })];
  (a.guionProximaLlamada || []).forEach((g) => guionCol.push(numbered(g, "numGuion")));

  children.push(emptyLine());
  children.push(twoColumns(recoCol, guionCol, halfW));

  // --- Resumen para el manager ---
  children.push(emptyLine());
  children.push(highlightBox("Resumen para el manager", a.resumenManager || "", C.navyLight, C.navyBorder));

  // --- Email de seguimiento ---
  children.push(emptyLine());
  children.push(highlightBox("Email de seguimiento (listo para enviar)", a.emailSeguimiento || "", "F9F9F9", C.grayBorder));

  // --- Pie ---
  children.push(
    new Paragraph({
      spacing: { before: 120 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `CallIQ — generado el ${new Date().toLocaleString("es-ES")} — Metodología Gong Labs (519.000 llamadas B2B)`, size: 14, color: "AAAAAA", italics: true })],
    })
  );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: FS.base } } },
      paragraphStyles: [
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: FS.h2, bold: true, font: "Calibri", color: C.navy }, paragraph: { spacing: { before: 120, after: 40 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 280, hanging: 220 } } } }] },
        { reference: "numReco", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 280, hanging: 220 } } } }] },
        { reference: "numGuion", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 280, hanging: 220 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: PAGE, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generarInformeWord };
