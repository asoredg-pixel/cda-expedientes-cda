/**
 * por-revisar-fondo-solo-fijada.test.js — Encargado NCA › Por revisar / Por ejecutar:
 * filas fijadas sin fondo ni caja; solo separador degradado bajo la última fijada.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')

function bloqueFila() {
  const ini = core.indexOf('const sinFondoFila=')
  if (ini < 0) throw new Error('No se encontró sinFondoFila')
  return core.slice(ini, core.indexOf("const rowData=", ini))
}

function estiloFila({ fijadaAct, filPinVal, esCrit = false, priorAbierta = true, prioritaria = false, reentrega = false }) {
  const t = { prioritaria }
  const taskEsReentregaTrasCorreccion = () => reentrega
  const fn = new Function('fijadaAct', 'filPinVal', 'esCrit', 'priorAbierta', 't', 'taskEsReentregaTrasCorreccion',
    bloqueFila() + '\nreturn {rowStyle,rowCls};')
  return fn(fijadaAct, filPinVal, esCrit, priorAbierta, t, taskEsReentregaTrasCorreccion)
}

describe('Por revisar: fondo solo en la fila fijada', () => {
  it('fila fijada: sin fondo ni sombra inline, aunque sea reentrega o urgente', () => {
    const r = estiloFila({ fijadaAct: true, filPinVal: 'porver', esCrit: true, reentrega: true })
    expect(r.rowStyle).toBe('')
    expect(r.rowStyle).not.toMatch(/background/)
    expect(r.rowCls.trim()).toBe('pqrs-nca-pinned')
  })

  it('reentrega o prioridad sin fijar en Por revisar: sin fondo', () => {
    const r = estiloFila({ fijadaAct: false, filPinVal: 'porver', esCrit: true, prioritaria: true, reentrega: true })
    expect(r.rowStyle).toBe('')
    expect(r.rowCls).toBe('')
  })

  it('fuera de Por revisar se conserva el resaltado de reentrega y prioridad', () => {
    const r = estiloFila({ fijadaAct: false, filPinVal: 'todas', esCrit: true, reentrega: true })
    expect(r.rowStyle).toMatch(/#ea580c/)
    expect(r.rowCls).toBe('prioritaria-crit')
  })

  it('CSS: sin caja en cada fijada; separador degradado solo en la última', () => {
    expect(css).not.toMatch(/tr\.pqrs-nca-pinned\s*\{[^}]*outline/)
    expect(css).not.toMatch(/tr\.pqrs-nca-pinned td:first-child\{border-left/)
    expect(css).toMatch(/pqrs-nca-pinned-last[\s\S]*?linear-gradient\(90deg/)
    expect(css).toMatch(/tr\.pqrs-nca-pinned\s*>\s*td\{[^}]*background:\s*transparent/)
  })

  it('markUltimaFilaFijadaNca y acento de paleta en la tabla', () => {
    expect(core).toMatch(/function markUltimaFilaFijadaNca\(/)
    expect(core).toMatch(/pqrs-nca-pinned-last/)
    expect(core).toMatch(/applyMetAccentVars\(document\.getElementById\('act-table-wrap'\)/)
  })
})
