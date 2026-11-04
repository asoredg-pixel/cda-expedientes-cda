/**
 * nca-pins-acordeon-actividades.test.js — Actividades › Por ejecutar / Por revisar:
 * las filas fijadas del encargado NCA van en un acordeón contraíble.
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

function makeTr(cls) {
  const children = Array.from({ length: 8 }, () => ({ tagName: 'TD' }))
  return {
    className: cls || '',
    classList: {
      _s: new Set(String(cls || '').split(/\s+/).filter(Boolean)),
      add(c) { this._s.add(c); this.className = [...this._s].join(' ') },
      remove(c) { this._s.delete(c); this.className = [...this._s].join(' ') },
      contains(c) { return this._s.has(c) }
    },
    children,
    style: { display: '' },
    parentNode: null
  }
}

function makeTbody(pinCount, restCount) {
  const rows = []
  for (let i = 0; i < pinCount; i++) rows.push(makeTr('pqrs-nca-pinned'))
  for (let i = 0; i < restCount; i++) rows.push(makeTr(''))
  const tbody = {
    tagName: 'TBODY',
    _rows: rows,
    querySelectorAll(sel) {
      if (sel === 'tr.pqrs-nca-pinned') return this._rows.filter(r => r.classList.contains('pqrs-nca-pinned'))
      if (sel === 'tr.nca-pins-acc-hd') return this._rows.filter(r => r.classList.contains('nca-pins-acc-hd'))
      if (sel === 'tr.pqrs-nca-pinned-last') return this._rows.filter(r => r.classList.contains('pqrs-nca-pinned-last'))
      return []
    },
    querySelector() { return null },
    insertBefore(tr, ref) {
      const i = this._rows.indexOf(ref)
      if (i < 0) this._rows.unshift(tr)
      else this._rows.splice(i, 0, tr)
      tr.parentNode = this
    }
  }
  rows.forEach(r => { r.parentNode = tbody; r.remove = function () {
    const i = tbody._rows.indexOf(this)
    if (i >= 0) tbody._rows.splice(i, 1)
  } })
  // remove() used on accordion hd via forEach tr.remove
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
  const c = createContext({
    window: {},
    sessionStorage,
    document: { getElementById: () => null },
    NCA_PINS_ACC_MIN: 3,
    NCA_PINS_ACC_LS: 'sst_nca_pins_acc_',
    ncaEncargadoSesionPqrsPin: () => true,
    markUltimaFilaFijadaNca: () => {}
  })
  // Extraer constantes + funciones: las const están justo antes de las functions
  const bloqIni = core.indexOf('const NCA_PINS_ACC_MIN=3')
  if (bloqIni < 0) throw new Error('NCA_PINS_ACC_MIN no encontrado')
  const names = [
    'ncaPinsAcordeonFiltroOk',
    'ncaPinsAcordeonEstaColapsado',
    'ncaPinsAcordeonGuardar',
    'toggleAcordeonFijadasAct',
    'aplicarAcordeonFijadasAct'
  ]
  const funcs = extraer(core, names)
  const consts = core.slice(bloqIni, core.indexOf('function ncaPinsAcordeonFiltroOk'))
  runInContext(consts + '\n' + funcs, c)
  c.window.ncaPinsAcordeonEstaColapsado = c.ncaPinsAcordeonEstaColapsado
  c.window.ncaPinsAcordeonGuardar = c.ncaPinsAcordeonGuardar
  c.window.toggleAcordeonFijadasAct = c.toggleAcordeonFijadasAct
  c.window.aplicarAcordeonFijadasAct = c.aplicarAcordeonFijadasAct
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
    expect(c.ncaPinsAcordeonFiltroOk('done')).toBe(false)
  })

  it('con ≥ 3 fijadas inserta cabecera y oculta las filas', () => {
    const tbody = makeTbody(3, 2)
    // fake createElement / document pieces used by aplicarAcordeonFijadasAct
    const created = []
    c.document = {
      getElementById: () => null,
      createElement(tag) {
        const el = {
          tagName: String(tag).toUpperCase(),
          className: '',
          classList: {
            _s: new Set(),
            add(x) { this._s.add(x); el.className = [...this._s].join(' ') },
            remove(x) { this._s.delete(x); el.className = [...this._s].join(' ') },
            contains(x) { return this._s.has(x) }
          },
          style: {},
          children: [],
          colSpan: 1,
          setAttribute() {},
          appendChild(ch) { this.children.push(ch); ch.parentNode = this },
          innerHTML: '',
          onclick: null,
          onkeydown: null,
          tabIndex: 0,
          title: '',
          remove() {
            if (this.parentNode && this.parentNode._rows) {
              const i = this.parentNode._rows.indexOf(this)
              if (i >= 0) this.parentNode._rows.splice(i, 1)
            }
          }
        }
        created.push(el)
        return el
      }
    }
    // Re-bind document into context after mutation — functions close over global document via context
    runInContext('document = globalThis.document', Object.assign(c, { globalThis: c }))
    // The functions already captured document from createContext; update the same object
    Object.assign(c.document, {
      getElementById: () => null,
      createElement: c.document.createElement
    })

    const table = { tagName: 'TABLE', tBodies: [tbody], querySelector: () => tbody, offsetWidth: 800 }
    c.aplicarAcordeonFijadasAct(table, 'pend')
    const hd = tbody._rows.filter(r => String(r.className || '').includes('nca-pins-acc-hd'))
    expect(hd.length).toBe(1)
    expect(String(hd[0].className)).toMatch(/is-collapsed/)
    const pins = tbody._rows.filter(r => r.classList && r.classList.contains('pqrs-nca-pinned'))
    expect(pins.every(p => p.style.display === 'none')).toBe(true)
    expect(String(hd[0].children[0].innerHTML)).toMatch(/Fijadas \(3\)/)
    expect(String(hd[0].children[0].innerHTML)).toMatch(/clic para ver/)
  })

  it('sin sesión NCA pin no inserta cabecera', () => {
    c.ncaEncargadoSesionPqrsPin = () => false
    const tbody = makeTbody(4, 1)
    const table = { tagName: 'TABLE', tBodies: [tbody], querySelector: () => tbody }
    c.document.createElement = () => { throw new Error('no debería crear') }
    c.aplicarAcordeonFijadasAct(table, 'pend')
    expect(tbody._rows.filter(r => String(r.className || '').includes('nca-pins-acc-hd')).length).toBe(0)
  })

  it('renderActividades y pintarActividadesPorTexto llaman al acordeón', () => {
    expect(core).toMatch(/aplicarAcordeonFijadasAct\(tblAct,filtroAct\)/)
    const hits = core.match(/aplicarAcordeonFijadasAct\(tblAct,filtroAct\)/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('CSS de cabecera sticky presente', () => {
    expect(css).toMatch(/tr\.nca-pins-acc-hd\s*>\s*td/)
    expect(css).toMatch(/position:\s*sticky/)
    expect(css).toMatch(/nca-pins-acc-hd\.is-collapsed/)
  })
})
