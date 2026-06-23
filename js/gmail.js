// ================================================================
// Gmail + Drive API — integración bandeja PQRSD (Secretaría)
// OAuth via Google Identity Services (GIS), independiente de Firebase Auth.
// El access_token se guarda en sessionStorage y caduca en 1h.
//
// REQUISITO (configuración única en Google Cloud Console):
//   1. Habilitar Gmail API y Google Drive API en el proyecto Firebase.
//   2. Pantalla de consentimiento OAuth → agregar scopes:
//      gmail.readonly · gmail.send · drive.file
//   3. Agregar usuarios de prueba: cdaguaviare1@gmail.com + correo secretaria.
//   4. Credencial OAuth web → Orígenes autorizados:
//      https://asoredg-pixel.github.io
//   5. Copiar el Client ID OAuth y pegarlo en window._gmailClientId
//      (firebase-init.js o constants.js).
// ================================================================

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

const GMAIL_TOKEN_KEY = 'sst_gmail_token';
const GMAIL_TOKEN_EXP_KEY = 'sst_gmail_token_exp';

let _gmailTokenClient = null;
let _gmailMessages = [];
let _gmailCurrentMsg = null;
let _gmailConnecting = false;
let _gmailNextPageToken = null;
let _gmailFilter = 'all'; // 'all' | 'unread' | 'read'
let _gmailSearchMode = false; // true when showing search results

// ----------------------------------------------------------------
// Token helpers
// ----------------------------------------------------------------
function gmailGetToken() {
  try { return sessionStorage.getItem(GMAIL_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function gmailSetToken(tok, expiresInSec) {
  try {
    if (tok) {
      sessionStorage.setItem(GMAIL_TOKEN_KEY, tok);
      sessionStorage.setItem(GMAIL_TOKEN_EXP_KEY, String(Date.now() + (expiresInSec || 3600) * 1000));
    } else {
      sessionStorage.removeItem(GMAIL_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_TOKEN_EXP_KEY);
    }
  } catch (e) {}
}
function gmailIsTokenValid() {
  const tok = gmailGetToken();
  if (!tok) return false;
  try {
    const exp = parseInt(sessionStorage.getItem(GMAIL_TOKEN_EXP_KEY) || '0', 10);
    return exp > Date.now() + 60000;
  } catch (e) { return !!tok; }
}

// ----------------------------------------------------------------
// OAuth — GIS initTokenClient
// ----------------------------------------------------------------
function gmailConnect(callback) {
  if (_gmailConnecting) return;
  const clientId = (typeof window._gmailClientId !== 'undefined') ? window._gmailClientId : '';
  if (!clientId || clientId.includes('TU_CLIENT_ID')) {
    notif('Falta configurar el Client ID OAuth en firebase-init.js (window._gmailClientId).', 'err');
    return;
  }
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    notif('Google Identity Services no disponible. Verifique su conexión a internet.', 'err');
    return;
  }
  _gmailConnecting = true;
  updateGmailConnectBtn();
  _gmailTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_SCOPES,
    callback: function(response) {
      _gmailConnecting = false;
      if (response.error) {
        console.error('Gmail OAuth error:', response);
        notif('Error al conectar bandeja: ' + (response.error_description || response.error), 'err');
        updateGmailConnectBtn();
        return;
      }
      gmailSetToken(response.access_token, response.expires_in);
      updateGmailConnectBtn();
      notif('Bandeja conectada correctamente.', 'ok');
      if (typeof callback === 'function') callback();
      else gmailLoadInbox();
    }
  });
  _gmailTokenClient.requestAccessToken({ prompt: 'select_account' });
}

function gmailDisconnect() {
  gmailSetToken('');
  _gmailMessages = [];
  _gmailCurrentMsg = null;
  window._gmailPendingMsgId = null;
  window._gmailPendingAttachments = null;
  updateGmailConnectBtn();
  renderGmailInboxList();
  const view = document.getElementById('gmail-msg-view');
  if (view) view.innerHTML = '';
}

