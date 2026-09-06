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
function _isoDateLocal(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascuaDomingo(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}
function _siguienteLunes(d){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const dow=x.getDay();
  const add=dow===1?0:(dow===0?1:(8-dow));
  x.setDate(x.getDate()+add);
  return x;
}
/** Festivos Colombia (nacionales + traslado a lunes donde aplica). */
function festivosColombiaSet(year){
  const set=new Set();
  const add=d=>set.add(_isoDateLocal(d));
  const fixed=[[1,1],[5,1],[7,20],[8,7],[12,8],[12,25]];
  fixed.forEach(([mo,da])=>add(new Date(year,mo-1,da)));
  const pascua=pascuaDomingo(year);
  add(new Date(pascua.getFullYear(),pascua.getMonth(),pascua.getDate()-3)); // Jueves Santo
  add(new Date(pascua.getFullYear(),pascua.getMonth(),pascua.getDate()-2)); // Viernes Santo
  // Festivos que se trasladan al lunes siguiente
  [[1,6],[3,19],[6,29],[8,15],[10,12],[11,1],[11,11]].forEach(([mo,da])=>add(_siguienteLunes(new Date(year,mo-1,da))));
  // Ascensión (+39), Corpus (+60), Sagrado Corazón (+71) → lunes
  add(_siguienteLunes(new Date(pascua.getFullYear(),pascua.getMonth(),pascua.getDate()+39)));
  add(_siguienteLunes(new Date(pascua.getFullYear(),pascua.getMonth(),pascua.getDate()+60)));
  add(_siguienteLunes(new Date(pascua.getFullYear(),pascua.getMonth(),pascua.getDate()+71)));
  return set;
}
function esDiaHabilCO(fechaStr){
  const s=String(fechaStr||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T12:00:00');
  const dow=d.getDay();
  if(dow===0||dow===6)return false;
  const y=d.getFullYear();
  if(!esDiaHabilCO._cache)esDiaHabilCO._cache={};
  if(!esDiaHabilCO._cache[y])esDiaHabilCO._cache[y]=festivosColombiaSet(y);
  return !esDiaHabilCO._cache[y].has(s);
}
/** Suma N días hábiles colombianos a partir del día siguiente a `desde`. */
function addDiasHabilesCO(desde,n){
  const nNum=Math.max(0,Number(n)||0);
  let d=new Date(String(desde||hoy()).slice(0,10)+'T12:00:00');
  let left=nNum;
  while(left>0){
    d.setDate(d.getDate()+1);
    if(esDiaHabilCO(_isoDateLocal(d)))left--;
  }
  return _isoDateLocal(d);
}
/** Calcula fecha de vencimiento según unidad (días calendario o hábiles CO). */
function calcVenceConUnidad(desde,dias,unidad){
  const n=Number(dias);
  if(dias===''||dias===null||dias===undefined||isNaN(n))return'';
  const base=String(desde||hoy()).slice(0,10);
  if(String(unidad||'').toLowerCase()==='habiles')return addDiasHabilesCO(base,n);
  const d=new Date(base+'T00:00:00');
  d.setDate(d.getDate()+n);
  return d.toISOString().split('T')[0];
}

// ── DOM / Inputs ──────────────────────────────────────────────────────────────
function gv(id){const e=document.getElementById(id);return e?e.value.trim():'';}
function onlyNums(inp){inp.value=inp.value.replace(/\D/g,'');}
function numAttrs(){return ' inputmode="numeric" pattern="[0-9]*" oninput="onlyNums(this)"';}
function emailValido(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function validarEmailCampo(id,label){const v=gv(id);if(!emailValido(v)){notif(label+' incorrecto','err');const el=document.getElementById(id);if(el)el.focus();return false;}return true;}

/** Solo dígitos (para comparar / buscar NIT e identificación). */
function digitsOnly(s){return String(s||'').replace(/\D/g,'');}
/** Separador de miles con punto (estilo CO): 901218674 → 901.218.674 */
function formatMilesDigits(digits){
  const d=digitsOnly(digits);
  if(!d)return'';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
/** Identificación persona natural con miles. */
function formatIdentDisplay(val){return formatMilesDigits(val);}
/** Partes de NIT: base + dígito de verificación (acepta 901.218.674-1). */
function parseNitParts(val){
  const raw=String(val||'').trim();
  if(!raw)return{base:'',dv:''};
  const m=raw.match(/^([\d.\s]+)\s*[-–]\s*(\d)\s*$/);
  if(m)return{base:digitsOnly(m[1]),dv:m[2]};
  return{base:digitsOnly(raw),dv:''};
}
/** NIT completo para guardar/mostrar: 901.218.674-1 */
function formatNitDisplay(val){
  const p=parseNitParts(val);
  if(!p.base)return'';
  const miles=formatMilesDigits(p.base);
  return p.dv?miles+'-'+p.dv:miles;
}
function composeNitFromParts(base,dv){
  return formatNitDisplay((digitsOnly(base)||'')+(digitsOnly(dv).slice(0,1)?'-'+digitsOnly(dv).slice(0,1):''));
}
function onIdentMilesInput(inp){
  if(!inp)return;
  inp.value=formatMilesDigits(inp.value);
}
/** Sincroniza recuadros NIT + DV y el campo oculto con el valor completo. */
function syncNitUiFromValue(mainId,val){
  const formatted=formatNitDisplay(val);
  const parts=parseNitParts(val);
  const main=document.getElementById(mainId);
  const base=document.getElementById(mainId+'-base');
  const dv=document.getElementById(mainId+'-dv');
  if(main)main.value=formatted;
  if(base)base.value=formatMilesDigits(parts.base);
  if(dv)dv.value=parts.dv||'';
}
function onNitBaseDvInput(mainId){
  const baseEl=document.getElementById(mainId+'-base');
  const dvEl=document.getElementById(mainId+'-dv');
  if(baseEl)baseEl.value=formatMilesDigits(baseEl.value);
  if(dvEl)dvEl.value=digitsOnly(dvEl.value).slice(0,1);
  const composed=composeNitFromParts(baseEl?baseEl.value:'',dvEl?dvEl.value:'');
  const main=document.getElementById(mainId);
  if(main)main.value=composed;
}
/** HTML: NIT (miles) - DV (placeholder se oculta al escribir). Campo oculto = valor completo. */
function htmlNitConDvField(mainId,opts){
  opts=opts||{};
  const val=opts.value||'';
  const parts=parseNitParts(val);
  const composed=formatNitDisplay(val);
  let styleRaw=String(opts.style||'').replace(/width\s*:\s*[^;]+;?/gi,'').trim();
  if(styleRaw&&!/;\s*$/.test(styleRaw))styleRaw+=';';
  const style=styleRaw?(' style="'+styleRaw.replace(/"/g,'&quot;')+'"'):'';
  const ph=escAttr(opts.placeholder||'NIT');
  let baseEvents='oninput="onNitBaseDvInput(\''+jsStr(mainId)+'\')"';
  if(opts.sugTarget){
    baseEvents='oninput="onNitBaseDvInput(\''+jsStr(mainId)+'\');filtrarPersonasSug(this,\''+jsStr(opts.sugTarget)+'\',\'nit\')" onfocus="filtrarPersonasSug(this,\''+jsStr(opts.sugTarget)+'\',\'nit\')" onblur="setTimeout(()=>hidePersonSug(),180)"';
  }
  return '<div class="nit-dv-row">'+
    '<input type="text" id="'+escAttr(mainId)+'-base" class="nit-base-input" value="'+escAttr(formatMilesDigits(parts.base))+'" placeholder="'+ph+'" inputmode="numeric" autocomplete="off" '+baseEvents+style+'>'+
    '<span class="nit-dv-sep" aria-hidden="true">-</span>'+
    '<input type="text" id="'+escAttr(mainId)+'-dv" class="nit-dv-input" value="'+escAttr(parts.dv||'')+'" placeholder="DV" maxlength="1" inputmode="numeric" autocomplete="off" oninput="onNitBaseDvInput(\''+jsStr(mainId)+'\')"'+style+'>'+
    '</div>'+
    '<input type="hidden" id="'+escAttr(mainId)+'" value="'+escAttr(composed)+'">';
}
/** Deshabilita/limpia campo (incluye pares NIT-base/DV). */
function setUiFieldDisabled(id,disabled,clear){
  const el=document.getElementById(id);
  if(el){el.disabled=!!disabled;if(clear)el.value='';}
  const base=document.getElementById(id+'-base');
  const dv=document.getElementById(id+'-dv');
  if(base){base.disabled=!!disabled;if(clear)base.value='';}
  if(dv){dv.disabled=!!disabled;if(clear)dv.value='';}
  if(clear&&(base||dv)&&el)el.value='';
}
function clearUiField(id){
  const el=document.getElementById(id);
  if(el)el.value='';
  if(document.getElementById(id+'-base'))syncNitUiFromValue(id,'');
}

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
  if(e._conceptos_seg)e._conceptos_seg=sanitizeJsonArrayField(e._conceptos_seg,['observaciones','concepto','reqNum','expSan','nota','tipoConcepto','reqOficio','conceptoReqId','reqMedio'],ctx+'._conceptos_seg');
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

// ── Email chips (estilo Gmail Para/Cc/Cco) ───────────────────────────────────
function sstParseEmailList(raw){
  return String(raw||'').split(/[,;\s]+/).map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s&&s.indexOf('@')>0;});
}
function sstEmailLooksValid(em){
  const v=String(em||'').trim().toLowerCase();
  if(!v)return false;
  if(typeof emailValido==='function')return !!emailValido(v);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function sstEmailChipsIsMultiId(id){
  const s=String(id||'');
  return /(^|[_-])(to|cc|bcc|para)$/i.test(s)
    ||/(email)-(to|cc|bcc)/i.test(s)
    ||/(compose|notif)-(to|cc|bcc)/i.test(s)
    ||/mail-(para|cc|bcc)/i.test(s)
    ||/^gm-compose-(to|cc|bcc)$/i.test(s)
    ||/^gmail-resp-pqrs-email$/i.test(s);
}
function sstEmailChipsShouldMount(el){
  if(!el||el.tagName!=='INPUT')return false;
  if(el.dataset.emailChipsMounted==='1')return false;
  if(el.classList.contains('email-chips-edit')||el.classList.contains('email-chips-value'))return false;
  if(el.type==='hidden'||el.type==='checkbox'||el.type==='radio'||el.type==='file'||el.type==='password')return false;
  if(el.dataset.emailChips==='0'||el.dataset.noEmailChips==='1')return false;
  if(el.dataset.emailChips==='1'||el.classList.contains('sst-email-chips'))return true;
  if(el.type==='email')return true;
  return sstEmailChipsIsMultiId(el.id);
}
function sstEmailChipsMaxFor(el){
  if(el&&el.dataset.emailChipsMax)return Math.max(0,parseInt(el.dataset.emailChipsMax,10)||0);
  if(el&&sstEmailChipsIsMultiId(el.id))return 0;
  if(el&&el.type==='email')return 1;
  return 0;
}
function sstMountEmailChips(inputEl,opts){
  opts=opts||{};
  if(!inputEl)return null;
  if(inputEl.dataset.emailChipsMounted==='1')return inputEl.closest('.email-chips');
  if(!opts.force&&!sstEmailChipsShouldMount(inputEl))return null;
  const max=opts.max!=null?opts.max:sstEmailChipsMaxFor(inputEl);
  const wrap=document.createElement('div');
  wrap.className='email-chips'+(opts.inline||(inputEl.closest&&inputEl.closest('.gm-compose-field'))?' email-chips--inline':'');
  wrap.setAttribute('role','group');
  wrap.setAttribute('aria-label',inputEl.getAttribute('aria-label')||inputEl.placeholder||'Correos');
  const pills=document.createElement('span');
  pills.className='email-chips-pills';
  const edit=document.createElement('input');
  edit.type='text';
  edit.className='email-chips-edit';
  edit.placeholder=inputEl.placeholder||'';
  edit.autocomplete='off';
  edit.spellcheck=false;
  if(inputEl.disabled)edit.disabled=true;
  if(inputEl.readOnly)edit.readOnly=true;
  let emails=sstParseEmailList(inputEl.value).filter(sstEmailLooksValid);
  if(max===1&&emails.length>1)emails=emails.slice(0,1);
  const parent=inputEl.parentNode;
  if(!parent)return null;
  parent.insertBefore(wrap,inputEl);
  wrap.appendChild(pills);
  wrap.appendChild(edit);
  wrap.appendChild(inputEl);
  inputEl.dataset.emailChipsMounted='1';
  inputEl.classList.add('email-chips-value');
  if(inputEl.type==='email'||inputEl.type==='text')inputEl.type='hidden';
  function syncHidden(){
    inputEl.value=emails.join(', ');
    try{inputEl.dispatchEvent(new Event('input',{bubbles:true}));}catch(e0){}
    try{inputEl.dispatchEvent(new Event('change',{bubbles:true}));}catch(e1){}
  }
  function render(){
    pills.innerHTML='';
    emails.forEach(function(em,idx){
      const chip=document.createElement('span');
      chip.className='email-chip';
      chip.title=em;
      const av=document.createElement('span');
      av.className='email-chip-av';
      av.textContent=(em.charAt(0)||'?').toUpperCase();
      const txt=document.createElement('span');
      txt.className='email-chip-txt';
      txt.textContent=em;
      const x=document.createElement('button');
      x.type='button';
      x.className='email-chip-x';
      x.setAttribute('aria-label','Quitar '+em);
      x.textContent='\u00d7';
      x.addEventListener('click',function(ev){
        ev.preventDefault();ev.stopPropagation();
        emails=emails.filter(function(_,i){return i!==idx;});
        render();
        edit.focus();
      });
      chip.appendChild(av);chip.appendChild(txt);chip.appendChild(x);
      pills.appendChild(chip);
    });
    syncHidden();
    wrap.classList.toggle('has-chips',emails.length>0);
  }
  function commitToken(raw){
    const token=String(raw||'').trim().toLowerCase().replace(/^[,;\s]+|[,;\s]+$/g,'');
    if(!token)return false;
    if(!sstEmailLooksValid(token)){
      edit.classList.add('is-invalid');
      return false;
    }
    edit.classList.remove('is-invalid');
    if(emails.indexOf(token)>=0){edit.value='';return true;}
    if(max===1)emails=[token];
    else emails.push(token);
    edit.value='';
    render();
    return true;
  }
  function commitBuffer(){
    const raw=edit.value;
    if(!String(raw||'').trim())return;
    const parts=String(raw).split(/[,;]+/);
    let ok=true;
    parts.forEach(function(p){
      if(!String(p||'').trim())return;
      if(!commitToken(p))ok=false;
    });
    if(ok)edit.value='';
  }
  edit.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'||ev.key===','||ev.key===';'){
      if(String(edit.value||'').trim()){
        ev.preventDefault();
        commitBuffer();
      }
      return;
    }
    if(ev.key==='Tab'&&String(edit.value||'').trim()){
      commitBuffer();
      return;
    }
    if((ev.key==='Backspace'||ev.key==='Delete')&&!edit.value&&emails.length){
      ev.preventDefault();
      emails.pop();
      render();
    }
  });
  edit.addEventListener('input',function(){
    const v=edit.value;
    if(/[,;]\s*$/.test(v)){
      edit.value=v.replace(/[,;]\s*$/,'');
      commitBuffer();
    }else if(/\s$/.test(v)&&sstEmailLooksValid(v.trim())){
      edit.value=v.trim();
      commitBuffer();
    }
    edit.classList.toggle('is-invalid',!!edit.value&&edit.value.indexOf('@')>0&&!sstEmailLooksValid(edit.value.trim()));
  });
  edit.addEventListener('blur',function(){commitBuffer();});
  edit.addEventListener('paste',function(ev){
    const txt=(ev.clipboardData||window.clipboardData||{}).getData('text')||'';
    if(txt&&/[,;\s]/.test(txt)){
      ev.preventDefault();
      edit.value=(edit.value||'')+txt;
      commitBuffer();
    }
  });
  wrap.addEventListener('click',function(ev){
    if(ev.target===wrap||ev.target===pills)edit.focus();
  });
  function setFromValue(raw){
    emails=sstParseEmailList(raw).filter(sstEmailLooksValid);
    if(max===1&&emails.length>1)emails=emails.slice(0,1);
    edit.value='';
    edit.classList.remove('is-invalid');
    render();
  }
  wrap._sstChips={setFromValue:setFromValue,max:max,edit:edit};
  render();
  return wrap;
}
function sstEmailChipsRefresh(elOrId){
  const el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
  if(!el)return;
  const wrap=el.classList&&el.classList.contains('email-chips')?el:(el.closest?el.closest('.email-chips'):null);
  const hid=wrap?(wrap.querySelector('input.email-chips-value')||el):(el.dataset&&el.dataset.emailChipsMounted==='1'?el:null);
  if(wrap&&wrap._sstChips&&wrap._sstChips.setFromValue){
    wrap._sstChips.setFromValue(hid?hid.value:el.value);
    return;
  }
  if(el&&sstEmailChipsShouldMount(el))sstMountEmailChips(el);
}
function sstInitEmailChipsIn(root){
  root=root||document;
  if(!root||!root.querySelectorAll)return;
  const nodes=root.querySelectorAll('input[type="email"],input[type="text"],input.sst-email-chips,input[data-email-chips="1"]');
  for(let i=0;i<nodes.length;i++){
    const el=nodes[i];
    if(!sstEmailChipsShouldMount(el))continue;
    try{sstMountEmailChips(el);}catch(err){console.warn('sstMountEmailChips',el.id,err);}
  }
}
function sstWatchEmailChips(root){
  root=root||document.body;
  if(!root||root._sstEmailChipsWatch)return;
  root._sstEmailChipsWatch=true;
  const run=function(){try{sstInitEmailChipsIn(root);}catch(e){}};
  const obs=new MutationObserver(function(){
    if(root._sstEmailChipsTick)return;
    root._sstEmailChipsTick=setTimeout(function(){root._sstEmailChipsTick=null;run();},40);
  });
  obs.observe(root,{childList:true,subtree:true});
  run();
}
window.sstParseEmailList=sstParseEmailList;
window.sstMountEmailChips=sstMountEmailChips;
window.sstEmailChipsRefresh=sstEmailChipsRefresh;
window.sstInitEmailChipsIn=sstInitEmailChipsIn;
window.sstWatchEmailChips=sstWatchEmailChips;
document.addEventListener('DOMContentLoaded',function(){
  try{sstWatchEmailChips(document.body);}catch(e){}
});
if(document.readyState!=='loading'){
  try{sstWatchEmailChips(document.body);}catch(e){}
}
