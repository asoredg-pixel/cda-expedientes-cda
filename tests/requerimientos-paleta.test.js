/**
 * requerimientos-paleta.test.js — Paleta «Requerimientos» del encargado:
 * resoluciones por vencer / vencidas, facturas y acuerdos de pago en mora,
 * marca de gestión y su conservación al editar el expediente.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, runInContext } from 'vm'
import { Window } from 'happy-dom'
import { sst } from './helpers/ctx.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

/** Extrae funciones top-level de un script clásico (termina en la primera línea que completa una función válida). */
function extraerFunciones(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^function ' + n + '\\(', 'm'))
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
const docDom = win.document

let exps = []
const tasksRevFinal = new Set()

beforeAll(() => {
  const core = read('js/core.js')
  runInContext(extraerFunciones(core, [
    'inferirEfectoActo', 'getTipoActo', 'migrarActoProrroga', 'normalizeActoProrrogas', 'vigenteActo',
    'tieneProrrogasActo', 'estadoActoAdmin', 'cleanActoForStore', 'readActoFromRow', 'facturasData', 'actosAdminData',
    'acuerdoCuotasData', 'acuerdoCuotaEnMora', 'facturaAcuerdoEnMora', 'moneyRaw', 'moneyFmt', 'moneyInputHtml',
    'foldSummary', 'facturaTipoOpts', 'acuerdoCuotaRowHtml', 'acuerdoCuotasBlockHtml', 'readAcuerdoCuotasFromRow',
    'facturaRowHtml', 'actoTipoOpts', 'actoTrasladoSanHtml', 'prorrogaItemHtml', 'prorrogasGestionHtml',
    'actosVinculadosQuickHtml', 'actoAdminRowHtml'
  ]), sst)
  runInContext(extraerFunciones(read('js/formulario.js'), ['syncFacturasExtra']), sst)
  runInContext(read('js/requerimientos.js').replace(/^const\b/gm, 'var'), sst)

  sst.hoy = () => HOY
  sst.cfg = sst.cfg || {}
  sst.cfg.tiposActoAdmin = [{ nombre: 'Resolución', tieneVencimiento: true }]
  sst.cfg.tiposFactura = ['Seguimiento']
  sst.notif = () => {}
  sst.esModoResponsable = () => false
  sst.esJurisdiccional = () => false
  sst.esEncargadoActivo = () => true
  sst.esVistaActividadesDepto = () => true
  sst.expsAmbito = () => exps
  sst.getExpById = id => exps.find(e => e._exp === id) || null
  sst.getNom = e => e._nombre || e._exp
  sst.conceptosSegData = () => []
  sst.actividadesLibresForDepto = () => []
  sst.deptoActivo = 'guaviare'
  sst.taskComentarioAutor = () => 'Encargado NCA'
  sst.persistExpedienteGranular = () => {}
  sst.logAudit = () => {}
  sst.taskFirmaEnRevisionFinalNotif = t => tasksRevFinal.has(String(t.id))
})

const habiles = n => sst.addDiasHabilesCO(HOY, n)

function expBase() {
  const vig30 = habiles(30)
  const vig31 = habiles(31)
  const actos = [
    { actoAdminId: 'a30', tipo: 'Resolución', numero: '30', vencimiento: vig30 },
    { actoAdminId: 'a31', tipo: 'Resolución', numero: '31', vencimiento: vig31 },
    { actoAdminId: 'aVenc', tipo: 'Resolución', numero: 'V', vencimiento: '2026-09-01' },
    { actoAdminId: 'aArch', tipo: 'Resolución', numero: 'AR', vencimiento: '2026-09-01', archivoFecha: '2026-09-10' },
    { actoAdminId: 'aPend', tipo: 'Resolución', numero: 'P', vencimiento: '2026-09-01', pendienteAprobacion: true },
    { actoAdminId: 'aGest', tipo: 'Resolución', numero: 'G', vencimiento: '2026-09-01', palGestionEn: 'x', palGestionRef: 'v:2026-09-01' },
    { actoAdminId: 'aPror', tipo: 'Resolución', numero: 'PR', vencimiento: '2026-09-01', palGestionEn: 'x', palGestionRef: 'v:2026-09-01',
      prorrogas: [{ numero: 'PR-1', vencimiento: habiles(5) }] },
    { actoAdminId: 'aRev', tipo: 'Resolución', numero: 'RV', vencimiento: '2026-09-01' },
  ]
  const facturas = [
    { tipo: 'Seguimiento', ref: 'F15', valor: '100000', venc: '2026-09-15' },
    { tipo: 'Seguimiento', ref: 'F14', valor: '100000', venc: '2026-09-16' },
    { tipo: 'Seguimiento', ref: 'FPag', valor: '100000', venc: '2026-08-01', pago: '2026-08-02' },
    { tipo: 'Seguimiento', ref: 'ACU', valor: '300000', venc: '2026-08-01', acuerdoPago: true, acuerdoCuotas: [
      { fecha: '2026-08-01', monto: '100000', pago: '2026-08-01' },
      { fecha: '2026-09-01', monto: '100000', pago: '' },
      { fecha: '2026-09-20', monto: '100000', pago: '' },
    ] },
    { tipo: 'Seguimiento', ref: 'ACUDIA', valor: '100000', venc: '2026-08-01', acuerdoPago: true, acuerdoDia: true },
    { tipo: 'Seguimiento', ref: 'FPend', valor: '100000', venc: '2026-08-01', pendienteAprobacion: true },
  ]
  return {
    _exp: 'EXP-TEST-001', _nombre: 'Titular prueba',
    tasks: [{ id: 'tRev', actoAdminId: 'aRev', actividad: 'Resolución' }],
    _actos_admin: JSON.stringify(actos),
    _facturas_extra: JSON.stringify(facturas),
  }
}

const claves = () => sst.reqPaletaEntradas().map(x => x.fuente + ':' + (x.fuente === 'acto' ? x.titulo.split('N° ')[1] : x.titulo.split(' · ').pop()))

describe('Paleta Requerimientos — resoluciones', () => {
  it('incluye ≤30 días hábiles, vencidas y prórroga nueva; excluye 31 d., archivadas, pendientes, gestionadas y en revisión final', () => {
    tasksRevFinal.clear(); tasksRevFinal.add('tRev')
    exps = [expBase()]
    const k = claves().filter(s => s.startsWith('acto:')).sort()
    expect(k).toEqual(['acto:30', 'acto:PR', 'acto:V'])
  })

  it('distingue por vencer y vencida', () => {
    tasksRevFinal.clear()
    exps = [expBase()]
    const rows = sst.reqPaletaEntradas().filter(x => x.fuente === 'acto')
    expect(rows.find(x => x.actoAdminId === 'a30').estado).toBe('por_vencer')
    expect(rows.find(x => x.actoAdminId === 'aVenc').estado).toBe('vencido')
    expect(rows.find(x => x.actoAdminId === 'aRev')).toBeTruthy()
  })
})

describe('Paleta Requerimientos — coordinador (solo consulta)', () => {
  it('ve la paleta de su departamento solo con 🔍 (sin ✔ ni 📌)', () => {
    tasksRevFinal.clear()
    const otro = Object.assign(expBase(), { _exp: 'EXP-VAU-001', _depto: 'vaupes' })
    exps = [Object.assign(expBase(), { _depto: 'guaviare' }), otro]
    const prev = { r: sst.esModoResponsable, e: sst.esEncargadoActivo, v: sst.esVistaActividadesDepto }
    sst.esModoResponsable = () => true
    sst.esEncargadoActivo = () => false
    sst.esVistaActividadesDepto = () => false
    sst.esCargoCoordinador = () => true
    sst.getDeptoAgendaAsignacion = () => 'guaviare'
    try {
      expect(sst.reqPuedeVerificar()).toBe(false)
      expect(sst.reqPaletaVisible()).toBe(true)
      const rows = sst.reqPaletaEntradas()
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every(x => x.exp === 'EXP-TEST-001')).toBe(true)
      const html = sst.reqPaletaRowsHtml('', 9)
      expect(html).toContain('reqPaletaVer(')
      expect(html).not.toContain('reqPaletaCumplio(')
      expect(html).not.toContain('reqPaletaAsignar(')
    } finally {
      sst.esModoResponsable = prev.r
      sst.esEncargadoActivo = prev.e
      sst.esVistaActividadesDepto = prev.v
      sst.esCargoCoordinador = () => false
    }
  })
})

describe('Paleta Requerimientos — facturas y acuerdos', () => {
  it('factura con 15 días calendario entra; con 14 no; pagada, al día o pendiente de aprobación no', () => {
    exps = [expBase()]
    const k = claves().filter(s => !s.startsWith('acto:')).sort()
    expect(k).toEqual(['acuerdo:ACU', 'factura:F15'])
  })

  it('acuerdo toma la cuota más antigua sin pagar', () => {
    exps = [expBase()]
    const acu = sst.reqPaletaEntradas().find(x => x.fuente === 'acuerdo')
    expect(acu.vence).toBe('2026-09-01')
    expect(acu.detalle).toContain('Cuota #2')
    expect(acu.detalle).toContain('2 cuotas en mora')
  })
})

describe('Gestión (✔) y reaparición', () => {
  it('✔ saca la fila y la guarda en el acto / factura; reaparece si cambia la fecha', () => {
    tasksRevFinal.clear()
    const e = expBase()
    exps = [e]
    const fac = sst.reqPaletaEntradas().find(x => x.fuente === 'factura')
    const act = sst.reqPaletaEntradas().find(x => x.actoAdminId === 'a30')
    expect(sst._reqPalMarcarGestion(e, fac, { desc: 'Cobro persuasivo' })).toBe(true)
    expect(sst._reqPalMarcarGestion(e, act, { desc: 'Oficio de renovación' })).toBe(true)
    let rows = sst.reqPaletaEntradas()
    expect(rows.find(x => x.fuente === 'factura')).toBeUndefined()
    expect(rows.find(x => x.actoAdminId === 'a30')).toBeUndefined()

    const f0 = JSON.parse(e._facturas_extra)[0]
    expect(f0.palGestionRef).toBe('f:2026-09-15')
    expect(f0.palGestionDesc).toBe('Cobro persuasivo')
    expect(f0.palGestionPor).toBe('Encargado NCA')

    const arr = JSON.parse(e._facturas_extra)
    arr[0].venc = '2026-09-10'
    e._facturas_extra = JSON.stringify(arr)
    rows = sst.reqPaletaEntradas()
    expect(rows.find(x => x.fuente === 'factura')).toBeTruthy()
  })

  it('📌 (reqRegistrarGestion) marca la fila nueva con la actividad asignada', () => {
    const e = expBase()
    exps = [e]
    const acu = sst.reqPaletaEntradas().find(x => x.fuente === 'acuerdo')
    const ok = sst.reqRegistrarGestion({ key: acu.key }, e, [{ id: 'tNueva', actividad: 'Cobro coactivo', responsable: 'Ana' }])
    expect(ok).toBe(true)
    const f = JSON.parse(e._facturas_extra)[3]
    expect(f.palGestionTaskIds).toEqual(['tNueva'])
    expect(f.palGestionDesc).toContain('Cobro coactivo')
    expect(sst.reqPaletaEntradas().find(x => x.fuente === 'acuerdo')).toBeUndefined()
  })
})

describe('Formulario del expediente conserva la marca', () => {
  it('acto: actoAdminRowHtml → readActoFromRow mantiene palGestion*', () => {
    const a = { actoAdminId: 'a1', tipo: 'Resolución', numero: '1', vencimiento: '2026-10-10',
      palGestionRef: 'v:2026-10-10', palGestionEn: '2026-09-30T10:00:00Z', palGestionPor: 'Enc "NCA"', palGestionDesc: "Oficio N° 5 <renovación> & 'otro'" }
    const div = docDom.createElement('div')
    div.innerHTML = sst.actoAdminRowHtml(a, 0)
    const leido = sst.cleanActoForStore(sst.readActoFromRow(div.querySelector('.acto-admin')))
    expect(leido.palGestionRef).toBe(a.palGestionRef)
    expect(leido.palGestionDesc).toBe(a.palGestionDesc)
    expect(leido.palGestionPor).toBe(a.palGestionPor)
    expect(leido.numero).toBe('1')
  })

  it('factura: facturaRowHtml → syncFacturasExtra mantiene palGestion*', () => {
    const f = { tipo: 'Seguimiento', ref: 'F1', valor: '1000', venc: '2026-09-01',
      palGestionRef: 'f:2026-09-01', palGestionEn: 'x', palGestionPor: 'Enc', palGestionDesc: 'Persuasivo', palGestionTaskIds: ['t1'] }
    docDom.body.innerHTML = '<input type="hidden" id="fld__facturas_extra" value="[]"><div id="facturas-extra">' +
      sst.facturaRowHtml(f, 0) + sst.facturaRowHtml({ tipo: 'Seguimiento', ref: 'F2' }, 1) + '</div>'
    const prevDoc = sst.document
    sst.document = docDom
    try { sst.syncFacturasExtra() } finally { sst.document = prevDoc }
    const out = JSON.parse(docDom.getElementById('fld__facturas_extra').value)
    expect(out[0].palGestionRef).toBe('f:2026-09-01')
    expect(out[0].palGestionTaskIds).toEqual(['t1'])
    expect(out[0].ref).toBe('F1')
    expect(out[1].palGestionRef).toBeUndefined()
  })
})
