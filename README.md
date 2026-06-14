# CallIQ Bot — README técnico

Sistema que envía un asistente de IA a llamadas de Zoom/Google Meet/Microsoft
Teams, transcribe la conversación, la analiza con Claude (Anthropic) y envía
un informe en Word por email cuando la llamada termina.

## Estructura del proyecto

```
calliq-bot/
├── server.js              # Servidor Express, punto de entrada
├── src/
│   ├── recallClient.js     # Llamadas a la API de Recall.ai (el bot)
│   ├── analysis.js         # Llamada a Claude para analizar la transcripción
│   ├── wordGenerator.js     # Genera el informe .docx con docx-js
│   └── emailSender.js      # Envío del email con el informe adjunto
├── public/
│   └── index.html          # Formulario para lanzar el bot a una llamada
├── test-generate.js        # Script para probar la generación del Word
├── .env.example             # Plantilla de configuración
└── package.json
```

## Requisitos

- Node.js 18 o superior
- Una cuenta en [Recall.ai](https://www.recall.ai) (el "asistente" de la llamada)
- Una API key de [Anthropic](https://console.anthropic.com) (el "cerebro" de análisis)
- Una cuenta de correo para enviar los informes (Gmail con contraseña de
  aplicación, o un servicio SMTP como Brevo/SendGrid)
- Un sitio donde alojar la app, con una URL pública (Railway, Render, Fly.io,
  un VPS, etc.) — necesario porque Recall.ai tiene que poder "llamar" a
  nuestro servidor

## Instalación

```bash
npm install
cp .env.example .env
# Rellenar .env con las claves reales (ver GUIA_RAPIDA.md)
npm start
```

## Configuración de Recall.ai — IMPORTANTE

Hay dos cosas que configurar en Recall.ai, no solo la API key:

1. **API Key**: Dashboard → API Keys → copiar a `RECALL_API_KEY` en `.env`.
   Anotar también la región (`RECALL_REGION`, ej. `us-west-2`, `eu-central-1`).

2. **Webhook de eventos del bot** (muy importante, fácil de olvidar):
   En el dashboard de Recall.ai → Webhooks → añadir un endpoint que apunte a:

   ```
   https://TU-DOMINIO-PUBLICO/api/webhook/recall
   ```

   y suscribirlo al evento `bot.status_change`. Esto es lo que nos avisa de
   que la llamada ha terminado. Sin este paso, el sistema nunca generará el
   informe.

   La transcripción en tiempo real (`transcript.data`) ya se configura
   automáticamente desde el código (`src/recallClient.js`), no hace falta
   tocarla en el dashboard.

## Flujo completo

1. El comercial abre `public/index.html`, pega el enlace de la reunión y
   pulsa "Enviar asistente".
2. `POST /api/lanzar-bot` llama a `recall.crearBot()` → Recall.ai manda el bot
   a la reunión.
3. Cuando el bot entra y empieza a grabar (`bot.status_change` →
   `in_call_recording`), el servidor le pide que escriba el mensaje de
   consentimiento en el chat de la reunión.
4. Durante la llamada, los eventos `transcript.data` van llegando a
   `/api/webhook/recall` y se acumulan en memoria.
5. Cuando la llamada termina (`bot.status_change` → `call_ended` / `done`):
   - Se construye el texto completo de la transcripción
   - Se envía a Claude (`src/analysis.js`) para el análisis completo
   - Se genera el `.docx` (`src/wordGenerator.js`)
   - Se envía por email (`src/emailSender.js`)

## Almacenamiento

La versión actual guarda el estado de las llamadas activas **en memoria**
(`Map` en `server.js`). Esto es suficiente para empezar y validar con
clientes piloto. Si el servidor se reinicia a mitad de una llamada, esa
llamada se perderá. Para producción con varios clientes simultáneos, el
siguiente paso natural es mover `llamadasActivas` a una base de datos
(Postgres/Redis) — la lógica no cambia, solo el lugar donde se guarda.

## Probar la generación del Word sin hacer una llamada real

```bash
node test-generate.js
```

Esto genera `test-output.docx` con datos de ejemplo, para comprobar que el
formato del informe es correcto sin gastar créditos de Recall.ai/Anthropic.

## Seguridad — pendiente antes de producción real

- **Verificar la firma de los webhooks de Recall.ai** (usan un secreto de
  verificación tipo Svix). Ahora mismo el endpoint `/api/webhook/recall`
  acepta cualquier petición. Antes de manejar datos reales de clientes,
  añadir esta verificación (ver
  https://docs.recall.ai para "Verifying requests from Recall.ai").
- Mover el almacenamiento de `llamadasActivas` a una base de datos.
- Añadir autenticación a `public/index.html` / `/api/lanzar-bot` para que
  solo comerciales autorizados puedan lanzar bots.

## Despliegue rápido (Railway / Render)

1. Subir este proyecto a un repositorio de GitHub.
2. Crear un nuevo servicio en Railway o Render, conectado a ese repositorio.
3. Configurar las variables de entorno (las mismas del `.env`) en el panel
   del servicio.
4. Una vez desplegado, copiar la URL pública que asigna la plataforma y
   ponerla en `PUBLIC_URL`.
5. Volver al dashboard de Recall.ai y configurar el webhook con esa URL
   (paso descrito arriba).
