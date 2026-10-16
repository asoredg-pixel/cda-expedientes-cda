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

function ctxLogin(opts) {
  opts = opts || {}
  const calls = []
  const c = createContext({
    console,
    document: { getElementById: () => null },
    confirmPrecaucion(opts2, onOk) {
      calls.push(opts2)
      // No auto-cerrar: el aviso debe esperar «Entendido»
      if (opts.autoAck && typeof onOk === 'function') onOk()
    },
    findInstructorByEmail: null,
    requestAnimationFrame(fn) { fn(); return 0 },
    setTimeout(fn) { fn(); return 0 },
    window: {}
  })
  c.window = c
  runInContext(extraer(ingreso, [
    'alertAccesoLoginModal',
    'alertUsuarioDesactivado',
    'alertCorreoNoAutorizado',
    'instructorAsociadoDesactivado',
    'denegarAccesoLoginYAvisar'
  ]), c)
  return { c, calls }
}

describe('login acceso denegado', () => {
  it('desactivado: mensaje con Entendido y requireAck', () => {
    const { c, calls } = ctxLogin()
    c.alertUsuarioDesactivado({ email: 'resp@cda.gov.co' })
    expect(calls).toHaveLength(1)
    expect(calls[0].hideCancel).toBe(true)
    expect(calls[0].requireAck).toBe(true)
    expect(calls[0].confirmLabel).toBe('Entendido')
    expect(calls[0].tone).toBe('warn')
    expect(calls[0].message).toBe(
      'Su acceso temporalmente ha sido denegado. Contacte con la dirección seccional para más información.'
    )
    expect(c.window._sstLoginAccesoModal).toBe(true)
    expect(calls[0].detail).toContain('resp@cda.gov.co')
  })

  it('correo no autorizado: mensaje de funcionario', () => {
    const { c, calls } = ctxLogin()
    c.alertCorreoNoAutorizado({ email: 'externo@gmail.com' })
    expect(calls).toHaveLength(1)
    expect(calls[0].requireAck).toBe(true)
    expect(calls[0].message).toBe(
      'Su correo no cuenta con acceso al sistema como funcionario.'
    )
    expect(c.window._sstLoginAccesoModal).toBe(true)
  })

  it('instructor asociado inactivo se detecta', () => {
    const { c } = ctxLogin()
    c.findInstructorByEmail = (email) =>
      email === 'ofi@cda.gov.co' ? { email, activo: false, rol: 'encargado_oficina' } : null
    expect(c.instructorAsociadoDesactivado('ofi@cda.gov.co')).toBe(true)
    expect(c.instructorAsociadoDesactivado('ok@cda.gov.co')).toBe(false)
  })

  it('ensureOverlaysClosed no cierra el aviso de acceso sticky', () => {
    const ov = { classList: { remove: vi.fn() }, getAttribute: () => null }
    const c = createContext({
      console,
      document: {
        getElementById(id) { return id === 'confirm-prec-overlay' ? ov : null }
      },
      window: {}
    })
    c.window = c
    c._sstLoginAccesoModal = true
    runInContext(extraer(core, ['ensureOverlaysClosed']), c)
    c.ensureOverlaysClosed()
    expect(ov.classList.remove).not.toHaveBeenCalled()
  })

  it('verificarUsuarioFirestore: signOut antes del modal; sin doc / desactivado', async () => {
    const { c, calls } = ctxLogin()
    c.setLoginStatus = () => {}
    c.setLoginAuthMsg = () => {}
    let authOut = 0
    const order = []
    c.window._authSignOut = async () => { authOut++; order.push('signOut') }
    c.window._db = {}
    c.window._fsDoc = (_db, col, id) => ({ col, id })
    let exists = false
    let data = {}
    c.window._fsGetDoc = async () => ({
      exists: () => exists,
      data: () => data
    })
    const origConfirm = c.confirmPrecaucion
    c.confirmPrecaucion = function (opts, onOk) {
      order.push('modal')
      return origConfirm(opts, onOk)
    }
    runInContext(extraer(ingreso, ['verificarUsuarioFirestore']), c)

    await c.verificarUsuarioFirestore({ email: 'nadie@gmail.com', uid: 'u1' })
    expect(calls.at(-1).message).toContain('no cuenta con acceso')
    expect(authOut).toBe(1)
    expect(order.indexOf('signOut')).toBeLessThan(order.indexOf('modal'))

    exists = true
    data = { activo: false, rol: 'responsables', nombre: 'X' }
    order.length = 0
    await c.verificarUsuarioFirestore({ email: 'x@cda.gov.co', uid: 'u2' })
    expect(calls.at(-1).message).toContain('temporalmente ha sido denegado')
    expect(authOut).toBe(2)
    expect(order.indexOf('signOut')).toBeLessThan(order.indexOf('modal'))
  })
})
