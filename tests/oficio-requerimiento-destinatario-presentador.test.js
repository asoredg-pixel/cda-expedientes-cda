/**
 * oficio-requerimiento-destinatario-presentador.test.js —
 * El Oficio de requerimiento va a quien presentó el concepto, no al profesional
 * que solo lo reenvía al NCA. Entrega directa al NCA: a quien entrega.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entrega = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
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

const norm = s => String(s || '').trim().toLowerCase()

function ctx(activo) {
  const audits = []
  const c = createContext({
    console, JSON, String, Number, Math, Date, Array, Object, isFinite,
    responsableActivo: activo || 'Liliana',
    agendaNorm: norm,
    hoy: () => '2026-11-25',
    genTaskId: () => 'tk_ofi_' + Math.random().toString(36).slice(2, 7),
    calcVenceConUnidad: (h) => h,
    normalizeTask: t => t,
    estadoTask: t => t.estado,
    syncTaskAggregateState: () => {},
    taskComentarioAutor: () => activo || 'Liliana',
    taskEsMultiAsignada: () => false,
    taskEsAtenderPqrs: () => false,
    taskFirmaWfActiva: () => false,
    taskEnFlujoFirmaTramite: () => false,
    logAudit: (m) => audits.push(m),
    audits,
  })
  runInContext(extraer(core, [
    'taskRevisionParCerradaPorRetiro', 'taskRevisionParCtx', 'taskRevisionParNombresDesdeHistorial',
  ]), c)
  runInContext(extraer(entrega, [
    'esActividadOficioRequerimiento', 'destOficioRequerimientoConcepto', 'ensureOficioRequerimientoTask',
  ]), c)
  // Constante usada al crear el oficio
  runInContext('var ACT_OFICIO_REQUERIMIENTO="Oficio de requerimiento";', c)
  return c
}

describe('Oficio de requerimiento: destinatario = presentador del concepto', () => {
  it('con presentadoPor del responsable: el oficio va a Ana aunque entregue Liliana', () => {
    const c = ctx('Liliana')
    const e = { _exp: 'PAF-1', tasks: [] }
    const item = {
      concepto: 'CT-1', tipoConcepto: 'Concepto de seguimiento',
      cumple: 'no', aplicaReq: true, conceptoReqId: 'cr_1',
      presentadoPor: 'Ana', taskId: 't_concepto',
    }
    const tConcepto = {
      id: 't_concepto', actividad: 'Concepto de seguimiento',
      responsable: 'Liliana', estado: 'Por verificar',
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Ana', a: 'Liliana', ts: 1 },
        { tipo: 'traslado', revisionPar: 'correccion', de: 'Ana', a: 'Liliana', ts: 2 },
      ],
    }
    e.tasks.push(tConcepto)
    const ofi = c.ensureOficioRequerimientoTask(e, item, tConcepto)
    expect(ofi).toBeTruthy()
    expect(ofi.responsable).toBe('Ana')
    expect(ofi.responsables).toEqual(['Ana'])
    expect(ofi.actividad).toBe('Oficio de requerimiento')
  })

  it('sin presentadoPor pero con revisión par: usa el técnico del historial', () => {
    const c = ctx('Liliana')
    const tConcepto = {
      id: 't1', actividad: 'Concepto de seguimiento',
      responsable: 'Liliana', estado: 'En ejecución',
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Ana', a: 'Liliana', ts: 1 },
      ],
    }
    const e = { _exp: 'PAF-1', tasks: [tConcepto] }
    const item = { conceptoReqId: 'cr_2', aplicaReq: true, taskId: 't1', concepto: 'CT-2' }
    expect(c.destOficioRequerimientoConcepto(e, item, tConcepto)).toBe('Ana')
    const ofi = c.ensureOficioRequerimientoTask(e, item, tConcepto)
    expect(ofi.responsable).toBe('Ana')
    expect(item.presentadoPor).toBe('Ana')
  })

  it('entrega directa al NCA (sin rev par): va a quien entrega', () => {
    const c = ctx('Liliana')
    const tConcepto = {
      id: 't1', actividad: 'Concepto de seguimiento',
      responsable: 'Liliana', estado: 'Por verificar', historial: [],
    }
    const e = { _exp: 'PAF-1', tasks: [tConcepto] }
    const item = { conceptoReqId: 'cr_3', aplicaReq: true, presentadoPor: 'Liliana', taskId: 't1' }
    const ofi = c.ensureOficioRequerimientoTask(e, item, tConcepto)
    expect(ofi.responsable).toBe('Liliana')
  })

  it('oficio ya creado al profesional pendiente: se realinea al presentador', () => {
    const c = ctx('Liliana')
    const ofiMal = {
      id: 't_ofi', actividad: 'Oficio de requerimiento',
      responsable: 'Liliana', responsables: ['Liliana'],
      asignados: [{ nombre: 'Liliana', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
      estado: 'En ejecución', fechaReportada: '', fechaAtendida: '',
      conceptoReqId: 'cr_4', esOficioRequerimiento: true, historial: [],
    }
    const tConcepto = {
      id: 't1', historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Ana', a: 'Liliana', ts: 1 },
      ],
    }
    const e = { _exp: 'PAF-1', tasks: [tConcepto, ofiMal] }
    const item = { conceptoReqId: 'cr_4', presentadoPor: 'Ana', aplicaReq: true, taskId: 't1' }
    const out = c.ensureOficioRequerimientoTask(e, item, tConcepto)
    expect(out.responsable).toBe('Ana')
    expect(out.historial.some(h => h && h.tipo === 'auto_oficio_requerimiento_realineado')).toBe(true)
  })
})

/**
 * Traslado Liliana→Yesica con reset de entrega no debe crear «revisión par»:
 * al devolver, «Para» = quien entregó (Yesica), no el profesional anterior.
 */
