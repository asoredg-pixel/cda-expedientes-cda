// =============================================================================
// tramite-firma.js — Firma / notificación de actividades de trámite (no PQRSD)
// Workflow a nivel de TASK (t.firmaWf), reutiliza fases PQRS_WF y roles existentes.
// =============================================================================

function resolveActividadRequiereFirma(nombreAct,deptoId){
  const nom=String(nombreAct||'').trim();
  if(!nom)return false;
  const cfgAct=typeof getCfgActividadesPred==='function'?getCfgActividadesPred(deptoId):(typeof cfgFor==='function'?cfgFor(deptoId):null);
  const map=(cfgAct&&cfgAct.actFirmaMap)||{};
  if(map[nom]===true||map[nom]==='1'||map[nom]==='si')return true;
  if(map[nom]===false||map[nom]==='0'||map[nom]==='no')return false;
  // Heurística: actos / resoluciones suelen ir a firma
  const s=nom.toLowerCase();
  if(/proyectar acto|resoluci[oó]n|acto administrativo/.test(s))return true;
  return false;
}

function getTaskFirmaWf(t){
  if(!t)return{};
  const wf=(t.firmaWf&&typeof t.firmaWf==='object')?t.firmaWf:{};
  return Object.assign({},wf);
}
function setTaskFirmaWf(expId,taskId,patch){
  patch=patch||{};
  return mutateTask(expId,taskId,function(t){
    const prev=getTaskFirmaWf(t);
    t.firmaWf=Object.assign({},prev,patch);
    if(patch.fase)t.firmaWf.fase=patch.fase;
    if(!Array.isArray(t.historial))t.historial=[];
    t.historial.push({
      tipo:'firma_wf',
      fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10),
      por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
      nota:'Firma trámite → '+(patch.fase||prev.fase||'')
    });
  });
}
function taskFirmaFase(t){
  const wf=getTaskFirmaWf(t);
  return String(wf.fase||'').trim();
}
function taskEnFlujoFirmaTramite(t){
  if(!t||t.eliminada||t.sinExpediente)return false;
  const e=typeof getExpById==='function'?getExpById(t.exp||t.codigo):null;
  if(e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))return false;
  const f=taskFirmaFase(t);
  if(!f)return false;
  const cerrada=(typeof PQRS_WF!=='undefined'&&f===PQRS_WF.CERRADA)||f==='cerrada_atendida';
  return!cerrada;
}
function taskFirmaEnParaFirma(t){
  const f=taskFirmaFase(t);
  return f===(typeof PQRS_WF!=='undefined'?PQRS_WF.PARA_FIRMA:'para_firma')||f===(typeof PQRS_WF!=='undefined'?PQRS_WF.VITAL_GESTION:'pendiente_gestion_vital');
}
function taskFirmaEnPorFirmar(t){
  return taskFirmaFase(t)===(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar');
}
function taskFirmaEsFirmadoPendiente(t){
  if(!taskFirmaEnPorFirmar(t))return false;
  const wf=getTaskFirmaWf(t);
  return !!(wf.firma_fisica&&wf.firma_fisica.en);
}
function taskFirmaEnPorNotificar(t){
  const f=taskFirmaFase(t);
  return f===(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion')
    ||f===(typeof PQRS_WF!=='undefined'?PQRS_WF.LISTA_ENVIO:'lista_para_envio');
}
function taskFirmaEstadoUi(t){
  if(!taskEnFlujoFirmaTramite(t)&&!taskFirmaFase(t))return null;
  const f=taskFirmaFase(t);
  const wf=getTaskFirmaWf(t);
  const quien=String(wf.notificar_por||'').trim();
  if(taskFirmaEnParaFirma(t))return{lbl:'Por imprimir',bg:'#1a7a4a22',fg:'#1a7a4a',sub:quien?'Notif.: '+quien:''};
  if(taskFirmaEnPorFirmar(t)){
    if(taskFirmaEsFirmadoPendiente(t))return{lbl:'Firmados',bg:'#dcfce7',fg:'#15803d',sub:'Pendiente notificar'};
    return{lbl:'Por firmar',bg:'#0d5c2e22',fg:'#0d5c2e',sub:quien?'Notif.: '+quien:''};
  }
  if(taskFirmaEnPorNotificar(t))return{lbl:'Por notificar',bg:'#185FA522',fg:'#185FA5',sub:quien||''};
  if(f==='cerrada_atendida'||(typeof PQRS_WF!=='undefined'&&f===PQRS_WF.CERRADA))
    return{lbl:'Atendida',bg:'var(--gnl)',fg:'var(--gn)',sub:''};
  return null;
}

function getTareasTramiteFirmaPorFase(matchFn){
  const out=[];
  (typeof exps!=='undefined'?exps:[]).forEach(function(e){
    if(!e||(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)))return;
    if(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))return;
    (e.tasks||[]).forEach(function(t){
      if(!t||t.eliminada||!taskEnFlujoFirmaTramite(t))return;
      if(matchFn&&!matchFn(t,e))return;
      const tramObj=typeof getTram==='function'?getTram(e._tramite,e):null;
      const nt=typeof normalizeTask==='function'?normalizeTask(Object.assign({},t,{
        codigo:e._exp,exp:e._exp,
        tram:tramObj?tramObj.nombre:(e._tramite||''),
        nombre:typeof getNom==='function'?getNom(e):'',
        depto:e._depto
      })):t;
      out.push(nt);
    });
  });
  return out;
}

