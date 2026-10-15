/**
 * informe-correccion-ver-y-eliminar-precargados.test.js — Informe devuelto: en la nueva entrega el responsable ve
 * el informe y todos los anexos de la entrega anterior con 🔍 y 🗑 (como en la primera entrega), aunque algún
 * anexo no esté ligado a una actividad; los precargados no bloquean el envío.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const up = readFileSync(resolve(root, 'js/sst-file-upload.js'), 'utf8')

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

describe('Informe devuelto: informe y anexos precargados con ver y eliminar', () => {
  const t = {
    informeContrato: { n: 2 }, estado: 'Por corregir',
    soportes: [
      { id: 'g', driveFileId: 'G1', driveLink: 'https://drive/g', label: 'Anexo 1 · por corregir', es_anexo: true, loteEntrega: 'L1' },
      { id: 'm', driveFileId: 'INF', driveLink: 'https://drive/m', label: 'Documento principal · por corregir', loteEntrega: 'L1' },
      { id: 'a', driveFileId: 'S1', driveLink: 'https://drive/a', label: 'Act 1 — Actas · soporte 1', informe_act: { n: 1, nombre: 'Actas' }, es_anexo: true, loteEntrega: 'L1' }
    ]
  }
  const staging = {}
  const c = createContext({
    getTaskAny: () => t,
    estadoTask: x => x.estado,
    getSoportesUltimaEntrega: x => x.soportes,
    soporteEsAnexoEntrega: s => s.es_anexo === true,
    sstFileEnviarCtxKey: () => 'k',
    sstFileStagingCtx: k => (staging[k] = staging[k] || { main: null, anexos: [] }),
    sstFileRefreshCtxLists: () => {},
    escAttr: s => String(s), jsStr: s => String(s)
  })
  runInContext(extraer(er, ['informeCorreccionAplica', 'entregaCorreccionAplica', 'entregaCorreccionSoportesPrevios', 'informeCorreccionItem', 'informeCorreccionPrecargar']), c)
  runInContext(extraer(up, ['sstFileRenderItemRow', 'sstFileCollect']), c)
  c.informeCorreccionPrecargar('INF-GV-0001', 'T1')
  const ctx = staging.k

  it('el informe queda en «Informe» aunque un anexo venga primero; todos los anexos se precargan', () => {
    expect(ctx.main.driveFileId).toBe('INF')
    expect(ctx.anexos.map(a => a.driveFileId).sort()).toEqual(['G1', 'S1'])
  })

  it('cada archivo precargado muestra 🔍 Ver documento y 🗑 Quitar', () => {
    [ctx.main].concat(ctx.anexos).forEach(it => {
      const row = c.sstFileRenderItemRow(it, 'k', 'enviar-anexos-list')
      expect(row).toContain('title="Ver documento"')
      expect(row).toContain('sstFileRemove(')
    })
  })

  it('los precargados van como ya subidos (no los frena «cada soporte debe indicar su actividad»)', () => {
    const adj = c.sstFileCollect('k')
    expect(adj.anexos.length).toBe(0)
    expect(adj.preUploaded.length).toBe(3)
    expect(adj.preUploaded.filter(u => !u.esAnexo).map(u => u.driveFileId)).toEqual(['INF'])
  })
})
