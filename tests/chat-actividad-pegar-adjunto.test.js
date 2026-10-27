/**
 * chat-actividad-pegar-adjunto.test.js — Ctrl+V en el chat de la actividad
 * deja la imagen o el archivo en la bandeja de adjuntos (igual que el clip).
 * El texto copiado sigue pegándose. No envía el mensaje solo.
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

function archivo(name, type, size, lastModified) {
  return { name: name, type: type, size: size == null ? 12 : size, lastModified: lastModified == null ? 1 : lastModified }
}

function ctx(extra) {
  const picks = []
  function File(bits, name, opts) {
    const src = bits && bits[0]
    this.name = name
    this.type = (opts && opts.type) || (src && src.type) || ''
    this.size = src && src.size || 0
    this.lastModified = src && src.lastModified || 0
  }
  const c = createContext(Object.assign({
    Promise: Promise,
    File: File,
    chatDriveConectado: () => true,
    chatModalCorreoRequerido: () => { c._correo = true },
    taskChatAttachOnPick: (expId, taskId, inputEl) => {
      picks.push({ expId: expId, taskId: taskId, files: Array.from(inputEl.files || []) })
    },
    _picks: picks,
    _correo: false
  }, extra || {}))
  runInContext(extraer(chat, [
    'chatEsNombrePegadoGenerico',
    'chatExtensionPegada',
    'chatNombreCapturaPegada',
    'chatArchivoParaEnviarDesdePegado',
    'chatArchivosEnPortapapeles'
  ]) + '\n' + extraer(core, ['taskChatAlPegarComposer']), c)
  return c
}

describe('Pegar adjunto en el chat de la actividad', () => {
  it('el recuadro del chat de actividad escucha el pegado', () => {
    expect(core).toContain('onpaste="taskChatAlPegarComposer(event,')
    expect(core).toContain('id="task-chat-file-inp"')
  })

  it('el texto copiado no se adjunta', async () => {
    const c = ctx()
    const ev = {
      clipboardData: { files: [], items: [{ kind: 'string', type: 'text/plain' }] },
      prevented: false,
      preventDefault() { this.prevented = true }
    }
    c.taskChatAlPegarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(ev.prevented).toBe(false)
    expect(c._picks).toEqual([])
  })

  it('una captura y un documento quedan en la bandeja, sin enviar el mensaje', async () => {
    const c = ctx()
    const img = archivo('image.png', 'image/png', 40, 9)
    const pdf = archivo('Informe.pdf', 'application/pdf', 80, 3)
    const ev = {
      clipboardData: { files: [img, pdf], items: [] },
      preventDefault() { this.prevented = true }
    }
    c.taskChatAlPegarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(ev.prevented).toBe(true)
    expect(c._picks).toHaveLength(1)
    expect(c._picks[0].expId).toBe('E1')
    expect(c._picks[0].taskId).toBe('t1')
    expect(c._picks[0].files[0].name).toMatch(/^Captura-\d{8}-\d{6}\.png$/)
    expect(c._picks[0].files[1]).toBe(pdf)
    expect(c._correo).toBe(false)
  })

  it('sin correo conectado no adjunta y pide conectar', async () => {
    const c = ctx({ chatDriveConectado: () => false })
    const ev = {
      clipboardData: { files: [archivo('image.png', 'image/png')], items: [] },
      preventDefault() {}
    }
    c.taskChatAlPegarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(c._picks).toEqual([])
    expect(c._correo).toBe(true)
  })

  it('si Gmail no autoriza el adjunto, no lo deja en la bandeja', async () => {
    const c = ctx({ sstSolicitarGmailParaAdjuntar: () => Promise.resolve(false) })
    const ev = {
      clipboardData: { files: [archivo('foto-predio.jpg', 'image/jpeg')], items: [] },
      preventDefault() {}
    }
    c.taskChatAlPegarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    await Promise.resolve()
    expect(c._picks).toEqual([])
  })
})
