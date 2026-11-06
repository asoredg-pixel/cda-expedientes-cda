/**
 * Consulta ciudadana: documentos del expediente consultado separados
 * de los de cada PQRSD o expediente asociado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctx() {
  const c = createContext({
    escAttr: s => String(s == null ? '' : s)
  })
  runInContext(extraer(pqrs, [
    'ciudadanoDocsOrdenReciente', 'ciudadanoDocsGrupoDe', 'ciudadanoDocTipoVisible',
    'ciudadanoDocCardHtml', 'ciudadanoDocsHtmlAgrupado'
  ]), c)
  return c
}

describe('Consulta ciudadana — documentos por expediente', () => {
  it('separa la solicitud consultada de cada asociado y no mezcla', () => {
    const c = ctx()
    const html = c.ciudadanoDocsHtmlAgrupado([
      { label: 'Solicitud radicada', tipo: 'Soporte de radicación', url: 'a', fecha: '2026-10-26' },
      { label: 'Concepto No. 26541', tipo: 'Exp. asociado · PAF-00335-22 · Concepto de seguimiento', grupo: 'Exp. asociado · PAF-00335-22', url: 'b', fecha: '2026-11-01', mime: 'application/pdf' },
      { label: 'Concepto No. 26580', tipo: 'Exp. asociado · PAF-00335-22 · Concepto de seguimiento', grupo: 'Exp. asociado · PAF-00335-22', url: 'c', fecha: '2026-11-10', mime: 'application/pdf' },
      { label: 'Oficio QR', tipo: 'PQRSD asociada · QR260099 · Respuesta', grupo: 'PQRSD asociada · QR260099', url: 'd', fecha: '2026-10-30' }
    ], { expId: 'XJ260505', propioTit: 'Esta solicitud · XJ260505', vacio: 'Sin documentos' })
    const iSol = html.indexOf('Esta solicitud · XJ260505')
    const iPaf = html.indexOf('Exp. asociado · PAF-00335-22')
    const iQr = html.indexOf('PQRSD asociada · QR260099')
    expect(iSol).toBeGreaterThanOrEqual(0)
    expect(iPaf).toBeGreaterThan(iSol)
    expect(iQr).toBeGreaterThan(iPaf)
    expect(html.indexOf('Solicitud radicada')).toBeLessThan(iPaf)
    expect(html.indexOf('Concepto No. 26580')).toBeGreaterThan(iPaf)
    expect(html.indexOf('Concepto No. 26580')).toBeLessThan(html.indexOf('Concepto No. 26541'))
    expect(html).not.toContain('Exp. asociado · PAF-00335-22 · Concepto')
    expect(html).toContain('Concepto de seguimiento')
  })

  it('sin asociados deja la lista plana, sin títulos de grupo', () => {
    const c = ctx()
    const html = c.ciudadanoDocsHtmlAgrupado([
      { label: 'Soporte de radicación', tipo: 'Soporte de radicación', url: 'a', fecha: '2026-01-01' }
    ], { expId: 'QR1', propioTit: 'Esta solicitud · QR1' })
    expect(html).toContain('Soporte de radicación')
    expect(html).not.toContain('ciudadano-docs-grupo')
    expect(html).not.toContain('Esta solicitud')
  })
})
