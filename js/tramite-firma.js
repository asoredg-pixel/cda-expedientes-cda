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
/** Contexto de expediente o stub para actividades sin expediente (firma / notificador / Drive). */
function tramiteFirmaExpCtx(t,expId){
  if(t&&t.sinExpediente){
    return{
      _exp:t.codigo||expId||'',
      _fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10),
      _depto:t.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'guaviare'),
      _sin_expediente:true,
      _pn_nombre:'(Sin expediente)',
      tasks:[t],
      _drive_folder_id:t._drive_folder_id||'',
      _drive_folder_link:t._drive_folder_link||''
    };
  }
  const id=expId||(t&&(t.exp||t.codigo))||'';
  return typeof getExpById==='function'?getExpById(id):null;
}
function taskEnFlujoFirmaTramite(t){
  if(!t||t.eliminada)return false;
  if(!t.sinExpediente){
    const e=typeof getExpById==='function'?getExpById(t.exp||t.codigo):null;
    if(e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))return false;
  }
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
    if(taskFirmaEsFirmadoPendiente(t))return{lbl:'Firmado',bg:'#dcfce7',fg:'#15803d',sub:''};
    return{lbl:'Por firmar',bg:'#0d5c2e22',fg:'#0d5c2e',sub:quien?'Notif.: '+quien:''};
  }
  if(taskFirmaEnPorNotificar(t))return{lbl:'Por notificar',bg:'#185FA522',fg:'#185FA5',sub:''};
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
  // Actividades sin expediente en el mismo flujo de firma
  (typeof actividadesLibres!=='undefined'?actividadesLibres:[]).forEach(function(raw){
    const t=typeof normalizeActLibre==='function'?normalizeActLibre(raw):(raw||{});
    if(!t||t.eliminada||!taskEnFlujoFirmaTramite(t))return;
    const eStub=tramiteFirmaExpCtx(t,t.codigo);
    if(matchFn&&!matchFn(t,eStub))return;
    const nt=typeof normalizeTask==='function'?normalizeTask(Object.assign({},t,{
      codigo:t.codigo,exp:t.codigo,
      tram:'Actividad',
      nombre:'(Sin expediente)',
      depto:t.depto||'',
      sinExpediente:true
    })):Object.assign({},t,{exp:t.codigo,sinExpediente:true});
    out.push(nt);
  });
  return out;
}

function taskRequiereFirmaEffective(t,expId){
  if(!t)return false;
  if(t.requiereFirma===true)return true;
  if(t.requiereFirma===false)return false;
  const e=tramiteFirmaExpCtx(t,expId||t.exp||t.codigo);
  return resolveActividadRequiereFirma(t.actividad||t.desc||'',(e&&e._depto)||t.depto);
}

/** Checkbox + botones de firma en la barra de verificación de trámite. */
function renderTramiteFirmaVerifyExtrasHtml(expId,taskId,t){
  if(!t)return'';
  const e=tramiteFirmaExpCtx(t,expId);
  if(e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))return'';
  if(taskEnFlujoFirmaTramite(t)){
    return renderTramiteFirmaGestionHtml(expId,taskId,t);
  }
  // Libres: la decisión (imprimir / firma / cerrar) va en renderTaskVerifyBarHtml
  if(t.sinExpediente)return'';
  const req=taskRequiereFirmaEffective(t,expId);
  const wf=getTaskFirmaWf(t);
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e){
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{modo:'revision',id:'tramite-notif-por-sel',todosResponsables:true,deptoId:e._depto});
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
  const e=tramiteFirmaExpCtx(t,expId);
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e&&(taskFirmaEnParaFirma(t)||taskFirmaEnPorFirmar(t))){
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{modo:'firma',id:'tramite-notif-por-sel',todosResponsables:true,deptoId:e._depto});
  }
  return '<div class="task-cmt-form" style="padding:.65rem;border:1px solid #0d5c2e;border-radius:var(--r);background:#0d5c2e12;margin-bottom:10px">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#0d5c2e">🖊 Flujo de firma (trámite) · '+escAttr(ui.lbl||taskFirmaFase(t))+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">El documento no se publica en consulta ciudadana ni se envía correo hasta notificar.</div>'+
    selNotif+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+btns+'</div></div>';
}

