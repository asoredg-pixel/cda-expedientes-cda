/**
 * informe-correccion-nueva-entrega.test.js — Informe devuelto (Por corregir): la nueva entrega
 * precarga informe y soportes de la última entrega; quitar elimina de Drive y del registro;
 * lo que se conserva no queda «por corregir» (se borraría de Drive al aprobar).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const up = readFileSync(resolve(root, 'js/sst-file-upload.js'), 'utf8')
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

const sops = [
  { id: 'v1', driveFileId: 'OLD', label: 'Documento principal · por corregir', loteEntrega: 'L1' },
  { id: 'm', driveFileId: 'INF', label: 'Documento principal · por corregir', driveFilename: 'Informe 1 - 045 ANA.pdf', loteEntrega: 'L2' },
  { id: 'a2', driveFileId: 'S2', label: 'Act 2 — Visitas · soporte 3 · por corregir', informe_act: { n: 2, nombre: 'Visitas' }, es_anexo: true, loteEntrega: 'L2' },
  { id: 'a1', driveFileId: 'S1', label: 'Act 1 — Actas · soporte 1 · por corregir', informe_act: { n: 1, nombre: 'Actas' }, es_anexo: true, loteEntrega: 'L2' },
  { id: 'n', driveFileId: 'NOT', tipo: 'soporte_notificacion', loteEntrega: 'L2' }
]

function ctxEr(t) {
  const staging = {}
  const c = createContext({
    getTaskAny: () => t,
    estadoTask: x => x.estado,
    getSoportesUltimaEntrega: x => x.soportes.filter(s => s.loteEntrega === 'L2'),
    sstFileEnviarCtxKey: (e, k) => 'enviar-soporte:' + e + ':' + k,
    sstFileStagingCtx: k => (staging[k] = staging[k] || { main: null, anexos: [] }),
    sstFileRefreshCtxLists: () => {},
    mutateTask: (e, k, fn) => { fn(t); return true },
    escAttr: s => String(s), fmtF: s => String(s || '')
  })
  runInContext(extraer(er, ['informeCorreccionAplica', 'informeCorreccionItem', 'informeCorreccionPrecargar', 'informeCorreccionOnQuitar', 'htmlInformeCorreccionResumen']), c)
  return { c, staging }
}

describe('Informe devuelto: nueva entrega como borrador', () => {
  it('precarga informe y soportes de la última entrega, por actividad', () => {
    const t = { informeContrato: { numero: '045', n: 1 }, estado: 'Por corregir', soportes: sops.map(s => ({ ...s })) }
    const { c, staging } = ctxEr(t)
    c.informeCorreccionPrecargar('ACT-1', 'T1')
    const ctx = staging['enviar-soporte:ACT-1:T1']
    expect(ctx.main.driveFileId).toBe('INF')
    expect(ctx.main.uploaded.labelPrincipal).toBe('Documento principal')
    expect(ctx.anexos.map(a => a.driveFileId)).toEqual(['S1', 'S2'])
    expect(ctx.anexos[1].informeSoporteK).toBe(3)
    expect(ctx.anexos[1].uploaded.labelAnexo).toBe('Act 2 — Visitas · soporte 3')
    expect(ctx.anexos[1].corrPrev).toEqual({ expId: 'ACT-1', taskId: 'T1', soporteId: 'a2' })
    expect(ctx.anexos.every(a => a.state === 'uploaded')).toBe(true)
  })

  it('solo aplica a informes en Por corregir', () => {
    const t = { informeContrato: { numero: '045', n: 1 }, estado: 'Por verificar', soportes: sops.map(s => ({ ...s })) }
    const { c, staging } = ctxEr(t)
    c.informeCorreccionPrecargar('ACT-1', 'T1')
    expect(staging['enviar-soporte:ACT-1:T1']).toBeUndefined()
    expect(c.informeCorreccionAplica({ estado: 'Por corregir' })).toBe(false)
  })

  it('quitar un archivo lo saca del registro de la actividad', () => {
    const t = { informeContrato: { numero: '045', n: 1 }, estado: 'Por corregir', soportes: sops.map(s => ({ ...s })) }
    const { c } = ctxEr(t)
    c.informeCorreccionOnQuitar({ driveFileId: 'S2', corrPrev: { expId: 'ACT-1', taskId: 'T1' } })
    expect(t.soportes.map(s => s.id)).toEqual(['v1', 'm', 'a1', 'n'])
  })

  it('quitar pide confirmación; el informe previo solo se reemplaza con archivo y confirmación', () => {
    expect(extraer(up, ['sstFileRemove'])).toContain("if (it.corrPrev && typeof informeCorreccionOnQuitar === 'function') informeCorreccionOnQuitar(it);")
    let borrados = 0
    const ctx = { main: { corrPrev: {}, driveFileId: 'INF' }, anexos: [] }
    const c = createContext({
      sstFileRegisterList: () => {}, sstFileStagingCtx: () => ctx, sstFileRefreshCtxLists: () => {},
      confirm: () => false, driveDeleteInstitutional: () => { borrados++; return Promise.resolve() }
    })
    runInContext(extraer(up, ['sstFileOnMainPick']), c)
    c.sstFileOnMainPick({ files: [], value: 'x' }, {})
    c.sstFileOnMainPick({ files: [{ name: 'nuevo.pdf' }], value: 'x' }, {})
    expect(ctx.main.driveFileId).toBe('INF')
    expect(borrados).toBe(0)
  })

  it('envío: informe precargado vale como principal y lo conservado no queda «por corregir»', () => {
    const sub = extraer(core, ['submitEnviarSoporteVerificacion'])
    expect(sub).toContain('if(!(adj.files||[]).length&&!infPre)')
    expect(sub).toContain('||preUploaded.some(function(u){return u&&!u.esAnexo;});')
    const env = extraer(core, ['enviarTaskPorVerificar'])
    expect(env).toContain('return !s||!soporteEsPorCorregir(s)||!reusados.has(String(s.driveFileId||s.fileId||\'\'));')
    expect(extraer(core, ['initEnviarArchivosPick'])).toContain('informeCorreccionPrecargar(expId,taskId)')
    expect(extraer(core, ['renderEnviarPanelHtml'])).toContain('h+=htmlInformeCorreccionResumen(t);')
  })

  it('al subir un soporte nuevo no se borran de Drive los archivos anteriores del informe', () => {
    const sub = extraer(core, ['submitEnviarSoporteVerificacion'])
    const purgas = sub.split('\n').filter(l => l.includes('await drivePurgeTaskInstitutionalSoportes(t)'))
    expect(purgas.length).toBe(1)
    expect(purgas[0]).toContain('&&!esPqrs&&!t.informeContrato)')
  })
})
