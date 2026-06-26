// =============================================================================
// utils.js — Funciones utilitarias puras del sistema SST
// Sin dependencias de estado global de negocio (exps, cfg, etc.)
// Cargar después de constants.js y antes del script principal.
// =============================================================================

// ── Fechas ────────────────────────────────────────────────────────────────────
function hoy(){return new Date().toISOString().split('T')[0];}
function dias(f){return Math.floor((new Date()-new Date(f))/86400000);}
function fmtF(f){if(!f||f==='—')return'-';const p=String(f).split('-');if(p.length!==3||isNaN(+p[0])||isNaN(+p[1])||isNaN(+p[2]))return'-';return p[2]+'/'+p[1]+'/'+p[0];}
function diffDias(fecha){if(!fecha)return'';const a=new Date(hoy()+'T00:00:00');const b=new Date(fecha+'T00:00:00');return Math.round((b-a)/86400000);}

// ── DOM / Inputs ──────────────────────────────────────────────────────────────
function gv(id){const e=document.getElementById(id);return e?e.value.trim():'';}
function onlyNums(inp){inp.value=inp.value.replace(/\D/g,'');}
function numAttrs(){return ' inputmode="numeric" pattern="[0-9]*" oninput="onlyNums(this)"';}
function emailValido(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function validarEmailCampo(id,label){const v=gv(id);if(!emailValido(v)){notif(label+' incorrecto','err');const el=document.getElementById(id);if(el)el.focus();return false;}return true;}

// ── Normalización de cadenas ──────────────────────────────────────────────────
function agendaNorm(s){return String(s||'').trim().toLowerCase();}
function jsStr(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'');}

// ── Escape / sanitización HTML ────────────────────────────────────────────────
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');}
// Versión completa con protección adicional contra null-bytes y cierre de textarea
function escTextarea(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\x00/g,'').replace(/<\/textarea/gi,'&lt;/textarea');}

function purifyPlainText(val,ctx){
  if(val==null)return val;
  const s=String(val);
  if(!s)return s;
  let clean=s;
  if(typeof DOMPurify!=='undefined'&&DOMPurify.sanitize){
    clean=DOMPurify.sanitize(s,{ALLOWED_TAGS:[],ALLOWED_ATTR:[]});
  }else{
    clean=s.replace(/<[^>]*>/g,'');
  }
  if(clean!==s)console.warn('[XSS] Contenido malicioso sanitizado'+(ctx?(' en '+ctx):'')+':',s.substring(0,160));
  return clean;
}
function xssIsLikelyUrlField(key,val){
  return typeof val==='string'&&/^https?:\/\//i.test(val.trim())&&/(link|url|preview|embed)/i.test(String(key||''));
}
function xssIsLikelyDateOnly(val){
  return typeof val==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}