// ----------------------------------------------------------------
// Generic API caller
// ----------------------------------------------------------------
async function gmailApiCall(method, url, body) {
  const token = gmailGetToken();
  if (!token) throw new Error('Sin token Gmail. Conecte la bandeja primero.');
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    gmailSetToken('');
    updateGmailConnectBtn();
    throw new Error('Token expirado. Reconecte la bandeja.');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Gmail API ' + res.status + ': ' + txt.slice(0, 200));
  }
  return res.json();
}

// ----------------------------------------------------------------
// Gmail API — inbox
// ----------------------------------------------------------------
async function gmailListMessages(maxResults, pageToken) {
  maxResults = maxResults || 50;
  let url = GMAIL_API_BASE + '/messages?labelIds=INBOX&maxResults=' + maxResults;
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  const data = await gmailApiCall('GET', url);
  _gmailNextPageToken = data.nextPageToken || null;
  const ids = (data.messages || []).map(m => m.id);
  if (!ids.length) return [];
  // Fetch metadata in batches of 10
  const results = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const metas = await Promise.all(batch.map(id =>
      gmailApiCall('GET',
        GMAIL_API_BASE + '/messages/' + id +
        '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date')
    ));
    results.push(...metas);
  }
  return results;
}

async function gmailLoadMore() {
  if (!_gmailNextPageToken) return;
  const listEl = document.getElementById('gmail-inbox-list');
  const moreBtn = document.getElementById('gmail-load-more-btn');
  if (moreBtn) { moreBtn.textContent = 'Cargando…'; moreBtn.disabled = true; }
  try {
    const more = await gmailListMessages(50, _gmailNextPageToken);
    _gmailMessages = _gmailMessages.concat(more);
    renderGmailInboxList();
  } catch (e) {
    notif('Error al cargar más correos: ' + e.message, 'err');
    if (moreBtn) { moreBtn.textContent = 'Cargar más'; moreBtn.disabled = false; }
  }
}

// ----------------------------------------------------------------
// Búsqueda en toda la bandeja (Gmail API q= — busca en TODOS los correos)
// ----------------------------------------------------------------
async function gmailSearch(query) {
  if (!query || !query.trim()) { gmailClearSearch(); return; }
  const listEl = document.getElementById('gmail-inbox-list');
  if (listEl) listEl.innerHTML = '<div class="gmail-loading">Buscando "' + escAttr(query) + '"…</div>';
  _gmailSearchMode = true;
  updateGmailFilterBtns();
  try {
    // q= usa la misma sintaxis que Gmail: subject:, from:, etc.
    const url = GMAIL_API_BASE + '/messages?maxResults=30&q=' + encodeURIComponent(query);
    const data = await gmailApiCall('GET', url);
    const ids = (data.messages || []).map(m => m.id);
    if (!ids.length) {
      if (listEl) listEl.innerHTML = '<div class="gmail-empty">Sin resultados para "' + escAttr(query) + '".</div>';
      return;
    }
    const results = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const metas = await Promise.all(batch.map(id =>
        gmailApiCall('GET', GMAIL_API_BASE + '/messages/' + id +
          '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date')
      ));
      results.push(...metas);
    }
    // Render search results (don't replace _gmailMessages, show separately)
    renderGmailMessageList(results, true);
  } catch (e) {
    console.error('gmailSearch:', e);
    if (listEl) listEl.innerHTML = '<div class="gmail-empty err">' + escAttr(e.message) + '</div>';
  }
}

function gmailClearSearch() {
  _gmailSearchMode = false;
  const inp = document.getElementById('gmail-search-input');
  if (inp) inp.value = '';
  updateGmailFilterBtns();
  renderGmailInboxList();
}

