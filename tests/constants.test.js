/**
 * constants.test.js — Verifica la forma y valores críticos de js/constants.js
 * No prueba lógica, sino que los datos de configuración estén bien formados.
 */

import { describe, it, expect } from 'vitest'
import { sst } from './helpers/ctx.js'

const {
  TIPOS, TIPO_KEYS, DEPTOS, DEPTOS_FIRESTORE, ESTADOS, EST_CL,
  OFICINAS_DEGUV, MODULOS_ESPECIALES, DEF, ADMIN_GMAIL,
  INST_ROLES, ROLES_INGRESO, CFG_PANELS, SST_EXPORT_VERSION,
  PERSONA_ROLES, FINALS,
} = sst

// ---------------------------------------------------------------------------
// TIPOS — es un objeto (mapa de configuración de tipo de campo), no un array
// ---------------------------------------------------------------------------
describe('TIPOS', () => {
  it('es un objeto con tipos de campo', () => {
    expect(typeof TIPOS).toBe('object')
    expect(TIPOS).not.toBeNull()
  })

  it('contiene tipos básicos: texto, numero, fecha', () => {
    expect(TIPOS).toHaveProperty('texto')
    expect(TIPOS).toHaveProperty('numero')
    expect(TIPOS).toHaveProperty('fecha')
  })

  it('cada tipo tiene label, r (render) y g (getter)', () => {
    Object.values(TIPOS).forEach(t => {
      expect(t).toHaveProperty('label')
      expect(typeof t.r).toBe('function')
      expect(typeof t.g).toBe('function')
    })
  })
})

describe('TIPO_KEYS', () => {
  it('es un array de strings (claves de TIPOS)', () => {
    expect(Array.isArray(TIPO_KEYS)).toBe(true)
    expect(TIPO_KEYS.length).toBeGreaterThan(0)
  })

  it('coincide con las claves del objeto TIPOS', () => {
    expect(TIPO_KEYS).toEqual(Object.keys(TIPOS))
  })
})

// ---------------------------------------------------------------------------
// DEPTOS
// ---------------------------------------------------------------------------
describe('DEPTOS', () => {
  it('contiene los 3 departamentos operativos esperados', () => {
    const ids = DEPTOS.map(d => d.id)
    expect(ids).toContain('guaviare')
    expect(ids).toContain('guainia')
    expect(ids).toContain('vaupes')
  })

  it('cada depto tiene id, nombre y munKey', () => {
    DEPTOS.forEach(d => {
      expect(d).toHaveProperty('id')
      expect(d).toHaveProperty('nombre')
      expect(d).toHaveProperty('munKey')
    })
  })
})

describe('DEPTOS_FIRESTORE', () => {
  it('es un array de strings (IDs Firestore)', () => {
    expect(Array.isArray(DEPTOS_FIRESTORE)).toBe(true)
    DEPTOS_FIRESTORE.forEach(id => expect(typeof id).toBe('string'))
  })

  it('contiene los 3 departamentos operativos', () => {
    expect(DEPTOS_FIRESTORE).toContain('guaviare')
    expect(DEPTOS_FIRESTORE).toContain('guainia')
    expect(DEPTOS_FIRESTORE).toContain('vaupes')
  })
})

// ---------------------------------------------------------------------------
// ESTADOS
// ---------------------------------------------------------------------------
describe('ESTADOS', () => {
  it('es un array no vacío', () => {
    expect(Array.isArray(ESTADOS)).toBe(true)
    expect(ESTADOS.length).toBeGreaterThan(0)
  })
})

describe('EST_CL', () => {
  it('es un objeto con colores por estado', () => {
    expect(typeof EST_CL).toBe('object')
    expect(EST_CL).not.toBeNull()
    // Al menos un estado debe tener color
    const values = Object.values(EST_CL)
    expect(values.length).toBeGreaterThan(0)
    values.forEach(v => expect(typeof v).toBe('string'))
  })
})

