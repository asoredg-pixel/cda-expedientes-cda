/**
 * informe-borrador-soportes.test.js — Borrador de informe de contrato: el contratista guarda
 * soportes por actividad en Drive (registro en sistema/global.informesBorradores) y los
 * retoma hasta adjuntar el informe y entregar.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
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

const agendaNorm = s => String(s || '').trim().toLowerCase()

describe('Borrador de informe de contrato', () => {
  it('clave: uno por contratista y contrato (sin tildes ni símbolos)', () => {
    const c = createContext({})
    runInContext(extraer(er, ['informeBorradorKey']), c)
    expect(c.informeBorradorKey('Marcela Chará', '234-2026')).toBe('b_marcela_chara__234_2026')
    expect(c.informeBorradorKey('marcela chara', '234 2026')).toBe(c.informeBorradorKey('MARCELA CHARA', '234-2026'))
  })

  it('solo lista los borradores del contratista activo', () => {
    const c = createContext({ agendaNorm })
    runInContext(extraer(er, ['informeBorradoresDeResponsable']), c)
    const map = { a: { responsable: 'Marcela', numero: '234' }, b: { responsable: 'Luis', numero: '1' }, c: { responsable: 'marcela' } }
    expect(c.informeBorradoresDeResponsable(map, 'MARCELA').map(b => b.numero)).toEqual(['234'])
  })

  it('el contrato que solo tiene borrador aparece en la lista de contratos', () => {
    const c = createContext({ agendaNorm, actividadesLibres: [], responsableActivo: 'Marcela', window: { _informesBorradores: { k: { responsable: 'Marcela', numero: '234', inicio: '2026-01-01', fin: '2026-12-31' } } } })
    runInContext(extraer(er, ['informeContratosDeResponsable', 'informeBorradoresDeResponsable', 'entregaInformeContratosActuales']), c)
    expect(JSON.parse(JSON.stringify(c.entregaInformeContratosActuales()))).toEqual([{ numero: '234', inicio: '2026-01-01', fin: '2026-12-31', informes: [] }])
  })

  it('soporte del borrador entra como «ya en Drive» con su actividad y N° de soporte', () => {
    const c = createContext({})
    runInContext(extraer(er, ['informeBorradorItem']), c)
    const it = c.informeBorradorItem({ driveFileId: 'f1', driveLink: 'L', nombre: 'foto.jpg', informeAct: { n: '2', nombre: 'PQRSD' }, k: 3 })
    expect(it.state).toBe('uploaded')
    expect(it.borrador).toBe(true)
    expect(it.informeAct).toEqual({ n: 2, nombre: 'PQRSD' })
    expect(it.uploaded.driveFileId).toBe('f1')
    expect(it.uploaded.labelAnexo).toBe('Act 2 — PQRSD · soporte 3')
    expect(it.uploaded.informeSoporteK).toBe(3)
  })

  it('Firestore: escribe solo la clave del borrador (merge) y la elimina con deleteField', async () => {
    const writes = []
    const DEL = { del: true }
    const w = { _db: {}, _fsDoc: (db, a, b) => a + '/' + b, _fsSetDoc: async (ref, pay, opt) => { writes.push({ ref, pay, opt }) }, _fsDeleteField: () => DEL }
    const c = createContext({ window: w })
    runInContext(extraer(er, ['informeBorradorPersistir']), c)
    await c.informeBorradorPersistir('k1', { n: 1 })
    await c.informeBorradorPersistir('k1', null)
    expect(writes[0]).toEqual({ ref: 'sistema/global', pay: { informesBorradores: { k1: { n: 1 } } }, opt: { merge: true } })
    expect(writes[1].pay.informesBorradores.k1).toBe(DEL)
    expect(w._informesBorradores).toEqual({})
  })

  it('guardar: sube cada soporte a su carpeta de actividad y numera seguido al último', () => {
    const g = extraer(er, ['guardarBorradorInforme'])
    expect(g).toContain("const k=(kMax[kn]||0)+1;")
    expect(g).toContain("{esAnexo:true,informeAct:it.informeAct,informeSoporteK:k}")
    expect(g).toContain('_contrato_informe:inf')
    expect(g).toContain('await informeBorradorGuardarDesdeStaging(key,inf,prev);')
  })

  it('entrega: el N° de soporte continúa tras los del borrador y el registro se cierra al entregar', () => {
    expect(extraer(core, ['submitEnviarSoporteVerificacion'])).toContain('preUploaded.reduce(function(m,u){return u&&u.informeAct&&String(u.informeAct.n)===kn?Math.max(m,parseInt(u.informeSoporteK,10)||0):m;},0)')
    expect(extraer(core, ['enviarTaskPorVerificar'])).toContain('if(ctxEr.entregaResponsable&&t.informeContrato&&typeof informeBorradorCerrarTrasEntrega===\'function\')informeBorradorCerrarTrasEntrega(t);')
  })

  it('quitar un soporte del borrador pide confirmación y actualiza el registro', () => {
    const rm = extraer(sfu, ['sstFileRemove'])
    expect(rm).toContain("if (it.borrador && !confirm(")
    expect(rm).toContain("if (it.borrador && typeof informeBorradorOnQuitar === 'function') informeBorradorOnQuitar();")
  })

  it('UI: botón «Guardar borrador» solo en modo informe; al salir del modo se retiran los soportes del borrador', () => {
    const s = extraer(er, ['syncEntregaInformeModoUi'])
    expect(s).toContain("if(btnBor)btnBor.style.display=informe?'':'none';")
    expect(s).toContain('informeBorradorQuitarDeStaging();')
    expect(extraer(er, ['openEntregaResponsableModal'])).toContain('onclick="guardarBorradorInforme()">💾 Guardar borrador</button>')
  })
})
