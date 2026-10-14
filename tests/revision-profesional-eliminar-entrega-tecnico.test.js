/**
 * revision-profesional-eliminar-entrega-tecnico.test.js — El técnico que envió un concepto a revisión del profesional
 * puede eliminar la entrega (fila de «Por revisar» y rail de 🔍) mientras el profesional no la haya revisado;
 * la actividad vuelve a su Por ejecutar.
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
  runInContext(extraer(core, ['taskRevisionParCtx', 'taskRevParParticipante', 'taskRevParTecnicoEsperando', 'taskRevParTecnicoPuedeEliminar']), c)
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

describe('Técnico elimina entrega en revisión del profesional', () => {
  it('puede mientras el profesional no la haya revisado', () => {
    expect(ctx().taskRevParTecnicoPuedeEliminar(tarea(), 'Tecnico Uno', null)).toBe(true)
  })

  it('no puede si el profesional ya actuó (entregó al encargado o devolvió)', () => {
    const c = ctx()
    expect(c.taskRevParTecnicoPuedeEliminar(tarea([{ tipo: 'reenvio_verificacion', por: 'Profesional Dos' }]), 'Tecnico Uno', null)).toBe(false)
    expect(c.taskRevParTecnicoPuedeEliminar(tarea([], { estado: 'Por verificar', fechaReportada: '2026-10-14' }), 'Tecnico Uno', null)).toBe(false)
  })

  it('el profesional no lo ve como técnico', () => {
    expect(ctx().taskRevParTecnicoPuedeEliminar(tarea(), 'Profesional Dos', null)).toBe(false)
  })

  it('al eliminar, la actividad vuelve al técnico', () => {
    const fn = extraer(core, ['eliminarEntregaActividad'])
    expect(fn).toMatch(/tk\.responsable=revParTec\.tecnico;/)
    expect(fn).toMatch(/tk\.asignados=\[\{nombre:revParTec\.tecnico,fechaReportada:'',fechaAtendida:'',estado:'pendiente'\}\]/)
  })

  it('si la creó el técnico (autoentrega) se anula; solo la asignada vuelve a Por ejecutar', () => {
    const fn = extraer(core, ['eliminarEntregaActividad'])
    const iAutoExp = fn.indexOf('if(esAuto&&e){')
    const iAutoLibre = fn.indexOf('tk.eliminada=true;')
    const iRevPar = fn.indexOf('tk.responsable=revParTec.tecnico;')
    expect(iAutoExp).toBeGreaterThan(-1)
    expect(iAutoExp).toBeLessThan(iRevPar)
    expect(iAutoLibre).toBeLessThan(iRevPar)
    expect(fn.slice(iAutoExp, iRevPar)).toMatch(/e\.tasks=Array\.isArray\(e\.tasks\)\?e\.tasks\.filter/)
  })

  it('permiso en puedeEliminarEntregaActividad y 🗑 en la fila del técnico', () => {
    expect(extraer(core, ['puedeEliminarEntregaActividad'])).toMatch(/taskRevParTecnicoPuedeEliminar\(t,responsableActivo,e\)\)return true/)
    const tb = extraer(core, ['renderActRowToolbarHtml'])
    expect(tb).toMatch(/Eliminar entrega: sale de la revisión del profesional/)
  })
})
