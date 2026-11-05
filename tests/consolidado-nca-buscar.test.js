/**
 * El encargado NCA no escucha todo el archivo al abrir Consolidado.
 * Buscar lee solo los radicados del corte.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

describe('Consolidado del encargado: buscar por corte', () => {
  it('abrir el menú no enciende la escucha completa', () => {
    const form = read('js/formulario.js')
    expect(form).toContain("if(typeof asegurarEscuchaConsolidado==='function')asegurarEscuchaConsolidado()")
    const pers = read('js/persistence.js')
    const ini = pers.indexOf('function consolidadoBuscaPorCorte(')
    const fin = pers.indexOf('\nfunction ', ini + 10)
    const body = pers.slice(ini, fin)
    expect(body).toContain('return true')
    expect(extraer(pers, ['asegurarEscuchaConsolidado'])).toContain('_consEscuchaCompleta=false')
  })


  it('sin corte no consulta Firestore', async () => {
    let consultas = 0
    const c = createContext({
      esNcaDeguv: () => true,
      getPeriodoRango: () => null,
      notif: () => {},
      renderConsolidadoNcaEspera: () => {},
      window: {},
      _fsGetDocs: () => { consultas += 1 }
    })
    c.window = c
    runInContext(extraer(read('js/persistence.js'), ['consolidadoBuscaPorCorte', 'consTramiteBusqueda', 'consClaveBusqueda', 'consErrorEsIndice', 'buscarConsolidadoNca']), c)
    await c.buscarConsolidadoNca()
    expect(consultas).toBe(0)
    expect(c._consNcaList).toBe(null)
  })

  it('con corte lee solo _fecha de ese rango', async () => {
    const wheres = []
    const c = createContext({
      esNcaDeguv: () => true,
      deptoActivo: 'guaviare',
      getPeriodoRango: () => ({ desde: '2026-01-01', hasta: '2026-03-31' }),
      mergeExpFromFirestoreSnapshot: (data, id) => Object.assign({ _exp: id }, data),
      expEstaEnPapelera: e => !!e._eliminado,
      renderConsolidado: () => {},
      window: {},
      _db: {},
      _fsCollection: () => 'col',
      _fsWhere: (campo, op, val) => { wheres.push([campo, op, val]); return { campo, op, val } },
      _fsQuery: (col, ...rest) => ({ col, rest }),
      _fsGetDocs: async () => ({
        forEach(fn) {
          fn({ id: 'VIEJO', data: () => ({ _fecha: '2026-02-01', _eliminado: true }) })
          fn({ id: 'A', data: () => ({ _fecha: '2026-02-10' }) })
        }
      })
    })
    c.window = c
    runInContext(extraer(read('js/persistence.js'), ['consolidadoBuscaPorCorte', 'consTramiteBusqueda', 'consClaveBusqueda', 'consErrorEsIndice', 'buscarConsolidadoNca']), c)
    await c.buscarConsolidadoNca()
    expect(wheres.map(w => w[0])).toEqual(['_fecha', '_fecha'])
    expect(wheres[0][2]).toBe('2026-01-01')
    expect(String(wheres[1][2]).startsWith('2026-03-31')).toBe(true)
    expect(c._consNcaList.map(e => e._exp)).toEqual(['A'])
    expect(c._consNcaRango).toBe('2026-01-01|2026-03-31|')
  })

  it('el jurisdiccional con un departamento solo lee ese corte', async () => {
    const cols = []
    const c = createContext({
      esNcaDeguv: () => false,
      esJurisdiccional: () => true,
      deptosExpedientesAccesibles: () => ['guaviare', 'guainia'],
      getPeriodoRango: () => ({ desde: '2026-01-01', hasta: '2026-01-31' }),
      mergeExpFromFirestoreSnapshot: (data, id) => Object.assign({ _exp: id }, data),
      renderConsolidado: () => {},
      window: {},
      _db: {},
      _jurisFiltroDepto: 'guaviare',
      _fsCollection: (db, raiz, depto) => { cols.push(depto); return depto },
      _fsWhere: (campo, op, val) => ({ campo, op, val }),
      _fsQuery: col => col,
      _fsGetDocs: async col => ({
        forEach(fn) { fn({ id: col + '-1', data: () => ({ _fecha: '2026-01-15' }) }) }
      })
    })
    c.window = c
    runInContext(extraer(read('js/persistence.js'), ['consolidadoBuscaPorCorte', 'consTramiteBusqueda', 'consClaveBusqueda', 'consErrorEsIndice', 'buscarConsolidadoNca']), c)
    await c.buscarConsolidadoNca()
    expect(cols).toEqual(['guaviare'])
    expect(c._consNcaList.map(e => e._exp)).toEqual(['guaviare-1'])
  })

  it('con tipo de trámite no pide índice: lee solo _fecha y guarda el corte completo', async () => {
    const wheres = []
    const c = createContext({
      esNcaDeguv: () => true,
      deptoActivo: 'guaviare',
      getPeriodoRango: () => ({ desde: '2026-01-01', hasta: '2026-03-31' }),
      mergeExpFromFirestoreSnapshot: (data, id) => Object.assign({ _exp: id }, data),
      renderConsolidado: () => {},
      window: {},
      _db: {},
      _consBuscaTram: 't_pqrs',
      _fsCollection: () => 'col',
      _fsWhere: (campo, op, val) => { wheres.push([campo, op, val]); return { campo, op, val } },
      _fsQuery: (col, ...rest) => ({ col, rest }),
      _fsGetDocs: async () => ({
        forEach(fn) {
          fn({ id: 'PQ', data: () => ({ _fecha: '2026-02-10', _tramite: 't_pqrs', _es_pqrs: true }) })
          fn({ id: 'AG', data: () => ({ _fecha: '2026-02-11', _tramite: 'aguas' }) })
        }
      })
    })
    c.window = c
    runInContext(extraer(read('js/persistence.js'), [
      'consolidadoBuscaPorCorte', 'consTramiteBusqueda', 'consClaveBusqueda', 'consErrorEsIndice',
      'consExpCoincideTramite', 'buscarConsolidadoNca'
    ]), c)
    await c.buscarConsolidadoNca()
    expect(wheres.map(w => w[0])).toEqual(['_fecha', '_fecha'])
    expect(c._consNcaList.map(e => e._exp)).toEqual(['PQ', 'AG'])
    expect(c._consNcaRango).toBe('2026-01-01|2026-03-31|')
    expect(read('js/persistence.js')).not.toContain('Para leer solo ese tipo de trámite hay que activar el índice')
    expect(read('index.html')).toContain('id="cons-tram"')
  })
})

