/**
 * por-revisar-orden-fifo.test.js — Encargado NCA › Por revisar:
 * ⚡ prioritarias → cola por fecha/hora de entrega o notificación (sin 🔥/vencidas).
 * Informes y fijadas se aplican después en renderActividades.
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

function ctxSort() {
  const c = createContext({
    getExpById: () => null,
    getPqrsWorkflow: () => ({}),
    taskEsAtenderPqrs: () => false,
    taskEsPrioridadCriticaVencimiento: () => true // si se usara, no debe alterar Por revisar
  })
  runInContext(
    extraer(core, ['taskFechaEntregaSortKey', 'sortTasksPorRevisar']) +
      '\nthis.sort=sortTasksPorRevisar;\nthis.key=taskFechaEntregaSortKey;',
    c
  )
  return c
}

describe('Por revisar — orden encargado NCA', () => {
  it('prioritarias primero; resto FIFO por ts de entrega (ignora 🔥/vencidas)', () => {
    const c = ctxSort()
    const list = [
      { id: 'urg-vieja', exp: 'E1', historial: [{ tipo: 'reenvio_verificacion', ts: 1000 }] },
      { id: 'prior-nueva', exp: 'E2', prioritaria: true, historial: [{ tipo: 'reenvio_verificacion', ts: 5000 }] },
      { id: 'notif', exp: 'E3', historial: [{ tipo: 'notif_reportada_revision', ts: 3000 }] },
      { id: 'reentrega', exp: 'E4', historial: [
        { tipo: 'reenvio_verificacion', ts: 500 },
        { tipo: 'ajuste_soporte', ts: 2000 },
        { tipo: 'reenvio_verificacion', ts: 4000 }
      ] },
      { id: 'prior-vieja', exp: 'E5', prioritaria: true, historial: [{ tipo: 'reenvio_verificacion', ts: 2000 }] }
    ]
    expect(c.sort(list).map(t => t.id)).toEqual([
      'prior-vieja', 'prior-nueva',
      'urg-vieja', 'notif', 'reentrega'
    ])
  })

  it('notificación y reentrega usan el mismo criterio de cola (última marca)', () => {
    const c = ctxSort()
    expect(c.key({ historial: [{ tipo: 'notif_correo_propuesta', ts: 9000 }] })).toBe(String(9000).padStart(15, '0'))
    expect(c.key({
      historial: [
        { tipo: 'reenvio_verificacion', ts: 100 },
        { tipo: 'reenvio_verificacion', ts: 8000 }
      ]
    })).toBe(String(8000).padStart(15, '0'))
  })

  it('sortTasksPorRevisar ya no usa bandas de urgencia 🔥', () => {
    const fn = extraer(core, ['sortTasksPorRevisar'])
    expect(fn).not.toContain('taskUrgencyBandPorRevisar')
    expect(fn).toContain('prioritaria')
    expect(fn).toContain('taskFechaEntregaSortKey')
  })
})
