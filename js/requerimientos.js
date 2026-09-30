// =============================================================================
// requerimientos.js — Término de cumplimiento y seguimiento de requerimientos
// - Bloque «Término para cumplir» al aprobar / notificar (días hábiles Colombia).
// - Bandeja Consolidado › Requerimientos (Cumplió / Incumplió + exportar).
// - Paleta «Requerimientos» del encargado en Actividades (🔍 revisar · ✔ cumplió · 📌 asignar);
//   también resoluciones por vencer / vencidas y facturas o acuerdos de pago en mora (✔ = gestión con observación).
// - Actividad agrupada del encargado: retirada (solo se cierran las que existan).
// Dependencias de runtime resueltas desde el scope global.
// =============================================================================

const REQ_TERM_UNIDAD='habiles';
const REQ_VERIF_ORIGEN='req_verif_agrupada';
const REQ_POR_VENCER_DIAS=3;
const REQ_PALETA_GRACIA_HABILES=3;
const REQ_GESTION_CTX_TTL_MS=3*60*60*1000;
const REQ_PAL_ACTO_AVISO_HABILES=30;
const REQ_PAL_MORA_DIAS=15;
const REQ_PAL_GESTION_KEYS=['palGestionRef','palGestionEn','palGestionPor','palGestionDesc','palGestionTaskIds'];
const REQ_ESTADOS={
  en_termino:{lbl:'En término',bg:'var(--gnl)',fg:'var(--gn)',bd:'#9fe1cb'},
  por_vencer:{lbl:'Por vencer',bg:'var(--aml)',fg:'var(--am)',bd:'#f1d795'},
  vencido:{lbl:'Vencido · por verificar',bg:'var(--rdl)',fg:'var(--rd)',bd:'#f7c1c1'},
  incumplio:{lbl:'Incumplió',bg:'var(--rd)',fg:'#fff',bd:'var(--rd)'},
  gestionado:{lbl:'Gestionado (actividad asignada)',bg:'var(--sf2)',fg:'var(--bl)',bd:'var(--bd)'},
  cumplio:{lbl:'Cumplió',bg:'var(--gnl)',fg:'var(--gn)',bd:'#9fe1cb'},
  sin_notificar:{lbl:'Pendiente notificación',bg:'var(--sf2)',fg:'var(--tx2)',bd:'var(--bd)'}
};
const REQ_ESTADOS_ORDEN=['vencido','por_vencer','en_termino','sin_notificar','incumplio','gestionado','cumplio'];

function reqHoy(){return typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);}
function reqCalcVence(inicio,dias,unidad){
  if(typeof calcVenceConUnidad==='function')return calcVenceConUnidad(inicio,dias,unidad||REQ_TERM_UNIDAD);
  return typeof addDiasHabilesCO==='function'?addDiasHabilesCO(inicio,dias):'';
}
/** Días hábiles CO en el intervalo (desde, hasta]. */
function reqDiasHabilesEntre(desde,hasta){
  const a=String(desde||'').slice(0,10),b=String(hasta||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b)||b<=a)return 0;
  const d=new Date(a+'T12:00:00');
  let n=0,guard=0;
  while(guard++<800){
    d.setDate(d.getDate()+1);
    const s=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(s>b)break;
    if(typeof esDiaHabilCO!=='function'||esDiaHabilCO(s))n++;
  }
  return n;
}
/** Días calendario de desde a hasta. */
function reqDiasCalEntre(desde,hasta){
  const a=String(desde||'').slice(0,10),b=String(hasta||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b))return 0;
  return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);
}
/** Marca de gestión de la paleta en actos / facturas: el formulario del expediente no tiene campos y debe conservarla. */
function reqPalGestionPick(o){
  const r={};
  if(!o)return r;
  REQ_PAL_GESTION_KEYS.forEach(function(k){if(o[k]!==undefined&&o[k]!=='')r[k]=o[k];});
  return r;
}
function reqPalGestionAttr(o){
  const g=reqPalGestionPick(o);
  return Object.keys(g).length?' data-pal-gestion="'+escAttr(JSON.stringify(g))+'"':'';
}
function reqPalGestionFromRow(row){
  try{return JSON.parse((row&&row.getAttribute('data-pal-gestion'))||'{}')||{};}catch(err){return{};}
}
function reqEsOficioRequerimiento(t){
  if(!t)return false;
  if(t.esOficioRequerimiento)return true;
  return typeof esActividadOficioRequerimiento==='function'&&esActividadOficioRequerimiento(t.actividad||t.desc||'');
}
/** Actos administrativos y facturas tienen su propio vencimiento (vigencia / vencimiento de factura). */
function reqActividadExcluida(e,t){
  if(!t)return true;
  if(e&&typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e))return false;
  if(t.actoAdminId)return true;
  if(e&&typeof taskTieneActoAdminPendienteVenc==='function'&&taskTieneActoAdminPendienteVenc(e,t))return true;
  const depto=(e&&e._depto)||t.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'');
  const tipo=typeof resolveActividadRegistroTipo==='function'?resolveActividadRegistroTipo(t.actividad||t.desc||'',depto):'';
  return tipo==='acto'||tipo==='factura';
}

// ── Bloque «Término para cumplir» ────────────────────────────────────────────
function terminoCumplDefaults(e,t){
  const esReq=reqEsOficioRequerimiento(t);
  let dias='';
  let conConcepto=false;
  if(esReq&&e&&t&&t.conceptoReqId&&typeof findConceptoByReqId==='function'){
    const hit=findConceptoByReqId(e,t.conceptoReqId);
    if(hit&&hit.item){conConcepto=true;dias=String(hit.item.reqDias||'');}
  }
  if(!dias&&t&&t.terminoCumplPropuesto&&t.terminoCumplPropuesto.dias)dias=String(t.terminoCumplPropuesto.dias);
  if(!dias&&t&&t.terminoCumpl&&t.terminoCumpl.dias)dias=String(t.terminoCumpl.dias);
  return{
    obligatorio:esReq&&conConcepto,
    marcado:esReq||!!(t&&(t.terminoCumplPropuesto||t.terminoCumpl)),
    dias:dias
  };
}
/**
 * opts.inicio: fecha desde la que corre el término (YYYY-MM-DD).
 * opts.inicioInputId: input de fecha de notificación (si está visible, prima sobre opts.inicio).
 * opts.inicioLbl: texto de origen de la fecha.
 */
