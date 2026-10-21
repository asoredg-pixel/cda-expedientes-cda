/**
 * Al aceptar, las versiones viejas quedan en cola. Cuando se conecta quien las subió,
 * se borran o se renombran sin aviso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createContext, runInContext, Script } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

describe('driveOpEncolarEnTask', () => {
  it('actualiza el renombre y, si luego hay que borrar, deja solo el borrado', () => {
    const c = createContext({})
    runInContext(extraer(core, ['driveOpEncolarEnTask']), c)
    const t = {}
    c.driveOpEncolarEnTask(t, 'f1', 'renombrar', 'APROBADO X.pdf')
    c.driveOpEncolarEnTask(t, 'f1', 'renombrar', 'APROBADO Y.pdf')
    expect(t._drive_ops.map(x => x.nombre)).toEqual(['APROBADO Y.pdf'])
    c.driveOpEncolarEnTask(t, 'f1', 'borrar')
    c.driveOpEncolarEnTask(t, 'f1', 'borrar')
    expect(t._drive_ops.map(x => x.op)).toEqual(['borrar'])
    c.driveOpEncolarEnTask(t, 'f1', 'renombrar', 'APROBADO Z.pdf')
    expect(t._drive_ops.map(x => x.op)).toEqual(['borrar'])
  })
})

describe('driveOpsCompletarAtendida', () => {
  it('en una actividad aceptada encola el historial para borrar y el vigente para renombrar', () => {
    const c = createContext({
      estadoTask: () => 'Atendida',
      parseDrivePreviewUrl: u => ({ id: String(u).indexOf('OLD') >= 0 ? 'old' : 'new' }),
      buildExpedienteDriveFilename: () => 'APROBADO CAS.pdf',
      soporteEsAnexoEntrega: () => false,
      getUltimoReportadoPor: () => 'Ana'
    })
    runInContext(extraer(core, [
      'driveOpEncolarEnTask', 'driveOpIdDeUrl', 'driveOpsCompletarAtendida', '_soporteResolveDriveFileId'
    ]), c)
    const t = {
      estado: 'Atendida',
      soportes: [{
        activo: true,
        driveFileId: 'new',
        driveFilename: 'POR REVISAR V3 CAS-00030-23 SEGUIMIENTO.pdf'
      }],
      historial: [
        { tipo: 'soporte', url: 'https://drive.google.com/file/d/OLD/view' },
        { tipo: 'soporte', url: 'https://drive.google.com/file/d/new/view' },
        { tipo: 'verificacion', url: 'https://drive.google.com/file/d/OLD/view' }
      ]
    }
    expect(c.driveOpsCompletarAtendida(t, { _exp: 'CAS-00030-23' })).toBe(true)
    const ops = t._drive_ops.map(x => x.op + ':' + x.fileId).sort()
    expect(ops).toEqual(['borrar:old', 'renombrar:new'])
    expect(t._drive_ops.find(x => x.fileId === 'new').nombre).toBe('APROBADO CAS.pdf')
  })
})
