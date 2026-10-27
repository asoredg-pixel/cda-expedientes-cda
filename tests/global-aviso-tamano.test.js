/**
 * sistema/global llegó a 1 MB sin que nadie se enterara y dejó de guardarse.
 * Aviso temprano (800 KB) al administrador y al encargado NCA.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const per = readFileSync(resolve(root, 'js/persistence.js'), 'utf8')

function extraer(src, nombres) {
  return nombres.map(n => {
    const ini = src.search(new RegExp('^(async )?function ' + n + '\\(', 'm'))
    if (ini < 0) throw new Error('No se encontró ' + n)
    let fin = src.indexOf('\n', ini)
    while (fin > 0) {
      const code = src.slice(ini, fin)
      try { new Script(code); return code } catch (e) { /* incompleta */ }
      fin = src.indexOf('\n', fin + 1)
    }
    throw new Error('No se pudo delimitar ' + n)
  }).join('\n')
}

function ctxAviso({ rol = 'admin', admin = true } = {}) {
  const avisos = []
  const c = createContext({
    window: { _usuarioActual: { rol } },
    JSON, Math, String,
    esAdministrador: () => admin,
    notif: (m, t) => avisos.push({ m, t })
  })
  runInContext('const GLOBAL_AVISO_KB=800;\n' + extraer(per, ['avisarTamanoGlobalSiCrece']), c)
  return { c, avisos }
}

const docDe = kb => ({ personas: 'x'.repeat(kb * 1024) })

describe('Aviso de tamaño de sistema/global', () => {
  it('con 544 KB no avisa', () => {
    const { c, avisos } = ctxAviso()
    c.avisarTamanoGlobalSiCrece(docDe(544))
    expect(avisos).toHaveLength(0)
  })

  it('desde 800 KB avisa al administrador una sola vez', () => {
    const { c, avisos } = ctxAviso()
    c.avisarTamanoGlobalSiCrece(docDe(850))
    c.avisarTamanoGlobalSiCrece(docDe(860))
    expect(avisos).toHaveLength(1)
    expect(avisos[0].t).toBe('warn')
    expect(avisos[0].m).toContain('850 KB de 1.024 KB')
  })

  it('también avisa al encargado NCA', () => {
    const { c, avisos } = ctxAviso({ rol: 'guaviare', admin: false })
    c.avisarTamanoGlobalSiCrece(docDe(900))
    expect(avisos).toHaveLength(1)
  })

  it('a otros roles no les avisa', () => {
    const { c, avisos } = ctxAviso({ rol: 'secretaria', admin: false })
    c.avisarTamanoGlobalSiCrece(docDe(1000))
    expect(avisos).toHaveLength(0)
  })

  it('se revisa con cada actualización de sistema/global, sin lecturas extra', () => {
    const fn = extraer(per, ['initRealtimeGlobalSync'])
    expect(fn).toContain('avisarTamanoGlobalSiCrece(g);')
  })
})
