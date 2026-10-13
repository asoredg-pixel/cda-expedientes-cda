/**
 * recursos-contratos-informes.test.js — Recursos › Contratos: cada contratista ve, solo lectura,
 * sus informes de contrato aprobados organizados como en Drive (Contrato › Informe › Soportes › Act).
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

function ctx() {
  const c = createContext({
    estadoTask: t => t.estado,
    taskUsuarioEsAsignado: (t, u) => (t.asignados || []).some(a => a.nombre === u),
    soporteEsPorCorregir: s => s.driveEstado === 'acorregir'
  })
  runInContext(extraer(gm, ['driveContratoInformeFolderNames']), c)
  runInContext(extraer(rec, ['recursosContratosEsDeAlguno', 'recursosContratosArbol', 'recursosContratosInformesOcultos', 'recursosContratosEsDelContratista']), c)
  return c
}

const inf = (n, extra) => Object.assign({ numero: '234', contratista: 'Marcela Chara', inicio: '2026-01-15', fin: '2026-12-15', anio: '2026', n, desde: '2026-0' + n + '-01', hasta: '2026-0' + n + '-28' }, extra || {})
const task = (id, n, estado, soportes, resp) => ({
  id, estado, informeContrato: inf(n), asignados: [{ nombre: resp || 'Marcela Chara' }], soportes
})

describe('Recursos › Contratos', () => {
  it('arma Contrato › Informe › informe presentado + Soportes › Act n', () => {
    const t = task('t1', 1, 'Atendida', [
      { driveFileId: 'f1', driveFilename: 'Informe 1 - 234 MARCELA CHARA.pdf' },
      { driveFileId: 'f2', driveFilename: 'Act2 soporte 1 - 234 MARCELA CHARA.pdf', informe_act: { n: 2, nombre: 'Visitas' } },
      { driveFileId: 'f3', driveFilename: 'Act1 soporte 1 - 234 MARCELA CHARA.pdf', informe_act: { n: 1, nombre: 'Asesorías' } },
      { driveFileId: 'f4', driveFilename: 'viejo.pdf', informe_act: { n: 1, nombre: 'Asesorías' }, driveEstado: 'acorregir' },
      { driveFileId: 'f5', tipo: 'soporte_notificacion', driveFilename: 'correo.pdf' }
    ])
    const arbol = ctx().recursosContratosArbol([t], 'Marcela Chara')
    expect(arbol.length).toBe(1)
    expect(arbol[0].nombre).toBe('Contrato 234 MARCELA CHARA')
    const i = arbol[0].informes[0]
    expect(i.nombre).toBe('Informe 1 (01-01-2026 a 28-01-2026)')
    expect(i.archivos.map(f => f.nombre)).toEqual(['Informe 1 - 234 MARCELA CHARA.pdf'])
    expect(i.archivos[0].link).toBe('https://drive.google.com/file/d/f1/view')
    expect(i.acts.map(a => a.nombre)).toEqual(['Act 1 - Asesorías', 'Act 2 - Visitas'])
    expect(i.acts[0].archivos.map(f => f.nombre)).toEqual(['Act1 soporte 1 - 234 MARCELA CHARA.pdf'])
  })

  it('solo informes aprobados y del propio contratista', () => {
    const arbol = ctx().recursosContratosArbol([
      task('a', 2, 'Atendida', []),
      task('b', 1, 'Atendida', []),
      task('c', 3, 'Por revisar', []),
      task('d', 1, 'Atendida', [], 'Otro Contratista'),
      Object.assign(task('e', 4, 'Atendida', []), { eliminada: true }),
      { id: 'x', estado: 'Atendida', asignados: [{ nombre: 'Marcela Chara' }] }
    ], 'Marcela Chara')
    expect(arbol.length).toBe(1)
    expect(arbol[0].informes.map(i => i.key)).toEqual(['b', 'a'])
  })

  it('separa contratos distintos y sin nombre no muestra nada', () => {
    const t2 = task('z', 1, 'Atendida', [])
    t2.informeContrato = inf(1, { numero: '010', inicio: '2025-02-01', anio: '2025' })
    const c = ctx()
    const arbol = c.recursosContratosArbol([task('a', 1, 'Atendida', []), t2], 'Marcela Chara')
    expect(arbol.map(x => x.anio)).toEqual(['2026', '2025'])
    expect(c.recursosContratosArbol([t2], '').length).toBe(0)
  })

  it('Drive: solo carpetas del contratista y oculta informes aún no aprobados', () => {
    const c = ctx()
    expect(c.recursosContratosEsDelContratista('234 MARCELA CHARA', 'Marcela Chara')).toBe(true)
    expect(c.recursosContratosEsDelContratista('CPS-045-2026 MARCELA CHARA', 'Marcela Chara')).toBe(true)
    expect(c.recursosContratosEsDelContratista('234 ANA MARCELA CHARA', 'Marcela Chara')).toBe(false)
    expect(c.recursosContratosEsDelContratista('273 YUNEISI SANCHEZ', 'Marcela Chara')).toBe(false)
    expect(c.recursosContratosEsDelContratista('MARCELA CHARA', 'Marcela Chara')).toBe(false)
    const ocultos = c.recursosContratosInformesOcultos([
      task('a', 1, 'Atendida', []),
      task('b', 2, 'Por verificar', []),
      task('c', 3, 'Por corregir', [], 'Otro Contratista')
    ], 'Marcela Chara')
    expect([...ocultos]).toEqual(['234 MARCELA CHARA|Informe 2 (01-02-2026 a 28-02-2026)'])
  })
})