function gmailSetFilter(filter) {
  if (_gmailSearchMode) gmailClearSearch();
  _gmailFilter = filter;
  updateGmailFilterBtns();
  renderGmailInboxList();
}

function updateGmailFilterBtns() {
  ['all', 'unread', 'read'].forEach(function(f) {
    const btn = document.getElementById('gmail-filter-' + f);
    if (!btn) return;
    btn.className = 'btn bsm' + (_gmailFilter === f && !_gmailSearchMode ? ' bp' : '');
  });
  const searchBadge = document.getElementById('gmail-search-badge');
  if (searchBadge) searchBadge.style.display = _gmailSearchMode ? 'inline' : 'none';
}

async function gmailMarkAsRead(messageId) {
  if (!messageId || !gmailIsTokenValid()) return;
  try {
    await gmailApiCall('POST', GMAIL_API_BASE + '/messages/' + messageId + '/modify',
      { removeLabelIds: ['UNREAD'] });
    // Update local state
    const msg = _gmailMessages.find(m => m.id === messageId);
    if (msg && Array.isArray(msg.labelIds)) {
      msg.labelIds = msg.labelIds.filter(l => l !== 'UNREAD');
      renderGmailInboxList();
      updateUnreadCount();
    }
  } catch (e) {
    console.warn('gmailMarkAsRead error:', e.message);
  }
}

async function gmailGetMessage(id) {
  return gmailApiCall('GET', GMAIL_API_BASE + '/messages/' + id + '?format=full');
}

// ----------------------------------------------------------------
// Email parsing helpers
// ----------------------------------------------------------------
function gmailDecodeBase64url(str) {
  if (!str) return '';
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try { return atob(str.replace(/-/g, '+').replace(/_/g, '/')); }
    catch (e2) { return ''; }
  }
}

function gmailGetHeader(headers, name) {
  if (!Array.isArray(headers)) return '';
  const h = headers.find(x => x.name && x.name.toLowerCase() === name.toLowerCase());
  return h ? (h.value || '') : '';
}

function gmailExtractParts(payload) {
  const result = { textHtml: '', textPlain: '', attachments: [] };
  if (!payload) return result;
  function walk(p) {
    if (!p) return;
    const mime = (p.mimeType || '').toLowerCase();
    if (p.filename && p.filename.length > 0 && p.body) {
      result.attachments.push({
        filename: p.filename,
        mimeType: p.mimeType || 'application/octet-stream',
        attachmentId: (p.body.attachmentId || ''),
        size: (p.body.size || 0)
      });
    } else if (mime === 'text/html' && p.body && p.body.data) {
      result.textHtml = gmailDecodeBase64url(p.body.data);
    } else if (mime === 'text/plain' && p.body && p.body.data) {
      result.textPlain = gmailDecodeBase64url(p.body.data);
    }
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  return result;
}

function gmailParseFrom(fromHeader) {
  if (!fromHeader) return { name: '', email: '' };
  const m = fromHeader.match(/^(.*?)\s*<([^>]+)>/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim().toLowerCase() };
  const atIdx = fromHeader.indexOf('@');
  if (atIdx > -1) return { name: '', email: fromHeader.trim().toLowerCase() };
  return { name: fromHeader.trim(), email: '' };
}

function gmailFmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return dateStr; }
}

function gmailMsgHasAttachments(msg) {
  if (!msg || !msg.payload) return false;
  function check(parts) {
    if (!Array.isArray(parts)) return false;
    return parts.some(p => (p.filename && p.filename.length > 0) || check(p.parts));
  }
  return check(msg.payload.parts);
}

// ----------------------------------------------------------------
// Gmail API — attachments
// ----------------------------------------------------------------
async function gmailGetAttachment(messageId, attachmentId) {
  const data = await gmailApiCall('GET',
    GMAIL_API_BASE + '/messages/' + messageId + '/attachments/' + attachmentId);
  return data.data; // base64url encoded
}

