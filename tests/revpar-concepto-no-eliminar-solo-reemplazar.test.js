/**
 * revpar-concepto-no-eliminar-solo-reemplazar.test.js —
 * En el ciclo concepto responsable↔profesional el responsable no elimina la entrega
 * (Por revisar del técnico ni Por corregir): conserva historial. Puede reemplazar
 * el documento mientras el profesional no revisa. Entregas directas al NCA no cambian.
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

const norm = s => String(s || '').trim().toLowerCase()

function ctxBase(extra) {
  const c = createContext(Object.assign({
    console, JSON, String, Number, Math, Date, Array, Object,
    responsableActivo: 'Ana',
    esModoResponsable: () => true,
    esVistaActividadesDepto: () => false,
    esAdministrador: () => false,
    esJurisdiccional: () => false,
    puedeGestionarActividadesDepto: () => false,
    agendaNorm: norm,
    estadoTask: t => t.estado,
    taskEsMultiAsignada: t => (t.responsables || []).length > 1,
    taskUsuarioEsAsignado: (t, u) => norm(t.responsable) === norm(u),
    getExpById: () => null,
    getTaskAny: (expId, taskId) => c._task && String(c._task.id) === String(taskId) ? c._task : null,
    taskFirmaWfActiva: () => false,
    taskEnFlujoFirmaTramite: () => false,
    taskPendienteVerificacion: t => String(t && t.estado || '') === 'Por verificar',
    getTaskRevisionDepto: () => null,
    taskEsAtenderPqrs: () => false,
    taskPuedeCorregirSinRevision: t => String(t && t.estado || '') === 'Por verificar',
    notif: () => {},
  }, extra || {}))
  c.escAttr = s => String(s || '')
  runInContext(extraer(core, [
    'taskRevisionParCtx', 'taskRevisionParCerradaPorRetiro', 'taskEsFlujoRevisionParConceptoActivo',
    'taskRevParParticipante', 'taskRevParTecnicoEsperando', 'taskRevParTecnicoPuedeReemplazar',
    'taskRevParTecnicoPuedeEliminar', 'puedeEliminarEntregaActividad', 'taskHistLineaTxt',
  ]), c)
  return c
}

function tareaEnProfesional() {
  return {
    id: 't1', exp: 'PAF-1', actividad: 'Concepto de Evaluación',
    responsable: 'Liliana', responsables: ['Liliana'],
    estado: 'En ejecución', fechaReportada: '',
    historial: [
      { tipo: 'asignacion', por: 'Carlos' },
      { tipo: 'traslado', revisionPar: 'solicitud', de: 'Ana', a: 'Liliana', por: 'Ana', ts: 1 },
    ],
  }
}

function tareaPorCorregir() {
  return {
    id: 't1', exp: 'PAF-1', actividad: 'Concepto de Evaluación',
    responsable: 'Ana', responsables: ['Ana'],
    estado: 'Por corregir', fechaReportada: '',
    historial: [
      { tipo: 'traslado', revisionPar: 'solicitud', de: 'Ana', a: 'Liliana', por: 'Ana', ts: 1 },
      { tipo: 'traslado', revisionPar: 'devolucion', de: 'Liliana', a: 'Ana', por: 'Liliana', ts: 2 },
    ],
  }
}

function tareaDirectaNca() {
  return {
    id: 't2', exp: 'PAF-1', actividad: 'Oficio',
    responsable: 'Ana', responsables: ['Ana'],
    estado: 'Por verificar', fechaReportada: '2026-11-25',
    historial: [{ tipo: 'reenvio_verificacion', por: 'Ana', ts: 1 }],
  }
}

describe('Revisión par concepto: no eliminar, sí reemplazar', () => {
  it('ciclo activo: responsable no puede eliminar en Por revisar (fase profesional)', () => {
    const c = ctxBase()
    c._task = tareaEnProfesional()
    c.responsableActivo = 'Ana'
    expect(c.taskEsFlujoRevisionParConceptoActivo(c._task, null)).toBe(true)
    expect(c.taskRevParTecnicoPuedeEliminar(c._task, 'Ana', null)).toBe(false)
    expect(c.puedeEliminarEntregaActividad('PAF-1', 't1')).toBe(false)
    expect(c.taskRevParTecnicoPuedeReemplazar(c._task, 'Ana', null)).toBe(true)
  })

  it('ciclo activo Por corregir (devolución): responsable no elimina; NCA sí vía no-responsable', () => {
    const c = ctxBase()
    c._task = tareaPorCorregir()
    c.responsableActivo = 'Ana'
    expect(c.taskEsFlujoRevisionParConceptoActivo(c._task, null)).toBe(true)
    expect(c.puedeEliminarEntregaActividad('PAF-1', 't1')).toBe(false)

    const nca = ctxBase({
      esModoResponsable: () => false,
      esVistaActividadesDepto: () => true,
      puedeGestionarActividadesDepto: () => true,
      responsableActivo: '',
    })
    nca._task = tareaPorCorregir()
    expect(nca.puedeEliminarEntregaActividad('PAF-1', 't1')).toBe(true)
  })

  it('entrega directa al encargado (sin rev par): el responsable sí puede eliminar', () => {
    const c = ctxBase()
    c._task = tareaDirectaNca()
    expect(c.taskEsFlujoRevisionParConceptoActivo(c._task, null)).toBe(false)
    expect(c.puedeEliminarEntregaActividad('PAF-1', 't2')).toBe(true)
  })

  it('historial: cancelada se etiqueta sin «Traslado ANA→ANA»', () => {
    const c = ctxBase()
    const txt = c.taskHistLineaTxt({
      tipo: 'traslado', revisionPar: 'cancelada', de: 'Ana', a: 'Ana', por: 'Ana',
      nota: 'Entrega retirada — revisión par cerrada',
    })
    expect(txt).toMatch(/Revisión del profesional cerrada/)
    expect(txt).not.toMatch(/Traslado/)
  })

  it('toolbar: usa Reemplazar documento, no Eliminar entrega en rev par', () => {
    const fn = extraer(core, ['renderActRowToolbarHtml'])
    expect(fn).toMatch(/abrirReemplazarDocumentoRevPar/)
    expect(fn).toMatch(/Reemplazar documento: sigue en revisión del profesional/)
    expect(fn).not.toMatch(/Eliminar entrega: sale de la revisión del profesional/)
  })
})
