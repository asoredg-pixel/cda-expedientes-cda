/**
 * chat-pegar-adjunto.test.js — Ctrl+V en el recuadro del chat interno
 * adjunta imagen o archivo (un solo envío). El texto copiado sigue pegándose.
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

function archivo(name, type, size, lastModified) {
  return { name: name, type: type, size: size == null ? 12 : size, lastModified: lastModified == null ? 1 : lastModified }
}

function ctx() {
  const enviados = []
  const avisos = []
  function File(bits, name, opts) {
    const src = bits && bits[0]
    this.name = name
    this.type = (opts && opts.type) || (src && src.type) || ''
    this.size = src && src.size || 0
    this.lastModified = src && src.lastModified || 0
  }
  const c = createContext({
    window: {},
    File: File,
    chatActiveContactKey: () => '',
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
    'chatAlPegarComposer'
  ]), c)
  return c
}

describe('Pegar adjunto en el chat interno', () => {
  it('el texto copiado no se trata como archivo', () => {
    const c = ctx()
    const ev = {
      clipboardData: {
        files: [],
        items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }]
      },
      prevented: false,
      preventDefault() { this.prevented = true }
    }
    expect(c.chatArchivosEnPortapapeles(ev.clipboardData)).toEqual([])
    c.chatAlPegarComposer(ev)
    expect(ev.prevented).toBe(false)
    expect(c._enviados).toEqual([])
    expect(c.chatArchivosEnPortapapeles(null)).toEqual([])
  })

  it('una captura (image.png) se envía una vez, con nombre de captura', () => {
    const c = ctx()
    const img = archivo('image.png', 'image/png', 40, 9)
    const ev = {
      clipboardData: {
        files: [img],
        items: [{ kind: 'file', getAsFile: () => archivo('image.png', 'image/png', 40, 9) }]
      },
      preventDefault() { this.prevented = true }
    }
    expect(c.chatArchivosEnPortapapeles(ev.clipboardData)).toHaveLength(1)
    c.chatAlPegarComposer(ev)
    expect(ev.prevented).toBe(true)
    expect(c._enviados).toHaveLength(1)
    expect(c._enviados[0].name).toMatch(/^Captura-\d{8}-\d{6}\.png$/)
    expect(c._enviados[0].type).toBe('image/png')
    expect(c._avisos).toEqual([])
  })

  it('un documento con nombre propio se envía tal cual; si hay varios, solo el primero', () => {
    const c = ctx()
    const pdf = archivo('Informe.pdf', 'application/pdf', 80, 3)
    const otro = archivo('Anexo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 90, 4)
    const listo = c.chatArchivoParaEnviarDesdePegado(pdf, new Date(2026, 9, 27, 16, 13, 5))
    expect(listo).toBe(pdf)
    expect(c.chatExtensionPegada(otro.type, otro.name)).toBe('docx')
    const ev = {
      clipboardData: { files: [pdf, otro], items: [] },
      preventDefault() {}
    }
    c.chatAlPegarComposer(ev)
    expect(c._enviados).toEqual([pdf])
  })

  it('una foto con nombre propio no se renombra; un archivo sin nombre sí', () => {
    const c = ctx()
    const foto = archivo('foto-predio.jpg', 'image/jpeg', 20, 2)
    expect(c.chatEsNombrePegadoGenerico('foto-predio.jpg')).toBe(false)
    expect(c.chatEsNombrePegadoGenerico('image.png')).toBe(true)
    expect(c.chatArchivoParaEnviarDesdePegado(foto, new Date())).toBe(foto)
    const cuando = new Date(2026, 9, 27, 16, 13, 5)
    const sinNombre = c.chatArchivoParaEnviarDesdePegado(archivo('', 'application/pdf', 8, 1), cuando)
    expect(sinNombre.name).toBe('Archivo-20261027-161305.pdf')
    expect(c.chatNombreCapturaPegada(cuando, 'png', true)).toBe('Captura-20261027-161305.png')
  })

  it('en avisos de Soporte no envía el archivo', () => {
    const c = ctx()
    c.window._chatActiveContactKey = 'admin:soporte'
    c.chatPuedeResponderAContacto = () => false
    const ev = {
      clipboardData: { files: [archivo('image.png', 'image/png')], items: [] },
      preventDefault() { this.prevented = true }
    }
    c.chatAlPegarComposer(ev)
    expect(ev.prevented).toBe(true)
    expect(c._enviados).toEqual([])
    expect(c._avisos[0].title).toBe('Solo lectura')
  })
})
