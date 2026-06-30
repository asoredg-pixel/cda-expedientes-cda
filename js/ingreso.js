// =============================================================================
// ingreso.js — INGRESO POR ROLES
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// INGRESO POR ROLES
// ================================================================
// ROLES_INGRESO → js/constants.js
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
      if(window._authSignOut)await window._authSignOut().catch(()=>{});
      return;
    }
    window._usuarioActual={email,nombre:data.nombre||email,rol:normalizarRolLoginFirestore(data.rol||''),codigo:data.codigo||'',uid,rolOriginal:data.rol||''};
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
    const authPanel=document.getElementById('login-auth-panel');
    const rolesWrap=document.getElementById('login-roles-wrap');
    if(authPanel)authPanel.style.display='none';
    if(rolesWrap)rolesWrap.style.display='none';
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
  const statusEl=document.getElementById('login-status');
  if(authPanel)authPanel.style.display='none';
  if(rolesWrap)rolesWrap.style.display='';
  if(statusEl)statusEl.style.display='none';
  if(sub)sub.textContent='Bienvenido '+ (nombre||window._usuarioActual.nombre||window._usuarioActual.email) + '. Seleccione rol para ingresar (administrador).';
  renderLoginRoles();
}
function renderLoginRoles(){
  if(!window._usuarioActual||window._usuarioActual.rol!=='admin'){
    if(window._usuarioActual&&window._usuarioActual.rol){
      const u=window._usuarioActual;
      const respNom=u&&u.rol==='responsables'?getResponsableLoginNombre():'';
      ingresarComoRol(normalizarRolLoginFirestore(u.rol),respNom);
    }
    return;
  }
  const el=document.getElementById('login-roles-grid');
  if(!el)return;
  el.innerHTML=ROLES_INGRESO.map(r=>'<button type="button" class="login-rol-card '+r.cls+'" onclick="ingresarComoRol(\''+escAttr(r.id)+'\')"><span class="login-rol-icon">'+r.icon+'</span><span class="login-rol-tit">'+escAttr(r.titulo)+'</span><span class="login-rol-desc">'+escAttr(r.desc)+'</span></button>').join('');
}
function rutaInicialPorRol(rolId){
  if(rolId==='secretaria')return'sec';
  if(rolId==='ciudadano')return'ciudadano';
  if(rolId==='contratista')return'reg';
  if(rolId==='jurisdiccional')return'con';
  if(rolId==='responsables')return responsableActivo?'act':'con';
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
  initRealtimeSync();
  if(typeof sstInitDesktopNotify==='function')sstInitDesktopNotify();
  if(typeof initChatNotifySync==='function'){
    window._bandejaNotifySeeded=false;
    window._bandejaUnreadKeysPrev=[];
    window._chatManualUnread=new Set();
    scheduleChatNotifySync();
  }
  if(responsableActivo){
    try{localStorage.setItem('sst_responsable',responsableActivo);}catch(e){}
    const selR=document.getElementById('sel-responsable');
    if(selR)selR.value=responsableActivo;
  }
  showTab(rutaInicialPorRol(rolId));
  iniciarRefrescoBloqueosUI();
  const rolInfo=ROLES_INGRESO.find(r=>r.id===rolId);
  logAudit('Inició sesión con rol '+(rolInfo?rolInfo.titulo:rolId),'configuracion',null);
  updateHeaderUsuario();
  setTimeout(()=>maybeShowExportReminder(),800);
}
function salirDeSesionApp(){
  rolSesion=null;
  deptoActivo='guaviare';
  responsableActivo='';
  editId=null;
  try{sessionStorage.removeItem('sst_rol_sesion');}catch(e){}
  document.body.classList.remove('sesion-activa');
  if(typeof stopChatNotifySync==='function')stopChatNotifySync();
  if(typeof stopChatActiveSync==='function')stopChatActiveSync();
  window._bandejaNotifySeeded=false;
  window._bandejaUnreadKeysPrev=[];
  window._chatManualUnread=new Set();
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
// Namespace público — funciones llamadas desde onclick en el HTML