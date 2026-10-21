/**
 * correccion-pqrsd-tramite-precarga.test.js — PQRSD y trámite devueltos «Por corregir» (desde revisión NCA,
 * desde «Por firmar» —impreso o firma del director— o por el Director): en la nueva entrega el responsable ve
 * el documento principal y los anexos de la última entrega con 🔍 y 🗑. Los anexos siempre son vigentes
 * (si los quita se eliminan del todo); el principal quitado se conserva «por corregir» para comparar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const up = readFileSync(resolve(root, 'js/sst-file-upload.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

const FN_ER = ['entregaCorreccionAplica', 'entregaCorreccionEsAnexo', 'entregaCorreccionSoportesDesdePqrsWf', 'entregaCorreccionSoportesPrevios', 'informeCorreccionItem', 'informeCorreccionPrecargar', 'informeCorreccionOnQuitar']

/** Soportes tal como quedan tras resetTaskPorCorregir (activo=false, acorregir, «por corregir»). */
function soportesDevueltos() {
  return [
    { id: 'v', driveFileId: 'OLD', label: 'Documento principal · por corregir', loteEntrega: 'L1', driveEstado: 'acorregir', version_historial: true },
    { id: 'r', driveFileId: 'RAD', label: 'Radicado', tipo: 'radicacion', loteEntrega: 'L2' },
    { id: 'n', driveFileId: 'NOT', label: 'Soporte de notificación', tipo: 'soporte_notificacion', loteEntrega: 'L2' },
    { id: 'm', driveFileId: 'MAIN', driveLink: 'https://drive/m', driveFilename: 'Por corregir V2 Oficio respuesta.pdf', label: 'Documento principal · por corregir', loteEntrega: 'L2', driveEstado: 'acorregir', version_historial: true },
    { id: 'a1', driveFileId: 'AN1', driveLink: 'https://drive/a1', driveFilename: 'Por corregir V2 Anexo 1.pdf', label: 'Anexo 1 · por corregir', es_anexo: true, anexo_n: 1, loteEntrega: 'L2', driveEstado: 'acorregir', version_historial: true },
    { id: 'a2', driveFileId: 'AN2', driveLink: 'https://drive/a2', driveFilename: 'acorregir-Anexo 2.pdf', label: 'Anexo 2 · por corregir', es_anexo: true, anexo_n: 2, loteEntrega: 'L2', driveEstado: 'acorregir', version_historial: true },
    { id: 'f', driveFileId: 'FIR', label: 'Oficio firmado', firmado: true, loteEntrega: 'L2' }
  ]
}

function montar(t, extra) {
  const staging = {}
  const refrescos = []
  const c = createContext(Object.assign({
    getTaskAny: () => t,
    estadoTask: x => x.estado,
    getSoportesUltimaEntrega: x => x.soportes,
    soporteEsAnexoEntrega: s => s.es_anexo === true,
    soporteEsDocRadicacion: s => s.tipo === 'radicacion',
    soporteEsDocumentoFirmado: s => s.firmado === true,
    soporteEsDocumentoNotificado: () => false,
    esSoporteEnvioCorreoItem: () => false,
    sstFileEnviarCtxKey: (e, k) => 'enviar-soporte:' + e + ':' + k,
    sstFileStagingCtx: k => (staging[k] = staging[k] || { main: null, anexos: [] }),
    sstFileRefreshCtxLists: (k, l) => refrescos.push([k, l]),
    escAttr: s => String(s), jsStr: s => String(s)
  }, extra || {}))
  runInContext(extraer(er, FN_ER), c)
  runInContext(extraer(up, ['sstFileRenderItemRow', 'sstFileCollect']), c)
  return { c, staging, refrescos }
}

