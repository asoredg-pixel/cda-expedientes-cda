/**
 * pqrsd-ventanilla-sin-pdf-ver-detalle.test.js — PQRSD radicada por ventanilla sin PDF principal (solo anexos o
 * sin archivos): al abrir la solicitud desde el rail, lo primero que se ve es «📝 Solicitud» con el asunto y el
 * detalle que escribió Secretaría. No aplica si hay PDF principal ni a radicaciones por correo.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const pq = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')

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
  const c = createContext({
    window: {},
    _pqrsCollectDocsRadicacion: e => e._rad || [],
    _pqrsEsNombreAnexoRadicacion: n => /anexo/i.test(String(n || '')),
    normMedioRecepcionPqrs: m => m,
    getPqrsWorkflow: e => e._wf || {},
    detalleNotasData: v => (v ? JSON.parse(v) : []),
    getNom: e => e._pn_nombre || '',
    fmtF: s => String(s || '').split('-').reverse().join('/'),
    escAttr: s => String(s), jsStr: s => String(s),
    parseDrivePreviewUrl: u => ({ preview: u, url: u }),
    renderSoporteEmbedHtml: s => '<iframe src="' + s.preview + '"></iframe>',
    renderPqrsOrigenMailStageHtml: () => '<div>CORREO</div>'
  })
  runInContext(extraer(pq, ['pqrsFueRadicadaPorCorreo']), c)
  runInContext(extraer(core, ['collectPqrsOrigenDocs', 'pqrsOrigenHasMailPane', 'pqrsOrigenMostrarDetalle',
    'renderPqrsOrigenDetalleStageHtml', 'renderPqrsOrigenDocStageHtml', 'renderPqrsOrigenReviewHtml']), c)
  return c
}

const base = () => ({
  _exp: 'NB260300', f_f1: 'Solicitud de visita técnica al predio', f_f2: 'Ventanilla', _fecha: '2026-10-10',
  _tipo_solicitud: 'Petición', _pn_nombre: 'Juan Gómez',
  _detalle_notas: JSON.stringify([{ texto: 'El usuario solicita visita por tala en la vereda X.', autor: 'Secretaría DEGUV', fecha: '2026-10-10' }]),
  _detalle_general: 'El usuario solicita visita por tala en la vereda X.'
})
const ANEXO = { tipo: 'anexo_radicacion', nombre: 'ANEXO PQRSD NB260300 A1 foto.jpg', label: 'Anexo radicado', driveLink: 'https://drive/anexo1' }
const PDF = { tipo: 'soporte_radicacion', nombre: 'Soporte radicación NB260300.pdf', label: 'Soporte de radicación (PDF)', driveLink: 'https://drive/sol' }

describe('Ventanilla sin PDF principal: primero se ve la solicitud escrita', () => {
  const c = ctx()

  it('solo anexos: pestaña «📝 Solicitud» primero y seleccionada, luego los anexos', () => {
    const e = Object.assign(base(), { _rad: [ANEXO] })
    const html = c.renderPqrsOrigenReviewHtml(e)
    const iSol = html.indexOf('📝 Solicitud')
    const iAn = html.indexOf('>Anexo radicado<')
    expect(iSol).toBeGreaterThan(0)
    expect(iAn).toBeGreaterThan(iSol)
    expect(html).toMatch(/task-review-doc-tab on" data-doc-id="detalle"/)
    expect(html).toContain('Solicitud de visita técnica al predio')
    expect(html).toContain('El usuario solicita visita por tala en la vereda X.')
    expect(html).not.toContain('<iframe')
  })

  it('sin ningún archivo: ya no sale «Sin documentos»; se ve el asunto y el detalle', () => {
    const html = c.renderPqrsOrigenReviewHtml(Object.assign(base(), { _rad: [] }))
    expect(html).not.toContain('Sin documentos ni correo')
    expect(html).toContain('📝 Solicitud')
    expect(html).toContain('Asunto')
    expect(html).toContain('Detalle / descripción')
    expect(html).toContain('Juan Gómez')
    expect(html).toContain('10/10/2026 · Ventanilla')
  })

  it('sin notas: usa el detalle general', () => {
    const e = Object.assign(base(), { _rad: [], _detalle_notas: '[]' })
    expect(c.renderPqrsOrigenDetalleStageHtml(e)).toContain('El usuario solicita visita por tala en la vereda X.')
  })
})

describe('No aplica', () => {
  const c = ctx()

  it('con PDF principal (soporte generado o documento de solicitud): igual que antes, abre el PDF', () => {
    const e = Object.assign(base(), { _rad: [PDF, ANEXO] })
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(false)
    const html = c.renderPqrsOrigenReviewHtml(e)
    expect(html).not.toContain('📝 Solicitud')
    expect(html).toContain('<iframe src="https://drive/sol"')
  })

  it('radicada por correo (medio, mensaje de Gmail o tipo de radicación): no', () => {
    expect(c.pqrsOrigenMostrarDetalle(Object.assign(base(), { _rad: [ANEXO], f_f2: 'Correo' }))).toBe(false)
    expect(c.pqrsOrigenMostrarDetalle(Object.assign(base(), { _rad: [ANEXO], _gmail_message_id: 'm1' }))).toBe(false)
    expect(c.pqrsOrigenMostrarDetalle(Object.assign(base(), { _rad: [], _wf: { tipo_radicacion: 'radicacion_correo' } }))).toBe(false)
  })

  it('un anexo marcado como principal por error no cuenta como PDF de la solicitud', () => {
    const e = Object.assign(base(), { _rad: [Object.assign({}, ANEXO, { tipo: 'soporte_radicacion' })] })
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(true)
  })

  it('sin asunto ni detalle: no hay nada que mostrar', () => {
    const e = { _exp: 'X', f_f2: 'Ventanilla', _rad: [] }
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(false)
  })
})

describe('Selección en el visor', () => {
  it('al abrir se elige «detalle»; al pulsar la pestaña muestra el detalle', () => {
    const v = extraer(core, ['initPqrsOrigenDocViewer', 'selectPqrsOrigenDoc'])
    expect(v).toContain("sel=hasDet?'detalle':(docs.length?docs[0].id:(hasMail?'mail':''));")
    expect(v).toContain("}else if(docId==='detalle'){")
    expect(v).toContain('stage.innerHTML=renderPqrsOrigenDetalleStageHtml(e);')
  })
})