async function tramiteEnviarAFirmaDesdeRevision(expId,taskId,opts){
  opts=opts||{};
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const e=tramiteFirmaExpCtx(t,expId);
  if(e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)){notif('Use el flujo PQRSD','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  let notifPor='';
  const sel=document.getElementById('tramite-notif-por-sel')||document.getElementById('pqrs-notif-por-sel');
  if(sel)notifPor=String(sel.value||'').trim();
  if(!notifPor&&typeof pqrsResolverNotificadorCorreo==='function')
    notifPor=pqrsResolverNotificadorCorreo((e&&e._depto)||t.depto||'guaviare','');
  // opts.modo: 'imprimir' | 'firma' | auto (como PQRSD)
  const modo=String(opts.modo||opts.fase||'').trim().toLowerCase();
  let atajoDirecto;
  if(modo==='imprimir'||modo==='para_firma'||modo==='por_imprimir')atajoDirecto=false;
  else if(modo==='firma'||modo==='por_firmar'||modo==='atajo')atajoDirecto=true;
  else{
    atajoDirecto=(typeof pqrsPuedeAtajoParaFirma==='function'&&pqrsPuedeAtajoParaFirma())
      ||(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())
      ||(typeof esCargoVital==='function'&&esCargoVital());
  }
  const faseDest=atajoDirecto
    ?(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar')
    :(typeof PQRS_WF!=='undefined'?PQRS_WF.PARA_FIRMA:'para_firma');
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(refId,taskId,atajoDirecto?'por_firmar':'por_firma');}catch(err){console.warn('tramite firma rename:',err);}
  }
  const ok=mutateTask(refId,taskId,function(tk){
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
    // Evitar que normalizeTask vuelva a marcar «Por verificar»
    if(tk.estado==='Por verificar')tk.estado='En ejecución';
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'enviar_firma',fecha:hoy(),por:taskComentarioAutor(),nota:atajoDirecto?'Enviado a Por firmar (Director)':'Enviado a Por imprimir / firma del Director'});
  });
  if(ok){
    if(typeof clearAltaResponsableAlAprobarDocumento==='function'&&!t.sinExpediente)
      clearAltaResponsableAlAprobarDocumento(refId,{force:true});
    notif((atajoDirecto?'🖊 Actividad en «Por firmar» (Director)':'🖨 Actividad enviada a «Por imprimir» (firma Director)')+(notifPor?' · Notificará: '+notifPor:''),'ok');
    closeTaskModal();
    const filtroDest=atajoDirecto?'porfirmar':'parafirma';
    try{if(typeof setActFiltro==='function')setActFiltro(filtroDest);}catch(e){}
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
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('No encontrada','err');return;}
  const e=tramiteFirmaExpCtx(t,expId);
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const correos=(!t.sinExpediente&&e&&typeof pqrsCorreosCiudadano==='function')?pqrsCorreosCiudadano(e):[];
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Notificar · '+(t.sinExpediente?(t.codigo||refId):(e&&e._exp)||expId);
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const dest=correos.join(', ');
  const hint=t.sinExpediente
    ?'Indique los correos a notificar. Al confirmar se cierra la actividad (sin expediente no hay publicación en consulta ciudadana).'
    :'Se notificará a los correos del expediente (interesado, autorizado, apoderado, empresa, representante, establecimiento). El documento quedará visible en consulta ciudadana.';
  const asuntoDef=t.sinExpediente
    ?('Documento aprobado — '+(t.actividad||t.desc||t.codigo||'actividad'))
    :('Documento aprobado — expediente '+((e&&e._exp)||''));
  const cuerpoDef=t.sinExpediente
    ?('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» ha sido aprobado'+(t.requiereFirma||taskEnFlujoFirmaTramite(t)?' y notificado':'')+'.\n\nCordialmente.')
    :('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» del expediente '+((e&&e._exp)||'')+' ha sido aprobado'+(t.requiereFirma||taskEnFlujoFirmaTramite(t)?' y notificado':'')+'.\n\nPuede consultarlo en la consulta ciudadana de la Corporación CDA.\n\nCordialmente.');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+hint+'</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Destinatarios</label><input type="text" id="tramite-notif-to" value="'+escAttr(dest)+'" placeholder="'+(t.sinExpediente?'correo1@ejemplo.com, correo2@…':'')+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Asunto</label><input type="text" id="tramite-notif-asunto" value="'+escAttr(asuntoDef)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Mensaje</label><textarea id="tramite-notif-cuerpo" style="min-height:100px;width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+escAttr(cuerpoDef)+'</textarea></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitTramiteNotificar(\''+escAttr(refId)+'\',\''+escAttr(taskId)+'\')">📬 Notificar y cerrar</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={expId:refId,taskId,mode:'tramiteNotificar'};
}

