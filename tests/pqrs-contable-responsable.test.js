/**
 * Responsable con «Información contable»: en una PQRSD puede marcar el pago
 * sin reescribir el radicado. Sin esa sección, la PQRSD sigue en solo consulta.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roles = readFileSync(resolve(root, 'js/roles.js'), 'utf8')
const ge = readFileSync(resolve(root, 'js/guardar-exp.js'), 'utf8')
const con = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

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

describe('PQRSD: información contable del responsable', () => {
  it('con la sección habilitada puede editar; sin ella la PQRSD no se abre en edición', () => {
    const c = createContext({
      esModoResponsable: () => true,
      esModoContratista: () => false,
      responsablePuedeEditarSec: key => key === 'contable',
      window: {}
    })
    runInContext(extraer(roles, ['responsablePuedeEditarContableEnPqrs']) + '\nthis.f=responsablePuedeEditarContableEnPqrs;', c)
    expect(c.f()).toBe(true)
    c.responsablePuedeEditarSec = () => false
    expect(c.f()).toBe(false)
  })

  it('el panel no fuerza solo consulta si tiene contable', () => {
    const fn = extraer(con, ['abrirConsultaExpPanel'])
    expect(fn).toContain('responsablePuedeEditarContableEnPqrs')
    expect(fn).toContain('if(pqrsSoloConsulta&&!soloContable)opts.edit=false')
  })

  it('guardar el pago no borra el radicado ni las actividades', () => {
    const c = createContext({})
    runInContext(extraer(ge, ['aplicarContableSobreExpediente']) + '\nthis.aplicar=aplicarContableSobreExpediente;', c)
    const prev = {
      _exp: 'EA260241', _tramite: 't_pqrs', _pn_nombre: 'Juan Pérez',
      _pqrs_workflow: '{"fase":"pendiente_revision"}',
      tasks: [{ id: 't1', actividad: 'Oficio de respuesta', soportes: [{ id: 's1' }] }],
      _facturas_extra: '[]'
    }
    c.aplicar(prev, {
      _pn_nombre: '',
      _facturas_extra: JSON.stringify([{ tipo: 'Evaluación', ref: 'F-1', pago: '2026-10-22' }]),
      _acuerdo_pago: false,
      tasks: []
    })
    expect(prev._pn_nombre).toBe('Juan Pérez')
    expect(prev._pqrs_workflow).toContain('pendiente_revision')
    expect(prev.tasks).toHaveLength(1)
    expect(prev._facturas_extra).toContain('2026-10-22')
  })

  it('en esa edición el formulario solo pinta Información contable', () => {
    const c = createContext({
      window: { _conPanelPqrsContableOnly: true },
      esModoResponsable: () => true,
      esModoContratista: () => false,
      responsablePuedeEditarSec: () => true
    })
    runInContext(extraer(roles, ['regSecHtml']) + '\nthis.regSecHtml=regSecHtml;', c)
    expect(c.regSecHtml('contable', '<div>pago</div>')).toBe('<div>pago</div>')
    expect(c.regSecHtml('persona', '<div>nombre</div>')).toBe('')
  })
})
