// =============================================================================
// apoyo-solidario.js — Medidor de lecturas y apoyo solidario para mantener el sistema
// =============================================================================
(function(){
'use strict';

var APOYO_CFG_DEFAULT={
  /** Cupo personal bajo: el cobro A debe activarse antes de que Google facture de más. */
  cupoDiario:800,
  /**
   * Colchón bajo el gratis de lecturas Blaze (~50k/día).
   * 40k era demasiado holgado: el proyecto podía costar cientos en consola sin cobro B interno.
   * El medidor solo cuenta lecturas de expedientes; Blaze también cobra almacenamiento y ancho de banda.
   */
  cupoGlobalDia:20000,
  /** USD / 1.000 lecturas cobrables — debe dejar margen sobre el costo real de Google. */
  precioPorMilUsd:0.35,
  trmCop:4200,
  diaCorte:28,
  diasGraciaHabiles:3,
  /** USD del ciclo por almacenamiento + red, copiado a mano desde la consola Google. 0 = no cargado. */
  costoDiscoRedUsd:0,
  activo:true
};

window._apoyoCfg=Object.assign({},APOYO_CFG_DEFAULT);
window._apoyoUso=null;
window._apoyoUsoDirty=false;
window._apoyoSaveTimer=null;
window._apoyoTrmConsultada=null;
/** false hasta cargar apoyo_uso/{email}: las lecturas de login no parten de 0 ni pisan el día en otro PC. */
window._apoyoUsoListo=false;
/** true solo si getDoc de apoyo_uso respondió (evita guardar U bajo y borrar el pico en Firestore). */
window._apoyoUsoCargadoFs=false;
window._apoyoLecturasCola=0;
window._apoyoFlushBound=false;
/** Permiso denegado: no reintentar (cada intento evaluaba exists+get del usuario). */
window._apoyoFsDenegado=false;
window._apoyoUsoRetryN=0;
window._apoyoGlobal={diaIso:'',lecturas:0,baseB:0};
window._apoyoGlobalUnsub=null;
window._apoyoGlobalPend=0;
window._apoyoGlobalBasePend=0;
window._apoyoGlobalSaveTimer=null;

/** Día de cupo gratis: se renueva a las 02:00 (misma franja en que Blaze renueva lo gratuito). Antes de las 2:00 sigue contando el día anterior. */
var APOYO_HORA_RENOVACION=2;
var APOYO_LS_PREFIX='sst_apoyo_uso_v1:';
var APOYO_LS_GLOBAL_PREFIX='sst_apoyo_consumo_v1:';
var APOYO_LS_INC_PREFIX='sst_apoyo_inc_v1:';
function apoyoIncLsKey(){
  var email=apoyoEmailKey();
  return email?(APOYO_LS_INC_PREFIX+email+':'+apoyoHoyLocal()):'';
}
/** Guarda en local la cola de incrementos aún no confirmados en Firestore (sobrevive F5). */
function apoyoPersistirColaInc(){
  try{
    var key=apoyoIncLsKey();
    if(!key)return;
    var payload={
      dia:apoyoHoyLocal(),
      lect:window._apoyoIncLect|0,
      cob:window._apoyoIncCob|0,
      blazeCob:window._apoyoIncBlazeCob|0,
      cop:window._apoyoIncCop|0,
      usd:Number(window._apoyoIncUsd)||0,
      baseB:window._apoyoIncBaseB|0,
      global:window._apoyoIncGlobal|0
    };
    if(!(payload.lect||payload.cob||payload.blazeCob||payload.cop||payload.global||payload.baseB)){
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key,JSON.stringify(payload));
  }catch(e){}
}
function apoyoRecuperarColaInc(){
  try{
    var key=apoyoIncLsKey();
    if(!key)return;
    var raw=localStorage.getItem(key);
    if(!raw)return;
    var d=JSON.parse(raw);
    if(!d||typeof d!=='object'||apoyoNormDiaIso(d.dia)!==apoyoHoyLocal()){
      localStorage.removeItem(key);
      return;
    }
    window._apoyoIncLect=(window._apoyoIncLect|0)+(d.lect|0);
    window._apoyoIncCob=(window._apoyoIncCob|0)+(d.cob|0);
    window._apoyoIncBlazeCob=(window._apoyoIncBlazeCob|0)+(d.blazeCob|0);
    window._apoyoIncCop=(window._apoyoIncCop|0)+(d.cop|0);
    window._apoyoIncUsd=(Number(window._apoyoIncUsd)||0)+(Number(d.usd)||0);
    window._apoyoIncBaseB=(window._apoyoIncBaseB|0)+(d.baseB|0);
    window._apoyoIncGlobal=(window._apoyoIncGlobal|0)+(d.global|0);
  }catch(e){}
}
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
function apoyoErrorTxt(e){
  return String((e&&(e.code||e.message))||e||'');
}
function apoyoEsPermisoDenegado(e){
  var c=apoyoErrorTxt(e).toLowerCase();
  return c.indexOf('permission-denied')>=0||c.indexOf('insufficient')>=0;
}
/** Corta lecturas/escrituras del medidor en esta pestaña. Un F5 vuelve a intentar una sola vez. */
function apoyoMarcarDenegado(origen){
  if(window._apoyoFsDenegado)return;
  window._apoyoFsDenegado=true;
  window._apoyoIncLect=0;
  window._apoyoIncCob=0;
  window._apoyoIncBlazeCob=0;
  window._apoyoIncCop=0;
  window._apoyoIncUsd=0;
  window._apoyoIncBaseB=0;
  window._apoyoIncGlobal=0;
  window._apoyoGlobalPend=0;
  window._apoyoGlobalBasePend=0;
  window._apoyoUsoDirty=false;
  if(window._apoyoUsoRetryTimer){clearTimeout(window._apoyoUsoRetryTimer);window._apoyoUsoRetryTimer=null;}
  if(window._apoyoIncTimer){clearTimeout(window._apoyoIncTimer);window._apoyoIncTimer=null;}
  if(window._apoyoGlobalSaveTimer){clearTimeout(window._apoyoGlobalSaveTimer);window._apoyoGlobalSaveTimer=null;}
  if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
  try{apoyoPersistirColaInc();}catch(e2){}
  try{
    var hoy=apoyoHoyLocal();
    localStorage.removeItem(APOYO_LS_GLOBAL_PREFIX+hoy);
  }catch(e3){}
  console.warn('apoyo: Firestore negó el permiso; el medidor no reintenta en esta pestaña.',origen||'');
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
  c.costoDiscoRedUsd=Math.max(0,Number(c.costoDiscoRedUsd)||0);
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
  // Solo el excedente NUEVO se valora (A o B). Lo ya cobrado en el ciclo no se toca.
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
/** Lecturas del día desde mapa durable lecturasPorDia[YYYY-MM-DD] (o legado lecturasDia+diaIso). */
function apoyoLecturasDiaDesdeData(data,hoy){
  hoy=hoy||apoyoHoyLocal();
  if(!data||typeof data!=='object')return 0;
  var map=data.lecturasPorDia;
  if(map&&typeof map==='object'&&map[hoy]!=null)return Math.max(0,parseInt(map[hoy],10)||0);
  if(apoyoNormDiaIso(data.diaIso)===hoy)return Math.max(0,data.lecturasDia|0);
  return 0;
}
function apoyoMergeUsoRemoto(data){
  if(!data||typeof data!=='object')return;
  var per=apoyoPeriodoId();
  var hoy=apoyoHoyLocal();
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
  // Fuente de la barra U: contador del día en Firestore (no se reinicia al F5)
  window._apoyoUso.lecturasDia=apoyoLecturasDiaDesdeData(data,hoy);
  window._apoyoUso.diaIso=hoy;
  if(!window._apoyoUso.lecturasPorDia||typeof window._apoyoUso.lecturasPorDia!=='object')
    window._apoyoUso.lecturasPorDia=Object.assign({},data.lecturasPorDia||{});
  window._apoyoUso.lecturasPorDia[hoy]=window._apoyoUso.lecturasDia|0;
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
    window._apoyoUsoCargadoFs=true;
    return;
  }
  apoyoLimpiarEspejoUsoLocal();
  var email=apoyoEmailKey();
  window._apoyoUsoCargadoFs=false;
  if(!email||!window._db||!window._fsGetDoc||!window._fsDoc){
    window._apoyoUso=window._apoyoUso||apoyoUsoVacio(apoyoPeriodoId());
    apoyoAsegurarDia(window._apoyoUso);
    window._apoyoUsoListo=true;
    return;
  }
  if(typeof window.ensureFirestoreAuthReady==='function'){
    try{
      var authOk=await window.ensureFirestoreAuthReady();
      if(authOk&&authOk.ok===false)throw new Error('auth apoyo_uso');
    }catch(eAuth){console.warn('apoyoCargarUso auth',eAuth);}
  }
  var prevSesion=window._apoyoUso;
  try{
    var snap=await window._fsGetDoc(window._fsDoc(window._db,'apoyo_uso',email));
    var remote=snap&&snap.exists&&snap.exists()?snap.data():null;
    // Solo Firestore: otro PC ve el mismo U; al entrar suma lo que descargue esta sesión
    if(remote)apoyoMergeUsoRemoto(remote);
    else window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
    // Reintento tras fallo: conservar lecturas ya contadas en esta sesión
    if(prevSesion&&(prevSesion.lecturasDia|0)>0)
      window._apoyoUso=apoyoFusionarMaxUso(prevSesion,window._apoyoUso);
    window._apoyoUsoCargadoFs=true;
  }catch(e){
    console.warn('apoyoCargarUso',e);
    if(!window._apoyoUso)window._apoyoUso=apoyoUsoVacio(apoyoPeriodoId());
    window._apoyoUsoCargadoFs=false;
    if(apoyoEsPermisoDenegado(e)){
      apoyoMarcarDenegado('apoyo_uso');
    }else if((window._apoyoUsoRetryN|0)<2&&!window._apoyoUsoRetryTimer){
      // Solo fallos de red, y como máximo 2 veces (8s y 20s). Permiso denegado no entra aquí.
      window._apoyoUsoRetryN=(window._apoyoUsoRetryN|0)+1;
      var espera=window._apoyoUsoRetryN===1?8000:20000;
      window._apoyoUsoRetryTimer=setTimeout(function(){
        window._apoyoUsoRetryTimer=null;
        if(!window._apoyoFsDenegado)apoyoCargarUso();
      },espera);
    }
  }
  apoyoAsegurarDia(window._apoyoUso);
  window._apoyoUsoListo=true;
  if(window._apoyoUsoCargadoFs&&window._apoyoLecturasCola>0){
    var cola=window._apoyoLecturasCola;
    window._apoyoLecturasCola=0;
    apoyoRegistrarLecturas(cola);
  }
  if(window._apoyoUsoCargadoFs&&window._apoyoUsoDirty)apoyoProgramarGuardarUso();
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
/**
 * Persiste deltas con increment (como un contador de expediente): nunca reemplaza
 * lecturas remotas por un valor local bajo → al F5 / otro PC se recupera la suma.
 */
async function apoyoFlushIncrementosPendientes(){
  if(apoyoEsAdmin()||window._apoyoFsDenegado)return false;
  if(!window._apoyoUsoCargadoFs)return false;
  var email=apoyoEmailKey();
  if(!email||!window._db||!window._fsDoc||!window._fsSetDoc||typeof window._fsIncrement!=='function')return false;
  var n=window._apoyoIncLect|0;
  var cob=window._apoyoIncCob|0;
  var cobB=window._apoyoIncBlazeCob|0;
  var cop=window._apoyoIncCop|0;
  var usd=window._apoyoIncUsd||0;
  var dbInc=window._apoyoIncBaseB|0;
  var nG=window._apoyoIncGlobal|0;
  if(n<=0&&cob<=0&&cobB<=0&&nG<=0&&dbInc<=0&&cop<=0)return true;
  window._apoyoIncLect=0;
  window._apoyoIncCob=0;
  window._apoyoIncBlazeCob=0;
  window._apoyoIncCop=0;
  window._apoyoIncUsd=0;
  window._apoyoIncBaseB=0;
  window._apoyoIncGlobal=0;
  // Quitar cola LS ya tomada: si F5 ocurre tras un write OK, no se vuelve a sumar
  apoyoPersistirColaInc();
  var hoy=apoyoHoyLocal();
  var per=apoyoPeriodoId(hoy);
  var inc=window._fsIncrement;
  var patchU={
    email:email,
    periodo:per,
    diaIso:hoy,
    updatedAt:new Date().toISOString()
  };
  if(n>0){
    patchU['lecturasPorDia.'+hoy]=inc(n);
    patchU.lecturasDia=inc(n);
    patchU.lecturasMes=inc(n);
  }
  if(cob>0){
    patchU.cobrablesDia=inc(cob);
    patchU.cobrablesMes=inc(cob);
  }
  if(cobB>0){
    var mbFlush=apoyoCalcMontos(cobB);
    patchU.cobrablesBlazeDia=inc(cobB);
    patchU.cobrablesBlazeMes=inc(cobB);
    patchU.montoBlazeCop=inc(Math.round(mbFlush.cop||0));
    if(mbFlush.usd)patchU.montoBlazeUsd=inc(Math.round(mbFlush.usd*10000)/10000);
  }
  if(cop>0)patchU.montoCop=inc(cop);
  if(usd)patchU.montoUsd=inc(Math.round(usd*10000)/10000);
  try{
    await window._fsSetDoc(window._fsDoc(window._db,'apoyo_uso',email),patchU,{merge:true});
    window._apoyoUsoDirty=false;
  }catch(e){
    console.warn('apoyoFlushIncrementos uso',e);
    if(apoyoEsPermisoDenegado(e)){apoyoMarcarDenegado('apoyo_uso');return false;}
    window._apoyoIncLect=(window._apoyoIncLect|0)+n;
    window._apoyoIncCob=(window._apoyoIncCob|0)+cob;
    window._apoyoIncBlazeCob=(window._apoyoIncBlazeCob|0)+cobB;
    window._apoyoIncCop=(window._apoyoIncCop|0)+cop;
    window._apoyoIncUsd=(Number(window._apoyoIncUsd)||0)+usd;
    window._apoyoIncGlobal=(window._apoyoIncGlobal|0)+nG;
    window._apoyoIncBaseB=(window._apoyoIncBaseB|0)+dbInc;
    window._apoyoUsoDirty=true;
    apoyoPersistirColaInc();
    return false;
  }
  if(nG>0||dbInc>0){
    try{
      var patchG={diaIso:hoy,updatedAt:new Date().toISOString()};
      if(nG>0)patchG.lecturas=inc(nG);
      if(dbInc>0)patchG.baseB=inc(dbInc);
      await window._fsSetDoc(window._fsDoc(window._db,'apoyo_consumo',hoy),patchG,{merge:true});
    }catch(eG){
      console.warn('apoyoFlushIncrementos global',eG);
      if(apoyoEsPermisoDenegado(eG)){apoyoMarcarDenegado('apoyo_consumo');return false;}
      window._apoyoIncGlobal=(window._apoyoIncGlobal|0)+nG;
      window._apoyoIncBaseB=(window._apoyoIncBaseB|0)+dbInc;
      apoyoPersistirColaInc();
      return false;
    }
  }
  apoyoPersistirColaInc();
  return true;
}
function apoyoProgramarFlushIncrementos(){
  if(window._apoyoFsDenegado)return;
  apoyoPersistirColaInc();
  if(window._apoyoIncTimer)clearTimeout(window._apoyoIncTimer);
  window._apoyoIncTimer=setTimeout(function(){
    window._apoyoIncTimer=null;
    apoyoFlushIncrementosPendientes();
  },350);
}
async function apoyoGuardarUso(){
  // Los contadores van por increment; este guardado solo empuja pendientes
  return apoyoFlushIncrementosPendientes();
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
    var mapPrev=prev.lecturasPorDia&&typeof prev.lecturasPorDia==='object'?Object.assign({},prev.lecturasPorDia):{};
    u=apoyoUsoVacio(per);
    apoyoHeredarCobroCiclo(u,prev);
    u.lecturasPorDia=mapPrev;
    window._apoyoUso=u;
  }
  if(!u.lecturasPorDia||typeof u.lecturasPorDia!=='object')u.lecturasPorDia={};
  var dia=apoyoNormDiaIso(u.diaIso);
  if(dia)u.diaIso=dia;
  if(u.diaIso!==hoy){
    // Solo reinicia contadores del NUEVO día. El mapa lecturasPorDia conserva el histórico.
    // Nunca toca montoCop / cobrablesMes del ciclo.
    u.diaIso=hoy;
    u.cobrablesDia=0;
    u.baseBDia=0;
    u.cobrablesBlazeDia=0;
  }else if(u.lecturasPorDia[hoy]==null){
    // Documento anterior al mapa: no borrar lecturasDia que ya estaba en el mismo día
    u.lecturasPorDia[hoy]=Math.max(0,u.lecturasDia|0);
  }
  // Barra U = suma durable del día en el mapa (no se pierde al F5)
  u.lecturasDia=Math.max(0,parseInt(u.lecturasPorDia[hoy],10)||0);
  u.baseBDia=apoyoBaseBUsuario(u.lecturasDia,(window._apoyoCfg||APOYO_CFG_DEFAULT).cupoDiario|0);
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
    if(window._apoyoIncTimer){clearTimeout(window._apoyoIncTimer);window._apoyoIncTimer=null;}
    if(window._apoyoGlobalSaveTimer){clearTimeout(window._apoyoGlobalSaveTimer);window._apoyoGlobalSaveTimer=null;}
    try{apoyoFlushIncrementosPendientes();}catch(e){}
  };
  window.addEventListener('pagehide',flush);
  window.addEventListener('beforeunload',flush);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')flush();
  });
}
/** Aplica cobro B (excedente global) sin doblar lo ya cobrado como A personal. Encola increment atómico. */
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
    // Misma cola atómica que las lecturas: sobrevive F5 / otro PC
    window._apoyoIncBlazeCob=(window._apoyoIncBlazeCob|0)+delta;
    window._apoyoIncCop=(window._apoyoIncCop|0)+Math.round(m.cop);
    window._apoyoIncUsd=(Number(window._apoyoIncUsd)||0)+m.usd;
    apoyoProgramarFlushIncrementos();
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
    if(apoyoEsPermisoDenegado(e)){apoyoMarcarDenegado('apoyo_consumo');return;}
    window._apoyoGlobalPend=(window._apoyoGlobalPend|0)+n;
    window._apoyoGlobalBasePend=(window._apoyoGlobalBasePend|0)+dbInc;
    apoyoMirrorGlobalWrite();
  }
}
function apoyoSumarGlobalLocal(n,deltaBaseB){
  n=n|0;deltaBaseB=deltaBaseB|0;
  if(n<=0&&deltaBaseB<=0)return;
  // Contador global atómico (mismo doc para todos)
  window._apoyoIncGlobal=(window._apoyoIncGlobal|0)+n;
  window._apoyoIncBaseB=(window._apoyoIncBaseB|0)+deltaBaseB;
  // Pintar ya; el snapshot de Firestore confirma / corrige
  var hoy=apoyoHoyLocal();
  var g=window._apoyoGlobal||{diaIso:hoy,lecturas:0,baseB:0};
  if(apoyoNormDiaIso(g.diaIso)!==hoy)g={diaIso:hoy,lecturas:0,baseB:0};
  window._apoyoGlobal={diaIso:hoy,lecturas:(g.lecturas|0)+n,baseB:(g.baseB|0)+deltaBaseB};
  apoyoProgramarFlushIncrementos();
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
    }catch(e){
      console.warn('apoyoCargarGlobalDia',e);
      if(apoyoEsPermisoDenegado(e))apoyoMarcarDenegado('apoyo_consumo');
    }
  }
  apoyoAplicarEstadoGlobal(lect,base,{});
  if(!window._apoyoFsDenegado&&((window._apoyoGlobalPend|0)>0||(window._apoyoGlobalBasePend|0)>0))apoyoProgramarGlobalFlush();
  apoyoPintarUI();
}
/**
 * Invariante: G (proyecto) ≥ U (este usuario) el mismo día.
 * Si el personal se guardó y el flush global se perdió, G quedaba por debajo (p. ej. 820 < 2543).
 * Repara con max en Firestore (no suma: evita doble conteo al repetir).
 */
