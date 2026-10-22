/**
 * prioritarias-vital-propias.test.js — ⚡ Prioritarias de VITAL / responsable: solo notificaciones vencidas propias,
 * no las de otros responsables (aunque VITAL las vea en «Por notificar»).
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

function ctx(modoResp, yo) {
  const c = createContext({
    responsableActivo: yo,
    esNotifAsignadaVencida: () => true,
    actividadPrioritariaOcultarNotifAjenaEnc: () => false,
    esModoResponsable: () => modoResp,
    esVistaActividadesDepto: () => false,
    getExpById: () => null,
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    taskUsuarioEsAsignado: (t, u) => (t.responsables || []).some(r => r.toLowerCase() === String(u).toLowerCase())
  })
  runInContext(extraer(['actividadNotifEsDeResp', 'esNotifAsignadaPrioritariaParaSesion']) +
    '\nthis._f=esNotifAsignadaPrioritariaParaSesion;', c)
  return c._f
}

describe('⚡ Prioritarias: notificaciones vencidas solo del propio responsable', () => {
  const ajena = { id: 'a', firmaWf: { notificar_por: 'Marcela Chara' }, responsables: ['Marcela Chara'] }
  const propia = { id: 'p', firmaWf: { notificar_por: 'Usuario Vital' }, responsables: ['Otro'] }
  const asignadaSinNotif = { id: 's', firmaWf: {}, responsables: ['Usuario Vital'] }

  it('VITAL no ve la notificación vencida de otro responsable', () => {
    expect(ctx(true, 'Usuario Vital')(ajena)).toBe(false)
  })

  it('VITAL ve la suya (designado a notificar o asignado)', () => {
    const f = ctx(true, 'Usuario Vital')
    expect(f(propia)).toBe(true)
    expect(f(asignadaSinNotif)).toBe(true)
  })
})

describe('PQRSD con dos oficios del mismo nombre', () => {
  const c = createContext({
    getExpById: () => ({ _exp: 'EA260241' }),
    pqrsEstaCerrada: () => false,
    taskFirmaFase: () => '',
    taskEnPipelineFirmaNotifAbierta: () => true,
    taskPrioridadEntregaResponsableCumplida: () => false,
    estadoTask: t => t.estado || 'En ejecución',
    esModoResponsable: () => true,
    responsableActivo: 'LINA BELTRAN',
    taskUsuarioEsAsignado: () => true,
    estadoTaskForAsignado: () => 'Atendida',
    PQRS_WF: { CERRADA: 'cerrada_atendida' }
  })
  runInContext(extraer(['taskProyeccionYaAprobada', 'taskPrioridadMarcadoresResueltos']), c)

  it('la ya aprobada sale de Prioritarias; la que sigue pendiente no', () => {
    const aprobada = { id: 'of-1', actividad: 'Oficio de respuesta', prioritaria: true, _pqrs_proyeccion_atendida: true, estado: 'Atendida' }
    const pendiente = { id: 'of-2', actividad: 'Oficio de respuesta', prioritaria: true, estado: 'Por verificar' }
    expect(c.taskPrioridadMarcadoresResueltos(aprobada)).toBe(true)
    expect(c.taskPrioridadMarcadoresResueltos(pendiente)).toBe(false)
  })
})
