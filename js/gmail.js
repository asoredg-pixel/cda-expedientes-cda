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
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
].join(' ');

const GMAIL_TOKEN_KEY = 'sst_gmail_token';
const GMAIL_TOKEN_EXP_KEY = 'sst_gmail_token_exp';

function _gmailGetClientId() {
  return String(
    window._gmailClientId ||
    (typeof GMAIL_OAUTH_CLIENT_ID !== 'undefined' ? GMAIL_OAUTH_CLIENT_ID : '') ||
    ''
  ).trim();
}
function _gmailGisReady() {
  return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
}
function _gmailOAuthDone() {
  _gmailConnecting = false;
  updateGmailConnectBtn();
  if (typeof _updateGmailOfiBtn === 'function') _updateGmailOfiBtn();
}
function _gmailStartOAuth(scope, onToken) {
  if (_gmailConnecting) {
    notif('Ya hay una conexión en curso. Si no aparece Google, espere unos segundos e intente de nuevo.', 'warn');
    return;
  }
  const clientId = _gmailGetClientId();
  if (!clientId || clientId.includes('TU_CLIENT_ID')) {
    notif('Falta configurar el Client ID OAuth.', 'err');
    return;
  }
  if (!_gmailGisReady()) {
    notif('Google Identity Services aún no cargó. Espere 5 segundos y pulse Conectar de nuevo.', 'warn');
    return;
  }
  _gmailConnecting = true;
  updateGmailConnectBtn();
  if (typeof _updateGmailOfiBtn === 'function') _updateGmailOfiBtn();
  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: scope,
    callback: function(response) {
      _gmailOAuthDone();
      if (response.error) {
        console.error('Gmail OAuth error:', response);
        notif('Error al conectar: ' + (response.error_description || response.error), 'err');
        return;
      }
      if (!response.access_token) {
        notif('Google no devolvió un token. Intente de nuevo.', 'err');
        return;
      }
      onToken(response.access_token, response.expires_in);
    },
    error_callback: function(err) {
      console.error('Gmail OAuth error_callback:', err);
      _gmailOAuthDone();
      notif('No se completó la conexión. Permita ventanas emergentes e intente de nuevo.', 'err');
    }
  });
  try {
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  } catch (err) {
    console.error('requestAccessToken:', err);
    _gmailOAuthDone();
    notif('No se pudo abrir Google: ' + (err.message || err), 'err');
  }
}

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
  _gmailStartOAuth(GMAIL_SCOPES, function(tok, exp) {
    gmailSetToken(tok, exp);
    notif('Bandeja conectada correctamente.', 'ok');
    if (typeof callback === 'function') callback();
    else gmailLoadInbox();
  });
}
window.gmailConnect = gmailConnect;

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

// Apply "RAD APP" label to a message — works with secretary token (primary)
async function _gmailApplyRadLabel(messageId) {
  if (!messageId) return;
  // Try secretary token first, then office token
  const useSec = gmailIsTokenValid();
  const useOfi = !useSec && gmailOfiIsTokenValid && gmailOfiIsTokenValid();
  if (!useSec && !useOfi) return;
  let labelId = _gmailRadicadoLabelId;
  if (!labelId) {
    try { labelId = _gmailRadicadoLabelId = await gmailGetOrCreateLabel(GMAIL_RADICADO_LABEL); } catch(e) { console.warn('Label get:', e); }
  }
  if (!labelId) return;
  const modify = { addLabelIds: [labelId] };
  if (useSec) {
    await gmailApiCall('POST', GMAIL_API_BASE + '/messages/' + messageId + '/modify', modify);
  } else {
    await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/' + messageId + '/modify', modify);
  }
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

// ----------------------------------------------------------------
// Drive institucional — carpeta raíz compartida de cdaguaviare1
// Todas las subidas PQRSD de Guaviare van aquí (oficinas + NCA + secretaría).
// Guainía y Vaupés usan links manuales (su propio Drive).
// La carpeta raíz debe compartirse con EDITOR para cada correo de oficina.
// ----------------------------------------------------------------
// Carpeta raíz PQRSD (cdaguaviare1@gmail.com):
// https://drive.google.com/drive/folders/16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS
const DRIVE_ROOT_PQRSD_ID = '16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS';
// Carpeta raíz chat interno (cdaguaviare1@gmail.com, retención 30 días):
// https://drive.google.com/drive/folders/1xkB43Cay54_Qxu0EvJYcHiyHqJpF_bSU
const DRIVE_ROOT_CHAT_ID = (typeof CHAT_DRIVE_FOLDER_ID !== 'undefined' && CHAT_DRIVE_FOLDER_ID)
  ? CHAT_DRIVE_FOLDER_ID : '1xkB43Cay54_Qxu0EvJYcHiyHqJpF_bSU';
// Carpeta raíz Expedientes (cdaguaviare1@gmail.com) — actividades de trámites Guaviare:
// https://drive.google.com/drive/folders/1A_UQZ-M22SA8xSKAwU20WtsvGghDYDzQ
const DRIVE_ROOT_EXPEDIENTES_ID = '1A_UQZ-M22SA8xSKAwU20WtsvGghDYDzQ';
// DRIVE_ROOT_RECURSOS_ID → constants.js (no redeclarar: rompe la carga de este script)

// Nombres de carpeta mensual (índice = getMonth()).
const DRIVE_MESES_ES = ['01-Enero','02-Febrero','03-Marzo','04-Abril','05-Mayo','06-Junio','07-Julio','08-Agosto','09-Septiembre','10-Octubre','11-Noviembre','12-Diciembre'];

// Obtiene el mejor token disponible para subir al Drive institucional.
// Prioridad: secretaria (cdaguaviare1) > token de oficina conectada.
function _driveGetBestToken() {
  const secTok = gmailGetToken();
  if (secTok && gmailIsTokenValid()) return secTok;
  const ofiTok = gmailOfiGetToken ? gmailOfiGetToken() : '';
  if (ofiTok && gmailOfiIsTokenValid && gmailOfiIsTokenValid()) return ofiTok;
  return '';
}

// Devuelve true si el depto activo es Guaviare (usa Drive institucional).
function _driveEsGuaviare() {
  const d = typeof deptoActivo !== 'undefined' ? deptoActivo : '';
  return d === 'guaviare' || d === 'secretaria' || d === 'oap_deguv' ||
         d === 'rn_deguv' || d === 'admin_deguv' || d === 'ds_deguv' ||
         (typeof rolSesion !== 'undefined' && rolSesion === 'responsables' &&
          typeof deptoCfg !== 'undefined' && deptoCfg === 'guaviare');
}

// Expedientes Guaviare (excluye Guainía y Vaupés).
function _driveExpedienteEsGuaviare(e) {
  if (!_driveEsGuaviare()) return false;
  const d = e && e._depto ? String(e._depto).trim().toLowerCase() : '';
  if (d === 'guainia' || d === 'vaupes') return false;
  return true;
}

function _driveSlug(s, maxLen) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, maxLen || 25) || 'doc';
}

