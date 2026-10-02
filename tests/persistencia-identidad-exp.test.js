/**
 * persistencia-identidad-exp.test.js — Al guardar un expediente/PQRSD no se reemplaza el objeto en caché.
 * Si se reemplazaba, un flujo async (aprobar y cerrar) seguía mutando la copia vieja y el último guardado
 * pisaba la aprobación de la actividad: tras F5 volvía a «Por revisar».
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

function ctxPersist() {
  const code = extraerFunciones(read('js/persistence.js'), [
    'expedienteDocId', 'mergeExpIntoExpsCache', 'mergeExpFromFirestoreSnapshot',
    'mergeExpedienteTasksLocalRemote', 'applyExpedienteFirestoreChanges'
  ])
  const ctx = createContext({ window: {} })
  runInContext('var exps=[];\n' + code +
    '\nthis._merge=mergeExpIntoExpsCache;this._apply=applyExpedienteFirestoreChanges;' +
    'this._setExps=function(a){exps=a;};this._getExps=function(){return exps;};', ctx)
  return ctx
}

const change = (data, pending) => ({
  type: 'modified',
  doc: { id: data._exp, data: () => JSON.parse(JSON.stringify(data)), metadata: { hasPendingWrites: !!pending } }
})

describe('Caché de expedientes: identidad del objeto al guardar', () => {
  it('guardado exitoso del mismo objeto: no lo reemplaza, solo quita la marca pendiente', () => {
    const c = ctxPersist()
    const e = { _exp: '20261380', _pending_fs_sync: true, _pending_fs_at: 'x', tasks: [{ id: 't1', estado: 'Por verificar' }] }
    c._setExps([e])
    c._merge(e)
    expect(c._getExps()[0]).toBe(e)
    expect(e._pending_fs_sync).toBeUndefined()
    // El flujo sigue mutando «e» y el cambio se ve en la caché
    e._pqrs_workflow = { fase: 'cerrada' }
    expect(c._getExps()[0]._pqrs_workflow.fase).toBe('cerrada')
  })

  it('eco del propio guardado (hasPendingWrites): no reemplaza la copia en memoria', () => {
    const c = ctxPersist()
    const e = { _exp: '20261380', tasks: [{ id: 't1', estado: 'Atendida', historial: [1, 2, 3] }], _pqrs_workflow: { fase: 'revision_nca' } }
    c._setExps([e])
    const snapViejo = { _exp: '20261380', tasks: [{ id: 't1', estado: 'Por verificar', historial: [1] }], _pqrs_workflow: { fase: 'revision_nca' } }
    c._apply([change(snapViejo, true)])
    expect(c._getExps()[0]).toBe(e)
    e._pqrs_workflow = { fase: 'cerrada' }
    expect(c._getExps()[0]._pqrs_workflow.fase).toBe('cerrada')
    expect(c._getExps()[0].tasks[0].estado).toBe('Atendida')
  })

  it('cambio de otro usuario (sin hasPendingWrites): se sigue aplicando', () => {
    const c = ctxPersist()
    const e = { _exp: '20261380', tasks: [{ id: 't1', historial: [1] }], _pqrs_workflow: { fase: 'revision_nca' } }
    c._setExps([e])
    c._apply([change({ _exp: '20261380', tasks: [{ id: 't1', historial: [1, 2] }], _pqrs_workflow: { fase: 'cerrada' } }, false)])
    expect(c._getExps()[0]._pqrs_workflow.fase).toBe('cerrada')
  })

  it('backup pendiente (otro objeto): reemplaza la caché como antes', () => {
    const c = ctxPersist()
    const enCache = { _exp: 'PAF-1', tasks: [] }
    c._setExps([enCache])
    c._merge({ _exp: 'PAF-1', tasks: [], nuevo: 1, _pending_fs_sync: true })
    expect(c._getExps()[0]).not.toBe(enCache)
    expect(c._getExps()[0].nuevo).toBe(1)
    expect(c._getExps()[0]._pending_fs_sync).toBeUndefined()
  })
})
