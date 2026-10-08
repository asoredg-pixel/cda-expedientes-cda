/**
 * resp-entrega-correo-abre-panel.test.js — Responsable en «Entrega enviada» (Por revisar):
 * trámite / libre entregado por correo sin documento principal → se abre ✉️ con el correo diligenciado.
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

function ctxAbrir(extra) {
  const c = createContext(Object.assign({
    esModoResponsable: () => true,
    responsableActivo: 'Ana',
    taskUsuarioEsAsignado: () => true,
    estadoTask: () => 'Por verificar',
    taskPendienteVerificacion: () => true,
    esPqrsSecretaria: e => !!(e && e._pqrs),
    taskPqrsActividadPosCierre: () => false,
    taskEsAtenderPqrs: () => true,
    getTaskFirmaWf: t => t.firmaWf || {}
  }, extra || {}))
  runInContext(extraer(core, ['soporteEsDocRadicacion', '_pqrsDocEsAnexoRespuesta', 'soporteEsAnexoEntrega', 'soporteEsPorCorregir',
    'taskEntregaCorreoCtx', 'taskRespPuedeEditarCorreoEntrega', 'taskReviewRespEntregaAbrirCorreo']) +
    '\nthis._f=taskReviewRespEntregaAbrirCorreo;', c)
  return c._f
}

const wfCorreo = { notif_correo_entrega: true, email_to: 'ciudadano@correo.com', cuerpo: 'Buen día…' }

describe('Entrega enviada: abrir ✉️ si es correo sin documento', () => {
  it('trámite por correo sin documento → abre el correo', () => {
    const f = ctxAbrir()
    expect(f('E1', { id: 't', firmaWf: wfCorreo, soportes: [] }, { _exp: 'E1' })).toBe(true)
  })

  it('libre por correo con solo anexos → abre el correo', () => {
    const f = ctxAbrir()
    const t = { id: 't', sinExpediente: true, codigo: 'ACT1', firmaWf: wfCorreo,
      soportes: [{ id: 'a', driveFileId: 'A1', activo: true, es_anexo: true }] }
    expect(f('ACT1', t, null)).toBe(true)
  })

  it('con documento principal → se queda en 📄', () => {
    const f = ctxAbrir()
    const t = { id: 't', firmaWf: wfCorreo, soportes: [{ id: 'p', driveFileId: 'F1', activo: true }] }
    expect(f('E1', t, { _exp: 'E1' })).toBe(false)
  })

  it('sin correo diligenciado → no abre', () => {
    const f = ctxAbrir()
    expect(f('E1', { id: 't', firmaWf: {}, soportes: [] }, { _exp: 'E1' })).toBe(false)
  })

  it('PQRSD → no aplica (ya abre ✉️ por su propia regla)', () => {
    const f = ctxAbrir()
    expect(f('P1', { id: 't', firmaWf: wfCorreo, soportes: [] }, { _exp: 'P1', _pqrs: true })).toBe(false)
  })

  it('el arranque de «Entrega enviada» usa la nueva regla', () => {
    expect(core).toMatch(/isRespVerEntregaPendiente&&typeof taskReviewRespEntregaAbrirCorreo==='function'&&taskReviewRespEntregaAbrirCorreo\(refAct,t,e\)\)\s*\n\s*taskReviewOpenSidePanel\('pqrsCorreo'/)
  })
})
