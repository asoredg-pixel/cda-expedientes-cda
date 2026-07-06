// =============================================================================
// pqrs-matriz-sheets.js — Consecutivo PQRSD (AAMMNNN) y helpers legacy Sheets API.
// Al guardar PQRSD: persistExpedienteGranular → pqrsMatrizSyncAfterSave → publica XLSX en Drive.
// =============================================================================
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function _pqrsMatrizSheetsToken() {
  return typeof _driveGetBestToken === 'function' ? _driveGetBestToken() : '';
}

const PQRS_MATRIZ_SHEET_LS_KEY = 'sst_pqrs_matriz_sheet_id';
const PQRS_MATRIZ_HEADER_LABELS = [
  'Item', 'Fecha recibo', 'Radicado recibo', 'Departamento', 'Tipo solicitud', 'Nombre / solicitante',
  'Asunto', 'Plazo (días)', 'Responsable', 'Fecha vence', 'Estado', 'Días para vencer',
  'Fecha contestación', 'Radicado contestación', 'Días respuesta', 'Estado final', 'Observaciones'
];

function pqrsMatrizActiveSheetId() {
  try {
    const ls = localStorage.getItem(PQRS_MATRIZ_SHEET_LS_KEY);
    if (ls && String(ls).trim()) {
      const id = String(ls).trim();
      if (!pqrsMatrizIsLegacyExcelSheetId(id)) return id;
    }
  } catch (e) {}
  const def = typeof PQRS_MATRIZ_SHEET_ID !== 'undefined' ? String(PQRS_MATRIZ_SHEET_ID || '').trim() : '';
  if (def && !pqrsMatrizIsLegacyExcelSheetId(def)) return def;
  return '';
}

function _pqrsMatrizLegacyExcelIds() {
  const ids = ['1FaaTezSwWZmcDjlzEEu4FEgL5vLdaWau'];
  if (typeof PQRS_MATRIZ_LEGACY_EXCEL_IDS !== 'undefined' && Array.isArray(PQRS_MATRIZ_LEGACY_EXCEL_IDS)) {
    PQRS_MATRIZ_LEGACY_EXCEL_IDS.forEach(function(x) {
      const s = String(x || '').trim();
      if (s && ids.indexOf(s) < 0) ids.push(s);
    });
  }
  return ids;
}

function pqrsMatrizIsLegacyExcelSheetId(id) {
  id = String(id || '').trim();
  return id ? _pqrsMatrizLegacyExcelIds().indexOf(id) >= 0 : false;
}

function pqrsMatrizClearActiveSheetIdCache() {
  try { localStorage.removeItem(PQRS_MATRIZ_SHEET_LS_KEY); } catch (e) {}
  _pqrsMatrizInvalidateMetaCache();
}

function pqrsMatrizSheetUrl(id) {
  id = id || pqrsMatrizActiveSheetId();
  return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : '';
}

function pqrsMatrizSetActiveSheetId(id, persistFs) {
  id = String(id || '').trim();
  if (!id) return;
  try { localStorage.setItem(PQRS_MATRIZ_SHEET_LS_KEY, id); } catch (e) {}
  _pqrsMatrizInvalidateMetaCache();
  if (persistFs !== false) pqrsMatrizPersistSheetIdFirestore(id);
}

function pqrsMatrizApplySheetIdFromGlobal(g) {
  if (g && g.pqrsMatrizSheetId && !pqrsMatrizIsLegacyExcelSheetId(g.pqrsMatrizSheetId)) {
    pqrsMatrizSetActiveSheetId(g.pqrsMatrizSheetId, false);
  }
}

