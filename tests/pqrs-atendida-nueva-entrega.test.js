/**
 * pqrs-atendida-nueva-entrega.test.js — PQRSD ya atendida (WQ260167): una entrega posterior
 * no la devuelve a «Por revisar» ni se fusiona con la respuesta original.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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
  SIN_RESPUESTA: 'sin_respuesta', PENDIENTE_REVISION: 'pendiente_revision_nca', RECHAZADA: 'rechazada',
  POR_FIRMAR: 'por_firmar', REVISION_FINAL: 'revision_final', CERRADA: 'cerrada'
}

function ctx() {
  const c = createContext({ PQRS_WF, JSON })
  runInContext(extraer(core, ['pqrsEstaCerrada', 'getPqrsWorkflow', 'pqrsWorkflowFase', 'pqrsEnRevisionNca', 'dedupePqrsAtencionTasks']), c)
  return c
}

const exp = (fase, cerrada) => ({
  _estado: cerrada ? 'Atendido' : 'En trámite',
  _pqrs_estado_oficina: cerrada ? 'cerrado' : 'nca',
  _pqrs_workflow: JSON.stringify({ fase }),
  tasks: []
})

describe('PQRSD atendida con entrega posterior', () => {
  it('fase pendiente de revisión en PQRSD cerrada cuenta como cerrada (sale de Por revisar)', () => {
    const c = ctx()
    const e = exp(PQRS_WF.PENDIENTE_REVISION, true)
    expect(c.pqrsWorkflowFase(e)).toBe(PQRS_WF.CERRADA)
    expect(c.pqrsEnRevisionNca(e)).toBe(false)
    expect(c.pqrsWorkflowFase(exp(PQRS_WF.RECHAZADA, true))).toBe(PQRS_WF.CERRADA)
  })

  it('PQRSD abierta conserva su fase', () => {
    const c = ctx()
    expect(c.pqrsEnRevisionNca(exp(PQRS_WF.PENDIENTE_REVISION, false))).toBe(true)
    expect(c.pqrsWorkflowFase(exp(PQRS_WF.RECHAZADA, false))).toBe(PQRS_WF.RECHAZADA)
    expect(c.pqrsWorkflowFase(exp(PQRS_WF.REVISION_FINAL, true))).toBe(PQRS_WF.REVISION_FINAL)
  })

  it('no fusiona una nueva «Oficio de respuesta» en una PQRSD atendida', () => {
    const c = ctx()
    const e = exp(PQRS_WF.CERRADA, true)
    e.tasks = [
      { id: 't1', actividad: 'Oficio de respuesta', estado: 'Atendida' },
      { id: 't2', actividad: 'Oficio de respuesta', estado: 'Por verificar' }
    ]
    expect(c.dedupePqrsAtencionTasks(e)).toBe(false)
    expect(e.tasks[1].eliminada).toBeUndefined()
  })
})

function ctxFlujo(e) {
  const c = createContext({
    PQRS_WF, JSON, window: {},
    esPqrsSecretaria: x => !!(x && x.pqrs),
    getExpById: () => e,
    getPqrsAtencionTask: x => (x.tasks || []).find(t => !t.eliminada && /^Oficio de respuesta\b/i.test(t.actividad || '')) || null
  })
  runInContext(extraer(core, [
    'pqrsEstaCerrada', 'taskEsAtenderPqrs', 'taskPqrsActividadPosCierre', 'taskPqrsFlujoPropio',
    'expPqrsBloqueaFlujoTramite', 'taskUsaEntregaPqrsUi', 'libreEntregaPqrsStubExp', 'libreEntregaRespTipoRevision'
  ]) + '\n' + extraer(firma, ['getTaskFirmaWf', 'taskFirmaFase', 'taskEnFlujoFirmaTramite']), c)
  return c
}

describe('Actividad posterior en PQRSD atendida: flujo propio como trámite', () => {
  const t1 = { id: 't1', actividad: 'Oficio de respuesta', estado: 'Atendida', fechaAtendida: '2026-10-06' }
  const t2 = { id: 't2', actividad: '', estado: 'Por verificar', exp: 'WQ260167' }
  const t3 = { id: 't3', actividad: 'Oficio de respuesta', estado: 'En ejecución', exp: 'WQ260167' }
  const e = Object.assign(exp(PQRS_WF.CERRADA, true), {
    pqrs: true, _exp: 'WQ260167', _pqrs_respuesta_oficio: 'OF-1', _pqrs_respuesta_fecha: '2026-09-29', _qd_correo: 'ciudadano@x.co',
    tasks: [t1, t2, t3]
  })

  it('la actividad original sigue en el flujo PQRSD; las posteriores no', () => {
    const c = ctxFlujo(e)
    expect(c.taskPqrsActividadPosCierre(t1, e)).toBe(false)
    expect(c.taskPqrsActividadPosCierre(t2, e)).toBe(true)
    expect(c.taskPqrsActividadPosCierre(t3, e)).toBe(true)
    expect(c.taskEsAtenderPqrs(t1, e)).toBe(true)
    expect(c.taskEsAtenderPqrs(t3, e)).toBe(false)
    expect(c.taskUsaEntregaPqrsUi(t3, e)).toBe(false)
    expect(c.expPqrsBloqueaFlujoTramite(e, t3)).toBe(false)
    expect(c.expPqrsBloqueaFlujoTramite(e, t1)).toBe(true)
  })

  it('PQRSD abierta: todo sigue el flujo PQRSD', () => {
    const eAb = Object.assign({}, e, { _estado: 'En trámite', _pqrs_estado_oficina: 'nca' })
    const c = ctxFlujo(eAb)
    expect(c.taskPqrsActividadPosCierre(t3, eAb)).toBe(false)
    expect(c.taskUsaEntregaPqrsUi(t2, eAb)).toBe(true)
  })

  it('habilita Imprimir/Firmar/Notificar de trámite solo para la actividad posterior', () => {
    const c = ctxFlujo(e)
    expect(c.taskEnFlujoFirmaTramite(Object.assign({}, t3, { firmaWf: { fase: 'por_firmar' } }))).toBe(true)
    expect(c.taskEnFlujoFirmaTramite(Object.assign({}, t1, { exp: 'WQ260167', firmaWf: { fase: 'por_firmar' } }))).toBe(false)
  })

  it('tras atenderse por su propio flujo, la actividad posterior conserva sus documentos', () => {
    const c = ctxFlujo(e)
    const t3Fin = Object.assign({}, t3, { estado: 'Atendida', fechaAtendida: '2026-10-08', firmaWf: { fase: 'cerrada_atendida' } })
    expect(c.taskPqrsActividadPosCierre(t3Fin, e)).toBe(false)
    expect(c.taskPqrsFlujoPropio(t3Fin, e)).toBe(true)
    expect(c.taskPqrsFlujoPropio(t1, e)).toBe(false)
  })

  it('el formulario de entrega no arrastra la respuesta original, pero sí el ciudadano', () => {
    const c = ctxFlujo(e)
    const stub = c.libreEntregaPqrsStubExp(t3, e)
    expect(stub._exp).toBe('WQ260167')
    expect(stub._qd_correo).toBe('ciudadano@x.co')
    expect(stub._pqrs_respuesta_oficio).toBe('')
    expect(stub._pqrs_respuesta_fecha).toBe('')
    expect(JSON.parse(stub._pqrs_workflow).fase).toBe(PQRS_WF.SIN_RESPUESTA)
    expect(stub.tasks).toEqual([])
  })

  it('el encargado ve el tipo reportado en la propia actividad', () => {
    const c = ctxFlujo(e)
    expect(c.libreEntregaRespTipoRevision(Object.assign({}, t3, { entregaResp: { tipo: 'oficio_firmado' } }), e)).toBe('oficio_firmado')
    expect(c.libreEntregaRespTipoRevision(Object.assign({}, t1, { entregaResp: { tipo: 'mensaje' } }), e)).toBe('')
  })
})
