/**
 * devolver-desde-atendidas.test.js — El encargado puede devolver para corrección una actividad
 * ya atendida (Ver actividad y documentos › rail de chat): pasa a «Por corregir». No aplica a PQRSD.
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

function ctx(o) {
  o = o || {}
  const llamadas = []
  const c = createContext({
    window: {},
    esModoResponsable: () => !!o.resp,
    esJurisdiccional: () => false,
    puedeGestionarActividadesDepto: () => o.enc !== false,
    estadoTask: t => t.estado,
    getExpById: id => (o.exps || {})[id] || null,
    esPqrsSecretaria: e => !!e._pqrs,
    taskEsAtenderPqrs: () => false,
    getTaskAny: (e, id) => o.task,
    confirm: () => o.confirma !== false,
    notif: m => llamadas.push('notif:' + m),
    document: { getElementById: () => null },
    getMarcadoresRonda: () => 1,
    devolverTaskAlResponsable: (e, id, nota) => { llamadas.push('devolver:' + nota); return true }
  })
  runInContext(extraer(core, ['encargadoPuedeDevolverAtendida', 'devolverTaskUnificado']), c)
  return { c, llamadas }
}

describe('Devolver desde Atendidas', () => {
  it('encargado: atendida de trámite o libre sí; PQRSD, oficina, no atendida o responsable no', () => {
    const exps = { 'EA-1': { _exp: 'EA-1' }, 'PQ-1': { _exp: 'PQ-1', _pqrs: true } }
    expect(ctx({ exps }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', exp: 'EA-1' }, 'EA-1')).toBe(true)
    expect(ctx({ exps }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', sinExpediente: true, informeContrato: {} }, 'ACT-GV-0001')).toBe(true)
    expect(ctx({ exps }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', exp: 'PQ-1' }, 'PQ-1')).toBe(false)
    expect(ctx({ exps }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', sinExpediente: true, origen: 'oficina_firma' }, 'ACT-OF-1')).toBe(false)
    expect(ctx({ exps }).c.encargadoPuedeDevolverAtendida({ estado: 'Por verificar', exp: 'EA-1' }, 'EA-1')).toBe(false)
    expect(ctx({ exps, resp: true }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', exp: 'EA-1' }, 'EA-1')).toBe(false)
    expect(ctx({ exps, enc: false }).c.encargadoPuedeDevolverAtendida({ estado: 'Atendida', exp: 'EA-1' }, 'EA-1')).toBe(false)
  })

  it('confirma y devuelve al responsable (pasa a Por corregir)', () => {
    const { c, llamadas } = ctx({ task: { estado: 'Atendida', sinExpediente: true, notasDoc: [] } })
    c.devolverTaskUnificado('ACT-GV-0001', 't1')
    expect(llamadas).toEqual(['devolver:Devuelta para corregir'])
  })

  it('si cancela la confirmación no devuelve', () => {
    const { c, llamadas } = ctx({ task: { estado: 'Atendida', sinExpediente: true, notasDoc: [] }, confirma: false })
    c.devolverTaskUnificado('ACT-GV-0001', 't1')
    expect(llamadas).toEqual([])
  })

  it('el rail muestra «Devolver» para atendidas que el encargado puede devolver', () => {
    expect(core).toMatch(/const canDevolverAtendida=encargadoPuedeDevolverAtendida\(t,expId\);\s*const canShowDevolver=canReviewSop\|\|canDevolverFirma\|\|canDevolverAtendida;/)
  })
})