describe('Trámite devuelto: nueva entrega con principal y anexos precargados', () => {
  const t = { estado: 'Por corregir', soportes: soportesDevueltos() }
  const { c, staging, refrescos } = montar(t)
  c.informeCorreccionPrecargar('TRA-0001', 'T1')
  const ctx = staging['enviar-soporte:TRA-0001:T1']

  it('carga el principal y los anexos de la ÚLTIMA entrega (no la versión vieja)', () => {
    expect(ctx.main.driveFileId).toBe('MAIN')
    expect(ctx.anexos.map(a => a.driveFileId).sort()).toEqual(['AN1', 'AN2'])
  })

  it('no carga radicado, notificación ni oficio firmado', () => {
    const ids = [ctx.main.driveFileId].concat(ctx.anexos.map(a => a.driveFileId))
    expect(ids).not.toContain('RAD')
    expect(ids).not.toContain('NOT')
    expect(ids).not.toContain('FIR')
  })

  it('los anexos vuelven como anexos vigentes, sin «por corregir» en nombre ni etiqueta', () => {
    ctx.anexos.forEach(a => {
      expect(a.esAnexo).toBe(true)
      expect(a.driveFilename).not.toMatch(/^(acorregir|por corregir)/i)
      expect(a.uploaded.driveFilename).not.toMatch(/^(acorregir|por corregir)/i)
      expect(a.uploaded.nombre).not.toMatch(/por corregir/i)
      expect(a.uploaded.driveEstado).toBe('revision')
    })
    expect(ctx.main.uploaded.driveFilename).toBe('V2 Oficio respuesta.pdf')
  })

  it('cada archivo tiene 🔍 Ver documento y 🗑 Quitar', () => {
    [ctx.main].concat(ctx.anexos).forEach(it => {
      const row = c.sstFileRenderItemRow(it, 'enviar-soporte:TRA-0001:T1', 'enviar-anexos-list')
      expect(row).toContain('title="Ver documento"')
      expect(row).toContain('sstFileRemove(')
    })
  })

  it('van como ya subidos (se reutilizan al enviar, sin volver a subir)', () => {
    const adj = c.sstFileCollect('enviar-soporte:TRA-0001:T1')
    expect(adj.files.length).toBe(0)
    expect(adj.anexos.length).toBe(0)
    expect(adj.preUploaded.length).toBe(3)
  })

  it('refresca la lista de anexos por defecto de la actividad', () => {
    expect(refrescos[0]).toEqual(['enviar-soporte:TRA-0001:T1', 'enviar-anexos-list'])
  })
})

describe('PQRSD devuelta: precarga en la ventana de entrega PQRSD', () => {
  const m = montar({ estado: 'Por corregir', soportes: soportesDevueltos() })
  m.c.informeCorreccionPrecargar('PQRS-0001', 'T9', { ctxKey: 'entrega-resp', anexosListId: 'pqrs-entrega-anexos-list' })

  it('usa el contexto «entrega-resp» y la lista de anexos PQRSD', () => {
    expect(Object.keys(m.staging)).toEqual(['entrega-resp'])
    expect(m.staging['entrega-resp'].main.driveFileId).toBe('MAIN')
    expect(m.staging['entrega-resp'].anexos.length).toBe(2)
    expect(m.refrescos[0]).toEqual(['entrega-resp', 'pqrs-entrega-anexos-list'])
  })
})

