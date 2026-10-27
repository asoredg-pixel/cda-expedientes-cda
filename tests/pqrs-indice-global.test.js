/**
 * Radicar PQRSD guarda el índice (personas) aunque falle la lista de actividades libres.
 * Ese fallo no debe mostrar «PQRSD guardada, pero no se actualizó el índice global».
 */
import { describe, it, expect } from 'vitest'
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
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

const src = 'const _actLibresQuitadosIds=new Set();\n' + extraer(per, [
  'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'actLibreTieneArchivoDrive', 'scoreActividadLibreMerge',
  'pickMejorActLibre', 'mergeActLibresConRemotoParaGuardar', 'actLibresRemotoDoc',
  'sanitizeActLibreForFirestore', '_fsStripUndefinedDeep', 'quitarBandejaCompartidaDelPayload', 'saveGlobalFirestore'
])

function armar(opts) {
  const escritos = []
  const c = createContext({
    console,
    actividadesLibres: opts.locales || [],
    personas: [{ id: 'p1', pn_nombre: 'Ana' }],
    agendaEventos: [],
    encargadosGlobal: {},
    mantenimientoEstado: { activo: false },
    normalizeEncargadosGlobal: v => v || {},
    Object, Array, Date, String, Set, Map, JSON, Math, Number, isFinite, isNaN,
    setTimeout: () => 0,
    window: {
      _db: {},
      _firebaseAuth: { currentUser: { email: 'sec@cda.gov.co' } },
      _fsDoc: () => 'sistema/global',
      _fsGetDoc: opts.getDoc,
      _fsSetDoc: async (ref, payload) => {
        escritos.push(payload)
        if (opts.failIf && opts.failIf(payload)) {
          const err = new Error('payload')
          err.code = 'invalid-argument'
          throw err
        }
      },
      _lastFsSaveError: null
    }
  })
  runInContext(src, c)
  return { c, escritos }
}

describe('Índice global al radicar', () => {
  it('si no se puede leer actividades libres, igual guarda personas y no toca esa lista', async () => {
    const { c, escritos } = armar({
      getDoc: async () => { throw new Error('timeout') }
    })
    const ok = await c.saveGlobalFirestore()
    expect(ok).toBe(true)
    expect(escritos).toHaveLength(1)
    expect(escritos[0].personas[0].pn_nombre).toBe('Ana')
    expect(escritos[0].actividadesLibres).toBeUndefined()
  })

  it('si el guardado completo falla, reintenta el índice sin actividades libres', async () => {
    const { c, escritos } = armar({
      locales: [{ id: 'inf1', estado: 'Por verificar', fechaReportada: '2026-10-22' }],
      getDoc: async () => ({
        exists: () => true,
        data: () => ({ actividadesLibres: [{ id: 'inf1', estado: 'Por verificar' }] })
      }),
      failIf: payload => Object.prototype.hasOwnProperty.call(payload, 'actividadesLibres')
    })
    const ok = await c.saveGlobalFirestore()
    expect(ok).toBe(true)
    expect(escritos).toHaveLength(2)
    expect(escritos[1].personas[0].pn_nombre).toBe('Ana')
    expect(escritos[1].actividadesLibres).toBeUndefined()
  })
})
