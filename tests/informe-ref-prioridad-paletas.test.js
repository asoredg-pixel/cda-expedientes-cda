/**
 * informe-ref-prioridad-paletas.test.js — Informes de contrato en Actividades:
 * Ref. «Informe de actividades N° n» y primeros en Por revisar / Por corregir.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

function ctx(vivas) {
  const c = createContext({
    getTaskAny: (exp, id) => (vivas || {})[id] || null,
    escAttr: s => String(s),
    esModoResponsable: () => true
  })
  runInContext(extraer(core, ['actInformeContratoDe', 'actInformeContratoRefTxt', 'ordenarInformesContratoPrimero', 'actRefCellHtml']), c)
  return c
}

describe('Informes de contrato en Actividades', () => {
  it('Ref.: «Informe de actividades N° n» en lugar del código ACT', () => {
    const c = ctx({ t2: { informeContrato: { n: 3 } } })
    expect(c.actInformeContratoRefTxt({ id: 't1', informeContrato: { n: 2 } })).toBe('Informe de actividades N° 2')
    expect(c.actInformeContratoRefTxt({ id: 't2', codigo: 'ACT-9' })).toBe('Informe de actividades N° 3')
    expect(c.actInformeContratoRefTxt({ id: 't3', codigo: 'ACT-1' })).toBe('')
    expect(c.actRefCellHtml({ id: 't1', exp: 'ACT-5', sinExpediente: true, codigo: 'ACT-5', informeContrato: { n: 1 } })).toContain('Informe de actividades N° 1')
    expect(c.actRefCellHtml({ id: 't9', exp: 'EXP-1' })).toContain('EXP-1')
  })

  it('orden: informes primero, el resto conserva su orden', () => {
    const c = ctx({ b: { informeContrato: { n: 1 } } })
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', informeContrato: { n: 2 } }]
    expect(c.ordenarInformesContratoPrimero(list).map(t => t.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('se aplica en Por revisar y Por corregir (después de fijadas y urgencia) y en el Excel', () => {
    expect(extraer(core, ['renderActividades'])).toContain("if(filtroAct==='porver'||filtroAct==='porcorr')list=ordenarInformesContratoPrimero(list);")
    expect(extraer(core, ['exportarActividadesExcel'])).toContain('actInformeContratoRefTxt(t)||t.exp||t.codigo')
  })
})
