/**
 * act-responsable-picker.test.js — Actividades (encargado): selector de responsable como lista HTML
 * (igual a «Actividad predeterminada» en autoentrega) en vez del <select> nativo que tardaba en pintarse.
 * El <select> sigue oculto como fuente del valor.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

function montar(nombres, idxSel) {
  const options = nombres.map((t, i) => ({ value: t, textContent: t, index: i }))
  const sel = { options, selectedIndex: idxSel || 0 }
  const inp = { value: '', blur() { this.blurred = true }, select() {} }
  const portal = { style: { display: 'none' }, innerHTML: '' }
  const els = { 'act-dept-resp-sel': sel, 'act-dept-resp-inp': inp, 'act-dept-resp-sug': portal }
  let renders = 0
  const c = createContext({
    document: {
      activeElement: null,
      getElementById: id => els[id] || null,
      querySelector: () => {
        const m = portal.innerHTML.match(/data-idx="(\d+)"/)
        return m ? { getAttribute: () => m[1] } : null
      }
    },
    escAttr: s => String(s),
    renderActividades: () => { renders++ }
  })
  runInContext(extraer(core, ['actRespPickSyncInput', 'actRespPickFiltrar', 'actRespPickAbrir',
    'actRespPickElegir', 'actRespPickCerrar', 'actRespPickKey']), c)
  return { c, sel, inp, portal, renders: () => renders }
}

describe('Selector de responsable en Actividades', () => {
  it('index.html: select oculto + input con lista', () => {
    expect(html).toMatch(/<select id="act-dept-resp-sel" style="display:none" onchange="renderActividades\(\)"><\/select>/)
    expect(html).toMatch(/id="act-dept-resp-inp"[^>]*onfocus="actRespPickAbrir\(this\)"/)
    expect(html).toMatch(/id="act-dept-resp-sug" class="entrega-resp-sug"/)
  })

  it('al enfocar muestra todos los responsables', () => {
    const m = montar(['Ana · Encargado', 'Luis', 'Todos los responsables'])
    m.c.actRespPickAbrir(m.inp)
    expect(m.portal.style.display).toBe('block')
    expect((m.portal.innerHTML.match(/entrega-resp-sug-btn/g) || []).length).toBe(3)
  })

  it('al escribir filtra por palabras', () => {
    const m = montar(['Ana Pérez · Encargado', 'Luis Gómez', 'Todos los responsables'])
    m.inp.value = 'luis'
    m.c.actRespPickFiltrar(m.inp)
    expect(m.portal.innerHTML).toContain('Luis Gómez')
    expect(m.portal.innerHTML).not.toContain('Ana Pérez')
  })

  it('elegir cambia el select, muestra el nombre y re-renderiza', () => {
    const m = montar(['Ana', 'Luis', 'Todos los responsables'], 0)
    m.c.actRespPickElegir(1)
    expect(m.sel.selectedIndex).toBe(1)
    expect(m.inp.value).toBe('Luis')
    expect(m.portal.style.display).toBe('none')
    expect(m.renders()).toBe(1)
  })

  it('elegir el mismo no re-renderiza', () => {
    const m = montar(['Ana', 'Luis'], 1)
    m.c.actRespPickElegir(1)
    expect(m.renders()).toBe(0)
  })

  it('Enter elige la primera coincidencia; cerrar restaura el nombre actual', () => {
    const m = montar(['Ana', 'Luis', 'Todos los responsables'], 0)
    m.inp.value = 'tod'
    m.c.actRespPickFiltrar(m.inp)
    m.c.actRespPickKey({ key: 'Enter', preventDefault() {} }, m.inp)
    expect(m.sel.selectedIndex).toBe(2)
    m.inp.value = 'xx'
    m.c.actRespPickCerrar()
    expect(m.inp.value).toBe('Todos los responsables')
  })

  it('poblarActDeptRespSel sincroniza el texto del input', () => {
    expect(core).toMatch(/if\(inp&&document\.activeElement!==inp\)actRespPickSyncInput\(\);\r?\n\}/)
  })
})