async function apoyoAsegurarGlobalNoMenorQuePersonal(){
  if(apoyoEsAdmin())return;
  var u=apoyoAsegurarDia(window._apoyoUso||apoyoUsoVacio());
  var lectU=u.lecturasDia|0;
  var baseU=u.baseBDia|0;
  if(lectU<=0&&baseU<=0)return;
  var g=window._apoyoGlobal||{};
  if(apoyoNormDiaIso(g.diaIso)===apoyoHoyLocal()&&(g.lecturas|0)>=lectU&&(g.baseB|0)>=baseU)return;
  if(!window._db||!window._fsDoc)return;
  var hoy=apoyoHoyLocal();
  var ref=window._fsDoc(window._db,'apoyo_consumo',hoy);
  try{
    if(typeof window._fsRunTransaction==='function'){
      await window._fsRunTransaction(window._db,async function(tx){
        var snap=await tx.get(ref);
        var cur=snap&&snap.exists()?snap.data():{};
        var lect=Math.max(cur.lecturas|0,lectU);
        var base=Math.max(cur.baseB|0,baseU);
        if(lect===(cur.lecturas|0)&&base===(cur.baseB|0)){
          window._apoyoGlobal={diaIso:hoy,lecturas:lect,baseB:base};
          return;
        }
        tx.set(ref,{diaIso:hoy,lecturas:lect,baseB:base,updatedAt:new Date().toISOString()},{merge:true});
        window._apoyoGlobal={diaIso:hoy,lecturas:lect,baseB:base};
      });
    }else if(window._fsSetDoc&&window._fsGetDoc){
      var snap2=await window._fsGetDoc(ref);
      var cur2=snap2&&snap2.exists&&snap2.exists()?snap2.data():{};
      var lect2=Math.max(cur2.lecturas|0,lectU);
      var base2=Math.max(cur2.baseB|0,baseU);
      if(lect2!==(cur2.lecturas|0)||base2!==(cur2.baseB|0))
        await window._fsSetDoc(ref,{diaIso:hoy,lecturas:lect2,baseB:base2,updatedAt:new Date().toISOString()},{merge:true});
      window._apoyoGlobal={diaIso:hoy,lecturas:lect2,baseB:base2};
    }
    apoyoMirrorGlobalWrite();
    apoyoPintarUI();
  }catch(e){
    console.warn('apoyoAsegurarGlobalNoMenorQuePersonal',e);
    if(apoyoEsPermisoDenegado(e))apoyoMarcarDenegado('apoyo_consumo');
  }
}
function apoyoEscucharGlobalDia(){
  if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
  if(window._apoyoFsDenegado||apoyoEsAdmin()||!window._db||!window._fsDoc||!window._fsOnSnapshot)return;
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
  },function(err){
    console.warn('apoyoEscucharGlobalDia',err);
    if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
    if(apoyoEsPermisoDenegado(err))apoyoMarcarDenegado('apoyo_consumo');
  });
}
/** Registra lecturas de documentos Firestore hechas por la sesión. */
function apoyoRegistrarLecturas(n){
  n=parseInt(n,10)||0;
  if(n<=0)return;
  if(apoyoEsAdmin()||window._apoyoFsDenegado)return;
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
  var hoy=apoyoHoyLocal();
  if(!u.lecturasPorDia||typeof u.lecturasPorDia!=='object')u.lecturasPorDia={};
  var cupo=cfg.cupoDiario|0;
  var antes=u.lecturasDia|0;
  var baseAntes=apoyoBaseBUsuario(antes,cupo);
  var libres=Math.max(0,cupo-antes);
  var cob=Math.max(0,n-libres);
  u.lecturasDia=antes+n;
  u.lecturasPorDia[hoy]=u.lecturasDia;
  u.lecturasMes=(u.lecturasMes|0)+n;
  u.cobrablesDia=(u.cobrablesDia|0)+cob;
  u.cobrablesMes=(u.cobrablesMes|0)+cob;
  var baseDesp=apoyoBaseBUsuario(u.lecturasDia,cupo);
  u.baseBDia=baseDesp;
  var deltaBaseB=Math.max(0,baseDesp-baseAntes);
  var copAdd=0,usdAdd=0;
  // Cobro A (personal): solo excedente sobre cupo propio.
  if(cob>0){
    var m=apoyoCalcMontos(cob,cfg);
    usdAdd=m.usd;
    copAdd=m.cop;
    u.montoUsd=Math.round(((Number(u.montoUsd)||0)+usdAdd)*10000)/10000;
    u.montoCop=Math.round((Number(u.montoCop)||0)+copAdd);
  }
  window._apoyoUso=u;
  // Cola de incrementos atómicos → Firestore (sobrevive F5 / otro PC)
  window._apoyoIncLect=(window._apoyoIncLect|0)+n;
  window._apoyoIncCob=(window._apoyoIncCob|0)+cob;
  window._apoyoIncCop=(window._apoyoIncCop|0)+copAdd;
  window._apoyoIncUsd=(Number(window._apoyoIncUsd)||0)+usdAdd;
  apoyoSumarGlobalLocal(n,deltaBaseB);
  // Cobro B: apoyoAplicarCobroBlaze ya encola _apoyoIncBlazeCob / montos
  apoyoAplicarCobroBlaze(u,cfg);
  apoyoProgramarFlushIncrementos();
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
  var pctGRaw=cupoG?(lectG/cupoG)*100:0;
  var pctG=cupoG?Math.min(100,Math.round(pctGRaw)):(lectG>0?100:0);
  // Evitar “0%” engañoso cuando hay lecturas pero el redondeo cae bajo 0.5
  if(cupoG&&lectG>0&&pctG===0)pctG=1;
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
  tip+=' · datos en Firestore (no se borran al refrescar)';
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
  window._apoyoUsoCargadoFs=false;
  window._apoyoFsDenegado=false;
  window._apoyoUsoRetryN=0;
  window._apoyoLecturasCola=0;
  window._apoyoGlobalPend=0;
  window._apoyoGlobalBasePend=0;
  window._apoyoIncLect=0;
  window._apoyoIncCob=0;
  window._apoyoIncBlazeCob=0;
  window._apoyoIncCop=0;
  window._apoyoIncUsd=0;
  window._apoyoIncBaseB=0;
  window._apoyoIncGlobal=0;
  apoyoRecuperarColaInc();
  await apoyoCargarCfg();
  await apoyoCargarUso();
  if(window._apoyoFsDenegado){
    apoyoBindFlush();
    apoyoPintarUI();
    return;
  }
  await apoyoCargarGlobalDia();
  if(window._apoyoUsoCargadoFs){
    await apoyoAsegurarGlobalNoMenorQuePersonal();
    // Cola rescatada de un F5: pintar ya en memoria y empujar a Firestore
    var incN=window._apoyoIncLect|0;
    var incCob=window._apoyoIncCob|0;
    var incB=window._apoyoIncBlazeCob|0;
    var incCop=window._apoyoIncCop|0;
    var incUsd=Number(window._apoyoIncUsd)||0;
    var incG=window._apoyoIncGlobal|0;
    var incBB=window._apoyoIncBaseB|0;
    if(incN||incCob||incB||incCop||incG||incBB){
      var u0=apoyoAsegurarDia(window._apoyoUso||apoyoUsoVacio());
      var hoy0=apoyoHoyLocal();
      if(!u0.lecturasPorDia||typeof u0.lecturasPorDia!=='object')u0.lecturasPorDia={};
      if(incN){
        u0.lecturasDia=(u0.lecturasDia|0)+incN;
        u0.lecturasPorDia[hoy0]=u0.lecturasDia;
        u0.lecturasMes=(u0.lecturasMes|0)+incN;
        u0.baseBDia=apoyoBaseBUsuario(u0.lecturasDia,(window._apoyoCfg||APOYO_CFG_DEFAULT).cupoDiario|0);
      }
      if(incCob){
        u0.cobrablesDia=(u0.cobrablesDia|0)+incCob;
        u0.cobrablesMes=(u0.cobrablesMes|0)+incCob;
      }
      if(incB){
        u0.cobrablesBlazeDia=(u0.cobrablesBlazeDia|0)+incB;
        u0.cobrablesBlazeMes=(u0.cobrablesBlazeMes|0)+incB;
      }
      if(incCop)u0.montoCop=Math.round((Number(u0.montoCop)||0)+incCop);
      if(incUsd)u0.montoUsd=Math.round(((Number(u0.montoUsd)||0)+incUsd)*10000)/10000;
      window._apoyoUso=u0;
      if(incG||incBB){
        var g0=window._apoyoGlobal||{diaIso:hoy0,lecturas:0,baseB:0};
        if(apoyoNormDiaIso(g0.diaIso)!==hoy0)g0={diaIso:hoy0,lecturas:0,baseB:0};
        window._apoyoGlobal={diaIso:hoy0,lecturas:(g0.lecturas|0)+incG,baseB:(g0.baseB|0)+incBB};
      }
      apoyoProgramarFlushIncrementos();
    }
  }
  apoyoEscucharGlobalDia();
  apoyoBindFlush();
  apoyoProgramarRenovacionDia();
  apoyoPintarUI();
}
function apoyoResetSesion(){
  if(window._apoyoSaveTimer){clearTimeout(window._apoyoSaveTimer);window._apoyoSaveTimer=null;}
  if(window._apoyoIncTimer){clearTimeout(window._apoyoIncTimer);window._apoyoIncTimer=null;}
  if(window._apoyoGlobalSaveTimer){clearTimeout(window._apoyoGlobalSaveTimer);window._apoyoGlobalSaveTimer=null;}
  if(window._apoyoRenovTimer){try{clearTimeout(window._apoyoRenovTimer);}catch(e){}window._apoyoRenovTimer=null;}
  if(window._apoyoGlobalUnsub){try{window._apoyoGlobalUnsub();}catch(e){}window._apoyoGlobalUnsub=null;}
  try{apoyoFlushIncrementosPendientes();}catch(e){}
  window._apoyoUsoListo=false;
  window._apoyoUsoCargadoFs=false;
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
  var disco=Number((document.getElementById('apoyo-cfg-disco')||{}).value);
  var activo=!!(document.getElementById('apoyo-cfg-activo')&&document.getElementById('apoyo-cfg-activo').checked);
  if(isNaN(cupo)||cupo<0){notif('Cupo diario personal inválido','err');return;}
  if(isNaN(cupoG)||cupoG<0){notif('Cupo global diario inválido','err');return;}
  if(isNaN(precio)||precio<0){notif('Precio inválido','err');return;}
  if(isNaN(trm)||trm<=0){notif('TRM inválida','err');return;}
  if(isNaN(disco)||disco<0){notif('Costo de disco y red inválido','err');return;}
  var cfg=apoyoNormCfg({
    cupoDiario:cupo,
    cupoGlobalDia:cupoG,
    precioPorMilUsd:precio,
    trmCop:trm,
    costoDiscoRedUsd:disco,
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
  if(!apoyoEsAdmin()||!window._db||!window._fsGetDocs||!window._fsCollection){
    return{ok:false,list:[],err:'Sin permisos o Firestore no listo'};
  }
  if(typeof window.ensureFirestoreAuthReady==='function'){
    try{
      var authOk=await window.ensureFirestoreAuthReady();
      if(authOk&&authOk.ok===false)return{ok:false,list:[],err:'Sesión Firebase no lista'};
    }catch(eA){return{ok:false,list:[],err:String(eA&&eA.message||eA).slice(0,120)};}
  }
  try{
    var snap=await window._fsGetDocs(window._fsCollection(window._db,'apoyo_uso'));
    var list=[];
    snap.forEach(function(d){list.push(Object.assign({id:d.id},d.data()||{}));});
    // Primero quien tiene cobro del ciclo; luego por actualización
    list.sort(function(a,b){
      var ma=Number(a.montoCop)||0,mb=Number(b.montoCop)||0;
      if(mb!==ma)return mb-ma;
      var ca=(a.cobrablesMes|0)+(a.cobrablesBlazeMes|0),cb=(b.cobrablesMes|0)+(b.cobrablesBlazeMes|0);
      if(cb!==ca)return cb-ca;
      return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
    });
    return{ok:true,list:list,err:''};
  }catch(e){
    console.warn('apoyoListarUsosAdmin',e);
    return{ok:false,list:[],err:String(e&&e.code||e&&e.message||e).slice(0,160)};
  }
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
    patch.lecturasPorDia={};
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
    lecturasPorDia:{},
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
    '<p style="font-size:12px;color:var(--tx2);margin:0 0 12px;line-height:1.45">Dos cupos (renuevan a las <strong>2:00 a. m.</strong>): <strong>personal</strong> y <strong>global</strong>. Cobro A = superar el personal. Cobro B = superar el global (reparto por aporte del día dentro del cupo personal). El medidor <strong>solo cuenta lecturas de expedientes</strong>; la factura Google Blaze también cobra <strong>almacenamiento y ancho de banda</strong> — por eso puede haber cobro en consola sin cobro A/B aquí si los cupos están muy altos o el USD/1.000 muy bajo. Objetivo: el apoyo solidario del ciclo debe cubrir (con margen) lo que Google factura.</p>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Estado</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:4px"><input type="checkbox" id="apoyo-cfg-activo"'+(cfg.activo?' checked':'')+'> Activar apoyo solidario</label></div>'+
    '<div class="fld"><label for="apoyo-cfg-cupo">Lecturas gratis personales / día</label><input type="number" min="0" step="1" id="apoyo-cfg-cupo" value="'+escAttr(String(cfg.cupoDiario))+'" style="'+inp+'"></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin:-4px 0 10px;line-height:1.35">Recomendado ≤ <strong>800–1200</strong> (con 3000 casi nadie genera cobro A). Valor por defecto del sistema: '+escAttr(String(APOYO_CFG_DEFAULT.cupoDiario))+'. Debe <strong>Guardar</strong> para aplicar.</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld" style="grid-column:1/-1">'+
    '<label for="apoyo-cfg-cupo-global">Lecturas gratis globales / día (colchón bajo Blaze ~50k)</label>'+
    '<input type="number" min="0" step="1000" id="apoyo-cfg-cupo-global" value="'+escAttr(String(cupoG))+'" style="'+inp+'" title="Recomendado 15000–25000">'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.35">Recomendado <strong>15 000–25 000</strong> (por defecto '+escAttr(String(APOYO_CFG_DEFAULT.cupoGlobalDia))+'). Con 40 000 el cobro B casi no dispara aunque Google ya facture por otras partidas. Lo ya cobrado en el ciclo no se recalcula al cambiar cupo.</div>'+
    '</div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label for="apoyo-cfg-precio">USD por cada 1.000 lecturas cobrables</label><input type="number" min="0" step="0.01" id="apoyo-cfg-precio" value="'+escAttr(String(cfg.precioPorMilUsd))+'" style="'+inp+'"></div>'+
    '<div class="fld"><label for="apoyo-cfg-trm">TRM (COP por USD)</label><input type="number" min="1" step="0.01" id="apoyo-cfg-trm" value="'+escAttr(String(cfg.trmCop))+'" style="'+inp+'"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:8px">'+
    '<div class="fld" style="display:flex;align-items:flex-end"><button type="button" class="btn bsm" onclick="apoyoConsultarTrm()">Consultar tasa</button></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld" style="grid-column:1/-1">'+
    '<label for="apoyo-cfg-disco">USD del ciclo: almacenamiento + ancho de banda (consola Google)</label>'+
    '<input type="number" min="0" step="0.01" id="apoyo-cfg-disco" value="'+escAttr(String(cfg.costoDiscoRedUsd||0))+'" style="'+inp+'">'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.35">El navegador no puede leer la factura de disco ni de red de Google (haría falta otra API y más costo). Copie aquí el USD de esas dos partidas, una vez por ciclo, y pulse Guardar. No consulta Firestore de nuevo: viaja en la configuración que ya se lee al entrar. En la tabla de abajo se reparte entre quienes tienen lecturas del ciclo. No se suma a la barra de cada persona (eso cobraría el total a todos).</div>'+
    '</div></div>'+
    '<div id="apoyo-cfg-trm-hint" style="font-size:11px;color:var(--tx3);margin-bottom:12px">Corte día 28 · gracia 3 días hábiles. <strong>0,01 USD/1.000</strong> es demasiado bajo frente a una factura Blaze de cientos: suba el precio y/o baje cupos y pulse Guardar. Consola Google ≠ esta tabla (allá entran disco y red).</div>'+
    '<button type="button" class="btn bsm bp" onclick="apoyoGuardarCfgDesdeForm()">Guardar apoyo solidario</button>'+
    '<div id="apoyo-admin-lista" style="margin-top:16px"></div>'+
  '</div>';
}
async function apoyoPintarListaAdmin(){
  var box=document.getElementById('apoyo-admin-lista');
  if(!box||!apoyoEsAdmin())return;
  box.innerHTML='<div style="font-size:12px;color:var(--tx3)">Cargando consumos…</div>';
  var res=await apoyoListarUsosAdmin();
  var list=(res&&res.list)||[];
  if(res&&res.ok===false){
    box.innerHTML='<div style="font-size:12px;color:var(--or);margin-top:8px">No se pudo leer <code>apoyo_uso</code>'+(res.err?': '+escAttr(res.err):'')+'. Revise sesión admin y reglas.</div>';
    return;
  }
  if(!list.length){
    box.innerHTML='<div style="font-size:12px;color:var(--tx3);margin-top:8px">Sin documentos en <code>apoyo_uso</code>. El medidor solo crea el del usuario al usar el sistema (no admin). La factura Google Blaze no aparece aquí.</div>';
    return;
  }
  var conCobro=list.filter(function(u){return(Number(u.montoCop)||0)>0||(u.cobrablesMes|0)>0||(u.cobrablesBlazeMes|0)>0;});
  var cfg=apoyoNormCfg(window._apoyoCfg);
  var extraCop=Math.round((Number(cfg.costoDiscoRedUsd)||0)*(Number(cfg.trmCop)||0));
  var sumLect=0,sumMonto=0,sumA=0,sumB=0,sumPend=0;
  list.forEach(function(u){
    sumLect+=(u.lecturasMes|0);
    var m=Math.round(Number(u.montoCop)||0);
    var b=Math.round(Number(u.montoBlazeCop)||0);
    var a=Math.max(0,m-b);
    sumMonto+=m;
    sumA+=a;
    sumB+=b;
    if(!u.apoyado)sumPend+=m;
  });
  var totalConDisco=sumMonto+extraCop;
  var h='<div style="margin:14px 0 10px;padding:12px 14px;border:1px solid var(--bd);border-radius:var(--r);background:#f4faf6">'+
    '<div style="font-size:12px;color:var(--tx3);letter-spacing:.02em">Total acumulado del ciclo · todos los usuarios</div>'+
    '<div style="font-size:22px;font-weight:700;line-height:1.2;margin-top:2px">'+escAttr(apoyoFmtCop(sumMonto))+'</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-top:4px;line-height:1.4">Personal '+escAttr(apoyoFmtCop(sumA))+' · Blaze (lecturas) '+escAttr(apoyoFmtCop(sumB))+' · pendiente de marcar apoyo '+escAttr(apoyoFmtCop(sumPend))+'</div>'+
    (extraCop>0?'<div style="font-size:12px;color:var(--tx2);margin-top:2px">Con disco y red pegados de la consola: <strong>'+escAttr(apoyoFmtCop(totalConDisco))+'</strong></div>':'')+
    '<div style="font-size:11px;color:var(--tx3);margin-top:6px;line-height:1.35">Esta cifra es la suma de la columna Monto ciclo, ahora mismo. Compárela cada día con la factura Blaze. No es el cobro de Google: allá también entran almacenamiento y ancho de banda.</div>'+
    '</div>'+
    '<div class="slbl" style="margin:12px 0 8px">Consumo del ciclo por usuario ('+list.length+' · con cobro: '+conCobro.length+')</div>'+
    (extraCop>0?'<div style="font-size:12px;margin:0 0 8px">Disco y red del ciclo: <strong>'+escAttr(apoyoFmtCop(extraCop))+'</strong>'+(sumLect>0?' · se reparte según lecturas del ciclo ('+sumLect+').':' · sin lecturas de ciclo todavía, no hay a quién repartir.')+'</div>':'')+
    '<div style="font-size:11px;color:var(--tx3);margin:0 0 8px;line-height:1.35">Monto = acumulado del ciclo (no se borra a las 2:00; solo lecturas del día). Cada persona va en su propia ficha para que el correo, el monto y los botones no se peguen.</div>';
  list.forEach(function(u){
    var email=String(u.email||u.id||'').trim().toLowerCase();
    var emailJs=JSON.stringify(email);
    var monto=Number(u.montoCop)||0;
    var blaze=Number(u.montoBlazeCop)||0;
    var personal=Math.max(0,monto-blaze);
    var resalta=monto>0||(u.cobrablesMes|0)>0||(u.cobrablesBlazeMes|0)>0;
    var parte=extraCop>0&&sumLect>0?apoyoFmtCop(Math.round(extraCop*((u.lecturasMes|0)/sumLect))):'';
    h+='<div style="border:1px solid var(--bd);border-radius:8px;padding:10px 12px;margin:0 0 8px;'+(resalta?'background:#fff8e6;':'background:#fff;')+'">'+
      '<div style="font-size:13px;font-weight:650;word-break:break-all">'+escAttr(email)+'</div>'+
      '<div style="font-size:12px;color:var(--tx2);margin-top:4px;line-height:1.45">'+
      'Periodo '+escAttr(u.periodo||'—')+' · Lect. hoy '+(u.lecturasDia|0)+' · Lect. ciclo '+(u.lecturasMes|0)+'<br>'+
      'A personal '+escAttr(apoyoFmtCop(personal))+' · B Blaze '+escAttr(apoyoFmtCop(blaze))+
      ' · <strong>'+escAttr(apoyoFmtCop(monto))+'</strong>'+
      (parte?' · Disco/red '+escAttr(parte):'')+
      ' · '+(u.apoyado?'✓ Apoyó':'Pendiente')+
      '</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+
      '<button type="button" class="btn bsm bp" onclick=\'apoyoMarcarApoyoUsuario('+emailJs+',true)\'>Apoyó + reiniciar</button>'+
      '<button type="button" class="btn bsm" onclick=\'apoyoMarcarApoyoUsuario('+emailJs+',false)\'>Solo apoyó</button>'+
      '<button type="button" class="btn bsm" onclick=\'apoyoReiniciarUsuario('+emailJs+')\'>Reiniciar</button>'+
      '</div></div>';
  });
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
