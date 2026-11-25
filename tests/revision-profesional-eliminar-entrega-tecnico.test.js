/**
 * revision-profesional-eliminar-entrega-tecnico.test.js —
 * En revisión par de concepto el técnico ya no elimina la entrega mientras espera al profesional:
 * puede reemplazar el documento (conserva historial). Eliminar queda bloqueado.
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

function ctx() {
  const c = createContext({
    responsableActivo: 'Tecnico Uno',
    esModoResponsable: () => true,
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    taskEsMultiAsignada: t => (t.responsables || []).length > 1,
    estadoTask: t => t.estado
  })
  runInContext(extraer(core, [
    'taskRevisionParCtx', 'taskRevisionParCerradaPorRetiro', 'taskEsFlujoRevisionParConceptoActivo',
    'taskRevParParticipante', 'taskRevParTecnicoEsperando', 'taskRevParTecnicoPuedeReemplazar',
    'taskRevParTecnicoPuedeEliminar',
  ]), c)
  return c
}

function tarea(extraHist, extra) {
  return Object.assign({
    id: 'tk1', exp: 'EXP-1', responsable: 'Profesional Dos', responsables: ['Profesional Dos'], estado: 'En ejecución',
    historial: [
      { tipo: 'asignacion', por: 'Encargado' },
      { tipo: 'traslado', de: 'Tecnico Uno', a: 'Profesional Dos', por: 'Tecnico Uno', revisionPar: 'solicitud' }
    ].concat(extraHist || [])
  }, extra || {})
}

describe('Técnico en revisión del profesional: reemplazar, no eliminar', () => {
  it('puede reemplazar mientras el profesional no la haya revisado', () => {
    expect(ctx().taskRevParTecnicoPuedeReemplazar(tarea(), 'Tecnico Uno', null)).toBe(true)
    expect(ctx().taskRevParTecnicoPuedeEliminar(tarea(), 'Tecnico Uno', null)).toBe(false)
  })

  it('no puede reemplazar si el profesional ya actuó (entregó al encargado o devolvió)', () => {
    const c = ctx()
    expect(c.taskRevParTecnicoPuedeReemplazar(tarea([{ tipo: 'reenvio_verificacion', por: 'Profesional Dos' }]), 'Tecnico Uno', null)).toBe(false)
    expect(c.taskRevParTecnicoPuedeReemplazar(tarea([], { estado: 'Por verificar', fechaReportada: '2026-10-14' }), 'Tecnico Uno', null)).toBe(false)
  })

  it('el profesional no lo ve como técnico', () => {
    expect(ctx().taskRevParTecnicoPuedeReemplazar(tarea(), 'Profesional Dos', null)).toBe(false)
  })

  it('puedeEliminarEntregaActividad bloquea al técnico en ciclo rev par', () => {
    const fn = extraer(core, ['puedeEliminarEntregaActividad'])
    expect(fn).toMatch(/taskEsFlujoRevisionParConceptoActivo/)
    expect(fn).toMatch(/return false/)
  })

  it('eliminarEntregaActividad defiende el ciclo rev par (no cancelada)', () => {
    const fn = extraer(core, ['eliminarEntregaActividad'])
    expect(fn).toMatch(/taskEsFlujoRevisionParConceptoActivo/)
    expect(fn).toMatch(/use «Reemplazar documento»/)
  })

  it('toolbar: Reemplazar documento en la fila del técnico', () => {
    const tb = extraer(core, ['renderActRowToolbarHtml'])
    expect(tb).toMatch(/abrirReemplazarDocumentoRevPar/)
    expect(tb).toMatch(/Reemplazar documento: sigue en revisión del profesional/)
  })
})
