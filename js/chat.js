// =============================================================================
// chat.js — CHAT INTERNO + GRAFICAS
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// ETAPA 4 — CHAT INTERNO
// ================================================================
// CHAT_LABEL_SUBDIRECCION → js/constants.js
function chatNormKey(k){return String(k||'').trim().toLowerCase();}
function chatCanonicalKey(key){
  key=chatNormKey(key);
  if(key==='ofi:guaviare')return 'depto:guaviare';
  if(key.startsWith('admin:'))return chatNormKey(CHAT_ADMIN_KEY);
  return key;
}
function chatKeysMatch(a,b){
  return chatCanonicalKey(a)===chatCanonicalKey(b);
}
function chatKeyAliases(key){
  key=chatNormKey(key);
  const c=chatCanonicalKey(key);
  const set=new Set([key,c]);
  if(c==='depto:guaviare'){set.add('ofi:guaviare');}
  if(c===chatNormKey(CHAT_ADMIN_KEY)||key.startsWith('admin:')){
    set.add(chatNormKey(CHAT_ADMIN_KEY));
    set.add(chatNormKey(typeof CHAT_ADMIN_KEY_LEGACY!=='undefined'?CHAT_ADMIN_KEY_LEGACY:'admin:Admin'));
    set.add('admin:soporte');
    set.add('admin:admin');
  }
  return [...set];
}
function chatActividadIconHtml(sz){
  const n=Number(sz)||16;
  return '<span class="ico-chat-bubble"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+n+'" height="'+n+'" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h2l3.5 3.5L13 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H12.8l-.6.5-2.3 2.3V16H4V4h16v12z"/></svg></span>';
}
function chatInternoIconHtml(sz){
  const n=Number(sz)||16;
  return '<span class="ico-chat-interno"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="'+n+'" height="'+n+'" aria-hidden="true"><path d="M4 4h16v12H5.17L4 17.17V4zm0-2c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h12v-2H6v2zm0-3h12V9H6v2zm0-3h12V6H6v2z"/></svg></span>';
}
function chatWaIconHtml(sz){return chatActividadIconHtml(sz);}
function chatBubbleIconHtml(sz){return chatActividadIconHtml(sz);}
function addChatContactoDepto(add,deptoId,skipEncNombre,opts){
  opts=opts||{};
  deptoId=deptoId||'';
  if(!deptoId)return;
  const enc=getEncargadoDepto(deptoId);
  const deptoLbl=labelDepto(deptoId);
  if(enc&&enc!==skipEncNombre){
    add({kind:'depto',key:'depto:'+deptoId,label:enc,deptoId,sub:opts.subEnc||deptoLbl+' · Encargado'});
  }else{
    add({kind:'depto',key:'depto:'+deptoId,label:deptoLbl,deptoId,sub:opts.subFallback||'Departamento'});
  }
}
function addChatContactoOficina(add,oficinaId,skipEncNombre,opts){
  opts=opts||{};
  if(!oficinaId||oficinaId==='guaviare')return;
  const enc=getEncargadoOficina(oficinaId);
  const ofiLbl=labelOficina(oficinaId);
  if(enc&&enc!==skipEncNombre){
    add({kind:'ofi',key:'ofi:'+oficinaId,label:enc,oficinaId,sub:opts.subEnc||ofiLbl+' · Encargado'});
  }else{
    add({kind:'ofi',key:'ofi:'+oficinaId,label:ofiLbl,oficinaId,sub:opts.subFallback||'Oficina DEGUV'});
  }
}
function addChatContactosOficina(add,oficinaId,skipEncNombre){
  if(!oficinaId||oficinaId==='guaviare')return;
  const enc=getEncargadoOficina(oficinaId);
  const ofiLbl=labelOficina(oficinaId);
  // Only add the encargado (by name) if configured — don't fall back to office name
  if(enc&&enc!==skipEncNombre){
    add({kind:'enc_ofi',key:'resp:'+enc,label:enc,oficinaId,sub:ofiLbl+' · Encargado'});
  }
  // Always add configured responsables of the office
  getInstructoresOficina(oficinaId).forEach(i=>{
    const n=i.nombre;
    if(!n||n===enc||i.rol==='encargado_oficina')return;
    add({kind:'resp',key:'resp:'+n,label:n,oficinaId,sub:ofiLbl+' · Responsable'});
  });
}
function addChatResponsablesOficinaPropia(add,oficinaId){
  const enc=getEncargadoOficina(oficinaId);
  getInstructoresOficina(oficinaId).forEach(i=>{
    const n=i.nombre;
    if(!n||n===enc||i.rol==='encargado_oficina')return;
    add({kind:'resp',key:'resp:'+n,label:n,oficinaId,sub:'Responsable de la oficina'});
  });
}
function getChatIdentity(){
  if(typeof esAdministrador==='function'&&esAdministrador())
    return{kind:'admin',key:CHAT_ADMIN_KEY,label:CHAT_ADMIN_LABEL};
  if(esJurisdiccional())return{kind:'juris',key:'juris:jurisdiccional',label:CHAT_LABEL_SUBDIRECCION};
  if(esModoOficinaDeguv())return{kind:'ofi',key:'ofi:'+deptoActivo,label:labelOficina(deptoActivo),oficinaId:deptoActivo};
  if(esSecretaria())return{kind:'ofi',key:'ofi:secretaria',label:'Secretaría DEGUV',oficinaId:'secretaria'};
  const rolEf=typeof getRolEfectivo==='function'?getRolEfectivo():String(rolSesion||'');
  if(DEPTOS.some(function(d){return d.id===deptoActivo&&d.id===rolEf;})){
    const enc=getEncargadoDepto(deptoActivo);
    if(enc)return{kind:'enc_depto',key:'resp:'+enc,label:enc,deptoId:deptoActivo};
    return{kind:'depto',key:'depto:'+deptoActivo,label:labelDepto(deptoActivo),deptoId:deptoActivo};
  }
  if(esModoResponsable()){
    let nm=String(responsableActivo||'').trim();
    const ses=chatSessionUserContact();
    if(!nm&&ses){
      if(ses.key.startsWith('resp:'))nm=ses.key.slice(5);
      else return ses;
    }
    if(!nm)return null;
    return{kind:'resp',key:'resp:'+nm,label:nm,deptoId:deptoCfg||'guaviare'};
  }
  if(deptoActivo==='jurisdiccional'||deptoActivo==='responsables'){
    return chatSessionUserContact()||null;
  }
  if(DEPTOS.some(function(d){return d.id===deptoActivo;})){
    const enc=getEncargadoDepto(deptoActivo);
    if(enc)return{kind:'enc_depto',key:'resp:'+enc,label:enc,deptoId:deptoActivo};
    return{kind:'depto',key:'depto:'+deptoActivo,label:labelDepto(deptoActivo),deptoId:deptoActivo};
  }
  return chatSessionUserContact();
}
function chatEffectiveIdentity(){
  if(typeof esAdministrador==='function'&&esAdministrador())
    return{kind:'admin',key:CHAT_ADMIN_KEY,label:CHAT_ADMIN_LABEL};
  let me=getChatIdentity();
  if(me)return me;
  const ses=chatSessionUserContact();
  if(ses)return ses;
  if(DEPTOS.some(function(d){return d.id===deptoActivo;})){
    const enc=getEncargadoDepto(deptoActivo);
    if(enc)return{kind:'enc_depto',key:'resp:'+enc,label:enc,deptoId:deptoActivo};
    return{kind:'depto',key:'depto:'+deptoActivo,label:labelDepto(deptoActivo),deptoId:deptoActivo};
  }
  if(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv()){
    return{kind:'ofi',key:'ofi:'+deptoActivo,label:labelOficina(deptoActivo),oficinaId:deptoActivo};
  }
  if(typeof esSecretaria==='function'&&esSecretaria()){
    return{kind:'ofi',key:'ofi:secretaria',label:'Secretaría DEGUV',oficinaId:'secretaria'};
  }
  if(typeof esJurisdiccional==='function'&&esJurisdiccional()){
    return{kind:'juris',key:'juris:jurisdiccional',label:CHAT_LABEL_SUBDIRECCION};
  }
  return null;
}
function chatInvalidateContactsCache(){
  window._chatContactsCache=null;
}
const CHAT_MSG_RENDER_DEFAULT=120;
const CHAT_MSG_RENDER_STEP=80;
let _chatContactPreviewCache=null;
function chatInvalidateContactPreviewCache(){
  _chatContactPreviewCache=null;
}
function chatMsgConvId(m){
  if(!m)return'';
  return m.convId||chatConvId(m.fromKey,m.toKey);
}
function chatRebuildMsgIndex(){
  const map=new Map();
  (chatMensajes||[]).forEach(function(m){
    if(!m||!m.id)return;
    const cid=chatMsgConvId(m);
    if(!cid)return;
    let arr=map.get(cid);
    if(!arr){arr=[];map.set(cid,arr);}
    arr.push(m);
  });
  map.forEach(function(arr){
    arr.sort(function(a,b){return(a.ts||'').localeCompare(b.ts||'');});
  });
  window._chatMsgsByConv=map;
}
function chatEnsureMsgIndex(){
  if(!window._chatMsgsByConv)chatRebuildMsgIndex();
}
function chatInvalidateMsgIndex(){
  window._chatMsgsByConv=null;
  chatInvalidateContactPreviewCache();
}
function chatMsgIndexRemove(msgId){
  msgId=String(msgId||'');
  if(!msgId)return;
  chatEnsureMsgIndex();
  window._chatMsgsByConv.forEach(function(arr){
    const i=arr.findIndex(function(m){return m.id===msgId;});
    if(i>=0)arr.splice(i,1);
  });
  chatInvalidateContactPreviewCache();
}
function chatMsgIndexReplaceConv(convId,msgs){
  chatEnsureMsgIndex();
  const sorted=(msgs||[]).slice().sort(function(a,b){return(a.ts||'').localeCompare(b.ts||'');});
  window._chatMsgsByConv.set(String(convId||''),sorted);
  chatInvalidateContactPreviewCache();
}
function chatMsgIndexUpsert(msg){
  if(!msg||!msg.id)return;
  chatEnsureMsgIndex();
  const cid=chatMsgConvId(msg);
  let arr=window._chatMsgsByConv.get(cid);
  if(!arr){arr=[];window._chatMsgsByConv.set(cid,arr);}
  const i=arr.findIndex(function(m){return m.id===msg.id;});
  if(i>=0)arr[i]=msg;
  else{
    arr.push(msg);
    arr.sort(function(a,b){return(a.ts||'').localeCompare(b.ts||'');});
  }
  chatInvalidateContactPreviewCache();
}
function chatApplyFirestoreMsgChange(change,msg){
  if(change.type==='removed'){
    chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
    chatMsgIndexRemove(msg.id);
    return;
  }
  const idx=(chatMensajes||[]).findIndex(function(m){return m.id===msg.id;});
  if(idx>=0)chatMensajes[idx]=msg;
  else chatMensajes.push(msg);
  chatMsgIndexUpsert(msg);
}
function chatContactPreview(me,contactKey){
  if(!me||!contactKey)return{ts:'',prev:'Sin mensajes',unread:0};
  if(!_chatContactPreviewCache)_chatContactPreviewCache=new Map();
  const cacheKey=chatNormKey(me.key)+'|'+chatNormKey(contactKey);
  if(_chatContactPreviewCache.has(cacheKey))return _chatContactPreviewCache.get(cacheKey);
  let msgs=[],last=null,prev='Sin mensajes',unread=0;
  try{
    msgs=chatMsgsForContact(me,contactKey);
    last=msgs[msgs.length-1];
    prev=last?((!chatEsMio(last)?(chatFromLabel(last)+': '):'')+(last.text||chatMsgDrivePreview(last))):'Sin mensajes';
    unread=msgs.filter(chatMsgUnreadForMe).length;
  }catch(e){}
  const row={ts:last&&last.ts?String(last.ts):'',prev:prev,unread:unread};
  _chatContactPreviewCache.set(cacheKey,row);
  return row;
}
function chatResetMsgWindow(){
  window._chatMsgRenderCount=CHAT_MSG_RENDER_DEFAULT;
}
function chatLoadOlderMessages(){
  window._chatMsgRenderCount=(window._chatMsgRenderCount||CHAT_MSG_RENDER_DEFAULT)+CHAT_MSG_RENDER_STEP;
  _chatMessagesPaintSig='';
  const el=document.getElementById('chat-msgs');
  const prevHeight=el?el.scrollHeight:0;
  renderChatMessages();
  if(el){
    const added=el.scrollHeight-prevHeight;
    el.scrollTop=Math.max(0,added);
  }
}
function getChatContactsList(){
  if(Array.isArray(window._chatContactsCache))return window._chatContactsCache;
  return getChatContacts();
}
function chatIdentityKeysForKey(key){
  key=chatNormKey(key);
  const set=new Set([key]);
  if(key.startsWith('admin:')||key===chatNormKey(CHAT_ADMIN_KEY)){
    set.add(chatNormKey(CHAT_ADMIN_KEY));
    return[...set];
  }
  if(key.startsWith('depto:')){
    const id=key.slice(6);
    const enc=getEncargadoDepto(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('ofi:guaviare');
  }else if(key.startsWith('ofi:')){
    const id=key.slice(4);
    const enc=getEncargadoOficina(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('depto:guaviare');
  }else if(key.startsWith('juris:')){
    set.add('juris:jurisdiccional');
  }else if(key.startsWith('resp:')){
    const nm=key.slice(5);
    DEPTOS.forEach(function(d){
      const enc=getEncargadoDepto(d.id);
      if(enc&&chatNombresIguales(enc,nm))set.add('depto:'+d.id);
      getInstructoresActivos(d.id).forEach(function(ins){
        if(!chatNombresIguales(ins.nombre,nm))return;
        set.add('depto:'+d.id);
        (ins.oficinas||[]).forEach(function(ofi){
          if(ins.rol==='encargado_oficina')set.add('ofi:'+ofi);
        });
      });
    });
    OFICINAS_DEGUV.forEach(function(o){
      if(o.id==='guaviare')return;
      const enc=getEncargadoOficina(o.id);
      if(enc&&chatNombresIguales(enc,nm))set.add('ofi:'+o.id);
    });
    (_usuariosCache||[]).forEach(function(u){
      if(u.activo===false||!chatNombresIguales(u.nombre,nm))return;
      const rol=String(u.rol||'').trim();
      if(rol==='jurisdiccional')set.add('juris:jurisdiccional');
      else if(DEPTOS.some(function(d){return d.id===rol;}))set.add('depto:'+rol);
      else if(rol==='secretaria'||OFICINAS_DEGUV.some(function(o){return o.id===rol;}))set.add('ofi:'+rol);
      else if((rol==='responsables'||rol==='contratista')&&u.deptoResponsable)set.add('depto:'+u.deptoResponsable);
    });
  }
  return[...set];
}
/** Claves de una sola persona/rol — sin incluir a otros del mismo departamento. */
function chatPersonKeysFor(key){
  key=chatNormKey(key);
  const set=new Set([key]);
  chatKeyAliases(key).forEach(function(a){set.add(chatNormKey(a));});
  if(key.startsWith('admin:')||key===chatNormKey(CHAT_ADMIN_KEY)){
    set.add(chatNormKey(CHAT_ADMIN_KEY));
    return set;
  }
  if(key.startsWith('resp:')){
    const nm=key.slice(5);
    DEPTOS.forEach(function(d){
      const enc=getEncargadoDepto(d.id);
      if(enc&&chatNombresIguales(enc,nm))set.add('depto:'+d.id);
    });
    OFICINAS_DEGUV.forEach(function(o){
      const enc=getEncargadoOficina(o.id);
      if(enc&&chatNombresIguales(enc,nm)){
        set.add('ofi:'+o.id);
        if(o.id==='guaviare')set.add('depto:guaviare');
      }
    });
    DEPTOS.forEach(function(d){
      getInstructoresActivos(d.id).forEach(function(ins){
        if(!chatNombresIguales(ins.nombre,nm))return;
        if(ins.rol==='encargado_depto')set.add('depto:'+d.id);
        (ins.oficinas||[]).forEach(function(ofi){
          if(ins.rol==='encargado_oficina')set.add('ofi:'+ofi);
        });
      });
    });
    (_usuariosCache||[]).forEach(function(u){
      if(u.activo===false||!chatNombresIguales(u.nombre,nm))return;
      const rol=String(u.rol||'').trim();
      if(rol==='jurisdiccional')set.add('juris:jurisdiccional');
      else if(DEPTOS.some(function(d){return d.id===rol;}))set.add('depto:'+rol);
      else if(rol==='secretaria'||OFICINAS_DEGUV.some(function(o){return o.id===rol;}))set.add('ofi:'+rol);
    });
  }else if(key.startsWith('depto:')){
    const id=key.slice(6);
    const enc=getEncargadoDepto(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('ofi:guaviare');
  }else if(key.startsWith('ofi:')){
    const id=key.slice(4);
    const enc=getEncargadoOficina(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('depto:guaviare');
  }else if(key.startsWith('juris:')){
    set.add('juris:jurisdiccional');
  }
  return set;
}
function chatAllKeysFor(key){
  const set=new Set();
  function add(k){
    k=chatNormKey(k);
    if(!k)return;
    set.add(k);
    chatKeyAliases(k).forEach(function(a){set.add(chatNormKey(a));});
  }
  add(key);
  chatIdentityKeysForKey(key).forEach(add);
  return set;
}
function chatKeyInSet(key,set){
  if(!set||!set.size)return false;
  key=chatNormKey(key);
  if(set.has(key))return true;
  for(const k of chatPersonKeysFor(key)){
    if(set.has(k))return true;
  }
  return false;
}
function chatSessionUserContact(){
  const u=window._usuarioActual;
  if(!u||u.activo===false)return null;
  return chatUsuarioToContact(u);
}
function chatMyKeySet(){
  const set=new Set();
  const me=chatEffectiveIdentity()||getChatIdentity();
  if(me)chatPersonKeysFor(me.key).forEach(function(k){set.add(k);});
  const ses=chatSessionUserContact();
  if(ses)chatPersonKeysFor(ses.key).forEach(function(k){set.add(k);});
  return set;
}
function getMyChatKeys(){
  const out=new Set();
  const me=chatEffectiveIdentity()||getChatIdentity();
  if(me)chatPersonKeysFor(me.key).forEach(function(k){out.add(chatNormKey(k));});
  const ses=chatSessionUserContact();
  if(ses)chatPersonKeysFor(ses.key).forEach(function(k){out.add(chatNormKey(k));});
  return[...out];
}
function chatKeyInMyKeys(k){
  return chatKeyInSet(k,chatMyKeySet());
}
function chatMsgParticipa(m){
  if(!m)return false;
  const mine=chatMyKeySet();
  if(!mine.size)return false;
  if(m.fromKey||m.toKey){
    const from=chatPersonKeysFor(m.fromKey||'');
    const to=chatPersonKeysFor(m.toKey||'');
    for(const k of mine){
      if(from.has(k)||to.has(k))return true;
    }
  }
  const cid=String(m.convId||'').trim();
  if(cid){
    const parts=cid.indexOf('|')>=0?cid.split('|'):[cid];
    if(parts.some(function(p){return chatKeyInMyKeys(p);}))return true;
    if(m.fromKey&&m.toKey){
      const alt=chatConvId(m.fromKey,m.toKey);
      if(alt!==cid){
        const altParts=alt.indexOf('|')>=0?alt.split('|'):[alt];
        if(altParts.some(function(p){return chatKeyInMyKeys(p);}))return true;
      }
    }
  }
  return false;
}
function chatRegionForDepto(deptoId){
  deptoId=String(deptoId||'');
  if(deptoId==='guainia')return 'guainia';
  if(deptoId==='vaupes')return 'vaupes';
  return 'guaviare';
}
function chatNormNombre(n){
  return String(n||'').trim().toLowerCase();
}
function chatNombresIguales(a,b){
  if(typeof agendaNorm==='function')return agendaNorm(a)===agendaNorm(b);
  return chatNormNombre(a)===chatNormNombre(b);
}
function chatInstructorMeta(ins,deptoId){
  deptoId=deptoId||'guaviare';
  const rolLbl=(typeof INST_ROLES!=='undefined'&&INST_ROLES[ins.rol])?INST_ROLES[ins.rol]:'Responsable';
  const ofs=ins.oficinas||[];
  const ofi=ofs.find(function(o){return o&&o!=='guaviare';});
  if(ofi&&OFICINAS_DEGUV.some(function(x){return x.id===ofi;}))
    return labelOficina(ofi)+' · '+rolLbl;
  return labelDepto(deptoId)+' · '+rolLbl;
}
function chatContactIsSelf(me,c){
  if(!me||!c||!c.key)return false;
  if(chatNormKey(c.key)===chatNormKey(me.key))return true;
  return chatKeysMatch(c.key,me.key);
}
function chatPushContact(seen,out,me,c){
  if(!c||!c.key)return;
  const k=chatNormKey(c.key);
  if(seen.has(k))return;
  if(chatContactIsSelf(me,c))return;
  seen.add(k);
  if(!c.meta&&c.sub)c.meta=c.sub;
  if(!c.region){
    if(c.kind==='juris')c.region='juris';
    else c.region=chatRegionForDepto(c.deptoId||'');
  }
  out.push(c);
}
function chatUsuarioToContact(u){
  if(!u||u.activo===false)return null;
  const rol=String(u.rol||'').trim();
  const nom=String(u.nombre||'').trim();
  if(!nom||rol==='ciudadano')return null;
  // Admin no aparece como contacto personal; se inyecta como «Soporte» (avisos)
  if(rol==='admin')return null;
  if(rol==='jurisdiccional'){
    return{key:'juris:jurisdiccional',kind:'juris',label:nom,meta:'Subdirección · Jurisdiccional',region:'juris'};
  }
  if(rol==='responsables'||rol==='contratista'){
    const depto=String(u.deptoResponsable||'guaviare').trim()||'guaviare';
    const ins=(getInstructoresActivos(depto)||[]).find(function(i){return chatNombresIguales(i.nombre,nom);});
    const rolLbl=ins?((typeof INST_ROLES!=='undefined'&&INST_ROLES[ins.rol])||'Responsable'):(rol==='contratista'?'Contratista':'Responsable');
    return{key:'resp:'+nom,kind:'resp',label:nom,meta:labelDepto(depto)+' · '+rolLbl,region:chatRegionForDepto(depto),deptoId:depto};
  }
  if(DEPTOS.some(function(d){return d.id===rol;})){
    const enc=getEncargadoDepto(rol);
    if(enc&&chatNombresIguales(enc,nom)){
      return{key:'resp:'+enc,kind:'enc_depto',label:enc,meta:labelDepto(rol)+' · Encargado del departamento',region:chatRegionForDepto(rol),deptoId:rol};
    }
    return{key:'depto:'+rol,kind:'depto',label:enc||labelDepto(rol),meta:labelDepto(rol)+' · Departamento',region:chatRegionForDepto(rol),deptoId:rol};
  }
  if(OFICINAS_DEGUV.some(function(o){return o.id===rol;})){
    const enc=getEncargadoOficina(rol);
    if(enc&&chatNombresIguales(enc,nom)){
      return{key:'resp:'+enc,kind:'enc_ofi',label:enc,meta:labelOficina(rol)+' · Encargado de oficina',region:'guaviare',oficinaId:rol};
    }
    return{key:'ofi:'+rol,kind:'ofi',label:enc||labelOficina(rol),meta:labelOficina(rol)+' · Oficina',region:'guaviare',oficinaId:rol};
  }
  return null;
}
function chatContactAllowed(contactKey){
  const me=getChatIdentity();
  if(!me||!contactKey)return false;
  if(chatNormKey(contactKey)===chatNormKey(me.key))return false;
  return true;
}
function getChatContacts(){
  const me=chatEffectiveIdentity();
  if(!me)return[];
  if(typeof ensureUsuariosFirestoreCache==='function')void ensureUsuariosFirestoreCache();
  const seen=new Set(),out=[];
  function push(c){chatPushContact(seen,out,me,c);}
  // Todos (excepto Admin) ven el contacto «Soporte» para recibir avisos
  if(!(typeof esAdministrador==='function'&&esAdministrador())){
    push({key:CHAT_ADMIN_KEY,kind:'admin',label:CHAT_ADMIN_LABEL,meta:'Avisos del sistema',region:'admin'});
  }
  const jurisU=(_usuariosCache||[]).find(function(u){return u&&u.activo!==false&&u.rol==='jurisdiccional'&&String(u.nombre||'').trim();});
  push({
    key:'juris:jurisdiccional',
    kind:'juris',
    label:jurisU?String(jurisU.nombre).trim():CHAT_LABEL_SUBDIRECCION,
    meta:'Subdirección · Jurisdiccional',
    region:'juris'
  });
  DEPTOS.forEach(function(d){
    const enc=getEncargadoDepto(d.id);
    const region=chatRegionForDepto(d.id);
    if(enc){
      push({key:'resp:'+enc,kind:'enc_depto',label:enc,meta:labelDepto(d.id)+' · Encargado del departamento',region:region,deptoId:d.id});
    }else{
      push({key:'depto:'+d.id,kind:'depto',label:labelDepto(d.id),meta:labelDepto(d.id)+' · Departamento',region:region,deptoId:d.id});
    }
    getInstructoresActivos(d.id).forEach(function(ins){
      if(!ins.nombre||ins.rol==='encargado_depto')return;
      if(enc&&chatNombresIguales(ins.nombre,enc))return;
      push({
        key:'resp:'+ins.nombre,
        kind:ins.rol==='encargado_oficina'?'enc_ofi':'resp',
        label:ins.nombre,
        meta:chatInstructorMeta(ins,d.id),
        region:region,
        deptoId:d.id,
        oficinaId:(ins.oficinas&&ins.oficinas[0])||''
      });
    });
  });
  OFICINAS_DEGUV.forEach(function(o){
    const enc=getEncargadoOficina(o.id);
    if(o.id==='guaviare'){
      if(enc){
        push({key:'resp:'+enc,kind:'enc_depto',label:enc,meta:labelOficina(o.id)+' · NCA DEGUV',region:'guaviare',oficinaId:o.id,deptoId:'guaviare'});
      }else{
        push({key:'depto:guaviare',kind:'depto',label:labelOficina(o.id),meta:labelOficina(o.id)+' · NCA DEGUV',region:'guaviare',deptoId:'guaviare',oficinaId:o.id});
      }
      return;
    }
    if(enc){
      push({key:'resp:'+enc,kind:'enc_ofi',label:enc,meta:labelOficina(o.id)+' · Encargado de oficina',region:'guaviare',oficinaId:o.id});
    }else{
      push({key:'ofi:'+o.id,kind:'ofi',label:labelOficina(o.id),meta:labelOficina(o.id)+' · Oficina',region:'guaviare',oficinaId:o.id});
    }
    getInstructoresOficina(o.id).forEach(function(ins){
      if(!ins.nombre||ins.rol==='encargado_oficina')return;
      if(enc&&chatNombresIguales(ins.nombre,enc))return;
      push({
        key:'resp:'+ins.nombre,
        kind:'resp',
        label:ins.nombre,
        meta:labelOficina(o.id)+' · '+((typeof INST_ROLES!=='undefined'&&INST_ROLES[ins.rol])||'Responsable'),
        region:'guaviare',
        oficinaId:o.id,
        deptoId:'guaviare'
      });
    });
  });
  (_usuariosCache||[]).forEach(function(u){
    const c=chatUsuarioToContact(u);
    if(c)push(c);
  });
  return out.sort(function(a,b){return a.label.localeCompare(b.label,'es');});
}
function chatContactLastTs(me,contactKey){
  return chatContactPreview(me,contactKey).ts;
}
function chatAvRegionClass(c){
  const r=(c&&c.region)||((c&&c.kind==='admin')?'admin':'guaviare');
  return ' chat-region-'+r;
}
function chatRefreshContactsIfOpen(){
  chatInvalidateContactsCache();
  const w=document.getElementById('chat-window');
  if(w&&w.classList.contains('on')){
    if(typeof scheduleChatOpenUiRefresh==='function')scheduleChatOpenUiRefresh({delay:250,messages:false});
    else renderChatContacts();
  }
}
function chatConvId(keyA,keyB){
  const a=chatCanonicalKey(keyA);
  const b=chatCanonicalKey(keyB);
  if(a===b)return a;
  return [a,b].sort().join('|');
}
function chatConvFirestoreId(convId){
  convId=String(convId||'').trim();
  if(!convId||convId.indexOf('tmp|')===0)return'';
  return convId.replace(/\|/g,'__').replace(/\//g,'_s_');
}
function chatPayloadForFirestore(msg){
  function strip(v){
    if(v===undefined)return undefined;
    if(v===null)return null;
    if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
    if(Array.isArray(v))return v.map(strip).filter(function(x){return x!==undefined;});
    if(typeof v==='object'){
      const o={};
      Object.keys(v).forEach(function(k){
        const x=strip(v[k]);
        if(x!==undefined)o[k]=x;
      });
      return o;
    }
    return undefined;
  }
  return strip(msg)||{};
}
function chatNormalizeConvIdForSave(msg,me,contactKey){
  let convId=String((msg&&msg.convId)||'').trim();
  if(!convId||convId.indexOf('tmp|')===0){
    if(me&&contactKey){
      const route=chatPickSendRoute(me,contactKey);
      convId=route.convId||chatConvId(msg.fromKey,msg.toKey);
    }else{
      convId=chatConvId(msg.fromKey,msg.toKey);
    }
  }
  return convId;
}
function chatFirestoreSaveErrorText(err){
  const code=err&&err.code||'unknown';
  const email=(window._usuarioActual&&window._usuarioActual.email)||'?';
  const rol=(window._usuarioActual&&window._usuarioActual.rol)||'?';
  if(code==='permission-denied'){
    return'No se pudo guardar el mensaje: sin permisos para «'+email+'» (rol: '+rol+'). Verifique que la cuenta esté activa y vuelva a iniciar sesión.';
  }
  if(code==='unauthenticated'){
    return'No se pudo guardar el mensaje: sesión de Firebase expirada. Cierre sesión y vuelva a ingresar.';
  }
  if(code==='invalid-argument'){
    return'No se pudo guardar el mensaje: datos o ruta de conversación inválidos. Recargue con Ctrl+F5 e intente de nuevo.';
  }
  if(code==='unavailable'||code==='failed-precondition'){
    return'No se pudo guardar el mensaje: Firestore no disponible. Revise la conexión e intente otra vez.';
  }
  return'Error al guardar el mensaje en Firestore'+(code!=='unknown'?' ('+code+')':'');
}
async function chatWriteMensajeFirestore(msg,opts){
  opts=opts||{};
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){
    const e=new Error('Firestore no disponible');
    e.code='unavailable';
    throw e;
  }
  if(typeof ensureFirestoreAuthReady==='function'){
    const auth=await ensureFirestoreAuthReady();
    if(!auth.ok){
      const e=new Error('Sin sesión Firebase');
      e.code=auth.code||'unauthenticated';
      throw e;
    }
  }
  const me=opts.me||chatEffectiveIdentity()||getChatIdentity();
  const contactKey=opts.contactKey||window._chatActiveContactKey||chatActiveContactKey()||'';
  msg.convId=chatNormalizeConvIdForSave(msg,me,contactKey);
  const fsConvId=chatConvFirestoreId(msg.convId);
  const msgId=String(msg.id||'').trim();
  if(!fsConvId||!msgId){
    const e=new Error('Ruta de chat inválida');
    e.code='invalid-argument';
    e.detail={convId:msg.convId,fsConvId:fsConvId,msgId:msgId};
    throw e;
  }
  const payload=chatPayloadForFirestore(msg);
  await window._fsSetDoc(window._fsDoc(db,'chats',fsConvId,'mensajes',msgId),payload,{merge:true});
  return{fsConvId:fsConvId,msgId:msgId};
}
async function loadChatMensajes(convId){
  convId=String(convId||'').trim();
  if(!convId)return 0;
  const db=window._db;
  if(!db||!window._fsGetDocs||!window._fsCollection)return 0;
  const fsConvId=chatConvFirestoreId(convId);
  try{
    const snap=await window._fsGetDocs(window._fsCollection(db,'chats',fsConvId,'mensajes'));
    const loaded=snap.docs.map(function(d){return{id:d.id,...d.data()};})
      .sort(function(a,b){
        const ta=typeof a.ts==='string'?a.ts:String(a.ts||'');
        const tb=typeof b.ts==='string'?b.ts:String(b.ts||'');
        return ta.localeCompare(tb);
      });
    chatMensajes=(chatMensajes||[]).filter(function(m){
      const mConv=m.convId||chatConvId(m.fromKey,m.toKey);
      return mConv!==convId;
    });
    chatMensajes.push(...loaded);
    chatMsgIndexReplaceConv(convId,loaded);
    return loaded.length;
  }catch(err){
    console.error('loadChatMensajes:',fsConvId,err);
    return 0;
  }
}
function initChatSync(convId){
  if(_chatUnsub){try{_chatUnsub();}catch(e){}_chatUnsub=null;}
  convId=String(convId||'').trim();
  if(!convId)return;
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  const fsConvId=chatConvFirestoreId(convId);
  _chatUnsub=window._fsOnSnapshot(window._fsCollection(db,'chats',fsConvId,'mensajes'),function(snap){
    snap.docChanges().forEach(function(change){
      const msg={id:change.doc.id,...change.doc.data()};
      chatApplyFirestoreMsgChange(change,msg);
      if(change.type==='added')chatTryDesktopNotify(msg);
    });
    renderChatBadge();
    if(typeof scheduleChatOpenUiRefresh==='function')scheduleChatOpenUiRefresh({delay:120,contacts:false});
    else renderChatMessages();
  });
}
let _chatNotifyUnsubs=[];
let _chatNotifySyncTimer=null;
let _chatNotifyUiTimer=null;
let _chatNotifySettleTimer=null;
let _chatNotifySettling=false;
let _chatContactsPaintSig='';
let _chatMessagesPaintSig='';
function stopChatNotifySync(){
  _chatNotifyUnsubs.forEach(function(fn){try{fn();}catch(e){}});
  _chatNotifyUnsubs=[];
  clearTimeout(_chatNotifyUiTimer);_chatNotifyUiTimer=null;
  clearTimeout(_chatNotifySettleTimer);_chatNotifySettleTimer=null;
  _chatNotifySettling=false;
}
function scheduleChatNotifySync(){
  clearTimeout(_chatNotifySyncTimer);
  _chatNotifySyncTimer=setTimeout(function(){
    _chatNotifySyncTimer=null;
    initChatNotifySync();
  },350);
}
/** Evita reescribir contactos/mensajes en cada tick del collectionGroup (titileo / clics fallidos). */
function scheduleChatOpenUiRefresh(opts){
  opts=opts||{};
  if(window._chatAbrirConvBusy)return;
  const chatWin=document.getElementById('chat-window');
  if(!(chatWin&&chatWin.classList.contains('on')))return;
  clearTimeout(_chatNotifyUiTimer);
  _chatNotifyUiTimer=setTimeout(function(){
    _chatNotifyUiTimer=null;
    if(window._chatAbrirConvBusy)return;
    const w=document.getElementById('chat-window');
    if(!(w&&w.classList.contains('on')))return;
    if(opts.contacts!==false)renderChatContacts();
    if(opts.messages!==false&&window._chatConvActiva)renderChatMessages();
  },opts.delay!=null?opts.delay:220);
}
function chatNotifyMarkSettling(){
  _chatNotifySettling=true;
  clearTimeout(_chatNotifySettleTimer);
  _chatNotifySettleTimer=setTimeout(function(){
    _chatNotifySettling=false;
    scheduleChatOpenUiRefresh({delay:40});
  },900);
}
function chatNotifyShouldSkipDomPaint(isInitialBatch){
  if(window._chatAbrirConvBusy)return true;
  if(isInitialBatch||_chatNotifySettling){
    chatNotifyMarkSettling();
    return true;
  }
  return false;
}
function chatNotifyConvIds(){
  const me=chatEffectiveIdentity();
  if(!me)return[];
  const ids=new Set();
  getChatContacts().forEach(function(c){
    chatConvIdsForContact(me,c.key).forEach(function(id){
      ids.add(chatConvFirestoreId(id));
    });
  });
  (chatMensajes||[]).forEach(function(m){
    if(!chatMsgParticipa(m))return;
    const cid=m.convId||chatConvId(m.fromKey,m.toKey);
    if(cid)ids.add(chatConvFirestoreId(cid));
  });
  return[...ids];
}
function chatContactKeyFromMsg(msg){
  const me=getChatIdentity()||chatEffectiveIdentity();
  if(!me||!msg)return null;
  const mine=chatPersonKeysFor(me.key);
  function esMioKey(k){
    return chatKeyInSet(k,mine);
  }
  let other=esMioKey(msg.fromKey)?msg.toKey:msg.fromKey;
  if(!other)return null;
  const msgConv=msg.convId||chatConvId(msg.fromKey,msg.toKey);
  const contacts=getChatContacts();
  for(let i=0;i<contacts.length;i++){
    const c=contacts[i];
    if(chatNormKey(c.key)===chatNormKey(other))return c.key;
    if(chatPrimaryConvId(me,c.key)===msgConv)return c.key;
    if(chatMsgBetweenContact(msg,me,c.key))return c.key;
  }
  return other;
}
function chatIsViewingMsg(msg){
  if(!msg||!window._chatActiveContactKey)return false;
  const chatWin=document.getElementById('chat-window');
  if(!chatWin||!chatWin.classList.contains('on')||document.hidden)return false;
  const key=chatContactKeyFromMsg(msg);
  if(!key)return false;
  return chatNormKey(window._chatActiveContactKey)===chatNormKey(key);
}
function chatMergeIncomingMsg(msg){
  if(!msg||!msg.id)return;
  const idx=(chatMensajes||[]).findIndex(function(m){return m.id===msg.id;});
  if(idx>=0)chatMensajes[idx]=msg;
  else chatMensajes.push(msg);
  chatMsgIndexUpsert(msg);
}
function chatTryDesktopNotify(msg){
  if(!msg||!chatMsgParticipa(msg)||chatEsMio(msg)||!chatMsgUnreadForMe(msg))return;
  if(chatIsViewingMsg(msg))return;
  if(typeof sstShowDesktopNotify!=='function')return;
  if(typeof sstDesktopNotifyGranted==='function'&&!sstDesktopNotifyGranted()){
    if(typeof Notification!=='undefined'&&Notification.permission==='default'&&typeof sstRequestDesktopNotifyPermission==='function'){
      void sstRequestDesktopNotifyPermission().then(function(ok){
        if(ok&&chatMsgUnreadForMe(msg))chatTryDesktopNotify(msg);
      });
    }
    return;
  }
  const sender=chatFromLabel(msg)||'Chat interno';
  const preview=msg.text||chatMsgDrivePreview(msg)||'Nuevo mensaje';
  sstShowDesktopNotify('Chat interno — '+sender,preview,{
    tag:'chat-'+msg.id,
    onClick:function(){
      if(typeof toggleChatWindow==='function')toggleChatWindow(true);
      const key=chatContactKeyFromMsg(msg);
      if(key)void chatAbrirConv(key);
    }
  });
}
function initChatNotifySync(){
  stopChatNotifySync();
  if(!document.body.classList.contains('sesion-activa'))return;
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollectionGroup)return;
  let primed=false;
  const unsub=window._fsOnSnapshot(window._fsCollectionGroup(db,'mensajes'),function(snap){
    const initial=!primed;
    primed=true;
    snap.docChanges().forEach(function(change){
      if(change.type==='removed'){
        const msg={id:change.doc.id,...change.doc.data()};
        chatApplyFirestoreMsgChange(change,msg);
        return;
      }
      if(change.type!=='added'&&change.type!=='modified')return;
      const msg={id:change.doc.id,...change.doc.data()};
      if(!chatMsgParticipa(msg))return;
      chatMergeIncomingMsg(msg);
      if(!initial&&change.type==='added'&&!chatEsMio(msg)){
        chatTryDesktopNotify(msg);
      }
    });
    renderChatBadge();
    const chatWin=document.getElementById('chat-window');
    if(!(chatWin&&chatWin.classList.contains('on')))return;
    // Descarga inicial / ráfagas: solo badge. Re-pintar DOM rompe clics y hover (~10s).
    if(chatNotifyShouldSkipDomPaint(initial))return;
    scheduleChatOpenUiRefresh({delay:200});
  },function(err){
    console.error('initChatNotifySync collectionGroup:',err);
    stopChatNotifySync();
    chatNotifyConvIdsFallback();
  });
  _chatNotifyUnsubs.push(unsub);
}
function chatNotifyConvIdsFallback(){
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  const convIds=chatNotifyConvIds();
  convIds.forEach(function(fsConvId){
    let primed=false;
    const unsub=window._fsOnSnapshot(window._fsCollection(db,'chats',fsConvId,'mensajes'),function(snap){
      const initial=!primed;
      primed=true;
      snap.docChanges().forEach(function(change){
        if(change.type==='removed'){
          const msg={id:change.doc.id,...change.doc.data()};
          chatApplyFirestoreMsgChange(change,msg);
          return;
        }
        if(change.type!=='added'&&change.type!=='modified')return;
        const msg={id:change.doc.id,...change.doc.data()};
        if(!chatMsgParticipa(msg))return;
        chatMergeIncomingMsg(msg);
        if(!initial&&change.type==='added'&&!chatEsMio(msg))chatTryDesktopNotify(msg);
      });
      renderChatBadge();
      if(!(document.getElementById('chat-window')&&document.getElementById('chat-window').classList.contains('on')))return;
      if(chatNotifyShouldSkipDomPaint(initial))return;
      scheduleChatOpenUiRefresh({delay:200});
    });
    _chatNotifyUnsubs.push(unsub);
  });
}
function chatConvMessages(convId){
  chatEnsureMsgIndex();
  const canon=String(convId||'');
  return window._chatMsgsByConv.get(canon)||[];
}
function chatContactFromKey(key){
  key=String(key||'');
  if(chatNormKey(key).startsWith('admin:')||chatKeysMatch(key,CHAT_ADMIN_KEY))
    return{kind:'admin',key:CHAT_ADMIN_KEY,label:CHAT_ADMIN_LABEL,meta:'Avisos del sistema',region:'admin'};
  const found=getChatContactsList().find(function(c){return chatKeysMatch(c.key,key);});
  if(found)return found;
  if(key.startsWith('juris:'))return{kind:'juris',key,label:CHAT_LABEL_SUBDIRECCION,meta:'Subdirección · Jurisdiccional',region:'juris'};
  if(key.startsWith('depto:')){const id=key.slice(6);const enc=getEncargadoDepto(id);return{kind:'depto',key,label:enc||labelDepto(id),deptoId:id,meta:labelDepto(id)+' · Departamento',region:chatRegionForDepto(id)};}
  if(key.startsWith('ofi:')){const id=key.slice(4);const enc=getEncargadoOficina(id);return{kind:'ofi',key,label:enc||labelOficina(id),oficinaId:id,meta:labelOficina(id)+' · Oficina',region:'guaviare'};}
  if(key.startsWith('resp:'))return{kind:'resp',key,label:key.slice(5),meta:'Responsable',region:'guaviare'};
  return{kind:'resp',key,label:key,meta:'',region:'guaviare'};
}
function chatAvClass(kind){return kind==='admin'?' admin':kind==='depto'?' depto':kind==='juris'?' juris':kind==='ofi'?' ofi':kind==='enc_ofi'?' enc_ofi':kind==='resp'?' resp':'';}
function chatAvLetter(label){return String(label||'?').trim().charAt(0).toUpperCase();}
function chatEsMio(m){
  if(!m||!m.fromKey)return false;
  const my=getMyChatKeys();
  const fk=chatNormKey(m.fromKey);
  if(my.includes(fk))return true;
  return chatKeyAliases(m.fromKey).some(function(a){return my.includes(chatNormKey(a));});
}
function chatPreviewMsg(m,me){
  if(!m)return'Sin mensajes';
  const body=m.text||(m.file?('📎 '+(m.file.nombre||m.file.name||'archivo')):'');
  if(!chatEsMio(m))return escAttr((chatFromLabel(m)||'')+(body?': '+body:''));
  return escAttr(body||'');
}
function chatPersonLabelFromKey(key){
  key=chatNormKey(key);
  if(!key)return'';
  if(key.startsWith('admin:')||key===chatNormKey(CHAT_ADMIN_KEY))return CHAT_ADMIN_LABEL;
  if(key.startsWith('resp:'))return key.slice(5);
  if(key.startsWith('depto:')){
    const id=key.slice(6);
    const enc=getEncargadoDepto(id);
    return enc||labelDepto(id);
  }
  if(key.startsWith('ofi:')){
    const id=key.slice(4);
    const enc=getEncargadoOficina(id);
    if(enc)return enc;
    return labelOficina(id);
  }
  if(key.startsWith('juris:')){
    const u=(_usuariosCache||[]).find(function(x){return x&&x.activo!==false&&x.rol==='jurisdiccional'&&String(x.nombre||'').trim();});
    if(u)return String(u.nombre).trim();
    return CHAT_LABEL_SUBDIRECCION;
  }
  const c=chatContactFromKey(key);
  return c.label||'';
}
function chatSendFromLabel(me){
  if(!me)return'';
  if(me.kind==='admin'||chatKeysMatch(me.key,CHAT_ADMIN_KEY))return CHAT_ADMIN_LABEL;
  const ses=chatSessionUserContact();
  if(ses&&ses.label)return ses.label;
  const lbl=chatPersonLabelFromKey(chatPreferSendKey(me)||me.key);
  if(lbl)return lbl;
  return me.label||'';
}
function chatFromLabel(m){
  if(!m)return'';
  const byKey=chatPersonLabelFromKey(m.fromKey||'');
  if(byKey)return byKey;
  if(m.fromLabel){
    if(m.fromLabel==='Jurisdiccional')return CHAT_LABEL_SUBDIRECCION;
    return m.fromLabel;
  }
  return'';
}
function chatMsgUnreadForMe(m){
  const my=getMyChatKeys();
  if(!my.length)return false;
  if(chatEsMio(m))return false;
  const rb=(m.readBy||[]).map(chatNormKey);
  return !my.some(function(k){return rb.includes(k);});
}
function chatMyKeysCanon(){
  const s=new Set();
  getMyChatKeys().forEach(function(k){s.add(chatCanonicalKey(k));});
  return s;
}
function chatPreferSendKey(me){
  if(!me)return'';
  if(me.kind==='admin'||chatKeysMatch(me.key,CHAT_ADMIN_KEY))return CHAT_ADMIN_KEY;
  const ses=chatSessionUserContact();
  if(ses&&ses.key.startsWith('resp:'))return ses.key;
  if(me.key.startsWith('resp:'))return me.key;
  if(me.kind==='ofi'&&me.oficinaId){
    const enc=getEncargadoOficina(me.oficinaId);
    if(enc)return'resp:'+enc;
  }
  if(me.kind==='depto'&&me.deptoId){
    const enc=getEncargadoDepto(me.deptoId);
    if(enc)return'resp:'+enc;
  }
  return me.key;
}
function chatConvIdsForPair(meKey,contactKey){
  const ids=new Set();
  const to=chatContactFromKey(contactKey);
  chatPersonKeysFor(meKey).forEach(function(a){
    chatPersonKeysFor(to.key).forEach(function(b){
      if(chatNormKey(a)!==chatNormKey(b))ids.add(chatConvId(a,b));
    });
  });
  return ids;
}
function chatPrimaryConvId(me,contactKey){
  if(!me||!contactKey)return'';
  const to=chatContactFromKey(contactKey);
  return chatConvId(chatPreferSendKey(me),to.key);
}
function chatMsgBetweenContact(m,me,contactKey){
  if(!m||!me||!contactKey)return false;
  const mConv=m.convId||chatConvId(m.fromKey,m.toKey);
  return chatConvIdsForPair(me.key,contactKey).has(mConv);
}
function chatPickSendRoute(me,contactKey){
  contactKey=String(contactKey||'').trim();
  const fallback=chatContactFromKey(contactKey);
  const msgs=chatMsgsForContact(me,contactKey);
  if(!msgs.length){
    const fromKey=chatPreferSendKey(me);
    return{
      convId:chatConvId(fromKey,fallback.key),
      fromKey:fromKey,
      toKey:fallback.key,
      toLabel:fallback.label
    };
  }
  const last=msgs[msgs.length-1];
  let convId=last.convId||chatConvId(last.fromKey,last.toKey);
  if(!convId||String(convId).indexOf('tmp|')===0){
    convId=chatConvId(chatPreferSendKey(me),fallback.key);
  }
  const keys=convId.split('|');
  let fromKey=chatPreferSendKey(me);
  keys.forEach(function(k){
    if(chatKeyInMyKeys(k))fromKey=k;
  });
  const myCanon=chatMyKeysCanon();
  const otherKey=keys.find(function(k){return !myCanon.has(chatCanonicalKey(k));})||contactKey;
  const to=chatContactFromKey(otherKey);
  return{convId:convId,fromKey:fromKey,toKey:to.key,toLabel:to.label};
}
function chatConvIdsForContact(me,contactKey){
  contactKey=String(contactKey||'');
  if(!me||!contactKey)return[];
  return[...chatConvIdsForPair(me.key,contactKey)];
}
function chatMsgsForContact(me,contactKey){
  if(!me||!contactKey)return[];
  const seen=new Set(),out=[];
  chatConvIdsForContact(me,contactKey).forEach(function(id){
    chatConvMessages(id).forEach(function(m){
      if(seen.has(m.id))return;
      if(!chatMsgBetweenContact(m,me,contactKey))return;
      seen.add(m.id);
      out.push(m);
    });
  });
  return out.sort(function(a,b){return(a.ts||'').localeCompare(b.ts||'');});
}
function chatActiveContactKey(){
  if(window._chatActiveContactKey)return window._chatActiveContactKey;
  const convId=window._chatConvActiva;
  const me=getChatIdentity();
  if(!me||!convId)return null;
  const myCanon=chatMyKeysCanon();
  const keys=convId.split('|').filter(Boolean);
  const other=keys.find(function(k){return !myCanon.has(chatCanonicalKey(k));});
  return other||null;
}
function chatContactUnreadCount(me,contactKey){
  return chatContactPreview(me,contactKey).unread;
}
async function loadChatMensajesForContact(me,contactKey){
  const ids=chatConvIdsForContact(me,contactKey);
  let total=0;
  for(let i=0;i<ids.length;i++)total+=await loadChatMensajes(ids[i]);
  return total;
}
let _chatActiveUnsubs=[];
function stopChatActiveSync(){
  _chatActiveUnsubs.forEach(function(fn){try{fn();}catch(e){}});
  _chatActiveUnsubs=[];
  if(_chatUnsub){try{_chatUnsub();}catch(e){}_chatUnsub=null;}
}
function initChatSyncForContact(contactKey){
  stopChatActiveSync();
  contactKey=String(contactKey||'').trim();
  if(!contactKey)return;
  const me=chatEffectiveIdentity()||getChatIdentity();
  if(!me)return;
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  const convIds=chatConvIdsForContact(me,contactKey);
  convIds.forEach(function(convId){
    const fsConvId=chatConvFirestoreId(convId);
    const unsub=window._fsOnSnapshot(window._fsCollection(db,'chats',fsConvId,'mensajes'),function(snap){
      snap.docChanges().forEach(function(change){
        const msg={id:change.doc.id,...change.doc.data()};
        chatApplyFirestoreMsgChange(change,msg);
        if(change.type==='added')chatTryDesktopNotify(msg);
      });
      renderChatBadge();
      if(typeof scheduleChatOpenUiRefresh==='function')scheduleChatOpenUiRefresh({delay:150});
      else{renderChatMessages();renderChatContacts();}
    });
    _chatActiveUnsubs.push(unsub);
  });
}
function chatMsgsForDeptResp(deptoId,respKey){
  return chatMsgsForContact({kind:'depto',key:'depto:'+deptoId,deptoId:deptoId},respKey);
}
function chatMsgsForActiveConv(){
  const me=chatEffectiveIdentity()||getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!me||!contactKey)return[];
  return chatMsgsForContact(me,contactKey);
}
function chatUnreadMe(){
  return chatEffectiveIdentity()||getChatIdentity();
}
function chatUnreadCount(){
  const me=chatUnreadMe();
  if(!me)return 0;
  let n=0;
  const covered=new Set();
  getChatContacts().forEach(function(c){
    n+=chatContactUnreadCount(me,c.key);
    chatConvIdsForContact(me,c.key).forEach(function(id){covered.add(id);});
  });
  (chatMensajes||[]).forEach(function(m){
    if(!chatMsgParticipa(m)||!chatMsgUnreadForMe(m))return;
    const cid=m.convId||chatConvId(m.fromKey,m.toKey);
    if(!covered.has(cid))n++;
  });
  return n;
}
function chatUnreadConv(convId){
  const me=getChatIdentity();
  if(!me||!convId)return 0;
  const myCanon=chatKeyAliases(me.key).map(chatCanonicalKey);
  const keys=convId.split('|');
  const other=keys.find(function(k){return !myCanon.includes(chatCanonicalKey(k));});
  if(other)return chatContactUnreadCount(me,other);
  return chatConvMessages(convId).filter(chatMsgUnreadForMe).length;
}
async function chatMarcarLeido(convId){
  const my=getMyChatKeys();
  if(!my.length)return;
  const me=chatEffectiveIdentity()||getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  let msgs=contactKey&&me?chatMsgsForContact(me,contactKey):chatConvMessages(convId);
  let ch=false;
  const db=window._db;
  const fsUpdates=[];
  msgs.forEach(m=>{
    if(!m.readBy)m.readBy=[];
    const rbSet=new Set(m.readBy.map(chatNormKey));
    const toAdd=[];
    my.forEach(k=>{
      if(!rbSet.has(k)){m.readBy.push(k);toAdd.push(k);ch=true;}
    });
    if(toAdd.length&&db&&window._fsUpdateDoc&&window._fsDoc&&window._fsArrayUnion&&m.id){
      const fsConvId=chatConvFirestoreId(m.convId||convId);
      fsUpdates.push(window._fsUpdateDoc(
        window._fsDoc(db,'chats',fsConvId,'mensajes',m.id),
        {readBy:window._fsArrayUnion(...toAdd)}
      ));
    }
  });
  if(ch){
    renderChatBadge();
    renderChatContacts();
    if(fsUpdates.length){
      try{await Promise.all(fsUpdates);}
      catch(err){console.error('chatMarcarLeido:',err);}
    }
  }
}
function renderChatBadge(){
  void purgeChatConversacionesLeidas();
  const n=chatUnreadCount();
  const b=document.getElementById('chat-fab-badge');
  const fab=document.getElementById('chat-fab');
  if(!b)return;
  const prev=Number(b.dataset.count||'0');
  if(n>0){
    const txt=n>99?'99+':String(n);
    b.textContent=txt;
    b.style.cssText='position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(220,38,38,.45);z-index:3;';
    b.dataset.count=String(n);
    b.setAttribute('aria-label',n===1?'1 mensaje no leído':n+' mensajes no leídos');
    if(fab&&n>prev)fab.classList.add('chat-fab-pulse');
  }else{
    b.style.display='none';
    b.textContent='0';
    b.dataset.count='0';
    if(fab)fab.classList.remove('chat-fab-pulse');
  }
}
function toggleChatWindow(force){
  const w=document.getElementById('chat-window');
  const fab=document.getElementById('chat-fab');
  if(!w)return;
  const open=force===true?true:force===false?false:!w.classList.contains('on');
  w.classList.toggle('on',open);
  if(fab)fab.classList.toggle('open',open);
  if(open){
    window._chatConvActiva=null;
    window._chatActiveContactKey=null;
    window._chatVista='contactos';
    window._chatContactsCollapsed=false;
    window._chatSearchOpen=false;
    window._chatContactQ='';
    _chatContactsPaintSig='';
    _chatMessagesPaintSig='';
    chatInvalidateContactsCache();
    const sub=document.getElementById('chat-hdr-sub');
    if(sub)sub.textContent='Seleccione un contacto';
    chatSyncSearchBarUi();
    chatSyncLayout();
    renderChatContacts();
    renderChatBadge();
    if(typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
    setTimeout(function(){if(typeof sstInitWaComposers==='function')sstInitWaComposers(document.getElementById('chat-window')||document);},50);
    if(typeof chatPurgeExpiredDriveFiles==='function'){
      void chatPurgeExpiredDriveFiles().then(function(ok){
        if(ok){
          if(window._chatConvActiva)renderChatMessages();
          if(typeof scheduleChatOpenUiRefresh==='function')scheduleChatOpenUiRefresh({delay:100});
          else{renderChatContacts();chatSyncLayout();}
        }
      });
    }
  }
  else{window._chatConvActiva=null;window._chatActiveContactKey=null;window._chatVista='contactos';window._chatContactsCollapsed=false;window._chatSearchOpen=false;window._chatContactQ='';_chatFileUploading=false;chatUploadOverlayHide();stopChatActiveSync();chatSyncSearchBarUi();chatSyncLayout();}
}
function chatPurgeUnreadButton(){
  document.querySelectorAll('#chat-unread-btn,[onclick*="chatMarcarNoLeido"],[title*="Marcar como no leído"],[title*="no leído"]').forEach(function(el){el.remove();});
}
function chatInitUnreadButtonGuard(){
  if(window._chatUnreadBtnGuard)return;
  window._chatUnreadBtnGuard=true;
  window.chatMarcarNoLeido=function(){};
  chatPurgeUnreadButton();
  const hdr=document.querySelector('.chat-hdr-actions');
  if(hdr&&typeof MutationObserver!=='undefined'){
    const obs=new MutationObserver(function(){chatPurgeUnreadButton();});
    obs.observe(hdr,{childList:true,subtree:true});
  }
}
function chatToggleContactos(force){
  // Contactos siempre visibles: no colapsar
  window._chatContactsCollapsed=false;
  chatSyncLayout();
}
/** Normaliza texto para buscar contactos (sin acentos). */
function chatNormSearch(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function chatContactMatchesQuery(c,qNorm){
  if(!qNorm)return true;
  if(!c)return false;
  const blob=chatNormSearch([c.label,c.meta,c.sub,c.email,c.nombre,c.key].filter(Boolean).join(' '));
  return blob.includes(qNorm);
}
function chatSyncSearchBarUi(){
  const open=!!window._chatSearchOpen;
  const bar=document.getElementById('chat-search-bar');
  const btn=document.getElementById('chat-search-btn');
  const inp=document.getElementById('chat-contact-q');
  if(bar){
    bar.hidden=!open;
    bar.style.display=open?'block':'none';
    bar.classList.toggle('is-open',open);
  }
  if(btn){
    btn.classList.toggle('is-on',open);
    btn.setAttribute('aria-pressed',open?'true':'false');
  }
  if(open&&inp){
    if(typeof window._chatContactQ==='string'&&inp.value!==window._chatContactQ)inp.value=window._chatContactQ;
    setTimeout(function(){try{inp.focus();}catch(e){}},30);
  }
}
function chatToggleContactSearch(force){
  const next=force===true?true:force===false?false:!window._chatSearchOpen;
  window._chatSearchOpen=next;
  if(!next){
    window._chatContactQ='';
    const inp=document.getElementById('chat-contact-q');
    if(inp)inp.value='';
  }
  chatSyncSearchBarUi();
  _chatContactsPaintSig='';
  renderChatContacts();
}
function chatOnContactSearchInput(){
  const inp=document.getElementById('chat-contact-q');
  window._chatContactQ=inp?String(inp.value||''):'';
  window._chatSearchOpen=true;
  _chatContactsPaintSig='';
  renderChatContacts();
}
function chatClearContactSearch(){
  chatToggleContactSearch(false);
}
window.chatToggleContactSearch=chatToggleContactSearch;
window.chatOnContactSearchInput=chatOnContactSearchInput;
window.chatClearContactSearch=chatClearContactSearch;
function chatInitContactsClicks(){
  const el=document.getElementById('chat-contacts');
  if(!el||el.dataset.chatClickBound==='1')return;
  el.dataset.chatClickBound='1';
  el.addEventListener('click',function(ev){
    const row=ev.target&&ev.target.closest?ev.target.closest('.chat-contact[data-chat-key]'):null;
    if(!row||!el.contains(row))return;
    ev.preventDefault();
    ev.stopPropagation();
    const key=String(row.getAttribute('data-chat-key')||'').trim();
    if(key)void chatAbrirConv(key);
  });
}
function chatSyncLayout(){
  chatInitUnreadButtonGuard();
  chatPurgeUnreadButton();
  chatInitContactsClicks();
  const contacts=document.getElementById('chat-contacts');
  const main=document.getElementById('chat-main');
  const back=document.getElementById('chat-back-btn');
  const toggleBtn=document.getElementById('chat-toggle-contacts-btn');
  const conv=window._chatConvActiva||window._chatVista==='admin_broadcast';
  window._chatContactsCollapsed=false;
  if(contacts){
    // Lista siempre visible: ancha al elegir contacto; al lado al conversar
    if(conv){
      contacts.classList.remove('wide','collapsed');
      contacts.classList.add('with-conv');
      contacts.style.display='';
    }else{
      contacts.classList.add('wide');
      contacts.classList.remove('with-conv','collapsed');
      contacts.style.display='';
    }
  }
  if(main){
    main.classList.toggle('hidden',!conv);
    if(conv){
      main.style.display='flex';
      main.style.flex='1';
      main.style.minWidth='0';
    }else{
      main.style.display='';
    }
  }
  // Solo flecha atrás en móvil (lista sigue visible en escritorio)
  const mobile=window.innerWidth<640;
  if(back)back.style.display=(conv&&mobile)?'inline-flex':'none';
  if(toggleBtn)toggleBtn.style.display='none';
}
function chatVolverContactos(){
  stopChatActiveSync();
  window._chatConvActiva=null;
  window._chatActiveContactKey=null;
  window._chatVista='contactos';
  window._chatContactsCollapsed=false;
  chatClearReplyTo();
  chatCloseEmojiPicker();
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent='Chat interno';
  if(sub)sub.textContent='Seleccione un contacto';
  const compose=document.querySelector('#chat-main .chat-compose');
  if(compose)compose.style.display='';
  const banner=document.getElementById('chat-readonly-banner');
  if(banner){banner.hidden=true;banner.style.display='none';}
  chatSyncLayout();
  renderChatContacts();
}
function renderChatContacts(){
  const el=document.getElementById('chat-contacts');
  if(!el)return;
  chatInitContactsClicks();
  try{
    const me=chatEffectiveIdentity();
    if(!me){
      el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Seleccione departamento o responsable para usar el chat.</div>';
      chatSyncLayout();
      return;
    }
    if(!Array.isArray(window._chatContactsCache))window._chatContactsCache=getChatContacts();
    let contacts=window._chatContactsCache;
    if(!contacts.length){
      el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Sin contactos disponibles.</div>';
      chatSyncLayout();
      return;
    }
    contacts=contacts.slice().sort(function(a,b){
      let ta='',tb='';
      try{ta=chatContactLastTs(me,a.key);tb=chatContactLastTs(me,b.key);}catch(e){}
      if(ta!==tb)return tb.localeCompare(ta);
      let ua=0,ub=0;
      try{ua=chatContactUnreadCount(me,a.key);ub=chatContactUnreadCount(me,b.key);}catch(e){}
      if(ua!==ub)return ub-ua;
      return String(a.label||'').localeCompare(String(b.label||''),'es');
    });
    const qRaw=String(window._chatContactQ||'').trim();
    const qNorm=chatNormSearch(qRaw);
    if(qNorm)contacts=contacts.filter(function(c){return chatContactMatchesQuery(c,qNorm);});
    chatSyncSearchBarUi();
    if(!contacts.length){
      const adminToolsEmpty=(typeof esAdministrador==='function'&&esAdministrador())
        ?('<div class="chat-admin-tools"><button type="button" class="btn bsm bp chat-admin-bcast-btn" onclick="event.stopPropagation();chatAdminAbrirBroadcast()">📢 Enviar aviso</button></div>')
        :'';
      const emptyMsg=qNorm
        ?('<div class="chat-contacts-empty-search">Sin contactos para «'+escAttr(qRaw)+'»</div>')
        :'<div style="padding:14px;font-size:12px;color:var(--tx3)">Sin contactos disponibles.</div>';
      el.innerHTML=adminToolsEmpty+emptyMsg;
      _chatContactsPaintSig='';
      chatSyncLayout();
      return;
    }
    const html=contacts.map(function(c){
      const convId=chatConvId(me.key,c.key);
      let prev='Sin mensajes',unread=0;
      try{
        const pv=chatContactPreview(me,c.key);
        prev=pv.prev;
        unread=pv.unread;
      }catch(e){}
      const active=window._chatActiveContactKey===c.key||window._chatConvActiva===convId||chatActiveContactKey()===c.key;
      const meta=c.meta||c.sub||'';
      return '<div class="chat-contact'+(active?' on':'')+(unread?' has-unread':'')+(c.kind==='admin'?' chat-contact-admin':'')+'" role="button" tabindex="0" data-chat-key="'+escAttr(c.key)+'">'+
        '<div class="chat-contact-av'+chatAvRegionClass(c)+'">'+chatAvLetter(c.label)+'</div>'+
        '<div class="chat-contact-info"><div class="chat-contact-name">'+escAttr(c.label)+'</div>'+
        (meta?'<div class="chat-contact-meta">'+escAttr(meta)+'</div>':'')+
        '<div class="chat-contact-prev">'+escAttr(prev)+'</div></div>'+
        (unread?'<span class="chat-contact-unread" style="min-width:20px;height:20px;padding:0 5px;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:10px;background:var(--gn,#1a7a4a)">'+unread+'</span>':'')+
        '</div>';
    }).join('');
    const adminTools=(typeof esAdministrador==='function'&&esAdministrador())
      ?('<div class="chat-admin-tools"><button type="button" class="btn bsm bp chat-admin-bcast-btn" onclick="event.stopPropagation();chatAdminAbrirBroadcast()">📢 Enviar aviso</button></div>')
      :'';
    const sig=(window._chatActiveContactKey||'')+'|'+(window._chatVista||'')+'|q:'+qNorm+'|'+adminTools+html;
    if(sig===_chatContactsPaintSig){chatSyncLayout();return;}
    _chatContactsPaintSig=sig;
    el.innerHTML=adminTools+html;
  }catch(err){
    console.error('renderChatContacts:',err);
    el.innerHTML='<div style="padding:14px;font-size:12px;color:#b42318">No se pudo cargar la lista de contactos. Recargue con Ctrl+F5.</div>';
    _chatContactsPaintSig='';
  }
  chatSyncLayout();
}
async function chatAbrirConv(contactKey){
  chatPurgeUnreadButton();
  contactKey=String(contactKey||'').trim();
  if(!contactKey)return;
  const me=chatEffectiveIdentity()||getChatIdentity();
  if(!me){
    if(typeof notif==='function')notif('No se pudo identificar su cuenta de chat. Vuelva a entrar o elija departamento.','warn');
    return;
  }
  // Evitar doble apertura / carreras con re-render de Firestore
  if(window._chatAbrirConvBusy===contactKey&&window._chatConvActiva&&window._chatActiveContactKey===contactKey){
    chatSyncLayout();
    const inpBusy=document.getElementById('chat-inp');
    if(inpBusy){try{inpBusy.focus();}catch(e){}}
    return;
  }
  window._chatAbrirConvBusy=contactKey;
  window._chatActiveContactKey=contactKey;
  chatResetMsgWindow();
  window._chatVista='chat';
  // Primer clic: abrir conversación con contactos siempre a la vista
  window._chatContactsCollapsed=false;
  chatClearReplyTo();
  const c=chatContactFromKey(contactKey);
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent=(c&&c.label)||'Conversación';
  if(sub)sub.textContent=(c&&(c.meta||c.sub))||'Conversación';
  const convId=chatPrimaryConvId(me,contactKey);
  window._chatConvActiva=convId||('tmp|'+contactKey);
  chatSyncLayout();
  renderChatContacts();
  renderChatMessages();
  chatSyncComposeReadonly();
  setTimeout(function(){
    const inp=document.getElementById('chat-inp');
    if(inp&&chatPuedeResponderAContacto(contactKey)){try{inp.focus();}catch(e){}}
    if(typeof sstInitWaComposers==='function')sstInitWaComposers(document.getElementById('chat-main')||document);
  },30);
  try{
    await loadChatMensajesForContact(me,contactKey);
    if(window._chatActiveContactKey!==contactKey)return;
    initChatSyncForContact(contactKey);
    await chatMarcarLeido(window._chatConvActiva);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
  }catch(err){
    console.error('chatAbrirConv:',err);
    if(typeof notif==='function')notif('No se pudieron cargar los mensajes. Puede escribir de todos modos.','warn');
  }finally{
    if(window._chatAbrirConvBusy===contactKey)window._chatAbrirConvBusy='';
  }
}
window.chatAbrirConv=chatAbrirConv;
window.chatVolverContactos=chatVolverContactos;
window.chatSyncLayout=chatSyncLayout;
window.toggleChatWindow=toggleChatWindow;
function chatMsgDriveUrl(m){
  if(!m)return'';
  if(m.driveLink)return normalizeDriveUrlInput(m.driveLink);
  if(m.file&&m.file.driveLink)return normalizeDriveUrlInput(m.file.driveLink);
  if(m.file&&m.file.url&&!m.file.data)return normalizeDriveUrlInput(m.file.url);
  return'';
}
function chatMsgFileId(m){
  if(!m)return'';
  if(m.file&&m.file.fileId)return String(m.file.fileId);
  const url=chatMsgDriveUrl(m);
  const mt=url.match(/\/file\/d\/([^/?#]+)/);
  return mt?mt[1]:'';
}
function chatMsgFileDisplayName(m){
  const f=(m&&m.file)||{};
  if(f.origName)return String(f.origName);
  const n=String(f.nombre||f.name||'').trim();
  if(!n)return'';
  const stripped=n.match(/^\d{4}-\d{2}-\d{2}\s+(.+)$/);
  return stripped?stripped[1]:n;
}
function chatMsgMime(m){
  const f=(m&&m.file)||{};
  if(f.mime)return String(f.mime);
  if(f.mimeType)return String(f.mimeType);
  const name=chatMsgFileDisplayName(m)||String(f.nombre||f.name||'');
  const ext=(name.split('.').pop()||'').toLowerCase();
  const byExt={
    pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',
    doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip:'application/zip'
  };
  return byExt[ext]||'application/octet-stream';
}
function chatIsImageMime(mime){
  return String(mime||'').toLowerCase().startsWith('image/');
}
function chatAttachmentKind(mime,name){
  const n=String(name||'').toLowerCase();
  const mi=String(mime||'').toLowerCase();
  if(chatIsImageMime(mi))return'image';
  if(mi==='application/pdf'||/\.pdf$/i.test(n))return'pdf';
  if(mi.startsWith('video/')||/\.(mp4|webm|mov)$/i.test(n))return'video';
  if(/word|msword|document\.word|\.docx?$/i.test(mi+n))return'word';
  if(/sheet|excel|spreadsheet|\.xlsx?$/i.test(mi+n))return'sheet';
  if(/zip|compressed|\.zip$/i.test(mi+n))return'zip';
  return'file';
}
function chatAttachmentTypeLabel(kind){
  return{image:'Imagen',pdf:'PDF',video:'Video',word:'Documento',sheet:'Hoja de cálculo',zip:'Comprimido',file:'Archivo'}[kind]||'Archivo';
}
function chatAttachIconLabel(kind){
  return{pdf:'PDF',word:'DOC',sheet:'XLS',zip:'ZIP',video:'▶',file:'📎',image:'🖼️'}[kind]||'📎';
}
function chatDriveThumbUrl(fileId,sz){
  fileId=String(fileId||'').trim();
  if(!fileId)return'';
  return'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w'+String(sz||320);
}
function chatAttachThumbFail(img){
  if(!img||img.dataset.fallback==='1')return;
  img.dataset.fallback='1';
  img.style.display='none';
  const wrap=img.parentElement;
  const fb=wrap&&wrap.querySelector('.chat-attach-wa-doc-fallback');
  if(fb)fb.style.display='flex';
}
function chatAttachmentHtml(m){
  const driveUrl=chatMsgDriveUrl(m);
  if(!driveUrl)return'';
  const deleted=!!(m.file&&m.file.driveDeleted);
  const fileId=chatMsgFileId(m);
  const mime=chatMsgMime(m);
  const name=chatMsgFileDisplayName(m)||'Archivo';
  const kind=chatAttachmentKind(mime,name);
  const typeLbl=chatAttachmentTypeLabel(kind);
  if(deleted){
    return'<div class="chat-attach-wa chat-attach-wa--expired" aria-label="Archivo expirado">'+
      '<div class="chat-attach-wa-preview chat-attach-wa-preview--icon"><span class="chat-attach-wa-type-badge">⏱</span></div>'+
      '<div class="chat-attach-wa-foot"><span class="chat-attach-wa-name">'+escAttr(name)+'</span>'+
      '<span class="chat-attach-wa-meta">Expirado</span></div></div>';
  }
  const thumb=fileId?chatDriveThumbUrl(fileId,kind==='image'?480:320):'';
  let preview='';
  if(kind==='image'&&thumb){
    preview=
      '<div class="chat-attach-wa-preview chat-attach-wa-preview--image">'+
      '<img class="chat-attach-wa-thumb" src="'+escAttr(thumb)+'" alt="" loading="lazy" decoding="async" onerror="chatAttachThumbFail(this)">'+
      '<div class="chat-attach-wa-doc-fallback" style="display:none"><span class="chat-attach-wa-fallback-ico" aria-hidden="true">🖼️</span></div></div>';
  }else if(thumb&&(kind==='pdf'||kind==='video')){
    preview=
      '<div class="chat-attach-wa-preview chat-attach-wa-preview--doc">'+
      '<img class="chat-attach-wa-thumb" src="'+escAttr(thumb)+'" alt="" loading="lazy" decoding="async" onerror="chatAttachThumbFail(this)">'+
      '<div class="chat-attach-wa-doc-fallback" style="display:none">'+
      '<span class="chat-attach-wa-type-badge chat-attach-wa-type-'+kind+'">'+escAttr(chatAttachIconLabel(kind))+'</span></div>'+
      (kind==='video'?'<span class="chat-attach-wa-play" aria-hidden="true">▶</span>':'')+
      '</div>';
  }else{
    preview=
      '<div class="chat-attach-wa-preview chat-attach-wa-preview--icon">'+
      '<span class="chat-attach-wa-type-badge chat-attach-wa-type-'+kind+'">'+escAttr(chatAttachIconLabel(kind))+'</span></div>';
  }
  return'<a class="chat-attach-wa chat-attach-wa--'+kind+'" href="'+escAttr(driveUrl)+'" target="_blank" rel="noopener noreferrer" title="Abrir '+escAttr(name)+'">'+
    preview+
    '<div class="chat-attach-wa-foot"><span class="chat-attach-wa-name">'+escAttr(name)+'</span>'+
    '<span class="chat-attach-wa-meta">'+escAttr(typeLbl)+'</span></div></a>';
}
function chatMsgDrivePreview(m){
  if(!chatMsgDriveUrl(m))return'';
  const kind=chatAttachmentKind(chatMsgMime(m),chatMsgFileDisplayName(m));
  if(kind==='image')return'📷 Imagen';
  if(kind==='pdf')return'📄 PDF';
  if(kind==='video')return'🎬 Video';
  const name=chatMsgFileDisplayName(m);
  if(name){
    const short=name.length>36?name.slice(0,33)+'…':name;
    return'📎 '+short;
  }
  return'📄 Archivo';
}
function chatLinkifyText(text){
  const s=String(text||'');
  if(!s)return'';
  const urlRe=/(https?:\/\/[^\s<>"']+)/gi;
  let out='',last=0,m;
  while((m=urlRe.exec(s))){
    out+=escAttr(s.slice(last,m.index));
    const url=m[1];
    out+='<a class="chat-msg-link" href="'+escAttr(url)+'" target="_blank" rel="noopener noreferrer">'+escAttr(url)+'</a>';
    last=m.index+m[0].length;
  }
  out+=escAttr(s.slice(last));
  return out.replace(/\n/g,'<br>');
}
function chatMsgPreviewText(m){
  if(!m)return'';
  const t=String(m.text||'').replace(/\s+/g,' ').trim();
  if(t)return t.length>90?t.slice(0,87)+'…':t;
  return chatMsgDrivePreview(m)||'Mensaje';
}
function chatReplyPayloadFromMsg(m){
  if(!m||!m.id)return null;
  return{
    id:String(m.id),
    fromLabel:String((typeof chatFromLabel==='function'?chatFromLabel(m):'')||m.fromLabel||'').trim(),
    text:chatMsgPreviewText(m)
  };
}
function chatFindMsgById(msgId){
  msgId=String(msgId||'');
  if(!msgId)return null;
  const list=(typeof chatMsgsForActiveConv==='function'?chatMsgsForActiveConv():[])||[];
  return list.find(function(m){return m&&String(m.id)===msgId;})||null;
}
function chatRenderReplyBar(){
  const bar=document.getElementById('chat-reply-bar');
  if(!bar)return;
  const r=window._chatReplyTo;
  if(!r||!r.id){
    bar.style.display='none';
    bar.innerHTML='';
    return;
  }
  const who=r.fromLabel||'Mensaje';
  bar.style.display='flex';
  bar.innerHTML=
    '<div class="chat-reply-bar-main">'+
      '<div class="chat-reply-bar-lbl">↩ Respondiendo a</div>'+
      '<div class="chat-reply-bar-author">'+escAttr(who)+'</div>'+
      '<div class="chat-reply-bar-text">'+escAttr(r.text||'')+'</div>'+
    '</div>'+
    '<button type="button" class="chat-reply-bar-x" title="Cancelar respuesta" aria-label="Cancelar respuesta" onclick="chatClearReplyTo()">✕</button>';
}
function chatClearReplyTo(){
  window._chatReplyTo=null;
  chatRenderReplyBar();
}
function chatSetReplyTo(msgId){
  if(!chatPuedeResponderAContacto(window._chatActiveContactKey||'')){
    if(typeof notif==='function')notif('No se puede responder a Soporte','warn');
    return;
  }
  const m=chatFindMsgById(msgId);
  const payload=chatReplyPayloadFromMsg(m);
  if(!payload)return;
  window._chatReplyTo=payload;
  chatRenderReplyBar();
  const inp=document.getElementById('chat-inp');
  if(inp){try{inp.focus();}catch(e){}}
}
function chatConsumeReplyTo(){
  const r=window._chatReplyTo&&window._chatReplyTo.id?{
    id:String(window._chatReplyTo.id),
    fromLabel:String(window._chatReplyTo.fromLabel||'').trim(),
    text:String(window._chatReplyTo.text||'').trim()
  }:null;
  chatClearReplyTo();
  return r;
}
function chatScrollToMsg(msgId){
  msgId=String(msgId||'');
  if(!msgId)return;
  const wrap=document.getElementById('chat-msgs');
  if(!wrap)return;
  let el=null;
  const nodes=wrap.querySelectorAll('.chat-msg[data-msg-id]');
  for(let i=0;i<nodes.length;i++){
    if(nodes[i].getAttribute('data-msg-id')===msgId){el=nodes[i];break;}
  }
  if(!el)return;
  try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){el.scrollIntoView();}
  el.classList.add('flash-reply');
  setTimeout(function(){el.classList.remove('flash-reply');},1200);
}
function chatQuoteHtml(replyTo){
  if(!replyTo||!replyTo.id)return'';
  const who=String(replyTo.fromLabel||'Mensaje').trim()||'Mensaje';
  const txt=String(replyTo.text||'').trim()||'…';
  return '<div class="chat-msg-quote" role="button" tabindex="0" title="Ver mensaje original" onclick="event.stopPropagation();chatScrollToMsg(\''+jsStr(replyTo.id)+'\')">'+
    '<div class="chat-msg-quote-author">'+escAttr(who)+'</div>'+
    '<div class="chat-msg-quote-text">'+escAttr(txt)+'</div></div>';
}
function renderChatMessages(){
  const el=document.getElementById('chat-msgs');
  const convId=window._chatConvActiva;
  if(!el||!convId)return;
  const me=getChatIdentity();
  const msgs=chatMsgsForActiveConv();
  const total=msgs.length;
  const lim=window._chatMsgRenderCount||CHAT_MSG_RENDER_DEFAULT;
  const sliceStart=total>lim?total-lim:0;
  const visible=sliceStart?msgs.slice(sliceStart):msgs;
  if(!msgs.length){
    const ro=!chatPuedeResponderAContacto(window._chatActiveContactKey||'');
    const empty=ro
      ?'<div style="text-align:center;font-size:12px;color:var(--tx3);padding:2rem 1rem">Sin avisos de Soporte todavía.</div>'
      :'<div style="text-align:center;font-size:12px;color:var(--tx3);padding:2rem 1rem">Sin mensajes. Escriba abajo para iniciar la conversación.</div>';
    if(_chatMessagesPaintSig!=='empty|'+convId+'|'+(ro?'ro':'rw')){
      _chatMessagesPaintSig='empty|'+convId+'|'+(ro?'ro':'rw');
      el.innerHTML=empty;
    }
    chatSyncComposeReadonly();
    return;
  }
  const loadMore=sliceStart>0
    ?'<button type="button" class="chat-load-older" onclick="chatLoadOlderMessages()">↑ Cargar anteriores ('+sliceStart+')</button>'
    :'';
  const html=loadMore+visible.map(m=>{
    const mine=chatEsMio(m);
    const sender=chatFromLabel(m);
    const mid=escAttr(String(m.id||''));
    let body='';
    if(m.replyTo&&m.replyTo.id)body+=chatQuoteHtml(m.replyTo);
    if(!mine&&sender)body+='<div style="font-size:10px;font-weight:700;color:var(--bl);margin-bottom:3px">'+escAttr(sender)+'</div>';
    if(m.text)body+=chatLinkifyText(m.text);
    const driveUrl=chatMsgDriveUrl(m);
    const attachHtml=driveUrl?chatAttachmentHtml(m):'';
    if(attachHtml)body+=(body?'<div class="chat-attach-wa-gap"></div>':'')+attachHtml;
    const mediaOnly=!m.text&&!!attachHtml;
    const t=m.ts?new Date(m.ts).toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'';
    const canReply=chatPuedeResponderAContacto(window._chatActiveContactKey||'');
    const replyBtn=(m.id&&canReply)
      ?'<button type="button" class="chat-msg-reply-btn" title="Responder" aria-label="Responder a este mensaje" onclick="event.stopPropagation();chatSetReplyTo(\''+jsStr(m.id)+'\')">↩</button>'
      :'';
    return '<div class="chat-msg '+(mine?'me':'them')+(mediaOnly?' chat-msg-media':'')+(m.broadcast||m.noReply?' chat-msg-broadcast':'')+'" data-msg-id="'+mid+'">'+replyBtn+body+'<div class="chat-msg-time">'+t+'</div></div>';
  }).join('');
  const sig=convId+'|lim:'+lim+'|'+visible.map(function(m){
    const fid=(m.file&&m.file.fileId)||'';
    return String(m.id||'')+':'+(m.ts||'')+':'+(m.text||'').length+':f'+fid+(m.file&&m.file.driveDeleted?'x':'');
  }).join(',')+'|'+(chatPuedeResponderAContacto(window._chatActiveContactKey||'')?'rw':'ro');
  if(sig===_chatMessagesPaintSig)return;
  const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;
  _chatMessagesPaintSig=sig;
  el.innerHTML=html;
  if(nearBottom)el.scrollTop=el.scrollHeight;
  chatSyncComposeReadonly();
}
function chatIsAdminKey(key){
  return chatKeysMatch(key,CHAT_ADMIN_KEY)||chatNormKey(key).startsWith('admin:');
}
function chatPuedeResponderAContacto(contactKey){
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(chatIsAdminKey(contactKey))return false;
  return true;
}
function chatSyncComposeReadonly(){
  const compose=document.querySelector('#chat-main .chat-compose');
  const replyBar=document.getElementById('chat-reply-bar');
  const banner=document.getElementById('chat-readonly-banner');
  const fileInp=document.getElementById('chat-file-inp');
  const contactKey=window._chatActiveContactKey||'';
  const inChat=window._chatVista==='chat'&&!!contactKey&&window._chatVista!=='admin_broadcast';
  const readonly=inChat&&!chatPuedeResponderAContacto(contactKey);
  if(compose)compose.style.display=readonly?'none':'';
  if(replyBar&&readonly){replyBar.style.display='none';chatClearReplyTo();}
  if(banner){
    banner.hidden=!readonly;
    banner.style.display=readonly?'block':'none';
  }
  if(fileInp&&readonly)fileInp.disabled=true;
  else if(fileInp)fileInp.disabled=false;
}
function chatAdminPushTarget(seen,out,c){
  if(!c||!c.key)return;
  const k=chatNormKey(c.key);
  if(seen.has(k)||chatIsAdminKey(c.key))return;
  seen.add(k);
  out.push(c);
}
/** Oficinas DEGUV + NCA + Secretaría (sin ciudadanos). */
function chatAdminTargetsOficinas(){
  const seen=new Set(),out=[];
  const encNca=typeof getEncargadoDepto==='function'?getEncargadoDepto('guaviare'):'';
  if(encNca)chatAdminPushTarget(seen,out,{key:'resp:'+encNca,kind:'enc_depto',label:encNca,meta:'NCA DEGUV · Encargado',region:'guaviare',deptoId:'guaviare',oficinaId:'guaviare',group:'oficinas'});
  else chatAdminPushTarget(seen,out,{key:'depto:guaviare',kind:'depto',label:labelDepto('guaviare'),meta:'NCA DEGUV',region:'guaviare',deptoId:'guaviare',group:'oficinas'});
  (typeof OFICINAS_DEGUV!=='undefined'?OFICINAS_DEGUV:[]).forEach(function(o){
    if(!o||o.id==='guaviare')return;
    const enc=typeof getEncargadoOficina==='function'?getEncargadoOficina(o.id):'';
    const lbl=typeof labelOficina==='function'?labelOficina(o.id):(o.nombre||o.id);
    if(enc)chatAdminPushTarget(seen,out,{key:'resp:'+enc,kind:'enc_ofi',label:enc,meta:lbl+' · Encargado',region:'guaviare',oficinaId:o.id,group:'oficinas'});
    else chatAdminPushTarget(seen,out,{key:'ofi:'+o.id,kind:'ofi',label:lbl,meta:lbl+' · Oficina',region:'guaviare',oficinaId:o.id,group:'oficinas'});
  });
  return out;
}
/** Departamentos regionales (Guaviare, Guainía, Vaupés). */
function chatAdminTargetsDeptos(){
  const seen=new Set(),out=[];
  (typeof DEPTOS!=='undefined'?DEPTOS:[]).forEach(function(d){
    if(!d||!d.id)return;
    const enc=typeof getEncargadoDepto==='function'?getEncargadoDepto(d.id):'';
    const region=typeof chatRegionForDepto==='function'?chatRegionForDepto(d.id):d.id;
    if(enc)chatAdminPushTarget(seen,out,{key:'resp:'+enc,kind:'enc_depto',label:enc,meta:labelDepto(d.id)+' · Encargado',region:region,deptoId:d.id,group:'deptos'});
    else chatAdminPushTarget(seen,out,{key:'depto:'+d.id,kind:'depto',label:labelDepto(d.id),meta:labelDepto(d.id)+' · Departamento',region:region,deptoId:d.id,group:'deptos'});
  });
  return out;
}
/** Responsables / contratistas + Jurisdiccional (sin encargados de depto/oficina). */
function chatAdminTargetsResponsables(){
  const seen=new Set(),out=[];
  const jurisU=(_usuariosCache||[]).find(function(u){return u&&u.activo!==false&&u.rol==='jurisdiccional'&&String(u.nombre||'').trim();});
  chatAdminPushTarget(seen,out,{
    key:'juris:jurisdiccional',kind:'juris',
    label:jurisU?String(jurisU.nombre).trim():CHAT_LABEL_SUBDIRECCION,
    meta:'Subdirección · Jurisdiccional',region:'juris',group:'responsables'
  });
  (typeof DEPTOS!=='undefined'?DEPTOS:[]).forEach(function(d){
    const enc=typeof getEncargadoDepto==='function'?getEncargadoDepto(d.id):'';
    (typeof getInstructoresActivos==='function'?getInstructoresActivos(d.id):[]).forEach(function(ins){
      if(!ins||!ins.nombre||ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return;
      if(enc&&chatNombresIguales(ins.nombre,enc))return;
      chatAdminPushTarget(seen,out,{
        key:'resp:'+ins.nombre,kind:'resp',label:ins.nombre,
        meta:labelDepto(d.id)+' · Responsable',region:chatRegionForDepto(d.id),deptoId:d.id,group:'responsables'
      });
    });
  });
  (typeof OFICINAS_DEGUV!=='undefined'?OFICINAS_DEGUV:[]).forEach(function(o){
    if(!o||o.id==='guaviare')return;
    const enc=typeof getEncargadoOficina==='function'?getEncargadoOficina(o.id):'';
    (typeof getInstructoresOficina==='function'?getInstructoresOficina(o.id):[]).forEach(function(ins){
      if(!ins||!ins.nombre||ins.rol==='encargado_oficina')return;
      if(enc&&chatNombresIguales(ins.nombre,enc))return;
      chatAdminPushTarget(seen,out,{
        key:'resp:'+ins.nombre,kind:'resp',label:ins.nombre,
        meta:labelOficina(o.id)+' · Responsable',region:'guaviare',oficinaId:o.id,group:'responsables'
      });
    });
  });
  return out;
}
function chatAdminTargetsTodos(){
  const seen=new Set(),out=[];
  chatAdminTargetsOficinas().concat(chatAdminTargetsDeptos()).concat(chatAdminTargetsResponsables()).forEach(function(c){
    chatAdminPushTarget(seen,out,Object.assign({},c,{group:'todos'}));
  });
  return out;
}
function chatAdminTargetsForScope(scope){
  if(scope==='oficinas')return chatAdminTargetsOficinas();
  if(scope==='deptos')return chatAdminTargetsDeptos();
  if(scope==='responsables')return chatAdminTargetsResponsables();
  return chatAdminTargetsTodos();
}
function chatAdminAbrirBroadcast(){
  if(!(typeof esAdministrador==='function'&&esAdministrador())){
    if(typeof notif==='function')notif('Solo el Administrador puede enviar avisos','err');
    return;
  }
  window._chatVista='admin_broadcast';
  window._chatActiveContactKey=null;
  window._chatConvActiva=null;
  window._chatAdminBroadcastScope=window._chatAdminBroadcastScope||'todos';
  chatClearReplyTo();
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent='Avisos de Soporte';
  if(sub)sub.textContent='Enviar como Soporte (los destinatarios no pueden responder)';
  chatSyncLayout();
  renderChatContacts();
  renderChatAdminBroadcast();
  chatSyncComposeReadonly();
}
function chatAdminSetBroadcastScope(scope){
  window._chatAdminBroadcastScope=scope||'todos';
  renderChatAdminBroadcast();
}
function chatAdminToggleBroadcastTodos(chk){
  const on=!!(chk&&chk.checked);
  document.querySelectorAll('.chat-admin-tgt-chk').forEach(function(c){c.checked=on;});
}
function renderChatAdminBroadcast(){
  const el=document.getElementById('chat-msgs');
  const main=document.getElementById('chat-main');
  if(!el||!main)return;
  if(main.classList.contains('hidden'))main.classList.remove('hidden');
  const scope=window._chatAdminBroadcastScope||'todos';
  const targets=chatAdminTargetsForScope(scope);
  const scopeBtns=[
    {id:'todos',lbl:'Todos los grupos'},
    {id:'oficinas',lbl:'Oficinas'},
    {id:'deptos',lbl:'Departamentos'},
    {id:'responsables',lbl:'Responsables'}
  ].map(function(s){
    return '<button type="button" class="btn bsm'+(scope===s.id?' bp':'')+'" onclick="chatAdminSetBroadcastScope(\''+s.id+'\')">'+escAttr(s.lbl)+'</button>';
  }).join('');
  const list=targets.map(function(c){
    return '<label class="chat-admin-tgt"><input type="checkbox" class="chat-admin-tgt-chk" value="'+escAttr(c.key)+'" checked> '+
      '<span><strong>'+escAttr(c.label)+'</strong><br><span class="chat-admin-tgt-meta">'+escAttr(c.meta||'')+'</span></span></label>';
  }).join('')||'<div style="padding:10px;font-size:12px;color:var(--tx3)">Sin destinatarios en este grupo.</div>';
  el.innerHTML='<div class="chat-admin-broadcast">'+
    '<div class="chat-admin-broadcast-hint">El mensaje llegará como <strong>Soporte</strong>. Los destinatarios podrán leerlo pero <strong>no responder</strong>.</div>'+
    '<div class="chat-admin-scope fx" style="gap:6px;flex-wrap:wrap;margin:8px 0">'+scopeBtns+'</div>'+
    '<label class="chat-admin-tgt chat-admin-tgt-all"><input type="checkbox" id="chat-admin-tgt-all" checked onchange="chatAdminToggleBroadcastTodos(this)"> <strong>Todos de este grupo ('+targets.length+')</strong></label>'+
    '<div class="chat-admin-tgt-list">'+list+'</div>'+
    '<div class="fld" style="margin-top:10px"><label>Mensaje del aviso</label>'+
    '<textarea id="chat-admin-broadcast-text" rows="4" placeholder="Ej. Actualización del sistema: se corrigió el orden de Revisados…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:inherit;resize:vertical"></textarea></div>'+
    '<div class="fx" style="gap:8px;margin-top:10px">'+
    '<button type="button" class="btn bp" onclick="chatAdminEnviarBroadcast()">📢 Enviar aviso</button>'+
    '<button type="button" class="btn bsm" onclick="chatVolverContactos()">Cancelar</button></div>'+
    '</div>';
  _chatMessagesPaintSig='admin_broadcast|'+scope+'|'+targets.length;
  const compose=document.querySelector('#chat-main .chat-compose');
  if(compose)compose.style.display='none';
  const banner=document.getElementById('chat-readonly-banner');
  if(banner){banner.hidden=true;banner.style.display='none';}
}
async function chatAdminEnviarBroadcast(){
  if(!(typeof esAdministrador==='function'&&esAdministrador())){notif('Solo el Administrador puede enviar avisos','err');return;}
  const ta=document.getElementById('chat-admin-broadcast-text');
  const text=(ta&&ta.value||'').trim();
  if(!text){notif('Escriba el mensaje del aviso','err');return;}
  const keys=Array.from(document.querySelectorAll('.chat-admin-tgt-chk:checked')).map(function(c){return c.value;}).filter(Boolean);
  if(!keys.length){notif('Seleccione al menos un destinatario','err');return;}
  const unique=[];
  const seen=new Set();
  keys.forEach(function(k){
    const nk=chatNormKey(k);
    if(seen.has(nk)||chatIsAdminKey(k))return;
    seen.add(nk);
    unique.push(k);
  });
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){notif('No hay conexión con Firestore','err');return;}
  const batchId='bcast_'+Date.now();
  let ok=0,fail=0;
  for(let i=0;i<unique.length;i++){
    const toKey=unique[i];
    const to=chatContactFromKey(toKey);
    const convId=chatConvId(CHAT_ADMIN_KEY,to.key);
    const msg={
      id:'msg_'+Date.now()+'_'+i+'_'+Math.random().toString(36).slice(2,5),
      convId:convId,
      fromKey:CHAT_ADMIN_KEY,
      fromLabel:CHAT_ADMIN_LABEL,
      toKey:to.key,
      toLabel:to.label||'',
      text:text,
      ts:new Date().toISOString(),
      readBy:[chatNormKey(CHAT_ADMIN_KEY)],
      broadcast:true,
      noReply:true,
      broadcastId:batchId
    };
    chatMensajes.push(msg);
    chatMsgIndexUpsert(msg);
    try{
      await chatWriteMensajeFirestore(msg,{me:{kind:'admin',key:CHAT_ADMIN_KEY,label:CHAT_ADMIN_LABEL},contactKey:to.key});
      ok++;
    }catch(err){
      console.error('chatAdminEnviarBroadcast:',convId,err);
      chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
      chatMsgIndexRemove(msg.id);
      fail++;
    }
  }
  if(ta)ta.value='';
  renderChatBadge();
  renderChatContacts();
  if(ok)notif('Aviso enviado a '+ok+' destinatario(s)'+(fail?' · '+fail+' fallaron':''),'ok');
  else notif('No se pudo enviar el aviso','err');
  if(ok)chatVolverContactos();
}
window.chatAdminAbrirBroadcast=chatAdminAbrirBroadcast;
window.chatAdminSetBroadcastScope=chatAdminSetBroadcastScope;
window.chatAdminToggleBroadcastTodos=chatAdminToggleBroadcastTodos;
window.chatAdminEnviarBroadcast=chatAdminEnviarBroadcast;
async function chatEnviarTexto(){
  chatCloseEmojiPicker();
  const inp=document.getElementById('chat-inp');
  const me=chatEffectiveIdentity();
  if(!inp||!me)return;
  const text=inp.value.trim();
  if(!text)return;
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!contactKey)return;
  if(!chatPuedeResponderAContacto(contactKey)){
    notif('No se puede responder a Soporte. Los avisos son solo de lectura.','warn');
    return;
  }
  const route=chatPickSendRoute(me,contactKey);
  window._chatConvActiva=route.convId;
  const replyTo=chatConsumeReplyTo();
  const msg={
    id:'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    convId:route.convId,
    fromKey:route.fromKey,fromLabel:chatSendFromLabel(me),
    toKey:route.toKey,toLabel:route.toLabel,
    text,
    ts:new Date().toISOString(),
    readBy:getMyChatKeys()
  };
  if(replyTo)msg.replyTo=replyTo;
  if(typeof sstWaComposerReset==='function')sstWaComposerReset(inp);
  else{inp.value='';if(typeof sstWaComposerGrow==='function')sstWaComposerGrow(inp);}
  chatMensajes.push(msg);
  chatMsgIndexUpsert(msg);
  renderChatMessages();
  renderChatContacts();
  renderChatBadge();
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){
    chatMensajes=chatMensajes.filter(function(m){return m.id!==msg.id;});
    chatMsgIndexRemove(msg.id);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    notif('No hay conexión con Firestore. El mensaje no se envió.','err');
    return;
  }
  try{
    await chatWriteMensajeFirestore(msg,{me:me,contactKey:contactKey});
    window._chatConvActiva=msg.convId;
  }catch(err){
    console.error('chatEnviarTexto:',msg.convId,msg.id,err);
    chatMensajes=chatMensajes.filter(m=>m.id!==msg.id);
    chatMsgIndexRemove(msg.id);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    notif(chatFirestoreSaveErrorText(err),'err');
  }
}
const CHAT_EMOJI_RECENT_LS='sst_chat_emoji_recent';
const CHAT_EMOJI_PANEL=[
  {lbl:'Frecuentes',icons:['😀','😁','😂','🤣','😊','😍','🥰','😘','😎','🤔','😅','😢','😭','😡','👍','👎','👏','🙏','💪','✅','❌','⚠️','📌','📎','📄','✉️','📞','🎉','🔥','❤️','💙','💚','⭐','🕐','📅']},
  {lbl:'Gestos',icons:['👋','🤝','✌️','🤞','👌','🙌','💯','🆗','🆘','ℹ️','❓','❗','💡','🔔','🔕']},
  {lbl:'Trabajo',icons:['🏢','🏛️','📋','📝','📂','🗂️','📊','📈','🔍','✏️','🖊️','🗓️','⏳','⌛','🚀','🛠️']}
];
let _chatEmojiPanelBuilt=false;
function chatEmojiRecentGet(){
  try{
    const a=JSON.parse(localStorage.getItem(CHAT_EMOJI_RECENT_LS)||'[]');
    return Array.isArray(a)?a.slice(0,24):[];
  }catch(e){return[];}
}
function chatEmojiRecentPush(emoji){
  emoji=String(emoji||'').trim();
  if(!emoji)return;
  let r=chatEmojiRecentGet().filter(function(e){return e!==emoji;});
  r.unshift(emoji);
  try{localStorage.setItem(CHAT_EMOJI_RECENT_LS,JSON.stringify(r.slice(0,24)));}catch(e){}
}
function chatBuildEmojiPanelOnce(){
  const panel=document.getElementById('chat-emoji-panel');
  if(!panel)return;
  const recent=chatEmojiRecentGet();
  let html='';
  if(recent.length){
    html+='<div class="chat-emoji-sect"><div class="chat-emoji-sect-lbl">Recientes</div><div class="chat-emoji-grid">'+recent.map(function(e){
      return '<button type="button" class="chat-emoji-btn" data-emoji="'+escAttr(e)+'" onclick="chatInsertEmoji(this.dataset.emoji)" aria-label="Emoji">'+e+'</button>';
    }).join('')+'</div></div>';
  }
  CHAT_EMOJI_PANEL.forEach(function(s){
    html+='<div class="chat-emoji-sect"><div class="chat-emoji-sect-lbl">'+escAttr(s.lbl)+'</div><div class="chat-emoji-grid">'+s.icons.map(function(e){
      return '<button type="button" class="chat-emoji-btn" data-emoji="'+escAttr(e)+'" onclick="chatInsertEmoji(this.dataset.emoji)" aria-label="Emoji">'+e+'</button>';
    }).join('')+'</div></div>';
  });
  panel.innerHTML=html;
  _chatEmojiPanelBuilt=true;
}
function chatCloseEmojiPicker(){
  const panel=document.getElementById('chat-emoji-panel');
  const btn=document.getElementById('chat-emoji-btn');
  if(panel){
    panel.style.display='none';
    panel.hidden=true;
    panel.setAttribute('aria-hidden','true');
  }
  if(btn)btn.setAttribute('aria-expanded','false');
  window._chatEmojiOpen=false;
}
function chatToggleEmojiPicker(ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  if(!chatPuedeResponderAContacto(window._chatActiveContactKey||'')){
    if(typeof notif==='function')notif('No puede escribir en esta conversación','warn');
    return;
  }
  const panel=document.getElementById('chat-emoji-panel');
  const btn=document.getElementById('chat-emoji-btn');
  if(!panel)return;
  if(!_chatEmojiPanelBuilt)chatBuildEmojiPanelOnce();
  if(window._chatEmojiOpen){chatCloseEmojiPicker();return;}
  window._chatEmojiOpen=true;
  panel.hidden=false;
  panel.style.display='block';
  panel.setAttribute('aria-hidden','false');
  if(btn)btn.setAttribute('aria-expanded','true');
}
function chatInsertEmoji(emoji){
  emoji=String(emoji||'').trim();
  if(!emoji)return;
  const inp=document.getElementById('chat-inp');
  if(!inp)return;
  chatEmojiRecentPush(emoji);
  const start=inp.selectionStart!=null?inp.selectionStart:inp.value.length;
  const end=inp.selectionEnd!=null?inp.selectionEnd:inp.value.length;
  inp.value=inp.value.slice(0,start)+emoji+inp.value.slice(end);
  const pos=start+emoji.length;
  try{inp.setSelectionRange(pos,pos);}catch(e){}
  if(typeof sstWaComposerGrow==='function')sstWaComposerGrow(inp);
  try{inp.focus();}catch(e){}
  _chatEmojiPanelBuilt=false;
  chatBuildEmojiPanelOnce();
}
let _chatFileUploading=false;
let _chatUploadHideTimer=null;
function chatCorreoSesionEmail(){
  if(typeof getAuthEmailNorm==='function'){
    const e=getAuthEmailNorm();
    if(e)return e;
  }
  return String(window._usuarioActual&&window._usuarioActual.email||'').trim().toLowerCase();
}
function chatDriveConectado(){
  return typeof _driveGetBestToken==='function'&&!!_driveGetBestToken();
}
function chatAdjuntarArchivoClick(){
  const inp=document.getElementById('chat-file-inp');
  if(!inp)return;
  if(!chatPuedeResponderAContacto(window._chatActiveContactKey||chatActiveContactKey()||'')){
    chatModalAlert({
      title:'Solo lectura',
      message:'No se pueden adjuntar archivos en avisos de Soporte.',
      detail:'Los mensajes de Soporte son solo de lectura.',
      tone:'warn'
    });
    return;
  }
  if(!window._chatActiveContactKey&&!chatActiveContactKey()){
    chatModalAlert({
      title:'Seleccione un contacto',
      message:'Abra una conversación antes de adjuntar un archivo.',
      detail:'Elija un contacto en la lista del chat y vuelva a intentar.',
      tone:'warn'
    });
    return;
  }
  if(!chatDriveConectado()){
    chatModalCorreoRequerido();
    return;
  }
  inp.value='';
  inp.click();
}
function chatConectarCorreo(){
  chatUploadOverlayHide();
  if(typeof gmailOfiConnect==='function'){
    gmailOfiConnect();
    return;
  }
  if(typeof gmailConnect==='function')gmailConnect();
  else if(typeof showTab==='function')showTab('gmail-ofi');
}
function chatModalCorreoRequerido(){
  const email=chatCorreoSesionEmail();
  chatModalAlert({
    title:'Correo no conectado',
    message:'Para adjuntar archivos en el chat debe autorizar Gmail y Drive.',
    detail:email?('Use su cuenta registrada: '+email+'. Se abrirá Google para elegir la cuenta e indicar los permisos.'):'Se abrirá Google para conectar la misma cuenta con la que ingresó al sistema.',
    tone:'warn',
    btnLabel:'Cerrar',
    actionLabel:'Conectar correo',
    onAction:chatConectarCorreo
  });
}
function chatUploadOverlayHide(){
  const ov=document.getElementById('chat-upload-overlay');
  if(_chatUploadHideTimer){clearTimeout(_chatUploadHideTimer);_chatUploadHideTimer=null;}
  if(!ov)return;
  ov.classList.remove('on');
  ov.setAttribute('aria-hidden','true');
  const box=ov.querySelector('.chat-upload-box');
  if(box){box.classList.remove('state-ok','state-err','state-warn');}
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  const det=document.getElementById('chat-upload-detail');
  const btn=document.getElementById('chat-upload-close-btn');
  const act=document.getElementById('chat-upload-action-btn');
  if(foot)foot.style.display='none';
  if(spin)spin.style.display='';
  const prog=document.getElementById('chat-upload-prog');
  const progTxt=document.getElementById('chat-upload-prog-txt');
  if(prog)prog.style.display='none';
  if(progTxt)progTxt.style.display='none';
  if(det){det.style.display='none';det.textContent='';}
  if(btn)btn.textContent='Cerrar';
  if(act){act.style.display='none';act.onclick=null;}
}
function chatModalAlert(opts){
  opts=opts||{};
  const ov=document.getElementById('chat-upload-overlay');
  const tit=document.getElementById('chat-upload-title');
  const msg=document.getElementById('chat-upload-msg');
  const ico=document.getElementById('chat-upload-emoji');
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  const det=document.getElementById('chat-upload-detail');
  const btn=document.getElementById('chat-upload-close-btn');
  const act=document.getElementById('chat-upload-action-btn');
  const box=ov?ov.querySelector('.chat-upload-box'):null;
  if(_chatUploadHideTimer){clearTimeout(_chatUploadHideTimer);_chatUploadHideTimer=null;}
  if(!ov)return;
  if(box){box.classList.remove('state-ok','state-err','state-warn');box.classList.add(opts.tone==='err'?'state-err':'state-warn');}
  if(tit)tit.textContent=opts.title||'Aviso';
  if(ico)ico.textContent=opts.emoji||'⚠️';
  if(msg)msg.textContent=opts.message||'';
  if(det){
    if(opts.detail){det.style.display='block';det.textContent=opts.detail;}
    else{det.style.display='none';det.textContent='';}
  }
  if(spin)spin.style.display='none';
  if(btn)btn.textContent=opts.btnLabel||'Entendido';
  if(act){
    if(opts.actionLabel&&typeof opts.onAction==='function'){
      act.style.display='';
      act.textContent=opts.actionLabel;
      act.onclick=function(){opts.onAction();};
    }else{
      act.style.display='none';
      act.onclick=null;
    }
  }
  if(foot)foot.style.display='flex';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden','false');
}
function chatUploadOverlayProgress(pct,label){
  const spin=document.getElementById('chat-upload-spinner');
  const prog=document.getElementById('chat-upload-prog');
  const fill=document.getElementById('chat-upload-prog-fill');
  const progTxt=document.getElementById('chat-upload-prog-txt');
  if(spin)spin.style.display='none';
  if(prog)prog.style.display='';
  if(fill)fill.style.width=Math.max(4,Math.min(100,pct||0))+'%';
  if(progTxt){
    progTxt.style.display='';
    progTxt.textContent=label||(pct!=null?(pct+'% · Subiendo a Drive…'):'Subiendo a Drive…');
  }
}
function chatUploadOverlayShow(fileName){
  chatUploadOverlayHide();
  const ov=document.getElementById('chat-upload-overlay');
  const tit=document.getElementById('chat-upload-title');
  const msg=document.getElementById('chat-upload-msg');
  const ico=document.getElementById('chat-upload-emoji');
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  const box=ov?ov.querySelector('.chat-upload-box'):null;
  if(!ov)return;
  if(box){box.classList.remove('state-ok','state-err','state-warn');}
  if(tit)tit.textContent='Subiendo archivo';
  if(ico)ico.textContent='📤';
  if(msg)msg.textContent='Cargando «'+(fileName||'archivo')+'» al Drive institucional para enviarlo en el chat…';
  if(foot)foot.style.display='none';
  if(spin)spin.style.display='';
  const prog=document.getElementById('chat-upload-prog');
  const progTxt=document.getElementById('chat-upload-prog-txt');
  if(prog)prog.style.display='none';
  if(progTxt)progTxt.style.display='none';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden','false');
}
function chatUploadOverlaySuccess(fileName){
  const ov=document.getElementById('chat-upload-overlay');
  const tit=document.getElementById('chat-upload-title');
  const msg=document.getElementById('chat-upload-msg');
  const ico=document.getElementById('chat-upload-emoji');
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  const box=ov?ov.querySelector('.chat-upload-box'):null;
  if(!ov)return;
  if(box){box.classList.remove('state-ok','state-err','state-warn');box.classList.add('state-ok');}
  if(tit)tit.textContent='Archivo enviado';
  if(ico)ico.textContent='✓';
  if(msg)msg.textContent='«'+(fileName||'Archivo')+'» se subió correctamente al Drive y se envió en el chat.';
  if(spin)spin.style.display='none';
  if(foot)foot.style.display='none';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden','false');
  if(_chatUploadHideTimer)clearTimeout(_chatUploadHideTimer);
  _chatUploadHideTimer=setTimeout(chatUploadOverlayHide,1600);
}
function chatUploadOverlayError(errMsg,fileName){
  const ov=document.getElementById('chat-upload-overlay');
  const tit=document.getElementById('chat-upload-title');
  const msg=document.getElementById('chat-upload-msg');
  const ico=document.getElementById('chat-upload-emoji');
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  const det=document.getElementById('chat-upload-detail');
  const box=ov?ov.querySelector('.chat-upload-box'):null;
  if(!ov)return;
  if(box){box.classList.remove('state-ok','state-warn');box.classList.add('state-err');}
  if(tit)tit.textContent='No se pudo adjuntar';
  if(ico)ico.textContent='⚠️';
  if(msg)msg.textContent='No se pudo subir «'+(fileName||'archivo')+'» al Drive institucional.';
  if(det){det.style.display='block';det.textContent=errMsg||'Revise la conexión Gmail/Drive.';}
  if(spin)spin.style.display='none';
  if(foot)foot.style.display='flex';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden','false');
}
async function chatEnviarArchivo(fileArg){
  const inp=document.getElementById('chat-file-inp');
  let file=(fileArg instanceof File)?fileArg:null;
  if(!file&&inp)file=inp.files&&inp.files[0];
  if(!file)return;

  const me=chatEffectiveIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();

  if(!contactKey){
    chatModalAlert({
      title:'Seleccione un contacto',
      message:'Abra una conversación antes de adjuntar un archivo.',
      detail:'Elija un contacto en la lista del chat y vuelva a intentar.',
      tone:'warn'
    });
    if(inp)inp.value='';
    return;
  }
  if(!me){
    chatModalAlert({
      title:'Chat no disponible',
      message:'No se pudo identificar su usuario para enviar el adjunto.',
      detail:'Recargue la página e inicie sesión de nuevo.',
      tone:'warn'
    });
    if(inp)inp.value='';
    return;
  }
  if(_chatFileUploading){
    chatModalAlert({
      title:'Subida en curso',
      message:'Ya hay un archivo subiéndose. Espere a que termine.',
      tone:'warn'
    });
    if(inp)inp.value='';
    return;
  }

  const maxBytes=(typeof CHAT_DRIVE_MAX_BYTES!=='undefined')?CHAT_DRIVE_MAX_BYTES:25*1024*1024;
  if(file.size>maxBytes){
    chatModalAlert({
      title:'Archivo demasiado grande',
      message:'El archivo supera el límite de 25 MB permitido en el chat.',
      detail:file.name,
      tone:'warn'
    });
    if(inp)inp.value='';
    return;
  }
  if(!chatDriveConectado()){
    chatModalCorreoRequerido();
    if(inp)inp.value='';
    return;
  }
  if(typeof driveUploadChat!=='function'){
    chatModalAlert({
      title:'Drive no disponible',
      message:'No se pudo cargar el módulo de Drive para adjuntar archivos.',
      detail:'Recargue la página e intente de nuevo.',
      tone:'err'
    });
    if(inp)inp.value='';
    return;
  }

  _chatFileUploading=true;
  try{
    chatUploadOverlayShow(file.name);
    chatUploadOverlayProgress(12,'Preparando «'+(file.name||'archivo')+'»…');
    const route=chatPickSendRoute(me,contactKey);
    window._chatConvActiva=route.convId;
    const msgId='msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
    chatUploadOverlayProgress(35,'Subiendo a Drive…');
    const uploaded=await driveUploadChat(file,file.name,file.type||'application/octet-stream');
    chatUploadOverlayProgress(92,'Registrando mensaje…');
    const msg={
      id:msgId,
      convId:route.convId,
      fromKey:route.fromKey,fromLabel:chatSendFromLabel(me),
      toKey:route.toKey,toLabel:route.toLabel,
      text:'',
      driveLink:uploaded.driveLink,
      file:{
        fileId:uploaded.fileId,
        driveLink:uploaded.driveLink,
        nombre:uploaded.nombre,
        origName:file.name,
        mime:file.type||'application/octet-stream',
        expiresAt:uploaded.expiresAt
      },
      ts:new Date().toISOString(),
      readBy:getMyChatKeys()
    };
    const replyTo=chatConsumeReplyTo();
    if(replyTo)msg.replyTo=replyTo;
    if(inp)inp.value='';
    chatMensajes.push(msg);
    chatMsgIndexUpsert(msg);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    const db=window._db;
    if(db&&window._fsSetDoc&&window._fsDoc){
      let fsConvId='';
      try{
        const wr=await chatWriteMensajeFirestore(msg,{me:me,contactKey:contactKey});
        fsConvId=wr.fsConvId;
        window._chatConvActiva=msg.convId;
      }catch(saveErr){
        console.error('chatEnviarArchivo firestore:',saveErr);
        chatMensajes=chatMensajes.filter(function(m){return m.id!==msg.id;});
        chatMsgIndexRemove(msg.id);
        renderChatMessages();
        renderChatContacts();
        renderChatBadge();
        chatUploadOverlayError(chatFirestoreSaveErrorText(saveErr),file.name);
        return;
      }
      if(typeof chatRegisterDrivePurge==='function'){
        try{
          await chatRegisterDrivePurge(uploaded.fileId,{
            expiresAt:uploaded.expiresAt,
            msgId:msg.id,
            fsConvId:fsConvId,
            driveLink:uploaded.driveLink,
            nombre:uploaded.nombre
          });
        }catch(purgeErr){
          console.warn('chatRegisterDrivePurge:',purgeErr);
        }
      }
    }
    chatUploadOverlaySuccess(uploaded.nombre||file.name);
  }catch(err){
    console.error('chatEnviarArchivo:',err);
    chatUploadOverlayError(err.message||'Revise la conexión Gmail/Drive.',file.name);
    if(inp)inp.value='';
  }finally{
    _chatFileUploading=false;
  }
}
window.chatEnviarArchivo=chatEnviarArchivo;
window.chatAdjuntarArchivoClick=chatAdjuntarArchivoClick;
window.chatSetReplyTo=chatSetReplyTo;
window.chatClearReplyTo=chatClearReplyTo;
window.chatScrollToMsg=chatScrollToMsg;
window.chatToggleEmojiPicker=chatToggleEmojiPicker;
window.chatInsertEmoji=chatInsertEmoji;
window.chatLoadOlderMessages=chatLoadOlderMessages;
window.chatCloseEmojiPicker=chatCloseEmojiPicker;
window.chatAttachThumbFail=chatAttachThumbFail;
if(!window._chatEmojiDocHook){
  window._chatEmojiDocHook=true;
  document.addEventListener('click',function(ev){
    if(!window._chatEmojiOpen)return;
    const t=ev.target;
    if(t&&t.closest&&(t.closest('#chat-emoji-panel')||t.closest('#chat-emoji-btn')))return;
    chatCloseEmojiPicker();
  });
}
if(!window._chatNotifyFirebaseHook){
  window._chatNotifyFirebaseHook=true;
  chatInitUnreadButtonGuard();
  chatPurgeUnreadButton();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',chatPurgeUnreadButton);
  }
  window.addEventListener('firebase-ready',function(){
    if(typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
  });
  document.addEventListener('visibilitychange',function(){
    if(document.hidden||!document.body.classList.contains('sesion-activa'))return;
    if(typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
    if(typeof renderChatBadge==='function')renderChatBadge();
    const w=document.getElementById('chat-window');
    if(w&&w.classList.contains('on')&&typeof renderChatContacts==='function')renderChatContacts();
  });
}

// ================================================================