async function submitTramiteNotificar(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t)return;
  const refId=t.sinExpediente?(t.codigo||expId):expId;
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
  await finalizarTramiteTrasPublicar(refId,taskId,{via:'notificacion',destinos:destinos});
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
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const e=t&&!t.sinExpediente?(typeof getExpById==='function'?getExpById(expId):null):null;
  if(e&&t&&typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e))return false;
  const chk=document.getElementById('task-rev-requiere-firma');
  // Sin expediente: «Confirmar y cerrar» no fuerza firma (use botones Para imprimir / Para firma)
  if(t&&t.sinExpediente&&!chk)return false;
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
    if(taskFirmaEsFirmadoPendiente(t))return false;
    return true;
  });
  return tasks.map(function(t){
    const e=t.sinExpediente?null:(typeof getExpById==='function'?getExpById(t.exp||t.codigo):null);
    const nom=e?(typeof getNom==='function'?getNom(e):''):(t.nombre||'(Sin expediente)');
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
      _pqrs_oficina:'ds_deguv',
      _sin_expediente:!!t.sinExpediente
    };
  });
}

/** Modal de firma del Director para trámites (misma UX que PQRSD). */
function openTramiteDirectorFirmarModal(expId,taskId,mode){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  mode=String(mode||'').trim();
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  if(!taskFirmaEnPorFirmar(t)){notif('Esta actividad no está en «Por firmar»','err');return;}
  const esDirector=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const atajo=typeof esCargoVital==='function'&&esCargoVital()||typeof esAdministrador==='function'&&esAdministrador()||typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto();
  if(!esDirector&&!atajo){notif('Solo el Director o VITAL/encargado pueden gestionar la firma','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  // Modos dedicados del Director (misma UX que PQRSD)
  if(esDirector&&(mode==='ver'||mode==='cargar'||mode==='ya_firmado'||mode==='devolver')){
    return openTramiteDirectorAccionModal(refId,taskId,mode);
  }
  if(esDirector){
    return openTramiteDirectorAccionModal(refId,taskId,'ver');
  }
  // VITAL / encargado: flujo previo (comentarios / marcar firmado)
  if(typeof openTaskCommentsModal==='function'){
    openTaskCommentsModal(refId,taskId);
    return;
  }
  tramiteMarcarFirmadoFisico(refId,taskId);
}

function _tramiteDirectorDocUrls(t){
  const sop=typeof getSoporteActivo==='function'?getSoporteActivo(t):null;
  const link=(sop&&(sop.url||sop.preview||sop.driveLink))||'';
  if(!link)return{preview:'',view:'',download:'',nombre:''};
  let preview=link,view=link,download=link;
  if(typeof parseDrivePreviewUrl==='function'){
    const p=parseDrivePreviewUrl(link);
    if(p){
      preview=p.preview||p.url||link;
      view=p.url||link;
      download=p.download||p.url||link;
    }
  }else{
    preview=String(link).replace(/\/view(\?.*)?$/,'/preview');
  }
  return{preview,view,download,nombre:(sop&&(sop.nombre||sop.name))||'Documento'};
}

function openTramiteDirectorAccionModal(expId,taskId,mode){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  if(!(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())&&!(typeof esAdministrador==='function'&&esAdministrador())){
    notif('Solo el Director puede usar esta acción','err');return;
  }
  const e=tramiteFirmaExpCtx(t,expId);
  const wf=getTaskFirmaWf(t);
  const urls=_tramiteDirectorDocUrls(t);
  const quien=String(wf.notificar_por||'').trim()||'— (sin designar)';
  const actNom=String(t.actividad||t.desc||'Actividad').trim();
  const expLbl=t.sinExpediente?(t.codigo||expId):((e&&e._exp)||expId);
  if(typeof abrirPqrsModalPrep==='function')abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(modal){modal.classList.add('task-modal-wide');modal.classList.add('task-modal-firma');}
  const infoReadonly='<div style="padding:10px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px;font-size:12px">'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:6px">Datos de la actividad</div>'+
    '<div style="margin-bottom:4px">Actividad: <strong>'+escAttr(actNom)+'</strong></div>'+
    '<div style="margin-bottom:4px">'+(t.sinExpediente?'Código':'Expediente')+': <strong>'+escAttr(expLbl)+'</strong></div>'+
    '<div>Quién notificará: <strong>'+escAttr(quien)+'</strong></div></div>';
  let preview='';
  if(urls.preview){
    preview='<div style="margin-bottom:12px">'+
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px">Documento a firmar'+(urls.nombre?' — '+escAttr(urls.nombre):'')+'</div>'+
      '<div class="pqrs-firma-preview"><iframe title="Vista del documento" src="'+escAttr(urls.preview)+'"></iframe></div>'+
      '<div class="fx" style="gap:8px;flex-wrap:wrap;margin-top:8px">'+
      '<a class="btn bsm" href="'+escAttr(urls.download||urls.view)+'" target="_blank" rel="noopener" style="background:#0f766e;color:#fff;border-color:#0f766e">⬇ Descargar</a>'+
      (urls.view?'<button type="button" class="btn bsm" onclick="openDriveVentanaEmergente(\''+escAttr(urls.view)+'\')">↗ Abrir en ventana</button>':'')+
      '</div></div>';
  }else{
    preview='<div style="padding:10px;background:var(--rdl);border-radius:var(--r);margin-bottom:12px;font-size:12px">No hay documento de soporte para previsualizar.</div>';
  }
  let histHtml='';
  if(Array.isArray(t.historial)&&t.historial.length){
    histHtml='<div class="pqrs-det-sec"><div class="pqrs-det-k">Historial de la actividad</div>'+
      t.historial.slice(-12).map(function(h){
        return '<div style="font-size:12px;margin-bottom:4px"><strong>'+escAttr(fmtF(h.fecha||''))+'</strong> · '+escAttr(h.tipo||'')+(h.nota?': '+escAttr(h.nota):'')+(h.por?' · '+escAttr(h.por):'')+'</div>';
      }).join('')+'</div>';
  }
  let docsExp='';
  if(e&&!t.sinExpediente&&typeof collectEnlacesExpediente==='function'){
    const links=(collectEnlacesExpediente(e)||[]).filter(function(l){return l&&(l.url||l.link);}).slice(0,20);
    if(links.length){
      docsExp='<div class="pqrs-det-sec"><div class="pqrs-det-k">Documentos del expediente</div>'+
        links.map(function(l){
          return '<div style="font-size:12px;margin-bottom:3px">📄 <a href="'+escAttr(l.url||l.link)+'" target="_blank" rel="noopener">'+escAttr(l.label||l.nombre||l.tipo||'Documento')+'</a></div>';
        }).join('')+'</div>';
    }
  }
  let titulo='Por firmar — '+expLbl;
  let html='';
  if(mode==='ver'){
    titulo='👁 Ver documento — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Documento a firmar (trámite)</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Solo lectura: auto, resolución u otro documento de la actividad. No puede asignar responsable ni asociar.</div>'+
      preview+infoReadonly+docsExp+histHtml+
      '<div class="pqrs-firma-actions"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  }else if(mode==='cargar'){
    titulo='⬆ Cargar documento firmado — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Cargar PDF ya firmado</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Suba el documento firmado para que procedan a notificar. Usted no asigna quién notifica.</div>'+
      preview+infoReadonly+
      '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:#0d5c2e08">'+
      '<button type="button" class="btn bsm bp" onclick="tramiteDirectorAddSignedPdf()">📎 Seleccionar PDF firmado</button>'+
      '<input type="file" id="tramite-director-pdf-file" accept=".pdf,application/pdf" style="display:none" onchange="tramiteDirectorOnSignedPdf(this)">'+
      '<div id="tramite-director-pdf-list" class="pqrs-compose-att-list" style="margin-top:6px"></div></div>'+
      '<div class="pqrs-firma-actions">'+
      '<button type="button" class="btn bsm bp" id="tramite-director-firmar-btn" onclick="tramiteDirectorConfirmarFirmado(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">⬆ Confirmar y pasar a notificar</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }else if(mode==='ya_firmado'){
    titulo='✓ Ya firmado — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Indicar que ya está firmado</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Cuando firmó el documento impreso (sin volver a cargar PDF). No asigna quién notifica; solo puede verlo.</div>'+
      infoReadonly+
      '<div class="pqrs-firma-actions">'+
      '<button type="button" class="btn bsm" style="background:#15803d;color:#fff;border-color:#15803d" onclick="tramiteDirectorMarcarYaFirmado(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">✓ Confirmar ya firmado</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }else if(mode==='devolver'){
    titulo='↩ Devolver documento — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Devolver por error / corrección</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">La actividad volverá a revisión para corregir el documento.</div>'+
      preview+
      '<div style="margin-bottom:12px;padding:10px;border:1px dashed var(--or);border-radius:var(--r);background:#fff7ed">'+
      '<textarea id="tramite-director-devolver-motivo" placeholder="Indique el error o qué debe corregirse…" style="width:100%;min-height:80px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box;font-family:\'DM Sans\',sans-serif"></textarea></div>'+
      '<div class="pqrs-firma-actions">'+
      '<button type="button" class="btn bsm bd2" onclick="tramiteDirectorDevolver(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">↩ Devolver documento</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }
  if(tit)tit.textContent=titulo;
  body.innerHTML=html;
  window._tramiteDirectorSignedFile=null;
  ov.classList.add('on');
  window._taskModalCtx={mode:'tramiteDirectorAccion',accion:mode,expId,taskId};
}

function tramiteDirectorAddSignedPdf(){
  (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
    if(!ok)return;
    const inp=document.getElementById('tramite-director-pdf-file');
    if(inp)inp.click();
  });
}
function tramiteDirectorOnSignedPdf(inp){
  const f=inp&&inp.files&&inp.files[0];
  window._tramiteDirectorSignedFile=f||null;
  const box=document.getElementById('tramite-director-pdf-list');
  if(!box)return;
  if(!f){box.innerHTML='';return;}
  box.innerHTML='<div class="fx" style="gap:6px;align-items:center;font-size:12px;padding:4px 6px;background:var(--sf2);border-radius:var(--r)">📎 '+escAttr(f.name)+
    '<button type="button" class="btn bsm bd2" onclick="window._tramiteDirectorSignedFile=null;document.getElementById(\'tramite-director-pdf-file\').value=\'\';document.getElementById(\'tramite-director-pdf-list\').innerHTML=\'\'">✕</button></div>';
}
function tramiteDirectorMarcarYaFirmado(expId,taskId){
  const puedeDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  if(!puedeDir&&!(typeof esAdministrador==='function'&&esAdministrador())){notif('Solo el Director puede marcar firmado','err');return;}
  setTaskFirmaWf(expId,taskId,{
    firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString()},
    firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),modo:'fisico'}
  });
  closeTaskModal();
  notif('✓ Firmado físico registrado — queda pendiente de notificación','ok');
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderActividades==='function')renderActividades();
}
async function tramiteDirectorConfirmarFirmado(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const file=window._tramiteDirectorSignedFile;
  if(!file){notif('Seleccione el PDF firmado','err');return;}
  const btn=document.getElementById('tramite-director-firmar-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  try{
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG){if(btn){btn.disabled=false;btn.textContent='⬆ Confirmar y pasar a notificar';}return;}
    }
    const e=tramiteFirmaExpCtx(t,expId);
    if(typeof sstCargaShow==='function')sstCargaShow({title:'Cargando PDF firmado',message:'Subiendo documento…',sub:file.name||'PDF',pct:20});
    const up=await tramiteUploadPdfFirmado(file,t,e,expId);
    const pdfLink=up&&(up.driveLink||up.previewLink)||'';
    if(typeof driveRenombrarSoporteActivoExp==='function'){
      try{await driveRenombrarSoporteActivoExp(expId,taskId,'por_notificar');}catch(errR){console.warn(errR);}
    }
    const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    let vence=inicio;
    if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
    setTaskFirmaWf(expId,taskId,{
      fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion'),
      firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),pdfLink:pdfLink,modo:'digital'},
      firma_fisica:null,
      notif_inicio:inicio,
      notif_vence:vence,
      notif_plazo_dias:5
    });
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteDirectorSignedFile=null;
    closeTaskModal();
    notif('📬 Documento firmado — quedó en «Por notificar»','ok');
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof renderActividades==='function')renderActividades();
  }catch(err){
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('Error: '+String(err.message||err).slice(0,100),'err');
    if(btn){btn.disabled=false;btn.textContent='⬆ Confirmar y pasar a notificar';}
  }
}
function tramiteDirectorDevolver(expId,taskId){
  const motivo=String((document.getElementById('tramite-director-devolver-motivo')||{}).value||'').trim();
  if(!motivo){notif('Indique el motivo de la devolución','err');return;}
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'DS DEGUV';
  setTaskFirmaWf(expId,taskId,{
    fase:'',
    firma_fisica:null,
    firma_director:null,
    listo_firma:null,
    impreso:null,
    devolucion_director:{por:por,en:new Date().toISOString(),motivo:motivo}
  });
  mutateTask(expId,taskId,function(tk){
    if(!tk)return;
    tk.fechaAtendida='';
    tk.verificadoPor='';
    tk.ultimaRevisionDepto=null;
    const fr=tk.fechaReportada||(typeof hoy==='function'?hoy():'');
    tk.fechaReportada=fr;
    tk.estado='Por verificar';
    if(!Array.isArray(tk.comentarios))tk.comentarios=[];
    tk.comentarios.push({autor:por,fecha:new Date().toISOString(),texto:'[Devolución Director — por firmar] '+motivo,rol:'asignador',incluidoEnReporte:false});
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'devuelto_director_firma',fecha:typeof hoy==='function'?hoy():'',ts:Date.now(),por:por,nota:motivo});
    if(typeof syncTaskAggregateState==='function')syncTaskAggregateState(tk);
  });
  closeTaskModal();
  notif('↩ Documento devuelto — vuelve a revisión','ok');
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderActividades==='function')renderActividades();
}

