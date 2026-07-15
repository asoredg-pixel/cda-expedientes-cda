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
  lsStoreJson('sst_p',personas);
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
async function loadLS(){
  const db=window._db;
  if(!db||!window._fsGetDoc){
    _loadLSLocal();
    updateSyncIndicator('offline');
    return;
  }
  updateSyncIndicator('syncing');
  try{
    const globalSnap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
    if(globalSnap.exists()){
      const g=globalSnap.data();
      if(Array.isArray(g.personas))personas=g.personas;
      if(Array.isArray(g.actividadesLibres))actividadesLibres=g.actividadesLibres;
      if(Array.isArray(g.agendaEventos))agendaEventos=g.agendaEventos;
      // chatMensajes ya no se carga desde sistema/global — usa chats/{convId}/mensajes
      if(g.encargadosGlobal)encargadosGlobal=normalizeEncargadosGlobal(g.encargadosGlobal);
      if(Array.isArray(g.usuariosIndex)&&g.usuariosIndex.length)aplicarUsuariosIndex(g.usuariosIndex);
      if(Array.isArray(g.bandejaLeidos))try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify(g.bandejaLeidos));}catch(x){}
      if(Array.isArray(g.bandejaEliminados))try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify(g.bandejaEliminados));}catch(x){}
      if(Array.isArray(g.recursosEnlaces))recursosEnlaces=normalizeRecursosEnlacesList(g.recursosEnlaces);
      if(Array.isArray(g.bibliotecaRepos))bibliotecaRepos=normalizeBibliotecaReposList(g.bibliotecaRepos);
      if(g.recursosConfig&&typeof g.recursosConfig==='object')recursosConfig={...recursosConfig,...g.recursosConfig};
      if(g.mantenimiento&&typeof setMantenimientoEstadoLocal==='function')setMantenimientoEstadoLocal(g.mantenimiento);
      else if(typeof setMantenimientoEstadoLocal==='function')setMantenimientoEstadoLocal({activo:false});
      if(typeof pqrsMatrizApplySheetIdFromGlobal==='function')pqrsMatrizApplySheetIdFromGlobal(g);
      if(typeof pqrsMatrizApplyXlsxFileIdFromGlobal==='function')pqrsMatrizApplyXlsxFileIdFromGlobal(g);
    }
    const [deptoResults,expSnaps]=await Promise.all([
      Promise.allSettled(DEPTOS_FIRESTORE.map(depto=>window._fsGetDoc(window._fsDoc(db,'departamentos',depto)))),
      Promise.all(DEPTOS_FIRESTORE.map(depto=>loadExpedientesDepto(depto)))
    ]);
    exps=[];
    cfgByDepto={};
    deptoResults.forEach((result,i)=>{
      const depto=DEPTOS_FIRESTORE[i];
      if(result.status==='fulfilled'&&result.value.exists()){
        const data=result.value.data();
        cfgByDepto[depto]=normalizeCfgObj(data.cfg||{});
      }else{
        if(result.status==='rejected')console.warn('Sin acceso al departamento (normal para rol restringido):',depto);
        cfgByDepto[depto]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));
      }
    });
    expSnaps.forEach(deptoExps=>{exps=exps.concat(deptoExps);});
    DEPTOS.forEach(d=>{if(!cfgByDepto[d.id])cfgByDepto[d.id]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));});
    mergePendingExpBackup();
    clearLegacyExpsLocalStorage();
    postLoadInit();
    updateSyncIndicator('synced');
    if(document.body.classList.contains('sesion-activa')&&typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
    if(document.body.classList.contains('sesion-activa'))syncPendingExpedientesToFirestore().catch(function(e){console.warn('syncPending:',e);});
  }catch(err){
    console.error('Error cargando Firestore:',err);
    _loadLSLocal();
    updateSyncIndicator('error');
  }
}

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
  const deptos=typeof DEPTOS_FIRESTORE!=='undefined'?DEPTOS_FIRESTORE:['guaviare','guainia','vaupes'];
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
async function saveGlobalFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc)return false;
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      personas:personas||[],
      actividadesLibres:actividadesLibres||[],
      agendaEventos:agendaEventos||[],
      bandejaLeidos:getBandejaLeidos(),
      bandejaEliminados:getBandejaEliminados(),
      encargadosGlobal:normalizeEncargadosGlobal(encargadosGlobal),
      mantenimiento:typeof normalizeMantenimiento==='function'?normalizeMantenimiento(mantenimientoEstado):mantenimientoEstado||{activo:false},
      usuariosIndex:_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
        cargo:String(u.cargo||'').trim().toLowerCase(),
        activo:u.activo!==false,
        deptoResponsable:String(u.deptoResponsable||'').trim()
      })),
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.error('saveGlobalFirestore:',err);
    if(!window._lastFsSaveError)window._lastFsSaveError={code:err&&err.code||'unknown',msg:'Global: '+(err&&err.message||'Error desconocido')};
    return false;
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
  if(idx>=0)exps[idx]=exp;
  else exps.push(exp);
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
async function ensureFirestoreAuthReady(){
  const auth=window._firebaseAuth;
  if(!auth||!auth.currentUser){
    window._lastFsSaveError={code:'unauthenticated',msg:'Sin sesión Firebase activa'};
    return{ok:false,code:'unauthenticated'};
  }
  try{
    await auth.currentUser.getIdToken(true);
    return{ok:true,email:auth.currentUser.email||''};
  }catch(err){
    window._lastFsSaveError={code:'unauthenticated',msg:err&&err.message||'Token expirado'};
    return{ok:false,code:'unauthenticated'};
  }
}
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
    if(rol==='secretaria'||rol==='admin'){
      msg+=' Revise que la cuenta esté activa en Configuración → Usuarios y vuelva a iniciar sesión.';
    }else{
      msg+=' Ingrese con una cuenta Secretaría o Administrador autorizada.';
    }
  }else if(errCode==='unauthenticated'){
    msg+=' Sesión de Google expirada — cierre sesión y vuelva a ingresar con su cuenta institucional.';
  }else if(errCode==='invalid-argument'){
    msg+=' Datos del expediente demasiado grandes o inválidos. Intente sin adjuntos pesados en el cuerpo del correo.';
  }else if(errCode&&errCode!=='unknown'){
    msg+=' Código: '+errCode+'.';
  }else{
    msg+=' Verifique conexión o permisos.';
  }
  return msg;
}
async function persistExpedienteGranular(exp,withGlobal){
  return persistExpedienteGranularAsync(exp,withGlobal);
}
/** Guarda el expediente en Firestore y retorna true/false (para await en radicación). */
async function persistExpedienteGranularAsync(exp,withGlobal){
  if(!exp)return false;
  const deptoResolved=resolveDeptoFirestoreId(deptoActivo,exp);
  console.log('persistExpedienteGranular:',{deptoActivo,exp_depto:exp._depto,exp__exp:exp._exp,deptoResolved,withGlobal:!!withGlobal});
  updateSyncIndicator('syncing');
  const authOk=await ensureFirestoreAuthReady();
  if(!authOk.ok){
    persistExpLocalBackup(exp);
    updateSyncIndicator('error');
    if(typeof notif==='function')notif(_firestoreSaveErrorMessage('unauthenticated')+' La PQRSD quedó guardada localmente y se sincronizará al reconectar.','err');
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
    updateSyncIndicator('synced');
    if(!globalOk&&typeof notif==='function')notif('⚠️ PQRSD guardada, pero no se actualizó el índice global.','warn');
    return true;
  }
  persistExpLocalBackup(exp);
  updateSyncIndicator('error');
  const lastErr=window._lastFsSaveError||null;
  const errCode=lastErr&&lastErr.code||'unknown';
  console.error('persistExpedienteGranular: guardado falló',{exp__exp:exp._exp,deptoResolved,errCode,lastErr});
  if(typeof notif==='function')notif(_firestoreSaveErrorMessage(errCode)+' La PQRSD quedó guardada localmente y se reintentará al sincronizar.','err');
  return false;
}
window.persistExpedienteGranularAsync=persistExpedienteGranularAsync;
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
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      personas:personas||[],
      actividadesLibres:actividadesLibres||[],
      agendaEventos:agendaEventos||[],
      bandejaLeidos:getBandejaLeidos(),
      bandejaEliminados:getBandejaEliminados(),
      encargadosGlobal:normalizeEncargadosGlobal(encargadosGlobal),
      mantenimiento:typeof normalizeMantenimiento==='function'?normalizeMantenimiento(mantenimientoEstado):mantenimientoEstado||{activo:false},
      usuariosIndex:_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
        cargo:String(u.cargo||'').trim().toLowerCase(),
        activo:u.activo!==false,
        deptoResponsable:String(u.deptoResponsable||'').trim()
      })),
      updatedAt:new Date().toISOString()
    },{merge:true});
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
    if(typeof renderTabActual==='function')renderTabActual();
    else if(typeof renderTabla==='function')renderTabla();
    // Refresco explícito de vistas clave (radicación / traslado inmediato)
    try{
      if(typeof renderActividades==='function'&&document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
      if(typeof renderPqrsOficinaInbox==='function'&&document.getElementById('pg-pqrs-ofi')&&document.getElementById('pg-pqrs-ofi').classList.contains('on'))renderPqrsOficinaInbox();
      if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
      if(typeof renderSecretariaPqrs==='function'&&document.getElementById('pg-sec')&&document.getElementById('pg-sec').classList.contains('on'))renderSecretariaPqrs();
      if(typeof renderBandejaDepto==='function')renderBandejaDepto();
    }catch(_rv){}
    if(typeof chatRefreshContactsIfOpen==='function')chatRefreshContactsIfOpen();
    const sideExp=window._pqrsSideExp;
    if(sideExp&&typeof openPqrsSidePanel==='function')openPqrsSidePanel(sideExp);
    const conExp=window._conPanelActive;
    if(conExp&&typeof renderConSidePanel==='function')renderConSidePanel();
  }catch(e){console.warn('refreshViewsAfterRemoteDataChange:',e);}
}
function stopRealtimeExpSync(){
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
}
function stopAllRealtimeSync(){
  stopRealtimeExpSync();
  stopRealtimeCfgSync();
  stopRealtimeGlobalSync();
  if(typeof stopUsuariosFirestoreListener==='function')stopUsuariosFirestoreListener();
  if(typeof stopSessionGuard==='function')stopSessionGuard();
}
function desuscribirCfgSync(){
  // Los listeners de configuración son globales durante la sesión; no se detienen al cambiar pestaña.
}
function onRemoteCfgSnapshot(deptoId,snap){
  if(_localSaving||!snap.exists())return;
  const data=snap.data();
  if(!data||!data.cfg)return;
  cfgByDepto[deptoId]=normalizeCfgObj(data.cfg);
  if(deptoCfg===deptoId)setCfgPtr(deptoId);
  try{_saveLSLocal();}catch(e){}
  refreshViewsAfterRemoteDataChange();
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
function initRealtimeGlobalSync(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsDoc)return;
  if(_globalUnsub)return;
  _globalUnsub=window._fsOnSnapshot(window._fsDoc(db,'sistema','global'),function(snap){
    if(_localSaving||!snap.exists())return;
    const g=snap.data()||{};
    let changed=false;
    if(g.mantenimiento&&typeof setMantenimientoEstadoLocal==='function'){
      setMantenimientoEstadoLocal(g.mantenimiento);
    }
    if(g.encargadosGlobal){
      encargadosGlobal=normalizeEncargadosGlobal(g.encargadosGlobal);
      if(typeof syncEncargadosGlobalToInstructores==='function')syncEncargadosGlobalToInstructores();
      changed=true;
    }
    if(Array.isArray(g.personas)&&g.personas.length){
      personas=g.personas.map(normalizePersonaRecord);
      changed=true;
    }
    if(Array.isArray(g.actividadesLibres))actividadesLibres=g.actividadesLibres;
    if(Array.isArray(g.agendaEventos))agendaEventos=g.agendaEventos;
    if(changed){
      try{_saveLSLocal();}catch(e){}
      refreshViewsAfterRemoteDataChange();
    }
  },function(err){console.warn('Error escuchando sistema/global:',err);});
}
function initAppRealtimeSync(){
  initRealtimeSync();
  initRealtimeCfgSyncAll();
  initRealtimeGlobalSync();
  if(typeof startUsuariosFirestoreListener==='function')startUsuariosFirestoreListener();
}
function mergeExpFromFirestoreSnapshot(data,docId){
  const expId=String((data&&data._exp)||(data&&data.id)||docId||'').trim();
  if(!expId)return null;
  return{...data,_exp:expId,id:expId};
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
      exps[idx]=exp;
    }else{
      exps.push(exp);
    }
    changed=true;
  });
  return changed;
}
function initRealtimeSync(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  stopRealtimeExpSync();
  const unsubs=[];
  DEPTOS_FIRESTORE.forEach(function(depto){
    const unsub=window._fsOnSnapshot(window._fsCollection(db,'departamentos',depto,'expedientes'),function(snap){
      // No bloquear por _localSaving: ese flag es de cfg/global y retrasaba
      // la aparición de PQRSD recién radicadas en Actividades/Consulta (~1–3 min).
      const changes=snap.docChanges();
      if(!applyExpedienteFirestoreChanges(changes))return;
      refreshViewsAfterRemoteDataChange();
    },function(err){console.warn('Error escuchando expedientes',depto,err);});
    unsubs.push(unsub);
  });
  _fsUnsub=unsubs;
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

async function saveRecursosFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc)return false;
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      recursosEnlaces:recursosEnlaces||[],
      bibliotecaRepos:bibliotecaRepos||[],
      recursosConfig:recursosConfig||{guainiaDriveRoot:'',vaupesDriveRoot:''},
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.error('saveRecursosFirestore:',err);
    if(!window._lastFsSaveError)window._lastFsSaveError={code:err&&err.code||'unknown',msg:'Recursos: '+(err&&err.message||'Error')};
    return false;
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
      if(Array.isArray(g.bibliotecaRepos))bibliotecaRepos=normalizeBibliotecaReposList(g.bibliotecaRepos);
      if(g.recursosConfig&&typeof g.recursosConfig==='object')recursosConfig={...recursosConfig,...g.recursosConfig};
    }
    return true;
  }catch(err){
    console.error('reloadRecursosFirestore:',err);
    return false;
  }
}