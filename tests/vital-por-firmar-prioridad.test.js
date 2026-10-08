/**
 * vital-por-firmar-prioridad.test.js — VITAL en «Por firmar»: ⚡ prioritarias → 🔥 urgentes → resto.
 * Otros roles conservan el orden actual (pendientes de imprimir primero, impresas al final, más reciente primero).
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

function ctxSort(vital) {
  const c = createContext({
    esCargoVital: () => vital,
    pqrsPuedeFlujoPorImprimir: () => true,
    taskFechaEntradaPorFirmaKey: t => t.f,
    taskPorFirmaImpresoMarcado: t => !!t.imp,
    taskEsPrioridadCriticaVencimiento: t => !!t.urg
  })
  runInContext(extraer(core, ['sortTasksByFechaEntradaDesc', 'taskUrgencyBandPorRevisar', 'sortTasksPorFirma']) +
    '\nthis._f=sortTasksPorFirma;', c)
  return c._f
}

const lista = [
  { id: 'normal-reciente', exp: 'E1', f: '2026-10-08' },
  { id: 'urgente', exp: 'E2', f: '2026-10-01', urg: true },
  { id: 'prioritaria-impresa', exp: 'E3', f: '2026-10-07', prioritaria: true, imp: true },
  { id: 'normal-vieja', exp: 'E4', f: '2026-09-20' },
  { id: 'prioritaria', exp: 'E5', f: '2026-10-02', prioritaria: true },
  { id: 'prioritaria-y-urgente', exp: 'E6', f: '2026-09-25', prioritaria: true, urg: true }
]

describe('Por firmar — orden para VITAL', () => {
  it('VITAL: prioritarias, luego urgentes, luego el resto (dentro: sin imprimir primero y más reciente)', () => {
    const ids = ctxSort(true)(lista).map(t => t.id)
    expect(ids).toEqual([
      'prioritaria', 'prioritaria-y-urgente', 'prioritaria-impresa',
      'urgente',
      'normal-reciente', 'normal-vieja'
    ])
  })

  it('otros roles: orden actual sin bandas de prioridad', () => {
    const ids = ctxSort(false)(lista).map(t => t.id)
    expect(ids).toEqual([
      'normal-reciente', 'prioritaria', 'urgente', 'prioritaria-y-urgente', 'normal-vieja',
      'prioritaria-impresa'
    ])
  })
})