// ----------------------------------------------------------------
// Drive API — upload y compartir
// ----------------------------------------------------------------
async function driveUploadFile(filename, mimeType, base64urlData) {
  const token = gmailGetToken();
  if (!token) throw new Error('Sin token Drive');
  const b64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const metadata = { name: filename, mimeType: mimeType };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);
  const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error('Drive upload ' + uploadRes.status + ': ' + txt.slice(0, 120));
  }
  const file = await uploadRes.json();
  // Make publicly readable (anyone with the link)
  await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });
  return {
    fileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    nombre: filename
  };
}

async function subirAdjuntosEmailADrive(msg) {
  const parts = gmailExtractParts(msg.payload);
  const results = [];
  for (const att of parts.attachments) {
    if (!att.attachmentId) continue;
    try {
      const data = await gmailGetAttachment(msg.id, att.attachmentId);
      const file = await driveUploadFile(att.filename, att.mimeType, data);
      results.push(file);
    } catch (e) {
      console.error('Error subiendo adjunto:', att.filename, e);
      notif('Error al subir "' + att.filename + '": ' + e.message, 'err');
    }
  }
  return results;
}

// ----------------------------------------------------------------
// Gmail API — enviar correos (RFC 2822 en base64url)
// ----------------------------------------------------------------
function _buildMimeEmail(to, subject, htmlBody) {
  const subjectEncoded = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const bodyB64 = btoa(unescape(encodeURIComponent(htmlBody)));
  const boundary = 'sst_' + Date.now();
  const lines = [
    'MIME-Version: 1.0',
    'To: ' + to,
    'Subject: ' + subjectEncoded,
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    htmlBody.replace(/<[^>]+>/g, '').slice(0, 500),
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
    '',
    '--' + boundary + '--'
  ].join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(lines)));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function gmailSend(to, subject, htmlBody, threadId) {
  const raw = _buildMimeEmail(to, subject, htmlBody);
  const body = { raw };
  if (threadId) body.threadId = threadId;
  return gmailApiCall('POST', GMAIL_API_BASE + '/messages/send', body);
}

async function reenviarEmailAOficina(msg, ofiId) {
  const ofiData = (encargadosGlobal && encargadosGlobal.oficinas && encargadosGlobal.oficinas[ofiId]) || {};
  const ofiEmail = (ofiData.email || '').trim();
  if (!ofiEmail) {
    notif('La oficina ' + (typeof labelOficina === 'function' ? labelOficina(ofiId) : ofiId) + ' no tiene correo configurado en Encargados.', 'warn');
    return false;
  }
  const headers = (msg.payload && msg.payload.headers) || [];
  const fromHeader = gmailGetHeader(headers, 'from');
  const subject = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
  const date = gmailGetHeader(headers, 'date') || '';
  const parts = gmailExtractParts(msg.payload);
  const originalBody = parts.textHtml || '<pre>' + escAttr(parts.textPlain || '') + '</pre>';
  const htmlBody =
    '<p><strong>Mensaje reenviado desde Secretaría DEGUV</strong></p>' +
    '<table style="font-size:12px;color:#555;border-collapse:collapse">' +
    '<tr><td style="padding:2px 8px 2px 0"><strong>De:</strong></td><td>' + escAttr(fromHeader) + '</td></tr>' +
    '<tr><td style="padding:2px 8px 2px 0"><strong>Fecha:</strong></td><td>' + escAttr(gmailFmtDate(date)) + '</td></tr>' +
    '<tr><td style="padding:2px 8px 2px 0"><strong>Asunto:</strong></td><td>' + escAttr(subject) + '</td></tr>' +
    '</table><hr>' +
    originalBody;
  try {
    await gmailSend(ofiEmail, 'Fwd: ' + subject, htmlBody, msg.threadId);
    notif('Correo reenviado a ' + (typeof labelOficina === 'function' ? labelOficina(ofiId) : ofiId) + ' (' + ofiEmail + ')', 'ok');
    return true;
  } catch (e) {
    console.error('reenviarEmailAOficina:', e);
    notif('Error al reenviar: ' + e.message, 'err');
    return false;
  }
}

