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
  'buildExpedienteDriveFilename', 'pqrsBuildDriveFilename'
]

function ctxGmail() {
  const ctx = createContext({ window: {} })
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

  it('quita tildes, ñ y guiones bajos; conserva el guion del expediente y la extensión', () => {
    expect(g._plano('Resolución_PAF-0009-21 Peña.pdf')).toBe('Resolucion PAF-0009-21 Pena.pdf')
    expect(g._plano('informe_.docx')).toBe('informe.docx')
    expect(g._plano('Acta – PAF-00012-26.pdf')).toBe('Acta - PAF-00012-26.pdf')
    expect(g._safe('Acta: revisión.PDF')).toBe('Acta revision.PDF')
  })

  it('PQRSD: {exp} SOL / A01 / RSP conservando el guion del número', () => {
    expect(g._pqrs('SOL', 'wq261892', { ext: 'pdf' })).toBe('wq261892 SOL.pdf')
    expect(g._pqrs('ANX', 'CDA-WE26453', { origName: 'Cédula.pdf', n: 1 })).toBe('CDA-WE26453 A01 Cedulapdf.pdf')
    expect(g._pqrs('RSP', 'CDA-WE26453', { origName: 'x.docx' })).toBe('CDA-WE26453 RSP.docx')
  })

  it('Expediente/actividad: docprincipal/anexoN {estado legible} {exp} {act}', () => {
    const e = { _exp: 'PAF-00012-26' }
    const t = { desc: 'Revisión técnica' }
    expect(g._exp('revision', e, t, '', 'informe.pdf', {})).toBe('docprincipal por revisar PAF-00012-26 Revisiontecnica.pdf')
    expect(g._exp('aprobado', e, t, '', 'x.pdf', { esAnexo: true, anexoN: 2 })).toBe('anexo2 aprobado PAF-00012-26 Revisiontecnica.pdf')
    expect(g._exp('acorregir', e, t, '', 'x.pdf', {})).toMatch(/^docprincipal por corregir PAF-00012-26 /)
    expect(g._exp('por_firmar', e, t, '', 'x.pdf', {})).toMatch(/^docprincipal por firmar /)
    expect(g._exp('por_notificar', e, t, '', 'x.pdf', {})).toMatch(/^docprincipal por notificar /)
  })
})

describe('PQRSD: renombre por estado y reconocimiento de nombres', () => {
  const c = ctxCore()

  it('por firmar → aprobado V2 conservando el número de expediente', async () => {
    c.renombres.length = 0
    const wf = { documentos: [{ fileId: 'f1', nombre: 'PAF-0009-21.pdf', entrega_n: 2 }] }
    await c._renWf(wf, 'por_firmar')
    expect(wf.documentos[0].nombre).toBe('por firmar V2 PAF-0009-21.pdf')
    await c._renWf(wf, 'aprobado')
    expect(wf.documentos[0].nombre).toBe('aprobado V2 PAF-0009-21.pdf')
    const wf2 = { documentos: [{ fileId: 'f2', nombre: 'por_firmar-v1-wq261892.pdf', entrega_n: 1 }] }
    await c._renWf(wf2, 'revision')
    expect(wf2.documentos[0].nombre).toBe('por revisar V1 wq261892.pdf')
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
  })
})