function buildExpedienteDriveFilename(estado, e, task, responsable, origName) {
  const exp = String(e && e._exp || '').trim().replace(/\s/g, '');
  const act = _driveSlug(task && (task.desc || task.actividad) || 'actividad', 25);
  const resp = _driveSlug(responsable, 20);
  const fecha = (typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const extMatch = String(origName || '').match(/\.([a-zA-Z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
  const pref = estado === 'aprobado' ? 'aprobado' : (estado === 'corregir' ? 'corregir' : 'revision');
  return pref + '-' + exp + '-' + act + '-' + fecha + '-' + resp + '.' + ext;
}

async function driveEnsureExpedienteFolder(e) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo primero.');
  if (e._drive_folder_id) {
    return {
      folderId: e._drive_folder_id,
      folderLink: e._drive_folder_link || ('https://drive.google.com/drive/folders/' + e._drive_folder_id)
    };
  }
  let ref = new Date(e._fecha || e._fecha_solicitud || '');
  if (isNaN(ref.getTime())) ref = new Date();
  const anio = ref.getFullYear().toString();
  const expNum = String(e._exp || '').trim();
  const nomSlug = _driveSlug(typeof getNom === 'function' ? getNom(e) : '', 30);
  const carpNom = 'EXP-' + expNum.replace(/\s/g, '') + (nomSlug ? '-' + nomSlug : '');
  let parent = DRIVE_ROOT_EXPEDIENTES_ID;
  parent = await _driveEnsureFolder(token, anio, parent);
  const folderId = await _driveEnsureFolder(token, carpNom, parent);
  const folderLink = 'https://drive.google.com/drive/folders/' + folderId;
  e._drive_folder_id = folderId;
  e._drive_folder_link = folderLink;
  return { folderId: folderId, folderLink: folderLink };
}

async function driveRenameInstitutional(fileId, newName) {
  const token = _driveGetBestToken();
  if (!token || !fileId) return false;
  const res = await fetch(DRIVE_API_BASE + '/files/' + encodeURIComponent(fileId), {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });
  if (!res.ok) {
    console.warn('driveRenameInstitutional:', fileId, res.status);
    return false;
  }
  return true;
}

async function driveDeleteInstitutional(fileId) {
  const token = _driveGetBestToken();
  if (!token || !fileId) return false;
  const res = await fetch(DRIVE_API_BASE + '/files/' + encodeURIComponent(fileId), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return res.ok || res.status === 404;
}

async function driveRenameExpedienteSoporte(soporte, newEstado, e, task, responsable) {
  if (!soporte || !soporte.driveFileId || soporte.driveInstitutional === false) return false;
  const origName = soporte.driveFilename || soporte.label || '';
  const newName = buildExpedienteDriveFilename(newEstado, e, task, responsable || soporte.autor, origName);
  const ok = await driveRenameInstitutional(soporte.driveFileId, newName);
  if (ok) {
    soporte.driveFilename = newName;
    soporte.label = newName;
    soporte.driveEstado = newEstado;
  }
  return ok;
}

async function driveUploadExpedienteActividad(blob, origName, mimeType, e, task, responsable, estado) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo primero.');
  const folder = await driveEnsureExpedienteFolder(e);
  const filename = buildExpedienteDriveFilename(estado || 'revision', e, task, responsable, origName);
  const form = new FormData();
  const meta = { name: filename, mimeType: mimeType || 'application/octet-stream', parents: [folder.folderId] };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob instanceof Blob ? blob : new Blob([blob], { type: mimeType }));
  const up = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form
  });
  if (!up.ok) {
    const t = await up.text().catch(function() { return ''; });
    throw new Error('Drive upload ' + up.status + ': ' + t.slice(0, 120));
  }
  const file = await up.json();
  await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }).catch(function() {});
  return {
    fileId: file.id,
    driveFileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    previewLink: 'https://drive.google.com/file/d/' + file.id + '/preview',
    nombre: filename,
    driveFilename: filename,
    driveEstado: estado || 'revision',
    driveInstitutional: true
  };
}

async function drivePurgeTaskInstitutionalSoportes(task) {
  if (!task || !Array.isArray(task.soportes)) return;
  const ids = [];
  task.soportes.forEach(function(s) {
    if (s && s.driveFileId && s.driveInstitutional !== false) ids.push(s.driveFileId);
  });
  for (let i = 0; i < ids.length; i++) {
    await driveDeleteInstitutional(ids[i]).catch(function() {});
  }
}

// Obtiene o crea una carpeta dentro de un padre dado usando el token indicado.
async function _driveEnsureFolder(token, folderName, parentId) {
  const q = 'name="' + folderName.replace(/"/g, '\\"') +
            '" and mimeType="application/vnd.google-apps.folder"' +
            (parentId ? ' and "' + parentId + '" in parents' : '') +
            ' and trashed=false';
  const cacheKey = 'sst_df_' + (parentId || 'root') + '_' + folderName.replace(/\s/g, '_');
  try { const c = sessionStorage.getItem(cacheKey); if (c) return c; } catch (e) {}
  const res = await fetch(DRIVE_API_BASE + '/files?q=' + encodeURIComponent(q) + '&fields=files(id)', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    try { sessionStorage.setItem(cacheKey, data.files[0].id); } catch (e) {}
    return data.files[0].id;
  }
  const body = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const cr = await fetch(DRIVE_API_BASE + '/files', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const folder = await cr.json();
  try { sessionStorage.setItem(cacheKey, folder.id); } catch (e) {}
  return folder.id;
}

// Lista archivos y subcarpetas de una carpeta Drive (biblioteca de recursos).
async function driveListFolderContents(folderId, pageToken) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo en la pestaña Correos.');
  const q = '"' + folderId + '" in parents and trashed=false';
  let url = DRIVE_API_BASE + '/files?q=' + encodeURIComponent(q) +
    '&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink)' +
    '&orderBy=folder,name&pageSize=50';
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error && data.error.message || 'Error listando Drive');
  return data;
}

// Crea o reutiliza carpeta de oficina bajo la raíz de Recursos (Guaviare).
async function driveEnsureBibliotecaOficinaFolder(oficinaId) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo en la pestaña Correos.');
  const ofi = (typeof OFICINAS_DEGUV !== 'undefined' ? OFICINAS_DEGUV : []).find(o => o.id === oficinaId);
  const cod = ofi ? (ofi.codigo || ofi.id) : String(oficinaId || 'Oficina');
  const rootId = typeof DRIVE_ROOT_RECURSOS_ID !== 'undefined' ? DRIVE_ROOT_RECURSOS_ID : '18oV-qm2J4OX1lIoITcqhIs2WJ-iHFk29';
  const folderId = await _driveEnsureFolder(token, cod, rootId);
  return { folderId: folderId, link: 'https://drive.google.com/drive/folders/' + folderId };
}

// Crea carpeta de repositorio: Guaviare → subcarpeta de oficina bajo raíz institucional;
// Guainía/Vaupés → carpeta regional configurada por el administrador.
async function driveEnsureBibliotecaRepoFolder(scope, scopeId, repoTitulo) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo en la pestaña Correos.');
  const nom = String(repoTitulo || 'Repositorio').trim().slice(0, 80) || 'Repositorio';
  let parentId = '';
  const esRegional = scope === 'departamento' && (scopeId === 'guainia' || scopeId === 'vaupes');
  if (esRegional) {
    const rootId = typeof getBibliotecaDriveRootId === 'function' ? getBibliotecaDriveRootId(scopeId) : '';
    if (!rootId) throw new Error('Configure la carpeta Drive regional en Configuración → Recursos.');
    parentId = rootId;
  } else if (scope === 'sistema') {
    const rootId = typeof DRIVE_ROOT_RECURSOS_ID !== 'undefined' ? DRIVE_ROOT_RECURSOS_ID : '18oV-qm2J4OX1lIoITcqhIs2WJ-iHFk29';
    parentId = await _driveEnsureFolder(token, 'Sistema', rootId);
  } else {
    let ofiId = scopeId;
    if (scope === 'departamento' && scopeId === 'guaviare') ofiId = 'guaviare';
    if (scope === 'oficina') ofiId = scopeId;
    const base = await driveEnsureBibliotecaOficinaFolder(ofiId || 'guaviare');
    parentId = base.folderId;
  }
  const folderId = await _driveEnsureFolder(token, nom, parentId);
  return { folderId: folderId, link: 'https://drive.google.com/drive/folders/' + folderId };
}
if (typeof window !== 'undefined') {
  window.driveEnsureBibliotecaOficinaFolder = driveEnsureBibliotecaOficinaFolder;
  window.driveEnsureBibliotecaRepoFolder = driveEnsureBibliotecaRepoFolder;
  window.driveListFolderContents = driveListFolderContents;
  window.driveUploadBiblioteca = driveUploadBiblioteca;
}

// Sube archivo a carpeta de biblioteca.
async function driveUploadBiblioteca(blob, filename, mimeType, folderId) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo en la pestaña Correos.');
  if (!folderId) throw new Error('Carpeta de repositorio no definida.');
  const form = new FormData();
  const meta = { name: filename, mimeType: mimeType || 'application/octet-stream', parents: [folderId] };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob, filename);
  const res = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  const file = await res.json();
  if (!res.ok) throw new Error(file.error && file.error.message || 'Error subiendo archivo');
  await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }).catch(function() {});
  return {
    fileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    previewLink: 'https://drive.google.com/file/d/' + file.id + '/preview',
    nombre: filename
  };
}

