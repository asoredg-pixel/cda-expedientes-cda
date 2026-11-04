// =============================================================================
// apoyo-solidario.js — Medidor de lecturas y apoyo solidario para mantener el sistema
// =============================================================================
(function(){
'use strict';

var APOYO_CFG_DEFAULT={
  cupoDiario:800,
  /** Cupo gratis global del proyecto/día (colchón bajo el de Blaze, p. ej. 40k vs 50k). */
  cupoGlobalDia:40000,
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
/** false hasta cargar apoyo_uso/{email}: las lecturas de login no parten de 0 ni pisan el día en otro PC. */
window._apoyoUsoListo=false;
window._apoyoLecturasCola=0;
window._apoyoFlushBound=false;
window._apoyoGlobal={diaIso:'',lecturas:0,baseB:0};
window._apoyoGlobalUnsub=null;
window._apoyoGlobalPend=0;
window._apoyoGlobalBasePend=0;
window._apoyoGlobalSaveTimer=null;

/** Día de cupo gratis: se renueva a las 02:00 (misma franja en que Blaze renueva lo gratuito). Antes de las 2:00 sigue contando el día anterior. */
var APOYO_HORA_RENOVACION=2;
var APOYO_LS_PREFIX='sst_apoyo_uso_v1:';
var APOYO_LS_GLOBAL_PREFIX='sst_apoyo_consumo_v1:';
function apoyoHoyLocal(){
  var d=new Date();
  if(d.getHours()<APOYO_HORA_RENOVACION)d.setDate(d.getDate()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/** Normaliza diaIso a YYYY-MM-DD (evita reiniciar el día si llegó con hora ISO). */
function apoyoNormDiaIso(s){
  var t=String(s||'').trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);
  return '';
}
function apoyoLsKey(email){
  email=String(email||apoyoEmailKey()||'').trim().toLowerCase();
  return email?(APOYO_LS_PREFIX+email):'';
}
/** U personal solo en Firestore: limpia espejos locales viejos (alteraban % entre PCs). */
function apoyoLimpiarEspejoUsoLocal(){
  try{
    var key=apoyoLsKey();
    if(key)localStorage.removeItem(key);
    // Basura de sesiones anteriores (otros correos en el mismo navegador)
    for(var i=localStorage.length-1;i>=0;i--){
      var k=localStorage.key(i);
      if(k&&k.indexOf(APOYO_LS_PREFIX)===0)localStorage.removeItem(k);
    }
  }catch(e){}
}
function apoyoMirrorLocal(/*u*/){/* no-op: U = Firestore */}
function apoyoLeerMirrorLocal(){return null;}
function apoyoMirrorGlobalWrite(){
  try{
    var hoy=apoyoHoyLocal();
    var g=window._apoyoGlobal||{};
    localStorage.setItem(APOYO_LS_GLOBAL_PREFIX+hoy,JSON.stringify({
      diaIso:hoy,
      lecturas:g.lecturas|0,
      baseB:g.baseB|0,
      pend:window._apoyoGlobalPend|0,
      pendBase:window._apoyoGlobalBasePend|0
    }));
  }catch(e){}
}
function apoyoLeerMirrorGlobal(){
  try{
    var raw=localStorage.getItem(APOYO_LS_GLOBAL_PREFIX+apoyoHoyLocal());
    if(!raw)return null;
    var d=JSON.parse(raw);
    return d&&typeof d==='object'?d:null;
  }catch(e){return null;}
}
/**
 * Estado G = solo lecturas confirmadas en Firestore (misma barra para todos).
 * El espejo local solo reencola `pend` para no perder aportes si F5 corta el flush;
 * no infla lecturas/baseB (eso hacía ver 2% en un PC y 0% en otro).
 */
function apoyoAplicarEstadoGlobal(lecturas,baseB,opts){
  opts=opts||{};
  var hoy=apoyoHoyLocal();
  var lect=lecturas|0;
  var base=baseB|0;
  var mir=opts.skipMirror?null:apoyoLeerMirrorGlobal();
  if(mir&&apoyoNormDiaIso(mir.diaIso)===hoy&&!opts.skipPendRequeue){
    var p=mir.pend|0,pb=mir.pendBase|0;
    window._apoyoGlobalPend=(window._apoyoGlobalPend|0)+p;
    window._apoyoGlobalBasePend=(window._apoyoGlobalBasePend|0)+pb;
  }
  window._apoyoGlobal={diaIso:hoy,lecturas:lect,baseB:base};
  apoyoMirrorGlobalWrite();
  return window._apoyoGlobal;
}
/** Barra G: únicamente lo confirmado en apoyo_consumo (sin pendiente local). */
function apoyoLecturasGlobalVista(){
  var g=window._apoyoGlobal||{};
  return g.lecturas|0;
}
function apoyoMsHastaRenovacion(){
  var ahora=new Date();
  var next=new Date(ahora.getFullYear(),ahora.getMonth(),ahora.getDate(),APOYO_HORA_RENOVACION,0,0,0);
  if(ahora.getTime()>=next.getTime())next.setDate(next.getDate()+1);
  return Math.max(1000,next.getTime()-ahora.getTime());
}
function apoyoProgramarRenovacionDia(){
  if(window._apoyoRenovTimer){try{clearTimeout(window._apoyoRenovTimer);}catch(e){}}
  window._apoyoRenovTimer=setTimeout(function(){
    window._apoyoRenovTimer=null;
    if(!document.body.classList.contains('sesion-activa'))return;
    if(window._apoyoUso){
      apoyoAsegurarDia(window._apoyoUso);
      if(window._apoyoUsoListo)apoyoProgramarGuardarUso();
    }
    apoyoEscucharGlobalDia();
    apoyoPintarUI();
    apoyoProgramarRenovacionDia();
  },apoyoMsHastaRenovacion()+800);
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
  c.cupoGlobalDia=Math.max(0,parseInt(c.cupoGlobalDia,10)||0);
  if(!c.cupoGlobalDia&&raw.cupoGlobalDia==null)c.cupoGlobalDia=APOYO_CFG_DEFAULT.cupoGlobalDia;
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
    /** Peso del día para reparto B: min(lecturasDia, cupo personal) — no incluye lo ya cobrado como A. */
    baseBDia:0,
    cobrablesBlazeDia:0,
    cobrablesBlazeMes:0,
    montoBlazeUsd:0,
    montoBlazeCop:0,
    montoUsd:0,
    montoCop:0,
    apoyado:false,
    apoyadoEn:'',
    apoyadoPor:'',
    historial:[]
  };
}
function apoyoBaseBUsuario(lecturasDia,cupoPersonal){
  cupoPersonal=Math.max(0,cupoPersonal|0);
  lecturasDia=Math.max(0,lecturasDia|0);
  return Math.min(lecturasDia,cupoPersonal);
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
  // Cupo/precio nuevos: solo el excedente NUEVO (A o B). Lo ya cobrado en el ciclo no se toca.
  if(window._apoyoUsoListo&&window._apoyoUso&&!apoyoEsAdmin()){
    if(apoyoAplicarCobroBlaze(window._apoyoUso,window._apoyoCfg)>0)apoyoProgramarGuardarUso();
  }
  if(typeof apoyoPintarUI==='function')apoyoPintarUI();
}
/** Traslada deuda del ciclo (cobro A+B) si cambia el periodo sin haber marcado apoyo. */
function apoyoHeredarCobroCiclo(destino,origen){
  if(!destino||!origen||origen.apoyado)return destino;
  destino.lecturasMes=Math.max(destino.lecturasMes|0,origen.lecturasMes|0);
  destino.cobrablesMes=Math.max(destino.cobrablesMes|0,origen.cobrablesMes|0);
  destino.cobrablesBlazeMes=Math.max(destino.cobrablesBlazeMes|0,origen.cobrablesBlazeMes|0);
  destino.montoUsd=Math.max(Number(destino.montoUsd)||0,Number(origen.montoUsd)||0);
  destino.montoCop=Math.max(Number(destino.montoCop)||0,Number(origen.montoCop)||0);
  destino.montoBlazeUsd=Math.max(Number(destino.montoBlazeUsd)||0,Number(origen.montoBlazeUsd)||0);
  destino.montoBlazeCop=Math.max(Number(destino.montoBlazeCop)||0,Number(origen.montoBlazeCop)||0);
  return destino;
}
function apoyoMergeUsoRemoto(data){
  if(!data||typeof data!=='object')return;
  var per=apoyoPeriodoId();
  if(String(data.periodo||'')!==per){
    // Periodo distinto: el % diario arranca en 0, pero el cobro NO pagado se hereda desde Firestore
    var base=apoyoUsoVacio(per);
    apoyoHeredarCobroCiclo(base,data);
    window._apoyoUso=base;
    apoyoAsegurarDia(window._apoyoUso);
    return;
  }
  if(data.diaIso)data.diaIso=apoyoNormDiaIso(data.diaIso)||data.diaIso;
  window._apoyoUso=Object.assign(apoyoUsoVacio(per),data,{periodo:per,email:apoyoEmailKey()});
  apoyoAsegurarDia(window._apoyoUso);
}
/** Une dos copias del mismo periodo/día tomando el mayor consumo (varios PC / pestañas / F5). */
function apoyoFusionarMaxUso(local,remote){
  var per=apoyoPeriodoId();
  var hoy=apoyoHoyLocal();
  if(!local)local=apoyoUsoVacio(per);
  if(!remote||typeof remote!=='object')return local;
  if(String(remote.periodo||'')!==per)return local;
  var out=Object.assign(apoyoUsoVacio(per),local,{periodo:per,email:apoyoEmailKey()||local.email||remote.email});
  var rDia=apoyoNormDiaIso(remote.diaIso);
  var lDia=apoyoNormDiaIso(local.diaIso);
  if(rDia===hoy&&(lDia===hoy||!lDia)){
    out.diaIso=hoy;
    out.lecturasDia=Math.max(local.lecturasDia|0,remote.lecturasDia|0);
    out.cobrablesDia=Math.max(local.cobrablesDia|0,remote.cobrablesDia|0);
    out.baseBDia=Math.max(local.baseBDia|0,remote.baseBDia|0);
    out.cobrablesBlazeDia=Math.max(local.cobrablesBlazeDia|0,remote.cobrablesBlazeDia|0);
  }else if(rDia===hoy&&lDia&&lDia!==hoy){
    out.diaIso=hoy;
    out.lecturasDia=remote.lecturasDia|0;
    out.cobrablesDia=remote.cobrablesDia|0;
    out.baseBDia=remote.baseBDia|0;
    out.cobrablesBlazeDia=remote.cobrablesBlazeDia|0;
  }else if(lDia===hoy){
    out.diaIso=hoy;
    out.lecturasDia=local.lecturasDia|0;
    out.cobrablesDia=local.cobrablesDia|0;
    out.baseBDia=local.baseBDia|0;
    out.cobrablesBlazeDia=local.cobrablesBlazeDia|0;
  }
  out.lecturasMes=Math.max(local.lecturasMes|0,remote.lecturasMes|0);
  out.cobrablesMes=Math.max(local.cobrablesMes|0,remote.cobrablesMes|0);
  out.cobrablesBlazeMes=Math.max(local.cobrablesBlazeMes|0,remote.cobrablesBlazeMes|0);
  out.montoBlazeUsd=Math.max(Number(local.montoBlazeUsd)||0,Number(remote.montoBlazeUsd)||0);
  out.montoBlazeCop=Math.max(Number(local.montoBlazeCop)||0,Number(remote.montoBlazeCop)||0);
  out.montoUsd=Math.max(Number(local.montoUsd)||0,Number(remote.montoUsd)||0);
  out.montoCop=Math.max(Number(local.montoCop)||0,Number(remote.montoCop)||0);
  if(remote.apoyado){
    out.apoyado=true;
    out.apoyadoEn=remote.apoyadoEn||out.apoyadoEn||'';
    out.apoyadoPor=remote.apoyadoPor||out.apoyadoPor||'';
  }else if(local.apoyado){
    out.apoyado=true;
    out.apoyadoEn=local.apoyadoEn||'';
    out.apoyadoPor=local.apoyadoPor||'';
  }
  var hist=[];
  (Array.isArray(remote.historial)?remote.historial:[]).concat(Array.isArray(local.historial)?local.historial:[]).forEach(function(h){
    if(!h)return;
    hist.push(h);
  });
  out.historial=hist.slice(-40);
  return out;
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
  if(apoyoEsAdmin()){
    window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
    window._apoyoUsoListo=true;
    return;
  }
  apoyoLimpiarEspejoUsoLocal();
  var email=apoyoEmailKey();
  if(!email||!window._db||!window._fsGetDoc||!window._fsDoc){
    window._apoyoUso=window._apoyoUso||apoyoUsoVacio(apoyoPeriodoId());
    apoyoAsegurarDia(window._apoyoUso);
    window._apoyoUsoListo=true;
    return;
  }
  try{
    var snap=await window._fsGetDoc(window._fsDoc(window._db,'apoyo_uso',email));
    var remote=snap&&snap.exists&&snap.exists()?snap.data():null;
    // Solo Firestore: otro PC ve el mismo U; al entrar suma lo que descargue esta sesión
    if(remote)apoyoMergeUsoRemoto(remote);
    else window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
  }catch(e){
    console.warn('apoyoCargarUso',e);
    if(!window._apoyoUso)window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
  }
  apoyoAsegurarDia(window._apoyoUso);
  window._apoyoUsoListo=true;
  if(window._apoyoLecturasCola>0){
    var cola=window._apoyoLecturasCola;
    window._apoyoLecturasCola=0;
    apoyoRegistrarLecturas(cola);
  }
  apoyoPintarUI();
}
function apoyoProgramarGuardarUso(){
  if(apoyoEsAdmin())return;
  window._apoyoUsoDirty=true;
  if(window._apoyoSaveTimer)clearTimeout(window._apoyoSaveTimer);
  // Debounce corto → Firestore (fuente de U entre PCs)
  window._apoyoSaveTimer=setTimeout(function(){apoyoGuardarUso();},400);
}
function apoyoPayloadDesdeUso(u,email){
  return{
    email:email,
    periodo:u.periodo,
    diaIso:u.diaIso||'',
    lecturasDia:u.lecturasDia|0,
    cobrablesDia:u.cobrablesDia|0,
    lecturasMes:u.lecturasMes|0,
    cobrablesMes:u.cobrablesMes|0,
    baseBDia:u.baseBDia|0,
    cobrablesBlazeDia:u.cobrablesBlazeDia|0,
    cobrablesBlazeMes:u.cobrablesBlazeMes|0,
    montoBlazeUsd:Number(u.montoBlazeUsd)||0,
    montoBlazeCop:Number(u.montoBlazeCop)||0,
    montoUsd:Number(u.montoUsd)||0,
    montoCop:Number(u.montoCop)||0,
    apoyado:!!u.apoyado,
    apoyadoEn:u.apoyadoEn||'',
    apoyadoPor:u.apoyadoPor||'',
    historial:Array.isArray(u.historial)?u.historial.slice(-40):[],
    updatedAt:new Date().toISOString()
  };
}
async function apoyoGuardarUso(){
  if(apoyoEsAdmin())return;
  if(!window._apoyoUsoListo)return;
  var email=apoyoEmailKey();
  var u=window._apoyoUso;
  if(!email||!u||!window._db||!window._fsDoc)return;
  if(!window._fsSetDoc&&!window._fsRunTransaction)return;
  window._apoyoUsoDirty=false;
  var ref=window._fsDoc(window._db,'apoyo_uso',email);
  try{
    // Máximo con remoto al guardar: dos PCs no se pisan; la lectura al entrar siempre es Firestore.
    if(typeof window._fsRunTransaction==='function'){
      await window._fsRunTransaction(window._db,async function(tx){
        var snap=await tx.get(ref);
        var remote=snap&&snap.exists()?snap.data():null;
        var merged=apoyoFusionarMaxUso(u,remote);
        window._apoyoUso=merged;
        tx.set(ref,apoyoPayloadDesdeUso(merged,email),{merge:true});
      });
    }else{
      var snap2=window._fsGetDoc?await window._fsGetDoc(ref):null;
      var remote2=snap2&&snap2.exists&&snap2.exists()?snap2.data():null;
      var merged2=apoyoFusionarMaxUso(u,remote2);
      window._apoyoUso=merged2;
      await window._fsSetDoc(ref,apoyoPayloadDesdeUso(merged2,email),{merge:true});
    }
    apoyoPintarUI();
  }catch(e){console.warn('apoyoGuardarUso',e);window._apoyoUsoDirty=true;}
}
function apoyoAsegurarDia(u){
  var hoy=apoyoHoyLocal();
  var per=apoyoPeriodoId(hoy);
  if(!u){
    u=apoyoUsoVacio(per);
    window._apoyoUso=u;
  }else if(u.periodo!==per){
    // Nuevo periodo de facturación: reinicia contadores del día/mes de lecturas libres,
    // pero conserva cobro acumulado hasta que el admin marque apoyo (+ reinicio).
    var prev=u;
    u=apoyoUsoVacio(per);
    apoyoHeredarCobroCiclo(u,prev);
    window._apoyoUso=u;
  }
  var dia=apoyoNormDiaIso(u.diaIso);
  if(dia)u.diaIso=dia;
  if(u.diaIso!==hoy){
    // Cliente viejo sin diaIso pero con lecturas del día: no borrar al cargar.
    if(!dia&&((u.lecturasDia|0)>0||(u.cobrablesDia|0)>0||(u.baseBDia|0)>0)){
      u.diaIso=hoy;
    }else{
      // Solo reinicia el medidor diario (U). Nunca montoCop / cobrablesMes del ciclo.
      u.diaIso=hoy;
      u.lecturasDia=0;
      u.cobrablesDia=0;
      u.baseBDia=0;
      u.cobrablesBlazeDia=0;
    }
  }
  if(u.baseBDia==null)u.baseBDia=0;
  if(u.cobrablesBlazeDia==null)u.cobrablesBlazeDia=0;
  if(u.cobrablesBlazeMes==null)u.cobrablesBlazeMes=0;
  if(u.montoBlazeUsd==null)u.montoBlazeUsd=0;
  if(u.montoBlazeCop==null)u.montoBlazeCop=0;
  return u;
}
function apoyoBindFlush(){
  if(window._apoyoFlushBound)return;
  window._apoyoFlushBound=true;
  var flush=function(){
    if(window._apoyoSaveTimer){clearTimeout(window._apoyoSaveTimer);window._apoyoSaveTimer=null;}
    if(window._apoyoGlobalSaveTimer){clearTimeout(window._apoyoGlobalSaveTimer);window._apoyoGlobalSaveTimer=null;}
    apoyoMirrorGlobalWrite();
    if(window._apoyoUsoDirty)apoyoGuardarUso();
    if((window._apoyoGlobalPend|0)>0||(window._apoyoGlobalBasePend|0)>0)apoyoFlushGlobalPendiente();
  };
  window.addEventListener('pagehide',flush);
  window.addEventListener('beforeunload',flush);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')flush();
  });
}
/** Aplica cobro B (excedente global) sin doblar lo ya cobrado como A personal. */
function apoyoAplicarCobroBlaze(u,cfg){
  cfg=cfg||window._apoyoCfg||APOYO_CFG_DEFAULT;
  u=apoyoAsegurarDia(u||window._apoyoUso||apoyoUsoVacio());
  var g=window._apoyoGlobal||{lecturas:0,baseB:0};
  var cupoG=cfg.cupoGlobalDia|0;
  var lectG=g.lecturas|0;
  var baseG=g.baseB|0;
  var baseU=u.baseBDia|0;
  var target=0;
  if(cupoG>0&&lectG>cupoG&&baseG>0&&baseU>0){
    var exc=lectG-cupoG;
    target=Math.floor(exc*(baseU/baseG));
  }
  var prev=u.cobrablesBlazeDia|0;
  var delta=Math.max(0,target-prev);
  if(delta>0){
    u.cobrablesBlazeDia=target;
    u.cobrablesBlazeMes=(u.cobrablesBlazeMes|0)+delta;
    var m=apoyoCalcMontos(delta,cfg);
    u.montoBlazeUsd=Math.round(((Number(u.montoBlazeUsd)||0)+m.usd)*10000)/10000;
    u.montoBlazeCop=Math.round((Number(u.montoBlazeCop)||0)+m.cop);
    u.montoUsd=Math.round(((Number(u.montoUsd)||0)+m.usd)*10000)/10000;
    u.montoCop=Math.round((Number(u.montoCop)||0)+m.cop);
  }else{
    u.cobrablesBlazeDia=Math.max(prev,target);
  }
  window._apoyoUso=u;
  return delta;
}
function apoyoProgramarGlobalFlush(){
  if(window._apoyoGlobalSaveTimer)clearTimeout(window._apoyoGlobalSaveTimer);
  window._apoyoGlobalSaveTimer=setTimeout(function(){apoyoFlushGlobalPendiente();},400);
}
async function apoyoFlushGlobalPendiente(){
  var n=window._apoyoGlobalPend|0;
  var dbInc=window._apoyoGlobalBasePend|0;
  if(n<=0&&dbInc<=0)return;
  window._apoyoGlobalPend=0;
  window._apoyoGlobalBasePend=0;
  var hoy=apoyoHoyLocal();
  if(!window._db||!window._fsDoc){
    window._apoyoGlobalPend=n;
    window._apoyoGlobalBasePend=dbInc;
    return;
  }
  var ref=window._fsDoc(window._db,'apoyo_consumo',hoy);
  try{
    if(typeof window._fsRunTransaction==='function'){
      await window._fsRunTransaction(window._db,async function(tx){
        var snap=await tx.get(ref);
        var cur=snap&&snap.exists()?snap.data():{};
        var lect=(cur.lecturas|0)+n;
        var base=(cur.baseB|0)+dbInc;
        tx.set(ref,{
          diaIso:hoy,
          lecturas:lect,
          baseB:base,
          updatedAt:new Date().toISOString()
        },{merge:true});
        window._apoyoGlobal={diaIso:hoy,lecturas:lect,baseB:base};
        // No poner pend=0 aquí: durante el await pudieron encolarse aportes nuevos
        apoyoMirrorGlobalWrite();
      });
    }else if(window._fsSetDoc&&window._fsGetDoc){
      var snap2=await window._fsGetDoc(ref);
      var cur2=snap2&&snap2.exists&&snap2.exists()?snap2.data():{};
      var lect2=(cur2.lecturas|0)+n;
      var base2=(cur2.baseB|0)+dbInc;
      await window._fsSetDoc(ref,{diaIso:hoy,lecturas:lect2,baseB:base2,updatedAt:new Date().toISOString()},{merge:true});
      window._apoyoGlobal={diaIso:hoy,lecturas:lect2,baseB:base2};
      apoyoMirrorGlobalWrite();
    }else{
      window._apoyoGlobalPend=(window._apoyoGlobalPend|0)+n;
      window._apoyoGlobalBasePend=(window._apoyoGlobalBasePend|0)+dbInc;
      apoyoMirrorGlobalWrite();
      return;
    }
    if(window._apoyoUsoListo&&window._apoyoUso){
      if(apoyoAplicarCobroBlaze(window._apoyoUso)>0)apoyoProgramarGuardarUso();
      apoyoPintarUI();
    }
  }catch(e){
    console.warn('apoyoFlushGlobalPendiente',e);
    window._apoyoGlobalPend=(window._apoyoGlobalPend|0)+n;
    window._apoyoGlobalBasePend=(window._apoyoGlobalBasePend|0)+dbInc;
    apoyoMirrorGlobalWrite();
  }
}
function apoyoSumarGlobalLocal(n,deltaBaseB){
  n=n|0;deltaBaseB=deltaBaseB|0;
  if(n<=0&&deltaBaseB<=0)return;
  // Solo encola: la barra G no sube aquí; sube cuando Firestore confirma (mismo % para todos).
  window._apoyoGlobalPend=(window._apoyoGlobalPend|0)+n;
  window._apoyoGlobalBasePend=(window._apoyoGlobalBasePend|0)+deltaBaseB;
  apoyoMirrorGlobalWrite();
  apoyoProgramarGlobalFlush();
}
async function apoyoCargarGlobalDia(){
  if(apoyoEsAdmin())return;
  var hoy=apoyoHoyLocal();
  var lect=0,base=0;
  if(window._db&&window._fsDoc&&window._fsGetDoc){
    try{
      var snap=await window._fsGetDoc(window._fsDoc(window._db,'apoyo_consumo',hoy));
      var d=snap&&snap.exists&&snap.exists()?snap.data():{};
      lect=d.lecturas|0;
      base=d.baseB|0;
    }catch(e){console.warn('apoyoCargarGlobalDia',e);}
  }
  apoyoAplicarEstadoGlobal(lect,base,{});
  if((window._apoyoGlobalPend|0)>0||(window._apoyoGlobalBasePend|0)>0)apoyoProgramarGlobalFlush();
  apoyoPintarUI();
}
function apoyoEscucharGlobalDia(){
  if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
  if(apoyoEsAdmin()||!window._db||!window._fsDoc||!window._fsOnSnapshot)return;
  var hoy=apoyoHoyLocal();
  var ref=window._fsDoc(window._db,'apoyo_consumo',hoy);
  window._apoyoGlobalUnsub=window._fsOnSnapshot(ref,function(snap){
    var hoy2=apoyoHoyLocal();
    if(hoy2!==hoy){apoyoEscucharGlobalDia();return;}
    var d=snap&&snap.exists&&snap.exists()?snap.data():{};
    // Solo servidor: todos ven el mismo G (no max con local/espejo)
    window._apoyoGlobal={
      diaIso:hoy2,
      lecturas:d.lecturas|0,
      baseB:d.baseB|0
    };
    apoyoMirrorGlobalWrite();
    if(window._apoyoUsoListo&&window._apoyoUso){
      if(apoyoAplicarCobroBlaze(window._apoyoUso)>0)apoyoProgramarGuardarUso();
      apoyoPintarUI();
    }
  },function(err){console.warn('apoyoEscucharGlobalDia',err);});
}
/** Registra lecturas de documentos Firestore hechas por la sesión. */
function apoyoRegistrarLecturas(n){
  n=parseInt(n,10)||0;
  if(n<=0)return;
  if(apoyoEsAdmin())return;
  if(!(window._apoyoCfg&&window._apoyoCfg.activo!==false))return;
  if(!document.body.classList.contains('sesion-activa'))return;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return;
  // Esperar consumo diario remoto (mismo usuario en otro PC / F5).
  if(!window._apoyoUsoListo){
    window._apoyoLecturasCola=(window._apoyoLecturasCola|0)+n;
    return;
  }
  var cfg=window._apoyoCfg||APOYO_CFG_DEFAULT;
  var u=apoyoAsegurarDia(window._apoyoUso||apoyoUsoVacio());
  var cupo=cfg.cupoDiario|0;
  var antes=u.lecturasDia|0;
  var baseAntes=apoyoBaseBUsuario(antes,cupo);
  var libres=Math.max(0,cupo-antes);
  var cob=Math.max(0,n-libres);
  u.lecturasDia=antes+n;
  u.lecturasMes=(u.lecturasMes|0)+n;
  u.cobrablesDia=(u.cobrablesDia|0)+cob;
  u.cobrablesMes=(u.cobrablesMes|0)+cob;
  var baseDesp=apoyoBaseBUsuario(u.lecturasDia,cupo);
  u.baseBDia=baseDesp;
  var deltaBaseB=Math.max(0,baseDesp-baseAntes);
  // Cobro A (personal): solo excedente sobre cupo propio.
  if(cob>0){
    var m=apoyoCalcMontos(cob,cfg);
    u.montoUsd=Math.round(((Number(u.montoUsd)||0)+m.usd)*10000)/10000;
    u.montoCop=Math.round((Number(u.montoCop)||0)+m.cop);
  }
  window._apoyoUso=u;
  apoyoSumarGlobalLocal(n,deltaBaseB);
  apoyoAplicarCobroBlaze(u,cfg);
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
  if(!(Number(u.cobrablesMes)>0||Number(u.cobrablesBlazeMes)>0||Number(u.montoCop)>0))return false;
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
  if(!(Number(u.cobrablesMes)>0||Number(u.cobrablesBlazeMes)>0||Number(u.montoCop)>0))return'';
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
  var cupoG=cfg.cupoGlobalDia|0;
  var lectDia=u.lecturasDia|0;
  var lectG=apoyoLecturasGlobalVista();
  var sobre=cupo>0&&lectDia>cupo;
  var sobreG=cupoG>0&&lectG>cupoG;
  var pct=cupo?Math.min(100,Math.round((lectDia/cupo)*100)):(lectDia>0?100:0);
  var pctG=cupoG?Math.min(100,Math.round((lectG/cupoG)*100)):(lectG>0?100:0);
  var fillP=el.querySelector('.sst-apoyo-fill-per')||el.querySelector('.sst-apoyo-bar-fill');
  var fillG=el.querySelector('.sst-apoyo-fill-glob');
  var pctPEl=el.querySelector('.sst-apoyo-pct-per');
  var pctGEl=el.querySelector('.sst-apoyo-pct-glob');
  var cobroEl=el.querySelector('.sst-apoyo-meter-cobro');
  var txtP=(sobre?pct+'+':String(pct))+'%';
  var txtG=(sobreG?pctG+'+':String(pctG))+'%';
  if(fillP){
    fillP.style.setProperty('--apoyo-fill',pct+'%');
    fillP.classList.toggle('over',sobre||pct>=100&&lectDia>0);
  }
  if(fillG){
    fillG.style.setProperty('--apoyo-fill',pctG+'%');
    fillG.classList.toggle('over',sobreG||pctG>=100&&lectG>0);
  }
  if(pctPEl)pctPEl.textContent=txtP;
  if(pctGEl)pctGEl.textContent=txtG;
  var monto=Number(u.montoCop)||0;
  var montoB=Number(u.montoBlazeCop)||0;
  var montoA=Math.max(0,monto-montoB);
  var hayCobro=monto>0||(u.cobrablesMes|0)>0||(u.cobrablesBlazeMes|0)>0;
  if(cobroEl){
    cobroEl.hidden=!hayCobro;
    cobroEl.classList.toggle('has-cobro',hayCobro);
    cobroEl.textContent=hayCobro?apoyoFmtCopCorto(monto):'';
  }
  var tip='Personal '+pct+'% ('+lectDia+'/'+cupo+') · Global '+pctG+'% ('+lectG+'/'+cupoG+')';
  if(hayCobro){
    tip+=' · Apoyo ciclo '+apoyoFmtCop(monto);
    if(montoA>0)tip+=' · personal '+apoyoFmtCop(montoA);
    if(montoB>0)tip+=' · Blaze '+apoyoFmtCop(montoB);
  }
  el.title=tip;
  el.classList.toggle('sst-apoyo-blocked',apoyoDriveRestringido());
}
function apoyoFmtCopCorto(n){
  n=Math.round(Number(n)||0);
  if(n>=1000000)return'$'+(n/1000000).toFixed(n%1000000===0?0:1).replace(/\.0$/,'')+'M';
  if(n>=10000)return'$'+Math.round(n/1000)+'mil';
  if(n>=1000)return'$'+(n/1000).toFixed(1).replace(/\.0$/,'')+'mil';
  try{return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);}
  catch(e){return '$'+n;}
}
function apoyoPintarUI(){
  apoyoPintarBanner();
  apoyoPintarMedidor();
  if(typeof sstRenderGmailDriveStatusBtn==='function')sstRenderGmailDriveStatusBtn();
}
async function apoyoInitSesion(){
  window._apoyoUsoListo=false;
  window._apoyoLecturasCola=0;
  window._apoyoGlobalPend=0;
  window._apoyoGlobalBasePend=0;
  await apoyoCargarCfg();
  await apoyoCargarUso();
  await apoyoCargarGlobalDia();
  apoyoEscucharGlobalDia();
  apoyoBindFlush();
  apoyoProgramarRenovacionDia();
  apoyoPintarUI();
}
function apoyoResetSesion(){
  if(window._apoyoSaveTimer){clearTimeout(window._apoyoSaveTimer);window._apoyoSaveTimer=null;}
  if(window._apoyoGlobalSaveTimer){clearTimeout(window._apoyoGlobalSaveTimer);window._apoyoGlobalSaveTimer=null;}
  if(window._apoyoRenovTimer){try{clearTimeout(window._apoyoRenovTimer);}catch(e){}window._apoyoRenovTimer=null;}
  if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
  if(window._apoyoUsoDirty){
    try{apoyoGuardarUso();}catch(e){}
  }
  if((window._apoyoGlobalPend|0)>0||(window._apoyoGlobalBasePend|0)>0){
    try{apoyoFlushGlobalPendiente();}catch(e){}
  }
  window._apoyoUsoListo=false;
  window._apoyoLecturasCola=0;
  window._apoyoUso=null;
  window._apoyoUsoDirty=false;
  window._apoyoGlobal={diaIso:'',lecturas:0,baseB:0};
}
window.apoyoResetSesion=apoyoResetSesion;
async function apoyoGuardarCfgDesdeForm(){
  if(!apoyoEsAdmin()){if(typeof notif==='function')notif('Solo el administrador puede configurar el apoyo solidario','err');return;}
  var cupo=parseInt((document.getElementById('apoyo-cfg-cupo')||{}).value,10);
  var cupoG=parseInt((document.getElementById('apoyo-cfg-cupo-global')||{}).value,10);
  var precio=Number((document.getElementById('apoyo-cfg-precio')||{}).value);
  var trm=Number((document.getElementById('apoyo-cfg-trm')||{}).value);
  var activo=!!(document.getElementById('apoyo-cfg-activo')&&document.getElementById('apoyo-cfg-activo').checked);
  if(isNaN(cupo)||cupo<0){notif('Cupo diario personal inválido','err');return;}
  if(isNaN(cupoG)||cupoG<0){notif('Cupo global diario inválido','err');return;}
  if(isNaN(precio)||precio<0){notif('Precio inválido','err');return;}
  if(isNaN(trm)||trm<=0){notif('TRM inválida','err');return;}
  var cfg=apoyoNormCfg({
    cupoDiario:cupo,
    cupoGlobalDia:cupoG,
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
    apoyoAplicarCfgRemota(cfg);
    notif('Apoyo solidario actualizado','ok');
    if(typeof renderApoyoSolidarioCfg==='function')renderApoyoSolidarioCfg();
    else if(typeof renderListasCfg==='function')renderListasCfg();
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
    patch.baseBDia=0;
    patch.cobrablesBlazeDia=0;
    patch.cobrablesBlazeMes=0;
    patch.montoBlazeUsd=0;
    patch.montoBlazeCop=0;
    patch.montoUsd=0;
    patch.montoCop=0;
  }
  await window._fsSetDoc(ref,patch,{merge:true});
  if(typeof notif==='function')notif('Apoyo registrado'+(reiniciar?' y consumo reiniciado':''),'ok');
  if(typeof renderApoyoSolidarioCfg==='function')renderApoyoSolidarioCfg();
  else if(typeof renderListasCfg==='function')renderListasCfg();
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
    baseBDia:0,
    cobrablesBlazeDia:0,
    cobrablesBlazeMes:0,
    montoBlazeUsd:0,
    montoBlazeCop:0,
    montoUsd:0,
    montoCop:0,
    apoyado:false,
    apoyadoEn:'',
    apoyadoPor:'',
    historial:[{tipo:'reinicio',en:new Date().toISOString(),por:por,periodo:per}],
    updatedAt:new Date().toISOString()
  },{merge:true});
  if(typeof notif==='function')notif('Consumo reiniciado','ok');
  if(typeof renderApoyoSolidarioCfg==='function')renderApoyoSolidarioCfg();
  else if(typeof renderListasCfg==='function')renderListasCfg();
}
function apoyoCfgCardBody(){
  var cfg=apoyoNormCfg(window._apoyoCfg);
  var inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  var cupoG=cfg.cupoGlobalDia|0;
  return '<div class="cfcard" id="apoyo-cfg-card">'+
    '<p style="font-size:12px;color:var(--tx2);margin:0 0 12px;line-height:1.45">Dos cupos (renuevan a las <strong>2:00 a. m.</strong>): <strong>personal</strong> por usuario y <strong>global</strong> del proyecto (colchón bajo Blaze). Cobro A = superar el personal. Cobro B = si el global se pasa, se reparte según el consumo del día <em>dentro</em> del cupo personal (sin doble cobro de lo ya cobrado como A). Ambos montos suman al ciclo. Tras el plazo solidario sin registrar apoyo, no podrá conectar Drive.</p>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Estado</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:4px"><input type="checkbox" id="apoyo-cfg-activo"'+(cfg.activo?' checked':'')+'> Activar apoyo solidario</label></div>'+
    '<div class="fld"><label for="apoyo-cfg-cupo">Lecturas gratis personales / día</label><input type="number" min="0" step="1" id="apoyo-cfg-cupo" value="'+escAttr(String(cfg.cupoDiario))+'" style="'+inp+'"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld" style="grid-column:1/-1">'+
    '<label for="apoyo-cfg-cupo-global">Lecturas gratis globales / día (Blaze del proyecto)</label>'+
    '<input type="number" min="0" step="1000" id="apoyo-cfg-cupo-global" value="'+escAttr(String(cupoG))+'" style="'+inp+'" title="Ej. 40000 aunque Blaze ofrezca 50000">'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.35">Colchón del proyecto (por defecto '+escAttr(String(APOYO_CFG_DEFAULT.cupoGlobalDia))+'). Al bajarlo o subirlo, lo <strong>ya cobrado</strong> en el ciclo se mantiene; desde Guardar (o al volver a entrar) el cobro B usa el cupo nuevo según el aporte personal del día.</div>'+
    '</div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label for="apoyo-cfg-precio">USD por cada 1.000 lecturas cobrables</label><input type="number" min="0" step="0.01" id="apoyo-cfg-precio" value="'+escAttr(String(cfg.precioPorMilUsd))+'" style="'+inp+'"></div>'+
    '<div class="fld"><label for="apoyo-cfg-trm">TRM (COP por USD)</label><input type="number" min="1" step="0.01" id="apoyo-cfg-trm" value="'+escAttr(String(cfg.trmCop))+'" style="'+inp+'"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:8px">'+
    '<div class="fld" style="display:flex;align-items:flex-end"><button type="button" class="btn bsm" onclick="apoyoConsultarTrm()">Consultar tasa</button></div>'+
    '</div>'+
    '<div id="apoyo-cfg-trm-hint" style="font-size:11px;color:var(--tx3);margin-bottom:12px">Corte fijo: día 28. Plazo solidario: 3 días hábiles. Solo el excedente NUEVO se valora con precio/TRM/cupo actuales (lo ya cobrado no se recalcula). El cupo global debe ser ≤ al gratis real de Blaze para dejar margen.</div>'+
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
  var h='<div class="slbl" style="margin:12px 0 8px">Histórico por usuario</div><div class="tw"><table><thead><tr><th>Usuario</th><th>Periodo</th><th>Lecturas</th><th>A pers.</th><th>B Blaze</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>';
  list.forEach(function(u){
    var email=String(u.email||u.id||'').trim().toLowerCase();
    var emailJs=JSON.stringify(email);
    h+='<tr><td style="font-size:12px">'+escAttr(email)+'</td><td>'+escAttr(u.periodo||'')+'</td>'+
      '<td>'+(u.lecturasMes|0)+'</td><td>'+(u.cobrablesMes|0)+'</td><td>'+(u.cobrablesBlazeMes|0)+'</td>'+
      '<td title="Personal '+escAttr(apoyoFmtCop(Math.max(0,(Number(u.montoCop)||0)-(Number(u.montoBlazeCop)||0))))+' · Blaze '+escAttr(apoyoFmtCop(u.montoBlazeCop))+'" >'+escAttr(apoyoFmtCop(u.montoCop))+'</td>'+
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
window.apoyoAplicarCobroBlaze=apoyoAplicarCobroBlaze;
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
