/**
 * soporte-respuesta-pqrs-cuerpo-enviado.test.js — El PDF «Soporte de respuesta — PQRSD» debe imprimir
 * el cuerpo realmente enviado (opts.cuerpo), no el borrador guardado en el workflow con la plantilla.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function lineaCuerpo() {
  const ini = core.indexOf('async function generarPdfRespuestaPqrs(')
  if (ini < 0) throw new Error('No se encontró generarPdfRespuestaPqrs')
  const m = core.slice(ini).match(/const cuerpoText=[^\n]+/)
  if (!m) throw new Error('No se encontró cuerpoText')
  return m[0]
}

function cuerpoSoporte(opts, wf, e) {
  return new Function('opts', 'wf', 'e', lineaCuerpo() + '\nreturn cuerpoText;')(opts, wf, e)
}

describe('Soporte de respuesta PQRSD: cuerpo enviado', () => {
  const plantilla = 'Cordial saludo,\n\nTexto.\n\nQuedamos atentos a cualquier inquietud adicional.'
  const enviado = 'Cordial saludo,\n\nTexto.'

  it('usa el cuerpo enviado aunque el workflow conserve la plantilla', () => {
    const r = cuerpoSoporte({ cuerpo: enviado }, { cuerpo: plantilla }, { _pqrs_respuesta_nota: plantilla })
    expect(r).toBe(enviado)
    expect(r).not.toMatch(/Quedamos atentos/)
  })

  it('sin cuerpo en opts cae al workflow y luego a la nota de respuesta', () => {
    expect(cuerpoSoporte({}, { cuerpo: 'wf' }, { _pqrs_respuesta_nota: 'nota' })).toBe('wf')
    expect(cuerpoSoporte({}, {}, { _pqrs_respuesta_nota: 'nota' })).toBe('nota')
  })
})
