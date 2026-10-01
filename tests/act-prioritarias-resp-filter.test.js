/**
 * act-prioritarias-resp-filter.test.js — Menú Actividades del encargado con un responsable en el selector:
 * la lista de ⚡ Prioritarias incluye la actividad prioritaria que está «por notificar» (como el contador
 * y la paleta del propio responsable), aunque la notificación la tenga designada otra persona.
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

function montar() {
  const e = { _exp: 'EXP-1' }
  const c = {
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    getExpById: () => e,
    getPqrsWorkflow: () => ({}),
    pqrsEsNotificadorDesignado: () => false,
    pqrsEnFaseNotificacion: () => false,
    taskFirmaEnPorNotificar: t => !!t.porNotificar,
    taskUsuarioEsAsignado: (t, n) => (t.responsables || []).includes(n)
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/core.js'), [
    'actividadPerteneceARespFilter', 'actividadNotifEsDeResp', 'actividadVisibleConRespFilter'
  ]), c)
  return c
}

const porNotificarDeOtro = {
  id: 't3', exp: 'EXP-1', prioritaria: true, porNotificar: true,
  responsables: ['Laura'], firmaWf: { notificar_por: 'Pedro' }
}

describe('Prioritarias con responsable en el selector del encargado', () => {
  it('incluye la prioritaria «por notificar» del responsable aunque notifique otro', () => {
    const c = montar()
    expect(c.actividadVisibleConRespFilter(porNotificarDeOtro, 'Laura', 'prior')).toBe(true)
  })

  it('en «Por notificar» sigue siendo solo de quien notifica', () => {
    const c = montar()
    expect(c.actividadVisibleConRespFilter(porNotificarDeOtro, 'Laura', 'pornotif')).toBe(false)
    expect(c.actividadVisibleConRespFilter(porNotificarDeOtro, 'Pedro', 'pornotif')).toBe(true)
  })

  it('no cuela actividades de otros responsables', () => {
    const c = montar()
    expect(c.actividadVisibleConRespFilter({ ...porNotificarDeOtro, responsables: ['Otro'], firmaWf: {} }, 'Laura', 'prior')).toBe(false)
  })
})

describe('Contador ⚡ Prioritarias del encargado (selector = él mismo)', () => {
  function montarEnc() {
    const c = {
      agendaNorm: s => String(s || '').trim().toLowerCase(),
      getExpById: () => ({ _exp: 'EXP-1' }),
      getPqrsWorkflow: () => ({}),
      taskUsuarioEsAsignado: (t, n) => (t.responsables || []).includes(n),
      esNotifAsignadaVencida: () => true,
      actividadPrioritariaOcultarNotifAjenaEnc: () => false,
      esModoResponsable: () => false,
      esVistaActividadesDepto: () => true,
      getEncargadoDepto: () => 'Carlos',
      getActDeptRespFilterSafe: () => 'Carlos',
      deptoActivo: 'guaviare'
    }
    createContext(c)
    runInContext(extraerFunciones(read('js/core.js'), [
      'actividadNotifEsDeResp', 'esNotifAsignadaPrioritariaParaSesion', 'notifVencidaCuentaPrioritaria'
    ]), c)
    return c
  }

  it('no cuenta la notificación vencida que debe hacer otro responsable (no aparece en la lista)', () => {
    const c = montarEnc()
    expect(c.notifVencidaCuentaPrioritaria({ id: 'n1', responsables: ['Laura'], firmaWf: { notificar_por: 'Laura' } })).toBe(false)
    expect(c.notifVencidaCuentaPrioritaria({ id: 'n2', responsables: ['Carlos'], firmaWf: { notificar_por: 'Carlos' } })).toBe(true)
  })

  it('el contador y la lista usan el mismo criterio', () => {
    const src = read('js/core.js')
    expect(src).toContain('const notifVencPrior=(notifAll||[]).filter(notifVencidaCuentaPrioritaria);')
    expect(src).toMatch(/getTareasNotifVisiblesAct\(\):\[\]\)\s*\.filter\(notifVencidaCuentaPrioritaria\)/)
  })
})
