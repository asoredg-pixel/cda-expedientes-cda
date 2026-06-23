/**
 * utils.test.js — Tests para js/utils.js
 * Cubre: fechas, strings, validación, HTML escaping y sanitización XSS.
 *
 * Firmas reales (verificadas en la fuente):
 *   dias(f)                 — días desde `f` hasta hoy (un solo argumento)
 *   fmtF(f)                 — YYYY-MM-DD → DD/MM/YYYY; retorna '-' para vacío
 *   diffDias(fecha)         — días entre hoy y `fecha` (positivo = futuro)
 *   agendaNorm(s)           — trim + toLowerCase (sin desnormalización de tildes)
 *   jsStr(v)                — escapa \ y ' (no escapa ")
 *   escAttr(v)              — escapa & " ' < (no escapa >)
 *   emailValido(v)          — true para null/'' (campo opcional); false para mal formato
 *   sanitizeStringField(key, val, ctx) — tres argumentos
 */

import { describe, it, expect } from 'vitest'
import { sst } from './helpers/ctx.js'

const {
  hoy, dias, fmtF, diffDias,
  agendaNorm, jsStr,
  escAttr, escTextarea,
  emailValido,
  sanitizeStringField,
  isQuotaExceededError,
} = sst

// ---------------------------------------------------------------------------
// hoy()
// ---------------------------------------------------------------------------
describe('hoy()', () => {
  it('devuelve formato YYYY-MM-DD', () => {
    expect(hoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('fecha corresponde al día actual', () => {
    const now = new Date()
    const expected = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    expect(hoy()).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// fmtF(f)  — retorna '-' para vacío o formato inválido
// ---------------------------------------------------------------------------
describe('fmtF(d)', () => {
  it('formatea YYYY-MM-DD como DD/MM/YYYY', () => {
    expect(fmtF('2024-06-15')).toBe('15/06/2024')
  })

  it('retorna "-" para valor falsy (comportamiento de la fuente)', () => {
    expect(fmtF('')).toBe('-')
    expect(fmtF(null)).toBe('-')
    expect(fmtF(undefined)).toBe('-')
  })

  it('maneja fecha con un solo dígito en día/mes', () => {
    expect(fmtF('2024-01-05')).toBe('05/01/2024')
  })

  it('retorna "-" para formato inválido', () => {
    expect(fmtF('no-es-fecha')).toBe('-')
  })
})

// ---------------------------------------------------------------------------
// dias(f)  — días desde `f` hasta hoy (un solo arg)
// ---------------------------------------------------------------------------
describe('dias(f)', () => {
  it('fecha de ayer devuelve 1', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const f = ayer.toISOString().slice(0, 10)
    expect(dias(f)).toBe(1)
  })

  it('fecha de hace 10 días devuelve 10', () => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    expect(dias(d.toISOString().slice(0, 10))).toBe(10)
  })

  it('devuelve 0 para la fecha de hoy', () => {
    expect(dias(hoy())).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// diffDias(fecha)  — días entre hoy y `fecha` (positivo = futuro)
// ---------------------------------------------------------------------------
describe('diffDias(fecha)', () => {
  it('hoy devuelve 0', () => {
    expect(Math.abs(diffDias(hoy()))).toBeLessThan(2)
  })

  it('fecha pasada devuelve número negativo', () => {
    const pasado = new Date()
    pasado.setDate(pasado.getDate() - 30)
    const d = diffDias(pasado.toISOString().slice(0, 10))
    expect(d).toBeLessThan(0)
  })

  it('fecha futura devuelve número positivo', () => {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 30)
    const d = diffDias(futuro.toISOString().slice(0, 10))
    expect(d).toBeGreaterThan(0)
  })

  it('devuelve string vacío para undefined', () => {
    expect(diffDias(undefined)).toBe('')
    expect(diffDias('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// agendaNorm(s)  — trim + toLowerCase (sin desnormalización de tildes en la fuente)
// ---------------------------------------------------------------------------
describe('agendaNorm(s)', () => {
  it('convierte a minúsculas', () => {
    expect(agendaNorm('JUAN')).toBe('juan')
    expect(agendaNorm('María')).toBe('maría')
  })

  it('elimina espacios extremos', () => {
    expect(agendaNorm('  hola  ')).toBe('hola')
  })

  it('maneja string vacío y null', () => {
    expect(agendaNorm('')).toBe('')
    expect(agendaNorm(null)).toBe('')
    expect(agendaNorm(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// jsStr(v)  — escapa \ y ' (usa comillas simples en plantillas HTML)
// ---------------------------------------------------------------------------
describe('jsStr(v)', () => {
  it('escapa comillas simples', () => {
    expect(jsStr("it's")).toContain("\\'")
  })

  it('escapa barras invertidas', () => {
    expect(jsStr('path\\file')).toContain('\\\\')
  })

  it('devuelve string vacío para null/undefined', () => {
    expect(jsStr(null)).toBe('')
    expect(jsStr(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// escAttr(v)  — escapa & " ' < (NO escapa > por diseño de la fuente)
// ---------------------------------------------------------------------------
describe('escAttr(v)', () => {
  it('escapa & < " \'', () => {
    expect(escAttr('a&b')).toBe('a&amp;b')
    expect(escAttr('<tag')).toBe('&lt;tag')
    expect(escAttr('"val"')).toBe('&quot;val&quot;')
    expect(escAttr("O'Brien")).toBe("O&#39;Brien")
  })

  it('no escapa > (comportamiento de la fuente)', () => {
    expect(escAttr('a>b')).toBe('a>b')
  })

  it('devuelve string vacío para valores falsy', () => {
    expect(escAttr(null)).toBe('')
    expect(escAttr(undefined)).toBe('')
    expect(escAttr('')).toBe('')
  })

  it('convierte números a string', () => {
    expect(escAttr(42)).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// escTextarea(v)
// ---------------------------------------------------------------------------
describe('escTextarea(v)', () => {
  it('escapa cierre de textarea para evitar XSS', () => {
    const input  = '</textarea><script>alert(1)</script>'
    const result = escTextarea(input)
    expect(result).not.toContain('</textarea>')
  })

  it('escapa <', () => {
    expect(escTextarea('<div>')).toContain('&lt;')
  })

  it('devuelve string vacío para null', () => {
    expect(escTextarea(null)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// emailValido(v)  — true para null/'' (campo opcional); regex para strings
// ---------------------------------------------------------------------------
describe('emailValido(v)', () => {
  it('acepta emails con formato correcto', () => {
    expect(emailValido('user@example.com')).toBe(true)
    expect(emailValido('admin@cda.gov.co')).toBe(true)
  })

  it('acepta null y vacío (campo opcional en la fuente)', () => {
    expect(emailValido('')).toBe(true)
    expect(emailValido(null)).toBe(true)
  })

  it('rechaza emails con formato incorrecto', () => {
    expect(emailValido('noatsign')).toBe(false)
    expect(emailValido('@nodomain')).toBe(false)
    expect(emailValido('nolocal@')).toBe(false)
    expect(emailValido('a@b')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// sanitizeStringField(key, val, ctx)  — tres argumentos
// ---------------------------------------------------------------------------
describe('sanitizeStringField(key, val, ctx)', () => {
  it('conserva texto plano sin modificarlo', () => {
    const plain = 'Expediente 2024-001'
    expect(sanitizeStringField('_tramite', plain, 'test')).toBe(plain)
  })

  it('devuelve val sin cambios para null/no-string (pasa through)', () => {
    expect(sanitizeStringField('k', null, 'ctx')).toBeNull()
    expect(sanitizeStringField('k', undefined, 'ctx')).toBeUndefined()
  })

  it('elimina etiquetas HTML de strings', () => {
    const result = sanitizeStringField('_detalle', '<b>Hola</b> mundo', 'test')
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('</b>')
  })

  it('preserva campos que parecen URLs (no sanitiza)', () => {
    const url = 'https://example.com/doc.pdf'
    const result = sanitizeStringField('_url_soporte', url, 'test')
    expect(result).toBe(url)
  })
})

// ---------------------------------------------------------------------------
// isQuotaExceededError(e)
// ---------------------------------------------------------------------------
describe('isQuotaExceededError(e)', () => {
  it('detecta QuotaExceededError por nombre', () => {
    const err = new Error('QuotaExceededError')
    err.name = 'QuotaExceededError'
    expect(isQuotaExceededError(err)).toBe(true)
  })

  it('devuelve false para errores ordinarios', () => {
    expect(isQuotaExceededError(new Error('Network error'))).toBe(false)
    expect(isQuotaExceededError(null)).toBe(false)
  })
})
