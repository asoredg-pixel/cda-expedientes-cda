/**
 * por-revisar-fondo-solo-fijada.test.js — Encargado NCA › Por revisar: la fila fijada solo lleva la franja azul
 * (sin fondo, para que no parpadee al pasar el mouse); reentregas tras corrección y prioridades no colorean la fila.
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
  it('fila fijada: sin fondo (evita parpadeo al pasar el mouse), solo franja azul, aunque sea reentrega o urgente', () => {
    const r = estiloFila({ fijadaAct: true, filPinVal: 'porver', esCrit: true, reentrega: true })
    expect(r.rowStyle).toBe('box-shadow:inset 3px 0 0 var(--bl)')
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

  it('CSS de fila fijada (Por revisar y Por ejecutar): sin fondo azul, solo franja izquierda', () => {
    expect(css).not.toMatch(/tr\.pqrs-nca-pinned\{[^}]*background/)
    expect(css).toMatch(/tr\.pqrs-nca-pinned td:first-child\{border-left:3px solid var\(--bl\)\}/)
  })
})
