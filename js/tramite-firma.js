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
function taskFirmaEnRevisionFinalNotif(t){
  const f=taskFirmaFase(t);
  return f===(typeof PQRS_WF!=='undefined'?PQRS_WF.REVISION_FINAL:'revision_final_nca');
}
/** Oficina dueña de un documento de firma (oficios de RN/OAP/Admin/Secretaría, no PQRSD). */
function tramiteFirmaOficinaId(t){
  if(!t)return'';
  const ofi=String(t.oficina||'').trim();
  if(ofi)return ofi;
  if(t.origen==='oficina_firma'&&t.depto&&typeof OFICINAS_DEGUV!=='undefined'&&OFICINAS_DEGUV.some(function(o){return o.id===t.depto;}))
    return String(t.depto);
  return'';
}
/** Oficinas RN/OAP/Admin/Secretaría: entregar oficios no-PQRSD a firma del Director. */
function puedeEntregarOficinaParaFirma(){
  if(typeof esAdministrador==='function'&&esAdministrador()&&typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv()&&typeof deptoActivo!=='undefined'&&deptoActivo!=='ds_deguv')return true;
  if(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv()&&typeof deptoActivo!=='undefined'&&deptoActivo!=='ds_deguv')return true;
  if(typeof esSecretaria==='function'&&esSecretaria())return true;
  return false;
}
/** Oficina puede gestionar firma/notificación de su propio documento (no PQRSD). */
function tramitePuedeGestionarComoOficina(t){
  if(!t||!puedeEntregarOficinaParaFirma())return false;
  const ofi=tramiteFirmaOficinaId(t);
  if(!ofi)return false;
  const act=typeof getPqrsOficinaActiva==='function'?String(getPqrsOficinaActiva()||'').trim():String(typeof deptoActivo!=='undefined'?deptoActivo:'');
  return ofi===act;
}
/** VITAL o Encargado del depto de la actividad pueden notificar por correo. */
function tramitePuedeNotificarCorreo(t){
  if(typeof esCargoVital==='function'&&esCargoVital())return true;
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(tramitePuedeGestionarComoOficina(t))return true;
  const depto=String((t&&t.depto)||(typeof deptoActivo!=='undefined'?deptoActivo:'')||'guaviare').trim()||'guaviare';
  if(typeof esEncargadoDeptoUsuario==='function'&&esEncargadoDeptoUsuario(depto))return true;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto()){
    const enc=typeof getEncargadoDepto==='function'?String(getEncargadoDepto(depto)||'').trim():'';
    const yo=typeof responsableActivo!=='undefined'?String(responsableActivo||'').trim():'';
    if(enc&&yo&&typeof agendaNorm==='function'&&agendaNorm(enc)===agendaNorm(yo))return true;
    if(enc&&!yo)return true; // vista depto del encargado
  }
  const enc=typeof getEncargadoDepto==='function'?String(getEncargadoDepto(depto)||'').trim():'';
  const yo=typeof responsableActivo!=='undefined'?String(responsableActivo||'').trim():'';
  if(enc&&yo&&typeof agendaNorm==='function'&&agendaNorm(enc)===agendaNorm(yo))return true;
  return false;
}
/** Quién puede abrir el modal «Notificar» de un trámite en Por notificar. */
function tramitePuedeNotificar(t){
  if(!t||t.eliminada)return false;
  if(!taskFirmaEnPorNotificar(t)&&!taskFirmaEnRevisionFinalNotif(t))return false;
  if(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())return false;
  if(tramitePuedeGestionarComoOficina(t))return true;
  if(taskFirmaEnRevisionFinalNotif(t)){
    return !!(typeof esNcaDeguv==='function'&&esNcaDeguv())
      ||(typeof esAdministrador==='function'&&esAdministrador())
      ||(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())
      ||tramitePuedeNotificarCorreo(t);
  }
  if(typeof esCargoVital==='function'&&esCargoVital())return true;
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(typeof esNcaDeguv==='function'&&esNcaDeguv())return true;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())return true;
  const wf=getTaskFirmaWf(t);
  const notifPor=String(wf.notificar_por||'').trim();
  if(typeof esModoResponsable==='function'&&esModoResponsable()&&typeof responsableActivo!=='undefined'&&responsableActivo){
    // Solo si está designado como notificador (sin designación → solo «Atendidas»)
    if(!notifPor)return false;
    if(typeof agendaNorm==='function')return agendaNorm(notifPor)===agendaNorm(responsableActivo);
    return notifPor===responsableActivo;
  }
  return false;
}
function taskFirmaEstadoUi(t){
  if(!taskEnFlujoFirmaTramite(t)&&!taskFirmaFase(t)&&!taskFirmaEnRevisionFinalNotif(t))return null;
  const f=taskFirmaFase(t);
  const subPend=typeof _actEstSubPendienteUi==='function'?_actEstSubPendienteUi:function(s){return{sub:s,subFg:'#a16207',subBg:'#fef9c3'};};
  if(taskFirmaEnParaFirma(t)||taskFirmaEnPorFirmar(t)){
    if(taskFirmaEnPorFirmar(t)&&taskFirmaEsFirmadoPendiente(t))
      return Object.assign({lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Notificar'));
    return Object.assign({lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Firma'));
  }
  if(taskFirmaEnPorNotificar(t)||taskFirmaEnRevisionFinalNotif(t))
    return Object.assign({lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Notificar'));
  if(f==='cerrada_atendida'||(typeof PQRS_WF!=='undefined'&&f===PQRS_WF.CERRADA))
    return{lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)',sub:'✓ Notificada',subFg:'var(--gn)'};
  return null;
}
/**
 * Marca como atendida la participación de quienes proyectaron (trámite/libre),
 * excepto el notificador designado en fase de notificación.
 */
function tramiteSincronizarParticipacionPostAprobacionFirma(t){
  if(!t||!(typeof taskEnFlujoFirmaTramite==='function'?taskEnFlujoFirmaTramite(t):!!taskFirmaFase(t)))return;
  if(typeof normalizeTask==='function')normalizeTask(t);
  if(typeof migrateLegacyAsignados==='function')migrateLegacyAsignados(t);
  const wf=getTaskFirmaWf(t);
  const notifPor=String(wf.notificar_por||'').trim();
  const enNotif=typeof taskFirmaEnPorNotificar==='function'&&taskFirmaEnPorNotificar(t);
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const nombres=new Set();
  (t.responsables||[]).forEach(function(n){if(n)nombres.add(String(n).trim());});
  if(wf.entregado_por)nombres.add(String(wf.entregado_por).trim());
  nombres.forEach(function(n){
    if(!n)return;
    const a=typeof ensureAsignado==='function'?ensureAsignado(t,n):null;
    if(!a)return;
    const esNotif=enNotif&&notifPor&&typeof agendaNorm==='function'&&agendaNorm(notifPor)===agendaNorm(n);
    if(esNotif){
      a.fechaAtendida='';
      if(a.estado==='atendido')a.estado=a.fechaReportada?'por_verificar':'pendiente';
    }else{
      if(!a.fechaReportada)a.fechaReportada=hoyStr;
      a.fechaAtendida=a.fechaAtendida||hoyStr;
      a.estado='atendido';
    }
  });
  t._firma_proyeccion_atendida=true;
  if(!Array.isArray(t.historial))t.historial=[];
  if(!t.historial.some(function(h){return h&&h.tipo==='firma_proyeccion_atendida';})){
    t.historial.push({
      tipo:'firma_proyeccion_atendida',
      fecha:hoyStr,
      por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
      nota:'Proyección aprobada — participación atendida; flujo firma/notif sigue abierto'
    });
  }
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
  if(typeof getTaskSolicitudPendiente==='function'&&getTaskSolicitudPendiente(t))return'';
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
  if(taskFirmaEnParaFirma(t)||taskFirmaEnPorFirmar(t)){
    const enPorFirmar=taskFirmaEnPorFirmar(t);
    const puedeImp=typeof pqrsPuedeFlujoPorImprimir==='function'&&pqrsPuedeFlujoPorImprimir();
    if(puedeImp){
      if(typeof actImpresoCheckBtnHtml==='function')
        btns+=actImpresoCheckBtnHtml(wf.impreso,"tramiteMarcarImpreso('"+eid+"','"+tid+"')")+' ';
      else{
        const imp=!!(wf.impreso&&wf.impreso.en);
        btns+='<button type="button" class="btn bsm" style="background:#1a7a4a;color:#fff" onclick="tramiteMarcarImpreso(\''+eid+'\',\''+tid+'\')">'+(imp?'✓ 🖨 Impreso':'🖨 Marcar impreso')+'</button> ';
      }
    }else if(!enPorFirmar) btns+='<span style="font-size:11px;color:var(--tx2)">Pendiente VITAL / encargado</span> ';
    if(enPorFirmar){
      if(taskFirmaEsFirmadoPendiente(t)){
        btns+='<button type="button" class="btn bsm bp" onclick="tramitePasarAPorNotificar(\''+eid+'\',\''+tid+'\')">📬 Pasar a por notificar</button> ';
      }else if(typeof pqrsPuedeFirmarDirector==='function'&&pqrsPuedeFirmarDirector({})){
        btns+='<button type="button" class="btn bsm bp" style="background:#0d5c2e;border-color:#0d5c2e" onclick="tramiteMarcarFirmadoFisico(\''+eid+'\',\''+tid+'\')">🖊 Marcar firmado</button> ';
      }else{
        btns+='<button type="button" class="btn bsm" onclick="tramiteMarcarFirmadoFisico(\''+eid+'\',\''+tid+'\')">⬆ Cargar / marcar firmado</button> ';
      }
    }
  }else if(taskFirmaEnPorNotificar(t)){
    if(typeof tramitePuedeNotificar==='function'?tramitePuedeNotificar(t):true)
      btns+='<button type="button" class="btn bsm bp" onclick="openTramiteNotificarModal(\''+eid+'\',\''+tid+'\')">📬 Notificar ciudadano</button> ';
    else{
      const quien=String(wf.notificar_por||'').trim();
      btns+='<span class="bdg" style="background:#185fa522;color:var(--bl);font-size:10px">📬 '+(quien?'Notifica: '+escAttr(quien):'Por notificar')+'</span> ';
    }
  }else if(taskFirmaEnRevisionFinalNotif(t)){
    if(tramitePuedeNotificar(t))
      btns+='<button type="button" class="btn bsm" style="background:#6d3fa8;color:#fff" onclick="tramiteAprobarRevisionFinalNotif(\''+eid+'\',\''+tid+'\')">✅ Aprobar notificación</button> ';
    else btns+='<span style="font-size:11px;color:var(--tx2)">Pendiente revisión del departamento</span> ';
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
  // opts.modo: 'imprimir' | 'firma' — ambos van a «Por firmar» (impreso se marca con 🖨️ en paleta)
  const modo=String(opts.modo||opts.fase||'').trim().toLowerCase();
  const esImprimir=modo==='imprimir'||modo==='para_firma'||modo==='por_imprimir';
  const esFirmaAtajo=modo==='firma'||modo==='por_firmar'||modo==='atajo';
  const faseDest=(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar');
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(refId,taskId,'por_firmar');}catch(err){console.warn('tramite firma rename:',err);}
  }
  const ok=mutateTask(refId,taskId,function(tk){
    tk.requiereFirma=true;
    const prev=getTaskFirmaWf(tk);
    const patch={
      fase:faseDest,
      notificar_por:notifPor||prev.notificar_por||'',
      notificar_por_propuesto:notifPor||prev.notificar_por_propuesto||'',
      canal:'correo',
      enviado_firma_en:new Date().toISOString(),
      enviado_firma_por:typeof taskComentarioAutor==='function'?taskComentarioAutor():''
    };
    if(esFirmaAtajo&&!esImprimir){
      patch.listo_firma={por:taskComentarioAutor(),en:new Date().toISOString(),atajo_digital:true};
    }
    tk.firmaWf=Object.assign({},prev,patch);
    if(tk.estado==='Por verificar')tk.estado='En ejecución';
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({
      tipo:'enviar_firma',
      fecha:hoy(),
      por:taskComentarioAutor(),
      nota:esImprimir?'Enviado a «Por firmar» (pendiente impresión)':'Enviado a «Por firmar» (Director)'
    });
    tramiteSincronizarParticipacionPostAprobacionFirma(tk);
  });
  if(ok){
    if(typeof clearAltaResponsableAlAprobarDocumento==='function'&&!t.sinExpediente)
      clearAltaResponsableAlAprobarDocumento(refId,{force:true});
    notif((esImprimir?'🖨 En «Por firmar» — marque impreso cuando corresponda':'🖊 En «Por firmar» (Director)')+(notifPor?' · Notificará: '+notifPor:''),'ok');
    if(opts.keepOpen&&typeof taskReviewRefreshModal==='function'){
      if(opts.closeSide&&typeof taskReviewCloseSidePanel==='function')taskReviewCloseSidePanel();
      taskReviewRefreshModal(refId,taskId,opts.closeSide?'doc':'decision');
    }else{
      closeTaskModal();
      try{if(typeof setActFiltro==='function')setActFiltro('porfirma');}catch(e){}
    }
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  }
}

function tramiteMarcarImpreso(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t||!(taskFirmaEnPorFirmar(t)||taskFirmaEnParaFirma(t))){notif('Solo en fase Por firmar','err');return;}
  if(typeof pqrsPuedeFlujoPorImprimir==='function'&&!pqrsPuedeFlujoPorImprimir()){
    notif('No puede marcar impreso','err');return;
  }
  const wf=getTaskFirmaWf(t);
  if(wf.impreso&&wf.impreso.en){
    notif('Ya estaba marcado como impreso','ok');
    return;
  }
  setTaskFirmaWf(expId,taskId,{
    impreso:{por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',en:new Date().toISOString()}
  });
  notif('✓ Marcado como impreso','ok');
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
}

async function tramitePasarAPorFirmar(expId,taskId){
  if(typeof driveRenombrarSoporteActivoExp==='function'){
    try{await driveRenombrarSoporteActivoExp(expId,taskId,'por_firmar');}catch(err){console.warn(err);}
  }
  const wf=getTaskFirmaWf(getTaskAny(expId,taskId));
  let notifPor=String(wf.notificar_por||'').trim();
  const sel=document.getElementById('tramite-notif-por-sel');
  if(sel&&sel.value)notifPor=String(sel.value).trim();
  const yaImp=!!(wf.impreso&&wf.impreso.en);
  setTaskFirmaWf(expId,taskId,{
    fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar'),
    impreso:yaImp?wf.impreso:{por:taskComentarioAutor(),en:new Date().toISOString()},
    listo_firma:{por:taskComentarioAutor(),en:new Date().toISOString()},
    notificar_por:notifPor
  });
  notif('🖊 Pasó a «Por firmar» (Director)','ok');
  closeTaskModal();
  try{if(typeof setActFiltro==='function')setActFiltro('porfirma');}catch(e){}
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
}

function tramitePuedeAtajoFirmaGestion(t){
  if(typeof esCargoVital==='function'&&esCargoVital())return true;
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())return true;
  if(t&&tramitePuedeGestionarComoOficina(t))return true;
  if(!t&&puedeEntregarOficinaParaFirma())return true;
  return false;
}
function tramiteMarcarFirmadoFisico(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const puedeDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const atajo=tramitePuedeAtajoFirmaGestion(t);
  if(!puedeDir&&!atajo){notif('Solo el Director, VITAL, encargado u oficina dueña pueden marcar firmado','err');return;}
  setTaskFirmaWf(expId,taskId,{
    firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString()},
    firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),modo:'fisico'}
  });
  notif('✓ Firmado físico registrado — pase a «Por notificar»','ok');
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderActividades==='function')renderActividades();
  if(typeof openTaskCommentsModal==='function')openTaskCommentsModal(expId,taskId);
}

function tramitePasarAPorNotificar(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const wf=getTaskFirmaWf(t);
  if(!(wf.firma_fisica&&wf.firma_fisica.en)){notif('Marque primero como firmado','err');return;}
  const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const canal=String(wf.canal||'correo').trim();
  const notifPor=String(wf.notificar_por||wf.notificar_por_propuesto||'').trim();
  const esCorreo=canal==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO);
  const sinPlazo=esCorreo&&(
    !notifPor
    ||(typeof tramitePuedeNotificarCorreo==='function'&&tramitePuedeNotificarCorreo(t))
    ||(typeof pqrsNombreEsVital==='function'&&pqrsNombreEsVital(notifPor))
  );
  let vence='';
  if(!sinPlazo){
    if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
    else if(typeof addDiasHabilesCO==='function')vence=addDiasHabilesCO(inicio,5);
    else{
      const d=new Date(inicio+'T12:00:00');d.setDate(d.getDate()+5);vence=d.toISOString().slice(0,10);
    }
  }
  const patch={
    fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion'),
    notif_inicio:inicio,
    notif_vence:vence,
    notif_plazo_dias:sinPlazo?0:5,
    notif_sin_plazo:!!sinPlazo
  };
  // Correo VITAL/encargado: no autoasignar
  if(notifPor&&!sinPlazo)patch.notificar_por=notifPor;
  else if(notifPor&&sinPlazo)patch.notificar_por_propuesto=notifPor;
  setTaskFirmaWf(expId,taskId,patch);
  if(typeof mutateTask==='function'){
    mutateTask(expId,taskId,function(tk){tramiteSincronizarParticipacionPostAprobacionFirma(tk);});
  }
  notif(sinPlazo?'📬 Por notificar (correo · sin plazo de 5 días)':'📬 Quedó en «Por notificar»','ok');
  closeTaskModal();
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
}

