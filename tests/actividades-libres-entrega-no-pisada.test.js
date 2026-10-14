/**
 * actividades-libres-entrega-no-pisada.test.js — Informes enviados a revisión que no aparecían en «Por revisar»:
 * otra sesión con copia vieja pisaba la entrega al guardar la lista completa, y los cambios que llegaban
 * mientras la sesión guardaba se descartaban.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function ctx(locales, extra) {
  const c = createContext(Object.assign({ console, Date, Map, Set, actividadesLibres: locales }, extra || {}))
  runInContext('var _actLibresQuitadosIds=new Set();\n' + extraer(per, [
    'actLibreEventTs', 'mergeActLibresConRemotoParaGuardar', 'actLibresMarcarEntregasLocalesMasRecientes'
  ]), c)
  return c
}

const ahora = Date.now()
const vieja = { id: 'inf1', codigo: 'ACT-GV-0005', estado: 'En ejecución', historial: [{ tipo: 'asignacion', ts: ahora - 86400000 }] }
const entregada = {
  id: 'inf1', codigo: 'ACT-GV-0005', estado: 'Por verificar', fechaReportada: '2026-10-14',
  historial: [{ tipo: 'asignacion', ts: ahora - 86400000 }, { tipo: 'reenvio_verificacion', ts: ahora - 60000 }]
}

describe('Informe entregado: otra sesión no lo pisa', () => {
  it('al guardar, la copia vieja de esta sesión no reemplaza la entrega más reciente de Firestore', () => {
    const c = ctx([vieja])
    const out = c.mergeActLibresConRemotoParaGuardar([vieja], [entregada])
    expect(out).toHaveLength(1)
    expect(out[0].estado).toBe('Por verificar')
  })

  it('el cambio propio más reciente sí se guarda (aprobación o devolución)', () => {
    const aprobada = Object.assign({}, entregada, {
      estado: 'Atendida', historial: entregada.historial.concat([{ tipo: 'verificacion', ts: ahora }])
    })
    const c = ctx([aprobada])
    expect(c.mergeActLibresConRemotoParaGuardar([aprobada], [entregada])[0].estado).toBe('Atendida')
  })

  it('al cargar, la entrega local pisada en Firestore queda marcada para volver a subirse', () => {
    const local = Object.assign({}, entregada)
    const c = ctx([local])
    expect(c.actLibresMarcarEntregasLocalesMasRecientes([vieja])).toBe(1)
    expect(local._pending_fs_sync).toBe(true)
    const igual = Object.assign({}, entregada)
    const c2 = ctx([igual])
    expect(c2.actLibresMarcarEntregasLocalesMasRecientes([entregada])).toBe(0)
    expect(igual._pending_fs_sync).toBeUndefined()
  })

  it('cambio que llega mientras se guarda: se reaplica al terminar (no se descarta)', () => {
    vi.useFakeTimers()
    try {
      let aplicadas = 0
      const c = createContext({
        _localSaving: true, actividadesLibres: [],
        upsertActividadesLibresFromRemote: l => { aplicadas++; return l },
        mergeActividadesLibresFromRemote: l => { aplicadas++; return l },
        actLibresRemotoCombinado: (k, l) => l,
        _saveLSLocal: () => {}, scheduleRefreshViewsAfterRemoteDataChange: () => {},
        setTimeout, clearTimeout
      })
      runInContext('var _actLibresSnapDiferidos={};\n' + extraer(per, ['cancelarActLibresSnapDiferido', 'diferirActLibresSnap']), c)
      c.diferirActLibresSnap('global', [entregada], false)
      vi.advanceTimersByTime(2600)
      expect(aplicadas).toBe(0)
      runInContext('_localSaving=false', c)
      vi.advanceTimersByTime(2600)
      expect(aplicadas).toBe(1)
      expect(c.actividadesLibres[0].estado).toBe('Por verificar')
    } finally {
      vi.useRealTimers()
    }
  })

  it('los listeners difieren (no descartan) y la carga reintenta subir pendientes', () => {
    expect(per).toMatch(/if\(_localSaving\)\{\s*if\(snap\.exists\(\)\)diferirActLibresSnap\('depto:'\+deptoId/)
    expect(per).toMatch(/if\(_localSaving\)\{\s*if\(snap\.exists\(\)\)diferirActLibresSnap\('global'/)
    expect(per).toMatch(/if\(sesionOn\)syncPendingActividadesLibresToFirestore\(\)/)
  })
})
