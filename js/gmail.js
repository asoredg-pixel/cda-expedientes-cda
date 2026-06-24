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
  'https://www.googleapis.com/auth/gmail.modify',  // read + modify labels/messages (not delete)
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
let _gmailRadicadoLabelId = ''; // ID of the "RAD APP" custom label, loaded on connect
const GMAIL_RADICADO_LABEL = 'RAD APP'; // Nombre de la etiqueta Gmail para correos radicados en la app

// ----------------------------------------------------------------
// Token helpers
// ----------------------------------------------------------------
function gmailGetToken() {
  try { return sessionStorage.getItem(GMAIL_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
let _gmailTokenWarnTimer = null;
function gmailSetToken(tok, expiresInSec) {
  try {
    if (tok) {
      sessionStorage.setItem(GMAIL_TOKEN_KEY, tok);
      const expMs = Date.now() + (expiresInSec || 3600) * 1000;
      sessionStorage.setItem(GMAIL_TOKEN_EXP_KEY, String(expMs));
      _gmailScheduleTokenWarning(expMs);
    } else {
      sessionStorage.removeItem(GMAIL_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_TOKEN_EXP_KEY);
      if (_gmailTokenWarnTimer) { clearTimeout(_gmailTokenWarnTimer); _gmailTokenWarnTimer = null; }
    }
  } catch (e) {}
}
function _gmailScheduleTokenWarning(expMs) {
  if (_gmailTokenWarnTimer) clearTimeout(_gmailTokenWarnTimer);
  const warn50 = expMs - Date.now() - 600000; // 10 min antes de expirar (50 min después de conectar)
  const warn2  = expMs - Date.now() - 120000; // 2 min antes de expirar (aviso crítico)
  if (warn50 > 0) {
    _gmailTokenWarnTimer = setTimeout(function() {
      if (gmailIsTokenValid()) {
        notif('⏰ El permiso de Gmail expira en ~10 minutos. Reconecte la bandeja para evitar interrupciones al radicar.', 'warn');
        // Schedule critical warning
        _gmailTokenWarnTimer = setTimeout(function() {
          if (gmailIsTokenValid()) {
            notif('⚠️ El permiso de Gmail expira en ~2 minutos. Reconecte la bandeja YA para no perder la carga automática de adjuntos.', 'err');
          }
        }, warn2 > 0 ? warn2 - warn50 : 0);
      }
    }, warn50);
  } else if (warn2 > 0) {
    _gmailTokenWarnTimer = setTimeout(function() {
      if (gmailIsTokenValid()) notif('⚠️ El permiso de Gmail expira en ~2 minutos. Reconecte la bandeja.', 'err');
    }, warn2);
  }
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
  window._gmailPendingEmailData = null;
  _gmailRadicadoLabelId = '';
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
    notif('⚠️ La sesión de Gmail expiró. Haga clic en Reconectar para continuar.', 'err');
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
  query = (query || '').trim();
  if (!query) { gmailClearSearch(); return; }
  if (!gmailIsTokenValid()) { notif('Reconecte la bandeja antes de buscar.', 'err'); return; }
  const listEl = document.getElementById('gmail-inbox-list');
  if (listEl) listEl.innerHTML = '<div class="gmail-loading">Buscando "' + escAttr(query) + '"…</div>';
  _gmailSearchMode = true;
  updateGmailFilterBtns();
  try {
    // Restringe la búsqueda a la bandeja de entrada (in:inbox)
    const q = 'in:inbox ' + query;
    const url = GMAIL_API_BASE + '/messages?maxResults=30&q=' + encodeURIComponent(q);
    const data = await gmailApiCall('GET', url);
    const ids = (data.messages || []).map(function(m) { return m.id; });
    if (!ids.length) {
      if (listEl) listEl.innerHTML = '<div class="gmail-empty">Sin resultados para "' + escAttr(query) + '".</div>';
      return;
    }
    const results = [];
    for (var i = 0; i < ids.length; i += 10) {
      var batch = ids.slice(i, i + 10);
      var metas = await Promise.all(batch.map(function(id) {
        return gmailApiCall('GET', GMAIL_API_BASE + '/messages/' + id +
          '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date');
      }));
      results.push.apply(results, metas);
    }
    renderGmailMessageList(results, true);
  } catch (e) {
    _gmailSearchMode = false;
    updateGmailFilterBtns();
    console.error('gmailSearch:', e);
    if (listEl) listEl.innerHTML = '<div class="gmail-empty err">Error al buscar: ' + escAttr(e.message) + '</div>';
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
    btn.className = (_gmailFilter === f && !_gmailSearchMode) ? 'btn bp bsm' : 'btn bsm';
  });
  const searchBadge = document.getElementById('gmail-search-badge');
  if (searchBadge) searchBadge.style.display = _gmailSearchMode ? 'inline' : 'none';
  const clearBtn = document.getElementById('gmail-clear-search-btn');
  if (clearBtn) clearBtn.style.display = _gmailSearchMode ? 'inline-flex' : 'none';
}

// Obtiene o crea la etiqueta "RAD APP" (o cualquier nombre) en Gmail; cachea el ID en sessionStorage
async function gmailGetOrCreateLabel(labelName) {
  const cacheKey = 'sst_gmail_label_' + labelName.replace(/\s/g, '_');
  try { const c = sessionStorage.getItem(cacheKey); if (c) return c; } catch (e) {}
  const token = gmailGetToken();
  // Listar etiquetas existentes
  const list = await fetch(GMAIL_API_BASE + '/labels', { headers: { 'Authorization': 'Bearer ' + token } });
  const listData = await list.json();
  const existing = (listData.labels || []).find(function(l) { return l.name === labelName; });
  if (existing) {
    try { sessionStorage.setItem(cacheKey, existing.id); } catch (e) {}
    return existing.id;
  }
  // Crear etiqueta nueva
  const createRes = await fetch(GMAIL_API_BASE + '/labels', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
  });
  const label = await createRes.json();
  try { sessionStorage.setItem(cacheKey, label.id); } catch (e) {}
  return label.id;
}

async function gmailMarkAsRead(messageId) {
  if (!messageId || !gmailIsTokenValid()) return;
  try {
    // Use cached label ID or fetch it
    if (!_gmailRadicadoLabelId) {
      try { _gmailRadicadoLabelId = await gmailGetOrCreateLabel(GMAIL_RADICADO_LABEL); } catch(e) { console.warn('Label get:', e.message); }
    }
    var modify = { removeLabelIds: ['UNREAD'] };
    if (_gmailRadicadoLabelId) modify.addLabelIds = [_gmailRadicadoLabelId];
    await gmailApiCall('POST', GMAIL_API_BASE + '/messages/' + messageId + '/modify', modify);
    // Actualizar estado local
    const msg = _gmailMessages.find(function(m) { return m.id === messageId; });
    if (msg) {
      if (!Array.isArray(msg.labelIds)) msg.labelIds = [];
      msg.labelIds = msg.labelIds.filter(function(l) { return l !== 'UNREAD'; });
      if (_gmailRadicadoLabelId && !msg.labelIds.includes(_gmailRadicadoLabelId)) msg.labelIds.push(_gmailRadicadoLabelId);
      renderGmailInboxList();
      updateUnreadCount();
    }
  } catch (e) {
    console.warn('gmailMarkAsRead error:', e.message);
    // Detect scope/permission error and prompt reconnection
    if (e.message && (e.message.includes('403') || e.message.toLowerCase().includes('scope'))) {
      notif('⚠️ Sin permiso para etiquetar en Gmail. Haga clic en Reconectar para actualizar permisos.', 'warn');
      gmailSetToken('');
      updateGmailConnectBtn();
    }
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

var _gmailAttViewerUrl = ''; // blob URL actual para liberar al cerrar

function gmailCloseAttViewer() {
  var panel = document.getElementById('gmail-att-viewer');
  if (panel) panel.classList.remove('open');
  if (_gmailAttViewerUrl) { URL.revokeObjectURL(_gmailAttViewerUrl); _gmailAttViewerUrl = ''; }
  var body = document.getElementById('gmail-att-viewer-body');
  if (body) body.innerHTML = '';
}

// ----------------------------------------------------------------
// Helpers — detección y visualización de archivos Office
// ----------------------------------------------------------------
function _gmailIsOfficeFile(filename, mime) {
  var ext = (filename || '').toLowerCase().split('.').pop();
  var officeExts = ['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp'];
  var officeMimes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
  ];
  return officeExts.includes(ext) || officeMimes.includes(mime || '');
}
function _gmailOfficeLoadingHtml(filename, dlUrl) {
  return '<div style="padding:24px;text-align:center;color:var(--tx2);display:flex;flex-direction:column;align-items:center;gap:10px;height:100%;justify-content:center">' +
    '<div style="font-size:36px">📄</div>' +
    '<div style="font-weight:600">' + escAttr(filename) + '</div>' +
    '<div style="font-size:12px">Subiendo a Drive para previsualizar…</div>' +
    '<div class="gmail-loading" style="margin-top:4px"></div>' +
    '<a href="' + escAttr(dlUrl) + '" download="' + escAttr(filename) + '" class="btn bsm" style="margin-top:8px">⬇ Descargar mientras espera</a>' +
    '</div>';
}
function _gmailOfficeDownloadHtml(filename, dlUrl) {
  return '<div style="padding:24px;text-align:center;color:var(--tx2);display:flex;flex-direction:column;align-items:center;gap:10px;height:100%;justify-content:center">' +
    '<div style="font-size:36px">📄</div>' +
    '<div style="font-weight:600">' + escAttr(filename) + '</div>' +
    '<div style="font-size:12px">No se pudo generar la previsualización. Descargue el archivo para abrirlo.</div>' +
    '<a href="' + escAttr(dlUrl) + '" download="' + escAttr(filename) + '" class="btn bp bsm" style="margin-top:8px">⬇ Descargar</a>' +
    '</div>';
}

// Abre un adjunto en el panel lateral (PDF en iframe, imágenes inline, resto en nueva pestaña)
async function gmailViewAttachment(msgId, attId, filename, mimeType) {
  if (!gmailIsTokenValid()) { notif('Reconecte la bandeja para ver adjuntos', 'err'); return; }
  var chipEl = document.getElementById('att-chip-' + attId);
  var origContent = chipEl ? chipEl.innerHTML : '';
  if (chipEl) { chipEl.innerHTML = '⏳ Cargando…'; chipEl.style.opacity = '0.6'; }
  try {
    var b64url = await gmailGetAttachment(msgId, attId);
    var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var mime = mimeType || 'application/octet-stream';
    var blob = new Blob([bytes], { type: mime });
    if (_gmailAttViewerUrl) URL.revokeObjectURL(_gmailAttViewerUrl);
    _gmailAttViewerUrl = URL.createObjectURL(blob);

    // Actualizar panel lateral
    var title = document.getElementById('gmail-att-viewer-title');
    if (title) title.textContent = filename;
    var dlLink = document.getElementById('gmail-att-viewer-dl');
    if (dlLink) { dlLink.href = _gmailAttViewerUrl; dlLink.download = filename; dlLink.style.display = 'inline-flex'; }
    var viewBody = document.getElementById('gmail-att-viewer-body');
    if (viewBody) {
      var isImg = mime.startsWith('image/');
      var isPdf = mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        viewBody.innerHTML = '<iframe src="' + escAttr(_gmailAttViewerUrl) + '" style="flex:1;width:100%;border:none;height:100%" title="' + escAttr(filename) + '"></iframe>';
      } else if (isImg) {
        viewBody.innerHTML = '<div style="overflow:auto;padding:16px;display:flex;justify-content:center;align-items:flex-start;height:100%"><img src="' + escAttr(_gmailAttViewerUrl) + '" alt="' + escAttr(filename) + '" style="max-width:100%;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.2)"></div>';
      } else if (_gmailIsOfficeFile(filename, mime)) {
        // Office: subir a Drive y mostrar en visor de Google Docs
        viewBody.innerHTML = _gmailOfficeLoadingHtml(filename, _gmailAttViewerUrl);
        var panel = document.getElementById('gmail-att-viewer');
        if (panel) panel.classList.add('open');
        try {
          var driveFileFs = await driveUploadFile(filename, mime, b64url);
          if (driveFileFs && driveFileFs.id) {
            var viewUrlFs = 'https://drive.google.com/file/d/' + driveFileFs.id + '/preview';
            viewBody.innerHTML = '<iframe src="' + escAttr(viewUrlFs) + '" style="flex:1;width:100%;border:none;height:100%" title="' + escAttr(filename) + '" allow="autoplay"></iframe>';
          } else { throw new Error('Sin ID'); }
        } catch (offErrFs) {
          viewBody.innerHTML = _gmailOfficeDownloadHtml(filename, _gmailAttViewerUrl);
        }
        return;
      } else {
        // Tipo no previsualizable: ofrecer descarga
        viewBody.innerHTML = '<div style="padding:24px;text-align:center;color:var(--tx2)"><div style="font-size:40px;margin-bottom:12px">📎</div><div style="font-weight:600;margin-bottom:8px">' + escAttr(filename) + '</div><div style="font-size:12px;margin-bottom:16px">Este tipo de archivo no puede previsualizarse directamente.</div><a href="' + escAttr(_gmailAttViewerUrl) + '" download="' + escAttr(filename) + '" class="btn bp bsm">⬇ Descargar</a></div>';
      }
    }
    var panel = document.getElementById('gmail-att-viewer');
    if (panel) panel.classList.add('open');
  } catch (e) {
    notif('Error al abrir adjunto: ' + e.message, 'err');
  } finally {
    if (chipEl) { chipEl.innerHTML = origContent; chipEl.style.opacity = ''; }
  }
}

// ----------------------------------------------------------------
// Drive API — upload y compartir
// ----------------------------------------------------------------
async function getOrCreateDriveFolder(folderName) {
  // Cache folder ID in sessionStorage to avoid repeated searches
  const cacheKey = 'sst_drive_folder_' + folderName.replace(/\s/g, '_');
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (e) {}
  const token = gmailGetToken();
  const searchUrl = DRIVE_API_BASE + '/files?q=' +
    encodeURIComponent('name="' + folderName + '" and mimeType="application/vnd.google-apps.folder" and trashed=false') +
    '&fields=files(id,name)';
  const searchRes = await fetch(searchUrl, { headers: { 'Authorization': 'Bearer ' + token } });
  const searchData = await searchRes.json();
  let folderId;
  if (searchData.files && searchData.files.length > 0) {
    folderId = searchData.files[0].id;
  } else {
    const createRes = await fetch(DRIVE_API_BASE + '/files', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
    });
    const folder = await createRes.json();
    folderId = folder.id;
  }
  try { sessionStorage.setItem(cacheKey, folderId); } catch (e) {}
  return folderId;
}

