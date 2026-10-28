/**
 * chat-actividad-en-interno.test.js — El chat de la actividad avisa en el chat interno,
 * en un hilo propio. La campanita ya no lista esos mensajes.
 * Un mensaje para otra persona no suma en el hilo ni en el numerito de esta actividad.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
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

function ctx() {
  const c = createContext({
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    normalizeTask: t => t || {},
    taskChatCampanitaAplica: (cmt, t, yo) => {
      if (!cmt || cmt.incluidoEnReporte) return false
      if (String(cmt.autor || '').trim().toLowerCase() === String(yo || '').trim().toLowerCase()) return false
      return String(cmt.para || '').trim().toLowerCase() === String(yo || '').trim().toLowerCase()
    },
    bandejaItemIsEliminado: () => false,
    bandejaItemIsLeido: (it, leidos) => {
      const set = leidos instanceof Set ? leidos : new Set(leidos || [])
      return set.has(String(it.fecha || '') + '|' + String(it.autor || ''))
    },
    taskChatDestinatarioEfectivo: cmt => cmt.para || '',
    taskChatResolveDefaultPara: () => 'Encargado'
  })
  runInContext(extraer(core, [
    'chatActividadClave',
    'chatActividadParseClave',
    'chatActividadEsClave',
    'chatActividadParticipa',
    'chatActividadComentarioItem',
    'chatActividadComentarioNoLeido',
    'chatActividadResumen',
    'chatActividadEnviarPara'
  ]), c)
  return c
}

describe('Chat de actividad dentro del chat interno', () => {
  it('la campanita ya no arma avisos de chat de actividad', () => {
    const src = extraer(core, ['collectBandejaItems'])
    expect(src).not.toContain("tipo:'comentario'")
    expect(src).toContain("tipo:'devolucion'")
    expect(src).toContain("tipo:'revpar_aprobada'")
    expect(src).toContain("sol.tipo==='traslado'")
    expect(extraer(chat, ['chatUnreadCount'])).toContain('chatActividadNoLeidosTotal')
  })

  it('la clave del hilo identifica solo esa actividad', () => {
    const c = ctx()
    const k = c.chatActividadClave('PQRSD-1', 't9')
    expect(c.chatActividadEsClave(k)).toBe(true)
    expect(c.chatActividadEsClave('resp:Ana')).toBe(false)
    expect(c.chatActividadParseClave(k)).toEqual({ expId: 'PQRSD-1', taskId: 't9' })
  })

  it('el numerito de la actividad cuenta solo lo no leído para mí', () => {
    const c = ctx()
    const t = {
      desc: 'Visita',
      comentarios: [
        { autor: 'Luis', para: 'Ana', texto: 'Revise el predio', fecha: '2026-10-28T10:00:00' },
        { autor: 'Ana', para: 'Luis', texto: 'Ya fui', fecha: '2026-10-28T11:00:00' },
        { autor: 'Otro', para: 'Luis', texto: 'Esto no es para Ana', fecha: '2026-10-28T12:00:00' }
      ]
    }
    const row = c.chatActividadResumen('EXP-9', 't1', t, 'Ana', [])
    expect(row.label).toBe('EXP-9')
    expect(row.meta).toContain('Visita')
    expect(row.unread).toBe(1)
    expect(row.key).toBe(c.chatActividadClave('EXP-9', 't1'))
    const leido = c.chatActividadResumen('EXP-9', 't1', t, 'Ana', ['2026-10-28T10:00:00|Luis'])
    expect(leido.unread).toBe(0)
    expect(c.chatActividadResumen('EXP-9', 't1', {
      comentarios: [{ autor: 'Otro', para: 'Luis', texto: 'Ajeno', fecha: '2026-10-28T09:00:00' }]
    }, 'Ana', [])).toBe(null)
  })

  it('responder en el hilo va dirigido a la otra persona', () => {
    const c = ctx()
    const t = { comentarios: [
      { autor: 'Ana', para: 'Luis', texto: 'Hola' },
      { autor: 'Luis', para: 'Ana', texto: 'Listo' }
    ] }
    expect(c.chatActividadEnviarPara(t, 'Ana')).toBe('Luis')
    expect(c.chatActividadEnviarPara({ comentarios: [] }, 'Ana')).toBe('Encargado')
  })
})
