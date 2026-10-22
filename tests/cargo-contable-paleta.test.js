/**
 * cargo-contable-paleta.test.js — Cargo Contable (Responsables):
 * paleta Requerimientos solo con facturas, persuasivos vencidos y acuerdos en mora
 * (desde el 3.er día hábil), lupa de consulta y lápiz de Información contable.
 * No abre la pestaña Registro. El pago registrado saca la fila.
 * El encargado sigue viendo resoluciones y la misma mora a 3 días hábiles.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'
import { Window } from 'happy-dom'
import { sst } from './helpers/ctx.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

const HOY = '2026-09-30'
const win = new Window()

let exps = []
const snap = {}

beforeAll(() => {
  const core = read('js/core.js')
  runInContext(extraer(core, [
    'inferirEfectoActo', 'getTipoActo', 'migrarActoProrroga', 'normalizeActoProrrogas', 'vigenteActo',
    'tieneProrrogasActo', 'estadoActoAdmin', 'cleanActoForStore', 'readActoFromRow', 'facturasData', 'actosAdminData',
    'acuerdoCuotasData', 'acuerdoCuotaEnMora', 'facturaAcuerdoEnMora', 'moneyRaw', 'moneyFmt', 'moneyInputHtml',
    'foldSummary', 'facturaTipoOpts', 'acuerdoCuotaRowHtml', 'acuerdoCuotasBlockHtml', 'readAcuerdoCuotasFromRow',
    'facturaRowHtml', 'actoTipoOpts', 'actoTrasladoSanHtml', 'prorrogaItemHtml', 'prorrogasGestionHtml',
    'actosVinculadosQuickHtml', 'actoAdminRowHtml', 'getDeptoAgendaAsignacion'
  ]), sst)
  runInContext(extraer(read('js/formulario.js'), ['syncFacturasExtra']), sst)
  runInContext(read('js/requerimientos.js').replace(/^const\b/gm, 'var'), sst)
  snap.depto = sst.deptoActivo
  snap.rol = sst.rolSesion
  snap.resp = sst.responsableActivo
  snap.user = sst._usuarioActual
  snap.enc = sst.esEncargadoActivo
  snap.jur = sst.esJurisdiccional
  snap.vista = sst.esVistaActividadesDepto
  sst.hoy = () => HOY
  sst.cfg = sst.cfg || {}
  sst.cfg.tiposActoAdmin = [{ nombre: 'Resolución', tieneVencimiento: true }]
  sst.cfg.tiposFactura = ['Seguimiento']
  sst.notif = () => {}
  sst.document = win.document
  sst.expsAmbito = () => exps
  sst.getExpById = id => exps.find(e => e._exp === id) || null
  sst.getNom = e => e._nombre || e._exp
  sst.conceptosSegData = () => []
  sst.actividadesLibresForDepto = () => []
  sst.taskComentarioAutor = () => 'Contable'
  sst.persistExpedienteGranular = () => {}
  sst.logAudit = () => {}
  sst.taskFirmaEnRevisionFinalNotif = () => false
  sst.getInstructoresCfg = () => []
})

afterEach(() => {
  sst.deptoActivo = snap.depto
  sst.rolSesion = snap.rol
  sst.responsableActivo = snap.resp
  sst._usuarioActual = snap.user
  sst.esEncargadoActivo = snap.enc
  sst.esJurisdiccional = snap.jur
  sst.esVistaActividadesDepto = snap.vista
  sst._contablePaletaEdit = false
})

function comoContable() {
  sst.deptoActivo = 'responsables'
  sst.rolSesion = 'responsables'
  sst.responsableActivo = 'Ana Contable'
  sst._usuarioActual = { cargo: 'contable', deptoResponsable: 'guaviare', nombre: 'Ana Contable', email: 'ana.contable@test.com' }
  sst.esEncargadoActivo = () => false
  sst.esJurisdiccional = () => false
  sst.esVistaActividadesDepto = () => false
}

function cartera() {
  const actos = [{ actoAdminId: 'aVenc', tipo: 'Resolución', numero: 'V', vencimiento: '2026-09-01' }]
  const facturas = [
    { tipo: 'Seguimiento', ref: 'F3', valor: '100000', venc: '2026-09-25' },
    { tipo: 'Seguimiento', ref: 'F2', valor: '100000', venc: '2026-09-28' },
    { tipo: 'Seguimiento', ref: 'PERS', valor: '80000', venc: '2026-09-01', persVenc: '2026-09-10' },
    { tipo: 'Seguimiento', ref: 'PAG', valor: '50000', venc: '2026-08-01', pago: '2026-08-15', persVenc: '2026-08-20' },
    { tipo: 'Seguimiento', ref: 'ACU', valor: '300000', venc: '2026-08-01', acuerdoPago: true, acuerdoCuotas: [
      { fecha: '2026-08-01', monto: '100000', pago: '2026-08-01' },
      { fecha: '2026-09-01', monto: '100000', pago: '' }
    ] }
  ]
  return {
    _exp: 'EXP-GUA-1', _nombre: 'Titular Guaviare', _depto: 'guaviare', _tramite: 't1',
    tasks: [],
    _actos_admin: JSON.stringify(actos),
    _facturas_extra: JSON.stringify(facturas)
  }
}

const claves = () => sst.reqPaletaEntradas().map(x => x.fuente + ':' + (x.fuente === 'acto' ? x.titulo.split('N° ')[1] : x.titulo.split(' · ').pop()))

describe('Cargo Contable — paleta de cartera', () => {
  it('el administrador puede asignar el cargo en Usuarios autorizados', () => {
    expect(read('js/core.js')).toMatch(/<option value="contable">Contable/)
    expect(read('js/roles.js')).toMatch(/function esCargoContable\(\)/)
  })

  it('solo ve facturas y acuerdos de su departamento, con 🔍 y ✏️, sin resoluciones ni acciones del encargado', () => {
    comoContable()
    exps = [cartera(), Object.assign(cartera(), {
      _exp: 'EXP-VAU-1', _depto: 'vaupes',
      _facturas_extra: JSON.stringify([{ tipo: 'Seguimiento', ref: 'OTRO', valor: '1', venc: '2026-08-01' }]),
      _actos_admin: '[]'
    })]
    expect(sst.esCargoContable()).toBe(true)
    expect(sst.reqPaletaVisible()).toBe(true)
    expect(sst.reqPuedeVerificar()).toBe(false)
    expect(sst.getDeptoAgendaAsignacion()).toBe('guaviare')
    const rows = sst.reqPaletaEntradas()
    expect(rows.every(x => x.exp === 'EXP-GUA-1')).toBe(true)
    expect(rows.some(x => x.fuente === 'acto')).toBe(false)
    expect(claves().sort()).toEqual(['acuerdo:ACU', 'factura:F3', 'factura:PERS'])
    const html = sst.reqPaletaRowsHtml('', 9)
    expect(html).toContain('reqPaletaVer(')
    expect(html).toContain('reqPaletaEditar(')
    expect(html).toContain('Factura en mora')
    expect(html).toContain('Persuasivo vencido')
    expect(html).toContain('Acuerdo en mora')
    expect(html).not.toContain('reqPaletaCumplio(')
    expect(html).not.toContain('reqPaletaAsignar(')
    expect(html).not.toContain('Resolución vencida')
  })

  it('la factura a 2 días hábiles no entra; la pagada tampoco, aunque el persuasivo esté vencido', () => {
    comoContable()
    exps = [cartera()]
    expect(sst.reqDiasHabilesEntre('2026-09-25', HOY)).toBe(3)
    expect(sst.reqDiasHabilesEntre('2026-09-28', HOY)).toBe(2)
    const refs = sst.reqPaletaEntradas().map(x => x.titulo)
    expect(refs.some(t => t.includes('F2'))).toBe(false)
    expect(refs.some(t => t.includes('PAG'))).toBe(false)
    const pers = sst.reqPaletaEntradas().find(x => x.titulo.includes('PERS'))
    expect(pers.persVencido).toBe(true)
    expect(pers.fuente).toBe('factura')
  })

  it('no abre Registro; al editar desde la paleta solo suma la sección contable', () => {
    comoContable()
    expect(sst.responsablePuedeVerRegistro()).toBe(false)
    expect(sst.tabsResponsableContratista()).not.toContain('reg')
    expect(sst.tabsResponsableContratista()).toContain('act')
    expect(sst.getRegSeccionesResponsableActivo()).toEqual([])
    sst._contablePaletaEdit = true
    expect(sst.getRegSeccionesResponsableActivo()).toEqual(['contable'])
    expect(sst.responsablePuedeEditarSec('contable')).toBe(true)
    expect(sst.responsablePuedeEditarSec('persona')).toBe(false)
    expect(sst.responsablePuedeEditarSec('control')).toBe(false)
    expect(sst.responsablePuedeVerRegistro()).toBe(false)
  })

  it('el lápiz no guarda un alta nueva: exige el expediente ya abierto', () => {
    const c = createContext({
      esCargoContable: () => true,
      editId: 'EXP-GUA-1',
      _contablePaletaEdit: true
    })
    c.window = c
    runInContext(extraer(read('js/guardar-exp.js'), ['contablePaletaPuedeGuardar']), c)
    expect(c.contablePaletaPuedeGuardar()).toBe(true)
    c.editId = ''
    expect(c.contablePaletaPuedeGuardar()).toBe(false)
    c.editId = 'EXP-GUA-1'
    c.window._contablePaletaEdit = false
    expect(c.contablePaletaPuedeGuardar()).toBe(false)
    c.window._contablePaletaEdit = true
    c.esCargoContable = () => false
    expect(c.contablePaletaPuedeGuardar()).toBe(false)
  })
})

describe('La mora a 3 días hábiles no cambia al encargado ni al coordinador', () => {
  it('el coordinador sigue en solo consulta, con resoluciones y sin ✏️', () => {
    sst.deptoActivo = 'responsables'
    sst.rolSesion = 'responsables'
    sst.responsableActivo = 'Coord'
    sst._usuarioActual = { cargo: 'coordinador', deptoResponsable: 'guaviare', nombre: 'Coord' }
    sst.esEncargadoActivo = () => false
    sst.esJurisdiccional = () => false
    sst.esVistaActividadesDepto = () => false
    exps = [cartera()]
    expect(sst.esCargoCoordinador()).toBe(true)
    expect(sst.esCargoContable()).toBe(false)
    const rows = sst.reqPaletaEntradas()
    expect(rows.some(x => x.fuente === 'acto')).toBe(true)
    expect(rows.some(x => x.fuente === 'factura')).toBe(true)
    const html = sst.reqPaletaRowsHtml('', 9)
    expect(html).toContain('reqPaletaVer(')
    expect(html).not.toContain('reqPaletaEditar(')
    expect(html).not.toContain('reqPaletaCumplio(')
  })

  it('el encargado sigue viendo la resolución y puede ✔; la factura entra al 3.er día hábil', () => {
    sst.deptoActivo = 'guaviare'
    sst.rolSesion = 'guaviare'
    sst._usuarioActual = { cargo: '', rol: 'guaviare' }
    sst.esEncargadoActivo = () => true
    sst.esJurisdiccional = () => false
    sst.esVistaActividadesDepto = () => true
    exps = [cartera()]
    expect(sst.esCargoContable()).toBe(false)
    expect(sst.reqPaletaVisible()).toBe(true)
    const rows = sst.reqPaletaEntradas()
    expect(rows.some(x => x.actoAdminId === 'aVenc')).toBe(true)
    expect(rows.some(x => x.fuente === 'factura' && String(x.titulo).includes('F3'))).toBe(true)
    expect(rows.some(x => String(x.titulo).includes('F2'))).toBe(false)
    const html = sst.reqPaletaRowsHtml('', 9)
    expect(html).toContain('reqPaletaCumplio(')
    expect(html).toContain('reqPaletaAsignar(')
    expect(html).not.toContain('reqPaletaEditar(')
  })
})
