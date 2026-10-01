/**
 * chat-no-leidos.test.js — Contador de no leídos del chat interno: al marcar leído se refresca la caché
 * de contadores; se marca al abrir (antes de cargar historial) y los mensajes que llegan con la conversación a la vista.
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

function montar() {
  const msgs = [{ id: 'm1', convId: 'c1', fromKey: 'resp:otro', readBy: [] }]
  const c = {
    Set, Promise, console, msgs,
    _chatContactPreviewCache: null,
    window: { _chatActiveContactKey: 'resp:otro', _db: null },
    document: { hidden: false, getElementById: () => ({ classList: { contains: () => true } }) },
    getMyChatKeys: () => ['resp:yo'],
    chatNormKey: k => String(k || '').toLowerCase(),
    chatEffectiveIdentity: () => ({ key: 'resp:yo' }),
    getChatIdentity: () => ({ key: 'resp:yo' }),
    chatActiveContactKey: () => 'resp:otro',
    chatEsMio: m => m.fromKey === 'resp:yo',
    chatMsgsForContact: () => msgs,
    chatConvMessages: () => msgs,
    renderChatContacts: () => {},
    renderChatBadge: () => {
      if (!c._chatContactPreviewCache) c._chatContactPreviewCache = new Map()
      if (!c._chatContactPreviewCache.has('k')) c._chatContactPreviewCache.set('k', c.chatUnread())
      c.badge = c._chatContactPreviewCache.get('k')
    }
  }
  createContext(c)
  runInContext(
    'function chatInvalidateContactPreviewCache(){_chatContactPreviewCache=null;}\n' +
    'function chatUnread(){return msgs.filter(chatMsgUnreadForMe).length;}\n' +
    extraerFunciones(read('js/chat.js'), ['chatMsgUnreadForMe', 'chatMarcarLeido', 'chatViendoContacto']), c)
  return c
}

describe('Chat interno: contador de no leídos', () => {
  it('al marcar leído el globo baja a 0 (no queda el valor en caché)', async () => {
    const c = montar()
    c.renderChatBadge()
    expect(c.badge).toBe(1)
    await c.chatMarcarLeido('c1')
    expect(c.msgs[0].readBy).toContain('resp:yo')
    expect(c.badge).toBe(0)
  })

  it('solo se considera «viendo» la conversación activa con la ventana abierta y la pestaña visible', () => {
    const c = montar()
    expect(c.chatViendoContacto('resp:otro')).toBe(true)
    expect(c.chatViendoContacto('resp:tercero')).toBe(false)
    c.document.hidden = true
    expect(c.chatViendoContacto('resp:otro')).toBe(false)
  })

  it('marca al abrir antes de cargar el historial y al llegar mensajes con la conversación a la vista', () => {
    const src = read('js/chat.js')
    const abrir = src.slice(src.indexOf('async function chatAbrirConv('), src.indexOf('window.chatAbrirConv=chatAbrirConv;'))
    expect(abrir.indexOf('void chatMarcarLeido(window._chatConvActiva);')).toBeGreaterThan(-1)
    expect(abrir.indexOf('void chatMarcarLeido(window._chatConvActiva);')).toBeLessThan(abrir.indexOf('await loadChatMensajesForContact('))
    expect(src).toContain('if(llegaron&&chatViendoContacto(contactKey))void chatMarcarLeido(window._chatConvActiva);')
  })
})
