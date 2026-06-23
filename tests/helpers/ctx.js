/**
 * ctx.js — Cargador de scripts clásicos (browser-globals) para Vitest
 *
 * Los archivos en js/ usan `const`/`let`/`function` a nivel raíz sin
 * export/import. Para testearlos usamos vm.runInContext, que ejecuta
 * cada script en un contexto compartido (sst) que simula window/global.
 *
 * Uso en tests:
 *   import { sst } from '../helpers/ctx.js'
 *   const { hoy, dias, escAttr } = sst
 */

import { createContext, runInContext } from 'vm'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')

function read(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8')
}

// ---------------------------------------------------------------------------
// Contexto compartido (simula window + globals del browser)
// ---------------------------------------------------------------------------
const sst = {
  // ---- Mocks de APIs del browser ----
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Promise,
  JSON,
  Math,
  Date,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  Map,
  Set,
  isNaN,
  isFinite,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent,

  // ---- localStorage mock ----
  localStorage: (() => {
    const store = {}
    return {
      getItem:    (k)    => store[k] ?? null,
      setItem:    (k, v) => { store[k] = String(v) },
      removeItem: (k)    => { delete store[k] },
      clear:      ()     => { Object.keys(store).forEach(k => delete store[k]) },
      get length() { return Object.keys(store).length },
      key:        (i)    => Object.keys(store)[i] ?? null,
    }
  })(),

  // ---- document stub mínimo ----
  document: {
    getElementById:       () => null,
    querySelector:        () => null,
    querySelectorAll:     () => [],
    createElement:        (tag) => ({ tagName: tag, style: {}, classList: { add(){}, remove(){}, toggle(){}, contains:()=>false } }),
    body:                 { appendChild(){}, classList:{ add(){}, remove(){}, contains:()=>false } },
    documentElement:      { classList:{ add(){}, remove(){}, contains:()=>false } },
    addEventListener:     () => {},
    removeEventListener:  () => {},
  },

  // ---- window stub ----
  window: null,  // se asigna abajo

  // ---- DOMPurify mock: pasa el string limpio sin HTML ----
  DOMPurify: {
    sanitize: (s, _opts) => {
      if (s == null) return ''
      // Strip HTML tags for test purposes
      return String(s).replace(/<[^>]*>/g, '')
    },
  },

  // ---- LZString mock: sin compresión real en tests ----
  LZString: {
    compress:   s => s,
    decompress: s => s,
  },

  // ---- Firebase stubs (no se usan en tests unitarios) ----
  _db: null,
  _firebaseReady: false,
}

// window apunta al mismo objeto
sst.window = sst
sst.global = sst

// Hacer el contexto vm
createContext(sst)

// ---------------------------------------------------------------------------
// Loader
// `const` y `let` a nivel de módulo en un vm context quedan en el scope del
// script pero NO se adjuntan como propiedades del context object.
// Convirtiéndolos a `var` (solo al inicio de línea = top-level) hacemos que
// queden disponibles como sst.NOMBRE en los tests.
// ---------------------------------------------------------------------------
function patchTopLevel(code) {
  return code
    .replace(/^const\b/gm, 'var')
    .replace(/^let\b/gm,   'var')
}

function loadScript(relPath, patch = true) {
  try {
    const raw  = read(relPath)
    const code = patch ? patchTopLevel(raw) : raw
    runInContext(code, sst)
  } catch (err) {
    console.warn(`[ctx] Error loading ${relPath}:`, err.message)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Cargar módulos en orden de dependencia
// ---------------------------------------------------------------------------
loadScript('js/constants.js')
loadScript('js/utils.js')
loadScript('js/state.js')
loadScript('js/persistence.js')
loadScript('js/roles.js')
loadScript('js/config-store.js')

// ---------------------------------------------------------------------------
// Exportar contexto para tests
// ---------------------------------------------------------------------------
export { sst }
