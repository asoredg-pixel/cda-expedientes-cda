/**
 * Consulta → filtro especial «Conceptos de seguimiento» y columnas del Excel.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

const src = extraer(core, [
  'numeroDocSinPrefijoNo',
  'esActividadConceptoSeguimiento',
  'expTieneActividadConceptoSeguimiento',
  'numeroConceptoSeguimientoTask',
  'visitaConceptoSeguimientoNombre',
  'buildConsultaConceptosSeguimientoExportRows'
])

function cargar() {
  const c = createContext({
    getNom: e => e._pn_nombre || e._exp,
    labelDepto: d => d || '',
    getTram: () => ({ nombre: 'Licencia' }),
    getExpById: () => null,
    taskResponsablesLabel: t => t.responsable || '',
    fmtF: s => s || '',
    taskVenceEfectivo: t => t.vence || '',
    consultaBandejaActividadLabel: () => 'Por ejecutar',
    consultaPlazoActividadLabel: () => 'En término',
    consultaExportEstadoActividad: () => 'Por ejecutar',
    conceptosSegData: v => { try { return v ? JSON.parse(v) : [] } catch (e) { return [] } }
  })
  runInContext(src, c)
  return c
}

describe('filtro conceptos de seguimiento', () => {
  it('el menú y la consulta reconocen el filtro', () => {
    expect(html).toContain('<option value="cseg">Conceptos de seguimiento</option>')
    expect(consulta).toContain("qf==='cseg'")
    expect(consulta).toContain('window._conExportQf=qf')
    expect(core).toContain("title:'Conceptos de seguimiento'")
  })

  it('solo cuenta la actividad predeterminada', () => {
    const c = cargar()
    expect(c.esActividadConceptoSeguimiento('Concepto de seguimiento')).toBe(true)
    expect(c.esActividadConceptoSeguimiento('Elaborar concepto técnico')).toBe(false)
    const si = { tasks: [{ id: '1', actividad: 'Concepto de seguimiento' }] }
    const no = { tasks: [{ id: '2', actividad: 'Visita de campo' }, { id: '3', actividad: 'Concepto de seguimiento', eliminada: true }] }
    expect(c.expTieneActividadConceptoSeguimiento(si)).toBe(true)
    expect(c.expTieneActividadConceptoSeguimiento(no)).toBe(false)
  })

  it('el excel trae número, expediente, usuario y quien hizo la visita', () => {
    const c = cargar()
    const tecnico = {
      _exp: 'CAS-00020-22',
      _pn_nombre: 'Vivian',
      _depto: 'CAS',
      tasks: [{
        id: 't1',
        actividad: 'Concepto de seguimiento',
        concepto: 'No. CT26588',
        responsable: 'ENCARGADO',
        historial: [
          { tipo: 'reenvio_verificacion', reportadoPor: 'TECNICO' },
          { tipo: 'traslado', revisionPar: 'solicitud', de: 'TECNICO', a: 'PROFESIONAL' },
          { tipo: 'reenvio_verificacion', reportadoPor: 'PROFESIONAL' }
        ]
      }, {
        id: 'otra',
        actividad: 'Visita de campo'
      }]
    }
    const profesional = {
      _exp: 'CAS-00021-22',
      _pn_nombre: 'Usuario Dos',
      tasks: [{
        id: 't2',
        actividad: 'Concepto de seguimiento',
        _conceptos_seg: '',
        historial: [
          { tipo: 'soporte', reportadoPor: 'PROFESIONAL' },
          { tipo: 'reenvio_verificacion', reportadoPor: 'PROFESIONAL' }
        ]
      }]
    }
    profesional._conceptos_seg = JSON.stringify([{ taskId: 't2', concepto: 'CT9', tipoConcepto: 'Concepto de seguimiento' }])
    const pack = c.buildConsultaConceptosSeguimientoExportRows([tecnico, profesional], '', '')
    expect(pack.hdr.slice(0, 4)).toEqual(['Número del concepto', 'Expediente', 'Usuario', 'Quien hizo la visita'])
    expect(pack.rows).toHaveLength(2)
    expect(pack.rows[0].slice(0, 4)).toEqual(['CT26588', 'CAS-00020-22', 'Vivian', 'TECNICO'])
    expect(pack.rows[1].slice(0, 4)).toEqual(['CT9', 'CAS-00021-22', 'Usuario Dos', 'PROFESIONAL'])
    expect(pack.rows.some(r => r[7] === 'Visita de campo')).toBe(false)
  })
})
