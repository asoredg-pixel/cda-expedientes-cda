/**
 * Al reenviar un informe desde el panel de revisión (Por corregir), los soportes
 * precargados están en el staging «enviar-soporte», no en el input de archivo.
 * El modal sigue en modo revisión: hay que leer ese staging igual.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

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

describe('Corrección de informe: el envío lleva los soportes precargados', () => {
  it('el panel de revisión (sin mode enviar) lee el staging de la nueva entrega', () => {
    const keys = []
    const sandbox = {
      document: { getElementById: () => null },
      sstFileEnviarCtxKey: (e, t) => 'enviar-soporte:' + e + ':' + t,
      sstFileCollect: (k) => {
        keys.push(k)
        return {
          files: [{ blob: {}, nombre: 'informe-v2.pdf', tipo: 'application/pdf', esAnexo: false }],
          anexos: [],
          preUploaded: [
            { driveFileId: 'S1', esAnexo: true, informeAct: { n: 1, nombre: 'Actas' }, tipo: 'anexo_respuesta' },
            { driveFileId: 'S14', esAnexo: true, informeAct: { n: 14, nombre: 'Paz y salvo' }, tipo: 'anexo_respuesta' }
          ]
        }
      }
    }
    sandbox.window = sandbox
    sandbox._taskModalCtx = { expId: 'INF-GV26011', taskId: 'T1' }
    sandbox._taskReviewSideMode = 'entrega'
    const c = createContext(sandbox)
    runInContext(extraer(core, ['collectEnviarAdjuntos']), c)
    const adj = c.collectEnviarAdjuntos()
    expect(keys).toEqual(['enviar-soporte:INF-GV26011:T1'])
    expect(adj.files.map(f => f.nombre)).toEqual(['informe-v2.pdf'])
    expect(adj.preUploaded.map(u => u.driveFileId)).toEqual(['S1', 'S14'])
    expect(adj.preUploaded.every(u => u.informeAct && u.informeAct.n)).toBe(true)
  })

  it('fuera del panel de entrega no usa el staging de revisión', () => {
    let called = 0
    const sandbox = {
      document: { getElementById: () => null },
      sstFileEnviarCtxKey: () => 'enviar-soporte:X:Y',
      sstFileCollect: () => { called++; return { files: [{ nombre: 'no' }], anexos: [], preUploaded: [{ driveFileId: 'Z' }] } }
    }
    sandbox.window = sandbox
    sandbox._taskModalCtx = { expId: 'X', taskId: 'Y' }
    sandbox._taskReviewSideMode = 'doc'
    const c = createContext(sandbox)
    runInContext(extraer(core, ['collectEnviarAdjuntos']), c)
    const adj = c.collectEnviarAdjuntos()
    expect(called).toBe(0)
    expect(adj.files || []).toEqual([])
    expect(adj.preUploaded || []).toEqual([])
  })
})
