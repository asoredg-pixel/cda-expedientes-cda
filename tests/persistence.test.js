/**
 * persistence.test.js — Tests para js/persistence.js
 * Cubre: LS helpers (parse/store JSON, KB conversion, capacity monitor).
 * No testea Firestore (requiere emulador); se cubren los helpers locales.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { sst } from './helpers/ctx.js'

const {
  lsParseStoredJson, lsLoadJson, lsStoreJson,
  lsStorageKb, lsCapacityMonitorMsg,
  getLocalStorageUsageBytes,
} = sst

const ls = sst.localStorage

// ---------------------------------------------------------------------------
// lsStorageKb
// ---------------------------------------------------------------------------
describe('lsStorageKb(bytes)', () => {
  it('convierte bytes a kilobytes redondeados', () => {
    expect(lsStorageKb(1024)).toBe(1)
    expect(lsStorageKb(2048)).toBe(2)
    expect(lsStorageKb(512)).toBe(1)   // redondea hacia arriba
    expect(lsStorageKb(0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// lsParseStoredJson
// ---------------------------------------------------------------------------
describe('lsParseStoredJson(raw)', () => {
  it('parsea JSON plano correctamente', () => {
    const data = { foo: 'bar', num: 42 }
    const raw  = JSON.stringify(data)
    expect(lsParseStoredJson(raw)).toEqual(data)
  })

  it('devuelve null para raw null o vacío', () => {
    expect(lsParseStoredJson(null)).toBeNull()
    expect(lsParseStoredJson('')).toBeNull()
  })

  it('lanza error para JSON malformado', () => {
    expect(() => lsParseStoredJson('not valid json{{')).toThrow()
  })

  it('parsea arrays correctamente', () => {
    const arr = [1, 2, 3]
    expect(lsParseStoredJson(JSON.stringify(arr))).toEqual(arr)
  })
})

// ---------------------------------------------------------------------------
// lsLoadJson / lsStoreJson
// ---------------------------------------------------------------------------
describe('lsStoreJson + lsLoadJson', () => {
  beforeEach(() => ls.clear())

  it('guarda y recupera un objeto', () => {
    const key  = 'test_key'
    const data = { hello: 'world', n: 99 }
    lsStoreJson(key, data)
    expect(lsLoadJson(key)).toEqual(data)
  })

  it('devuelve null para clave inexistente', () => {
    expect(lsLoadJson('nonexistent_key_xyz')).toBeNull()
  })

  it('guarda y recupera un array', () => {
    const key = 'test_arr'
    const arr = [{ id: 1 }, { id: 2 }]
    lsStoreJson(key, arr)
    expect(lsLoadJson(key)).toEqual(arr)
  })

  it('sobrescribe datos previos en la misma clave', () => {
    const key = 'overwrite_key'
    lsStoreJson(key, { v: 1 })
    lsStoreJson(key, { v: 2 })
    expect(lsLoadJson(key)).toEqual({ v: 2 })
  })
})

// ---------------------------------------------------------------------------
// getLocalStorageUsageBytes
// ---------------------------------------------------------------------------
describe('getLocalStorageUsageBytes()', () => {
  beforeEach(() => ls.clear())

  it('devuelve 0 para localStorage vacío', () => {
    expect(getLocalStorageUsageBytes()).toBe(0)
  })

  it('incrementa al agregar datos', () => {
    ls.setItem('k1', 'hello world')
    const bytes = getLocalStorageUsageBytes()
    expect(bytes).toBeGreaterThan(0)
  })

  it('devuelve número positivo con datos guardados', () => {
    lsStoreJson('exp_data', [{ _exp: 'E-001', _tramite: 'sanc' }])
    const bytes = getLocalStorageUsageBytes()
    expect(typeof bytes).toBe('number')
    expect(bytes).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// lsCapacityMonitorMsg
// ---------------------------------------------------------------------------
describe('lsCapacityMonitorMsg()', () => {
  it('devuelve un string con información de uso', () => {
    const msg = lsCapacityMonitorMsg()
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
    // Debe mencionar KB o MB
    expect(msg).toMatch(/KB|MB/)
  })
})
