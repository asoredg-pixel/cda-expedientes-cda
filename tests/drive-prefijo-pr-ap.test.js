/**
 * drive-prefijo-pr-ap.test.js — El PDF en revisión se llama PR … y, al aprobar, AP ….
 * Los nombres viejos POR REVISAR / APROBADO se siguen reconociendo y no se duplican.
 * El renombre usa el mismo fileId del enlace de Drive.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

const gmail = read('js/gmail.js')
const core = read('js/core.js')

const GMAIL_FNS = [
  '_driveSlug', '_driveNombreArchivoPlano', '_driveEstadoLegible', '_driveSafeFileName', '_driveFileExt',
  '_driveTipoDocCorto', '_driveTipoDocumentoNombre', '_driveEntregaNExp', 'buildExpedienteDriveFilename',
  'driveRenameExpedienteSoporte'
]

function ctxNombres() {
  const c = createContext({ window: {} })
  runInContext(extraer(gmail, GMAIL_FNS.filter(n => n !== 'driveRenameExpedienteSoporte')) +
    '\nthis._exp=buildExpedienteDriveFilename;this._legible=_driveEstadoLegible;this._strip=null;', c)
  runInContext(extraer(core, ['pqrsStripPrefijoInternoDrive', 'soporteEsProyeccionIntermedia']) +
    '\nthis._strip=pqrsStripPrefijoInternoDrive;this._proy=soporteEsProyeccionIntermedia;', c)
  return c
}

describe('Prefijos cortos PR y AP en el nombre de Drive', () => {
  const g = ctxNombres()
  const e = { _exp: 'PAF-00012-26' }
  const t = { desc: 'Concepto de seguimiento', conceptoTipo: 'Concepto de seguimiento' }

  it('revisión nueva es PR; aprobado, atendido y notificado son AP', () => {
    expect(g._legible('revision')).toBe('PR')
    expect(g._legible('aprobado')).toBe('AP')
    expect(g._legible('atendido')).toBe('AP')
    expect(g._legible('notificado')).toBe('AP')
    expect(g._exp('revision', e, t, '', 'c.pdf', {})).toBe('PR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._exp('aprobado', e, t, '', 'c.pdf', {})).toBe('AP PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._exp('atendido', e, t, '', 'c.pdf', {})).toBe('AP PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
  })

  it('por corregir, por firmar y por notificar no cambian', () => {
    expect(g._exp('corregir', e, t, '', 'c.pdf', {})).toMatch(/^POR CORREGIR /)
    expect(g._exp('por_firmar', e, t, '', 'c.pdf', {})).toMatch(/^POR FIRMAR /)
    expect(g._exp('por_notificar', e, t, '', 'c.pdf', {})).toMatch(/^POR NOTIFICAR /)
  })

  it('quita PR y AP, y también los prefijos viejos, sin comerse otras palabras', () => {
    expect(g._strip('PR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')).toBe('PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._strip('AP PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')).toBe('PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._strip('POR REVISAR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')).toBe('PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(g._strip('APROBADO V2 PAF-0009-21.pdf')).toBe('PAF-0009-21.pdf')
    expect(g._strip('ANEXO1 PR VDA-00008-26 FACTURA.pdf')).toBe('VDA-00008-26 FACTURA.pdf')
    expect(g._strip('ANEXO1 AP VDA-00008-26 FACTURA.pdf')).toBe('VDA-00008-26 FACTURA.pdf')
    expect(g._strip('PRINCIPAL.pdf')).toBe('PRINCIPAL.pdf')
    expect(g._strip('APROBADO.pdf')).toBe('APROBADO.pdf')
  })

  it('PR cuenta como proyección; AP y un nombre suelto no', () => {
    expect(g._proy({ driveFilename: 'PR PAF-00012-26 CONCEPTO.pdf' })).toBe(true)
    expect(g._proy({ driveFilename: 'POR REVISAR PAF-00012-26 CONCEPTO.pdf' })).toBe(true)
    expect(g._proy({ driveFilename: 'AP PAF-00012-26 CONCEPTO.pdf', driveEstado: 'aprobado' })).toBe(false)
    expect(g._proy({ driveFilename: 'PRINCIPAL.pdf' })).toBe(false)
  })
})

describe('Al aprobar, el mismo archivo pasa de PR o POR REVISAR a AP', () => {
  it('renombra el fileId del enlace y no deja el prefijo anterior pegado', async () => {
    const llamadas = []
    const sop = {
      driveFileId: 'fid-correo',
      driveLink: 'https://drive.google.com/file/d/fid-correo/view',
      driveFilename: 'PR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf',
      driveEstado: 'revision',
      driveInstitutional: true,
      label: 'PR PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf'
    }
    const task = { id: 't1', desc: 'Concepto de seguimiento', conceptoTipo: 'Concepto de seguimiento', soportes: [sop] }
    const c = createContext({
      window: {},
      esSoporteEnvioCorreoItem: () => false,
      driveRenameInstitutional: async (fid, name) => { llamadas.push({ fid, name }); return true }
    })
    runInContext(extraer(gmail, GMAIL_FNS), c)
    const ok = await c.driveRenameExpedienteSoporte(sop, 'aprobado', { _exp: 'PAF-00012-26' }, task, '')
    expect(ok).toBe(true)
    expect(llamadas).toEqual([{ fid: 'fid-correo', name: 'AP PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf' }])
    expect(sop.driveFileId).toBe('fid-correo')
    expect(sop.driveFilename).toBe('AP PAF-00012-26 CONCEPTO SEGUIMIENTO.pdf')
    expect(sop.label).toBe('Documento principal')
  })

  it('un PDF viejo POR REVISAR queda AP, sin duplicar el prefijo, y el id no cambia', async () => {
    const llamadas = []
    const c = createContext({
      window: {},
      driveRenameInstitutional: async (fid, name) => { llamadas.push({ fid, name }); return true }
    })
    runInContext(extraer(gmail, ['_driveNombreArchivoPlano', '_driveEstadoLegible']) + '\n' +
      extraer(core, ['_pqrsRenombrarDocsDriveWf']), c)
    const wf = { documentos: [{
      fileId: 'fid-viejo',
      nombre: 'POR REVISAR WE26453 RSP.pdf',
      driveFilename: 'POR REVISAR WE26453 RSP.pdf',
      driveEstado: 'revision'
    }, {
      fileId: 'fid-pr',
      nombre: 'PR V1 WQ261892.pdf',
      driveFilename: 'PR V1 WQ261892.pdf',
      driveEstado: 'revision',
      entrega_n: 1
    }] }
    await c._pqrsRenombrarDocsDriveWf(wf, 'aprobado')
    expect(llamadas[0]).toEqual({ fid: 'fid-viejo', name: 'AP WE26453 RSP.pdf' })
    expect(llamadas[1]).toEqual({ fid: 'fid-pr', name: 'AP V1 WQ261892.pdf' })
    expect(wf.documentos[0].driveFilename).not.toMatch(/POR REVISAR|PR /)
    expect(wf.documentos[1].driveFilename).toBe('AP V1 WQ261892.pdf')
  })

  it('si sigue en Por corregir, reintenta PR y POR REVISAR, y no toca AP', () => {
    const pedidos = []
    const c = createContext({
      window: {},
      getTaskAny: (expId) => c._tasks[expId],
      estadoTask: (t) => t.estado,
      soporteEsAnexoEntrega: () => false,
      driveRenombrarSoporteActivoExp: (expId) => { pedidos.push(expId); return Promise.resolve() }
    })
    c._tasks = {
      pr: { estado: 'Por corregir', soportes: [{ driveFilename: 'PR PAF-00012-26 CONCEPTO.pdf' }] },
      viejo: { estado: 'Por corregir', soportes: [{ driveFilename: 'POR REVISAR PAF-00012-26 CONCEPTO.pdf' }] },
      ap: { estado: 'Por corregir', soportes: [{ driveFilename: 'AP PAF-00012-26 CONCEPTO.pdf' }] }
    }
    runInContext(extraer(core, ['driveReintentarNombrePorCorregir']), c)
    c.driveReintentarNombrePorCorregir('pr', 't')
    c.driveReintentarNombrePorCorregir('viejo', 't')
    c.driveReintentarNombrePorCorregir('ap', 't')
    expect(pedidos).toEqual(['pr', 'viejo'])
  })
})
