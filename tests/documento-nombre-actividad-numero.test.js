/**
 * documento-nombre-actividad-numero.test.js — Correo de notificación y Consulta ciudadana:
 * el documento se llama «Concepto de seguimiento No. CT26597» (no «Documento principal») y el
 * soporte «Soporte envío — Concepto de seguimiento No. CT26597».
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
    taskReviewNumeroDocumentoAct: (e, t) => t.concepto || t.actoNumero || '',
    soporteEsDocRadicacion: s => !!s.radicacion,
    soporteEsAnexoEntrega: s => !!s.esAnexo,
    soporteEsPorCorregir: () => false,
    pqrsStripPrefijoInternoDrive: s => s,
    pqrsNombreEnlaceCorreo: d => d.driveFilename || '',
    normalizeTask: t => t,
    taskDocAprobadoCiudadano: () => true
  })
  runInContext(extraer(core, ['numeroDocSinPrefijoNo', 'taskDocNombrePublico', 'actividadNombreParaSoporteEnvio', 'esSoporteEnvioCorreoItem',
    'etiquetaSoporteEnvioActividad', 'etiquetaDocNotifPublica']) + '\n' + extraer(pqrs, ['getDocsAprobadosCiudadano']), c)
  return c
}

const tConcepto = { id: 't1', actividad: 'Concepto de seguimiento', concepto: 'CT26597' }

describe('Nombre de documento = actividad + número', () => {
  it('nombre público y soporte de envío con número', () => {
    const c = ctx()
    expect(c.taskDocNombrePublico({}, tConcepto)).toBe('Concepto de seguimiento No. CT26597')
    expect(c.etiquetaSoporteEnvioActividad({}, tConcepto, { label: 'Soporte envío — Concepto de seguimiento' }))
      .toBe('Soporte envío — Concepto de seguimiento No. CT26597')
    expect(c.taskDocNombrePublico({}, { actividad: 'Resolución de archivo', actoTipo: 'Resolución que archiva', actoNumero: '123' }))
      .toBe('Resolución que archiva No. 123')
  })

  it('sin número: solo la actividad; radicación no se renombra', () => {
    const c = ctx()
    expect(c.taskDocNombrePublico({}, { actividad: 'Informe técnico' })).toBe('Informe técnico')
    expect(c.taskDocNombrePublico({}, tConcepto, { radicacion: true })).toBe('')
  })

  it('correo: el documento principal usa el nombre público; anexos sin cambio', () => {
    const c = ctx()
    const main = { driveFilename: 'VDA-00011-15 SEGUIMIENTO.pdf', _notif_rol: 'documento', _doc_nombre_publico: 'Concepto de seguimiento No. CT26597' }
    expect(c.etiquetaDocNotifPublica(main, 0)).toBe('Concepto de seguimiento No. CT26597')
    expect(c.etiquetaDocNotifPublica({ driveFilename: 'plano.pdf', _notif_rol: 'anexo', anexo_n: 1 }, 0)).toBe('Anexo 1: plano.pdf')
  })

  it('Consulta ciudadana: concepto y su soporte de envío se diferencian', () => {
    const c = ctx()
    const e = { tasks: [Object.assign({}, tConcepto, { soportes: [
      { url: 'https://d/1', label: 'Documento principal' },
      { url: 'https://d/2', label: 'Soporte envío — Concepto de seguimiento', tipo: 'soporte_notificacion' }
    ] })] }
    const lbls = c.getDocsAprobadosCiudadano(e).map(d => d.label)
    expect(lbls).toEqual(['Concepto de seguimiento No. CT26597', 'Soporte envío — Concepto de seguimiento No. CT26597'])
  })
})
