/**
 * Las paletas no muestran el texto de ayuda al seleccionarlas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const req = readFileSync(resolve(root, 'js/requerimientos.js'), 'utf8')

describe('Paletas sin comentario de ayuda', () => {
  it('al elegir una paleta el subtítulo queda vacío', () => {
    expect(core).toContain("if(sub)sub.textContent='';")
    expect(core).not.toContain('Seguimiento completo en Consolidado')
    expect(core).not.toContain('Por revisar: entregas reportadas')
    expect(core).not.toContain('Por corregir: devoluciones pendientes')
    expect(core).not.toContain('Reporte con 📤')
  })

  it('la paleta vacía de requerimientos no repite las reglas', () => {
    expect(req).toContain(":'Sin pendientes por gestionar.';")
    expect(req).not.toContain('Seguimiento completo en Consolidado')
    expect(req).not.toContain('días hábiles después del vencimiento · Resoluciones')
  })
})
