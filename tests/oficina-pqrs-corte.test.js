/**
 * Oficinas: por atender (cualquier fecha) y atendidas de los últimos 30 días.
 * La descarga completa de esPqrs queda solo hasta que exista la marca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pers = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

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

function ctxMarcas() {
  const c = createContext({
    esPqrsSecretaria: e => !!(e && e._es_pqrs),
    pqrsEstaCerrada: e => !!(e && (e._pqrs_estado_oficina === 'cerrado' || e._estado === 'Atendido')),
    nombresPendientesExp: () => [],
    expTieneSeguimiento: () => false
  })
  runInContext(extraer(pers, [
    'oficinaPqrsMarca', 'clavePqrsCerrada', 'corteFechaMarca', 'fechaCierrePqrsMarca',
    'aplicarMarcasBandeja', 'marcasPqrsOficinaDistintas'
  ]), c)
  return c
}

describe('Corte de PQRSD para oficinas', () => {
  it('el 31 de octubre el corte de atendidas es el 1 de octubre', () => {
    const Real = Date
    class Fija extends Real {
      constructor(...args) {
        if (args.length) super(...args)
        else super(2026, 9, 31, 15, 0, 0)
      }
    }
    const c = createContext({ Date: Fija })
    runInContext(extraer(pers, ['corteFechaMarca']), c)
    expect(c.corteFechaMarca(30)).toBe('2026-10-01')
  })

  it('abierta queda por atender; cerrada guarda la fecha y no entra si es anterior al corte', () => {
    const c = ctxMarcas()
    const abierta = c.aplicarMarcasBandeja({ _es_pqrs: true, _estado: 'En trámite', _pqrs_oficina: 'oap_deguv' })
    expect(abierta.pqrsAbierta).toBe(true)
    expect(abierta.pqrsCerradaEn).toBe('')
    expect(abierta.pqrsPendienteOficina).toBe('oap_deguv')
    expect(abierta.pqrsCerradaClave).toBe('')
    const reciente = c.aplicarMarcasBandeja({
      _es_pqrs: true, _estado: 'Atendido', _pqrs_oficina: 'oap_deguv', _pqrs_respuesta_fecha: '2026-10-01'
    })
    expect(reciente.pqrsAbierta).toBe(false)
    expect(reciente.pqrsCerradaEn).toBe('2026-10-01')
    expect(reciente.pqrsPendienteOficina).toBe('')
    expect(reciente.pqrsCerradaClave).toBe('oap_deguv|2026-10-01')
    expect(reciente.pqrsCerradaClave >= 'oap_deguv|2026-10-01' && reciente.pqrsCerradaClave <= 'oap_deguv|\uf8ff').toBe(true)
    const ajena = c.aplicarMarcasBandeja({
      _es_pqrs: true, _estado: 'Atendido', _pqrs_oficina: 'rn_deguv', _pqrs_respuesta_fecha: '2026-10-15'
    })
    expect(ajena.pqrsCerradaClave >= 'oap_deguv|2026-10-01' && ajena.pqrsCerradaClave <= 'oap_deguv|\uf8ff').toBe(false)
    const vieja = c.aplicarMarcasBandeja({
      _es_pqrs: true, _pqrs_estado_oficina: 'cerrado', _pqrs_oficina: 'oap_deguv', _fecha_res: '2026-09-30'
    })
    expect(vieja.pqrsAbierta).toBe(false)
    expect(vieja.pqrsCerradaClave >= 'oap_deguv|2026-10-01').toBe(false)
    const sinFecha = c.aplicarMarcasBandeja({ _es_pqrs: true, _estado: 'Atendido', _pqrs_oficina: 'oap_deguv', updatedAt: '2026-10-20' })
    expect(sinFecha.pqrsCerradaEn).toBe('1970-01-01')
    expect(sinFecha.pqrsCerradaClave).toBe('oap_deguv|1970-01-01')
    const tramite = c.aplicarMarcasBandeja({ _tramite: 't_lic' })
    expect(tramite.pqrsAbierta).toBeUndefined()
    expect(c.marcasPqrsOficinaDistintas({}, abierta)).toBe(true)
    expect(c.marcasPqrsOficinaDistintas({
      pqrsAbierta: true, pqrsCerradaEn: '', pqrsPendienteOficina: 'oap_deguv', pqrsCerradaClave: ''
    }, abierta)).toBe(false)
  })

  it('la oficina escucha abiertas y cerradas de 30 días, y secretaría no vuelve a esPqrs', () => {
    expect(pers).toContain("campo:'pqrsPendienteOficina'")
    expect(pers).toContain("campo:'pqrsCerradaClave'")
    expect(pers).toContain("rolLogin!=='ds_deguv'")
    expect(pers).toContain('corteFechaMarca(30)')
    expect(pers).toContain('if(!ofiCorte&&!ofiPropia)')
    expect(pers).toContain("esOficina&&rolLogin!=='secretaria'")
    expect(pers).toContain('pqrsOficinaPropiaListo')
    const ini = pers.indexOf('if(ofiPropia)')
    const amplia = pers.indexOf('}else if(ofiPqrs&&ofiCorte)', ini)
    const propia = pers.slice(ini, amplia)
    expect(propia).toContain("campo:'pqrsPendienteOficina'")
    expect(propia).toContain("campo:'pqrsCerradaClave'")
    expect(propia).not.toContain("campo:'esPqrs'")
    const director = pers.slice(amplia, pers.indexOf('}else if(esOficina', amplia))
    expect(director).toContain("campo:'pqrsAbierta'")
    expect(director).toContain("campo:'pqrsCerradaEn'")
  })
})
