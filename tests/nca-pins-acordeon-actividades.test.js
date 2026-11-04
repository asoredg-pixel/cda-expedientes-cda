/**
 * nca-pins-acordeon-actividades.test.js — Actividades › Por ejecutar / Por revisar:
 * las filas fijadas del encargado NCA van en un acordeón contraíble (barra encima de la tabla).
 * Por defecto contraído solo si hay ≥ 3 fijadas visibles; preferencia en sessionStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')

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

function makeTr(cls, withLbl) {
  const children = Array.from({ length: 8 }, () => ({ tagName: 'TD' }))
  const tr = {
    className: cls || '',
    classList: {
      _s: new Set(String(cls || '').split(/\s+/).filter(Boolean)),
      add(c) { this._s.add(c); tr.className = [...this._s].join(' ') },
      remove(c) { this._s.delete(c); tr.className = [...this._s].join(' ') },
      contains(c) { return this._s.has(c) }
    },
    children,
    style: { display: '' },
    parentNode: null,
    querySelector(sel) {
      if (sel === '.pqrs-nca-pin-lbl' && withLbl) return { className: 'pqrs-nca-pin-lbl' }
      return null
    }
  }
  return tr
}

function makeTbody(pinCount, restCount) {
  const rows = []
  for (let i = 0; i < pinCount; i++) rows.push(makeTr('pqrs-nca-pinned', true))
  for (let i = 0; i < restCount; i++) rows.push(makeTr('', false))
  const tbody = {
    tagName: 'TBODY',
    id: 'tbl-act',
    _rows: rows,
    querySelectorAll(sel) {
      if (sel === 'tr.pqrs-nca-pinned') return this._rows.filter(r => r.classList.contains('pqrs-nca-pinned'))
      if (sel === 'tr.nca-pins-acc-hd') return this._rows.filter(r => String(r.className || '').includes('nca-pins-acc-hd'))
      if (sel === 'tr') return this._rows.slice()
      return []
    },
    querySelector() { return null }
  }
  rows.forEach(r => { r.parentNode = tbody })
  return tbody
}

function ctx() {
  const store = {}
  const sessionStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null },
    setItem(k, v) { store[k] = String(v) },
    removeItem(k) { delete store[k] },
    _store: store
  }
  let barEl = null
  const tbody = makeTbody(0, 0)
  const table = { tagName: 'TABLE', tBodies: [tbody], querySelector: () => tbody }
  const wrap = {
    id: 'act-table-wrap',
    firstChild: table,
    children: [table],
    querySelector(sel) { return sel === 'table' ? table : null },
    insertBefore(node, ref) {
      this.children.unshift(node)
      this.firstChild = this.children[0]
      if (node && node.id === 'nca-pins-acc-bar') barEl = node
      return node
    }
  }
  const els = { 'tbl-act': tbody, 'act-table-wrap': wrap, 'nca-pins-acc-bar': null, 'f-act-est': { value: 'porver' } }
  const document = {
    getElementById(id) {
      if (id === 'nca-pins-acc-bar') return barEl
      return els[id] || null
    },
    createElement(tag) {
      const el = {
        tagName: String(tag).toUpperCase(),
        type: '',
        id: '',
        className: '',
        title: '',
        innerHTML: '',
        onclick: null,
        style: {},
        setAttribute() {},
        parentNode: null
      }
      return el
    },
    querySelector(sel) {
      if (sel === '#act-table-wrap table') return table
      return null
    }
  }
  const c = createContext({
    window: {},
    console,
    sessionStorage,
    document,
    NCA_PINS_ACC_MIN: 3,
    NCA_PINS_ACC_LS: 'sst_nca_pins_acc_',
    ncaEncargadoSesionPqrsPin: () => true,
    markUltimaFilaFijadaNca: () => {},
    _barRef: () => barEl,
    _setPins(n) {
      const tb = makeTbody(n, 2)
      els['tbl-act'] = tb
      table.tBodies = [tb]
      barEl = null
    }
  })
  const bloqIni = core.indexOf('const NCA_PINS_ACC_MIN=3')
  if (bloqIni < 0) throw new Error('NCA_PINS_ACC_MIN no encontrado')
  const names = [
    'ncaPinsAcordeonFiltroOk',
    'ncaPinsAcordeonEstaColapsado',
    'ncaPinsAcordeonGuardar',
    'ncaPinsFilasEnTbody',
    'ncaPinsAcordeonQuitarBarra',
    'toggleAcordeonFijadasAct',
    'aplicarAcordeonFijadasAct'
  ]
  const funcs = extraer(core, names)
  const consts = core.slice(bloqIni, core.indexOf('function ncaPinsAcordeonFiltroOk'))
  runInContext(consts + '\n' + funcs, c)
  return c
}

describe('Acordeón de fijadas en Actividades', () => {
  let c
  beforeEach(() => { c = ctx() })

  it('sin preferencia: < 3 expandido; ≥ 3 contraído', () => {
    expect(c.ncaPinsAcordeonEstaColapsado('pend', 2)).toBe(false)
    expect(c.ncaPinsAcordeonEstaColapsado('pend', 3)).toBe(true)
    expect(c.ncaPinsAcordeonEstaColapsado('porver', 5)).toBe(true)
  })

  it('sessionStorage manda sobre el umbral', () => {
    c.ncaPinsAcordeonGuardar('pend', false)
    expect(c.ncaPinsAcordeonEstaColapsado('pend', 10)).toBe(false)
    c.ncaPinsAcordeonGuardar('pend', true)
    expect(c.ncaPinsAcordeonEstaColapsado('pend', 1)).toBe(true)
  })

  it('solo aplica en pend / porver', () => {
    expect(c.ncaPinsAcordeonFiltroOk('pend')).toBe(true)
    expect(c.ncaPinsAcordeonFiltroOk('porver')).toBe(true)
    expect(c.ncaPinsAcordeonFiltroOk('porcorr')).toBe(false)
  })

  it('con ≥ 3 fijadas crea barra encima y oculta las filas', () => {
    c._setPins(4)
    const table = c.document.getElementById('act-table-wrap').querySelector('table')
    c.aplicarAcordeonFijadasAct(table, 'porver')
    const bar = c._barRef()
    expect(bar).toBeTruthy()
    expect(bar.id).toBe('nca-pins-acc-bar')
    expect(String(bar.className)).toMatch(/is-collapsed/)
    expect(String(bar.innerHTML)).toMatch(/Fijadas \(4\)/)
    expect(String(bar.innerHTML)).toMatch(/clic para ver/)
    const pins = c.ncaPinsFilasEnTbody(c.document.getElementById('tbl-act'))
    expect(pins.every(p => p.style.display === 'none')).toBe(true)
  })

  it('sin sesión NCA pin no crea barra', () => {
    c.ncaEncargadoSesionPqrsPin = () => false
    c._setPins(5)
    const table = c.document.getElementById('act-table-wrap').querySelector('table')
    c.aplicarAcordeonFijadasAct(table, 'porver')
    expect(c._barRef()).toBe(null)
  })

  it('detecta fijadas por etiqueta si falta la clase', () => {
    const tb = c.document.getElementById('tbl-act')
    const onlyLbl = makeTr('', true)
    onlyLbl.parentNode = tb
    tb._rows = [onlyLbl]
    expect(c.ncaPinsFilasEnTbody(tb).length).toBe(1)
  })

  it('renderActividades y pintarActividadesPorTexto llaman al acordeón', () => {
    const hits = core.match(/aplicarAcordeonFijadasAct\(tblAct,filtroAct\)/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('CSS de barra de acordeón presente', () => {
    expect(css).toMatch(/\.nca-pins-acc-bar\s*\{/)
    expect(css).toMatch(/nca-pins-acc-bar\.is-collapsed/)
  })
})
