/**
 * consulta-ciudadana-anexos-etiqueta.test.js — En consulta ciudadana los anexos aprobados/notificados
 * se ven como en el correo («Anexo 1: …»), sin prefijos internos de Drive («ANEXO1 POR REVISAR»).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const pqrs = readFileSync(resolve(root, 'js/pqrs.js'), 'utf8')

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
    window: {},
    normalizeTask: t => t,
    estadoTask: t => t.estado,
    taskEnFlujoFirmaTramite: () => false,
    soporteEsDocRadicacion: () => false,
    pqrsNombreEnlaceCorreo: (d) => String(d.driveFilename || d.nombre || d.label || '')
  })
  runInContext(extraer(core, [
    'esSoporteEnvioCorreoItem', 'soporteEsPorCorregir', 'soporteEsAnexoEntrega',
    'pqrsStripPrefijoInternoDrive', 'etiquetaDocNotifPublica'
  ]) + '\n' + extraer(pqrs, ['taskDocAprobadoCiudadano', 'getDocsAprobadosCiudadano']), c)
  return c
}

describe('Consulta ciudadana: etiqueta de anexos como en el correo', () => {
  it('quita «POR REVISAR» y numera los anexos', () => {
    const c = ctx()
    const e = { tasks: [{
      actividad: 'Factura Evaluación', estado: 'Atendida', verificadoPor: 'Enc',
      soportes: [
        { url: 'u1', label: 'ANEXO1 POR REVISAR VDA-00008-26 FACTURA EVALUACION.pdf', es_anexo: true, driveEstado: 'atendido' },
        { url: 'u2', label: 'ANEXO1 POR REVISAR VDA-00008-26 FACTURA EVALUACION.pdf', es_anexo: true, driveEstado: 'atendido' },
        { url: 'u3', label: 'Soporte envío — Factura Evaluación', tipo: 'soporte_notificacion' }
      ]
    }] }
    const labels = c.getDocsAprobadosCiudadano(e).map(d => d.label)
    expect(labels).toEqual([
      'Anexo 1: VDA-00008-26 FACTURA EVALUACION.pdf',
      'Anexo 2: VDA-00008-26 FACTURA EVALUACION.pdf',
      'Soporte envío — Factura Evaluación'
    ])
  })

  it('no publica versiones por corregir', () => {
    const c = ctx()
    const e = { tasks: [{
      estado: 'Atendida', publicado: true,
      soportes: [
        { url: 'old', label: 'Concepto · por corregir', version_historial: true },
        { url: 'new', label: 'Documento principal' }
      ]
    }] }
    expect(c.getDocsAprobadosCiudadano(e).map(d => d.url)).toEqual(['new'])
  })
})
