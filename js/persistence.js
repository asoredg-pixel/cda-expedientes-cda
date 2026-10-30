// =============================================================================
// persistence.js — Capa de persistencia SST: LocalStorage + Firestore
// Funciones de lectura/escritura sin dependencias de UI de negocio en tiempo
// de definición. Las dependencias de runtime (syncCfgToStore, normalizePersona,
// etc.) se resuelven desde el scope global cuando las funciones son llamadas.
// Cargar después de state.js y antes del script principal.
// =============================================================================
function lsParseStoredJson(raw){
  if(raw==null||raw==='')return null;
  let json=raw;
  if(typeof raw==='string'&&raw.startsWith(LS_COMPRESS_PREFIX)){
    if(typeof LZString==='undefined'||!LZString.decompress)throw new Error('LZString no disponible');
    json=LZString.decompress(raw.slice(LS_COMPRESS_PREFIX.length));
    if(json==null||json==='')throw new Error('Error al descomprimir datos');
  }
  return JSON.parse(json);
}
function lsLoadJson(key){
  const raw=localStorage.getItem(key);
  if(raw==null)return null;
  return lsParseStoredJson(raw);
}
function lsStoreJson(key,data){
  const json=JSON.stringify(data);
  let stored=json;
  if(typeof LZString!=='undefined'&&LZString.compress){
    const compressed=LZString.compress(json);
    if(compressed!=null&&compressed!=='')stored=LS_COMPRESS_PREFIX+compressed;
  }
  const st=window._lsCompressionStats||(window._lsCompressionStats={jsonChars:0,storedChars:0,compressed:false});
  st.jsonChars+=json.length;
  st.storedChars+=stored.length;
  st.compressed=st.compressed||stored.startsWith(LS_COMPRESS_PREFIX);
  localStorage.setItem(key,stored);
}
function lsStorageKb(bytes){return Math.round(bytes/1024);}
function lsCapacityMonitorMsg(){
  const usedKb=lsStorageKb(getLocalStorageUsageBytes());
  const limitMb=Math.round(LS_CAPACITY_LIMIT_BYTES/(1024*1024));
  let msg='Usando '+usedKb+' KB de ~'+limitMb+'MB (comprimido).';
  const st=window._lsCompressionStats;
  if(st&&st.jsonChars>0&&st.compressed&&st.storedChars<st.jsonChars){
    const reduction=Math.round((1-st.storedChars/st.jsonChars)*100);
    if(reduction>0)msg+=' Compresión activa: reducción del '+reduction+'%.';
  }
  return msg;
}
// isQuotaExceededError, showStorageFullBanner, cerrarStorageFullBanner → js/utils.js
function getLocalStorageUsageBytes(){
  let total=0;
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    const v=localStorage.getItem(k)||'';
    total+=(k.length+v.length)*2;
  }
  return total;
}
function getLocalStorageUsagePct(){
  return Math.min(100,Math.round(getLocalStorageUsageBytes()/LS_CAPACITY_LIMIT_BYTES*100));
}
function showStorageCapacityToast(msg,tone){
  let el=document.getElementById('storage-cap-toast');
  if(!el){
    el=document.createElement('div');
    el.id='storage-cap-toast';
    document.body.appendChild(el);
  }
  el.className='storage-cap-toast '+(tone==='crit'?'crit':'warn');
  el.textContent=msg;
  el.style.display='block';
  clearTimeout(window._storageCapToastTimer);
  window._storageCapToastTimer=setTimeout(()=>{el.style.display='none';},8000);
}
function checkLocalStorageCapacityAfterSave(){
  // LS solo guarda cfg/sesión/personas (expedientes están en Firestore). Alertas solo si cache auxiliar supera límite.
  const pct=getLocalStorageUsagePct();
  const base=lsCapacityMonitorMsg();
  if(pct>=90)showStorageCapacityToast(base+' Caché local llena — los datos principales están seguros en Firebase.','crit');
  else if(pct>=70)showStorageCapacityToast(base+' Caché local alta — datos seguros en Firebase.','warn');
}
function ensurePrimerUsoDate(){
  try{
    if(!localStorage.getItem(SST_PRIMER_USO_KEY))
      localStorage.setItem(SST_PRIMER_USO_KEY,new Date().toISOString().slice(0,10));
  }catch(e){}
}
function markExportRealizado(){
  try{localStorage.setItem(SST_LAST_EXPORT_KEY,new Date().toISOString().slice(0,10));}catch(e){}
}
function diasSinExportar(){
  try{
    let raw=localStorage.getItem(SST_LAST_EXPORT_KEY);
    if(!raw)raw=localStorage.getItem(SST_PRIMER_USO_KEY);
    if(!raw)return 0;
    const base=new Date(raw+'T12:00:00');
    if(isNaN(base.getTime()))return 0;
    return Math.floor((Date.now()-base.getTime())/86400000);
  }catch(e){return 0;}
}
function closeExportReminderModal(){
  const ov=document.getElementById('export-reminder-overlay');
  if(ov)ov.classList.remove('on');
}
function recordarDespuesExport(){
  try{sessionStorage.setItem('sst_export_remind_dismissed','1');}catch(e){}
  closeExportReminderModal();
}
function exportarAhoraFromReminder(){
  closeExportReminderModal();
  exportarRespaldoCompleto();
}
function maybeShowExportReminder(){
  if(!document.body.classList.contains('sesion-activa'))return;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return;
  if(typeof esAdministrador==='function'&&!esAdministrador())return;
  try{if(sessionStorage.getItem('sst_export_remind_dismissed'))return;}catch(e){}
  const dias=diasSinExportar();
  if(dias<=7)return;
  const msgEl=document.getElementById('export-reminder-msg');
  const ov=document.getElementById('export-reminder-overlay');
  if(!msgEl||!ov)return;
  msgEl.textContent='Han pasado '+dias+' días sin exportar un respaldo portable. Sus datos están seguros en Firebase, pero se recomienda un .json como copia offline. ¿Exportar ahora?';
  ov.classList.add('on');
}
function _saveLSLocal(){
  // Guarda solo cfg/sesión/personas — expedientes y chat viven en Firestore (subcollecciones)
  syncCfgToStore();
  window._lsCompressionStats={jsonChars:0,storedChars:0,compressed:false};
  lsStoreJson('sst_c_by_depto',cfgByDepto);
  localStorage.setItem('sst_depto',deptoActivo);
  localStorage.setItem('sst_depto_cfg',deptoCfg);
  try{
    const pj=JSON.stringify(personas||[]);
    if(pj.length>800000)localStorage.removeItem('sst_p');
    else lsStoreJson('sst_p',personas);
  }catch(e){try{localStorage.removeItem('sst_p');}catch(e2){}}
  localStorage.setItem('sst_responsable',responsableActivo||'');
  lsStoreJson('sst_act_libres',actividadesLibres||[]);
  lsStoreJson('sst_agenda',agendaEventos||[]);
  lsStoreJson('sst_encargados_global',encargadosGlobal||getDefaultEncargadosGlobal());
}
function postLoadInit(){
  if(!Array.isArray(personas))personas=[];
  personas=personas.map(normalizePersonaRecord);
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  deptoActivo=localStorage.getItem('sst_depto')||'guaviare';
  deptoCfg=localStorage.getItem('sst_depto_cfg')||'guaviare';
  responsableActivo=localStorage.getItem('sst_responsable')||'';
  try{
    const rolSes=sessionStorage.getItem('sst_rol_sesion');
    if(rolSes==='admin'){
      const savedMod=localStorage.getItem('sst_sel_modulo')||'admin';
      if(savedMod==='admin')deptoActivo='guaviare';
      else if(DEPTOS.some(d=>d.id===savedMod)||savedMod==='secretaria'||savedMod==='jurisdiccional'||savedMod==='responsables'||savedMod==='ciudadano'||OFICINAS_DEGUV.some(o=>o.id===savedMod))deptoActivo=savedMod;
    }
  }catch(e){}
  try{const al=localStorage.getItem('sst_act_libres');if(al)actividadesLibres=lsParseStoredJson(al);}catch(e){}
  try{const ag=localStorage.getItem('sst_agenda');if(ag)agendaEventos=lsParseStoredJson(ag);}catch(e){}
  try{const ch=localStorage.getItem('sst_chat');if(ch)chatMensajes=lsParseStoredJson(ch);}catch(e){}
  try{const eg=localStorage.getItem('sst_encargados_global');if(eg)encargadosGlobal=normalizeEncargadosGlobal(lsParseStoredJson(eg));}catch(e){}
  if(!Array.isArray(actividadesLibres))actividadesLibres=[];
  if(!Array.isArray(agendaEventos))agendaEventos=[];
  if(!Array.isArray(chatMensajes))chatMensajes=[];
  if(!Array.isArray(exps))exps=[];
  sanitizeAllStoredData();
  limpiarLocksExpirados();
  iniciarRefrescoBloqueosUI();
  purgeRetencionDatosLeidos();
  if(!DEPTOS.some(d=>d.id===deptoCfg))deptoCfg='guaviare';
  if(deptoActivo!=='jurisdiccional'&&deptoActivo!=='responsables')setCfgPtr(deptoActivo);
  else setCfgPtr(deptoCfg);
  const sel=document.getElementById('sel-depto');
  if(sel){
    try{
      if(sessionStorage.getItem('sst_rol_sesion')==='admin'){
        sel.value=localStorage.getItem('sst_sel_modulo')||'admin';
      }else{
        sel.value=deptoActivo;
      }
    }catch(e){sel.value=deptoActivo;}
  }
  exps.forEach(e=>{
    if(!e._depto)e._depto='guaviare';
    migrarDetalleNotas(e);
    if(!e._fechas_estado&&e._fecha){
      const est=isArchivadoEstado(e._estado)?'Archivado o anulado':(e._estado||'Solicitud');
      const o={Solicitud:e._fecha};o[est]=e._fecha;
      if(e._fecha_seg)o.Seguimiento=e._fecha_seg;
      e._fechas_estado=JSON.stringify(o);
    }
    if(!e._conceptos_seg||e._conceptos_seg==='[]')migrarSegLegacy(e);
    const actosM=actosAdminData(e._actos_admin);
    const csM=conceptosSegData(e._conceptos_seg);
    if(actosM.length||csM.some(c=>c.trasladoSan))Object.assign(e,mergeExpedienteFlags(actosM,csM));
    if(!e._actos_admin)e._actos_admin='[]';
    else{
      try{
        const actos=JSON.parse(e._actos_admin);
        if(Array.isArray(actos))e._actos_admin=JSON.stringify(actos.map(a=>cleanActoForStore(migrarActoProrroga(a))));
      }catch(x){}
    }
    syncFechasEstadoConEstado(e);
    e.historial=rebuildHistorial(e,e.historial);
    migrarInfoTecExpediente(e);
    if(Array.isArray(e.tasks))e.tasks=e.tasks.map(t=>{
      const nt=normalizeTask(t);
      if(!nt.actividad&&nt.desc){const p=String(nt.desc).split(' - ');nt.actividad=p[0]||'';nt.detalle=p.slice(1).join(' - ')||'';}
      return nt;
    });
  });
  // Apply encargados from encargadosGlobal → cfgByDepto[deptoId].instructores
  // so getEncargadoDepto() returns the correct name for chat and other consumers.
  if(typeof syncEncargadosGlobalToInstructores==='function')syncEncargadosGlobalToInstructores();
  let cfgPurged=false;
  if(typeof purgeLegacyPlaceholderInstructores==='function'){
    DEPTOS.forEach(function(d){
      if(cfgByDepto[d.id]&&purgeLegacyPlaceholderInstructores(cfgByDepto[d.id]))cfgPurged=true;
    });
  }
  if(cfgPurged&&typeof saveLS==='function')saveLS();
}
function _loadLSLocal(){
  try{
    const e=lsLoadJson('sst_e');if(e)exps=e;
    const p=lsLoadJson('sst_p');if(p)personas=p;
    try{const eg=lsLoadJson('sst_encargados_global');if(eg)encargadosGlobal=normalizeEncargadosGlobal(eg);}catch(x){}
  }catch(e){}
  initCfgByDepto();
  postLoadInit();
}
/** Generación de loadLS: ignora respuestas obsoletas (carrera bootstrap vs login). */
let _loadLSGen=0;

/** Departamentos cuyas expedientes puede listar el usuario autenticado. */
function deptosExpedientesAccesibles(){
  const all=(typeof DEPTOS_FIRESTORE!=='undefined'&&DEPTOS_FIRESTORE.length)?DEPTOS_FIRESTORE.slice():['guaviare'];
  const rol=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  let list;
  if(!rol){
    // Sin usuario aún: intentar todos (fallará por rules si no hay auth)
    list=all;
  }else if(rol==='admin'||rol==='jurisdiccional')list=all;
  else if(rol==='secretaria'||rol==='oap_deguv'||rol==='rn_deguv'||rol==='admin_deguv'||rol==='ds_deguv')list=['guaviare'];
  else if(typeof DEPTOS!=='undefined'&&DEPTOS.some(function(d){return d.id===rol;}))list=[rol];
  else if(rol==='responsables'||rol==='contratista'){
    const dr=String((window._usuarioActual&&window._usuarioActual.deptoResponsable)||'').trim();
    list=(dr&&dr!=='responsables'&&all.indexOf(dr)>=0)?[dr]:['guaviare'];
  }else list=['guaviare'];
  if(typeof DEPTOS_EXPEDIENTES_ACTIVOS==='undefined'||!DEPTOS_EXPEDIENTES_ACTIVOS)return list;
  return list.filter(function(d){return DEPTOS_EXPEDIENTES_ACTIVOS.indexOf(d)>=0;});
}
window.deptosExpedientesAccesibles=deptosExpedientesAccesibles;

function mergeRemoteExpsIntoCache(remote){
  const byId=new Map();
  (Array.isArray(exps)?exps:[]).forEach(function(e){
    const id=String(e&&e._exp||'').trim();
    if(id)byId.set(id,e);
  });
  (Array.isArray(remote)?remote:[]).forEach(function(e){
    const id=String(e&&e._exp||'').trim();
    if(!id)return;
    const local=byId.get(id);
    if(local&&local._pending_fs_sync)return;
    byId.set(id,e);
  });
  exps=Array.from(byId.values());
  return exps.length;
}

