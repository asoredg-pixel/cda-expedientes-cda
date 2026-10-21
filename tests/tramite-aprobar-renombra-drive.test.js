/**
 * tramite-aprobar-renombra-drive.test.js — Concepto/trámite: al aprobar y cerrar
 * (verificarTaskExp) los soportes «POR REVISAR …» deben renombrarse a APROBADO,
 * pidiendo Gmail/Drive y resolviendo fileId desde el enlace si falta.
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

describe('_soporteResolveDriveFileId', () => {
  it('toma fileId del enlace cuando no hay driveFileId', () => {
    const c = createContext({ window: {} })
    runInContext(extraer(core, ['_soporteResolveDriveFileId', 'parseDrivePreviewUrl']), c)
    expect(c._soporteResolveDriveFileId({
      driveLink: 'https://drive.google.com/file/d/abcXYZ123/view',
      driveFilename: 'POR REVISAR RLO-63318-28 SEGUIMIENTO.pdf'
    })).toBe('abcXYZ123')
    expect(c._soporteResolveDriveFileId({ driveFileId: 'fid1', url: 'https://x' })).toBe('fid1')
    expect(c._soporteResolveDriveFileId({ url: 'https://example.com/x.pdf' })).toBe('')
  })
})

describe('devolver no pide permiso extra de Drive', () => {
  it('no solicita el scope drive completo ni avisa al devolver', () => {
    expect(gmail).not.toContain("'https://www.googleapis.com/auth/drive'")
    expect(gmail).not.toContain('function gmailReconectarParaRenombrar')
    const src = extraer(core, ['driveRenombrarSoporteActivoExp'])
    expect(src).not.toContain('gmailReconectarParaRenombrar')
    expect(src).not.toContain('sigue «Por revisar»')
    expect(core).toContain('que se quedó «POR REVISAR»')
  })
})

describe('driveRenombrarSoporteActivoExp (concepto)', () => {
  function ctxRename(t, e) {
    const renombres = []
    const c = createContext({
      window: {},
      renombres,
      getTaskAny: () => t,
      getExpById: () => e,
      getTaskFromExp: () => t,
      isActLibreRef: () => false,
      normalizeTask: (x) => x,
      getUltimoReportadoPor: () => 'Resp',
      esSoporteEnvioCorreoItem: () => false,
      soporteEsPorCorregir: () => false,
      soporteEsAnexoEntrega: () => false,
      getSoporteActivo: () => (t.soportes || [])[0] || null,
      persistExpedienteGranular: async () => {},
      persistExpLocal: () => {},
      driveRenameInstitutional: async (fid, name) => { renombres.push({ fid, name }); return true }
    })
    runInContext(
      extraer(gmail, [
        '_driveNombreArchivoPlano', '_driveEstadoLegible', '_driveSafeFileName', '_driveFileExt',
        '_driveSlug', '_driveTipoDocCorto', '_driveTipoDocumentoNombre', '_driveEntregaNExp',
        'buildExpedienteDriveFilename', 'driveRenameExpedienteSoporte'
      ]) + '\n' +
      extraer(core, ['_soporteResolveDriveFileId', 'parseDrivePreviewUrl', 'driveRenombrarSoporteActivoExp']),
      c
    )
    return c
  }

  it('renombra POR REVISAR → APROBADO con fileId solo en el enlace', async () => {
    const sop = {
      driveLink: 'https://drive.google.com/file/d/fidRlo/view',
      driveFilename: 'POR REVISAR RLO-63318-28 SEGUIMIENTO.pdf',
      driveEstado: 'revision',
      driveInstitutional: true,
      activo: true,
      label: 'Documento principal'
    }
    const t = { id: 't1', actividad: 'Concepto', conceptoTipo: 'Concepto de seguimiento', soportes: [sop] }
    const e = { _exp: 'RLO-63318-28', _depto: 'guaviare' }
    const c = ctxRename(t, e)
    const ok = await c.driveRenombrarSoporteActivoExp('RLO-63318-28', 't1', 'aprobado')
    expect(ok).toBe(true)
    expect(c.renombres.length).toBe(1)
    expect(c.renombres[0].fid).toBe('fidRlo')
    expect(c.renombres[0].name).toMatch(/^APROBADO /i)
    expect(c.renombres[0].name).toMatch(/SEGUIMIENTO/i)
    expect(sop.driveEstado).toBe('aprobado')
    expect(sop.driveFilename).toMatch(/^APROBADO /i)
  })

  it('al devolver, el principal POR REVISAR pasa a POR CORREGIR y el anexo no', async () => {
    const principal = {
      driveFileId: 'p1',
      driveFilename: 'POR REVISAR VDA-00011-15 RESOLUCION TRASLADA DERECHOS.pdf',
      driveEstado: 'acorregir',
      activo: false,
      version_historial: true,
      label: 'Documento principal · por corregir'
    }
    const anexo = {
      driveFileId: 'a1',
      es_anexo: true,
      driveFilename: 'POR REVISAR VDA-00011-15 ANEXO.pdf',
      driveEstado: 'acorregir',
      activo: false
    }
    const t = { id: 't1', actividad: 'Resolución traslada derechos y deberes', estado: 'Por corregir', soportes: [principal, anexo] }
    const e = { _exp: 'VDA-00011-15', _depto: 'guaviare' }
    const c = ctxRename(t, e)
    const ok = await c.driveRenombrarSoporteActivoExp('VDA-00011-15', 't1', 'corregir')
    expect(ok).toBe(true)
    expect(c.renombres.map(r => r.fid)).toEqual(['p1'])
    expect(c.renombres[0].name).toMatch(/^POR CORREGIR /i)
    expect(c.renombres[0].name).toMatch(/VDA-00011-15/i)
    expect(principal.driveFilename).toMatch(/^POR CORREGIR /i)
  })

  it('al aprobar solo renombra el principal vigente, no otro POR REVISAR anterior', async () => {
    const viejo = {
      driveFileId: 'OLD',
      driveFilename: 'POR REVISAR VDA-00011-15 RESOLUCION.pdf',
      driveEstado: 'revision',
      activo: true
    }
    const actual = {
      driveFileId: 'NEW',
      driveFilename: 'POR REVISAR VDA-00011-15 RESOLUCION.pdf',
      driveEstado: 'revision',
      activo: true
    }
    const t = { id: 't1', actividad: 'Resolución', soportes: [viejo, actual] }
    const e = { _exp: 'VDA-00011-15', _depto: 'guaviare' }
    const c = ctxRename(t, e)
    const ok = await c.driveRenombrarSoporteActivoExp('VDA-00011-15', 't1', 'aprobado')
    expect(ok).toBe(true)
    expect(c.renombres.map(r => r.fid)).toEqual(['NEW'])
    expect(c.renombres[0].name).toMatch(/^APROBADO /i)
    expect(viejo.driveFilename).toMatch(/^POR REVISAR /i)
  })

  it('no renombra informe de contrato (nombres fijos)', async () => {
    const sop = {
      driveFileId: 'f1',
      driveFilename: 'Informe 1 - x.pdf',
      driveEstado: 'revision',
      driveInstitutional: true
    }
    const t = { id: 't1', informeContrato: { n: 1 }, soportes: [sop] }
    const e = { _exp: 'X', _contrato_informe: { n: 1 } }
    const c = ctxRename(t, e)
    const ok = await c.driveRenombrarSoporteActivoExp('X', 't1', 'aprobado')
    expect(ok).toBe(false)
    expect(c.renombres.length).toBe(0)
  })
})

describe('limpiarSoportesPorCorregirTask', () => {
  it('al aprobar borra por corregir y los que siguieron POR REVISAR; deja la entrega vigente', () => {
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && s.es_anexo),
      soporteEsDocRadicacion: () => false,
      esSoporteEnvioCorreoItem: () => false
    })
    runInContext(extraer(core, ['soporteEsPorCorregir', 'limpiarSoportesPorCorregirTask']), c)
    const viejo = {
      id: 'v', driveFileId: 'OLD',
      driveFilename: 'POR REVISAR VDA-00011-15 RESOLUCION.pdf',
      driveEstado: 'revision', activo: false
    }
    const corregido = {
      id: 'c', driveFileId: 'C1',
      driveFilename: 'POR CORREGIR VDA-00011-15 RESOLUCION.pdf',
      driveEstado: 'acorregir', version_historial: true, activo: false,
      label: 'Documento principal · por corregir'
    }
    const actual = {
      id: 'n', driveFileId: 'NEW',
      driveFilename: 'POR REVISAR VDA-00011-15 RESOLUCION.pdf',
      driveEstado: 'revision', activo: true, loteEntrega: 'lot2'
    }
    const anexo = {
      id: 'a', es_anexo: true, driveFileId: 'A',
      driveFilename: 'ANEXO1 POR REVISAR VDA-00011-15.pdf',
      activo: true, loteEntrega: 'lot2'
    }
    const t = { soportes: [viejo, corregido, actual, anexo] }
    const trash = c.limpiarSoportesPorCorregirTask(t)
    expect(t.soportes.map(s => s.id)).toEqual(['n', 'a'])
    expect(trash.map(s => s.id).sort()).toEqual(['c', 'v'])
  })
})

describe('verificarTaskExp pide Drive antes de renombrar', () => {
  it('solicita Gmail/Drive y luego renombra', () => {
    const src = extraer(core, ['verificarTaskExp'])
    expect(src).toContain('sstSolicitarGmailParaAdjuntar')
    expect(src.indexOf('sstSolicitarGmailParaAdjuntar')).toBeLessThan(src.indexOf("driveRenombrarSoporteActivoExp(expId,taskId,'aprobado')"))
  })
})
