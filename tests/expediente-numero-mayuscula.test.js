/**
 * expediente-numero-mayuscula.test.js — Al crear un trámite (responsable o encargado NCA) el N° de expediente
 * queda siempre en mayúscula: se convierte al digitar/pegar y se normaliza al guardar. Los existentes no cambian.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const form = readFileSync(resolve(root, 'js/formulario.js'), 'utf8')
const ge = readFileSync(resolve(root, 'js/guardar-exp.js'), 'utf8')

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

const c = createContext({})
runInContext(extraer(core, ['expNumMayusInput']), c)
const input = (value, s, f) => {
  const el = { value, selectionStart: s ?? value.length, selectionEnd: f ?? value.length, sel: null }
  el.setSelectionRange = (a, b) => { el.sel = [a, b] }
  return el
}

describe('Al digitar el N° de expediente', () => {
  it('minúsculas pasan a mayúscula: paf-00032-21 → PAF-00032-21', () => {
    const el = input('paf-00032-21')
    c.expNumMayusInput(el)
    expect(el.value).toBe('PAF-00032-21')
  })

  it('conserva la posición del cursor al corregir en medio del texto', () => {
    const el = input('PAF-0x12-32', 5, 5)
    c.expNumMayusInput(el)
    expect(el.value).toBe('PAF-0X12-32')
    expect(el.sel).toEqual([5, 5])
  })

  it('si ya está en mayúscula no toca el campo', () => {
    const el = input('PAF-0012-32')
    c.expNumMayusInput(el)
    expect(el.sel).toBeNull()
  })
})

describe('Campos de alta de expediente', () => {
  it('«Crear expediente» en entregas (responsable y encargado) y en vincular actividad libre', () => {
    expect(er).toContain('<input type="text" id="entrega-resp-exp-nuevo" oninput="expNumMayusInput(this)"')
    expect(er).toContain('<input type="text" id="act-libre-vinc-exp-nuevo" oninput="expNumMayusInput(this)"')
    expect(core).toContain('<input type="text" id="entrega-resp-exp-nuevo" oninput="expNumMayusInput(this)"')
  })

  it('Registro: solo el expediente nuevo se convierte; al editar uno existente no', () => {
    expect(form).toContain(`'"'+(ev._exp?'':' oninput="expNumMayusInput(this)"')+' placeholder="EXP-2026-001"`)
  })

  it('al guardar se normaliza a mayúscula (nuevo en Registro y altas desde entregas)', () => {
    expect(extraer(ge, ['guardarExpCore'])).toContain("if(!editId)expId=String(expId||'').trim().toUpperCase();")
    expect(extraer(er, ['crearStubExpedienteEntregaResp'])).toContain("const expId=String(opts.expId||'').trim().toUpperCase();")
    expect(extraer(er, ['crearStubExpedienteDesdeRevisionLibre'])).toContain("const expId=String(opts.expId||'').trim().toUpperCase();")
  })
})
