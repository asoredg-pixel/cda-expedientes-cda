/**
 * chat-aviso-soporte-nca.test.js — El encargado NCA envía avisos igual que el
 * administrador: salen como Soporte y el destinatario no puede responder.
 */

import { describe, it, expect } from 'vitest'
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

function permiso(flags) {
  const c = createContext({
    esAdministrador: () => !!flags.admin,
    esNcaDeguv: () => !!flags.nca,
    chatIsAdminKey: k => String(k || '') === 'admin:Soporte'
  })
  runInContext(extraer(chat, ['chatPuedeEnviarAvisoSoporte', 'chatPuedeResponderAContacto']), c)
  return c
}

describe('Aviso de Soporte del encargado NCA', () => {
  it('el administrador y el encargado NCA pueden enviar; los demás no', () => {
    expect(permiso({ admin: true }).chatPuedeEnviarAvisoSoporte()).toBe(true)
    expect(permiso({ nca: true }).chatPuedeEnviarAvisoSoporte()).toBe(true)
    expect(permiso({}).chatPuedeEnviarAvisoSoporte()).toBe(false)
  })

  it('el aviso sale como Soporte y no se puede contestar', () => {
    const envio = extraer(chat, ['chatAdminEnviarBroadcast'])
    expect(envio).toContain('fromKey:CHAT_ADMIN_KEY')
    expect(envio).toContain('fromLabel:CHAT_ADMIN_LABEL')
    expect(envio).toContain('noReply:true')
    expect(envio).toContain('broadcast:true')
    expect(envio).toContain('chatPuedeEnviarAvisoSoporte')
    const lista = extraer(chat, ['renderChatContacts'])
    expect(lista).toContain('chatPuedeEnviarAvisoSoporte()')
    expect(permiso({ nca: true }).chatPuedeResponderAContacto('admin:Soporte')).toBe(false)
  })
})
