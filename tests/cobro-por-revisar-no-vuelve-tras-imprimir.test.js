/**
 * Cobro persuasivo (u otra entrega) enviada a imprimir/firmar no debe
 * volver a «Por revisar» cuando llega un eco Firestore aún «Por verificar»
 * (p. ej. reentrega desde Por corregir).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')
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

describe('Cobro persuasivo: no vuelve a Por revisar tras imprimir', () => {
  it('merge: por_firmar local gana frente a eco Por verificar sin firmaWf', () => {
    const c = createContext({
      window: {}, JSON, String, Object, Array,
      normalizeTask: x => Object.assign({}, x)
    })
    runInContext(extraer(persistence, [
      'faseFlujoFirmaRank', 'taskRemotoDevueltoACorregir', 'mergeExpedienteTasksLocalRemote'
    ]), c)
    const local = [{
      id: 'cobro1',
      actividad: 'Cobro Persuasivo',
      estado: 'En ejecución',
      fechaReportada: '2026-11-11',
      _firma_proyeccion_atendida: true,
      ultimaRevisionDepto: { tipo: 'aprobada', fecha: '2026-11-11' },
      firmaWf: { fase: 'por_firmar', enviado_firma_en: '2026-11-11T21:00:00.000Z' },
      historial: [
        { tipo: 'entrega', ts: 1 },
        { tipo: 'enviar_firma', ts: 2 }
      ]
    }]
    const remoteEco = [{
      id: 'cobro1',
      actividad: 'Cobro Persuasivo',
      estado: 'Por verificar',
      fechaReportada: '2026-11-11',
      fechaAtendida: '',
      firmaWf: { fase: '' },
      historial: [
        { tipo: 'entrega', ts: 1 },
        { tipo: 'corregir', ts: 1.5 },
        { tipo: 'entrega', ts: 1.8 },
        { tipo: 'entrega', ts: 1.9 }
      ]
    }]
    const merged = c.mergeExpedienteTasksLocalRemote(local, remoteEco)
    expect(merged).toHaveLength(1)
    expect(merged[0].firmaWf.fase).toBe('por_firmar')
    expect(merged[0]._firma_proyeccion_atendida).toBe(true)
  })

  it('merge: devolución a Por corregir sigue ganando sobre caché en por_firmar', () => {
    const c = createContext({
      window: {}, JSON, String, Object, Array,
      normalizeTask: x => Object.assign({}, x)
    })
    runInContext(extraer(persistence, [
      'faseFlujoFirmaRank', 'taskRemotoDevueltoACorregir', 'mergeExpedienteTasksLocalRemote'
    ]), c)
    const local = [{
      id: 't1', estado: 'Atendida',
      firmaWf: { fase: 'por_firmar' },
      historial: [{ tipo: 'enviar_firma', ts: 1 }]
    }]
    const remote = [{
      id: 't1', estado: 'Por corregir',
      firmaWf: { fase: '' },
      historial: [
        { tipo: 'enviar_firma', ts: 1 },
        { tipo: 'devolver_desde_firma', ts: 2 }
      ]
    }]
    const out = c.mergeExpedienteTasksLocalRemote(local, remote)
    expect(out[0].estado).toBe('Por corregir')
    expect(String(out[0].firmaWf.fase || '')).toBe('')
  })

  it('taskPendienteVerificacion: false si proyección aprobada o ultimaRevision aprobada', () => {
    const c = createContext({
      window: {}, String, Object, Array,
      normalizeTask: t => t,
      taskFirmaWfActiva: t => !!(t.firmaWf && String(t.firmaWf.fase || '').trim()),
      taskEsMultiAsignada: () => false
    })
    runInContext(extraer(core, ['taskPendienteVerificacion']), c)
    expect(c.taskPendienteVerificacion({
      fechaReportada: '2026-11-11', fechaAtendida: '',
      _firma_proyeccion_atendida: true, firmaWf: { fase: '' }
    })).toBe(false)
    expect(c.taskPendienteVerificacion({
      fechaReportada: '2026-11-11', fechaAtendida: '',
      ultimaRevisionDepto: { tipo: 'aprobada' }, firmaWf: { fase: '' }
    })).toBe(false)
    expect(c.taskPendienteVerificacion({
      fechaReportada: '2026-11-11', fechaAtendida: '',
      firmaWf: { fase: '' }
    })).toBe(true)
  })

  it('pickMejorActLibre: por_firmar gana frente a eco Por verificar', () => {
    const c = createContext({
      String, Array, Object, Math, Number, Date, isFinite, isNaN,
      faseFlujoFirmaRank: fase => {
        const f = String(fase || '').trim()
        if (f === 'para_firma') return 3
        if (f === 'por_firmar') return 4
        if (f === 'pendiente_notificacion') return 5
        return 0
      }
    })
    runInContext(extraer(persistence, [
      'actLibreEventTs', 'actLibreEsPorCorregirMerge', 'scoreActividadLibreMerge',
      'actLibreTieneEntrega', 'actLibreTieneArchivoDrive', 'pickMejorActLibre'
    ]), c)
    const enFirma = {
      id: 'a1', estado: 'En ejecución',
      firmaWf: { fase: 'por_firmar' },
      _firma_proyeccion_atendida: true,
      historial: [{ tipo: 'enviar_firma', fecha: '2026-11-11' }]
    }
    const ecoVer = {
      id: 'a1', estado: 'Por verificar',
      fechaReportada: '2026-11-11',
      firmaWf: { fase: '' },
      historial: [
        { tipo: 'entrega', fecha: '2026-11-11' },
        { tipo: 'entrega', fecha: '2026-11-11' },
        { tipo: 'entrega', fecha: '2026-11-11' }
      ]
    }
    expect(c.pickMejorActLibre(enFirma, ecoVer).firmaWf.fase).toBe('por_firmar')
    expect(c.pickMejorActLibre(ecoVer, enFirma).firmaWf.fase).toBe('por_firmar')
  })
})
