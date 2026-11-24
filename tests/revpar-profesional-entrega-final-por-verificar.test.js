/**
 * revpar-profesional-entrega-final-por-verificar.test.js —
 * Tras aceptar el concepto (con o sin devoluciones), la entrega firmada del profesional
 * debe ir a Por verificar (encargado NCA), no reenviarse a su propio Por ejecutar.
 * Regresión: soyTecnicoRev no debe usar taskUsuarioEsAsignado en fase profesional.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

const norm = s => String(s || '').trim().toLowerCase()
const archivo = id => ({ driveFileId: id, driveLink: 'https://drive.google.com/file/d/' + id + '/view', nombre: id + '.pdf' })

function montar(task) {
  const avisos = []
  const c = {
    console, JSON, String, Number, Math, Date, Array, Object, Promise,
    avisos, task,
    responsableActivo: '',
    exp: { _exp: 'EXP-1', tasks: [task] },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    notif: (m, t) => avisos.push([m, t]),
    hoy: () => '2026-11-24',
    agendaNorm: norm,
    estadoTask: t => t.estado,
    esModoResponsable: () => true,
    esVistaActividadesDepto: () => false,
    esJurisdiccional: () => false,
    esTareaDelEncargado: () => false,
    taskUsuarioEsAsignado: (t, u) => norm(t.responsable) === norm(u),
    puedeReportarTask: () => true,
    taskEsAtenderPqrs: () => false,
    taskPuedeCorregirSinRevision: () => true,
    puedeGestionarActividadesDepto: () => false,
    getPqrsWorkflow: () => ({}),
    getSoportesUltimaEntrega: () => [],
    getSoporteActivo: () => null,
    getTaskAny: () => c.task,
    getExpById: () => c.exp,
    mutateTask: (ref, id, fn) => { fn(c.task); return true },
    normalizeTask: t => {
      ['comentarios', 'historial', 'soportes'].forEach(k => { if (!Array.isArray(t[k])) t[k] = [] })
      return t
    },
    taskComentarioAutor: () => c.responsableActivo,
    driveDeleteInstitutional: async () => true,
    driveRenombrarSoporteActivoExp: async () => true,
    deptoActivo: 'guaviare',
    getEncargadoDepto: () => 'Jefe',
    getNom: () => 'Titular',
    getTram: () => ({ nombre: 'Concesión' }),
    closeTaskModal: () => {},
    renderActividades: () => {},
    renderBandejaDepto: () => {},
  }
  c.exps = [c.exp]
  c.window = c
  createContext(c)
  runInContext(extraer(read('js/core.js'), [
    'getAsignado', 'ensureAsignado', 'migrateLegacyAsignados', 'taskEsMultiAsignada', 'syncTaskAggregateState',
    'taskRecibidaPorTraslado', 'soporteEsPorCorregir', 'resetTaskPorCorregir', 'taskRevisionParCtx',
    'puedeDevolverAlTecnico', 'devolverAlTecnicoRevisionPar', 'enviarTaskPorVerificar',
    'esAutoentregaResponsable', 'puedeEliminarEntregaActividad',
  ]), c)
  return c
}

function tareaTecnico() {
  return {
    id: 't1', actividad: 'Concepto técnico', responsable: 'Tec', responsables: ['Tec'],
    asignados: [{ nombre: 'Tec', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
    estado: 'En ejecución', autoAsignadaPorResponsable: true, comentarios: [], soportes: [], historial: [],
  }
}

/** Actividad ya en fase profesional (solicitud aceptada / sin devolución). */
function tareaEnProfesional() {
  return {
    id: 't1', actividad: 'Concepto técnico', responsable: 'Prof', responsables: ['Prof'],
    asignados: [{ nombre: 'Prof', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
    estado: 'En ejecución', fechaReportada: '', comentarios: [], soportes: [],
    historial: [{
      tipo: 'traslado', de: 'Tec', a: 'Prof', por: 'Tec',
      revisionPar: 'solicitud', fecha: '2026-11-20',
    }],
  }
}

describe('Entrega final del profesional → Por verificar (encargado)', () => {
  it('sin devoluciones: profesional carga concepto firmado y pasa a Por verificar', () => {
    const c = montar(tareaEnProfesional())
    c.responsableActivo = 'Prof'
    c._taskModalCtx = { revProfesional: '' }
    expect(c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('Firmado')])).toBe(true)
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('Por verificar')
    expect(c.task.fechaReportada).toBeTruthy()
    expect(c.avisos.at(-1)[0]).not.toMatch(/queda en su Por ejecutar/)
  })

  it('tras ciclo devolver/corregir: entrega del profesional no vuelve a su Por ejecutar', () => {
    const c = montar(tareaTecnico())
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: 'Prof' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])
    expect(c.task.estado).toBe('En ejecución')
    expect(c.task.responsable).toBe('Prof')

    c.responsableActivo = 'Prof'
    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Corregir cifra')).toBe(true)
    expect(c.task.estado).toBe('Por corregir')

    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: '' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('B')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')

    c.responsableActivo = 'Prof'
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('C')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('Por verificar')
    expect(String(c.avisos.at(-1)[0] || '')).not.toMatch(/Por ejecutar/)
  })

  it('técnico con nombre desfasado en fase técnico sigue pudiendo reenviar (respaldo asignado)', () => {
    const t = {
      id: 't1', actividad: 'Concepto técnico',
      // Nombre “oficial” distinto al del historial (Tec Histórico)
      responsable: 'Tec Oficial', responsables: ['Tec Oficial'],
      asignados: [{ nombre: 'Tec Oficial', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
      estado: 'Por corregir', comentarios: [], soportes: [],
      historial: [
        { tipo: 'traslado', de: 'Tec Histórico', a: 'Prof', por: 'Tec Histórico', revisionPar: 'solicitud', fecha: '2026-11-20' },
        { tipo: 'traslado', de: 'Prof', a: 'Tec Histórico', por: 'Prof', revisionPar: 'devolucion', fecha: '2026-11-21' },
      ],
    }
    const c = montar(t)
    c.responsableActivo = 'Tec Oficial'
    c._taskModalCtx = { revProfesional: '' }
    expect(c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('Corr')])).toBe(true)
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')
    expect(c.task.historial.at(-1)).toMatchObject({ revisionPar: 'correccion', a: 'Prof' })
  })
})
