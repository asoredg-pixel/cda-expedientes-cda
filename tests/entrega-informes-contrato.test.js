/**
 * entrega-informes-contrato.test.js — Responsable: «Entrega de informes» de contrato.
 * Sugerencia de N° informe/periodo, validación, carpeta Drive Recursos/Contratos y
 * revisión con solo «Aprobar y enviar por correo» (sin consulta ciudadana ni 📤).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

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

function ctxInforme() {
  const c = createContext({ agendaNorm: s => String(s || '').trim().toLowerCase() })
  runInContext(extraer(er, ['informeIsoAddDays', 'informeFinDeMes', 'informeContratoSiguiente', 'informeContratosDeResponsable', 'validarInformeContrato']), c)
  return c
}

describe('Entrega de informes de contrato', () => {
  it('primer informe: desde inicio del contrato hasta fin de ese mes', () => {
    const c = ctxInforme()
    const s = c.informeContratoSiguiente([], '2026-02-10', '2026-05-09')
    expect(s).toEqual({ n: 1, desde: '2026-02-10', hasta: '2026-02-28' })
  })

  it('siguiente informe: día siguiente al último periodo, tope fin del contrato', () => {
    const c = ctxInforme()
    const prev = [{ n: 1, desde: '2026-02-10', hasta: '2026-02-28' }, { n: 2, desde: '2026-03-01', hasta: '2026-03-31' }]
    expect(c.informeContratoSiguiente(prev, '2026-02-10', '2026-05-09')).toEqual({ n: 3, desde: '2026-04-01', hasta: '2026-04-30' })
    const prev2 = prev.concat([{ n: 3, desde: '2026-04-01', hasta: '2026-04-30' }])
    expect(c.informeContratoSiguiente(prev2, '2026-02-10', '2026-05-09')).toEqual({ n: 4, desde: '2026-05-01', hasta: '2026-05-09' })
  })

  it('contratos del responsable se deducen de sus informes (sin eliminados ni de otros)', () => {
    const c = ctxInforme()
    const lista = [
      { id: 'a', responsable: 'Ana', informeContrato: { numero: '045-2026', inicio: '2026-02-10', fin: '2026-05-09', n: 1, desde: '2026-02-10', hasta: '2026-02-28' } },
      { id: 'b', responsable: 'ana ', informeContrato: { numero: '045-2026', inicio: '2026-02-10', fin: '2026-05-09', n: 2, desde: '2026-03-01', hasta: '2026-03-31' } },
      { id: 'c', responsable: 'Ana', eliminada: true, informeContrato: { numero: '045-2026', n: 3 } },
      { id: 'd', responsable: 'Luis', informeContrato: { numero: '099-2026', n: 1 } },
      { id: 'e', responsable: 'Ana', actividad: 'Otra' }
    ]
    const r = c.informeContratosDeResponsable(lista, 'Ana')
    expect(r.length).toBe(1)
    expect(r[0].numero).toBe('045-2026')
    expect(r[0].informes.map(i => i.n)).toEqual([1, 2])
  })

  it('validación: periodo dentro del contrato y N° de informe no repetido', () => {
    const c = ctxInforme()
    const contratos = [{ numero: '045-2026', informes: [{ n: 1 }] }]
    const ok = { numero: '045-2026', inicio: '2026-02-10', fin: '2026-05-09', n: 2, desde: '2026-03-01', hasta: '2026-03-31' }
    expect(c.validarInformeContrato(ok, contratos)).toBe('')
    expect(c.validarInformeContrato(Object.assign({}, ok, { n: 1 }), contratos)).toMatch(/Ya entregó el informe N° 1/)
    expect(c.validarInformeContrato(Object.assign({}, ok, { hasta: '2026-06-30' }), contratos)).toMatch(/dentro de las fechas/)
    expect(c.validarInformeContrato(Object.assign({}, ok, { numero: '' }), contratos)).toMatch(/N° de contrato/)
    expect(c.validarInformeContrato(Object.assign({}, ok, { desde: '2026-04-01' }), contratos)).toMatch(/inválido/)
  })

  it('carpeta Drive: Contratos/<año>/<N° CONTRATISTA>/Informe N (periodo)', () => {
    const c = createContext({})
    runInContext(extraer(gmail, ['driveContratoInformeFolderNames']), c)
    const n = c.driveContratoInformeFolderNames({ numero: '045/2026', contratista: 'Ana Pérez', inicio: '2026-02-10', anio: '2026', n: 2, desde: '2026-03-01', hasta: '2026-03-31' })
    expect(n.anio).toBe('2026')
    expect(n.contrato).toBe('045-2026 ANA PÉREZ')
    expect(n.informe).toBe('Informe 2 (01-03-2026 a 31-03-2026)')
    const fn = extraer(gmail, ['driveEnsureExpedienteFolder'])
    expect(fn).toContain('if (e._contrato_informe) {')
    expect(fn.indexOf('e._contrato_informe')).toBeLessThan(fn.indexOf('DRIVE_ROOT_EXPEDIENTES_ID'))
  })

  it('proxies Drive de actividad libre llevan el contrato', () => {
    expect(extraer(core, ['submitEnviarSoporteVerificacion'])).toContain('_contrato_informe:t.informeContrato||null')
  })

  it('revisión: solo «Aprobar y enviar por correo», sin casilla interna y sin 📤', () => {
    const side = extraer(core, ['renderTaskReviewDecisionSideHtml'])
    const iInf = side.indexOf('if(t&&t.informeContrato){')
    expect(iInf).toBeGreaterThan(0)
    expect(iInf).toBeLessThan(side.lastIndexOf("renderTaskReviewAprobarAccHtml(1,'Aprobar y cerrar'"))
    expect(side).toContain('sinInterna:true')
    expect(side).toContain('📧 Aprobar y enviar por correo')
    const rail = extraer(core, ['taskReviewDecisionRailHtml'])
    expect(rail).toContain('if(!esRevFinal&&!(t&&t.informeContrato))')
  })

  it('campos de correo: sinInterna omite la casilla y destDefault llena «Para»', () => {
    const c = createContext({
      taskReviewNotifWfFuente: () => ({}),
      taskReviewCorreosNotificacion: () => [],
      taskReviewCuerpoNotifPredeterminado: () => 'cuerpo',
      escAttr: v => String(v || ''),
      hoy: () => '2026-10-09',
      taskReviewTermDraftOpts: (id, b) => b
    })
    runInContext(extraer(core, ['renderTaskReviewNotifEmailFieldsHtml']), c)
    const h = c.renderTaskReviewNotifEmailFieldsHtml(null, { id: 't1', actividad: 'Informe de contrato' }, 'ACT-1', { sinInterna: true, destDefault: 'contratacion@x.gov.co' })
    expect(h).not.toContain('task-rev-notif-interna')
    expect(h).toContain('value="contratacion@x.gov.co"')
    const h2 = c.renderTaskReviewNotifEmailFieldsHtml(null, { id: 't1' }, 'ACT-1')
    expect(h2).toContain('task-rev-notif-interna')
  })
})
