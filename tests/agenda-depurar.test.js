/**
 * La agenda no conserva lo agendado hace más de tres meses.
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

describe('Agenda: borrar lo agendado hace más de 3 meses', () => {
  const c = createContext({})
  runInContext(extraer(core, ['agendaListaSinVencidas']), c)

  it('quita la fecha anterior al corte y conserva la reciente y la que no tiene fecha', () => {
    const out = c.agendaListaSinVencidas([
      { id: 'viejo', fecha: '2026-01-01' },
      { id: 'limite', fecha: '2026-07-30' },
      { id: 'nuevo', fecha: '2026-10-01' },
      { id: 'sinf', titulo: 'sin fecha' }
    ], '2026-07-30')
    expect(out.quito).toBe(true)
    expect(out.lista.map(ev => ev.id)).toEqual(['limite', 'nuevo', 'sinf'])
  })

  it('no marca cambios si todo sigue dentro de los tres meses', () => {
    const out = c.agendaListaSinVencidas([{ id: 'a', fecha: '2026-10-01' }], '2026-07-30')
    expect(out.quito).toBe(false)
    expect(out.lista).toHaveLength(1)
  })
})
