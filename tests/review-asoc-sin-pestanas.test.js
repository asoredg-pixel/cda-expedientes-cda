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
    'reviewAsocEsPqrs', 'collectReviewAsocCandidatos', 'reviewAsocPuedeCrearExp',
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
