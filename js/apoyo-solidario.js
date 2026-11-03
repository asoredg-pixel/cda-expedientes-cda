// =============================================================================
// apoyo-solidario.js — Medidor de lecturas y apoyo solidario para mantener el sistema
// =============================================================================
(function(){
'use strict';

var APOYO_CFG_DEFAULT={
  cupoDiario:800,
  precioPorMilUsd:0.35,
  trmCop:4200,
  diaCorte:28,
  diasGraciaHabiles:3,
  activo:true
};

window._apoyoCfg=Object.assign({},APOYO_CFG_DEFAULT);
window._apoyoUso=null;
window._apoyoUsoDirty=false;
window._apoyoSaveTimer=null;
window._apoyoTrmConsultada=null;

function apoyoHoyLocal(){
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function apoyoEmailKey(){
  var e=(window._usuarioActual&&window._usuarioActual.email)||(window._firebaseAuth&&window._firebaseAuth.currentUser&&window._firebaseAuth.currentUser.email)||'';
  return String(e||'').trim().toLowerCase();
}
function apoyoEsAdmin(){
  return (typeof esAdministrador==='function'&&esAdministrador())||(typeof esAdminFirestore==='function'&&esAdminFirestore());
}
function apoyoNormCfg(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  var c=Object.assign({},APOYO_CFG_DEFAULT,raw);
  c.cupoDiario=Math.max(0,parseInt(c.cupoDiario,10)||0);
  c.precioPorMilUsd=Math.max(0,Number(c.precioPorMilUsd)||0);
  c.trmCop=Math.max(1,Number(c.trmCop)||APOYO_CFG_DEFAULT.trmCop);
  c.diaCorte=Math.min(28,Math.max(1,parseInt(c.diaCorte,10)||28));
  c.diasGraciaHabiles=Math.max(0,parseInt(c.diasGraciaHabiles,10)||0);
  c.activo=c.activo!==false;
  return c;
}
/** Periodo de apoyo: año-mes del corte vigente (día 1..28 → mes actual; tras el 28 sigue el mes del corte hasta nueva ciclo). */
function apoyoPeriodoId(fechaIso){
  var s=String(fechaIso||apoyoHoyLocal()).slice(0,10);
  var p=s.split('-');
  var y=parseInt(p[0],10),m=parseInt(p[1],10),d=parseInt(p[2],10);
  var cfg=window._apoyoCfg||APOYO_CFG_DEFAULT;
  var corte=cfg.diaCorte||28;
  if(d>corte){
    m+=1;
    if(m>12){m=1;y+=1;}
  }
  return y+'-'+String(m).padStart(2,'0');
}
function apoyoFechaCortePeriodo(periodoId){
  var p=String(periodoId||'').split('-');
  var y=parseInt(p[0],10),m=parseInt(p[1],10);
  var corte=(window._apoyoCfg&&window._apoyoCfg.diaCorte)||28;
  var ultimo=new Date(y,m,0).getDate();
  var dia=Math.min(corte,ultimo);
  return y+'-'+String(m).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
}
function apoyoAddDiasCalendario(fechaIso,n){
  var d=new Date(String(fechaIso).slice(0,10)+'T12:00:00');
  d.setDate(d.getDate()+(n||0));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function apoyoSiguienteHabil(desdeIso){
  var f=apoyoAddDiasCalendario(desdeIso,1);
  var guard=0;
  while(guard++<40){
    if(typeof esDiaHabilCO==='function'?esDiaHabilCO(f):true)return f;
    f=apoyoAddDiasCalendario(f,1);
  }
  return f;
}
/** Días hábiles de gracia tras la fecha de corte (no cuenta el día de corte). */
function apoyoFechasGracia(periodoId){
  var cfg=window._apoyoCfg||APOYO_CFG_DEFAULT;
  var corte=apoyoFechaCortePeriodo(periodoId);
  var out=[];
  var f=corte;
  var n=cfg.diasGraciaHabiles||3;
  for(var i=0;i<n;i++){
    f=apoyoSiguienteHabil(f);
    out.push(f);
  }
  return out;
}
function apoyoUltimoDiaGracia(periodoId){
  var g=apoyoFechasGracia(periodoId);
  return g.length?g[g.length-1]:apoyoFechaCortePeriodo(periodoId);
}
function apoyoDiasGraciaRestantes(periodoId,hoy){
  hoy=String(hoy||apoyoHoyLocal()).slice(0,10);
  var gracia=apoyoFechasGracia(periodoId);
  var corte=apoyoFechaCortePeriodo(periodoId);
  if(hoy<corte)return -1;
  if(hoy===corte)return gracia.length;
  for(var i=0;i<gracia.length;i++){
    if(hoy===gracia[i])return gracia.length-i;
    if(hoy<gracia[i])return gracia.length-i;
  }
  return 0;
}
function apoyoUsoVacio(periodoId){
  return{
    email:apoyoEmailKey(),
    periodo:periodoId||apoyoPeriodoId(),
    diaIso:'',
    lecturasDia:0,
    cobrablesDia:0,
    lecturasMes:0,
    cobrablesMes:0,
    montoUsd:0,
    montoCop:0,
    apoyado:false,
    apoyadoEn:'',
    apoyadoPor:'',
    historial:[]
  };
}
function apoyoCalcMontos(cobrables,cfg){
  cfg=cfg||window._apoyoCfg||APOYO_CFG_DEFAULT;
  var mil=Math.max(0,Number(cobrables)||0)/1000;
  var usd=mil*(Number(cfg.precioPorMilUsd)||0);
  var cop=usd*(Number(cfg.trmCop)||0);
  return{usd:Math.round(usd*10000)/10000,cop:Math.round(cop)};
}
function apoyoAplicarCfgRemota(raw){
  window._apoyoCfg=apoyoNormCfg(raw);
  if(typeof apoyoPintarUI==='function')apoyoPintarUI();
}
function apoyoMergeUsoRemoto(data){
  if(!data||typeof data!=='object')return;
  var per=apoyoPeriodoId();
  if(String(data.periodo||'')!==per){
    window._apoyoUso=apoyoUsoVacio(per);
    return;
  }
  window._apoyoUso=Object.assign(apoyoUsoVacio(per),data,{periodo:per,email:apoyoEmailKey()});
}
async function apoyoCargarCfg(){
  var db=window._db;
  if(!db||!window._fsGetDoc||!window._fsDoc)return;
  try{
    var snap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
    if(snap&&snap.exists&&snap.exists()){
      var g=snap.data()||{};
      if(g.apoyoSolidarioCfg)apoyoAplicarCfgRemota(g.apoyoSolidarioCfg);
    }
  }catch(e){console.warn('apoyoCargarCfg',e);}
}
async function apoyoCargarUso(){
  if(apoyoEsAdmin()){window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());return;}
  var email=apoyoEmailKey();
  if(!email||!window._db||!window._fsGetDoc||!window._fsDoc)return;
  try{
    var snap=await window._fsGetDoc(window._fsDoc(window._db,'apoyo_uso',email));
    if(snap&&snap.exists&&snap.exists())apoyoMergeUsoRemoto(snap.data());
    else window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
  }catch(e){
    console.warn('apoyoCargarUso',e);
    if(!window._apoyoUso)window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
  }
  apoyoPintarUI();
}
function apoyoProgramarGuardarUso(){
  if(apoyoEsAdmin())return;
  window._apoyoUsoDirty=true;
  if(window._apoyoSaveTimer)clearTimeout(window._apoyoSaveTimer);
  window._apoyoSaveTimer=setTimeout(function(){apoyoGuardarUso();},2500);
}
async function apoyoGuardarUso(){
  if(apoyoEsAdmin())return;
  var email=apoyoEmailKey();
  var u=window._apoyoUso;
  if(!email||!u||!window._db||!window._fsSetDoc||!window._fsDoc)return;
  window._apoyoUsoDirty=false;
  var payload={
    email:email,
    periodo:u.periodo,
    diaIso:u.diaIso||'',
    lecturasDia:u.lecturasDia|0,
    cobrablesDia:u.cobrablesDia|0,
    lecturasMes:u.lecturasMes|0,
    cobrablesMes:u.cobrablesMes|0,
    montoUsd:Number(u.montoUsd)||0,
    montoCop:Number(u.montoCop)||0,
    apoyado:!!u.apoyado,
    apoyadoEn:u.apoyadoEn||'',
    apoyadoPor:u.apoyadoPor||'',
    historial:Array.isArray(u.historial)?u.historial.slice(-40):[],
    updatedAt:new Date().toISOString()
  };
  try{
    await window._fsSetDoc(window._fsDoc(window._db,'apoyo_uso',email),payload,{merge:true});
  }catch(e){console.warn('apoyoGuardarUso',e);window._apoyoUsoDirty=true;}
}
function apoyoAsegurarDia(u){
  var hoy=apoyoHoyLocal();
  var per=apoyoPeriodoId(hoy);
  if(!u||u.periodo!==per){
    u=apoyoUsoVacio(per);
    window._apoyoUso=u;
  }
  if(u.diaIso!==hoy){
    u.diaIso=hoy;
    u.lecturasDia=0;
    u.cobrablesDia=0;
  }
  return u;
}
/** Registra lecturas de documentos Firestore hechas por la sesión. */
function apoyoRegistrarLecturas(n){
  n=parseInt(n,10)||0;
  if(n<=0)return;
  if(apoyoEsAdmin())return;
  if(!(window._apoyoCfg&&window._apoyoCfg.activo!==false))return;
  if(!document.body.classList.contains('sesion-activa'))return;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return;
  var cfg=window._apoyoCfg||APOYO_CFG_DEFAULT;
  var u=apoyoAsegurarDia(window._apoyoUso||apoyoUsoVacio());
  var cupo=cfg.cupoDiario|0;
  var libres=Math.max(0,cupo-u.lecturasDia);
  var cob=Math.max(0,n-libres);
  u.lecturasDia+=n;
  u.lecturasMes+=n;
  u.cobrablesDia+=cob;
  u.cobrablesMes+=cob;
  var m=apoyoCalcMontos(u.cobrablesMes,cfg);
  u.montoUsd=m.usd;
  u.montoCop=m.cop;
  window._apoyoUso=u;
  apoyoProgramarGuardarUso();
  apoyoPintarUI();
}
function apoyoPeriodoPendiente(){
  var hoy=apoyoHoyLocal();
  var per=apoyoPeriodoId(hoy);
  var corte=apoyoFechaCortePeriodo(per);
  if(hoy<corte){
    // Tras gracia del periodo anterior, si no apoyó, sigue pendiente ese periodo
    var prev=apoyoPeriodoAnterior(per);
    var u=window._apoyoUso;
    if(u&&u.periodo===prev&&!u.apoyado&&apoyoDiasGraciaRestantes(prev,hoy)===0&&hoy>apoyoUltimoDiaGracia(prev))
      return prev;
    return null;
  }
  return per;
}
function apoyoPeriodoAnterior(periodoId){
  var p=String(periodoId||'').split('-');
  var y=parseInt(p[0],10),m=parseInt(p[1],10)-1;
  if(m<1){m=12;y-=1;}
  return y+'-'+String(m).padStart(2,'0');
}
/** True si pasó el plazo solidario y aún no registró el apoyo (bloquea Drive). */
function apoyoDriveRestringido(){
  if(apoyoEsAdmin())return false;
  if(!(window._apoyoCfg&&window._apoyoCfg.activo!==false))return false;
  var u=window._apoyoUso;
  if(!u)return false;
  if(u.apoyado)return false;
  var hoy=apoyoHoyLocal();
  var per=u.periodo||apoyoPeriodoId(hoy);
  var corte=apoyoFechaCortePeriodo(per);
  if(hoy<=corte)return false;
  if(apoyoDiasGraciaRestantes(per,hoy)>0)return false;
  // Solo restringe si hubo consumo cobrable
  if(!(Number(u.cobrablesMes)>0||Number(u.montoCop)>0))return false;
  return hoy>apoyoUltimoDiaGracia(per);
}
function apoyoFmtCop(n){
  n=Math.round(Number(n)||0);
  try{return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);}
  catch(e){return '$ '+n;}
}
function apoyoFmtUsd(n){
  n=Number(n)||0;
  return 'USD '+n.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
}
function apoyoMensajeBanner(){
  if(apoyoEsAdmin())return'';
  var u=window._apoyoUso;
  if(!u)return'';
  var hoy=apoyoHoyLocal();
  var per=u.periodo||apoyoPeriodoId(hoy);
  var corte=apoyoFechaCortePeriodo(per);
  if(hoy<corte)return'';
  var resto=apoyoDiasGraciaRestantes(per,hoy);
  var monto=apoyoFmtCop(u.montoCop);
  if(u.apoyado)return'';
  if(!(Number(u.cobrablesMes)>0||Number(u.montoCop)>0))return'';
  if(hoy===corte){
    return '🤝 <strong>Apoyo solidario</strong> — consumo del ciclo: <strong>'+monto+'</strong>. Entre todos mantenemos el sistema. Plazo solidario: '+(window._apoyoCfg.diasGraciaHabiles||3)+' días hábiles.';
  }
  if(resto>1){
    return '🤝 <strong>Apoyo solidario</strong> — monto del ciclo: <strong>'+monto+'</strong>. Quedan <strong>'+resto+' días hábiles</strong> de plazo solidario.';
  }
  if(resto===1){
    return '🤝 <strong>Apoyo solidario</strong> — monto: <strong>'+monto+'</strong>. Queda <strong>1 día hábil</strong> de plazo. Al día siguiente, sin el apoyo registrado, no se podrá conectar Drive.';
  }
  return '🤝 <strong>Apoyo solidario pendiente</strong> — monto: <strong>'+monto+'</strong>. Drive permanece desconectado hasta registrar el apoyo. Puede seguir consultando el sistema.';
}
function apoyoPintarBanner(){
  var ban=document.getElementById('apoyo-banner');
  if(!ban)return;
  var msg=apoyoMensajeBanner();
  var ver=!!msg&&document.body.classList.contains('sesion-activa')&&!(typeof esModoCiudadano==='function'&&esModoCiudadano());
  document.body.classList.toggle('apoyo-aviso-visible',ver);
  ban.innerHTML=ver?msg:'';
}
function apoyoPintarMedidor(){
  var el=document.getElementById('sst-apoyo-meter');
  if(!el)return;
  var show=document.body.classList.contains('sesion-activa')&&!(typeof esModoCiudadano==='function'&&esModoCiudadano())&&!apoyoEsAdmin();
  el.style.display=show?'':'none';
  if(!show)return;
  var cfg=window._apoyoCfg||APOYO_CFG_DEFAULT;
  var u=apoyoAsegurarDia(window._apoyoUso||apoyoUsoVacio());
  var cupo=cfg.cupoDiario|0;
  var usados=Math.min(cupo,u.lecturasDia|0);
  var pct=cupo?Math.min(100,Math.round(usados/cupo*100)):100;
  var bar=el.querySelector('.sst-apoyo-bar-fill');
  var lbl=el.querySelector('.sst-apoyo-meter-lbl');
  if(bar){
    bar.style.width=pct+'%';
    bar.classList.toggle('over',(u.lecturasDia|0)>cupo);
  }
  if(lbl){
    var cob=u.cobrablesMes|0;
    lbl.textContent=cupo?(usados+'/'+cupo+' hoy'+(cob?' · +'+cob+' mes':'')):(cob+' lect. mes');
  }
  el.title='Apoyo solidario: cupo diario gratis y consumo del ciclo ('+apoyoFmtCop(u.montoCop)+')';
  el.classList.toggle('sst-apoyo-blocked',apoyoDriveRestringido());
}
function apoyoPintarUI(){
  apoyoPintarBanner();
  apoyoPintarMedidor();
  if(typeof sstRenderGmailDriveStatusBtn==='function')sstRenderGmailDriveStatusBtn();
}
async function apoyoInitSesion(){
  await apoyoCargarCfg();
  await apoyoCargarUso();
  apoyoPintarUI();
}
async function apoyoGuardarCfgDesdeForm(){
  if(!apoyoEsAdmin()){if(typeof notif==='function')notif('Solo el administrador puede configurar el apoyo solidario','err');return;}
  var cupo=parseInt((document.getElementById('apoyo-cfg-cupo')||{}).value,10);
  var precio=Number((document.getElementById('apoyo-cfg-precio')||{}).value);
  var trm=Number((document.getElementById('apoyo-cfg-trm')||{}).value);
  var activo=!!(document.getElementById('apoyo-cfg-activo')&&document.getElementById('apoyo-cfg-activo').checked);
  if(isNaN(cupo)||cupo<0){notif('Cupo diario inválido','err');return;}
  if(isNaN(precio)||precio<0){notif('Precio inválido','err');return;}
  if(isNaN(trm)||trm<=0){notif('TRM inválida','err');return;}
  var cfg=apoyoNormCfg({
    cupoDiario:cupo,
    precioPorMilUsd:precio,
    trmCop:trm,
    diaCorte:28,
    diasGraciaHabiles:3,
    activo:activo
  });
  var db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){notif('Firestore no disponible','err');return;}
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{apoyoSolidarioCfg:cfg},{merge:true});
    window._apoyoCfg=cfg;
    notif('Apoyo solidario actualizado','ok');
    if(typeof renderListasCfg==='function')renderListasCfg();
    apoyoPintarUI();
  }catch(e){console.warn(e);notif('No se pudo guardar','err');}
}
async function apoyoConsultarTrm(){
  var el=document.getElementById('apoyo-cfg-trm');
  var hint=document.getElementById('apoyo-cfg-trm-hint');
  try{
    // Referencia pública USD→COP (el administrador puede ajustar a la TRM BanRep del día).
    var r=await fetch('https://open.er-api.com/v6/latest/USD',{cache:'no-store'});
    var j=await r.json();
    var cop=j&&j.rates&&j.rates.COP;
    if(!cop)throw new Error('sin COP');
    window._apoyoTrmConsultada=Number(cop);
    if(el)el.value=String(Math.round(Number(cop)*100)/100);
    if(hint)hint.textContent='Referencia consultada: '+cop+' COP/USD. Ajústela a la TRM del Banco de la República si lo requiere.';
    if(typeof notif==='function')notif('TRM de referencia cargada. Puede ajustarla.','ok');
  }catch(e){
    if(hint)hint.textContent='No se pudo consultar la tasa. Digite la TRM del Banco de la República.';
    if(typeof notif==='function')notif('No se pudo consultar la tasa. Digítela manualmente.','warn');
  }
}
async function apoyoListarUsosAdmin(){
  if(!apoyoEsAdmin()||!window._db||!window._fsGetDocs||!window._fsCollection)return[];
  try{
    var snap=await window._fsGetDocs(window._fsCollection(window._db,'apoyo_uso'));
    var list=[];
    snap.forEach(function(d){list.push(Object.assign({id:d.id},d.data()||{}));});
    list.sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});
    return list;
  }catch(e){console.warn('apoyoListarUsosAdmin',e);return[];}
}
async function apoyoMarcarApoyoUsuario(email,reiniciar){
  if(!apoyoEsAdmin())return;
  email=String(email||'').trim().toLowerCase();
  if(!email||!window._db||!window._fsSetDoc||!window._fsDoc||!window._fsGetDoc)return;
  var ref=window._fsDoc(window._db,'apoyo_uso',email);
  var snap=await window._fsGetDoc(ref);
  var data=snap&&snap.exists&&snap.exists()?snap.data()||{}:apoyoUsoVacio();
  var por=(window._usuarioActual&&(window._usuarioActual.nombre||window._usuarioActual.email))||'admin';
  var hist=Array.isArray(data.historial)?data.historial.slice():[];
  hist.push({tipo:'apoyo',en:new Date().toISOString(),por:por,montoCop:data.montoCop||0,montoUsd:data.montoUsd||0,periodo:data.periodo||apoyoPeriodoId(),cobrables:data.cobrablesMes||0});
  var patch={
    apoyado:true,
    apoyadoEn:new Date().toISOString(),
    apoyadoPor:String(por),
    historial:hist.slice(-40),
    updatedAt:new Date().toISOString()
  };
  if(reiniciar){
    var per=apoyoPeriodoId();
    patch.periodo=per;
    patch.diaIso=apoyoHoyLocal();
    patch.lecturasDia=0;
    patch.cobrablesDia=0;
    patch.lecturasMes=0;
    patch.cobrablesMes=0;
    patch.montoUsd=0;
    patch.montoCop=0;
  }
  await window._fsSetDoc(ref,patch,{merge:true});
  if(typeof notif==='function')notif('Apoyo registrado'+(reiniciar?' y consumo reiniciado':''),'ok');
  if(typeof renderListasCfg==='function')renderListasCfg();
}
async function apoyoReiniciarUsuario(email){
  if(!apoyoEsAdmin())return;
  email=String(email||'').trim().toLowerCase();
  if(!email||!window._db||!window._fsSetDoc||!window._fsDoc)return;
  var por=(window._usuarioActual&&(window._usuarioActual.nombre||window._usuarioActual.email))||'admin';
  var per=apoyoPeriodoId();
  await window._fsSetDoc(window._fsDoc(window._db,'apoyo_uso',email),{
    email:email,
    periodo:per,
    diaIso:apoyoHoyLocal(),
    lecturasDia:0,
    cobrablesDia:0,
    lecturasMes:0,
    cobrablesMes:0,
    montoUsd:0,
    montoCop:0,
    apoyado:false,
    apoyadoEn:'',
    apoyadoPor:'',
    historial:[{tipo:'reinicio',en:new Date().toISOString(),por:por,periodo:per}],
    updatedAt:new Date().toISOString()
  },{merge:true});
  if(typeof notif==='function')notif('Consumo reiniciado','ok');
  if(typeof renderListasCfg==='function')renderListasCfg();
}
function apoyoCfgCardBody(){
  var cfg=apoyoNormCfg(window._apoyoCfg);
  var inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  return '<div class="cfcard" id="apoyo-cfg-card">'+
    '<p style="font-size:12px;color:var(--tx2);margin:0 0 12px;line-height:1.45">Cada persona tiene un cupo diario de lecturas. Si lo supera, el excedente suma al <strong>apoyo solidario</strong> del ciclo (corte día 28 + 3 días hábiles). Tras el plazo, sin el apoyo registrado, no podrá conectar Drive. El tono hacia los usuarios es solidario, no comercial.</p>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Estado</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:4px"><input type="checkbox" id="apoyo-cfg-activo"'+(cfg.activo?' checked':'')+'> Activar apoyo solidario</label></div>'+
    '<div class="fld"><label for="apoyo-cfg-cupo">Lecturas gratis por día</label><input type="number" min="0" step="1" id="apoyo-cfg-cupo" value="'+escAttr(String(cfg.cupoDiario))+'" style="'+inp+'"></div>'+
    '<div class="fld"><label for="apoyo-cfg-precio">USD por cada 1.000 lecturas cobrables</label><input type="number" min="0" step="0.01" id="apoyo-cfg-precio" value="'+escAttr(String(cfg.precioPorMilUsd))+'" style="'+inp+'"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:8px">'+
    '<div class="fld"><label for="apoyo-cfg-trm">TRM (COP por USD)</label><input type="number" min="1" step="0.01" id="apoyo-cfg-trm" value="'+escAttr(String(cfg.trmCop))+'" style="'+inp+'"></div>'+
    '<div class="fld" style="display:flex;align-items:flex-end"><button type="button" class="btn bsm" onclick="apoyoConsultarTrm()">Consultar tasa</button></div>'+
    '</div>'+
    '<div id="apoyo-cfg-trm-hint" style="font-size:11px;color:var(--tx3);margin-bottom:12px">Corte fijo: día 28. Plazo solidario: 3 días hábiles. Puede ajustar la TRM a la del Banco de la República.</div>'+
    '<button type="button" class="btn bsm bp" onclick="apoyoGuardarCfgDesdeForm()">Guardar apoyo solidario</button>'+
    '<div id="apoyo-admin-lista" style="margin-top:16px"></div>'+
  '</div>';
}
async function apoyoPintarListaAdmin(){
  var box=document.getElementById('apoyo-admin-lista');
  if(!box||!apoyoEsAdmin())return;
  box.innerHTML='<div style="font-size:12px;color:var(--tx3)">Cargando consumos…</div>';
  var list=await apoyoListarUsosAdmin();
  if(!list.length){box.innerHTML='<div style="font-size:12px;color:var(--tx3);margin-top:8px">Sin registros de consumo todavía.</div>';return;}
  var h='<div class="slbl" style="margin:12px 0 8px">Histórico por usuario</div><div class="tw"><table><thead><tr><th>Usuario</th><th>Periodo</th><th>Lecturas</th><th>Cobrables</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>';
  list.forEach(function(u){
    var email=String(u.email||u.id||'').trim().toLowerCase();
    var emailJs=JSON.stringify(email);
    h+='<tr><td style="font-size:12px">'+escAttr(email)+'</td><td>'+escAttr(u.periodo||'')+'</td>'+
      '<td>'+(u.lecturasMes|0)+'</td><td>'+(u.cobrablesMes|0)+'</td>'+
      '<td>'+escAttr(apoyoFmtCop(u.montoCop))+'</td>'+
      '<td>'+(u.apoyado?'✓ Apoyó':'Pendiente')+'</td>'+
      '<td style="white-space:nowrap">'+
      '<button type="button" class="btn bsm bp" onclick=\'apoyoMarcarApoyoUsuario('+emailJs+',true)\'>Apoyó + reiniciar</button> '+
      '<button type="button" class="btn bsm" onclick=\'apoyoMarcarApoyoUsuario('+emailJs+',false)\'>Solo apoyó</button> '+
      '<button type="button" class="btn bsm" onclick=\'apoyoReiniciarUsuario('+emailJs+')\'>Reiniciar</button>'+
      '</td></tr>';
  });
  h+='</tbody></table></div>';
  box.innerHTML=h;
}

window.apoyoRegistrarLecturas=apoyoRegistrarLecturas;
window.apoyoDriveRestringido=apoyoDriveRestringido;
window.apoyoInitSesion=apoyoInitSesion;
window.apoyoAplicarCfgRemota=apoyoAplicarCfgRemota;
window.apoyoPintarUI=apoyoPintarUI;
window.apoyoCfgCardBody=apoyoCfgCardBody;
window.apoyoPintarListaAdmin=apoyoPintarListaAdmin;
window.apoyoGuardarCfgDesdeForm=apoyoGuardarCfgDesdeForm;
window.apoyoConsultarTrm=apoyoConsultarTrm;
window.apoyoMarcarApoyoUsuario=apoyoMarcarApoyoUsuario;
window.apoyoReiniciarUsuario=apoyoReiniciarUsuario;
window.apoyoMensajeDriveBloqueado=function(){
  var u=window._apoyoUso||{};
  return 'Apoyo solidario pendiente ('+apoyoFmtCop(u.montoCop)+'). Registre el apoyo para volver a conectar Drive y así mantener el sistema entre todos.';
};
})();
