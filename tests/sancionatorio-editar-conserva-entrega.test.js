/**
 * Al editar un sancionatorio (nombre del infractor o N° de expediente) la entrega en Por revisar
 * no se convierte en PQRSD ni se duplica sin documento.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ge = readFileSync(resolve(root, 'js/guardar-exp.js'), 'utf8')
const roles = readFileSync(resolve(root, 'js/roles.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^function ' + n + '\\(', 'm'))
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

describe('Sancionatorio no queda como PQRSD al guardar', () => {
  it('el guardado marca _es_pqrs solo si el trámite es PQRSD', () => {
    const fn = extraer(ge, ['guardarExpCore'])
    expect(fn).toContain('_es_pqrs:!!esPqrs')
    expect(fn).not.toContain('_es_pqrs:esCaso')
  })

  it('corregir el número migra el documento y borra el anterior', () => {
    const fn = extraer(ge, ['guardarExpCore'])
    expect(fn).toContain('migrarReferenciasNumeroExpediente(prevExpId,expId)')
    expect(fn).toContain('deleteExpedienteDoc')
  })

  it('un sancionatorio con _es_pqrs residual no se trata como PQRSD', () => {
    const c = createContext({
      esTramiteSancionatorio: tid => tid === 't_sanc',
      esTramitePqrs: tid => tid === 't_pqrs'
    })
    runInContext(extraer(roles, ['esPqrsSecretaria']) + '\nthis.esPqrsSecretaria=esPqrsSecretaria;', c)
    expect(c.esPqrsSecretaria({ _tramite: 't_sanc', _es_pqrs: true, _exp: 'SAN-00048-24' })).toBe(false)
    expect(c.esPqrsSecretaria({ _tramite: 't_pqrs', _es_pqrs: true })).toBe(true)
  })
})

describe('La entrega no se duplica sin documento', () => {
  const c = createContext({
    normalizeTask: t => t,
    esPqrsSecretaria: () => false,
    hoy: () => '2026-10-22'
  })
  runInContext(extraer(ge, ['mergeTasksForSave']) + '\nthis.mergeTasksForSave=mergeTasksForSave;', c)
  runInContext(extraer(core, ['unirEntregaDuplicadaSinDocumento']) + '\nthis.unir=unirEntregaDuplicadaSinDocumento;', c)

  it('el formulario con id nuevo reutiliza la entrega que ya tiene el documento', () => {
    const prev = [{
      id: 'real', actividad: 'Resolución impone sanción', responsable: 'LAURA SALAZAR',
      vence: '2026-10-29', fechaReportada: '2026-10-22', soportes: [{ id: 's1', url: 'https://drive/doc' }]
    }]
    const form = [{
      id: 'nuevo', actividad: 'Resolución impone sanción', responsable: 'LAURA SALAZAR',
      vence: '2026-10-29', soportes: []
    }]
    const out = c.mergeTasksForSave(form, prev)
    const vivos = out.filter(t => !t.eliminada)
    expect(vivos).toHaveLength(1)
    expect(vivos[0].id).toBe('real')
    expect(vivos[0].soportes[0].id).toBe('s1')
  })

  it('la copia ya guardada sin documento se oculta y queda la entrega', () => {
    const e = {
      _exp: 'SAN-00048-24', _tramite: 't_sanc',
      tasks: [
        { id: 'real', actividad: 'Resolución impone sanción', responsable: 'LAURA SALAZAR', vence: '2026-10-29', fechaReportada: '2026-10-22', soportes: [{ id: 's1' }] },
        { id: 'copia', actividad: 'Resolución impone sanción', responsable: 'LAURA SALAZAR', vence: '2026-10-29', soportes: [] }
      ]
    }
    expect(c.unir(e)).toBe(true)
    expect(e.tasks.find(t => t.id === 'copia').eliminada).toBe(true)
    expect(e.tasks.find(t => t.id === 'real').soportes).toHaveLength(1)
  })
})
