/**
 * por-notificar-designado-sale-atendidas.test.js —
 * Si el proyectista está designado a notificar, sale de Atendidas y queda en Por notificar
 * (Firmada · X Notificar). No debe quedar huérfano por notificar_por vacío o VITAL por defecto.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const firma = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
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

const norm = s => String(s || '').trim().toLowerCase()
const PQRS_WF = {
  PENDIENTE_NOTIF: 'pendiente_notificacion',
  LISTA_ENVIO: 'lista_para_envio',
  CERRADA: 'cerrada_atendida',
  POR_FIRMAR: 'por_firmar',
}

function montar() {
  const c = createContext({
    console, JSON, String, Number, Math, Date, Array, Object, Set, isFinite,
    PQRS_WF,
    agendaNorm: norm,
    hoy: () => '2026-11-25',
    normalizeTask: t => t,
    migrateLegacyAsignados: () => {},
    ensureAsignado: (t, n) => {
      if (!Array.isArray(t.asignados)) t.asignados = []
      let a = t.asignados.find(x => x && norm(x.nombre) === norm(n))
      if (!a) { a = { nombre: n, estado: 'pendiente', fechaReportada: '', fechaAtendida: '' }; t.asignados.push(a) }
      return a
    },
    getAsignado: (t, n) => (t.asignados || []).find(x => x && norm(x.nombre) === norm(n)) || null,
    syncTaskAggregateState: t => {
      const a = (t.asignados || [])[0]
      if (a && (t.asignados || []).length <= 1) {
        t.fechaAtendida = a.fechaAtendida || ''
        t.estado = a.estado === 'atendido' || a.fechaAtendida ? 'Atendida' : 'En ejecución'
      } else if ((t.asignados || []).every(x => x && x.estado === 'atendido')) {
        t.estado = 'Atendida'
        t.fechaAtendida = '2026-11-24'
      } else {
        t.fechaAtendida = ''
        t.estado = 'En ejecución'
      }
    },
    taskEnFlujoFirmaTramite: t => !!(t && t.firmaWf && t.firmaWf.fase && !/cerrad/i.test(t.firmaWf.fase)),
    taskComentarioAutor: () => 'sistema',
    pqrsNombresVital: () => ['VITAL CDA'],
    getEncargadoDepto: () => 'CARLOS ANDRES QUINTERO SANTOS',
    esModoResponsable: () => true,
    esCargoVital: () => false,
    esAdministrador: () => false,
    esNcaDeguv: () => false,
    esVistaActividadesDepto: () => false,
    esDirectorDsDeguv: () => false,
    responsableActivo: 'GIOVANNY BOHORQUEZ',
  })
  c.window = c
  c.tramitePuedeGestionarComoOficina = () => false
  c.taskFirmaEnRevisionFinalNotif = () => false
  runInContext(extraer(firma, [
    'getTaskFirmaWf', 'taskFirmaFase', 'taskFirmaEnPorNotificar',
    'tramiteProyectistaNotificarDefault', 'tramiteResolverNotificarPor',
    'tramiteNotificarPorEsInstitucional', 'repararTramiteNotificarPorSiFalta',
    'tramiteSincronizarParticipacionPostAprobacionFirma', 'tramitePuedeNotificar',
  ]), c)
  return c
}

describe('Por notificar: designado sale de Atendidas', () => {
  it('resolver default = proyectista (entregado_por), no VITAL', () => {
    const c = montar()
    const t = {
      responsable: 'GIOVANNY BOHORQUEZ',
      responsables: ['GIOVANNY BOHORQUEZ'],
      firmaWf: { fase: 'pendiente_notificacion', entregado_por: 'GIOVANNY BOHORQUEZ' },
    }
    expect(c.tramiteResolverNotificarPor(t, '')).toBe('GIOVANNY BOHORQUEZ')
  })

  it('si le asignan notificar: sincroniza → no Atendida personal; puede notificar', () => {
    const c = montar()
    const t = {
      id: 't1',
      responsable: 'GIOVANNY BOHORQUEZ',
      responsables: ['GIOVANNY BOHORQUEZ'],
      estado: 'Atendida',
      fechaAtendida: '2026-11-24',
      asignados: [{
        nombre: 'GIOVANNY BOHORQUEZ', estado: 'atendido',
        fechaReportada: '2026-11-17', fechaAtendida: '2026-11-24',
      }],
      firmaWf: {
        fase: 'pendiente_notificacion',
        notificar_por: 'GIOVANNY BOHORQUEZ',
        entregado_por: 'GIOVANNY BOHORQUEZ',
        firma_director: { atajo_desde_revision: true },
      },
      historial: [{ tipo: 'atajo_firmado_revision', por: 'LINA BELTRAN' }],
      _firma_proyeccion_atendida: true,
    }
    c.tramiteSincronizarParticipacionPostAprobacionFirma(t)
    const a = t.asignados[0]
    expect(a.estado).not.toBe('atendido')
    expect(String(a.fechaAtendida || '')).toBe('')
    expect(String(t.fechaAtendida || '')).toBe('')
    expect(c.tramitePuedeNotificar(t)).toBe(true)
  })

  it('atajo dejó VITAL: reparar devuelve deuda al proyectista', () => {
    const c = montar()
    const t = {
      id: 't1', depto: 'guaviare',
      responsable: 'GIOVANNY BOHORQUEZ',
      responsables: ['GIOVANNY BOHORQUEZ'],
      estado: 'Atendida',
      fechaAtendida: '2026-11-24',
      asignados: [{
        nombre: 'GIOVANNY BOHORQUEZ', estado: 'atendido',
        fechaReportada: '2026-11-17', fechaAtendida: '2026-11-24',
      }],
      firmaWf: {
        fase: 'pendiente_notificacion',
        notificar_por: 'VITAL CDA',
        notif_sin_plazo: false,
        entregado_por: 'GIOVANNY BOHORQUEZ',
        firma_director: { atajo_desde_revision: true },
      },
      historial: [{ tipo: 'atajo_firmado_revision', por: 'LINA BELTRAN' }],
    }
    expect(c.repararTramiteNotificarPorSiFalta(t)).toBe(true)
    expect(t.firmaWf.notificar_por).toBe('GIOVANNY BOHORQUEZ')
    expect(t.asignados[0].estado).not.toBe('atendido')
    expect(c.tramitePuedeNotificar(t)).toBe(true)
  })

  it('sin notificar_por: reparar fija proyectista y limpia fechaAtendida', () => {
    const c = montar()
    const t = {
      id: 't1',
      responsable: 'GIOVANNY BOHORQUEZ',
      responsables: ['GIOVANNY BOHORQUEZ'],
      fechaAtendida: '2026-11-24',
      estado: 'Atendida',
      asignados: [{
        nombre: 'GIOVANNY BOHORQUEZ', estado: 'atendido',
        fechaAtendida: '2026-11-24', fechaReportada: '2026-11-17',
      }],
      firmaWf: { fase: 'pendiente_notificacion', entregado_por: 'GIOVANNY BOHORQUEZ' },
      historial: [],
    }
    expect(c.repararTramiteNotificarPorSiFalta(t)).toBe(true)
    expect(t.firmaWf.notificar_por).toBe('GIOVANNY BOHORQUEZ')
    expect(String(t.fechaAtendida || '')).toBe('')
  })
})
