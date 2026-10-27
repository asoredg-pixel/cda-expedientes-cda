/**
 * Actividad anulada (papelera) sale de Por firmar y no debe seguir
 * en Consulta del expediente como «Revisada · X Firmar».
 * El rastro «Trasladada» de una PQRSD sí se conserva.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
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

describe('Consulta no muestra la actividad anulada', () => {
  it('oculta la de papelera y deja la que sigue vigente y la trasladada', () => {
    const c = createContext({
      taskTrasladoPqrsInfo: (e, t) => (t && t._traslado ? { de: 'a', a: 'b' } : null)
    })
    runInContext(extraer(consulta, ['taskVisibleEnConsulta']), c)
    const viva = { id: 'ok', actividad: 'Auto de inicio', eliminada: false }
    const anulada = { id: 'dup', actividad: 'Auto de inicio', eliminada: true, firmaWf: { fase: 'por_firmar' } }
    const traslado = { id: 'tr', eliminada: true, _traslado: true }
    expect(c.taskVisibleEnConsulta({ _exp: 'PAF-00085-26' }, viva)).toBe(true)
    expect(c.taskVisibleEnConsulta({ _exp: 'PAF-00085-26' }, anulada)).toBe(false)
    expect(c.taskVisibleEnConsulta({ _exp: 'PAF-00085-26' }, traslado)).toBe(true)
    expect(c.taskVisibleEnConsulta({ _exp: 'PAF-00085-26' }, null)).toBe(false)
  })

  it('la ficha de Consulta usa ese filtro', () => {
    const fn = extraer(consulta, ['conConsultaOneCard'])
    expect(fn).toContain('taskVisibleEnConsulta(e,t)')
  })

  it('una anulada en por firmar no conserva el aviso «X Firmar»', () => {
    const c = createContext({})
    runInContext(extraer(firma, ['taskFirmaEstadoUi']), c)
    expect(c.taskFirmaEstadoUi({
      eliminada: true,
      firmaWf: { fase: 'por_firmar', impreso: { en: '2026-10-22' } }
    })).toBe(null)
  })

  it('la etiqueta de una anulada es Eliminada', () => {
    const c = createContext({})
    runInContext(extraer(core, ['estadoTaskLabel']), c)
    expect(c.estadoTaskLabel({
      eliminada: true,
      firmaWf: { fase: 'por_firmar', impreso: { en: '2026-10-22' } }
    })).toBe('Eliminada')
  })
})
