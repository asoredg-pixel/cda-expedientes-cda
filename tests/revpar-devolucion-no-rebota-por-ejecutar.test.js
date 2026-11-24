/**
 * revpar-devolucion-no-rebota-por-ejecutar.test.js —
 * Tras devolver al técnico, un eco/snapshot aún en solicitud/corrección
 * no debe devolver la actividad al Por ejecutar del profesional.
 * (taskRevisionParUltimoTs gana sobre el rank 4>1.)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
const guardar = readFileSync(resolve(root, 'js/guardar-exp.js'), 'utf8')

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

function ctxMerge() {
  const c = createContext({
    window: {}, JSON, String, Object, Array, Number, isFinite,
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    normalizeTask: x => Object.assign({}, x),
    faseFlujoFirmaRank: () => 0
  })
  runInContext(extraer(persistence, [
    'faseFlujoFirmaRank', 'taskRemotoDevueltoACorregir',
    'taskRevisionParMergeRank', 'taskRevisionParUltimoTs',
    'mergeExpedienteTasksLocalRemote'
  ]), c)
  return c
}

function ctxSave() {
  const c = createContext({
    window: {}, JSON, String, Object, Array, Number, isFinite,
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    normalizeTask: x => Object.assign({}, x),
    faseFlujoFirmaRank: () => 0
  })
  runInContext(extraer(persistence, [
    'taskRevisionParMergeRank', 'taskRevisionParUltimoTs'
  ]), c)
  runInContext(extraer(guardar, [
    'taskFormSaveAvanceRank', 'mergeTasksForSave'
  ]), c)
  return c
}

const previaProf = {
  id: 't1',
  actividad: 'Concepto técnico',
  estado: 'En ejecución',
  responsable: 'Prof',
  responsables: ['Prof'],
  asignados: [{ nombre: 'Prof', estado: 'pendiente', fechaReportada: '', fechaAtendida: '' }],
  fechaReportada: '',
  historial: [
    { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 100 }
  ]
}

const devuelta = {
  id: 't1',
  actividad: 'Concepto técnico',
  estado: 'Por corregir',
  responsable: 'Tec',
  responsables: ['Tec'],
  asignados: [{ nombre: 'Tec', estado: 'por_corregir', fechaReportada: '', fechaAtendida: '' }],
  fechaReportada: '',
  historial: [
    { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 100 },
    { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 200, nota: 'Corregir' }
  ]
}

describe('Devolución al técnico no rebota a Por ejecutar del profesional', () => {
  it('merge: devolución fresca gana frente a eco previo en solicitud (ambos sentidos)', () => {
    const c = ctxMerge()
    expect(c.taskRevisionParUltimoTs(devuelta)).toBeGreaterThan(c.taskRevisionParUltimoTs(previaProf))
    expect(c.taskRevisionParMergeRank(previaProf)).toBeGreaterThan(c.taskRevisionParMergeRank(devuelta))

    const a = c.mergeExpedienteTasksLocalRemote([devuelta], [previaProf])
    expect(a).toHaveLength(1)
    expect(a[0].responsable).toBe('Tec')
    expect(a[0].estado).toBe('Por corregir')
    expect(a[0].historial.some(h => h && h.revisionPar === 'devolucion')).toBe(true)

    const b = c.mergeExpedienteTasksLocalRemote([previaProf], [devuelta])
    expect(b[0].responsable).toBe('Tec')
    expect(b[0].estado).toBe('Por corregir')
  })

  it('merge: reentrega (correccion) con ts mayor sigue ganando frente a eco en devolución', () => {
    const c = ctxMerge()
    const reenviada = {
      id: 't1', estado: 'En ejecución', responsable: 'Prof', responsables: ['Prof'],
      asignados: [{ nombre: 'Prof', estado: 'pendiente' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 },
        { tipo: 'traslado', revisionPar: 'correccion', de: 'Tec', a: 'Prof', ts: 5 }
      ]
    }
    const ecoDev = {
      id: 't1', estado: 'Por corregir', responsable: 'Tec', responsables: ['Tec'],
      asignados: [{ nombre: 'Tec', estado: 'por_corregir' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'comentario', ts: 2 },
        { tipo: 'comentario', ts: 2.5 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 },
        { tipo: 'ajuste_soporte', ts: 3.5 }
      ]
    }
    const merged = c.mergeExpedienteTasksLocalRemote([reenviada], [ecoDev])
    expect(merged[0].responsable).toBe('Prof')
    expect(merged[0].estado).toBe('En ejecución')
    expect(merged[0].historial.some(h => h && h.revisionPar === 'correccion')).toBe(true)
  })

  it('guardar: form con devolución fresca no la pisa prev aún en solicitud', () => {
    const c = ctxSave()
    const out = c.mergeTasksForSave([devuelta], [previaProf])
    expect(out).toHaveLength(1)
    expect(out[0].responsable).toBe('Tec')
    expect(out[0].estado).toBe('Por corregir')
  })

  it('guardar: prev con reentrega gana frente a form aún en devolución (ts)', () => {
    const c = ctxSave()
    const formDev = {
      id: 't1', estado: 'Por corregir', responsable: 'Tec', responsables: ['Tec'],
      asignados: [{ nombre: 'Tec', estado: 'por_corregir' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 }
      ]
    }
    const prevReenv = {
      id: 't1', estado: 'En ejecución', responsable: 'Prof', responsables: ['Prof'],
      asignados: [{ nombre: 'Prof', estado: 'pendiente' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 },
        { tipo: 'traslado', revisionPar: 'correccion', de: 'Tec', a: 'Prof', ts: 5 }
      ]
    }
    const out = c.mergeTasksForSave([formDev], [prevReenv])
    expect(out[0].responsable).toBe('Prof')
    expect(out[0].estado).toBe('En ejecución')
  })
})