async function pqrsMatrizPersistSheetIdFirestore(id) {
  const db = window._db;
  if (!db || !window._fsSetDoc || !window._fsDoc) return false;
  try {
    await window._fsSetDoc(window._fsDoc(db, 'sistema', 'global'), {
      pqrsMatrizSheetId: String(id || '').trim(),
      pqrsMatrizSheetUrl: pqrsMatrizSheetUrl(id),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('pqrsMatrizPersistSheetIdFirestore:', err);
    return false;
  }
}

function _pqrsMatrizGcpProjectNumber() {
  if (typeof GOOGLE_CLOUD_PROJECT_NUMBER !== 'undefined' && GOOGLE_CLOUD_PROJECT_NUMBER) {
    return String(GOOGLE_CLOUD_PROJECT_NUMBER);
  }
  const cid = typeof GMAIL_OAUTH_CLIENT_ID !== 'undefined' ? GMAIL_OAUTH_CLIENT_ID : (window._gmailClientId || '');
  const m = String(cid).match(/^(\d+)-/);
  return m ? m[1] : '215089141263';
}

function pqrsMatrizSheetsApiEnableUrl() {
  if (typeof GOOGLE_SHEETS_API_ENABLE_URL !== 'undefined' && GOOGLE_SHEETS_API_ENABLE_URL) {
    return GOOGLE_SHEETS_API_ENABLE_URL;
  }
  return 'https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=' + _pqrsMatrizGcpProjectNumber();
}

function _pqrsMatrizMsgLooksApiDisabled(msg) {
  const low = String(msg || '').toLowerCase();
  return /has not been used|not been enabled|service_disabled|access not configured|sheets api has not/i.test(low);
}

function _pqrsMatrizMsgLooksUnsupported(msg) {
  const low = String(msg || '').toLowerCase();
  return /not supported for this document|must be a native|cannot be loaded as a spreadsheet|unable to parse range|this operation is not supported/i.test(low);
}

function _pqrsMatrizParseApiError(status, text) {
  let msg = String(text || '').slice(0, 400);
  try {
    const j = JSON.parse(text);
    if (j.error && j.error.message) msg = j.error.message;
  } catch (e) {}
  const low = msg.toLowerCase();
  if (_pqrsMatrizMsgLooksApiDisabled(msg)) {
    return { kind: 'api_disabled', msg: msg, enableUrl: pqrsMatrizSheetsApiEnableUrl() };
  }
  if (_pqrsMatrizMsgLooksUnsupported(msg)) {
    return { kind: 'unsupported', msg: msg };
  }
  if (status === 403) {
    if (/insufficient|scope|credential/i.test(low)) return { kind: 'scope', msg: msg };
    return { kind: 'permission', msg: msg };
  }
  if (status === 400 || status === 404) return { kind: 'missing', msg: msg };
  return { kind: 'other', msg: msg };
}

function _pqrsMatrizErrFromException(err) {
  const raw = String(err && err.message || err || '');
  if (_pqrsMatrizMsgLooksApiDisabled(raw)) {
    return { kind: 'api_disabled', msg: raw, enableUrl: pqrsMatrizSheetsApiEnableUrl() };
  }
  if (_pqrsMatrizMsgLooksUnsupported(raw)) {
    return { kind: 'unsupported', msg: raw };
  }
  const m = raw.match(/Sheets API (\d+):\s*(.*)/);
  if (m) return _pqrsMatrizParseApiError(parseInt(m[1], 10), m[2]);
  if (/403|permission|denied/i.test(raw)) return { kind: 'permission', msg: raw };
  return { kind: 'other', msg: raw };
}

function pqrsMatrizSyncErrorMessage(parsed) {
  parsed = parsed || { kind: 'other', msg: '' };
  if (parsed.kind === 'scope') return 'reconecte Gmail y acepte permiso de Google Sheets.';
  if (parsed.kind === 'api_disabled') {
    return 'falta habilitar Google Sheets API en Google Cloud (proyecto Firebase). Abra el enlace en consola (F12) o pida al administrador.';
  }
  if (parsed.kind === 'permission' || parsed.kind === 'unsupported') {
    return 'se está creando una Google Sheet nativa en la carpeta PQRSD. Radique de nuevo si no aparece la fila.';
  }
  return String(parsed.msg || '').slice(0, 120);
}
window.pqrsMatrizSheetsApiEnableUrl = pqrsMatrizSheetsApiEnableUrl;

function _pqrsMatrizShouldBootstrapFromErr(parsed) {
  return parsed && (parsed.kind === 'permission' || parsed.kind === 'unsupported' || parsed.kind === 'missing');
}

async function _pqrsMatrizMoveToDriveFolder(fileId) {
  const token = _pqrsMatrizSheetsToken();
  const folderId = typeof PQRS_MATRIZ_DRIVE_FOLDER_ID !== 'undefined' ? PQRS_MATRIZ_DRIVE_FOLDER_ID : '';
  if (!token || !folderId || !fileId) return;
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=parents', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!metaRes.ok) return;
  const meta = await metaRes.json();
  const prev = (meta.parents || []).join(',');
  if (prev && prev.indexOf(folderId) >= 0) return;
  await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?addParents=' + encodeURIComponent(folderId) + (prev ? '&removeParents=' + encodeURIComponent(prev) : ''), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token }
  });
}

