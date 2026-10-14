/**
 * responsable-orden-paletas.test.js — Actividades del responsable: orden de paletas
 * Por ejecutar, Prioritarias, Por notificar, Por corregir, Por revisar y Atendidas.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

describe('Orden de paletas del responsable', () => {
  it('tarjetas: Por revisar justo antes de Atendidas; encargado/VITAL/Director sin cambio', () => {
    expect(core).toMatch(/const ordenMets=isResp&&!isVital&&!esDirAct\s*\?\['pend','prior','pornotif','porcorr','porver','porfirma','req','done'\]\s*:\['pend','prior','porver','revisados','porcorr','porfirma','pornotif','req','done'\];/)
    expect(core).toMatch(/const metsHtml=ordenMets\.map\(function\(k\)\{return cards\[k\]\|\|'';\}\)\.join\(''\);/)
  })

  it('selector de estado del responsable en el mismo orden', () => {
    expect(core).toMatch(/:\['pend','prior','venc','pornotif','porcorr','porver','done','all'\]\)\);/)
    expect(core).toMatch(/\?\['pend','prior','venc','porver','revisados','porcorr','porfirma','pornotif','req','done','all'\]/)
  })
})
