/**
 * traslado-entrega-anexos-solicitud.test.js —
 * Al trasladar en revisión, la entrega del responsable anterior queda como anexo
 * visible en Ver PQR / solicitud y se limpia al aprobar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')

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

describe('Traslado con entrega → anexos de solicitud para el nuevo responsable', () => {
  it('captura soportes activos y los muestra en collectPqrsOrigenDocs', () => {
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && (s.es_anexo || s.tipo === 'anexo_respuesta')),
      soporteEsDocRadicacion: () => false,
      soporteEsDocumentoNotificado: () => false,
      soporteEsDocumentoFirmado: () => false,
      esSoporteEnvioCorreoItem: () => false,
      getSoportesUltimaEntrega: x => (x && x.soportes) || [],
      getPqrsWorkflow: () => ({}),
      parseDrivePreviewUrl: u => ({ preview: u, url: u }),
      pqrsDriveUrlsMatch: (a, b) => String(a) === String(b),
      _pqrsCollectDocsRadicacion: () => [
        { driveLink: 'https://drive/sol.pdf', label: 'Soporte de radicación', tipo: 'soporte_radicacion' }
      ]
    })
    runInContext(extraer(core, [
      'soportesEntregaActivaParaTraslado', 'capturarAnexosTrasladoDesdeEntrega',
      'getAnexosTrasladoEntrega', 'limpiarAnexosTrasladoEntrega', 'collectPqrsOrigenDocs'
    ]), c)

    const e = { _exp: 'NB1', _pqrs_solicitud_link: 'https://drive/sol.pdf' }
    const t = {
      soportes: [
        { driveFileId: 'f1', driveLink: 'https://drive/oficio.pdf', label: 'Oficio respuesta', activo: true },
        { driveFileId: 'f2', driveLink: 'https://drive/anexo.pdf', label: 'Anexo 1', es_anexo: true, activo: true }
      ]
    }
    const mapped = c.capturarAnexosTrasladoDesdeEntrega(e, t)
    expect(mapped.length).toBe(2)
    expect(e._pqrs_anexos_traslado_entrega.length).toBe(2)
    expect(t.anexosTrasladoEntrega.length).toBe(2)

    const docs = c.collectPqrsOrigenDocs(e)
    expect(docs.some(d => d.id === 'pqrs_sol')).toBe(true)
    expect(docs.filter(d => d.fromTraslado).length).toBe(2)
    expect(docs.find(d => d.fromTraslado).fullLabel).toMatch(/Entrega anterior/)

    c.limpiarAnexosTrasladoEntrega(e, t)
    expect(e._pqrs_anexos_traslado_entrega).toEqual([])
    expect(c.collectPqrsOrigenDocs(e).filter(d => d.fromTraslado).length).toBe(0)
  })

  it('resetEntregaAlReasignarTask captura antes de archivar soportes', () => {
    const c = createContext({
      hoy: () => '2026-10-16',
      taskComentarioAutor: () => 'NCA',
      syncTaskAggregateState: () => {},
      getExpById: () => null,
      soporteEsAnexoEntrega: () => false,
      soporteEsDocRadicacion: () => false,
      soporteEsDocumentoNotificado: () => false,
      soporteEsDocumentoFirmado: () => false,
      esSoporteEnvioCorreoItem: () => false,
      getSoportesUltimaEntrega: x => (x && x.soportes) || [],
      getPqrsWorkflow: () => ({})
    })
    runInContext(extraer(core, [
      'soportesEntregaActivaParaTraslado', 'capturarAnexosTrasladoDesdeEntrega',
      'getAnexosTrasladoEntrega', 'limpiarAnexosTrasladoEntrega', 'resetEntregaAlReasignarTask'
    ]), c)
    const e = { _exp: 'NB2' }
    const t = {
      fechaReportada: '2026-10-15', estado: 'Por verificar',
      soportes: [{ driveFileId: 'x', driveLink: 'https://drive/x.pdf', label: 'Doc', activo: true }],
      asignados: [{ nombre: 'Ana', estado: 'por_verificar', fechaReportada: '2026-10-15' }],
      historial: []
    }
    c.resetEntregaAlReasignarTask(t, { e, nota: 'traslado' })
    expect(e._pqrs_anexos_traslado_entrega.length).toBe(1)
    expect(t.soportes[0].activo).toBe(false)
    expect(t.soportes[0].version_historial).toBe(true)
    expect(t.estado).toBe('En ejecución')
    expect(t.fechaReportada).toBe('')
  })

  it('existe precarga entregaTrasladoAnexosPrecargar en entrega-responsable.js', () => {
    expect(er).toMatch(/function entregaTrasladoAnexosPrecargar\(/)
    expect(core).toMatch(/entregaTrasladoAnexosPrecargar\(expId,taskId/)
  })
})