async function enviarRespuestaCiudadano(e) {
  const ciudadanoEmail = (e._qd_correo || e._pn_correo || '').trim();
  if (!ciudadanoEmail) { notif('El expediente no tiene correo del ciudadano', 'err'); return false; }
  const links = [];
  if (e._pqrs_respuesta_link) links.push(e._pqrs_respuesta_link);
  if (Array.isArray(e._pqrs_respuesta_links)) {
    e._pqrs_respuesta_links.forEach(l => { if (l && !links.includes(l)) links.push(l); });
  }
  const linksHtml = links.length
    ? '<ul>' + links.map(l => '<li><a href="' + l + '">' + escAttr(l) + '</a></li>').join('') + '</ul>'
    : '<p><em>(Sin documentos adjuntos)</em></p>';
  const nota = e._pqrs_respuesta_nota ? '<p>' + escAttr(e._pqrs_respuesta_nota) + '</p>' : '';
  const oficio = e._pqrs_respuesta_oficio ? '<p>N° oficio: <strong>' + escAttr(e._pqrs_respuesta_oficio) + '</strong></p>' : '';
  const htmlBody =
    '<p>Estimado/a <strong>' + escAttr(e._qd_nombre || e._pn_nombre || 'ciudadano/a') + '</strong>,</p>' +
    '<p>Su solicitud <strong>' + escAttr(e._exp || '') + '</strong>' +
    (e.f_f1 ? ' — ' + escAttr(e.f_f1) : '') + ' ha sido atendida.</p>' +
    oficio + nota +
    '<p><strong>Documentos de respuesta:</strong></p>' + linksHtml +
    '<hr><p style="font-size:11px;color:#888">Mensaje enviado desde el Sistema de Seguimiento de Trámites — ' +
    'CDA Delegación Guaviare. No responda directamente a este correo.</p>';
  try {
    await gmailSend(ciudadanoEmail, 'Respuesta PQRSD N° ' + (e._exp || ''), htmlBody);
    notif('Respuesta enviada por correo a ' + ciudadanoEmail, 'ok');
    return true;
  } catch (err) {
    console.error('enviarRespuestaCiudadano:', err);
    notif('Error al enviar correo: ' + err.message, 'err');
    return false;
  }
}

function confirmarEnvioRespuestaEmailPqrs(e) {
  if (!e) return;
  const ciudadanoEmail = (e._qd_correo || e._pn_correo || '').trim();
  if (!ciudadanoEmail) return;
  if (!gmailIsTokenValid()) return;
  if (typeof confirmPrecaucion === 'function') {
    confirmPrecaucion({
      title: 'Enviar respuesta por correo',
      message: '¿Desea enviar un correo de respuesta al ciudadano?',
      detail: ciudadanoEmail,
      confirmLabel: 'Sí, enviar correo'
    }, function() { enviarRespuestaCiudadano(e); });
  } else if (window.confirm('¿Enviar respuesta por correo a ' + ciudadanoEmail + '?')) {
    enviarRespuestaCiudadano(e);
  }
}

// ----------------------------------------------------------------
// UI — Gmail panel
// ----------------------------------------------------------------
function updateUnreadCount() {
  const badge = document.getElementById('gmail-unread-count');
  if (!badge) return;
  const n = _gmailMessages.filter(m => Array.isArray(m.labelIds) && m.labelIds.includes('UNREAD')).length;
  badge.textContent = n > 0 ? n : '';
  badge.style.display = n > 0 ? 'inline' : 'none';
}

