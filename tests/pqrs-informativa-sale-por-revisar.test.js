/**
 * pqrs-informativa-sale-por-revisar.test.js — Al aprobar una PQRSD informativa (o con notificación
 * por aviso / presencial) la actividad debe quedar ✓ Revisada con todos los participantes atendidos.
 * Antes: finalizarTareasPqrsAlCerrar solo ponía estado='Atendida'; con 2+ responsables el estado se
 * recalcula desde asignados (por_verificar) y seguía en «Por revisar».
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

function ctx(e, wf) {
  const calls = { render: 0, mail: 0 }
  const c = createContext({
    window: {},
    exps: [e],
    PQRS_WF: { CERRADA: 'cerrada_atendida' },
    hoy: () => '2026-10-08',
    responsableActivo: 'Encargado NCA',
    _ncaRevisionDatos: () => ({ cuerpo: '', comentario: '', fecha: '' }),
    getPqrsWorkflow: () => wf,
    setPqrsWorkflow: (ex, p) => Object.assign(wf, p),
    getPqrsTaskActiva: () => e.tasks[0],
    liberarPorCorregirParaAprobacion: () => false,
    _pqrsLimpiarVersionesCorreccionWf: async () => {},
    _pqrsRenombrarDocsDriveWf: async () => {},
    _pqrsLimpiarDocumentosTrasCierre: async () => {},
    _pqrsNotificarCierreCiudadano: () => { calls.mail++ },
    getFechasEstado: () => ({}),
    rebuildHistorial: (ex, h) => h,
    normalizeTask: t => t,
    migrateLegacyAsignados: () => {},
    taskFirmaWfActiva: () => false,
    pqrsComentarioAutor: () => 'Encargado NCA',
    taskComentarioAutor: () => 'Encargado NCA',
    mutateTask: (ref, tid, fn) => { const t = e.tasks.find(x => x.id === tid); if (t) fn(t); return !!t },
    persistExpedienteGranular: () => {},
    closeTaskModal: () => {},
    renderPqrsOficinaInbox: () => {},
    renderSecretariaPqrs: () => {},
    renderActividades: () => { calls.render++ },
    notif: () => {}
  })
  runInContext(extraer(core, [
    'ncaAprobarInformativa', 'ncaAprobarCanalFisico', '_ncaMarcarTaskRevisadaAprobada',
    'finalizarTareasPqrsAlCerrar', 'estadoTaskRaw', 'estadoTask', 'taskEsMultiAsignada', 'taskPendienteVerificacion'
  ]), c)
  c._calls = calls
  return c
}

function expPqrs(actividad) {
  return {
    _exp: 'XX260229',
    tasks: [{
      id: 't1', actividad,
      responsables: ['LINA BELTRAN', 'VITAL'],
      asignados: [
        { nombre: 'LINA BELTRAN', estado: 'por_verificar', fechaReportada: '2026-10-07' },
        { nombre: 'VITAL', estado: 'por_verificar', fechaReportada: '2026-10-07' }
      ],
      fechaReportada: '2026-10-07', estado: 'Por verificar', historial: []
    }]
  }
}

describe('PQRSD informativa: al aprobar sale de Por revisar', () => {
  it('2 responsables: todos los participantes quedan atendidos y la actividad Atendida', async () => {
    const e = expPqrs('Oficio de respuesta')
    const wf = { tipo: 'informativa', cuerpo: 'Se informa que…', task_id: 't1', entregado_por: 'LINA BELTRAN' }
    const c = ctx(e, wf)
    expect(c.estadoTask(e.tasks[0])).toBe('Por verificar')
    await c.ncaAprobarInformativa('XX260229')
    const t = e.tasks[0]
    expect(wf.fase).toBe('cerrada_atendida')
    expect(t.asignados.every(a => a.estado === 'atendido')).toBe(true)
    expect(c.estadoTask(t)).toBe('Atendida')
    expect(c.taskPendienteVerificacion(t)).toBe(false)
    expect(t.ultimaRevisionDepto).toMatchObject({ tipo: 'aprobada', nota: 'Aprobada — respuesta informativa' })
    expect(c._calls.render).toBe(1)
  })

  it('actividad con otro nombre (no «Oficio de respuesta») también se cierra', async () => {
    const e = expPqrs('Respuesta informativa')
    const wf = { tipo: 'informativa', cuerpo: 'Texto', task_id: 't1' }
    const c = ctx(e, wf)
    await c.ncaAprobarInformativa('XX260229')
    expect(c.estadoTask(e.tasks[0])).toBe('Atendida')
  })

  it('sin descripción no aprueba ni toca la actividad', async () => {
    const e = expPqrs('Oficio de respuesta')
    const wf = { tipo: 'informativa', cuerpo: '', task_id: 't1' }
    const c = ctx(e, wf)
    await c.ncaAprobarInformativa('XX260229')
    expect(wf.fase).toBeUndefined()
    expect(c.estadoTask(e.tasks[0])).toBe('Por verificar')
  })
})

describe('Aprobar y cerrar: la lista se refresca cuando termina el cierre asíncrono', () => {
  it('verificarTaskExp vuelve a pintar Actividades tras cerrar el modal (sin keepOpen)', () => {
    const v = extraer(core, ['verificarTaskExp'])
    expect(v).toMatch(/\}else\{\s*closeTaskModal\(\);\s*if\(typeof renderActividades==='function'\)renderActividades\(\);/)
    // keepOpen sigue refrescando como antes
    expect(v).toMatch(/if\(keepOpen&&typeof taskReviewRefreshModal==='function'\)\{\s*taskReviewRefreshModal\(expId,taskId,'decision'\);\s*if\(typeof renderActividades==='function'\)renderActividades\(\);/)
  })
})

describe('PQRSD notificación por aviso / presencial: al aprobar sale de Por revisar', () => {
  it('participantes atendidos, actividad Atendida y aviso al ciudadano', async () => {
    const e = expPqrs('Oficio de respuesta')
    const wf = { tipo: 'mensaje', canal: 'presencial', cuerpo: 'Texto', task_id: 't1' }
    const c = ctx(e, wf)
    await c.ncaAprobarCanalFisico('XX260229')
    const t = e.tasks[0]
    expect(t.asignados.every(a => a.estado === 'atendido')).toBe(true)
    expect(c.estadoTask(t)).toBe('Atendida')
    expect(t.ultimaRevisionDepto.nota).toBe('Aprobada — notificación presencial')
    expect(c._calls.mail).toBe(1)
    expect(c._calls.render).toBe(1)
  })
})
