// =============================================================================
// ingreso.js — INGRESO POR ROLES
// Depende de: persistence.js (persistCfgDepto), roles.js, core.js
// Cargar antes del script principal de index.html.
// =============================================================================
// INGRESO POR ROLES
// ================================================================
// ROLES_INGRESO → js/constants.js
const SESSION_STALE_MS=90*1000;
const SESSION_HEARTBEAT_MS=25000;

function sessionDocRef(email){
  const db=window._db;
  email=String(email||'').trim().toLowerCase();
  if(!db||!window._fsDoc||!email)return null;
  return window._fsDoc(db,'sesiones',email);
}
function generateSessionId(){
  return 'sess_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
}
function sesionRemotaEstaViva(data){
  data=data||{};
  const sid=String(data.activeSessionId||'').trim();
  if(!sid)return false;
  const hb=String(data.activeSessionHeartbeat||data.activeSessionAt||'').trim();
  if(!hb)return false;
  const t=Date.parse(hb);
  if(!t||isNaN(t))return false;
  return (Date.now()-t)<SESSION_STALE_MS;
}
async function leerSesionFirestore(email){
  const ref=sessionDocRef(email);
  if(!ref||!window._fsGetDoc)return null;
  try{
    const snap=await window._fsGetDoc(ref);
    return snap.exists()?snap.data():null;
  }catch(err){
    console.warn('leerSesionFirestore:',err);
    return null;
  }
}
async function verificarSesionDisponible(email){
  email=String(email||'').trim().toLowerCase();
  if(!email)return{ok:true};
  const data=await leerSesionFirestore(email);
  if(sesionRemotaEstaViva(data)){
    return{ok:false,msg:'❌ Ya tiene una sesión abierta en otro dispositivo, navegador o pestaña.\n\nCierre sesión allí antes de ingresar aquí.'};
  }
  return{ok:true};
}
// Desplaza cualquier sesión anterior (modelo WhatsApp Web):
// el nuevo login siempre toma el control; la sesión anterior recibe el cambio
// por su listener de Firestore y se cierra automáticamente.
async function claimActiveSession(email){
  email=String(email||'').trim().toLowerCase();
  const ref=sessionDocRef(email);
  if(!email||!ref||!window._fsSetDoc)return null;
  const existing=await leerSesionFirestore(email);
  const localSid=String(sessionStorage.getItem('sst_session_id')||'').trim();
  // Si la sesión existente es esta misma pestaña/dispositivo, renovar heartbeat
  if(sesionRemotaEstaViva(existing)){
    const remoteSid=String(existing.activeSessionId||'').trim();
    if(localSid&&localSid===remoteSid){
      _sessionId=localSid;
      try{await window._fsSetDoc(ref,{activeSessionHeartbeat:new Date().toISOString()},{merge:true});}catch(e){}
      return localSid;
    }
    // Hay otra sesión activa: la desplazamos escribiendo un nuevo ID
    // (la sesión anterior lo detectará en su listener y se cerrará)
    console.log('claimActiveSession: desplazando sesión anterior de',email);
  }
  const sid=generateSessionId();
  const now=new Date().toISOString();
  const payload={
    activeSessionId:sid,
    activeSessionAt:now,
    activeSessionHeartbeat:now,
    activeSessionUserAgent:String(navigator.userAgent||'').slice(0,200),
    email:email
  };
  try{
    await window._fsSetDoc(ref,payload,{merge:true});
    _sessionId=sid;
    try{sessionStorage.setItem('sst_session_id',sid);}catch(e){}
    return sid;
  }catch(err){
    if(err&&err.code==='permission-denied')return'RULES';
    console.warn('claimActiveSession:',err);
    return null;
  }
}
async function releaseActiveSession(email,opts){
  opts=opts||{};
  email=String(email||'').trim().toLowerCase();
  const ref=sessionDocRef(email);
  const sid=String(_sessionId||sessionStorage.getItem('sst_session_id')||'').trim();
  if(!email||!ref||!window._fsSetDoc)return;
  try{
    if(sid){
      const data=await leerSesionFirestore(email);
      const remote=String(data&&data.activeSessionId||'').trim();
      if(remote&&remote!==sid&&!opts.force)return;
    }
    await window._fsSetDoc(ref,{
      activeSessionId:'',
      activeSessionAt:new Date().toISOString(),
      activeSessionHeartbeat:new Date().toISOString()
    },{merge:true});
  }catch(err){console.warn('releaseActiveSession:',err);}
  _sessionId=null;
  try{sessionStorage.removeItem('sst_session_id');}catch(e){}
  stopLocalStorageSessionGuard();
}
function installSessionPageLifecycle(){
  if(window._sessionLifecycleInstalled)return;
  window._sessionLifecycleInstalled=true;
  const liberarAlSalir=function(){
    if(!document.body.classList.contains('sesion-activa'))return;
    const email=window._usuarioActual&&window._usuarioActual.email;
    if(!email)return;
    stopSessionGuard();
    void releaseActiveSession(email,{force:true});
  };
  window.addEventListener('pagehide',liberarAlSalir);
}
// ── Guard basado en localStorage (respaldo cuando Firestore sesiones/ no tiene permisos) ──
// Funciona entre pestañas del mismo navegador; entre dispositivos distintos el guard
// de Firestore ya es el responsable.
const SST_LS_SESSION_KEY='sst_active_session_ls';
let _lsSessionGuardListener=null;
function claimLocalStorageSession(sid){
  try{
    const entry=JSON.stringify({sid:sid,at:Date.now(),email:(window._usuarioActual&&window._usuarioActual.email)||''});
    localStorage.setItem(SST_LS_SESSION_KEY,entry);
  }catch(e){}
}
function startLocalStorageSessionGuard(sid){
  if(_lsSessionGuardListener)return;
  claimLocalStorageSession(sid);
  _lsSessionGuardListener=function(ev){
    if(ev.key!==SST_LS_SESSION_KEY)return;
    if(!document.body.classList.contains('sesion-activa')||!_sessionId)return;
    try{
      const data=JSON.parse(ev.newValue||'{}');
      if(data.sid&&data.sid!==sid){
        // Otra pestaña/ventana tomó la sesión
        cerrarSesionPorConflicto();
      }
    }catch(e){}
  };
  window.addEventListener('storage',_lsSessionGuardListener);
}
function stopLocalStorageSessionGuard(){
  if(_lsSessionGuardListener){
    window.removeEventListener('storage',_lsSessionGuardListener);
    _lsSessionGuardListener=null;
  }
  try{localStorage.removeItem(SST_LS_SESSION_KEY);}catch(e){}
}
function stopSessionGuard(){
  if(_sessionUnsub){try{_sessionUnsub();}catch(e){}_sessionUnsub=null;}
  if(_sessionHeartbeatTimer){clearInterval(_sessionHeartbeatTimer);_sessionHeartbeatTimer=null;}
  stopLocalStorageSessionGuard();
}
function cerrarSesionPorConflicto(){
  stopSessionGuard();
  _sessionId=null;
  notif('Su sesión finalizó porque se cerró o se abrió en otro lugar.','err');
  if(window._authSignOut)window._authSignOut().catch(()=>{});
  window._usuarioActual=null;
  authUsuario=null;
  salirDeSesionApp();
  initLoginScreen();
  updateHeaderUsuario();
}
function startSessionGuard(email){
  stopSessionGuard();
  email=String(email||'').trim().toLowerCase();
  const ref=sessionDocRef(email);
  if(!email||!_sessionId||!ref||!window._fsOnSnapshot)return;
  _sessionUnsub=window._fsOnSnapshot(ref,function(snap){
    if(!document.body.classList.contains('sesion-activa')||!_sessionId)return;
    const data=snap.exists()?snap.data():{};
    const remoteSid=String(data.activeSessionId||'').trim();
    if(!remoteSid||remoteSid===_sessionId)return;
    if(sesionRemotaEstaViva(data))cerrarSesionPorConflicto();
  },function(err){console.warn('Error escuchando sesión:',err);});
  let _hbTick=0;
  _sessionHeartbeatTimer=setInterval(function(){
    if(!document.body.classList.contains('sesion-activa')||!_sessionId||!email)return;
    const hbRef=sessionDocRef(email);
    if(!hbRef||!window._fsSetDoc)return;
    // Cada 3 latidos (~75 s) verificamos que el sessionId sigue siendo el nuestro
    _hbTick++;
    if(_hbTick%3===0&&window._fsGetDoc){
      window._fsGetDoc(hbRef).then(function(snap){
        if(!document.body.classList.contains('sesion-activa')||!_sessionId)return;
        const d=snap.exists()?snap.data():{};
        const remote=String(d.activeSessionId||'').trim();
        if(remote&&remote!==_sessionId&&sesionRemotaEstaViva(d)){
          cerrarSesionPorConflicto();
        }
      }).catch(function(){});
    }
    window._fsSetDoc(hbRef,{
      activeSessionHeartbeat:new Date().toISOString()
    },{merge:true}).catch(function(){});
  },SESSION_HEARTBEAT_MS);
}
function setLoginAuthMsg(msg,err){
  const el=document.getElementById('login-auth-msg');
  if(!el)return;
  el.textContent=msg||'';
  el.classList.toggle('err',!!err);
}
function setLoginStatus(msg,show){
  const el=document.getElementById('login-status');
  const panel=document.getElementById('login-auth-panel');
  if(!el)return;
  if(show&&msg){
    el.textContent=msg;
    el.style.display='block';
    if(panel)panel.style.display='none';
  }else{
    el.style.display='none';
    el.textContent='';
    if(panel&&(!document.body.classList.contains('sesion-activa')))panel.style.display='';
  }
}
function initLoginScreen(){
  const authPanel=document.getElementById('login-auth-panel');
  const rolesWrap=document.getElementById('login-roles-wrap');
  const sub=document.getElementById('login-sub');
  if(authPanel)authPanel.style.display='';
  if(rolesWrap)rolesWrap.style.display='none';
  if(sub)sub.textContent='Personal autorizado: ingrese con su cuenta Google.';
  setLoginAuthMsg('');
  setLoginStatus('');
}
function updateHeaderUsuario(){
  const bar=document.getElementById('hdr-user-bar');
  const lbl=document.getElementById('hdr-user-label');
  const barMob=document.getElementById('hdr-user-bar-mobile');
  const lblMob=document.getElementById('hdr-user-label-mobile');
  if(!lbl)return;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano()){
    if(bar)bar.style.display='none';
    if(barMob)barMob.style.display='none';
    lbl.textContent='';
    if(lblMob)lblMob.textContent='';
    return;
  }
  if(!document.body.classList.contains('sesion-activa')||!window._usuarioActual){
    if(bar)bar.style.display='none';
    if(barMob)barMob.style.display='none';
    lbl.textContent='';
    if(lblMob)lblMob.textContent='';
    return;
  }
  const u=window._usuarioActual;
  const rolInfo=ROLES_INGRESO.find(r=>r.id===rolSesion);
  const rolTit=rolInfo?rolInfo.titulo:tituloRolFirestore(rolSesion||u.rol);
  const html='<strong>'+escAttr(u.nombre||u.email)+'</strong> · '+escAttr(rolTit);
  lbl.innerHTML=html;
  if(lblMob)lblMob.innerHTML=html;
  if(bar)bar.style.display='inline-flex';
  if(barMob)barMob.style.display='flex';
}
function alertUsuarioDesactivado(opts){
  opts=opts||{};
  const email=String(opts.email||'').trim();
  const msg='Su usuario está desactivado y no puede ingresar al sistema. Contacte al administrador para solicitar la reactivación de su cuenta.';
  const detail=email?('Cuenta: '+email):'';
  if(typeof confirmPrecaucion==='function'){
    confirmPrecaucion({
      title:'Usuario desactivado',
      message:msg,
      detail:detail,
      confirmLabel:'Entendido',
      hideCancel:true,
      tone:'warn'
    },function(){});
  }else{
    try{window.alert(msg+(detail?'\n'+detail:''));}catch(e){}
  }
}
async function verificarUsuarioFirestore(fbUser){
  const email=String(fbUser&&fbUser.email||'').trim().toLowerCase();
  const uid=fbUser&&fbUser.uid||'';
  if(!email){
    setLoginStatus('');
    setLoginAuthMsg('No se obtuvo correo de Google.','err');
    if(window._authSignOut)await window._authSignOut().catch(()=>{});
    return;
  }
  setLoginStatus('⏳ Verificando acceso…',true);
  const db=window._db;
  if(!db||!window._fsGetDoc||!window._fsDoc){
    setLoginStatus('');
    setLoginAuthMsg('Firestore no disponible.','err');
    if(window._authSignOut)await window._authSignOut().catch(()=>{});
    return;
  }
  try{
    const snap=await window._fsGetDoc(window._fsDoc(db,'usuarios',email));
    if(!snap.exists()){
      setLoginStatus('');
      setLoginAuthMsg('❌ Acceso denegado. Su correo no está autorizado. Contacte al administrador.','err');
      if(window._authSignOut)await window._authSignOut().catch(()=>{});
      return;
    }
    const data=snap.data()||{};
    if(data.activo===false){
      setLoginStatus('');
      setLoginAuthMsg('❌ Acceso denegado. Su cuenta está desactivada. Contacte al administrador.','err');
      alertUsuarioDesactivado({email:email});
      if(window._authSignOut)await window._authSignOut().catch(()=>{});
      return;
    }
    window._usuarioActual={email,nombre:data.nombre||email,rol:normalizarRolLoginFirestore(data.rol||''),codigo:data.codigo||'',cargo:String(data.cargo||'').trim().toLowerCase(),uid,rolOriginal:data.rol||'',deptoResponsable:String(data.deptoResponsable||'').trim()};
    if(typeof mergeUsuarioEnCache==='function'){
      mergeUsuarioEnCache({email,nombre:data.nombre||email,rol:data.rol||'',codigo:data.codigo||'',cargo:data.cargo||'',activo:data.activo!==false,deptoResponsable:data.deptoResponsable||''});
    }
    authUsuario=fbUser;
    setLoginStatus('');
    setLoginAuthMsg('');
    const acceso=resolverAccesoLoginUsuario(data,email);
    if(!acceso.ok){
      window._usuarioActual=null;
      setLoginAuthMsg(acceso.msg,'err');
      if(window._authSignOut)await window._authSignOut().catch(()=>{});
      return;
    }
    const sesion=await claimActiveSession(email);
    if(sesion==='RULES'||!sesion){
      console.warn('Sesión en Firestore no disponible; ingreso sin bloqueo remoto.');
      _sessionId='local_'+generateSessionId();
      try{sessionStorage.setItem('sst_session_id',_sessionId);}catch(e){}
    }
    const authPanel=document.getElementById('login-auth-panel');
    const rolesWrap=document.getElementById('login-roles-wrap');
    if(authPanel)authPanel.style.display='none';
    if(rolesWrap)rolesWrap.style.display='none';
    // No pisar consulta ciudadana abierta por deep-link del correo
    if(document.body.classList.contains('sesion-activa')&&typeof esModoCiudadano==='function'&&esModoCiudadano())return;
    ingresarComoRol(acceso.rol,acceso.respNom);
  }catch(err){
    console.error('Error verificando usuario:',err);
    setLoginStatus('');
    setLoginAuthMsg('Error al verificar acceso. Intente de nuevo.','err');
    if(window._authSignOut)await window._authSignOut().catch(()=>{});
  }
}
async function iniciarLoginGoogle(){
  if(!window._authSignInGoogle){
    setLoginAuthMsg('Autenticación Google no disponible.','err');
    return;
  }
  setLoginAuthMsg('');
  setLoginStatus('⏳ Verificando acceso…',true);
  try{
    const cred=await window._authSignInGoogle();
    await verificarUsuarioFirestore(cred.user);
  }catch(err){
    console.error(err);
    setLoginStatus('');
    const code=err&&err.code;
    if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request'){
      setLoginAuthMsg('Inicio de sesión cancelado.','err');
    }else{
      setLoginAuthMsg('Error al iniciar sesión con Google.','err');
    }
  }
}
function initFirebaseAuthListener(){
  if(!window._authOnStateChanged||!window._firebaseAuth)return;
  window._authOnStateChanged(window._firebaseAuth,user=>{
    if(document.body.classList.contains('sesion-activa'))return;
    // Prioridad al deep-link de consulta ciudadana (?consulta=…)
    if(typeof leerConsultaCiudadanaDesdeUrl==='function'&&leerConsultaCiudadanaDesdeUrl())return;
    if(user&&!window._usuarioActual&&!window._authVerifying){
      window._authVerifying=true;
      verificarUsuarioFirestore(user).finally(()=>{window._authVerifying=false;});
    }
    if(!user){
      window._usuarioActual=null;
      authUsuario=null;
      if(!document.body.classList.contains('sesion-activa'))initLoginScreen();
    }
  });
}
function ingresarConsultaCiudadana(){
  ingresarComoRol('ciudadano');
}
/** Lee ?consulta= / ?exp= / #consulta= del URL para prellenar consulta ciudadana. */
function leerConsultaCiudadanaDesdeUrl(){
  try{
    const params=new URLSearchParams(window.location.search||'');
    let num=String(params.get('consulta')||params.get('exp')||params.get('pqrsd')||'').trim();
    if(!num&&window.location.hash){
      const h=String(window.location.hash||'').replace(/^#/,'');
      const hp=new URLSearchParams(h.indexOf('=')>=0?h:'');
      num=String(hp.get('consulta')||hp.get('exp')||'').trim();
      if(!num&&/^[\w\-./]+$/.test(h)&&!h.includes('='))num=h.trim();
    }
    return num;
  }catch(e){return'';}
}
function aplicarConsultaCiudadanaDesdeUrl(opts){
  opts=opts||{};
  const num=leerConsultaCiudadanaDesdeUrl();
  if(!num)return false;
  window._ciudadanoUltExp=num;
  const inp=document.getElementById('ciudadano-exp');
  if(inp)inp.value=num;
  if(opts.buscar!==false&&typeof buscarExpCiudadano==='function'){
    setTimeout(function(){buscarExpCiudadano();},80);
  }
  return true;
}
function mostrarSelectorRolesAdmin(nombre){
  if(!window._usuarioActual||window._usuarioActual.rol!=='admin'){
    if(window._usuarioActual&&window._usuarioActual.rol){
      const u=window._usuarioActual;
      const respNom=u&&u.rol==='responsables'?getResponsableLoginNombre():'';
      ingresarComoRol(normalizarRolLoginFirestore(u.rol),respNom);
    }
    return;
  }
  const authPanel=document.getElementById('login-auth-panel');
  const rolesWrap=document.getElementById('login-roles-wrap');
  const sub=document.getElementById('login-sub');
  if(authPanel)authPanel.style.display='none';
  if(rolesWrap)rolesWrap.style.display='';
  if(sub)sub.textContent='Seleccione el módulo con el que desea trabajar:';
  setLoginAuthMsg('');
  setLoginStatus('');
  renderLoginRolesGrid();
}
function renderLoginRolesGrid(){
  const el=document.getElementById('login-roles-grid');
  if(!el)return;
  el.innerHTML=ROLES_INGRESO.map(r=>'<button type="button" class="login-rol-card '+r.cls+'" onclick="ingresarComoRol(\''+escAttr(r.id)+'\')"><span class="login-rol-icon">'+r.icon+'</span><span class="login-rol-tit">'+escAttr(r.titulo)+'</span><span class="login-rol-desc">'+escAttr(r.desc)+'</span></button>').join('');
}
function rutaInicialPorRol(rolId){
  if(rolId==='ciudadano')return'ciudadano';
  if(rolId==='secretaria')return'sec';
  if(rolId==='responsables')return'act';
  if(rolId==='jurisdiccional')return'con';
  if(OFICINAS_DEGUV.some(o=>o.id===rolId&&o.id!=='guaviare'&&o.id!=='secretaria'))return'pqrs-ofi';
  if(rolId==='admin'||DEPTOS.some(d=>d.id===rolId))return'reg';
  return'con';
}
function ingresarComoRol(rolId,respNombre){
  rolId=String(rolId||'').trim();
  if(!rolId)return;
  const u=window._usuarioActual;
  if(u&&u.rol&&u.rol!=='admin'){
    const rolAsignado=normalizarRolLoginFirestore(u.rol);
    const rolIntento=normalizarRolLoginFirestore(rolId);
    if(rolIntento!==rolAsignado){
      const rn=rolAsignado==='responsables'?getResponsableLoginNombre():'';
      ingresarComoRol(rolAsignado,rn);
      return;
    }
  }
  rolSesion=rolId;
  try{sessionStorage.setItem('sst_rol_sesion',rolId);}catch(e){}
  if(rolId==='contratista'){
    deptoActivo='guaviare';
    deptoCfg=deptoCfg||'guaviare';
  }else{
    deptoActivo=rolId==='admin'?'guaviare':rolId;
  }
  responsableActivo=respNombre?String(respNombre).trim():'';
  if(esResponsableIdentidadFija())fijarResponsableSesion();
  editId=null;
  const sel=document.getElementById('sel-depto');
  if(sel){
    if(rolId==='admin'){sel.value='admin';deptoActivo='guaviare';try{localStorage.setItem('sst_sel_modulo','admin');}catch(e){}}
    else sel.value=deptoActivo;
    sel.style.display=rolId==='admin'?'':'none';
  }
  if(rolId!=='jurisdiccional'&&rolId!=='responsables'&&rolId!=='secretaria'&&rolId!=='ciudadano'&&rolId!=='contratista'&&!esModuloOficina(rolId)){
    setCfgPtr(deptoActivo);
  }else{
    setCfgPtr('guaviare');
  }
  document.body.classList.add('sesion-activa');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  const loginRoles=document.getElementById('login-roles-wrap');
  const loginAuth=document.getElementById('login-auth-panel');
  if(loginRoles)loginRoles.style.display='none';
  if(loginAuth)loginAuth.style.display='none';
  setLoginStatus('');
  updateDeptoUI();
  poblarTramSelect();
  initPeriodoFiltros('q');
  initPeriodoFiltros('cons');
  initPeriodoFiltros('act');
  initPeriodoFiltros('pqrs-ofi');
  renderChatBadge();
  installSessionPageLifecycle();
  initAppRealtimeSync();
  // Releer expedientes YA autenticado. Admin→Secretaría ya trae exps en memoria;
  // la cuenta Secretaría real depende de esta recarga (+ reintentos).
  if(typeof reloadExpedientesTrasLogin==='function'){
    reloadExpedientesTrasLogin().then(function(ok){
      if(typeof aplicarSugerenciaNumeroPqrsSec==='function'&&esSecretaria()){
        try{aplicarSugerenciaNumeroPqrsSec();}catch(e){}
      }
      // Segundo pase por si el primer getDocs corrió con token aún frío
      if(!ok||!(typeof exps!=='undefined'&&exps&&exps.length)){
        setTimeout(function(){
          reloadExpedientesTrasLogin().then(function(){
            if(typeof aplicarSugerenciaNumeroPqrsSec==='function'&&esSecretaria()){
              try{aplicarSugerenciaNumeroPqrsSec();}catch(e){}
            }
          }).catch(function(){});
        },1200);
      }
    }).catch(function(e){console.warn('reloadExpedientesTrasLogin:',e);});
  }
  if(typeof syncPendingExpedientesToFirestore==='function'){
    syncPendingExpedientesToFirestore().catch(function(e){console.warn('syncPending al ingresar:',e);});
  }
  // Reintentar actividades sin expediente que quedaron solo en local (p. ej. rules antiguas)
  if(typeof syncPendingActividadesLibresToFirestore==='function'){
    setTimeout(function(){
      syncPendingActividadesLibresToFirestore().catch(function(e){console.warn('syncActLibres al ingresar:',e);});
    },1200);
  }
  if(window._usuarioActual&&window._usuarioActual.email&&_sessionId){
    if(!String(_sessionId).startsWith('local_')){
      startSessionGuard(window._usuarioActual.email);
    }
    // Guard localStorage: activo siempre (protege multi-pestaña en el mismo navegador)
    startLocalStorageSessionGuard(_sessionId);
  }
  if(typeof sstInitDesktopNotify==='function')sstInitDesktopNotify();
  if(typeof initChatNotifySync==='function'){
    window._bandejaNotifySeeded=false;
    window._bandejaUnreadKeysPrev=[];
    scheduleChatNotifySync();
  }
  if(responsableActivo){
    try{localStorage.setItem('sst_responsable',responsableActivo);}catch(e){}
    const selR=document.getElementById('sel-responsable');
    if(selR)selR.value=responsableActivo;
  }
  showTab(rutaInicialPorRol(rolId));
  if(rolId==='ciudadano')aplicarConsultaCiudadanaDesdeUrl({buscar:true});
  iniciarRefrescoBloqueosUI();
  const rolInfo=ROLES_INGRESO.find(r=>r.id===rolId);
  logAudit('Inició sesión con rol '+(rolInfo?rolInfo.titulo:rolId),'configuracion',null);
  updateHeaderUsuario();
  if(typeof sstIniciarGmailObligatorio==='function')sstIniciarGmailObligatorio();
  setTimeout(()=>maybeShowExportReminder(),800);
  startIdleSessionWatch();
}
/** 1 hora sin actividad (mouse/teclado/toque) → cierre forzado de sesión. */
const SST_IDLE_MS=60*60*1000;
const SST_IDLE_CHECK_MS=30000;
let _idleTimer=null;
let _idleLastActivity=0;
function _idleBumpActivity(){_idleLastActivity=Date.now();}
function stopIdleSessionWatch(){
  if(_idleTimer){clearInterval(_idleTimer);_idleTimer=null;}
  ['mousemove','mousedown','keydown','touchstart','scroll','click','wheel'].forEach(function(ev){
    window.removeEventListener(ev,_idleBumpActivity,true);
  });
}
function startIdleSessionWatch(){
  stopIdleSessionWatch();
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return;
  _idleLastActivity=Date.now();
  ['mousemove','mousedown','keydown','touchstart','scroll','click','wheel'].forEach(function(ev){
    window.addEventListener(ev,_idleBumpActivity,{capture:true,passive:true});
  });
  _idleTimer=setInterval(function(){
    if(!document.body.classList.contains('sesion-activa')){stopIdleSessionWatch();return;}
    if(Date.now()-_idleLastActivity<SST_IDLE_MS)return;
    stopIdleSessionWatch();
    if(typeof notif==='function')notif('Sesión cerrada por inactividad (1 hora). Vuelva a iniciar sesión.','err');
    try{cerrarSesionGoogle();}catch(e){try{salirDeSesionApp();}catch(x){}}
  },SST_IDLE_CHECK_MS);
}
window.startIdleSessionWatch=startIdleSessionWatch;
window.stopIdleSessionWatch=stopIdleSessionWatch;
function salirDeSesionApp(){
  stopIdleSessionWatch();
  const email=window._usuarioActual&&window._usuarioActual.email;
  rolSesion=null;
  deptoActivo='guaviare';
  responsableActivo='';
  editId=null;
  try{sessionStorage.removeItem('sst_rol_sesion');}catch(e){}
  stopSessionGuard();
  if(typeof stopAllRealtimeSync==='function')stopAllRealtimeSync();
  if(email)void releaseActiveSession(email);
  document.body.classList.remove('sesion-activa');
  if(typeof stopChatNotifySync==='function')stopChatNotifySync();
  if(typeof stopChatActiveSync==='function')stopChatActiveSync();
  window._bandejaNotifySeeded=false;
  window._bandejaUnreadKeysPrev=[];
  cerrarConsultaPanel();
  closeTaskModal();
  closeBandejaDepto();
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  const login=document.getElementById('pg-login');
  if(login)login.classList.add('on');
}
function volverSelectorRolesAdmin(){
  if(!esAdminFirestore())return;
  salirDeSesionApp();
  mostrarSelectorRolesAdmin();
  updateHeaderUsuario();
}
function volverPantallaPrincipal(){
  cerrarSesionGoogle();
}
function cerrarSesionGoogle(){
  if(window._authSignOut)window._authSignOut().catch(()=>{});
  window._usuarioActual=null;
  authUsuario=null;
  salirDeSesionApp();
  initLoginScreen();
  updateHeaderUsuario();
}

initPqrsUiDelegation();
initSstUiDelegation();
ensureOverlaysClosed();
installSessionPageLifecycle();
// Deep-link desde correo de radicación: ?consulta=NUM → entra directo a consulta ciudadana
(function bootConsultaCiudadanaDeepLink(){
  try{
    if(typeof leerConsultaCiudadanaDesdeUrl!=='function')return;
    const num=leerConsultaCiudadanaDesdeUrl();
    if(!num)return;
    if(document.body.classList.contains('sesion-activa')){
      if(typeof esModoCiudadano==='function'&&esModoCiudadano())aplicarConsultaCiudadanaDesdeUrl({buscar:true});
      return;
    }
    ingresarComoRol('ciudadano');
  }catch(e){console.warn('bootConsultaCiudadanaDeepLink:',e);}
})();
