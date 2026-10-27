/**
 * Con el cupo de escritura agotado, Firestore no da error: las actividades asignadas se veían
 * en pantalla y desaparecían al recargar, sin franja de aviso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const firebaseInit = readFileSync(resolve(root, 'js/firebase-init.js'), 'utf8')
const roles = readFileSync(resolve(root, 'js/roles.js'), 'utf8')
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

function ctxVigilante() {
  const timers = []
  const eventos = []
  const window = { dispatchEvent: e => eventos.push(e.type) }
  const c = createContext({
    window,
    Event: class { constructor(t) { this.type = t } },
    Promise,
    setTimeout: (fn, ms) => { timers.push({ fn, ms, vivo: true }); return timers.length - 1 },
    clearTimeout: i => { if (timers[i]) timers[i].vivo = false }
  })
  runInContext('const FS_TOPE_CONFIRMACION_MS=10000;let fsEscriturasPendientes=0;\n' +
    extraer(firebaseInit, ['vigilarEscritura']), c)
  const vencer = () => timers.forEach(t => { if (t.vivo) { t.vivo = false; t.fn() } })
  return { c, window, eventos, timers, vencer }
}

function diferida() {
  let ok, ko
  const p = new Promise((a, b) => { ok = a; ko = b })
  return { p, ok, ko }
}

const tick = () => new Promise(r => setTimeout(r, 0))

describe('Vigilante de guardados en Firestore', () => {
  it('un guardado confirmado a tiempo no bloquea nada', async () => {
    const { c, window, eventos, timers } = ctxVigilante()
    const d = diferida()
    const set = c.vigilarEscritura(() => d.p)
    set('ref', {})
    expect(timers[0].ms).toBe(10000)
    d.ok()
    await tick()
    expect(timers[0].vivo).toBe(false)
    expect(window._fsCuotaAgotada).toBeUndefined()
    expect(eventos).toEqual([])
  })

  it('sin confirmación en 10 s pasa a solo consulta', () => {
    const { c, window, eventos, vencer } = ctxVigilante()
    c.vigilarEscritura(() => new Promise(() => {}))('ref', {})
    vencer()
    expect(window._fsCuotaAgotada).toBe(true)
    expect(eventos).toEqual(['firestore-cuota-agotada'])
  })

  it('se libera solo cuando confirman todos los pendientes', async () => {
    const { c, window, eventos, vencer } = ctxVigilante()
    const a = diferida()
    const b = diferida()
    const set = c.vigilarEscritura(x => x.p)
    set(a)
    set(b)
    vencer()
    a.ok()
    await tick()
    expect(window._fsCuotaAgotada).toBe(true)
    b.ok()
    await tick()
    expect(window._fsCuotaAgotada).toBe(false)
    expect(eventos).toEqual(['firestore-cuota-agotada', 'firestore-cuota-restablecida'])
  })

  it('un guardado rechazado no libera el bloqueo y devuelve el error a quien guarda', async () => {
    const { c, window, vencer } = ctxVigilante()
    const d = diferida()
    const p = c.vigilarEscritura(() => d.p)('ref', {})
    vencer()
    d.ko(new Error('permission-denied'))
    await expect(p).rejects.toThrow('permission-denied')
    expect(window._fsCuotaAgotada).toBe(true)
  })

  it('crear, editar y borrar pasan por el vigilante', () => {
    expect(firebaseInit).toContain('window._fsSetDoc=vigilarEscritura(setDoc)')
    expect(firebaseInit).toContain('window._fsUpdateDoc=vigilarEscritura(updateDoc)')
    expect(firebaseInit).toContain('window._fsAddDoc=vigilarEscritura(addDoc)')
    expect(firebaseInit).toContain('window._fsDeleteDoc=vigilarEscritura(deleteDoc)')
  })

  it('al restablecerse se quita la franja y se avisa', () => {
    expect(ingreso).toContain("window.addEventListener('firestore-cuota-restablecida'")
    expect(roles).toContain('Firebase no está guardando')
  })
})
