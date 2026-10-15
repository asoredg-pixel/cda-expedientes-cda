/**
 * nca-pins-notas-sincronizar-pcs.test.js — Lo fijado y las notas internas del encargado NCA se ven en cualquier equipo:
 * fijadas por nombre normalizado (une variantes del mismo usuario) y notas en notas_internas/{correo} (privado).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')

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

const agendaNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function mkStorage(init) {
  const m = Object.assign({}, init || {})
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v) },
    removeItem: k => { delete m[k] },
    _m: m
  }
}

const tick = () => new Promise(r => setTimeout(r, 0))

describe('Fijadas NCA: mismo usuario escrito distinto en cada equipo', () => {
  let c, writes
  beforeEach(() => {
    writes = []
    c = createContext({
      console,
      agendaNorm,
      NCA_PQRS_PIN_LS: 'pin',
      NCA_PQRS_PIN_MIGRADO_LS: 'pin_mig',
      localStorage: mkStorage({ pin_mig: JSON.stringify({ 'JUAN PEREZ': true }) }),
      ncaPqrsPinUsuarioKey: () => 'JUAN PEREZ',
      ncaEncargadoSesionPqrsPin: () => true,
      window: {
        _db: {},
        _fsDoc: (db, a, b) => a + '/' + b,
        _fsSetDoc: (ref, data, opt) => { writes.push({ ref, data, opt }); return Promise.resolve() },
        _ncaPinsRemoteLoaded: true,
        _ncaPinsRemote: { 'Juan Pérez': ['EXP-1', 'EXP-2#t1'], otro: ['EXP-9'] }
      }
    })
    runInContext(extraer(pqrs, [
      'ncaPqrsPinsNorm', 'ncaPqrsPinsLeerLocal', 'ncaPqrsPinsGuardarLocal', 'ncaPqrsPinNombreNorm',
      'ncaPqrsPinsRemoteVariantes', 'ncaPqrsPinsPersistFirestore', 'ncaPqrsPinsLeer', 'ncaPqrsPinsGuardar'
    ]), c)
  })

  it('el otro equipo ve lo fijado bajo la variante del nombre', () => {
    expect(runInContext('ncaPqrsPinsLeer()', c)).toEqual(['EXP-1', 'EXP-2#t1'])
  })

  it('une las fijadas de todas las variantes sin duplicar', () => {
    c.window._ncaPinsRemote['juan  perez '] = ['EXP-2#t1', 'EXP-3']
    expect(runInContext('ncaPqrsPinsLeer()', c)).toEqual(['EXP-1', 'EXP-2#t1', 'EXP-3'])
  })

  it('al guardar escribe en todas las variantes (merge) y no toca otros usuarios', async () => {
    runInContext("ncaPqrsPinsGuardar(['EXP-1'])", c)
    await tick()
    expect(writes).toHaveLength(1)
    expect(writes[0].ref).toBe('sistema/global')
    expect(writes[0].opt).toEqual({ merge: true })
    expect(writes[0].data.ncaPinsByUser).toEqual({ 'Juan Pérez': ['EXP-1'], 'JUAN PEREZ': ['EXP-1'] })
    expect(c.window._ncaPinsRemote.otro).toEqual(['EXP-9'])
    expect(runInContext('ncaPqrsPinsLeer()', c)).toEqual(['EXP-1'])
  })
})

describe('Notas internas sincronizadas en notas_internas/{correo}', () => {
  let c, writes, store
  const K1 = 'juan perez|EXP-1|t1'
  const ent = (texto, updatedAt, extra) => Object.assign({ texto, notas: [{ texto }], autor: 'Juan Pérez', expId: 'EXP-1', taskId: 't1', updatedAt }, extra || {})
  const leerStore = () => JSON.parse(c.localStorage.getItem('sst_notas_internas') || '{}')

  function setup(local) {
    writes = []
    c = createContext({
      console,
      agendaNorm,
      localStorage: mkStorage({ sst_notas_internas: JSON.stringify(local || {}) }),
      notasInternasAutor: () => 'Juan Pérez',
      window: {
        _db: {},
        _usuarioActual: { email: 'Juan@CDA.gov.co' },
        _fsDoc: (db, a, b) => a + '/' + b,
        _fsSetDoc: (ref, data, opt) => { writes.push({ ref, data, opt }); return Promise.resolve() },
        _fsDeleteField: () => '__DEL__'
      }
    })
    runInContext(extraer(core, [
      'saveNotasInternasStore', 'notasInternasEmail', 'notasInternasDocRef', 'notasInternasMarcarCuenta',
      'notasInternasSubir', 'notasInternasAplicarRemoto'
    ]), c)
  }

  it('documento privado por correo en minúsculas', () => {
    setup()
    expect(runInContext('notasInternasDocRef()', c)).toBe('notas_internas/juan@cda.gov.co')
  })

  it('nota remota más reciente reemplaza la local y queda marcada como sincronizada', () => {
    setup({ [K1]: ent('vieja', '2026-10-01T10:00:00Z', { cuenta: 'juan@cda.gov.co' }) })
    c.data = { byKey: { [K1]: ent('nueva', '2026-10-15T10:00:00Z') } }
    expect(runInContext('notasInternasAplicarRemoto(data)', c)).toBe(true)
    const s = leerStore()
    expect(s[K1].texto).toBe('nueva')
    expect(s[K1].cuenta).toBe('juan@cda.gov.co')
  })

  it('migración: nota local sin sincronizar del usuario actual se sube y luego se marca', async () => {
    setup({ [K1]: ent('del PC original', '2026-10-10T10:00:00Z') })
    runInContext('notasInternasAplicarRemoto({})', c)
    await tick()
    expect(writes).toHaveLength(1)
    expect(writes[0].ref).toBe('notas_internas/juan@cda.gov.co')
    expect(writes[0].opt).toEqual({ merge: true })
    expect(writes[0].data.byKey[K1].texto).toBe('del PC original')
    expect(writes[0].data.byKey[K1].cuenta).toBeUndefined()
    expect(leerStore()[K1].cuenta).toBe('juan@cda.gov.co')
  })

  it('nota sincronizada que ya no existe en remoto se borra (eliminada en otro equipo)', () => {
    setup({ [K1]: ent('x', '2026-10-10T10:00:00Z', { cuenta: 'juan@cda.gov.co' }) })
    runInContext('notasInternasAplicarRemoto({ byKey: {} })', c)
    expect(leerStore()[K1]).toBeUndefined()
    expect(writes).toHaveLength(0)
  })

  it('notas de otra cuenta u otro autor en el mismo navegador no se tocan ni se suben', async () => {
    const kOtro = 'maria|EXP-2|t9'
    setup({
      [kOtro]: ent('de María', '2026-10-10T10:00:00Z'),
      'juan perez|EXP-3|t2': ent('otra cuenta', '2026-10-10T10:00:00Z', { cuenta: 'otro@cda.gov.co' })
    })
    runInContext('notasInternasAplicarRemoto({ byKey: {} })', c)
    await tick()
    expect(writes).toHaveLength(0)
    const s = leerStore()
    expect(s[kOtro].texto).toBe('de María')
    expect(s['juan perez|EXP-3|t2'].texto).toBe('otra cuenta')
  })

  it('local pendiente más reciente gana sobre la remota y se sube', async () => {
    setup({ [K1]: ent('editada sin red', '2026-10-15T12:00:00Z') })
    c.data = { byKey: { [K1]: ent('remota', '2026-10-15T10:00:00Z') } }
    runInContext('notasInternasAplicarRemoto(data)', c)
    await tick()
    expect(leerStore()[K1].texto).toBe('editada sin red')
    expect(writes[0].data.byKey[K1].texto).toBe('editada sin red')
  })

  it('al eliminar una nota se borra el campo remoto', async () => {
    setup()
    runInContext(`notasInternasSubir({ '${K1}': null })`, c)
    await tick()
    expect(writes[0].data.byKey[K1]).toBe('__DEL__')
  })

  it('guardar y eliminar notas llama a la subida; carga inicia la escucha en tiempo real', () => {
    for (const fn of ['setNotaInterna', 'saveNotasInternasList']) {
      expect(extraer(core, [fn])).toContain('notasInternasSubir(sub)')
    }
    expect(extraer(core, ['loadNotasInternasStore'])).toContain('notasInternasSyncStart()')
    expect(extraer(core, ['notasInternasSyncStart'])).toContain('_fsOnSnapshot')
  })

  it('reglas: solo el dueño lee y escribe su documento de notas', () => {
    expect(rules).toMatch(/match \/notas_internas\/\{email\}\s*\{\s*allow read, write: if isActiveUser\(\) && email\.lower\(\) == authEmail\(\);/)
  })
})
