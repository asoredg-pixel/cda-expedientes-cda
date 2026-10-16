/**
 * devolver-por-firmar-sync-vital.test.js — Si el encargado devuelve desde Por firmar, VITAL debe
 * dejar de ver la actividad al llegar el snapshot (sin F5). No resucitar firmaWf local ni retrasar el persist por Drive.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

describe('Devolver desde Por firmar: sync inmediato para VITAL', () => {
  it('merge de tasks: no resucita firmaWf local si remoto quedó Por corregir', () => {
    const c = createContext({
      normalizeTask: t => t,
      String, Array, Object, Math, Number, Date, isFinite
    })
    runInContext(extraer(persistence, ['taskRemotoDevueltoACorregir', 'mergeExpedienteTasksLocalRemote']), c)
    const local = [{
      id: 't1', estado: 'Atendida',
      firmaWf: { fase: 'por_firmar' },
      historial: [{ tipo: 'enviar_firma', ts: 1 }]
    }]
    const remote = [{
      id: 't1', estado: 'Por corregir',
      firmaWf: { fase: '', canal: 'correo' },
      historial: [
        { tipo: 'enviar_firma', ts: 1 },
        { tipo: 'devolver_desde_firma', ts: 2, nota: 'Corregir' },
        { tipo: 'ajuste_soporte', ts: 3 }
      ]
    }]
    const out = c.mergeExpedienteTasksLocalRemote(local, remote)
    expect(out).toHaveLength(1)
    expect(out[0].estado).toBe('Por corregir')
    expect(String(out[0].firmaWf.fase || '')).toBe('')
  })

  it('pickMejorActLibre: Por corregir sin fase gana frente a caché en Por firmar', () => {
    const c = createContext({ String, Array, Object, Math, Number, Date, isFinite, isNaN })
    runInContext(extraer(persistence, [
      'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'scoreActividadLibreMerge', 'pickMejorActLibre'
    ]), c)
    const enFirma = {
      id: 'a1', estado: 'Atendida',
      firmaWf: { fase: 'por_firmar' },
      historial: [{ tipo: 'enviar_firma', fecha: '2026-10-15' }]
    }
    const corregir = {
      id: 'a1', estado: 'Por corregir',
      firmaWf: { fase: '' },
      historial: [
        { tipo: 'enviar_firma', fecha: '2026-10-15' },
        { tipo: 'devolver_desde_firma', ts: Date.now(), nota: 'x' }
      ]
    }
    expect(c.pickMejorActLibre(enFirma, corregir).estado).toBe('Por corregir')
    expect(c.pickMejorActLibre(corregir, enFirma).estado).toBe('Por corregir')
  })

  it('encargadoDevolverDesdeFirmaACorregir persiste antes del renombre Drive', () => {
    const fn = extraer(core, ['encargadoDevolverDesdeFirmaACorregir'])
    const persistAt = fn.indexOf('persistExpedienteGranular(e)')
    const renameAt = fn.indexOf('_pqrsRenombrarDocsDriveWf')
    expect(persistAt).toBeGreaterThan(0)
    expect(renameAt).toBeGreaterThan(persistAt)
    expect(fn).toMatch(/_pqrsRenombrarDocsDriveWf\([\s\S]*?\)\s*\.catch/)
  })
})
