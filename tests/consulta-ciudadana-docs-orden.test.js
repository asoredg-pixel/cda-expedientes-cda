/**
 * Consulta ciudadana: documentos con lo más reciente primero.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')

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

describe('Consulta ciudadana — orden de documentos', () => {
  it('pone la gestión más reciente primero y la solicitud al final', () => {
    const c = createContext({})
    runInContext(extraer(pqrs, ['ciudadanoDocsOrdenReciente']), c)
    const docs = [
      { label: 'Soporte de radicación', fecha: '2026-01-10' },
      { label: 'Oficio de respuesta', fecha: '2026-03-02' },
      { label: 'Anexo de respuesta', fecha: '2026-03-02' },
      { label: 'Sin fecha', fecha: '' }
    ]
    c.ciudadanoDocsOrdenReciente(docs)
    expect(docs.map(d => d.label)).toEqual([
      'Anexo de respuesta',
      'Oficio de respuesta',
      'Soporte de radicación',
      'Sin fecha'
    ])
  })

  it('la vista ciudadana ordena antes de pintar', () => {
    expect(extraer(pqrs, ['buscarExpCiudadano'])).toContain('ciudadanoDocsOrdenReciente')
  })
})