window.openTramiteDirectorAccionModal=openTramiteDirectorAccionModal;
window.tramiteDirectorAddSignedPdf=tramiteDirectorAddSignedPdf;
window.tramiteDirectorOnSignedPdf=tramiteDirectorOnSignedPdf;
window.tramiteDirectorMarcarYaFirmado=tramiteDirectorMarcarYaFirmado;
window.tramiteDirectorConfirmarFirmado=tramiteDirectorConfirmarFirmado;
window.tramiteDirectorDevolver=tramiteDirectorDevolver;

window.resolveActividadRequiereFirma=resolveActividadRequiereFirma;
window.tramiteFirmaExpCtx=tramiteFirmaExpCtx;
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
function tramiteLibreParaImprimir(expId,taskId){
  return tramiteEnviarAFirmaDesdeRevision(expId,taskId,{modo:'imprimir'});
}
function tramiteLibreParaFirma(expId,taskId){
  return tramiteEnviarAFirmaDesdeRevision(expId,taskId,{modo:'firma'});
}
window.tramiteLibreParaImprimir=tramiteLibreParaImprimir;
window.tramiteLibreParaFirma=tramiteLibreParaFirma;

/**
 * Atajo desde Por revisar: documento ya firmado → subir PDF (opcional) → Por notificar.
 * No pasa por Por imprimir / Por firmar.
 */
