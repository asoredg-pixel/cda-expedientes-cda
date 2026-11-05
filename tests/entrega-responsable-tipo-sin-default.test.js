/**
 * entrega-responsable-tipo-sin-default.test.js — Entrega desde Por ejecutar (responsable):
 * 1) Clic fuera del modal no cierra (solo ✕ / Cancelar).
 * 2) Al abrir, Mensaje / Oficio / Informativa sin preselección; el detalle aparece al elegir.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const index = readFileSync(resolve(root, 'index.html'), 'utf8')

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

describe('Entrega responsable: overlay y tipo sin default', () => {
  it('overlay llama taskModalTryCloseOutside y no cierra envíos/entregas', () => {
    expect(index).toMatch(/task-modal-overlay[\s\S]*?taskModalTryCloseOutside\(\)/)
    const fn = extraer(core, ['taskModalTryCloseOutside'])
    expect(fn).toMatch(/noCloseOnOutside/)
    expect(fn).toMatch(/mode==='enviar'/)
    expect(fn).toMatch(/pqrs-entrega-campos/)
    expect(fn).toMatch(/closeTaskModal\(\)/)
  })

  it('openEnviarSoporteModal marca noCloseOnOutside', () => {
    expect(extraer(core, ['openEnviarSoporteModal'])).toMatch(/noCloseOnOutside:\s*true/)
  })

  it('responsable: sin Oficio preseleccionado; hint y detalles ocultos hasta elegir', () => {
    const src = extraer(core, ['renderPqrsEntregaCamposHtml'])
    expect(src).toMatch(/const tipoInicialResp=tipoActual/)
    expect(src).not.toMatch(/tipoInicialResp=tipoActual\|\|[\s\S]*PQRS_WF_TIPO\.OFICIO/)
    expect(src).toContain('Seleccione el tipo de respuesta para diligenciar los campos')
    expect(src).toMatch(/display:'\+\(tipoInicialResp\?'block':'none'\)/)
  })

  it('pqrsEntregaRefreshUi oculta detalles si no hay tipo (responsable)', () => {
    const fn = extraer(core, ['pqrsEntregaRefreshUi'])
    expect(fn).toMatch(/if\(!tipo\)\{\s*if\(detalles\)detalles\.style\.display='none'/)
  })

  it('taskModalTryCloseOutside: con noCloseOnOutside no llama close', () => {
    let closed = 0
    const c = createContext({
      window: { _taskModalCtx: { noCloseOnOutside: true, mode: 'enviar' } },
      document: { getElementById: () => null, querySelector: () => null },
      closeTaskModal() { closed++ }
    })
    runInContext(extraer(core, ['taskModalTryCloseOutside']), c)
    c.taskModalTryCloseOutside()
    expect(closed).toBe(0)
    c.window._taskModalCtx = { mode: 'chat' }
    c.taskModalTryCloseOutside()
    expect(closed).toBe(1)
  })
})