function updateGmailConnectBtn() {
  const btn = document.getElementById('gmail-connect-btn');
  const status = document.getElementById('gmail-connect-status');
  const refreshBtn = document.getElementById('gmail-refresh-btn');
  if (btn) {
    if (_gmailConnecting) {
      btn.textContent = 'Conectando…';
      btn.disabled = true;
    } else if (gmailIsTokenValid()) {
      btn.textContent = 'Reconectar';
      btn.disabled = false;
      if (status) status.textContent = '✅ Conectado — cdaguaviare1@gmail.com';
    } else {
      btn.textContent = 'Conectar bandeja';
      btn.disabled = false;
      if (status) status.textContent = '';
    }
  }
  if (refreshBtn) refreshBtn.disabled = !gmailIsTokenValid();
}

function toggleGmailPanel() {
  const body = document.getElementById('gmail-panel-body');
  const btn = document.getElementById('gmail-toggle-btn');
  if (!body) return;
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : '';
  if (btn) btn.textContent = visible ? 'Ver bandeja' : 'Ocultar bandeja';
  if (!visible && gmailIsTokenValid() && !_gmailMessages.length) gmailLoadInbox();
}

async function gmailLoadInbox() {
  const listEl = document.getElementById('gmail-inbox-list');
  if (!listEl) return;
  if (!gmailIsTokenValid()) {
    listEl.innerHTML = '<div class="gmail-empty">Conecte la bandeja para ver los correos.</div>';
    return;
  }
  listEl.innerHTML = '<div class="gmail-loading">Cargando correos…</div>';
  _gmailNextPageToken = null;
  _gmailFilter = 'all';
  _gmailSearchMode = false;
  try {
    _gmailMessages = await gmailListMessages(50);
    renderGmailInboxList();
    updateUnreadCount();
  } catch (e) {
    console.error('gmailLoadInbox:', e);
    listEl.innerHTML = '<div class="gmail-empty err">' + escAttr(e.message) + '</div>';
    if (e.message.includes('Token expirado') || e.message.includes('Sin token')) {
      gmailSetToken('');
      updateGmailConnectBtn();
    }
  }
}

function renderGmailInboxList() {
  if (_gmailSearchMode) return; // Don't overwrite search results
  const msgs = _gmailFilter === 'unread'
    ? _gmailMessages.filter(m => Array.isArray(m.labelIds) && m.labelIds.includes('UNREAD'))
    : _gmailFilter === 'read'
      ? _gmailMessages.filter(m => !Array.isArray(m.labelIds) || !m.labelIds.includes('UNREAD'))
      : _gmailMessages;
  renderGmailMessageList(msgs, false);
}

function renderGmailMessageList(msgs, isSearch) {
  const listEl = document.getElementById('gmail-inbox-list');
  if (!listEl) return;
  if (!msgs.length) {
    const label = _gmailFilter === 'unread' ? 'sin radicar' : _gmailFilter === 'read' ? 'radicados' : 'recientes';
    listEl.innerHTML = '<div class="gmail-empty">No hay correos ' + (isSearch ? 'para esa búsqueda' : label) + '.</div>';
    return;
  }
  const rows = msgs.map(function(msg) {
    const headers = (msg.payload && msg.payload.headers) || [];
    const from = gmailParseFrom(gmailGetHeader(headers, 'from'));
    const subject = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
    const date = gmailGetHeader(headers, 'date') || '';
    const hasAtt = gmailMsgHasAttachments(msg);
    const unread = Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD');
    const activeClass = (_gmailCurrentMsg && _gmailCurrentMsg.id === msg.id) ? ' active' : '';
    return '<div class="gmail-row' + (unread ? ' unread' : '') + activeClass + '" ' +
      'onclick="gmailOpenMessage(\'' + escAttr(msg.id) + '\')" ' +
      'title="' + escAttr(subject) + '">' +
      '<div class="gmail-row-from">' + escAttr((from.name || from.email || 'Desconocido').slice(0, 28)) +
        (unread ? '<span class="gmail-badge-new">N</span>' : '') +
        (hasAtt ? '<span class="gmail-att-icon">📎</span>' : '') +
      '</div>' +
      '<div class="gmail-row-subject">' + escAttr(subject.slice(0, 60)) + '</div>' +
      '<div class="gmail-row-date">' + escAttr(gmailFmtDate(date)) + '</div>' +
      '</div>';
  }).join('');
  const footer = isSearch
    ? '<div style="padding:6px;text-align:center;font-size:11px;color:var(--tx3)">' + msgs.length + ' resultado(s) — <button class="btn bsm" onclick="gmailClearSearch()">← Volver a bandeja</button></div>'
    : _gmailNextPageToken
      ? '<div style="padding:8px;text-align:center"><button id="gmail-load-more-btn" class="btn bsm" onclick="gmailLoadMore()">Cargar 50 más (' + _gmailMessages.length + ' cargados)</button></div>'
      : '<div style="padding:6px;text-align:center;font-size:11px;color:var(--tx3)">— ' + _gmailMessages.length + ' correos cargados —</div>';
  listEl.innerHTML = rows + footer;
}

