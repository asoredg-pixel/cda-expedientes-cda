/**
 * informe-anexos-pestana-por-actividad.test.js — Al revisar un informe de contrato, las pestañas de anexos
 * indican la actividad («Act 1», «Act 4 · 1», «Act 4 · 2») en vez de «Anexo 1, Anexo 2…».
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

const c = createContext({
  soporteEsDocRadicacion: () => false,
  soporteEsAnexoEntrega: s => s.es_anexo === true,
  soporteEsDocumentoNotificado: () => false,
  soporteEsDocumentoFirmado: () => false
})
runInContext(extraer(core, ['soporteInformeActN', 'soporteInformeActK', 'soportesOrdenTabsInforme', 'soporteTabLabel']), c)

describe('Informe de contrato: pestañas de anexos por actividad', () => {
  const sops = [
    { id: 'p', label: 'Documento principal' },
    { id: 'a1', es_anexo: true, informe_act: { n: 1, nombre: 'Actas' }, label: 'Act 1 — Actas · soporte 1' },
    { id: 'a4a', es_anexo: true, informe_act: { n: 4, nombre: 'Visitas' }, label: 'Act 4 — Visitas · soporte 1' },
    { id: 'a4b', es_anexo: true, informe_act: { n: 4, nombre: 'Visitas' }, label: 'Act 4 — Visitas · soporte 2' },
    { id: 'a12', es_anexo: true, label: 'Act 12 — Capacitación · soporte 1' }
  ]
  const lbl = id => c.soporteTabLabel(sops.find(s => s.id === id), 0, sops)

  it('un solo anexo de la actividad: «Act N»', () => {
    expect(lbl('a1')).toBe('Act 1')
  })

  it('varios anexos de la misma actividad: «Act N · 1», «Act N · 2»', () => {
    expect(lbl('a4a')).toBe('Act 4 · 1')
    expect(lbl('a4b')).toBe('Act 4 · 2')
  })

  it('entregas antiguas sin informe_act: se toma la actividad de la etiqueta', () => {
    expect(lbl('a12')).toBe('Act 12')
  })

  it('anexos de PQRSD/trámite siguen como «Anexo N»', () => {
    const otros = [{ id: 'x', es_anexo: true, label: 'Anexo 1' }, { id: 'y', es_anexo: true, label: 'Anexo 2' }]
    expect(c.soporteTabLabel(otros[1], 1, otros)).toBe('Anexo 2')
  })

  it('pestañas ordenadas: proyecciones primero, luego Act 1, 3, 4… (menor a mayor)', () => {
    const desord = [
      { id: 'a11', es_anexo: true, informe_act: { n: 11 }, label: 'Act 11 — X · soporte 1' },
      { id: 'proy', label: 'Proy. v3 · activa', es_proyeccion: true },
      { id: 'a1b', es_anexo: true, informe_act: { n: 1 }, label: 'Act 1 — Y · soporte 2' },
      { id: 'a3', es_anexo: true, informe_act: { n: 3 }, label: 'Act 3 — Z · soporte 1' },
      { id: 'a1a', es_anexo: true, informe_act: { n: 1 }, label: 'Act 1 — Y · soporte 1' },
      { id: 'a4', es_anexo: true, informe_act: { n: 4 }, label: 'Act 4 — W · soporte 1' }
    ]
    expect(c.soportesOrdenTabsInforme(desord).map(s => s.id))
      .toEqual(['proy', 'a1a', 'a1b', 'a3', 'a4', 'a11'])
  })

  it('al pasar el mouse por la pestaña se ve la actividad completa', () => {
    expect(core).toContain("const tip=soporteInformeActN(s)?String(s.label||'').replace(/\\s*·\\s*por corregir/i,'').trim():'';")
  })

  it('el panel de revisión aplica el orden de pestañas del informe', () => {
    expect(extraer(core, ['renderTaskSoportePanelHtml'])).toContain('soportesOrdenTabsInforme(soportes)')
  })
})
