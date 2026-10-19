/**
 * profesional-versiones-proy-tabs.test.js — Al recibir un concepto corregido (revisión par),
 * el profesional en Por ejecutar debe ver las pestañas Proy. v1 · corregir / Proy. v2 · activa
 * (no filtrar con soloAprobados).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
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

describe('Profesional: pestañas Proy. v1/v2 tras corrección', () => {
  it('openTaskCommentsModal no aplica soloAprobados si hay corrección recibida (revPar)', () => {
    const src = extraer(core, ['openTaskCommentsModal'])
    expect(src).toContain('taskRevParCorreccionRecibida')
    expect(src).toContain('esRevParCorrRecibida')
    expect(src).toContain('!esRevParCorrRecibida')
    // soloAprobados del panel debe excluir el caso de corrección al profesional
    expect(src).toMatch(/soloAprobados:!!\([\s\S]*!esRevParCorrRecibida/)
  })

  it('soportesVisiblesParaVista incluye versión por corregir si no es soloAprobados', () => {
    const c = createContext({
      window: {},
      soporteEsPorCorregir: s => !!(s && (s.version_historial || /por corregir/i.test(String(s.label || '')))),
      soporteTieneVista: () => true,
      soporteEsAnexoEntrega: () => false,
      soporteEsDocumentoFirmado: () => false,
      soporteEsDocumentoNotificado: () => false,
      soporteEsDocRadicacion: () => false,
      getExpById: () => null,
      pqrsWorkflowFase: () => '',
      taskFirmaFase: () => '',
      pqrsEstaCerrada: () => false,
      estadoTask: () => '',
      taskFirmaEnPorNotificar: () => false,
      taskFirmaEnRevisionFinalNotif: () => false,
      PQRS_WF: {}
    })
    runInContext(extraer(core, ['soportesVisiblesParaVista']), c)
    const t = {
      soportes: [
        { id: 'v1', label: 'Concepto · por corregir', version: 1, version_historial: true, activo: false, url: 'u1' },
        { id: 'v2', label: 'Concepto', version: 2, activo: true, url: 'u2' }
      ]
    }
    expect(c.soportesVisiblesParaVista(t, { soloAprobados: true }).map(s => s.id)).toEqual(['v2'])
    expect(c.soportesVisiblesParaVista(t, {}).map(s => s.id)).toEqual(['v1', 'v2'])
  })

  it('soporteTabLabel marca corregir / activa', () => {
    const c = createContext({
      window: {},
      soporteEsAnexoEntrega: () => false,
      soporteEsDocumentoNotificado: () => false,
      soporteEsDocumentoFirmado: () => false,
      soporteEsPorCorregir: s => !!(s && (s.version_historial || /por corregir/i.test(String(s.label || ''))))
    })
    runInContext(extraer(core, ['soporteTabLabel']), c)
    const list = [
      { id: 'v1', label: 'x · por corregir', version: 1, version_historial: true, activo: false },
      { id: 'v2', label: 'x', version: 2, activo: true, es_proyeccion: true }
    ]
    expect(c.soporteTabLabel(list[0], 0, list)).toBe('Proy. v1 · corregir')
    expect(c.soporteTabLabel(list[1], 1, list)).toBe('Proy. v2 · activa')
  })
})
