/**
 * aprobar-actividad-libre-sin-aviso-expediente.test.js — Al aprobar una actividad sin expediente
 * (ACT-…, informes de contrato) no debe salir «Expediente no encontrado»: no hay alta que cerrar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')

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

function ctx(exps) {
  const avisos = []
  const marcados = []
  const c = createContext({
    getExpById: id => exps[id] || null,
    notif: (m, t) => avisos.push(m),
    marcarAltaExpedienteRevisada: (id, o) => { marcados.push(id); return true }
  })
  runInContext(extraer(er, ['clearAltaResponsableAlAprobarDocumento']), c)
  return { c, avisos, marcados }
}

describe('Aprobar actividad sin expediente', () => {
  it('ACT-… sin expediente: no avisa ni intenta cerrar alta', () => {
    const { c, avisos, marcados } = ctx({})
    expect(c.clearAltaResponsableAlAprobarDocumento('ACT-GV-0024', { force: true })).toBe(false)
    expect(avisos).toEqual([])
    expect(marcados).toEqual([])
  })

  it('con expediente: sigue cerrando la alta como antes', () => {
    const { c, marcados } = ctx({ 'PAF-00046-26': { _exp: 'PAF-00046-26' } })
    expect(c.clearAltaResponsableAlAprobarDocumento('PAF-00046-26', { force: true })).toBe(true)
    expect(marcados).toEqual(['PAF-00046-26'])
  })
})
