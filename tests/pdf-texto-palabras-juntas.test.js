/**
 * pdf-texto-palabras-juntas.test.js — El texto del soporte PDF no debe pegar palabras
 * («conocimiento y fines» → «conocimientoyfines»); solo se juntan letras sueltas espaciadas.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

const ctx = createContext({})
runInContext(extraerFunciones(read('js/utils.js'), [
  'sstPdfSafeWinAnsi', 'sstPdfStripEmphasis', 'sstPdfCollapseSpacedLetters', 'sstPdfUnwrapLines', 'sstPdfPlainForPrint'
]) + '\nthis._plain=sstPdfPlainForPrint;this._collapse=sstPdfCollapseSpacedLetters;', ctx)

describe('Soporte PDF: no pegar palabras', () => {
  it('conserva los espacios entre palabras con «y», «a», «o», «e»', () => {
    const txt = 'Por medio de la presente, se remite el oficio No. DSGVA26170 para su conocimiento y fines pertinentes.'
    expect(ctx._plain(txt)).toBe(txt)
    expect(ctx._collapse('Se remite a usted y a la oficina o al grupo')).toBe('Se remite a usted y a la oficina o al grupo')
    expect(ctx._collapse('Cordial saludo, va a y viene')).toBe('Cordial saludo, va a y viene')
  })

  it('sigue juntando letras espaciadas de correos mal copiados', () => {
    expect(ctx._collapse('C O R P O R A C I O N')).toBe('CORPORACION')
    expect(ctx._collapse('Ref. respuesta del grupo T E C N I C O de la seccional Guaviare')).toBe('Ref. respuesta del grupo TECNICO de la seccional Guaviare')
  })
})
