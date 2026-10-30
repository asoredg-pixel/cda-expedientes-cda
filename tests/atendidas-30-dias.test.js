/**
 * Atendidas del responsable: 30 días calendario (el 31 de octubre, desde el 1).
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

describe('Atendidas del responsable a 30 días calendario', () => {
  it('el 31 de octubre incluye desde el 1 y deja fuera el 30 de septiembre', () => {
    const Real = Date
    class Fija extends Real {
      constructor(...args) {
        if (args.length) super(...args)
        else super(2026, 9, 31, 15, 0, 0)
      }
    }
    const c = createContext({ Date: Fija, getExpById: () => null })
    runInContext(extraer(read('js/core.js'), ['corteCalendarioLocal', 'actividadEsDeUltimosDias']), c)
    expect(c.corteCalendarioLocal(30)).toBe('2026-10-01')
    expect(c.actividadEsDeUltimosDias({ fechaAtendida: '2026-10-01' }, 30)).toBe(true)
    expect(c.actividadEsDeUltimosDias({ fechaAtendida: '2026-10-31' }, 30)).toBe(true)
    expect(c.actividadEsDeUltimosDias({ fechaAtendida: '2026-09-30' }, 30)).toBe(false)
  })

  it('la paleta del responsable usa 30 y su escucha baja ese corte', () => {
    const core = read('js/core.js')
    const done = extraer(core, ['filtrarActividadesPorEstado'])
    expect(done).toContain('esModoResponsable()?30:10')
    const pers = read('js/persistence.js')
    expect(pers).toContain('esResp?corteCalendarioIso(30):corteBandejaIso()')
    const c = createContext({ Date })
    runInContext(extraer(pers, ['corteCalendarioIso']), c)
    const iso = c.corteCalendarioIso(30)
    const local = new Date()
    local.setHours(0, 0, 0, 0)
    local.setDate(local.getDate() - 30)
    expect(iso).toBe(local.toISOString())
  })
})
