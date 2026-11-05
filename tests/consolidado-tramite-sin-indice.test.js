/**
 * consolidado-tramite-sin-indice.test.js —
 * Filtro por tipo de trámite (p. ej. PQRSD) en Consolidado: no usa igualdad+_fecha
 * en Firestore (evita el aviso de índice); filtra en memoria al pintar.
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

describe('Consolidado: filtro trámite sin índice Firestore', () => {
  it('consExpCoincideTramite reconoce PQRSD y otros trámites', () => {
    const c = createContext({
      window: {},
      esTramitePqrs: id => id === 't_pqrs',
      esPqrsSecretaria: e => !!(e && (e._tramite === 't_pqrs' || e._es_pqrs || e._radicado_secretaria))
    })
    runInContext(extraer(read('js/persistence.js'), ['consExpCoincideTramite']), c)
    expect(c.consExpCoincideTramite({ _tramite: 't_pqrs' }, 't_pqrs')).toBe(true)
    expect(c.consExpCoincideTramite({ _es_pqrs: true, _tramite: '' }, 't_pqrs')).toBe(true)
    expect(c.consExpCoincideTramite({ _tramite: 'aguas' }, 't_pqrs')).toBe(false)
    expect(c.consExpCoincideTramite({ _tramite: 'aguas' }, 'aguas')).toBe(true)
    expect(c.consExpCoincideTramite({ _tramite: 'aguas' }, '')).toBe(true)
  })

  it('al pintar, el trámite seleccionado filtra la lista ya buscada', () => {
    const cons = read('js/consolidado.js')
    expect(cons).toContain('consExpCoincideTramite')
    expect(extraer(cons, ['consolidadoNcaEspera'])).toContain("rango.desde||'')+'|'+(rango.hasta||'')+'|'")
    expect(extraer(cons, ['consolidadoNcaEspera'])).not.toContain('consClaveBusqueda')
  })

  it('Buscar no vuelve a fallar pidiendo activar el índice', () => {
    const src = extraer(read('js/persistence.js'), ['buscarConsolidadoNca'])
    expect(src).not.toMatch(/_fsWhere\('_tramite'/)
    expect(src).toContain("window._fsWhere('_fecha','>=',rango.desde)")
    expect(src).not.toContain('activar el índice')
  })
})