function taskRequiereFirmaEffective(t,expId){
  if(!t)return false;
  if(t.requiereFirma===true)return true;
  if(t.requiereFirma===false)return false;
  const e=typeof getExpById==='function'?getExpById(expId||t.exp||t.codigo):null;
  return resolveActividadRequiereFirma(t.actividad||t.desc||'',e&&e._depto);
}

/** Checkbox + botones de firma en la barra de verificación de trámite. */
function renderTramiteFirmaVerifyExtrasHtml(expId,taskId,t){
  if(!t||t.sinExpediente)return'';
  const e=typeof getExpById==='function'?getExpById(expId):null;
  if(e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))return'';
  if(taskEnFlujoFirmaTramite(t)){
    return renderTramiteFirmaGestionHtml(expId,taskId,t);
  }
  const req=taskRequiereFirmaEffective(t,expId);
  const wf=getTaskFirmaWf(t);
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e){
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{modo:'revision',id:'tramite-notif-por-sel',todosResponsables:true});
  }
  return '<div style="margin-bottom:10px;padding:8px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">'+
      '<input type="checkbox" id="task-rev-requiere-firma"'+(req?' checked':'')+' style="width:15px;height:15px;accent-color:var(--bl)"> '+
      '<span><strong>Requiere firma del Director</strong> — al aprobar pasa a Por imprimir → Por firmar → Por notificar (como PQRSD). Si no, se cierra y se notifica al ciudadano.</span>'+
    '</label>'+
    (selNotif?'<div style="margin-top:8px">'+selNotif+'</div>':'')+
    '</div>';
}

