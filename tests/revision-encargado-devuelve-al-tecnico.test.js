/**
 * revision-encargado-devuelve-al-tecnico.test.js — Si el profesional envía al encargado un concepto que revisó
 * del técnico y el encargado lo devuelve: va al técnico (chat dirigido a él); el profesional recibe campanita y
 * ve la actividad en Atendidas (documento + observaciones). Al corregir el técnico, el profesional compara versiones.
 */

import { describe, it, expect, beforeEach } from 'vitest'
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

/** Profesional envió a Por verificar un concepto que venía del técnico (última solicitud/corrección). */
function tareaEnPorVerificarProf() {
  return {
    id: 't1', actividad: 'Concepto técnico', responsable: 'Prof', responsables: ['Prof'],
    asignados: [{ nombre: 'Prof', fechaReportada: '2026-10-15', fechaAtendida: '', estado: 'por_verificar' }],
    estado: 'Por verificar', fechaReportada: '2026-10-15', comentarios: [],
    soportes: [{ id: 's1', driveFileId: 'B', activo: true, driveInstitutional: true, label: 'Concepto' }],
    historial: [
      { tipo: 'traslado', de: 'Tec', a: 'Prof', por: 'Tec', revisionPar: 'solicitud', fecha: '2026-10-14' },
      { tipo: 'reenvio_verificacion', por: 'Prof', fecha: '2026-10-15', ts: Date.now() }
    ],
    notasDoc: [{ rol: 'revisor', rondaRevision: 1, texto: 'Ajustar conclusión', autor: 'Encargado' }]
  }
}

function montar(task, opts) {
  opts = opts || {}
  const avisos = []
  const c = createContext({
    console, JSON, String, Number, Math, Date, Array, Object, Promise,
    avisos, task,
    responsableActivo: opts.responsable || '',
    exps: [{ _exp: 'EXP-1', tasks: [task], _depto: 'guaviare' }],
    actividadesLibres: [],
    document: {
      getElementById: id => (id === 'pg-act' ? { classList: { contains: () => false } } : null),
      querySelectorAll: () => []
    },
    notif: (m, t) => avisos.push([m, t]),
    hoy: () => '2026-10-15',
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    estadoTask: t => t.estado,
    taskPendienteVerificacion: t => t.estado === 'Por verificar',
    esModoResponsable: () => !!opts.responsable,
    esVistaActividadesDepto: () => !opts.responsable,
    taskUsuarioEsAsignado: (t, u) => String(t.responsable || '').toLowerCase() === String(u || '').toLowerCase(),
    taskEsAtenderPqrs: () => false,
    taskFirmaWfActiva: () => false,
    taskEnFlujoFirmaTramite: () => false,
    getTaskAny: () => c.task,
    getExpById: () => c.exps[0],
    mutateTask: (ref, id, fn) => { fn(c.task); return true },
    normalizeTask: t => {
      ;['comentarios', 'historial', 'soportes', 'notasDoc', 'asignados'].forEach(k => { if (!Array.isArray(t[k])) t[k] = [] })
      return t
    },
    taskComentarioAutor: () => opts.responsable || 'Encargado NCA',
    getUltimoReportadoPor: t => 'Prof',
    getAsignado: () => null,
    taskEsMultiAsignada: () => false,
    syncTaskAggregateState: t => { t.estado = t.estado },
    driveRenombrarSoporteActivoExp: async () => true,
    closeTaskModal: () => {},
    renderBandejaDepto: () => {},
    renderActividades: () => {},
    taskModalIsReviewOpen: () => false,
    escAttr: s => String(s),
    fmtF: s => s,
    diffDias: () => 0,
    getNom: () => 'Interesado',
    getTram: () => ({ nombre: 'Trámite' }),
    expEstaEnPapelera: () => false,
    retirarRegistroPendienteDeEntrega: () => {},
    resetTaskFirmaWfPorDevolucionCorregir: () => {}
  })
  runInContext(extraer(core, [
    'resetTaskPorCorregir', 'taskRevisionParCtx', 'taskRevParParticipante', 'taskTieneRevisionPar',
    'taskRevParProfesionalEsperaCorreccionNca', 'getTareasRevParProfesionalDevueltaNca',
    'encargadoPuedeDevolverRevParATecnico', 'encargadoDevolverRevParATecnico',
    'taskHistLineaTxt', 'bandejaActFiltroParaTask', 'bandejaItemKey'
  ]), c)
  // Constantes usadas por taskHistLineaTxt
  runInContext('var TASK_HIST_EMOJI={}; var TASK_HIST_DEVOLUCIONES=new Set();', c)
  return c
}

