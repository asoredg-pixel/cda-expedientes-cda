/**
 * gmail-conectar-antes-progreso.test.js —
 * Si falta Gmail, no debe quedar «Notificando…» tapando el botón Conectar.
 * sstSolicitarGmailParaAdjuntar oculta la carga y abre el modal por encima.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

function montar(conectado) {
  const calls = { hide: 0, show: 0, elevate: 0, open: 0, z: null }
  const els = {
    'gmail-sesion-overlay': {
      classList: { add() {}, remove() {} },
      setAttribute() {},
      style: { zIndex: '' },
    },
    'gmail-sesion-tit': { textContent: '' },
    'gmail-sesion-txt': { innerHTML: '' },
    'confirm-prec-title': { textContent: 'Notificando por correo' },
    'confirm-prec-msg': { textContent: 'Preparando envío…' },
    'confirm-prec-carga-sub': { textContent: 'Verificando conexión Gmail…' },
    'confirm-prec-bar-fill': { style: { width: '12%' } },
  }
  const c = createContext({
    console, JSON, String, Number, Math, Date, Array, Object, Promise, isFinite,
    setInterval, clearInterval, setTimeout, clearTimeout,
    calls,
    document: {
      getElementById: id => els[id] || null,
      body: { classList: { remove() {}, add() {} }, appendChild() {} },
    },
    window: null,
    sstGmailSesionActiva: () => !!conectado,
    sstRolRequiereGmailConectado: () => true,
    sstGmailSesionUiConnecting: () => {},
    sstCargaHide: () => { calls.hide++ },
    sstCargaShow: () => { calls.show++ },
    sstRenderGmailDriveStatusBtn: () => {},
    elevateOverlayAboveModals: (ov, z) => { calls.elevate++; calls.z = z; if (ov) ov.style.zIndex = String(z) },
    resetOverlayElevation: ov => { if (ov) ov.style.zIndex = '' },
    apoyoDriveRestringido: () => false,
    driveOpsProcesarSilencioso: () => {},
    _gmailConnecting: false,
    _gmailConnectingWatchdog: null,
    _sstGmailAutoConnectPending: false,
  })
  c.window = c
  c._confirmRadicacionLoading = !conectado
  c._sstProgresoUnico = true
  runInContext(extraer(gmail, [
    '_sstResolverGmailAttachCb', 'sstAbrirGmailDriveModal', 'sstCerrarGmailAttachModal',
    'sstFinalizeGmailConnect', 'sstSolicitarGmailParaAdjuntar', 'renderSstGmailSesionBloqueo',
  ]), c)
  // Hook open count
  const orig = c.sstAbrirGmailDriveModal
  c.sstAbrirGmailDriveModal = function(opts) {
    calls.open++
    return orig(opts)
  }
  return { c, calls, els }
}

describe('Gmail: conectar antes del progreso de notificación', () => {
  it('si ya está conectado, resuelve true sin abrir modal', async () => {
    const { c, calls } = montar(true)
    const ok = await c.sstSolicitarGmailParaAdjuntar()
    expect(ok).toBe(true)
    expect(calls.open).toBe(0)
    expect(calls.hide).toBe(0)
  })

  it('si hay progreso abierto, lo oculta y eleva el modal Conectar', async () => {
    const { c, calls } = montar(false)
    const p = c.sstSolicitarGmailParaAdjuntar({ title: 'Conectar para notificar' })
    expect(calls.hide).toBe(1)
    expect(calls.open).toBe(1)
    expect(calls.elevate).toBeGreaterThanOrEqual(1)
    expect(calls.z).toBe(100300)
    // Usuario cancela
    c.sstCerrarGmailAttachModal(false)
    const ok = await p
    expect(ok).toBe(false)
    expect(calls.show).toBe(0)
  })

  it('tras conectar con OAuth aún “connecting”, libera el await (no queda Conectando…)', async () => {
    const { c, calls } = montar(false)
    const p = c.sstSolicitarGmailParaAdjuntar()
    expect(calls.open).toBe(1)
    // OAuth en curso + token ya guardado (antes el cerrar abortaba y el await no terminaba)
    c._gmailConnecting = true
    c.sstGmailSesionActiva = () => true
    c.sstFinalizeGmailConnect()
    const ok = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout await gmail')), 800)),
    ])
    expect(ok).toBe(true)
    expect(c._gmailConnecting).toBe(false)
  })

  it('taskReviewConfirmarYNotificar: Gmail antes de Enviando; tras conectar restaura Enviar', () => {
    const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
    const fnStart = core.indexOf('async function taskReviewConfirmarYNotificar')
    expect(fnStart).toBeGreaterThan(0)
    const slice = core.slice(fnStart, fnStart + 5500)
    const iSolicitar = slice.indexOf('sstSolicitarGmailParaAdjuntar')
    const iEnviando = slice.indexOf("btn.textContent='Enviando…'")
    const iCarga = slice.indexOf("sstCargaShow({title:'Notificando por correo'")
    const iRestaurar = slice.indexOf("Pulse «Enviar notificación y cerrar» para enviar")
    expect(iSolicitar).toBeGreaterThan(0)
    expect(iEnviando).toBeGreaterThan(0)
    expect(iCarga).toBeGreaterThan(0)
    expect(iRestaurar).toBeGreaterThan(0)
    expect(iSolicitar).toBeLessThan(iEnviando)
    expect(iEnviando).toBeLessThan(iCarga)
  })

  it('busy colgado no bloquea un nuevo clic en Enviar', () => {
    const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
    const fnStart = core.indexOf('async function taskReviewConfirmarYNotificar')
    const slice = core.slice(fnStart, fnStart + 2500)
    expect(slice).toContain('Si un intento previo dejó busy=true')
    expect(slice).toContain("window._taskReviewNotifBusy=false")
    expect(slice.indexOf('pareceEnvioReal')).toBeGreaterThan(0)
  })
})
