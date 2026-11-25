/**
 * Asociar (Por ejecutar / Por revisar): al digitar un N° que no está en memoria
 * debe hacer getDoc vía traerExpedienteSiFalta (mismo criterio que Consulta).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

describe('Asociar busca con getDoc si falta en memoria', () => {
  it('onReviewAsocSearchInput llama traerExpedienteSiFalta con debounce', () => {
    const fn = consulta.slice(
      consulta.indexOf('function onReviewAsocSearchInput'),
      consulta.indexOf('window.onReviewAsocSearchInput')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
    expect(fn).toMatch(/consultaPareceNumeroDoc/)
    expect(fn).toMatch(/_reviewAsocBusqT/)
    expect(fn).toMatch(/Buscando/)
  })

  it('filtrarPqrsExpAsocSug también trae el doc si falta', () => {
    const fn = core.slice(
      core.indexOf('function filtrarPqrsExpAsocSug(inp)'),
      core.indexOf('function pickPqrsExpAsocSug')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
    expect(fn).toMatch(/consultaPareceNumeroDoc/)
  })

  it('filtrarExpAsocSug también trae el doc si falta', () => {
    const fn = core.slice(
      core.indexOf('function filtrarExpAsocSug(inp)'),
      core.indexOf('function hideExpAsocSug')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
  })

  it('submitAsociarVinculoPqrs asegura getDoc antes de asociar', () => {
    const fn = core.slice(
      core.indexOf('async function submitAsociarVinculoPqrs'),
      core.indexOf('function openAsociarExpedientePqrsModal')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
    expect(fn).toMatch(/await traerExpedienteSiFalta/)
  })
})
