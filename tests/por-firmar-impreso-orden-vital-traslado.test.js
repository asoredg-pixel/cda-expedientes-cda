/**
 * por-firmar-impreso-orden-vital-traslado.test.js
 * - «Por firmar» (VITAL / encargado): primero lo no marcado 🖨️, las impresas al final.
 * - VITAL en «Por notificar»: 🔄 Trasladar persona a notificar en el rail (como el encargado NCA).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^function ' + n + '\\(', 'm'))
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

function ctxOrden(puedeImprimir, exps) {
  const c = createContext({
    pqrsPuedeFlujoPorImprimir: () => puedeImprimir,
    getExpById: id => exps[id] || null,
    esPqrsSecretaria: e => !!e._pqrs,
    taskEsAtenderPqrs: () => true,
    getPqrsWorkflow: e => e.wf || {},
    getTaskFirmaWf: t => t.firmaWf || {},
    taskFechaEntradaPorFirmaKey: t => t.f
  })
  runInContext(extraer(['sortTasksByFechaEntradaDesc', 'taskPorFirmaImpresoMarcado', 'sortTasksPorFirma']) +
    '\nthis._sort=sortTasksPorFirma;', c)
  return c._sort
}

describe('Por firmar: impresas al final para VITAL / encargado', () => {
  const exps = { P1: { _pqrs: true, wf: { impreso: { en: '2026-10-02T10:00' } } }, P2: { _pqrs: true, wf: {} } }
  const tasks = [
    { id: 'a', exp: 'T1', f: '2026-10-03', firmaWf: { impreso: { en: 'x' } } },
    { id: 'b', exp: 'P1', f: '2026-10-02' },
    { id: 'c', exp: 'T2', f: '2026-10-01', firmaWf: {} },
    { id: 'd', exp: 'P2', f: '2026-09-30' }
  ]

  it('VITAL / encargado: sin imprimir primero (más reciente arriba) y luego las impresas', () => {
    expect(ctxOrden(true, exps)(tasks).map(t => t.id)).toEqual(['c', 'd', 'a', 'b'])
  })

  it('otros roles: solo por fecha', () => {
    expect(ctxOrden(false, exps)(tasks).map(t => t.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('VITAL: trasladar persona a notificar', () => {
  function ctxTraslado(rol) {
    const c = createContext({
      esModoResponsable: () => rol === 'vital',
      esVistaActividadesDepto: () => rol === 'nca',
      esNcaDeguv: () => rol === 'nca',
      esOficinaPqrsNca: () => false,
      esCargoVital: () => rol === 'vital',
      taskEnFaseNotificacionAsignada: () => true
    })
    runInContext(extraer(['actEncargadoNcaGestionPorNotificar', 'puedeTrasladarPersonaNotificarEncargado']) +
      '\nthis._p=puedeTrasladarPersonaNotificarEncargado;', c)
    return c._p
  }

  it('VITAL y encargado NCA pueden; un responsable no', () => {
    expect(ctxTraslado('vital')({}, {})).toBe(true)
    expect(ctxTraslado('nca')({}, {})).toBe(true)
    expect(ctxTraslado('responsable')({}, {})).toBe(false)
  })

  it('el rail de Por notificar muestra 🔄 sin exigir vista del encargado', () => {
    const rail = extraer(['taskReviewRespPorNotificarRailHtml'])
    expect(rail).toContain("if(typeof puedeTrasladarPersonaNotificarEncargado==='function'&&puedeTrasladarPersonaNotificarEncargado(e,t))")
    expect(rail).not.toContain('esEncNca&&typeof puedeTrasladarPersonaNotificarEncargado')
  })
})