async function _pqrsMatrizWriteHeaders(spreadsheetId, sheetName) {
  const token = _pqrsMatrizSheetsToken();
  if (!token) return;
  const row = (typeof PQRS_MATRIZ_DATA_ROW !== 'undefined' ? PQRS_MATRIZ_DATA_ROW : 16) - 1;
  const range = encodeURIComponent("'" + String(sheetName).replace(/'/g, "''") + "'!C" + row + ':S' + row);
  await fetch(SHEETS_API_BASE + '/' + spreadsheetId + '/values/' + range + '?valueInputOption=USER_ENTERED', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [PQRS_MATRIZ_HEADER_LABELS] })
  });
}

async function pqrsMatrizBootstrapNativeSheet() {
  pqrsMatrizClearActiveSheetIdCache();
  const created = await pqrsMatrizCrearHojaNativa();
  if (typeof notif === 'function') {
    notif('✅ Matriz PQRSD creada en Google Sheets (carpeta PQRSD). Datos desde fila ' + PQRS_MATRIZ_DATA_ROW + '.', 'ok');
  }
  console.info('Matriz PQRSD nativa:', created.url);
  return created;
}

async function pqrsMatrizEnsureWorkbookReady() {
  const token = _pqrsMatrizSheetsToken();
  if (!token) return { ok: false, noToken: true };
  let id = pqrsMatrizActiveSheetId();
  if (!id) {
    const created = await pqrsMatrizBootstrapNativeSheet();
    return { ok: true, created: true, url: created.url };
  }
  try {
    await _pqrsSheetsApi('GET', '?fields=spreadsheetId,properties.title,mimeType');
    return { ok: true };
  } catch (err) {
    const parsed = _pqrsMatrizErrFromException(err);
    if (parsed.kind === 'scope') return { ok: false, error: err, parsed: parsed };
    if (_pqrsMatrizShouldBootstrapFromErr(parsed)) {
      const created = await pqrsMatrizBootstrapNativeSheet();
      return { ok: true, created: true, url: created.url };
    }
    throw err;
  }
}

