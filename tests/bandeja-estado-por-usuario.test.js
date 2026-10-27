/**
 * Leídos/eliminados de la bandeja ocupaban 580 KB de sistema/global (límite 1 MB).
 * Pasan a bandeja_estado/{email}; el administrador migra las marcas de todos una vez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')

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

const UNION = vals => ({ union: vals })
const BORRAR = { borrar: true }

function ctxBandeja({ email = 'resp@cda.gov.co', admin = false, global = {}, local = { l: [], e: [] } } = {}) {
  const escritos = []
  const escuchas = []
  const timers = []
  const window = {
    _db: {},
    _fsDoc: (db, ...p) => p.join('/'),
    _fsSetDoc: async (ref, pay) => { escritos.push({ ref, pay }) },
    _fsGetDoc: async () => ({ exists: () => true, data: () => global }),
    _fsOnSnapshot: (ref, ok, err) => { escuchas.push({ ref, ok, err }); return () => {} },
    _fsArrayUnion: (...v) => UNION(v),
    _fsDeleteField: () => BORRAR
  }
  const c = createContext({
    window, console: { log: () => {}, warn: () => {} }, Promise, Set, Object, Array, String, Date,
    setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout: () => {}
  })
  runInContext(
    'let _l=' + JSON.stringify(local.l) + ',_e=' + JSON.stringify(local.e) + ';\n' +
    'function bandejaUsuarioScope(){return ' + JSON.stringify(email) + ';}\n' +
    'function esAdministrador(){return ' + admin + ';}\n' +
    'function getBandejaLeidos(){return _l.slice();}function getBandejaEliminados(){return _e.slice();}\n' +
    'function _bandejaWriteList(k,a){if(k==="leidos")_l=a;else _e=a;}\n' +
    'function saveGlobalFirestore(){window._globalGuardado=true;return Promise.resolve(true);}\n' +
    'let _bandejaDocUnsub=null;\n' +
    extraer(core, ['schedulePersistBandejaEstado', 'bandejaEstadoDocRef', 'persistBandejaEstadoUsuario',
      'detenerBandejaEstadoUsuario', 'iniciarBandejaEstadoUsuario', 'migrarBandejaGlobalAUsuarios']) +
    '\nthis.leer=function(){return {l:_l,e:_e};};', c)
  const flush = () => new Promise(r => setTimeout(r, 0))
  return { c, window, escritos, escuchas, timers, flush }
}

const snapDoc = d => ({ exists: () => !!d, data: () => d })

describe('Bandeja: estado en bandeja_estado/{email}', () => {
  it('escucha el documento del propio usuario y suma sus marcas', () => {
    const { c, escuchas } = ctxBandeja({ local: { l: ['a'], e: [] } })
    c.iniciarBandejaEstadoUsuario()
    expect(escuchas[0].ref).toBe('bandeja_estado/resp@cda.gov.co')
    escuchas[0].ok(snapDoc({ leidos: ['b'], eliminados: ['x'] }))
    expect(c.leer().l.sort()).toEqual(['a', 'b'])
    expect(c.leer().e).toEqual(['x'])
  })

  it('si aún no tiene documento, sube sus marcas actuales', async () => {
    const { c, escuchas, escritos, flush } = ctxBandeja({ local: { l: ['a'], e: ['z'] } })
    c.iniciarBandejaEstadoUsuario()
    escuchas[0].ok(snapDoc(null))
    await flush()
    expect(escritos[0].ref).toBe('bandeja_estado/resp@cda.gov.co')
    expect(escritos[0].pay.leidos).toEqual(['a'])
    expect(escritos[0].pay.eliminados).toEqual(['z'])
  })

  it('marcar un aviso guarda solo el documento del usuario, no sistema/global', async () => {
    const { c, window, escuchas, escritos, timers, flush } = ctxBandeja({ local: { l: ['a'], e: [] } })
    c.iniciarBandejaEstadoUsuario()
    escuchas[0].ok(snapDoc({ leidos: ['a'] }))
    c.schedulePersistBandejaEstado()
    timers.pop()()
    await flush()
    expect(window._globalGuardado).toBeUndefined()
    expect(escritos.at(-1).ref).toBe('bandeja_estado/resp@cda.gov.co')
  })

  it('sin regla publicada (permisos) sigue usando sistema/global', () => {
    const { c, window, escuchas, timers } = ctxBandeja()
    c.iniciarBandejaEstadoUsuario()
    escuchas[0].err(new Error('permission-denied'))
    expect(window._bandejaDocFallo).toBe(true)
    c.schedulePersistBandejaEstado()
    timers.pop()()
    expect(window._globalGuardado).toBe(true)
  })

  it('el administrador migra las marcas de todos y luego las borra de sistema/global', async () => {
    const { c, window, escritos } = ctxBandeja({
      email: 'admin@cda.gov.co', admin: true,
      global: {
        bandejaLeidosByUser: { 'sec@cda.gov.co': ['s1', 's2'], 'resp@cda.gov.co': ['r1'] },
        bandejaEliminadosByUser: { 'sec@cda.gov.co': ['s9'] }
      }
    })
    await c.migrarBandejaGlobalAUsuarios()
    const sec = escritos.find(w => w.ref === 'bandeja_estado/sec@cda.gov.co')
    expect(sec.pay.leidos).toEqual(UNION(['s1', 's2']))
    expect(sec.pay.eliminados).toEqual(UNION(['s9']))
    expect(escritos.find(w => w.ref === 'bandeja_estado/resp@cda.gov.co').pay.leidos).toEqual(UNION(['r1']))
    const ultimo = escritos.at(-1)
    expect(ultimo.ref).toBe('sistema/global')
    expect(ultimo.pay.bandejaLeidosByUser).toBe(BORRAR)
    expect(ultimo.pay.bandejaEliminadosByUser).toBe(BORRAR)
    expect(window._bandejaMigracionHecha).toBe(true)
  })

  it('si falla la copia de un usuario no borra nada de sistema/global', async () => {
    const { c, window, escritos } = ctxBandeja({
      admin: true, global: { bandejaLeidosByUser: { 'sec@cda.gov.co': ['s1'] } }
    })
    window._fsSetDoc = async () => { throw new Error('unavailable') }
    await c.migrarBandejaGlobalAUsuarios()
    expect(escritos).toHaveLength(0)
    expect(window._bandejaMigracionHecha).toBeUndefined()
  })

  it('un usuario que no es administrador no migra a otros', async () => {
    const { c, escritos } = ctxBandeja({ global: { bandejaLeidosByUser: { 'sec@cda.gov.co': ['s1'] } } })
    await c.migrarBandejaGlobalAUsuarios()
    expect(escritos).toHaveLength(0)
  })

  it('sistema/global deja de reescribir las listas de todos', () => {
    const c = createContext({ window: { _fsDeleteField: () => BORRAR } })
    runInContext(extraer(per, ['quitarBandejaCompartidaDelPayload']), c)
    const p = c.quitarBandejaCompartidaDelPayload({ bandejaLeidosByUser: { a: [] }, bandejaEliminadosByUser: {}, personas: [] })
    expect('bandejaLeidosByUser' in p).toBe(false)
    expect('bandejaEliminadosByUser' in p).toBe(false)
    c.window._bandejaDocFallo = true
    const q = c.quitarBandejaCompartidaDelPayload({ bandejaLeidosByUser: { a: [] } })
    expect(q.bandejaLeidosByUser).toEqual({ a: [] })
  })

  it('la regla permite al dueño y al administrador', () => {
    expect(rules).toMatch(/match \/bandeja_estado\/\{email\}[\s\S]*?email\.lower\(\) == authEmail\(\) \|\| isAdmin\(\)/)
    expect(per).toContain("if(typeof iniciarBandejaEstadoUsuario==='function')iniciarBandejaEstadoUsuario();")
  })
})
