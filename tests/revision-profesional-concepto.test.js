/**
 * revision-profesional-concepto.test.js — Casilla «Aplica revisión de profesional» en la entrega de concepto:
 * solo lista responsables con cargo «Profesional», desvía la entrega al Por ejecutar del profesional,
 * entra al ciclo devolver/corregir y la reentrega reemplaza el concepto pendiente (sin «N° ya usado»).
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

const norm = s => String(s || '').trim().toLowerCase()

function montarCore(task) {
  const avisos = []
  const c = {
    console, JSON, String, Number, Math, Date, Array, Object, Promise,
    avisos, task,
    responsableActivo: '',
    exp: { _exp: 'EXP-1', tasks: [task] },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    notif: (m, t) => avisos.push([m, t]),
    hoy: () => '2026-09-30',
    agendaNorm: norm,
    estadoTask: t => t.estado,
    esModoResponsable: () => true,
    esVistaActividadesDepto: () => false,
    esJurisdiccional: () => false,
    esTareaDelEncargado: () => false,
    taskUsuarioEsAsignado: (t, u) => norm(t.responsable) === norm(u),
    puedeReportarTask: () => true,
    taskEsAtenderPqrs: () => false,
    taskPuedeCorregirSinRevision: () => true,
    puedeGestionarActividadesDepto: () => false,
    getPqrsWorkflow: () => ({}),
    getSoportesUltimaEntrega: () => [],
    getSoporteActivo: () => null,
    getTaskAny: () => c.task,
    getExpById: () => c.exp,
    mutateTask: (ref, id, fn) => { fn(c.task); return true },
    normalizeTask: t => {
      ['comentarios', 'historial', 'soportes'].forEach(k => { if (!Array.isArray(t[k])) t[k] = [] })
      return t
    },
    taskComentarioAutor: () => c.responsableActivo,
    driveDeleteInstitutional: async () => true,
    driveRenombrarSoporteActivoExp: async () => true,
    deptoActivo: 'guaviare',
    getEncargadoDepto: () => 'Jefe',
    getNom: () => 'Titular',
    getTram: () => ({ nombre: 'Concesión' }),
    closeTaskModal: () => {},
    renderActividades: () => {},
    renderBandejaDepto: () => {},
  }
  c.exps = [c.exp]
  c.window = c
  createContext(c)
  runInContext(extraerFunciones(read('js/core.js'), [
    'getAsignado', 'ensureAsignado', 'migrateLegacyAsignados', 'taskEsMultiAsignada', 'syncTaskAggregateState', 'taskRecibidaPorTraslado',
    'soporteEsPorCorregir', 'resetTaskPorCorregir', 'taskRevisionParCtx', 'puedeDevolverAlTecnico',
    'devolverAlTecnicoRevisionPar', 'enviarTaskPorVerificar', 'esAutoentregaResponsable', 'puedeEliminarEntregaActividad',
    'taskRevParParticipante', 'taskRevParTecnicoEsperando', 'getTareasRevParTecnicoEsperando',
    'taskChatEncargadoDeptoNombre', 'taskChatRevParOpciones', 'taskChatPuedeEscribirResp',
    'submitDevolverAlTecnicoDesdeChat', 'cerrarTrasDevolverAlTecnico',
  ]), c)
  return c
}

const archivo = id => ({ driveFileId: id, driveLink: 'https://drive.google.com/file/d/' + id + '/view', nombre: id + '.pdf' })

/** Autoentrega de concepto del técnico, aún sin enviar. */
function tareaTecnico() {
  return {
    id: 't1', actividad: 'Concepto técnico', responsable: 'Tec', responsables: ['Tec'],
    asignados: [{ nombre: 'Tec', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' }],
    estado: 'En ejecución', autoAsignadaPorResponsable: true, comentarios: [], soportes: [], historial: [],
  }
}

describe('Casilla «Aplica revisión de profesional» (envío)', () => {
  it('desvía al Por ejecutar del profesional y entra al ciclo devolver/corregir', () => {
    const c = montarCore(tareaTecnico())
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: 'Prof' }
    expect(c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])).toBe(true)
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')
    expect(c.task.fechaReportada).toBe('')
    expect(c.task.historial.at(-1)).toMatchObject({ tipo: 'traslado', de: 'Tec', a: 'Prof', revisionPar: 'solicitud' })
    expect(c.avisos.at(-1)[0]).toMatch(/revisión de Prof/)
    expect(c.puedeDevolverAlTecnico(c.task, 'Prof', c.exp)).toBe(true)

    // El profesional no puede cancelar la autoentrega del técnico
    c.responsableActivo = 'Prof'
    expect(c.puedeEliminarEntregaActividad('EXP-1', 't1')).toBe(false)

    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Revisar cálculo')).toBe(true)
    expect(c.task.responsable).toBe('Tec')
    expect(c.task.estado).toBe('Por corregir')

    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: '' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('B')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')

    // Entrega final del profesional → Por revisar del encargado
    c.responsableActivo = 'Prof'
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('C')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('Por verificar')
    expect(c.puedeEliminarEntregaActividad('EXP-1', 't1')).toBe(false)
  })

  it('actividad creada por el encargado: también se desvía al profesional y sigue el ciclo', () => {
    const t = tareaTecnico()
    delete t.autoAsignadaPorResponsable
    t.origen = 'encargado'
    t.creadoPor = 'Jefe'
    const c = montarCore(t)
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: 'Prof' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])
    expect(c.task.responsable).toBe('Prof')
    expect(c.task.estado).toBe('En ejecución')
    c.responsableActivo = 'Prof'
    expect(c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Corregir')).toBe(true)
    expect(c.task.estado).toBe('Por corregir')
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: '' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('B')])
    expect(c.task.responsable).toBe('Prof')
    c.responsableActivo = 'Prof'
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('C')])
    expect(c.task.estado).toBe('Por verificar')
  })

  it('sin casilla marcada: flujo normal a Por revisar', () => {
    const c = montarCore(tareaTecnico())
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: '' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])
    expect(c.task.responsable).toBe('Tec')
    expect(c.task.estado).toBe('Por verificar')
    expect(c.puedeEliminarEntregaActividad('EXP-1', 't1')).toBe(true)
  })

  it('PQRSD o multi-responsable: la casilla no desvía', () => {
    const c = montarCore(tareaTecnico())
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: 'Prof' }
    c.taskEsAtenderPqrs = () => true
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])
    expect(c.task.responsable).toBe('Tec')

    const t = tareaTecnico()
    t.responsables = ['Tec', 'Otro']
    t.asignados.push({ nombre: 'Otro', fechaReportada: '', fechaAtendida: '', estado: 'pendiente' })
    const c2 = montarCore(t)
    c2.responsableActivo = 'Tec'
    c2._taskModalCtx = { revProfesional: 'Prof' }
    c2.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('A')])
    expect(c2.task.responsable).toBe('Tec')
  })
})

