/**
 * nca-fijar-por-revisar-por-actividad.test.js — En «Por revisar» el 📌 del encargado fija solo la actividad elegida,
 * no todas las del mismo expediente/PQRSD. En «Por ejecutar» sigue por número.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* aún incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctx(filtro, pins) {
  const c = createContext({
    document: { getElementById: id => id === 'f-act-est' ? { value: filtro } : null },
    ncaEncargadoSesionPqrsPin: () => true,
    ncaPqrsPinsLeer: () => pins
  })
  runInContext(extraer(pqrs, ['ncaActPinKey', 'ordenarActividadesNcaPinsPrimero']), c)
  return c
}

const resol = { id: 't1', exp: 'PAF-00326-19', actividad: 'Resolución que modifica' }
const cobro = { id: 't2', exp: 'PAF-00326-19', actividad: 'Cobro persuasivo' }
const otra = { id: 't3', exp: 'PAF-00107-21', actividad: 'Resolución de archivo' }

describe('Fijar en Por revisar por actividad', () => {
  it('la clave en Por revisar incluye la actividad; en Por ejecutar es el número', () => {
    expect(ctx('porver', []).ncaActPinKey(resol, null)).toBe('PAF-00326-19#t1')
    expect(ctx('pend', []).ncaActPinKey(resol, null)).toBe('PAF-00326-19')
  })

  it('fijar la resolución no sube el cobro persuasivo del mismo expediente', () => {
    const c = ctx('porver', ['PAF-00326-19#t1'])
    const out = c.ordenarActividadesNcaPinsPrimero([otra, cobro, resol], true)
    expect(out.map(t => t.id)).toEqual(['t1', 't3', 't2'])
  })

  it('una fijada antigua por número ya no fija todas en Por revisar', () => {
    const c = ctx('porver', ['PAF-00326-19'])
    const out = c.ordenarActividadesNcaPinsPrimero([otra, cobro, resol], true)
    expect(out.map(t => t.id)).toEqual(['t3', 't2', 't1'])
  })

  it('la fila y el orden de Por revisar usan la clave por actividad', () => {
    expect(core).toContain("ncaActPinKey(t,expAct,filPinVal==='porver')")
    expect(core).toContain('ordenarActividadesNcaPinsPrimero(sortTasksPorRevisar(list),true)')
  })
})
