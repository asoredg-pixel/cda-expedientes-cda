/**
 * Asociar: lo escrito (número completo o nombre) queda de primero.
 * Los que solo comparten el número, o lo mencionan en el cuerpo, van después.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')
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

function ctx() {
  const lista = [
    { _exp: 'LAM-00002-26', _nom: 'SERVITRANSPORTES RIVERA S.A.S', _detalle_general: 'menciona consorcio internado en el correo' },
    { _exp: 'PAF-00002-26', _nom: 'CONSORCIO EJE VIAL GANADERA' },
    { _exp: 'RLO-00002-26', _nom: 'BRAYAN FERNANDO ACOSTA CASTRO', _detalle_general: 'cita VDA-00002-26 en el cuerpo' },
    { _exp: 'VDA-00002-26', _nom: 'CONSORCIO INTERNADO 2025' }
  ]
  const c = createContext({
    exps: lista,
    expsAmbito: () => lista,
    actividadesLibres: [],
    getNom: e => (e && e._nom) || '',
    getTram: () => null,
    expAsocMatchNum: (a, b) => String(a) === String(b),
    expEstaEnPapelera: () => false,
    matchActLibre: () => false
  })
  runInContext(extraer(core, ['busquedaIdRank']) + '\n' + extraer(consulta, [
    'matchS', 'reviewAsocRank', 'collectReviewAsocCandidatos'
  ]), c)
  return c
}

describe('Asociar pone primero lo que coincide con lo escrito', () => {
  it('el número completo queda antes que los que solo comparten 00002-26', () => {
    const ids = ctx().collectReviewAsocCandidatos('VDA-00002-26', { mode: 'pqrs-pick', allowTramite: true })
      .map(it => it.id)
    expect(ids[0]).toBe('VDA-00002-26')
    expect(ids.indexOf('LAM-00002-26')).toBeGreaterThan(0)
  })

  it('el nombre del interesado queda antes que una mención en el contenido', () => {
    const ids = ctx().collectReviewAsocCandidatos('consorcio internado', { mode: 'exp-asoc' })
      .map(it => it.id)
    expect(ids[0]).toBe('VDA-00002-26')
    expect(ids).toContain('LAM-00002-26')
    expect(ids.indexOf('LAM-00002-26')).toBeGreaterThan(0)
  })
})
