/**
 * PQRSD: al devolver → marcar/renombrar «por corregir Vn»;
 * al aprobar → borrar historial; en Consulta etiquetar / ocultar tras aprobar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

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

describe('PQRSD corrección: marcar, limpiar y etiqueta', () => {
  it('ncaRechazarRespuesta marca y renombra con estados amplios + Gmail', () => {
    const src = extraer(core, ['ncaRechazarRespuesta'])
    expect(src).toContain('_pqrsMarcarDocsComoPorCorregir')
    expect(src).toContain('sstSolicitarGmailParaAdjuntar')
    expect(src).toContain('oficio_firmado')
    expect(src).toContain("await _pqrsRenombrarDocsDriveWf(wf,'acorregir'")
  })

  it('_pqrsMarcarDocsComoPorCorregir deja version_historial', () => {
    const c = createContext({})
    runInContext(
      extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsMarcarDocsComoPorCorregir']),
      c
    )
    const docs = [
      { fileId: 'a', driveEstado: 'revision', entrega_n: 2, tipo: 'oficio_firmado' },
      { fileId: 'b', driveEstado: 'notificado', notificado: true }
    ]
    c._pqrsMarcarDocsComoPorCorregir(docs, 2)
    expect(c._pqrsDocEsPorCorregir(docs[0])).toBe(true)
    expect(docs[0].version_historial).toBe(true)
    expect(c._pqrsDocEsPorCorregir(docs[1])).toBe(false)
  })

  it('merge archiva entrega previa no marcada como por corregir', () => {
    const c = createContext({ responsableActivo: 'Ana' })
    runInContext(
      extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsDocKey', '_pqrsMarcarDocsComoPorCorregir', '_pqrsMergeDocumentosEntrega']),
      c
    )
    const prev = [{ nombre: 'Oficio', fileId: 'OLD', driveEstado: 'revision', tipo: 'oficio_firmado', entrega_n: 2 }]
    const nuevos = [{ nombre: 'Oficio', fileId: 'NEW', driveEstado: 'revision', tipo: 'oficio_firmado' }]
    const out = c._pqrsMergeDocumentosEntrega(prev, nuevos, 3)
    expect(c._pqrsDocEsPorCorregir(out.find(d => d.fileId === 'OLD'))).toBe(true)
    expect(c._pqrsDocEsPorCorregir(out.find(d => d.fileId === 'NEW'))).toBe(false)
  })

  it('_pqrsLimpiarVersionesCorreccionWf elimina entrega_n anterior y por corregir', async () => {
    const deleted = []
    const c = createContext({
      driveDeleteInstitutional: async (id) => { deleted.push(id); return true },
      taskEsAtenderPqrs: () => true
    })
    runInContext(
      extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsDocKey', '_pqrsLimpiarVersionesCorreccionWf']),
      c
    )
    const wf = {
      entrega_n: 3,
      documentos: [
        { fileId: 'v1', driveEstado: 'acorregir', version_historial: true, entrega_n: 1 },
        { fileId: 'v2', driveEstado: 'revision', entrega_n: 2, tipo: 'oficio_firmado' },
        { fileId: 'v3', driveEstado: 'revision', entrega_n: 3, tipo: 'oficio_firmado' }
      ]
    }
    const e = { _pqrs_respuesta_soportes: [], tasks: [] }
    await c._pqrsLimpiarVersionesCorreccionWf(e, wf)
    expect(wf.documentos.map(d => d.fileId)).toEqual(['v3'])
    expect(deleted.sort()).toEqual(['v1', 'v2'])
  })

  it('_pqrsEtiquetaDocWf antepone · por corregir a oficio firmado', () => {
    const c = createContext({})
    runInContext(
      extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsDocEsAnexoRespuesta', '_pqrsAnexoNumero', '_pqrsEtiquetaDocWf']),
      c
    )
    const d = { tipo: 'oficio_firmado', driveEstado: 'acorregir', version_historial: true, entrega_n: 2, nombre: 'Oficio firmado' }
    expect(c._pqrsEtiquetaDocWf(d)).toBe('Oficio firmado · entrega 2 · por corregir')
  })

  it('consulta oculta historial tras aprobar (postAprobCons)', () => {
    const src = extraer(consulta, ['collectArchivosPqrsLinks'])
    expect(src).toContain('postAprobCons')
    expect(src).toContain('ocultarHistCorr')
    expect(src).toContain('_pqrsEtiquetaDocWf')
  })
})
