/**
 * Traslado por competencia de una PQRSD radicada en ventanilla:
 * el documento principal y los anexos se descargan de la unidad compartida y se adjuntan.
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

describe('Traslado de solicitud radicada en ventanilla', () => {
  const src = extraer(core, ['pqrsDocsSolicitudRadicada', 'pqrsArchivosSolicitudRadicada', 'pqrsDriveDocToFile'])

  it('pide la unidad compartida al descargar el archivo', () => {
    expect(src).toContain('supportsAllDrives')
    expect(src).toContain('_pqrsCollectDocsRadicacion')
  })

  it('adjunta el documento principal y los anexos con su nombre original', async () => {
    const urls = []
    const avisos = []
    function File(parts, name, opts) {
      this.name = name
      this.type = (opts && opts.type) || ''
      this.size = 20
    }
    const c = createContext({
      window: {},
      console,
      File,
      notif: (m) => { avisos.push(m) },
      _DRIVE_API_QS: '&supportsAllDrives=true&includeItemsFromAllDrives=true',
      DRIVE_API_BASE: 'https://www.googleapis.com/drive/v3/files',
      _driveGetBestToken: () => 'tok-nca',
      parseDrivePreviewUrl: (url) => ({ id: String(url).indexOf('/sol1/') >= 0 ? 'sol1' : (String(url).indexOf('/anx1/') >= 0 ? 'anx1' : '') }),
      _pqrsCollectDocsRadicacion: () => [
        { nombre: 'KZ260499 SOLICITUD.pdf', driveLink: 'https://drive.google.com/file/d/sol1/view', fileId: 'sol1', tipo: 'soporte_radicacion', es_solicitud: true },
        { nombre: 'KZ260499 A01.pdf', driveLink: 'https://drive.google.com/file/d/anx1/view', fileId: 'anx1', tipo: 'anexo_radicacion' }
      ],
      fetch: async (url) => {
        urls.push(String(url))
        if (String(url).indexOf('supportsAllDrives') < 0) return { ok: false, status: 404, blob: async () => null }
        return { ok: true, status: 200, blob: async () => ({ type: 'application/pdf', size: 20 }) }
      }
    })
    runInContext(src + '\nwindow.pqrsDocsSolicitudRadicada=pqrsDocsSolicitudRadicada;window.pqrsArchivosSolicitudRadicada=pqrsArchivosSolicitudRadicada;window.pqrsDriveDocToFile=pqrsDriveDocToFile;', c)
    const e = {
      _exp: 'KZ260499',
      _pqrs_solicitud_link: 'https://drive.google.com/file/d/sol1/view',
      _pqrs_solicitud_archivo: 'KZ260499 SOLICITUD.pdf',
      _pqrs_gmail_attachments: [
        { nombre: 'KZ260499 SOLICITUD.pdf', driveLink: 'https://drive.google.com/file/d/sol1/view', fileId: 'sol1', es_solicitud: true, tipo: 'soporte_radicacion' },
        { nombre: 'KZ260499 A01.pdf', driveLink: 'https://drive.google.com/file/d/anx1/view', fileId: 'anx1', tipo: 'anexo_radicacion' }
      ]
    }
    const docs = c.pqrsDocsSolicitudRadicada(e)
    expect(docs.map(d => d.nombre)).toEqual(['KZ260499 SOLICITUD.pdf', 'KZ260499 A01.pdf'])
    expect(docs[0].es_solicitud).toBe(true)
    expect(docs[1].tipo).toBe('anexo_radicacion')
    const files = await c.pqrsArchivosSolicitudRadicada(e)
    expect(files.map(f => f.name)).toEqual(['KZ260499 SOLICITUD.pdf', 'KZ260499 A01.pdf'])
    expect(urls.every(u => u.indexOf('supportsAllDrives=true') >= 0)).toBe(true)
    expect(avisos).toEqual([])
  })
})
