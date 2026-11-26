/**
 * GH260707: PQRSD notificada (historial cierre_pqrs) no debe quedar en Por firma / X Imprimir
 * aunque un eco haya dejado _estado En trámite y fase para_firma; ni duplicar filas Oficio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const persistence = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

const PQRS_WF = {
  SIN_RESPUESTA: 'sin_respuesta',
  PENDIENTE_REVISION: 'pendiente_revision_nca',
  PARA_FIRMA: 'para_firma',
  VITAL_GESTION: 'pendiente_gestion_vital',
  POR_FIRMAR: 'por_firmar',
  PENDIENTE_NOTIF: 'pendiente_notificacion',
  LISTA_ENVIO: 'lista_para_envio',
  REVISION_FINAL: 'revision_final',
  CERRADA: 'cerrada_atendida',
  RECHAZADA: 'rechazada'
}

function ctxBase() {
  const c = createContext({
    PQRS_WF, JSON, String, Object, Array, window: {},
    hoy: () => '2026-11-24',
    getFechasEstado: () => ({}),
    rebuildHistorial: (_e, h) => h || [],
    aplicarMarcasBandeja: () => {},
    encolarReparoExpediente: () => {},
    esPqrsSecretaria: e => !!(e && e.pqrs)
  })
  runInContext(extraer(core, [
    'pqrsTieneHistorialCierre', 'pqrsEstaCerrada', 'pqrsSanearCierreDesfasado',
    'getPqrsWorkflow', 'setPqrsWorkflow', 'pqrsWorkflowFase', 'pqrsEnParaFirma', 'pqrsEnPorFirmar'
  ]), c)
  return c
}

describe('PQRSD cerrada no reaparece en Por firma', () => {
  it('historial cierre_pqrs cuenta como cerrada aunque _estado siga En trámite', () => {
    const c = ctxBase()
    const e = {
      pqrs: true,
      _estado: 'En trámite',
      _pqrs_estado_oficina: 'nca',
      _pqrs_workflow: JSON.stringify({ fase: PQRS_WF.PARA_FIRMA }),
      tasks: [{
        id: 't2',
        actividad: 'Oficio de respuesta',
        historial: [{ tipo: 'cierre_pqrs', nota: 'PQRSD cerrada — oficio notificado por correo' }]
      }]
    }
    expect(c.pqrsTieneHistorialCierre(e)).toBe(true)
    expect(c.pqrsEstaCerrada(e)).toBe(true)
    expect(c.pqrsWorkflowFase(e)).toBe(PQRS_WF.CERRADA)
    expect(c.pqrsEnParaFirma(e)).toBe(false)
    expect(c.pqrsEnPorFirmar(e)).toBe(false)
  })

  it('sana _estado y fase cuando hay cierre_pqrs desfasado', () => {
    const c = ctxBase()
    const e = {
      pqrs: true,
      _exp: 'GH260707',
      _estado: 'En trámite',
      _pqrs_estado_oficina: 'nca',
      _pqrs_workflow: JSON.stringify({ fase: PQRS_WF.PARA_FIRMA }),
      tasks: [{
        id: 't2',
        actividad: 'Oficio de respuesta',
        historial: [{ tipo: 'cierre_pqrs', fecha: '2026-11-24' }]
      }]
    }
    expect(c.pqrsSanearCierreDesfasado(e)).toBe(true)
    expect(e._estado).toBe('Atendido')
    expect(e._pqrs_estado_oficina).toBe('cerrado')
    expect(c.pqrsEnParaFirma(e)).toBe(false)
  })

  it('getTareasPqrsPorFaseWorkflow: cerrada sale; abiertas permiten varios Oficio', () => {
    const t1 = { id: 't1', actividad: 'Oficio de respuesta', eliminada: false, historial: [] }
    const t2 = {
      id: 't2', actividad: 'Oficio de respuesta', eliminada: false,
      historial: [{ tipo: 'cierre_pqrs', nota: 'PQRSD cerrada — oficio notificado por correo' }]
    }
    const e = {
      pqrs: true, _exp: 'GH260707', _estado: 'En trámite', _pqrs_estado_oficina: 'nca',
      _pqrs_workflow: JSON.stringify({ fase: PQRS_WF.PARA_FIRMA }),
      _qd_nombre: 'Gloria', tasks: [t1, t2]
    }
    const c = createContext({
      PQRS_WF, JSON, String, Object, Array, window: {},
      exps: [e],
      hoy: () => '2026-11-24',
      getFechasEstado: () => ({}),
      rebuildHistorial: (_e, h) => h || [],
      aplicarMarcasBandeja: () => {},
      encolarReparoExpediente: () => {},
      esPqrsSecretaria: x => !!(x && x.pqrs),
      getTram: () => ({ nombre: 'PQRSD' }),
      normalizeTask: x => x,
      getPqrsAtencionTask: exp => (exp.tasks || []).find(t => t && !t.eliminada) || null,
      taskEsAtenderPqrs: (t, exp) => {
        if (!t || t.eliminada || !exp) return false
        return /^Oficio de respuesta\b/i.test(String(t.actividad || ''))
      }
    })
    runInContext(extraer(core, [
      'pqrsTieneHistorialCierre', 'pqrsEstaCerrada', 'pqrsSanearCierreDesfasado',
      'getPqrsWorkflow', 'setPqrsWorkflow', 'pqrsWorkflowFase', 'pqrsEnParaFirma',
      'getTareasPqrsPorFaseWorkflow'
    ]), c)

    // Con cierre en historial: sana y no lista en bandeja de workflow PQRSD
    expect(c.getTareasPqrsPorFaseWorkflow(ex => c.pqrsEnParaFirma(ex))).toHaveLength(0)

    // PQRSD abierta: dos Oficios distintos (misma atención) → dos filas
    e.tasks = [
      { id: 'a', actividad: 'Oficio de respuesta', eliminada: false, historial: [] },
      { id: 'b', actividad: 'Oficio de respuesta', eliminada: false, historial: [] }
    ]
    e._estado = 'En trámite'
    e._pqrs_estado_oficina = 'nca'
    e._pqrs_workflow = JSON.stringify({ fase: PQRS_WF.PARA_FIRMA })
    const dos = c.getTareasPqrsPorFaseWorkflow(ex => c.pqrsEnParaFirma(ex))
    expect(dos).toHaveLength(2)
    expect(dos.map(t => t.id).sort()).toEqual(['a', 'b'])
  })

  it('merge: historial cierre no deja que un eco para_firma gane el flujo', () => {
    const c = createContext({ window: {}, JSON, String, Object, Array })
    runInContext(extraer(persistence, ['faseFlujoFirmaRank', 'expedienteFaseFlujo', 'expedienteFlujoNoDebeRetroceder']), c)
    const cerrado = {
      _estado: 'En trámite',
      tasks: [{ id: 't2', historial: [{ tipo: 'cierre_pqrs' }] }],
      _pqrs_workflow: JSON.stringify({ fase: 'para_firma' })
    }
    const eco = {
      _estado: 'En trámite',
      tasks: [{ id: 't2', historial: [] }],
      _pqrs_workflow: JSON.stringify({ fase: 'para_firma' })
    }
    expect(c.expedienteFaseFlujo(cerrado)).toBe('cerrada_atendida')
    expect(c.expedienteFlujoNoDebeRetroceder(cerrado, eco)).toBe(true)
  })
})
