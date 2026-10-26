/**
 * Informe de contrato: si Drive ya tiene el PDF y Firestore no guardó la actividad,
 * el snapshot no debe borrarla a los 15 minutos, ni una copia vacía más nueva pisarla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
const gmail = readFileSync(resolve(root, 'js/gmail.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

const nombres = [
  'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'scoreActividadLibreMerge', 'actLibreTieneEntrega', 'actLibreTieneArchivoDrive', 'pickMejorActLibre',
  'actLibreEsAltaReciente', 'actLibreEsEntregaHuerfana', 'actLibreKeepLocalOnly',
  'clearActividadesLibresLocalCache', 'upsertActividadesLibresFromRemote', 'actLibresRemotoDoc'
]

function ctx() {
  return createContext({
    actividadesLibres: [],
    _actLibresQuitadosIds: new Set(),
    window: {},
    localStorage: { removeItem() {} },
    console,
    Map, Set, Date, String, Array, Object, Math, Number, isFinite, isNaN
  })
}

function informeEntregado(haceMs) {
  const ts = Date.now() - haceMs
  return {
    id: 'inf1',
    estado: 'Por verificar',
    fechaReportada: new Date(ts).toISOString().slice(0, 10),
    informeContrato: { numero: '271-2026', nombre: 'GIOVANNY BOHORQUEZ', informeN: 1 },
    _drive_folder_id: 'carpeta',
    soportes: [{ driveFileId: 'pdf1', nombre: 'INFORME 1.pdf' }],
    historial: [{ tipo: 'entrega', ts }],
    updatedAt: new Date(ts).toISOString()
  }
}

describe('Entrega de informe que no quedó en Firestore', () => {
  it('si el guardado aún está pendiente, un snapshot vacío no borra el informe con PDF', () => {
    const local = informeEntregado(4 * 24 * 60 * 60 * 1000)
    local._pending_fs_sync = true
    local._pending_fs_at = Date.now()
    const c = ctx()
    c.actividadesLibres = [local]
    runInContext(extraer(per, nombres), c)
    const out = c.upsertActividadesLibresFromRemote([])
    expect(out.map(t => t.id)).toEqual(['inf1'])
    expect(out[0]._pending_fs_sync).toBe(true)
    expect(out[0].estado).toBe('Por verificar')
  })

  it('un pendiente de hace horas no reaparece si el servidor ya no lo tiene', () => {
    const local = informeEntregado(2 * 60 * 60 * 1000)
    local._pending_fs_sync = true
    local._pending_fs_at = Date.now() - 2 * 60 * 60 * 1000
    const c = ctx()
    c.actividadesLibres = [local]
    runInContext(extraer(per, nombres), c)
    expect(c.upsertActividadesLibresFromRemote([]).map(t => t.id)).toEqual([])
  })

  it('un informe ya sincronizado que ya no está en el servidor no reaparece (aunque tenga fecha de entrega)', () => {
    const local = informeEntregado(4 * 24 * 60 * 60 * 1000)
    delete local.soportes
    delete local._drive_folder_id
    const c = ctx()
    c.actividadesLibres = [local]
    runInContext(extraer(per, nombres), c)
    expect(c.upsertActividadesLibresFromRemote([]).map(t => t.id)).toEqual([])
  })

  it('una copia más nueva sin la entrega no pisa el informe ya reportado', () => {
    const c = ctx()
    runInContext(extraer(per, nombres), c)
    const entregado = informeEntregado(4 * 24 * 60 * 60 * 1000)
    const vacia = {
      id: 'inf1', estado: 'En ejecución',
      informeContrato: { numero: '271-2026' },
      historial: [{ tipo: 'asignacion', ts: Date.now() }],
      updatedAt: new Date().toISOString()
    }
    expect(c.pickMejorActLibre(vacia, entregado).estado).toBe('Por verificar')
    expect(c.pickMejorActLibre(entregado, vacia).fechaReportada).toBeTruthy()
  })

  it('una actividad vieja sin entrega sigue sin resucitarse', () => {
    const vieja = {
      id: 'vieja', estado: 'En ejecución', actividad: 'Visita',
      historial: [{ tipo: 'asignacion', ts: Date.now() - 86400000 }], soportes: []
    }
    const c = ctx()
    c.actividadesLibres = [vieja]
    runInContext(extraer(per, nombres), c)
    expect(c.upsertActividadesLibresFromRemote([]).map(t => t.id)).toEqual([])
  })

  it('si la lectura remota falla, el guardado no recibe una lista vacía', () => {
    const src = extraer(per, ['actLibresRemotoDoc'])
    expect(src).toContain('return null')
    const guardar = extraer(per, ['saveActividadesLibresDeptoFirestore'])
    expect(guardar).toContain('remotoLibres==null')
    const globalFn = extraer(per, ['saveGlobalFirestore'])
    expect(globalFn).toContain('remotoLibres==null')
    expect(globalFn).toContain('el índice se guarda sin modificarlas')
    const folder = extraer(gmail, ['driveEnsureExpedienteFolder'])
    expect(folder.indexOf('e._contrato_informe')).toBeGreaterThan(0)
    expect(folder.indexOf('if (e._drive_folder_id)')).toBeGreaterThan(folder.indexOf('e._contrato_informe'))
  })
})
