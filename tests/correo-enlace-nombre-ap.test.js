/**
 * correo-enlace-nombre-ap.test.js —
 * Al notificar, el enlace del correo muestra el nombre de Drive (AP …),
 * no el de «POR FIRMAR». El renombre ocurre antes de armar el HTML.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

describe('Correo: el enlace se ve como en Drive (AP)', () => {
  it('prefiere driveFilename AP aunque el nombre guardado siga en POR FIRMAR', () => {
    const c = createContext({ window: {} })
    runInContext(extraer(read('js/core.js'), ['pqrsNombreLinkCorreo']), c)
    expect(c.pqrsNombreLinkCorreo({
      nombre: 'POR FIRMAR V1 NG260525 OFC.pdf',
      driveFilename: 'AP V1 NG260525 OFC.pdf'
    })).toBe('AP V1 NG260525 OFC.pdf')
    expect(c.pqrsNombreLinkCorreo({
      nombre: 'POR FIRMAR V1 NG260525 OFC.pdf'
    })).toBe('POR FIRMAR V1 NG260525 OFC.pdf')
  })

  it('el HTML de comunicación a entidad usa el nombre AP', () => {
    const c = createContext({
      window: {},
      escAttr: s => String(s || ''),
      getPqrsWorkflow: () => ({ fase: 'por_notificar' }),
      pqrsModoCorreoNotif: () => 'resp_entidad',
      pqrsCuerpoSegunModoCorreo: s => s,
      pqrsCorreoHtmlBloqueTramite: () => '<div>Consulta del trámite</div>'
    })
    runInContext(extraer(read('js/core.js'), ['pqrsNombreLinkCorreo', 'pqrsCorreoHtmlRespuesta']), c)
    const html = c.pqrsCorreoHtmlRespuesta({ _exp: 'NG260525' }, 'Cuerpo', [{
      nombre: 'POR FIRMAR V1 NG260525 OFC.pdf',
      driveFilename: 'AP V1 NG260525 OFC.pdf',
      driveLink: 'https://drive.google.com/file/d/abc/view'
    }], { modo: 'resp_entidad' })
    expect(html).toContain('AP V1 NG260525 OFC.pdf')
    expect(html).not.toContain('POR FIRMAR')
    expect(html).toContain('>Documentos</')
  })

  it('el envío renombra a atendido antes de armar el HTML', () => {
    const src = extraer(read('js/tramite-firma.js'), ['pqrsAtajoEnviarCorreoDirecto'])
    const iRen = src.indexOf("_pqrsRenombrarDocsDriveWf(wfMail,'atendido')")
    const iHtml = src.indexOf('pqrsCorreoHtmlRespuesta(')
    expect(iRen).toBeGreaterThan(0)
    expect(iHtml).toBeGreaterThan(iRen)
    expect(src).toContain('documentos:docsAdj')
  })
})