// Sube un archivo al Drive institucional en la ruta correcta según tipo.
// tipo: 'radicacion_correo'|'radicacion_ventanilla'|'radicacion_oficio'|
//       'radicacion_otro'|'respuesta_borrador'|'respuesta_aprobada'|
//       'respuesta_pendiente'|'soporte_notificacion'|'caratula'
// pqrsNum: número del expediente, nombre: apellido o asunto para carpeta.
async function driveUploadInstitutional(blob, filename, mimeType, tipo, pqrsNum, nombreCarpeta, fechaRef) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo primero.');

  // Fecha de referencia para organizar año/mes (radicación o respuesta).
  let ref = fechaRef ? new Date(fechaRef) : new Date();
  if (isNaN(ref.getTime())) ref = new Date();
  const anio = ref.getFullYear().toString();
  const mes = DRIVE_MESES_ES[ref.getMonth()];

  // Segmentos de ruta dentro de la raíz institucional.
  // Radicación: Radicacion / {año} / {mes} / {medio} / PQRSD-{num}-{nombre}
  // Respuestas: Respuestas / {estado} / {año} / {mes} / PQRSD-{num}-{nombre}
  // Carátulas:  Caratulas / {año} / {mes} / PQRSD-{num}-{nombre}
  let segments;
  if (tipo && tipo.startsWith('radicacion')) {
    const medio = tipo === 'radicacion_correo'     ? 'Por-correo'  :
                  tipo === 'radicacion_ventanilla'  ? 'Ventanilla'  :
                  tipo === 'radicacion_oficio'      ? 'Oficio'      : 'Otros';
    segments = ['Radicacion', anio, mes, medio];
  } else if (tipo === 'respuesta_borrador') {
    segments = ['Respuestas', 'Pendiente-revision', anio, mes];
  } else if (tipo === 'respuesta_aprobada' || tipo === 'soporte_notificacion') {
    segments = ['Respuestas', 'Aprobadas', anio, mes];
  } else if (tipo === 'respuesta_pendiente' || tipo === 'respuesta_vital') {
    segments = ['Respuestas', 'Pendiente-gestion-vital', anio, mes];
  } else {
    segments = ['Caratulas', anio, mes];
  }

  // Crear (o reutilizar) la cadena de carpetas.
  let parent = DRIVE_ROOT_PQRSD_ID;
  for (const seg of segments) parent = await _driveEnsureFolder(token, seg, parent);
  let folderId = parent;
  if (pqrsNum) {
    const carpNom = 'PQRSD-' + pqrsNum + (nombreCarpeta ? '-' + nombreCarpeta.slice(0, 30) : '');
    folderId = await _driveEnsureFolder(token, carpNom, parent);
  }

  // Upload multipart
  const form = new FormData();
  const meta = { name: filename, mimeType: mimeType, parents: [folderId] };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob instanceof Blob ? blob : new Blob([blob], { type: mimeType }));
  const up = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form
  });
  if (!up.ok) { const t = await up.text().catch(() => ''); throw new Error('Drive upload ' + up.status + ': ' + t.slice(0, 120)); }
  const file = await up.json();

  // Compartir como lector público (anyoneWithLink)
  await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }).catch(() => {});

  return {
    fileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    previewLink: 'https://drive.google.com/file/d/' + file.id + '/preview',
    nombre: filename
  };
}

// Metadatos Drive para un expediente PQRSD (misma carpeta PQRSD-{núm}-{nombre} que radicación).
function pqrsExpDriveNombreCarpeta(e) {
  if (!e) return '';
  return String(e._qd_nombre || e._nombre || e._pn_nombre || e._exp || '').trim();
}

function pqrsExpDriveTipoRadicacion(e) {
  if (!e) return 'radicacion_otro';
  let wf = {};
  try { if (e._pqrs_workflow) wf = JSON.parse(e._pqrs_workflow); } catch (err) { wf = {}; }
  if (wf.tipo_radicacion) return wf.tipo_radicacion;
  if (e._gmail_message_id) return 'radicacion_correo';
  return typeof tipoRadicacionDesdeMedioPqrs === 'function'
    ? tipoRadicacionDesdeMedioPqrs(e.f_f2 || '')
    : 'radicacion_otro';
}

function pqrsExpDriveFechaRef(e) {
  if (!e) return '';
  return e._fecha_solicitud || e._fecha || '';
}

async function driveUploadPqrsExpediente(blob, filename, mimeType, e, opts) {
  opts = opts || {};
  if (!e || typeof esPqrsSecretaria !== 'function' || !esPqrsSecretaria(e)) {
    throw new Error('No es un expediente PQRSD');
  }
  const expId = String(e._exp || '').trim();
  const nombreCarpeta = pqrsExpDriveNombreCarpeta(e);
  const tipo = opts.tipo || pqrsExpDriveTipoRadicacion(e);
  const fechaRef = opts.fechaRef || pqrsExpDriveFechaRef(e);
  const safeLabel = String(opts.label || filename || 'Documento').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
  const safeFile = String(filename || 'archivo').replace(/[<>:"/\\|?*]/g, '_');
  const driveName = opts.driveName || (safeLabel + ' PQRSD ' + expId + ' ' + safeFile).slice(0, 180);
  return driveUploadInstitutional(blob, driveName, mimeType || 'application/octet-stream', tipo, expId, nombreCarpeta, fechaRef);
}

// Versión base64url para adjuntos de correo (usa la misma infraestructura).
async function driveUploadInstitutionalB64(filename, mimeType, base64urlData, tipo, pqrsNum, nombreCarpeta) {
  const b64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return driveUploadInstitutional(blob, filename, mimeType, tipo, pqrsNum, nombreCarpeta);
}

// ----------------------------------------------------------------
// Drive chat interno — carpeta institucional con retención 30 días
// ----------------------------------------------------------------
async function driveUploadChat(blob, filename, mimeType) {
  const token = _driveGetBestToken();
  if (!token) throw new Error('Sin token Gmail/Drive. Conecte su correo desde el chat o la pestaña Correos.');

  const ref = new Date();
  const anio = ref.getFullYear().toString();
  const mes = DRIVE_MESES_ES[ref.getMonth()];
  let folderId = DRIVE_ROOT_CHAT_ID;
  try {
    const yId = await _driveEnsureFolder(token, anio, DRIVE_ROOT_CHAT_ID);
    if (yId) folderId = yId;
    const mId = await _driveEnsureFolder(token, mes, folderId);
    if (mId) folderId = mId;
  } catch (e) { console.warn('driveUploadChat folder:', e.message); }
  if (!folderId) folderId = DRIVE_ROOT_CHAT_ID;

  const safeName = String(filename || 'archivo').replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 120);
  const uploadName = ref.toISOString().slice(0, 10) + ' ' + safeName;
  const retentionDays = (typeof CHAT_DRIVE_RETENTION_DIAS !== 'undefined') ? CHAT_DRIVE_RETENTION_DIAS : 30;
  const expiresAt = new Date(ref.getTime() + retentionDays * 86400000).toISOString();

  const form = new FormData();
  const meta = { name: uploadName, mimeType: mimeType || 'application/octet-stream', parents: [folderId] };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob instanceof Blob ? blob : new Blob([blob], { type: mimeType || 'application/octet-stream' }));
  const up = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: form
  });
  if (!up.ok) {
    const t = await up.text().catch(function() { return ''; });
    let hint = '';
    if (up.status === 403) {
      hint = ' Verifique que su correo tenga permiso de edición en la carpeta del chat institucional.';
    }
    throw new Error('Drive upload ' + up.status + ': ' + t.slice(0, 120) + hint);
  }
  const file = await up.json();
  if (!file || !file.id) throw new Error('Drive no devolvió el archivo subido.');

  await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  }).catch(function() {});

  return {
    fileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    previewLink: 'https://drive.google.com/file/d/' + file.id + '/preview',
    nombre: uploadName,
    expiresAt: expiresAt
  };
}