async function loadLS(){
  const db=window._db;
  if(!db||!window._fsGetDoc){
    _loadLSLocal();
    updateSyncIndicator('offline');
    return;
  }
  const gen=++_loadLSGen;
  const prevExps=(Array.isArray(exps)&&exps.length)?exps.slice():[];
  updateSyncIndicator('syncing');
  try{
    const globalSnap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
    if(gen!==_loadLSGen)return;
    if(globalSnap.exists()){
      const g=globalSnap.data();
      if(Array.isArray(g.personas))personas=g.personas;
      if(Array.isArray(g.actividadesLibres)){
        const remG=actLibresRemotoCombinado('global',g.actividadesLibres);
        actLibresMarcarEntregasLocalesMasRecientes(remG);
        actividadesLibres=mergeActividadesLibresFromRemote(remG);
      }
      if(Array.isArray(g.agendaEventos))agendaEventos=g.agendaEventos;
      if(typeof depurarAgendaAlmacenada==='function')depurarAgendaAlmacenada();
      // chatMensajes ya no se carga desde sistema/global — usa chats/{convId}/mensajes
      if(g.encargadosGlobal)encargadosGlobal=normalizeEncargadosGlobal(g.encargadosGlobal);
      if(Array.isArray(g.usuariosIndex)&&g.usuariosIndex.length)aplicarUsuariosIndex(g.usuariosIndex);
      if(typeof applyBandejaEstadoFromRemote==='function')applyBandejaEstadoFromRemote(g);
      else{
        if(Array.isArray(g.bandejaLeidos))try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify(g.bandejaLeidos));}catch(x){}
        if(Array.isArray(g.bandejaEliminados))try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify(g.bandejaEliminados));}catch(x){}
      }
      if(Array.isArray(g.recursosEnlaces))recursosEnlaces=normalizeRecursosEnlacesList(g.recursosEnlaces);
      if(Array.isArray(g.bibliotecaRepos))bibliotecaRepos=normalizeBibliotecaReposList(g.bibliotecaRepos);
      if(Array.isArray(g.recursosEnlaces)||Array.isArray(g.bibliotecaRepos))window._recursosHydratedFromRemote=true;
      if(g.recursosConfig&&typeof g.recursosConfig==='object')recursosConfig={...recursosConfig,...g.recursosConfig};
      if(g.mantenimiento&&typeof setMantenimientoEstadoLocal==='function')setMantenimientoEstadoLocal(g.mantenimiento);
      else if(typeof setMantenimientoEstadoLocal==='function')setMantenimientoEstadoLocal({activo:false});
      if(typeof pqrsMatrizApplySheetIdFromGlobal==='function')pqrsMatrizApplySheetIdFromGlobal(g);
      if(typeof pqrsMatrizApplyXlsxFileIdFromGlobal==='function')pqrsMatrizApplyXlsxFileIdFromGlobal(g);
      if(typeof ncaPqrsPinsApplyFromGlobal==='function')ncaPqrsPinsApplyFromGlobal(g);
      if(g.bandejaMarcasListas)window._bandejaMarcasListas=true;
    }
    await cargarPartesSistema();
    await cargarPersonasColeccion();
    const deptosCfg=typeof DEPTOS_FIRESTORE!=='undefined'?DEPTOS_FIRESTORE:['guaviare'];
    const deptosExp=deptosExpedientesAccesibles();
    const [deptoResults,expSnaps]=await Promise.all([
      Promise.allSettled(deptosCfg.map(depto=>window._fsGetDoc(window._fsDoc(db,'departamentos',depto)))),
      Promise.all(deptosExp.map(depto=>loadExpedientesDepto(depto)))
    ]);
    if(gen!==_loadLSGen)return;
    const remote=[];
    expSnaps.forEach(function(deptoExps){if(Array.isArray(deptoExps))deptoExps.forEach(function(e){remote.push(e);});});
    const authOk=!!(window._firebaseAuth&&window._firebaseAuth.currentUser);
    const sesionOn=document.body.classList.contains('sesion-activa');
    // Carrera crítica: un loadLS anónimo/tardío NO debe vaciar exps ya hidratados
    // tras login (el listener realtime no reenvía 'added' → Secretaría queda en cero).
    if(!remote.length&&prevExps.length&&(sesionOn||authOk)){
      console.warn('loadLS: remoto vacío con sesión/datos previos — no se borran',prevExps.length,'expediente(s)');
      exps=prevExps;
    }else{
      exps=remote;
    }
    cfgByDepto={};
    deptoResults.forEach((result,i)=>{
      const depto=deptosCfg[i];
      if(result.status==='fulfilled'&&result.value.exists()){
        const data=result.value.data();
        cfgByDepto[depto]=normalizeCfgObj(data.cfg||{});
        if(Array.isArray(data.actividadesLibres)){
          const remD=actLibresRemotoCombinado('depto:'+depto,data.actividadesLibres);
          actLibresMarcarEntregasLocalesMasRecientes(remD);
          actividadesLibres=typeof upsertActividadesLibresFromRemote==='function'
            ?upsertActividadesLibresFromRemote(remD)
            :mergeActividadesLibresFromRemote(remD);
        }
      }else{
        if(result.status==='rejected')console.warn('Sin acceso al departamento (normal para rol restringido):',depto);
        cfgByDepto[depto]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));
      }
    });
    DEPTOS.forEach(d=>{if(!cfgByDepto[d.id])cfgByDepto[d.id]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));});
    mergePendingExpBackup();
    if(exps&&exps.length){
      clearLegacyExpsLocalStorage();
    }else if(!authOk){
      try{
        const cached=lsLoadJson('sst_e');
        if(Array.isArray(cached)&&cached.length)exps=cached;
      }catch(e){}
    }
    // En sesión activa no resetear deptoActivo/rol desde localStorage (pisa Secretaría).
    if(!sesionOn)postLoadInit();
    else{
      try{sanitizeAllStoredData();}catch(e){}
      try{limpiarLocksExpirados();}catch(e){}
    }
    updateSyncIndicator((exps&&exps.length)?'synced':(authOk?'synced':'offline'));
    if(sesionOn&&typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
    if(sesionOn)syncPendingExpedientesToFirestore().catch(function(e){console.warn('syncPending:',e);});
    if(sesionOn)syncPendingActividadesLibresToFirestore().catch(function(e){console.warn('syncActLibres:',e);});
    if(sesionOn&&typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
    if(sesionOn&&typeof driveOpsProcesarSilencioso==='function')driveOpsProcesarSilencioso();
  }catch(err){
    if(gen!==_loadLSGen)return;
    console.error('Error cargando Firestore:',err);
    if(!(Array.isArray(exps)&&exps.length))_loadLSLocal();
    updateSyncIndicator('error');
  }
}

/**
 * Tras login autenticado: vuelve a leer expedientes (ahora con permisos) y
 * fusiona con la caché local. Evita bandeja/consulta/consecutivo en cero.
 * Reintentos: el token/rules a veces no están listos en el primer intento
 * (cuenta Secretaría vs admin que ya traía datos en memoria).
 */
async function reloadExpedientesTrasLogin(){
  const db=window._db;
  if(!db||!window._fsGetDocs||!window._fsCollection)return false;
  _loadLSGen++; // invalida loadLS en vuelo del bootstrap
  const authReady=typeof ensureFirestoreAuthReady==='function'
    ?await ensureFirestoreAuthReady()
    :{ok:!!(window._firebaseAuth&&window._firebaseAuth.currentUser)};
  if(!authReady||!authReady.ok)return false;
  const rolLogin=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  if((rolLogin==='admin'||rolLogin==='jurisdiccional')&&!window._consEscuchaCompleta){
    updateSyncIndicator('synced');
    return true;
  }
  const deptos=deptosExpedientesAccesibles();
  let lastCount=0;
  if(window._bandejaMarcasListas&&window._fsQuery&&!window._consEscuchaCompleta){
    if(await esperarPrimerSnapExpedientes(deptos,EXP_PRIMER_SNAP_TOPE_MS)){
      mergePendingExpBackup();
      clearLegacyExpsLocalStorage();
      if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
      updateSyncIndicator('synced');
    }
    return true;
  }
  // La escucha en tiempo real ya descarga todos los expedientes: repetirlo con getDocs duplica las lecturas.
  if(await esperarPrimerSnapExpedientes(deptos,EXP_PRIMER_SNAP_TOPE_MS)&&Array.isArray(exps)&&exps.length){
    mergePendingExpBackup();
    clearLegacyExpsLocalStorage();
    if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
    updateSyncIndicator('synced');
    if(typeof papeleraSchedulePurge==='function')papeleraSchedulePurge();
    if(typeof driveOpsProcesarSilencioso==='function')driveOpsProcesarSilencioso();
    console.log('reloadExpedientesTrasLogin: '+exps.length+' expediente(s) desde la escucha en tiempo real (deptos='+deptos.join(',')+')');
    return true;
  }
  for(let attempt=0;attempt<3;attempt++){
    try{
      if(attempt>0)await new Promise(function(r){setTimeout(r,400*attempt);});
      const snaps=await Promise.all(deptos.map(function(depto){return loadExpedientesDepto(depto);}));
      const remote=[];
      snaps.forEach(function(arr){if(Array.isArray(arr))arr.forEach(function(e){remote.push(e);});});
      lastCount=mergeRemoteExpsIntoCache(remote);
      mergePendingExpBackup();
      if(lastCount){
        clearLegacyExpsLocalStorage();
        if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
        updateSyncIndicator('synced');
        if(typeof papeleraSchedulePurge==='function')papeleraSchedulePurge();
        if(typeof driveOpsProcesarSilencioso==='function')driveOpsProcesarSilencioso();
        console.log('reloadExpedientesTrasLogin: '+lastCount+' expediente(s) (intento '+(attempt+1)+', deptos='+deptos.join(',')+')');
        return true;
      }
      console.warn('reloadExpedientesTrasLogin: 0 docs (intento '+(attempt+1)+')',deptos);
    }catch(err){
      console.warn('reloadExpedientesTrasLogin intento '+(attempt+1)+':',err);
    }
  }
  if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  return lastCount>0;
}
window.reloadExpedientesTrasLogin=reloadExpedientesTrasLogin;

