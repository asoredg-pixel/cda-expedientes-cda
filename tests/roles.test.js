/**
 * roles.test.js — Tests para js/roles.js
 * Cubre: funciones de check de rol, permisos y helpers de modo activo.
 * El estado mutable (rolSesion, deptoActivo) se manipula directamente en sst.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { sst } from './helpers/ctx.js'

const {
  esAdministrador, esJurisdiccional, esSecretaria, esModoCiudadano,
  esModoContratista, esModoResponsable, esModoOficinaDeguv,
  esModuloEspecialActivo, esModuloOficina,
  esSoloLectura, esAdminModoGlobal,
  getDeptoOperativo, labelDepartamento, labelDepto,
  normMedioRecepcionPqrs,
  migrateInstructoresList,
  normalizeEncargadosGlobal, getDefaultEncargadosGlobal,
  DEPTOS, OFICINAS_DEGUV,
} = sst

// ---------------------------------------------------------------------------
// Helpers para manipular estado del contexto
// Los vars declarados en state.js (con patch let->var) se adjuntan a sst,
// así que asignar sst.rolSesion === cambiar la var global del contexto vm.
// ---------------------------------------------------------------------------
function setRol(rol)   { sst.rolSesion   = rol }
function setDepto(dep) { sst.deptoActivo = dep }
function resetState() {
  sst.rolSesion         = ''
  sst.deptoActivo       = 'guaviare'   // default operativo no-especial
  sst.responsableActivo = ''
  sst.deptoCfg          = 'guaviare'
}

// ---------------------------------------------------------------------------
// esAdministrador
// ---------------------------------------------------------------------------
describe('esAdministrador()', () => {
  beforeEach(resetState)

  it('devuelve true cuando rolSesion es admin', () => {
    setRol('admin')
    expect(esAdministrador()).toBe(true)
  })

  it('devuelve false para cualquier otro rol', () => {
    for (const rol of ['guaviare', 'guainia', 'secretaria', 'contratista', '']) {
      setRol(rol)
      expect(esAdministrador()).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// esJurisdiccional / esSecretaria / esModoCiudadano
// ---------------------------------------------------------------------------
describe('esJurisdiccional()', () => {
  beforeEach(resetState)

  it('devuelve true cuando deptoActivo es jurisdiccional', () => {
    setDepto('jurisdiccional')
    expect(esJurisdiccional()).toBe(true)
  })

  it('devuelve false para cualquier otro depto', () => {
    setDepto('guaviare')
    expect(esJurisdiccional()).toBe(false)
  })
})

describe('esSecretaria()', () => {
  beforeEach(resetState)

  it('devuelve true cuando deptoActivo es secretaria', () => {
    setDepto('secretaria')
    expect(esSecretaria()).toBe(true)
  })
})

describe('esModoCiudadano()', () => {
  beforeEach(resetState)

  it('devuelve true cuando deptoActivo es ciudadano', () => {
    setDepto('ciudadano')
    expect(esModoCiudadano()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// esModoContratista
// ---------------------------------------------------------------------------
describe('esModoContratista()', () => {
  beforeEach(resetState)

  it('devuelve true cuando rolSesion es contratista', () => {
    setRol('contratista')
    expect(esModoContratista()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// esSoloLectura
// ---------------------------------------------------------------------------
describe('esSoloLectura()', () => {
  beforeEach(resetState)

  it('devuelve true para modo ciudadano', () => {
    setDepto('ciudadano')
    expect(esSoloLectura()).toBe(true)
  })

  it('devuelve true para modo jurisdiccional', () => {
    setDepto('jurisdiccional')
    expect(esSoloLectura()).toBe(true)
  })

  it('devuelve true para modo contratista', () => {
    setRol('contratista')
    expect(esSoloLectura()).toBe(true)
  })

  it('devuelve false para admin con depto operativo', () => {
    setRol('admin')
    setDepto('guaviare')
    expect(esSoloLectura()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// esModuloEspecialActivo
// ---------------------------------------------------------------------------
describe('esModuloEspecialActivo()', () => {
  beforeEach(resetState)

  it('devuelve true para secretaria', () => {
    setDepto('secretaria')
    expect(esModuloEspecialActivo()).toBe(true)
  })

  it('devuelve true para ciudadano', () => {
    setDepto('ciudadano')
    expect(esModuloEspecialActivo()).toBe(true)
  })

  it('devuelve true para jurisdiccional', () => {
    setDepto('jurisdiccional')
    expect(esModuloEspecialActivo()).toBe(true)
  })

  it('devuelve false para depto estándar sin módulo especial', () => {
    setDepto('guainia')
    setRol('guainia')
    expect(esModuloEspecialActivo()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getDeptoOperativo
// ---------------------------------------------------------------------------
describe('getDeptoOperativo()', () => {
  beforeEach(resetState)

  it('retorna guaviare para secretaria', () => {
    setDepto('secretaria')
    expect(getDeptoOperativo()).toBe('guaviare')
  })

  it('retorna guaviare para jurisdiccional (usa deptoCfg)', () => {
    setDepto('jurisdiccional')
    sst.deptoCfg = 'guaviare'
    expect(getDeptoOperativo()).toBe('guaviare')
  })

  it('retorna el depto activo para depto estándar', () => {
    setDepto('guaviare')
    setRol('guaviare')
    expect(getDeptoOperativo()).toBe('guaviare')
  })
})

// ---------------------------------------------------------------------------
// labelDepartamento / labelDepto
// ---------------------------------------------------------------------------
describe('labelDepartamento(id)', () => {
  it('devuelve munKey del departamento', () => {
    const result = labelDepartamento('guaviare')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // La función retorna d.munKey para departamentos conocidos
    expect(result).not.toBe('guaviare')  // munKey no es igual al id
  })

  it('devuelve el id para depto desconocido', () => {
    expect(labelDepartamento('desconocido')).toBe('desconocido')
  })
})

describe('labelDepto(id)', () => {
  it('admin → "Administrador"', () => {
    expect(labelDepto('admin')).toBe('Administrador')
  })

  it('secretaria → label esperado', () => {
    const label = labelDepto('secretaria')
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// normMedioRecepcionPqrs
// ---------------------------------------------------------------------------
describe('normMedioRecepcionPqrs(v)', () => {
  it('normaliza variantes de correo', () => {
    expect(normMedioRecepcionPqrs('Correo electrónico')).toBe('Correo')
    expect(normMedioRecepcionPqrs('Correo electronico')).toBe('Correo')
  })

  it('devuelve Ventanilla por defecto', () => {
    expect(normMedioRecepcionPqrs('Ventanilla')).toBe('Ventanilla')
  })

  it('pasa valores desconocidos sin modificar', () => {
    expect(normMedioRecepcionPqrs('Teléfono')).toBe('Teléfono')
  })
})

// ---------------------------------------------------------------------------
// migrateInstructoresList
// ---------------------------------------------------------------------------
describe('migrateInstructoresList(arr)', () => {
  it('migra strings a objetos instructor', () => {
    const result = migrateInstructoresList(['Juan Pérez', 'Ana López'])
    expect(result).toHaveLength(2)
    result.forEach(ins => {
      expect(ins).toHaveProperty('id')
      expect(ins).toHaveProperty('nombre')
      expect(ins).toHaveProperty('email')
      expect(ins).toHaveProperty('rol')
      expect(ins.activo).toBe(true)
    })
  })

  it('mantiene objetos ya migrados', () => {
    const ins = [{
      id: 'ins_1', nombre: 'Carlos', email: 'c@test.com',
      rol: 'contratista', activo: true, regSecciones: [], oficinas: []
    }]
    const result = migrateInstructoresList(ins)
    expect(result[0].nombre).toBe('Carlos')
    expect(result[0].email).toBe('c@test.com')
  })

  it('devuelve array vacío para input vacío o null', () => {
    expect(migrateInstructoresList([])).toEqual([])
    expect(migrateInstructoresList(null)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// normalizeEncargadosGlobal
// ---------------------------------------------------------------------------
describe('normalizeEncargadosGlobal(v)', () => {
  it('devuelve estructura por defecto para input inválido', () => {
    const def    = getDefaultEncargadosGlobal()
    const result = normalizeEncargadosGlobal(null)
    expect(result).toHaveProperty('departamentos')
    expect(result).toHaveProperty('oficinas')
    expect(result).toHaveProperty('secretaria')
    expect(Object.keys(result.departamentos)).toEqual(Object.keys(def.departamentos))
  })

  it('preserva datos válidos de entrada', () => {
    const input = {
      departamentos: { guaviare: { nombre: 'Pedro Rojas', email: 'pedro@test.co' } },
      oficinas: {},
      secretaria: { nombre: '', email: '' }
    }
    const result = normalizeEncargadosGlobal(input)
    expect(result.departamentos.guaviare.nombre).toBe('Pedro Rojas')
    expect(result.departamentos.guaviare.email).toBe('pedro@test.co')
  })

  it('normaliza email a minúsculas', () => {
    const input = {
      departamentos: { guaviare: { nombre: 'Admin', email: 'ADMIN@CDA.GOV.CO' } },
      oficinas: {}, secretaria: {}
    }
    const result = normalizeEncargadosGlobal(input)
    expect(result.departamentos.guaviare.email).toBe('admin@cda.gov.co')
  })
})
