/**
 * Segunda entrega «Mensaje por correo» mientras otra sigue por revisar:
 * no hereda Para/asunto/cuerpo y no borra ni pisa la entrega anterior.
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

const PQRS_WF = { PENDIENTE_REVISION: 'pendiente_revision_nca', CERRADA: 'cerrada', SIN_RESPUESTA: 'sin_respuesta' }
const PQRS_WF_TIPO = { MENSAJE: 'mensaje', OFICIO: 'oficio' }

function ctxBase() {
  const c = createContext({
    PQRS_WF, PQRS_WF_TIPO, JSON, Date, Object, Array, String, Number,
    esPqrsSecretaria: e => !!(e && e._es_pqrs),
    taskEsAtenderPqrs: () => true,
    setPqrsWorkflow: () => { throw new Error('no debe reescribir el workflow de la entrega en revisión') }
  })
  runInContext(extraer(core, [
    'pqrsEstaCerrada', 'getPqrsWorkflow', 'pqrsWorkflowFase',
    'pqrsTaskTieneEntregaPropia', 'pqrsEntregaPendienteEsAjena', 'pqrsGuardarEntregaParalelaEnTask',
    'dedupePqrsAtencionTasks', 'taskEntregaCorreoCtx'
  ]), c)
  return c
}

function expPendiente() {
  return {
    _exp: 'EA260999',
    _es_pqrs: true,
    _tipo_solicitud: 'solicitud PQRSD',
    _estado: 'En trámite',
    _pqrs_respuesta_nota: 'Cuerpo de la entrega por revisar',
    _pqrs_respuesta_soportes: [{ url: 'http://a', label: 'proy1', activo: true, fileId: 'f1' }],
    _pqrs_workflow: JSON.stringify({
      fase: PQRS_WF.PENDIENTE_REVISION,
      task_id: 't1',
      tipo: 'mensaje',
      email_to: 'pendiente@correo.test',
      email_cc: 'copia-pendiente@correo.test',
      email_subject: 'Asunto de la entrega por revisar',
      cuerpo: 'Cuerpo de la entrega por revisar',
      documentos: [{ driveLink: 'http://a', fileId: 'f1', nombre: 'proy1' }],
      entrega_n: 1
    }),
    tasks: [
      {
        id: 't1', actividad: 'Oficio de respuesta', estado: 'Por verificar', fechaReportada: '2026-10-21',
        soportes: [{ url: 'http://a', fileId: 'f1' }],
        firmaWf: { email_to: 'pendiente@correo.test', email_subject: 'Asunto de la entrega por revisar', cuerpo: 'Cuerpo de la entrega por revisar' }
      },
      {
        id: 't2', actividad: 'Oficio de respuesta', estado: 'Por verificar', fechaReportada: '2026-10-22',
        soportes: [{ url: 'http://b', fileId: 'f2' }]
      }
    ]
  }
}

describe('segunda entrega por correo con otra por revisar', () => {
  it('el formulario de una actividad nueva no toma el correo de la que está por revisar', () => {
    const c = ctxBase()
    const e = expPendiente()
    expect(c.pqrsEntregaPendienteEsAjena(e, '')).toBe(true)
    expect(c.pqrsEntregaPendienteEsAjena(e, 't2')).toBe(true)
    expect(c.pqrsEntregaPendienteEsAjena(e, 't1')).toBe(false)
    const fn = core.slice(core.indexOf('function renderPqrsEntregaCamposHtml'), core.indexOf('function pqrsEntregaAddAttachment'))
    expect(fn).toContain('entregaAjena')
    expect(fn).toContain('wfVis.email_to')
    expect(fn).toContain('wfVis.email_subject')
    expect(fn).toContain("entregaAjena?'':(wf.cuerpo")
    expect(core).toContain("renderPqrsEntregaCamposHtml(eExp,{modo:uiEnc?'enc_acc':'responsable',taskId:t&&t.id})")
  })

  it('guardar la segunda entrega deja la anterior y su correo intactos', () => {
    const c = ctxBase()
    const e = expPendiente()
    const wfAntes = e._pqrs_workflow
    const sopAntes = JSON.stringify(e._pqrs_respuesta_soportes)
    expect(c.pqrsGuardarEntregaParalelaEnTask(e, {
      fechaResp: '2026-10-22', tipo: 'mensaje', cuerpo: 'Cuerpo de la nueva actividad',
      emailTo: 'nueva@correo.test', emailCc: '', emailBcc: '', emailSubject: 'Asunto nuevo',
      notifCorreoEntrega: true, taskId: 't2'
    })).toBe(true)
    expect(e._pqrs_workflow).toBe(wfAntes)
    expect(JSON.stringify(e._pqrs_respuesta_soportes)).toBe(sopAntes)
    expect(e._pqrs_respuesta_soportes[0].activo).toBe(true)
    expect(e.tasks[0].eliminada).toBeUndefined()
    expect(e.tasks[0].soportes[0].fileId).toBe('f1')
    expect(e.tasks[0].firmaWf.email_to).toBe('pendiente@correo.test')
    expect(e.tasks[1].firmaWf.email_to).toBe('nueva@correo.test')
    expect(e.tasks[1].firmaWf.email_subject).toBe('Asunto nuevo')
    expect(e.tasks[1].firmaWf.cuerpo).toBe('Cuerpo de la nueva actividad')
    expect(e.tasks[1].eliminada).toBeUndefined()
    const ini = core.indexOf('function guardarPqrsRespuestaDatos')
    const cabeza = core.slice(ini, ini + 450)
    expect(cabeza).toContain('pqrsGuardarEntregaParalelaEnTask(e,opts)')
    expect(cabeza).toContain('return;')
  })

  it('no fusiona dos oficios que ya tienen entrega propia', () => {
    const c = ctxBase()
    const e = expPendiente()
    expect(c.dedupePqrsAtencionTasks(e)).toBe(false)
    expect(e.tasks[0].eliminada).toBeUndefined()
    expect(e.tasks[1].eliminada).toBeUndefined()
    expect(e.tasks[0].soportes[0].fileId).toBe('f1')
    expect(e.tasks[1].soportes[0].fileId).toBe('f2')
  })

  it('la revisión de la segunda actividad muestra su correo, no el de la primera', () => {
    const c = ctxBase()
    const e = expPendiente()
    c.pqrsGuardarEntregaParalelaEnTask(e, {
      fechaResp: '2026-10-22', tipo: 'mensaje', cuerpo: 'Cuerpo de la nueva actividad',
      emailTo: 'nueva@correo.test', emailSubject: 'Asunto nuevo', notifCorreoEntrega: true, taskId: 't2'
    })
    const segunda = c.taskEntregaCorreoCtx(e._exp, e.tasks[1], e)
    const primera = c.taskEntregaCorreoCtx(e._exp, e.tasks[0], e)
    expect(segunda.paralela).toBe(true)
    expect(segunda.to).toBe('nueva@correo.test')
    expect(segunda.asunto).toBe('Asunto nuevo')
    expect(segunda.cuerpo).toBe('Cuerpo de la nueva actividad')
    expect(primera.to).toBe('pendiente@correo.test')
    expect(primera.asunto).toBe('Asunto de la entrega por revisar')
    expect(primera.paralela).toBe(false)
  })
})
