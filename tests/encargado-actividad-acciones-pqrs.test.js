/**
 * Actividad que el encargado se crea y se asigna: en Por ejecutar las acciones
 * son las de una PQRSD (entregar respuesta, enviar a Por firmar, ver), no la autoentrega.
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
  runInContext(extraer(core, ['taskCreadaPorEncargado', 'taskMuestraAccionesComoPqrs']), c)
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

  it('en Por ejecutar muestra el juego de acciones de PQRSD', () => {
    const c = ctx()
    const t = {
      estado: 'En ejecución',
      historial: [{ tipo: 'asignacion', nota: 'Asignada a CARLOS ANDRES QUINTERO SANTOS' }]
    }
    expect(c.taskMuestraAccionesComoPqrs(t, { _exp: 'SOD-00065-26' })).toBe(true)
    expect(c.taskMuestraAccionesComoPqrs({ estado: 'Atendida', creadaPorEncargado: true }, null)).toBe(false)
    const tb = extraer(core, ['actEncargadoComoPqrsToolbarHtml'])
    expect(tb).toContain('Entregar respuesta')
    expect(tb).toContain('Enviar a Por firmar')
    expect(tb).toContain('openTaskVerDocumentoResp')
    expect(tb).not.toContain('submitAutoentregaEncargado')
    const panel = extraer(core, ['renderEnviarPanelHtml'])
    expect(panel).toContain('submitEntregaEncargadoComoPqrs')
    expect(panel).toContain("modo:encComoPqrs?'enc_acc':'responsable'")
  })
})