// ================================================================
// FIRESTORE — expedientes en subcolección (Fase 1-2)
// departamentos/{deptoId}/expedientes/{exp._exp}
// ================================================================
function expedienteDocId(expOrId){
  return typeof expOrId==='object'?String(expOrId._exp||'').trim():String(expOrId||'').trim();
}
function resolveDeptoFirestoreId(deptoId,exp){
  const fromExp=exp&&exp._depto?String(exp._depto).trim():'';
  const candidate=String(deptoId||fromExp||'guaviare').trim();
  if(DEPTOS_FIRESTORE.includes(candidate))return candidate;
  if(fromExp&&DEPTOS_FIRESTORE.includes(fromExp))return fromExp;
  return 'guaviare';
}
function expedienteDocRef(db,deptoId,expOrId){
  const expId=expedienteDocId(expOrId);
  if(!expId||!db||!window._fsDoc)return null;
  return window._fsDoc(db,'departamentos',deptoId,'expedientes',expId);
}
// Elimina recursivamente valores undefined (Firestore v10 lanza invalid-argument
// ante cualquier undefined, incluso anidado en arrays/objetos).
function _fsStripUndefinedDeep(v){
  if(Array.isArray(v))return v.map(_fsStripUndefinedDeep);
  if(v&&typeof v==='object'&&!(v instanceof Date)){
    const out={};
    for(const k in v){
      if(!Object.prototype.hasOwnProperty.call(v,k))continue;
      if(v[k]===undefined)continue;
      out[k]=_fsStripUndefinedDeep(v[k]);
    }
    return out;
  }
  return v;
}
function nombresPendientesExp(exp){
  const set=[];
  const add=function(n){
    n=String(n||'').trim();
    if(!n)return;
    const k=n.toLowerCase();
    if(set.some(function(x){return String(x).toLowerCase()===k;}))return;
    set.push(n);
  };
  (exp&&exp.tasks||[]).forEach(function(t){
    if(!t||t.eliminada)return;
    let pend=false;
    const est=typeof estadoTask==='function'?estadoTask(t):String(t.estado||'');
    if(est&&est!=='Atendida')pend=true;
    (t.asignados||[]).forEach(function(a){
      if(a&&a.estado&&a.estado!=='atendido')pend=true;
    });
    const f=String((t.firmaWf&&t.firmaWf.fase)||'').trim();
    if(f&&f!=='cerrada'&&f!=='cerrada_atendida')pend=true;
    if(!pend)return;
    if(t.responsable)add(t.responsable);
    (t.responsables||[]).forEach(add);
    (t.asignados||[]).forEach(function(a){
      if(!a)return;
      if(typeof a==='string')add(a);
      else if(a.nombre)add(String(a.nombre));
    });
    const nPor=String((t.firmaWf&&t.firmaWf.notificar_por)||'').trim();
    if(nPor)add(nPor);
  });
  const wf=exp&&exp._pqrs_workflow;
  const nPq=String((wf&&wf.notificar_por)||'').trim();
  if(nPq)add(nPq);
  return set.slice(0,40);
}
function expTieneSeguimiento(exp){
  const wf=exp&&exp._pqrs_workflow;
  const fase=String((wf&&wf.fase)||'').trim();
  if(fase&&!/cerrad/i.test(fase))return true;
  return (exp&&exp.tasks||[]).some(function(t){
    if(!t||t.eliminada)return false;
    const est=typeof estadoTask==='function'?estadoTask(t):String(t.estado||'');
    if(est==='Por verificar'||est==='Por corregir'||est==='En ejecución'||est==='Vencida')return true;
    const f=String((t.firmaWf&&t.firmaWf.fase)||'').trim();
    return !!(f&&f!=='cerrada'&&f!=='cerrada_atendida');
  });
}
function aplicarMarcasBandeja(exp){
  if(!exp||typeof exp!=='object')return exp;
  exp.pendientes=nombresPendientesExp(exp);
  exp.seguimiento=!!expTieneSeguimiento(exp);
  let req=false;
  if(typeof _reqPalEntradasExp==='function'){
    try{const out=[];_reqPalEntradasExp(exp,out);req=out.length>0;}catch(e){req=!!exp.reqAlerta;}
  }
  exp.reqAlerta=req;
  exp.esPqrs=typeof esPqrsSecretaria==='function'?!!esPqrsSecretaria(exp):!!(exp._es_pqrs||exp._radicado_secretaria);
  return exp;
}
function marcasBandejaDistintas(data,exp){
  const a=data||{};
  return JSON.stringify(a.pendientes||[])!==JSON.stringify(exp.pendientes||[])
    ||!!a.seguimiento!==!!exp.seguimiento
    ||!!a.reqAlerta!==!!exp.reqAlerta
    ||!!a.esPqrs!==!!exp.esPqrs;
}
async function asegurarMarcasBandeja(){
  if(window._bandejaMarcasListas||window._bandejaMarcasCorriendo)return;
  const db=window._db;
  const rol=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  const puede=rol==='admin'||rol==='guaviare'||rol==='guainia'||rol==='vaupes';
  if(!puede||!db||!window._fsGetDocs||!window._fsSetDoc||!window._fsCollection||!window._fsDoc)return;
  window._bandejaMarcasCorriendo=true;
  try{
    const deptos=(typeof DEPTOS_EXPEDIENTES_ACTIVOS!=='undefined'&&DEPTOS_EXPEDIENTES_ACTIVOS.length)
      ?DEPTOS_EXPEDIENTES_ACTIVOS.slice()
      :(typeof deptosExpedientesAccesibles==='function'?deptosExpedientesAccesibles():['guaviare']);
    let n=0;
    for(let i=0;i<deptos.length;i++){
      const depto=deptos[i];
      let snap;
      try{snap=await window._fsGetDocs(window._fsCollection(db,'departamentos',depto,'expedientes'));}
      catch(err){console.warn('marcas bandeja',depto,err);continue;}
      const docs=snap&&snap.docs?snap.docs:[];
      for(let j=0;j<docs.length;j++){
        const d=docs[j];
        const data=d.data?d.data()||{}:{};
        const exp=Object.assign({},data,{_exp:data._exp||d.id,_depto:data._depto||depto});
        aplicarMarcasBandeja(exp);
        if(!marcasBandejaDistintas(data,exp))continue;
        try{
          await window._fsSetDoc(d.ref||window._fsDoc(db,'departamentos',depto,'expedientes',d.id),{
            pendientes:exp.pendientes,
            seguimiento:exp.seguimiento,
            reqAlerta:exp.reqAlerta,
            esPqrs:exp.esPqrs
          },{merge:true});
          n++;
        }catch(errW){console.warn('marca expediente',d.id,errW);}
      }
    }
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{bandejaMarcasListas:true},{merge:true});
    window._bandejaMarcasListas=true;
    console.log('Marcas de bandeja listas',n);
    if(typeof initRealtimeSync==='function')initRealtimeSync();
  }catch(err){
    console.warn('asegurarMarcasBandeja',err);
  }finally{
    window._bandejaMarcasCorriendo=false;
  }
}
async function saveExpedienteDoc(deptoId,exp){
  const db=window._db;
  if(!db||!window._fsSetDoc||!exp)return false;
  const auth=window._firebaseAuth;
  if(!auth||!auth.currentUser){
    window._lastFsSaveError={code:'unauthenticated',msg:'Sin sesión Firebase'};
    return false;
  }
  const expId=expedienteDocId(exp);
  if(!expId){console.warn('saveExpedienteDoc: expediente sin _exp');return false;}
  aplicarMarcasBandeja(exp);
  const depto=resolveDeptoFirestoreId(deptoId,exp);
  const ref=expedienteDocRef(db,depto,expId);
  if(!ref){console.warn('saveExpedienteDoc: ref nula',depto,expId);return false;}
  // Strip undefined values (incluye anidados) — Firestore v10 throws invalid-argument on undefined fields
  const rawPayload={...exp,id:expId,_depto:depto,updatedAt:new Date().toISOString()};
  delete rawPayload._pending_fs_sync;
  delete rawPayload._pending_fs_at;
  const payload=_fsStripUndefinedDeep(rawPayload);
  try{
    console.log('saveExpedienteDoc intento:',{deptoIdArg:deptoId,deptoResuelto:depto,expId,path:ref.path,auth:!!(window._usuarioActual||window.authUsuario)});
    await window._fsSetDoc(ref,payload,{merge:true});
    console.log('saveExpedienteDoc OK:',ref.path);
    window._lastFsSaveError=null;
    return true;
  }catch(err){
    console.error('saveExpedienteDoc:',depto,expId,ref.path,err);
    window._lastFsSaveError={code:err&&err.code||'unknown',msg:err&&err.message||'Error desconocido'};
    return false;
  }
}
async function deleteExpedienteDoc(deptoId,exp){
  const db=window._db;
  if(!db||!window._fsDeleteDoc)return false;
  const expId=expedienteDocId(exp);
  if(!expId){console.warn('deleteExpedienteDoc: expediente sin _exp');return false;}
  const depto=resolveDeptoFirestoreId(deptoId,exp);
  const ref=expedienteDocRef(db,depto,expId);
  if(!ref)return false;
  try{
    await window._fsDeleteDoc(ref);
    window._lastFsSaveError=null;
    return true;
  }catch(err){
    console.error('deleteExpedienteDoc:',depto,expId,err);
    window._lastFsSaveError={code:err&&err.code||'unknown',msg:err&&err.message||'Error desconocido'};
    return false;
  }
}
function purgeExpFromLocalStorageCache(expId){
  const id=String(expId||'').trim();
  if(!id)return;
  try{
    const cached=lsLoadJson('sst_e');
    if(!Array.isArray(cached)||!cached.length)return;
    const next=cached.filter(function(e){return String(e&&e._exp||'').trim()!==id;});
    if(next.length===cached.length)return;
    if(next.length)lsStoreJson('sst_e',next);
    else localStorage.removeItem('sst_e');
  }catch(e){console.warn('purgeExpFromLocalStorageCache:',e);}
}
function clearLegacyExpsLocalStorage(){
  try{localStorage.removeItem('sst_e');}catch(e){}
}
async function loadExpedientesDepto(deptoId){
  const db=window._db;
  if(!db||!window._fsGetDocs||!window._fsCollection||!deptoId)return [];
  try{
    const snap=await window._fsGetDocs(window._fsCollection(db,'departamentos',deptoId,'expedientes'));
    return snap.docs.map(d=>{
      const data=d.data()||{};
      const expId=String(data._exp||data.id||d.id||'').trim();
      return{...data,_exp:expId,id:expId};
    });
  }catch(err){
    console.error('loadExpedientesDepto:',deptoId,err);
    return [];
  }
}
// Busca un expediente/PQRSD por número en Firestore (consulta ciudadana sin sesión).
async function fetchExpedientePorNumero(expId){
  const db=window._db;
  if(!db||!window._fsGetDoc||!window._fsDoc)return null;
  const id=String(expId||'').trim();
  if(!id)return null;
  const deptos=(typeof DEPTOS_EXPEDIENTES_ACTIVOS!=='undefined'&&DEPTOS_EXPEDIENTES_ACTIVOS.length)
    ?DEPTOS_EXPEDIENTES_ACTIVOS
    :(typeof DEPTOS_FIRESTORE!=='undefined'?DEPTOS_FIRESTORE:['guaviare']);
  for(let i=0;i<deptos.length;i++){
    const depto=deptos[i];
    try{
      const ref=window._fsDoc(db,'departamentos',depto,'expedientes',id);
      const snap=await window._fsGetDoc(ref);
      if(snap.exists()){
        const data=snap.data()||{};
        const expIdNorm=String(data._exp||data.id||snap.id||'').trim();
        return Object.assign({},data,{_exp:expIdNorm,id:expIdNorm,_depto:data._depto||depto});
      }
    }catch(err){
      console.warn('fetchExpedientePorNumero:',depto,id,err&&err.code||err);
    }
  }
  return null;
}
window.fetchExpedientePorNumero=fetchExpedientePorNumero;
async function saveDeptMeta(deptoId){
  const db=window._db;
  if(!db||!window._fsSetDoc||!deptoId)return false;
  try{
    syncCfgToStore();
    await window._fsSetDoc(window._fsDoc(db,'departamentos',deptoId),{
      cfg:cfgByDepto[deptoId]||{},
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.error('saveDeptMeta:',deptoId,err);
    return false;
  }
}
async function persistMantenimientoFirestore(data){
  const db=window._db;
  if(!db||!window._fsSetDoc){notif('Firestore no disponible','err');return false;}
  const payload=typeof normalizeMantenimiento==='function'?normalizeMantenimiento(data):data;
  setMantenimientoEstadoLocal(payload);
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      mantenimiento:payload,
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.error('persistMantenimientoFirestore:',err);
    notif('No se pudo guardar el modo mantenimiento','err');
    return false;
  }
}
window.persistMantenimientoFirestore=persistMantenimientoFirestore;

/** Libres de un departamento (para persistir en departamentos/{id}). */
function actividadesLibresForDepto(deptoId){
  const d=String(deptoId||'').trim()||'guaviare';
  return (Array.isArray(actividadesLibres)?actividadesLibres:[]).filter(function(t){
    if(!t)return false;
    // La papelera también se guarda. Si se omite, el otro navegador no ve la eliminación
    // y vuelve a subir el informe a Por revisar.
    const td=typeof resolveDeptoActLibre==='function'?resolveDeptoActLibre(t.depto):(t.depto||'guaviare');
    return td===d;
  });
}

/**
 * Upsert sin borrar libres de otros departamentos (snapshot parcial depto).
 * Conserva locales con _pending_fs_sync si el remoto es más pobre.
 * Prioriza la versión más reciente (devolución a corregir no debe perder contra «Por verificar» viejo).
 */
function actLibreEventTs(t){
  if(!t)return 0;
  let ts=0;
  const add=function(v){
    if(v==null||v==='')return;
    if(typeof v==='number'&&isFinite(v)){
      ts=Math.max(ts,v<1e12?v*1000:v);
      return;
    }
    const s=String(v).trim();
    if(!s)return;
    if(/^\d{10,13}$/.test(s)){
      const n=+s;
      if(isFinite(n))ts=Math.max(ts,n<1e12?n*1000:n);
      return;
    }
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const d=new Date(s+'T00:00:00');
      if(!isNaN(d.getTime()))ts=Math.max(ts,d.getTime());
      return;
    }
    const d=new Date(s);
    if(!isNaN(d.getTime()))ts=Math.max(ts,d.getTime());
  };
  if(t.ultimaRevisionDepto){
    add(t.ultimaRevisionDepto.ts);
    add(t.ultimaRevisionDepto.en);
    add(t.ultimaRevisionDepto.fecha);
  }
  (t.historial||[]).forEach(function(h){
    if(!h)return;
    add(h.ts);add(h.en);add(h.fecha);
  });
  add(t.updatedAt);
  add(t.fechaReportada);
  add(t.fechaAtendida);
  return ts;
}
function actLibreEsPorCorregirMerge(t){
  if(!t||t.eliminada)return false;
  if(String(t.estado||'')==='Por corregir')return true;
  if(t.ultimaRevisionDepto&&String(t.ultimaRevisionDepto.tipo||'')==='corregir')return true;
  return (t.asignados||[]).some(function(a){return a&&a.estado==='por_corregir';});
}
function scoreActividadLibreMerge(t){
  if(!t)return 0;
  let s=0;
  if(t.eliminada)s+=50; // nunca revivir eliminadas
  if(actLibreEsPorCorregirMerge(t))s+=12;
  const nAj=(t.historial||[]).filter(function(h){return h&&(h.tipo==='ajuste_soporte'||h.tipo==='devolver_desde_firma');}).length;
  if(nAj)s+=4+Math.min(nAj,4);
  if(t.fechaReportada||t.estado==='Por verificar')s+=4;
  if((t.soportes||[]).length)s+=2;
  if(t.fechaAtendida||t.estado==='Atendida')s+=3;
  if(t._pending_fs_sync)s+=5;
  if(t.origen==='responsable'||t.autoAsignadaPorResponsable)s+=1;
  if((t.notasDoc||[]).length)s+=2+(t.notasDoc.length||0);
  if((t.comentarios||[]).length)s+=2+(t.comentarios.length||0);
  const f=String((t.firmaWf&&t.firmaWf.fase)||'').trim();
  // Si ya está Por corregir, no premiar una fase de firma vieja (evita que VITAL siga viendo Por firmar)
  if(f&&!actLibreEsPorCorregirMerge(t)){
    s+=20;
    if(t.firmaWf.firma_fisica&&t.firmaWf.firma_fisica.en)s+=8;
    if(/notif|lista_para_envio/i.test(f))s+=12;
    else if(/por_firmar|firmar/i.test(f))s+=8;
    else if(/para_firma|por_firma|vital/i.test(f))s+=5;
    else if(/cerrada/i.test(f))s+=15;
  }
  if(t.requiereFirma)s+=1;
  return s;
}
function pickMejorActLibre(a,b){
  if(!a)return b;
  if(!b)return a;
  // Preferir siempre eliminada=true (no revivir)
  if(a.eliminada&&!b.eliminada)return a;
  if(b.eliminada&&!a.eliminada)return b;
  // Devolución a corregir (sin fase de firma) gana frente a caché local aún en Por firmar
  const aCorr=actLibreEsPorCorregirMerge(a),bCorr=actLibreEsPorCorregirMerge(b);
  const aF=!!(a.firmaWf&&String(a.firmaWf.fase||'').trim());
  const bF=!!(b.firmaWf&&String(b.firmaWf.fase||'').trim());
  if(aCorr&&!aF&&bF&&!bCorr)return a;
  if(bCorr&&!bF&&aF&&!aCorr)return b;
  // Una copia más nueva sin el PDF no debe pisar el informe que sí tiene archivo en Drive.
  const aEnt=actLibreTieneArchivoDrive(a),bEnt=actLibreTieneArchivoDrive(b);
  if(aEnt&&!bEnt&&!bCorr)return a;
  if(bEnt&&!aEnt&&!aCorr)return b;
  const ta=actLibreEventTs(a),tb=actLibreEventTs(b);
  if(ta!==tb)return ta>tb?a:b;
  const sa=scoreActividadLibreMerge(a),sb=scoreActividadLibreMerge(b);
  if(sa>sb)return a;
  if(sb>sa)return b;
  if(aCorr&&!bCorr)return a;
  if(bCorr&&!aCorr)return b;
  // Empate: conservar firmaWf si solo una lo tiene (y la otra no está por corregir)
  if(aF&&!bF)return a;
  if(bF&&!aF)return b;
  return b;
}
/** Alta recién creada (solo asignación, sin entrega): el snapshot viejo no debe borrarla. */
function actLibreEsAltaReciente(t){
  if(!t||t.eliminada||t.fechaReportada||t.fechaAtendida)return false;
  if((t.soportes||[]).length)return false;
  const ts=actLibreEventTs(t);
  if(!ts||(Date.now()-ts)>15*60*1000)return false;
  const h=t.historial||[];
  if(!h.length)return true;
  return h.every(function(x){return x&&(x.tipo==='asignacion'||x.tipo==='creacion');});
}
/** Hay entrega real (Por revisar / archivos), no un alta vacía. */
function actLibreTieneEntrega(t){
  if(!t||t.eliminada)return false;
  if(t.fechaReportada||t.estado==='Por verificar'||t.estado==='Por corregir')return true;
  return (t.soportes||[]).some(function(s){return s&&(s.driveFileId||s.fileId);});
}
/** PDF ya subido a Drive (no basta la fecha de entrega: eso reinyectaba informes eliminados y vacíos). */
function actLibreTieneArchivoDrive(t){
  if(!t||t.eliminada)return false;
  return (t.soportes||[]).some(function(s){return s&&(s.driveFileId||s.fileId);});
}
/**
 * Informe que este navegador aún no logró guardar (sync pendiente) y ya tiene archivo.
 * No se revive uno que el servidor ya no tiene si la entrega ya se había sincronizado
 * o si lo eliminaron: eso devolvía el informe a Por revisar sin soportes.
 */
function actLibreEsEntregaHuerfana(t){
  if(!t||t.eliminada||!t.id||!t._pending_fs_sync)return false;
  const inf=t.informeContrato&&String(t.informeContrato.numero||'').trim();
  if(!inf)return false;
  if(!actLibreTieneArchivoDrive(t)&&!t._drive_folder_id)return false;
  const pendienteDesde=Number(t._pending_fs_at)||0;
  if(!pendienteDesde||(Date.now()-pendienteDesde)>15*60*1000)return false;
  return true;
}
function actLibreKeepLocalOnly(t){
  if(!t||!t.id||t.eliminada)return false;
  if(typeof _actLibresQuitadosIds!=='undefined'&&_actLibresQuitadosIds.has(String(t.id)))return false;
  // Alta de «+ crear actividad»: aunque el guardado ya haya limpiado el flag, el snapshot
  // diferido (lista anterior) no debe hacerla desaparecer.
  if(actLibreEsAltaReciente(t))return true;
  if(actLibreEsEntregaHuerfana(t))return true;
  if(!t._pending_fs_sync)return false;
  const at=Number(t._pending_fs_at)||0;
  // Solo conservar huérfanos locales con sync pendiente reciente (evita resucitar borrados remotos)
  if(!at)return true;
  return (Date.now()-at)<15*60*1000;
}
/** Remoto vacío = limpieza intencional: no resucitar altas viejas. Sí se conserva un informe ya entregado (el PDF está en Drive). */
function clearActividadesLibresLocalCache(){
  const keep=(Array.isArray(actividadesLibres)?actividadesLibres:[]).filter(function(t){
    return actLibreKeepLocalOnly(t);
  });
  actividadesLibres=keep;
  if(!keep.length){
    window._pendingActLibreEntrega=null;
    try{localStorage.removeItem('sst_act_libres');}catch(e){}
  }
  return keep.slice();
}
function upsertActividadesLibresFromRemote(remote){
  const rem=Array.isArray(remote)?remote:[];
  if(!rem.length)return clearActividadesLibresLocalCache();
  const local=Array.isArray(actividadesLibres)?actividadesLibres:[];
  const byId=new Map();
  rem.forEach(function(t){
    if(!t||!t.id)return;
    byId.set(String(t.id),t);
  });
  local.forEach(function(t){
    if(!t||!t.id)return;
    const id=String(t.id);
    const remT=byId.get(id);
    if(!remT){
      if(actLibreKeepLocalOnly(t))byId.set(id,t);
      return;
    }
    if(remT.eliminada&&!t.eliminada){
      byId.set(id,remT);
      return;
    }
    // Remoto gana salvo sync local pendiente (marcadores / entrega reciente)
    if(t._pending_fs_sync&&!remT.eliminada&&scoreActividadLibreMerge(t)>=scoreActividadLibreMerge(remT)){
      byId.set(id,t);
      return;
    }
    byId.set(id,pickMejorActLibre(remT,t));
  });
  return Array.from(byId.values()).map(function(t){
    if(typeof normalizeActLibre==='function'){
      try{return normalizeActLibre(t);}catch(e){return t;}
    }
    return t;
  });
}

/** Ids quitados a propósito en esta sesión (papelera definitiva, pasó a expediente, alta fallida). */
const _actLibresQuitadosIds=new Set();
function actLibreMarcarQuitada(id){
  const s=String(id||'').trim();
  if(s)_actLibresQuitadosIds.add(s);
}
window.actLibreMarcarQuitada=actLibreMarcarQuitada;
/** Lista a guardar + las remotas que esta sesión no tiene: una sesión con lista vacía o vieja no borra las de otros
 *  ni pisa con su copia vieja una actividad que otro actualizó después (p. ej. la entrega de un informe). */
function mergeActLibresConRemotoParaGuardar(list,remoto){
  const ids=new Set();
  (Array.isArray(actividadesLibres)?actividadesLibres:[]).forEach(function(t){if(t&&t.id)ids.add(String(t.id));});
  (list||[]).forEach(function(t){if(t&&t.id)ids.add(String(t.id));});
  const remById=new Map();
  (Array.isArray(remoto)?remoto:[]).forEach(function(r){if(r&&r.id)remById.set(String(r.id),r);});
  const out=(list||[]).map(function(t){
    const r=t&&t.id?remById.get(String(t.id)):null;
    if(!r)return t;
    return pickMejorActLibre(t,r);
  });
  (Array.isArray(remoto)?remoto:[]).forEach(function(r){
    const id=String((r&&r.id)||'');
    if(!id||ids.has(id)||_actLibresQuitadosIds.has(id))return;
    ids.add(id);
    out.push(r);
  });
  return out;
}
/** Última lista recibida de cada registro (sistema/global y departamentos/*). Se combinan para no quitar de memoria
 *  lo que solo está en uno: los responsables solo escriben en el del departamento. */
