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
    }
    const [deptoSnaps,expSnaps]=await Promise.all([
      Promise.all(DEPTOS_FIRESTORE.map(depto=>window._fsGetDoc(window._fsDoc(db,'departamentos',depto)))),
      Promise.all(DEPTOS_FIRESTORE.map(depto=>loadExpedientesDepto(depto)))
    ]);
    exps=[];
    cfgByDepto={};
    deptoSnaps.forEach((snap,i)=>{
      const depto=DEPTOS_FIRESTORE[i];
      if(snap.exists()){
        const data=snap.data();
        cfgByDepto[depto]=normalizeCfgObj(data.cfg||{});
      }else{
        cfgByDepto[depto]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));
      }
    });
    expSnaps.forEach(deptoExps=>{exps=exps.concat(deptoExps);});
    DEPTOS.forEach(d=>{if(!cfgByDepto[d.id])cfgByDepto[d.id]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));});
    postLoadInit();
    updateSyncIndicator('synced');
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
async function saveExpedienteDoc(deptoId,exp){
  const db=window._db;
  if(!db||!window._fsSetDoc||!exp)return false;
  const expId=expedienteDocId(exp);
  if(!expId){console.warn('saveExpedienteDoc: expediente sin _exp');return false;}
  const depto=resolveDeptoFirestoreId(deptoId,exp);
  const ref=expedienteDocRef(db,depto,expId);
  if(!ref){console.warn('saveExpedienteDoc: ref nula',depto,expId);return false;}
  const payload={...exp,id:expId,_depto:depto,updatedAt:new Date().toISOString()};
  try{
    console.log('saveExpedienteDoc intento:',{deptoIdArg:deptoId,deptoResuelto:depto,expId,path:ref.path,auth:!!(window._usuarioActual||window.authUsuario)});
    await window._fsSetDoc(ref,payload,{merge:true});
    console.log('saveExpedienteDoc OK:',ref.path);
    return true;
  }catch(err){
    console.error('saveExpedienteDoc:',depto,expId,ref.path,err);
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
    return true;
  }catch(err){
    console.error('deleteExpedienteDoc:',depto,expId,err);
    return false;
  }
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
      usuariosIndex:_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
        activo:u.activo!==false,
        deptoResponsable:String(u.deptoResponsable||'').trim()
      })),
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.error('saveGlobalFirestore:',err);
    return false;
  }
}
function persistExpLocal(){
  _saveLSLocal();
  checkLocalStorageCapacityAfterSave();
}
function persistExpedienteGranular(exp,withGlobal){
  if(!exp)return;
  // Expedientes se persisten solo en Firestore (subcollección). No escribe a localStorage.
  const deptoResolved=resolveDeptoFirestoreId(deptoActivo,exp);
  console.log('persistExpedienteGranular:',{deptoActivo,exp_depto:exp._depto,exp__exp:exp._exp,deptoResolved,withGlobal:!!withGlobal});
  const fs=[saveExpedienteDoc(deptoActivo,exp)];
  if(withGlobal)fs.push(saveGlobalFirestore());
  updateSyncIndicator('syncing');
  Promise.all(fs).then(function(r){updateSyncIndicator(r.every(x=>x!==false)?'synced':'error');}).catch(function(){updateSyncIndicator('error');});
}
function diagTestSaveExpedienteDoc(){
  saveExpedienteDoc('guaviare',{
    _exp:'TEST-001',
    _depto:'guaviare',
    _tramite:'prueba',
    nombre:'Expediente de prueba'
  }).then(function(ok){console.log('saveExpedienteDoc resultado:',ok);})
    .catch(function(err){console.error('saveExpedienteDoc error:',err);});
}
window.diagTestSaveExpedienteDoc=diagTestSaveExpedienteDoc;
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
function persistExpedienteDelete(expRef){
  // Elimina directo de Firestore. No escribe a localStorage.
  updateSyncIndicator('syncing');
  deleteExpedienteDoc(deptoActivo,expRef).then(function(ok){updateSyncIndicator(ok?'synced':'error');}).catch(function(){updateSyncIndicator('error');});
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
      usuariosIndex:_usuariosCache.map(u=>({
        email:String(u.email||'').trim().toLowerCase(),
        nombre:u.nombre||'',
        rol:u.rol||'',
        codigo:u.codigo||'',
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
  else if(id==='pg-agenda')renderAgenda();
  renderChatBadge();
  renderBandejaDepto();
}
function desuscribirCfgSync(){
  if(_cfgUnsub){try{_cfgUnsub();}catch(e){}_cfgUnsub=null;}
}
function suscribirCfgSync(deptoId){
  const db=window._db;
  deptoId=deptoId||deptoCfg||deptoActivo||'guaviare';
  if(!db||!window._fsOnSnapshot||!window._fsDoc)return;
  if(!DEPTOS_FIRESTORE.includes(deptoId))return;
  desuscribirCfgSync();
  _cfgUnsub=window._fsOnSnapshot(window._fsDoc(db,'departamentos',deptoId),function(snap){
    if(_localSaving||!snap.exists())return;
    const data=snap.data();
    if(!data||!data.cfg)return;
    cfgByDepto[deptoId]=normalizeCfgObj(data.cfg);
    if(deptoCfg===deptoId)setCfgPtr(deptoId);
    if(document.getElementById('pg-cfg')&&document.getElementById('pg-cfg').classList.contains('on')&&typeof renderCfg==='function')renderCfg();
  });
}
function mergeExpFromFirestoreSnapshot(data,docId){
  const expId=String((data&&data._exp)||(data&&data.id)||docId||'').trim();
  if(!expId)return null;
  return{...data,_exp:expId,id:expId};
}
function initRealtimeSync(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  if(_fsUnsub){try{_fsUnsub();}catch(e){}_fsUnsub=null;}
  const depto=deptoActivo||'guaviare';
  if(!DEPTOS_FIRESTORE.includes(depto))return;
  _fsUnsub=window._fsOnSnapshot(window._fsCollection(db,'departamentos',depto,'expedientes'),function(snap){
    if(_localSaving)return;
    const changes=snap.docChanges();
    if(!changes.length)return;
    changes.forEach(function(change){
      if(change.type==='removed'){
        const expId=String(change.doc.id||'').trim();
        if(!expId)return;
        exps=(exps||[]).filter(function(e){return String(e._exp||'').trim()!==expId;});
        return;
      }
      const exp=mergeExpFromFirestoreSnapshot(change.doc.data(),change.doc.id);
      if(!exp)return;
      const idx=(exps||[]).findIndex(function(e){return String(e._exp||'').trim()===exp._exp;});
      if(idx>=0)exps[idx]=exp;
      else exps.push(exp);
    });
    renderTabla();
    renderChatBadge();
  });
}
async function migrarLocalStorageAFirestore(){
  const db=window._db;
  if(!db||!window._fsSetDoc){notif('Firebase no disponible','err');return;}
  if(!confirm('¿Migrar datos locales a Firestore? Esto sobrescribirá los datos remotos del departamento.'))return;
  _loadLSLocal();
  await saveFirestore();
  notif('Migración a Firestore completada','ok');
}