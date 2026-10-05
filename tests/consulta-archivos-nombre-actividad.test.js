/**
 * consulta-archivos-nombre-actividad.test.js — Consulta → Archivos: los documentos de actividades
 * se titulan con el nombre de la actividad; el tipo de documento queda en la línea secundaria.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const con = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

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

describe('Consulta · Archivos: título = nombre de la actividad', () => {
  const c = createContext({})
  runInContext(extraer(con, ['archivoDocTipoCorto', 'archivoActividadTituloTipo']), c)

  it('usa la actividad como título y el documento como tipo', () => {
    expect(c.archivoActividadTituloTipo('Concepto seguimiento', 'Documento principal', false))
      .toEqual({ descDoc: 'Concepto seguimiento', docKind: 'Documento principal' })
    expect(c.archivoActividadTituloTipo('Comunicación Procuraduria', 'Soporte envío — Comunicación Procuraduria', false))
      .toEqual({ descDoc: 'Comunicación Procuraduria', docKind: 'Soporte envío' })
  })

  it('ciudadano o sin actividad: conserva la etiqueta del documento', () => {
    expect(c.archivoActividadTituloTipo('Auto inicio', 'Documento notificado', true))
      .toEqual({ descDoc: 'Documento notificado', docKind: '' })
    expect(c.archivoActividadTituloTipo('', 'Proyección de respuesta', false))
      .toEqual({ descDoc: 'Proyección de respuesta', docKind: '' })
  })

  it('la lista sigue ordenada de la más reciente a la más antigua', () => {
    expect(extraer(con, ['collectArchivosConsultaCompleto']))
      .toContain("String(b.fecha||'').localeCompare(String(a.fecha||''))")
  })
})
