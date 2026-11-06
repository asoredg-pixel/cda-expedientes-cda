/**
 * El botón de Drive del menú usa un SVG fijo, no un emoji que cambia con el sistema.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')

describe('Icono de Drive igual en cualquier sistema', () => {
  it('el menú pinta nube con raya (desconectado) y nube (conectado) en SVG', () => {
    expect(html).toContain('sst-drive-svg-off')
    expect(html).toContain('sst-drive-svg-on')
    expect(html).not.toMatch(/⛓️|🔗/)
  })

  it('el estado ya no reemplaza el icono por un emoji', () => {
    const fn = gmail.slice(gmail.indexOf('function sstRenderGmailDriveStatusBtn'), gmail.indexOf('function sstStartGmailDriveStatusTick'))
    expect(fn).not.toMatch(/ico[\s\S]{0,40}textContent/)
    expect(fn).not.toMatch(/⛓️|🔗/)
    expect(fn).toContain('sst-drive-expired')
    expect(fn).toContain('sst-drive-ok')
  })

  it('el CSS muestra un solo dibujo según el estado', () => {
    expect(css).toContain('.sst-drive-status-btn.sst-drive-expired .sst-drive-svg-off')
    expect(css).toContain('.sst-drive-status-btn.sst-drive-ok .sst-drive-svg-on')
  })
})
