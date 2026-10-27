/**
 * Firestore registró ~497k lecturas en un día (cupo gratis 50k). El medidor cuenta los
 * documentos que entrega cada fuente para saber qué pantalla las consume.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const firebaseInit = readFileSync(resolve(root, 'js/firebase-init.js'), 'utf8')

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

function ctxMedidor({ sesion = true } = {}) {
  const store = {}
  const c = createContext({
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: k => { delete store[k] }
    },
    document: { body: { classList: { contains: () => sesion } } },
    setTimeout: fn => { fn(); return 1 },
    clearTimeout: () => {},
    JSON, Date
  })
  runInContext("const FS_LECT_KEY='sst_fs_lecturas';let fsLect=null;let fsLectTimer=null;\n" +
    extraer(firebaseInit, ['fsLectHoy', 'fsLectEstado', 'fsLectRuta', 'fsLectSumar', 'fsLectSnap']), c)
  return { c, store }
}

const col = path => ({ path })
const snapCol = (n, extra = {}) => ({
  metadata: { fromCache: false, ...extra },
  docChanges: () => Array.from({ length: n }, () => ({ doc: { metadata: { hasPendingWrites: false } } }))
})

describe('Medidor de lecturas Firestore', () => {
  it('agrupa por colección sin mezclar departamentos y oculta ids de documentos', () => {
    const { c } = ctxMedidor()
    expect(c.fsLectRuta(col('departamentos/guaviare/expedientes'))).toBe('departamentos/guaviare/expedientes')
    expect(c.fsLectRuta(col('departamentos/guaviare/expedientes/EXP-12'))).toBe('departamentos/guaviare/expedientes/*')
    expect(c.fsLectRuta(col('sistema/global'))).toBe('sistema/global')
    expect(c.fsLectRuta(col('chats/a_b/mensajes'))).toBe('chats/*/mensajes')
    expect(c.fsLectRuta(col('usuarios/x@y.co'))).toBe('usuarios/*')
  })

  it('la escucha suma los documentos entregados por el servidor', () => {
    const { c } = ctxMedidor()
    const ref = col('departamentos/guaviare/expedientes')
    c.fsLectSnap(ref, snapCol(1500))
    c.fsLectSnap(ref, snapCol(2))
    c.fsLectSnap(ref, snapCol(9, { fromCache: true }))
    const st = c.fsLectEstado()
    expect(st.por['escucha departamentos/guaviare/expedientes']).toEqual({ lecturas: 1502, veces: 2 })
    expect(st.total).toBe(1502)
  })

  it('no cuenta el eco de los cambios propios aún sin confirmar', () => {
    const { c } = ctxMedidor()
    c.fsLectSnap(col('sistema/global'), { metadata: { fromCache: false, hasPendingWrites: true } })
    c.fsLectSnap(col('sistema/global'), { metadata: { fromCache: false, hasPendingWrites: false } })
    expect(c.fsLectEstado().total).toBe(1)
  })

  it('distingue lo leído antes de ingresar y lo conserva al recargar', () => {
    const a = ctxMedidor({ sesion: false })
    a.c.fsLectSumar('getDocs', col('departamentos/vaupes/expedientes'), 300)
    const b = ctxMedidor()
    Object.assign(b.store, a.store)
    const st = b.c.fsLectEstado()
    expect(st.por['getDocs departamentos/vaupes/expedientes (antes de ingresar)'].lecturas).toBe(300)
  })

  it('getDoc, getDocs y escuchas pasan por el medidor', () => {
    expect(firebaseInit).toMatch(/window\._fsGetDoc=function\(ref\)/)
    expect(firebaseInit).toMatch(/window\._fsGetDocs=function\(ref\)/)
    expect(firebaseInit).toMatch(/window\._fsOnSnapshot=function\(ref,cb\)/)
    expect(firebaseInit).toContain('window.sstLecturas=function')
  })
})