function openTramiteAtajoFirmadoModal(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const e=tramiteFirmaExpCtx(t,expId);
  if(e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)){notif('Use el flujo PQRSD','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Cargar firmado → Por notificar';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const eid=escAttr(refId),tid=escAttr(taskId);
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Pasadizo desde revisión: el documento <strong>ya está firmado</strong>. Suba el PDF firmado (recomendado) o confirme sin archivo; la actividad irá a <strong>Por notificar</strong>.</div>'+
    '<div style="margin-bottom:12px;padding:10px;border:1px dashed #0f766e;border-radius:var(--r);background:#0f766e12">'+
    '<input type="file" id="tramite-atajo-firmado-file" accept="application/pdf,.pdf" style="display:none" onchange="tramiteAtajoFirmadoOnPdf(this)">'+
    '<button type="button" class="btn bsm" style="background:#0f766e;color:#fff;border-color:#0f766e" onclick="tramiteAtajoFirmadoPickPdf()">📎 Seleccionar PDF firmado</button>'+
    '<div id="tramite-atajo-firmado-list" style="margin-top:8px"></div></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" id="tramite-atajo-firmado-btn" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false)">⬆ Cargar y pasar a Por notificar</button>'+
    '<button type="button" class="btn bsm" style="background:#15803d;color:#fff;border-color:#15803d" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',true)">✓ Ya firmado (sin PDF) → Por notificar</button>'+
    '<button type="button" class="btn bsm" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false,true)">📬 Cargar y notificar ahora</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  window._tramiteAtajoFirmadoFile=null;
  ov.classList.add('on');
  window._taskModalCtx={expId:refId,taskId,mode:'tramiteAtajoFirmado'};
}
function tramiteAtajoFirmadoDesdeRevision(expId,taskId){
  openTramiteAtajoFirmadoModal(expId,taskId);
}
function tramiteAtajoFirmadoPickPdf(){
  (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){
    if(!ok)return;
    const inp=document.getElementById('tramite-atajo-firmado-file');
    if(inp)inp.click();
  });
}
function tramiteAtajoFirmadoOnPdf(inp){
  const f=inp&&inp.files&&inp.files[0];
  window._tramiteAtajoFirmadoFile=f||null;
  const box=document.getElementById('tramite-atajo-firmado-list');
  if(!box)return;
  if(!f){box.innerHTML='';return;}
  box.innerHTML='<div class="fx" style="gap:6px;align-items:center;font-size:12px;padding:4px 6px;background:var(--sf2);border-radius:var(--r)">📎 '+escAttr(f.name)+
    '<button type="button" class="btn bsm bd2" onclick="window._tramiteAtajoFirmadoFile=null;var i=document.getElementById(\'tramite-atajo-firmado-file\');if(i)i.value=\'\';document.getElementById(\'tramite-atajo-firmado-list\').innerHTML=\'\'">✕</button></div>';
}
/**
 * Sube PDF firmado usando el token de la cuenta conectada (oficina/NCA o Secretaría).
 * Trámites → carpeta EXP-…; libres → carpeta ACT-…; no exige Secretaría en línea.
 */
