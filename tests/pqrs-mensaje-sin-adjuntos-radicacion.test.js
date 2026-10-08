/**
 * pqrs-mensaje-sin-adjuntos-radicacion.test.js — PQRSD respondida por mensaje simple sin documentos:
 * los soportes de radicación (solicitud + anexos radicados) no se adjuntan al correo de respuesta
 * (evita intentar descargarlos de Drive y el aviso «No se pudieron descargar los adjuntos»).
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

const radicacion = [
  { id: 'r1', label: 'Soporte de radicación', fileId: 'R1', driveFileId: 'R1', url: 'https://drive/r1', es_radicacion: true, tipo: 'soporte_radicacion', activo: true },
  { id: 'r2', label: 'Anexo radicado', fileId: 'R2', driveFileId: 'R2', url: 'https://drive/r2', es_radicacion: true, tipo: 'anexo_radicacion', activo: true }
]

function ctxCollect(wfDocs, sopsTask) {
  const c = createContext({
    getPqrsWorkflow: () => ({ documentos: wfDocs }),
    esPqrsSecretaria: e => !!(e && e._pqrs),
    taskEsAtenderPqrs: () => true,
    _pqrsDocEsPorCorregir: () => false,
    _pqrsAnexoNumero: () => 0,
    ensurePqrsSoportesAprobadosOnTask: t => { if (!wfDocs.length) t.soportes = sopsTask },
    soportesVisiblesParaVista: t => t.soportes || []
  })
  runInContext(extraer(core, ['soporteEsDocRadicacion', '_pqrsDocEsAnexoRespuesta', 'soporteEsAnexoEntrega', 'soporteEsPorCorregir',
    'collectDocsParaNotificacionCorreo']) + '\nthis._f=collectDocsParaNotificacionCorreo;', c)
  return c._f
}

describe('Mensaje simple sin adjuntos: no adjuntar radicación', () => {
  it('PQRSD sin documentos de respuesta → no hay adjuntos (aunque la tarea muestre radicación)', () => {
    const f = ctxCollect([], radicacion)
    expect(f({ _pqrs: true }, { id: 't', soportes: [] })).toEqual([])
  })

  it('trámite con radicación + documento principal → solo el documento', () => {
    const f = ctxCollect([], [])
    const t = { id: 't', soportes: radicacion.concat([{ id: 'p', label: 'Oficio', fileId: 'P1', url: 'https://drive/p', activo: true, driveEstado: 'aprobado' }]) }
    const out = f(null, t)
    expect(out.map(d => d.id)).toEqual(['p'])
    expect(out[0]._notif_rol).toBe('documento')
  })

  it('anexos de la entrega se conservan; anexos radicados no', () => {
    const f = ctxCollect([], [])
    const t = { id: 't', soportes: radicacion.concat([{ id: 'a', label: 'Anexo 1', fileId: 'A1', url: 'https://drive/a', activo: true, es_anexo: true }]) }
    expect(f(null, t).map(d => d.id)).toEqual(['a'])
  })

  it('PQRSD con oficio en el workflow → se adjunta el oficio', () => {
    const f = ctxCollect([{ nombre: 'Oficio', fileId: 'O1', driveLink: 'https://drive/o', tipo: 'drive' }], radicacion)
    const out = f({ _pqrs: true }, { id: 't', soportes: [] })
    expect(out.length).toBe(1)
    expect(out[0].fileId).toBe('O1')
  })
})
