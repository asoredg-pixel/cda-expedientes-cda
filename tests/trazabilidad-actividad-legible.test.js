/**
 * trazabilidad-actividad-legible.test.js — Consulta › trazabilidad de la actividad: sin repetidos
 * (soporte por archivo, firma_wf sin cambio de fase), sin guiones bajos y con hora cuando existe.
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

function constante(src, nombre) {
  const ini = src.indexOf('const ' + nombre + '=')
  if (ini < 0) throw new Error('No se encontró ' + nombre)
  const fin = src.slice(ini).search(/;\r?\n/)
  return src.slice(ini, ini + fin + 1).replace(/^const /, 'var ')
}

function render(historial) {
  const c = createContext({
    escAttr: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    fmtF: f => { const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : '' },
    Set, Date, Number, isFinite, isNaN, parseInt, String
  })
  runInContext(constante(core, 'TASK_HIST_FASE_LBL') + '\n' + constante(core, 'TASK_HIST_DEVOLUCIONES') + '\n' +
    extraer(core, ['taskHistHoraTxt', 'taskHistLineaTxt', 'taskHistMismoMomento', 'taskHistOcultarComoDuplicado', 'renderTaskHistorialHtml']), c)
  return c.renderTaskHistorialHtml({ historial }).split('<br>').map(l => l.replace(/<[^>]+>/g, ''))
}

describe('Trazabilidad legible de la actividad', () => {
  it('caso de la imagen: sin repetidos ni guiones bajos', () => {
    const lineas = render([
      { tipo: 'autoasignacion_responsable', fecha: '2026-09-09', por: 'MARCELA CHARA' },
      { tipo: 'soporte', fecha: '2026-09-09', version: 1, por: 'MARCELA CHARA' },
      { tipo: 'soporte', fecha: '2026-09-09', version: 1, por: 'MARCELA CHARA', nota: 'Anexo Drive' },
      { tipo: 'reenvio_verificacion', fecha: '2026-09-09', version: 1, por: 'MARCELA CHARA' },
      { tipo: 'ajuste_soporte', fecha: '2026-09-10', nota: 'EL TITULO DEL AA NO CORRESPONDE' },
      { tipo: 'soporte', fecha: '2026-09-10', version: 2, por: 'MARCELA CHARA' },
      { tipo: 'reenvio_verificacion', fecha: '2026-09-10', version: 2, por: 'MARCELA CHARA' },
      { tipo: 'enviar_firma', fecha: '2026-09-11', nota: 'Enviado a «Por firmar» (pendiente impresión)' },
      { tipo: 'firma_proyeccion_atendida', fecha: '2026-09-11' },
      { tipo: 'firma_wf', fecha: '2026-09-12', nota: 'Firma trámite → por_firmar' },
      { tipo: 'firma_wf', fecha: '2026-09-12', nota: 'Firma trámite → por_firmar' },
      { tipo: 'firma_wf', fecha: '2026-09-13', nota: 'Firma trámite → pendiente_notificacion' },
      { tipo: 'firma_wf', fecha: '2026-09-13', nota: 'Firma trámite → pendiente_notificacion' },
      { tipo: 'atajo_firmado_revision', fecha: '2026-09-13' },
      { tipo: 'notif_reportada_revision', fecha: '2026-09-14' },
      { tipo: 'verificacion', fecha: '2026-10-08', por: 'CARLOS ANDRES QUINTERO SANTOS', nota: 'Notificada — entrega de MARCELA CHARA' }
    ])
    expect(lineas).toEqual([
      '09/09/2026 · 📌 Creada por el responsable · MARCELA CHARA',
      '09/09/2026 · 📤 Enviada para revisión · MARCELA CHARA',
      '10/09/2026 · ↩ Revisada y devuelta para corregir: EL TITULO DEL AA NO CORRESPONDE',
      '10/09/2026 · 📤 Nueva entrega (corrección v2) · MARCELA CHARA',
      '11/09/2026 · 🖨 Aprobada para imprimir y firmar',
      '12/09/2026 · ✍️ Pasó a firma del Director',
      '13/09/2026 · 📨 Firmada — asignada para notificar',
      '13/09/2026 · ✍️ Documento firmado cargado — pasa a notificar',
      '14/09/2026 · 📨 Notificación reportada — en revisión del encargado',
      '08/10/2026 · ✓ Aprobada y notificada · CARLOS ANDRES QUINTERO SANTOS'
    ])
    expect(lineas.join('\n')).not.toMatch(/_/)
  })

  it('muestra la hora cuando el evento la tiene y humaniza tipos desconocidos', () => {
    const ts = new Date(2026, 9, 13, 15, 7).getTime()
    const lineas = render([
      { tipo: 'reenvio_verificacion', fecha: '2026-10-13', ts, version: 1, por: 'ANA' },
      { tipo: 'algo_nuevo_raro', fecha: '2026-10-13' }
    ])
    expect(lineas[0]).toMatch(/^13\/10\/2026 3:07\s?p/)
    expect(lineas[1]).toBe('13/10/2026 · Algo nuevo raro')
  })

  it('tras una devolución, la misma fase de firma vuelve a mostrarse', () => {
    const lineas = render([
      { tipo: 'firma_wf', fecha: '2026-09-12', nota: 'Firma trámite → por_firmar' },
      { tipo: 'devuelto_director_firma', fecha: '2026-09-12', nota: 'Falta firma' },
      { tipo: 'firma_wf', fecha: '2026-09-15', nota: 'Firma trámite → por_firmar' }
    ])
    expect(lineas.length).toBe(3)
  })

  it('encargado devolvió vía profesional: no duplica «Revisada y devuelta» con el traslado', () => {
    const ts = new Date(2026, 9, 15, 17, 57).getTime()
    const lineas = render([
      { tipo: 'traslado', fecha: '2026-10-13', revisionPar: 'solicitud', de: 'MABEL LOPEZ', a: 'JHON ORTEGA' },
      { tipo: 'reenvio_verificacion', fecha: '2026-10-13', version: 1, por: 'MABEL LOPEZ', ts },
      { tipo: 'traslado', fecha: '2026-10-15', ts, de: 'JHON ORTEGA', a: 'MABEL LOPEZ', por: 'CARLOS', revisionPar: 'devolucion_nca', nota: 'Devuelta para corregir' },
      { tipo: 'ajuste_soporte', fecha: '2026-10-15', ts: ts + 10, por: 'CARLOS', nota: 'Devuelta para corregir' }
    ])
    expect(lineas.filter(l => /devuelta|devolvió/i.test(l))).toHaveLength(1)
    expect(lineas.some(l => /Encargado devolvió al técnico/.test(l))).toBe(true)
    expect(lineas.some(l => /Revisada y devuelta para corregir/.test(l))).toBe(false)
    // 1.ª entrega genérica no se repite si ya está el traslado a profesional (misma fecha)
    expect(lineas.filter(l => /Enviada/.test(l))).toHaveLength(1)
    expect(lineas.some(l => /Enviada a revisión de profesional/.test(l))).toBe(true)
  })

  it('corrección técnico→profesional: no duplica «Nueva entrega (corrección v2)» con el traslado', () => {
    const ts = new Date(2026, 9, 13, 10, 4).getTime()
    const lineas = render([
      { tipo: 'autoasignacion_responsable', fecha: '2026-09-30', por: 'ANA ARIAS' },
      { tipo: 'traslado', fecha: '2026-09-30', ts: ts - 1e9, revisionPar: 'solicitud', de: 'ANA ARIAS', a: 'LILIANA MARTINEZ', por: 'ANA ARIAS' },
      { tipo: 'reenvio_verificacion', fecha: '2026-09-30', version: 1, por: 'ANA ARIAS' },
      { tipo: 'traslado', fecha: '2026-10-06', revisionPar: 'devolucion', de: 'LILIANA MARTINEZ', a: 'ANA ARIAS', por: 'LILIANA MARTINEZ' },
      { tipo: 'reenvio_verificacion', fecha: '2026-10-13', ts, version: 2, por: 'ANA ARIAS', reportadoPor: 'ANA ARIAS' },
      { tipo: 'traslado', fecha: '2026-10-13', ts: ts + 5, de: 'ANA ARIAS', a: 'LILIANA MARTINEZ', por: 'ANA ARIAS', revisionPar: 'correccion' },
      { tipo: 'reenvio_verificacion', fecha: '2026-10-13', ts: ts + 3600000, version: 3, por: 'LILIANA MARTINEZ' }
    ])
    expect(lineas.filter(l => /Nueva entrega \(corrección v2\)/.test(l))).toHaveLength(0)
    expect(lineas.filter(l => /Corrección del técnico al profesional/.test(l))).toHaveLength(1)
    expect(lineas.some(l => /Corrección del técnico al profesional: ANA ARIAS → LILIANA MARTINEZ/.test(l))).toBe(true)
    // La entrega del profesional (v3) sin traslado de corrección sí se muestra
    expect(lineas.some(l => /Nueva entrega \(corrección v3\)/.test(l))).toBe(true)
  })
})
