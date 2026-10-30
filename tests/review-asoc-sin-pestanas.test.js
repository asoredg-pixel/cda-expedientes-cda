/**
 * review-asoc-sin-pestanas.test.js — Rail «Asociar» de Ver PQRSD sin pestañas PQRSD / Expediente:
 * NCA asocia lo que elija (el tipo sale del registro); las oficinas solo ven y asocian PQRSD.
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

function montar(allowTramite) {
  const asociados = []
  const body = { innerHTML: '' }
  const lista = [
    { _exp: 'PQ-1', _es_pqrs: true },
    { _exp: 'PQ-2', _es_pqrs: true },
    { _exp: 'EXP-7' }
  ]
  const c = {
    asociados, body,
    exps: lista,
    actividadesLibres: [{ id: 'a1', codigo: 'ACT-1', actividad: 'Visita' }],
    window: { _reviewAsocPanelId: 'task-review-asoc-body', _reviewAsocCtx: { mode: 'pqrs-pick', allowTramite, sourceExp: 'PQ-1', q: '' } },
    document: { getElementById: id => (id === 'task-review-asoc-body' ? body : null) },
    expAsocEsRegistroPqrs: e => !!e._es_pqrs,
    expAsocMatchNum: (a, b) => a === b,
    matchS: () => true,
    matchActLibre: () => true,
    getExpById: id => lista.find(e => e._exp === id) || null,
    escAttr: s => String(s == null ? '' : s),
    notif: () => {},
    puedeCrearExpedienteRegistro: () => true,
    asociarVinculoAPqrs: (src, tgt, modo) => { asociados.push([src, tgt, modo]); return true },
    reviewAsocPickCardHtml: it => '[' + it.id + ']',
    reviewAsocRefrescarEnRevision: () => true
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/consulta.js'), [
    'reviewAsocEsPqrs', 'reviewAsocRank', 'collectReviewAsocCandidatos', 'reviewAsocPuedeCrearExp',
    'reviewAsocConteo', 'reviewAsocVinculadosItems', 'reviewAsocIdsVinculados', 'reviewAsocFijosHtml',
    'reviewAsocListaVisible', 'reviewAsocPintarBadgeRail',
    'renderReviewAsocPickPanel', 'confirmReviewAsocPick'
  ]), c)
  return c
}

describe('Asociar desde Ver PQRSD sin pestañas', () => {
  it('NCA: sin pestañas, ve PQRSD y expedientes, y «➕ Crear expediente»', () => {
    const c = montar(true)
    c.renderReviewAsocPickPanel('task-review-asoc-body')
    const h = c.body.innerHTML
    expect(h).not.toContain('setReviewAsocPqrsModo')
    expect(h).toContain('[PQ-2]')
    expect(h).toContain('[EXP-7]')
    expect(h).toContain('➕ Crear expediente')
  })

  it('NCA: el tipo de asociación sale del registro elegido', () => {
    const c = montar(true)
    c.confirmReviewAsocPick('EXP-7')
    c.confirmReviewAsocPick('PQ-2')
    expect(c.asociados).toEqual([['PQ-1', 'EXP-7', 'tramite'], ['PQ-1', 'PQ-2', 'pqrs']])
  })

  it('oficinas: solo PQRSD (ni expedientes ni actividades) y sin «➕ Crear expediente»', () => {
    const c = montar(false)
    c.window._reviewAsocCtx.q = 'x'
    c.renderReviewAsocPickPanel('task-review-asoc-body')
    const h = c.body.innerHTML
    expect(h).toContain('[PQ-2]')
    expect(h).not.toContain('[EXP-7]')
    expect(h).not.toContain('[ACT-1]')
    expect(h).not.toContain('➕ Crear expediente')
    c.confirmReviewAsocPick('PQ-2')
    expect(c.asociados).toEqual([['PQ-1', 'PQ-2', 'pqrs']])
  })
})

describe('Aviso de asociado visible y permanente', () => {
  it('no se cierra solo y queda por encima de Ver PQRSD', () => {
    const core = read('js/core.js')
    const aviso = extraerFunciones(core, ['avisoVinculoAsociado'])
    expect(aviso).toContain('autoCloseMs:0')
    expect(aviso).toContain('requireAck:true')
    expect(core).toContain('elevateOverlayAboveModals(ov,100200)')
    expect(core).toContain("const okMsg='Quedó asociado a '+target._exp+'.'")
  })

  it('el buscador ofrece Desasociar si el vínculo ya existe', () => {
    const consulta = read('js/consulta.js')
    const c = createContext({
      window: { _reviewAsocCtx: { sourceExp: 'PQ-1', mode: 'pqrs-pick' }, _reviewAsocAviso: null },
      getExpById: () => ({ _usar_exp_asociados: true, _expedientes_asociados: '["EXP-7"]' }),
      getExpAsociadosDirectos: () => ['EXP-7'],
      expAsocMatchNum: (a, b) => String(a) === String(b),
      escAttr: s => String(s == null ? '' : s),
      hl: s => String(s || ''),
      jsStr: s => String(s || ''),
      getTram: () => null,
      getNom: () => 'Persona',
      esPqrsSecretaria: () => false
    })
    runInContext(extraerFunciones(consulta, ['reviewAsocYaVinculado', 'reviewAsocPickCardHtml']), c)
    expect(c.reviewAsocYaVinculado('EXP-7')).toBe(true)
    const html = c.reviewAsocPickCardHtml({ tipo: 'exp', e: { _exp: 'EXP-7' } })
    expect(html).toContain('Desasociar')
    expect(html).toContain('desasociarExpedienteDesdeRevision')
    expect(html).not.toContain('Ya asociado')
    expect(consulta).toContain('id="review-asoc-aviso"')
  })
})

describe('Asociados fijos y contador del rail', () => {
  it('al abrir Asociar el vínculo queda arriba, fuera de la búsqueda', () => {
    const consulta = read('js/consulta.js')
    const body = { innerHTML: '' }
    const lista = [
      { _exp: 'PQ-1', _es_pqrs: true },
      { _exp: 'PQ-2', _es_pqrs: true },
      { _exp: 'EXP-7' }
    ]
    const c = createContext({
      window: { _reviewAsocPanelId: 'task-review-asoc-body', _reviewAsocCtx: { mode: 'pqrs-pick', allowTramite: true, sourceExp: 'PQ-1', q: '' } },
      document: { getElementById: id => (id === 'task-review-asoc-body' ? body : null) },
      exps: lista,
      actividadesLibres: [],
      expAsocEsRegistroPqrs: e => !!e._es_pqrs,
      expAsocMatchNum: (a, b) => a === b,
      matchS: () => true,
      matchActLibre: () => true,
      getExpById: id => lista.find(e => e._exp === id) || null,
      getExpAsociadosAll: e => (e && e._exp === 'PQ-1' ? ['EXP-7'] : []),
      escAttr: s => String(s == null ? '' : s),
      notif: () => {},
      puedeCrearExpedienteRegistro: () => true,
      reviewAsocPickCardHtml: it => '[' + it.id + ']'
    })
    runInContext(extraerFunciones(consulta, [
      'reviewAsocEsPqrs', 'reviewAsocRank', 'collectReviewAsocCandidatos', 'reviewAsocPuedeCrearExp',
      'reviewAsocConteo', 'reviewAsocVinculadosItems', 'reviewAsocIdsVinculados', 'reviewAsocFijosHtml',
      'reviewAsocListaVisible', 'reviewAsocPintarBadgeRail', 'renderReviewAsocPickPanel'
    ]), c)
    c.renderReviewAsocPickPanel('task-review-asoc-body')
    const h = body.innerHTML
    const fijos = h.slice(0, h.indexOf('id="review-asoc-list"'))
    const busqueda = h.slice(h.indexOf('id="review-asoc-list"'))
    expect(fijos).toContain('id="review-asoc-fijos"')
    expect(fijos).toContain('[EXP-7]')
    expect(busqueda).not.toContain('[EXP-7]')
    expect(busqueda).toContain('[PQ-2]')
    expect(c.reviewAsocConteo('PQ-1', null)).toBe(1)
  })

  it('el rail pinta el número como el chat', () => {
    const core = read('js/core.js')
    const c = createContext({
      escAttr: s => String(s == null ? '' : s),
      reviewAsocConteo: () => 2,
      actIcoBadgeHtml: n => '<span class="act-ico-badge">' + n + '</span>'
    })
    runInContext(extraerFunciones(core, ['taskReviewAsocRailBtnHtml']), c)
    const html = c.taskReviewAsocRailBtnHtml('QR260506', 't1', { exp: 'QR260506' }, false)
    expect(html).toContain('data-side="asociar"')
    expect(html).toContain('act-ico-btn')
    expect(html).toContain('act-ico-badge')
    expect(html).toContain('>2<')
  })
})

describe('Desasociar desde el buscador', () => {
  it('quita el número en los dos registros', () => {
    const consulta = read('js/consulta.js')
    const pq = { _exp: 'PQ-1', _usar_exp_asociados: true, _expedientes_asociados: '["CAS-1"]', _pqrs_historial: [] }
    const cas = { _exp: 'CAS-1', _usar_exp_asociados: true, _expedientes_asociados: '["PQ-1"]' }
    const guardados = []
    const win = { _reviewAsocCtx: { sourceExp: 'PQ-1' }, _reviewAsocBusy: false, _reviewAsocAviso: null }
    const c = createContext({
      window: win,
      getExpById: id => (id === 'PQ-1' ? pq : id === 'CAS-1' ? cas : null),
      getExpAsociadosDirectos: e => (!e || !e._usar_exp_asociados ? [] : JSON.parse(e._expedientes_asociados || '[]')),
      getExpAsociadosInversos: () => [],
      expAsocMatchNum: (a, b) => String(a) === String(b),
      esPqrsSecretaria: e => e && e._exp === 'PQ-1',
      hoy: () => '2026-10-30',
      pqrsComentarioAutor: () => 'Ana',
      persistExpedienteGranular: e => { guardados.push(e._exp) },
      avisoVinculoAsociado: () => {},
      notif: () => {},
      reviewAsocRefrescarEnRevision: () => false,
      renderActividades: () => {},
      renderConsulta: () => {},
      document: { getElementById: () => null }
    })
    runInContext(extraerFunciones(consulta, ['quitarNumeroAsociado', 'ajustarFlagAsociados', 'desasociarExpedienteDesdeRevision']), c)
    c.desasociarExpedienteDesdeRevision('CAS-1')
    expect(JSON.parse(pq._expedientes_asociados)).toEqual([])
    expect(JSON.parse(cas._expedientes_asociados)).toEqual([])
    expect(pq._usar_exp_asociados).toBe(false)
    expect(cas._usar_exp_asociados).toBe(false)
    expect(pq._pqrs_historial[0].tipo).toBe('desasociacion')
    expect(guardados).toEqual(['PQ-1', 'CAS-1'])
    expect(win._reviewAsocAviso.msg).toContain('CAS-1')
  })
})
