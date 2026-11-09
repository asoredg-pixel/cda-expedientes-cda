/**
 * Tras aprobar revisión final de notificación, un eco Firestore viejo
 * (workflow string aún en pendiente_notificacion) no debe reabrir Por notificar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
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

describe('Cierre notificación: no reabre Por notificar', () => {
  it('expedienteFaseFlujo lee _pqrs_workflow JSON string (cerrada_atendida)', () => {
    const c = createContext({ window: {}, JSON, String, Object, Array })
    runInContext(extraer(persistence, ['faseFlujoFirmaRank', 'expedienteFaseFlujo', 'expedienteFlujoNoDebeRetroceder']), c)
    const cerrado = {
      _pqrs_workflow: JSON.stringify({ fase: 'cerrada_atendida' }),
      tasks: [{ id: 't1', firmaWf: { fase: 'pendiente_notificacion' } }]
    }
    const viejo = {
      _pqrs_workflow: JSON.stringify({ fase: 'pendiente_notificacion' }),
      tasks: [{ id: 't1', firmaWf: { fase: 'pendiente_notificacion' } }]
    }
    expect(c.expedienteFaseFlujo(cerrado)).toBe('cerrada_atendida')
    expect(c.faseFlujoFirmaRank(c.expedienteFaseFlujo(cerrado))).toBe(10)
    expect(c.expedienteFlujoNoDebeRetroceder(cerrado, viejo)).toBe(true)
    expect(c.expedienteFlujoNoDebeRetroceder(viejo, cerrado)).toBe(false)
  })

  it('finalizarTareasPqrsAlCerrar deja asignados (notificador) en atendido', () => {
    const t = {
      id: 't1',
      actividad: 'Oficio de respuesta PQRSD',
      estado: 'Por verificar',
      fechaReportada: '2026-11-08',
      _pqrs_notif_en_revision: true,
      responsables: ['LINA', 'CARLOS'],
      asignados: [
        { nombre: 'LINA', estado: 'atendido', fechaReportada: '2026-11-01', fechaAtendida: '2026-11-01' },
        { nombre: 'CARLOS', estado: 'por_verificar', fechaReportada: '2026-11-08', fechaAtendida: '' }
      ],
      historial: []
    }
    const e = { tasks: [t] }
    const c = createContext({
      window: {},
      hoy: () => '2026-11-09',
      normalizeTask: x => x,
      migrateLegacyAsignados: () => {},
      taskEsMultiAsignada: tk => (tk.asignados || []).length > 1,
      estadoTask: tk => {
        const asig = tk.asignados || []
        if (asig.length > 1 && asig.some(a => a && a.estado === 'por_verificar')) return 'Por verificar'
        if (asig.length && asig.every(a => a && a.estado === 'atendido')) return 'Atendida'
        return tk.estado || 'En ejecución'
      },
      syncTaskAggregateState: tk => {
        const asig = tk.asignados || []
        if (asig.length && asig.every(a => a && a.estado === 'atendido')) {
          tk.estado = 'Atendida'
          tk.fechaAtendida = asig.map(a => a.fechaAtendida).filter(Boolean).sort().pop() || tk.fechaAtendida
        }
      },
      pqrsComentarioAutor: () => 'NCA'
    })
    runInContext(extraer(core, ['finalizarTareasPqrsAlCerrar']), c)
    c.finalizarTareasPqrsAlCerrar(e, 'PQRSD cerrada — notificación aprobada')
    expect(t.asignados.every(a => a.estado === 'atendido')).toBe(true)
    expect(t.asignados[1].fechaAtendida).toBeTruthy()
    expect(t.estado).toBe('Atendida')
    expect(t._pqrs_notif_en_revision).toBe(false)
    expect(c.estadoTask(t)).toBe('Atendida')
  })

  it('merge de tasks: revisión final / cerrada local no pierde frente a eco por notificar', () => {
    const c = createContext({
      window: {}, JSON, String, Object, Array,
      normalizeTask: x => Object.assign({}, x)
    })
    runInContext(extraer(persistence, [
      'faseFlujoFirmaRank', 'taskRemotoDevueltoACorregir', 'mergeExpedienteTasksLocalRemote'
    ]), c)
    const localRev = [{
      id: 't1',
      estado: 'Por verificar',
      fechaReportada: '2026-11-09',
      firmaWf: { fase: 'revision_final_nca', notificacion_reportada: { por: 'CARLOS' } },
      historial: [{ tipo: 'notif_reportada_revision' }]
    }]
    const remotePend = [{
      id: 't1',
      estado: 'En ejecución',
      firmaWf: { fase: 'pendiente_notificacion' },
      historial: [{ tipo: 'firma_wf' }, { tipo: 'firma_wf' }, { tipo: 'firma_wf' }]
    }]
    const merged = c.mergeExpedienteTasksLocalRemote(localRev, remotePend)
    expect(merged).toHaveLength(1)
    expect(merged[0].firmaWf.fase).toBe('revision_final_nca')
    expect(merged[0].firmaWf.notificacion_reportada).toBeTruthy()

    const localCerrada = [{
      id: 't1',
      estado: 'Atendida',
      fechaAtendida: '2026-11-09',
      firmaWf: { fase: 'cerrada_atendida' },
      historial: [{ tipo: 'verificacion' }]
    }]
    const merged2 = c.mergeExpedienteTasksLocalRemote(localCerrada, remotePend)
    expect(merged2[0].firmaWf.fase).toBe('cerrada_atendida')
    expect(merged2[0].estado).toBe('Atendida')
  })

  it('heal huérfana no reabre si la PQRSD ya está cerrada', () => {
    const e = {
      _estado: 'Atendido',
      _pqrs_estado_oficina: 'cerrado',
      _pqrs_workflow: JSON.stringify({
        fase: 'sin_respuesta',
        notificar_por: 'CARLOS',
        notificacion_reportada: { fecha: '2026-11-08', por: 'CARLOS' }
      }),
      tasks: [{ id: 't1', actividad: 'Oficio de respuesta', eliminada: false }]
    }
    const c = createContext({
      window: {},
      PQRS_WF: {
        SIN_RESPUESTA: 'sin_respuesta',
        PENDIENTE_NOTIF: 'pendiente_notificacion',
        CERRADA: 'cerrada_atendida'
      },
      JSON,
      pqrsEstaCerrada: ex => !!(ex && (ex._pqrs_estado_oficina === 'cerrado' || ex._estado === 'Atendido')),
      getPqrsWorkflow: ex => JSON.parse(ex._pqrs_workflow),
      setPqrsWorkflow: () => { throw new Error('no debe reabrir') },
      getPqrsAtencionTask: () => e.tasks[0],
      taskEsAtenderPqrs: () => true,
      pqrsReasignarMantenerPorNotificar: () => true,
      persistExpedienteGranular: () => {}
    })
    runInContext(extraer(core, ['pqrsRepararNotifHuerfanaTrasReasignacion']), c)
    expect(c.pqrsRepararNotifHuerfanaTrasReasignacion(e)).toBe(false)
  })
})
