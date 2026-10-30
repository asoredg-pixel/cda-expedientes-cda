/**
 * Responsable: solo lo que tiene a su nombre.
 * Secretaría: PQRSD radicadas en 10 días; Consulta muestra 10.
 * Encargado NCA: sin paleta Atendidas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

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

describe('Recorte de bandejas personales', () => {
  it('el responsable no escucha el departamento y la secretaría escucha la radicación de 10 días', () => {
    const pers = read('js/persistence.js')
    const ini = pers.indexOf('const esSec=rolLogin===\'secretaria\'')
    const fin = pers.indexOf('if(esResp&&nombre)', ini)
    const cuerpo = pers.slice(ini, fin)
    expect(cuerpo).toContain('if(!esResp&&!esEnc&&!esSec')
    expect(cuerpo).toContain("campo:'pqrsRadicadaEn'")
    expect(cuerpo).toContain('corteFechaMarca(10)')
    expect(cuerpo).not.toContain('corteCalendarioIso(30)')
    expect(pers).toContain('secretariaRadicacionLista')
  })

  it('la fecha de radicación sale de la solicitud y Consulta deja 10 si no hay número', () => {
    const pers = read('js/persistence.js')
    const c = createContext({
      esPqrsSecretaria: e => !!(e && e._es_pqrs),
      nombresPendientesExp: () => [],
      expTieneSeguimiento: () => false
    })
    runInContext(extraer(pers, [
      'fechaRadicacionPqrsMarca', 'fechaCierrePqrsMarca', 'corteFechaMarca',
      'oficinaPqrsMarca', 'clavePqrsCerrada', 'aplicarMarcasBandeja'
    ]), c)
    const e = c.aplicarMarcasBandeja({ _es_pqrs: true, _fecha_solicitud: '2026-10-20', _estado: 'En trámite' })
    expect(e.pqrsRadicadaEn).toBe('2026-10-20')
    const q = createContext({ esSecretaria: () => true })
    runInContext(extraer(read('js/consulta.js'), ['consultaTopeSecretaria']), q)
    const muchas = []
    for (let i = 1; i <= 12; i++) muchas.push({ _exp: 'P' + i, _fecha: '2026-10-' + String(i).padStart(2, '0') })
    expect(q.consultaTopeSecretaria(muchas, '').length).toBe(10)
    expect(q.consultaTopeSecretaria(muchas, '')[0]._fecha).toBe('2026-10-12')
    expect(q.consultaTopeSecretaria(muchas, 'PQ-1').length).toBe(12)
  })

  it('radicación de secretaría deja fuera lo anterior a 10 días y el encargado NCA no pinta Atendidas', () => {
    const Real = Date
    class Fija extends Real {
      constructor(...args) {
        if (args.length) super(...args)
        else super(2026, 9, 31, 15, 0, 0)
      }
    }
    const c = createContext({ Date: Fija, corteFechaMarca: null })
    runInContext(extraer(read('js/persistence.js'), ['corteFechaMarca']), c)
    const p = createContext({ corteFechaMarca: c.corteFechaMarca })
    runInContext(extraer(read('js/pqrs.js'), ['secretariaRadicacionEnCorte']), p)
    expect(p.secretariaRadicacionEnCorte({ _fecha: '2026-10-21' })).toBe(true)
    expect(p.secretariaRadicacionEnCorte({ pqrsRadicadaEn: '2026-10-31' })).toBe(true)
    expect(p.secretariaRadicacionEnCorte({ _fecha: '2026-10-20' })).toBe(false)
    const core = read('js/core.js')
    expect(core).toContain("if(!(typeof esNcaDeguv==='function'&&esNcaDeguv()))cards.done=")
    expect(core).toContain("esNcaDeguv()&&filtroAct==='done'")
  })
})
