/**
 * pqrsd-trazabilidad-solicitud-sin-recepcion.test.js —
 * 1) La radicación usa fecha (y hora) de solicitud: correo = recepción del mensaje; ventanilla = radicación.
 * 2) Tras traslado de Secretaría no se muestra «Recibido en oficina» (redundante).
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

const OFIS = { guaviare: 'NCA DEGUV', secretaria: 'Secretaría DEGUV' }
const c = createContext({
  normalizePqrsOficinaFields: e => e,
  medioNotificacionFlagHtml: () => '<span>Correo</span>',
  labelOficina: id => OFIS[id] || id || '',
  escAttr: s => String(s),
  fmtF: s => String(s || '').slice(0, 10).split('-').reverse().join('/')
})
runInContext(extraer(core, [
  'pqrsHistorialEventoLabel', 'pqrsNombresDesdeAsignacionHist', 'pqrsHistTsNum', 'pqrsHistHoraTxt', 'pqrsTsDesdeCorreo',
  'pqrsHistOcultarRecepcionTraslado', 'pqrsHistOcultarReenvioTrasAsignacion', 'pqrsHistItemTrazabilidad',
  'pqrsHistEmoji', 'renderPqrsTrazabilidadHtml'
]), c)

const tsLocal = (fecha, h, m) => {
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m).getTime()
}

describe('Trazabilidad PQRSD: fecha de solicitud y sin recepción redundante', () => {
  it('oculta recepcion_nca cuando ya hay traslado a la oficina', () => {
    const hist = [
      { tipo: 'traslado_oficina', fecha: '2026-10-15', oficina: 'guaviare', oficinaAnterior: 'secretaria' },
      { tipo: 'recepcion_nca', fecha: '2026-10-15', oficina: 'guaviare', nota: 'Recibido en NCA DEGUV para trámite completo' }
    ]
    expect(c.pqrsHistOcultarRecepcionTraslado(hist[1], hist)).toBe(true)
  })

  it('radicación muestra fecha/hora de solicitud del correo (no la de radicado)', () => {
    const tsMail = tsLocal('2026-10-14', 9, 12)
    const e = {
      _fecha: '2026-10-15',
      _fecha_solicitud: '2026-10-14',
      _gmail_email_data: { fecha: 'Tue, 14 Oct 2026 09:12:00 -0500', fechaTs: tsMail },
      _pqrs_historial: [
        { ts: tsLocal('2026-10-15', 15, 35), tipo: 'radicacion', fecha: '2026-10-15', nota: 'Radicado por Secretaría DEGUV' },
        { ts: tsLocal('2026-10-15', 15, 35), tipo: 'traslado_oficina', fecha: '2026-10-15', nota: 'Traslado inicial a oficina competente', oficina: 'guaviare', oficinaAnterior: 'secretaria', por: 'Secretaría DEGUV' },
        { ts: tsLocal('2026-10-15', 15, 35), tipo: 'recepcion_nca', fecha: '2026-10-15', nota: 'Recibido en NCA DEGUV para trámite completo', oficina: 'guaviare' }
      ]
    }
    const html = c.renderPqrsTrazabilidadHtml(e)
    const lineas = html.split('pqrs-tl-line').slice(1)
    const horaMail = new Date(tsMail).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    expect(lineas.length).toBe(2)
    expect(lineas[0]).toContain('14/10/2026 ' + horaMail + '</span> · 📥 Radicación de la solicitud')
    expect(lineas[1]).toContain('↪ Traslado: Secretaría DEGUV → NCA DEGUV')
    expect(html).not.toContain('Recibido en NCA DEGUV')
  })

  it('ventanilla: radicación usa fecha de solicitud y hora guardada en el evento', () => {
    const tsRad = tsLocal('2026-10-15', 11, 5)
    const e = {
      _fecha: '2026-10-15',
      _fecha_solicitud: '2026-10-15',
      _pqrs_historial: [
        { ts: tsRad, tipo: 'radicacion', fecha: '2026-10-15', nota: 'Radicado por Secretaría DEGUV' },
        { ts: tsLocal('2026-10-15', 11, 6), tipo: 'traslado_oficina', fecha: '2026-10-15', nota: 'Traslado inicial', oficina: 'guaviare', oficinaAnterior: 'secretaria', por: 'Secretaría DEGUV' }
      ]
    }
    const html = c.renderPqrsTrazabilidadHtml(e)
    const hora = new Date(tsRad).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    expect(html).toContain('15/10/2026 ' + hora + '</span> · 📥 Radicación de la solicitud')
    expect(html).not.toContain('Recibido en NCA')
  })

  it('pqrsTsDesdeCorreo lee fechaTs o el Date header', () => {
    expect(c.pqrsTsDesdeCorreo({ fechaTs: 12345 })).toBe(12345)
    const n = c.pqrsTsDesdeCorreo({ fecha: 'Tue, 14 Oct 2026 09:12:00 -0500' })
    expect(n).toBeGreaterThan(0)
  })
})

describe('ensureTareaPqrsNca ya no empuja recepcion_nca al historial PQRSD', () => {
  it('el push de recepcion_nca a _pqrs_historial fue eliminado', () => {
    const fn = core.slice(core.indexOf('function ensureTareaPqrsNca'), core.indexOf('function abrirPqrsBasicoSiAplica'))
    expect(fn).toContain('ensureTareaPqrsNca')
    expect(fn).not.toMatch(/_pqrs_historial\.push\(\{[^}]*recepcion_nca/)
  })
})
