/**
 * reenvio-responsable-sin-duplicado.test.js — Correo al responsable al asignar una PQRSD:
 * un solo mensaje con trazabilidad + correo original (anexos). Si Gmail lo entrega pero responde con error,
 * no se manda un segundo formato; al responsable nunca le llega el correo original sin trazabilidad.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

/** wrap: 'ok' | 'entregadoConError' | 'falla'; hist: 'ok' | 'falla' */
function montar({ wrap = 'ok', hist = 'ok' } = {}) {
  const enviados = []
  const c = {
    enviados,
    Promise, Math, Date, encodeURIComponent,
    console: { warn: () => {}, info: () => {}, error: () => {} },
    setTimeout: fn => fn(),
    GMAIL_API_BASE: 'https://gmail/v1/users/me',
    notif: () => {},
    getExpById: () => ({ _exp: 'KY1' }),
    gmailGetHeader: () => 'Solicitud',
    pqrsSubjectSinPrefijoRadicado: s => s,
    gmailBuildPqrsReenvioHtml: () => '<p>trazabilidad</p>',
    _gmailGetRawPqrs: async () => ({ raw: 'x' }),
    _buildMimeWrapOriginalBytes: to => ({ to }),
    _gmailSendMimeBytesPqrs: async m => {
      if (wrap === 'falla') throw new Error('400')
      enviados.push({ formato: 'trazabilidad+original', to: m.to })
      if (wrap === 'entregadoConError') throw new TypeError('Failed to fetch')
      return {}
    },
    _gmailCollectMsgAttachmentsForForward: async () => [],
    _buildMimeEmailForwardPqrs: to => 'hist:' + to,
    _reenviarEmailEncodeRawForRecipient: (raw, to) => 'raw:' + to,
    _gmailApiPqrsReenvio: async (method, url, body) => {
      if (method === 'GET') {
        const m = decodeURIComponent(url).match(/to:(\S+)/)
        const ya = m && enviados.some(x => x.to === m[1])
        return ya ? { messages: [{ id: '1' }] } : {}
      }
      const r = String(body.raw)
      if (r.startsWith('hist:')) {
        if (hist === 'falla') throw new Error('413')
        enviados.push({ formato: 'historial+anexos', to: r.slice(5) })
      } else if (r.startsWith('raw:')) {
        enviados.push({ formato: 'original-sin-trazabilidad', to: r.slice(4) })
      }
      return {}
    }
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/gmail.js'), ['_gmailPqrsSinEnvioReciente', 'reenviarEmailRawARecipientes']), c)
  return c
}

const msg = { id: 'm1', payload: { headers: [] } }
const optsResp = { silent: true, verificarEnviados: true, soloConTrazabilidad: true }

describe('Reenvío al responsable: un solo correo con trazabilidad', () => {
  it('caso normal: sale solo el correo con trazabilidad + original', async () => {
    const c = montar()
    expect(await c.reenviarEmailRawARecipientes(msg, ['resp@x.com'], 'KY1', optsResp)).toBe(true)
    expect(c.enviados.map(x => x.formato)).toEqual(['trazabilidad+original'])
  })

  it('Gmail lo entrega pero responde con error: no se manda un segundo correo', async () => {
    const c = montar({ wrap: 'entregadoConError', hist: 'falla' })
    expect(await c.reenviarEmailRawARecipientes(msg, ['resp@x.com'], 'KY1', optsResp)).toBe(true)
    expect(c.enviados.map(x => x.formato)).toEqual(['trazabilidad+original'])
  })

  it('si el primero falla de verdad, va el de historial + anexos (con trazabilidad)', async () => {
    const c = montar({ wrap: 'falla' })
    expect(await c.reenviarEmailRawARecipientes(msg, ['resp@x.com'], 'KY1', optsResp)).toBe(true)
    expect(c.enviados.map(x => x.formato)).toEqual(['historial+anexos'])
  })

  it('al responsable nunca le llega el original sin trazabilidad', async () => {
    const c = montar({ wrap: 'falla', hist: 'falla' })
    expect(await c.reenviarEmailRawARecipientes(msg, ['resp@x.com'], 'KY1', optsResp)).toBe(false)
    expect(c.enviados).toEqual([])
  })

  it('otros flujos (sin las opciones nuevas) conservan su respaldo', async () => {
    const c = montar({ wrap: 'falla', hist: 'falla' })
    expect(await c.reenviarEmailRawARecipientes(msg, ['ofi@x.com'], 'KY1', { silent: true })).toBe(true)
    expect(c.enviados.map(x => x.formato)).toEqual(['original-sin-trazabilidad'])
  })

  it('el flujo de asignación usa las opciones y su último respaldo no repite el reenvío', () => {
    const src = read('js/pqrs.js')
    expect(src).toMatch(/verificarEnviados:true,\s*soloConTrazabilidad:true/)
    expect(src).toContain("_pqrsEnviarNotifAsignacion(e,faltantes,expId,null,{sinReenvioRaw:true})")
    expect(src).toMatch(/if\(!opts\.sinReenvioRaw&&pqrsFueRadicadaPorCorreo\(e\)/)
  })
})
