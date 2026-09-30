/**
 * gmail-gis.test.js — Carga fallida de Google Identity Services al pulsar Conectar:
 * reintento de descarga y diagnóstico (navegador viejo, reloj desfasado, bloqueo).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gmailSrc = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

function extraerFunciones(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^function ' + n + '\\(', 'm'))
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

const CHROME_NUEVO = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const CHROME_VIEJO = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36'

function escenario({ ua = CHROME_NUEVO, relojDesfaseMs = 0, fetchFalla = false } = {}) {
  const notifs = []
  const scripts = []
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, String, Promise, parseInt,
    navigator: { userAgent: ua },
    location: { origin: 'https://app.test', pathname: '/index.html' },
    notif: (m, t) => notifs.push({ m, t }),
    fetch: fetchFalla
      ? () => Promise.reject(new Error('red'))
      : () => Promise.resolve({ headers: { get: () => new Date(Date.now() - relojDesfaseMs).toUTCString() } }),
    document: {
      createElement: () => ({}),
      head: { appendChild: s => scripts.push(s) },
    },
    GMAIL_OAUTH_CLIENT_ID: '123-abc.apps.googleusercontent.com',
  }
  ctx.window = ctx
  createContext(ctx)
  runInContext('var GMAIL_GIS_SRC="https://accounts.google.com/gsi/client";var _gmailGisCargando=false;var _gmailGisAvisar=false;var _gmailConnecting=false;\n' +
    extraerFunciones(gmailSrc, ['_gmailGetClientId', '_gmailGisReady', '_gmailNavegadorVersion', '_gmailGisDiagnostico', '_gmailGisRecargar', '_gmailStartOAuth']), ctx)
  return { ctx, notifs, scripts }
}
const esperar = ms => new Promise(r => setTimeout(r, ms))

describe('Conectar sin Google cargado', () => {
  it('reintenta la descarga y avisa cuando queda listo', async () => {
    const { ctx, notifs, scripts } = escenario()
    expect(ctx._gmailStartOAuth('scope', () => {})).toBe(false)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://accounts.google.com/gsi/client')
    expect(notifs[0].t).toBe('warn')
    ctx._gmailStartOAuth('scope', () => {})
    expect(scripts).toHaveLength(1)
    ctx.google = { accounts: { oauth2: {} } }
    scripts[0].onload()
    await esperar(300)
    expect(notifs.at(-1)).toEqual({ m: 'Google quedó listo. Pulse Conectar de nuevo.', t: 'ok' })
  })

  it('recarga silenciosa previa: si la usuaria pulsa Conectar, igual se le avisa al terminar', async () => {
    const { ctx, notifs, scripts } = escenario()
    ctx._gmailGisRecargar(true)
    ctx._gmailStartOAuth('scope', () => {})
    expect(scripts).toHaveLength(1)
    expect(notifs[0].m).toContain('Aún se está cargando')
    ctx.google = { accounts: { oauth2: {} } }
    scripts[0].onload()
    await esperar(300)
    expect(notifs.at(-1).t).toBe('ok')
  })

  it('recarga silenciosa sin clic: no muestra avisos', async () => {
    const { ctx, notifs, scripts } = escenario()
    ctx._gmailGisRecargar(true)
    scripts[0].onerror()
    await esperar(50)
    expect(notifs).toHaveLength(0)
  })
})

describe('Diagnóstico si vuelve a fallar', () => {
  it('navegador viejo (Chrome 79)', async () => {
    const { ctx, notifs, scripts } = escenario({ ua: CHROME_VIEJO })
    ctx._gmailStartOAuth('scope', () => {})
    scripts[0].onerror()
    await esperar(50)
    expect(notifs.at(-1).t).toBe('err')
    expect(notifs.at(-1).m).toContain('Chrome 79')
  })

  it('reloj del equipo desfasado', async () => {
    const { ctx, notifs, scripts } = escenario({ relojDesfaseMs: 3 * 24 * 3600 * 1000 })
    ctx._gmailStartOAuth('scope', () => {})
    scripts[0].onerror()
    await esperar(50)
    expect(notifs.at(-1).m).toContain('fecha u hora del equipo está mal')
  })

  it('reloj correcto: bloqueo o red', async () => {
    const { ctx, notifs, scripts } = escenario({ relojDesfaseMs: 30000 })
    ctx._gmailStartOAuth('scope', () => {})
    scripts[0].onerror()
    await esperar(50)
    expect(notifs.at(-1).m).toContain('accounts.google.com')
  })

  it('sin poder consultar la hora: mensaje de bloqueo', async () => {
    const { ctx, notifs, scripts } = escenario({ fetchFalla: true })
    ctx._gmailStartOAuth('scope', () => {})
    scripts[0].onerror()
    await esperar(50)
    expect(notifs.at(-1).m).toContain('Ctrl+F5')
  })

  it('carga pero no ejecuta (navegador incompatible): diagnóstico tras esperar', async () => {
    const { ctx, notifs, scripts } = escenario({ ua: CHROME_VIEJO })
    ctx._gmailStartOAuth('scope', () => {})
    scripts[0].onload()
    await esperar(3300)
    expect(notifs.at(-1).m).toContain('muy antiguo')
  }, 6000)
})
