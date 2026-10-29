/**
 * Guainía y Vaupés no abren su colección de expedientes hasta que guarden datos.
 * Personas, libres y agenda salen de sistema/global solo si el documento partido se escribió.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

const BORRAR = { _borrar: true }
const srcSave = 'const _actLibresQuitadosIds=new Set();\n' + extraer(per, [
  'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'actLibreTieneArchivoDrive', 'scoreActividadLibreMerge',
  'pickMejorActLibre', 'mergeActLibresConRemotoParaGuardar', 'actLibresRemotoDoc', 'actLibresRemotoPreferido',
  'escribirParteSistema', 'moverCamposAPartes', 'sanitizeActLibreForFirestore', '_fsStripUndefinedDeep',
  'quitarBandejaCompartidaDelPayload', 'saveGlobalFirestore'
])

function ctxDeptos(rol) {
  const c = createContext({
    window: { _usuarioActual: { rol: rol } },
    DEPTOS_FIRESTORE: ['guaviare', 'guainia', 'vaupes'],
    DEPTOS_EXPEDIENTES_ACTIVOS: ['guaviare'],
    DEPTOS: [{ id: 'guaviare' }, { id: 'guainia' }, { id: 'vaupes' }]
  })
  runInContext(extraer(per, ['deptosExpedientesAccesibles']), c)
  return c
}

function ctxSave(opts) {
  const escritos = []
  const c = createContext({
    console: { log: () => {}, warn: () => {}, error: () => {} },
    actividadesLibres: [{ id: 'L1' }],
    personas: [{ id: 'p1', pn_nombre: 'Ana' }],
    agendaEventos: [{ id: 'a1' }],
    encargadosGlobal: {},
    mantenimientoEstado: { activo: false },
    normalizeEncargadosGlobal: v => v || {},
    sanitizeActLibreForFirestore: t => t,
    Object, Array, Date, String, Set, Map, JSON, Math, Number, isFinite, isNaN,
    setTimeout: () => 0,
    window: {
      _db: {},
      _firebaseAuth: { currentUser: { email: 'enc@cda.gov.co' } },
      _fsDoc: (db, col, id) => col + '/' + id,
      _fsGetDoc: opts.getDoc,
      _fsSetDoc: async (ref, payload) => {
        escritos.push({ ref: ref, payload: payload })
        if (opts.falla && opts.falla(ref)) throw new Error('permission-denied')
      },
      _fsDeleteField: () => BORRAR
    }
  })
  runInContext(srcSave, c)
  return { c, escritos }
}

describe('expedientes de departamentos sin datos', () => {
  it('admin y jurisdiccional solo escuchan los departamentos activos', () => {
    expect(ctxDeptos('admin').deptosExpedientesAccesibles()).toEqual(['guaviare'])
    expect(ctxDeptos('jurisdiccional').deptosExpedientesAccesibles()).toEqual(['guaviare'])
  })

  it('el encargado de Guaviare sigue en Guaviare', () => {
    expect(ctxDeptos('guaviare').deptosExpedientesAccesibles()).toEqual(['guaviare'])
  })

  it('Guainía no abre su colección hasta agregarla a los activos', () => {
    expect(ctxDeptos('guainia').deptosExpedientesAccesibles()).toEqual([])
  })

  it('la consulta por número usa los departamentos activos', () => {
    expect(extraer(per, ['fetchExpedientePorNumero'])).toContain('DEPTOS_EXPEDIENTES_ACTIVOS')
  })
})

describe('sistema/global partido', () => {
  it('las reglas abren las cuatro partes y cierran cualquier otro documento', () => {
    ['actividades_libres', 'personas', 'agenda', 'fichas'].forEach(function(id) {
      expect(rules).toContain('match /sistema/' + id + ' {')
    })
    expect(rules).toContain('match /sistema/{docId} {')
    expect(rules).toContain('allow read, write: if false;')
  })

  it('si la parte se escribe, global deja de llevar el arreglo', async () => {
    const { c, escritos } = ctxSave({
      getDoc: async () => ({ exists: () => true, data: () => ({ actividadesLibres: [{ id: 'L1' }] }) })
    })
    expect(await c.saveGlobalFirestore()).toBe(true)
    const global = escritos.find(x => x.ref === 'sistema/global').payload
    expect(global.personas).toBe(BORRAR)
    expect(global.actividadesLibres).toBe(BORRAR)
    expect(global.agendaEventos).toBe(BORRAR)
    expect(escritos.find(x => x.ref === 'sistema/personas').payload.personas[0].pn_nombre).toBe('Ana')
    expect(escritos.find(x => x.ref === 'sistema/actividades_libres').payload.actividadesLibres[0].id).toBe('L1')
    expect(escritos.find(x => x.ref === 'sistema/agenda').payload.agendaEventos[0].id).toBe('a1')
  })

  it('si la parte no se puede escribir, el arreglo sigue en global', async () => {
    const { c, escritos } = ctxSave({
      getDoc: async () => ({ exists: () => true, data: () => ({ actividadesLibres: [{ id: 'L1' }] }) }),
      falla: ref => String(ref).indexOf('sistema/personas') >= 0
    })
    expect(await c.saveGlobalFirestore()).toBe(true)
    const global = escritos.find(x => x.ref === 'sistema/global').payload
    expect(global.personas[0].pn_nombre).toBe('Ana')
    expect(global.actividadesLibres).toBe(BORRAR)
  })

  it('las libres se leen del documento partido y, si no está, de global', async () => {
    const c = createContext({
      console: { warn: () => {} },
      window: {
        _db: {},
        _fsDoc: (db, col, id) => col + '/' + id,
        _fsGetDoc: async ref => {
          if (ref === 'sistema/actividades_libres') return { exists: () => true, data: () => ({ actividadesLibres: [{ id: 'parte' }] }) }
          return { exists: () => true, data: () => ({ actividadesLibres: [{ id: 'global' }] }) }
        }
      }
    })
    runInContext(extraer(per, ['actLibresRemotoDoc', 'actLibresRemotoPreferido']), c)
    expect((await c.actLibresRemotoPreferido())[0].id).toBe('parte')
    c.window._fsGetDoc = async ref => {
      if (ref === 'sistema/actividades_libres') return { exists: () => false, data: () => ({}) }
      return { exists: () => true, data: () => ({ actividadesLibres: [{ id: 'global' }] }) }
    }
    expect((await c.actLibresRemotoPreferido())[0].id).toBe('global')
  })
})
