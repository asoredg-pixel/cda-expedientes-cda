/**
 * Eliminar entrega de un informe aún no aprobado:
 * borra el registro y la carpeta de Drive.
 * Si ya está en corrección, solo encargado NCA o administrador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
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

function ctxPermisos(flags) {
  return createContext(Object.assign({
    estadoTask: t => t.estado,
    esAdministrador: () => !!flags.admin,
    esNcaDeguv: () => !!flags.nca,
    esOficinaPqrsNca: () => false,
    esModoResponsable: () => !!flags.resp,
    taskUsuarioEsAsignado: (t, yo) => t.responsable === yo,
    taskPendienteVerificacion: t => t.estado === 'Por verificar',
    responsableActivo: 'Yesica'
  }, flags.extra || {}))
}

describe('Eliminar entrega de informe', () => {
  it('el responsable puede anularla antes de la revisión y no después de devolverla', () => {
    const c = ctxPermisos({ resp: true })
    runInContext(extraer(core, ['informePuedeEliminarEntrega']), c)
    const base = { informeContrato: { n: 1 }, responsable: 'Yesica' }
    expect(c.informePuedeEliminarEntrega(Object.assign({ estado: 'Por verificar' }, base))).toBe(true)
    expect(c.informePuedeEliminarEntrega(Object.assign({ estado: 'Por corregir' }, base))).toBe(false)
    expect(c.informePuedeEliminarEntrega(Object.assign({ estado: 'Atendida' }, base))).toBe(false)
  })

  it('en corrección solo el encargado NCA o el administrador pueden eliminar la entrega', () => {
    const inf = { informeContrato: { n: 1 }, estado: 'Por corregir', responsable: 'Yesica' }
    const nca = ctxPermisos({ nca: true })
    runInContext(extraer(core, ['informePuedeEliminarEntrega']), nca)
    expect(nca.informePuedeEliminarEntrega(inf)).toBe(true)
    const admin = ctxPermisos({ admin: true, resp: true })
    runInContext(extraer(core, ['informePuedeEliminarEntrega']), admin)
    expect(admin.informePuedeEliminarEntrega(inf)).toBe(true)
    const otro = ctxPermisos({})
    runInContext(extraer(core, ['informePuedeEliminarEntrega']), otro)
    expect(otro.informePuedeEliminarEntrega(inf)).toBe(false)
  })

  it('al eliminar deja el informe marcado y borra la carpeta de Drive', async () => {
    const deleted = []
    const folders = []
    let guardado = null
    const t = {
      id: 'INF1',
      codigo: 'INF1',
      sinExpediente: true,
      informeContrato: { n: 1, numero: '272' },
      estado: 'Por verificar',
      fechaReportada: '2026-10-22',
      _drive_folder_id: 'CARP',
      soportes: [{ driveFileId: 'PDF' }, { driveFileId: 'ANX' }]
    }
    const actividadesLibres = [t]
    const c = createContext({
      actividadesLibres,
      window: {},
      puedeEliminarEntregaActividad: () => true,
      getTaskAny: () => t,
      notif: () => {},
      confirmExito: () => {},
      closeTaskModal: () => {},
      persistExpLocal: () => {},
      persistActividadesLibresFirestore: async () => {
        guardado = actividadesLibres.map(x => ({
          id: x.id,
          eliminada: !!x.eliminada,
          estado: x.estado,
          fechaReportada: x.fechaReportada || ''
        }))
        return true
      },
      driveDeleteInstitutional: async (id) => { deleted.push(id); return true },
      informeEliminarCarpetaDrive: async (task) => { folders.push(task._drive_folder_id); return true },
      informeBorradorCerrarTrasEntrega: () => {},
      renderActividades: () => {},
      renderBandejaDepto: () => {},
      renderRecursosPanel: () => {}
    })
    c.window = c
    runInContext(extraer(core, ['eliminarEntregaActividad']), c)
    const ok = await c.eliminarEntregaActividad('INF1', 'INF1')
    expect(ok).toBe(true)
    expect(guardado).toEqual([{ id: 'INF1', eliminada: true, estado: 'En ejecución', fechaReportada: '' }])
    expect(actividadesLibres).toHaveLength(1)
    expect(actividadesLibres[0].eliminada).toBe(true)
    expect(actividadesLibres[0].fechaReportada).toBe('')
    expect(deleted.sort()).toEqual(['ANX', 'PDF'])
    expect(folders).toEqual(['CARP'])
  })

  it('la carpeta se borra en Drive de forma recursiva', () => {
    const fn = extraer(gmail, ['informeEliminarCarpetaDrive'])
    expect(fn).toContain('driveDeleteFolderRecursive')
    expect(fn).toContain('informeResolverCarpetaDrive')
  })
})
