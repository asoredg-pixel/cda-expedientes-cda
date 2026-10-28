/**
 * traslado-competencia-entidad.test.js — Comunicación a entidad / traslado por competencia:
 * otra casilla, sin botón de consulta ciudadana, y el envío lleva oficio y correo original.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

describe('Traslado por competencia / comunicación a entidad', () => {
  it('la casilla aparece junto a la comunicación interna', () => {
    expect(core).toContain("'nca-rev-notif-entidad'")
    expect(core).toContain("'pqrs-entrega-notif-entidad'")
    expect(core).toContain("'task-rev-notif-entidad'")
    expect(tf).toContain('id="tramite-atajo-notif-entidad"')
    expect(core).toContain('Traslado por competencia / comunicación a entidad')
    expect(core).toContain('sin botón de consulta ciudadana; lleva la solicitud y el oficio si lo adjunta')
  })

  it('el responsable deja la marca en el flujo que ve el encargado', () => {
    expect(extraer(core, ['guardarPqrsRespuestaDatos'])).toContain('wfPatch.comunicacion_entidad=!!opts.comunicacionEntidad')
    expect(extraer(core, ['guardarPqrsRespuestaDatos'])).toContain('wfPatch.traslado_competencia=!!opts.comunicacionEntidad')
  })

  it('el correo a la entidad no lleva consulta ciudadana y conserva el cuerpo', () => {
    const c = createContext({
      document: { getElementById: () => null },
      escAttr: s => String(s == null ? '' : s),
      getPqrsWorkflow: () => ({}),
      pqrsCorreoHtmlBloqueConsulta: id => '<CONSULTA ' + id + '>',
      pqrsCorreoHtmlPieInstitucional: () => '<PIE>'
    })
    runInContext(extraer(core, [
      'pqrsEsComunicacionEntidadEnvio',
      'pqrsEsComunicacionInternaEnvio',
      'pqrsCorreoHtmlComunicacionInterna',
      'pqrsCorreoHtmlRespuesta'
    ]) + '\nthis._html=pqrsCorreoHtmlRespuesta;this._ent=pqrsEsComunicacionEntidadEnvio;', c)
    const e = { _exp: 'PQ1', _tipo_solicitud: 'Petición' }
    expect(c._ent(e, { entidad: true })).toBe(true)
    expect(c._ent(e, { entidad: false })).toBe(false)
    expect(c._ent({ _exp: 'PQ1' }, {})).toBe(false)
    const wf = { comunicacion_entidad: true }
    c.getPqrsWorkflow = () => wf
    expect(c._ent({ _exp: 'PQ1' }, {})).toBe(true)
    const html = c._html(e, 'Se traslada por competencia', [], { entidad: true })
    expect(html).toContain('Se traslada por competencia')
    expect(html).not.toContain('CONSULTA')
    expect(html).not.toContain('Consulta ciudadana')
    const ciudadano = c._html(e, 'Respuesta al usuario', [], { entidad: false, interna: false })
    expect(ciudadano).toContain('<CONSULTA PQ1>')
  })

  it('el oficio de un trámite a una entidad sale sin el botón', () => {
    const c = createContext({
      escAttr: s => String(s == null ? '' : s),
      collectDocsParaNotificacionCorreo: () => [],
      pqrsCorreoHtmlBloqueConsulta: id => '<CONSULTA ' + id + '>',
      pqrsCorreoHtmlPieInstitucional: () => '<PIE>'
    })
    runInContext(extraer(tf, ['tramiteHtmlCuerpoNotifConDocs']) + '\nthis._f=tramiteHtmlCuerpoNotifConDocs;', c)
    const e = { _exp: 'EXP9' }
    expect(c._f(e, { id: 't' }, 'Solicito información', { entidad: true }).htmlBody).not.toContain('CONSULTA')
    expect(c._f(e, { id: 't' }, 'Concepto al usuario').htmlBody).toContain('<CONSULTA EXP9>')
  })

  it('al notificar el oficio se adjuntan el documento y el correo original', () => {
    const pq = extraer(tf, ['pqrsAtajoEnviarCorreoDirecto'])
    expect(pq).toContain('pqrsArmarEnvioTrasladoInterno')
    expect(pq).toContain('pqrsDriveDocToFile')
    expect(pq).toContain('optsInt.entidad=true')
    const tr = extraer(tf, ['tramiteAtajoEnviarCorreoDirecto'])
    expect(tr).toContain('entidad:esEntidad')
    expect(tr).toContain('pqrsDriveDocToFile')
    expect(extraer(core, ['ncaAprobarMensajeSimple'])).toContain('pqrsArmarEnvioTrasladoInterno')
  })
})
