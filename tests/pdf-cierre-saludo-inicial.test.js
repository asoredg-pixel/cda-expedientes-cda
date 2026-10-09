/**
 * pdf-cierre-saludo-inicial.test.js — Mensajes que empiezan con «Cordial saludo,» (plantillas PQRSD / actividades)
 * deben llevar el cierre amable en el soporte: el saludo inicial no cuenta como cierre.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

function tiene() {
  const c = createContext({})
  runInContext(extraer(core, ['pdfCuerpoTieneCierre']) + '\nthis._f=pdfCuerpoTieneCierre;', c)
  return c._f
}

describe('Cierre amable: «Cordial saludo,» inicial no es cierre', () => {
  it('mensaje PQRSD corto con saludo inicial → lleva cierre', () => {
    const f = tiene()
    expect(f('Cordial saludo,\n\nEn atención a su solicitud, le informamos que fue atendida.\n\nQuedamos atentos a cualquier inquietud adicional.')).toBe(false)
  })

  it('plantilla de actividad (2 líneas) → lleva cierre', () => {
    const f = tiene()
    expect(f('Cordial saludo,\n\nPor medio de la presente, se remite el oficio No. 123 para su conocimiento y fines pertinentes.')).toBe(false)
  })

  it('si además termina con Atentamente → no se duplica', () => {
    const f = tiene()
    expect(f('Cordial saludo,\n\nLe informamos…\n\nAtentamente,\nNCA DEGUV')).toBe(true)
  })

  it('«Cordial saludo» al final sí cuenta como cierre', () => {
    const f = tiene()
    expect(f('Buen día,\nLe informamos…\nCordial saludo.')).toBe(true)
  })
})
