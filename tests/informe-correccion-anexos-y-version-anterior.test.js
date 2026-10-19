/**
 * informe-correccion-anexos-y-version-anterior.test.js — Informe devuelto: todos los anexos se precargan
 * como en la primera entrega (quitar = borrar del todo); el informe principal quitado/reemplazado se conserva
 * «por corregir» para que el encargado compare y se borra al aprobar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const up = readFileSync(resolve(root, 'js/sst-file-upload.js'), 'utf8')
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

const sops = () => [
  { id: 'm', driveFileId: 'INF', label: 'Documento principal · por corregir', loteEntrega: 'L2' },
  { id: 'g', driveFileId: 'G1', label: 'Anexo 1 · por corregir', es_anexo: true, anexo_n: 1, loteEntrega: 'L2' },
  { id: 'a1', driveFileId: 'S1', label: 'Act 1 — Actas · soporte 1 · por corregir', informe_act: { n: 1, nombre: 'Actas' }, es_anexo: true, loteEntrega: 'L2' }
]

function ctxEr(t) {
  const staging = {}
  const c = createContext({
    getTaskAny: () => t,
    estadoTask: x => x.estado,
    getSoportesUltimaEntrega: x => x.soportes.filter(s => s.loteEntrega === 'L2'),
    soporteEsAnexoEntrega: s => s.es_anexo === true,
    sstFileEnviarCtxKey: (e, k) => 'k',
    sstFileStagingCtx: k => (staging[k] = staging[k] || { main: null, anexos: [] }),
    sstFileRefreshCtxLists: () => {},
    mutateTask: (e, k, fn) => { fn(t); return true }
  })
  runInContext(extraer(er, ['informeCorreccionAplica', 'entregaCorreccionAplica', 'entregaCorreccionEsAnexo', 'entregaCorreccionSoportesDesdePqrsWf', 'entregaCorreccionSoportesPrevios', 'informeCorreccionItem', 'informeCorreccionPrecargar', 'informeCorreccionOnQuitar']), c)
  return { c, staging }
}

describe('Informe devuelto: anexos como primera entrega y versión anterior para comparar', () => {
  it('precarga también los anexos sin actividad, con su mismo nombre', () => {
    const t = { informeContrato: { n: 1 }, estado: 'Por corregir', soportes: sops() }
    const { c, staging } = ctxEr(t)
    c.informeCorreccionPrecargar('ACT-1', 'T1')
    const ctx = staging.k
    expect(ctx.main.driveFileId).toBe('INF')
    expect(ctx.anexos.map(a => a.driveFileId).sort()).toEqual(['G1', 'S1'])
    const g = ctx.anexos.find(a => a.driveFileId === 'G1')
    expect(g.uploaded.labelAnexo).toBe('Anexo 1')
    expect(g.uploaded.es_anexo).toBe(true)
  })

  it('quitar el informe principal lo conserva (por corregir) y ya no se precarga', () => {
    const t = { informeContrato: { n: 1 }, estado: 'Por corregir', soportes: sops() }
    const { c, staging } = ctxEr(t)
    c.informeCorreccionOnQuitar({ driveFileId: 'INF', esAnexo: false, corrPrev: { expId: 'ACT-1', taskId: 'T1' } })
    expect(t.soportes.map(s => s.id)).toEqual(['m', 'g', 'a1'])
    expect(t.soportes[0].corr_descartado).toBe(true)
    c.informeCorreccionPrecargar('ACT-1', 'T1')
    expect(staging.k.main).toBeNull()
  })

  it('quitar un anexo lo saca del registro', () => {
    const t = { informeContrato: { n: 1 }, estado: 'Por corregir', soportes: sops() }
    const { c } = ctxEr(t)
    c.informeCorreccionOnQuitar({ driveFileId: 'G1', esAnexo: true, corrPrev: { expId: 'ACT-1', taskId: 'T1' } })
    expect(t.soportes.map(s => s.id)).toEqual(['m', 'a1'])
  })

  it('Drive: el informe devuelto no se borra al quitarlo ni al reemplazarlo; los anexos sí', async () => {
    const borrados = []
    const ctx = { main: { id: 'x', corrPrev: {}, driveFileId: 'INF', esAnexo: false }, anexos: [{ id: 'y', corrPrev: {}, driveFileId: 'G1', esAnexo: true }] }
    const c = createContext({
      sstFileStagingCtx: () => ctx, sstFileRefreshCtxLists: () => {}, confirm: () => true, document: { getElementById: () => null },
      sstFileFindItem: (cx, id) => id === 'x' ? { item: cx.main, slot: 'main', idx: -1 } : { item: cx.anexos[0], slot: 'anexos', idx: 0 },
      driveDeleteInstitutional: id => { borrados.push(id); return Promise.resolve() },
      informeCorreccionOnQuitar: () => {}, window: {},
      sstFileConfirmQuitar: (_o, ok) => { if (ok) ok() }
    })
    runInContext(extraer(up, ['sstFileRemove']), c)
    await c.sstFileRemove('k', 'x', 'l')
    await c.sstFileRemove('k', 'y', 'l')
    expect(borrados).toEqual(['G1'])
    expect(extraer(up, ['sstFileOnMainPickApply'])).toContain('if (old.driveFileId && !old.corrPrev && typeof driveDeleteInstitutional')
  })

  it('Comparar: los anexos no se rotulan «Anexo por corregir»', () => {
    expect(core).toContain('const esCorr=soporteEsPorCorregir(s)&&!esAn;')
  })
})
