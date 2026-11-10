/**
 * Desde Asociar (Por ejecutar / Por revisar), «Consultar» un asociado
 * debe hacer getDoc vía traerExpedienteSiFalta (no solo getExpById en memoria).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

describe('reviewAsocVerConsulta carga asociado como Consulta', () => {
  it('usa traerExpedienteSiFalta cuando el registro no está en memoria', () => {
    const fn = src.slice(
      src.indexOf('function reviewAsocVerConsulta'),
      src.indexOf('window.reviewAsocVerConsulta')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
    expect(fn).toMatch(/Cargando/)
    expect(fn).toMatch(/pintar/)
    expect(fn).toMatch(/findExpByNumPlain/)
  })

  it('Archivos también trae el expediente si falta', () => {
    const fn = src.slice(
      src.indexOf('function reviewAsocVerArchivos'),
      src.indexOf('function renderReviewAsocActConsultaFull')
    )
    expect(fn).toMatch(/traerExpedienteSiFalta/)
  })

  it('el preview de consulta usa el mismo contenido de panel que Consulta', () => {
    const fn = src.slice(
      src.indexOf('function renderReviewAsocConsultaPreview'),
      src.indexOf('function reviewAsocVerConsulta')
    )
    expect(fn).toMatch(/renderConPanelExpContent/)
  })
})
