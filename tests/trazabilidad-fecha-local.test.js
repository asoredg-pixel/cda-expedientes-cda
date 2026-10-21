/**
 * La entrega de las 7 p. m. no debe pasar al día siguiente en Consulta.
 * hoy() en UTC guardaba el 20; el registro mostraba el 19.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const utils = readFileSync(resolve(root, 'js/utils.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^function ' + n + '\\(', 'm'))
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

describe('Trazabilidad de la entrega', () => {
  it('muestra el día local del instante, no el día UTC guardado en fecha', () => {
    const c = createContext({ Date, Number, isFinite, String })
    runInContext(extraer(utils, ['fmtF']) + '\n' + extraer(core, ['pqrsHistTsNum', 'taskHistCuandoTxt']), c)
    const ts = Date.parse('2026-10-20T00:01:00.000Z')
    const d = new Date(ts)
    const local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const out = c.taskHistCuandoTxt({ tipo: 'reenvio_verificacion', fecha: '2026-10-20', ts })
    expect(out.startsWith(c.fmtF(local))).toBe(true)
    expect(out).toMatch(/p\.\s*m\.|a\.\s*m\.|\d{1,2}:\d{2}/)
  })

  it('respeta una fecha de negocio distinta del instante', () => {
    const c = createContext({ Date, Number, isFinite, String })
    runInContext(extraer(utils, ['fmtF']) + '\n' + extraer(core, ['pqrsHistTsNum', 'taskHistCuandoTxt']), c)
    const ts = Date.parse('2026-10-20T00:01:00.000Z')
    expect(c.taskHistCuandoTxt({ fecha: '2026-10-17', ts })).toBe('17/10/2026')
  })
})
