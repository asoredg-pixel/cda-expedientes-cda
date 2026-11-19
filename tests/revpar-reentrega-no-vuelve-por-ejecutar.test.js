/**
 * Tras devolución del profesional, la reentrega del técnico al profesional
 * no debe ser pisada por un eco con historial más largo aún en «devolución»
 * (volvía a Por ejecutar del responsable — p. ej. PAF-00080-26).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

describe('Revisión par: reentrega no vuelve a Por ejecutar', () => {
  it('merge: correccion al profesional gana frente a eco con más historial en devolución', () => {
    const c = createContext({
      window: {}, JSON, String, Object, Array,
      agendaNorm: s => String(s || '').trim().toLowerCase(),
      normalizeTask: x => Object.assign({}, x)
    })
    runInContext(extraer(persistence, [
      'faseFlujoFirmaRank', 'taskRemotoDevueltoACorregir', 'taskRevisionParMergeRank',
      'mergeExpedienteTasksLocalRemote'
    ]), c)

    const reenviada = [{
      id: 't1',
      actividad: 'Concepto técnico',
      estado: 'En ejecución',
      responsable: 'Prof',
      responsables: ['Prof'],
      asignados: [{ nombre: 'Prof', estado: 'pendiente', fechaReportada: '', fechaAtendida: '' }],
      fechaReportada: '',
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'soporte', ts: 2 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 },
        { tipo: 'reenvio_verificacion', ts: 4 },
        { tipo: 'traslado', revisionPar: 'correccion', de: 'Tec', a: 'Prof', ts: 5 }
      ]
    }]
    // Eco de otra pestaña / cliente: más mensajes, pero aún sin la correccion
    const ecoViejo = [{
      id: 't1',
      actividad: 'Concepto técnico',
      estado: 'Por corregir',
      responsable: 'Tec',
      responsables: ['Tec'],
      asignados: [{ nombre: 'Tec', estado: 'por_corregir', fechaReportada: '', fechaAtendida: '' }],
      historial: [
        { tipo: 'traslado', revisionPar: 'solicitud', de: 'Tec', a: 'Prof', ts: 1 },
        { tipo: 'soporte', ts: 2 },
        { tipo: 'comentario', ts: 2.5 },
        { tipo: 'comentario', ts: 2.6 },
        { tipo: 'comentario', ts: 2.7 },
        { tipo: 'traslado', revisionPar: 'devolucion', de: 'Prof', a: 'Tec', ts: 3 },
        { tipo: 'ajuste_soporte', ts: 3.5 }
      ]
    }]

    expect(c.taskRevisionParMergeRank(reenviada[0])).toBeGreaterThan(c.taskRevisionParMergeRank(ecoViejo[0]))

    const merged = c.mergeExpedienteTasksLocalRemote(reenviada, ecoViejo)
    expect(merged).toHaveLength(1)
    expect(merged[0].responsable).toBe('Prof')
    expect(merged[0].estado).toBe('En ejecución')
    expect(merged[0].historial.some(h => h && h.revisionPar === 'correccion')).toBe(true)

    const mergedInv = c.mergeExpedienteTasksLocalRemote(ecoViejo, reenviada)
    expect(mergedInv[0].responsable).toBe('Prof')
  })
})