describe('FINALS', () => {
  it('es un array de estados finales', () => {
    expect(Array.isArray(FINALS)).toBe(true)
    expect(FINALS.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// OFICINAS_DEGUV
// ---------------------------------------------------------------------------
describe('OFICINAS_DEGUV', () => {
  it('contiene secretaria y guaviare', () => {
    const ids = OFICINAS_DEGUV.map(o => o.id)
    expect(ids).toContain('secretaria')
    expect(ids).toContain('guaviare')
  })

  it('cada oficina tiene id y nombre', () => {
    OFICINAS_DEGUV.forEach(o => {
      expect(o).toHaveProperty('id')
      expect(o).toHaveProperty('nombre')
    })
  })
})

// ---------------------------------------------------------------------------
// DEF (configuración default)
// ---------------------------------------------------------------------------
describe('DEF', () => {
  it('tiene las secciones clave', () => {
    expect(DEF).toHaveProperty('tramites')
    expect(DEF).toHaveProperty('instructores')
    expect(DEF).toHaveProperty('gravedades')
    expect(DEF).toHaveProperty('tiposActoAdmin')
  })

  it('tramites es un array con al menos el trámite sancionatorio', () => {
    expect(Array.isArray(DEF.tramites)).toBe(true)
    const sanc = DEF.tramites.find(t => t.id === 't_sanc')
    expect(sanc).toBeDefined()
    expect(sanc.nombre).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// INST_ROLES
// ---------------------------------------------------------------------------
describe('INST_ROLES', () => {
  it('es un objeto con labels por rol', () => {
    expect(typeof INST_ROLES).toBe('object')
    expect(INST_ROLES).toHaveProperty('contratista')
    expect(INST_ROLES).toHaveProperty('encargado_depto')
  })
})

// ---------------------------------------------------------------------------
// CFG_PANELS — cada panel tiene key, title, sub (no id/label)
// ---------------------------------------------------------------------------
describe('CFG_PANELS', () => {
  it('es un array de paneles de configuración', () => {
    expect(Array.isArray(CFG_PANELS)).toBe(true)
    expect(CFG_PANELS.length).toBeGreaterThan(0)
  })

  it('cada panel tiene key y title', () => {
    CFG_PANELS.forEach(p => {
      expect(p).toHaveProperty('key')
      expect(p).toHaveProperty('title')
      expect(typeof p.key).toBe('string')
    })
  })
})

// ---------------------------------------------------------------------------
// ADMIN_GMAIL
// ---------------------------------------------------------------------------
describe('ADMIN_GMAIL', () => {
  it('es un email válido', () => {
    expect(typeof ADMIN_GMAIL).toBe('string')
    expect(ADMIN_GMAIL).toContain('@')
  })
})

// ---------------------------------------------------------------------------
// SST_EXPORT_VERSION — es un string de versión (ej. '8.0')
// ---------------------------------------------------------------------------
describe('SST_EXPORT_VERSION', () => {
  it('es un string de versión no vacío', () => {
    expect(typeof SST_EXPORT_VERSION).toBe('string')
    expect(SST_EXPORT_VERSION.length).toBeGreaterThan(0)
  })

  it('tiene formato de versión válido', () => {
    expect(SST_EXPORT_VERSION).toMatch(/^\d+(\.\d+)?$/)
  })
})

// ---------------------------------------------------------------------------
// PERSONA_ROLES — es un objeto {rol: label}, no un array
// ---------------------------------------------------------------------------
describe('PERSONA_ROLES', () => {
  it('es un objeto con roles de persona', () => {
    expect(typeof PERSONA_ROLES).toBe('object')
    expect(PERSONA_ROLES).not.toBeNull()
    expect(Object.keys(PERSONA_ROLES).length).toBeGreaterThan(0)
  })

  it('contiene roles esperados', () => {
    expect(PERSONA_ROLES).toHaveProperty('interesado')
    expect(PERSONA_ROLES).toHaveProperty('peticionario')
  })

  it('los valores son strings de etiqueta', () => {
    Object.values(PERSONA_ROLES).forEach(label => {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    })
  })
})
