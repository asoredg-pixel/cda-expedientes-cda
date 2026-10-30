/**
 * aprobar-cerrar-renombra-drive.test.js — Al «Aprobar y cerrar» / «Aprobar y notificar»
 * desde el panel unificado, los docs del workflow PQRSD deben renombrarse en Drive
 * (dejar de quedar como POR REVISAR).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

const PQRS_WF = {
  PENDIENTE_REVISION: 'pendiente_revision_nca',
  RECHAZADA: 'rechazada',
  CERRADA: 'cerrada'
}
const PQRS_WF_TIPO = { MENSAJE: 'mensaje', OFICIO: 'oficio', INFORMATIVA: 'informativa' }

function makeWfDoc(overrides) {
  return Object.assign({
    nombre: 'Documento de respuesta',
    driveFilename: 'POR REVISAR WE26453 RSP.pdf',
    driveEstado: 'revision',
    fileId: 'fid1',
    driveLink: 'https://drive.google.com/file/d/fid1/view'
  }, overrides || {})
}

function ctxCerrar(e, t, opts) {
  opts = opts || {}
  const renombres = []
  const calls = { cerrar: 0, verificar: 0, mensaje: 0, info: 0, fisico: 0 }
  const c = createContext({
    window: {},
    PQRS_WF,
    PQRS_WF_TIPO,
    renombres,
    hoy: () => '2026-10-19',
    getExpById: () => e,
    getTaskAny: () => t,
    getPqrsWorkflow: (ex) => {
      const w = ex && ex._pqrs_workflow
      if (!w) return {}
      return typeof w === 'string' ? JSON.parse(w) : w
    },
    setPqrsWorkflow: (ex, patch) => {
      const prev = typeof ex._pqrs_workflow === 'string' ? JSON.parse(ex._pqrs_workflow) : (ex._pqrs_workflow || {})
      ex._pqrs_workflow = Object.assign({}, prev, patch)
    },
    pqrsWorkflowFase: () => opts.fase || PQRS_WF.PENDIENTE_REVISION,
    pqrsEnRevisionNca: () => opts.enRev !== false,
    pqrsEstaCerrada: () => false,
    taskEsAtenderPqrs: () => true,
    collectTerminoCumplFromUi: () => null,
    liberarPorCorregirParaAprobacion: () => false,
    actividadEsRevisionFinalNotif: () => false,
    ncaAprobarMensajeSimple: () => { calls.mensaje++ },
    ncaAprobarInformativa: () => { calls.info++ },
    ncaAprobarCanalFisico: () => { calls.fisico++ },
    taskReviewCerrarPqrsAtendida: () => { calls.cerrar++; return true },
    verificarTaskExp: () => { calls.verificar++ },
    closeTaskModal: () => {},
    renderActividades: () => {},
    renderSecretariaPqrs: () => {},
    renderPqrsOficinaInbox: () => {},
    notif: () => {},
    driveRenameInstitutional: async (fid, name) => { renombres.push({ fid, name }); return true },
    _pqrsDocEsPorCorregir: () => false,
    confirmarCierreTask: () => { calls.cerrar++ }
  })
  runInContext(
    extraer(gmail, ['_driveNombreArchivoPlano', '_driveEstadoLegible']) + '\n' +
    extraer(core, [
      '_pqrsRenombrarDocsDriveWf',
      '_pqrsRenombrarDocsAlCerrarDesdeRevision',
      '_taskReviewDecidirAprobarRun',
      'confirmarCierreTaskReview'
    ]),
    c
  )
  c._calls = calls
  return c
}

describe('Aprobar y cerrar / notificar: renombre Drive PQRSD', () => {
  it('oficio en Por revisar: renombra a APROBADO antes de cerrar', async () => {
    const docs = [makeWfDoc()]
    const e = {
      _exp: 'WE26453',
      _pqrs_workflow: { fase: PQRS_WF.PENDIENTE_REVISION, tipo: PQRS_WF_TIPO.OFICIO, documentos: docs, cuerpo: 'x' }
    }
    const t = { id: 't1', actividad: 'Oficio de respuesta' }
    const c = ctxCerrar(e, t)
    await c._taskReviewDecidirAprobarRun('WE26453', 't1')
    expect(c._calls.cerrar).toBe(1)
    expect(c._calls.mensaje).toBe(0)
    expect(c.renombres.length).toBe(1)
    expect(c.renombres[0].name).toMatch(/^AP /i)
    expect(docs[0].driveEstado).toBe('aprobado')
    expect(docs[0].driveFilename).toMatch(/^AP /i)
  })

  it('mensaje sigue yendo a ncaAprobarMensajeSimple (sin cerrar directo)', async () => {
    const docs = [makeWfDoc()]
    const e = {
      _exp: 'WE26453',
      _pqrs_workflow: { fase: PQRS_WF.PENDIENTE_REVISION, tipo: PQRS_WF_TIPO.MENSAJE, documentos: docs }
    }
    const c = ctxCerrar(e, { id: 't1' })
    await c._taskReviewDecidirAprobarRun('WE26453', 't1')
    expect(c._calls.mensaje).toBe(1)
    expect(c._calls.cerrar).toBe(0)
    expect(c.renombres.length).toBe(0)
  })

  it('helper al notificar usa estado atendido → prefijo APROBADO', async () => {
    const docs = [makeWfDoc({ driveFilename: 'POR REVISAR V2 WE26453 RSP.pdf', entrega_n: 2 })]
    const e = { _exp: 'WE26453', _pqrs_workflow: { documentos: docs } }
    const c = ctxCerrar(e, { id: 't1' })
    await c._pqrsRenombrarDocsAlCerrarDesdeRevision(e, 'atendido')
    expect(c.renombres[0].name).toMatch(/^AP V2 /i)
    expect(docs[0].driveEstado).toBe('atendido')
  })

  it('no renombra docs que ya no están en revision', async () => {
    const docs = [
      makeWfDoc({ fileId: 'a', driveEstado: 'por_firmar', driveFilename: 'POR FIRMAR WE26453 RSP.pdf' }),
      makeWfDoc({ fileId: 'b', driveEstado: 'revision', driveFilename: 'POR REVISAR WE26453 A01.pdf' })
    ]
    const e = { _exp: 'WE26453', _pqrs_workflow: { documentos: docs } }
    const c = ctxCerrar(e, { id: 't1' })
    await c._pqrsRenombrarDocsAlCerrarDesdeRevision(e, 'aprobado')
    expect(c.renombres.length).toBe(1)
    expect(c.renombres[0].fid).toBe('b')
    expect(docs[0].driveEstado).toBe('por_firmar')
    expect(docs[1].driveEstado).toBe('aprobado')
  })

  it('trámite no-PQRSD: no invoca renombre de workflow', async () => {
    const c = ctxCerrar(null, { id: 't1' }, { enRev: false })
    c.getExpById = () => null
    await c._taskReviewDecidirAprobarRun('E1', 't1')
    expect(c.renombres.length).toBe(0)
    expect(c._calls.cerrar).toBe(1)
  })

  it('taskReviewConfirmarYNotificar (PQRSD) llama el helper de renombre antes de cerrar', () => {
    const src = extraer(core, ['taskReviewConfirmarYNotificar'])
    expect(src).toContain("_pqrsRenombrarDocsAlCerrarDesdeRevision(e,'atendido')")
    expect(src.indexOf("_pqrsRenombrarDocsAlCerrarDesdeRevision")).toBeLessThan(
      src.indexOf('taskReviewCerrarPqrsAtendida(e,{')
    )
  })
})