async function driveUploadFile(filename, mimeType, base64urlData) {
  const token = gmailGetToken();
  if (!token) throw new Error('Sin token Drive');
  // Get or create destination folder
  let folderId = '';
  try { folderId = await getOrCreateDriveFolder('PQRSD - Adjuntos CDA'); } catch (e) { console.warn('Drive folder:', e.message); }
  const b64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const metadata = { name: filename, mimeType: mimeType };
  if (folderId) metadata.parents = [folderId];
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);
  const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(function() { return ''; });
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

// Auto-upload adjuntos al radicar desde correo si aún no se han subido.
// Llamada desde pqrs.js antes de guardar el expediente.
async function gmailAutoUploadPendingAttachments() {
  if (!window._gmailPendingMsgId) return;           // no viene de Gmail
  if (window._gmailPendingAttachments && window._gmailPendingAttachments.length) return; // ya subidos
  const ed = window._gmailPendingEmailData;
  if (!ed || !Array.isArray(ed.adjuntosInfo) || !ed.adjuntosInfo.length) return; // sin adjuntos
  if (!_gmailCurrentMsg || _gmailCurrentMsg.id !== window._gmailPendingMsgId) return; // sin msg en memoria
  if (!gmailIsTokenValid()) {
    notif('⚠️ La sesión de Gmail expiró. Los adjuntos NO se vincularán a este PQRSD. Reconecte la bandeja y vuelva a radicar.', 'err');
    return;
  }
  try {
    notif('📎 Subiendo adjuntos a Drive…', 'info');
    const files = await subirAdjuntosEmailADrive(_gmailCurrentMsg);
    if (files && files.length) {
      window._gmailPendingAttachments = files;
      notif('✅ ' + files.length + ' adjunto(s) subido(s) a Drive automáticamente', 'ok');
    }
  } catch (e) {
    console.warn('gmailAutoUploadPendingAttachments:', e.message);
  }
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

async function reenviarEmailAOficina(msg, ofiId, expId) {
  const ofiData = (encargadosGlobal && encargadosGlobal.oficinas && encargadosGlobal.oficinas[ofiId]) || {};
  const ofiEmail = (ofiData.email || '').trim();
  const ofiLabel = typeof labelOficina === 'function' ? labelOficina(ofiId) : ofiId;
  if (!ofiEmail) {
    notif('La oficina ' + ofiLabel + ' no tiene correo configurado en Encargados.', 'warn');
    return false;
  }
  try {
    // Obtener el correo en formato raw (incluye todos los adjuntos tal como llegaron)
    const rawData = await gmailApiCall('GET', GMAIL_API_BASE + '/messages/' + msg.id + '?format=raw');
    if (!rawData || !rawData.raw) throw new Error('No se pudo obtener el correo original');

    // Decodificar base64url → bytes → texto
    const b64std = rawData.raw.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(b64std);
    const bytes = new Uint8Array(binaryStr.length);
    for (var bi = 0; bi < binaryStr.length; bi++) bytes[bi] = binaryStr.charCodeAt(bi);
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

    // Localizar separador cabecera/cuerpo
    var sep = '\r\n\r\n';
    var headerEnd = rawText.indexOf(sep);
    if (headerEnd === -1) { sep = '\n\n'; headerEnd = rawText.indexOf(sep); }
    if (headerEnd === -1) throw new Error('Estructura del correo no reconocida');

    var lb = sep === '\r\n\r\n' ? '\r\n' : '\n';
    var origHeaders = rawText.substring(0, headerEnd);
    var body = rawText.substring(headerEnd + sep.length);

    // Reconstruir cabeceras: eliminar To/Cc/Bcc, añadir nuevo To, poner prefijo en Subject
    var headerLines = origHeaders.split(lb);
    var newHeaderLines = [];
    var hi = 0;
    while (hi < headerLines.length) {
      var hline = headerLines[hi];
      if (/^(To|Cc|Bcc):/i.test(hline)) {
        hi++;
        while (hi < headerLines.length && /^[ \t]/.test(headerLines[hi])) hi++;
        continue;
      }
      if (/^Subject:/i.test(hline)) {
        var origSubj = hline.replace(/^Subject:\s*/i, '');
        // Quitar prefijos FWD anteriores para no acumularlos
        var cleanSubj = origSubj.replace(/^(\s*(Fwd?|Re):\s*(\[PQRSD[^\]]*\]\s*:?\s*)?)+/i, '');
        var expTag = expId ? '[PQRSD #' + expId + '] ' : '';
        newHeaderLines.push('Subject: Fwd: ' + expTag + cleanSubj);
        hi++;
        while (hi < headerLines.length && /^[ \t]/.test(headerLines[hi])) hi++;
        continue;
      }
      newHeaderLines.push(hline);
      hi++;
    }
    // To va primero
    newHeaderLines.unshift('To: ' + ofiEmail);

    // Reconstruir correo completo
    var newRaw = newHeaderLines.join(lb) + lb + lb + body;

    // Re-codificar a base64url preservando bytes UTF-8
    var newBytes = new TextEncoder().encode(newRaw);
    var binOut = '';
    newBytes.forEach(function(b) { binOut += String.fromCharCode(b); });
    var encoded = btoa(binOut).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmailApiCall('POST', GMAIL_API_BASE + '/messages/send', { raw: encoded });
    notif('Correo reenviado con adjuntos a ' + ofiLabel + ' (' + ofiEmail + ')', 'ok');
    return true;
  } catch (e) {
    console.error('reenviarEmailAOficina:', e);
    notif('Error al reenviar correo: ' + e.message, 'err');
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
  // Show count of non-radicated messages (sin etiqueta "RAD APP")
  const n = _gmailMessages.filter(m => !_msgEsRadicado(m)).length;
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
    // Eagerly load/create the "RAD APP" label ID for filter logic
    if (!_gmailRadicadoLabelId) {
      try { _gmailRadicadoLabelId = await gmailGetOrCreateLabel(GMAIL_RADICADO_LABEL); } catch(e) { console.warn('Label init:', e.message); }
    }
    _gmailMessages = await gmailListMessages(50);
    renderGmailInboxList();
    updateUnreadCount();
    updateGmailFilterBtns();
  } catch (e) {
    console.error('gmailLoadInbox:', e);
    const scopeErr = e.message && (e.message.includes('403') || e.message.toLowerCase().includes('scope') || e.message.toLowerCase().includes('insufficient'));
    if (scopeErr) {
      listEl.innerHTML = '<div class="gmail-empty err">⚠️ Permisos insuficientes. Haga clic en <strong>Reconectar</strong> para autorizar el nuevo alcance.</div>';
      gmailSetToken('');
      updateGmailConnectBtn();
    } else {
      listEl.innerHTML = '<div class="gmail-empty err">' + escAttr(e.message) + '</div>';
      if (e.message.includes('Token expirado') || e.message.includes('Sin token')) { gmailSetToken(''); updateGmailConnectBtn(); }
    }
  }
}