function sanitizeStringField(key,val,ctx){
  if(val==null||typeof val!=='string')return val;
  if(xssIsLikelyUrlField(key,val))return val;
  if(xssIsLikelyDateOnly(val))return val;
  return purifyPlainText(val,ctx);
}
function sanitizeJsonArrayField(jsonStr,fieldNames,ctx){
  try{
    const arr=JSON.parse(jsonStr||'[]');
    if(!Array.isArray(arr))return jsonStr;
    arr.forEach((item,i)=>{
      if(!item||typeof item!=='object')return;
      fieldNames.forEach(f=>{
        if(item[f]!=null)item[f]=sanitizeStringField(f,item[f],ctx+'['+i+'].'+f);
      });
    });
    return JSON.stringify(arr);
  }catch(e){return jsonStr;}
}
function sanitizeActoAdminJson(jsonStr,ctx){
  try{
    const arr=JSON.parse(jsonStr||'[]');
    if(!Array.isArray(arr))return jsonStr;
    arr.forEach((a,i)=>{
      if(!a||typeof a!=='object')return;
      ['tipo','numero','observaciones','nota','descripcion'].forEach(f=>{
        if(a[f]!=null)a[f]=sanitizeStringField(f,a[f],ctx+'['+i+'].'+f);
      });
    });
    return JSON.stringify(arr);
  }catch(e){return jsonStr;}
}
function sanitizeTaskRecord(t,ctx){
  if(!t||typeof t!=='object')return;
  ['actividad','detalle','desc','nota','observacion','nombre','tram'].forEach(k=>{
    if(t[k]!=null)t[k]=sanitizeStringField(k,t[k],ctx+'.'+k);
  });
  if(Array.isArray(t.comentarios))t.comentarios.forEach((c,i)=>{
    if(!c||typeof c!=='object')return;
    if(c.texto!=null)c.texto=sanitizeStringField('texto',c.texto,ctx+'.comentarios['+i+'].texto');
    if(c.autor!=null)c.autor=sanitizeStringField('autor',c.autor,ctx+'.comentarios['+i+'].autor');
  });
  if(Array.isArray(t.historial))t.historial.forEach((h,i)=>{
    if(!h||typeof h!=='object')return;
    ['nota','detalle','texto','desc','observacion'].forEach(f=>{
      if(h[f]!=null)h[f]=sanitizeStringField(f,h[f],ctx+'.historial['+i+'].'+f);
    });
  });
  if(Array.isArray(t.notasDoc))t.notasDoc.forEach((n,i)=>{
    if(!n||typeof n!=='object')return;
    if(n.texto!=null)n.texto=sanitizeStringField('texto',n.texto,ctx+'.notasDoc['+i+'].texto');
  });
}
function sanitizeHistRecord(h,ctx){
  if(!h||typeof h!=='object')return;
  ['nota','detalle','texto','desc','observacion','por','tipo'].forEach(f=>{
    if(h[f]!=null)h[f]=sanitizeStringField(f,h[f],ctx+'.'+f);
  });
}
function sanitizeExpRecord(e,ctx){
  if(!e||typeof e!=='object')return;
  Object.keys(e).forEach(k=>{
    const v=e[k];
    if(v==null||typeof v!=='string')return;
    if(XSS_JSON_BLOB_KEYS.has(k))return;
    if(xssIsLikelyUrlField(k,v))return;
    if(k==='_estado'||k==='_etapa'||k==='_tramite'||k==='_depto'||k==='_pqrs_oficina'||k==='_pqrs_estado_oficina')return;
    if(k.startsWith('_fecha'))return;
    if(k.startsWith('f_')||k==='_exp'||k==='_detalle_general'||k==='_obs_seg'||k==='_pqrs_detalle'||
       /nombre|descripcion|nota|observ|solicit|radic|detalle|asunto|empresa|identific|nit|empresa|interesado|comentario|asunto|texto|label|titulo|mensaje|msg/i.test(k)){
      e[k]=sanitizeStringField(k,v,ctx+'.'+k);
    }
  });
  if(e._detalle_notas)e._detalle_notas=sanitizeJsonArrayField(e._detalle_notas,['texto','autor'],ctx+'._detalle_notas');
  if(e._conceptos_seg)e._conceptos_seg=sanitizeJsonArrayField(e._conceptos_seg,['observaciones','concepto','reqNum','expSan','nota'],ctx+'._conceptos_seg');
  if(e._actos_admin)e._actos_admin=sanitizeActoAdminJson(e._actos_admin,ctx+'._actos_admin');
  if(Array.isArray(e.tasks))e.tasks.forEach((t,i)=>sanitizeTaskRecord(t,ctx+'.tasks['+i+']'));
  if(Array.isArray(e.historial))e.historial.forEach((h,i)=>sanitizeHistRecord(h,ctx+'.historial['+i+']'));
  if(Array.isArray(e._pqrs_comentarios))e._pqrs_comentarios.forEach((c,i)=>{
    if(!c||typeof c!=='object')return;
    if(c.texto!=null)c.texto=sanitizeStringField('texto',c.texto,ctx+'._pqrs_comentarios['+i+'].texto');
    if(c.autor!=null)c.autor=sanitizeStringField('autor',c.autor,ctx+'._pqrs_comentarios['+i+'].autor');
  });
  if(Array.isArray(e._pqrs_historial))e._pqrs_historial.forEach((h,i)=>sanitizeHistRecord(h,ctx+'._pqrs_historial['+i+']'));
}
function sanitizePersonaStrings(p,ctx){
  if(!p||typeof p!=='object')return;
  Object.keys(p).forEach(k=>{
    if(typeof p[k]==='string')p[k]=sanitizeStringField(k,p[k],ctx+'.'+k);
  });
}
function sanitizeChatMessage(m,ctx){
  if(!m||typeof m!=='object')return;
  if(m.text!=null)m.text=sanitizeStringField('text',m.text,ctx+'.text');
  if(m.texto!=null)m.texto=sanitizeStringField('texto',m.texto,ctx+'.texto');
  if(m.mensaje!=null)m.mensaje=sanitizeStringField('mensaje',m.mensaje,ctx+'.mensaje');
  if(m.fromLabel!=null)m.fromLabel=sanitizeStringField('fromLabel',m.fromLabel,ctx+'.fromLabel');
  if(m.toLabel!=null)m.toLabel=sanitizeStringField('toLabel',m.toLabel,ctx+'.toLabel');
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
function isQuotaExceededError(e){
  if(!e)return false;
  if(e.name==='QuotaExceededError')return true;
  if(e.code===22||e.code===1014)return true;
  return String(e.message||'').toLowerCase().includes('quota');
}

// ── UI global helpers ─────────────────────────────────────────────────────────
function showStorageFullBanner(){
  const el=document.getElementById('storage-full-banner');
  if(el)el.classList.add('on');
}
function cerrarStorageFullBanner(){
  const el=document.getElementById('storage-full-banner');
  if(el)el.classList.remove('on');
}
function updateSyncIndicator(estado){
  const el=document.getElementById('sync-indicator');
  if(!el)return;
  const textos={syncing:'⏳ Guardando…',synced:'✅ Sincronizado',offline:'📴 Modo local',error:'⚠️ Error al guardar'};
  el.textContent=textos[estado]||'';
}

// ── Notificaciones de escritorio (Web Notifications API) ───────────────────
const _sstDeskNotifyRecent=new Map();
function sstDesktopNotifySupported(){
  return typeof window!=='undefined'&&'Notification' in window;
}
function sstDesktopNotifyGranted(){
  return sstDesktopNotifySupported()&&Notification.permission==='granted';
}
async function sstRequestDesktopNotifyPermission(){
  if(!sstDesktopNotifySupported())return false;
  if(Notification.permission==='granted')return true;
  if(Notification.permission==='denied')return false;
  try{
    const r=await Notification.requestPermission();
    return r==='granted';
  }catch(e){
    return false;
  }
}
function sstInitDesktopNotify(){
  if(!sstDesktopNotifySupported())return;
  if(Notification.permission==='granted'||Notification.permission==='denied')return;
  setTimeout(function(){
    if(!document.body.classList.contains('sesion-activa'))return;
    notif('Active las notificaciones del navegador para recibir avisos de chat y campanita en el escritorio.','info');
    void sstRequestDesktopNotifyPermission();
  },2500);
}
function sstShowDesktopNotify(title,body,opts){
  opts=opts||{};
  if(!document.body.classList.contains('sesion-activa'))return false;
  if(!sstDesktopNotifyGranted())return false;
  const tag=String(opts.tag||title||'sst');
  const now=Date.now();
  const prev=_sstDeskNotifyRecent.get(tag);
  if(prev&&now-prev<4000)return false;
  _sstDeskNotifyRecent.set(tag,now);
  try{
    let icon=opts.icon||'';
    if(!icon){
      try{icon=new URL('assets/logo-cda-icon.png',window.location.href).href;}catch(e){}
    }
    const n=new Notification(String(title||'CDA Expedientes'),{
      body:String(body||'').slice(0,240),
      icon:icon||undefined,
      tag:tag,
      silent:!!opts.silent
    });
    n.onclick=function(){
      try{window.focus();}catch(e){}
      n.close();
      if(typeof opts.onClick==='function')opts.onClick();
    };
    if(opts.autoClose!==false){
      setTimeout(function(){try{n.close();}catch(e){}},opts.autoCloseMs||12000);
    }
    return true;
  }catch(e){
    console.warn('sstShowDesktopNotify:',e);
    return false;
  }
}
