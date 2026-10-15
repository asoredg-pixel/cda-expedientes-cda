/**
 * pqrsd-traslado-trazabilidad-consulta.test.js — Cuando una oficina traslada la PQRSD a otra, en Consulta ›
 * Actividades asignadas la actividad anterior aparece «Trasladada» (no «Eliminada») con fecha, hora,
 * oficina de origen, oficina destino y quién trasladó. Los traslados anteriores se reconstruyen con el
 * historial de la PQRSD.
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

const OFIS = { guaviare: 'NCA DEGUV', oap_deguv: 'OAP DEGUV', rn_deguv: 'RN DEGUV', secretaria: 'Secretaría DEGUV' }

function ctx(extra) {
  const c = createContext(Object.assign({
    hoy: () => '2026-10-15',
    normalizeTask: t => t,
    estadoTask: t => (t.eliminada ? 'Eliminada' : (t.estado || 'Por ejecutar')),
    estadoTaskLabel: t => (t.eliminada ? 'Eliminada' : (t.estado || 'Por ejecutar')),
    taskEstadoStyle: () => ({ bg: '#eee', fg: '#333' }),
    pqrsComentarioAutor: () => 'Ana Pérez',
    labelOficina: id => OFIS[id] || id || '',
    escAttr: s => String(s), fmtF: s => String(s || '').split('-').reverse().join('/'),
    hl: s => String(s),
    esModoCiudadano: () => false,
    taskChatComentariosCount: () => 0,
    taskCoEjecutorBtnHtml: () => '', taskEsMultiAsignada: () => false,
    taskChatBtnHtml: () => '', taskAgendaBtnHtml: () => '',
    TASK_HIST_DEVOLUCIONES: new Set(), TASK_HIST_FASE_LBL: {}
  }, extra || {}))
  runInContext(extraer(core, ['pqrsUltimoTrasladoOficina', 'cancelarTareasPqrsNca', 'taskTrasladoPqrsInfo', 'taskTrasladoPqrsTxt',
    'taskTrasladoPqrsLineaHtml', 'taskHistHoraTxt', 'taskHistLineaTxt', 'taskHistMismoMomento', 'taskHistOcultarComoDuplicado', 'renderTaskHistorialHtml', 'renderTaskConsultaItem']), c)
  return c
}

describe('Traslado entre oficinas: la actividad anterior guarda la trazabilidad', () => {
  const c = ctx()
  const e = {
    _exp: 'NB260227',
    _pqrs_historial: [{ tipo: 'traslado_oficina', fecha: '2026-10-15', nota: 'Reasignación por competencia', oficina: 'oap_deguv', oficinaAnterior: 'guaviare', por: 'NCA DEGUV' }],
    tasks: [{ id: 'T1', actividad: 'Oficio de respuesta', responsable: 'CARLOS ANDRES QUINTERO SANTOS', vence: '2026-10-03', historial: [] }]
  }
  const antes = Date.now()
  c.cancelarTareasPqrsNca(e, 'Traslado a OAP DEGUV — actividad anterior cancelada')
  const t = e.tasks[0]
  const h = t.historial[0]

  it('sigue fuera de pendientes (eliminada) como antes', () => {
    expect(t.eliminada).toBe(true)
    expect(h.tipo).toBe('cancelacion_traslado')
  })

  it('guarda hora exacta, origen, destino, quién y motivo', () => {
    expect(h.ts).toBeGreaterThanOrEqual(antes)
    expect(h.ofiDe).toBe('guaviare')
    expect(h.ofiA).toBe('oap_deguv')
    expect(h.trasladoPor).toBe('NCA DEGUV')
    expect(h.motivo).toBe('Reasignación por competencia')
  })

  it('Consulta: estado «Trasladada» (sin tachar) y línea con fecha, hora, origen y destino', () => {
    const html = c.renderTaskConsultaItem(e, t, '')
    expect(html).toContain('>Trasladada<')
    expect(html).not.toContain('>Eliminada<')
    expect(html).not.toContain('line-through')
    const hora = c.taskHistHoraTxt({ ts: h.ts })
    expect(html).toContain('15/10/2026 ' + hora + ' · ')
    expect(html).toContain('↪ Trasladada de NCA DEGUV a OAP DEGUV · por NCA DEGUV · Reasignación por competencia')
  })

  it('historial de la actividad (chat · historial) muestra el traslado legible', () => {
    expect(c.taskHistLineaTxt(h)).toBe('↪ Trasladada de NCA DEGUV a OAP DEGUV · por NCA DEGUV · Reasignación por competencia')
  })
})

describe('Traslados anteriores (sin datos en la actividad)', () => {
  const c = ctx()
  const e = {
    _exp: 'NB260227',
    _pqrs_historial: [
      { tipo: 'traslado_oficina', fecha: '2026-09-26', oficina: 'guaviare', oficinaAnterior: 'secretaria', por: 'Secretaría DEGUV' },
      { tipo: 'traslado_oficina', fecha: '2026-10-03', nota: 'Reasignación entre oficinas', oficina: 'rn_deguv', oficinaAnterior: 'guaviare', por: 'NCA DEGUV' }
    ]
  }
  const t = {
    id: 'T1', actividad: 'Oficio de respuesta', eliminada: true, vence: '2026-10-03',
    historial: [{ tipo: 'cancelacion_traslado', fecha: '2026-10-03', por: 'Ana Pérez', nota: 'Traslado a RN DEGUV — actividad anterior cancelada' }]
  }

  it('reconstruye origen, destino y quién con el historial de la PQRSD de esa fecha (solo fecha, sin hora)', () => {
    const html = c.renderTaskConsultaItem(e, t, '')
    expect(html).toContain('>Trasladada<')
    expect(html).toContain('03/10/2026 · ')
    expect(html).toContain('↪ Trasladada de NCA DEGUV a RN DEGUV · por NCA DEGUV · Reasignación entre oficinas')
  })

  it('sin registro en la PQRSD: usa el destino de la nota', () => {
    const info = c.taskTrasladoPqrsInfo({ _pqrs_historial: [] }, t)
    expect(c.taskTrasladoPqrsTxt(info)).toBe('↪ Trasladada a RN DEGUV · por Ana Pérez')
  })
})

describe('No cambia otras actividades', () => {
  const c = ctx()
  it('eliminada normal sigue «Eliminada» y tachada', () => {
    const t = { id: 'X', actividad: 'Visita', eliminada: true, historial: [{ tipo: 'eliminacion', fecha: '2026-10-01' }] }
    const html = c.renderTaskConsultaItem({ _exp: 'E1' }, t, '')
    expect(html).toContain('>Eliminada<')
    expect(html).toContain('line-through')
    expect(html).not.toContain('Trasladada')
  })
  it('actividad activa: sin cambios', () => {
    const t = { id: 'Y', actividad: 'Oficio de respuesta', responsable: 'PEDRO SALAZAR', estado: 'Vencida', historial: [] }
    const html = c.renderTaskConsultaItem({ _exp: 'E1' }, t, '')
    expect(html).toContain('>Vencida<')
    expect(html).not.toContain('Trasladada')
  })
  it('vista ciudadano: no muestra la trazabilidad interna', () => {
    const c2 = ctx({ esModoCiudadano: () => true, anonimizarParaCiudadano: s => s })
    const t = { id: 'T1', actividad: 'Oficio', eliminada: true, historial: [{ tipo: 'cancelacion_traslado', fecha: '2026-10-03', ofiDe: 'guaviare', ofiA: 'rn_deguv' }] }
    expect(c2.renderTaskConsultaItem({ _exp: 'E1' }, t, '')).not.toContain('Trasladada')
  })
})