const _actLibresRemotoPorDoc={};
function actLibresRemotoCombinado(clave,lista){
  _actLibresRemotoPorDoc[clave]=Array.isArray(lista)?lista:[];
  const byId=new Map();
  Object.keys(_actLibresRemotoPorDoc).forEach(function(k){
    _actLibresRemotoPorDoc[k].forEach(function(t){
      if(!t||!t.id||_actLibresQuitadosIds.has(String(t.id)))return;
      const id=String(t.id);
      const prev=byId.get(id);
      byId.set(id,prev?pickMejorActLibre(prev,t):t);
    });
  });
  return Array.from(byId.values());
}
/** Entrega local (últimos 7 días) más reciente que la de Firestore (otra sesión la pisó): marcarla para volver a subirla. */
function actLibresMarcarEntregasLocalesMasRecientes(remoto){
  const remById=new Map();
  (Array.isArray(remoto)?remoto:[]).forEach(function(r){if(r&&r.id)remById.set(String(r.id),r);});
  const limite=Date.now()-7*24*60*60*1000;
  let n=0;
  (Array.isArray(actividadesLibres)?actividadesLibres:[]).forEach(function(t){
    if(!t||!t.id||t.eliminada||!t.fechaReportada)return;
    const r=remById.get(String(t.id));
    if(!r)return;
    const tsLocal=actLibreEventTs(t);
    if(tsLocal<limite||tsLocal<=actLibreEventTs(r))return;
    t._pending_fs_sync=true;
    t._pending_fs_at=Date.now();
    n++;
  });
  return n;
}
async function actLibresRemotoDoc(ref){
  try{
    const snap=await window._fsGetDoc(ref);
    const data=snap&&snap.exists()?snap.data():null;
    return data&&Array.isArray(data.actividadesLibres)?data.actividadesLibres:[];
  }catch(err){
    // null = lectura fallida. [] = documento vacío. No guardar encima de una lectura fallida.
    console.warn('actLibresRemotoDoc: no se pudo leer remoto; no se sobrescribe la lista',err);
    return null;
  }
}
/** Lee actividades libres del documento partido; si no existe o las reglas aún no lo permiten, usa sistema/global. */
async function actLibresRemotoPreferido(){
  const db=window._db;
  if(db&&window._fsGetDoc&&window._fsDoc){
    try{
      const snap=await window._fsGetDoc(window._fsDoc(db,'sistema','actividades_libres'));
      const existe=snap&&(typeof snap.exists==='function'?snap.exists():!!snap.exists);
      if(existe){
        const data=snap.data?snap.data():null;
        if(data&&Array.isArray(data.actividadesLibres))return data.actividadesLibres;
      }
    }catch(err){
      console.warn('actLibres parte:',err);
    }
  }
  return actLibresRemotoDoc(window._fsDoc(db,'sistema','global'));
}
async function escribirParteSistema(docId,campo,valor){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return false;
  const parte={updatedAt:new Date().toISOString()};
  parte[campo]=valor;
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema',docId),parte,{merge:true});
    return true;
  }catch(err){
    console.warn('escribirParteSistema:',docId,err);
    return false;
  }
}
function personaFirestoreId(p){
  const raw=String((p&&p.id)||'').trim()||(typeof personaIdentityKey==='function'?personaIdentityKey(p):'');
  return raw.replace(/[\/#?[\]\s]/g,'_').slice(0,700);
}
function personaFirmaEstable(p){
  const c=Object.assign({},p||{});
  delete c.updatedAt;
  try{return JSON.stringify(c);}catch(e){return String((p&&p.id)||'');}
}
function personasMarcarFirmas(lista){
  const map={};
  (lista||[]).forEach(function(p){
    const id=personaFirestoreId(p);
    if(id)map[id]=personaFirmaEstable(p);
  });
  window._personasFirmas=map;
}
/** Una persona por documento. Si la colección no se puede escribir, el arreglo sigue en sistema/personas. */
async function guardarPersonasComoDocs(lista){
  const db=window._db;
  if(!Array.isArray(lista)||!lista.length||!db||!window._fsSetDoc||!window._fsDoc)return false;
  const prev=window._personasFirmas||{};
  const vistos={};
  try{
    for(let i=0;i<lista.length;i++){
      const p=lista[i];
      if(!p||typeof p!=='object')continue;
      const id=personaFirestoreId(p);
      if(!id)continue;
      vistos[id]=1;
      const firma=personaFirmaEstable(p);
      if(prev[id]===firma)continue;
      await window._fsSetDoc(window._fsDoc(db,'personas',id),Object.assign({},p,{id:id}),{merge:true});
      prev[id]=firma;
    }
    const quitar=Object.keys(prev).filter(function(id){return !vistos[id];});
    if(quitar.length&&window._fsDeleteDoc){
      for(let j=0;j<quitar.length;j++){
        await window._fsDeleteDoc(window._fsDoc(db,'personas',quitar[j]));
        delete prev[quitar[j]];
      }
    }
    if(!Object.keys(vistos).length)return false;
    window._personasFirmas=prev;
    return true;
  }catch(err){
    console.warn('guardarPersonasComoDocs',err);
    return false;
  }
}
function aplicarPersonasLista(list){
  if(!Array.isArray(list)||!list.length)return;
  personas=list.map(function(p){return typeof normalizePersonaRecord==='function'?normalizePersonaRecord(p):p;});
  personasMarcarFirmas(personas);
  window._personasColeccionLista=true;
  marcarParteGlobalViva('personas');
}
async function cargarPersonasColeccion(){
  const db=window._db;
  if(!db||!window._fsGetDocs||!window._fsCollection)return;
  try{
    const snap=await window._fsGetDocs(window._fsCollection(db,'personas'));
    const list=[];
    if(snap&&typeof snap.forEach==='function'){
      snap.forEach(function(d){
        const data=d.data?d.data()||{}:{};
        list.push(Object.assign({},data,{id:data.id||d.id}));
      });
    }
    aplicarPersonasLista(list);
  }catch(err){
    console.warn('cargarPersonasColeccion',err);
  }
}
function escucharPersonasColeccion(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection||window._personasUnsub)return;
  window._personasUnsub=window._fsOnSnapshot(window._fsCollection(db,'personas'),function(snap){
    if(typeof _localSaving!=='undefined'&&_localSaving)return;
    const list=[];
    if(snap&&typeof snap.forEach==='function'){
      snap.forEach(function(d){
        const data=d.data?d.data()||{}:{};
        list.push(Object.assign({},data,{id:data.id||d.id}));
      });
    }
    if(!list.length)return;
    aplicarPersonasLista(list);
    try{_saveLSLocal();}catch(e){}
    if(typeof scheduleRefreshViewsAfterRemoteDataChange==='function')scheduleRefreshViewsAfterRemoteDataChange();
  },function(err){console.warn('personas coleccion',err);});
}
/** Pasa personas, libres y agenda a su documento. Solo los quita de global si ese documento se escribió. */
async function moverCamposAPartes(payload){
  if(!payload||typeof window._fsDeleteField!=='function')return payload;
  const partes=[
    ['actividades_libres','actividadesLibres'],
    ['personas','personas'],
    ['agenda','agendaEventos']
  ];
  for(let i=0;i<partes.length;i++){
    const campo=partes[i][1];
    if(!Object.prototype.hasOwnProperty.call(payload,campo))continue;
    let ok=false;
    let porColeccion=false;
    if(campo==='personas'){
      ok=await guardarPersonasComoDocs(payload.personas);
      porColeccion=ok;
    }
    if(!ok)ok=await escribirParteSistema(partes[i][0],campo,payload[campo]);
    if(ok)payload[campo]=window._fsDeleteField();
    if(porColeccion){
      try{
        await window._fsSetDoc(window._fsDoc(window._db,'sistema','personas'),{personas:window._fsDeleteField()},{merge:true});
      }catch(e){}
    }
  }
  return payload;
}
function parteGlobalViva(campo){
  return !!(window._sstPartesVivas&&window._sstPartesVivas[campo]);
}
function marcarParteGlobalViva(campo){
  if(!window._sstPartesVivas)window._sstPartesVivas={};
  window._sstPartesVivas[campo]=true;
}
function aplicarParteSistema(campo,valor,silencioso){
  marcarParteGlobalViva(campo);
  let changed=false;
  if(campo==='personas'&&Array.isArray(valor)){
    if(window._personasColeccionLista)return;
    personas=valor.map(function(p){return typeof normalizePersonaRecord==='function'?normalizePersonaRecord(p):p;});
    changed=true;
  }else if(campo==='actividadesLibres'&&Array.isArray(valor)){
    actividadesLibres=typeof mergeActividadesLibresFromRemote==='function'
      ?mergeActividadesLibresFromRemote(typeof actLibresRemotoCombinado==='function'?actLibresRemotoCombinado('parte:libres',valor):valor)
      :valor;
    changed=true;
  }else if(campo==='agendaEventos'&&Array.isArray(valor)){
    agendaEventos=valor;
    changed=true;
    if(typeof depurarAgendaAlmacenada==='function')depurarAgendaAlmacenada();
  }else if(campo==='ncaPinsByUser'&&valor&&typeof valor==='object'&&typeof ncaPqrsPinsApplyFromGlobal==='function'){
    changed=!!ncaPqrsPinsApplyFromGlobal({ncaPinsByUser:valor});
  }
  if(!changed||silencioso)return;
  try{_saveLSLocal();}catch(e){}
  if(typeof scheduleRefreshViewsAfterRemoteDataChange==='function')scheduleRefreshViewsAfterRemoteDataChange();
}
async function cargarPartesSistema(){
  const db=window._db;
  if(!db||!window._fsGetDoc||!window._fsDoc)return;
  const partes=[
    ['actividades_libres','actividadesLibres'],
    ['personas','personas'],
    ['agenda','agendaEventos'],
    ['fichas','ncaPinsByUser']
  ];
  for(let i=0;i<partes.length;i++){
    try{
      const snap=await window._fsGetDoc(window._fsDoc(db,'sistema',partes[i][0]));
      const existe=snap&&(typeof snap.exists==='function'?snap.exists():!!snap.exists);
      if(!existe)continue;
      const data=snap.data?snap.data()||{}:{};
      if(!Object.prototype.hasOwnProperty.call(data,partes[i][1]))continue;
      aplicarParteSistema(partes[i][1],data[partes[i][1]],true);
    }catch(err){
      console.warn('cargarPartesSistema',partes[i][0],err);
    }
  }
}
function escucharPartesSistema(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsDoc)return;
  if(window._sstParteUnsubs&&window._sstParteUnsubs.length)return;
  window._sstParteUnsubs=[];
  const partes=[
    ['actividades_libres','actividadesLibres'],
    ['personas','personas'],
    ['agenda','agendaEventos'],
    ['fichas','ncaPinsByUser']
  ];
  partes.forEach(function(par){
    const unsub=window._fsOnSnapshot(window._fsDoc(db,'sistema',par[0]),function(snap){
      const existe=snap&&(typeof snap.exists==='function'?snap.exists():!!snap.exists);
      if(!existe)return;
      const data=snap.data?snap.data()||{}:{};
      if(!Object.prototype.hasOwnProperty.call(data,par[1]))return;
      if(_localSaving&&par[1]==='actividadesLibres'){
        if(typeof diferirActLibresSnap==='function')diferirActLibresSnap('parte:libres',data.actividadesLibres,false);
        return;
      }
      if(par[1]==='actividadesLibres'&&typeof cancelarActLibresSnapDiferido==='function')cancelarActLibresSnapDiferido('parte:libres');
      aplicarParteSistema(par[1],data[par[1]],false);
    },function(err){console.warn('parte sistema',par[0],err);});
    window._sstParteUnsubs.push(unsub);
  });
}

/** Guarda libres del depto en departamentos/{deptoId} (permiso de responsable/encargado). */
async function saveActividadesLibresDeptoFirestore(deptoId){
  const db=window._db;
  const d=String(deptoId||'').trim();
  if(!db||!window._fsSetDoc||!d||d==='responsables')return false;
  if(typeof DEPTOS_FIRESTORE!=='undefined'&&DEPTOS_FIRESTORE.indexOf(d)<0)return false;
  try{
    const ref=window._fsDoc(db,'departamentos',d);
    let list=actividadesLibresForDepto(d).map(function(t){
      return sanitizeActLibreForFirestore(t);
    }).filter(Boolean);
    if(window._fsGetDoc){
      const remotoLibres=await actLibresRemotoDoc(ref);
      if(remotoLibres==null){
        window._lastFsSaveError={code:'unavailable',msg:'No se leyó la lista remota de actividades; no se sobrescribe'};
        updateSyncIndicator('error');
        return false;
      }
      list=mergeActLibresConRemotoParaGuardar(list,remotoLibres);
    }
    const payload=typeof _fsStripUndefinedDeep==='function'
      ?_fsStripUndefinedDeep({actividadesLibres:list,updatedAt:new Date().toISOString()})
      :{actividadesLibres:list,updatedAt:new Date().toISOString()};
    await window._fsSetDoc(ref,payload,{merge:true});
    return true;
  }catch(err){
    console.error('saveActividadesLibresDeptoFirestore:',d,err);
    window._lastFsSaveError={code:err&&err.code||'unknown',msg:'Depto '+d+': '+(err&&err.message||'Error')};
    return false;
  }
}
/** Quita blobs / File / data-URL enormes para que Firestore no falle al guardar. */
function sanitizeActLibreForFirestore(t){
  if(!t||typeof t!=='object')return null;
  let copy;
  try{
    copy=JSON.parse(JSON.stringify(t,function(k,v){
      if(k==='localBlob'||k==='_localBlob'||k==='blob'||k==='file'||k==='data')return undefined;
      if(typeof Blob!=='undefined'&&v instanceof Blob)return undefined;
      if(typeof File!=='undefined'&&v instanceof File)return undefined;
      if(typeof v==='string'&&v.indexOf('data:')===0&&v.length>8000)return undefined;
      return v;
    }));
  }catch(err){
    copy=Object.assign({},t);
  }
  delete copy._pending_fs_sync;
  delete copy._pending_fs_at;
  if(Array.isArray(copy.soportes)){
    copy.soportes=copy.soportes.map(function(s){
      if(!s||typeof s!=='object')return s;
      const o=Object.assign({},s);
      delete o.localBlob;delete o._localBlob;delete o.blob;delete o.file;delete o.data;
      if(o.url&&String(o.url).indexOf('data:')===0)o.url=o.preview&&String(o.preview).indexOf('data:')!==0?o.preview:'';
      if(o.preview&&String(o.preview).indexOf('data:')===0)o.preview=o.url||'';
      return o;
    });
  }
  return copy;
}
window.sanitizeActLibreForFirestore=sanitizeActLibreForFirestore;

/**
 * Persiste actividadesLibres: prioriza sistema/global (encargado NCA / marcadores),
 * luego departamentos/{id} solo si el rol puede escribir ese depto.
 * OK si al menos un canal funciona.
 */
async function persistActividadesLibresFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc)return false;
  if(typeof ensureFirestoreAuthReady==='function'){
    const authOk=await ensureFirestoreAuthReady();
    if(!authOk||!authOk.ok)return false;
  }
  _localSaving=true;
  window._lastFsSaveError=null;
  let globalOk=false;
  let globalErr=null;
  try{
    globalOk=!!(await saveGlobalFirestore());
    if(!globalOk)globalErr=window._lastFsSaveError;
  }catch(err){
    console.warn('persistActividadesLibresFirestore global:',err);
    globalErr={code:err&&err.code||'unknown',msg:'Global: '+(err&&err.message||'Error')};
  }
  const writable=new Set(
    typeof deptosExpedientesAccesibles==='function'?deptosExpedientesAccesibles():['guaviare']
  );
  const rol=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  if(rol==='admin'){
    (typeof DEPTOS_FIRESTORE!=='undefined'?DEPTOS_FIRESTORE:['guaviare','guainia','vaupes']).forEach(function(d){writable.add(d);});
  }
  const deptos=new Set();
  (actividadesLibres||[]).forEach(function(t){
    if(!t||t.eliminada)return;
    const d=typeof resolveDeptoActLibre==='function'?resolveDeptoActLibre(t.depto):(t.depto||'guaviare');
    if(d&&d!=='responsables'&&writable.has(d))deptos.add(d);
  });
  if(!deptos.size&&writable.has('guaviare'))deptos.add('guaviare');
  let deptoOk=false;
  let deptoErr=null;
  for(const d of deptos){
    window._lastFsSaveError=null;
    if(await saveActividadesLibresDeptoFirestore(d))deptoOk=true;
    else if(!deptoErr&&window._lastFsSaveError)deptoErr=window._lastFsSaveError;
  }
  const ok=deptoOk||globalOk;
  if(ok){
    window._lastFsSaveError=null;
    (actividadesLibres||[]).forEach(function(t){
      if(t&&t._pending_fs_sync){delete t._pending_fs_sync;delete t._pending_fs_at;}
    });
    if(window._pendingActLibreEntrega)window._pendingActLibreEntrega=null;
    try{persistExpLocal();}catch(e){}
  }else{
    window._lastFsSaveError=globalErr||deptoErr||{code:'permission-denied',msg:'No se pudo guardar en global ni en departamento'};
  }
  setTimeout(function(){_localSaving=false;},1800);
  return ok;
}
window.saveActividadesLibresDeptoFirestore=saveActividadesLibresDeptoFirestore;
window.persistActividadesLibresFirestore=persistActividadesLibresFirestore;
window.upsertActividadesLibresFromRemote=upsertActividadesLibresFromRemote;

