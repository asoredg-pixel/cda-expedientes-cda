/**
 * pqrsd-trazabilidad-hora-emojis.test.js — La trazabilidad de la PQRSD se ve como la de las actividades:
 * «fecha hora · emoji evento · quién». Los eventos nuevos guardan la hora (ts); los anteriores muestran solo la fecha.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

const OFIS = { guaviare: 'NCA DEGUV', secretaria: 'Secretaría DEGUV' }
const c = createContext({
  normalizePqrsOficinaFields: e => e,
  medioNotificacionFlagHtml: () => '<span>Correo</span>',
  labelOficina: id => OFIS[id] || id || '',
  escAttr: s => String(s),
  fmtF: s => String(s || '').slice(0, 10).split('-').reverse().join('/')
})
runInContext(extraer(core, ['pqrsHistorialEventoLabel', 'pqrsHistHoraTxt', 'pqrsHistEmoji', 'renderPqrsTrazabilidadHtml']), c)

const ts = (fecha, h, m) => { const [y, mo, d] = fecha.split('-').map(Number); return new Date(y, mo - 1, d, h, m).getTime() }

describe('Trazabilidad PQRSD con hora y emojis (como actividades)', () => {
  const e = {
    _fecha: '2026-09-11',
    _pqrs_historial: [
      { tipo: 'radicacion', fecha: '2026-09-11', nota: 'Radicado por Secretaría DEGUV' },
      { tipo: 'traslado_oficina', fecha: '2026-09-11', nota: 'Asignada a oficina competente', oficina: 'guaviare', oficinaAnterior: 'secretaria', por: 'MARCELA CHARA' },
      { tipo: 'entrega_respuesta_nca', fecha: '2026-09-11', nota: 'Entrega de respuesta para revisión NCA (v1) · Oficio E261395 — MARCELA CHARA' },
      { ts: ts('2026-10-15', 10, 45), tipo: 'revision_nca_aprobado_oficio', fecha: '2026-10-15', nota: 'NCA aprobó oficio — pasa a «Por firmar» · Notificará: LINA BELTRAN', por: 'CARLOS ANDRES QUINTERO SANTOS' },
      { ts: ts('2026-10-15', 9, 5), tipo: 'impreso_oficio', fecha: '2026-10-15', nota: 'Marcado como impreso', por: 'CARLOS ANDRES QUINTERO SANTOS' }
    ]
  }
  const html = c.renderPqrsTrazabilidadHtml(e)
  const lineas = html.split('pqrs-tl-line').slice(1)
  const hora = (h, m) => new Date(2026, 9, 15, h, m).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })

  it('una línea por evento: fecha · emoji evento · quién', () => {
    expect(lineas.length).toBe(5)
    expect(lineas[0]).toContain('11/09/2026</span> · 📥 Radicación de la solicitud')
    expect(lineas[1]).toContain('↪ Traslado: Secretaría DEGUV → NCA DEGUV · Motivo: Asignada a oficina competente')
    expect(lineas[1]).toContain(' · MARCELA CHARA')
  })

  it('«Actualización» ya no se antepone: se muestra el evento con su emoji', () => {
    expect(html).not.toContain('Actualización')
    expect(lineas[2]).toContain('📤 Entrega de respuesta para revisión NCA (v1)')
  })

  it('no repite quién si ya va en el texto', () => {
    expect((lineas[2].match(/MARCELA CHARA/g) || []).length).toBe(1)
  })

  it('eventos nuevos muestran la hora y se ordenan por hora en el mismo día', () => {
    expect(lineas[3]).toContain('15/10/2026 ' + hora(9, 5) + '</span> · 🖨 Marcado como impreso')
    expect(lineas[4]).toContain('15/10/2026 ' + hora(10, 45) + '</span> · ✓ NCA aprobó oficio')
    expect(lineas[4]).toContain('· CARLOS ANDRES QUINTERO SANTOS')
  })

  it('eventos anteriores (sin hora guardada): solo la fecha', () => {
    expect(lineas[0]).toMatch(/>11\/09\/2026<\/span>/)
  })

  it('fecha de respuesta anterior al día del registro: no inventa hora', () => {
    expect(c.pqrsHistHoraTxt({ ts: ts('2026-10-15', 11, 0), fecha: '2026-10-10' })).toBe('')
  })

  it('emojis de devoluciones, firma y notificación', () => {
    expect(c.pqrsHistEmoji({ tipo: 'revision_nca_rechazado' })).toBe('↩')
    expect(c.pqrsHistEmoji({ tipo: 'firma_director' })).toBe('✍️')
    expect(c.pqrsHistEmoji({ tipo: 'notif_reportada_revision' })).toBe('📨')
    expect(c.pqrsHistEmoji({ tipo: 'notificacion_correo' })).toBe('📧')
  })
})

describe('Los eventos nuevos de la PQRSD guardan la hora', () => {
  it('todo _pqrs_historial.push({...}) incluye ts', () => {
    const dir = resolve(root, 'js')
    const sin = []
    readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
      readFileSync(resolve(dir, f), 'utf8').split('\n').forEach((l, i) => {
        if (/_pqrs_historial\.push\(\{/.test(l) && !/ts: ?Date\.now\(\)/.test(l)) sin.push(f + ':' + (i + 1))
      })
    })
    expect(sin).toEqual([])
  })
})
