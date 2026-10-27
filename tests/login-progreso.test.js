/**
 * Mientras se verifica el acceso y se toma la sesión (hasta 8 s si Firestore no
 * responde) la pantalla quedaba sin indicación y el funcionario volvía a pulsar.
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

function ctxStatus() {
  const txt = { textContent: '' }
  const el = { style: {}, innerHTML: '', textContent: '', querySelector: () => txt }
  const panel = { style: {} }
  const c = createContext({
    document: {
      getElementById: id => (id === 'login-status' ? el : panel),
      body: { classList: { contains: () => false } }
    }
  })
  runInContext(extraer(ingreso, ['setLoginStatus']), c)
  return { c, el, txt, panel }
}

describe('Progreso al ingresar', () => {
  it('muestra el círculo girando y la barra con el texto del paso', () => {
    const { c, el, txt, panel } = ctxStatus()
    c.setLoginStatus('Ingresando al sistema…', true)
    expect(el.innerHTML).toContain('gmail-sesion-spinner-ring')
    expect(el.innerHTML).toContain('gmail-sesion-prog-fill')
    expect(txt.textContent).toBe('Ingresando al sistema…')
    expect(el.style.display).toBe('block')
    expect(panel.style.display).toBe('none')
  })

  it('el texto no se interpreta como HTML', () => {
    const { c, el, txt } = ctxStatus()
    c.setLoginStatus('<b>x</b>', true)
    expect(el.innerHTML).not.toContain('<b>x</b>')
    expect(txt.textContent).toBe('<b>x</b>')
  })

  it('al terminar oculta el progreso y vuelve el botón', () => {
    const { c, el, panel } = ctxStatus()
    c.setLoginStatus('Ingresando al sistema…', true)
    c.setLoginStatus('')
    expect(el.style.display).toBe('none')
    expect(panel.style.display).toBe('')
  })

  it('el progreso sigue visible mientras se toma la sesión', () => {
    const fn = extraer(ingreso, ['verificarUsuarioFirestore']).replace(/\r\n/g, '\n')
    const iProg = fn.indexOf("setLoginStatus('Ingresando al sistema…',true)")
    const iClaim = fn.indexOf('await claimActiveSession(email)')
    const iFin = fn.indexOf("setLoginStatus('');\n    ingresarComoRol(")
    expect(iProg).toBeGreaterThan(-1)
    expect(iClaim).toBeGreaterThan(iProg)
    expect(iFin).toBeGreaterThan(iClaim)
    const entre = fn.slice(fn.indexOf('authUsuario=fbUser;'), iClaim)
    expect(entre).not.toMatch(/setLoginStatus\(''\);\s*setLoginAuthMsg\(''\);\s*const acceso/)
  })
})