function tramiteDocsFirmadosHtml(t,wf){
  const items=[];
  const seen=new Set();
  const push=function(label,link){
    const u=String(link||'').trim();
    if(!u||seen.has(u))return;
    seen.add(u);
    items.push({label:label||'Documento',link:u});
  };
  (wf&&wf.documentos||[]).forEach(function(d){
    if(!d)return;
    push(d.nombre||d.tipo||'Documento',d.driveLink||d.previewLink||d.url);
  });
  (t&&t.soportes||[]).forEach(function(s){
    if(!s)return;
    push(s.nombre||s.label||'Soporte',s.driveLink||s.previewLink||s.url);
  });
  if(!items.length)return'<div style="font-size:11px;color:var(--tx3)">Sin documento firmado cargado aún. Puede subir el oficio notificado abajo.</div>';
  return items.map(function(d){
    return'<div style="font-size:11px;margin-top:3px">📎 <a href="'+escAttr(d.link)+'" target="_blank" rel="noopener">'+escAttr(d.label)+'</a></div>';
  }).join('');
}

function openTramiteNotificarModal(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('No encontrada','err');return;}
  if(typeof tramitePuedeNotificar==='function'&&!tramitePuedeNotificar(t)){
    notif('No puede notificar esta actividad (revise quién está designado)','err');
    return;
  }
  if(taskFirmaEnRevisionFinalNotif(t)){
    return tramiteAprobarRevisionFinalNotif(expId,taskId);
  }
  const e=tramiteFirmaExpCtx(t,expId);
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const wf=getTaskFirmaWf(t);
  const puedeCorreo=tramitePuedeNotificarCorreo(t);
  let canal=String(wf.canal||'').trim();
  if(!canal||(!puedeCorreo&&(canal==='correo'||canal===(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.CORREO:'correo')))){
    canal=(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.PRESENCIAL:'presencial');
  }
  if(puedeCorreo&&!canal)canal=(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.CORREO:'correo');
  const correos=(!t.sinExpediente&&e&&typeof pqrsCorreosCiudadano==='function')?pqrsCorreosCiudadano(e):[];
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Por notificar · '+(t.sinExpediente?(t.codigo||refId):((e&&e._exp)||expId));
  if(modal){modal.classList.add('task-modal-wide');modal.classList.remove('enviar-modal-only');}
  const notifAsignado=String(wf.notificar_por||'').trim();
  const sinPlazo=!!wf.notif_sin_plazo||(puedeCorreo&&(!wf.notif_vence||!notifAsignado));
  const plazo=(!sinPlazo&&wf.notif_vence)?('<span style="color:'+(wf.notif_vence<(typeof hoy==='function'?hoy():'')?'var(--rd)':'var(--bl)')+'">Plazo: <strong>'+(typeof fmtF==='function'?fmtF(wf.notif_vence):wf.notif_vence)+'</strong> (5 días hábiles).</span>'):(sinPlazo&&puedeCorreo?'<span style="color:var(--tx2)">Correo VITAL/encargado: sin plazo de 5 días ni autoasignación.</span>':'');
  const dest=correos.join(', ');
  const asuntoDef=t.sinExpediente
    ?('Documento aprobado — '+(t.actividad||t.desc||t.codigo||'actividad'))
    :('Documento aprobado — expediente '+((e&&e._exp)||''));
  const cuerpoDef=t.sinExpediente
    ?('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» ha sido aprobado y notificado.\n\nCordialmente.')
    :('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» del expediente '+((e&&e._exp)||'')+' ha sido aprobado y notificado.\n\nPuede consultarlo en la consulta ciudadana de la Corporación CDA.\n\nCordialmente.');
  const isCorreo=canal==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO);
  let canalBtns='';
  if(puedeCorreo){
    canalBtns+='<button type="button" class="btn bsm canal-resp-btn'+(isCorreo?' on':'')+'" data-val="correo" onclick="tramiteNotifSetCanal(\'correo\')">📧 Correo</button>';
  }
  canalBtns+=
    '<button type="button" class="btn bsm canal-resp-btn'+(!isCorreo&&canal==='presencial'?' on':'')+'" data-val="presencial" onclick="tramiteNotifSetCanal(\'presencial\')">🤝 Presencial</button>'+
    '<button type="button" class="btn bsm canal-resp-btn'+(canal==='whatsapp'?' on':'')+'" data-val="whatsapp" onclick="tramiteNotifSetCanal(\'whatsapp\')">💬 WhatsApp</button>'+
    '<button type="button" class="btn bsm canal-resp-btn'+(canal==='aviso'?' on':'')+'" data-val="aviso" onclick="tramiteNotifSetCanal(\'aviso\')">📌 Por aviso</button>';

  body.innerHTML=
    '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem">📬 Notificar documento firmado — '+escAttr(refId)+'</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">'+
    (puedeCorreo
      ?'<strong>Correo:</strong> solo VITAL o el Encargado del departamento. Otros responsables notifican por presencial, WhatsApp o aviso cargando el soporte.'
      :'<strong>Usted debe notificar</strong> por presencial, WhatsApp o aviso: vea el documento firmado, cargue el oficio notificado e indique fecha y medio.')+
    (notifAsignado?' Encargado de notificar: <strong>'+escAttr(notifAsignado)+'</strong>.':'')+
    (plazo?' '+plazo:'')+
    '</div>'+
    '<div style="margin-bottom:10px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:4px">📄 Documento firmado</div>'+
    tramiteDocsFirmadosHtml(t,wf)+
    '</div>'+
    '<div style="margin-bottom:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:4px">📄 Oficio / documento notificado (PDF)</div>'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">Cargue aquí el documento ya notificado (recomendado). Quedará en Drive y, al cerrar, en consulta ciudadana.</div>'+
    (typeof sstFilePickBlock==='function'
      ?sstFilePickBlock({inputId:'tramite-notif-oficio-file',listId:'tramite-notif-oficio-list',ctxKey:'tramite-notif-oficio:'+refId+':'+taskId,label:'Cargar documento notificado',accept:'.pdf,application/pdf',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
      :('<div class="sst-file-pick"><button type="button" class="btn bsm bp" onclick="document.getElementById(\'tramite-notif-oficio-file\').click()">📎 Cargar documento notificado</button><input type="file" id="tramite-notif-oficio-file" accept=".pdf,application/pdf" style="display:none"><span id="tramite-notif-oficio-name" class="sst-file-pick-name">Sin archivo seleccionado</span></div>'))+
    '</div>'+
    '<div class="fld" style="margin-bottom:8px"><label style="font-weight:600;font-size:12px">Medio de notificación</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px" id="tramite-notif-canal-btns">'+canalBtns+'</div>'+
    '<input type="hidden" id="tramite-notif-canal" value="'+escAttr(canal)+'"></div>'+
    '<div id="tramite-notif-correo-box" style="'+(isCorreo?'':'display:none')+'">'+
    '<div class="fld" style="margin-bottom:6px"><label>Para <span class="req-star">*</span></label><input type="text" id="tramite-notif-to" value="'+escAttr(dest)+'" placeholder="correo1@ejemplo.com, …"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Asunto</label><input type="text" id="tramite-notif-asunto" value="'+escAttr(asuntoDef)+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Mensaje</label><textarea id="tramite-notif-cuerpo" style="min-height:100px;width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px">'+escAttr(cuerpoDef)+'</textarea></div>'+
    '</div>'+
    '<div id="tramite-notif-otro-box" style="'+(isCorreo?'display:none':'')+'">'+
    '<div class="fld" style="margin-bottom:8px"><label>Fecha de notificación<span class="req-star">*</span></label><input type="date" id="tramite-notif-fecha" value="'+escAttr(typeof hoy==='function'?hoy():'')+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Observación</label><textarea id="tramite-notif-obs" placeholder="Ej. Entregado en ventanilla / enviado por WhatsApp…" style="min-height:60px;width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px"></textarea></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Soporte de notificación<span class="req-star">*</span> <span style="font-weight:400;color:var(--tx3)">(PDF o imagen de la constancia/aviso)</span></label>'+
    (typeof sstFilePickBlock==='function'
      ?sstFilePickBlock({inputId:'tramite-notif-soporte',listId:'tramite-notif-soporte-list',ctxKey:'tramite-notif-soporte:'+refId+':'+taskId,label:'Seleccionar archivo',accept:'.pdf,.png,.jpg,.jpeg,application/pdf,image/*',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
      :('<div class="sst-file-pick"><button type="button" class="btn bsm bp" onclick="document.getElementById(\'tramite-notif-soporte\').click()">📎 Seleccionar archivo</button><input type="file" id="tramite-notif-soporte" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*" style="display:none"><span id="tramite-notif-soporte-name" class="sst-file-pick-name">Sin archivo seleccionado</span></div>'))+
    '<div style="font-size:11px;color:var(--tx2);margin-top:4px">Obligatorio. Al confirmar pasa a <strong>revisión del departamento</strong> para cerrar la actividad.</div></div>'+
    '</div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" id="tramite-notif-btn" onclick="submitTramiteNotificar(\''+escAttr(refId)+'\',\''+escAttr(taskId)+'\')">✅ Confirmar notificación</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={expId:refId,taskId:taskId,mode:'tramiteNotificar'};
  if(typeof sstFileStagingReset==='function'){
    sstFileStagingReset('tramite-notif-oficio:'+refId+':'+taskId);
    sstFileStagingReset('tramite-notif-soporte:'+refId+':'+taskId);
  }
  if(typeof sstFileInitPick==='function'){
    sstFileInitPick('tramite-notif-oficio-file');
    sstFileInitPick('tramite-notif-soporte');
  }
}

function tramiteNotifSetCanal(val){
  const hid=document.getElementById('tramite-notif-canal');
  if(hid)hid.value=val||'';
  document.querySelectorAll('#tramite-notif-canal-btns .canal-resp-btn').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-val')===val);
  });
  const isCorreo=val==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&val===PQRS_WF_CANAL.CORREO);
  const correo=document.getElementById('tramite-notif-correo-box');
  const otro=document.getElementById('tramite-notif-otro-box');
  if(correo)correo.style.display=isCorreo?'':'none';
  if(otro)otro.style.display=isCorreo?'none':'';
}

