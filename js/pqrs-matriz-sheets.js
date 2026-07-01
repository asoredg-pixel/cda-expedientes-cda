// =============================================================================
// pqrs-matriz-sheets.js — Consecutivo PQRSD y sync opcional con Google Sheets
// Formato radicado: AA + MM + NNN (7 dígitos). AA y MM = fecha de radicación; NNN = consecutivo mensual (reinicia cada mes).
// Requiere: buildPqrsMatrizRecord (pqrs-matriz-export.js)
// =============================================================================
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function _pqrsMatrizSheetsToken() {
  return typeof _driveGetBestToken === 'function' ? _driveGetBestToken() : '';
}

/** Formato oficial: AA + MM + NNN (7 dígitos). Ej. 26 + 02 + 010 → 2602010 */
function pqrsFormatNumeroRadicado(aa, mm, seq) {
  return String(aa).padStart(2, '0') + String(mm).padStart(2, '0') + String(seq).padStart(3, '0');
}

function pqrsParseNumeroRadicado(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length === 7) {
    const aa = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const seq = parseInt(digits.slice(4), 10);
    if (isNaN(seq)) return null;
    return { aa: aa, mm: mm, seq: seq };
  }
  // Compatibilidad con formato anterior (6 dígitos: AA + NNNN)
  if (digits.length >= 6) {
    const aa = digits.slice(0, 2);
    const seq = parseInt(digits.slice(2), 10);
    if (!isNaN(seq)) return { aa: aa, mm: '', seq: seq, legacy: true };
  }
  return null;
}

function pqrsMesDesdeFecha(fechaRef) {
  const f = String(fechaRef || (typeof hoy === 'function' ? hoy() : '') || '');
  const m = f.slice(5, 7);
  if (m && /^\d{2}$/.test(m)) return m;
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function pqrsAnioCortoDesdeFecha(fechaRef) {
  const f = String(fechaRef || (typeof hoy === 'function' ? hoy() : '') || '');
  const y = f.slice(0, 4);
  if (y && /^\d{4}$/.test(y)) return y.slice(-2);
  return String(new Date().getFullYear()).slice(-2);
}

function pqrsFechaRadicacionRef() {
  const puedeEdit = typeof puedeEditarFechaRadicacionPqrs === 'function' && puedeEditarFechaRadicacionPqrs();
  if (puedeEdit) {
    const f = String((document.getElementById('sec-fecha') || {}).value || '').trim();
    if (f) return f;
  }
  return typeof hoy === 'function' ? hoy() : '';
}

function pqrsValidarNumeroRadicado(val, fechaRadicacion) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length !== 7) {
    return { ok: false, msg: 'Use 7 dígitos: AA + MM + NNN (ej. 2607001 = jul. 2026, consecutivo 001).' };
  }
  const p = pqrsParseNumeroRadicado(val);
  if (!p || p.legacy) {
    return { ok: false, msg: 'Formato inválido. Ejemplo: 2607001 (año 26, mes de radicación 07, consecutivo 001).' };
  }
  const aa = pqrsAnioCortoDesdeFecha(fechaRadicacion);
  if (p.aa !== aa) {
    return { ok: false, msg: 'El año del número (' + p.aa + ') no coincide con la fecha de radicación (20' + aa + ').' };
  }
  if (p.mm !== '00' && p.mm !== pqrsMesDesdeFecha(fechaRadicacion)) {
    return { ok: false, msg: 'El mes del número (' + p.mm + ') no coincide con el mes de radicación (' + pqrsMesDesdeFecha(fechaRadicacion) + ').' };
  }
  if (p.seq < 1 || p.seq > 999) {
    return { ok: false, msg: 'El consecutivo debe estar entre 001 y 999.' };
  }
  return { ok: true, parsed: p };
}

function pqrsMatrizRegistrarRadicadoEnMax(raw, aa, mm, maxRef) {
  const p = pqrsParseNumeroRadicado(raw);
  if (!p || p.legacy) return;
  if (p.aa !== aa || p.mm !== mm) return;
  if (p.seq > maxRef.v) maxRef.v = p.seq;
}

