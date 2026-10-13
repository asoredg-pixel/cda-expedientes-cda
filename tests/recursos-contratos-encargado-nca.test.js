/**
 * recursos-contratos-encargado-nca.test.js — El encargado NCA de Guaviare ve en Recursos › Contratos
 * los informes aprobados de todos los responsables de Guaviare (el responsable sigue viendo solo los suyos).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rec = readFileSync(resolve(root, 'js/recursos.js'), 'utf8')
const gm = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

function ctx(nca, resp) {
  const c = createContext({
    esNcaDeguv: () => nca,
    esModoResponsable: () => !nca && !!resp,
    responsableActivo: resp || '',
    getInstructoresCfg: d => d === 'guaviare' ? [{ nombre: 'Marcela Chara' }, { nombre: 'Yuneisi Sanchez' }, { nombre: '' }] : [],
    estadoTask: t => t.estado,
    taskUsuarioEsAsignado: (t, u) => (t.asignados || []).some(a => a.nombre === u)
  })
  runInContext(extraer(gm, ['driveContratoInformeFolderNames']), c)
  runInContext(extraer(rec, ['recursosContratosVisible', 'recursosContratosNombres', 'recursosContratosEsDeAlguno',
    'recursosContratosArbol', 'recursosContratosInformesOcultos']), c)
  return c
}

const task = (id, numero, quien, estado) => ({
  id, estado, asignados: [{ nombre: quien }], soportes: [],
  informeContrato: { numero, contratista: quien, inicio: '2026-01-15', fin: '2026-12-15', anio: '2026', n: 1, desde: '2026-01-01', hasta: '2026-01-31' }
})

describe('Recursos › Contratos para el encargado NCA', () => {
  it('el encargado NCA ve la sección y los nombres de todos los responsables de Guaviare', () => {
    const c = ctx(true)
    expect(c.recursosContratosVisible()).toBe(true)
    expect([...c.recursosContratosNombres()]).toEqual(['Marcela Chara', 'Yuneisi Sanchez'])
  })

  it('arma los contratos aprobados de todos y oculta los que están en revisión', () => {
    const c = ctx(true)
    const tasks = [task('a', '234', 'Marcela Chara', 'Atendida'), task('b', '273', 'Yuneisi Sanchez', 'Atendida'),
      task('c', '300', 'Yuneisi Sanchez', 'Por verificar'), task('d', '999', 'Otra Persona', 'Atendida')]
    const arbol = c.recursosContratosArbol(tasks, c.recursosContratosNombres())
    expect(arbol.map(x => x.nombre).sort()).toEqual(['Contrato 234 MARCELA CHARA', 'Contrato 273 YUNEISI SANCHEZ'])
    expect([...c.recursosContratosInformesOcultos(tasks, c.recursosContratosNombres())]).toEqual(['300 YUNEISI SANCHEZ|Informe 1 (01-01-2026 a 31-01-2026)'])
  })

  it('el responsable sigue viendo solo lo suyo', () => {
    const c = ctx(false, 'Marcela Chara')
    expect(c.recursosContratosVisible()).toBe(true)
    expect([...c.recursosContratosNombres()]).toEqual(['Marcela Chara'])
  })
})
