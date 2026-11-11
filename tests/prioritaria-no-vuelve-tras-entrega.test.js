/**
 * Prioritaria entregada a revisión del encargado (o enviada al profesional)
 * no debe seguir/contarse en la paleta ⚡ Prioritarias.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(nombres) {
  return nombres.map(n => {
    const ini = core.search(new RegExp('^function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = core.indexOf('\n', ini)
    while (fin > 0) {
      const code = core.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* aún incompleta */ }
      fin = core.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

describe('⚡ Prioritarias tras entrega a revisión', () => {
  it('Por verificar / pendiente de verificación sale de Prioritarias', () => {
    const c = createContext({
      actividadCuentaComoPorRevisar: t => t.estado === 'Por verificar',
      actividadCuentaComoPorCorregir: () => false,
      taskPendienteVerificacion: t => !!(t.fechaReportada && !t.fechaAtendida),
      esModoResponsable: () => true,
      responsableActivo: 'ANA',
      taskUsuarioEsAsignado: () => true,
      estadoTaskForAsignado: t => t.miEst || '',
      getExpById: () => null,
      taskRevParTecnicoEsperando: () => false,
      actividadPrioritariaVisibleVistaEncargado: () => true,
      esNotifAsignadaPrioritariaParaSesion: () => false,
      taskEsPrioridadCriticaVencimiento: () => false,
      taskPrioridadMarcadoresResueltos: () => false
    })
    runInContext(extraer(['actividadExcluidaDePaletaPrioritaria', 'esActividadPrioritariaPendiente']), c)
    const enRevision = {
      id: 't1', prioritaria: true, estado: 'Por verificar',
      fechaReportada: '2026-11-11', fechaAtendida: '', miEst: 'Por verificar'
    }
    expect(c.actividadExcluidaDePaletaPrioritaria(enRevision)).toBe(true)
    expect(c.esActividadPrioritariaPendiente(enRevision)).toBe(false)
  })

  it('solo con fechaReportada (eco sin estado Por verificar) también se excluye', () => {
    const c = createContext({
      actividadCuentaComoPorRevisar: () => false,
      actividadCuentaComoPorCorregir: () => false,
      taskPendienteVerificacion: t => !!(t.fechaReportada && !t.fechaAtendida),
      esModoResponsable: () => true,
      responsableActivo: 'ANA',
      taskUsuarioEsAsignado: () => true,
      estadoTaskForAsignado: () => 'En ejecución',
      getExpById: () => null,
      taskRevParTecnicoEsperando: () => false,
      actividadPrioritariaVisibleVistaEncargado: () => true,
      esNotifAsignadaPrioritariaParaSesion: () => false,
      taskEsPrioridadCriticaVencimiento: () => false,
      taskPrioridadMarcadoresResueltos: () => false
    })
    runInContext(extraer(['actividadExcluidaDePaletaPrioritaria', 'esActividadPrioritariaPendiente']), c)
    const eco = { id: 't2', prioritaria: true, estado: 'En ejecución', fechaReportada: '2026-11-11', fechaAtendida: '' }
    expect(c.actividadExcluidaDePaletaPrioritaria(eco)).toBe(true)
    expect(c.esActividadPrioritariaPendiente(eco)).toBe(false)
  })

  it('técnico esperando revisión del profesional: sale de Prioritarias', () => {
    const c = createContext({
      actividadCuentaComoPorRevisar: () => false,
      actividadCuentaComoPorCorregir: () => false,
      taskPendienteVerificacion: () => false,
      esModoResponsable: () => true,
      responsableActivo: 'TECNICO',
      taskUsuarioEsAsignado: () => false,
      estadoTaskForAsignado: () => '',
      getExpById: () => ({ _exp: 'X1' }),
      taskRevParTecnicoEsperando: () => true,
      actividadPrioritariaVisibleVistaEncargado: () => true,
      esNotifAsignadaPrioritariaParaSesion: () => false,
      taskEsPrioridadCriticaVencimiento: () => false,
      taskPrioridadMarcadoresResueltos: () => false
    })
    runInContext(extraer(['actividadExcluidaDePaletaPrioritaria', 'esActividadPrioritariaPendiente']), c)
    const t = { id: 't3', prioritaria: true, estado: 'En ejecución', exp: 'X1' }
    expect(c.actividadExcluidaDePaletaPrioritaria(t)).toBe(true)
    expect(c.esActividadPrioritariaPendiente(t)).toBe(false)
  })

  it('prioritaria aún por ejecutar sí cuenta en ⚡', () => {
    const c = createContext({
      actividadCuentaComoPorRevisar: () => false,
      actividadCuentaComoPorCorregir: () => false,
      taskPendienteVerificacion: () => false,
      esModoResponsable: () => true,
      responsableActivo: 'ANA',
      taskUsuarioEsAsignado: () => true,
      estadoTaskForAsignado: () => 'En ejecución',
      getExpById: () => null,
      taskRevParTecnicoEsperando: () => false,
      actividadPrioritariaVisibleVistaEncargado: () => true,
      esNotifAsignadaPrioritariaParaSesion: () => false,
      taskEsPrioridadCriticaVencimiento: () => false,
      taskPrioridadMarcadoresResueltos: () => false
    })
    runInContext(extraer(['actividadExcluidaDePaletaPrioritaria', 'esActividadPrioritariaPendiente']), c)
    const t = { id: 't4', prioritaria: true, estado: 'En ejecución', fechaReportada: '' }
    expect(c.actividadExcluidaDePaletaPrioritaria(t)).toBe(false)
    expect(c.esActividadPrioritariaPendiente(t)).toBe(true)
  })
})
