/**
 * login-acceso-denegado.test.js — Mensajes al iniciar sesión con Gmail:
 * desactivado (usuario/responsable/oficina) vs correo inexistente en BD.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ingreso = readFileSync(resolve(root, 'js/ingreso.js'), 'utf8')

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

function ctxLogin() {
  const calls = []
  const c = createContext({
    console,
    document: { getElementById: () => null },
    confirmPrecaucion(opts, onOk) {
      calls.push(opts)
      if (typeof onOk === 'function') onOk()
    },
    findInstructorByEmail: null,
    window: {}
  })
  c.window = c
  runInContext(extraer(ingreso, [
    'alertAccesoLoginModal',
    'alertUsuarioDesactivado',
    'alertCorreoNoAutorizado',
    'instructorAsociadoDesactivado'
  ]), c)
  return { c, calls }
}

describe('login acceso denegado', () => {
  it('desactivado: mensaje temporal y dirección seccional', () => {
    const { c, calls } = ctxLogin()
    c.alertUsuarioDesactivado({ email: 'resp@cda.gov.co' })
    expect(calls).toHaveLength(1)
    expect(calls[0].hideCancel).toBe(true)
    expect(calls[0].tone).toBe('warn')
    expect(calls[0].message).toBe(
      'Su acceso temporalmente ha sido denegado. Contacte con la dirección seccional para más información.'
    )
    expect(calls[0].detail).toContain('resp@cda.gov.co')
  })

  it('correo no autorizado: mensaje de funcionario', () => {
    const { c, calls } = ctxLogin()
    c.alertCorreoNoAutorizado({ email: 'externo@gmail.com' })
    expect(calls).toHaveLength(1)
    expect(calls[0].message).toBe(
      'Su correo no cuenta con acceso al sistema como funcionario.'
    )
  })

  it('instructor asociado inactivo se detecta', () => {
    const { c } = ctxLogin()
    c.findInstructorByEmail = (email) =>
      email === 'ofi@cda.gov.co' ? { email, activo: false, rol: 'encargado_oficina' } : null
    expect(c.instructorAsociadoDesactivado('ofi@cda.gov.co')).toBe(true)
    expect(c.instructorAsociadoDesactivado('ok@cda.gov.co')).toBe(false)
  })

  it('verificarUsuarioFirestore: sin doc → no autorizado; activo false → denegado', async () => {
    const { c, calls } = ctxLogin()
    const msgs = []
    c.setLoginStatus = () => {}
    c.setLoginAuthMsg = (m) => { msgs.push(m) }
    c.normalizarRolLoginFirestore = (r) => r
    c.resolverAccesoLoginUsuario = () => ({ ok: true, rol: 'admin', respNom: '' })
    c.claimActiveSession = async () => 'RULES'
    c.ingresarComoRol = vi.fn()
    c.mergeUsuarioEnCache = () => {}
    let authOut = 0
    c.window._authSignOut = async () => { authOut++ }
    c.window._db = {}
    c.window._fsDoc = (_db, col, id) => ({ col, id })
    let exists = false
    let data = {}
    c.window._fsGetDoc = async () => ({
      exists: () => exists,
      data: () => data
    })
    runInContext(extraer(ingreso, ['verificarUsuarioFirestore']), c)

    await c.verificarUsuarioFirestore({ email: 'nadie@gmail.com', uid: 'u1' })
    expect(calls.at(-1).message).toContain('no cuenta con acceso')
    expect(authOut).toBe(1)

    exists = true
    data = { activo: false, rol: 'responsables', nombre: 'X' }
    await c.verificarUsuarioFirestore({ email: 'x@cda.gov.co', uid: 'u2' })
    expect(calls.at(-1).message).toContain('temporalmente ha sido denegado')
    expect(authOut).toBe(2)
  })
})
