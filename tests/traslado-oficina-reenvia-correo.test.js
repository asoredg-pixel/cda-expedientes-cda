/**
 * traslado-oficina-reenvia-correo.test.js —
 * Al cambiar oficina (modal o corrección Secretaría) debe reenviarse el correo
 * de radicación a la oficina destino cuando la PQRSD vino por correo.
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
      try { new Script(code); return code } catch (e) { /* aún incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

describe('Traslado entre oficinas: reenvío de correo', () => {
  it('corrección Secretaría (submitEdit) llama al reenvío al cambiar oficina', () => {
    const fn = extraer(pqrs, ['submitEditPqrsSecretaria'])
    expect(fn).toContain('_pqrsTrasladoOficinaReenviarCorreo')
    expect(fn).toContain('ofiCambio')
    expect(fn).toContain('Corrección de oficina destino por Secretaría')
  })

  it('modal de traslado (_pqrsEjecutarTrasladoOficina) reenvía vía el helper', () => {
    const fn = extraer(pqrs, ['_pqrsEjecutarTrasladoOficina'])
    expect(fn).toContain('_pqrsTrasladoOficinaReenviarCorreo')
    expect(fn).toContain('_pqrsAsegurarCorreoParaAsignarOTraslado')
  })

  it('submitTrasladoPqrsInterOficina y Inicial usan _pqrsEjecutarTrasladoOficina', () => {
    expect(extraer(pqrs, ['submitTrasladoPqrsInterOficina'])).toContain('_pqrsEjecutarTrasladoOficina')
    expect(extraer(pqrs, ['submitTrasladoPqrsInicial'])).toContain('_pqrsEjecutarTrasladoOficina')
  })

  it('_pqrsTrasladoOficinaReenviarCorreo reenvía cuando hay correo y token', async () => {
    const llamadas = []
    const c = createContext({
      window: {},
      notif: () => {},
      _pqrsNecesitaCorreoParaTraslado: () => true,
      _pqrsTokOk: () => true,
      _pqrsAsegurarCorreoParaAsignarOTraslado: async () => true,
      reenviarCorreoRadicacionPqrsAOficina: async (e, ofi, id) => {
        llamadas.push({ e, ofi, id })
        return true
      }
    })
    runInContext(extraer(pqrs, ['_pqrsTrasladoOficinaReenviarCorreo']), c)
    const r = await c._pqrsTrasladoOficinaReenviarCorreo(
      { _exp: 'PQRSD-1', _gmail_message_id: 'm1', f_f2: 'Correo' },
      'guaviare',
      'PQRSD-1'
    )
    expect(r).toEqual({ necesita: true, envio: true, ok: true })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].ofi).toBe('guaviare')
  })

  it('no reenvía si no necesita correo (ventanilla / sin gmail id)', async () => {
    let reenvios = 0
    const c = createContext({
      window: {},
      notif: () => {},
      _pqrsNecesitaCorreoParaTraslado: () => false,
      _pqrsTokOk: () => true,
      _pqrsAsegurarCorreoParaAsignarOTraslado: async () => true,
      reenviarCorreoRadicacionPqrsAOficina: async () => { reenvios++; return true }
    })
    runInContext(extraer(pqrs, ['_pqrsTrasladoOficinaReenviarCorreo']), c)
    const r = await c._pqrsTrasladoOficinaReenviarCorreo({ _exp: 'X' }, 'ds_deguv', 'X')
    expect(r).toEqual({ necesita: false, envio: false, ok: true })
    expect(reenvios).toBe(0)
  })

  it('no reenvía si destino es secretaria', async () => {
    let reenvios = 0
    const c = createContext({
      window: {},
      notif: () => {},
      _pqrsNecesitaCorreoParaTraslado: () => true,
      _pqrsTokOk: () => true,
      _pqrsAsegurarCorreoParaAsignarOTraslado: async () => true,
      reenviarCorreoRadicacionPqrsAOficina: async () => { reenvios++; return true }
    })
    runInContext(extraer(pqrs, ['_pqrsTrasladoOficinaReenviarCorreo']), c)
    const r = await c._pqrsTrasladoOficinaReenviarCorreo({ _exp: 'X' }, 'secretaria', 'X')
    expect(r.necesita).toBe(false)
    expect(reenvios).toBe(0)
  })

  it('sin token: intenta conectar y no marca envio si falla', async () => {
    let asegurar = 0
    let reenvios = 0
    const avisos = []
    const c = createContext({
      window: {},
      notif: (m, t) => avisos.push({ m, t }),
      _pqrsNecesitaCorreoParaTraslado: () => true,
      _pqrsTokOk: () => false,
      _pqrsAsegurarCorreoParaAsignarOTraslado: async () => { asegurar++; return false },
      reenviarCorreoRadicacionPqrsAOficina: async () => { reenvios++; return true }
    })
    runInContext(extraer(pqrs, ['_pqrsTrasladoOficinaReenviarCorreo']), c)
    const r = await c._pqrsTrasladoOficinaReenviarCorreo({ _exp: 'X' }, 'nca_deguv', 'X', {})
    expect(asegurar).toBe(1)
    expect(reenvios).toBe(0)
    expect(r).toEqual({ necesita: true, envio: false, ok: false })
    expect(avisos.some(a => /Gmail/i.test(a.m))).toBe(true)
  })
})
