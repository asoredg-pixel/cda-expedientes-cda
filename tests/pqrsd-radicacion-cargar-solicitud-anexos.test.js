/**
 * pqrsd-radicacion-cargar-solicitud-anexos.test.js — Radicación manual (ventanilla): «📎 Cargar solicitud» (oficio
 * escaneado, documento principal) y «📎 Adjuntar anexos». Con solicitud cargada se ve el documento y los anexos;
 * sin solicitud se ve «📝 Solicitud» con el asunto y el detalle del formulario. Las radicadas antes no cambian.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const pq = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')
const gm = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

function ctxVista() {
  const c = createContext({
    window: {},
    pqrsDriveUrlsMatch: (a, b) => String(a) === String(b),
    normMedioRecepcionPqrs: m => m,
    getPqrsWorkflow: e => e._wf || {},
    detalleNotasData: v => (v ? JSON.parse(v) : []),
    fmtF: s => String(s || ''),
    escAttr: s => String(s)
  })
  runInContext(extraer(pq, ['pqrsFueRadicadaPorCorreo']), c)
  runInContext(extraer(core, ['_pqrsEsNombreSoporteRadicacion', '_pqrsEsNombreAnexoRadicacion', '_pqrsCollectDocsRadicacion',
    '_pqrsDocEsPdfSistemaRadicacion', '_pqrsOrdenDocsRadicacionDisplay', 'pqrsOrigenHasMailPane', 'pqrsOrigenMostrarDetalle']), c)
  return c
}

const att = (nombre, link, extra) => Object.assign({ nombre, driveLink: link }, extra || {})
const base = extra => Object.assign({
  _exp: 'YS260500', f_f1: 'Entrega de pruebas PTAR', f_f2: 'Ventanilla',
  _detalle_general: 'Ref. resolución 223', _detalle_notas: '[]'
}, extra)

describe('Vista de la PQRSD según lo que cargó Secretaría', () => {
  const c = ctxVista()

  it('con solicitud cargada: «Solicitud radicada» primero, luego anexos; sin «📝 Solicitud»', () => {
    const e = base({
      _pqrs_solicitud_cargada: true,
      _pqrs_solicitud_link: 'https://d/sol',
      _pqrs_gmail_attachments: [
        att('YS260500 SOLICITUD.pdf', 'https://d/sol', { es_solicitud: true, tipo: 'soporte_radicacion' }),
        att('YS260500 A01.pdf', 'https://d/a1')
      ]
    })
    const docs = c._pqrsCollectDocsRadicacion(e)
    expect(docs.map(d => d.label)).toEqual(['Solicitud radicada', 'Anexo radicado'])
    expect(docs[1].tipo).toBe('anexo_radicacion')
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(false)
  })

  it('solicitud cargada + soporte PDF generado: la solicitud sigue de primera y el PDF del sistema al final', () => {
    const e = base({
      _pqrs_solicitud_cargada: true,
      _pqrs_solicitud_link: 'https://d/sol',
      _pqrs_gmail_attachments: [
        att('YS260500 SOLICITUD.pdf', 'https://d/sol', { es_solicitud: true }),
        att('YS260500 SOL.pdf', 'https://d/gen'),
        att('YS260500 A01.pdf', 'https://d/a1')
      ]
    })
    expect(c._pqrsCollectDocsRadicacion(e).map(d => d.label))
      .toEqual(['Solicitud radicada', 'Anexo radicado', 'Soporte de radicación (PDF)'])
  })

  it('nueva sin solicitud (solo anexos): los anexos no pasan a «Soporte» y sale «📝 Solicitud»', () => {
    const e = base({
      _pqrs_solicitud_cargada: false,
      _pqrs_solicitud_link: 'https://d/a1',
      _pqrs_gmail_attachments: [att('YS260500 A01.pdf', 'https://d/a1'), att('YS260500 A02.jpg', 'https://d/a2')]
    })
    const docs = c._pqrsCollectDocsRadicacion(e)
    expect(docs.every(d => d.tipo === 'anexo_radicacion')).toBe(true)
    expect(docs.map(d => d.label)).toEqual(['Anexo radicado', 'Anexo radicado'])
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(true)
  })

  it('nueva sin archivos: sale «📝 Solicitud»', () => {
    expect(c.pqrsOrigenMostrarDetalle(base({ _pqrs_solicitud_cargada: false }))).toBe(true)
  })

  it('radicada antes del cambio: el primer anexo sigue como «Soporte de radicación» y no sale «📝 Solicitud»', () => {
    const e = base({
      _pqrs_solicitud_link: 'https://d/a1',
      _pqrs_gmail_attachments: [att('YS260421 A01.pdf', 'https://d/a1'), att('YS260421 A02.pdf', 'https://d/a2')]
    })
    const docs = c._pqrsCollectDocsRadicacion(e)
    expect(docs[0].label).toBe('Soporte de radicación (PDF)')
    expect(c.pqrsOrigenMostrarDetalle(e)).toBe(false)
  })

  it('radicada por correo: sin cambios', () => {
    expect(c.pqrsOrigenMostrarDetalle(base({ f_f2: 'Correo', _pqrs_solicitud_cargada: false }))).toBe(false)
  })
})

describe('Subida a Drive al radicar', () => {
  function ctxSubida() {
    const subidos = []
    const c = createContext({
      window: {},
      console,
      notif: () => {},
      tipoRadicacionDesdeMedioPqrs: () => 'radicacion_ventanilla',
      _driveGetBestToken: () => 'tok',
      driveResetPqrsRadicacionCaches: () => {},
      driveEnsurePqrsExpedienteFolders: async () => ({ solicitudFolderId: 'f1', solicitudFolderLink: 'https://d/f1', pqrsFolderLink: 'https://d/p' }),
      pqrsBuildDriveFilename: (k, exp, o) => {
        const ext = String((o && (o.origName || '')) || '').split('.').pop() || 'pdf'
        if (k === 'SOL') return exp + ' SOL.' + ((o && o.origName) ? ext : 'pdf')
        return exp + ' A' + String(o.n).padStart(2, '0') + '.' + ext
      },
      generarPdfSolicitudManual: async () => ({ pdf: true }),
      driveUploadInstitutional: async (file, name) => { subidos.push(name); return { driveLink: 'https://d/' + name } }
    })
    runInContext(extraer(gm, ['subirSoporteRadicacionManual']), c)
    return { c, subidos }
  }

  it('la solicitud se sube primero como «EXP SOLICITUD.ext» y queda como documento principal', async () => {
    const { c, subidos } = ctxSubida()
    const r = await c.subirSoporteRadicacionManual({
      expId: 'YS260500', sinSoporte: true, silentNotif: true,
      solicitudFile: { name: 'oficio escaneado.pdf', type: 'application/pdf' },
      anexosFiles: [{ name: 'foto.jpg', type: 'image/jpeg' }]
    })
    expect(subidos).toEqual(['YS260500 SOLICITUD.pdf', 'YS260500 A01.jpg'])
    expect(r.solicitud.es_solicitud).toBe(true)
    expect(r.solicitud.tipo).toBe('soporte_radicacion')
    expect(r.link).toBe('https://d/YS260500 SOLICITUD.pdf')
    expect(r.anexos).toHaveLength(1)
    expect(r.all[0]).toBe(r.solicitud)
  })

  it('con soporte PDF generado: solicitud, PDF del sistema y anexos; el principal sigue siendo la solicitud', async () => {
    const { c, subidos } = ctxSubida()
    const r = await c.subirSoporteRadicacionManual({
      expId: 'YS260500', sinSoporte: false, silentNotif: true,
      solicitudFile: { name: 'oficio.pdf', type: 'application/pdf' }, anexosFiles: []
    })
    expect(subidos).toEqual(['YS260500 SOLICITUD.pdf', 'YS260500 SOL.pdf'])
    expect(r.link).toBe('https://d/YS260500 SOLICITUD.pdf')
    expect(r.anexos).toHaveLength(0)
  })

  it('sin solicitud: igual que antes (solo anexos)', async () => {
    const { c, subidos } = ctxSubida()
    const r = await c.subirSoporteRadicacionManual({
      expId: 'YS260500', sinSoporte: true, silentNotif: true, anexosFiles: [{ name: 'a.pdf', type: 'application/pdf' }]
    })
    expect(subidos).toEqual(['YS260500 A01.pdf'])
    expect(r.solicitud).toBeNull()
    expect(r.link).toBe('https://d/YS260500 A01.pdf')
  })
})

describe('Formulario de radicación', () => {
  it('dos botones: «Cargar solicitud» (un archivo) y «Adjuntar anexos» (varios)', () => {
    const ui = extraer(pq, ['secAnexoInitUi'])
    expect(ui).toContain("inputId:'sec-sol-file',listId:'sec-sol-list',ctxKey:ctxKey,multi:false,label:'Cargar solicitud'")
    expect(ui).toContain("inputId:'sec-anexo-file',listId:'sec-anexo-list',ctxKey:ctxKey,multi:true,label:'Adjuntar anexos'")
    expect(ui).not.toContain('Agregar archivo')
    expect(html).toContain('<label>Solicitud recibida y anexos (opcional)</label>')
  })

  it('la solicitud y los anexos se separan al recoger los archivos', () => {
    const c = createContext({
      window: {},
      sstFileCtxKeySecRadicacion: () => 'k',
      sstFileCollect: () => ({ files: [{ blob: 'SOL' }], anexos: [{ blob: 'A1' }, { blob: 'A2' }] })
    })
    runInContext(extraer(pq, ['secSolicitudCollectFile', 'secAnexoCollectFiles']), c)
    expect(c.secSolicitudCollectFile()).toBe('SOL')
    expect(c.secAnexoCollectFiles()).toEqual(['A1', 'A2'])
    c.sstFileCollect = () => ({ files: [], anexos: [] })
    expect(c.secSolicitudCollectFile()).toBeNull()
  })

  it('al radicar: marca las nuevas manuales y pasa la solicitud a Drive; correo no cambia', () => {
    const g = extraer(pq, ['guardarPqrsSecretaria'])
    expect(g).toContain("const solicitudFile=!gmailMsgId&&typeof secSolicitudCollectFile==='function'?secSolicitudCollectFile():null;")
    expect(g).toContain('...(gmailMsgId?{}:{_pqrs_solicitud_cargada:false}),')
    expect(g).toContain('anexosFiles:anexoFiles,solicitudFile:solicitudFile,')
    expect(g).toContain('if(manualRes&&manualRes.solicitud)data._pqrs_solicitud_cargada=true;')
  })
})
