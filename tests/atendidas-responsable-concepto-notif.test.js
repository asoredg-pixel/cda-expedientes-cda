/**
 * El responsable que entregó al profesional ve la actividad en Atendidas cuando NCA aprueba.
 * Al notificar, el enlace y Archivos usan el concepto, no el soporte de envío, y el número no queda «No. No.».
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

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

describe('Número y asunto sin «No. No.»', () => {
  it('quita el prefijo ya digitado', () => {
    const c = createContext({
      window: {},
      taskReviewNumeroDocumentoAct: (e, t) => t.concepto || '',
      soporteEsDocRadicacion: () => false
    })
    runInContext(extraer(core, ['numeroDocSinPrefijoNo', 'asuntoNotificacionActividad', 'taskDocNombrePublico']), c)
    expect(c.taskDocNombrePublico({}, { actividad: 'Concepto de seguimiento', concepto: 'No. CT26588' }))
      .toBe('Concepto de seguimiento No. CT26588')
    expect(c.asuntoNotificacionActividad('Concepto Técnico', 'No. CT26588', 'CAS-00020-22'))
      .toBe('Notificación — Concepto Técnico No. CT26588 — CAS-00020-22')
  })
})

describe('Aprobar y notificar conserva el concepto', () => {
  it('el soporte de envío no desplaza ni borra el concepto POR REVISAR', () => {
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && s.es_anexo),
      soporteEsDocRadicacion: () => false
    })
    runInContext(extraer(core, ['soporteEsPorCorregir', 'esSoporteEnvioCorreoItem', 'limpiarSoportesPorCorregirTask']), c)
    const concepto = {
      id: 'con', driveFileId: 'CONCEPTO',
      driveFilename: 'POR REVISAR V3 CAS-00020-22 CONCEPTO.pdf',
      driveEstado: 'revision', activo: true, loteEntrega: 'lot1'
    }
    const soporte = {
      id: 'sop', tipo: 'soporte_notificacion', driveEstado: 'notificado',
      label: 'Soporte envío — Concepto de seguimiento No. CT26588',
      driveFileId: 'SOP', activo: true
    }
    const t = { soportes: [concepto, soporte] }
    const trash = c.limpiarSoportesPorCorregirTask(t)
    expect(t.soportes.map(s => s.id)).toEqual(['con', 'sop'])
    expect(trash.map(s => s.id)).toEqual([])
  })

  it('el correo enlaza el concepto vigente, no un archivo notificado viejo', () => {
    const c = createContext({
      soportesVisiblesParaVista: t => t.soportes || [],
      soporteEsAnexoEntrega: s => !!(s && s.es_anexo),
      taskDocNombrePublico: () => 'Concepto de seguimiento No. CT26588'
    })
    runInContext(extraer(core, ['soporteEsDocRadicacion', 'esSoporteEnvioCorreoItem', 'soporteEsDocumentoNotificado',
      'collectDocsParaNotificacionCorreo']) + '\nthis._f=collectDocsParaNotificacionCorreo;', c)
    const t = { id: 't', soportes: [
      { id: 'viejo', fileId: 'VIEJO', url: 'https://drive/viejo', driveEstado: 'notificado', tipo: 'soporte_notificacion', label: 'Soporte envío', activo: true },
      { id: 'con', fileId: 'CONCEPTO', url: 'https://drive/concepto', driveFilename: 'POR REVISAR V3.pdf', driveEstado: 'revision', activo: true }
    ] }
    const out = c._f(null, t)
    expect(out.map(d => d.id)).toEqual(['con'])
    expect(out[0].fileId).toBe('CONCEPTO')
  })
})

describe('Atendidas del responsable que entregó al profesional', () => {
  function ctx(exps, yo) {
    const c = createContext({
      exps, responsableActivo: yo,
      esModoResponsable: () => true,
      agendaNorm: s => String(s || '').trim().toUpperCase(),
      taskEsMultiAsignada: () => false,
      estadoTask: t => t.estado,
      normalizeTask: t => t,
      taskUsuarioEsAsignado: (t, u) => String(t.responsable || '').toUpperCase() === String(u || '').toUpperCase(),
      estadoTaskForAsignado: (t, u) => String(t.responsable || '').toUpperCase() === String(u || '').toUpperCase() ? t.estado : 'En ejecución',
      getNom: () => '', getTram: () => ({ nombre: '' })
    })
    runInContext(extraer(core, ['taskRevParAprobadaInfo', 'taskRevParTecnicoAprobada', 'taskTieneRevisionPar',
      'getTareasRevParTecnicoAprobadas']), c)
    return c
  }
  const base = {
    id: 't1', actividad: 'Concepto de seguimiento', responsable: 'PROFESIONAL',
    fechaAtendida: '2026-10-27',
    ultimaRevisionDepto: { tipo: 'aprobada', fecha: '2026-10-27' },
    historial: [
      { tipo: 'traslado', fecha: '2026-10-22', de: 'TECNICO', a: 'PROFESIONAL', revisionPar: 'solicitud' },
      { tipo: 'traslado', fecha: '2026-10-26', de: 'PROFESIONAL', a: 'OTRO' },
      { tipo: 'verificacion', fecha: '2026-10-27', por: 'ENCARGADO NCA' }
    ]
  }

  it('aparece aunque el último traslado ya no sea la revisión par y el estado global no diga Atendida', () => {
    const t = Object.assign({}, base, { estado: 'En ejecución' })
    const lst = ctx([{ _exp: 'CAS-00020-22', tasks: [t] }], 'TECNICO').getTareasRevParTecnicoAprobadas()
    expect(lst.map(x => x.id)).toEqual(['t1'])
  })

  it('si sigue por verificar, el técnico no la ve en Atendidas', () => {
    const t = Object.assign({}, base, { estado: 'Por verificar', fechaAtendida: '', ultimaRevisionDepto: null })
    expect(ctx([{ _exp: 'CAS-00020-22', tasks: [t] }], 'TECNICO').getTareasRevParTecnicoAprobadas()).toEqual([])
  })
})

describe('Archivos abre el concepto, no el soporte', () => {
  it('elige el documento de la actividad antes que el soporte de envío', () => {
    const c = createContext({})
    runInContext(extraer(consulta, ['conArchivosIndicePreferido']), c)
    const items = [
      { taskId: 't1', tipoDoc: 'Soporte envío', label: 'Concepto de seguimiento' },
      { taskId: 't1', tipoDoc: 'Documento', label: 'Concepto de seguimiento' }
    ]
    expect(c.conArchivosIndicePreferido(items, 't1')).toBe(1)
    expect(c.conArchivosIndicePreferido(items, null)).toBe(1)
  })
})
