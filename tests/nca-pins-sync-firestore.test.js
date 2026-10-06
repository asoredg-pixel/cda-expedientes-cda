/**
 * nca-pins-sync-firestore.test.js — 📌 Fijar del encargado NCA: se comparte entre equipos vía
 * sistema/global.ncaPinsByUser; cada equipo suma sus fijadas locales una sola vez.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
const pers = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function mkCtx(localPins) {
  const store = {}
  const writes = []
  if (localPins) store.sst_nca_pqrs_pin_por_ejecutar = JSON.stringify({ Ana: localPins })
  const c = createContext({
    window: { _db: {}, _fsDoc: () => 'doc', _fsSetDoc: (d, data) => { writes.push(data); return Promise.resolve() } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) }
    },
    responsableActivo: 'Ana',
    getEncargadoDepto: () => 'Ana',
    ncaEncargadoSesionPqrsPin: () => true,
    console
  })
  runInContext(
    "const NCA_PQRS_PIN_LS='sst_nca_pqrs_pin_por_ejecutar';\nconst NCA_PQRS_PIN_MIGRADO_LS='sst_nca_pqrs_pin_migrado';\n" +
    extraer(pqrs, ['ncaPqrsPinUsuarioKey', 'ncaPqrsPinsNorm', 'ncaPqrsPinsLeerLocal', 'ncaPqrsPinsGuardarLocal',
      'ncaPqrsPinsPersistFirestore', 'ncaPqrsPinsApplyFromGlobal', 'ncaPqrsPinsLeer', 'ncaPqrsPinsGuardar']), c)
  return { c, writes }
}

describe('Fijadas NCA sincronizadas entre equipos', () => {
  it('otro equipo sin fijadas locales ve las de Firestore', () => {
    const { c, writes } = mkCtx(null)
    c.ncaPqrsPinsApplyFromGlobal({ ncaPinsByUser: { Ana: ['EXP-1', 'EXP-2'] } })
    expect(c.ncaPqrsPinsLeer()).toEqual(['EXP-1', 'EXP-2'])
    expect(writes.length).toBe(0)
  })

  it('primera carga en el equipo que ya tenía fijadas: suma y sube a Firestore', () => {
    const { c, writes } = mkCtx(['EXP-9', 'EXP-1'])
    c.ncaPqrsPinsApplyFromGlobal({ ncaPinsByUser: { Ana: ['EXP-1'] } })
    expect(c.ncaPqrsPinsLeer()).toEqual(['EXP-1', 'EXP-9'])
    expect(writes).toEqual([{ ncaPinsByUser: { Ana: ['EXP-1', 'EXP-9'] } }])
  })

  it('después de migrar manda Firestore (desfijar en otro equipo se refleja)', () => {
    const { c } = mkCtx(['EXP-1', 'EXP-2'])
    c.ncaPqrsPinsApplyFromGlobal({ ncaPinsByUser: { Ana: ['EXP-1', 'EXP-2'] } })
    expect(c.ncaPqrsPinsLeer()).toEqual(['EXP-1', 'EXP-2'])
    const cambio = c.ncaPqrsPinsApplyFromGlobal({ ncaPinsByUser: { Ana: ['EXP-2'] } })
    expect(cambio).toBe(true)
    expect(c.ncaPqrsPinsLeer()).toEqual(['EXP-2'])
  })

  it('fijar escribe solo el campo del usuario con merge', () => {
    const { c, writes } = mkCtx(null)
    c.ncaPqrsPinsGuardar(['EXP-5'])
    expect(writes).toEqual([{ ncaPinsByUser: { Ana: ['EXP-5'] } }])
    expect(extraer(pqrs, ['ncaPqrsPinsPersistFirestore'])).toContain('{merge:true}')
  })

  it('carga inicial y tiempo real aplican ncaPinsByUser', () => {
    expect(pers).toContain('if(typeof ncaPqrsPinsApplyFromGlobal===\'function\')ncaPqrsPinsApplyFromGlobal(g);')
    expect(extraer(pers, ['initRealtimeGlobalSync'])).toContain('ncaPqrsPinsApplyFromGlobal(g))changed=true;')
  })
})
