/**
 * El medidor mostró que al ingresar se descargaban los 818 expedientes dos veces:
 * la escucha en tiempo real y luego getDocs en reloadExpedientesTrasLogin.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function ctxCarga({ topeMs = 50 } = {}) {
  const escuchas = []
  const log = { getDocs: 0 }
  const c = createContext({
    console: { log: () => {}, warn: () => {} },
    Promise, setTimeout, Array,
    window: {
      _db: {},
      _firebaseAuth: { currentUser: { uid: 'u' } },
      _fsCollection: (db, ...p) => ({ path: p.join('/') }),
      _fsOnSnapshot: (ref, cb, err) => { const e = { ref, cb, err, vivo: true }; escuchas.push(e); return () => { e.vivo = false } },
      _fsGetDocs: async () => { log.getDocs++; return { docs: [] } }
    }
  })
  runInContext(
    'let exps=[];let _fsUnsub=null;let _loadLSGen=0;\n' +
    'const EXP_PRIMER_SNAP_TOPE_MS=' + topeMs + ';let _expPrimerSnap={};\n' +
    'function deptosExpedientesAccesibles(){return ["guaviare"];}\n' +
    'function applyExpedienteFirestoreChanges(ch){ch.forEach(function(x){exps.push(x.doc);});return ch.length>0;}\n' +
    'function hydrateExpsFromSnapshotDocs(){return false;}\n' +
    'function scheduleRefreshViewsAfterRemoteDataChange(){}\n' +
    'function mergePendingExpBackup(){}function clearLegacyExpsLocalStorage(){}function updateSyncIndicator(){}\n' +
    'async function loadExpedientesDepto(d){await window._fsGetDocs();return [];}\n' +
    'function mergeRemoteExpsIntoCache(r){return exps.length;}\n' +
    extraer(persistence, ['esperarPrimerSnapExpedientes', 'stopRealtimeExpSync', 'initRealtimeSync', 'reloadExpedientesTrasLogin']),
    c)
  return { c, escuchas, log }
}

const snap = (n, fromCache = false) => ({
  metadata: { fromCache },
  docs: [],
  docChanges: () => Array.from({ length: n }, (_, i) => ({ doc: { _exp: 'E' + i } }))
})

describe('Expedientes: una sola descarga al ingresar', () => {
  it('usa lo que trajo la escucha y no vuelve a descargar', async () => {
    const { c, escuchas, log } = ctxCarga({ topeMs: 2000 })
    c.initRealtimeSync()
    const p = c.reloadExpedientesTrasLogin()
    escuchas[0].cb(snap(818))
    expect(await p).toBe(true)
    expect(log.getDocs).toBe(0)
  })

  it('si la escucha no responde a tiempo descarga como respaldo', async () => {
    const { c, log } = ctxCarga({ topeMs: 20 })
    c.initRealtimeSync()
    await c.reloadExpedientesTrasLogin()
    expect(log.getDocs).toBeGreaterThan(0)
  })

  it('una respuesta solo de caché no cuenta como datos del servidor', async () => {
    const { c, escuchas, log } = ctxCarga({ topeMs: 30 })
    c.initRealtimeSync()
    const p = c.reloadExpedientesTrasLogin()
    escuchas[0].cb(snap(5, true))
    await p
    expect(log.getDocs).toBeGreaterThan(0)
  })

  it('si la escucha falla (permisos) descarga como respaldo', async () => {
    const { c, escuchas, log } = ctxCarga({ topeMs: 2000 })
    c.initRealtimeSync()
    const p = c.reloadExpedientesTrasLogin()
    escuchas[0].err(new Error('permission-denied'))
    await p
    expect(log.getDocs).toBeGreaterThan(0)
  })

  it('sin escucha activa mantiene la descarga de siempre', async () => {
    const { c, log } = ctxCarga()
    await c.reloadExpedientesTrasLogin()
    expect(log.getDocs).toBeGreaterThan(0)
  })

  it('al detener la escucha la espera no queda colgada', async () => {
    const { c } = ctxCarga({ topeMs: 60000 })
    c.initRealtimeSync()
    const p = c.esperarPrimerSnapExpedientes(['guaviare'], 60000)
    c.stopRealtimeExpSync()
    expect(await p).toBe(false)
  })
})