describe('Vistas de la revisión: Por revisar del técnico, chat y devolver', () => {
  function enviadaAProf() {
    const c = montarCore(tareaTecnico())
    c.responsableActivo = 'Tec'
    c._taskModalCtx = { revProfesional: 'Prof' }
    c.enviarTaskPorVerificar('EXP-1', 't1', [], 'Para su revisión', false, [archivo('A')])
    return c
  }

  it('el técnico la ve en su «Por revisar» mientras la revisa el profesional; al aprobarse sale', () => {
    const c = enviadaAProf()
    const filas = c.getTareasRevParTecnicoEsperando()
    expect(filas.length).toBe(1)
    expect(filas[0]).toMatchObject({ id: 't1', exp: 'EXP-1', _revParTecnico: true })
    c.responsableActivo = 'Prof'
    expect(c.getTareasRevParTecnicoEsperando()).toEqual([])
    c.responsableActivo = 'Tec'
    c.task.estado = 'Atendida'
    expect(c.getTareasRevParTecnicoEsperando()).toEqual([])
  })

  it('devuelta al técnico: sale de su «Por revisar» (queda en Por corregir)', () => {
    const c = enviadaAProf()
    c.responsableActivo = 'Prof'
    c.devolverAlTecnicoRevisionPar('EXP-1', 't1', 'Ajustar')
    c.responsableActivo = 'Tec'
    expect(c.getTareasRevParTecnicoEsperando()).toEqual([])
  })

  it('el comentario de la entrega del técnico queda «Para: profesional»', () => {
    const c = enviadaAProf()
    expect(c.task.comentarios.at(-1)).toMatchObject({ texto: 'Para su revisión', para: 'Prof' })
  })

  it('chat: selector con el otro participante y el encargado; técnico escribe aunque no esté asignado', () => {
    const c = enviadaAProf()
    expect(c.taskChatRevParOpciones(c.task)).toEqual({ opts: ['Prof', 'Jefe'], def: 'Prof' })
    expect(c.taskChatPuedeEscribirResp(c.task)).toBe(true)
    c.responsableActivo = 'Prof'
    expect(c.taskChatRevParOpciones(c.task)).toEqual({ opts: ['Tec', 'Jefe'], def: 'Tec' })
    c.enviarTaskPorVerificar('EXP-1', 't1', [], '', false, [archivo('B')])
    expect(c.task.estado).toBe('Por verificar')
    expect(c.taskChatRevParOpciones(c.task).def).toBe('Jefe')
    c.responsableActivo = 'Otro'
    expect(c.taskChatRevParOpciones(c.task)).toBe(null)
    expect(c.taskChatPuedeEscribirResp(c.task)).toBe(false)
  })

  it('devolver desde el chat usa el texto escrito como observación (obligatorio)', () => {
    const c = enviadaAProf()
    c.responsableActivo = 'Prof'
    const inp = { value: '  ', focus: () => {} }
    c.document = { getElementById: id => (id === 'task-cmt-input' ? inp : null), querySelectorAll: () => [] }
    c.submitDevolverAlTecnicoDesdeChat('EXP-1', 't1')
    expect(c.task.responsable).toBe('Prof')
    expect(c.avisos.at(-1)[0]).toMatch(/Escriba en el chat/)
    inp.value = 'Revisar coordenadas'
    c.submitDevolverAlTecnicoDesdeChat('EXP-1', 't1')
    expect(c.task.responsable).toBe('Tec')
    expect(c.task.estado).toBe('Por corregir')
    expect(c.task.comentarios.at(-1)).toMatchObject({ para: 'Tec', texto: '↩ Devuelta para corregir: Revisar coordenadas' })
    expect(inp.value).toBe('')
  })
})

