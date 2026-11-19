/**
 * Consulta ciudadana: el soporte PDF de respuesta (p. ej. comunicación a entidad
 * desde Por ejecutar) se muestra aunque solo esté en la actividad.
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
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctx() {
  const c = createContext({
    esPqrsSecretaria: e => !!(e && e._pqrs),
    pqrsEstaCerrada: e => !!(e && e._cerrada),
    getPqrsWorkflow: e => (e && e._wf) || {},
    normalizeTask: t => t || {},
    etiquetaSoporteEnvioActividad: () => 'Soporte envío — Oficio de respuesta',
    _pqrsDocKey: d => String((d && (d.driveLink || d.url || d.preview)) || '').toLowerCase(),
    _pqrsDocEsLinkDriveGenerico: () => false,
    _pqrsDocEsVisibleCiudadano: () => true,
    _pqrsDocEsBorradorInterno: d => !!(d && /por corregir/i.test(String(d.label || d.nombre || ''))),
    _pqrsDocEsAnexoRespuesta: () => false,
    _pqrsDocEsDefinitivoCierre: d => !!(d && (d.tipo === 'soporte_notificacion' || d.tipo === 'soporte_respuesta' || d.notificado)),
    _pqrsEtiquetaDocWf: d => (d && (d.nombre || d.label)) || '',
    _pqrsDeduplicarDocumentosRespuesta: arr => arr || [],
    esUrlCarpetaDrive: () => false,
    parseDrivePreviewUrl: u => ({ url: u, preview: u }),
    String, Array, Object, RegExp
  })
  runInContext(extraer(core, ['getDocsPqrsRespuestaCiudadano']), c)
  return c
}

describe('Consulta ciudadana — soporte de respuesta a entidad', () => {
  it('recupera el PDF de soporte desde la actividad si no está en _pqrs_respuesta_soportes', () => {
    const c = ctx()
    const docs = c.getDocsPqrsRespuestaCiudadano({
      _pqrs: true,
      _cerrada: true,
      _exp: 'ZN260737',
      _pqrs_respuesta_soportes: [],
      _wf: { documentos: [] },
      tasks: [{
        actividad: 'Atender PQRSD',
        soportes: [{
          tipo: 'soporte_notificacion',
          driveEstado: 'notificado',
          notificado: true,
          label: 'Soporte envío',
          driveLink: 'https://drive.google.com/file/d/abc/view',
          previewLink: 'https://drive.google.com/file/d/abc/preview',
          mime: 'application/pdf'
        }]
      }]
    })
    expect(docs.map(d => d.label)).toContain('Soporte envío — Oficio de respuesta')
    expect(docs[0].url).toContain('drive.google.com')
  })

  it('no inventa documentos si la actividad no tiene soporte de envío', () => {
    const c = ctx()
    const docs = c.getDocsPqrsRespuestaCiudadano({
      _pqrs: true,
      _cerrada: true,
      _pqrs_respuesta_soportes: [],
      _wf: { documentos: [] },
      tasks: [{ actividad: 'Atender PQRSD', soportes: [{ label: 'Borrador por corregir', driveEstado: 'revision', url: 'x' }] }]
    })
    expect(docs).toEqual([])
  })
})
