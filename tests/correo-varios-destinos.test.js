/**
 * correo-varios-destinos.test.js — Notificar por correo con dos o más correos en «Para»:
 * el correo escrito sin Enter/coma debe llegar al envío y un fallo parcial no debe callarse.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'
import { Window } from 'happy-dom'

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

function ctxDom() {
  const win = new Window()
  const ctx = {
    console, setTimeout, clearTimeout, Promise, JSON, String, Date,
    document: win.document, Event: win.Event, win,
  }
  ctx.window = ctx
  createContext(ctx)
  return ctx
}

function montarPara(ctx, valorInicial) {
  runInContext(extraerFunciones(read('js/utils.js'),
    ['sstParseEmailList', 'sstEmailLooksValid', 'sstEmailChipsIsMultiId', 'sstEmailChipsShouldMount', 'sstEmailChipsMaxFor',
      'sstMountEmailChips', 'sstEmailChipsConfirmarPendientes']), ctx)
  ctx.document.body.innerHTML = '<div><input type="text" id="tramite-atajo-email-to" class="sst-email-chips" value="' + valorInicial + '"></div>' +
    '<div><input type="text" id="tramite-atajo-email-cc" class="sst-email-chips" value=""></div>'
  ctx.sstMountEmailChips(ctx.document.getElementById('tramite-atajo-email-to'))
  ctx.sstMountEmailChips(ctx.document.getElementById('tramite-atajo-email-cc'))
  const edit = id => ctx.document.getElementById(id).closest('.email-chips').querySelector('.email-chips-edit')
  return { hidden: ctx.document.getElementById('tramite-atajo-email-to'), edit }
}

describe('Campo «Para» con chips', () => {
  it('segundo correo escrito sin Enter: al salir del campo queda en el valor de inmediato (antes del clic en Notificar)', () => {
    const ctx = ctxDom()
    const { hidden, edit } = montarPara(ctx, 'uno@correo.com')
    const ed = edit('tramite-atajo-email-to')
    ed.value = 'dos@correo.com'
    ed.dispatchEvent(new ctx.win.Event('blur'))
    expect(hidden.value).toBe('uno@correo.com, dos@correo.com')
  })

  it('sstEmailChipsConfirmarPendientes confirma el texto pendiente aunque no haya blur', () => {
    const ctx = ctxDom()
    const { hidden, edit } = montarPara(ctx, 'uno@correo.com')
    edit('tramite-atajo-email-to').value = 'dos@correo.com'
    const malo = ctx.sstEmailChipsConfirmarPendientes(['tramite-atajo-email-to', 'tramite-atajo-email-cc', 'tramite-atajo-email-bcc'])
    expect(malo).toBe('')
    expect(hidden.value).toBe('uno@correo.com, dos@correo.com')
  })

  it('correo mal escrito: se detiene el envío indicando el campo', () => {
    const ctx = ctxDom()
    const { hidden, edit } = montarPara(ctx, 'uno@correo.com')
    edit('tramite-atajo-email-cc').value = 'dos@correo'
    const malo = ctx.sstEmailChipsConfirmarPendientes(['tramite-atajo-email-to', 'tramite-atajo-email-cc'])
    expect(malo).toBe('Cc: «dos@correo»')
    expect(hidden.value).toBe('uno@correo.com')
  })
})

describe('pqrsEnviarCorreoCiudadano con varios destinatarios', () => {
  function ctxEnvio(fallasPorCorreo) {
    const ctx = ctxDom()
    const enviados = []
    const intentos = {}
    Object.assign(ctx, {
      deptoActivo: 'guaviare',
      notif: () => {},
      gmailOfiAsegurarCuentaOficinaParaEnvio: async () => {},
      gmailOfiIsTokenValid: () => true,
      gmailOfiCuentaConectadaParaEnvio: () => 'nca@cda.gov.co',
      gmailOfiSendMessage: async (para) => {
        intentos[para] = (intentos[para] || 0) + 1
        if (intentos[para] <= (fallasPorCorreo[para] || 0)) throw new Error('Failed to fetch')
        enviados.push(para)
        return { id: 'msg-' + para }
      },
    })
    runInContext(extraerFunciones(read('js/core.js'), ['pqrsEnviarCorreoCiudadano', 'pqrsAvisoCorreoNoEnviado']), ctx)
    return { ctx, enviados }
  }

  it('fallo pasajero en el segundo: se reintenta y llega a ambos', async () => {
    const { ctx, enviados } = ctxEnvio({ 'dos@correo.com': 1 })
    const r = await ctx.pqrsEnviarCorreoCiudadano(['uno@correo.com', 'dos@correo.com'], 'Asunto', '<p>x</p>', true, [], {})
    expect(enviados).toEqual(['uno@correo.com', 'dos@correo.com'])
    expect(r.fallidos).toBeUndefined()
    expect(ctx.document.querySelector('.ntf')).toBeNull()
  }, 5000)

  it('fallo persistente en el segundo: no se calla, avisa y marca fallidos', async () => {
    const { ctx, enviados } = ctxEnvio({ 'dos@correo.com': 9 })
    const r = await ctx.pqrsEnviarCorreoCiudadano(['uno@correo.com', 'dos@correo.com'], 'Asunto', '<p>x</p>', true, [], {})
    expect(enviados).toEqual(['uno@correo.com'])
    expect(r.messageId).toBe('msg-uno@correo.com')
    expect(r.fallidos).toEqual(['dos@correo.com'])
    expect(ctx.document.querySelector('.ntf').textContent).toContain('NO se envió a: dos@correo.com')
  }, 5000)

  it('si fallan todos, lanza error (el flujo no marca como notificado)', async () => {
    const { ctx } = ctxEnvio({ 'uno@correo.com': 9 })
    await expect(ctx.pqrsEnviarCorreoCiudadano(['uno@correo.com'], 'A', '<p>x</p>', true, [], {})).rejects.toThrow('uno@correo.com')
  })
})
