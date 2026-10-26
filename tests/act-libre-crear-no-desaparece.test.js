/**
 * «+ crear actividad» sin expediente: un snapshot viejo no debe borrar el alta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

const nombres = [
  'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'scoreActividadLibreMerge', 'actLibreTieneEntrega', 'pickMejorActLibre',
  'actLibreEsEntregaHuerfana',
  'actLibreEsAltaReciente', 'actLibreKeepLocalOnly', 'clearActividadesLibresLocalCache',
  'upsertActividadesLibresFromRemote'
]

function alta(id, ts) {
  return {
    id, codigo: 'ACT-GV-0099', actividad: 'Visita', estado: 'En ejecución',
    historial: [{ tipo: 'asignacion', ts: ts || Date.now() }], soportes: []
  }
}

describe('Crear actividad sin expediente', () => {
  it('el snapshot anterior no borra el alta recién creada', () => {
    const nueva = alta('nueva')
    const vieja = alta('vieja', Date.now() - 86400000)
    const c = createContext({
      actividadesLibres: [vieja, nueva],
      _actLibresQuitadosIds: new Set(),
      window: {},
      localStorage: { removeItem() {} },
      Map, Set, Date
    })
    runInContext(extraer(per, nombres), c)
    const out = c.upsertActividadesLibresFromRemote([vieja])
    expect(out.map(t => t.id).sort()).toEqual(['nueva', 'vieja'])
  })

  it('una actividad vieja que ya no está en remoto no se resucita', () => {
    const vieja = alta('vieja', Date.now() - 86400000)
    const otra = alta('otra', Date.now() - 86400000)
    const c = createContext({
      actividadesLibres: [vieja, otra],
      _actLibresQuitadosIds: new Set(),
      window: {},
      localStorage: { removeItem() {} },
      Map, Set, Date
    })
    runInContext(extraer(per, nombres), c)
    const out = c.upsertActividadesLibresFromRemote([otra])
    expect(out.map(t => t.id)).toEqual(['otra'])
  })

  it('el alta se marca pendiente y se guarda en Firestore', () => {
    const fn = extraer(core, ['submitCrearActLibre'])
    expect(fn).toContain('_pending_fs_sync')
    expect(fn).toContain('persistActividadesLibresFirestore')
  })
})
