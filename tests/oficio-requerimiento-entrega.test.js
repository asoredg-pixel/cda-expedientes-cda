/**
 * oficio-requerimiento-entrega.test.js — Entrega de «Oficio de requerimiento» sin concepto vinculado
 * (autoentrega) y reentrega tras devolución sin perder el vínculo con el concepto.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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
  const avisos = []
  const c = {
    console, JSON, String, Number, parseInt, avisos,
    notif: (m, t) => avisos.push([m, t]),
    conceptosSegData: s => { try { return JSON.parse(s || '[]') } catch (e) { return [] } },
    actosAdminData: s => { try { return JSON.parse(s || '[]') } catch (e) { return [] } },
    facturasData: s => { try { return JSON.parse(s || '[]') } catch (e) { return [] } },
    validarNumeroRequerimientoDisponible: () => true,
    validarNumeroOficioDisponible: () => true,
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/entrega-responsable.js'), [
    'esActividadOficioRequerimiento', 'findConceptoByReqId', 'applyEntregaOficioRequerimiento',
    'applyEntregaOficioRequerimientoSinConcepto', 'retirarRegistroPendienteDeEntrega',
  ]), c)
  runInContext(extraerFunciones(read('js/requerimientos.js'), ['reqEsOficioRequerimiento', 'terminoCumplDefaults']), c)
  return c
}

const item = extra => Object.assign({ conceptoReqId: '', reqOficio: 'OF-77', reqNum: 'R-12', reqDias: '10', reqMedio: '' }, extra || {})

describe('Oficio de requerimiento sin concepto', () => {
  it('autoentrega sin concepto: no bloquea y deja datos + término propuesto en la actividad', () => {
    const c = ctx()
    const e = { _exp: 'EXP-1', _conceptos_seg: '[]' }
    const t = { id: 't1', actividad: 'Oficio de requerimiento' }
    expect(c.applyEntregaOficioRequerimiento(e, t, item())).toBe(true)
    expect(c.avisos.length).toBe(0)
    expect(t.esOficioRequerimiento).toBe(true)
    expect(t.reqNum).toBe('R-12')
    expect(t.oficioNumero).toBe('OF-77')
    expect(t.oficioPendienteAprobacion).toBe(true)
    expect(t.terminoCumplPropuesto).toEqual({ dias: 10 })
    expect(e._conceptos_seg).toBe('[]')
  })

  it('el término para cumplir sale marcado con los días propuestos (corre al aprobar/notificar)', () => {
    const c = ctx()
    const e = { _exp: 'EXP-1', _conceptos_seg: '[]' }
    const t = { id: 't1', actividad: 'Oficio de requerimiento' }
    c.applyEntregaOficioRequerimiento(e, t, item())
    const d = c.terminoCumplDefaults(e, t)
    expect(d.marcado).toBe(true)
    expect(d.dias).toBe('10')
    expect(d.obligatorio).toBe(false)
  })

  it('N° de oficio duplicado sigue bloqueando', () => {
    const c = ctx()
    c.validarNumeroOficioDisponible = () => false
    const t = { id: 't1', actividad: 'Oficio de requerimiento' }
    expect(c.applyEntregaOficioRequerimiento({ _exp: 'EXP-1', _conceptos_seg: '[]' }, t, item())).toBe(false)
    expect(t.reqNum).toBeUndefined()
  })
})

describe('Devolución de oficio de requerimiento con concepto', () => {
  it('conserva el vínculo, libera N° pendientes del concepto y permite reentregar', () => {
    const c = ctx()
    const e = { _exp: 'EXP-1', _conceptos_seg: JSON.stringify([{ conceptoReqId: 'cr1', concepto: 'C-1' }]) }
    const t = { id: 't1', actividad: 'Oficio de requerimiento', conceptoReqId: 'cr1', esOficioRequerimiento: true }
    expect(c.applyEntregaOficioRequerimiento(e, t, item())).toBe(true)
    expect(JSON.parse(e._conceptos_seg)[0].reqNum).toBe('R-12')

    c.retirarRegistroPendienteDeEntrega(e, t, {})
    expect(t.conceptoReqId).toBe('cr1')
    const cc = JSON.parse(e._conceptos_seg)[0]
    expect(cc.reqNum).toBe('')
    expect(cc.reqOficio).toBe('')
    expect(cc.reqPendienteAprobacion).toBeUndefined()

    expect(c.applyEntregaOficioRequerimiento(e, t, item({ reqNum: 'R-13' }))).toBe(true)
    expect(c.avisos.length).toBe(0)
    expect(JSON.parse(e._conceptos_seg)[0].reqNum).toBe('R-13')
  })

  it('no borra un requerimiento ya notificado (término corriendo)', () => {
    const c = ctx()
    const e = { _exp: 'EXP-1', _conceptos_seg: JSON.stringify([{ conceptoReqId: 'cr1', reqNum: 'R-12', reqOficio: 'OF-77', reqNotif: '2026-09-01', reqVence: '2026-09-15' }]) }
    const t = { id: 't1', actividad: 'Oficio de requerimiento', conceptoReqId: 'cr1', esOficioRequerimiento: true }
    c.retirarRegistroPendienteDeEntrega(e, t, { forceAll: true })
    const cc = JSON.parse(e._conceptos_seg)[0]
    expect(cc.reqNum).toBe('R-12')
    expect(cc.reqVence).toBe('2026-09-15')
  })

  it('otras actividades siguen perdiendo conceptoReqId al devolver', () => {
    const c = ctx()
    const t = { id: 't2', actividad: 'Concepto técnico', conceptoReqId: 'cr9' }
    c.retirarRegistroPendienteDeEntrega({ _exp: 'EXP-1', _conceptos_seg: '[]' }, t, {})
    expect(t.conceptoReqId).toBeUndefined()
  })
})
