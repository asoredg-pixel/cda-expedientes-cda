/**
 * busqueda-actividades-consulta.test.js — Buscadores de Actividades y Consulta
 * con la misma lista rápida del selector de responsables, y en Consulta el
 * número de expediente / trámite / PQRSD / actividad queda de primero.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

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

function montarRank() {
  const c = createContext({
    getNom: e => (e && e._nom) || '',
    getTram: () => ({ nombre: 'Concesión de aguas' }),
    esPqrsSecretaria: e => !!(e && e._es_pqrs)
  })
  runInContext(extraer(core, ['busquedaIdRank']) + '\n' + extraer(consulta, [
    'consultaBusquedaRank', 'ordenarConsultaPorTitulo', 'consultaBusqEtiqueta', 'consultaBusqItems'
  ]), c)
  return c
}

describe('Buscadores de actividades y consulta', () => {
  it('el HTML usa la lista del buscador de responsables y no pinta en cada tecla', () => {
    expect(html).toMatch(/id="s-act"[^>]*oninput="actBusqInput\(this\)"/)
    expect(html).toMatch(/id="s-act-sug" class="entrega-resp-sug"/)
    expect(html).toMatch(/id="q-txt"[^>]*oninput="consultaBusqInput\(this\)"/)
    expect(html).toMatch(/id="q-txt-sug" class="entrega-resp-sug"/)
    expect(html).toMatch(/id="act-dept-resp-sug" class="entrega-resp-sug"/)
    expect(html).not.toMatch(/id="s-act"[^>]*oninput="renderActividades\(\)"/)
    expect(html).not.toMatch(/id="q-txt"[^>]*oninput="renderConsulta\(\)"/)
  })

  it('el número exacto del expediente o PQRSD queda antes que una mención en el contenido', () => {
    const c = montarRank()
    const menciona = { _exp: 'ZZ-1', tasks: [{ desc: 'oficio que cita QR260001' }] }
    const propio = { _exp: 'QR260001', _es_pqrs: true, tasks: [] }
    const orden = c.ordenarConsultaPorTitulo([menciona, propio], 'QR260001')
    expect(orden[0]._exp).toBe('QR260001')
    expect(orden[1]._exp).toBe('ZZ-1')
    expect(c.consultaBusquedaRank(propio, '260001')).toBe(0)
    expect(c.consultaBusquedaRank(menciona, 'QR260001')).toBe(5)
  })

  it('el código de la actividad propia queda antes que otro registro que solo lo nombra', () => {
    const c = montarRank()
    const nombra = { _exp: 'EXP-2', tasks: [{ desc: 'ver ACT-77 en el cuerpo' }] }
    const dueño = { _exp: 'EXP-1', tasks: [{ codigo: 'ACT-77', actividad: 'Visita' }] }
    const libre = {
      _consulta_act_libre: true,
      _exp: 'ACT-77',
      _act_libre_task: { codigo: 'ACT-77', actividad: 'Visita de campo' }
    }
    expect(c.ordenarConsultaPorTitulo([nombra, dueño], 'ACT-77')[0]._exp).toBe('EXP-1')
    expect(c.ordenarConsultaPorTitulo([nombra, libre], 'ACT-77')[0]._exp).toBe('ACT-77')
    expect(c.consultaBusqEtiqueta(libre).tag).toBe('Actividad')
    expect(c.consultaBusqEtiqueta(dueño).tag).toBe('Trámite')
    expect(c.consultaBusqEtiqueta({ _exp: 'QR1', _es_pqrs: true, tasks: [] }).tag).toBe('PQRSD')
  })

  it('sin texto no reordena ni descarta, y un nombre visible sigue por encima del resto', () => {
    const c = montarRank()
    const a = { _exp: 'A', _nom: 'Pedro Gómez', tasks: [] }
    const b = { _exp: 'B', tasks: [] }
    const igual = c.ordenarConsultaPorTitulo([a, b], '')
    expect(igual.map(x => x._exp)).toEqual(['A', 'B'])
    expect(c.ordenarConsultaPorTitulo([b, a], 'Pedro')[0]._exp).toBe('A')
    expect(c.ordenarConsultaPorTitulo([a, b], 'nadie').map(x => x._exp)).toEqual(['A', 'B'])
  })

  it('la lista rápida de consulta pone el título de primero y no lista solo-contenido', () => {
    const c = montarRank()
    c.expsAmbito = () => [
      { _exp: 'ZZ-1', tasks: [{ desc: 'cita QR260001' }] },
      { _exp: 'QR260001', _es_pqrs: true, _nom: 'Ana', tasks: [] }
    ]
    c.actividadesLibres = []
    c.expEstaEnPapelera = () => false
    const items = c.consultaBusqItems('QR260001')
    expect(items[0].item._exp).toBe('QR260001')
    expect(items.some(x => x.item._exp === 'ZZ-1')).toBe(true)
    expect(items[0].r).toBeLessThan(items[1].r)
  })

  it('al escribir en actividades la lista sale al momento y la tabla espera', () => {
    let timer = null
    let renders = 0
    const portal = { style: { display: 'none' }, innerHTML: '' }
    const inp = { value: 'qr260001' }
    const c = createContext({
      window: {
        _actSearchCache: {
          list: [
            { exp: 'OTRO', actividad: 'Respuesta QR260001' },
            { exp: 'QR260001', actividad: 'Atender PQRSD' }
          ]
        }
      },
      document: { getElementById: id => (id === 's-act-sug' ? portal : (id === 's-act' ? inp : null)) },
      escAttr: s => String(s == null ? '' : s),
      setTimeout: fn => { timer = fn; return 1 },
      clearTimeout: () => { timer = null },
      renderActividades: opts => { renders++; c._opts = opts }
    })
    runInContext(extraer(core, [
      'busquedaIdRank', 'actividadTituloRank', 'actBusqTextoRapido', 'actBusqRef',
      'actBusqPintar', 'actBusqInput', 'actBusqElegir', 'actBusqCerrar'
    ]), c)
    c.actBusqInput(inp)
    expect(renders).toBe(0)
    expect(portal.style.display).toBe('block')
    expect(portal.innerHTML.indexOf('QR260001')).toBeLessThan(portal.innerHTML.indexOf('OTRO'))
    timer()
    expect(renders).toBe(1)
    expect(c._opts).toEqual({ soloTexto: true })
    c.actBusqElegir('QR260001')
    expect(inp.value).toBe('QR260001')
    expect(portal.style.display).toBe('none')
    expect(renders).toBe(2)
  })

  it('el repintado por texto filtra la tabla y no arma de nuevo las paletas', () => {
    let paletas = 0
    const tb = { innerHTML: '', closest: () => null }
    const c = createContext({
      window: { _actListFilterKey: '', _actListShown: 50, _actVista: 'tabla' },
      document: {
        getElementById: id => {
          if (id === 'tbl-act') return tb
          if (id === 'btn-export-act') return { style: {} }
          if (id === 'act-table-wrap' || id === 'act-gantt-wrap' || id === 'act-revisados-more') return { style: {} }
          return null
        }
      },
      matchActividadSearch: (t, q) => String(t.exp || '').toLowerCase().includes(String(q || '')),
      renderActividadesRowHtml: t => '<tr>' + t.exp + '</tr>',
      actPaletaPageSize: () => 50,
      actPaletaFilterKey: (f, q) => f + '|' + q,
      sortTasksPorEjecutar: list => list,
      sortTasksRevisadas: list => list,
      sortTasksPorRevisar: list => list,
      sortTasksPorFirma: list => list,
      sortTasksAtendidas: list => list,
      sortTasksByUrgency: list => list,
      ordenarInformesContratoPrimero: list => list,
      contarPaletas: () => { paletas++ }
    })
    runInContext(extraer(core, ['ordenarActividadesVisibles', 'pintarActividadesPorTexto']), c)
    c.pintarActividadesPorTexto({
      deptView: true,
      respFilter: 'NCA',
      list: [{ exp: 'QR260001' }, { exp: 'OTRO-1' }]
    }, 'qr260001', 'pend')
    expect(tb.innerHTML).toContain('QR260001')
    expect(tb.innerHTML).not.toContain('OTRO-1')
    expect(paletas).toBe(0)
    expect(c.window._actExportList.map(t => t.exp)).toEqual(['QR260001'])
  })

  it('la ruta completa de actividades sigue ordenando informes y usa caché solo para el texto', () => {
    const fn = extraer(core, ['renderActividades'])
    expect(fn).toContain("if(filtroAct==='porver'||filtroAct==='porcorr')list=ordenarInformesContratoPrimero(list);")
    expect(fn).toContain('opts&&opts.soloTexto&&filtroAct!==\'req\'')
    expect(fn).toContain('window._actSearchCache={sig:actSig')
  })
})
