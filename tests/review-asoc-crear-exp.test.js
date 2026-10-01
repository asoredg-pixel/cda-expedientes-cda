/**
 * review-asoc-crear-exp.test.js — Rail «Asociar» de Ver PQRSD (NCA): «➕ Crear expediente» con solo
 * Control del trámite, asociación automática a la PQRSD y sin salir de la ventana.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(resolve(root, p), 'utf8')

function extraerFunciones(src, nombres) {
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

function montar(campos, opts) {
  opts = opts || {}
  const avisos = [], persistidos = [], asociados = [], auditoria = []
  const els = {}
  Object.keys(campos || {}).forEach(k => { els[k] = { value: campos[k] } })
  const body = { innerHTML: '' }
  els['task-review-asoc-body'] = body
  const c = {
    String, JSON, Array, Object, avisos, persistidos, asociados, auditoria, body,
    exps: [{ _exp: 'PQ-1' }],
    ESTADOS: ['Solicitud', 'En trámite', 'Atendido'],
    deptoActivo: 'guaviare',
    responsableActivo: 'Encargado NCA',
    window: { _reviewAsocPanelId: 'task-review-asoc-body', _reviewAsocCtx: { mode: 'pqrs-pick', allowTramite: true, sourceExp: 'PQ-1', q: 'EXP-9' } },
    document: { getElementById: id => els[id] || null },
    setTimeout: () => {},
    notif: (m, t) => avisos.push([m, t]),
    hoy: () => '2026-10-01',
    escAttr: s => String(s == null ? '' : s),
    jsStr: s => String(s == null ? '' : s),
    puedeCrearExpedienteRegistro: () => opts.puede !== false,
    getDeptoOperativo: () => 'guaviare',
    cfgFor: () => ({ tramites: [
      { id: 't_lic', nombre: 'Licencia', subclases: opts.subclases || [] },
      { id: 't_pqrs', nombre: 'PQRSD' }
    ] }),
    esTramitePqrs: id => id === 't_pqrs',
    esTramiteSancionatorio: () => false,
    getTramSubclases: t => t.subclases || [],
    getTramSubclaseLabel: () => 'Clase',
    getExpById: id => c.exps.find(e => e._exp === id) || null,
    expNumeroDuplicado: id => c.exps.find(e => String(e._exp).toLowerCase() === String(id).toLowerCase()) || null,
    taskComentarioAutor: () => 'Encargado NCA',
    syncFechasEstadoConEstado: () => {},
    rebuildHistorial: d => [{ fase: 'tramite', etapa: 'Solicitud', fecha: d._fecha, desc: 'Apertura del proceso / trámite' }],
    persistExpedienteGranular: e => persistidos.push(e._exp),
    logAudit: m => auditoria.push(m),
    asociarVinculoAPqrs: (src, tgt, modo) => { asociados.push([src, tgt, modo]); return opts.asocOk !== false },
    renderActividades: () => {},
    renderConsulta: () => {},
    collectReviewAsocCandidatos: () => [],
    reviewAsocPickCardHtml: () => ''
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/consulta.js'), [
    'reviewAsocPuedeCrearExp', 'reviewAsocTramitesCrear', 'reviewAsocCrearExpSubHtml', 'reviewAsocCrearExpFormHtml',
    'reviewAsocCrearExpAbrir', 'reviewAsocCrearExpGuardar', 'reviewAsocRefrescarEnRevision', 'renderReviewAsocPickPanel'
  ]), c)
  return c
}

describe('Crear expediente desde el rail Asociar de Ver PQRSD', () => {
  it('muestra el botón solo en PQRSD de NCA y con permiso de crear', () => {
    const c = montar({})
    c.renderReviewAsocPickPanel('task-review-asoc-body')
    expect(c.body.innerHTML).toContain('➕ Crear expediente')
    const sinPermiso = montar({}, { puede: false })
    sinPermiso.renderReviewAsocPickPanel('task-review-asoc-body')
    expect(sinPermiso.body.innerHTML).not.toContain('➕ Crear expediente')
    const otraOficina = montar({})
    otraOficina.window._reviewAsocCtx.allowTramite = false
    otraOficina.renderReviewAsocPickPanel('task-review-asoc-body')
    expect(otraOficina.body.innerHTML).not.toContain('➕ Crear expediente')
  })

  it('el formulario trae solo Control del trámite, sin PQRSD en los tipos y con el N° buscado', () => {
    const c = montar({})
    c.reviewAsocCrearExpAbrir()
    const h = c.body.innerHTML
    expect(h).toContain('Control del trámite')
    expect(h).toContain('value="t_lic"')
    expect(h).not.toContain('value="t_pqrs"')
    expect(h).toContain('value="EXP-9"')
    expect(h).not.toContain('fld__pn_nombre')
  })

  it('crea el expediente, lo asocia a la PQRSD y sigue en el panel del rail', () => {
    const c = montar({ 'review-asoc-new-tram': 't_lic', 'review-asoc-new-exp': 'EXP-9', 'review-asoc-new-estado': 'Solicitud', 'review-asoc-new-fecha': '2026-09-15' })
    c.window._reviewAsocCtx.crearExp = true
    c.reviewAsocCrearExpGuardar()
    const nuevo = c.exps.find(e => e._exp === 'EXP-9')
    expect(nuevo).toBeTruthy()
    expect(nuevo._tramite).toBe('t_lic')
    expect(nuevo._fecha).toBe('2026-09-15')
    expect(nuevo._alta_desde_pqrs).toBe('PQ-1')
    expect(nuevo.historial[0].desc).toContain('creado desde PQRSD PQ-1')
    expect(c.asociados).toEqual([['PQ-1', 'EXP-9', 'tramite']])
    expect(c.persistidos).toEqual([])
    expect(c.window._reviewAsocCtx.crearExp).toBe(false)
    expect(c.body.innerHTML).toContain('review-asoc-q')
  })

  it('si la asociación falla, igual guarda el expediente y avisa', () => {
    const c = montar({ 'review-asoc-new-tram': 't_lic', 'review-asoc-new-exp': 'EXP-9', 'review-asoc-new-fecha': '2026-09-15' }, { asocOk: false })
    c.reviewAsocCrearExpGuardar()
    expect(c.persistidos).toEqual(['EXP-9'])
    expect(c.avisos.some(a => a[1] === 'warn')).toBe(true)
  })

  it('no duplica números y exige la clase si el trámite la tiene', () => {
    const dup = montar({ 'review-asoc-new-tram': 't_lic', 'review-asoc-new-exp': 'pq-1', 'review-asoc-new-fecha': '2026-09-15' })
    dup.reviewAsocCrearExpGuardar()
    expect(dup.exps).toHaveLength(1)
    expect(dup.avisos[0][0]).toContain('Ya existe')
    const sub = montar({ 'review-asoc-new-tram': 't_lic', 'review-asoc-new-exp': 'EXP-9', 'review-asoc-new-fecha': '2026-09-15' }, { subclases: ['A', 'B'] })
    sub.reviewAsocCrearExpGuardar()
    expect(sub.exps).toHaveLength(1)
    expect(sub.avisos[0][0]).toContain('Clase')
  })
})
