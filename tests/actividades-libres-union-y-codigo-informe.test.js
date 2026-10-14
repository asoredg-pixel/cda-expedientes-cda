/**
 * actividades-libres-union-y-codigo-informe.test.js — Informes de responsables que desaparecían de «Por revisar»:
 * cada cambio en sistema/global reemplazaba la lista y quitaba lo que solo estaba en el registro del departamento.
 * Además el código se calculaba contando, y con la lista incompleta salía repetido (ACT-GV-0001).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const ent = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')

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

function ctxUnion() {
  const c = createContext({ console, Date, Map, Set })
  runInContext('var _actLibresQuitadosIds=new Set();var _actLibresRemotoPorDoc={};\n' + extraer(per, [
    'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'scoreActividadLibreMerge', 'pickMejorActLibre', 'actLibresRemotoCombinado'
  ]), c)
  return c
}

const ahora = Date.now()
const act = { id: 'a1', codigo: 'ACT-GV-0020', estado: 'En ejecución', historial: [{ tipo: 'asignacion', ts: ahora - 86400000 }] }
const informe = { id: 'inf1', codigo: 'ACT-GV-0026', estado: 'Por verificar', fechaReportada: '2026-10-14', historial: [{ tipo: 'reenvio_verificacion', ts: ahora - 60000 }] }

describe('Lista remota combinada (global + departamento)', () => {
  it('un cambio en global no quita el informe que solo está en el departamento', () => {
    const c = ctxUnion()
    c.actLibresRemotoCombinado('depto:guaviare', [act, informe])
    const out = c.actLibresRemotoCombinado('global', [act])
    expect(out.map(t => t.id).sort()).toEqual(['a1', 'inf1'])
  })

  it('si está en ambos, gana la versión más reciente', () => {
    const c = ctxUnion()
    const viejo = Object.assign({}, informe, { estado: 'En ejecución', fechaReportada: '', historial: [{ tipo: 'asignacion', ts: ahora - 86400000 }] })
    c.actLibresRemotoCombinado('global', [viejo])
    const out = c.actLibresRemotoCombinado('depto:guaviare', [informe])
    expect(out).toHaveLength(1)
    expect(out[0].estado).toBe('Por verificar')
  })

  it('todos los puntos de lectura usan la lista combinada', () => {
    expect(per.match(/actLibresRemotoCombinado\('global',g\.actividadesLibres\)/g)).toHaveLength(2)
    expect(per).toMatch(/actLibresRemotoCombinado\('depto:'\+depto,data\.actividadesLibres\)/)
    expect(per).toMatch(/actLibresRemotoCombinado\('depto:'\+deptoId,data\.actividadesLibres\)/)
    expect(per).toMatch(/const rem=actLibresRemotoCombinado\(clave,lista\)/)
  })
})

describe('Código de actividad libre e informe', () => {
  function gen(lista, depto, opts) {
    const c = createContext({ actividadesLibres: lista })
    runInContext(extraer(core, ['genCodigoActLibre']), c)
    return c.genCodigoActLibre(depto, opts)
  }
  const lista = [
    { depto: 'guaviare', codigo: 'ACT-GV-0027' },
    { depto: 'guaviare', codigo: 'ACT-GV-0001' },
    { depto: 'guaviare', codigo: 'ACT-GV-0030', eliminada: true },
    { depto: 'guaviare', codigo: 'INF-GV-0002' }
  ]

  it('consecutivo = mayor existente + 1 (incluye eliminadas)', () => {
    expect(gen(lista, 'guaviare')).toBe('ACT-GV-0031')
  })

  it('informes usan su propio consecutivo INF', () => {
    expect(gen(lista, 'guaviare', { informe: true })).toBe('INF-GV-0003')
    expect(gen([], 'guaviare', { informe: true })).toBe('INF-GV-0001')
    expect(gen([], 'vaupes')).toBe('ACT-VP-0001')
  })

  it('el informe de contrato pide código INF', () => {
    expect(ent).toMatch(/genCodigoActLibre\(deptoOk,\{informe:true\}\)/)
    expect(ent).toMatch(/genCodigoActLibre\(deptoOk,\{informe:informe\}\)/)
  })
})