function montarEntrega() {
  const avisos = [], oficios = []
  const c = {
    console, JSON, String, Number, Math, Date, Array, Object,
    avisos, oficios,
    responsableActivo: 'Tec',
    notif: (m, t) => avisos.push([m, t]),
    agendaNorm: norm,
    escAttr: s => String(s || '').replace(/"/g, '&quot;'),
    hoy: () => '2026-09-30',
    deptoActivo: 'guaviare',
    getDeptoOperativo: () => 'guaviare',
    getTiposConceptoCfg: () => ['Concepto técnico', 'Informe técnico'],
    resolveActividadConceptoTipo: () => '',
    esModoResponsable: () => true,
    taskEsMultiAsignada: () => false,
    taskRevisionParCtx: () => null,
    conceptosSegData: s => { try { return JSON.parse(s || '[]') } catch (e) { return [] } },
    ensureOficioRequerimientoTask: (e, item) => oficios.push(item.conceptoReqId),
    getEncargadoDepto: () => 'Jefe',
    instructorEsAsignableActividad: i => i.rol !== 'contratista',
    getInstructoresActivos: () => [
      { nombre: 'Tec', email: 'tec@x.co' },
      { nombre: 'Prof', email: 'prof@x.co' },
      { nombre: 'Prof Inactivo', email: 'pi@x.co' },
      { nombre: 'Otro', email: 'otro@x.co' },
      { nombre: 'Jefe', email: 'jefe@x.co' },
      { nombre: 'Sin correo' },
    ],
    _usuariosCache: [
      { email: 'tec@x.co', nombre: 'Tec', cargo: 'profesional' },
      { email: 'prof@x.co', nombre: 'Prof', cargo: 'profesional' },
      { email: 'pi@x.co', nombre: 'Prof Inactivo', cargo: 'profesional', activo: false },
      { email: 'otro@x.co', nombre: 'Otro', cargo: 'vital' },
      { email: 'jefe@x.co', nombre: 'Jefe', cargo: 'profesional' },
      { email: 'sc@x.co', nombre: 'Sin correo', cargo: 'profesional' },
    ],
  }
  c.getUsuarioAutorizadoByEmail = em => c._usuariosCache.find(u => u.email === em) || null
  c.validarNumeroConceptoDisponible = num => {
    const usado = JSON.parse(c.expActual._conceptos_seg || '[]').some(x => x.concepto === num)
    if (usado) avisos.push(['N° ya usado', 'err'])
    return !usado
  }
  c.window = c
  createContext(c)
  runInContext(extraerFunciones(read('js/entrega-responsable.js'), [
    'getProfesionalesRevisionDepto', 'htmlEntregaRevProfesionalBlock', 'htmlEntregaRevProfesionalSel',
    'conceptoPendienteDeTarea', 'htmlEntregaRegConceptoBlock', 'validateAndAppendEntregaRegistro', 'appendRegistroDesdeEntrega',
  ]), c)
  return c
}

const concepto = extra => ({ tipo: 'concepto', item: Object.assign({
  tipoConcepto: 'Informe técnico', fecha: '2026-09-29', concepto: 'CT-100', observaciones: 'Obs técnico',
  cumple: 'no', aplicaReq: true, conceptoReqId: 'cr_tec', coordenadas: '', pendienteAprobacion: true,
}, extra || {}) })

describe('Selector de profesionales', () => {
  it('solo responsables con cargo Profesional, activos, sin uno mismo ni el encargado', () => {
    const c = montarEntrega()
    expect(c.getProfesionalesRevisionDepto('guaviare')).toEqual(['Prof', 'Sin correo'])
  })

  it('el bloque muestra la casilla solo en modo responsable y el aviso si no hay profesionales', () => {
    const c = montarEntrega()
    const e = { _exp: 'EXP-1', _conceptos_seg: '[]' }
    expect(c.htmlEntregaRegConceptoBlock(e, {})).toContain('entrega-rev-prof-chk')
    c._usuariosCache.forEach(u => { u.cargo = '' })
    expect(c.htmlEntregaRegConceptoBlock(e, {})).toContain('No hay profesionales configurados')
    c.esModoResponsable = () => false
    expect(c.htmlEntregaRegConceptoBlock(e, {})).not.toContain('entrega-rev-prof-chk')
  })

  it('actividad de concepto creada por el encargado: el técnico ve la casilla al entregar', () => {
    const c = montarEntrega()
    const t = { id: 't9', actividad: 'Concepto técnico', origen: 'encargado', responsable: 'Tec' }
    expect(c.htmlEntregaRegConceptoBlock({ _exp: 'EXP-1', _conceptos_seg: '[]' }, { actividad: 'Concepto técnico', t })).toContain('entrega-rev-prof-chk')
  })

  it('un responsable con cargo Profesional no ve la casilla (entrega directo al encargado)', () => {
    const c = montarEntrega()
    c.esCargoProfesional = () => true
    expect(c.htmlEntregaRegConceptoBlock({ _exp: 'EXP-1', _conceptos_seg: '[]' }, {})).not.toContain('entrega-rev-prof-chk')
  })
})

describe('Reentrega del concepto (profesional)', () => {
  it('prellena con el concepto pendiente del técnico y oculta la casilla en revisión', () => {
    const c = montarEntrega()
    const t = { id: 't1' }
    const e = { _exp: 'EXP-1', _conceptos_seg: JSON.stringify([Object.assign(concepto().item, { taskId: 't1' })]) }
    c.taskRevisionParCtx = () => ({ tecnico: 'Tec', profesional: 'Prof', fase: 'profesional' })
    const h = c.htmlEntregaRegConceptoBlock(e, { actividad: 'Concepto técnico', t })
    expect(h).toContain('value="CT-100"')
    expect(h).toContain('data-prefill="CT-100"')
    expect(h).toContain('value="2026-09-29"')
    expect(h).toMatch(/value="Informe técnico" selected/)
    expect(h).toMatch(/value="no" selected>No cumple/)
    expect(h).toContain('Obs técnico')
    expect(h).not.toContain('entrega-rev-prof-chk')
  })

  it('reemplaza el concepto pendiente de la misma actividad sin bloquear por N° ya usado y reutiliza conceptoReqId', () => {
    const c = montarEntrega()
    const t = { id: 't1' }
    const e = { _exp: 'EXP-1', _conceptos_seg: JSON.stringify([
      { concepto: 'CT-001', pendienteAprobacion: false, taskId: 't0' },
      Object.assign(concepto().item, { taskId: 't1' }),
    ]) }
    c.expActual = e
    expect(c.validateAndAppendEntregaRegistro(e, concepto({ observaciones: 'Ajustado', conceptoReqId: 'cr_nuevo' }), t)).toBe(true)
    expect(c.avisos).toEqual([])
    const arr = JSON.parse(e._conceptos_seg)
    expect(arr.length).toBe(2)
    expect(arr[1]).toMatchObject({ concepto: 'CT-100', observaciones: 'Ajustado', conceptoReqId: 'cr_tec', taskId: 't1' })
    expect(c.oficios).toEqual(['cr_tec'])
  })

  it('N° usado por otro registro sigue bloqueando y no pierde el pendiente', () => {
    const c = montarEntrega()
    const t = { id: 't1' }
    const antes = JSON.stringify([
      { concepto: 'CT-001', pendienteAprobacion: false, taskId: 't0' },
      Object.assign(concepto().item, { taskId: 't1' }),
    ])
    const e = { _exp: 'EXP-1', _conceptos_seg: antes }
    c.expActual = e
    expect(c.validateAndAppendEntregaRegistro(e, concepto({ concepto: 'CT-001' }), t)).toBe(false)
    expect(e._conceptos_seg).toBe(antes)
  })
})
