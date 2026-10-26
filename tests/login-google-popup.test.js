/**
 * El aviso de Google se cierra al elegir la cuenta y Firebase lo reporta
 * como cancelado. Si la cuenta quedó, el funcionario debe entrar igual.
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

describe('Ingreso Google cuando el aviso se cierra', () => {
  it('si la cuenta ya quedó en Firebase, la devuelve sin esperar', async () => {
    const user = { email: 'func@cda.gov.co' }
    const c = createContext({
      window: {},
      setTimeout: (fn) => { fn(); return 1 },
      clearTimeout() {}
    })
    c.window = c
    c._firebaseAuth = { currentUser: user }
    runInContext(extraer(ingreso, ['esperarUsuarioGoogleTrasCierre']), c)
    await expect(c.esperarUsuarioGoogleTrasCierre()).resolves.toBe(user)
  })

  it('si llega un instante después, también la toma', async () => {
    const user = { email: 'func@cda.gov.co' }
    let cb = null
    const c = createContext({
      window: {},
      setTimeout: () => 1,
      clearTimeout() {}
    })
    c.window = c
    c._firebaseAuth = { currentUser: null }
    c._authOnStateChanged = (auth, fn) => { cb = fn; return function() {} }
    runInContext(extraer(ingreso, ['esperarUsuarioGoogleTrasCierre']), c)
    const p = c.esperarUsuarioGoogleTrasCierre()
    cb(user)
    await expect(p).resolves.toBe(user)
  })

  it('al elegir la cuenta la página va a Google y recupera la sesión antes de mezclar informes', () => {
    const fn = extraer(ingreso, ['iniciarLoginGoogle'])
    expect(fn).toContain('_authSignInGoogleRedirect')
    expect(fn).toContain('esperarUsuarioGoogleTrasCierre()')
    expect(fn).not.toContain('Inicio de sesión cancelado.')
    const boot = extraer(ingreso, ['initFirebaseAuthListener'])
    const iCall = boot.indexOf('window._authGetRedirectResult()')
    const iFin = boot.indexOf('.then(fin)')
    expect(iCall).toBeGreaterThan(-1)
    expect(iFin).toBeGreaterThan(iCall)
    expect(boot).toContain('registrarListenerAuth()')
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    const b = html.slice(html.indexOf('async function bootstrapApp'))
    const iAuth = b.indexOf('initFirebaseAuthListener')
    const iLoad = b.indexOf('await loadLS()')
    expect(iAuth).toBeGreaterThan(-1)
    expect(iLoad).toBeGreaterThan(iAuth)
    const ver = extraer(ingreso, ['verificarUsuarioFirestore'])
    expect(ver).toContain("classList.contains('sesion-activa')")
  })

  it('el script de Drive no se carga en la pantalla de inicio', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
    expect(html).not.toContain('accounts.google.com/gsi/client')
    const i = gmail.indexOf("addEventListener('load'")
    expect(gmail.slice(i, i + 420)).toContain("classList.contains('sesion-activa')")
  })

  it('Firebase ofrece ingreso por redirección si el aviso no deja entrar', () => {
    expect(firebaseInit).toContain('signInWithRedirect')
    expect(firebaseInit).toContain('getRedirectResult')
    expect(firebaseInit).toContain('_authSignInGoogleRedirect')
    expect(firebaseInit).toContain('_authGetRedirectResult')
  })
})
