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

describe('Aviso de cupo', () => {
  function ctxAviso(rol) {
    const el = { style: {}, setAttribute() {}, innerHTML: '' }
    const c = createContext({
      window: {},
      document: {
        body: { insertBefore() {}, firstChild: null },
        getElementById: () => el,
        createElement: () => el
      },
      escAttr: s => String(s),
      Date
    })
    c.window = c
    c._usuarioActual = rol ? { rol } : null
    runInContext(extraer(ingreso, ['horaReinicioCuotaFirebase', 'mostrarAvisoCuotaFirestore']), c)
    c.mostrarAvisoCuotaFirestore()
    return el
  }

  it('el encargado NCA y el administrador ven el enlace a Firebase', () => {
    expect(ctxAviso('guaviare').innerHTML).toContain('console.firebase.google.com/project/cda-tramites/usage')
    expect(ctxAviso('admin').innerHTML).toContain('console.firebase.google.com')
  })

  it('el responsable y la pantalla de inicio ven el aviso sin el enlace', () => {
    const resp = ctxAviso('responsables').innerHTML
    const inicio = ctxAviso(null).innerHTML
    expect(resp).toContain('límite diario')
    expect(resp).not.toContain('console.firebase')
    expect(inicio).toContain('Se restablece a las')
    expect(inicio).not.toContain('console.firebase')
  })
})
