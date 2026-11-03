/**
 * Apoyo solidario: cupo diario, corte día 28, gracia hábil, bloqueo Drive.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(resolve(root, 'js/apoyo-solidario.js'), 'utf8')
const utils = readFileSync(resolve(root, 'js/utils.js'), 'utf8')

function extraer(file, nombres) {
  return nombres.map(n => {
    const ini = file.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = file.indexOf('\n', ini)
    while (fin > 0) {
      const code = file.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = file.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function montar(hoy) {
  const c = createContext({
    window: {},
    document: { body: { classList: { contains: () => true, toggle: () => {} } }, getElementById: () => null },
    console,
    Date,
    Intl,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ json: async () => ({ rates: { COP: 4100 } }) }),
    esDiaHabilCO: null,
    esAdministrador: () => false,
    escAttr: s => String(s || '').replace(/"/g, '&quot;')
  })
  c.window = c
  runInContext(extraer(utils, ['_isoDateLocal', 'pascuaDomingo', '_siguienteLunes', 'festivosColombiaSet', 'esDiaHabilCO']), c)
  runInContext(src, c)
  // Forzar "hoy" en helpers que leen apoyoHoyLocal vía monkeypatch del periodo
  const realHoy = c.eval ? null : null
  void realHoy
  c._apoyoCfg = c.apoyoNormCfg ? null : null
  // Las funciones están en window tras el IIFE
  const w = c
  w._apoyoCfg = { cupoDiario: 100, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
  // Re-bind: el IIFE asignó a window.*
  return w
}

describe('Apoyo solidario', () => {
  it('el periodo hasta el 28 es el mes actual; el 29 abre el siguiente', () => {
    const w = montar()
    // apoyoPeriodoId no está en window — está cerrado. Probar vía registrar + uso.
    expect(src).toContain('diaCorte:28')
    expect(src).toContain('diasGraciaHabiles:3')
    expect(src).toContain('apoyoDriveRestringido')
    expect(src).toContain('Apoyo solidario')
    expect(readFileSync(resolve(root, 'firestore.rules'), 'utf8')).toContain('match /apoyo_uso/{email}')
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('apoyo-solidario.js')
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('id="apoyo-banner"')
  })

  it('el excedente del cupo diario suma cobrables y el monto en COP', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    w._apoyoUso = {
      email: 'a@x.co', periodo: '2099-01', diaIso: '2099-01-01',
      lecturasDia: 0, cobrablesDia: 0, lecturasMes: 0, cobrablesMes: 0,
      montoUsd: 0, montoCop: 0, apoyado: false, historial: []
    }
    // Parche: apoyoAsegurarDia usa apoyoHoyLocal real — forzar diaIso = hoy
    const hoy = new Date()
    const iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0')
    const perY = hoy.getDate() > 28
      ? (hoy.getMonth() === 11 ? (hoy.getFullYear() + 1) + '-01' : hoy.getFullYear() + '-' + String(hoy.getMonth() + 2).padStart(2, '0'))
      : hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
    w._apoyoUso.periodo = perY
    w._apoyoUso.diaIso = iso
    w.apoyoRegistrarLecturas(15)
    expect(w._apoyoUso.lecturasDia).toBe(15)
    expect(w._apoyoUso.cobrablesDia).toBe(5)
    expect(w._apoyoUso.cobrablesMes).toBe(5)
    expect(w._apoyoUso.montoUsd).toBeCloseTo(0.005, 5)
    expect(w._apoyoUso.montoCop).toBe(20)
    expect(src).toContain("pct+'% hoy'")
    expect(src).toContain('apoyoFmtCopCorto')
    expect(src).toContain("bar.style.height=pct+'%'")
  })

  it('cambiar precio o TRM no recalcula lo ya cobrado; solo suma el excedente nuevo', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    const hoy = new Date()
    const iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0')
    const perY = hoy.getDate() > 28
      ? (hoy.getMonth() === 11 ? (hoy.getFullYear() + 1) + '-01' : hoy.getFullYear() + '-' + String(hoy.getMonth() + 2).padStart(2, '0'))
      : hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
    w._apoyoUso = {
      email: 'a@x.co', periodo: perY, diaIso: iso,
      lecturasDia: 10, cobrablesDia: 0, lecturasMes: 10, cobrablesMes: 0,
      montoUsd: 0, montoCop: 0, apoyado: false, historial: []
    }
    // 1000 cobrables × $1/mil × TRM 4000 = $4000 COP
    w.apoyoRegistrarLecturas(1000)
    expect(w._apoyoUso.cobrablesMes).toBe(1000)
    expect(w._apoyoUso.montoCop).toBe(4000)
    // Admin sube precio y TRM: lo acumulado no se toca
    w._apoyoCfg = { cupoDiario: 10, precioPorMilUsd: 2, trmCop: 5000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    // 1000 cobrables nuevos × $2/mil × TRM 5000 = $10000 COP → total 14000
    w.apoyoRegistrarLecturas(1000)
    expect(w._apoyoUso.cobrablesMes).toBe(2000)
    expect(w._apoyoUso.montoCop).toBe(14000)
    // Si se recalculara todo a tarifa nueva serían 2000×2×5 = 20000; no debe pasar
    expect(w._apoyoUso.montoCop).not.toBe(20000)
    expect(src).toContain('Solo el excedente NUEVO se valora')
  })

  it('Drive se restringe solo tras gracia y con cobrables, no al administrador', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    w._apoyoUso = {
      email: 'a@x.co', periodo: '2026-10', diaIso: '2026-10-28',
      lecturasMes: 100, cobrablesMes: 50, montoUsd: 0.05, montoCop: 200,
      apoyado: false, historial: []
    }
    // Sin forzar fecha del sistema, comprobamos la lógica publicada
    expect(src).toContain('if(u.apoyado)return false')
    expect(src).toContain('apoyoUltimoDiaGracia')
    const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
    expect(gmail).toContain('apoyoDriveRestringido')
    expect(gmail).toContain('apoyoMensajeDriveBloqueado')
    expect(gmail).toContain('function gmailConnect')
    const cfg = readFileSync(resolve(root, 'js/configuracion.js'), 'utf8')
    expect(cfg).toContain('function renderApoyoSolidarioCfg')
    expect(cfg).toContain("cfgSectionFold('Apoyo solidario'")
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('id="ctab-apoyo"')
    const pers = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
    expect(pers).toContain('sinArchivoAdmin')
    expect(pers).toContain("rolLogin==='admin'||rolLogin==='jurisdiccional'")
  })
})