describe('2ª corrección: anexos del lote / entrega_n anterior (trámite, sin expediente, PQRSD)', () => {
  const FN = ['entregaCorreccionAplica', 'entregaCorreccionEsAnexo', 'entregaCorreccionSoportesDesdePqrsWf', 'entregaCorreccionSoportesPrevios', 'informeCorreccionItem', 'informeCorreccionPrecargar']

  function montar2(t, extra) {
    const staging = {}
    const c = createContext(Object.assign({
      getTaskAny: () => t,
      estadoTask: x => x.estado,
      getSoportesUltimaEntrega: x => x.soportes,
      soporteEsAnexoEntrega: s => s.es_anexo === true || s.tipo === 'anexo_respuesta',
      _pqrsDocEsAnexoRespuesta: s => s.es_anexo === true || s.tipo === 'anexo_respuesta',
      soporteEsDocRadicacion: () => false,
      soporteEsDocumentoFirmado: () => false,
      soporteEsDocumentoNotificado: () => false,
      esSoporteEnvioCorreoItem: () => false,
      getExpById: () => null,
      getPqrsWorkflow: () => ({}),
      taskEsAtenderPqrs: () => false,
      sstFileEnviarCtxKey: (e, k) => 'enviar-soporte:' + e + ':' + k,
      sstFileStagingCtx: k => (staging[k] = staging[k] || { main: null, anexos: [] }),
      sstFileRefreshCtxLists: () => {}
    }, extra || {}))
    runInContext(extraer(er, FN), c)
    return { c, staging }
  }

  it('trámite / act. sin expediente: principal nuevo + anexos del lote anterior', () => {
    const t = {
      estado: 'Por corregir',
      sinExpediente: true,
      soportes: [
        { id: 'a1', driveFileId: 'AN1', label: 'Anexo 1', es_anexo: true, loteEntrega: 'lot_100' },
        { id: 'a2', driveFileId: 'AN2', label: 'Anexo 2', es_anexo: true, loteEntrega: 'lot_100' },
        { id: 'm1', driveFileId: 'OLD', label: 'Documento principal · por corregir', version_historial: true, loteEntrega: 'lot_100' },
        { id: 'm2', driveFileId: 'MAIN2', label: 'Documento principal · por corregir', version_historial: true, loteEntrega: 'lot_200' }
      ]
    }
    const { c, staging } = montar2(t)
    c.informeCorreccionPrecargar('ACT-LIBRE', 'T1')
    const ctx = staging['enviar-soporte:ACT-LIBRE:T1']
    expect(ctx.main.driveFileId).toBe('MAIN2')
    expect(ctx.anexos.map(a => a.driveFileId).sort()).toEqual(['AN1', 'AN2'])
  })

  it('PQRSD: anexos solo en wf.documentos de entrega_n anterior se precargan', () => {
    const t = {
      estado: 'Por corregir',
      exp: 'PQRS-9',
      soportes: [
        { id: 'm2', driveFileId: 'MAIN2', label: 'Documento principal · por corregir', version_historial: true, loteEntrega: 'lot_200' }
      ]
    }
    const e = {
      _exp: 'PQRS-9',
      documentos: [
        { nombre: 'Oficio v1', fileId: 'MAIN1', driveEstado: 'acorregir', entrega_n: 1, version_historial: true },
        { nombre: 'Anexo 1', fileId: 'AN1', driveEstado: 'acorregir', entrega_n: 1, es_anexo: true, version_historial: true },
        { nombre: 'Anexo 2', fileId: 'AN2', driveEstado: 'acorregir', entrega_n: 1, es_anexo: true, version_historial: true },
        { nombre: 'Oficio v2', fileId: 'MAIN2', driveEstado: 'acorregir', entrega_n: 2, version_historial: true }
      ]
    }
    const { c, staging } = montar2(t, {
      getExpById: () => e,
      getPqrsWorkflow: () => ({ documentos: e.documentos, task_id: 'T9' }),
      taskEsAtenderPqrs: () => true
    })
    c.informeCorreccionPrecargar('PQRS-9', 'T9', { ctxKey: 'entrega-resp', anexosListId: 'pqrs-entrega-anexos-list' })
    const ctx = staging['entrega-resp']
    expect(ctx.main.driveFileId).toBe('MAIN2')
    expect(ctx.anexos.map(a => a.driveFileId).sort()).toEqual(['AN1', 'AN2'])
  })
})