async function gmailOpenMessage(id) {
  const viewEl = document.getElementById('gmail-msg-view');
  if (!viewEl) return;
  viewEl.innerHTML = '<div class="gmail-loading">Cargando correo…</div>';
  try {
    const msg = await gmailGetMessage(id);
    _gmailCurrentMsg = msg;
    renderGmailMessageView(msg);
    renderGmailInboxList(); // refresh to show active state
  } catch (e) {
    console.error('gmailOpenMessage:', e);
    viewEl.innerHTML = '<div class="gmail-empty err">' + escAttr(e.message) + '</div>';
  }
}

function renderGmailMessageView(msg) {
  const viewEl = document.getElementById('gmail-msg-view');
  if (!viewEl || !msg) return;
  const headers = (msg.payload && msg.payload.headers) || [];
  const from = gmailParseFrom(gmailGetHeader(headers, 'from'));
  const subject = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
  const date = gmailGetHeader(headers, 'date') || '';
  const parts = gmailExtractParts(msg.payload);
  const atts = parts.attachments;
  // Sanitize body HTML with DOMPurify (already loaded in the app)
  const rawBody = parts.textHtml || ('<pre style="white-space:pre-wrap;font-size:13px">' + escAttr(parts.textPlain || '(sin cuerpo)') + '</pre>');
  const safeBody = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawBody, { USE_PROFILES: { html: true } }) : rawBody;
  const attsHtml = atts.length
    ? '<div class="gmail-atts-bar">' +
      '<span style="font-weight:600;font-size:12px">Adjuntos (' + atts.length + '):</span> ' +
      atts.map(a => '<span class="gmail-att-chip">📎 ' + escAttr(a.filename) + ' <em>(' + (a.size > 1024 ? Math.round(a.size / 1024) + ' KB' : a.size + ' B') + ')</em></span>').join('') +
      '</div>'
    : '';
  viewEl.innerHTML =
    '<div class="gmail-msg-header">' +
    '<div class="gmail-msg-subject">' + escAttr(subject) + '</div>' +
    '<div class="gmail-msg-meta">' +
      '<span>De: <strong>' + escAttr(from.name || from.email || 'Desconocido') + '</strong>' +
        (from.email && from.name ? ' &lt;' + escAttr(from.email) + '&gt;' : '') + '</span>' +
      '<span>' + escAttr(gmailFmtDate(date)) + '</span>' +
    '</div>' +
    '</div>' +
    '<div class="gmail-msg-actions">' +
    '<button class="btn bp bsm" onclick="gmailPreRadicarPqrs()" title="Pre-llenar el formulario PQRSD con datos de este correo">📤 Radicar desde este correo</button>' +
    (atts.length
      ? '<button class="btn bsm" id="gmail-upload-atts-btn" onclick="gmailSubirAdjuntosYVincular()" title="Subir adjuntos a Google Drive y vincularlos al expediente">📎 Subir ' + atts.length + ' adjunto(s) a Drive</button>'
      : '') +
    '</div>' +
    attsHtml +
    '<div class="gmail-msg-body">' + safeBody + '</div>';
}