async function driveDeleteFile(fileId) {
  const token = _driveGetBestToken();
  if (!token || !fileId) return false;
  const res = await fetch(DRIVE_API_BASE + '/files/' + encodeURIComponent(fileId), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return res.ok || res.status === 404;
}

async function chatRegisterDrivePurge(fileId, data) {
  const db = window._db;
  if (!db || !window._fsSetDoc || !window._fsDoc || !fileId) return;
  await window._fsSetDoc(window._fsDoc(db, 'chat_drive_purge', fileId), Object.assign({ fileId: fileId }, data), { merge: true });
}

async function chatDeleteDriveForMessage(m) {
  if (!m || !m.file || !m.file.fileId) return;
  const fileId = m.file.fileId;
  try { await driveDeleteFile(fileId); } catch (e) { console.warn('chatDeleteDriveForMessage:', e.message); }
  const db = window._db;
  if (db && window._fsDeleteDoc && window._fsDoc) {
    try { await window._fsDeleteDoc(window._fsDoc(db, 'chat_drive_purge', fileId)); } catch (e) {}
  }
}

async function chatPurgeExpiredDriveFiles() {
  if (!document.body.classList.contains('sesion-activa')) return false;
  if (!_driveGetBestToken()) return false;
  const db = window._db;
  if (!db || !window._fsGetDocs || !window._fsCollection || !window._fsDeleteDoc || !window._fsDoc) return false;

  const now = new Date().toISOString();
  let purged = false;
  try {
    const snap = await window._fsGetDocs(window._fsCollection(db, 'chat_drive_purge'));
    const expired = snap.docs.filter(function(d) {
      const exp = d.data().expiresAt || '';
      return exp && exp < now;
    });
    for (let i = 0; i < expired.length; i++) {
      const docSnap = expired[i];
      const data = docSnap.data();
      const fileId = data.fileId || docSnap.id;
      await driveDeleteFile(fileId);
      if (data.msgId && data.fsConvId && window._fsUpdateDoc && window._fsDeleteField) {
        try {
          await window._fsUpdateDoc(
            window._fsDoc(db, 'chats', data.fsConvId, 'mensajes', data.msgId),
            { 'file.fileId': window._fsDeleteField(), 'file.driveDeleted': true }
          );
        } catch (e) {}
      }
      await window._fsDeleteDoc(window._fsDoc(db, 'chat_drive_purge', docSnap.id));
      if (typeof chatMensajes !== 'undefined' && Array.isArray(chatMensajes)) {
        chatMensajes.forEach(function(m) {
          if (m.id === data.msgId && m.file) {
            delete m.file.fileId;
            m.file.driveDeleted = true;
          }
        });
      }
      purged = true;
    }
  } catch (err) {
    console.error('chatPurgeExpiredDriveFiles:', err);
  }
  return purged;
}

// Genera un PDF (soporte de solicitud) a partir del contenido del correo.
// Replica la idea de "imprimir el correo en PDF" como soporte de radicación.
// Devuelve un Blob application/pdf, o null si jsPDF no está disponible.
async function generarPdfSolicitudCorreo(emailData, expId) {
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  if (!jsPDFCtor) return null;
  const ed = emailData || {};
  const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('SOPORTE DE SOLICITUD — PQRSD', margin, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text('Corporación CDA — Radicación por correo electrónico', margin, y); y += 16;
  doc.setTextColor(0);
  if (expId) { doc.setFont('helvetica', 'bold'); doc.text('Radicado: PQRSD #' + expId, margin, y); y += 16; }
  doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 18;

  const meta = [
    ['Remitente:', ed.remitente || ''],
    ['Fecha:', ed.fecha || ''],
    ['Asunto:', ed.asunto || '']
  ];
  doc.setFontSize(10);
  meta.forEach(function(row) {
    doc.setFont('helvetica', 'bold'); doc.text(row[0], margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(row[1] || ''), maxW - 70);
    doc.text(lines, margin + 70, y);
    y += Math.max(15, lines.length * 14);
  });
  y += 6; doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Contenido de la solicitud:', margin, y); y += 16;
  doc.setFont('helvetica', 'normal');
  const cuerpo = String(ed.cuerpoTxt || ed.asunto || '(sin contenido de texto)').replace(/\r/g, '');
  const bodyLines = doc.splitTextToSize(cuerpo, maxW);
  const lineH = 13;
  for (let i = 0; i < bodyLines.length; i++) {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(bodyLines[i], margin, y); y += lineH;
  }

  // Nota de anexos (no se suben al Drive; llegan al correo de la oficina).
  if (ed.adjuntosInfo && ed.adjuntosInfo.length) {
    y += 10; if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 16;
    doc.setFont('helvetica', 'bold'); doc.text('Anexos del correo original (' + ed.adjuntosInfo.length + '):', margin, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    ed.adjuntosInfo.forEach(function(a) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text('• ' + (a.nombre || 'adjunto'), margin + 6, y); y += 12;
    });
    doc.setTextColor(0);
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFontSize(8); doc.setTextColor(130);
    doc.text('Los anexos no se almacenan en Drive; se conservan en el correo reenviado a la oficina responsable.', margin, y);
    doc.setTextColor(0);
  }

  return doc.output('blob');
}

function tipoRadicacionDesdeMedioPqrs(medio) {
  const m = typeof normMedioRecepcionPqrs === 'function' ? normMedioRecepcionPqrs(medio || '') : String(medio || '');
  if (m === 'Ventanilla') return 'radicacion_ventanilla';
  return 'radicacion_otro';
}

function _pdfMedioRadicacionLabel(medio) {
  const m = typeof normMedioRecepcionPqrs === 'function' ? normMedioRecepcionPqrs(medio || '') : String(medio || '');
  if (m === 'Ventanilla') return 'Radicación en ventanilla';
  if (m === 'Teléfono') return 'Radicación por teléfono';
  if (m === 'Web') return 'Radicación por página web';
  return 'Radicación — ' + (m || 'otro medio');
}

function _pdfWriteLines(doc, lines, x, y, lineH, pageH, margin) {
  for (let i = 0; i < lines.length; i++) {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(lines[i], x, y);
    y += lineH;
  }
  return y;
}

// PDF soporte para radicación manual (ventanilla, teléfono, web, etc.).
async function generarPdfSolicitudManual(opts) {
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  if (!jsPDFCtor) return null;
  opts = opts || {};
  const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 13;
  const expId = opts.expId || '';
  const medio = opts.medio || 'Ventanilla';

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('SOPORTE DE SOLICITUD — PQRSD', margin, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text('Corporación CDA — ' + _pdfMedioRadicacionLabel(medio), margin, y); y += 16;
  doc.setTextColor(0);
  if (expId) { doc.setFont('helvetica', 'bold'); doc.text('Radicado: PQRSD #' + expId, margin, y); y += 16; }
  doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 18;

  const meta = [
    ['Tipo:', opts.tipo || 'Petición'],
    ['Medio recepción:', typeof normMedioRecepcionPqrs === 'function' ? normMedioRecepcionPqrs(medio) : medio],
    ['Fecha solicitud:', typeof fmtF === 'function' ? fmtF(opts.fechaSol || '') : (opts.fechaSol || '')],
    ['Fecha radicación:', typeof fmtF === 'function' ? fmtF(opts.fecha || '') : (opts.fecha || '')]
  ];
  if (opts.fechaTermino) meta.push(['Fecha término:', typeof fmtF === 'function' ? fmtF(opts.fechaTermino) : opts.fechaTermino]);
  if (typeof medioNotificacionLabel === 'function' && opts.medioNotif) {
    meta.push(['Medio notificación:', medioNotificacionLabel(opts.medioNotif)]);
  }
  doc.setFontSize(10);
  meta.forEach(function(row) {
    doc.setFont('helvetica', 'bold'); doc.text(row[0], margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(row[1] || ''), maxW - 90);
    y = _pdfWriteLines(doc, lines, margin + 90, y, 14, pageH, margin);
    y += 2;
  });
  y += 4; doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.text('Interesado', margin, y); y += 16;
  doc.setFont('helvetica', 'normal');
  if (opts.anon) {
    y = _pdfWriteLines(doc, ['Solicitud anónima'], margin, y, lineH, pageH, margin);
  } else {
    const inter = [
      ['Nombre / entidad:', opts.nombre || ''],
      ['Identificación:', opts.ident || ''],
      ['Correo:', opts.correo || ''],
      ['Teléfono:', opts.tel || '']
    ];
    if (opts.tipoPersona === 'juridica' && opts.pjEmpresa) {
      inter.unshift(['Razón social:', opts.pjEmpresa]);
      if (opts.pjNit) inter.splice(1, 0, ['NIT:', opts.pjNit]);
    }
    inter.forEach(function(row) {
      if (!row[1]) return;
      doc.setFont('helvetica', 'bold'); doc.text(row[0], margin, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(row[1]), maxW - 100);
      y = _pdfWriteLines(doc, lines, margin + 100, y, 14, pageH, margin);
      y += 2;
    });
  }
  y += 4; doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.text('Asunto:', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = _pdfWriteLines(doc, doc.splitTextToSize(String(opts.asunto || ''), maxW), margin, y, lineH, pageH, margin);
  y += 8;
  doc.setFont('helvetica', 'bold'); doc.text('Detalle de la solicitud:', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  const detalle = String(opts.detalle || opts.asunto || '(sin detalle adicional)').replace(/\r/g, '');
  y = _pdfWriteLines(doc, doc.splitTextToSize(detalle, maxW), margin, y, lineH, pageH, margin);

  const anexosNombres = opts.anexosNombres || [];
  if (anexosNombres.length) {
    y += 10; if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setDrawColor(190); doc.line(margin, y, pageW - margin, y); y += 16;
    doc.setFont('helvetica', 'bold'); doc.text('Anexos digitales (' + anexosNombres.length + '):', margin, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    anexosNombres.forEach(function(n) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text('• ' + n, margin + 6, y); y += 12;
    });
    doc.setTextColor(0); doc.setFontSize(10);
  }

  return doc.output('blob');
}

// Radicación manual: genera PDF soporte + sube anexos al Drive institucional (misma carpeta PQRSD).
async function subirSoporteRadicacionManual(opts) {
  opts = opts || {};
  const expId = String(opts.expId || '').trim();
  const tipoRad = opts.tipoRadicacion || tipoRadicacionDesdeMedioPqrs(opts.medio);
  const fechaRef = opts.fecha || '';
  const nombreCarpeta = String(opts.nombreCarpeta || opts.nombre || opts.asunto || '').trim();
  const anexosFiles = Array.isArray(opts.anexosFiles) ? opts.anexosFiles.filter(Boolean) : [];
  const anexosNombres = anexosFiles.map(function(f) { return f.name || 'anexo'; });

  if (!_driveGetBestToken()) {
    if (anexosFiles.length) {
      throw new Error('Sin token Gmail/Drive para subir anexos.');
    }
    return { soporte: null, anexos: [], all: [], link: '' };
  }

  const uploaded = [];
  let soporte = null;
  try {
    notif('🖨️ Generando soporte PDF y subiendo al Drive institucional…', 'info');
    const pdfBlob = await generarPdfSolicitudManual(Object.assign({}, opts, { anexosNombres: anexosNombres }));
    if (pdfBlob) {
      const asuntoSlug = String(opts.asunto || 'solicitud').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
      soporte = await driveUploadInstitutional(
        pdfBlob,
        'Solicitud_PQRSD-' + expId + '_' + asuntoSlug + '.pdf',
        'application/pdf',
        tipoRad,
        expId,
        nombreCarpeta,
        fechaRef
      );
      uploaded.push(soporte);
    } else {
      notif('⚠️ No se pudo generar el PDF (jsPDF no disponible).', 'warn');
    }

    for (let i = 0; i < anexosFiles.length; i++) {
      const file = anexosFiles[i];
      const origName = file.name || ('anexo-' + (i + 1));
      const safeName = origName.replace(/[<>:"/\\|?*]/g, '_');
      const driveName = 'ANEXO PQRSD ' + expId + ' ' + safeName;
      const up = await driveUploadInstitutional(
        file,
        driveName,
        file.type || 'application/octet-stream',
        tipoRad,
        expId,
        nombreCarpeta,
        fechaRef
      );
      up.nombre = driveName;
      uploaded.push(up);
    }

    if (soporte) {
      const extra = uploaded.length > 1 ? ' y ' + (uploaded.length - 1) + ' anexo(s)' : '';
      notif('✅ Soporte PDF' + extra + ' subido(s) al Drive institucional.', 'ok');
    } else if (uploaded.length) {
      notif('✅ ' + uploaded.length + ' anexo(s) subido(s) al Drive institucional.', 'ok');
    }
  } catch (e) {
    console.warn('subirSoporteRadicacionManual:', e);
    notif('⚠️ No se pudo subir el soporte al Drive: ' + (e.message || 'revise la conexión Gmail'), 'warn');
  }

  return {
    soporte: soporte,
    anexos: uploaded.filter(function(u) { return u !== soporte; }),
    all: uploaded,
    link: soporte ? soporte.driveLink : (uploaded[0] ? uploaded[0].driveLink : '')
  };
}

// Auto-upload del soporte al radicar desde correo si aún no se ha subido.
// Genera un PDF del correo (la solicitud) y lo sube al Drive institucional.
// Los anexos NO se suben: ya llegan al correo de la oficina responsable.
// Llamada desde pqrs.js antes de guardar el expediente.
async function gmailAutoUploadPendingAttachments(expIdHint, nombreHint) {
  if (!window._gmailPendingMsgId) return;           // no viene de Gmail
  if (window._gmailPendingAttachments && window._gmailPendingAttachments.length) return; // ya subido
  const ed = window._gmailPendingEmailData;
  if (!_gmailCurrentMsg || _gmailCurrentMsg.id !== window._gmailPendingMsgId) return; // sin msg en memoria
  if (!gmailIsTokenValid()) {
    notif('⚠️ La sesión de Gmail expiró. El soporte NO se vinculará a este PQRSD. Reconecte la bandeja y vuelva a radicar.', 'err');
    return;
  }
  try {
    notif('🖨️ Generando PDF de la solicitud y subiéndolo al Drive…', 'info');
    const asunto = ((ed && ed.asunto) || 'solicitud').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    let soporte = null;

    // 1) Intentar PDF (soporte preferido).
    const pdfBlob = await generarPdfSolicitudCorreo(ed || {}, expIdHint);
    if (pdfBlob) {
      soporte = await driveUploadInstitutional(
        pdfBlob, 'Solicitud_PQRSD-' + (expIdHint || '') + '_' + asunto + '.pdf',
        'application/pdf', 'radicacion_correo', expIdHint || '', nombreHint || ''
      );
    } else if (ed && ed.cuerpoHtml) {
      // 2) Respaldo: subir el cuerpo como HTML si jsPDF no está disponible.
      const htmlBlob = new Blob([ed.cuerpoHtml], { type: 'text/html' });
      soporte = await driveUploadInstitutional(
        htmlBlob, 'Solicitud_PQRSD-' + (expIdHint || '') + '_' + asunto + '.html',
        'text/html', 'radicacion_correo', expIdHint || '', nombreHint || ''
      );
    }

    if (soporte) {
      window._gmailPendingAttachments = [soporte];
      notif('✅ Soporte de la solicitud subido al Drive institucional. Los anexos quedan en el correo de la oficina.', 'ok');
    } else {
      notif('⚠️ No se pudo generar el soporte PDF. El correo se reenvió a la oficina con sus anexos.', 'warn');
    }
  } catch (e) {
    console.warn('gmailAutoUploadPendingAttachments:', e.message);
  }
}

async function subirAdjuntosEmailADrive(msg, expIdHint, nombreHint) {
  const parts = gmailExtractParts(msg.payload);
  const results = [];
  const pqrsNum = expIdHint || '';
  const nombreCarpeta = nombreHint || '';
  for (const att of parts.attachments) {
    if (!att.attachmentId) continue;
    try {
      const data = await gmailGetAttachment(msg.id, att.attachmentId);
      let file;
      if (_driveEsGuaviare()) {
        // Use institutional Drive with correct folder type
        file = await driveUploadInstitutionalB64(att.filename, att.mimeType || 'application/octet-stream', data, 'radicacion_correo', pqrsNum, nombreCarpeta);
      } else {
        file = await driveUploadFile(att.filename, att.mimeType, data);
      }
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
// Alias used by core.js workflow (sends via secretary token)
async function gmailSendMessage(to, subject, htmlBody) {
  return gmailSend(to, subject, htmlBody);
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

// Envío legacy al ciudadano (Secretaría). El flujo PQRSD usa confirmarEnvioRespuestaEmailPqrs en core.js.
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

// confirmarEnvioRespuestaEmailPqrs → definido en js/core.js (Sprint 7)

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
  if (typeof _updateGmailOfiBtn === 'function') _updateGmailOfiBtn();
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
const GMAIL_OFI_ACCOUNT_KEY = 'sst_gmail_ofi_account';
// drive.file: needed for offices to upload to the institutional shared Drive folder
const GMAIL_OFI_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
].join(' ');
const GMAIL_OFI_SYS_LABELS = new Set([
  'INBOX','UNREAD','SENT','DRAFT','IMPORTANT','STARRED',
  'SPAM','TRASH','CATEGORY_SOCIAL','CATEGORY_UPDATES',
  'CATEGORY_FORUMS','CATEGORY_PROMOTIONS'
]);

let _gmailOfiTokenClient = null;
let _gmailOfiMessages    = [];
let _gmailOfiCurrentMsg  = null;
let _gmailOfiActiveFolder = 'INBOX';
let _gmailOfiLabels      = [];

// ---- Token helpers ----
function gmailOfiGetToken() {
  try { return sessionStorage.getItem(GMAIL_OFI_TOKEN_KEY) || ''; } catch(e) { return ''; }
}
function gmailOfiSetToken(tok, expiresInSec, accountEmail) {
  try {
    if (tok) {
      sessionStorage.setItem(GMAIL_OFI_TOKEN_KEY, tok);
      sessionStorage.setItem(GMAIL_OFI_TOKEN_EXP_KEY, String(Date.now() + (expiresInSec || 3600) * 1000));
      if (accountEmail) sessionStorage.setItem(GMAIL_OFI_ACCOUNT_KEY, String(accountEmail).trim().toLowerCase());
    } else {
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_EXP_KEY);
      sessionStorage.removeItem(GMAIL_OFI_ACCOUNT_KEY);
    }
  } catch(e) {}
}
async function _gmailFetchProfileEmail(token) {
  if (!token) return '';
  const res = await fetch(GMAIL_API_BASE + '/profile', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!res.ok) throw new Error('No se pudo verificar la cuenta de correo (' + res.status + ')');
  const data = await res.json();
  return String(data.emailAddress || '').trim().toLowerCase();
}
async function _gmailOfiValidarYGuardarToken(tok, expiresInSec) {
  let email = '';
  try {
    email = await _gmailFetchProfileEmail(tok);
  } catch (err) {
    notif('Error al verificar cuenta Gmail: ' + String(err.message || err).slice(0, 100), 'err');
    return false;
  }
  gmailOfiSetToken(tok, expiresInSec, email);
  return true;
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
  if (_gmailOfiIsSecretaria()) {
    if (gmailIsTokenValid()) {
      _updateGmailOfiBtn();
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      if (!_gmailOfiSignature) _gmailOfiLoadSignature();
      return;
    }
    gmailConnect(function() {
      _updateGmailOfiBtn();
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      _gmailOfiLoadSignature();
    });
    return;
  }
  _gmailStartOAuth(GMAIL_OFI_SCOPES, async function(tok, exp) {
    const ok = await _gmailOfiValidarYGuardarToken(tok, exp);
    if (!ok) {
      _updateGmailOfiBtn();
      return;
    }
    _updateGmailOfiBtn();
    notif('✅ Correo conectado.', 'ok');
    gmailOfiFolder('INBOX');
    gmailOfiLoadLabels();
    _gmailOfiLoadSignature();
  });
}
window.gmailOfiConnect = gmailOfiConnect;

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
  const connecting = _gmailConnecting;
  if (connecting) {
    btn.textContent = '⏳ Conectando…';
    return;
  }
  const valid = _gmailOfiTokenValid();
  if (valid) {
    btn.textContent = '🔌 Desconectar';
    btn.onclick = gmailOfiDisconnect;
  } else {
    btn.textContent = '📧 Conectar mi correo';
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

  // Responder PQRSD: permite a cualquier oficina vincular este correo como respuesta oficial
  const pqrsRelacionada = _gmailOfiCurrentMsg ? _gmailOfiCurrentMsg._pqrsVinculada || '' : '';
  const respPqrsBtn = '<button type="button" class="gm-action-btn" style="background:var(--bll);border:1px solid var(--bl);color:var(--bl)" onclick="gmailOfiVincularRespuestaPqrs()" title="Abrir modal para elegir PQRSD y registrar este correo como respuesta oficial">📨 Responder PQRSD</button>';

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
        (replyEmail ? '<button type="button" class="gm-action-btn" onclick="gmailOfiReplyCurrent()">↩ Responder</button>' : '') +
        '<button type="button" class="gm-action-btn" onclick="gmailOfiForwardCurrent()">↪ Reenviar</button>' +
        respPqrsBtn +
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

function gmailOfiReplyCurrent() {
  const msg = _gmailOfiCurrentMsg;
  if (!msg) return;
  const headers = (msg.payload && msg.payload.headers) || [];
  const h = n => (headers.find(x => x.name.toLowerCase() === n.toLowerCase()) || {}).value || '';
  const from = h('From'), replyTo = h('Reply-To'), subject = h('Subject'), msgId = h('Message-Id');
  const fromParsed = gmailParseFrom(from);
  const replyEmail = (replyTo ? gmailParseFrom(replyTo).email : '') || fromParsed.email || '';
  const replySubj  = subject.startsWith('Re:') ? subject : 'Re: ' + subject;
  gmailOfiOpenCompose({ to: replyEmail, subject: replySubj, inReplyTo: msgId, title: 'Responder' });
}

function gmailOfiForwardCurrent() {
  const msg = _gmailOfiCurrentMsg;
  if (!msg) return;
  const headers = (msg.payload && msg.payload.headers) || [];
  const h = n => (headers.find(x => x.name.toLowerCase() === n.toLowerCase()) || {}).value || '';
  const from = h('From'), date = h('Date'), to = h('To'), subject = h('Subject');
  const fwdSubj = subject.startsWith('Fwd:') ? subject : 'Fwd: ' + subject;
  const parts   = gmailExtractParts(msg.payload || {});
  const fwdBody = '\n\n--- Mensaje reenviado ---\nDe: ' + from + '\nFecha: ' + date + '\nPara: ' + to + '\nAsunto: ' + subject + '\n\n' + (parts.textPlain || '');
  gmailOfiOpenCompose({ subject: fwdSubj, body: fwdBody, title: 'Reenviar' });
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

// Alias used by core.js workflow — sends a plain HTML email using the office token
async function gmailOfiSendMessage(to, subject, htmlBody) {
  const mime = _gmailOfiBuildMime(to, '', subject, htmlBody, '');
  return _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: mime });
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

// Extrae el número de radicado del asunto, ej. "[PQRSD #707]" → "707".
function _gmailExtractRadicadoFromSubject(subject) {
  if (!subject) return '';
  const m = String(subject).match(/PQRSD\s*[#N°ºo:.\-]*\s*([A-Za-z0-9\-]+)/i);
  return m ? m[1].trim() : '';
}

// Busca un expediente PQRSD abierto cuyo radicado coincide con el token del asunto.
function _gmailFindPqrsByRadicado(token) {
  const norm = function(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
  const t = norm(token);
  if (!t) return null;
  const list = _gmailPqrsRespCandidatas();
  let hit = list.find(function(e){ return norm(e._exp) === t; });
  if (hit) return hit;
  hit = list.find(function(e){ var n = norm(e._exp); return n && (n.endsWith(t) || t.endsWith(n)); });
  return hit || null;
}

// PQRSD abiertas elegibles para vincular como respuesta (solo radicadas por Secretaría, no trámites).
function _gmailPqrsRespCandidatas() {
  const depto = typeof deptoActivo !== 'undefined' ? deptoActivo : '';
  return (typeof exps !== 'undefined' ? exps : []).filter(function(e) {
    if (!e || typeof esPqrsSecretaria !== 'function' || !esPqrsSecretaria(e)) return false;
    if (typeof pqrsEstaCerrada === 'function' && pqrsEstaCerrada(e)) return false;
    if (e._pqrs_oficina && e._pqrs_oficina !== depto &&
        !(typeof esNcaDeguv === 'function' && esNcaDeguv() && e._pqrs_oficina === 'guaviare') &&
        !(typeof esCargoVital === 'function' && esCargoVital())) return false;
    return true;
  });
}

function gmailFiltrarPqrsRespSug(inp) {
  const q = (inp && inp.value || '').trim().toLowerCase();
  const box = document.getElementById('gmail-resp-pqrs-sug');
  if (!box) return;
  // Solo buscar cuando el usuario escribe (no al abrir/focus). Números: 1+ dígito; texto: 2+ chars.
  const minLen = /^\d+$/.test(q) ? 1 : 2;
  if (q.length < minLen) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  const list = _gmailPqrsRespCandidatas().filter(function(e) {
    const num = String(e._exp || '').toLowerCase();
    const asunto = String(e.f_f1 || e._pqrs_detalle || '').toLowerCase();
    const nom = (typeof getNom === 'function' ? getNom(e) : '').toLowerCase();
    return num.includes(q) || asunto.includes(q) || nom.includes(q);
  }).slice(0, 10);
  window._gmailPqrsRespSugList = list;
  if (!list.length) {
    box.style.display = 'block';
    box.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--tx3)">Sin coincidencias. Pruebe con el número o parte del asunto.</div>';
    return;
  }
  box.style.display = 'block';
  box.innerHTML = list.map(function(ex, i) {
    const asunto = ex.f_f1 || ex._pqrs_detalle || '—';
    return '<button type="button" style="display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-bottom:1px solid var(--bd);background:var(--sf);cursor:pointer;font-size:12px;font-family:\'DM Sans\',sans-serif" onmousedown="event.preventDefault();gmailPickPqrsRespSug(' + i + ')">' +
      '<strong style="font-family:\'DM Mono\',monospace">' + escAttr(ex._exp) + '</strong> — ' + escAttr(asunto.slice(0, 70)) + '</button>';
  }).join('');
}

function gmailTogglePqrsRespSearch(show) {
  const wrap = document.getElementById('gmail-resp-pqrs-search-wrap');
  const toggle = document.getElementById('gmail-resp-pqrs-toggle-search');
  const search = document.getElementById('gmail-resp-pqrs-search');
  const sug = document.getElementById('gmail-resp-pqrs-sug');
  if (!wrap) return;
  const abrir = show === undefined ? wrap.style.display === 'none' : !!show;
  wrap.style.display = abrir ? '' : 'none';
  if (toggle) toggle.style.display = abrir ? 'none' : '';
  if (sug && !abrir) { sug.style.display = 'none'; sug.innerHTML = ''; }
  if (search) {
    if (abrir) { search.value = ''; setTimeout(function(){ search.focus(); }, 60); }
    else search.value = '';
  }
}

function gmailSetPqrsRespSel(e, opts) {
  opts = opts || {};
  const hid = document.getElementById('gmail-resp-pqrs-hid');
  const chip = document.getElementById('gmail-resp-pqrs-chip');
  const sug = document.getElementById('gmail-resp-pqrs-sug');
  if (hid) hid.value = e ? String(e._exp || '').trim() : '';
  if (chip) {
    if (e) {
      const asunto = e.f_f1 || e._pqrs_detalle || '—';
      const det = opts.detectada ? ' <span style="font-weight:400;font-size:11px;color:var(--tx2)">— detectada del asunto</span>' : '';
      chip.style.display = '';
      chip.innerHTML =
        '<div style="padding:10px 12px;background:var(--bll);border:1px solid var(--bl);border-radius:var(--r)">' +
        '<div style="font-weight:600;color:var(--bl);font-size:13px">📌 PQRSD #' + escAttr(e._exp) + det + '</div>' +
        '<div style="font-size:12px;color:var(--tx2);margin-top:2px">' + escAttr(asunto.slice(0, 90)) + '</div>' +
        '</div>';
      gmailTogglePqrsRespSearch(false);
    } else {
      chip.style.display = 'none';
      chip.innerHTML = '';
    }
  }
  if (sug) { sug.style.display = 'none'; sug.innerHTML = ''; }
  if (e && !opts.keepEmail) {
    const emailInp = document.getElementById('gmail-resp-pqrs-email');
    const ciud = (e._qd_correo || e._pn_correo || '').trim();
    if (emailInp && ciud) emailInp.value = ciud;
  }
}

function gmailPickPqrsRespSug(idx) {
  const ex = (window._gmailPqrsRespSugList || [])[idx];
  if (!ex) return;
  gmailSetPqrsRespSel(ex);
}

function gmailClearPqrsRespSel() {
  gmailSetPqrsRespSel(null);
  gmailTogglePqrsRespSearch(true);
}

// ---- Responder PQRSD desde Correos (todas las oficinas) ----
function gmailOfiVincularRespuestaPqrs() {
  const msg = _gmailOfiCurrentMsg;
  const headers = msg && msg.payload && msg.payload.headers ? msg.payload.headers : [];
  const findH = function(n){ var h = headers.find(function(x){ return x.name === n; }); return h ? (h.value || '') : ''; };
  const fromEmail = _gmailOfiParseFrom(findH('From'));
  const subject = findH('Subject');

  const radTok = _gmailExtractRadicadoFromSubject(subject);
  const detectada = radTok ? _gmailFindPqrsByRadicado(radTok) : null;

  if (typeof abrirPqrsModalPrep === 'function') abrirPqrsModalPrep();
  const ov = document.getElementById('task-modal-overlay');
  const tit = document.getElementById('task-modal-title');
  const body = document.getElementById('task-modal-body');
  const modal = ov ? ov.querySelector('.task-modal') : null;
  if (!ov || !body) return;
  if (tit) tit.textContent = 'Vincular correo como respuesta PQRSD';
  if (modal) { modal.classList.remove('task-modal-wide'); modal.classList.add('task-modal-wide'); }

  const emailCiu = detectada ? (detectada._qd_correo || detectada._pn_correo || fromEmail.email || '') : (fromEmail.email || '');
  const usaDriveInst = typeof DRIVE_INST_DEPTOS !== 'undefined' && DRIVE_INST_DEPTOS.has((typeof deptoActivo !== 'undefined' ? deptoActivo : '') || (typeof deptoCfg !== 'undefined' ? deptoCfg : '') || '');
  const hayToken = (typeof gmailOfiIsTokenValid === 'function' && gmailOfiIsTokenValid()) || (typeof gmailIsTokenValid === 'function' && gmailIsTokenValid());
  const adjBtns =
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px">' +
    (usaDriveInst && hayToken ? '<button type="button" class="btn bsm" onclick="addPqrsRespAdjFile(\'gmail-resp-adj-rows\')">📎 Adjuntar archivo</button>' : '') +
    '<button type="button" class="btn bsm" onclick="addPqrsRespAdjRow(\'gmail-resp-adj-rows\')">🔗 + Link Drive</button>' +
    '</div>';
  const adjInfo = usaDriveInst
    ? '<div style="font-size:11px;color:var(--tx2);margin-top:4px">' + (hayToken ? 'Los archivos se suben al Drive institucional en <em>Respuestas → Aprobadas → año → mes → PQRSD-{número}</em>.' : 'Conecte su correo para subir archivos al Drive.') + '</div>'
    : '<div style="font-size:11px;color:var(--tx2);margin-top:4px">Pegue links de Drive de su carpeta personal.</div>';

  body.innerHTML =
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Este correo quedará registrado como la notificación oficial enviada al ciudadano y cerrará la PQRSD.</div>' +

    '<div class="fld" style="margin-bottom:10px"><label>PQRSD a cerrar</label>' +
    '<input type="hidden" id="gmail-resp-pqrs-hid" value="">' +
    '<div id="gmail-resp-pqrs-chip" style="display:none;margin-top:4px;margin-bottom:6px"></div>' +
    '<button type="button" class="btn bsm bd2" id="gmail-resp-pqrs-toggle-search" style="margin-top:4px;font-size:12px" onclick="gmailTogglePqrsRespSearch(true)">🔍 Buscar otra PQRSD</button>' +
    '<div id="gmail-resp-pqrs-search-wrap" style="display:none;margin-top:6px">' +
    '<div style="position:relative">' +
    '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;opacity:.5;pointer-events:none">🔍</span>' +
    '<input type="text" id="gmail-resp-pqrs-search" placeholder="Escriba número, asunto o interesado…" style="width:100%;padding:8px 8px 8px 32px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box" oninput="gmailFiltrarPqrsRespSug(this)">' +
    '</div>' +
    '<div id="gmail-resp-pqrs-sug" style="max-height:160px;overflow:auto;border:1px solid var(--bd);border-radius:var(--r);margin-top:4px;display:none"></div>' +
    '<button type="button" class="btn bsm" style="margin-top:6px;font-size:11px" onclick="gmailTogglePqrsRespSearch(false)">Cancelar búsqueda</button>' +
    '</div></div>' +

    '<div class="fg" style="margin-bottom:10px">' +
    '<div class="fld"><label>Fecha de la respuesta</label><input type="date" id="gmail-resp-pqrs-fecha" value="' + (typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0,10)) + '"></div>' +
    '<div class="fld"><label>N° de oficio <span style="font-weight:400;color:var(--tx3)">(si aplica)</span></label><input type="text" id="gmail-resp-pqrs-oficio" placeholder="OFI-2026-045"></div>' +
    '</div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Correo del ciudadano al que se respondió</label>' +
    '<input type="email" id="gmail-resp-pqrs-email" value="' + escAttr(emailCiu) + '" style="margin-top:4px"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Resumen de la respuesta</label>' +
    '<textarea id="gmail-resp-pqrs-cuerpo" placeholder="Resuma la respuesta enviada por correo…" style="min-height:68px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px">' + escAttr(subject) + '</textarea></div>' +

    '<div class="fld" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Documentos de la respuesta</label>' + adjInfo +
    '<div id="gmail-resp-adj-rows" style="margin-top:6px"></div>' + adjBtns + '</div>' +

    '<div class="fx" style="gap:8px;flex-wrap:wrap">' +
    '<button type="button" class="btn bsm bp" id="gmail-resp-pqrs-submit" onclick="gmailOfiConfirmarRespuestaPqrs()">✅ Registrar como respuesta oficial</button>' +
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>' +
    '</div>';

  ov.classList.add('on');
  window._taskModalCtx = { mode: 'gmailVincularPqrs' };
  if (detectada) {
    gmailSetPqrsRespSel(detectada, { detectada: true, keepEmail: true });
  } else {
    const toggle = document.getElementById('gmail-resp-pqrs-toggle-search');
    if (toggle) toggle.textContent = '🔍 Buscar PQRSD';
  }
}

function _gmailOfiParseFrom(str) {
  str = str || '';
  const m = str.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: str.trim() };
}

async function gmailOfiConfirmarRespuestaPqrs() {
  const expId = String((document.getElementById('gmail-resp-pqrs-hid') || {}).value || '').trim();
  const fecha = String((document.getElementById('gmail-resp-pqrs-fecha') || {}).value || '').trim();
  const oficio = String((document.getElementById('gmail-resp-pqrs-oficio') || {}).value || '').trim();
  const ciudEmail = String((document.getElementById('gmail-resp-pqrs-email') || {}).value || '').trim().toLowerCase();
  const cuerpo = String((document.getElementById('gmail-resp-pqrs-cuerpo') || {}).value || '').trim();

  if (!expId) { notif('Seleccione la PQRSD a cerrar (busque por número o asunto)', 'err'); return; }
  if (!fecha) { notif('Indique la fecha de la respuesta', 'err'); return; }
  if (!cuerpo) { notif('Escriba el resumen de la respuesta', 'err'); return; }

  const e = (typeof exps !== 'undefined' ? exps : []).find(x => String(x._exp || '').trim() === expId);
  if (!e) { notif('PQRSD no encontrada', 'err'); return; }
  if (typeof esPqrsSecretaria === 'function' && !esPqrsSecretaria(e)) {
    notif('Solo puede vincular PQRSD radicadas por Secretaría, no expedientes de trámite', 'err');
    return;
  }

  const btn = document.getElementById('gmail-resp-pqrs-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Procesando…'; }

  const adj = typeof collectPqrsRespAdjuntos === 'function'
    ? collectPqrsRespAdjuntos('gmail-resp-adj-rows')
    : { links: [], files: [] };
  const documentos = [];
  const usaDriveInst = typeof DRIVE_INST_DEPTOS !== 'undefined' && DRIVE_INST_DEPTOS.has((typeof deptoActivo !== 'undefined' ? deptoActivo : '') || (typeof deptoCfg !== 'undefined' ? deptoCfg : '') || '');
  const nombreCarpeta = (e._qd_nombre || e._nombre || e._pn_nombre || expId);

  if (usaDriveInst && adj.files && adj.files.length) {
    for (const item of adj.files) {
      const file = item.file;
      const statusEl = item.statusEl;
      try {
        if (statusEl) statusEl.textContent = '⬆ Subiendo…';
        const res = await driveUploadInstitutional(file, file.name, file.type || 'application/octet-stream', 'respuesta_aprobada', expId, nombreCarpeta);
        if (statusEl) statusEl.textContent = '✅ Subido';
        documentos.push({ nombre: file.name, driveLink: res.driveLink, previewLink: res.previewLink, fileId: res.fileId, tipo: 'archivo' });
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ Error';
        console.error('Drive upload error:', err);
        notif('Error al subir ' + file.name + ': ' + String(err.message || err).slice(0, 80), 'err');
      }
    }
  }
  (adj.links || []).forEach(function(lnk) {
    documentos.push({ nombre: 'Link Drive', driveLink: lnk, tipo: 'link' });
  });

  const msgId = _gmailOfiCurrentMsg ? _gmailOfiCurrentMsg.id : null;
  if (msgId) documentos.push({ nombre: 'Correo enviado (Gmail)', driveLink: 'https://mail.google.com/mail/u/0/#inbox/' + msgId, tipo: 'correo' });

  if (typeof setPqrsWorkflow === 'function') {
    setPqrsWorkflow(e, {
      fase: typeof PQRS_WF !== 'undefined' ? PQRS_WF.CERRADA : 'cerrada_atendida',
      tipo: typeof PQRS_WF_TIPO !== 'undefined' ? PQRS_WF_TIPO.MENSAJE : 'mensaje',
      canal: typeof PQRS_WF_CANAL !== 'undefined' ? PQRS_WF_CANAL.CORREO : 'correo',
      cuerpo,
      oficio,
      fecha_respuesta: fecha,
      documentos: documentos,
      notificacion_correo: { enviado: true, a: ciudEmail, en: new Date().toISOString() },
      cerrado_por: typeof responsableActivo !== 'undefined' ? responsableActivo : '',
      cerrado_en: new Date().toISOString()
    });
  } else {
    e._pqrs_estado_oficina = 'cerrado';
    e._estado = 'Atendido';
    e._fecha_res = fecha;
    e._pqrs_respuesta_fecha = fecha;
    e._pqrs_respuesta_medio = 'electronica';
    e._pqrs_respuesta_nota = cuerpo;
    if (oficio) e._pqrs_respuesta_oficio = oficio;
  }

  if (typeof registrarPqrsRespuestaCore === 'function') {
    registrarPqrsRespuestaCore(e, {
      fechaResp: fecha,
      oficioExt: oficio,
      medioResp: typeof PQRS_WF_CANAL !== 'undefined' ? PQRS_WF_CANAL.CORREO : 'correo',
      nota: cuerpo,
      adj: { links: adj.links || [], files: [] },
      archivos: documentos
    });
  }

  if (!Array.isArray(e._pqrs_historial)) e._pqrs_historial = [];
  e._pqrs_historial.push({
    tipo: 'notificacion_correo',
    fecha: fecha,
    nota: 'Respuesta enviada por correo a ' + (ciudEmail || 'ciudadano') + (oficio ? ' · Oficio ' + oficio : ''),
    oficina: e._pqrs_oficina || (typeof deptoActivo !== 'undefined' ? deptoActivo : '')
  });

  if (typeof persistExpedienteGranular === 'function') persistExpedienteGranular(e);
  if (typeof pqrsMatrizSyncAfterSave === 'function') pqrsMatrizSyncAfterSave(e);
  if (typeof closeTaskModal === 'function') closeTaskModal();
  if (typeof renderPqrsOficinaInbox === 'function') renderPqrsOficinaInbox();
  if (typeof renderSecretariaPqrs === 'function') renderSecretariaPqrs();
  if (typeof refreshPqrsDetalleViews === 'function') refreshPqrsDetalleViews(expId);
  notif('✅ PQRSD ' + expId + ' cerrada como respondida por correo', 'ok');

  if (_gmailOfiCurrentMsg && _gmailOfiTokenValid()) {
    try { await _gmailApplyRadLabel(_gmailOfiCurrentMsg.id); } catch (err) { console.warn('Label error:', err); }
  }
}

// ---- Abrir compose pre-llenado para responder una PQRSD ----
// Llama desde la bandeja PQRSD de la oficina para componer la respuesta por correo
function gmailOfiAbrirComposeRespuestaPqrs(expId) {
  const e = (typeof exps !== 'undefined' ? exps : []).find(x => String(x._exp || '').trim() === String(expId || '').trim());
  if (!e) { notif('PQRSD no encontrada', 'err'); return; }
  const ciudEmail = (e._qd_correo || e._pn_correo || '').trim();
  const asunto = 'Respuesta a su ' + (e._tipo_solicitud || 'solicitud PQRSD') + ' — ' + e._exp;
  const wf = typeof getPqrsWorkflow === 'function' ? getPqrsWorkflow(e) : {};
  const cuerpo = wf.cuerpo || e._pqrs_respuesta_nota || '';
  // Build document links for compose body
  const docs = (wf.documentos || []).filter(d => d.driveLink);
  const linksText = docs.length ? '\n\n' + docs.map(d => d.nombre + ': ' + d.driveLink).join('\n') : '';

  // Navigate to Correos tab and open compose
  if (typeof showTab === 'function') showTab('correos');
  setTimeout(function() {
    if (typeof gmailOfiOpenCompose === 'function') {
      gmailOfiOpenCompose({
        to: ciudEmail,
        subject: asunto,
        body: cuerpo + linksText
      });
      // Store the PQRSD context so we can close it after sending
      window._gmailOfiPqrsRespCtx = { expId, ciudEmail };
    } else {
      notif('Conecte su correo primero para enviar la respuesta.', 'warn');
    }
  }, 200);
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