describe('Solo aplica a actividades «Por corregir»', () => {
  ;['Por ejecutar', 'Por verificar', 'Atendida'].forEach(est => {
    it('estado ' + est + ': no precarga nada', () => {
      const m = montar({ estado: est, soportes: soportesDevueltos() })
      m.c.informeCorreccionPrecargar('X', 'T')
      expect(m.staging).toEqual({})
    })
  })
  it('actividad eliminada: no precarga', () => {
    const m = montar({ estado: 'Por corregir', eliminada: true, soportes: soportesDevueltos() })
    m.c.informeCorreccionPrecargar('X', 'T')
    expect(m.staging).toEqual({})
  })
  it('principal ya descartado antes (corr_descartado) no vuelve a aparecer', () => {
    const sop = soportesDevueltos()
    sop.find(s => s.id === 'm').corr_descartado = true
    const m = montar({ estado: 'Por corregir', soportes: sop })
    m.c.informeCorreccionPrecargar('X', 'T')
    expect(m.staging['enviar-soporte:X:T'].main).toBeNull()
  })
})

describe('Quitar en la nueva entrega de una PQRSD', () => {
  function escenario() {
    const t = { estado: 'Por corregir', soportes: soportesDevueltos() }
    const e = {
      id: 'PQRS-0001',
      wf: { documentos: [
        { nombre: 'Documento de respuesta', fileId: 'MAIN', driveEstado: 'acorregir', entrega_n: 2 },
        { nombre: 'Anexo 1', fileId: 'AN1', driveEstado: 'acorregir', entrega_n: 2, es_anexo: true },
        { nombre: 'Anexo 2', fileId: 'AN2', driveEstado: 'acorregir', entrega_n: 2, es_anexo: true }
      ] },
      _pqrs_respuesta_soportes: [{ fileId: 'AN1', url: 'https://drive/a1' }, { fileId: 'MAIN', url: 'https://drive/m' }]
    }
    let persist = 0
    const m = montar(t, {
      mutateTask: (x, y, fn) => fn(t),
      getExpById: () => e,
      esPqrsSecretaria: () => true,
      getPqrsWorkflow: ex => ex.wf,
      setPqrsWorkflow: (ex, p) => { ex.wf = Object.assign({}, ex.wf, p) },
      persistExpedienteGranular: () => { persist++ }
    })
    return { t, e, m, persisted: () => persist }
  }

  it('anexo quitado: queda en la actividad para el encargado hasta que apruebe', () => {
    const s = escenario()
    s.m.c.informeCorreccionOnQuitar({ driveFileId: 'AN1', esAnexo: true, corrPrev: { expId: 'PQRS-0001', taskId: 'T9' } })
    const an = s.t.soportes.find(x => x.driveFileId === 'AN1')
    expect(an.version_historial).toBe(true)
    expect(an.corr_descartado).toBe(true)
    expect(s.e.wf.documentos.map(d => d.fileId)).toEqual(['MAIN', 'AN1', 'AN2'])
    expect(s.e._pqrs_respuesta_soportes.map(x => x.fileId)).toEqual(['AN1', 'MAIN'])
    expect(s.persisted()).toBe(0)
  })

  it('principal quitado: se conserva «por corregir» para comparar (no se borra del registro)', () => {
    const s = escenario()
    s.m.c.informeCorreccionOnQuitar({ driveFileId: 'MAIN', esAnexo: false, corrPrev: { expId: 'PQRS-0001', taskId: 'T9' } })
    const main = s.t.soportes.find(x => x.driveFileId === 'MAIN')
    expect(main.corr_descartado).toBe(true)
    expect(s.e.wf.documentos.map(d => d.fileId)).toEqual(['MAIN', 'AN1', 'AN2'])
    expect(s.persisted()).toBe(0)
  })

  it('en Drive: ni el principal ni el anexo precargados se eliminan al quitarlos', () => {
    const body = extraer(up, ['sstFileRemove'])
    expect(body).toMatch(/conservarCorr\s*=\s*!!it\.corrPrev/)
  })
})