function _msgEsRadicado(m) {
  if (!Array.isArray(m.labelIds)) return false;
  if (_gmailRadicadoLabelId && m.labelIds.includes(_gmailRadicadoLabelId)) return true;
  return false;
}
function renderGmailInboxList() {
  if (_gmailSearchMode) return; // Don't overwrite search results
  const msgs = _gmailFilter === 'unread'
    ? _gmailMessages.filter(m => !_msgEsRadicado(m))        // Sin radicar = sin etiqueta "RAD APP"
    : _gmailFilter === 'read'
      ? _gmailMessages.filter(m => _msgEsRadicado(m))        // Radicados = con etiqueta "RAD APP"
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
      atts.map(function(a) {
        var sizeStr = a.size > 1024 ? Math.round(a.size / 1024) + ' KB' : (a.size || '?') + ' B';
        var isImg = (a.mimeType || '').startsWith('image/');
        var ico = isImg ? '🖼️' : ((a.mimeType || '').includes('pdf') ? '📄' : '📎');
        if (a.attachmentId) {
          return '<button id="att-chip-' + escAttr(a.attachmentId) + '" class="gmail-att-chip" ' +
            'onclick="gmailViewAttachment(\'' + escAttr(msg.id) + '\',\'' + escAttr(a.attachmentId) + '\',\'' + escAttr(a.filename) + '\',\'' + escAttr(a.mimeType || '') + '\')" ' +
            'title="' + escAttr(a.filename) + ' (' + sizeStr + ')">' +
            '<span class="att-ico">' + ico + '</span>' +
            '<span class="att-name">' + escAttr(a.filename) + '</span>' +
            '<em class="att-size">(' + sizeStr + ')</em>' +
            '</button>';
        }
        return '<span class="gmail-att-chip"><span class="att-ico">' + ico + '</span><span class="att-name">' + escAttr(a.filename) + '</span><em class="att-size">(' + sizeStr + ')</em></span>';
      }).join(' ') +
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
  // Auto-fill fecha de solicitud desde la fecha del correo
  const dateHeader = gmailGetHeader(headers, 'date');
  if (dateHeader) {
    try {
      const d = new Date(dateHeader);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setv('sec-fecha-solicitud', yyyy + '-' + mm + '-' + dd);
      }
    } catch (e) {}
  }

  // Store message ID for saving with the expediente
  window._gmailPendingMsgId = msg.id;
  window._gmailPendingAttachments = window._gmailPendingAttachments || null;

  // Capture email metadata + body so offices can view it without needing Gmail OAuth
  try {
    const _h = (msg.payload && msg.payload.headers) || [];
    const _from = gmailParseFrom(gmailGetHeader(_h, 'from'));
    const _parts = gmailExtractParts(msg.payload);
    const _rawHtml = _parts.textHtml || '';
    const _rawTxt = _parts.textPlain || '';
    const _safeHtml = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(_rawHtml, {USE_PROFILES:{html:true}}) : _rawHtml;
    // Cap HTML at ~60KB to stay safely under Firestore 1MB document limit
    const _bodyHtml = _safeHtml.length > 60000 ? _safeHtml.slice(0, 60000) + '…' : _safeHtml;
    const _bodyTxt = _rawTxt.length > 8000 ? _rawTxt.slice(0, 8000) + '…' : _rawTxt;
    const _atts = (_parts.attachments || []).map(a => ({
      nombre: a.filename || '',
      mimeType: a.mimeType || '',
      size: a.size || 0,
      attachmentId: a.attachmentId || ''
    }));
    window._gmailPendingEmailData = {
      remitente: _from.name ? (_from.name + ' <' + _from.email + '>') : (_from.email || ''),
      fecha: gmailGetHeader(_h, 'date') || '',
      asunto: gmailGetHeader(_h, 'subject') || '',
      cuerpoHtml: _bodyHtml,
      cuerpoTxt: _bodyTxt,
      adjuntosInfo: _atts
    };
  } catch(e) {
    window._gmailPendingEmailData = null;
  }
}

