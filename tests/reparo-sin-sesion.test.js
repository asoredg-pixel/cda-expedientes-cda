/**
 * Reparos al pintar Actividades (dedupe / heal): sin sesión no se guardan ni avisan.
 * Con sesión van de a uno y en silencio. Un guardado pedido por el usuario sigue avisando.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function mundo(opts) {
  opts = opts || {}
  const body = {
    _on: !!opts.sesion,
    classList: {
      contains(c) { return c === 'sesion-activa' && body._on }
    }
  }
  const avisos = []
  const backups = []
  const guardados = []
  const c = createContext({
    window: {
      _firebaseAuth: { currentUser: opts.user ? { email: 'nca@cda.gov.co' } : null },
      _lastFsSaveError: null
    },
    document: { body },
    console,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    Promise,
    deptoActivo: 'guaviare',
    resolveDeptoFirestoreId: () => 'guaviare',
    updateSyncIndicator: () => {},
    ensureFirestoreAuthReady: async () => (opts.authOk === false ? { ok: false, code: 'unauthenticated' } : { ok: true }),
    persistExpLocalBackup: (exp) => { backups.push(exp && exp._exp) },
    notif: (msg) => { avisos.push(msg) },
    _firestoreSaveErrorMessage: () => '⚠️ No se pudo guardar en Firestore. Sesión de Firebase no disponible.',
    _persistLocalBackupHint: () => ' La PQRSD quedó guardada localmente y se sincronizará al reconectar.',
    saveExpedienteDoc: async () => opts.saveOk !== false,
    saveGlobalFirestore: async () => true,
    expedienteDocId: (exp) => String(exp && exp._exp || ''),
    removeExpLocalBackup: () => {},
    mergeExpIntoExpsCache: () => {},
    esPqrsSecretaria: () => true
  })
  c.window = c.window
  c.avisos = avisos
  c.backups = backups
  c.guardados = guardados
  c.body = body
  return c
}

function cargarCola(c, persist) {
  runInContext(extraer(persistence, [
    '_reparoEstado', '_reparoSesionUi', '_reparoSesionLista', '_reparoSoltarCola', '_reparoDrenar', 'encolarReparoExpediente'
  ]), c)
  c.persistExpedienteGranularAsync = persist || (async (exp, g, opts) => {
    c.guardados.push({ id: exp._exp, opts })
    return true
  })
}

function cargarPersist(c) {
  runInContext(extraer(persistence, ['persistExpedienteGranularAsync']), c)
}

afterEach(() => {
  /* los intervalos de espera se limpian en cada caso */
})

describe('Reparo al pintar Actividades', () => {
  it('sin sesión no encola, no guarda y no marca el expediente', () => {
    const c = mundo({ sesion: false, user: false })
    cargarCola(c)
    const ok = c.encolarReparoExpediente({ _exp: 'SAN-00016-23' }, '_entregaDedupePersist', 'SAN-00016-23')
    expect(ok).toBe(false)
    expect(c.guardados).toEqual([])
    expect(c.window._reparoEstado).toBeUndefined()
    expect(c.window._entregaDedupePersist).toBeUndefined()
  })

  it('con sesión espera el usuario de Firebase y luego guarda en silencio, de a uno', async () => {
    const c = mundo({ sesion: true, user: false })
    let pendiente
    cargarCola(c, (exp, g, opts) => {
      c.guardados.push({ id: exp._exp, opts })
      return new Promise(resolve => { pendiente = resolve })
    })
    expect(c.encolarReparoExpediente({ _exp: 'SAN-00016-23' }, '_entregaDedupePersist', 'SAN-00016-23')).toBe(true)
    expect(c.encolarReparoExpediente({ _exp: 'PYE-00004-20' }, '_entregaDedupePersist', 'PYE-00004-20')).toBe(true)
    expect(c.encolarReparoExpediente({ _exp: 'SAN-00016-23' }, '_entregaDedupePersist', 'SAN-00016-23')).toBe(false)
    expect(c.guardados).toEqual([])
    c.window._firebaseAuth.currentUser = { email: 'nca@cda.gov.co' }
    c._reparoDrenar()
    expect(c.guardados.map(g => g.id)).toEqual(['SAN-00016-23'])
    expect(c.guardados[0].opts).toEqual({ silent: true, sinRespaldoLocal: true })
    pendiente(true)
    await Promise.resolve()
    expect(c.guardados.map(g => g.id)).toEqual(['SAN-00016-23', 'PYE-00004-20'])
    const espera = c.window._reparoEstado.espera
    if (espera) clearInterval(espera)
  })

  it('si se cierra la sesión suelta la cola y no guarda lo que faltaba', () => {
    const c = mundo({ sesion: true, user: false })
    cargarCola(c)
    c.encolarReparoExpediente({ _exp: 'RR260356' }, '_pqrsDedupePersist', 'RR260356')
    c.body._on = false
    c._reparoDrenar()
    expect(c.guardados).toEqual([])
    expect(c.window._reparoEstado.cola).toEqual([])
    expect(c.window._pqrsDedupePersist.has('RR260356')).toBe(false)
    const espera = c.window._reparoEstado.espera
    if (espera) clearInterval(espera)
  })
})

describe('Aviso al guardar un expediente pedido por el usuario', () => {
  it('sin Firebase sigue avisando y deja copia local', async () => {
    const c = mundo({ sesion: true, user: true, authOk: false })
    cargarPersist(c)
    const ok = await c.persistExpedienteGranularAsync({ _exp: 'PQRSD-1', _es_pqrs: true }, false)
    expect(ok).toBe(false)
    expect(c.backups).toEqual(['PQRSD-1'])
    expect(c.avisos[0]).toContain('Sesión de Firebase no disponible')
    expect(c.avisos[0]).toContain('guardada localmente')
  })

  it('el reparo silencioso no avisa ni copia el expediente entero en local', async () => {
    const c = mundo({ sesion: true, user: true, authOk: false })
    cargarPersist(c)
    const ok = await c.persistExpedienteGranularAsync({ _exp: 'SAN-00023-23' }, false, { silent: true, sinRespaldoLocal: true })
    expect(ok).toBe(false)
    expect(c.backups).toEqual([])
    expect(c.avisos).toEqual([])
  })
})
