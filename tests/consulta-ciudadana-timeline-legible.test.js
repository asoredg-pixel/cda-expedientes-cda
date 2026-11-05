/**
 * consulta-ciudadana-timeline-legible.test.js — Línea de tiempo ciudadana:
 * sin nombres/emails de funcionarios, vinculaciones solo con número, un solo hito de cierre
 * y sin «actividad asignada» duplicada tras asignación de oficina.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')

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

function ctx() {
  const c = createContext({
    getAllResponsables: () => ['CARLOS ANDRES QUINTERO SANTOS', 'Marcela Chara'],
    DEPTOS: [{ id: 'guaviare' }],
    getInstructoresCfg: () => [{ nombre: 'ANA ARIAS' }],
    labelOficina: id => ({ guaviare: 'NCA DEGUV', juridica: 'Jurídica' }[id] || id || ''),
    esPqrsSecretaria: e => !!(e && (e._tramite === 'pqrs' || e._pqrs)),
    esTramitePqrs: t => t === 'pqrs',
    normalizeTask: t => t || {},
    estadoTask: t => t.estado || 'En ejecución',
    taskDocAprobadoCiudadano: t => !!(t && t.publicado),
    pqrsEstaCerrada: e => !!(e && e._cerrada),
    escAttr: s => String(s == null ? '' : s),
    fmtF: f => {
      const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
      return m ? m[3] + '/' + m[2] + '/' + m[1] : ''
    },
    String, Array, Object, JSON, RegExp, Error
  })
  runInContext(extraer(pqrs, [
    'anonimizarParaCiudadano', 'ciudadanoNumDesdeNotaAsoc', 'ciudadanoEventoLabel',
    'ciudadanoNotaPublica', 'ciudadanoTaskEventoLabel', 'ciudadanoTimelineClase',
    'ciudadanoTimelineDedupe', 'ciudadanoTimelineItems', 'ciudadanoTimelineHtml'
  ]), c)
  return c
}

describe('Consulta ciudadana — línea de tiempo legible', () => {
  it('caso de la imagen: sin nombres, vinculaciones con número, un solo cierre', () => {
    const c = ctx()
    const items = c.ciudadanoTimelineItems({
      _tramite: 'pqrs',
      _fecha_solicitud: '2026-10-24',
      _fecha: '2026-10-24',
      _pqrs_historial: [
        { tipo: 'radicacion', fecha: '2026-10-24', nota: '' },
        { tipo: 'traslado_oficina', fecha: '2026-10-27', oficina: 'guaviare', nota: '' },
        { tipo: 'asociacion_exp', fecha: '2026-10-28', nota: 'Vinculada al expediente PAF-00132-23 — CARLOS ANDRES QUINTERO SANTOS', por: 'CARLOS ANDRES QUINTERO SANTOS' },
        { tipo: 'asociacion_exp', fecha: '2026-10-28', nota: 'Vinculada al expediente PAF-00133-23 — CARLOS ANDRES QUINTERO SANTOS', por: 'CARLOS ANDRES QUINTERO SANTOS' },
        { tipo: 'asignacion_oficina', fecha: '2026-10-28', nota: 'Asignado a ANA ARIAS', a: 'ANA ARIAS' },
        { tipo: 'entrega_respuesta_nca', fecha: '2026-11-03', nota: 'Entrega de respuesta para revisión NCA (v1) — CARLOS ANDRES QUINTERO SANTOS' },
        { tipo: 'notificacion_correo', fecha: '2026-11-04', nota: 'Respuesta (mensaje) aprobada y enviada desde el correo institucional a admin@bosquesparalavidacolombia.org' },
        { tipo: 'revision_nca_aprobado', fecha: '2026-11-04', nota: 'Aprobado por CARLOS ANDRES QUINTERO SANTOS' },
        { tipo: 'revision_final_aprobada', fecha: '2026-11-04', nota: '' }
      ],
      tasks: [{
        estado: 'Atendida',
        publicado: true,
        fechaAtendida: '2026-11-04',
        historial: [
          { tipo: 'asignacion', fecha: '2026-10-28', por: 'CARLOS ANDRES QUINTERO SANTOS' },
          { tipo: 'verificacion', fecha: '2026-11-04', nota: 'Notificada — entrega' }
        ]
      }]
    })
    const labels = items.map(i => i.label)
    expect(labels).toEqual([
      'Solicitud presentada por el ciudadano',
      'Radicación de la solicitud',
      'Traslado a NCA DEGUV',
      'Vinculada al expediente PAF-00132-23',
      'Vinculada al expediente PAF-00133-23',
      'Asignación para atención',
      'Respuesta en proceso de revisión interna',
      'Respuesta notificada — solicitud atendida'
    ])
    const blob = JSON.stringify(items)
    expect(blob).not.toMatch(/CARLOS|QUINTERO|ANA ARIAS|admin@/i)
    expect(labels.filter(l => /notificada — solicitud atendida/i.test(l))).toHaveLength(1)
    expect(labels.some(l => /aprobada y publicada|en proceso de notificación|Actividad asignada/i.test(l))).toBe(false)
    expect(items.every(i => !i.nota)).toBe(true)
  })

  it('anonimiza nombres en MAYÚSCULAS y emails residuales', () => {
    const c = ctx()
    expect(c.anonimizarParaCiudadano('Vinculada al expediente PAF-00132-23 — CARLOS ANDRES QUINTERO SANTOS'))
      .toBe('Vinculada al expediente PAF-00132-23')
    expect(c.anonimizarParaCiudadano('Enviada a admin@bosquesparalavidacolombia.org')).toBe('Enviada a')
    expect(c.ciudadanoNotaPublica(
      { tipo: 'asociacion_exp' },
      'Vinculada al expediente PAF-00132-23 — CARLOS ANDRES QUINTERO SANTOS'
    )).toBe('')
  })

  it('trámites: estados y actividad publicada quedan; sin repetir cierre', () => {
    const c = ctx()
    const items = c.ciudadanoTimelineItems({
      _tramite: 'permiso',
      _fechas_estado: JSON.stringify({ Solicitud: '2026-01-10', 'En trámite': '2026-01-12' }),
      tasks: [{
        estado: 'Atendida',
        publicado: true,
        fechaAtendida: '2026-02-01',
        historial: [
          { tipo: 'asignacion', fecha: '2026-01-15' },
          { tipo: 'verificacion', fecha: '2026-02-01', nota: 'Notificada al interesado' }
        ]
      }]
    })
    const labels = items.map(i => i.label)
    expect(labels).toContain('Estado: Solicitud')
    expect(labels).toContain('Estado: En trámite')
    expect(labels).toContain('Actividad asignada para gestión')
    expect(labels.filter(l => /notificada — solicitud atendida/i.test(l))).toHaveLength(1)
    expect(labels.some(l => /aprobada y publicada/i.test(l))).toBe(false)
  })

  it('sin notificación aún: se conserva «en proceso de notificación» si es el único', () => {
    const c = ctx()
    const items = c.ciudadanoTimelineItems({
      _tramite: 'pqrs',
      _fecha: '2026-10-01',
      _pqrs_historial: [
        { tipo: 'radicacion', fecha: '2026-10-01' },
        { tipo: 'revision_nca_aprobado', fecha: '2026-10-05', nota: '' }
      ],
      tasks: []
    })
    expect(items.map(i => i.label)).toEqual([
      'Radicación de la solicitud',
      'Respuesta aprobada — en proceso de notificación'
    ])
  })
})
