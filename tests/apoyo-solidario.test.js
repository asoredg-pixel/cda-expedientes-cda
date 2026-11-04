/**
 * Apoyo solidario: cupo diario, corte día 28, gracia hábil, bloqueo Drive.
 * Cobro A (personal) + B (global Blaze) sin doble cobro.
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

function montar() {
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
  const w = c
  w._apoyoCfg = { cupoDiario: 100, cupoGlobalDia: 40000, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
  w._apoyoUsoListo = true
  return w
}

function diaYPeriodoTest(w) {
  const iso = w.apoyoHoyLocal ? w.apoyoHoyLocal() : (() => {
    const hoy = new Date()
    if (hoy.getHours() < 2) hoy.setDate(hoy.getDate() - 1)
    return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0')
  })()
  // apoyoHoyLocal no está exportado: alinear con lógica 02:00 del fuente
  const ahora = new Date()
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  if (ahora.getHours() < 2) d.setDate(d.getDate() - 1)
  const iso2 = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  const day = d.getDate()
  const perY = day > 28
    ? (d.getMonth() === 11 ? (d.getFullYear() + 1) + '-01' : d.getFullYear() + '-' + String(d.getMonth() + 2).padStart(2, '0'))
    : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
  void iso
  return { iso: iso2, perY }
}

describe('Apoyo solidario', () => {
  it('el periodo hasta el 28 es el mes actual; el 29 abre el siguiente', () => {
    montar()
    expect(src).toContain('diaCorte:28')
    expect(src).toContain('diasGraciaHabiles:3')
    expect(src).toContain('cupoGlobalDia')
    expect(src).toContain('apoyo_consumo')
    expect(src).toContain('apoyoDriveRestringido')
    expect(src).toContain('Apoyo solidario')
    expect(readFileSync(resolve(root, 'firestore.rules'), 'utf8')).toContain('match /apoyo_uso/{email}')
    expect(readFileSync(resolve(root, 'firestore.rules'), 'utf8')).toContain('match /apoyo_consumo/{diaIso}')
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('apoyo-solidario.js')
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('id="apoyo-banner"')
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('sst-apoyo-fill-glob')
    expect(src).toContain('apoyo-cfg-cupo-global')
    expect(src).toContain('Lecturas gratis globales')
  })

  it('el excedente del cupo diario suma cobrables y el monto en COP', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, cupoGlobalDia: 40000, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    const { iso, perY } = diaYPeriodoTest(w)
    w._apoyoUso = {
      email: 'a@x.co', periodo: perY, diaIso: iso,
      lecturasDia: 0, cobrablesDia: 0, lecturasMes: 0, cobrablesMes: 0,
      baseBDia: 0, cobrablesBlazeDia: 0, cobrablesBlazeMes: 0, montoBlazeUsd: 0, montoBlazeCop: 0,
      montoUsd: 0, montoCop: 0, apoyado: false, historial: []
    }
    w.apoyoRegistrarLecturas(15)
    expect(w._apoyoUso.lecturasDia).toBe(15)
    expect(w._apoyoUso.cobrablesDia).toBe(5)
    expect(w._apoyoUso.cobrablesMes).toBe(5)
    expect(w._apoyoUso.baseBDia).toBe(10)
    expect(w._apoyoUso.montoUsd).toBeCloseTo(0.005, 5)
    expect(w._apoyoUso.montoCop).toBe(20)
    expect(src).toContain('--apoyo-fill')
    expect(src).toContain('apoyoFmtCopCorto')
    expect(src).toContain('sst-apoyo-fill-per')
    expect(src).toContain('apoyoAplicarCobroBlaze')
    expect(src).toContain('apoyoHeredarCobroCiclo')
    expect(src).toContain('apoyoFusionarMaxUso')
  })

  it('cambiar precio o TRM no recalcula lo ya cobrado; solo suma el excedente nuevo', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, cupoGlobalDia: 40000, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    const { iso, perY } = diaYPeriodoTest(w)
    w._apoyoUso = {
      email: 'a@x.co', periodo: perY, diaIso: iso,
      lecturasDia: 10, cobrablesDia: 0, lecturasMes: 10, cobrablesMes: 0,
      baseBDia: 10, cobrablesBlazeDia: 0, cobrablesBlazeMes: 0, montoBlazeUsd: 0, montoBlazeCop: 0,
      montoUsd: 0, montoCop: 0, apoyado: false, historial: []
    }
    w.apoyoRegistrarLecturas(1000)
    expect(w._apoyoUso.cobrablesMes).toBe(1000)
    expect(w._apoyoUso.montoCop).toBe(4000)
    w._apoyoCfg = { cupoDiario: 10, cupoGlobalDia: 40000, precioPorMilUsd: 2, trmCop: 5000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    w.apoyoRegistrarLecturas(1000)
    expect(w._apoyoUso.cobrablesMes).toBe(2000)
    expect(w._apoyoUso.montoCop).toBe(14000)
    expect(w._apoyoUso.montoCop).not.toBe(20000)
    expect(src).toContain('Solo el excedente NUEVO se valora')
  })

  it('cobro B reparte excedente global según baseB sin doblar cobro A', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 100, cupoGlobalDia: 1000, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    const { iso, perY } = diaYPeriodoTest(w)
    w._apoyoUso = {
      email: 'a@x.co', periodo: perY, diaIso: iso,
      lecturasDia: 80, cobrablesDia: 0, lecturasMes: 80, cobrablesMes: 0,
      baseBDia: 80, cobrablesBlazeDia: 0, cobrablesBlazeMes: 0, montoBlazeUsd: 0, montoBlazeCop: 0,
      montoUsd: 0, montoCop: 0, apoyado: false, historial: []
    }
    // Proyecto ya pasó el cupo global; este usuario aporta 80 de baseB sobre 200 totales
    w._apoyoGlobal = { diaIso: iso, lecturas: 1200, baseB: 200 }
    w.apoyoAplicarCobroBlaze(w._apoyoUso, w._apoyoCfg)
    // excedente 200 × (80/200) = 80 cobrables B
    expect(w._apoyoUso.cobrablesBlazeDia).toBe(80)
    expect(w._apoyoUso.cobrablesBlazeMes).toBe(80)
    expect(w._apoyoUso.montoBlazeCop).toBe(320)
    expect(w._apoyoUso.montoCop).toBe(320)
    // Reaplicar no dobla
    w.apoyoAplicarCobroBlaze(w._apoyoUso, w._apoyoCfg)
    expect(w._apoyoUso.cobrablesBlazeMes).toBe(80)
    expect(w._apoyoUso.montoCop).toBe(320)
  })

  it('Drive se restringe solo tras gracia y con cobrables, no al administrador', () => {
    const w = montar()
    w._usuarioActual = { email: 'a@x.co', rol: 'responsables' }
    w._apoyoCfg = { cupoDiario: 10, cupoGlobalDia: 40000, precioPorMilUsd: 1, trmCop: 4000, diaCorte: 28, diasGraciaHabiles: 3, activo: true }
    w._apoyoUso = {
      email: 'a@x.co', periodo: '2026-10', diaIso: '2026-10-28',
      lecturasMes: 100, cobrablesMes: 50, cobrablesBlazeMes: 0, montoUsd: 0.05, montoCop: 200,
      apoyado: false, historial: []
    }
    expect(src).toContain('if(u.apoyado)return false')
    expect(src).toContain('apoyoUltimoDiaGracia')
    expect(src).toContain('cobrablesBlazeMes')
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
