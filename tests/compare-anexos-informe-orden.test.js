/**
 * compare-anexos-informe-orden.test.js — Comparar informe: anexos Act 1, 3, 7, 16…
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

describe('Comparar — anexos de informe ordenados', () => {
  it('Act 1, 3, 4, 6, 7, 16 (no por fecha de carga)', () => {
    const c = createContext({ console })
    runInContext(extraer(core, [
      'compareDocInformeActN',
      'compareDocInformeActK',
      'ordenarDocsComparablesInformeAnexos'
    ]), c)
    const items = [
      { id: 'a7', label: '📎 Act 7 — Visitas · soporte 1' },
      { id: 'a16', label: '📎 Act 16 — Coadyuvar · soporte 2' },
      { id: 'a1', label: '📎 Act 1 — Acta de inicio · soporte 1' },
      { id: 'a3', label: '📎 Act 3 — visitas · soporte 1' },
      { id: 'a4', label: '📎 Act 4 — Comités · soporte 1' },
      { id: 'a6', label: '📎 Act 6 — Jornadas · soporte 1' },
      { id: 'a7b', label: '📎 Act 7 — Visitas · soporte 2' }
    ]
    const ids = c.ordenarDocsComparablesInformeAnexos(items).map(d => d.id)
    expect(ids).toEqual(['a1', 'a3', 'a4', 'a6', 'a7', 'a7b', 'a16'])
  })
})
