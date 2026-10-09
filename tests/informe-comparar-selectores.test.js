/**
 * informe-comparar-selectores.test.js — En la revisión del informe, las pestañas de soportes
 * (una por actividad) empujaban los selectores ◀ Izq. / Der. ▶ fuera de la barra de comparar.
 * En modo comparar se ocultan las pestañas y los soportes se nombran por actividad.
 */

import { describe, it, expect } from 'vitest'
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

describe('Informe: selectores de comparar documentos', () => {
  it('modo comparar marca la barra para ocultar las pestañas y lo quita al cerrar', () => {
    const fn = extraer(core, ['taskReviewSyncCompareSelect'])
    expect(fn).toContain("if(barSub)barSub.classList.remove('task-review-compare-activo');")
    expect(fn).toContain("if(barSub)barSub.classList.add('task-review-compare-activo');")
    expect(css).toMatch(/\.task-review-doc-bar-sub\.task-review-compare-activo \.task-review-doc-tabs\{\s*display:none;/)
    expect(css).toMatch(/\.task-review-doc-bar-compare \.task-review-doc-tabs\{\s*flex:0 1 auto;\s*min-width:0;/)
  })

  it('soportes del informe se listan por actividad en el selector', () => {
    const c = createContext({})
    runInContext(extraer(core, ['compareDocShortLabel']), c)
    expect(c.compareDocShortLabel({ label: '📎 Act 2 — Visitas · soporte 1', esAnexo: true, meta: '09/10/2026' }))
      .toBe('📎 Act 2 — Visitas · soporte 1 · 09/10/2026')
    expect(c.compareDocShortLabel({ label: '📎 Anexo 3', esAnexo: true, meta: '' })).toBe('Anexo 3')
    expect(c.compareDocShortLabel({ label: 'Act. Visita', esAnexo: true, meta: '' })).toBe('📎 Anexo · Act. Visita')
    const fn = extraer(core, ['collectDocsComparables'])
    expect(fn).toContain("}else if(esAn&&s.informe_act){")
  })
})
