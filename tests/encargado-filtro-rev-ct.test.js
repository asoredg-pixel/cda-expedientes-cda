/**
 * Encargado NCA filtrando Por ejecutar por el profesional: el concepto en revisión
 * muestra la misma marca «🔍 Rev CT» que ve el profesional.
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

function ctx(filtro) {
  const c = createContext({
    esModoResponsable: () => false,
    agendaNorm: s => String(s || '').trim().toUpperCase(),
    taskEsMultiAsignada: () => false,
    estadoTask: () => 'En ejecución',
    estadoTaskLabel: () => 'Por ejecutar',
    taskEstadoStyle: () => ({ bg: '#fff', fg: '#000' }),
    getExpById: () => null,
    escAttr: s => String(s || ''),
    resolveActividadRegistroTipo: () => 'concepto',
    getActProyeccionResponsableNombre: () => filtro
  })
  runInContext(extraer(core, ['taskRevisionParCtx', 'taskRevParRolEnVista', 'taskEstadoBadgeHtml']), c)
  return c
}

const tarea = {
  actividad: 'Concepto de seguimiento',
  responsable: 'PROFESIONAL',
  historial: [{ tipo: 'traslado', revisionPar: 'solicitud', de: 'TECNICO', a: 'PROFESIONAL' }]
}

describe('Filtro del encargado en Por ejecutar', () => {
  it('al filtrar por el profesional muestra 🔍 Rev CT', () => {
    const html = ctx('PROFESIONAL').taskEstadoBadgeHtml(tarea)
    expect(html).toContain('Por ejecutar')
    expect(html).toContain('🔍 Rev CT')
  })

  it('sin filtrar un responsable no marca Rev CT', () => {
    const html = ctx(null).taskEstadoBadgeHtml(tarea)
    expect(html).toContain('Por ejecutar')
    expect(html).not.toContain('Rev CT')
  })
})
