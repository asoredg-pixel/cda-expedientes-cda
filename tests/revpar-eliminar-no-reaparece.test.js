/**
 * Tras eliminar desde Por corregir un concepto en revisión par, no debe
 * reaparecer en Por revisar (técnico) ni Por ejecutar (profesional).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function ctxRevPar() {
  const c = createContext({
    window: {},
    agendaNorm: s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' '),
    hoy: () => '2026-11-17',
    estadoTask: t => {
      if (t.eliminada) return 'Eliminada'
      if (t.fechaAtendida || t.estado === 'Atendida') return 'Atendida'
      if (t.estado === 'Por corregir') return 'Por corregir'
      if (t.fechaReportada || t.estado === 'Por verificar') return 'Por verificar'
      return 'En ejecución'
    },
    taskEsMultiAsignada: () => false,
    taskFirmaWfActiva: () => false,
    taskEnFlujoFirmaTramite: () => false,
    taskEsAtenderPqrs: () => false,
    getAsignado: (t, n) => (t.asignados || []).find(a => String(a.nombre).toLowerCase() === String(n).toLowerCase()) || null,
    syncTaskAggregateState: () => {},
    esModoResponsable: () => true,
    responsableActivo: 'TECNICO UNO',
    taskComentarioAutor: () => 'TECNICO UNO',
    normalizeTask: x => x
  })
  runInContext(extraer(core, [
    'taskRevisionParCerradaPorRetiro',
    'taskRevisionParMarcarCancelada',
    'taskRevisionParCtx',
    'taskRevisionParNombresDesdeHistorial',
    'repararRevisionParResponsableSiDesfasado',
    'taskRevParParticipante',
    'taskRevParTecnicoEsperando',
    'taskRevParProfesionalPendiente'
  ]), c)
  return c
}

function taskDevueltaPorCorregir() {
  return {
    id: 't1',
    eliminada: false,
    responsable: 'TECNICO UNO',
    responsables: ['TECNICO UNO'],
    asignados: [{ nombre: 'TECNICO UNO', estado: 'por_corregir', fechaReportada: '', fechaAtendida: '' }],
    estado: 'Por corregir',
    fechaReportada: '',
    historial: [
      { tipo: 'traslado', fecha: '2026-11-10', ts: 1, de: 'TECNICO UNO', a: 'PROFESIONAL DOS', revisionPar: 'solicitud', por: 'TECNICO UNO' },
      { tipo: 'traslado', fecha: '2026-11-11', ts: 2, de: 'PROFESIONAL DOS', a: 'TECNICO UNO', revisionPar: 'devolucion', por: 'PROFESIONAL DOS' },
      { tipo: 'ajuste_soporte', fecha: '2026-11-11', ts: 3, por: 'PROFESIONAL DOS', nota: 'Corregir' }
    ]
  }
}

describe('Revisión par: eliminar no reaparece en bandejas', () => {
  it('cancelada cierra el ctx y saca de Por revisar / Por ejecutar', () => {
    const c = ctxRevPar()
    const t = taskDevueltaPorCorregir()
    expect(c.taskRevisionParCtx(t, null)).toBeTruthy()
    c.taskRevisionParMarcarCancelada(t, { tecnico: 'TECNICO UNO', profesional: 'PROFESIONAL DOS' }, 'retirada')
    t.historial.push({ tipo: 'eliminacion', fecha: '2026-11-17', ts: 9, por: 'TECNICO UNO' })
    t.eliminada = true
    expect(c.taskRevisionParCerradaPorRetiro(t)).toBe(true)
    expect(c.taskRevisionParCtx(t, null)).toBe(null)
    expect(c.repararRevisionParResponsableSiDesfasado(t)).toBe(false)
    expect(c.taskRevParTecnicoEsperando(t, 'TECNICO UNO', null)).toBe(false)
    expect(c.taskRevParProfesionalPendiente(t, 'PROFESIONAL DOS', null)).toBe(false)
  })

  it('eliminar_entrega tras devolución cierra el ciclo aunque no esté eliminada', () => {
    const c = ctxRevPar()
    const t = taskDevueltaPorCorregir()
    t.estado = 'En ejecución'
    t.historial.push({ tipo: 'eliminar_entrega', fecha: '2026-11-17', ts: 9, por: 'TECNICO UNO' })
    expect(c.taskRevisionParCerradaPorRetiro(t)).toBe(true)
    expect(c.taskRevisionParCtx(t, null)).toBe(null)
    expect(c.repararRevisionParResponsableSiDesfasado(t)).toBe(false)
  })

  it('merge: local eliminada+cancelada gana frente a eco remoto con solicitud abierta', () => {
    const c = createContext({
      window: {},
      String, Object, Array, Math, Number, Date,
      normalizeTask: x => Object.assign({}, x),
      faseFlujoFirmaRank: () => 0,
      taskRemotoDevueltoACorregir: () => false,
      taskRevisionParCerradaPorRetiro: t => {
        if (!t) return true
        if (t.eliminada) return true
        return (t.historial || []).some(h => h && (h.revisionPar === 'cancelada' || h.tipo === 'eliminacion' || h.tipo === 'eliminar_entrega'))
      }
    })
    runInContext(extraer(persistence, ['mergeExpedienteTasksLocalRemote']), c)
    const local = [{
      id: 't1',
      eliminada: true,
      estado: 'En ejecución',
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'T', a: 'P', ts: 1 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'P', a: 'T', ts: 2 },
        { tipo: 'traslado', revisionPar: 'cancelada', de: 'T', a: 'T', ts: 3 },
        { tipo: 'eliminacion', ts: 4 }
      ]
    }]
    const remote = [{
      id: 't1',
      eliminada: false,
      estado: 'Por corregir',
      responsable: 'PROFESIONAL DOS',
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'T', a: 'P', ts: 1 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'P', a: 'T', ts: 2 }
      ]
    }]
    const out = c.mergeExpedienteTasksLocalRemote(local, remote)
    expect(out).toHaveLength(1)
    expect(out[0].eliminada).toBe(true)
    expect(out[0].historial.some(h => h.revisionPar === 'cancelada')).toBe(true)
  })

  it('eliminarEntregaActividad soft-deletea autoentrega (no hard-remove)', () => {
    const src = extraer(core, ['eliminarEntregaActividad'])
    expect(src).toContain('soft-delete')
    expect(src).toContain('taskRevisionParMarcarCancelada')
    expect(src).toContain('revisionPar:\'cancelada\'')
    expect(src).not.toMatch(/e\.tasks\s*=\s*Array\.isArray\(e\.tasks\)\s*\?\s*e\.tasks\.filter/)
  })
})
