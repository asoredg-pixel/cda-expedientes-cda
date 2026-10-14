/**
 * encargado-crear-actividad-pqrsd-existente.test.js — Crear actividad › Expediente / PQRSD: al elegir una PQRSD
 * (abierta o atendida) se elige la actividad y a quién se asigna, como en un expediente; la PQRSD nueva
 * asignada puede marcarse prioritaria.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

function ctxPick(exp, opts) {
  opts = opts || {}
  const els = {}
  const el = id => (els[id] = els[id] || { id, style: {}, value: '', innerHTML: '', textContent: '' })
  const llamadas = { notif: [], asignar: 0 }
  const c = createContext({
    window: {},
    document: { getElementById: el },
    getExpById: () => exp,
    pqrsEstaCerrada: e => !!e._cerrada,
    getPqrsOficinaActiva: () => 'guaviare',
    labelOficina: o => o,
    getNom: () => 'ANA',
    getTram: () => null,
    escAttr: s => String(s),
    notif: (m, t) => llamadas.notif.push(m),
    actLibreExpSyncUi: () => {},
    openAsignarPqrsOficinaModal: () => { llamadas.asignar++ },
    closeTaskModal: () => {}
  })
  runInContext(extraer(core, ['actLibreExpPickExistente', 'actLibrePqrsPickExistente']), c)
  return { c, els, llamadas }
}

describe('Encargado: crear actividad sobre una PQRSD existente', () => {
  it('PQRSD abierta: queda seleccionada para elegir actividad (no abre la asignación)', () => {
    const { c, llamadas } = ctxPick({ _exp: 'PQ-10', _pqrs_oficina: 'guaviare' })
    c.actLibrePqrsPickExistente('PQ-10')
    expect(c.window._actLibreExpSel).toEqual({ tipo: 'exp', expId: 'PQ-10' })
    expect(llamadas.asignar).toBe(0)
    expect(llamadas.notif).toEqual([])
  })

  it('PQRSD atendida: también permite crear actividades', () => {
    const { c, els, llamadas } = ctxPick({ _exp: 'PQ-11', _cerrada: true, _pqrs_oficina: '' })
    c.actLibrePqrsPickExistente('PQ-11')
    expect(c.window._actLibreExpSel).toEqual({ tipo: 'exp', expId: 'PQ-11' })
    expect(llamadas.notif).toEqual([])
    expect(els['act-libre-pqrs-hint'].innerHTML).toContain('atendida')
  })

  it('PQRSD abierta de otra oficina sigue bloqueada', () => {
    const { c, llamadas } = ctxPick({ _exp: 'PQ-12', _pqrs_oficina: 'secretaria' })
    c.actLibrePqrsPickExistente('PQ-12')
    expect(c.window._actLibreExpSel).toBeUndefined()
    expect(llamadas.notif[0]).toContain('no se puede asignar desde aquí')
  })

  it('«Atender PQRSD» en PQRSD abierta va a la asignación de la bandeja (sin duplicar tarea)', () => {
    const fn = extraer(core, ['submitCrearActividadEnExpediente'])
    expect(fn).toMatch(/act\.startsWith\('Atender PQRSD'\)\|\|\/\^Oficio de respuesta\\b\/i\.test\(act\)/)
    expect(fn).toContain('openAsignarPqrsOficinaModal(e._exp)')
    expect(fn).toContain('prioritaria:prior')
  })

  it('PQRSD nueva asignada: casilla ⚡ prioritaria aplicada a la tarea', () => {
    expect(extraer(core, ['openCrearActLibreModal'])).toContain('id="act-libre-pqrs-prior"')
    expect(extraer(core, ['actLibrePqrsRespChange'])).toContain("priorLbl.style.display=atender?'none':'flex'")
    expect(extraer(core, ['submitCrearPqrsDesdeActLibre'])).toContain("tAsig.prioritaria=true;e._pqrs_prioritaria=true;")
  })
})