/** Borra de sistema/global la lista compartida antigua de la bandeja (cada usuario tiene la suya en *ByUser). */
function quitarBandejaCompartidaDelPayload(payload){
  if(!payload||typeof window._fsDeleteField!=='function')return payload;
  payload.bandejaLeidos=window._fsDeleteField();
  payload.bandejaEliminados=window._fsDeleteField();
  // Con bandeja_estado/{email} activo no se reescriben las listas de todos en sistema/global.
  if(!window._bandejaDocFallo){
    delete payload.bandejaLeidosByUser;
    delete payload.bandejaEliminadosByUser;
  }
  return payload;
}
async function saveGlobalFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc)return false;
  const auth=window._firebaseAuth;
  if(!auth||!auth.currentUser){
    window._lastFsSaveError={code:'unauthenticated',msg:'Sin sesión Firebase'};
    return false;
  }
  _localSaving=true;
  try{
    const bandejaPay=typeof buildBandejaEstadoPayloadForSave==='function'?buildBandejaEstadoPayloadForSave():{
      bandejaLeidos:typeof getBandejaLeidos==='function'?getBandejaLeidos():[],
      bandejaEliminados:typeof getBandejaEliminados==='function'?getBandejaEliminados():[]
    };
    const refGlobal=window._fsDoc(db,'sistema','global');
    let libresGlobal=(actividadesLibres||[]).map(function(t){
      return typeof sanitizeActLibreForFirestore==='function'?sanitizeActLibreForFirestore(t):t;
    }).filter(Boolean);
    // La radicación solo necesita el índice (personas). Si no se puede leer la lista
    // de actividades, no se aborta el índice ni se escribe una lista vacía encima.
    let incluirLibres=true;
    if(window._fsGetDoc){
      const remotoLibres=await actLibresRemotoPreferido();
      if(remotoLibres==null){
        incluirLibres=false;
        console.warn('saveGlobalFirestore: no se leyeron actividades libres; el índice se guarda sin modificarlas');
      }else{
        libresGlobal=mergeActLibresConRemotoParaGuardar(libresGlobal,remotoLibres);
      }
    }
    let payload={
      personas:personas||[],
      actividadesLibres:libresGlobal,
      agendaEventos:agendaEventos||[],
      bandejaLeidosByUser:bandejaPay.bandejaLeidosByUser||{},
      bandejaEliminadosByUser:bandejaPay.bandejaEliminadosByUser||{},
      encargadosGlobal:normalizeEncargadosGlobal(encargadosGlobal),
      mantenimiento:typeof normalizeMantenimiento==='function'?normalizeMantenimiento(mantenimientoEstado):mantenimientoEstado||{activo:false},
      updatedAt:new Date().toISOString()
    };
    // No reescribir usuariosIndex con un listado parcial (encargado / rules filtradas).
    if(typeof puedePersistirUsuariosIndexGlobal==='function'?puedePersistirUsuariosIndexGlobal():(typeof esVistaUsuariosAdminCompleta==='function'&&esVistaUsuariosAdminCompleta()&&(_usuariosCache||[]).length)){
      payload.usuariosIndex=_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
        cargo:String(u.cargo||'').trim().toLowerCase(),
        activo:u.activo!==false,
        deptoResponsable:String(u.deptoResponsable||'').trim()
      }));
    }
    if(!incluirLibres)delete payload.actividadesLibres;
    if(typeof _fsStripUndefinedDeep==='function')payload=_fsStripUndefinedDeep(payload);
    quitarBandejaCompartidaDelPayload(payload);
    await moverCamposAPartes(payload);
    try{
      await window._fsSetDoc(refGlobal,payload,{merge:true});
    }catch(errWrite){
      // La lista de actividades no debe impedir guardar personas / índice (radicación).
      if(!Object.prototype.hasOwnProperty.call(payload,'actividadesLibres'))throw errWrite;
      console.warn('saveGlobalFirestore: reintento del índice sin actividades libres',errWrite);
      delete payload.actividadesLibres;
      incluirLibres=false;
      await window._fsSetDoc(refGlobal,payload,{merge:true});
    }
    // Ya sincronizado: limpiar flags pendientes locales solo si la lista sí se escribió
    if(incluirLibres){
      (actividadesLibres||[]).forEach(function(t){
        if(t&&t._pending_fs_sync){delete t._pending_fs_sync;delete t._pending_fs_at;}
      });
      if(window._pendingActLibreEntrega)window._pendingActLibreEntrega=null;
    }
    return true;
  }catch(err){
    console.error('saveGlobalFirestore:',err);
    window._lastFsSaveError={code:err&&err.code||'unknown',msg:'Global: '+(err&&err.message||'Error desconocido')};
    return false;
  }finally{
    setTimeout(function(){_localSaving=false;},1800);
  }
}
function persistExpLocal(){
  _saveLSLocal();
  checkLocalStorageCapacityAfterSave();
}
const SST_PENDING_EXP_KEY='sst_e_pending';
function _pendingExpBackupList(){
  try{return lsLoadJson(SST_PENDING_EXP_KEY)||[];}catch(e){return[];}
}
function persistExpLocalBackup(exp){
  if(!exp)return;
  const id=expedienteDocId(exp);
  if(!id)return;
  try{
    const list=_pendingExpBackupList();
    const row=Object.assign({},exp,{_pending_fs_sync:true,_pending_fs_at:new Date().toISOString()});
    const idx=list.findIndex(function(e){return expedienteDocId(e)===id;});
    if(idx>=0)list[idx]=row;else list.push(row);
    lsStoreJson(SST_PENDING_EXP_KEY,list);
  }catch(e){console.warn('persistExpLocalBackup:',e);}
}
function removeExpLocalBackup(expId){
  const id=String(expId||'').trim();
  if(!id)return;
  try{
    const list=_pendingExpBackupList().filter(function(e){return expedienteDocId(e)!==id;});
    if(list.length)lsStoreJson(SST_PENDING_EXP_KEY,list);
    else localStorage.removeItem(SST_PENDING_EXP_KEY);
  }catch(e){}
}
function mergeExpIntoExpsCache(exp){
  if(!exp)return;
  const id=expedienteDocId(exp);
  if(!id)return;
  if(!Array.isArray(exps))exps=[];
  const idx=exps.findIndex(function(e){return expedienteDocId(e)===id;});
  // Mismo objeto en caché: no reemplazarlo por una copia (flujos async aún lo están mutando)
  if(idx>=0&&exps[idx]===exp){
    delete exp._pending_fs_sync;
    delete exp._pending_fs_at;
    return;
  }
  const clean=Object.assign({},exp);
  delete clean._pending_fs_sync;
  delete clean._pending_fs_at;
  if(idx>=0){
    // Si el remoto llega incompleto, no perder eliminadas ya aplicadas en caché
    const prev=exps[idx];
    if(prev&&prev.tasks&&clean.tasks){
      clean.tasks=mergeExpedienteTasksLocalRemote(prev.tasks,clean.tasks);
    }
    exps[idx]=clean;
  }else exps.push(clean);
}
function mergePendingExpBackup(){
  const pending=_pendingExpBackupList();
  if(!pending.length)return;
  pending.forEach(function(exp){
    const id=expedienteDocId(exp);
    if(!id)return;
    const idx=(exps||[]).findIndex(function(e){return expedienteDocId(e)===id;});
    if(idx<0){
      mergeExpIntoExpsCache(exp);
      return;
    }
    const remote=exps[idx];
    const remoteAt=String(remote.updatedAt||remote._fecha||'');
    const pendingAt=String(exp._pending_fs_at||'');
    if(!remoteAt||pendingAt>remoteAt)exps[idx]=exp;
  });
}
/** Expira el JWT de Firebase (ms epoch) o 0 si no se puede leer. */
function _firebaseIdTokenExpMs(jwt){
  try{
    const part=String(jwt||'').split('.')[1];
    if(!part)return 0;
    const b64=part.replace(/-/g,'+').replace(/_/g,'/');
    const pad=b64.length%4===0?'':'===='.slice(b64.length%4);
    const json=JSON.parse(atob(b64+pad));
    return(Number(json.exp)||0)*1000;
  }catch(e){return 0;}
}
/** true si el token vence antes de skewSec segundos. */
function _firebaseIdTokenExpiring(jwt,skewSec){
  const exp=_firebaseIdTokenExpMs(jwt);
  if(!exp)return true;
  return Date.now()>=(exp-(Number(skewSec)||0)*1000);
}
/**
 * Asegura sesión Firebase usable para escribir en Firestore.
 * No exige refresco forzado si el token en caché sigue vigente (Drive OAuth
 * puede seguir activo aunque falle un getIdToken(true) por red).
 * Si hay currentUser, no bloquea el guardado: el SDK de Firestore refresca solo.
 */
async function ensureFirestoreAuthReady(){
  const auth=window._firebaseAuth;
  let user=auth&&auth.currentUser;
  if(!user){
    // Persistencia IndexedDB / restauración tras foco: reintentar unos segundos
    for(let i=0;i<8&&!user;i++){
      await new Promise(function(r){setTimeout(r,250);});
      user=auth&&auth.currentUser;
      if(!user&&typeof authUsuario!=='undefined'&&authUsuario&&authUsuario.uid)
        user=authUsuario;
    }
  }
  if(!user){
    window._lastFsSaveError={code:'unauthenticated',msg:'Sin sesión Firebase activa'};
    return{ok:false,code:'unauthenticated'};
  }
  let cached='';
  try{cached=await user.getIdToken(false);}catch(errSoft){
    console.warn('ensureFirestoreAuthReady getIdToken(false):',errSoft);
  }
  const cachedOk=!!(cached&&!_firebaseIdTokenExpiring(cached,45));
  if(cachedOk){
    // Refresco en segundo plano si queda <5 min; no bloquea el guardado
    if(_firebaseIdTokenExpiring(cached,5*60)){
      user.getIdToken(true).catch(function(e){console.warn('ensureFirestoreAuthReady bg refresh:',e);});
    }
    return{ok:true,email:user.email||''};
  }
  try{
    await user.getIdToken(true);
    return{ok:true,email:user.email||''};
  }catch(err){
    // Red inestable: si aún hay token no vencido, permitir el guardado
    if(cached&&!_firebaseIdTokenExpiring(cached,0)){
      console.warn('ensureFirestoreAuthReady: force falló, se usa token en caché',err);
      return{ok:true,email:user.email||'',stale:true};
    }
    // currentUser sigue vivo: dejar que Firestore use su propio refresh
    console.warn('ensureFirestoreAuthReady: token check falló; se intenta guardar con currentUser',err);
    return{ok:true,email:user.email||'',stale:true};
  }
}
window.ensureFirestoreAuthReady=ensureFirestoreAuthReady;
async function syncPendingExpedientesToFirestore(){
  const pending=_pendingExpBackupList();
  if(!pending.length)return 0;
  const authOk=await ensureFirestoreAuthReady();
  if(!authOk.ok)return 0;
  let synced=0;
  const remaining=[];
  for(let i=0;i<pending.length;i++){
    const exp=pending[i];
    const depto=resolveDeptoFirestoreId(exp._depto||deptoActivo||'guaviare',exp);
    const ok=await saveExpedienteDoc(depto,exp);
    if(ok){
      removeExpLocalBackup(expedienteDocId(exp));
      mergeExpIntoExpsCache(exp);
      synced++;
    }else remaining.push(exp);
  }
  try{
    if(remaining.length)lsStoreJson(SST_PENDING_EXP_KEY,remaining);
    else localStorage.removeItem(SST_PENDING_EXP_KEY);
  }catch(e){}
  if(synced>0&&typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  return synced;
}
window.syncPendingExpedientesToFirestore=syncPendingExpedientesToFirestore;
function _firestoreSaveErrorMessage(errCode){
  const email=(window._usuarioActual&&window._usuarioActual.email)||(window._firebaseAuth&&window._firebaseAuth.currentUser&&window._firebaseAuth.currentUser.email)||'?';
  const rol=(window._usuarioActual&&window._usuarioActual.rol)||'?';
  let msg='⚠️ No se pudo guardar en Firestore.';
  if(errCode==='permission-denied'){
    msg+=' Sin permisos para "'+email+'" (rol: '+rol+').';
    msg+=' Verifique que su cuenta esté activa y vuelva a iniciar sesión si el problema continúa.';
  }else if(errCode==='unauthenticated'){
    msg+=' Sesión de Firebase no disponible (el contador de Drive es independiente). Cierre sesión y vuelva a ingresar con su cuenta institucional.';
  }else if(errCode==='invalid-argument'){
    msg+=' Datos del expediente demasiado grandes o inválidos. Intente sin adjuntos pesados en el cuerpo del correo.';
  }else if(errCode&&errCode!=='unknown'){
    msg+=' Código: '+errCode+'.';
  }else{
    msg+=' Verifique conexión o permisos.';
  }
  return msg;
}
function _persistLocalBackupHint(exp){
  const esPqrs=!!(exp&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(exp));
  return esPqrs
    ?' La PQRSD quedó guardada localmente y se sincronizará al reconectar.'
    :' El expediente quedó guardado localmente y se sincronizará al reconectar.';
}
async function persistExpedienteGranular(exp,withGlobal,opts){
  return persistExpedienteGranularAsync(exp,withGlobal,opts);
}
/** Guarda el expediente en Firestore y retorna true/false (para await en radicación). */
async function persistExpedienteGranularAsync(exp,withGlobal,opts){
  if(!exp)return false;
  opts=opts||{};
  const silencioso=!!opts.silent;
  const deptoResolved=resolveDeptoFirestoreId(deptoActivo,exp);
  if(!silencioso)console.log('persistExpedienteGranular:',{deptoActivo,exp_depto:exp._depto,exp__exp:exp._exp,deptoResolved,withGlobal:!!withGlobal});
  if(!silencioso)updateSyncIndicator('syncing');
  const authOk=await ensureFirestoreAuthReady();
  if(!authOk.ok){
    if(!opts.sinRespaldoLocal)persistExpLocalBackup(exp);
    if(!silencioso){
      updateSyncIndicator('error');
      if(typeof notif==='function')notif(_firestoreSaveErrorMessage('unauthenticated')+_persistLocalBackupHint(exp),'err');
    }
    return false;
  }
  // Evita que el listener ignore el snapshot del propio guardado (y el de otras pestañas
  // en el mismo navegador) mientras corre un saveFirestore/cfg concurrente.
  const expOk=await saveExpedienteDoc(deptoResolved,exp);
  let globalOk=true;
  if(withGlobal)globalOk=await saveGlobalFirestore();
  if(expOk){
    removeExpLocalBackup(expedienteDocId(exp));
    mergeExpIntoExpsCache(exp);
    if(!silencioso)updateSyncIndicator('synced');
    if(!silencioso&&!globalOk&&typeof notif==='function'){
      const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(exp);
      const cod=window._lastFsSaveError&&window._lastFsSaveError.code;
      const base=esPqrs?'⚠️ PQRSD guardada, pero no se actualizó el índice global.':'⚠️ Expediente guardado, pero no se actualizó el índice global.';
      notif(base+(cod&&cod!=='unknown'?' ('+cod+')':''),'warn');
    }
    return true;
  }
  if(!opts.sinRespaldoLocal)persistExpLocalBackup(exp);
  if(!silencioso){
    updateSyncIndicator('error');
    const lastErr=window._lastFsSaveError||null;
    const errCode=lastErr&&lastErr.code||'unknown';
    console.error('persistExpedienteGranular: guardado falló',{exp__exp:exp._exp,deptoResolved,errCode,lastErr});
    if(typeof notif==='function')notif(_firestoreSaveErrorMessage(errCode)+_persistLocalBackupHint(exp),'err');
  }
  return false;
}
window.persistExpedienteGranularAsync=persistExpedienteGranularAsync;
/** Reparos al pintar listas (dedupe / heal). Una escritura a la vez, sin aviso.
 *  Sin sesión no encola: al volver a entrar se recalcula desde Firestore.
 *  Si la sesión se cae (otro equipo, cierre, sin red) se suelta la cola y no se sube un documento a medias. */
function _reparoEstado(){
  if(!window._reparoEstado)window._reparoEstado={cola:[],activo:false,espera:null};
  return window._reparoEstado;
}
function _reparoSesionUi(){
  return typeof document!=='undefined'&&!!(document.body&&document.body.classList.contains('sesion-activa'));
}
function _reparoSesionLista(){
  if(!_reparoSesionUi())return false;
  const auth=window._firebaseAuth;
  return !!(auth&&auth.currentUser);
}
function _reparoSoltarCola(){
  const st=_reparoEstado();
  if(st.espera){clearInterval(st.espera);st.espera=null;}
  st.cola.forEach(function(item){if(item&&item.set)item.set.delete(item.clave);});
  st.cola.length=0;
}
function _reparoDrenar(){
  const st=_reparoEstado();
  if(st.activo)return;
  if(!st.cola.length){
    if(st.espera){clearInterval(st.espera);st.espera=null;}
    return;
  }
  if(!_reparoSesionUi()){_reparoSoltarCola();return;}
  if(!_reparoSesionLista()){
    if(!st.espera)st.espera=setInterval(function(){_reparoDrenar();},1500);
    return;
  }
  if(st.espera){clearInterval(st.espera);st.espera=null;}
  const item=st.cola.shift();
  if(!item)return;
  st.activo=true;
  Promise.resolve(persistExpedienteGranularAsync(item.exp,false,{silent:true,sinRespaldoLocal:true})).then(function(ok){
    st.activo=false;
    if(ok){_reparoDrenar();return;}
    if(!_reparoSesionUi()){
      if(item.set)item.set.delete(item.clave);
      _reparoSoltarCola();
      return;
    }
    item.intentos=(item.intentos||0)+1;
    if(item.intentos>=5){
      if(item.set)item.set.delete(item.clave);
      _reparoDrenar();
      return;
    }
    setTimeout(function(){
      if(!_reparoSesionUi()){if(item.set)item.set.delete(item.clave);_reparoSoltarCola();return;}
      st.cola.push(item);
      _reparoDrenar();
    },8000);
    _reparoDrenar();
  },function(){
    st.activo=false;
    if(item.set)item.set.delete(item.clave);
    if(!_reparoSesionUi())_reparoSoltarCola();
    else _reparoDrenar();
  });
}
function encolarReparoExpediente(exp,setName,clave){
  if(!exp)return false;
  setName=String(setName||'_reparoExpPersist');
  clave=String(clave!=null?clave:(exp._exp||'')).trim();
  if(!clave)return false;
  if(!_reparoSesionUi())return false;
  if(!window[setName]||!(window[setName] instanceof Set))window[setName]=new Set();
  const set=window[setName];
  if(set.has(clave))return false;
  set.add(clave);
  _reparoEstado().cola.push({exp:exp,set:set,clave:clave,intentos:0});
  _reparoDrenar();
  return true;
}
window.encolarReparoExpediente=encolarReparoExpediente;
window._reparoSoltarCola=_reparoSoltarCola;
function diagTestSaveExpedienteDoc(){
  saveExpedienteDoc('guaviare',{
    _exp:'TEST-001',
    _depto:'guaviare',
    _tramite:'prueba',
    nombre:'Expediente de prueba'
  }).then(function(ok){console.log('saveExpedienteDoc resultado:',ok,'lastErr:',window._lastFsSaveError);})
    .catch(function(err){console.error('saveExpedienteDoc error:',err);});
}
async function diagCheckUsuarioFirestore(email){
  const em=String(email||'').trim().toLowerCase();
  const db=window._db;
  if(!db||!window._fsGetDoc||!window._fsDoc){console.error('diagCheckUsuarioFirestore: Firestore no disponible');return;}
  try{
    const snap=await window._fsGetDoc(window._fsDoc(db,'usuarios',em||((window._usuarioActual&&window._usuarioActual.email)||'')));
    if(!snap.exists()){console.error('diagCheckUsuarioFirestore: documento NO EXISTE para',em);return;}
    const d=snap.data()||{};
    console.log('diagCheckUsuarioFirestore OK:',{email:snap.id,rol:d.rol,activo:d.activo,nombre:d.nombre,codigo:d.codigo});
    console.log('rolOperaGuaviareFrontend:',['secretaria','oap_deguv','rn_deguv','admin_deguv','ds_deguv'].includes(d.rol));
  }catch(err){
    console.error('diagCheckUsuarioFirestore error:',err.code,err.message);
  }
}
window.diagTestSaveExpedienteDoc=diagTestSaveExpedienteDoc;
window.diagCheckUsuarioFirestore=diagCheckUsuarioFirestore;
async function limpiarCamposObsoletos(){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc||!window._fsDeleteField){
    console.error('limpiarCamposObsoletos: Firebase no disponible');
    return false;
  }
  // Protección: requiere confirmación explícita para evitar ejecución accidental
  const ok=window.confirm(
    '⚠️ ACCIÓN IRREVERSIBLE\n\n'+
    'limpiarCamposObsoletos() eliminará los campos "expedientes" y "pqrsd" '+
    'del documento padre de cada departamento en Firestore.\n\n'+
    'Solo ejecutar UNA VEZ después de verificar que la subcolección '+
    'departamentos/{deptoId}/expedientes está completamente poblada.\n\n'+
    '¿Continuar?'
  );
  if(!ok){
    console.log('limpiarCamposObsoletos: cancelado por el usuario');
    return false;
  }
  const del=window._fsDeleteField();
  try{
    for(const depto of DEPTOS_FIRESTORE){
      const ref=window._fsDoc(db,'departamentos',depto);
      await window._fsSetDoc(ref,{expedientes:del,pqrsd:del},{merge:true});
      console.log('limpiarCamposObsoletos OK:',ref.path);
    }
    console.log('limpiarCamposObsoletos: completado en',DEPTOS_FIRESTORE.join(', '));
    return true;
  }catch(err){
    console.error('limpiarCamposObsoletos:',err);
    return false;
  }
}
async function persistExpedienteDelete(expRef){
  if(!expRef)return {ok:false,error:{msg:'Sin referencia de expediente'}};
  const expId=expedienteDocId(expRef);
  const depto=resolveDeptoFirestoreId(deptoActivo,expRef);
  updateSyncIndicator('syncing');
  try{
    const ok=await deleteExpedienteDoc(depto,expRef);
    updateSyncIndicator(ok?'synced':'error');
    if(ok){
      purgeExpFromLocalStorageCache(expId);
      return {ok:true};
    }
    return {ok:false,error:window._lastFsSaveError||{msg:'Error al eliminar en Firestore'}};
  }catch(err){
    updateSyncIndicator('error');
    return {ok:false,error:{code:err&&err.code,msg:err&&err.message||String(err)}};
  }
}