async function pqrsMatrizCrearHojaNativa() {
  const token = _pqrsMatrizSheetsToken();
  if (!token) throw new Error('Sin token Google. Conecte Gmail en Secretaría.');
  const year = String(new Date().getFullYear());
  const consName = _pqrsMatrizConsolidadoName();
  const title = 'Matriz oficial PQRSD DEGUV ' + year + ' (SST)';
  const res = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: title },
      sheets: [
        { properties: { title: consName } },
        { properties: { title: year } }
      ]
    })
  });
  const text = await res.text();
  if (!res.ok) {
    const p = _pqrsMatrizParseApiError(res.status, text);
    if (p.kind === 'scope') throw new Error('SCOPE_SHEETS: Falta permiso Google Sheets. Reconecte Gmail.');
    if (p.kind === 'api_disabled') {
      console.error('Habilitar Google Sheets API:', p.enableUrl);
      throw new Error('API_DISABLED_SHEETS: ' + (p.msg || 'Google Sheets API no habilitada en el proyecto Firebase.'));
    }
    throw new Error('No se pudo crear hoja: ' + (p.msg || text.slice(0, 100)));
  }
  const created = JSON.parse(text);
  const spreadsheetId = created.spreadsheetId;
  await _pqrsMatrizMoveToDriveFolder(spreadsheetId);
  await _pqrsMatrizWriteHeaders(spreadsheetId, consName);
  pqrsMatrizSetActiveSheetId(spreadsheetId, true);
  return { spreadsheetId: spreadsheetId, url: pqrsMatrizSheetUrl(spreadsheetId), title: title, sheetName: consName };
}
window.pqrsMatrizCrearHojaNativa = pqrsMatrizCrearHojaNativa;
window.pqrsMatrizActiveSheetId = pqrsMatrizActiveSheetId;

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
  const sheetId = pqrsMatrizActiveSheetId();
  if (!sheetId) throw new Error('Sin ID de hoja matriz PQRSD configurado.');
  const url = SHEETS_API_BASE + '/' + sheetId + path;
  const opts = {
    method: method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const t = await res.text().catch(function() { return ''; });
    const p = _pqrsMatrizParseApiError(res.status, t);
    throw new Error('Sheets API ' + res.status + ': ' + (p.msg || t.slice(0, 140)));
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('json') >= 0) return res.json();
  return null;
}

let _pqrsMatrizSheetsMetaCache = null;
function _pqrsMatrizInvalidateMetaCache() {
  _pqrsMatrizSheetsMetaCache = null;
}
async function _pqrsMatrizGetSheetsMeta(force) {
  if (!force && _pqrsMatrizSheetsMetaCache) return _pqrsMatrizSheetsMetaCache;
  const meta = await _pqrsSheetsApi('GET', '?fields=sheets.properties');
  _pqrsMatrizSheetsMetaCache = meta;
  return meta;
}
async function pqrsMatrizGetSheetIdByTitle(sheetName) {
  const meta = await _pqrsMatrizGetSheetsMeta();
  const sh = (meta.sheets || []).find(function(s) {
    return s.properties && s.properties.title === sheetName;
  });
  return sh && sh.properties ? sh.properties.sheetId : null;
}
async function pqrsMatrizListAnioTabs() {
  const meta = await _pqrsMatrizGetSheetsMeta();
  return (meta.sheets || [])
    .map(function(s) { return s.properties && s.properties.title; })
    .filter(function(t) { return t && /^\d{4}$/.test(t); });
}

function _pqrsMatrizConsolidadoName() {
  return typeof PQRS_MATRIZ_SHEET_CONS !== 'undefined' ? PQRS_MATRIZ_SHEET_CONS : 'CONSOLIDADO PQRSD';
}

async function pqrsMatrizSheetTitles() {
  const meta = await _pqrsMatrizGetSheetsMeta();
  return (meta.sheets || [])
    .map(function(s) { return s.properties && s.properties.title; })
    .filter(Boolean);
}

async function pqrsMatrizListDataTabs() {
  const titles = await pqrsMatrizSheetTitles();
  const yearTabs = titles.filter(function(t) { return /^\d{4}$/.test(t); });
  const consName = _pqrsMatrizConsolidadoName();
  const out = yearTabs.slice();
  if (titles.indexOf(consName) >= 0 && out.indexOf(consName) < 0) out.push(consName);
  return out;
}