async function tramiteUploadPdfFirmado(file,t,e,refId){
  if(!file)return null;
  const autor=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  const ctx=e||tramiteFirmaExpCtx(t,refId)||{_exp:refId,_sin_expediente:!!(t&&t.sinExpediente)};
  if(typeof driveUploadExpedienteActividad==='function'){
    return await driveUploadExpedienteActividad(file,file.name||'firmado.pdf','application/pdf',ctx,t,autor,'por_notificar');
  }
  const folderId=ctx._drive_folder_id||(t&&t._drive_folder_id)||'';
  if(folderId&&typeof driveUploadInstitutional==='function'){
    return await driveUploadInstitutional(
      file,
      'por_notificar-'+(file.name||'firmado.pdf'),
      'application/pdf',
      'respuesta_aprobada',
      refId,
      (ctx._pn_nombre||ctx._exp)||refId,
      ctx._fecha||'',
      {expediente:ctx,uploadTarget:'respuesta',folderId:folderId,folderLink:ctx._drive_folder_link||''}
    );
  }
  throw new Error('No se pudo subir: conecte su Gmail/Drive de oficina (no requiere Secretaría) o use «Ya firmado (sin PDF)».');
}

async function tramiteAtajoFirmadoConfirmar(expId,taskId,sinPdf,abrirNotif){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const e=tramiteFirmaExpCtx(t,expId);
  if(e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)){notif('Use el flujo PQRSD','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const file=window._tramiteAtajoFirmadoFile;
  if(!sinPdf&&!file){notif('Seleccione el PDF firmado o use «Ya firmado (sin PDF)»','err');return;}
  let notifPor='';
  const sel=document.getElementById('tramite-notif-por-sel')||document.getElementById('pqrs-notif-por-sel');
  if(sel)notifPor=String(sel.value||'').trim();
  if(!notifPor&&typeof pqrsResolverNotificadorCorreo==='function')
    notifPor=pqrsResolverNotificadorCorreo((e&&e._depto)||t.depto||'guaviare','');
  const btn=document.getElementById('tramite-atajo-firmado-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  try{
    let pdfLink='';
    if(file){
      if(typeof sstSolicitarGmailParaAdjuntar==='function'){
        const okG=await sstSolicitarGmailParaAdjuntar();
        if(!okG){
          if(btn){btn.disabled=false;btn.textContent='⬆ Cargar y pasar a Por notificar';}
          return;
        }
      }
      if(typeof sstCargaShow==='function')sstCargaShow({title:'Cargando PDF firmado',message:'Subiendo documento…',sub:file.name||'PDF',pct:20});
      const res=await tramiteUploadPdfFirmado(file,t,e,refId);
      pdfLink=res&&(res.driveLink||res.previewLink)||'';
      // Registrar soporte en la actividad si hay fileId
      if(res&&(res.fileId||res.driveFileId)){
        mutateTask(refId,taskId,function(tk){
          if(!Array.isArray(tk.soportes))tk.soportes=[];
          tk.soportes.push({
            id:'sop_'+Date.now(),
            nombre:res.nombre||file.name||'firmado.pdf',
            driveFileId:res.fileId||res.driveFileId,
            driveLink:res.driveLink||'',
            previewLink:res.previewLink||res.driveLink||'',
            driveInstitutional:true,
            driveEstado:'por_notificar',
            por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
            en:new Date().toISOString()
          });
          if(res.folderId&&!tk._drive_folder_id){
            tk._drive_folder_id=res.folderId;
            tk._drive_folder_link=res.folderLink||'';
          }
        });
      }
    }
    if(typeof driveRenombrarSoporteActivoExp==='function'){
      try{await driveRenombrarSoporteActivoExp(refId,taskId,'por_notificar');}catch(errR){console.warn(errR);}
    }
    const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    let vence=inicio;
    if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
    else{
      const d=new Date(inicio+'T12:00:00');d.setDate(d.getDate()+5);vence=d.toISOString().slice(0,10);
    }
    const faseNotif=typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion';
    const ok=mutateTask(refId,taskId,function(tk){
      tk.requiereFirma=true;
      const prev=getTaskFirmaWf(tk);
      tk.firmaWf=Object.assign({},prev,{
        fase:faseNotif,
        notificar_por:notifPor||prev.notificar_por||'',
        notificar_por_propuesto:notifPor||prev.notificar_por_propuesto||'',
        canal:'correo',
        firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString(),atajo_revision:true},
        firma_director:{
          por:taskComentarioAutor(),
          en:new Date().toISOString(),
          modo:pdfLink?'digital':'fisico',
          pdfLink:pdfLink||'',
          atajo_desde_revision:true
        },
        notif_inicio:inicio,
        notif_vence:vence,
        notif_plazo_dias:5,
        enviado_firma_en:prev.enviado_firma_en||new Date().toISOString(),
        enviado_firma_por:prev.enviado_firma_por||(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')
      });
      if(tk.estado==='Por verificar')tk.estado='En ejecución';
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({
        tipo:'atajo_firmado_revision',
        fecha:inicio,
        por:taskComentarioAutor(),
        nota:pdfLink
          ?('Atajo: documento firmado cargado → Por notificar'+(pdfLink?' · '+pdfLink:''))
          :'Atajo: ya firmado (sin PDF) → Por notificar'
      });
    });
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteAtajoFirmadoFile=null;
    if(!ok){notif('No se pudo actualizar la actividad','err');return;}
    notif('📬 Documento firmado — quedó en «Por notificar»'+(notifPor?' · Notificará: '+notifPor:''),'ok');
    try{if(typeof setActFiltro==='function')setActFiltro('pornotif');}catch(eF){}
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(abrirNotif){
      openTramiteNotificarModal(refId,taskId);
    }else{
      closeTaskModal();
    }
  }catch(err){
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('Error: '+String(err.message||err).slice(0,120),'err');
    if(btn){btn.disabled=false;btn.textContent='⬆ Cargar y pasar a Por notificar';}
  }
}
window.tramiteUploadPdfFirmado=tramiteUploadPdfFirmado;
window.openTramiteAtajoFirmadoModal=openTramiteAtajoFirmadoModal;
window.tramiteAtajoFirmadoDesdeRevision=tramiteAtajoFirmadoDesdeRevision;
window.tramiteAtajoFirmadoPickPdf=tramiteAtajoFirmadoPickPdf;
window.tramiteAtajoFirmadoOnPdf=tramiteAtajoFirmadoOnPdf;
window.tramiteAtajoFirmadoConfirmar=tramiteAtajoFirmadoConfirmar;
