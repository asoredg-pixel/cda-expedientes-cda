/**
 * Anexo del correo de una PQRSD: se abre en ventana con cierre, encima del visor.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
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

describe('ventana del anexo del correo', () => {
  it('el visor queda por encima de la PQRSD y se cierra con la X', () => {
    expect(css).toContain('#ciudadano-doc-overlay.pqrs-att-ventana-on')
    expect(css).toContain('z-index:100200')
    expect(css).toContain('height:min(84vh,calc(100vh - 140px))!important')
    expect(pqrs).toContain("ov.classList.remove('on','pqrs-att-ventana-on')")
  })

  it('un pdf del correo abre la ventana y no el panel de abajo', () => {
    const c = createContext({
      document: {
        getElementById: id => {
          if (id === 'ciudadano-doc-overlay') return c.ov
          if (id === 'ciudadano-doc-iframe') return c.ifr
          if (id === 'ciudadano-doc-foot') return c.foot
          if (id === 'pqrs-origen-att-inline') return c.inline
          if (id === 'pqrs-origen-att-inline-body') return { innerHTML: '' }
          return null
        },
        querySelector: () => c.stage
      },
      openCiudadanoDocViewer: (url, nombre) => { c.abierto = { url, nombre } },
      URL: { createObjectURL: () => 'blob:anexo', revokeObjectURL: () => {} },
      atob: s => s,
      Blob: function Blob() {},
      Uint8Array: Array,
      escAttr: s => String(s || ''),
      window: {}
    })
    c.ov = { classList: { add: name => { c.clases.push(name) } } }
    c.ifr = { src: '' }
    c.foot = { innerHTML: 'Vista previa del archivo cargado.', insertAdjacentHTML: (pos, html) => { c.foot.innerHTML += html } }
    c.inline = { classList: { add() { c.inlineAbrio = true } }, setAttribute() {} }
    c.stage = { classList: { add() { c.stageAbrio = true } } }
    c.clases = []
    c.window = c
    runInContext(extraer(core, ['abrirPqrsAnexoVentana', 'mostrarPqrsOrigenAttInlineBlob']), c)
    const b64 = Buffer.from('%PDF-1').toString('base64')
    c.mostrarPqrsOrigenAttInlineBlob('RESPUESTA.pdf', 'application/pdf', b64)
    expect(c.abierto.nombre).toBe('RESPUESTA.pdf')
    expect(c.abierto.url).toBe('blob:anexo')
    expect(c.clases).toContain('pqrs-att-ventana-on')
    expect(c.inlineAbrio).toBeUndefined()
    expect(c.stageAbrio).toBeUndefined()
    expect(c.foot.innerHTML).toContain('Descargar')
  })
})
