// ================================================================
// Gmail + Drive API — integración bandeja PQRSD (Secretaría)
// OAuth via Google Identity Services (GIS), independiente de Firebase Auth.
// El access_token se guarda en sessionStorage y caduca en 1h.
//
// REQUISITO (configuración única en Google Cloud Console):
//   1. Habilitar Gmail API, Google Drive API y Google Sheets API en el proyecto Firebase.
//   2. Pantalla de consentimiento OAuth → agregar scopes:
//      gmail.modify · gmail.send · drive.file · spreadsheets
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
  'https://www.googleapis.com/auth/gmail.modify',
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
  if (typeof renderSecGmailBloqueoRadicacion === 'function') renderSecGmailBloqueoRadicacion();
  if (typeof renderSstGmailSesionBloqueo === 'function') renderSstGmailSesionBloqueo();
  const gBtn = document.getElementById('gmail-sesion-connect-btn');
  if (gBtn) { gBtn.disabled = false; gBtn.textContent = 'Conectar correo Gmail'; }
}
function _gmailStartOAuth(scope, onToken, promptOpt) {
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
    // promptOpt==='' → renovación silenciosa (sin popup); undefined/null → 'select_account'
    const promptVal = (promptOpt === '' || promptOpt === 'none') ? '' : (promptOpt || 'select_account');
    tokenClient.requestAccessToken({ prompt: promptVal });
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
let _gmailTokenRefreshTimer = null;
let _gmailTokenExpiryTimer = null;
let _gmailOfiTokenExpiryTimer = null;
let _sstGmailAutoConnectScheduled = false;
let _sstGmailExpiryWarnShown = false;
let _sstGmailDriveStatusInterval = null;
const SST_GMAIL_DRIVE_WARN_MS = 60000;
const SST_GMAIL_DRIVE_REFRESH_MS = 1200000;
function gmailSetToken(tok, expiresInSec) {
  try {
    if (tok) {
      sessionStorage.setItem(GMAIL_TOKEN_KEY, tok);
      const expMs = Date.now() + (expiresInSec || 3600) * 1000;
      sessionStorage.setItem(GMAIL_TOKEN_EXP_KEY, String(expMs));
      _sstGmailExpiryWarnShown = false;
      _gmailScheduleTokenWarning(expMs);
      _gmailScheduleTokenExpiry(expMs, 'sec');
      if (typeof sstRenderGmailDriveStatusBtn === 'function') sstRenderGmailDriveStatusBtn();
    } else {
      sessionStorage.removeItem(GMAIL_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_TOKEN_EXP_KEY);
      if (_gmailTokenWarnTimer) { clearTimeout(_gmailTokenWarnTimer); _gmailTokenWarnTimer = null; }
      if (_gmailTokenRefreshTimer) { clearTimeout(_gmailTokenRefreshTimer); _gmailTokenRefreshTimer = null; }
      _gmailClearExpiryTimer('sec');
    }
  } catch (e) {}
}
function _gmailScheduleTokenWarning(expMs) {
  if (_gmailTokenWarnTimer) clearTimeout(_gmailTokenWarnTimer);
  if (_gmailTokenRefreshTimer) clearTimeout(_gmailTokenRefreshTimer);
  const refreshAt = expMs - Date.now() - SST_GMAIL_DRIVE_REFRESH_MS;
  if (refreshAt > 0) {
    _gmailTokenRefreshTimer = setTimeout(function() {
      _gmailTokenRefreshTimer = null;
      _gmailTrySilentTokenRefresh();
    }, refreshAt);
  }
  const warnAt = expMs - Date.now() - SST_GMAIL_DRIVE_WARN_MS;
  if (warnAt > 0) {
    _gmailTokenWarnTimer = setTimeout(function() {
      if (typeof sstRolRequiereGmailConectado === 'function' && !sstRolRequiereGmailConectado()) return;
      if (typeof sstGmailSesionActiva === 'function' && !sstGmailSesionActiva()) return;
      if (_sstGmailExpiryWarnShown) return;
      _sstGmailExpiryWarnShown = true;
      if (typeof confirmPrecaucion === 'function') {
        confirmPrecaucion({
          title: 'Conexión Drive por expirar',
          message: 'En 1 minuto caducará la conexión Gmail/Drive. Después podrá seguir navegando, pero deberá reconectar para adjuntar archivos o radicar con anexos.',
          confirmLabel: 'Entendido',
          tone: 'warn',
          hideCancel: true
        }, function() {});
      }
    }, warnAt);
  }
}
let _gmailSilentRefreshInFlight = false;
function _gmailTrySilentTokenRefresh() {
  // No interferir si hay una conexión manual en curso
  if (_gmailConnecting) return;
  if (_gmailSilentRefreshInFlight) return;
  if (typeof sstGmailSesionActiva === 'function' && !sstGmailSesionActiva()) return;
  const clientId = _gmailGetClientId();
  if (!clientId || !_gmailGisReady()) return;
  const useSec = typeof esSecretaria === 'function' && esSecretaria();
  const scope = useSec ? GMAIL_SCOPES : GMAIL_OFI_SCOPES;
  // Usar initTokenClient directamente para NO bloquear la UI ni mostrar notificaciones
  try {
    _gmailSilentRefreshInFlight = true;
    const silentClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scope,
      callback: function(response) {
        _gmailSilentRefreshInFlight = false;
        if (response && response.access_token) {
          if (useSec) {
            gmailSetToken(response.access_token, response.expires_in || 3600);
          } else if (typeof _gmailOfiValidarYGuardarToken === 'function') {
            _gmailOfiValidarYGuardarToken(response.access_token, response.expires_in || 3600);
          } else if (typeof gmailOfiSetToken === 'function') {
            gmailOfiSetToken(response.access_token, response.expires_in || 3600);
          }
          // Indicador se actualiza dentro de gmailSetToken / gmailOfiSetToken,
          // pero lo forzamos también por si acaso
          if (typeof sstRenderGmailDriveStatusBtn === 'function') sstRenderGmailDriveStatusBtn();
          console.log('Gmail: token renovado silenciosamente (' + (response.expires_in || 3600) + 's)');
        }
        // Si falla (response.error), simplemente no renovamos — el token expirará normalmente
        // y el temporizador de expiración lo manejará. Sin notificación al usuario.
      },
      error_callback: function(err) {
        _gmailSilentRefreshInFlight = false;
        // Fallo silencioso esperado (sin sesión Google, cookies bloqueadas, etc.)
        console.log('Gmail: renovación silenciosa no disponible (' + (err && err.type || 'desconocido') + ')');
      }
    });
    // prompt: '' → sin diálogo, intento totalmente silencioso
    silentClient.requestAccessToken({ prompt: '' });
  } catch (err) {
    _gmailSilentRefreshInFlight = false;
    console.warn('Gmail silent refresh error:', err);
  }
}
function _gmailClearExpiryTimer(which) {
  if (which === 'ofi') {
    if (_gmailOfiTokenExpiryTimer) { clearTimeout(_gmailOfiTokenExpiryTimer); _gmailOfiTokenExpiryTimer = null; }
    return;
  }
  if (_gmailTokenExpiryTimer) { clearTimeout(_gmailTokenExpiryTimer); _gmailTokenExpiryTimer = null; }
}
function _gmailScheduleTokenExpiry(expMs, which) {
  _gmailClearExpiryTimer(which || 'sec');
  const delay = expMs - Date.now();
  const fire = function() {
    if (which === 'ofi') _gmailOfiTokenExpiryTimer = null;
    else _gmailTokenExpiryTimer = null;
    if (typeof sstOnGmailTokenExpiradoCheck === 'function') sstOnGmailTokenExpiradoCheck();
  };
  if (delay <= 0) { fire(); return; }
  const t = setTimeout(fire, delay);
  if (which === 'ofi') _gmailOfiTokenExpiryTimer = t;
  else _gmailTokenExpiryTimer = t;
}
function sstRescheduleGmailExpiryTimers() {
  try {
    const secExp = parseInt(sessionStorage.getItem(GMAIL_TOKEN_EXP_KEY) || '0', 10);
    const ofiExp = parseInt(sessionStorage.getItem(GMAIL_OFI_TOKEN_EXP_KEY) || '0', 10);
    const now = Date.now();
    if (secExp > now) _gmailScheduleTokenExpiry(secExp, 'sec');
    if (ofiExp > now) _gmailScheduleTokenExpiry(ofiExp, 'ofi');
    const best = Math.max(secExp, ofiExp);
    if (best > now) _gmailScheduleTokenWarning(best);
  } catch (e) {}
}
function sstRolRequiereGmailConectado() {
  if (!document.body.classList.contains('sesion-activa')) return false;
  if (typeof esModoCiudadano === 'function' && esModoCiudadano()) return false;
  return true;
}
function sstGmailSesionActiva() {
  if (typeof _driveGetBestToken === 'function') return !!_driveGetBestToken();
  return (typeof gmailIsTokenValid === 'function' && gmailIsTokenValid()) ||
    (typeof gmailOfiIsTokenValid === 'function' && gmailOfiIsTokenValid());
}
function sstGmailDriveExpiryMs() {
  let best = 0;
  try {
    const sec = parseInt(sessionStorage.getItem(GMAIL_TOKEN_EXP_KEY) || '0', 10);
    const ofi = parseInt(sessionStorage.getItem(GMAIL_OFI_TOKEN_EXP_KEY) || '0', 10);
    const now = Date.now();
    if (sec > now) best = Math.max(best, sec);
    if (ofi > now) best = Math.max(best, ofi);
  } catch (e) {}
  return best;
}
function sstFormatDriveCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return m + ':' + String(sec).padStart(2, '0');
}
function sstRenderGmailDriveStatusBtn() {
  const btn = document.getElementById('sst-drive-status-btn');
  const label = document.getElementById('sst-drive-status-label');
  if (!btn) return;
  const show = typeof sstRolRequiereGmailConectado === 'function' && sstRolRequiereGmailConectado();
  btn.style.display = show ? '' : 'none';
  if (!show) return;
  btn.classList.remove('sst-drive-ok', 'sst-drive-warn', 'sst-drive-expired');
  const connected = sstGmailSesionActiva();
  const expMs = sstGmailDriveExpiryMs();
  const rem = expMs - Date.now();
  if (!connected || rem <= 0) {
    btn.classList.add('sst-drive-expired');
    if (label) label.textContent = 'Drive · Conectar';
    btn.title = 'Conecte Gmail/Drive para adjuntar archivos al expediente';
    return;
  }
  const txt = sstFormatDriveCountdown(rem);
  if (label) label.textContent = 'Drive · ' + txt;
  btn.title = 'Conexión Drive activa · ' + txt + ' restantes';
  if (rem <= 300000) btn.classList.add('sst-drive-warn');
  else btn.classList.add('sst-drive-ok');
}
function sstStartGmailDriveStatusTick() {
  if (_sstGmailDriveStatusInterval) return;
  sstRenderGmailDriveStatusBtn();
  _sstGmailDriveStatusInterval = setInterval(function() {
    if (!document.body.classList.contains('sesion-activa')) return;
    sstRenderGmailDriveStatusBtn();
  }, 1000);
}
function sstToggleDriveConnectPanel(ev) {
  if (ev) ev.stopPropagation();
  if (sstGmailSesionActiva()) {
    const rem = sstGmailDriveExpiryMs() - Date.now();
    if (typeof notif === 'function') {
      notif(rem > 0
        ? 'Conexión Drive activa · ' + sstFormatDriveCountdown(rem) + ' restantes'
        : 'Conexión Drive expirada — reconecte para adjuntar archivos', rem > 0 ? 'ok' : 'warn');
    }
    return;
  }
  sstAbrirGmailDriveModal();
}
function sstSecretariaDriveActiva() {
  return !!(typeof _driveGetSecretariaToken === 'function' && _driveGetSecretariaToken());
}
function sstAbrirGmailDriveModal(opts) {
  opts = opts || {};
  const ov = document.getElementById('gmail-sesion-overlay');
  if (!ov) return;
  const tit = ov.querySelector('.gmail-sesion-tit');
  const txt = ov.querySelector('.gmail-sesion-txt');
  const skipBtn = ov.querySelector('.gmail-sesion-btns .bs');
  if (opts.requireSecretaria) {
    if (tit) tit.textContent = 'Conectar Drive institucional PQRSD';
    if (txt) txt.innerHTML = 'Para guardar archivos en la carpeta oficial de la PQRSD debe autorizar la bandeja Gmail de <strong>Secretaría (cdaguaviare1)</strong> o tener su correo de oficina conectado con acceso editor a esa carpeta.';
  } else if (opts.force) {
    if (tit) tit.textContent = 'Conectar Gmail / Drive';
    if (txt) txt.innerHTML = 'Para <strong>adjuntar archivos</strong> o registrar la respuesta debe autorizar su correo institucional antes de continuar.';
  } else {
    if (tit) tit.textContent = 'Conectar Gmail / Drive';
    if (txt) txt.innerHTML = 'Para <strong>adjuntar archivos</strong> al expediente o radicar con anexos debe autorizar su correo institucional.';
  }
  if (skipBtn) skipBtn.style.display = opts.force ? 'none' : '';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden', 'false');
}
function sstCerrarGmailAttachModal(success) {
  if (window._sstGmailAttachForce && !success) return;
  const ov = document.getElementById('gmail-sesion-overlay');
  if (ov) {
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
    const skipBtn = ov.querySelector('.gmail-sesion-btns .bs');
    if (skipBtn) skipBtn.style.display = '';
  }
  const reqSec = window._sstGmailAttachRequireSecretaria;
  window._sstGmailAttachForce = false;
  window._sstGmailAttachRequireSecretaria = false;
  if (window._sstGmailAttachCb) {
    const cb = window._sstGmailAttachCb;
    window._sstGmailAttachCb = null;
    const ok = !!success && (!reqSec || sstSecretariaDriveActiva() || sstGmailSesionActiva());
    cb(ok);
  }
}
function sstFinalizeGmailConnect() {
  renderSstGmailSesionBloqueo();
  if (typeof sstRenderGmailDriveStatusBtn === 'function') sstRenderGmailDriveStatusBtn();
  const reqSec = window._sstGmailAttachRequireSecretaria;
  const ok = reqSec ? (sstSecretariaDriveActiva() || sstGmailSesionActiva()) : sstGmailSesionActiva();
  if (ok) sstCerrarGmailAttachModal(true);
}
function sstSolicitarGmailParaAdjuntar(opts) {
  opts = opts || {};
  if (typeof sstRolRequiereGmailConectado === 'function' && !sstRolRequiereGmailConectado()) {
    return Promise.resolve(true);
  }
  const active = opts.requireSecretaria
    ? (sstSecretariaDriveActiva() || sstGmailSesionActiva())
    : sstGmailSesionActiva();
  if (active) return Promise.resolve(true);
  return new Promise(function(resolve) {
    window._sstGmailAttachCb = resolve;
    window._sstGmailAttachForce = !!opts.force;
    window._sstGmailAttachRequireSecretaria = !!opts.requireSecretaria;
    sstAbrirGmailDriveModal(opts);
  });
}
function sstSolicitarDriveParaPqrs(expRef) {
  const tieneCarp = typeof _drivePqrsExpTieneCarpetas === 'function' && _drivePqrsExpTieneCarpetas(expRef);
  return sstSolicitarGmailParaAdjuntar({ requireSecretaria: !tieneCarp, force: true });
}
function renderSstGmailSesionBloqueo() {
  const ov = document.getElementById('gmail-sesion-overlay');
  if (ov && !window._sstGmailAttachCb) {
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('gmail-sesion-bloqueado');
  sstRenderGmailDriveStatusBtn();
}
function sstOnGmailTokenExpiradoCheck() {
  if (sstGmailSesionActiva()) {
    renderSstGmailSesionBloqueo();
    return;
  }
  sstOnGmailTokenExpiradoForceLogout();
}
function sstOnGmailTokenExpiradoForceLogout() {
  if (typeof gmailDisconnect === 'function') gmailDisconnect();
  if (typeof gmailOfiDisconnect === 'function') gmailOfiDisconnect();
  renderSstGmailSesionBloqueo();
  if (typeof renderSecGmailBloqueoRadicacion === 'function') renderSecGmailBloqueoRadicacion();
  if (typeof notif === 'function') {
    notif('Conexión Gmail/Drive expirada. Puede seguir navegando; reconecte para adjuntar archivos o radicar con anexos.', 'warn');
  }
}
function sstConectarGmailObligatorio(doneCb) {
  const reqSec = window._sstGmailAttachRequireSecretaria;
  const needSec = reqSec && !sstSecretariaDriveActiva() && !sstGmailSesionActiva();
  if (!sstRolRequiereGmailConectado() || (!needSec && sstGmailSesionActiva()) || (reqSec && sstSecretariaDriveActiva())) {
    sstFinalizeGmailConnect();
    if (doneCb) doneCb(sstGmailSesionActiva() || sstSecretariaDriveActiva());
    return;
  }
  const btn = document.getElementById('gmail-sesion-connect-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Conectando…'; }
  const finish = function() {
    if (btn) { btn.disabled = false; btn.textContent = 'Conectar Gmail / Drive'; }
    sstFinalizeGmailConnect();
    if (doneCb) doneCb(sstGmailSesionActiva() || sstSecretariaDriveActiva());
  };
  if (reqSec || (typeof esSecretaria === 'function' && esSecretaria())) {
    gmailConnect(finish);
    return;
  }
  if (typeof gmailOfiConnect === 'function') {
    gmailOfiConnect(finish);
    return;
  }
  gmailConnect(finish);
}
function sstIniciarGmailObligatorio() {
  if (!sstRolRequiereGmailConectado()) {
    renderSstGmailSesionBloqueo();
    return;
  }
  sstRescheduleGmailExpiryTimers();
  sstStartGmailDriveStatusTick();
  renderSstGmailSesionBloqueo();
}
window.sstConectarGmailObligatorio = sstConectarGmailObligatorio;
window.renderSstGmailSesionBloqueo = renderSstGmailSesionBloqueo;
window.sstIniciarGmailObligatorio = sstIniciarGmailObligatorio;
window.sstSolicitarGmailParaAdjuntar = sstSolicitarGmailParaAdjuntar;
window.sstSolicitarDriveParaPqrs = sstSolicitarDriveParaPqrs;
window._driveGetSecretariaToken = _driveGetSecretariaToken;
window.sstCerrarGmailAttachModal = sstCerrarGmailAttachModal;
window.sstToggleDriveConnectPanel = sstToggleDriveConnectPanel;
window.sstRenderGmailDriveStatusBtn = sstRenderGmailDriveStatusBtn;
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
    _gmailSecSignatureLoaded = false;
    gmailLoadSecSignature(true).catch(function(){});
    notif('Bandeja conectada correctamente.', 'ok');
    if (typeof sstFinalizeGmailConnect === 'function') sstFinalizeGmailConnect();
    if (typeof callback === 'function') callback();
    else gmailLoadInbox();
  });
}
function gmailReconnectForMatriz(callback) {
  _gmailStartOAuth(GMAIL_SCOPES, function(tok, exp) {
    gmailSetToken(tok, exp);
    notif('Gmail reconectado con permiso de Google Sheets.', 'ok');
    if (typeof callback === 'function') callback();
  }, 'consent');
}
window.gmailConnect = gmailConnect;
window.gmailReconnectForMatriz = gmailReconnectForMatriz;

