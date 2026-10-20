/**
 * Informe: reutilizar INF pendiente (mismo contrato/periodo) y no perder anexos
 * al corregir aún sin revisión / re-entregar desde Entregar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

describe('Informe: reusar INF y anexos para el encargado', () => {
  it('findTaskInformeContratoReusable encuentra Por verificar del mismo contrato', () => {
    const existentes = [{
      id: 'T1', codigo: 'INF-1', eliminada: false, responsable: 'Ana',
      estado: 'Por verificar',
      informeContrato: { numero: '272', n: 1, desde: '2026-09-14', hasta: '2026-10-13' },
      soportes: [{ id: 'a1', informe_act: { n: 1, nombre: 'CRONOGRAMA' }, es_anexo: true, driveFileId: 'F1' }]
    }]
    const c = createContext({
      actividadesLibres: existentes,
      agendaNorm: s => String(s || '').trim().toLowerCase(),
      taskUsuarioEsAsignado: (t, r) => String(t.responsable || '').toLowerCase() === String(r || '').toLowerCase(),
      estadoTask: t => t.estado,
      taskFirmaWfActiva: () => false
    })
    runInContext(extraer(er, ['findTaskInformeContratoReusable']), c)
    const hit = c.findTaskInformeContratoReusable(
      { numero: '272', n: 1, desde: '2026-09-14', hasta: '2026-10-13' },
      'Ana'
    )
    expect(hit && hit.id).toBe('T1')
    expect(c.findTaskInformeContratoReusable(
      { numero: '272', n: 2, desde: '2026-09-14', hasta: '2026-10-13' },
      'Ana'
    )).toBeNull()
  })

  it('ensureTaskInformeContrato reutiliza y no crea otro INF', () => {
    const src = extraer(er, ['ensureTaskInformeContrato'])
    expect(src).toContain('findTaskInformeContratoReusable')
    expect(src).toContain('reused:true')
    expect(extraer(er, ['submitEntregaResponsable'])).toContain('informeCorreccionPrecargar')
  })

  it('enviarTaskPorVerificar trata corrección voluntaria como reuso de anexos', () => {
    const src = extraer(core, ['enviarTaskPorVerificar'])
    expect(src).toContain('esCorrVoluntaria')
    expect(src).toMatch(/esNuevaEntrega&&\(esCorreccionDevuelta\|\|esCorrVoluntaria\)/)
  })

  it('soporteEsAnexoEntrega reconoce Act N e informe_act', () => {
    const c = createContext({})
    runInContext(extraer(core, ['soporteEsAnexoEntrega']), c)
    expect(c.soporteEsAnexoEntrega({ informe_act: { n: 2, nombre: 'X' } })).toBe(true)
    expect(c.soporteEsAnexoEntrega({ label: 'Act 5 — PQRSD · soporte 1' })).toBe(true)
    expect(c.soporteEsAnexoEntrega({ label: 'Documento principal' })).toBe(false)
  })
})