function gmailPreRadicarPqrs() {
  if (!_gmailCurrentMsg) return;
  // Pre-llenar el formulario con datos del correo
  prePopularFormDesdeEmail(_gmailCurrentMsg);
  // Cerrar visor de adjuntos full-screen si estaba abierto
  if (typeof gmailCloseAttViewer === 'function') gmailCloseAttViewer();
  // Ocultar panel Gmail (bandeja) para liberar espacio
  var panelBody = document.getElementById('gmail-panel-body');
  var toggleBtn = document.getElementById('gmail-toggle-btn');
  if (panelBody) panelBody.style.display = 'none';
  if (toggleBtn) toggleBtn.textContent = 'Ver bandeja';

  // Construir la previsualización del correo en el panel izquierdo
  var msg = _gmailCurrentMsg;
  var headers = (msg.payload && msg.payload.headers) || [];
  var from = gmailParseFrom(gmailGetHeader(headers, 'from'));
  var subject = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
  var date = gmailFmtDate(gmailGetHeader(headers, 'date') || '');
  var parts = gmailExtractParts(msg.payload);
  var atts = parts.attachments || [];
  var rawBody = parts.textHtml || ('<pre style="white-space:pre-wrap;font-size:13px;margin:0">' + escAttr(parts.textPlain || '(sin cuerpo)') + '</pre>');
  var safeBody = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawBody, { USE_PROFILES: { html: true } }) : rawBody;

  // Cabecera
  var fromEl = document.getElementById('sec-email-panel-from');
  var dateEl = document.getElementById('sec-email-panel-date');
  var subjectEl = document.getElementById('sec-email-panel-subject');
  if (fromEl) fromEl.textContent = (from.name || from.email || 'Remitente desconocido');
  if (dateEl) dateEl.textContent = date;
  if (subjectEl) subjectEl.textContent = subject;

  // Adjuntos
  var attsEl = document.getElementById('sec-email-panel-atts');
  if (attsEl) {
    if (atts.length) {
      attsEl.style.display = '';
      attsEl.innerHTML = '<span style="font-weight:600;font-size:12px;flex-shrink:0">Adjuntos (' + atts.length + '):</span> ' +
        atts.map(function(a) {
          var sizeStr = a.size > 1024 ? Math.round(a.size / 1024) + ' KB' : (a.size || '?') + ' B';
          var isImg = (a.mimeType || '').startsWith('image/');
          var ico = isImg ? '🖼️' : ((a.mimeType || '').includes('pdf') ? '📄' : '📎');
          if (a.attachmentId) {
            return '<button id="split-chip-' + escAttr(a.attachmentId) + '" class="gmail-att-chip" ' +
              'onclick="openSplitAttViewer(\'' + escAttr(msg.id) + '\',\'' + escAttr(a.attachmentId) + '\',\'' + escAttr(a.filename) + '\',\'' + escAttr(a.mimeType || '') + '\')" ' +
              'title="' + escAttr(a.filename) + ' (' + sizeStr + ')">' +
              '<span class="att-ico">' + ico + '</span>' +
              '<span class="att-name">' + escAttr(a.filename) + '</span>' +
              '<em class="att-size">(' + sizeStr + ')</em>' +
              '</button>';
          }
          return '<span class="gmail-att-chip"><span class="att-ico">' + ico + '</span><span class="att-name">' + escAttr(a.filename) + '</span></span>';
        }).join('');
    } else {
      attsEl.style.display = 'none';
      attsEl.innerHTML = '';
    }
  }

  // Cuerpo del correo
  var bodyEl = document.getElementById('sec-email-panel-body');
  if (bodyEl) bodyEl.innerHTML = safeBody;

  // Activar la vista paralela
  var emailPanel = document.getElementById('sec-email-panel');
  if (emailPanel) emailPanel.classList.add('active');

  // Asegurar que el visor inline esté cerrado
  closeSplitAttViewer();

  // Scroll al inicio del split
  var split = document.getElementById('sec-radicar-split');
  if (split) split.scrollIntoView({ behavior: 'smooth', block: 'start' });
  notif('Formulario pre-llenado. Revise el correo a la izquierda y complete la radicación.', 'ok');
}

// Abre el visor inline de adjuntos dentro del panel izquierdo del split
async function openSplitAttViewer(msgId, attId, filename, mimeType) {
  if (!gmailIsTokenValid()) { notif('Reconecte la bandeja para ver adjuntos', 'err'); return; }
  var chipEl = document.getElementById('split-chip-' + attId);
  var origContent = chipEl ? chipEl.innerHTML : '';
  if (chipEl) { chipEl.innerHTML = '<span class="att-ico">⏳</span><span class="att-name">Cargando…</span>'; chipEl.style.opacity = '0.6'; }
  try {
    var b64url = await gmailGetAttachment(msgId, attId);
    // Decode as raw bytes (NOT via TextDecoder — that corrupts binary files like PDFs)
    var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var bi = 0; bi < binary.length; bi++) bytes[bi] = binary.charCodeAt(bi);
    var mime = mimeType || 'application/octet-stream';
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    var inlineHdr = document.getElementById('sec-att-inline-hdr');
    var inlineTitle = document.getElementById('sec-att-inline-title');
    var inlineBody = document.getElementById('sec-att-inline-body');
    var inlineEl = document.getElementById('sec-att-inline');
    if (inlineTitle) inlineTitle.textContent = filename;
    if (inlineBody) {
      if (mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
        inlineBody.innerHTML = '<iframe src="' + url + '#toolbar=0" title="' + escAttr(filename) + '"></iframe>';
        if (inlineEl) inlineEl.classList.add('open');
      } else if (mime.startsWith('image/')) {
        inlineBody.innerHTML = '<img src="' + url + '" alt="' + escAttr(filename) + '" style="max-width:100%;height:auto;margin:auto;display:block;padding:10px">';
        if (inlineEl) inlineEl.classList.add('open');
      } else if (_gmailIsOfficeFile(filename, mime)) {
        // Office: subir a Drive y abrir con visor de Google Docs
        if (inlineEl) inlineEl.classList.add('open');
        inlineBody.innerHTML = _gmailOfficeLoadingHtml(filename, url);
        try {
          var driveFile = await driveUploadFile(filename, mime, b64url);
          if (driveFile && driveFile.id) {
            var viewUrl = 'https://drive.google.com/file/d/' + driveFile.id + '/preview';
            inlineBody.innerHTML = '<iframe src="' + escAttr(viewUrl) + '" title="' + escAttr(filename) + '" allow="autoplay"></iframe>';
          } else { throw new Error('Sin ID'); }
        } catch (officeErr) {
          inlineBody.innerHTML = _gmailOfficeDownloadHtml(filename, url);
        }
      } else {
        // Tipo desconocido: descarga directa sin abrir el visor
        var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        if (chipEl) { chipEl.innerHTML = origContent; chipEl.style.opacity = ''; }
        return;
      }
    }
  } catch (e) {
    console.error('openSplitAttViewer:', e);
    notif('No se pudo cargar el adjunto', 'err');
  } finally {
    if (chipEl) { chipEl.innerHTML = origContent; chipEl.style.opacity = ''; }
  }
}

