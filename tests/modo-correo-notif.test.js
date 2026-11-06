/**
 * modo-correo-notif.test.js — Aprobar y notificar:
 * solicitante (botón consulta ciudadana), traslado por competencia (correo original, sin botón),
 * respuesta a oficina interna (sin botón) y respuesta a entidad (enlace «Consultar el trámite»).
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
    document: { getElementById: () => null },
    escAttr: s => String(s == null ? '' : s),
    getPqrsWorkflow: () => ({}),
    pqrsConsultaCiudadanaUrl: id => 'https://app.test/?consulta=' + id,
    pqrsCorreoHtmlBloqueConsulta: id => '<CONSULTA ' + id + '>',
    pqrsCorreoHtmlPieInstitucional: () => ''
  })
  runInContext(extraer(core, [
    'pqrsModoCorreoNotif', 'pqrsCuerpoSegunModoCorreo', 'pqrsCorreoHtmlBloqueTramite',
    'pqrsPatchModoCorreo', 'pqrsCorreoHtmlComunicacionInterna', 'pqrsCorreoHtmlRespuesta'
  ]), c)
  return c
}

describe('Modo del correo al notificar', () => {
  it('tres casillas y el solicitante conserva el botón', () => {
    expect(core).toContain('Al solicitante')
    expect(core).toContain('Traslado por competencia')
    expect(core).toContain('Respuesta a oficina interna')
    expect(core).toContain('Respuesta a entidad o tercero')
    const c = ctx()
    const ciudadano = c.pqrsCorreoHtmlRespuesta({ _exp: 'PQ1' }, 'Respuesta', [], {})
    expect(ciudadano).toContain('<CONSULTA PQ1>')
  })

  it('traslado por competencia usa el cuerpo revisado y no el botón', () => {
    const c = ctx()
    const html = c.pqrsCorreoHtmlRespuesta({ _exp: 'PQ1' }, 'Se remite', [], { modo: 'traslado' })
    expect(html).toContain('Se remite')
    expect(html).not.toContain('traslada por competencia')
    expect(html).not.toContain('A continuación el correo original')
    expect(html).not.toContain('CONSULTA')
    expect(html).not.toContain('Consulta ciudadana')
    expect(html).not.toContain('Consultar el trámite')
  })

  it('respuesta interna no lleva botón ni la frase de consulta ciudadana', () => {
    const c = ctx()
    const html = c.pqrsCorreoHtmlRespuesta(
      { _exp: 'PQ1' },
      'Oficio interno.\nPuede consultarlo en la consulta ciudadana.',
      [],
      { modo: 'resp_interna' }
    )
    expect(html).toContain('Oficio interno.')
    expect(html).not.toContain('consulta ciudadana')
    expect(html).not.toContain('CONSULTA')
    expect(html).not.toContain('Consultar el trámite')
  })

  it('respuesta a entidad lleva el enlace genérico', () => {
    const c = ctx()
    const html = c.pqrsCorreoHtmlRespuesta({ _exp: 'PQ1' }, 'Se responde a la entidad', [], { modo: 'resp_entidad' })
    expect(html).toContain('Se responde a la entidad')
    expect(html).toContain('Consultar el trámite')
    expect(html).toContain('Consulta del trámite')
    expect(html).not.toContain('CONSULTA')
    expect(html).not.toContain('Consulta ciudadana')
    expect(html).not.toContain('ciudadano')
  })

  it('sin opción marcada no deja enviar y abre el aviso', () => {
    let aviso = null
    const els = { 'task-rev-notif-solicitante': { checked: false } }
    const c = createContext({
      document: { getElementById: id => els[id] || null },
      confirmPrecaucion: opts => { aviso = opts }
    })
    runInContext(extraer(core, ['pqrsModoNotifLeer', 'pqrsExigirModoNotifCorreo']), c)
    expect(c.pqrsExigirModoNotifCorreo('task-rev')).toBe(false)
    expect(aviso && aviso.message).toMatch(/Escoja la opción/)
    expect(aviso.hideCancel).toBe(true)
    els['task-rev-notif-solicitante'].checked = true
    expect(c.pqrsExigirModoNotifCorreo('task-rev')).toBe(true)
  })

  it('al guardar, cada modo deja marcas distintas', () => {
    const c = ctx()
    const t = {}
    c.pqrsPatchModoCorreo(t, 'traslado')
    expect(t).toMatchObject({ modo_correo_notif: 'traslado', traslado_competencia: true, comunicacion_interna: false, comunicacion_entidad: false })
    const i = {}
    c.pqrsPatchModoCorreo(i, 'resp_interna')
    expect(i.comunicacion_interna).toBe(true)
    expect(i.traslado_interno).toBe(false)
    const en = {}
    c.pqrsPatchModoCorreo(en, 'resp_entidad')
    expect(en.comunicacion_entidad).toBe(true)
    expect(en.traslado_competencia).toBe(false)
  })
})