function htmlTerminoCumplBlock(e,t,opts){
  opts=opts||{};
  if(!t||reqActividadExcluida(e,t))return'';
  const d=terminoCumplDefaults(e,t);
  const inicio=String(opts.inicio||reqHoy()).slice(0,10);
  const inp='width:90px;padding:6px;border:1px solid var(--bd);border-radius:var(--r)';
  const chk=d.obligatorio
    ?'<div style="font-size:12px;font-weight:600;margin-bottom:6px">Oficio de requerimiento: término para cumplir <span class="req-star">*</span></div>'
    :'<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:6px">'+
      '<input type="checkbox" id="term-cumpl-chk"'+(d.marcado?' checked':'')+' onchange="syncTerminoCumplUi()" style="margin-top:2px;width:15px;height:15px;accent-color:var(--or);flex-shrink:0">'+
      '<span>Otorga término para cumplir <span style="font-weight:400;color:var(--tx3)">(requerimiento u obligación del interesado)</span></span></label>';
  return '<div id="term-cumpl-box" data-obligatorio="'+(d.obligatorio?'1':'0')+'" data-inicio="'+escAttr(inicio)+'" data-inicio-input="'+escAttr(opts.inicioInputId||'')+'" style="margin:10px 0;padding:10px;border:1px solid var(--bd);border-left:3px solid var(--or);border-radius:var(--r);background:var(--sf)">'+
    '<div style="font-size:12px;font-weight:600;color:var(--or);margin-bottom:6px">⏱️ Término para cumplir</div>'+
    chk+
    '<div id="term-cumpl-fields" style="'+(d.obligatorio||d.marcado?'':'display:none')+'">'+
    '<div class="fx" style="gap:8px;align-items:center;flex-wrap:wrap">'+
    '<input type="number" id="term-cumpl-dias" min="1" max="365" step="1" value="'+escAttr(d.dias)+'" placeholder="Ej. 10" oninput="syncTerminoCumplUi()" style="'+inp+'">'+
    '<span style="font-size:12px">días hábiles</span></div>'+
    '<div id="term-cumpl-prev" style="font-size:11px;color:var(--tx2);margin-top:6px"></div>'+
    '</div></div>';
}
function _terminoCumplInicioUi(){
  const box=document.getElementById('term-cumpl-box');
  if(!box)return reqHoy();
  const inId=box.getAttribute('data-inicio-input')||'';
  const inEl=inId?document.getElementById(inId):null;
  if(inEl&&inEl.offsetParent!==null&&String(inEl.value||'').trim())return String(inEl.value).slice(0,10);
  return box.getAttribute('data-inicio')||reqHoy();
}
function syncTerminoCumplUi(){
  const box=document.getElementById('term-cumpl-box');
  if(!box)return;
  const oblig=box.getAttribute('data-obligatorio')==='1';
  const chk=document.getElementById('term-cumpl-chk');
  const on=oblig||!!(chk&&chk.checked);
  const fields=document.getElementById('term-cumpl-fields');
  if(fields)fields.style.display=on?'':'none';
  const prev=document.getElementById('term-cumpl-prev');
  if(!prev)return;
  const n=parseInt(String((document.getElementById('term-cumpl-dias')||{}).value||''),10);
  if(!on||!n||n<1){prev.textContent='';return;}
  const inicio=_terminoCumplInicioUi();
  const vence=reqCalcVence(inicio,n,REQ_TERM_UNIDAD);
  prev.innerHTML='Fecha límite estimada: <strong>'+escAttr(typeof fmtF==='function'?fmtF(vence):vence)+'</strong>';
}
/** null = no hay bloque · {otorga:false} · {otorga:true,dias} · false = inválido (ya avisó). */
function collectTerminoCumplFromUi(){
  const box=document.getElementById('term-cumpl-box');
  if(!box)return null;
  const oblig=box.getAttribute('data-obligatorio')==='1';
  const chk=document.getElementById('term-cumpl-chk');
  if(!oblig&&!(chk&&chk.checked))return{otorga:false};
  const n=parseInt(String((document.getElementById('term-cumpl-dias')||{}).value||''),10);
  if(!n||n<1||n>365){
    notif('Indique los días hábiles del término para cumplir (1 a 365)','err');
    return false;
  }
  return{otorga:true,dias:n,unidad:REQ_TERM_UNIDAD};
}
/**
 * Guarda el término en la actividad y, si es Oficio de requerimiento, en el concepto vinculado.
 * ctx: {inicio, canal, origen}
 */
function aplicarTerminoCumplimiento(refId,taskId,payload,ctx){
  if(!payload||!payload.otorga)return false;
  ctx=ctx||{};
  const t=typeof getTaskAny==='function'?getTaskAny(refId,taskId):null;
  if(!t)return false;
  const e=!t.sinExpediente&&typeof getExpById==='function'?getExpById(refId):null;
  const dias=Number(payload.dias)||0;
  if(dias<1)return false;
  const inicio=String(ctx.inicio||reqHoy()).slice(0,10);
  const vence=reqCalcVence(inicio,dias,REQ_TERM_UNIDAD);
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  if(e&&t.conceptoReqId&&typeof findConceptoByReqId==='function'){
    const hit=findConceptoByReqId(e,t.conceptoReqId);
    if(hit&&hit.item){
      hit.item.reqDias=String(dias);
      hit.item.reqUnidad=REQ_TERM_UNIDAD;
      hit.item.reqNotif=inicio;
      hit.item.reqVence=vence;
      if(ctx.canal)hit.item.reqMedio=ctx.canal;
      e._conceptos_seg=JSON.stringify(hit.arr);
    }
  }
  const depto=(e&&e._depto)||t.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'');
  const enc=(typeof getEncargadoDepto==='function'?getEncargadoDepto(depto):'')||por;
  const venceTxt=typeof fmtF==='function'?fmtF(vence):vence;
  const ok=typeof mutateTask==='function'&&mutateTask(refId,taskId,function(tk){
    tk.terminoCumpl={
      dias:dias,unidad:REQ_TERM_UNIDAD,inicio:inicio,vence:vence,estado:'pendiente',
      encargado:enc,origen:String(ctx.origen||''),canal:String(ctx.canal||''),
      fijadoPor:por,fijadoEn:new Date().toISOString()
    };
    delete tk.terminoCumplPropuesto;
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'termino_cumplimiento',fecha:reqHoy(),ts:Date.now(),por:por,
      nota:'Término para cumplir: '+dias+' días hábiles desde '+(typeof fmtF==='function'?fmtF(inicio):inicio)+' — vence '+venceTxt});
  });
  if(ok&&typeof logAudit==='function')
    logAudit('Término para cumplir ['+refId+']: '+dias+' días hábiles, vence '+venceTxt,'expedientes',refId);
  return !!ok;
}
/** Responsable reporta notificación (revisión final): deja el término sugerido para el encargado. */
function proponerTerminoCumplimiento(refId,taskId,payload){
  if(!payload||!payload.otorga||typeof mutateTask!=='function')return false;
  return mutateTask(refId,taskId,function(tk){tk.terminoCumplPropuesto={dias:Number(payload.dias)||0};});
}
async function tramiteAprobarRevisionFinalConTermino(expId,taskId,termPayload){
  const t0=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const wf=t0&&typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t0):((t0&&t0.firmaWf)||{});
  const inicio=(wf.notificacion_reportada&&wf.notificacion_reportada.fecha)||reqHoy();
  const canal=String(wf.canal||'');
  await tramiteAprobarRevisionFinalNotif(expId,taskId);
  if(!termPayload||!termPayload.otorga)return;
  const t1=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t1)return;
  if(typeof taskFirmaEnRevisionFinalNotif==='function'&&taskFirmaEnRevisionFinalNotif(t1))return;
  const refId=t1.sinExpediente?(t1.codigo||expId):expId;
  try{aplicarTerminoCumplimiento(refId,taskId,termPayload,{inicio:inicio,canal:canal,origen:'revision_final_notif'});}
  catch(err){console.warn('aplicarTerminoCumplimiento (revisión final):',err);}
}
// ── PQRSD: el término queda en la actividad de atención de la PQRSD ─────────
function reqPqrsTaskTermino(e,taskIdHint){
  if(!e)return null;
  return (typeof getPqrsAtencionTask==='function'&&getPqrsAtencionTask(e,taskIdHint))
    ||(typeof getPqrsTaskActiva==='function'&&getPqrsTaskActiva(e,taskIdHint))
    ||null;
}
function reqPqrsAplicarTermino(e,payload,ctx){
  if(!e||!payload||!payload.otorga)return false;
  const t=reqPqrsTaskTermino(e,ctx&&ctx.taskId);
  if(!t)return false;
  try{return aplicarTerminoCumplimiento(e._exp,t.id,payload,ctx||{});}
  catch(err){console.warn('término de cumplimiento PQRSD:',err);return false;}
}
function reqPqrsProponerTermino(e,payload,taskIdHint){
  if(!e||!payload||!payload.otorga)return false;
  const t=reqPqrsTaskTermino(e,taskIdHint);
  return t?proponerTerminoCumplimiento(e._exp,t.id,payload):false;
}
/** Revisión final PQRSD («Aprobar y cerrar»): el término corre desde la fecha de notificación reportada. */
async function pqrsAprobarRevisionFinalConTermino(expId,taskId,termPayload){
  const e0=typeof getExpById==='function'?getExpById(expId):null;
  const wf=e0&&typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e0):{};
  const inicio=(wf.notificacion_reportada&&wf.notificacion_reportada.fecha)||reqHoy();
  const canal=String(wf.canal||'');
  await ncaAprobarRevisionFinalNotif(expId);
  if(!termPayload||!termPayload.otorga)return;
  const e1=typeof getExpById==='function'?getExpById(expId):null;
  if(!e1)return;
  if(typeof pqrsWorkflowFase==='function'&&typeof PQRS_WF!=='undefined'&&pqrsWorkflowFase(e1)===PQRS_WF.REVISION_FINAL)return;
  reqPqrsAplicarTermino(e1,termPayload,{taskId:taskId,inicio:inicio,canal:canal,origen:'revision_final_pqrs'});
}

