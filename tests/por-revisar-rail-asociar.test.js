/**
 * por-revisar-rail-asociar.test.js — Encargado NCA, paleta Por revisar:
 * el rail vertical de la ventana de revisión incluye 🖇️ Asociar expediente,
 * igual que el rail de Por ejecutar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Function(code); return code } catch (e) { /* aún incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

describe('Rail Por revisar: asociar expediente (encargado NCA)', () => {
  it('el visor de revisión incluye 🖇️ para NCA, como el de Por ejecutar', () => {
    const ver = extraer(core, ['taskReviewActividadVerRailHtml'])
    expect(ver).toContain('taskReviewAsocRailBtnHtml')
    expect(ver).toContain('esNcaRail')
    const origen = extraer(core, ['taskReviewPqrsOrigenRailHtml'])
    expect(origen).toContain('taskReviewAsocRailBtnHtml')
    const full = extraer(core, ['taskActividadToolbarReviewRailHtml'])
    expect(full).toContain('taskReviewAsocRailBtnHtml')
  })
})
