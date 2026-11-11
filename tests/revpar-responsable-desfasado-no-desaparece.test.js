/**
 * Concepto enviado a profesional: si un eco deja responsable=técnico pero el
 * historial sigue en revisión par, no debe anular el ctx ni desaparecer de bandejas.
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

function makeTask(responsable) {
  return {
    id: 't1',
    eliminada: false,
    responsable,
    responsables: [responsable],
    asignados: [{ nombre: responsable, estado: 'pendiente', fechaReportada: '', fechaAtendida: '' }],
    estado: 'En ejecución',
    fechaReportada: '',
    historial: [{
      tipo: 'traslado', fecha: '2026-11-11', ts: 1,
      de: 'TECNICO UNO', a: 'PROFESIONAL DOS',
      revisionPar: 'solicitud', por: 'TECNICO UNO'
    }]
  }
}

function ctxBase() {
  const c = createContext({
    window: {},
    agendaNorm: s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' '),
    hoy: () => '2026-11-11',
    estadoTask: t => (t.fechaAtendida || t.estado === 'Atendida' ? 'Atendida' : (t.fechaReportada ? 'Por verificar' : 'En ejecución')),
    taskEsMultiAsignada: t => (t.asignados || []).length > 1,
    taskFirmaWfActiva: () => false,
    taskEnFlujoFirmaTramite: () => false,
    taskEsAtenderPqrs: () => false,
    ensureAsignado: (t, n) => {
      let a = (t.asignados || []).find(x => String(x.nombre) === n)
      if (!a) { a = { nombre: n, estado: 'pendiente' }; t.asignados = (t.asignados || []).concat([a]) }
      return a
    },
    getAsignado: (t, n) => (t.asignados || []).find(a => String(a.nombre).toLowerCase() === String(n).toLowerCase()) || null,
    syncTaskAggregateState: t => {
      const a = (t.asignados || [])[0]
      if (a && a.estado === 'pendiente') { t.estado = 'En ejecución'; t.fechaReportada = '' }
      if (a && a.estado === 'por_verificar') { t.estado = 'Por verificar'; t.fechaReportada = a.fechaReportada || t.fechaReportada }
    },
    esModoResponsable: () => true,
    responsableActivo: 'TECNICO UNO',
    normalizeTask: x => x
  })
  runInContext(extraer(core, [
    'taskRevisionParCtx',
    'taskRevisionParNombresDesdeHistorial',
    'repararRevisionParResponsableSiDesfasado',
    'taskRevParParticipante',
    'taskRevParTecnicoEsperando',
    'taskRevParProfesionalPendiente'
  ]), c)
  return c
}

describe('Revisión par: responsable desfasado no desaparece', () => {
  it('ctx sigue vivo aunque responsable quedó en el técnico', () => {
    const c = ctxBase()
    const t = makeTask('TECNICO UNO')
    const ctx = c.taskRevisionParCtx(t, null)
    expect(ctx).toBeTruthy()
    expect(ctx.fase).toBe('profesional')
    expect(ctx.profesional).toBe('PROFESIONAL DOS')
    expect(ctx.tecnico).toBe('TECNICO UNO')
  })

  it('heal realinea al profesional y el técnico sigue «esperando»', () => {
    const c = ctxBase()
    const t = makeTask('TECNICO UNO')
    expect(c.repararRevisionParResponsableSiDesfasado(t)).toBe(true)
    expect(t.responsable).toBe('PROFESIONAL DOS')
    expect(t.asignados[0].nombre).toBe('PROFESIONAL DOS')
    expect(t.asignados[0].estado).toBe('pendiente')
    expect(c.taskRevParTecnicoEsperando(t, 'TECNICO UNO', null)).toBe(true)
    expect(c.taskRevParProfesionalPendiente(t, 'PROFESIONAL DOS', null)).toBe(true)
  })

  it('nombres desde historial no dependen del responsable', () => {
    const c = ctxBase()
    const t = makeTask('TECNICO UNO')
    const n = c.taskRevisionParNombresDesdeHistorial(t)
    expect(n).toEqual({ tecnico: 'TECNICO UNO', profesional: 'PROFESIONAL DOS', fase: 'profesional' })
  })
})
