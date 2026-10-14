/**
 * revision-profesional-aprobada-tecnico.test.js — El técnico que envió una actividad a revisión del
 * profesional la ve en Atendidas cuando el encargado la aprueba y recibe aviso en la campanita.
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

function ctx(exps, yo) {
  const c = createContext({
    exps, responsableActivo: yo,
    esModoResponsable: () => true,
    agendaNorm: s => String(s || '').trim().toUpperCase(),
    taskEsMultiAsignada: () => false,
    estadoTask: t => t.estado,
    normalizeTask: t => t,
    taskUsuarioEsAsignado: (t, u) => String(t.responsable).toUpperCase() === String(u).toUpperCase(),
    getNom: () => '', getTram: () => ({ nombre: '' })
  })
  runInContext(extraer(core, ['taskRevParAprobadaInfo', 'taskTieneRevisionPar', 'getTareasRevParTecnicoAprobadas',
    'bandejaActFiltroParaTask']), c)
  return c
}

const tarea = estado => ({
  id: 't1', actividad: 'Concepto de seguimiento', responsable: 'PROFESIONAL', estado, fechaAtendida: '2026-10-13',
  historial: [
    { tipo: 'asignacion', fecha: '2026-10-01', a: 'TECNICO' },
    { tipo: 'traslado', fecha: '2026-10-05', de: 'TECNICO', a: 'PROFESIONAL', revisionPar: 'solicitud' },
    { tipo: 'verificacion', fecha: '2026-10-13', por: 'ENCARGADO NCA', nota: 'Aprobada y notificada' }
  ]
})

describe('Revisión del profesional aprobada → técnico', () => {
  it('Atendida: el técnico la recibe en su lista de Atendidas; el profesional no la duplica', () => {
    const exps = [{ _exp: 'VDA-1', tasks: [tarea('Atendida')] }]
    const lst = ctx(exps, 'TECNICO').getTareasRevParTecnicoAprobadas()
    expect(lst.map(t => t.id)).toEqual(['t1'])
    expect(lst[0]._revParTecnico).toBe(true)
    expect(ctx(exps, 'PROFESIONAL').getTareasRevParTecnicoAprobadas()).toEqual([])
  })

  it('sin aprobar todavía no aparece', () => {
    const exps = [{ _exp: 'VDA-1', tasks: [tarea('Por verificar')] }]
    expect(ctx(exps, 'TECNICO').getTareasRevParTecnicoAprobadas()).toEqual([])
  })

  it('info de aprobación (quién y cuándo) y la campanita lleva a Atendidas', () => {
    const c = ctx([], 'TECNICO')
    const info = c.taskRevParAprobadaInfo(tarea('Atendida'), null)
    expect(info).toMatchObject({ tecnico: 'TECNICO', profesional: 'PROFESIONAL', hidx: 2, fecha: '2026-10-13', por: 'ENCARGADO NCA' })
    expect(c.bandejaActFiltroParaTask(null, { tipo: 'revpar_aprobada' })).toBe('done')
  })

  it('campanita: se agrega el aviso, su clave y abre el documento aprobado', () => {
    expect(core).toMatch(/tipo:'revpar_aprobada',exp:e\._exp/)
    expect(core).toMatch(/it\.tipo==='revpar_aprobada'\)return 'rpa\|'/)
    expect(core).toMatch(/if\(tipo==='firmado_atendida'\|\|tipo==='revpar_aprobada'\)\{\s*if\(typeof openTaskVerDocumentoResp/)
    expect(core).toMatch(/\}\),typeof getTareasRevParTecnicoAprobadas==='function'\?getTareasRevParTecnicoAprobadas\(\):\[\]\);/)
  })
})