// Cierra el visor inline de adjuntos del panel izquierdo
function closeSplitAttViewer() {
  var inlineEl = document.getElementById('sec-att-inline');
  var inlineBody = document.getElementById('sec-att-inline-body');
  if (inlineEl) inlineEl.classList.remove('open');
  if (inlineBody) inlineBody.innerHTML = '';
}

// Cierra el split view y vuelve al layout normal
function cerrarSplitView() {
  var emailPanel = document.getElementById('sec-email-panel');
  if (emailPanel) emailPanel.classList.remove('active');
  closeSplitAttViewer();
  // Mostrar la bandeja Gmail de nuevo
  var panelBody = document.getElementById('gmail-panel-body');
  var toggleBtn = document.getElementById('gmail-toggle-btn');
  if (panelBody) panelBody.style.display = '';
  if (toggleBtn) toggleBtn.textContent = 'Ocultar bandeja';
  var wrap = document.getElementById('gmail-panel-wrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// ================================================================
// GMAIL PANEL — OFICINAS / NCA / RESPONSABLES
// Interfaz tipo Gmail: bandeja, enviados, borradores, etiquetas,
// redactar, responder, reenviar y visor de adjuntos en línea.
// Token independiente del de Secretaría (sst_gmail_ofi_token).
// ================================================================
const GMAIL_OFI_TOKEN_KEY = 'sst_gmail_ofi_token';
const GMAIL_OFI_TOKEN_EXP_KEY = 'sst_gmail_ofi_exp';
const GMAIL_OFI_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
].join(' ');
const GMAIL_OFI_SYS_LABELS = new Set([
  'INBOX','UNREAD','SENT','DRAFT','IMPORTANT','STARRED',
  'SPAM','TRASH','CATEGORY_SOCIAL','CATEGORY_UPDATES',
  'CATEGORY_FORUMS','CATEGORY_PROMOTIONS'
]);

let _gmailOfiTokenClient = null;
let _gmailOfiMessages    = [];
let _gmailOfiCurrentMsg  = null;
let _gmailOfiConnecting  = false;
let _gmailOfiActiveFolder = 'INBOX';
let _gmailOfiLabels      = [];

// ---- Token helpers ----
function gmailOfiGetToken() {
  try { return sessionStorage.getItem(GMAIL_OFI_TOKEN_KEY) || ''; } catch(e) { return ''; }
}
function gmailOfiSetToken(tok, expiresInSec) {
  try {
    if (tok) {
      sessionStorage.setItem(GMAIL_OFI_TOKEN_KEY, tok);
      sessionStorage.setItem(GMAIL_OFI_TOKEN_EXP_KEY, String(Date.now() + (expiresInSec || 3600) * 1000));
    } else {
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_EXP_KEY);
    }
  } catch(e) {}
}
function gmailOfiIsTokenValid() {
  const tok = gmailOfiGetToken();
  if (!tok) return false;
  try {
    const exp = parseInt(sessionStorage.getItem(GMAIL_OFI_TOKEN_EXP_KEY) || '0', 10);
    return exp > Date.now() + 60000;
  } catch(e) { return !!tok; }
}

// ---- Connect / disconnect ----
function gmailOfiConnect() {
  // Secretary: reuse her primary Gmail OAuth (managed in gmail.js secretary section)
  if (_gmailOfiIsSecretaria()) {
    if (gmailIsTokenValid()) {
      // Already connected — just bootstrap the Correos view
      _updateGmailOfiBtn();
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      if (!_gmailOfiSignature) _gmailOfiLoadSignature();
      return;
    }
    if (typeof gmailConnect === 'function') {
      gmailConnect(function() {
        _updateGmailOfiBtn();
        gmailOfiFolder('INBOX');
        gmailOfiLoadLabels();
        _gmailOfiLoadSignature();
      });
    }
    return;
  }
  if (_gmailOfiConnecting) return;
  const clientId = (typeof window._gmailClientId !== 'undefined') ? window._gmailClientId : '';
  if (!clientId || clientId.includes('TU_CLIENT_ID')) {
    notif('Falta configurar el Client ID OAuth.', 'err');
    return;
  }
  _gmailOfiConnecting = true;
  _updateGmailOfiBtn();
  _gmailOfiTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_OFI_SCOPES,
    callback: function(response) {
      _gmailOfiConnecting = false;
      if (response.error) {
        notif('Error al conectar correo: ' + (response.error_description || response.error), 'err');
        _updateGmailOfiBtn();
        return;
      }
      gmailOfiSetToken(response.access_token, response.expires_in);
      _updateGmailOfiBtn();
      notif('✅ Correo conectado.', 'ok');
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      _gmailOfiLoadSignature();
    }
  });
  _gmailOfiTokenClient.requestAccessToken({ prompt: '' });
}

function gmailOfiDisconnect() {
  if (_gmailOfiIsSecretaria()) {
    if (typeof gmailDisconnect === 'function') gmailDisconnect();
  } else {
    gmailOfiSetToken('');
  }
  _gmailOfiMessages   = [];
  _gmailOfiCurrentMsg = null;
  _gmailOfiLabels     = [];
  _gmailOfiSignature     = '';
  _gmailOfiSignatureHtml = '';
  _updateGmailOfiBtn();
  const listEl = document.getElementById('gmail-ofi-inbox-list');
  if (listEl) listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">🔒</div><div>Conecte su correo para ver los mensajes.</div></div>';
  gmailOfiCloseMessage();
  const labelsEl = document.getElementById('gm-labels-list');
  if (labelsEl) labelsEl.innerHTML = '';
}

// For secretary, the Correos tab reuses her primary Gmail token (no double-login)
function _gmailOfiIsSecretaria() { return typeof esSecretaria === 'function' && esSecretaria(); }
function _gmailOfiTokenValid() {
  if (_gmailOfiIsSecretaria()) return typeof gmailIsTokenValid === 'function' ? gmailIsTokenValid() : false;
  return gmailOfiIsTokenValid();
}

function _updateGmailOfiBtn() {
  const btn = document.getElementById('gmail-ofi-connect-btn');
  if (!btn) return;
  if (_gmailOfiConnecting) { btn.textContent = '⏳ Conectando…'; btn.disabled = true; return; }
  const valid = _gmailOfiTokenValid();
  if (valid) {
    btn.textContent = '🔌 Desconectar';
    btn.disabled = false;
    btn.onclick = gmailOfiDisconnect;
  } else {
    btn.textContent = '📧 Conectar mi correo';
    btn.disabled = false;
    btn.onclick = gmailOfiConnect;
  }
  const rb = document.getElementById('gmail-ofi-refresh-btn');
  if (rb) rb.style.display = valid ? '' : 'none';
}

// ---- API helper ----
async function _gmailOfiApi(method, url, body) {
  // Secretary reuses her primary token; other roles use the OFI token
  const token = _gmailOfiIsSecretaria()
    ? (sessionStorage.getItem(GMAIL_TOKEN_KEY) || '')
    : gmailOfiGetToken();
  if (!token) { notif('⚠️ Reconecte su correo para continuar.', 'err'); throw new Error('Sin token.'); }
  const opts = { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    if (_gmailOfiIsSecretaria()) {
      gmailSetToken('', 0); // Clear primary token
    } else {
      gmailOfiSetToken('');
    }
    _updateGmailOfiBtn();
    notif('⚠️ Sesión de correo expirada. Reconecte.', 'err');
    throw new Error('Token expirado.');
  }
  if (!res.ok) { const t = await res.text().catch(()=>''); throw new Error('API ' + res.status + ': ' + t.slice(0,200)); }
  return res.json();
}

