/**
 * refresh-remoto-debounce.test.js — Los snapshots de Firestore llegan en ráfagas: un solo repintado,
 * sin pintar dos veces la pestaña activa, y sin repintar con un <select> abierto (lista gris en Chrome).
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

function montar() {
  const timers = []
  const pintados = { tab: 0, act: 0, bandeja: 0 }
  const c = {
    console, timers, pintados,
    _sstRemoteRefreshTimer: null,
    setTimeout: (fn) => { timers.push(fn); return timers.length },
    clearTimeout: (id) => { if (id) timers[id - 1] = null },
    document: { activeElement: null, getElementById: () => ({ classList: { contains: () => true } }) },
    window: {},
    renderTabActual: () => { pintados.tab++ },
    renderActividades: () => { pintados.act++ },
    renderBandejaDepto: () => { pintados.bandeja++ }
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/persistence.js'),
    ['refreshViewsAfterRemoteDataChange', 'scheduleRefreshViewsAfterRemoteDataChange']), c)
  c.correrTimers = () => { const fs = timers.splice(0); fs.forEach(f => f && f()) }
  return c
}

describe('Repintado tras cambios remotos', () => {
  it('una ráfaga de snapshots produce un solo repintado', () => {
    const c = montar()
    c.scheduleRefreshViewsAfterRemoteDataChange()
    c.scheduleRefreshViewsAfterRemoteDataChange()
    c.scheduleRefreshViewsAfterRemoteDataChange()
    c.correrTimers()
    expect(c.pintados.tab).toBe(1)
  })

  it('no pinta dos veces la pestaña activa ni la bandeja', () => {
    const c = montar()
    c.refreshViewsAfterRemoteDataChange()
    expect(c.pintados.tab).toBe(1)
    expect(c.pintados.act).toBe(0)
    expect(c.pintados.bandeja).toBe(0)
  })

  it('con un selector abierto espera a que el usuario elija o salga', () => {
    const c = montar()
    const ls = {}
    const sel = {
      tagName: 'SELECT',
      addEventListener: (ev, fn) => { ls[ev] = fn },
      removeEventListener: (ev) => { delete ls[ev] }
    }
    c.document.activeElement = sel
    c.scheduleRefreshViewsAfterRemoteDataChange()
    c.correrTimers()
    expect(c.pintados.tab).toBe(0)
    c.scheduleRefreshViewsAfterRemoteDataChange()
    c.correrTimers()
    expect(c.pintados.tab).toBe(0)
    ls.change()
    expect(ls.blur).toBeUndefined()
    c.correrTimers()
    expect(c.pintados.tab).toBe(1)
  })

  it('los listeners de Firestore usan el repintado agrupado', () => {
    const src = read('js/persistence.js')
    expect((src.match(/^\s+scheduleRefreshViewsAfterRemoteDataChange\(\);/gm) || []).length).toBe(3)
  })
})
