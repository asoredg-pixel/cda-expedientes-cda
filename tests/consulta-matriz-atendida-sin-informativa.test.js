/**
 * consulta-matriz-atendida-sin-informativa.test.js —
 * En Consulta (secretaría), el filtro «Atendida» (solo en término) no incluye
 * PQRSD de carácter informativo; la matriz usa esa misma lista (_conExportList).
 * Las informativas sí entran en «Atendidas» (todas las cerradas).
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

function ctx() {
  const c = createContext({
    window: {},
    hoy: () => '2026-11-03',
    normalizePqrsOficinaFields: e => e,
    pqrsEstaCerrada: e => !!(e && (e._pqrs_cerrada || e._pqrs_informativa || e._pqrs_respuesta_fecha)),
    pqrsEstaAtrasada: () => false,
    pqrsPendienteTraslado: () => false,
    pqrsRespuestaEnTermino: e => {
      if (!e || !(e._pqrs_cerrada || e._pqrs_informativa || e._pqrs_respuesta_fecha)) return null
      const vence = e._vence || '2026-12-01'
      const resp = e._pqrs_respuesta_fecha || '2026-11-01'
      return resp <= vence
    },
    getPqrsPlazoInfo: e => ({ vence: e._vence || '2026-12-01' })
  })
  runInContext(
    extraer(core, ['getPqrsEstadoDisplay', 'matchPqrsEstadoConsulta']),
    c
  )
  return c
}

describe('Consulta / matriz: Atendida sin informativas', () => {
  it('«Atendida» excluye informativas y deja las respondidas en término', () => {
    const c = ctx()
    const formal = { _pqrs_cerrada: true, _pqrs_respuesta_fecha: '2026-11-01', _vence: '2026-12-01' }
    const info = { _pqrs_cerrada: true, _pqrs_informativa: true, _pqrs_respuesta_fecha: '2026-11-01', _vence: '2026-12-01' }
    const fuera = { _pqrs_cerrada: true, _pqrs_respuesta_fecha: '2026-12-15', _vence: '2026-12-01' }
    expect(c.matchPqrsEstadoConsulta(formal, 'Atendida')).toBe(true)
    expect(c.matchPqrsEstadoConsulta(info, 'Atendida')).toBe(false)
    expect(c.matchPqrsEstadoConsulta(fuera, 'Atendida')).toBe(false)
  })

  it('«Atendidas» sigue incluyendo informativas y fuera de término', () => {
    const c = ctx()
    const info = { _pqrs_cerrada: true, _pqrs_informativa: true }
    const fuera = { _pqrs_cerrada: true, _pqrs_respuesta_fecha: '2026-12-15', _vence: '2026-12-01' }
    expect(c.matchPqrsEstadoConsulta(info, 'Atendidas')).toBe(true)
    expect(c.matchPqrsEstadoConsulta(fuera, 'Atendidas')).toBe(true)
    expect(c.getPqrsEstadoDisplay(info)).toBe('Atendida (informativa)')
  })

  it('«Atendido extemporánea» tampoco mezcla informativas', () => {
    const c = ctx()
    const fuera = { _pqrs_cerrada: true, _pqrs_respuesta_fecha: '2026-12-15', _vence: '2026-12-01' }
    const infoFuera = {
      _pqrs_cerrada: true, _pqrs_informativa: true,
      _pqrs_respuesta_fecha: '2026-12-15', _vence: '2026-12-01'
    }
    expect(c.matchPqrsEstadoConsulta(fuera, 'Atendido extemporánea')).toBe(true)
    expect(c.matchPqrsEstadoConsulta(infoFuera, 'Atendido extemporánea')).toBe(false)
  })

  it('exportarConsultaMatrizPqrs usa la lista ya filtrada de consulta', () => {
    const src = extraer(core, ['exportarConsultaMatrizPqrs'])
    expect(src).toContain('window._conExportList')
    expect(src).toContain("filter(e=>esPqrsSecretaria(e))")
  })
})