async function saveFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc||_localSaving)return;
  _localSaving=true;
  updateSyncIndicator('syncing');
  try{
    syncCfgToStore();
    const bandejaPay=typeof buildBandejaEstadoPayloadForSave==='function'?buildBandejaEstadoPayloadForSave():{
      bandejaLeidos:typeof getBandejaLeidos==='function'?getBandejaLeidos():[],
      bandejaEliminados:typeof getBandejaEliminados==='function'?getBandejaEliminados():[]
    };
    const refGlobal=window._fsDoc(db,'sistema','global');
    let libresGlobal=(actividadesLibres||[]).slice();
    if(window._fsGetDoc){
      const remotoLibres=await actLibresRemotoPreferido();
      if(remotoLibres==null){
        window._lastFsSaveError={code:'unavailable',msg:'No se leyó la lista remota de actividades; no se sobrescribe'};
        updateSyncIndicator('error');
        return;
      }
      libresGlobal=mergeActLibresConRemotoParaGuardar(libresGlobal,remotoLibres);
    }
    const payload={
      personas:personas||[],
      actividadesLibres:libresGlobal,
      agendaEventos:agendaEventos||[],
      bandejaLeidosByUser:bandejaPay.bandejaLeidosByUser||{},
      bandejaEliminadosByUser:bandejaPay.bandejaEliminadosByUser||{},
      encargadosGlobal:normalizeEncargadosGlobal(encargadosGlobal),
      mantenimiento:typeof normalizeMantenimiento==='function'?normalizeMantenimiento(mantenimientoEstado):mantenimientoEstado||{activo:false},
      updatedAt:new Date().toISOString()
    };
    if(typeof puedePersistirUsuariosIndexGlobal==='function'?puedePersistirUsuariosIndexGlobal():(typeof esVistaUsuariosAdminCompleta==='function'&&esVistaUsuariosAdminCompleta()&&(_usuariosCache||[]).length)){
      payload.usuariosIndex=_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
        cargo:String(u.cargo||'').trim().toLowerCase(),
        activo:u.activo!==false,
        deptoResponsable:String(u.deptoResponsable||'').trim()
      }));
    }
    quitarBandejaCompartidaDelPayload(payload);
    await moverCamposAPartes(payload);
    await window._fsSetDoc(refGlobal,payload,{merge:true});
    for(const depto of DEPTOS_FIRESTORE){
      await window._fsSetDoc(window._fsDoc(db,'departamentos',depto),{
        cfg:cfgByDepto[depto]||{},
        updatedAt:new Date().toISOString()
      },{merge:true});
    }
    updateSyncIndicator('synced');
  }catch(err){
    console.error('Error guardando Firestore:',err);
    updateSyncIndicator('error');
  }
  setTimeout(()=>{_localSaving=false;},1500);
}
function saveLS(){
  // LEGACY: usar solo para cambios de cfg/chat/agenda/personas.
  // No usar para mutaciones de expedientes individuales.
  purgeRetencionDatosLeidos();
  try{
    _saveLSLocal();
    checkLocalStorageCapacityAfterSave();
    updateSyncIndicator('syncing');
    const fsPromises=[saveGlobalFirestore()];
    const deptoMeta=deptoCfg||deptoActivo||'';
    if(DEPTOS_FIRESTORE.includes(deptoMeta))fsPromises.push(saveDeptMeta(deptoMeta));
    Promise.all(fsPromises).then(function(results){
      updateSyncIndicator(results.every(r=>r!==false)?'synced':'error');
    }).catch(function(){
      updateSyncIndicator('error');
    });
  }catch(e){
    if(isQuotaExceededError(e)){
      showStorageFullBanner();
      console.error('QuotaExceededError: almacenamiento local lleno; los datos NO se guardaron.',e);
    }else{
      console.error('Error al guardar en localStorage:',e);
    }
  }
}
function saveCfg(){saveLS();}
async function persistCfgDepto(deptoId){
  deptoId=String(deptoId||'').trim();
  if(!deptoId||!DEPTOS_FIRESTORE.includes(deptoId))return false;
  syncCfgToStore();
  try{_saveLSLocal();}catch(e){}
  _localSaving=true;
  try{
    return await saveDeptMeta(deptoId);
  }finally{
    setTimeout(function(){_localSaving=false;},1500);
  }
}
// updateSyncIndicator → js/utils.js
function renderTabActual(){
  const pg=document.querySelector('.pg.on');
  if(!pg)return;
  const id=pg.id||'';
  if(id==='pg-reg')renderTabla();
  else if(id==='pg-con'){poblarFiltrosCon();renderConsulta();}
  else if(id==='pg-cons')renderConsolidado();
  else if(id==='pg-act')renderActividades();
  else if(id==='pg-cfg')renderCfg();
  else if(id==='pg-sec'){poblarSecOficinaSelect();renderSecretariaPqrs();}
  else if(id==='pg-pqrs-ofi')renderPqrsOficinaInbox();
  else if(id==='pg-gmail-ofi'){if(typeof gmailOfiInitPanel==='function')gmailOfiInitPanel();}
  else if(id==='pg-agenda')renderAgenda();
  renderChatBadge();
  renderBandejaDepto();
}
function refreshViewsAfterRemoteDataChange(){
  try{
    if(typeof poblarSelResponsable==='function')poblarSelResponsable();
    // renderTabActual ya pinta la pestaña activa (Actividades, Consulta, Secretaría, Oficina) y la bandeja.
    if(typeof renderTabActual==='function')renderTabActual();
    else if(typeof renderTabla==='function')renderTabla();
    if(typeof chatRefreshContactsIfOpen==='function')chatRefreshContactsIfOpen();
    const sideExp=window._pqrsSideExp;
    if(sideExp&&typeof openPqrsSidePanel==='function')openPqrsSidePanel(sideExp);
    const conExp=window._conPanelActive;
    if(conExp&&typeof renderConSidePanel==='function')renderConSidePanel();
  }catch(e){console.warn('refreshViewsAfterRemoteDataChange:',e);}
}
/**
 * Snapshots remotos llegan en ráfagas (varios deptos, cfg, global): un solo repintado por ráfaga.
 * Con un <select> enfocado se espera a change/blur: repintar con la lista abierta la deja gris en Chrome.
 */
let _sstRemoteRefreshTimer=null;
function scheduleRefreshViewsAfterRemoteDataChange(){
  if(_sstRemoteRefreshTimer)clearTimeout(_sstRemoteRefreshTimer);
  _sstRemoteRefreshTimer=setTimeout(function(){
    _sstRemoteRefreshTimer=null;
    const sel=document.activeElement;
    if(sel&&sel.tagName==='SELECT'){
      if(sel._sstRefreshPend)return;
      sel._sstRefreshPend=true;
      const go=function(){
        sel.removeEventListener('change',go);
        sel.removeEventListener('blur',go);
        sel._sstRefreshPend=false;
        setTimeout(refreshViewsAfterRemoteDataChange,0);
      };
      sel.addEventListener('change',go);
      sel.addEventListener('blur',go);
      return;
    }
    refreshViewsAfterRemoteDataChange();
  },400);
}
const EXP_PRIMER_SNAP_TOPE_MS=10000;
/** depto → {p,listo}: primera respuesta del servidor a la escucha de expedientes. */
let _expPrimerSnap={};
function esperarPrimerSnapExpedientes(deptos,ms){
  const ps=(deptos||[]).map(function(d){return _expPrimerSnap[d]&&_expPrimerSnap[d].p;});
  if(!ps.length||ps.some(function(p){return !p;}))return Promise.resolve(false);
  return Promise.race([
    Promise.all(ps).then(function(r){return r.every(Boolean);}),
    new Promise(function(res){setTimeout(function(){res(false);},ms);})
  ]);
}
function stopRealtimeExpSync(){
  Object.keys(_expPrimerSnap).forEach(function(d){_expPrimerSnap[d].listo(false);});
  _expPrimerSnap={};
  if(!_fsUnsub)return;
  if(Array.isArray(_fsUnsub))_fsUnsub.forEach(function(u){try{u();}catch(e){}});
  else try{_fsUnsub();}catch(e){}
  _fsUnsub=null;
}
function stopRealtimeCfgSync(){
  if(_cfgUnsub){try{_cfgUnsub();}catch(e){}_cfgUnsub=null;}
  if(_cfgAllUnsubs&&_cfgAllUnsubs.length){
    _cfgAllUnsubs.forEach(function(u){try{u();}catch(e){}});
    _cfgAllUnsubs=[];
  }
}
function stopRealtimeGlobalSync(){
  if(_globalUnsub){try{_globalUnsub();}catch(e){}_globalUnsub=null;}
  const partes=window._sstParteUnsubs;
  if(partes&&partes.length){
    partes.forEach(function(u){try{u();}catch(e){}});
    window._sstParteUnsubs=[];
  }
  window._sstPartesVivas={};
  if(window._personasUnsub){try{window._personasUnsub();}catch(e){}window._personasUnsub=null;}
}
function stopAllRealtimeSync(){
  stopRealtimeExpSync();
  stopRealtimeCfgSync();
  stopRealtimeGlobalSync();
  if(typeof stopUsuariosFirestoreListener==='function')stopUsuariosFirestoreListener();
  if(typeof detenerBandejaEstadoUsuario==='function')detenerBandejaEstadoUsuario();
  if(typeof stopSessionGuard==='function')stopSessionGuard();
}
function desuscribirCfgSync(){
  // Los listeners de configuración son globales durante la sesión; no se detienen al cambiar pestaña.
}
/** Cambio de actividades libres que llegó mientras esta sesión guardaba: se aplica al terminar (no se pierde). */
const _actLibresSnapDiferidos={};
function cancelarActLibresSnapDiferido(clave){
  const h=_actLibresSnapDiferidos[clave];
  if(h){clearTimeout(h);delete _actLibresSnapDiferidos[clave];}
}
function diferirActLibresSnap(clave,lista,esDepto){
  if(!Array.isArray(lista)||!lista.length)return;
  cancelarActLibresSnapDiferido(clave);
  _actLibresSnapDiferidos[clave]=setTimeout(function(){
    delete _actLibresSnapDiferidos[clave];
    if(_localSaving){diferirActLibresSnap(clave,lista,esDepto);return;}
    const rem=actLibresRemotoCombinado(clave,lista);
    actividadesLibres=esDepto&&typeof upsertActividadesLibresFromRemote==='function'
      ?upsertActividadesLibresFromRemote(rem)
      :mergeActividadesLibresFromRemote(rem);
    try{_saveLSLocal();}catch(e){}
    scheduleRefreshViewsAfterRemoteDataChange();
  },2500);
}
function onRemoteCfgSnapshot(deptoId,snap){
  if(_localSaving){
    if(snap.exists())diferirActLibresSnap('depto:'+deptoId,(snap.data()||{}).actividadesLibres,true);
    return;
  }
  cancelarActLibresSnapDiferido('depto:'+deptoId);
  if(!snap.exists())return;
  const data=snap.data();
  let changed=false;
  if(data&&data.cfg){
    cfgByDepto[deptoId]=normalizeCfgObj(data.cfg);
    if(deptoCfg===deptoId)setCfgPtr(deptoId);
    changed=true;
  }
  if(data&&Array.isArray(data.actividadesLibres)){
    const remD=actLibresRemotoCombinado('depto:'+deptoId,data.actividadesLibres);
    actividadesLibres=typeof upsertActividadesLibresFromRemote==='function'
      ?upsertActividadesLibresFromRemote(remD)
      :mergeActividadesLibresFromRemote(remD);
    changed=true;
  }
  if(!changed)return;
  try{_saveLSLocal();}catch(e){}
  scheduleRefreshViewsAfterRemoteDataChange();
}
function initRealtimeCfgSyncAll(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsDoc)return;
  if(_cfgAllUnsubs&&_cfgAllUnsubs.length)return;
  stopRealtimeCfgSync();
  DEPTOS_FIRESTORE.forEach(function(deptoId){
    const unsub=window._fsOnSnapshot(window._fsDoc(db,'departamentos',deptoId),function(snap){
      onRemoteCfgSnapshot(deptoId,snap);
    },function(err){console.warn('Error escuchando cfg',deptoId,err);});
    _cfgAllUnsubs.push(unsub);
  });
}
function suscribirCfgSync(deptoId){
  initRealtimeCfgSyncAll();
}
function mergeActividadesLibresFromRemote(remote){
  const rem=Array.isArray(remote)?remote:[];
  // Wipe / lista vacía en Firestore: limpiar caché local y no resucitar
  if(!rem.length)return clearActividadesLibresLocalCache();
  const local=Array.isArray(actividadesLibres)?actividadesLibres:[];
  const byId=new Map();
  const score=typeof scoreActividadLibreMerge==='function'?scoreActividadLibreMerge:function(t){
    if(!t)return 0;
    let s=0;
    if(t.eliminada)s+=50;
    if(String(t.estado||'')==='Por corregir')s+=12;
    if(t.fechaReportada||t.estado==='Por verificar')s+=4;
    if((t.soportes||[]).length)s+=2;
    if(t.fechaAtendida||t.estado==='Atendida')s+=3;
    if(t._pending_fs_sync)s+=5;
    if(t.origen==='responsable'||t.autoAsignadaPorResponsable)s+=1;
    if(t.firmaWf&&t.firmaWf.fase)s+=20;
    return s;
  };
  rem.forEach(function(t){
    if(!t||!t.id)return;
    byId.set(String(t.id),t);
  });
  // Solo conservar locales ausentes en remoto si hay sync pendiente reciente (no resucitar borrados)
  local.forEach(function(t){
    if(!t||!t.id)return;
    const id=String(t.id);
    if(!byId.has(id)){
      if(actLibreKeepLocalOnly(t))byId.set(id,t);
      return;
    }
    const remT=byId.get(id);
    const best=typeof pickMejorActLibre==='function'?pickMejorActLibre(t,remT):(score(t)>score(remT)?t:remT);
    byId.set(id,best);
  });
  if(window._pendingActLibreEntrega&&window._pendingActLibreEntrega.t&&window._pendingActLibreEntrega.id){
    const pid=String(window._pendingActLibreEntrega.id);
    const pend=window._pendingActLibreEntrega.t;
    const cur=byId.get(pid);
    byId.set(pid,typeof pickMejorActLibre==='function'?pickMejorActLibre(pend,cur):(pend||cur));
  }
  return Array.from(byId.values()).map(function(t){
    if(typeof normalizeActLibre==='function'){
      try{return normalizeActLibre(t);}catch(e){return t;}
    }
    return t;
  });
}

