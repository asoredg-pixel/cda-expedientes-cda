/**
 * La ventanita de Firebase se cierra al elegir la cuenta y no devuelve la sesión.
 * El ingreso pide la ventanita del correo (GIS) y registra ese token en Firebase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ingreso = readFileSync(resolve(root, 'js/ingreso.js'), 'utf8')
const firebaseInit = readFileSync(resolve(root, 'js/firebase-init.js'), 'utf8')

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
  const c = createContext({
    window: {},
    document: { getElementById: () => ({ disabled: false }) },
    setLoginAuthMsg(msg) { c._msg = msg },
    setLoginStatus() {},
    initLoginScreen() {},
    verificarUsuarioFirestore(user) { c._user = user; return Promise.resolve() },
    console: { error() {}, warn() {} }
  })
  c.window = c
  return c
}

describe('Ingreso con la ventanita de Google del correo', () => {
  it('al elegir la cuenta registra el token y entra', async () => {
    const user = { email: 'func@cda.gov.co' }
    const c = ctxLogin()
    let prompt = ''
    c._gmailClientId = 'cid.apps.googleusercontent.com'
    c.google = {
      accounts: {
        oauth2: {
          initTokenClient(cfg) {
            c._scope = cfg.scope
            return {
              requestAccessToken(opts) {
                prompt = opts.prompt
                cfg.callback({ access_token: 'tok-cuenta' })
              }
            }
          }
        }
      }
    }
    c._authSignInWithAccessToken = (tok) => {
      c._tok = tok
      return Promise.resolve({ user })
    }
    c._authSignInGoogle = () => { throw new Error('no usar aviso Firebase') }
    runInContext(extraer(ingreso, ['clientIdLoginGoogle', 'pedirCuentaGoogle', 'iniciarLoginGoogle']), c)
    const p = c.iniciarLoginGoogle()
    await p
    expect(prompt).toBe('select_account')
    expect(c._scope).toContain('email')
    expect(c._tok).toBe('tok-cuenta')
    expect(c._user).toBe(user)
    expect(c._loginGoogleInFlight).toBe(false)
  })

  it('si cierra la ventanita, el botón queda libre para intentar de nuevo', async () => {
    const c = ctxLogin()
    const btn = { disabled: false }
    c.document.getElementById = () => btn
    c._gmailClientId = 'cid'
    c.google = {
      accounts: {
        oauth2: {
          initTokenClient(cfg) {
            return { requestAccessToken() { cfg.error_callback({ type: 'popup_closed' }) } }
          }
        }
      }
    }
    c._authSignInWithAccessToken = () => Promise.reject(new Error('no debio'))
    c._authSignInGoogle = () => { throw new Error('no usar aviso Firebase') }
    runInContext(extraer(ingreso, ['clientIdLoginGoogle', 'pedirCuentaGoogle', 'iniciarLoginGoogle']), c)
    await c.iniciarLoginGoogle()
    expect(c._loginGoogleInFlight).toBe(false)
    expect(btn.disabled).toBe(false)
    expect(String(c._msg)).toContain('cancelado')
    await c.iniciarLoginGoogle()
    expect(c._loginGoogleInFlight).toBe(false)
    expect(btn.disabled).toBe(false)
  })

  it('Firebase acepta el token de esa ventanita y no redirige la página', () => {
    expect(firebaseInit).toContain('signInWithCredential')
    expect(firebaseInit).toContain('_authSignInWithAccessToken')
    expect(firebaseInit).not.toContain('signInWithRedirect')
    const fn = extraer(ingreso, ['iniciarLoginGoogle'])
    expect(fn.indexOf('pedirCuentaGoogle()')).toBeGreaterThan(-1)
    expect(fn.indexOf('pedirCuentaGoogle()')).toBeLessThan(fn.indexOf('_authSignInGoogle()'))
  })
})
