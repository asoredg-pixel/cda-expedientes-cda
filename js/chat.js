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
  if(esModoResponsable()){
    const nm=String(responsableActivo||'').trim();
    if(!nm)return null;
    return{kind:'resp',key:'resp:'+nm,label:nm,deptoId:deptoCfg||'guaviare'};
  }
  if(esModoOficinaDeguv())return{kind:'ofi',key:'ofi:'+deptoActivo,label:labelOficina(deptoActivo),oficinaId:deptoActivo};
  if(esSecretaria())return{kind:'ofi',key:'ofi:secretaria',label:'Secretaría DEGUV',oficinaId:'secretaria'};
  if(deptoActivo==='jurisdiccional'||deptoActivo==='responsables')return null;
  return{kind:'depto',key:'depto:'+deptoActivo,label:labelDepto(deptoActivo),deptoId:deptoActivo};
}
function getMyChatKeys(){
  const me=getChatIdentity();
  if(!me)return[];
  const keys=[me.key];
  if(me.kind==='depto'){
    const enc=getEncargadoDepto(me.deptoId);
    if(enc)keys.push('resp:'+enc);
    if(me.deptoId==='guaviare')keys.push('ofi:guaviare');
  }
  if(me.kind==='ofi'){
    const enc=getEncargadoOficina(me.oficinaId);
    if(enc)keys.push('resp:'+enc);
    if(me.oficinaId==='guaviare')keys.push('depto:guaviare');
  }
  const out=new Set();
  keys.forEach(k=>chatKeyAliases(k).forEach(a=>out.add(chatNormKey(a))));
  return [...out];
}
function getChatContacts(){
  const me=getChatIdentity();
  if(!me)return[];
  const seen=new Set(),out=[];
  function add(c){const k=chatNormKey(c.key);if(seen.has(k)||k===chatNormKey(me.key))return;seen.add(k);out.push(c);}
  if(me.kind==='juris'){
    DEPTOS.forEach(d=>addChatContactoDepto(add,d.id));
    return out.sort((a,b)=>a.label.localeCompare(b.label,'es'));
  }
  if(me.kind==='resp'){
    const depto=me.deptoId||deptoCfg||'guaviare';
    addChatContactoDepto(add,depto,null,{subEnc:labelDepto(depto)+' · Encargado',subFallback:'Mensaje al departamento'});
    getInstructoresActivos(depto).forEach(i=>{
      if(i.nombre&&i.nombre!==me.label)
        add({kind:'resp',key:'resp:'+i.nombre,label:i.nombre,deptoId:depto,sub:i.rol==='encargado_depto'?'Encargado del departamento':'Responsable'});
    });
    return out.sort((a,b)=>a.label.localeCompare(b.label,'es'));
  }
  if(me.kind==='ofi'){
    const encYo=getEncargadoOficina(me.oficinaId);
    OFICINAS_DEGUV.forEach(o=>{
      if(o.id===me.oficinaId)return;
      if(o.id==='guaviare'){
        addChatContactoDepto(add,'guaviare',encYo,{subFallback:'NCA DEGUV (departamento)'});
        return;
      }
      addChatContactosOficina(add,o.id,encYo);
    });
    addChatResponsablesOficinaPropia(add,me.oficinaId);
    return out.sort((a,b)=>a.label.localeCompare(b.label,'es'));
  }
  if(me.kind==='depto'){
    const encYo=getEncargadoDepto(me.deptoId);
    DEPTOS.forEach(d=>{
      if(d.id!==me.deptoId)addChatContactoDepto(add,d.id,encYo);
    });
    if(me.deptoId==='guaviare'){
      OFICINAS_DEGUV.forEach(o=>{
        if(o.id==='guaviare')return;
        addChatContactosOficina(add,o.id);
      });
      getInstructoresActivos(me.deptoId).filter(instructorEsSoloNcaDeguv).forEach(i=>{
        if(i.nombre&&i.rol!=='encargado_depto')
          add({kind:'resp',key:'resp:'+i.nombre,label:i.nombre,deptoId:me.deptoId,sub:'Responsable NCA'});
      });
    }else{
      getInstructoresActivos(me.deptoId).forEach(i=>{
        if(i.nombre&&i.rol!=='encargado_depto')
          add({kind:'resp',key:'resp:'+i.nombre,label:i.nombre,deptoId:me.deptoId,sub:'Responsable del departamento'});
      });
    }
    add({kind:'juris',key:'juris:jurisdiccional',label:CHAT_LABEL_SUBDIRECCION,sub:'Subdirección DEGUV'});
    return out.sort((a,b)=>{
      const o={juris:0,depto:1,resp:2};
      return (o[a.kind]??9)-(o[b.kind]??9)||a.label.localeCompare(b.label,'es');
    });
  }
  return out;
}
function chatConvId(keyA,keyB){
  return [chatCanonicalKey(keyA),chatCanonicalKey(keyB)].sort().join('|');
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
function stopChatNotifySync(){
  _chatNotifyUnsubs.forEach(function(fn){try{fn();}catch(e){}});
  _chatNotifyUnsubs=[];
}
function chatNotifyConvIds(){
  const me=getChatIdentity();
  if(!me)return[];
  const ids=new Set();
  getChatContacts().forEach(function(c){
    ids.add(chatConvFirestoreId(chatConvId(me.key,c.key)));
    if(me.kind==='depto'&&c.kind==='resp'){
      const enc=getEncargadoDepto(me.deptoId);
      if(enc)ids.add(chatConvFirestoreId(chatConvId(c.key,'resp:'+enc)));
    }
  });
  return [...ids];
}
function chatMergeIncomingMsg(msg){
  if(!msg||!msg.id)return;
  const idx=(chatMensajes||[]).findIndex(function(m){return m.id===msg.id;});
  if(idx>=0)chatMensajes[idx]=msg;
  else chatMensajes.push(msg);
}
function chatTryDesktopNotify(msg){
  if(!msg||!chatMsgParticipa(msg)||chatEsMio(msg)||!chatMsgUnreadForMe(msg))return;
  const convId=msg.convId||chatConvId(msg.fromKey,msg.toKey);
  const chatWin=document.getElementById('chat-window');
  const chatOpen=chatWin&&chatWin.classList.contains('on');
  if(chatOpen&&window._chatConvActiva===convId&&!document.hidden)return;
  if(typeof sstShowDesktopNotify!=='function')return;
  const sender=chatFromLabel(msg)||'Chat interno';
  const preview=msg.text||chatMsgDrivePreview(msg)||'Nuevo mensaje';
  sstShowDesktopNotify('Chat interno — '+sender,preview,{
    tag:'chat-'+msg.id,
    onClick:function(){
      const other=msg.fromKey;
      if(other)void chatAbrirConv(other);
      else if(typeof toggleChatWindow==='function')toggleChatWindow(true);
    }
  });
}
function initChatNotifySync(){
  stopChatNotifySync();
  if(!document.body.classList.contains('sesion-activa'))return;
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
        chatMergeIncomingMsg(msg);
        if(!initial&&change.type==='added')chatTryDesktopNotify(msg);
      });
      if(initial)renderChatBadge();
      else{
        renderChatBadge();
        if(typeof renderChatContacts==='function'&&document.getElementById('chat-window')?.classList.contains('on'))renderChatContacts();
      }
    });
    _chatNotifyUnsubs.push(unsub);
  });
}
function chatConvMessages(convId){
  const canon=String(convId||'');
  return (chatMensajes||[]).filter(m=>chatConvId(m.fromKey,m.toKey)===canon).sort((a,b)=>(a.ts||'').localeCompare(b.ts||''));
}
function chatContactFromKey(key){
  key=String(key||'');
  if(key.startsWith('juris:'))return{kind:'juris',key,label:CHAT_LABEL_SUBDIRECCION,sub:CHAT_LABEL_SUBDIRECCION};
  if(key.startsWith('depto:')){const id=key.slice(6);const enc=getEncargadoDepto(id);return{kind:'depto',key,label:enc||labelDepto(id),deptoId:id,sub:enc?labelDepto(id)+' · Encargado':'Departamento'};}
  if(key.startsWith('ofi:')){const id=key.slice(4);return{kind:'ofi',key,label:labelOficina(id),oficinaId:id,sub:'Oficina DEGUV'};}
  if(key.startsWith('resp:'))return{kind:'resp',key,label:key.slice(5),sub:'Responsable'};
  return{kind:'resp',key,label:key,sub:''};
}
function chatAvClass(kind){return kind==='depto'?' depto':kind==='juris'?' juris':kind==='ofi'?' ofi':kind==='enc_ofi'?' enc_ofi':kind==='resp'?' resp':'';}
function chatAvLetter(label){return String(label||'?').trim().charAt(0).toUpperCase();}
function chatEsMio(m){
  const my=getMyChatKeys();
  const fk=chatNormKey(m.fromKey);
  return my.includes(fk)||chatKeyAliases(m.fromKey).some(a=>my.includes(chatNormKey(a)));
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
  if(my.includes(chatNormKey(m.fromKey)))return false;
  if(chatKeyAliases(m.fromKey).some(a=>my.includes(chatNormKey(a))))return false;
  const rb=(m.readBy||[]).map(chatNormKey);
  return !my.some(k=>rb.includes(k));
}
function chatMsgsForDeptResp(deptoId,respKey){
  const ids=[chatConvId('depto:'+deptoId,respKey)];
  const enc=getEncargadoDepto(deptoId);
  if(enc){
    const alt=chatConvId(respKey,'resp:'+enc);
    if(!ids.includes(alt))ids.push(alt);
  }
  const seen=new Set();
  const out=[];
  ids.forEach(id=>{
    chatConvMessages(id).forEach(m=>{
      if(!seen.has(m.id)){seen.add(m.id);out.push(m);}
    });
  });
  return out.sort((a,b)=>(a.ts||'').localeCompare(b.ts||''));
}
function chatMsgsForActiveConv(){
  const me=getChatIdentity();
  const convId=window._chatConvActiva;
  if(!me||!convId)return[];
  const myCanon=chatKeyAliases(me.key).map(chatCanonicalKey);
  const keys=convId.split('|');
  const other=keys.find(k=>!myCanon.includes(chatCanonicalKey(k)));
  if(me.kind==='depto'&&other&&other.startsWith('resp:'))return chatMsgsForDeptResp(me.deptoId,other);
  return chatConvMessages(convId);
}
function chatMsgParticipa(m){
  const my=getMyChatKeys();
  if(!my.length)return false;
  const fk=chatNormKey(m.fromKey),tk=chatNormKey(m.toKey);
  if(my.includes(fk)||my.includes(tk))return true;
  if(chatKeyAliases(m.fromKey).some(a=>my.includes(chatNormKey(a))))return true;
  if(chatKeyAliases(m.toKey).some(a=>my.includes(chatNormKey(a))))return true;
  const me=getChatIdentity();
  if(me&&me.kind==='depto'){
    const enc=getEncargadoDepto(me.deptoId);
    if(enc){
      const ek=chatNormKey('resp:'+enc);
      const fk=chatNormKey(m.fromKey),tk=chatNormKey(m.toKey);
      if(fk===ek||tk===ek){
        const ins=new Set(getInstructoresActivos(me.deptoId).map(i=>chatNormKey('resp:'+i.nombre)));
        if(ins.has(fk)||ins.has(tk))return true;
      }
    }
  }
  return false;
}
function chatUnreadCount(){
  const my=getMyChatKeys();
  if(!my.length)return 0;
  let n=0;
  (chatMensajes||[]).forEach(m=>{
    if(!chatMsgParticipa(m))return;
    if(chatMsgUnreadForMe(m))n++;
  });
  return n;
}
function chatUnreadConv(convId){
  const me=getChatIdentity();
  if(me&&me.kind==='depto'){
    const keys=convId.split('|');
    const other=keys.find(k=>chatNormKey(k)!==chatNormKey(me.key));
    if(other&&other.startsWith('resp:'))return chatMsgsForDeptResp(me.deptoId,other).filter(chatMsgUnreadForMe).length;
  }
  return chatConvMessages(convId).filter(chatMsgUnreadForMe).length;
}
async function chatMarcarLeido(convId){
  const my=getMyChatKeys();
  if(!my.length)return;
  let ch=false;
  const me=getChatIdentity();
  let msgs=chatConvMessages(convId);
  if(me&&me.kind==='depto'){
    const keys=convId.split('|');
    const other=keys.find(k=>chatNormKey(k)!==chatNormKey(me.key));
    if(other&&other.startsWith('resp:'))msgs=chatMsgsForDeptResp(me.deptoId,other);
  }
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
  if(!b)return;
  if(n>0){b.style.display='flex';b.textContent=n>99?'99+':String(n);}
  else b.style.display='none';
}
function toggleChatWindow(force){
  const w=document.getElementById('chat-window');
  if(!w)return;
  const open=force===true?true:force===false?false:!w.classList.contains('on');
  w.classList.toggle('on',open);
  if(open){
    renderChatContacts();
    renderChatBadge();
    if(typeof chatPurgeExpiredDriveFiles==='function'){
      void chatPurgeExpiredDriveFiles().then(function(ok){
        if(ok){renderChatMessages();renderChatContacts();}
      });
    }
  }
  else{window._chatConvActiva=null;window._chatVista='contactos';chatToggleDriveBar(false);initChatSync(null);chatSyncLayout();}
}
async function chatMarcarNoLeido(){
  const convId=window._chatConvActiva;
  const my=getMyChatKeys();
  if(!convId||!my.length)return;
  let ch=false;
  const db=window._db;
  const fsUpdates=[];
  chatMsgsForActiveConv().forEach(m=>{
    if(my.includes(chatNormKey(m.fromKey)))return;
    if(!m.readBy)m.readBy=[];
    const rb=m.readBy.map(chatNormKey);
    const nxt=rb.filter(k=>!my.includes(k));
    if(nxt.length!==rb.length){
      const removed=rb.filter(k=>my.includes(k));
      m.readBy=nxt;
      ch=true;
      if(removed.length&&db&&window._fsUpdateDoc&&window._fsDoc&&window._fsArrayRemove&&m.id){
        const fsConvId=chatConvFirestoreId(m.convId||convId);
        fsUpdates.push(window._fsUpdateDoc(
          window._fsDoc(db,'chats',fsConvId,'mensajes',m.id),
          {readBy:window._fsArrayRemove(...removed)}
        ));
      }
    }
  });
  if(ch){
    renderChatBadge();
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
    contacts.classList.toggle('collapsed',!!conv&&collapsed&&!mobile);
    contacts.style.display=(conv&&collapsed&&!mobile)?'none':'';
  }
  if(main){
    main.classList.toggle('hidden',!conv);
    if(conv)main.style.flex='1';
  }
  if(back)back.style.display=conv?'inline-block':'none';
  if(toggleBtn)toggleBtn.style.display=conv&&!mobile?'inline-block':'none';
  if(unreadBtn)unreadBtn.style.display=conv?'inline-block':'none';
  if(conv&&contacts&&!mobile&&!collapsed)contacts.classList.remove('wide');
}
function chatVolverContactos(){
  initChatSync(null);
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
  const me=getChatIdentity();
  if(!me){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Seleccione departamento o responsable para usar el chat.</div>';return;}
  const contacts=getChatContacts();
  if(!contacts.length){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--tx3)">Sin contactos disponibles.</div>';return;}
  el.innerHTML=contacts.map(c=>{
    const convId=chatConvId(me.key,c.key);
    const msgs=me.kind==='depto'&&c.kind==='resp'?chatMsgsForDeptResp(me.deptoId,c.key):chatConvMessages(convId);
    const last=msgs[msgs.length-1];
    const prev=last?((!chatEsMio(last)?(chatFromLabel(last)+': '):'')+(last.text||chatMsgDrivePreview(last))): 'Sin mensajes';
    const unread=me.kind==='depto'&&c.kind==='resp'?msgs.filter(chatMsgUnreadForMe).length:chatUnreadConv(convId);
    return '<div class="chat-contact'+(window._chatConvActiva===convId?' on':'')+'" onclick="chatAbrirConv(\''+escAttr(c.key)+'\')">'+
      '<div class="chat-contact-av'+chatAvClass(c.kind)+'">'+chatAvLetter(c.label)+'</div>'+
      '<div class="chat-contact-info"><div class="chat-contact-name">'+escAttr(c.label)+'</div><div class="chat-contact-prev">'+escAttr(prev)+'</div></div>'+
      (unread?'<span class="chat-contact-unread">'+unread+'</span>':'')+
      '</div>';
  }).join('');
}
async function chatAbrirConv(contactKey){
  const me=getChatIdentity();
  if(!me)return;
  const convId=chatConvId(me.key,contactKey);
  window._chatConvActiva=convId;
  window._chatVista='chat';
  window._chatContactsCollapsed=true;
  const c=chatContactFromKey(contactKey);
  const tit=document.getElementById('chat-hdr-tit');
  const sub=document.getElementById('chat-hdr-sub');
  if(tit)tit.textContent=c.label;
  if(sub)sub.textContent=c.sub||'Conversación';
  await loadChatMensajes(convId);
  initChatSync(convId);
  chatMarcarLeido(convId);
  chatSyncLayout();
  renderChatContacts();
  renderChatMessages();
  setTimeout(()=>{const inp=document.getElementById('chat-inp');if(inp)inp.focus();},80);
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
function chatToggleDriveBar(force){
  const bar=document.getElementById('chat-drive-bar');
  if(!bar)return;
  const show=typeof force==='boolean'?force:!bar.classList.contains('on');
  bar.classList.toggle('on',show);
  if(show){const inp=document.getElementById('chat-drive-inp');if(inp){inp.value='';setTimeout(()=>inp.focus(),40);}}
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
    if(m.text)body+=escAttr(m.text);
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
  const convId=window._chatConvActiva;
  const me=getChatIdentity();
  if(!inp||!convId||!me)return;
  const text=inp.value.trim();
  if(!text)return;
  const keys=convId.split('|');
  const myCanon=chatKeyAliases(me.key).map(chatCanonicalKey);
  const otherKey=keys.find(k=>!myCanon.includes(chatCanonicalKey(k)))||keys[1];
  const to=chatContactFromKey(otherKey);
  const msg={
    id:'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    convId:chatConvId(me.key,to.key),
    fromKey:me.key,fromLabel:me.label,
    toKey:to.key,toLabel:to.label,
    text,
    ts:new Date().toISOString(),
    readBy:chatKeyAliases(me.key).map(chatNormKey)
  };
  inp.value='';
  chatMensajes.push(msg);
  renderChatMessages();
  renderChatContacts();
  renderChatBadge();
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return;
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
async function chatEnviarDriveLink(){
  const inp=document.getElementById('chat-drive-inp');
  const convId=window._chatConvActiva;
  const me=getChatIdentity();
  if(!inp||!convId||!me)return;
  const raw=inp.value.trim();
  if(!raw)return;
  if(!esLinkDriveValid(raw)){notif('Solo se aceptan links de Google Drive','err');return;}
  const link=normalizeDriveUrlInput(raw);
  const keys=convId.split('|');
  const myCanon=chatKeyAliases(me.key).map(chatCanonicalKey);
  const otherKey=keys.find(k=>!myCanon.includes(chatCanonicalKey(k)))||keys[1];
  const to=chatContactFromKey(otherKey);
  const msg={
    id:'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    convId:chatConvId(me.key,to.key),
    fromKey:me.key,fromLabel:me.label,
    toKey:to.key,toLabel:to.label,
    text:'',
    driveLink:link,
    ts:new Date().toISOString(),
    readBy:chatKeyAliases(me.key).map(chatNormKey)
  };
  inp.value='';
  chatToggleDriveBar(false);
  chatMensajes.push(msg);
  renderChatMessages();
  renderChatContacts();
  renderChatBadge();
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return;
  const fsConvId=chatConvFirestoreId(msg.convId);
  try{
    await window._fsSetDoc(window._fsDoc(db,'chats',fsConvId,'mensajes',msg.id),msg,{merge:true});
  }catch(err){
    console.error('chatEnviarDriveLink:',fsConvId,msg.id,err);
    chatMensajes=chatMensajes.filter(m=>m.id!==msg.id);
    renderChatMessages();
    renderChatContacts();
    renderChatBadge();
    notif('Error al guardar el enlace en Firestore','err');
  }
}
let _chatFileUploading=false;
function initChatFileDropZone(){
  const main=document.getElementById('chat-main');
  const overlay=document.getElementById('chat-drop-overlay');
  if(!main||main.dataset.dropInit)return;
  main.dataset.dropInit='1';
  let dragDepth=0;
  function showDrop(on){
    if(overlay){
      overlay.classList.toggle('on',on);
      overlay.setAttribute('aria-hidden',on?'false':'true');
    }
    main.classList.toggle('chat-drop-active',on);
  }
  function hasFiles(e){
    const dt=e.dataTransfer;
    if(!dt)return false;
    if(dt.types&&Array.from(dt.types).includes('Files'))return true;
    return !!(dt.files&&dt.files.length);
  }
  main.addEventListener('dragenter',function(e){
    if(!window._chatConvActiva||!hasFiles(e))return;
    e.preventDefault();
    dragDepth++;
    showDrop(true);
  });
  main.addEventListener('dragover',function(e){
    if(!window._chatConvActiva||!hasFiles(e))return;
    e.preventDefault();
    if(e.dataTransfer)e.dataTransfer.dropEffect='copy';
    showDrop(true);
  });
  main.addEventListener('dragleave',function(e){
    if(!window._chatConvActiva)return;
    e.preventDefault();
    dragDepth--;
    if(dragDepth<=0){dragDepth=0;showDrop(false);}
  });
  main.addEventListener('drop',function(e){
    e.preventDefault();
    e.stopPropagation();
    dragDepth=0;
    showDrop(false);
    if(!window._chatConvActiva){notif('Seleccione un contacto antes de adjuntar un archivo.','warn');return;}
    const files=e.dataTransfer&&e.dataTransfer.files;
    if(!files||!files.length)return;
    void chatEnviarArchivo(files[0]);
  });
}
function chatTriggerArchivo(){
  const inp=document.getElementById('chat-file-inp');
  if(!inp||_chatFileUploading)return;
  inp.value='';
  try{inp.showPicker();}catch(e){inp.click();}
}
async function chatEnviarArchivo(fileArg){
  let file=(fileArg instanceof File)?fileArg:null;
  const inp=document.getElementById('chat-file-inp');
  const convId=window._chatConvActiva;
  const me=getChatIdentity();
  if(!convId||!me||_chatFileUploading)return;
  if(!file&&inp)file=inp.files&&inp.files[0];
  if(!file)return;
  const maxBytes=(typeof CHAT_DRIVE_MAX_BYTES!=='undefined')?CHAT_DRIVE_MAX_BYTES:25*1024*1024;
  if(file.size>maxBytes){
    notif('Archivo demasiado grande (máx. 25 MB). Use el botón «Drive» para pegar un enlace.','err');
    if(inp)inp.value='';
    return;
  }
  if(typeof _driveGetBestToken!=='function'||!_driveGetBestToken()){
    notif('Conecte su correo en la pestaña Correos para adjuntar archivos al Drive institucional.','warn');
    if(inp)inp.value='';
    return;
  }
  if(typeof driveUploadChat!=='function'){
    notif('Módulo Drive no disponible. Recargue la página.','err');
    if(inp)inp.value='';
    return;
  }
  _chatFileUploading=true;
  notif('Subiendo archivo al Drive institucional…','info');
  const keys=convId.split('|');
  const myCanon=chatKeyAliases(me.key).map(chatCanonicalKey);
  const otherKey=keys.find(k=>!myCanon.includes(chatCanonicalKey(k)))||keys[1];
  const to=chatContactFromKey(otherKey);
  const msgId='msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  try{
    const uploaded=await driveUploadChat(file,file.name,file.type||'application/octet-stream');
    const msg={
      id:msgId,
      convId:chatConvId(me.key,to.key),
      fromKey:me.key,fromLabel:me.label,
      toKey:to.key,toLabel:to.label,
      text:'',
      driveLink:uploaded.driveLink,
      file:{fileId:uploaded.fileId,driveLink:uploaded.driveLink,nombre:uploaded.nombre,expiresAt:uploaded.expiresAt},
      ts:new Date().toISOString(),
      readBy:chatKeyAliases(me.key).map(chatNormKey)
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
    notif('Archivo enviado correctamente.','ok');
  }catch(err){
    console.error('chatEnviarArchivo:',err);
    notif('No se pudo subir el archivo: '+(err.message||'revise la conexión Gmail/Drive'),'err');
    if(inp)inp.value='';
  }finally{
    _chatFileUploading=false;
  }
}
initChatFileDropZone();

// ================================================================