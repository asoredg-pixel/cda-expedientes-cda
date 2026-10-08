/**
 * vital-firmado-correo-interna.test.js — VITAL / encargado al cargar el oficio firmado de una PQRSD y
 * «Notificar por correo ahora»: casilla «Traslado / comunicación interna» (sin botón de consulta ciudadana),
 * igual que la del encargado NCA.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

function ctxRender(esPqrs, wf, e) {
  const c = createContext({
    window: { _taskModalCtx: {} },
    jsStr: s => String(s),
    escAttr: s => String(s == null ? '' : s),
    hoy: () => '2026-10-08',
    expPqrsBloqueaFlujoTramite: () => esPqrs,
    atajoFirmadoEnPorRevisar: () => false,
    esDirectorDsDeguv: () => false,
    sstFilePickBlock: () => '<pick>',
    getPqrsWorkflow: () => wf,
    getTaskFirmaWf: () => wf,
    htmlCorreosSugeridosNotificacion: () => '',
    _pqrsOpcionesNotificadorHtml: () => '<select></select>',
    renderAtajoFirmadoDocsAnexosHtml: () => '',
    atajoFirmadoEsVistaOficinaSinResponsables: () => false,
    getExpById: () => e
  })
  runInContext(extraer(tf, ['tramiteFirmaExpCtx', 'renderTaskReviewAtajoFirmadoHtml']) + '\nthis._f=renderTaskReviewAtajoFirmadoHtml;', c)
  return c._f
}

describe('Casilla comunicación interna al cargar firmado y notificar por correo', () => {
  it('PQRSD: aparece en «Notificar por correo ahora»', () => {
    const h = ctxRender(true, {}, { _exp: 'P1' })('P1', 't1', { id: 't1' })
    expect(h).toContain('id="tramite-atajo-notif-interna"')
    expect(h).toContain('sin botón de consulta ciudadana')
    expect(h).not.toContain('id="tramite-atajo-notif-interna" checked')
  })

  it('PQRSD interna (radicada interna o ya marcada): viene marcada', () => {
    expect(ctxRender(true, {}, { _exp: 'P1', _pqrs_interna: true })('P1', 't1', { id: 't1' }))
      .toContain('id="tramite-atajo-notif-interna" checked')
    expect(ctxRender(true, { comunicacion_interna: true }, { _exp: 'P1' })('P1', 't1', { id: 't1' }))
      .toContain('id="tramite-atajo-notif-interna" checked')
  })

  it('trámite con expediente: no aparece', () => {
    const h = ctxRender(false, {}, { _exp: 'E1' })('E1', 't1', { id: 't1' })
    expect(h).not.toContain('tramite-atajo-notif-interna')
  })

  it('actividad sin expediente: aparece (desmarcada por defecto)', () => {
    const h = ctxRender(false, {}, null)('ACT1', 't1', { id: 't1', sinExpediente: true, codigo: 'ACT1' })
    expect(h).toContain('id="tramite-atajo-notif-interna"')
    expect(h).not.toContain('id="tramite-atajo-notif-interna" checked')
  })

  it('correo de trámite / libre: sin bloque de consulta si es interna', () => {
    const c = createContext({
      escAttr: s => String(s == null ? '' : s),
      collectDocsParaNotificacionCorreo: () => [],
      pqrsCorreoHtmlBloqueConsulta: id => '<CONSULTA ' + id + '>',
      pqrsCorreoHtmlPieInstitucional: () => '<PIE>'
    })
    runInContext(extraer(tf, ['tramiteHtmlCuerpoNotifConDocs']) + '\nthis._f=tramiteHtmlCuerpoNotifConDocs;', c)
    const e = { _exp: 'ACT1', _sin_expediente: true }
    expect(c._f(e, { id: 't' }, 'Hola').htmlBody).toContain('<CONSULTA ACT1>')
    const interna = c._f(e, { id: 't' }, 'Hola', { interna: true }).htmlBody
    expect(interna).not.toContain('CONSULTA')
    expect(interna).toContain('<PIE>')
    expect(extraer(tf, ['tramiteAtajoEnviarCorreoDirecto'])).toContain('tramiteHtmlCuerpoNotifConDocs(e,t,cuerpo,{interna:wf.comunicacion_interna===true})')
  })

  it('libre: la marca se guarda en el flujo de la actividad', () => {
    let patch = null
    const els = {
      'tramite-atajo-email-to': { value: 'a@b.co' },
      'tramite-atajo-notif-interna': { checked: true }
    }
    const c = createContext({
      document: { getElementById: id => els[id] || null },
      setTaskFirmaWf: (r, id, p) => { patch = p }
    })
    runInContext(extraer(tf, ['atajoFirmadoPersistEmailFields']) + '\nthis._f=atajoFirmadoPersistEmailFields;', c)
    c._f('ACT1', 't1', false)
    expect(patch).toMatchObject({ comunicacion_interna: true, traslado_interno: true, notif_interna: true })
  })

  it('al guardar los datos del correo PQRSD persiste la marca (marcada y desmarcada)', () => {
    for (const marcado of [true, false]) {
      let patch = null
      const els = {
        'tramite-atajo-email-to': { value: 'a@b.co' },
        'tramite-atajo-email-cuerpo': { value: 'Hola' },
        'tramite-atajo-notif-interna': { checked: marcado }
      }
      const c = createContext({
        document: { getElementById: id => els[id] || null },
        getExpById: () => ({ _exp: 'P1' }),
        setPqrsWorkflow: (e, p) => { patch = p }
      })
      runInContext(extraer(tf, ['atajoFirmadoPersistEmailFields']) + '\nthis._f=atajoFirmadoPersistEmailFields;', c)
      c._f('P1', 't1', true)
      expect(patch).toMatchObject({ comunicacion_interna: marcado, traslado_interno: marcado, notif_interna: marcado })
    }
  })

  it('el envío PQRSD pasa la marca a pqrsCorreoHtmlRespuesta (sin botón si es interna)', () => {
    const f = extraer(tf, ['pqrsAtajoEnviarCorreoDirecto'])
    expect(f).toContain("const optsInt=wf.comunicacion_interna===true?{interna:true,comunicacionInterna:true}:(wf.comunicacion_interna===false?{interna:false}:{});")
    expect(f).toContain('pqrsCorreoHtmlRespuesta(e,cuerpo,docsAdj,optsInt)')
  })
})
