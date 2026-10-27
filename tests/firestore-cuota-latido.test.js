/**
 * Con el cupo diario de Firestore agotado, la escritura de la sesión queda en espera
 * y el funcionario no entraba. El latido de sesión gastaba unas 144 escrituras por
 * hora por pestaña abierta.
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

function ctxSesion(setDoc) {
  const store = {}
  const eventos = []
  const c = createContext({
    window: {},
    console: { log() {}, warn() {}, error() {} },
    navigator: { userAgent: 'test' },
    sessionStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: k => { delete store[k] }
    },
    Event: function (t) { this.type = t },
    setTimeout: (fn) => { fn(); return 1 },
    Date,
    Math,
    Promise,
    SESSION_STALE_MS: 12 * 60 * 1000
  })
  c.window = c
  c.dispatchEvent = e => eventos.push(e.type)
  c._db = {}
  c._fsDoc = () => ({})
  c._fsGetDoc = () => Promise.resolve({ exists: () => false })
  c._fsSetDoc = setDoc
  c._eventos = eventos
  runInContext('var _sessionId=null;\n' + extraer(ingreso, [
    'sessionDocRef', 'generateSessionId', 'sesionRemotaEstaViva', 'fsEscrituraConTope',
    'marcarCuotaFirestoreSiAplica', 'leerSesionFirestore', 'claimActiveSession'
  ]), c)
  return c
}

describe('Cupo de Firestore agotado al ingresar', () => {
  it('si la escritura de sesión no responde, no deja el ingreso colgado', async () => {
    const c = ctxSesion(() => new Promise(() => {}))
    await expect(c.claimActiveSession('func@cda.gov.co')).resolves.toBeNull()
  })

  it('con escritura normal toma la sesión como siempre', async () => {
    const c = ctxSesion(() => Promise.resolve())
    const sid = await c.claimActiveSession('func@cda.gov.co')
    expect(String(sid)).toMatch(/^sess_/)
  })

  it('un error de cuota activa el aviso una sola vez', () => {
    const c = ctxSesion(() => Promise.resolve())
    c.marcarCuotaFirestoreSiAplica({ code: 'resource-exhausted', message: 'Quota exceeded.' })
    c.marcarCuotaFirestoreSiAplica({ code: 'resource-exhausted', message: 'Quota exceeded.' })
    expect(c._fsCuotaAgotada).toBe(true)
    expect(c._eventos).toEqual(['firestore-cuota-agotada'])
  })

  it('otros errores no muestran el aviso de cuota', () => {
    const c = ctxSesion(() => Promise.resolve())
    c.marcarCuotaFirestoreSiAplica({ code: 'permission-denied', message: 'Missing permissions' })
    expect(c._fsCuotaAgotada).toBeUndefined()
    expect(c._eventos).toEqual([])
  })

  it('Firebase avisa la cuota agotada desde su registro de errores', () => {
    expect(firebaseInit).toContain('onLog(')
    expect(firebaseInit).toMatch(/resource-exhausted\|quota exceeded/)
    expect(firebaseInit).toContain("new Event('firestore-cuota-agotada')")
  })
})

describe('Latido de sesión', () => {
  it('escribe cada 5 minutos y la sesión se da por vencida después del latido', () => {
    const hb = ingreso.match(/const SESSION_HEARTBEAT_MS=([^;]+);/)
    const stale = ingreso.match(/const SESSION_STALE_MS=([^;]+);/)
    const hbMs = eval(hb[1])
    const staleMs = eval(stale[1])
    expect(hbMs).toBe(5 * 60 * 1000)
    expect(staleMs).toBeGreaterThan(2 * hbMs)
  })
})

const roles = readFileSync(resolve(root, 'js/roles.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')

describe('Cupo agotado: solo consulta, como el modo mantenimiento', () => {
  function ctxModo({ cuota = false, mant = false, sesion = true, depto = 'guaviare', rol = 'responsables' } = {}) {
    const clases = new Set(sesion ? ['sesion-activa'] : [])
    const ban = { innerHTML: '' }
    const c = createContext({
      window: {},
      document: {
        body: {
          classList: {
            contains: k => clases.has(k),
            toggle: (k, on) => { if (on) clases.add(k); else clases.delete(k) }
          }
        },
        getElementById: () => ban,
        querySelector: () => null
      },
      escAttr: s => String(s),
      horaReinicioCuotaFirebase: () => '2:00 a. m.',
      esAdministrador: () => rol === 'admin',
      deptoActivo: depto,
      mantenimientoEstado: { activo: mant, restableceAt: '', mensaje: '' }
    })
    c.window = c
    c._fsCuotaAgotada = cuota
    c._usuarioActual = { rol }
    runInContext(extraer(roles, ['esModoCiudadano', 'esMantenimientoActivo', 'fmtMantenimientoRestablece', 'aplicarModoMantenimientoUI']), c)
    c.aplicarModoMantenimientoUI()
    return { c, clases, ban }
  }

  it('sin cupo, el sistema queda en solo consulta con su aviso', () => {
    const { c, clases, ban } = ctxModo({ cuota: true })
    expect(c.esMantenimientoActivo()).toBe(true)
    expect(clases.has('modo-mantenimiento')).toBe(true)
    expect(clases.has('mant-aviso-visible')).toBe(true)
    expect(ban.innerHTML).toContain('Límite diario de Firebase')
    expect(ban.innerHTML).not.toContain('console.firebase')
  })

  it('el encargado NCA y el administrador ven el enlace a Firebase', () => {
    expect(ctxModo({ cuota: true, rol: 'guaviare' }).ban.innerHTML).toContain('console.firebase.google.com/project/cda-tramites/usage')
    expect(ctxModo({ cuota: true, rol: 'admin' }).ban.innerHTML).toContain('console.firebase.google.com')
  })

  it('en la pantalla de inicio y en la consulta ciudadana no se ve ningún aviso', () => {
    for (const caso of [{ cuota: true, sesion: false }, { mant: true, sesion: false }, { cuota: true, depto: 'ciudadano' }, { mant: true, depto: 'ciudadano' }]) {
      const { clases, ban } = ctxModo(caso)
      expect(clases.has('mant-aviso-visible')).toBe(false)
      expect(ban.innerHTML).toBe('')
    }
    expect(css).toContain('body.mant-aviso-visible .mant-banner{display:block}')
    expect(css).not.toContain('body.modo-mantenimiento .mant-banner{display:block}')
  })

  it('el mantenimiento del administrador conserva su propio aviso', () => {
    const { ban } = ctxModo({ mant: true })
    expect(ban.innerHTML).toContain('Modo mantenimiento')
    expect(ban.innerHTML).not.toContain('Límite diario')
  })

  it('con cupo y sin mantenimiento todo queda normal', () => {
    const { c, clases } = ctxModo()
    expect(c.esMantenimientoActivo()).toBe(false)
    expect(clases.has('modo-mantenimiento')).toBe(false)
    expect(clases.has('mant-aviso-visible')).toBe(false)
  })
})
