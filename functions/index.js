/**
 * Callable: pulirCorreoTexto
 * Misma factura Blaze del proyecto cda-tramites (Gemini API vía secret GEMINI_API_KEY).
 * No escribe Firestore. Requiere Auth.
 */
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const MAX_CHARS = 8000;
const GEMINI_MODEL = 'gemini-2.5-flash';

function buildPulirPrompt(texto) {
  return [
    'Eres un corrector de redacción para correos institucionales de una autoridad ambiental colombiana (CDA).',
    'Tarea: mejorar ortografía, gramática y claridad del texto en español.',
    'Reglas estrictas:',
    '- Conserva el sentido, los datos, nombres, números, fechas, radicados y referencias.',
    '- No inventes hechos, plazos, montos ni compromisos nuevos.',
    '- Tono formal, claro y respetuoso (institucional).',
    '- No agregues asunto, firmas, saludos ni despedidas si no estaban en el original (salvo corregir las que ya hay).',
    '- Devuelve SOLO el texto pulido, sin comillas, sin markdown y sin explicaciones.',
    '',
    'Texto a pulir:',
    texto
  ].join('\n');
}

function limpiarRespuestaModelo(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return s;
}

exports.pulirCorreoTexto = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    region: 'us-central1',
    maxInstances: 10
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe iniciar sesión para pulir el texto.');
    }
    const texto = String((request.data && request.data.texto) || '').trim();
    if (!texto) {
      throw new HttpsError('invalid-argument', 'Escriba el cuerpo del correo antes de pulir.');
    }
    if (texto.length > MAX_CHARS) {
      throw new HttpsError('invalid-argument', 'El texto supera el máximo permitido (' + MAX_CHARS + ' caracteres).');
    }

    const key = geminiApiKey.value();
    if (!key) {
      throw new HttpsError('failed-precondition', 'Falta configurar GEMINI_API_KEY en Functions.');
    }

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      GEMINI_MODEL +
      ':generateContent?key=' +
      encodeURIComponent(key);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPulirPrompt(texto) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        })
      });
    } catch (err) {
      throw new HttpsError('unavailable', 'No se pudo contactar el servicio de redacción.');
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (e) { /* ignore */ }
      console.error('Gemini HTTP', res.status, detail.slice(0, 400));
      let msgUsuario = 'El servicio de redacción respondió con error.';
      if (res.status === 402 || /prepayment|credits are depleted|RESOURCE_EXHAUSTED/i.test(detail)) {
        msgUsuario =
          'Sin crédito de Gemini API. En AI Studio (ai.studio/projects) active facturación o recargue crédito del proyecto cda-tramites.';
      } else if (res.status === 404 || /not found|not supported/i.test(detail)) {
        msgUsuario = 'Modelo de redacción no disponible. Contacte al administrador del sistema.';
      } else if (res.status === 403 || /PERMISSION_DENIED|API_KEY/i.test(detail)) {
        msgUsuario = 'La API key de Gemini no tiene permiso. Revise la clave y que Gemini API esté habilitada.';
      }
      throw new HttpsError('internal', msgUsuario);
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new HttpsError('internal', 'Respuesta inválida del servicio de redacción.');
    }

    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;
    const raw = Array.isArray(parts)
      ? parts.map(function (p) { return p && p.text ? p.text : ''; }).join('')
      : '';
    const pulido = limpiarRespuestaModelo(raw);
    if (!pulido) {
      throw new HttpsError('internal', 'No se obtuvo texto pulido. Intente de nuevo.');
    }
    return { pulido: pulido };
  }
);

exports._test = { buildPulirPrompt, limpiarRespuestaModelo, MAX_CHARS };
