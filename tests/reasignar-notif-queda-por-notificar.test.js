/**
 * reasignar-notif-queda-por-notificar.test.js — Tras reportar notificación (revisión final),
 * si el encargado reasigna, debe quedar en Por notificar (no Por ejecutar ni Por revisar).
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

const PQRS_WF = {
  SIN_RESPUESTA: 'sin_respuesta',
  PENDIENTE_REVISION: 'pendiente_revision_nca',
  RECHAZADA: 'rechazada',
  REVISION_FINAL: 'revision_final_nca',
  PENDIENTE_NOTIF: 'pendiente_notificacion',
  LISTA_ENVIO: 'lista_para_envio',
  CERRADA: 'cerrada'
}

function makeExp(fase, extraWf) {
  const wf = Object.assign({
    fase,
    notificar_por: 'CARLOS ANDRES QUINTERO SANTOS',
    notificacion_reportada: {
      fecha: '2026-10-15', por: 'LINA BELTRAN', en: '2026-10-15T23:19:49.820Z',
      soporteLink: 'https://drive.google.com/file/d/x/view'
    },
    documentos: [{ nombre: 'Oficio', driveEstado: 'por_notificar' }]
  }, extraWf || {})
  const t = {
    id: 't1', actividad: 'Oficio de respuesta',
    estado: 'Por verificar', fechaReportada: '2026-10-15',
    _pqrs_notif_en_revision: true,
    responsable: 'LINA BELTRAN',
    responsables: ['LINA BELTRAN'],
    asignados: [{ nombre: 'LINA BELTRAN', estado: 'por_verificar', fechaReportada: '2026-10-15' }],
    historial: [], soportes: []
  }
  return {
    _exp: 'EA260241', _depto: 'guaviare', _pqrs_oficina: 'guaviare',
    _pqrs_workflow: JSON.stringify(wf),
    _pqrs_historial: [],
    tasks: [t]
  }
}

function ctxBase(e) {
  const c = createContext({
    window: {},
    PQRS_WF,
    JSON,
    exps: [e],
    responsableActivo: 'Encargado NCA',
    hoy: () => '2026-10-19',
    agendaNorm: s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' '),
    esPqrsSecretaria: x => !!(x && x._pqrs_workflow),
    getExpById: id => (String(id) === 'EA260241' ? e : null),
    getPqrsWorkflow: (ex) => {
      const w = ex && ex._pqrs_workflow
      return typeof w === 'string' ? JSON.parse(w) : (w || {})
    },
    setPqrsWorkflow: (ex, patch) => {
      const prev = typeof ex._pqrs_workflow === 'string' ? JSON.parse(ex._pqrs_workflow) : (ex._pqrs_workflow || {})
      ex._pqrs_workflow = JSON.stringify(Object.assign({}, prev, patch))
    },
    pqrsWorkflowFase: (ex) => {
      const w = typeof ex._pqrs_workflow === 'string' ? JSON.parse(ex._pqrs_workflow) : (ex._pqrs_workflow || {})
      return w.fase || PQRS_WF.SIN_RESPUESTA
    },
    pqrsEstaCerrada: () => false,
    taskEsAtenderPqrs: () => true,
    getPqrsAtencionTask: (ex) => (ex.tasks || [])[0],
    getPqrsTaskActiva: (ex) => (ex.tasks || [])[0],
    normalizeTask: x => x,
    migrateLegacyAsignados: () => {},
    ensureAsignado: (t, n) => {
      if (!t.asignados) t.asignados = []
      let a = t.asignados.find(x => String(x.nombre) === n)
      if (!a) { a = { nombre: n, estado: 'pendiente' }; t.asignados.push(a) }
      return a
    },
    getTaskResponsables: t => (t.responsables || [t.responsable]).filter(Boolean),
    getAsignado: (t, n) => (t.asignados || []).find(a => String(a.nombre) === n) || null,
    syncTaskAggregateState: () => {},
    taskComentarioAutor: () => 'Encargado NCA',
    pqrsAsegurarPlazoNotificacion: () => '2026-10-24',
    pqrsSincronizarParticipacionPostAprobacion: (ex) => {
      const w = typeof ex._pqrs_workflow === 'string' ? JSON.parse(ex._pqrs_workflow) : ex._pqrs_workflow
      const t = (ex.tasks || [])[0]
      const np = String(w.notificar_por || '')
      ;(t.asignados || []).forEach(a => {
        if (!a) return
        if (String(a.nombre) === np) {
          a.estado = 'pendiente'
          a.fechaAtendida = ''
        } else {
          a.estado = 'atendido'
          a.fechaAtendida = a.fechaAtendida || '2026-10-15'
        }
      })
    },
    persistExpedienteGranular: () => {},
    taskFirmaEnRevisionFinalNotif: () => false,
    taskFirmaEnPorNotificar: () => false,
    estadoTask: t => t.estado || 'En ejecución',
    mutateTask: (expId, taskId, fn) => {
      const t = e.tasks[0]
      fn(t)
      return true
    },
    taskEsMultiAsignada: () => false,
    taskNotifSyncDesdeCambioResponsables: () => false,
    resetEntregaAlReasignarTask: (t) => {
      t.estado = 'En ejecución'
      t.fechaReportada = ''
      return t
    }
  })
  runInContext(extraer(core, [
    'pqrsEsContextoReasignacionNotificacion',
    'pqrsReasignarMantenerPorNotificar',
    'pqrsRepararNotifHuerfanaTrasReasignacion',
    'resetPqrsWorkflowTrasReasignar',
    'trasladarTaskExp'
  ]), c)
  return c
}

describe('Reasignar notificación → Por notificar', () => {
  it('contexto: revisión final / notificación reportada / huérfana', () => {
    const e = makeExp(PQRS_WF.REVISION_FINAL)
    const c = ctxBase(e)
    expect(c.pqrsEsContextoReasignacionNotificacion(e, e.tasks[0])).toBe(true)
    const e2 = makeExp(PQRS_WF.SIN_RESPUESTA)
    expect(c.pqrsEsContextoReasignacionNotificacion(e2, e2.tasks[0])).toBe(true)
    const e3 = makeExp(PQRS_WF.PENDIENTE_REVISION, { notificacion_reportada: null })
    e3.tasks[0]._pqrs_notif_en_revision = false
    expect(c.pqrsEsContextoReasignacionNotificacion(e3, e3.tasks[0])).toBe(false)
  })

  it('reasignar en revisión final deja fase Por notificar y limpia notificacion_reportada', () => {
    const e = makeExp(PQRS_WF.REVISION_FINAL)
    const c = ctxBase(e)
    const ok = c.pqrsReasignarMantenerPorNotificar(e, e.tasks[0], 'LINA BELTRAN', { de: 'CARLOS ANDRES QUINTERO SANTOS' })
    expect(ok).toBe(true)
    const wf = JSON.parse(e._pqrs_workflow)
    expect(wf.fase).toBe(PQRS_WF.PENDIENTE_NOTIF)
    expect(wf.notificacion_reportada).toBe(null)
    expect(wf.notificar_por).toBe('LINA BELTRAN')
    expect(e.tasks[0]._pqrs_notif_en_revision).toBe(false)
    expect(e.tasks[0].fechaReportada).toBe('')
    expect(wf.fase).not.toBe(PQRS_WF.SIN_RESPUESTA)
  })

  it('trasladarTaskExp en revisión final no llama reset a sin_respuesta', () => {
    const e = makeExp(PQRS_WF.REVISION_FINAL)
    const c = ctxBase(e)
    let resetEntrega = 0
    c.resetEntregaAlReasignarTask = (t) => { resetEntrega++; t.estado = 'En ejecución'; return t }
    c.trasladarTaskExp('EA260241', 't1', 'LINA BELTRAN')
    const wf = JSON.parse(e._pqrs_workflow)
    expect(resetEntrega).toBe(0)
    expect(wf.fase).toBe(PQRS_WF.PENDIENTE_NOTIF)
    expect(wf.notificacion_reportada).toBe(null)
  })

  it('repara huérfano sin_respuesta + notificacion_reportada → Por notificar', () => {
    const e = makeExp(PQRS_WF.SIN_RESPUESTA)
    e.tasks[0].estado = 'Vencida'
    e.tasks[0].fechaReportada = ''
    const c = ctxBase(e)
    expect(c.pqrsRepararNotifHuerfanaTrasReasignacion(e)).toBe(true)
    const wf = JSON.parse(e._pqrs_workflow)
    expect(wf.fase).toBe(PQRS_WF.PENDIENTE_NOTIF)
    expect(wf.notificacion_reportada).toBe(null)
  })

  it('resetPqrsWorkflowTrasReasignar no corre si hay notificación reportada', () => {
    const e = makeExp(PQRS_WF.PENDIENTE_REVISION)
    const c = ctxBase(e)
    expect(c.resetPqrsWorkflowTrasReasignar(e)).toBe(false)
    expect(JSON.parse(e._pqrs_workflow).fase).toBe(PQRS_WF.PENDIENTE_REVISION)
  })
})
