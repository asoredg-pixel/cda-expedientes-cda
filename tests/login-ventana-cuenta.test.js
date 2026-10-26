/**
 * El clic de Ingresar debe abrir la ventanita de cuentas de Google.
 * Mandar la página completa a Google (signInWithRedirect) no devuelve la sesión:
 * el sitio está en GitHub Pages y el dominio de Firebase Auth es otro.
 */
import { describe, it, expect } from 'vitest'
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
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctxLogin() {
  const store = {}
  const c = createContext({
    window: {},
    document: { getElementById: () => ({ disabled: false }) },
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] }
    },
    setLoginAuthMsg(msg) { c._msg = msg },
    setLoginStatus() {},
    initLoginScreen() {},
    alertAccesoLoginModal() { c._modal = true },
    verificarUsuarioFirestore(user) { c._user = user; return Promise.resolve() },
    console: { error() {}, warn() {} },
    setTimeout: (fn) => { fn(); return 1 },
    clearTimeout() {}
  })
  c.window = c
  c._store = store
  return c
}

describe('Ingreso con ventanita de cuenta Google', () => {
  it('al pulsar Ingresar abre la ventanita y entra con esa cuenta', async () => {
    const user = { email: 'func@cda.gov.co' }
    const c = ctxLogin()
    let popup = 0
    let redirect = 0
    c._authSignInGoogle = () => { popup++; return Promise.resolve({ user }) }
    c._authSignInGoogleRedirect = () => { redirect++; return Promise.resolve() }
    runInContext(extraer(ingreso, ['iniciarLoginGoogle']), c)
    c.iniciarLoginGoogle()
    await new Promise(r => setTimeout(r, 0))
    expect(popup).toBe(1)
    expect(redirect).toBe(0)
    expect(c._user).toBe(user)
    expect(c._store.sst_login_redirect_once).toBeUndefined()
  })

  it('un segundo clic mientras la ventanita está abierta no abre otra', () => {
    const c = ctxLogin()
    let popup = 0
    c._authSignInGoogle = () => { popup++; return new Promise(() => {}) }
    c._authSignInGoogleRedirect = () => { throw new Error('no redirigir') }
    runInContext(extraer(ingreso, ['iniciarLoginGoogle']), c)
    c.iniciarLoginGoogle()
    c.iniciarLoginGoogle()
    expect(popup).toBe(1)
  })

  it('si el navegador bloquea la ventanita, avisa y no manda la página a Google', async () => {
    const c = ctxLogin()
    let redirect = 0
    c._authSignInGoogle = () => Promise.reject({ code: 'auth/popup-blocked' })
    c._authSignInGoogleRedirect = () => { redirect++ }
    c._firebaseAuth = { currentUser: null }
    runInContext(extraer(ingreso, ['avisarFalloLogin', 'iniciarLoginGoogle']), c)
    c.iniciarLoginGoogle()
    await new Promise(r => setTimeout(r, 0))
    expect(redirect).toBe(0)
    expect(c._modal).toBe(true)
    expect(String(c._msg)).toContain('bloqueó la ventana')
    expect(c._user).toBeUndefined()
  })

  it('si la ventanita se cierra pero la cuenta ya quedó, entra igual', async () => {
    const user = { email: 'func@cda.gov.co' }
    const c = ctxLogin()
    c._authSignInGoogle = () => Promise.reject({ code: 'auth/popup-closed-by-user' })
    c._authSignInGoogleRedirect = () => { throw new Error('no redirigir') }
    c._firebaseAuth = { currentUser: user }
    runInContext(extraer(ingreso, ['avisarFalloLogin', 'esperarUsuarioGoogleTrasCierre', 'iniciarLoginGoogle']), c)
    c.iniciarLoginGoogle()
    await new Promise(r => setTimeout(r, 0))
    expect(c._user).toBe(user)
    expect(c._modal).toBeUndefined()
  })
})
