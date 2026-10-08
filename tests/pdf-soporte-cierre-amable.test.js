/**
 * pdf-soporte-cierre-amable.test.js — Soportes PDF de notificación / respuesta:
 * tras el cuerpo del correo se agrega «Atentamente,», espacio de firma, línea y «Dirección Seccional Guaviare».
 * Si el cuerpo ya trae su cierre, no se duplica. Radicación no cambia.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

function ctx() {
  const c = createContext({ cdaPdfContentBottomY: () => 700 })
  runInContext(extraer(core, ['pdfCuerpoTieneCierre', 'pdfWriteCierreAmable']) +
    '\nthis._tiene=pdfCuerpoTieneCierre;this._cierre=pdfWriteCierreAmable;', c)
  return c
}

function docFake() {
  const out = { textos: [], fonts: [], paginas: 1 }
  return {
    out,
    internal: { pageSize: { getHeight: () => 842 } },
    setFont: (f, s) => out.fonts.push(s),
    setFontSize: () => {},
    text: (t, x, y) => out.textos.push({ t, x, y }),
    addPage: () => { out.paginas++ }
  }
}

describe('Cierre amable en soportes de notificación', () => {
  it('escribe Atentamente, espacio de firma, línea y Dirección Seccional Guaviare', () => {
    const c = ctx()
    const d = docFake()
    const y = c._cierre(d, 300, 48, 13)
    const t = d.out.textos.map(x => x.t)
    expect(t).toEqual(['Atentamente,', '_____________________________', 'Dirección Seccional Guaviare'])
    expect(d.out.textos[1].y - d.out.textos[0].y).toBeGreaterThanOrEqual(40)
    expect(y).toBeGreaterThan(d.out.textos[2].y)
    expect(d.out.paginas).toBe(1)
  })

  it('si no cabe al final de la página, pasa a una nueva', () => {
    const c = ctx()
    const d = docFake()
    c._cierre(d, 680, 48, 13)
    expect(d.out.paginas).toBe(2)
    expect(d.out.textos[0].y).toBeLessThan(100)
  })

  it('detecta cuerpos que ya traen su propio cierre', () => {
    const c = ctx()
    expect(c._tiene('Buen día,\nLe informamos…\n\nAtentamente,\nJuan Pérez')).toBe(true)
    expect(c._tiene('Le informamos…\nCordialmente,')).toBe(true)
    expect(c._tiene('Buen día,\nLe informamos que su trámite fue aprobado.')).toBe(false)
    expect(c._tiene('Atentamente le informamos que…\nLínea 2\nLínea 3\nLínea 4\nLínea 5')).toBe(false)
  })

  it('se aplica en el soporte de notificación de actividades y en la respuesta PQRSD (solo correo)', () => {
    expect(extraer(core, ['generarPdfSoporteNotificacionActividad']))
      .toContain('if(!pdfCuerpoTieneCierre(cuerpoPrint))y=pdfWriteCierreAmable(doc,y,margin,lineH);')
    const resp = extraer(core, ['generarPdfRespuestaPqrs'])
    expect(resp).toContain('if(esCorreo&&!pdfCuerpoTieneCierre(cuerpoPrint))y=pdfWriteCierreAmable(doc,y,margin,lineH);')
    expect(resp.indexOf('pdfWriteCierreAmable')).toBeLessThan(resp.indexOf('collectDocsParaNotificacionCorreo'))
  })

  it('radicación (solicitud del ciudadano) no lleva cierre', () => {
    expect(extraer(gmail, ['generarPdfSolicitudCorreo', 'generarPdfSolicitudManual'])).not.toContain('pdfWriteCierreAmable')
  })
})
