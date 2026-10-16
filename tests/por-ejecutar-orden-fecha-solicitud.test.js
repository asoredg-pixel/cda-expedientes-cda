/**
 * por-ejecutar-orden-fecha-solicitud.test.js —
 * Tras las fijadas, Por ejecutar ordena por vencimiento desde fecha de solicitud
 * (correo = llegada del mensaje; ventanilla = radicación). Un correo de hace días
 * queda antes que una ventanilla radicada el mismo día, aunque t.vence esté desactualizado.
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
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

const exps = []
function ctx() {
  const c = createContext({
    exps,
    hoy: () => '2026-10-16',
    getExpById: id => exps.find(e => e._exp === id) || null,
    esPqrsSecretaria: e => !!(e && e._es_pqrs),
    taskEsAtenderPqrs: () => true,
    pqrsEnFaseNotificacion: () => false,
    taskFirmaEnPorNotificar: () => false,
    estadoTask: () => 'Por ejecutar',
    taskActividadVencida: t => !!(t.vence && t.vence < '2026-10-16'),
    taskEsPrioridadCriticaVencimiento: () => false,
    getTram: () => ({ plazo: 15 }),
    ensureTramPqrsCfg: () => ({ plazo: 15 }),
    normalizePqrsOficinaFields: e => e,
    calcVenceDesde: (fecha, plazo) => {
      const d = new Date(fecha + 'T00:00:00')
      d.setDate(d.getDate() + Number(plazo))
      return d.toISOString().slice(0, 10)
    },
    diasEntre: () => 15
  })
  runInContext(extraer(core, [
    'getPqrsPlazoDias', 'getPqrsVenceFecha', 'pqrsPlazoTaskMeta',
    'taskVenceEfectivo', 'taskFechaSolicitudSortKey',
    'taskUrgencyBandPorEjecutar', 'sortTasksPorEjecutar'
  ]), c)
  return c
}

describe('Por ejecutar: orden por fecha de solicitud (no solo radicación)', () => {
  it('correo de hace 3 días queda antes que ventanilla radicada ayer (mismo t.vence cacheado)', () => {
    const c = ctx()
    exps.length = 0
    exps.push(
      { _exp: 'NB-VENT', _es_pqrs: true, _fecha: '2026-10-15', _fecha_solicitud: '2026-10-15' },
      { _exp: 'NB-MAIL', _es_pqrs: true, _fecha: '2026-10-15', _fecha_solicitud: '2026-10-13' }
    )
    // Ambos con vence “de radicación” (incorrecto / desactualizado)
    const tasks = [
      { id: '1', exp: 'NB-VENT', vence: '2026-10-30', prioritaria: false, eliminada: false },
      { id: '2', exp: 'NB-MAIL', vence: '2026-10-30', prioritaria: false, eliminada: false }
    ]
    const ordered = c.sortTasksPorEjecutar(tasks)
    expect(ordered.map(t => t.exp)).toEqual(['NB-MAIL', 'NB-VENT'])
    expect(c.taskVenceEfectivo(tasks[1])).toBe(c.getPqrsVenceFecha(exps[1]))
    expect(c.getPqrsVenceFecha(exps[1]) < c.getPqrsVenceFecha(exps[0])).toBe(true)
  })

  it('taskFechaSolicitudSortKey usa _fecha_solicitud del expediente', () => {
    const c = ctx()
    exps.length = 0
    exps.push({ _exp: 'X1', _es_pqrs: true, _fecha: '2026-10-15', _fecha_solicitud: '2026-10-10' })
    expect(c.taskFechaSolicitudSortKey({ exp: 'X1' })).toBe('2026-10-10')
  })
})
