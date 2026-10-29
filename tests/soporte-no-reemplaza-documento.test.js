/**
 * soporte-no-reemplaza-documento.test.js — Al notificar (encargado o VITAL) el PDF de soporte
 * no sustituye ni borra el documento enlazado, aunque ese documento ya se haya renombrado a aprobado.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')

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

describe('El soporte de notificación no reemplaza el documento', () => {
  function ctx() {
    const c = createContext({
      soporteEsAnexoEntrega: s => !!(s && s.anexo),
      soporteEsDocRadicacion: () => false,
      soporteEsPorCorregir: () => false,
      esSoporteEnvioCorreoItem: s => !!(s && (s.tipo === 'soporte_notificacion' || s.tipo === 'soporte_respuesta')),
      soporteEsDocumentoNotificado: s => !!(s && (s.tipo === 'soporte_notificacion' || s.notificado === true || s.driveEstado === 'notificado')),
      soporteEsDocumentoFirmado: s => !!(s && (s.driveEstado === 'por_notificar' || s.driveEstado === 'firmado'))
    })
    runInContext(extraer(core, [
      'soportePrincipalNotificado',
      'soporteEsProyeccionIntermedia',
      'filtrarSoportesTrasNotificar'
    ]) + '\nthis._f=filtrarSoportesTrasNotificar;', c)
    return c
  }

  it('conserva el acto ya renombrado a aprobado y el PDF de soporte; solo quita la proyección', () => {
    const proy = { id: 'proy', driveEstado: 'revision', driveFileId: 'proy-1', label: 'POR REVISAR acto' }
    const acto = { id: 'acto', driveEstado: 'aprobado', driveFileId: 'acto-1', label: 'Documento principal' }
    const firmaVieja = { id: 'firma', driveEstado: 'por_notificar', driveFileId: 'firma-1', label: 'Firma anterior' }
    const soporte = { id: 'sop', tipo: 'soporte_notificacion', driveEstado: 'notificado', driveFileId: 'sop-1', label: 'Soporte envío' }
    const pack = ctx()._f([proy, firmaVieja, acto, soporte])
    const ids = pack.keep.map(s => s.id)
    expect(ids).toContain('acto')
    expect(ids).toContain('sop')
    expect(ids).toContain('firma')
    expect(ids).not.toContain('proy')
    expect(pack.drop.map(s => s.id)).toEqual(['proy'])
    expect(pack.vigente).toBe(acto)
  })

  it('un acto aprobado con solo el soporte no se borra', () => {
    const acto = { id: 'acto', driveEstado: 'aprobado', fileId: 'acto-1' }
    const soporte = { id: 'sop', tipo: 'soporte_notificacion', notificado: true, fileId: 'sop-1' }
    const pack = ctx()._f([acto, soporte])
    expect(pack.keep.map(s => s.id)).toEqual(['acto', 'sop'])
    expect(pack.drop).toEqual([])
  })

  it('el cierre de VITAL y el de PQRSD usan ese filtro', () => {
    expect(extraer(tf, ['finalizarTramiteTrasPublicar'])).toContain('filtrarSoportesTrasNotificar(t.soportes)')
    expect(extraer(core, ['_pqrsLimpiarDocumentosTrasCierre'])).toContain('filtrarSoportesTrasNotificar(tAt.soportes)')
    expect(extraer(core, ['soportesVisiblesParaVista'])).toContain('soportePrincipalNotificado(list)')
  })
})
