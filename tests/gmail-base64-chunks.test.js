/**
 * gmail-base64-chunks.test.js — el raw base64url de correos grandes (adjuntos) no debe llevar '=' intermedios.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

function extraer(nombre) {
  const ini = src.search(new RegExp('^function ' + nombre + '\\(', 'm'))
  if (ini < 0) throw new Error('No se encontró ' + nombre)
  let fin = src.indexOf('\n', ini)
  while (fin > 0) {
    const code = src.slice(ini, fin)
    try { new Script(code); return code } catch (e) { /* aún incompleta */ }
    fin = src.indexOf('\n', fin + 1)
  }
  throw new Error('No se pudo delimitar ' + nombre)
}

const ctx = createContext({ TextEncoder, btoa, console })
runInContext(extraer('_gmailOfiMimeToRawB64') + '\n' + extraer('_gmailBytesToB64url') +
  '\nthis._raw=_gmailOfiMimeToRawB64;this._bytes=_gmailBytesToB64url;', ctx)

function decodificar(b64url) {
  return Buffer.from(b64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

describe('Gmail OFI: base64url por bloques', () => {
  const mime = 'To: ciudadano@correo.com\r\nSubject: Notificación\r\n\r\n' + 'Línea de anexo ñ 123\r\n'.repeat(20000)

  it('MIME > 32 KB: sin "=" intermedio y decodifica igual', () => {
    const raw = ctx._raw(mime)
    expect(raw).not.toMatch(/=/)
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodificar(raw)).toBe(mime)
  })

  it('bytes > 32 KB: sin "=" intermedio', () => {
    const bytes = new TextEncoder().encode(mime)
    const raw = ctx._bytes(bytes)
    expect(raw.replace(/=+$/, '')).not.toMatch(/=/)
    expect(decodificar(raw)).toBe(mime)
  })

  it('todos los bloques de btoa son múltiplo de 3', () => {
    const tam = [...src.matchAll(/CHUNK = (0x[0-9a-f]+);/gi)].map(m => parseInt(m[1], 16))
    expect(tam.length).toBeGreaterThan(0)
    tam.forEach(n => expect(n % 3).toBe(0))
  })
})
