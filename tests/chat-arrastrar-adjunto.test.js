/**
 * chat-arrastrar-adjunto.test.js — Soltar un archivo sobre el chat
 * lo adjunta y lo envía. El navegador no debe abrir el documento.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chat = readFileSync(resolve(root, 'js/chat.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

function archivo(name, type, size) {
  return { name: name, type: type, size: size == null ? 20 : size, lastModified: 1 }
}

function evArchivos(files, types) {
  return {
    dataTransfer: { files: files, items: [], types: types || ['Files'], dropEffect: '' },
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true }
  }
}

function ctxChat() {
  const enviados = []
  const avisos = []
  function File(bits, name, opts) {
    const src = bits && bits[0]
    this.name = name
    this.type = (opts && opts.type) || ''
    this.size = src && src.size || 0
    this.lastModified = src && src.lastModified || 0
  }
  const c = createContext({
    window: {},
    File: File,
    chatActiveContactKey: () => 'resp:Ana',
    chatPuedeResponderAContacto: () => true,
    chatEnviarArchivo: f => { enviados.push(f) },
    chatModalAlert: o => { avisos.push(o) },
    _enviados: enviados,
    _avisos: avisos
  })
  runInContext(extraer(chat, [
    'chatEsNombrePegadoGenerico',
    'chatExtensionPegada',
    'chatNombreCapturaPegada',
    'chatArchivoParaEnviarDesdePegado',
    'chatArchivosEnPortapapeles',
    'chatEventoTraeArchivos',
    'chatAlArrastrarComposer',
    'chatEnviarArchivosPegados',
    'chatAlSoltarComposer'
  ]), c)
  return c
}

function ctxAct() {
  const picks = []
  const envios = []
  const avisos = []
  function File(bits, name, opts) {
    const src = bits && bits[0]
    this.name = name
    this.type = (opts && opts.type) || ''
    this.size = src && src.size || 0
  }
  const c = createContext({
    Promise: Promise,
    File: File,
    CHAT_DRIVE_MAX_BYTES: 25 * 1024 * 1024,
    chatDriveConectado: () => true,
    chatModalCorreoRequerido: () => { c._correo = true },
    chatModalAlert: o => { avisos.push(o) },
    taskChatAttachOnPick: (expId, taskId, inputEl) => {
      picks.push({ expId: expId, taskId: taskId, files: Array.from(inputEl.files || []) })
    },
    submitTaskComment: (expId, taskId) => { envios.push(expId + ':' + taskId) },
    _picks: picks,
    _envios: envios,
    _avisos: avisos,
    _correo: false
  })
  runInContext(extraer(chat, [
    'chatEsNombrePegadoGenerico',
    'chatExtensionPegada',
    'chatNombreCapturaPegada',
    'chatArchivoParaEnviarDesdePegado',
    'chatArchivosEnPortapapeles'
  ]) + '\n' + extraer(core, [
    'taskChatAlArrastrarComposer',
    'taskChatAlSoltarComposer'
  ]), c)
  return c
}

describe('Arrastrar adjunto al chat', () => {
  it('el chat interno y el de la actividad escuchan el soltado', () => {
    expect(html).toContain('ondrop="chatAlSoltarComposer(event)"')
    expect(html).toContain('ondragover="chatAlArrastrarComposer(event)"')
    expect(core).toContain('ondrop="taskChatAlSoltarComposer(event,')
    expect(core).toContain('ondragover="taskChatAlArrastrarComposer(event)"')
  })

  it('arrastrar un archivo evita que el navegador lo abra', () => {
    const c = ctxChat()
    const over = evArchivos([])
    c.chatAlArrastrarComposer(over)
    expect(over.prevented).toBe(true)
    expect(over.stopped).toBe(true)
    const texto = evArchivos([], ['text/plain'])
    c.chatAlArrastrarComposer(texto)
    expect(texto.prevented).toBe(false)
  })

  it('soltar en el chat interno envía el archivo (solo el primero)', () => {
    const c = ctxChat()
    const img = archivo('image.png', 'image/png')
    const pdf = archivo('Informe.pdf', 'application/pdf', 80)
    const ev = evArchivos([img, pdf])
    c.chatAlSoltarComposer(ev)
    expect(ev.prevented).toBe(true)
    expect(c._enviados).toHaveLength(1)
    expect(c._enviados[0].name).toMatch(/^Captura-\d{8}-\d{6}\.png$/)
    const vacio = evArchivos([])
    vacio.dataTransfer.types = []
    c.chatAlSoltarComposer(vacio)
    expect(vacio.prevented).toBe(false)
    expect(c._enviados).toHaveLength(1)
  })

  it('en avisos de Soporte soltar no envía', () => {
    const c = ctxChat()
    c.chatPuedeResponderAContacto = () => false
    const ev = evArchivos([archivo('image.png', 'image/png')])
    c.chatAlSoltarComposer(ev)
    expect(ev.prevented).toBe(true)
    expect(c._enviados).toEqual([])
    expect(c._avisos[0].title).toBe('Solo lectura')
  })

  it('soltar en el chat de la actividad adjunta y envía el mensaje', async () => {
    const c = ctxAct()
    const img = archivo('image.png', 'image/png', 30)
    const pdf = archivo('Informe.pdf', 'application/pdf', 40)
    const ev = evArchivos([img, pdf])
    c.taskChatAlSoltarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(ev.prevented).toBe(true)
    expect(c._picks).toHaveLength(1)
    expect(c._picks[0].files[0].name).toMatch(/^Captura-\d{8}-\d{6}\.png$/)
    expect(c._picks[0].files[1]).toBe(pdf)
    expect(c._envios).toEqual(['E1:t1'])
  })

  it('un archivo de más de 25 MB no se envía', async () => {
    const c = ctxAct()
    const ev = evArchivos([archivo('plano.pdf', 'application/pdf', 26 * 1024 * 1024)])
    c.taskChatAlSoltarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(c._picks).toEqual([])
    expect(c._envios).toEqual([])
    expect(c._avisos[0].title).toBe('Archivo demasiado grande')
  })

  it('sin correo conectado no envía el archivo soltado', async () => {
    const c = ctxAct()
    c.chatDriveConectado = () => false
    const ev = evArchivos([archivo('foto.jpg', 'image/jpeg')])
    c.taskChatAlSoltarComposer(ev, 'E1', 't1')
    await Promise.resolve()
    expect(c._picks).toEqual([])
    expect(c._envios).toEqual([])
    expect(c._correo).toBe(true)
  })
})
