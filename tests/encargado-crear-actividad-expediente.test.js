/**
 * encargado-crear-actividad-expediente.test.js — «+ Crear actividad» del encargado NCA: además de la actividad
 * sin expediente, el modo «Expediente / PQRSD» busca o crea el expediente y asigna la actividad predeterminada.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const ent = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

function fakeDoc(vals, checks) {
  return {
    getElementById: id => (id in vals ? { value: vals[id], checked: !!vals[id] } : null),
    querySelectorAll: () => checks.map(v => ({ value: v }))
  }
}

describe('Textos del encargado', () => {
  it('botón «+ Crear actividad» y modo «Expediente / PQRSD»', () => {
    expect(html).toMatch(/openCrearActLibreModal\(\)">\+ Crear actividad<\/button>/)
    expect(core).toMatch(/id="act-libre-modo-pqrs"[^>]*> Expediente \/ PQRSD<\/label>/)
    expect(core).not.toMatch(/id="act-libre-modo-pqrs"[^>]*> Crear PQRSD<\/label>/)
  })

  it('la búsqueda ofrece crear expediente o PQRSD y separa trámite de PQRSD', () => {
    const fn = extraer(core, ['actLibrePqrsFiltrarSug'])
    expect(fn).toMatch(/actLibreExpPickCrear/)
    expect(fn).toMatch(/actLibrePqrsPickCrear/)
    expect(fn).toMatch(/esPqrs\?'actLibrePqrsPickExistente':'actLibreExpPickExistente'/)
  })

  it('PQRSD existente abre el modal de asignación de la bandeja', () => {
    expect(extraer(core, ['actLibrePqrsPickExistente'])).toMatch(/openAsignarPqrsOficinaModal\(e\._exp\)/)
  })
})

describe('Asignar actividad en expediente', () => {
  function ctx(e, vals, checks, extra) {
    const guardados = []
    const msgs = []
    const c = createContext(Object.assign({
      console, Date, JSON,
      document: fakeDoc(vals, checks),
      window: { _actLibreExpSel: { tipo: 'exp', expId: e ? e._exp : '' } },
      responsableActivo: 'Encargado NCA',
      exps: e ? [e] : [],
      getExpById: id => (e && e._exp === id ? e : null),
      notif: (m, t) => msgs.push([m, t]),
      hoy: () => '2026-10-14',
      genTaskId: () => 'tk_1',
      normalizeTask: t => t,
      taskComentarioAutor: () => 'Encargado NCA',
      persistExpedienteGranular: x => guardados.push(x),
      closeTaskModal: () => {}, renderActividades: () => {}, saveLS: () => {}
    }, extra || {}))
    runInContext(extraer(core, ['readActLibrePlazoVence', 'submitCrearActividadEnExpediente']) +
      '\nvar diffDias=function(){return 5;};var calcVence=function(){return "2026-10-21";};', c)
    return { c, guardados, msgs }
  }

  it('agrega la actividad al expediente con varios responsables y modo unificado', () => {
    const e = { _exp: 'EXP-100', tasks: [] }
    const { c, guardados } = ctx(e, {
      'act-libre-nombre': 'Concepto técnico', 'act-libre-detalle': 'Visita',
      'act-libre-plazo': '5', 'act-libre-vence': '', 'act-libre-modo': 'unificada', 'act-libre-prior': ''
    }, ['Ana', 'Luis'])
    c.submitCrearActividadEnExpediente()
    expect(e.tasks).toHaveLength(1)
    const t = e.tasks[0]
    expect(t.actividad).toBe('Concepto técnico')
    expect(t.responsables).toEqual(['Ana', 'Luis'])
    expect(t.asignados.map(a => a.estado)).toEqual(['pendiente', 'pendiente'])
    expect(t.entregaModo).toBe('unificada')
    expect(t.estado).toBe('En ejecución')
    expect(t.historial[0].tipo).toBe('asignacion')
    expect(guardados).toEqual([e])
  })

  it('sin responsable no guarda', () => {
    const e = { _exp: 'EXP-100', tasks: [] }
    const { c, msgs } = ctx(e, { 'act-libre-nombre': 'Concepto técnico', 'act-libre-plazo': '', 'act-libre-vence': '' }, [])
    c.submitCrearActividadEnExpediente()
    expect(e.tasks).toHaveLength(0)
    expect(msgs[0][0]).toMatch(/responsable/)
  })
})

describe('Alta de expediente por el encargado', () => {
  it('queda sin «pendiente de revisión de alta»', () => {
    const exps = []
    const c = createContext({
      console, JSON, exps, responsableActivo: 'Ana',
      notif: () => {}, hoy: () => '2026-10-14', getDeptoOperativo: () => 'guaviare',
      getExpById: () => null, persistExpedienteGranular: () => {},
      applyEntregaRespInteresadoToExp: (e, d) => Object.assign(e, d)
    })
    runInContext(extraer(ent, ['crearStubExpedienteEntregaResp']), c)
    const e = c.crearStubExpedienteEntregaResp({ expId: 'EXP-200', tramiteId: 'lic', porEncargado: true, por: 'Encargado NCA' })
    expect(e._pendiente_revision_alta).toBe(false)
    expect(e._alta_por_responsable).toBe(false)
    expect(e._alta_por).toBe('Encargado NCA')
    const r = c.crearStubExpedienteEntregaResp({ expId: 'EXP-201', tramiteId: 'lic' })
    expect(r._pendiente_revision_alta).toBe(true)
    expect(r._alta_por_responsable).toBe(true)
  })
})
