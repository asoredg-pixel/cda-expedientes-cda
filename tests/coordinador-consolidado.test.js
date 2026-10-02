/**
 * coordinador-consolidado.test.js — El coordinador (modo responsable) abre Consolidado:
 * updateDeptoUI no debe devolverlo a Actividades.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

describe('Coordinador: pestaña Consolidado', () => {
  it('updateDeptoUI solo saca de Consolidado al responsable que no es coordinador', () => {
    const core = read('js/core.js')
    const ini = core.indexOf('function updateDeptoUI(')
    const fin = core.indexOf('\nfunction ', ini + 10)
    const body = core.slice(ini, fin)
    const m = body.match(/if\(resp&&document\.getElementById\('pg-cons'\)[\s\S]*?showTab\('act'\);/)
    expect(m).toBeTruthy()
    expect(m[0]).toContain('esCargoCoordinador()')
  })

  it('showTab y el menú permiten cons al coordinador', () => {
    expect(read('js/formulario.js')).toMatch(/t==='cons'&&!\(typeof esCargoCoordinador==='function'&&esCargoCoordinador\(\)\)\)t='act'/)
    expect(read('js/roles.js')).toMatch(/if\(esCargoCoordinador\(\)\)tabs\.splice\(tabs\.indexOf\(C\)\+1,0,'cons'\)/)
  })
})
