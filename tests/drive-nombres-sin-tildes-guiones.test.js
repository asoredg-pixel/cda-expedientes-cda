/**
 * drive-nombres-sin-tildes-guiones.test.js — Nombres de archivos en Drive sin tildes/ñ ni guiones bajos
 * (_ → espacio), conservando el guion del número de expediente (PAF-0009-21), con estados legibles.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

const GMAIL_FNS = [
  '_driveSlug', '_driveNombreArchivoPlano', '_driveEstadoLegible', '_driveSafeFileName', '_driveFileExt',
  '_driveTipoDocCorto', '_driveTipoDocumentoNombre', '_driveEntregaNExp', 'buildExpedienteDriveFilename', 'pqrsBuildDriveFilename'
]

function ctxGmail(extra) {
  const ctx = createContext(Object.assign({ window: {} }, extra || {}))
  runInContext(extraerFunciones(read('js/gmail.js'), GMAIL_FNS) +
    '\nthis._plano=_driveNombreArchivoPlano;this._safe=_driveSafeFileName;' +
    'this._exp=buildExpedienteDriveFilename;this._pqrs=pqrsBuildDriveFilename;', ctx)
  return ctx
}

function ctxCore() {
  const code = extraerFunciones(read('js/core.js'), [
    '_pqrsDocEsAnexoRespuesta', '_pqrsEsNombreSoporteRadicacion', '_pqrsEsNombreAnexoRadicacion',
    'pqrsStripPrefijoInternoDrive', '_pqrsRenombrarDocsDriveWf'
  ])
  const renombres = []
  const ctx = createContext({
    window: {},
    renombres,
    _pqrsDocEsPorCorregir: () => false,
    driveRenameInstitutional: async (fid, name) => { renombres.push(name); return true }
  })
  runInContext(extraerFunciones(read('js/gmail.js'), ['_driveNombreArchivoPlano', '_driveEstadoLegible']) + '\n' + code +
    '\nthis._esAnxResp=_pqrsDocEsAnexoRespuesta;this._esSol=_pqrsEsNombreSoporteRadicacion;' +
    'this._esAnxRad=_pqrsEsNombreAnexoRadicacion;this._strip=pqrsStripPrefijoInternoDrive;' +
    'this._renWf=_pqrsRenombrarDocsDriveWf;', ctx)
  return ctx
}

describe('Normalizador de nombres Drive', () => {
  const g = ctxGmail()

  it('quita tildes, ñ y guiones bajos; MAYÚSCULAS con extensión en minúscula', () => {
    expect(g._plano('Resolución_PAF-0009-21 Peña.pdf')).toBe('RESOLUCION PAF-0009-21 PENA.pdf')
    expect(g._plano('informe_.docx')).toBe('INFORME.docx')
    expect(g._plano('Acta – PAF-00012-26.pdf')).toBe('ACTA - PAF-00012-26.pdf')
    expect(g._safe('Acta: revisión.PDF')).toBe('ACTA REVISION.pdf')
  })

  it('PQRSD: {exp} SOL / A01 / RSP / OFC / NOT / soportes', () => {
    expect(g._pqrs('SOL', 'wq261892', { ext: 'pdf' })).toBe('WQ261892 SOL.pdf')
    expect(g._pqrs('ANX', 'CDA-WE26453', { origName: 'Cédula.pdf', n: 1 })).toBe('CDA-WE26453 A01.pdf')
    expect(g._pqrs('ANX', 'WE26453', { origName: 'foto.JPG', n: 12 })).toBe('WE26453 A12.jpg')
    expect(g._pqrs('RSP', 'CDA-WE26453', { origName: 'x.docx' })).toBe('CDA-WE26453 RSP.docx')
    expect(g._pqrs('OFC', 'WE26453', { origName: 'oficio firmado.pdf' })).toBe('WE26453 OFC.pdf')
    expect(g._pqrs('NOT', 'WE26453', { origName: 'guia.png' })).toBe('WE26453 NOT.png')
    expect(g._pqrs('SRP', 'WE26453', { ext: 'pdf' })).toBe('WE26453 SOPORTE RESPUESTA.pdf')
    expect(g._pqrs('SEN', 'WE26453', { origName: 'x.pdf' })).toBe('WE26453 SOPORTE ENVIO.pdf')
  })

  it('Expediente/actividad: [ANEXON] {ESTADO} {EXP} {ACTIVIDAD} si no hay tipo de documento', () => {
    const e = { _exp: 'PAF-00012-26' }
    const t = { desc: 'Revisión técnica' }
    expect(g._exp('revision', e, t, '', 'informe.pdf', {})).toBe('POR REVISAR PAF-00012-26 REVISION TECNICA.pdf')
    expect(g._exp('aprobado', e, t, '', 'x.pdf', { esAnexo: true, anexoN: 2 })).toBe('ANEXO2 APROBADO PAF-00012-26 REVISION TECNICA.pdf')
    expect(g._exp('acorregir', e, t, '', 'x.pdf', {})).toMatch(/^POR CORREGIR PAF-00012-26 /)
    expect(g._exp('por_firmar', e, t, '', 'x.pdf', {})).toMatch(/^POR FIRMAR /)
    expect(g._exp('por_notificar', e, t, '', 'x.pdf', {})).toMatch(/^POR NOTIFICAR /)
  })

  it('Expediente: usa el tipo de concepto, acto administrativo o factura', () => {
    const e = { _exp: 'PAF-0009-21', _facturas_extra: [{ tipo: 'TUA', taskId: 't3', ref: 'F-1' }] }
    const gx = ctxGmail({
      resolveActividadRegistroTipo: a => (/factura/i.test(a) ? 'factura' : (/concepto/i.test(a) ? 'concepto' : '')),
      facturasData: x => x || [],
      conceptosSegData: x => x || []
    })
    expect(gx._exp('revision', e, { desc: 'Elaborar concepto', conceptoTipo: 'Concepto de seguimiento' }, '', 'c.pdf', {}))
      .toBe('POR REVISAR PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    expect(gx._exp('aprobado', e, { desc: 'Proyectar acto', actoTipo: 'Resolución que aprueba' }, '', 'r.docx', {}))
      .toBe('APROBADO PAF-0009-21 RESOLUCION APRUEBA.docx')
    expect(gx._exp('revision', e, { desc: 'Proyectar acto', actoTipo: 'Auto desiste' }, '', 'a.pdf', {}))
      .toBe('POR REVISAR PAF-0009-21 AUTO DESISTE.pdf')
    expect(gx._exp('revision', e, { id: 't3', desc: 'Liquidar factura' }, '', 'f.pdf', {}))
      .toBe('POR REVISAR PAF-0009-21 FACTURA TUA.pdf')
    const eSeg = { _exp: 'PAF-0009-21', _conceptos_seg: [{ taskId: 't9', tipoConcepto: 'Concepto evaluación' }] }
    expect(gx._exp('revision', eSeg, { id: 't9', desc: 'Concepto técnico' }, '', 'c.pdf', {}))
      .toBe('POR REVISAR PAF-0009-21 CONCEPTO EVALUACION.pdf')
  })

  it('Expediente: versiones de corrección V1, V2… según la entrega', () => {
    const e = { _exp: 'PAF-0009-21' }
    const s1 = { loteEntrega: 'lot_1', driveEstado: 'revision' }
    const a1 = { loteEntrega: 'lot_1', es_anexo: true, anexo_n: 1 }
    const t = { desc: 'Concepto', conceptoTipo: 'Concepto de seguimiento', soportes: [s1, a1] }
    // Una sola entrega aprobada: sin V
    expect(g._exp('aprobado', e, t, '', 'c.pdf', { soporte: s1 })).toBe('APROBADO PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    // Devolución: V1 en principal y anexo
    expect(g._exp('corregir', e, t, '', 'c.pdf', { soporte: s1 })).toBe('POR CORREGIR V1 PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._exp('corregir', e, t, '', 'a.pdf', { soporte: a1, esAnexo: true, anexoN: 1 })).toBe('ANEXO1 POR CORREGIR V1 PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    // Nueva entrega corregida (subida): V2
    expect(g._exp('revision', e, t, '', 'c2.pdf', {})).toBe('POR REVISAR V2 PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    const s2 = { loteEntrega: 'lot_2' }
    t.soportes.push(s2)
    expect(g._exp('aprobado', e, t, '', 'c2.pdf', { soporte: s2 })).toBe('APROBADO V2 PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    // Firmado / notificado no son entregas del responsable
    expect(g._exp('por_notificar', e, t, '', 'f.pdf', { soporte: { loteEntrega: 'wf_firma_1' } })).toBe('POR NOTIFICAR PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
    // Actividad sin entregas previas: sin V
    expect(g._exp('revision', e, { desc: 'Concepto', conceptoTipo: 'Concepto de seguimiento' }, '', 'c.pdf', {})).toBe('POR REVISAR PAF-0009-21 CONCEPTO SEGUIMIENTO.pdf')
  })
})

describe('PQRSD: renombre por estado y reconocimiento de nombres', () => {
  const c = ctxCore()

  it('por firmar → aprobado V2 conservando el número de expediente', async () => {
    c.renombres.length = 0
    const wf = { documentos: [{ fileId: 'f1', nombre: 'PAF-0009-21.pdf', entrega_n: 2 }] }
    await c._renWf(wf, 'por_firmar')
    expect(wf.documentos[0].nombre).toBe('POR FIRMAR V2 PAF-0009-21.pdf')
    await c._renWf(wf, 'aprobado')
    expect(wf.documentos[0].nombre).toBe('APROBADO V2 PAF-0009-21.pdf')
    const wf2 = { documentos: [{ fileId: 'f2', nombre: 'por_firmar-v1-wq261892.pdf', entrega_n: 1 }] }
    await c._renWf(wf2, 'revision')
    expect(wf2.documentos[0].nombre).toBe('POR REVISAR V1 WQ261892.pdf')
  })

  it('etiqueta «Documento de respuesta»: renombra el archivo real y conserva la etiqueta', async () => {
    c.renombres.length = 0
    const wf = { documentos: [
      { fileId: 'r1', nombre: 'Documento de respuesta', driveFilename: 'WE26453 RSP.pdf', entrega_n: 2 },
      { fileId: 'a1', nombre: 'Anexo 1', driveFilename: 'WE26453 A01.xlsx', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 2 }
    ] }
    await c._renWf(wf, 'acorregir')
    expect(c.renombres).toEqual(['POR CORREGIR V2 WE26453 RSP.pdf', 'POR CORREGIR V2 WE26453 A01.xlsx'])
    expect(wf.documentos[0].nombre).toBe('Documento de respuesta')
    expect(wf.documentos[0].driveFilename).toBe('POR CORREGIR V2 WE26453 RSP.pdf')
    expect(wf.documentos[1].nombre).toBe('Anexo 1')
    expect(c._esAnxResp(wf.documentos[1])).toBe(true)
  })

  it('sin nombre de archivo con extensión: agrega la extensión del mime', async () => {
    c.renombres.length = 0
    const wf = { documentos: [{ fileId: 'x1', nombre: 'Proyección oficio', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }] }
    await c._renWf(wf, 'atendido')
    expect(c.renombres[0]).toBe('APROBADO PROYECCION OFICIO.docx')
    expect(wf.documentos[0].nombre).toBe('Proyección oficio')
  })

  it('documento notificado con etiqueta: no pisa la etiqueta', async () => {
    c.renombres.length = 0
    const wf = { documentos: [{ fileId: 'n1', nombre: 'Documento notificado presencial — WE26453 NOT.jpg', driveFilename: 'WE26453 NOT.jpg' }] }
    await c._renWf(wf, 'atendido')
    expect(c.renombres[0]).toBe('APROBADO WE26453 NOT.jpg')
    expect(wf.documentos[0].nombre).toBe('Documento notificado presencial — WE26453 NOT.jpg')
  })

  it('soporte y anexos de radicación con espacio o guion bajo', () => {
    expect(c._esSol('CDA-WE26453 SOL.pdf')).toBe(true)
    expect(c._esSol('CDA-WE26453_SOL.pdf')).toBe(true)
    expect(c._esAnxRad('CDA-WE26453 A01 cedula.pdf')).toBe(true)
    expect(c._esAnxRad('CDA-WE26453_A01.pdf')).toBe(true)
    expect(c._esAnxResp({ nombre: 'CDA-WE26453 A01.pdf' })).toBe(false)
    expect(c._esAnxResp({ nombre: 'aprobado V2 anexo1 respuesta.pdf' })).toBe(true)
  })

  it('quita prefijos internos antiguos y nuevos', () => {
    expect(c._strip('aprobado V2 PAF-0009-21.pdf')).toBe('PAF-0009-21.pdf')
    expect(c._strip('aprobado-v2-PAF-0009-21.pdf')).toBe('PAF-0009-21.pdf')
    expect(c._strip('por firmar wq261892.pdf')).toBe('wq261892.pdf')
    expect(c._strip('docprincipal por revisar PAF-00012-26 act.pdf')).toBe('PAF-00012-26 act.pdf')
    expect(c._strip('POR REVISAR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')).toBe('PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
  })
})
