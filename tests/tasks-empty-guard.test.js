/**
 * Guarda: no pisar tasks con [] (merge:true borra trazabilidad; Drive queda huérfano).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

describe('saveExpedienteDoc no pisa tasks con []', () => {
  const src = read('js/persistence.js')

  it('omite tasks:[] salvo _fsForceEmptyTasks', () => {
    expect(src).toMatch(/omití tasks:\[\] para no borrar trazabilidad/)
    expect(src).toMatch(/_fsForceEmptyTasks/)
    expect(src).toMatch(/delete payload\.tasks/)
  })

  it('expone repararTrazabilidadDesdeDrive', () => {
    expect(src).toMatch(/async function repararTrazabilidadDesdeDrive/)
    expect(src).toMatch(/window\.repararTrazabilidadDesdeDrive\s*=\s*repararTrazabilidadDesdeDrive/)
  })
})

describe('papelera permite vaciar solo al purgar la última', () => {
  it('marca _fsForceEmptyTasks cuando tasks queda vacío', () => {
    const src = read('js/papelera.js')
    expect(src).toMatch(/_fsForceEmptyTasks\s*=\s*true/)
  })
})

describe('asociarVinculoAPqrs exportado', () => {
  it('queda en window para el rail Asociar', () => {
    const src = read('js/core.js')
    expect(src).toMatch(/function asociarVinculoAPqrs\s*\(/)
    expect(src).toMatch(/window\.asociarVinculoAPqrs\s*=\s*asociarVinculoAPqrs/)
  })
})
