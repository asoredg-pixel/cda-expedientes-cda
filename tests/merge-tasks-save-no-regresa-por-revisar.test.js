/**
 * Encargado NCA: en Por revisar abre ✏️, asigna otra actividad y aprueba el concepto.
 * Un Guardar del formulario (aún con «Por verificar») no debe pisar Atendida.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const guardar = readFileSync(resolve(root, 'js/guardar-exp.js'), 'utf8')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try {
        // eslint-disable-next-line no-new
        new Function(code)
        return code
      } catch (e) { /* aún incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

describe('mergeTasksForSave: no regresa a Por revisar tras aprobar', () => {
  it('formulario Por verificar no pisa Atendida (concepto vía profesional + asignar en rail)', () => {
    const c = createContext({
      window: {},
      String, Object, Array, Math, Number, Date, isFinite, isNaN,
      normalizeTask: t => Object.assign({}, t)
    })
    runInContext(extraer(persistence, ['faseFlujoFirmaRank']), c)
    runInContext(extraer(guardar, ['taskFormSaveAvanceRank', 'mergeTasksForSave']), c)

    const prev = [{
      id: 'concepto1',
      actividad: 'Elaborar concepto técnico',
      estado: 'Atendida',
      fechaReportada: '2026-11-18',
      fechaAtendida: '2026-11-18',
      ultimaRevisionDepto: { tipo: 'aprobada', fecha: '2026-11-18' },
      asignados: [{ nombre: 'Profesional X', estado: 'atendido', fechaReportada: '2026-11-18', fechaAtendida: '2026-11-18' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Técnico', a: 'Profesional X', ts: 1 },
        { tipo: 'entrega', ts: 2 },
        { tipo: 'verificacion', ts: 3 },
        { tipo: 'traslado', revisionPar: 'cancelada', ts: 4 }
      ],
      soportes: [{ driveFileId: 'f1' }]
    }]
    const form = [{
      id: 'concepto1',
      actividad: 'Elaborar concepto técnico',
      estado: 'Por verificar',
      fechaReportada: '2026-11-18',
      fechaAtendida: '',
      asignados: [{ nombre: 'Profesional X', estado: 'por_verificar', fechaReportada: '2026-11-18', fechaAtendida: '' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Técnico', a: 'Profesional X', ts: 1 },
        { tipo: 'entrega', ts: 2 }
      ],
      soportes: [{ driveFileId: 'f1' }]
    }, {
      id: 'nueva2',
      actividad: 'Seguimiento operativo',
      estado: 'En ejecución',
      responsable: 'Otro',
      responsables: ['Otro'],
      asignados: [{ nombre: 'Otro', estado: 'pendiente' }]
    }]

    const out = c.mergeTasksForSave(form, prev)
    const concepto = out.find(t => t.id === 'concepto1')
    const nueva = out.find(t => t.id === 'nueva2')
    expect(concepto.estado).toBe('Atendida')
    expect(concepto.fechaAtendida).toBe('2026-11-18')
    expect(concepto.ultimaRevisionDepto.tipo).toBe('aprobada')
    expect(concepto.asignados[0].estado).toBe('atendido')
    expect(nueva).toBeTruthy()
    expect(nueva.actividad).toBe('Seguimiento operativo')
  })

  it('taskFormSaveAvanceRank: Atendida > Por verificar', () => {
    const c = createContext({
      window: {},
      String, Object, Array,
      normalizeTask: t => t
    })
    runInContext(extraer(persistence, ['faseFlujoFirmaRank']), c)
    runInContext(extraer(guardar, ['taskFormSaveAvanceRank']), c)
    expect(c.taskFormSaveAvanceRank({ estado: 'Atendida', fechaAtendida: '2026-11-18' }))
      .toBeGreaterThan(c.taskFormSaveAvanceRank({ estado: 'Por verificar', fechaReportada: '2026-11-18' }))
  })
})