// ── Colección de requerimientos ──────────────────────────────────────────────
function reqEstadoDe(x){
  if(x.cumplido)return'cumplio';
  if(!x.inicio||!x.vence)return'sin_notificar';
  if(x.gestionado)return'gestionado';
  if(x.incumplioVerif)return'incumplio';
  const h=reqHoy();
  if(x.vence<h)return'vencido';
  if(reqDiasHabilesEntre(h,x.vence)<=REQ_POR_VENCER_DIAS)return'por_vencer';
  return'en_termino';
}
function _reqConceptoKey(exp,c,i){
  return 'c|'+exp+'|'+(c&&c.conceptoReqId?String(c.conceptoReqId):('i:'+i));
}
function _reqEntradasExp(e,out){
  if(!e||!e._exp)return;
  const exp=String(e._exp);
  const tasks=(e.tasks||[]).filter(function(t){return t&&!t.eliminada;});
  const cs=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
  const cidsVistos={};
  cs.forEach(function(c,i){
    if(!c)return;
    const noCumple=c.cumple==='no'||c.cumple===false;
    const aplica=c.aplicaReq!==false&&c.aplicaReq!=='no'&&c.aplicaReq!==0;
    if(!noCumple||!aplica)return;
    const cid=String(c.conceptoReqId||'');
    if(cid)cidsVistos[cid]=true;
    const tLink=cid?tasks.find(function(t){return String(t.conceptoReqId||'')===cid&&reqEsOficioRequerimiento(t);}):null;
    const unidad=c.reqUnidad||(c.reqNotif?'calendario':REQ_TERM_UNIDAD);
    const x={
      key:_reqConceptoKey(exp,c,i),fuente:'concepto',exp:exp,ref:exp,idx:i,conceptoReqId:cid,
      nombre:typeof getNom==='function'?getNom(e):exp,
      titulo:(c.tipoConcepto?c.tipoConcepto+' · ':'')+'Concepto '+(c.concepto||('#'+(i+1))),
      reqNum:String(c.reqNum||''),oficio:String(c.reqOficio||''),
      inicio:String(c.reqNotif||''),dias:String(c.reqDias||''),unidad:unidad,
      vence:String(c.reqVence||(typeof calcReqVence==='function'?calcReqVence(c.reqNotif,c.reqDias,c.reqUnidad):'')||''),
      cumplido:!!c.reqCumplido,fechaCump:String(c.reqFechaCump||''),
      incumplioVerif:!!c.reqIncumplioVerif,verifPor:String(c.reqVerifPor||''),verifNota:String(c.reqVerifNota||''),
      gestionado:!!c.reqGestionEn,gestionDesc:String(c.reqGestionDesc||''),
      taskId:tLink?String(tLink.id):''
    };
    x.estado=reqEstadoDe(x);
    out.push(x);
  });
  tasks.forEach(function(t){
    const tc=t.terminoCumpl;
    if(!tc||!tc.vence)return;
    if(t.conceptoReqId&&cidsVistos[String(t.conceptoReqId)])return;
    out.push(_reqEntradaTarea(exp,t,typeof getNom==='function'?getNom(e):exp));
  });
}
function _reqEntradaTarea(ref,t,nombre){
  const tc=t.terminoCumpl||{};
  const x={
    key:'t|'+ref+'|'+t.id,fuente:'tarea',exp:ref,ref:ref,taskId:String(t.id),
    nombre:nombre||ref,
    titulo:String(t.actividad||t.desc||'Actividad'),
    reqNum:'',oficio:String(t.oficioNumero||t.oficio||''),
    inicio:String(tc.inicio||''),dias:String(tc.dias||''),unidad:tc.unidad||REQ_TERM_UNIDAD,vence:String(tc.vence||''),
    cumplido:tc.estado==='cumplio',fechaCump:String(tc.fechaCump||''),
    incumplioVerif:tc.estado==='incumplio',verifPor:String(tc.verificadoPor||''),verifNota:String(tc.nota||''),
    gestionado:!!tc.gestionEn,gestionDesc:String(tc.gestionDesc||'')
  };
  x.estado=reqEstadoDe(x);
  return x;
}
/** list: expedientes; opts.libres: incluir actividades sin expediente del depto activo. */
function reqColectarEntradas(list,opts){
  opts=opts||{};
  const out=[];
  (list||[]).forEach(function(e){_reqEntradasExp(e,out);});
  if(opts.libres){
    const libs=typeof actividadesLibresForDepto==='function'&&typeof deptoActivo!=='undefined'
      ?actividadesLibresForDepto(deptoActivo)
      :[];
    (libs||[]).forEach(function(t){
      if(!t||t.eliminada||!t.terminoCumpl||!t.terminoCumpl.vence)return;
      const ref=String(t.codigo||t.id);
      out.push(_reqEntradaTarea(ref,t,t.interesadoNombre||ref));
    });
  }
  return out;
}
/** Flag «Incumplió req.» también para términos fijados en actividades (sin concepto). */
function reqTareasTerminoIncumplido(e){
  if(!e||!Array.isArray(e.tasks))return false;
  const h=reqHoy();
  return e.tasks.some(function(t){
    const tc=t&&!t.eliminada?t.terminoCumpl:null;
    if(!tc||!tc.vence||tc.estado==='cumplio')return false;
    return tc.estado==='incumplio'||tc.vence<h;
  });
}
function reqListaAmbito(){
  const base=typeof expsAmbito==='function'?expsAmbito():(typeof exps!=='undefined'?exps:[]);
  return (base||[]).filter(Boolean);
}
function reqPuedeVerificar(){
  if(typeof esModoResponsable==='function'&&esModoResponsable())return false;
  if(typeof esJurisdiccional==='function'&&esJurisdiccional())return false;
  if(typeof esEncargadoActivo==='function'&&esEncargadoActivo())return true;
  return typeof esAdministrador==='function'&&esAdministrador();
}
function reqEstadoBadge(est,x){
  const s=REQ_ESTADOS[est]||REQ_ESTADOS.sin_notificar;
  let extra='';
  if(x&&est==='vencido')extra=' ('+reqDiasHabilesEntre(x.vence,reqHoy())+' d. háb.)';
  else if(x&&(est==='por_vencer'||est==='en_termino'))extra=' ('+reqDiasHabilesEntre(reqHoy(),x.vence)+' d. háb.)';
  return '<span class="bdg" style="background:'+s.bg+';color:'+s.fg+';border:1px solid '+s.bd+';white-space:nowrap">'+s.lbl+extra+'</span>';
}

// ── Consolidado: tarjeta ─────────────────────────────────────────────────────
function renderConsolidadoRequerimientosCard(amb){
  const box=document.getElementById('c-req');
  if(!box)return;
  const list=(amb||[]).filter(Boolean);
  window._reqConsList=list;
  const entries=reqColectarEntradas(list,{libres:true});
  if(!entries.length){box.innerHTML='<div style="font-size:12px;color:var(--tx3);padding:5px">Ninguno</div>';return;}
  const cnt={};
  entries.forEach(function(x){cnt[x.estado]=(cnt[x.estado]||0)+1;});
  const chips=REQ_ESTADOS_ORDEN.filter(function(k){return cnt[k];}).map(function(k){
    const s=REQ_ESTADOS[k];
    return '<button type="button" class="btn bsm" style="background:'+s.bg+';color:'+s.fg+';border-color:'+s.bd+';font-size:11px;padding:3px 8px" onclick="openRequerimientosBandeja(\''+k+'\')">'+s.lbl+': <strong>'+cnt[k]+'</strong></button>';
  }).join('');
  box.innerHTML='<div class="fx" style="gap:5px;flex-wrap:wrap;margin:6px 0">'+chips+'</div>'+
    '<button type="button" class="cons-exp-more" onclick="openRequerimientosBandeja(\'\')">Abrir bandeja ('+entries.length+')</button>';
}