function pqrsMatrizMaxConsecutivoMes(aa, mm) {
  const maxRef = { v: 0 };
  if (typeof exps !== 'undefined' && Array.isArray(exps)) {
    exps.forEach(function(e) {
      if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return;
      pqrsMatrizRegistrarRadicadoEnMax(e._exp, aa, mm, maxRef);
    });
  }
  return maxRef.v;
}

async function _pqrsSheetsApi(method, path, body) {
  const token = _pqrsMatrizSheetsToken();
  if (!token) throw new Error('Sin token Google. Conecte correo en Secretaría o Correos.');
  const url = SHEETS_API_BASE + '/' + PQRS_MATRIZ_SHEET_ID + path;
  const opts = {
    method: method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(function() { return ''; });
    throw new Error('Sheets API ' + res.status + ': ' + t.slice(0, 140));
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('json') >= 0) return res.json();
  return null;
}

function pqrsMatrizTabAnio(e, fechaRef) {
  const f = fechaRef || (e && (e._fecha || e._fecha_solicitud)) || (typeof hoy === 'function' ? hoy() : '');
  const y = String(f).slice(0, 4);
  return y || String(new Date().getFullYear());
}

function pqrsMatrizSheetRange(sheetName, a1) {
  return "'" + String(sheetName).replace(/'/g, "''") + "'!" + a1;
}

async function pqrsMatrizEnsureTabAnio(year) {
  year = String(year || new Date().getFullYear());
  const meta = await _pqrsSheetsApi('GET', '?fields=sheets.properties.title');
  const titles = (meta.sheets || []).map(function(s) { return s.properties && s.properties.title; }).filter(Boolean);
  if (titles.indexOf(year) >= 0) return year;
  await _pqrsSheetsApi('POST', ':batchUpdate', {
    requests: [{ addSheet: { properties: { title: year } } }]
  });
  return year;
}

async function pqrsMatrizLeerRadicados(sheetName) {
  const range = encodeURIComponent(pqrsMatrizSheetRange(sheetName, 'E' + PQRS_MATRIZ_DATA_ROW + ':E'));
  const data = await _pqrsSheetsApi('GET', '/values/' + range);
  return (data.values || []).map(function(r) { return String(r[0] || '').trim(); }).filter(Boolean);
}

async function pqrsMatrizLeerRadicadosSheetTabs() {
  const out = [];
  const seen = {};
  try {
    const meta = await _pqrsSheetsApi('GET', '?fields=sheets.properties.title');
    const tabs = (meta.sheets || []).map(function(s) { return s.properties && s.properties.title; }).filter(Boolean);
    const consName = typeof PQRS_MATRIZ_SHEET_CONS !== 'undefined' ? PQRS_MATRIZ_SHEET_CONS : 'CONSOLIDADO PQRSD';
    for (let i = 0; i < tabs.length; i++) {
      const title = tabs[i];
      if (!/^\d{4}$/.test(title) && title !== consName) continue;
      const rads = await pqrsMatrizLeerRadicados(title);
      rads.forEach(function(r) {
        if (!seen[r]) { seen[r] = true; out.push(r); }
      });
    }
  } catch (err) {
    console.warn('pqrsMatrizLeerRadicadosSheetTabs:', err);
  }
  return out;
}

async function pqrsMatrizSiguienteNumero(fechaRef) {
  const aa = pqrsAnioCortoDesdeFecha(fechaRef);
  const mm = pqrsMesDesdeFecha(fechaRef);
  let maxSeq = pqrsMatrizMaxConsecutivoMes(aa, mm);

  if (_pqrsMatrizSheetsToken()) {
    try {
      const year = String(fechaRef || '').slice(0, 4) || String(new Date().getFullYear());
      await pqrsMatrizEnsureTabAnio(year);
      const radicados = await pqrsMatrizLeerRadicadosSheetTabs();
      const maxRef = { v: maxSeq };
      radicados.forEach(function(r) {
        pqrsMatrizRegistrarRadicadoEnMax(r, aa, mm, maxRef);
      });
      maxSeq = maxRef.v;
    } catch (err) {
      console.warn('pqrsMatrizSiguienteNumero (sheet):', err);
    }
  }

  return pqrsFormatNumeroRadicado(aa, mm, maxSeq + 1);
}

function pqrsMatrizFechaCelda(iso) {
  if (!iso) return '';
  if (typeof fmtF === 'function') return fmtF(iso);
  return String(iso);
}

function pqrsMatrizRecordToCells(rec) {
  return [
    rec.item,
    pqrsMatrizFechaCelda(rec.fechaRecibo),
    rec.radicadoRecibo,
    rec.departamento,
    rec.tipo,
    rec.nombre,
    rec.asunto,
    rec.plazoDias,
    rec.responsable,
    pqrsMatrizFechaCelda(rec.fechaVence),
    rec.estado,
    rec.diasParaVencer === '' ? '' : rec.diasParaVencer,
    pqrsMatrizFechaCelda(rec.fechaContestacion),
    rec.radicadoContestacion || '',
    rec.diasRespuesta === '' ? '' : rec.diasRespuesta,
    rec.estadoFinal || '',
    rec.observaciones || ''
  ];
}

function pqrsMatrizBuildRec(e, itemNum) {
  if (typeof buildPqrsMatrizRecord !== 'function') return null;
  return buildPqrsMatrizRecord(e, itemNum);
}

function pqrsCompareRadicado(a, b) {
  const da = parseInt(String(a || '').replace(/\D/g, ''), 10) || 0;
  const db = parseInt(String(b || '').replace(/\D/g, ''), 10) || 0;
  return da - db;
}

async function pqrsMatrizLeerFilasData(sheetName) {
  const range = encodeURIComponent(pqrsMatrizSheetRange(sheetName, 'C' + PQRS_MATRIZ_DATA_ROW + ':S'));
  const data = await _pqrsSheetsApi('GET', '/values/' + range + '?majorDimension=ROWS');
  return (data.values || []).map(function(cells, i) {
    const rowCells = cells.slice();
    while (rowCells.length < 17) rowCells.push('');
    return {
      row: PQRS_MATRIZ_DATA_ROW + i,
      cells: rowCells,
      radicado: String(rowCells[2] || '').trim()
    };
  }).filter(function(r) { return r.radicado; });
}

async function pqrsMatrizReordenarHojaPorRadicado(sheetName) {
  const filas = await pqrsMatrizLeerFilasData(sheetName);
  if (!filas.length) return;
  const sorted = filas.slice().sort(function(a, b) {
    return pqrsCompareRadicado(a.radicado, b.radicado);
  });
  sorted.forEach(function(f, i) { f.cells[0] = String(i + 1); });
  const yaOrdenada = filas.every(function(f, i) {
    return f.radicado === sorted[i].radicado && String(f.cells[0]) === String(i + 1);
  });
  if (yaOrdenada) return;
  const endRow = PQRS_MATRIZ_DATA_ROW + sorted.length - 1;
  const range = encodeURIComponent(pqrsMatrizSheetRange(sheetName, 'C' + PQRS_MATRIZ_DATA_ROW + ':S' + endRow));
  await _pqrsSheetsApi('PUT', '/values/' + range + '?valueInputOption=USER_ENTERED', {
    values: sorted.map(function(f) { return f.cells; })
  });
  if (typeof exps !== 'undefined' && Array.isArray(exps)) {
    sorted.forEach(function(f, i) {
      const row = PQRS_MATRIZ_DATA_ROW + i;
      exps.forEach(function(e) {
        if (e && String(e._exp || '').trim() === f.radicado) {
          e._pqrs_matriz_fila = row;
          e._pqrs_matriz_hoja = sheetName;
        }
      });
    });
  }
}

async function pqrsMatrizBuscarFila(sheetName, expId) {
  const radicados = await pqrsMatrizLeerRadicados(sheetName);
  const target = String(expId || '').trim();
  for (let i = 0; i < radicados.length; i++) {
    if (radicados[i] === target) return PQRS_MATRIZ_DATA_ROW + i;
  }
  return 0;
}

async function pqrsMatrizEscribirFila(sheetName, row, rec) {
  const range = encodeURIComponent(pqrsMatrizSheetRange(sheetName, 'C' + row + ':S' + row));
  await _pqrsSheetsApi('PUT', '/values/' + range + '?valueInputOption=USER_ENTERED', {
    values: [pqrsMatrizRecordToCells(rec)]
  });
}

async function pqrsMatrizUpdateExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  const sheetName = await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
  let row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  if (!row) return pqrsMatrizAppendExpediente(e);
  const item = row - PQRS_MATRIZ_DATA_ROW + 1;
  const rec = pqrsMatrizBuildRec(e, item);
  if (!rec) return { skipped: true };
  rec.radicadoRecibo = e._exp;
  await pqrsMatrizEscribirFila(sheetName, row, rec);
  await pqrsMatrizReordenarHojaPorRadicado(sheetName);
  row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizAppendExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  const sheetName = await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
  const expId = String(e._exp).trim();
  let row = await pqrsMatrizBuscarFila(sheetName, expId);
  if (row) return pqrsMatrizUpdateExpediente(e);
  const radicados = await pqrsMatrizLeerRadicados(sheetName);
  row = PQRS_MATRIZ_DATA_ROW + radicados.length;
  const item = row - PQRS_MATRIZ_DATA_ROW + 1;
  const rec = pqrsMatrizBuildRec(e, item);
  if (!rec) return { skipped: true };
  rec.radicadoRecibo = expId;
  await pqrsMatrizEscribirFila(sheetName, row, rec);
  await pqrsMatrizReordenarHojaPorRadicado(sheetName);
  row = await pqrsMatrizBuscarFila(sheetName, expId);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizSyncExpediente(e) {
  if (!_pqrsMatrizSheetsToken()) return { ok: false, noToken: true };
  if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return { skipped: true };
  try {
    const sheetName = await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
    const found = await pqrsMatrizBuscarFila(sheetName, e._exp);
    if (found) {
      e._pqrs_matriz_fila = found;
      return await pqrsMatrizUpdateExpediente(e);
    }
    return await pqrsMatrizAppendExpediente(e);
  } catch (err) {
    console.warn('pqrsMatrizSyncExpediente:', err);
    return { ok: false, error: err };
  }
}

function pqrsMatrizSyncAfterSave(e, opts) {
  opts = opts || {};
  if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return Promise.resolve(null);
  return pqrsMatrizSyncExpediente(e).then(function(res) {
    if (res && res.ok) {
      if (typeof persistExpedienteGranular === 'function') persistExpedienteGranular(e, false);
    } else if (res && res.noToken) {
      if (opts.warnNoToken && !opts.silent && typeof notif === 'function') {
        notif('⚠️ Conecte Gmail (Secretaría o Correos) para sincronizar la hoja PQRSD en Google Sheets.', 'warn');
      }
    } else if (res && res.error && !opts.silent && typeof notif === 'function') {
      notif('⚠️ Guardado en sistema; Google Sheets no actualizado: ' + String(res.error.message || res.error).slice(0, 72), 'warn');
    }
    return res;
  });
}

async function sugerirNumeroPqrsDesdeMatriz(fechaRef) {
  try {
    return await pqrsMatrizSiguienteNumero(fechaRef);
  } catch (err) {
    console.warn('sugerirNumeroPqrsDesdeMatriz:', err);
    return null;
  }
}

async function aplicarSugerenciaNumeroPqrsSec() {
  const inp = document.getElementById('sec-exp');
  if (!inp || String(inp.value || '').trim()) return;
  const num = await sugerirNumeroPqrsDesdeMatriz(pqrsFechaRadicacionRef());
  if (num) {
    inp.value = num;
  } else if (typeof notif === 'function') {
    notif('No se pudo sugerir consecutivo.', 'warn');
  }
}

async function refrescarSugerenciaNumeroPqrsSec() {
  const inp = document.getElementById('sec-exp');
  if (!inp) return;
  inp.value = '';
  const num = await sugerirNumeroPqrsDesdeMatriz(pqrsFechaRadicacionRef());
  if (num) {
    inp.value = num;
    if (typeof notif === 'function') notif('Siguiente consecutivo sugerido: ' + num, 'ok');
  } else if (typeof notif === 'function') {
    notif('No se pudo calcular el consecutivo. Ingrese el número manualmente.', 'err');
  }
}
