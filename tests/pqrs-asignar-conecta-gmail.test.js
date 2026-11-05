/**
 * pqrs-asignar-conecta-gmail.test.js — Al asignar/trasladar PQRSD de correo sin Gmail:
 * no solo avisar: abrir ventana de cuenta y, si conecta, seguir.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

describe('Asignar PQRSD: conectar Gmail en el momento', () => {
  it('submitAsignarPqrsOficina pide Gmail y no se queda solo en el aviso', () => {
    const fn = extraer(pqrs, ['submitAsignarPqrsOficina'])
    expect(fn).toContain('_pqrsAsegurarCorreoParaAsignarOTraslado')
    expect(fn).not.toMatch(/notif\('Conecte el correo para reenviar al responsable los anexos de la PQRSD/)
  })

  it('_pqrsAsegurarCorreoParaAsignarOTraslado abre sstSolicitarGmailParaAdjuntar', async () => {
    let called = null
    const c = createContext({
      _pqrsNecesitaCorreoParaAsignar: () => true,
      _pqrsTokOk: () => false,
      sstSolicitarGmailParaAdjuntar: async (opts) => { called = opts; return true },
      window: {}
    })
    // Redefinir _pqrsTokOk tras "conectar"
    let tok = false
    c._pqrsTokOk = () => tok
    c.sstSolicitarGmailParaAdjuntar = async (opts) => { called = opts; tok = true; return true }
    runInContext(extraer(pqrs, ['_pqrsAsegurarCorreoParaAsignarOTraslado']), c)
    const ok = await c._pqrsAsegurarCorreoParaAsignarOTraslado({})
    expect(ok).toBe(true)
    expect(called && called.force).toBe(true)
    expect(String(called.message || '')).toMatch(/reenviar/i)
  })

  it('traslado también intenta conectar antes de reenviar', () => {
    expect(extraer(pqrs, ['_pqrsEjecutarTrasladoOficina'])).toContain('_pqrsAsegurarCorreoParaAsignarOTraslado')
  })

  it('sstSolicitarGmailParaAdjuntar pasa title/message al modal', () => {
    expect(extraer(gmail, ['sstSolicitarGmailParaAdjuntar'])).toContain('opts.message')
    expect(extraer(gmail, ['sstAbrirGmailDriveModal'])).toContain('opts.message')
  })
})
