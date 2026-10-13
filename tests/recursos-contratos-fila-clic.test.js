/**
 * recursos-contratos-fila-clic.test.js — Recursos › Contratos: clic en el recuadro (fila)
 * abre la carpeta o el archivo, no solo el botón «Abrir» (sin abrir dos veces).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rec = readFileSync(resolve(root, 'js/recursos.js'), 'utf8')

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

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

describe('Recursos › Contratos: clic en el recuadro', () => {
  it('Drive: la fila de carpeta y de archivo tienen onclick; el botón no duplica', () => {
    const c = createContext({
      escAttr: esc, responsableActivo: 'Marcela Chara', actividadesLibres: [], setTimeout: () => {},
      _driveGetBestToken: () => 'tok',
      window: {
        _recContratosDrivePath: [{ id: 'c1', name: '234 MARCELA CHARA' }, { id: 'i1', name: 'Informe 1' }],
        _recContratosDrive: { hijos: { i1: [
          { id: 's1', name: 'Soportes Informe 1', esCarpeta: true },
          { id: 'f1', name: 'Informe 1 - 234 MARCELA CHARA.pdf', esCarpeta: false }
        ] } }
      }
    })
    runInContext(extraer(rec, ['recursosContratosLead', 'renderRecursosContratosPanel']), c)
    const h = c.renderRecursosContratosPanel()
    expect(h).toContain('<div class="rec-file-row" style="cursor:pointer" onclick="recursosContratosDriveAbrir(0)">')
    expect(h).not.toMatch(/<button[^>]*onclick="recursosContratosDriveAbrir/)
    expect(h).toContain('onclick="window.open(\'https://drive.google.com/file/d/f1/view\',\'_blank\',\'noopener\')"')
    expect(h).toContain('onclick="event.stopPropagation()">Abrir</a>')
  })

  it('Registros: la fila de carpeta abre al hacer clic', () => {
    expect(rec).toMatch(/rec-file-row" style="cursor:pointer" onclick="recursosContratosIr\(/)
    expect(rec).not.toMatch(/<button type="button" class="btn bsm" onclick="recursosContratosIr/)
  })
})
