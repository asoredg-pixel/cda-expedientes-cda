/**
 * cargar-documento-pasar-imprimir.test.js — Por revisar: 📤 «Cargar documento» (antes «Cargar documento firmado»)
 * con opción «Cargar y pasar para Imprimir»: reemplaza el principal del responsable, conserva anexos y sigue a Imprimir.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
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

const CLASIF = ['soporteEsDocRadicacion', '_pqrsDocEsAnexoRespuesta', 'soporteEsAnexoEntrega', 'soporteEsPorCorregir',
  'soporteEsDocumentoNotificado', 'esSoporteEnvioCorreoItem', '_pqrsDocEsPorCorregir', '_pqrsDocEsRevisionActual']

function ctxRender(enPorRevisar, extra) {
  const c = createContext(Object.assign({
    window: { _taskModalCtx: {} },
    jsStr: s => String(s),
    escAttr: s => String(s == null ? '' : s),
    hoy: () => '2026-10-08',
    expPqrsBloqueaFlujoTramite: () => false,
    atajoFirmadoEnPorRevisar: () => enPorRevisar,
    esDirectorDsDeguv: () => false,
    sstFilePickBlock: () => '<pick>',
    getTaskFirmaWf: () => ({}),
    htmlCorreosSugeridosNotificacion: () => '',
    _pqrsOpcionesNotificadorHtml: () => '<select></select>',
    renderAtajoFirmadoDocsAnexosHtml: () => '',
    atajoFirmadoEsVistaOficinaSinResponsables: () => false,
    getExpById: () => ({ _exp: 'E1' })
  }, extra || {}))
  runInContext(extraer(tf, ['tramiteFirmaExpCtx', 'renderTaskReviewAtajoFirmadoHtml']) + '\nthis._f=renderTaskReviewAtajoFirmadoHtml;', c)
  return c._f
}

describe('Panel 📤 en Por revisar', () => {
  it('Por revisar: título «Cargar documento» y primera opción «Cargar y pasar para Imprimir»', () => {
    const h = ctxRender(true)('E1', 't1', { id: 't1' })
    expect(h).toContain('📤 Cargar documento<')
    expect(h).not.toContain('Cargar documento firmado')
    expect(h).toContain('1. Cargar y pasar para Imprimir')
    expect(h).toContain('2. Notificar por correo ahora')
    expect(h).toContain('5. Cargar y dar por atendida (sin notificar)')
    expect(h.indexOf('Cargar y pasar para Imprimir')).toBeLessThan(h.indexOf('Notificar por correo ahora'))
    expect(h).toContain("cargarDocPasarImprimir('E1','t1',false)")
    expect(h).toContain('anexos se mantienen')
  })

  it('Fuera de Por revisar (Por firmar): sigue «Cargar documento firmado» sin opción Imprimir', () => {
    const h = ctxRender(false)('E1', 't1', { id: 't1' })
    expect(h).toContain('📤 Cargar documento firmado')
    expect(h).not.toContain('Cargar y pasar para Imprimir')
    expect(h).toContain('1. Notificar por correo ahora')
  })

  it('Director: sigue «Cargar documento firmado»', () => {
    const h = ctxRender(true, { esDirectorDsDeguv: () => true })('E1', 't1', { id: 't1' })
    expect(h).toContain('📤 Cargar documento firmado')
    expect(h).not.toContain('cargarDocPasarImprimir')
  })

  it('rail de decisión Por revisar: 📤 «Cargar documento»; Por firmar conserva «firmado»', () => {
    expect(extraer(core, ['taskReviewDecisionRailHtml'])).toContain('title="Cargar documento" onclick')
    expect(extraer(core, ['taskActividadToolbarReviewRailHtml'])).toContain('title="Cargar documento" onclick')
    expect(extraer(core, ['taskReviewPorFirmarRailHtml'])).toContain('title="Cargar documento firmado"')
    expect(extraer(core, ['taskReviewDirectorPorFirmarRailHtml'])).toContain('title="Cargar documento firmado"')
  })
})

describe('Clasificación del documento principal a reemplazar', () => {
  function ctxClasif() {
    const c = createContext({})
    runInContext(extraer(core, CLASIF) + '\n' + extraer(tf, ['atajoSoportesPrincipalesReemplazo', 'atajoPqrsDocsPrincipalesReemplazo']) +
      '\nthis._sop=atajoSoportesPrincipalesReemplazo;this._pq=atajoPqrsDocsPrincipalesReemplazo;', c)
    return c
  }

  it('trámite: solo el principal vigente (sin anexos, por corregir, radicación ni notificados)', () => {
    const c = ctxClasif()
    const t = {
      soportes: [
        { id: 'p', driveFileId: 'F1', activo: true, label: 'Documento principal' },
        { id: 'a', driveFileId: 'F2', activo: true, es_anexo: true, label: 'Anexo 1' },
        { id: 'v', driveFileId: 'F0', activo: false, version_historial: true, label: 'Doc · por corregir' },
        { id: 'r', driveFileId: 'F3', activo: true, es_radicacion: true },
        { id: 'n', driveFileId: 'F4', activo: true, tipo: 'notificacion_soporte' },
        { id: 'old', driveFileId: 'F5', activo: false }
      ]
    }
    expect(c._sop(t).map(s => s.id)).toEqual(['p'])
  })

  it('PQRSD: principal de la última entrega en revisión; anexos y por corregir se conservan', () => {
    const c = ctxClasif()
    const wf = {
      documentos: [
        { nombre: 'Oficio firmado', tipo: 'oficio_firmado', fileId: 'O1', driveEstado: 'revision', entrega_n: 1 },
        { nombre: 'Oficio firmado', tipo: 'oficio_firmado', fileId: 'O2', driveEstado: 'revision', entrega_n: 2 },
        { nombre: 'Anexo 1', tipo: 'anexo_respuesta', es_anexo: true, fileId: 'A1', driveEstado: 'revision', entrega_n: 2 },
        { nombre: 'acorregir-oficio', fileId: 'C1', driveEstado: 'acorregir' }
      ]
    }
    expect(c._pq(wf).map(d => d.fileId)).toEqual(['O2'])
  })
})

describe('cargarDocPasarImprimir', () => {
  function ctxRun(t, opts) {
    opts = opts || {}
    const log = { del: [], imprimir: [], notif: [], wf: null, upload: [] }
    const e = opts.e || null
    const c = createContext({
      window: {},
      console,
      document: { getElementById: () => null },
      notif: (m, k) => log.notif.push([m, k]),
      getTaskAny: () => t,
      getExpById: () => e,
      hoy: () => '2026-10-08',
      taskComentarioAutor: () => 'Encargado',
      sstFileCtxKeyTramiteAtajoFirmado: (r, id) => 'k:' + r + ':' + id,
      sstFileGetMainItem: () => (opts.sinArchivo ? null : { state: 'local', nombre: 'nuevo.docx' }),
      sstFileGetMainBlob: () => (opts.sinArchivo ? null : { name: 'nuevo.docx', type: 'application/msword' }),
      sstFileStagingReset: () => {},
      sstSolicitarGmailParaAdjuntar: async () => true,
      driveUploadExpedienteActividad: async (f, n, m, ctx, tk, a, est) => {
        log.upload.push({ n, m, est })
        return { fileId: 'NEW', driveLink: 'https://d/NEW', nombre: 'revision-nuevo.docx', driveEstado: est }
      },
      driveUploadPqrsExpediente: async (f, n, m) => {
        log.upload.push({ n, m, pqrs: true })
        return { fileId: 'NEW', driveLink: 'https://d/NEW', nombre: 'P1_RSP.docx' }
      },
      driveDeleteInstitutional: async id => { log.del.push(id); return true },
      mutateTask: (r, id, fn) => { fn(t); return true },
      getPqrsWorkflow: ex => ex._pqrs_workflow,
      setPqrsWorkflow: (ex, p) => { Object.assign(ex._pqrs_workflow, p); log.wf = ex._pqrs_workflow },
      _taskReviewDecidirImprimirRun: async (x, id) => { log.imprimir.push([x, id]) }
    })
    runInContext(extraer(core, CLASIF) + '\n' +
      extraer(tf, ['tramiteFirmaExpCtx', 'tramiteAtajoFirmadoGetPdfBlob', 'atajoSoportesPrincipalesReemplazo', 'atajoPqrsDocsPrincipalesReemplazo', 'cargarDocPasarImprimir']) +
      '\nthis._run=cargarDocPasarImprimir;', c)
    return { run: c._run, log }
  }

  it('trámite: reemplaza el principal, conserva anexos, borra el anterior de Drive y pasa a Imprimir', async () => {
    const t = {
      id: 't1',
      soportes: [
        { id: 'p', driveFileId: 'F1', activo: true, label: 'Documento principal', driveInstitutional: true },
        { id: 'a', driveFileId: 'F2', activo: true, es_anexo: true, label: 'Anexo 1', driveInstitutional: true }
      ],
      historial: []
    }
    const { run, log } = ctxRun(t)
    expect(await run('E1', 't1', false)).toBe(true)
    expect(log.upload[0]).toMatchObject({ n: 'nuevo.docx', m: 'application/msword', est: 'revision' })
    expect(t.soportes.map(s => s.driveFileId)).toEqual(['F2', 'NEW'])
    expect(t.soportes[1]).toMatchObject({ activo: true, es_anexo: false, driveEstado: 'revision', label: 'Documento principal' })
    expect(log.del).toEqual(['F1'])
    expect(log.imprimir).toEqual([['E1', 't1']])
  })

  it('PQRSD: reemplaza el oficio en wf.documentos, mantiene anexos y aprueba a Imprimir', async () => {
    const e = {
      _exp: 'P1',
      _pqrs_workflow: {
        documentos: [
          { nombre: 'Oficio firmado', tipo: 'oficio_firmado', fileId: 'O1', driveEstado: 'revision', entrega_n: 1 },
          { nombre: 'Anexo 1', tipo: 'anexo_respuesta', es_anexo: true, fileId: 'A1', driveEstado: 'revision', entrega_n: 1 }
        ]
      }
    }
    const t = {
      id: 't1',
      soportes: [
        { id: 'p', driveFileId: 'O1', activo: true, label: 'Documento principal', driveInstitutional: true },
        { id: 'a', driveFileId: 'A1', activo: true, es_anexo: true, label: 'Anexo 1', driveInstitutional: true }
      ]
    }
    const { run, log } = ctxRun(t, { e })
    expect(await run('P1', 't1', true)).toBe(true)
    expect(log.upload[0].pqrs).toBe(true)
    const docs = e._pqrs_workflow.documentos
    expect(docs.map(d => d.fileId)).toEqual(['A1', 'NEW'])
    expect(docs[1]).toMatchObject({ tipo: 'oficio_firmado', driveEstado: 'revision', entrega_n: 1, es_anexo: false })
    expect(t.soportes.map(s => s.driveFileId)).toEqual(['A1', 'NEW'])
    expect(log.del).toEqual(['O1'])
    expect(log.imprimir).toEqual([['P1', 't1']])
  })

  it('sin archivo: avisa y no toca nada', async () => {
    const t = { id: 't1', soportes: [{ id: 'p', driveFileId: 'F1', activo: true }] }
    const { run, log } = ctxRun(t, { sinArchivo: true })
    expect(await run('E1', 't1', false)).toBe(false)
    expect(log.notif[0]).toEqual(['Seleccione el documento', 'err'])
    expect(log.del).toEqual([])
    expect(log.imprimir).toEqual([])
    expect(t.soportes.length).toBe(1)
  })
})
