/**
 * entrega-correo-editable.test.js — Correo diligenciado en la entrega (notificar por correo):
 * visible/editable en «Aprobar entrega» (encargado) y en ✉️ del responsable antes de la revisión.
 * Al guardar solo se escriben los campos cambiados.
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

function fakeDom(vals) {
  const els = {}
  Object.keys(vals).forEach(id => {
    const [orig, val] = vals[id]
    els[id] = {
      value: val,
      _attrs: { 'data-orig': orig },
      getAttribute(k) { return this._attrs[k] },
      setAttribute(k, v) { this._attrs[k] = v }
    }
  })
  els['rev-ent-email-box'] = {}
  return { getElementById: id => els[id] || null, _els: els }
}

function ctx(extra) {
  const c = createContext(Object.assign({
    window: {},
    PQRS_WF_TIPO: { MENSAJE: 'mensaje', OFICIO: 'oficio', INFORMATIVA: 'informativa' },
    escAttr: s => String(s == null ? '' : s),
    esPqrsSecretaria: e => !!(e && e.pqrs),
    taskEsAtenderPqrs: () => true,
    pqrsEsCanalCorreo: c => c === 'correo',
    getTaskFirmaWf: t => t.firmaWf || {},
    taskComentarioAutor: () => 'Ana',
    notif: () => {},
    responsableActivo: 'Ana'
  }, extra || {}))
  runInContext(extraer(core, [
    'taskEntregaCorreoCtx', 'renderTaskEntregaCorreoEditHtml', 'taskEntregaCorreoCambiosUi', 'taskEntregaCorreoGuardar'
  ]), c)
  return c
}

describe('Correo diligenciado en la entrega', () => {
  it('PQRSD oficio con notificación por correo → hay correo; informativa / presencial → no', () => {
    const c = ctx()
    const t = { id: 't1' }
    const eOf = { pqrs: true, _exp: 'P1' }
    c.getPqrsWorkflow = () => ({ tipo: 'oficio', canal: 'correo', email_to: 'a@x.co', cuerpo: 'Hola' })
    const r = c.taskEntregaCorreoCtx('P1', t, eOf)
    expect(r.esPqrs).toBe(true)
    expect(r.to).toBe('a@x.co')
    c.getPqrsWorkflow = () => ({ tipo: 'oficio', canal: 'presencial' })
    expect(c.taskEntregaCorreoCtx('P1', t, eOf)).toBe(null)
    c.getPqrsWorkflow = () => ({ tipo: 'informativa' })
    expect(c.taskEntregaCorreoCtx('P1', t, eOf)).toBe(null)
  })

  it('trámite / libre: usa firmaWf cuando se indicó notificar por correo', () => {
    const c = ctx()
    const t = { id: 't1', actividad: 'Concepto', firmaWf: { notif_correo_entrega: true, email_to: 'b@y.co', email_subject: 'Asunto', cuerpo: 'Texto' } }
    const r = c.taskEntregaCorreoCtx('E1', t, null)
    expect(r).toMatchObject({ esPqrs: false, to: 'b@y.co', asunto: 'Asunto', cuerpo: 'Texto' })
    expect(c.taskEntregaCorreoCtx('E1', { firmaWf: { canal: 'presencial', notif_correo_entrega: false } }, null)).toBe(null)
    const h = c.renderTaskEntregaCorreoEditHtml('E1', 't1', r)
    expect(h).toContain('id="rev-ent-email-to"')
    expect(h).toContain('taskEntregaCorreoGuardar')
  })

  it('al guardar solo escribe los campos cambiados (trámite → firmaWf)', () => {
    const t = { id: 't1', sinExpediente: true, codigo: 'L1', firmaWf: { notif_correo_entrega: true, email_to: 'b@y.co', cuerpo: 'Texto viejo' } }
    const dom = fakeDom({
      'rev-ent-email-to': ['b@y.co', 'B@y.co'],
      'rev-ent-email-cc': ['', ''],
      'rev-ent-email-bcc': ['', ''],
      'rev-ent-email-subject': ['Asunto', 'Asunto'],
      'rev-ent-email-cuerpo': ['Texto viejo', 'Texto nuevo']
    })
    const c = ctx({
      document: dom,
      getTaskAny: () => t,
      mutateTask: (ref, tid, fn) => { fn(t); return true }
    })
    expect(c.taskEntregaCorreoGuardar('L1', 't1', { silent: true })).toBe(true)
    expect(t.firmaWf.cuerpo).toBe('Texto nuevo')
    expect(t.firmaWf.email_body).toBe('Texto nuevo')
    expect(t.firmaWf.email_to).toBe('b@y.co')
    expect(t.firmaWf.correo_editado.campos).toEqual(['cuerpo'])
  })
})