function renderTramiteFirmaGestionHtml(expId,taskId,t){
  const wf=getTaskFirmaWf(t);
  const ui=taskFirmaEstadoUi(t)||{};
  let btns='';
  const eid=escAttr(expId),tid=escAttr(taskId);
  if(taskFirmaEnParaFirma(t)){
    if(typeof pqrsPuedeFlujoPorImprimir==='function'&&pqrsPuedeFlujoPorImprimir())
      btns+='<button type="button" class="btn bsm bp" style="background:#1a7a4a;border-color:#1a7a4a" onclick="tramitePasarAPorFirmar(\''+eid+'\',\''+tid+'\')">🖨 Pasar a firma del Director</button> ';
    else btns+='<span style="font-size:11px;color:var(--tx2)">Pendiente VITAL / encargado</span> ';
  }else if(taskFirmaEnPorFirmar(t)){
    if(taskFirmaEsFirmadoPendiente(t)){
      btns+='<button type="button" class="btn bsm bp" onclick="tramitePasarAPorNotificar(\''+eid+'\',\''+tid+'\')">📬 Pasar a por notificar</button> ';
    }else if(typeof pqrsPuedeFirmarDirector==='function'&&pqrsPuedeFirmarDirector({})){
      btns+='<button type="button" class="btn bsm bp" style="background:#0d5c2e;border-color:#0d5c2e" onclick="tramiteMarcarFirmadoFisico(\''+eid+'\',\''+tid+'\')">🖊 Marcar firmado</button> ';
    }else{
      btns+='<button type="button" class="btn bsm" onclick="tramiteMarcarFirmadoFisico(\''+eid+'\',\''+tid+'\')">⬆ Cargar / marcar firmado</button> ';
    }
  }else if(taskFirmaEnPorNotificar(t)){
    btns+='<button type="button" class="btn bsm bp" onclick="openTramiteNotificarModal(\''+eid+'\',\''+tid+'\')">📬 Notificar ciudadano</button> ';
  }
  const e=typeof getExpById==='function'?getExpById(expId):null;
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e&&(taskFirmaEnParaFirma(t)||taskFirmaEnPorFirmar(t))){
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{modo:'firma',id:'tramite-notif-por-sel',todosResponsables:true});
  }
  return '<div class="task-cmt-form" style="padding:.65rem;border:1px solid #0d5c2e;border-radius:var(--r);background:#0d5c2e12;margin-bottom:10px">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#0d5c2e">🖊 Flujo de firma (trámite) · '+escAttr(ui.lbl||taskFirmaFase(t))+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">El documento no se publica en consulta ciudadana ni se envía correo hasta notificar.</div>'+
    selNotif+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+btns+'</div></div>';
}

async function tramiteEnviarAFirmaDesdeRevision(expId,taskId){
  const e=typeof getExpById==='function'?getExpById(expId):null;
  const t=e?getTaskFromExp(e,taskId):null;
  if(!e||!t){notif('Actividad no encontrada','err');return;}
  if(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)){notif('Use el flujo PQRSD','err');return;}
  let notifPor='';
  const sel=document.getElementById('tramite-notif-por-sel')||document.getElementById('pqrs-notif-por-sel');
  if(sel)notifPor=String(sel.value||'').trim();
  if(!notifPor&&typeof pqrsResolverNotificadorCorreo==='function')
    notifPor=pqrsResolverNotificadorCorreo(e._depto||'guaviare','');
  // Como PQRSD: NCA/encargado/atajo van directo a «Por firmar» (bandeja del Director)
  const atajoDirecto=(typeof pqrsPuedeAtajoParaFirma==='function'&&pqrsPuedeAtajoParaFirma())
    ||(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())
    ||(typeof esCargoVital==='function'&&esCargoVital());
  const faseDest=atajoDirecto
    ?(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar')
    :(typeof PQRS_WF!=='undefined'?PQRS_WF.PARA_FIRMA:'para_firma');
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(expId,taskId,atajoDirecto?'por_firmar':'por_firma');}catch(err){console.warn('tramite firma rename:',err);}
  }
  const ok=mutateTask(expId,taskId,function(tk){
    tk.requiereFirma=true;
    const prev=getTaskFirmaWf(tk);
    tk.firmaWf=Object.assign({},prev,{
      fase:faseDest,
      notificar_por:notifPor||prev.notificar_por||'',
      notificar_por_propuesto:notifPor||prev.notificar_por_propuesto||'',
      canal:'correo',
      enviado_firma_en:new Date().toISOString(),
      enviado_firma_por:typeof taskComentarioAutor==='function'?taskComentarioAutor():''
    });
    if(atajoDirecto){
      tk.firmaWf.listo_firma={por:taskComentarioAutor(),en:new Date().toISOString(),atajo_digital:true};
    }
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'enviar_firma',fecha:hoy(),por:taskComentarioAutor(),nota:atajoDirecto?'Enviado a Por firmar (Director)':'Enviado a Por imprimir / firma del Director'});
  });
  if(ok){
    if(typeof clearAltaResponsableAlAprobarDocumento==='function')
      clearAltaResponsableAlAprobarDocumento(expId,{force:true});
    notif((atajoDirecto?'🖊 Actividad en «Por firmar» (Director)':'🖨 Actividad enviada a «Por imprimir» (firma Director)')+(notifPor?' · Notificará: '+notifPor:''),'ok');
    closeTaskModal();
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  }
}