async function submitTramiteNotificar(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t)return;
  if(typeof tramitePuedeNotificar==='function'&&!tramitePuedeNotificar(t)){
    notif('No puede notificar esta actividad','err');
    return;
  }
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const e=tramiteFirmaExpCtx(t,refId);
  const canal=String((document.getElementById('tramite-notif-canal')||{}).value||'correo').trim();
  const isCorreo=canal==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO);
  const btn=document.getElementById('tramite-notif-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():(responsableActivo||'');

  if(isCorreo&&!tramitePuedeNotificarCorreo(t)){
    notif('Solo VITAL o el Encargado del departamento pueden notificar por correo','err');
    if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
    return;
  }

  // Subir oficio notificado (opcional / recomendado)
  const ctxOfi='tramite-notif-oficio:'+refId+':'+taskId;
  const itOfi=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxOfi):null;
  const fileOficio=(itOfi&&itOfi.blob)||window._tramiteNotifOficioFile||((document.getElementById('tramite-notif-oficio-file')||{}).files||[])[0]||null;
  if(fileOficio||itOfi){
    try{
      if(btn)btn.textContent='Subiendo documento notificado…';
      if(typeof sstSolicitarGmailParaAdjuntar==='function'){
        const okG=await sstSolicitarGmailParaAdjuntar();
        if(!okG){if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
      }
      const resOf=(itOfi&&itOfi.state==='uploaded'&&itOfi.uploaded)
        ?{driveLink:itOfi.uploaded.driveLink||itOfi.uploaded.previewLink,fileId:itOfi.uploaded.fileId||itOfi.uploaded.driveFileId,nombre:itOfi.uploaded.nombre||itOfi.nombre,previewLink:itOfi.uploaded.previewLink||itOfi.uploaded.driveLink}
        :await tramiteUploadPdfFirmado(fileOficio,t,e,refId);
      mutateTask(refId,taskId,function(tk){
        const prev=getTaskFirmaWf(tk);
        const docs=(prev.documentos||[]).slice();
        docs.push({
          nombre:'oficio-notificado-'+(fileOficio.name||'documento.pdf'),
          driveLink:resOf&&(resOf.driveLink||resOf.previewLink)||'',
          previewLink:resOf&&(resOf.previewLink||resOf.driveLink)||'',
          fileId:resOf&&(resOf.fileId||resOf.driveFileId)||'',
          tipo:'oficio_firmado',
          driveEstado:'por_notificar',
          notificado:true
        });
        if(!Array.isArray(tk.soportes))tk.soportes=[];
        if(resOf&&(resOf.fileId||resOf.driveFileId)){
          tk.soportes.push({
            id:'sop_'+Date.now(),
            nombre:resOf.nombre||fileOficio.name||'oficio-notificado.pdf',
            driveFileId:resOf.fileId||resOf.driveFileId,
            driveLink:resOf.driveLink||'',
            previewLink:resOf.previewLink||resOf.driveLink||'',
            driveInstitutional:true,
            autor:por,
            fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10)
          });
        }
        tk.firmaWf=Object.assign({},prev,{documentos:docs,canal:canal});
      });
      window._tramiteNotifOficioFile=null;
      if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxOfi);
    }catch(errOf){
      notif('No se pudo subir el documento notificado: '+String(errOf.message||errOf).slice(0,90),'err');
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
      return;
    }
  }

  if(isCorreo){
    const toRaw=String((document.getElementById('tramite-notif-to')||{}).value||'').trim();
    const asunto=String((document.getElementById('tramite-notif-asunto')||{}).value||'').trim();
    const cuerpo=String((document.getElementById('tramite-notif-cuerpo')||{}).value||'').trim();
    const destinos=toRaw.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
    if(!destinos.length){notif('Indique al menos un correo destino','err');if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    if(!cuerpo){notif('Indique el mensaje','err');if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    const htmlBody='<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">'+escAttr(cuerpo).replace(/\n/g,'<br>')+'</div>';
    try{
      if(typeof sstSolicitarGmailParaAdjuntar==='function'){
        const okG=await sstSolicitarGmailParaAdjuntar();
        if(!okG){if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
      }
      if(btn)btn.textContent='Enviando correo…';
      if(typeof pqrsEnviarCorreoCiudadano==='function'){
        await pqrsEnviarCorreoCiudadano(destinos,asunto,htmlBody,true,[],{});
      }else if(typeof gmailSend==='function'){
        for(let i=0;i<destinos.length;i++)await gmailSend(destinos[i],asunto,htmlBody);
      }else{
        notif('No hay envío de correo disponible','err');
        if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
        return;
      }
    }catch(err){
      notif('No se pudo enviar el correo: '+String(err.message||err).slice(0,100),'err');
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
      return;
    }
    setTaskFirmaWf(refId,taskId,{canal:'correo'});
    await finalizarTramiteTrasPublicar(refId,taskId,{via:'notificacion',destinos:destinos,canal:'correo'});
    notif('📬 Notificado por correo y actividad cerrada','ok');
    closeTaskModal();
    return;
  }

  // Canales no correo → soporte + revisión final del departamento
  const fechaN=String((document.getElementById('tramite-notif-fecha')||{}).value||(typeof hoy==='function'?hoy():'')).trim()||(typeof hoy==='function'?hoy():'');
  const obs=String((document.getElementById('tramite-notif-obs')||{}).value||'').trim();
  const ctxSop='tramite-notif-soporte:'+refId+':'+taskId;
  const itSop=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxSop):null;
  const fileSop=(itSop&&itSop.blob)||window._tramiteNotifSoporteFile||((document.getElementById('tramite-notif-soporte')||{}).files||[])[0]||null;
  if(!fileSop&&!itSop){
    notif('Adjunte el soporte de la notificación (PDF o imagen)','err');
    if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
    return;
  }
  try{
    if(btn)btn.textContent='Subiendo soporte…';
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG){if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    }
    const res=(itSop&&itSop.state==='uploaded'&&itSop.uploaded)
      ?{driveLink:itSop.uploaded.driveLink||itSop.uploaded.previewLink,fileId:itSop.uploaded.fileId||itSop.uploaded.driveFileId,nombre:itSop.uploaded.nombre||itSop.nombre,previewLink:itSop.uploaded.previewLink||itSop.uploaded.driveLink}
      :await tramiteUploadPdfFirmado(fileSop,t,e,refId);
    mutateTask(refId,taskId,function(tk){
      const prev=getTaskFirmaWf(tk);
      const docs=(prev.documentos||[]).slice();
      docs.push({
        nombre:'Soporte notificación '+canal+' — '+(fileSop.name||'soporte'),
        driveLink:res&&(res.driveLink||res.previewLink)||'',
        previewLink:res&&(res.previewLink||res.driveLink)||'',
        fileId:res&&(res.fileId||res.driveFileId)||'',
        tipo:'notificacion_soporte',
        driveEstado:'revision_final',
        canal:canal
      });
      if(!Array.isArray(tk.soportes))tk.soportes=[];
      if(res&&(res.fileId||res.driveFileId)){
        tk.soportes.push({
          id:'sop_'+Date.now(),
          nombre:res.nombre||fileSop.name||'soporte-notif',
          driveFileId:res.fileId||res.driveFileId,
          driveLink:res.driveLink||'',
          previewLink:res.previewLink||res.driveLink||'',
          driveInstitutional:true,
          autor:por,
          fecha:fechaN
        });
      }
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({
        tipo:'notif_reportada_revision',
        fecha:typeof hoy==='function'?hoy():fechaN,
        por:por,
        nota:'Notificación '+canal+' reportada con soporte — pendiente revisión del departamento'+(obs?' · '+obs:'')
      });
      tk.firmaWf=Object.assign({},prev,{
        fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.REVISION_FINAL:'revision_final_nca'),
        canal:canal,
        documentos:docs,
        notificacion_reportada:{
          fecha:fechaN,
          obs:obs,
          por:por,
          en:new Date().toISOString(),
          soporteLink:res&&(res.driveLink||'')||'',
          soporteFileId:res&&(res.fileId||res.driveFileId)||'',
          soporteNombre:fileSop.name||''
        }
      });
    });
    window._tramiteNotifSoporteFile=null;
    if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxSop);
    notif('⏳ Soporte cargado — pasa a revisión del departamento para cerrar','ok');
    closeTaskModal();
    if(typeof renderActividades==='function')renderActividades();
  }catch(err){
    notif('No se pudo subir el soporte: '+String(err.message||err).slice(0,90),'err');
    if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
  }
}