describe('Encargado devuelve concepto vía profesional → técnico', () => {
  it('detecta Por verificar con revisión par (fase profesional)', () => {
    const c = montar(tareaEnPorVerificarProf())
    expect(c.taskRevisionParCtx(c.task, c.exps[0])).toMatchObject({ tecnico: 'Tec', profesional: 'Prof', fase: 'profesional' })
    expect(c.encargadoPuedeDevolverRevParATecnico(c.task, c.exps[0])).toBe(true)
  })

  it('el profesional (modo responsable) no usa este camino — usa «Devolver al técnico»', () => {
    const c = montar(tareaEnPorVerificarProf(), { responsable: 'Prof' })
    expect(c.encargadoPuedeDevolverRevParATecnico(c.task, c.exps[0])).toBe(false)
  })

  it('al devolver: reasigna al técnico, Por corregir, historial devolucion_nca y chat solo para el técnico', () => {
    const c = montar(tareaEnPorVerificarProf())
    expect(c.encargadoDevolverRevParATecnico('EXP-1', 't1', 'Corregir conclusión')).toBe(true)
    expect(c.task.responsable).toBe('Tec')
    expect(c.task.estado).toBe('Por corregir')
    const tr = c.task.historial.filter(h => h.tipo === 'traslado').pop()
    expect(tr).toMatchObject({ revisionPar: 'devolucion_nca', de: 'Prof', a: 'Tec', por: 'Encargado NCA' })
    const cmt = c.task.comentarios[c.task.comentarios.length - 1]
    expect(cmt.para).toBe('Tec')
    expect(cmt.texto).toContain('Devuelta al técnico')
    expect(c.task.soportes[0].activo).toBe(false)
    expect(c.task.soportes[0].driveEstado).toBe('acorregir')
  })

  it('tras devolución_nca el profesional la ve en Atendidas (no el técnico) y el contexto queda fase técnico', () => {
    const c = montar(tareaEnPorVerificarProf())
    c.encargadoDevolverRevParATecnico('EXP-1', 't1', 'Ajuste')
    expect(c.taskRevisionParCtx(c.task, c.exps[0])).toMatchObject({ tecnico: 'Tec', profesional: 'Prof', fase: 'tecnico' })
    c.responsableActivo = 'Prof'
    c.esModoResponsable = () => true
    expect(c.taskRevParProfesionalEsperaCorreccionNca(c.task, 'Prof', c.exps[0])).toBe(true)
    expect(c.taskRevParProfesionalEsperaCorreccionNca(c.task, 'Tec', c.exps[0])).toBe(false)
    const filas = c.getTareasRevParProfesionalDevueltaNca()
    expect(filas).toHaveLength(1)
    expect(filas[0]._revParProfDevNca).toBe(true)
  })

  it('campanita del profesional apunta a Atendidas; clave y filtro done', () => {
    expect(extraer(core, ['bandejaActFiltroParaTask'])).toContain("tipo==='revpar_devolucion_nca'")
    expect(extraer(core, ['bandejaItemKey'])).toContain("revpar_devolucion_nca")
    expect(extraer(core, ['abrirActividadDesdeBandeja'])).toContain("tipo==='revpar_devolucion_nca'")
    const c = montar(tareaEnPorVerificarProf())
    expect(c.bandejaActFiltroParaTask(c.task, { tipo: 'revpar_devolucion_nca' })).toBe('done')
    expect(c.bandejaItemKey({ tipo: 'revpar_devolucion_nca', exp: 'EXP-1', taskId: 't1', fecha: '2026-10-15', hidx: 2 }))
      .toBe('rpdn|EXP-1|t1|2026-10-15|2')
  })

  it('trazabilidad y puntos de enganche del encargado', () => {
    const c = montar(tareaEnPorVerificarProf())
    c.encargadoDevolverRevParATecnico('EXP-1', 't1', 'x')
    const tr = c.task.historial.filter(h => h.revisionPar === 'devolucion_nca')[0]
    expect(c.taskHistLineaTxt(tr)).toContain('Encargado devolvió al técnico')
    expect(extraer(core, ['devolverTaskUnificado'])).toContain('encargadoDevolverRevParATecnico')
    expect(extraer(core, ['devolverTaskAlResponsable'])).toContain('encargadoDevolverRevParATecnico')
    expect(core).toContain('getTareasRevParProfesionalDevueltaNca()')
    expect(core).toContain('collectRevParDevNcaAvisos')
  })

  it('tras corrección del técnico (correccion) el profesional puede comparar (versión NCA queda en historial)', () => {
    const c = montar(tareaEnPorVerificarProf())
    c.encargadoDevolverRevParATecnico('EXP-1', 't1', 'Ajuste')
    // Simula nueva entrega del técnico al profesional
    c.task.responsable = 'Prof'
    c.task.responsables = ['Prof']
    c.task.estado = 'En ejecución'
    c.task.historial.push({ tipo: 'traslado', de: 'Tec', a: 'Prof', por: 'Tec', revisionPar: 'correccion', fecha: '2026-10-16' })
    c.task.soportes.push({ id: 's2', driveFileId: 'C', activo: true, label: 'Corrección' })
    expect(c.taskRevisionParCtx(c.task, c.exps[0]).fase).toBe('profesional')
    expect(c.task.soportes.filter(s => s.driveEstado === 'acorregir' || /por corregir/i.test(s.label || '')).length).toBeGreaterThanOrEqual(1)
    expect(extraer(core, ['taskReviewRespVerRailHtml'])).toContain('revParProfDevNca')
    expect(extraer(core, ['taskRevParCorreccionRecibida'])).toContain("revisionPar==='correccion'")
  })
})
