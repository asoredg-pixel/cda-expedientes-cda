/**
 * crear-actividad-modal-sin-autofoco.test.js — «Crear actividad» (encargado NCA): al abrir se desplegaba sola la lista
 * de actividades predeterminadas (foco automático), y en «Expediente / PQRSD» la ventana se achicaba y recortaba la lista.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')

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

describe('Crear actividad · encargado', () => {
  it('no enfoca «Actividad» al abrir ni al elegir expediente (no abre la lista sola)', () => {
    expect(extraer(core, ['openCrearActLibreModal'])).not.toMatch(/act-libre-nombre'\);if\(\w+\)\w+\.focus\(\)/)
    expect(extraer(core, ['actLibreExpPickExistente'])).not.toMatch(/\.focus\(\)/)
  })

  it('usa el tamaño del modal de responsables y mantiene un alto mínimo', () => {
    expect(extraer(core, ['openCrearActLibreModal'])).toMatch(/'entrega-resp-modal','act-libre-crear-modal'/)
    expect(css).toMatch(/\.task-modal\.enviar-modal-only\.act-libre-crear-modal \.task-modal-body\{min-height:min\(560px,70vh\)\}/)
    expect(extraer(core, ['closeTaskModal'])).toMatch(/classList\.remove\('act-libre-crear-modal'\)/)
  })
})
