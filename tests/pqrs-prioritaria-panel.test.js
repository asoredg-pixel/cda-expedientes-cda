/**
 * pqrs-prioritaria-panel.test.js — Casilla «⚡ Prioritaria» del rail Trasladar / Asignar (Ver PQRSD):
 * marca o desmarca la PQRSD y su tarea de atención (lo que leen Por ejecutar y la paleta Prioritarias).
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

function montar(cb) {
  const c = {
    document: { getElementById: id => (id === 'pqrs-trasl-prior' ? cb : null) },
    taskEsAtenderPqrs: t => /^Oficio de respuesta/.test(t.actividad)
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/pqrs.js'), ['pqrsAplicarPrioritariaDesdePanel']), c)
  return c
}

const nuevaExp = prior => ({
  _exp: 'PQ-1', _pqrs_prioritaria: prior,
  tasks: [
    { id: 'a', actividad: 'Oficio de respuesta', prioritaria: prior },
    { id: 'b', actividad: 'Otra actividad', prioritaria: false },
    { id: 'c', actividad: 'Oficio de respuesta', prioritaria: prior, eliminada: true }
  ]
})

describe('Casilla ⚡ Prioritaria en Trasladar / Asignar', () => {
  it('marcar: la PQRSD y la tarea de atención quedan prioritarias', () => {
    const c = montar({ checked: true })
    const e = nuevaExp(false)
    c.pqrsAplicarPrioritariaDesdePanel(e)
    expect(e._pqrs_prioritaria).toBe(true)
    expect(e.tasks[0].prioritaria).toBe(true)
    expect(e.tasks[1].prioritaria).toBe(false)
    expect(e.tasks[2].prioritaria).toBe(false)
  })

  it('desmarcar lo que marcó Secretaría: se retira de la PQRSD y de la tarea', () => {
    const c = montar({ checked: false })
    const e = nuevaExp(true)
    c.pqrsAplicarPrioritariaDesdePanel(e)
    expect(e._pqrs_prioritaria).toBe(false)
    expect(e.tasks[0].prioritaria).toBe(false)
  })

  it('sin casilla en pantalla (modal clásico) no cambia nada', () => {
    const c = montar(null)
    const e = nuevaExp(true)
    c.pqrsAplicarPrioritariaDesdePanel(e)
    expect(e._pqrs_prioritaria).toBe(true)
    expect(e.tasks[0].prioritaria).toBe(true)
  })

  it('el panel del rail pinta la casilla precargada con el valor de Secretaría', () => {
    const src = read('js/core.js')
    expect(src).toMatch(/id="pqrs-trasl-prior"'\+\(e\._pqrs_prioritaria\?' checked':''\)/)
    const pq = read('js/pqrs.js')
    expect((pq.match(/pqrsAplicarPrioritariaDesdePanel\((e|exp)\);/g) || []).length).toBe(3)
  })
})
