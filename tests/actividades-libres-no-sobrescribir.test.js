/**
 * actividades-libres-no-sobrescribir.test.js — Una sesión con la lista de actividades libres vacía
 * o vieja no debe borrar en Firestore las actividades de otros al guardar (se perdieron informes aprobados).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function ctx(locales, remoto) {
  const escritos = {}
  const docs = { 'departamentos/guaviare': { actividadesLibres: remoto }, 'sistema/global': { actividadesLibres: remoto } }
  const c = createContext({
    console,
    actividadesLibres: locales,
    DEPTOS_FIRESTORE: ['guaviare'],
    resolveDeptoActLibre: d => d || 'guaviare',
    window: {
      _db: {},
      _fsDoc: (db, a, b) => a + '/' + b,
      _fsGetDoc: async ref => ({ exists: () => !!docs[ref], data: () => docs[ref] }),
      _fsSetDoc: async (ref, payload) => { escritos[ref] = payload }
    }
  })
  runInContext('const _actLibresQuitadosIds=new Set();\n' + extraer(per, [
    'actLibreMarcarQuitada', 'mergeActLibresConRemotoParaGuardar', 'actLibresRemotoDoc',
    'actividadesLibresForDepto', 'sanitizeActLibreForFirestore', 'saveActividadesLibresDeptoFirestore'
  ]), c)
  return { c, escritos }
}

const act = (id, extra) => Object.assign({ id, codigo: 'ACT-GV-' + id, depto: 'guaviare', estado: 'Atendida' }, extra || {})

describe('Actividades libres: guardar sin borrar las de otros', () => {
  it('sesión con lista vacía no borra las remotas', async () => {
    const { c, escritos } = ctx([], [act('a'), act('b')])
    await c.saveActividadesLibresDeptoFirestore('guaviare')
    expect(escritos['departamentos/guaviare'].actividadesLibres.map(t => t.id)).toEqual(['a', 'b'])
  })

  it('la versión local gana y se conservan las remotas que no tiene', async () => {
    const { c, escritos } = ctx([act('b', { estado: 'Por corregir' }), act('n')], [act('a'), act('b')])
    await c.saveActividadesLibresDeptoFirestore('guaviare')
    const out = escritos['departamentos/guaviare'].actividadesLibres
    expect(out.map(t => t.id)).toEqual(['b', 'n', 'a'])
    expect(out[0].estado).toBe('Por corregir')
  })

  it('quitadas a propósito o eliminadas no se resucitan', async () => {
    const { c, escritos } = ctx([act('e', { eliminada: true })], [act('a'), act('e'), act('x')])
    c.actLibreMarcarQuitada('x')
    await c.saveActividadesLibresDeptoFirestore('guaviare')
    expect(escritos['departamentos/guaviare'].actividadesLibres.map(t => t.id)).toEqual(['a'])
  })

  it('global y guardado legado también combinan con el remoto', () => {
    expect(per).toMatch(/libresGlobal=mergeActLibresConRemotoParaGuardar\(libresGlobal,await actLibresRemotoDoc\(refGlobal\)\)[\s\S]*actividadesLibres:libresGlobal/)
    expect(per.match(/mergeActLibresConRemotoParaGuardar\(libresGlobal/g).length).toBe(2)
  })
})