async function tramitePasarAPorFirmar(expId,taskId){
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(expId,taskId,'por_firmar');}catch(err){console.warn(err);}
  }
  const wf=getTaskFirmaWf(getTaskAny(expId,taskId));
  let notifPor=String(wf.notificar_por||'').trim();
  const sel=document.getElementById('tramite-notif-por-sel');
  if(sel&&sel.value)notifPor=String(sel.value).trim();
  setTaskFirmaWf(expId,taskId,{
    fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar'),
    impreso:{por:taskComentarioAutor(),en:new Date().toISOString()},
    listo_firma:{por:taskComentarioAutor(),en:new Date().toISOString()},
    notificar_por:notifPor
  });
  notif('🖊 Pasó a «Por firmar» (Director)','ok');
  closeTaskModal();
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
}

function tramiteMarcarFirmadoFisico(expId,taskId){
  const puedeDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const atajo=typeof esCargoVital==='function'&&esCargoVital()||typeof esAdministrador==='function'&&esAdministrador()||typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto();
  if(!puedeDir&&!atajo){notif('Solo el Director o VITAL/encargado pueden marcar firmado','err');return;}
  setTaskFirmaWf(expId,taskId,{
    firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString()},
    firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),modo:'fisico'}
  });
  notif('✓ Firmado físico registrado — pase a «Por notificar»','ok');
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderActividades==='function')renderActividades();
  openTaskCommentsModal(expId,taskId);
}

function tramitePasarAPorNotificar(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const wf=getTaskFirmaWf(t);
  if(!(wf.firma_fisica&&wf.firma_fisica.en)){notif('Marque primero como firmado','err');return;}
  const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  let vence=inicio;
  if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
  else{
    const d=new Date(inicio+'T12:00:00');d.setDate(d.getDate()+5);vence=d.toISOString().slice(0,10);
  }
  setTaskFirmaWf(expId,taskId,{
    fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion'),
    notif_inicio:inicio,
    notif_vence:vence,
    notif_plazo_dias:5
  });
  notif('📬 Quedó en «Por notificar»','ok');
  closeTaskModal();
  if(typeof renderActividades==='function')renderActividades();
}