async function tramiteAprobarRevisionFinalNotif(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  if(!taskFirmaEnRevisionFinalNotif(t)){notif('No está en revisión final de notificación','err');return;}
  if(!tramitePuedeNotificar(t)){notif('Solo el encargado / VITAL puede aprobar la revisión final','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const wf=getTaskFirmaWf(t);
  const dest=wf.notificacion_reportada
    ?('canal '+(wf.canal||'')+' · '+(wf.notificacion_reportada.fecha||''))
    :(wf.canal||'');
  await finalizarTramiteTrasPublicar(refId,taskId,{
    via:'notificacion',
    destinos:[dest],
    canal:wf.canal||''
  });
  notif('✅ Actividad cerrada tras revisión final de notificación','ok');
  closeTaskModal();
  if(typeof renderActividades==='function')renderActividades();
}

window.tramitePuedeNotificar=tramitePuedeNotificar;
window.tramitePuedeNotificarCorreo=tramitePuedeNotificarCorreo;
window.tramiteNotifSetCanal=tramiteNotifSetCanal;
window.tramiteAprobarRevisionFinalNotif=tramiteAprobarRevisionFinalNotif;
window.taskFirmaEnRevisionFinalNotif=taskFirmaEnRevisionFinalNotif;
window.openTramiteNotificarModal=openTramiteNotificarModal;
window.submitTramiteNotificar=submitTramiteNotificar;

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
        canal:opts.canal||prev.canal||'',
        notificacion:{en:new Date().toISOString(),a:(opts.destinos||[]).join(', '),por:taskComentarioAutor(),canal:opts.canal||prev.canal||''}
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

/** Filas sintéticas para la paleta PQRSD (trámites / oficios oficina en firma). */
function getTramiteFirmaRowsParaPaletaDirector(modo){
  modo=String(modo||'por_firmar');
  const tasks=getTareasTramiteFirmaPorFase(function(t){
    if(modo==='firmados')return taskFirmaEsFirmadoPendiente(t);
    if(modo==='por_notificar')return taskFirmaEnPorNotificar(t)||taskFirmaEnRevisionFinalNotif(t);
    if(!taskFirmaEnPorFirmar(t))return false;
    if(taskFirmaEsFirmadoPendiente(t))return false;
    return true;
  });
  return tasks.map(function(t){
    const e=t.sinExpediente?null:(typeof getExpById==='function'?getExpById(t.exp||t.codigo):null);
    const nom=e?(typeof getNom==='function'?getNom(e):''):(t.nombre||'(Sin expediente)');
    const ofi=tramiteFirmaOficinaId(t)||(e&&e._pqrs_oficina)||(e&&e._depto)||'';
    const tipoLbl=t.origen==='oficina_firma'?'Oficio oficina':'Trámite';
    return {
      _exp:t.exp||t.codigo,
      _tramite_firma_task:true,
      _taskId:t.id,
      _fecha:t.fechaReportada||t.vence||(e&&e._fecha)||'',
      _tipo_solicitud:tipoLbl,
      f_f1:t.actividad||t.desc||'Documento para firma',
      _pn_nombre:nom,
      _qd_nombre:nom,
      _depto:e?e._depto:(t.depto||''),
      _estado:e?e._estado:'En trámite',
      _tramite:e?e._tramite:'',
      _pqrs_oficina:ofi||'guaviare',
      _sin_expediente:!!t.sinExpediente,
      _oficina_firma:t.origen==='oficina_firma'
    };
  });
}
/** Filtra filas de trámite-firma por oficina (Director ve todas). */
function filterTramiteFirmaRowsPorOficina(rows,oficinaId,esDir){
  rows=Array.isArray(rows)?rows:[];
  if(esDir)return rows;
  const ofi=String(oficinaId||'').trim();
  if(!ofi)return rows;
  return rows.filter(function(r){return String(r._pqrs_oficina||'')===ofi;});
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
  const atajo=tramitePuedeAtajoFirmaGestion(t);
  if(!esDirector&&!atajo){notif('Solo el Director, VITAL, encargado u oficina dueña pueden gestionar la firma','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  // Modos dedicados del Director (misma UX que PQRSD)
  if(esDirector&&(mode==='ver'||mode==='cargar'||mode==='ya_firmado'||mode==='devolver')){
    return openTramiteDirectorAccionModal(refId,taskId,mode);
  }
  if(esDirector){
    return openTramiteDirectorAccionModal(refId,taskId,'ver');
  }
  // Oficina dueña: mismo atajo que PQRSD (cargar / ya firmado → notificar)
  if(tramitePuedeGestionarComoOficina(t)&&(mode==='cargar'||mode==='ya_firmado'||mode==='gestionar'||!mode)){
    if(mode==='ya_firmado'||(mode==='gestionar'&&taskFirmaEsFirmadoPendiente(t))){
      if(taskFirmaEsFirmadoPendiente(t))return tramitePasarAPorNotificar(refId,taskId);
      return tramiteMarcarFirmadoFisico(refId,taskId);
    }
    return openTramiteAtajoFirmadoModal(refId,taskId);
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
    const dirPdfCtx=typeof sstFileCtxKeyTramiteDirectorPdf==='function'?sstFileCtxKeyTramiteDirectorPdf(refId,taskId):('tramite-director-pdf:'+refId+':'+taskId);
    const dirPdfPick=typeof sstFilePickBlock==='function'
      ?sstFilePickBlock({inputId:'tramite-director-pdf-file',listId:'tramite-director-pdf-list',ctxKey:dirPdfCtx,label:'Seleccionar PDF firmado',accept:'.pdf,application/pdf'})
      :'';
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Cargar PDF ya firmado</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Suba el documento firmado para que procedan a notificar. Usted no asigna quién notifica.</div>'+
      preview+infoReadonly+
      '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:#0d5c2e08">'+
      dirPdfPick+
      '</div>'+
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
  if(mode==='cargar'){
    const dirPdfCtx=typeof sstFileCtxKeyTramiteDirectorPdf==='function'?sstFileCtxKeyTramiteDirectorPdf(refId,taskId):('tramite-director-pdf:'+refId+':'+taskId);
    if(typeof sstFileStagingReset==='function')sstFileStagingReset(dirPdfCtx);
    if(typeof sstFileInitPick==='function')sstFileInitPick('tramite-director-pdf-file');
  }
  ov.classList.add('on');
  window._taskModalCtx={mode:'tramiteDirectorAccion',accion:mode,expId,taskId};
}

function tramiteDirectorGetSignedPdfBlob(refId,taskId){
  const ctxKey=typeof sstFileCtxKeyTramiteDirectorPdf==='function'?sstFileCtxKeyTramiteDirectorPdf(refId,taskId):('tramite-director-pdf:'+refId+':'+taskId);
  if(typeof sstFileGetMainBlob==='function'){
    const b=sstFileGetMainBlob(ctxKey);
    if(b)return b;
  }
  return window._tramiteDirectorSignedFile||null;
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
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const file=tramiteDirectorGetSignedPdfBlob(refId,taskId);
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
    const wfPrev=getTaskFirmaWf(t);
    const canal=String(wfPrev.canal||'correo').trim();
    const esCorreo=canal==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO);
    const sinPlazo=esCorreo; // Director firma → correo VITAL/encargado: sin plazo 5 días
    let vence='';
    if(!sinPlazo&&typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
    setTaskFirmaWf(expId,taskId,{
      fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion'),
      firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),pdfLink:pdfLink,modo:'digital'},
      firma_fisica:null,
      notif_inicio:inicio,
      notif_vence:vence,
      notif_plazo_dias:sinPlazo?0:5,
      notif_sin_plazo:!!sinPlazo
    });
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteDirectorSignedFile=null;
    closeTaskModal();
    notif(sinPlazo?'📬 Documento firmado — Por notificar (correo · sin plazo 5 días)':'📬 Documento firmado — quedó en «Por notificar»','ok');
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
window.tramiteSincronizarParticipacionPostAprobacionFirma=tramiteSincronizarParticipacionPostAprobacionFirma;
window.tramiteMarcarImpreso=tramiteMarcarImpreso;
window.tramitePasarAPorFirmar=tramitePasarAPorFirmar;
window.tramiteMarcarFirmadoFisico=tramiteMarcarFirmadoFisico;
window.tramitePasarAPorNotificar=tramitePasarAPorNotificar;
window.openTramiteNotificarModal=openTramiteNotificarModal;
window.submitTramiteNotificar=submitTramiteNotificar;
window.finalizarTramiteTrasPublicar=finalizarTramiteTrasPublicar;
window.notificarCiudadanoTrasVerificarTramite=notificarCiudadanoTrasVerificarTramite;
window.confirmarCierreTaskTramiteAware=confirmarCierreTaskTramiteAware;
function tramiteLibreParaImprimir(expId,taskId,opts){
  return tramiteEnviarAFirmaDesdeRevision(expId,taskId,Object.assign({modo:'imprimir'},opts||{}));
}
function tramiteLibreParaFirma(expId,taskId,opts){
  return tramiteEnviarAFirmaDesdeRevision(expId,taskId,Object.assign({modo:'firma'},opts||{}));
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
  const atajoCtx=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  const atajoPick=typeof sstFilePickBlock==='function'
    ?sstFilePickBlock({inputId:'tramite-atajo-firmado-file',listId:'tramite-atajo-firmado-list',ctxKey:atajoCtx,label:'Seleccionar PDF firmado',accept:'application/pdf,.pdf',btnClass:'btn bsm',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
    :'';
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Pasadizo desde revisión: el documento <strong>ya está firmado</strong>. Suba el PDF firmado (recomendado) o confirme sin archivo; la actividad irá a <strong>Por notificar</strong>.</div>'+
    '<div style="margin-bottom:12px;padding:10px;border:1px dashed #0f766e;border-radius:var(--r);background:#0f766e12">'+
    atajoPick+
    '</div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp" id="tramite-atajo-firmado-btn" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false)">⬆ Cargar y pasar a Por notificar</button>'+
    '<button type="button" class="btn bsm" style="background:#15803d;color:#fff;border-color:#15803d" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',true)">✓ Ya firmado (sin PDF) → Por notificar</button>'+
    '<button type="button" class="btn bsm" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false,true)">📬 Cargar y notificar ahora</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  window._tramiteAtajoFirmadoFile=null;
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(atajoCtx);
  if(typeof sstFileInitPick==='function')sstFileInitPick('tramite-atajo-firmado-file');
  ov.classList.add('on');
  window._taskModalCtx={expId:refId,taskId,mode:'tramiteAtajoFirmado'};
}
/**
 * Panel lateral de revisión: cargar documento firmado (mismo UI que entrega responsable).
 */
function renderTaskReviewAtajoFirmadoHtml(expId,taskId,t){
  const refId=t&&t.sinExpediente?(t.codigo||expId):expId;
  const eid=jsStr(refId),tid=jsStr(taskId);
  const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  const pick=typeof sstFilePickBlock==='function'
    ?sstFilePickBlock({inputId:'tramite-atajo-firmado-file',listId:'tramite-atajo-firmado-list',ctxKey:ctxKey,label:'Seleccionar PDF firmado',accept:'application/pdf,.pdf',btnClass:'btn bsm bp',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
    :'';
  const e=tramiteFirmaExpCtx(t,expId);
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e){
    const wf=typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t):{};
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{modo:'revision',id:'tramite-atajo-notif-por-sel',todosResponsables:true,deptoId:e._depto});
  }
  return '<div class="task-review-decision-side task-review-side-scroll task-review-atajo-firmado">'+
    '<button type="button" class="btn bsm bd2" style="margin-bottom:10px" onclick="taskReviewCloseSidePanel()">← Cerrar</button>'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">📤 Cargar documento firmado</div>'+
    '<div class="sst-file-pick-row" style="margin-bottom:12px">'+pick+'</div>'+
    '<div id="task-atajo-firmado-post" class="task-atajo-firmado-post" style="display:none">'+
      (selNotif?'<div class="task-decision-block"><div class="task-decision-block-tit">Notificación</div>'+selNotif+'</div>':'')+
      '<div class="fx" style="gap:8px;flex-wrap:wrap;margin-top:10px">'+
        '<button type="button" class="btn bsm bp" id="tramite-atajo-firmado-btn" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false,false,{keepOpen:true})">✓ Cargar y pasar a Por notificar</button>'+
        '<button type="button" class="btn bsm" onclick="tramiteAtajoFirmadoConfirmar(\''+eid+'\',\''+tid+'\',false,true,{keepOpen:true})">📬 Cargar y notificar ahora</button>'+
      '</div></div></div>';
}
function initTaskReviewAtajoFirmadoSide(expId,taskId,t,opts){
  opts=opts||{};
  const refId=t&&t.sinExpediente?(t.codigo||expId):expId;
  const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxKey);
  if(typeof sstFileInitPick==='function')sstFileInitPick('tramite-atajo-firmado-file');
  const syncPost=function(){
    const post=document.getElementById('task-atajo-firmado-post');
    if(!post)return;
    const it=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
    const listo=!!(it&&(it.blob||it.state==='uploaded'||it.state==='uploading'));
    post.style.display=listo?'':'none';
  };
  const listEl=document.getElementById('tramite-atajo-firmado-list');
  if(listEl){
    const obs=new MutationObserver(syncPost);
    obs.observe(listEl,{childList:true,subtree:true});
    window._taskReviewAtajoObs=obs;
  }
  syncPost();
  if(opts.autoPick&&typeof sstFilePickByInputId==='function'){
    setTimeout(function(){sstFilePickByInputId('tramite-atajo-firmado-file');},120);
  }
}
function tramiteAtajoFirmadoDesdeRevision(expId,taskId){
  if(typeof taskModalIsReviewOpen==='function'&&taskModalIsReviewOpen()&&typeof taskReviewAbrirAtajoFirmado==='function'){
    taskReviewAbrirAtajoFirmado(expId,taskId);
    return;
  }
  openTramiteAtajoFirmadoModal(expId,taskId);
}
function tramiteAtajoFirmadoGetPdfBlob(refId,taskId){
  const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  if(typeof sstFileGetMainBlob==='function'){
    const b=sstFileGetMainBlob(ctxKey);
    if(b)return b;
  }
  return window._tramiteAtajoFirmadoFile||null;
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

async function tramiteAtajoFirmadoConfirmar(expId,taskId,sinPdf,abrirNotif,opts){
  opts=opts||{};
  const keepOpen=!!opts.keepOpen;
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const e=tramiteFirmaExpCtx(t,expId);
  if(e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)){notif('Use el flujo PQRSD','err');return;}
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const file=tramiteAtajoFirmadoGetPdfBlob(refId,taskId);
  if(!sinPdf&&!file){notif('Seleccione el PDF firmado o use «Cerrar sin PDF»','err');return;}
  let notifPor='';
  const sel=document.getElementById('tramite-atajo-notif-por-sel')||document.getElementById('tramite-notif-por-sel')||document.getElementById('pqrs-notif-por-sel');
  if(sel)notifPor=String(sel.value||'').trim();
  if(!notifPor&&typeof pqrsResolverNotificadorCorreo==='function')
    notifPor=pqrsResolverNotificadorCorreo((e&&e._depto)||t.depto||'guaviare','');
  const btn=document.getElementById('tramite-atajo-firmado-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  try{
    let pdfLink='';
    const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
    const staged=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
    const yaSubido=staged&&staged.state==='uploaded'&&staged.uploaded;
    if(!sinPdf){
      let res=null;
      if(yaSubido)res=staged.uploaded;
      else if(file){
        if(typeof sstSolicitarGmailParaAdjuntar==='function'){
          const okG=await sstSolicitarGmailParaAdjuntar();
          if(!okG){
            if(btn){btn.disabled=false;btn.textContent='⬆ Cargar y pasar a Por notificar';}
            return;
          }
        }
        if(typeof sstCargaShow==='function')sstCargaShow({title:'Cargando PDF firmado',message:'Subiendo documento…',sub:file.name||'PDF',pct:20});
        res=await tramiteUploadPdfFirmado(file,t,e,refId);
      }
      if(res){
        pdfLink=res.driveLink||res.previewLink||'';
        if(res.fileId||res.driveFileId){
          mutateTask(refId,taskId,function(tk){
            if(!Array.isArray(tk.soportes))tk.soportes=[];
            tk.soportes.push({
              id:'sop_'+Date.now(),
              nombre:res.nombre||(file&&file.name)||staged.nombre||'firmado.pdf',
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
    }
    if(typeof driveRenombrarSoporteActivoExp==='function'){
      try{await driveRenombrarSoporteActivoExp(refId,taskId,'por_notificar');}catch(errR){console.warn(errR);}
    }
    const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    const esCorreo=true; // atajo desde revisión usa canal correo
    const sinPlazo=esCorreo&&(!notifPor||(typeof tramitePuedeNotificarCorreo==='function'&&tramitePuedeNotificarCorreo(t))||(typeof pqrsNombreEsVital==='function'&&pqrsNombreEsVital(notifPor)));
    let vence='';
    if(!sinPlazo){
      if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
      else{
        const d=new Date(inicio+'T12:00:00');d.setDate(d.getDate()+5);vence=d.toISOString().slice(0,10);
      }
    }
    const faseNotif=typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion';
    const ok=mutateTask(refId,taskId,function(tk){
      tk.requiereFirma=true;
      const prev=getTaskFirmaWf(tk);
      tk.firmaWf=Object.assign({},prev,{
        fase:faseNotif,
        notificar_por:sinPlazo?'':(notifPor||prev.notificar_por||''),
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
        notif_plazo_dias:sinPlazo?0:5,
        notif_sin_plazo:!!sinPlazo,
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
      if(typeof tramiteSincronizarParticipacionPostAprobacionFirma==='function')
        tramiteSincronizarParticipacionPostAprobacionFirma(tk);
    });
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteAtajoFirmadoFile=null;
    if(!ok){notif('No se pudo actualizar la actividad','err');return;}
    notif((sinPlazo?'📬 Por notificar (correo · sin plazo 5 días)':'📬 Documento firmado — quedó en «Por notificar»')+(notifPor&&!sinPlazo?' · Notificará: '+notifPor:''),'ok');
    try{if(typeof setActFiltro==='function')setActFiltro(sinPlazo?'porfirma':'pornotif');}catch(eF){}
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(abrirNotif){
      openTramiteNotificarModal(refId,taskId);
    }else if(keepOpen&&typeof taskReviewRefreshModal==='function'){
      taskReviewCloseSidePanel();
      taskReviewRefreshModal(refId,taskId,'doc');
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
window.renderTaskReviewAtajoFirmadoHtml=renderTaskReviewAtajoFirmadoHtml;
window.initTaskReviewAtajoFirmadoSide=initTaskReviewAtajoFirmadoSide;
window.tramiteFirmaOficinaId=tramiteFirmaOficinaId;
window.puedeEntregarOficinaParaFirma=puedeEntregarOficinaParaFirma;
window.tramitePuedeGestionarComoOficina=tramitePuedeGestionarComoOficina;
window.filterTramiteFirmaRowsPorOficina=filterTramiteFirmaRowsPorOficina;
window.openEntregaOficinaFirmaModal=openEntregaOficinaFirmaModal;
window.submitEntregaOficinaFirma=submitEntregaOficinaFirma;
window.entregaOfiFirmaUploadCtx=entregaOfiFirmaUploadCtx;
window.syncEntregaOfiFirmaFileLabel=syncEntregaOfiFirmaFileLabel;

function genCodigoActOficinaFirma(ofi){
  ofi=String(ofi||'').trim()||'oficina';
  const of=typeof OFICINAS_DEGUV!=='undefined'?OFICINAS_DEGUV.find(function(o){return o.id===ofi;}):null;
  const pref='ACT-'+(of&&of.codigo?of.codigo:'OFI');
  const n=(typeof actividadesLibres!=='undefined'?actividadesLibres:[]).filter(function(a){
    return a&&!a.eliminada&&String(a.oficina||'')===ofi&&a.origen==='oficina_firma';
  }).length+1;
  return pref+'-'+String(n).padStart(4,'0');
}

/** Modal PQRSD oficinas: oficios / documentos para firma del Director (no PQRSD). */
function openEntregaOficinaFirmaModal(){
  if(!puedeEntregarOficinaParaFirma()){
    notif('Solo oficinas RN, OAP, Admin o Secretaría pueden entregar documentos para firma','err');
    return;
  }
  const ofi=typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():(typeof deptoActivo!=='undefined'?deptoActivo:'');
  const ofiLbl=typeof labelOficina==='function'?labelOficina(ofi):(ofi||'Oficina');
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Documento para firma · '+ofiLbl;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const notifDef=typeof pqrsDefaultNotificadorOficina==='function'?pqrsDefaultNotificadorOficina(ofi):'';
  body.innerHTML=
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Oficio u otro documento <strong>que no es PQRSD</strong>. Se envía al Director (Por firmar) y luego usted notifica, igual que con PQRSD de oficina.</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Asunto / descripción <span style="color:var(--rd)">*</span></label>'+
      '<input type="text" id="entrega-ofi-firma-asunto" placeholder="Ej. Oficio de remisión, respuesta a entidad…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>N° de oficio (opcional)</label>'+
      '<input type="text" id="entrega-ofi-firma-oficio" placeholder="OFI-2026-…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Documento para firma <span style="color:var(--rd)">*</span></label>'+
      (typeof sstFilePickBlock==='function'
        ?sstFilePickBlock({inputId:'entrega-ofi-firma-file',listId:'entrega-ofi-firma-file-list',ctxKey:'entrega-ofi-firma:'+ofi,label:'Seleccionar archivo',accept:'.pdf,.doc,.docx,application/pdf',getUploadCtx:typeof entregaOfiFirmaUploadCtx==='function'?entregaOfiFirmaUploadCtx:null})
        :('<div class="sst-file-pick"><button type="button" class="btn bsm bp" onclick="(typeof sstSolicitarGmailParaAdjuntar===\'function\'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(ok){if(ok){var i=document.getElementById(\'entrega-ofi-firma-file\');if(i)i.click();}})">📎 Seleccionar archivo</button><input type="file" id="entrega-ofi-firma-file" accept=".pdf,.doc,.docx,application/pdf" style="display:none" onchange="syncEntregaOfiFirmaFileLabel(this)"><span id="entrega-ofi-firma-file-name" class="sst-file-pick-name">Sin archivo seleccionado</span></div>'))+
    '</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Quién notificará</label>'+
      '<input type="text" id="entrega-ofi-firma-notif" value="'+escAttr(notifDef)+'" placeholder="Encargado de la oficina" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fx" style="gap:8px">'+
      '<button type="button" class="btn bsm bp" id="entrega-ofi-firma-btn" onclick="submitEntregaOficinaFirma()">🖊 Enviar a firma</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'entregaOficinaFirma',oficina:ofi};
  window._entregaOfiFirmaCodigo=typeof genCodigoActOficinaFirma==='function'?genCodigoActOficinaFirma(ofi):('ACT-'+Date.now());
  if(typeof sstFileStagingReset==='function')sstFileStagingReset('entrega-ofi-firma:'+ofi);
  if(typeof sstFileInitPick==='function')sstFileInitPick('entrega-ofi-firma-file');
  setTimeout(function(){const a=document.getElementById('entrega-ofi-firma-asunto');if(a)a.focus();},80);
}
function entregaOfiFirmaUploadCtx(){
  const ofi=(typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():'')||(window._taskModalCtx&&window._taskModalCtx.oficina)||'';
  const cod=window._entregaOfiFirmaCodigo||(typeof genCodigoActOficinaFirma==='function'?genCodigoActOficinaFirma(ofi):('ACT-'+Date.now()));
  window._entregaOfiFirmaCodigo=cod;
  const eDrive={
    _exp:cod,
    _fecha:typeof hoy==='function'?hoy():'',
    _depto:'guaviare',
    _sin_expediente:true,
    _pn_nombre:'Sin expediente'
  };
  const t={id:'_staging_',actividad:'Documento para firma',codigo:cod,depto:'guaviare',oficina:ofi,sinExpediente:true};
  return{esPqrs:false,expId:cod,e:null,eDrive:eDrive,t:t};
}
function syncEntregaOfiFirmaFileLabel(inp){
  const nm=document.getElementById('entrega-ofi-firma-file-name');
  if(!nm||!inp)return;
  const f=inp.files&&inp.files[0];
  nm.textContent=f?(f.name||'Archivo seleccionado'):'Sin archivo seleccionado';
}
async function submitEntregaOficinaFirma(){
  if(!puedeEntregarOficinaParaFirma()){notif('No autorizado','err');return;}
  const ofi=typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():(typeof deptoActivo!=='undefined'?deptoActivo:'');
  if(!ofi||ofi==='ds_deguv'){notif('Oficina no válida','err');return;}
  const asunto=String((document.getElementById('entrega-ofi-firma-asunto')||{}).value||'').trim();
  const oficio=String((document.getElementById('entrega-ofi-firma-oficio')||{}).value||'').trim();
  let notifPor=String((document.getElementById('entrega-ofi-firma-notif')||{}).value||'').trim();
  const fileInp=document.getElementById('entrega-ofi-firma-file');
  const ctxKey='entrega-ofi-firma:'+ofi;
  const itFile=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
  const file=(itFile&&itFile.blob)||(fileInp&&fileInp.files&&fileInp.files[0]);
  if(!asunto){notif('Indique el asunto o descripción','err');return;}
  if(!file&&!itFile){notif('Adjunte el documento para firma','err');return;}
  if(!notifPor&&typeof pqrsDefaultNotificadorOficina==='function')notifPor=pqrsDefaultNotificadorOficina(ofi);
  const btn=document.getElementById('entrega-ofi-firma-btn');
  if(btn){btn.disabled=true;btn.textContent='Enviando…';}
  let createdId='';
  try{
    if(typeof sstCargaShow==='function')sstCargaShow({title:'Documento para firma',message:'Subiendo documento y enviando a firma…',pct:15,sub:file.name||''});
    const cod=window._entregaOfiFirmaCodigo||genCodigoActOficinaFirma(ofi);
    const autor=typeof taskComentarioAutor==='function'?taskComentarioAutor():(typeof labelOficina==='function'?labelOficina(ofi):ofi);
    const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    const actNom=oficio?('Oficio '+oficio+' — '+asunto):asunto;
    let t={
      id:typeof genTaskId==='function'?genTaskId():('tk_'+Date.now()),
      actividad:actNom,
      detalle:oficio?('Oficio '+oficio):'',
      desc:actNom,
      responsable:autor,
      responsables:[autor],
      asignados:[{nombre:autor,fechaReportada:hoyStr,fechaAtendida:'',estado:'pendiente'}],
      depto:'guaviare',
      oficina:ofi,
      codigo:cod,
      sinExpediente:true,
      origen:'oficina_firma',
      requiereFirma:true,
      fechaReportada:hoyStr,
      estado:'En ejecución',
      comentarios:[],
      historial:[{tipo:'oficina_firma',fecha:hoyStr,por:autor,nota:'Documento no-PQRSD enviado a firma del Director'}],
      soportes:[],
      notasDoc:[],
      _pending_fs_sync:true,
      _pending_fs_at:Date.now()
    };
    t=typeof normalizeActLibre==='function'?normalizeActLibre(t):t;
    t.oficina=ofi;
    t.origen='oficina_firma';
    t.depto='guaviare';
    t.codigo=cod;
    createdId=t.id;
    if(!Array.isArray(actividadesLibres))actividadesLibres=[];
    actividadesLibres.push(t);
    const ctx=tramiteFirmaExpCtx(t,cod);
    let up=null;
    if(itFile&&itFile.state==='uploaded'&&itFile.uploaded){
      up=itFile.uploaded;
    }else if(typeof driveUploadExpedienteActividad==='function'){
      up=await driveUploadExpedienteActividad(file,file.name||'documento.pdf',file.type||'application/pdf',ctx,t,autor,'por_firmar');
    }
    if(t._drive_folder_id||(ctx&&ctx._drive_folder_id)){
      t._drive_folder_id=t._drive_folder_id||ctx._drive_folder_id;
      t._drive_folder_link=t._drive_folder_link||ctx._drive_folder_link||'';
    }
    const sop={
      id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      url:(up&&(up.driveLink||up.url))||'',
      preview:(up&&(up.previewLink||up.driveLink||up.url))||'',
      label:file.name||'Documento para firma',
      nombre:file.name||'Documento para firma',
      fecha:new Date().toISOString(),
      autor:autor,
      version:1,
      activo:true,
      local:!up,
      driveFileId:(up&&(up.driveFileId||up.fileId))||'',
      driveFilename:(up&&(up.driveFilename||up.nombre))||'',
      driveEstado:'por_firmar',
      driveInstitutional:!!up,
      tipo:file.type||''
    };
    if(!sop.url&&typeof FileReader!=='undefined'){
      // Fallback local si no hubo Drive
      await new Promise(function(resolve){
        const fr=new FileReader();
        fr.onload=function(){sop.url=fr.result;sop.preview=fr.result;sop.local=true;resolve();};
        fr.onerror=function(){resolve();};
        fr.readAsDataURL(file);
      });
    }
    if(!sop.url){
      // Revertir actividad si no se pudo adjuntar
      const ix=actividadesLibres.findIndex(function(x){return x&&x.id===t.id;});
      if(ix>=0)actividadesLibres.splice(ix,1);
      throw new Error('No se pudo adjuntar el archivo. Conecte Gmail/Drive e intente de nuevo.');
    }
    t.soportes=[sop];
    const faseDest=typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar';
    t.firmaWf={
      fase:faseDest,
      notificar_por:notifPor||'',
      notificar_por_propuesto:notifPor||'',
      canal:'correo',
      enviado_firma_en:new Date().toISOString(),
      enviado_firma_por:autor,
      listo_firma:{por:autor,en:new Date().toISOString(),atajo_digital:true,oficina:ofi},
      documentos:[{
        nombre:sop.nombre||'Documento para firma',
        driveLink:sop.url,
        previewLink:sop.preview||sop.url,
        fileId:sop.driveFileId||'',
        tipo:'oficio_firma',
        driveEstado:'por_firmar'
      }]
    };
    if(typeof persistActividadesLibresFirestore==='function'){
      try{await persistActividadesLibresFirestore();}catch(errP){console.warn('persist act libre oficina:',errP);}
    }else if(typeof persistExpLocal==='function')persistExpLocal();
    else if(typeof saveLS==='function')saveLS();
    if(typeof sstCargaDone==='function')sstCargaDone({holdMs:200});
    closeTaskModal();
    notif('🖊 Documento '+cod+' enviado a «Por firmar» (Director)'+(notifPor?' · Notificará: '+notifPor:''),'ok');
    window._pqrsOfiFiltro='por_firmar';
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  }catch(err){
    if(createdId&&Array.isArray(actividadesLibres)){
      const ix=actividadesLibres.findIndex(function(x){return x&&x.id===createdId;});
      if(ix>=0)actividadesLibres.splice(ix,1);
    }
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('Error: '+String(err.message||err).slice(0,140),'err');
    if(btn){btn.disabled=false;btn.textContent='🖊 Enviar a firma';}
  }
}