// ---- Date formatting ----
function _gmailOfiShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
    if (d.getFullYear() === now.getFullYear())
      return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' });
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'2-digit' });
  } catch(e) { return dateStr; }
}

// ---- Folder navigation ----
const _gmailOfiSysNames = {
  INBOX:'Recibidos', SENT:'Enviados', DRAFT:'Borradores',
  SPAM:'Spam', TRASH:'Papelera', STARRED:'Destacados'
};

function gmailOfiFolder(labelId) {
  _gmailOfiActiveFolder = labelId;
  document.querySelectorAll('.gm-folder').forEach(el => el.classList.remove('gm-folder-active'));
  const folderEl = document.getElementById('gmf-' + labelId);
  if (folderEl) folderEl.classList.add('gm-folder-active');
  const titleEl = document.getElementById('gm-list-title');
  if (titleEl) {
    const lbl = _gmailOfiLabels.find(l => l.id === labelId);
    titleEl.textContent = _gmailOfiSysNames[labelId] || (lbl ? lbl.name : labelId);
  }
  gmailOfiCloseMessage();
  _gmailOfiLoadMessages({ labelId });
}

function gmailOfiRefresh() {
  if (_gmailOfiActiveFolder) gmailOfiFolder(_gmailOfiActiveFolder);
  else gmailOfiFolder('INBOX');
}

function gmailOfiSearch(query) {
  const q = String(query || '').trim();
  if (!q) { gmailOfiFolder('INBOX'); return; }
  document.querySelectorAll('.gm-folder').forEach(el => el.classList.remove('gm-folder-active'));
  const titleEl = document.getElementById('gm-list-title');
  if (titleEl) titleEl.textContent = 'Búsqueda: ' + q;
  gmailOfiCloseMessage();
  _gmailOfiLoadMessages({ query: q });
}

// Backward-compat alias
function gmailOfiLoadInbox(query) {
  if (query) gmailOfiSearch(query); else gmailOfiFolder('INBOX');
}