describe('PQRSD: al enviar, los archivos conservados son de la entrega vigente', () => {
  const c = createContext({ responsableActivo: 'Ana', parseDrivePreviewUrl: null })
  runInContext(extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsDocKey', '_pqrsMarcarDocsComoPorCorregir', '_pqrsMergeDocumentosEntrega']), c)
  const prev = [
    { nombre: 'Documento de respuesta', fileId: 'MAIN', driveFilename: 'Por corregir V2 Oficio.pdf', driveEstado: 'acorregir', entrega_n: 2, version_historial: true },
    { nombre: 'Anexo 1', fileId: 'AN1', driveFilename: 'Por corregir V2 Anexo 1.pdf', driveEstado: 'acorregir', entrega_n: 2, version_historial: true, es_anexo: true },
    { nombre: 'Anexo 2', fileId: 'AN2', driveFilename: 'Por corregir V2 Anexo 2.pdf', driveEstado: 'acorregir', entrega_n: 2, version_historial: true, es_anexo: true }
  ]

  it('anexo conservado: queda una sola vez, vigente (no «por corregir») en la nueva entrega', () => {
    const nuevos = [
      { nombre: 'Documento de respuesta', fileId: 'NEWMAIN', driveFilename: 'Oficio v3.pdf', driveEstado: 'revision' },
      { nombre: 'Anexo 1', fileId: 'AN1', driveFilename: 'Por corregir V2 Anexo 1.pdf', driveEstado: 'revision', es_anexo: true }
    ]
    const out = c._pqrsMergeDocumentosEntrega(prev.map(d => Object.assign({}, d)), nuevos, 3)
    const an1 = out.filter(d => d.fileId === 'AN1')
    expect(an1.length).toBe(1)
    expect(an1[0].entrega_n).toBe(3)
    expect(an1[0].driveFilename).toBe('V2 Anexo 1.pdf')
    expect(c._pqrsDocEsPorCorregir(an1[0])).toBe(false)
  })

  it('principal reemplazado: el anterior queda «por corregir» para comparar; el nuevo vigente', () => {
    const nuevos = [{ nombre: 'Documento de respuesta', fileId: 'NEWMAIN', driveFilename: 'Oficio v3.pdf', driveEstado: 'revision' }]
    const out = c._pqrsMergeDocumentosEntrega(prev.map(d => Object.assign({}, d)), nuevos, 3)
    expect(c._pqrsDocEsPorCorregir(out.find(d => d.fileId === 'MAIN'))).toBe(true)
    expect(c._pqrsDocEsPorCorregir(out.find(d => d.fileId === 'NEWMAIN'))).toBe(false)
  })

  it('principal conservado sin cambios: pasa a vigente y no se duplica', () => {
    const nuevos = [{ nombre: 'Documento de respuesta', fileId: 'MAIN', driveFilename: 'V2 Oficio.pdf', driveEstado: 'revision' }]
    const out = c._pqrsMergeDocumentosEntrega(prev.map(d => Object.assign({}, d)), nuevos, 3)
    const mains = out.filter(d => d.fileId === 'MAIN')
    expect(mains.length).toBe(1)
    expect(c._pqrsDocEsPorCorregir(mains[0])).toBe(false)
  })

  it('primera entrega (sin historial): igual que antes', () => {
    const nuevos = [{ nombre: 'Documento de respuesta', fileId: 'X1', driveFilename: 'Oficio.pdf' }]
    const out = c._pqrsMergeDocumentosEntrega([], nuevos, 1)
    expect(out.length).toBe(1)
    expect(out[0].driveEstado).toBe('revision')
    expect(out[0].driveFilename).toBe('Oficio.pdf')
  })

  it('en Drive se quita el prefijo «Por corregir» a los conservados y los soportes de respuesta no los dejan como versión vieja', () => {
    const g = extraer(core, ['guardarPqrsRespuestaDatos'])
    expect(g).toContain("_pqrsRenombrarDocsDriveWf({documentos:reusados},'revision')")
    expect(g).toMatch(/const prev=prev0\.filter\(function\(s\)\{return !s\|\|!kNuevos\.has\(kSop\(s\)\);\}\);/)
  })
})

describe('Conexión con las ventanas de entrega', () => {
  it('ventana PQRSD: precarga en «entrega-resp» con la lista de anexos PQRSD', () => {
    const llamadas = []
    const c = createContext({
      entregaRespFileCtxKey: () => 'entrega-resp',
      informeCorreccionPrecargar: (e, t, o) => llamadas.push([e, t, o])
    })
    runInContext(extraer(core, ['initPqrsEntregaArchivosPick']), c)
    c.initPqrsEntregaArchivosPick('PQRS-1', 'T1')
    c.initPqrsEntregaArchivosPick()
    expect(llamadas.length).toBe(1)
    expect(llamadas[0][0]).toBe('PQRS-1')
    expect(llamadas[0][2].ctxKey).toBe('entrega-resp')
    expect(llamadas[0][2].anexosListId).toBe('pqrs-entrega-anexos-list')
  })

  it('ventana de actividad (también la de PQRSD libre): precarga con su contexto y su lista', () => {
    const llamadas = []
    const c = createContext({
      sstFileEnviarCtxKey: (e, t) => 'enviar-soporte:' + e + ':' + t,
      informeCorreccionPrecargar: (e, t, o) => llamadas.push(o)
    })
    runInContext(extraer(core, ['initEnviarArchivosPick']), c)
    c.initEnviarArchivosPick('E1', 'T1', null)
    c.initEnviarArchivosPick('E1', 'T1', { main: 'pqrs-entrega-att-list', anexos: 'pqrs-entrega-anexos-list' })
    expect(llamadas).toEqual([
      { ctxKey: 'enviar-soporte:E1:T1', anexosListId: 'enviar-anexos-list' },
      { ctxKey: 'enviar-soporte:E1:T1', anexosListId: 'pqrs-entrega-anexos-list' }
    ])
  })

  it('las dos aperturas de entrega PQRSD pasan expediente y actividad', () => {
    const n = (core.match(/initPqrsEntregaArchivosPick\(expId,taskId\);/g) || []).length
    expect(n).toBeGreaterThanOrEqual(2)
  })
})

describe('Devolución desde cualquier paleta deja la actividad «Por corregir» (aplica la precarga)', () => {
  const casos = [
    ['revisión NCA (PQRSD)', core, 'ncaRechazarRespuesta'],
    ['«Por firmar» del encargado NCA (impreso o firma del director)', core, 'encargadoDevolverDesdeFirmaACorregir'],
    ['el Director desde «Por firmar»', core, 'directorDevolverDesdePorFirmar'],
    ['firma de trámite', tf, 'tramiteDevolverDesdeFirmaACorregir']
  ]
  casos.forEach(([nom, src, fn]) => {
    it(nom + ' → resetTaskPorCorregir', () => {
      expect(extraer(src, [fn])).toContain('resetTaskPorCorregir(')
    })
  })

  it('resetTaskPorCorregir deja el estado «Por corregir» que activa la precarga', () => {
    const r = extraer(core, ['resetTaskPorCorregir'])
    expect(r).toContain("t.estado='Por corregir'")
    expect(montar({}).c.entregaCorreccionAplica({ estado: 'Por corregir' })).toBe(true)
  })
})

describe('Comparación del encargado', () => {
  it('los anexos nunca se rotulan «por corregir» (PQRSD, trámite e informe)', () => {
    expect(core).toContain('const esCorr=soporteEsPorCorregir(s)&&!esAn;')
    expect(core).not.toContain('!(esAn&&t.informeContrato)')
  })
})
