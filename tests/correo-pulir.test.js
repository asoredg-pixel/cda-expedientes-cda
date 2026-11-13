/**
 * correo-pulir.test.js — botón 🪄 Pulir en cuerpos de correo:
 * validación, HTML del botón, y que los formularios lo enganchan sin romper el textarea.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pulirSrc = readFileSync(resolve(root, 'js/correo-pulir.js'), 'utf8')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const tf = readFileSync(resolve(root, 'js/tramite-firma.js'), 'utf8')
const fnSrc = readFileSync(resolve(root, 'functions/index.js'), 'utf8')
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8')

function loadPulir() {
  const c = createContext({
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, appendChild() {} }),
      body: { appendChild() {} }
    },
    escAttr: s => String(s == null ? '' : s).replace(/"/g, '&quot;'),
    notif: () => {},
    Event: function () {}
  })
  c.window = c
  runInContext(pulirSrc, c)
  return c
}

describe('correo-pulir', () => {
  it('valida vacío y tope de caracteres', () => {
    const c = loadPulir()
    expect(c.correoPulirValidarTexto('').ok).toBe(false)
    expect(c.correoPulirValidarTexto('  ').ok).toBe(false)
    expect(c.correoPulirValidarTexto('Hola mundo').ok).toBe(true)
    expect(c.correoPulirValidarTexto('x'.repeat(c.CORREO_PULIR_MAX + 1)).ok).toBe(false)
  })

  it('html del botón apunta al textarea indicado', () => {
    const c = loadPulir()
    const h = c.htmlCorreoPulirBtn('entrega-notif-email-cuerpo')
    expect(h).toContain('correoPulirAbrir(')
    expect(h).toContain('entrega-notif-email-cuerpo')
    expect(h).toContain('🪄 Pulir')
    const row = c.htmlCorreoPulirLabelRow('Cuerpo', 'rev-ent-email-cuerpo', 'lbl-x')
    expect(row).toContain('id="lbl-x"')
    expect(row).toContain('rev-ent-email-cuerpo')
  })

  it('formularios principales incluyen el enganche (con fallback si no hay helper)', () => {
    expect(core).toContain("htmlCorreoPulirLabelRow('Cuerpo del correo")
    expect(core).toContain("'entrega-notif-email-cuerpo'")
    expect(core).toContain("'rev-ent-email-cuerpo'")
    expect(core).toContain("'pqrs-entrega-resp-cuerpo'")
    expect(core).toContain("'pqrs-compose-body'")
    expect(core).toContain("'pqrs-resp-cuerpo'")
    expect(core).toContain("'nca-rev-cuerpo'")
    expect(core).toContain("'pqrs-notif-cuerpo'")
    expect(core).toContain("'task-rev-notif-cuerpo'")
    expect(tf).toContain("'tramite-notif-cuerpo'")
    expect(tf).toContain("'tramite-atajo-email-cuerpo'")
    expect(tf).toContain("'ofi-doc-cuerpo'")
  })

  it('index carga correo-pulir.js y build 20261113b', () => {
    expect(indexHtml).toContain('js/correo-pulir.js?v=20261113b')
    expect(indexHtml).toContain('js/core.js?v=20261113b')
  })

  it('Cloud Function: secret, auth y prompt sin inventar hechos', () => {
    expect(fnSrc).toContain("defineSecret('GEMINI_API_KEY')")
    expect(fnSrc).toContain('pulirCorreoTexto')
    expect(fnSrc).toContain("if (!request.auth)")
    expect(fnSrc).toContain('No inventes hechos')
    expect(fnSrc).toContain('gemini-2.5-flash')
    expect(fnSrc).toContain('Sin crédito de Gemini API')
    expect(fnSrc).toMatch(/exports\.pulirCorreoTexto\s*=\s*onCall/)
  })

  it('Usar pulido solo escribe el textarea (no Firestore en el helper)', () => {
    expect(pulirSrc).not.toMatch(/setDoc|saveExpediente|mutateTask|updateDoc/)
    expect(pulirSrc).toContain('ta.value = pulido')
    expect(pulirSrc).toContain('Conservar original')
    expect(pulirSrc).toContain('Usar texto pulido')
  })
})
