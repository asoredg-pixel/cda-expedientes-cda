/**
 * Trámite o actividad que el encargado se asigna: en Por ejecutar la fila es la de
 * una PQRSD (pin, chat, notas, agenda, ver). Entregar y Por firmar quedan en el visor.
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

function ctx() {
  const c = createContext({
    estadoTask: t => t.estado,
    esModoResponsable: () => false,
    esVistaActividadesDepto: () => true,
    esAdministrador: () => false,
    esTareaDelEncargado: () => true,
    taskEsAtenderPqrs: () => false,
    taskEnFlujoFirmaTramite: () => false
  })
  runInContext(extraer(core, ['taskCreadaPorEncargado', 'taskEncargadoEntregaComoPqrs', 'taskMuestraAccionesComoPqrs']), c)
  return c
}

describe('Encargado: actividad propia con acciones de PQRSD', () => {
  it('reconoce la creada en + crear actividad, también las ya guardadas', () => {
    const c = ctx()
    expect(c.taskCreadaPorEncargado({ creadaPorEncargado: true })).toBe(true)
    expect(c.taskCreadaPorEncargado({
      historial: [{ tipo: 'asignacion', nota: 'Asignada a CARLOS ANDRES QUINTERO SANTOS' }]
    })).toBe(true)
    expect(c.taskCreadaPorEncargado({
      historial: [{ tipo: 'asignacion', nota: 'Actividad sin expediente creada' }]
    })).toBe(true)
    expect(c.taskCreadaPorEncargado({ informeContrato: { n: 1 }, creadaPorEncargado: true })).toBe(false)
    expect(c.taskCreadaPorEncargado({ origen: 'responsable', creadaPorEncargado: true })).toBe(false)
  })

  it('un trámite ya creado, sin marca ni historial, usa la fila de la PQRSD', () => {
    const c = ctx()
    const sod = { estado: 'En ejecución', actividad: 'Certificado de Viabilidad Ambiental' }
    expect(c.taskEncargadoEntregaComoPqrs(sod, { _exp: 'SOD-00065-26' })).toBe(true)
    expect(c.taskMuestraAccionesComoPqrs(sod, { _exp: 'SOD-00065-26' })).toBe(true)
    expect(c.taskMuestraAccionesComoPqrs({ estado: 'Atendida' }, { _exp: 'SOD-00065-26' })).toBe(false)
    expect(c.taskMuestraAccionesComoPqrs({ estado: 'En ejecución', informeContrato: { n: 1 } }, null)).toBe(false)
    const ajeno = ctx()
    ajeno.esTareaDelEncargado = () => false
    expect(ajeno.taskMuestraAccionesComoPqrs({ estado: 'En ejecución' }, { _exp: 'SOD-00065-26' })).toBe(false)
    const tb = extraer(core, ['actEncargadoComoPqrsToolbarHtml'])
    expect(tb).toContain('ncaActPinBtnHtml')
    expect(tb).toContain('openTaskVerDocumentoResp')
    expect(tb).not.toContain('Entregar respuesta')
    expect(tb).not.toContain('openAutoentregaEncargadoModal')
    const rail = extraer(core, ['taskReviewActividadVerRailHtml'])
    expect(rail).toContain('Entregar respuesta')
    expect(rail).toContain('Enviar a Por firmar')
    expect(rail).toContain('taskMuestraAccionesComoPqrs')
    const panel = extraer(core, ['renderEnviarPanelHtml'])
    expect(panel).toContain('taskEncargadoEntregaComoPqrs')
    expect(panel).toContain('submitEntregaEncargadoComoPqrs')
    expect(panel).toContain("modo:encComoPqrs?'enc_acc':'responsable'")
  })
})