describe('Oficio: chat al devolver apunta a quien entregó', () => {
  function montarOficioEntregado() {
    const task = {
      id: 't_ofi',
      actividad: 'Oficio de requerimiento',
      responsable: 'Yesica',
      responsables: ['Yesica'],
      asignados: [{ nombre: 'Yesica', fechaReportada: '2026-11-26', fechaAtendida: '', estado: 'por_verificar' }],
      estado: 'Por verificar',
      fechaReportada: '2026-11-26',
      comentarios: [],
      historial: [
        { tipo: 'auto_oficio_requerimiento', por: 'Liliana', fecha: '2026-11-26',
          nota: 'Creada automáticamente al registrar concepto que no cumple y aplica requerimiento' },
        { tipo: 'reenvio_verificacion', por: 'Liliana', fecha: '2026-11-26', ts: 1 },
        { tipo: 'traslado', de: 'Liliana', a: 'Yesica', por: 'Carlos', fecha: '2026-11-26', ts: 2 },
        { tipo: 'traslado_entrega_reset', por: 'Carlos', fecha: '2026-11-26', ts: 3,
          nota: 'la entrega anterior queda como anexo; el nuevo responsable debe entregar de nuevo' },
        { tipo: 'reenvio_verificacion', por: 'Yesica', fecha: '2026-11-26', ts: 4 },
      ],
      soportes: [],
      notasDoc: [],
    }
    const c = createContext({
      console, JSON, String, Number, Math, Date, Array, Object, Promise,
      window: { _taskModalCtx: { expId: 'EXP-1' } },
      responsableActivo: '',
      exps: [{ _exp: 'EXP-1', tasks: [task], _depto: 'guaviare' }],
      actividadesLibres: [],
      document: { getElementById: () => null, querySelectorAll: () => [] },
      agendaNorm: norm,
      estadoTask: t => t.estado,
      taskPendienteVerificacion: t => t.estado === 'Por verificar',
      esModoResponsable: () => false,
      esVistaActividadesDepto: () => true,
      taskUsuarioEsAsignado: () => false,
      taskEsAtenderPqrs: () => false,
      taskFirmaWfActiva: () => false,
      taskEnFlujoFirmaTramite: () => false,
      taskEsMultiAsignada: () => false,
      getExpById: () => c.exps[0],
      normalizeTask: t => t,
      getUltimoReportadoPor: t => {
        const h = (t.historial || []).slice().reverse().find(x => x.tipo === 'reenvio_verificacion')
        return h ? (h.reportadoPor || h.por || '') : ''
      },
      getTaskResponsables: t => t.responsables || [t.responsable],
      getAsignado: () => null,
    })
    runInContext(extraer(core, [
      'taskRevisionParCerradaPorRetiro', 'taskRevisionParCtx', 'taskRevisionParNombresDesdeHistorial',
      'taskRevParOriginadorNoProf', 'encargadoPuedeDevolverRevParATecnico',
      'taskChatExpIdDe', 'taskChatResolveDefaultPara', 'getUltimoReportadoPor',
    ]), c)
    c.taskChatRevParOpciones = () => null
    c.taskChatResponsableEscribeEncargado = () => false
    c.taskChatEncargadoEligeDestino = () => true
    c.taskChatTrasladoDestinoSelEnc = () => ''
    c.taskChatTrasladoDestinosEnc = () => []
    c.taskChatPqrsAsigChecked = () => []
    c.taskChatParaOpcionesEncargado = () => ['Yesica', 'Liliana']
    c.taskChatEncargadoDeptoNombre = () => 'Encargado NCA'
    c.task = task
    return c
  }

  it('traslado+reset en Oficio no activa revisión par ni «Para» al profesional anterior', () => {
    const c = montarOficioEntregado()
    expect(c.taskRevisionParCtx(c.task, c.exps[0])).toBe(null)
    expect(c.encargadoPuedeDevolverRevParATecnico(c.task, c.exps[0])).toBe(false)
    expect(c.getUltimoReportadoPor(c.task)).toBe('Yesica')
    expect(c.taskChatResolveDefaultPara(c.task)).toBe('Yesica')
    expect(c.taskChatResolveDefaultPara(c.task)).not.toBe('Liliana')
  })

  it('el mismo traslado+reset en Concepto sí sigue siendo revisión par', () => {
    const c = montarOficioEntregado()
    c.task.actividad = 'Concepto técnico'
    c.task.desc = 'Concepto técnico'
    expect(c.taskRevisionParCtx(c.task, c.exps[0])).toMatchObject({
      tecnico: 'Liliana', profesional: 'Yesica', fase: 'profesional',
    })
    expect(c.encargadoPuedeDevolverRevParATecnico(c.task, c.exps[0])).toBe(true)
  })
})
