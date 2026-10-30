/**
 * Encargado NCA en Consulta: 🧐 abre el rail de Revisadas (verRevisado).
 * Sin actividades, o en otro rol, sigue el botón Editar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const consulta = readFileSync(resolve(root, 'js/consulta.js'), 'utf8')

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

function ctx(nca) {
  const c = createContext({
    esNcaDeguv: () => !!nca,
    taskPendienteVerificacion: t => !!(t && t.pend),
    estadoTask: t => (t && t.estado) || '',
    escAttr: s => String(s == null ? '' : s)
  })
  runInContext(extraer(consulta, ['consultaTareaRailNca', 'consultaBtnGestionNcaHtml']), c)
  return c
}

describe('Consulta del encargado NCA abre el rail de revisión', () => {
  const exp = {
    _exp: 'PAF-00085-26',
    tasks: [
      { id: 'vieja', estado: 'Atendida' },
      { id: 'pend', estado: 'Por verificar', pend: true },
      { id: 'borrada', estado: 'Por verificar', pend: true, eliminada: true }
    ]
  }

  it('el encargado ve 🧐 sobre la actividad pendiente y abre como Revisadas', () => {
    const html = ctx(true).consultaBtnGestionNcaHtml(exp)
    expect(html).toContain('🧐')
    expect(html).toContain('verRevisado:true')
    expect(html).toContain("openTaskCommentsModal('PAF-00085-26','pend'")
    expect(html).not.toContain('vieja')
    expect(html).not.toContain('borrada')
  })

  it('sin pendiente abre la última actividad vigente', () => {
    const html = ctx(true).consultaBtnGestionNcaHtml({
      _exp: 'E2',
      tasks: [{ id: 'a', estado: 'Atendida' }, { id: 'b', estado: 'En ejecución' }]
    })
    expect(html).toContain("'b'")
    expect(html).toContain('verRevisado:true')
  })

  it('otro rol, o un expediente sin actividades, no reemplaza Editar', () => {
    expect(ctx(false).consultaBtnGestionNcaHtml(exp)).toBe('')
    expect(ctx(true).consultaBtnGestionNcaHtml({ _exp: 'E3', tasks: [] })).toBe('')
    const card = extraer(consulta, ['conConsultaOneCard'])
    expect(card).toContain('consultaBtnGestionNcaHtml(e)')
    expect(card).toContain("suffix:' Editar'")
  })
})
