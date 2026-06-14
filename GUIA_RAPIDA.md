# Guía rápida — CallIQ (en cristiano)

Esto explica, sin tecnicismos, qué tienes que hacer tú y qué hace el sistema
solo. Guarda este documento: es lo que le vas a dar a la persona técnica que
lo ponga en marcha.

## 1. Lo que tienes que crear tú (5 cuentas, ~20 minutos en total)

Son como crear una cuenta de correo: nombre, email, y en algunos casos una
tarjeta de pago de la empresa. Nadie más puede hacer esto por ti.

| Cuenta | Para qué sirve | Dónde |
|---|---|---|
| Recall.ai | Es el "asistente" que entra a las llamadas | recall.ai |
| Anthropic (Claude) | Es el "cerebro" que analiza la llamada | console.anthropic.com |
| Email para enviar informes | El correo desde el que se mandan los Word | Gmail, o un correo de empresa |
| Hosting (Railway o Render) | El "ordenador" que está siempre encendido | railway.app o render.com |
| GitHub (gratis) | Donde se guarda el código para poder instalarlo | github.com |

De cada una solo necesitas guardar una "clave" (una serie de letras y
números) que te dan al crear la cuenta. Esas claves van en un archivo
llamado `.env` — la persona técnica lo configurará.

## 2. Lo que hace el sistema solo, una vez instalado

1. El comercial abre una página sencilla (un formulario con 6 campos) y pega
   el enlace de la reunión de Zoom/Meet/Teams.
2. Pulsa un botón: "Enviar asistente a la llamada".
3. El asistente entra a la reunión y escribe en el chat un aviso de que la
   llamada se está grabando (el consentimiento).
4. Escucha toda la llamada.
5. Cuando la llamada termina, en pocos minutos llega un email con el informe
   completo en Word: sentimientos, score, objeciones, próximos pasos, email
   de seguimiento ya redactado, etc.

Nadie tiene que tocar nada más.

## 3. Lo que le toca a la persona técnica (una vez)

1. Coger el código (carpeta `calliq-bot`).
2. Subirlo a GitHub.
3. Conectarlo a Railway o Render (clic en "Deploy").
4. Poner las 5 claves del paso 1 en la configuración.
5. Hacer un último ajuste dentro de Recall.ai (apuntar un "aviso" a la
   dirección de tu sistema — está explicado paso a paso en `README.md`).

Con esto hecho, el sistema queda funcionando para siempre, sin mantenimiento
habitual.

## 4. Coste aproximado mensual

| Concepto | Coste estimado |
|---|---|
| Recall.ai (el asistente, por hora de llamada) | ~0,50 $/hora de llamada |
| Anthropic (el análisis de cada llamada) | ~0,02 € por llamada |
| Hosting (Railway/Render) | 5-20 €/mes |
| Email | Gratis (Gmail) o unos pocos euros |

Para un equipo de 10 comerciales con 8 llamadas/día de 20 minutos, esto son
aproximadamente **400-450 €/mes** en total — antes de aplicar tu margen al
venderlo a empresas.

## 5. Qué probar primero

Antes de usarlo con clientes reales, te recomiendo:

1. Probar con una llamada interna tuya (con un compañero, una reunión de
   prueba), para ver el informe completo de principio a fin.
2. Revisar que el mensaje de consentimiento se ve bien en el chat de Zoom/
   Meet/Teams.
3. Ajustar el texto del mensaje de consentimiento (`CONSENT_MESSAGE` en el
   archivo `.env`) con el nombre real de tu empresa.

A partir de ahí, ya está listo para tus primeros clientes piloto.
