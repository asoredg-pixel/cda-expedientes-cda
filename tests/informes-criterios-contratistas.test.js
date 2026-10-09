/**
 * informes-criterios-contratistas.test.js — Configuración base › «Criterios informes contratistas»:
 * máximo de prioritarias y de urgentes/vencidas para entregar el informe de contrato.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const er = readFileSync(resolve(root, 'js/entrega-responsable.js'), 'utf8')
const cfgJs = readFileSync(resolve(root, 'js/configuracion.js'), 'utf8')

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

function ctx(recursosConfig) {
  const c = createContext({ recursosConfig })
  runInContext(extraer(er, ['getCriteriosInformes', 'informeCriteriosEvaluar']), c)
  return c
}

const esPrior = t => !!t.prior
const esUrg = t => !!t.venc

describe('Criterios informes contratistas', () => {
  it('lee los máximos; vacío o inválido = sin límite, 0 es válido', () => {
    expect(ctx({ criteriosInformes: { maxPrioritarias: 3, maxUrgVenc: '5' } }).getCriteriosInformes()).toEqual({ maxPrior: 3, maxUrgVenc: 5 })
    expect(ctx({ criteriosInformes: { maxPrioritarias: null, maxUrgVenc: '' } }).getCriteriosInformes()).toEqual({ maxPrior: null, maxUrgVenc: null })
    expect(ctx({ criteriosInformes: { maxPrioritarias: 0 } }).getCriteriosInformes()).toEqual({ maxPrior: 0, maxUrgVenc: null })
    expect(ctx({}).getCriteriosInformes()).toEqual({ maxPrior: null, maxUrgVenc: null })
  })

  it('bloquea solo si supera el máximo (5 permitido, 6 bloquea y pide atender 1)', () => {
    const c = ctx({})
    const cinco = Array.from({ length: 5 }, (_, i) => ({ id: 'v' + i, venc: true }))
    expect(c.informeCriteriosEvaluar(cinco, { maxPrior: null, maxUrgVenc: 5 }, esPrior, esUrg).bloquea).toBe(false)
    const seis = cinco.concat([{ id: 'v6', venc: true }])
    const r = c.informeCriteriosEvaluar(seis, { maxPrior: null, maxUrgVenc: 5 }, esPrior, esUrg)
    expect(r.bloquea).toBe(true)
    expect(r.exUrg).toBe(1)
    expect(r.exPrior).toBe(0)
  })

  it('prioritaria vencida cuenta en ambos criterios', () => {
    const c = ctx({})
    const r = c.informeCriteriosEvaluar([{ id: 'a', prior: true, venc: true }, { id: 'b', prior: true }], { maxPrior: 1, maxUrgVenc: 0 }, esPrior, esUrg)
    expect(r.prior.length).toBe(2)
    expect(r.urg.length).toBe(1)
    expect(r.exPrior).toBe(1)
    expect(r.exUrg).toBe(1)
  })

  it('no cuenta eliminadas ni los propios informes; sin límites no bloquea', () => {
    const c = ctx({})
    const lista = [{ id: 'x', venc: true, eliminada: true }, { id: 'y', venc: true, informeContrato: { numero: '1' } }, { id: 'z', venc: true }]
    const r = c.informeCriteriosEvaluar(lista, { maxPrior: null, maxUrgVenc: 0 }, esPrior, esUrg)
    expect(r.urg.map(t => t.id)).toEqual(['z'])
    expect(c.informeCriteriosEvaluar(lista, { maxPrior: null, maxUrgVenc: null }, esPrior, esUrg).bloquea).toBe(false)
  })

  it('al elegir «Entrega de informes» solo avisa (permite borrador); al entregar bloquea', () => {
    const f = extraer(er, ['onEntregaRespModoRadioChange'])
    expect(f).toContain('if(entregaRespEsInforme())informeCriteriosPermiteEntregar();')
    expect(f).not.toContain("ex.checked=true")
    expect(extraer(er, ['submitEntregaResponsable'])).toContain('if(entregaRespEsInforme()&&!informeCriteriosPermiteEntregar())return;')
    expect(extraer(er, ['informeCriteriosCandidatas'])).toContain("['pend','prior','porver','porcorr']")
  })

  it('Configuración base: sección solo admin y guardado en recursosConfig', () => {
    expect(extraer(cfgJs, ['renderListasCfg'])).toContain("if(esAdministrador()||esAdminFirestore())html+=cfgSectionFold('Criterios informes contratistas'")
    const saved = []
    const c = createContext({
      esAdministrador: () => true, esAdminFirestore: () => false,
      notif: () => {}, renderListasCfg: () => {},
      recursosConfig: { guainiaDriveRoot: 'g' },
      saveRecursosFirestore: async () => { saved.push(true); return true },
      document: { getElementById: id => ({ 'cfg-inf-max-prior': { value: '3' }, 'cfg-inf-max-urgvenc': { value: '' }, 'cfg-inf-correo': { value: ' ofi@x.co ' } })[id] || null },
      window: {}
    })
    runInContext(extraer(cfgJs, ['guardarInformesCriteriosCfg']) + '\nthis._g=guardarInformesCriteriosCfg;this._rc=()=>recursosConfig;', c)
    return c._g().then(() => {
      expect(saved.length).toBe(1)
      const rc = c._rc()
      expect(rc.criteriosInformes).toEqual({ maxPrioritarias: 3, maxUrgVenc: null })
      expect(rc.contratosInformesCorreo).toBe('ofi@x.co')
      expect(rc.guainiaDriveRoot).toBe('g')
    })
  })
})
