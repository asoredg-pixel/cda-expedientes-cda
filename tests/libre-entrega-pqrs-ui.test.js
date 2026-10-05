/**
 * libre-entrega-pqrs-ui.test.js — Actividad sin expediente asignada por el encargado NCA:
 * el responsable entrega con el mismo panel de PQRSD (tipo, fecha, N° oficio, correo, adjuntos)
 * y los datos quedan en la actividad para la revisión del encargado.
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

const TIPO = { MENSAJE: 'mensaje', OFICIO: 'oficio', INFORMATIVA: 'informativa' }

function ctx(extra) {
  const c = createContext(Object.assign({
    window: {},
    PQRS_WF: { SIN_RESPUESTA: 'sin_respuesta' },
    PQRS_WF_TIPO: TIPO,
    escAttr: s => String(s == null ? '' : s),
    fmtF: s => s
  }, extra || {}))
  runInContext(extraer(core, [
    'taskLibreUsaEntregaPqrsUi', 'libreEntregaPqrsStubExp', 'aplicarLibreEntregaPqrsDatos',
    'libreEntregaRespTipoRevision', 'libreEntregaRespBannerHtml'
  ]), c)
  return c
}

describe('Entrega de actividad libre NCA con panel PQRSD', () => {
  it('aplica solo a libres de Guaviare creadas por el encargado', () => {
    const c = ctx()
    expect(c.taskLibreUsaEntregaPqrsUi({ sinExpediente: true, depto: 'guaviare' })).toBe(true)
    expect(c.taskLibreUsaEntregaPqrsUi({ sinExpediente: true, depto: 'guaviare', origen: 'responsable' })).toBe(false)
    expect(c.taskLibreUsaEntregaPqrsUi({ sinExpediente: true, depto: 'guaviare', origen: 'oficina_firma' })).toBe(false)
    expect(c.taskLibreUsaEntregaPqrsUi({ sinExpediente: true, depto: 'guainia' })).toBe(false)
    expect(c.taskLibreUsaEntregaPqrsUi({ depto: 'guaviare' })).toBe(false)
  })

  it('no depende del cargo del responsable (VITAL, coordinador, profesional, contratista)', () => {
    const regla = extraer(core, ['taskLibreUsaEntregaPqrsUi'])
    expect(regla).not.toMatch(/esCargo|usuarioCargoSesion/)
    const linea = extraer(core, ['renderEnviarPanelHtml']).split('\n').find(l => l.includes('const librePqrsUi='))
    expect(linea).toBeTruthy()
    expect(linea).not.toMatch(/esCargo|usuarioCargoSesion/)
    const entrar = extraer(core, ['respMarcarPorVerificar'])
    expect(entrar).not.toMatch(/esCargo(Vital|Coordinador|Profesional)/)
  })

  it('el expediente ficticio precarga lo ya reportado', () => {
    const c = ctx()
    const st = c.libreEntregaPqrsStubExp({
      codigo: 'ACT-1', actividad: 'Informe', depto: 'guaviare',
      entregaResp: { tipo: 'oficio', oficio: 'DSGV-1', fecha: '2026-10-01' },
      firmaWf: { notif_correo_entrega: true, email_to: 'a@b.co', cuerpo: 'Hola' }
    })
    const wf = JSON.parse(st._pqrs_workflow)
    expect(st._exp).toBe('ACT-1')
    expect(wf).toMatchObject({ fase: 'sin_respuesta', tipo: 'oficio', oficio: 'DSGV-1', fecha_respuesta: '2026-10-01', notif_correo_entrega: true, email_to: 'a@b.co', cuerpo: 'Hola' })
  })

  it('guarda tipo/oficio/correo en la actividad', () => {
    const tk = { firmaWf: { otro: 1 } }
    const c = ctx({ mutateTask: (e, id, fn) => { fn(tk); return true } })
    c.aplicarLibreEntregaPqrsDatos('ACT-1', 't1', {
      tipo: 'mensaje', fechaResp: '2026-10-02', oficioExt: '', cuerpo: 'Cuerpo',
      notifCorreoEntrega: true, emailTo: 'x@y.co', emailCc: '', emailBcc: '', emailSubject: 'Asunto'
    })
    expect(tk.entregaResp).toEqual({ tipo: 'mensaje', fecha: '2026-10-02', oficio: '', cuerpo: 'Cuerpo' })
    expect(tk.notifCorreoEntrega).toBe(true)
    expect(tk.firmaWf).toMatchObject({ otro: 1, canal: 'correo', notif_correo_entrega: true, email_to: 'x@y.co', email_subject: 'Asunto', cuerpo: 'Cuerpo' })

    const tk2 = {}
    const c2 = ctx({ mutateTask: (e, id, fn) => { fn(tk2); return true } })
    c2.aplicarLibreEntregaPqrsDatos('ACT-2', 't2', { tipo: 'oficio', fechaResp: '2026-10-02', oficioExt: 'DSGV-9', cuerpo: '', notifCorreoEntrega: false })
    expect(tk2.oficio).toBe('DSGV-9')
    expect(tk2.nro_oficio).toBe('DSGV-9')
    expect(tk2.firmaWf).toMatchObject({ canal: 'presencial', notif_correo_entrega: false })
  })

  it('revisión del encargado: aviso según el tipo reportado', () => {
    const c = ctx()
    const t = { sinExpediente: true, entregaResp: { tipo: 'informativa', cuerpo: 'Motivo X' } }
    expect(c.libreEntregaRespTipoRevision(t)).toBe('informativa')
    expect(c.libreEntregaRespTipoRevision({ sinExpediente: true })).toBe('')
    const html = c.libreEntregaRespBannerHtml(t, 'informativa')
    expect(html).toContain('Aprobar y cerrar')
    expect(html).toContain('Motivo X')
    expect(c.libreEntregaRespBannerHtml(t, 'mensaje')).toContain('Aprobar y notificar')
    expect(c.libreEntregaRespBannerHtml({ entregaResp: { oficio: 'D-1' } }, 'oficio')).toContain('N° D-1')
  })

  it('panel de entrega, envío y aprobación conectados', () => {
    const panel = extraer(core, ['renderEnviarPanelHtml'])
    expect(panel).toContain("renderPqrsEntregaCamposHtml(libreEntregaPqrsStubExp(t),{modo:'responsable',libreTask:t,libreCtx:ctxLibre})")
    expect(panel).toContain('if(!sol&&!esPqrsEntrega&&!librePqrsUi){')
    const campos = extraer(core, ['renderPqrsEntregaCamposHtml'])
    expect(campos).toContain('id="pqrs-entrega-libre"')
    expect(campos).toContain("'📋 Reporte de la actividad'")
    const sub = extraer(core, ['submitEnviarSoporteVerificacion'])
    expect(sub).toContain('pqLibre=collectPqrsEntregaDatos(expId,libreEntregaPqrsStubExp(t))')
    expect(sub).toContain('if(pqLibre)aplicarLibreEntregaPqrsDatos(expId,taskId,pqLibre)')
    const adj = extraer(core, ['collectEnviarAdjuntos'])
    expect(adj).toContain("const ck=ckLibre||sstFileEnviarCtxKey(tm.expId,tm.taskId)")
    const dec = extraer(core, ['renderTaskReviewDecisionSideHtml'])
    expect(dec).toContain('!showNotif&&erLibre===PQRS_WF_TIPO.INFORMATIVA')
    expect(extraer(core, ['buscarUsosNumeroOficio'])).toContain("if(excl&&pqrsNormOficioNum(t.codigo||'')===excl)return;")
  })
})
