/**
 * elim-entrega-por-notificar.test.js — Encargado en «Por notificar»: 🗑 Eliminar entrega
 * con dos opciones (devolver para corregir / eliminar como si nada).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

function ctx(extra) {
  const c = createContext(Object.assign({
    window: {},
    PQRS_WF: { PENDIENTE_NOTIF: 'pendiente_notificacion', LISTA_ENVIO: 'lista_para_envio', REVISION_FINAL: 'revision_final_nca' },
    escAttr: s => String(s == null ? '' : s),
    esModoResponsable: () => false,
    esJurisdiccional: () => false,
    esCargoVital: () => false,
    esVistaActividadesDepto: () => true,
    esNcaDeguv: () => true,
    esOficinaPqrsNca: () => false,
    puedeGestionarActividadesDepto: () => true,
    esPqrsSecretaria: () => false,
    taskEsAtenderPqrs: () => false,
    pqrsEnFaseNotificacion: () => false,
    getTaskFirmaWf: t => (t.firmaWf || {})
  }, extra || {}))
  runInContext(extraer(core, [
    'actEncargadoNcaGestionPorNotificar', 'taskEnFaseNotificacionAsignada',
    'puedeEliminarEntregaPorNotificarEncargado', 'renderTaskReviewElimEntregaNotifSideHtml'
  ]) + '\n' + extraer(firma, ['taskFirmaFase', 'taskFirmaEnPorNotificar']), c)
  return c
}

const tPorNotif = { id: 't1', firmaWf: { fase: 'pendiente_notificacion', notificar_por: 'Ana' } }

describe('Eliminar entrega desde Por notificar (encargado)', () => {
  it('encargado ve la opción en Por notificar', () => {
    const c = ctx()
    expect(c.puedeEliminarEntregaPorNotificarEncargado(null, tPorNotif)).toBe(true)
  })

  it('no aplica fuera de Por notificar ni para responsable / VITAL', () => {
    expect(ctx().puedeEliminarEntregaPorNotificarEncargado(null, { firmaWf: { fase: 'por_firmar' } })).toBe(false)
    expect(ctx({ esModoResponsable: () => true }).puedeEliminarEntregaPorNotificarEncargado(null, tPorNotif)).toBe(false)
    expect(ctx({ esCargoVital: () => true }).puedeEliminarEntregaPorNotificarEncargado(null, tPorNotif)).toBe(false)
  })

  it('PQRSD en fase de notificación también aplica', () => {
    const c = ctx({ esPqrsSecretaria: () => true, taskEsAtenderPqrs: () => true, pqrsEnFaseNotificacion: () => true })
    expect(c.puedeEliminarEntregaPorNotificarEncargado({ _exp: 'P1' }, { id: 't2' })).toBe(true)
  })

  it('panel muestra las dos opciones y el chat estilo WhatsApp de la actividad', () => {
    const c = ctx({
      renderTaskChatListHtml: () => '<div class="msg">hola</div>',
      renderTaskChatComposerHtml: (ex, tk, t, o) => '<div id="task-chat-form" data-guia="' + !!(o && o.allowGuiaAttach) + '"></div>'
    })
    const h = c.renderTaskReviewElimEntregaNotifSideHtml('E1', 't1', tPorNotif, null)
    expect(h).toContain('Devolver para corregir')
    expect(h).toContain('id="task-chat-form" data-guia="true"')
    expect(h).toContain('pqrs-asig-chat-msgs')
    expect(h).toContain('hola')
    expect(h).toContain('submitElimEntregaNotifDevolver')
    expect(h).toContain('submitElimEntregaNotifEliminar')
  })

  it('devolver desde Por notificar: trámite acepta la fase y limpia notificador', () => {
    expect(firma).toMatch(/desdeNotif=!!\(opts&&opts\.desdePorNotificar&&taskFirmaEnPorNotificar\(t\)\)/)
    expect(firma).toMatch(/if\(desdeNotif\)Object\.assign\(tk\.firmaWf,\{notificar_por:''/)
  })
})
