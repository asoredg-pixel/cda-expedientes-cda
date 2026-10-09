/**
 * encargado-oficina-global.test.js — El «Para» del traslado usa el encargado vigente de la oficina:
 * prioriza encargadosGlobal (actualizado al editar el usuario autorizado) sobre la copia en instructores.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roles = readFileSync(resolve(root, 'js/roles.js'), 'utf8')

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

function ctx(eg, instructores) {
  const c = createContext({
    deptoActivo: 'guaviare',
    getInstructoresCfg: () => instructores,
    oficinaSinApoyo: () => false,
    getInstructoresOficina: () => []
  })
  runInContext((eg !== undefined ? 'var encargadosGlobal=' + JSON.stringify(eg) + ';\n' : '') +
    extraer(roles, ['getEncargadoOficina']) + '\nthis._f=getEncargadoOficina;', c)
  return c._f
}

const insViejo = [{ nombre: 'ANTERIOR', rol: 'encargado_oficina', activo: true, oficinas: ['rn_deguv'] },
  { nombre: 'ENC NCA', rol: 'encargado_depto', activo: true, oficinas: [] }]

describe('getEncargadoOficina: encargado vigente', () => {
  it('copia de instructores atrasada → usa el nombre de encargadosGlobal', () => {
    const f = ctx({ oficinas: { rn_deguv: { nombre: 'NUEVO', email: 'rn@x.com' } } }, insViejo)
    expect(f('rn_deguv')).toBe('NUEVO')
  })

  it('slot global vacío → cae a instructores', () => {
    const f = ctx({ oficinas: { rn_deguv: { nombre: '', email: '' } } }, insViejo)
    expect(f('rn_deguv')).toBe('ANTERIOR')
  })

  it('sin encargadosGlobal definido → instructores (no rompe)', () => {
    const f = ctx(undefined, insViejo)
    expect(f('rn_deguv')).toBe('ANTERIOR')
  })

  it('NCA (guaviare) sigue resolviendo por instructores', () => {
    const f = ctx({ oficinas: { guaviare: { nombre: 'OTRO', email: '' } } }, insViejo)
    expect(f('guaviare')).toBe('ENC NCA')
  })

  it('Secretaría usa encargadosGlobal.secretaria', () => {
    const f = ctx({ oficinas: {}, secretaria: { nombre: 'SEC NUEVA', email: 's@x.com' } }, [])
    expect(f('secretaria')).toBe('SEC NUEVA')
  })
})
