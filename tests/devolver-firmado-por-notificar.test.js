/**
 * Encargado NCA, documento ya firmado por notificar: el chat de «Ver documento a notificar»
 * puede devolverlo. Queda en el mismo flujo que una devolución desde Por revisar
 * y el oficio firmado se conserva como «por corregir».
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

describe('Devolver oficio firmado por notificar', () => {
  it('el chat de la actividad muestra Devolver al encargado', () => {
    const fn = core.slice(core.indexOf('function renderTaskReviewChatSideHtml'), core.indexOf('function taskReviewChatSectState'))
    expect(fn).toContain('puedeEliminarEntregaPorNotificarEncargado')
    expect(fn).toContain('canDevolverPorNotif')
    expect(fn).toContain('canShowDevolver=canReviewSop||canDevolverFirma||canDevolverAtendida||canDevolverPorNotif')
    expect(fn).toContain('↩ Devolver')
    const uni = core.slice(core.indexOf('function devolverTaskUnificado'), core.indexOf('function devolverTaskUnificado') + 2800)
    expect(uni).toContain('desdePorNotificar:true')
  })

  it('al devolver, el firmado queda por corregir y la actividad sale de por notificar', () => {
    const c = createContext({
      PQRS_WF: { RECHAZADA: 'rechazada', PENDIENTE_NOTIF: 'pendiente_notificacion' },
      Date, Object, Array, String, JSON,
      taskComentarioAutor: () => 'ENC NCA',
      responsableActivo: 'ENC NCA',
      notif: () => {},
      getExpById: () => exp,
      tramitePuedeDevolverDesdeFirma: () => false,
      taskEsAtenderPqrs: () => true,
      hoy: () => '2026-10-22',
      normalizeTask: x => x,
      migrateLegacyAsignados: () => {},
      resetTaskPorCorregir: (tk, nota) => {
        tk.estado = 'Por corregir'
        tk.ultimaRevisionDepto = { tipo: 'corregir', nota: nota || '' }
        if (!Array.isArray(tk.historial)) tk.historial = []
        tk.historial.push({ tipo: 'ajuste_soporte', nota: nota || '' })
      },
      persistExpedienteGranular: () => {},
      closeTaskModal: () => {},
      renderPqrsOficinaInbox: () => {},
      renderSecretariaPqrs: () => {},
      renderActividades: () => {},
      renderBandejaDepto: () => {}
    })
    const task = {
      id: 't1',
      soportes: [{ id: 's1', activo: true, label: 'Oficio firmado', driveEstado: 'por_notificar', fileId: 'f1' }],
      historial: []
    }
    const exp = {
      _exp: 'EA260999',
      _pqrs_workflow: JSON.stringify({
        fase: 'pendiente_notificacion',
        entrega_n: 1,
        documentos: [{ nombre: 'Oficio firmado', driveEstado: 'por_notificar', driveLink: 'http://a', fileId: 'f1' }]
      })
    }
    let wf = null
    c.getTaskAny = () => task
    c.getPqrsWorkflow = (e) => {
      if (!wf) wf = JSON.parse(e._pqrs_workflow)
      return wf
    }
    c.setPqrsWorkflow = (e, patch) => {
      wf = Object.assign({}, wf, patch)
      e._pqrs_workflow = JSON.stringify(wf)
    }
    runInContext(extraer(core, ['_pqrsDocEsPorCorregir', '_pqrsMarcarDocsComoPorCorregir', 'encargadoDevolverDesdeFirmaACorregir']), c)
    expect(c.encargadoDevolverDesdeFirmaACorregir('EA260999', 't1', 'El firmado tiene un error', { desdePorNotificar: true })).toBe(true)
    expect(task.estado).toBe('Por corregir')
    expect(task.ultimaRevisionDepto.tipo).toBe('corregir')
    expect(task.soportes[0].driveEstado).toBe('acorregir')
    expect(task.soportes[0].activo).toBe(false)
    expect(task.soportes[0].version_historial).toBe(true)
    expect(task.soportes[0].label).toMatch(/por corregir/)
    expect(task.historial.some(h => h.tipo === 'devolver_desde_firma')).toBe(true)
    expect(task.historial.some(h => h.tipo === 'ajuste_soporte')).toBe(true)
    expect(wf.fase).toBe('rechazada')
    expect(wf.documentos[0].driveEstado).toBe('acorregir')
    expect(wf.documentos[0].version_historial).toBe(true)
    expect(wf.notificar_por).toBe('')
  })
})