// ── Bandeja ──────────────────────────────────────────────────────────────────
function openRequerimientosBandeja(filtro){
  window._reqBandejaFiltro=String(filtro||'');
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov)return;
  if(tit)tit.textContent='📋 Requerimientos — seguimiento de cumplimiento';
  if(modal){modal.classList.remove('enviar-modal-only');modal.classList.add('task-modal-wide');}
  renderRequerimientosBandeja();
  ov.classList.add('on');
  window._taskModalCtx={mode:'reqBandeja'};
}
function _reqBandejaEntradas(){
  const list=Array.isArray(window._reqConsList)&&document.getElementById('pg-cons')&&document.getElementById('pg-cons').classList.contains('on')
    ?window._reqConsList
    :reqListaAmbito();
  const all=reqColectarEntradas(list,{libres:true});
  const ordIdx=function(k){const i=REQ_ESTADOS_ORDEN.indexOf(k);return i<0?99:i;};
  all.sort(function(a,b){
    const d=ordIdx(a.estado)-ordIdx(b.estado);
    if(d)return d;
    return String(a.vence||'9999').localeCompare(String(b.vence||'9999'));
  });
  return all;
}
function renderRequerimientosBandeja(){
  const body=document.getElementById('task-modal-body');
  if(!body)return;
  const all=_reqBandejaEntradas();
  const filtro=window._reqBandejaFiltro||'';
  const rows=filtro?all.filter(function(x){return x.estado===filtro;}):all;
  window._reqBandejaEntries=rows;
  const puede=reqPuedeVerificar();
  const cnt={};
  all.forEach(function(x){cnt[x.estado]=(cnt[x.estado]||0)+1;});
  const chip=function(k,lbl,n){
    const on=filtro===k;
    return '<button type="button" class="btn bsm'+(on?' bp':'')+'" style="font-size:11px;padding:3px 8px" onclick="window._reqBandejaFiltro=\''+k+'\';renderRequerimientosBandeja()">'+lbl+' ('+n+')</button>';
  };
  let h='<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Términos en <strong>días hábiles</strong> (calendario Colombia). '+
    (puede?'Marque <strong>Cumplió</strong> para cerrar el requerimiento o <strong>Incumplió</strong> para dejar la marca y tomar medidas.':'Solo el encargado puede registrar la verificación.')+'</div>';
  h+='<div class="fx" style="gap:5px;flex-wrap:wrap;margin-bottom:10px">'+chip('','Todos',all.length)+
    REQ_ESTADOS_ORDEN.filter(function(k){return cnt[k];}).map(function(k){return chip(k,REQ_ESTADOS[k].lbl,cnt[k]);}).join('')+
    '<span style="flex:1"></span><button type="button" class="btn bsm" onclick="reqBandejaExportarCsv()">⬇ Exportar CSV</button></div>';
  if(!rows.length){
    h+='<div class="emp" style="padding:14px">Sin requerimientos en este filtro.</div>';
  }else{
    h+='<div style="overflow:auto;max-height:60vh"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:1px solid var(--bd)">'+
      '<th style="padding:5px">Expediente</th><th style="padding:5px">Requerimiento</th><th style="padding:5px">Notificado</th><th style="padding:5px">Límite</th><th style="padding:5px">Estado</th><th style="padding:5px">Acciones</th></tr></thead><tbody>';
    rows.forEach(function(x,i){
      const refLink=x.fuente==='concepto'||(typeof getExpById==='function'&&getExpById(x.exp))
        ?'<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--bl);cursor:pointer" data-con-exp-asoc="'+escAttr(x.exp)+'">'+escAttr(x.exp)+'</span>'
        :'<span style="font-family:\'DM Mono\',monospace;font-size:11px">'+escAttr(x.exp)+'</span>';
      const det=[x.reqNum?'Req. '+escAttr(x.reqNum):'',x.oficio?'Oficio '+escAttr(x.oficio):'',x.dias?escAttr(x.dias)+' d. '+(x.unidad===REQ_TERM_UNIDAD?'háb.':'cal.'):''].filter(Boolean).join(' · ');
      let acc='';
      if(puede){
        if(x.estado==='vencido'||x.estado==='por_vencer'||x.estado==='en_termino'||x.estado==='incumplio'||x.estado==='gestionado')
          acc+='<button type="button" class="btn bsm" style="background:var(--gn);border-color:var(--gn);color:#fff;font-size:11px;padding:3px 7px" onclick="reqBandejaAccion('+i+',\'cumplio\')">✓ Cumplió</button> ';
        if(x.estado==='vencido')
          acc+='<button type="button" class="btn bsm" style="background:var(--rd);border-color:var(--rd);color:#fff;font-size:11px;padding:3px 7px" onclick="reqBandejaAccion('+i+',\'incumplio\')">✗ Incumplió</button>';
      }
      if(x.estado==='cumplio'&&x.fechaCump)acc+='<span style="font-size:11px;color:var(--tx2)">Cumplió '+escAttr(typeof fmtF==='function'?fmtF(x.fechaCump):x.fechaCump)+'</span>';
      if(x.estado==='incumplio'&&x.verifPor)acc+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">Verificó '+escAttr(x.verifPor)+'</div>';
      h+='<tr style="border-bottom:1px solid var(--bd);vertical-align:top">'+
        '<td style="padding:5px">'+refLink+'<div style="font-weight:600">'+escAttr(x.nombre||'')+'</div></td>'+
        '<td style="padding:5px">'+escAttr(x.titulo)+(det?'<div style="font-size:11px;color:var(--tx3)">'+det+'</div>':'')+(x.verifNota?'<div style="font-size:11px;color:var(--tx2);font-style:italic">'+escAttr(x.verifNota)+'</div>':'')+(x.gestionDesc?'<div style="font-size:11px;color:var(--bl)">📌 '+escAttr(x.gestionDesc)+'</div>':'')+'</td>'+
        '<td style="padding:5px;white-space:nowrap">'+(x.inicio?escAttr(typeof fmtF==='function'?fmtF(x.inicio):x.inicio):'—')+'</td>'+
        '<td style="padding:5px;white-space:nowrap">'+(x.vence?escAttr(typeof fmtF==='function'?fmtF(x.vence):x.vence):'—')+'</td>'+
        '<td style="padding:5px">'+reqEstadoBadge(x.estado,x)+'</td>'+
        '<td style="padding:5px;white-space:nowrap">'+acc+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  body.innerHTML=h;
}
function reqBandejaAccion(i,tipo){
  const x=(window._reqBandejaEntries||[])[i];
  const body=document.getElementById('task-modal-body');
  if(!x||!body)return;
  if(!reqPuedeVerificar()){notif('Solo el encargado puede registrar la verificación','err');return;}
  const esCump=tipo==='cumplio';
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r);box-sizing:border-box';
  body.innerHTML='<div style="max-width:520px">'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:6px">'+(esCump?'✓ Registrar cumplimiento':'✗ Registrar incumplimiento')+'</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px"><strong>'+escAttr(x.exp)+'</strong> · '+escAttr(x.titulo)+(x.vence?' · límite '+escAttr(typeof fmtF==='function'?fmtF(x.vence):x.vence):'')+'</div>'+
    (esCump
      ?'<div class="fld" style="margin-bottom:8px"><label>Fecha de cumplimiento <span class="req-star">*</span></label><input type="date" id="req-verif-fecha" value="'+escAttr(reqHoy())+'" style="'+inp+'"></div>'
      :'<div style="font-size:12px;margin-bottom:8px;padding:8px;background:var(--rdl);border:1px solid #f7c1c1;border-radius:var(--r)">Queda la marca <strong>Incumplió requerimiento</strong> en el expediente para tomar medidas. Si luego cumple, puede registrar el cumplimiento desde esta bandeja.</div>')+
    '<div class="fld" style="margin-bottom:10px"><label>Observación <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label><textarea id="req-verif-nota" style="'+inp+';min-height:60px"></textarea></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="reqBandejaConfirmar('+i+',\''+(esCump?'cumplio':'incumplio')+'\')">Confirmar</button>'+
    '<button type="button" class="btn bsm" onclick="renderRequerimientosBandeja()">Volver</button></div></div>';
}
function reqBandejaConfirmar(i,tipo){
  const x=(window._reqBandejaEntries||[])[i];
  if(!x)return;
  const fecha=tipo==='cumplio'?String((document.getElementById('req-verif-fecha')||{}).value||'').trim():'';
  const nota=String((document.getElementById('req-verif-nota')||{}).value||'').trim().slice(0,500);
  if(tipo==='cumplio'&&!fecha){notif('Indique la fecha de cumplimiento','err');return;}
  const ok=reqRegistrarVerificacion(x,tipo,{fecha:fecha,nota:nota});
  if(!ok)return;
  notif(tipo==='cumplio'?'Requerimiento marcado como cumplido':'Incumplimiento registrado','ok');
  renderRequerimientosBandeja();
  _reqRefrescarVistas();
}
function _reqPersistExp(e){
  const now=new Date().toISOString();
  e._pending_fs_sync=true;
  e._pending_fs_at=now;
  e.updatedAt=now;
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
}
function reqRegistrarVerificacion(x,tipo,d){
  d=d||{};
  if(!reqPuedeVerificar()){notif('Solo el encargado puede registrar la verificación','err');return false;}
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  const en=new Date().toISOString();
  const esCump=tipo==='cumplio';
  const hoyS=reqHoy();
  const fechaTxt=d.fecha&&typeof fmtF==='function'?fmtF(d.fecha):(d.fecha||'');
  const notaHist=(esCump?'Requerimiento cumplido'+(fechaTxt?' el '+fechaTxt:''):'Requerimiento incumplido (término vencido)')+(d.nota?' · '+d.nota:'');
  const patchTask=function(tk){
    const tc=Object.assign({},tk.terminoCumpl||{});
    tc.estado=esCump?'cumplio':'incumplio';
    tc.fechaCump=esCump?d.fecha:'';
    tc.verificadoPor=por;tc.verificadoEn=en;tc.nota=d.nota||'';
    tk.terminoCumpl=tc;
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'verificacion_requerimiento',fecha:hoyS,ts:Date.now(),por:por,nota:notaHist});
  };
  if(x.fuente==='concepto'){
    const e=typeof getExpById==='function'?getExpById(x.exp):null;
    if(!e){notif('Expediente no encontrado','err');return false;}
    const arr=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
    let idx=-1;
    if(x.conceptoReqId)idx=arr.findIndex(function(c){return c&&String(c.conceptoReqId||'')===x.conceptoReqId;});
    else if(typeof x.idx==='number'&&arr[x.idx]&&!arr[x.idx].conceptoReqId)idx=x.idx;
    if(idx<0){notif('No se encontró el concepto; recargue e intente de nuevo','err');return false;}
    const c=arr[idx];
    if(!c.conceptoReqId)c.conceptoReqId='creq_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    if(esCump){c.reqCumplido=true;c.reqFechaCump=d.fecha;c.reqIncumplioVerif=false;}
    else{c.reqIncumplioVerif=true;}
    c.reqVerifTipo=tipo;c.reqVerifPor=por;c.reqVerifEn=en;c.reqVerifNota=d.nota||'';
    e._conceptos_seg=JSON.stringify(arr);
    const tLink=x.taskId&&typeof getTaskAny==='function'?getTaskAny(e._exp,x.taskId):null;
    if(tLink&&typeof mutateTask==='function')mutateTask(e._exp,x.taskId,patchTask);
    else _reqPersistExp(e);
  }else{
    if(typeof mutateTask!=='function'||!mutateTask(x.ref,x.taskId,patchTask)){
      notif('No se encontró la actividad; recargue e intente de nuevo','err');return false;
    }
  }
  if(typeof logAudit==='function')
    logAudit('Requerimiento '+(esCump?'cumplido':'incumplido')+' ['+x.exp+'] '+x.titulo+(d.nota?' — '+d.nota:''),'expedientes',x.exp);
  return true;
}
function _reqCsvCell(v){
  let s=String(v==null?'':v);
  if(/^[=+\-@]/.test(s))s="'"+s;
  return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function reqBandejaExportarCsv(){
  const rows=window._reqBandejaEntries||[];
  if(!rows.length){notif('No hay requerimientos para exportar','warn');return;}
  const f=function(v){return v&&typeof fmtF==='function'?fmtF(v):(v||'');};
  const head=['Expediente','Interesado','Requerimiento','N° requerimiento','N° oficio','Fecha notificación','Días','Unidad','Fecha límite','Estado','Días hábiles vencidos','Fecha cumplimiento','Verificado por','Observación','Actividad asignada'];
  const lines=[head.map(_reqCsvCell).join(';')];
  rows.forEach(function(x){
    lines.push([
      x.exp,x.nombre,x.titulo,x.reqNum,x.oficio,f(x.inicio),x.dias,x.unidad===REQ_TERM_UNIDAD?'hábiles':'calendario',f(x.vence),
      (REQ_ESTADOS[x.estado]||{}).lbl||x.estado,
      x.estado==='vencido'||x.estado==='incumplio'||x.estado==='gestionado'?reqDiasHabilesEntre(x.vence,reqHoy()):'',
      f(x.fechaCump),x.verifPor,x.verifNota,x.gestionDesc
    ].map(_reqCsvCell).join(';'));
  });
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='requerimientos_'+reqHoy()+'.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}

// ── Actividad agrupada del encargado ─────────────────────────────────────────
function _reqSlug(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'enc';
}
function reqVerifActividadId(depto,enc){return 'reqverif_'+depto+'_'+_reqSlug(enc);}
/**
 * Retirada: la paleta «Requerimientos» la reemplaza. Ya no se crea ni reabre;
 * si quedó una abierta de antes, se cierra como Atendida (sin borrar).
 */
function reqVerifSyncActividadAgrupada(force){
  try{
    if(typeof esEncargadoActivo!=='function'||!esEncargadoActivo())return;
    const depto=typeof deptoActivo!=='undefined'?String(deptoActivo||''):'';
    if(!depto)return;
    const now=Date.now();
    if(!force&&window._reqVerifSyncAt&&now-window._reqVerifSyncAt<60000)return;
    window._reqVerifSyncAt=now;
    const enc=String((typeof getEncargadoDepto==='function'?getEncargadoDepto(depto):'')||'').trim();
    if(!enc)return;
    const id=reqVerifActividadId(depto,enc);
    const t=typeof getActLibreById==='function'?getActLibreById(id):null;
    if(!t||t.eliminada)return;
    const abierta=typeof estadoTask==='function'?estadoTask(t)!=='Atendida':!t.fechaAtendida;
    if(!abierta||typeof mutateTask!=='function')return;
    const hoyS=reqHoy();
    mutateTask(t.codigo||id,id,function(tk){
      tk.reqVerifKeys=[];
      tk.detalle='Reemplazada por la paleta Actividades › Requerimientos';
      tk.desc=tk.actividad+' — '+tk.detalle;
      (tk.asignados||[]).forEach(function(a){a.estado='atendido';a.fechaAtendida=hoyS;if(!a.fechaReportada)a.fechaReportada=hoyS;});
      tk.fechaReportada=tk.fechaReportada||hoyS;
      tk.fechaAtendida=hoyS;
      tk.estado='Atendida';
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({tipo:'auto_req_verif',fecha:hoyS,ts:Date.now(),por:'Sistema',nota:'Cerrada automáticamente: el seguimiento pasa a la paleta Requerimientos'});
    });
  }catch(err){
    console.warn('reqVerifSyncActividadAgrupada:',err);
  }
}
function reqEsActividadAgrupada(t){return !!(t&&t.origen===REQ_VERIF_ORIGEN);}
function reqActividadAgrupadaToolbarHtml(){
  return '<span class="sst-act-toolbar"><button type="button" class="btn bsm bic act-ico" title="Abrir requerimientos vencidos por verificar" onclick="event.stopPropagation();openRequerimientosBandeja(\'vencido\')">📋</button></span>';
}

// ── Paleta «Requerimientos» (Actividades · encargado) ────────────────────────
function _reqRefrescarVistas(){
  try{
    const pa=document.getElementById('pg-act');
    if(pa&&pa.classList.contains('on')&&typeof renderActividades==='function')renderActividades();
    const pc=document.getElementById('pg-cons');
    if(pc&&pc.classList.contains('on'))renderConsolidadoRequerimientosCard(window._reqConsList||reqListaAmbito());
  }catch(err){console.warn('_reqRefrescarVistas:',err);}
}
function reqPaletaVisible(){
  if(!reqPuedeVerificar())return false;
  return !(typeof esVistaActividadesDepto==='function'&&!esVistaActividadesDepto());
}
/** Vencido (o incumplido sin gestionar) y pasados los días hábiles de gracia. */
function reqPaletaEntra(x){
  if(!x||(x.estado!=='vencido'&&x.estado!=='incumplio'))return false;
  return reqDiasHabilesEntre(x.vence,reqHoy())>REQ_PALETA_GRACIA_HABILES;
}
function reqPalEsGestionItem(x){return !!(x&&(x.fuente==='acto'||x.fuente==='factura'||x.fuente==='acuerdo'));}
function _reqPalActoTask(e,a){
  const id=String(a.actoAdminId||''),tid=String(a.taskId||'');
  return (e.tasks||[]).find(function(t){
    return t&&!t.eliminada&&((tid&&String(t.id)===tid)||(id&&String(t.actoAdminId||'')===id));
  })||null;
}
function _reqPalFacSig(f){return f?[f.tipo,f.ref,f.venc,f.valor].map(function(v){return String(v||'');}).join('|'):'';}
/**
 * Resoluciones a ≤30 días hábiles de vencer (o vencidas) y facturas / acuerdos de pago con ≥15 días calendario de mora.
 * Sin registros pendientes de aprobación ni actos cuya notificación siga en revisión del encargado.
 */
function _reqPalEntradasExp(e,out){
  if(!e||!e._exp)return;
  const exp=String(e._exp),h=reqHoy();
  const nombre=typeof getNom==='function'?getNom(e):exp;
  const fx=function(s){return typeof fmtF==='function'?fmtF(s):s;};
  const actos=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
  actos.forEach(function(a,i){
    if(!a||a.pendienteAprobacion||typeof estadoActoAdmin!=='function'||typeof vigenteActo!=='function')return;
    if(estadoActoAdmin(a).archivada)return;
    const vig=String(vigenteActo(a)||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(vig))return;
    const vencida=vig<h;
    if(!vencida&&reqDiasHabilesEntre(h,vig)>REQ_PAL_ACTO_AVISO_HABILES)return;
    const palRef='v:'+vig;
    if(a.palGestionEn&&a.palGestionRef===palRef)return;
    const t=_reqPalActoTask(e,a);
    if(t&&typeof taskFirmaEnRevisionFinalNotif==='function'&&taskFirmaEnRevisionFinalNotif(t))return;
    const pr=typeof tieneProrrogasActo==='function'&&tieneProrrogasActo(a);
    out.push({
      key:'a|'+exp+'|'+(a.actoAdminId||('i:'+i)),fuente:'acto',exp:exp,ref:exp,idx:i,actoAdminId:String(a.actoAdminId||''),
      nombre:nombre,titulo:String(a.tipo||'Acto administrativo')+(a.numero?' N° '+a.numero:''),
      detalle:[a.fecha?'Del '+fx(a.fecha):'',pr?'Vigencia por prórroga':''].filter(Boolean).join(' · '),
      vence:vig,palRef:palRef,estado:vencida?'vencido':'por_vencer',taskId:t?String(t.id):''
    });
  });
  const facs=typeof facturasData==='function'?facturasData(e._facturas_extra):[];
  facs.forEach(function(f,i){
    if(!f||f.pendienteAprobacion||f.pago)return;
    let fecha='',det='';
    const esAcu=!!f.acuerdoPago;
    if(esAcu){
      const cuotas=typeof acuerdoCuotasData==='function'?acuerdoCuotasData(f):[];
      if(cuotas.length){
        const mora=cuotas.map(function(c,ci){return{c:c,n:ci+1};}).filter(function(o){return o.c&&o.c.fecha&&!o.c.pago&&o.c.fecha<h;});
        mora.sort(function(p,q){return String(p.c.fecha).localeCompare(String(q.c.fecha));});
        if(mora.length){
          fecha=String(mora[0].c.fecha);
          det='Cuota #'+mora[0].n+(mora.length>1?' · '+mora.length+' cuotas en mora':'');
        }
      }else if(!f.acuerdoDia)fecha=String(f.venc||'');
    }else fecha=String(f.venc||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||reqDiasCalEntre(fecha,h)<REQ_PAL_MORA_DIAS)return;
    const palRef=(esAcu?'c:':'f:')+fecha;
    if(f.palGestionEn&&f.palGestionRef===palRef)return;
    const valor=f.valor&&typeof moneyFmt==='function'?'$'+moneyFmt(f.valor):'';
    out.push({
      key:'f|'+exp+'|'+i+'|'+palRef,fuente:esAcu?'acuerdo':'factura',exp:exp,ref:exp,idx:i,sig:_reqPalFacSig(f),
      nombre:nombre,titulo:(esAcu?'Acuerdo de pago · ':'')+String(f.tipo||'Factura')+(f.ref?' · '+f.ref:''),
      detalle:[det,valor?'Valor '+valor:''].filter(Boolean).join(' · '),
      vence:fecha,palRef:palRef,estado:'vencido',taskId:f.taskId?String(f.taskId):''
    });
  });
}
/** Formulario del mismo expediente abierto: al guardarlo de nuevo no debe borrar la marca. */
function _reqPalSyncFormRow(e,sel,idx,item){
  try{
    if(typeof editId==='undefined'||String(editId||'')!==String(e._exp))return;
    const row=document.querySelectorAll(sel)[idx];
    if(row)row.setAttribute('data-pal-gestion',JSON.stringify(reqPalGestionPick(item)));
  }catch(err){}
}
function _reqPalMarcarGestion(e,x,d){
  d=d||{};
  if(!e||!x)return false;
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  const patch=function(o){
    o.palGestionRef=x.palRef;o.palGestionEn=new Date().toISOString();o.palGestionPor=por;
    o.palGestionDesc=String(d.desc||'').slice(0,500);
    if(d.taskIds&&d.taskIds.length)o.palGestionTaskIds=d.taskIds;else delete o.palGestionTaskIds;
  };
  if(x.fuente==='acto'){
    const arr=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
    let idx=x.actoAdminId?arr.findIndex(function(a){return a&&String(a.actoAdminId||'')===x.actoAdminId;}):-1;
    if(idx<0&&!x.actoAdminId&&arr[x.idx]&&!arr[x.idx].actoAdminId)idx=x.idx;
    if(idx<0||'v:'+String(vigenteActo(arr[idx])||'')!==x.palRef)return false;
    patch(arr[idx]);
    e._actos_admin=JSON.stringify(arr);
    _reqPalSyncFormRow(e,'#actos-admin-list .acto-admin',idx,arr[idx]);
  }else{
    const arr=typeof facturasData==='function'?facturasData(e._facturas_extra):[];
    const idx=arr[x.idx]&&_reqPalFacSig(arr[x.idx])===x.sig?x.idx:arr.findIndex(function(f){return _reqPalFacSig(f)===x.sig;});
    if(idx<0)return false;
    patch(arr[idx]);
    e._facturas_extra=JSON.stringify(arr);
    _reqPalSyncFormRow(e,'#facturas-extra .factura-extra',idx,arr[idx]);
  }
  _reqPersistExp(e);
  if(typeof logAudit==='function')
    logAudit('Gestión paleta Requerimientos ['+x.exp+'] '+x.titulo+' — '+String(d.desc||'').slice(0,200),'expedientes',x.exp);
  return true;
}
function reqPaletaEntradas(){
  if(!reqPaletaVisible())return[];
  const lista=reqListaAmbito();
  const out=reqColectarEntradas(lista,{libres:true}).filter(reqPaletaEntra);
  lista.forEach(function(e){
    try{_reqPalEntradasExp(e,out);}catch(err){console.warn('_reqPalEntradasExp:',err);}
  });
  out.sort(function(a,b){
    return String(a.vence||'').localeCompare(String(b.vence||''))||String(a.exp||'').localeCompare(String(b.exp||''));
  });
  return out;
}
function reqPaletaContar(){
  try{return reqPaletaEntradas().length;}catch(err){console.warn('reqPaletaContar:',err);return 0;}
}
function reqPaletaRowsHtml(q,colSpan){
  let rows=reqPaletaEntradas();
  const ql=String(q||'').toLowerCase().trim();
  if(ql)rows=rows.filter(function(x){
    return [x.exp,x.nombre,x.titulo,x.reqNum,x.oficio,x.detalle].join(' ').toLowerCase().indexOf(ql)>=0;
  });
  window._reqPaletaEntries=rows;
  if(!rows.length)
    return '<tr><td colspan="'+colSpan+'" class="emp">Sin pendientes por gestionar. Requerimientos: '+REQ_PALETA_GRACIA_HABILES+' días hábiles después del vencimiento · Resoluciones: '+REQ_PAL_ACTO_AVISO_HABILES+' días hábiles antes de vencer · Facturas y acuerdos de pago: '+REQ_PAL_MORA_DIAS+' días de mora.</td></tr>';
  const colNotif=typeof actMuestraColNotificadorPor==='function'&&actMuestraColNotificadorPor();
  return rows.map(function(x,i){return _reqPaletaRowHtml(x,i,colNotif);}).join('');
}
function _reqPaletaRowHtml(x,i,colNotif){
  const fx=function(s){return s?(typeof fmtF==='function'?fmtF(s):s):'—';};
  const e=typeof getExpById==='function'?getExpById(x.exp):null;
  const t=x.taskId&&typeof getTaskAny==='function'?getTaskAny(x.ref,x.taskId):null;
  const tram=e
    ?String(((typeof getTram==='function'&&getTram(e._tramite,e))||{}).nombre||e._tramite||'')
    :(t&&t.sinExpediente?'Sin expediente':'');
  const esGest=reqPalEsGestionItem(x);
  const bdgRd='<span class="bdg" style="background:var(--rdl);color:var(--rd);border:1px solid #f7c1c1;white-space:nowrap">';
  const dv=reqDiasHabilesEntre(x.vence,reqHoy());
  let badge;
  if(x.fuente==='acto'){
    badge=x.estado==='vencido'
      ?bdgRd+'⚖️ Resolución vencida · '+dv+' d. háb.</span>'
      :'<span class="bdg" style="background:var(--aml);color:var(--am);border:1px solid #f1d795;white-space:nowrap">⚖️ Resolución vence en '+reqDiasHabilesEntre(reqHoy(),x.vence)+' d. háb.</span>';
  }else if(esGest){
    badge=bdgRd+'💲 '+(x.fuente==='acuerdo'?'Acuerdo en mora':'Factura en mora')+' · '+reqDiasCalEntre(x.vence,reqHoy())+' días</span>';
  }else{
    badge=bdgRd+'⏱️ Req. vencido · '+dv+' d. háb.</span>';
    if(x.estado==='incumplio')badge+=' <span class="bdg" style="background:var(--rd);color:#fff;white-space:nowrap">Incumplió</span>';
  }
  const det=esGest
    ?escAttr(x.detalle||'')
    :[x.reqNum?'Req. '+escAttr(x.reqNum):'',x.oficio?'Oficio '+escAttr(x.oficio):'',x.dias?escAttr(x.dias)+' d. '+(x.unidad===REQ_TERM_UNIDAD?'háb.':'cal.'):''].filter(Boolean).join(' · ');
  const cierre=x.fuente==='acto'?'Vigencia hasta '+fx(x.vence):(esGest?(x.fuente==='acuerdo'?'Corte ':'Venció ')+fx(x.vence):'Notificado '+fx(x.inicio));
  const barra=x.fuente==='acto'&&x.estado!=='vencido'?'var(--am)':'var(--rd)';
  const resp=t&&typeof taskResponsablesLabel==='function'?taskResponsablesLabel(t,true):'—';
  const refHtml=e
    ?'<span style="color:var(--bl);cursor:pointer" data-con-exp-asoc="'+escAttr(x.exp)+'">'+escAttr(x.exp)+'</span>'
    :escAttr(x.exp);
  let acc='<button type="button" class="btn bsm bic act-ico" title="Ver: revisión con las opciones del encargado (editar expediente, trasladar…)" onclick="event.stopPropagation();reqPaletaVer('+i+')">🔍</button>';
  acc+='<button type="button" class="btn bsm bic act-ico" title="'+(esGest?'Registrar gestión (observación obligatoria)':'Cumplió el requerimiento')+'" onclick="event.stopPropagation();reqPaletaCumplio('+i+')">✔</button>';
  if(e)acc+='<button type="button" class="btn bsm bic act-ico" title="Asignar actividad a un responsable (al guardarla sale de esta paleta)" onclick="event.stopPropagation();reqPaletaAsignar('+i+')">📌</button>';
  return '<tr data-req-key="'+escAttr(x.key)+'" style="box-shadow:inset 3px 0 0 '+barra+'">'+
    '<td class="act-col-estado">'+badge+'</td>'+
    '<td class="act-col-ref" style="font-family:\'DM Mono\',monospace;font-size:12px">'+refHtml+'</td>'+
    '<td class="act-col-tram">'+escAttr(tram)+'</td>'+
    '<td class="act-col-inter">'+escAttr(x.nombre||'')+'</td>'+
    '<td class="act-col-desc">'+escAttr(x.titulo||'')+(det?'<div style="font-size:11px;color:var(--tx3)">'+det+'</div>':'')+
      (x.verifNota?'<div style="font-size:11px;color:var(--tx2);font-style:italic">'+escAttr(x.verifNota)+'</div>':'')+'</td>'+
    '<td class="act-col-resp" style="font-size:12px;color:var(--tx2)">'+resp+'</td>'+
    (colNotif?'<td class="act-col-notif"></td>':'')+
    '<td class="act-col-vence" style="color:'+barra+'">'+fx(x.vence)+'</td>'+
    '<td class="act-col-cierre" style="font-size:12px">'+cierre+'</td>'+
    '<td class="act-col-acciones"><div class="act-row-actions"><span class="sst-act-toolbar">'+acc+'</span></div></td></tr>';
}
function reqPaletaVer(i){
  const x=(window._reqPaletaEntries||[])[i];
  if(!x)return;
  if(x.taskId&&typeof openTaskVerDocumentoResp==='function'){openTaskVerDocumentoResp(x.ref,x.taskId);return;}
  if(typeof abrirConsultaExpAsociado==='function'){abrirConsultaExpAsociado(x.exp);return;}
  if(typeof editarExp==='function')editarExp(x.exp);
}
function reqPaletaCumplio(i){
  const x=(window._reqPaletaEntries||[])[i];
  if(!x)return;
  if(!reqPuedeVerificar()){notif('Solo el encargado puede registrar el cumplimiento','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  window._reqPaletaSel=x;
  const esGest=reqPalEsGestionItem(x);
  if(tit)tit.textContent=esGest?'✔ Registrar gestión':'✔ Requerimiento cumplido';
  if(modal){modal.classList.remove('enviar-modal-only');modal.classList.remove('task-modal-wide');}
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r);box-sizing:border-box';
  if(esGest)body.innerHTML='<div style="max-width:520px">'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px"><strong>'+escAttr(x.exp)+'</strong> · '+escAttr(x.nombre||'')+'<br>'+escAttr(x.titulo)+(x.vence?' · '+(x.fuente==='acto'?'vigencia':'vencimiento')+' '+escAttr(typeof fmtF==='function'?fmtF(x.vence):x.vence):'')+'</div>'+
    '<div class="fld" style="margin-bottom:10px"><label>¿Qué gestión se hizo? <span class="req-star">*</span></label><textarea id="req-pal-nota" maxlength="500" placeholder="'+(x.fuente==='acto'?'Ej.: se requirió al titular la solicitud de renovación con oficio N°…':'Ej.: se envió cobro persuasivo con oficio N°…')+'" style="'+inp+';min-height:70px"></textarea></div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">No modifica fechas ni pagos. Sale de la paleta y vuelve a aparecer si cambia '+(x.fuente==='acto'?'la vigencia (p. ej. nueva prórroga).':'el vencimiento o entra en mora otra cuota.')+'</div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="reqPaletaConfirmarCumplio()">Confirmar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div></div>';
  else body.innerHTML='<div style="max-width:520px">'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px"><strong>'+escAttr(x.exp)+'</strong> · '+escAttr(x.nombre||'')+'<br>'+escAttr(x.titulo)+(x.vence?' · límite '+escAttr(typeof fmtF==='function'?fmtF(x.vence):x.vence):'')+'</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Fecha de cumplimiento <span class="req-star">*</span></label><input type="date" id="req-pal-fecha" value="'+escAttr(reqHoy())+'" max="'+escAttr(reqHoy())+'" style="'+inp+'"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>¿Cómo cumplió? <span class="req-star">*</span></label><textarea id="req-pal-nota" maxlength="500" placeholder="Ej.: radicó los documentos solicitados con el oficio N°…" style="'+inp+';min-height:70px"></textarea></div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Se quita la marca de incumplimiento, queda en el historial y el requerimiento sale de la paleta.</div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="reqPaletaConfirmarCumplio()">Confirmar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'reqPaletaCumplio'};
  setTimeout(function(){const n=document.getElementById('req-pal-nota');if(n)n.focus();},50);
}
function reqPaletaConfirmarCumplio(){
  const x=window._reqPaletaSel;
  if(!x){notif('Vuelva a abrir el requerimiento','err');return;}
  if(reqPalEsGestionItem(x)){
    const notaG=String((document.getElementById('req-pal-nota')||{}).value||'').trim().slice(0,500);
    if(!notaG){notif('Escriba qué gestión se hizo','err');return;}
    if(!reqPuedeVerificar()){notif('Solo el encargado puede registrar la gestión','err');return;}
    const eG=typeof getExpById==='function'?getExpById(x.exp):null;
    if(!_reqPalMarcarGestion(eG,x,{desc:notaG})){notif('No se encontró el registro; recargue e intente de nuevo','err');return;}
    window._reqPaletaSel=null;
    if(typeof closeTaskModal==='function')closeTaskModal();
    notif('Gestión registrada — sale de la paleta','ok');
    _reqRefrescarVistas();
    return;
  }
  const fecha=String((document.getElementById('req-pal-fecha')||{}).value||'').trim();
  const nota=String((document.getElementById('req-pal-nota')||{}).value||'').trim().slice(0,500);
  if(!fecha){notif('Indique la fecha de cumplimiento','err');return;}
  if(fecha>reqHoy()){notif('La fecha de cumplimiento no puede ser futura','err');return;}
  if(!nota){notif('Escriba cómo cumplió el requerimiento','err');return;}
  if(!reqRegistrarVerificacion(x,'cumplio',{fecha:fecha,nota:nota}))return;
  window._reqPaletaSel=null;
  if(typeof closeTaskModal==='function')closeTaskModal();
  notif('Requerimiento marcado como cumplido','ok');
  _reqRefrescarVistas();
}
function _reqTaskIds(e){
  return ((e&&e.tasks)||[]).filter(function(t){return t&&t.id;}).map(function(t){return String(t.id);});
}
/** 📌 Abre «Actividades asignadas» del expediente; al guardar una actividad nueva el requerimiento queda gestionado. */
function reqPaletaAsignar(i){
  const x=(window._reqPaletaEntries||[])[i];
  if(!x)return;
  const e=typeof getExpById==='function'?getExpById(x.exp):null;
  if(!e){notif('Solo disponible para requerimientos de un expediente','err');return;}
  if(!reqPuedeVerificar()){notif('Solo el encargado puede asignar actividades','err');return;}
  window._reqGestionCtx={key:x.key,exp:String(e._exp),antes:_reqTaskIds(e),ts:Date.now()};
  _reqGestionWatchStart();
  if(typeof openActividadesAsignadasDesdeRevision==='function')openActividadesAsignadasDesdeRevision(x.exp,x.taskId||'');
  else if(typeof editarExp==='function')editarExp(x.exp);
  notif('Añada la actividad y guarde el expediente: saldrá de la paleta','ok');
}
function _reqGestionWatchStart(){
  if(window._reqGestionTimer)return;
  window._reqGestionTimer=setInterval(reqGestionRevisar,3000);
}
function _reqGestionWatchStop(){
  if(window._reqGestionTimer){clearInterval(window._reqGestionTimer);window._reqGestionTimer=null;}
}
function reqGestionRevisar(){
  const ctx=window._reqGestionCtx;
  if(!ctx){_reqGestionWatchStop();return;}
  if(Date.now()-ctx.ts>REQ_GESTION_CTX_TTL_MS){window._reqGestionCtx=null;_reqGestionWatchStop();return;}
  const e=typeof getExpById==='function'?getExpById(ctx.exp):null;
  if(!e)return;
  const antes={};
  (ctx.antes||[]).forEach(function(id){antes[id]=true;});
  const nuevas=(e.tasks||[]).filter(function(t){return t&&t.id&&!t.eliminada&&!antes[String(t.id)];});
  if(!nuevas.length)return;
  window._reqGestionCtx=null;
  _reqGestionWatchStop();
  if(reqRegistrarGestion(ctx,e,nuevas)){
    notif('Gestionado con la actividad asignada — sale de la paleta Requerimientos','ok');
    _reqRefrescarVistas();
  }
}
function reqRegistrarGestion(ctx,e,nuevas){
  try{
    const ids=nuevas.map(function(t){return String(t.id);});
    const desc=nuevas.map(function(t){
      const rs=typeof getTaskResponsables==='function'?getTaskResponsables(t):[t.responsable].filter(Boolean);
      return String(t.actividad||t.desc||'Actividad')+(rs&&rs.length?' → '+rs.join(', '):'');
    }).join(' · ').slice(0,300);
    if(/^[af]\|/.test(String(ctx.key||''))){
      const extra=[];
      _reqPalEntradasExp(e,extra);
      const g=extra.find(function(y){return y.key===ctx.key;});
      return g?_reqPalMarcarGestion(e,g,{desc:'Se asignó '+desc,taskIds:ids}):false;
    }
    const lista=[];
    _reqEntradasExp(e,lista);
    const x=lista.find(function(y){return y.key===ctx.key;});
    if(!x||x.cumplido||x.gestionado)return false;
    const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
    const en=new Date().toISOString();
    const hist=function(tk){
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({tipo:'gestion_requerimiento',fecha:reqHoy(),ts:Date.now(),por:por,nota:'Requerimiento vencido gestionado: se asignó '+desc});
    };
    if(x.fuente==='concepto'){
      const arr=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
      let idx=-1;
      if(x.conceptoReqId)idx=arr.findIndex(function(c){return c&&String(c.conceptoReqId||'')===x.conceptoReqId;});
      else if(typeof x.idx==='number'&&arr[x.idx]&&!arr[x.idx].conceptoReqId)idx=x.idx;
      if(idx<0)return false;
      const c=arr[idx];
      if(!c.conceptoReqId)c.conceptoReqId='creq_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      c.reqGestionTaskIds=ids;c.reqGestionPor=por;c.reqGestionEn=en;c.reqGestionDesc=desc;
      e._conceptos_seg=JSON.stringify(arr);
      const tLink=x.taskId&&typeof getTaskAny==='function'?getTaskAny(e._exp,x.taskId):null;
      if(tLink&&typeof mutateTask==='function')mutateTask(e._exp,x.taskId,hist);
      else _reqPersistExp(e);
    }else{
      if(typeof mutateTask!=='function'||!mutateTask(x.ref,x.taskId,function(tk){
        const tc=Object.assign({},tk.terminoCumpl||{});
        tc.gestionTaskIds=ids;tc.gestionPor=por;tc.gestionEn=en;tc.gestionDesc=desc;
        tk.terminoCumpl=tc;
        hist(tk);
      }))return false;
    }
    if(typeof logAudit==='function')
      logAudit('Requerimiento vencido gestionado ['+x.exp+'] '+x.titulo+' — '+desc,'expedientes',x.exp);
    return true;
  }catch(err){
    console.warn('reqRegistrarGestion:',err);
    return false;
  }
}

window.htmlTerminoCumplBlock=htmlTerminoCumplBlock;
window.syncTerminoCumplUi=syncTerminoCumplUi;
window.collectTerminoCumplFromUi=collectTerminoCumplFromUi;
window.aplicarTerminoCumplimiento=aplicarTerminoCumplimiento;
window.proponerTerminoCumplimiento=proponerTerminoCumplimiento;
window.tramiteAprobarRevisionFinalConTermino=tramiteAprobarRevisionFinalConTermino;
window.reqPqrsAplicarTermino=reqPqrsAplicarTermino;
window.reqPqrsProponerTermino=reqPqrsProponerTermino;
window.pqrsAprobarRevisionFinalConTermino=pqrsAprobarRevisionFinalConTermino;
window.reqActividadExcluida=reqActividadExcluida;
window.reqTareasTerminoIncumplido=reqTareasTerminoIncumplido;
window.renderConsolidadoRequerimientosCard=renderConsolidadoRequerimientosCard;
window.openRequerimientosBandeja=openRequerimientosBandeja;
window.renderRequerimientosBandeja=renderRequerimientosBandeja;
window.reqBandejaAccion=reqBandejaAccion;
window.reqBandejaConfirmar=reqBandejaConfirmar;
window.reqBandejaExportarCsv=reqBandejaExportarCsv;
window.reqVerifSyncActividadAgrupada=reqVerifSyncActividadAgrupada;
window.reqEsActividadAgrupada=reqEsActividadAgrupada;
window.reqActividadAgrupadaToolbarHtml=reqActividadAgrupadaToolbarHtml;
window.reqPalGestionAttr=reqPalGestionAttr;
window.reqPalGestionFromRow=reqPalGestionFromRow;
window.reqPaletaVisible=reqPaletaVisible;
window.reqPaletaContar=reqPaletaContar;
window.reqPaletaRowsHtml=reqPaletaRowsHtml;
window.reqPaletaVer=reqPaletaVer;
window.reqPaletaCumplio=reqPaletaCumplio;
window.reqPaletaConfirmarCumplio=reqPaletaConfirmarCumplio;
window.reqPaletaAsignar=reqPaletaAsignar;
window.reqGestionRevisar=reqGestionRevisar;
