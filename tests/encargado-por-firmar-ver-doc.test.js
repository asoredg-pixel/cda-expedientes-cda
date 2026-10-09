/**
 * encargado-por-firmar-ver-doc.test.js — Encargado en «Por firmar» (🧐 Ver revisión y gestionar):
 * el documento que pasó a firmar (solo en el workflow PQRSD) se muestra igual que a VITAL.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Script, createContext, runInContext } from 'vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'js/core.js'), 'utf8')

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

describe('Encargado: ver documento en Por firmar', () => {
  it('🧐 verRevisado en Por firmar carga los docs del workflow como soportes', () => {
    const modal = extraer(core, ['openTaskCommentsModal'])
    expect(modal).toContain("if((forceSoloAprobados||(verRevisado&&enPorFirmarOpen))&&e&&typeof ensurePqrsSoportesAprobadosOnTask==='function')")
    expect(modal.indexOf('const enPorFirmarOpen=')).toBeLessThan(modal.indexOf('verRevisado&&enPorFirmarOpen'))
  })

  it('ensurePqrsSoportesAprobadosOnTask pasa el doc del workflow a la tarea', () => {
    const aplicados = []
    const c = createContext({
      taskEsAtenderPqrs: () => true,
      getPqrsAtencionTask: () => ({ id: 't1' }),
      getPqrsWorkflow: () => ({ task_id: 't1', documentos: [{ nombre: 'Oficio.pdf', driveLink: 'https://drive/o', fileId: 'O1' }] }),
      _pqrsDocEsPorCorregir: () => false,
      _pqrsAplicarDocsWfComoSoportes: (t, e, docs) => { aplicados.push(docs.length); t.soportes = docs.map(d => ({ id: d.fileId, url: d.driveLink })) }
    })
    runInContext(extraer(core, ['ensurePqrsSoportesAprobadosOnTask']) + '\nthis._f=ensurePqrsSoportesAprobadosOnTask;', c)
    const t = { id: 't1', soportes: [] }
    c._f(t, { _exp: 'P1' })
    expect(aplicados).toEqual([1])
    expect(t.soportes.map(s => s.id)).toEqual(['O1'])
  })
})
