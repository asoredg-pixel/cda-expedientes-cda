/**
 * traslado-interno-adjuntos-correo-origen.test.js — Respuesta por mensaje con «Traslado / comunicación interna»:
 * los adjuntos del correo de radicación no llegaban (se quitaban si pasaban de 800 KB y el envío JSON
 * de Gmail no acepta correos pesados). Ahora se envían como en la asignación (endpoint de carga).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const gm = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* aún incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctxEnvio(rawLen) {
  const llamadas = { json: 0, upload: 0 }
  const c = createContext({
    GMAIL_PQRS_UPLOAD_SEND_MIN_BYTES: 4 * 1024 * 1024,
    GMAIL_API_BASE: 'https://gmail.googleapis.com/gmail/v1/users/me',
    _gmailOfiLoadSignature: async () => {},
    _gmailOfiBuildHtmlMimeWithAttachments: async () => 'A'.repeat(rawLen),
    _gmailRawB64urlToBytes: raw => new Uint8Array(Math.floor(raw.length * 3 / 4)),
    _gmailOfiSendMimeUpload: async () => { llamadas.upload++; return { id: 'u' } },
    _gmailOfiApi: async () => { llamadas.json++; return { id: 'j' } },
    gmailOfiSendMessage: async () => ({ id: 's' })
  })
  runInContext(extraer(gm, ['gmailOfiSendHtmlWithAttachments']), c)
  return { c, llamadas }
}

describe('Envío de oficina con adjuntos', () => {
  it('correo pesado (≥ 4 MB) va por el endpoint de carga', async () => {
    const { c, llamadas } = ctxEnvio(8 * 1024 * 1024)
    await c.gmailOfiSendHtmlWithAttachments('a@b.co', 'Traslado', '<p>x</p>', [{ name: 'anexo.pdf' }])
    expect(llamadas).toEqual({ json: 0, upload: 1 })
  })

  it('correo liviano sigue por messages/send', async () => {
    const { c, llamadas } = ctxEnvio(1000)
    await c.gmailOfiSendHtmlWithAttachments('a@b.co', 'Traslado', '<p>x</p>', [{ name: 'anexo.pdf' }])
    expect(llamadas).toEqual({ json: 1, upload: 0 })
  })

  it('si messages/send falla, reintenta por el endpoint de carga sin quitar adjuntos', async () => {
    const llamadas = { json: 0, upload: 0 }
    const c = createContext({
      GMAIL_PQRS_UPLOAD_SEND_MIN_BYTES: 4 * 1024 * 1024,
      GMAIL_API_BASE: 'https://gmail.googleapis.com/gmail/v1/users/me',
      _gmailOfiLoadSignature: async () => {},
      _gmailOfiBuildHtmlMimeWithAttachments: async () => 'AAAA',
      _gmailRawB64urlToBytes: () => new Uint8Array([1, 2, 3]),
      _gmailOfiSendMimeUpload: async () => { llamadas.upload++; return { id: 'u' } },
      _gmailOfiApi: async () => { llamadas.json++; throw new Error('Failed to fetch') },
      gmailOfiSendMessage: async () => ({ id: 's' })
    })
    runInContext(extraer(gm, ['gmailOfiSendHtmlWithAttachments']), c)
    const r = await c.gmailOfiSendHtmlWithAttachments('a@b.co', 'Traslado', '<p>x</p>', [{ name: 'solicitud.pdf' }])
    expect(r.id).toBe('u')
    expect(llamadas).toEqual({ json: 1, upload: 1 })
  })

  it('la carga usa message/rfc822 en el endpoint upload', () => {
    const fn = extraer(gm, ['_gmailOfiSendMimeUpload'])
    expect(fn).toMatch(/upload\/gmail\/v1\/users\/me\/messages\/send\?uploadType=media/)
    expect(fn).toMatch(/'Content-Type': 'message\/rfc822'/)
  })
})

describe('Entrega directa · traslado interno', () => {
  const fn = extraer(core, ['pqrsEntregaDirectaEnviarCorreoSiAplica'])
  it('ya no quita los adjuntos del correo origen por pasar de 800 KB', () => {
    expect(fn).not.toMatch(/esInterna&&totalLocal>MAX_ATTACH\)/)
    expect(fn).toMatch(/MAX_ATTACH_INTERNA=18\*1024\*1024/)
    expect(fn).toMatch(/if\(esTraslado&&totalLocal>MAX_ATTACH_INTERNA\)/)
  })
  it('avisa si el reintento salió sin adjuntos', () => {
    expect(fn).toMatch(/if\(esTraslado&&adjOmitidos&&typeof notif==='function'\)/)
  })
  it('el traslado interno no reintenta vaciando los adjuntos', () => {
    expect(fn).toMatch(/Reintentando envío con la solicitud y el oficio/)
    expect(fn).not.toMatch(/esInterna&&adjuntos\.length&&\/invalid value\|message\\\.raw\|400\/i\.test\(msg\)\)\{\s*prog\([^)]*sin adjuntos/)
  })
})

describe('Solicitud radicada en el traslado interno', () => {
  const fn = extraer(core, ['pqrsDocsSolicitudRadicada', 'pqrsArchivosSolicitudRadicada', 'pqrsArmarEnvioTrasladoInterno'])
  it('adjunta el PDF o correo que cargó la secretaria y los anexos guardados en Drive', () => {
    expect(fn).toMatch(/_pqrs_solicitud_link/)
    expect(fn).toMatch(/_pqrs_gmail_attachments/)
    expect(fn).toMatch(/pqrsArchivosSolicitudRadicada/)
  })
})