function gmailDisconnect() {
  gmailSetToken('');
  _gmailMessages = [];
  _gmailCurrentMsg = null;
  window._gmailPendingMsgId = null;
  window._gmailPendingAttachments = null;
  window._gmailPendingEmailData = null;
  _gmailRadicadoLabelId = '';
  _gmailSecSignatureHtml = '';
  _gmailSecSignatureLoaded = false;
  updateGmailConnectBtn();
  renderGmailInboxList();
  if (typeof renderSecGmailBloqueoRadicacion === 'function') renderSecGmailBloqueoRadicacion();
  if (typeof renderSstGmailSesionBloqueo === 'function') renderSstGmailSesionBloqueo();
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

async function _gmailApiBest(method, url, body) {
  if (typeof gmailIsTokenValid === 'function' && gmailIsTokenValid()) {
    return gmailApiCall(method, url, body);
  }
  if (typeof _gmailOfiTokenValid === 'function' && _gmailOfiTokenValid()) {
    return _gmailOfiApi(method, url, body);
  }
  throw new Error('Sin sesión Gmail. Conecte la bandeja.');
}

async function _gmailFetchMessageFull(msgId) {
  if (!msgId) return null;
  const url = GMAIL_API_BASE + '/messages/' + msgId + '?format=full';
  try {
    return await _gmailApiBest('GET', url);
  } catch (e) {
    console.warn('_gmailFetchMessageFull:', e);
    return null;
  }
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
  const htmlParts = [];
  const plainParts = [];
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
      htmlParts.push(gmailDecodeBase64url(p.body.data));
    } else if (mime === 'text/plain' && p.body && p.body.data) {
      plainParts.push(gmailDecodeBase64url(p.body.data));
    }
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  if (htmlParts.length) {
    htmlParts.sort(function(a, b) { return b.length - a.length; });
    result.textHtml = htmlParts[0];
  }
  if (plainParts.length) {
    plainParts.sort(function(a, b) { return b.length - a.length; });
    result.textPlain = plainParts[0];
  }
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

function gmailMsgBodyHtmlForView(parts) {
  parts = parts || {};
  if (parts.textHtml) {
    const safe = (typeof DOMPurify !== 'undefined')
      ? DOMPurify.sanitize(parts.textHtml, { USE_PROFILES: { html: true }, ADD_ATTR: ['target', 'style', 'class'] })
      : parts.textHtml;
    return '<div class="gmail-msg-body sec-split-email-body">' + safe + '</div>';
  }
  if (parts.textPlain) {
    return '<pre class="gmail-msg-body gm-msg-plain sec-split-email-body">' + escTextarea(parts.textPlain) + '</pre>';
  }
  return '<div class="gmail-msg-body sec-split-email-body" style="color:var(--tx3)">(Sin contenido visible en el correo)</div>';
}

function gmailSplitAttsHtml(msg, atts, chipPrefix) {
  chipPrefix = chipPrefix || 'split-chip-';
  if (!atts || !atts.length) return '';
  return '<span style="font-weight:600;font-size:12px;flex-shrink:0">Adjuntos (' + atts.length + '):</span> ' +
    atts.map(function(a) {
      var sizeStr = a.size > 1024 ? Math.round(a.size / 1024) + ' KB' : (a.size || '?') + ' B';
      var isImg = (a.mimeType || '').startsWith('image/');
      var ico = isImg ? '🖼️' : ((a.mimeType || '').includes('pdf') ? '📄' : '📎');
      if (a.attachmentId) {
        return '<button id="' + chipPrefix + escAttr(a.attachmentId) + '" class="gmail-att-chip" ' +
          'onclick="openSplitAttViewer(\'' + escAttr(msg.id) + '\',\'' + escAttr(a.attachmentId) + '\',\'' + escAttr(a.filename) + '\',\'' + escAttr(a.mimeType || '') + '\')" ' +
          'title="' + escAttr(a.filename) + ' (' + sizeStr + ')">' +
          '<span class="att-ico">' + ico + '</span>' +
          '<span class="att-name">' + escAttr(a.filename) + '</span>' +
          '<em class="att-size">(' + sizeStr + ')</em>' +
          '</button>';
      }
      return '<span class="gmail-att-chip"><span class="att-ico">' + ico + '</span><span class="att-name">' + escAttr(a.filename) + '</span></span>';
    }).join('');
}

function renderSecEmailPanel(msg) {
  if (!msg) return;
  var headers = (msg.payload && msg.payload.headers) || [];
  var from = gmailParseFrom(gmailGetHeader(headers, 'from'));
  var to = gmailGetHeader(headers, 'to') || '';
  var cc = gmailGetHeader(headers, 'cc') || '';
  var subject = gmailGetHeader(headers, 'subject') || '(Sin asunto)';
  var date = gmailFmtDate(gmailGetHeader(headers, 'date') || '');
  var parts = gmailExtractParts(msg.payload);
  var atts = parts.attachments || [];

  var fromEl = document.getElementById('sec-email-panel-from');
  var dateEl = document.getElementById('sec-email-panel-date');
  var subjectEl = document.getElementById('sec-email-panel-subject');
  var metaEl = document.getElementById('sec-email-panel-meta');
  if (fromEl) {
    fromEl.innerHTML = 'De: <strong>' + escAttr(from.name || from.email || 'Remitente desconocido') + '</strong>' +
      (from.email ? ' <span style="font-weight:400;color:var(--tx2)">&lt;' + escAttr(from.email) + '&gt;</span>' : '');
  }
  if (dateEl) dateEl.textContent = date;
  if (subjectEl) subjectEl.textContent = subject;
  if (metaEl) {
    var meta = [];
    if (to) meta.push('Para: ' + escAttr(to));
    if (cc) meta.push('Cc: ' + escAttr(cc));
    metaEl.innerHTML = meta.length ? meta.join(' · ') : '';
    metaEl.style.display = meta.length ? '' : 'none';
  }

  var attsEl = document.getElementById('sec-email-panel-atts');
  if (attsEl) {
    if (atts.length) {
      attsEl.style.display = '';
      attsEl.innerHTML = gmailSplitAttsHtml(msg, atts, 'split-chip-');
    } else {
      attsEl.style.display = 'none';
      attsEl.innerHTML = '';
    }
  }

  var bodyEl = document.getElementById('sec-email-panel-body');
  if (bodyEl) bodyEl.innerHTML = gmailMsgBodyHtmlForView(parts);

  var emailPanel = document.getElementById('sec-email-panel');
  var split = document.getElementById('sec-radicar-split');
  if (emailPanel) emailPanel.classList.add('active');
  if (split) split.classList.add('split-active');
  closeSplitAttViewer();
}

function activarSplitRadicacionEmail(msg) {
  if (!msg) return;
  renderSecEmailPanel(msg);
  var split = document.getElementById('sec-radicar-split');
  if (split) split.scrollIntoView({ behavior: 'smooth', block: 'start' });
  var bodyEl = document.getElementById('sec-email-panel-body');
  if (bodyEl) bodyEl.scrollTop = 0;
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
// DRIVE_ROOT_PQRSD_ID → constants.js (PDF/anexos; Radicacion/año/mes/medio)
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
function _driveGetSecretariaToken() {
  const secTok = typeof gmailGetToken === 'function' ? gmailGetToken() : '';
  if (secTok && typeof gmailIsTokenValid === 'function' && gmailIsTokenValid()) return secTok;
  return '';
}
function _driveGetBestToken() {
  const secTok = _driveGetSecretariaToken();
  if (secTok) return secTok;
  const ofiTok = gmailOfiGetToken ? gmailOfiGetToken() : '';
  if (ofiTok && gmailOfiIsTokenValid && gmailOfiIsTokenValid()) return ofiTok;
  return '';
}
// Token para subir a carpetas PQRSD ya creadas por Secretaría (oficinas con permiso editor).
function _driveGetPqrsUploadToken(expRef) {
  const sec = _driveGetSecretariaToken();
  if (sec) return sec;
  if (expRef && expRef._pqrs_drive_solicitud_folder_id && expRef._pqrs_drive_respuesta_folder_id) {
    return _driveGetBestToken();
  }
  return '';
}
function _drivePqrsExpTieneCarpetas(expRef) {
  return !!(expRef && expRef._pqrs_drive_solicitud_folder_id && expRef._pqrs_drive_respuesta_folder_id);
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

function _driveSafeFolderName(s, maxLen) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
    .slice(0, maxLen || 30) || 'sin-nombre';
}

const _DRIVE_API_QS = '&supportsAllDrives=true&includeItemsFromAllDrives=true';

function buildExpedienteDriveFilename(estado, e, task, responsable, origName) {
  const exp = String(e && e._exp || '').trim().replace(/\s/g, '');
  const act = _driveSlug(task && (task.desc || task.actividad) || 'actividad', 25);
  const resp = _driveSlug(responsable, 20);
  const fecha = (typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const extMatch = String(origName || '').match(/\.([a-zA-Z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
  const pref = estado === 'aprobado' ? 'aprobado' : (estado === 'corregir' || estado === 'acorregir' ? 'acorregir' : (estado === 'por_firmar' ? 'por_firmar' : (estado === 'por_firma' ? 'por_firma' : (estado === 'por_notificar' ? 'por_notificar' : 'revision'))));
  const anexoM = String(origName || '').match(/^anexo[-_\s]?(\d+)/i);
  const anexoPref = anexoM ? ('anexo' + anexoM[1] + '-') : (/^anexo[-_\s]/i.test(String(origName || '')) ? 'anexo-' : '');
  return anexoPref + pref + '-' + exp + '-' + act + '-' + fecha + '-' + resp + '.' + ext;
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
function _driveClearFolderCache() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.indexOf('sst_df_') === 0) keys.push(k);
    }
    keys.forEach(function(k) { sessionStorage.removeItem(k); });
  } catch (e) {}
}

function driveResetPqrsRadicacionCaches() {
  _driveClearFolderCache();
  try { window._drivePqrsUploadFolderCache = {}; } catch (e) {}
}

async function _driveVerifyFolderId(token, folderId) {
  if (!token || !folderId) return false;
  try {
    const res = await fetch(DRIVE_API_BASE + '/files/' + encodeURIComponent(folderId) +
      '?fields=id,trashed,mimeType' + _DRIVE_API_QS, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      console.warn('_driveVerifyFolderId:', folderId, res.status);
      return false;
    }
    const data = await res.json();
    return !!(data && data.id && !data.trashed && data.mimeType === 'application/vnd.google-apps.folder');
  } catch (e) {
    console.warn('_driveVerifyFolderId:', e);
    return false;
  }
}

async function _driveEnsureFolder(token, folderName, parentId) {
  folderName = String(folderName || '').trim();
  if (!folderName) throw new Error('Nombre de carpeta Drive vacío');
  const cacheKey = 'sst_df_' + (parentId || 'root') + '_' + folderName.replace(/\s/g, '_');
  try {
    const c = sessionStorage.getItem(cacheKey);
    if (c) {
      if (await _driveVerifyFolderId(token, c)) return c;
      sessionStorage.removeItem(cacheKey);
    }
  } catch (e) {}
  const q = 'name="' + folderName.replace(/"/g, '\\"') +
            '" and mimeType="application/vnd.google-apps.folder"' +
            (parentId ? ' and "' + parentId + '" in parents' : '') +
            ' and trashed=false';
  const res = await fetch(DRIVE_API_BASE + '/files?q=' + encodeURIComponent(q) +
    '&fields=files(id,name)' + _DRIVE_API_QS, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : ('HTTP ' + res.status);
    throw new Error('Error buscando carpeta "' + folderName + '": ' + msg);
  }
  if (data.files && data.files.length > 0) {
    try { sessionStorage.setItem(cacheKey, data.files[0].id); } catch (e) {}
    return data.files[0].id;
  }
  const body = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const cr = await fetch(DRIVE_API_BASE + '/files' + _DRIVE_API_QS.replace('&', '?'), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const folder = await cr.json();
  if (!cr.ok || !folder.id) {
    const msg = folder && folder.error && folder.error.message ? folder.error.message : ('HTTP ' + cr.status);
    throw new Error('No se pudo crear carpeta "' + folderName + '": ' + msg);
  }
  try { sessionStorage.setItem(cacheKey, folder.id); } catch (e) {}
  return folder.id;
}

function _drivePqrsFechaRefAnioMes(fechaRef) {
  let ref = fechaRef ? new Date(fechaRef) : new Date();
  if (isNaN(ref.getTime())) ref = new Date();
  return { anio: ref.getFullYear().toString(), mes: DRIVE_MESES_ES[ref.getMonth()] };
}

const DRIVE_PQRSD_FOLDER_RADICACION = 'Radicacion';
const _DRIVE_LS_RADICACION_ID = 'sst_pqrs_radicacion_subfolder_id';

function _drivePersistPqrsFoldersOnExp(expRef, folders) {
  if (!expRef || !folders) return;
  if (folders.pqrsFolderId) {
    expRef._pqrs_drive_folder_id = folders.pqrsFolderId;
    expRef._pqrs_drive_folder_link = folders.pqrsFolderLink || expRef._pqrs_drive_folder_link || '';
  }
  if (folders.solicitudFolderId) expRef._pqrs_drive_solicitud_folder_id = folders.solicitudFolderId;
  if (folders.respuestaFolderId) expRef._pqrs_drive_respuesta_folder_id = folders.respuestaFolderId;
  if (folders.pathLabel) expRef._pqrs_drive_path_label = folders.pathLabel;
}

async function _driveGetPqrsRadicacionParent(token, pqrsRoot) {
  try {
    const stored = localStorage.getItem(_DRIVE_LS_RADICACION_ID) || '';
    if (stored && await _driveVerifyFolderId(token, stored)) return stored;
  } catch (e) {}
  const id = await _driveEnsureFolder(token, DRIVE_PQRSD_FOLDER_RADICACION, pqrsRoot);
  try { localStorage.setItem(_DRIVE_LS_RADICACION_ID, id); } catch (e) {}
  return id;
}
const DRIVE_PQRSD_SUB_SOLICITUD = 'Solicitud';
const DRIVE_PQRSD_SUB_RESPUESTA = 'Respuesta';

function pqrsMedioCarpetaLabel(tipo) {
  if (tipo === 'radicacion_correo') return 'Correo';
  if (tipo === 'radicacion_ventanilla') return 'Ventanilla';
  if (tipo === 'radicacion_oficio') return 'Oficio';
  return 'Otros';
}

function pqrsBuildExpedienteCarpetaNombre(pqrsNum, nombreCarpeta, tipo) {
  const numS = String(pqrsNum || '').trim();
  const nom = _driveSafeFolderName(nombreCarpeta, 25);
  const med = pqrsMedioCarpetaLabel(tipo);
  return 'PQRSD-' + numS + (nom ? '-' + nom : '') + '-' + med;
}

function _driveUploadTargetFromTipo(tipo) {
  if (tipo && tipo.startsWith('radicacion')) return 'solicitud';
  return 'respuesta';
}

async function driveEnsurePqrsExpedienteFolders(tipo, pqrsNum, nombreCarpeta, fechaRef, expRef) {
  const tipoS = String(tipo || 'radicacion_otro');
  const numS = String(pqrsNum || '').trim();

  // Reutilizar carpetas ya guardadas en el expediente (evita Radicacion (1) al responder desde otra cuenta)
  if (expRef && expRef._pqrs_drive_solicitud_folder_id && expRef._pqrs_drive_respuesta_folder_id) {
    const pqrsId = expRef._pqrs_drive_folder_id || '';
    const result = {
      pqrsFolderId: pqrsId,
      pqrsFolderLink: expRef._pqrs_drive_folder_link || (pqrsId ? 'https://drive.google.com/drive/folders/' + pqrsId : ''),
      solicitudFolderId: expRef._pqrs_drive_solicitud_folder_id,
      solicitudFolderLink: 'https://drive.google.com/drive/folders/' + expRef._pqrs_drive_solicitud_folder_id,
      respuestaFolderId: expRef._pqrs_drive_respuesta_folder_id,
      respuestaFolderLink: 'https://drive.google.com/drive/folders/' + expRef._pqrs_drive_respuesta_folder_id,
      pathLabel: expRef._pqrs_drive_path_label || ''
    };
    _drivePersistPqrsFoldersOnExp(expRef, result);
    return result;
  }

  const token = _driveGetSecretariaToken();
  if (!token) {
    throw new Error('Para crear la carpeta PQRSD en Drive institucional conecte la bandeja Gmail de Secretaría (cdaguaviare1).');
  }

  if (expRef && expRef._pqrs_drive_folder_id) {
    const pqrsOk = await _driveVerifyFolderId(token, expRef._pqrs_drive_folder_id);
    if (pqrsOk) {
      let solId = expRef._pqrs_drive_solicitud_folder_id || '';
      let resId = expRef._pqrs_drive_respuesta_folder_id || '';
      if (!solId || !await _driveVerifyFolderId(token, solId)) {
        solId = await _driveEnsureFolder(token, DRIVE_PQRSD_SUB_SOLICITUD, expRef._pqrs_drive_folder_id);
      }
      if (!resId || !await _driveVerifyFolderId(token, resId)) {
        resId = await _driveEnsureFolder(token, DRIVE_PQRSD_SUB_RESPUESTA, expRef._pqrs_drive_folder_id);
      }
      const result = {
        pqrsFolderId: expRef._pqrs_drive_folder_id,
        pqrsFolderLink: expRef._pqrs_drive_folder_link || 'https://drive.google.com/drive/folders/' + expRef._pqrs_drive_folder_id,
        solicitudFolderId: solId,
        solicitudFolderLink: 'https://drive.google.com/drive/folders/' + solId,
        respuestaFolderId: resId,
        respuestaFolderLink: 'https://drive.google.com/drive/folders/' + resId,
        pathLabel: expRef._pqrs_drive_path_label || ''
      };
      _drivePersistPqrsFoldersOnExp(expRef, result);
      return result;
    }
  }

  if (expRef && expRef._pqrs_drive_solicitud_folder_id && expRef._pqrs_drive_respuesta_folder_id) {
    const solOk = await _driveVerifyFolderId(token, expRef._pqrs_drive_solicitud_folder_id);
    const resOk = await _driveVerifyFolderId(token, expRef._pqrs_drive_respuesta_folder_id);
    if (solOk && resOk) {
      const pqrsId = expRef._pqrs_drive_folder_id || '';
      const result = {
        pqrsFolderId: pqrsId,
        pqrsFolderLink: expRef._pqrs_drive_folder_link || (pqrsId ? 'https://drive.google.com/drive/folders/' + pqrsId : ''),
        solicitudFolderId: expRef._pqrs_drive_solicitud_folder_id,
        solicitudFolderLink: 'https://drive.google.com/drive/folders/' + expRef._pqrs_drive_solicitud_folder_id,
        respuestaFolderId: expRef._pqrs_drive_respuesta_folder_id,
        respuestaFolderLink: 'https://drive.google.com/drive/folders/' + expRef._pqrs_drive_respuesta_folder_id,
        pathLabel: expRef._pqrs_drive_path_label || ''
      };
      _drivePersistPqrsFoldersOnExp(expRef, result);
      return result;
    }
  }

  const nomSlug = _driveSafeFolderName(nombreCarpeta, 25);
  const fechaS = String(fechaRef || '').slice(0, 10);
  const cacheKey = 'pqrsf|' + tipoS + '|' + numS + '|' + fechaS + '|' + nomSlug;
  window._drivePqrsUploadFolderCache = window._drivePqrsUploadFolderCache || {};
  if (window._drivePqrsUploadFolderCache[cacheKey]) {
    const cached = window._drivePqrsUploadFolderCache[cacheKey];
    if (await _driveVerifyFolderId(token, cached.solicitudFolderId)) return cached;
    delete window._drivePqrsUploadFolderCache[cacheKey];
  }

  const pqrsRoot = typeof DRIVE_ROOT_PQRSD_ID !== 'undefined' ? DRIVE_ROOT_PQRSD_ID : '16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS';

  const ym = _drivePqrsFechaRefAnioMes(fechaRef);
  const pathParts = [];
  let parent = await _driveGetPqrsRadicacionParent(token, pqrsRoot);
  pathParts.push(DRIVE_PQRSD_FOLDER_RADICACION);
  parent = await _driveEnsureFolder(token, ym.anio, parent);
  pathParts.push(ym.anio);
  parent = await _driveEnsureFolder(token, ym.mes, parent);
  pathParts.push(ym.mes);

  const carpNom = pqrsBuildExpedienteCarpetaNombre(numS, nombreCarpeta, tipoS);
  const pqrsFolderId = await _driveEnsureFolder(token, carpNom, parent);
  pathParts.push(carpNom);

  const solicitudFolderId = await _driveEnsureFolder(token, DRIVE_PQRSD_SUB_SOLICITUD, pqrsFolderId);
  const respuestaFolderId = await _driveEnsureFolder(token, DRIVE_PQRSD_SUB_RESPUESTA, pqrsFolderId);

  const result = {
    pqrsFolderId: pqrsFolderId,
    pqrsFolderLink: 'https://drive.google.com/drive/folders/' + pqrsFolderId,
    solicitudFolderId: solicitudFolderId,
    solicitudFolderLink: 'https://drive.google.com/drive/folders/' + solicitudFolderId,
    respuestaFolderId: respuestaFolderId,
    respuestaFolderLink: 'https://drive.google.com/drive/folders/' + respuestaFolderId,
    pathLabel: pathParts.join(' / ')
  };
  window._drivePqrsUploadFolderCache[cacheKey] = result;
  _drivePersistPqrsFoldersOnExp(expRef, result);
  return result;
}

async function driveEnsurePqrsUploadFolder(tipo, pqrsNum, nombreCarpeta, fechaRef, expRef) {
  const folders = await driveEnsurePqrsExpedienteFolders(tipo, pqrsNum, nombreCarpeta, fechaRef, expRef);
  const target = _driveUploadTargetFromTipo(tipo);
  const folderId = target === 'solicitud' ? folders.solicitudFolderId : folders.respuestaFolderId;
  const folderLink = target === 'solicitud' ? folders.solicitudFolderLink : folders.respuestaFolderLink;
  return Object.assign({ folderId: folderId, folderLink: folderLink }, folders);
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
async function driveUploadInstitutional(blob, filename, mimeType, tipo, pqrsNum, nombreCarpeta, fechaRef, uploadOpts) {
  uploadOpts = uploadOpts || {};
  const expRef = uploadOpts.expediente || null;
  const token = _driveGetPqrsUploadToken(expRef);
  if (!token) {
    throw new Error('Sin token Gmail/Drive. Conecte la bandeja de Secretaría o su correo de oficina con acceso a la carpeta PQRSD.');
  }

  let folderId = uploadOpts.folderId || '';
  let folderLink = uploadOpts.folderLink || '';
  let pqrsFolders = uploadOpts.pqrsFolders || null;
  if (!folderId) {
    const tipoS = String(tipo || 'radicacion_otro');
    pqrsFolders = await driveEnsurePqrsExpedienteFolders(tipoS, pqrsNum, nombreCarpeta, fechaRef, uploadOpts.expediente || null);
    const target = uploadOpts.uploadTarget || _driveUploadTargetFromTipo(tipoS);
    folderId = target === 'solicitud' ? pqrsFolders.solicitudFolderId : pqrsFolders.respuestaFolderId;
    folderLink = target === 'solicitud' ? pqrsFolders.solicitudFolderLink : pqrsFolders.respuestaFolderLink;
  }

  // Upload multipart
  const form = new FormData();
  const meta = { name: filename, mimeType: mimeType, parents: [folderId] };
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob instanceof Blob ? blob : new Blob([blob], { type: mimeType }));
  const up = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form
  });
  if (!up.ok) { const t = await up.text().catch(function() { return ''; }); throw new Error('Drive upload ' + up.status + ': ' + t.slice(0, 120)); }
  const file = await up.json();

  // Compartir como lector público (anyoneWithLink) — consulta ciudadana
  try {
    await fetch(DRIVE_API_BASE + '/files/' + file.id + '/permissions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch (permErr) { console.warn('driveUploadInstitutional perm:', permErr); }

  const previewLink = _drivePreviewLinkForFile(file.id, mimeType, filename);
  if (uploadOpts.expediente && pqrsFolders) {
    _drivePersistPqrsFoldersOnExp(uploadOpts.expediente, pqrsFolders);
  }
  return {
    fileId: file.id,
    driveLink: 'https://drive.google.com/file/d/' + file.id + '/view',
    previewLink: previewLink,
    nombre: filename,
    folderId: folderId,
    folderLink: folderLink,
    pqrsFolders: pqrsFolders
  };
}

function _drivePreviewLinkForFile(fileId, mimeType, filename) {
  const id = String(fileId || '').trim();
  if (!id) return '';
  const mime = String(mimeType || '').toLowerCase();
  const name = String(filename || '').toLowerCase();
  const isImg = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  if (isImg) return 'https://drive.google.com/uc?export=view&id=' + id;
  return 'https://drive.google.com/file/d/' + id + '/preview';
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
  return e._fecha || e._fecha_solicitud || '';
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
  return driveUploadInstitutional(blob, driveName, mimeType || 'application/octet-stream', tipo, expId, nombreCarpeta, fechaRef, {
    expediente: e,
    uploadTarget: opts.uploadTarget || 'respuesta'
  });
}

// Versión base64url para adjuntos de correo (usa la misma infraestructura).
async function driveUploadInstitutionalB64(filename, mimeType, base64urlData, tipo, pqrsNum, nombreCarpeta, fechaRef, uploadOpts) {
  const b64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return driveUploadInstitutional(blob, filename, mimeType, tipo, pqrsNum, nombreCarpeta, fechaRef, uploadOpts);
}

async function _gmailGetAttachmentAny(messageId, attachmentId) {
  if (typeof _gmailOfiTokenValid === 'function' && _gmailOfiTokenValid()) {
    const data = await _gmailOfiApi('GET', GMAIL_API_BASE + '/messages/' + messageId + '/attachments/' + attachmentId);
    return data.data;
  }
  return gmailGetAttachment(messageId, attachmentId);
}

async function subirAdjuntosGmailMsgRespuestaADrive(msg, e) {
  if (!msg || !e || !msg.payload) return [];
  const parts = gmailExtractParts(msg.payload);
  const documentos = [];
  const expId = e._exp || '';
  const nombreCarpeta = e._qd_nombre || e._pn_nombre || expId;
  const fechaExp = e._fecha || e._fecha_solicitud || '';
  const uploadOpts = { expediente: e, uploadTarget: 'respuesta' };
  for (const att of parts.attachments) {
    if (!att.attachmentId) continue;
    try {
      const b64 = await _gmailGetAttachmentAny(msg.id, att.attachmentId);
      const res = await driveUploadInstitutionalB64(att.filename, att.mimeType || 'application/octet-stream', b64, 'respuesta_aprobada', expId, nombreCarpeta, fechaExp, uploadOpts);
      documentos.push({ nombre: att.filename, driveLink: res.driveLink, previewLink: res.previewLink, fileId: res.fileId, tipo: 'archivo', mime: att.mimeType || '' });
    } catch (err) {
      console.warn('subirAdjuntosGmailMsgRespuestaADrive:', att.filename, err);
    }
  }
  return documentos;
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

// Limpia el cuerpo de un correo para el PDF: elimina citas (líneas con >) y bloques "escribió:".
function _gmailCleanBodyForPdf(txt) {
  const raw = String(txt || '').replace(/\r/g, '');
  if (!raw.trim()) return '';
  const lines = raw.split('\n');
  const out = [];
  let inQuote = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!inQuote && (
      /^>{1,}\s*$/.test(trimmed) ||
      /^On .+wrote:$/i.test(trimmed) ||
      /^El .+ escribi[oó]:$/i.test(trimmed) ||
      /^-{3,}\s*(Original Message|Mensaje original)/i.test(trimmed)
    )) {
      inQuote = true;
      continue;
    }
    if (inQuote) {
      if (/^>{0,1}\s*$/.test(trimmed)) continue;
      if (!/^>/.test(trimmed) && trimmed.length > 0 && !/^On .+wrote:$/i.test(trimmed)) {
        inQuote = false;
      } else {
        continue;
      }
    }
    const cleaned = line.replace(/^>+\s?/g, '').trimEnd();
    if (cleaned.trim()) out.push(cleaned);
  }
  let result = out.join('\n').trim();
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
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
  const cuerpoRaw = String(ed.cuerpoTxt || ed.asunto || '').replace(/\r/g, '');
  const cuerpo = _gmailCleanBodyForPdf(cuerpoRaw) || String(ed.asunto || '(sin contenido de texto)').trim();
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
  if (/correo/i.test(m)) return 'radicacion_correo';
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
  const detRaw = String(opts.detalle || '').trim();
  const detalle = (detRaw || '(sin detalle adicional)').replace(/\r/g, '');
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
  let pqrsFolder = null;
  const silentNotif = !!opts.silentNotif;
  try {
    driveResetPqrsRadicacionCaches();
    pqrsFolder = await driveEnsurePqrsExpedienteFolders(tipoRad, expId, nombreCarpeta, fechaRef);
    const uploadOpts = {
      folderId: pqrsFolder.solicitudFolderId,
      folderLink: pqrsFolder.solicitudFolderLink,
      pqrsFolders: pqrsFolder,
      uploadTarget: 'solicitud'
    };
    if (!silentNotif) notif('🖨️ Generando soporte PDF y subiendo al Drive institucional…', 'info');
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
        fechaRef,
        uploadOpts
      );
      uploaded.push(soporte);
    } else if (!silentNotif) {
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
        fechaRef,
        uploadOpts
      );
      up.nombre = driveName;
      uploaded.push(up);
    }

    if (!silentNotif) {
      if (soporte) {
        const extra = uploaded.length > 1 ? ' y ' + (uploaded.length - 1) + ' anexo(s)' : '';
        const loc = pqrsFolder && pqrsFolder.pathLabel ? ' · ' + pqrsFolder.pathLabel : '';
        notif('✅ Soporte PDF' + extra + ' subido(s) al Drive institucional' + loc + '.', 'ok');
      } else if (uploaded.length) {
        notif('✅ ' + uploaded.length + ' anexo(s) subido(s) al Drive institucional.', 'ok');
      }
    }
  } catch (e) {
    console.warn('subirSoporteRadicacionManual:', e);
    if (!silentNotif && typeof notif === 'function') {
      notif('⚠️ No se pudo subir el soporte al Drive: ' + (e.message || 'revise la conexión Gmail'), 'warn');
    }
    throw e;
  }

  return {
    soporte: soporte,
    anexos: uploaded.filter(function(u) { return u !== soporte; }),
    all: uploaded,
    link: soporte ? soporte.driveLink : (uploaded[0] ? uploaded[0].driveLink : ''),
    folderLink: pqrsFolder ? pqrsFolder.pqrsFolderLink : '',
    pqrsFolderId: pqrsFolder ? pqrsFolder.pqrsFolderId : '',
    solicitudFolderId: pqrsFolder ? pqrsFolder.solicitudFolderId : '',
    respuestaFolderId: pqrsFolder ? pqrsFolder.respuestaFolderId : '',
    pathLabel: pqrsFolder ? pqrsFolder.pathLabel : ''
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
    driveResetPqrsRadicacionCaches();
    const fechaRef = typeof hoy === 'function' ? hoy() : '';
    const pqrsFolder = await driveEnsurePqrsExpedienteFolders('radicacion_correo', expIdHint || '', nombreHint || '', fechaRef);
    window._gmailPendingPqrsFolders = pqrsFolder;
    const uploadOpts = {
      folderId: pqrsFolder.solicitudFolderId,
      folderLink: pqrsFolder.solicitudFolderLink,
      pqrsFolders: pqrsFolder,
      uploadTarget: 'solicitud'
    };
    notif('🖨️ Generando PDF de la solicitud y subiéndolo al Drive…', 'info');
    const asunto = ((ed && ed.asunto) || 'solicitud').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    let soporte = null;

    // 1) Intentar PDF (soporte preferido).
    const pdfBlob = await generarPdfSolicitudCorreo(ed || {}, expIdHint);
    if (pdfBlob) {
      soporte = await driveUploadInstitutional(
        pdfBlob, 'Solicitud_PQRSD-' + (expIdHint || '') + '_' + asunto + '.pdf',
        'application/pdf', 'radicacion_correo', expIdHint || '', nombreHint || '', typeof hoy === 'function' ? hoy() : '', uploadOpts
      );
    } else if (ed && ed.cuerpoHtml) {
      // 2) Respaldo: subir el cuerpo como HTML si jsPDF no está disponible.
      const htmlBlob = new Blob([ed.cuerpoHtml], { type: 'text/html' });
      soporte = await driveUploadInstitutional(
        htmlBlob, 'Solicitud_PQRSD-' + (expIdHint || '') + '_' + asunto + '.html',
        'text/html', 'radicacion_correo', expIdHint || '', nombreHint || '', typeof hoy === 'function' ? hoy() : '', uploadOpts
      );
    }

    if (soporte) {
      window._gmailPendingAttachments = [soporte];
      if (typeof sstCargaHide === 'function' && window._confirmRadicacionLoading) sstCargaHide();
    } else {
      notif('⚠️ No se pudo generar el soporte PDF. El correo se reenvió a la oficina con sus anexos.', 'warn');
    }
  } catch (e) {
    if (typeof sstCargaHide === 'function' && window._confirmRadicacionLoading) sstCargaHide();
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

// Firma HTML de la cuenta Secretaría (sendAs primario de Gmail)
let _gmailSecSignatureHtml = '';
let _gmailSecSignatureLoaded = false;
async function gmailLoadSecSignature(force) {
  if (_gmailSecSignatureLoaded && !force) return _gmailSecSignatureHtml;
  try {
    if (!gmailIsTokenValid()) { _gmailSecSignatureHtml = ''; return ''; }
    const data = await gmailApiCall('GET', GMAIL_API_BASE + '/settings/sendAs');
    const primary = (data.sendAs || []).find(function(s){ return s.isPrimary; }) || (data.sendAs || [])[0];
    _gmailSecSignatureHtml = (primary && primary.signature) ? String(primary.signature) : '';
    _gmailSecSignatureLoaded = true;
  } catch (e) {
    _gmailSecSignatureHtml = '';
    _gmailSecSignatureLoaded = false;
  }
  return _gmailSecSignatureHtml;
}
function gmailAppendSecSignatureHtml(htmlBody) {
  const sig = String(_gmailSecSignatureHtml || '').trim();
  if (!sig) return htmlBody || '';
  // Evitar duplicar si el cuerpo ya incluye la firma
  if (htmlBody && sig.length > 40 && htmlBody.indexOf(sig.slice(0, Math.min(80, sig.length))) >= 0) return htmlBody;
  return (htmlBody || '') +
    '<div><br><div style="border-top:1px solid #e0e0e0;padding-top:8px">' + sig + '</div></div>';
}
async function gmailSend(to, subject, htmlBody, threadId) {
  try { await gmailLoadSecSignature(false); } catch (e) {}
  const raw = _buildMimeEmail(to, subject, gmailAppendSecSignatureHtml(htmlBody));
  const body = { raw };
  if (threadId) body.threadId = threadId;
  return gmailApiCall('POST', GMAIL_API_BASE + '/messages/send', body);
}
// Alias used by core.js workflow (sends via secretary token)
async function gmailSendMessage(to, subject, htmlBody) {
  return gmailSend(to, subject, htmlBody);
}

// Decodifica encoded-words RFC 2047 (=?charset?B/Q?text?=) en cabeceras de correo.
// Necesario para limpiar asuntos como "=?UTF-8?B?[base64 de 'Fwd: PQRSD #... asunto']?="
// antes de aplicar el regex que elimina prefijos duplicados.
function _decodeEmailHeaderRfc2047(str) {
  if (!str || str.indexOf('=?') < 0) return str;
  return str.replace(/=\?([A-Za-z0-9\-]+)\?(B|Q)\?([^?]*)\?=/gi, function(match, charset, enc, text) {
    try {
      var bytes;
      if (enc.toUpperCase() === 'B') {
        var bin = atob(text.replace(/\s/g, ''));
        bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        var qp = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, function(_, h) {
          return String.fromCharCode(parseInt(h, 16));
        });
        bytes = new TextEncoder().encode(qp);
      }
      return new TextDecoder(charset || 'utf-8').decode(bytes);
    } catch (e) { return match; }
  });
}
// Codifica un subject con caracteres no-ASCII como encoded-word UTF-8 base64.
function _encodeEmailSubject(subj) {
  if (!/[^\x00-\x7F]/.test(subj)) return subj;
  try {
    var bytes = new TextEncoder().encode(subj);
    var bin = '';
    bytes.forEach(function(b) { bin += String.fromCharCode(b); });
    return '=?UTF-8?B?' + btoa(bin) + '?=';
  } catch (e) { return subj; }
}

function _reenviarEmailEncodeRawForRecipient(rawData, toEmail, expId) {
  if (!rawData || !rawData.raw) throw new Error('No se pudo obtener el correo original');
  const b64std = rawData.raw.replace(/-/g, '+').replace(/_/g, '/');
  const binaryStr = atob(b64std);
  const bytes = new Uint8Array(binaryStr.length);
  for (var bi = 0; bi < binaryStr.length; bi++) bytes[bi] = binaryStr.charCodeAt(bi);
  var sepPos = -1, sepLen = 4;
  for (var si = 0; si < bytes.length - 3; si++) {
    if (bytes[si] === 13 && bytes[si + 1] === 10 && bytes[si + 2] === 13 && bytes[si + 3] === 10) { sepPos = si; sepLen = 4; break; }
  }
  if (sepPos < 0) {
    for (var sj = 0; sj < bytes.length - 1; sj++) {
      if (bytes[sj] === 10 && bytes[sj + 1] === 10) { sepPos = sj; sepLen = 2; break; }
    }
  }
  if (sepPos < 0) throw new Error('Estructura del correo no reconocida');
  var headerBytes = bytes.slice(0, sepPos);
  var bodyBytes = bytes.slice(sepPos + sepLen);
  var headerText = '';
  for (var hi = 0; hi < headerBytes.length; hi++) headerText += String.fromCharCode(headerBytes[hi]);
  var lb = headerText.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  var headerLines = headerText.split(lb);
  // Headers que deben eliminarse del mensaje original al reenviar desde una cuenta diferente.
  // "From/Sender" → Gmail los rellena con la cuenta autenticada, evitando el bloqueo 550 5.7.1.
  // "DKIM/ARC/Received/SPF/Auth" → son específicos de la entrega original; re-incluirlos activa filtros anti-spam.
  var SKIP_HEADERS = /^(To|Cc|Bcc|From|Sender|Reply-To|Return-Path|Message-ID|DKIM-Signature|ARC-Seal|ARC-Message-Signature|ARC-Authentication-Results|Authentication-Results|Received-SPF|Received|X-Received|X-Forwarded-To|X-Original-To|Delivered-To|X-Google-DKIM-Signature):/i;
  var newHeaderLines = [];
  var hj = 0;
  while (hj < headerLines.length) {
    var hline = headerLines[hj];
    if (SKIP_HEADERS.test(hline)) {
      hj++;
      while (hj < headerLines.length && /^[ \t]/.test(headerLines[hj])) hj++;
      continue;
    }
    if (/^Subject:/i.test(hline)) {
      var origSubj = hline.replace(/^Subject:\s*/i, '');
      // Decodificar RFC 2047 para que el regex pueda limpiar prefijos aunque estén base64/QP
      var decodedSubj = _decodeEmailHeaderRfc2047(origSubj.trim());
      var cleanSubj = decodedSubj
        .replace(/^(\s*(Fwd?|Re):\s*((\[?\s*)?PQRSD\s*#\s*[A-Za-z0-9\-]+\s*\]?\s*:?\s*)?)+/i, '')
        .trim();
      var expTag = expId ? 'PQRSD #' + expId + ' ' : '';
      var newSubj = 'Fwd: ' + expTag + cleanSubj;
      newHeaderLines.push('Subject: ' + _encodeEmailSubject(newSubj));
      hj++;
      while (hj < headerLines.length && /^[ \t]/.test(headerLines[hj])) hj++;
      continue;
    }
    newHeaderLines.push(hline);
    hj++;
  }
  newHeaderLines.unshift('To: ' + toEmail);
  var newHeaderText = newHeaderLines.join(lb) + lb + lb;
  var newHeaderEnc = new TextEncoder().encode(newHeaderText);
  var out = new Uint8Array(newHeaderEnc.length + bodyBytes.length);
  out.set(newHeaderEnc, 0);
  out.set(bodyBytes, newHeaderEnc.length);
  var binOut = '';
  out.forEach(function(b) { binOut += String.fromCharCode(b); });
  return btoa(binOut).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function reenviarEmailRawARecipientes(msg, recipientEmails, expId, opts) {
  opts = opts || {};
  const emails = (Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails])
    .map(function(em) { return String(em || '').trim(); })
    .filter(Boolean);
  const uniq = [];
  const seen = {};
  emails.forEach(function(em) {
    const k = em.toLowerCase();
    if (!seen[k]) { seen[k] = true; uniq.push(em); }
  });
  if (!uniq.length) {
    if (!opts.silent) notif('Sin correo destino configurado', 'warn');
    return false;
  }
  try {
    const rawData = await _gmailApiBest('GET', GMAIL_API_BASE + '/messages/' + msg.id + '?format=raw');
    var okCount = 0;
    for (var ri = 0; ri < uniq.length; ri++) {
      const encoded = _reenviarEmailEncodeRawForRecipient(rawData, uniq[ri], expId);
      await _gmailApiBest('POST', GMAIL_API_BASE + '/messages/send', { raw: encoded });
      okCount++;
    }
    if (!opts.silent && okCount) {
      const lbl = opts.label || uniq.join(', ');
      notif('Correo reenviado con adjuntos a ' + lbl, 'ok');
    }
    return okCount > 0;
  } catch (e) {
    console.error('reenviarEmailRawARecipientes:', e);
    if (!opts.silent) notif('Error al reenviar correo: ' + e.message, 'err');
    return false;
  }
}

async function reenviarEmailAOficina(msg, ofiId, expId, opts) {
  opts = opts || {};
  const ofiData = (encargadosGlobal && encargadosGlobal.oficinas && encargadosGlobal.oficinas[ofiId]) || {};
  const ofiEmail = (ofiData.email || '').trim();
  const ofiLabel = typeof labelOficina === 'function' ? labelOficina(ofiId) : ofiId;
  if (!ofiEmail) {
    notif('La oficina ' + ofiLabel + ' no tiene correo configurado en Encargados.', 'warn');
    return false;
  }
  return reenviarEmailRawARecipientes(msg, [ofiEmail], expId, Object.assign({}, opts, {
    label: ofiLabel + ' (' + ofiEmail + ')'
  }));
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
  if (typeof renderSecGmailBloqueoRadicacion === 'function') renderSecGmailBloqueoRadicacion();
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
  const bodyBlock = gmailMsgBodyHtmlForView(parts);
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
    bodyBlock;
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
  prePopularFormDesdeEmail(_gmailCurrentMsg);
  if (typeof gmailCloseAttViewer === 'function') gmailCloseAttViewer();
  var panelBody = document.getElementById('gmail-panel-body');
  var toggleBtn = document.getElementById('gmail-toggle-btn');
  if (panelBody) panelBody.style.display = 'none';
  if (toggleBtn) toggleBtn.textContent = 'Ver bandeja';
  activarSplitRadicacionEmail(_gmailCurrentMsg);
  notif('Formulario pre-llenado. Revise el correo a la izquierda y copie los datos al formulario.', 'ok');
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
  var split = document.getElementById('sec-radicar-split');
  if (emailPanel) emailPanel.classList.remove('active');
  if (split) split.classList.remove('split-active');
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
// drive.file: upload y crear carpetas; acceso a lo que la app creó
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
      const expMs = Date.now() + (expiresInSec || 3600) * 1000;
      sessionStorage.setItem(GMAIL_OFI_TOKEN_EXP_KEY, String(expMs));
      _sstGmailExpiryWarnShown = false;
      _gmailScheduleTokenWarning(expMs);
      _gmailScheduleTokenExpiry(expMs, 'ofi');
      if (typeof sstRenderGmailDriveStatusBtn === 'function') sstRenderGmailDriveStatusBtn();
      if (accountEmail) sessionStorage.setItem(GMAIL_OFI_ACCOUNT_KEY, String(accountEmail).trim().toLowerCase());
    } else {
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_KEY);
      sessionStorage.removeItem(GMAIL_OFI_TOKEN_EXP_KEY);
      sessionStorage.removeItem(GMAIL_OFI_ACCOUNT_KEY);
      _gmailClearExpiryTimer('ofi');
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
  // Verificar que la cuenta conectada coincide con el email autorizado del usuario actual
  const usuarioEmail = String(
    (window._usuarioActual && window._usuarioActual.email) || ''
  ).trim().toLowerCase();
  if (usuarioEmail && email && email !== usuarioEmail) {
    if (typeof confirmPrecaucion === 'function') {
      confirmPrecaucion({
        title: '⛔ Cuenta de Gmail no autorizada',
        message: 'No puede conectar la cuenta "' + email + '" a este perfil.',
        detail: 'Su cuenta autorizada en el sistema es "' + usuarioEmail + '".\n' +
                'Cierre sesión en Google y vuelva a conectar con su cuenta institucional.',
        confirmLabel: 'Entendido',
        hideCancel: true,
        tone: 'delete'
      }, function() {});
    } else {
      notif('⛔ No puede conectar "' + email + '". Su cuenta autorizada es "' + usuarioEmail + '".', 'err');
    }
    return false;
  }
  gmailOfiSetToken(tok, expiresInSec, email);
  if (typeof renderSstGmailSesionBloqueo === 'function') renderSstGmailSesionBloqueo();
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
function gmailOfiConnect(callback) {
  if (_gmailOfiIsSecretaria()) {
    if (gmailIsTokenValid()) {
      _updateGmailOfiBtn();
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      if (!_gmailOfiSignature) _gmailOfiLoadSignature();
      if (typeof sstFinalizeGmailConnect === 'function') sstFinalizeGmailConnect();
      if (callback) callback();
      return;
    }
    gmailConnect(function() {
      _updateGmailOfiBtn();
      gmailOfiFolder('INBOX');
      gmailOfiLoadLabels();
      _gmailOfiLoadSignature();
      if (typeof sstFinalizeGmailConnect === 'function') sstFinalizeGmailConnect();
      if (callback) callback();
    });
    return;
  }
  _gmailStartOAuth(GMAIL_OFI_SCOPES, async function(tok, exp) {
    const ok = await _gmailOfiValidarYGuardarToken(tok, exp);
    if (!ok) {
      _updateGmailOfiBtn();
      if (callback) callback();
      return;
    }
    _updateGmailOfiBtn();
    notif('✅ Correo conectado.', 'ok');
    gmailOfiFolder('INBOX');
    gmailOfiLoadLabels();
    _gmailOfiLoadSignature();
    if (typeof sstFinalizeGmailConnect === 'function') sstFinalizeGmailConnect();
    if (callback) callback();
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
  if (typeof renderSstGmailSesionBloqueo === 'function') renderSstGmailSesionBloqueo();
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
  _gmailOfiLoadMessages({ labelId, readFilter: _gmailOfiReadFilter || 'all' });
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
  _gmailOfiLoadMessages({ query: q, readFilter: _gmailOfiReadFilter || 'all' });
}

// Backward-compat alias
function gmailOfiLoadInbox(query) {
  if (query) gmailOfiSearch(query); else gmailOfiFolder('INBOX');
}

let _gmailOfiNextPageToken = '';
let _gmailOfiListOpts = null;
let _gmailOfiReadFilter = 'all'; // all | unread | read

function gmailOfiSetReadFilter(filter) {
  filter = String(filter || 'all');
  if (filter !== 'all' && filter !== 'unread' && filter !== 'read') filter = 'all';
  _gmailOfiReadFilter = filter;
  document.querySelectorAll('#gm-read-filter .gm-read-filter-btn').forEach(function(b) {
    b.classList.toggle('on', b.getAttribute('data-filter') === filter);
  });
  gmailOfiCloseMessage();
  // Recargar carpeta/búsqueda activa con el filtro
  if (_gmailOfiListOpts && _gmailOfiListOpts.query && !_gmailOfiListOpts._fromReadFilter) {
    _gmailOfiLoadMessages(Object.assign({}, _gmailOfiListOpts, { readFilter: filter }));
  } else {
    _gmailOfiLoadMessages({
      labelId: _gmailOfiActiveFolder || 'INBOX',
      readFilter: filter
    });
  }
}
window.gmailOfiSetReadFilter = gmailOfiSetReadFilter;

function _gmailOfiBuildListUrl(opts, pageToken) {
  opts = opts || {};
  const filter = opts.readFilter || _gmailOfiReadFilter || 'all';
  const labelId = opts.labelId || 'INBOX';
  let url;
  if (opts.query && !opts._fromReadFilter) {
    // Búsqueda del usuario: combinar con filtro de lectura
    let q = String(opts.query || '').trim();
    if (filter === 'unread') q = (q + ' is:unread').trim();
    else if (filter === 'read') q = (q + ' is:read').trim();
    url = GMAIL_API_BASE + '/messages?q=' + encodeURIComponent(q) + '&maxResults=50';
  } else if (filter === 'unread') {
    if (labelId === 'INBOX') {
      url = GMAIL_API_BASE + '/messages?labelIds=INBOX&labelIds=UNREAD&maxResults=50';
    } else {
      const q = 'label:' + labelId + ' is:unread';
      url = GMAIL_API_BASE + '/messages?q=' + encodeURIComponent(q) + '&maxResults=50';
    }
  } else if (filter === 'read') {
    const q = (labelId === 'INBOX' ? 'in:inbox' : ('label:' + labelId)) + ' is:read';
    url = GMAIL_API_BASE + '/messages?q=' + encodeURIComponent(q) + '&maxResults=50';
  } else {
    url = GMAIL_API_BASE + '/messages?labelIds=' + encodeURIComponent(labelId) + '&maxResults=50';
  }
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  return url;
}

async function _gmailOfiLoadMessages(opts, append) {
  opts = opts || {};
  if (!opts.readFilter) opts.readFilter = _gmailOfiReadFilter || 'all';
  if (!append) {
    _gmailOfiNextPageToken = '';
    _gmailOfiListOpts = opts;
  }
  const listEl = document.getElementById('gmail-ofi-inbox-list');
  if (!listEl) return;
  if (!_gmailOfiTokenValid()) {
    listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">🔒</div><div>Conecte su correo para ver los mensajes.</div></div>';
    _updateGmailOfiBtn();
    return;
  }
  if (!append) listEl.innerHTML = '<div class="gm-loading-state"><div class="gm-spinner"></div><span>Cargando…</span></div>';
  const countEl = document.getElementById('gm-list-count');
  if (!append && countEl) countEl.textContent = '';
  const loadMoreBtn = document.getElementById('gm-load-more-btn');
  if (loadMoreBtn && append) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Cargando…'; }
  try {
    const url = _gmailOfiBuildListUrl(opts, append ? _gmailOfiNextPageToken : '');
    const data = await _gmailOfiApi('GET', url);
    const ids = (data.messages || []).map(m => m.id);
    _gmailOfiNextPageToken = data.nextPageToken || '';
    if (!ids.length && !append) {
      const emptyLbl = opts.readFilter === 'unread' ? 'No hay mensajes no leídos' : (opts.readFilter === 'read' ? 'No hay mensajes leídos' : 'No hay mensajes aquí');
      listEl.innerHTML = '<div class="gm-empty-state"><div class="gm-empty-ico">📭</div><div>' + emptyLbl + '</div></div>';
      if (countEl) countEl.textContent = '';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }
    const msgs = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const res = await Promise.all(
        batch.map(id => _gmailOfiApi('GET', GMAIL_API_BASE + '/messages/' + id + '?format=full').catch(() => null))
      );
      msgs.push(...res.filter(Boolean));
    }
    if (append) _gmailOfiMessages = _gmailOfiMessages.concat(msgs);
    else _gmailOfiMessages = msgs;
    if (countEl) countEl.textContent = _gmailOfiMessages.length + ' mensaje' + (_gmailOfiMessages.length !== 1 ? 's' : '') + (_gmailOfiNextPageToken ? '+' : '');
    _renderGmailOfiList();
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.style.display = _gmailOfiNextPageToken ? '' : 'none';
      loadMoreBtn.textContent = 'Cargar más mensajes';
    }
  } catch(e) {
    if (!append) listEl.innerHTML = '<div class="gm-empty-state gm-err-state"><div class="gm-empty-ico">⚠️</div><div>' + escAttr(e.message) + '</div></div>';
    if (loadMoreBtn) { loadMoreBtn.disabled = false; loadMoreBtn.textContent = 'Cargar más mensajes'; }
  }
}

function gmailOfiLoadMore() {
  if (!_gmailOfiListOpts || !_gmailOfiNextPageToken) return;
  _gmailOfiLoadMessages(_gmailOfiListOpts, true);
}
window.gmailOfiLoadMore = gmailOfiLoadMore;

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
  if (parts.textHtml || parts.textPlain) {
    bodyHtml = gmailMsgBodyHtmlForView(parts).replace('sec-split-email-body', 'gm-msg-body');
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
  const infPqrsBtn = !_gmailOfiIsSecretaria()
    ? '<button type="button" class="gm-action-btn" style="background:var(--sf2);border:1px solid var(--bd);color:var(--tx)" onclick="gmailOfiMarcarInformativaPqrs()" title="Marcar PQRSD como informativa y cerrar sin enviar correo al ciudadano">ℹ Informativa</button>'
    : '';
  const isUnread = Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD');
  const unreadBtn = isUnread
    ? ''
    : '<button type="button" class="gm-action-btn" onclick="gmailOfiMarkUnread(\'' + escAttr(msg.id) + '\')" title="Marcar este mensaje como no leído">👁‍🗨 Marcar no leído</button>';

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
        unreadBtn +
        respPqrsBtn +
        infPqrsBtn +
        radicarBtn +
      '</div>' +
    '</div>' +
    attsHtml + bodyHtml;
}

async function gmailOfiMarkUnread(msgId) {
  msgId = String(msgId || (_gmailOfiCurrentMsg && _gmailOfiCurrentMsg.id) || '').trim();
  if (!msgId) return;
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  try {
    await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/' + msgId + '/modify', { addLabelIds: ['UNREAD'] });
    const msg = _gmailOfiMessages.find(m => m.id === msgId) || _gmailOfiCurrentMsg;
    if (msg) {
      if (!Array.isArray(msg.labelIds)) msg.labelIds = [];
      if (!msg.labelIds.includes('UNREAD')) msg.labelIds.push('UNREAD');
    }
    _renderGmailOfiList();
    _gmailOfiUpdateBadges();
    if (_gmailOfiCurrentMsg && _gmailOfiCurrentMsg.id === msgId) _renderGmailOfiMsgView(_gmailOfiCurrentMsg);
    notif('Mensaje marcado como no leído', 'ok');
  } catch (e) {
    notif('No se pudo marcar como no leído: ' + e.message, 'err');
  }
}
window.gmailOfiMarkUnread = gmailOfiMarkUnread;

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
  window._gmailOfiComposeAttachments = [];
  gmailOfiRenderComposeAttachments();
  // Limpiar contexto de respuesta PQRSD: solo aplica cuando se abre vía gmailOfiAbrirComposeRespuestaPqrs.
  window._gmailOfiPqrsRespCtx = null;
  opts = opts || {};
  const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  f('gm-compose-to',      opts.to || '');
  f('gm-compose-cc',      opts.cc || '');
  f('gm-compose-bcc',     opts.bcc || '');
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
  window._gmailOfiPqrsRespCtx = null;
  window._gmailOfiComposeAttachments = [];
  gmailOfiRenderComposeAttachments();
}
function gmailOfiAddComposeAttachment() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;
  inp.accept = '*/*';
  inp.onchange = function() {
    window._gmailOfiComposeAttachments = window._gmailOfiComposeAttachments || [];
    Array.from(inp.files || []).forEach(function(f) { window._gmailOfiComposeAttachments.push(f); });
    gmailOfiRenderComposeAttachments();
  };
  inp.click();
}
function gmailOfiRenderComposeAttachments() {
  const box = document.getElementById('gm-compose-att-list');
  if (!box) return;
  const files = window._gmailOfiComposeAttachments || [];
  if (!files.length) { box.innerHTML = ''; return; }
  box.innerHTML = files.map(function(f, i) {
    return '<div class="fx" style="gap:6px;align-items:center;margin-top:4px;font-size:12px;padding:4px 6px;background:var(--sf2);border-radius:var(--r)">' +
      '📎 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escAttr(f.name) + '</span>' +
      '<button type="button" class="btn bsm bd2" onclick="gmailOfiRemoveComposeAttachment(' + i + ')">✕</button></div>';
  }).join('');
}
function gmailOfiRemoveComposeAttachment(idx) {
  window._gmailOfiComposeAttachments = (window._gmailOfiComposeAttachments || []).filter(function(_, i) { return i !== idx; });
  gmailOfiRenderComposeAttachments();
}
function _gmailOfiFileToBase64(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() {
      const res = reader.result || '';
      const b64 = String(res).split(',')[1] || '';
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function _gmailOfiBuildMimeWithAttachments(to, cc, subject, userText, inReplyTo, files, bcc) {
  files = files || [];
  if (!files.length) return _gmailOfiBuildMime(to, cc, subject, userText, inReplyTo, bcc);
  const altBoundary = 'sst_alt_' + Date.now();
  const mixBoundary = 'sst_mix_' + Date.now();
  const subjectEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const plainBody = (userText || '') + (_gmailOfiSignature || '');
  const userHtml = '<div style="font-family:Arial,sans-serif;font-size:14px">' + _gmailOfiTextToHtml(userText || '') + '</div>';
  const sigHtml = _gmailOfiSignatureHtml
    ? '<div><br><div style="border-top:1px solid #e0e0e0;padding-top:8px">' + _gmailOfiSignatureHtml + '</div></div>'
    : '';
  const htmlB64 = btoa(unescape(encodeURIComponent(userHtml + sigHtml)));
  const altPart = [
    '--' + altBoundary,
    'Content-Type: text/plain; charset=utf-8',
    '',
    plainBody,
    '',
    '--' + altBoundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    '',
    '--' + altBoundary + '--'
  ].join('\r\n');
  const attParts = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const b64 = await _gmailOfiFileToBase64(f);
    const fnameEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(f.name || 'adjunto'))) + '?=';
    attParts.push(
      '--' + mixBoundary,
      'Content-Type: ' + (f.type || 'application/octet-stream') + '; name="' + fnameEnc + '"',
      'Content-Disposition: attachment; filename="' + fnameEnc + '"',
      'Content-Transfer-Encoding: base64',
      '',
      b64.replace(/\s/g, '')
    );
  }
  const lines = [
    'To: ' + to,
    cc ? 'Cc: ' + cc : null,
    bcc ? 'Bcc: ' + bcc : null,
    'Subject: ' + subjectEnc,
    inReplyTo ? 'In-Reply-To: ' + inReplyTo : null,
    inReplyTo ? 'References: ' + inReplyTo : null,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + mixBoundary + '"',
    '',
    '--' + mixBoundary,
    'Content-Type: multipart/alternative; boundary="' + altBoundary + '"',
    '',
    altPart,
    ''
  ].concat(attParts).concat(['--' + mixBoundary + '--']).filter(function(l) { return l !== null; });
  return btoa(unescape(encodeURIComponent(lines.join('\r\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _gmailOfiBuildMime(to, cc, subject, userText, inReplyTo, bcc) {
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
    bcc ? 'Bcc: ' + bcc : null,
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

// Construye un MIME cuyo cuerpo YA es HTML (no lo re-escapa como texto de usuario).
// Se usa para las notificaciones automáticas al ciudadano (radicación/respuesta PQRSD).
function _gmailOfiBuildHtmlMime(to, subject, htmlBody) {
  const boundary = 'sst_ofihtml_' + Date.now();
  const subjectEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const htmlB64 = btoa(unescape(encodeURIComponent(htmlBody || '')));
  const plainAlt = String(htmlBody || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
  const lines = [
    'To: ' + to,
    'Subject: ' + subjectEnc,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=utf-8',
    '',
    plainAlt,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    '',
    '--' + boundary + '--'
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(lines))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Alias used by core.js workflow — sends a plain HTML email using the office token
async function gmailOfiSendMessage(to, subject, htmlBody) {
  const mime = _gmailOfiBuildHtmlMime(to, subject, htmlBody);
  return _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: mime });
}

/** MIME HTML institucional con adjuntos reales (oficio / anexos de notificación PQRSD). */
async function _gmailOfiBuildHtmlMimeWithAttachments(to, subject, htmlBody, files, cc, bcc) {
  files = files || [];
  if (!files.length) return _gmailOfiBuildHtmlMime(to, subject, htmlBody);
  const altBoundary = 'sst_ofihtml_alt_' + Date.now();
  const mixBoundary = 'sst_ofihtml_mix_' + Date.now();
  const subjectEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject || ''))) + '?=';
  const htmlB64 = btoa(unescape(encodeURIComponent(htmlBody || '')));
  const plainAlt = String(htmlBody || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
  const altPart = [
    '--' + altBoundary,
    'Content-Type: text/plain; charset=utf-8',
    '',
    plainAlt,
    '',
    '--' + altBoundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    '',
    '--' + altBoundary + '--'
  ].join('\r\n');
  const attParts = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f) continue;
    const b64 = await _gmailOfiFileToBase64(f);
    const fnameEnc = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(f.name || 'adjunto'))) + '?=';
    attParts.push(
      '--' + mixBoundary,
      'Content-Type: ' + (f.type || 'application/octet-stream') + '; name="' + fnameEnc + '"',
      'Content-Disposition: attachment; filename="' + fnameEnc + '"',
      'Content-Transfer-Encoding: base64',
      '',
      b64.replace(/\s/g, '')
    );
  }
  const lines = [
    'To: ' + to,
    cc ? 'Cc: ' + cc : null,
    bcc ? 'Bcc: ' + bcc : null,
    'Subject: ' + subjectEnc,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + mixBoundary + '"',
    '',
    '--' + mixBoundary,
    'Content-Type: multipart/alternative; boundary="' + altBoundary + '"',
    '',
    altPart,
    ''
  ].concat(attParts).concat(['--' + mixBoundary + '--']).filter(function(l) { return l !== null; });
  return btoa(unescape(encodeURIComponent(lines.join('\r\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Envía HTML desde el Gmail de oficina con adjuntos (File/Blob). opts: {cc,bcc} */
async function gmailOfiSendHtmlWithAttachments(to, subject, htmlBody, files, opts) {
  opts = opts || {};
  const mime = await _gmailOfiBuildHtmlMimeWithAttachments(
    to, subject, htmlBody, files || [], opts.cc || '', opts.bcc || ''
  );
  return _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: mime });
}

async function gmailOfiSendCompose() {
  if (!_gmailOfiTokenValid()) { notif('⚠️ Reconecte su correo.', 'err'); return; }
  const modal = document.getElementById('gm-compose-modal');
  const g = id => (document.getElementById(id)||{}).value||'';
  const to = g('gm-compose-to'), cc = g('gm-compose-cc'), bcc = g('gm-compose-bcc'),
        subject = g('gm-compose-subject'), body = g('gm-compose-body'),
        inReplyTo = (modal&&modal.dataset.inReplyTo)||'';
  if (!to.trim()) { notif('Ingrese el destinatario.', 'err'); return; }
  if (!body.trim()) { notif('El mensaje está vacío.', 'err'); return; }
  const sendBtn = document.querySelector('#gm-compose-modal .gm-compose-send');
  if (sendBtn) { sendBtn.textContent = '⏳ Enviando…'; sendBtn.disabled = true; }
  try {
    const files = window._gmailOfiComposeAttachments || [];
    const raw = files.length
      ? await _gmailOfiBuildMimeWithAttachments(to, cc, subject, body, inReplyTo, files, bcc)
      : _gmailOfiBuildMime(to, cc, subject, body, inReplyTo, bcc);
    await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: raw });
    // Capturar el contexto de respuesta PQRSD antes de descartar (discardDraft lo limpia).
    const pqrsCtx = window._gmailOfiPqrsRespCtx;
    notif('✅ Mensaje enviado.', 'ok');
    gmailOfiDiscardDraft();
    if (_gmailOfiActiveFolder === 'SENT') gmailOfiFolder('SENT');
    if (pqrsCtx && pqrsCtx.expId) {
      try { _gmailOfiFinalizarRespuestaPqrsDesdeCompose(pqrsCtx, { subject: subject, body: body, to: to }); }
      catch (err) { console.warn('finalizar PQRSD tras compose:', err); }
    }
  } catch(e) {
    notif('Error al enviar: ' + e.message, 'err');
    if (sendBtn) { sendBtn.textContent = '📤 Enviar'; sendBtn.disabled = false; }
  }
}

// Cierra y persiste la PQRSD tras enviar respuesta por correo (compose inline o bandeja).
async function _gmailOfiFinalizarRespuestaPqrsDesdeCompose(ctx, mail) {
  const e = (typeof exps !== 'undefined' ? exps : []).find(x => String(x._exp || '').trim() === String(ctx.expId || '').trim());
  if (!e) return;
  const yaCerrada = typeof pqrsEstaCerrada === 'function' && pqrsEstaCerrada(e);
  const fecha = ctx.fechaResp || (typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0, 10));
  const cuerpo = String((mail && mail.body) || '').trim();
  const tipo = ctx.tipo || (typeof PQRS_WF_TIPO !== 'undefined' ? PQRS_WF_TIPO.MENSAJE : 'mensaje');
  const oficio = ctx.oficio || '';
  const todosCorreos = typeof pqrsCorreosCiudadano === 'function' ? pqrsCorreosCiudadano(e) : [];
  const paraRaw = String(ctx.ciudEmail || (mail && mail.to) || '').trim().toLowerCase();
  const para = todosCorreos.length ? todosCorreos.join(', ') : paraRaw;
  const canalCorreo = typeof PQRS_WF_CANAL !== 'undefined' ? PQRS_WF_CANAL.CORREO : 'correo';
  const cerradoPor = typeof responsableActivo !== 'undefined' ? responsableActivo : '';
  const documentos = [];
  const adjFiles = ctx.attachments || [];
  const expId = e._exp || ctx.expId || '';
  const nombreCarpeta = e._qd_nombre || e._pn_nombre || e._pj_empresa || expId;
  const fechaExp = e._fecha || e._fecha_solicitud || '';

  if (!yaCerrada && adjFiles.length && typeof driveUploadInstitutional === 'function') {
    for (let i = 0; i < adjFiles.length; i++) {
      const file = adjFiles[i];
      if (!file) continue;
      try {
        const res = await driveUploadInstitutional(
          file, file.name, file.type || 'application/octet-stream',
          'respuesta_aprobada', expId, nombreCarpeta, fechaExp,
          { expediente: e, uploadTarget: 'respuesta' }
        );
        documentos.push({
          nombre: file.name, driveLink: res.driveLink, previewLink: res.previewLink || '',
          fileId: res.fileId || '', tipo: 'archivo', mime: file.type || ''
        });
      } catch (err) {
        console.warn('Adjunto respuesta PQRSD:', file.name, err);
      }
    }
  }

  if (!yaCerrada && typeof _pqrsSubirSoporteRespuesta === 'function') {
    try {
      const soporteRes = await _pqrsSubirSoporteRespuesta(e, { fechaResp: fecha, cuerpo, documentos, cerradoPor: cerradoPor });
      if (soporteRes && soporteRes.driveLink) {
        const yaTiene = documentos.some(d => d && d.tipo === 'soporte_respuesta');
        if (!yaTiene) {
          documentos.push({
            nombre: 'Soporte de respuesta', driveLink: soporteRes.driveLink,
            previewLink: soporteRes.previewLink || '', fileId: soporteRes.fileId || '', tipo: 'soporte_respuesta'
          });
        }
      }
    } catch (err) { console.warn('Soporte respuesta compose:', err); }
  }

  if (!yaCerrada && typeof setPqrsWorkflow === 'function') {
    setPqrsWorkflow(e, {
      fase: typeof PQRS_WF !== 'undefined' ? PQRS_WF.CERRADA : 'cerrada_atendida',
      tipo: tipo,
      canal: canalCorreo,
      cuerpo: cuerpo || '',
      oficio: oficio,
      fecha_respuesta: fecha,
      documentos: documentos,
      cerrado_por: cerradoPor,
      cerrado_en: new Date().toISOString()
    });
  }
  if (!yaCerrada && typeof registrarPqrsRespuestaCore === 'function') {
    registrarPqrsRespuestaCore(e, {
      fechaResp: fecha, oficioExt: oficio, medioResp: canalCorreo, cuerpo: cuerpo,
      tipo: tipo, canal: canalCorreo, notaInterna: ctx.notaInterna, esNotaPublica: false,
      adj: { links: [], files: [] }, archivos: documentos
    });
    if (documentos.length) {
      e._pqrs_respuesta_soportes = documentos.map(function(a, i) {
        return {
          label: a.nombre || ('Respuesta ' + (i + 1)),
          url: a.driveLink || a.previewLink || '',
          preview: a.previewLink || a.driveLink || '',
          mime: a.mime || ''
        };
      });
      if (!e._pqrs_respuesta_link && documentos[0]) {
        e._pqrs_respuesta_link = documentos[0].driveLink || documentos[0].previewLink || '';
      }
    }
  } else if (!yaCerrada) {
    e._pqrs_estado_oficina = 'cerrado';
    e._estado = 'Atendido';
    e._fecha_res = fecha;
    e._pqrs_respuesta_fecha = fecha;
    e._pqrs_respuesta_medio = 'electronica';
    if (cuerpo) e._pqrs_respuesta_nota = cuerpo;
    if (documentos.length) {
      e._pqrs_respuesta_soportes = documentos.map(function(a, i) {
        return {
          label: a.nombre || ('Respuesta ' + (i + 1)),
          url: a.driveLink || a.previewLink || '',
          preview: a.previewLink || a.driveLink || '',
          mime: a.mime || ''
        };
      });
    }
  }
  if (ctx.notaInterna) e._pqrs_notas_internas = ctx.notaInterna;
  if (oficio) e._pqrs_respuesta_oficio = oficio;
  if (typeof registrarNotificacionCiudadanoPqrs === 'function') {
    registrarNotificacionCiudadanoPqrs(e, {
      tipo: 'respuesta', medio: 'correo', enviado: true, a: para,
      por: typeof responsableActivo !== 'undefined' ? responsableActivo : '',
      histTipo: 'notificacion_correo',
      histNota: 'Respuesta enviada por correo a ' + (para || 'ciudadano')
    });
  } else {
    if (!Array.isArray(e._pqrs_historial)) e._pqrs_historial = [];
    e._pqrs_historial.push({ tipo: 'notificacion_correo', fecha: fecha, nota: 'Respuesta enviada por correo a ' + (para || 'ciudadano'), oficina: e._pqrs_oficina || '' });
  }
  if (typeof persistExpedienteGranular === 'function') persistExpedienteGranular(e);
  if (typeof renderPqrsOficinaInbox === 'function') renderPqrsOficinaInbox();
  if (typeof renderSecretariaPqrs === 'function') renderSecretariaPqrs();
  if (typeof refreshPqrsDetalleViews === 'function') refreshPqrsDetalleViews(e._exp);
  notif('✅ PQRSD ' + e._exp + ' registrada como respondida por correo', 'ok');
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

// Extrae el número de radicado del asunto, ej. "PQRSD #707" o "[PQRSD #707]" → "707".
function _gmailExtractRadicadoFromSubject(subject) {
  if (!subject) return '';
  const s = String(subject);
  const patterns = [
    /\[?\s*PQRSD\s*[#N°ºo:.\-\s]*\s*([A-Za-z0-9\-]+)\s*\]?/i,
    /PQRSD\s*[#N°ºo:.\-\s]*\s*([A-Za-z0-9\-]+)/i,
    /radicado\s*[#N°ºo:.\-\s]*\s*([A-Za-z0-9\-]+)/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    const m = s.match(patterns[i]);
    if (m && m[1]) return String(m[1]).replace(/\]$/, '').trim();
  }
  return '';
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
  const tit = document.getElementById('task-modal-title');
  if (tit) tit.textContent = 'Registrar respuesta por correo · ' + ex._exp;
  if (window._taskModalCtx) window._taskModalCtx.expId = ex._exp;
}

function gmailClearPqrsRespSel() {
  gmailSetPqrsRespSel(null);
  gmailTogglePqrsRespSearch(true);
}

async function gmailOfiVincularRespuestaPqrs() {
  const msg = _gmailOfiCurrentMsg;
  if (!msg) { notif('Seleccione un correo de la bandeja', 'err'); return; }
  const detectada = await _gmailFindPqrsForCurrentMsgAsync(msg);
  // Los responsables NUNCA responden directo al ciudadano desde su correo:
  // se enruta al flujo de entrega para revisión del encargado/NCA (igual que
  // el botón "entregar actividad" del menú de Actividades).
  if (typeof esModoResponsable === 'function' && esModoResponsable()) {
    return _gmailResponsableEntregarPqrsDesdeCorreo(detectada, false);
  }
  if (typeof openPqrsRespuestaModal === 'function') {
    openPqrsRespuestaModal(detectada ? detectada._exp : '', { fromGmail: true, gmailMsg: msg, detectada: !!detectada });
  }
}

// Enruta a un responsable al flujo de entrega (revisión NCA) desde su bandeja de correo.
function _gmailResponsableEntregarPqrsDesdeCorreo(e, informativa) {
  if (!e) {
    notif('No se detectó la PQRSD de este correo. Verifique que el número esté en el asunto y radicado en el sistema.', 'err');
    return;
  }
  const expId = String(e._exp || '').trim();
  const task = (e.tasks || []).find(function(t) {
    return t && !t.eliminada && typeof taskEsAtenderPqrs === 'function' && taskEsAtenderPqrs(t, e);
  });
  if (!task) { notif('No tiene una actividad de atención asignada para esta PQRSD.', 'err'); return; }
  // Verificar que el responsable activo esté entre los asignados
  if (typeof responsableActivo !== 'undefined' && responsableActivo && typeof getTaskResponsables === 'function') {
    const rs = getTaskResponsables(task);
    if (rs.length && !rs.some(function(n) { return agendaNorm(n) === agendaNorm(responsableActivo); })) {
      notif('Esta PQRSD no está asignada a usted.', 'err');
      return;
    }
  }
  if (typeof openEnviarSoporteModal !== 'function') { notif('No se pudo abrir el formulario de entrega', 'err'); return; }
  openEnviarSoporteModal(expId, task.id);
  if (informativa) {
    setTimeout(function() {
      try { if (typeof setPqrsRespTipo === 'function' && typeof PQRS_WF_TIPO !== 'undefined') setPqrsRespTipo(PQRS_WF_TIPO.INFORMATIVA); } catch (_e) {}
      const c = document.getElementById('pqrs-entrega-resp-cuerpo');
      if (c) { c.focus(); }
    }, 80);
    notif('Indique la descripción informativa (obligatoria). Se enviará a revisión de NCA y será visible en consulta ciudadana.', 'info');
  }
}
window._gmailResponsableEntregarPqrsDesdeCorreo = _gmailResponsableEntregarPqrsDesdeCorreo;

function _gmailFindPqrsForCurrentMsg(msg) {
  if (!msg) return null;
  const headers = msg.payload && msg.payload.headers ? msg.payload.headers : [];
  const subjH = headers.find(function(h) { return h.name === 'Subject'; });
  const subject = subjH ? String(subjH.value || '') : '';
  const radTok = _gmailExtractRadicadoFromSubject(subject);
  let hit = radTok ? _gmailFindPqrsByRadicado(radTok) : null;
  if (hit) return hit;
  const mid = String(msg.id || '').trim();
  if (!mid) return null;
  return (typeof exps !== 'undefined' ? exps : []).find(function(e) {
    return e && String(e._gmail_message_id || '') === mid && typeof esPqrsSecretaria === 'function' && esPqrsSecretaria(e);
  }) || null;
}

async function _gmailFindPqrsForCurrentMsgAsync(msg) {
  let hit = _gmailFindPqrsForCurrentMsg(msg);
  if (hit) return hit;
  const headers = msg && msg.payload && msg.payload.headers ? msg.payload.headers : [];
  const subjH = headers.find(function(h) { return h.name === 'Subject'; });
  const subject = subjH ? String(subjH.value || '') : '';
  const radTok = _gmailExtractRadicadoFromSubject(subject);
  if (!radTok || typeof fetchExpedientePorNumero !== 'function') return null;
  try {
    const remote = await fetchExpedientePorNumero(radTok);
    if (!remote || typeof esPqrsSecretaria !== 'function' || !esPqrsSecretaria(remote)) return null;
    if (typeof mergeExpIntoExpsCache === 'function') mergeExpIntoExpsCache(remote);
    else if (typeof exps !== 'undefined') {
      const idx = exps.findIndex(function(e) { return String(e._exp || '').trim() === String(remote._exp || '').trim(); });
      if (idx >= 0) exps[idx] = remote; else exps.push(remote);
    }
    return remote;
  } catch (err) {
    console.warn('_gmailFindPqrsForCurrentMsgAsync:', err);
    return null;
  }
}

async function gmailOfiMarcarInformativaPqrs() {
  const msg = _gmailOfiCurrentMsg;
  if (!msg) { notif('Seleccione un correo de la bandeja', 'err'); return; }
  const detectada = await _gmailFindPqrsForCurrentMsgAsync(msg);
  // Responsables: la "informativa" pasa por revisión de NCA (con motivo obligatorio),
  // no cierra directamente. Se enruta al flujo de entrega.
  if (typeof esModoResponsable === 'function' && esModoResponsable()) {
    return _gmailResponsableEntregarPqrsDesdeCorreo(detectada, true);
  }
  if (!detectada) {
    const headers = msg.payload && msg.payload.headers ? msg.payload.headers : [];
    const subjH = headers.find(function(h) { return h.name === 'Subject'; });
    const subject = subjH ? String(subjH.value || '') : '';
    const tok = _gmailExtractRadicadoFromSubject(subject);
    notif(tok
      ? ('No se encontró la PQRSD #' + tok + ' en el sistema. Verifique que esté radicada y sincronizada en Firestore.')
      : 'No se detectó PQRSD en el asunto. Busque el número en el menú PQRSD → ℹ Informativa.', 'err');
    return;
  }
  if (typeof puedeMarcarPqrsInformativa === 'function' && !puedeMarcarPqrsInformativa(detectada)) {
    notif('No puede marcar esta PQRSD como informativa', 'err');
    return;
  }
  if (typeof SST !== 'undefined' && typeof SST.openMarcarPqrsInformativaModal === 'function') {
    SST.openMarcarPqrsInformativaModal(detectada._exp);
  } else if (typeof openMarcarPqrsInformativaModal === 'function') {
    openMarcarPqrsInformativaModal(detectada._exp);
  }
}
window.gmailOfiMarcarInformativaPqrs = gmailOfiMarcarInformativaPqrs;

async function submitPqrsRespuestaGmailVinculo() {
  const expId = String((document.getElementById('gmail-resp-pqrs-hid') || {}).value || '').trim();
  const fecha = String((document.getElementById('pqrs-resp-fecha') || {}).value || '').trim();
  const oficio = String((document.getElementById('pqrs-resp-oficio') || {}).value || '').trim();
  const ciudEmail = String((document.getElementById('gmail-resp-pqrs-email') || {}).value || '').trim().toLowerCase();
  const ciudCc = String((document.getElementById('gmail-resp-pqrs-cc') || {}).value || '').trim().toLowerCase();
  const ciudBcc = String((document.getElementById('gmail-resp-pqrs-bcc') || {}).value || '').trim().toLowerCase();
  const cuerpo = String((document.getElementById('pqrs-resp-cuerpo') || {}).value || '').trim();
  const tipoResp = String((document.getElementById('pqrs-resp-tipo') || {}).value || PQRS_WF_TIPO.MENSAJE).trim();
  const notaInterna = String((document.getElementById('pqrs-resp-nota') || {}).value || '').trim();

  if (!expId) { notif('Seleccione la PQRSD a cerrar', 'err'); return; }
  if (!fecha) { notif('Indique la fecha de la respuesta', 'err'); return; }
  if (!cuerpo) { notif('Escriba el resumen de la respuesta', 'err'); return; }

  // Oficio firmado: N° + adjunto obligatorio + no duplicado
  if (typeof pqrsValidateOficioRespuesta === 'function') {
    if (!pqrsValidateOficioRespuesta(tipoResp, {
      requireAdj: tipoResp === PQRS_WF_TIPO.OFICIO,
      adjMsg: 'Para oficio firmado debe adjuntar el documento del oficio.'
    })) return;
  } else if (tipoResp === PQRS_WF_TIPO.OFICIO && !oficio) {
    notif('Indique el N° de oficio', 'err'); return;
  }

  const e = (typeof exps !== 'undefined' ? exps : []).find(x => String(x._exp || '').trim() === expId);
  if (!e) { notif('PQRSD no encontrada', 'err'); return; }
  if (typeof pqrsEstaCerrada === 'function' && pqrsEstaCerrada(e)) { notif('Esta PQRSD ya está cerrada', 'err'); return; }

  const btn = document.getElementById('pqrs-resp-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Procesando…'; }

  const adj = typeof collectPqrsRespAdjuntos === 'function' ? collectPqrsRespAdjuntos('pqrs-resp-adj-rows') : { links: [], files: [] };
  let documentos = [];
  const usaDriveInst = typeof DRIVE_INST_DEPTOS !== 'undefined' && DRIVE_INST_DEPTOS.has((typeof deptoActivo !== 'undefined' ? deptoActivo : '') || '');
  const nombreCarpeta = e._qd_nombre || e._pn_nombre || expId;
  const gmailMsg = window._gmailVinculoMsg || _gmailOfiCurrentMsg;

  if (gmailMsg && typeof subirAdjuntosGmailMsgRespuestaADrive === 'function') {
    const driveOkGmail = typeof sstSolicitarDriveParaPqrs === 'function' ? await sstSolicitarDriveParaPqrs(e) : true;
    if (!driveOkGmail) {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar como respuesta oficial'; }
      return;
    }
    if (btn) btn.textContent = 'Subiendo adjuntos del correo…';
    const gmailDocs = await subirAdjuntosGmailMsgRespuestaADrive(gmailMsg, e);
    documentos = documentos.concat(gmailDocs);
  }

  if (usaDriveInst && adj.files && adj.files.length) {
    const driveOk = typeof sstSolicitarDriveParaPqrs === 'function' ? await sstSolicitarDriveParaPqrs(e) : true;
    if (!driveOk) {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar como respuesta oficial'; }
      return;
    }
    let idxFile = 0;
    for (const item of adj.files) {
      const file = item.file;
      const statusEl = item.statusEl;
      try {
        if (statusEl) statusEl.textContent = '⬆ Subiendo…';
        const res = await driveUploadInstitutional(file, file.name, file.type || 'application/octet-stream', 'respuesta_aprobada', expId, nombreCarpeta, e._fecha || e._fecha_solicitud || '', { expediente: e, uploadTarget: 'respuesta' });
        if (statusEl) statusEl.textContent = '✅ Subido';
        documentos.push({
          nombre: file.name, driveLink: res.driveLink, previewLink: res.previewLink, fileId: res.fileId,
          tipo: (tipoResp === PQRS_WF_TIPO.OFICIO && idxFile === 0) ? 'oficio_firmado' : 'archivo',
          mime: file.type || ''
        });
        idxFile++;
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ Error';
        console.error('Drive upload:', err);
      }
    }
  }
  (adj.links || []).forEach(function(lnk) {
    documentos.push({ nombre: 'Link Drive', driveLink: lnk, tipo: 'link' });
  });

  if (btn) btn.textContent = 'Generando soporte…';
  const soporteRes = typeof _pqrsSubirSoporteRespuesta === 'function'
    ? await _pqrsSubirSoporteRespuesta(e, { fechaResp: fecha, cuerpo, documentos })
    : null;
  if (soporteRes && soporteRes.driveLink && !documentos.some(d => d && d.tipo === 'soporte_respuesta')) {
    documentos.push({ nombre: 'Soporte de respuesta', driveLink: soporteRes.driveLink, previewLink: soporteRes.previewLink || '', fileId: soporteRes.fileId || '', tipo: 'soporte_respuesta' });
  }

  const wfPatch = {
    fase: typeof PQRS_WF !== 'undefined' ? PQRS_WF.CERRADA : 'cerrada_atendida',
    tipo: tipoResp,
    canal: typeof PQRS_WF_CANAL !== 'undefined' ? PQRS_WF_CANAL.CORREO : 'correo',
    cuerpo, oficio, fecha_respuesta: fecha, documentos,
    email_to: ciudEmail,
    email_cc: ciudCc,
    email_bcc: ciudBcc,
    cerrado_por: typeof responsableActivo !== 'undefined' ? responsableActivo : '',
    cerrado_en: new Date().toISOString()
  };
  if (typeof setPqrsWorkflow === 'function') setPqrsWorkflow(e, wfPatch);
  if (typeof registrarPqrsRespuestaCore === 'function') {
    registrarPqrsRespuestaCore(e, {
      fechaResp: fecha, oficioExt: oficio, medioResp: 'correo', cuerpo, tipo: tipoResp,
      canal: typeof PQRS_WF_CANAL !== 'undefined' ? PQRS_WF_CANAL.CORREO : 'correo',
      notaInterna, esNotaPublica: false, adj: { links: adj.links || [], files: [] }, archivos: documentos
    });
  }
  if (typeof registrarNotificacionCiudadanoPqrs === 'function') {
    const destNota = (ciudEmail || 'ciudadano') + (ciudCc ? ' · Cc: ' + ciudCc : '') + (ciudBcc ? ' · Cco: ' + ciudBcc : '');
    registrarNotificacionCiudadanoPqrs(e, {
      tipo: 'respuesta', medio: 'correo', enviado: true, a: ciudEmail,
      cc: ciudCc, bcc: ciudBcc,
      por: typeof responsableActivo !== 'undefined' ? responsableActivo : '',
      histTipo: 'notificacion_correo',
      histNota: 'Respuesta registrada por correo a ' + destNota
    });
  }
  if (typeof persistExpedienteGranular === 'function') persistExpedienteGranular(e);
  window._gmailVinculoMsg = null;
  if (typeof closeTaskModal === 'function') closeTaskModal();
  if (typeof renderPqrsOficinaInbox === 'function') renderPqrsOficinaInbox();
  if (typeof renderSecretariaPqrs === 'function') renderSecretariaPqrs();
  if (typeof refreshPqrsDetalleViews === 'function') refreshPqrsDetalleViews(expId);
  notif('✅ PQRSD ' + expId + ' cerrada como respondida por correo', 'ok');
  if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar como respuesta oficial'; }
  if (_gmailOfiCurrentMsg && _gmailOfiTokenValid()) {
    try { await _gmailApplyRadLabel(_gmailOfiCurrentMsg.id); } catch (err) { console.warn('Label error:', err); }
  }
}
window.submitPqrsRespuestaGmailVinculo = submitPqrsRespuestaGmailVinculo;

// ---- Abrir compose pre-llenado para responder una PQRSD ----
async function gmailOfiSendPqrsRespuestaInline(opts) {
  opts = opts || {};
  const expId = opts.expId;
  const toRaw = String(opts.to || '').trim();
  const ccRaw = String(opts.cc || '').trim();
  const bccRaw = String(opts.bcc || '').trim();
  const subject = String(opts.subject || '').trim();
  const body = String(opts.body || '').trim();
  const attachments = opts.attachments || [];
  const toList = toRaw.split(/[,;]+/).map(function(s){ return s.trim().toLowerCase(); }).filter(function(s){ return s && s.indexOf('@') > 0; });
  const ccList = ccRaw.split(/[,;]+/).map(function(s){ return s.trim().toLowerCase(); }).filter(function(s){ return s && s.indexOf('@') > 0; });
  const bccList = bccRaw.split(/[,;]+/).map(function(s){ return s.trim().toLowerCase(); }).filter(function(s){ return s && s.indexOf('@') > 0; });
  if (!expId || !toList.length || !body) throw new Error('Datos incompletos para enviar');
  if (!_gmailOfiTokenValid() && !(typeof gmailIsTokenValid === 'function' && gmailIsTokenValid())) {
    throw new Error('Conecte su correo Gmail');
  }
  if (!_gmailOfiSignature && !_gmailOfiSignatureHtml) {
    await _gmailOfiLoadSignature();
  }
  const cc = ccList.join(', ');
  const bcc = bccList.join(', ');
  // Un solo envío con To (todos) + Cc + Bcc — evita duplicar adjuntos por destinatario
  const to = toList.join(', ');
  const raw = attachments.length
    ? await _gmailOfiBuildMimeWithAttachments(to, cc, subject, body, '', attachments, bcc)
    : _gmailOfiBuildMime(to, cc, subject, body, '', bcc);
  await _gmailOfiApi('POST', GMAIL_API_BASE + '/messages/send', { raw: raw });
  notif(toList.length > 1 ? ('✅ Mensaje enviado a ' + toList.length + ' destinatarios.') : '✅ Mensaje enviado.', 'ok');
  await _gmailOfiFinalizarRespuestaPqrsDesdeCompose({
    expId: expId,
    ciudEmail: to,
    tipo: opts.tipo,
    oficio: opts.oficio,
    fechaResp: opts.fechaResp,
    notaInterna: opts.notaInterna,
    attachments: attachments
  }, { subject: subject, body: body, to: to, cc: cc, bcc: bcc });
}
window.gmailOfiSendPqrsRespuestaInline = gmailOfiSendPqrsRespuestaInline;

// Llama desde la bandeja PQRSD de la oficina para componer la respuesta por correo
function gmailOfiAbrirComposeRespuestaPqrs(expId) {
  const e = (typeof exps !== 'undefined' ? exps : []).find(x => String(x._exp || '').trim() === String(expId || '').trim());
  if (!e) { notif('PQRSD no encontrada', 'err'); return; }
  const ciudEmail = typeof pqrsCorreoCiudadano === 'function' ? pqrsCorreoCiudadano(e) : ((e._qd_correo || e._pn_correo || '').trim());
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
  _gmailCurrentMsg = msg;
  window._gmailPendingMsgId = msg.id;
  window._gmailPendingAttachments = null;
  if (typeof showTab === 'function') showTab('sec');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (typeof gmailPreRadicarPqrs === 'function') gmailPreRadicarPqrs();
    });
  });
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
