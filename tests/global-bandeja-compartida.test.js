/**
 * sistema/global superó 1 MB (1.115.004 bytes) y desde el 26-oct no se guardaba:
 * «PQRSD guardada, pero no se actualizó el índice global». La bandeja pesaba 580 KB porque
 * la lista compartida antigua (la del último que guardó) se sumaba a la de cada usuario.
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

const BORRAR = { _borrar: true }

function ctxGlobal() {
  const escritos = []
  const c = createContext({
    console: { log: () => {}, warn: () => {}, error: () => {} },
    actividadesLibres: [],
    personas: [{ id: 'p1', pn_nombre: 'Ana' }],
    agendaEventos: [],
    encargadosGlobal: {},
    mantenimientoEstado: { activo: false },
    normalizeEncargadosGlobal: v => v || {},
    buildBandejaEstadoPayloadForSave: () => ({
      bandejaLeidos: ['k1'], bandejaEliminados: ['k2'],
      bandejaLeidosByUser: { 'sec@cda.gov.co': ['k1'] }, bandejaEliminadosByUser: { 'sec@cda.gov.co': ['k2'] }
    }),
    Object, Array, Date, String, Set, Map, JSON, Math, Number, isFinite, isNaN,
    setTimeout: () => 0,
    window: {
      _db: {},
      _firebaseAuth: { currentUser: { email: 'sec@cda.gov.co' } },
      _fsDoc: () => 'sistema/global',
      _fsGetDoc: async () => ({ exists: () => true, data: () => ({ actividadesLibres: [] }) }),
      _fsSetDoc: async (ref, payload) => { escritos.push(payload) },
      _fsDeleteField: () => BORRAR,
      _lastFsSaveError: null
    }
  })
  runInContext('const _actLibresQuitadosIds=new Set();\n' + extraer(per, [
    'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'actLibreTieneArchivoDrive', 'scoreActividadLibreMerge',
    'pickMejorActLibre', 'mergeActLibresConRemotoParaGuardar', 'actLibresRemotoDoc',
    'sanitizeActLibreForFirestore', '_fsStripUndefinedDeep', 'quitarBandejaCompartidaDelPayload', 'saveGlobalFirestore'
  ]), c)
  return { c, escritos }
}

describe('sistema/global sin la lista compartida antigua de la bandeja', () => {
  it('al guardar se borra la lista compartida; sin bandeja_estado se conserva la de cada usuario', async () => {
    const { c, escritos } = ctxGlobal()
    c.window._bandejaDocFallo = true
    expect(await c.saveGlobalFirestore()).toBe(true)
    const p = escritos[0]
    expect(p.bandejaLeidos).toBe(BORRAR)
    expect(p.bandejaEliminados).toBe(BORRAR)
    expect(p.bandejaLeidosByUser['sec@cda.gov.co']).toEqual(['k1'])
    expect(p.personas[0].pn_nombre).toBe('Ana')
  })

  it('la orden de borrado no pasa por la limpieza de campos (se dañaría)', () => {
    const fn = extraer(per, ['saveGlobalFirestore'])
    expect(fn.indexOf('quitarBandejaCompartidaDelPayload(payload)'))
      .toBeGreaterThan(fn.indexOf('_fsStripUndefinedDeep(payload)'))
  })

  it('el guardado completo también la borra', () => {
    const fn = extraer(per, ['saveFirestore'])
    expect(fn).toContain('quitarBandejaCompartidaDelPayload(payload)')
    expect(fn).not.toMatch(/bandejaLeidos:bandejaPay/)
  })

  it('al cargar, un usuario no hereda las marcas de quien guardó último', () => {
    const store = {}
    const c = createContext({
      window: {},
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v } },
      JSON, Set, Object, Array, String
    })
    runInContext(
      'function bandejaUsuarioScope(){return "resp@cda.gov.co";}\n' +
      'let _l=["mia"],_e=[];\n' +
      'function getBandejaLeidos(){return _l.slice();}function getBandejaEliminados(){return _e.slice();}\n' +
      'function _bandejaWriteList(k,a){if(k==="leidos")_l=a;else _e=a;}\n' +
      extraer(core, ['applyBandejaEstadoFromRemote']) +
      '\nthis.leer=function(){return _l;};', c)
    c.applyBandejaEstadoFromRemote({
      bandejaLeidos: ['de-secretaria-1', 'de-secretaria-2'],
      bandejaLeidosByUser: { 'resp@cda.gov.co': ['remota-propia'] }
    })
    expect(c.leer().sort()).toEqual(['mia', 'remota-propia'])
  })
})