/** Sube a Firestore actividades libres locales que el encargado aún no ve (sync fallido / rules). */
async function syncPendingActividadesLibresToFirestore(){
  const local=Array.isArray(actividadesLibres)?actividadesLibres:[];
  const need=local.some(function(t){
    if(!t||t.eliminada)return false;
    return !!t._pending_fs_sync;
  });
  if(!need)return false;
  const persistFn=typeof persistActividadesLibresFirestore==='function'?persistActividadesLibresFirestore:saveGlobalFirestore;
  if(typeof persistFn!=='function')return false;
  const ok=await persistFn();
  if(ok&&typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  return !!ok;
}
window.syncPendingActividadesLibresToFirestore=syncPendingActividadesLibresToFirestore;

const GLOBAL_AVISO_KB=800;
/** sistema/global admite 1 MB (también en Blaze): avisar con tiempo a quien puede gestionarlo. */
function avisarTamanoGlobalSiCrece(g){
  if(window._globalAvisoTamanoMostrado)return;
  const rol=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  if(!((typeof esAdministrador==='function'&&esAdministrador())||rol==='guaviare'))return;
  let kb=0;
  try{kb=Math.round(JSON.stringify(g||{}).length/1024);}catch(e){return;}
  window._sstGlobalKB=kb;
  if(kb<GLOBAL_AVISO_KB)return;
  window._globalAvisoTamanoMostrado=true;
  if(typeof notif==='function')notif('⚠️ El documento global de Firebase ocupa '+kb+' KB de 1.024 KB. Avise a soporte antes de que se llene: al llegar al límite dejan de guardarse personas, agenda y actividades libres.','warn');
}
function initRealtimeGlobalSync(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsDoc)return;
  if(_globalUnsub)return;
  _globalUnsub=window._fsOnSnapshot(window._fsDoc(db,'sistema','global'),function(snap){
    if(_localSaving){
      if(snap.exists())diferirActLibresSnap('global',(snap.data()||{}).actividadesLibres,false);
      return;
    }
    cancelarActLibresSnapDiferido('global');
    if(!snap.exists())return;
    const g=snap.data()||{};
    avisarTamanoGlobalSiCrece(g);
    if(g.bandejaMarcasListas)window._bandejaMarcasListas=true;
    let changed=false;
    if(g.mantenimiento&&typeof setMantenimientoEstadoLocal==='function'){
      setMantenimientoEstadoLocal(g.mantenimiento);
    }
    if(g.encargadosGlobal){
      encargadosGlobal=normalizeEncargadosGlobal(g.encargadosGlobal);
      if(typeof syncEncargadosGlobalToInstructores==='function')syncEncargadosGlobalToInstructores();
      changed=true;
    }
    if(Array.isArray(g.personas)&&g.personas.length&&!parteGlobalViva('personas')){
      personas=g.personas.map(normalizePersonaRecord);
      changed=true;
    }
    if(Array.isArray(g.usuariosIndex)&&g.usuariosIndex.length&&typeof aplicarUsuariosIndex==='function'){
      const cur=(typeof _usuariosCache!=='undefined'&&_usuariosCache)?_usuariosCache.length:0;
      const partial=typeof _usuariosCachePartial!=='undefined'&&_usuariosCachePartial;
      if(!cur||g.usuariosIndex.length>=cur||partial){
        aplicarUsuariosIndex(g.usuariosIndex);
        if(typeof schedulePaintUsuariosCfgTable==='function')schedulePaintUsuariosCfgTable();
        else if(typeof paintUsuariosCfgTable==='function')paintUsuariosCfgTable();
        changed=true;
      }
    }
    if(Array.isArray(g.actividadesLibres)&&!parteGlobalViva('actividadesLibres')){
      actividadesLibres=mergeActividadesLibresFromRemote(actLibresRemotoCombinado('global',g.actividadesLibres));
      changed=true;
    }
    if(Array.isArray(g.agendaEventos)&&!parteGlobalViva('agendaEventos')){agendaEventos=g.agendaEventos;changed=true;if(typeof depurarAgendaAlmacenada==='function')depurarAgendaAlmacenada();}
    if(typeof ncaPqrsPinsApplyFromGlobal==='function'&&!parteGlobalViva('ncaPinsByUser')&&ncaPqrsPinsApplyFromGlobal(g))changed=true;
    if(changed){
      try{_saveLSLocal();}catch(e){}
      scheduleRefreshViewsAfterRemoteDataChange();
    }
  },function(err){console.warn('Error escuchando sistema/global:',err);});
  escucharPartesSistema();
  escucharPersonasColeccion();
}
function consolidadoBuscaPorCorte(){
  return (typeof esNcaDeguv==='function'&&esNcaDeguv())
    ||(typeof esJurisdiccional==='function'&&esJurisdiccional());
}
function consTramiteBusqueda(){
  try{
    if(typeof document!=='undefined'&&document.getElementById){
      const el=document.getElementById('cons-tram');
      if(el)return String(el.value||'').trim();
    }
  }catch(e){}
  return String(window._consBuscaTram||'').trim();
}
function consClaveBusqueda(rango){
  const d=rango&&rango.desde||'';
  const h=rango&&rango.hasta||'';
  return d+'|'+h+'|'+(typeof consTramiteBusqueda==='function'?consTramiteBusqueda():'');
}
function consErrorEsIndice(err){
  const code=String(err&&err.code||'');
  const msg=String(err&&err.message||'');
  return code==='failed-precondition'||/requires an index/i.test(msg);
}
function asegurarEscuchaConsolidado(){
  if(consolidadoBuscaPorCorte())return;
  if(window._consEscuchaCompleta)return;
  window._consEscuchaCompleta=true;
  initRealtimeSync();
  if(typeof reloadExpedientesTrasLogin==='function')reloadExpedientesTrasLogin();
}
/** Encargado NCA y jurisdiccional: una lectura solo de los expedientes radicados en el corte. */
async function buscarConsolidadoNca(){
  if(!consolidadoBuscaPorCorte()){
    if(typeof renderConsolidado==='function')renderConsolidado();
    return;
  }
  const rango=typeof getPeriodoRango==='function'?getPeriodoRango('cons'):null;
  if(!rango||!rango.desde||rango.desde==='0000-01-01'||!rango.hasta||rango.hasta==='9999-12-31'){
    window._consNcaList=null;
    window._consNcaRango='';
    if(typeof renderConsolidadoNcaEspera==='function')renderConsolidadoNcaEspera();
    else if(typeof renderConsolidado==='function')renderConsolidado();
    if(typeof notif==='function')notif('Elija un año, trimestre, mes o un rango de fechas','warn');
    return;
  }
  const db=window._db;
  if(!db||!window._fsGetDocs||!window._fsQuery||!window._fsWhere||!window._fsCollection){
    if(typeof notif==='function')notif('No hay conexión para buscar el consolidado','err');
    return;
  }
  const activos=typeof deptosExpedientesAccesibles==='function'?deptosExpedientesAccesibles():['guaviare'];
  let deptos;
  if(typeof esJurisdiccional==='function'&&esJurisdiccional()){
    const fd=String(window._jurisFiltroDepto||'').trim();
    deptos=fd?[fd]:activos;
  }else{
    deptos=[String((typeof deptoActivo!=='undefined'&&deptoActivo)||'guaviare').trim()||'guaviare'];
  }
  if(!deptos.length)deptos=['guaviare'];
  const hasta=String(rango.hasta);
  const tope=hasta.length===10?hasta+'\uf8ff':hasta;
  const tram=consTramiteBusqueda();
  const list=[];
  let faltaIndice=false;
  try{
    for(let i=0;i<deptos.length;i++){
      const depto=deptos[i];
      let snap;
      try{
        const filtros=[];
        if(tram)filtros.push(window._fsWhere('_tramite','==',tram));
        filtros.push(window._fsWhere('_fecha','>=',rango.desde));
        filtros.push(window._fsWhere('_fecha','<=',tope));
        snap=await window._fsGetDocs(window._fsQuery(
          window._fsCollection(db,'departamentos',depto,'expedientes'),
          ...filtros
        ));
      }catch(errDepto){
        if(tram&&consErrorEsIndice(errDepto))faltaIndice=true;
        console.warn('buscarConsolidadoNca',depto,errDepto);
        continue;
      }
      if(!snap||typeof snap.forEach!=='function')continue;
      snap.forEach(function(d){
        const data=d.data?d.data()||{}:{};
        const exp=typeof mergeExpFromFirestoreSnapshot==='function'?mergeExpFromFirestoreSnapshot(data,d.id):Object.assign({},data,{_exp:d.id});
        if(!exp)return;
        if(!exp._depto)exp._depto=depto;
        if(typeof expEstaEnPapelera==='function'&&expEstaEnPapelera(exp))return;
        list.push(exp);
      });
    }
    if(faltaIndice){
      window._consNcaList=null;
      window._consNcaRango='';
      if(typeof renderConsolidadoNcaEspera==='function')renderConsolidadoNcaEspera();
      else if(typeof renderConsolidado==='function')renderConsolidado();
      if(typeof notif==='function')notif('Para leer solo ese tipo de trámite hay que activar el índice una sola vez: F12, enlace de Firestore, abrirlo. En unos minutos, pulse Buscar de nuevo.','err');
      return;
    }
    window._consNcaList=list;
    window._consNcaRango=consClaveBusqueda(rango);
    if(typeof renderConsolidado==='function')renderConsolidado();
  }catch(err){
    console.warn('buscarConsolidadoNca',err);
    if(typeof notif==='function')notif('No se pudo buscar el consolidado','err');
  }
}
function initAppRealtimeSync(){
  initRealtimeSync();
  setTimeout(function(){if(typeof asegurarMarcasBandeja==='function')asegurarMarcasBandeja();},1500);
  initRealtimeCfgSyncAll();
  initRealtimeGlobalSync();
  if(typeof startUsuariosFirestoreListener==='function')startUsuariosFirestoreListener();
  if(typeof iniciarBandejaEstadoUsuario==='function')iniciarBandejaEstadoUsuario();
}
function mergeExpFromFirestoreSnapshot(data,docId){
  const expId=String((data&&data._exp)||(data&&data.id)||docId||'').trim();
  if(!expId)return null;
  return{...data,_exp:expId,id:expId};
}
/** Remoto ya devolvió a corregir / limpió firma: no resucitar «Por firmar» desde caché local. */
function taskRemotoDevueltoACorregir(rem){
  if(!rem)return false;
  if(String(rem.estado||'')==='Por corregir')return true;
  if((rem.asignados||[]).some(function(a){return a&&a.estado==='por_corregir';}))return true;
  return (rem.historial||[]).some(function(h){
    return h&&(h.tipo==='devolver_desde_firma'||h.tipo==='ajuste_soporte'||h.tipo==='notif_devuelta_corregir'
      ||h.tipo==='devuelto_director_firma'||h.tipo==='revision_nca_rechazado');
  });
}
/** Fusiona tasks local/remoto: conserva eliminadas locales y firmaWf más avanzado. */
function mergeExpedienteTasksLocalRemote(localTasks,remoteTasks){
  const byId=new Map();
  const put=function(t){
    if(!t||!t.id)return;
    const id=String(t.id).trim();
    if(!id)return;
    const nt=typeof normalizeTask==='function'?normalizeTask(Object.assign({},t)):Object.assign({},t);
    byId.set(id,nt);
  };
  (remoteTasks||[]).forEach(put);
  (localTasks||[]).forEach(function(t){
    if(!t||!t.id)return;
    const id=String(t.id).trim();
    const rem=byId.get(id);
    if(!rem){put(t);return;}
    if(t.eliminada&&!rem.eliminada){put(t);return;}
    if(rem.eliminada&&!t.eliminada)return;
    // Sync local pendiente (marcadores / entrega en curso): conservar local
    if(t._pending_fs_sync){put(t);return;}
    const lf=String((t.firmaWf&&t.firmaWf.fase)||'').trim();
    const rf=String((rem.firmaWf&&rem.firmaWf.fase)||'').trim();
    // Encargado devolvió desde Por firmar: remoto deja fase vacía + Por corregir.
    // Antes se resuscitaba firmaWf local y VITAL seguía viéndola hasta F5.
    if(lf&&!rf){
      if(taskRemotoDevueltoACorregir(rem))return;
      put(Object.assign({},rem,t,{firmaWf:t.firmaWf,requiereFirma:t.requiereFirma||rem.requiereFirma}));
      return;
    }
    // Empate: conservar el más reciente por historial / fechaReportada
    const lh=(t.historial&&t.historial.length)||0;
    const rh=(rem.historial&&rem.historial.length)||0;
    if(lh>rh||(t.eliminada&&rem.eliminada))put(t);
  });
  return Array.from(byId.values());
}
function applyExpedienteFirestoreChanges(changes){
  if(!changes||!changes.length)return false;
  let changed=false;
  changes.forEach(function(change){
    if(change.type==='removed'){
      const expId=String(change.doc.id||'').trim();
      if(!expId)return;
      const before=(exps||[]).length;
      exps=(exps||[]).filter(function(e){return String(e._exp||'').trim()!==expId;});
      if(exps.length!==before)changed=true;
      return;
    }
    // Eco del propio guardado: la copia en memoria ya es la más reciente y puede seguir mutándose
    if(change.doc.metadata&&change.doc.metadata.hasPendingWrites
      &&(exps||[]).some(function(e){return String(e._exp||'').trim()===String(change.doc.id||'').trim();}))return;
    const exp=mergeExpFromFirestoreSnapshot(change.doc.data(),change.doc.id);
    if(!exp)return;
    const idx=(exps||[]).findIndex(function(e){return String(e._exp||'').trim()===exp._exp;});
    if(idx>=0){
      const local=exps[idx];
      // No pisar una copia local más reciente (p. ej. recién radicada con tasks)
      // con un snapshot remoto incompleto o anterior.
      const remoteAt=String(exp.updatedAt||'');
      const localAt=String(local.updatedAt||local._pending_fs_at||'');
      const localTasks=(local.tasks&&local.tasks.length)||0;
      const remoteTasks=(exp.tasks&&exp.tasks.length)||0;
      if(localAt&&remoteAt&&localAt>remoteAt&&localTasks>remoteTasks)return;
      if(local._pending_fs_sync&&localTasks>remoteTasks)return;
      // Fusionar tasks: no revivir eliminadas locales ni perder firmaWf
      const merged=Object.assign({},exp);
      merged.tasks=mergeExpedienteTasksLocalRemote(local.tasks,exp.tasks);
      if(local._pending_fs_sync){
        merged._pending_fs_sync=true;
        merged._pending_fs_at=local._pending_fs_at||merged.updatedAt;
      }
      exps[idx]=merged;
    }else{
      exps.push(exp);
    }
    changed=true;
  });
  return changed;
}
function hydrateExpsFromSnapshotDocs(snap){
  if(!snap||!snap.docs||!snap.docs.length)return false;
  let changed=false;
  snap.docs.forEach(function(doc){
    const exp=mergeExpFromFirestoreSnapshot(doc.data(),doc.id);
    if(!exp)return;
    const idx=(exps||[]).findIndex(function(e){return String(e._exp||'').trim()===exp._exp;});
    if(idx>=0){
      const local=exps[idx];
      if(local&&local._pending_fs_sync){
        // Conservar eliminaciones / firma locales pendientes de sync
        exp.tasks=mergeExpedienteTasksLocalRemote(local.tasks,exp.tasks);
        exp._pending_fs_sync=true;
        exp._pending_fs_at=local._pending_fs_at;
      }else if(local&&local.tasks&&local.tasks.length){
        exp.tasks=mergeExpedienteTasksLocalRemote(local.tasks,exp.tasks);
      }
      exps[idx]=exp;
    }else{
      exps.push(exp);
    }
    changed=true;
  });
  return changed;
}
function corteBandejaIso(){
  const d=new Date();
  d.setDate(d.getDate()-10);
  return d.toISOString();
}
function escucharConsultaDepto(db,depto,unsubs,filtro){
  let ref=window._fsCollection(db,'departamentos',depto,'expedientes');
  if(filtro&&window._fsQuery&&window._fsWhere){
    if(filtro.tipo==='updated')ref=window._fsQuery(ref,window._fsWhere('updatedAt','>=',filtro.desde));
    else if(filtro.tipo==='bool')ref=window._fsQuery(ref,window._fsWhere(filtro.campo,'==',true));
    else if(filtro.tipo==='nombre')ref=window._fsQuery(ref,window._fsWhere('pendientes','array-contains',filtro.nombre));
  }
  let listo=null;
  if(filtro&&filtro.tipo==='updated'){
    _expPrimerSnap[depto]={p:new Promise(function(res){listo=res;}),listo:function(ok){listo(ok);}};
  }
  const primer=_expPrimerSnap[depto];
  const unsub=window._fsOnSnapshot(ref,function(snap){
    let changed=applyExpedienteFirestoreChanges(snap.docChanges());
    if((!exps||!exps.length)&&snap.docs&&snap.docs.length){
      if(hydrateExpsFromSnapshotDocs(snap))changed=true;
    }
    if(primer&&filtro&&filtro.tipo==='updated'&&!(snap.metadata&&snap.metadata.fromCache))primer.listo(true);
    if(!changed)return;
    scheduleRefreshViewsAfterRemoteDataChange();
  },function(err){
    if(primer&&filtro&&filtro.tipo==='updated')primer.listo(false);
    console.warn('Error escuchando expedientes',depto,filtro&&filtro.tipo,err);
  });
  unsubs.push(unsub);
}
function initRealtimeSync(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  stopRealtimeExpSync();
  const unsubs=[];
  const rolLogin=String((window._usuarioActual&&window._usuarioActual.rol)||'').trim();
  if((rolLogin==='admin'||rolLogin==='jurisdiccional')&&!window._consEscuchaCompleta){
    _fsUnsub=[];
    return;
  }
  const acotar=!!(window._bandejaMarcasListas&&window._fsQuery&&window._fsWhere&&!window._consEscuchaCompleta);
  const deptos=typeof deptosExpedientesAccesibles==='function'?deptosExpedientesAccesibles():['guaviare'];
  if(acotar){
    const nombre=String((typeof responsableActivo!=='undefined'&&responsableActivo)||(window._usuarioActual&&window._usuarioActual.nombre)||'').trim();
    const cargo=typeof usuarioCargoSesion==='function'?usuarioCargoSesion():'';
    const esResp=rolLogin==='responsables'||rolLogin==='contratista';
    const esOficina=rolLogin==='secretaria'||rolLogin==='oap_deguv'||rolLogin==='rn_deguv'||rolLogin==='admin_deguv'||rolLogin==='ds_deguv';
    const verReq=!esResp||cargo==='coordinador'||cargo==='contable';
    deptos.forEach(function(depto){
      escucharConsultaDepto(db,depto,unsubs,{tipo:'updated',desde:corteBandejaIso()});
      if(!esResp&&!esOficina)escucharConsultaDepto(db,depto,unsubs,{tipo:'bool',campo:'seguimiento'});
      if(!esOficina&&verReq)escucharConsultaDepto(db,depto,unsubs,{tipo:'bool',campo:'reqAlerta'});
      if(esOficina)escucharConsultaDepto(db,depto,unsubs,{tipo:'bool',campo:'esPqrs'});
      if(esResp&&nombre)escucharConsultaDepto(db,depto,unsubs,{tipo:'nombre',nombre:nombre});
    });
    _fsUnsub=unsubs;
    return;
  }
  const TOPE=8000;
  function escuchar(depto, acotada){
    let ref=window._fsCollection(db,'departamentos',depto,'expedientes');
    if(acotada&&window._fsQuery&&window._fsWhere){
      const corte=new Date();
      corte.setMonth(corte.getMonth()-36);
      ref=window._fsQuery(ref, window._fsWhere('updatedAt','>=', corte.toISOString()));
    }
    if(!acotada){
      let listo;
      _expPrimerSnap[depto]={p:new Promise(function(res){listo=res;}),listo:function(ok){listo(ok);}};
    }
    const primer=_expPrimerSnap[depto];
    const unsub=window._fsOnSnapshot(ref,function(snap){
      const n=(snap&&(typeof snap.size==='number'?snap.size:(snap.docs&&snap.docs.length)))||0;
      if(!acotada&&!window._consEscuchaCompleta&&n>TOPE&&window._fsQuery&&window._fsWhere){
        try{unsub();}catch(e){}
        window._expEscuchaAcotada=true;
        if(Array.isArray(exps))exps=exps.filter(function(e){return String(e&&e._depto||'')!==depto;});
        escuchar(depto,true);
        return;
      }
      // No bloquear por _localSaving: ese flag es de cfg/global y retrasaba
      // la aparición de PQRSD recién radicadas en Actividades/Consulta (~1–3 min).
      let changed=applyExpedienteFirestoreChanges(snap.docChanges());
      // Si la caché quedó vacía (p. ej. loadLS tardío la borró), rehidratar
      // desde snap.docs — docChanges() no vuelve a emitir 'added' ya aplicados.
      if((!exps||!exps.length)&&snap.docs&&snap.docs.length){
        if(hydrateExpsFromSnapshotDocs(snap))changed=true;
      }
      if(primer&&!(snap.metadata&&snap.metadata.fromCache))primer.listo(true);
      if(!changed)return;
      scheduleRefreshViewsAfterRemoteDataChange();
    },function(err){
      if(primer)primer.listo(false);
      console.warn('Error escuchando expedientes',depto,err);
    });
    unsubs.push(unsub);
  }
  deptosExpedientesAccesibles().forEach(function(depto){escuchar(depto,false);});
  _fsUnsub=unsubs;
}
function repararMarcaExpediente(exp){
  if(!exp||!exp._exp||!window._db||!window._fsSetDoc||!window._fsDoc)return;
  const antes=JSON.stringify([exp.pendientes||[],!!exp.seguimiento,!!exp.reqAlerta,!!exp.esPqrs]);
  aplicarMarcasBandeja(exp);
  const despues=JSON.stringify([exp.pendientes||[],!!exp.seguimiento,!!exp.reqAlerta,!!exp.esPqrs]);
  if(antes===despues)return;
  const depto=String(exp._depto||'guaviare').trim();
  window._fsSetDoc(window._fsDoc(window._db,'departamentos',depto,'expedientes',exp._exp),{
    pendientes:exp.pendientes,seguimiento:!!exp.seguimiento,reqAlerta:!!exp.reqAlerta,esPqrs:!!exp.esPqrs
  },{merge:true}).catch(function(err){console.warn('repararMarcaExpediente',err);});
}
async function traerExpedienteSiFalta(q){
  const id=String(q||'').trim();
  if(!id||id.length<4||typeof fetchExpedientePorNumero!=='function')return null;
  const ya=(exps||[]).find(function(e){return String(e&&e._exp||'').toLowerCase()===id.toLowerCase();});
  if(ya){repararMarcaExpediente(ya);return ya;}
  const exp=await fetchExpedientePorNumero(id);
  if(!exp||!exp._exp)return null;
  if(!Array.isArray(exps))exps=[];
  if(!exps.some(function(e){return String(e&&e._exp||'')===String(exp._exp);}))exps.push(exp);
  repararMarcaExpediente(exp);
  return exp;
}
async function migrarLocalStorageAFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsGetDocs||!window._fsCollection||!window._fsDoc){notif('Firebase no disponible','err');return;}
  if(!confirm('¿Migrar datos locales a Firestore?\n\nSolo se subirán los registros que NO existen en Firestore (fusión inteligente — no se sobreescriben datos existentes).'))return;
  notif('⏳ Iniciando migración…','info');
  try{
    // 1. Load local records
    const localExps=lsLoadJson('sst_e')||[];
    if(!localExps.length){notif('No hay registros locales para migrar.','info');return;}

    // 2. Get all existing IDs from Firestore per department
    const existingIds=new Set();
    for(const depto of DEPTOS_FIRESTORE){
      try{
        const snap=await window._fsGetDocs(window._fsCollection(db,'departamentos',depto,'expedientes'));
        snap.forEach(d=>existingIds.add(d.id));
      }catch(e){/* access denied for this depto — skip */}
    }

    // 3. Upload only records that don't already exist in Firestore
    let uploaded=0,skipped=0;
    for(const exp of localExps){
      const expId=String(exp._exp||'').trim();
      const depto=resolveDeptoFirestoreId(exp._depto||'guaviare',exp);
      if(!expId||!depto)continue;
      if(existingIds.has(expId)){skipped++;continue;}
      try{
        await window._fsSetDoc(window._fsDoc(db,'departamentos',depto,'expedientes',expId),exp,{merge:false});
        existingIds.add(expId);
        uploaded++;
      }catch(e){console.warn('Error subiendo expediente',expId,e);}
    }
    // 4. Also save cfg/config (non-destructive merge)
    await saveGlobalFirestore().catch(()=>{});
    notif('✅ Migración completada: '+uploaded+' subidos, '+skipped+' ya existían en Firestore.','ok');
    clearLegacyExpsLocalStorage();
    // 5. Reload from Firestore so the view is consistent
    await loadLS();
    updateDeptoUI();
  }catch(err){
    console.error('migrarLocalStorageAFirestore:',err);
    notif('Error en migración: '+(err&&err.message||err),'err');
  }
}

