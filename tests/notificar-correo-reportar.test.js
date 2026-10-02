/**
 * notificar-correo-reportar.test.js — «📬 Reportar notificación» con opción 📧 Correo.
 * Encargado NCA / VITAL: envía y queda atendida. Responsable designado: deja el correo diligenciado
 * y pasa a «Por revisar» del encargado, que aprueba y envía.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

function cuerpoFuncion(src, nombre) {
  return extraerFunciones(src, [nombre])
}

const PQRS_WF = { REVISION_FINAL: 'revision_final_nca', PENDIENTE_NOTIF: 'pendiente_notificacion', LISTA_ENVIO: 'lista_para_envio', CERRADA: 'cerrada_atendida' }

function fakeDocument(valores) {
  return { getElementById: id => (id in valores ? { value: valores[id] } : null) }
}

function ctxTramite(rol, valores) {
  const code = extraerFunciones(read('js/tramite-firma.js'), [
    'taskFirmaFase', 'taskFirmaEnRevisionFinalNotif', 'getTaskFirmaWf',
    'tramiteEncargadoNotificaCierraDirecto', 'tramiteNotifCorreoPropuesta', 'tramiteGuardarCorreoPropuestoNotif'
  ])
  const calls = { marcar: 0, notif: [], closed: 0 }
  const ctx = createContext({
    window: {},
    PQRS_WF,
    document: fakeDocument(valores || {}),
    hoy: () => '2026-10-02',
    esCargoVital: () => rol === 'vital',
    esModoResponsable: () => rol === 'vital' || rol === 'responsable',
    esModoOficinaDeguv: () => false,
    esAdministrador: () => false,
    esNcaDeguv: () => rol === 'nca',
    esVistaActividadesDepto: () => rol === 'nca',
    tramitePuedeNotificarCorreo: () => rol === 'nca' || rol === 'vital',
    sstEmailChipsConfirmarPendientes: () => '',
    marcarActividadTrasNotifReportada: (tk) => { calls.marcar++; tk.estado = 'Por verificar' },
    notif: (m, k) => calls.notif.push([m, k]),
    closeTaskModal: () => { calls.closed++ },
    calls
  })
  runInContext(code + '\nthis._f={cierra:tramiteEncargadoNotificaCierraDirecto,prop:tramiteNotifCorreoPropuesta,guardar:tramiteGuardarCorreoPropuestoNotif};', ctx)
  ctx._task = { id: 't1', firmaWf: { fase: PQRS_WF.PENDIENTE_NOTIF, notificar_por: 'Ana' }, historial: [] }
  runInContext('var _tk=null;function mutateTask(r,id,fn){fn(_tk);return true;}', ctx)
  ctx._setTask = t => runInContext('_tk=' + JSON.stringify(t) + ';', ctx)
  ctx._getTask = () => runInContext('_tk', ctx)
  return ctx
}

describe('Trámites: reportar notificación por correo', () => {
  it('presencial / WhatsApp / aviso: solo el encargado NCA cierra directo; VITAL y responsable pasan a revisión', () => {
    expect(ctxTramite('vital')._f.cierra({})).toBe(false)
    expect(ctxTramite('nca')._f.cierra({})).toBe(true)
    expect(ctxTramite('responsable')._f.cierra({})).toBe(false)
  })

  it('responsable designado: el correo queda diligenciado y pasa a Por revisar sin enviarse', () => {
    const c = ctxTramite('responsable', {
      'tramite-notif-to': 'ciudadano@correo.com', 'tramite-notif-cc': '', 'tramite-notif-bcc': '',
      'tramite-notif-asunto': 'Notificación', 'tramite-notif-cuerpo': 'Cordial saludo'
    })
    c._setTask({ id: 't1', firmaWf: { fase: PQRS_WF.PENDIENTE_NOTIF, notificar_por: 'Ana' }, historial: [] })
    expect(c._f.guardar('EXP1', 't1', 'Ana', null)).toBe(true)
    const tk = c._getTask()
    expect(tk.firmaWf.fase).toBe(PQRS_WF.REVISION_FINAL)
    expect(tk.firmaWf.canal).toBe('correo')
    expect(tk.firmaWf.email_to).toBe('ciudadano@correo.com')
    expect(tk.firmaWf.cuerpo).toBe('Cordial saludo')
    expect(tk.firmaWf.notificacion_reportada.correo_propuesta).toBe(true)
    expect(tk.firmaWf.notificar_por).toBe('Ana')
    expect(tk.historial.at(-1).tipo).toBe('notif_correo_propuesta')
    expect(c.calls.marcar).toBe(1)
    expect(c._f.prop(tk)).toBe(true)
  })

  it('sin destinatario no guarda nada', () => {
    const c = ctxTramite('responsable', { 'tramite-notif-to': '', 'tramite-notif-cuerpo': 'x' })
    c._setTask({ id: 't1', firmaWf: { fase: PQRS_WF.PENDIENTE_NOTIF }, historial: [] })
    expect(c._f.guardar('EXP1', 't1', 'Ana', null)).toBe(false)
    expect(c._getTask().firmaWf.fase).toBe(PQRS_WF.PENDIENTE_NOTIF)
    expect(c.calls.marcar).toBe(0)
  })

  it('revisión final presencial (sin propuesta de correo) no se marca como correo propuesto', () => {
    const c = ctxTramite('nca')
    expect(c._f.prop({ firmaWf: { fase: PQRS_WF.REVISION_FINAL, notificacion_reportada: { fecha: '2026-10-01' } } })).toBe(false)
  })

  it('panel 📬 y modal muestran 📧 Correo; aprobar-y-cerrar no cierra un correo propuesto sin enviarlo', () => {
    const src = read('js/tramite-firma.js')
    const side = cuerpoFuncion(src, 'renderTaskReviewNotificarSideHtml')
    expect(side).toContain('data-val="correo"')
    expect(side).toContain('tramiteNotifCorreoCamposHtml(e,t,wf)')
    expect(cuerpoFuncion(src, 'tramiteAprobarRevisionFinalNotif')).toContain('tramiteNotifCorreoPropuesta(t)')
    expect(cuerpoFuncion(src, 'openTramiteNotificarModal')).toContain('!tramiteNotifCorreoPropuesta(t)')
    expect(cuerpoFuncion(src, 'submitTramiteNotificar')).toContain('tramiteGuardarCorreoPropuestoNotif(refId,taskId,por,btn)')
  })
})

function ctxPqrs(rol, valores, wf) {
  const code = extraerFunciones(read('js/core.js'), [
    'pqrsPuedeEnviarCorreoNotif', 'pqrsNotifCorreoPropuesta', 'pqrsPuedeAprobarCorreoPropuesto', 'pqrsGuardarCorreoPropuestoNotif'
  ])
  const calls = { marcar: 0, persist: 0 }
  const ctx = createContext({
    window: {},
    PQRS_WF,
    PQRS_WF_CANAL: { CORREO: 'correo' },
    document: fakeDocument(valores || {}),
    hoy: () => '2026-10-02',
    esCargoVital: () => rol === 'vital',
    esNcaDeguv: () => rol === 'nca',
    esOficinaPqrsNca: () => rol === 'nca',
    esAdministrador: () => false,
    esVistaActividadesDepto: () => rol === 'nca',
    puedeGestionarActividadesDepto: () => rol === 'nca',
    esModoOficinaDeguv: () => false,
    esSecretaria: () => false,
    pqrsEsFlujoNcaNotif: e => !e._pqrs_oficina || e._pqrs_oficina === 'guaviare',
    sstEmailChipsConfirmarPendientes: () => '',
    taskEsAtenderPqrs: () => true,
    marcarActividadTrasNotifReportada: () => { calls.marcar++ },
    persistExpedienteGranular: () => { calls.persist++ },
    notif: () => {},
    closeTaskModal: () => {},
    renderPqrsOficinaInbox: () => {},
    calls
  })
  runInContext('var _wf=' + JSON.stringify(wf || { fase: PQRS_WF.PENDIENTE_NOTIF }) + ';' +
    'function getPqrsWorkflow(){return _wf;}function setPqrsWorkflow(e,p){_wf=Object.assign({},_wf,p);}' +
    'function pqrsWorkflowFase(){return _wf.fase;}\n' + code +
    '\nthis._f={enviar:pqrsPuedeEnviarCorreoNotif,prop:pqrsNotifCorreoPropuesta,aprobar:pqrsPuedeAprobarCorreoPropuesto,guardar:pqrsGuardarCorreoPropuestoNotif,wf:function(){return _wf;}};', ctx)
  return ctx
}

describe('PQRSD: reportar notificación por correo', () => {
  const e = { _exp: '20261380', _pqrs_oficina: 'guaviare', tasks: [{ id: 't1' }] }

  it('envía directo VITAL (flujo NCA) y el encargado; el responsable no', () => {
    expect(ctxPqrs('vital')._f.enviar(e)).toBe(true)
    expect(ctxPqrs('vital')._f.enviar({ _exp: 'x', _pqrs_oficina: 'oap' })).toBe(false)
    expect(ctxPqrs('nca')._f.enviar(e)).toBe(true)
    expect(ctxPqrs('responsable')._f.enviar(e)).toBe(false)
  })

  it('responsable designado: queda en revisión final con correo propuesto; solo el encargado aprueba', () => {
    const c = ctxPqrs('responsable', {
      'pqrs-notif-to': 'ciudadano@correo.com', 'pqrs-notif-cc': '', 'pqrs-notif-bcc': '',
      'pqrs-notif-asunto': 'Respuesta', 'pqrs-notif-cuerpo': 'Cordial saludo'
    }, { fase: PQRS_WF.PENDIENTE_NOTIF, notificar_por: 'Ana' })
    const exp = JSON.parse(JSON.stringify(e))
    expect(c._f.guardar(exp, 'Ana', null)).toBe(true)
    const wf = c._f.wf()
    expect(wf.fase).toBe(PQRS_WF.REVISION_FINAL)
    expect(wf.canal).toBe('correo')
    expect(wf.email_to).toBe('ciudadano@correo.com')
    expect(wf.email_subject).toBe('Respuesta')
    expect(wf.notificacion_reportada.correo_propuesta).toBe(true)
    expect(wf.notificar_por).toBe('Ana')
    expect(exp._pqrs_historial.at(-1).tipo).toBe('notif_correo_propuesta')
    expect(c.calls.marcar).toBe(1)
    expect(c.calls.persist).toBe(1)
    expect(c._f.prop(exp)).toBe(true)
    expect(c._f.aprobar(exp)).toBe(false)
    const enc = ctxPqrs('nca', {}, wf)
    expect(enc._f.aprobar(exp)).toBe(true)
  })

  it('panel 📬, aprobación y guardas del flujo PQRSD', () => {
    const core = read('js/core.js')
    const side = cuerpoFuncion(core, 'renderTaskReviewPqrsNotificarSideHtml')
    expect(side).toContain('data-val="correo"')
    expect(side).toContain('pqrsNotifCorreoCamposHtml(e,wf)')
    const conf = cuerpoFuncion(core, 'pqrsConfirmarNotificacionOficio')
    expect(conf).toContain('!aprobarProp&&!pqrsPuedeEnviarCorreoNotif(e)')
    expect(conf).toMatch(/if\(aprobarProp\)\{[\s\S]*?return;\s*\}\s*\/\/ Sin token oficina/)
    expect(cuerpoFuncion(core, 'ncaAprobarRevisionFinalNotif')).toContain('pqrsNotifCorreoPropuesta(e)')
    const dec = cuerpoFuncion(core, 'renderTaskReviewDecisionSideHtml')
    expect(dec).toContain('actividadNotifCorreoPropuesta(t,e)')
    expect(dec).toContain('pqrsAprobarCorreoPropuestoNotif(')
    expect(dec).toContain('submitTramiteNotificar(')
    expect(dec).toContain('📬 Aprobar y notificar')
  })

  it('barra de gestión PQRSD y apertura de la revisión llevan a Aprobar y notificar', () => {
    const core = read('js/core.js')
    const bar = cuerpoFuncion(core, 'renderTaskVerifyBarHtml')
    expect(bar).toMatch(/btns=propCorreo\s*\?'<button[^']*'[^\n]*📬 Aprobar y notificar/)
    expect(cuerpoFuncion(core, 'taskReviewDecisionRailHtml')).toContain("'Aprobar y notificar'")
    expect(core).toMatch(/canReviewSop&&typeof actividadNotifCorreoPropuesta==='function'&&actividadNotifCorreoPropuesta\(t,e\)\)\{\s*window\._taskReviewDecisionMode='aprobar';/)
  })
})
