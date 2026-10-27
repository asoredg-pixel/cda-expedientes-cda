/**
 * El ingreso que funcionaba (build 20261026d) abre la ventanita de Google
 * con signInWithPopup y no manda la página completa a otro dominio.
 * La mezcla de informes eliminados no entra en el clic de ingreso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ingreso = readFileSync(resolve(root, 'js/ingreso.js'), 'utf8')
const firebaseInit = readFileSync(resolve(root, 'js/firebase-init.js'), 'utf8')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

describe('Ingreso restaurado a la ventanita que funcionaba', () => {
  it('el clic solo abre la ventanita de Firebase', () => {
    const fn = extraer(ingreso, ['iniciarLoginGoogle'])
    expect(fn).toContain('window._authSignInGoogle()')
    expect(fn).not.toContain('_authSignInGoogleRedirect')
    expect(fn).not.toContain('signInWithRedirect')
    expect(fn).not.toContain('sst_login_redirect_once')
    expect(firebaseInit).toContain('signInWithPopup')
    expect(firebaseInit).not.toContain('signInWithRedirect')
    expect(firebaseInit).not.toContain('getRedirectResult')
  })

  it('al guardar actividades libres no reincorpora las eliminadas', () => {
    const fn = extraer(persistence, ['actividadesLibresForDepto'])
    expect(fn).toContain('t.eliminada')
    expect(fn).toContain('return false')
  })
})
