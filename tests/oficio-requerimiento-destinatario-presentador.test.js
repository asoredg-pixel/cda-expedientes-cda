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