function openTramiteNotificarModal(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  if(!e||!t){notif('No encontrada','err');return;}
  const correos=typeof pqrsCorreosCiudadano==='function'?pqrsCorreosCiudadano(e):[];
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Notificar · '+(e._exp||expId);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const dest=correos.join(', ');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Se notificará a los correos del expediente (interesado, autorizado, apoderado, empresa, representante, establecimiento). El documento quedará visible en consulta ciudadana.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Destinatarios</label><input type="text" id="tramite-notif-to" value="'+escAttr(dest)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Asunto</label><input type="text" id="tramite-notif-asunto" value="'+escAttr('Documento aprobado — expediente '+(e._exp||''))+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Mensaje</label><textarea id="tramite-notif-cuerpo" style="min-height:100px;width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» del expediente '+(e._exp||'')+' ha sido aprobado'+(t.requiereFirma||taskEnFlujoFirmaTramite(t)?' y notificado':'')+'.\n\nPuede consultarlo en la consulta ciudadana de la Corporación CDA.\n\nCordialmente.</textarea></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitTramiteNotificar(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">📬 Notificar y cerrar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={expId,taskId,mode:'tramiteNotificar'};
}

async function submitTramiteNotificar(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  if(!e||!t)return;
  const toRaw=String((document.getElementById('tramite-notif-to')||{}).value||'').trim();
  const asunto=String((document.getElementById('tramite-notif-asunto')||{}).value||'').trim();
  const cuerpo=String((document.getElementById('tramite-notif-cuerpo')||{}).value||'').trim();
  const destinos=toRaw.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
  if(!destinos.length){notif('Indique al menos un correo destino','err');return;}
  const htmlBody='<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">'+escAttr(cuerpo).replace(/\n/g,'<br>')+'</div>';
  try{
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG)return;
    }
    if(typeof pqrsEnviarCorreoCiudadano==='function'){
      await pqrsEnviarCorreoCiudadano(destinos,asunto,htmlBody,true,[],{});
    }else if(typeof gmailSend==='function'){
      for(let i=0;i<destinos.length;i++)await gmailSend(destinos[i],asunto,htmlBody);
    }else{
      notif('No hay envío de correo disponible — se cerrará sin enviar','warn');
    }
  }catch(err){
    notif('No se pudo enviar el correo: '+String(err.message||err).slice(0,100),'err');
    return;
  }
  await finalizarTramiteTrasPublicar(expId,taskId,{via:'notificacion',destinos:destinos});
  notif('📬 Notificado y actividad cerrada','ok');
  closeTaskModal();
}

/** Cierra actividad + publica en consulta ciudadana (+ correo opcional externo). */
async function finalizarTramiteTrasPublicar(expId,taskId,opts){
  opts=opts||{};
  const fechaC=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(expId,taskId,'aprobado');}catch(err){console.warn(err);}
  }
  mutateTask(expId,taskId,function(t){
    normalizeTask(t);
    const repPend=typeof getUltimoReportadoPor==='function'?getUltimoReportadoPor(t):'';
    (t.asignados||[]).forEach(function(a){
      if(a.estado!=='atendido'){
        a.estado='atendido';
        a.fechaAtendida=fechaC;
        if(!a.fechaReportada)a.fechaReportada=fechaC;
      }
    });
    t.fechaReportada=t.fechaReportada||fechaC;
    t.fechaAtendida=fechaC;
    t.estado='Atendida';
    t.publicado=true;
    t.verificadoPor=(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')+' · '+new Date().toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit'});
    t.ultimaRevisionDepto={tipo:'aprobada',fecha:fechaC,por:taskComentarioAutor(),nota:opts.via==='notificacion'?'Aprobada y notificada':'Actividad aprobada y publicada'};
    if(!Array.isArray(t.historial))t.historial=[];
    t.historial.push({tipo:'verificacion',fecha:fechaC,por:taskComentarioAutor(),nota:opts.via==='notificacion'?'Notificación ciudadana':'Publicación en consulta ciudadana',reportadoPor:repPend||''});
    const prev=getTaskFirmaWf(t);
    if(prev.fase||t.requiereFirma){
      t.firmaWf=Object.assign({},prev,{
        fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.CERRADA:'cerrada_atendida'),
        publicado:true,
        notificacion:{en:new Date().toISOString(),a:(opts.destinos||[]).join(', '),por:taskComentarioAutor()}
      });
    }
    if(typeof syncTaskAggregateState==='function')syncTaskAggregateState(t);
  });
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
}

