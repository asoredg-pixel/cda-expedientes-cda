/**
 * nca-pin-por-revisar.test.js — 📌 del encargado NCA en Actividades › «Por revisar» (como en «Por ejecutar»):
 * misma lista de fijadas; la PQRSD fijada queda arriba en ambas paletas.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

function montar({ filtro = 'porver', encargado = true, pqrs = true } = {}) {
  const store = {}
  const els = {
    'f-act-est': { value: filtro },
    'pg-act': { classList: { contains: c => c === 'on' } }
  }
  const c = {
    document: { getElementById: id => els[id] || null },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v } },
    responsableActivo: 'Carlos',
    getEncargadoDepto: () => 'Carlos',
    getExpById: id => ({ _exp: id }),
    taskEsAtenderPqrs: () => pqrs,
    jsStr: s => String(s || ''),
    ncaEncargadoSesionPqrsPin: () => encargado,
    renderPqrsOficinaInbox: () => {},
    notif: () => {},
    window: {}
  }
  createContext(c)
  runInContext('const NCA_PQRS_PIN_LS="sst_nca_pqrs_pin_por_ejecutar";\nconst NCA_PQRS_PIN_MIGRADO_LS="sst_nca_pqrs_pin_migrado";\n' + extraerFunciones(read('js/pqrs.js'), [
    'ncaPinEnPorRevisarAct', 'ncaActPinKey', 'ncaActPinBtnHtml', 'ncaPqrsPinUsuarioKey',
    'ncaPqrsPinsNorm', 'ncaPqrsPinsLeerLocal', 'ncaPqrsPinsGuardarLocal', 'ncaPqrsPinsPersistFirestore',
    'ncaPqrsPinsLeer', 'ncaPqrsPinsGuardar', 'ncaPqrsEstaFijada',
    'toggleNcaPqrsPinPorEjecutar', 'ordenarActividadesNcaPinsPrimero', 'ncaPqrsPinBtnHtml'
  ]), c)
  return c
}

describe('📌 en «Por revisar» (encargado NCA)', () => {
  it('se ofrece en Por revisar para PQRSD, expedientes y actividades sin expediente, solo al encargado', () => {
    expect(montar().ncaPinEnPorRevisarAct({ exp: 'Q-1' }, { _exp: 'Q-1' })).toBe(true)
    expect(montar({ pqrs: false }).ncaPinEnPorRevisarAct({ exp: 'PAF-0009-21' }, { _exp: 'PAF-0009-21' })).toBe(true)
    expect(montar({ pqrs: false }).ncaPinEnPorRevisarAct({ exp: 'ACT-77', sinExpediente: true }, null)).toBe(true)
    expect(montar({ filtro: 'pend' }).ncaPinEnPorRevisarAct({ exp: 'Q-1' }, { _exp: 'Q-1' })).toBe(false)
    expect(montar({ encargado: false }).ncaPinEnPorRevisarAct({ exp: 'Q-1' }, { _exp: 'Q-1' })).toBe(false)
  })

  it('al fijar, la fila sube primero sin perder otras filas del mismo expediente', () => {
    const c = montar()
    c.toggleNcaPqrsPinPorEjecutar('ACT-77')
    const out = c.ordenarActividadesNcaPinsPrimero([
      { exp: 'Q-1', id: 'a' }, { exp: 'ACT-77', id: 'b' }, { exp: 'Q-1', id: 'c' }
    ])
    expect(out.map(t => t.id)).toEqual(['b', 'a', 'c'])
    c.toggleNcaPqrsPinPorEjecutar('Q-1')
    const out2 = c.ordenarActividadesNcaPinsPrimero([
      { exp: 'Q-3', id: 'x' }, { exp: 'Q-1', id: 'a' }, { exp: 'ACT-77', id: 'b' }, { exp: 'Q-1', id: 'c' }
    ])
    expect(out2.map(t => t.id)).toEqual(['a', 'c', 'b', 'x'])
    expect(c.ncaActPinBtnHtml({ exp: 'ACT-77', sinExpediente: true }, null)).toContain('Desfijar')
  })

  it('la fila de Por revisar pinta el botón y la lista se ordena con las fijadas', () => {
    const src = read('js/core.js')
    expect(src).toContain("if(typeof ncaPinEnPorRevisarAct==='function'&&ncaPinEnPorRevisarAct(t,expAct)){")
    expect(src).toContain('ordenarActividadesNcaPinsPrimero(sortTasksPorRevisar(list))')
  })
})
