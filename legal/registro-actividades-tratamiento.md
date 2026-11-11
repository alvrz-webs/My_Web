# Registro de actividades de tratamiento (art. 30 RGPD)

Documento interno. No se publica en la web: tenlo a mano por si la Agencia Española de Protección de
Datos (AEPD) o una persona interesada lo piden. Actualízalo cuando cambie lo que hace la web.

- **Responsable:** Mario Álvarez Martínez — NIF 49230699G
- **Domicilio:** Benidorm (Alicante), España
- **Contacto para privacidad:** malvmar5@hotmail.com
- **Delegado de protección de datos:** no designado (no es obligatorio por tamaño ni por tipo de tratamiento)
- **Última revisión:** 10 de noviembre de 2026 (versiones de los textos legales: `src/data/legal.js`)

---

## 1. Analítica de uso de la web

| Campo | Detalle |
|---|---|
| Finalidad | Saber qué secciones y proyectos resultan útiles para mejorar la web |
| Interesados | Visitantes que aceptan las cookies de análisis |
| Datos | Identificador seudónimo (`visitante_id`), secciones y proyectos vistos, tiempo de atención, clics, idioma, tipo de dispositivo, país aproximado, página de la web del evento. **Sin IP** |
| Base jurídica | Consentimiento (art. 6.1.a RGPD; art. 22.2 LSSI-CE) |
| Destinatarios | Cloudflare, Inc. (encargado: Pages y D1) |
| Transferencias | EE. UU. — Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo |
| Plazo | 12 meses; se borra automáticamente (`functions/api/track.js`) |
| Seguridad | HTTPS; base de datos solo accesible desde el panel con usuario y contraseña; el visitante puede borrar sus datos al momento ("Borrar mis datos") |

## 2. Registro de consentimientos

| Campo | Detalle |
|---|---|
| Finalidad | Poder demostrar cuándo y cómo se dio, rechazó o retiró un consentimiento, y la aceptación de los términos |
| Interesados | Visitantes que deciden sobre las cookies; personas que usan el formulario de contacto |
| Datos | Identificador seudónimo, decisión, versiones de los documentos, fecha y hora (UTC, del servidor), página, idioma, origen, navegador (agente de usuario), país aproximado, referencia `MA-XXXXXX` del email. **Sin IP** |
| Base jurídica | Obligación legal de demostrar el consentimiento (arts. 6.1.c y 7.1 RGPD) |
| Destinatarios | Cloudflare, Inc. (encargado) |
| Transferencias | Como en el punto 1 |
| Plazo | 3 años desde cada registro; se borra automáticamente (`functions/api/consentimiento.js`) |
| Seguridad | Como en el punto 1; el endpoint solo acepta peticiones desde la propia web y valida cada campo |

## 3. Consultas por email o teléfono

| Campo | Detalle |
|---|---|
| Finalidad | Responder consultas y, si se pide, preparar propuestas |
| Interesados | Personas que escriben o llaman |
| Datos | Los que envíe la persona: nombre, email o teléfono, contenido del mensaje |
| Base jurídica | Medidas precontractuales a petición del interesado (art. 6.1.b) o interés legítimo en responder (art. 6.1.f) |
| Destinatarios | Microsoft (Outlook.com), servicio de correo |
| Transferencias | EE. UU. — Marco de Privacidad de Datos UE-EE. UU. |
| Plazo | Mientras dure la conversación y hasta 1 año después, salvo que se contrate |
| Seguridad | Cuenta de correo con contraseña robusta y verificación en dos pasos (actívala si no la tienes) |

## 4. Clientes (cuando se contrata un servicio)

| Campo | Detalle |
|---|---|
| Finalidad | Prestar el servicio, facturar y cumplir obligaciones fiscales |
| Interesados | Clientes y personas de contacto de los clientes |
| Datos | Identificación, contacto, facturación y los datos del encargo |
| Base jurídica | Ejecución del contrato (art. 6.1.b) y obligación legal (art. 6.1.c) |
| Destinatarios | Agencia Tributaria y, en su caso, gestoría o banco |
| Plazo | El que exijan las leyes fiscales y mercantiles (en general, 4 a 6 años) |
| Seguridad | Documentos en almacenamiento con contraseña; acceso solo del responsable |

> Si en un encargo tratas datos de terceros por cuenta del cliente (por ejemplo, datos de rendimiento
> de sus corredores), tú serás **encargado del tratamiento**: firma con el cliente un contrato de
> encargo (art. 28 RGPD). La AEPD tiene un modelo gratuito en su web.

## 5. Usuarios del panel privado

| Campo | Detalle |
|---|---|
| Finalidad | Dar acceso al panel de gestión de la web y registrar lo que ocurre en él |
| Interesados | Personas con cuenta en el panel (Mario y a quien él dé acceso) |
| Datos | Nombre, email, contraseña (solo su hash con sal), registros de actividad (`logs_sistema`) |
| Base jurídica | Interés legítimo en la seguridad y gestión de la web (art. 6.1.f) |
| Destinatarios | Cloudflare, Inc. (encargado); Google (Gemini) recibe solo los textos de la web que se editan desde el chat del panel |
| Plazo | Mientras la cuenta exista |

---

## Cómo responder si te preguntan

**Una persona pide sus datos o que los borres** (plazo: 1 mes). Pídele, si la tiene, la referencia
`MA-XXXXXX` de su email, o el identificador de su cookie `consentimiento_cookies` (se ve en las
herramientas del navegador). En el panel, pestaña *Base de datos*:

```sql
SELECT * FROM consentimientos WHERE referencia = 'MA-XXXXXX';
SELECT * FROM consentimientos WHERE consentimiento_id = 'identificador';
```

Los datos de analítica de un visitante se borran con su botón "Borrar mis datos". El registro de
consentimientos se conserva (sirve para acreditar el propio consentimiento y su retirada).

**La AEPD pide acreditar el consentimiento de alguien.** Busca por referencia o identificador con las
consultas de arriba y exporta el resultado a CSV desde el panel. Cada fila dice qué se aceptó, la
versión exacta de cada texto (fechas en `src/data/legal.js`), la hora del servidor, la página, el
idioma y el origen (banner, configuración o formulario).

**La AEPD pide este registro.** Envía este documento.
