/**
 * informe-soportes-por-actividad.test.js — Soportes del informe de contrato por actividad:
 * catálogo de actividades del contrato, carpetas Soportes Informe N / Act n - nombre,
 * nombres de archivo fijos y etiqueta en la lista de carga.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const sfu = readFileSync(resolve(root, 'js/sst-file-upload.js'), 'utf8')

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

function ctxGmail() {
  const c = createContext({})
  runInContext(extraer(gmail, ['_driveNombreArchivoPlano', '_driveFileExt', '_driveEntregaNExp', 'driveContratoInformeFolderNames', 'driveContratoInformeFilename']), c)
  return c
}

const inf = { numero: '234', contratista: 'Marcela Chara', anio: '2026', n: 1, desde: '2026-02-01', hasta: '2026-02-28' }

describe('Soportes del informe por actividad', () => {
  it('carpetas: 234 MARCELA CHARA / Informe 1 / Soportes Informe 1 / Act 1 - nombre', () => {
    const n = ctxGmail().driveContratoInformeFolderNames(inf, { n: 1, nombre: 'Visitas de control' })
    expect(n.contrato).toBe('234 MARCELA CHARA')
    expect(n.informe).toBe('Informe 1 (01-02-2026 a 28-02-2026)')
    expect(n.soportes).toBe('Soportes Informe 1')
    expect(n.actividad).toBe('Act 1 - Visitas de control')
  })

  it('nombres: informe fijo (V2 en corrección) y soporte por actividad', () => {
    const c = ctxGmail()
    expect(c.driveContratoInformeFilename(inf, { soportes: [] }, 'mi informe.PDF', {})).toBe('INFORME 1 - 234 MARCELA CHARA.pdf')
    const corr = { soportes: [{ loteEntrega: 'lot_1' }] }
    expect(c.driveContratoInformeFilename(inf, corr, 'x.pdf', {})).toBe('INFORME 1 - 234 MARCELA CHARA V2.pdf')
    expect(c.driveContratoInformeFilename(inf, { soportes: [] }, 'foto.jpg', { informeAct: { n: 2, nombre: 'PQRSD' }, informeSoporteK: 3 }))
      .toBe('ACT2 SOPORTE 3 - 234 MARCELA CHARA.jpg')
  })

  it('subida: carpeta de la actividad y sin renombrar al aprobar', () => {
    const up = extraer(gmail, ['driveUploadExpedienteActividad'])
    expect(up).toContain('if (infC && opts.informeAct) parentId = await driveEnsureContratoInformeActFolder(')
    expect(up).toContain('parents: [parentId]')
    expect(extraer(gmail, ['driveRenameExpedienteSoporte'])).toContain('if (task && task.informeContrato) return false;')
    expect(extraer(gmail, ['_driveExpedienteEsGuaviare'])).toContain('if (e && e._contrato_informe) return true;')
  })

  it('catálogo: actividades del mismo contrato y responsable (de informes y soportes)', () => {
    const c = createContext({ agendaNorm: s => String(s || '').trim().toLowerCase() })
    runInContext(extraer(er, ['informeActividadesDeContrato']), c)
    const lista = [
      { responsable: 'Marcela', informeContrato: { numero: '234', actividades: [{ n: 2, nombre: 'PQRSD' }] }, soportes: [{ informe_act: { n: 1, nombre: 'Visitas' } }] },
      { responsable: 'Marcela', informeContrato: { numero: '234' }, soportes: [{ informe_act: { n: 1, nombre: 'Otro nombre' } }] },
      { responsable: 'Marcela', informeContrato: { numero: '999', actividades: [{ n: 5, nombre: 'Otro contrato' }] } },
      { responsable: 'Luis', informeContrato: { numero: '234', actividades: [{ n: 7, nombre: 'De otro' }] } },
      { responsable: 'Marcela', eliminada: true, informeContrato: { numero: '234', actividades: [{ n: 9, nombre: 'Borrada' }] } }
    ]
    const r = c.informeActividadesDeContrato(lista, 'marcela', '234')
    expect(r.map(a => a.n + ':' + a.nombre)).toEqual(['1:Visitas', '2:PQRSD'])
  })

  it('carga: la actividad elegida queda en cada soporte y se muestra en la lista', () => {
    const pick = extraer(sfu, ['sstFileOnAnexosPick'])
    expect(pick).toContain('const informeAct = window._informeActPendiente || null;')
    expect(pick).toContain('if (informeAct) it.informeAct = informeAct;')
    expect(extraer(sfu, ['sstFileCollect'])).toContain('if (it.informeAct) row.informeAct = it.informeAct;')
    expect(extraer(sfu, ['sstFileRenderItemRow'])).toContain("'<strong>Act '")
    expect(extraer(sfu, ['sstFileUploadCtxForExpTask'])).toContain('if (t && t.informeContrato) return null;')
  })

  it('entrega: exige informe y actividad en cada soporte; registra informe_act', () => {
    const sub = extraer(core, ['submitEnviarSoporteVerificacion'])
    expect(sub).toContain("notif('Cargue el informe (documento principal)','err');return;")
    expect(sub).toContain('informeSoporteK:infSopK[kn]')
    expect(sub).toContain("eDrive,t,rep,'revision',infOpts)")
    const env = extraer(core, ['enviarTaskPorVerificar'])
    expect(env).toContain('t.soportes[t.soportes.length-1].informe_act=ia;')
    expect(env).toContain('t.informeContrato.actividades.push(ia)')
    expect(extraer(er, ['syncEntregaInformeModoUi'])).toContain("informe?'entregaInformeElegirActividad()':'sstFilePickAnexosBtn()'")
  })
})
