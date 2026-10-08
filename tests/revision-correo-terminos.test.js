/**
 * revision-correo-terminos.test.js — «Por revisar» del encargado:
 * - El correo diligenciado en la entrega aparece debajo de «3. Aprobar y notificar» (fuera del acordeón).
 * - Un solo bloque «Término para cumplir» para las tres opciones:
 *   Aprobar y cerrar → corre desde hoy · Aprobar y notificar → desde el envío (se conserva lo diligenciado)
 *   · Imprimir → queda propuesto y arranca al reportar la notificación / notificar por correo (panel 📬).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
const reqs = readFileSync(resolve(root, 'js/requerimientos.js'), 'utf8')

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

const PQRS_WF_TIPO = { MENSAJE: 'mensaje', OFICIO: 'oficio', INFORMATIVA: 'informativa' }

function fakeDom(els) {
  return { getElementById: id => els[id] || null }
}

function ctxPanel(extra) {
  const calls = { term: [] }
  const c = createContext(Object.assign({
    window: { _taskReviewDecisionMode: 'aprobar', _taskReviewAprobarNotificar: false },
    PQRS_WF_TIPO,
    hoy: () => '2026-10-08',
    jsStr: s => String(s),
    escAttr: s => String(s == null ? '' : s),
    getExpById: () => null,
    getTaskFirmaWf: t => t.firmaWf || {},
    esPqrsSecretaria: () => false,
    taskEsAtenderPqrs: () => false,
    actividadEsRevisionFinalNotif: () => false,
    libreEntregaRespTipoRevision: () => '',
    renderTaskReviewNotifEmailFieldsHtml: () => '<div id="task-rev-notif-email-wrap">[TERM-NOTIF]</div>',
    htmlTerminoCumplBlock: (e, t, opts) => { calls.term.push(opts); return '<div id="term-cumpl-box"></div>' }
  }, extra || {}))
  runInContext(extraer(core, [
    'renderTaskReviewDecisionSideHtml', 'renderTaskReviewAprobarAccHtml',
    'taskEntregaCorreoCtx', 'renderTaskEntregaCorreoEditHtml',
    'taskReviewTermDraftOpts', 'taskReviewTermDraftGuardar', 'taskReviewOpenDecisionPanel'
  ]), c)
  c._calls = calls
  return c
}

const tCorreo = { id: 't1', actividad: 'Oficio de respuesta', firmaWf: { notif_correo_entrega: true, email_to: 'a@x.co', cuerpo: 'Hola' } }

describe('Por revisar: correo diligenciado debajo de «Aprobar y notificar»', () => {
  it('el correo diligenciado va dentro de «2. Aprobar y pasar para Imprimir» (antes del botón) y el término debajo de los acordeones', () => {
    const c = ctxPanel()
    const h = c.renderTaskReviewDecisionSideHtml('E1', 't1', tCorreo)
    const i1 = h.indexOf('1. Aprobar y cerrar')
    const i2 = h.indexOf('2. Aprobar y pasar para Imprimir')
    const i3 = h.indexOf('3. Aprobar y notificar')
    const iCorreo = h.indexOf('id="rev-ent-email-box"')
    const iBtnImp = h.indexOf('taskReviewDecidirImprimir(')
    const iTerm = h.indexOf('id="term-cumpl-box"')
    expect(i1).toBeGreaterThan(0)
    expect(i2).toBeGreaterThan(i1)
    expect(iCorreo).toBeGreaterThan(i2)
    expect(iBtnImp).toBeGreaterThan(iCorreo)
    expect(i3).toBeGreaterThan(iBtnImp)
    expect(h.split('id="rev-ent-email-box"').length).toBe(2)
    expect(iTerm).toBeGreaterThan(i3)
    expect(c._calls.term[0].inicio).toBe('2026-10-08')
    expect(c._calls.term[0].nota).toContain('Imprimir')
  })

  it('sin correo diligenciado: no hay recuadro, pero sí el bloque de término', () => {
    const c = ctxPanel()
    const h = c.renderTaskReviewDecisionSideHtml('E1', 't2', { id: 't2', actividad: 'Informe', firmaWf: {} })
    expect(h).not.toContain('rev-ent-email-box')
    expect(h).toContain('id="term-cumpl-box"')
  })

  it('al abrir «Aprobar y notificar» el correo diligenciado sale debajo, en esa opción, sin duplicar recuadro ni término', () => {
    const c = ctxPanel()
    c.window._taskReviewAprobarNotificar = true
    const h = c.renderTaskReviewDecisionSideHtml('E1', 't1', tCorreo)
    expect(h).not.toContain('rev-ent-email-box')
    expect(h).not.toContain('id="term-cumpl-box"')
    expect(h.indexOf('task-rev-notif-email-wrap')).toBeGreaterThan(h.indexOf('3. Aprobar y notificar'))
    expect(h).toContain('[TERM-NOTIF]')
  })

  it('los campos de «Aprobar y notificar» toman el correo diligenciado en la entrega', () => {
    const c = createContext({ getTaskFirmaWf: t => t.firmaWf || {}, getPqrsWorkflow: () => ({ email_to: 'pqrs@x.co' }) })
    runInContext(extraer(core, ['taskReviewNotifWfFuente']), c)
    expect(c.taskReviewNotifWfFuente(null, tCorreo).email_to).toBe('a@x.co')
    expect(c.taskReviewNotifWfFuente({ _exp: 'P1' }, { id: 't3', firmaWf: {} }).email_to).toBe('pqrs@x.co')
  })

  it('revisión final con correo propuesto: panel propio sin cambios', () => {
    const c = ctxPanel({
      actividadEsRevisionFinalNotif: () => true,
      actividadNotifCorreoPropuesta: () => true,
      taskFirmaEnRevisionFinalNotif: () => true,
      tramiteNotifCorreoCamposHtml: () => '[CAMPOS]'
    })
    const h = c.renderTaskReviewDecisionSideHtml('E1', 't1', tCorreo)
    expect(h).toContain('Revisar notificación por correo')
    expect(h).toContain('submitTramiteNotificar(')
    expect(h).not.toContain('rev-ent-email-box')
  })
})

describe('Borrador del término al re-renderizar', () => {
  it('guarda lo diligenciado y solo lo aplica a la misma actividad; abrir el panel lo limpia', () => {
    const c = ctxPanel({ document: fakeDom({ 'term-cumpl-chk': { checked: true }, 'term-cumpl-dias': { value: '10' } }) })
    c.taskReviewTermDraftGuardar('t1')
    expect(c.taskReviewTermDraftOpts('t1', { inicio: 'x' })).toEqual({ inicio: 'x', marcado: true, dias: '10' })
    expect(c.taskReviewTermDraftOpts('t9', { inicio: 'x' })).toEqual({ inicio: 'x' })
    c.taskReviewOpenSidePanel = () => {}
    c.taskReviewOpenDecisionPanel('aprobar', 'E1', 't1')
    expect(c.window._taskReviewTermDraft).toBe(null)
  })

  it('el panel de notificar usa el borrador', () => {
    const fn = extraer(core, ['renderTaskReviewNotifEmailFieldsHtml'])
    expect(fn).toContain('taskReviewTermDraftOpts(t&&t.id,{inicio:hoy()')
    const conf = extraer(core, ['taskReviewConfirmarYNotificar'])
    expect(conf).toMatch(/taskEntregaCorreoGuardar\(expId,taskId,\{silent:true\}\)\)return;\s*taskReviewTermDraftGuardar\(taskId\);/)
  })
})

describe('htmlTerminoCumplBlock: valores diligenciados y nota', () => {
  function ctxReq(defs) {
    const c = createContext({
      escAttr: s => String(s == null ? '' : s),
      reqHoy: () => '2026-10-08',
      reqActividadExcluida: () => false,
      terminoCumplDefaults: () => Object.assign({ obligatorio: false, marcado: false, dias: '' }, defs || {})
    })
    runInContext(extraer(reqs, ['htmlTerminoCumplBlock']), c)
    return c
  }
  it('opts.marcado / opts.dias priman; nota visible', () => {
    const h = ctxReq().htmlTerminoCumplBlock(null, { id: 't1' }, { marcado: true, dias: '7', nota: 'Corre desde X' })
    expect(h).toContain('id="term-cumpl-chk" checked')
    expect(h).toContain('value="7"')
    expect(h).toContain('Corre desde X')
  })
  it('obligatorio no se puede desmarcar; sin opts queda igual que antes', () => {
    const h = ctxReq({ obligatorio: true, dias: '5' }).htmlTerminoCumplBlock(null, { id: 't1' }, { marcado: false })
    expect(h).toContain('data-obligatorio="1"')
    expect(h).toContain('value="5"')
    const h2 = ctxReq({ dias: '3', marcado: true }).htmlTerminoCumplBlock(null, { id: 't1' }, {})
    expect(h2).toContain('id="term-cumpl-chk" checked')
    expect(h2).toContain('value="3"')
  })
})

function ctxDecidir(t, payload, extra) {
  const calls = { cierre: [], aplica: [], propone: [], mut: 0, imprimir: 0, ofi: 0 }
  const c = createContext(Object.assign({
    window: {},
    PQRS_WF: { RECHAZADA: 'rechazada' },
    hoy: () => '2026-10-08',
    getExpById: () => null,
    getTaskAny: () => t,
    collectTerminoCumplFromUi: () => payload,
    liberarPorCorregirParaAprobacion: () => false,
    actividadEsRevisionFinalNotif: () => false,
    confirmarCierreTask: (eid, tid, opts) => { calls.cierre.push(opts) },
    aplicarTerminoCumplimiento: (ref, tid, p, ctx) => { calls.aplica.push({ ref, tid, p, ctx }); return true },
    proponerTerminoCumplimiento: (ref, tid, p) => { calls.propone.push({ ref, tid, p }); return true },
    mutateTask: (ref, tid, fn) => { calls.mut++; fn(t); return true },
    tramiteLibreParaImprimir: () => { calls.imprimir++ },
    ncaAprobarOficioFirmado: () => { calls.ofi++ }
  }, extra || {}))
  runInContext(extraer(core, [
    '_taskReviewDecidirAprobarRun', 'confirmarCierreTaskReview',
    '_taskReviewDecidirImprimirRun', 'taskReviewProponerTerminoImprimir'
  ]), c)
  c._calls = calls
  return c
}

describe('Aprobar y cerrar: término desde la fecha de aprobación', () => {
  it('trámite: al cerrar aplica el término con inicio hoy', () => {
    const t = { id: 't1' }
    const c = ctxDecidir(t, { otorga: true, dias: 10 })
    c._taskReviewDecidirAprobarRun('E1', 't1')
    expect(c._calls.cierre.length).toBe(1)
    expect(c._calls.cierre[0]).toMatchObject({ keepOpen: false, showProgress: true })
    expect(c._calls.aplica.length).toBe(0)
    c._calls.cierre[0].afterVerify()
    expect(c._calls.aplica[0]).toMatchObject({ ref: 'E1', tid: 't1', ctx: { inicio: '2026-10-08', origen: 'aprobar_cerrar' } })
  })

  it('actividad libre: usa el código de la libre', () => {
    const t = { id: 'L9', sinExpediente: true, codigo: 'LIB-1' }
    const c = ctxDecidir(t, { otorga: true, dias: 5 })
    c._taskReviewDecidirAprobarRun('LIB-1', 'L9')
    c._calls.cierre[0].afterVerify()
    expect(c._calls.aplica[0].ref).toBe('LIB-1')
  })

  it('sin término (no marcado o sin bloque) no aplica; inválido no cierra', () => {
    const t = { id: 't1' }
    let c = ctxDecidir(t, { otorga: false })
    c._taskReviewDecidirAprobarRun('E1', 't1')
    c._calls.cierre[0].afterVerify()
    expect(c._calls.aplica.length).toBe(0)
    c = ctxDecidir(t, null)
    c._taskReviewDecidirAprobarRun('E1', 't1')
    c._calls.cierre[0].afterVerify()
    expect(c._calls.aplica.length).toBe(0)
    c = ctxDecidir(t, false)
    c._taskReviewDecidirAprobarRun('E1', 't1')
    expect(c._calls.cierre.length).toBe(0)
  })

  it('revisión final: sigue usando la fecha de notificación reportada', () => {
    const t = { id: 't1' }
    const fin = []
    const c = ctxDecidir(t, { otorga: true, dias: 4 }, {
      actividadEsRevisionFinalNotif: () => true,
      taskFirmaEnRevisionFinalNotif: () => true,
      tramiteAprobarRevisionFinalNotif: () => fin.push('sin'),
      tramiteAprobarRevisionFinalConTermino: () => fin.push('con')
    })
    c._taskReviewDecidirAprobarRun('E1', 't1')
    expect(fin).toEqual(['con'])
    expect(c._calls.cierre.length).toBe(0)
  })

  it('verificarTaskExp ejecuta afterVerify tras el cierre exitoso', () => {
    const v = extraer(core, ['verificarTaskExp'])
    const iMut = v.indexOf('tk.publicado=true')
    const iAfter = v.indexOf('opts.afterVerify()')
    expect(iAfter).toBeGreaterThan(iMut)
    expect(iAfter).toBeLessThan(v.indexOf("prog(88,'Finalizando…')"))
  })
})

describe('Aprobar y pasar para Imprimir: término propuesto', () => {
  it('trámite: guarda el término propuesto y pasa a imprimir', () => {
    const t = { id: 't1' }
    const c = ctxDecidir(t, { otorga: true, dias: 15 })
    c._taskReviewDecidirImprimirRun('E1', 't1')
    expect(c._calls.propone[0]).toMatchObject({ ref: 'E1', tid: 't1', p: { dias: 15 } })
    expect(c._calls.aplica.length).toBe(0)
    expect(c._calls.imprimir).toBe(1)
  })

  it('desmarcado: quita el propuesto anterior; sin bloque: no toca nada', () => {
    const t = { id: 't1', terminoCumplPropuesto: { dias: 8 } }
    let c = ctxDecidir(t, { otorga: false })
    c._taskReviewDecidirImprimirRun('E1', 't1')
    expect(t.terminoCumplPropuesto).toBeUndefined()
    const t2 = { id: 't2', terminoCumplPropuesto: { dias: 8 } }
    c = ctxDecidir(t2, null)
    c._taskReviewDecidirImprimirRun('E1', 't2')
    expect(t2.terminoCumplPropuesto).toEqual({ dias: 8 })
    expect(c._calls.mut).toBe(0)
  })

  it('inválido: no pasa a imprimir', () => {
    const c = ctxDecidir({ id: 't1' }, false)
    c._taskReviewDecidirImprimirRun('E1', 't1')
    expect(c._calls.imprimir).toBe(0)
  })

  it('PQRSD: el propuesto va a la actividad de atención y pasa a Por firmar', () => {
    const t = { id: 'tRev' }
    const e = { _exp: 'WQ1' }
    const c = ctxDecidir(t, { otorga: true, dias: 10 }, {
      getExpById: () => e,
      pqrsEnRevisionNca: () => true,
      reqPqrsTaskTermino: () => ({ id: 'tAt' })
    })
    c._taskReviewDecidirImprimirRun('WQ1', 'tRev')
    expect(c._calls.propone[0]).toMatchObject({ ref: 'WQ1', tid: 'tAt' })
    expect(c._calls.ofi).toBe(1)
  })
})

describe('Panel 📬 Reportar notificación: término visible para VITAL / encargado', () => {
  function ctxSide(envia) {
    const terms = []
    const c = createContext({
      escAttr: s => String(s == null ? '' : s),
      hoy: () => '2026-10-08',
      getTaskFirmaWf: t => t.firmaWf || {},
      tramiteFirmaExpCtx: () => ({ _exp: 'E1' }),
      tramitePuedeNotificarCorreo: () => envia,
      tramiteNotifCorreoCamposHtml: () => '[CAMPOS]',
      htmlTerminoCumplBlock: (e, t, opts) => { terms.push(opts); return '<div id="term-cumpl-box"></div>' }
    })
    runInContext(extraer(firma, ['renderTaskReviewNotificarSideHtml']), c)
    c._terms = terms
    return c
  }
  it('trámite: VITAL / encargado ven el término (inicio = fecha de notificación); responsable no', () => {
    let c = ctxSide(true)
    let h = c.renderTaskReviewNotificarSideHtml('E1', 't1', { id: 't1', terminoCumplPropuesto: { dias: 10 } })
    expect(h).toContain('id="term-cumpl-box"')
    expect(h.indexOf('term-cumpl-box')).toBeLessThan(h.indexOf('id="tramite-notif-btn"'))
    expect(c._terms[0]).toMatchObject({ inicio: '2026-10-08', inicioInputId: 'tramite-notif-fecha' })
    c = ctxSide(false)
    h = c.renderTaskReviewNotificarSideHtml('E1', 't1', { id: 't1' })
    expect(h).not.toContain('term-cumpl-box')
  })

  it('PQRSD: usa la actividad de atención y la fecha de notificación', () => {
    const side = extraer(core, ['renderTaskReviewPqrsNotificarSideHtml'])
    expect(side).toContain("const tTerm=(typeof reqPqrsTaskTermino==='function'&&reqPqrsTaskTermino(e,taskId))||t||null;")
    expect(side).toContain("(enviaDirecto&&tTerm&&typeof htmlTerminoCumplBlock==='function'")
    expect(side).toContain("inicioInputId:'pqrs-notif-fecha'")
    expect(extraer(core, ['initTaskReviewPqrsNotificarSide'])).toContain('syncTerminoCumplUi')
    expect(extraer(firma, ['initTaskReviewNotificarSide'])).toContain('syncTerminoCumplUi')
  })
})