/** Pestaña destino: año (2026), CONSOLIDADO PQRSD si existe, o crea pestaña anual. */
async function pqrsMatrizResolveDataSheet(yearOrHint) {
  const hint = String(yearOrHint || '').trim();
  const titles = await pqrsMatrizSheetTitles();
  if (hint && titles.indexOf(hint) >= 0) return hint;
  const year = /^\d{4}$/.test(hint) ? hint : String(new Date().getFullYear());
  if (titles.indexOf(year) >= 0) return year;
  const consName = _pqrsMatrizConsolidadoName();
  if (titles.indexOf(consName) >= 0) return consName;
  return pqrsMatrizEnsureTabAnio(year);
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
  const meta = await _pqrsMatrizGetSheetsMeta();
  const titles = (meta.sheets || []).map(function(s) { return s.properties && s.properties.title; }).filter(Boolean);
  if (titles.indexOf(year) >= 0) return year;
  await _pqrsSheetsApi('POST', ':batchUpdate', {
    requests: [{ addSheet: { properties: { title: year } } }]
  });
  _pqrsMatrizInvalidateMetaCache();
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
    const tabs = await pqrsMatrizListAnioTabs();
    const consName = typeof PQRS_MATRIZ_SHEET_CONS !== 'undefined' ? PQRS_MATRIZ_SHEET_CONS : 'CONSOLIDADO PQRSD';
    for (let i = 0; i < tabs.length; i++) {
      const title = tabs[i];
      const rads = await pqrsMatrizLeerRadicados(title);
      rads.forEach(function(r) {
        if (!seen[r]) { seen[r] = true; out.push(r); }
      });
    }
    if (tabs.indexOf(consName) < 0) {
      try {
        const rads = await pqrsMatrizLeerRadicados(consName);
        rads.forEach(function(r) {
          if (!seen[r]) { seen[r] = true; out.push(r); }
        });
      } catch (err) { /* tab opcional */ }
    }
  } catch (err) {
    console.warn('pqrsMatrizLeerRadicadosSheetTabs:', err);
  }
  return out;
}

async function pqrsMatrizSiguienteNumero(fechaRef) {
  const aa = pqrsAnioCortoDesdeFecha(fechaRef);
  const mm = pqrsMesDesdeFecha(fechaRef);
  const maxSeq = pqrsMatrizMaxConsecutivoMes(aa, mm);
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

async function pqrsMatrizBuscarFilaGlobal(expId, hintSheet) {
  const target = String(expId || '').trim();
  if (!target) return null;
  const tabs = await pqrsMatrizListDataTabs();
  const order = [];
  if (hintSheet && tabs.indexOf(hintSheet) >= 0) order.push(hintSheet);
  tabs.forEach(function(t) {
    if (order.indexOf(t) < 0) order.push(t);
  });
  for (let i = 0; i < order.length; i++) {
    const row = await pqrsMatrizBuscarFila(order[i], target);
    if (row) return { sheetName: order[i], row: row };
  }
  return null;
}

async function pqrsMatrizEliminarFila(sheetName, row) {
  const sheetId = await pqrsMatrizGetSheetIdByTitle(sheetName);
  if (sheetId == null) throw new Error('Hoja no encontrada: ' + sheetName);
  await _pqrsSheetsApi('POST', ':batchUpdate', {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: row - 1,
          endIndex: row
        }
      }
    }]
  });
  _pqrsMatrizInvalidateMetaCache();
}

async function pqrsMatrizEscribirFila(sheetName, row, rec) {
  const range = encodeURIComponent(pqrsMatrizSheetRange(sheetName, 'C' + row + ':S' + row));
  await _pqrsSheetsApi('PUT', '/values/' + range + '?valueInputOption=USER_ENTERED', {
    values: [pqrsMatrizRecordToCells(rec)]
  });
}

async function pqrsMatrizUpdateExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  let sheetName = await pqrsMatrizResolveDataSheet(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
  let row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  if (!row) {
    const global = await pqrsMatrizBuscarFilaGlobal(e._exp, sheetName);
    if (global) {
      e._pqrs_matriz_hoja = global.sheetName;
      e._pqrs_matriz_fila = global.row;
      row = global.row;
      sheetName = global.sheetName;
    }
  }
  if (!row) return pqrsMatrizAppendExpediente(e);
  const item = row - PQRS_MATRIZ_DATA_ROW + 1;
  const rec = pqrsMatrizBuildRec(e, item);
  if (!rec) return { skipped: true };
  rec.radicadoRecibo = e._exp;
  await pqrsMatrizEscribirFila(sheetName, row, rec);
  try {
    await pqrsMatrizReordenarHojaPorRadicado(sheetName);
  } catch (err) {
    console.warn('pqrsMatrizReordenarHojaPorRadicado (update):', err);
  }
  row = await pqrsMatrizBuscarFila(sheetName, e._exp);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizAppendExpediente(e) {
  if (!e || !e._exp) return { skipped: true };
  const sheetName = await pqrsMatrizResolveDataSheet(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
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
  try {
    await pqrsMatrizReordenarHojaPorRadicado(sheetName);
  } catch (err) {
    console.warn('pqrsMatrizReordenarHojaPorRadicado (append):', err);
  }
  row = await pqrsMatrizBuscarFila(sheetName, expId);
  e._pqrs_matriz_fila = row;
  e._pqrs_matriz_hoja = sheetName;
  return { ok: true, row: row, sheetName: sheetName };
}

async function pqrsMatrizSyncExpediente(e, opts) {
  opts = opts || {};
  if (!_pqrsMatrizSheetsToken()) return { ok: false, noToken: true };
  if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return { skipped: true };
  try {
    const ready = await pqrsMatrizEnsureWorkbookReady();
    if (ready && ready.noToken) return { ok: false, noToken: true };
    if (ready && ready.error) {
      if (ready.parsed && ready.parsed.kind === 'scope' && typeof notif === 'function') {
        notif('⚠️ Reconecte Gmail (Correos → Reconectar) y acepte permiso de Google Sheets.', 'warn');
      } else if (ready.parsed && ready.parsed.kind === 'api_disabled') {
        console.error('Habilitar Google Sheets API:', ready.parsed.enableUrl || pqrsMatrizSheetsApiEnableUrl());
        if (typeof notif === 'function') {
          notif('⚠️ ' + pqrsMatrizSyncErrorMessage(ready.parsed), 'warn');
        }
      }
      return { ok: false, error: ready.error, parsed: ready.parsed };
    }
    if (ready && ready.created && typeof notif === 'function') {
      notif('✅ Matriz PQRSD en Google Sheets lista. Datos desde fila ' + PQRS_MATRIZ_DATA_ROW + '.', 'ok');
    }
    const targetSheet = await pqrsMatrizResolveDataSheet(e._pqrs_matriz_hoja || pqrsMatrizTabAnio(e));
    const found = await pqrsMatrizBuscarFilaGlobal(e._exp, e._pqrs_matriz_hoja || targetSheet);
    if (found && found.sheetName !== targetSheet) {
      await pqrsMatrizEliminarFila(found.sheetName, found.row);
      try {
        await pqrsMatrizReordenarHojaPorRadicado(found.sheetName);
      } catch (err) {
        console.warn('pqrsMatrizReordenarHojaPorRadicado (move):', err);
      }
      e._pqrs_matriz_hoja = targetSheet;
      delete e._pqrs_matriz_fila;
      return await pqrsMatrizAppendExpediente(e);
    }
    if (found) {
      e._pqrs_matriz_fila = found.row;
      e._pqrs_matriz_hoja = found.sheetName;
      return await pqrsMatrizUpdateExpediente(e);
    }
    e._pqrs_matriz_hoja = targetSheet;
    return await pqrsMatrizAppendExpediente(e);
  } catch (err) {
    const parsed = _pqrsMatrizErrFromException(err);
    if (!opts._bootstrapped && _pqrsMatrizShouldBootstrapFromErr(parsed)) {
      try {
        await pqrsMatrizBootstrapNativeSheet();
        return await pqrsMatrizSyncExpediente(e, Object.assign({}, opts, { _bootstrapped: true }));
      } catch (bootErr) {
        console.warn('pqrsMatrizSyncExpediente bootstrap:', bootErr);
        if (String(bootErr.message || '').indexOf('SCOPE_SHEETS') >= 0 && typeof notif === 'function') {
          notif('⚠️ Reconecte Gmail (Correos) y acepte el permiso de Google Sheets.', 'warn');
        }
      }
    }
    console.warn('pqrsMatrizSyncExpediente:', err);
    return { ok: false, error: err, parsed: parsed };
  }
}

async function pqrsMatrizDeleteExpediente(e, opts) {
  opts = opts || {};
  if (!_pqrsMatrizSheetsToken()) return { ok: false, noToken: true };
  const expId = typeof e === 'object' ? e._exp : e;
  if (!expId) return { skipped: true };
  try {
    const hint = typeof e === 'object' ? e._pqrs_matriz_hoja : null;
    const found = await pqrsMatrizBuscarFilaGlobal(expId, hint);
    if (!found) return { ok: true, notFound: true };
    await pqrsMatrizEliminarFila(found.sheetName, found.row);
    try {
      await pqrsMatrizReordenarHojaPorRadicado(found.sheetName);
    } catch (err) {
      console.warn('pqrsMatrizReordenarHojaPorRadicado (delete):', err);
    }
    return { ok: true, sheetName: found.sheetName, row: found.row };
  } catch (err) {
    console.warn('pqrsMatrizDeleteExpediente:', err);
    return { ok: false, error: err };
  }
}

function _pqrsMatrizSyncNotify(opts) {
  return !opts.silent || !!opts.notifyOnError;
}

function pqrsMatrizSyncAfterDelete(e, opts) {
  opts = opts || {};
  const notify = _pqrsMatrizSyncNotify(opts);
  if (typeof pqrsMatrizPublicarEnDriveAsync !== 'function') return Promise.resolve(null);
  return pqrsMatrizPublicarEnDriveAsync({ silent: true, notifyOnError: notify }).then(function(res) {
    if (res && res.noToken && (opts.warnNoToken || notify) && typeof notif === 'function') {
      notif('⚠️ Conecte Gmail (Secretaría) para actualizar la matriz PQRSD en Drive.', 'warn');
    }
    return res;
  });
}

function pqrsMatrizSyncAfterSave(e, opts) {
  opts = opts || {};
  const notify = _pqrsMatrizSyncNotify(opts);
  if (!e || (!e._es_pqrs && !e._radicado_secretaria)) return Promise.resolve(null);

  const sheetsP = typeof pqrsMatrizSyncExpediente === 'function'
    ? pqrsMatrizSyncExpediente(e, opts).catch(function(err) {
      console.warn('pqrsMatrizSyncExpediente:', err);
      return { ok: false, error: err };
    })
    : Promise.resolve(null);

  const xlsxP = typeof pqrsMatrizDriveUpdateExpedienteRow === 'function'
    ? pqrsMatrizDriveUpdateExpedienteRow(e, opts).catch(function(err) {
      console.warn('pqrsMatrizDriveUpdateExpedienteRow:', err);
      return { ok: false, error: err };
    })
    : Promise.resolve(null);

  return Promise.all([sheetsP, xlsxP]).then(function(results) {
    const xlsxRes = results[1];
    if (xlsxRes && xlsxRes.noToken && notify && typeof notif === 'function') {
      notif('⚠️ Conecte Gmail (Secretaría o Correos) para actualizar la matriz PQRSD en Drive.', 'warn');
    }
    if (xlsxRes && (xlsxRes.notFound || xlsxRes.noFile) && typeof pqrsMatrizPublicarEnDriveAsync === 'function') {
      return pqrsMatrizPublicarEnDriveAsync({ silent: true, notifyOnError: notify }).then(function(pubRes) {
        if (pubRes && pubRes.noToken && notify && typeof notif === 'function') {
          notif('⚠️ Conecte Gmail (Secretaría o Correos) para actualizar la matriz PQRSD en Drive.', 'warn');
        }
        return pubRes;
      });
    }
    return xlsxRes || results[0];
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
