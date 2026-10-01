/**
 * chat-notify-ventana.test.js — El aviso de chat solo escucha mensajes de los últimos 30 días
 * (collectionGroup y modo por conversación); el historial completo se carga al abrir la conversación.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

function montar(win) {
  const c = { Date, window: win, CHAT_NOTIFY_VENTANA_DIAS: 30 }
  createContext(c)
  runInContext(extraerFunciones(read('js/chat.js'), ['chatNotifyRefReciente']), c)
  return c
}

describe('Aviso de chat: ventana de 30 días', () => {
  it('filtra por ts >= hace 30 días', () => {
    const c = montar({
      _fsQuery: (ref, w) => ({ ref, w }),
      _fsWhere: (campo, op, val) => ({ campo, op, val })
    })
    const q = c.chatNotifyRefReciente('REF')
    expect(q.ref).toBe('REF')
    expect(q.w.campo).toBe('ts')
    expect(q.w.op).toBe('>=')
    const dias = (Date.now() - Date.parse(q.w.val)) / 864e5
    expect(dias).toBeGreaterThan(29.9)
    expect(dias).toBeLessThan(30.1)
  })

  it('sin query/where disponibles (caché vieja) usa la referencia completa', () => {
    const c = montar({})
    expect(c.chatNotifyRefReciente('REF')).toBe('REF')
  })

  it('se aplica al collectionGroup y al modo por conversación, no al abrir la conversación', () => {
    const src = read('js/chat.js')
    expect(src).toContain("chatNotifyRefReciente(window._fsCollectionGroup(db,'mensajes'))")
    expect((src.match(/chatNotifyRefReciente\(window\._fsCollection\(/g) || []).length).toBe(1)
    expect(read('js/firebase-init.js')).toMatch(/window\._fsWhere=where;/)
  })
})
