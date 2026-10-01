/**
 * entrega-adjunto-referencia.test.js — Entregas del responsable sin recuadro de comentario:
 * el adjunto es opcional, salvo que se diligencie un N° de referencia (oficio, concepto, acto, factura).
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

function montar(campos, facRefs) {
  const avisos = []
  const c = {
    Array, String, avisos,
    document: {
      getElementById: id => (id in campos ? campos[id] : null),
      querySelectorAll: () => (facRefs || []).map(v => ({ value: v }))
    },
    notif: (m, t) => avisos.push([m, t])
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/entrega-responsable.js'),
    ['entregaRefDiligenciadaLabel', 'entregaValidarAdjuntoPorReferencia']), c)
  return c
}

const sinAdj = { links: [], files: [], anexos: [], preUploaded: [] }

describe('Adjunto según N° de referencia', () => {
  it('sin N° de referencia se puede entregar sin adjunto', () => {
    const c = montar({})
    expect(c.entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(true)
    expect(c.avisos).toHaveLength(0)
  })

  it('con N° de concepto exige adjunto', () => {
    const c = montar({ 'entrega-reg-concepto': { value: 'CT-1' } })
    expect(c.entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(false)
    expect(c.avisos[0][0]).toContain('N° de concepto')
    expect(c.entregaValidarAdjuntoPorReferencia({ files: [{}] })).toBe(true)
  })

  it('oficio, acto y factura también exigen adjunto', () => {
    expect(montar({ 'entrega-resp-oficio': { value: 'DSGV-1' } }).entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(false)
    expect(montar({ 'entrega-ofi-req-oficio': { value: 'DSGV-2' } }).entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(false)
    expect(montar({ 'entrega-reg-acto-num': { value: '123' } }).entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(false)
    expect(montar({}, ['', 'F-9']).entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(false)
    expect(montar({}, ['F-9']).entregaValidarAdjuntoPorReferencia({ links: ['https://drive'] })).toBe(true)
  })

  it('PQRSD conserva su propia validación', () => {
    const c = montar({ 'pqrs-entrega-campos': {}, 'entrega-reg-concepto': { value: 'CT-1' } })
    expect(c.entregaValidarAdjuntoPorReferencia(sinAdj)).toBe(true)
  })

  it('el panel del responsable ya no pinta el recuadro de comentario (encargado sí)', () => {
    const core = read('js/core.js')
    expect(core).toContain("if(!esPqrsEntrega&&(finalizarEnc||autoEnc)){")
    expect(read('js/entrega-responsable.js')).not.toContain('Comentario sobre esta entrega (obligatorio si no adjunta archivo)')
  })
})
