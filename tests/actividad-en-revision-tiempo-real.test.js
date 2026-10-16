/**
 * actividad-en-revision-tiempo-real.test.js — Si el encargado/profesional revisa una actividad, el responsable/técnico
 * que la abre ve borde rojo y aviso, y no puede cargar nueva entrega ni eliminar. Al revés, si el responsable la tiene
 * abierta, el revisor no puede aprobar ni devolver. Presencia en revision_en_curso/{exp__tarea} con latido.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const css = readFileSync(resolve(root, 'css/sst.css'), 'utf8')
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')

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

function constLinea(nombre) {
  const m = core.match(new RegExp('^const ' + nombre + '=.*$', 'm'))
  if (!m) throw new Error('No se encontró const ' + nombre)
  return m[0]
}

function mkModal() {
  const cls = new Set()
  const kids = []
  const hdr = { className: 'task-modal-hdr', nextSibling: null }
  const modal = {
    classList: { toggle: (c, on) => { on ? cls.add(c) : cls.delete(c) }, contains: c => cls.has(c) },
    querySelector: s => (s === '.task-modal-hdr' ? hdr : null),
    insertBefore: el => { kids.push(el) },
    appendChild: el => { kids.push(el) },
    _cls: cls, _kids: kids
  }
  return modal
}

function ctx(opts) {
  const modal = mkModal()
  const writes = []
  const deletes = []
  let listener = null
  const doc = {
    getElementById: id => (id === 'rev-en-curso-banner' ? (modal._kids.find(k => k.id === id) || null) : null),
    querySelector: () => modal,
    createElement: () => ({ id: '', className: '', textContent: '', remove() { modal._kids.splice(modal._kids.indexOf(this), 1) } })
  }
  const avisos = []
  const c = createContext({
    console, document: doc, Promise, Date,
    setInterval: () => 1, clearInterval: () => {},
    notif: (m, t) => avisos.push([m, t]),
    agendaNorm: s => String(s || '').toLowerCase().trim(),
    esModoResponsable: () => !!opts.responsable,
    esJurisdiccional: () => false,
    responsableActivo: opts.responsable || '',
    taskPendienteVerificacion: t => !!t.pendVer,
    taskRevisionParCtx: () => opts.revPar || null,
    taskRevParParticipante: () => opts.revParPart || null,
    getCdaLockSessionId: () => 'sid-yo',
    getExpLockUserLabel: () => opts.label || 'Yo',
    notasInternasEmail: () => 'yo@cda.gov.co',
    fmtHoraLock: () => '10:30',
    window: {
      _db: {},
      _fsDoc: (db, col, id) => col + '/' + id,
      // En tests la presencia se simula con snap(); getDoc no debe adelantarse
      _fsGetDoc: () => new Promise(() => {}),
      _fsSetDoc: (ref, data) => { writes.push({ ref, data }); return Promise.resolve() },
      _fsDeleteDoc: ref => { deletes.push(ref); return Promise.resolve() },
      _fsOnSnapshot: (ref, cb) => { listener = cb; return () => { listener = null } }
    }
  })
  runInContext([constLinea('REV_EN_CURSO_TTL_MS'), constLinea('REV_EN_CURSO_LATIDO_MS'), constLinea('REV_EN_CURSO_SIDES')].join('\n'), c)
  runInContext(extraer(core, ['revEnCursoDocId', 'revEnCursoVigente', 'revEnCursoAplica', 'revEnCursoRol', 'revEnCursoAplicarUi',
    'revEnCursoSnapData', 'revEnCursoAplicarSnap', 'revEnCursoEmail', 'revEnCursoEscribir', 'revEnCursoDetener', 'revEnCursoIniciar', 'revEnCursoAlAbrir', 'revEnCursoBloqueaAccion']), c)
  const snap = d => listener && listener({ exists: () => !!d, data: () => d })
  return { c, modal, writes, deletes, snap, avisos }
}

const T = { id: 't1', responsable: 'Ana Ruiz', pendVer: true }
const otro = (extra) => Object.assign({ sid: 'sid-otro', por: 'Carlos (Encargado NCA)', desde: Date.now() - 60000, latido: Date.now() }, extra)

describe('Rol de quien abre la actividad', () => {
  it('encargado revisando → revisor; responsable asignado → ejecutor; otros o consulta → nada', () => {
    expect(ctx({}).c.revEnCursoRol(T, null, { canReviewSop: true })).toBe('revisor')
    expect(ctx({}).c.revEnCursoRol(T, null, { canReviewSop: false })).toBe('')
    expect(ctx({ responsable: 'Ana Ruiz' }).c.revEnCursoRol(T, null, {})).toBe('ejecutor')
    expect(ctx({ responsable: 'Otro' }).c.revEnCursoRol(T, null, {})).toBe('')
    expect(ctx({}).c.revEnCursoRol(T, null, { canReviewSop: true, consulta: true })).toBe('')
  })

  it('revisión técnico → profesional: el profesional revisa y el técnico es el ejecutor', () => {
    const rp = { fase: 'profesional', tecnico: 'Téc', profesional: 'Prof' }
    const t = { id: 't2', responsable: 'Prof', pendVer: false }
    expect(ctx({ responsable: 'Prof', revPar: rp, revParPart: Object.assign({ rol: 'profesional' }, rp) }).c.revEnCursoRol(t, null, {})).toBe('revisor')
    expect(ctx({ responsable: 'Téc', revPar: rp, revParPart: Object.assign({ rol: 'tecnico' }, rp) }).c.revEnCursoRol(t, null, {})).toBe('ejecutor')
  })

  it('actividad que no está en revisión: no se registra presencia', () => {
    expect(ctx({}).c.revEnCursoRol({ id: 't3', responsable: 'Ana Ruiz', pendVer: false }, null, { canReviewSop: true })).toBe('')
  })
})

describe('Presencia y bloqueo en tiempo real', () => {
  it('nadie la tiene: quien abre registra su presencia (con correo y latido)', () => {
    const k = ctx({ responsable: 'Ana Ruiz', label: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(null)
    expect(k.writes).toHaveLength(1)
    expect(k.writes[0].ref).toBe('revision_en_curso/PAF-1__t1')
    expect(k.writes[0].data).toMatchObject({ expId: 'PAF-1', taskId: 't1', rol: 'ejecutor', por: 'Ana Ruiz', email: 'yo@cda.gov.co', sid: 'sid-yo' })
    expect(k.c.window._revEnCurso.propio).toBe(true)
    expect(k.modal._cls.has('task-modal-en-revision')).toBe(false)
  })

  it('doc ya existe con mi sid (reapertura): marca propio y latea; si está vencido lo reescribe', () => {
    const k = ctx({ label: 'Carlos (Encargado NCA)' })
    k.c.revEnCursoIniciar('20261981', 'tk_1', 'revisor')
    const desde = Date.now() - 30000
    k.snap({ sid: 'sid-yo', por: 'Carlos', desde, latido: Date.now(), email: 'yo@cda.gov.co', rol: 'revisor' })
    expect(k.c.window._revEnCurso.propio).toBe(true)
    expect(k.c.window._revEnCurso.bloqueo).toBe(null)
    expect(k.c.window._revEnCurso.desde).toBe(desde)
    expect(k.writes).toHaveLength(0) // vigente propio: no reescribe en el snapshot (el timer latea)
    k.c.revEnCursoDetener()
    expect(k.deletes).toEqual(['revision_en_curso/20261981__tk_1'])

    const k2 = ctx({ label: 'Carlos (Encargado NCA)' })
    k2.c.revEnCursoIniciar('20261981', 'tk_1', 'revisor')
    k2.snap({ sid: 'sid-yo', por: 'Carlos', desde: Date.now() - 300000, latido: Date.now() - 200000, rol: 'revisor' })
    expect(k2.c.window._revEnCurso.propio).toBe(true)
    expect(k2.writes).toHaveLength(1)
    expect(k2.writes[0].data.sid).toBe('sid-yo')
  })

  it('abrir sin rol no tumba la presencia del revisor en la misma actividad', () => {
    const k = ctx({ label: 'Carlos' })
    k.c.revEnCursoIniciar('20261981', 'tk_1', 'revisor')
    k.snap(null)
    expect(k.c.window._revEnCurso.propio).toBe(true)
    k.c.revEnCursoIniciar('20261981', 'tk_1', '')
    expect(k.c.window._revEnCurso).toBeTruthy()
    expect(k.c.window._revEnCurso.rol).toBe('revisor')
    expect(k.c.window._revEnCurso.propio).toBe(true)
  })

  it('sin correo de sesión no escribe (reglas Firestore exigen email)', async () => {
    const k = ctx({ label: 'Carlos' })
    k.c.notasInternasEmail = () => ''
    k.c.revEnCursoIniciar('20261981', 'tk_1', 'revisor')
    k.snap(null)
    expect(k.writes).toHaveLength(0)
    expect(k.c.window._revEnCurso.propio).toBe(false)
  })

  it('responsable abre mientras el encargado revisa: borde rojo, aviso y sin nueva entrega ni eliminar', () => {
    const k = ctx({ responsable: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(otro())
    expect(k.writes).toHaveLength(0)
    expect(k.modal._cls.has('task-modal-en-revision')).toBe(true)
    expect(k.modal._cls.has('rev-bloq-ejecutor')).toBe(true)
    expect(k.modal._kids[0].textContent).toContain('En revisión por Carlos (Encargado NCA) desde las 10:30')
    expect(k.modal._kids[0].textContent).toContain('no puede cargar nueva entrega ni eliminar')
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'ejecutor')).toBe(true)
    expect(k.avisos[0][1]).toBe('warn')
  })

  it('encargado abre mientras el responsable la tiene abierta: no puede aprobar, devolver ni eliminar', () => {
    const k = ctx({})
    k.c.revEnCursoIniciar('PAF-1', 't1', 'revisor')
    k.snap(otro({ por: 'Ana Ruiz', rol: 'ejecutor' }))
    expect(k.modal._cls.has('rev-bloq-revisor')).toBe(true)
    expect(k.modal._kids[0].textContent).toContain('Ana Ruiz tiene abierta esta actividad')
    expect(k.modal._kids[0].textContent).toContain('ni eliminar la entrega')
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'revisor')).toBe(true)
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'ambos')).toBe(true)
    expect(k.avisos.some(a => /eliminar/i.test(a[0]))).toBe(true)
  })

  it('responsable abre mientras el encargado revisa: tampoco puede eliminar (ambos)', () => {
    const k = ctx({ responsable: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(otro())
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'ambos')).toBe(true)
    expect(k.avisos.some(a => /eliminar/i.test(a[0]))).toBe(true)
  })

  it('al terminar la otra parte, se quita el bloqueo y toma la actividad sin recargar', () => {
    const k = ctx({ responsable: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(otro())
    k.snap(null)
    expect(k.modal._cls.has('task-modal-en-revision')).toBe(false)
    expect(k.modal._kids).toHaveLength(0)
    expect(k.writes).toHaveLength(1)
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'ejecutor')).toBe(false)
  })

  it('presencia vencida (sin latido > 2 min, p. ej. PC apagado): no bloquea', () => {
    const k = ctx({ responsable: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(otro({ latido: Date.now() - 200000 }))
    expect(k.modal._cls.has('task-modal-en-revision')).toBe(false)
    expect(k.writes).toHaveLength(1)
  })

  it('al cerrar la ventana libera su presencia', () => {
    const k = ctx({})
    k.c.revEnCursoIniciar('PAF-1', 't1', 'revisor')
    k.snap(null)
    k.c.revEnCursoDetener()
    expect(k.deletes).toEqual(['revision_en_curso/PAF-1__t1'])
  })

  it('otra actividad o el mismo rol del lado contrario no se bloquea', () => {
    const k = ctx({ responsable: 'Ana Ruiz' })
    k.c.revEnCursoIniciar('PAF-1', 't1', 'ejecutor')
    k.snap(otro())
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't9', 'ejecutor')).toBe(false)
    expect(k.c.revEnCursoBloqueaAccion('PAF-1', 't1', 'revisor')).toBe(false)
  })
})

describe('Puntos de bloqueo, estilos y reglas', () => {
  it('rail y acciones finales comprueban el bloqueo', () => {
    expect(extraer(core, ['taskReviewToggleSidePanel'])).toContain('revEnCursoBloqueaAccion(expId,taskId,revSide)')
    expect(extraer(core, ['taskReviewOpenDecisionPanel'])).toContain("revEnCursoBloqueaAccion(expId,taskId,'revisor')")
    for (const fn of ['devolverTaskUnificado', 'submitDevolverAlTecnico', 'submitDevolverAlTecnicoDesdeChat']) {
      expect(extraer(core, [fn])).toContain("revEnCursoBloqueaAccion(expId,taskId,'revisor')")
    }
    expect(extraer(core, ['submitEnviarSoporteVerificacion'])).toContain("revEnCursoBloqueaAccion(expId,taskId,'ejecutor')")
    for (const fn of ['eliminarEntregaActividadConfirm', 'eliminarActOEntregaOpciones', 'submitElimEntregaNotifEliminar']) {
      expect(extraer(core, [fn])).toContain("revEnCursoBloqueaAccion(expId,taskId,'ambos')")
    }
    expect(constLinea('REV_EN_CURSO_SIDES')).toContain("eliminar:'ambos',elimEntregaNotif:'ambos'")
  })

  it('borde rojo: atenuar eliminar también al revisor', () => {
    expect(css).toContain('.task-modal.rev-bloq-revisor .task-review-rail-btn[data-side="eliminar"]')
  })

  it('se registra al abrir la actividad o la entrega y se libera al cerrar', () => {
    expect(extraer(core, ['openTaskCommentsModal'])).toContain('revEnCursoAlAbrir(expId,taskId,t,e,{canReviewSop:canReviewSop,consulta:isConsultaVista});')
    expect(extraer(core, ['openEnviarSoporteModal'])).toContain('revEnCursoAlAbrir(expId,taskId,t,e,{});')
    expect(extraer(core, ['closeTaskModal'])).toContain('revEnCursoDetener();')
  })

  it('borde rojo suave y botones atenuados', () => {
    expect(css).toMatch(/\.task-modal\.task-modal-en-revision\{box-shadow:[^}]*rgba\(220,38,38/)
    expect(css).toContain('.task-modal.rev-bloq-ejecutor .task-review-rail-btn[data-side="entrega"]')
    expect(css).toContain('.task-modal.rev-bloq-revisor .task-review-rail-btn[data-side="decision"]')
  })

  it('reglas: leer cualquier usuario activo; escribir con email del token; borrar propio o vencido', () => {
    expect(rules).toContain('match /revision_en_curso/{id}')
    expect(rules).toContain("request.resource.data.email.lower() == authEmail()")
    expect(rules).toContain('resource.data.latido < request.time.toMillis() - 120000')
    expect(extraer(core, ['revEnCursoEscribir'])).toContain('firebase deploy --only firestore:rules')
    expect(extraer(core, ['revEnCursoEscribir'])).toContain('{merge:true}')
  })
})
