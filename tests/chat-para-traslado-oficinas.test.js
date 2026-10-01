/**
 * chat-para-traslado-oficinas.test.js — Chat de la actividad (PQRSD) y traslados entre oficinas:
 * - el «Para» ofrece al encargado de las oficinas destino y lo preselecciona al elegir oficina en Trasladar;
 * - al trasladar, los mensajes del chat pasan a la nueva actividad;
 * - al cambiar el encargado de una oficina, el anterior deja de figurar como encargado.
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

const OFICINAS = [
  { id: 'guaviare', nombre: 'NCA DEGUV', codigo: 'NCA' },
  { id: 'oap_deguv', nombre: 'OAP DEGUV', codigo: 'OAP' },
  { id: 'rn_deguv', nombre: 'RN DEGUV', codigo: 'RN' },
  { id: 'admin_deguv', nombre: 'ADMIN DEGUV', codigo: 'ADMIN' },
  { id: 'ds_deguv', nombre: 'DS DEGUV', codigo: 'DS' },
  { id: 'secretaria', nombre: 'Secretaría DEGUV', codigo: 'SEC' }
]
const ENC = { guaviare: 'Ana NCA', oap_deguv: 'Oscar OAP', rn_deguv: 'Rita RN', admin_deguv: 'Adan Admin', ds_deguv: 'Diana DS', secretaria: 'Sara Sec' }

function montarChat({ oficina = 'admin_deguv', puedeTrasladar = true, destinoSel = '' } = {}) {
  const exp = { _exp: 'PQ-1', _pqrs_oficina: oficina }
  const c = {
    OFICINAS_DEGUV: OFICINAS,
    deptoActivo: oficina,
    responsableActivo: ENC[oficina],
    document: {
      getElementById: id => (id === 'pqrs-trasl-ofi-sel' && destinoSel ? { value: destinoSel } : null),
      querySelectorAll: () => []
    },
    normalizeTask: t => ({ responsables: [], comentarios: [], ...t }),
    agendaNorm: s => String(s || '').trim().toLowerCase(),
    escAttr: s => String(s),
    getExpById: id => (id === 'PQ-1' ? exp : null),
    taskEsAtenderPqrs: () => true,
    puedeTrasladarPqrs: () => puedeTrasladar,
    puedeTrasladarPqrsInicial: () => false,
    puedeGestionarActividadesDepto: () => true,
    getEncargadoOficina: id => ENC[id] || '',
    getEncargadoDepto: id => ENC[id] || '',
    getPqrsOficinaActiva: () => oficina,
    getAsignablesPqrsOficina: () => [ENC[oficina]],
    getUltimoReportadoPor: () => '',
    getTaskResponsables: t => t.responsables || [],
    esModoResponsable: () => false,
    taskRevParParticipante: () => null,
    estadoTask: () => 'Pendiente'
  }
  createContext(c)
  runInContext(extraerFunciones(read('js/core.js'), [
    'taskChatEncargadoEligeDestino', 'taskChatEncargadoDeptoNombre', 'taskChatResponsableEscribeEncargado',
    'taskChatRevParOpciones', 'taskChatPqrsAsigChecked', 'taskChatTrasladoDestinosEnc',
    'taskChatTrasladoDestinoSelEnc', 'taskChatParaLabel', 'taskChatDestinatariosLista',
    'taskChatParaOpcionesEncargado', 'taskChatResolveDefaultPara', 'taskChatComposerParaFieldHtml'
  ]), c)
  return c
}

const tarea = oficina => ({ id: 't1', exp: 'PQ-1', actividad: 'Oficio de respuesta', responsable: ENC[oficina], responsables: [ENC[oficina]] })

describe('Chat de la actividad: «Para» con oficinas destino del traslado', () => {
  it('oficina sin apoyo: ya no queda solo ella misma; aparecen los encargados destino', () => {
    const c = montarChat({ oficina: 'admin_deguv' })
    const opts = c.taskChatParaOpcionesEncargado(tarea('admin_deguv'))
    expect(opts).not.toContain('Adan Admin')
    expect(opts).toEqual(expect.arrayContaining(['Ana NCA', 'Rita RN', 'Diana DS', 'Sara Sec', 'Oscar OAP']))
  })

  it('al elegir oficina destino en Trasladar, «Para» queda en su encargado', () => {
    const c = montarChat({ oficina: 'guaviare', destinoSel: 'rn_deguv' })
    expect(c.taskChatResolveDefaultPara(tarea('guaviare'))).toBe('Rita RN')
    const html = c.taskChatComposerParaFieldHtml(tarea('guaviare'))
    expect(html).toContain('<option value="Rita RN" selected>Rita RN · RN</option>')
  })

  it('sin permiso de traslado no se agregan otras oficinas', () => {
    const c = montarChat({ oficina: 'rn_deguv', puedeTrasladar: false })
    expect(c.taskChatParaOpcionesEncargado(tarea('rn_deguv'))).toEqual(['Rita RN'])
  })

  it('los selectores de oficina destino del panel refrescan el «Para»', () => {
    const src = read('js/core.js')
    expect(src).toMatch(/id="pqrs-trasl-ini-ofi-sel" onchange="if\(typeof taskChatSyncParaFromAsignacion/)
    expect(src).toMatch(/id="pqrs-trasl-ofi-sel" onchange="if\(typeof taskChatSyncParaFromAsignacion/)
  })
})

describe('Traslado: los mensajes del chat pasan a la nueva actividad', () => {
  function montarTraslado() {
    let n = 0
    const c = {
      normalizeTask: t => ({ comentarios: [], ...t }),
      estadoTask: t => t.estado || 'Pendiente',
      labelOficina: id => id,
      hoy: () => '2026-10-01',
      pqrsComentarioAutor: () => 'Ana NCA',
      pushPqrsAvisoOficina: () => {},
      ensureTareaPqrsNca: () => {},
      ensureTareaPqrsOficina: e => { e.tasks.push({ id: 'nueva' + (++n), actividad: 'Oficio de respuesta', comentarios: [] }) }
    }
    createContext(c)
    runInContext(extraerFunciones(read('js/core.js'), [
      'cancelarTareasPqrsNca', 'pqrsChatComentariosParaTraslado', 'pqrsChatCopiarATareaActiva', 'syncPqrsTareaTrasTraslado'
    ]), c)
    return c
  }

  it('copia el chat (no los comentarios de entrega) a la tarea de la oficina destino', () => {
    const c = montarTraslado()
    const e = {
      _exp: 'PQ-1',
      tasks: [{ id: 'vieja', actividad: 'Oficio de respuesta', comentarios: [
        { autor: 'Ana NCA', fecha: '2026-10-01T10:00', texto: 'Revisar predio', para: 'Rita RN' },
        { autor: 'X', fecha: '2026-09-30', texto: 'entrega', incluidoEnReporte: true }
      ] }]
    }
    c.syncPqrsTareaTrasTraslado(e, 'rn_deguv', '')
    expect(e.tasks[0].eliminada).toBe(true)
    const nueva = e.tasks.find(t => !t.eliminada)
    expect(nueva.comentarios).toHaveLength(1)
    expect(nueva.comentarios[0]).toMatchObject({ texto: 'Revisar predio', para: 'Rita RN' })
  })
})

describe('Cambio de encargado de oficina', () => {
  function montarRoles(instructores) {
    const c = {
      cfgByDepto: { guaviare: { instructores } },
      agendaNorm: s => String(s || '').trim().toLowerCase()
    }
    createContext(c)
    runInContext(extraerFunciones(read('js/roles.js'), ['migrateInstructoresList', 'upsertInstructorEncargado']), c)
    return c
  }

  it('el encargado anterior de RN deja de tener la oficina; el nuevo queda como encargado', () => {
    const c = montarRoles([
      { id: 'a', nombre: 'Viejo RN', email: 'viejo@x', rol: 'encargado_oficina', activo: true, oficinas: ['rn_deguv'] },
      { id: 'b', nombre: 'Multi', email: 'multi@x', rol: 'encargado_oficina', activo: true, oficinas: ['rn_deguv', 'oap_deguv'] },
      { id: 'c', nombre: 'Encargada DS', email: 'ds@x', rol: 'encargado_oficina', activo: true, oficinas: ['ds_deguv'] }
    ])
    c.upsertInstructorEncargado('guaviare', 'Nuevo RN', 'nuevo@x', 'encargado_oficina', ['rn_deguv'])
    const ins = c.cfgByDepto.guaviare.instructores
    const conRn = ins.filter(i => i.rol === 'encargado_oficina' && i.oficinas.includes('rn_deguv'))
    expect(conRn.map(i => i.nombre)).toEqual(['Nuevo RN'])
    expect(ins.find(i => i.nombre === 'Viejo RN')).toBeUndefined()
    expect(ins.find(i => i.nombre === 'Multi').oficinas).toEqual(['oap_deguv'])
    expect(ins.find(i => i.nombre === 'Encargada DS').oficinas).toEqual(['ds_deguv'])
  })
})
