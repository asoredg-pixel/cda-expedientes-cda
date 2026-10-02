/**
 * atajo-firmado-por-revisar.test.js — 📤 Cargar documento firmado desde «Por revisar» (encargado NCA):
 * opciones visibles sin esperar el archivo, cualquier formato y subida con el tipo real del archivo.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
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

describe('Atajo «Cargar documento firmado» en Por revisar', () => {
  function ctxPorRevisar(pqrsEnRev, porRevisar) {
    const c = createContext({
      window: {},
      esPqrsSecretaria: e => !!e._pqrs,
      pqrsEnRevisionNca: () => pqrsEnRev,
      actividadCuentaComoPorRevisar: () => porRevisar
    })
    runInContext(extraer(tf, ['atajoFirmadoEnPorRevisar']) + '\nthis._f=atajoFirmadoEnPorRevisar;', c)
    return c._f
  }

  it('detecta PQRSD en revisión NCA y actividades «Por verificar»', () => {
    expect(ctxPorRevisar(true, false)({ id: 't' }, { _pqrs: true }, 'P1')).toBe(true)
    expect(ctxPorRevisar(false, true)({ id: 't' }, { _exp: 'E1' }, 'E1')).toBe(true)
    expect(ctxPorRevisar(false, false)({ id: 't' }, { _exp: 'E1' }, 'E1')).toBe(false)
  })

  it('Por revisar: cualquier formato y las 4 opciones visibles desde el inicio', () => {
    const r = extraer(tf, ['renderTaskReviewAtajoFirmadoHtml'])
    expect(r).toContain("accept:enPorRevisar?'':'application/pdf,.pdf'")
    expect(r).toContain('data-siempre="1"')
    expect(r).toContain("accHtml(2,'Asignar quién notificará'")
    expect(r).toContain("accHtml(4,'Cargar y dar por atendida (sin notificar)'")
    expect(extraer(tf, ['initTaskReviewAtajoFirmadoSide'])).toContain("post.getAttribute('data-siempre')==='1'")
  })

  it('la subida usa el tipo real del archivo (no fija PDF)', () => {
    const up = extraer(tf, ['tramiteUploadPdfFirmado'])
    expect(up).toContain("const mime=file.type||'application/octet-stream'")
    expect(up).not.toContain("'application/pdf'")
    expect(extraer(core, ['pqrsDirectorConfirmarFirmado'])).toContain("file.type||'application/pdf'")
  })
})
