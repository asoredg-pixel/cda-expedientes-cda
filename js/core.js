// =============================================================================
// core.js - Nucleo de logica de negocio SST
// Contiene: PQRS helpers, Agenda, Tareas core, Locks/Audit, Usuarios,
//           Soportes/Documentos, Bandeja, Expediente display, Gantt,
//           Personas catalog, Info tecnica, UI helpers.
// Depende de: constants.js, utils.js, state.js, persistence.js, roles.js,
//             config-store.js (runtime).
// Cargar despues de config-store.js y antes de los modulos de dominio.
// =============================================================================
function abrirPqrsModalPrep(){
  window._pqrsModalOpen=true;
  const ov=document.getElementById('task-modal-overlay');
  if(ov){ov.style.zIndex='99999';document.body.appendChild(ov);}
  const pp=document.getElementById('pqrs-side-panel');
  const po=document.getElementById('pqrs-side-overlay');
  if(pp)pp.style.pointerEvents='none';
  if(po)po.style.pointerEvents='none';
}
function cerrarPqrsModalPrep(){
  window._pqrsModalOpen=false;
  const ov=document.getElementById('task-modal-overlay');
  if(ov)ov.style.zIndex='';
  const pp=document.getElementById('pqrs-side-panel');
  const po=document.getElementById('pqrs-side-overlay');
  if(pp)pp.style.pointerEvents='';
  if(po)po.style.pointerEvents='';
}
function pqrsBtnEdit(expId,label,extraCls){
  const id=String(expId||'').trim();
  if(!id)return'';
  return '<button type="button" class="btn bsm'+(extraCls?' '+extraCls:'')+'" data-pqrs-edit="'+escAttr(id)+'" onclick="event.stopPropagation();openEditPqrsSecretariaModal(\''+jsStr(id)+'\')">'+escAttr(label||'Editar')+'</button>';
}
function ocCall(fn){
  const args=[].slice.call(arguments,1).map(v=>"'"+jsStr(String(v==null?'':v))+"'");
  return 'event.stopPropagation();'+fn+'('+args.join(',')+')';
}
function expBtnEditHtml(expId,opts){
  opts=opts||{};
  const id=String(expId||'').trim();
  if(!id)return'';
  const cls='btn bsm'+(opts.cls?' '+opts.cls:'')+(opts.bic!==false?' bic':'');
  const lbl=opts.label!==undefined?opts.label:'✏️';
  const title=escAttr(opts.title||'Editar');
  const extra=opts.suffix||'';
  return '<button type="button" class="'+cls+'" data-sst-action="editarExp" data-sst-exp="'+escAttr(id)+'" title="'+title+'">'+lbl+extra+'</button>';
}
function expBtnArchHtml(expId,opts){
  opts=opts||{};
  const id=String(expId||'').trim();
  if(!id)return'';
  const cls='btn bsm'+(opts.cls?' '+opts.cls:'');
  const lbl=opts.label||'📁 Archivos';
  const title=escAttr(opts.title||'Ver documentos y enlaces Drive');
  return '<button type="button" class="'+cls+'" data-sst-action="openConsultaArchivosModal" data-sst-exp="'+escAttr(id)+'" title="'+title+'">'+lbl+'</button>';
}
function actBtnEditHtml(expId,taskId,title){
  const exp=String(expId||'').trim();
  const task=String(taskId||'').trim();
  if(!exp||!task)return'';
  return '<button type="button" class="btn bsm bic" data-sst-action="openEditarActTaskModal" data-sst-exp="'+escAttr(exp)+'" data-sst-task="'+escAttr(task)+'" title="'+escAttr(title||'Gestionar actividad')+'">✏️</button>';
}
function actBtnLupaHtml(expId,taskId,title){
  const exp=String(expId||'').trim();
  const task=String(taskId||'').trim();
  if(!exp)return'';
  return '<button type="button" class="btn bsm bic" data-sst-action="abrirConsultaExpPanelDesdeAct" data-sst-exp="'+escAttr(exp)+'" data-sst-task="'+escAttr(task)+'" title="'+escAttr(title||'Ver expediente')+'">🔍</button>';
}
function clickTargetEl(ev){
  let t=ev&&ev.target;
  while(t&&t.nodeType!==1)t=t.parentNode;
  return t;
}
function sstExpIdFromEl(el){
  if(!el)return'';
  return String(el.getAttribute('data-sst-exp')||el.getAttribute('data-exp-edit')||el.getAttribute('data-exp-arch')||el.getAttribute('data-con-exp-asoc')||el.getAttribute('data-con-panel-exp')||el.getAttribute('data-con-panel-edit')||el.getAttribute('data-act-lupa')||el.getAttribute('data-act-edit')||'').trim();
}
function sstTaskIdFromEl(el){
  if(!el)return'';
  return String(el.getAttribute('data-sst-task')||el.getAttribute('data-act-task')||'').trim();
}
function sstActionFromEl(el){
  if(!el)return'';
  const action=String(el.getAttribute('data-sst-action')||'').trim();
  if(action)return action;
  if(el.hasAttribute('data-exp-edit'))return'editarExp';
  if(el.hasAttribute('data-exp-arch'))return'openConsultaArchivosModal';
  if(el.hasAttribute('data-act-edit'))return'openEditarActTaskModal';
  if(el.hasAttribute('data-act-lupa'))return'abrirConsultaExpPanelDesdeAct';
  if(el.hasAttribute('data-con-exp-asoc'))return'abrirConsultaExpAsociado';
  if(el.hasAttribute('data-con-panel-exp'))return'conPanelSelExp';
  if(el.hasAttribute('data-con-panel-edit'))return'conPanelActivarEdicion';
  return'';
}
function sstRunAction(action,el){
  if(!action||!el)return;
  const exp=sstExpIdFromEl(el);
  const task=sstTaskIdFromEl(el);
  try{
    switch(action){
      case'editarExp':editarExp(exp);break;
      case'openConsultaArchivosModal':openConsultaArchivosModal(exp);break;
      case'openEditarActTaskModal':openEditarActTaskModal(exp,task);break;
      case'abrirConsultaExpPanelDesdeAct':abrirConsultaExpPanelDesdeAct(exp,task);break;
      case'abrirConsultaExpAsociado':abrirConsultaExpAsociado(exp);break;
      case'conPanelSelExp':conPanelSelExp(exp);break;
      case'conPanelActivarEdicion':conPanelActivarEdicion(exp);break;
      case'openAnadirDocTramiteModal':openAnadirDocTramiteModal(exp);break;
      case'openAsociarExpedientePqrsModal':openAsociarVinculoPqrsModal(exp,'tramite');break;
      case'openAsociarVinculoPqrsModal':openAsociarVinculoPqrsModal(exp,el.getAttribute('data-sst-mode')||'pqrs');break;
      case'openMarcarPqrsInformativaModal':openMarcarPqrsInformativaModal(exp);break;
      default:console.warn('Acción UI no reconocida:',action);
    }
  }catch(err){
    console.error('sstRunAction',action,err);
    notif('No se pudo completar la acción: '+(err&&err.message?err.message:action),'err');
  }
}
function handleSstUiClick(ev){
  const t=clickTargetEl(ev);
  if(!t||!t.closest)return;
  const hit=t.closest('[data-sst-action],[data-exp-edit],[data-exp-arch],[data-act-edit],[data-act-lupa],[data-con-exp-asoc],[data-con-panel-exp],[data-con-panel-edit]');
  if(!hit)return;
  ev.preventDefault();
  ev.stopPropagation();
  const action=sstActionFromEl(hit);
  if(action)sstRunAction(action,hit);
}
function ensureOverlaysClosed(){
  ['con-side-overlay','task-modal-overlay','confirm-prec-overlay','pqrs-side-overlay','act-agenda-overlay'].forEach(function(id){
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.remove('on');
  });
  ['con-side-panel','pqrs-side-panel','act-agenda-panel'].forEach(function(id){
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.remove('on','con-panel-editing');
  });
}
function initSstUiDelegation(){
  if(window._sstUiDelegation)return;
  window._sstUiDelegation=true;
  window._expUiDelegation=true;
  document.addEventListener('click',handleSstUiClick,false);
}
function initExpUiDelegation(){initSstUiDelegation();}
initSstUiDelegation();
function restoreCfgDeptoUsuario(){
  syncCfgToStore();
  if(deptoActivo==='jurisdiccional'||deptoActivo==='responsables'){
    if(deptoCfg)setCfgPtr(deptoCfg);
  }else if(deptoActivo)setCfgPtr(deptoActivo);
}
function initPqrsUiDelegation(){
  if(window._pqrsUiDelegation)return;
  window._pqrsUiDelegation=true;
  document.addEventListener('click',function(ev){
    const saveBtn=ev.target.closest('[data-pqrs-edit-submit]');
    if(saveBtn){
      ev.preventDefault();ev.stopPropagation();
      const expId=saveBtn.getAttribute('data-pqrs-edit-submit');
      if(expId)submitEditPqrsSecretaria(expId);
    }
  },true);
}
function finalizarTareasPqrsAlCerrar(e,nota){
  if(!e||!Array.isArray(e.tasks))return;
  nota=nota||'PQRSD respondida y cerrada';
  const hoyStr=hoy();
  e.tasks.forEach((t,i)=>{
    t=normalizeTask(t);
    if(t.eliminada||!String(t.actividad||'').startsWith('Atender PQRSD'))return;
    if(estadoTask(t)==='Atendida')return;
    t.fechaReportada=hoyStr;
    t.fechaAtendida=hoyStr;
    t.estado='Atendida';
    if(!Array.isArray(t.historial))t.historial=[];
    t.historial.push({tipo:'cierre_pqrs',fecha:hoyStr,por:pqrsComentarioAutor(),nota:nota});
    e.tasks[i]=t;
  });
}
function cancelarTareasPqrsNca(e,nota){
  if(!e||!Array.isArray(e.tasks))return 0;
  nota=nota||'PQRSD trasladada — actividad cancelada';
  let n=0;
  for(let i=0;i<e.tasks.length;i++){
    let t=normalizeTask(e.tasks[i]);
    if(!t||t.eliminada)continue;
    if(!String(t.actividad||'').startsWith('Atender PQRSD'))continue;
    if(estadoTask(t)==='Atendida')continue;
    t.eliminada=true;
    if(!Array.isArray(t.historial))t.historial=[];
    t.historial.push({tipo:'cancelacion_traslado',fecha:hoy(),por:pqrsComentarioAutor(),nota:nota});
    e.tasks[i]=t;
    n++;
  }
  return n;
}
function pqrsTaskVisibleEnActividades(t,e,usuario){
  if(!taskEsAtenderPqrs(t,e))return true;
  e=normalizePqrsOficinaFields(e);
  if(t.eliminada)return false;
  if(pqrsEstaCerrada(e)){
    if(usuario&&taskUsuarioEsAsignado(t,usuario)&&estadoTask(t)==='Atendida')return true;
    return false;
  }
  const ofi=e._pqrs_oficina||'';
  const respOfi=String(e._pqrs_responsable_oficina||'').trim();
  if(!respOfi&&ofi!=='guaviare')return false;
  if(!usuario)return true;
  // El encargado de NCA (guaviare) siempre ve TODAS las tareas PQRSD asignadas a NCA
  const encGuaviare=getEncargadoDepto('guaviare');
  if(ofi==='guaviare'&&encGuaviare&&agendaNorm(usuario)===agendaNorm(encGuaviare))return true;
  // Para responsables específicos, verificar asignación
  if(!taskUsuarioEsAsignado(t,usuario))return false;
  if(respOfi)return agendaNorm(respOfi)===agendaNorm(usuario);
  return ofi==='guaviare';
}
function syncPqrsResponsableDesdeTask(expId,taskId,nuevoResp){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  const t=getTaskAny(expId,taskId);
  if(!e||!t||!taskEsAtenderPqrs(t,e)||e._pqrs_oficina!=='guaviare')return;
  const nr=String(nuevoResp||'').trim();
  if(!nr)return;
  const enc=getEncargadoDepto('guaviare');
  e._pqrs_responsable_oficina=(enc&&agendaNorm(nr)===agendaNorm(enc))?'':nr;
  e._pqrs_estado_oficina='asignado';
}
function calcVenceDesde(fecha,plazo){
  if(!fecha||plazo===''||plazo===null||plazo===undefined)return'';
  const n=Number(plazo);if(isNaN(n))return'';
  const d=new Date(fecha+'T00:00:00');d.setDate(d.getDate()+n);
  return d.toISOString().split('T')[0];
}
function diasEntre(f1,f2){
  if(!f1||!f2)return 0;
  const a=new Date(f1+'T00:00:00'),b=new Date(f2+'T00:00:00');
  return Math.round((b-a)/86400000);
}
// PQRS_TRAM_VIRTUAL → js/constants.js
function getPqrsPlazoDias(e){
  const tram=getTram((e&&e._tramite)||'',e)||ensureTramPqrsCfg((e&&e._depto)||'guaviare');
  return tram&&tram.plazo?Number(tram.plazo):15;
}
function getPqrsVenceFecha(e){
  e=normalizePqrsOficinaFields(e);
  const custom=String(e._pqrs_fecha_termino||'').trim();
  if(custom)return custom;
  const plazo=getPqrsPlazoDias(e);
  const inicio=e._fecha_solicitud||e._fecha||hoy();
  return calcVenceDesde(inicio,plazo);
}
function pqrsPlazoTaskMeta(e){
  const plazoInicio=e._fecha_solicitud||e._fecha||hoy();
  const vence=getPqrsVenceFecha(e);
  const custom=String(e._pqrs_fecha_termino||'').trim();
  let plazoDias;
  if(custom&&vence)plazoDias=Math.max(1,diasEntre(plazoInicio,vence));
  else{
    const plazoTram=getTram(e._tramite,e)||ensureTramPqrsCfg('guaviare');
    plazoDias=plazoTram?Number(plazoTram.plazo)||15:15;
  }
  return{plazoInicio,vence,plazoDias};
}
function getPqrsPlazoInfo(e){
  e=normalizePqrsOficinaFields(e);
  const inicio=e._fecha_solicitud||e._fecha||hoy();
  const vence=getPqrsVenceFecha(e);
  const custom=String(e._pqrs_fecha_termino||'').trim();
  const plazo=custom&&vence?Math.max(1,diasEntre(inicio,vence)):getPqrsPlazoDias(e);
  const hoyStr=hoy();
  const diasTrans=dias(inicio);
  const diasRest=vence?diffDias(vence):0;
  const pct=plazo?Math.min(100,Math.round(diasTrans/plazo*100)):0;
  let estado='ok';
  if(pqrsEstaCerrada(e)){
    const respF=e._pqrs_respuesta_fecha||hoyStr;
    estado=(vence&&respF>vence)?'over':'ok';
  }else if(vence&&hoyStr>vence)estado='over';
  else if(vence&&diasRest<=Math.max(2,Math.ceil(plazo*0.25)))estado='warn';
  return{plazo,inicio,vence,diasTrans,diasRest,pct,estado};
}
function pqrsEstaAtrasada(e){
  if(pqrsEstaCerrada(e))return false;
  const p=getPqrsPlazoInfo(e);
  return !!(p.vence&&hoy()>p.vence);
}
function pqrsRespuestaEnTermino(e){
  if(!pqrsEstaCerrada(e))return null;
  const p=getPqrsPlazoInfo(e);
  const respF=e._pqrs_respuesta_fecha||hoy();
  return p.vence?respF<=p.vence:true;
}
function getPqrsEstadoDisplay(e){
  e=normalizePqrsOficinaFields(e);
  if(pqrsEstaCerrada(e)){
    if(e._pqrs_informativa)return 'Atendida (informativa)';
    return pqrsRespuestaEnTermino(e)?'Atendida':'Atendido extemporánea';
  }
  if(pqrsPendienteTraslado(e))return 'Pendiente traslado';
  if(pqrsEstaAtrasada(e))return 'Atrasada';
  const ofi=e._pqrs_oficina||'';
  if(!ofi||ofi==='secretaria')return 'Solicitud';
  return 'En trámite';
}
function renderPqrsPlazoBarHtml(e){
  const p=getPqrsPlazoInfo(e);
  if(!p.vence)return'';
  const cls=p.estado==='over'?'over':p.estado==='warn'?'warn':'ok';
  const lbl=p.estado==='over'?'Plazo vencido':p.estado==='warn'?'Próximo a vencer':'A tiempo';
  const extra=pqrsEstaCerrada(e)?(pqrsRespuestaEnTermino(e)?' · Respondida en término':' · Respondida fuera de término'):(' · '+Math.max(0,p.diasRest)+' día(s) restantes');
  const fs=e._fecha_solicitud||'';
  const rad=e._fecha||'';
  const plazoLbl=fs?('Solicitud '+fmtF(fs)+(rad&&rad!==fs?' · Radicado '+fmtF(rad):'')):('Radicado '+fmtF(p.inicio));
  const plazoNota=e._pqrs_fecha_termino?' · término indicado en oficio':' · plazo legal 15 días';
  return '<div class="pqrs-plazo-wrap"><div class="pqrs-plazo-lbl"><span><strong>'+lbl+'</strong> · '+plazoLbl+' → vence '+fmtF(p.vence)+'</span><span>'+p.pct+'%</span></div>'+
    '<div class="pqrs-plazo-track"><div class="pqrs-plazo-fill '+cls+'" style="width:'+p.pct+'%"></div></div>'+
    '<div style="font-size:10px;color:var(--tx3)">Plazo: '+p.plazo+' día(s)'+plazoNota+extra+'</div></div>';
}
function pqrsPrioritariaBadge(e){
  return e&&e._pqrs_prioritaria?'<span class="bdg bdg-prior" title="Prioritaria">⚡ Prioritaria</span>':'';
}
function pqrsInformativaBadge(e){
  return e&&e._pqrs_informativa?'<span class="bdg" style="background:var(--sf2);color:var(--tx2);border:1px solid var(--bd)" title="Sin respuesta formal requerida">ℹ Informativa</span>':'';
}
function medioNotificacionRespLabel(v){
  if(v==='electronica')return 'Correo';
  if(v==='fisica')return 'Física';
  if(v==='whatsapp')return 'WhatsApp';
  if(v==='pagina')return 'Por página web';
  if(v==='aviso')return 'Por aviso';
  return medioNotificacionLabel(v)||v||'—';
}
function medioNotificacionRespFlagHtml(v){
  return medioNotificacionFlagHtml(v,false)||'';
}
function pqrsEstaCerrada(e){
  return !!(e&&(e._pqrs_estado_oficina==='cerrado'||e._estado==='Atendido'));
}

// ── Workflow de respuesta PQRSD ────────────────────────────────────────────────
function getPqrsWorkflow(e){
  if(!e)return{fase:PQRS_WF.SIN_RESPUESTA};
  let wf=null;
  try{ wf=e._pqrs_workflow&&typeof e._pqrs_workflow==='string'?JSON.parse(e._pqrs_workflow):e._pqrs_workflow; }catch(x){}
  if(!wf||typeof wf!=='object')wf={};
  if(!wf.fase)wf.fase=pqrsEstaCerrada(e)?PQRS_WF.CERRADA:PQRS_WF.SIN_RESPUESTA;
  return wf;
}
function setPqrsWorkflow(e,patch){
  const cur=getPqrsWorkflow(e);
  const next={...cur,...patch};
  e._pqrs_workflow=JSON.stringify(next);
  // Sync legacy fields
  if(next.fase===PQRS_WF.CERRADA){
    e._pqrs_estado_oficina='cerrado';
    e._estado='Atendido';
    e._fecha_res=next.fecha_respuesta||hoy();
    const fe=getFechasEstado(e);
    fe.Atendido=e._fecha_res;
    if(!fe['En trámite'])fe['En trámite']=fe.Solicitud||e._fecha||e._fecha_res;
    e._fechas_estado=JSON.stringify(fe);
    e.historial=rebuildHistorial(e,e.historial||[]);
  }
  if(next.oficio)e._pqrs_respuesta_oficio=next.oficio;
  if(next.fecha_respuesta)e._pqrs_respuesta_fecha=next.fecha_respuesta;
  if(next.canal)e._pqrs_respuesta_medio=next.canal;
  if(next.cuerpo)e._pqrs_respuesta_nota=next.cuerpo;
  if(next.documentos&&Array.isArray(next.documentos)){
    const links=next.documentos.filter(d=>d.driveLink).map(d=>d.driveLink);
    if(links.length)e._pqrs_respuesta_link=links[0];
    if(links.length>1)e._pqrs_respuesta_links=links;
  }
}
function pqrsWorkflowFase(e){return getPqrsWorkflow(e).fase||PQRS_WF.SIN_RESPUESTA;}
function pqrsEnRevisionNca(e){return pqrsWorkflowFase(e)===PQRS_WF.PENDIENTE_REVISION;}
function pqrsEnGestionVital(e){return pqrsWorkflowFase(e)===PQRS_WF.VITAL_GESTION;}
function pqrsListaParaEnvio(e){const f=pqrsWorkflowFase(e);return f===PQRS_WF.LISTA_ENVIO||f===PQRS_WF.PENDIENTE_NOTIF;}
// Quién puede marcar respuesta (directo, sin revisión NCA)
function puedeResponderDirecto(e){
  if(!e||pqrsEstaCerrada(e))return false;
  if(esSecretaria())return e._pqrs_oficina==='secretaria';
  if(esModoOficinaDeguv())return e._pqrs_oficina===deptoActivo;
  // NCA encargado: responde directo (él mismo se revisa)
  if(esNcaDeguv()||esOficinaPqrsNca())return e._pqrs_oficina==='guaviare';
  return false;
}
function puedeTrasladarPqrsSecretaria(e){
  return !!(e&&esPqrsSecretaria(e)&&esSecretaria()&&!pqrsEstaCerrada(e));
}
function puedeEditarPqrsSecretaria(e){
  if(!e||!esSecretaria()||pqrsEstaCerrada(e))return false;
  e=normalizePqrsOficinaFields(e);
  return esPqrsSecretaria(e)||(!!e._pqrs_oficina&&esTramitePqrs(e._tramite));
}
function devolverPqrsASecretaria(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!esPqrsSecretaria(e)){notif('PQRSD no encontrado','err');return;}
  if(!esModoOficinaDeguv()||e._pqrs_oficina!==deptoActivo){notif('No puede devolver esta PQRSD','err');return;}
  if(pqrsEstaCerrada(e)){notif('La PQRSD ya fue respondida','err');return;}
  const anterior=e._pqrs_oficina||'';
  e._pqrs_oficina='secretaria';
  e._pqrs_traslado_fecha=hoy();
  e._pqrs_traslado_por=labelOficina(deptoActivo);
  e._pqrs_estado_oficina='pendiente';
  e._pqrs_responsable_oficina='';
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Devolución a Secretaría DEGUV',oficina:'secretaria',oficinaAnterior:anterior,por:e._pqrs_traslado_por});
  if(anterior&&anterior!=='secretaria')cancelarTareasPqrsNca(e,'Devolución a Secretaría — actividad cancelada');
  persistExpedienteGranular(e);
  notif('PQRSD devuelta a Secretaría','ok');
  cerrarPqrsSidePanel();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
}
function openPqrsSidePanel(expId){
  expId=String(expId||'').trim();
  if(!expId)return;
  window._pqrsSideExp=expId;
  if(esSecretaria())window._secPqrsSelExp=expId;
  else window._pqrsOfiSelExp=expId;
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  const panel=document.getElementById('pqrs-side-panel');
  const overlay=document.getElementById('pqrs-side-overlay');
  const body=document.getElementById('pqrs-side-body');
  const tit=document.getElementById('pqrs-side-tit');
  const sub=document.getElementById('pqrs-side-sub');
  if(!e||!panel||!body)return;
  if(tit)tit.textContent=expId;
  if(sub)sub.textContent=(e._tipo_solicitud||'PQRSD')+' · '+labelOficina(e._pqrs_oficina||'');
  body.innerHTML=htmlPqrsSidePanelContent(e);
  if(overlay)overlay.classList.add('on');
  panel.classList.add('on');
  if(esSecretaria())renderSecretariaPqrs();
  else if(esModoOficinaDeguv()||esVistaPqrsOficinaDeguv())renderPqrsOficinaInbox();
}
function cerrarPqrsSidePanel(){
  const panel=document.getElementById('pqrs-side-panel');
  const overlay=document.getElementById('pqrs-side-overlay');
  if(overlay)overlay.classList.remove('on');
  if(panel)panel.classList.remove('on');
  window._pqrsSideExp=null;
}
function htmlPqrsSidePanelContent(e){
  const opts={showDelete:esSecretaria(),showEdit:esSecretaria(),showChat:false,sidePanel:true};
  let extra='';
  const fase=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):PQRS_WF.SIN_RESPUESTA;
  const wf=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
  // Workflow status section
  if(fase!==PQRS_WF.SIN_RESPUESTA&&fase!==PQRS_WF.CERRADA){
    const badge=typeof htmlNcaRevisionBadge==='function'?htmlNcaRevisionBadge(e):'';
    let acciones='';
    const id=jsStr(e._exp);
    if(fase===PQRS_WF.PENDIENTE_REVISION&&(esNcaDeguv()||esOficinaPqrsNca()||esAdministrador()))
      acciones+='<button type="button" class="btn bsm" style="background:#6d3fa8;color:#fff;margin-top:6px" onclick="openNcaRevisionModal(\''+id+'\')">⏳ Revisar entrega del responsable</button> ';
    if(fase===PQRS_WF.VITAL_GESTION&&(typeof esCargoVital==='function'&&esCargoVital()||esAdministrador()))
      acciones+='<button type="button" class="btn bsm" style="background:#1a7a4a;color:#fff;margin-top:6px" onclick="openVitalBandejaModal(\''+id+'\')">📄 Gestionar firma Director (VITAL)</button> ';
    if((fase===PQRS_WF.PENDIENTE_NOTIF||fase===PQRS_WF.LISTA_ENVIO)&&(esNcaDeguv()||esOficinaPqrsNca()||typeof esCargoVital==='function'&&esCargoVital()||esAdministrador()))
      acciones+='<button type="button" class="btn bsm bp" style="margin-top:6px" onclick="abrirNotifPqrsExpId(\''+id+'\')">📧 Enviar notificación al ciudadano</button> ';
    extra='<div style="padding:8px 10px;background:var(--bll);border:1px solid var(--bl);border-radius:var(--r);margin-bottom:8px">'+
      '<div style="font-size:11px;font-weight:600;margin-bottom:4px">Estado de la respuesta</div>'+badge+
      (wf.entregado_por?'<div style="font-size:11px;color:var(--tx2);margin-top:4px">Entregado por: <strong>'+escAttr(wf.entregado_por)+'</strong></div>':'')+
      (wf.cuerpo?'<div style="font-size:11px;color:var(--tx2);margin-top:4px;white-space:pre-wrap">'+escAttr(wf.cuerpo.slice(0,200))+(wf.cuerpo.length>200?'…':'')+'</div>':'')+
      acciones+
      '</div>';
  }
  return renderPqrsPlazoBarHtml(e)+extra+htmlPqrsOficinaDetalleCore(e,opts);
}
function puedeMarcarPqrsRespondida(e){
  if(!e||pqrsEstaCerrada(e))return false;
  const fase=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):PQRS_WF.SIN_RESPUESTA;
  // Allow direct response only if sin_respuesta or rechazada
  if(fase!==PQRS_WF.SIN_RESPUESTA&&fase!==PQRS_WF.RECHAZADA)return false;
  if(esSecretaria())return e._pqrs_oficina==='secretaria';
  if(esModoOficinaDeguv())return e._pqrs_oficina===deptoActivo;
  // NCA encargado can respond directly (he is encargado + responsable)
  if(esNcaDeguv()||esOficinaPqrsNca())return e._pqrs_oficina==='guaviare';
  return false;
}
function puedeGestionarPqrsAsociacion(e){
  if(!e||!esPqrsSecretaria(e)||pqrsEstaCerrada(e))return false;
  if(esModoOficinaDeguv()&&e._pqrs_oficina===deptoActivo)return true;
  if((esOficinaPqrsNca()||esNcaDeguv()||esVistaActividadesDepto())&&e._pqrs_oficina==='guaviare')return true;
  return false;
}
function esPqrsAsocContextoNca(e){
  if(!e)return false;
  return (esOficinaPqrsNca()||esNcaDeguv()||esVistaActividadesDepto())&&e._pqrs_oficina==='guaviare';
}
function esPqrsAsocContextoOficina(e){
  return !!(esModoOficinaDeguv()&&e&&e._pqrs_oficina===deptoActivo);
}
function pqrsAsocBtnHtml(e){
  return pqrsAsocAccionesHtml(e).join(' ');
}
function pqrsAsocAccionesHtml(e){
  if(!puedeGestionarPqrsAsociacion(e))return[];
  const id=jsStr(e._exp);
  if(esPqrsAsocContextoNca(e)){
    return [
      '<button type="button" class="btn bsm" data-sst-action="openAsociarVinculoPqrsModal" data-sst-exp="'+escAttr(e._exp)+'" data-sst-mode="tramite" onclick="event.stopPropagation();SST.openAsociarVinculoPqrsModal(\''+id+'\',\'tramite\')">🔗 Asociar expediente</button>',
      '<button type="button" class="btn bsm" data-sst-action="openAsociarVinculoPqrsModal" data-sst-exp="'+escAttr(e._exp)+'" data-sst-mode="pqrs" onclick="event.stopPropagation();SST.openAsociarVinculoPqrsModal(\''+id+'\',\'pqrs\')">🔗 Asociar PQRSD</button>'
    ];
  }
  return ['<button type="button" class="btn bsm" data-sst-action="openAsociarVinculoPqrsModal" data-sst-exp="'+escAttr(e._exp)+'" data-sst-mode="pqrs" onclick="event.stopPropagation();SST.openAsociarVinculoPqrsModal(\''+id+'\',\'pqrs\')">🔗 Asociar PQRSD</button>'];
}
function pqrsAsocToolbarBtnHtml(e){
  if(!puedeGestionarPqrsAsociacion(e))return'';
  if(esPqrsAsocContextoNca(e)){
    return '<button type="button" class="btn bsm" onclick="SST.openAsociarVinculoPqrsModal(\''+jsStr(e._exp)+'\',\'tramite\')">🔗 Exp.</button>'+
      '<button type="button" class="btn bsm" onclick="SST.openAsociarVinculoPqrsModal(\''+jsStr(e._exp)+'\',\'pqrs\')">🔗 PQRSD</button>';
  }
  return '<button type="button" class="btn bsm" onclick="SST.openAsociarVinculoPqrsModal(\''+jsStr(e._exp)+'\',\'pqrs\')">🔗 Asociar PQRSD</button>';
}
function puedeMarcarPqrsInformativa(e){
  if(!e||!esPqrsSecretaria(e)||pqrsEstaCerrada(e)||e._pqrs_informativa)return false;
  if(esSecretaria())return true;
  if(esModoOficinaDeguv()&&e._pqrs_oficina===deptoActivo)return true;
  if((esOficinaPqrsNca()||esNcaDeguv()||esVistaActividadesDepto())&&e._pqrs_oficina==='guaviare')return true;
  return false;
}
function puedeEliminarPqrs(e){
  if(!e||!esPqrsSecretaria(e))return false;
  if(!esSecretaria()&&!esAdministrador())return false;
  if(pqrsEstaCerrada(e))return esAdministrador()||esAdminActuandoComoSecretaria();
  return true;
}
function pushPqrsAvisoOficina(e,oficinaId,tipo,texto){
  if(!e||!oficinaId||oficinaId==='secretaria')return;
  e=normalizePqrsOficinaFields(e);
  if(!Array.isArray(e._pqrs_avisos_oficina))e._pqrs_avisos_oficina=[];
  e._pqrs_avisos_oficina.push({
    id:'pqa_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    oficina:oficinaId,tipo:tipo||'aviso',fecha:hoy(),ts:Date.now(),
    texto:String(texto||'').trim(),por:pqrsComentarioAutor()
  });
}
function getPqrsOficinaBandejaActiva(){
  if(esModoOficinaDeguv())return deptoActivo;
  if(esOficinaPqrsNca()||esNcaDeguv())return 'guaviare';
  return '';
}
function collectPqrsOficinaBandejaItems(){
  const ofiId=getPqrsOficinaBandejaActiva();
  if(!ofiId)return [];
  const items=[];
  exps.forEach(e=>{
    if(!esPqrsSecretaria(e)||(e._pqrs_oficina||'')!==ofiId)return;
    (e._pqrs_avisos_oficina||[]).forEach(av=>{
      if((av.oficina||'')!==ofiId)return;
      const tipo=av.tipo==='traslado'?'pqrs_traslado':av.tipo==='fecha_solicitud'?'pqrs_fecha_sol':'pqrs_aviso';
      items.push({
        modo:'depto',tipo,exp:e._exp,taskId:'',pqrsAvisoId:av.id,
        fecha:av.fecha||hoy(),responsable:av.por||'Secretaría DEGUV',
        desc:e.f_f1||e._exp,texto:av.texto||''
      });
    });
  });
  return items;
}
function pqrsComentarioAutor(){
  if(esSecretaria())return 'Secretaría DEGUV';
  if(esModoOficinaDeguv())return labelOficina(deptoActivo);
  if(esModoResponsable())return responsableActivo||'Responsable';
  return getEncargadoDepto(deptoActivo)||'Usuario';
}
function openPqrsDocViewer(url,label){
  const p=parseDrivePreviewUrl(url);
  openCiudadanoDocViewer(p.preview||p.url,label||'Documento PQRSD',p.url||url);
}
function htmlPqrsDocumentoBtns(e){
  let h='';
  if(e._pqrs_solicitud_link){
    const p=parseDrivePreviewUrl(e._pqrs_solicitud_link);
    h+='<button type="button" class="btn bsm bp" onclick="openPqrsDocViewer(\''+escAttr(e._pqrs_solicitud_link)+'\',\'Solicitud PQRSD\')">📎 Ver documento</button>';
    h+=' <button type="button" class="btn bsm" onclick="window.open(\''+escAttr(p.url||e._pqrs_solicitud_link)+'\',\'_blank\',\'noopener\')">↗ Abrir en pestaña</button>';
  }
  if(Array.isArray(e._pqrs_gmail_attachments)){
    e._pqrs_gmail_attachments.forEach(function(att){
      if(!att||!att.driveLink||att.driveLink===e._pqrs_solicitud_link)return;
      const lbl=att.nombre||'Anexo';
      h+=' <button type="button" class="btn bsm" onclick="openPqrsDocViewer(\''+escAttr(att.driveLink)+'\',\''+escAttr(lbl)+'\')">📎 '+escAttr(lbl.length>28?lbl.slice(0,26)+'…':lbl)+'</button>';
    });
  }
  if(e._pqrs_solicitud_archivo)h+='<span style="font-size:12px;color:var(--tx2);margin-left:6px">📄 '+escAttr(e._pqrs_solicitud_archivo)+'</span>';
  return h;
}
function htmlPqrsDocumentoConsulta(e){
  const hasAtts=Array.isArray(e._pqrs_gmail_attachments)&&e._pqrs_gmail_attachments.some(a=>a&&a.driveLink&&a.driveLink!==e._pqrs_solicitud_link);
  if(!e._pqrs_solicitud_link&&!e._pqrs_solicitud_archivo&&!hasAtts)return'';
  return '<details class="con-fold"><summary>Documento de la solicitud PQRSD</summary><div class="item-fold-body"><div class="fx" style="gap:6px;flex-wrap:wrap;align-items:center">'+htmlPqrsDocumentoBtns(e)+'</div></div></details>';
}
function debeOcultarPqrsDocSolicitudEnPanel(){
  return esModoResponsable()||esOficinaPqrsNca();
}
function htmlPqrsDocumentoEnPanel(e){
  if(debeOcultarPqrsDocSolicitudEnPanel())return'';
  return htmlPqrsDocumentoConsulta(e);
}
function renderPqrsChatHtml(e){
  const cms=(e._pqrs_comentarios||[]).filter(c=>c&&!c.eliminado);
  const lista=cms.length?cms.map(c=>'<div class="pqrs-chat-cmt"><div class="pqrs-chat-cmt-meta">'+escAttr(c.autor||'')+' · '+fmtF((c.fecha||'').slice(0,10))+'</div>'+escAttr(c.texto||'')+'</div>').join(''):'<div style="font-size:12px;color:var(--tx3);margin-bottom:6px">Sin comentarios en esta PQRSD.</div>';
  return '<div class="pqrs-det-sec"><div class="pqrs-det-k">💬 Comentarios PQRSD</div>'+lista+
    '<div class="task-cmt-form" style="margin-top:8px"><textarea id="pqrs-cmt-input-'+escAttr(e._exp)+'" placeholder="Comentario sobre esta PQRSD (visible para oficinas y NCA)…" style="width:100%;min-height:56px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif"></textarea>'+
    '<button type="button" class="btn bsm bp" style="margin-top:6px" onclick="submitPqrsComentario(\''+escAttr(e._exp)+'\')">Enviar comentario</button></div></div>';
}
function submitPqrsComentario(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e)return;
  const ta=document.getElementById('pqrs-cmt-input-'+expId);
  const txt=ta&&ta.value?ta.value.trim():'';
  if(!txt){notif('Escriba un comentario','err');return;}
  if(!Array.isArray(e._pqrs_comentarios))e._pqrs_comentarios=[];
  e._pqrs_comentarios.push({id:'pc_'+Date.now(),texto:txt,autor:pqrsComentarioAutor(),fecha:hoy()});
  persistExpedienteGranular(e);
  if(ta)ta.value='';
  notif('Comentario registrado','ok');
  refreshPqrsDetalleViews(expId);
}
function refreshPqrsDetalleViews(expId){
  if(window._pqrsSideExp&&document.getElementById('pqrs-side-panel')&&document.getElementById('pqrs-side-panel').classList.contains('on')){
    const e=exps.find(x=>String(x._exp||'').trim()===String(expId||window._pqrsSideExp||'').trim());
    const body=document.getElementById('pqrs-side-body');
    if(e&&body)body.innerHTML=htmlPqrsSidePanelContent(e);
  }
  if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
}
function openPqrsRespuestaModal(expId,opts){
  opts=opts||{};
  const fromGmail=!!opts.fromGmail;
  const gmailMsg=opts.gmailMsg||null;
  let e=expId?exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim()):null;
  if(!fromGmail){
    if(!e||!puedeMarcarPqrsRespondida(e)){notif('No puede registrar respuesta para esta PQRSD','err');return;}
  }else if(e&&(typeof pqrsEstaCerrada==='function'&&pqrsEstaCerrada(e))){
    notif('Esta PQRSD ya está cerrada','err');return;
  }
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  const expLabel=expId||(e?e._exp:'');
  if(tit)tit.textContent=(fromGmail?'Registrar respuesta por correo':'Registrar respuesta')+(expLabel?' · '+expLabel:'');
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('task-modal-wide');}
  const wf=e?getPqrsWorkflow(e):{};
  const ciudEmail=e?pqrsCorreoCiudadano(e):'';
  const mkCan=(v,lbl,ico)=>'<button type="button" class="btn bsm canal-resp-btn" data-val="'+escAttr(v)+'" onclick="setPqrsRespCanal(\''+jsStr(v)+'\')">'+ico+' '+escAttr(lbl)+'</button>';
  const mkTipo=(v,lbl)=>'<button type="button" class="btn bsm tipo-resp-btn" data-val="'+escAttr(v)+'" onclick="setPqrsRespTipo(\''+jsStr(v)+'\')">'+escAttr(lbl)+'</button>';
  const asuntoMail='Respuesta a su '+((e&&e._tipo_solicitud)||'solicitud PQRSD')+' — '+(expLabel||'');
  const usaDriveInst=typeof DRIVE_INST_DEPTOS!=='undefined'&&DRIVE_INST_DEPTOS.has(deptoActivo||deptoCfg||'');
  const adjInfo=usaDriveInst
    ?'<div style="font-size:11px;color:var(--tx2);margin-top:4px">Los archivos se suben a la carpeta <em>Respuesta</em> de la PQRSD en Drive. Conecte Gmail/Drive si va a adjuntar.</div>'
    :'<div style="font-size:11px;color:var(--tx2);margin-top:4px">Pegue el link de Drive de su carpeta personal.</div>';
  let gmailSubj='';
  if(fromGmail&&gmailMsg&&gmailMsg.payload){
    const gh=(gmailMsg.payload.headers||[]);
    const sh=gh.find(h=>h.name==='Subject');
    gmailSubj=sh?String(sh.value||'').trim():'';
  }
  const pqrsSelHtml=fromGmail?(
    '<div class="fld" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">PQRSD a cerrar</label>'+
    '<input type="hidden" id="gmail-resp-pqrs-hid" value="'+escAttr(expLabel)+'">'+
    '<div id="gmail-resp-pqrs-chip" style="display:none;margin-top:4px;margin-bottom:6px"></div>'+
    '<button type="button" class="btn bsm bd2" id="gmail-resp-pqrs-toggle-search" style="margin-top:4px;font-size:12px" onclick="gmailTogglePqrsRespSearch(true)">🔍 Buscar otra PQRSD</button>'+
    '<div id="gmail-resp-pqrs-search-wrap" style="display:none;margin-top:6px">'+
    '<div style="position:relative"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;opacity:.5">🔍</span>'+
    '<input type="text" id="gmail-resp-pqrs-search" placeholder="Número, asunto o interesado…" style="width:100%;padding:8px 8px 8px 32px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box" oninput="gmailFiltrarPqrsRespSug(this)"></div>'+
    '<div id="gmail-resp-pqrs-sug" style="max-height:160px;overflow:auto;border:1px solid var(--bd);border-radius:var(--r);margin-top:4px;display:none"></div>'+
    '</div></div>'+
    (gmailSubj?'<div style="font-size:11px;color:var(--tx2);margin-bottom:10px;padding:8px 10px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd)">📧 Correo vinculado: <strong>'+escAttr(gmailSubj.slice(0,100))+'</strong></div>':'')
  ):(
    '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem">📋 '+escAttr((e&&e.f_f1)||(e&&e._pqrs_detalle)||expLabel)+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Registre la respuesta definitiva al ciudadano. El expediente se marcará como <strong>Atendido</strong>.</div>'
  );
  const tipoBtns=mkTipo(PQRS_WF_TIPO.MENSAJE,'✉️ Mensaje simple')+mkTipo(PQRS_WF_TIPO.OFICIO,'📄 Oficio firmado')+
    (fromGmail?'':mkTipo(PQRS_WF_TIPO.INFORMATIVA,'ℹ️ Informativa / sin respuesta formal'));
  const cuerpoVal=fromGmail?(gmailSubj||wf.cuerpo||''):(wf.cuerpo||e&&e._pqrs_respuesta_nota||'');
  const emailCiu=fromGmail?(ciudEmail||''):ciudEmail;
  body.innerHTML=pqrsSelHtml+
    '<div class="fld" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Tipo de respuesta</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:5px" id="pqrs-resp-tipo-btns">'+tipoBtns+
    '</div><input type="hidden" id="pqrs-resp-tipo" value="'+escAttr(wf.tipo||PQRS_WF_TIPO.MENSAJE)+'"></div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Fecha de la respuesta<span class="req-star">*</span></label><input type="date" id="pqrs-resp-fecha" value="'+escAttr(wf.fecha_respuesta||(e&&e._pqrs_respuesta_fecha)||hoy())+'"></div>'+
    '<div class="fld" id="pqrs-resp-oficio-wrap"><label>N° de oficio <span id="pqrs-resp-oficio-req" class="req-star" style="display:none">*</span><span id="pqrs-resp-oficio-hint" style="font-weight:400;color:var(--tx3)"> (obligatorio si es oficio firmado)</span></label><input type="text" id="pqrs-resp-oficio" placeholder="Ej. OFI-2026-045" value="'+escAttr(wf.oficio||(e&&e._pqrs_respuesta_oficio)||'')+'"></div>'+
    '</div>'+
    (fromGmail?('<div class="fld" style="margin-bottom:10px"><label>Correo del ciudadano</label><input type="email" id="gmail-resp-pqrs-email" value="'+escAttr(emailCiu)+'" style="margin-top:4px"></div>'):'')+
    '<div class="fld" id="pqrs-resp-canal-wrap" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Canal de notificación al ciudadano</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:5px" id="pqrs-resp-canal-btns">'+
    mkCan(PQRS_WF_CANAL.CORREO,'Correo electrónico','📧')+
    mkCan(PQRS_WF_CANAL.WHATSAPP,'WhatsApp','💬')+
    mkCan(PQRS_WF_CANAL.PRESENCIAL,'Presencial','🤝')+
    (fromGmail?'':mkCan(PQRS_WF_CANAL.AVISO,'Por aviso','📌'))+
    '</div><input type="hidden" id="pqrs-resp-canal" value="'+escAttr(fromGmail?PQRS_WF_CANAL.CORREO:(wf.canal||(e&&e._pqrs_respuesta_medio)||PQRS_WF_CANAL.CORREO))+'"></div>'+
    (fromGmail?'':(
    '<div id="pqrs-resp-email-compose" class="pqrs-resp-compose-inline" style="display:none;margin-bottom:10px">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--bl)">📧 Redactar respuesta por correo</div>'+
    '<div class="pqrs-resp-compose-box">'+
    '<div class="gm-compose-field"><label>Para</label><input type="email" id="pqrs-compose-to" placeholder="ciudadano@ejemplo.com" value="'+escAttr(ciudEmail)+'"></div>'+
    '<div class="gm-compose-field"><label>Asunto</label><input type="text" id="pqrs-compose-subject" value="'+escAttr(asuntoMail)+'"></div>'+
    '<textarea id="pqrs-compose-body" class="gm-compose-textarea" placeholder="Escriba su mensaje al ciudadano…" style="min-height:120px">'+escAttr(wf.cuerpo||(e&&e._pqrs_respuesta_nota)||'')+'</textarea>'+
    '<div id="pqrs-compose-att-list" class="pqrs-compose-att-list"></div>'+
    '<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px">'+
    '<button type="button" class="btn bsm" onclick="pqrsComposeAddAttachment()">📎 Adjuntar archivo</button>'+
    '</div></div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-top:6px">Al enviar se registrará la respuesta, el soporte PDF de trazabilidad y la notificación en consulta ciudadana.</div>'+
    '</div>'))+
    '<div class="fld" id="pqrs-resp-cuerpo-wrap" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Resumen de la respuesta</label>'+
    '<textarea id="pqrs-resp-cuerpo" placeholder="Resumen para trazabilidad…" style="min-height:70px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:5px">'+escAttr(cuerpoVal)+'</textarea></div>'+
    '<div class="fld" id="pqrs-resp-adj-wrap" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Documentos adjuntos (soporte notificación)</label>'+adjInfo+
    '<div id="pqrs-resp-adj-rows" style="margin-top:6px"></div>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px">'+
    (usaDriveInst?'<button type="button" class="btn bsm" onclick="addPqrsRespAdjFile()">📎 Adjuntar archivo</button>':'')+
    '<button type="button" class="btn bsm" onclick="addPqrsRespAdjRow()">🔗 + Link Drive</button>'+
    '</div></div>'+
    '<div class="fld" id="pqrs-resp-nota-wrap" style="margin-bottom:10px"><label>Notas internas <span style="font-weight:400;color:var(--tx3)">(solo funcionarios)</span></label>'+
    '<textarea id="pqrs-resp-nota" placeholder="Notas para trazabilidad interna…" style="min-height:52px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:11px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px">'+escAttr((e&&e._pqrs_notas_internas)||'')+'</textarea></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    (fromGmail?'':
    '<button type="button" class="btn bsm bp" id="pqrs-resp-email-send-btn" style="display:none" onclick="submitPqrsRespuestaPorCorreo(\''+escAttr(expLabel)+'\')">📤 Enviar correo y cerrar PQRSD</button>')+
    '<button type="button" class="btn bsm bp" id="pqrs-resp-submit-btn" onclick="'+(fromGmail?'submitPqrsRespuestaGmailVinculo()':'submitPqrsRespuesta(\''+escAttr(expLabel)+'\')')+'">'+(fromGmail?'✅ Registrar como respuesta oficial':'✅ Confirmar y cerrar PQRSD')+'</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';
  window._pqrsComposeAttachments=[];
  window._gmailVinculoMsg=fromGmail?gmailMsg:null;
  setPqrsRespTipo(wf.tipo||PQRS_WF_TIPO.MENSAJE);
  setPqrsRespCanal(fromGmail?PQRS_WF_CANAL.CORREO:(wf.canal||(e&&e._pqrs_respuesta_medio)||PQRS_WF_CANAL.CORREO));
  if(fromGmail&&e&&typeof gmailSetPqrsRespSel==='function')gmailSetPqrsRespSel(e,{detectada:!!opts.detectada,keepEmail:true});
  else if(fromGmail&&!e){const tg=document.getElementById('gmail-resp-pqrs-toggle-search');if(tg)tg.textContent='🔍 Buscar PQRSD';}
  if(fromGmail)pqrsRespRefreshModalUiGmail();
  ov.classList.add('on');
  window._taskModalCtx={mode:fromGmail?'gmailVincularPqrs':'pqrsRespuesta',expId:expLabel};
}
function pqrsRespRefreshModalUiGmail(){
  const tipo=String((document.getElementById('pqrs-resp-tipo')||{}).value||PQRS_WF_TIPO.MENSAJE);
  const cuerpoWrap=document.getElementById('pqrs-resp-cuerpo-wrap');
  const canalWrap=document.getElementById('pqrs-resp-canal-wrap');
  const adjWrap=document.getElementById('pqrs-resp-adj-wrap');
  const oficioReq=document.getElementById('pqrs-resp-oficio-req');
  const oficioHint=document.getElementById('pqrs-resp-oficio-hint');
  if(cuerpoWrap)cuerpoWrap.style.display='';
  if(canalWrap)canalWrap.style.display='none';
  if(adjWrap)adjWrap.style.display='';
  if(oficioReq)oficioReq.style.display=tipo===PQRS_WF_TIPO.OFICIO?'':'none';
  if(oficioHint)oficioHint.style.display=tipo===PQRS_WF_TIPO.OFICIO?'none':'';
}
function pqrsRespRefreshModalUi(){
  const tipo=String((document.getElementById('pqrs-resp-tipo')||{}).value||PQRS_WF_TIPO.MENSAJE);
  const canal=String((document.getElementById('pqrs-resp-canal')||{}).value||'');
  const isInfo=tipo===PQRS_WF_TIPO.INFORMATIVA;
  const useEmail=!isInfo&&(tipo===PQRS_WF_TIPO.MENSAJE||canal===PQRS_WF_CANAL.CORREO);
  const compose=document.getElementById('pqrs-resp-email-compose');
  const cuerpoWrap=document.getElementById('pqrs-resp-cuerpo-wrap');
  const canalWrap=document.getElementById('pqrs-resp-canal-wrap');
  const adjWrap=document.getElementById('pqrs-resp-adj-wrap');
  const emailBtn=document.getElementById('pqrs-resp-email-send-btn');
  const submitBtn=document.getElementById('pqrs-resp-submit-btn');
  const oficioReq=document.getElementById('pqrs-resp-oficio-req');
  const oficioHint=document.getElementById('pqrs-resp-oficio-hint');
  if(compose)compose.style.display=useEmail?'':'none';
  if(cuerpoWrap)cuerpoWrap.style.display=(!useEmail&&!isInfo)?'':'none';
  if(canalWrap)canalWrap.style.display=isInfo?'none':'';
  if(adjWrap)adjWrap.style.display=(useEmail||isInfo)?'none':'';
  if(emailBtn)emailBtn.style.display=useEmail?'':'none';
  if(submitBtn){
    submitBtn.style.display=useEmail?'none':'';
    submitBtn.textContent=isInfo?'ℹ️ Marcar informativa y cerrar':'✅ Confirmar y cerrar PQRSD';
  }
  if(oficioReq)oficioReq.style.display=tipo===PQRS_WF_TIPO.OFICIO?'':'none';
  if(oficioHint)oficioHint.style.display=tipo===PQRS_WF_TIPO.OFICIO?'none':'';
}
function pqrsComposeAddAttachment(){
  (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
    if(!ok)return;
    const inp=document.createElement('input');
    inp.type='file';inp.multiple=true;inp.accept='*/*';
    inp.onchange=function(){
      window._pqrsComposeAttachments=window._pqrsComposeAttachments||[];
      Array.from(inp.files||[]).forEach(function(f){window._pqrsComposeAttachments.push(f);});
      pqrsComposeRenderAttachments();
    };
    inp.click();
  });
}
function pqrsComposeRenderAttachments(){
  const box=document.getElementById('pqrs-compose-att-list');
  if(!box)return;
  const files=window._pqrsComposeAttachments||[];
  if(!files.length){box.innerHTML='';return;}
  box.innerHTML=files.map(function(f,i){
    return '<div class="fx" style="gap:6px;align-items:center;margin-top:4px;font-size:12px;padding:4px 6px;background:var(--sf2);border-radius:var(--r)">'+
      '📎 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escAttr(f.name)+'</span>'+
      '<button type="button" class="btn bsm bd2" onclick="pqrsComposeRemoveAttachment('+i+')">✕</button></div>';
  }).join('');
}
function pqrsComposeRemoveAttachment(idx){
  window._pqrsComposeAttachments=(window._pqrsComposeAttachments||[]).filter(function(_,i){return i!==idx;});
  pqrsComposeRenderAttachments();
}
function setPqrsRespTipo(val){
  const hid=document.getElementById('pqrs-resp-tipo');if(hid)hid.value=val||'';
  document.querySelectorAll('#pqrs-resp-tipo-btns .tipo-resp-btn').forEach(b=>{b.classList.toggle('on',b.getAttribute('data-val')===val);});
  if(val===PQRS_WF_TIPO.MENSAJE&&!window._gmailVinculoMsg)setPqrsRespCanal(PQRS_WF_CANAL.CORREO);
  if(window._taskModalCtx&&window._taskModalCtx.mode==='gmailVincularPqrs')pqrsRespRefreshModalUiGmail();
  else pqrsRespRefreshModalUi();
}
function setPqrsRespCanal(val){
  const hid=document.getElementById('pqrs-resp-canal');if(hid)hid.value=val||'';
  document.querySelectorAll('#pqrs-resp-canal-btns .canal-resp-btn').forEach(b=>{b.classList.toggle('on',b.getAttribute('data-val')===val);});
  pqrsRespRefreshModalUi();
}
function addPqrsRespAdjFile(boxId){
  (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
    if(!ok)return;
    const boxSel=boxId||'pqrs-resp-adj-rows';
    const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='*/*';
    inp.onchange=function(){
      const box=document.getElementById(boxSel);
      if(!box)return;
      Array.from(inp.files||[]).forEach(f=>{
        const row=document.createElement('div');
        row.className='fx pqrs-adj-file-row';
        row.style.cssText='gap:6px;margin-bottom:5px;align-items:center;padding:5px;background:var(--sf2);border-radius:var(--r);font-size:12px';
        row.dataset.file=f.name;
        const icon=f.type.startsWith('image/')?'🖼️':f.type.includes('pdf')?'📄':'📎';
        row.innerHTML=icon+' <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escAttr(f.name)+'</span>'+
          '<span class="adj-upload-status" style="font-size:11px;color:var(--tx2)">Listo</span>'+
          '<button type="button" class="btn bsm bd2" onclick="this.parentElement.remove()">✕</button>';
        row._adjFile=f;
        box.appendChild(row);
      });
    };
    inp.click();
  });
}
function setPqrsRespMedioNotif(val){
  // Legacy compat — delegate to canal
  setPqrsRespCanal(val||'');
}
function addPqrsRespAdjRow(boxId){
  const box=document.getElementById(boxId||'pqrs-resp-adj-rows');
  if(!box)return;
  const row=document.createElement('div');
  row.className='fx pqrs-adj-link-row';
  row.style.cssText='gap:6px;margin-bottom:6px;align-items:center';
  row.innerHTML='<input type="url" data-adj="link" placeholder="https://drive.google.com/file/d/…" style="flex:1;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px"><button type="button" class="btn bsm bd2" onclick="this.parentElement.remove()">✕</button>';
  box.appendChild(row);
}
function collectPqrsRespAdjuntos(boxId){
  const sel=(boxId||'pqrs-resp-adj-rows');
  const links=[];
  document.querySelectorAll('#'+sel+' [data-adj="link"]').forEach(el=>{
    const v=el.value.trim();if(v)links.push(v);
  });
  const files=[];
  document.querySelectorAll('#'+sel+' .pqrs-adj-file-row').forEach(row=>{
    if(row._adjFile)files.push({file:row._adjFile,statusEl:row.querySelector('.adj-upload-status')});
  });
  return{links,files};
}
async function submitPqrsRespuesta(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!puedeMarcarPqrsRespondida(e)){notif('No puede registrar respuesta','err');return;}
  const fechaResp=String((document.getElementById('pqrs-resp-fecha')||{}).value||'').trim();
  const oficioExt=String((document.getElementById('pqrs-resp-oficio')||{}).value||'').trim();
  const tipoResp=String((document.getElementById('pqrs-resp-tipo')||{}).value||PQRS_WF_TIPO.MENSAJE).trim();
  const canal=String((document.getElementById('pqrs-resp-canal')||{}).value||'').trim();
  const cuerpo=String((document.getElementById('pqrs-resp-cuerpo')||{}).value||'').trim();
  const notaInterna=String((document.getElementById('pqrs-resp-nota')||{}).value||'').trim();
  const adj=collectPqrsRespAdjuntos();
  if(!fechaResp){notif('Indique la fecha de la respuesta','err');return;}
  if(tipoResp===PQRS_WF_TIPO.OFICIO&&!oficioExt){notif('Indique el N° de oficio (obligatorio para oficio firmado)','err');return;}
  if(tipoResp===PQRS_WF_TIPO.INFORMATIVA){
    e._pqrs_informativa=true;
    setPqrsWorkflow(e,{fase:PQRS_WF.CERRADA,tipo:PQRS_WF_TIPO.INFORMATIVA,canal:'',cuerpo:'',oficio:'',fecha_respuesta:fechaResp,cerrado_por:responsableActivo||labelOficina(deptoActivo)||rolSesion||'',cerrado_en:new Date().toISOString()});
    if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
    e._pqrs_historial.push({tipo:'informativa',fecha:hoy(),nota:(notaInterna||'PQRSD informativa — sin respuesta formal requerida')+' — '+pqrsComentarioAutor(),oficina:e._pqrs_oficina,por:pqrsComentarioAutor()});
    if(notaInterna)e._pqrs_notas_internas=notaInterna;
    e._pqrs_estado_oficina='cerrado';e._estado='Atendido';e._fecha_res=fechaResp;e._pqrs_respuesta_fecha=fechaResp;
    persistExpedienteGranular(e);
    closeTaskModal();
    notif('PQRSD marcada como informativa y cerrada','ok');
    refreshPqrsDetalleViews(expId);renderPqrsOficinaInbox();renderSecretariaPqrs();
    return;
  }

  const btn=document.getElementById('pqrs-resp-submit-btn');
  if(btn){btn.disabled=true;btn.textContent='Subiendo archivos…';}
  const documentos=[];
  const usaDriveInst=typeof DRIVE_INST_DEPTOS!=='undefined'&&DRIVE_INST_DEPTOS.has(deptoActivo||deptoCfg||'');
  const nombreCarpeta=(e._qd_nombre||e._nombre||e._pn_nombre||expId);
  if(usaDriveInst&&adj.files&&adj.files.length){
    const driveOk=await (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true));
    if(!driveOk){
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar y cerrar PQRSD';}
      return;
    }
    for(const {file,statusEl} of adj.files){
      try{
        if(statusEl)statusEl.textContent='⬆ Subiendo…';
        const res=await driveUploadInstitutional(file,file.name,file.type||'application/octet-stream','respuesta_aprobada',expId,nombreCarpeta,e._fecha||e._fecha_solicitud||'',{expediente:e,uploadTarget:'respuesta'});
        if(statusEl)statusEl.textContent='✅ Subido';
        documentos.push({nombre:file.name,driveLink:res.driveLink,previewLink:res.previewLink,fileId:res.fileId,tipo:'archivo'});
      }catch(err){
        if(statusEl)statusEl.textContent='❌ Error';
        console.error('Drive upload error:',err);
        notif('Error al subir '+file.name+': '+String(err.message||err).slice(0,80),'err');
      }
    }
  }
  adj.links.forEach(lnk=>documentos.push({nombre:'Link Drive',driveLink:lnk,tipo:'link'}));

  const wfPatch={
    fase:PQRS_WF.CERRADA,
    tipo:tipoResp,
    canal,
    cuerpo,
    oficio:oficioExt,
    fecha_respuesta:fechaResp,
    documentos,
    cerrado_por:responsableActivo||labelOficina(deptoActivo)||rolSesion||'',
    cerrado_en:new Date().toISOString()
  };
  // Generar y subir soporte PDF de respuesta antes de persistir
  if(btn)btn.textContent='Generando soporte…';
  const soporteRes=await _pqrsSubirSoporteRespuesta(e,{fechaResp,cuerpo,documentos,cerradoPor:wfPatch.cerrado_por});
  if(soporteRes&&soporteRes.driveLink){
    documentos.push({nombre:'Soporte de respuesta',driveLink:soporteRes.driveLink,previewLink:soporteRes.previewLink||'',fileId:soporteRes.fileId||'',tipo:'soporte_respuesta'});
    wfPatch.documentos=documentos;
  }
  setPqrsWorkflow(e,wfPatch);
  registrarPqrsRespuestaCore(e,{fechaResp,oficioExt,medioResp:canal,cuerpo,tipo:tipoResp,canal,notaInterna,esNotaPublica:false,adj:{links:adj.links,files:[]},archivos:documentos});
  persistExpedienteGranular(e);
  if(btn){btn.disabled=false;btn.textContent='✅ Confirmar y cerrar PQRSD';}
  closeTaskModal();
  notif('✅ Respuesta PQRSD registrada — expediente Atendido','ok');
  refreshPqrsDetalleViews(expId);
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();

  const todosCorreos=pqrsCorreosCiudadano(e);
  const tokSec=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid();
  const tokOfi=typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid();

  if(canal===PQRS_WF_CANAL.CORREO){
    const ciudEmail=pqrsCorreoCiudadano(e);
    const destinos=todosCorreos.length?todosCorreos:(ciudEmail?[ciudEmail]:[]);
    if(destinos.length&&(tokSec||tokOfi)){
      if(typeof confirmarEnvioRespuestaEmailPqrs==='function')confirmarEnvioRespuestaEmailPqrs(e,destinos.join(', '),cuerpo,documentos);
    }else if(!destinos.length){
      notif('La PQRSD fue cerrada. No hay correo registrado para notificar al ciudadano.','info');
    }else{
      notif('La PQRSD fue cerrada. Conecte correo para enviar notificación al ciudadano.','info');
    }
  }else if(canal===PQRS_WF_CANAL.PRESENCIAL||canal===PQRS_WF_CANAL.AVISO||canal===PQRS_WF_CANAL.WHATSAPP){
    // Crear tarea de seguimiento para soporte de notificación personal (aparece en actividades pendientes)
    _pqrsCrearTareaNotificacionPersonal(e,canal);
    persistExpedienteGranular(e,false);
    // Si hay correo registrado, ofrecer aviso simple opcional
    if(todosCorreos.length&&(tokSec||tokOfi)){
      _pqrsOfrecerAvisoSimple(e,todosCorreos);
    }
  }
}
async function submitPqrsRespuestaPorCorreo(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!puedeMarcarPqrsRespondida(e)){notif('No puede registrar respuesta','err');return;}
  const fechaResp=String((document.getElementById('pqrs-resp-fecha')||{}).value||'').trim();
  const oficioExt=String((document.getElementById('pqrs-resp-oficio')||{}).value||'').trim();
  const tipoResp=String((document.getElementById('pqrs-resp-tipo')||{}).value||PQRS_WF_TIPO.MENSAJE).trim();
  const to=String((document.getElementById('pqrs-compose-to')||{}).value||'').trim();
  const subject=String((document.getElementById('pqrs-compose-subject')||{}).value||'').trim();
  const body=String((document.getElementById('pqrs-compose-body')||{}).value||'').trim();
  const notaInterna=String((document.getElementById('pqrs-resp-nota')||{}).value||'').trim();
  if(!fechaResp){notif('Indique la fecha de la respuesta','err');return;}
  if(tipoResp===PQRS_WF_TIPO.OFICIO&&!oficioExt){notif('Indique el N° de oficio (obligatorio para oficio firmado)','err');return;}
  if(!to){notif('Indique el correo del ciudadano','err');return;}
  if(!body.trim()){notif('Escriba el mensaje de respuesta','err');return;}
  const tokOk=(typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid())||(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid());
  if(!tokOk){notif('Conecte su correo Gmail para enviar la respuesta','err');return;}
  const btn=document.getElementById('pqrs-resp-email-send-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Enviando…';}
  try{
    if(typeof gmailOfiSendPqrsRespuestaInline!=='function')throw new Error('Módulo de correo no disponible');
    await gmailOfiSendPqrsRespuestaInline({
      expId:expId,
      to:to,
      subject:subject,
      body:body,
      attachments:window._pqrsComposeAttachments||[],
      tipo:tipoResp,
      oficio:oficioExt,
      fechaResp:fechaResp,
      notaInterna:notaInterna
    });
    closeTaskModal();
    refreshPqrsDetalleViews(expId);
    renderPqrsOficinaInbox();
    renderSecretariaPqrs();
  }catch(err){
    notif('Error al enviar: '+String(err.message||err).slice(0,100),'err');
  }
  if(btn){btn.disabled=false;btn.textContent='📤 Enviar correo y cerrar PQRSD';}
}
function htmlPqrsNotasInternasHtml(e){
  if(!e||!e._pqrs_notas_internas||typeof esModoCiudadano==='function'&&esModoCiudadano())return'';
  return '<div class="pqrs-det-sec pqrs-notas-internas"><div class="pqrs-det-k">Notas internas</div><div class="pqrs-det-v" style="font-size:12px;color:var(--tx2)">'+escAttr(e._pqrs_notas_internas)+'</div></div>';
}
function pqrsMedioNotificacionFlagHtml(e,compact){return medioNotificacionFlagHtml(e&&e._medio_notificacion,compact);}
function pqrsHistorialEventoLabel(h){
  if(!h)return'Actualización';
  if(h.tipo==='radicacion')return 'Radicación de la solicitud';
  if(h.tipo==='traslado_oficina'){
    const dest=labelOficina(h.oficina||h.a||'');
    const orig=h.oficinaAnterior?labelOficina(h.oficinaAnterior):'';
    return orig?'Traslado: '+orig+' → '+dest:'Traslado a '+dest;
  }
  if(h.tipo==='asignacion_oficina')return 'Asignación a responsable de la oficina';
  if(h.tipo==='respuesta_oficina')return 'Respuesta registrada';
  if(h.tipo==='entrega_respuesta')return 'Entrega con datos de respuesta';
  if(h.tipo==='recepcion_nca')return 'Recibido en NCA DEGUV';
  if(h.tipo==='informativa')return 'Marcada como informativa';
  if(h.tipo==='asociacion_exp')return 'Asociada a expediente de trámite';
  if(h.tipo==='asociacion_pqrs')return 'Asociada a otra PQRSD';
  if(h.tipo==='ajuste_fecha_solicitud')return 'Ajuste fecha de solicitud del ciudadano';
  if(h.tipo==='notificacion_radicacion')return 'Notificación de radicación al ciudadano (correo)';
  if(h.tipo==='notificacion_correo')return 'Notificación de respuesta al ciudadano (correo)';
  if(h.tipo==='notificacion_excepcion')return 'Excepción — notificación por correo no enviada';
  if(h.tipo==='notificacion_personal_pendiente')return 'Notificación física/presencial — soporte pendiente';
  if(h.tipo==='aviso_informativo_correo')return 'Aviso simple enviado al ciudadano (correo)';
  if(h.tipo==='vital_firma_completada')return 'VITAL — oficio firmado subido al Drive institucional';
  return 'Actualización';
}
function renderPqrsTrazabilidadHtml(e){
  e=normalizePqrsOficinaFields(e);
  const medio=medioNotificacionFlagHtml(e._medio_notificacion,false);
  let items=[];
  const hist=(e._pqrs_historial||[]).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
  if(!hist.some(h=>h.tipo==='radicacion')&&e._fecha){
    items.push({tipo:'radicacion',fecha:e._fecha,nota:'Radicado por Secretaría DEGUV',oficina:''});
  }
  hist.forEach(h=>items.push(h));
  if(!items.length)return'';
  const tl=items.map(h=>{
    const lbl=pqrsHistorialEventoLabel(h);
    const nota=String(h.nota||'').trim();
    const esTrasl=h.tipo==='traslado_oficina';
    const motivoHtml=esTrasl&&nota?('<div class="tl-motivo"><strong>Motivo:</strong> '+escAttr(nota)+'</div>'):'';
    const extra=(!esTrasl&&nota)?(': '+escAttr(nota)):'';
    const por=h.por?('<div class="tl-motivo">Por: '+escAttr(h.por)+'</div>'):'';
    return '<div class="pqrs-tl-item"><div class="tl-fecha">'+fmtF(h.fecha||e._fecha)+'</div><div class="tl-nota"><strong>'+escAttr(lbl)+'</strong>'+extra+'</div>'+motivoHtml+por+'</div>';
  }).join('');
  return '<div class="pqrs-det-sec"><div class="pqrs-det-k">Trazabilidad</div>'+
    (medio?('<div class="fx" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:11px;color:var(--tx2);align-self:center">Medio de notificación:</span>'+medio+'</div>'):'')+
    tl+'</div>';
}
function htmlPqrsRespuestaRegistrada(e){
  if(!pqrsEstaCerrada(e))return'';
  if(e._pqrs_informativa){
    return '<div class="pqrs-det-sec"><div class="pqrs-det-k">Respuesta</div><div class="pqrs-det-v" style="color:var(--gn);font-weight:600">ℹ Informativa — atendida sin respuesta formal al ciudadano</div>'+
      (e._pqrs_respuesta_nota?'<div style="margin-top:6px;font-size:13px">'+escAttr(e._pqrs_respuesta_nota)+'</div>':'')+'</div>';
  }
  const respNota=(e._pqrs_historial||[]).filter(h=>h.tipo==='respuesta_oficina').pop();
  const enTerm=pqrsRespuestaEnTermino(e);
  let h='<div class="pqrs-det-sec"><div class="pqrs-det-k">Respuesta</div><div class="pqrs-det-v" style="color:'+(enTerm?'var(--gn)':'var(--or)')+';font-weight:600">✓ '+(enTerm?'Atendida en término':'Atendido extemporáneo')+(respNota&&respNota.fecha?' · '+fmtF(e._pqrs_respuesta_fecha||respNota.fecha):'')+'</div>';
  if(e._pqrs_respuesta_oficio)h+='<div style="margin-top:4px;font-size:12px"><strong>Oficio:</strong> '+escAttr(e._pqrs_respuesta_oficio)+'</div>';
  if(e._pqrs_respuesta_medio)h+='<div style="margin-top:4px;font-size:12px"><strong>Notificación:</strong> '+escAttr(medioNotificacionRespLabel(e._pqrs_respuesta_medio))+'</div>';
  if(e._pqrs_respuesta_nota)h+='<div style="margin-top:6px;font-size:13px">'+escAttr(e._pqrs_respuesta_nota)+'</div>';
  if(e._pqrs_respuesta_link)h+='<div style="margin-top:6px"><button type="button" class="btn bsm" onclick="openPqrsDocViewer(\''+escAttr(e._pqrs_respuesta_link)+'\',\'Respuesta PQRSD\')">📎 Ver respuesta</button></div>';
  (e._pqrs_respuesta_soportes||[]).forEach(s=>{
    if(s.url||s.preview)h+='<div style="margin-top:4px"><button type="button" class="btn bsm" onclick="openPqrsDocViewer(\''+escAttr(s.preview||s.url)+'\',\''+escAttr(s.label||'Adjunto')+'\')">📄 '+escAttr(s.label||'Adjunto')+'</button></div>';
  });
  return h+'</div>';
}
function abrirVisorAdjunto(urlView,nombreArchivo){
  let ov=document.getElementById('adj-viewer-ov');
  if(!ov){
    ov=document.createElement('div');
    ov.id='adj-viewer-ov';
    ov.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center';
    ov.onclick=function(ev){if(ev.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  const isBlob=String(urlView||'').startsWith('blob:');
  const previewUrl=isBlob?String(urlView||''):String(urlView||'').replace(/\/view(\?.*)?$/,'/preview');
  const extraLink=isBlob
    ?'<a href="'+escAttr(String(urlView||''))+'" download="'+escAttr(nombreArchivo||'adjunto')+'" style="font-size:12px;color:var(--bl,#185fa5);white-space:nowrap;text-decoration:none;margin-right:8px">⬇ Descargar</a>'
    :'<a href="'+escAttr(String(urlView||'').replace(/\/preview(\?.*)?$/,'/view'))+'" target="_blank" rel="noopener" style="font-size:12px;color:var(--bl,#185fa5);white-space:nowrap;text-decoration:none;margin-right:8px">↗ Abrir en Drive</a>';
  ov.innerHTML=
    '<div style="background:var(--sf,#fff);border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;width:min(900px,96vw);height:min(720px,90vh);overflow:hidden">'+
    '<div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd,#e2e8f0);gap:8px">'+
    '<span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+escAttr(nombreArchivo||'Adjunto')+'</span>'+
    extraLink+
    '<button type="button" onclick="document.getElementById(\'adj-viewer-ov\').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;color:var(--tx2,#666)" title="Cerrar">✕</button>'+
    '</div>'+
    '<iframe src="'+escAttr(previewUrl)+'" style="flex:1;width:100%;border:none" allowfullscreen></iframe>'+
    '</div>';
  ov.style.display='flex';
}
function htmlPqrsCorreoOrigenHtml(e){
  const d=e&&e._gmail_email_data;
  if(!d||typeof d!=='object')return'';
  const driveAtts=Array.isArray(e._pqrs_gmail_attachments)?e._pqrs_gmail_attachments:[];
  const adjInfo=Array.isArray(d.adjuntosInfo)?d.adjuntosInfo:[];
  let attsHtml='';
  let hayAnexoSinLink=false;
  if(adjInfo.length){
    attsHtml=adjInfo.map(function(a,i){
      // Solo enlazar si existe una subida a Drive que coincide por NOMBRE con el anexo.
      // (Ya no se suben los anexos originales al Drive: el fallback posicional apuntaba
      //  por error al PDF de soporte. Los originales están en el correo reenviado.)
      const drv=driveAtts.find(x=>x&&x.nombre===a.nombre&&x.driveLink)||null;
      const ico=(a.mimeType||'').startsWith('image/')?'🖼️':(a.mimeType||'').includes('pdf')?'📄':(a.mimeType||'').includes('word')||(a.nombre||'').match(/\.docx?$/i)?'📝':(a.mimeType||'').includes('sheet')||(a.mimeType||'').includes('excel')||(a.nombre||'').match(/\.xlsx?$/i)?'📊':'📎';
      if(drv&&drv.driveLink){
        const onclick='event.stopPropagation();abrirVisorAdjunto(\''+jsStr(drv.driveLink)+'\',\''+jsStr(a.nombre||'Adjunto')+'\');return false;';
        return'<a href="'+escAttr(drv.driveLink)+'" class="gmail-att-chip" style="text-decoration:none" onclick="'+escAttr(onclick)+'" title="Ver '+escAttr(a.nombre||'adjunto')+'"><span class="att-ico">'+ico+'</span><span class="att-name">'+escAttr(a.nombre||'Adjunto')+'</span></a>';
      }
      hayAnexoSinLink=true;
      return'<span class="gmail-att-chip" style="opacity:.85" title="Este anexo está en el correo reenviado a su oficina"><span class="att-ico">'+ico+'</span><span class="att-name">'+escAttr(a.nombre||'Adjunto')+'</span></span>';
    }).join('');
  }
  const notaAnexos=hayAnexoSinLink
    ?'<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;display:flex;gap:5px;align-items:flex-start"><span>📥</span><span>Los anexos originales se conservan en el <strong>correo reenviado a su oficina</strong> (revise su bandeja de Gmail). El PDF de soporte está en «Documento de la solicitud».</span></div>'
    :'';
  const bodyHtml=d.cuerpoHtml||(d.cuerpoTxt?'<pre style="white-space:pre-wrap;font-size:12px;margin:0">'+escAttr(d.cuerpoTxt)+'</pre>':'');
  const fechaStr=d.fecha?' · '+escAttr(d.fecha):'';
  return'<details class="pqrs-email-origen"><summary>📧 Correo de origen <span style="font-weight:400;color:var(--tx3)">(clic para ver)</span></summary>'+
    '<div style="padding:8px 0 4px">'+
    (d.remitente||d.fecha?'<div style="font-size:11px;color:var(--tx2);margin-bottom:3px">De: <strong>'+escAttr(d.remitente||'')+fechaStr+'</strong></div>':'')  +
    (d.asunto?'<div style="font-size:12px;font-weight:600;margin-bottom:6px">'+escAttr(d.asunto)+'</div>':'')+
    (attsHtml?'<div class="gmail-att-chips" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">'+attsHtml+'</div>':'')+
    notaAnexos+
    (bodyHtml?'<div class="pqrs-email-body">'+bodyHtml+'</div>':'')+
    '</div></details>';
}
function htmlPqrsOficinaDetalleCore(e,opts){
  opts=opts||{};
  e=normalizePqrsOficinaFields(e);
  const asunto=e.f_f1||'—';
  const detalle=e._pqrs_detalle||e._detalle_general||'';
  const docHtml=htmlPqrsDocumentoBtns(e);
  const cerrada=pqrsEstaCerrada(e);
  const btnResp=(!cerrada&&puedeMarcarPqrsRespondida(e))?' <button type="button" class="btn bsm bp" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓ Responder</button>':'';
  const btnAsoc=(!cerrada&&puedeGestionarPqrsAsociacion(e))?(' '+pqrsAsocAccionesHtml(e).join(' ')):'';
  const btnInf=(!cerrada&&puedeMarcarPqrsInformativa(e))?' <button type="button" class="btn bsm" onclick="SST.openMarcarPqrsInformativaModal(\''+escAttr(e._exp)+'\')">ℹ Informativa</button>':'';
  const btnAsig=(!cerrada&&puedeAsignarPqrsOficina(e))?' <button type="button" class="btn bsm" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤 Asignar</button>':'';
  const btnTrasInicial=(puedeTrasladarPqrsInicial(e)&&!cerrada)?' <button type="button" class="btn bsm bp" onclick="openTrasladoPqrsInicialModal(\''+escAttr(e._exp)+'\')">↪ Trasladar a oficina</button>':'';
  const btnTras=(puedeTrasladarPqrs(e)&&!cerrada)?' <button type="button" class="btn bsm" onclick="openTrasladoPqrsInterOficinaModal(\''+escAttr(e._exp)+'\')">↪ Trasladar</button>':'';
  const btnPriorDs=(puedeMarcarPqrsPrioritariaDs(e)&&!cerrada)?' <button type="button" class="btn bsm" onclick="togglePqrsPrioritariaDs(\''+escAttr(e._exp)+'\')">'+(e._pqrs_prioritaria?'Quitar prioritaria':'⚡ Prioritaria')+'</button>':'';
  const btnEdit=(opts.showEdit&&puedeEditarPqrsSecretaria(e))?' '+pqrsBtnEdit(e._exp,'✏ Editar'):'';
  const btnDel=(opts.showDelete&&puedeEliminarPqrs(e))?' <button type="button" class="btn bsm bd2" onclick="eliminarPqrs(\''+escAttr(e._exp)+'\')">🗑 Eliminar</button>':'';
  const chatHtml=opts.showChat!==false&&esSecretaria()?renderPqrsChatHtml(e):'';
  const plazoBar=opts.sidePanel?'':renderPqrsPlazoBarHtml(e);
  return '<div class="pqrs-det-hdr">'+escAttr(e._exp)+' · '+pqrsEstadoDisplayBadge(e)+' '+pqrsPrioritariaBadge(e)+' '+pqrsInformativaBadge(e)+'</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">'+escAttr(e._tipo_solicitud||'PQRSD')+' · Radicado '+fmtF(e._fecha)+(e._pqrs_oficina?' · '+escAttr(labelOficina(e._pqrs_oficina)):'')+pqrsMedioNotificacionFlagHtml(e,true)+'</div>'+
    plazoBar+
    '<div class="pqrs-det-sec"><div class="pqrs-det-k">Asunto</div><div class="pqrs-det-v">'+escAttr(asunto)+'</div></div>'+
    '<div class="pqrs-det-sec"><div class="pqrs-det-k">Interesado</div>'+htmlPqrsOficinaInteresado(e)+'</div>'+
    (detalle?('<div class="pqrs-det-sec"><div class="pqrs-det-k">Detalle</div><div class="pqrs-det-v">'+escAttr(detalle)+'</div></div>'):'')+
    renderPqrsAsociadosPanelHtml(e)+
    (docHtml?('<div class="pqrs-det-sec"><div class="pqrs-det-k">Documento de la solicitud</div><div class="fx" style="gap:6px;flex-wrap:wrap;align-items:center">'+docHtml+'</div></div>'):'')+
    renderPqrsTrazabilidadHtml(e)+
    htmlPqrsRespuestaRegistrada(e)+
    htmlPqrsNotasInternasHtml(e)+chatHtml+
    htmlPqrsCorreoOrigenHtml(e)+
    '<div class="fx" style="gap:8px;flex-wrap:wrap;margin-top:14px">'+btnResp+btnAsoc+btnInf+btnAsig+btnTrasInicial+btnTras+btnPriorDs+btnEdit+btnDel+'</div>';
}
function togglePqrsPrioritariaDs(expId){
  expId=String(expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e||!puedeMarcarPqrsPrioritariaDs(e)){notif('No puede cambiar la prioridad de esta PQRSD','err');return;}
  e._pqrs_prioritaria=!e._pqrs_prioritaria;
  persistExpedienteGranular(e);
  notif(e._pqrs_prioritaria?'PQRSD marcada como prioritaria':'Prioritaria retirada','ok');
  renderSecretariaPqrs();
  renderPqrsOficinaInbox();
  refreshPqrsDetalleViews(expId);
}
function eliminarPqrs(expId){
  if(!esSecretaria()&&!esAdministrador()){notif('Solo Secretaría o el administrador pueden eliminar PQRSD','err');return;}
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!esPqrsSecretaria(e)){notif('PQRSD no encontrado','err');return;}
  if(!puedeEliminarPqrs(e)){
    notif('Solo el administrador (rol Secretaría) puede eliminar una PQRSD ya atendida','err');
    return;
  }
  const msg=pqrsEstaCerrada(e)?'¿Eliminar esta PQRSD atendida del registro? (solo administrador)':'¿Eliminar esta PQRSD del registro?';
  confirmPrecaucion({title:'Eliminar PQRSD',message:msg,detail:expId,confirmLabel:'Sí, eliminar'},async function(){
    const expRef={...e,_exp:expId,_depto:e._depto||'guaviare'};
    const res=await persistExpedienteDelete(expRef);
    if(!res||!res.ok){
      const code=res&&res.error&&res.error.code;
      let errMsg='No se pudo eliminar en Firebase. El registro reaparecerá al recargar.';
      if(code==='permission-denied')errMsg='Sin permisos para eliminar en Firebase. Verifique que su usuario tenga rol Secretaría activo.';
      else if(code==='unauthenticated')errMsg='Sesión expirada. Cierre sesión y vuelva a ingresar.';
      notif(errMsg,'err');
      return;
    }
    exps=exps.filter(x=>String(x._exp||'').trim()!==String(expId||'').trim());
    let sheetWarn='';
    if(typeof pqrsMatrizSyncAfterDelete==='function'){
      const sheetRes=await pqrsMatrizSyncAfterDelete(expRef,{silent:true,notifyOnError:true});
      if(sheetRes&&sheetRes.error)sheetWarn=' (matriz Drive no actualizada)';
      else if(sheetRes&&sheetRes.noToken)sheetWarn=' (conecte Gmail para actualizar la matriz)';
    }
    logAudit('Eliminó PQRSD ['+expId+']','pqrsd',expId);
    window._secPqrsSelExp=null;
    window._pqrsOfiSelExp=null;
    cerrarPqrsSidePanel();
    renderSecretariaPqrs();
    renderPqrsOficinaInbox();
    renderTabla();
    notif('PQRSD eliminada'+sheetWarn,'ok');
  });
}
function getSecretariaPqrsAll(){
  return exps.filter(esPqrsSecretaria).map(normalizePqrsOficinaFields).sort((a,b)=>String(b._fecha||'').localeCompare(String(a._fecha||'')));
}
function openSecretariaPqrsDetalle(expId){
  openPqrsSidePanel(expId);
}
function renderSecretariaPqrsDetalle(){
  const expId=window._pqrsSideExp||window._secPqrsSelExp;
  if(!expId)return;
  const body=document.getElementById('pqrs-side-body');
  if(body&&document.getElementById('pqrs-side-panel')&&document.getElementById('pqrs-side-panel').classList.contains('on')){
    const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
    if(e)body.innerHTML=htmlPqrsSidePanelContent(e);
  }
  const wrap=document.getElementById('sec-pqrs-det-wrap');
  if(wrap){wrap.style.display='none';wrap.innerHTML='';}
}
function actualizarConsultaPqrsUI(){
  const bas=esModoOficinaDeguv()||esSecretaria();
  const qTxt=document.getElementById('q-txt');
  const sl=document.querySelector('#pg-con .card > .slbl');
  if(qTxt&&bas)qTxt.placeholder='N° PQRSD, nombre del interesado, asunto, NIT…';
  else if(qTxt)qTxt.placeholder='Nombre, expediente, resolución, NIT, ciudad…';
  if(sl&&bas)sl.textContent='Consulta PQRSD — búsqueda por número, interesado y asunto';
  ['q-inst','q-act','q-fl','q-tram'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.style.display=bas?'none':'';if(bas)el.value='';}
  });
  const qEst=document.getElementById('q-est');
  if(qEst&&bas){
    const cv=qEst.value;
    qEst.innerHTML='<option value="">Todos los estados</option><option value="Solicitud">Solicitud</option><option value="En trámite">En trámite</option><option value="Atrasada">Atrasada / vencida</option><option value="Atendida">Atendida (en término)</option><option value="Atendido extemporánea">Atendida fuera de término</option><option value="Respondida">Todas respondidas</option>';
    if(cv)qEst.value=cv;
  }else if(qEst&&!bas){
    const cv=qEst.value;
    qEst.innerHTML='<option value="">Todos los estados</option><option>Solicitud</option><option>En trámite</option><option>Atendido</option><option>Seguimiento</option><option>Archivado o anulado</option>';
    if(cv)qEst.value=cv;
  }
}
function getPqrsEstadoConsulta(e){
  return getPqrsEstadoDisplay(e);
}
function matchPqrsEstadoConsulta(e,qe){
  if(!qe)return true;
  const st=getPqrsEstadoDisplay(e);
  if(qe==='Respondida')return pqrsEstaCerrada(e);
  if(qe==='Atrasada'||qe==='Vencida')return pqrsEstaAtrasada(e);
  if(qe==='Atendido extemporánea')return pqrsEstaCerrada(e)&&!pqrsRespuestaEnTermino(e);
  if(qe==='Atendida')return pqrsEstaCerrada(e)&&(pqrsRespuestaEnTermino(e)||!!e._pqrs_informativa);
  return st===qe;
}
function pqrsEstadoDisplayBadge(e){
  const st=getPqrsEstadoDisplay(e);
  const cls=st==='Atendida'?'cerr':st==='Atendido extemporánea'?'aten':st==='Atrasada'?'aten':st==='En trámite'?'asig':st==='Pendiente traslado'?'pend':'pend';
  return '<span class="pqrs-ofi-est '+cls+'">'+escAttr(st)+'</span>';
}
function pqrsEstadoConsultaBadge(e){
  return pqrsEstadoDisplayBadge(e);
}
function pqrsMetCard(filterVal,style,inner){
  return '<div class="met met-click" style="'+style+'" onclick="setPqrsOfiFiltro(\''+jsStr(filterVal)+'\')" title="Clic para filtrar">'+inner+'</div>';
}
function setPqrsOfiFiltro(v){
  window._pqrsOfiFiltro=v||'all';
  renderPqrsOficinaInbox();
}
function getInstructoresCfg(deptoId){
  return migrateInstructoresList((cfgFor(deptoId||getDeptoOperativo())||{}).instructores);
}
function getInstructoresActivos(deptoId){
  return getInstructoresCfg(deptoId).filter(i=>i.activo!==false&&String(i.nombre||'').trim());
}
function instructorEsSoloNcaDeguv(ins){
  if(!ins||ins.activo===false)return false;
  if(ins.rol==='encargado_depto')return true;
  if(ins.rol==='encargado_oficina')return false;
  const ofs=ins.oficinas||[];
  if(!ofs.length)return true;
  return ofs.includes('guaviare')&&!ofs.some(o=>o!=='guaviare'&&OFICINAS_DEGUV.some(x=>x.id===o&&x.id!=='secretaria'&&x.id!=='guaviare'));
}
function getResponsablesNcaDeguv(){
  const names=getInstructoresActivos('guaviare').filter(instructorEsSoloNcaDeguv).map(i=>i.nombre).filter(Boolean);
  const enc=getEncargadoDepto('guaviare');
  if(enc&&!names.some(n=>agendaNorm(n)===agendaNorm(enc)))names.unshift(enc);
  return [...new Set(names)];
}
function getResponsablesCoEjPool(expId,taskId,t){
  const e=getExpById(expId);
  if(e&&t&&taskEsAtenderPqrs(t,e)&&esOficinaPqrsNca())return getResponsablesNcaDeguv();
  const ex=getExpById(expId);
  const depto=t.depto||(ex&&ex._depto)||deptoActivo;
  if(esModoOficinaDeguv())return getInstructoresOficina(deptoActivo).map(i=>i.nombre).filter(Boolean);
  return getContratistasAsignables(depto);
}
function puedeEliminarTaskPqrs(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskAny(expId,taskId);
  if(e&&t&&taskEsAtenderPqrs(t,e)&&!esSecretaria())return false;
  return true;
}
function syncPqrsFechaSolicitud(e,fechaSol){
  if(!e)return;
  const fs=String(fechaSol||'').trim();
  if(!fs)return;
  const prev=String(e._fecha_solicitud||'').trim();
  e._fecha_solicitud=fs;
  const fe=JSON.parse(e._fechas_estado||'{}');
  fe.Solicitud=fs;
  e._fechas_estado=JSON.stringify(fe);
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  if(prev&&prev!==fs){
    e._pqrs_historial.push({tipo:'ajuste_fecha_solicitud',fecha:hoy(),nota:'Fecha de solicitud del ciudadano actualizada a '+fmtF(fs),fechaSolicitud:fs,por:'Secretaría DEGUV'});
    const ofi=e._pqrs_oficina||'';
    if(ofi&&ofi!=='secretaria'){
      pushPqrsAvisoOficina(e,ofi,'fecha_solicitud',
        '📅 Secretaría actualizó la fecha de solicitud del ciudadano: '+fmtF(prev)+' → '+fmtF(fs)+' · '+e._exp);
    }
  }
}
function syncPqrsRadicacionFecha(e,fechaRadic){
  if(!e)return;
  const fr=String(fechaRadic||'').trim()||hoy();
  e._fecha=fr;
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  let rad=e._pqrs_historial.find(h=>h.tipo==='radicacion');
  if(rad)rad.fecha=fr;
  else e._pqrs_historial.unshift({tipo:'radicacion',fecha:fr,nota:'Radicado por Secretaría DEGUV',oficina:''});
  const fe=JSON.parse(e._fechas_estado||'{}');
  if(e._fecha_solicitud)fe.Solicitud=e._fecha_solicitud;
  else fe.Solicitud=fr;
  fe['En trámite']=fe['En trámite']||fr;
  e._fechas_estado=JSON.stringify(fe);
}
function getDocsPqrsSolicitudCiudadano(e){
  if(!e||!esPqrsSecretaria(e))return[];
  const docs=[];
  if(e._pqrs_solicitud_link){
    const p=parseDrivePreviewUrl(e._pqrs_solicitud_link);
    docs.push({url:p.url||e._pqrs_solicitud_link,preview:p.preview||e._pqrs_solicitud_link,label:'Solicitud PQRSD',tipo:'Documento de solicitud',mime:'',fecha:e._fecha_solicitud||e._fecha||''});
  }
  return docs;
}
function docsTramiteData(v){
  if(!v)return[];
  if(Array.isArray(v))return v.filter(Boolean);
  try{const a=JSON.parse(v);return Array.isArray(a)?a.filter(Boolean):[];}catch(e){return[];}
}
function puedeGestionarDocsTramite(){
  if(esSoloLectura()||esJurisdiccional()||esModoCiudadano())return false;
  if(esModoResponsable())return false;
  if(esSecretaria()||esModoOficinaDeguv())return false;
  return true;
}
function getDocsTramiteCiudadano(e){
  if(!e)return[];
  return docsTramiteData(e._docs_tramite).map(d=>{
    const p=parseDrivePreviewUrl(d.url||'');
    return{
      url:p.url||d.url||'',preview:d.preview||p.preview||p.url||d.url||'',
      label:d.label||'Documento del trámite',tipo:'Documento del trámite',
      mime:'',fecha:d.fecha||''
    };
  }).filter(d=>d.url||d.preview);
}
function instructoresOptsHtml(deptoId,selVal){
  return getContratistasAsignables(deptoId).map(n=>'<option value="'+escAttr(n)+'"'+(selVal===n?' selected':'')+'>'+escAttr(n)+'</option>').join('');
}
function esEncargadoDepto(nombre,deptoId){
  const ins=getInstructoresCfg(deptoId).find(i=>i.nombre===nombre);
  return ins&&ins.rol==='encargado_depto';
}
function hayEncargadosEnDepto(deptoId){
  return getInstructoresCfg(deptoId).some(i=>i.rol==='encargado_depto'&&i.activo!==false&&String(i.nombre||'').trim());
}
function esEncargadoActivo(){
  return !!getEncargadoDepto(deptoActivo)&&!esJurisdiccional()&&!esModoResponsable();
}
function esVistaActividadesDepto(){
  if(esSecretaria())return false;
  if(esModoResponsable()||esJurisdiccional()||esModoCiudadano())return false;
  if(esVistaActividadesOficinaPqrs())return true;
  if(esModoOficinaDeguv())return false;
  if(esNcaDeguv())return true;
  if(esRolDepartamentalCfg()&&deptoActivo===getRolEfectivo())return true;
  if(esAdminModoGlobal()&&DEPTOS.some(d=>d.id===deptoActivo))return true;
  if(!esAdministrador()&&DEPTOS.some(d=>d.id===deptoActivo))return true;
  return hayEncargadosEnDepto(deptoActivo);
}
function esVistaActividadesOficinaPqrs(){
  if(!esModoOficinaDeguv())return false;
  if(!oficinaTieneResponsables(deptoActivo))return false;
  return !!String(getEncargadoOficina(deptoActivo)||'').trim();
}
function getEncargadoDepto(deptoId){
  if(esModuloOficina(deptoId))return getEncargadoOficina(deptoId);
  const ins=getInstructoresCfg(deptoId||deptoActivo).find(i=>i.rol==='encargado_depto'&&i.activo!==false&&String(i.nombre||'').trim());
  return ins?ins.nombre:'';
}
function puedeVerTabActividades(){
  return esModoResponsable()||esVistaActividadesDepto();
}
function puedeVerTabAgenda(){
  return esModoResponsable()||esVistaActividadesDepto();
}
// agendaNorm → js/utils.js
function getAgendaResponsableActivo(){
  if(esModoResponsable())return String(responsableActivo||'').trim();
  if(esVistaActividadesDepto())return String(getEncargadoDepto(deptoActivo)||'').trim();
  return String(responsableActivo||getEncargadoDepto(deptoActivo)||'').trim();
}
function getAgendaEventoById(id){return (agendaEventos||[]).find(x=>x.id===id)||null;}
function puedeEditarAgendaEvento(ev){
  ev=normalizeAgendaEvento(ev);
  const resp=getAgendaResponsableActivo();
  if(esModoResponsable()){
    const r=String(responsableActivo||'').trim();
    if(!r||agendaNorm(ev.responsable)!==agendaNorm(r))return false;
    if(ev.tipo==='asignado')return false;
    return ev.tipo==='personal';
  }
  if(resp&&agendaNorm(ev.responsable)===agendaNorm(resp))return true;
  if(ev.tipo==='asignado'&&esVistaActividadesDepto()){
    return agendaNorm(ev.creadoPor)===agendaNorm(getEncargadoDepto(deptoActivo));
  }
  const autor=taskComentarioAutor();
  if(ev.creadoPor&&autor&&agendaNorm(ev.creadoPor)===agendaNorm(autor))return true;
  return false;
}
function puedeEliminarAgendaEvento(ev){
  ev=normalizeAgendaEvento(ev);
  if(esModoResponsable()){
    const r=String(responsableActivo||'').trim();
    if(!r||agendaNorm(ev.responsable)!==agendaNorm(r))return false;
    return ev.tipo==='personal';
  }
  return puedeEditarAgendaEvento(ev);
}
function agendaSelEvento(id){
  window._agendaSelEvId=id;
  const ev=getAgendaEventoById(id);
  if(ev&&ev.fecha)window._agendaDiaSel=(ev.fecha||'').slice(0,10);
  renderAgenda();
  if(ev)agendaMostrarDrawerEvento(ev);
}
function agendaCerrarDrawer(){
  window._agendaSelEvId=null;
  window._agendaDrawerMode=null;
  const body=document.getElementById('agenda-drawer-body');
  const tit=document.getElementById('agenda-drawer-tit');
  if(tit)tit.textContent='Evento';
  if(body)body.innerHTML='<div style="font-size:12px;color:var(--tx3)">Seleccione un evento del calendario o pulse «+ Evento personal».</div>';
  renderAgenda();
}
function agendaFormHtml(ev,prefill){
  prefill=prefill||{};
  ev=ev||{};
  const titulo=ev.titulo!=null?ev.titulo:(prefill.titulo||'');
  const detalle=ev.detalle!=null?ev.detalle:(prefill.detalle||'');
  const fecha=(ev.fecha||prefill.fecha||window._agendaDiaSel||hoy()).slice(0,10);
  const hora=ev.hora!=null?ev.hora:(prefill.hora||'');
  return '<div class="fld" style="margin-bottom:8px"><label>Título</label><input type="text" id="agenda-f-titulo" value="'+escAttr(titulo)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label><textarea id="agenda-f-detalle" style="width:100%;min-height:64px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif">'+escAttr(detalle)+'</textarea></div>'+
    '<div class="fg" style="margin-bottom:8px"><div class="fld"><label>Fecha</label><input type="date" id="agenda-f-fecha" value="'+escAttr(fecha)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Hora (opcional)</label><input type="time" id="agenda-f-hora" value="'+escAttr(hora)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div></div>';
}
function agendaMostrarDrawerCrear(prefill){
  prefill=prefill||{};
  const resp=getAgendaResponsableActivo();
  if(!resp){notif('Seleccione responsable','err');return;}
  window._agendaDrawerMode='create';
  window._agendaSelEvId=null;
  window._agendaPrefillTask=prefill.taskRef||null;
  const tit=document.getElementById('agenda-drawer-tit');
  const body=document.getElementById('agenda-drawer-body');
  if(tit)tit.textContent='Nuevo evento';
  if(body)body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Para: <strong>'+escAttr(resp)+'</strong></div>'+
    agendaFormHtml(null,prefill)+
    '<div class="fx" style="gap:8px;margin-top:8px"><button type="button" class="btn bsm bp" onclick="agendaGuardarForm()">Guardar</button><button type="button" class="btn bsm" onclick="agendaCerrarDrawer()">Cancelar</button></div>';
  setTimeout(()=>{const inp=document.getElementById('agenda-f-titulo');if(inp)inp.focus();},60);
}
function agendaMostrarDrawerEditar(ev){
  ev=normalizeAgendaEvento(ev);
  if(!puedeEditarAgendaEvento(ev)){notif('No puede editar este evento','err');return;}
  window._agendaDrawerMode='edit';
  window._agendaSelEvId=ev.id;
  const tit=document.getElementById('agenda-drawer-tit');
  const body=document.getElementById('agenda-drawer-body');
  const batchChk=ev.tipo==='asignado'&&ev.batch?'<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="agenda-f-batch" checked> Aplicar a todos los responsables del envío</label>':'';
  if(tit)tit.textContent='Editar evento';
  if(body)body.innerHTML=(ev.tipo==='asignado'?'<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Responsable: '+escAttr(ev.responsable)+'</div>':'')+
    agendaFormHtml(ev)+batchChk+
    '<div class="fx" style="gap:8px;margin-top:8px"><button type="button" class="btn bsm bp" onclick="agendaGuardarForm()">Guardar cambios</button>'+
    (puedeEliminarAgendaEvento(ev)?'<button type="button" class="btn bsm bd2" onclick="agendaEliminarSel()">Eliminar</button>':'')+
    '<button type="button" class="btn bsm" onclick="agendaMostrarDrawerEvento(getAgendaEventoById(\''+escAttr(ev.id)+'\'))">Cancelar</button></div>';
}
function agendaMostrarDrawerEvento(ev){
  ev=normalizeAgendaEvento(ev);
  window._agendaSelEvId=ev.id;
  window._agendaDrawerMode='view';
  const tit=document.getElementById('agenda-drawer-tit');
  const body=document.getElementById('agenda-drawer-body');
  const tag=ev.tipo==='asignado'?'<span class="bdg" style="background:var(--pul);color:var(--pu);font-size:10px">Asignado</span>':ev.tipo==='desde_actividad'?'<span class="bdg" style="background:var(--orl);color:var(--or);font-size:10px">Desde actividad</span>':'<span class="bdg" style="background:var(--bll);color:var(--bl);font-size:10px">Personal</span>';
  const canEdit=puedeEditarAgendaEvento(ev);
  const canDel=puedeEliminarAgendaEvento(ev);
  if(tit)tit.textContent=ev.titulo||'Evento';
  if(body)body.innerHTML=tag+
    '<div style="font-size:13px;font-weight:600;margin:.5rem 0">'+escAttr(ev.titulo)+'</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">📅 '+fmtF(ev.fecha)+(ev.hora?' · 🕐 '+escAttr(ev.hora):'')+'</div>'+
    (ev.detalle?'<div style="font-size:12px;margin-bottom:8px;white-space:pre-wrap">'+escAttr(ev.detalle)+'</div>':'')+
    (ev.creadoPor?'<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Creado por: '+escAttr(ev.creadoPor)+'</div>':'')+
    (ev.taskRef&&ev.taskRef.taskId?'<button type="button" class="btn bsm" style="margin-bottom:8px" onclick="openTaskCommentsModal(\''+escAttr(ev.taskRef.expId||ev.taskRef.exp||'')+'\',\''+escAttr(ev.taskRef.taskId)+'\')">Ver actividad vinculada</button>':'')+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    (canEdit?'<button type="button" class="btn bsm bp" onclick="agendaMostrarDrawerEditar(getAgendaEventoById(\''+escAttr(ev.id)+'\'))">✏️ Editar</button>':'')+
    (canDel?'<button type="button" class="btn bsm bd2" onclick="agendaEliminarSel()">Eliminar</button>':'')+
    '</div>';
}
function agendaLeerForm(){
  return{
    titulo:(document.getElementById('agenda-f-titulo')||{}).value,
    detalle:(document.getElementById('agenda-f-detalle')||{}).value,
    fecha:(document.getElementById('agenda-f-fecha')||{}).value,
    hora:(document.getElementById('agenda-f-hora')||{}).value
  };
}
function agendaGuardarForm(){
  const f=agendaLeerForm();
  const mode=window._agendaDrawerMode;
  if(mode==='edit'&&window._agendaSelEvId){
    const batchEl=document.getElementById('agenda-f-batch');
    if(actualizarAgendaEvento(window._agendaSelEvId,{...f,aplicarBatch:!!(batchEl&&batchEl.checked)})){
      notif('Evento actualizado','ok');
      const ev=getAgendaEventoById(window._agendaSelEvId);
      if(ev)agendaMostrarDrawerEvento(ev);
    }
    return;
  }
  const resp=getAgendaResponsableActivo();
  const tipo=window._agendaPrefillTask?'desde_actividad':'personal';
  const ev=crearAgendaEvento({...f,responsable:resp,tipo,taskRef:window._agendaPrefillTask||null,depto:esModoResponsable()?'responsables':deptoActivo});
  if(ev){
    window._agendaPrefillTask=null;
    window._agendaDiaSel=(f.fecha||'').slice(0,10);
    notif('Evento guardado','ok');
    agendaMostrarDrawerEvento(ev);
  }
}
function agendaEliminarSel(){
  const id=window._agendaSelEvId;
  if(!id)return;
  eliminarAgendaEvento(id);
  agendaCerrarDrawer();
}
function genAgendaId(){return 'ag_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);}
function normalizeAgendaEvento(ev){
  if(!ev)return ev;
  if(!ev.id)ev.id=genAgendaId();
  if(!ev.fecha)ev.fecha=hoy();
  if(!ev.tipo)ev.tipo='personal';
  if(ev.leido==null)ev.leido=ev.tipo==='asignado'?false:true;
  return ev;
}
function getTaskRefEstado(expId,taskId){
  const t=getTaskAny(expId,taskId);
  return t?estadoTask(t):'';
}
function agendaEventoVisible(ev){
  ev=normalizeAgendaEvento(ev);
  if(ev.taskRef&&ev.taskRef.taskId){
    const est=getTaskRefEstado(ev.taskRef.expId||ev.taskRef.exp, ev.taskRef.taskId);
    if(est==='Atendida')return false;
  }
  return true;
}
function getAgendaEventosResponsable(nombre,deptoId){
  const n=String(nombre||'').trim();
  if(!n)return [];
  const depto=deptoId||deptoActivo;
  const nNorm=agendaNorm(n);
  return (agendaEventos||[]).map(normalizeAgendaEvento).filter(ev=>{
    if(depto!=='responsables'&&ev.depto&&ev.depto!==depto&&ev.depto!=='responsables')return false;
    if(agendaNorm(ev.responsable)!==nNorm)return false;
    return agendaEventoVisible(ev);
  });
}
function marcarAgendaLeido(id){
  const ev=(agendaEventos||[]).find(x=>x.id===id);
  if(ev){ev.leido=true;saveLS();renderBandejaDepto();}
}
function crearAgendaEvento(data){
  const ev=normalizeAgendaEvento({
    id:genAgendaId(),
    titulo:String(data.titulo||'').trim(),
    detalle:String(data.detalle||'').trim(),
    fecha:data.fecha||hoy(),
    hora:String(data.hora||'').trim(),
    responsable:String(data.responsable||'').trim(),
    depto:data.depto||deptoActivo,
    creadoPor:data.creadoPor||getAgendaResponsableActivo()||taskComentarioAutor(),
    tipo:data.tipo||'personal',
    taskRef:data.taskRef||null,
    leido:data.tipo==='asignado'?false:true,
    creado:new Date().toISOString()
  });
  if(!ev.titulo||!ev.responsable){notif('Indique título y responsable','err');return null;}
  agendaEventos.push(ev);
  saveLS();
  renderBandejaDepto();
  if(document.getElementById('pg-agenda').classList.contains('on'))renderAgenda();
  return ev;
}
function crearAgendaEventosAsignados(data,nombres){
  const list=(nombres||[]).filter(Boolean);
  if(!list.length){notif('Seleccione al menos un responsable','err');return 0;}
  const batch='batch_'+Date.now();
  list.forEach(n=>{
    crearAgendaEvento({...data,responsable:n,tipo:'asignado',leido:false,batch});
  });
  notif('Evento enviado a '+list.length+' responsable(s) — aparecerá en su campanita','ok');
  return list.length;
}
function agendaMesDelta(d){
  const v=window._agendaVista||'mes';
  const m=window._agendaMes||new Date();
  if(v==='dia'){
    const ds=window._agendaDiaSel||hoy();
    const dd=new Date(ds+'T12:00:00');dd.setDate(dd.getDate()+d);
    window._agendaDiaSel=dd.toISOString().slice(0,10);
    window._agendaMes=new Date(dd.getFullYear(),dd.getMonth(),1);
  }else if(v==='semana'){
    const start=agendaSemanaInicio(m,window._agendaDiaSel);
    start.setDate(start.getDate()+d*7);
    window._agendaMes=new Date(start.getFullYear(),start.getMonth(),1);
    window._agendaDiaSel=start.toISOString().slice(0,10);
  }else{
    window._agendaMes=new Date(m.getFullYear(),m.getMonth()+d,1);
    window._agendaDiaSel=window._agendaMes.toISOString().slice(0,10);
  }
  renderAgenda();
}
function agendaNav(d){agendaMesDelta(d);}
function agendaSetVista(v){
  window._agendaVista=v||'mes';
  const vs=['mes','semana','dia'];
  document.querySelectorAll('#agenda-view-tabs button').forEach((b,i)=>b.classList.toggle('on',vs[i]===window._agendaVista));
  renderAgenda();
}
function agendaSemanaInicio(mesRef,diaSel){
  const ref=diaSel?new Date(diaSel+'T12:00:00'):new Date((mesRef||new Date()).getFullYear(),(mesRef||new Date()).getMonth(),1);
  const start=new Date(ref);
  start.setDate(ref.getDate()-(ref.getDay()+6)%7);
  return start;
}
function agendaIrHoy(){
  window._agendaMes=new Date();
  window._agendaDiaSel=hoy();
  renderAgenda();
}
function agendaSelDia(f){
  window._agendaDiaSel=f;
  renderAgenda();
}
function agendaPeriodoLabel(){
  const v=window._agendaVista||'mes';
  const mesRef=window._agendaMes||new Date();
  const diaSel=window._agendaDiaSel||hoy();
  if(v==='dia'){
    const d=new Date(diaSel+'T12:00:00');
    return d.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
  if(v==='semana'){
    const s=agendaSemanaInicio(mesRef,diaSel);
    const e=new Date(s);e.setDate(s.getDate()+6);
    return fmtF(s.toISOString().slice(0,10))+' — '+fmtF(e.toISOString().slice(0,10));
  }
  return agendaMesLabel(mesRef);
}
function renderAgendaSemanaGrid(eventos,mesRef,diaSel){
  const start=agendaSemanaInicio(mesRef,diaSel);
  const todayStr=hoy();
  const hdrs=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let h='<div class="agenda-week">';
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const fs=d.toISOString().slice(0,10);
    const dayEv=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===fs).sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99'));
    h+='<div class="agenda-week-col'+(fs===todayStr?' today':'')+'">'+
      '<div class="agenda-week-col-hdr'+(fs===todayStr?' today':'')+'" onclick="agendaSelDia(\''+fs+'\')">'+hdrs[i]+'<br><span style="font-size:15px">'+d.getDate()+'</span></div>'+
      '<div class="agenda-week-col-body">'+dayEv.map(ev=>{
        const dc=ev.tipo==='asignado'?' asig':ev.tipo==='desde_actividad'?' act':'';
        return '<div class="agenda-cal-ev'+dc+'" style="margin-bottom:3px" onclick="agendaSelEvento(\''+escAttr(ev.id)+'\')">'+(ev.hora?escAttr(ev.hora)+' ':'')+escAttr(ev.titulo)+'</div>';
      }).join('')+(dayEv.length?'':'<span style="color:var(--tx3);font-size:10px">—</span>')+'</div></div>';
  }
  return h+'</div>';
}
function renderAgendaDiaView(eventos,diaSel){
  const list=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===diaSel).sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99'));
  const selEv=window._agendaSelEvId;
  const d=new Date(diaSel+'T12:00:00');
  let h='<div class="agenda-day-view"><div class="agenda-day-view-hdr">'+d.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</div>';
  if(!list.length)h+='<div style="font-size:13px;color:var(--tx3);padding:1rem 0">Sin eventos. Pulse «+ Evento personal» para agendar.</div>';
  else h+=list.map(ev=>{
    const dc=ev.tipo==='asignado'?'border-left:3px solid var(--pu)':ev.tipo==='desde_actividad'?'border-left:3px solid var(--or)':'border-left:3px solid var(--bl)';
    return '<div class="agenda-day-slot'+(ev.id===selEv?' sel':'')+'" style="'+dc+'" onclick="agendaSelEvento(\''+escAttr(ev.id)+'\')">'+
      '<div class="agenda-day-slot-time">'+(ev.hora||'—')+'</div>'+
      '<div style="flex:1"><div style="font-weight:600;font-size:14px">'+escAttr(ev.titulo)+'</div>'+
      (ev.detalle?'<div style="font-size:12px;color:var(--tx2);margin-top:2px">'+escAttr(ev.detalle)+'</div>':'')+'</div></div>';
  }).join('');
  return h+'</div>';
}
function agendaMesLabel(d){
  return d.toLocaleDateString('es-CO',{month:'long',year:'numeric'});
}
function renderAgendaCalGrid(eventos,mesRef,diaSel){
  const y=mesRef.getFullYear(),mo=mesRef.getMonth();
  const first=new Date(y,mo,1);
  const start=new Date(y,mo,1-(first.getDay()+6)%7);
  const hdrs=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let h=hdrs.map(x=>'<div class="agenda-cal-hdr">'+x+'</div>').join('');
  const todayStr=hoy();
  const selEv=window._agendaSelEvId;
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const fs=d.toISOString().slice(0,10);
    const inMonth=d.getMonth()===mo;
    const dayEv=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===fs);
    const cls='agenda-day'+(inMonth?'':' other')+(fs===todayStr?' today':'')+(fs===diaSel?' sel':'');
    h+='<div class="'+cls+'" onclick="agendaSelDia(\''+fs+'\')">'+
      '<div class="agenda-day-num">'+d.getDate()+'</div>'+
      '<div class="agenda-day-events">'+dayEv.slice(0,4).map(ev=>{
        const dc=ev.tipo==='asignado'?' asig':ev.tipo==='desde_actividad'?' act':'';
        return '<div class="agenda-cal-ev'+dc+'" onclick="event.stopPropagation();agendaSelEvento(\''+escAttr(ev.id)+'\')" title="'+escAttr(ev.titulo)+'">'+escAttr(ev.titulo)+'</div>';
      }).join('')+(dayEv.length>4?'<div style="font-size:9px;color:var(--tx3)">+'+(dayEv.length-4)+' más</div>':'')+'</div></div>';
  }
  return h;
}
function renderAgendaListaHtml(eventos,diaSel){
  const list=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===diaSel).sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99'));
  if(!list.length)return '<div style="font-size:12px;color:var(--tx3);padding:8px">Sin eventos este día. Pulse «+ Evento personal» para crear uno.</div>';
  const selEv=window._agendaSelEvId;
  return list.map(ev=>{
    const horaLbl=ev.hora?('<span style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl);min-width:52px">'+escAttr(ev.hora)+'</span>'):('<span style="font-size:12px;color:var(--tx3);min-width:52px">—</span>');
    return '<div class="agenda-ev-row'+(ev.id===selEv?' sel':'')+'" onclick="agendaSelEvento(\''+escAttr(ev.id)+'\')">'+horaLbl+
      '<span style="font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escAttr(ev.titulo)+'</span></div>';
  }).join('');
}
function getAgendaEventosCreadosPorEncargado(){
  const enc=getEncargadoDepto(deptoActivo);
  if(!enc)return [];
  return (agendaEventos||[]).map(normalizeAgendaEvento).filter(ev=>
    ev.tipo==='asignado'&&agendaNorm(ev.creadoPor)===agendaNorm(enc)&&(ev.depto||deptoActivo)===deptoActivo
  ).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
function renderAgendaAsignadosGestHtml(){
  const list=getAgendaEventosCreadosPorEncargado();
  if(!list.length)return '<div style="font-size:12px;color:var(--tx3)">Sin eventos asignados a responsables.</div>';
  const byBatch={};
  list.forEach(ev=>{
    const k=ev.batch||ev.id;
    if(!byBatch[k])byBatch[k]={ev,dest:[]};
    if(!byBatch[k].dest.includes(ev.responsable))byBatch[k].dest.push(ev.responsable);
  });
  return Object.values(byBatch).map(({ev,dest})=>{
    return '<div class="agenda-item asig" style="margin-bottom:8px"><div class="agenda-item-hdr"><strong>'+escAttr(ev.titulo)+'</strong>'+
      '<span class="bdg" style="background:var(--pul);color:var(--pu);font-size:10px">Asignado</span></div>'+
      '<div style="font-size:11px;color:var(--tx2)">'+fmtF(ev.fecha)+(ev.hora?' · '+escAttr(ev.hora):'')+' · '+dest.length+' responsable(s)</div>'+
      (ev.detalle?'<div style="margin-top:3px;font-size:12px">'+escAttr(ev.detalle)+'</div>':'')+
      '<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+escAttr(dest.join(', '))+'</div>'+
      '<button type="button" class="btn bsm bic" style="margin-top:4px" title="Editar evento asignado" onclick="agendaSelEvento(\''+escAttr(ev.id)+'\')">✏️ Editar</button></div>';
  }).join('');
}
function actualizarAgendaEvento(id,data){
  const ev=(agendaEventos||[]).find(x=>x.id===id);
  if(!ev){notif('Evento no encontrado','err');return false;}
  if(!puedeEditarAgendaEvento(ev)){notif('No puede editar este evento','err');return false;}
  const upd={
    titulo:String(data.titulo||'').trim(),
    detalle:String(data.detalle||'').trim(),
    fecha:data.fecha||ev.fecha,
    hora:String(data.hora||'').trim()
  };
  if(!upd.titulo){notif('Indique título','err');return false;}
  if(data.aplicarBatch&&ev.batch){
    (agendaEventos||[]).forEach(e=>{if(e.batch===ev.batch)Object.assign(e,upd);});
  }else Object.assign(ev,upd);
  saveLS();renderAgenda();renderBandejaDepto();
  return true;
}
function openAgendaEditModal(id){
  const ev=getAgendaEventoById(id);
  if(ev)agendaSelEvento(id);
}
function submitAgendaEditar(){
  agendaGuardarForm();
}
function eliminarAgendaEvento(id){
  const ev=(agendaEventos||[]).find(x=>x.id===id);
  if(ev&&!puedeEliminarAgendaEvento(ev)){notif('No puede eliminar este evento','err');return;}
  confirmEliminar({message:'¿Eliminar este evento de la agenda?',detail:ev?('«'+ev.titulo+'»'):''},()=>{
    agendaEventos=(agendaEventos||[]).filter(x=>x.id!==id);
    saveLS();renderAgenda();renderBandejaDepto();notif('Evento eliminado','ok');
  });
}
function renderAgenda(){
  if(!puedeVerTabAgenda())return;
  const resp=getAgendaResponsableActivo();
  const tit=document.getElementById('agenda-titulo');
  const sub=document.getElementById('agenda-subtitulo');
  const btnAsig=document.getElementById('btn-agenda-asignar');
  if(!resp){
    if(tit)tit.textContent='Mi agenda';
    if(sub)sub.textContent='Seleccione su nombre como responsable para ver su calendario.';
    if(document.getElementById('agenda-cal-grid'))document.getElementById('agenda-cal-grid').innerHTML='';
    if(document.getElementById('agenda-lista'))document.getElementById('agenda-lista').innerHTML='<div style="font-size:12px;color:var(--tx3);padding:8px">Sin responsable seleccionado.</div>';
    return;
  }
  if(tit)tit.textContent='Agenda · '+resp;
  if(sub)sub.textContent='Vista '+({mes:'mensual',semana:'semanal',dia:'diaria'}[window._agendaVista||'mes']||'mensual')+' · clic en evento para editar';
  if(btnAsig)btnAsig.style.display=esVistaActividadesDepto()?'inline-flex':'none';
  const mesRef=window._agendaMes||new Date();
  const diaSel=window._agendaDiaSel||hoy();
  const eventos=getAgendaEventosResponsable(resp);
  const vista=window._agendaVista||'mes';
  document.querySelectorAll('#agenda-view-tabs button').forEach((b,i)=>b.classList.toggle('on',['mes','semana','dia'][i]===vista));
  const lbl=document.getElementById('agenda-mes-label');
  if(lbl)lbl.textContent=agendaPeriodoLabel();
  const wrap=document.getElementById('agenda-cal-wrap');
  const grid=document.getElementById('agenda-cal-grid');
  if(wrap&&grid){
    if(vista==='mes'){
      wrap.style.display='';
      grid.className='agenda-cal';
      grid.innerHTML=renderAgendaCalGrid(eventos,mesRef,diaSel);
    }else if(vista==='semana'){
      wrap.style.display='';
      grid.className='';
      grid.innerHTML=renderAgendaSemanaGrid(eventos,mesRef,diaSel);
    }else{
      wrap.style.display='';
      grid.className='';
      grid.innerHTML=renderAgendaDiaView(eventos,diaSel);
    }
  }
  const lt=document.getElementById('agenda-lista-titulo');
  const lista=document.getElementById('agenda-lista');
  const showBottom=vista==='mes'||vista==='semana';
  if(lt){
    lt.style.display=showBottom?'':'none';
    if(showBottom)lt.textContent='Eventos · '+fmtF(diaSel);
  }
  if(lista){
    lista.style.display=showBottom?'':'none';
    if(showBottom)lista.innerHTML=renderAgendaListaHtml(eventos,diaSel);
  }
  const gest=document.getElementById('agenda-asig-gest');
  if(gest){
    if(esVistaActividadesDepto()){
      gest.style.display='';
      gest.innerHTML='<details class="con-fold"><summary>Eventos asignados a responsables (editar)</summary><div class="item-fold-body">'+renderAgendaAsignadosGestHtml()+'</div></details>';
    }else gest.style.display='none';
  }
}
function openAgendaEventoModal(prefill){
  prefill=prefill||{};
  agendaMostrarDrawerCrear(prefill);
}
function submitAgendaEventoPersonal(){
  agendaGuardarForm();
}
function openAgendaAsignarModal(){
  if(!esVistaActividadesDepto()){notif('Solo el encargado del departamento puede asignar eventos','err');return;}
  const names=getContratistasAsignables(deptoActivo);
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Evento para responsables del departamento';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const chk=names.map(n=>'<label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:4px"><input type="checkbox" class="agenda-asig-chk" value="'+escAttr(n)+'"> '+escAttr(n)+'</label>').join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">El evento aparecerá en la agenda de cada responsable seleccionado y en su campanita 🔔.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Título</label><input type="text" id="agenda-asig-titulo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label><textarea id="agenda-asig-detalle" style="width:100%;min-height:52px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif"></textarea></div>'+
    '<div class="fg" style="margin-bottom:8px"><div class="fld"><label>Fecha</label><input type="date" id="agenda-asig-fecha" value="'+hoy()+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Hora (opcional)</label><input type="time" id="agenda-asig-hora" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div></div>'+
    '<div style="margin-bottom:8px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Destinatarios</label>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:6px;font-weight:600"><input type="checkbox" id="agenda-asig-todos" onchange="toggleAgendaAsigTodos()"> Todos los responsables</label>'+
    '<div id="agenda-asig-chks" style="max-height:160px;overflow:auto;border:1px solid var(--bd);border-radius:var(--r);padding:8px;background:var(--sf2)">'+chk+'</div></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitAgendaAsignar()">Enviar a responsables</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
}
function toggleAgendaAsigTodos(){
  const all=document.getElementById('agenda-asig-todos');
  document.querySelectorAll('.agenda-asig-chk').forEach(c=>{c.checked=!!(all&&all.checked);});
}
function submitAgendaAsignar(){
  const tit=(document.getElementById('agenda-asig-titulo')||{}).value;
  const det=(document.getElementById('agenda-asig-detalle')||{}).value;
  const fecha=(document.getElementById('agenda-asig-fecha')||{}).value;
  const hora=(document.getElementById('agenda-asig-hora')||{}).value;
  const nombres=Array.from(document.querySelectorAll('.agenda-asig-chk:checked')).map(c=>c.value);
  if(crearAgendaEventosAsignados({titulo:tit,detalle:det,fecha,hora,depto:deptoActivo,creadoPor:getEncargadoDepto(deptoActivo)},nombres)){
    closeTaskModal();
  }
}
function getAgendaEventosForTask(expId,taskId){
  const eId=String(expId||'').trim();
  const tId=String(taskId||'').trim();
  if(!eId||!tId)return [];
  return (agendaEventos||[]).map(normalizeAgendaEvento).filter(ev=>{
    if(!ev.taskRef||!ev.taskRef.taskId)return false;
    const refExp=String(ev.taskRef.expId||ev.taskRef.exp||'').trim();
    return ev.taskRef.taskId===tId&&refExp===eId&&agendaEventoVisible(ev);
  });
}
function taskAgendaResumen(expId,taskId){
  const evs=getAgendaEventosForTask(expId,taskId).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  return evs[0]||null;
}
function puedeAgendarTask(t){
  if(!t||estadoTask(t)==='Atendida')return false;
  if(!puedeVerTabAgenda())return false;
  if(esModoResponsable())return taskUsuarioEsAsignado(t,responsableActivo);
  if(esVistaActividadesDepto())return esTareaDelEncargado(t);
  return false;
}
function taskAgendaBtnHtml(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!puedeAgendarTask(t))return '';
  const ag=taskAgendaResumen(expId,taskId);
  const exp=escAttr(expId),tid=escAttr(taskId);
  if(ag){
    const tip='Agendado · '+fmtF(ag.fecha)+(ag.hora?' · '+ag.hora:'')+' · Clic para revisar o agendar otra fecha';
    return '<button type="button" class="btn bsm bic act-agendada-on" title="'+escAttr(tip)+'" onclick="openAgendaDesdeActividad(\''+exp+'\',\''+tid+'\')">📆</button>'+
      '<span class="task-agendada-tag" title="'+escAttr(tip)+'">📅 '+fmtF(ag.fecha)+'</span>';
  }
  return '<button type="button" class="btn bsm bic" title="Agendar en calendario" onclick="openAgendaDesdeActividad(\''+exp+'\',\''+tid+'\')">📅</button>';
}
function taskEntregaComentariosCount(t){
  if(!t)return 0;
  return (t.comentarios||[]).filter(c=>c.incluidoEnReporte&&String(c.texto||'').trim()).length;
}
function taskEntregaCmtBadgeHtml(t){
  const n=taskEntregaComentariosCount(t);
  return n>0?'<span class="cmt-dot" title="'+n+' comentario(s) en entrega(s)">'+n+'</span>':'';
}
function taskReporteBtnHtml(expId,taskId,yo){
  const t=getTaskAny(expId,taskId);
  if(!t||!yo)return '';
  const usuario=responsableActivo;
  const esEncOwn=esTareaDelEncargado(t);
  const est=estadoTask(t);
  const miEst=taskEsMultiAsignada(t)&&usuario?estadoTaskForAsignado(t,usuario):est;
  const exp=escAttr(expId),tid=escAttr(taskId);
  const cmtBadge=taskEntregaCmtBadgeHtml(t);
  const cmtN=taskEntregaComentariosCount(t);
  const cmtTip=cmtN?(' · '+cmtN+' comentario(s) de entrega'):'';
  if(esEncOwn){
    return '<button type="button" class="btn bsm bp" title="Finalizar actividad" onclick="respMarcarPorVerificar(\''+exp+'\',\''+tid+'\')">✓</button>';
  }
  if(miEst==='Por verificar'||(est==='Por verificar'&&t.entregaModo==='unificada'&&taskUsuarioEsAsignado(t,usuario))){
    const a=usuario?getAsignado(t,usuario):null;
    const f=(a&&a.fechaReportada)||t.fechaReportada||'';
    const tip='Enviada para verificación · '+fmtF(f)+cmtTip+' · Clic para reenviar';
    return '<button type="button" class="btn bsm bic act-reportada-on" title="'+escAttr(tip)+'" onclick="respMarcarPorVerificar(\''+exp+'\',\''+tid+'\')">📤'+cmtBadge+'</button>'+
      '<span class="task-reportada-tag" title="'+escAttr(tip)+'">📤 '+fmtF(f)+'</span>';
  }
  if(miEst==='Atendida')return '';
  if(!puedeReportarTask(t,usuario))return '';
  const title=(miEst==='Por corregir'?'Entrega — nueva corrección':'Entrega de actividad')+cmtTip;
  return '<button type="button" class="btn bsm bp" title="'+escAttr(title)+'" onclick="respMarcarPorVerificar(\''+exp+'\',\''+tid+'\')">📤'+cmtBadge+'</button>';
}
function refreshVistasTrasAgendar(){
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
}
function openAgendaDesdeActividad(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!t)return;
  if(t.sinExpediente)expId=t.codigo;
  const resp=getAgendaResponsableActivo()||t.responsable;
  if(!resp){notif('Seleccione responsable','err');return;}
  const fecha=t.vence&&t.vence>=hoy()?t.vence:hoy();
  const prefill={
    titulo:t.desc||t.actividad||'Actividad',
    detalle:(t.exp?'Ref. '+t.exp:'')+(t.vence?' · Vence '+fmtF(t.vence):''),
    fecha:fecha,
    responsable:resp,
    taskRef:{expId,taskId}
  };
  window._agendaPrefillTask=prefill.taskRef;
  window._actAgendaPrefillBase=prefill;
  window._actAgendaExpId=expId;
  window._actAgendaTaskId=taskId;
  window._actAgendaDrawerMode='create';
  window._actAgendaSelEvId=null;
  window._actAgendaMes=new Date(fecha+'T12:00:00');
  window._actAgendaDiaSel=fecha;
  window._actAgendaResp=resp;
  const panel=document.getElementById('act-agenda-panel');
  const overlay=document.getElementById('act-agenda-overlay');
  const body=document.getElementById('act-agenda-body');
  const sub=document.getElementById('act-agenda-sub');
  if(sub)sub.textContent=(t.exp||expId)+' · '+(t.desc||t.actividad||'Actividad');
  if(body)body.innerHTML=renderActAgendaPanelHtml(prefill,resp,expId,taskId);
  if(overlay)overlay.classList.add('on');
  if(panel)panel.classList.add('on');
  refreshActAgendaPanelCal();
  setTimeout(function(){
    const inp=document.getElementById('agenda-f-titulo');if(inp)inp.focus();
    const fd=document.getElementById('agenda-f-fecha');
    if(fd&&!fd._actAgendaBound){
      fd._actAgendaBound=true;
      fd.addEventListener('change',function(){if(document.getElementById('act-agenda-panel')&&document.getElementById('act-agenda-panel').classList.contains('on'))actAgendaSelDia(this.value);});
    }
  },80);
}
function renderActAgendaFormInner(){
  const resp=window._actAgendaResp||getAgendaResponsableActivo();
  const mode=window._actAgendaDrawerMode||'create';
  const selId=window._actAgendaSelEvId;
  const ev=selId?getAgendaEventoById(selId):null;
  const prefill=ev?{titulo:ev.titulo,detalle:ev.detalle,fecha:ev.fecha,hora:ev.hora}:(window._actAgendaPrefillBase||{});
  const expId=window._actAgendaExpId;
  const taskId=window._actAgendaTaskId;
  const existentes=expId&&taskId?getAgendaEventosForTask(expId,taskId):[];
  let aviso='';
  if(mode==='edit'&&ev){
    aviso='<div style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:var(--bll);border:1px solid #b8d2eb;font-size:12px;color:var(--bl)">✏️ Editando: <strong>'+escAttr(ev.titulo)+'</strong> · '+fmtF(ev.fecha)+'</div>';
  }else if(existentes.length){
    aviso='<div style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:var(--gnl);border:1px solid #b8dfb8;font-size:12px;color:var(--gn)">✓ '+existentes.length+' agendamiento(s) vinculado(s) a esta actividad.</div>';
  }
  const linkedList=existentes.length?('<div style="margin-bottom:10px;font-size:12px"><div style="font-weight:600;margin-bottom:4px;color:var(--tx2)">Agendamientos de esta actividad</div>'+
    existentes.map(e=>{
      const on=e.id===selId;
      const canEd=puedeEditarAgendaEvento(e);
      const canDel=puedeEliminarAgendaEvento(e);
      return '<div class="fx" style="gap:6px;align-items:center;margin-bottom:4px;padding:4px 6px;border-radius:var(--r);background:'+(on?'var(--bll)':'#eef4fb')+'">'+
        '<span style="flex:1;font-size:12px">'+fmtF(e.fecha)+(e.hora?' · '+escAttr(e.hora):'')+' · '+escAttr(e.titulo)+'</span>'+
        (canEd?'<button type="button" class="btn bsm bic" onclick="actAgendaSelEvento(\''+escAttr(e.id)+'\')" title="Editar">✏️</button>':'')+
        (canDel?'<button type="button" class="btn bsm bic bd2" onclick="actAgendaEliminar(\''+escAttr(e.id)+'\')" title="Eliminar">🗑</button>':'')+
        '</div>';
    }).join('')+'</div>'):'';
  const canDelSel=ev&&puedeEliminarAgendaEvento(ev);
  const btns=mode==='edit'?
    '<button type="button" class="btn bsm bp" onclick="actAgendaGuardarForm()">Guardar cambios</button>'+
    (canDelSel?'<button type="button" class="btn bsm bd2" onclick="actAgendaEliminar()">Eliminar</button>':'')+
    '<button type="button" class="btn bsm" onclick="actAgendaNuevoEvento()">+ Nuevo</button>'+
    '<button type="button" class="btn bsm" onclick="cerrarActAgendaPanel()">Cerrar</button>':
    '<button type="button" class="btn bsm bp" onclick="actAgendaGuardarForm()">Guardar en agenda</button>'+
    (existentes.length?'<button type="button" class="btn bsm" onclick="actAgendaNuevoEvento()">Limpiar</button>':'')+
    '<button type="button" class="btn bsm" onclick="cerrarActAgendaPanel()">Cancelar</button>';
  return aviso+linkedList+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Para: <strong>'+escAttr(resp)+'</strong></div>'+
    agendaFormHtml(ev,prefill)+
    '<div class="fx" style="gap:8px;margin-top:12px;flex-wrap:wrap">'+btns+'</div>';
}
function actAgendaRefreshForm(){
  const wrap=document.querySelector('.act-agenda-form-wrap');
  if(wrap)wrap.innerHTML=renderActAgendaFormInner();
}
function actAgendaSelEvento(id){
  const ev=getAgendaEventoById(id);
  if(!ev)return;
  if(!puedeEditarAgendaEvento(ev)){notif('No puede editar este evento','err');return;}
  window._actAgendaSelEvId=id;
  window._actAgendaDrawerMode='edit';
  window._actAgendaDiaSel=(ev.fecha||'').slice(0,10);
  actAgendaRefreshForm();
  refreshActAgendaPanelCal();
}
function actAgendaNuevoEvento(){
  window._actAgendaSelEvId=null;
  window._actAgendaDrawerMode='create';
  actAgendaRefreshForm();
  refreshActAgendaPanelCal();
}
function actAgendaEliminar(id){
  id=id||window._actAgendaSelEvId;
  if(!id)return;
  const ev=getAgendaEventoById(id);
  if(ev&&!puedeEliminarAgendaEvento(ev)){notif('No puede eliminar este evento','err');return;}
  confirmEliminar({message:'¿Eliminar este evento de la agenda?',detail:ev?('«'+ev.titulo+'»'):''},()=>{
    agendaEventos=(agendaEventos||[]).filter(x=>x.id!==id);
    saveLS();
    if(document.getElementById('pg-agenda')&&document.getElementById('pg-agenda').classList.contains('on'))renderAgenda();
    renderBandejaDepto();
    notif('Evento eliminado','ok');
    if(window._actAgendaSelEvId===id){
      window._actAgendaSelEvId=null;
      window._actAgendaDrawerMode='create';
    }
    actAgendaRefreshForm();
    refreshActAgendaPanelCal();
    refreshVistasTrasAgendar();
  });
}
function renderActAgendaPanelHtml(prefill,resp,expId,taskId){
  return '<div class="act-agenda-layout">'+
    '<div class="act-agenda-cal-wrap">'+
    '<div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px">Calendario · eventos agendados</div>'+
    '<div class="fx" style="justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">'+
    '<button type="button" class="btn bsm bic" onclick="actAgendaNav(-1)" title="Mes anterior">◀</button>'+
    '<strong id="act-agenda-mes-label" style="font-size:13px;flex:1;text-align:center"></strong>'+
    '<button type="button" class="btn bsm bic" onclick="actAgendaNav(1)" title="Mes siguiente">▶</button></div>'+
    '<div id="act-agenda-cal-grid" class="agenda-cal"></div>'+
    '<div id="act-agenda-dia-tit" style="font-size:11px;font-weight:600;color:var(--tx2);margin-top:8px"></div>'+
    '<div id="act-agenda-dia-list" class="act-agenda-dia-list"></div></div>'+
    '<div class="act-agenda-form-wrap">'+renderActAgendaFormInner()+'</div></div>';
}
function actAgendaNav(d){
  const m=window._actAgendaMes||new Date();
  m.setMonth(m.getMonth()+d);
  window._actAgendaMes=m;
  refreshActAgendaPanelCal();
}
function actAgendaSelDia(f){
  if(!f)return;
  window._actAgendaDiaSel=f;
  const fd=document.getElementById('agenda-f-fecha');
  if(fd)fd.value=f;
  refreshActAgendaPanelCal();
}
function renderActAgendaCalGrid(eventos,mesRef,diaSel){
  const y=mesRef.getFullYear(),mo=mesRef.getMonth();
  const first=new Date(y,mo,1);
  const start=new Date(y,mo,1-(first.getDay()+6)%7);
  const hdrs=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let h=hdrs.map(x=>'<div class="agenda-cal-hdr">'+x+'</div>').join('');
  const todayStr=hoy();
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const fs=d.toISOString().slice(0,10);
    const inMonth=d.getMonth()===mo;
    const dayEv=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===fs);
    const cls='agenda-day'+(inMonth?'':' other')+(fs===todayStr?' today':'')+(fs===diaSel?' sel':'');
    h+='<div class="'+cls+'" onclick="actAgendaSelDia(\''+fs+'\')">'+
      '<div class="agenda-day-num">'+d.getDate()+'</div>'+
      '<div class="agenda-day-events">'+dayEv.slice(0,3).map(ev=>{
        const dc=ev.tipo==='asignado'?' asig':ev.tipo==='desde_actividad'?' act':'';
        return '<div class="agenda-cal-ev'+dc+'" onclick="event.stopPropagation();actAgendaSelEvento(\''+escAttr(ev.id)+'\')" title="'+escAttr(ev.titulo)+(ev.hora?' · '+escAttr(ev.hora):'')+'">'+escAttr(ev.titulo)+'</div>';
      }).join('')+(dayEv.length>3?'<div style="font-size:9px;color:var(--tx3)">+'+(dayEv.length-3)+' más</div>':'')+'</div></div>';
  }
  return h;
}
function refreshActAgendaPanelCal(){
  const grid=document.getElementById('act-agenda-cal-grid');
  const lbl=document.getElementById('act-agenda-mes-label');
  const list=document.getElementById('act-agenda-dia-list');
  const lt=document.getElementById('act-agenda-dia-tit');
  if(!grid)return;
  const resp=window._actAgendaResp||getAgendaResponsableActivo();
  const mesRef=window._actAgendaMes||new Date();
  const diaSel=window._actAgendaDiaSel||hoy();
  const eventos=resp?getAgendaEventosResponsable(resp):[];
  if(lbl)lbl.textContent=agendaMesLabel(mesRef);
  grid.innerHTML=renderActAgendaCalGrid(eventos,mesRef,diaSel);
  const dayEv=eventos.filter(ev=>(ev.fecha||'').slice(0,10)===diaSel).sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99'));
  if(lt)lt.textContent='Eventos · '+fmtF(diaSel)+(dayEv.length?' ('+dayEv.length+')':'');
  if(list){
    if(!dayEv.length)list.innerHTML='<div style="font-size:11px;color:var(--tx3);padding:4px 0">Sin eventos este día.</div>';
    else list.innerHTML=dayEv.map(ev=>{
      const horaLbl=ev.hora?escAttr(ev.hora):'—';
      const dc=ev.tipo==='asignado'?'border-left:3px solid var(--pu)':ev.tipo==='desde_actividad'?'border-left:3px solid var(--or)':'border-left:3px solid var(--bl)';
      const on=ev.id===(window._actAgendaSelEvId||'');
      const canDel=puedeEliminarAgendaEvento(ev);
      return '<div class="act-agenda-dia-row'+(on?' on':'')+'" style="display:flex;gap:8px;align-items:flex-start;padding:6px 4px;border-bottom:1px solid var(--bd);font-size:12px;'+dc+'" onclick="actAgendaSelEvento(\''+escAttr(ev.id)+'\')">'+
        '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--bl);min-width:44px">'+horaLbl+'</span>'+
        '<span style="flex:1"><strong>'+escAttr(ev.titulo)+'</strong>'+(ev.detalle?'<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+escAttr(ev.detalle)+'</div>':'')+'</span>'+
        (canDel?'<button type="button" class="btn bsm bic bd2" onclick="event.stopPropagation();actAgendaEliminar(\''+escAttr(ev.id)+'\')" title="Eliminar">🗑</button>':'')+
        '</div>';
    }).join('');
  }
}
function cerrarActAgendaPanel(){
  const ov=document.getElementById('act-agenda-overlay');
  const panel=document.getElementById('act-agenda-panel');
  if(ov)ov.classList.remove('on');
  if(panel)panel.classList.remove('on');
  window._agendaPrefillTask=null;
  window._actAgendaResp=null;
  window._actAgendaSelEvId=null;
  window._actAgendaDrawerMode=null;
  window._actAgendaPrefillBase=null;
}
function actAgendaGuardarForm(){
  const f=agendaLeerForm();
  const resp=getAgendaResponsableActivo();
  if(!resp){notif('Seleccione responsable','err');return;}
  const mode=window._actAgendaDrawerMode;
  if(mode==='edit'&&window._actAgendaSelEvId){
    if(actualizarAgendaEvento(window._actAgendaSelEvId,{...f})){
      notif('Evento actualizado','ok');
      window._actAgendaDiaSel=(f.fecha||'').slice(0,10);
      actAgendaRefreshForm();
      refreshActAgendaPanelCal();
      refreshVistasTrasAgendar();
    }
    return;
  }
  const ev=crearAgendaEvento({...f,responsable:resp,tipo:'desde_actividad',taskRef:window._agendaPrefillTask||null,depto:esModoResponsable()?'responsables':deptoActivo});
  if(ev){
    window._actAgendaSelEvId=ev.id;
    window._actAgendaDrawerMode='edit';
    window._actAgendaDiaSel=(f.fecha||'').slice(0,10);
    notif('Actividad agendada en calendario','ok');
    actAgendaRefreshForm();
    refreshActAgendaPanelCal();
    refreshVistasTrasAgendar();
  }
}
function genCodigoActLibre(depto){
  const pref={guaviare:'ACT-GV',guainia:'ACT-GN',vaupes:'ACT-VP'}[depto]||'ACT';
  const n=(actividadesLibres||[]).filter(a=>a.depto===depto&&!a.eliminada).length+1;
  return pref+'-'+String(n).padStart(4,'0');
}
function normalizeActLibre(t){
  if(!t)return t;
  t=normalizeTask(t);
  t.sinExpediente=true;
  if(!t.depto)t.depto=deptoActivo;
  if(!t.codigo)t.codigo=genCodigoActLibre(t.depto);
  return t;
}
function getActLibreById(id){return (actividadesLibres||[]).find(t=>t.id===id);}
function getActLibreByCodigo(cod){return (actividadesLibres||[]).find(t=>t.codigo===cod);}
function getActividadesLibresDepto(deptoId){
  return (actividadesLibres||[]).map(normalizeActLibre).filter(t=>!t.eliminada&&t.depto===(deptoId||deptoActivo));
}
function isActLibreRef(expId,taskId){
  if(taskId&&getActLibreById(taskId))return true;
  if(expId&&getActLibreByCodigo(expId))return true;
  return false;
}
function poblarActDeptRespSel(){
  const sel=document.getElementById('act-dept-resp-sel');if(!sel)return;
  const enc=getEncargadoDepto(deptoActivo);
  let cv=sel.value;
  let names;
  if(esVistaActividadesOficinaPqrs()){
    names=getResponsablesOficinaPqrs(deptoActivo).filter(Boolean);
    if(!cv||cv===enc)cv='__all__';
  }else{
    if(!cv&&enc)cv=enc;
    names=esNcaDeguv()?getResponsablesNcaDeguv():getContratistasAsignables(deptoActivo);
    if(enc&&!names.includes(enc))names.unshift(enc);
  }
  sel.innerHTML=names.map(n=>'<option value="'+escAttr(n)+'"'+(cv===n?' selected':'')+'>'+escAttr(n)+(n===enc?' · Encargado':'')+'</option>').join('')+
    '<option value="__all__"'+(cv==='__all__'?' selected':'')+'>Todos los responsables</option>';
  if(cv&&[...sel.options].some(o=>o.value===cv))sel.value=cv;
  else if(esVistaActividadesOficinaPqrs())sel.value='__all__';
  else if(enc)sel.value=enc;
}
function poblarSelResponsable(){
  const sel=document.getElementById('sel-responsable');if(!sel)return;
  if(esResponsableIdentidadFija()){
    fijarResponsableSesion();
    return;
  }
  const cv=responsableActivo||sel.value;
  const names=esModoResponsable()?getAllResponsables():[];
  sel.innerHTML='<option value="">— Seleccione —</option>'+names.map(n=>'<option value="'+escAttr(n)+'"'+(cv===n?' selected':'')+'>'+escAttr(n)+'</option>').join('');
  if(cv)sel.value=cv;
  const lbl=document.getElementById('resp-global-label');
  if(lbl)lbl.textContent='Responsable:';
}
function onResponsableChange(){
  if(esResponsableIdentidadFija()){fijarResponsableSesion();return;}
  const sel=document.getElementById('sel-responsable');
  responsableActivo=sel?sel.value:'';
  try{localStorage.setItem('sst_responsable',responsableActivo||'');}catch(e){}
  const hint=document.getElementById('resp-global-hint');
  if(hint)hint.textContent=responsableActivo?(esModoResponsable()?(responsablePuedeVerRegistro()?'Conectado como: '+responsableActivo+' — edición en Registro según secciones habilitadas.':'Sin acceso a Registro — use Consulta y Actividades.'):''):esModoResponsable()?'Seleccione su nombre para ver sus actividades asignadas.':'';
  updateDeptoUI();
  renderResponsableRegistro();
  if(document.getElementById('pg-reg').classList.contains('on'))renderTabla();
  if(document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('pg-agenda').classList.contains('on'))renderAgenda();
  if(document.getElementById('pg-con').classList.contains('on')){poblarFiltrosCon();renderConsulta();}
  if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
  renderBandejaDepto();
}
function cambiarResponsable(){
  if(esResponsableIdentidadFija()){notif('Su sesión está vinculada a su cuenta de Google','err');return;}
  responsableActivo='';
  try{localStorage.setItem('sst_responsable','');}catch(e){}
  const sel=document.getElementById('sel-responsable');
  if(sel){sel.value='';sel.focus();}
  onResponsableChange();
  if(esModoResponsable())showTab('act');
}
function getTareasResponsableActivo(){
  if(!responsableActivo)return [];
  const out=[];
  exps.forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      t=normalizeTask(t);
      if(t.eliminada)return;
      if(!pqrsTaskVisibleEnActividades(t,e,responsableActivo))return;
      if(!taskUsuarioEsAsignado(t,responsableActivo))return;
      if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'&&estadoTaskForAsignado(t,responsableActivo)==='Atendida')return;
      out.push({
        ...normalizeTask(t),
        exp:e._exp,
        nombre:getNom(e),
        tram:(getTram(e._tramite,e)||{}).nombre||'',
        depto:e._depto,
        sinExpediente:false
      });
    });
  });
  (actividadesLibres||[]).forEach(t=>{
    t=normalizeActLibre(t);
    if(t.eliminada||!taskUsuarioEsAsignado(t,responsableActivo))return;
    if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'&&estadoTaskForAsignado(t,responsableActivo)==='Atendida')return;
    out.push({...t,exp:t.codigo,nombre:'(Sin expediente)',tram:'Actividad',sinExpediente:true});
  });
  return out;
}
function getTareasOficinaPqrsActividades(respFilter){
  const list=[];
  const ofi=deptoActivo;
  exps.filter(e=>esPqrsSecretaria(e)&&e._pqrs_oficina===ofi).forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      t=normalizeTask(t);
      if(t.eliminada||!taskEsAtenderPqrs(t,e))return;
      if(!pqrsTaskVisibleEnActividades(t,e,respFilter))return;
      if(respFilter&&!taskUsuarioEsAsignado(t,respFilter))return;
      list.push({...t,exp:e._exp,depto:e._depto,nombre:getNom(e),tram:'PQRSD',sinExpediente:false,esPqrs:true,prioritaria:!!(t.prioritaria||e._pqrs_prioritaria)});
    });
  });
  return list;
}
function getTareasDeptActividades(respFilter){
  const list=[];
  if(esVistaActividadesOficinaPqrs())return getTareasOficinaPqrsActividades(respFilter);
  const depto=deptoActivo;
  exps.filter(e=>(e._depto||'guaviare')===depto).forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      t=normalizeTask(t);
      if(t.eliminada)return;
      if(!pqrsTaskVisibleEnActividades(t,e,respFilter))return;
      // Para tareas PQRSD, pqrsTaskVisibleEnActividades ya maneja el filtro de usuario;
      // solo aplicar el filtro adicional para tareas normales
      if(respFilter&&!taskEsAtenderPqrs(t,e)&&!taskUsuarioEsAsignado(t,respFilter))return;
      const tramObj=getTram(e._tramite,e);
      list.push({...t,exp:e._exp,depto:e._depto,nombre:getNom(e),tram:tramObj?tramObj.nombre:(esTramitePqrs(e._tramite)?'PQRSD':''),sinExpediente:false,esPqrs:esTramitePqrs(e._tramite),prioritaria:!!(t.prioritaria||(esTramitePqrs(e._tramite)&&e._pqrs_prioritaria))});
    });
  });
  getActividadesLibresDepto(depto).forEach(t=>{
    if(respFilter&&!taskUsuarioEsAsignado(t,respFilter))return;
    list.push({...t,exp:t.codigo,nombre:'(Sin expediente)',tram:'Actividad',sinExpediente:true});
  });
  return list;
}
function puedeTrasladarPqrs(e){
  if(!e||!esPqrsSecretaria(e))return false;
  if(pqrsPendienteTraslado(e))return false;
  if(pqrsEstaCerrada(e))return false;
  if(esSecretaria())return true;
  if(esModoOficinaDeguv())return e._pqrs_oficina===deptoActivo;
  if(esOficinaPqrsNca()&&e._pqrs_oficina==='guaviare')return true;
  return false;
}
function pqrsOficinasSelectOpts(selId,inclSecretaria){
  const list=inclSecretaria?OFICINAS_DEGUV:OFICINAS_DEGUV.filter(o=>o.id!=='secretaria');
  return list.map(o=>'<option value="'+escAttr(o.id)+'"'+(selId===o.id?' selected':'')+'>'+escAttr(o.nombre)+'</option>').join('');
}
function taskEsAtenderPqrs(t,e){
  return !!(t&&String(t.actividad||'').startsWith('Atender PQRSD')&&e&&esPqrsSecretaria(e));
}
function guardarPqrsRespuestaDatos(e,opts,cerrar){
  if(!e)return;
  opts=opts||{};
  const fechaResp=opts.fechaResp||'';
  const oficioExt=opts.oficioExt||'';
  const medioResp=opts.medioResp||'';
  const nota=opts.nota||'';
  const cuerpo=opts.cuerpo||'';
  const adj=opts.adj||{links:[],files:[]};
  const archivos=opts.archivos||[];
  if(fechaResp)e._pqrs_respuesta_fecha=fechaResp;
  if(oficioExt!==undefined)e._pqrs_respuesta_oficio=oficioExt;
  if(medioResp!==undefined)e._pqrs_respuesta_medio=medioResp;
  if(opts.notaInterna!==undefined)e._pqrs_notas_internas=opts.notaInterna;
  else if((nota||cuerpo)&&opts.esNotaPublica!==false)e._pqrs_respuesta_nota=nota||cuerpo;
  if(adj.links.length)e._pqrs_respuesta_link=adj.links[0];
  if(adj.links.length>1)e._pqrs_respuesta_links=adj.links;
  if(archivos.length){
    e._pqrs_respuesta_soportes=archivos.map((a,i)=>{
      const url=a.driveLink||a.url||a.data||a.previewLink||'';
      const preview=a.previewLink||a.preview||a.driveLink||a.url||a.data||'';
      return {label:a.nombre||a.name||a.label||('Respuesta '+(i+1)),url:url,mime:a.mime||'',preview:preview};
    });
  }
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  const tipo=opts.tipo||PQRS_WF_TIPO.MENSAJE;
  const canal=opts.canal||medioResp||'';
  if(cerrar){
    // Full closure (offices + NCA encargado direct)
    finalizarTareasPqrsAlCerrar(e,'PQRSD cerrada — respuesta registrada');
    e._pqrs_estado_oficina='cerrado';
    const fAt=fechaResp||hoy();
    e._estado='Atendido';
    e._fecha_res=fAt;
    const fe=getFechasEstado(e);
    fe.Atendido=fAt;
    if(!fe['En trámite'])fe['En trámite']=fe.Solicitud||e._fecha||fAt;
    e._fechas_estado=JSON.stringify(fe);
    e.historial=rebuildHistorial(e,e.historial||[]);
    const histNota=[nota||cuerpo||'Respuesta registrada',oficioExt?'Oficio '+oficioExt:'',canal?medioNotificacionRespLabel(canal):''].filter(Boolean).join(' · ')+' — '+pqrsComentarioAutor();
    e._pqrs_historial.push({tipo:'respuesta_oficina',fecha:fechaResp||hoy(),nota:histNota,oficina:e._pqrs_oficina});
  }else if(fechaResp){
    // Responsable NCA delivery: sets pending_revision state, no close
    const wfPatch={
      fase:PQRS_WF.PENDIENTE_REVISION,
      tipo,canal,cuerpo,
      oficio:oficioExt,
      fecha_respuesta:fechaResp,
      documentos:archivos||[],
      entregado_por:responsableActivo||'',
      entregado_en:new Date().toISOString()
    };
    setPqrsWorkflow(e,wfPatch);
    e._pqrs_historial.push({tipo:'entrega_respuesta_nca',fecha:fechaResp,nota:'Entrega de respuesta para revisión NCA'+(oficioExt?' · Oficio '+oficioExt:'')+' — '+pqrsComentarioAutor(),oficina:e._pqrs_oficina,responsable:responsableActivo||''});
  }
}
function registrarPqrsRespuestaCore(e,opts){
  guardarPqrsRespuestaDatos(e,opts||{},true);
}
function getPqrsRespuestaDocPreview(e,t){
  if(!e)return null;
  if(e._pqrs_respuesta_link){
    const p=parseDrivePreviewUrl(e._pqrs_respuesta_link);
    return{url:p.url||e._pqrs_respuesta_link,preview:p.preview||p.url||e._pqrs_respuesta_link,label:'Respuesta al ciudadano'};
  }
  if(t){
    const activo=getSoporteActivo(t);
    if(activo&&(activo.preview||activo.url)){
      return{url:activo.url||activo.preview,preview:activo.preview||activo.url,label:activo.label||'Documento de respuesta'};
    }
  }
  return null;
}
function renderPqrsEntregaCamposHtml(e){
  e=e||{};
  const wf=getPqrsWorkflow(e);
  const mkTipo=(v,lbl)=>'<button type="button" class="btn bsm tipo-resp-btn" data-val="'+escAttr(v)+'" onclick="setPqrsRespTipo(\''+jsStr(v)+'\')">'+escAttr(lbl)+'</button>';
  const mkCan=(v,lbl,ico)=>'<button type="button" class="btn bsm canal-resp-btn" data-val="'+escAttr(v)+'" onclick="setPqrsRespCanal(\''+jsStr(v)+'\')">'+ico+' '+escAttr(lbl)+'</button>';
  let h='<div style="margin-bottom:10px;padding:10px;background:var(--bll);border:1px solid var(--bl);border-radius:var(--r)">';
  h+='<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--bl)">📋 Respuesta al ciudadano</div>';
  h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Cuando el encargado revise y apruebe, se enviará la notificación al ciudadano.</div>';
  h+='<div class="fg" style="margin-bottom:8px">'+
    '<div class="fld"><label>Fecha de la respuesta<span class="req-star">*</span></label><input type="date" id="pqrs-entrega-resp-fecha" value="'+escAttr(wf.fecha_respuesta||e._pqrs_respuesta_fecha||hoy())+'"></div>'+
    '<div class="fld"><label>N° de oficio <span style="font-weight:400;color:var(--tx3)">(si aplica)</span></label><input type="text" id="pqrs-entrega-resp-oficio" placeholder="Ej. OFI-2026-045" value="'+escAttr(wf.oficio||e._pqrs_respuesta_oficio||'')+'"></div>'+
    '</div>';
  h+='<div class="fld" style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">Tipo de respuesta</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px" id="pqrs-resp-tipo-btns">'+
    mkTipo(PQRS_WF_TIPO.MENSAJE,'✉️ Mensaje simple')+
    mkTipo(PQRS_WF_TIPO.OFICIO,'📄 Oficio firmado')+
    mkTipo(PQRS_WF_TIPO.INFORMATIVA,'ℹ️ Informativa')+
    '</div><input type="hidden" id="pqrs-resp-tipo" value="'+escAttr(wf.tipo||PQRS_WF_TIPO.MENSAJE)+'"></div>';
  h+='<div class="fld" style="margin-bottom:8px"><label style="font-size:11px;font-weight:600">Canal propuesto</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px" id="pqrs-resp-canal-btns">'+
    mkCan(PQRS_WF_CANAL.CORREO,'Correo','📧')+
    mkCan(PQRS_WF_CANAL.WHATSAPP,'WhatsApp','💬')+
    mkCan(PQRS_WF_CANAL.PRESENCIAL,'Presencial','🤝')+
    '</div><input type="hidden" id="pqrs-resp-canal" value="'+escAttr(wf.canal||e._pqrs_respuesta_medio||'')+'"></div>';
  h+='<div class="fld"><label style="font-size:11px;font-weight:600">Resumen de la respuesta <span style="font-weight:400;color:var(--tx3)">(obligatorio)</span></label>'+
    '<textarea id="pqrs-entrega-resp-cuerpo" placeholder="Describa brevemente la respuesta elaborada…" style="min-height:68px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px">'+escAttr(wf.cuerpo||e._pqrs_respuesta_nota||'')+'</textarea></div>';
  h+='</div>';
  return h;
}
function collectPqrsEntregaDatos(expId){
  const e=getExpById(expId);
  if(!e)return null;
  const fechaResp=String((document.getElementById('pqrs-entrega-resp-fecha')||{}).value||'').trim();
  const oficioExt=String((document.getElementById('pqrs-entrega-resp-oficio')||{}).value||'').trim();
  const cuerpo=String((document.getElementById('pqrs-entrega-resp-cuerpo')||{}).value||'').trim();
  const tipo=String((document.getElementById('pqrs-resp-tipo')||{}).value||PQRS_WF_TIPO.MENSAJE).trim();
  const canal=String((document.getElementById('pqrs-resp-canal')||{}).value||'').trim();
  if(!fechaResp){notif('Indique la fecha de la respuesta al ciudadano','err');return null;}
  if(!cuerpo){notif('Escriba un resumen de la respuesta elaborada','err');return null;}
  const adj=collectEnviarAdjuntos();
  return{fechaResp,oficioExt,cuerpo,tipo,canal,adj};
}
function htmlPqrsRespuestaDatosReadonly(e){
  if(!e||(!e._pqrs_respuesta_fecha&&!e._pqrs_respuesta_oficio))return'';
  let h='<div style="font-size:12px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:8px">';
  h+='<div style="font-weight:600;margin-bottom:4px">Datos de respuesta (registrados por el responsable)</div>';
  if(e._pqrs_respuesta_fecha)h+='<div>Fecha respuesta: <strong>'+fmtF(e._pqrs_respuesta_fecha)+'</strong></div>';
  if(e._pqrs_respuesta_oficio)h+='<div>N° oficio: <strong>'+escAttr(e._pqrs_respuesta_oficio)+'</strong></div>';
  return h+'</div>';
}
function renderComparePqrsDocBlock(titulo,previewUrl,openUrl,meta){
  const hasVista=!!previewUrl;
  let h='<div class="compare-ver-block"><div class="lbl">'+escAttr(titulo)+(meta?' · '+escAttr(meta):'')+'</div>';
  if(hasVista){
    const isImg=/\.(png|jpe?g|gif|webp)(\?|$)/i.test(String(previewUrl||''))||String(previewUrl||'').startsWith('data:image/');
    h+=isImg?('<img src="'+escAttr(previewUrl)+'" alt="'+escAttr(titulo)+'" style="width:100%;max-height:min(360px,42vh);object-fit:contain;display:block">'):('<iframe sandbox="allow-scripts allow-same-origin allow-popups" src="'+escAttr(previewUrl)+'" title="'+escAttr(titulo)+'"></iframe>');
    if(openUrl&&openUrl!==previewUrl)h+='<div style="padding:4px 8px;font-size:11px;border-top:1px solid var(--bd)"><a href="'+escAttr(openUrl)+'" target="_blank" rel="noopener">↗ Abrir en pestaña</a></div>';
  }else{
    h+='<div style="padding:12px;font-size:12px;color:var(--tx3)">Sin documento adjunto para comparar.</div>';
  }
  return h+'</div>';
}
function renderPqrsSolRespCompareShell(e,t){
  return '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Compare la solicitud del ciudadano (izquierda) con el documento de respuesta entregado (derecha).</div>'+
    htmlPqrsRespuestaDatosReadonly(e)+
    '<div id="pqrs-sol-resp-compare-stack" class="compare-pqrs-stack"></div>';
}
function renderPqrsSolRespCompareStack(e,t){
  const stack=document.getElementById('pqrs-sol-resp-compare-stack');
  if(!stack||!e)return;
  const solUrl=e._pqrs_solicitud_link;
  const solP=solUrl?parseDrivePreviewUrl(solUrl):null;
  const resp=getPqrsRespuestaDocPreview(e,t);
  const respMeta=[e._pqrs_respuesta_fecha?fmtF(e._pqrs_respuesta_fecha):'',e._pqrs_respuesta_oficio?'Oficio '+e._pqrs_respuesta_oficio:''].filter(Boolean).join(' · ');
  stack.innerHTML=
    renderComparePqrsDocBlock('◀ Solicitud del ciudadano',solP?(solP.preview||solP.url):null,solP?(solP.url||solUrl):null)+
    renderComparePqrsDocBlock('Respuesta al ciudadano ▶',resp?resp.preview:null,resp?resp.url:null,respMeta);
}
function initPqrsSolRespCompareTab(){
  const ctx=window._taskModalCtx||{};
  const e=getExpById(ctx.expId);
  const t=getTaskFromExp(e,ctx.taskId);
  renderPqrsSolRespCompareStack(e,t);
}
function getDocsPqrsRespuestaCiudadano(e){
  if(!e||!esPqrsSecretaria(e))return[];
  const docs=[];
  const seen=new Set();
  const push=(url,preview,label,mime,fecha,tipo)=>{
    if(!url&&!preview)return;
    const key=String(url||preview||'');
    if(seen.has(key))return;
    seen.add(key);
    docs.push({url:url||preview,preview:preview||url,label:label||'Respuesta PQRSD',tipo:tipo||'Respuesta oficial PQRSD',mime:mime||'',fecha:fecha||e._pqrs_respuesta_fecha||''});
  };
  // Workflow docs (from Sprint 3-7). Captura links Drive, previews y base64 (data).
  if(typeof getPqrsWorkflow==='function'){
    const wf=getPqrsWorkflow(e);
    if(wf&&Array.isArray(wf.documentos)){
      wf.documentos.forEach((d,i)=>{
        if(!d)return;
        const raw=d.driveLink||d.previewLink||d.url||d.data||'';
        if(!raw)return;
        const p=typeof parseDrivePreviewUrl==='function'?parseDrivePreviewUrl(raw):{url:raw,preview:raw};
        const lbl=d.tipo==='oficio_firmado'?'Oficio firmado por el Director':
                   d.tipo==='archivo'?'Documento adjunto':
                   d.tipo==='correo'?'Correo enviado al ciudadano':
                   d.nombre||d.name||d.label||('Documento '+(i+1));
        push(d.driveLink||p.url||raw,d.previewLink||p.preview||raw,lbl,d.mime||'',wf.fecha_respuesta||e._pqrs_respuesta_fecha||'','Respuesta oficial PQRSD');
      });
    }
  }
  // Legacy links
  if(e._pqrs_respuesta_link)push(e._pqrs_respuesta_link,e._pqrs_respuesta_link,'Respuesta PQRSD','',e._pqrs_respuesta_fecha,'Respuesta oficial PQRSD');
  (e._pqrs_respuesta_links||[]).forEach((u,i)=>push(u,u,'Respuesta '+(i+1),'',e._pqrs_respuesta_fecha,'Respuesta oficial PQRSD'));
  (e._pqrs_respuesta_soportes||[]).forEach(s=>push(s.url,s.preview||s.url,s.label||'Respuesta',s.mime||'',e._pqrs_respuesta_fecha,'Respuesta oficial PQRSD'));
  return docs;
}
function puedeAsignarPqrsOficina(e){
  if(!e||pqrsEstaCerrada(e))return false;
  const ofi=e._pqrs_oficina||getPqrsOficinaActiva();
  if(!oficinaPuedeAsignarPqrs(ofi))return false;
  if(esModoOficinaDeguv()&&e._pqrs_oficina===deptoActivo)return true;
  if(esOficinaPqrsNca()&&e._pqrs_oficina==='guaviare')return true;
  return false;
}
function ensureTareaPqrsOficina(e,oficinaId){
  if(!e||!oficinaId||oficinaId==='secretaria'||oficinaId==='guaviare')return;
  if(!Array.isArray(e.tasks))e.tasks=[];
  const {plazoInicio,vence,plazoDias}=pqrsPlazoTaskMeta(e);
  const prior=!!e._pqrs_prioritaria;
  const enc=getEncargadoOficina(oficinaId);
  const resp=String(e._pqrs_responsable_oficina||'').trim()||enc||'';
  const actNombre='Atender PQRSD: '+(e.f_f1||e._tipo_solicitud||'Solicitud');
  let existIdx=e.tasks.findIndex(t=>t&&!t.eliminada&&String(t.actividad||'').startsWith('Atender PQRSD'));
  const base={
    actividad:actNombre,detalle:e._pqrs_detalle||e._detalle_general||'',desc:actNombre,
    entregaModo:'individual',plazoDias:plazoDias,vence:vence,prioritaria:prior,eliminada:false
  };
  if(existIdx>=0){
    const prev=normalizeTask(e.tasks[existIdx]);
    e.tasks[existIdx]=normalizeTask({...prev,...base,
      responsable:resp||prev.responsable,responsables:resp?[resp]:(prev.responsables||[]),
      asignados:resp?[{nombre:resp,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}]:(prev.asignados||[])
    });
  }else{
    e.tasks.push(normalizeTask({
      id:genTaskId(),...base,
      responsable:resp,responsables:resp?[resp]:[],asignados:resp?[{nombre:resp,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}]:[],
      comentarios:[],historial:[{tipo:'recepcion_oficina',fecha:hoy(),nota:'PQRSD recibido en '+labelOficina(oficinaId)+' — asigne responsable o indique respuesta'}],soportes:[],notasDoc:[]
    }));
  }
  if(resp)e._pqrs_estado_oficina='asignado';
  else e._pqrs_estado_oficina='pendiente';
}
function syncPqrsTareaTrasTraslado(e,nuevaOfi,motivoOpt){
  if(!e||!nuevaOfi)return;
  cancelarTareasPqrsNca(e,'Traslado a '+labelOficina(nuevaOfi)+' — actividad anterior cancelada');
  e._pqrs_responsable_oficina='';
  e._pqrs_estado_oficina='pendiente';
  if(nuevaOfi==='guaviare')ensureTareaPqrsNca(e);
  else if(nuevaOfi!=='secretaria')ensureTareaPqrsOficina(e,nuevaOfi);
  if(nuevaOfi!=='secretaria'){
    const mot=String(motivoOpt||'').trim();
    pushPqrsAvisoOficina(e,nuevaOfi,'traslado',
      '↪ PQRSD trasladado a su oficina · '+e._exp+(mot?' · '+mot:''));
  }
}
function renderConPanelPqrsExtras(e){
  if(!e||!esPqrsSecretaria(e))return '';
  e=normalizePqrsOficinaFields(e);
  let h=renderPqrsPlazoBarHtml(e);
  const doc=htmlPqrsDocumentoEnPanel(e);
  if(doc)h+=doc;
  h+=renderPqrsAsociadosPanelHtml(e);
  const acc=[];
  if(puedeGestionarPqrsAsociacion(e))pqrsAsocAccionesHtml(e).forEach(function(b){acc.push(b);});
  if(puedeMarcarPqrsInformativa(e))acc.push('<button type="button" class="btn bsm" data-sst-action="openMarcarPqrsInformativaModal" data-sst-exp="'+escAttr(e._exp)+'" onclick="event.stopPropagation();SST.openMarcarPqrsInformativaModal(\''+jsStr(e._exp)+'\')">ℹ Marcar informativa</button>');
  if(puedeAsignarPqrsOficina(e))acc.push('<button type="button" class="btn bsm" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤 Asignar responsable</button>');
  if(puedeTrasladarPqrsInicial(e))acc.push('<button type="button" class="btn bsm bp" onclick="openTrasladoPqrsInicialModal(\''+escAttr(e._exp)+'\')">↪ Trasladar a oficina</button>');
  if(puedeTrasladarPqrs(e))acc.push('<button type="button" class="btn bsm" onclick="openTrasladoPqrsInterOficinaModal(\''+escAttr(e._exp)+'\')">↪ Trasladar a otra oficina</button>');
  if(puedeMarcarPqrsPrioritariaDs(e))acc.push('<button type="button" class="btn bsm" onclick="togglePqrsPrioritariaDs(\''+escAttr(e._exp)+'\')">'+(e._pqrs_prioritaria?'Quitar prioritaria':'⚡ Prioritaria')+'</button>');
  if(puedeMarcarPqrsRespondida(e))acc.push('<button type="button" class="btn bsm bp" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓ Indicar respuesta</button>');
  if(esSecretaria()&&puedeEditarPqrsSecretaria(e))acc.push(pqrsBtnEdit(e._exp,'✏ Editar PQRSD'));
  if(acc.length)h+='<div class="fx" style="gap:6px;flex-wrap:wrap;margin:.65rem 0">'+acc.join(' ')+'</div>';
  h+=renderPqrsTrazabilidadHtml(e);
  if(pqrsEstaCerrada(e))h+=htmlPqrsRespuestaRegistrada(e);
  h+=htmlPqrsCorreoOrigenHtml(e);
  return '<div class="con-panel-pqrs-wrap" style="margin-bottom:.75rem">'+h+'</div>';
}
function getPqrsAsociadosVisibles(e){
  const list=getExpAsociadosAll(e);
  if(esPqrsAsocContextoOficina(e))return list.filter(function(n){
    const ref=findExpByNumPlain(n);
    return ref&&expAsocEsRegistroPqrs(ref);
  });
  return list;
}
function renderPqrsAsociadosPanelHtml(e){
  if(!e||!esPqrsSecretaria(e))return'';
  const list=getPqrsAsociadosVisibles(e);
  if(!list.length&&!puedeGestionarPqrsAsociacion(e))return'';
  const titulo=esPqrsAsocContextoOficina(e)?'PQRSD asociadas':'Vinculaciones';
  const vacio=esPqrsAsocContextoOficina(e)?'Sin PQRSD asociada':'Sin vinculaciones registradas';
  const chips=list.length?list.map(function(n){
    const ref=findExpByNumPlain(n);
    const esPqrs=ref&&expAsocEsRegistroPqrs(ref);
    const tipo=esPqrs?' · PQRSD':' · Trámite';
    return '<button type="button" class="bdg b-sol con-exp-link" style="font-family:\'DM Mono\',monospace;font-size:11px" data-sst-action="abrirConsultaExpAsociado" data-sst-exp="'+escAttr(n)+'" title="'+escAttr(n+tipo)+'">'+escAttr(n)+'<span style="font-size:9px;font-weight:400;opacity:.85">'+tipo+'</span></button>';
  }).join(''):
    '<span style="font-size:12px;color:var(--tx3)">'+vacio+'</span>';
  return '<div class="pqrs-det-sec" style="margin-bottom:.65rem"><div class="pqrs-det-k">'+titulo+'</div><div class="fx" style="gap:4px;flex-wrap:wrap;align-items:center">'+chips+'</div></div>';
}
function buscarPqrsAsocSoloPqrs(q,excludeExpId,lim){
  const ql=(q||'').trim().toLowerCase();
  const out=[];
  exps.forEach(function(e){
    if(!esPqrsSecretaria(e)||!expAsocEsRegistroPqrs(e))return;
    if(expAsocMatchNum(e._exp,excludeExpId))return;
    const num=String(e._exp||'').trim();
    const numLc=num.toLowerCase();
    const nom=getNom(e).toLowerCase();
    const asunto=String(e.f_f1||'').toLowerCase();
    if(ql&&!numLc.includes(ql)&&!nom.includes(ql)&&!asunto.includes(ql))return;
    out.push(e);
  });
  return out.slice(0,lim||12);
}
function buscarVinculosAsocPqrs(q,pqrsExpId,modo,lim){
  modo=modo||'pqrs';
  if(modo==='pqrs')return buscarPqrsAsocSoloPqrs(q,pqrsExpId,lim);
  if(modo==='tramite')return buscarExpedientesAsoc(q,pqrsExpId,lim||12).filter(function(x){return !expAsocEsRegistroPqrs(x);});
  const seen=new Set(),out=[];
  buscarExpedientesAsoc(q,pqrsExpId,lim||12).filter(function(x){return !expAsocEsRegistroPqrs(x);}).concat(buscarPqrsAsocSoloPqrs(q,pqrsExpId,lim)).forEach(function(x){
    const k=String(x._exp||'').trim().toLowerCase();
    if(k&&!seen.has(k)){seen.add(k);out.push(x);}
  });
  return out.slice(0,lim||12);
}
function asociarVinculoAPqrs(pqrsExpId,targetExpNum,modo){
  pqrsExpId=String(pqrsExpId||'').trim();
  targetExpNum=String(targetExpNum||'').trim();
  modo=modo||'pqrs';
  const e=getExpById(pqrsExpId);
  if(!e||!esPqrsSecretaria(e))return false;
  if(esPqrsAsocContextoOficina(e))modo='pqrs';
  if(!targetExpNum){
    notif(modo==='pqrs'?'Indique el número de la PQRSD':'Indique el número del expediente','err');
    return false;
  }
  if(expAsocMatchNum(targetExpNum,pqrsExpId)){notif('No puede asociar la PQRSD consigo misma','err');return false;}
  const target=findExpByNum(targetExpNum,e._depto||'guaviare')||findExpByNumPlain(targetExpNum);
  if(!target){
    notif('No se encontró «'+targetExpNum+'»','err');
    return false;
  }
  const targetEsPqrs=expAsocEsRegistroPqrs(target);
  if(modo==='pqrs'){
    if(!targetEsPqrs){notif('Solo puede asociar con otra PQRSD','err');return false;}
  }else if(modo==='tramite'){
    if(!esPqrsAsocContextoNca(e)){notif('Solo NCA puede asociar expedientes de trámite','err');return false;}
    if(targetEsPqrs){notif('Use «Asociar PQRSD» para vincular con otra PQRSD','err');return false;}
  }
  if(!expAsocVinculoPermitido(target,e)){notif('No puede vincular con ese registro','err');return false;}
  const previos=getExpAsociadosDirectos(e);
  if(previos.some(function(n){return expAsocMatchNum(n,target._exp);})){
    notif('Este vínculo ya está registrado','ok');
    return true;
  }
  const nuevos=previos.concat([target._exp]);
  e._usar_exp_asociados=true;
  e._expedientes_asociados=JSON.stringify(nuevos);
  aplicarAsociadosBidireccional(pqrsExpId,nuevos,previos);
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  const histTipo=targetEsPqrs?'asociacion_pqrs':'asociacion_exp';
  const histLbl=targetEsPqrs?('Vinculada a PQRSD '+target._exp):('Vinculada al expediente '+target._exp);
  e._pqrs_historial.push({tipo:histTipo,fecha:hoy(),nota:histLbl+' — '+pqrsComentarioAutor(),oficina:e._pqrs_oficina,por:pqrsComentarioAutor()});
  // Persistir la PQRSD y el expediente vinculado (bidireccional puede mutar ambos)
  persistExpedienteGranular(e,false);
  if(target&&target._exp!==e._exp)persistExpedienteGranular(target,false);
  notif('PQRSD vinculada a '+target._exp,'ok');
  return true;
}
function filtrarPqrsExpAsocSug(inp){
  if(!inp)return;
  const ctx=window._taskModalCtx||{};
  const list=buscarVinculosAsocPqrs(inp.value.trim(),ctx.expId,ctx.modo||'pqrs',10);
  window._pqrsAsocSugList=list;
  const box=document.getElementById('pqrs-asoc-sug-list');
  if(!box)return;
  if(!list.length){box.style.display='none';box.innerHTML='';return;}
  box.style.display='block';
  box.innerHTML=list.map(function(ex,i){
    return '<button type="button" style="display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-bottom:1px solid var(--bd);background:var(--sf);cursor:pointer;font-size:12px;font-family:\'DM Sans\',sans-serif" onmousedown="event.preventDefault();SST.pickPqrsExpAsocSug('+i+')">'+expAsocEtiquetaSug(ex)+'</button>';
  }).join('');
}
function pickPqrsExpAsocSug(idx){
  const ex=(window._pqrsAsocSugList||[])[idx];
  const inp=document.getElementById('pqrs-asoc-exp-inp');
  if(ex&&inp)inp.value=ex._exp;
  const box=document.getElementById('pqrs-asoc-sug-list');
  if(box){box.style.display='none';box.innerHTML='';}
}
function openAsociarVinculoPqrsModal(expId,modo){
  expId=String(expId||'').trim();
  modo=modo||'pqrs';
  const e=getExpById(expId);
  if(!e||!puedeGestionarPqrsAsociacion(e)){notif('No puede registrar vínculos en este modo','err');return;}
  if(esPqrsAsocContextoOficina(e))modo='pqrs';
  if(modo==='tramite'&&!esPqrsAsocContextoNca(e)){notif('Solo NCA puede asociar expedientes de trámite','err');return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body){cerrarPqrsModalPrep();return;}
  const esTram=modo==='tramite';
  if(tit)tit.textContent=(esTram?'Asociar expediente':'Asociar PQRSD')+' · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+
    (esTram?'Vincule esta PQRSD con un expediente de trámite activo (requerimiento, información del usuario, etc.).':'Vincule esta PQRSD con otra PQRSD relacionada (mismo interesado, trámite complementario, etc.).')+
    '</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>N° '+(esTram?'expediente de trámite':'PQRSD')+'<span class="req-star">*</span></label>'+
    '<input type="text" id="pqrs-asoc-exp-inp" placeholder="'+(esTram?'Buscar expediente por número, nombre o trámite…':'Buscar PQRSD por número, interesado o asunto…')+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" oninput="SST.filtrarPqrsExpAsocSug(this)" onfocus="SST.filtrarPqrsExpAsocSug(this)"></div>'+
    '<div id="pqrs-asoc-sug-list" style="max-height:180px;overflow:auto;border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px;display:none"></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn bsm bp" onclick="event.stopPropagation();SST.submitAsociarVinculoPqrs(\''+jsStr(expId)+'\')">'+(esTram?'Asociar expediente':'Asociar PQRSD')+'</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'pqrsAsoc',expId:expId,modo:modo};
  setTimeout(function(){const inp=document.getElementById('pqrs-asoc-exp-inp');if(inp)inp.focus();},80);
}
function submitAsociarVinculoPqrs(expId){
  const ctx=window._taskModalCtx||{};
  const num=String((document.getElementById('pqrs-asoc-exp-inp')||{}).value||'').trim();
  if(asociarVinculoAPqrs(expId,num,ctx.modo||'pqrs')){
    closeTaskModal();
    refreshPqrsPanelViews(expId);
  }
}
function openAsociarExpedientePqrsModal(expId){openAsociarVinculoPqrsModal(expId,'tramite');}
function submitAsociarExpedientePqrs(expId){submitAsociarVinculoPqrs(expId);}
function completarTareasAtenderPqrs(e,nota){
  if(!e||!Array.isArray(e.tasks))return;
  const fc=hoy();
  e.tasks.forEach(function(t,i){
    t=normalizeTask(t);
    if(t.eliminada||!taskEsAtenderPqrs(t,e))return;
    if(estadoTask(t)==='Atendida')return;
    t.fechaReportada=t.fechaReportada||fc;
    t.fechaAtendida=fc;
    t.estado='Atendida';
    t.verificadoPor=pqrsComentarioAutor()+' · informativa';
    if(!Array.isArray(t.historial))t.historial=[];
    t.historial.push({tipo:'informativa_cierre',fecha:fc,nota:nota||'PQRSD informativa',por:pqrsComentarioAutor()});
    e.tasks[i]=t;
  });
}
function marcarPqrsInformativaCore(expId,nota){
  const e=getExpById(expId);
  if(!e||!puedeMarcarPqrsInformativa(e)){notif('No puede marcar esta PQRSD como informativa','err');return false;}
  e._pqrs_informativa=true;
  const notaHist=(nota||'PQRSD informativa — sin respuesta formal requerida').trim();
  registrarPqrsRespuestaCore(e,{fechaResp:hoy(),nota:notaHist,oficioExt:'',medioResp:''});
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'informativa',fecha:hoy(),nota:notaHist+' — '+pqrsComentarioAutor(),oficina:e._pqrs_oficina,por:pqrsComentarioAutor()});
  completarTareasAtenderPqrs(e,notaHist);
  persistExpedienteGranular(e);
  notif('PQRSD marcada como informativa y cerrada','ok');
  return true;
}
function refreshPqrsPanelViews(expId){
  refreshPqrsDetalleViews(expId);
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  renderBandejaDepto();
}
function openMarcarPqrsInformativaModal(expId){
  expId=String(expId||'').trim();
  const e=getExpById(expId);
  if(!e||!puedeMarcarPqrsInformativa(e)){notif('No puede marcar esta PQRSD como informativa','err');return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body){cerrarPqrsModalPrep();return;}
  if(tit)tit.textContent='Marcar PQRSD informativa · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Use cuando la PQRSD solo aporta información (respuesta a requerimiento, datos sobre un trámite activo, etc.) y <strong>no requiere respuesta formal</strong> al ciudadano. Se dará por <strong>atendida</strong> y se cerrará la actividad «Atender PQRSD».</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Observación (opcional)</label><textarea id="pqrs-inf-nota" placeholder="Ej. Información sobre el trámite EXP-2026-015 — respuesta a requerimiento" style="width:100%;min-height:72px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif;font-size:12px"></textarea></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn bsm bp" onclick="event.stopPropagation();SST.submitMarcarPqrsInformativa(\''+jsStr(expId)+'\')">ℹ Marcar informativa y cerrar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'pqrsInformativa',expId:expId};
}
function submitMarcarPqrsInformativa(expId){
  const nota=String((document.getElementById('pqrs-inf-nota')||{}).value||'').trim();
  if(marcarPqrsInformativaCore(expId,nota)){
    closeTaskModal();
    refreshPqrsPanelViews(expId);
  }
}
function ensureTareaPqrsNca(e){
  if(!e||e._pqrs_oficina!=='guaviare')return;
  if(!Array.isArray(e.tasks))e.tasks=[];
  const {vence,plazoDias}=pqrsPlazoTaskMeta(e);
  const prior=!!e._pqrs_prioritaria;
  // Resolver encargado antes de verificar tarea existente
  const enc=String(e._pqrs_responsable_oficina||'').trim()||getEncargadoOficina('guaviare')||'';
  if(enc&&!e._pqrs_responsable_oficina)e._pqrs_responsable_oficina=enc;
  let existIdx=e.tasks.findIndex(t=>t&&!t.eliminada&&String(t.actividad||'').startsWith('Atender PQRSD'));
  if(existIdx>=0){
    const exist=normalizeTask(e.tasks[existIdx]);
    exist.prioritaria=prior;
    exist.vence=vence;
    exist.plazoDias=plazoDias;
    // Actualizar responsable si aún no tiene uno asignado
    if(enc&&!exist.responsable){
      exist.responsable=enc;
      exist.responsables=[enc];
      if(!Array.isArray(exist.asignados)||!exist.asignados.length){
        exist.asignados=[{nombre:enc,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}];
      }
    }
    e.tasks[existIdx]=exist;
    return;
  }
  const actNombre='Atender PQRSD: '+(e.f_f1||e._tipo_solicitud||'Solicitud');
  const tk=normalizeTask({
    id:genTaskId(),actividad:actNombre,detalle:e._pqrs_detalle||e._detalle_general||'',desc:actNombre,
    responsable:enc,responsables:enc?[enc]:[],asignados:enc?[{nombre:enc,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}]:[],
    entregaModo:'individual',plazoDias:plazoDias,vence:vence,prioritaria:prior,
    comentarios:[],historial:[{tipo:'recepcion_nca',fecha:hoy(),nota:'PQRSD recibido en NCA DEGUV'}],soportes:[],notasDoc:[]
  });
  e.tasks.push(tk);
  e._pqrs_estado_oficina='asignado';
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'recepcion_nca',fecha:hoy(),nota:'Recibido en NCA DEGUV para trámite completo',oficina:'guaviare'});
}
function abrirPqrsBasicoSiAplica(expId,opts){
  const id=String(expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===id);
  if(!e||!esOficinaPqrsBasica()||!esPqrsSecretaria(e))return false;
  cerrarConsultaPanel();
  if(esSecretaria()){
    openSecretariaPqrsDetalle(id);
    showTab('sec');
    return true;
  }
  if(e._pqrs_oficina!==getPqrsOficinaActiva()){notif('Este PQRSD no está asignado a su oficina','err');return true;}
  openPqrsOficinaDetalle(id);
  if(document.getElementById('pg-pqrs-ofi'))showTab('pqrs-ofi');
  return true;
}
function genTaskId(){return 'tk_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function getTaskResponsables(t){
  if(!t)return[];
  migrateLegacyAsignados(t);
  return (t.responsables||[]).slice();
}
function taskEsMultiAsignada(t){
  if(!t)return false;
  migrateLegacyAsignados(t);
  return (t.responsables||[]).length>1;
}
function taskUsuarioEsAsignado(t,usuario){
  usuario=usuario||responsableActivo;
  if(!usuario||!t)return false;
  return getTaskResponsables(t).some(n=>agendaNorm(n)===agendaNorm(usuario));
}
function getAsignado(t,nombre){
  if(!t||!nombre)return null;
  const n=agendaNorm(nombre);
  return (t.asignados||[]).find(a=>agendaNorm(a.nombre)===n)||null;
}
function ensureAsignado(t,nombre){
  if(!t||!nombre)return null;
  if(!Array.isArray(t.asignados))t.asignados=[];
  if(!Array.isArray(t.responsables))t.responsables=[];
  let a=getAsignado(t,nombre);
  if(!a){
    a={nombre,fechaReportada:'',fechaAtendida:'',estado:'pendiente'};
    t.asignados.push(a);
  }
  if(!t.responsables.some(r=>agendaNorm(r)===agendaNorm(nombre)))t.responsables.push(nombre);
  if(!t.responsable)t.responsable=nombre;
  return a;
}
function migrateLegacyAsignados(t){
  if(!t)return;
  if(!Array.isArray(t.responsables)||!t.responsables.length)t.responsables=t.responsable?[String(t.responsable).trim()].filter(Boolean):[];
  if(!t.entregaModo)t.entregaModo='individual';
  if(!Array.isArray(t.asignados)||!t.asignados.length){
    t.asignados=t.responsables.map(n=>({nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}));
  }
  t.responsables.forEach(n=>{if(n&&!getAsignado(t,n))t.asignados.push({nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'});});
  if(t.responsables.length<=1){
    const a=t.asignados[0];
    if(a){
      if(t.fechaAtendida){a.fechaAtendida=t.fechaAtendida;a.estado='atendido';}
      else if(t.fechaReportada){a.fechaReportada=t.fechaReportada;a.estado='por_verificar';}
      else if(t.estado==='Por corregir')a.estado='por_corregir';
    }
  }
  t.responsable=t.responsables[0]||t.responsable||'';
}
function syncTaskAggregateState(t){
  migrateLegacyAsignados(t);
  const asig=t.asignados||[];
  if(asig.length<=1){
    const a=asig[0];
    if(a){
      t.fechaReportada=a.fechaReportada||'';
      t.fechaAtendida=a.fechaAtendida||'';
      if(a.estado==='atendido')t.estado='Atendida';
      else if(a.estado==='por_verificar')t.estado='Por verificar';
      else if(a.estado==='por_corregir')t.estado='Por corregir';
    }
    return;
  }
  const allAtendido=asig.every(a=>a.estado==='atendido');
  const anyPorVer=asig.some(a=>a.estado==='por_verificar');
  const anyPorCorr=asig.some(a=>a.estado==='por_corregir');
  if(allAtendido){
    t.estado='Atendida';
    t.fechaAtendida=asig.map(a=>a.fechaAtendida).filter(Boolean).sort().pop()||t.fechaAtendida||hoy();
    t.fechaReportada=t.fechaReportada||asig.map(a=>a.fechaReportada).filter(Boolean).sort().pop()||'';
  }else if(anyPorVer){
    t.estado='Por verificar';
    t.fechaReportada=asig.filter(a=>a.estado==='por_verificar').map(a=>a.fechaReportada).filter(Boolean).sort().pop()||t.fechaReportada||hoy();
    t.fechaAtendida='';
  }else if(anyPorCorr){
    t.estado='Por corregir';
    t.fechaReportada='';
    t.fechaAtendida='';
  }else{
    t.fechaReportada='';
    t.fechaAtendida='';
    const pend=asig.some(a=>a.estado!=='atendido');
    t.estado=(pend&&t.vence&&t.vence<hoy())?'Vencida':'En ejecución';
  }
}
function estadoTaskRawFromAsignado(a,t){
  if(!t||t.eliminada)return'Eliminada';
  if(!a)return'En ejecución';
  if(a.estado==='atendido'||a.fechaAtendida)return'Atendida';
  if(a.estado==='por_verificar'||a.fechaReportada)return'Por verificar';
  if(a.estado==='por_corregir')return'Por corregir';
  if(t.vence&&t.vence<hoy())return'Vencida';
  return'En ejecución';
}
function estadoTaskForAsignado(t,nombre){
  return estadoTaskRawFromAsignado(getAsignado(t,nombre),t);
}
function getUltimoReportadoPor(t){
  const h=(t.historial||[]).slice().reverse().find(x=>x.tipo==='reenvio_verificacion');
  return h?(h.reportadoPor||h.por||''):'';
}
function taskResponsablesLabel(t,html){
  const rs=getTaskResponsables(t);
  if(!rs.length)return html?'—':'—';
  if(rs.length===1)return html?escAttr(rs[0]):rs[0];
  return rs.map(n=>{
    const st=estadoTaskForAsignado(t,n);
    const icon=st==='Atendida'?'✓':st==='Por verificar'?'📤':st==='Por corregir'?'↩':'○';
    return html?(icon+' '+escAttr(n)):(icon+' '+n);
  }).join(html?'<br>':' · ');
}
function taskAsignadoEstadoIcon(st){
  if(st==='Atendida')return'✓';
  if(st==='Por verificar')return'📤';
  if(st==='Por corregir')return'↩';
  return'○';
}
function puedeReportarTask(t,usuario){
  usuario=usuario||responsableActivo;
  if(!t||!usuario||t.eliminada||esTareaDelEncargado(t))return false;
  if(!taskUsuarioEsAsignado(t,usuario))return false;
  if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'){
    const st=estadoTaskForAsignado(t,usuario);
    return['En ejecución','Vencida','Por corregir'].includes(st);
  }
  const est=estadoTask(t);
  return['En ejecución','Vencida','Por verificar','Por corregir'].includes(est)&&est!=='Atendida';
}
function puedeGestionarActividadesDepto(){return esVistaActividadesDepto()&&!esModoResponsable();}
function puedeGestionarSolicitudActividad(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskAny(expId,taskId);
  if(e&&t&&taskEsAtenderPqrs(t,e))return esOficinaPqrsNca()&&!esModoResponsable();
  return puedeGestionarActividadesDepto();
}
function collectSolicitudesPqrsNcaItems(){
  const items=[];
  if(!esOficinaPqrsNca()&&!esNcaDeguv())return items;
  exps.forEach(e=>{
    if(!esPqrsSecretaria(e))return;
    (e.tasks||[]).forEach(t=>{
      t=normalizeTask(t);
      if(t.eliminada||!taskEsAtenderPqrs(t,e))return;
      const sol=getTaskSolicitudPendiente(t);
      if(!sol)return;
      items.push({
        modo:'depto',tipo:sol.tipo==='traslado'?'sol_traslado':'sol_eliminacion',exp:e._exp,taskId:t.id,
        fecha:(sol.fecha||'').slice(0,10)||hoy(),responsable:sol.por||'',desc:t.desc||t.actividad||'',
        texto:(sol.tipo==='traslado'?'↔ Solicitud PQRSD — traslado':'🗑 Solicitud PQRSD — eliminación')+' — '+sol.por+(sol.destino?' → '+sol.destino:'')+(sol.nota?' · '+sol.nota:'')
      });
    });
  });
  return items;
}
function trasladarPqrsASecretariaDesdeNca(expId,nota,solPor){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!esPqrsSecretaria(e))return false;
  const anterior=e._pqrs_oficina||'guaviare';
  e._pqrs_oficina='secretaria';
  e._pqrs_traslado_fecha=hoy();
  e._pqrs_traslado_por='NCA DEGUV';
  e._pqrs_estado_oficina='pendiente';
  e._pqrs_responsable_oficina='';
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  const notaFull=String(nota||'').trim()||('Solicitud de '+(solPor||'responsable')+' — revisión NCA');
  e._pqrs_historial.push({tipo:'traslado_oficina',fecha:hoy(),nota:notaFull,oficina:'secretaria',oficinaAnterior:anterior,por:'NCA DEGUV'});
  if(anterior&&anterior!=='secretaria')cancelarTareasPqrsNca(e,'Traslado a Secretaría — actividad cancelada');
  return true;
}
function puedeGestionarActLibre(){return puedeGestionarActividadesDepto();}
function getTaskSolicitudPendiente(t){return t&&t.solicitudPendiente&&t.solicitudPendiente.tipo?t.solicitudPendiente:null;}
function setTaskSolicitudPendiente(expId,taskId,data){
  return mutateTask(expId,taskId,t=>{
    t.solicitudPendiente={tipo:data.tipo,por:data.por||taskComentarioAutor(),fecha:new Date().toISOString(),nota:String(data.nota||'').trim(),destino:String(data.destino||'').trim()};
    t.historial.push({tipo:'solicitud_'+data.tipo,fecha:hoy(),por:t.solicitudPendiente.por,nota:t.solicitudPendiente.nota,a:t.solicitudPendiente.destino||'',estado:'pendiente'});
  });
}
function clearTaskSolicitudPendiente(expId,taskId,resolucion,nota){
  return mutateTask(expId,taskId,t=>{
    const sol=t.solicitudPendiente;
    if(sol)t.historial.push({tipo:'solicitud_resuelta',fecha:hoy(),por:taskComentarioAutor(),solTipo:sol.tipo,resolucion:resolucion||'rechazada',nota:nota||''});
    t.solicitudPendiente=null;
  });
}
function renderConPanelTaskBarHtml(expId){
  const taskId=window._conPanelTaskId;
  if(!taskId||!puedeGestionarActividadesDepto())return '';
  const t=normalizeTask(getTaskAny(expId,taskId));
  if(!t||t.eliminada)return '';
  const ref=expId;
  const sol=getTaskSolicitudPendiente(t);
  if(!sol)return '<div class="con-panel-task-bar" style="padding:.55rem .75rem"><div style="font-size:12px;color:var(--tx2)">📋 Editando actividad: <strong>'+escAttr(String(t.desc||t.actividad||'').substring(0,90))+'</strong> — use la sección Actividades asignadas abajo.</div></div>';
  return '<div class="con-panel-task-bar">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">⚠ Solicitud pendiente · '+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
    '<button type="button" class="btn bsm" style="background:var(--orl);color:var(--or);font-weight:600" onclick="openGestionSolicitudModal(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">'+(sol.tipo==='traslado'?'↔ Atender traslado':'🗑 Atender eliminación')+'</button></div>';
}
function getCfgActividadesPred(deptoId){
  return cfgFor(deptoId||getDeptoOperativo());
}
function taskCoEjecutorResumen(t){
  const rs=getTaskResponsables(t);
  const modo=t.entregaModo==='unificada'?'Unificada (una entrega cierra para todos)':'Individual (cada uno entrega por aparte)';
  return 'Co-ejecutores ('+rs.length+'): '+rs.map(n=>{
    const st=estadoTaskForAsignado(t,n);
    return taskAsignadoEstadoIcon(st)+' '+n+' — '+estadoTaskLabelFor(st);
  }).join(' · ')+' · Modo: '+modo;
}
function taskCoEjecutorBtnHtml(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!t||!taskEsMultiAsignada(t))return '';
  if(esModoResponsable()&&!taskUsuarioEsAsignado(t,responsableActivo))return '';
  const tip=taskCoEjecutorResumen(t);
  const fn=puedeGestionarActividadesDepto()?'openTaskCommentsModal(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',{gestionAsignados:true})':'mostrarCoEjecutoresTask(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')';
  return '<button type="button" class="btn bsm bic coej-btn" title="'+escAttr(tip)+'" onclick="'+fn+'">👥</button>';
}
function mostrarCoEjecutoresTask(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!t)return;
  if(puedeGestionarActividadesDepto())openTaskCommentsModal(expId,taskId,{gestionAsignados:true});
  else openTaskCommentsModal(expId,taskId,{soloCoEj:true});
}
function quitarResponsableTask(expId,taskId,nombre){
  const n=String(nombre||'').trim();if(!n)return false;
  const t=getTaskAny(expId,taskId);
  if(!t||getTaskResponsables(t).length<=1){notif('Debe quedar al menos un responsable','err');return false;}
  return mutateTask(expId,taskId,t=>{
    t.responsables=(t.responsables||[]).filter(r=>agendaNorm(r)!==agendaNorm(n));
    t.asignados=(t.asignados||[]).filter(a=>agendaNorm(a.nombre)!==agendaNorm(n));
    if(agendaNorm(t.responsable||'')===agendaNorm(n))t.responsable=t.responsables[0]||'';
    t.historial.push({tipo:'quitar_asignado',fecha:hoy(),de:n,por:taskComentarioAutor()});
    syncTaskAggregateState(t);
  });
}
function submitQuitarResponsableTask(expId,taskId,nombre){
  const ctx=window._taskModalCtx||{};
  if(ctx.formRowEl){
    const row=ctx.formRowEl;
    const t=buildTaskFromRow(row);
    const n=String(nombre||'').trim();
    if(!n||getTaskResponsables(t).length<=1){notif('Debe quedar al menos un responsable','err');return;}
    if(estadoTaskForAsignado(t,n)==='Atendida'){notif('No puede quitar a '+n+' — ya atendió la actividad','err');return;}
    t.responsables=(t.responsables||[]).filter(r=>agendaNorm(r)!==agendaNorm(n));
    t.asignados=(t.asignados||[]).filter(a=>agendaNorm(a.nombre)!==agendaNorm(n));
    if(agendaNorm(t.responsable||'')===agendaNorm(n))t.responsable=t.responsables[0]||'';
    t.historial.push({tipo:'quitar_asignado',fecha:hoy(),de:n,por:taskComentarioAutor()});
    if(getTaskResponsables(t).length<=1)t.entregaModo='individual';
    syncTaskAggregateState(t);
    persistTaskToRow(row,t);
    notif('Co-ejecutor retirado','ok');
    openTaskCoEjRowModal(row);
    return;
  }
  if(quitarResponsableTask(expId,taskId,nombre)){
    notif('Co-ejecutor retirado','ok');
    openTaskCommentsModal(expId,taskId,{gestionAsignados:true});
    if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  }
}
function eliminarActLibreConfirm(expId,taskId){eliminarActTaskConfirm(expId,taskId);}
function eliminarActTaskConfirm(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!t||!puedeGestionarActividadesDepto())return;
  if(!puedeEliminarTaskPqrs(expId,taskId)){notif('Solo Secretaría DEGUV puede eliminar actividades de PQRSD','err');return;}
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  if(!confirm('¿Eliminar la actividad «'+(t.desc||t.actividad||ref)+'»? Esta acción no se puede deshacer.'))return;
  if(eliminarTaskExp(ref,taskId,'Eliminada por encargado del departamento')){
    clearTaskSolicitudPendiente(ref,taskId,'aprobada','Eliminada por encargado');
    notif('Actividad eliminada','ok');
    closeTaskModal();
    renderActividades();
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
  }
}
function openEditarActLibreModal(expId,taskId){openEditarActTaskModal(expId,taskId);}
function openEditarActTaskModal(expId,taskId){
  if(!puedeGestionarActividadesDepto()){notif('Solo el encargado del departamento puede editar actividades','err');return;}
  const t=normalizeTask(getTaskAny(expId,taskId));
  if(!t||t.eliminada){notif('Actividad no encontrada','err');return;}
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Gestionar actividad · '+(t.sinExpediente?(t.codigo||ref):ref+' · '+(t.actividad||t.desc||'').slice(0,40));
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const ex=getExpById(ref);
  const depto=t.depto||(ex&&ex._depto)||deptoActivo;
  const rs=getTaskResponsables(t);
  const names=getResponsablesCoEjPool(ref,t.id,t);
  rs.forEach(n=>{if(n&&!names.some(x=>agendaNorm(x)===agendaNorm(n)))names.push(n);});
  const respChecks=names.length?names.map(n=>'<label class="act-libre-resp-row"><span class="act-libre-resp-nom">'+escAttr(n)+'</span><input type="checkbox" class="act-libre-resp-cb" value="'+escAttr(n)+'"'+(rs.some(r=>agendaNorm(r)===agendaNorm(n))?' checked':'')+' onchange="toggleActLibreModo()"></label>').join(''):'<div style="padding:10px;font-size:12px;color:var(--tx3)">No hay responsables configurados.</div>';
  const sugSrc=t.sinExpediente?'cortas':'exp';
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Edite la actividad asignada, cambie responsable(s), plazo o elimine la actividad.'+(t.sinExpediente?'':' Vinculada al expediente '+escAttr(ref)+'.')+'</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Actividad</label><div class="act-wrap"><input type="text" id="act-libre-nombre" data-sug-src="'+sugSrc+'" value="'+escAttr(t.actividad||t.desc||'')+'" placeholder="Buscar actividad..." oninput="filtrarActsPred(this)" onfocus="filtrarActsPred(this)" onblur="setTimeout(()=>hideActsPred(this),160)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label><input type="text" id="act-libre-detalle" value="'+escAttr(t.detalle||'')+'" placeholder="Detalles adicionales" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Co-ejecutores (marque uno o varios)</label><div id="act-libre-resps" class="act-libre-resps-box">'+respChecks+'</div></div>'+
    '<div class="fld" id="act-libre-modo-wrap" style="margin-bottom:8px;display:none"><label>Modo de entrega (varios responsables)</label><select id="act-libre-modo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"><option value="individual"'+(t.entregaModo!=='unificada'?' selected':'')+'>Individual — cada uno entrega por aparte</option><option value="unificada"'+(t.entregaModo==='unificada'?' selected':'')+'>Unificada — con una entrega se cierra para todos</option></select></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Plazo (días)</label><input type="number" id="act-libre-plazo" min="1" step="1" value="'+escAttr(t.plazoDias||'')+'" placeholder="Ej. 15" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px"><input type="checkbox" id="act-libre-prior"'+(t.prioritaria?' checked':'')+'> ⚡ Actividad prioritaria</label>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn bsm bp" onclick="submitEditarActTask(\''+escAttr(ref)+'\',\''+escAttr(t.id)+'\')">Guardar cambios</button>'+
    (puedeEliminarTaskPqrs(ref,t.id)?('<button type="button" class="btn bsm bd2" onclick="eliminarActTaskConfirm(\''+escAttr(ref)+'\',\''+escAttr(t.id)+'\')">🗑 Eliminar</button>'):'')+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'editarActTask',expId:ref,taskId:t.id,sinExpediente:!!t.sinExpediente};
  toggleActLibreModo();
}
function submitEditarActLibre(expId,taskId){submitEditarActTask(expId,taskId);}
function submitEditarActTask(expId,taskId){
  if(!puedeGestionarActividadesDepto())return;
  const act=(document.getElementById('act-libre-nombre')||{}).value;
  const det=(document.getElementById('act-libre-detalle')||{}).value;
  const responsables=[...document.querySelectorAll('.act-libre-resp-cb:checked')].map(el=>el.value.trim()).filter(Boolean);
  const plazo=(document.getElementById('act-libre-plazo')||{}).value;
  const prior=!!((document.getElementById('act-libre-prior')||{}).checked);
  const modoEl=document.getElementById('act-libre-modo');
  const entregaModo=(modoEl&&responsables.length>1)?modoEl.value:'individual';
  if(!String(act||'').trim()){notif('Indique el nombre de la actividad','err');return;}
  if(!responsables.length){notif('Seleccione al menos un responsable','err');return;}
  const prevT=normalizeTask(getTaskAny(expId,taskId));
  if(!prevT)return;
  const prevAsig=prevT.asignados||[];
  for(const a of prevAsig){
    if(responsables.some(n=>agendaNorm(n)===agendaNorm(a.nombre)))continue;
    if(estadoTaskForAsignado(prevT,a.nombre)==='Atendida'){
      notif('No puede quitar a '+a.nombre+' — ya atendió la actividad','err');return;
    }
  }
  if(mutateTask(expId,taskId,t=>{
    const prev=t.asignados||[];
    prev.forEach(a=>{
      if(!responsables.some(n=>agendaNorm(n)===agendaNorm(a.nombre))){
        t.historial.push({tipo:'quitar_asignado',fecha:hoy(),de:a.nombre,por:taskComentarioAutor()});
      }
    });
    responsables.forEach(n=>{
      if(!prev.some(a=>agendaNorm(a.nombre)===agendaNorm(n))){
        t.historial.push({tipo:'asignacion_extra',fecha:hoy(),a:n,por:taskComentarioAutor()});
      }
    });
    t.asignados=responsables.map(n=>{
      const ex=prev.find(a=>agendaNorm(a.nombre)===agendaNorm(n));
      return ex||{nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'};
    });
    t.responsables=responsables;
    t.responsable=responsables[0];
    t.entregaModo=entregaModo;
    t.actividad=act.trim();
    t.detalle=String(det||'').trim();
    t.desc=t.actividad+(t.detalle?' — '+t.detalle:'');
    t.plazoDias=plazo;
    if(plazo)t.vence=calcVence(plazo);
    t.prioritaria=prior;
    t.historial.push({tipo:'edicion',fecha:hoy(),por:taskComentarioAutor(),nota:'Actividad editada por encargado'});
    syncTaskAggregateState(t);
  })){
    syncPqrsResponsableDesdeTask(expId,taskId,responsables[0]);
    closeTaskModal();notif('Actividad actualizada','ok');
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
    if(!prevT.sinExpediente&&isFormExpVisible(expId))syncTkRowsFromExp(expId,taskId);
    refreshPqrsDetalleViews(expId);
  }
}
function openSolicitarTrasladoModal(expId,taskId){
  if(!esModoResponsable()||!responsableActivo){notif('Solo el responsable asignado puede solicitar traslado','err');return;}
  const t=getTaskAny(expId,taskId);
  if(!t||!taskUsuarioEsAsignado(t,responsableActivo)){notif('Actividad no asignada a usted','err');return;}
  if(getTaskSolicitudPendiente(t)){notif('Ya hay una solicitud pendiente en esta actividad','err');return;}
  if(estadoTask(t)==='Atendida'){notif('La actividad ya está finalizada','err');return;}
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Solicitar traslado · '+(t.desc||t.actividad||ref);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const opts=getResponsablesForTrasladoActividad(ref,taskId).filter(n=>n&&!getTaskResponsables(t).some(r=>agendaNorm(r)===agendaNorm(n))).map(n=>'<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>').join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">NCA DEGUV recibirá una notificación en la campanita 🔔 para revisar el traslado.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Trasladar a (sugerido)</label><select id="sol-traslado-dest" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"><option value="">— Seleccione responsable —</option>'+opts+'</select></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Motivo (opcional)</label><textarea id="sol-traslado-nota" placeholder="Indique el motivo del traslado…" style="width:100%;min-height:64px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif;font-size:12px"></textarea></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitSolicitarTraslado(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">Enviar solicitud</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'solTraslado',expId:ref,taskId};
}
function submitSolicitarTraslado(expId,taskId){
  const dest=(document.getElementById('sol-traslado-dest')||{}).value;
  const nota=(document.getElementById('sol-traslado-nota')||{}).value;
  if(!String(dest||'').trim()){notif('Seleccione el responsable destino','err');return;}
  if(setTaskSolicitudPendiente(expId,taskId,{tipo:'traslado',destino:dest,nota:nota})){
    closeTaskModal();notif('Solicitud de traslado enviada a NCA DEGUV','ok');renderActividades();renderBandejaDepto();
  }
}
function openSolicitarEliminacionModal(expId,taskId){
  if(!esModoResponsable()||!responsableActivo){notif('Solo el responsable asignado puede solicitar eliminación','err');return;}
  const t=getTaskAny(expId,taskId);
  if(!t||!taskUsuarioEsAsignado(t,responsableActivo)){notif('Actividad no asignada a usted','err');return;}
  if(getTaskSolicitudPendiente(t)){notif('Ya hay una solicitud pendiente en esta actividad','err');return;}
  if(estadoTask(t)==='Atendida'){notif('La actividad ya está finalizada','err');return;}
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Solicitar eliminación · '+(t.desc||t.actividad||ref);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">NCA DEGUV recibirá una notificación en la campanita 🔔 para revisar la solicitud. Solo Secretaría puede eliminar PQRSD.</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Motivo</label><textarea id="sol-elim-nota" placeholder="Indique por qué solicita eliminar esta actividad…" style="width:100%;min-height:72px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif;font-size:12px"></textarea></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bd2" onclick="submitSolicitarEliminacion(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">Enviar solicitud</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'solElim',expId:ref,taskId};
}
function submitSolicitarEliminacion(expId,taskId){
  const nota=(document.getElementById('sol-elim-nota')||{}).value;
  if(!String(nota||'').trim()){notif('Indique el motivo de la solicitud','err');return;}
  if(setTaskSolicitudPendiente(expId,taskId,{tipo:'eliminacion',nota:nota})){
    closeTaskModal();notif('Solicitud enviada a NCA DEGUV para revisión','ok');renderActividades();renderBandejaDepto();
  }
}
function openGestionSolicitudModal(expId,taskId){
  if(!puedeGestionarSolicitudActividad(expId,taskId)){notif('No puede atender esta solicitud','err');return;}
  const t=normalizeTask(getTaskAny(expId,taskId));
  if(!t){notif('Actividad no encontrada','err');return;}
  const sol=getTaskSolicitudPendiente(t);
  if(!sol){notif('No hay solicitud pendiente en esta actividad','err');return;}
  const e=getExpById(expId);
  const esPqrsSol=e&&taskEsAtenderPqrs(t,e);
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent=(sol.tipo==='traslado'?'Solicitud de traslado':'Solicitud de eliminación')+' · '+(t.desc||t.actividad||ref);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const poolResp=getResponsablesForTrasladoActividad(ref,taskId);
  const opts=poolResp.filter(n=>n).map(n=>'<option value="'+escAttr(n)+'"'+(sol.destino&&agendaNorm(n)===agendaNorm(sol.destino)?' selected':'')+'>'+escAttr(n)+'</option>').join('');
  let h='<div style="font-size:13px;font-weight:600;margin-bottom:8px">'+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px;padding:8px;background:var(--orl);border-radius:var(--r)">'+
    '<strong>'+escAttr(sol.por)+'</strong> solicita '+(sol.tipo==='traslado'?'trasladar la actividad'+(sol.destino?' a <strong>'+escAttr(sol.destino)+'</strong>':''):'eliminar la actividad')+
    (sol.nota?('<br><span style="margin-top:4px;display:block">Motivo: '+escAttr(sol.nota)+'</span>'):'')+'</div>';
  if(esPqrsSol&&sol.tipo==='eliminacion'){
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px;padding:8px;background:var(--bll);border-radius:var(--r)">Solo <strong>Secretaría DEGUV</strong> puede eliminar PQRSD. Puede devolverla a Secretaría con un comentario para que proceda a eliminación o edición.</div>'+
      '<div class="fld" style="margin-bottom:10px"><label>Comentario para Secretaría</label><textarea id="gest-sol-secre-nota" placeholder="Indique a Secretaría qué debe hacer (eliminar, corregir datos, etc.)…" style="width:100%;min-height:72px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif;font-size:12px"></textarea></div>';
  }
  if(sol.tipo==='traslado'){
    h+='<div class="fld" style="margin-bottom:10px"><label>Trasladar a</label><select id="gest-sol-traslado-dest" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"><option value="">— Seleccione —</option>'+opts+'</select></div>';
  }
  h+='<div class="fx" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">'+
    (sol.tipo==='traslado'?'<button type="button" class="btn bsm bp" onclick="aprobarSolicitudTraslado(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">✓ Aprobar traslado</button>':
      (esPqrsSol?'<button type="button" class="btn bsm bp" onclick="aprobarSolicitudPqrsDevolverSecretaria(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">↩ Devolver a Secretaría</button>':'<button type="button" class="btn bsm bd2" onclick="aprobarSolicitudEliminacion(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">✓ Aprobar eliminación</button>'))+
    '<button type="button" class="btn bsm" onclick="rechazarSolicitudTask(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">↩ Rechazar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  body.innerHTML=h;
  ov.classList.add('on');
  window._taskModalCtx={mode:'gestionSolicitud',expId:ref,taskId};
}
function aprobarSolicitudPqrsDevolverSecretaria(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const sol=getTaskSolicitudPendiente(t);
  if(!sol)return;
  const notaEl=document.getElementById('gest-sol-secre-nota');
  const nota=notaEl?String(notaEl.value||'').trim():'';
  if(!nota){notif('Indique el comentario para Secretaría','err');return;}
  const e=getExpById(expId);
  if(!e||!taskEsAtenderPqrs(t,e)){notif('No es actividad PQRSD','err');return;}
  const notaFull=nota+(sol.nota?' · Motivo del responsable: '+sol.nota:'');
  if(trasladarPqrsASecretariaDesdeNca(expId,notaFull,sol.por)){
    clearTaskSolicitudPendiente(expId,taskId,'aprobada','Devuelta a Secretaría — '+nota);
    persistExpedienteGranular(e);
    closeTaskModal();notif('PQRSD devuelta a Secretaría DEGUV','ok');
    renderActividades();renderBandejaDepto();refreshPqrsDetalleViews(expId);
    renderSecretariaPqrs();
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
  }
}
function aprobarSolicitudTraslado(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const sol=getTaskSolicitudPendiente(t);
  if(!sol||sol.tipo!=='traslado')return;
  const sel=document.getElementById('gest-sol-traslado-dest');
  const dest=(sel&&sel.value)||sol.destino||'';
  if(!dest){notif('Seleccione el responsable destino','err');return;}
  if(trasladarTaskExp(expId,taskId,dest)){
    syncPqrsResponsableDesdeTask(expId,taskId,dest);
    clearTaskSolicitudPendiente(expId,taskId,'aprobada','Traslado aprobado a '+dest);
    persistExpedienteGranular(e);
    closeTaskModal();notif('Traslado realizado a '+dest,'ok');renderActividades();renderBandejaDepto();
    refreshPqrsDetalleViews(expId);
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
  }
}
function aprobarSolicitudEliminacion(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const sol=getTaskSolicitudPendiente(t);
  if(!sol||sol.tipo!=='eliminacion')return;
  const e=getExpById(expId);
  if(e&&t&&taskEsAtenderPqrs(t,e)){notif('Las solicitudes de eliminación PQRSD las revisa NCA; solo Secretaría puede eliminar','err');return;}
  confirmEliminar({title:'Confirmar eliminación de actividad',message:'¿Confirma eliminar la actividad «'+(t.desc||t.actividad||'')+'»?',detail:sol.por?'Solicitado por: '+sol.por:'',confirmLabel:'Sí, eliminar actividad'},()=>{
    if(eliminarTaskExp(expId,taskId,'Eliminación aprobada — solicitud de '+sol.por)){
      clearTaskSolicitudPendiente(expId,taskId,'aprobada','Eliminación aprobada');
      closeTaskModal();notif('Actividad eliminada','ok');renderActividades();renderBandejaDepto();
      if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
    }
  });
}
function rechazarSolicitudTask(expId,taskId){
  confirmPrecaucion({
    title:'Rechazar solicitud',
    message:'¿Confirma rechazar esta solicitud? El responsable podrá continuar con la actividad.',
    tone:'reject',
    confirmLabel:'Sí, rechazar',
    prompt:true,
    promptPlaceholder:'Motivo del rechazo (opcional)'
  },function(nota){
    if(clearTaskSolicitudPendiente(expId,taskId,'rechazada',String(nota||'').trim()||'Rechazada por encargado')){
      closeTaskModal();notif('Solicitud rechazada','ok');renderActividades();renderBandejaDepto();
    }
  });
}
function renderTaskAsignadosPanelHtml(expId,taskId,t,canEdit,opts){
  opts=opts||{};
  t=normalizeTask(t);
  const rs=getTaskResponsables(t);
  const multi=rs.length>1;
  const pqrsNca=!!opts.pqrsNca;
  let h='<div class="task-asig-panel"><div style="font-size:12px;font-weight:600;margin-bottom:6px">👥 Co-ejecutores ('+rs.length+')</div>';
  if(multi){
    h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Modo: <strong>'+(t.entregaModo==='unificada'?'Unificada (una entrega cubre a todos)':'Individual (cada uno entrega por aparte)')+'</strong></div>';
  }
  rs.forEach(n=>{
    const st=estadoTaskForAsignado(t,n);
    h+='<div class="task-asig-row"><span style="font-weight:600">'+taskAsignadoEstadoIcon(st)+' '+escAttr(n)+'</span>'+
      '<span class="bdg" style="font-size:10px;background:'+taskEstadoStyle(st).bg+';color:'+taskEstadoStyle(st).fg+'">'+estadoTaskLabelFor(st)+'</span>'+
      (canEdit&&multi&&rs.length>1&&st!=='Atendida'?'<button type="button" class="btn bsm bd2" style="margin-left:auto;font-size:10px;padding:2px 6px" onclick="submitQuitarResponsableTask(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',\''+escAttr(n)+'\')">Quitar</button>':'')+
      '</div>';
  });
  if(canEdit){
    const pool=getResponsablesCoEjPool(expId,taskId,t);
    const optsAdd=pool.filter(n=>n&&!rs.some(r=>agendaNorm(r)===agendaNorm(n))).map(n=>'<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>').join('');
    h+='<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">'+
      '<select id="task-asig-add-sel" style="min-width:160px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px" onchange="toggleTaskAsigModo()"><option value="">+ Añadir co-ejecutor</option>'+optsAdd+'</select>'+
      '<button type="button" class="btn bsm" onclick="submitAnadirResponsableTask(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Añadir</button>'+
      '</div>'+
      '<div id="task-asig-modo-wrap" class="fld" style="margin-top:8px;'+(multi?'':'display:none')+'">'+
      '<label style="font-size:11px;font-weight:600;color:var(--tx2)">Modo de entrega (varios responsables)</label>'+
      '<select id="task-asig-modo" style="width:100%;max-width:420px;padding:6px;margin-top:4px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px" onchange="cambiarEntregaModoTask(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',this.value)">'+
      '<option value="individual"'+(t.entregaModo!=='unificada'?' selected':'')+'>Individual — cada uno entrega por aparte</option>'+
      '<option value="unificada"'+(t.entregaModo==='unificada'?' selected':'')+'>Unificada — con una entrega se cierra para todos</option>'+
      '</select></div>';
    if(!pqrsNca){
      h+='<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">'+
        '<select id="task-asig-traslado-sel" style="min-width:160px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px"><option value="">↔ Trasladar / reemplazar</option>'+
        pool.filter(n=>n).map(n=>'<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>').join('')+'</select>'+
        '<button type="button" class="btn bsm" onclick="submitTrasladoTaskModal(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Trasladar</button></div>';
    }
    if(t.sinExpediente&&!pqrsNca)h+='<div style="margin-top:8px"><button type="button" class="btn bsm bd2" onclick="eliminarActLibreConfirm(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">🗑 Eliminar actividad sin expediente</button></div>';
  }
  h+='</div>';
  return h;
}
function estadoTaskLabelFor(est){
  if(est==='En ejecución')return'Por ejecutar';
  if(est==='Por verificar')return(esModoResponsable()&&!esVistaActividadesDepto())?'Por verificar':'Por revisar';
  return est;
}
function normalizeTask(t){
  if(!t)return null;
  if(!t.id)t.id=genTaskId();
  if(!Array.isArray(t.comentarios))t.comentarios=[];
  if(!Array.isArray(t.historial))t.historial=[];
  if(!Array.isArray(t.soportes))t.soportes=[];
  if(!Array.isArray(t.notasDoc))t.notasDoc=[];
  t.soportes.forEach((s,i)=>{if(!s.id)s.id='sop_'+Date.now()+'_'+i;});
  migrateLegacyAsignados(t);
  if(t.fechaAtendida&&(t.estado==='Atendida'||t.estado==='Completada'||!t.estado))t.estado='Atendida';
  else if(t.fechaReportada&&!t.fechaAtendida)t.estado='Por verificar';
  else if(t.estado==='Por corregir'&&!t.fechaReportada&&!t.fechaAtendida)t.estado='Por corregir';
  else if(!t.estado)t.estado=estadoTaskRaw(t);
  else if((t.responsables||[]).length>1||(t.asignados||[]).length>1)syncTaskAggregateState(t);
  t.prioritaria=!!t.prioritaria;
  return t;
}
function parseDrivePreviewUrl(url){
  let u=String(url||'').trim();
  if(!u)return{url:'',preview:'',valid:false,id:''};
  if(!/^https?:\/\//i.test(u)&&/^(drive|docs)\.google/i.test(u))u='https://'+u.replace(/^\/+/,'');
  let id='';
  const mFile=u.match(/\/file\/d\/([^/?#]+)/);
  if(mFile)id=mFile[1];
  const mDoc=u.match(/\/document\/d\/([^/?#]+)/);
  if(mDoc){
    id=mDoc[1];
    return{url:'https://docs.google.com/document/d/'+id+'/edit',preview:'https://docs.google.com/document/d/'+id+'/preview',valid:true,id};
  }
  const mSheet=u.match(/\/spreadsheets\/d\/([^/?#]+)/);
  if(mSheet){
    id=mSheet[1];
    return{url:'https://docs.google.com/spreadsheets/d/'+id+'/edit',preview:'https://docs.google.com/spreadsheets/d/'+id+'/preview',valid:true,id};
  }
  const mPres=u.match(/\/presentation\/d\/([^/?#]+)/);
  if(mPres){
    id=mPres[1];
    return{url:'https://docs.google.com/presentation/d/'+id+'/edit',preview:'https://docs.google.com/presentation/d/'+id+'/preview',valid:true,id};
  }
  const m2=u.match(/[?&]id=([^&]+)/);
  if(!id&&m2)id=m2[1];
  if(id)return{url:'https://drive.google.com/file/d/'+id+'/view',preview:'https://drive.google.com/file/d/'+id+'/preview',valid:true,id};
  if(/^https?:\/\//i.test(u))return{url:u,preview:u,valid:true,id:''};
  return{url:u,preview:'',valid:false,id:''};
}
function normalizeDriveUrlInput(url){
  let u=String(url||'').trim();
  if(!u)return'';
  if(!/^https?:\/\//i.test(u)&&(/^(drive|docs)\.google/i.test(u)||/google\.com/i.test(u)))u='https://'+u.replace(/^\/+/,'');
  return u;
}
function esLinkDriveValid(url){
  const u=normalizeDriveUrlInput(url);
  if(!u)return false;
  return /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(u);
}
function loadCdaLocksRaw(){
  try{const raw=localStorage.getItem(CDA_LOCKS_KEY);return raw?JSON.parse(raw):{};}catch(e){return{};}
}
function saveCdaLocks(locks){
  try{localStorage.setItem(CDA_LOCKS_KEY,JSON.stringify(locks||{}));}catch(e){}
}
function getCdaLockSessionId(){
  try{
    let s=sessionStorage.getItem('cda_lock_sid');
    if(!s){s='ls_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);sessionStorage.setItem('cda_lock_sid',s);}
    return s;
  }catch(e){
    if(!window._cdaLockSessionId)window._cdaLockSessionId='ls_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
    return window._cdaLockSessionId;
  }
}
function getExpLockUserLabel(){
  if(esModoResponsable()&&responsableActivo)return responsableActivo;
  if(esModoOficinaDeguv()){const enc=getEncargadoOficina(deptoActivo);return enc?enc+' · '+labelOficina(deptoActivo):labelOficina(deptoActivo);}
  if(esSecretaria()){const enc=getEncargadoOficina('secretaria');return enc?enc+' · Secretaría DEGUV':'Secretaría DEGUV';}
  if(esJurisdiccional())return CHAT_LABEL_SUBDIRECCION;
  if(esAdministrador())return 'Administrador · '+labelDepto(deptoActivo||getDeptoOperativo());
  const dep=deptoActivo||getDeptoOperativo();
  const enc=getEncargadoDepto(dep);
  if(enc)return enc+' · '+labelDepto(dep);
  return labelDepto(dep);
}
function fmtHoraLock(ts){
  return new Date(Number(ts)||Date.now()).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
}
function limpiarLocksExpirados(){
  const locks=loadCdaLocksRaw();
  const now=Date.now();
  let ch=false;
  Object.keys(locks).forEach(k=>{if(!locks[k]||Number(locks[k].expira)<=now){delete locks[k];ch=true;}});
  if(ch)saveCdaLocks(locks);
  return locks;
}
function getExpLockVigente(expId){
  expId=String(expId||'').trim();
  if(!expId)return null;
  const locks=limpiarLocksExpirados();
  const lk=locks[expId];
  if(!lk||Number(lk.expira)<=Date.now())return null;
  return lk;
}
function poseeExpLock(expId){
  const lk=getExpLockVigente(expId);
  return !!(lk&&lk.sessionId===getCdaLockSessionId());
}
function adquirirExpLock(expId){
  expId=String(expId||'').trim();
  if(!expId)return{ok:true,readOnly:false};
  const locks=limpiarLocksExpirados();
  const now=Date.now();
  const sid=getCdaLockSessionId();
  const lk=locks[expId];
  if(lk&&Number(lk.expira)>now&&lk.sessionId!==sid){
    return{ok:false,readOnly:true,msg:'⚠️ '+lk.bloqueadoPor+' está editando este expediente desde las '+fmtHoraLock(lk.desde)+'. Puede ver el expediente pero no editar hasta que termine.'};
  }
  locks[expId]={bloqueadoPor:getExpLockUserLabel(),sessionId:sid,desde:now,expira:now+CDA_LOCK_TTL_MS};
  saveCdaLocks(locks);
  window._cdaLockHeld=expId;
  return{ok:true,readOnly:false};
}
function renovarExpLock(expId){
  expId=String(expId||window._cdaLockHeld||'').trim();
  if(!expId||!poseeExpLock(expId))return;
  const locks=limpiarLocksExpirados();
  if(locks[expId]&&locks[expId].sessionId===getCdaLockSessionId()){
    locks[expId].expira=Date.now()+CDA_LOCK_TTL_MS;
    saveCdaLocks(locks);
  }
}
function liberarExpLock(expId){
  expId=String(expId||window._conPanelActive||window._cdaLockHeld||'').trim();
  if(!expId)return;
  const locks=loadCdaLocksRaw();
  const lk=locks[expId];
  if(lk&&lk.sessionId===getCdaLockSessionId()){
    delete locks[expId];
    saveCdaLocks(locks);
  }
  if(window._cdaLockHeld===expId)window._cdaLockHeld=null;
}
function detenerRenovacionExpLock(){
  if(window._cdaLockRenewTimer){clearInterval(window._cdaLockRenewTimer);window._cdaLockRenewTimer=null;}
}
function iniciarRenovacionExpLock(expId){
  detenerRenovacionExpLock();
  expId=String(expId||'').trim();
  if(!expId)return;
  window._cdaLockHeld=expId;
  window._cdaLockRenewTimer=setInterval(()=>renovarExpLock(expId),CDA_LOCK_RENEW_MS);
}
function resolverEdicionConBloqueo(expId,wantEdit){
  if(!wantEdit||!puedeEditarExpPanel()){
    window._conPanelLockMsg=null;
    detenerRenovacionExpLock();
    return false;
  }
  const lr=adquirirExpLock(expId);
  if(!lr.ok){
    window._conPanelLockMsg=lr.msg;
    detenerRenovacionExpLock();
    return false;
  }
  window._conPanelLockMsg=null;
  iniciarRenovacionExpLock(expId);
  return true;
}
function expLockTooltip(expId){
  const lk=getExpLockVigente(expId);
  if(!lk)return '';
  return 'En edición por '+lk.bloqueadoPor+' desde '+fmtHoraLock(lk.desde);
}
function expLockIconHtml(expId){
  const lk=getExpLockVigente(expId);
  if(!lk||poseeExpLock(expId))return '';
  return ' <span title="'+escAttr(expLockTooltip(expId))+'" style="cursor:help;font-size:12px">🔒</span>';
}
function iniciarRefrescoBloqueosUI(){
  if(window._cdaLockUiTimer)return;
  window._cdaLockUiTimer=setInterval(refrescarBloqueosUI,CDA_LOCK_UI_REFRESH_MS);
}
function refrescarBloqueosUI(){
  const antes=Object.keys(loadCdaLocksRaw()).length;
  const locks=limpiarLocksExpirados();
  const despues=Object.keys(locks).length;
  const expiraron=antes>despues;
  const pgReg=document.getElementById('pg-reg');
  if(expiraron||(despues>0&&pgReg&&pgReg.classList.contains('on')))renderTabla();
  const panel=document.getElementById('con-side-panel');
  if(panel&&panel.classList.contains('on')&&window._conPanelActive&&!window._conPanelEditMode){
    const lk=getExpLockVigente(window._conPanelActive);
    if(!lk&&window._conPanelLockMsg){
      window._conPanelLockMsg=null;
      renderConSidePanel();
    }
  }
}
function loadAuditLog(){
  try{
    const raw=localStorage.getItem(CDA_AUDIT_KEY);
    const log=raw?JSON.parse(raw):[];
    return Array.isArray(log)?log:[];
  }catch(e){return[];}
}
function saveAuditLogDirect(log){
  try{localStorage.setItem(CDA_AUDIT_KEY,JSON.stringify(Array.isArray(log)?log:[]));}catch(e){}
}
function fmtAuditFecha(d){
  d=d||new Date();
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}
function getAuditRolLabel(){
  if(esModoResponsable()&&responsableActivo)return responsableActivo+' (responsable)';
  if(esAdministrador())return 'Administrador';
  if(esJurisdiccional())return 'Subdirección';
  if(esSecretaria())return 'Secretaría DEGUV';
  if(esModoOficinaDeguv())return labelOficina(deptoActivo);
  if(esModoCiudadano())return 'Ciudadano';
  const rol=ROLES_INGRESO&&ROLES_INGRESO.find(r=>r.id===rolSesion);
  if(rol)return rol.titulo;
  if(rolSesion&&DEPTOS.some(d=>d.id===rolSesion))return labelDepto(rolSesion);
  return labelDepto(deptoActivo||getDeptoOperativo());
}
function logAudit(accion,modulo,expedienteId,detalle){
  const log=loadAuditLog();
  log.push({
    id:String(Date.now())+'_'+Math.random().toString(36).slice(2,6),
    fecha:fmtAuditFecha(new Date()),
    rol:getAuditRolLabel(),
    accion:String(accion||''),
    modulo:String(modulo||''),
    expedienteId:expedienteId!=null&&expedienteId!==''?String(expedienteId):null,
    detalle:detalle!=null?String(detalle):''
  });
  saveAuditLogDirect(log);
  if(document.getElementById('cpg-auditoria')&&document.getElementById('cpg-auditoria').classList.contains('on'))renderAuditLogCfg();
}
function auditCfgChange(detalle){
  logAudit('Modificó configuración de '+labelDepto(deptoCfg||getDeptoOperativo()),'configuracion',null,detalle||'');
}
function renderAuditLogCfg(){
  const el=document.getElementById('cfg-auditoria-panel');
  if(!el)return;
  if(!esAdministrador()){el.innerHTML='<div class="emp" style="padding:1rem">Solo el administrador puede ver el log de auditoría.</div>';return;}
  const rows=loadAuditLog().slice(-200).reverse();
  const tbody=rows.length?rows.map(r=>'<tr>'+
    '<td style="font-size:11px;white-space:nowrap">'+escAttr(r.fecha||'')+'</td>'+
    '<td style="font-size:11px">'+escAttr(r.rol||'')+'</td>'+
    '<td style="font-size:12px">'+escAttr(r.accion||'')+'</td>'+
    '<td style="font-size:11px">'+escAttr(r.modulo||'')+'</td>'+
    '<td style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--bl)">'+(r.expedienteId?escAttr(r.expedienteId):'—')+'</td>'+
    '</tr>').join(''):'<tr><td colspan="5" class="emp">Sin entradas registradas.</td></tr>';
  el.innerHTML='<div class="card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
    '<div><div style="font-size:14px;font-weight:600">Log de Auditoría</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-top:2px">Últimas '+rows.length+' entradas · '+loadAuditLog().length+' en total</div></div>'+
    '<button type="button" class="btn bsm bp" onclick="SST.exportarAuditLogCompleto()">⬇ Exportar log completo</button></div>'+
    '<div style="overflow:auto;max-height:min(70vh,640px)"><table class="tbl" style="width:100%"><thead><tr>'+
    '<th>Fecha</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Expediente</th></tr></thead><tbody>'+tbody+'</tbody></table></div></div>';
}
function exportarAuditLogCompleto(){
  if(!esAdministrador()){notif('Solo administrador','err');return;}
  const entries=loadAuditLog();
  const data={app:'ProgramaRegistroExpedientes',tipo:'audit_log',exportadoEn:new Date().toISOString(),total:entries.length,entries};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='cda-audit-log-'+hoy()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  logAudit('Exportó log de auditoría completo','configuracion',null,entries.length+' entradas');
  notif('Log de auditoría exportado ('+entries.length+' entradas)','ok');
}
function rolesFirestoreOpts(selected){
  const excluir=new Set(['ciudadano','contratista']);
  const seen=new Set();
  const opts=[];
  ROLES_INGRESO.forEach(r=>{if(!seen.has(r.id)&&!excluir.has(r.id)){seen.add(r.id);opts.push(r);}});
  let h=selected?'':'<option value="">— Seleccione rol —</option>';
  h+=opts.map(r=>'<option value="'+escAttr(r.id)+'"'+(selected===r.id?' selected':'')+'>'+escAttr(r.titulo)+'</option>').join('');
  return h;
}
function tituloRolFirestore(rolId){
  if(rolId==='contratista')return 'Responsables';
  const r=ROLES_INGRESO.find(x=>x.id===rolId);
  if(r)return r.titulo;
  return rolId||'—';
}
function esResponsableIdentidadFija(){
  if(!window._usuarioActual||esAdminFirestore())return false;
  const r=window._usuarioActual.rol;
  return r==='responsables'||r==='contratista';
}
function getResponsableLoginNombre(){
  const u=window._usuarioActual;
  if(!u)return '';
  const ins=findInstructorByEmail(u.email);
  if(ins&&String(ins.nombre||'').trim())return String(ins.nombre).trim();
  return String(u.nombre||'').trim();
}
function fijarResponsableSesion(){
  const nom=getResponsableLoginNombre();
  if(!nom)return false;
  responsableActivo=nom;
  try{localStorage.setItem('sst_responsable',nom);}catch(e){}
  const hint=document.getElementById('resp-global-hint');
  if(hint)hint.textContent='Sesión vinculada a su cuenta · '+nom;
  return true;
}
function normalizarRolLoginFirestore(rol){
  rol=String(rol||'').trim();
  if(rol==='contratista')return'responsables';
  return rol;
}
function resolverAccesoLoginUsuario(data,email){
  const rolRaw=String(data.rol||'').trim();
  if(rolRaw==='ciudadano'){
    return{ok:false,msg:'La consulta ciudadana no requiere cuenta Google. Use la opción en la pantalla de inicio.'};
  }
  const rolLogin=normalizarRolLoginFirestore(rolRaw);
  const rolesValidos=ROLES_INGRESO.map(r=>r.id).filter(id=>id!=='ciudadano'&&id!=='contratista');
  if(!rolesValidos.includes(rolLogin)&&rolRaw!=='contratista'){
    return{ok:false,msg:'❌ Acceso denegado. Rol no reconocido en el sistema.'};
  }
  let respNom='';
  if(rolLogin==='responsables'){
    const ins=findInstructorByEmail(email);
    respNom=ins&&String(ins.nombre||'').trim()?String(ins.nombre).trim():String(data.nombre||'').trim();
    if(!respNom){
      return{ok:false,msg:'❌ Acceso denegado. Debe estar registrado como responsable en Configuración antes de ingresar.'};
    }
  }
  return{ok:true,rol:rolLogin,respNom};
}
let _usuariosCache=[];
let _usuariosCacheLoaded=false;
let _usuariosEditEmail='';
let _usuariosFsUnsub=null;
function sortUsuariosCache(){
  _usuariosCache.sort((a,b)=>String(a.nombre||a.email).localeCompare(String(b.nombre||b.email),'es'));
}
function mergeUsuarioEnCache(u){
  if(!u||!u.email)return;
  const em=String(u.email).trim().toLowerCase();
  const i=_usuariosCache.findIndex(x=>String(x.email||'').trim().toLowerCase()===em);
  const row={
    email:em,
    nombre:u.nombre||'',
    rol:u.rol||'',
    codigo:u.codigo||'',
    cargo:u.cargo||'',
    activo:u.activo!==false,
    deptoResponsable:String(u.deptoResponsable||'').trim()
  };
  if(i>=0)_usuariosCache[i]={..._usuariosCache[i],...row};
  else _usuariosCache.push(row);
  sortUsuariosCache();
  _usuariosCacheLoaded=true;
  try{localStorage.setItem('sst_usuarios_index',JSON.stringify(_usuariosCache));}catch(e){}
}
function removeUsuarioDeCache(email){
  const em=String(email||'').trim().toLowerCase();
  if(!em)return;
  _usuariosCache=_usuariosCache.filter(u=>String(u.email||'').trim().toLowerCase()!==em);
  _usuariosCacheLoaded=true;
  try{localStorage.setItem('sst_usuarios_index',JSON.stringify(_usuariosCache));}catch(e){}
}
function aplicarUsuariosIndex(arr){
  if(!Array.isArray(arr))return false;
  _usuariosCache=arr.map(u=>({
    email:String(u.email||'').trim().toLowerCase(),
    nombre:u.nombre||'',
    rol:u.rol||'',
    codigo:u.codigo||'',
    activo:u.activo!==false,
    deptoResponsable:String(u.deptoResponsable||'').trim()
  })).filter(u=>u.email);
  sortUsuariosCache();
  _usuariosCacheLoaded=true;
  try{localStorage.setItem('sst_usuarios_index',JSON.stringify(_usuariosCache));}catch(e){}
  return _usuariosCache.length>0;
}
async function persistUsuariosIndexGlobal(){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return;
  const index=_usuariosCache.map(u=>({
    email:String(u.email||'').trim().toLowerCase(),
    nombre:u.nombre||'',
    rol:u.rol||'',
    codigo:u.codigo||'',
    activo:u.activo!==false,
    deptoResponsable:String(u.deptoResponsable||'').trim()
  }));
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{usuariosIndex:index,updatedAt:new Date().toISOString()},{merge:true});
  }catch(err){console.error('Error sincronizando índice de usuarios:',err);}
}
async function refreshUsuariosAutorizadosUi(){
  invalidateUsuariosCache();
  await loadUsuariosFirestore();
  paintUsuariosCfgTable();
}
async function sincronizarUsuariosAutorizados(){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');return;}
  invalidateUsuariosCache();
  await refreshUsuariosAutorizadosUi();
  notif('Lista actualizada · '+usuariosAutorizadosVisibles().length+' usuario(s)','ok');
}
function stopUsuariosFirestoreListener(){
  if(_usuariosFsUnsub){_usuariosFsUnsub();_usuariosFsUnsub=null;}
}
function startUsuariosFirestoreListener(){
  stopUsuariosFirestoreListener();
  const db=window._db;
  if(!db||!window._fsOnSnapshot||!window._fsCollection)return;
  _usuariosFsUnsub=window._fsOnSnapshot(window._fsCollection(db,'usuarios'),snap=>{
    if(!snap.empty){
      _usuariosCache=[];
      snap.forEach(d=>{_usuariosCache.push({email:d.id,...(d.data()||{})});});
      sortUsuariosCache();
      _usuariosCacheLoaded=true;
      try{localStorage.setItem('sst_usuarios_index',JSON.stringify(_usuariosCache));}catch(e){}
      persistUsuariosIndexGlobal().catch(()=>{});
    }
    paintUsuariosCfgTable();
    aplicarSyncUsuariosAutorizados({skipSave:true,silent:true});
    if(document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on'))renderListasCfg();
    if(typeof chatRefreshContactsIfOpen==='function')chatRefreshContactsIfOpen();
  },err=>{
    console.error('Error escuchando usuarios Firestore:',err);
    refreshUsuariosAutorizadosUi();
  });
}
function paintUsuariosCfgTable(){
  const tbody=document.getElementById('usuarios-fs-tbody');
  const cnt=document.getElementById('usuarios-fs-count');
  if(!tbody)return;
  const list=usuariosAutorizadosVisibles();
  const puedeEliminar=puedeEliminarUsuariosAutorizados();
  if(cnt)cnt.textContent=String(list.length);
  tbody.innerHTML=list.length?list.map(u=>{
    const act=u.activo!==false;
    const em=jsStr(u.email);
    return '<tr>'+
      '<td>'+escAttr(u.nombre||'—')+'</td>'+
      '<td style="font-size:12px">'+escAttr(u.email)+'</td>'+
      '<td>'+escAttr(tituloRolFirestore(u.rol))+'</td>'+
      '<td>'+escAttr(labelDeptoResponsableUsuario(u))+'</td>'+
      '<td>'+escAttr(u.codigo||'—')+(u.cargo==='vital'?' <span class="bdg" style="background:#6d3fa8;color:#fff;font-size:10px">VITAL</span>':'')+'</td>'+
      '<td>'+(act?'<span class="bdg" style="background:var(--gnl);color:var(--gn)">Activo</span>':'<span class="bdg" style="background:var(--rdl);color:var(--rd)">Inactivo</span>')+'</td>'+
      '<td style="white-space:nowrap">'+
      '<button type="button" class="btn bsm" onclick="SST.editarUsuarioFirestore(\''+em+'\')">Editar</button> '+
      '<button type="button" class="btn bsm" onclick="SST.toggleUsuarioFirestoreActivo(\''+em+'\','+(!act)+')">'+(act?'Desactivar':'Activar')+'</button> '+
      (puedeEliminar?('<button type="button" class="btn bsm bd2" onclick="SST.eliminarUsuarioFirestore(\''+em+'\')">Eliminar</button>'):'')+
      '</td></tr>';
  }).join(''):'<tr><td colspan="7" class="emp">No hay usuarios registrados.</td></tr>';
}
function buildUsuariosCfgShell(){
  const encDepto=esEncargadoDepartamentalUsuarios();
  const deptoEnc=getDeptoGestionUsuariosAutorizados();
  const tituloTab=encDepto?'👥 Responsables autorizados':'👥 Usuarios autorizados';
  const ayuda=encDepto
    ?('Registre responsables con acceso Google para <strong>'+escAttr(labelDepartamento(deptoEnc))+'</strong>. Puede agregar, editar y desactivar. Solo el administrador puede eliminar.')
    :('El rol define el módulo (Secretaría, NCA, departamentos u oficinas). Para <strong>Responsables</strong> indique el departamento. Los encargados departamentales gestionan solo los responsables de su departamento.');
  const rolField=encDepto
    ?('<input type="hidden" id="usu-fs-rol" value="responsables">'+
      '<div class="fld"><label>Rol</label><div style="padding:6px 8px;font-size:12px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r)">Responsables</div></div>'+
      '<div class="fld"><label>Departamento</label><div style="padding:6px 8px;font-size:12px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);font-weight:600">'+escAttr(labelDepartamento(deptoEnc))+'</div><input type="hidden" id="usu-fs-depto" value="'+escAttr(deptoEnc)+'"></div>')
    :('<div class="fld"><label>Rol</label><select id="usu-fs-rol" onchange="SST.toggleUsuarioDeptoResponsableField()">'+rolesFirestoreOpts('')+'</select></div>'+
      '<div class="fld" id="usu-fs-depto-wrap" style="display:none"><label>Departamento (rol Responsables)</label><select id="usu-fs-depto">'+deptoResponsableOptsHtml('')+'</select></div>');
  return '<div class="card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
    '<div><div style="font-size:14px;font-weight:600">'+tituloTab+' <span class="nbdg" id="usuarios-fs-count">0</span></div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+ayuda+'</div></div>'+
    '<button type="button" class="btn bsm bp" onclick="SST.mostrarFormUsuarioFirestore()">➕ Agregar usuario</button>'+
    '<button type="button" class="btn bsm" onclick="SST.sincronizarUsuariosAutorizados()" title="Recargar lista desde Firestore">↻ Actualizar lista</button></div>'+
    '<div id="usuario-form-wrap" style="display:none;margin-bottom:12px;padding:12px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px" id="usuario-form-tit">Nuevo usuario</div>'+
    '<div class="fg">'+
    '<div class="fld"><label>Nombre completo</label><input type="text" id="usu-fs-nombre"></div>'+
    '<div class="fld"><label>Correo Gmail (ID del documento)</label><input type="email" id="usu-fs-email" placeholder="usuario@gmail.com"></div>'+
    rolField+
    '<div class="fld"><label>Código de aprobación</label><input type="text" id="usu-fs-codigo" placeholder="NCA-CPG"></div>'+
    '<div class="fld" id="usu-fs-cargo-wrap" style="display:none"><label>Cargo especial</label><select id="usu-fs-cargo"><option value="">— Ninguno —</option><option value="vital">VITAL (apoyo administrativo firma)</option></select></div>'+
    '<div class="fld"><label style="display:flex;align-items:center;gap:6px;margin-top:22px"><input type="checkbox" id="usu-fs-activo" checked style="width:16px;height:16px"> Activo</label></div>'+
    '</div>'+
    '<div class="fx" style="gap:8px;margin-top:8px"><button type="button" class="btn bsm bp" onclick="SST.guardarUsuarioFirestore()">Guardar</button><button type="button" class="btn bsm" onclick="SST.ocultarFormUsuarioFirestore()">Cancelar</button></div>'+
    '</div>'+
    '<div style="overflow:auto"><table class="tbl" style="width:100%"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Departamento</th><th>Código</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="usuarios-fs-tbody"></tbody></table></div></div>';
}
async function loadUsuariosFirestore(){
  const db=window._db;
  if(!db)return _usuariosCache;
  let loaded=false;
  if(window._fsGetDocs&&window._fsCollection){
    try{
      const snap=await window._fsGetDocs(window._fsCollection(db,'usuarios'));
      if(!snap.empty){
        _usuariosCache=[];
        snap.forEach(d=>{_usuariosCache.push({email:d.id,...(d.data()||{})});});
        sortUsuariosCache();
        _usuariosCacheLoaded=true;
        loaded=true;
      }
    }catch(err){
      console.warn('No se pudo listar la colección usuarios:',err);
    }
  }
  if(!loaded&&window._fsGetDoc&&window._fsDoc){
    try{
      const gSnap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
      if(gSnap.exists()){
        const idx=gSnap.data().usuariosIndex;
        if(aplicarUsuariosIndex(idx))loaded=true;
      }
    }catch(err){
      console.warn('No se pudo leer usuariosIndex en sistema/global:',err);
    }
  }
  if(!loaded){
    try{
      const local=localStorage.getItem('sst_usuarios_index');
      if(local)aplicarUsuariosIndex(JSON.parse(local));
    }catch(e){}
  }
  try{localStorage.setItem('sst_usuarios_index',JSON.stringify(_usuariosCache));}catch(e){}
  if(loaded)await persistUsuariosIndexGlobal().catch(()=>{});
  if(_usuariosCacheLoaded){
    syncEncargadosDesdeUsuariosAutorizados();
    syncResponsablesDesdeUsuariosAutorizados();
  }
  return _usuariosCache;
}
async function ensureUsuariosFirestoreCache(force){
  if(!force&&_usuariosCacheLoaded)return _usuariosCache;
  return loadUsuariosFirestore();
}
function invalidateUsuariosCache(){_usuariosCacheLoaded=false;}
function getDeptoResponsablesSelect(){
  if(esAdministrador()||esAdminModoGlobal()){
    const sd=document.getElementById('cfi-instructores-depto');
    if(sd&&sd.value)return sd.value;
    return 'guaviare';
  }
  const r=getRolEfectivo();
  if(DEPTOS.some(d=>d.id===r))return r;
  return deptoCfg||getDeptoOperativo();
}
function usuarioEsResponsableDepto(u,deptoId){
  if(!u||u.activo===false)return false;
  const rol=String(u.rol||'').trim();
  if(rol!=='responsables'&&rol!=='contratista')return false;
  const d=String(u.deptoResponsable||'').trim();
  if(rol==='contratista'&&!d)return deptoId==='guaviare';
  if(!d)return false;
  return d===deptoId;
}
function usuariosAutorizadosSelectOptions(selectedEmail,emptyLabel,deptoId){
  deptoId=deptoId!=null?deptoId:getDeptoResponsablesSelect();
  const cur=String(selectedEmail||'').trim().toLowerCase();
  const miEmail=String(window._usuarioActual&&window._usuarioActual.email||'').trim().toLowerCase();
  let h='<option value="">'+escAttr(emptyLabel||'— Seleccione responsable autorizado —')+'</option>';
  _usuariosCache.filter(u=>{
    if(!usuarioEsResponsableDepto(u,deptoId))return false;
    const em=String(u.email||'').trim().toLowerCase();
    if(miEmail&&em===miEmail&&em!==cur)return false;
    return true;
  }).forEach(u=>{
    const em=String(u.email||'').trim().toLowerCase();
    h+='<option value="'+escAttr(em)+'"'+(cur===em?' selected':'')+'>'+escAttr((u.nombre||em)+' · '+em)+'</option>';
  });
  return h;
}
function refreshInstructoresEmailSelect(){
  const sel=document.getElementById('cfi-instructores-email');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=usuariosAutorizadosSelectOptions(cur,'',getDeptoResponsablesSelect());
  if(cur&&!Array.from(sel.options).some(o=>o.value===cur))sel.value='';
}
function deptoResponsableOptsHtml(selected){
  return DEPTOS.map(d=>'<option value="'+d.id+'"'+(selected===d.id?' selected':'')+'>'+escAttr(labelDepartamento(d.id))+'</option>').join('');
}
function toggleUsuarioDeptoResponsableField(){
  const rolEl=document.getElementById('usu-fs-rol');
  const rol=rolEl?(rolEl.tagName==='SELECT'?rolEl.value:rolEl.value):'';
  const wrap=document.getElementById('usu-fs-depto-wrap');
  const depto=document.getElementById('usu-fs-depto');
  if(wrap)wrap.style.display=(rol==='responsables')?'':'none';
  if(rol==='responsables'&&depto&&depto.tagName==='SELECT'&&!depto.value){
    depto.innerHTML=deptoResponsableOptsHtml(getDeptoGestionUsuariosAutorizados()||'guaviare');
  }
  // Show cargo field only for responsables (VITAL is a cargo on responsable)
  const cargoWrap=document.getElementById('usu-fs-cargo-wrap');
  if(cargoWrap)cargoWrap.style.display=(rol==='responsables')?'':'none';
}
function labelDeptoResponsableUsuario(u){
  if(!u||u.rol!=='responsables')return '—';
  const d=String(u.deptoResponsable||'').trim();
  return d?labelDepartamento(d):'— sin departamento —';
}
function getUsuarioAutorizadoByEmail(email){
  const em=String(email||'').trim().toLowerCase();
  if(!em)return null;
  return _usuariosCache.find(u=>String(u.email||'').trim().toLowerCase()===em)||null;
}
function instructorUsuarioAlertHtml(email,deptoId){
  const u=getUsuarioAutorizadoByEmail(email);
  if(email&&!u)return '<span style="font-size:11px;color:var(--or);font-weight:600">Solicite al administrador registrar este responsable en Usuarios autorizados</span>';
  if(u&&u.activo===false)return '<span style="font-size:11px;color:var(--rd);font-weight:600">⚠️ Usuario desactivado — sin acceso al sistema</span>';
  if(u&&deptoId&&u.rol==='responsables'&&!usuarioEsResponsableDepto(u,deptoId))return '<span style="font-size:11px;color:var(--or);font-weight:600">Asignado a '+escAttr(labelDepartamento(u.deptoResponsable)||'otro departamento')+' — no corresponde a este departamento</span>';
  return '';
}
function abrirPanelUsuariosAutorizados(){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso para gestionar usuarios autorizados','err');return;}
  prepararVistaAdminUsuariosAutorizados();
  showTab('cfg');
  showCfgTab('usuarios');
  setTimeout(()=>mostrarFormUsuarioFirestore(),120);
}
function onInstructorUsuarioEmailSelect(deptoId,i,email){
  withCfgDepto(deptoId,()=>editInstructor(i,'email',email));
}
function mostrarFormUsuarioFirestore(){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');return;}
  const w=document.getElementById('usuario-form-wrap');
  if(!w){
    renderUsuariosCfg();
    setTimeout(()=>mostrarFormUsuarioFirestore(),80);
    return;
  }
  w.style.display='block';
  _usuariosEditEmail='';
  ['usu-fs-nombre','usu-fs-email','usu-fs-codigo'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';el.readOnly=false;}});
  const deptoEnc=getDeptoGestionUsuariosAutorizados();
  const rol=document.getElementById('usu-fs-rol');
  if(rol&&rol.tagName==='SELECT')rol.innerHTML=rolesFirestoreOpts('');
  else if(rol&&rol.tagName==='INPUT')rol.value='responsables';
  const depto=document.getElementById('usu-fs-depto');
  if(depto&&depto.tagName==='SELECT')depto.innerHTML=deptoResponsableOptsHtml(deptoEnc||'guaviare');
  else if(depto&&depto.tagName==='INPUT')depto.value=deptoEnc||'';
  toggleUsuarioDeptoResponsableField();
  const act=document.getElementById('usu-fs-activo');if(act)act.checked=true;
  const tit=document.getElementById('usuario-form-tit');if(tit)tit.textContent=esEncargadoDepartamentalUsuarios()?'Nuevo responsable autorizado':'Nuevo usuario';
  w.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function editarUsuarioFirestore(email){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');return;}
  const u=getUsuarioAutorizadoByEmail(email);
  if(!u){notif('Usuario no encontrado','err');return;}
  if(!usuarioEditablePorEncargado(u)){notif('No puede editar este usuario','err');return;}
  const w=document.getElementById('usuario-form-wrap');
  if(!w){renderUsuariosCfg();setTimeout(()=>editarUsuarioFirestore(email),80);return;}
  w.style.display='block';
  _usuariosEditEmail=String(email||'').trim().toLowerCase();
  const nom=document.getElementById('usu-fs-nombre');if(nom)nom.value=u.nombre||'';
  const em=document.getElementById('usu-fs-email');if(em){em.value=u.email||'';em.readOnly=true;}
  const rol=document.getElementById('usu-fs-rol');
  if(rol&&rol.tagName==='SELECT')rol.innerHTML=rolesFirestoreOpts(u.rol||'');
  else if(rol&&rol.tagName==='INPUT')rol.value='responsables';
  const depto=document.getElementById('usu-fs-depto');
  const deptoVal=u.deptoResponsable||getDeptoGestionUsuariosAutorizados()||'';
  if(depto&&depto.tagName==='SELECT')depto.innerHTML=deptoResponsableOptsHtml(deptoVal);
  else if(depto&&depto.tagName==='INPUT')depto.value=deptoVal;
  toggleUsuarioDeptoResponsableField();
  const cod=document.getElementById('usu-fs-codigo');if(cod)cod.value=u.codigo||'';
  const cargo=document.getElementById('usu-fs-cargo');if(cargo)cargo.value=u.cargo||'';
  const act=document.getElementById('usu-fs-activo');if(act)act.checked=u.activo!==false;
  const tit=document.getElementById('usuario-form-tit');if(tit)tit.textContent='Editar usuario';
  w.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function saveDepartamentoCfgFirestore(deptoId){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc||!deptoId)return;
  syncCfgToStore();
  await window._fsSetDoc(window._fsDoc(db,'departamentos',deptoId),{
    cfg:cfgByDepto[deptoId]||{},
    updatedAt:new Date().toISOString()
  },{merge:true});
}
function ubicacionUsuarioAutorizado(u){
  if(!u)return '—';
  const mod=rolEsEncargadoModulo(u.rol);
  if(mod){
    if(mod.type==='secretaria')return 'Secretaría DEGUV';
    if(mod.type==='departamento')return labelDepartamento(mod.id);
    if(mod.type==='oficina')return labelOficina(mod.id);
  }
  if(u.rol==='responsables'){
    const d=String(u.deptoResponsable||'').trim();
    return d?('Responsable · '+labelDepartamento(d)):'Responsable · sin departamento asignado';
  }
  if(u.rol==='admin')return 'Administrador';
  if(u.rol==='jurisdiccional')return 'Jurisdiccional';
  return tituloRolFirestore(u.rol);
}
async function buscarUsuarioAutorizadoPorEmail(email){
  email=String(email||'').trim().toLowerCase();
  if(!email)return null;
  let u=getUsuarioAutorizadoByEmail(email);
  if(u)return u;
  const db=window._db;
  if(db&&window._fsGetDoc&&window._fsDoc){
    try{
      const snap=await window._fsGetDoc(window._fsDoc(db,'usuarios',email));
      if(snap.exists())return{email,...snap.data()};
    }catch(e){}
  }
  return null;
}
function alertarCorreoYaAutorizado(u){
  if(!u)return;
  const act=u.activo===false?' · Estado: Inactivo':' · Estado: Activo';
  confirmPrecaucion({
    title:'Correo ya autorizado',
    message:'El correo '+String(u.email||'')+' ya está registrado en el sistema.',
    detail:'Rol: '+tituloRolFirestore(u.rol)+' · Ubicación: '+ubicacionUsuarioAutorizado(u)+act,
    confirmLabel:'Entendido',
    tone:'warn'
  },()=>{});
}
function mensajeErrorFirestoreUsuario(err){
  const code=err&&err.code;
  if(code==='permission-denied')return 'Permiso denegado en Firestore. Verifique las reglas de seguridad o contacte al administrador.';
  return 'Error al guardar: '+String(err&&err.message||'desconocido');
}
function ocultarFormUsuarioFirestore(){
  const w=document.getElementById('usuario-form-wrap');if(w)w.style.display='none';
  _usuariosEditEmail='';
  const em=document.getElementById('usu-fs-email');if(em)em.readOnly=false;
}
async function guardarUsuarioFirestore(){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');return;}
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc){notif('Firestore no disponible','err');return;}
  const nombre=String(document.getElementById('usu-fs-nombre')?.value||'').trim();
  const email=String(_usuariosEditEmail||document.getElementById('usu-fs-email')?.value||'').trim().toLowerCase();
  let rol=String(document.getElementById('usu-fs-rol')?.value||'').trim();
  let deptoResponsable=String(document.getElementById('usu-fs-depto')?.value||'').trim();
  const codigo=String(document.getElementById('usu-fs-codigo')?.value||'').trim();
  const cargo=String(document.getElementById('usu-fs-cargo')?.value||'').trim().toLowerCase();
  const activo=!!document.getElementById('usu-fs-activo')?.checked;
  if(esEncargadoDepartamentalUsuarios()){
    rol='responsables';
    deptoResponsable=getDeptoGestionUsuariosAutorizados();
  }
  if(_usuariosEditEmail){
    const prev=getUsuarioAutorizadoByEmail(_usuariosEditEmail);
    if(!usuarioEditablePorEncargado(prev)){notif('No puede editar este usuario','err');return;}
  }else{
    const dup=await buscarUsuarioAutorizadoPorEmail(email);
    if(dup){alertarCorreoYaAutorizado(dup);return;}
  }
  if(!esVistaUsuariosAdminCompleta()&&rol!=='responsables'){notif('Solo puede registrar usuarios con rol Responsables','err');return;}
  if(!nombre||!email||!rol){notif('Complete nombre, correo y rol','err');return;}
  if(rol==='responsables'&&!deptoResponsable){notif('Indique el departamento del responsable','err');return;}
  if(rol==='ciudadano'||rol==='contratista'){notif('Use el rol Responsables para contratistas. La consulta ciudadana no requiere cuenta Google.','err');return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notif('Correo inválido','err');return;}
  const payload={nombre,rol,codigo,activo,actualizadoEn:new Date().toISOString()};
  if(rol==='responsables'){payload.deptoResponsable=deptoResponsable;if(cargo)payload.cargo=cargo;else payload.cargo='';}
  else{payload.deptoResponsable='';payload.cargo='';}
  if(!_usuariosEditEmail)payload.creadoEn=new Date().toISOString();
  try{
    await window._fsSetDoc(window._fsDoc(db,'usuarios',email),payload,{merge:true});
  }catch(err){
    console.error(err);
    notif(mensajeErrorFirestoreUsuario(err),'err');
    return;
  }
  logAudit((_usuariosEditEmail?'Actualizó':'Registró')+' usuario autorizado '+email,'configuracion',null,nombre);
  mergeUsuarioEnCache({email,nombre,rol,codigo,cargo:cargo||'',activo,deptoResponsable:rol==='responsables'?deptoResponsable:''});
  paintUsuariosCfgTable();
  let syncParcial=false;
  try{
    if(esVistaUsuariosAdminCompleta()){
      await persistUsuariosIndexGlobal();
      await aplicarSyncUsuariosAutorizados();
    }else{
      syncResponsablesDesdeUsuariosAutorizados();
      syncCfgToStore();
      _saveLSLocal();
      try{await saveDepartamentoCfgFirestore(getDeptoGestionUsuariosAutorizados());}catch(depErr){console.warn(depErr);syncParcial=true;}
    }
  }catch(syncErr){
    console.warn(syncErr);
    syncParcial=true;
  }
  notif('Usuario guardado'+(rol==='responsables'?' · '+labelDepartamento(deptoResponsable):(rolEsEncargadoModulo(rol)?' · encargado de '+tituloRolFirestore(rol):''))+(syncParcial?' (sincronización parcial)':''),'ok');
  ocultarFormUsuarioFirestore();
  invalidateUsuariosCache();
  await refreshUsuariosAutorizadosUi();
  if(document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on'))renderListasCfg();
}
async function toggleUsuarioFirestoreActivo(email,activo){
  if(!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');return;}
  email=String(email||'').trim().toLowerCase();
  const u=getUsuarioAutorizadoByEmail(email);
  if(!usuarioEditablePorEncargado(u)){notif('No puede modificar este usuario','err');return;}
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return;
  try{
    await window._fsSetDoc(window._fsDoc(db,'usuarios',email),{activo:!!activo,actualizadoEn:new Date().toISOString()},{merge:true});
  }catch(err){console.error(err);notif(mensajeErrorFirestoreUsuario(err),'err');return;}
  logAudit((activo?'Activó':'Desactivó')+' usuario '+email,'configuracion',null);
  if(u)mergeUsuarioEnCache({...u,activo:!!activo});
  paintUsuariosCfgTable();
  try{
    if(esVistaUsuariosAdminCompleta()){
      await persistUsuariosIndexGlobal();
      await aplicarSyncUsuariosAutorizados();
    }else{
      syncResponsablesDesdeUsuariosAutorizados();
      syncCfgToStore();
      _saveLSLocal();
    }
  }catch(syncErr){console.warn(syncErr);}
  notif(activo?'Usuario activado':'Usuario desactivado','ok');
  invalidateUsuariosCache();
  await refreshUsuariosAutorizadosUi();
  if(document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on'))renderListasCfg();
}
async function eliminarUsuarioFirestore(email){
  if(!puedeEliminarUsuariosAutorizados()){notif('Solo el administrador puede eliminar usuarios','err');return;}
  email=String(email||'').trim().toLowerCase();
  confirmPrecaucion({title:'Eliminar usuario',message:'¿Eliminar el acceso de '+email+'?',detail:'El documento se borrará de Firestore.',confirmLabel:'Sí, eliminar'},async()=>{
    const db=window._db;
    if(!db||!window._fsDeleteDoc||!window._fsDoc){notif('Firestore no disponible','err');return;}
    try{
      await window._fsDeleteDoc(window._fsDoc(db,'usuarios',email));
      logAudit('Eliminó usuario autorizado '+email,'configuracion',null);
      removeUsuarioDeCache(email);
      await persistUsuariosIndexGlobal();
      await aplicarSyncUsuariosAutorizados();
      notif('Usuario eliminado','ok');
      await refreshUsuariosAutorizadosUi();
      if(document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on'))renderListasCfg();
    }catch(err){console.error(err);notif('Error al eliminar usuario','err');}
  });
}
async function renderUsuariosCfg(forceRebuild){
  const el=document.getElementById('cfg-usuarios-panel');
  if(!el)return;
  if(!puedeGestionarUsuariosAutorizados()){
    stopUsuariosFirestoreListener();
    el.innerHTML='<div class="emp" style="padding:1rem">No tiene permiso para gestionar usuarios autorizados.</div>';
    return;
  }
  const modeKey=esEncargadoDepartamentalUsuarios()?'enc-'+getDeptoGestionUsuariosAutorizados():'adm';
  const tbody=document.getElementById('usuarios-fs-tbody');
  const needsShell=forceRebuild||!tbody||tbody.dataset.mode!==modeKey;
  if(needsShell){
    stopUsuariosFirestoreListener();
    el.innerHTML=buildUsuariosCfgShell();
    const tb=document.getElementById('usuarios-fs-tbody');
    if(tb)tb.dataset.mode=modeKey;
  }
  await refreshUsuariosAutorizadosUi();
  if(!_usuariosFsUnsub&&window._fsOnSnapshot&&window._fsCollection)startUsuariosFirestoreListener();
}
function prepararVistaAdminUsuariosAutorizados(){
  if(!esAdministrador())return;
  const sel=document.getElementById('sel-depto');
  if(sel&&sel.value!=='admin'){
    sel.value='admin';
    deptoActivo='guaviare';
    try{localStorage.setItem('sst_sel_modulo','admin');}catch(e){}
    updateDeptoUI();
  }
}
function getSoporteActivo(t){
  normalizeTask(t);
  const activos=(t.soportes||[]).filter(s=>s.activo);
  if(activos.length)return activos[activos.length-1];
  return(t.soportes||[]).length?(t.soportes||[])[t.soportes.length-1]:null;
}
function soporteTabLabel(s,idx,soportes){
  const isLink=!s.local;
  const n=soportes.slice(0,idx+1).filter(x=>!x.local===isLink).length;
  return(isLink?'Link ':'Documento ')+n;
}
function getSoportesUltimaEntrega(t){
  const s=t.soportes||[];
  if(!s.length)return[];
  const lotes=[...new Set(s.map(x=>x.loteEntrega).filter(Boolean))];
  if(lotes.length){
    const lastLote=lotes[lotes.length-1];
    return s.filter(x=>x.loteEntrega===lastLote);
  }
  const last=s[s.length-1];
  const f=(last.fecha||'').slice(0,10);
  const sameDay=s.filter(x=>(x.fecha||'').slice(0,10)===f);
  return sameDay.length>1?sameDay:[last];
}
function getDefaultSoporteSel(t){
  const ult=getSoportesUltimaEntrega(t);
  return(ult[0]||getSoporteActivo(t)||{}).id||'';
}
function soporteTieneVista(s){
  if(!s)return false;
  const src=s.preview||s.url||'';
  return !!String(src).trim();
}
function soporteEsVideo(s){
  const t=s.tipo||'';
  return(t&&t.startsWith('video/'))||/\.(mp4|webm|mov|avi)$/i.test(s.label||'');
}
function soporteEsWord(s){
  const t=s.tipo||'';
  return/(word|document|msword|wordprocessing)/i.test(t)||/\.(doc|docx)$/i.test(s.label||'');
}
function soporteEsImagen(s){
  const src=s.preview||s.url||'';
  const t=s.tipo||'';
  return (t&&t.startsWith('image/'))||/^data:image\//i.test(src)||/\.(png|jpe?g|gif|webp)$/i.test(s.label||'');
}
function renderSoporteEmbedHtml(sel){
  const src=sel.preview||sel.url;
  if(soporteEsImagen(sel)){
    return '<img id="soporte-iframe" class="soporte-local-img" src="'+escAttr(src)+'" alt="'+escAttr(sel.label||'Adjunto')+'">';
  }
  if(soporteEsVideo(sel)){
    return '<video id="soporte-iframe" class="soporte-local-vid" controls style="width:100%;height:100%;object-fit:contain;background:#000" src="'+escAttr(src)+'"></video>';
  }
  if(soporteEsWord(sel)){
    return '<div style="padding:1.2rem;text-align:center;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">'+
      '<div style="font-size:13px;color:var(--tx2)">Documento Word — descargue para revisar</div>'+
      '<a class="btn bsm bp" href="'+escAttr(sel.url||src)+'" download="'+escAttr(sel.label||'documento')+'">Descargar / abrir</a></div>';
  }
  return '<iframe id="soporte-iframe" sandbox="allow-scripts allow-same-origin allow-popups" src="'+escAttr(src)+'" title="Vista previa documento"></iframe>';
}
function addSoporteArchivoLocal(expId,taskId,archivo){
  if(!archivo||!archivo.data)return false;
  return mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    t.soportes.forEach(s=>{s.activo=false;});
    const version=t.soportes.length+1;
    const isPdf=archivo.tipo==='application/pdf'||/\.pdf$/i.test(archivo.nombre||'');
    const isImg=archivo.tipo&&archivo.tipo.startsWith('image/');
    t.soportes.push({
      id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      url:archivo.data,
      preview:(isPdf||isImg)?archivo.data:'',
      label:archivo.nombre||('Archivo v'+version),
      fecha:new Date().toISOString(),
      autor:taskComentarioAutor(),
      version,activo:true,local:true,tipo:archivo.tipo||''
    });
    t.historial.push({tipo:'soporte',fecha:hoy(),version,url:'[archivo local]',por:taskComentarioAutor(),nota:archivo.nombre||''});
  });
}
function addSoporteTask(expId,taskId,url,label){
  const parsed=parseDrivePreviewUrl(url);
  if(!parsed.valid){notif('Enlace no válido — use un enlace de Google Drive o URL https','err');return false;}
  return mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    t.soportes.forEach(s=>{s.activo=false;});
    const version=t.soportes.length+1;
    t.soportes.push({
      id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      url:parsed.url,preview:parsed.preview,
      label:label||('Versión '+version),
      fecha:new Date().toISOString(),
      autor:taskComentarioAutor(),
      version,activo:true
    });
    t.historial.push({tipo:'soporte',fecha:hoy(),version,url:parsed.url,por:taskComentarioAutor()});
  });
}
function addNotaDoc(expId,taskId,soporteId,ref,texto,extra){
  const txt=String(texto||'').trim();if(!txt)return false;
  const ex=extra||{};
  return mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    let pin=ex.pin;
    if(!pin&&ex.x!=null&&ex.y!=null){
      const prev=(t.notasDoc||[]).filter(n=>n.soporteId===(soporteId||'')&&n.pin);
      pin=prev.length?Math.max(...prev.map(n=>n.pin||0))+1:1;
    }
    t.notasDoc.push({
      id:'nd_'+Date.now(),
      soporteId:soporteId||'',
      ref:String(ref||'').trim(),
      texto:txt,
      autor:taskComentarioAutor(),
      fecha:new Date().toISOString(),
      rol:esModoResponsable()?'ejecutor':'revisor',
      tipo:ex.tipo||(ex.x!=null?'marcador':'texto'),
      x:ex.x!=null?Math.round(ex.x*10)/10:null,
      y:ex.y!=null?Math.round(ex.y*10)/10:null,
      pagina:ex.pagina!=null&&ex.pagina!==''?String(ex.pagina):'',
      pin:pin||null,
      rondaRevision:ex.rondaRevision!=null?ex.rondaRevision:getMarcadoresRonda(t)
    });
  });
}
function getMarcadoresRonda(t){
  const devs=(t.historial||[]).filter(h=>h.tipo==='ajuste_soporte').length;
  return devs+(taskPendienteVerificacion(t)?1:0)||1;
}
function canDeptMarcarEnSoporte(t,selSop){
  if(esModoResponsable()||esJurisdiccional())return false;
  if(!taskPendienteVerificacion(t))return false;
  const sel=selSop||getSoporteActivo(t);
  if(!sel||!sel.id)return false;
  return (t.soportes||[]).some(s=>s.id===sel.id);
}
function addNotaDocRespuesta(expId,taskId,soporteId,texto){
  return addNotaDoc(expId,taskId,soporteId,'',texto,{tipo:'respuesta'});
}
function submitNotaDocRespuesta(expId,taskId,soporteId){
  const txt=(document.getElementById('nota-doc-resp-input')||{}).value;
  if(addNotaDocRespuesta(expId,taskId,soporteId,txt)){
    notif('Respuesta registrada en observaciones del documento','ok');
    openTaskCommentsModal(expId,taskId);
  }
}
function nextPinNumForSoporte(t,soporteId){
  const nums=(t.notasDoc||[]).filter(n=>n.soporteId===(soporteId||'')&&n.pin).map(n=>n.pin);
  return nums.length?Math.max(...nums)+1:1;
}
function notasDocForSoporte(t,soporteId){
  return (t.notasDoc||[]).filter(n=>!soporteId||!n.soporteId||n.soporteId===soporteId);
}
function renderAnnotSidebarHtml(notas,expId,taskId,selId,canAnnot){
  const tit=canAnnot?'Sin observaciones aún. Use «Marcar en documento».':'Observaciones del departamento sobre el documento.';
  if(!notas.length)return '<div style="font-size:11px;color:var(--tx3);padding:4px">'+tit+'</div>';
  const sorted=[...notas].sort((a,b)=>{
    if(a.pin&&b.pin)return a.pin-b.pin;
    return (a.fecha||'').localeCompare(b.fecha||'');
  });
  return sorted.map((n,i)=>{
    const pin=n.pin||(n.x!=null?i+1:'💬');
    const loc=n.x!=null&&n.y!=null?('📍 '+Math.round(n.x)+'%, '+Math.round(n.y)+'%'):'';
    const pag=n.pagina?(' · Pág. '+escAttr(n.pagina)):'';
    const rnd=n.rondaRevision?(' · Ronda '+n.rondaRevision):'';
    const cls='soporte-annot-item'+(n.rol==='revisor'?' revisor':'')+(window._annotSelId===n.id?' on':'');
    const pinLbl=typeof pin==='number'||String(pin).match(/^\d+$/)?pin:'·';
    return '<div class="'+cls+'" data-nota-id="'+escAttr(n.id)+'" onclick="'+(n.x!=null?'selectAnnotPin(\''+escAttr(n.id)+'\')':'')+'">'+
      (n.x!=null?'<span class="pin-n">'+pinLbl+'</span>':'<span class="pin-n" style="background:var(--pu)">💬</span>')+
      '<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+escAttr(n.autor||'')+' · '+fmtF((n.fecha||'').slice(0,10))+(loc?(' · '+loc):'')+pag+rnd+'</div>'+
      escAttr(n.texto||'')+
      (n.ref?'<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+escAttr(n.ref)+'</div>':'')+
    '</div>';
  }).join('');
}
function pushUrlsFromValor(add,tipo,ref,val,extra){
  let s=String(val||'').trim();
  if(!s)return;
  const normDrive=function(u){
    u=String(u||'').trim().replace(/^\/\//,'');
    if(/^(drive|docs)\.google\.com/i.test(u))return 'https://'+u;
    return u;
  };
  s=normDrive(s);
  if(/^https?:\/\//i.test(s))add(tipo,ref,s,extra||{});
  (s.match(/https?:\/\/[^\s"'<>]+/gi)||[]).forEach(u=>add(tipo,ref,u,extra||{}));
  (String(val||'').match(/(?:^|[\s(,;])(drive\.google\.com[^\s"'<>]+|docs\.google\.com[^\s"'<>]+)/gi)||[]).forEach(u=>add(tipo,ref,normDrive(u.trim()),extra||{}));
}
function collectEnlacesExpediente(e){
  const links=[],seen=new Set();
  const add=(tipo,ref,url,extra)=>{
    const u=String(url||'').trim();if(!u||seen.has(u))return;
    seen.add(u);
    links.push({tipo,ref,url:u,...extra||{}});
  };
  (e.tasks||[]).forEach(t=>{
    if(t.eliminada)return;
    normalizeTask(t);
    (t.soportes||[]).forEach(s=>{
      const u=s.url||s.preview||'';
      if(!u)return;
      add('Actividad',t.desc||t.actividad||'Sin título',u,{version:s.version,fecha:s.fecha,activo:s.activo,taskId:t.id,responsable:t.responsable,label:s.label||''});
    });
  });
  const tram=getTram(e._tramite,e);
  const tramLbl={};
  if(tram)(tram.campos||[]).forEach(c=>{tramLbl[c.id]=c.label||c.id;});
  if(tram)(tram.campos||[]).forEach(c=>{
    const v=e['f_'+c.id];
    if(v==null||v==='')return;
    pushUrlsFromValor(add,'Trámite',c.label,v);
  });
  Object.keys(e).forEach(k=>{
    if(!k.startsWith('f_'))return;
    const v=e[k];
    if(v==null||v==='')return;
    pushUrlsFromValor(add,'Trámite',tramLbl[k.slice(2)]||k.slice(2).replace(/_/g,' '),v);
  });
  migrarInfoTecExpediente(e);
  infoTecnicaExpData(e._info_tecnica_items).forEach(it=>{
    const def=getInfoTecDef(it.campoId,e);
    const lbl=def?def.label:it.campoId;
    pushUrlsFromValor(add,'Info. técnica',lbl,it.valor);
  });
  migrarDetalleNotas(e);
  detalleNotasData(e._detalle_notas).forEach((n,i)=>{
    pushUrlsFromValor(add,'Detalle',(n.autor?'Nota · '+n.autor:'Comentario')+' '+(i+1),n.texto,{fecha:n.fecha||''});
  });
  pushUrlsFromValor(add,'PQRSD','Solicitud PQRSD',e._pqrs_solicitud_link,{fecha:e._fecha_solicitud||e._fecha});
  pushUrlsFromValor(add,'PQRSD','Respuesta PQRSD',e._pqrs_respuesta_link,{fecha:e._pqrs_respuesta_fecha});
  (e._pqrs_respuesta_links||[]).forEach((u,i)=>add('PQRSD','Respuesta PQRSD '+(i+1),u,{fecha:e._pqrs_respuesta_fecha}));
  (e._pqrs_respuesta_soportes||[]).forEach((s,i)=>{
    pushUrlsFromValor(add,'PQRSD',s.label||('Respuesta '+(i+1)),s.url||s.preview,{fecha:e._pqrs_respuesta_fecha});
  });
  actosAdminData(e._actos_admin).forEach((a,i)=>{
    ['documento','link','url','enlace','drive'].forEach(k=>{if(a[k])pushUrlsFromValor(add,'Acto administrativo',(a.tipo||'Acto')+' · '+(a.numero||('#'+(i+1))),a[k]);});
  });
  const skipUnderscore=new Set(['_tasks','_fechas_estado','_info_tecnica_items','_detalle_notas','_actos_admin','_conceptos_seg','_facturas_extra','_expedientes_asociados','_pqrs_historial','_pqrs_workflow','_gmail_email_data','_pqrs_gmail_attachments','_pqrs_respuesta_links','_pqrs_respuesta_soportes','_pqrs_drive_folder_link','_pqrs_drive_folder_id','_pqrs_drive_solicitud_folder_id','_pqrs_drive_respuesta_folder_id','_pqrs_drive_path_label']);
  Object.keys(e).forEach(k=>{
    if(!k.startsWith('_')||skipUnderscore.has(k))return;
    if(k.endsWith('_link')||k.includes('link')||k.includes('url')||k.includes('documento')){
      pushUrlsFromValor(add,'Expediente',k.replace(/^_+/,'').replace(/_/g,' '),e[k]);
      return;
    }
    const s=String(e[k]||'');
    if(!s||s.length>2000)return;
    pushUrlsFromValor(add,'Expediente',k.replace(/^_+/,'').replace(/_/g,' '),s);
  });
  Object.keys(e).forEach(k=>{
    if(k.startsWith('_'))return;
    pushUrlsFromValor(add,'Expediente',k,e[k]);
  });
  return links;
}
function collectDocsComparables(e,taskId,tDirect){
  const docs=[],seen=new Set();
  const add=(d)=>{
    const k=String(d.id||'').trim();
    const u=String(d.url||d.preview||'').trim().toLowerCase();
    if(!k||seen.has(k)||(u&&seen.has('u:'+u)))return;
    seen.add(k);
    if(u)seen.add('u:'+u);
    docs.push(d);
  };
  const pushUrl=(id,origen,label,url,fecha,metaExtra)=>{
    const u=String(url||'').trim();if(!u)return;
    const p=parseDrivePreviewUrl(u);
    add({
      id,origen,label,soporteId:null,
      titulo:label,
      meta:[metaExtra,fecha?fmtF(String(fecha).slice(0,10)):''].filter(Boolean).join(' · '),
      preview:p.preview||p.url||u,url:u,local:false,mime:'',fecha:fecha||'',
      sortKey:(fecha||'0000')+'_'+id
    });
  };
  const t=tDirect||(e&&taskId?getTaskFromExp(e,taskId):null);
  if(e){
    if(esPqrsSecretaria(e)&&e._pqrs_solicitud_link)pushUrl('pqrs_sol','PQRSD','Solicitud PQRSD',e._pqrs_solicitud_link,e._fecha_solicitud||e._fecha);
    if(esPqrsSecretaria(e)&&e._pqrs_respuesta_link)pushUrl('pqrs_resp','PQRSD','Respuesta PQRSD',e._pqrs_respuesta_link,e._pqrs_respuesta_fecha);
    (e._pqrs_respuesta_links||[]).forEach((u,i)=>pushUrl('pqrs_rl_'+i,'PQRSD','Respuesta PQRSD '+(i+1),u,e._pqrs_respuesta_fecha));
    collectEnlacesExpediente(e).forEach((l,i)=>{
      if(l.tipo==='Actividad'&&l.taskId===taskId)return;
      const lbl=(l.tipo||'Documento')+': '+(l.ref||'Enlace')+(l.version?' v'+l.version:'');
      const extra=[l.taskId===taskId?'esta actividad':(l.responsable||''),l.activo?'activa':''].filter(Boolean).join(' · ');
      pushUrl('lnk_'+i,l.tipo||'Expediente',lbl,l.url,l.fecha,extra);
    });
  }
  if(t){
    [...(t.soportes||[])].sort((a,b)=>(a.version||0)-(b.version||0)).forEach(s=>{
      const url=s.url||s.preview||'';
      if(!url&&!s.local)return;
      add({
        id:'sop_'+s.id,origen:'Entrega',soporteId:s.id,
        label:'Entrega v'+(s.version||'?')+(s.activo?' · activa':''),
        titulo:'Entrega v'+(s.version||'?'),
        meta:[s.label,fmtF((s.fecha||'').slice(0,10))].filter(Boolean).join(' · '),
        preview:s.preview||url,url,local:!!s.local,mime:s.mime||'',fecha:s.fecha||'',
        sortKey:(s.fecha||'0000')+'_sop_'+String(s.version||0).padStart(5,'0')
      });
    });
  }
  return docs.sort((a,b)=>String(a.sortKey).localeCompare(String(b.sortKey)));
}
function uiEditorContenedorLbl(){return document.documentElement.classList.contains('ui-editor-modal-mode')?'ventana':'panel lateral';}
function portalZIndexFlotante(){
  const taskModal=document.getElementById('task-modal-overlay');
  if(taskModal&&taskModal.classList.contains('on'))return 21000;
  if(document.documentElement.classList.contains('ui-editor-modal-mode'))return 20050;
  const panel=document.getElementById('con-side-panel');
  const pqrs=document.getElementById('pqrs-side-panel');
  const act=document.getElementById('act-agenda-panel');
  if((panel&&panel.classList.contains('on'))||(pqrs&&pqrs.classList.contains('on'))||(act&&act.classList.contains('on')))return 20050;
  return 10000;
}
function renderExpEnlacesPanel(e,taskIdAct){
  const links=collectEnlacesExpediente(e);
  if(!links.length)return '<div style="font-size:12px;color:var(--tx3);padding:6px">Sin enlaces registrados en el expediente ni en actividades.</div>';
  return '<div class="exp-enlaces-list">'+links.map(l=>{
    const parsed=parseDrivePreviewUrl(l.url);
    const act=l.taskId===taskIdAct?' · <strong>esta actividad</strong>':'';
    return '<div class="exp-enlace-item">'+
      '<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+escAttr(l.tipo)+' · '+escAttr(l.ref||'')+(l.version?' · v'+l.version:'')+(l.activo?' · activa':'')+act+'</div>'+
      '<a href="'+escAttr(l.url)+'" target="_blank" rel="noopener" style="word-break:break-all">'+escAttr(l.url)+'</a>'+
      (parsed.preview?' <button type="button" class="btn bsm" onclick="previewEnlaceExp(\''+escAttr(parsed.preview)+'\')">Vista previa</button>':'')+
    '</div>';
  }).join('')+'</div>';
}
function previewEnlaceExp(previewUrl){
  window._previewEnlaceUrl=previewUrl;
  setTaskViewTab('doc');
  const iframe=document.getElementById('soporte-iframe');
  if(iframe)iframe.src=previewUrl;
}
function renderTaskExpConsultaEmbed(e){
  if(!e)return'';
  const tram=getTram(e._tramite,e);
  let h='<div class="exp-consulta-embed">';
  h+='<div style="margin-bottom:.5rem"><span class="bdg">'+escAttr(e._exp)+'</span> '+badgeEst(e._estado)+' '+badgeTram(e._tramite,e)+'</div>';
  h+='<div style="font-weight:600;margin-bottom:4px">'+escAttr(getNom(e))+'</div>';
  h+=renderInteresadoView(e);
  h+=renderDetalleConsultaView(e);
  h+=renderInfoTecConsultaView(e);
  h+=renderContableView(e);
  if(tram){
    const campos=tram.campos.filter(c=>{const v=e['f_'+c.id];return v!=null&&v!==''&&v!==false;}).slice(0,8);
    if(campos.length){
      h+='<details class="con-fold"><summary>Datos del trámite</summary><div class="item-fold-body"><div class="ig">';
      campos.forEach(c=>{h+='<div class="ic"><div class="k">'+c.label+'</div><div class="v">'+escAttr(fmtCampoVal(e['f_'+c.id],c))+'</div></div>';});
      h+='</div></div></details>';
    }
  }
  h+='</div>';
  return h;
}
function setTaskViewTab(tab){
  document.querySelectorAll('.task-view-tab').forEach(b=>{
    b.classList.toggle('on',b.dataset.tab===tab);
  });
  document.querySelectorAll('.task-view-panel').forEach(p=>{
    p.classList.toggle('on',p.id==='task-view-'+tab);
  });
}
function verConDesdeTaskModal(expId){
  closeTaskModal();
  verCon(expId);
}
function confirmPrecaucion(opts,onOk){
  const ov=document.getElementById('confirm-prec-overlay');
  const tit=document.getElementById('confirm-prec-title');
  const msg=document.getElementById('confirm-prec-msg');
  const det=document.getElementById('confirm-prec-detail');
  const btn=document.getElementById('confirm-prec-ok');
  const inp=document.getElementById('confirm-prec-input');
  const cancel=document.getElementById('confirm-prec-cancel');
  const ico=document.getElementById('confirm-prec-icon-emoji');
  const box=ov?ov.querySelector('.confirm-prec-box'):null;
  if(!ov||!msg)return;
  window._confirmExitoMode=false;
  opts=opts||{};
  if(box){
    box.className='confirm-prec-box'+(opts.tone?' tone-'+opts.tone:'');
  }
  if(ico)ico.textContent='⚠️';
  if(cancel)cancel.style.display=opts.hideCancel?'none':'';
  if(tit)tit.textContent=opts.title||'Precaución — acción irreversible';
  msg.textContent=opts.message||'¿Está seguro de continuar? Esta acción no se puede deshacer fácilmente.';
  if(det){
    if(opts.detail){det.textContent=opts.detail;det.style.display='';}
    else det.style.display='none';
  }
  if(inp){
    if(opts.prompt){
      inp.style.display='';
      inp.placeholder=opts.promptPlaceholder||opts.prompt;
      inp.value=opts.promptValue||'';
    }else{
      inp.style.display='none';
      inp.value='';
    }
  }
  if(btn)btn.textContent=opts.confirmLabel||'Sí, confirmar';
  window._confirmPrecOk=typeof onOk==='function'?onOk:null;
  window._confirmPrecHasPrompt=!!opts.prompt;
  if(btn){
    btn.onclick=function(){closeConfirmPrecaucion(true);};
  }
  ov.classList.add('on');
}
function confirmEliminar(opts,fn){
  confirmPrecaucion({
    title:(opts&&opts.title)||'Confirmar eliminación',
    message:(opts&&opts.message)||'¿Está seguro de eliminar este elemento? Esta acción no se puede deshacer.',
    detail:(opts&&opts.detail)||'',
    confirmLabel:(opts&&opts.confirmLabel)||'Sí, eliminar',
    tone:(opts&&opts.tone)||'delete'
  },fn);
}
function closeConfirmPrecaucion(ok){
  const ov=document.getElementById('confirm-prec-overlay');
  const inp=document.getElementById('confirm-prec-input');
  const hadPrompt=!!window._confirmPrecHasPrompt;
  const promptVal=inp&&hadPrompt?inp.value:'';
  if(ov)ov.classList.remove('on');
  if(inp){inp.style.display='none';inp.value='';}
  window._confirmPrecHasPrompt=false;
  if(ok&&window._confirmPrecOk){
    const fn=window._confirmPrecOk;
    window._confirmPrecOk=null;
    if(hadPrompt)fn(promptVal);
    else fn();
  }else window._confirmPrecOk=null;
}
function releaseAnnotMarkingMode(){
  window._annotMarking=false;
  const ov=document.getElementById('soporte-annot-overlay');
  const wrap=document.getElementById('soporte-annot-wrap');
  if(ov)ov.classList.remove('marking');
  if(wrap)wrap.classList.add('annot-navigable');
  const btn=document.getElementById('btn-modo-marcar');
  if(btn){btn.classList.remove('on');btn.textContent='📍 Marcar en documento';}
}
function renderAnnotSidebarFooter(expId,taskId,canAnnot){
  if(!canAnnot)return'';
  return '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--bd)">'+
    '<button type="button" class="btn bsm bd2" style="width:100%" onclick="devolverDocumentoConObservaciones(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">↩ Devolver documento (tras marcar)</button>'+
    '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Guarde todos los marcadores y luego devuelva una sola vez.</div></div>';
}
function refreshAnnotAfterPinSave(expId,taskId,soporteId){
  cancelPendingAnnotPin();
  releaseAnnotMarkingMode();
  window._pendingAnnot=null;
  window._annotSelId=null;
  const t=getTaskAny(expId,taskId);
  if(!t)return;
  const notas=notasDocForSoporte(t,soporteId);
  populateSoportePaginaFilter(notas);
  renderAnnotPinsOnOverlay(notas,null);
  const side=document.getElementById('soporte-annot-sidebar');
  const selSop=(t.soportes||[]).find(s=>s.id===soporteId)||getSoporteActivo(t);
  const canAnnot=canDeptMarcarEnSoporte(t,selSop);
  if(side){
    side.innerHTML=renderAnnotSidebarHtml(notas,expId,taskId,soporteId,canAnnot)+renderAnnotSidebarFooter(expId,taskId,canAnnot);
  }
  hidePinSidebarForm();
}
function renderAnnotPinFormHtml(){
  return '<div id="soporte-pin-form-sidebar" class="soporte-pin-form" style="display:none">'+
    '<div style="font-size:11px;font-weight:600;color:var(--or);margin-bottom:4px">Nueva observación en el documento</div>'+
    '<div style="font-size:10px;color:var(--tx3);margin-bottom:6px" id="soporte-pin-loc-hint">Marque un punto en el documento y complete aquí.</div>'+
    '<div style="display:flex;gap:6px;margin-bottom:4px">'+
      '<input type="text" id="nota-doc-pagina" placeholder="Página" style="width:70px;padding:5px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px" value="1">'+
      '<input type="text" id="nota-doc-ref-pin" placeholder="Referencia (opcional)" style="flex:1;padding:5px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px">'+
    '</div>'+
    '<textarea id="nota-doc-txt-pin" placeholder="Describa la corrección necesaria…"></textarea>'+
    '<div class="fx" style="gap:6px;margin-top:6px">'+
      '<button type="button" class="btn bsm bp" onclick="submitNotaDocPin()">Guardar observación</button>'+
      '<button type="button" class="btn bsm" onclick="cancelPendingAnnotPin()">Cancelar</button>'+
    '</div></div>';
}
function hidePinSidebarForm(){
  const form=document.getElementById('soporte-pin-form-sidebar');
  if(form)form.style.display='none';
}
function showPinSidebarForm(coords){
  const form=document.getElementById('soporte-pin-form-sidebar');
  if(!form)return;
  form.style.display='block';
  const hint=document.getElementById('soporte-pin-loc-hint');
  if(hint&&coords)hint.textContent='📍 Marcador en '+Math.round(coords.x)+'%, '+Math.round(coords.y)+'% — complete la observación:';
  const pgPin=document.getElementById('nota-doc-pagina');
  if(pgPin)pgPin.value=String(getSoportePaginaActual());
  const ta=document.getElementById('nota-doc-txt-pin');
  if(ta){ta.value='';setTimeout(()=>ta.focus(),40);}
  form.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function getSoportePaginaFiltro(){return window._soportePaginaFiltro||'all';}
function setSoportePaginaFiltro(v){
  window._soportePaginaFiltro=v||'all';
  const wrap=document.getElementById('soporte-annot-wrap');
  if(wrap){
    const t=getTaskAny(wrap.dataset.exp,wrap.dataset.task);
    if(t)renderAnnotPinsOnOverlay(notasDocForSoporte(t,wrap.dataset.sop),window._annotSelId);
  }
}
function pinVisibleEnFiltro(n){
  const f=getSoportePaginaFiltro();
  if(f==='all')return true;
  const pg=String(n.pagina||'').trim();
  if(!pg)return f==='1';
  return pg===String(f);
}
function getSoportePaginaActual(){return Math.max(1,parseInt(window._soportePaginaActual,10)||1);}
function setSoportePagina(p){
  window._soportePaginaActual=Math.max(1,parseInt(p,10)||1);
  const pgPin=document.getElementById('nota-doc-pagina');
  if(pgPin)pgPin.value=window._soportePaginaActual;
}
function populateSoportePaginaFilter(notas){
  const sel=document.getElementById('soporte-pagina-filter');
  if(!sel)return;
  const pages=new Set();
  notas.forEach(n=>{if(n.pagina)pages.add(String(n.pagina));else pages.add('1');});
  const sorted=[...pages].sort((a,b)=>(parseInt(a,10)||0)-(parseInt(b,10)||0));
  const cur=getSoportePaginaFiltro();
  sel.innerHTML='<option value="all">Todas las páginas (vista)</option>'+
    sorted.map(p=>'<option value="'+escAttr(p)+'">Solo página '+escAttr(p)+'</option>').join('');
  if(cur==='all'||sorted.includes(cur))sel.value=cur;else sel.value='all';
}
function renderAnnotPinsOnOverlay(notas,selId){
  const ov=document.getElementById('soporte-annot-overlay');
  if(!ov)return;
  ov.querySelectorAll('.soporte-pin').forEach(p=>p.remove());
  notas.filter(n=>n.x!=null&&n.y!=null).forEach((n,i)=>{
    const visible=pinVisibleEnFiltro(n);
    const pin=document.createElement('button');
    pin.type='button';
    pin.className='soporte-pin'+(n.rol==='revisor'?' revisor':'')+(window._annotSelId===n.id?' on':'')+(visible?'':' dim');
    pin.style.left=n.x+'%';
    pin.style.top=n.y+'%';
    const lbl=n.pagina?(String(n.pin||i+1)+'·p'+n.pagina):String(n.pin||(i+1));
    pin.textContent=lbl.length>6?String(n.pin||(i+1)):lbl;
    pin.title=(n.pagina?'Pág. '+n.pagina+' · ':'')+(n.texto||'').slice(0,80);
    if(visible)pin.onclick=function(ev){ev.stopPropagation();selectAnnotPin(n.id);};
    ov.appendChild(pin);
  });
  if(window._pendingAnnot){
    let prev=ov.querySelector('.soporte-pin-preview');
    if(!prev){prev=document.createElement('div');prev.className='soporte-pin-preview';ov.appendChild(prev);}
    prev.style.left=window._pendingAnnot.x+'%';
    prev.style.top=window._pendingAnnot.y+'%';
  }else{
    const prev=ov.querySelector('.soporte-pin-preview');if(prev)prev.remove();
  }
}
function initSoporteAnnotViewer(expId,taskId,soporteId,canAnnot){
  const t=getTaskAny(expId,taskId);
  if(!t)return;
  const notas=notasDocForSoporte(t,soporteId);
  populateSoportePaginaFilter(notas);
  renderAnnotPinsOnOverlay(notas,window._annotSelId);
  const side=document.getElementById('soporte-annot-sidebar');
  if(side){
    let html=renderAnnotSidebarHtml(notas,expId,taskId,soporteId,!!canAnnot)+renderAnnotSidebarFooter(expId,taskId,!!canAnnot);
    const canReply=esModoResponsable()&&t.responsable===responsableActivo&&notas.some(n=>n.rol==='revisor');
    if(canReply){
      html+='<div class="task-cmt-form" style="margin-top:8px;border-top:1px dashed var(--bd);padding-top:8px">'+
        '<div style="font-size:11px;font-weight:600;margin-bottom:4px">Responder sobre el documento</div>'+
        '<textarea id="nota-doc-resp-input" placeholder="Respuesta al departamento sobre las observaciones…"></textarea>'+
        '<button type="button" class="btn bsm bp" onclick="submitNotaDocRespuesta(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',\''+escAttr(soporteId)+'\')">Enviar respuesta</button></div>';
    }
    side.innerHTML=html;
  }
  const ov=document.getElementById('soporte-annot-overlay');
  if(ov&&!ov._bound){
    ov._bound=true;
    ov.addEventListener('click',onAnnotOverlayClick);
  }
  const wrap=document.getElementById('soporte-annot-wrap');
  if(wrap)wrap.classList.add('annot-navigable');
  hidePinSidebarForm();
  releaseAnnotMarkingMode();
}
function toggleModoMarcarAnnot(){
  window._annotMarking=!window._annotMarking;
  const ov=document.getElementById('soporte-annot-overlay');
  const wrap=document.getElementById('soporte-annot-wrap');
  const btn=document.getElementById('btn-modo-marcar');
  if(wrap){
    if(window._annotMarking)wrap.classList.remove('annot-navigable');
    else wrap.classList.add('annot-navigable');
  }
  if(ov)ov.classList.toggle('marking',!!window._annotMarking);
  if(btn){
    btn.classList.toggle('on',!!window._annotMarking);
    btn.textContent=window._annotMarking?'📍 Clic en documento… (cancelar)':'📍 Marcar en documento';
  }
  if(!window._annotMarking)cancelPendingAnnotPin();
}
function onAnnotOverlayClick(ev){
  if(ev.target.classList.contains('soporte-pin'))return;
  if(!window._annotMarking)return;
  const wrap=document.getElementById('soporte-annot-wrap');
  if(!wrap)return;
  const rect=wrap.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  window._pendingAnnot={
    x:Math.max(0,Math.min(100,(ev.clientX-rect.left)/rect.width*100)),
    y:Math.max(0,Math.min(100,(ev.clientY-rect.top)/rect.height*100))
  };
  const t=getTaskAny(wrap.dataset.exp,wrap.dataset.task);
  renderAnnotPinsOnOverlay(notasDocForSoporte(t,wrap.dataset.sop),window._annotSelId);
  showPinSidebarForm(window._pendingAnnot);
}
function cancelPendingAnnotPin(){
  window._pendingAnnot=null;
  hidePinSidebarForm();
  const ov=document.getElementById('soporte-annot-overlay');
  if(ov){const prev=ov.querySelector('.soporte-pin-preview');if(prev)prev.remove();}
}
function selectAnnotPin(notaId){
  window._annotSelId=notaId;
  const wrap=document.getElementById('soporte-annot-wrap');
  if(!wrap)return;
  const t=getTaskAny(wrap.dataset.exp,wrap.dataset.task);
  const notas=notasDocForSoporte(t,wrap.dataset.sop);
  const n=notas.find(x=>x.id===notaId);
  if(n&&n.pagina)setSoportePaginaFiltro(String(n.pagina));
  renderAnnotPinsOnOverlay(notas,notaId);
  document.querySelectorAll('.soporte-annot-item').forEach(el=>{
    el.classList.toggle('on',el.dataset.notaId===notaId);
  });
  const item=document.querySelector('.soporte-annot-item[data-nota-id="'+notaId+'"]');
  if(item)item.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function submitNotaDocPin(){
  const wrap=document.getElementById('soporte-annot-wrap');
  if(!wrap||!window._pendingAnnot)return;
  const expId=wrap.dataset.exp,taskId=wrap.dataset.task,soporteId=wrap.dataset.sop;
  const pagina=(document.getElementById('nota-doc-pagina')||{}).value||getSoportePaginaActual();
  const ref=(document.getElementById('nota-doc-ref-pin')||{}).value;
  const txt=(document.getElementById('nota-doc-txt-pin')||{}).value;
  if(!String(txt||'').trim()){notif('Escriba el comentario sobre el documento','err');return;}
  const t=getTaskAny(expId,taskId);
  const pin=nextPinNumForSoporte(t,soporteId);
  if(addNotaDoc(expId,taskId,soporteId,ref,txt,{x:window._pendingAnnot.x,y:window._pendingAnnot.y,pagina:String(pagina),pin,rondaRevision:getMarcadoresRonda(t)})){
    notif('Observación '+pin+' guardada — agregue más marcadores o devuelva el documento cuando termine','ok');
    refreshAnnotAfterPinSave(expId,taskId,soporteId);
  }
}
function devolverDocumentoConObservaciones(expId,taskId){
  const t=getTaskAny(expId,taskId);
  if(!t)return;
  const wrap=document.getElementById('soporte-annot-wrap');
  const sopId=wrap?wrap.dataset.sop:(getSoporteActivo(t)||{}).id;
  const ultDev=(t.historial||[]).filter(h=>h.tipo==='ajuste_soporte').pop();
  const obs=(t.notasDoc||[]).filter(n=>n.rol==='revisor'&&(!sopId||n.soporteId===sopId));
  const nuevas=ultDev?obs.filter(n=>(n.fecha||'')>(ultDev.fecha||'')):obs;
  if(!nuevas.length&&!confirm('No hay observaciones nuevas en el documento activo. ¿Devolver igualmente al responsable?'))return;
  devolverTaskAlResponsable(expId,taskId,'Devuelto con '+(nuevas.length||obs.length)+' observación(es) en documento');
}
function resolveModoEnviar(t,modoHint){
  if(modoHint)return modoHint;
  if(taskRecibidaPorTraslado(t))return 'reporteTrasladado';
  const est=estadoTask(t);
  if(est==='Por corregir')return 'nuevaEntrega';
  if((t.soportes||[]).length&&est!=='Por verificar')return 'nuevaEntrega';
  return 'reporte';
}
function taskRecibidaPorTraslado(t){
  if(!t)return false;
  if(t.reporteTrasladado)return true;
  const resp=agendaNorm(t.responsable||'');
  const traslados=(t.historial||[]).filter(h=>h.tipo==='traslado');
  if(!traslados.length)return false;
  const ult=traslados[traslados.length-1];
  return agendaNorm(ult.a||'')===resp;
}
function esNuevaEntregaTask(t,modoHint){
  if(modoHint==='nuevaEntrega')return true;
  if(modoHint==='reporte'||modoHint==='finalizarEncargado'||modoHint==='reporteTrasladado')return false;
  return estadoTask(t)==='Por corregir'||resolveModoEnviar(t,null)==='nuevaEntrega';
}
function enviarTaskPorVerificar(expId,taskId,linksOpt,comentarioOpt,requiereLink,archivosOpt){
  if(esModoResponsable()||esVistaActividadesDepto()){
    if(esVistaActividadesDepto())ensureEncargadoActivo();
    if(!responsableActivo){notif('Seleccione su nombre como responsable','err');return false;}
  }
  let t=getTaskAny(expId,taskId);
  if(t&&t.sinExpediente)expId=t.codigo;
  if(!t){notif('Actividad no encontrada','err');return false;}
  if(esTareaDelEncargado(t)){notif('Las actividades del encargado se finalizan directamente — use el botón ✓ Finalizar','err');return false;}
  if((esModoResponsable()||esVistaActividadesDepto())&&!taskUsuarioEsAsignado(t,responsableActivo)){notif('Actividad no asignada a usted','err');return false;}
  if(!puedeReportarTask(t,responsableActivo)){notif('No puede reportar esta actividad en su estado actual','err');return false;}
  if(estadoTask(t)==='Atendida'){notif('La actividad ya está verificada y cerrada','err');return false;}
  const links=(Array.isArray(linksOpt)?linksOpt:[String(linksOpt||'').trim()]).map(u=>String(u||'').trim()).filter(Boolean);
  const archivos=Array.isArray(archivosOpt)?archivosOpt:(archivosOpt?[archivosOpt]:[]);
  const cmt=String(comentarioOpt||'').trim();
  const hasExisting=(t.soportes||[]).length>0;
  const hasDriveUpload=archivos.some(a=>a&&(a.driveFileId||a.fileId));
  const hasLocalFile=archivos.some(a=>a&&a.data);
  const esReporteTrasladado=!!(document.getElementById('enviar-modo-traslado')&&document.getElementById('enviar-modo-traslado').value==='1')||taskRecibidaPorTraslado(t);
  const esNuevaEntrega=!!(document.getElementById('enviar-modo-nueva')&&document.getElementById('enviar-modo-nueva').value==='1')||estadoTask(t)==='Por corregir';
  if(!links.length&&!cmt&&!hasDriveUpload&&!hasLocalFile){
    notif('Escriba un comentario y/o adjunte un archivo o enlace de Drive para enviar a verificación','err');
    return false;
  }
  const parsedLinks=[];
  for(const link of links){
    const parsed=parseDrivePreviewUrl(link);
    if(!parsed.valid){notif('Enlace no válido — use Google Drive o URL https: '+link.slice(0,60),'err');return false;}
    parsedLinks.push(parsed);
  }
  if(!esNuevaEntrega&&!esReporteTrasladado&&requiereLink&&hasExisting&&parsedLinks.length){
    const activoPrev=getSoporteActivo(t);
    const dup=parsedLinks.some(p=>activoPrev&&activoPrev.url===p.url);
    if(dup&&!hasDriveUpload&&!hasLocalFile){
      notif('Debe adjuntar material nuevo — no puede repetir el mismo enlace de la versión anterior','err');
      return false;
    }
  }
  const ok=mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    const rep=responsableActivo||taskComentarioAutor();
    const loteId='lot_'+Date.now();
    const hasNewInstitutional=archivos.some(a=>a&&(a.driveFileId||a.fileId));
    if(parsedLinks.length||hasLocalFile||hasNewInstitutional){
      t.soportes.forEach(s=>{s.activo=false;});
      if(hasNewInstitutional){
        t.soportes=(t.soportes||[]).filter(s=>!s.driveInstitutional&&!s.driveFileId);
      }
    }
    let linkNum=0,fileNum=0;
    parsedLinks.forEach((parsed)=>{
      const mismo=(t.soportes||[]).find(s=>s.url===parsed.url);
      if(!mismo){
        linkNum++;
        const version=t.soportes.length+1;
        t.soportes.push({
          id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          url:parsed.url,preview:parsed.preview,
          label:'Link '+linkNum,
          fecha:new Date().toISOString(),
          autor:rep,
          reportadoPor:rep,
          version,activo:true,loteEntrega:loteId,local:false
        });
        t.historial.push({tipo:'soporte',fecha:hoy(),version,url:parsed.url,por:rep,reportadoPor:rep});
      }
    });
    archivos.forEach(archivoOpt=>{
      if(!archivoOpt)return;
      const driveId=archivoOpt.driveFileId||archivoOpt.fileId;
      if(driveId){
        const version=(t.soportes||[]).length+1;
        t.soportes.push({
          id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          url:archivoOpt.driveLink,
          preview:archivoOpt.previewLink||archivoOpt.driveLink,
          label:archivoOpt.driveFilename||archivoOpt.nombre||('Documento Drive'),
          fecha:new Date().toISOString(),
          autor:rep,
          reportadoPor:rep,
          version,activo:true,loteEntrega:loteId,local:false,
          driveFileId:driveId,
          driveFilename:archivoOpt.driveFilename||archivoOpt.nombre||'',
          driveEstado:archivoOpt.driveEstado||'revision',
          driveInstitutional:true
        });
        t.historial.push({tipo:'soporte',fecha:hoy(),version,url:archivoOpt.driveLink,por:rep,reportadoPor:rep,nota:'Drive institucional'});
        return;
      }
      if(!archivoOpt.data)return;
      fileNum++;
      const version=t.soportes.length+1;
      const isPdf=archivoOpt.tipo==='application/pdf'||/\.pdf$/i.test(archivoOpt.nombre||'');
      const isImg=archivoOpt.tipo&&archivoOpt.tipo.startsWith('image/');
      const isVid=archivoOpt.tipo&&archivoOpt.tipo.startsWith('video/');
      const isWord=/(word|document|msword|wordprocessing)/i.test(archivoOpt.tipo||'')||/\.(doc|docx)$/i.test(archivoOpt.nombre||'');
      const canPreview=isPdf||isImg||isVid;
      t.soportes.push({
        id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        url:archivoOpt.data,
        preview:canPreview?archivoOpt.data:(isWord?archivoOpt.data:''),
        label:archivoOpt.nombre||('Documento '+fileNum),
        fecha:new Date().toISOString(),
        autor:rep,
        reportadoPor:rep,
        version,activo:true,local:true,tipo:archivoOpt.tipo||'',loteEntrega:loteId
      });
      t.historial.push({tipo:'soporte',fecha:hoy(),version,url:'[archivo local]',por:rep,reportadoPor:rep,nota:archivoOpt.nombre||''});
    });
    if(cmt){
      t.comentarios.push({
        autor:rep,
        fecha:new Date().toISOString(),
        texto:cmt,
        rol:'ejecutor',
        incluidoEnReporte:true,
        reportadoPor:rep
      });
    }
    const hoyRep=hoy();
    if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'){
      const a=ensureAsignado(t,rep);
      a.fechaReportada=hoyRep;
      a.estado='por_verificar';
    }else{
      t.fechaReportada=hoyRep;
      t.estado='Por verificar';
      (t.asignados||[]).forEach(a=>{
        if(a.estado!=='atendido'){a.fechaReportada=hoyRep;a.estado='por_verificar';}
      });
    }
    t.fechaAtendida='';
    t.ultimaRevisionDepto=null;
    t.reporteTrasladado=false;
    const v=(getSoportesUltimaEntrega(t)[0]||getSoporteActivo(t)||{}).version||'';
    t.historial.push({tipo:'reenvio_verificacion',fecha:hoyRep,ts:Date.now(),por:rep,reportadoPor:rep,version:v,nota:cmt||''});
    syncTaskAggregateState(t);
  });
  if(ok){
    notif(esNuevaEntrega?'Nueva entrega enviada al departamento para verificación':esReporteTrasladado?'Actividad reportada tras traslado — pendiente de verificación del departamento':'Actividad reportada — pendiente de verificación del departamento','ok');
    const fAct=document.getElementById('f-act-est');
    if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on')&&fAct&&['pend','venc','prior','porcorr'].includes(fAct.value))setActFiltro('porver');
  }
  return ok;
}
function renderEnviarAdjuntoRow(){
  return '<div class="enviar-adj-row" data-kind="link">'+
    '<input type="url" class="enviar-adj-link" placeholder="https://drive.google.com/file/d/…" style="flex:1;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px">'+
    '<button type="button" class="btn bsm bic" title="Quitar" onclick="this.closest(\'.enviar-adj-row\').remove()">✕</button></div>';
}
function addEnviarAdjuntoRow(){
  const wrap=document.getElementById('enviar-adjuntos-rows');if(!wrap)return;
  const tmp=document.createElement('div');
  tmp.innerHTML=renderEnviarAdjuntoRow();
  wrap.appendChild(tmp.firstElementChild);
  const inp=wrap.querySelector('.enviar-adj-row:last-child input');
  if(inp)inp.focus();
}
function collectEnviarAdjuntos(){
  const wrap=document.getElementById('enviar-adjuntos-rows');
  const fileInp=document.getElementById('enviar-adj-file');
  const links=[];
  const files=[];
  if(wrap){
    wrap.querySelectorAll('.enviar-adj-row').forEach(row=>{
      const v=(row.querySelector('.enviar-adj-link')||{}).value;
      if(String(v||'').trim())links.push(String(v).trim());
    });
  }
  if(fileInp&&fileInp.files&&fileInp.files.length){
    const f=fileInp.files[0];
    if(f&&archivoPermitidoEnviar(f))files.push({blob:f,nombre:f.name,tipo:f.type||''});
  }
  return{links,files};
}
function archivoPermitidoEnviar(file){
  if(!file)return false;
  const okType=file.type==='application/pdf'||(file.type&&file.type.startsWith('image/'))||(file.type&&file.type.startsWith('video/'))||
    /(word|document|msword|wordprocessing)/i.test(file.type||'')||/\.(pdf|png|jpe?g|gif|webp|doc|docx|mp4|webm|mov)$/i.test(file.name||'');
  return okType;
}
function readFilesAsData(files,cb){
  if(!files.length){cb([]);return;}
  let done=0;
  const out=new Array(files.length);
  files.forEach((file,i)=>{
    const reader=new FileReader();
    reader.onload=function(){
      out[i]={nombre:file.name,tipo:file.type||'',data:reader.result};
      if(++done>=files.length)cb(out.filter(Boolean));
    };
    reader.onerror=function(){
      notif('No se pudo leer: '+file.name,'err');
      if(++done>=files.length)cb(out.filter(Boolean));
    };
    reader.readAsDataURL(file);
  });
}
function collectEnviarLinks(){
  return collectEnviarAdjuntos().links;
}
function addEnviarLinkRow(){addEnviarAdjuntoRow();}
function getUltimaEntregaComentario(t){
  t=normalizeTask(t||{});
  const entregas=(t.comentarios||[]).filter(c=>c.incluidoEnReporte);
  if(entregas.length){
    const c=entregas[entregas.length-1];
    return{autor:c.autor||c.reportadoPor||t.responsable||'',texto:c.texto||'',fecha:c.fecha||''};
  }
  const ult=(t.historial||[]).filter(h=>h.tipo==='reenvio_verificacion').pop();
  if(ult&&(ult.nota||ult.texto)){
    return{autor:ult.por||ult.reportadoPor||t.responsable||'',texto:ult.nota||ult.texto||'',fecha:ult.fecha||''};
  }
  return null;
}
function renderEntregaComentarioBoxHtml(ent,opts){
  opts=opts||{};
  if(!ent||!String(ent.texto||'').trim())return'';
  return '<div class="entrega-cmt-box" style="padding:10px 12px;margin-bottom:8px;background:var(--bll);border:1px solid var(--bl);border-radius:var(--r)">'+
    '<div style="font-size:11px;font-weight:600;color:var(--bl);margin-bottom:4px">📤 Comentario de entrega'+(opts.pendiente?' — pendiente de revisión':'')+'</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">'+escAttr(ent.autor||'')+' · '+fmtF((ent.fecha||'').slice(0,10))+'</div>'+
    '<div style="font-size:13px;color:var(--tx);white-space:pre-wrap">'+escAttr(ent.texto)+'</div></div>';
}
function taskChatComentariosCount(t){
  if(!t)return 0;
  return (t.comentarios||[]).filter(c=>!c.incluidoEnReporte).length;
}
function taskChatBtnHtml(expId,taskId,t){
  const nc=taskChatComentariosCount(t);
  const ref=escAttr(expId),tid=escAttr(taskId);
  return '<button type="button" class="btn bsm bic" title="Chat de la actividad — consultas, traslado o eliminación'+(nc?' · '+nc+' mensaje(s)':'')+'" onclick="openTaskCommentsChatOnly(\''+ref+'\',\''+tid+'\')">'+chatWaIconHtml(15)+(nc>0?'<span class="cmt-dot">'+nc+'</span>':'')+'</button>';
}
function renderEntregaHistorialHtml(t){
  const ent=(t.comentarios||[]).filter(c=>c.incluidoEnReporte&&String(c.texto||'').trim());
  const sops=(t.soportes||[]).length;
  if(!ent.length&&!sops)return'';
  let h='<div style="margin-bottom:10px;max-height:140px;overflow-y:auto;padding:8px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">';
  h+='<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:6px">Historial de entregas'+(sops?' · '+sops+' soporte(s)':'')+'</div>';
  if(ent.length){
    ent.forEach(c=>{
      h+='<div class="task-cmt" style="margin-bottom:6px;font-size:12px"><div class="task-cmt-meta" style="font-size:10px;color:var(--tx3)">'+escAttr(c.autor||'')+' · '+fmtF((c.fecha||'').slice(0,10))+' · Entrega</div>'+escAttr(c.texto||'')+'</div>';
    });
  }else if(sops){
    h+='<div style="font-size:12px;color:var(--tx3)">Entregas anteriores con soporte adjunto.</div>';
  }
  h+='</div>';
  return h;
}
function renderTaskChatPanelHtml(expId,taskId,t){
  t=normalizeTask(t||{});
  const chatAct=(t.comentarios||[]).filter(c=>!c.incluidoEnReporte);
  const lista=chatAct.length?chatAct.map(c=>'<div class="task-cmt"><div class="task-cmt-meta">'+escAttr(c.autor||'')+' · '+fmtF((c.fecha||'').slice(0,10))+'</div>'+escAttr(c.texto||'')+'</div>').join(''):'<div style="font-size:12px;color:var(--tx3);margin-bottom:.5rem">Sin mensajes en el chat de actividad.</div>';
  const canWriteDept=!esModoResponsable()&&!esJurisdiccional();
  const canWriteResp=(esModoResponsable()||esVistaActividadesDepto())&&taskUsuarioEsAsignado(t,responsableActivo);
  const sol=getTaskSolicitudPendiente(t);
  const est=estadoTask(t);
  const ref=t.sinExpediente?(t.codigo||expId):expId;
  let form='';
  if(canWriteDept){
    form='<div class="task-cmt-form" id="task-chat-form"><textarea id="task-cmt-input" placeholder="Mensaje al responsable sobre la actividad…"></textarea><div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px">'+
      '<button type="button" class="btn bsm bp" onclick="submitTaskComment(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Enviar mensaje</button>'+
      (taskPendienteVerificacion(t)?'<button type="button" class="btn bsm bd2" onclick="devolverTaskConComentario(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">↩ Devolver con comentario</button>':'')+
      '</div></div>';
  }else if(canWriteResp){
    form='<div class="task-cmt-form" id="task-chat-form"><textarea id="task-cmt-input" placeholder="Consulta o mensaje sobre la actividad (las entregas se hacen con 📤, no por este chat)…"></textarea><div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px">'+
      '<button type="button" class="btn bsm bp" onclick="submitTaskComment(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Enviar mensaje</button>';
    if(!sol&&est!=='Atendida'){
      form+='<button type="button" class="btn bsm" onclick="openSolicitarTrasladoModal(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">↔ Solicitar traslado</button>'+
        '<button type="button" class="btn bsm bd2" onclick="openSolicitarEliminacionModal(\''+escAttr(ref)+'\',\''+escAttr(taskId)+'\')">🗑 Solicitar eliminación</button>';
    }
    if(sol)form+='<span class="solicitud-pill" style="margin-left:4px">Solicitud enviada — pendiente</span>';
    form+='</div></div>';
  }
  const hint=canWriteResp?'Use el chat para consultas o solicitar traslado/eliminación. Para entregar ejecutada use el botón 📤.':
    'Conversación con el responsable sobre la actividad (independiente de las entregas formales).';
  return '<div class="task-chat-sep" id="task-chat-sep"><div style="font-size:12px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px">'+chatWaIconHtml(16)+' Chat de actividad</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:6px">'+hint+'</div>'+lista+form+'</div>';
}
function submitEnviarSoporteVerificacion(expId,taskId){
  const cmt=String((document.getElementById('enviar-cmt-opcional')||{}).value||'').trim();
  const adj=collectEnviarAdjuntos();
  const reqEl=document.getElementById('enviar-requiere-link');
  const requiereLink=reqEl&&reqEl.value==='1';
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  const esPqrs=e&&t&&taskEsAtenderPqrs(t,e);
  let pq=null;
  if(esPqrs){
    pq=collectPqrsEntregaDatos(expId);
    if(!pq)return;
  }
  const runSubmit=function(driveArchivos){
    if(!enviarTaskPorVerificar(expId,taskId,adj.links,cmt,requiereLink,driveArchivos||[]))return;
    if(esPqrs&&pq){
      if(!pq.adj.links.length){
        const t2=getTaskFromExp(e,taskId);
        const activo=getSoporteActivo(t2);
        if(activo&&(activo.url||activo.preview)&&!activo.local)pq.adj.links=[activo.url||activo.preview];
      }
      const adjDocumentos=pq.adj.links.map(lnk=>({nombre:'Link Drive',driveLink:lnk,tipo:'link'}));
      guardarPqrsRespuestaDatos(e,{fechaResp:pq.fechaResp,oficioExt:pq.oficioExt,cuerpo:pq.cuerpo,tipo:pq.tipo,canal:pq.canal,nota:cmt,adj:pq.adj,archivos:adjDocumentos},false);
      persistExpedienteGranular(e,false);
      renderPqrsOficinaInbox();
      renderSecretariaPqrs();
      notif('📤 Respuesta enviada a revisión del encargado NCA','ok');
    }
    closeTaskModal();
  };
  if(adj.files.length&&e&&typeof _driveExpedienteEsGuaviare==='function'&&_driveExpedienteEsGuaviare(e)&&typeof driveUploadExpedienteActividad==='function'){
    (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
      if(!ok)return;
      const rep=responsableActivo||taskComentarioAutor();
      notif('Subiendo archivo al Drive institucional…','info');
      (async function(){
      try{
        if(t&&typeof drivePurgeTaskInstitutionalSoportes==='function')await drivePurgeTaskInstitutionalSoportes(t);
        const up=await driveUploadExpedienteActividad(adj.files[0].blob,adj.files[0].nombre,adj.files[0].tipo,e,t,rep,'revision');
        await persistExpedienteGranular(e,false);
        runSubmit([up]);
      }catch(err){
        console.warn('submitEnviarSoporteVerificacion drive:',err);
        notif('No se pudo subir al Drive: '+(err.message||'revise la conexión Gmail'),'err');
      }
    })();
    });
    return;
  }
  if(adj.files.length){
    notif('La subida automática al Drive solo aplica en expedientes de Guaviare. Use enlace manual o comentario.','warn');
    return;
  }
  runSubmit([]);
}
function renderEnviarPanelHtml(expId,taskId,t,modo){
  const traslado=modo==='reporteTrasladado'||taskRecibidaPorTraslado(t);
  const nuevaEntrega=modo==='nuevaEntrega'||estadoTask(t)==='Por corregir';
  const finalizarEnc=modo==='finalizarEncargado';
  const eExp=getExpById(expId);
  const esPqrsEntrega=eExp&&taskEsAtenderPqrs(t,eExp);
  const soportes=t.soportes||[];
  const hasSop=soportes.length>0;
  const ultima=hasSop?soportes[soportes.length-1]:null;
  const sol=getTaskSolicitudPendiente(t);
  let h='<div class="task-cmt-form task-enviar-unificado" id="task-enviar-panel" style="padding:.65rem;border-radius:var(--r);background:var(--sf2)">';
  h+='<input type="hidden" id="enviar-requiere-link" value="0">';
  h+='<input type="hidden" id="enviar-modo-nueva" value="'+(nuevaEntrega?'1':'0')+'">';
  h+='<input type="hidden" id="enviar-modo-traslado" value="'+(traslado&&!nuevaEntrega?'1':'0')+'">';
  h+=renderEntregaHistorialHtml(t);
  h+='<div style="font-size:13px;font-weight:600;margin-bottom:6px">'+(finalizarEnc?'✓ Finalizar actividad (encargado del departamento)':nuevaEntrega?'📤 Nueva entrega':'📤 Entrega de actividad')+'</div>';
  if(sol){
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:8px;background:var(--orl);border-radius:var(--r)">'+
      'Tiene una solicitud de <strong>'+(sol.tipo==='traslado'?'traslado':'eliminación')+'</strong> pendiente en el chat — espere respuesta del departamento.</div>';
  }else if(finalizarEnc){
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:6px 8px;background:var(--sf);border-radius:var(--r);border:1px solid var(--bd)">Como encargado del departamento, al finalizar la actividad queda <strong>cerrada directamente</strong>. Puede adjuntar soporte opcional.</div>';
  }else if(nuevaEntrega){
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:6px 8px;background:var(--sf);border-radius:var(--r);border:1px solid var(--bd)">'+
      '<strong>Nueva entrega</strong> — el comentario es sobre <strong>esta entrega</strong> (no el chat de la actividad). Enlace de Drive y/o comentario; sin adjunto, comentario obligatorio.'+
      (hasSop&&ultima?' Versión anterior: v'+ultima.version+'.':'')+
    '</div>';
  }else if(traslado){
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:6px 8px;background:var(--sf);border-radius:var(--r);border:1px solid var(--bd)">'+
      'Entrega tras traslado — comentario sobre <strong>esta entrega</strong>. Sin enlace Drive, comentario obligatorio.'+
    '</div>';
  }else{
    h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:6px 8px;background:var(--sf);border-radius:var(--r);border:1px solid var(--bd)">'+
      'Adjunte enlace de Google Drive y/o comentario sobre esta entrega.'+
    '</div>';
  }
  if(esPqrsEntrega&&!sol)h+=renderPqrsEntregaCamposHtml(eExp);
  if(!sol){
    const showDriveUp=eExp&&typeof _driveExpedienteEsGuaviare==='function'&&_driveExpedienteEsGuaviare(eExp);
    if(showDriveUp){
      h+='<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600;color:var(--tx3)">Subir archivo (Drive institucional — opcional)</label>'+
        '<input type="file" id="enviar-adj-file" accept=".pdf,.doc,.docx,image/*,video/*" style="font-size:12px;width:100%;margin-top:4px">'+
        '<div style="font-size:10px;color:var(--tx3);margin-top:2px">Un documento por actividad. También puede pegar un enlace externo abajo o escribir el link en el comentario.</div></div>';
    }
    h+='<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:4px">'+(finalizarEnc?'Soporte opcional (link Drive)':'Enlaces Google Drive externos (opcionales)')+'</div>'+
      '<div id="enviar-adjuntos-rows"></div>'+
      '<div class="fx" style="gap:6px;margin-bottom:8px;flex-wrap:wrap">'+
        '<button type="button" class="btn bsm" onclick="addEnviarAdjuntoRow()">+ Link Drive</button>'+
      '</div>'+
      '<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Enlace externo de Google Drive (archivos fuera del Drive institucional). También puede incluir el link en el comentario.</div>'+
      '<textarea id="enviar-cmt-opcional" placeholder="'+(finalizarEnc?'Comentario opcional al finalizar…':nuevaEntrega?'Comentario sobre esta entrega (obligatorio si no adjunta link Drive)…':'Comentario sobre esta entrega (obligatorio si no adjunta link Drive)…')+'" style="min-height:72px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;margin-bottom:8px;width:100%"></textarea>'+
      '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="'+(finalizarEnc?'submitFinalizarEncargado':'submitEnviarSoporteVerificacion')+'(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">'+(finalizarEnc?'✓ Finalizar actividad':nuevaEntrega?'📤 Enviar nueva entrega':'📤 Enviar para verificación')+'</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }else{
    h+='<div class="fx" style="gap:8px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  }
  h+='</div>';
  return h;
}
function openEnviarSoporteModal(expId,taskId,modo){
  let e=getExpById(expId),t=getTaskFromExp(e,taskId);
  if(!t){t=normalizeActLibre(getActLibreById(taskId));if(t){expId=t.codigo;e=null;}}
  if(!t)return;
  if(!modo)modo=resolveModoEnviar(t,null);
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent=(modo==='nuevaEntrega'?'Nueva entrega':modo==='reporteTrasladado'?'Reportar actividad trasladada':'Entrega')+' · '+(t.codigo||expId);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const est=estadoTask(t),st=taskEstadoStyle(est);
  body.innerHTML='<div style="margin-bottom:.75rem"><span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+estadoTaskLabel(t)+'</span></div>'+
    '<div style="font-size:13px;margin-bottom:.75rem">'+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
    renderEnviarPanelHtml(expId,taskId,t,modo);
  ov.classList.add('on');
  window._taskModalCtx={expId,taskId,mode:'enviar',actLibre:!!t.sinExpediente};
  setTimeout(()=>{const inp=document.getElementById('enviar-cmt-opcional');if(inp)inp.focus();},80);
}
function renderCompareVersionesPanel(t,e,taskId){
  const docs=collectDocsComparables(e,taskId,t);
  if(docs.length<2)return '<div style="font-size:12px;color:var(--tx3);padding:8px">Se necesitan al menos 2 documentos del expediente o de la actividad para comparar.</div>';
  const defA=docs[Math.max(0,docs.length-2)].id;
  const defB=docs[docs.length-1].id;
  window._compareDocA=window._compareDocA||defA;
  window._compareDocB=window._compareDocB||defB;
  const opts=docs.map(d=>'<option value="'+escAttr(d.id)+'">'+escAttr((d.origen||'')+' · '+d.label)+'</option>').join('');
  let h='<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Seleccione dos documentos para verlos lado a lado: entregas de la actividad, versiones anteriores y enlaces Drive registrados en el expediente.</div>';
  h+='<div class="compare-ver-sel">'+
    '<label>Documento izquierdo <select id="compare-ver-a" onchange="onCompareVerChange()">'+opts+'</select></label>'+
    '<label>Documento derecho <select id="compare-ver-b" onchange="onCompareVerChange()">'+opts+'</select></label>'+
    '<button type="button" class="btn bsm" onclick="setCompareUltimasDos()">Últimos dos</button></div>';
  h+='<div id="compare-ver-stack" class="compare-ver-stack"></div>';
  return h;
}
function setCompareUltimasDos(){
  const ctx=window._taskModalCtx||{};
  const e=getExpById(ctx.expId);
  const t=getTaskFromExp(e,ctx.taskId);
  const docs=collectDocsComparables(e,ctx.taskId,t);
  if(docs.length<2)return;
  window._compareDocA=docs[docs.length-2].id;
  window._compareDocB=docs[docs.length-1].id;
  const sa=document.getElementById('compare-ver-a'),sb=document.getElementById('compare-ver-b');
  if(sa)sa.value=window._compareDocA;
  if(sb)sb.value=window._compareDocB;
  renderCompareVerStack(t,e);
}
function onCompareVerChange(){
  window._compareDocA=(document.getElementById('compare-ver-a')||{}).value;
  window._compareDocB=(document.getElementById('compare-ver-b')||{}).value;
  const ctx=window._taskModalCtx||{};
  const e=getExpById(ctx.expId);
  const t=getTaskFromExp(e,ctx.taskId);
  if(t||e)renderCompareVerStack(t,e);
}
function renderCompareNotasHtml(t,sopId){
  const notas=notasDocForSoporte(t,sopId);
  if(!notas.length)return '<div class="compare-ver-obs" style="font-size:11px;color:var(--tx3)">Sin observaciones en esta versión</div>';
  const sorted=[...notas].sort((a,b)=>(a.pin||99)-(b.pin||99));
  return '<div class="compare-ver-obs">'+sorted.map(n=>{
    const loc=n.pagina?('Pág. '+escAttr(n.pagina)+' '):'';
    const pin=n.pin?('#'+n.pin+' '):'';
    return '<div class="compare-ver-obs-item"><strong>'+pin+loc+'</strong>'+escAttr((n.texto||'').slice(0,160))+
      (n.ref?' <span style="color:var(--tx3)">('+escAttr(n.ref)+')</span>':'')+'</div>';
  }).join('')+'</div>';
}
function renderCompareDocSideHtml(doc,sideLbl,t){
  if(!doc)return'<div class="compare-ver-block"><div class="lbl">'+escAttr(sideLbl)+'</div><div style="padding:8px;font-size:12px">Sin documento</div></div>';
  const sopLike={preview:doc.preview,url:doc.url,mime:doc.mime,local:doc.local,version:''};
  let vista='';
  if(soporteTieneVista(sopLike)){
    vista=soporteEsImagen(sopLike)
      ?'<img src="'+escAttr(doc.preview||doc.url)+'" alt="'+escAttr(doc.label)+'" style="width:100%;max-height:420px;object-fit:contain;display:block">'
      :'<iframe sandbox="allow-scripts allow-same-origin allow-popups" src="'+escAttr(doc.preview||doc.url)+'" title="'+escAttr(doc.label)+'"></iframe>';
  }else{
    vista='<div style="padding:12px;font-size:12px;color:var(--tx3)">Sin vista previa — <a href="'+escAttr(doc.url||'#')+'" target="_blank" rel="noopener">abrir enlace</a></div>';
  }
  const notas=doc.soporteId&&t?renderCompareNotasHtml(t,doc.soporteId):'';
  return '<div class="compare-ver-block"><div class="lbl">'+escAttr(sideLbl)+' · '+escAttr(doc.label)+(doc.meta?' · '+escAttr(doc.meta):'')+'</div>'+vista+notas+'</div>';
}
function renderCompareVerStack(t,e){
  const stack=document.getElementById('compare-ver-stack');
  if(!stack)return;
  const ctx=window._taskModalCtx||{};
  e=e||getExpById(ctx.expId);
  const docs=collectDocsComparables(e,ctx.taskId,t);
  if(docs.length<2){stack.innerHTML='';return;}
  const a=docs.find(x=>x.id===window._compareDocA)||docs[docs.length-2];
  const b=docs.find(x=>x.id===window._compareDocB)||docs[docs.length-1];
  stack.innerHTML=renderCompareDocSideHtml(a,'◀ Izquierda',t)+renderCompareDocSideHtml(b,'Derecha ▶',t);
}
function renderAsistenteRevisionPanel(expId,taskId,t){
  const activo=getSoporteActivo(t);
  return '<div class="asist-rev">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">🤖 Asistente de revisión</div>'+
    '<div class="asist-rev-info">Apoya al departamento con checklist del expediente y revisión del PDF descargado de Drive (sin enviar datos a internet).</div>'+
    '<button type="button" class="btn bsm bp" style="margin-bottom:8px" onclick="ejecutarAsistenteRevision(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Analizar consistencia (datos)</button>'+
    '<div class="asist-pdf-upload">'+
      '<div style="font-size:11px;font-weight:600;margin-bottom:4px">Revisión del PDF (local)</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">Descargue el documento desde Drive'+(activo?' (v'+activo.version+')':'')+' y adjúntelo aquí. El asistente leerá el texto por página.</div>'+
      '<input type="file" id="asist-pdf-file" accept=".pdf,application/pdf" style="font-size:12px;width:100%;margin-bottom:6px">'+
      '<button type="button" class="btn bsm bp" onclick="ejecutarAsistentePdfRevision(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">Revisar PDF adjunto</button></div>'+
    '<div id="asist-rev-result"></div></div>';
}
async function ensurePdfJsLoaded(){
  if(window.pdfjsLib)return window.pdfjsLib;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=resolve;
    s.onerror=()=>reject(new Error('No se pudo cargar PDF.js'));
    document.head.appendChild(s);
  });
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjsLib;
}
function buildDatosCotejoPdf(e,t){
  const datos=[];
  const add=(label,val,peso)=>{
    const s=String(val||'').trim();
    if(!s||s.length<2)return;
    datos.push({label,valor:s,norm:s.toLowerCase().replace(/\s+/g,' '),peso:peso||1});
  };
  add('Expediente',e._exp,2);
  add('Interesado',getNom(e),2);
  add('Resolución',e._resolucion,1);
  add('Estado expediente',e._estado,1);
  const tram=getTram(e._tramite,e);
  if(tram)add('Trámite',tram.nombre,1);
  migrarInfoTecExpediente(e);
  infoTecnicaExpData(e._info_tecnica_items).forEach(it=>{
    const def=getInfoTecDef(it.campoId,e);
    add(def?def.label:it.campoId,it.valor,1);
  });
  if(tram)tram.campos.slice(0,12).forEach(c=>{
    const v=e['f_'+c.id];
    if(v!=null&&v!==''&&v!==false)add(c.label,fmtCampoVal(v,c),1);
  });
  return datos;
}
async function extraerTextoPdfPorPaginas(file){
  const pdfjs=await ensurePdfJsLoaded();
  const buf=await file.arrayBuffer();
  const pdf=await pdfjs.getDocument({data:buf}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    const text=content.items.map(it=>it.str).join(' ').replace(/\s+/g,' ').trim();
    pages.push({pagina:p,texto:text,textoNorm:text.toLowerCase()});
  }
  return pages;
}
function analizarPdfConDatosExp(pages,datos){
  const hallazgos=[];
  const patronesAlerta=[/\b(xxx+|pendiente|completar|t\.?\s*b\.?\s*d\.?|por\s+definir|\[\s*\]|_{3,})\b/i];
  datos.forEach(d=>{
    const found=pages.some(pg=>pg.textoNorm.includes(d.norm)||d.norm.split(' ').filter(w=>w.length>4).some(w=>pg.textoNorm.includes(w)));
    if(!found&&d.peso>=2){
      hallazgos.push({pagina:0,tipo:'warn',texto:'No se encontró «'+d.label+'»: '+d.valor+' — verifique que el documento lo incluya.'});
    }
  });
  pages.forEach(pg=>{
    patronesAlerta.forEach(rx=>{
      if(rx.test(pg.texto))hallazgos.push({pagina:pg.pagina,tipo:'warn',texto:'Posible texto incompleto o placeholder en esta página.'});
    });
    datos.forEach(d=>{
      if(d.peso<2||d.norm.length<8)return;
      const palabras=d.norm.split(' ').filter(w=>w.length>4);
      if(palabras.length>=2){
        const alg=palabras.some(w=>pg.textoNorm.includes(w));
        const todas=palabras.filter(w=>pg.textoNorm.includes(w)).length>=Math.ceil(palabras.length*0.6);
        if(alg&&!todas&&pg.textoNorm.length>40){
          hallazgos.push({pagina:pg.pagina,tipo:'info',texto:'Coincidencia parcial con «'+d.label+'» — revise si el dato «'+d.valor+'» está correcto.'});
        }
      }
    });
    if(pg.textoNorm.length<15&&pages.length>1){
      hallazgos.push({pagina:pg.pagina,tipo:'info',texto:'Página con muy poco texto extraíble (puede ser imagen escaneada — revise visualmente).'});
    }
  });
  const seen=new Set();
  return hallazgos.filter(h=>{
    const k=h.pagina+'|'+h.texto;
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
}
async function ejecutarAsistentePdfRevision(expId,taskId){
  const e=getExpById(expId),t=getTaskFromExp(e,taskId);
  const box=document.getElementById('asist-rev-result');
  const inp=document.getElementById('asist-pdf-file');
  if(!e||!t||!box)return;
  const file=inp&&inp.files&&inp.files[0];
  if(!file){notif('Seleccione un archivo PDF descargado de Drive','err');return;}
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){notif('El archivo debe ser PDF','err');return;}
  box.innerHTML='<div class="asist-rev-item">Leyendo PDF ('+escAttr(file.name)+')…</div>';
  try{
    const pages=await extraerTextoPdfPorPaginas(file);
    const datos=buildDatosCotejoPdf(e,t);
    const hall=analizarPdfConDatosExp(pages,datos);
    let html='<div class="asist-rev-item asist-rev-ok">✓ PDF analizado: '+pages.length+' página(s) · '+datos.length+' dato(s) del expediente para cotejar</div>';
    if(!hall.length){
      html+='<div class="asist-rev-item asist-rev-ok">Sin alertas automáticas — revise manualmente con los marcadores en el documento.</div>';
    }else{
      hall.forEach(h=>{
        const pg=h.pagina?('Pág. '+h.pagina+' · '):'General · ';
        html+='<div class="asist-pdf-hallazgo'+(h.tipo==='warn'?' asist-rev-warn':'')+'"><strong>'+pg+'</strong>'+escAttr(h.texto)+'</div>';
      });
    }
    html+='<div class="asist-rev-item" style="color:var(--tx3);font-size:11px;margin-top:6px">La revisión es automática (texto del PDF). No sustituye la revisión humana ni detecta errores en documentos escaneados sin texto.</div>';
    box.innerHTML=html;
  }catch(err){
    box.innerHTML='<div class="asist-rev-item asist-rev-warn">No se pudo leer el PDF. Descárguelo de Drive e intente de nuevo. '+(err&&err.message?escAttr(err.message):'')+'</div>';
  }
}
function ejecutarAsistenteRevision(expId,taskId){
  const e=getExpById(expId),t=getTaskFromExp(e,taskId);
  const box=document.getElementById('asist-rev-result');
  if(!e||!t||!box)return;
  normalizeTask(t);
  const items=[];
  const add=(cls,txt)=>items.push('<div class="asist-rev-item '+cls+'">'+txt+'</div>');
  add('','<strong>Expediente:</strong> '+escAttr(e._exp)+' · '+escAttr(getNom(e))+' · '+escAttr(e._estado||''));
  const tram=getTram(e._tramite,e);
  if(tram)add('','<strong>Trámite:</strong> '+escAttr(tram.nombre));
  add('',(t.soportes||[]).length?'<strong>Versiones de soporte:</strong> '+(t.soportes||[]).length:'<span class="asist-rev-warn">⚠ Sin documentos de soporte adjuntos</span>');
  const activo=getSoporteActivo(t);
  const prev=(t.soportes||[]).length>1?(t.soportes||[]).filter(s=>s.id!==activo.id).pop():null;
  if(activo&&prev&&activo.url===prev.url)add('asist-rev-warn','⚠ El enlace activo es <strong>igual</strong> al de la versión anterior (v'+prev.version+'). Verifique que subió el documento corregido.');
  else if(activo&&prev)add('asist-rev-ok','✓ El enlace activo (v'+activo.version+') es distinto al anterior (v'+prev.version+').');
  const obs=(t.notasDoc||[]).filter(n=>n.rol==='revisor');
  if(obs.length)add('asist-rev-warn','⚠ '+obs.length+' observación(es) del departamento pendientes de revisar en el documento.');
  else add('asist-rev-ok','✓ Sin observaciones marcadas pendientes en el documento.');
  const notasPorVer=obs.filter(n=>{
    const respDesp=(t.notasDoc||[]).some(r=>r.rol==='ejecutor'&&r.tipo==='respuesta'&&r.fecha>(n.fecha||''));
    return !respDesp;
  });
  notasPorVer.slice(0,5).forEach((n,i)=>{
    add('asist-rev-warn','Obs. '+(n.pin||i+1)+': '+escAttr((n.texto||'').slice(0,120))+(n.ref?' ('+escAttr(n.ref)+')':''));
  });
  const links=collectEnlacesExpediente(e);
  if(links.length>1)add('','<strong>Trazabilidad:</strong> '+links.length+' enlace(s) registrados en expediente y actividades — use la pestaña Comparar o Enlaces.');
  migrarInfoTecExpediente(e);
  const itec=infoTecnicaExpData(e._info_tecnica_items).filter(it=>it.valor!=null&&it.valor!=='').slice(0,6);
  if(itec.length){
    add('','<strong>Datos técnicos a cotejar en el documento:</strong>');
    itec.forEach(it=>{
      const def=getInfoTecDef(it.campoId,e);
      add('',escAttr((def?def.label:it.campoId)+': '+String(it.valor).slice(0,80)));
    });
  }
  add('','<span style="color:var(--tx3)">Sugerencia: use la pestaña ⇅ Comparar versiones para verificar visualmente los cambios en el apartado señalado.</span>');
  box.innerHTML=items.join('');
}
function resetTaskPorCorregir(t,nota,reportadoPor){
  reportadoPor=reportadoPor||getUltimoReportadoPor(t);
  if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'&&reportadoPor){
    const a=getAsignado(t,reportadoPor);
    if(a){a.fechaReportada='';a.fechaAtendida='';a.estado='por_corregir';}
    syncTaskAggregateState(t);
  }else{
    t.fechaReportada='';
    t.fechaAtendida='';
    t.estado='Por corregir';
    (t.asignados||[]).forEach(a=>{
      if(a.estado==='por_verificar'||a.estado==='atendido'){a.fechaReportada='';a.fechaAtendida='';a.estado='por_corregir';}
      else if(a.estado!=='atendido')a.estado='por_corregir';
    });
  }
  t.ultimaRevisionDepto={tipo:'corregir',fecha:hoy(),ts:Date.now(),por:taskComentarioAutor(),nota:nota||''};
  t.historial.push({tipo:'ajuste_soporte',fecha:hoy(),ts:Date.now(),por:taskComentarioAutor(),nota:nota||'',reportadoPor:reportadoPor||''});
}
function solicitarAjusteSoporte(expId,taskId,nota){
  return mutateTask(expId,taskId,t=>resetTaskPorCorregir(t,nota||''));
}
async function driveRenombrarSoporteActivoExp(expId,taskId,newEstado){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  if(!e||!t||typeof driveRenameExpedienteSoporte!=='function')return false;
  const activo=getSoporteActivo(normalizeTask(t));
  if(!activo||!activo.driveFileId)return false;
  const rep=getUltimoReportadoPor(t)||activo.autor||'';
  const ok=await driveRenameExpedienteSoporte(activo,newEstado,e,t,rep);
  if(ok)await persistExpedienteGranular(e,false);
  return ok;
}
function devolverTaskAlResponsable(expId,taskId,nota){
  if(solicitarAjusteSoporte(expId,taskId,nota||'Devuelta al responsable')){
    if(typeof driveRenombrarSoporteActivoExp==='function'){
      driveRenombrarSoporteActivoExp(expId,taskId,'corregir').catch(function(err){console.warn('drive rename corregir:',err);});
    }
    notif('Actividad devuelta — queda por corregir','ok');
    closeTaskModal();
    renderBandejaDepto();
    if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    if(window._conPanelEditMode&&document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')&&window._conPanelActive===expId){
      renderConSidePanel();
    }else if(editId===expId){
      const e=getExpById(expId);
      if(e){setCfgPtr(e._depto||getDeptoOperativo());renderFormulario(e._tramite,e,'con-side-form-wrap');}
    }
    return true;
  }
  return false;
}
function renderTaskSoportePanelHtml(expId,taskId,t,sopSelId,opts){
  opts=opts||{};
  normalizeTask(t);
  const esLibre=!!t.sinExpediente||isActLibreRef(expId,taskId);
  const e=esLibre?null:getExpById(expId);
  const soportes=t.soportes||[];
  const hasSop=soportes.length>0;
  const est=estadoTask(t);
  const yoResp=esModoResponsable()?taskUsuarioEsAsignado(t,responsableActivo):(esVistaActividadesDepto()&&esTareaDelEncargado(t));
  const canAddSop=yoResp&&['En ejecución','Vencida','Por corregir'].includes(est);
  const activo=getSoporteActivo(t);
  const sel=soportes.find(s=>s.id===sopSelId)||activo;
  const canAnnot=canDeptMarcarEnSoporte(t,sel);
  const canReviewSop=!esModoResponsable()&&!esJurisdiccional()&&taskPendienteVerificacion(t);
  const esPqrsSolResp=e&&taskEsAtenderPqrs(t,e);
  const canComparePqrs=esPqrsSolResp&&canReviewSop;
  const showPqrsCompare=canComparePqrs&&(e._pqrs_solicitud_link||e._pqrs_solicitud_archivo||getPqrsRespuestaDocPreview(e,t));
  const docsCompare=(!esLibre&&e)?collectDocsComparables(e,taskId,t):collectDocsComparables(null,null,t);
  const showCompareDocs=canReviewSop&&docsCompare.length>=2;
  const showCompareVer=!canReviewSop&&soportes.length>=2;
  const showCompare=showCompareDocs||showCompareVer;
  const showAsist=!esModoResponsable()&&!esJurisdiccional()&&!esLibre&&!(esVistaActividadesDepto()&&taskPendienteVerificacion(t));
  const showEnviar=canAddSop&&!opts.hideEnviar;
  let h='<div style="margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px dashed var(--bd)">';
  h+='<div class="fx" style="justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px"><div style="font-size:12px;font-weight:600">📎 Soporte documental'+(soportes.length>1?' · '+soportes.length+' documento(s)':'')+'</div>';
  if(esLibre)h+='<span style="font-size:11px;color:var(--tx3)">'+escAttr(t.codigo||expId)+' · actividad sin expediente</span>';
  else h+='<button type="button" class="btn bsm" onclick="verConDesdeTaskModal(\''+escAttr(expId)+'\')">🔍 Consultar expediente</button>';
  h+='</div>';
  if(taskPendienteVerificacion(t)){
    const ent=getUltimaEntregaComentario(t);
    if(ent)h+=renderEntregaComentarioBoxHtml(ent,{pendiente:true});
  }
  if(hasSop){
    h+='<div class="soporte-doc-tabs">'+soportes.map((s,i)=>{
      const on=sel&&s.id===sel.id;
      const lbl=soporteTabLabel(s,i,soportes);
      return '<button type="button" class="soporte-doc-tab'+(on?' on':'')+'" onclick="selectTaskSoporte(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',\''+escAttr(s.id)+'\')">Ver '+escAttr(lbl)+'</button>';
    }).join('')+'</div>';
    if(sel){
      h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+
        '<span>'+escAttr(sel.label||'')+' · v'+sel.version+' · '+fmtF((sel.fecha||'').slice(0,10))+'</span>'+
        '<a href="'+escAttr(sel.url||sel.preview)+'" target="_blank" rel="noopener" style="font-size:11px">'+(sel.local?'Abrir adjunto':'Abrir en Drive')+'</a></div>';
    }
  }else{
    const ent=getUltimaEntregaComentario(t);
    if(!ent||!taskPendienteVerificacion(t)){
      h+='<div style="font-size:12px;color:var(--tx3);margin-bottom:6px">Sin enlace de soporte adjunto.</div>';
    }
  }
  h+='<div class="task-view-tabs">'+
    (showPqrsCompare?'<button type="button" class="task-view-tab on" data-tab="pqrscompare" onclick="setTaskViewTab(\'pqrscompare\');initPqrsSolRespCompareTab()">⇅ Solicitud / Respuesta</button>':'')+
    '<button type="button" class="task-view-tab'+((showPqrsCompare||showCompare)?'':' on')+'" data-tab="doc" onclick="setTaskViewTab(\'doc\')">📄 Documento</button>'+
    (showCompare?'<button type="button" class="task-view-tab'+(showCompareDocs&&!showPqrsCompare?' on':'')+'" data-tab="compare" onclick="setTaskViewTab(\'compare\');initCompareVersionesTab()">⇅ Comparar documentos</button>':'')+
    '<button type="button" class="task-view-tab" data-tab="exp" onclick="setTaskViewTab(\'exp\')">📋 Expediente</button>'+
    '<button type="button" class="task-view-tab" data-tab="links" onclick="setTaskViewTab(\'links\')">🔗 Enlaces</button>'+
    (showAsist?'<button type="button" class="task-view-tab" data-tab="asist" onclick="setTaskViewTab(\'asist\')">🤖 Asistente</button>':'')+
  '</div>';
  h+='<div id="task-view-pqrscompare" class="task-view-panel'+(showPqrsCompare?' on':'')+'">'+renderPqrsSolRespCompareShell(e,t)+'</div>';
  h+='<div id="task-view-doc" class="task-view-panel'+((showPqrsCompare||showCompare)?'':' on')+'">';
  if(sel&&soporteTieneVista(sel)){
    const notas=notasDocForSoporte(t,sel.id);
    const showDeptAnnotUi=!esModoResponsable()&&(canAnnot||canReviewSop);
    h+='<div class="soporte-annot-toolbar">'+
      (canAnnot?'<button type="button" class="btn bsm" id="btn-modo-marcar" onclick="toggleModoMarcarAnnot()">📍 Marcar en documento</button>':'')+
      (canAnnot?'<span style="font-size:11px;color:var(--tx3)">Seleccione cada documento arriba y agregue observaciones en todos los que requiera revisión</span>':'')+
      '</div>';
    if(showDeptAnnotUi){
      h+='<div class="soporte-annot-notice"><strong>Páginas:</strong> indique el número de página al marcar. Use el filtro lateral para ver marcadores de una hoja.</div>';
      h+='<div class="soporte-pagina-filter"><label>Ver marcadores: <select id="soporte-pagina-filter" onchange="setSoportePaginaFiltro(this.value)"><option value="all">Todas las páginas</option></select></label></div>';
    }
    h+='<div class="soporte-split">'+
      '<div>'+
        '<div class="soporte-annot-wrap annot-navigable" id="soporte-annot-wrap" data-exp="'+escAttr(expId)+'" data-task="'+escAttr(taskId)+'" data-sop="'+escAttr(sel.id)+'">'+
          renderSoporteEmbedHtml(sel)+
          '<div class="soporte-annot-overlay" id="soporte-annot-overlay"></div>'+
        '</div>'+
      '</div>'+
      '<div class="soporte-sidebar-col">'+
        '<div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--tx2)">Observaciones del documento</div>'+
        (canAnnot?renderAnnotPinFormHtml():'')+
        '<div class="soporte-annot-sidebar" id="soporte-annot-sidebar">'+renderAnnotSidebarHtml(notas,expId,taskId,sel.id,canAnnot)+'</div>'+
      '</div>'+
    '</div>';
  }else{
    h+='<div style="font-size:12px;color:var(--tx3);padding:8px">Adjunte un enlace Drive o un archivo PDF/imagen para visualizar el documento.</div>';
  }
  h+='</div>';
  h+='<div id="task-view-compare" class="task-view-panel'+(showCompareDocs&&!showPqrsCompare?' on':'')+'">'+renderCompareVersionesPanel(t,e,taskId)+'</div>';
  h+='<div id="task-view-exp" class="task-view-panel">'+(esLibre?'<div style="font-size:12px;color:var(--tx3);padding:8px">Actividad sin expediente — '+escAttr(t.codigo||expId)+'</div>':renderTaskExpConsultaEmbed(e))+'</div>';
  h+='<div id="task-view-links" class="task-view-panel">'+(esLibre?'<div style="font-size:12px;color:var(--tx3);padding:8px">Sin enlaces de expediente.</div>':renderExpEnlacesPanel(e,taskId))+'</div>';
  if(showAsist)h+='<div id="task-view-asist" class="task-view-panel">'+renderAsistenteRevisionPanel(expId,taskId,t)+'</div>';
  if(showEnviar)h+=renderEnviarPanelHtml(expId,taskId,t,'nuevaEntrega');
  else if(canAddSop&&opts.hideEnviar&&!opts.hideEntrega){
    h+='<div style="margin-top:.65rem;padding:.55rem;border:1px dashed var(--bd);border-radius:var(--r);background:var(--sf2)">'+
      '<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">Corrigió el documento según las observaciones — registre una <strong>nueva entrega</strong>.</div>'+
      '<button type="button" class="btn bsm bp" onclick="openEnviarSoporteModal(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\',\'nuevaEntrega\')">📤 Nueva entrega para verificación</button></div>';
  }
  h+='</div>';
  return h;
}
function initCompareVersionesTab(){
  const ctx=window._taskModalCtx||{};
  const e=getExpById(ctx.expId);
  const t=getTaskFromExp(e,ctx.taskId);
  const docs=collectDocsComparables(e,ctx.taskId,t);
  if(docs.length<2)return;
  const activo=t?getSoporteActivo(t):null;
  const latest=docs[docs.length-1];
  const prev=docs.length>=2?docs[docs.length-2]:docs[0];
  if(!window._compareDocA||!docs.some(d=>d.id===window._compareDocA)){
    window._compareDocA=activo?(docs.find(d=>d.soporteId===activo.id)||prev).id:prev.id;
  }
  if(!window._compareDocB||!docs.some(d=>d.id===window._compareDocB)){
    window._compareDocB=activo?(docs.find(d=>d.soporteId===activo.id)||latest).id:latest.id;
  }
  const sa=document.getElementById('compare-ver-a'),sb=document.getElementById('compare-ver-b');
  if(sa)sa.value=window._compareDocA;
  if(sb)sb.value=window._compareDocB;
  renderCompareVerStack(t,e);
}
function selectTaskSoporte(expId,taskId,sopId){
  window._taskSopSel=sopId;
  window._annotSelId=null;
  window._pendingAnnot=null;
  window._annotMarking=false;
  openTaskCommentsModal(expId,taskId);
}
function estadoTaskRaw(t){
  if(!t||t.eliminada)return'Eliminada';
  migrateLegacyAsignados(t);
  if(taskEsMultiAsignada(t)){
    const asig=t.asignados||[];
    const allAtendido=asig.every(a=>a.estado==='atendido');
    if(allAtendido)return'Atendida';
    const anyPorVer=asig.some(a=>a.estado==='por_verificar');
    if(anyPorVer)return'Por verificar';
    const anyPorCorr=asig.some(a=>a.estado==='por_corregir');
    if(anyPorCorr)return'Por corregir';
    const atendCount=asig.filter(a=>a.estado==='atendido').length;
    if(atendCount>0&&atendCount<asig.length)return'Parcial';
    if(t.vence&&t.vence<hoy()&&asig.some(a=>a.estado!=='atendido'))return'Vencida';
    return'En ejecución';
  }
  if(t.estado==='Por verificar'||(t.fechaReportada&&!t.fechaAtendida))return'Por verificar';
  if(t.fechaAtendida||t.estado==='Atendida'||t.estado==='Completada')return'Atendida';
  if(t.estado==='Por corregir'&&!t.fechaReportada&&!t.fechaAtendida)return'Por corregir';
  if(t.estado==='Vencida'||(t.vence&&t.vence<hoy()&&!t.fechaReportada&&!t.fechaAtendida&&t.estado!=='Por corregir'))return'Vencida';
  return'En ejecución';
}
function estadoTask(t){return estadoTaskRaw(normalizeTask(t));}
function taskPendienteVerificacion(t){
  t=normalizeTask(t);
  if(t.eliminada)return false;
  if(taskEsMultiAsignada(t))return (t.asignados||[]).some(a=>a.estado==='por_verificar');
  return!!t.fechaReportada&&!t.fechaAtendida;
}
function canDeptVerificarCierre(t){
  if(esModoResponsable()||esJurisdiccional())return false;
  t=normalizeTask(t);
  return!t.eliminada&&estadoTask(t)!=='Atendida'&&getTaskResponsables(t).length>0;
}
function renderTaskVerifyBarHtml(expId,taskId,t){
  const e=getExpById(expId);
  const esPqrs=taskEsAtenderPqrs(t,e);
  const pendVer=taskPendienteVerificacion(t);
  let h='<div class="task-cmt-form task-verify-bar task-chat-sep" style="padding:.65rem;border:1px solid var(--bl);border-radius:var(--r);background:var(--bll)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--bl)">✓ Cerrar actividad (verificación del departamento)</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">'+(taskEsMultiAsignada(t)&&t.entregaModo==='individual'?'Modo individual: al verificar se cierra la entrega pendiente del responsable que reportó. Los demás co-ejecutores siguen hasta completar su aporte.':'Modo unificado: al verificar se cierra la actividad para todos los co-ejecutores.')+
    (t.sinExpediente&&pendVer?' · Puede trasladar esta actividad sin expediente desde el panel de responsables arriba.':'')+'</div>';
  if(esPqrs){
    h+=htmlPqrsRespuestaDatosReadonly(e);
    if(!e._pqrs_respuesta_fecha){
      h+='<div style="font-size:11px;color:var(--or);margin-bottom:8px;padding:6px 8px;background:var(--orl);border-radius:var(--r)">El responsable debe registrar la fecha de respuesta al entregar la actividad. Devuelva la actividad si falta ese dato.</div>';
    }
    if(e._pqrs_solicitud_link||e._pqrs_solicitud_archivo){
      h+='<div style="font-size:12px;margin-bottom:8px;padding:6px 8px;background:var(--sf);border-radius:var(--r);border:1px solid var(--bd)"><strong>Solicitud radicada:</strong> <span class="fx" style="gap:6px;flex-wrap:wrap;display:inline-flex;vertical-align:middle">'+htmlPqrsDocumentoBtns(e)+'</span></div>';
    }
  }
  h+='<div class="fx" style="gap:8px;flex-wrap:wrap;align-items:center">'+
    '<label style="font-size:12px">Fecha cierre actividad <input type="date" id="task-verify-fecha" value="'+hoy()+'" style="padding:6px;border:1px solid var(--bd);border-radius:var(--r);margin-left:4px"></label>'+
    '<button type="button" class="btn bsm bp" onclick="confirmarCierreTask(\''+jsStr(expId)+'\',\''+jsStr(taskId)+'\')">✓ Confirmar actividad cerrada</button>';
  if(pendVer){
    h+='<button type="button" class="btn bsm bd2" onclick="devolverTaskAlResponsable(\''+jsStr(expId)+'\',\''+jsStr(taskId)+'\',\'Devuelta para corrección\')">↩ Devolver (por corregir)</button>';
  }
  h+='</div></div>';
  return h;
}
function confirmarCierreTask(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  const fechaEl=document.getElementById('task-verify-fecha');
  const fechaCierre=fechaEl?fechaEl.value:hoy();
  if(e&&t&&taskEsAtenderPqrs(t,e)&&!pqrsEstaCerrada(e)){
    const fechaResp=String(e._pqrs_respuesta_fecha||'').trim();
    if(!fechaResp){
      notif('Falta la fecha de respuesta — el responsable debe registrarla al entregar la actividad','err');
      return;
    }
    const oficioExt=String(e._pqrs_respuesta_oficio||'').trim();
    const nota=String(e._pqrs_respuesta_nota||'').trim();
    const medioResp=String(e._pqrs_respuesta_medio||'').trim();
    const links=[e._pqrs_respuesta_link].concat(e._pqrs_respuesta_links||[]).filter(Boolean);
    registrarPqrsRespuestaCore(e,{fechaResp,oficioExt,medioResp,nota,adj:{links,files:[]},archivos:[]});
    persistExpedienteGranular(e,false);
    verificarTaskExp(expId,taskId,fechaCierre);
    refreshPqrsDetalleViews(expId);
    if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
    return;
  }
  verificarTaskExp(expId,taskId,fechaCierre);
}
function estadoTaskLabel(t){
  const e=estadoTask(t);
  if(e==='En ejecución')return'Por ejecutar';
  if(e==='Parcial'){
    const rs=getTaskResponsables(t);
    const ok=(t.asignados||[]).filter(a=>a.estado==='atendido').length;
    return'Parcial ('+ok+'/'+rs.length+' atendidos)';
  }
  if(e==='Por verificar')return(esModoResponsable()&&!esVistaActividadesDepto())?'Por verificar':'Por revisar';
  return e;
}
function taskEstadoStyle(est){
  const e=est==='En ejecución'?'Por ejecutar':est;
  if(est==='Atendida')return{bg:'var(--gnl)',fg:'var(--gn)'};
  if(est==='Parcial')return{bg:'var(--aml)',fg:'var(--am)'};
  if(est==='Por verificar')return{bg:'var(--bll)',fg:'var(--bl)'};
  if(est==='Por corregir')return{bg:'var(--orl)',fg:'var(--or)'};
  if(est==='Vencida')return{bg:'var(--rdl)',fg:'var(--rd)'};
  if(est==='Eliminada')return{bg:'var(--sf2)',fg:'var(--tx3)'};
  return{bg:'var(--aml)',fg:'var(--am)'};
}
function getExpById(expId){return exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());}
function getTaskFromExp(e,taskId){
  if(!e||!taskId)return null;
  return (e.tasks||[]).map(normalizeTask).find(t=>t.id===taskId)||null;
}
function getTaskAny(expId,taskId){
  if(taskId){
    const lib=getActLibreById(taskId);
    if(lib)return normalizeActLibre(lib);
  }
  if(expId){
    const lc=getActLibreByCodigo(expId);
    if(lc)return normalizeActLibre(lc);
  }
  return getTaskFromExp(getExpById(expId),taskId);
}
function mutateTask(expId,taskId,fn){
  const lib=taskId?getActLibreById(taskId):null;
  if(lib){
    fn(normalizeActLibre(lib));
    try{persistExpLocal();}
    catch(e){
      if(isQuotaExceededError(e)){showStorageFullBanner();console.error('QuotaExceededError: almacenamiento local lleno; los datos NO se guardaron.',e);}
      else console.error('Error al guardar en localStorage:',e);
      return false;
    }
    updateSyncIndicator('syncing');
    Promise.all([saveGlobalFirestore()]).then(function(r){updateSyncIndicator(r.every(x=>x!==false)?'synced':'error');}).catch(function(){updateSyncIndicator('error');});
    refreshTaskViews();
    return true;
  }
  const e=getExpById(expId);if(!e)return false;
  e.tasks=(e.tasks||[]).map(normalizeTask);
  const t=e.tasks.find(x=>x.id===taskId);if(!t)return false;
  fn(t);
  t.estado=estadoTaskRaw(t);
  t.desc=(t.actividad||'')+(t.detalle?' - '+t.detalle:'');
  if(e._exp&&e._depto)persistExpedienteGranular(e,false);
  else{
    try{persistExpLocal();}
    catch(err){
      if(isQuotaExceededError(err)){showStorageFullBanner();console.error('QuotaExceededError: almacenamiento local lleno; los datos NO se guardaron.',err);}
      else console.error('Error al guardar en localStorage:',err);
      return false;
    }
    updateSyncIndicator('syncing');
    Promise.all([saveGlobalFirestore()]).then(function(r){updateSyncIndicator(r.every(x=>x!==false)?'synced':'error');}).catch(function(){updateSyncIndicator('error');});
  }
  refreshTaskViews();
  return true;
}
function refreshTaskViews(){
  updateVerifyBanner();
  if(document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('pg-agenda').classList.contains('on'))renderAgenda();
  if(document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  if(document.getElementById('pg-reg').classList.contains('on'))renderTabla();
  if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
  renderBandejaDepto();
}
function countPorVerificarAmbito(){
  const amb=expsAmbito();
  return amb.flatMap(e=>e.tasks||[]).filter(t=>!t.eliminada&&estadoTask(t)==='Por verificar').length;
}
function updateVerifyBanner(){
  const ban=document.getElementById('verify-banner');
  if(ban){ban.classList.remove('on');ban.innerHTML='';}
  renderBandejaDepto();
}
// RETENCION_LEIDOS_DIAS → js/constants.js
function diasDesdeIso(iso){
  if(!iso)return 0;
  const d=diffDias(String(iso).slice(0,10));
  if(d==='')return 0;
  return Math.max(0,-d);
}
function chatMensajeLeidoPorDestinatario(m){
  const rb=new Set((m.readBy||[]).map(chatNormKey));
  const destKeys=chatKeyAliases(m.toKey).map(chatNormKey);
  destKeys.push(chatNormKey(m.toKey));
  return destKeys.some(k=>rb.has(k));
}
function chatConvCompletamenteLeida(cid){
  const msgs=chatConvMessages(cid);
  return msgs.length>0&&msgs.every(chatMensajeLeidoPorDestinatario);
}
async function purgeChatConversacionesLeidas(){
  if(!document.body.classList.contains('sesion-activa'))return false;
  if(!Array.isArray(chatMensajes)||!chatMensajes.length)return false;
  const convIds=new Set();
  chatMensajes.forEach(m=>convIds.add(chatConvId(m.fromKey,m.toKey)));
  const dropMsgs=[];
  convIds.forEach(cid=>{
    if(!chatConvCompletamenteLeida(cid))return;
    const msgs=chatConvMessages(cid);
    const last=msgs[msgs.length-1];
    if(diasDesdeIso(last.ts||last.fecha)>=RETENCION_LEIDOS_DIAS)msgs.forEach(m=>dropMsgs.push(m));
  });
  if(!dropMsgs.length)return false;
  const dropIds=new Set(dropMsgs.map(m=>m.id));
  chatMensajes=chatMensajes.filter(m=>!dropIds.has(m.id));
  const db=window._db;
  if(db&&window._fsDeleteDoc&&window._fsDoc){
    try{
      for(let i=0;i<dropMsgs.length;i++){
        const m=dropMsgs[i];
        if(m.file&&m.file.fileId&&typeof chatDeleteDriveForMessage==='function'){
          await chatDeleteDriveForMessage(m);
        }
      }
      await Promise.all(dropMsgs.map(function(m){
        const convId=m.convId||chatConvId(m.fromKey,m.toKey);
        const fsConvId=chatConvFirestoreId(convId);
        return window._fsDeleteDoc(window._fsDoc(db,'chats',fsConvId,'mensajes',m.id));
      }));
    }catch(err){
      console.error('purgeChatConversacionesLeidas:',err);
      return false;
    }
  }
  return true;
}
function purgeBandejaLeidasAntiguas(){
  if(!document.body.classList.contains('sesion-activa'))return false;
  const leidos=getBandejaLeidos();
  if(!leidos.length)return false;
  const items=collectBandejaItems();
  if(!items.length)return false;
  const eliminados=new Set(getBandejaEliminados());
  let ch=false;
  items.forEach(it=>{
    const key=bandejaItemKey(it);
    if(!leidos.includes(key)||eliminados.has(key))return;
    if(diasDesdeIso(it.fecha)>=RETENCION_LEIDOS_DIAS){
      eliminados.add(key);
      ch=true;
    }
  });
  if(ch){
    try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify([...eliminados]));}catch(e){}
  }
  return ch;
}
function purgeRetencionDatosLeidos(){
  let ch=purgeChatConversacionesLeidas();
  if(purgeBandejaLeidasAntiguas())ch=true;
  if(typeof chatPurgeExpiredDriveFiles==='function'){
    void chatPurgeExpiredDriveFiles().then(function(ok){
      if(ok&&typeof renderChatMessages==='function'){renderChatMessages();renderChatContacts();}
    });
  }
  return ch;
}
function getBandejaLeidos(){try{return JSON.parse(localStorage.getItem('sst_bandeja_leidos')||'[]');}catch(e){return[];}}
function getBandejaEliminados(){try{return JSON.parse(localStorage.getItem('sst_bandeja_eliminados')||'[]');}catch(e){return[];}}
function markBandejaLeido(key){
  const s=new Set(getBandejaLeidos());s.add(key);
  try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify([...s]));}catch(e){}
}
function markBandejaNoLeido(key){
  const s=new Set(getBandejaLeidos());s.delete(key);
  try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify([...s]));}catch(e){}
}
function markBandejaEliminado(key){
  const s=new Set(getBandejaEliminados());s.add(key);
  try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify([...s]));}catch(e){}
}
function eliminarBandejaItemIdx(idx,ev){
  if(ev)ev.stopPropagation();
  const it=(window._bandejaItems||[])[idx];if(!it)return;
  confirmEliminar({message:'¿Eliminar este aviso de la bandeja?',detail:it.titulo||it.texto||''},()=>{
    markBandejaEliminado(bandejaItemKey(it));
    renderBandejaDepto();
  });
}
function bandejaItemDesktopText(it){
  if(!it)return'Nueva notificación';
  const tit=it.tipo==='comentario'?(it.autor+' · '+it.exp):
    it.tipo==='agenda'?(it.autor+' · Agenda'):
    it.tipo==='agenda_recordatorio'?(it.autor+' · Recordatorio agenda'):
    it.tipo==='auto_venc1'||it.tipo==='auto_venc3'?('Alerta · '+it.exp):
    it.tipo==='auto_exp80'?('Plazo expediente · '+it.exp):
    it.tipo==='obsdocumento'?(it.autor+' · '+it.exp):
    it.tipo==='notadoc'?(it.autor+' · '+it.exp):
    it.tipo==='devolucion'?('Departamento · '+it.exp):
    it.tipo==='sol_traslado'||it.tipo==='sol_eliminacion'?('Solicitud · '+it.exp):
    it.tipo==='pqrs_traslado'||it.tipo==='pqrs_fecha_sol'||it.tipo==='pqrs_aviso'?('PQRSD · '+it.exp):
    ((it.responsable||'')+' · '+(it.exp||''));
  const txt=it.tipo==='porverificar'?(it.texto||it.desc):it.texto;
  return String(tit||'').trim()+(txt?(' — '+String(txt).slice(0,100)):'');
}
function bandejaItemKey(it){
  if(it.tipo==='comentario')return 'c|'+it.exp+'|'+it.taskId+'|'+it.cidx+'|'+(it.fecha||'');
  if(it.tipo==='obsdocumento')return 'ndall|'+it.exp+'|'+it.taskId+'|'+(it.batch||'');
  if(it.tipo==='notadoc')return 'nd|'+it.exp+'|'+it.taskId+'|'+it.nidx+'|'+(it.fecha||'');
  if(it.tipo==='devolucion')return 'dv|'+it.exp+'|'+it.taskId+'|'+(it.fecha||'');
  if(it.tipo==='porverificar')return 'pv|'+it.exp+'|'+it.taskId+'|'+(it.batch||'');
  if(it.tipo==='agenda')return 'ag|'+it.agendaId;
  if(it.tipo==='agenda_recordatorio')return 'agr|'+it.agendaId+'|'+(it.fecha||'').slice(0,10);
  if(it.tipo==='auto_venc1')return 'av1|'+it.exp+'|'+it.taskId+'|'+(it.vence||'');
  if(it.tipo==='auto_venc3')return 'av3|'+it.exp+'|'+it.taskId+'|'+(it.fecha||'').slice(0,10);
  if(it.tipo==='auto_exp80')return 'ae80|'+it.exp+'|'+(it.fecha||'').slice(0,10);
  if(it.tipo==='sol_traslado')return 'st|'+it.exp+'|'+it.taskId+'|'+(it.fecha||'');
  if(it.tipo==='sol_eliminacion')return 'se|'+it.exp+'|'+it.taskId+'|'+(it.fecha||'');
  if(it.tipo==='pqrs_traslado')return 'pt|'+it.exp+'|'+(it.pqrsAvisoId||it.fecha||'');
  if(it.tipo==='pqrs_fecha_sol')return 'pfs|'+it.exp+'|'+(it.pqrsAvisoId||it.fecha||'');
  if(it.tipo==='pqrs_aviso')return 'pa|'+it.exp+'|'+(it.pqrsAvisoId||it.fecha||'');
  return 'p|'+it.exp+'|'+it.taskId+'|'+(it.fecha||'');
}
function collectAgendaReminderItems(){
  const items=[];
  const manana=addDaysDate(hoy(),1);
  const hoyStr=hoy();
  let eventos=[];
  if(esModoResponsable()&&responsableActivo){
    eventos=getAgendaEventosResponsable(responsableActivo,deptoActivo);
  }else if(!esJurisdiccional()&&!esModoCiudadano()&&!esModoResponsable()){
    const yo=getEncargadoDepto(deptoActivo)||responsableActivo||'';
    if(!yo)return items;
    eventos=(agendaEventos||[]).map(normalizeAgendaEvento).filter(ev=>{
      if(!agendaEventoVisible(ev))return false;
      if(ev.depto&&ev.depto!==deptoActivo&&ev.depto!=='responsables')return false;
      return agendaNorm(ev.responsable)===agendaNorm(yo);
    });
  }else return items;
  eventos.forEach(ev=>{
    if((ev.fecha||'').slice(0,10)!==manana)return;
    items.push({
      modo:esModoResponsable()?'resp':'depto',
      tipo:'agenda_recordatorio',
      agendaId:ev.id,
      fecha:hoyStr,
      autor:ev.creadoPor||'Agenda',
      texto:'📅 Recordatorio: mañana · '+ev.titulo+(ev.hora?' · '+ev.hora:'')+(ev.detalle?' — '+ev.detalle:''),
      desc:ev.tipo==='asignado'?'Evento asignado':'Evento personal'
    });
  });
  return items;
}
function collectAutoAlertItems(){
  const items=[];
  const hoyStr=hoy();
  function pushTaskAlerts(t,expRef,modo){
    t=normalizeTask(t);
    const est=estadoTask(t);
    if(t.eliminada||est==='Atendida'||est==='Eliminada')return;
    if(!t.vence)return;
    const d=diffDias(t.vence);
    const desc=t.desc||t.actividad||'Actividad';
    if(d===1){
      items.push({modo,tipo:'auto_venc1',exp:expRef,taskId:t.id,vence:t.vence,fecha:hoyStr,responsable:t.responsable||'',desc,texto:'⏰ Vence mañana ('+fmtF(t.vence)+') — '+desc});
    }
    if(d<=-3){
      const diasVenc=Math.abs(d);
      items.push({modo,tipo:'auto_venc3',exp:expRef,taskId:t.id,fecha:hoyStr,responsable:t.responsable||'',desc,texto:'🔴 Vencida hace '+diasVenc+' día(s) sin atender — '+desc});
    }
  }
  if(esModoResponsable()){
    if(!responsableActivo)return [];
    exps.forEach(e=>{
      (e.tasks||[]).forEach(t=>{
        t=normalizeTask(t);
        if(t.responsable!==responsableActivo)return;
        pushTaskAlerts(t,e._exp,'resp');
      });
    });
    (actividadesLibres||[]).forEach(t=>{
      t=normalizeActLibre(t);
      if(t.responsable!==responsableActivo)return;
      pushTaskAlerts(t,t.codigo,'resp');
    });
    return items;
  }
  if(esJurisdiccional())return [];
  exps.filter(e=>(e._depto||'guaviare')===deptoActivo).forEach(e=>{
    if(!expEnTramiteActivo(e))return;
    const ter=calcTerminos(e);
    if(!ter||ter.isFin)return;
    const tram=getTram(e._tramite,e);
    const alerta=Number(tram&&tram.alerta)||80;
    if(ter.pct>=alerta){
      items.push({
        modo:'depto',tipo:'auto_exp80',exp:e._exp,taskId:'',fecha:hoyStr,pct:ter.pct,
        responsable:'',desc:e._nombre||e._interesado||e._exp||'',
        texto:'⏰ Expediente '+e._exp+' al '+ter.pct+'% del plazo ('+ter.d+'/'+ter.plazo+' días) sin atender — '+(e._nombre||e._interesado||'')
      });
    }
  });
  return items;
}
function obsDocBatchId(t){
  const ultDev=(t.historial||[]).filter(h=>h.tipo==='ajuste_soporte').pop();
  return ultDev?(ultDev.ts?String(ultDev.ts):(ultDev.fecha||'')):'sin-devolucion';
}
function porVerificarBatchId(t){
  const hits=(t.historial||[]).filter(h=>h.tipo==='reenvio_verificacion');
  const ult=hits[hits.length-1];
  if(ult&&ult.ts)return String(ult.ts);
  if(ult)return (ult.fecha||'')+'-'+hits.length;
  return (t.fechaReportada||'sin-fecha')+'-s'+(t.soportes||[]).length;
}
function collectBandejaItems(){
  const items=[];
  if(esModoResponsable()){
    if(!responsableActivo)return [];
    exps.forEach(e=>{
      (e.tasks||[]).forEach(t=>{
        t=normalizeTask(t);
        if(t.eliminada||t.responsable!==responsableActivo)return;
        (t.comentarios||[]).forEach((c,ci)=>{
          if(c.incluidoEnReporte)return;
          if(c.rol==='asignador'||(!c.rol&&c.autor&&c.autor!==responsableActivo)){
            items.push({modo:'resp',tipo:'comentario',exp:e._exp,taskId:t.id,cidx:ci,fecha:c.fecha||'',autor:c.autor||'',texto:c.texto||'',desc:t.desc||t.actividad||'',responsable:t.responsable||''});
          }
        });
        const est=estadoTask(t);
        const obsRevisor=(t.notasDoc||[]).filter(n=>n.rol==='revisor');
        const ultDev=(t.historial||[]).filter(h=>h.tipo==='ajuste_soporte').pop();
        if(est==='Por corregir'&&ultDev){
          const batch=obsDocBatchId(t);
          const ultFecha=ultDev.fecha||obsRevisor.map(n=>n.fecha||'').sort().pop()||'';
          if(obsRevisor.length){
            items.push({
              modo:'resp',tipo:'obsdocumento',exp:e._exp,taskId:t.id,batch,
              fecha:ultFecha,
              autor:ultDev?(ultDev.por||'Departamento'):(obsRevisor[0].autor||'Departamento'),
              texto:obsRevisor.length+' observación(es) en el documento'+(ultDev?' — devuelto para corrección':'')+' — abra para revisar',
              desc:t.desc||t.actividad||'',responsable:t.responsable||''
            });
          }else{
            items.push({
              modo:'resp',tipo:'devolucion',exp:e._exp,taskId:t.id,
              fecha:ultFecha,batch:batch,
              autor:ultDev.por||'Departamento',
              texto:'Actividad devuelta para corrección'+(ultDev.nota?': '+ultDev.nota:''),
              desc:t.desc||t.actividad||'',responsable:t.responsable||''
            });
          }
        }
      });
    });
    (actividadesLibres||[]).forEach(t=>{
      t=normalizeActLibre(t);
      if(t.eliminada||t.responsable!==responsableActivo)return;
      (t.comentarios||[]).forEach((c,ci)=>{
        if(c.incluidoEnReporte)return;
        if(c.rol==='asignador'||(!c.rol&&c.autor&&c.autor!==responsableActivo)){
          items.push({modo:'resp',tipo:'comentario',exp:t.codigo,taskId:t.id,cidx:ci,fecha:c.fecha||'',autor:c.autor||'',texto:c.texto||'',desc:t.desc||t.actividad||'',responsable:t.responsable||''});
        }
      });
      const est=estadoTask(t);
      const obsRevisor=(t.notasDoc||[]).filter(n=>n.rol==='revisor');
      const ultDev=(t.historial||[]).filter(h=>h.tipo==='ajuste_soporte').pop();
      if(est==='Por corregir'&&ultDev){
        const batch=obsDocBatchId(t);
        const ultFecha=ultDev.fecha||obsRevisor.map(n=>n.fecha||'').sort().pop()||'';
        if(obsRevisor.length){
          items.push({modo:'resp',tipo:'obsdocumento',exp:t.codigo,taskId:t.id,batch,fecha:ultFecha,autor:ultDev?(ultDev.por||'Departamento'):(obsRevisor[0].autor||'Departamento'),texto:obsRevisor.length+' observación(es) en el documento — abra para revisar',desc:t.desc||t.actividad||'',responsable:t.responsable||''});
        }else{
          items.push({modo:'resp',tipo:'devolucion',exp:t.codigo,taskId:t.id,fecha:ultFecha,batch:batch,autor:ultDev.por||'Departamento',texto:'Actividad devuelta para corrección'+(ultDev.nota?': '+ultDev.nota:''),desc:t.desc||t.actividad||'',responsable:t.responsable||''});
        }
      }
    });
    (agendaEventos||[]).filter(ev=>ev.responsable===responsableActivo&&ev.tipo==='asignado'&&!ev.leido).forEach(ev=>{
      items.push({
        modo:'resp',tipo:'agenda',agendaId:ev.id,
        fecha:(ev.fecha||'').slice(0,10)||ev.creado||'',
        autor:ev.creadoPor||'Encargado del departamento',
        texto:'📅 '+ev.titulo+(ev.detalle?' — '+ev.detalle:'')+(ev.fecha?' · '+fmtF(ev.fecha):''),
        desc:'Evento de agenda asignado'
      });
    });
    collectAutoAlertItems().forEach(it=>items.push(it));
    collectAgendaReminderItems().forEach(it=>items.push(it));
    return items.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,80);
  }
  if(esJurisdiccional())return [];
  const amb=exps.filter(e=>(e._depto||'guaviare')===deptoActivo);
  amb.forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      t=normalizeTask(t);
      if(t.eliminada)return;
      (t.comentarios||[]).forEach((c,ci)=>{
        if(c.incluidoEnReporte)return;
        if(c.rol==='ejecutor'||(!c.rol&&c.autor&&getTaskResponsables(t).some(r=>agendaNorm(r)===agendaNorm(c.autor)))){
          items.push({modo:'depto',tipo:'comentario',exp:e._exp,taskId:t.id,cidx:ci,fecha:c.fecha||'',autor:c.autor||t.responsable||'',texto:c.texto||'',desc:t.desc||t.actividad||'',responsable:t.responsable||''});
        }
      });
      const sol=getTaskSolicitudPendiente(t);
      if(sol&&!taskEsAtenderPqrs(t,e)){
        items.push({
          modo:'depto',tipo:sol.tipo==='traslado'?'sol_traslado':'sol_eliminacion',exp:e._exp,taskId:t.id,
          fecha:(sol.fecha||'').slice(0,10)||hoy(),responsable:sol.por||'',desc:t.desc||t.actividad||'',
          texto:(sol.tipo==='traslado'?'↔ Solicitud de traslado':'🗑 Solicitud de eliminación')+' — '+sol.por+(sol.destino?' → '+sol.destino:'')+(sol.nota?' · '+sol.nota:'')
        });
      }
    });
  });
  getActividadesLibresDepto(deptoActivo).forEach(t=>{
    if(t.eliminada)return;
    (t.comentarios||[]).forEach((c,ci)=>{
      if(c.incluidoEnReporte)return;
      if(c.rol==='ejecutor'||(!c.rol&&c.autor&&getTaskResponsables(t).some(r=>agendaNorm(r)===agendaNorm(c.autor)))){
        items.push({modo:'depto',tipo:'comentario',exp:t.codigo,taskId:t.id,cidx:ci,fecha:c.fecha||'',autor:c.autor||t.responsable||'',texto:c.texto||'',desc:t.desc||t.actividad||'',responsable:t.responsable||''});
      }
    });
    const sol=getTaskSolicitudPendiente(t);
    if(sol){
      items.push({
        modo:'depto',tipo:sol.tipo==='traslado'?'sol_traslado':'sol_eliminacion',exp:t.codigo,taskId:t.id,
        fecha:(sol.fecha||'').slice(0,10)||hoy(),responsable:sol.por||'',desc:t.desc||t.actividad||'',
        texto:(sol.tipo==='traslado'?'↔ Solicitud de traslado':'🗑 Solicitud de eliminación')+' — '+sol.por+(sol.destino?' → '+sol.destino:'')+(sol.nota?' · '+sol.nota:'')
      });
    }
  });
  collectSolicitudesPqrsNcaItems().forEach(it=>items.push(it));
  collectPqrsOficinaBandejaItems().forEach(it=>items.push(it));
  collectAutoAlertItems().forEach(it=>items.push(it));
  collectAgendaReminderItems().forEach(it=>items.push(it));
  return items.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,80);
}
function setBandejaVista(v){
  window._bandejaVista=v||'pending';
  renderBandejaDepto();
}
function marcarBandejaLeidoIdx(idx,ev){
  if(ev)ev.stopPropagation();
  const it=(window._bandejaItems||[])[idx];if(!it)return;
  markBandejaLeido(bandejaItemKey(it));
  renderBandejaDepto();
}
function marcarBandejaNoLeidoIdx(idx,ev){
  if(ev)ev.stopPropagation();
  const it=(window._bandejaItems||[])[idx];if(!it)return;
  markBandejaNoLeido(bandejaItemKey(it));
  window._bandejaVista='pending';
  renderBandejaDepto();
}
function renderBandejaItemHtml(it,i,leidos,modoVista){
  const key=bandejaItemKey(it);
  const isUnread=!leidos.includes(key);
  const tag=it.tipo==='comentario'?'<span class="inbox-item-tag inbox-tag-cmt">Chat actividad</span>':
    it.tipo==='agenda'?'<span class="inbox-item-tag inbox-tag-cmt" style="background:var(--bll);color:var(--bl)">Agenda</span>':
    it.tipo==='agenda_recordatorio'?'<span class="inbox-item-tag inbox-tag-cmt" style="background:var(--gnl);color:var(--gn)">Agenda mañana</span>':
    it.tipo==='auto_venc1'?'<span class="inbox-item-tag inbox-tag-auto">Vence mañana</span>':
    it.tipo==='auto_venc3'?'<span class="inbox-item-tag inbox-tag-auto">Vencida +3 días</span>':
    it.tipo==='auto_exp80'?'<span class="inbox-item-tag inbox-tag-auto">Plazo 80%</span>':
    it.tipo==='obsdocumento'?'<span class="inbox-item-tag inbox-tag-ver">Obs. documento</span>':
    it.tipo==='notadoc'?'<span class="inbox-item-tag inbox-tag-cmt">Obs. documento</span>':
    it.tipo==='devolucion'?'<span class="inbox-item-tag inbox-tag-ver">Devolución</span>':
    it.tipo==='sol_traslado'?'<span class="inbox-item-tag inbox-tag-ver" style="background:var(--pul);color:var(--pu)">Solicitud traslado</span>':
    it.tipo==='sol_eliminacion'?'<span class="inbox-item-tag inbox-tag-ver" style="background:var(--rdl);color:var(--rd)">Solicitud eliminación</span>':
    it.tipo==='pqrs_traslado'?'<span class="inbox-item-tag inbox-tag-ver" style="background:var(--pul);color:var(--pu)">PQRSD trasladada</span>':
    it.tipo==='pqrs_fecha_sol'?'<span class="inbox-item-tag inbox-tag-ver" style="background:var(--bll);color:var(--bl)">Fecha solicitud</span>':
    it.tipo==='pqrs_aviso'?'<span class="inbox-item-tag inbox-tag-ver" style="background:var(--bll);color:var(--bl)">Aviso PQRSD</span>':
    '<span class="inbox-item-tag inbox-tag-ver">Reporte</span>';
  const tit=it.tipo==='comentario'?(it.autor+' · '+it.exp):
    it.tipo==='agenda'?(it.autor+' · Agenda'):
    it.tipo==='agenda_recordatorio'?(it.autor+' · Recordatorio agenda'):
    it.tipo==='auto_venc1'||it.tipo==='auto_venc3'?('Alerta · '+it.exp):
    it.tipo==='auto_exp80'?('Plazo expediente · '+it.exp):
    it.tipo==='obsdocumento'?(it.autor+' · '+it.exp+' · documento'):
    it.tipo==='notadoc'?(it.autor+' · '+it.exp+' · documento'):
    it.tipo==='devolucion'?('Departamento · '+it.exp):
    it.tipo==='sol_traslado'||it.tipo==='sol_eliminacion'?('Solicitud · '+it.exp):
    it.tipo==='pqrs_traslado'||it.tipo==='pqrs_fecha_sol'||it.tipo==='pqrs_aviso'?('PQRSD · '+it.exp):
    (it.responsable+' · '+it.exp);
  const txt=it.tipo==='porverificar'?(it.texto||it.desc):it.texto;
  const toggle=modoVista==='read'
    ?'<div class="inbox-item-actions">'+
      '<button type="button" class="inbox-toggle" title="Marcar no leído" onclick="marcarBandejaNoLeidoIdx('+i+',event)">📩</button></div>'
    :'<button type="button" class="inbox-toggle" title="Marcar leído" onclick="marcarBandejaLeidoIdx('+i+',event)">📭</button>';
  return '<div class="inbox-item-wrap'+(isUnread?' unread':' read')+'"><div class="inbox-item-card">'+
    '<button type="button" class="inbox-item" onclick="irDesdeBandeja('+i+')">'+tag+
    '<div class="inbox-item-meta">'+escAttr(tit)+' · '+fmtF((it.fecha||'').slice(0,10))+'</div>'+
    '<div class="inbox-item-txt">'+escAttr(String(txt).substring(0,140))+(String(txt).length>140?'…':'')+'</div></button>'+toggle+'</div></div>';
}
function renderBandejaDepto(){
  purgeBandejaLeidasAntiguas();
  const wrap=document.getElementById('depto-inbox-wrap');
  const badge=document.getElementById('depto-inbox-badge');
  const list=document.getElementById('depto-inbox-list');
  const hdr=document.querySelector('#depto-inbox-panel .inbox-panel-hdr');
  const tabP=document.getElementById('inbox-tab-pending');
  const tabR=document.getElementById('inbox-tab-read');
  const tabCnt=document.getElementById('inbox-pending-count');
  if(!wrap)return;
  const show=esModoCiudadano()?false:(esModoResponsable()?!!responsableActivo:!esJurisdiccional());
  wrap.style.display=show?'':'none';
  if(!show)return;
  if(hdr)hdr.textContent=esModoResponsable()?'Notificaciones del departamento':(esModoOficinaDeguv()||esOficinaPqrsNca()||esNcaDeguv())?'Notificaciones PQRSD':'Chat y solicitudes';
  const items=collectBandejaItems().filter(it=>!getBandejaEliminados().includes(bandejaItemKey(it)));
  const leidos=getBandejaLeidos();
  const unreadItems=items.filter(it=>!leidos.includes(bandejaItemKey(it)));
  const readItems=items.filter(it=>leidos.includes(bandejaItemKey(it)));
  const unread=unreadItems.length;
  const unreadKeys=unreadItems.map(bandejaItemKey);
  if(!window._bandejaNotifySeeded){
    window._bandejaUnreadKeysPrev=unreadKeys;
    window._bandejaNotifySeeded=true;
  }else if(typeof sstShowDesktopNotify==='function'){
    const panelOpen=!!(document.getElementById('depto-inbox-panel')&&document.getElementById('depto-inbox-panel').classList.contains('on'));
    const skip=panelOpen&&!document.hidden;
    const prev=window._bandejaUnreadKeysPrev||[];
    const newKeys=unreadKeys.filter(function(k){return !prev.includes(k);});
    if(!skip&&newKeys.length){
      const item=unreadItems.find(function(it){return bandejaItemKey(it)===newKeys[0];});
      if(item){
        sstShowDesktopNotify('CDA — Campanita',bandejaItemDesktopText(item),{
          tag:'bandeja-'+newKeys[0],
          onClick:function(){if(typeof toggleBandejaDepto==='function')toggleBandejaDepto();}
        });
      }
      if(newKeys.length>1){
        setTimeout(function(){
          sstShowDesktopNotify('CDA — Campanita',newKeys.length-1+' notificación(es) adicional(es)',{tag:'bandeja-batch-'+Date.now()});
        },600);
      }
    }
  }
  window._bandejaUnreadKeysPrev=unreadKeys;
  if(badge){
    if(unread>0){
      badge.textContent=unread;
      badge.classList.add('on');
      badge.style.background='var(--rd)';
    }else{
      badge.textContent='';
      badge.classList.remove('on');
    }
  }
  const vista=window._bandejaVista||'pending';
  if(tabP)tabP.classList.toggle('on',vista==='pending');
  if(tabR)tabR.classList.toggle('on',vista==='read');
  if(tabCnt)tabCnt.textContent=unread;
  if(!list)return;
  window._bandejaItems=items;
  const showItems=vista==='read'?readItems:unreadItems;
  if(!items.length){
    list.innerHTML='<div style="padding:1rem;font-size:12px;color:var(--tx3)">'+(esModoResponsable()?'Sin comentarios del departamento.':'Sin mensajes de chat ni solicitudes pendientes.')+'</div>';
    return;
  }
  if(!showItems.length){
    list.innerHTML='<div style="padding:1rem;font-size:12px;color:var(--tx3)">'+(vista==='read'?'No hay notificaciones leídas.':'No hay pendientes por leer.')+'</div>';
    return;
  }
  list.innerHTML=showItems.map(it=>{
    const i=items.indexOf(it);
    return renderBandejaItemHtml(it,i,leidos,vista);
  }).join('');
  if(typeof sstRenderGmailDriveStatusBtn==='function')sstRenderGmailDriveStatusBtn();
}
function toggleBandejaDepto(ev){
  if(ev)ev.stopPropagation();
  const p=document.getElementById('depto-inbox-panel');
  if(!p)return;
  const open=!p.classList.contains('on');
  p.classList.toggle('on',open);
  if(open)renderBandejaDepto();
}
function closeBandejaDepto(){
  const p=document.getElementById('depto-inbox-panel');if(p)p.classList.remove('on');
}
function abrirSeccionActividadesExp(taskId,abrirComentarios){
  const rootSel=getFormRootSel();
  document.querySelectorAll(rootSel+' details.form-section').forEach(d=>{
    const s=d.querySelector('summary');
    if(s&&/Actividades asignadas/i.test(s.textContent))d.open=true;
  });
  if(!taskId)return;
  setTimeout(()=>{
    const cont=getTkCont();
    const row=cont?Array.from(cont.querySelectorAll('.tkr-wrap')).find(r=>readTaskMeta(r).id===taskId):null;
    if(row){
      row.scrollIntoView({behavior:'smooth',block:'center'});
      row.style.outline='2px solid var(--bl)';
      row.style.borderRadius='6px';
      setTimeout(()=>{row.style.outline='';row.style.borderRadius='';},2800);
    }
    if(abrirComentarios&&(editId||window._conPanelActive))openTaskCommentsModal(editId||window._conPanelActive,taskId);
  },200);
}
function irDesdeBandeja(idx){
  const it=(window._bandejaItems||[])[idx];if(!it)return;
  markBandejaLeido(bandejaItemKey(it));
  closeBandejaDepto();
  if(esModoResponsable()){
    if(it.tipo==='agenda'||it.tipo==='agenda_recordatorio'){
      marcarAgendaLeido(it.agendaId);
      window._agendaDiaSel=(it.fecha||'').slice(0,10)||hoy();
      window._agendaSelEvId=it.agendaId;
      window._agendaVista=window._agendaVista||'mes';
      showTab('agenda');
      renderAgenda();
      const ev=getAgendaEventoById(it.agendaId);
      if(ev)agendaMostrarDrawerEvento(ev);
      renderBandejaDepto();
      return;
    }
    if(it.tipo==='auto_venc1'||it.tipo==='auto_venc3'){
      showTab('act');
      setTimeout(()=>{if(it.exp||it.taskId)openTaskCommentsModal(it.exp,it.taskId);},250);
      renderBandejaDepto();
      return;
    }
    if(responsableActivo&&(it.exp||it.taskId))openTaskCommentsModal(it.exp,it.taskId);
    showTab('act');
    setTimeout(()=>{if(it.exp||it.taskId)openTaskCommentsModal(it.exp,it.taskId);},250);
    renderBandejaDepto();
    return;
  }
  const e=getExpById(it.exp);
  if(!e&&getActLibreByCodigo(it.exp)){
    if(it.tipo==='porverificar'){
      showTab('act');
      setActFiltro('porver');
      setTimeout(()=>openTaskCommentsModal(it.exp,it.taskId),250);
    }else if(it.tipo==='sol_traslado'||it.tipo==='sol_eliminacion'){
      showTab('act');
      if(esVistaActividadesDepto())setActFiltro('porver');
      setTimeout(()=>openGestionSolicitudModal(it.exp,it.taskId),250);
    }else openTaskCommentsModal(it.exp,it.taskId,{focusChat:it.tipo==='comentario'});
    renderBandejaDepto();
    return;
  }
  if(e&&e._depto&&deptoActivo!==e._depto&&deptoActivo!=='jurisdiccional'&&deptoActivo!=='responsables'){
    deptoActivo=e._depto;
    const sel=document.getElementById('sel-depto');if(sel)sel.value=deptoActivo;
    setCfgPtr(e._depto);
    updateDeptoUI();
  }
  if(it.tipo==='auto_exp80'&&e){
    showTab('con');
    abrirConsultaExpPanel(it.exp);
    renderBandejaDepto();
    return;
  }
  if(!e)return;
  if(it.tipo==='porverificar'){
    showTab('act');
    setActFiltro('porver');
    setTimeout(()=>openTaskCommentsModal(it.exp,it.taskId),250);
    renderBandejaDepto();
    return;
  }
  if(it.tipo==='sol_traslado'||it.tipo==='sol_eliminacion'){
    showTab('act');
    if(esVistaActividadesDepto())setActFiltro('porver');
    setTimeout(()=>openGestionSolicitudModal(it.exp,it.taskId),250);
    renderBandejaDepto();
    return;
  }
  if(it.tipo==='pqrs_traslado'||it.tipo==='pqrs_fecha_sol'||it.tipo==='pqrs_aviso'){
    if(esModoOficinaDeguv()){
      openPqrsOficinaDetalle(it.exp);
      showTab('pqrs-ofi');
    }else if(esOficinaPqrsNca()||esNcaDeguv()){
      abrirConsultaExpPanel(it.exp,{allowSingle:true,edit:false});
    }else{
      openPqrsSidePanel(it.exp);
      if(esSecretaria())showTab('sec');
    }
    renderBandejaDepto();
    return;
  }
  if(it.tipo==='obsdocumento'){
    showTab('con');
    openTaskCommentsModal(it.exp,it.taskId,{focusChat:it.tipo==='comentario'});
    renderBandejaDepto();
    return;
  }
  if(it.tipo==='comentario'){
    openTaskCommentsModal(it.exp,it.taskId,{focusChat:true});
    renderBandejaDepto();
    return;
  }
  editarExp(it.exp);
  abrirSeccionActividadesExp(it.taskId,true);
  renderBandejaDepto();
}
function taskComentarioAutor(){
  if((esModoResponsable()||esVistaActividadesDepto())&&responsableActivo)return responsableActivo;
  return labelDepto(getDeptoOperativo())+' (asignador)';
}
function respMarcarPorVerificar(expId,taskId){
  if(esModoResponsable()&&!responsableActivo){notif('Seleccione su nombre como responsable','err');return;}
  if(esVistaActividadesDepto())ensureEncargadoActivo();
  let t=getTaskAny(expId,taskId);
  if(t&&t.sinExpediente)expId=t.codigo;
  if(!t){notif('Actividad no encontrada','err');return;}
  const esEncOwn=esTareaDelEncargado(t);
  if(esModoResponsable()&&!taskUsuarioEsAsignado(t,responsableActivo)){notif('Actividad no asignada a usted','err');return;}
  if(esModoResponsable()&&!puedeReportarTask(t,responsableActivo)&&estadoTaskForAsignado(t,responsableActivo)!=='Por verificar'){notif('No puede reportar esta actividad en su estado actual','err');return;}
  if(estadoTask(t)==='Atendida'){notif('La actividad ya está finalizada','err');return;}
  if(esEncOwn){
    const ePqrs=getExpById(expId);
    const tPqrs=ePqrs?getTaskFromExp(ePqrs,taskId):t;
    if(ePqrs&&tPqrs&&taskEsAtenderPqrs(tPqrs,ePqrs)&&puedeMarcarPqrsRespondida(ePqrs)){
      openPqrsRespuestaModal(expId);
      return;
    }
    openFinalizarEncargadoModal(expId,taskId);
    return;
  }
  const modo=resolveModoEnviar(t,null);
  openEnviarSoporteModal(expId,taskId,modo);
}
function finalizarTaskEncargado(expId,taskId,linksOpt,comentarioOpt,archivosOpt,pqrsOpts){
  if(esVistaActividadesDepto())ensureEncargadoActivo();
  let t=getTaskAny(expId,taskId);
  if(t&&t.sinExpediente)expId=t.codigo;
  if(!t||!esTareaDelEncargado(t)){notif('Solo el encargado puede finalizar esta actividad directamente','err');return false;}
  const links=(Array.isArray(linksOpt)?linksOpt:[]).map(u=>String(u||'').trim()).filter(Boolean);
  const archivos=Array.isArray(archivosOpt)?archivosOpt:(archivosOpt?[archivosOpt]:[]);
  const cmt=String(comentarioOpt||'').trim();
  const parsedLinks=[];
  for(const link of links){
    const parsed=parseDrivePreviewUrl(link);
    if(!parsed.valid){notif('Enlace no válido: '+link.slice(0,60),'err');return false;}
    parsedLinks.push(parsed);
  }
  const ok=mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    const loteId='lot_'+Date.now();
    if(parsedLinks.length||archivos.some(a=>a&&a.data))t.soportes.forEach(s=>{s.activo=false;});
    let linkNum=0,fileNum=0;
    parsedLinks.forEach(parsed=>{
      linkNum++;
      const version=t.soportes.length+1;
      t.soportes.push({
        id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        url:parsed.url,preview:parsed.preview,label:'Link '+linkNum,
        fecha:new Date().toISOString(),autor:taskComentarioAutor(),
        version,activo:true,loteEntrega:loteId,local:false
      });
    });
    archivos.forEach(archivoOpt=>{
      if(!archivoOpt||!archivoOpt.data)return;
      fileNum++;
      const version=t.soportes.length+1;
      const isPdf=archivoOpt.tipo==='application/pdf'||/\.pdf$/i.test(archivoOpt.nombre||'');
      const isImg=archivoOpt.tipo&&archivoOpt.tipo.startsWith('image/');
      const isVid=archivoOpt.tipo&&archivoOpt.tipo.startsWith('video/');
      const canPreview=isPdf||isImg||isVid;
      t.soportes.push({
        id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        url:archivoOpt.data,preview:canPreview?archivoOpt.data:'',
        label:archivoOpt.nombre||('Documento '+fileNum),
        fecha:new Date().toISOString(),autor:taskComentarioAutor(),
        version,activo:true,local:true,tipo:archivoOpt.tipo||'',loteEntrega:loteId
      });
    });
    if(cmt){
      t.comentarios.push({autor:taskComentarioAutor(),fecha:new Date().toISOString(),texto:cmt,rol:'ejecutor',incluidoEnReporte:true});
    }
    const hoyStr=hoy();
    t.fechaReportada=hoyStr;
    t.fechaAtendida=hoyStr;
    t.estado='Atendida';
    t.verificadoPor=taskComentarioAutor()+' · finalización directa (encargado)';
    t.historial.push({tipo:'cierre_encargado',fecha:hoyStr,ts:Date.now(),por:taskComentarioAutor(),nota:cmt||'Actividad finalizada por encargado del departamento'});
  });
  if(ok&&pqrsOpts){
    const e=getExpById(expId);
    if(e&&taskEsAtenderPqrs(getTaskFromExp(e,taskId),e)){
      if(!pqrsOpts.adj)pqrsOpts.adj={links:[],files:[]};
      if(!pqrsOpts.adj.links.length){
        const t2=getTaskFromExp(e,taskId);
        const activo=getSoporteActivo(t2);
        if(activo&&(activo.url||activo.preview)&&!activo.local)pqrsOpts.adj.links=[activo.url||activo.preview];
      }
      registrarPqrsRespuestaCore(e,{fechaResp:pqrsOpts.fechaResp,oficioExt:pqrsOpts.oficioExt,nota:cmt,adj:pqrsOpts.adj});
      persistExpedienteGranular(e,false);
    }
  }
  if(ok)notif('Actividad finalizada','ok');
  return ok;
}
function openFinalizarEncargadoModal(expId,taskId){
  let t=getTaskAny(expId,taskId);
  if(t&&t.sinExpediente)expId=t.codigo;
  if(!t)return;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Finalizar actividad · '+(t.codigo||expId);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const est=estadoTask(t),st=taskEstadoStyle(est);
  body.innerHTML='<div style="margin-bottom:.75rem"><span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+estadoTaskLabel(t)+'</span></div>'+
    '<div style="font-size:13px;margin-bottom:.75rem">'+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
    renderEnviarPanelHtml(expId,taskId,t,'finalizarEncargado');
  ov.classList.add('on');
  window._taskModalCtx={expId,taskId,mode:'finalizarEnc',actLibre:!!t.sinExpediente};
}
function submitFinalizarEncargado(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  let pqrsOpts=null;
  if(e&&t&&taskEsAtenderPqrs(t,e)){
    pqrsOpts=collectPqrsEntregaDatos(expId);
    if(!pqrsOpts)return;
  }
  const adj=collectEnviarAdjuntos();
  const cmt=(document.getElementById('enviar-cmt-opcional')||{}).value;
  const run=function(){
    if(finalizarTaskEncargado(expId,taskId,adj.links,cmt,[],pqrsOpts))closeTaskModal();
  };
  if(adj.files&&adj.files.length){
    (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
      if(ok)run();
    });
    return;
  }
  run();
}
function verificarTaskExp(expId,taskId,fecha){
  if(esModoResponsable()){notif('Solo el departamento puede verificar','err');return;}
  let t=getTaskFromExp(getExpById(expId),taskId);
  if(!t){t=normalizeActLibre(getActLibreById(taskId));if(t)expId=t.codigo;}
  if(!t||!canDeptVerificarCierre(t)){notif('No puede cerrar esta actividad','err');return;}
  const doVerify=function(){
    if(mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    const fechaC=fecha||hoy();
    const repPend=getUltimoReportadoPor(t);
    if(taskEsMultiAsignada(t)&&t.entregaModo==='individual'){
      (t.asignados||[]).filter(a=>a.estado==='por_verificar').forEach(a=>{
        a.estado='atendido';
        a.fechaAtendida=fechaC;
      });
    }else{
      (t.asignados||[]).forEach(a=>{
        if(a.estado!=='atendido'){
          a.estado='atendido';
          a.fechaAtendida=fechaC;
          if(!a.fechaReportada)a.fechaReportada=fechaC;
        }
      });
      t.fechaReportada=t.fechaReportada||fechaC;
      t.fechaAtendida=fechaC;
      t.estado='Atendida';
    }
    syncTaskAggregateState(t);
    if(!t.fechaReportada)t.fechaReportada=fechaC;
    t.verificadoPor=taskComentarioAutor()+' · '+new Date().toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit'});
    t.ultimaRevisionDepto={tipo:'aprobada',fecha:fechaC,ts:Date.now(),por:taskComentarioAutor(),nota:repPend?('Aprobada — '+repPend):'Actividad aprobada y cerrada'};
    t.historial.push({tipo:'verificacion',fecha:fechaC,ts:Date.now(),por:taskComentarioAutor(),nota:repPend?('Aprobada entrega de '+repPend):'Actividad aprobada y cerrada',reportadoPor:repPend||''});
  })){
      notif('Actividad verificada y cerrada','ok');
      const expRec=getExpById(expId);
      if(expRec&&esPqrsSecretaria(expRec)){
        refreshPqrsDetalleViews(expId);
        renderSecretariaPqrs();
        renderPqrsOficinaInbox();
        if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
      }
      closeTaskModal();
      if(window._conPanelEditMode&&document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')&&window._conPanelActive===expId){
        renderConSidePanel();
      }else if(editId===expId){
        const e=getExpById(expId);
        if(e){setCfgPtr(e._depto||getDeptoOperativo());renderFormulario(e._tramite,e,'con-side-form-wrap');}
      }
    }
  };
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    driveRenombrarSoporteActivoExp(expId,taskId,'aprobado').then(function(){doVerify();}).catch(function(){doVerify();});
  }else doVerify();
}
function addTaskComentario(expId,taskId,texto){
  const txt=String(texto||'').trim();if(!txt)return false;
  return mutateTask(expId,taskId,t=>{
    t.comentarios.push({autor:taskComentarioAutor(),fecha:new Date().toISOString(),texto:txt,rol:esModoResponsable()?'ejecutor':'asignador'});
  });
}
function trasladarTaskExp(expId,taskId,nuevoResp,opts){
  opts=opts||{};
  const nr=String(nuevoResp||'').trim();if(!nr)return false;
  return mutateTask(expId,taskId,t=>{
    normalizeTask(t);
    if(opts.anadir){
      ensureAsignado(t,nr);
      t.historial.push({tipo:'asignacion_extra',fecha:hoy(),a:nr,por:taskComentarioAutor()});
    }else{
      const anterior=t.responsable||'';
      t.responsable=nr;
      t.reporteTrasladado=true;
      if(taskEsMultiAsignada(t)||(t.responsables||[]).length){
        const rs=t.responsables||[];
        const idx=rs.findIndex(r=>agendaNorm(r)===agendaNorm(anterior));
        if(idx>=0)rs[idx]=nr;else rs.unshift(nr);
        t.responsables=rs;
        t.asignados=(t.asignados||[]).map(a=>agendaNorm(a.nombre)===agendaNorm(anterior)?{...a,nombre:nr,estado:a.estado==='atendido'?a.estado:'pendiente',fechaReportada:'',fechaAtendida:''}:a);
        ensureAsignado(t,nr);
      }else{
        t.responsables=[nr];
        t.asignados=[{nombre:nr,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}];
      }
      t.historial.push({tipo:'traslado',fecha:hoy(),de:anterior,a:nr,por:taskComentarioAutor()});
    }
    if(estadoTask(t)==='Por verificar'||estadoTask(t)==='Por corregir'){
      t.fechaReportada='';
      (t.asignados||[]).forEach(a=>{
        if(a.estado==='por_verificar'||a.estado==='por_corregir'){a.fechaReportada='';a.estado='pendiente';}
      });
    }
    syncTaskAggregateState(t);
  });
}
function anadirResponsableTask(expId,taskId,nombre,entregaModo){
  const n=String(nombre||'').trim();if(!n)return false;
  return mutateTask(expId,taskId,t=>{
    ensureAsignado(t,n);
    if(getTaskResponsables(t).length>1){
      if(entregaModo)t.entregaModo=entregaModo==='unificada'?'unificada':'individual';
      else if(!t.entregaModo)t.entregaModo='individual';
    }
    t.historial.push({tipo:'asignacion_extra',fecha:hoy(),a:n,por:taskComentarioAutor()});
    syncTaskAggregateState(t);
  });
}
function cambiarEntregaModoTask(expId,taskId,modo){
  const ctx=window._taskModalCtx||{};
  if(ctx.formRowEl){
    const row=ctx.formRowEl;
    const meta=readTaskMeta(row);
    meta.entregaModo=modo==='unificada'?'unificada':'individual';
    writeTaskMeta(row,meta);
    const modoSel=row.querySelector('.tk-coej-modo');
    if(modoSel)modoSel.value=meta.entregaModo;
    notif('Modo de entrega actualizado','ok');
    openTaskCoEjRowModal(row);
    return;
  }
  if(mutateTask(expId,taskId,t=>{
    t.entregaModo=modo==='unificada'?'unificada':'individual';
    syncTaskAggregateState(t);
  })){
    notif('Modo de entrega actualizado','ok');
    if(ctx.gestionAsignados||ctx.soloCoEj)openTaskCommentsModal(expId,taskId,{gestionAsignados:true});
    else openTaskCommentsModal(expId,taskId);
    if(isFormExpVisible(expId))syncTkRowsFromExp(expId,taskId);
  }
}
function toggleTaskAsigModo(){
  const wrap=document.getElementById('task-asig-modo-wrap');
  if(!wrap)return;
  const addSel=document.getElementById('task-asig-add-sel');
  const ctx=window._taskModalCtx||{};
  let rsCount=0;
  if(ctx.formRowEl)rsCount=getTaskResponsables(buildTaskFromRow(ctx.formRowEl)).length;
  else if(ctx.taskId||ctx.expId){
    const t=getTaskAny(ctx.expId,ctx.taskId);
    if(t)rsCount=getTaskResponsables(t).length;
  }
  wrap.style.display=(rsCount>1||(addSel&&addSel.value))?'':'none';
}
function submitAnadirResponsableTask(expId,taskId){
  const sel=document.getElementById('task-asig-add-sel');
  const v=sel?sel.value:'';
  if(!v){notif('Seleccione responsable','err');return;}
  const modoEl=document.getElementById('task-asig-modo');
  const entregaModo=modoEl?modoEl.value:'individual';
  const ctx=window._taskModalCtx||{};
  if(ctx.formRowEl){
    const row=ctx.formRowEl;
    const t=buildTaskFromRow(row);
    ensureAsignado(t,v);
    if(getTaskResponsables(t).length>1)t.entregaModo=entregaModo;
    t.historial.push({tipo:'asignacion_extra',fecha:hoy(),a:v,por:taskComentarioAutor()});
    syncTaskAggregateState(t);
    persistTaskToRow(row,t);
    notif('Co-ejecutor añadido','ok');
    openTaskCoEjRowModal(row);
    return;
  }
  if(anadirResponsableTask(expId,taskId,v,entregaModo)){
    notif('Co-ejecutor añadido','ok');
    openTaskCommentsModal(expId,taskId,{gestionAsignados:true});
    if(isFormExpVisible(expId))syncTkRowsFromExp(expId,taskId);
  }
}
function submitTrasladoTaskModal(expId,taskId){
  const sel=document.getElementById('task-asig-traslado-sel');
  const v=sel?sel.value:'';
  if(!v){notif('Seleccione responsable','err');return;}
  if(trasladarTaskExp(expId,taskId,v)){
    notif('Actividad trasladada a '+v,'ok');
    openTaskCommentsModal(expId,taskId);
  }
}
function openTaskAsignadosFoot(btn){
  const row=btn.closest('.tkr-wrap');
  if(!row)return;
  const meta=readTaskMeta(row);
  const expId=editId||window._conPanelActive;
  if(expId&&meta.id&&getTaskAny(expId,meta.id)){
    openTaskCommentsModal(expId,meta.id,{gestionAsignados:true});
    return;
  }
  openTaskCoEjRowModal(row);
}
function buildTaskFromRow(row){
  if(!row)return normalizeTask({});
  const meta=readTaskMeta(row);
  const tr=row.querySelector('.tr');
  const ta=row.querySelector('.ta'),td=row.querySelector('.td'),tp=row.querySelector('.tp'),tv=row.querySelector('.tv'),tfa=row.querySelector('.tfa');
  const t=normalizeTask({
    id:meta.id||genTaskId(),
    actividad:ta?ta.value.trim():'',
    detalle:td?td.value.trim():'',
    responsable:tr?tr.value:'',
    responsables:(meta.responsables||[]).slice(),
    asignados:(meta.asignados||[]).slice(),
    entregaModo:meta.entregaModo||'individual',
    comentarios:meta.comentarios||[],
    historial:meta.historial||[],
    soportes:meta.soportes||[],
    notasDoc:meta.notasDoc||[],
    fechaReportada:meta.fechaReportada||'',
    verificadoPor:meta.verificadoPor||'',
    eliminada:!!meta.eliminada,
    prioritaria:!!(row.querySelector('.tprior')&&row.querySelector('.tprior').checked)||!!meta.prioritaria,
    plazoDias:tp?tp.value:'',
    vence:tv?tv.value:'',
    fechaAtendida:tfa?tfa.value:''
  });
  if(tr&&tr.value){
    if(!t.responsables.length)t.responsables=[tr.value];
    else if(!t.responsables.some(r=>agendaNorm(r)===agendaNorm(tr.value)))t.responsables.unshift(tr.value);
    else{t.responsables=t.responsables.filter(r=>agendaNorm(r)!==agendaNorm(tr.value));t.responsables.unshift(tr.value);}
    t.responsable=tr.value;
  }
  return t;
}
function persistTaskToRow(row,t){
  if(!row||!t)return;
  t=normalizeTask(t);
  const meta=readTaskMeta(row);
  const tr=row.querySelector('.tr');
  if(tr&&t.responsables.length)tr.value=t.responsables[0];
  writeTaskMeta(row,{
    ...meta,
    id:t.id,
    responsables:t.responsables,
    asignados:t.asignados,
    entregaModo:t.entregaModo||'individual',
    historial:t.historial,
    comentarios:t.comentarios,
    soportes:t.soportes,
    notasDoc:t.notasDoc,
    fechaReportada:t.fechaReportada,
    verificadoPor:t.verificadoPor,
    eliminada:!!t.eliminada,
    prioritaria:!!t.prioritaria
  });
  const tagsEl=row.querySelector('.tk-asig-tags');
  if(tagsEl)tagsEl.innerHTML=renderTkAsigTags(t);
  refreshTkCoEjPanel(row);
}
function renderTkCoEjPanelHtml(data){
  const deptoId=getDeptoOperativo();
  const m=normalizeTask(data||{});
  const rs=getTaskResponsables(m);
  const primary=rs[0]||m.responsable||'';
  const names=getContratistasAsignables(deptoId);
  rs.forEach(n=>{if(n&&!names.some(x=>agendaNorm(x)===agendaNorm(n)))names.push(n);});
  const extras=names.filter(n=>!primary||agendaNorm(n)!==agendaNorm(primary));
  const checks=extras.length?extras.map(n=>{
    const checked=rs.some(r=>agendaNorm(r)===agendaNorm(n));
    return '<label class="act-libre-resp-row"><span class="act-libre-resp-nom">'+escAttr(n)+'</span><input type="checkbox" class="tk-coej-cb" value="'+escAttr(n)+'"'+(checked?' checked':'')+' onchange="syncTkCoEjPanelFromCheckboxes(this)"></label>';
  }).join(''):'<div style="padding:10px;font-size:12px;color:var(--tx3)">No hay otros responsables configurados.</div>';
  const multi=rs.length>1;
  return '<div class="tk-coej-panel" style="display:none">'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:4px">👥 Co-ejecutores adicionales'+(primary?' (principal: '+escAttr(primary)+')':'')+'</div>'+
    '<div class="act-libre-resps-box">'+checks+'</div>'+
    '<div class="tk-coej-modo-wrap" style="'+(multi?'':'display:none')+'">'+
    '<label style="font-size:11px;font-weight:600;color:var(--tx2);display:block;margin-top:6px">Modo de entrega (varios responsables)</label>'+
    '<select class="tk-coej-modo" style="width:100%;max-width:420px;padding:6px;margin-top:4px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px" onchange="syncTkCoEjModoSel(this)">'+
    '<option value="individual"'+(m.entregaModo!=='unificada'?' selected':'')+'>Individual — cada uno entrega por aparte</option>'+
    '<option value="unificada"'+(m.entregaModo==='unificada'?' selected':'')+'>Unificada — con una entrega se cierra para todos</option>'+
    '</select></div></div>';
}
function refreshTkCoEjPanel(row){
  if(!row)return;
  const panel=row.querySelector('.tk-coej-panel');
  if(!panel)return;
  const open=panel.style.display!=='none';
  const t=buildTaskFromRow(row);
  panel.outerHTML=renderTkCoEjPanelHtml(t);
  const np=row.querySelector('.tk-coej-panel');
  if(np&&open)np.style.display='';
}
function gestionarCoEjTask(btn){
  const row=btn.closest('.tkr-wrap');
  if(!row)return;
  const meta=readTaskMeta(row);
  const expId=editId||window._conPanelActive;
  if(expId&&meta.id&&getTaskAny(expId,meta.id)){
    openTaskCommentsModal(expId,meta.id,{gestionAsignados:true});
    return;
  }
  toggleTkCoEjPanel(btn);
}
function toggleTkCoEjPanel(btn){
  const row=btn.closest('.tkr-wrap');
  if(!row)return;
  let panel=row.querySelector('.tk-coej-panel');
  if(!panel){
    const tagsEl=row.querySelector('.tk-asig-tags');
    const html=renderTkCoEjPanelHtml(buildTaskFromRow(row));
    if(tagsEl)tagsEl.insertAdjacentHTML('afterend',html);
    else row.insertAdjacentHTML('beforeend',html);
    panel=row.querySelector('.tk-coej-panel');
  }
  if(!panel){notif('No se pudo abrir co-ejecutores en esta fila','err');return;}
  const show=panel.style.display==='none'||!panel.style.display;
  panel.style.display=show?'':'none';
  if(show)refreshTkCoEjPanel(row);
}
function syncTkCoEjModoSel(sel){
  const row=sel.closest('.tkr-wrap');
  if(!row)return;
  const meta=readTaskMeta(row);
  meta.entregaModo=sel.value==='unificada'?'unificada':'individual';
  writeTaskMeta(row,meta);
}
function syncTkCoEjPanelFromCheckboxes(cb){
  const row=cb.closest('.tkr-wrap');
  if(!row)return;
  const tr=row.querySelector('.tr');
  const primary=tr?tr.value.trim():'';
  const extras=[...row.querySelectorAll('.tk-coej-cb:checked')].map(el=>el.value.trim()).filter(Boolean);
  const responsables=primary?[primary,...extras.filter(n=>agendaNorm(n)!==agendaNorm(primary))]:extras.slice();
  const meta=readTaskMeta(row);
  const prevAsig=meta.asignados||[];
  meta.responsables=responsables;
  meta.asignados=responsables.map(n=>{
    const ex=prevAsig.find(a=>agendaNorm(a.nombre)===agendaNorm(n));
    return ex||{nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'};
  });
  if(responsables.length>1&&!meta.entregaModo)meta.entregaModo='individual';
  if(responsables.length<=1)meta.entregaModo='individual';
  writeTaskMeta(row,meta);
  const modoWrap=row.querySelector('.tk-coej-modo-wrap');
  if(modoWrap)modoWrap.style.display=responsables.length>1?'':'none';
  const tagsEl=row.querySelector('.tk-asig-tags');
  if(tagsEl)tagsEl.innerHTML=renderTkAsigTags({...meta,responsables,asignados:meta.asignados,entregaModo:meta.entregaModo});
}
function syncTkTrCoEj(sel){
  const row=sel.closest('.tkr-wrap');
  if(!row)return;
  row.querySelectorAll('.tk-coej-cb').forEach(cb=>{
    if(agendaNorm(cb.value)===agendaNorm(sel.value))cb.checked=false;
  });
  syncTkCoEjPanelFromCheckboxes(sel);
}
function openTaskCoEjRowModal(row){
  if(!row)return;
  const t=buildTaskFromRow(row);
  if(!t.id){t.id=genTaskId();writeTaskMeta(row,{...readTaskMeta(row),id:t.id});}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Co-ejecutores · actividad del expediente';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Añada co-ejecutores y defina si la entrega es individual o unificada. Los cambios se aplican al guardar el expediente.</div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
    renderTaskAsignadosPanelHtml('',t.id,t,!esModoResponsable()&&!esJurisdiccional())+
    '<div style="margin-top:10px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={formRowEl:row,taskId:t.id,gestionAsignados:true,soloCoEj:true};
  toggleTaskAsigModo();
}
function openTaskAsignadosModal(expId,taskId){
  openTaskCommentsModal(expId,taskId,{gestionAsignados:true});
}
function renderTkAsigTags(data){
  const t=normalizeTask(data||{});
  const rs=getTaskResponsables(t);
  if(rs.length<=1)return'';
  return rs.map(n=>{
    const st=estadoTaskForAsignado(t,n);
    const cls=st==='Atendida'?'done':st==='Por verificar'?'pv':st==='Por corregir'?'pc':'';
    return '<span class="tk-asig-tag '+cls+'">'+taskAsignadoEstadoIcon(st)+' '+escAttr(n)+'</span>';
  }).join('');
}
function eliminarTaskExp(expId,taskId,nota){
  const e=getExpById(expId);
  let t=getTaskFromExp(e,taskId);
  if(!t){t=getActLibreById(taskId)||getActLibreByCodigo(expId);}
  if(t&&typeof drivePurgeTaskInstitutionalSoportes==='function'){
    drivePurgeTaskInstitutionalSoportes(t).catch(function(err){console.warn('purge drive task:',err);});
  }
  return mutateTask(expId,taskId,t=>{
    t.eliminada=true;
    t.historial.push({tipo:'eliminacion',fecha:hoy(),por:taskComentarioAutor(),nota:nota||''});
  });
}
function restaurarTaskExp(expId,taskId){
  return mutateTask(expId,taskId,t=>{
    t.eliminada=false;
    t.historial.push({tipo:'restauracion',fecha:hoy(),por:taskComentarioAutor()});
  });
}
function openTaskCommentsChatOnly(expId,taskId){
  openTaskCommentsModal(expId,taskId,{chatOnly:true});
}
function openTaskCommentsModal(expId,taskId,opts){
  opts=typeof opts==='object'&&opts?opts:{};
  const chatOnly=!!opts.chatOnly;
  const soloGestion=!!opts.gestionAsignados;
  let e=getExpById(expId),t=getTaskFromExp(e,taskId);
  if(!t){
    t=getActLibreById(taskId)||getActLibreByCodigo(expId);
    if(t){t=normalizeActLibre(t);expId=t.codigo;e=null;}
  }
  if(!t){notif('Actividad no encontrada','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(opts.soloCoEj){
    if(tit)tit.textContent='Co-ejecutores · '+(t.codigo||expId);
    if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
    body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Gestione co-ejecutores y modo de entrega.</div>'+
      '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(t.desc||t.actividad||'Actividad')+'</div>'+
      renderTaskAsignadosPanelHtml(expId,taskId,t,!esModoResponsable()&&!esJurisdiccional())+
      '<div style="margin-top:10px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
    ov.classList.add('on');
    window._taskModalCtx={expId,taskId,actLibre:!!t.sinExpediente,soloCoEj:true};
    return;
  }
  if(chatOnly&&tit)tit.textContent='Chat de actividad · '+(t.codigo||expId);
  else if(tit)tit.textContent=(t.actividad||t.desc||'Actividad')+' · '+(t.codigo||expId);
  const est=estadoTask(t),st=taskEstadoStyle(est);
  const hasSop=(t.soportes||[]).length>0;
  const pendVer=taskPendienteVerificacion(t);
  const canReviewSop=!esModoResponsable()&&!esJurisdiccional()&&pendVer;
  if(modal){
    const pqrsReviewWide=e&&taskEsAtenderPqrs(t,e)&&canReviewSop;
    const docsWide=e?collectDocsComparables(e,taskId,t):[];
    modal.classList.toggle('task-modal-wide',!chatOnly&&!soloGestion&&(hasSop||canDeptVerificarCierre(t)||pqrsReviewWide||docsWide.length>=2));
    modal.classList.toggle('enviar-modal-only',chatOnly||soloGestion);
  }
  const sopPanel=(chatOnly||soloGestion)?'':renderTaskSoportePanelHtml(expId,taskId,t,window._taskSopSel,{hideEnviar:true,hideEntrega:true});
  const hist=(t.historial||[]).length&&!chatOnly&&!soloGestion?'<div style="font-size:12px;color:var(--tx2);margin-bottom:.6rem">'+renderTaskHistorialHtml(t)+'</div>':'';
  const pqrsDocBanner=(!chatOnly&&!soloGestion&&e&&taskEsAtenderPqrs(t,e))?
    '<div style="margin-bottom:10px;padding:8px 10px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r)">'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:6px">PQRSD — solicitud y respuesta</div>'+
    htmlPqrsRespuestaDatosReadonly(e)+
    '<div class="fx" style="gap:6px;flex-wrap:wrap;align-items:center">'+(htmlPqrsDocumentoBtns(e)||'<span style="font-size:12px;color:var(--tx3)">Sin link de solicitud</span>')+'</div>'+
    (canReviewSop&&!esModoResponsable()?'<div style="font-size:11px;color:var(--tx3);margin-top:6px">Use la pestaña «Solicitud / Respuesta» o «Comparar documentos» para revisar lado a lado.</div>':'')+
    '</div>':'';
  const canWriteDept=!esModoResponsable()&&!esJurisdiccional();
  const canWriteResp=(esModoResponsable()||esVistaActividadesDepto())&&taskUsuarioEsAsignado(t,responsableActivo);
  const canEditAsig=canWriteDept;
  const canEditAsigEffective=canEditAsig||(canReviewSop&&!!t.sinExpediente)||(soloGestion&&canWriteDept);
  const pqrsNcaAsig=e&&taskEsAtenderPqrs(t,e)&&esOficinaPqrsNca();
  const asigPanel=(!chatOnly&&(canEditAsigEffective||soloGestion||taskEsMultiAsignada(t)))?renderTaskAsignadosPanelHtml(expId,taskId,t,canEditAsigEffective,{pqrsNca:pqrsNcaAsig}):'';
  const chatSep=soloGestion?'':renderTaskChatPanelHtml(expId,taskId,t);
  const verifyBar=(!chatOnly&&!soloGestion&&canDeptVerificarCierre(t))?renderTaskVerifyBarHtml(expId,taskId,t):'';
  if(soloGestion&&tit)tit.textContent='Co-ejecutores · '+(t.codigo||expId);
  body.innerHTML='<div style="margin-bottom:.5rem"><span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+estadoTaskLabel(t)+'</span> <span style="font-size:12px;color:var(--tx2)">'+taskResponsablesLabel(t,true)+' · vence '+fmtF(t.vence)+'</span></div>'+
    (soloGestion?('<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Añada o retire co-ejecutores y defina el modo de entrega.</div>'):'')+
    pqrsDocBanner+asigPanel+sopPanel+hist+chatSep+verifyBar;
  ov.classList.add('on');
  if(!chatOnly&&!soloGestion){
    window._compareDocA=null;
    window._compareDocB=null;
    const soportes=t.soportes||[];
    const activo=getSoporteActivo(t);
    const prevSel=window._taskSopSel;
    const validPrev=prevSel&&soportes.some(s=>s.id===prevSel);
    window._taskModalCtx={expId,taskId,actLibre:!!t.sinExpediente};
    if(validPrev)window._taskSopSel=prevSel;
    else window._taskSopSel=getDefaultSoporteSel(t)||(activo||{}).id||'';
    window._soportePaginaActual=1;
    window._soportePaginaFiltro='all';
    const selSop=window._taskSopSel;
    const selObj=soportes.find(s=>s.id===selSop)||activo;
    const canAnnot=canDeptMarcarEnSoporte(t,selObj);
    if(selSop)setTimeout(()=>{setSoportePagina(1);initSoporteAnnotViewer(expId,taskId,selSop,canAnnot);},80);
    if(e&&taskEsAtenderPqrs(t,e)&&!esModoResponsable()&&taskPendienteVerificacion(t))setTimeout(()=>initPqrsSolRespCompareTab(),100);
    else if(canReviewSop){
      const docsRev=collectDocsComparables(e,taskId,t);
      if(docsRev.length>=2)setTimeout(()=>initCompareVersionesTab(),120);
    }
  }else{
    window._taskModalCtx={expId,taskId,actLibre:!!t.sinExpediente,chatOnly:chatOnly||soloGestion,gestionAsignados:!!soloGestion};
  }
  if(opts.focusChat||chatOnly)setTimeout(()=>{const el=document.getElementById('task-chat-sep');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});const inp=document.getElementById('task-cmt-input');if(inp)inp.focus();},120);
}
function devolverTaskConComentario(expId,taskId){
  const inp=document.getElementById('task-cmt-input');
  const txt=inp?String(inp.value||'').trim():'';
  if(txt)addTaskComentario(expId,taskId,txt);
  devolverTaskAlResponsable(expId,taskId,txt||'Devuelta desde chat de actividad');
}
function devolverSoporteTask(expId,taskId){
  devolverTaskAlResponsable(expId,taskId,'Devuelta desde revisión del documento');
}
function closeTaskModal(){
  const ctx=window._taskModalCtx||{};
  const formRow=ctx.formRowEl;
  const ov=document.getElementById('task-modal-overlay');
  if(ov){
    ov.classList.remove('on');
    ov.style.zIndex='';
    ov.classList.remove('con-arch-modal-on');
    const modal=ov.querySelector('.task-modal');
    if(modal)modal.classList.remove('task-modal-wide');
    if(modal)modal.classList.remove('enviar-modal-only');
  }
  cerrarPqrsModalPrep();
  const panelArchOpen=document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')&&document.getElementById('con-panel-archivos-wrap');
  if(!panelArchOpen)window._conArchItems=null;
  window._taskModalCtx=null;
  window._gmailVinculoMsg=null;
  window._taskSopSel=null;
  window._annotMarking=false;
  window._pendingAnnot=null;
  window._annotSelId=null;
  if(ctx.expId&&(ctx.gestionAsignados||ctx.soloCoEj))syncTkRowsFromExp(ctx.expId,ctx.taskId);
  if(formRow)refreshTkCoEjPanel(formRow);
}
function submitTaskComment(expId,taskId){
  const inp=document.getElementById('task-cmt-input');
  if(!inp)return;
  if(addTaskComentario(expId,taskId,inp.value)){
    notif('Mensaje enviado','ok');
    if(isFormExpVisible(expId))syncTkRowsFromExp(expId,taskId);
    renderBandejaDepto();
    if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    closeTaskModal();
  }
}
function renderTaskHistorialHtml(t){
  return (t.historial||[]).map(h=>{
    if(h.tipo==='traslado')return '↔ Traslado: '+escAttr(h.de||'—')+' → '+escAttr(h.a||'—')+' ('+fmtF(h.fecha)+')';
    if(h.tipo==='asignacion_extra')return '👥 Co-ejecutor añadido: '+escAttr(h.a||'—')+' ('+fmtF(h.fecha)+')';
    if(h.tipo==='quitar_asignado')return '👥 Co-ejecutor retirado: '+escAttr(h.de||'—')+' ('+fmtF(h.fecha)+')';
    if(h.tipo==='edicion')return '✏️ Editada ('+fmtF(h.fecha)+')'+(h.nota?': '+escAttr(h.nota):'');
    if(h.tipo==='solicitud_traslado')return '📩 Solicitud de traslado'+(h.a?' → '+escAttr(h.a):'')+' ('+fmtF(h.fecha)+')'+(h.nota?': '+escAttr(h.nota):'');
    if(h.tipo==='solicitud_eliminacion')return '📩 Solicitud de eliminación ('+fmtF(h.fecha)+')'+(h.nota?': '+escAttr(h.nota):'');
    if(h.tipo==='solicitud_resuelta')return (h.resolucion==='aprobada'?'✓':'↩')+' Solicitud '+(h.solTipo||'')+' '+escAttr(h.resolucion||'')+' ('+fmtF(h.fecha)+')';
    if(h.tipo==='eliminacion')return '🗑 Eliminada ('+fmtF(h.fecha)+')'+(h.nota?': '+escAttr(h.nota):'');
    if(h.tipo==='soporte')return '📎 Soporte v'+(h.version||'?')+' ('+fmtF(h.fecha)+')'+(h.por?' · '+escAttr(h.por):'');
    if(h.tipo==='ajuste_soporte')return '↩ Devuelta por corregir ('+fmtF(h.fecha)+')'+(h.nota?': '+escAttr(h.nota):'');
    if(h.tipo==='reenvio_verificacion')return '📤 Reenviada para verificación v'+(h.version||'?')+' ('+fmtF(h.fecha)+')';
    if(h.tipo==='verificacion')return '✓ Aprobada y cerrada ('+fmtF(h.fecha)+')'+(h.por?' · '+escAttr(h.por):'');
    return escAttr(h.tipo||'');
  }).join('<br>');
}
function renderTaskConsultaItem(e,t,qs){
  t=normalizeTask(t);
  const expId=e._exp||t.codigo;
  const est=estadoTask(t),lbl=estadoTaskLabel(t),st=taskEstadoStyle(est),venc=est==='Vencida';
  const dc=est==='Atendida'?'td-ok':est==='Por verificar'?'td-p':venc?'td-v':'td-p';
  const ciu=esModoCiudadano();
  const ncChat=ciu?0:taskChatComentariosCount(t);
  const ns=(t.soportes||[]).length;
  const hist=!ciu&&(t.historial||[]).some(h=>h.tipo==='traslado'||h.tipo==='eliminacion'||h.tipo==='soporte'||h.tipo==='ajuste_soporte');
  const desc=hl(ciu?anonimizarParaCiudadano(t.desc||(t.actividad||'')):(t.desc||(t.actividad||'')),qs);
  const del=t.eliminada?' opacity:.65;text-decoration:line-through':'';
  const coBtn=ciu?'':taskCoEjecutorBtnHtml(expId,t.id);
  const respLbl=ciu?'':taskEsMultiAsignada(t)?taskResponsablesLabel(t,false):(t.responsable||'');
  const cmtBtn=ciu?'':'<button type="button" class="btn bsm bic" title="Chat de la actividad'+(ncChat?' ('+ncChat+' mensajes)':'')+'" onclick="openTaskCommentsChatOnly(\''+escAttr(expId)+'\',\''+escAttr(t.id)+'\')">'+chatWaIconHtml(15)+(ncChat>0?'<span class="cmt-dot">'+ncChat+'</span>':'')+'</button>';
  const sopBtn=(!ciu&&ns)?'<button type="button" class="btn bsm bic" title="'+ns+' documento(s)" onclick="openTaskCommentsModal(\''+escAttr(expId)+'\',\''+escAttr(t.id)+'\')">📎</button>':'';
  const agBtn=ciu?'':taskAgendaBtnHtml(expId,t.id);
  return '<div class="tkv" style="'+del+'">'+
    '<div class="tvd '+dc+'"></div>'+
    '<span style="flex:1;font-weight:500">'+desc+'</span>'+
    coBtn+
    (respLbl?'<span style="color:var(--tx2);font-size:11px;margin-right:5px;max-width:140px" title="'+escAttr(respLbl)+'">'+escAttr(respLbl)+'</span>':'')+
    '<span style="color:'+(venc?'var(--rd)':'var(--tx3)')+';font-size:11px">'+fmtF(t.vence)+'</span>'+
    '<span class="bdg" style="margin-left:6px;font-size:10px;background:'+st.bg+';color:'+st.fg+'">'+lbl+'</span>'+
    agBtn+sopBtn+cmtBtn+
    (hist&&!ncChat&&!ns?'<button type="button" class="btn bsm bic" title="Ver historial" onclick="openTaskCommentsModal(\''+escAttr(expId)+'\',\''+escAttr(t.id)+'\')">📋</button>':'')+
    '</div>'+(hist?'<div style="font-size:10px;color:var(--tx3);padding-left:18px;margin-top:-2px;margin-bottom:4px">'+renderTaskHistorialHtml(t)+'</div>':'');
}
function renderInteresadoConsultaBody(e){
  let h='<div class="ig">';
  if(e._tipo_persona==='juridica'){
    h+=icRow('Empresa',e._pj_empresa)+icRow('NIT',e._pj_nit)+icRow('Representante legal',e._pj_rep_nombre)+icRow('Id. representante',e._pj_rep_identificacion)+icRow('Correo',e._pj_rep_correo||e._pj_correo)+icRow('Teléfono',e._pj_rep_telefono||e._pj_telefono)+icRow('Ubicación',fmtDirExp('pj',e));
  }else{
    h+=icRow('Nombre',e._pn_nombre)+icRow('Identificación',e._pn_identificacion)+icRow('Correo',e._pn_correo)+icRow('Teléfono',e._pn_telefono)+icRow('Ubicación',fmtDirExp('pn',e));
    if(e._est_com)h+=icRow('Establecimiento comercial',e._ec_nombre)+icRow('Tel. establecimiento',e._ec_telefono)+icRow('Dir. establecimiento',fmtDirExp('ec',e));
  }
  if(e._apoderado&&e._apo_nombre)h+=icRow('Apoderado',e._apo_nombre+(e._apo_identificacion?' · '+e._apo_identificacion:'')+(e._apo_correo?' · '+e._apo_correo:''));
  if(e._autorizado&&(e._aut_nombre||e._aut_identificacion))h+=icRow('Autorizado',(e._aut_nombre||'')+(e._aut_identificacion?' · '+e._aut_identificacion:''));
  if(e._medio_notificacion){
    const ml=medioNotificacionLabel(e._medio_notificacion);
    if(ml)h+=icRow('Medio de notificación',ml);
  }
  return h+'</div>';
}
function icRow(k,v){if(v==null||v==='')return'';return '<div class="ic"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>';}
function fmtDirExp(prefix,e){
  const p=[e['_'+prefix+'_mun'],e['_'+prefix+'_vereda'],e['_'+prefix+'_predio'],e['_'+prefix+'_barrio'],e['_'+prefix+'_direccion']].filter(Boolean);
  return p.length?p.join(' · '):'';
}
function renderInteresadoView(e){
  let body='',tit='';
  if(esModoCasoEspecial(e)){
    tit=labelTipoCasoEspecial(e)||'Caso especial';
    const qv=renderQuejaView(e);
    if(!qv)return'';
    body=qv.replace(/^[\s\S]*?<div class="ig">/,'<div class="ig">').replace(/<\/div>\s*<\/div>\s*$/,'</div>');
  }else{
    tit=getNom(e);
    body=renderInteresadoConsultaBody(e);
  }
  if(!body||body==='<div class="ig"></div>')return'';
  return '<details class="con-fold"><summary>Datos del interesado — '+escAttr(tit)+'</summary><div class="item-fold-body">'+body+'</div></details>';
}
function renderContableView(e){
  migrarAcuerdoGlobal(e);
  const extras=facturasData(e._facturas_extra);
  if(!extras.length&&!e._acuerdo_pago)return'';
  let body='';
  if(e._acuerdo_pago)body+='<div style="font-size:12px;color:var(--bl);margin-bottom:.45rem">Registra acuerdo de pago</div>';
  if(!extras.length)body+='<div style="font-size:12px;color:var(--tx3)">Sin facturas detalladas.</div>';
  extras.forEach(f=>{
    const mora=f.venc&&f.venc<hoy()&&!f.pago;
    const acuMora=facturaAcuerdoEnMora(f);
    body+='<div class="tkv" style="flex-wrap:wrap;align-items:center">'+
      '<span style="font-weight:600">'+(f.tipo||'Factura')+(f.ref?' · '+f.ref:'')+'</span>'+
      (f.valor?'<span style="font-size:12px">'+moneyFmt(f.valor)+'</span>':'')+
      '<span style="font-size:11px;color:var(--tx2)">Vence '+fmtF(f.venc)+(f.pago?' · Pagada '+fmtF(f.pago):'')+'</span>'+
      (mora?'<span class="flag" style="background:var(--rdl);color:var(--rd)">Mora</span>':'')+
      (f.acuerdoPago?'<span class="flag" style="background:var(--bll);color:var(--bl)">Acuerdo</span>':'')+
      (acuMora?'<span class="flag" style="background:var(--rdl);color:var(--rd)">Cuota en mora</span>':'')+
    '</div>';
    if(f.acuerdoPago&&acuerdoCuotasData(f).length){
      body+='<div style="margin:.35rem 0 .65rem 1rem;font-size:11px;color:var(--tx2)">Cuotas: '+acuerdoCuotasData(f).map((c,i)=>{
        const m=moneyRaw(c.monto);
        const st=c.pago?'✓ '+fmtF(c.pago):acuerdoCuotaEnMora(c)?'<span style="color:var(--rd)">Mora '+fmtF(c.fecha)+'</span>':'Pend. '+fmtF(c.fecha);
        return '#'+ (i+1)+' '+st+(m?' · '+moneyFmt(m):'');
      }).join(' · ')+'</div>';
    }
  });
  return '<details class="con-fold"><summary>Información contable</summary><div class="item-fold-body">'+body+'</div></details>';
}
function renderConsultaResumenExp(e,tram,qs){
  const camposHtml=tram?tram.campos.filter(c=>{
    const v=e['f_'+c.id];
    return v!=null&&v!==''&&v!==false;
  }).map(c=>'<div class="ic"><div class="k">'+c.label+'</div><div class="v">'+hl(fmtCampoVal(e['f_'+c.id],c),qs)+'</div></div>').join(''):'';
  const asoc=getExpAsociadosAll(e);
  if(!camposHtml&&!e._fecha_res&&!e._resolucion&&!asoc.length)return'';
  let h='<details class="con-fold" open><summary>Información del expediente y solicitud</summary><div class="item-fold-body"><div class="ig">';
  h+=camposHtml;
  if(asoc.length)h+=renderExpAsociadosView(e,true);
  if(e._resolucion||e._fecha_res)h+='<div class="ic"><div class="k">Resolución</div><div class="v">'+(e._resolucion?escAttr(e._resolucion):'—')+(e._fecha_res?' · '+fmtF(e._fecha_res):'')+'</div></div>';
  return h+'</div></div></details>';
}
function renderConsultaHdrMeta(e,ter,porVerT,doneT,porEjecT,vencT,porCorrT,d){
  let h='<div class="con-hdr-meta"><div class="con-hdr-meta-row">';
  h+='<span class="con-hdr-chip"><span class="k">Actividades</span>'+porVerT+' por verificar · '+porCorrT+' por corregir · '+doneT+' atendidas · '+porEjecT+' por ejecutar · '+vencT+' vencidas</span>';
  h+='<span class="con-hdr-chip">'+daysBdg(d)+'</span>';
  h+='</div>';
  if(ter)h+='<div class="con-hdr-terms">'+termsBar(ter)+'</div>';
  return h+'</div>';
}
function renderDetalleConsultaView(e){
  migrarDetalleNotas(e);
  const notas=detalleNotasData(e._detalle_notas);
  if(!notas.length&&!String(e._detalle_general||'').trim())return'';
  const body=notas.length?notas.map(n=>'<div class="det-nota-item" style="padding:.45rem 0;border-bottom:1px solid var(--bd)"><div style="font-size:11px;color:var(--tx3);margin-bottom:3px">'+(n.autor?escAttr(n.autor):'—')+(n.fecha?' · '+fmtF(n.fecha):'')+'</div><div style="font-size:13px;line-height:1.5;white-space:pre-wrap;color:var(--tx)">'+escAttr(n.texto||'')+'</div></div>').join(''):('<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;color:var(--tx)">'+escAttr(String(e._detalle_general||''))+'</div>');
  return '<details class="con-fold"><summary>Detalles / descripción del trámite ('+Math.max(notas.length,1)+')</summary><div class="item-fold-body">'+body+'</div></details>';
}
function detalleNotasData(v){
  if(Array.isArray(v))return v;
  if(typeof v==='string'&&v.trim().startsWith('[')){try{const a=JSON.parse(v);return Array.isArray(a)?a:[];}catch(e){}}
  return[];
}
function migrarDetalleNotas(e){
  if(!e)return;
  const cur=detalleNotasData(e._detalle_notas);
  if(cur.length){e._detalle_notas=JSON.stringify(cur);return;}
  const leg=String(e._detalle_general||'').trim();
  if(leg)e._detalle_notas=JSON.stringify([{texto:leg,autor:'',fecha:e._fecha||hoy()}]);
  else if(e._detalle_notas==null||e._detalle_notas==='')e._detalle_notas='[]';
}
function detalleNotasListHtml(notas){
  if(!notas.length)return'<div style="font-size:12px;color:var(--tx3);padding:.35rem 0">Sin comentarios registrados.</div>';
  return notas.map(n=>'<div class="det-nota-item" style="padding:.55rem 0;border-bottom:1px solid var(--bd)"><div style="font-size:11px;color:var(--tx3);margin-bottom:4px">'+(n.autor?escAttr(n.autor):'—')+(n.fecha?' · '+fmtF(n.fecha):'')+'</div><div style="font-size:13px;line-height:1.45;white-space:pre-wrap;color:var(--tx)">'+escAttr(n.texto||'')+'</div></div>').join('');
}
function persistDetalleNotasExp(){
  if(!editId)return;
  const hid=document.getElementById('fld__detalle_notas');
  if(!hid)return;
  const e=exps.find(x=>x._exp===editId);
  if(!e)return;
  const notas=detalleNotasData(hid.value);
  e._detalle_notas=JSON.stringify(notas);
  e._detalle_general=notas.length?notas.map(n=>n.texto).join('\n\n'):'';
  persistExpedienteGranular(e,false);
  if(document.getElementById('pg-reg')&&document.getElementById('pg-reg').classList.contains('on'))renderTabla();
}
function addDetalleNota(){
  const ta=document.getElementById('fld__detalle_nuevo');
  const txt=ta&&ta.value?ta.value.trim():'';
  if(!txt){notif('Escriba un comentario','err');return;}
  const hid=document.getElementById('fld__detalle_notas');
  const notas=detalleNotasData(hid?hid.value:'[]');
  notas.push({texto:txt,autor:getEncargadoDepto(deptoActivo)||responsableActivo||'Usuario',fecha:hoy()});
  if(hid)hid.value=JSON.stringify(notas);
  const list=document.getElementById('detalle-notas-list');
  if(list)list.innerHTML=detalleNotasListHtml(notas);
  if(ta)ta.value='';
  const sec=list?list.closest('details.form-section'):null;
  if(sec)sec.open=true;
  if(editId)persistDetalleNotasExp();
  notif(editId?'Comentario guardado — ya puede visualizarlo abajo':'Comentario añadido — pulse Guardar en la sección','ok');
}
function collectDetalleNotas(){
  const hid=document.getElementById('fld__detalle_notas');
  if(!hid)return{};
  const ta=document.getElementById('fld__detalle_nuevo');
  let notas=detalleNotasData(hid.value);
  const txt=ta&&ta.value?ta.value.trim():'';
  if(txt){
    notas.push({texto:txt,autor:getEncargadoDepto(deptoActivo)||responsableActivo||'Usuario',fecha:hoy()});
    hid.value=JSON.stringify(notas);
    if(ta)ta.value='';
  }
  const merged=JSON.stringify(notas);
  return{_detalle_notas:merged,_detalle_general:notas.length?notas.map(n=>n.texto).join('\n\n'):''};
}
function renderInfoTecConsultaView(e){
  migrarInfoTecExpediente(e);
  const items=infoTecnicaExpData(e._info_tecnica_items);
  if(!items.length)return'';
  const body=items.map(it=>{
    const def=getInfoTecDef(it.campoId,e);
    const lbl=def?def.label:it.campoId;
    let v=it.valor;
    if(typeof v==='boolean')v=v?'Sí':'No';
    else if(v!=null&&v!=='')v=fmtCampoVal(v,def||{tipo:'texto'});
    else v='';
    if(v==null||v==='')return'';
    return '<div class="ic"><div class="k">'+lbl+'</div><div class="v">'+escAttr(String(v))+'</div></div>';
  }).filter(Boolean).join('');
  if(!body)return'';
  const n=items.filter(it=>{const v=it.valor;return v!=null&&v!==''&&v!==false;}).length;
  return '<details class="con-fold"><summary>Información técnica ('+n+' dato(s))</summary><div class="item-fold-body"><div class="ig">'+body+'</div></div></details>';
}
function expsAmbito(){
  let list;
  if(esJurisdiccional()||esModoResponsable()||esModoCiudadano())list=exps.slice();
  else if(esSecretaria())list=exps.filter(esPqrsSecretaria);
  else if(esModoOficinaDeguv())list=exps.filter(e=>esPqrsSecretaria(e)&&e._pqrs_oficina===deptoActivo);
  else list=exps.filter(e=>(e._depto||'guaviare')===deptoActivo);
  if(esUsuarioContratista())list=list.filter(expVisibleParaContratista);
  return list;
}
function ensureTramPqrsCfg(deptoId){
  deptoId=deptoId||'guaviare';
  if(!cfgByDepto[deptoId])cfgByDepto[deptoId]=JSON.parse(JSON.stringify(DEF));
  const trams=cfgByDepto[deptoId].tramites||[];
  return trams.find(x=>x.id==='t_pqrs')||trams.find(x=>esTramitePqrs(x.id))||PQRS_TRAM_VIRTUAL;
}
function getTramPqrsId(deptoId){
  const t=ensureTramPqrsCfg(deptoId||'guaviare');
  return t?(t.id||'t_pqrs'):'t_pqrs';
}
function sortTasksByUrgency(tasks){
  const rank={Vencida:0,'Por corregir':1,'En ejecución':2,'Por verificar':3,Atendida:4,Eliminada:5};
  return [...tasks].sort((a,b)=>{
    const pa=!!a.prioritaria,pb=!!b.prioritaria;
    if(pa!==pb)return pa?-1:1;
    const ea=estadoTask(a),eb=estadoTask(b);
    if(rank[ea]!==rank[eb])return(rank[ea]??9)-(rank[eb]??9);
    return (a.vence||'9999').localeCompare(b.vence||'9999');
  });
}
function sortTasksRevisadas(tasks){
  function rank(t){
    const rev=getTaskRevisionDepto(t);
    const est=estadoTask(t);
    if((rev&&rev.tipo==='corregir')||est==='Por corregir')return 0;
    if(!!t.prioritaria&&est!=='Atendida')return 1;
    if(est==='Vencida')return 2;
    if(est!=='Atendida')return 3;
    return 4;
  }
  return [...tasks].sort((a,b)=>{
    const ra=rank(a),rb=rank(b);
    if(ra!==rb)return ra-rb;
    const pa=!!a.prioritaria,pb=!!b.prioritaria;
    if(pa!==pb)return pa?-1:1;
    const revA=getTaskRevisionDepto(a),revB=getTaskRevisionDepto(b);
    const fa=(revA&&revA.fecha)||a.vence||'';
    const fb=(revB&&revB.fecha)||b.vence||'';
    if(fa!==fb)return fb.localeCompare(fa);
    return (a.vence||'9999').localeCompare(b.vence||'9999');
  });
}
function minTaskVenceExp(e,resp){
  const ts=(e.tasks||[]).filter(t=>(!resp||t.responsable===resp)&&estadoTask(t)!=='Atendida');
  if(!ts.length)return'9999';
  return ts.map(t=>t.vence||'9999').sort()[0];
}
function badgeDepto(id){if((!esJurisdiccional()&&!esModoResponsable())||!id)return'';return '<span class="bdg" style="background:var(--sf2);color:var(--tx2);font-size:10px;margin-left:4px">'+labelDepto(id)+'</span>';}
// Config puntero activo y normalización → js/config-store.js
// function cfgFor(){ ... } normalizeCfgObj / initCfgByDepto / setCfgPtr / syncCfgToStore
// Capa de persistencia (LS helpers, Firestore CRUD, realtime sync) → js/persistence.js
// function lsParseStoredJson(raw){

/*
 * --- Fallback legacy: array expedientes[] embebido en departamentos/{deptoId} ---
 * Desactivado tras migración a subcolección. Reactivar solo si hace falta rollback.
 *
 * async function loadLS_legacy(){
 *   const db=window._db;
 *   if(!db||!window._fsGetDoc){_loadLSLocal();updateSyncIndicator('offline');return;}
 *   updateSyncIndicator('syncing');
 *   try{
 *     const globalSnap=await window._fsGetDoc(window._fsDoc(db,'sistema','global'));
 *     if(globalSnap.exists()){
 *       const g=globalSnap.data();
 *       if(Array.isArray(g.personas))personas=g.personas;
 *       if(Array.isArray(g.actividadesLibres))actividadesLibres=g.actividadesLibres;
 *       if(Array.isArray(g.agendaEventos))agendaEventos=g.agendaEventos;
 *       if(Array.isArray(g.chatMensajes))chatMensajes=g.chatMensajes;
 *       if(g.encargadosGlobal)encargadosGlobal=normalizeEncargadosGlobal(g.encargadosGlobal);
 *       if(Array.isArray(g.usuariosIndex)&&g.usuariosIndex.length)aplicarUsuariosIndex(g.usuariosIndex);
 *       if(Array.isArray(g.bandejaLeidos))try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify(g.bandejaLeidos));}catch(x){}
 *       if(Array.isArray(g.bandejaEliminados))try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify(g.bandejaEliminados));}catch(x){}
 *     }
 *     const snaps=await Promise.all(DEPTOS_FIRESTORE.map(depto=>window._fsGetDoc(window._fsDoc(db,'departamentos',depto))));
 *     exps=[];
 *     cfgByDepto={};
 *     snaps.forEach((snap,i)=>{
 *       const depto=DEPTOS_FIRESTORE[i];
 *       if(snap.exists()){
 *         const data=snap.data();
 *         const deptoExps=Array.isArray(data.expedientes)?data.expedientes:[];
 *         exps=exps.concat(deptoExps);
 *         cfgByDepto[depto]=normalizeCfgObj(data.cfg||{});
 *       }else{
 *         cfgByDepto[depto]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));
 *       }
 *     });
 *     DEPTOS.forEach(d=>{if(!cfgByDepto[d.id])cfgByDepto[d.id]=normalizeCfgObj(JSON.parse(JSON.stringify(DEF)));});
 *     postLoadInit();
 *     updateSyncIndicator('synced');
 *   }catch(err){
 *     console.error('Error cargando Firestore:',err);
 *     _loadLSLocal();
 *     updateSyncIndicator('error');
 *   }
 * }
 *
 * async function saveFirestore_legacy(){
 *   const db=window._db;
 *   if(!db||!window._fsSetDoc||_localSaving)return;
 *   _localSaving=true;
 *   updateSyncIndicator('syncing');
 *   try{
 *     syncCfgToStore();
 *     await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
 *       personas:personas||[],
 *       actividadesLibres:actividadesLibres||[],
 *       agendaEventos:agendaEventos||[],
 *       chatMensajes:chatMensajes||[],
 *       bandejaLeidos:getBandejaLeidos(),
 *       bandejaEliminados:getBandejaEliminados(),
 *       encargadosGlobal:normalizeEncargadosGlobal(encargadosGlobal),
 *       usuariosIndex:_usuariosCache.map(u=>({
 *         email:String(u.email||'').trim().toLowerCase(),
 *         nombre:u.nombre||'',
 *         rol:u.rol||'',
 *         codigo:u.codigo||'',
 *         activo:u.activo!==false,
 *         deptoResponsable:String(u.deptoResponsable||'').trim()
 *       })),
 *       updatedAt:new Date().toISOString()
 *     },{merge:true});
 *     for(const depto of DEPTOS_FIRESTORE){
 *       const deptoExps=(exps||[]).filter(e=>(e._depto||'guaviare')===depto);
 *       const pqrsdDepto=deptoExps.filter(esPqrsSecretaria);
 *       await window._fsSetDoc(window._fsDoc(db,'departamentos',depto),{
 *         expedientes:deptoExps,
 *         cfg:cfgByDepto[depto]||{},
 *         pqrsd:pqrsdDepto,
 *         chat:{},
 *         inbox:[],
 *         updatedAt:new Date().toISOString()
 *       },{merge:true});
 *     }
 *     updateSyncIndicator('synced');
 *   }catch(err){
 *     console.error('Error guardando Firestore:',err);
 *     updateSyncIndicator('error');
 *   }
 *   setTimeout(()=>{_localSaving=false;},1500);
 * }
 * --- fin fallback legacy ---
 */

// ================================================================
// UTILS
// ================================================================
// dias, fmtF, hoy, gv, onlyNums, numAttrs, emailValido, validarEmailCampo → js/utils.js
function getTram(id,deptoOrExp){return (cfgFor(deptoOrExp).tramites||[]).find(t=>t.id===id);}
function daysBdg(d){const cl=d<90?'dok':d<180?'dwn':'dal';return '<span class="bdg '+cl+'">'+d+'d</span>';}
function badgeTram(tid,deptoOrExp){const t=getTram(tid,deptoOrExp);if(!t)return'';return '<span class="bdg" style="background:'+t.color+'22;color:'+t.color+'">'+t.nombre+'</span>';}
function badgeEta(eta,tid,deptoOrExp){const t=getTram(tid,deptoOrExp);const col=t?t.color:'#888';return '<span class="bdg" style="background:'+col+'22;color:'+col+'">'+(eta||'-')+'</span>';}
function badgeEst(s){return '<span class="bdg '+(EST_CL[s]||'b-sol')+'">'+(s||'Solicitud')+'</span>';}
function isArchivadoEstado(s){return s==='Archivado'||s==='Archivado o anulado';}
function acctStatus(e){
  const extras=facturasData(e._facturas_extra);
  const solMora=e._fac_sol_venc&&e._fac_sol_venc<hoy()&&!e._fac_sol_pago;
  const traMora=e._fac_tra_enabled&&e._fac_tra_venc&&e._fac_tra_venc<hoy()&&!e._fac_tra_pago;
  const extraMora=extras.some(f=>{
    if(f.pago)return false;
    if(f.acuerdoPago&&acuerdoCuotasData(f).length)return facturaAcuerdoEnMora(f);
    return f.venc&&f.venc<hoy();
  });
  const mora=!!(solMora||traMora);
  const moraTotal=!!(mora||extraMora);
  const persuasivo=moraTotal&&extras.some(f=>f.venc&&f.venc<hoy()&&!f.pago&&!!f.persVenc);
  const coactivo=moraTotal&&extras.some(f=>f.venc&&f.venc<hoy()&&!f.pago&&!!f.coacFecha);
  const acuerdoFactura=extras.some(f=>f.acuerdoPago);
  return {mora:moraTotal,persuasivo,coactivo,acuerdo:acuerdoFactura||!!e._acuerdo_pago};
}
function contableV(e,k){return e&&e[k]?e[k]:'';}
function facturasData(v){try{return v?JSON.parse(v):[];}catch(e){return[];}}
function conceptosSegData(v){try{return v?JSON.parse(v):[];}catch(e){return[];}}
function actosAdminData(v){try{return v?JSON.parse(v):[];}catch(e){return[];}}
function fechasEstadoData(v){try{return v?JSON.parse(v):{};}catch(e){return{};}}
function getFechasEstado(e){
  const f=fechasEstadoData(e._fechas_estado);
  if(!f.Solicitud&&e._fecha)f.Solicitud=e._fecha;
  return f;
}
function getFechaEstado(e,est){return getFechasEstado(e)[est]||'';}
function fechaRefExpediente(e){
  const est=isArchivadoEstado(e._estado)?'Archivado o anulado':(e._estado||'Solicitud');
  return getFechaEstado(e,est)||e._fecha||'';
}
function anosDisponiblesExp(){
  const ys=new Set();
  expsAmbito().forEach(e=>{
    const f=fechaRefExpediente(e);
    if(f&&f.length>=4)ys.add(parseInt(f.slice(0,4),10));
  });
  const cur=new Date().getFullYear();
  ys.add(cur);ys.add(cur-1);ys.add(cur+1);
  return [...ys].filter(y=>!isNaN(y)).sort((a,b)=>b-a);
}
function periodPrefixIds(prefix){
  return{preset:prefix+'-preset',ano:prefix+'-ano',mes:prefix+'-mes',mesWrap:prefix+'-mes-wrap',desde:prefix+'-desde',hasta:prefix+'-hasta'};
}
function pad2Periodo(n){return String(n).padStart(2,'0');}
function ultimoDiaMesPeriodo(ano,mes){return new Date(ano,mes,0).getDate();}
function poblarSelectAno(prefix){
  const sel=document.getElementById(prefix+'-ano');
  if(!sel)return;
  const cur=sel.value||String(new Date().getFullYear());
  const anos=anosDisponiblesExp();
  sel.innerHTML=anos.map(y=>'<option value="'+y+'"'+(String(y)===cur?' selected':'')+'>'+y+'</option>').join('');
}
function initPeriodoFiltros(prefix){
  poblarSelectAno(prefix);
  updatePeriodoUIMes(prefix);
}
function rangoDesdePreset(preset,ano,mes){
  ano=parseInt(ano,10)||new Date().getFullYear();
  mes=parseInt(mes,10)||1;
  if(!preset)return{desde:'',hasta:''};
  if(preset==='ano')return{desde:ano+'-01-01',hasta:ano+'-12-31'};
  if(preset==='trim1')return{desde:ano+'-01-01',hasta:ano+'-03-31'};
  if(preset==='trim2')return{desde:ano+'-04-01',hasta:ano+'-06-30'};
  if(preset==='trim3')return{desde:ano+'-07-01',hasta:ano+'-09-30'};
  if(preset==='trim4')return{desde:ano+'-10-01',hasta:ano+'-12-31'};
  if(preset==='sem1')return{desde:ano+'-01-01',hasta:ano+'-06-30'};
  if(preset==='sem2')return{desde:ano+'-07-01',hasta:ano+'-12-31'};
  if(preset==='mes'){
    const ud=ultimoDiaMesPeriodo(ano,mes);
    return{desde:ano+'-'+pad2Periodo(mes)+'-01',hasta:ano+'-'+pad2Periodo(mes)+'-'+pad2Periodo(ud)};
  }
  return null;
}
function updatePeriodoUIMes(prefix){
  const ids=periodPrefixIds(prefix);
  const preset=(document.getElementById(ids.preset)||{}).value||'';
  const mesWrap=document.getElementById(ids.mesWrap);
  if(mesWrap)mesWrap.style.display=preset==='mes'?'':'none';
  const manual=!preset||preset==='custom';
  [ids.desde,ids.hasta].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.readOnly=!manual;
  });
}
function refreshPeriodoView(prefix){
  if(prefix==='q')renderConsulta();
  else if(prefix==='cons'&&document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
  else if(prefix==='act'&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  else if(prefix==='pqrs-ofi'&&document.getElementById('pg-pqrs-ofi')&&document.getElementById('pg-pqrs-ofi').classList.contains('on'))renderPqrsOficinaInbox();
}
function taskFechaRef(t){
  const rev=getTaskRevisionDepto(t);
  if(rev&&rev.fecha)return String(rev.fecha).slice(0,10);
  return (t.vence||t.fechaReportada||t.fechaAtendida||t.fecha||'').slice(0,10);
}
function taskEnPeriodo(t,rango){
  if(!rango)return true;
  const f=taskFechaRef(t);
  if(!f)return true;
  return f>=rango.desde&&f<=rango.hasta;
}
function filterTasksPeriodo(list,prefix){
  const r=getPeriodoRango(prefix);
  if(!r)return list;
  return list.filter(t=>taskEnPeriodo(t,r));
}
function labelActPeriodo(){
  const r=getPeriodoRango('act');
  if(!r)return'';
  return fmtF(r.desde)+' — '+fmtF(r.hasta);
}
function onPresetPeriodo(prefix){
  const ids=periodPrefixIds(prefix);
  const preset=(document.getElementById(ids.preset)||{}).value||'';
  updatePeriodoUIMes(prefix);
  if(!preset){
    const d=document.getElementById(ids.desde),h=document.getElementById(ids.hasta);
    if(d)d.value='';if(h)h.value='';
  }else if(preset!=='custom'){
    const r=rangoDesdePreset(preset,(document.getElementById(ids.ano)||{}).value,(document.getElementById(ids.mes)||{}).value||'1');
    if(r){
      const d=document.getElementById(ids.desde),h=document.getElementById(ids.hasta);
      if(d)d.value=r.desde;if(h)h.value=r.hasta;
    }
  }
  refreshPeriodoView(prefix);
}
function onAnoPeriodoChange(prefix){
  const preset=(document.getElementById(periodPrefixIds(prefix).preset)||{}).value;
  if(preset&&preset!=='custom')onPresetPeriodo(prefix);
  else refreshPeriodoView(prefix);
}
function onRangoManualPeriodo(prefix){
  const ids=periodPrefixIds(prefix);
  const d=(document.getElementById(ids.desde)||{}).value;
  const h=(document.getElementById(ids.hasta)||{}).value;
  if(d||h){
    const p=document.getElementById(ids.preset);
    if(p)p.value='custom';
  }
  updatePeriodoUIMes(prefix);
  refreshPeriodoView(prefix);
}
function limpiarPeriodo(prefix){
  const ids=periodPrefixIds(prefix);
  const p=document.getElementById(ids.preset);
  if(p)p.value='';
  const d=document.getElementById(ids.desde),h=document.getElementById(ids.hasta);
  if(d)d.value='';if(h)h.value='';
  updatePeriodoUIMes(prefix);
  refreshPeriodoView(prefix);
}
function getPeriodoRango(prefix){
  const ids=periodPrefixIds(prefix);
  const d=(document.getElementById(ids.desde)||{}).value||'';
  const h=(document.getElementById(ids.hasta)||{}).value||'';
  if(!d&&!h)return null;
  return{desde:d||'0000-01-01',hasta:h||'9999-12-31'};
}
function expEnPeriodo(e,rango){
  if(!rango)return true;
  const f=fechaRefExpediente(e);
  if(!f)return false;
  return f>=rango.desde&&f<=rango.hasta;
}
function filterExpsPeriodo(list,prefix){
  const r=getPeriodoRango(prefix);
  if(!r)return list;
  return list.filter(e=>expEnPeriodo(e,r));
}
function labelPeriodo(prefix){
  const r=getPeriodoRango(prefix);
  if(!r)return'';
  return fmtF(r.desde)+' — '+fmtF(r.hasta);
}
function renderConsolidadoCortesPanel(amb,rango){
  const panel=document.getElementById('cons-cortes-panel');
  const res=document.getElementById('cons-periodo-resumen');
  if(!panel)return;
  if(!rango){
    if(res)res.textContent='';
    panel.innerHTML='';
    return;
  }
  if(res)res.textContent='Expedientes con fecha de referencia entre '+labelPeriodo('cons')+' · '+amb.length+' expediente(s)';
  const ano=parseInt((rango.desde||'').slice(0,4),10)||new Date().getFullYear();
  const cortes=[
    {l:'Año '+ano,v:amb.length},
    {l:'T1 (ene–mar)',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-01-01'&&f<=ano+'-03-31';}).length},
    {l:'T2 (abr–jun)',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-04-01'&&f<=ano+'-06-30';}).length},
    {l:'T3 (jul–sep)',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-07-01'&&f<=ano+'-09-30';}).length},
    {l:'T4 (oct–dic)',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-10-01'&&f<=ano+'-12-31';}).length},
    {l:'Sem. 1',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-01-01'&&f<=ano+'-06-30';}).length},
    {l:'Sem. 2',v:amb.filter(e=>{const f=fechaRefExpediente(e);return f>=ano+'-07-01'&&f<=ano+'-12-31';}).length}
  ];
  panel.innerHTML=cortes.map(c=>'<div class="cons-corte"><div class="v">'+c.v+'</div><div class="l">'+c.l+'</div></div>').join('');
}
function inferirEfectoActo(nom){
  const n=(nom||'').toLowerCase();
  if(n.includes('impone')&&n.includes('medida'))return'impone_mp';
  if(n.includes('levanta')&&n.includes('medida'))return'levanta_mp';
  if(n.includes('levanta')&&n.includes('suspensi'))return'levanta_susp';
  if(n.includes('suspende')||n.includes('suspensión')||n.includes('suspension'))return'suspende';
  if(n.includes('aprueba'))return'aprueba';
  return'';
}
function getTipoActo(nom){
  const t=(cfg.tiposActoAdmin||[]).find(x=>(x.nombre||x)===nom);
  const base=t?{...t}:{nombre:nom,tieneVencimiento:true};
  if(!base.efecto)base.efecto=inferirEfectoActo(base.nombre||nom);
  if(base.puedeTrasladoSan===undefined)base.puedeTrasladoSan=(base.efecto==='aprueba'||base.efecto==='impone_mp');
  return base;
}
// TIPOS_ACTO_DEF → js/constants.js
function ensureTiposActoAdminDefaults(){
  if(!cfg.tiposActoAdmin)cfg.tiposActoAdmin=[];
  TIPOS_ACTO_DEF.forEach(def=>{
    if(!cfg.tiposActoAdmin.some(t=>(t.nombre||t)===def.nombre))cfg.tiposActoAdmin.push({...def});
  });
  cfg.tiposActoAdmin.forEach(t=>{
    if(!t.efecto)t.efecto=inferirEfectoActo(t.nombre);
    if(t.puedeTrasladoSan===undefined)t.puedeTrasladoSan=(t.efecto==='aprueba'||t.efecto==='impone_mp');
  });
}
function computeFlagsFromActos(actos){
  let mp=false,sus=false,san=false,expSan='';
  const list=(actos||[]).map(normalizeActoProrrogas).filter(a=>a.fecha).sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  list.forEach(a=>{
    const eff=getTipoActo(a.tipo).efecto;
    if(eff==='impone_mp')mp=true;
    if(eff==='levanta_mp')mp=false;
    if(eff==='suspende')sus=true;
    if(eff==='levanta_susp')sus=false;
    if(a.trasladoSan){san=true;if(a.expSan)expSan=a.expSan;}
  });
  return{_medida_prev:mp,_suspendido:sus,_sancionatorio:san,_exp_sancionatorio:expSan};
}
function computeFlagsFromConceptos(cs){
  let san=false,expSan='';
  (cs||[]).forEach(c=>{
    if(c.trasladoSan){san=true;if(c.expSan)expSan=c.expSan;}
  });
  return{_sancionatorio:san,_exp_sancionatorio:expSan};
}
function mergeExpedienteFlags(actos,conceptos){
  const fa=computeFlagsFromActos(actos);
  const fc=computeFlagsFromConceptos(conceptos);
  return{
    _medida_prev:fa._medida_prev,
    _suspendido:fa._suspendido,
    _sancionatorio:fa._sancionatorio||fc._sancionatorio,
    _exp_sancionatorio:fc._exp_sancionatorio||fa._exp_sancionatorio
  };
}
function actoVenceHtml(a){
  const tipo=getTipoActo(a.tipo);
  if(!tipo.tieneVencimiento||a.archivoFecha)return'';
  const vig=vigenteActo(a);
  if(!vig)return'';
  return'<span style="font-size:11px;color:var(--tx2);margin-left:6px">Vence: '+fmtF(vig)+'</span>';
}
function actosVinculadosQuickHtml(){
  const tipos=(cfg.tiposActoAdmin||[]).filter(t=>{
    const e=t.efecto||inferirEfectoActo(t.nombre);
    return['impone_mp','levanta_mp','suspende','levanta_susp'].includes(e);
  });
  if(!tipos.length)return'';
  return'<div class="la-vinculados" style="margin-top:.7rem"><div class="slbl" style="font-size:11px;color:var(--tx2);margin-bottom:.4rem">Registrar acto vinculado (plazo vencido)</div><div class="fx" style="gap:4px;flex-wrap:wrap">'+
    tipos.map(t=>'<button type="button" class="btn bsm" onclick="addActoAdminTipo(\''+String(t.nombre||'').replace(/'/g,"\\'")+'\')">+ '+(t.nombre||'')+'</button>').join('')+
    '</div></div>';
}
function actoTrasladoSanHtml(a,tipo){
  if(!tipo.puedeTrasladoSan)return'';
  const on=!!a.trasladoSan;
  return'<div class="la-traslado-san" style="margin-top:.6rem;border-left:3px solid var(--pu);padding-left:.8rem">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500"><input type="checkbox" class="la-traslado"'+(on?' checked':'')+' onchange="toggleActoTraslado(this)" style="width:15px;height:15px;accent-color:var(--pu)"> Traslada a expediente sancionatorio</label>'+
    '<div class="la-exp-san-wrap fg" style="margin-top:.5rem;'+(on?'':'display:none')+'"><div class="fld"><label>N° expediente sancionatorio</label><input type="text" class="la-exp-san" value="'+escAttr(a.expSan||'')+'" oninput="syncActosAdmin()" placeholder="EXP-SAN-2026-001"></div></div></div>';
}
function toggleActoTraslado(cb){
  const row=cb.closest('.acto-admin');if(!row)return;
  const w=row.querySelector('.la-exp-san-wrap');
  if(w)w.style.display=cb.checked?'':'none';
  syncActosAdmin();
}
function calcReqVence(notif,dias){
  if(!notif||dias===''||dias===null)return'';
  const n=Number(dias);if(isNaN(n))return'';
  const d=new Date(notif+'T00:00:00');d.setDate(d.getDate()+n);
  return d.toISOString().split('T')[0];
}
function migrarActoProrroga(a){
  if(!a)return a;
  if(a.prorrogaFecha&&!a.prorrogaVenc&&!a.prorrogaNum){
    a.prorrogaVenc=a.prorrogaFecha;
    a.prorrogaFecha='';
  }
  return a;
}
function normalizeActoProrrogas(a){
  a=migrarActoProrroga(a||{});
  if(!Array.isArray(a.prorrogas)){
    a.prorrogas=[];
    if(a.prorrogaNum||a.prorrogaVenc)a.prorrogas.push({numero:a.prorrogaNum||'',vencimiento:a.prorrogaVenc||''});
  }
  return a;
}
function vigenteActo(a){
  a=normalizeActoProrrogas(a);
  if(a.archivoFecha)return'';
  const prs=(a.prorrogas||[]).filter(p=>p.vencimiento);
  if(prs.length)return prs[prs.length-1].vencimiento;
  return a.vencimiento||'';
}
function tieneProrrogasActo(a){
  a=normalizeActoProrrogas(a);
  return (a.prorrogas||[]).some(p=>p.numero||p.vencimiento);
}
function cleanActoForStore(a){
  a=normalizeActoProrrogas(a);
  delete a.prorrogaNum;delete a.prorrogaFecha;delete a.prorrogaVenc;
  return a;
}
function readActoFromRow(row){
  if(!row)return{};
  const prorrogas=Array.from(row.querySelectorAll('.la-prorroga-item')).map(item=>({
    numero:item.querySelector('.la-pr-num')?item.querySelector('.la-pr-num').value:'',
    vencimiento:item.querySelector('.la-pr-venc')?item.querySelector('.la-pr-venc').value:''
  })).filter(p=>p.numero||p.vencimiento);
  return{
    tipo:row.querySelector('.la-tipo')?row.querySelector('.la-tipo').value:'',
    numero:row.querySelector('.la-num')?row.querySelector('.la-num').value:'',
    fecha:row.querySelector('.la-fecha')?row.querySelector('.la-fecha').value:'',
    vencimiento:row.querySelector('.la-venc')?row.querySelector('.la-venc').value:'',
    prorrogas,
    trasladoSan:!!(row.querySelector('.la-traslado')&&row.querySelector('.la-traslado').checked),
    expSan:row.querySelector('.la-exp-san')?row.querySelector('.la-exp-san').value:'',
    archivoNum:row.querySelector('.la-archivo-num')?row.querySelector('.la-archivo-num').value:'',
    archivoFecha:row.querySelector('.la-archivo')?row.querySelector('.la-archivo').value:''
  };
}
function estadoActoAdmin(a){
  a=normalizeActoProrrogas(a||{});
  if(a.archivoFecha)return{archivada:true,prorroga:false,vencida:false};
  const tipo=getTipoActo(a.tipo);
  if(!tipo.tieneVencimiento)return{archivada:false,prorroga:false,vencida:false};
  const vig=vigenteActo(a);
  if(!vig)return{archivada:false,prorroga:false,vencida:false};
  const tieneProrroga=tieneProrrogasActo(a);
  if(vig>=hoy())return{archivada:false,prorroga:tieneProrroga,vencida:false};
  return{archivada:false,prorroga:false,vencida:true};
}
function prorrogaItemHtml(p,idx,canDel){
  const n=idx>0?' ('+(idx+1)+')':'';
  return '<div class="la-prorroga-item"><div class="fg" style="margin-bottom:.4rem">'+
    '<div class="fld"><label>N° acto que prorroga'+n+'</label><input type="text" class="la-pr-num" value="'+escAttr(p.numero||'')+'" oninput="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin();refreshActoFold(this)"></div>'+
    '<div class="fld"><label>Fecha vencimiento (prórroga)</label><input type="date" class="la-pr-venc" value="'+(p.vencimiento||'')+'" onchange="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin()"></div>'+
    (canDel?'<div class="fld" style="align-self:end"><button type="button" class="btn bsm bd2" onclick="delProrrogaActo(this)">✕</button></div>':'')+
    '</div></div>';
}
function prorrogasGestionHtml(a){
  a=normalizeActoProrrogas(a);
  const st=estadoActoAdmin(a);
  let h='<div class="la-prorrogas-list">';
  (a.prorrogas||[]).forEach((p,i)=>{h+=prorrogaItemHtml(p,i,i>0);});
  if(st.vencida&&!st.archivada){
    const prs=a.prorrogas||[];
    const last=prs[prs.length-1];
    if(!prs.length||(last&&last.numero&&last.vencimiento))h+=prorrogaItemHtml({numero:'',vencimiento:''},prs.length,false);
  }
  h+='</div>';
  if((a.prorrogas||[]).length&&st.vencida&&!st.archivada)
    h+='<button type="button" class="btn bsm" style="margin-top:4px" onclick="addProrrogaActo(this)">+ Otra prórroga</button>';
  return h;
}
function addProrrogaActo(btn){
  const row=btn.closest('.acto-admin');if(!row)return;
  const list=row.querySelector('.la-prorrogas-list');if(!list)return;
  const n=list.querySelectorAll('.la-prorroga-item').length;
  list.insertAdjacentHTML('beforeend',prorrogaItemHtml({numero:'',vencimiento:''},n,n>0));
  syncActosAdmin();
}
function delProrrogaActo(btn){
  confirmEliminar({message:'¿Eliminar esta prórroga del acto administrativo?'},()=>{
    const item=btn.closest('.la-prorroga-item');const row=btn.closest('.acto-admin');
    if(item&&row){item.remove();updateActoAdminRow(row);syncActosAdmin();}
  });
}
function estadoConceptoSeg(c){
  const cumple=c.cumple==='si'||c.cumple===true;
  if(cumple)return{noCumple:false,incumplio:false,cumplido:false};
  const noCumple=c.cumple==='no'||c.cumple===false;
  if(!noCumple)return{noCumple:false,incumplio:false,cumplido:false};
  if(c.reqCumplido)return{noCumple:true,incumplio:false,cumplido:true};
  const vence=c.reqVence||calcReqVence(c.reqNotif,c.reqDias);
  const incumplio=!!(vence&&vence<hoy());
  return{noCumple:true,incumplio,cumplido:false};
}
function legalFlags(e){
  const actos=actosAdminData(e._actos_admin);
  return{vencida:actos.some(a=>estadoActoAdmin(a).vencida),prorroga:actos.some(a=>estadoActoAdmin(a).prorroga),archivada:actos.some(a=>estadoActoAdmin(a).archivada)};
}
function segFlags(e){
  const cs=conceptosSegData(e._conceptos_seg);
  return{
    noCumple:cs.some(c=>{const st=estadoConceptoSeg(c);return st.noCumple&&!st.cumplido;}),
    incumplio:cs.some(c=>estadoConceptoSeg(c).incumplio)
  };
}
// escAttr, escTextarea, purifyPlainText, xssIsLikelyUrlField, xssIsLikelyDateOnly,
// sanitizeStringField, sanitizeJsonArrayField, sanitizeActoAdminJson,
// sanitizeTaskRecord, sanitizeHistRecord, sanitizeExpRecord,
// sanitizePersonaStrings, sanitizeChatMessage → js/utils.js
function sanitizeAgendaEvent(ev,ctx){
  if(!ev||typeof ev!=='object')return;
  ['titulo','descripcion','nota','lugar','responsable'].forEach(k=>{
    if(ev[k]!=null)ev[k]=sanitizeStringField(k,ev[k],ctx+'.'+k);
  });
}
function sanitizeActividadLibre(a,ctx){sanitizeTaskRecord(a,ctx);}
function sanitizeAllStoredData(){
  if(Array.isArray(exps))exps.forEach((e,i)=>sanitizeExpRecord(e,'load.exps['+i+']'));
  if(Array.isArray(personas))personas.forEach((p,i)=>sanitizePersonaStrings(p,'load.personas['+i+']'));
  if(Array.isArray(chatMensajes))chatMensajes.forEach((m,i)=>sanitizeChatMessage(m,'load.chat['+i+']'));
  if(Array.isArray(agendaEventos))agendaEventos.forEach((ev,i)=>sanitizeAgendaEvent(ev,'load.agenda['+i+']'));
  if(Array.isArray(actividadesLibres))actividadesLibres.forEach((a,i)=>sanitizeActividadLibre(a,'load.actLib['+i+']'));
}
function sanitizeImportPayload(data){
  if(!data||typeof data!=='object')return data;
  const exp=data.exp||data.expediente;
  if(exp&&typeof exp==='object')sanitizeExpRecord(exp,'import.exp');
  const arr=data.exps||data.expedientes;
  if(Array.isArray(arr))arr.forEach((e,i)=>sanitizeExpRecord(e,'import.exps['+i+']'));
  if(Array.isArray(data.personas))data.personas.forEach((p,i)=>sanitizePersonaStrings(p,'import.personas['+i+']'));
  if(Array.isArray(data.chatMensajes))data.chatMensajes.forEach((m,i)=>sanitizeChatMessage(m,'import.chat['+i+']'));
  if(Array.isArray(data.agendaEventos))data.agendaEventos.forEach((ev,i)=>sanitizeAgendaEvent(ev,'import.agenda['+i+']'));
  if(Array.isArray(data.actividadesLibres))data.actividadesLibres.forEach((a,i)=>sanitizeActividadLibre(a,'import.actLib['+i+']'));
  if(data.responsableActivo!=null)data.responsableActivo=purifyPlainText(data.responsableActivo,'import.responsableActivo');
  return data;
}
function foldSummary(label,flags){
  return '<summary>'+label+(flags||'')+'</summary>';
}
function facturaTipoOpts(v){
  const sel=v||'';
  return '<option value=""'+(!sel?' selected':'')+'>— Seleccione tipo de factura —</option>'+(cfg.tiposFactura||[]).map(t=>'<option value="'+t+'"'+(sel===t?' selected':'')+'>'+t+'</option>').join('');
}
function moneyRaw(v){
  v=String(v||'').replace(/[^\d.,]/g,'');
  if(!v)return'';
  const lastComma=v.lastIndexOf(','),lastDot=v.lastIndexOf('.');
  const decPos=Math.max(lastComma,lastDot);
  if(decPos>=0&&v.length-decPos<=3){
    const intp=v.slice(0,decPos).replace(/\D/g,'')||'0';
    const dec=v.slice(decPos+1).replace(/\D/g,'').slice(0,2);
    return dec?intp+'.'+dec:intp;
  }
  return v.replace(/\D/g,'');
}
function moneyFmt(v){
  const raw=moneyRaw(v);if(!raw)return'';
  const p=raw.split('.');
  const intp=p[0].replace(/^0+(?=\d)/,'')||'0';
  const dec=p[1]!==undefined?p[1]:'';
  return intp.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(dec!==''?','+dec:'');
}
function onMoneyInput(inp){inp.value=moneyFmt(inp.value);syncFacturasExtra();}
function moneyInputHtml(cls,val,onchange){
  return '<div class="money-wrap"><span>$</span><input type="text" inputmode="decimal" class="'+cls+'" value="'+moneyFmt(val)+'" oninput="onMoneyInput(this);'+(onchange||'')+'"></div>';
}
function acuerdoCuotasData(f){return Array.isArray(f&&f.acuerdoCuotas)?f.acuerdoCuotas:[];}
function acuerdoCuotaEnMora(c){return c&&c.fecha&&c.fecha<hoy()&&!c.pago;}
function facturaAcuerdoEnMora(f){
  if(!f||!f.acuerdoPago)return false;
  const cuotas=acuerdoCuotasData(f);
  if(cuotas.length)return cuotas.some(acuerdoCuotaEnMora);
  return f.venc&&f.venc<hoy()&&!f.pago&&!f.acuerdoDia;
}
function acuerdoCuotaRowHtml(c,i){
  c=c||{};
  const mora=acuerdoCuotaEnMora(c);
  return '<div class="fx-acu-cuota" style="display:grid;grid-template-columns:36px 1fr 1fr 1fr auto;gap:6px;align-items:end;margin-bottom:6px">'+
    '<span style="font-size:11px;color:var(--tx3);padding-bottom:8px">#'+(i+1)+'</span>'+
    '<div class="fld" style="margin:0"><label style="font-size:10px">Fecha corte</label><input type="date" class="fx-acu-fecha" value="'+(c.fecha||'')+'" onchange="syncFacturasExtra();onContableChange()"></div>'+
    '<div class="fld" style="margin:0"><label style="font-size:10px">Cuota</label>'+moneyInputHtml('fx-acu-monto',c.monto,'syncFacturasExtra()')+'</div>'+
    '<div class="fld" style="margin:0"><label style="font-size:10px">Pago</label><input type="date" class="fx-acu-pago" value="'+(c.pago||'')+'" onchange="syncFacturasExtra();onContableChange()"></div>'+
    (mora?'<span class="flag" style="background:var(--rdl);color:var(--rd);font-size:10px;margin-bottom:6px">Mora</span>':'<button type="button" class="btn bsm bic" style="margin-bottom:4px" onclick="delAcuerdoCuota(this)" title="Quitar">✕</button>')+
    '</div>';
}
function acuerdoCuotasBlockHtml(f){
  if(!f.acuerdoPago)return'';
  const cuotas=acuerdoCuotasData(f);
  const mora=facturaAcuerdoEnMora(f);
  return '<div class="factura-acu-cuotas" style="margin-top:.6rem;border-left:3px solid var(--bl);padding-left:.8rem">'+
    '<div class="slbl" style="margin-bottom:.4rem;color:var(--bl)">Fechas de corte — acuerdo de pago'+(mora?' · <span class="flag" style="background:var(--rdl);color:var(--rd)">En mora</span>':'')+'</div>'+
    '<div class="fg" style="margin-bottom:.4rem;align-items:flex-end;flex-wrap:wrap">'+
    '<div class="fld"><label>N° cuotas</label><input type="number" class="fx-acu-num" min="1" max="60" value="'+(f.acuerdoNumCuotas||cuotas.length||'')+'" style="width:72px;padding:6px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Primera fecha</label><input type="date" class="fx-acu-inicio" value="'+(f.acuerdoInicio||'')+'" style="padding:6px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<button type="button" class="btn bsm" onclick="generarCuotasAcuerdo(this)">Generar cuotas</button></div>'+
    '<div class="fx-acu-cuotas-list">'+cuotas.map((c,i)=>acuerdoCuotaRowHtml(c,i)).join('')+'</div>'+
    '<button type="button" class="btn bsm" style="margin-top:4px" onclick="addAcuerdoCuota(this)">+ Cuota</button></div>';
}
function readAcuerdoCuotasFromRow(row){
  return Array.from(row.querySelectorAll('.fx-acu-cuota')).map(el=>({
    fecha:el.querySelector('.fx-acu-fecha')?el.querySelector('.fx-acu-fecha').value:'',
    monto:moneyRaw(el.querySelector('.fx-acu-monto')?el.querySelector('.fx-acu-monto').value:''),
    pago:el.querySelector('.fx-acu-pago')?el.querySelector('.fx-acu-pago').value:''
  }));
}
function generarCuotasAcuerdo(btn){
  const row=btn.closest('.factura-extra');if(!row)return;
  const n=parseInt((row.querySelector('.fx-acu-num')||{}).value,10)||0;
  const inicio=(row.querySelector('.fx-acu-inicio')||{}).value;
  const total=moneyRaw(row.querySelector('.fx-valor')?row.querySelector('.fx-valor').value:'');
  if(n<1||!inicio){notif('Indique número de cuotas y primera fecha','err');return;}
  const cuotaM=total&&n?Math.round(total/n):0;
  const list=row.querySelector('.fx-acu-cuotas-list');if(!list)return;
  const parts=[];
  const d0=new Date(inicio+'T12:00:00');
  for(let i=0;i<n;i++){
    const d=new Date(d0);d.setMonth(d.getMonth()+i);
    parts.push({fecha:d.toISOString().slice(0,10),monto:cuotaM,pago:''});
  }
  list.innerHTML=parts.map((c,i)=>acuerdoCuotaRowHtml(c,i)).join('');
  syncFacturasExtra();onContableChange();
}
function addAcuerdoCuota(btn){
  const list=btn.closest('.factura-extra').querySelector('.fx-acu-cuotas-list');
  if(!list)return;
  const i=list.querySelectorAll('.fx-acu-cuota').length;
  list.insertAdjacentHTML('beforeend',acuerdoCuotaRowHtml({fecha:'',monto:'',pago:''},i));
  syncFacturasExtra();
}
function delAcuerdoCuota(btn){
  confirmEliminar({message:'¿Eliminar esta cuota del acuerdo de pago?'},()=>{
    btn.closest('.fx-acu-cuota').remove();syncFacturasExtra();onContableChange();
  });
}
function montoFacturaParaReporte(f){
  const val=moneyRaw(f.valor)||0;
  const cuotas=acuerdoCuotasData(f);
  if(f.acuerdoPago&&cuotas.length){
    let fact=0,pag=0,mora=0;
    cuotas.forEach(c=>{
      const m=moneyRaw(c.monto)||0;
      fact+=m;
      if(c.pago)pag+=m;
      else if(c.fecha&&c.fecha<hoy())mora+=m;
    });
    return {fact,pag,mora,pers:mora&&f.persVenc?mora:0,coac:mora&&f.coacFecha?mora:0};
  }
  const pag=f.pago&&val?val:0;
  const mora=!f.pago&&f.venc&&f.venc<hoy()?val:0;
  return {fact:val,pag,mora,pers:mora&&f.persVenc?val:0,coac:mora&&f.coacFecha?val:0};
}
function calcReporteContable(amb){
  let facturado=0,pagado=0,mora=0,persuasivo=0,coactivo=0;
  (amb||[]).forEach(e=>{
    facturasData(e._facturas_extra).forEach(f=>{
      const m=montoFacturaParaReporte(f);
      facturado+=m.fact;pagado+=m.pag;mora+=m.mora;persuasivo+=m.pers;coactivo+=m.coac;
    });
  });
  return {facturado,pagado,mora,persuasivo,coactivo};
}
function facturaRowHtml(f,i){
  f=f||{};
  const enMora=f.venc&&f.venc<hoy()&&!f.pago;
  const enCoactivo=enMora&&f.persVenc&&f.persVenc<hoy();
  const tit=(f.tipo||'Factura')+(f.ref?' · '+f.ref:'')+(enMora?' · <span class="flag" style="background:var(--rdl);color:var(--rd)">Mora</span>':'');
  return '<details class="item-fold factura-extra">'+
    foldSummary(tit)+
    '<div class="item-fold-body"><div class="fg">'+
    '<div class="fld"><label>Tipo factura</label><select class="fx-tipo" onchange="syncFacturasExtra();refreshFacturaFold(this)">'+facturaTipoOpts(f.tipo||'')+'</select></div>'+
    '<div class="fld"><label>Valor factura (pesos)</label>'+moneyInputHtml('fx-valor',f.valor,'syncFacturasExtra()')+'</div>'+
    '<div class="fld"><label>Referencia</label><input type="text" class="fx-ref" value="'+escAttr(f.ref||'')+'" oninput="syncFacturasExtra();refreshFacturaFold(this)"></div>'+
    '<div class="fld"><label>Fecha vencimiento</label><input type="date" class="fx-venc" value="'+(f.venc||'')+'" onchange="updateFacturaCobro(this.closest(\'.factura-extra\'));syncFacturasExtra();onContableChange();refreshFacturaFold(this)"></div>'+
    '<div class="fld"><label>Fecha pago</label><input type="date" class="fx-pago" value="'+(f.pago||'')+'" onchange="updateFacturaCobro(this.closest(\'.factura-extra\'));syncFacturasExtra();onContableChange();refreshFacturaFold(this)"></div>'+
    '</div>'+
    '<div class="factura-cobro" style="'+(enMora?'':'display:none')+';margin-top:.7rem;border-left:3px solid var(--rd);padding-left:.8rem">'+
    '<div class="slbl" style="margin-bottom:.5rem;color:var(--rd)">Gestión de cobro de esta factura</div><div class="fg">'+
    '<div class="fld"><label>Fecha vence factura persuasivo</label><input type="date" class="fx-pers-venc" value="'+(f.persVenc||'')+'" onchange="updateFacturaCobro(this.closest(\'.factura-extra\'));syncFacturasExtra();onContableChange()"></div>'+
    '<div class="fld factura-coactivo" style="'+(enCoactivo||f.coacFecha?'':'display:none')+'"><label>Fecha enviar coactivo</label><input type="date" class="fx-coac-fecha" value="'+(f.coacFecha||'')+'" onchange="syncFacturasExtra();onContableChange()"></div>'+
    '</div></div>'+
    '<div class="factura-acuerdo" style="'+(enMora||f.acuerdoPago?'':'display:none')+';margin-top:.7rem;border-left:3px solid var(--bl);padding-left:.8rem">'+
    '<div class="slbl" style="margin-bottom:.5rem;color:var(--bl)">Acuerdo de pago de esta factura</div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500"><input type="checkbox" class="fx-acuerdo"'+(f.acuerdoPago?' checked':'')+' onchange="toggleFacturaAcuerdo(this);syncFacturasExtra();onContableChange()" style="width:15px;height:15px;accent-color:var(--bl)"> Tiene acuerdo de pago</label>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-top:.5rem"><input type="checkbox" class="fx-acuerdo-dia"'+(f.acuerdoDia?' checked':'')+' onchange="syncFacturasExtra();onContableChange()" style="width:15px;height:15px;accent-color:var(--bl)"> Está al día</label>'+
    acuerdoCuotasBlockHtml(f)+
    '</div>'+
    '<div class="ar"><button class="btn bsm bd2" type="button" onclick="delFacturaExtra(this)">Eliminar</button></div></div></details>';
}
function toggleFacturaAcuerdo(chk){
  const row=chk.closest('.factura-extra');if(!row)return;
  const blk=row.querySelector('.factura-acu-cuotas');
  if(chk.checked&&!blk){
    const ac=row.querySelector('.factura-acuerdo');
    if(ac)ac.insertAdjacentHTML('beforeend',acuerdoCuotasBlockHtml({acuerdoPago:true,acuerdoCuotas:[]}));
  }else if(!chk.checked&&blk)blk.remove();
}
function refreshFacturaFold(el){
  const row=el.closest('.factura-extra');if(!row)return;
  const tipo=row.querySelector('.fx-tipo')?row.querySelector('.fx-tipo').value:'';
  const ref=row.querySelector('.fx-ref')?row.querySelector('.fx-ref').value:'';
  const venc=row.querySelector('.fx-venc')?row.querySelector('.fx-venc').value:'';
  const pago=row.querySelector('.fx-pago')?row.querySelector('.fx-pago').value:'';
  const mora=venc&&venc<hoy()&&!pago;
  const sum=row.querySelector('summary');
  if(sum)sum.innerHTML=escAttr(tipo||'Factura')+(ref?' · '+escAttr(ref):'')+(mora?' · <span class="flag" style="background:var(--rdl);color:var(--rd)">Mora</span>':'');
}
function contableHtml(ev){
  migrarAcuerdoGlobal(ev);
  const extras=facturasData(ev._facturas_extra);
  return '<details class="form-section"><summary class="form-section-hdr" style="cursor:pointer">Información contable</summary><div class="form-section-body">'+
    '<input type="hidden" id="fld__facturas_extra" value=\''+escAttr(ev._facturas_extra||'[]')+'\'><div id="facturas-extra">'+extras.map((f,i)=>facturaRowHtml(f,i)).join('')+'</div><button class="btn bsm" type="button" onclick="addFacturaExtra()">+ Añadir factura</button>'+btnGuardarSeccion()+
  '</div></details>';
}
function actoTipoOpts(v){
  const sel=v||'';
  return '<option value=""'+(!sel?' selected':'')+'>— Seleccione —</option>'+(cfg.tiposActoAdmin||[]).map(t=>{const n=t.nombre||t;return '<option value="'+n+'"'+(sel===n?' selected':'')+'>'+n+'</option>';}).join('');
}
function actoAdminRowHtml(a,i){
  a=normalizeActoProrrogas(a||{});
  const st=estadoActoAdmin(a);
  const tipo=getTipoActo(a.tipo);
  let flags='';
  if(st.archivada)flags+=' <span class="flag flag-arch-acto">Archivada</span>';
  else if(st.prorroga)flags+=' <span class="flag flag-prorroga">Prórroga</span>';
  else if(st.vencida)flags+=' <span class="flag flag-venc-acto">Vencida</span>';
  const tit=(a.tipo||'Acto')+(a.numero?' · '+a.numero:'')+flags;
  const showVenc=tipo.tieneVencimiento&&!st.archivada;
  const showGestion=tipo.tieneVencimiento&&!st.archivada&&(st.vencida||tieneProrrogasActo(a)||a.archivoFecha||a.archivoNum);
  const prorrogaHint=st.vencida&&!st.archivada?'<div style="font-size:11px;color:var(--am);margin-bottom:.5rem">Plazo vencido: registre prórroga, acto vinculado o archive el acto.</div>':'';
  const vincHtml=st.vencida&&!st.archivada&&tipo.tieneVencimiento?actosVinculadosQuickHtml():'';
  return '<details class="item-fold acto-admin">'+
    foldSummary(tit)+
    '<div class="item-fold-body"><div class="fg">'+
    '<div class="fld"><label>Tipo de acto administrativo</label><select class="la-tipo" onchange="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin()">'+actoTipoOpts(a.tipo||'')+'</select></div>'+
    '<div class="fld"><label>N° acto administrativo</label><input type="text" class="la-num" value="'+escAttr(a.numero||'')+'" oninput="syncActosAdmin();refreshActoFold(this)"></div>'+
    '<div class="fld"><label>Fecha del acto</label><input type="date" class="la-fecha" value="'+(a.fecha||'')+'" onchange="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin()"></div>'+
    '<div class="fld la-venc-wrap" style="'+(showVenc?'':'display:none')+'"><label>Fecha de vencimiento</label><input type="date" class="la-venc" value="'+(a.vencimiento||'')+'" onchange="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin()"></div>'+
    '</div>'+
    actoTrasladoSanHtml(a,tipo)+
    '<div class="la-gestion" style="'+(showGestion?'':'display:none')+';margin-top:.7rem;border-left:3px solid var(--am);padding-left:.8rem">'+
    '<div class="slbl" style="margin-bottom:.5rem;color:var(--am)">Prórroga o archivo</div>'+prorrogaHint+
    '<div class="slbl" style="margin:.4rem 0;font-size:11px;color:var(--tx2)">Prórrogas</div>'+
    prorrogasGestionHtml(a)+vincHtml+
    '<div class="slbl" style="margin:.8rem 0 .4rem;font-size:11px;color:var(--tx2)">Acto que archiva</div>'+
    '<div class="fg"><div class="fld"><label>N° acto administrativo que archiva</label><input type="text" class="la-archivo-num" value="'+escAttr(a.archivoNum||'')+'" oninput="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin();refreshActoFold(this)"></div>'+
    '<div class="fld"><label>Fecha de archivo</label><input type="date" class="la-archivo" value="'+(a.archivoFecha||'')+'" onchange="updateActoAdminRow(this.closest(\'.acto-admin\'));syncActosAdmin()"></div></div>'+
    '</div>'+
    '<div class="ar"><button class="btn bsm bd2" type="button" onclick="delActoAdmin(this)">Eliminar</button></div></div></details>';
}
function updateActoAdminRow(row){
  if(!row)return;
  const a=readActoFromRow(row);
  const tipo=getTipoActo(a.tipo);
  const vencW=row.querySelector('.la-venc-wrap');
  if(vencW)vencW.style.display=tipo.tieneVencimiento&&!estadoActoAdmin(a).archivada?'':'none';
  const st=estadoActoAdmin(a);
  const gest=row.querySelector('.la-gestion');
  if(gest)gest.style.display=(tipo.tieneVencimiento&&!st.archivada&&(st.vencida||tieneProrrogasActo(a)||a.archivoFecha||a.archivoNum))?'':'none';
  const tr=row.querySelector('.la-traslado-san');
  if(tr)tr.style.display=tipo.puedeTrasladoSan?'':'none';
  const list=row.querySelector('.la-prorrogas-list');
  if(list&&st.vencida&&!st.archivada){
    const items=list.querySelectorAll('.la-prorroga-item');
    const hasEmpty=Array.from(items).some(it=>{
      const n=it.querySelector('.la-pr-num')?it.querySelector('.la-pr-num').value:'';
      const v=it.querySelector('.la-pr-venc')?it.querySelector('.la-pr-venc').value:'';
      return !n&&!v;
    });
    const last=items[items.length-1];
    const lastNum=last&&last.querySelector('.la-pr-num')?last.querySelector('.la-pr-num').value:'';
    const lastV=last&&last.querySelector('.la-pr-venc')?last.querySelector('.la-pr-venc').value:'';
    if(!hasEmpty&&last&&lastNum&&lastV)list.insertAdjacentHTML('beforeend',prorrogaItemHtml({numero:'',vencimiento:''},items.length,false));
    if(!items.length&&!hasEmpty)list.insertAdjacentHTML('beforeend',prorrogaItemHtml({numero:'',vencimiento:''},0,false));
  }
  refreshActoFold(row.querySelector('.la-num')||row);
}
function refreshActoFold(el){
  const row=el.closest('.acto-admin');if(!row)return;
  const a=readActoFromRow(row);
  const st=estadoActoAdmin(a);
  let flags='';
  if(st.archivada)flags=' <span class="flag flag-arch-acto">Archivada</span>';
  else if(st.prorroga)flags=' <span class="flag flag-prorroga">Prórroga</span>';
  else if(st.vencida)flags=' <span class="flag flag-venc-acto">Vencida</span>';
  const sum=row.querySelector('summary');
  if(sum)sum.innerHTML=escAttr(a.tipo||'Acto')+(a.numero?' · '+escAttr(a.numero):'')+flags;
}
function normativaHtml(ev){
  const actos=actosAdminData(ev._actos_admin);
  return '<details class="form-section"><summary class="form-section-hdr" style="cursor:pointer">Normatividad / legal</summary><div class="form-section-body">'+
    '<input type="hidden" id="fld__actos_admin" value=\''+escAttr(ev._actos_admin||'[]')+'\'><div id="actos-admin-list">'+actos.map((a,i)=>actoAdminRowHtml(a,i)).join('')+'</div>'+
    '<button class="btn bsm" type="button" onclick="addActoAdmin()">+ Añadir acto administrativo</button>'+btnGuardarSeccion()+'</div></details>';
}
function btnGuardarSeccion(){return '<div class="ar section-save"><button class="btn bsm bp" type="button" onclick="guardarExp(true)">💾 '+(editId?'Actualizar sección':'Guardar')+'</button></div>';}
function syncActosAdmin(){
  const arr=Array.from(document.querySelectorAll('#actos-admin-list .acto-admin')).map(r=>cleanActoForStore(readActoFromRow(r)));
  const hid=document.getElementById('fld__actos_admin');if(hid)hid.value=JSON.stringify(arr);
}
function addActoAdmin(){
  const c=document.getElementById('actos-admin-list');
  c.insertAdjacentHTML('beforeend',actoAdminRowHtml({tipo:''},c.children.length));
  syncActosAdmin();
}
function addActoAdminTipo(nombreTipo){
  const c=document.getElementById('actos-admin-list');
  if(!c)return;
  c.insertAdjacentHTML('beforeend',actoAdminRowHtml({tipo:nombreTipo,fecha:hoy()},c.children.length));
  syncActosAdmin();
  notif('Acto agregado: '+nombreTipo,'ok');
}
function delActoAdmin(btn){
  confirmEliminar({message:'¿Eliminar este acto administrativo?'},()=>{
    btn.closest('.acto-admin').remove();syncActosAdmin();
  });
}
function collectActosAdmin(){syncActosAdmin();return{_actos_admin:gv('fld__actos_admin')||'[]'};}
function conceptoSegRowHtml(c,i){
  c=c||{};
  const st=estadoConceptoSeg(c);
  let flags='';
  if(st.cumplido)flags+=' <span class="flag" style="background:var(--gnl);color:var(--gn);border:1px solid #9fe1cb">Requerimiento cumplido</span>';
  else if(st.incumplio)flags+=' <span class="flag flag-incumple">Incumplió requerimiento</span>';
  else if(st.noCumple)flags+=' <span class="flag flag-ncumple">No cumple</span>';
  const tit='Concepto '+(c.concepto||('#'+(i+1)))+flags;
  const noCumple=c.cumple==='no'||c.cumple===false;
  const reqCumplido=!!c.reqCumplido;
  return '<details class="item-fold concepto-seg">'+
    foldSummary(tit)+
    '<div class="item-fold-body"><div class="fg">'+
    '<div class="fld"><label>Fecha seguimiento</label><input type="date" class="cs-fecha" value="'+(c.fecha||'')+'" onchange="syncConceptosSeg();refreshConceptoFold(this)"></div>'+
    '<div class="fld"><label>N° concepto técnico</label><input type="text" class="cs-concepto" value="'+escAttr(c.concepto||'')+'" oninput="syncConceptosSeg();refreshConceptoFold(this)"></div>'+
    '<div class="fld" style="grid-column:1/-1"><label>Observaciones / recomendaciones</label><textarea class="cs-obs" style="min-height:55px" oninput="syncConceptosSeg()">'+escTextarea(c.observaciones||'')+'</textarea></div>'+
    '<div class="fld"><label>¿Cumple?</label><select class="cs-cumple" onchange="updateConceptoSegRow(this.closest(\'.concepto-seg\'));syncConceptosSeg()"><option value="si"'+(c.cumple==='si'||c.cumple===true?' selected':'')+'>Cumple</option><option value="no"'+(noCumple?' selected':'')+'>No cumple</option></select></div>'+
    '</div>'+
    '<div class="cs-req" style="'+(noCumple?'':'display:none')+';margin-top:.7rem;border-left:3px solid var(--or);padding-left:.8rem">'+
    '<div class="slbl" style="margin-bottom:.5rem;color:var(--or)">Requerimiento por incumplimiento</div><div class="fg">'+
    '<div class="fld"><label>N° requerimiento</label><input type="text" class="cs-req-num" value="'+escAttr(c.reqNum||'')+'" oninput="syncConceptosSeg();refreshConceptoFold(this)"></div>'+
    '<div class="fld"><label>Fecha notificación</label><input type="date" class="cs-req-notif" value="'+(c.reqNotif||'')+'" onchange="updateConceptoSegRow(this.closest(\'.concepto-seg\'));syncConceptosSeg()"></div>'+
    '<div class="fld"><label>Días para cumplir</label><input type="number" class="cs-req-dias" min="0" value="'+(c.reqDias||'')+'" oninput="updateConceptoSegRow(this.closest(\'.concepto-seg\'));syncConceptosSeg()"></div>'+
    '<div class="fld"><label>Fecha límite cumplimiento</label><input type="date" class="cs-req-vence" value="'+(c.reqVence||calcReqVence(c.reqNotif,c.reqDias)||'')+'" readonly style="background:var(--sf2)"></div>'+
    '</div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-top:.6rem"><input type="checkbox" class="cs-req-cumplido"'+(reqCumplido?' checked':'')+' onchange="toggleConceptoReqCumplido(this)" style="width:15px;height:15px;accent-color:var(--gn)"> Requerimiento ya cumplido</label>'+
    '<div class="cs-req-cump-fecha fg" style="margin-top:.5rem;'+(reqCumplido?'':'display:none')+'"><div class="fld"><label>Fecha de cumplimiento<span class="req-star">*</span></label><input type="date" class="cs-req-fecha-cump" value="'+(c.reqFechaCump||'')+'" onchange="syncConceptosSeg();refreshConceptoFold(this)"></div></div>'+
    '</div></div>'+
    '<div class="cs-san" style="'+(noCumple?'':'display:none')+';margin-top:.7rem;border-left:3px solid var(--pu);padding-left:.8rem">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500"><input type="checkbox" class="cs-traslado-san"'+(c.trasladoSan?' checked':'')+' onchange="toggleConceptoTraslado(this)" style="width:15px;height:15px;accent-color:var(--pu)"> Traslada a expediente sancionatorio (p. ej. queja con concepto técnico)</label>'+
    '<div class="cs-exp-san-wrap fg" style="margin-top:.5rem;'+(c.trasladoSan?'':'display:none')+'"><div class="fld"><label>N° expediente sancionatorio</label><input type="text" class="cs-exp-san" value="'+escAttr(c.expSan||'')+'" oninput="syncConceptosSeg()" placeholder="EXP-SAN-2026-001"></div></div></div>'+
    '<div class="ar"><button class="btn bsm bd2" type="button" onclick="delConceptoSeg(this)">Eliminar</button></div></div></details>';
}
function toggleConceptoTraslado(cb){
  const row=cb.closest('.concepto-seg');if(!row)return;
  const w=row.querySelector('.cs-exp-san-wrap');
  if(w)w.style.display=cb.checked?'':'none';
  syncConceptosSeg();
}
function toggleConceptoReqCumplido(cb){
  const row=cb.closest('.concepto-seg');if(!row)return;
  const box=row.querySelector('.cs-req-cump-fecha');
  if(box)box.style.display=cb.checked?'':'none';
  if(cb.checked){
    const fc=row.querySelector('.cs-req-fecha-cump');
    if(fc&&!fc.value)fc.value=hoy();
  }
  syncConceptosSeg();
  refreshConceptoFold(cb);
}
function updateConceptoSegRow(row){
  if(!row)return;
  const cumple=row.querySelector('.cs-cumple').value;
  const req=row.querySelector('.cs-req');
  if(req)req.style.display=cumple==='no'?'':'none';
  const san=row.querySelector('.cs-san');
  if(san)san.style.display=cumple==='no'?'':'none';
  if(cumple!=='no'){
    const rc=row.querySelector('.cs-req-cumplido');if(rc)rc.checked=false;
    const box=row.querySelector('.cs-req-cump-fecha');if(box)box.style.display='none';
  }
  const notif=row.querySelector('.cs-req-notif')?row.querySelector('.cs-req-notif').value:'';
  const dias=row.querySelector('.cs-req-dias')?row.querySelector('.cs-req-dias').value:'';
  const venceEl=row.querySelector('.cs-req-vence');
  if(venceEl)venceEl.value=calcReqVence(notif,dias);
  refreshConceptoFold(row.querySelector('.cs-concepto')||row);
}
function refreshConceptoFold(el){
  const row=el.closest('.concepto-seg');if(!row)return;
  const rc=row.querySelector('.cs-req-cumplido');
  const c={
    fecha:row.querySelector('.cs-fecha').value,
    concepto:row.querySelector('.cs-concepto').value,
    cumple:row.querySelector('.cs-cumple').value,
    reqNotif:row.querySelector('.cs-req-notif')?row.querySelector('.cs-req-notif').value:'',
    reqDias:row.querySelector('.cs-req-dias')?row.querySelector('.cs-req-dias').value:'',
    reqVence:row.querySelector('.cs-req-vence')?row.querySelector('.cs-req-vence').value:'',
    reqCumplido:!!(rc&&rc.checked),
    reqFechaCump:row.querySelector('.cs-req-fecha-cump')?row.querySelector('.cs-req-fecha-cump').value:''
  };
  const st=estadoConceptoSeg(c);
  let flags='';
  if(st.cumplido)flags=' <span class="flag" style="background:var(--gnl);color:var(--gn);border:1px solid #9fe1cb">Requerimiento cumplido</span>';
  else if(st.incumplio)flags=' <span class="flag flag-incumple">Incumplió requerimiento</span>';
  else if(st.noCumple)flags=' <span class="flag flag-ncumple">No cumple</span>';
  const sum=row.querySelector('summary');
  if(sum)sum.innerHTML='Concepto '+escAttr(c.concepto||'sin número')+flags;
}
function migrarSegLegacy(ev){
  if(ev._conceptos_seg&&ev._conceptos_seg!=='[]')return;
  if(ev._fecha_seg||ev._obs_seg){
    ev._conceptos_seg=JSON.stringify([{fecha:ev._fecha_seg||hoy(),concepto:'',observaciones:ev._obs_seg||'',cumple:'si'}]);
  }
}
function seguimientoHtml(ev){
  migrarSegLegacy(ev);
  const list=conceptosSegData(ev._conceptos_seg);
  const show=ev._estado==='Seguimiento';
  return '<details class="form-section" id="seg-section" style="'+(show?'':'display:none')+'" ontoggle="onSegSectionToggle()">'+
    '<summary class="form-section-hdr">Seguimiento</summary>'+
    '<div class="form-section-body seg-section-body">'+
    '<input type="hidden" id="fld__conceptos_seg" value=\''+escAttr(ev._conceptos_seg||'[]')+'\'>'+
    '<div id="conceptos-seg-list">'+list.map((c,i)=>conceptoSegRowHtml(c,i)).join('')+'</div>'+
    '<div class="seg-inner-tools" id="seg-add-wrap">'+
    '<button class="btn bsm" type="button" onclick="addConceptoSeg()">+ Añadir concepto de seguimiento</button>'+
    btnGuardarSeccion()+'</div></div></details>';
}
function syncSeguimientoUi(){
  const v=gv('fld__estado');
  const s=document.getElementById('seg-section');
  if(!s)return;
  if(v==='Seguimiento')s.style.display='';
  else{s.style.display='none';s.open=false;}
  onSegSectionToggle();
}
function onSegSectionToggle(){
  const s=document.getElementById('seg-section');
  const wrap=document.getElementById('seg-add-wrap');
  if(!wrap||!s)return;
  const show=s.style.display!=='none'&&gv('fld__estado')==='Seguimiento'&&s.open;
  wrap.style.display=show?'':'none';
}
function syncConceptosSeg(){
  const arr=Array.from(document.querySelectorAll('#conceptos-seg-list .concepto-seg')).map(r=>{
    const notif=r.querySelector('.cs-req-notif')?r.querySelector('.cs-req-notif').value:'';
    const dias=r.querySelector('.cs-req-dias')?r.querySelector('.cs-req-dias').value:'';
    const reqCumplido=!!(r.querySelector('.cs-req-cumplido')&&r.querySelector('.cs-req-cumplido').checked);
    const q=r.querySelector.bind(r);
    return {
      fecha:q('.cs-fecha')?q('.cs-fecha').value:'',
      concepto:q('.cs-concepto')?q('.cs-concepto').value:'',
      observaciones:q('.cs-obs')?q('.cs-obs').value:'',
      cumple:q('.cs-cumple')?q('.cs-cumple').value:'',
      reqNum:r.querySelector('.cs-req-num')?r.querySelector('.cs-req-num').value:'',
      reqNotif:notif,
      reqDias:dias,
      reqVence:calcReqVence(notif,dias),
      reqCumplido:reqCumplido,
      reqFechaCump:reqCumplido&&r.querySelector('.cs-req-fecha-cump')?r.querySelector('.cs-req-fecha-cump').value:'',
      trasladoSan:!!(r.querySelector('.cs-traslado-san')&&r.querySelector('.cs-traslado-san').checked),
      expSan:r.querySelector('.cs-exp-san')?r.querySelector('.cs-exp-san').value:''
    };
  });
  const hid=document.getElementById('fld__conceptos_seg');if(hid)hid.value=JSON.stringify(arr);
}
function addConceptoSeg(){
  document.getElementById('conceptos-seg-list').insertAdjacentHTML('beforeend',conceptoSegRowHtml({fecha:hoy(),cumple:'si'},999));
  syncConceptosSeg();
}
function delConceptoSeg(btn){
  confirmEliminar({message:'¿Eliminar este concepto de seguimiento?'},()=>{
    btn.closest('.concepto-seg').remove();syncConceptosSeg();
  });
}
function collectConceptosSeg(){syncConceptosSeg();return{_conceptos_seg:gv('fld__conceptos_seg')||'[]'};}
function fechasEstadoStoreHtml(ev){
  const fechas=getFechasEstado(ev);
  return '<div id="fechas-estado-store" style="display:none">'+ESTADOS.map(est=>'<input type="hidden" class="fe-store" data-estado="'+est+'" value="'+(fechas[est]||'')+'">').join('')+'</div>';
}
function persistFechaEstadoVisible(){
  const est=gv('fld__estado')||'Solicitud';
  const vis=document.getElementById('fld__fecha_estado');
  const store=document.querySelector('.fe-store[data-estado="'+est+'"]');
  if(store&&vis)store.value=vis.value;
  if(est==='Solicitud'){
    const hid=document.getElementById('fld__fecha');
    if(hid&&vis)hid.value=vis.value;
  }
}
function syncFechaEstadoVisible(){
  const est=gv('fld__estado')||'Solicitud';
  const lbl=document.getElementById('lbl-fecha-estado');
  if(lbl)lbl.textContent='Fecha del estado';
  const store=document.querySelector('.fe-store[data-estado="'+est+'"]');
  const vis=document.getElementById('fld__fecha_estado');
  if(vis){
    if(store&&store.value)vis.value=store.value;
    else if(!vis.value)vis.value=hoy();
  }
}
function onFechaEstadoVisibleChange(){
  persistFechaEstadoVisible();
}
function onFechaEstadoChange(){}
function syncFechaSolicitud(){
  const store=document.querySelector('.fe-store[data-estado="Solicitud"]');
  const hid=document.getElementById('fld__fecha');
  if(store&&hid)store.value=hid.value;
}
function collectFechasEstado(){
  persistFechaEstadoVisible();
  const o={};
  document.querySelectorAll('.fe-store').forEach(inp=>{if(inp.value)o[inp.dataset.estado]=inp.value;});
  const est=gv('fld__estado')||'Solicitud';
  const vis=document.getElementById('fld__fecha_estado');
  if(vis&&vis.value)o[est]=vis.value;
  if(!o.Solicitud)o.Solicitud=document.getElementById('fld__fecha')?document.getElementById('fld__fecha').value:'';
  if(!o.Solicitud)o.Solicitud=o[est]||hoy();
  if(!o[est])o[est]=o.Solicitud;
  return{_fechas_estado:JSON.stringify(o),_fecha:o.Solicitud};
}
function syncFechasEstadoConEstado(data){
  const fe=getFechasEstado(data);
  const est=data._estado||'Solicitud';
  if(!isArchivadoEstado(est))delete fe['Archivado o anulado'];
  if(est!=='Seguimiento'&&!isArchivadoEstado(est))delete fe.Seguimiento;
  if(est==='Solicitud'||est==='En trámite'){
    delete fe.Atendido;
    delete fe.Seguimiento;
    delete fe['Archivado o anulado'];
  }
  if(est==='Atendido'){
    delete fe.Seguimiento;
    delete fe['Archivado o anulado'];
  }
  data._fechas_estado=JSON.stringify(fe);
  data._fecha=fe.Solicitud||data._fecha||'';
}
function clasificarActoEstado(tipo){
  const n=(tipo||'').toLowerCase();
  if(n==='auto de archivo'||(n.includes('resolución')||n.includes('resolucion'))&&n.includes('archiv'))return{estado:'Archivado o anulado',key:'Archivado o anulado'};
  if(n.includes('archiv')&&!n.includes('aprueba')&&!n.includes('medida')&&!n.includes('prórroga')&&!n.includes('prorroga'))return{estado:'Archivado o anulado',key:'Archivado o anulado'};
  if(n.includes('aprueba')||n.includes('niega'))return{estado:'Atendido',key:'Atendido'};
  return null;
}
function applyAutoEstadoFromActos(data,actos){
  const candidates=[];
  (actos||[]).forEach(a=>{
    if(!a.fecha)return;
    const c=clasificarActoEstado(a.tipo);
    if(c)candidates.push({...c,fecha:a.fecha,numero:a.numero||''});
  });
  if(!candidates.length)return false;
  candidates.sort((a,b)=>{
    if(b.fecha!==a.fecha)return b.fecha.localeCompare(a.fecha);
    const pa=a.estado==='Archivado o anulado'?1:0;
    const pb=b.estado==='Archivado o anulado'?1:0;
    return pb-pa;
  });
  const win=candidates[0];
  data._estado=win.estado;
  const fe=getFechasEstado(data);
  fe[win.key]=win.fecha;
  if(win.estado==='Atendido'){
    if(win.numero)data._resolucion=win.numero;
    data._fecha_res=win.fecha;
  }
  data._fechas_estado=JSON.stringify(fe);
  return true;
}
function rebuildHistorial(data,prevHist){
  const fe=getFechasEstado(data);
  const hist=[];
  const fSol=fe.Solicitud||data._fecha||'';
  if(fSol)hist.push({fase:'tramite',etapa:'Solicitud',fecha:fSol,desc:'Apertura del proceso / trámite'});
  const tram=getTram(data._tramite,data);
  if(data._usar_etapa&&data._etapa&&tram&&(tram.etapas||[]).length){
    const etapas=tram.etapas;
    const si=etapas.indexOf(data._etapa);
    etapas.forEach((eta,i)=>{
      if(si>=0&&i>si)return;
      const hi=(prevHist||[]).find(h=>h.fase==='tramite'&&h.etapa===eta);
      if(hi)hist.push({...hi});
      else if(eta===data._etapa){
        const f=fe['En trámite']||fe.Solicitud||fSol;
        if(f)hist.push({fase:'tramite',etapa:eta,fecha:f,desc:'Avance a: '+eta});
      }
    });
  }else{
    const fTram=fe['En trámite'];
    if(fTram&&(data._estado==='En trámite'||fe.Atendido||fe.Seguimiento||isArchivadoEstado(data._estado)))
      hist.push({fase:'tramite',etapa:'En trámite',fecha:fTram,desc:'En trámite'});
  }
  const fAte=fe.Atendido;
  if(fAte&&(data._estado==='Atendido'||data._estado==='Seguimiento'||isArchivadoEstado(data._estado)))
    hist.push({fase:'atencion',etapa:'Atendido',fecha:fAte,desc:'Trámite atendido'+(data._resolucion?' - '+data._resolucion:'')});
  const fSeg=fe.Seguimiento;
  if(fSeg&&(data._estado==='Seguimiento'||isArchivadoEstado(data._estado)))
    hist.push({fase:'seguimiento',etapa:'Inicio de seguimiento',fecha:fSeg,desc:'Expediente en seguimiento'});
  const fArch=fe['Archivado o anulado'];
  if(fArch&&isArchivadoEstado(data._estado))
    hist.push({fase:'archivo',etapa:'Archivado o anulado',fecha:fArch,desc:'Expediente archivado o anulado'});
  return hist;
}
function medioNotificacionNorm(v){return !v||v==='no_indica'?'':String(v);}
function medioNotificacionLabel(v){
  v=medioNotificacionNorm(v);
  if(!v)return 'No indica';
  if(v==='electronica')return 'Correo electrónico';
  if(v==='fisica')return 'Notificación física';
  if(v==='whatsapp')return 'WhatsApp';
  if(v==='otro')return 'Otro';
  if(v==='avisos')return 'Avisos / edictos';
  return v;
}
function medioNotificacionFlagHtml(v,sh){
  v=medioNotificacionNorm(v);
  if(!v)return '';
  if(v==='electronica')return '<span class="flag" style="background:var(--bll);color:var(--bl);border:1px solid #b8d2eb">🌐'+(sh?'':' Correo')+'</span>';
  if(v==='fisica')return '<span class="flag" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd)">👤'+(sh?'':' Física')+'</span>';
  if(v==='whatsapp')return '<span class="flag" style="background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7">💬'+(sh?'':' WhatsApp')+'</span>';
  if(v==='otro')return '<span class="flag" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd)">📋'+(sh?'':' Otro')+'</span>';
  if(v==='avisos')return '<span class="flag" style="background:var(--aml);color:var(--am);border:1px solid #f1d795">📌'+(sh?'':' Avisos')+'</span>';
  if(v==='pagina')return '<span class="flag" style="background:var(--bll);color:var(--bl);border:1px solid #b8d2eb">🌐'+(sh?'':' Página')+'</span>';
  if(v==='aviso')return '<span class="flag" style="background:var(--aml);color:var(--am);border:1px solid #f1d795">📌'+(sh?'':' Aviso')+'</span>';
  return '<span class="flag" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd)">'+escAttr(medioNotificacionLabel(v))+'</span>';
}
function htmlMedioNotificacionBtns(val,wrapSel,setFn){
  const v=medioNotificacionNorm(val);
  const mk=(id,lbl)=>'<button type="button" class="btn bsm medio-notif-btn'+((v||'no_indica')===id||(id==='no_indica'&&!v)?' on':'')+'" data-val="'+escAttr(id)+'" onclick="'+setFn+'(\''+escAttr(id)+'\',true)">'+lbl+'</button>';
  return mk('no_indica','— No indica')+mk('electronica','🌐 Correo')+mk('fisica','👤 Física')+mk('whatsapp','💬 WhatsApp')+mk('avisos','📌 Avisos')+mk('otro','📋 Otro');
}
function setMedioNotificacion(val,userPick){
  const hid=document.getElementById('fld__medio_notificacion');
  const norm=medioNotificacionNorm(val==='no_indica'?'':val);
  if(hid)hid.value=norm;
  document.querySelectorAll('#reg-medio-notif-btns .medio-notif-btn, .medio-notif-btn').forEach(b=>{
    const bv=b.getAttribute('data-val')||'';
    const on=(bv==='no_indica'&&!norm)||bv===norm;
    b.classList.toggle('on',on);
  });
}
function setSecMedioNotificacion(val,userPick){
  const hid=document.getElementById('sec-medio-notif');
  const norm=medioNotificacionNorm(val==='no_indica'?'':val);
  if(hid){
    hid.value=norm;
    if(userPick)hid.dataset.userSet='1';
    else delete hid.dataset.userSet;
  }
  document.querySelectorAll('#sec-medio-notif-btns .medio-notif-btn').forEach(b=>{
    const bv=b.getAttribute('data-val')||'';
    const on=(bv==='no_indica'&&!norm)||bv===norm;
    b.classList.toggle('on',on);
  });
}
function defaultMedioNotifDesdeRecepcion(medioRecep){
  const ml=String(medioRecep||'').toLowerCase();
  if(ml.includes('correo')||ml==='web')return 'electronica';
  if(ml.includes('ventanilla')||ml.includes('físic')||ml.includes('fisic'))return 'fisica';
  if(ml.includes('tel'))return 'whatsapp';
  return '';
}
function onSecMedioRecepcionChange(){
  const hid=document.getElementById('sec-medio-notif');
  const medio=(document.getElementById('sec-medio')||{}).value||'';
  if(!medio){
    if(hid){hid.value='';delete hid.dataset.userSet;}
    document.querySelectorAll('#sec-medio-notif-btns .medio-notif-btn').forEach(b=>b.classList.remove('on'));
    return;
  }
  if(hid&&hid.dataset.userSet){
    setSecMedioNotificacion('no_indica',false);
    delete hid.dataset.userSet;
  }else{
    setSecMedioNotificacion(defaultMedioNotifDesdeRecepcion(medio)||'no_indica',false);
  }
}
function initSecMedioNotificacion(resetEmpty){
  const btns=document.getElementById('sec-medio-notif-btns');
  if(btns)btns.innerHTML=htmlMedioNotificacionBtns('','sec','setSecMedioNotificacion');
  if(resetEmpty){
    const hid=document.getElementById('sec-medio-notif');
    if(hid){hid.value='';delete hid.dataset.userSet;}
  }
  onSecMedioRecepcionChange();
}
function flagsHtml(e,sh){
  return getExpFlagsArray(e,sh).join(' ');
}
function getExpFlagsArray(e,sh){
  const flags=[];
  if(e._medida_prev)flags.push('<span class="flag flag-mp">⚠️'+(sh?'':' Med.prev.')+'</span>');
  if(e._suspendido)flags.push('<span class="flag flag-sus">🚫'+(sh?'':' Suspendido')+'</span>');
  if(e._sancionatorio)flags.push('<span class="flag" style="background:var(--pul);color:var(--pu);border:1px solid #d4c7f0">⚖️'+(sh?'':' Sancionatorio')+'</span>');
  const ac=acctStatus(e);
  if(ac.mora)flags.push('<span class="flag" style="background:var(--rdl);color:var(--rd);border:1px solid #f7c1c1">💰'+(sh?'':' Mora')+'</span>');
  if(ac.persuasivo)flags.push('<span class="flag" style="background:var(--aml);color:var(--am);border:1px solid #f1d795">💲'+(sh?'':' Persuasivo')+'</span>');
  if(e._apoderado||e._autorizado)flags.push('<span class="flag" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd)">🫆'+(sh?'':' Apoderado/aut.')+'</span>');
  if(ac.coactivo)flags.push('<span class="flag" style="background:var(--pul);color:var(--pu);border:1px solid #d4c7f0">🏛️'+(sh?'':' Coactivo')+'</span>');
  if(ac.acuerdo)flags.push('<span class="flag" style="background:var(--bll);color:var(--bl);border:1px solid #b8d2eb">🤝'+(sh?'':' Acuerdo')+'</span>');
  const mn=medioNotificacionFlagHtml(e._medio_notificacion,sh);
  if(mn)flags.push(mn);
  const lg=legalFlags(e);
  if(lg.vencida)flags.push('<span class="flag flag-venc-acto">📜'+(sh?'':' Res. vencida')+'</span>');
  if(lg.prorroga)flags.push('<span class="flag flag-prorroga">📜'+(sh?'':' Prórroga')+'</span>');
  if(lg.archivada)flags.push('<span class="flag flag-arch-acto">📜'+(sh?'':' Acto archivado')+'</span>');
  const sg=segFlags(e);
  if(sg.incumplio)flags.push('<span class="flag flag-incumple">⚠️'+(sh?'':' Incumplió req.')+'</span>');
  else if(sg.noCumple)flags.push('<span class="flag flag-ncumple">⚠️'+(sh?'':' No cumple')+'</span>');
  return flags;
}
function flagsHtmlCompact(e,sh){
  const flags=getExpFlagsArray(e,sh);
  if(!flags.length)return '';
  return '<span class="flags-inline">'+flags.join(' ')+'</span>';
}
function openExpFlagsModal(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e)return;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Indicadores · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+escAttr(getNom(e))+'</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+getExpFlagsArray(e,false).join(' ')+'</div>'+
    '<button type="button" class="btn bsm bp" onclick="event.stopPropagation();SST.abrirConsultaExpPanel(\''+jsStr(expId)+'\');closeTaskModal()">Abrir en '+uiEditorContenedorLbl()+'</button> '+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button>';
  ov.classList.add('on');
}
function openConsExpModal(catKey,catLabel){
  const ids=(window._consCatLists||{})[catKey]||[];
  if(!ids.length)return;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent=catLabel||'Expedientes';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const rows=ids.map(id=>{
    const e=exps.find(x=>String(x._exp||'').trim()===id);
    if(!e)return'';
    return '<div style="padding:6px 0;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;font-size:13px">'+
      '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--bl);cursor:pointer" data-con-exp-asoc="'+escAttr(id)+'">'+escAttr(id)+'</span>'+
      '<span style="flex:1;font-weight:600">'+escAttr(getNom(e))+'</span>'+
      '<button type="button" class="btn bsm bic" data-con-exp-asoc="'+escAttr(id)+'">Ver</button></div>';
  }).join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">'+ids.length+' expediente(s). Clic para abrir en '+uiEditorContenedorLbl()+'.</div>'+rows+
    '<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  ov.classList.add('on');
}
function getNom(e){
  if(esModoCasoEspecial(e)){
    if(e._qd_anonimo)return labelTipoCasoEspecial(e)+' anónimo';
    if(e._tipo_persona==='juridica'&&e._pj_empresa){
      const ofi=e._qd_nombre&&e._qd_nombre!==e._pj_empresa?' · radica: '+e._qd_nombre:'';
      return e._pj_empresa+ofi;
    }
    return e._qd_nombre||e._pn_nombre||'Solicitante';
  }
  if(e._tipo_persona==='juridica')return e._pj_empresa||e._pj_rep_nombre||e._exp||'Sin nombre';
  if(e._pn_nombre)return e._pn_nombre;
  const t=getTram(e._tramite,e);
  if(!t)return e._exp||'Sin nombre';
  const f=t.campos.find(c=>c.requerido&&(c.tipo==='texto'||c.tipo==='email'));
  if(f&&e['f_'+f.id])return e['f_'+f.id];
  const f2=t.campos.find(c=>c.enTabla&&c.tipo==='texto');
  if(f2&&e['f_'+f2.id])return e['f_'+f2.id];
  return e._exp||'Sin nombre';
}
function notifEsGuardadoOk(msg){
  const m=String(msg||'');
  if(/eliminad|eliminada|eliminado|rechazad|descargad|exportad|migraci|marcada como no leída|csv exportado|excel descargado|planeador visual/i.test(m))return false;
  return /guardad|actualizad|registrad|exitosamente|añadid|agregad|cread|asignad|encargados guardados|persona guardada|comentario guardado|evento guardado|evento actualizado|trámite «|PQRSD actualizada|respuesta PQRSD registrada|respuesta registrada|actividad actualizada|actividad agendada|acto agregado|co-ejecutor añadido|modo de entrega actualizado/i.test(m);
}
function notif(msg,tipo){
  const m=String(msg||'');
  if(tipo==='ok'&&notifEsGuardadoOk(m)){
    confirmExito({message:m});
    return;
  }
  const n=document.createElement('div');
  n.className='ntf '+(tipo==='err'?'ner':'nok');
  n.textContent=m;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),tipo==='err'?3200:3600);
}
function confirmExito(opts){
  opts=opts||{};
  const ov=document.getElementById('confirm-prec-overlay');
  const tit=document.getElementById('confirm-prec-title');
  const msg=document.getElementById('confirm-prec-msg');
  const det=document.getElementById('confirm-prec-detail');
  const btn=document.getElementById('confirm-prec-ok');
  const cancel=document.getElementById('confirm-prec-cancel');
  const ico=document.getElementById('confirm-prec-icon-emoji');
  const inp=document.getElementById('confirm-prec-input');
  const box=ov?ov.querySelector('.confirm-prec-box'):null;
  if(!ov||!msg)return;
  if(window._confirmExitoTimer){clearTimeout(window._confirmExitoTimer);window._confirmExitoTimer=null;}
  window._confirmExitoMode=true;
  window._confirmPrecOk=null;
  const tone=opts.tone||'success';
  if(box){
    box.className='confirm-prec-box tone-'+tone+(opts.loading?' confirm-prec-loading':'');
  }
  if(ico){
    if(opts.loading){
      ico.className='radicacion-spinner';
      ico.textContent='';
    }else{
      ico.className='';
      if(tone==='warn')ico.textContent='⚠️';
      else if(tone==='radicacion')ico.textContent='✓';
      else ico.textContent='✓';
    }
  }
  if(tit)tit.textContent=opts.title||'Guardado exitosamente';
  msg.textContent=opts.message||'Los cambios se registraron correctamente.';
  if(det){
    if(opts.detail&&!opts.loading){det.textContent=opts.detail;det.style.display='';}
    else det.style.display='none';
  }
  if(inp){inp.style.display='none';inp.value='';}
  if(cancel)cancel.style.display='none';
  const foot=box?box.querySelector('.confirm-prec-foot'):null;
  if(foot)foot.style.display=(opts.hideFooter||opts.loading)?'none':'';
  if(btn){
    if(opts.hideFooter||opts.loading){
      btn.style.display='none';
    }else{
      btn.style.display='';
      btn.textContent=opts.confirmLabel||'Entendido';
      btn.onclick=function(){closeConfirmDialog(true);};
    }
  }
  window._confirmRadicacionLoading=!!opts.loading;
  ov.classList.add('on');
  const autoMs=opts.autoCloseMs!==undefined?opts.autoCloseMs:(opts.loading?null:(tone==='warn'?null:1000));
  if(autoMs){
    window._confirmExitoTimer=setTimeout(function(){closeConfirmExito();},autoMs);
  }
}
function closeConfirmDialog(ok){
  if(window._confirmRadicacionLoading)return;
  if(window._confirmExitoMode){closeConfirmExito();return;}
  closeConfirmPrecaucion(ok);
}
function closeConfirmExito(){
  if(window._confirmExitoTimer){clearTimeout(window._confirmExitoTimer);window._confirmExitoTimer=null;}
  const ov=document.getElementById('confirm-prec-overlay');
  const cancel=document.getElementById('confirm-prec-cancel');
  const btn=document.getElementById('confirm-prec-ok');
  const ico=document.getElementById('confirm-prec-icon-emoji');
  const foot=ov?ov.querySelector('.confirm-prec-foot'):null;
  const box=ov?ov.querySelector('.confirm-prec-box'):null;
  if(ov)ov.classList.remove('on');
  window._confirmExitoMode=false;
  window._confirmRadicacionLoading=false;
  if(cancel)cancel.style.display='';
  if(btn)btn.style.display='';
  if(foot)foot.style.display='';
  if(ico){ico.className='';ico.textContent='⚠️';}
  if(box)box.className='confirm-prec-box';
}
function esTramitePqrs(tid){
  if(tid==='t_pqrs')return true;
  const t=getTram(tid);
  if(!t)return false;
  const n=(t.nombre||'').toLowerCase().trim().replace(/\s+/g,'');
  return n==='pqrsd'||n.includes('pqrsd')||n.includes('pqrs');
}
function esTramiteSancionatorio(tid){
  if(tid==='t_sanc')return true;
  const t=getTram(tid);
  if(!t)return false;
  const n=(t.nombre||'').toLowerCase().trim().replace(/\s+/g,'');
  return n==='sancionatorio';
}
function esModoCasoEspecial(ev){return !!(ev&&ev._tramite&&(esTramitePqrs(ev._tramite)||esTramiteSancionatorio(ev._tramite)));}
function esModoPqrs(ev){return esModoCasoEspecial(ev);}
function labelTipoCasoEspecial(e){
  if(!e)return'';
  if(esTramiteSancionatorio(e._tramite))return e._tipo_sancionatorio||'Sancionatorio';
  if(esTramitePqrs(e._tramite))return e._tipo_solicitud||'PQRS';
  return'';
}
function expedientesAsociadosData(v){try{return v?JSON.parse(v):[];}catch(e){return[];}}
function getExpAsociadosDirectos(e){
  if(!e||!e._usar_exp_asociados)return[];
  return expedientesAsociadosData(e._expedientes_asociados).map(n=>String(n||'').trim()).filter(Boolean);
}
function expAsocMatchNum(a,b){
  return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
}
function findExpByNumPlain(num){
  const n=String(num||'').trim().toLowerCase();
  if(!n)return null;
  return exps.find(x=>String(x._exp||'').trim().toLowerCase()===n)||null;
}
function expAsocEsRegistroPqrs(e){
  return !!(e&&(esTramitePqrs(e._tramite)||e._es_pqrs||e._radicado_secretaria||esPqrsSecretaria(e)));
}
function expAsocUsuarioPuedeVerPqrs(){
  return getDeptoOperativo()==='guaviare';
}
function expAsocDeptoAceptaPqrsEnLista(deptoId){
  return (deptoId||'guaviare')==='guaviare';
}
function expAsocElegible(e){
  if(!e||!String(e._exp||'').trim())return false;
  if(expAsocEsRegistroPqrs(e)){
    if((e._depto||'guaviare')!=='guaviare')return false;
    if(!expAsocUsuarioPuedeVerPqrs())return false;
  }
  return true;
}
function expAsocVinculoPermitido(receptor,emisor){
  if(!receptor||!emisor)return true;
  if(expAsocEsRegistroPqrs(emisor)&&!expAsocDeptoAceptaPqrsEnLista(receptor._depto))return false;
  if(expAsocEsRegistroPqrs(receptor)&&!expAsocDeptoAceptaPqrsEnLista(emisor._depto))return false;
  return true;
}
function expAsocFiltrarListaParaVista(list,contextExp){
  const ownerDepto=(contextExp&&contextExp._depto)||getDeptoOperativo();
  return (list||[]).filter(n=>{
    const ref=findExpByNumPlain(n);
    if(!ref||!expAsocEsRegistroPqrs(ref))return true;
    return expAsocDeptoAceptaPqrsEnLista(ownerDepto)&&expAsocUsuarioPuedeVerPqrs();
  });
}
function expAsocAyudaHtml(ownerDepto){
  return '';
}
function expAsocContextOwnerDepto(){
  const cur=String(gv('fld__exp')||'').trim();
  if(typeof editId!=='undefined'&&editId){
    const rec=exps.find(x=>expAsocMatchNum(x._exp,editId));
    if(rec)return rec._depto||getDeptoOperativo();
  }
  if(cur){
    const hit=findExpByNumPlain(cur);
    if(hit)return hit._depto||getDeptoOperativo();
  }
  return getDeptoOperativo();
}
function expAsocPqrsVisibleParaContexto(e,ownerDepto){
  if(!expAsocEsRegistroPqrs(e))return true;
  ownerDepto=ownerDepto!==undefined?ownerDepto:expAsocContextOwnerDepto();
  if(!expAsocDeptoAceptaPqrsEnLista(ownerDepto))return false;
  if(!expAsocUsuarioPuedeVerPqrs())return false;
  return true;
}
function findExpByNum(num,ownerDepto){
  const n=String(num||'').trim();
  if(!n)return null;
  const nLc=n.toLowerCase();
  ownerDepto=ownerDepto!==undefined?ownerDepto:expAsocContextOwnerDepto();
  return exps.find(x=>expAsocElegible(x)&&expAsocPqrsVisibleParaContexto(x,ownerDepto)&&String(x._exp||'').trim().toLowerCase()===nLc)||null;
}
function getExpAsociadosInversos(expNum){
  const n=String(expNum||'').trim();
  if(!n)return[];
  const nLc=n.toLowerCase();
  return exps.filter(x=>{
    if(expAsocMatchNum(x._exp,n))return false;
    return getExpAsociadosDirectos(x).some(a=>String(a||'').trim().toLowerCase()===nLc);
  }).map(x=>String(x._exp||'').trim()).filter(Boolean);
}
function getExpAsociadosAll(e){
  const seen=new Set(),out=[];
  getExpAsociadosDirectos(e).concat(getExpAsociadosInversos(e._exp)).forEach(n=>{
    const k=String(n||'').trim().toLowerCase();
    if(k&&!seen.has(k)){seen.add(k);out.push(String(n).trim());}
  });
  return expAsocFiltrarListaParaVista(out,e);
}
function aplicarAsociadosBidireccional(expId,nuevos,previos){
  expId=String(expId||'').trim();
  nuevos=(nuevos||[]).map(n=>String(n||'').trim()).filter(Boolean);
  previos=(previos||[]).map(n=>String(n||'').trim()).filter(Boolean);
  const add=nuevos.filter(n=>!previos.some(p=>expAsocMatchNum(p,n)));
  const rem=previos.filter(n=>!nuevos.some(x=>expAsocMatchNum(x,n)));
  const current=findExpByNumPlain(expId);
  function patchOther(otherNum,inc){
    const o=findExpByNum(otherNum)||findExpByNumPlain(otherNum);
    if(!o)return;
    if(inc&&current&&!expAsocVinculoPermitido(o,current))return;
    let arr=getExpAsociadosDirectos(o);
    if(inc){
      if(!arr.some(n=>expAsocMatchNum(n,expId))){
        arr.push(expId);
        o._usar_exp_asociados=true;
        o._expedientes_asociados=JSON.stringify(arr);
      }
    }else{
      arr=arr.filter(n=>!expAsocMatchNum(n,expId));
      o._expedientes_asociados=JSON.stringify(arr);
      if(!arr.length&&!getExpAsociadosInversos(otherNum).length)o._usar_exp_asociados=false;
    }
  }
  add.forEach(n=>patchOther(n,true));
  rem.forEach(n=>patchOther(n,false));
}
function renderExpAsociadosView(e,clickable){
  const list=getExpAsociadosAll(e);
  if(!list.length)return'';
  const chips=list.map(n=>clickable
    ?'<button type="button" class="bdg b-sol con-exp-link" style="font-family:\'DM Mono\',monospace;font-size:11px" data-sst-action="abrirConsultaExpAsociado" data-sst-exp="'+escAttr(n)+'">'+escAttr(n)+'</button>'
  :'<span class="bdg b-sol" style="font-family:\'DM Mono\',monospace;font-size:11px">'+escAttr(n)+'</span>').join('');
  return '<div class="ic"><div class="k">Exp. asociados</div><div class="v" style="display:flex;flex-wrap:wrap;gap:3px">'+chips+'</div></div>';
}
function abrirConsultaExpAsociado(expId){
  expId=String(expId||'').trim();
  if(!expId)return;
  closeTaskModal();
  abrirConsultaExpPanel(expId,{allowSingle:true,edit:false,soloExp:true});
}
function onDeptoChange(){
  if(!esAdministrador())return;
  syncCfgToStore();
  const selVal=document.getElementById('sel-depto').value;
  if(esAdministrador()){try{localStorage.setItem('sst_sel_modulo',selVal);}catch(e){}}
  if(selVal==='admin')deptoActivo='guaviare';
  else deptoActivo=selVal;
  window._deptoConsFiltroTram='';
  if(deptoActivo!=='jurisdiccional'&&deptoActivo!=='responsables'&&deptoActivo!=='secretaria'&&deptoActivo!=='ciudadano'&&!esModuloOficina(deptoActivo)){
    setCfgPtr(deptoActivo);
  }else if(deptoActivo==='secretaria'||deptoActivo==='ciudadano'||esModuloOficina(deptoActivo)){
    setCfgPtr('guaviare');
  }else if(deptoActivo==='jurisdiccional'){
    editId=null;
    if(document.getElementById('pg-reg').classList.contains('on')||document.getElementById('pg-cfg').classList.contains('on'))showTab('con');
  }else if(deptoActivo==='responsables'){
    editId=null;
    limpiarForm();
    if(esResponsableIdentidadFija())fijarResponsableSesion();
    else{
      responsableActivo='';
      try{localStorage.setItem('sst_responsable','');}catch(e){}
    }
    poblarSelResponsable();
    if(document.getElementById('pg-cfg').classList.contains('on')||!document.querySelector('.pg.on'))showTab('con');
  }else{
    ensureEncargadoActivo();
  }
  updateDeptoUI();
  if(esAdministrador()){
    const selAdmin=document.getElementById('sel-depto');
    if(selAdmin)selAdmin.style.display='';
  }
  poblarTramSelect();
  initRealtimeSync();
  if(esSecretaria()){cerrarConsultaPanel();showTab('sec');}
  else if(esModoCiudadano())showTab('ciudadano');
  else if(esModoOficinaDeguv()){cerrarConsultaPanel();showTab('pqrs-ofi');}
  else if(selVal==='admin'){showTab('reg');}
  else if(editId&&!esJurisdiccional()&&!esModoCiudadano()&&!esSecretaria()){
    const e=exps.find(x=>x._exp===editId);
    if(e&&e._depto!==deptoActivo&&!esModuloOficina(deptoActivo)){limpiarForm();}
    else if(e){setCfgPtr(e._depto||getDeptoOperativo());renderFormulario(e._tramite,e);}
  }
  if(!esJurisdiccional()&&!esModoResponsable()&&!esSecretaria()&&!esModoCiudadano()&&!esModoOficinaDeguv())renderTabla();
  if(document.getElementById('pg-con').classList.contains('on')){poblarFiltrosCon();renderConsulta();}
  if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
  if(document.getElementById('pg-cfg').classList.contains('on'))renderCfg();
  if(document.getElementById('pg-sec').classList.contains('on')){poblarSecOficinaSelect();renderSecretariaPqrs();}
  if(document.getElementById('pg-pqrs-ofi').classList.contains('on'))renderPqrsOficinaInbox();
  if(typeof sstIniciarGmailObligatorio==='function'&&!esModoCiudadano())sstIniciarGmailObligatorio();
}
function updateDeptoUI(){
  if(esVistaActividadesDepto())ensureEncargadoActivo();
  if(esModoResponsable()&&esResponsableIdentidadFija())fijarResponsableSesion();
  const ban=document.getElementById('reg-depto-banner');
  const respBar=document.getElementById('resp-global-bar');
  const sub=document.querySelector('.lsb');
  const juris=esJurisdiccional();
  const resp=esModoResponsable();
  const encDepto=esVistaActividadesDepto();
  const encNom=getEncargadoDepto(deptoActivo);
  const sec=esSecretaria();
  const ciudadano=esModoCiudadano();
  const ofi=esModoOficinaDeguv();
  const ofiVista=esVistaPqrsOficinaDeguv();
  const ofiNom=ofi?labelOficina(deptoActivo):(ofiVista&&deptoActivo==='guaviare'?'NCA DEGUV':'');
  if(sub)sub.textContent=juris?'Vista jurisdiccional — solo consulta y consolidado':ciudadano?'Consulta de trámites y PQRSD — busque por número de expediente o solicitud':sec?'Secretaría DEGUV — radicación y traslado de PQRSD a oficinas':ofi?('Oficina: '+ofiNom+' — bandeja de PQRSD trasladados'):resp?(responsableActivo?(responsablePuedeVerRegistro()?'Vista responsable — edición parcial en Registro según permisos':'Vista responsable — Consulta y actividades'):'Seleccione responsable'):esAdminModoGlobal()?('Administrador — vista global'):encDepto?('Departamento: '+labelDepartamento(deptoActivo)+' · Encargado: '+encNom):esNcaDeguv()?('Departamento: '+labelDepartamento('guaviare')+' · Encargado: '+encNom):esRolDepartamentalCfg()?('Departamento: '+labelDepartamento(getRolEfectivo())+' · Encargado: '+encNom):'Departamento: '+labelDepartamento(getDeptoOperativo());
  const selDepto=document.getElementById('sel-depto');
  if(selDepto)selDepto.style.display=esAdministrador()?'':'none';
  const tabAud=document.getElementById('ctab-auditoria');
  if(tabAud)tabAud.style.display=esAdministrador()?'':'none';
  const tabUsu=document.getElementById('ctab-usuarios');
  if(tabUsu){
    tabUsu.style.display=puedeGestionarUsuariosAutorizados()?'':'none';
    tabUsu.textContent=esEncargadoDepartamentalUsuarios()?'👥 Responsables autorizados':'👥 Usuarios autorizados';
  }
  if(ban){
    if(juris){
      ban.style.display='';
      ban.innerHTML='Modo <strong>jurisdiccional</strong>: solo puede <strong>consultar</strong> y ver el <strong>consolidado</strong> de todos los departamentos. La edición y registro corresponde a cada departamento.';
    }else if(sec){
      ban.style.display='';
      ban.innerHTML='Modo <strong>Secretaría DEGUV</strong>: radique PQRSD, consulte las asignadas a oficinas y responda las devueltas a Secretaría.';
    }else if(ofi){
      ban.style.display='';
      ban.innerHTML='Modo <strong>'+escAttr(ofiNom)+'</strong>: consulte PQRSD trasladados, vea el documento de la solicitud, traslade a otra oficina o indique si ya se dio respuesta.';
    }else if(ciudadano){
      ban.style.display='none';
    }else ban.style.display='none';
  }
  if(respBar){
    respBar.classList.toggle('on',resp);
    const respFijo=esResponsableIdentidadFija();
    const selResp=document.getElementById('sel-responsable');
    const lblResp=document.getElementById('resp-global-label');
    const btnCambiarResp=respBar.querySelector('button[onclick="cambiarResponsable()"]');
    if(resp){
      if(respFijo)fijarResponsableSesion();
      else poblarSelResponsable();
      if(selResp)selResp.style.display=respFijo?'none':'';
      if(btnCambiarResp)btnCambiarResp.style.display=respFijo?'none':'';
      if(lblResp)lblResp.textContent=respFijo?'Conectado como:':'Responsable:';
      if(respFijo){
        const nom=getResponsableLoginNombre();
        const hint=document.getElementById('resp-global-hint');
        if(hint&&nom)hint.innerHTML='<strong style="color:var(--tx)">'+escAttr(nom)+'</strong> · '+escAttr(responsablePuedeVerRegistro()?'Consulta, actividades y registro según permisos':'Consulta y actividades asignadas');
      }
    }
  }
  const tabReg=document.getElementById('tab-reg');
  const hideRegResp=resp&&!responsablePuedeVerRegistro();
  if(tabReg){tabReg.classList.toggle('tab-resp-reg-off',hideRegResp);}
  if(typeof aplicarVisibilidadTabsSesion==='function')aplicarVisibilidadTabsSesion();
  document.querySelectorAll('.hacts-juris-hide').forEach(el=>el.classList.toggle('hacts-juris-off',juris||resp||sec||ciudadano||ofi));
  document.querySelectorAll('.hacts-nuevo-hide').forEach(el=>el.classList.toggle('hacts-juris-off',juris||(resp&&(!responsableActivo||!responsablePuedeEditarSec('control')))||sec||ciudadano||ofi));
  const optPqrsRec=document.getElementById('f-act-opt-pqrsrec');
  if(optPqrsRec)optPqrsRec.style.display='none';
  const tramSel=document.getElementById('tram-selector-wrap');
  if(tramSel)tramSel.style.display=(resp&&!responsablePuedeVerRegistro()||sec||ciudadano||ofi)?'none':'';
  const regPg=document.getElementById('pg-reg');
  if(regPg&&juris&&regPg.classList.contains('on'))showTab('con');
  if(regPg&&ciudadano&&regPg.classList.contains('on'))showTab('ciudadano');
  if(regPg&&sec&&regPg.classList.contains('on'))showTab('sec');
  if(regPg&&ofi&&regPg.classList.contains('on'))showTab('pqrs-ofi');
  if(regPg&&resp&&regPg.classList.contains('on')&&!responsablePuedeVerRegistro())showTab('con');
  const actDeptActions=document.getElementById('act-dept-actions');
  const actDeptBar=document.getElementById('act-dept-resp-bar');
  if(actDeptActions)actDeptActions.style.display=encDepto?'flex':'none';
  if(actDeptBar){
    actDeptBar.style.display=encDepto?'flex':'none';
    if(encDepto)poblarActDeptRespSel();
  }
  updateVerifyBanner();
  renderBandejaDepto();
  renderChatBadge();
  if(typeof initChatNotifySync==='function')scheduleChatNotifySync();
  const btnExport=document.querySelector('.hacts-export-respaldo');
  if(btnExport)btnExport.style.display=ciudadano?'none':'';
  const btnConExport=document.getElementById('btn-export-consulta');
  if(btnConExport)btnConExport.style.display=ciudadano?'none':'';
  document.querySelectorAll('.con-filtro-avanzado').forEach(el=>{el.style.display=ciudadano?'none':'';});
  const chatFab=document.getElementById('chat-fab');
  if(chatFab)chatFab.style.display=(ciudadano||!document.body.classList.contains('sesion-activa'))?'none':'';
  const qTxt=document.getElementById('q-txt');
  if(qTxt)qTxt.placeholder=ciudadano?'N° de expediente o PQRSD (Ej. 2602010)':'Nombre, expediente, resolución, NIT, ciudad…';
  if(ciudadano){
    const pgCiu=document.getElementById('pg-ciudadano');
    if(pgCiu&&!pgCiu.classList.contains('on'))showTab('ciudadano');
  }
  document.body.classList.toggle('modo-ciudadano',ciudadano);
  if(typeof renderSstGmailSesionBloqueo==='function')renderSstGmailSesionBloqueo();
  if(typeof sstRescheduleGmailExpiryTimers==='function')sstRescheduleGmailExpiryTimers();
  if(resp&&document.getElementById('pg-cons')&&document.getElementById('pg-cons').classList.contains('on'))showTab('act');
}
function renderResponsableRegistro(){}
function migrarRevisionDeptoTask(t){
  if(!t||t.ultimaRevisionDepto)return;
  const hist=t.historial||[];
  if(estadoTask(t)==='Por corregir'){
    const u=hist.filter(h=>h.tipo==='ajuste_soporte').pop();
    if(u)t.ultimaRevisionDepto={tipo:'corregir',fecha:u.fecha||'',nota:u.nota||'',por:u.por||''};
  }else if(estadoTask(t)==='Atendida'&&(t.verificadoPor||hist.some(h=>h.tipo==='verificacion'))){
    const v=hist.filter(h=>h.tipo==='verificacion').pop();
    t.ultimaRevisionDepto={tipo:'aprobada',fecha:t.fechaAtendida||(v?v.fecha:''),nota:t.verificadoPor||(v?v.nota:'')};
  }
}
function taskHuboReporteResponsable(t){
  if(!t)return false;
  return (t.historial||[]).some(h=>h.tipo==='reenvio_verificacion')||!!t.fechaReportada||!!t.ultimaRevisionDepto;
}
function getTaskRevisionDepto(t){
  if(!t||t.eliminada||esTareaDelEncargado(t))return null;
  if(estadoTask(t)==='Por verificar')return null;
  migrarRevisionDeptoTask(t);
  if(t.ultimaRevisionDepto&&t.ultimaRevisionDepto.tipo){
    if(estadoTask(t)==='Atendida'&&t.ultimaRevisionDepto.tipo==='aprobada')return t.ultimaRevisionDepto;
    if(estadoTask(t)==='Por corregir'&&t.ultimaRevisionDepto.tipo==='corregir')return t.ultimaRevisionDepto;
  }
  if(!taskHuboReporteResponsable(t))return null;
  const hist=t.historial||[];
  if(estadoTask(t)==='Por corregir'){
    const u=hist.filter(h=>h.tipo==='ajuste_soporte').pop();
    return {tipo:'corregir',fecha:u?u.fecha:'',nota:u?u.nota:''};
  }
  if(estadoTask(t)==='Atendida'){
    const v=hist.filter(h=>h.tipo==='verificacion').pop();
    return {tipo:'aprobada',fecha:t.fechaAtendida||'',nota:t.verificadoPor||(v?v.nota:'')};
  }
  return null;
}
function taskEsRevisada(t){return !!getTaskRevisionDepto(t);}
function taskRevisionDeptoLabel(rev){
  if(!rev)return'';
  return rev.tipo==='aprobada'?'<span class="bdg" style="background:var(--gnl);color:var(--gn);font-size:10px;margin-left:4px" title="Revisada — aprobada">✓ Aprobada</span>':'<span class="bdg" style="background:var(--orl);color:var(--or);font-size:10px;margin-left:4px" title="Revisada — enviada a corregir">↩ A corregir</span>';
}
function renderActividadesRowHtml(t){
  const est=estadoTask(t),lbl=estadoTaskLabel(t),st=taskEstadoStyle(est),vencE=est==='Vencida';
  const esEncOwn=esTareaDelEncargado(t);
  const yo=esModoResponsable()?taskUsuarioEsAsignado(t,responsableActivo):(esVistaActividadesDepto()&&esEncOwn);
  const ns=(t.soportes||[]).length;
  const revDepto=esVistaActividadesDepto()?getTaskRevisionDepto(t):null;
  const cierre=est==='Atendida'?fmtF(t.fechaAtendida):esEncOwn&&est!=='Atendida'?'—':est==='Por verificar'?('Reportada '+fmtF(t.fechaReportada)):est==='Por corregir'?'Devuelta — corregir':'—';
  const cierreHtml=cierre;
  const refLbl=t.sinExpediente?('<span class="bdg" style="background:var(--pul);color:var(--pu);font-size:10px;margin-right:4px">Actividad</span>'+escAttr(t.exp)):escAttr(t.exp);
  const priorBadge=t.prioritaria?'<span class="bdg bdg-prior" style="margin-left:4px">⚡ Prioritaria</span>':'';
  const sol=getTaskSolicitudPendiente(t);
  const solBadge=sol?('<span class="solicitud-pill" title="'+(sol.tipo==='traslado'?'Traslado':'Eliminación')+' solicitada por '+escAttr(sol.por)+'">⚠ Solicitud</span>'):'';
  let acts='';
  const expAct=getExpById(t.exp);
  const esPqrsNcaAct=expAct&&taskEsAtenderPqrs(t,expAct)&&esOficinaPqrsNca();
  if(puedeGestionarActividadesDepto()){
    if(!esPqrsNcaAct)acts+=actBtnEditHtml(t.exp,t.id,'Gestionar actividad: editar, trasladar responsable o eliminar');
    if(!t.sinExpediente)acts+=actBtnLupaHtml(t.exp,t.id,esPqrsNcaAct?'Gestionar PQRSD: asignar, co-ejecutores y traslado':'Abrir expediente en '+uiEditorContenedorLbl());
  }
  if(puedeGestionarSolicitudActividad(t.exp,t.id)&&sol)acts+='<button type="button" class="btn bsm" style="background:var(--orl);color:var(--or);font-weight:600" title="Atender solicitud del responsable" onclick="event.stopPropagation();openGestionSolicitudModal(\''+jsStr(t.exp)+'\',\''+jsStr(t.id)+'\')">'+(sol.tipo==='traslado'?'↔':'🗑')+'</button>';
  acts+=taskReporteBtnHtml(t.exp,t.id,yo);
  if(esModoResponsable()&&taskUsuarioEsAsignado(t,responsableActivo)){
    if(!t.sinExpediente)acts+=actBtnLupaHtml(t.exp,t.id,'Ver expediente en '+uiEditorContenedorLbl());
    acts+=taskCoEjecutorBtnHtml(t.exp,t.id);
    acts+=taskChatBtnHtml(t.exp,t.id,t);
    if(sol)acts+='<span class="solicitud-pill" title="Solicitud enviada — pendiente de respuesta">📩 Enviada</span>';
  }
  if(yo&&est!=='Atendida')acts+=taskAgendaBtnHtml(t.exp,t.id);
  if(!esModoResponsable()){
    acts+=taskChatBtnHtml(t.exp,t.id,t);
  }
  if(ns)acts+='<button type="button" class="btn bsm bic" title="'+ns+' documento(s) — ver o entregar soporte" onclick="event.stopPropagation();openTaskCommentsModal(\''+jsStr(t.exp)+'\',\''+jsStr(t.id)+'\')">📎</button>';
  const canRevisarDept=esVistaActividadesDepto()&&!esModoResponsable()&&taskPendienteVerificacion(t);
  if(canRevisarDept)acts+='<button type="button" class="btn bsm bp" title="Revisar entrega del responsable: verificar cierre o devolver" onclick="event.stopPropagation();openTaskCommentsModal(\''+jsStr(t.exp)+'\',\''+jsStr(t.id)+'\')">📋 Revisar</button>';
  const respCol=esVistaActividadesDepto()?('<td style="font-size:12px;color:var(--tx2)">'+taskResponsablesLabel(t,true)+'</td>'):'';
  return '<tr'+(t.prioritaria?' class="prioritaria" style="background:linear-gradient(90deg,rgba(163,45,45,.05),transparent)"':'')+'><td><span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+lbl+'</span>'+priorBadge+solBadge+(revDepto?taskRevisionDeptoLabel(revDepto):'')+'</td>'+
    '<td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl)">'+refLbl+'</td><td>'+escAttr(t.tram)+badgeDepto(t.depto)+'</td>'+
    '<td style="font-weight:600">'+escAttr(t.nombre)+'</td><td>'+escAttr(t.desc||t.actividad)+'</td>'+
    respCol+
    '<td style="color:'+(vencE?'var(--rd)':'var(--tx)')+'">'+fmtF(t.vence)+'</td>'+
    '<td style="font-size:12px">'+cierreHtml+'</td>'+
    '<td><div class="fx" style="gap:4px">'+acts+'</div></td></tr>';
}
function updateActEstFilterForEnc(forEnc){
  const sel=document.getElementById('f-act-est');if(!sel)return;
  const cv=sel.value;
  const deptView=esVistaActividadesDepto();
  const optCorr=sel.querySelector('option[value="porcorr"]');
  const optVer=sel.querySelector('option[value="porver"]');
  const optRev=sel.querySelector('option[value="revisados"]');
  if(optCorr)optCorr.hidden=deptView?!!forEnc:false;
  if(optVer){optVer.hidden=false;optVer.textContent=deptView?'Por revisar':'Por verificar';}
  if(optRev)optRev.hidden=!deptView;
  if(forEnc&&cv==='porcorr')sel.value='pend';
}
function exportarActividadesExcel(){
  const list=window._actExportList||[];
  if(!list.length){notif('Sin actividades para exportar en este filtro','err');return;}
  const deptView=esVistaActividadesDepto();
  const hdr=['Estado','Ref.','Trámite','Interesado','Actividad'];
  if(deptView)hdr.push('Responsable');
  if(deptView)hdr.push('Resultado revisión');
  hdr.push('Vence','Cierre / reporte');
  const rows=list.map(t=>{
    const rev=deptView?getTaskRevisionDepto(t):null;
    const r=[estadoTaskLabel(t),t.exp||t.codigo||'',t.tram||'',t.nombre||'',t.desc||t.actividad||''];
    if(deptView)r.push(taskResponsablesLabel(t,false));
    if(deptView)r.push(rev?(rev.tipo==='aprobada'?'Aprobada':'Enviada a corregir'):'');
    r.push(fmtF(t.vence),estadoTask(t)==='Atendida'?fmtF(t.fechaAtendida):t.fechaReportada?fmtF(t.fechaReportada):'');
    return r;
  });
  exportarTablaExcel([{title:'Actividades',hdr,rows}],'actividades-'+labelDepto(deptoActivo).replace(/\W+/g,'-')+'-'+hoy());
}
function escCellExcel(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function pqrsMatrizEstadoFinal(e){
  if(!pqrsEstaCerrada(e))return '';
  if(e._pqrs_informativa)return 'CONFORME';
  if(pqrsRespuestaEnTermino(e)===false)return 'NO CONFORME';
  return 'CONFORME';
}
function pqrsMatrizCanalLabel(canal){
  const m={
    correo:'NOTIFICACIÓN POR CORREO ELECTRÓNICO',
    whatsapp:'NOTIFICACIÓN POR WHATSAPP',
    presencial:'NOTIFICACIÓN PERSONAL',
    fisica:'NOTIFICACIÓN POR CORREO FÍSICO',
    pagina:'NOTIFICACIÓN POR PÁGINA WEB',
    aviso:'NOTIFICACIÓN POR AVISO'
  };
  return m[canal]||'';
}
function pqrsMatrizObservaciones(e){
  if(!pqrsEstaCerrada(e))return '';
  const wf=getPqrsWorkflow(e);
  const canal=wf.canal||e._pqrs_respuesta_medio||'';
  const parts=[];
  if(e._pqrs_informativa)parts.push('PQRSD informativa');
  const canalLbl=pqrsMatrizCanalLabel(canal);
  if(canalLbl)parts.push(canalLbl);
  const mn=String(e._medio_notificacion||'').trim();
  if(mn&&mn!=='no_indica'){
    const ml=medioNotificacionLabel(mn);
    if(ml&&!parts.some(p=>p.toLowerCase().includes(String(ml).toLowerCase())))parts.push('Medio notificación: '+ml);
  }
  return parts.join(' · ');
}
function pqrsMatrizOficinaResponsable(e){
  const ofi=e._pqrs_oficina||'';
  if(!ofi||ofi==='secretaria')return labelOficina('secretaria')||'Secretaría DEGUV';
  return labelOficina(ofi)||ofi;
}
function pqrsMatrizDepartamento(e){
  return String(labelDepto(e._depto||'guaviare')||'Guaviare').toUpperCase();
}
function pqrsMatrizDiasRespuesta(e){
  if(!pqrsEstaCerrada(e))return '';
  const wf=getPqrsWorkflow(e);
  const resp=wf.fecha_respuesta||e._pqrs_respuesta_fecha||'';
  if(!resp)return '';
  const inicio=e._fecha||e._fecha_solicitud||'';
  if(!inicio)return '';
  return String(Math.max(0,diasEntre(inicio,resp)));
}
function pqrsMatrizDiasParaVencer(e){
  const p=getPqrsPlazoInfo(e);
  if(!p.vence)return '';
  if(pqrsEstaCerrada(e)){
    const wf=getPqrsWorkflow(e);
    const resp=wf.fecha_respuesta||e._pqrs_respuesta_fecha||'';
    if(resp)return String(diasEntre(resp,p.vence));
  }
  return String(diffDias(p.vence));
}
function buildPqrsMatrizRow(e,item){
  const rec=typeof buildPqrsMatrizRecord==='function'?buildPqrsMatrizRecord(e,item):null;
  if(rec)return[
    rec.item,fmtF(rec.fechaRecibo),rec.radicadoRecibo,rec.departamento,rec.tipo,rec.nombre,rec.asunto,
    rec.plazoDias,rec.responsable,fmtF(rec.fechaVence),rec.estado,
    rec.diasParaVencer===''?'':rec.diasParaVencer,
    rec.fechaContestacion?fmtF(rec.fechaContestacion):'',
    rec.radicadoContestacion,
    rec.diasRespuesta===''?'':rec.diasRespuesta,
    rec.estadoFinal,rec.observaciones
  ];
  e=normalizePqrsOficinaFields(e);
  const wf=getPqrsWorkflow(e);
  const p=getPqrsPlazoInfo(e);
  const plazo=p.plazo||getPqrsPlazoDias(e);
  const vence=p.vence||'';
  const cerrada=pqrsEstaCerrada(e);
  const resp=cerrada?(wf.fecha_respuesta||e._pqrs_respuesta_fecha||''):'';
  const oficio=cerrada?(wf.oficio||e._pqrs_respuesta_oficio||''):'';
  return[
    item,fmtF(e._fecha_solicitud||e._fecha||''),e._exp||'',pqrsMatrizDepartamento(e),e._tipo_solicitud||'',
    String(e._qd_nombre||e._pn_nombre||e._nombre||'').trim(),String(e.f_f1||e._pqrs_detalle||'').trim(),
    plazo,pqrsMatrizOficinaResponsable(e),fmtF(vence),getPqrsEstadoDisplay(e),pqrsMatrizDiasParaVencer(e),
    resp?fmtF(resp):'',oficio,pqrsMatrizDiasRespuesta(e),pqrsMatrizEstadoFinal(e),pqrsMatrizObservaciones(e)
  ];
}
function buildPqrsMatrizSeguimiento(list){
  let oportunas=0,fuera=0,sinResolver=0,sumDias=0,cntDias=0;
  list.forEach(e=>{
    if(!pqrsEstaCerrada(e)){sinResolver++;return;}
    const d=pqrsMatrizDiasRespuesta(e);
    if(d!==''){sumDias+=Number(d);cntDias++;}
    if(e._pqrs_informativa||pqrsRespuestaEnTermino(e)!==false)oportunas++;
    else fuera++;
  });
  const prom=cntDias?String(Math.round(sumDias/cntDias*10)/10):'';
  return{
    hdr:['TOTAL PQRSD RECIBIDAS','RESUELTAS OPORTUNAMENTE','RESUELTAS FUERA DE TÉRMINO','SIN RESOLVER','PROMEDIO DÍAS DE RESPUESTA'],
    rows:[[list.length,oportunas,fuera,sinResolver,prom]]
  };
}
function ordenarListaMatrizPqrs(list){
  return(list||[]).filter(e=>esPqrsSecretaria(e)).slice().sort((a,b)=>{
    const fa=String(a._fecha_solicitud||a._fecha||'');
    const fb=String(b._fecha_solicitud||b._fecha||'');
    return fa.localeCompare(fb)||String(a._exp||'').localeCompare(String(b._exp||''));
  });
}
async function exportarMatrizPqrsExcel(list,suffix,periodKey){
  list=ordenarListaMatrizPqrs(list);
  if(!list.length){notif('Sin PQRSD para exportar en el filtro actual','err');return;}
  const pk=periodKey||(suffix==='consolidado'?'cons':'q');
  const periodLbl=typeof labelPeriodo==='function'?labelPeriodo(pk):'';
  if(typeof exportarMatrizPqrsDesdePlantilla==='function'){
    try{
      const ok=await exportarMatrizPqrsDesdePlantilla(list,suffix,periodLbl);
      if(ok){
        if(typeof logAudit==='function')logAudit('Exportó matriz oficial PQRSD (plantilla)','pqrsd',null,list.length+' solicitud(es)');
        return;
      }
    }catch(err){
      console.warn('exportarMatrizPqrsDesdePlantilla:',err);
      notif('Plantilla no disponible — generando Excel simplificado ('+String(err.message||err).slice(0,60)+')','warn');
    }
  }
  const hdr=[
    'ITEM','FECHA RECIBO','RADICADO RECIBO','DEPARTAMENTO','TIPO PETICIÓN','NOMBRE DEL PETICIONARIO','ASUNTO',
    'TIEMPO DE RESPUESTA (días)','RESPONSABLE DEPENDENCIA','FECHA VENCIMIENTO','ESTADO','DÍAS PARA VENCIMIENTO',
    'FECHA CONTESTACIÓN','RADICADO CONTESTACIÓN','DÍAS DE RESPUESTA','ESTADO FINAL','OBSERVACIONES'
  ];
  const rows=list.map((e,i)=>buildPqrsMatrizRow(e,i+1));
  const seg=buildPqrsMatrizSeguimiento(list);
  exportarTablaExcel([
    {
      title:'CONSOLIDADO PQRSD',
      preamble:[
        'FORMATO: CONTROL PETICIONES, QUEJAS, RECLAMOS, SUGERENCIAS Y DENUNCIAS — PQRSD',
        'UNIDAD DE GESTIÓN: SECRETARÍA GENERAL — CDA DEGUV',
        'CÓDIGO: AGJ-CP-9-PR-02-FR-02 · VERSIÓN: 5',
        'FECHA CORTE: '+fmtF(hoy())+(periodLbl?' · Período filtro: '+periodLbl:'')
      ],
      hdr,rows
    },
    {title:'SEGUIMIENTO',hdr:seg.hdr,rows:seg.rows}
  ],'matriz-pqrs-'+(suffix||'reporte')+'-'+hoy());
  if(typeof logAudit==='function')logAudit('Exportó matriz oficial PQRSD','pqrsd',null,list.length+' solicitud(es)');
}
function exportarMatrizPqrsConsulta(){
  exportarMatrizPqrsExcel(window._conExportList||[],'consulta','q');
}
function exportarMatrizPqrsSecretaria(){
  exportarMatrizPqrsExcel(typeof getSecretariaPqrsAll==='function'?getSecretariaPqrsAll():[],'secretaria','q');
}
function exportarMatrizPqrsConsolidado(){
  const list=typeof filterExpsPeriodo==='function'?filterExpsPeriodo(expsAmbito().filter(esPqrsSecretaria),'cons'):[];
  exportarMatrizPqrsExcel(list,'consolidado','cons');
}
function exportarTablaExcel(sheets,filename){
  sheets=sheets||[];
  if(!sheets.length||!sheets[0].rows||!sheets[0].rows.length){notif('Sin datos para exportar','err');return;}
  let html='<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>';
  sheets.forEach(sh=>{
    if(sh.preamble&&sh.preamble.length){
      sh.preamble.forEach(line=>{html+='<p style="margin:2px 0;font-size:12px">'+escCellExcel(line)+'</p>';});
      html+='<br>';
    }
    html+='<h3>'+escCellExcel(sh.title||'Datos')+'</h3><table border="1"><thead><tr>'+
      (sh.hdr||[]).map(h=>'<th>'+escCellExcel(h)+'</th>').join('')+'</tr></thead><tbody>'+
      (sh.rows||[]).map(r=>'<tr>'+r.map(c=>'<td>'+escCellExcel(c)+'</td>').join('')+'</tr>').join('')+
      '</tbody></table><br>';
  });
  html+='</body></html>';
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(filename||'export')+'.xls';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  const total=(sheets[0].rows||[]).length;
  notif('Excel descargado ('+total+' fila(s))','ok');
}
function buildExpedientesExportRows(list){
  if(!list||!list.length)return null;
  const allCampos=[];const camposSet=new Set();
  list.forEach(e=>{
    const t=getTram(e._tramite,e);
    if(t)t.campos.forEach(c=>{if(!camposSet.has('f:'+c.label)){camposSet.add('f:'+c.label);allCampos.push({campo:c,p:'f_'});}});
    migrarInfoTecExpediente(e);
    infoTecnicaExpData(e._info_tecnica_items).forEach(it=>{
      const def=getInfoTecDef(it.campoId,e);
      const lbl=def?def.label:it.campoId;
      if(!camposSet.has('it:'+it.campoId)){camposSet.add('it:'+it.campoId);allCampos.push({campoId:it.campoId,label:lbl,def:def||{tipo:'texto'}});}
    });
  });
  const hdr=['Expediente','Departamento','Trámite','Estado','Etapa','Apertura','Días','Plazo','Términos','Med.prev.','Suspendido','Sancionatorio','Exp. sancionatorio','Nombre',...allCampos.map(x=>x.label||x.campo.label)];
  const rows=list.map(e=>{
    const ter=calcTerminos(e);
    return[e._exp,labelDepto(e._depto),getTram(e._tramite,e)?getTram(e._tramite,e).nombre:'',e._estado||'',e._etapa||'',getFechaEstado(e,'Solicitud')||e._fecha||'',dias(getFechaEstado(e,'Solicitud')||e._fecha),ter?ter.plazo:'',ter?ter.estado:'',e._medida_prev?'Sí':'No',e._suspendido?'Sí':'No',e._sancionatorio?'Sí':'No',e._exp_sancionatorio||'',getNom(e),...allCampos.map(x=>{
      if(x.campoId){
        const it=infoTecnicaExpData(e._info_tecnica_items).find(i=>i.campoId===x.campoId);
        return fmtCampoVal(it?it.valor:'',x.def);
      }
      return fmtCampoVal(e[x.p+x.campo.id]||'',x.campo);
    })];
  });
  return{hdr,rows};
}
function exportarExpedientesExcel(list,suffix){
  const pack=buildExpedientesExportRows(list);
  if(!pack)return;
  exportarTablaExcel([{title:'Expedientes',hdr:pack.hdr,rows:pack.rows}],'sst-'+(suffix||'exp')+'-'+hoy());
}
function exportarConsultaExcel(){exportarExpedientesExcel(window._conExportList||[],'consulta');}
function exportarConsolidadoExcel(){exportarExpedientesExcel(window._consExportList||filterExpsPeriodo(expsAmbito(),'cons'),'consolidado');}
function exportarExcelInforme(){
  syncCfgToStore();
  if(!exps.length){notif('Sin datos','err');return;}
  const expPack=buildExpedientesExportRows(expsAmbito());
  const sheets=[];
  if(expPack)sheets.push({title:'Expedientes',hdr:expPack.hdr,rows:expPack.rows});
  sheets.push({title:'Personas',hdr:['Nombre','Identificación','Correo','Teléfono','Tipo'],rows:personas.map(p=>[p.nombre||'',p.identificacion||'',p.correo||'',p.telefono||'',p.tipoPersona||''])});
  const respRows=[];
  Object.entries(cfgByDepto||{}).forEach(([did,c])=>{
    migrateInstructoresList((c&&c.instructores)||[]).forEach(i=>{
      if(i.nombre)respRows.push([labelDepto(did),i.nombre,i.rol||'',i.activo===false?'Inactivo':'Activo']);
    });
  });
  sheets.push({title:'Responsables',hdr:['Departamento','Nombre','Rol','Estado'],rows:respRows});
  exportarTablaExcel(sheets,'sst-informe-'+hoy());
}
function exportarExcelCompleto(){exportarExcelInforme();}
function openCrearActLibreModal(){
  if(!esVistaActividadesDepto()){notif('Solo el encargado del departamento puede crear actividades sin expediente','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Nueva actividad sin expediente';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const respSel=document.getElementById('act-dept-resp-sel');
  const defResp=respSel&&respSel.value?respSel.value:responsableActivo;
  const names=getContratistasAsignables(deptoActivo);
  const respChecks=names.length?names.map(n=>'<label class="act-libre-resp-row"><span class="act-libre-resp-nom">'+escAttr(n)+'</span><input type="checkbox" class="act-libre-resp-cb" value="'+escAttr(n)+'"'+(n===defResp||names.length===1?' checked':'')+' onchange="toggleActLibreModo()"></label>').join(''):'<div style="padding:10px;font-size:12px;color:var(--tx3)">No hay responsables configurados en el departamento.</div>';
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Capacitación, puesto de control u otra tarea sin expediente. Puede asignar a varios co-ejecutores.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Actividad</label><div class="act-wrap"><input type="text" id="act-libre-nombre" data-sug-src="cortas" placeholder="Buscar actividad..." oninput="filtrarActsPred(this)" onfocus="filtrarActsPred(this)" onblur="setTimeout(()=>hideActsPred(this),160)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label><input type="text" id="act-libre-detalle" placeholder="Detalles adicionales" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Responsables (marque uno o varios)</label><div id="act-libre-resps" class="act-libre-resps-box">'+respChecks+'</div></div>'+
    '<div class="fld" id="act-libre-modo-wrap" style="margin-bottom:8px;display:none"><label>Modo de entrega (varios responsables)</label><select id="act-libre-modo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"><option value="individual">Individual — cada uno entrega por aparte</option><option value="unificada">Unificada — con una entrega se cierra para todos</option></select></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Plazo (días)</label><input type="number" id="act-libre-plazo" min="1" step="1" placeholder="Ej. 15" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px" title="Atender en el menor tiempo posible"><input type="checkbox" id="act-libre-prior"> ⚡ Actividad prioritaria</label>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitCrearActLibre()">Crear actividad</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'crearActLibre'};
  toggleActLibreModo();
  setTimeout(()=>{const inp=document.getElementById('act-libre-nombre');if(inp)inp.focus();},80);
}
function toggleActLibreModo(){
  const n=document.querySelectorAll('.act-libre-resp-cb:checked').length;
  const w=document.getElementById('act-libre-modo-wrap');
  if(w)w.style.display=n>1?'':'none';
}
function submitCrearActLibre(){
  const act=(document.getElementById('act-libre-nombre')||{}).value;
  const det=(document.getElementById('act-libre-detalle')||{}).value;
  const responsables=[...document.querySelectorAll('.act-libre-resp-cb:checked')].map(el=>el.value.trim()).filter(Boolean);
  const plazo=(document.getElementById('act-libre-plazo')||{}).value;
  const prior=!!((document.getElementById('act-libre-prior')||{}).checked);
  const modoEl=document.getElementById('act-libre-modo');
  const entregaModo=(modoEl&&responsables.length>1)?modoEl.value:'individual';
  if(!String(act||'').trim()){notif('Indique el nombre de la actividad','err');return;}
  if(!responsables.length){notif('Seleccione al menos un responsable','err');return;}
  const cod=genCodigoActLibre(deptoActivo);
  const asignados=responsables.map(n=>({nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}));
  const t=normalizeActLibre({
    id:genTaskId(),actividad:act.trim(),detalle:String(det||'').trim(),
    desc:act.trim()+(String(det||'').trim()?' — '+String(det).trim():''),
    responsable:responsables[0],responsables:responsables,asignados:asignados,entregaModo:entregaModo,
    depto:deptoActivo,codigo:cod,
    plazoDias:plazo,vence:plazo?calcVence(plazo):'',prioritaria:prior,
    comentarios:[],historial:[{tipo:'asignacion',fecha:hoy(),por:taskComentarioAutor(),nota:'Actividad sin expediente creada'}],soportes:[],notasDoc:[]
  });
  actividadesLibres.push(t);
  saveLS();closeTaskModal();renderActividades();notif('Actividad '+cod+' creada y asignada a '+responsables.join(', '),'ok');
}
function conActCoEjSummaryHtml(tasks){
  const co=(tasks||[]).filter(t=>!t.eliminada&&taskEsMultiAsignada(t)).length;
  return co?(' <span title="'+co+' actividad(es) con co-ejecutores" style="font-size:11px;margin-left:4px">👥 '+co+'</span>'):'';
}
function esActividadPrioritariaPendiente(t){
  if(!t||t.eliminada||!t.prioritaria)return false;
  const est=estadoTask(t);
  if(est==='Atendida'||est==='Eliminada'||est==='Por verificar')return false;
  if(taskPendienteVerificacion(t))return false;
  return true;
}
function esActividadPorEjecutar(t){
  if(esModoResponsable()&&responsableActivo&&taskUsuarioEsAsignado(t,responsableActivo)){
    const est=estadoTaskForAsignado(t,responsableActivo);
    if(t.eliminada||est==='Atendida'||est==='Eliminada'||est==='Por verificar')return false;
    return['En ejecución','Vencida','Por corregir'].includes(est);
  }
  const est=estadoTask(t);
  if(t.eliminada||est==='Atendida'||est==='Eliminada')return false;
  if(est==='Por verificar')return false;
  return['En ejecución','Vencida','Parcial'].includes(est);
}
function setActFiltro(v){
  const sel=document.getElementById('f-act-est');
  if(sel)sel.value=v;
  renderActividades();
}
window._actVista=window._actVista||'tabla';
function setActVista(v){
  window._actVista=v==='gantt'?'gantt':'tabla';
  const tb=document.getElementById('act-vista-tabla');
  const gb=document.getElementById('act-vista-gantt');
  if(tb)tb.classList.toggle('on',window._actVista==='tabla');
  if(gb)gb.classList.toggle('on',window._actVista==='gantt');
  renderActividades();
}
function taskFechaInicio(t){
  const hist=(t.historial||[]).slice().reverse().find(h=>h.tipo==='asignacion'||h.tipo==='asignacion_extra');
  if(hist&&hist.fecha)return String(hist.fecha).slice(0,10);
  if(t.vence&&t.plazoDias){
    const n=Number(t.plazoDias);
    if(!isNaN(n)&&n>0){
      const d=new Date(t.vence+'T12:00:00');
      d.setDate(d.getDate()-n);
      return d.toISOString().slice(0,10);
    }
  }
  if(t.vence){
    const d=new Date(t.vence+'T12:00:00');
    d.setDate(d.getDate()-14);
    return d.toISOString().slice(0,10);
  }
  return hoy();
}
function ganttEstadoBarClass(t){
  const est=estadoTask(t);
  if(est==='Atendida')return'st-done';
  if(est==='Vencida')return'st-venc';
  if(est==='Por verificar')return'st-porver';
  if(est==='Por corregir')return'st-corr';
  return'st-pend';
}
function addDaysDate(dateStr,n){
  const d=new Date(String(dateStr||hoy()).slice(0,10)+'T12:00:00');
  d.setDate(d.getDate()+Number(n||0));
  return d.toISOString().slice(0,10);
}
function ganttTermStatusRank(st){
  if(st==='venc'||st==='done-venc')return 3;
  if(st==='warn'||st==='act-warn')return 2;
  if(st==='ok'||st==='done-ok'||st==='act-ok')return 1;
  return 0;
}
function ganttMarkTermDate(map,dateStr,status){
  if(!dateStr||!status)return;
  const ds=String(dateStr).slice(0,10);
  const r=ganttTermStatusRank(status);
  if(!map[ds]||r>ganttTermStatusRank(map[ds]))map[ds]=status;
}
function ganttTaskVenceStatus(t){
  if(!t.vence)return null;
  const est=estadoTask(t);
  if(est==='Atendida')return null;
  const d=diffDias(t.vence);
  if(d<0)return'venc';
  if(d<=7)return'warn';
  return'ok';
}
function ganttCollectTermDates(list){
  const map={};
  const expsSeen=new Set();
  list.forEach(t=>{
    if(t.sinExpediente){
      const st=ganttTaskVenceStatus(t);
      if(st&&t.vence)ganttMarkTermDate(map,t.vence,st==='venc'?'venc':st==='warn'?'warn':'ok');
      return;
    }
    const e=getExpById(t.exp);
    if(e&&!expsSeen.has(e._exp)){
      expsSeen.add(e._exp);
      const ter=calcTerminos(e);
      const tram=getTram(e._tramite,e);
      const fi=getFechaEstado(e,'Solicitud')||e._fecha;
      if(ter&&fi){
        const lim=addDaysDate(fi,ter.plazo);
        ganttMarkTermDate(map,lim,ter.estado==='venc'||ter.estado==='done-venc'?'venc':ter.estado==='warn'?'warn':'ok');
        const alertaDias=Math.floor(ter.plazo*(Number(tram&&tram.alerta!=null?tram.alerta:80)/100));
        if(alertaDias>0)ganttMarkTermDate(map,addDaysDate(fi,alertaDias),'warn');
      }
    }
    const st=ganttTaskVenceStatus(t);
    if(st&&t.vence)ganttMarkTermDate(map,t.vence,st==='venc'?'venc':st==='warn'?'warn':'ok');
  });
  return map;
}
function ganttHdrCellClass(ds,termMap,useWeeks,weekStart){
  if(!termMap||!Object.keys(termMap).length)return'';
  let st=null;
  if(useWeeks&&weekStart){
    const ws=new Date(weekStart+'T12:00:00');
    for(let i=0;i<7;i++){
      const d=new Date(ws);d.setDate(d.getDate()+i);
      const key=d.toISOString().slice(0,10);
      if(termMap[key]&&(!st||ganttTermStatusRank(termMap[key])>ganttTermStatusRank(st)))st=termMap[key];
    }
  }else if(termMap[ds])st=termMap[ds];
  if(!st)return'';
  if(st==='venc'||st==='done-venc')return' act-gantt-hdr-venc';
  if(st==='warn'||st==='act-warn')return' act-gantt-hdr-warn';
  return' act-gantt-hdr-ok';
}
function ganttGroupKey(t){
  if(t.sinExpediente)return'libre';
  const e=getExpById(t.exp);
  return'tram:'+(e&&e._tramite?e._tramite:'otros');
}
function ganttGroupLabel(key){
  if(key==='libre')return'Actividades sin expediente';
  if(key.startsWith('tram:')){
    const tid=key.slice(5);
    if(tid==='otros')return'Otros trámites';
    const t=getTram(tid);
    return t?t.nombre:tid;
  }
  return key;
}
function ganttGroupColor(key){
  if(key==='libre')return'var(--pu)';
  if(key.startsWith('tram:')){
    const t=getTram(key.slice(5));
    return t&&t.color?t.color:'var(--bl)';
  }
  return'var(--bl)';
}
function ganttExpKey(expId){return'exp:'+String(expId||'');}
function toggleGanttGroup(key,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  window._ganttExpanded=window._ganttExpanded||{};
  window._ganttExpanded[key]=!window._ganttExpanded[key];
  if(window._actGanttListCache)renderActGantt(window._actGanttListCache);
}
function setGanttTipo(v){
  window._ganttTipoMem=v;
  renderActividades();
}
function getGanttTipoVal(){
  return window._ganttTipoMem||'all';
}
function renderGanttTipoBarHtml(val){
  const hints={all:'Expanda trámites y expedientes para ver actividades y plazos legales.',exp:'Vista por trámite y expediente con plazo legal (solicitud + días configurados).',libre:'Actividades agrupadas por nombre; expanda para ver cada asignación.'};
  return'<div class="gantt-tipo-bar">'+
    '<div class="gantt-tipo-left"><span class="gantt-tipo-lbl">Planeador</span>'+
    '<div class="gantt-tipo-tabs">'+
    '<button type="button" class="'+(val==='all'?'on':'')+'" onclick="setGanttTipo(\'all\')">Todos</button>'+
    '<button type="button" class="'+(val==='exp'?'on':'')+'" onclick="setGanttTipo(\'exp\')">Solo expedientes</button>'+
    '<button type="button" class="'+(val==='libre'?'on':'')+'" onclick="setGanttTipo(\'libre\')">Sin expediente</button>'+
    '</div>'+
    '<button type="button" class="btn bsm bp gantt-dl-btn" onclick="exportarGanttExcel()" title="Descargar planeador (Excel visual)">⬇</button></div>'+
    '<span class="gantt-tipo-hint">'+escAttr(hints[val]||hints.all)+' Clic en trámite o grupo para expandir.</span></div>';
}
function ganttColorHex(c){
  if(!c)return'#185FA5';
  if(String(c).startsWith('#'))return c;
  const m={'var(--am)':'#b87d0a','var(--rd)':'#a32d2d','var(--bl)':'#185FA5','var(--gn)':'#1a7a4a','var(--or)':'#c2600a','var(--pu)':'#6d3fa8'};
  return m[c]||'#185FA5';
}
function ganttColorLight(hex){
  const h=ganttColorHex(hex);
  const m={'#b87d0a':'#fef3d8','#a32d2d':'#fcebeb','#185FA5':'#deeaf8','#1a7a4a':'#e0f5ea','#c2600a':'#fdecd8','#6d3fa8':'#f0eafa'};
  return m[h]||'#f0efe9';
}
function ganttEstadoBarColors(t){
  const est=estadoTask(t);
  if(est==='Atendida')return{bg:'#1a7a4a',fg:'#fff'};
  if(est==='Vencida')return{bg:'#a32d2d',fg:'#fff'};
  if(est==='Por verificar')return{bg:'#185FA5',fg:'#fff'};
  if(est==='Por corregir')return{bg:'#c2600a',fg:'#fff'};
  return{bg:'#b87d0a',fg:'#fff'};
}
function ganttExcelSlots(scale){
  const slots=[];
  const minD=scale.minD;
  const totalDays=scale.totalDays||1;
  const cols=Math.min(scale.cols||30,52);
  const useWeeks=totalDays>84;
  if(useWeeks){
    for(let w=0;w<cols;w++){
      const ws=new Date(minD+'T12:00:00');ws.setDate(ws.getDate()+w*7);
      const we=new Date(ws);we.setDate(we.getDate()+6);
      slots.push({start:ws.toISOString().slice(0,10),end:we.toISOString().slice(0,10),label:fmtF(ws.toISOString().slice(0,10)).slice(0,5)});
    }
  }else{
    const step=Math.max(1,Math.ceil(totalDays/cols));
    for(let i=0;i<totalDays;i+=step){
      const ws=new Date(minD+'T12:00:00');ws.setDate(ws.getDate()+i);
      const we=new Date(ws);we.setDate(we.getDate()+Math.min(step,totalDays-i)-1);
      slots.push({start:ws.toISOString().slice(0,10),end:we.toISOString().slice(0,10),label:ws.getDate()+'/'+(ws.getMonth()+1)});
    }
  }
  return slots;
}
function ganttSlotOverlaps(startDate,endDate,slot){
  const s=String(startDate||'').slice(0,10);
  const e=String(endDate||s).slice(0,10);
  return s<=slot.end&&e>=slot.start;
}
function ganttExcelEmptyCell(extra){
  return'<td style="background:#fafafa;border:1px solid #e2e0d8;min-width:18px;height:22px;'+(extra||'')+'"></td>';
}
function ganttExcelBarCells(slots,startDate,endDate,bg,fg,label){
  let started=false;
  return slots.map(sl=>{
    if(!ganttSlotOverlaps(startDate,endDate,sl))return ganttExcelEmptyCell();
    const showLbl=!started&&label;
    if(showLbl)started=true;
    return'<td style="background:'+bg+';color:'+(fg||'#fff')+';border:1px solid #bbb;font-size:9px;text-align:center;font-weight:600;height:22px;white-space:nowrap">'+escCellExcel(showLbl?label:'')+'</td>';
  }).join('');
}
function ganttExcelTramCells(slots,fi,lim,termCol){
  const bg=ganttColorLight(termCol);
  const bd=ganttColorHex(termCol);
  return slots.map(sl=>{
    if(!ganttSlotOverlaps(fi,lim,sl))return ganttExcelEmptyCell();
    return'<td style="background:'+bg+';border:1px dashed '+bd+';height:22px"></td>';
  }).join('');
}
function ganttExcelTodayCells(slots,today){
  return slots.map(sl=>{
    if(today>=sl.start&&today<=sl.end)return'<td style="background:#fcebeb;border:1px solid #a32d2d;border-left:3px solid #a32d2d;height:22px"></td>';
    return ganttExcelEmptyCell();
  }).join('');
}
function exportarGanttExcel(){
  const list=window._actGanttExportList||[];
  const filtered=filterGanttList(list);
  if(!filtered.length){notif('Sin actividades en el planeador para exportar','err');return;}
  const today=hoy();
  const groups=buildGanttGroups(filtered);
  const fTipo=getGanttTipoVal();
  const tipoLbl={all:'todos',exp:'expedientes',libre:'sin-expediente'}[fTipo]||'todos';
  let html='<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">'+
    '<style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;margin-bottom:22px}td,th{border:1px solid #ccc;padding:3px 4px;vertical-align:middle}'+
    '.ghdr{font-weight:700;background:#deeaf8;color:#0C447C}.glbl{background:#f0efe9;font-weight:600;min-width:220px;max-width:320px}.gexp{background:#fafafa;font-weight:600}'+
    '.gact{padding-left:12px;font-size:10px}.gscale{font-size:9px;color:#666;background:#fff}.gleg td{border:none;padding:2px 8px 2px 0;font-size:10px}</style></head><body>';
  html+='<h2 style="color:#185FA5;margin:0 0 6px">Planeador Gantt — '+escCellExcel(labelDepto(deptoActivo))+'</h2>'+
    '<p style="color:#666;margin:0 0 12px;font-size:11px">Exportado '+fmtF(today)+' · Filtro: '+escCellExcel(tipoLbl)+' · '+filtered.length+' actividad(es)</p>';
  html+='<table class="gleg"><tr>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#b87d0a;vertical-align:middle"></span> Por ejecutar</td>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#a32d2d;vertical-align:middle"></span> Vencida</td>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#185FA5;vertical-align:middle"></span> Por revisar</td>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#c2600a;vertical-align:middle"></span> Por corregir</td>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#1a7a4a;vertical-align:middle"></span> Atendida</td>'+
    '<td><span style="display:inline-block;width:14px;height:10px;background:#e0f5ea;border:1px dashed #1a7a4a;vertical-align:middle"></span> Plazo trámite</td>'+
    '<td><span style="display:inline-block;width:3px;height:12px;background:#a32d2d;vertical-align:middle"></span> Hoy</td></tr></table>';
  groups.forEach(grp=>{
    const grpTasks=ganttGrpTasks(grp);
    const scale=ganttBuildScale(grpTasks,grp.key);
    const slots=ganttExcelSlots(scale);
    const tramCol=ganttResolveColorHex(grp.color);
    html+='<h3 style="margin:16px 0 6px;color:'+tramCol+'">'+escCellExcel(grp.label)+'</h3>';
    html+='<table><tr class="ghdr"><th class="glbl">Elemento</th>'+slots.map(sl=>'<th class="gscale">'+escCellExcel(sl.label)+'</th>').join('')+'</tr>';
    html+='<tr><td class="glbl gscale">Escala · '+escCellExcel(fmtF(scale.minD)+' — '+fmtF(scale.maxD))+'</td>'+ganttExcelTodayCells(slots,today)+'</tr>';
    const expKeys=Object.keys(grp.exps).sort();
    expKeys.forEach(ek=>{
      const ex=grp.exps[ek];
      const libreNom=ex.actNombre||(ex.tasks[0]?(ex.tasks[0].actividad||ex.tasks[0].desc||''):'');
      const expLabel=grp.key==='libre'
        ?String(libreNom||'Actividad sin expediente').substring(0,80)+(ex.tasks.length>1?' ('+ex.tasks.length+' asign.)':'')
        :(ek+' · '+String(ex.nombre||'').substring(0,50));
      const termInfo=grp.key!=='libre'?ganttExpTermInfo(ek):null;
      const expMeta=termInfo?(termInfo.ter.d+'/'+termInfo.ter.plazo+' d · vence '+fmtF(termInfo.lim)):(ex.tasks.length+' tarea(s)');
      html+='<tr><td class="glbl gexp">'+escCellExcel(expLabel)+'<br><span style="font-weight:400;font-size:9px;color:#666">'+escCellExcel(expMeta)+'</span></td>'+
        (termInfo?ganttExcelTramCells(slots,termInfo.fi,termInfo.lim,termInfo.col):slots.map(()=>ganttExcelEmptyCell()).join(''))+'</tr>';
      ex.tasks.sort((a,b)=>(a.vence||'').localeCompare(b.vence||'')).forEach(t=>{
        const ini=taskFechaInicio(t);
        const finBar=t.fechaAtendida||t.vence||ini;
        const cols=ganttEstadoBarColors(t);
        const actLbl=String(t.desc||t.actividad||'').substring(0,40);
        const meta=taskResponsablesLabel(t,false)+' · '+estadoTaskLabel(t)+(t.sinExpediente&&t.codigo?' · '+t.codigo:'');
        html+='<tr><td class="glbl gact">'+escCellExcel(actLbl)+'<br><span style="font-size:9px;color:#666">'+escCellExcel(meta)+'</span></td>'+
          ganttExcelBarCells(slots,ini,finBar,cols.bg,cols.fg,estadoTaskLabel(t))+'</tr>';
      });
    });
    html+='</table>';
  });
  html+='</body></html>';
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='planeador-'+tipoLbl+'-'+labelDepto(deptoActivo).replace(/\W+/g,'-')+'-'+hoy()+'.xls';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  notif('Planeador visual descargado ('+groups.length+' trámite(s))','ok');
}
function ganttResolveColorHex(c){
  if(!c)return'#185FA5';
  if(String(c).startsWith('#'))return c;
  return ganttColorHex(c);
}
function filterGanttList(list){
  const v=getGanttTipoVal();
  if(v==='exp')return list.filter(t=>!t.sinExpediente);
  if(v==='libre')return list.filter(t=>!!t.sinExpediente);
  return list;
}
function ganttExpTermInfo(expId){
  const e=getExpById(expId);
  if(!e)return null;
  const ter=calcTerminos(e);
  const fi=getFechaEstado(e,'Solicitud')||e._fecha;
  if(!fi||!ter||!ter.plazo)return null;
  const lim=addDaysDate(fi,ter.plazo);
  const tram=getTram(e._tramite,e);
  let col='var(--gn)';
  if(ter.estado==='venc'||ter.estado==='done-venc')col='var(--rd)';
  else if(ter.estado==='warn'||ter.estado==='act-warn')col='var(--am)';
  const tip='Plazo trámite · Solicitud '+fmtF(fi)+' → vence '+fmtF(lim)+' ('+ter.d+'/'+ter.plazo+' días hábiles)';
  return{fi,lim,ter,tram,tip,col,tramNom:tram&&tram.nombre?tram.nombre:e._tramite};
}
function ganttTrackTodayHtml(todayPct){
  return todayPct>=0&&todayPct<=100?'<div class="act-gantt-today" style="left:'+todayPct+'%"></div>':'';
}
function ganttTramTermTrackHtml(termInfo,dateToPct){
  if(!termInfo)return'';
  const left=dateToPct(termInfo.fi);
  const right=dateToPct(termInfo.lim);
  const width=Math.max(2,right-left);
  const col=termInfo.col;
  return'<div class="act-gantt-tram-bar" style="left:'+left+'%;width:'+width+'%;background:'+col+'18;border-color:'+col+'" title="'+escAttr(termInfo.tip)+'">'+
    '<div class="act-gantt-tram-bar-inner">'+escAttr(fmtF(termInfo.fi)+' → '+fmtF(termInfo.lim))+'</div></div>'+
    '<div class="act-gantt-tram-deadline" style="left:'+right+'%;background:'+col+'" title="'+escAttr('Vencimiento trámite '+fmtF(termInfo.lim))+'"></div>';
}
function ganttLibreActKey(t){
  const nom=String(t.actividad||t.desc||'').trim();
  if(!nom)return'libre:single:'+(t.codigo||t.exp||t.id||'libre');
  return'libre:'+nom.toLowerCase().replace(/\s+/g,' ').substring(0,120);
}
function buildGanttGroups(list){
  const groups={};
  list.forEach(t=>{
    const gk=ganttGroupKey(t);
    if(!groups[gk])groups[gk]={key:gk,label:ganttGroupLabel(gk),color:ganttGroupColor(gk),exps:{}};
    const expKey=t.sinExpediente?ganttLibreActKey(t):String(t.exp||'');
    const actNom=String(t.actividad||t.desc||t.nombre||'').trim();
    if(!groups[gk].exps[expKey])groups[gk].exps[expKey]={exp:expKey,nombre:t.nombre||'',sinExpediente:!!t.sinExpediente,actNombre:actNom,tasks:[]};
    groups[gk].exps[expKey].tasks.push(t);
  });
  const order=Object.keys(groups).sort((a,b)=>{
    if(a==='libre')return 1;
    if(b==='libre')return-1;
    return ganttGroupLabel(a).localeCompare(ganttGroupLabel(b));
  });
  return order.map(k=>groups[k]);
}
function ganttGrpTasks(grp){
  const tasks=[];
  Object.keys(grp.exps||{}).forEach(k=>{(grp.exps[k].tasks||[]).forEach(t=>tasks.push(t));});
  return tasks;
}
function ganttBuildScale(taskList,grpKey){
  const today=hoy();
  let minD=null,maxD=null;
  const expsSeen=new Set();
  const includeExpTerms=grpKey!=='libre';
  (taskList||[]).forEach(t=>{
    const ini=taskFechaInicio(t);
    let fin=t.fechaAtendida||t.vence||ini;
    if(!minD||ini<minD)minD=ini;
    if(!maxD||fin>maxD)maxD=fin;
    if(t.vence&&(!maxD||t.vence>maxD))maxD=t.vence;
    if(includeExpTerms&&!t.sinExpediente&&t.exp&&!expsSeen.has(t.exp)){
      expsSeen.add(t.exp);
      const ti=ganttExpTermInfo(t.exp);
      if(ti){
        if(!minD||ti.fi<minD)minD=ti.fi;
        if(!maxD||ti.lim>maxD)maxD=ti.lim;
      }
    }
  });
  if(!minD)minD=today;
  if(!maxD)maxD=today;
  if(minD>today)minD=today;
  const d0=new Date(minD+'T12:00:00');d0.setDate(d0.getDate()-3);
  const d1=new Date(maxD+'T12:00:00');d1.setDate(d1.getDate()+10);
  minD=d0.toISOString().slice(0,10);
  maxD=d1.toISOString().slice(0,10);
  const totalDays=Math.max(1,Math.round((new Date(maxD+'T12:00:00').getTime()-new Date(minD+'T12:00:00').getTime())/86400000)+1);
  const useWeeks=totalDays>84;
  const cols=useWeeks?Math.ceil(totalDays/7):Math.min(totalDays,45);
  const termMap=ganttCollectTermDates(taskList);
  function dateToPct(dateStr){
    const s=new Date(minD+'T12:00:00').getTime();
    const e=new Date(maxD+'T12:00:00').getTime();
    const d=new Date(String(dateStr||minD).slice(0,10)+'T12:00:00').getTime();
    const span=Math.max(1,e-s);
    return Math.max(0,Math.min(100,((d-s)/span)*100));
  }
  let hdrCells='';
  if(useWeeks){
    for(let w=0;w<cols;w++){
      const wd=new Date(minD+'T12:00:00');wd.setDate(wd.getDate()+w*7);
      const ds=wd.toISOString().slice(0,10);
      hdrCells+='<div class="act-gantt-hdr-cell'+ganttHdrCellClass(ds,termMap,true,ds)+'" title="'+fmtF(ds)+'">'+fmtF(ds).slice(0,5)+'</div>';
    }
  }else{
    const step=Math.max(1,Math.ceil(totalDays/cols));
    for(let i=0;i<totalDays;i+=step){
      const wd=new Date(minD+'T12:00:00');wd.setDate(wd.getDate()+i);
      const ds=wd.toISOString().slice(0,10);
      hdrCells+='<div class="act-gantt-hdr-cell'+ganttHdrCellClass(ds,termMap,false)+'" title="'+fmtF(ds)+'">'+wd.getDate()+'/'+(wd.getMonth()+1)+'</div>';
    }
  }
  return{minD,maxD,cols,dateToPct,hdrCells,todayPct:dateToPct(today),totalDays};
}
function renderActGantt(list){
  const wrap=document.getElementById('act-gantt-wrap');
  if(!wrap)return;
  window._actGanttListCache=list;
  window._actGanttExportList=list;
  const fTipoVal=getGanttTipoVal();
  list=filterGanttList(list);
  if(!list.length){
    wrap.innerHTML=renderGanttTipoBarHtml(fTipoVal)+'<div class="emp" style="padding:2rem">Sin actividades en este filtro para el planeador.</div>';
    return;
  }
  const expanded=window._ganttExpanded||{};
  const groups=buildGanttGroups(list);
  let rows='';
  groups.forEach(grp=>{
    const expKeys=Object.keys(grp.exps).sort();
    const nAct=expKeys.reduce((n,k)=>n+grp.exps[k].tasks.length,0);
    const isOpen=!!expanded[grp.key];
    const grpTasks=ganttGrpTasks(grp);
    const scale=ganttBuildScale(grpTasks,grp.key);
    const dateToPct=scale.dateToPct;
    const todayPct=scale.todayPct;
    const cols=scale.cols;
    rows+='<div class="act-gantt-grp-tram'+(isOpen?' expanded':'')+'" onclick="toggleGanttGroup(\''+escAttr(grp.key)+'\',event)">'+
      '<div class="act-gantt-hdr-label"><span class="gantt-chevron">▶</span><span class="act-gantt-tram-dot" style="background:'+escAttr(grp.color)+'"></span>'+escAttr(grp.label)+
      ' <span style="font-weight:400;color:var(--tx3)">('+expKeys.length+(grp.key==='libre'?' actividad':' expediente')+(expKeys.length!==1?(grp.key==='libre'?'es':'s'):'')+' · '+nAct+' tarea'+(nAct!==1?'s':'')+')</span></div>'+
      '<div class="act-gantt-hdr-timeline"></div></div>'+
      '<div class="act-gantt-grp-body'+(isOpen?' open':'')+'">';
    if(isOpen){
      rows+='<div class="act-gantt-grp-scale">'+
        '<div class="act-gantt-hdr-label">'+escAttr(fmtF(scale.minD)+' — '+fmtF(scale.maxD))+'</div>'+
        '<div class="act-gantt-hdr-timeline" style="--gantt-cols:'+cols+'">'+scale.hdrCells+'</div></div>';
    }
    expKeys.forEach(ek=>{
      const ex=grp.exps[ek];
      const expGk=ganttExpKey(ek);
      const expOpen=!!expanded[expGk];
      const termInfo=grp.key!=='libre'?ganttExpTermInfo(ek):null;
      const nTasks=ex.tasks.length;
      const libreNom=ex.actNombre||(ex.tasks[0]?(ex.tasks[0].actividad||ex.tasks[0].desc||''):'');
      const expLabel=grp.key==='libre'
        ?String(libreNom||'Actividad sin expediente').substring(0,72)+(ex.tasks.length>1?' ('+ex.tasks.length+' asignaciones)':'')
        :(ex.exp+' · '+String(ex.nombre||'').substring(0,42));
      const expMeta=grp.key==='libre'
        ?(fmtF(ex.tasks[0]&&ex.tasks[0].vence)+' · '+estadoTaskLabel(ex.tasks[0]||{}))
        :(termInfo?(termInfo.ter.d+'/'+termInfo.ter.plazo+' d · vence '+fmtF(termInfo.lim)):nTasks+' tarea'+(nTasks!==1?'s':''));
      rows+='<div class="act-gantt-grp-exp'+(expOpen?' expanded':'')+'" onclick="toggleGanttGroup(\''+escAttr(expGk)+'\',event)">'+
        '<div class="act-gantt-hdr-label" style="border-right:0;flex:1">'+
        '<span class="gantt-chevron-exp">▶</span>'+escAttr(expLabel)+
        (grp.key!=='libre'?' <span style="font-weight:400;color:var(--tx3)">('+escAttr(expMeta)+')</span>':'')+'</div>'+
        '<div class="act-gantt-hdr-timeline act-gantt-track act-gantt-track-tram" style="--gantt-cols:'+cols+'">'+
        ganttTrackTodayHtml(todayPct)+
        (termInfo?ganttTramTermTrackHtml(termInfo,dateToPct):'')+
        '</div></div>'+
        '<div class="act-gantt-exp-body'+(expOpen?' open':'')+'">';
      ex.tasks.sort((a,b)=>(a.vence||'').localeCompare(b.vence||'')).forEach(t=>{
        const ini=taskFechaInicio(t);
        const finBar=t.fechaAtendida||t.vence||ini;
        let left=dateToPct(ini);
        let right=dateToPct(finBar);
        if(right<=left)right=Math.min(100,left+3);
        const width=Math.max(1.5,right-left);
        const cls=ganttEstadoBarClass(t);
        const tip=estadoTaskLabel(t)+' · Inicio '+fmtF(ini)+' · Vence '+fmtF(t.vence)+(t.fechaAtendida?' · Cierre '+fmtF(t.fechaAtendida):'');
        const actSstAction=t.sinExpediente?'openEditarActTaskModal':'abrirConsultaExpPanelDesdeAct';
        const actSstAttrs=' data-sst-action="'+actSstAction+'" data-sst-exp="'+escAttr(t.exp)+'" data-sst-task="'+escAttr(t.id)+'"';
        rows+='<div class="act-gantt-row">'+
          '<div class="act-gantt-label"'+actSstAttrs+' title="'+escAttr(tip)+'" style="padding-left:34px;cursor:pointer">'+
          '<span class="gl-desc">'+escAttr(String(t.desc||t.actividad||'').substring(0,58))+'</span>'+
          '<span class="gl-meta">'+escAttr(taskResponsablesLabel(t,false))+(t.sinExpediente&&t.codigo?' · '+escAttr(t.codigo):'')+' · '+estadoTaskLabel(t)+' · '+fmtF(t.vence)+'</span></div>'+
          '<div class="act-gantt-track" style="--gantt-cols:'+cols+'">'+
          ganttTrackTodayHtml(todayPct)+
          '<div class="act-gantt-bar '+cls+(t.prioritaria?' st-prior':'')+'" style="left:'+left+'%;width:'+width+'%;cursor:pointer" title="'+escAttr(tip)+'"'+actSstAttrs+'>'+escAttr(estadoTaskLabel(t))+'</div>'+
          '</div></div>';
      });
      rows+='</div>';
    });
    rows+='</div>';
  });
  wrap.innerHTML=
    renderGanttTipoBarHtml(fTipoVal)+
    '<div class="act-gantt-legend">'+
    '<span class="act-gantt-leg"><i style="background:var(--am)"></i> Por ejecutar</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--rd)"></i> Vencida</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--bl)"></i> Por revisar</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--or)"></i> Por corregir</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--gn)"></i> Atendida</span>'+
    '<span class="act-gantt-leg"><span style="color:var(--rd);font-weight:700">|</span> Hoy</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--gnl);border:1px dashed var(--gn)"></i> Plazo trámite</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--gnl);border:1px solid var(--gn)"></i> Fecha en términos</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--aml);border:1px solid var(--am)"></i> Próximo a vencer</span>'+
    '<span class="act-gantt-leg"><i style="background:var(--rdl);border:1px solid var(--rd)"></i> Vencimiento de término</span></div>'+
    '<div class="act-gantt-grid"><div class="act-gantt-hdr">'+
    '<div class="act-gantt-hdr-label">Trámite / expediente / actividad</div>'+
    '<div class="act-gantt-hdr-timeline act-gantt-hdr-note">Cada trámite usa su propia escala según su plazo de atención</div></div>'+rows+'</div>';
}
function actMetCard(filterVal,style,inner){
  return '<div class="met met-click" style="'+style+'" onclick="setActFiltro(\''+filterVal+'\')" title="Clic para filtrar">'+inner+'</div>';
}
function filtrarActividadesPorEstado(list,filtro){
  if(filtro==='venc')return list.filter(t=>estadoTask(t)==='Vencida');
  if(filtro==='porver')return list.filter(t=>getTaskSolicitudPendiente(t)||estadoTask(t)==='Por verificar');
  if(filtro==='porcorr')return list.filter(t=>estadoTask(t)==='Por corregir');
  if(filtro==='done')return list.filter(t=>{
    if(esModoResponsable()&&responsableActivo&&taskUsuarioEsAsignado(t,responsableActivo))return estadoTaskForAsignado(t,responsableActivo)==='Atendida';
    return estadoTask(t)==='Atendida';
  });
  if(filtro==='revisados')return list.filter(t=>taskEsRevisada(t));
  if(filtro==='prior')return list.filter(t=>esActividadPrioritariaPendiente(t));
  if(filtro==='pend')return list.filter(t=>esActividadPorEjecutar(t));
  if(filtro==='all')return list;
  return list;
}
function renderActividades(){
  const deptView=esVistaActividadesDepto();
  if(!esModoResponsable()&&!deptView)return;
  const tit=document.getElementById('act-titulo');
  const sub=document.getElementById('act-subtitulo');
  const tb=document.getElementById('tbl-act');
  const mets=document.getElementById('act-mets');
  const btnExp=document.getElementById('btn-export-act');
  const thead=document.querySelector('#pg-act table thead tr');
  if(thead){
    const base='<th>Estado</th><th>Ref.</th><th>Trámite</th><th>Interesado</th><th>Actividad</th>';
    thead.innerHTML=deptView?base+'<th>Responsable</th><th>Vence</th><th>Cierre</th><th>Acciones</th>':base+'<th>Vence</th><th>Cierre</th><th>Acciones</th>';
  }
  if(!deptView&&!responsableActivo){
    if(tit)tit.textContent='Mis actividades asignadas';
    if(sub)sub.textContent='Seleccione su nombre en la barra superior (o pulse «Cambiar responsable»).';
    if(mets)mets.innerHTML='';
    if(tb)tb.innerHTML='<tr><td colspan="8" class="emp">Sin responsable seleccionado.</td></tr>';
    if(btnExp)btnExp.style.display='none';
    return;
  }
  const respFilter=deptView?getActDeptRespFilter():null;
  const enc=getEncargadoDepto(deptoActivo);
  const filterIsEnc=!!respFilter&&respFilter===enc;
  updateActEstFilterForEnc(filterIsEnc);
  if(tit){
    tit.textContent=deptView?(esVistaActividadesOficinaPqrs()?('Actividades PQRSD · '+labelOficina(deptoActivo)+(respFilter?' · '+respFilter:' · Todos los responsables')):('Actividades · '+labelDepto(deptoActivo)+(respFilter?' · '+respFilter:' · Todos los responsables'))):('Actividades de '+responsableActivo);
  }
  const filtroAct=document.getElementById('f-act-est')?document.getElementById('f-act-est').value:'pend';
  const q=(document.getElementById('s-act')?document.getElementById('s-act').value:'').toLowerCase();
  let listRespFilter=respFilter;
  if(deptView&&filtroAct==='porver')listRespFilter=null;
  if(deptView&&filtroAct==='revisados'&&filterIsEnc)listRespFilter=null;
  else if(deptView&&filtroAct==='revisados'&&respFilter&&!filterIsEnc)listRespFilter=respFilter;
  let list=deptView?getTareasDeptActividades(listRespFilter):getTareasResponsableActivo();
  list=filterTasksPeriodo(list,'act');
  list=filtrarActividadesPorEstado(list,filtroAct);
  if(q)list=list.filter(t=>[t.desc,t.exp,t.nombre,t.tram,t.actividad,t.codigo,t.responsable].join(' ').toLowerCase().includes(q));
  list=filtroAct==='revisados'?sortTasksRevisadas(list):sortTasksByUrgency(list);
  window._actExportList=list;
  if(btnExp)btnExp.style.display='';
  const allBase=deptView?getTareasDeptActividades(respFilter):getTareasResponsableActivo();
  const allTodos=deptView?getTareasDeptActividades(null):allBase;
  const all=allBase;
  const venc=all.filter(t=>estadoTask(t)==='Vencida').length;
  const porEjec=all.filter(t=>esActividadPorEjecutar(t)).length;
  const prior=all.filter(t=>esActividadPrioritariaPendiente(t)).length;
  const porcorr=deptView?(filterIsEnc?0:all.filter(t=>estadoTask(t)==='Por corregir').length):all.filter(t=>estadoTask(t)==='Por corregir').length;
  const porrevisar=allTodos.filter(t=>getTaskSolicitudPendiente(t)||estadoTask(t)==='Por verificar').length;
  const revisadosSrc=deptView?(filterIsEnc||!respFilter?allTodos:allBase):[];
  const revisados=deptView?revisadosSrc.filter(t=>taskEsRevisada(t)).length:0;
  const done=all.filter(t=>estadoTask(t)==='Atendida').length;
  const colSpan=deptView?9:8;
  const actPr=document.getElementById('act-periodo-resumen');
  if(actPr)actPr.textContent=labelActPeriodo()?('Filtro de fechas (vencimiento/reporte): '+labelActPeriodo()):'';
  if(sub)sub.textContent=deptView?(filtroAct==='prior'?'Prioritarias: actividades con flag ⚡ que aún no han sido reportadas — al enviar entrega pasan a «Por revisar».':filtroAct==='pend'?'Por ejecutar: actividades en término, vencidas o prioritarias sin entrega reportada.':filtroAct==='porver'&&filterIsEnc?'Por revisar: actividades reportadas por los responsables del departamento (filtro de responsable: encargado).':filtroAct==='revisados'&&filterIsEnc?'Revisadas: actividades evaluadas por el departamento sobre todos los responsables — orden: devueltas a corregir, prioritarias, vencidas, a tiempo y aprobadas.':filtroAct==='revisados'&&respFilter&&!filterIsEnc?'Revisadas de '+respFilter+': solo las actividades de este responsable ya evaluadas por el departamento.':filtroAct==='revisados'?'Revisadas: actividades ya evaluadas por el departamento — indica si se aprobaron o se devolvieron para corregir.':'Filtre por responsable y rango de fechas (opcional). Use «Por revisar» para actividades reportadas por los responsables; desde ahí puede verificar el cierre o devolverlas.'):(filtroAct==='prior'?'Prioritarias: actividades marcadas ⚡ que aún no ha reportado — al enviar entrega pasan a «Por verificar».':filtroAct==='pend'?'Por ejecutar: actividades en término, vencidas o prioritarias sin entrega reportada.':'Reporte con 📤 → el departamento revisa en su menú de actividades. Use «Por verificar» para ver las que ya envió.');
  let metsHtml=
    actMetCard('venc','border-left:3px solid var(--rd)','<div class="v" style="color:var(--rd)">'+venc+'</div><div class="l">Vencidas</div>')+
    actMetCard('pend','','<div class="v">'+porEjec+'</div><div class="l">Por ejecutar</div>')+
    actMetCard('prior','border-left:3px solid var(--rd)','<div class="v" style="color:var(--rd)">'+prior+'</div><div class="l">Prioritarias</div>')+
    actMetCard('porver','border-left:3px solid var(--bl)','<div class="v" style="color:var(--bl)">'+porrevisar+'</div><div class="l">'+(deptView?'Por revisar':'Por verificar')+'</div>');
  if(deptView)metsHtml+=actMetCard('revisados','border-left:3px solid var(--pu)','<div class="v" style="color:var(--pu)">'+revisados+'</div><div class="l">Revisadas</div>');
  if(!filterIsEnc||!deptView)metsHtml+=actMetCard('porcorr','border-left:3px solid var(--or)','<div class="v" style="color:var(--or)">'+porcorr+'</div><div class="l">Por corregir</div>');
  metsHtml+=actMetCard('done','border-left:3px solid var(--gn)','<div class="v" style="color:var(--gn)">'+done+'</div><div class="l">Atendidas</div>');
  if(mets)mets.innerHTML=metsHtml;
  const vistaToggle=document.getElementById('act-vista-toggle');
  const tableWrap=document.getElementById('act-table-wrap');
  const ganttWrap=document.getElementById('act-gantt-wrap');
  if(vistaToggle)vistaToggle.style.display=deptView?'flex':'none';
  const useGantt=deptView&&window._actVista==='gantt';
  if(tableWrap)tableWrap.style.display=useGantt?'none':'';
  if(ganttWrap){
    ganttWrap.style.display=useGantt?'block':'none';
    if(useGantt)renderActGantt(list);
  }
  if(tb&&!useGantt)tb.innerHTML=list.length?list.map(t=>renderActividadesRowHtml(t)).join(''):'<tr><td colspan="'+colSpan+'" class="emp">Sin actividades en este filtro.</td></tr>';
}
// PERSONA_ROLES → js/constants.js
function personaBusquedaTexto(p){
  return [p.pn_nombre,p.pn_identificacion,p.pj_empresa,p.pj_nit,p.pj_rep_nombre,p.pj_rep_identificacion,p.qd_nombre,p.qd_identificacion,p.apo_nombre,p.apo_identificacion,p.pi_nombre,p.pi_identificacion,p.pi_empresa,p.pi_nit].filter(Boolean).join(' ').toLowerCase();
}
function normalizePersonaRecord(p){
  if(!p)return p;
  if(!Array.isArray(p.roles))p.roles=p.origen?[p.origen]:[];
  else if(p.origen&&!p.roles.includes(p.origen))p.roles.push(p.origen);
  if(!Array.isArray(p.expedientes))p.expedientes=[];
  return p;
}
function personaIdentityKey(p){
  if(!p)return'';
  if(p.tipo_persona==='juridica'||p.pi_tipo_persona==='juridica'){
    const nit=(p.pj_nit||p.pi_nit||'').trim().toLowerCase();
    if(nit)return 'j:'+nit;
    const emp=(p.pj_empresa||p.pi_empresa||'').trim().toLowerCase();
    if(emp)return 'jnom:'+emp;
  }
  const id=(p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pi_identificacion||'').trim().toLowerCase();
  if(id)return 'n:'+id;
  const nom=(p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pi_nombre||p.pj_empresa||p.pi_empresa||'').trim().toLowerCase();
  return nom?'nom:'+nom:'';
}
function personaDisplayNombre(p){
  return p.pj_empresa||p.pi_empresa||p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pi_nombre||'Sin nombre';
}
function personaDisplayIdentificacion(p){
  return p.pj_nit||p.pi_nit||p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pi_identificacion||'';
}
function personaRolesLabel(p){
  const roles=(p.roles||[]).map(r=>PERSONA_ROLES[r]||r).filter(Boolean);
  return roles.length?roles.join(', '):'—';
}
function personaExpedientesLabel(p){
  const ex=(p.expedientes||[]).filter(x=>x&&x.exp);
  if(!ex.length)return'—';
  return ex.map(x=>{
    const rs=(x.roles||[]).map(r=>PERSONA_ROLES[r]||r).filter(Boolean).join(', ');
    return x.exp+(rs?' ('+rs+')':'')+(x.depto?' · '+labelDepto(x.depto):'');
  }).join('; ');
}
function personaEtiqueta(p){
  p=normalizePersonaRecord(p);
  return personaDisplayNombre(p)+(personaDisplayIdentificacion(p)?' · '+personaDisplayIdentificacion(p):'')+(p.roles&&p.roles.length?' ['+personaRolesLabel(p)+']':'');
}
function personaKey(p){return personaIdentityKey(p);}
function nombresPersonaBusqueda(p){
  return [p.pn_nombre,p.qd_nombre,p.apo_nombre,p.pi_nombre,p.pj_rep_nombre,p.pi_rep_nombre].filter(Boolean).map(s=>s.toLowerCase());
}
function idsNaturalPersonaBusqueda(p){
  return [p.pn_identificacion,p.qd_identificacion,p.apo_identificacion,p.pi_identificacion,p.pj_rep_identificacion,p.pi_rep_identificacion].filter(Boolean).map(s=>s.toLowerCase());
}
function idsEmpresaBusqueda(p){
  return [p.pj_nit,p.pi_nit].filter(Boolean).map(s=>s.toLowerCase());
}
function idsPersonaBusqueda(p){
  return idsNaturalPersonaBusqueda(p).concat(idsEmpresaBusqueda(p));
}
function personaTieneDatosEmpresa(p){
  p=normalizePersonaRecord(p);
  return !!(p.pj_empresa||p.pi_empresa||p.pj_nit||p.pi_nit);
}
function personaTieneDatosNatural(p){
  p=normalizePersonaRecord(p);
  return !!(p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pi_nombre||p.pj_rep_nombre||p.pi_rep_nombre||p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pi_identificacion||p.pj_rep_identificacion||p.pi_rep_identificacion);
}
function personaAptaParaTarget(p,target,field){
  if(['apo','aut','pn','qd'].includes(target)){
    if(field==='empresa'||field==='nit'||field==='rep_nombre'||field==='rep_identificacion')return false;
    if(personaTieneDatosEmpresa(p)&&!personaTieneDatosNatural(p))return false;
  }
  if((target==='pj'||target==='pi')&&(field==='empresa'||field==='nit'))return personaTieneDatosEmpresa(p);
  return true;
}
function llenarEmpresaJuridica(p,pref){
  const esPi=pref==='pi';
  setv('fld__'+(esPi?'pi_empresa':'pj_empresa'),p[esPi?'pi_empresa':'pj_empresa']||p[esPi?'pj_empresa':'pi_empresa']||'');
  setv('fld__'+(esPi?'pi_nit':'pj_nit'),p[esPi?'pi_nit':'pj_nit']||p[esPi?'pj_nit':'pi_nit']||'');
  if(esPi){
    setv('fld__pi_correo_emp',p.pi_correo_emp||p.pj_correo||'');
    setv('fld__pi_telefono_emp',p.pi_telefono_emp||p.pj_telefono||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pi_emp_'+k,p['_pi_emp_'+k]||p['_pj_'+k]||''));
  }else{
    setv('fld__pj_correo',p.pj_correo||p.pi_correo_emp||'');
    setv('fld__pj_telefono',p.pj_telefono||p.pi_telefono_emp||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pj_'+k,p['_pj_'+k]||p['_pi_emp_'+k]||''));
  }
}
function personaNombreNatural(p){
  p=normalizePersonaRecord(p);
  return p.pj_rep_nombre||p.pi_rep_nombre||p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pi_nombre||'';
}
function personaIdNatural(p){
  p=normalizePersonaRecord(p);
  return p.pj_rep_identificacion||p.pi_rep_identificacion||p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pi_identificacion||'';
}
function personaCorreoNatural(p){
  p=normalizePersonaRecord(p);
  return p.pj_rep_correo||p.pi_rep_correo||p.pn_correo||p.qd_correo||p.apo_correo||p.pi_correo||'';
}
function personaTelefonoNatural(p){
  p=normalizePersonaRecord(p);
  return p.pj_rep_telefono||p.pi_rep_telefono||p.pn_telefono||p.qd_telefono||p.apo_telefono||p.pi_telefono||'';
}
function nombresRepLegalBusqueda(p){
  return [p.pj_rep_nombre,p.pi_rep_nombre,p.pn_nombre,p.qd_nombre,p.apo_nombre,p.pi_nombre].filter(Boolean).map(s=>s.toLowerCase());
}
function idsRepLegalBusqueda(p){
  return [p.pj_rep_identificacion,p.pi_rep_identificacion,p.pn_identificacion,p.qd_identificacion,p.apo_identificacion,p.pi_identificacion].filter(Boolean);
}
function matchPersonaCampo(p,target,field,ql){
  if(!ql)return false;
  p=normalizePersonaRecord(p);
  if(field==='rep_nombre'){
    if(/^\d{5,}$/.test(ql.replace(/\s/g,'')))return false;
    return nombresRepLegalBusqueda(p).some(n=>n.includes(ql));
  }
  if(field==='rep_identificacion'){
    const qn=(ql||'').replace(/\D/g,'');
    if(!qn)return false;
    return idsRepLegalBusqueda(p).some(id=>(id||'').replace(/\D/g,'').includes(qn));
  }
  if(field==='nombre'){
    if(/^\d{5,}$/.test(ql.replace(/\s/g,'')))return false;
    return nombresPersonaBusqueda(p).some(n=>n.includes(ql));
  }
  if(field==='identificacion'){
    const qn=(ql||'').replace(/\D/g,'');
    if(!qn)return false;
    return idsNaturalPersonaBusqueda(p).some(id=>(id||'').replace(/\D/g,'').includes(qn));
  }
  if(field==='nit'){
    const qn=(ql||'').replace(/\D/g,'');
    if(!qn)return false;
    return idsEmpresaBusqueda(p).some(id=>(id||'').replace(/\D/g,'').includes(qn));
  }
  if(field==='empresa')return (p.pj_empresa||p.pi_empresa||'').toLowerCase().includes(ql);
  return false;
}
function personaEtiquetaSug(p,field){
  p=normalizePersonaRecord(p);
  const rolTxt=personaRolesLabel(p)+': ';
  if(field==='identificacion'||field==='nit'){
    return rolTxt+(personaDisplayIdentificacion(p)||'—')+' · '+personaDisplayNombre(p);
  }
  if(field==='rep_nombre')return rolTxt+personaNombreNatural(p)+(personaIdNatural(p)?' · '+personaIdNatural(p):'');
  if(field==='rep_identificacion')return rolTxt+personaIdNatural(p)+(personaNombreNatural(p)?' · '+personaNombreNatural(p):'');
  if(field==='empresa')return rolTxt+(p.pj_empresa||p.pi_empresa||'');
  return rolTxt+personaDisplayNombre(p);
}
function buscarPersonas(q,target,field,lim){
  const ql=(q||'').trim().toLowerCase();
  const minLen=(field==='identificacion'||field==='nit'||field==='rep_identificacion')?1:2;
  if(ql.length<minLen)return [];
  const seen=new Set();
  const out=[];
  function add(p){p=normalizePersonaRecord({...p});if(!personaAptaParaTarget(p,target,field))return;const k=personaIdentityKey(p);if(!k||seen.has(k))return;seen.add(k);out.push(p);}
  personas.map(normalizePersonaRecord).filter(p=>matchPersonaCampo(p,target,field,ql)).forEach(add);
  exps.forEach(e=>{
    const snaps=[];
    const p=extraerPersonaDeExpediente(e);if(p)snaps.push(p);
    const a=extraerApoderadoDeExpediente(e);if(a)snaps.push(a);
    const au=extraerAutorizadoDeExpediente(e);if(au)snaps.push(au);
    const i=extraerInfractorDeExpediente(e);if(i)snaps.push(i);
    snaps.forEach(s=>{if(matchPersonaCampo(s,target,field,ql))add(s);});
  });
  return out.slice(0,lim||12);
}
function addExpedienteAsoc(lista,expId,depto,roles){
  if(!expId)return lista||[];
  lista=lista||[];
  const rolesU=[...new Set((roles||[]).filter(Boolean))];
  const i=lista.findIndex(x=>x.exp===expId);
  if(i>=0){
    const cur=lista[i];
    rolesU.forEach(r=>{if(!cur.roles.includes(r))cur.roles.push(r);});
    if(depto)cur.depto=depto;
    return lista;
  }
  return [...lista,{exp:expId,depto:depto||'',roles:rolesU}];
}
function mergePersonaEnCatalogo(snap,newRoles,expId,depto){
  snap=normalizePersonaRecord({...snap});
  if(!personaDisplayNombre(snap)&&!personaDisplayIdentificacion(snap))return;
  const key=personaIdentityKey(snap);
  let idx=key?personas.findIndex(p=>personaIdentityKey(p)===key):-1;
  const idLower=(snap.pn_identificacion||snap.qd_identificacion||snap.apo_identificacion||snap.pi_identificacion||snap.pj_nit||snap.pi_nit||'').trim().toLowerCase();
  if(idx<0&&idLower)idx=personas.findIndex(p=>idsPersonaBusqueda(p).includes(idLower));
  const rolesAdd=[...new Set((newRoles||[]).filter(Boolean))];
  if(idx>=0){
    const cur=normalizePersonaRecord(personas[idx]);
    rolesAdd.forEach(r=>{if(!cur.roles.includes(r))cur.roles.push(r);});
    personas[idx]=normalizePersonaRecord({
      ...cur,...snap,
      id:cur.id,
      roles:cur.roles,
      expedientes:addExpedienteAsoc(cur.expedientes,expId,depto,rolesAdd),
      actualizado:hoy()
    });
  }else{
    personas.push(normalizePersonaRecord({
      ...snap,
      id:'p'+Date.now()+Math.random().toString(36).slice(2,6),
      roles:rolesAdd,
      expedientes:expId?addExpedienteAsoc([],expId,depto,rolesAdd):[],
      actualizado:hoy()
    }));
  }
}
function extraerApoderadoDeExpediente(data){
  if(!data._apoderado||!(data._apo_nombre||data._apo_identificacion))return null;
  const o={id:'',tipo_persona:'natural',origen:'apoderado',apo_nombre:data._apo_nombre||'',apo_identificacion:data._apo_identificacion||'',pn_nombre:data._apo_nombre||'',pn_identificacion:data._apo_identificacion||'',pn_correo:data._apo_correo||'',pn_telefono:data._apo_telefono||''};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_apo_'+k]=data['_apo_'+k]||'');
  return o;
}
function extraerInfractorDeExpediente(data){
  const tp=data._pi_tipo_persona||'natural';
  if(tp==='juridica'){
    if(!data._pi_empresa&&!data._pi_nit&&!data._pi_rep_nombre)return null;
    const o={id:'',origen:'infractor',pi_tipo_persona:'juridica',tipo_persona:'juridica',pi_empresa:data._pi_empresa||'',pi_nit:data._pi_nit||'',pi_rep_nombre:data._pi_rep_nombre||'',pi_rep_identificacion:data._pi_rep_identificacion||'',pi_rep_correo:data._pi_rep_correo||'',pi_rep_telefono:data._pi_rep_telefono||'',pi_correo_emp:data._pi_correo_emp||'',pi_telefono_emp:data._pi_telefono_emp||''};
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_pi_emp_'+k]=data['_pi_emp_'+k]||'');
    return o;
  }
  if(!data._pi_nombre&&!data._pi_identificacion)return null;
  const o={id:'',origen:'infractor',pi_tipo_persona:'natural',tipo_persona:'natural',pi_nombre:data._pi_nombre||'',pi_identificacion:data._pi_identificacion||'',pn_nombre:data._pi_nombre||'',pn_identificacion:data._pi_identificacion||'',pn_correo:data._pi_correo||'',pn_telefono:data._pi_telefono||''};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_pi_'+k]=data['_pi_'+k]||'');
  return o;
}
function extraerAutorizadoDeExpediente(data){
  if(!data._autorizado||!(data._aut_nombre||data._aut_identificacion))return null;
  const o={id:'',tipo_persona:'natural',origen:'autorizado',pn_nombre:data._aut_nombre||'',pn_identificacion:data._aut_identificacion||'',pn_correo:data._aut_correo||'',pn_telefono:data._aut_telefono||''};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_aut_'+k]=data['_aut_'+k]||'');
  return o;
}
function personSugAttrs(target,field){
  const isNum=field==='identificacion'||field==='nit'||field==='rep_identificacion';
  const onInp=isNum?'onlyNums(this);filtrarPersonasSug(this,\''+target+'\',\''+field+'\')':'filtrarPersonasSug(this,\''+target+'\',\''+field+'\')';
  return ' oninput="'+onInp+'" onfocus="filtrarPersonasSug(this,\''+target+'\',\''+field+'\')" onblur="setTimeout(()=>hidePersonSug(),180)"'+(isNum?' inputmode="numeric" pattern="[0-9]*"':'');
}
function positionPersonSugPortal(inp){
  const portal=document.getElementById('person-sug-portal');if(!portal||!inp)return;
  const r=inp.getBoundingClientRect();
  portal.style.left=Math.max(8,r.left)+'px';
  portal.style.top=(r.bottom+4)+'px';
  portal.style.width=Math.max(r.width,360)+'px';
  portal.style.zIndex=portalZIndexFlotante();
}
function filtrarPersonasSug(inp,target,field){
  if(!inp)return;
  personSugInput=inp;personSugTarget=target;
  personSugField=field||'nombre';
  const portal=document.getElementById('person-sug-portal');
  if(!portal)return;
  const q=inp.value.trim();
  const list=buscarPersonas(q,target,personSugField,12);
  window._personSugList=list;
  portal.innerHTML=list.map((p,i)=>'<button type="button" onmousedown="pickPersonaCatalog('+i+',\''+jsStr(target)+'\')"><strong>'+escAttr(personaEtiquetaSug(p,personSugField))+'</strong></button>').join('');
  if(list.length){positionPersonSugPortal(inp);portal.style.display='block';}else portal.style.display='none';
}
let personSugTarget='pn';
let personSugField='nombre';
function hidePersonSug(){
  const portal=document.getElementById('person-sug-portal');
  if(portal)portal.style.display='none';
  personSugInput=null;
}
function pickPersonaCatalog(idx,target){
  const p=(window._personSugList||[])[idx];if(!p)return;
  aplicarPersonaCatalog(p,target);
  hidePersonSug();
}
function aplicarPersonaCatalog(p,target){
  if((target==='pj'||target==='pi')&&(personSugField==='rep_nombre'||personSugField==='rep_identificacion')){
    const pref=target==='pi'?'pi':'pj';
    if(target==='pj'){
      const tp=document.getElementById('fld__tipo_persona');if(tp){tp.value='juridica';togglePersona();}
    }else{
      const tp=document.getElementById('fld__pi_tipo_persona');if(tp){tp.value='juridica';toggleInfractor();}
    }
    setv('fld__'+pref+'_rep_nombre',personaNombreNatural(p));
    setv('fld__'+pref+'_rep_identificacion',personaIdNatural(p));
    setv('fld__'+pref+'_rep_correo',personaCorreoNatural(p));
    setv('fld__'+pref+'_rep_telefono',personaTelefonoNatural(p));
    if(personaTieneDatosEmpresa(p)||p.tipo_persona==='juridica'||p.pi_tipo_persona==='juridica')llenarEmpresaJuridica(p,pref);
    return;
  }
  if((target==='pj'||target==='pi')&&(personSugField==='empresa'||personSugField==='nit')){
    const pref=target;
    if(target==='pj'){
      const tp=document.getElementById('fld__tipo_persona');if(tp){tp.value='juridica';togglePersona();}
    }else{
      const tp=document.getElementById('fld__pi_tipo_persona');if(tp){tp.value='juridica';toggleInfractor();}
    }
    llenarEmpresaJuridica(p,pref);
    const rp=pref==='pi'?'pi':'pj';
    setv('fld__'+rp+'_rep_nombre',p[rp+'_rep_nombre']||personaNombreNatural(p));
    setv('fld__'+rp+'_rep_identificacion',p[rp+'_rep_identificacion']||personaIdNatural(p));
    setv('fld__'+rp+'_rep_correo',p[rp+'_rep_correo']||personaCorreoNatural(p));
    setv('fld__'+rp+'_rep_telefono',p[rp+'_rep_telefono']||personaTelefonoNatural(p));
    return;
  }
  if(target==='apo'){
    const cb=document.getElementById('fld__apoderado');if(cb&&!cb.checked){cb.checked=true;toggleApoderado();}
    setv('fld__apo_nombre',p.apo_nombre||p.pn_nombre||p.qd_nombre||p.pj_rep_nombre||p.pi_rep_nombre||'');
    setv('fld__apo_identificacion',p.apo_identificacion||p.pn_identificacion||p.qd_identificacion||p.pj_rep_identificacion||p.pi_rep_identificacion||'');
    setv('fld__apo_correo',p.pn_correo||'');
    setv('fld__apo_telefono',p.pn_telefono||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__apo_'+k,p['_apo_'+k]||p['_pn_'+k]||''));
    return;
  }
  if(target==='aut'){
    const cb=document.getElementById('fld__autorizado');if(cb&&!cb.checked){cb.checked=true;toggleAutorizado();}
    setv('fld__aut_nombre',p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pj_rep_nombre||p.pi_rep_nombre||'');
    setv('fld__aut_identificacion',p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pj_rep_identificacion||p.pi_rep_identificacion||'');
    setv('fld__aut_correo',p.pn_correo||p.qd_correo||'');
    setv('fld__aut_telefono',p.pn_telefono||p.qd_telefono||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__aut_'+k,p['_aut_'+k]||p['_pn_'+k]||p['_qd_'+k]||''));
    return;
  }
  if(target==='pi'){
    const tp=document.getElementById('fld__pi_tipo_persona');
    const esJur=p.pi_tipo_persona==='juridica'||p.tipo_persona==='juridica';
    if(tp){tp.value=esJur?'juridica':'natural';toggleInfractor();}
    if(esJur){
      setv('fld__pi_empresa',p.pi_empresa||p.pj_empresa||'');
      setv('fld__pi_nit',p.pi_nit||p.pj_nit||'');
      setv('fld__pi_correo_emp',p.pi_correo_emp||p.pj_correo||'');
      setv('fld__pi_telefono_emp',p.pi_telefono_emp||p.pj_telefono||'');
      setv('fld__pi_rep_nombre',p.pi_rep_nombre||p.pj_rep_nombre||personaNombreNatural(p));
      setv('fld__pi_rep_identificacion',p.pi_rep_identificacion||p.pj_rep_identificacion||personaIdNatural(p));
      setv('fld__pi_rep_correo',p.pi_rep_correo||p.pj_rep_correo||personaCorreoNatural(p));
      setv('fld__pi_rep_telefono',p.pi_rep_telefono||p.pj_rep_telefono||personaTelefonoNatural(p));
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pi_emp_'+k,p['_pi_emp_'+k]||p['_pj_'+k]||''));
    }else{
      setv('fld__pi_nombre',p.pi_nombre||p.pn_nombre||'');
      setv('fld__pi_identificacion',p.pi_identificacion||p.pn_identificacion||'');
      setv('fld__pi_correo',p.pn_correo||'');
      setv('fld__pi_telefono',p.pn_telefono||'');
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pi_'+k,p['_pi_'+k]||p['_pn_'+k]||''));
    }
    return;
  }
  if(target==='qd'){
    setv('fld__qd_nombre',p.qd_nombre||p.pn_nombre||'');
    setv('fld__qd_identificacion',p.qd_identificacion||p.pn_identificacion||'');
    setv('fld__qd_correo',p.qd_correo||p.pn_correo||'');
    setv('fld__qd_telefono',p.qd_telefono||p.pn_telefono||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__qd_'+k,p['_qd_'+k]||p['_pn_'+k]||''));
    return;
  }
  if(target==='sec-pn'){
    const tp=document.getElementById('sec-tipo-persona');if(tp){tp.value='natural';toggleSecPersona();}
    setv('sec-pn-nombre',p.pn_nombre||p.qd_nombre||'');
    setv('sec-pn-identificacion',p.pn_identificacion||p.qd_identificacion||'');
    setv('sec-pn-correo',p.pn_correo||p.qd_correo||'');
    setv('sec-pn-telefono',p.pn_telefono||p.qd_telefono||'');
    return;
  }
  if(target==='sec-pj'){
    const tp=document.getElementById('sec-tipo-persona');if(tp){tp.value='juridica';toggleSecPersona();}
    if(personSugField==='empresa'||personSugField==='nit'){
      setv('sec-pj-empresa',p.pj_empresa||p.pi_empresa||'');
      setv('sec-pj-nit',p.pj_nit||p.pi_nit||'');
      setv('sec-pj-correo',p.pj_correo||p.pi_correo_emp||'');
      setv('sec-pj-telefono',p.pj_telefono||p.pi_telefono_emp||'');
    }else{
      setv('sec-pj-empresa',p.pj_empresa||p.pi_empresa||'');
      setv('sec-pj-nit',p.pj_nit||p.pi_nit||'');
      setv('sec-pj-correo',p.pj_correo||p.pi_correo_emp||'');
      setv('sec-pj-telefono',p.pj_telefono||p.pi_telefono_emp||'');
    }
    return;
  }
  if(target==='sec-ofi'){
    const tp=document.getElementById('sec-tipo-persona');if(tp){tp.value='juridica';toggleSecPersona();}
    setv('sec-pj-ofi-nombre',p.pn_nombre||p.qd_nombre||p.apo_nombre||p.pj_rep_nombre||'');
    setv('sec-pj-ofi-identificacion',p.pn_identificacion||p.qd_identificacion||p.apo_identificacion||p.pj_rep_identificacion||'');
    setv('sec-pj-ofi-correo',p.pn_correo||p.qd_correo||'');
    setv('sec-pj-ofi-telefono',p.pn_telefono||p.qd_telefono||'');
    return;
  }
  if(target==='pj'||p.tipo_persona==='juridica'){
    const tp=document.getElementById('fld__tipo_persona');if(tp)tp.value='juridica';
    togglePersona();
    setv('fld__pj_empresa',p.pj_empresa||p.pi_empresa||'');setv('fld__pj_nit',p.pj_nit||p.pi_nit||'');
    setv('fld__pj_correo',p.pj_correo||p.pi_correo_emp||'');setv('fld__pj_telefono',p.pj_telefono||p.pi_telefono_emp||'');
    setv('fld__pj_rep_nombre',p.pj_rep_nombre||personaNombreNatural(p));setv('fld__pj_rep_identificacion',p.pj_rep_identificacion||personaIdNatural(p));
    setv('fld__pj_rep_correo',p.pj_rep_correo||personaCorreoNatural(p));setv('fld__pj_rep_telefono',p.pj_rep_telefono||personaTelefonoNatural(p));
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pj_'+k,p['_pj_'+k]||''));
    return;
  }
  const tp=document.getElementById('fld__tipo_persona');if(tp)tp.value='natural';
  togglePersona();
  setv('fld__pn_nombre',p.pn_nombre||'');setv('fld__pn_identificacion',p.pn_identificacion||'');
  setv('fld__pn_correo',p.pn_correo||'');setv('fld__pn_telefono',p.pn_telefono||'');
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>setv('fld__pn_'+k,p['_pn_'+k]||''));
}
function setv(id,val){const el=document.getElementById(id);if(el)el.value=val||'';}
function extraerPersonaDeExpediente(data){
  if(esModoCasoEspecial(data)){
    if(data._qd_anonimo||!(data._qd_nombre||data._qd_identificacion))return null;
    const o={id:'',tipo_persona:'natural',origen:'peticionario'};
    ['qd_nombre','qd_identificacion','qd_correo','qd_telefono'].forEach(k=>o[k]=data['_'+k]||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_qd_'+k]=data['_qd_'+k]||'');
    return o;
  }
  const tp=data._tipo_persona||'natural';
  const o={id:'',tipo_persona:tp,origen:'interesado'};
  if(tp==='juridica'){
    ['pj_rep_nombre','pj_rep_identificacion','pj_rep_correo','pj_rep_telefono','pj_empresa','pj_nit','pj_correo','pj_telefono'].forEach(k=>o[k]=data['_'+k]||'');
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_pj_'+k]=data['_pj_'+k]||'');
    if(!o.pj_empresa&&!o.pj_nit&&!o.pj_rep_nombre)return null;
    return o;
  }
  ['pn_nombre','pn_identificacion','pn_correo','pn_telefono'].forEach(k=>o[k]=data['_'+k]||'');
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_pn_'+k]=data['_pn_'+k]||'');
  if(!o.pn_nombre&&!o.pn_identificacion)return null;
  return o;
}
function upsertPersonaCatalog(data){
  const expId=data._exp;
  const depto=data._depto||getDeptoOperativo();
  const p=extraerPersonaDeExpediente(data);
  if(p)mergePersonaEnCatalogo(p,esTramitePqrs(data._tramite)?['peticionario']:['interesado'],expId,depto);
  if(data._apoderado){
    const apo=extraerApoderadoDeExpediente(data);
    if(apo)mergePersonaEnCatalogo(apo,['apoderado'],expId,depto);
  }
  if(data._autorizado){
    const aut=extraerAutorizadoDeExpediente(data);
    if(aut)mergePersonaEnCatalogo(aut,['autorizado'],expId,depto);
  }
  const inf=extraerInfractorDeExpediente(data);
  if(inf)mergePersonaEnCatalogo(inf,['infractor'],expId,depto);
}
function getRolesPersonaManual(){
  return Object.keys(PERSONA_ROLES).filter(r=>{
    const el=document.getElementById('per-rol-'+r);
    return el&&el.checked;
  });
}
function guardarPersonaManual(){
  if(!cfgPuedeEditarPersonas()){notif('No tiene permiso para editar personas','err');return;}
  const roles=getRolesPersonaManual();
  const tipo=document.getElementById('per-tipo')?document.getElementById('per-tipo').value:'natural';
  let snap;
  if(tipo==='juridica'){
    const empresa=(document.getElementById('per-empresa')?document.getElementById('per-empresa').value:'').trim();
    const nit=(document.getElementById('per-nit')?document.getElementById('per-nit').value:'').trim();
    const repNom=(document.getElementById('per-rep-nombre')?document.getElementById('per-rep-nombre').value:'').trim();
    const repId=(document.getElementById('per-rep-ident')?document.getElementById('per-rep-ident').value:'').trim();
    const correo=(document.getElementById('per-correo-j')?document.getElementById('per-correo-j').value:'').trim();
    const telefono=(document.getElementById('per-tel-j')?document.getElementById('per-tel-j').value:'').trim();
    const repCor=(document.getElementById('per-rep-correo')?document.getElementById('per-rep-correo').value:'').trim();
    const repTel=(document.getElementById('per-rep-tel')?document.getElementById('per-rep-tel').value:'').trim();
    if(!empresa&&!nit&&!repNom){notif('Indique empresa, NIT o representante legal','err');return;}
    if(correo&&!emailValido(correo)){notif('Correo de empresa inválido','err');return;}
    if(repCor&&!emailValido(repCor)){notif('Correo del representante inválido','err');return;}
    snap=normalizePersonaRecord({
      tipo_persona:'juridica',
      pj_empresa:empresa,pj_nit:nit,pj_correo:correo,pj_telefono:telefono,
      pj_rep_nombre:repNom,pj_rep_identificacion:repId,pj_rep_correo:repCor,pj_rep_telefono:repTel
    });
  }else{
    const nombre=(document.getElementById('per-nombre')?document.getElementById('per-nombre').value:'').trim();
    const ident=(document.getElementById('per-ident')?document.getElementById('per-ident').value:'').trim();
    const correo=(document.getElementById('per-correo')?document.getElementById('per-correo').value:'').trim();
    const telefono=(document.getElementById('per-tel')?document.getElementById('per-tel').value:'').trim();
    if(!nombre&&!ident){notif('Indique al menos nombre o identificación','err');return;}
    if(correo&&!emailValido(correo)){notif('Correo inválido','err');return;}
    snap=normalizePersonaRecord({
      tipo_persona:'natural',
      pn_nombre:nombre,pn_identificacion:ident,pn_correo:correo,pn_telefono:telefono,
      qd_nombre:nombre,qd_identificacion:ident,qd_correo:correo,qd_telefono:telefono,
      apo_nombre:nombre,apo_identificacion:ident,
      pi_nombre:nombre,pi_identificacion:ident
    });
  }
  const editPid=document.getElementById('per-edit-id')?document.getElementById('per-edit-id').value:'';
  if(editPid){
    const idx=personas.findIndex(x=>x.id===editPid);
    if(idx>=0){
      const cur=normalizePersonaRecord(personas[idx]);
      personas[idx]=normalizePersonaRecord({...cur,...snap,id:editPid,roles:roles,actualizado:hoy()});
    }
  }else{
    mergePersonaEnCatalogo(snap,roles,null,null);
  }
  saveLS();renderPersonasCfg();auditCfgChange('Personas / usuarios');notif('Persona guardada en el catálogo','ok');
}
function togglePerTipoCfg(){
  const t=document.getElementById('per-tipo')?document.getElementById('per-tipo').value:'natural';
  const nat=document.getElementById('per-form-natural');
  const jur=document.getElementById('per-form-juridica');
  // Migrar datos al cambiar de tipo para no "perder" la información ya ingresada
  if(t==='juridica'&&nat&&nat.style.display!=='none'){
    // natural → jurídica: mover datos de la persona natural al representante legal
    const gv2=function(id){const el=document.getElementById(id);return el?el.value:'';};
    const setv2=function(id,v){const el=document.getElementById(id);if(el&&!el.value)el.value=v;};
    setv2('per-rep-nombre',gv2('per-nombre'));
    setv2('per-rep-ident',gv2('per-ident'));
    setv2('per-rep-correo',gv2('per-correo'));
    setv2('per-rep-tel',gv2('per-tel'));
  }else if(t==='natural'&&jur&&jur.style.display!=='none'){
    // jurídica → natural: mover datos del representante a la persona natural
    const gv2=function(id){const el=document.getElementById(id);return el?el.value:'';};
    const setv2=function(id,v){const el=document.getElementById(id);if(el&&!el.value)el.value=v;};
    setv2('per-nombre',gv2('per-rep-nombre'));
    setv2('per-ident',gv2('per-rep-ident'));
    setv2('per-correo',gv2('per-rep-correo'));
    setv2('per-tel',gv2('per-rep-tel'));
  }
  if(nat)nat.style.display=t==='juridica'?'none':'';
  if(jur)jur.style.display=t==='juridica'?'':'none';
}
function editarPersonaCatalog(id){
  if(!cfgPuedeEditarPersonas()){notif('No tiene permiso para editar personas','err');return;}
  const p=normalizePersonaRecord(personas.find(x=>x.id===id));if(!p)return;
  Object.keys(PERSONA_ROLES).forEach(r=>{
    const el=document.getElementById('per-rol-'+r);
    if(el)el.checked=(p.roles||[]).includes(r);
  });
  const esJur=p.tipo_persona==='juridica'||!!(p.pj_empresa||p.pj_nit);
  const tipoEl=document.getElementById('per-tipo');if(tipoEl)tipoEl.value=esJur?'juridica':'natural';
  togglePerTipoCfg();
  if(esJur){
    setv('per-empresa',p.pj_empresa||'');setv('per-nit',p.pj_nit||'');
    setv('per-correo-j',p.pj_correo||'');setv('per-tel-j',p.pj_telefono||'');
    setv('per-rep-nombre',p.pj_rep_nombre||'');setv('per-rep-ident',p.pj_rep_identificacion||'');
    setv('per-rep-correo',p.pj_rep_correo||'');setv('per-rep-tel',p.pj_rep_telefono||'');
  }else{
    setv('per-nombre',personaDisplayNombre(p));setv('per-ident',personaDisplayIdentificacion(p));
    setv('per-correo',p.pn_correo||p.qd_correo||'');setv('per-tel',p.pn_telefono||p.qd_telefono||'');
  }
  const hid=document.getElementById('per-edit-id');if(hid)hid.value=p.id;
  const formFold=document.querySelector('#cfg-personas-panel details.cfg-fold');
  if(formFold)formFold.open=true;
  const panel=document.getElementById('cfg-personas-panel');
  if(panel)window.scrollTo(0,panel.offsetTop-80);
}
function eliminarPersonaCatalog(id){
  if(!cfgPuedeEditarPersonas()){notif('No tiene permiso para editar personas','err');return;}
  const p=personas.find(x=>x.id===id);
  confirmEliminar({message:'¿Eliminar esta persona del catálogo?',detail:p?personaDisplayNombre(p):''},()=>{
    personas=personas.filter(x=>x.id!==id);saveLS();renderPersonasCfg();notif('Eliminado del catálogo','ok');
  });
}
function limpiarFormPersonaCfg(){
  ['per-nombre','per-ident','per-correo','per-tel','per-empresa','per-nit','per-correo-j','per-tel-j','per-rep-nombre','per-rep-ident','per-rep-correo','per-rep-tel','per-edit-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const tipoEl=document.getElementById('per-tipo');if(tipoEl)tipoEl.value='natural';
  togglePerTipoCfg();
  Object.keys(PERSONA_ROLES).forEach(r=>{const el=document.getElementById('per-rol-'+r);if(el)el.checked=false;});
}
function rolesCheckboxesHtml(prefix,selected){
  selected=selected||[];
  return '<div class="fx" style="gap:10px;flex-wrap:wrap;margin-bottom:.5rem">'+Object.entries(PERSONA_ROLES).map(([k,v])=>'<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer"><input type="checkbox" id="'+prefix+'-rol-'+k+'"'+(selected.includes(k)?' checked':'')+'> '+v+'</label>').join('')+'</div>';
}
function getPersonasCfgLista(){
  const filtro=(document.getElementById('per-filtro')?document.getElementById('per-filtro').value:'').toLowerCase();
  const rolFilt=document.getElementById('per-filtro-rol')?document.getElementById('per-filtro-rol').value:'';
  return [...personas].map(normalizePersonaRecord).filter(p=>{
    const mRol=!rolFilt||(p.roles||[]).includes(rolFilt);
    const mTxt=!filtro||personaBusquedaTexto(p).includes(filtro)||personaEtiqueta(p).toLowerCase().includes(filtro);
    return mRol&&mTxt;
  }).sort((a,b)=>(b.actualizado||'').localeCompare(a.actualizado||''));
}
function renderPersonasTablaOnly(){
  const tbody=document.getElementById('per-tabla-body');if(!tbody)return;
  const lista=getPersonasCfgLista();
  tbody.innerHTML=lista.length?lista.map(p=>{
    const esJur=p.tipo_persona==='juridica'||!!(p.pj_empresa||p.pj_nit);
    return '<tr>'+
    '<td style="font-size:11px">'+(esJur?'Jurídica':'Natural')+'</td>'+
    '<td style="font-size:11px;max-width:120px">'+personaRolesLabel(p)+'</td>'+
    '<td style="font-weight:600">'+personaDisplayNombre(p)+(esJur&&p.pj_rep_nombre?'<div style="font-size:11px;color:var(--tx2);font-weight:400">Rep: '+p.pj_rep_nombre+'</div>':'')+'</td>'+
    '<td>'+personaDisplayIdentificacion(p)+(esJur&&p.pj_rep_identificacion?'<div style="font-size:11px;color:var(--tx2)">Rep: '+p.pj_rep_identificacion+'</div>':'')+'</td>'+
    '<td style="font-size:11px;max-width:180px">'+personaExpedientesLabel(p)+'</td>'+
    '<td style="font-size:12px">'+(p.pj_correo||p.pn_correo||p.qd_correo||'')+'</td>'+
    '<td>'+(cfgPuedeEditarPersonas()?('<div class="fx" style="gap:4px"><button type="button" class="btn bsm bic" onclick="editarPersonaCatalog(\''+p.id+'\')">✏️</button><button type="button" class="btn bsm bic bd2" onclick="eliminarPersonaCatalog(\''+p.id+'\')">✕</button></div>'):'')+'</td>'+
  '</tr>';}).join(''):'<tr><td colspan="7" class="emp">Sin personas en el catálogo.</td></tr>';
  const cnt=document.getElementById('per-cat-count');if(cnt)cnt.textContent=personas.length+' en catálogo';
}
function renderPersonasCfg(){
  const panel=document.getElementById('cfg-personas-panel');if(!panel)return;
  const puedeEdit=cfgPuedeEditarPersonas();
  const filtro=(document.getElementById('per-filtro')?document.getElementById('per-filtro').value:'').toLowerCase();
  const rolFilt=document.getElementById('per-filtro-rol')?document.getElementById('per-filtro-rol').value:'';
  const editId=document.getElementById('per-edit-id')?document.getElementById('per-edit-id').value:'';
  const editRec=editId?normalizePersonaRecord(personas.find(x=>x.id===editId)):null;
  const selectedRoles=editRec&&editRec.roles?editRec.roles:[];
  const esJurEdit=editRec&&(editRec.tipo_persona==='juridica'||!!(editRec.pj_empresa||editRec.pj_nit));
  const filtroRolOpts='<option value="">Todos los roles</option>'+Object.entries(PERSONA_ROLES).map(([k,v])=>'<option value="'+k+'"'+(rolFilt===k?' selected':'')+'>'+v+'</option>').join('');
  const formBody=
    '<div class="slbl" style="margin-bottom:.4rem">Roles (opcional)</div>'+rolesCheckboxesHtml('per',selectedRoles)+
    '<div class="fg" style="margin-bottom:.6rem"><div class="fld"><label>Tipo</label><select id="per-tipo" onchange="togglePerTipoCfg()"><option value="natural"'+(esJurEdit?'':' selected')+'>Persona natural</option><option value="juridica"'+(esJurEdit?' selected':'')+'>Persona jurídica</option></select></div></div>'+
    '<div id="per-form-natural" style="'+(esJurEdit?'display:none':'')+'"><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="per-nombre" placeholder="Nombre completo" value="'+escAttr(!esJurEdit&&editRec?personaDisplayNombre(editRec):'')+'"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="per-ident" placeholder="C.C." value="'+escAttr(!esJurEdit&&editRec?personaDisplayIdentificacion(editRec):'')+'"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="per-correo" value="'+escAttr(!esJurEdit&&editRec?(editRec.pn_correo||editRec.qd_correo||''):'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="per-tel" value="'+escAttr(!esJurEdit&&editRec?(editRec.pn_telefono||editRec.qd_telefono||''):'')+'"></div></div></div>'+
    '<div id="per-form-juridica" style="'+(esJurEdit?'':'display:none')+'"><div class="slbl" style="margin:.4rem 0">Empresa</div><div class="fg">'+
    '<div class="fld"><label>Razón social</label><input type="text" id="per-empresa" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_empresa||''):'')+'"></div>'+
    '<div class="fld"><label>NIT</label><input type="text" id="per-nit" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_nit||''):'')+'"></div>'+
    '<div class="fld"><label>Correo empresa</label><input type="email" id="per-correo-j" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_correo||''):'')+'"></div>'+
    '<div class="fld"><label>Teléfono empresa</label><input type="tel" id="per-tel-j" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_telefono||''):'')+'"></div></div>'+
    '<div class="slbl" style="margin:.5rem 0 .4rem">Representante legal</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="per-rep-nombre" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_rep_nombre||''):'')+'"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="per-rep-ident" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_rep_identificacion||''):'')+'"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="per-rep-correo" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_rep_correo||''):'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="per-rep-tel" value="'+escAttr(esJurEdit&&editRec?(editRec.pj_rep_telefono||''):'')+'"></div></div></div>'+
    '<input type="hidden" id="per-edit-id" value="'+escAttr(editId)+'">'+
    '<div class="fx" style="gap:6px;margin-top:.6rem"><button type="button" class="btn bp" onclick="guardarPersonaManual()">💾 Guardar</button><button type="button" class="btn" onclick="limpiarFormPersonaCfg()">Limpiar</button></div>';
  panel.innerHTML=
    '<div class="card"><div class="cft">Personas y usuarios</div>'+
    '<div class="cfs">Contactos naturales y jurídicos. Se registran al guardar expedientes o manualmente aquí.</div>'+
    (puedeEdit?cfgSectionFold('Registrar / editar persona','',formBody,!!editId):'')+
    cfgSectionFold('Catálogo ('+personas.length+')','','<div id="per-cat-count" style="font-size:12px;color:var(--tx2);margin-bottom:.6rem">'+personas.length+' registros</div>'+
    '<div class="sb" style="margin-bottom:.6rem"><input type="text" id="per-filtro" placeholder="Buscar…" value="'+escAttr(filtro)+'" oninput="renderPersonasTablaOnly()" style="flex:1;min-width:160px"><select id="per-filtro-rol" onchange="renderPersonasTablaOnly()">'+filtroRolOpts+'</select></div>'+
    '<div class="tw"><table><thead><tr><th>Tipo</th><th>Roles</th><th>Nombre / Empresa</th><th>ID / NIT</th><th>Expedientes</th><th>Contacto</th><th></th></tr></thead><tbody id="per-tabla-body"></tbody></table></div>',true)+
    '</div>';
  renderPersonasTablaOnly();
}
function expAsocExiste(num,excludeExp,ownerDepto){
  const v=String(num||'').trim();
  if(!v||expAsocMatchNum(v,excludeExp))return false;
  return !!findExpByNum(v,ownerDepto);
}
function validarExpedientesAsociados(arr,excludeExp,ownerDepto){
  ownerDepto=ownerDepto||getDeptoOperativo();
  return (arr||[]).map(n=>String(n||'').trim()).filter(n=>{
    if(!n)return false;
    if(!expAsocExiste(n,excludeExp))return true;
    const ref=findExpByNumPlain(n);
    if(ref&&expAsocEsRegistroPqrs(ref)&&!expAsocDeptoAceptaPqrsEnLista(ownerDepto))return true;
    return false;
  });
}
function buscarExpedientesAsoc(q,excludeExp,lim){
  const ql=(q||'').trim().toLowerCase();
  if(ql.length<1)return [];
  const ownerDepto=expAsocContextOwnerDepto();
  const seen=new Set();
  const out=[];
  exps.forEach(e=>{
    if(!expAsocElegible(e)||!expAsocPqrsVisibleParaContexto(e,ownerDepto))return;
    const num=(e._exp||'').trim();
    const numLc=num.toLowerCase();
    if(!num||expAsocMatchNum(num,excludeExp)||seen.has(numLc))return;
    const nom=getNom(e).toLowerCase();
    const tram=(getTram(e._tramite,e)?.nombre||(esTramitePqrs(e._tramite)?'PQRSD':'')).toLowerCase();
    const deptoLbl=labelDepto(e._depto||'guaviare').toLowerCase();
    if(numLc.includes(ql)||nom.includes(ql)||tram.includes(ql)||deptoLbl.includes(ql)){
      seen.add(numLc);
      out.push(e);
    }
  });
  return out.slice(0,lim||12);
}
function expAsocEtiquetaSug(e){
  const tram=getTram(e._tramite,e);
  const tramNom=tram?tram.nombre:(esTramitePqrs(e._tramite)?'PQRSD':'Trámite');
  return '<strong>'+escAttr(e._exp)+'</strong> · '+escAttr(tramNom)+' · '+escAttr(labelDepto(e._depto||'guaviare'))+' · '+escAttr(getNom(e));
}
function expAsocRowHtml(num){
  return '<div class="exp-asoc-row">'+
    '<div class="fld"><label>N° expediente asociado</label><div class="exp-asoc-wrap"><input type="text" class="exp-asoc-inp" value="'+escAttr(num||'')+'" placeholder="Buscar expediente existente…" oninput="filtrarExpAsocSug(this)" onfocus="filtrarExpAsocSug(this)" onblur="setTimeout(()=>onExpAsocBlur(this),180)"></div></div>'+
    '<button type="button" class="btn bsm bd2" onclick="delExpAsoc(this)" title="Quitar">✕</button></div>';
}
function expedientesAsociadosHtml(ev){
  const usar=!!(ev._usar_exp_asociados);
  const list=expedientesAsociadosData(ev._expedientes_asociados);
  const rows=list.map(num=>expAsocRowHtml(num)).join('');
  const ownerDepto=ev._depto||getDeptoOperativo();
  const ayuda=expAsocAyudaHtml(ownerDepto);
  return '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-top:.6rem"><input type="checkbox" id="fld__usar_exp_asociados" onchange="toggleExpAsociados()"'+(usar?' checked':'')+' style="width:15px;height:15px;accent-color:var(--bl)"> Tiene expedientes asociados</label>'+
    '<div id="exp-asoc-box" style="margin-top:.5rem;'+(usar?'':'display:none')+'">'+(ayuda?('<div style="font-size:11px;color:var(--tx2);margin-bottom:.4rem">'+ayuda+'</div>'):'')+'<div id="exp-asoc-list">'+rows+'</div><button type="button" class="btn bsm" onclick="addExpAsoc()">+ Añadir expediente asociado</button></div>';
}
function syncExpAsociados(){
  const cur=gv('fld__exp')||'';
  const ownerDepto=expAsocContextOwnerDepto();
  const arr=Array.from(document.querySelectorAll('#exp-asoc-list .exp-asoc-inp')).map(i=>i.value.trim()).filter(v=>v&&expAsocExiste(v,cur,ownerDepto));
  const hid=document.getElementById('fld__expedientes_asociados');if(hid)hid.value=JSON.stringify(arr);
}
function alertExpAsocNoEncontrado(v){
  const sinPqrs=!expAsocUsuarioPuedeVerPqrs();
  confirmPrecaucion({
    title:'Expediente no encontrado',
    message:sinPqrs
      ? 'No existe un expediente registrado con ese número disponible para asociar en su departamento. Las PQRSD solo se asocian desde Guaviare.'
      : 'No existe un expediente registrado con ese número en el sistema, o no es elegible para asociar. Verifique el dato o selecciónelo de la lista de sugerencias.',
    detail:v||'',
    confirmLabel:'Entendido'
  },function(){});
}
function expNumeroDuplicado(expId,opts){
  opts=opts||{};
  const id=String(expId||'').trim();
  if(!id)return null;
  const exclude=String(opts.excludeExp||'').trim();
  const idLc=id.toLowerCase();
  return exps.find(e=>{
    const num=String(e._exp||'').trim();
    if(!num||num.toLowerCase()!==idLc)return false;
    if(exclude&&num.toLowerCase()===exclude.toLowerCase())return false;
    return true;
  })||null;
}
function alertRegistroDuplicado(expId,tipo,existente){
  const esPqrs=tipo==='pqrs';
  let deptoNota='';
  if(existente){
    const d=existente._depto||'guaviare';
    deptoNota=' Está registrado en '+labelDepto(d)+'.';
  }
  confirmPrecaucion({
    title:esPqrs?'PQRSD ya registrada':'Expediente ya registrado',
    message:esPqrs
      ? 'Ya existe una PQRSD con este número en el sistema.'+deptoNota+' Verifique el dato o consulte el registro existente; no se permite radicar de nuevo.'
      : 'Ya existe un trámite con este número en el sistema (Guaviare, Guainía o Vaupés).'+deptoNota+' Verifique el dato o edite el expediente existente; no se permite registrar de nuevo.',
    detail:expId||'',
    confirmLabel:'Entendido',
    tone:'warn'
  },function(){});
}
function addExpAsoc(){
  const c=document.getElementById('exp-asoc-list');if(!c)return;
  const cur=gv('fld__exp')||'';
  const inps=Array.from(c.querySelectorAll('.exp-asoc-inp'));
  for(const inp of inps){
    const v=(inp.value||'').trim();
    if(!v)continue;
    if(!expAsocExiste(v,cur)){
      alertExpAsocNoEncontrado(v);
      inp.value='';
      inp.focus();
      syncExpAsociados();
      return;
    }
  }
  const last=inps[inps.length-1];
  if(last&&!(last.value||'').trim()){
    notif('Indique un expediente asociado válido antes de añadir otro','err');
    last.focus();
    return;
  }
  c.insertAdjacentHTML('beforeend',expAsocRowHtml(''));
}
function delExpAsoc(btn){
  const row=btn.closest('.exp-asoc-row');
  const inp=row?row.querySelector('.exp-asoc-inp'):null;
  const v=(inp&&inp.value||'').trim();
  if(!v){
    if(row)row.remove();
    syncExpAsociados();
    return;
  }
  confirmEliminar({message:'¿Quitar este expediente asociado de la lista?',detail:v},()=>{
    if(row)row.remove();
    syncExpAsociados();
  });
}
function toggleExpAsociados(){
  const b=document.getElementById('exp-asoc-box');
  if(b)b.style.display=document.getElementById('fld__usar_exp_asociados').checked?'':'none';
}
let expAsocSugInput=null;
function positionExpAsocSugPortal(inp){
  const portal=document.getElementById('exp-asoc-sug-portal');if(!portal||!inp)return;
  const r=inp.getBoundingClientRect();
  portal.style.left=Math.max(8,r.left)+'px';
  portal.style.top=(r.bottom+4)+'px';
  portal.style.width=Math.max(r.width,360)+'px';
  portal.style.zIndex=portalZIndexFlotante();
}
function filtrarExpAsocSug(inp){
  if(!inp)return;
  expAsocSugInput=inp;
  const portal=document.getElementById('exp-asoc-sug-portal');
  if(!portal)return;
  const cur=gv('fld__exp')||'';
  const list=buscarExpedientesAsoc(inp.value.trim(),cur,12);
  window._expAsocSugList=list;
  portal.innerHTML=list.map((e,i)=>'<button type="button" onmousedown="pickExpAsocSug('+i+')">'+escAttr(expAsocEtiquetaSug(e))+'</button>').join('');
  if(list.length){positionExpAsocSugPortal(inp);portal.style.display='block';}else portal.style.display='none';
}
function hideExpAsocSug(){
  const portal=document.getElementById('exp-asoc-sug-portal');
  if(portal)portal.style.display='none';
  expAsocSugInput=null;
}
function pickExpAsocSug(idx){
  const e=(window._expAsocSugList||[])[idx];if(!e||!expAsocSugInput)return;
  expAsocSugInput.value=e._exp;
  hideExpAsocSug();
  syncExpAsociados();
}
function onExpAsocBlur(inp){
  hideExpAsocSug();
  const v=(inp.value||'').trim();
  if(!v){syncExpAsociados();return;}
  const cur=gv('fld__exp')||'';
  if(!expAsocExiste(v,cur)){
    inp.value='';
    syncExpAsociados();
    alertExpAsocNoEncontrado(v);
    return;
  }
  syncExpAsociados();
}
function hl(txt,q){
  if(!txt)return'';
  const safe=escAttr(txt);
  if(!q)return safe;
  const rx=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
  return safe.replace(rx,'<mark class="hl">$1</mark>');
}
function getListaOpts(fuente){return cfg[fuente]||[];}
function coordData(v){try{return v?JSON.parse(v):{tipo:'punto',pts:[{}]};}catch(e){return{tipo:'punto',pts:[{}]};}}
function coordDmsInputs(id,pi,axis,d){
  return '<div class="coord-dms">'+
    '<input type="number" step="any" placeholder="°" title="Grados" value="'+(d[axis+'G']||'')+'" data-p="'+pi+'" data-k="'+axis+'G" oninput="coordSync(\''+id+'\')">'+
    '<input type="number" step="any" placeholder="′" title="Minutos" value="'+(d[axis+'M']||'')+'" data-p="'+pi+'" data-k="'+axis+'M" oninput="coordSync(\''+id+'\')">'+
    '<input type="number" step="any" placeholder="″" title="Segundos" value="'+(d[axis+'S']||'')+'" data-p="'+pi+'" data-k="'+axis+'S" oninput="coordSync(\''+id+'\')">'+
  '</div>';
}
function coordPointHtml(id,pi,label,d,showPtLbl){
  return '<div class="coord-point" data-row="'+pi+'">'+
    (showPtLbl?'<div class="coord-pt-lbl">'+label+'</div>':'')+
    '<div class="coord-axis"><span class="coord-axis-lbl">Latitud</span>'+coordDmsInputs(id,pi,'lat',d)+'</div>'+
    '<div class="coord-axis"><span class="coord-axis-lbl">Longitud</span>'+coordDmsInputs(id,pi,'lon',d)+'</div>'+
  '</div>';
}
function coordHtml(id,v){
  const data=coordData(v),tipo=data.tipo||'punto',pts=data.pts&&data.pts.length?data.pts:[{}],n=tipo==='area'?4:1;
  let html='<input type="hidden" id="'+id+'" value=\''+(v||'')+'\'><div class="coord-box" data-coord="'+id+'">'+
    '<select onchange="coordToggle(\''+id+'\',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 6px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx)">'+
    '<option value="punto"'+(tipo==='punto'?' selected':'')+'>Coordenada punto</option><option value="area"'+(tipo==='area'?' selected':'')+'>Área (4 coordenadas)</option></select>'+
    '<div class="coord-pts">';
  for(let i=0;i<n;i++)html+=coordPointHtml(id,i,tipo==='area'?'Punto '+(i+1):'Punto',pts[i]||{},tipo==='area');
  return html+'</div></div>';
}
function coordHiddenInput(id){
  const el=document.getElementById(id);
  if(el)return el;
  const box=document.querySelector('[data-coord="'+id+'"]');
  if(box&&box.previousElementSibling&&box.previousElementSibling.classList.contains('it-valor'))return box.previousElementSibling;
  return null;
}
function coordToggle(id,tipo){
  const box=document.querySelector('[data-coord="'+id+'"]'),pts=box.querySelector('.coord-pts'),data=coordData(document.getElementById(id).value);
  pts.innerHTML='';const n=tipo==='area'?4:1;
  for(let i=0;i<n;i++)pts.insertAdjacentHTML('beforeend',coordPointHtml(id,i,tipo==='area'?'Punto '+(i+1):'Punto',(data.pts||[])[i]||{},tipo==='area'));
  coordSync(id,tipo);
}
function coordSync(id,tipo,skipParentSync){
  const box=document.querySelector('[data-coord="'+id+'"]');
  if(!box)return;
  const sel=box.querySelector('select');
  const data={tipo:tipo||(sel?sel.value:'punto'),pts:[]};
  box.querySelectorAll('.coord-point').forEach((r,i)=>{
    data.pts[i]={};
    r.querySelectorAll('input').forEach(inp=>{data.pts[i][inp.dataset.k]=inp.value;});
  });
  const has=data.pts.some(p=>Object.values(p).some(v=>v!==''));
  const hid=coordHiddenInput(id);
  if(hid)hid.value=has?JSON.stringify(data):'';
  if(!skipParentSync)syncInfoTecnicaExp();
}
function fmtCoord(v){
  const d=coordData(v);if(!v)return'';
  const fmt=p=>'Lat '+(p.latG||'0')+'° '+(p.latM||'0')+'′ '+(p.latS||'0')+'″ / Long '+(p.lonG||'0')+'° '+(p.lonM||'0')+'′ '+(p.lonS||'0')+'″';
  return (d.tipo==='area'?'Área: ':'Punto: ')+(d.pts||[]).map((p,i)=>(d.tipo==='area'?'P'+(i+1)+' ':'')+fmt(p)).join(' | ');
}
function fmtCampoVal(v,c){return c&&c.tipo==='coordenadas'?fmtCoord(v):String(v||'');}
function esSecSolicitante(sec){return String(sec||'').trim().toLowerCase()==='datos del solicitante';}
function esSecDetalleProceso(sec){
  const s=String(sec||'').trim().toLowerCase();
  return s==='detalle del proceso'||s==='detalles del proceso';
}
function esSecInfoTecnica(sec){return String(sec||'').trim().toLowerCase()==='información técnica'||String(sec||'').trim().toLowerCase()==='informacion tecnica';}
function getInfoTecCatalog(deptoOrExp){return cfgFor(deptoOrExp).infoTecnica||[];}
function getInfoTecDef(campoId,deptoOrExp){return getInfoTecCatalog(deptoOrExp).find(c=>c.id===campoId);}
function infoTecnicaExpData(v){try{return v?JSON.parse(v):[];}catch(e){return[];}}
function migrarInfoTecExpediente(e){
  if(e._info_tecnica_items)return;
  const items=[];const seen=new Set();
  getInfoTecCatalog(e).forEach(c=>{const v=e['g_'+c.id];if(v!==undefined&&v!==''&&v!==false&&!seen.has(c.id)){seen.add(c.id);items.push({campoId:c.id,valor:v});}});
  Object.keys(e).forEach(k=>{
    if(!k.startsWith('g_'))return;
    const id=k.slice(2);
    if(seen.has(id))return;
    const v=e[k];
    if(v!==undefined&&v!==''&&v!==false){seen.add(id);items.push({campoId:id,valor:v});}
  });
  if(items.length)e._info_tecnica_items=JSON.stringify(items);
}
function infoTecValorInputHtml(def,val,idx){
  if(!def)return'<input type="text" class="it-valor" data-idx="'+idx+'" value="'+escAttr(val||'')+'" oninput="syncInfoTecnicaExp()">';
  if(def.tipo==='checkbox'){
    return'<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="it-valor" data-idx="'+idx+'"'+(val?' checked':'')+' onchange="syncInfoTecnicaExp()"> '+(def.placeholder||def.label)+'</label>';
  }
  const elId='itv_'+idx;
  const opc=def.tipo==='lista'?getListaOpts(def.listaFuente||[]):def.opciones;
  if(def.tipo==='coordenadas')return TIPOS[def.tipo].r(elId,def.placeholder||def.label,val).replace('id="'+elId+'"','id="'+elId+'" class="it-valor" data-idx="'+idx+'"');
  if(TIPOS[def.tipo])return TIPOS[def.tipo].r(elId,def.placeholder||def.label,val,opc).replace('id="'+elId+'"','id="'+elId+'" class="it-valor" data-idx="'+idx+'" oninput="syncInfoTecnicaExp()" onchange="syncInfoTecnicaExp()"');
  return'<input type="text" class="it-valor" data-idx="'+idx+'" value="'+escAttr(val||'')+'" oninput="syncInfoTecnicaExp()">';
}
function infoTecValorResumen(valor,def){
  if(valor==null||valor===''||valor===false)return '';
  if(def&&def.tipo==='coordenadas')return fmtCoord(valor);
  if(def&&(def.tipo==='boolean'||def.tipo==='logico'))return valor?'Sí':'No';
  const s=String(valor);
  return s.length>48?s.substring(0,48)+'…':s;
}
function infoTecRowSummaryText(def,valor){
  const tit=def?def.label:'Nuevo dato técnico';
  const vr=infoTecValorResumen(valor,def);
  return tit+(vr?' · '+vr:'');
}
function infoTecnicaExpRowHtml(item,i,depto){
  const catalog=getInfoTecCatalog(depto);
  const sel=item.campoId||'';
  const def=getInfoTecDef(sel,depto);
  const opts='<option value="">— Seleccione campo —</option>'+catalog.map(c=>'<option value="'+c.id+'"'+(sel===c.id?' selected':'')+'>'+c.label+'</option>').join('');
  return '<details class="item-fold it-exp-row">'+
    foldSummary(infoTecRowSummaryText(def,item.valor))+
    '<div class="item-fold-body"><div class="fg">'+
    '<div class="fld"><label>Campo técnico</label><select class="it-campo" data-idx="'+i+'" onchange="onInfoTecCampoChange('+i+')">'+opts+'</select></div>'+
    '<div class="fld it-valor-wrap"><label>Valor</label>'+infoTecValorInputHtml(def,item.valor,i)+'</div>'+
    '</div><div class="ar"><button type="button" class="btn bsm bd2" onclick="delInfoTecnicaExp(this)">Eliminar</button></div></div></details>';
}
function infoTecnicaExpHtml(ev){
  const depto=getDeptoOperativo();
  const items=infoTecnicaExpData(ev._info_tecnica_items);
  return '<details class="form-section"><summary class="form-section-hdr">Información técnica</summary><div class="form-section-body">'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:.6rem">Seleccione campos definidos en Configuración → Información técnica y registre su valor para este expediente.</div>'+
    '<input type="hidden" id="fld__info_tecnica_items" value=\''+escAttr(ev._info_tecnica_items||'[]')+'\'>'+
    '<div id="info-tecnica-exp-list">'+items.map((it,i)=>infoTecnicaExpRowHtml(it,i,depto)).join('')+'</div>'+
    '<button type="button" class="btn bsm" onclick="addInfoTecnicaExp()">+ Añadir información técnica</button>'+
    btnGuardarSeccion()+'</div></details>';
}
let _syncingInfoTec=false;
function syncInfoTecnicaExp(){
  if(_syncingInfoTec)return;
  _syncingInfoTec=true;
  try{
  document.querySelectorAll('#info-tecnica-exp-list [data-coord]').forEach(box=>coordSync(box.dataset.coord,null,true));
  const arr=Array.from(document.querySelectorAll('#info-tecnica-exp-list .it-exp-row')).map((row,i)=>{
    const campoId=row.querySelector('.it-campo')?row.querySelector('.it-campo').value:'';
    const vel=row.querySelector('.it-valor');
    let valor='';
    if(vel){
      if(vel.type==='checkbox')valor=vel.checked;
      else valor=vel.value;
      if(typeof valor==='string')valor=valor.trim();
    }
    return {campoId,valor};
  }).filter(x=>x.campoId);
  const hid=document.getElementById('fld__info_tecnica_items');if(hid)hid.value=JSON.stringify(arr);
  Array.from(document.querySelectorAll('#info-tecnica-exp-list .it-exp-row')).forEach(row=>{
    const campoId=row.querySelector('.it-campo')?row.querySelector('.it-campo').value:'';
    const def=getInfoTecDef(campoId,getDeptoOperativo());
    const vel=row.querySelector('.it-valor');
    let valor='';
    if(vel){
      if(vel.type==='checkbox')valor=vel.checked;
      else valor=vel.value;
    }
    const sum=row.querySelector('summary');
    if(sum)sum.textContent=infoTecRowSummaryText(def,valor);
  });
  }finally{_syncingInfoTec=false;}
}
function onInfoTecCampoChange(idx){
  const row=document.querySelectorAll('#info-tecnica-exp-list .it-exp-row')[idx];if(!row)return;
  const campoId=row.querySelector('.it-campo').value;
  const def=getInfoTecDef(campoId,getDeptoOperativo());
  const wrap=row.querySelector('.it-valor-wrap');if(wrap){
    const lbl=wrap.querySelector('label');
    wrap.innerHTML=(lbl?lbl.outerHTML:'<label>Valor</label>')+infoTecValorInputHtml(def,'',idx);
  }
  syncInfoTecnicaExp();
  const sum=row.querySelector('summary');if(sum)sum.textContent=infoTecRowSummaryText(def,'');
}
function addInfoTecnicaExp(){
  const catalog=getInfoTecCatalog(getDeptoOperativo());
  if(!catalog.length){notif('Cree campos en Configuración → Información técnica','err');return;}
  const c=document.getElementById('info-tecnica-exp-list');
  const item={campoId:'',valor:''};
  c.insertAdjacentHTML('beforeend',infoTecnicaExpRowHtml(item,c.children.length,getDeptoOperativo()));
  syncInfoTecnicaExp();
}
function delInfoTecnicaExp(btn){
  confirmEliminar({message:'¿Eliminar este dato de información técnica?'},()=>{
    btn.closest('.it-exp-row').remove();syncInfoTecnicaExp();
  });
}
function collectInfoTecnicaExp(){syncInfoTecnicaExp();return{_info_tecnica_items:gv('fld__info_tecnica_items')||'[]'};}
function renderInfoTecExpView(e){
  const items=infoTecnicaExpData(e._info_tecnica_items);
  if(!items.length)return'';
  return items.map(it=>{
    const def=getInfoTecDef(it.campoId,e);
    const lbl=def?def.label:it.campoId;
    const v=fmtCampoVal(it.valor,def||{tipo:'texto'});
    return '<div class="ic"><div class="k">'+lbl+'</div><div class="v">'+v+'</div></div>';
  }).join('');
}
function validarInfoTecnicaExp(deptoOrExp){
  syncInfoTecnicaExp();
  const items=infoTecnicaExpData(gv('fld__info_tecnica_items'));
  for(const it of items){
    const def=getInfoTecDef(it.campoId,deptoOrExp);
    if(def&&def.requerido&&!String(it.valor||'').trim()){notif('Campo requerido: '+def.label,'err');return false;}
  }
  return true;
}
function matchActividadFiltro(e,qact){
  if(!qact)return true;
  const tasks=e.tasks||[];
  if(!tasks.length)return false;
  if(qact==='ejec')return tasks.some(t=>!t.eliminada&&estadoTask(t)==='En ejecución');
  if(qact==='ate')return tasks.some(t=>!t.eliminada&&estadoTask(t)==='Atendida');
  if(qact==='venc')return tasks.some(t=>!t.eliminada&&estadoTask(t)==='Vencida');
  if(qact==='porver')return tasks.some(t=>!t.eliminada&&estadoTask(t)==='Por verificar');
  if(qact==='porcorr')return tasks.some(t=>!t.eliminada&&estadoTask(t)==='Por corregir');
  return true;
}
function depOpts(v){return '<option value="">-- Departamento --</option>'+Object.keys(MUN_DEP).map(d=>'<option value="'+d+'"'+(v===d?' selected':'')+'>'+d+'</option>').join('');}
function munOpts(dep,v){return '<option value="">-- Municipio --</option>'+((MUN_DEP[dep]||[]).map(m=>'<option value="'+m+'"'+(v===m?' selected':'')+'>'+m+'</option>').join(''));}
function dirHtml(prefix,ev){
  const depFijo=nombreDeptoOperativo();
  const dep=esJurisdiccional()?(ev['_'+prefix+'_dep']||depFijo):depFijo;
  const mun=ev['_'+prefix+'_mun']||'';
  const depFld=esJurisdiccional()
    ?'<div class="fld"><label>Departamento</label><select id="fld__'+prefix+'_dep" onchange="updMun(\''+prefix+'\')">'+depOpts(dep)+'</select></div>'
    :'<input type="hidden" id="fld__'+prefix+'_dep" value="'+escAttr(depFijo)+'">';
  return depFld+
    '<div class="fld"><label>Municipio</label><select id="fld__'+prefix+'_mun">'+munOpts(dep,mun)+'</select></div>'+
    '<div class="fld"><label>Vereda</label><input type="text" id="fld__'+prefix+'_vereda" value="'+(ev['_'+prefix+'_vereda']||'')+'"></div>'+
    '<div class="fld"><label>Nombre del predio</label><input type="text" id="fld__'+prefix+'_predio" value="'+(ev['_'+prefix+'_predio']||'')+'"></div>'+
    '<div class="fld"><label>Barrio</label><input type="text" id="fld__'+prefix+'_barrio" value="'+(ev['_'+prefix+'_barrio']||'')+'"></div>'+
    '<div class="fld"><label>Dirección</label><input type="text" id="fld__'+prefix+'_direccion" value="'+(ev['_'+prefix+'_direccion']||'')+'"></div>';
}
function getDir(prefix){
  const o={};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>o['_'+prefix+'_'+k]=gv('fld__'+prefix+'_'+k));
  return o;
}
function limpiarDirData(data,prefix){
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(k=>data['_'+prefix+'_'+k]='');
}
function getInfoTecCampos(tid,deptoOrExp){return (cfgFor(deptoOrExp).infoTecnica||[]).filter(c=>(c.tramites||[]).includes(tid));}

// ---- TÉRMINOS ----
function calcTerminos(e){
  const t=getTram(e._tramite,e);
  const fechaIni=getFechaEstado(e,'Solicitud')||e._fecha;
  if(!t||!fechaIni)return null;
  const d=dias(fechaIni);
  const plazo=Number(t.plazo)||60;
  const alerta=Number(t.alerta)||80;
  const pct=Math.round((d/plazo)*100);
  const isFin=FINALS.includes(e._etapa)||e._estado==='Atendido'||isArchivadoEstado(e._estado)||e._estado==='Seguimiento';
  let estado='ok';
  if(isFin){
    estado=d<=plazo?'done-ok':'done-venc';
  } else {
    if(d>plazo)estado='venc';
    else if(pct>=alerta)estado='warn';
    else estado='ok';
  }
  return {d,plazo,pct:Math.min(pct,100),estado,isFin,unidad:t.unidad||'dias'};
}
function termsBdg(ter){
  if(!ter)return'';
  const MAP={
    'ok':'<span class="bdg t-ok">✅ En términos</span>',
    'warn':'<span class="bdg t-warn">⏰ Próximo a vencer</span>',
    'venc':'<span class="bdg t-venc">🔴 Vencido</span>',
    'done-ok':'<span class="bdg t-done-ok">✅ Atendido en términos</span>',
    'done-venc':'<span class="bdg t-done-venc">❌ Atendido vencido</span>',
  };
  return MAP[ter.estado]||'';
}
function termsBar(ter){
  if(!ter)return'';
  const col=ter.estado==='ok'?'var(--gn)':ter.estado==='warn'?'var(--am)':'var(--rd)';
  return '<div class="terms-bar"><div class="terms-fill" style="width:'+ter.pct+'%;background:'+col+'"></div></div>'+
    '<div style="font-size:10px;color:var(--tx2);margin-top:2px">'+ter.d+' / '+ter.plazo+' '+( UNIDAD_LABEL[ter.unidad]||'días')+'</div>';
}

// ===========================================================================
// SPRINT 5 — NCA Revisión de respuesta de responsable
// ===========================================================================
function htmlNcaRevisionBadge(e){
  const f=pqrsWorkflowFase(e);
  if(f===PQRS_WF.PENDIENTE_REVISION)return'<span class="bdg" style="background:#6d3fa822;color:#6d3fa8;border:1px solid #6d3fa8">⏳ Pendiente revisión NCA</span>';
  if(f===PQRS_WF.LISTA_ENVIO)return'<span class="bdg" style="background:var(--gnl);color:var(--gn)">✅ Aprobada — lista para envío</span>';
  if(f===PQRS_WF.VITAL_GESTION)return'<span class="bdg" style="background:#1a7a4a22;color:#1a7a4a">📄 Oficio enviado a VITAL</span>';
  if(f===PQRS_WF.PENDIENTE_NOTIF)return'<span class="bdg" style="background:#185fa522;color:var(--bl)">📬 Lista para notificación</span>';
  if(f===PQRS_WF.RECHAZADA)return'<span class="bdg" style="background:var(--rdl);color:var(--rd)">↩ Devuelta al responsable</span>';
  return'';
}

function openNcaRevisionModal(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  // Only NCA encargado can review
  if(!esNcaDeguv()&&!esOficinaPqrsNca()&&!esAdministrador()){notif('Solo el encargado NCA puede revisar respuestas','err');return;}
  if(pqrsWorkflowFase(e)!==PQRS_WF.PENDIENTE_REVISION){notif('Esta PQRSD no está en fase de revisión','err');return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Revisión NCA — '+expId;
  if(modal){modal.classList.add('task-modal-wide');}
  const wf=getPqrsWorkflow(e);
  const docs=wf.documentos||[];
  const docsHtml=docs.length
    ?docs.map(d=>'<div style="font-size:11px;margin-top:4px">'+
        (d.driveLink?'<a href="'+escAttr(d.driveLink)+'" target="_blank" style="color:var(--bl)">📎 '+escAttr(d.nombre||d.driveLink)+'</a>':'📎 '+escAttr(d.nombre||'—'))+
        '</div>').join('')
    :'<div style="font-size:11px;color:var(--tx3)">Sin documentos adjuntos</div>';

  body.innerHTML=
    '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem">📋 Revisión de respuesta — '+escAttr(expId)+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:12px">Revise la respuesta elaborada por <strong>'+escAttr(wf.entregado_por||'responsable')+'</strong>. Puede aprobarla (simple o con oficio) o devolverla para corrección.</div>'+

    '<div style="padding:10px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd);margin-bottom:10px">'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:4px">Tipo propuesto</div>'+
    '<div style="font-size:12px">'+escAttr(wf.tipo===PQRS_WF_TIPO.OFICIO?'📄 Oficio firmado':wf.tipo===PQRS_WF_TIPO.INFORMATIVA?'ℹ️ Informativa':'✉️ Mensaje simple')+'</div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-top:8px;margin-bottom:4px">Canal propuesto</div>'+
    '<div style="font-size:12px">'+escAttr(wf.canal||'—')+'</div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-top:8px;margin-bottom:4px">Resumen de la respuesta</div>'+
    '<div style="font-size:12px;white-space:pre-wrap">'+escAttr(wf.cuerpo||'—')+'</div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-top:8px;margin-bottom:4px">Documentos adjuntos</div>'+
    docsHtml+
    '</div>'+

    // Correcciones NCA (opcionales)
    '<div class="fld" style="margin-bottom:10px"><label>Correcciones al texto <span style="font-weight:400;color:var(--tx3)">(opcional — editará el cuerpo)</span></label>'+
    '<textarea id="nca-rev-cuerpo" style="min-height:80px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px">'+escAttr(wf.cuerpo||'')+'</textarea></div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>N° de oficio confirmado</label><input type="text" id="nca-rev-oficio" value="'+escAttr(wf.oficio||'')+'"></div>'+
    '<div class="fld"><label>Fecha de respuesta</label><input type="date" id="nca-rev-fecha" value="'+escAttr(wf.fecha_respuesta||hoy())+'"></div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Comentario de la revisión <span style="font-weight:400;color:var(--tx3)">(se envía al responsable)</span></label>'+
    '<input type="text" id="nca-rev-comentario" placeholder="Ej: Aprobado. Envíelo al ciudadano." style="margin-top:4px"></div>'+

    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">Decisión:</div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm" style="background:var(--gn);color:#fff" onclick="ncaAprobarMensajeSimple(\''+escAttr(expId)+'\')">✅ Aprobar — Mensaje simple</button>'+
    '<button type="button" class="btn bsm" style="background:#1a7a4a;color:#fff" onclick="ncaAprobarOficioFirmado(\''+escAttr(expId)+'\')">📄 Aprobar — Requiere oficio firmado (VITAL)</button>'+
    '<button type="button" class="btn bsm bd2" onclick="ncaRechazarRespuesta(\''+escAttr(expId)+'\')">↩ Devolver al responsable</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';

  ov.classList.add('on');
  window._taskModalCtx={mode:'ncaRevision',expId};
}

function _ncaRevisionDatos(){
  return{
    cuerpo:String((document.getElementById('nca-rev-cuerpo')||{}).value||'').trim(),
    oficio:String((document.getElementById('nca-rev-oficio')||{}).value||'').trim(),
    fecha:String((document.getElementById('nca-rev-fecha')||{}).value||hoy()).trim(),
    comentario:String((document.getElementById('nca-rev-comentario')||{}).value||'').trim()
  };
}

function ncaAprobarMensajeSimple(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const d=_ncaRevisionDatos();
  const wf=getPqrsWorkflow(e);
  setPqrsWorkflow(e,{
    fase:PQRS_WF.LISTA_ENVIO,
    cuerpo:d.cuerpo||wf.cuerpo,
    oficio:d.oficio||wf.oficio,
    fecha_respuesta:d.fecha||wf.fecha_respuesta,
    revision_nca:{aprobado:true,tipo:'mensaje',comentario:d.comentario,por:responsableActivo||'NCA',en:new Date().toISOString()}
  });
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'revision_nca_aprobado',fecha:hoy(),nota:'NCA aprobó respuesta (mensaje simple)'+(d.comentario?' — '+d.comentario:''),oficina:'guaviare',por:responsableActivo||'NCA'});
  persistExpedienteGranular(e);
  closeTaskModal();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
  notif('✅ Respuesta aprobada — lista para envío al ciudadano','ok');
}

function ncaAprobarOficioFirmado(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const d=_ncaRevisionDatos();
  const wf=getPqrsWorkflow(e);
  setPqrsWorkflow(e,{
    fase:PQRS_WF.VITAL_GESTION,
    cuerpo:d.cuerpo||wf.cuerpo,
    oficio:d.oficio||wf.oficio,
    fecha_respuesta:d.fecha||wf.fecha_respuesta,
    revision_nca:{aprobado:true,tipo:'oficio',comentario:d.comentario,por:responsableActivo||'NCA',en:new Date().toISOString()}
  });
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'revision_nca_aprobado_oficio',fecha:hoy(),nota:'NCA aprobó — requiere oficio firmado (gestionado por VITAL)'+(d.comentario?' — '+d.comentario:''),oficina:'guaviare',por:responsableActivo||'NCA'});
  persistExpedienteGranular(e);
  closeTaskModal();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
  notif('📄 Respuesta con oficio — VITAL gestionará la firma del Director','ok');
}

function ncaRechazarRespuesta(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const d=_ncaRevisionDatos();
  if(!d.comentario){notif('Indique el motivo de la devolución','err');return;}
  const wf=getPqrsWorkflow(e);
  setPqrsWorkflow(e,{
    fase:PQRS_WF.RECHAZADA,
    revision_nca:{aprobado:false,comentario:d.comentario,por:responsableActivo||'NCA',en:new Date().toISOString()}
  });
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'revision_nca_rechazado',fecha:hoy(),nota:'NCA devolvió la respuesta: '+d.comentario,oficina:'guaviare',por:responsableActivo||'NCA'});
  persistExpedienteGranular(e);
  closeTaskModal();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
  notif('↩ Respuesta devuelta al responsable','ok');
}

// ===========================================================================
// SPRINT 6 — VITAL: gestión de firma Director + upload PDF firmado
// ===========================================================================
function openVitalBandejaModal(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  if(!esCargoVital()&&!esAdministrador()){notif('Solo VITAL puede gestionar la firma del Director','err');return;}
  if(pqrsWorkflowFase(e)!==PQRS_WF.VITAL_GESTION){notif('Esta PQRSD no requiere gestión VITAL en este momento','err');return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Gestión VITAL — firma Director — '+expId;
  if(modal)modal.classList.add('task-modal-wide');
  const wf=getPqrsWorkflow(e);
  const usaDriveInst=typeof DRIVE_INST_DEPTOS!=='undefined'&&DRIVE_INST_DEPTOS.has('guaviare');
  const hayToken=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()||typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid();

  body.innerHTML=
    '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem">📄 Gestión VITAL — '+escAttr(expId)+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Obtenga la firma del Director sobre el oficio de respuesta y suba el PDF firmado aquí.</div>'+

    '<div style="padding:10px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px">'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:4px">Resumen aprobado por NCA</div>'+
    '<div style="font-size:12px;white-space:pre-wrap;margin-bottom:6px">'+escAttr(wf.cuerpo||'—')+'</div>'+
    '<div style="font-size:11px;color:var(--tx2)">Oficio: <strong>'+escAttr(wf.oficio||'—')+'</strong> · Canal: '+escAttr(wf.canal||'—')+'</div>'+
    '</div>'+

    '<div style="font-size:12px;font-weight:600;margin-bottom:6px">1. Suba el PDF con firma del Director</div>'+
    (usaDriveInst&&hayToken
      ?'<div class="fx" style="gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
        '<input type="file" id="vital-pdf-file" accept=".pdf,application/pdf" style="font-size:12px">'+
        '<button type="button" class="btn bsm bp" onclick="vitalSubirPdfFirmado(\''+escAttr(expId)+'\')">⬆ Subir al Drive institucional</button>'+
        '</div>'+
        '<div id="vital-upload-status" style="font-size:11px;margin-bottom:8px"></div>'
      :'<div class="fld" style="margin-bottom:8px"><label>Link del PDF firmado en Drive <span style="font-weight:400;color:var(--tx3)">(pegue el link compartido)</span></label>'+
        '<input type="url" id="vital-pdf-link" placeholder="https://drive.google.com/…" style="margin-top:4px"><div style="font-size:11px;color:var(--tx2);margin-top:3px">'+(hayToken?'':'⚠️ Conecte correo para subir archivos automáticamente.')+'</div></div>')+

    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;margin-top:8px">2. ¿Cómo se notificará al ciudadano?</div>'+
    '<div class="fx" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">'+
    '<button type="button" class="btn bsm canal-resp-btn" data-val="correo" onclick="setPqrsRespCanal(\'correo\')">📧 Correo</button>'+
    '<button type="button" class="btn bsm canal-resp-btn" data-val="presencial" onclick="setPqrsRespCanal(\'presencial\')">🤝 Presencial/Ventanilla</button>'+
    '<button type="button" class="btn bsm canal-resp-btn" data-val="fisica" onclick="setPqrsRespCanal(\'fisica\')">✉️ Correo físico</button>'+
    '</div><input type="hidden" id="pqrs-resp-canal" value="'+escAttr(wf.canal||'')+'">'+

    '<div class="fld" style="margin-bottom:12px"><label>Correo del ciudadano</label>'+
    '<input type="email" id="vital-email-ciu" value="'+escAttr((e._qd_correo||e._pn_correo||'').trim())+'"></div>'+

    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" id="vital-finalizar-btn" onclick="vitalFinalizarGestion(\''+escAttr(expId)+'\')">✅ Finalizar y notificar ciudadano</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';

  setPqrsRespCanal(wf.canal||'');
  ov.classList.add('on');
  window._taskModalCtx={mode:'vitalBandeja',expId};
}

async function vitalSubirPdfFirmado(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e)return;
  const fileInput=document.getElementById('vital-pdf-file');
  const statusEl=document.getElementById('vital-upload-status');
  const file=fileInput&&fileInput.files&&fileInput.files[0];
  if(!file){notif('Seleccione el PDF firmado','err');return;}
  if(statusEl)statusEl.textContent='⬆ Subiendo…';
  try{
    const nombreCarpeta=(e._qd_nombre||e._nombre||e._pn_nombre||expId);
    const res=await driveUploadInstitutional(file,file.name,'application/pdf','respuesta_aprobada',expId,nombreCarpeta,e._fecha||e._fecha_solicitud||'',{expediente:e,uploadTarget:'respuesta'});
    if(statusEl)statusEl.textContent='✅ PDF subido: '+file.name;
    // Store the link in session for finalize
    window._vitalPdfLink=res.driveLink;
    window._vitalPdfFileId=res.fileId;
    notif('PDF firmado subido correctamente','ok');
  }catch(err){
    if(statusEl)statusEl.textContent='❌ Error: '+String(err.message||err).slice(0,60);
    notif('Error al subir PDF: '+String(err.message||err).slice(0,80),'err');
  }
}

async function vitalFinalizarGestion(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const canal=String((document.getElementById('pqrs-resp-canal')||{}).value||'').trim();
  const ciudEmailInput=String((document.getElementById('vital-email-ciu')||{}).value||'').trim().toLowerCase();
  const pdfLink=window._vitalPdfLink||String((document.getElementById('vital-pdf-link')||{}).value||'').trim();
  if(!pdfLink){notif('Suba el PDF firmado o pegue el link Drive','err');return;}
  const btn=document.getElementById('vital-finalizar-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  const wf=getPqrsWorkflow(e);
  // Construir docs: el oficio firmado es el soporte principal
  const pdfFileId=window._vitalPdfFileId||'';
  const oficioDocs=(wf.documentos||[]).filter(d=>d.tipo!=='oficio_firmado').concat([{
    nombre:'Oficio firmado Director',driveLink:pdfLink,previewLink:pdfLink,fileId:pdfFileId,tipo:'oficio_firmado'
  }]);
  const fechaResp=wf.fecha_respuesta||hoy();
  const cerradoPor=responsableActivo||'VITAL';

  // Intentar cierre directo (sin pasar por NCA) si canal=correo y hay correos disponibles
  const todosCorreos=pqrsCorreosCiudadano(e);
  const correoDestino=todosCorreos.length?todosCorreos:(ciudEmailInput?[ciudEmailInput]:[]);
  const tokSec=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid();
  const tokOfi=typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid();
  const puedeEnviarCorreo=canal===PQRS_WF_CANAL.CORREO&&correoDestino.length&&(tokSec||tokOfi);

  // Registrar gestion_vital en workflow
  setPqrsWorkflow(e,{
    canal,
    documentos:oficioDocs,
    gestion_vital:{completado:true,pdfLink,canal,por:cerradoPor,en:new Date().toISOString()}
  });
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'vital_firma_completada',fecha:hoy(),nota:'VITAL subió oficio firmado por Director · Link: '+pdfLink,oficina:'guaviare',por:cerradoPor});

  if(puedeEnviarCorreo){
    // Generar soporte PDF de respuesta
    if(btn)btn.textContent='Generando soporte…';
    const soporteRes=await _pqrsSubirSoporteRespuesta(e,{fechaResp,documentos:oficioDocs,cerradoPor});
    const docsFinales=soporteRes&&soporteRes.driveLink
      ?oficioDocs.concat([{nombre:'Soporte de respuesta',driveLink:soporteRes.driveLink,previewLink:soporteRes.previewLink||'',fileId:soporteRes.fileId||'',tipo:'soporte_respuesta'}])
      :oficioDocs;
    // Cerrar directamente sin pasar por NCA
    setPqrsWorkflow(e,{
      fase:PQRS_WF.CERRADA,
      fecha_respuesta:fechaResp,
      documentos:docsFinales,
      cerrado_por:cerradoPor,
      cerrado_en:new Date().toISOString()
    });
    e._pqrs_estado_oficina='cerrado';
    e._estado='Atendido';
    e._fecha_res=fechaResp;
    const fe=getFechasEstado(e);
    fe.Atendido=fechaResp;
    if(!fe['En trámite'])fe['En trámite']=fe.Solicitud||e._fecha||fechaResp;
    e._fechas_estado=JSON.stringify(fe);
    e.historial=rebuildHistorial(e,e.historial||[]);
    persistExpedienteGranular(e);
    window._vitalPdfLink=null;window._vitalPdfFileId=null;
    closeTaskModal();renderPqrsOficinaInbox();renderSecretariaPqrs();
    notif('✅ Oficio firmado — PQRSD cerrada. Enviando correo al ciudadano…','ok');
    // Enviar correo con oficio firmado como link + soporte
    const asunto='Respuesta a su solicitud '+(e._tipo_solicitud||'PQRSD')+' — '+(expId);
    const htmlResp=pqrsCorreoHtmlRespuesta(e,wf.cuerpo||e._pqrs_respuesta_nota||'',docsFinales);
    try{
      const sent=await pqrsEnviarCorreoCiudadano(correoDestino,asunto,htmlResp,true);
      registrarNotificacionCiudadanoPqrs(e,{
        tipo:'respuesta',medio:'correo',enviado:true,
        a:correoDestino.join(', '),cuenta_emisora:sent.cuenta,gmail_message_id:sent.messageId,
        por:cerradoPor,histTipo:'notificacion_correo',
        histNota:'Correo de respuesta (VITAL) enviado a '+correoDestino.join(', ')
      });
      persistExpedienteGranular(e,false);
      notif('📧 Correo enviado a '+correoDestino.join(', '),'ok');
    }catch(err){
      notif('PQRSD cerrada pero no se pudo enviar correo: '+String(err.message||err).slice(0,80),'warn');
    }
  }else{
    // Sin token/correo: pasar a pendiente_notificacion para que NCA envíe manualmente
    setPqrsWorkflow(e,{fase:PQRS_WF.PENDIENTE_NOTIF,documentos:oficioDocs});
    persistExpedienteGranular(e);
    window._vitalPdfLink=null;window._vitalPdfFileId=null;
    closeTaskModal();renderPqrsOficinaInbox();renderSecretariaPqrs();
    notif('📬 Oficio firmado registrado — NCA enviará la notificación al ciudadano','ok');
    // Si canal=correo pero no hay token, mostrar modal para que NCA conecte y envíe
    if(canal===PQRS_WF_CANAL.CORREO){
      if(typeof abrirNotifPqrsExpId==='function')setTimeout(()=>abrirNotifPqrsExpId(expId),400);
    }
  }
}

// ===========================================================================
// Notificaciones al ciudadano — correo automático (radicación / respuesta)
// ===========================================================================
function pqrsConsultaCiudadanaUrl(){
  const base=typeof PUBLIC_APP_URL!=='undefined'?PUBLIC_APP_URL:'https://asoredg-pixel.github.io/cda-expedientes-cda/';
  return String(base).replace(/\/?$/,'/');
}
function pqrsCorreoCiudadano(e){
  if(!e)return'';
  // Para anónimos: si se registró _qd_correo explícitamente para notificación, usarlo.
  const em=String(e._qd_correo||(e._qd_anonimo?'':e._pn_correo||e._pj_correo)||'').trim().toLowerCase();
  if(!em||!em.includes('@'))return'';
  return(typeof emailValido==='function'&&emailValido(em))?em:'';
}
// Devuelve todos los correos únicos válidos del expediente (solicitante, empresa, representante, apoderado, autorizado).
// Para anónimos con correo de notificación, incluye ese correo.
function pqrsCorreosCiudadano(e){
  if(!e)return[];
  const valida=em=>{
    const v=String(em||'').trim().toLowerCase();
    return v&&v.includes('@')&&(typeof emailValido!=='function'||emailValido(v))?v:'';
  };
  const set=new Set();
  const add=em=>{const v=valida(em);if(v)set.add(v);};
  // _qd_correo se usa siempre (incluye anónimos con correo de notificación)
  add(e._qd_correo);
  if(!e._qd_anonimo){
    add(e._pn_correo);
    if(e._tipo_persona==='juridica'){add(e._pj_correo);add(e._pj_rep_correo);}
    if(e._apoderado){add(e._apo_correo);}
    if(e._autorizado){add(e._aut_correo);}
  }
  return Array.from(set);
}
// Genera el PDF de soporte de respuesta (equivalente al soporte de radicación) usando jsPDF.
async function generarPdfRespuestaPqrs(e,opts){
  const jsPDFCtor=(window.jspdf&&window.jspdf.jsPDF)||window.jsPDF||null;
  if(!jsPDFCtor)return null;
  opts=opts||{};
  const wf=getPqrsWorkflow(e);
  const expId=e._exp||'';
  const doc=new jsPDFCtor({unit:'pt',format:'a4'});
  const margin=48;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  const maxW=pageW-margin*2;
  let y=margin;
  const lineH=13;
  const fmt=d=>(typeof fmtF==='function'?fmtF(d):d)||'';

  doc.setFont('helvetica','bold');doc.setFontSize(13);
  doc.text('SOPORTE DE RESPUESTA — PQRSD',margin,y);y+=18;
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(110);
  doc.text('Corporación CDA — Delegación Guaviare',margin,y);y+=16;
  doc.setTextColor(0);
  doc.setFont('helvetica','bold');doc.text('Radicado: '+expId,margin,y);y+=16;
  doc.setDrawColor(190);doc.line(margin,y,pageW-margin,y);y+=18;

  const canal=wf.canal||e._pqrs_respuesta_medio||'';
  const canalLabel={correo:'Correo electrónico',whatsapp:'WhatsApp',presencial:'Presencial',fisica:'Correo físico',aviso:'Por aviso'}[canal]||canal||'—';
  const tipo=wf.tipo||PQRS_WF_TIPO&&PQRS_WF_TIPO.MENSAJE||'';
  const tipoLabel={mensaje:'Mensaje simple',oficio_firmado:'Oficio firmado',informativa:'Informativa'}[tipo]||tipo||'—';
  const meta=[
    ['Tipo solicitud:',e._tipo_solicitud||'PQRSD'],
    ['Asunto:',e.f_f1||e._pqrs_detalle||''],
    ['Fecha solicitud:',fmt(e._fecha||e._fecha_solicitud||'')],
    ['Fecha respuesta:',fmt(wf.fecha_respuesta||e._pqrs_respuesta_fecha||opts.fechaResp||hoy())],
    ['Tipo respuesta:',tipoLabel],
    ['Canal notificación:',canalLabel],
  ];
  if(wf.oficio||e._pqrs_respuesta_oficio)meta.push(['N° oficio:',wf.oficio||e._pqrs_respuesta_oficio]);
  const cerradoPor=wf.cerrado_por||opts.cerradoPor||'';
  if(cerradoPor)meta.push(['Atendido por:',cerradoPor]);
  doc.setFontSize(10);
  meta.forEach(row=>{
    if(!row[1])return;
    doc.setFont('helvetica','bold');doc.text(row[0],margin,y);
    doc.setFont('helvetica','normal');
    const lines=doc.splitTextToSize(String(row[1]),maxW-100);
    y=_pdfWriteLines(doc,lines,margin+100,y,14,pageH,margin);y+=2;
  });
  y+=4;doc.setDrawColor(190);doc.line(margin,y,pageW-margin,y);y+=18;

  doc.setFont('helvetica','bold');doc.text('Interesado',margin,y);y+=16;
  doc.setFont('helvetica','normal');
  const inter=[];
  if(e._tipo_persona==='juridica'){
    if(e._pj_empresa)inter.push(['Razón social:',e._pj_empresa]);
    if(e._pj_nit)inter.push(['NIT:',e._pj_nit]);
    if(e._pj_rep_nombre)inter.push(['Representante legal:',e._pj_rep_nombre]);
    const corrEmp=e._pj_rep_correo||e._pj_correo;
    if(corrEmp)inter.push(['Correo:',corrEmp]);
  }else{
    if(e._pn_nombre||e._qd_nombre)inter.push(['Nombre:',e._pn_nombre||e._qd_nombre]);
    if(e._pn_identificacion)inter.push(['Identificación:',e._pn_identificacion]);
    const corrPn=e._qd_correo||e._pn_correo;
    if(corrPn)inter.push(['Correo:',corrPn]);
  }
  if(e._apoderado&&e._apo_nombre)inter.push(['Apoderado:',e._apo_nombre+(e._apo_correo?' · '+e._apo_correo:'')]);
  if(e._autorizado&&e._aut_nombre)inter.push(['Autorizado:',e._aut_nombre+(e._aut_correo?' · '+e._aut_correo:'')]);
  inter.forEach(row=>{
    doc.setFont('helvetica','bold');doc.text(row[0],margin,y);
    doc.setFont('helvetica','normal');
    const lines=doc.splitTextToSize(String(row[1]),maxW-110);
    y=_pdfWriteLines(doc,lines,margin+110,y,14,pageH,margin);y+=2;
  });

  const cuerpoText=String(wf.cuerpo||e._pqrs_respuesta_nota||opts.cuerpo||'').trim();
  if(cuerpoText){
    y+=4;doc.setDrawColor(190);doc.line(margin,y,pageW-margin,y);y+=18;
    doc.setFont('helvetica','bold');doc.text('Resumen de la respuesta:',margin,y);y+=14;
    doc.setFont('helvetica','normal');
    y=_pdfWriteLines(doc,doc.splitTextToSize(cuerpoText,maxW),margin,y,lineH,pageH,margin);
  }
  const docs=Array.isArray(opts.documentos)?opts.documentos:(wf.documentos||[]);
  if(docs.length){
    y+=6;if(y>pageH-margin){doc.addPage();y=margin;}
    doc.setDrawColor(190);doc.line(margin,y,pageW-margin,y);y+=16;
    doc.setFont('helvetica','bold');doc.text('Documentos de respuesta ('+docs.length+'):',margin,y);y+=14;
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(90);
    docs.forEach(d=>{
      if(y>pageH-margin){doc.addPage();y=margin;}
      doc.text('• '+(d.nombre||d.driveLink||'Documento'),margin+6,y);y+=12;
    });
    doc.setTextColor(0);doc.setFontSize(10);
  }
  y+=10;if(y>pageH-margin*2){doc.addPage();y=margin;}
  doc.setDrawColor(220);doc.line(margin,y,pageW-margin,y);y+=14;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(130);
  doc.text('Documento generado por el Sistema de Seguimiento de Trámites — CDA Delegación Guaviare.',margin,y);
  return doc.output('blob');
}
// Genera y sube el PDF de soporte de respuesta al Drive institucional (carpeta Respuesta del expediente).
// Retorna {driveLink, previewLink, fileId} o null si falla.
async function _pqrsSubirSoporteRespuesta(e,opts){
  try{
    const blob=await generarPdfRespuestaPqrs(e,opts);
    if(!blob)return null;
    const expId=e._exp||'';
    const nombreCarpeta=e._qd_nombre||e._pn_nombre||e._pj_empresa||expId;
    const fechaExp=e._fecha||e._fecha_solicitud||'';
    const fileName='Soporte_Respuesta_'+expId+'.pdf';
    const res=await driveUploadInstitutional(blob,fileName,'application/pdf','respuesta_aprobada',expId,nombreCarpeta,fechaExp,{expediente:e,uploadTarget:'respuesta'});
    return res;
  }catch(err){
    console.warn('_pqrsSubirSoporteRespuesta:',err);
    return null;
  }
}
function pqrsDebeNotificarRadicacionCorreo(e,opts){
  // Enviar siempre que haya al menos un correo registrado, independientemente del
  // medio de recepción o del medio de notificación elegido.
  return pqrsCorreosCiudadano(e).length>0||!!pqrsCorreoCiudadano(e);
}
function pqrsRequiereCorreoNotificacion(e){
  if(!e)return false;
  const wf=getPqrsWorkflow(e);
  const canal=String(wf.canal||e._pqrs_respuesta_medio||'').trim().toLowerCase();
  if(canal===PQRS_WF_CANAL.CORREO||canal==='correo'||canal==='electronica')return true;
  return medioNotificacionNorm(e._medio_notificacion||'')==='electronica';
}
function pqrsCorreoHtmlPieInstitucional(){
  return'<hr style="border:none;border-top:1px solid #ddd;margin:16px 0">'+
    '<p style="font-size:11px;color:#888;line-height:1.5">Mensaje enviado desde el Sistema de Seguimiento de Trámites — CDA Delegación Guaviare. No responda directamente a este correo automático.</p>';
}
function pqrsCorreoHtmlBloqueConsulta(expId){
  const url=pqrsConsultaCiudadanaUrl();
  return'<p style="margin-top:12px"><strong>Consulte el estado de su solicitud:</strong></p>'+
    '<p>Ingrese a <a href="'+escAttr(url)+'">'+escAttr(url)+'</a>, seleccione <strong>Consulta ciudadana</strong> e ingrese el número: <strong>'+escAttr(expId||'')+'</strong></p>';
}
function pqrsCorreoHtmlRadicacion(e){
  const expId=e._exp||'';
  const nombre=e._qd_nombre||e._pn_nombre||'ciudadano/a';
  const tipo=e._tipo_solicitud||'PQRSD';
  const asunto=e.f_f1||e._pqrs_detalle||'';
  const fecha=e._fecha||e._fecha_solicitud||'';
  const fechaFmt=fecha?(typeof fmtF==='function'?fmtF(fecha):fecha):'';
  let h='<p>Estimado/a <strong>'+escAttr(nombre)+'</strong>,</p>'+
    '<p>Le informamos que su solicitud ha sido <strong>radicada</strong> en el CDA Delegación Guaviare con el siguiente número:</p>'+
    '<p style="font-size:16px"><strong>'+escAttr(expId)+'</strong></p>'+
    '<p><strong>Tipo:</strong> '+escAttr(tipo);
  if(asunto)h+='<br><strong>Asunto:</strong> '+escAttr(asunto);
  if(fechaFmt)h+='<br><strong>Fecha de radicación:</strong> '+escAttr(fechaFmt);
  h+='</p>'+pqrsCorreoHtmlBloqueConsulta(expId)+pqrsCorreoHtmlPieInstitucional();
  return h;
}
function pqrsCorreoHtmlRespuesta(e,cuerpo,documentos){
  const expId=e._exp||'';
  const nombre=e._qd_nombre||e._pn_nombre||'ciudadano/a';
  const tipo=e._tipo_solicitud||'PQRSD';
  const wf=getPqrsWorkflow(e);
  const oficio=wf.oficio||e._pqrs_respuesta_oficio||'';
  const docs=Array.isArray(documentos)?documentos:[];
  const linksHtml=docs.filter(d=>d&&d.driveLink).map(d=>'<p>📎 <a href="'+escAttr(d.driveLink)+'">'+escAttr(d.nombre||d.driveLink)+'</a></p>').join('');
  const cuerpoHtml=cuerpo?('<p>'+escAttr(cuerpo).replace(/\n/g,'</p><p>')+'</p>'):'';
  let h='<p>Estimado/a <strong>'+escAttr(nombre)+'</strong>,</p>'+
    '<p>Su solicitud <strong>'+escAttr(expId)+'</strong> ('+escAttr(tipo)+') ha sido <strong>atendida</strong>.</p>';
  if(oficio)h+='<p>N° de oficio: <strong>'+escAttr(oficio)+'</strong></p>';
  if(cuerpoHtml)h+=cuerpoHtml;
  if(linksHtml)h+='<hr><p><strong>Documentos de respuesta:</strong></p>'+linksHtml;
  h+=pqrsCorreoHtmlBloqueConsulta(expId)+pqrsCorreoHtmlPieInstitucional();
  return h;
}
// Envía un correo a uno o varios destinatarios.
// `to` puede ser string (un correo) o array de strings (varios).
// Si son varios, envía uno por uno y devuelve el resultado del primero exitoso.
async function pqrsEnviarCorreoCiudadano(to,subject,htmlBody,preferOfi){
  const tokOfi=typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid();
  const tokSec=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid();
  const send=async(para)=>{
    let res=null,cuenta='';
    if(preferOfi&&tokOfi&&typeof gmailOfiSendMessage==='function'){
      res=await gmailOfiSendMessage(para,subject,htmlBody);cuenta='oficina';
    }else if(tokSec&&typeof gmailSendMessage==='function'){
      res=await gmailSendMessage(para,subject,htmlBody);cuenta='secretaria';
    }else if(tokOfi&&typeof gmailOfiSendMessage==='function'){
      res=await gmailOfiSendMessage(para,subject,htmlBody);cuenta='oficina';
    }else{
      throw new Error('No hay token Gmail activo. Conecte su correo en la pestaña Correos.');
    }
    return{messageId:(res&&(res.id||res.messageId))||'',cuenta,raw:res};
  };
  const lista=Array.isArray(to)?to.filter(Boolean):[String(to||'').trim().toLowerCase()];
  if(!lista.length)throw new Error('Correo destino vacío');
  let first=null;
  const errors=[];
  for(const addr of lista){
    try{const r=await send(addr);if(!first)first=r;}catch(err){errors.push(addr+': '+String(err.message||err));}
  }
  if(!first&&errors.length)throw new Error(errors[0]);
  return first;
}
function registrarNotificacionCiudadanoPqrs(e,meta){
  if(!e)return;
  meta=meta||{};
  const wf=getPqrsWorkflow(e);
  const prev=(wf.notificacion_ciudadano&&typeof wf.notificacion_ciudadano==='object')?wf.notificacion_ciudadano:{};
  const entry=Object.assign({},prev,meta,{en:meta.en||new Date().toISOString()});
  const patch={notificacion_ciudadano:entry};
  if(meta.enviado&&meta.medio==='correo'){
    patch.notificacion_correo={enviado:true,a:meta.a||'',en:entry.en,gmail_message_id:meta.gmail_message_id||''};
  }
  setPqrsWorkflow(e,patch);
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  const histTipo=meta.histTipo||(meta.excepcion?'notificacion_excepcion':(meta.tipo==='radicacion'?'notificacion_radicacion':'notificacion_correo'));
  const histNota=meta.histNota||(meta.enviado?('Notificación enviada a '+(meta.a||'')):('Excepción — no enviada por correo: '+(meta.motivo||'')));
  e._pqrs_historial.push({
    tipo:histTipo,
    fecha:hoy(),
    nota:histNota,
    oficina:e._pqrs_oficina||(typeof deptoActivo!=='undefined'?deptoActivo:''),
    por:meta.por||(typeof responsableActivo!=='undefined'?responsableActivo:'')
  });
}
async function enviarNotificacionRadicacionPqrsAuto(e,opts){
  opts=opts||{};
  if(!e||!pqrsDebeNotificarRadicacionCorreo(e,opts))return{skipped:true,reason:'no_aplica'};
  // Multi-email: incluir empresa, representante, apoderado, autorizado
  const destinos=pqrsCorreosCiudadano(e);
  if(!destinos.length){
    const solo=pqrsCorreoCiudadano(e);
    if(!solo)return{skipped:true,reason:'sin_correo'};
    destinos.push(solo);
  }
  const expId=e._exp||'';
  const asunto='Radicación de su solicitud '+(e._tipo_solicitud||'PQRSD')+' — '+expId;
  const html=pqrsCorreoHtmlRadicacion(e);
  try{
    const sent=await pqrsEnviarCorreoCiudadano(destinos,asunto,html,false);
    const paraLabel=destinos.join(', ');
    registrarNotificacionCiudadanoPqrs(e,{
      tipo:'radicacion',
      medio:'correo',
      enviado:true,
      a:paraLabel,
      cuenta_emisora:sent.cuenta,
      gmail_message_id:sent.messageId,
      histTipo:'notificacion_radicacion',
      histNota:'Correo de radicación enviado a '+paraLabel
    });
    if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
    return{ok:true,a:paraLabel};
  }catch(err){
    console.warn('enviarNotificacionRadicacionPqrsAuto:',err);
    if(typeof notif==='function')notif('⚠️ PQRSD radicada, pero no se pudo enviar el correo al ciudadano: '+String(err.message||err).slice(0,80),'warn');
    return{ok:false,error:err};
  }
}
function omitirNotificacionRespuestaPqrs(expId){
  expId=String(expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e){closeTaskModal();return;}
  if(pqrsRequiereCorreoNotificacion(e)){
    abrirModalExcepcionNotificacionPqrs(expId);
    return;
  }
  closeTaskModal();
}
function abrirModalExcepcionNotificacionPqrs(expId){
  expId=String(expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e){closeTaskModal();return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  if(!ov||!body)return;
  if(tit)tit.textContent='Excepción — notificación por correo — '+expId;
  body.innerHTML=
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">La notificación por correo electrónico no se enviará. Indique el <strong>motivo</strong> y el medio alternativo usado (presencial, audiencia, etc.) para dejar constancia en el expediente.</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Motivo de la excepción<span class="req-star">*</span></label>'+
    '<textarea id="pqrs-notif-exc-motivo" placeholder="Ej. Ciudadano notificado en audiencia del 15/06/2026 — acta adjunta en expediente." style="min-height:88px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%"></textarea></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" onclick="confirmarExcepcionNotificacionPqrs(\''+escAttr(expId)+'\')">Registrar excepción</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Volver</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'pqrsNotifExcepcion',expId:expId};
  setTimeout(function(){const inp=document.getElementById('pqrs-notif-exc-motivo');if(inp)inp.focus();},80);
}
function confirmarExcepcionNotificacionPqrs(expId){
  expId=String(expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e){closeTaskModal();return;}
  const motivo=String((document.getElementById('pqrs-notif-exc-motivo')||{}).value||'').trim();
  if(motivo.length<10){notif('Indique el motivo de la excepción (mínimo 10 caracteres)','err');return;}
  registrarNotificacionCiudadanoPqrs(e,{
    enviado:false,
    excepcion:true,
    motivo:motivo,
    medio:'correo',
    por:responsableActivo||rolSesion||'',
    histTipo:'notificacion_excepcion',
    histNota:'Excepción — notificación por correo no enviada: '+motivo
  });
  persistExpedienteGranular(e,false);
  closeTaskModal();
  notif('Excepción de notificación registrada en el expediente','ok');
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderSecretariaPqrs==='function')renderSecretariaPqrs();
  if(typeof refreshPqrsDetalleViews==='function')refreshPqrsDetalleViews(expId);
}

// ===========================================================================
// SPRINT 7 — Confirmación y envío de correo OAuth (secretaría u oficina)
// ===========================================================================
function abrirNotifPqrsExpId(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const wf=getPqrsWorkflow(e);
  confirmarEnvioRespuestaEmailPqrs(e,(e._qd_correo||e._pn_correo||'').trim(),wf.cuerpo||e._pqrs_respuesta_nota||'',wf.documentos||[]);
}
function confirmarEnvioRespuestaEmailPqrs(e,ciudEmail,cuerpo,documentos){
  if(!e)return;
  // Resolver todos los correos: si ciudEmail es un string con varios (separados por coma) o array, usarlos;
  // si no, caer en pqrsCorreosCiudadano
  let todosCorreos=[];
  if(ciudEmail){
    const raw=Array.isArray(ciudEmail)?ciudEmail:String(ciudEmail).split(',');
    todosCorreos=raw.map(s=>s.trim().toLowerCase()).filter(s=>s.includes('@'));
  }
  if(!todosCorreos.length)todosCorreos=pqrsCorreosCiudadano(e);
  if(!todosCorreos.length)todosCorreos=[pqrsCorreoCiudadano(e)].filter(Boolean);
  const paraDisplay=todosCorreos.join(', ');
  cuerpo=cuerpo||e._pqrs_respuesta_nota||'';
  documentos=documentos||[];
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  if(!ov||!body)return;
  if(tit)tit.textContent='Enviar correo de respuesta — '+e._exp;
  const multiInfo=todosCorreos.length>1
    ?'<div style="font-size:11px;color:var(--bl);margin-top:3px">Se enviará a <strong>'+todosCorreos.length+'</strong> destinatarios (empresa, representante, apoderado y/o autorizado).</div>'
    :'';
  const docsHtml=documentos.length
    ?documentos.filter(d=>d.driveLink).map(d=>'<div style="font-size:11px;margin-top:3px">📎 <a href="'+escAttr(d.driveLink)+'" target="_blank" style="color:var(--bl)">'+escAttr(d.nombre||d.driveLink)+'</a></div>').join('')
    :'<div style="font-size:11px;color:var(--tx3)">Sin adjuntos</div>';
  body.innerHTML=
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Se enviará el correo de respuesta al ciudadano usando la cuenta de Gmail de la oficina conectada.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Para (ciudadano)</label>'+
    '<input type="text" id="pqrs-mail-para" value="'+escAttr(paraDisplay)+'" placeholder="correo1@x.com, correo2@x.com">'+
    multiInfo+'</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Asunto</label><input type="text" id="pqrs-mail-asunto" value="Respuesta a su solicitud '+escAttr(e._tipo_solicitud||'PQRSD')+' — '+escAttr(e._exp)+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Cuerpo del correo <span style="font-weight:400;color:var(--tx3)">(editable)</span></label>'+
    '<textarea id="pqrs-mail-cuerpo" style="min-height:100px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px">'+escAttr(cuerpo)+'</textarea></div>'+
    '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:600;margin-bottom:4px">Documentos incluidos como links:</div>'+docsHtml+'</div>'+
    '<div id="pqrs-mail-status" style="font-size:11px;margin-bottom:8px"></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" id="pqrs-mail-send-btn" onclick="enviarCorreoRespuestaPqrs(\''+escAttr(e._exp)+'\')">📧 Enviar correo</button>'+
    '<button type="button" class="btn bsm" onclick="omitirNotificacionRespuestaPqrs(\''+escAttr(e._exp)+'\')">Omitir envío</button>'+
    '</div>';
  window._pqrsMailDocs=documentos;
  ov.classList.add('on');
  window._taskModalCtx={mode:'pqrsMailConfirm',expId:e._exp};
}

async function enviarCorreoRespuestaPqrs(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e){notif('PQRSD no encontrada','err');return;}
  const paraRaw=String((document.getElementById('pqrs-mail-para')||{}).value||'').trim();
  if(!paraRaw){notif('Indique el correo destino','err');return;}
  // Soporte de múltiples destinatarios separados por coma
  const destinos=paraRaw.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s.includes('@'));
  if(!destinos.length){notif('Correo destino inválido','err');return;}
  const asunto=String((document.getElementById('pqrs-mail-asunto')||{}).value||'').trim();
  const cuerpo=String((document.getElementById('pqrs-mail-cuerpo')||{}).value||'').trim();
  const statusEl=document.getElementById('pqrs-mail-status');
  const btn=document.getElementById('pqrs-mail-send-btn');
  if(!asunto){notif('Indique el asunto del correo','err');return;}
  if(!cuerpo){notif('Indique el cuerpo del correo','err');return;}
  if(btn){btn.disabled=true;btn.textContent='Enviando…';}
  if(statusEl)statusEl.textContent='⬆ Enviando correo…';

  const docs=window._pqrsMailDocs||[];
  const bodyHtml=pqrsCorreoHtmlRespuesta(e,cuerpo,docs);

  try{
    const sent=await pqrsEnviarCorreoCiudadano(destinos,asunto,bodyHtml,true);
    const wf=getPqrsWorkflow(e);
    setPqrsWorkflow(e,{
      fase:PQRS_WF.CERRADA,
      fecha_respuesta:wf.fecha_respuesta||hoy(),
      canal:PQRS_WF_CANAL.CORREO
    });
    const paraLabel=destinos.join(', ');
    registrarNotificacionCiudadanoPqrs(e,{
      tipo:'respuesta',
      medio:'correo',
      enviado:true,
      a:paraLabel,
      cuenta_emisora:sent.cuenta,
      gmail_message_id:sent.messageId,
      por:responsableActivo||'',
      histTipo:'notificacion_correo',
      histNota:'Correo de respuesta enviado a '+paraLabel
    });
    e._pqrs_estado_oficina='cerrado';
    e._estado='Atendido';
    e._fecha_res=wf.fecha_respuesta||hoy();
    const fe=getFechasEstado(e);
    fe.Atendido=e._fecha_res;
    if(!fe['En trámite'])fe['En trámite']=fe.Solicitud||e._fecha||e._fecha_res;
    e._fechas_estado=JSON.stringify(fe);
    e.historial=rebuildHistorial(e,e.historial||[]);
    persistExpedienteGranular(e);
    if(statusEl)statusEl.textContent='✅ Correo enviado exitosamente';
    notif('✅ Correo enviado a '+paraLabel+' — PQRSD cerrada','ok');
    setTimeout(()=>{closeTaskModal();renderPqrsOficinaInbox();renderSecretariaPqrs();},1800);
  }catch(err){
    if(statusEl)statusEl.textContent='❌ Error: '+String(err.message||err).slice(0,80);
    if(btn){btn.disabled=false;btn.textContent='📧 Enviar correo';}
    notif('Error al enviar correo: '+String(err.message||err).slice(0,80),'err');
  }
}
// Ofrece enviar un aviso simple ("fue atendida") por correo cuando el canal es físico/presencial/aviso.
// No requiere acción inmediata: es un toast con botón.
// Crea una tarea de seguimiento "Soporte notificación personal" para que el responsable
// cargue el comprobante de la notificación física/presencial/aviso. NCA la revisa
// desde el menú de actividades pendientes de revisión antes de dar por cerrado el trámite.
function _pqrsCrearTareaNotificacionPersonal(e,canal){
  if(!e)return;
  if(!Array.isArray(e._tasks))e._tasks=[];
  const canalLabel={presencial:'Presencial',fisica:'Correo físico',aviso:'Por aviso',whatsapp:'WhatsApp'}[canal]||canal||'Personal';
  const actNombre='Notificación '+canalLabel+' PQRSD — '+e._exp;
  // Evitar duplicados
  if(e._tasks.some(t=>t&&!t.eliminada&&String(t.actividad||'').includes('Notificación')&&String(t.actividad||'').includes(e._exp)))return;
  const enc=typeof getEncargadoOficina==='function'?getEncargadoOficina(e._pqrs_oficina||''):'';
  const resp=String(e._pqrs_responsable_oficina||'').trim()||enc||responsableActivo||'';
  e._tasks.push(normalizeTask({
    id:genTaskId(),
    actividad:actNombre,
    detalle:'Realizar notificación '+canalLabel.toLowerCase()+' al ciudadano y cargar el soporte (constancia firmada, acta, etc.) como comprobante.',
    desc:actNombre,
    tipo:'notificacion_personal',
    entregaModo:'individual',
    plazoDias:5,
    vence:'',
    prioritaria:!!e._pqrs_prioritaria,
    eliminada:false,
    responsable:resp,
    responsables:resp?[resp]:[],
    asignados:resp?[{nombre:resp,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}]:[],
    comentarios:[],
    historial:[{tipo:'creacion_auto',fecha:hoy(),nota:'Tarea generada automáticamente al registrar respuesta con canal '+canalLabel+'. Suba el soporte de notificación para revisión de NCA/supervisor.'}],
    soportes:[],
    notasDoc:[]
  }));
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'notificacion_personal_pendiente',fecha:hoy(),nota:'Tarea de notificación '+canalLabel+' creada — pendiente de soporte',oficina:e._pqrs_oficina||deptoActivo||'',por:responsableActivo||''});
}
function _pqrsOfrecerAvisoSimple(e,correos){
  if(!e||!correos||!correos.length)return;
  const expId=e._exp||'';
  window._pqrsAvisoCtx={expId,correos};
  const msg='📬 ¿Enviar aviso simple al ciudadano? ('+correos.join(', ')+')';
  if(typeof notifConAccion==='function'){
    notifConAccion(msg,'_pqrsEnviarAvisoSimple()');
  }else{
    const ok=window.confirm(msg+'\n\nEl ciudadano recibirá un correo breve indicando que su solicitud fue atendida.');
    if(ok)_pqrsEnviarAvisoSimple();
  }
}
async function _pqrsEnviarAvisoSimple(){
  const ctx=window._pqrsAvisoCtx||{};
  const expId=String(ctx.expId||'').trim();
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  const correos=ctx.correos||[];
  if(!e||!correos.length)return;
  const asunto='Su solicitud '+escAttr(e._tipo_solicitud||'PQRSD')+' — '+(expId)+' ha sido atendida';
  const html='<p>Estimado/a <strong>'+escAttr(e._qd_nombre||e._pn_nombre||e._pj_empresa||'ciudadano/a')+'</strong>,</p>'+
    '<p>Le informamos que su solicitud <strong>'+(expId)+'</strong> ha sido atendida por el área correspondiente.</p>'+
    '<p>Puede verificar el estado en la consulta ciudadana.</p>'+
    pqrsCorreoHtmlBloqueConsulta(expId)+pqrsCorreoHtmlPieInstitucional();
  try{
    await pqrsEnviarCorreoCiudadano(correos,asunto,html,true);
    registrarNotificacionCiudadanoPqrs(e,{
      tipo:'aviso_informativo',
      medio:'correo',
      enviado:true,
      a:correos.join(', '),
      por:responsableActivo||'',
      histTipo:'aviso_informativo_correo',
      histNota:'Aviso simple enviado a '+correos.join(', ')
    });
    persistExpedienteGranular(e,false);
    notif('✅ Aviso simple enviado a '+correos.join(', '),'ok');
  }catch(err){
    notif('No se pudo enviar el aviso: '+String(err.message||err).slice(0,80),'warn');
  }
  window._pqrsAvisoCtx=null;
}
