/**
 * chat-badge-sin-congelar-ventana.test.js — Al volver a la ventana no se reabren los listeners
 * del chat (re-descarga y ~90 ms de conteo por conversación congelaban el redimensionado)
 * y el conteo de no leídos se agrupa en uno por ráfaga.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chat = readFileSync(resolve(root, 'js/chat.js'), 'utf8')

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

describe('Chat: no congelar la ventana', () => {
  it('ráfaga de snapshots → un solo conteo de no leídos', () => {
    vi.useFakeTimers()
    let n = 0
    const c = createContext({ setTimeout, renderChatBadge: () => { n++ } })
    runInContext('let _chatBadgeTimer=null;\n' + extraer(chat, ['scheduleRenderChatBadge']), c)
    for (let i = 0; i < 42; i++) c.scheduleRenderChatBadge()
    vi.advanceTimersByTime(200)
    expect(n).toBe(1)
    c.scheduleRenderChatBadge()
    vi.advanceTimersByTime(200)
    expect(n).toBe(2)
    vi.useRealTimers()
  })

  it('los listeners de snapshots usan el conteo agrupado', () => {
    expect(extraer(chat, ['initChatSync'])).toContain('scheduleRenderChatBadge();')
    expect(extraer(chat, ['initChatNotifySync'])).toContain('scheduleRenderChatBadge();')
    expect(extraer(chat, ['chatNotifyConvIdsFallback'])).toContain('scheduleRenderChatBadge();')
    expect(extraer(chat, ['initChatNotifySync'])).not.toContain('    renderChatBadge();')
  })

  it('al volver a la ventana solo reinicia el chat si no hay listeners activos', () => {
    const i = chat.indexOf("document.addEventListener('visibilitychange'")
    const bloque = chat.slice(i, chat.indexOf('});', i))
    expect(bloque).toContain("if(!_chatNotifyUnsubs.length&&typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();")
    expect(bloque).toContain('scheduleRenderChatBadge();')
  })
})
