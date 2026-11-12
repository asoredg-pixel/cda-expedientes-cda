/**
 * Al aprobar un informe, en Drive/Recursos queda un solo PDF del informe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const rec = readFileSync(resolve(root, 'js/recursos.js'), 'utf8')

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

describe('Informe aprobado: un solo PDF', () => {
  it('borra V2/V3 y duplicados; conserva soportes y el PDF vigente', async () => {
    const deleted = []
    let renamed = null
    const t = {
      informeContrato: { n: 1, numero: '272', contratista: 'YESICA CUARAN' },
      soportes: [
        { id: 'old', driveFileId: 'V2', label: 'Documento principal', driveFilename: 'Informe 1 - 272 YESICA CUARAN V2.pdf', loteEntrega: 'lot_1' },
        { id: 'a1', driveFileId: 'ACT', informe_act: { n: 1, nombre: 'CRONOGRAMA' }, es_anexo: true, label: 'Act 1 — CRONOGRAMA' },
        { id: 'now', driveFileId: 'V3', label: 'Documento principal', driveFilename: 'Informe 1 - 272 YESICA CUARAN V3.pdf', activo: true, loteEntrega: 'lot_2' }
      ]
    }
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && (s.es_anexo || s.informe_act)),
      soporteEsPorCorregir: () => false,
      driveEnsureContratoInformeFolder: async () => ({ folderId: 'FOLD' }),
      driveListFolderChildren: async () => ([
        { id: 'V2', name: 'INFORME 1 - 272 YESICA CUARAN V2.pdf', esCarpeta: false },
        { id: 'V3', name: 'INFORME 1 - 272 YESICA CUARAN V3.pdf', esCarpeta: false },
        { id: 'DUP', name: 'INFORME 1 - 272 YESICA CUARAN.pdf', esCarpeta: false },
        { id: 'SOP', name: 'Soportes Informe 1', esCarpeta: true }
      ]),
      driveDeleteInstitutional: async (id) => { deleted.push(id); return true },
      driveRenameInstitutional: async (id, name) => { renamed = { id, name }; return true },
      driveContratoInformeFilename: () => 'Informe 1 - 272 YESICA CUARAN.pdf'
    })
    runInContext(extraer(gmail, ['informePurgarEntregasPreviasAlAprobar']), c)
    const ok = await c.informePurgarEntregasPreviasAlAprobar(t)
    expect(ok).toBe(true)
    expect(deleted.sort()).toEqual(['DUP', 'V2'])
    expect(renamed).toEqual({ id: 'V3', name: 'Informe 1 - 272 YESICA CUARAN.pdf' })
    expect(t.soportes.map(s => s.id).sort()).toEqual(['a1', 'now'])
    expect(t.soportes.find(s => s.id === 'now').driveFilename).toBe('Informe 1 - 272 YESICA CUARAN.pdf')
  })

  it('no borra el informe vigente si ya hay soporte de envío (post-correo)', async () => {
    const deleted = []
    let renamed = null
    const t = {
      informeContrato: { n: 2, numero: '236', contratista: 'MARCELA CHARA' },
      soportes: [
        { id: 'inf', driveFileId: 'INF2', label: 'Informe de contrato', driveFilename: 'Informe 2 - 236 MARCELA CHARA.pdf', activo: true },
        { id: 'a1', driveFileId: 'ACT', informe_act: { n: 1 }, es_anexo: true, label: 'Act 1' },
        {
          id: 'envio', driveFileId: 'SOPENV', tipo: 'soporte_notificacion',
          label: 'Soporte envío — Informe de contrato No. 2', activo: true
        }
      ]
    }
    const c = createContext({
      esSoporteEnvioCorreoItem: s => !!(s && (s.tipo === 'soporte_notificacion' || s.tipo === 'soporte_respuesta')),
      soporteEsAnexoEntrega: s => !!(s && (s.es_anexo || s.informe_act)),
      soporteEsPorCorregir: () => false,
      driveEnsureContratoInformeFolder: async () => ({ folderId: 'FOLD' }),
      driveListFolderChildren: async () => ([
        { id: 'INF2', name: 'Informe 2 - 236 MARCELA CHARA.pdf', esCarpeta: false },
        { id: 'SOPENV', name: 'Soporte_Envio.pdf', esCarpeta: false }
      ]),
      driveDeleteInstitutional: async (id) => { deleted.push(id); return true },
      driveRenameInstitutional: async (id, name) => { renamed = { id, name }; return true },
      driveContratoInformeFilename: () => 'Informe 2 - 236 MARCELA CHARA.pdf'
    })
    runInContext(extraer(gmail, ['informePurgarEntregasPreviasAlAprobar']), c)
    await c.informePurgarEntregasPreviasAlAprobar(t)
    expect(deleted).not.toContain('INF2')
    expect(renamed).toEqual({ id: 'INF2', name: 'Informe 2 - 236 MARCELA CHARA.pdf' })
    expect(t.soportes.map(s => s.id).sort()).toEqual(['a1', 'envio', 'inf'])
  })

  it('la aprobación y Recursos invocan la limpieza', () => {
    expect(extraer(core, ['verificarTaskExp'])).toContain('informePurgarEntregasPreviasAlAprobar')
    expect(extraer(rec, ['recursosContratosCargarDrive'])).toContain('informePurgarEntregasPreviasAlAprobar')
  })
})

describe('Informe de contrato: etiqueta correo con número', () => {
  it('taskDocNombrePublico incluye No. N del informe', () => {
    const c = createContext({ String, Object, Array })
    runInContext(extraer(core, [
      'numeroDocSinPrefijoNo', 'taskReviewNumeroDocumentoAct', 'taskDocNombrePublico'
    ]), c)
    const t = { actividad: 'Informe de contrato', informeContrato: { n: 2, numero: '236' } }
    expect(c.taskReviewNumeroDocumentoAct(null, t)).toBe('2')
    expect(c.taskDocNombrePublico(null, t)).toBe('Informe de contrato No. 2')
  })
})

describe('Informe de contrato: sin soporte de envío PDF', () => {
  it('registrarSoporteEnvioCorreoNotif no genera ni sube PDF', async () => {
    let pdfCalls = 0
    let upCalls = 0
    const c = createContext({
      String, Object, Array, Date, Promise,
      generarPdfSoporteNotificacionActividad: async () => { pdfCalls++; return 'PDF' },
      taskReviewSubirSoporteNotificacion: async () => { upCalls++; return { driveLink: 'x', fileId: 'f' } },
      hoy: () => '2026-11-12',
      taskComentarioAutor: () => 'NCA'
    })
    runInContext(extraer(core, ['registrarSoporteEnvioCorreoNotif']), c)
    const out = await c.registrarSoporteEnvioCorreoNotif(
      null,
      { informeContrato: { n: 2, numero: '236' }, soportes: [] },
      'inf-1',
      { para: 'a@b.com', cuerpo: 'x' },
      []
    )
    expect(out.omitido).toBe(true)
    expect(out.pdfBlob).toBe(null)
    expect(pdfCalls).toBe(0)
    expect(upCalls).toBe(0)
  })

  it('taskReviewConfirmarYNotificar omite generar PDF en informes', () => {
    const fn = extraer(core, ['taskReviewConfirmarYNotificar'])
    expect(fn).toMatch(/esInformeContrato/)
    expect(fn).toMatch(/!esInformeContrato[\s\S]*generarPdfSoporteNotificacionActividad/)
  })
})
