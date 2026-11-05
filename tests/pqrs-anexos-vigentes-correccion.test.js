/**
 * pqrs-anexos-vigentes-correccion.test.js — Tras devolver y reentregar (1B+2A):
 * al firmar/notificar solo anexos vigentes de la última entrega_n;
 * quitar en corrección marca wf.documentos; al aprobar se borran de Drive.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

function loadKeep() {
  const c = createContext({})
  runInContext(extraer(core, [
    '_pqrsDocEsAnexoRespuesta',
    '_pqrsDocEsPorCorregir',
    '_pqrsDocEsAnexoVigente',
    '_pqrsAnexosVigentesKeep'
  ]), c)
  return c
}

describe('Anexos vigentes tras corrección (1B 2A)', () => {
  it('_pqrsAnexosVigentesKeep: solo anexos de la última entrega_n', () => {
    const c = loadKeep()
    const docs = [
      { nombre: 'Oficio v1', tipo: 'drive', entrega_n: 1, fileId: 'O1' },
      { nombre: 'Anexo 1', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 1, fileId: 'A1' },
      { nombre: 'Oficio v2', tipo: 'drive', entrega_n: 2, fileId: 'O2' },
      { nombre: 'Anexo 1 nuevo', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 2, fileId: 'A2' }
    ]
    expect(c._pqrsAnexosVigentesKeep(docs).map(d => d.fileId)).toEqual(['A2'])
  })

  it('_pqrsAnexosVigentesKeep: reentrega sin anexos → lista vacía (no revive v1)', () => {
    const c = loadKeep()
    const docs = [
      { nombre: 'Anexo viejo', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 1, fileId: 'A1' },
      { nombre: 'Oficio v2', tipo: 'drive', entrega_n: 2, fileId: 'O2' }
    ]
    expect(c._pqrsAnexosVigentesKeep(docs)).toEqual([])
  })

  it('_pqrsAnexosVigentesKeep: excluye corr_descartado y por corregir', () => {
    const c = loadKeep()
    const docs = [
      { nombre: 'Anexo quitado', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 2, fileId: 'Q', corr_descartado: true },
      { nombre: 'Anexo corr', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 2, fileId: 'C', driveEstado: 'acorregir' },
      { nombre: 'Anexo ok', tipo: 'anexo_respuesta', es_anexo: true, entrega_n: 2, fileId: 'OK' }
    ]
    expect(c._pqrsAnexosVigentesKeep(docs).map(d => d.fileId)).toEqual(['OK'])
  })

  it('informeCorreccionOnQuitar marca el mismo fileId en wf.documentos', () => {
    const t = {
      estado: 'Por corregir',
      soportes: [{ id: 'g', driveFileId: 'G1', label: 'Anexo 1', es_anexo: true }]
    }
    const e = {
      _exp: 'E1',
      pqrsWf: { documentos: [{ fileId: 'G1', nombre: 'Anexo 1', tipo: 'anexo_respuesta', es_anexo: true }] }
    }
    const c = createContext({
      getTaskAny: () => t,
      estadoTask: x => x.estado,
      getSoportesUltimaEntrega: x => x.soportes,
      soporteEsAnexoEntrega: s => !!s.es_anexo,
      mutateTask: (_e, _k, fn) => { fn(t); return true },
      getExpById: () => e,
      getPqrsWorkflow: exp => exp.pqrsWf || {},
      setPqrsWorkflow: (exp, patch) => { exp.pqrsWf = Object.assign({}, exp.pqrsWf, patch) }
    })
    runInContext(extraer(er, [
      'entregaCorreccionAplica', 'entregaCorreccionEsAnexo', 'entregaCorreccionSoportesDesdePqrsWf',
      'entregaCorreccionSoportesPrevios', 'informeCorreccionItem', 'informeCorreccionOnQuitar'
    ]), c)
    c.informeCorreccionOnQuitar({ driveFileId: 'G1', esAnexo: true, corrPrev: { expId: 'E1', taskId: 'T1' } })
    expect(t.soportes[0].corr_descartado).toBe(true)
    expect(e.pqrsWf.documentos[0].corr_descartado).toBe(true)
    expect(e.pqrsWf.documentos[0].driveEstado).toBe('acorregir')
  })

  it('limpiarSoportesPorCorregirTask: corr_descartado va a trash (borrar Drive al aprobar)', () => {
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && s.es_anexo),
      soporteEsDocRadicacion: () => false,
      esSoporteEnvioCorreoItem: () => false
    })
    runInContext(extraer(core, ['soporteEsPorCorregir', 'limpiarSoportesPorCorregirTask']), c)
    const t = {
      soportes: [
        { id: 'm', driveFileId: 'M', activo: true, loteEntrega: 'L2', driveEstado: 'revision' },
        { id: 'q', driveFileId: 'Q', es_anexo: true, corr_descartado: true, activo: false, version_historial: true, loteEntrega: 'L1' },
        { id: 'a', driveFileId: 'A', es_anexo: true, activo: true, loteEntrega: 'L2' }
      ]
    }
    const trash = c.limpiarSoportesPorCorregirTask(t)
    expect(t.soportes.map(s => s.id)).toEqual(['m', 'a'])
    expect(trash.map(s => s.id)).toEqual(['q'])
  })

  it('firmado / notif / cierre usan _pqrsAnexosVigentesKeep', () => {
    expect(extraer(core, ['pqrsDirectorConfirmarFirmado'])).toContain('_pqrsAnexosVigentesKeep')
    expect(extraer(core, ['collectDocsParaNotificacionCorreo'])).toContain('_pqrsAnexosVigentesKeep')
    expect(firma).toContain('_pqrsAnexosVigentesKeep')
  })

  it('entregaCorreccionSoportesDesdePqrsWf omite corr_descartado', () => {
    expect(extraer(er, ['entregaCorreccionSoportesDesdePqrsWf'])).toContain('corr_descartado')
  })
})
