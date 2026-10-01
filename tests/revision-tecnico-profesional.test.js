/**
 * revision-tecnico-profesional.test.js — El encargado traslada una entrega del técnico al profesional;
 * el profesional devuelve al técnico (Por corregir) x veces, la corrección vuelve al profesional
 * (Por ejecutar) y la entrega final del profesional llega al encargado. Versiones previas no se borran de Drive.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

function montar(task) {
  const avisos = [], borrados = []
  const c = {
    console, JSON, String, Number, Math, Date, Array, Object, Promise,
    avisos, borrados, task,
    responsableActivo: '',
    exp: { _exp: 'EXP-1', tasks: [task] },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    notif: (m, t) => avisos.push([m, t]),
    hoy: () => '2026-09-30',
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    estadoTask: t => t.estado,
    esModoResponsable: () => true,
    esVistaActividadesDepto: () => false,
    esTareaDelEncargado: () => false,
    taskUsuarioEsAsignado: (t, u) => String(t.responsable || '').toLowerCase() === String(u || '').toLowerCase(),
    puedeReportarTask: () => true,
    taskEsAtenderPqrs: () => false,
    taskPuedeCorregirSinRevision: () => false,
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
    driveDeleteInstitutional: async id => { borrados.push(id); return true },
    driveRenombrarSoporteActivoExp: async () => true,
  }
  c.window = c
  createContext(c)
  runInContext(extraerFunciones(read('js/core.js'), [
    'getAsignado', 'migrateLegacyAsignados', 'taskEsMultiAsignada', 'syncTaskAggregateState', 'taskRecibidaPorTraslado',
    'soporteEsPorCorregir', 'resetTaskPorCorregir', 'taskRevisionParCtx', 'puedeDevolverAlTecnico',
    'devolverAlTecnicoRevisionPar', 'enviarTaskPorVerificar', 'taskCuentaComoRevisadaEncargado',
  ]), c)
  return c
}

const archivo = id => ({ driveFileId: id, driveLink: 'https://drive.google.com/file/d/' + id + '/view', nombre: id + '.pdf' })

/** Técnico entregó (A) y el encargado trasladó la actividad al profesional (resetEntregaAlReasignarTask). */
function tareaTrasladada() {
  return {
    id: 't1', actividad: 'Concepto técnico', responsable: 'Prof', responsables: ['Prof'],
    asignados: [{ nombre: 'Prof', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
    estado: 'En ejecución', reporteTrasladado: true, comentarios: [],
    soportes: [{ id: 's1', driveFileId: 'A', driveInstitutional: true, activo: false, version_historial: true, driveEstado: 'acorregir', label: 'Documento principal' }],
    historial: [
      { tipo: 'reenvio_verificacion', por: 'Tec' },
      { tipo: 'traslado', de: 'Tec', a: 'Prof', por: 'Encargado' },
      { tipo: 'traslado_entrega_reset', nota: 'Traslado' },
    ],
  }
}

describe('Revisión técnico ↔ profesional', () => {
  it('solo el profesional ve «Devolver al técnico» en una actividad trasladada con entrega', () => {
    const c = montar(tareaTrasladada())
    expect(c.taskRevisionParCtx(c.task, c.exp)).toMatchObject({ tecnico: 'Tec', profesional: 'Prof', fase: 'profesional' })
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(true)
    expect(c.puedeDevolverAlTecnico(c.task, 'Tec', c.exp)).toBe(false)
  })

  it('traslado sin entrega o actividad no trasladada: sin botón', () => {
    const t = tareaTrasladada()
    t.historial = [{ tipo: 'traslado', de: 'Tec', a: 'Prof' }]
    const c = montar(t)
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(false)
    c.task.historial = []
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(false)
  })

  it('devolver sin observación también pasa al técnico (la observación es opcional)', () => {
    const c = montar(tareaTrasladada())
    c.responsableActivo = 'Prof'
    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', '  ')).toBe(true)
    expect(c.task.responsable).toBe('Tec')
  })

  it('ida y vuelta x veces y entrega final al encargado, sin borrar versiones de Drive', async () => {
    const c = montar(tareaTrasladada())

    // Ronda 1: profesional devuelve → técnico en Por corregir
    c.responsableActivo = 'Prof'
    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Ajustar tabla 2')).toBe(true)
    expect(c.task.responsable).toBe('Tec')
    expect(c.task.estado).toBe('Por corregir')
    expect(c.task.comentarios.at(-1)).toMatchObject({ para: 'Tec', rol: 'asignador' })
    expect(c.taskCuentaComoRevisadaEncargado(c.task, c.exp)).toBe(false)
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(false)

    // Técnico corrige → vuelve al profesional en Por ejecutar (no pasa por Por revisar)
    c.responsableActivo = 'Tec'
    expect(c.enviarTaskPorVerificar('EXP-1', 't1', [], 'corregido', false, [archivo('B')])).toBe(true)
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')
    expect(c.task.fechaReportada).toBe('')
    expect(c.task.soportes.find(s => s.driveFileId === 'B').activo).toBe(true)
    expect(c.avisos.at(-1)[0]).toMatch(/Corrección enviada a Prof/)

    // Ronda 2: nuevamente errores
    c.responsableActivo = 'Prof'
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(true)
    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Falta firma de anexos')).toBe(true)
    expect(c.task.estado).toBe('Por corregir')
    expect(c.task.responsable).toBe('Tec')
    expect(c.soporteEsPorCorregir(c.task.soportes.find(s => s.driveFileId === 'B'))).toBe(true)

    c.responsableActivo = 'Tec'
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('C')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')

    // Profesional entrega el firmado → Por revisar del encargado
    c.responsableActivo = 'Prof'
    expect(c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('D')])).toBe(true)
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('Por verificar')
    await new Promise(r => setTimeout(r, 0))
    expect(c.borrados).toEqual([])
    const ids = c.task.soportes.map(s => s.driveFileId)
    expect(ids).toEqual(['A', 'B', 'C', 'D'])
    expect(c.task.soportes.filter(s => s.activo).map(s => s.driveFileId)).toEqual(['D'])
    expect(['A', 'B', 'C'].every(id => c.soporteEsPorCorregir(c.task.soportes.find(s => s.driveFileId === id)))).toBe(true)
  })

  it('traslado general con entrega: la entrega del nuevo responsable no borra la anterior de Drive', async () => {
    const c = montar(tareaTrasladada())
    c.responsableActivo = 'Prof'
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('D')])
    await new Promise(r => setTimeout(r, 0))
    expect(c.borrados).toEqual([])
    expect(c.task.soportes.map(s => s.driveFileId)).toEqual(['A', 'D'])
    expect(c.task.estado).toBe('Por verificar')
  })
})
