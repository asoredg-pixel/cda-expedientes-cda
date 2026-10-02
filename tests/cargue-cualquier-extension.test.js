/**
 * cargue-cualquier-extension.test.js — Entregas (principal / anexos), chats y demás cargues
 * aceptan cualquier extensión (Excel, ZIP, etc.). Solo los «PDF firmado» / oficio notificado siguen en PDF.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

describe('Cargue de archivos sin filtro de extensión', () => {
  it('archivoPermitidoEnviar acepta Excel, ZIP y cualquier otro archivo', () => {
    const core = read('js/core.js')
    const ini = core.indexOf('function archivoPermitidoEnviar(')
    const fin = core.indexOf('\n}', ini) + 2
    const ctx = createContext({})
    runInContext(core.slice(ini, fin) + '\nthis._f=archivoPermitidoEnviar;', ctx)
    expect(ctx._f({ name: 'cuadro.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe(true)
    expect(ctx._f({ name: 'viejo.xls', type: 'application/vnd.ms-excel' })).toBe(true)
    expect(ctx._f({ name: 'planos.dwg', type: '' })).toBe(true)
    expect(ctx._f({ name: 'anexos.zip', type: 'application/zip' })).toBe(true)
    expect(ctx._f(null)).toBe(false)
  })

  it('sstFilePickBlock sin accept no filtra el explorador de Windows', () => {
    const src = read('js/sst-file-upload.js')
    const ini = src.indexOf('function sstFilePickBlock(')
    const fin = src.indexOf('\n}', ini) + 2
    const ctx = createContext({ escAttr: s => String(s), jsStr: s => String(s), sstFileRegisterPick: () => {}, sstFileRegisterList: () => {} })
    runInContext(src.slice(ini, fin) + '\nthis._f=sstFilePickBlock;', ctx)
    expect(ctx._f({ inputId: 'x' })).not.toContain('accept=')
    expect(ctx._f({ inputId: 'y', accept: '.pdf' })).toContain('accept=".pdf"')
  })

  it('entregas, anexos y chats no tienen accept restrictivo', () => {
    const entrega = read('js/entrega-responsable.js')
    expect(entrega).toMatch(/<input type="file" id="enviar-adj-file" style="display:none"/)
    expect(entrega).toMatch(/<input type="file" id="enviar-anexos-file" multiple style="display:none"/)
    expect(read('index.html')).toMatch(/<input type="file" id="chat-file-inp" class="chat-file-inp" onchange=/)
    expect(read('js/core.js')).toMatch(/<input type="file" id="task-chat-file-inp" style="display:none" multiple onchange=/)
    for (const f of ['js/core.js', 'js/entrega-responsable.js', 'js/tramite-firma.js', 'js/pqrs.js']) {
      expect(read(f)).not.toMatch(/accept[=:]\s*['"]\.pdf,\.(doc|jpg|png)/)
    }
  })
})