async function notificarCiudadanoTrasVerificarTramite(expId,taskId){
  const e=getExpById(expId);
  if(!e)return;
  const t=getTaskFromExp(e,taskId);
  const actNom=String((t&&(t.actividad||t.desc))||'').trim();
  const esConceptoSeg=/concepto\s+de\s+seguimiento/i.test(actNom);
  let correos=typeof pqrsCorreosCiudadano==='function'?pqrsCorreosCiudadano(e):[];
  // Ampliar: si no hay lista, intentar campos sueltos del expediente
  if(!correos.length){
    const extra=[e._pn_correo,e._pj_correo,e._pj_rep_correo,e._apo_correo,e._aut_correo,e._ec_correo,e._qd_correo];
    const set=new Set();
    extra.forEach(function(em){
      const v=String(em||'').trim().toLowerCase();
      if(v&&v.includes('@')&&(typeof emailValido!=='function'||emailValido(v)))set.add(v);
    });
    correos=Array.from(set);
  }
  if(!correos.length){
    if(esConceptoSeg&&typeof notif==='function')
      notif('Concepto de seguimiento aprobado, pero el expediente no tiene correos registrados para notificar','warn');
    return;
  }
  const expLbl=e._exp||expId;
  let asunto=esConceptoSeg
    ?('Concepto de seguimiento aprobado — expediente '+expLbl)
    :('Documento aprobado — expediente '+expLbl);
  let cuerpo;
  const sop=typeof getSoporteActivo==='function'?getSoporteActivo(t):null;
  const linkDoc=(sop&&(sop.url||sop.preview||sop.driveLink))||'';
  if(esConceptoSeg){
    cuerpo='Estimado(a),\n\nLe informamos que el Concepto de seguimiento del expediente '+expLbl+' ha sido aprobado.\n\n';
    if(linkDoc)cuerpo+='Puede consultar el documento en el siguiente enlace:\n'+linkDoc+'\n\n';
    else cuerpo+='Puede consultarlo en la consulta ciudadana de la Corporación CDA.\n\n';
    cuerpo+='Cordialmente.';
  }else{
    cuerpo='Estimado(a),\n\nLe informamos que se aprobó el documento de la actividad «'+actNom+'» del expediente '+expLbl+'.\n\nPuede consultarlo en la consulta ciudadana.\n\nCordialmente.';
  }
  const html='<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">'+escAttr(cuerpo).replace(/\n/g,'<br>')+'</div>';
  try{
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG){
        if(esConceptoSeg&&typeof notif==='function')
          notif('Concepto aprobado; conecte Gmail para enviar el correo a los interesados','warn');
        return;
      }
    }
    if(typeof pqrsEnviarCorreoCiudadano==='function')
      await pqrsEnviarCorreoCiudadano(correos,asunto,html,true,[],{});
    if(esConceptoSeg&&typeof notif==='function')
      notif('📬 Concepto de seguimiento notificado a '+correos.length+' correo(s)','ok');
  }catch(err){
    console.warn('notificarCiudadanoTrasVerificarTramite:',err);
    if(typeof notif==='function')notif('Actividad cerrada; no se pudo enviar correo: '+String(err.message||err).slice(0,80),'warn');
  }
}

/** Confirmar cierre: si requiere firma → flujo firma; si no → verificar + publicar + correo. */
function confirmarCierreTaskTramiteAware(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskFromExp(e,taskId);
  if(e&&t&&typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e))return false;
  const chk=document.getElementById('task-rev-requiere-firma');
  const quiereFirma=chk?!!chk.checked:taskRequiereFirmaEffective(t,expId);
  if(quiereFirma){
    tramiteEnviarAFirmaDesdeRevision(expId,taskId);
    return true;
  }
  return false;
}

