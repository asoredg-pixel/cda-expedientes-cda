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
  return getChatIdentity()||chatSessionUserContact();
}
function chatIdentityKeysForKey(key){
  key=chatNormKey(key);
  const set=new Set([key]);
  if(key.startsWith('depto:')){
    const id=key.slice(6);
    const enc=getEncargadoDepto(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('ofi:guaviare');
    (_usuariosCache||[]).forEach(function(u){
      if(u.activo===false)return;
      const rol=String(u.rol||'').trim();
      const nom=String(u.nombre||'').trim();
      if(!nom)return;
      if(rol===id||(enc&&chatNombresIguales(enc,nom)))set.add('resp:'+nom);
    });
  }else if(key.startsWith('ofi:')){
    const id=key.slice(4);
    const enc=getEncargadoOficina(id);
    if(enc)set.add('resp:'+enc);
    if(id==='guaviare')set.add('depto:guaviare');
    (_usuariosCache||[]).forEach(function(u){
      if(u.activo===false)return;
      const rol=String(u.rol||'').trim();
      const nom=String(u.nombre||'').trim();
      if(!nom)return;
      if(rol===id||(enc&&chatNombresIguales(enc,nom)))set.add('resp:'+nom);
    });
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
function chatSessionUserContact(){
  const u=window._usuarioActual;
  if(!u||u.activo===false)return null;
  return chatUsuarioToContact(u);
}
function chatMyKeySet(){
  const set=new Set();
  const me=getChatIdentity();
  if(me)chatAllKeysFor(me.key).forEach(function(k){set.add(k);});
  const ses=chatSessionUserContact();
  if(ses)chatAllKeysFor(ses.key).forEach(function(k){set.add(k);});
  return set;
}
function getMyChatKeys(){
  return[...chatMyKeySet()];
}
function chatKeyInMyKeys(k){
  const mine=chatMyKeySet();
  const nk=chatNormKey(k);
  if(mine.has(nk))return true;
  return chatAllKeysFor(k).some(function(a){return mine.has(a);});
}
function chatMsgParticipa(m){
  if(!m)return false;
  const mine=chatMyKeySet();
  if(!mine.size)return false;
  if(m.fromKey||m.toKey){
    const from=chatAllKeysFor(m.fromKey||'');
    const to=chatAllKeysFor(m.toKey||'');
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
  if(chatKeysMatch(c.key,me.key))return true;
  const mine=chatMyKeySet();
  return chatAllKeysFor(c.key).some(function(k){return mine.has(k);});
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
  if(!nom||rol==='ciudadano'||rol==='admin')return null;
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
  const msgs=chatMsgsForContact(me,contactKey);
  const last=msgs[msgs.length-1];
  return last&&last.ts?String(last.ts):'';
}
function chatAvRegionClass(c){
  const r=(c&&c.region)||'guaviare';
  return ' chat-region-'+r;
}
function chatRefreshContactsIfOpen(){
  const w=document.getElementById('chat-window');
  if(w&&w.classList.contains('on'))renderChatContacts();
}
function chatConvId(keyA,keyB){
  const a=chatCanonicalKey(keyA);
  const b=chatCanonicalKey(keyB);
  if(a===b)return a;
  return [a,b].sort().join('|');
}
function chatConvFirestoreId(convId){
  return String(convId||'').replace(/\|/g,'__');
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
      if(change.type==='removed'){
        chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
      }else{
        const idx=(chatMensajes||[]).findIndex(function(m){return m.id===msg.id;});
        if(idx>=0)chatMensajes[idx]=msg;
        else chatMensajes.push(msg);
      }
      if(change.type==='added')chatTryDesktopNotify(msg);
    });
    renderChatMessages();
    renderChatBadge();
  });
}
let _chatNotifyUnsubs=[];
let _chatNotifySyncTimer=null;
function stopChatNotifySync(){
  _chatNotifyUnsubs.forEach(function(fn){try{fn();}catch(e){}});
  _chatNotifyUnsubs=[];
}
function scheduleChatNotifySync(){
  clearTimeout(_chatNotifySyncTimer);
  _chatNotifySyncTimer=setTimeout(function(){
    _chatNotifySyncTimer=null;
    initChatNotifySync();
  },350);
}
function chatNotifyConvIds(){
  const me=getChatIdentity();
  const ses=chatSessionUserContact();
  if(!me&&!ses)return[];
  const myKeys=new Set();
  if(me)chatAllKeysFor(me.key).forEach(function(k){myKeys.add(k);});
  if(ses)chatAllKeysFor(ses.key).forEach(function(k){myKeys.add(k);});
  const ids=new Set();
  getChatContacts().forEach(function(c){
    [...myKeys].forEach(function(a){
      chatAllKeysFor(c.key).forEach(function(b){
        if(chatNormKey(a)!==chatNormKey(b))ids.add(chatConvFirestoreId(chatConvId(a,b)));
      });
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
  const me=getChatIdentity();
  if(!me||!msg)return null;
  const mine=chatMyKeySet();
  function esMioKey(k){
    return chatAllKeysFor(k).some(function(a){return mine.has(a);});
  }
  let other=esMioKey(msg.fromKey)?msg.toKey:msg.fromKey;
  if(!other)return null;
  const msgConv=msg.convId||chatConvId(msg.fromKey,msg.toKey);
  const contacts=getChatContacts();
  for(let i=0;i<contacts.length;i++){
    const c=contacts[i];
    if(chatNormKey(c.key)===chatNormKey(other))return c.key;
    const paths=chatConvIdsForContact(me,c.key);
    for(let j=0;j<paths.length;j++){
      if(paths[j]===msgConv)return c.key;
    }
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
    let incoming=false;
    snap.docChanges().forEach(function(change){
      if(change.type==='removed'){
        const msg={id:change.doc.id,...change.doc.data()};
        chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
        return;
      }
      if(change.type!=='added'&&change.type!=='modified')return;
      const msg={id:change.doc.id,...change.doc.data()};
      if(!chatMsgParticipa(msg))return;
      chatMergeIncomingMsg(msg);
      if(!initial&&change.type==='added'&&!chatEsMio(msg)){
        incoming=true;
        chatTryDesktopNotify(msg);
      }
    });
    renderChatBadge();
    const chatWin=document.getElementById('chat-window');
    if(chatWin&&chatWin.classList.contains('on')){
      renderChatContacts();
      if(window._chatConvActiva)renderChatMessages();
    }
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
          chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
          return;
        }
        if(change.type!=='added'&&change.type!=='modified')return;
        const msg={id:change.doc.id,...change.doc.data()};
        if(!chatMsgParticipa(msg))return;
        chatMergeIncomingMsg(msg);
        if(!initial&&change.type==='added'&&!chatEsMio(msg))chatTryDesktopNotify(msg);
      });
      renderChatBadge();
      if(document.getElementById('chat-window')?.classList.contains('on')){
        renderChatContacts();
        if(window._chatConvActiva)renderChatMessages();
      }
    });
    _chatNotifyUnsubs.push(unsub);
  });
}
function chatConvMessages(convId){
  const canon=String(convId||'');
  return (chatMensajes||[]).filter(function(m){
    const cid=m.convId||chatConvId(m.fromKey,m.toKey);
    return cid===canon;
  }).sort(function(a,b){return(a.ts||'').localeCompare(b.ts||'');});
}
function chatContactFromKey(key){
  key=String(key||'');
  const found=getChatContacts().find(function(c){return chatKeysMatch(c.key,key);});
  if(found)return found;
  if(key.startsWith('juris:'))return{kind:'juris',key,label:CHAT_LABEL_SUBDIRECCION,meta:'Subdirección · Jurisdiccional',region:'juris'};
  if(key.startsWith('depto:')){const id=key.slice(6);const enc=getEncargadoDepto(id);return{kind:'depto',key,label:enc||labelDepto(id),deptoId:id,meta:labelDepto(id)+' · Departamento',region:chatRegionForDepto(id)};}
  if(key.startsWith('ofi:')){const id=key.slice(4);const enc=getEncargadoOficina(id);return{kind:'ofi',key,label:enc||labelOficina(id),oficinaId:id,meta:labelOficina(id)+' · Oficina',region:'guaviare'};}
  if(key.startsWith('resp:'))return{kind:'resp',key,label:key.slice(5),meta:'Responsable',region:'guaviare'};
  return{kind:'resp',key,label:key,meta:'',region:'guaviare'};
}
function chatAvClass(kind){return kind==='depto'?' depto':kind==='juris'?' juris':kind==='ofi'?' ofi':kind==='enc_ofi'?' enc_ofi':kind==='resp'?' resp':'';}
function chatAvLetter(label){return String(label||'?').trim().charAt(0).toUpperCase();}
function chatEsMio(m){
  if(!m||!m.fromKey)return false;
  const mine=chatMyKeySet();
  return chatAllKeysFor(m.fromKey).some(function(k){return mine.has(k);});
}
function chatPreviewMsg(m,me){
  if(!m)return'Sin mensajes';
  const body=m.text||(m.file?('📎 '+(m.file.nombre||m.file.name||'archivo')):'');
  if(!chatEsMio(m))return escAttr((chatFromLabel(m)||'')+(body?': '+body:''));
  return escAttr(body||'');
}
function chatFromLabel(m){
  if(!m)return'';
  if(m.fromLabel){
    if(m.fromLabel==='Jurisdiccional')return CHAT_LABEL_SUBDIRECCION;
    return m.fromLabel;
  }
  const k=String(m.fromKey||'');
  if(k.startsWith('resp:'))return k.slice(5);
  if(k.startsWith('depto:')){const enc=getEncargadoDepto(k.slice(6));return enc||labelDepto(k.slice(6));}
  if(k.startsWith('ofi:'))return labelOficina(k.slice(4));
  if(k.startsWith('juris:'))return CHAT_LABEL_SUBDIRECCION;
  return chatContactFromKey(k).label||'';
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
function chatPickSendRoute(me,contactKey){
  contactKey=String(contactKey||'').trim();
  const fallback=chatContactFromKey(contactKey);
  const msgs=chatMsgsForContact(me,contactKey);
  if(!msgs.length){
    return{
      convId:chatConvId(me.key,fallback.key),
      fromKey:me.key,
      toKey:fallback.key,
      toLabel:fallback.label
    };
  }
  const last=msgs[msgs.length-1];
  const convId=last.convId||chatConvId(last.fromKey,last.toKey);
  const keys=convId.split('|');
  let fromKey=me.key;
  keys.forEach(function(k){
    if(chatKeyInMyKeys(k))fromKey=k;
  });
  const myCanon=chatMyKeysCanon();
  const otherKey=keys.find(function(k){return !myCanon.has(chatCanonicalKey(k));})||contactKey;
  const to=chatContactFromKey(otherKey);
  return{convId,fromKey,toKey:to.key,toLabel:to.label};
}
function chatConvIdsForContact(me,contactKey){
  contactKey=String(contactKey||'');
  if(!contactKey)return[];
  const ids=new Set();
  const to=chatContactFromKey(contactKey);
  const myKeys=new Set();
  if(me)chatAllKeysFor(me.key).forEach(function(k){myKeys.add(k);});
  const ses=chatSessionUserContact();
  if(ses)chatAllKeysFor(ses.key).forEach(function(k){myKeys.add(k);});
  if(!myKeys.size&&me)myKeys.add(chatNormKey(me.key));
  [...myKeys].forEach(function(a){
    ids.add(chatConvId(a,to.key));
    chatAllKeysFor(to.key).forEach(function(b){
      if(chatNormKey(a)!==chatNormKey(b))ids.add(chatConvId(a,b));
    });
  });
  return[...ids];
}
function chatMsgsForContact(me,contactKey){
  if(!me||!contactKey)return[];
  const seen=new Set(),out=[];
  chatConvIdsForContact(me,contactKey).forEach(function(id){
    chatConvMessages(id).forEach(function(m){
      if(!seen.has(m.id)){seen.add(m.id);out.push(m);}
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
  let n=chatMsgsForContact(me,contactKey).filter(chatMsgUnreadForMe).length;
  if(window._chatManualUnread&&window._chatManualUnread.has(chatNormKey(contactKey)))n=Math.max(n,1);
  return n;
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
  const me=getChatIdentity();
  if(!me)return;
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  const convIds=chatConvIdsForContact(me,contactKey);
  convIds.forEach(function(convId){
    const fsConvId=chatConvFirestoreId(convId);
    const unsub=window._fsOnSnapshot(window._fsCollection(db,'chats',fsConvId,'mensajes'),function(snap){
      snap.docChanges().forEach(function(change){
        const msg={id:change.doc.id,...change.doc.data()};
        if(change.type==='removed'){
          chatMensajes=(chatMensajes||[]).filter(function(m){return m.id!==msg.id;});
        }else{
          const idx=(chatMensajes||[]).findIndex(function(m){return m.id===msg.id;});
          if(idx>=0)chatMensajes[idx]=msg;
          else chatMensajes.push(msg);
        }
        if(change.type==='added')chatTryDesktopNotify(msg);
      });
      renderChatMessages();
      renderChatContacts();
      renderChatBadge();
    });
    _chatActiveUnsubs.push(unsub);
  });
}
function chatMsgsForDeptResp(deptoId,respKey){
  return chatMsgsForContact({kind:'depto',key:'depto:'+deptoId,deptoId:deptoId},respKey);
}
function chatMsgsForActiveConv(){
  const me=getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!me||!contactKey)return[];
  return chatMsgsForContact(me,contactKey);
}
function chatUnreadCount(){
  const me=getChatIdentity();
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
  const me=getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(window._chatManualUnread&&contactKey)window._chatManualUnread.delete(chatNormKey(contactKey));
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
    b.style.display='flex';
    b.textContent=n>99?'99+':String(n);
    b.dataset.count=String(n);
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
    renderChatContacts();
    renderChatBadge();
    if(typeof scheduleChatNotifySync==='function')scheduleChatNotifySync();
    if(typeof chatPurgeExpiredDriveFiles==='function'){
      void chatPurgeExpiredDriveFiles().then(function(ok){
        if(ok){renderChatMessages();renderChatContacts();}
      });
    }
  }
  else{window._chatConvActiva=null;window._chatVista='contactos';chatUploadOverlayHide();stopChatActiveSync();chatSyncLayout();}
}
async function chatMarcarNoLeido(){
  const convId=window._chatConvActiva;
  const my=getMyChatKeys();
  const me=getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!convId||!my.length||!me)return;
  let ch=false;
  const db=window._db;
  const fsUpdates=[];
  chatMsgsForActiveConv().forEach(m=>{
    if(chatEsMio(m))return;
    if(!m.readBy)m.readBy=[];
    const rb=m.readBy.map(chatNormKey);
    const removed=my.filter(function(k){return rb.includes(k);});
    if(removed.length){
      m.readBy=rb.filter(function(k){return !my.includes(k);});
      ch=true;
      if(db&&window._fsUpdateDoc&&window._fsDoc&&window._fsArrayRemove&&m.id){
        const fsConvId=chatConvFirestoreId(m.convId||convId);
        fsUpdates.push(window._fsUpdateDoc(
          window._fsDoc(db,'chats',fsConvId,'mensajes',m.id),
          {readBy:window._fsArrayRemove(...removed)}
        ));
      }
    }
  });
  if(!ch&&contactKey){
    if(!window._chatManualUnread)window._chatManualUnread=new Set();
    window._chatManualUnread.add(chatNormKey(contactKey));
    ch=true;
  }
  if(ch){
    renderChatBadge();
    renderChatContacts();
    chatVolverContactos();
    notif('Conversación marcada como no leída','ok');
    if(fsUpdates.length){
      try{await Promise.all(fsUpdates);}
      catch(err){console.error('chatMarcarNoLeido:',err);}
    }
  }
}
function chatToggleContactos(force){
  if(typeof force==='boolean')window._chatContactsCollapsed=force;
  else window._chatContactsCollapsed=!window._chatContactsCollapsed;
  chatSyncLayout();
}
function chatSyncLayout(){
  const contacts=document.getElementById('chat-contacts');
  const main=document.getElementById('chat-main');
  const back=document.getElementById('chat-back-btn');
  const toggleBtn=document.getElementById('chat-toggle-contacts-btn');
  const unreadBtn=document.getElementById('chat-unread-btn');
  const conv=window._chatConvActiva;
  const mobile=window.innerWidth<640;
  const collapsed=!!window._chatContactsCollapsed;
  if(contacts){
    contacts.classList.toggle('wide',!conv);
    contacts.classList.toggle('with-conv',!!conv&&!mobile);
    contacts.classList.toggle('collapsed',!!conv&&collapsed&&mobile);
    contacts.style.display=(conv&&collapsed&&mobile)?'none':'';
  }
  if(main){
    main.classList.toggle('hidden',!conv);
    if(conv)main.style.flex='1';
  }
  if(back)back.style.display=(conv&&mobile)?'inline-flex':'none';
  if(toggleBtn)toggleBtn.style.display=conv&&mobile?'inline-block':'none';
  if(unreadBtn)unreadBtn.style.display=conv?'inline-block':'none';
  if(conv&&contacts&&!mobile&&!collapsed)contacts.classList.remove('wide');
}
function chatVolverContactos(){
  stopChatActiveSync();
  window._chatConvActiva=null;
  window._chatVista='contactos';
  window._chatContactsCollapsed=false;
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent='Chat interno';
  if(sub)sub.textContent='Seleccione un contacto';
  chatSyncLayout();
  renderChatContacts();
}
function renderChatContacts(){
  const el=document.getElementById('chat-contacts');
  if(!el)return;
  const me=chatEffectiveIdentity();
  if(!me){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Seleccione departamento o responsable para usar el chat.</div>';return;}
  let contacts=getChatContacts();
  if(!contacts.length){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Sin contactos disponibles.</div>';return;}
  contacts=contacts.slice().sort(function(a,b){
    const ta=chatContactLastTs(me,a.key);
    const tb=chatContactLastTs(me,b.key);
    if(ta!==tb)return tb.localeCompare(ta);
    const ua=chatContactUnreadCount(me,a.key);
    const ub=chatContactUnreadCount(me,b.key);
    if(ua!==ub)return ub-ua;
    return a.label.localeCompare(b.label,'es');
  });
  el.innerHTML=contacts.map(function(c){
    const convId=chatConvId(me.key,c.key);
    const msgs=chatMsgsForContact(me,c.key);
    const last=msgs[msgs.length-1];
    const prev=last?((!chatEsMio(last)?(chatFromLabel(last)+': '):'')+(last.text||chatMsgDrivePreview(last))):'Sin mensajes';
    const unread=chatContactUnreadCount(me,c.key);
    const active=window._chatActiveContactKey===c.key||window._chatConvActiva===convId||chatActiveContactKey()===c.key;
    const meta=c.meta||c.sub||'';
    return '<div class="chat-contact'+(active?' on':'')+(unread?' has-unread':'')+'" onclick="chatAbrirConv(\''+escAttr(c.key)+'\')">'+
      '<div class="chat-contact-av'+chatAvRegionClass(c)+'">'+chatAvLetter(c.label)+'</div>'+
      '<div class="chat-contact-info"><div class="chat-contact-name">'+escAttr(c.label)+'</div>'+
      (meta?'<div class="chat-contact-meta">'+escAttr(meta)+'</div>':'')+
      '<div class="chat-contact-prev">'+escAttr(prev)+'</div></div>'+
      (unread?'<span class="chat-contact-unread">'+unread+'</span>':'')+
      '</div>';
  }).join('');
}
async function chatAbrirConv(contactKey){
  const me=getChatIdentity();
  if(!me)return;
  window._chatActiveContactKey=contactKey;
  window._chatVista='chat';
  window._chatContactsCollapsed=window.innerWidth<640;
  const c=chatContactFromKey(contactKey);
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent=c.label;
  if(sub)sub.textContent=c.meta||c.sub||'Conversación';
  await loadChatMensajesForContact(me,contactKey);
  const msgs=chatMsgsForContact(me,contactKey);
  const convId=msgs.length
    ?(msgs[msgs.length-1].convId||chatConvId(msgs[msgs.length-1].fromKey,msgs[msgs.length-1].toKey))
    :chatConvId(me.key,contactKey);
  window._chatConvActiva=convId;
  initChatSyncForContact(contactKey);
  await chatMarcarLeido(convId);
  chatSyncLayout();
  renderChatContacts();
  renderChatMessages();
  setTimeout(function(){const inp=document.getElementById('chat-inp');if(inp)inp.focus();},80);
}
function chatMsgDriveUrl(m){
  if(!m)return'';
  if(m.driveLink)return normalizeDriveUrlInput(m.driveLink);
  if(m.file&&m.file.driveLink)return normalizeDriveUrlInput(m.file.driveLink);
  if(m.file&&m.file.url&&!m.file.data)return normalizeDriveUrlInput(m.file.url);
  return'';
}
function chatMsgDrivePreview(m){
  if(m.file&&m.file.nombre)return '📎 '+m.file.nombre;
  if(m.file&&m.file.name)return '📎 '+m.file.name;
  return chatMsgDriveUrl(m)?'📄 Documento adjunto':'';
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
function renderChatMessages(){
  const el=document.getElementById('chat-msgs');
  const convId=window._chatConvActiva;
  if(!el||!convId)return;
  const me=getChatIdentity();
  const msgs=chatMsgsForActiveConv();
  if(!msgs.length){el.innerHTML='<div style="text-align:center;font-size:12px;color:var(--tx3);padding:2rem 1rem">Sin mensajes. Escriba abajo para iniciar la conversación.</div>';return;}
  el.innerHTML=msgs.map(m=>{
    const mine=chatEsMio(m);
    const sender=chatFromLabel(m);
    let body='';
    if(!mine&&sender)body+='<div style="font-size:10px;font-weight:700;color:var(--bl);margin-bottom:3px">'+escAttr(sender)+'</div>';
    if(m.text)body+=chatLinkifyText(m.text);
    const driveUrl=chatMsgDriveUrl(m);
    if(driveUrl){
      const chipLbl=(m.file&&m.file.nombre)?escAttr(m.file.nombre):((m.file&&m.file.name)?escAttr(m.file.name):'📄 Documento adjunto');
      const chipNote=(m.file&&m.file.driveDeleted)?' <span style="font-size:10px;opacity:.75">(expirado)</span>':'';
      body+=(body?'<br>':'')+'<a class="chat-drive-chip" href="'+escAttr(driveUrl)+'" target="_blank" rel="noopener">'+chipLbl+'</a>'+chipNote;
    }
    const t=m.ts?new Date(m.ts).toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'';
    return '<div class="chat-msg '+(mine?'me':'them')+'">'+body+'<div class="chat-msg-time">'+t+'</div></div>';
  }).join('');
  el.scrollTop=el.scrollHeight;
}
async function chatEnviarTexto(){
  const inp=document.getElementById('chat-inp');
  const me=getChatIdentity();
  if(!inp||!me)return;
  const text=inp.value.trim();
  if(!text)return;
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!contactKey)return;
  const route=chatPickSendRoute(me,contactKey);
  window._chatConvActiva=route.convId;
  const msg={
    id:'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    convId:route.convId,
    fromKey:route.fromKey,fromLabel:me.label,
    toKey:route.toKey,toLabel:route.toLabel,
    text,
    ts:new Date().toISOString(),
    readBy:getMyChatKeys()
  };
  inp.value='';
  chatMensajes.push(msg);
  renderChatMessages();
  renderChatContacts();
  renderChatBadge();
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){
    chatMensajes=chatMensajes.filter(function(m){return m.id!==msg.id;});
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    notif('No hay conexión con Firestore. El mensaje no se envió.','err');
    return;
  }
  const fsConvId=chatConvFirestoreId(msg.convId);
  try{
    await window._fsSetDoc(window._fsDoc(db,'chats',fsConvId,'mensajes',msg.id),msg,{merge:true});
  }catch(err){
    console.error('chatEnviarTexto:',fsConvId,msg.id,err);
    chatMensajes=chatMensajes.filter(m=>m.id!==msg.id);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    notif('Error al guardar el mensaje en Firestore','err');
  }
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
function chatUploadOverlayShow(fileName){
  chatUploadOverlayHide();
  const ov=document.getElementById('chat-upload-overlay');
  const tit=document.getElementById('chat-upload-title');
  const msg=document.getElementById('chat-upload-msg');
  const ico=document.getElementById('chat-upload-emoji');
  const foot=document.getElementById('chat-upload-foot');
  const spin=document.getElementById('chat-upload-spinner');
  if(!ov)return;
  if(box){box.classList.remove('state-ok','state-err','state-warn');}
  if(tit)tit.textContent='Subiendo archivo';
  if(ico)ico.textContent='📤';
  if(msg)msg.textContent='Cargando «'+(fileName||'archivo')+'» al Drive institucional para enviarlo en el chat…';
  if(foot)foot.style.display='none';
  if(spin)spin.style.display='';
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
  let file=(fileArg instanceof File)?fileArg:null;
  const inp=document.getElementById('chat-file-inp');
  const me=getChatIdentity();
  const contactKey=window._chatActiveContactKey||chatActiveContactKey();
  if(!contactKey||!me||_chatFileUploading){
    if(file&&inp&&!contactKey){
      chatModalAlert({
        title:'Seleccione un contacto',
        message:'Abra una conversación antes de adjuntar un archivo.',
        detail:'Elija un contacto en la lista del chat y vuelva a intentar.',
        tone:'warn'
      });
      inp.value='';
    }
    return;
  }
  if(!file&&inp)file=inp.files&&inp.files[0];
  if(!file)return;
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
  if(typeof _driveGetBestToken!=='function'||!_driveGetBestToken()){
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
  chatUploadOverlayShow(file.name);
  const route=chatPickSendRoute(me,contactKey);
  window._chatConvActiva=route.convId;
  const msgId='msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  try{
    const uploaded=await driveUploadChat(file,file.name,file.type||'application/octet-stream');
    const msg={
      id:msgId,
      convId:route.convId,
      fromKey:route.fromKey,fromLabel:me.label,
      toKey:route.toKey,toLabel:route.toLabel,
      text:'',
      driveLink:uploaded.driveLink,
      file:{fileId:uploaded.fileId,driveLink:uploaded.driveLink,nombre:uploaded.nombre,expiresAt:uploaded.expiresAt},
      ts:new Date().toISOString(),
      readBy:getMyChatKeys()
    };
    if(inp)inp.value='';
    chatMensajes.push(msg);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    const db=window._db;
    if(!db||!window._fsSetDoc||!window._fsDoc)return;
    const fsConvId=chatConvFirestoreId(msg.convId);
    await window._fsSetDoc(window._fsDoc(db,'chats',fsConvId,'mensajes',msg.id),msg,{merge:true});
    if(typeof chatRegisterDrivePurge==='function'){
      await chatRegisterDrivePurge(uploaded.fileId,{
        expiresAt:uploaded.expiresAt,
        msgId:msg.id,
        fsConvId:fsConvId,
        driveLink:uploaded.driveLink,
        nombre:uploaded.nombre
      });
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
if(!window._chatNotifyFirebaseHook){
  window._chatNotifyFirebaseHook=true;
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