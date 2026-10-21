/**
 * El plazo legal de la PQRSD es de 15 días hábiles (festivos Colombia),
 * contados desde el día siguiente a la solicitud. No son 15 días calendario.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const utils = readFileSync(resolve(root, 'js/utils.js'), 'utf8')

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

function ctx(hoyStr) {
  const c = createContext({
    hoy: () => hoyStr,
    normalizePqrsOficinaFields: e => e,
    getTram: () => ({ plazo: 15, unidad: 'dias' }),
    ensureTramPqrsCfg: () => ({ plazo: 15, unidad: 'dias' }),
    fmtF: s => s,
    dias: () => 0,
    diffDias: () => 0,
    diasEntre: (a, b) => {
      const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')
      return Math.round(ms / 86400000)
    }
  })
  runInContext(extraer(utils, [
    '_isoDateLocal', 'pascuaDomingo', '_siguienteLunes', 'festivosColombiaSet',
    'esDiaHabilCO', 'diasHabilesEntreCO', 'addDiasHabilesCO'
  ]) + '\n' + extraer(core, [
    'getPqrsPlazoDias', 'getPqrsVenceFecha', 'pqrsEstaCerrada',
    'getPqrsPlazoInfo', 'pqrsRespuestaEnTermino', 'renderPqrsPlazoBarHtml'
  ]), c)
  return c
}

describe('PQRSD: 15 días hábiles Colombia', () => {
  it('solicitud viernes 16/10/2026 vence el lunes 9/11 (no el 31/10)', () => {
    const c = ctx('2026-10-21')
    const e = { _fecha_solicitud: '2026-10-16', _fecha: '2026-10-16' }
    expect(c.esDiaHabilCO('2026-10-17')).toBe(false)
    expect(c.esDiaHabilCO('2026-11-02')).toBe(false)
    expect(c.getPqrsVenceFecha(e)).toBe('2026-11-09')
    const p = c.getPqrsPlazoInfo(e)
    expect(p.habiles).toBe(true)
    expect(p.diasTrans).toBe(3)
    expect(p.diasRest).toBe(12)
    expect(p.pct).toBe(20)
    expect(p.estado).toBe('ok')
    const html = c.renderPqrsPlazoBarHtml(e)
    expect(html).toContain('2026-11-09')
    expect(html).toContain('días hábiles')
    expect(html).not.toContain('2026-10-31')
  })

  it('una respuesta el 3/11 sigue en término; el 10/11 ya está fuera', () => {
    const c = ctx('2026-11-10')
    const en = {
      _fecha_solicitud: '2026-10-16',
      _pqrs_estado_oficina: 'cerrado',
      _pqrs_respuesta_fecha: '2026-11-03'
    }
    const fuera = {
      _fecha_solicitud: '2026-10-16',
      _pqrs_estado_oficina: 'cerrado',
      _pqrs_respuesta_fecha: '2026-11-10'
    }
    expect(c.pqrsRespuestaEnTermino(en)).toBe(true)
    expect(c.pqrsRespuestaEnTermino(fuera)).toBe(false)
  })

  it('la fecha de término del oficio se respeta tal cual', () => {
    const c = ctx('2026-10-21')
    const e = { _fecha_solicitud: '2026-10-16', _pqrs_fecha_termino: '2026-10-31' }
    expect(c.getPqrsVenceFecha(e)).toBe('2026-10-31')
    expect(c.getPqrsPlazoInfo(e).habiles).toBe(false)
  })
})
