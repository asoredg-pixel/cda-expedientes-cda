// =============================================================================
// pqrs-matriz-sheets.js — Sincronización en vivo con Matriz PQRSD (Google Sheets)
// Requiere: OAuth spreadsheets + buildPqrsMatrizRecord (pqrs-matriz-export.js)
// =============================================================================
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function _pqrsMatrizSheetsToken() {
  return typeof _driveGetBestToken === 'function' ? _driveGetBestToken() : '';
}

function pqrsFormatNumeroRadicado(aa, seq) {
  return String(aa).padStart(2, '0') + String(seq).padStart(4, '0');
}

function pqrsParseNumeroRadicado(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  const aa = digits.slice(0, 2);
  const seq = parseInt(digits.slice(2), 10);
  if (isNaN(seq)) return null;
  return { aa: aa, seq: seq };
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

function pqrsMatrizMaxConsecutivoAnio(aa) {
  let maxSeq = 0;
  const checkId = function(raw) {
    const p = pqrsParseNumeroRadicado(raw);
    if (!p || p.aa !== aa) return;
    if (p.seq > maxSeq) maxSeq = p.seq;
  };
  if (typeof exps !== 'undefined' && Array.isArray(exps)) {
    exps.forEach(function(e) {
      if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return;
      checkId(e._exp);
    });
  }
  return maxSeq;
}

async function pqrsMatrizSiguienteNumero(year) {
  year = String(year || new Date().getFullYear());
  const aa = year.slice(-2);
  const sheetName = await pqrsMatrizEnsureTabAnio(year);
  const radicados = await pqrsMatrizLeerRadicados(sheetName);
  let maxSeq = pqrsMatrizMaxConsecutivoAnio(aa);
  radicados.forEach(function(r) {
    const p = pqrsParseNumeroRadicado(r);
    if (p && p.aa === aa && p.seq > maxSeq) maxSeq = p.seq;
  });
  return pqrsFormatNumeroRadicado(aa, maxSeq + 1);
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

async function pqrsMatrizAppendExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  const sheetName = await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
  let row = Number(e._pqrs_matriz_fila) || 0;
  if (!row) row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  const radicados = await pqrsMatrizLeerRadicados(sheetName);
  if (!row) row = PQRS_MATRIZ_DATA_ROW + radicados.length;
  const item = row - PQRS_MATRIZ_DATA_ROW + 1;
  const rec = pqrsMatrizBuildRec(e, item);
  if (!rec) return { skipped: true };
  rec.radicadoRecibo = e._exp;
  await pqrsMatrizEscribirFila(sheetName, row, rec);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizUpdateExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  const sheetName = await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
  let row = Number(e._pqrs_matriz_fila) || 0;
  if (!row) row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  if (!row) return pqrsMatrizAppendExpediente(e);
  const item = row - PQRS_MATRIZ_DATA_ROW + 1;
  const rec = pqrsMatrizBuildRec(e, item);
  if (!rec) return { skipped: true };
  rec.radicadoRecibo = e._exp;
  await pqrsMatrizEscribirFila(sheetName, row, rec);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizSyncExpediente(e) {
  if (!_pqrsMatrizSheetsToken()) return { ok: false, noToken: true };
  if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return { skipped: true };
  try {
    if (e._pqrs_matriz_fila) return await pqrsMatrizUpdateExpediente(e);
    const found = await pqrsMatrizBuscarFila(
      await pqrsMatrizEnsureTabAnio(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e)),
      e._exp
    );
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
      if (opts.warnNoToken && typeof notif === 'function') {
        notif('⚠️ Conecte Gmail (Secretaría o Correos) para sincronizar la matriz PQRSD en Drive.', 'warn');
      }
    } else if (res && res.error && typeof notif === 'function') {
      notif('⚠️ Guardado en sistema; matriz Drive no actualizada: ' + String(res.error.message || res.error).slice(0, 72), 'warn');
    }
    return res;
  });
}

async function sugerirNumeroPqrsDesdeMatriz(year) {
  if (!_pqrsMatrizSheetsToken()) return null;
  try {
    return await pqrsMatrizSiguienteNumero(year);
  } catch (err) {
    console.warn('sugerirNumeroPqrsDesdeMatriz:', err);
    return null;
  }
}

async function aplicarSugerenciaNumeroPqrsSec() {
  const inp = document.getElementById('sec-exp');
  if (!inp || String(inp.value || '').trim()) return;
  const fecha = (document.getElementById('sec-fecha-solicitud') || {}).value
    || (document.getElementById('sec-fecha') || {}).value
    || (typeof hoy === 'function' ? hoy() : '');
  const year = String(fecha).slice(0, 4) || String(new Date().getFullYear());
  const num = await sugerirNumeroPqrsDesdeMatriz(year);
  if (num) inp.value = num;
}

function refrescarSugerenciaNumeroPqrsSec() {
  const inp = document.getElementById('sec-exp');
  if (!inp) return;
  inp.value = '';
  aplicarSugerenciaNumeroPqrsSec();
}