async function _gmailOfiLoadMessages(opts) {
  const listEl = document.getElementById('gmail-ofi-inbox-list');
  if (!listEl) return;
  if (!_gmailOfiTokenValid()) {
    listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">🔒</div><div>Conecte su correo para ver los mensajes.</div></div>';
    _updateGmailOfiBtn();
    return;
  }
  listEl.innerHTML = '<div class="gm-loading-state"><div class="gm-spinner"></div><span>Cargando…</span></div>';
  const countEl = document.getElementById('gm-list-count');
  if (countEl) countEl.textContent = '';
  try {
    let url;
    if (opts.query) {
      url = GMAIL_API_BASE + '/messages?q=' + encodeURIComponent(opts.query) + '&maxResults=30';
    } else {
      url = GMAIL_API_BASE + '/messages?labelIds=' + encodeURIComponent(opts.labelId) + '&maxResults=30';
    }
    const data = await _gmailOfiApi('GET', url);
    const ids = (data.messages || []).map(m => m.id);
    if (!ids.length) {
      listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">📭</div><div>No hay mensajes aquí</div></div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    const msgs = [];
    for (let i = 0; i < Math.min(ids.length, 30); i += 10) {
      const batch = ids.slice(i, i + 10);
      const res = await Promise.all(
        batch.map(id => _gmailOfiApi('GET', GMAIL_API_BASE + '/messages/' + id + '?format=full').catch(() => null))
      );
      msgs.push(...res.filter(Boolean));
    }
    _gmailOfiMessages = msgs;
    if (countEl) countEl.textContent = msgs.length + ' mensaje' + (msgs.length !== 1 ? 's' : '');
    _renderGmailOfiList();
  } catch(e) {
    if (listEl) listEl.innerHTML = '<div class="gm-empty-state gm-err-state"><div class="gm-empty-ico">⚠️</div><div>' + escAttr(e.message) + '</div></div>';
  }
}

// ---- Labels ----
async function gmailOfiLoadLabels() {
  try {
    const data = await _gmailOfiApi('GET', GMAIL_API_BASE + '/labels');
    _gmailOfiLabels = (data.labels || []).filter(l => l.type === 'user');
    _renderGmailOfiLabels();
  } catch(e) { console.warn('gmailOfiLoadLabels:', e); }
}

function _renderGmailOfiLabels() {
  const el = document.getElementById('gm-labels-list');
  if (!el) return;
  if (!_gmailOfiLabels.length) { el.innerHTML = ''; return; }
  el.innerHTML = _gmailOfiLabels.map(function(lbl) {
    const color = (lbl.color && lbl.color.backgroundColor) ? lbl.color.backgroundColor : '#888';
    return '<div class="gm-folder" id="gmf-' + escAttr(lbl.id) + '" onclick="gmailOfiFolder(\'' + escAttr(lbl.id) + '\')">' +
      '<span class="gmf-ico" style="font-size:10px;color:' + escAttr(color) + '">●</span>' +
      '<span class="gmf-name">' + escAttr(lbl.name) + '</span>' +
      '</div>';
  }).join('');
}

async function _gmailOfiUpdateBadges() {
  if (!_gmailOfiTokenValid()) return;
  try {
    const [unreadData, draftData] = await Promise.all([
      _gmailOfiApi('GET', GMAIL_API_BASE + '/messages?labelIds=INBOX&labelIds=UNREAD&maxResults=1').catch(()=>null),
      _gmailOfiApi('GET', GMAIL_API_BASE + '/messages?labelIds=DRAFT&maxResults=1').catch(()=>null)
    ]);
    const ub = document.getElementById('gmb-INBOX');
    if (ub) ub.textContent = (unreadData && unreadData.resultSizeEstimate) ? unreadData.resultSizeEstimate : '';
    const db = document.getElementById('gmb-DRAFT');
    if (db) db.textContent = (draftData && draftData.resultSizeEstimate) ? draftData.resultSizeEstimate : '';
  } catch(e) {}
}

// ---- Gmail Signature ----
let _gmailOfiSignature = '';     // plain-text version (for text/plain MIME part)
let _gmailOfiSignatureHtml = ''; // raw HTML version (for text/html MIME part + preview)

async function _gmailOfiLoadSignature() {
  try {
    const data = await _gmailOfiApi('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs');
    const primary = (data.sendAs || []).find(s => s.isPrimary) || (data.sendAs || [])[0];
    if (primary && primary.signature) {
      _gmailOfiSignatureHtml = primary.signature; // keep full HTML (logo, colors, etc.)
      const div = document.createElement('div');
      div.innerHTML = primary.signature;
      _gmailOfiSignature = '\n-- \n' + (div.textContent || div.innerText || '').trim();
    }
  } catch(e) { _gmailOfiSignature = ''; _gmailOfiSignatureHtml = ''; }
}

// Convert plain text to simple HTML paragraphs for the html/mime part
function _gmailOfiTextToHtml(text) {
  return (text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .split('\n').map(l => '<p style="margin:0 0 6px 0">' + (l || '&nbsp;') + '</p>').join('');
}

// ---- Email list rendering ----
function _renderGmailOfiList() {
  const listEl = document.getElementById('gmail-ofi-inbox-list');
  if (!listEl) return;
  if (!_gmailOfiMessages.length) {
    listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">📭</div><div>No hay mensajes</div></div>';
    return;
  }
  listEl.innerHTML = _gmailOfiMessages.map(function(msg) {
    const headers = (msg.payload && msg.payload.headers) || [];
    const subject  = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
    const date     = gmailGetHeader(headers, 'date') || '';
    const from     = gmailParseFrom(gmailGetHeader(headers, 'from'));
    const fromLabel = (from.name || from.email || 'Desconocido').slice(0, 28);
    const unread   = Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD');
    const starred  = Array.isArray(msg.labelIds) && msg.labelIds.includes('STARRED');
    const hasAtt   = gmailMsgHasAttachments(msg);
    const snippet  = (msg.snippet || '').slice(0, 80);
    const active   = (_gmailOfiCurrentMsg && _gmailOfiCurrentMsg.id === msg.id) ? ' gm-row-active' : '';
    // Custom label chips
    const customIds = (msg.labelIds || []).filter(l => !GMAIL_OFI_SYS_LABELS.has(l));
    const labelsHtml = customIds.map(function(lid) {
      const lbl = _gmailOfiLabels.find(x => x.id === lid);
      if (!lbl) return '';
      const bg = (lbl.color && lbl.color.backgroundColor) ? lbl.color.backgroundColor : '#e0e0e0';
      const tx = (lbl.color && lbl.color.textColor) ? lbl.color.textColor : '#000';
      return '<span class="gm-row-label" style="background:' + escAttr(bg) + ';color:' + escAttr(tx) + '">' + escAttr(lbl.name) + '</span>';
    }).join('');
    return '<div class="gm-email-row' + (unread ? ' gm-unread' : '') + active + '" onclick="gmailOfiOpenMessage(\'' + escAttr(msg.id) + '\')">' +
      '<button class="gm-row-star" onclick="gmailOfiToggleStar(\'' + escAttr(msg.id) + '\',event)" title="' + (starred?'Quitar destacado':'Destacar') + '">' + (starred?'★':'☆') + '</button>' +
      '<div class="gm-row-from">' + escAttr(fromLabel) + '</div>' +
      '<div class="gm-row-body">' +
        '<span class="gm-row-subject">' + escAttr(subject.slice(0,55)) + '</span>' +
        (hasAtt ? '<span class="gm-row-att">📎</span>' : '') +
        (labelsHtml ? '<span class="gm-row-labels">' + labelsHtml + '</span>' : '') +
        (snippet ? '<span class="gm-row-snippet"> — ' + escAttr(snippet) + '</span>' : '') +
      '</div>' +
      '<div class="gm-row-date">' + escAttr(_gmailOfiShortDate(date)) + '</div>' +
      '</div>';
  }).join('');
}

// ---- Message view ----
function gmailOfiCloseMessage() {
  const mp = document.getElementById('gm-msg-pane');
  const lp = document.getElementById('gm-list-pane');
  if (mp) { mp.classList.remove('open'); mp.style.display = 'none'; }
  if (lp) lp.style.display = '';
  _gmailOfiCurrentMsg = null;
  const viewEl = document.getElementById('gmail-ofi-msg-view');
  if (viewEl) viewEl.innerHTML = '';
}

async function gmailOfiOpenMessage(id) {
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  const mp = document.getElementById('gm-msg-pane');
  const lp = document.getElementById('gm-list-pane');
  const viewEl = document.getElementById('gmail-ofi-msg-view');
  if (viewEl) viewEl.innerHTML = '<div class="gm-loading-state"><div class="gm-spinner"></div><span>Cargando mensaje…</span></div>';
  if (mp) { mp.style.display = 'flex'; mp.classList.add('open'); }
  // On narrow screens, hide list
  if (lp && window.innerWidth < 860) lp.style.display = 'none';
  try {
    let msg = _gmailOfiMessages.find(m => m.id === id) || null;
    if (!msg) msg = await _gmailOfiApi('GET', GMAIL_API_BASE + '/messages/' + id + '?format=full');
    _gmailOfiCurrentMsg = msg;
    if (Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD')) {
      _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/' + id + '/modify', { removeLabelIds: ['UNREAD'] })
        .then(() => {
          if (msg.labelIds) msg.labelIds = msg.labelIds.filter(l => l !== 'UNREAD');
          _renderGmailOfiList();
          _gmailOfiUpdateBadges();
        }).catch(() => {});
    }
    _renderGmailOfiMsgView(msg);
    _renderGmailOfiList();
  } catch(e) {
    if (viewEl) viewEl.innerHTML = '<div class="gm-empty-state gm-err-state"><div class="gm-empty-ico">⚠️</div><div>' + escAttr(e.message) + '</div></div>';
  }
}

function _renderGmailOfiMsgView(msg) {
  const viewEl = document.getElementById('gmail-ofi-msg-view');
  if (!viewEl || !msg) return;
  const headers  = (msg.payload && msg.payload.headers) || [];
  const subject  = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
  const from     = gmailGetHeader(headers, 'from') || '';
  const to       = gmailGetHeader(headers, 'to') || '';
  const date     = gmailGetHeader(headers, 'date') || '';
  const replyTo  = gmailGetHeader(headers, 'reply-to') || '';
  const msgId    = gmailGetHeader(headers, 'message-id') || '';
  const parts    = gmailExtractParts(msg.payload);
  // Body
  let bodyHtml = '';
  if (parts.textHtml) {
    const safe = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(parts.textHtml, { USE_PROFILES:{html:true} }) : parts.textHtml;
    bodyHtml = '<div class="gm-msg-body">' + safe + '</div>';
  } else if (parts.textPlain) {
    bodyHtml = '<pre class="gm-msg-body gm-msg-plain">' + escAttr(parts.textPlain) + '</pre>';
  }
  // Attachments
  let attsHtml = '';
  if (parts.attachments && parts.attachments.length) {
    attsHtml = '<div class="gm-msg-atts">' +
      parts.attachments.map(function(att) {
        const mime = (att.mimeType||'').toLowerCase();
        const ico  = mime.includes('pdf')?'📄':mime.includes('word')||(att.filename||'').match(/\.docx?$/i)?'📝':mime.includes('sheet')||mime.includes('excel')||(att.filename||'').match(/\.xlsx?$/i)?'📊':mime.startsWith('image/')?'🖼️':'📎';
        return '<button type="button" class="gmail-att-chip" onclick="gmailOfiViewAttachment(\'' + escAttr(msg.id) + '\',\'' + escAttr(att.attachmentId) + '\',\'' + escAttr(att.filename||'Adjunto') + '\',\'' + escAttr(att.mimeType||'application/octet-stream') + '\')" title="' + escAttr(att.filename||'Adjunto') + '">' +
          '<span class="att-ico">' + ico + '</span><span class="att-name">' + escAttr((att.filename||'Adjunto').slice(0,32)) + '</span></button>';
      }).join('') + '</div>';
  }
  // From email for reply
  const fromParsed = gmailParseFrom(from);
  const replyEmail = (replyTo ? gmailParseFrom(replyTo).email : '') || fromParsed.email || '';
  const replySubj  = subject.startsWith('Re:') ? subject : 'Re: ' + subject;
  const fwdSubj    = subject.startsWith('Fwd:') ? subject : 'Fwd: ' + subject;
  const fwdBody    = '\n\n--- Mensaje reenviado ---\nDe: ' + from + '\nFecha: ' + date + '\nPara: ' + to + '\nAsunto: ' + subject + '\n\n' + (parts.textPlain || '');

  const radicarBtn = _gmailOfiIsSecretaria()
    ? '<button type="button" class="gm-action-btn gm-radicar-btn" onclick="gmailOfiRadicarDesdeCorreo()">📋 Radicar desde este correo</button>'
    : '';

  viewEl.innerHTML =
    '<div class="gm-msg-header">' +
      '<h2 class="gm-msg-title">' + escAttr(subject) + '</h2>' +
      '<div class="gm-msg-sender">' +
        '<span class="gm-sender-avatar">' + escAttr((fromParsed.name||fromParsed.email||'?').charAt(0).toUpperCase()) + '</span>' +
        '<div class="gm-sender-info">' +
          '<div class="gm-sender-name">' + escAttr(fromParsed.name || fromParsed.email) + ' <span class="gm-sender-addr">&lt;' + escAttr(fromParsed.email) + '&gt;</span></div>' +
          '<div class="gm-sender-meta">Para: ' + escAttr(to) + ' · ' + escAttr(gmailFmtDate(date)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gm-msg-actions">' +
        (replyEmail ? '<button type="button" class="gm-action-btn" onclick="gmailOfiOpenCompose({to:\'' + escAttr(replyEmail) + '\',subject:\'' + escAttr(replySubj) + '\',inReplyTo:\'' + escAttr(msgId) + '\',title:\'Responder\'})">↩ Responder</button>' : '') +
        '<button type="button" class="gm-action-btn" onclick="gmailOfiOpenCompose({subject:\'' + escAttr(fwdSubj) + '\',body:\'' + escAttr(fwdBody) + '\',title:\'Reenviar\'})">↪ Reenviar</button>' +
        radicarBtn +
      '</div>' +
    '</div>' +
    attsHtml + bodyHtml;
}

// ---- Star toggle ----
async function gmailOfiToggleStar(msgId, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  const msg = _gmailOfiMessages.find(m => m.id === msgId);
  if (!msg) return;
  const starred = Array.isArray(msg.labelIds) && msg.labelIds.includes('STARRED');
  try {
    if (starred) {
      await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/' + msgId + '/modify', { removeLabelIds: ['STARRED'] });
      msg.labelIds = (msg.labelIds||[]).filter(l => l !== 'STARRED');
    } else {
      await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/' + msgId + '/modify', { addLabelIds: ['STARRED'] });
      if (!msg.labelIds) msg.labelIds = [];
      msg.labelIds.push('STARRED');
    }
    _renderGmailOfiList();
  } catch(e) { notif('Error: ' + e.message, 'err'); }
}

// ---- Attachment viewer ----
async function gmailOfiViewAttachment(msgId, attachmentId, filename, mimeType) {
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo para ver adjuntos.', 'err'); return; }
  notif('📄 Abriendo adjunto…', 'ok');
  try {
    const data = await _gmailOfiApi('GET', GMAIL_API_BASE + '/messages/' + msgId + '/attachments/' + attachmentId);
    const b64    = (data.data || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const binary = atob(padded);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob   = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    abrirVisorAdjunto(URL.createObjectURL(blob), filename);
    notif('', '');
  } catch(e) { notif('Error al abrir adjunto: ' + e.message, 'err'); }
}

// ---- Compose / Reply / Forward / Draft ----
function gmailOfiOpenCompose(opts) {
  const modal = document.getElementById('gm-compose-modal');
  if (!modal) return;
  if (!_gmailOfiTokenValid()) { notif('Conecte su correo para redactar.', 'err'); return; }
  opts = opts || {};
  const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  f('gm-compose-to',      opts.to || '');
  f('gm-compose-cc',      opts.cc || '');
  f('gm-compose-subject', opts.subject || '');
  // Body textarea: only user message / quoted text — NO plain-text signature (handled in MIME builder)
  f('gm-compose-body', opts.body || '');
  // HTML signature preview below textarea
  const sigPreview = document.getElementById('gm-sig-preview');
  if (sigPreview) {
    if (_gmailOfiSignatureHtml) {
      sigPreview.innerHTML = '<div class="gm-sig-divider">--</div>' + _gmailOfiSignatureHtml;
      sigPreview.style.display = 'block';
    } else {
      sigPreview.style.display = 'none';
    }
  }
  const title = document.getElementById('gm-compose-title');
  if (title) title.textContent = opts.title || 'Nuevo mensaje';
  modal.dataset.inReplyTo = opts.inReplyTo || '';
  modal.style.display = 'flex';
  const toEl = document.getElementById('gm-compose-to');
  const bodyEl = document.getElementById('gm-compose-body');
  if (toEl && !toEl.value) toEl.focus();
  else if (bodyEl) bodyEl.focus();
}

function gmailOfiDiscardDraft() {
  const modal = document.getElementById('gm-compose-modal');
  if (modal) modal.style.display = 'none';
}

function _gmailOfiBuildMime(to, cc, subject, userText, inReplyTo) {
  const boundary = 'sst_ofi_' + Date.now();
  const subjectEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';

  // Plain-text part: user message + stripped signature
  const plainBody = (userText || '') + (_gmailOfiSignature || '');

  // HTML part: user text converted to paragraphs + full HTML signature with logo
  const userHtml = '<div style="font-family:Arial,sans-serif;font-size:14px">' + _gmailOfiTextToHtml(userText || '') + '</div>';
  const sigHtml = _gmailOfiSignatureHtml
    ? '<div><br><div style="border-top:1px solid #e0e0e0;padding-top:8px">' + _gmailOfiSignatureHtml + '</div></div>'
    : '';
  const htmlBody = userHtml + sigHtml;
  const htmlB64 = btoa(unescape(encodeURIComponent(htmlBody)));

  const lines = [
    'To: ' + to,
    cc ? 'Cc: ' + cc : null,
    'Subject: ' + subjectEnc,
    inReplyTo ? 'In-Reply-To: ' + inReplyTo : null,
    inReplyTo ? 'References: ' + inReplyTo : null,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=utf-8',
    '',
    plainBody,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    '',
    '--' + boundary + '--'
  ].filter(l => l !== null).join('\r\n');
  return btoa(unescape(encodeURIComponent(lines))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function gmailOfiSendCompose() {
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  const modal = document.getElementById('gm-compose-modal');
  const g = id => (document.getElementById(id)||{}).value||'';
  const to = g('gm-compose-to'), cc = g('gm-compose-cc'),
        subject = g('gm-compose-subject'), body = g('gm-compose-body'),
        inReplyTo = (modal&&modal.dataset.inReplyTo)||'';
  if (!to.trim()) { notif('Ingrese el destinatario.', 'err'); return; }
  if (!body.trim()) { notif('El mensaje está vacío.', 'err'); return; }
  const sendBtn = document.querySelector('#gm-compose-modal .gm-compose-send');
  if (sendBtn) { sendBtn.textContent = '⏳ Enviando…'; sendBtn.disabled = true; }
  try {
    await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: _gmailOfiBuildMime(to, cc, subject, body, inReplyTo) });
    notif('✅ Mensaje enviado.', 'ok');
    gmailOfiDiscardDraft();
    if (_gmailOfiActiveFolder === 'SENT') gmailOfiFolder('SENT');
  } catch(e) {
    notif('Error al enviar: ' + e.message, 'err');
    if (sendBtn) { sendBtn.textContent = '📤 Enviar'; sendBtn.disabled = false; }
  }
}

async function gmailOfiSaveDraft() {
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  const g = id => (document.getElementById(id)||{}).value||'';
  const to = g('gm-compose-to'), subject = g('gm-compose-subject'), body = g('gm-compose-body');
  if (!body.trim()) { notif('El borrador está vacío.', 'err'); return; }
  try {
    const raw = _gmailOfiBuildMime(to||'(sin destinatario)', '', subject, body, '');
    await _gmailOfiApi('POST', GMAIL_API_BASE + '/drafts', { message: { raw } });
    notif('💾 Borrador guardado.', 'ok');
    gmailOfiDiscardDraft();
    setTimeout(_gmailOfiUpdateBadges, 600);
  } catch(e) { notif('Error al guardar borrador: ' + e.message, 'err'); }
}

// ---- Radicar desde correo (secretaría) ----
// Navega al tab de Radicación y activa el split view con el correo actual
function gmailOfiRadicarDesdeCorreo() {
  const msg = _gmailOfiCurrentMsg;
  if (!msg) return;
  // Bridge: make this the active message for the secretary's radicación flow
  _gmailCurrentMsg = msg;
  window._gmailPendingMsgId    = msg.id;
  window._gmailPendingAttachments = null;
  // Navigate to Radicación tab
  if (typeof showTab === 'function') showTab('sec');
  // Trigger split-view + form pre-population (existing secretary function)
  setTimeout(function() {
    if (typeof gmailPreRadicarPqrs === 'function') gmailPreRadicarPqrs();
  }, 120);
}

// ---- Init panel ----
function gmailOfiInitPanel() {
  _updateGmailOfiBtn();
  if (_gmailOfiTokenValid()) {
    if (!_gmailOfiMessages.length) {
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      _gmailOfiUpdateBadges();
      if (!_gmailOfiSignature) _gmailOfiLoadSignature();
    } else {
      _renderGmailOfiList();
      _renderGmailOfiLabels();
    }
  }
}