// ----------------------------------------------------------------
// Sprint B — pre-popular formulario PQRSD desde email
// ----------------------------------------------------------------
function prePopularFormDesdeEmail(msg) {
  if (!msg) return;
  const headers = (msg.payload && msg.payload.headers) || [];
  const from = gmailParseFrom(gmailGetHeader(headers, 'from'));
  const subject = gmailGetHeader(headers, 'subject') || '';
  const parts = gmailExtractParts(msg.payload);
  const snippet = msg.snippet || parts.textPlain.slice(0, 300) || '';

  // Switch to natural person
  const tipoEl = document.getElementById('sec-tipo-persona');
  if (tipoEl) {
    tipoEl.value = 'natural';
    if (typeof toggleSecPersona === 'function') toggleSecPersona();
  }
  // Set medio recepción → Correo
  const medioEl = document.getElementById('sec-medio');
  if (medioEl) {
    medioEl.value = 'Correo';
    if (typeof onSecMedioRecepcionChange === 'function') onSecMedioRecepcionChange();
  }
  const setv = function(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  setv('sec-pn-nombre', from.name || '');
  setv('sec-pn-correo', from.email || '');
  setv('sec-asunto', subject);
  if (snippet) setv('sec-detalle', snippet.slice(0, 300));

  // Store message ID for saving with the expediente
  window._gmailPendingMsgId = msg.id;
  window._gmailPendingAttachments = window._gmailPendingAttachments || null;
}

function gmailPreRadicarPqrs() {
  if (!_gmailCurrentMsg) return;
  prePopularFormDesdeEmail(_gmailCurrentMsg);
  // Cerrar el panel Gmail para que el formulario quede visible y limpio
  const body = document.getElementById('gmail-panel-body');
  const btn = document.getElementById('gmail-toggle-btn');
  if (body) body.style.display = 'none';
  if (btn) btn.textContent = 'Ver bandeja';
  // Scroll al formulario de radicación
  const formCard = document.querySelector('#pg-sec .card:not(.gmail-panel-wrap)');
  if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  notif('Formulario pre-llenado. Revise los datos, complete la oficina destino y radique.', 'ok');
}

// ----------------------------------------------------------------
// Sprint C — subir adjuntos a Drive y vincular al formulario
// ----------------------------------------------------------------
async function gmailSubirAdjuntosYVincular() {
  if (!_gmailCurrentMsg) return;
  const btn = document.getElementById('gmail-upload-atts-btn');
  if (btn) { btn.textContent = '⏳ Subiendo…'; btn.disabled = true; }
  try {
    const files = await subirAdjuntosEmailADrive(_gmailCurrentMsg);
    if (files.length) {
      window._gmailPendingAttachments = files;
      window._gmailPendingMsgId = _gmailCurrentMsg.id;
      // Populate Drive link field with the first attachment
      const linkEl = document.getElementById('sec-link');
      if (linkEl) linkEl.value = files[0].driveLink;
      if (btn) btn.textContent = '✅ ' + files.length + ' adjunto(s) en Drive';
      notif(files.length + ' adjunto(s) subidos a Drive y vinculados al formulario', 'ok');
    } else {
      if (btn) { btn.textContent = '📎 Subir adjuntos a Drive'; btn.disabled = false; }
    }
  } catch (e) {
    console.error('gmailSubirAdjuntosYVincular:', e);
    notif('Error al subir adjuntos: ' + e.message, 'err');
    if (btn) { btn.textContent = '📎 Subir adjuntos a Drive'; btn.disabled = false; }
  }
}