/** Filas sintéticas para la paleta PQRSD del Director (trámites en firma). */
function getTramiteFirmaRowsParaPaletaDirector(modo){
  modo=String(modo||'por_firmar');
  const esDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const tasks=getTareasTramiteFirmaPorFase(function(t){
    if(modo==='firmados')return taskFirmaEsFirmadoPendiente(t);
    if(!taskFirmaEnPorFirmar(t))return false;
    if(esDir&&taskFirmaEsFirmadoPendiente(t))return false;
    return true;
  });
  return tasks.map(function(t){
    const e=typeof getExpById==='function'?getExpById(t.exp||t.codigo):null;
    const nom=e?(typeof getNom==='function'?getNom(e):''):(t.nombre||'');
    return {
      _exp:t.exp||t.codigo,
      _tramite_firma_task:true,
      _taskId:t.id,
      _fecha:t.fechaReportada||t.vence||(e&&e._fecha)||'',
      _tipo_solicitud:'Trámite',
      f_f1:t.actividad||t.desc||'Documento para firma',
      _pn_nombre:nom,
      _qd_nombre:nom,
      _depto:e?e._depto:(t.depto||''),
      _estado:e?e._estado:'En trámite',
      _tramite:e?e._tramite:'',
      _pqrs_oficina:'ds_deguv'
    };
  });
}

/** Modal de firma del Director para trámites (misma UX que PQRSD). */
function openTramiteDirectorFirmarModal(expId,taskId){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  const e=typeof getExpById==='function'?getExpById(expId):null;
  const t=e?getTaskFromExp(e,taskId):null;
  if(!e||!t){notif('Actividad no encontrada','err');return;}
  if(!taskFirmaEnPorFirmar(t)){notif('Esta actividad no está en «Por firmar»','err');return;}
  const esDirector=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const atajo=typeof esCargoVital==='function'&&esCargoVital()||typeof esAdministrador==='function'&&esAdministrador()||typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto();
  if(!esDirector&&!atajo){notif('Solo el Director o VITAL/encargado pueden gestionar la firma','err');return;}
  if(typeof openTaskCommentsModal==='function'){
    openTaskCommentsModal(expId,taskId);
    return;
  }
  tramiteMarcarFirmadoFisico(expId,taskId);
}

window.resolveActividadRequiereFirma=resolveActividadRequiereFirma;
window.getTaskFirmaWf=getTaskFirmaWf;
window.setTaskFirmaWf=setTaskFirmaWf;
window.taskFirmaFase=taskFirmaFase;
window.taskEnFlujoFirmaTramite=taskEnFlujoFirmaTramite;
window.taskFirmaEnParaFirma=taskFirmaEnParaFirma;
window.taskFirmaEnPorFirmar=taskFirmaEnPorFirmar;
window.taskFirmaEsFirmadoPendiente=taskFirmaEsFirmadoPendiente;
window.taskFirmaEnPorNotificar=taskFirmaEnPorNotificar;
window.taskFirmaEstadoUi=taskFirmaEstadoUi;
window.getTareasTramiteFirmaPorFase=getTareasTramiteFirmaPorFase;
window.getTramiteFirmaRowsParaPaletaDirector=getTramiteFirmaRowsParaPaletaDirector;
window.openTramiteDirectorFirmarModal=openTramiteDirectorFirmarModal;
window.taskRequiereFirmaEffective=taskRequiereFirmaEffective;
window.renderTramiteFirmaVerifyExtrasHtml=renderTramiteFirmaVerifyExtrasHtml;
window.tramiteEnviarAFirmaDesdeRevision=tramiteEnviarAFirmaDesdeRevision;
window.tramitePasarAPorFirmar=tramitePasarAPorFirmar;
window.tramiteMarcarFirmadoFisico=tramiteMarcarFirmadoFisico;
window.tramitePasarAPorNotificar=tramitePasarAPorNotificar;
window.openTramiteNotificarModal=openTramiteNotificarModal;
window.submitTramiteNotificar=submitTramiteNotificar;
window.finalizarTramiteTrasPublicar=finalizarTramiteTrasPublicar;
window.notificarCiudadanoTrasVerificarTramite=notificarCiudadanoTrasVerificarTramite;
window.confirmarCierreTaskTramiteAware=confirmarCierreTaskTramiteAware;