/** IDs eliminados en esta sesión (evita que un guardado con memoria incompleta borre Firestore). */
function recursosEnsureExplicitDeletesBag(){
  if(!window._recursosExplicitDeletes)window._recursosExplicitDeletes={repos:[],enlaces:[]};
  return window._recursosExplicitDeletes;
}
function recursosRegisterExplicitDelete(kind,id){
  const s=String(id||'').trim();
  if(!s)return;
  const bag=recursosEnsureExplicitDeletesBag();
  const key=kind==='enlace'?'enlaces':'repos';
  if(!bag[key].includes(s))bag[key].push(s);
}
window.recursosRegisterExplicitDelete=recursosRegisterExplicitDelete;

/** Une remoto + local por id (local gana). Respeta eliminaciones explícitas. */
function mergeRecursosArraysForSave(remoteArr,localArr,deletedIds){
  const del=new Set((deletedIds||[]).map(String));
  const byId=new Map();
  (Array.isArray(remoteArr)?remoteArr:[]).forEach(function(item){
    if(!item||typeof item!=='object')return;
    const id=String(item.id||'').trim();
    if(!id||del.has(id))return;
    byId.set(id,item);
  });
  (Array.isArray(localArr)?localArr:[]).forEach(function(item){
    if(!item||typeof item!=='object')return;
    const id=String(item.id||'').trim();
    if(!id||del.has(id))return;
    const prev=byId.get(id);
    byId.set(id,prev?Object.assign({},prev,item):item);
  });
  return Array.from(byId.values());
}

async function saveRecursosFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc)return false;
  if(window._recursosSaveBusy){
    try{await window._recursosSaveBusy;}catch(e){}
  }
  let resolveBusy;
  window._recursosSaveBusy=new Promise(function(r){resolveBusy=r;});
  try{
    const bag=recursosEnsureExplicitDeletesBag();
    const localRepos=(bibliotecaRepos||[]).slice();
    const localEnlaces=(recursosEnlaces||[]).slice();
    const localIdsRepos=new Set(localRepos.map(function(r){return String(r&&r.id||'').trim();}).filter(Boolean));
    const localIdsEnlaces=new Set(localEnlaces.map(function(l){return String(l&&l.id||'').trim();}).filter(Boolean));
    let remoteRepos=[];
    let remoteEnlaces=[];
    try{
      const snap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
      if(snap.exists()){
        const g=snap.data()||{};
        if(Array.isArray(g.bibliotecaRepos))remoteRepos=g.bibliotecaRepos;
        if(Array.isArray(g.recursosEnlaces))remoteEnlaces=g.recursosEnlaces;
      }
    }catch(readErr){
      console.warn('saveRecursosFirestore: no se pudo leer remoto antes de guardar',readErr);
    }
    let mergedRepos=mergeRecursosArraysForSave(remoteRepos,localRepos,bag.repos);
    let mergedEnlaces=mergeRecursosArraysForSave(remoteEnlaces,localEnlaces,bag.enlaces);
    if(typeof normalizeBibliotecaReposList==='function')mergedRepos=normalizeBibliotecaReposList(mergedRepos);
    else if(typeof normalizeRecursosScopeItem==='function')mergedRepos=mergedRepos.map(normalizeRecursosScopeItem);
    if(typeof normalizeRecursosEnlacesList==='function')mergedEnlaces=normalizeRecursosEnlacesList(mergedEnlaces);
    else if(typeof normalizeRecursosScopeItem==='function')mergedEnlaces=mergedEnlaces.map(normalizeRecursosScopeItem);
    const remoteOnlyRepos=remoteRepos.filter(function(r){
      const id=String(r&&r.id||'').trim();
      return id&&!localIdsRepos.has(id)&&!bag.repos.includes(id);
    });
    const remoteOnlyEnlaces=remoteEnlaces.filter(function(l){
      const id=String(l&&l.id||'').trim();
      return id&&!localIdsEnlaces.has(id)&&!bag.enlaces.includes(id);
    });
    if(remoteOnlyRepos.length||remoteOnlyEnlaces.length){
      console.warn(
        'saveRecursosFirestore: se conservaron registros remotos ausentes en memoria local',
        {repos:remoteOnlyRepos.length,enlaces:remoteOnlyEnlaces.length}
      );
    }
    bibliotecaRepos=mergedRepos;
    recursosEnlaces=mergedEnlaces;
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      recursosEnlaces:mergedEnlaces,
      bibliotecaRepos:mergedRepos,
      recursosConfig:recursosConfig||{guainiaDriveRoot:'',vaupesDriveRoot:''},
      updatedAt:new Date().toISOString()
    },{merge:true});
    bag.repos=[];
    bag.enlaces=[];
    window._recursosHydratedFromRemote=true;
    return true;
  }catch(err){
    console.error('saveRecursosFirestore:',err);
    if(!window._lastFsSaveError)window._lastFsSaveError={code:err&&err.code||'unknown',msg:'Recursos: '+(err&&err.message||'Error')};
    return false;
  }finally{
    if(resolveBusy)resolveBusy();
    window._recursosSaveBusy=null;
  }
}

async function reloadRecursosFirestore(){
  const db=window._db;
  if(!db||!window._fsGetDoc)return false;
  try{
    const snap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
    if(snap.exists()){
      const g=snap.data();
      if(Array.isArray(g.recursosEnlaces))recursosEnlaces=normalizeRecursosEnlacesList(g.recursosEnlaces);
      if(Array.isArray(g.bibliotecaRepos)){
        bibliotecaRepos=normalizeBibliotecaReposList(g.bibliotecaRepos);
      }
      window._recursosHydratedFromRemote=true;
      if(g.recursosConfig&&typeof g.recursosConfig==='object')recursosConfig={...recursosConfig,...g.recursosConfig};
    }
    return true;
  }catch(err){
    console.error('reloadRecursosFirestore:',err);
    return false;
  }
}