/**
 * cobro-persuasivo-cartera.test.js — Cobro persuasivo de un expediente:
 * la paleta muestra por revisar / por firmar / por notificar, sale al notificar
 * mientras el plazo no venza, y vuelve como persuasivo en mora.
 * El pago parcial no la saca. El acuerdo sigue por cuotas.
 * Una factura sin actividad vinculada no cambia de regla.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
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

const HOY = '2026-11-06'
let exps = []
const snap = {}

beforeAll(() => {
  const core = read('js/core.js')
  runInContext(extraer(core, [
    'facturasData', 'actosAdminData', 'acuerdoCuotasData', 'moneyFmt', 'moneyRaw',
    'readAcuerdoCuotasFromRow', 'getDeptoAgendaAsignacion'
  ]), sst)
  runInContext(extraer(read('js/formulario.js'), ['syncFacturasExtra']), sst)
  runInContext(read('js/requerimientos.js').replace(/^const\b/gm, 'var'), sst)
  snap.hoy = sst.hoy
  snap.depto = sst.deptoActivo
  snap.rol = sst.rolSesion
  snap.resp = sst.responsableActivo
  snap.user = sst._usuarioActual
  snap.enc = sst.esEncargadoActivo
  snap.jur = sst.esJurisdiccional
  snap.vista = sst.esVistaActividadesDepto
  snap.fase = sst.taskFirmaFase
  snap.noti = sst.taskFirmaEsNotificada
  snap.entrega = sst.puedeEntregarComoResponsable
  sst.hoy = () => HOY
  sst.taskFirmaFase = t => String((t && t.firmaWf && t.firmaWf.fase) || '')
  sst.taskFirmaEsNotificada = t => {
    const f = sst.taskFirmaFase(t)
    if (f === 'cerrada_atendida') return true
    const n = t && t.firmaWf && t.firmaWf.notificacion
    return !!(n && (n.en || n.a))
  }
  sst.notif = () => {}
  sst.expsAmbito = () => exps
  sst.getExpById = id => exps.find(e => e._exp === id) || null
  sst.getNom = e => e._nombre || e._exp
  sst.conceptosSegData = () => []
  sst.actividadesLibresForDepto = () => []
  sst.taskFirmaEnRevisionFinalNotif = () => false
})

beforeEach(() => {
  sst.hoy = () => HOY
  sst.taskFirmaFase = t => String((t && t.firmaWf && t.firmaWf.fase) || '')
  sst.taskFirmaEsNotificada = t => {
    const f = sst.taskFirmaFase(t)
    if (f === 'cerrada_atendida') return true
    const n = t && t.firmaWf && t.firmaWf.notificacion
    return !!(n && (n.en || n.a))
  }
})

afterEach(() => {
  sst.hoy = snap.hoy
  sst.deptoActivo = snap.depto
  sst.rolSesion = snap.rol
  sst.responsableActivo = snap.resp
  sst._usuarioActual = snap.user
  sst.esEncargadoActivo = snap.enc
  sst.esJurisdiccional = snap.jur
  sst.esVistaActividadesDepto = snap.vista
  sst.taskFirmaFase = snap.fase
  sst.taskFirmaEsNotificada = snap.noti
  sst.puedeEntregarComoResponsable = snap.entrega
})

function comoContable() {
  sst.deptoActivo = 'responsables'
  sst.rolSesion = 'responsables'
  sst.responsableActivo = 'Ana Contable'
  sst._usuarioActual = { cargo: 'contable', deptoResponsable: 'guaviare', nombre: 'Ana Contable' }
  sst.esEncargadoActivo = () => false
  sst.esJurisdiccional = () => false
  sst.esVistaActividadesDepto = () => false
  sst.puedeEntregarComoResponsable = () => false
}

function fila(facs, tasks) {
  return {
    _exp: 'EXP-1', _nombre: 'Titular', _depto: 'guaviare', _tramite: 't1',
    tasks: tasks || [],
    _actos_admin: '[]',
    _facturas_extra: JSON.stringify(facs)
  }
}

const fac = (extra) => Object.assign({
  tipo: 'Seguimiento', ref: 'F1', valor: '100000', venc: '2026-09-01'
}, extra || {})

const porFirmar = { id: 'tk1', eliminada: false, actividad: 'Cobro persuasivo', firmaWf: { fase: 'por_firmar' } }
const notificado = { id: 'tk1', eliminada: false, actividad: 'Cobro persuasivo', firmaWf: { fase: 'cerrada_atendida', notificacion: { en: '2026-11-01' } } }

describe('Paleta — cobro persuasivo de un expediente', () => {
  it('reconoce solo la actividad Cobro persuasivo', () => {
    expect(sst.esActividadCobroPersuasivo('Cobro persuasivo')).toBe(true)
    expect(sst.esActividadCobroPersuasivo('  cobro   persuasivo ')).toBe(true)
    expect(sst.esActividadCobroPersuasivo('Oficio de requerimiento')).toBe(false)
    expect(sst.esActividadCobroPersuasivo('Oficio persuasivo')).toBe(false)
  })

  it('sin actividad vinculada sigue en mora aunque la fecha del persuasivo sea futura', () => {
    comoContable()
    exps = [fila([fac({ persVenc: '2026-12-01' })])]
    const rows = sst.reqPaletaEntradas()
    expect(rows).toHaveLength(1)
    expect(rows[0].persFlujo).toBeFalsy()
    expect(rows[0].persVencido).toBe(false)
    expect(sst.reqPaletaRowsHtml('', 9)).toContain('Factura en mora')
  })

  it('por firmar cambia el rótulo y no dice factura en mora', () => {
    comoContable()
    exps = [fila([fac({
      persOficio: 'DSGV-1', persTaskId: 'tk1', persGrupoId: 'tk1', persExp: 'EXP-1', persVenc: '2026-12-01'
    })], [porFirmar])]
    const rows = sst.reqPaletaEntradas()
    expect(rows).toHaveLength(1)
    expect(rows[0].persFlujo).toBe('por firmar')
    expect(rows[0].persOficio).toBe('DSGV-1')
    const html = sst.reqPaletaRowsHtml('', 9)
    expect(html).toContain('Cobro persuasivo · por firmar')
    expect(html).toContain('Oficio DSGV-1')
    expect(html).not.toContain('Factura en mora')
    expect(html).not.toContain('reqPaletaCobroPersuasivo(')
  })

  it('notificado y en plazo sale; si el plazo venció vuelve como persuasivo en mora', () => {
    comoContable()
    exps = [fila([fac({
      persOficio: 'DSGV-1', persTaskId: 'tk1', persGrupoId: 'tk1', persExp: 'EXP-1', persVenc: '2026-12-01'
    })], [notificado])]
    expect(sst.reqPaletaEntradas()).toHaveLength(0)
    exps = [fila([fac({
      persOficio: 'DSGV-1', persTaskId: 'tk1', persGrupoId: 'tk1', persExp: 'EXP-1', persVenc: '2026-11-01'
    })], [notificado])]
    const rows = sst.reqPaletaEntradas()
    expect(rows).toHaveLength(1)
    expect(rows[0].persVencido).toBe(true)
    expect(sst.reqPaletaRowsHtml('', 9)).toContain('Persuasivo vencido')
  })

  it('la fecha de pago la saca; un abono no. El acuerdo vencido sigue como acuerdo', () => {
    comoContable()
    exps = [fila([fac({
      pago: '2026-11-02', persOficio: 'DSGV-1', persTaskId: 'tk1', persPagoValor: '100000', persVenc: '2026-10-01'
    })], [notificado])]
    expect(sst.reqPaletaEntradas()).toHaveLength(0)
    exps = [fila([fac({
      persOficio: 'DSGV-1', persTaskId: 'tk1', persGrupoId: 'tk1', persExp: 'EXP-1',
      persVenc: '2026-10-01', persPagoValor: '20000'
    })], [notificado])]
    expect(sst.reqPaletaEntradas()).toHaveLength(1)
    exps = [fila([fac({
      ref: 'ACU', acuerdoPago: true, persTaskId: 'tk1', persOficio: 'DSGV-1', persVenc: '2026-10-01',
      acuerdoCuotas: [{ fecha: '2026-10-01', monto: '100000', pago: '' }]
    })], [porFirmar])]
    const rows = sst.reqPaletaEntradas()
    expect(rows.map(x => x.fuente)).toEqual(['acuerdo'])
    expect(rows[0].persFlujo).toBeFalsy()
  })

  it('el encargado ve el botón para iniciar el cobro; el contable que no entrega, no', () => {
    sst.deptoActivo = 'guaviare'
    sst.rolSesion = 'guaviare'
    sst._usuarioActual = { cargo: '', rol: 'guaviare' }
    sst.esEncargadoActivo = () => true
    sst.esJurisdiccional = () => false
    sst.esVistaActividadesDepto = () => true
    sst.puedeEntregarComoResponsable = () => false
    exps = [fila([fac()])]
    expect(sst.reqPaletaRowsHtml('', 9)).toContain('reqPaletaCobroPersuasivo(')
    comoContable()
    exps = [fila([fac()])]
    expect(sst.reqPaletaRowsHtml('', 9)).not.toContain('reqPaletaCobroPersuasivo(')
  })
})

describe('Entrega — vincula las facturas elegidas y no las demás', () => {
  const entrega = read('js/entrega-responsable.js')
  const ctx = createContext({
    console,
    facturasData: v => { try { return v ? JSON.parse(v) : [] } catch (e) { return [] } },
    hoy: () => HOY,
    responsableActivo: 'Ana',
    notif: () => {},
    validarNumeroOficioDisponible: () => true
  })
  ctx.window = ctx
  runInContext(extraer(entrega, ['facturasVencidasCobroPersuasivo', 'applyEntregaCobroPersuasivo']), ctx)

  it('lista solo vencidas sin pago y sin acuerdo', () => {
    const e = {
      _exp: 'EXP-1',
      _facturas_extra: JSON.stringify([
        { tipo: 'Seguimiento', ref: 'MORA', venc: '2026-09-01' },
        { tipo: 'Seguimiento', ref: 'ALDIA', venc: '2026-12-01' },
        { tipo: 'Seguimiento', ref: 'PAGA', venc: '2026-08-01', pago: '2026-08-02' },
        { tipo: 'Seguimiento', ref: 'ACU', venc: '2026-08-01', acuerdoPago: true }
      ])
    }
    expect(ctx.facturasVencidasCobroPersuasivo(e).map(o => o.f.ref)).toEqual(['MORA'])
  })

  it('escribe el oficio en las marcadas y deja igual la otra', () => {
    const e = {
      _exp: 'EXP-1',
      _facturas_extra: JSON.stringify([
        { tipo: 'Seguimiento', ref: 'A', venc: '2026-09-01', valor: '10' },
        { tipo: 'Seguimiento', ref: 'B', venc: '2026-09-01', valor: '20' },
        { tipo: 'Seguimiento', ref: 'C', venc: '2026-09-01', valor: '30', acuerdoPago: true }
      ])
    }
    const t = { id: 'tk9', historial: [] }
    expect(ctx.applyEntregaCobroPersuasivo(e, t, { oficio: 'DSGV-9', vence: '2026-12-15', idxs: [0, 2] })).toBe(true)
    const facs = JSON.parse(e._facturas_extra)
    expect(facs[0].persOficio).toBe('DSGV-9')
    expect(facs[0].persTaskId).toBe('tk9')
    expect(facs[0].persGrupoId).toBe('tk9')
    expect(facs[0].persExp).toBe('EXP-1')
    expect(facs[0].persVenc).toBe('2026-12-15')
    expect(facs[1].persTaskId).toBeUndefined()
    expect(facs[2].persTaskId).toBeUndefined()
    expect(facs[2].acuerdoPago).toBe(true)
    expect(t.oficio).toBe('DSGV-9')
    expect(t.esCobroPersuasivo).toBe(true)
    expect(t.persGrupoId).toBe('tk9')
  })

  it('no escribe si el número de oficio no está disponible', () => {
    ctx.validarNumeroOficioDisponible = () => false
    const e = { _exp: 'EXP-1', _facturas_extra: JSON.stringify([{ tipo: 'Seguimiento', ref: 'A', venc: '2026-09-01' }]) }
    const t = { id: 'tk1', historial: [] }
    expect(ctx.applyEntregaCobroPersuasivo(e, t, { oficio: 'DUP', vence: '2026-12-01', idxs: [0] })).toBe(false)
    expect(JSON.parse(e._facturas_extra)[0].persOficio).toBeUndefined()
    expect(t.oficio).toBeUndefined()
  })
})

describe('Información contable conserva el vínculo', () => {
  it('syncFacturasExtra no borra oficio ni tarea y toma el valor pagado', () => {
    const win = new Window()
    win.document.body.innerHTML =
      '<input type="hidden" id="fld__facturas_extra" value="[]">' +
      '<div id="facturas-extra"><div class="factura-extra">' +
      '<input class="fx-tipo" value="Seguimiento"><input class="fx-valor" value="1000">' +
      '<input class="fx-ref" value="F1"><input class="fx-venc" value="2026-09-01">' +
      '<input class="fx-pago" value=""><input class="fx-pers-venc" value="2026-12-01" readonly>' +
      '<input class="fx-pers-pago" value="25000">' +
      '</div></div>'
    win.document.querySelector('.factura-extra').setAttribute('data-pers-cartera', JSON.stringify({
      persOficio: 'DSGV-1', persTaskId: 'tk1', persGrupoId: 'tk1', persExp: 'EXP-1'
    }))
    const prev = sst.document
    sst.document = win.document
    try { sst.syncFacturasExtra() } finally { sst.document = prev }
    const out = JSON.parse(win.document.getElementById('fld__facturas_extra').value)
    expect(out[0].persOficio).toBe('DSGV-1')
    expect(out[0].persTaskId).toBe('tk1')
    expect(out[0].persGrupoId).toBe('tk1')
    expect(out[0].persExp).toBe('EXP-1')
    expect(out[0].persVenc).toBe('2026-12-01')
    expect(out[0].persPagoValor).toBe('25000')
    expect(out[0].ref).toBe('F1')
  })
})
