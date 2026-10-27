/**
 * Reducir lecturas de Firebase: los avisos del chat solo revisan los últimos 10 días
 * (antes 30). El historial completo se sigue cargando al abrir la conversación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chat = readFileSync(resolve(root, 'js/chat.js'), 'utf8')

describe('Chat: ventana de avisos', () => {
  it('es de 10 días', () => {
    expect(chat).toMatch(/^const CHAT_NOTIFY_VENTANA_DIAS=10;$/m)
  })

  it('la consulta de avisos filtra desde hace 10 días', () => {
    const ini = chat.indexOf('function chatNotifyRefReciente(')
    const fin = chat.indexOf('\n}', ini) + 2
    const filtros = []
    const ahora = Date.parse('2026-10-27T15:00:00.000Z')
    const c = createContext({
      CHAT_NOTIFY_VENTANA_DIAS: 10,
      Date: class extends Date { static now() { return ahora } },
      window: { _fsQuery: (ref, w) => ({ ref, w }), _fsWhere: (...a) => { filtros.push(a); return a } }
    })
    runInContext(chat.slice(ini, fin), c)
    c.chatNotifyRefReciente('col')
    expect(filtros[0]).toEqual(['ts', '>=', '2026-10-17T15:00:00.000Z'])
  })
})
