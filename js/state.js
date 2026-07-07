// =============================================================================
// state.js — Estado mutable global de la aplicación SST
// Cargar después de utils.js (hoy() se usa en inicialización de agenda).
// =============================================================================

// ── Sesión y navegación ───────────────────────────────────────────────────────
let rolSesion=null;
let deptoActivo='guaviare';
let responsableActivo='';
let deptoCfg='guaviare';
let cfgByDepto={};

// ── Datos de negocio ──────────────────────────────────────────────────────────
let exps=[];
let cfg={};
let editId=null;
let tkSeq=0;
let personas=[];
let actividadesLibres=[];
let agendaEventos=[];

// ── UI — autocomplete ─────────────────────────────────────────────────────────
let actSugInput=null;
let personSugInput=null;

// ── Agenda (estado UI) ────────────────────────────────────────────────────────
window._agendaMes=new Date();
window._agendaDiaSel=hoy();
window._agendaVista='mes';

// ── Chat ──────────────────────────────────────────────────────────────────────
let chatMensajes=[];
window._chatConvActiva=null;
window._chatVista='contactos';

// ── Auth / Firestore ──────────────────────────────────────────────────────────
let encargadosGlobal=null;
let recursosEnlaces=[];
let bibliotecaRepos=[];
let recursosConfig={guainiaDriveRoot:'',vaupesDriveRoot:''};
let authUsuario=null;
let _localSaving=false;
let _fsUnsub=null;
let _cfgUnsub=null;
let _cfgAllUnsubs=[];
let _globalUnsub=null;
let _chatUnsub=null;
let _sessionId=null;
let _sessionUnsub=null;
let _sessionHeartbeatTimer=null;
