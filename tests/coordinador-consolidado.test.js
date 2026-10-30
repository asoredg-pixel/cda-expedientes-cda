/**
 * El coordinador ya no tiene Consolidado: abrirlo bajaba todo el departamento.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

describe('Coordinador sin menú Consolidado', () => {
  it('el menú de responsable no agrega la pestaña', () => {
    const roles = read('js/roles.js')
    const ini = roles.indexOf('function tabsResponsableContratista(')
    const fin = roles.indexOf('\nfunction ', ini + 10)
    const body = roles.slice(ini, fin)
    expect(body).not.toContain("'cons'")
    expect(body).not.toContain('esCargoCoordinador()')
  })

  it('showTab y updateDeptoUI devuelven al responsable a Actividades', () => {
    expect(read('js/formulario.js')).toMatch(/if\(esModoResponsable\(\)&&t==='cons'\)t='act'/)
    const core = read('js/core.js')
    const ini = core.indexOf('function updateDeptoUI(')
    const fin = core.indexOf('\nfunction ', ini + 10)
    expect(core.slice(ini, fin)).toMatch(/pg-cons'\)&&document\.getElementById\('pg-cons'\)\.classList\.contains\('on'\)\)showTab\('act'\)/)
  })
})
