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
/** Pasó por firma del Director (físico o PDF) — seguimiento en «Firmados». */
function taskPasoPorFirmaDirector(t){
  if(!t||t.eliminada)return false;
  const wf=getTaskFirmaWf(t);
  if(wf.firma_fisica&&wf.firma_fisica.en)return true;
  if(wf.firma_director&&wf.firma_director.en)return true;
  if((t.historial||[]).some(function(h){
    return h&&(h.tipo==='firma_fisica_director'||h.tipo==='atajo_firmado_revision'||h.tipo==='firma_director');
  }))return true;
  return false;
}
/** Ya notificada / cerrada tras firma. */
function taskFirmaEsNotificada(t){
  if(!t)return false;
  const f=taskFirmaFase(t);
  if(f==='cerrada_atendida'||(typeof PQRS_WF!=='undefined'&&f===PQRS_WF.CERRADA))return true;
  const wf=getTaskFirmaWf(t);
  if(wf.notificacion&&(wf.notificacion.en||wf.notificacion.a))return true;
  if(wf.notificacion_reportada&&(wf.notificacion_reportada.en||wf.notificacion_reportada.fecha||wf.notificacion_reportada.soporteLink))return true;
  if(t.ultimaRevisionDepto&&t.ultimaRevisionDepto.notificada)return true;
  return false;
}
window.taskPasoPorFirmaDirector=taskPasoPorFirmaDirector;
window.taskFirmaEsNotificada=taskFirmaEsNotificada;
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
  const wf=getTaskFirmaWf(t);
  const subPend=typeof _actEstSubPendienteUi==='function'?_actEstSubPendienteUi:function(s){return{sub:s,subFg:'#a16207',subBg:'#fef9c3'};};
  const est=typeof estadoTask==='function'?estadoTask(t):String(t.estado||'');
  const notifDev=!!(wf.notificacion_devuelta||wf._notif_devuelta_corregir);
  if(est==='Por corregir'&&(notifDev||taskFirmaEnRevisionFinalNotif(t)||(taskFirmaEnPorNotificar(t)&&notifDev))){
    const n=typeof taskCountDevolucionesNotifCorreccion==='function'?taskCountDevolucionesNotifCorreccion(t):(typeof taskCountDevolucionesCorreccion==='function'?taskCountDevolucionesCorreccion(t):0);
    return Object.assign({lbl:'✓ Notificada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Corregir'),{subCount:n});
  }
  if(taskFirmaEnParaFirma(t)||taskFirmaEnPorFirmar(t)){
    if(taskFirmaEnPorFirmar(t)&&taskFirmaEsFirmadoPendiente(t))
      return Object.assign({lbl:'✓ Firmada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Notificar'));
    if(wf.impreso&&wf.impreso.en)
      return Object.assign({lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Firmar'));
    return Object.assign({lbl:'✓ Revisada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Imprimir'));
  }
  if(taskFirmaEnPorNotificar(t))
    return Object.assign({lbl:'✓ Firmada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Notificar'));
  if(taskFirmaEnRevisionFinalNotif(t))
    return Object.assign({lbl:'✓ Notificada',bg:'var(--gnl)',fg:'var(--gn)'},subPend('X Revisar'));
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
  // Quien notificará debe figurar como asignado para ver chat/notas/organizar y la deuda
  if(enNotif&&notifPor){
    nombres.add(notifPor);
    if(Array.isArray(t.responsables)&&!t.responsables.some(function(n){return typeof agendaNorm==='function'?agendaNorm(n)===agendaNorm(notifPor):n===notifPor;}))
      t.responsables=t.responsables.concat([notifPor]);
  }
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
      '<span><strong>Requiere firma del Director</strong> — al aprobar pasa a Por firmar (imprimir → firma → notificar). Si no, se cierra y se notifica al ciudadano.</span>'+
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
        btns+='<button type="button" class="btn bsm bic act-ico act-impreso-btn'+(imp?' act-impreso-on':'')+'" onclick="tramiteMarcarImpreso(\''+eid+'\',\''+tid+'\')" title="'+(imp?'Desmarcar impreso':'Marcar como impreso')+'">'+(imp?'<span class="act-agenda-check" aria-hidden="true">✓</span>':'')+'🖨️</button> ';
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
      btns+='<button type="button" class="btn bsm bp" style="background:var(--gn);border-color:var(--gn)" onclick="openTaskCommentsModal(\''+eid+'\',\''+tid+'\',{revisarEntrega:true})">🧐 Revisar entrega</button> ';
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
    try{
      if(typeof confirmarRegistroPendienteDeEntrega==='function'){
        const eConf=(e&&!e._sin_expediente)?e:null;
        confirmarRegistroPendienteDeEntrega(eConf,tk);
      }
    }catch(errConf){}
    const prev=getTaskFirmaWf(tk);
    const patch={
      fase:faseDest,
      notificar_por:notifPor||prev.notificar_por||'',
      notificar_por_propuesto:notifPor||prev.notificar_por_propuesto||'',
      canal:prev.canal||(prev.notif_correo_entrega===false?'presencial':(tk.notifCorreoEntrega===false?'presencial':'correo')),
      enviado_firma_en:new Date().toISOString(),
      enviado_firma_por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
      impreso:null,
      firma_fisica:null,
      firma_director:null
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
    notif('🖨️ En «Por firmar» — marque 🖨️ cuando esté impreso'+(notifPor?' · Notificará: '+notifPor:''),'ok');
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
    setTaskFirmaWf(expId,taskId,{impreso:null});
    notif('Impreso desmarcado','ok');
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof taskModalIsReviewOpen==='function'&&taskModalIsReviewOpen()&&typeof taskReviewRefreshModal==='function'){
      const refId=(t.sinExpediente?(t.codigo||expId):expId);
      taskReviewRefreshModal(refId,taskId,window._taskReviewSideMode||'doc');
    }
    return;
  }
  setTaskFirmaWf(expId,taskId,{
    impreso:{por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',en:new Date().toISOString()}
  });
  notif('✓ Marcado como impreso','ok');
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof taskModalIsReviewOpen==='function'&&taskModalIsReviewOpen()&&typeof taskReviewRefreshModal==='function'){
    const refId=(t.sinExpediente?(t.codigo||expId):expId);
    taskReviewRefreshModal(refId,taskId,window._taskReviewSideMode||'doc');
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
  // No abrir modal de actividad completo (biblioteca / co-ejecutores) para el Director
  if(puedeDir){
    if(typeof closeTaskModal==='function')closeTaskModal();
    return;
  }
  if(typeof openTaskCommentsModal==='function')openTaskCommentsModal(expId,taskId);
}
/** Oficinas (Documento/comunicado): marcar / desmarcar firma física del Director (como PQRSD). */
function tramiteOficinaToggleFirmaFisica(expId,taskId){
  if(typeof guardMantenimientoSoloConsulta==='function'&&guardMantenimientoSoloConsulta())return;
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  if(!(typeof taskFirmaEnPorFirmar==='function'&&taskFirmaEnPorFirmar(t))){
    notif('El documento no está en «Por firmar»','err');return;
  }
  const puede=tramitePuedeAtajoFirmaGestion(t)
    ||(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())
    ||(typeof esAdministrador==='function'&&esAdministrador());
  if(!puede){notif('No puede marcar firma física','err');return;}
  const wf=getTaskFirmaWf(t);
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  if(wf.firma_fisica&&wf.firma_fisica.en){
    setTaskFirmaWf(expId,taskId,{firma_fisica:null,firma_director:null});
    notif('Firma física desmarcada — sigue en «Por firmar»','ok');
  }else{
    setTaskFirmaWf(expId,taskId,{
      firma_fisica:{por:por,en:new Date().toISOString(),modo:'fisico',registrado_por:'oficina'},
      firma_director:{por:por,en:new Date().toISOString(),modo:'fisico'}
    });
    notif('✓ Firma física marcada — visible para el Director en «Por firmar»','ok');
  }
  if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
  if(typeof renderActividades==='function')renderActividades();
}
/** ✍️ clicable para Documento/comunicado en Por firmar (oficinas). */
function tramiteOficinaFirmaFisicaBtnHtml(expId,taskId,t){
  t=t||(typeof getTaskAny==='function'?getTaskAny(expId,taskId):null);
  if(!t||!(typeof taskFirmaEnPorFirmar==='function'&&taskFirmaEnPorFirmar(t)))return'';
  const wf=getTaskFirmaWf(t);
  const firm=!!(wf.firma_fisica&&wf.firma_fisica.en);
  const cuando=firm?String(wf.firma_fisica.en||'').slice(0,10):'';
  const tip=firm
    ?('Firma física marcada'+(cuando&&typeof fmtF==='function'?' '+fmtF(cuando):(cuando?' '+cuando:''))+(wf.firma_fisica.por?' · '+wf.firma_fisica.por:'')+' — clic para desmarcar')
    :'Marcar que el Director ya firmó (clic de nuevo para desmarcar)';
  const eid=escAttr(expId),tid=escAttr(taskId);
  if(firm){
    return '<button type="button" class="btn bsm bic act-ico act-impreso-btn act-impreso-on" title="'+escAttr(tip)+'" onclick="event.stopPropagation();tramiteOficinaToggleFirmaFisica(\''+eid+'\',\''+tid+'\')"><span class="act-agenda-check" aria-hidden="true">✓</span>✍️</button>';
  }
  return '<button type="button" class="btn bsm bic act-ico" title="'+escAttr(tip)+'" onclick="event.stopPropagation();tramiteOficinaToggleFirmaFisica(\''+eid+'\',\''+tid+'\')">✍️</button>';
}
window.tramiteOficinaToggleFirmaFisica=tramiteOficinaToggleFirmaFisica;
window.tramiteOficinaFirmaFisicaBtnHtml=tramiteOficinaFirmaFisicaBtnHtml;

function tramitePasarAPorNotificar(expId,taskId){
  const t=getTaskAny(expId,taskId);
  const wf=getTaskFirmaWf(t);
  if(!(wf.firma_fisica&&wf.firma_fisica.en)){notif('Marque primero como firmado','err');return;}
  const inicio=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const notifPor=String(wf.notificar_por||wf.notificar_por_propuesto||'').trim();
  // Si hay notificador designado (aunque sea el encargado/VITAL), siempre plazo 5 días
  const sinPlazo=!notifPor&&(String(wf.canal||'').trim().toLowerCase()==='correo'||wf.notif_correo_entrega===true);
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
  if(notifPor){patch.notificar_por=notifPor;patch.notificar_por_propuesto=notifPor;}
  setTaskFirmaWf(expId,taskId,patch);
  if(typeof mutateTask==='function'){
    mutateTask(expId,taskId,function(tk){tramiteSincronizarParticipacionPostAprobacionFirma(tk);});
  }
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
  const dest=String(wf.email_to||'').trim();
  const sugTram=typeof htmlCorreosSugeridosNotificacion==='function'?htmlCorreosSugeridosNotificacion(e&&!e._sin_expediente?e:null,t):'';
  const asuntoDef=String(wf.email_subject||wf.asunto||'').trim()||(t.sinExpediente
    ?('Documento aprobado — '+(t.actividad||t.desc||t.codigo||'actividad'))
    :('Documento aprobado — expediente '+((e&&e._exp)||'')));
  const cuerpoDef=String(wf.cuerpo||wf.email_body||'').trim()||(t.sinExpediente
    ?('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» ha sido aprobado y notificado.\n\nCordialmente.')
    :('Estimado(a),\n\nLe informamos que el documento de la actividad «'+(t.actividad||t.desc||'')+'» del expediente '+((e&&e._exp)||'')+' ha sido aprobado y notificado.\n\nPuede consultarlo en la consulta ciudadana de la Corporación CDA.\n\nCordialmente.'));
  const isCorreo=canal==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO);
  const docsNotif=typeof collectDocsParaNotificacionCorreo==='function'?collectDocsParaNotificacionCorreo(e&&!e._sin_expediente?e:null,t):[];
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
    (typeof renderAdjuntosNotificacionPreviewHtml==='function'
      ?renderAdjuntosNotificacionPreviewHtml(docsNotif,{title:'📎 Documento y anexos que se enviarán'})
      :('<div style="margin-bottom:10px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:4px">📄 Documento firmado</div>'+
        tramiteDocsFirmadosHtml(t,wf)+
        '</div>'))+
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
    sugTram+
    '<div class="fld" style="margin-bottom:6px"><label>Para <span class="req-star">*</span></label><input type="text" id="tramite-notif-to" class="sst-email-chips" value="'+escAttr(dest)+'" placeholder="correo1@ejemplo.com, …"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Cc (opcional)</label><input type="text" id="tramite-notif-cc" class="sst-email-chips" value="'+escAttr(String(wf.email_cc||'').trim())+'"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Cco (opcional)</label><input type="text" id="tramite-notif-bcc" class="sst-email-chips" value="'+escAttr(String(wf.email_bcc||'').trim())+'"></div>'+
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
    (typeof htmlTramiteNotifActoVencBlock==='function'?htmlTramiteNotifActoVencBlock(e,t):'')+
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
  if(typeof syncTramiteNotifActoVencUi==='function')syncTramiteNotifActoVencUi();
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

/** Formulario lateral 📬: reportar notificación (presencial / WhatsApp / aviso) para revisión del encargado. */
function renderTaskReviewNotificarSideHtml(expId,taskId,t){
  t=t||(typeof getTaskAny==='function'?getTaskAny(expId,taskId):null);
  if(!t)return'<div style="padding:12px;font-size:12px;color:var(--tx3)">Actividad no encontrada</div>';
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const wf=typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t):(t.firmaWf||{});
  let canal=String(wf.canal||'').trim().toLowerCase();
  if(!canal||canal==='correo'||canal==='electronica'||(typeof PQRS_WF_CANAL!=='undefined'&&canal===PQRS_WF_CANAL.CORREO))
    canal=(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.PRESENCIAL:'presencial');
  const canalBtns=
    '<button type="button" class="btn bsm canal-resp-btn'+(canal==='presencial'||canal==='fisica'?' on':'')+'" data-val="presencial" onclick="tramiteNotifSetCanal(\'presencial\')">🤝 Presencial</button>'+
    '<button type="button" class="btn bsm canal-resp-btn'+(canal==='whatsapp'?' on':'')+'" data-val="whatsapp" onclick="tramiteNotifSetCanal(\'whatsapp\')">💬 WhatsApp</button>'+
    '<button type="button" class="btn bsm canal-resp-btn'+(canal==='aviso'||canal==='avisos'?' on':'')+'" data-val="aviso" onclick="tramiteNotifSetCanal(\'aviso\')">📌 Por aviso</button>';
  const ctxDoc='tramite-notif-doc:'+refId+':'+taskId;
  const pickDoc=typeof sstFilePickBlock==='function'
    ?sstFilePickBlock({inputId:'tramite-notif-doc-file',listId:'tramite-notif-doc-list',ctxKey:ctxDoc,label:'Cargar documento notificado',accept:'.pdf,.png,.jpg,.jpeg,application/pdf,image/*',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
    :'<input type="file" id="tramite-notif-doc-file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*">';
  return '<div class="task-review-side-scroll" style="padding:10px 12px">'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:10px">📬 Reportar notificación</div>'+
    '<div class="fld" style="margin-bottom:8px"><label style="font-weight:600;font-size:12px">Medio de notificación</label>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-top:4px" id="tramite-notif-canal-btns">'+canalBtns+'</div>'+
    '<input type="hidden" id="tramite-notif-canal" value="'+escAttr(canal)+'"></div>'+
    '<div id="tramite-notif-correo-box" style="display:none"></div>'+
    '<div id="tramite-notif-otro-box">'+
    '<div class="fld" style="margin-bottom:8px"><label>Fecha de notificación<span class="req-star">*</span></label><input type="date" id="tramite-notif-fecha" value="'+escAttr(typeof hoy==='function'?hoy():'')+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Observación</label><textarea id="tramite-notif-obs" placeholder="Ej. Entregado en ventanilla / WhatsApp…" style="min-height:56px;width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px"></textarea></div>'+
    '<div class="fld" style="margin-bottom:10px"><label style="font-weight:600;font-size:12px">Documento notificado<span class="req-star">*</span></label>'+
    '<div class="sst-file-pick-row" style="margin-top:4px">'+pickDoc+'</div></div>'+
    '</div>'+
    '<button type="button" class="btn bsm bp" id="tramite-notif-btn" style="width:100%" onclick="submitTramiteNotificar(\''+escAttr(refId)+'\',\''+escAttr(taskId)+'\')">✅ Reportar como notificado</button>'+
    '</div>';
}
function initTaskReviewNotificarSide(expId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const refId=t&&t.sinExpediente?(t.codigo||expId):expId;
  if(typeof sstFileStagingReset==='function'){
    sstFileStagingReset('tramite-notif-doc:'+refId+':'+taskId);
    sstFileStagingReset('tramite-notif-oficio:'+refId+':'+taskId);
    sstFileStagingReset('tramite-notif-soporte:'+refId+':'+taskId);
  }
  if(typeof sstFileInitPick==='function')sstFileInitPick('tramite-notif-doc-file');
}
window.renderTaskReviewNotificarSideHtml=renderTaskReviewNotificarSideHtml;
window.initTaskReviewNotificarSide=initTaskReviewNotificarSide;
window.tramiteNotifSetCanal=tramiteNotifSetCanal;

/** Ventana standalone 📬 (desde la fila): mismo formulario del panel, sin rail de documento. */
function openActReportarNotificacion(expId,taskId){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return;}
  const e=typeof getExpById==='function'?getExpById(expId):null;
  const esPqrs=e&&typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e)
    &&typeof pqrsEnFaseNotificacion==='function'&&pqrsEnFaseNotificacion(e);
  if(esPqrs){
    if(typeof pqrsPuedeNotificarOficio==='function'&&!pqrsPuedeNotificarOficio(e)){
      notif('No puede notificar esta PQRSD','err');return;
    }
  }else if(typeof tramitePuedeNotificar==='function'&&!tramitePuedeNotificar(t)){
    notif('No puede notificar esta actividad (revise quién está designado)','err');return;
  }
  const refId=t.sinExpediente?(t.codigo||expId):expId;
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Reportar notificación · '+(t.sinExpediente?(t.codigo||refId):((e&&e._exp)||refId));
  if(modal){
    modal.classList.remove('task-modal-wide','task-modal-review','task-modal-resp-ver','task-modal-review-wa-side','task-modal-archivos','task-modal-chat');
    modal.classList.add('enviar-modal-only');
  }
  document.body.classList.remove('task-review-doc-mode');
  const formHtml=esPqrs&&typeof renderTaskReviewPqrsNotificarSideHtml==='function'
    ?renderTaskReviewPqrsNotificarSideHtml(refId,taskId,e,t)
    :(typeof renderTaskReviewNotificarSideHtml==='function'?renderTaskReviewNotificarSideHtml(refId,taskId,t):'');
  body.innerHTML='<div style="max-width:480px;margin:0 auto">'+formHtml+'</div>';
  ov.classList.add('on');
  window._taskModalCtx={expId:refId,taskId:taskId,mode:'reportarNotificacion',actLibre:!!t.sinExpediente};
  setTimeout(function(){
    if(esPqrs&&typeof initTaskReviewPqrsNotificarSide==='function')initTaskReviewPqrsNotificarSide(refId);
    else if(typeof initTaskReviewNotificarSide==='function')initTaskReviewNotificarSide(refId,taskId);
  },40);
}
window.openActReportarNotificacion=openActReportarNotificacion;

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

  let actoVencPayload=null;
  if(typeof collectTramiteNotifActoVencimiento==='function'){
    actoVencPayload=collectTramiteNotifActoVencimiento();
    if(actoVencPayload===false){
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
      return;
    }
  }
  const applyActoVenc=function(){
    if(!actoVencPayload||typeof applyActoVencimientoDesdeNotificacion!=='function')return true;
    const eAct=(!t.sinExpediente&&typeof getExpById==='function')?getExpById(refId):(e&&e._exp?e:null);
    if(!eAct||eAct._sin_expediente)return true;
    return applyActoVencimientoDesdeNotificacion(eAct,t,actoVencPayload);
  };

  // Documento notificado único (panel responsable) o legado soporte/oficio
  const ctxDoc='tramite-notif-doc:'+refId+':'+taskId;
  const ctxOfi='tramite-notif-oficio:'+refId+':'+taskId;
  const ctxSopLegacy='tramite-notif-soporte:'+refId+':'+taskId;
  const itDoc=(typeof sstFileGetMainItem==='function'&&(sstFileGetMainItem(ctxDoc)||sstFileGetMainItem(ctxSopLegacy)||sstFileGetMainItem(ctxOfi)))||null;
  const fileDoc=(itDoc&&itDoc.blob)
    ||window._tramiteNotifSoporteFile
    ||window._tramiteNotifOficioFile
    ||((document.getElementById('tramite-notif-doc-file')||{}).files||[])[0]
    ||((document.getElementById('tramite-notif-soporte')||{}).files||[])[0]
    ||((document.getElementById('tramite-notif-oficio-file')||{}).files||[])[0]
    ||null;

  if(isCorreo){
    const toRaw=String((document.getElementById('tramite-notif-to')||{}).value||'').trim();
    const asunto=String((document.getElementById('tramite-notif-asunto')||{}).value||'').trim();
    const cuerpo=String((document.getElementById('tramite-notif-cuerpo')||{}).value||'').trim();
    const destinos=toRaw.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
    if(!destinos.length){notif('Indique al menos un correo destino','err');if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    if(!cuerpo){notif('Indique el mensaje','err');if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    const htmlBody='<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">'+escAttr(cuerpo).replace(/\n/g,'<br>')+'</div>';
    let adjuntos=[];
    try{
      if(typeof sstSolicitarGmailParaAdjuntar==='function'){
        const okG=await sstSolicitarGmailParaAdjuntar();
        if(!okG){if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
      }
      if(btn)btn.textContent='Preparando adjuntos…';
      const emailCc=String((document.getElementById('tramite-notif-cc')||{}).value||'').trim();
      const emailBcc=String((document.getElementById('tramite-notif-bcc')||{}).value||'').trim();
      if(typeof pqrsPrepararAdjuntosNotificacionCorreo==='function')
        adjuntos=await pqrsPrepararAdjuntosNotificacionCorreo(null,{e:e&&!e._sin_expediente?e:null,t:t});
      else if(typeof taskReviewAdjuntosDesdeSoportes==='function')
        adjuntos=await taskReviewAdjuntosDesdeSoportes(t,e&&!e._sin_expediente?e:null);
      if(typeof registrarSoporteEnvioCorreoNotif==='function')
        await registrarSoporteEnvioCorreoNotif(e&&!e._sin_expediente?e:null,t,refId,{para:destinos.join(', '),cc:emailCc,bcc:emailBcc,asunto:asunto,cuerpo:cuerpo,por:por},adjuntos);
      if(btn)btn.textContent='Enviando correo…';
      if(typeof pqrsEnviarCorreoCiudadano==='function'){
        await pqrsEnviarCorreoCiudadano(destinos,asunto,htmlBody,true,adjuntos,{cc:emailCc,bcc:emailBcc,expediente:e&&!e._sin_expediente?e:null,oficinaId:(e&&e._depto)||t.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'guaviare')});
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
    if(t&&t.soportes&&typeof mutateTask==='function'){
      mutateTask(refId,taskId,function(tk){tk.soportes=(t.soportes||[]).slice();});
    }
    if(!applyActoVenc()){
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
      return;
    }
    await finalizarTramiteTrasPublicar(refId,taskId,{via:'notificacion',destinos:destinos,canal:'correo'});
    notif('📬 Notificado por correo'+(adjuntos.length?' · '+adjuntos.length+' adjunto(s)':'')+' y actividad cerrada','ok');
    closeTaskModal();
    return;
  }

  // Canales no correo → documento notificado + revisión final del departamento
  const fechaN=String((document.getElementById('tramite-notif-fecha')||{}).value||(typeof hoy==='function'?hoy():'')).trim()||(typeof hoy==='function'?hoy():'');
  const obs=String((document.getElementById('tramite-notif-obs')||{}).value||'').trim();
  if(!fileDoc&&!itDoc){
    notif('Cargue el documento notificado','err');
    if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
    return;
  }
  try{
    if(btn)btn.textContent='Subiendo documento notificado…';
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG){if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}return;}
    }
    const res=(itDoc&&itDoc.state==='uploaded'&&itDoc.uploaded)
      ?{driveLink:itDoc.uploaded.driveLink||itDoc.uploaded.previewLink,fileId:itDoc.uploaded.fileId||itDoc.uploaded.driveFileId,nombre:itDoc.uploaded.nombre||itDoc.nombre,previewLink:itDoc.uploaded.previewLink||itDoc.uploaded.driveLink}
      :await tramiteUploadPdfFirmado(fileDoc,t,e,refId);
    const nomDoc=(res&&res.nombre)||(fileDoc&&fileDoc.name)||(itDoc&&itDoc.nombre)||'documento-notificado.pdf';
    mutateTask(refId,taskId,function(tk){
      const prev=getTaskFirmaWf(tk);
      const docs=(prev.documentos||[]).slice();
      docs.push({
        nombre:'Documento notificado '+canal+' — '+nomDoc,
        driveLink:res&&(res.driveLink||res.previewLink)||'',
        previewLink:res&&(res.previewLink||res.driveLink)||'',
        fileId:res&&(res.fileId||res.driveFileId)||'',
        tipo:'notificacion_soporte',
        driveEstado:'revision_final',
        canal:canal,
        notificado:true
      });
      if(!Array.isArray(tk.soportes))tk.soportes=[];
      if(res&&(res.fileId||res.driveFileId)){
        tk.soportes.push({
          id:'sop_'+Date.now(),
          nombre:nomDoc,
          label:'Documento notificado',
          driveFileId:res.fileId||res.driveFileId,
          driveLink:res.driveLink||'',
          previewLink:res.previewLink||res.driveLink||'',
          url:res.driveLink||res.previewLink||'',
          preview:res.previewLink||res.driveLink||'',
          driveInstitutional:true,
          autor:por,
          fecha:fechaN,
          tipo:'notificacion_soporte',
          notificado:true,
          driveEstado:'revision_final',
          es_proyeccion:false,
          activo:true,
          version:1
        });
      }
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({
        tipo:'notif_reportada_revision',
        fecha:typeof hoy==='function'?hoy():fechaN,
        por:por,
        nota:'Notificación '+canal+' reportada con documento notificado — pendiente revisión del departamento'+(obs?' · '+obs:'')
      });
      tk.firmaWf=Object.assign({},prev,{
        fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.REVISION_FINAL:'revision_final_nca'),
        canal:canal,
        documentos:docs,
        notificacion_devuelta:null,
        _notif_devuelta_corregir:false,
        notificacion_reportada:{
          fecha:fechaN,
          obs:obs,
          por:por,
          en:new Date().toISOString(),
          soporteLink:res&&(res.driveLink||'')||'',
          soporteFileId:res&&(res.fileId||res.driveFileId)||'',
          soporteNombre:nomDoc
        }
      });
      if(typeof marcarActividadTrasNotifReportada==='function')
        marcarActividadTrasNotifReportada(tk,por,fechaN);
    });
    window._tramiteNotifSoporteFile=null;
    window._tramiteNotifOficioFile=null;
    if(typeof sstFileStagingReset==='function'){
      sstFileStagingReset(ctxDoc);
      sstFileStagingReset(ctxOfi);
      sstFileStagingReset(ctxSopLegacy);
    }
    if(!applyActoVenc()){
      if(btn){btn.disabled=false;btn.textContent='✅ Confirmar notificación';}
      return;
    }
    notif('⏳ Documento cargado — pasa a revisión del departamento para cerrar','ok');
    closeTaskModal();
    if(typeof renderActividades==='function')renderActividades();
  }catch(err){
    notif('No se pudo subir el documento notificado: '+String(err.message||err).slice(0,90),'err');
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
    t.ultimaRevisionDepto={tipo:'aprobada',fecha:fechaC,por:taskComentarioAutor(),nota:opts.via==='notificacion'?'Aprobada y notificada':'Actividad aprobada y publicada',notificada:opts.via==='notificacion'};
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
    // Si hubo firma + notificación: quitar proyección intermedia (queda Firma. + Not.)
    if(opts.via==='notificacion'&&Array.isArray(t.soportes)&&t.soportes.length){
      const hasFirm=t.soportes.some(function(s){return typeof soporteEsDocumentoFirmado==='function'&&soporteEsDocumentoFirmado(s);});
      const hasNot=t.soportes.some(function(s){return typeof soporteEsDocumentoNotificado==='function'&&soporteEsDocumentoNotificado(s);});
      if(hasFirm&&hasNot){
        const drop=[];
        t.soportes=t.soportes.filter(function(s){
          if(!s)return false;
          if(typeof soporteEsAnexoEntrega==='function'&&soporteEsAnexoEntrega(s))return true;
          if(typeof soporteEsDocumentoFirmado==='function'&&soporteEsDocumentoFirmado(s))return true;
          if(typeof soporteEsDocumentoNotificado==='function'&&soporteEsDocumentoNotificado(s))return true;
          drop.push(s);
          return false;
        });
        // Borrado Drive async fuera de mutate (best-effort)
        window._tramiteDropProyPend=(window._tramiteDropProyPend||[]).concat(drop.map(function(s){return s.driveFileId||s.fileId;}).filter(Boolean));
      }
    }
    if(typeof syncTaskAggregateState==='function')syncTaskAggregateState(t);
  });
  const dropIds=window._tramiteDropProyPend||[];
  window._tramiteDropProyPend=[];
  if(dropIds.length&&typeof driveDeleteInstitutional==='function'){
    for(let i=0;i<dropIds.length;i++){
      try{await driveDeleteInstitutional(dropIds[i]);}catch(err){}
    }
  }
  if(opts.via==='notificacion'&&typeof applyConceptoReqDesdeNotificacion==='function'){
    try{
      const eNot=typeof getExpById==='function'?getExpById(expId):null;
      const tNot=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
      const fechaN=(tNot&&tNot.firmaWf&&tNot.firmaWf.notificacion_reportada&&tNot.firmaWf.notificacion_reportada.fecha)
        ||fechaC;
      if(eNot&&tNot)applyConceptoReqDesdeNotificacion(eNot,tNot,fechaN,opts.canal||'');
    }catch(errN){console.warn('applyConceptoReqDesdeNotificacion',errN);}
  }
  if(typeof renderActividades==='function')renderActividades();
  if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
}

async function notificarCiudadanoTrasVerificarTramite(expId,taskId){
  const e=getExpById(expId);
  if(!e)return;
  const t=getTaskFromExp(e,taskId);
  const actNom=String((t&&(t.actividad||t.desc))||'').trim();
  const esConceptoSeg=/concepto\s+de\s+seguimiento/i.test(actNom);
  const wf=(t&&typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t):null)||(t&&t.firmaWf)||{};
  let correos=String(wf.email_to||'').split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s&&s.includes('@');});
  if(!correos.length&&t&&t.interesadoCorreo){
    const v=String(t.interesadoCorreo||'').trim().toLowerCase();
    if(v&&v.includes('@'))correos=[v];
  }
  if(!correos.length){
    if(esConceptoSeg&&typeof notif==='function')
      notif('Concepto de seguimiento aprobado, pero no hay destinatarios digitados en Para para notificar','warn');
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
  const esDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  const tasks=(modo==='firmados'&&esDir)
    ?getTareasTramiteFirmaDirectorSeguimiento()
    :getTareasTramiteFirmaPorFase(function(t){
      if(modo==='firmados')return taskFirmaEsFirmadoPendiente(t);
      if(modo==='por_notificar')return taskFirmaEnPorNotificar(t)||taskFirmaEnRevisionFinalNotif(t);
      if(!taskFirmaEnPorFirmar(t))return false;
      // Director: firmados físicos van a «Firmados». VITAL/oficina: siguen en «Por firmar».
      if(esDir&&taskFirmaEsFirmadoPendiente(t))return false;
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
/** Director «Firmados»: trámites que ya firmó (incluye por notificar y cerrados). */
function getTareasTramiteFirmaDirectorSeguimiento(){
  const out=[];
  const pushT=function(t,e){
    if(!t||t.eliminada||!taskPasoPorFirmaDirector(t))return;
    const tramObj=e&&typeof getTram==='function'?getTram(e._tramite,e):null;
    const nt=typeof normalizeTask==='function'?normalizeTask(Object.assign({},t,{
      codigo:(e&&e._exp)||t.codigo||t.exp,
      exp:(e&&e._exp)||t.exp||t.codigo,
      tram:tramObj?tramObj.nombre:((e&&e._tramite)||(t.sinExpediente?'Actividad':'')),
      nombre:e?(typeof getNom==='function'?getNom(e):''):(t.nombre||'(Sin expediente)'),
      depto:(e&&e._depto)||t.depto||'',
      sinExpediente:!!t.sinExpediente
    })):t;
    out.push(nt);
  };
  (typeof exps!=='undefined'?exps:[]).forEach(function(e){
    if(!e||(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)))return;
    if(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))return;
    (e.tasks||[]).forEach(function(t){pushT(t,e);});
  });
  (typeof actividadesLibres!=='undefined'?actividadesLibres:[]).forEach(function(raw){
    const t=typeof normalizeActLibre==='function'?normalizeActLibre(raw):(raw||{});
    pushT(t,null);
  });
  return out;
}
window.getTareasTramiteFirmaDirectorSeguimiento=getTareasTramiteFirmaDirectorSeguimiento;
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
  const refId=t.sinExpediente?(t.codigo||expId):expId;
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
  if(modal){
    if(mode==='ya_firmado'){
      modal.classList.remove('task-modal-wide','task-modal-firma');
      modal.classList.add('enviar-modal-only','task-modal-firma-fisica');
    }else{
      modal.classList.remove('enviar-modal-only','task-modal-firma-fisica');
      modal.classList.add('task-modal-wide');
      modal.classList.add('task-modal-firma');
    }
  }
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
    titulo='📤 Cargar documento firmado — '+expLbl;
    const dirPdfCtx=typeof sstFileCtxKeyTramiteDirectorPdf==='function'?sstFileCtxKeyTramiteDirectorPdf(refId,taskId):('tramite-director-pdf:'+refId+':'+taskId);
    const dirPdfPick=typeof sstFilePickBlock==='function'
      ?sstFilePickBlock({inputId:'tramite-director-pdf-file',listId:'tramite-director-pdf-list',ctxKey:dirPdfCtx,label:'Seleccionar PDF firmado',accept:'.pdf,application/pdf'})
      :'';
    let selNotif='';
    if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e){
      selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||'',{
        modo:'firma',id:'tramite-notif-por-sel',todosResponsables:true,deptoId:(e&&e._depto)||t.depto
      });
    }
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Cargar PDF ya firmado</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">Suba el documento firmado. Pasará a <strong>Por notificar</strong> a la persona designada (puede cambiarla).</div>'+
      preview+infoReadonly+
      (selNotif?'<div style="margin-bottom:12px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)">'+selNotif+'</div>':'')+
      '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:#0d5c2e08">'+
      dirPdfPick+
      '</div>'+
      '<div class="pqrs-firma-actions">'+
      '<button type="button" class="btn bsm bp" id="tramite-director-firmar-btn" onclick="tramiteDirectorConfirmarFirmado(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">📤 Confirmar y pasar a notificar</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }else if(mode==='ya_firmado'){
    titulo='✍️ Firma física — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Confirmar firma física</div>'+
      infoReadonly+
      '<div class="pqrs-firma-actions">'+
      '<button type="button" class="btn bsm" style="background:#15803d;color:#fff;border-color:#15803d" onclick="tramiteDirectorMarcarYaFirmado(\''+escAttr(expId)+'\',\''+escAttr(taskId)+'\')">✍️ Confirmar firma física</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  }else if(mode==='devolver'){
    titulo='↩ Devolver documento — '+expLbl;
    html='<div style="font-size:13px;font-weight:600;margin-bottom:.35rem">Devolver por error / corrección</div>'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">La actividad quedará <strong>Por corregir</strong> (por ejecutar) para el encargado u oficina.</div>'+
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
    firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString(),modo:'fisico'},
    firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),modo:'fisico'}
  });
  closeTaskModal();
  notif('✍️ Firma física registrada — queda en «Firmados»','ok');
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
      if(!okG){if(btn){btn.disabled=false;btn.textContent='📤 Confirmar y pasar a notificar';}return;}
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
    const sinPlazo=esCorreo;
    let vence='';
    if(!sinPlazo&&typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
    let notifPor=typeof _pqrsLeerNotifPorSel==='function'?_pqrsLeerNotifPorSel('tramite-notif-por-sel'):'';
    if(!notifPor)notifPor=String(wfPrev.notificar_por||wfPrev.notificar_por_propuesto||'').trim();
    const patchNotif={
      fase:(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion'),
      firma_director:{por:taskComentarioAutor(),en:new Date().toISOString(),pdfLink:pdfLink,modo:'digital'},
      firma_fisica:null,
      notif_inicio:inicio,
      notif_vence:vence,
      notif_plazo_dias:sinPlazo?0:5,
      notif_sin_plazo:!!sinPlazo
    };
    if(notifPor){
      if(sinPlazo)patchNotif.notificar_por_propuesto=notifPor;
      else{patchNotif.notificar_por=notifPor;patchNotif.notificar_por_propuesto=notifPor;}
    }
    setTaskFirmaWf(expId,taskId,patchNotif);
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteDirectorSignedFile=null;
    closeTaskModal();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof renderActividades==='function')renderActividades();
  }catch(err){
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('Error: '+String(err.message||err).slice(0,100),'err');
    if(btn){btn.disabled=false;btn.textContent='📤 Confirmar y pasar a notificar';}
  }
}
function tramiteDirectorDevolver(expId,taskId){
  const motivo=String((document.getElementById('tramite-director-devolver-motivo')||{}).value||'').trim();
  if(!motivo){notif('Indique el motivo de la devolución','err');return;}
  if(typeof directorDevolverDesdePorFirmar==='function'){
    directorDevolverDesdePorFirmar(expId,taskId,motivo);
    return;
  }
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
    if(typeof resetTaskPorCorregir==='function')resetTaskPorCorregir(tk,motivo);
    else{
      tk.fechaAtendida='';
      tk.verificadoPor='';
      tk.estado='Por corregir';
    }
    if(!Array.isArray(tk.comentarios))tk.comentarios=[];
    tk.comentarios.push({autor:por,fecha:new Date().toISOString(),texto:'[Devolución Director — por firmar] '+motivo,rol:'asignador',incluidoEnReporte:false});
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'devuelto_director_firma',fecha:typeof hoy==='function'?hoy():'',ts:Date.now(),por:por,nota:motivo});
  });
  closeTaskModal();
  notif('↩ Documento devuelto — queda por corregir','ok');
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
 * Panel lateral: cargar documento firmado.
 * VITAL/encargado: tras elegir PDF → acordeón (1) notificar por correo · (2) asignar quién notifica.
 */
function renderAtajoFirmadoDocsAnexosHtml(e,t,expId,taskId,esPqrs,ctxKey){
  ctxKey=ctxKey||(typeof sstFileCtxKeyTramiteAtajoFirmado==='function'
    ?sstFileCtxKeyTramiteAtajoFirmado(expId,taskId)
    :('tramite-atajo-firmado:'+expId+':'+taskId));
  const docs=typeof collectDocsParaNotificacionCorreo==='function'?collectDocsParaNotificacionCorreo(e,t):[];
  const anexos=docs.filter(function(d){
    if(!d||d.excluido_notif)return false;
    return d._notif_rol==='anexo'
      ||(typeof _pqrsDocEsAnexoRespuesta==='function'&&_pqrsDocEsAnexoRespuesta(d))
      ||(typeof soporteEsAnexoEntrega==='function'&&soporteEsAnexoEntrega(d));
  });
  const eid=escAttr(expId),tid=escAttr(taskId);
  const it=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
  const listo=!!(it&&(it.blob||it.blobUrl||it.state==='uploaded'||it.state==='uploading'||it.nombre));
  let h='<div id="atajo-firmado-docs-box" data-atajo-ctx="'+escAttr(ctxKey)+'" data-atajo-exp="'+eid+'" data-atajo-task="'+tid+'" data-atajo-pqrs="'+(esPqrs?'1':'0')+'" style="margin:8px 0 12px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">';
  h+='<div style="font-size:12px;font-weight:600;margin-bottom:6px">Documentos para notificar</div>';
  if(listo){
    const lbl=String(it.nombre||'Documento firmado.pdf').trim();
    const canPrev=!!(it.blobUrl||it.previewLink||it.driveLink||it.blob);
    const previewBtn=canPrev
      ?('<button type="button" class="btn bsm bic act-ico" onclick="sstFilePreview(\''+jsStr(ctxKey)+'\',\''+jsStr(it.id)+'\')" title="Ver documento">🔍</button>')
      :'';
    const delBtn='<button type="button" class="btn bsm bic act-ico bd2" onclick="atajoFirmadoQuitarPdfFirmado(\''+jsStr(ctxKey)+'\')" title="Quitar documento">🗑</button>';
    h+='<div class="sst-file-row" style="margin-bottom:6px">'+
      '<span class="sst-file-row-name" title="'+escAttr(lbl)+'">📄 '+escAttr(lbl)+'</span>'+
      '<span class="sst-file-row-ok" title="Cargado">✓</span>'+
      '<div class="sst-file-row-actions">'+previewBtn+delBtn+'</div></div>';
  }
  if(anexos.length){
    h+='<div style="font-size:11px;font-weight:600;margin:8px 0 4px;color:var(--tx2)">Anexos aprobados ('+anexos.length+')</div>';
    anexos.forEach(function(d,i){
      const n=d.anexo_n||(typeof _pqrsAnexoNumero==='function'?_pqrsAnexoNumero(d,anexos):0)||(i+1);
      const lbl=String(d.label||d.nombre||('Anexo '+n)).trim();
      const url=String(d.driveLink||d.previewLink||d.url||d.preview||'').trim();
      const key=String(d.id||d.soporteId||d.fileId||d.driveFileId||d.driveLink||lbl||i).trim();
      const keyJs=jsStr(key);
      const previewBtn=url
        ?('<button type="button" class="btn bsm bic act-ico" onclick="atajoFirmadoVerDoc(\''+escAttr(url)+'\',\''+escAttr(lbl)+'\')" title="Ver anexo">🔍</button>')
        :'';
      const delBtn='<button type="button" class="btn bsm bic act-ico bd2" onclick="atajoFirmadoQuitarAnexo(\''+eid+'\',\''+tid+'\','+(esPqrs?'true':'false')+',\''+keyJs+'\')" title="Quitar anexo">🗑</button>';
      h+='<div class="sst-file-row" style="margin-bottom:4px" data-atajo-anx="'+escAttr(key)+'">'+
        '<span class="sst-file-row-name" title="'+escAttr(lbl)+'">📎 '+escAttr(lbl)+'</span>'+
        '<span class="sst-file-row-ok" title="Aprobado">✓</span>'+
        '<div class="sst-file-row-actions">'+previewBtn+delBtn+'</div></div>';
    });
  }else if(listo){
    h+='<div style="font-size:11px;color:var(--tx3);margin-top:4px">Sin anexos en la última entrega aprobada.</div>';
  }
  h+='</div>';
  return h;
}
function atajoFirmadoRefreshDocsBox(){
  const box=document.getElementById('atajo-firmado-docs-box');
  if(!box)return;
  const expId=String(box.getAttribute('data-atajo-exp')||'').trim();
  const taskId=String(box.getAttribute('data-atajo-task')||'').trim();
  const ctxKey=String(box.getAttribute('data-atajo-ctx')||'').trim();
  const esPqrs=box.getAttribute('data-atajo-pqrs')==='1';
  const e=typeof getExpById==='function'?getExpById(expId):null;
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const wrap=document.createElement('div');
  wrap.innerHTML=renderAtajoFirmadoDocsAnexosHtml(e,t,expId,taskId,esPqrs,ctxKey);
  if(wrap.firstChild)box.replaceWith(wrap.firstChild);
}
function atajoFirmadoQuitarPdfFirmado(ctxKey){
  ctxKey=String(ctxKey||'').trim();
  const it=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
  if(it&&typeof sstFileRemove==='function'){
    sstFileRemove(ctxKey,it.id,'tramite-atajo-firmado-list');
  }
  window._tramiteAtajoFirmadoFile=null;
  const inp=document.getElementById('tramite-atajo-firmado-file');
  if(inp)inp.value='';
  atajoFirmadoRefreshDocsBox();
  const post=document.getElementById('task-atajo-firmado-post');
  if(post)post.style.display='none';
}
function atajoFirmadoVerDoc(url,nombre){
  url=String(url||'').trim();
  if(!url){notif('No hay enlace para ver el documento','warn');return;}
  if(typeof openPqrsDocViewer==='function')openPqrsDocViewer(url,nombre||'Documento');
  else window.open(url,'_blank','noopener');
}
function atajoFirmadoDocKey(d){
  if(!d)return'';
  return String(d.id||d.soporteId||d.fileId||d.driveFileId||d.driveLink||d.previewLink||d.url||d.nombre||d.label||'').trim();
}
function atajoFirmadoQuitarAnexo(expId,taskId,esPqrs,docKey){
  docKey=String(docKey||'').trim();
  if(!docKey)return;
  const e=typeof getExpById==='function'?getExpById(expId):null;
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  let changed=false;
  if(esPqrs&&e&&typeof getPqrsWorkflow==='function'&&typeof setPqrsWorkflow==='function'){
    const wf=getPqrsWorkflow(e);
    const docs=Array.isArray(wf.documentos)?wf.documentos.slice():[];
    docs.forEach(function(d){
      if(!d)return;
      if(atajoFirmadoDocKey(d)===docKey||String(d.driveLink||'')===docKey||String(d.fileId||d.driveFileId||'')===docKey){
        d.excluido_notif=true;changed=true;
      }
    });
    if(changed)setPqrsWorkflow(e,{documentos:docs});
  }
  if(t&&Array.isArray(t.soportes)){
    t.soportes.forEach(function(s){
      if(!s)return;
      const k=atajoFirmadoDocKey(s);
      if(k===docKey||String(s.id||'')===docKey){
        s.excluido_notif=true;changed=true;
      }
    });
    if(changed&&e&&!e._sin_expediente&&typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
    else if(changed&&typeof persistExpLocal==='function')persistExpLocal();
  }
  atajoFirmadoRefreshDocsBox();
  notif('Anexo quitado de la notificación','ok');
}
window.renderAtajoFirmadoDocsAnexosHtml=renderAtajoFirmadoDocsAnexosHtml;
window.atajoFirmadoRefreshDocsBox=atajoFirmadoRefreshDocsBox;
window.atajoFirmadoQuitarPdfFirmado=atajoFirmadoQuitarPdfFirmado;
window.atajoFirmadoVerDoc=atajoFirmadoVerDoc;
window.atajoFirmadoQuitarAnexo=atajoFirmadoQuitarAnexo;

function renderTaskReviewAtajoFirmadoHtml(expId,taskId,t,opts){
  opts=opts||{};
  const standalone=!!opts.standalone;
  const refId=t&&t.sinExpediente?(t.codigo||expId):expId;
  const eid=jsStr(refId),tid=jsStr(taskId);
  const e=tramiteFirmaExpCtx(t,expId);
  const esPqrs=e&&!e._sin_expediente&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  const ctx=window._taskModalCtx||{};
  // Director: PDF + quién notifica. Encargado/VITAL: acordeones correo / asignar (también en ventana standalone).
  const esDirRev=!!ctx.directorRevisarPorFirmar||(!standalone&&typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv());
  const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  const pick=typeof sstFilePickBlock==='function'
    ?sstFilePickBlock({inputId:'tramite-atajo-firmado-file',listId:'tramite-atajo-firmado-list',ctxKey:ctxKey,label:'Seleccionar PDF firmado',accept:'application/pdf,.pdf',btnClass:'btn bsm bp',getUploadCtx:typeof sstFileUploadCtxForExpTask==='function'?sstFileUploadCtxForExpTask(refId,taskId):null})
    :'';
  const wf=esPqrs&&typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):(typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t):{});
  const canalRaw=String(wf.canal||'').trim().toLowerCase();
  const notifCorreoFlag=wf.notif_correo_entrega===true||(t&&t.notifCorreoEntrega===true)
    ||canalRaw==='correo'||(typeof PQRS_WF_CANAL!=='undefined'&&canalRaw===PQRS_WF_CANAL.CORREO);
  const notifNoCorreoFlag=wf.notif_correo_entrega===false||(t&&t.notifCorreoEntrega===false)
    ||['presencial','fisica','whatsapp','aviso'].indexOf(canalRaw)>=0;
  const esCorreo=notifCorreoFlag||(!notifNoCorreoFlag&&(canalRaw===''||!!String(wf.email_to||wf.cuerpo||wf.email_body||'').trim()));
  const emailTo=String(wf.email_to||'').trim();
  const emailCc=String(wf.email_cc||'').trim();
  const emailBcc=String(wf.email_bcc||'').trim();
  const emailSubj=String(wf.email_subject||wf.asunto||'').trim();
  const cuerpo=String(wf.cuerpo||wf.email_body||'').trim();
  const tieneDatosCorreo=!!(emailTo||emailCc||emailBcc||emailSubj||cuerpo);
  const destDef=emailTo;
  const sugAtajo=typeof htmlCorreosSugeridosNotificacion==='function'?htmlCorreosSugeridosNotificacion(e&&!e._sin_expediente?e:null,t):'';
  const asuntoDef=emailSubj||((t&&(t.actividad||t.desc))?('Notificación — '+(t.actividad||t.desc)+(e&&e._exp?' — '+e._exp:'')):'Documento firmado');
  let selNotif='';
  if(typeof _pqrsOpcionesNotificadorHtml==='function'&&e){
    selNotif=_pqrsOpcionesNotificadorHtml(e,wf,wf.notificar_por||wf.notificar_por_propuesto||wf.entregado_por||'',{
      modo:'firma',id:'tramite-atajo-notif-por-sel',todosResponsables:true,deptoId:e._depto||(t&&t.depto),
      canal:'presencial',sinLabel:true,sinHint:true
    });
  }
  const docsHtml=renderAtajoFirmadoDocsAnexosHtml(e,t,esPqrs?(e._exp||refId):refId,taskId,esPqrs,ctxKey);
  const pqrsExp=escAttr(esPqrs?(e._exp||refId):refId);
  const confCargar='cargarFirmadoDesdeRail(\''+pqrsExp+'\',\''+tid+'\','+(esPqrs?'true':'false')+',false)';
  const confNotif='cargarFirmadoDesdeRail(\''+pqrsExp+'\',\''+tid+'\','+(esPqrs?'true':'false')+',true)';
  const confOtro='cargarFirmadoDesdeRail(\''+pqrsExp+'\',\''+tid+'\','+(esPqrs?'true':'false')+',\'otro\')';
  const accHtml=typeof renderTaskReviewAprobarAccHtml==='function'?renderTaskReviewAprobarAccHtml:function(n,tit,body,open){
    return '<div class="task-decision-acc'+(open?' is-open':'')+'"><button type="button" class="task-decision-acc-hdr" onclick="taskReviewToggleAprobarAcc(this)"><span class="task-decision-acc-arrow">▸</span><span class="task-decision-acc-tit">'+n+'. '+tit+'</span></button><div class="task-decision-acc-body">'+body+'</div></div>';
  };
  const closeBtn=standalone?'':('<button type="button" class="btn bsm bd2" style="margin-bottom:10px" onclick="taskReviewCloseSidePanel()">← Cerrar</button>');
  const wrapOpen='<div class="'+(standalone?'task-review-atajo-firmado':'task-review-decision-side task-review-side-scroll task-review-atajo-firmado')+'">';
  const esOfiSinResp=typeof atajoFirmadoEsVistaOficinaSinResponsables==='function'&&atajoFirmadoEsVistaOficinaSinResponsables();
  const hoyStr=typeof hoy==='function'?hoy():'';

  if(esDirRev){
    return wrapOpen+closeBtn+
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">📤 Cargar documento firmado</div>'+
      '<div class="sst-file-pick-row" style="margin-bottom:12px">'+pick+'</div>'+
      docsHtml+
      (selNotif?'<div class="fld" style="margin:12px 0"><label>Quién notificará</label>'+selNotif+'</div>':'')+
      '<div id="task-atajo-firmado-post" class="task-atajo-firmado-post" style="display:none">'+
      '<button type="button" class="btn bsm bp" id="tramite-atajo-firmado-btn" onclick="'+confCargar+'">📤 Cargar y pasar para notificar</button>'+
      '</div></div>';
  }

  const emailBlock=
    sugAtajo+
    '<div class="fld" style="margin-bottom:6px"><label>Para <span class="req-star">*</span></label>'+
    '<input type="text" id="tramite-atajo-email-to" class="sst-email-chips" value="'+escAttr(destDef)+'" style="width:100%;box-sizing:border-box"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Cc <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
    '<input type="text" id="tramite-atajo-email-cc" class="sst-email-chips" value="'+escAttr(emailCc)+'" style="width:100%;box-sizing:border-box"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Cco <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
    '<input type="text" id="tramite-atajo-email-bcc" class="sst-email-chips" value="'+escAttr(emailBcc)+'" style="width:100%;box-sizing:border-box"></div>'+
    '<div class="fld" style="margin-bottom:6px"><label>Asunto</label>'+
    '<input type="text" id="tramite-atajo-email-subject" value="'+escAttr(asuntoDef)+'" style="width:100%;box-sizing:border-box"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Cuerpo del correo</label>'+
    '<textarea id="tramite-atajo-email-cuerpo" style="min-height:110px;width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box;font-family:\'DM Sans\',sans-serif;white-space:pre-wrap">'+escAttr(cuerpo)+'</textarea></div>'+
    '<button type="button" class="btn bsm bp" id="tramite-atajo-firmado-btn" style="background:#185fa5;border-color:#185fa5;width:100%" onclick="'+confNotif+'">📬 Cargar y notificar ahora</button>';

  const asignarBlock=
    '<div class="fld" style="margin-bottom:8px"><label>Quién notificará</label>'+(selNotif||'<div style="font-size:11px;color:var(--rd)">No hay opciones de notificador</div>')+'</div>'+
    '<button type="button" class="btn bsm bp" style="background:#0d5c2e;border-color:#0d5c2e;width:100%" onclick="'+confCargar+'">📤 Cargar y pasar a Por notificar</button>';

  // Oficinas: sin asignar responsables → «Notificado por otro medio» (cierra como atendida)
  const otroMedioBlock=
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">No se enviará correo. Elija el medio y se dará por <strong>atendida</strong>.</div>'+
    '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-bottom:8px" id="tramite-atajo-otro-canal-btns">'+
      '<button type="button" class="btn bsm canal-resp-btn on" data-val="presencial" onclick="atajoFirmadoSetOtroCanal(\'presencial\')">🤝 Presencial</button>'+
      '<button type="button" class="btn bsm canal-resp-btn" data-val="whatsapp" onclick="atajoFirmadoSetOtroCanal(\'whatsapp\')">💬 WhatsApp</button>'+
      '<button type="button" class="btn bsm canal-resp-btn" data-val="aviso" onclick="atajoFirmadoSetOtroCanal(\'aviso\')">📌 Por aviso</button>'+
    '</div>'+
    '<input type="hidden" id="tramite-atajo-otro-canal" value="presencial">'+
    '<div class="fld" style="margin-bottom:8px"><label>Fecha de notificación<span class="req-star">*</span></label>'+
      '<input type="date" id="tramite-atajo-otro-fecha" value="'+escAttr(hoyStr)+'"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Observación <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
      '<textarea id="tramite-atajo-otro-obs" placeholder="Ej. Entregado en ventanilla / enviado por WhatsApp…" style="min-height:56px;width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box"></textarea></div>'+
    '<button type="button" class="btn bsm bp" style="background:#0f766e;border-color:#0f766e;width:100%" onclick="'+confOtro+'">✓ Cargar y dar por atendida</button>';

  const postAcc=
    accHtml(1,'Notificar por correo ahora',emailBlock,false)+
    (esOfiSinResp
      ?accHtml(2,'Notificado por otro medio',otroMedioBlock,false)
      :accHtml(2,'Asignar quién notificará',asignarBlock,false));

  return wrapOpen+closeBtn+
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">📤 Cargar documento firmado</div>'+
    '<div class="sst-file-pick-row" style="margin-bottom:12px">'+pick+'</div>'+
    docsHtml+
    '<div id="task-atajo-firmado-post" class="task-atajo-firmado-post" style="display:none;margin-top:10px">'+postAcc+'</div></div>';
}
/** Oficinas DEGUV / Secretaría (sin NCA): no asignan responsables notificados. */
function atajoFirmadoEsVistaOficinaSinResponsables(){
  if(typeof esNcaDeguv==='function'&&esNcaDeguv())return false;
  if(typeof esOficinaPqrsNca==='function'&&esOficinaPqrsNca())return false;
  if(typeof esCargoVital==='function'&&esCargoVital())return false;
  if(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())return false;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto()
    &&!(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv())
    &&!(typeof esSecretaria==='function'&&esSecretaria()))
    return false;
  if(typeof esOficinaPqrsBasica==='function'&&esOficinaPqrsBasica())return true;
  if(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv())return true;
  if(typeof esSecretaria==='function'&&esSecretaria())return true;
  return false;
}
function atajoFirmadoSetOtroCanal(val){
  val=String(val||'presencial').trim().toLowerCase();
  if(val!=='presencial'&&val!=='whatsapp'&&val!=='aviso')val='presencial';
  const hid=document.getElementById('tramite-atajo-otro-canal');
  if(hid)hid.value=val;
  document.querySelectorAll('#tramite-atajo-otro-canal-btns .canal-resp-btn').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-val')===val);
  });
}
window.atajoFirmadoEsVistaOficinaSinResponsables=atajoFirmadoEsVistaOficinaSinResponsables;
window.atajoFirmadoSetOtroCanal=atajoFirmadoSetOtroCanal;
/** Guarda Para/Cc/Cco/asunto/cuerpo digitados en el panel atajo (si existen). */
function atajoFirmadoPersistEmailFields(expId,taskId,esPqrs){
  const toEl=document.getElementById('tramite-atajo-email-to');
  if(!toEl)return;
  const patch={
    email_to:String(toEl.value||'').trim(),
    email_cc:String((document.getElementById('tramite-atajo-email-cc')||{}).value||'').trim(),
    email_bcc:String((document.getElementById('tramite-atajo-email-bcc')||{}).value||'').trim(),
    email_subject:String((document.getElementById('tramite-atajo-email-subject')||{}).value||'').trim(),
    cuerpo:String((document.getElementById('tramite-atajo-email-cuerpo')||{}).value||'').trim(),
    email_body:String((document.getElementById('tramite-atajo-email-cuerpo')||{}).value||'').trim(),
    canal:'correo',
    notif_correo_entrega:true
  };
  if(esPqrs){
    const e=typeof getExpById==='function'?getExpById(expId):null;
    if(e&&typeof setPqrsWorkflow==='function')setPqrsWorkflow(e,patch);
    return;
  }
  if(typeof setTaskFirmaWf==='function')setTaskFirmaWf(expId,taskId,patch);
}
/** Persiste quién notificará (opción 2 NCA/VITAL). El medio lo reporta el responsable al notificar. */
function atajoFirmadoPersistAsignarFields(expId,taskId,esPqrs){
  const notifPor=String((document.getElementById('tramite-atajo-notif-por-sel')||{}).value||'').trim();
  const patch={
    notif_correo_entrega:false
  };
  if(notifPor){
    patch.notificar_por=notifPor;
    patch.notificar_por_propuesto=notifPor;
  }
  if(esPqrs){
    const e=typeof getExpById==='function'?getExpById(expId):null;
    if(e&&typeof setPqrsWorkflow==='function')setPqrsWorkflow(e,patch);
    return;
  }
  if(typeof setTaskFirmaWf==='function')setTaskFirmaWf(expId,taskId,patch);
}
/** Persiste canal/fecha/obs de «Notificado por otro medio» (oficinas). */
function atajoFirmadoPersistOtroMedioFields(expId,taskId,esPqrs){
  let canal=String((document.getElementById('tramite-atajo-otro-canal')||{}).value||'presencial').trim().toLowerCase();
  if(canal!=='presencial'&&canal!=='whatsapp'&&canal!=='aviso')canal='presencial';
  const fecha=String((document.getElementById('tramite-atajo-otro-fecha')||{}).value||'').trim()
    ||(typeof hoy==='function'?hoy():'');
  const obs=String((document.getElementById('tramite-atajo-otro-obs')||{}).value||'').trim();
  const patch={
    canal:canal,
    notif_correo_entrega:false,
    notificar_por:'',
    notificacion:{
      canal:canal,
      fecha:fecha,
      obs:obs,
      por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
      en:new Date().toISOString(),
      atajo_otro_medio:true
    }
  };
  if(esPqrs){
    const e=typeof getExpById==='function'?getExpById(expId):null;
    if(e&&typeof setPqrsWorkflow==='function')setPqrsWorkflow(e,patch);
    return{canal:canal,fecha:fecha,obs:obs};
  }
  if(typeof setTaskFirmaWf==='function')setTaskFirmaWf(expId,taskId,patch);
  return{canal:canal,fecha:fecha,obs:obs};
}
/** Tras cargar PDF firmado: cierra PQRSD o Documento/comunicado como atendida (otro medio). */
async function atajoFirmadoCerrarComoAtendidaOtroMedio(expId,taskId,esPqrs,datos){
  datos=datos||{};
  const canal=String(datos.canal||'presencial').trim()||'presencial';
  const fecha=String(datos.fecha||'').trim()||(typeof hoy==='function'?hoy():'');
  const obs=String(datos.obs||'').trim();
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor()
    :(typeof responsableActivo!=='undefined'?responsableActivo:'');
  const medioLbl=typeof medioNotificacionRespLabel==='function'?medioNotificacionRespLabel(canal):canal;
  if(esPqrs){
    const e=typeof getExpById==='function'?getExpById(expId):null;
    if(!e){notif('PQRSD no encontrada','err');return false;}
    const wf=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
    const docs=(wf.documentos||[]).map(function(d){
      if(!d)return d;
      if(d.es_anexo||d.tipo==='anexo_respuesta')return d;
      return Object.assign({},d,{driveEstado:'cerrado'});
    });
    if(typeof setPqrsWorkflow==='function'){
      setPqrsWorkflow(e,{
        fase:typeof PQRS_WF!=='undefined'?PQRS_WF.CERRADA:'cerrada_atendida',
        canal:canal,
        documentos:docs,
        notif_correo_entrega:false,
        notificacion:{canal:canal,fecha:fecha,obs:obs,por:por,en:new Date().toISOString(),atajo_otro_medio:true},
        cerrado_por:por,
        cerrado_en:new Date().toISOString(),
        fecha_respuesta:wf.fecha_respuesta||fecha
      });
    }
    e._pqrs_respuesta_medio=canal;
    e._medio_notificacion=canal;
    if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
    e._pqrs_historial.push({
      tipo:'notif_otro_medio_atajo',
      fecha:fecha,
      nota:'Oficio firmado notificado por '+medioLbl+(obs?' · '+obs:'')+' — '+por,
      oficina:e._pqrs_oficina||'',
      por:por
    });
    if(typeof _pqrsAplicarCierrePqrsYLimpiarDocs==='function')
      await _pqrsAplicarCierrePqrsYLimpiarDocs(e,fecha,'PQRSD cerrada — notificada por '+medioLbl);
    if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e);
    notif('✅ Notificado por '+medioLbl+' — PQRSD atendida','ok');
    return true;
  }
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const refId=(t&&t.sinExpediente)?(t.codigo||expId):expId;
  if(typeof finalizarTramiteTrasPublicar==='function')
    await finalizarTramiteTrasPublicar(refId,taskId,{via:'notificacion',canal:canal,destinos:[]});
  if(typeof setTaskFirmaWf==='function'){
    setTaskFirmaWf(refId,taskId,{
      canal:canal,
      notif_correo_entrega:false,
      notificacion:{canal:canal,fecha:fecha,obs:obs,por:por,en:new Date().toISOString(),atajo_otro_medio:true}
    });
  }
  notif('✅ Notificado por '+medioLbl+' — actividad atendida','ok');
  return true;
}
window.atajoFirmadoPersistOtroMedioFields=atajoFirmadoPersistOtroMedioFields;
window.atajoFirmadoCerrarComoAtendidaOtroMedio=atajoFirmadoCerrarComoAtendidaOtroMedio;
/** Tras cargar firmado con opción correo: envía y cierra sin abrir otra ventana. */
async function tramiteAtajoEnviarCorreoDirecto(refId,taskId){
  const t=typeof getTaskAny==='function'?getTaskAny(refId,taskId):null;
  if(!t){notif('Actividad no encontrada','err');return false;}
  const e=typeof tramiteFirmaExpCtx==='function'?tramiteFirmaExpCtx(t,refId):null;
  const wf=typeof getTaskFirmaWf==='function'?getTaskFirmaWf(t):(t.firmaWf||{});
  const toRaw=String(wf.email_to||'').trim();
  const asunto=String(wf.email_subject||wf.asunto||'').trim()||('Documento firmado — '+(t.actividad||t.desc||refId));
  const cuerpo=String(wf.cuerpo||wf.email_body||'').trim();
  const destinos=toRaw.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
  if(!destinos.length){notif('Indique al menos un correo destino','err');return false;}
  if(!cuerpo){notif('Indique el mensaje','err');return false;}
  const htmlBody='<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">'+escAttr(cuerpo).replace(/\n/g,'<br>')+'</div>';
  const emailCc=String(wf.email_cc||'').trim();
  const emailBcc=String(wf.email_bcc||'').trim();
  let adjuntos=[];
  try{
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG)return false;
    }
    if(typeof sstCargaShow==='function')sstCargaShow({title:'Enviando correo',message:'Notificando al ciudadano…',pct:40});
    if(typeof pqrsPrepararAdjuntosNotificacionCorreo==='function')
      adjuntos=await pqrsPrepararAdjuntosNotificacionCorreo(null,{e:e&&!e._sin_expediente?e:null,t:t});
    else if(typeof taskReviewAdjuntosDesdeSoportes==='function')
      adjuntos=await taskReviewAdjuntosDesdeSoportes(t,e&&!e._sin_expediente?e:null);
    const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():(typeof responsableActivo!=='undefined'?responsableActivo:'');
    if(typeof registrarSoporteEnvioCorreoNotif==='function')
      await registrarSoporteEnvioCorreoNotif(e&&!e._sin_expediente?e:null,t,refId,{para:destinos.join(', '),cc:emailCc,bcc:emailBcc,asunto:asunto,cuerpo:cuerpo,por:por},adjuntos);
    if(typeof pqrsEnviarCorreoCiudadano==='function'){
      await pqrsEnviarCorreoCiudadano(destinos,asunto,htmlBody,true,adjuntos,{cc:emailCc,bcc:emailBcc,expediente:e&&!e._sin_expediente?e:null,oficinaId:(e&&e._depto)||t.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'guaviare')});
    }else if(typeof gmailSend==='function'){
      for(let i=0;i<destinos.length;i++)await gmailSend(destinos[i],asunto,htmlBody);
    }else{
      notif('No hay envío de correo disponible','err');return false;
    }
    if(typeof setTaskFirmaWf==='function')setTaskFirmaWf(refId,taskId,{canal:'correo'});
    // Persistir soportes (incl. soporte de envío) antes del cierre
    if(t&&t.soportes&&typeof mutateTask==='function'){
      mutateTask(refId,taskId,function(tk){tk.soportes=(t.soportes||[]).slice();});
    }
    await finalizarTramiteTrasPublicar(refId,taskId,{via:'notificacion',destinos:destinos,canal:'correo'});
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    notif('📬 Notificado por correo'+(adjuntos.length?' · '+adjuntos.length+' adjunto(s)':'')+' y actividad cerrada','ok');
    closeTaskModal();
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    return true;
  }catch(err){
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('No se pudo enviar el correo: '+String(err.message||err).slice(0,100),'err');
    return false;
  }
}
/** PQRSD: tras cargar firmado con correo en el atajo, notifica y cierra sin otra ventana. */
async function pqrsAtajoEnviarCorreoDirecto(expId){
  const e=typeof getExpById==='function'?getExpById(expId):(typeof exps!=='undefined'?exps.find(function(x){return String(x._exp||'').trim()===String(expId||'').trim();}):null);
  if(!e||typeof pqrsPuedeNotificarOficio!=='function'||!pqrsPuedeNotificarOficio(e)){
    notif('No puede notificar esta PQRSD','err');return false;
  }
  const wf=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
  const toRaw=String(wf.email_to||'').trim();
  const destinos=toRaw.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s.includes('@');});
  const asunto=String(wf.email_subject||wf.asunto||('Respuesta a su solicitud '+(e._tipo_solicitud||'PQRSD')+' — '+expId)).trim();
  let cuerpo=String(wf.cuerpo||e._pqrs_respuesta_nota||'').trim();
  if(!cuerpo&&typeof pqrsPlantillaOficioFirmado==='function')cuerpo=pqrsPlantillaOficioFirmado(expId,wf.oficio)||'';
  if(!destinos.length){notif('Indique al menos un correo en Para','err');return false;}
  if(!cuerpo){notif('Indique el mensaje','err');return false;}
  const ccRaw=String(wf.email_cc||'').trim();
  const bccRaw=String(wf.email_bcc||'').trim();
  const por=typeof responsableActivo!=='undefined'?responsableActivo:(typeof rolSesion!=='undefined'?rolSesion:'');
  try{
    if(typeof sstSolicitarGmailParaAdjuntar==='function'){
      const okG=await sstSolicitarGmailParaAdjuntar();
      if(!okG)return false;
    }
    if(typeof sstCargaShow==='function')sstCargaShow({title:'Enviando correo',message:'Notificando al ciudadano…',pct:40});
    const docsAdj=wf.documentos||[];
    const adjuntos=typeof pqrsPrepararAdjuntosNotificacionCorreo==='function'
      ?await pqrsPrepararAdjuntosNotificacionCorreo(docsAdj,{e:e,t:typeof getPqrsTaskActiva==='function'?getPqrsTaskActiva(e):null})
      :[];
    const tAct=typeof getPqrsTaskActiva==='function'?getPqrsTaskActiva(e):null;
    if(typeof registrarSoporteEnvioCorreoNotif==='function')
      await registrarSoporteEnvioCorreoNotif(e,tAct,expId,{para:destinos.join(', '),cc:ccRaw,bcc:bccRaw,asunto:asunto,cuerpo:cuerpo,por:por},adjuntos);
    const html=typeof pqrsCorreoHtmlRespuesta==='function'?pqrsCorreoHtmlRespuesta(e,cuerpo,docsAdj):('<p>'+escAttr(cuerpo)+'</p>');
    if(typeof pqrsEnviarCorreoCiudadano!=='function'){notif('No hay envío de correo disponible','err');return false;}
    const sent=await pqrsEnviarCorreoCiudadano(destinos,asunto,html,true,adjuntos,{cc:ccRaw,bcc:bccRaw,expediente:e,oficinaId:e._pqrs_oficina});
    if(typeof registrarNotificacionCiudadanoPqrs==='function'){
      const ofiLbl=typeof labelOficina==='function'?labelOficina(e._pqrs_oficina||''):(e._pqrs_oficina||'oficina');
      registrarNotificacionCiudadanoPqrs(e,{tipo:'respuesta',medio:'correo',enviado:true,a:destinos.join(', ')+(ccRaw?' · Cc: '+ccRaw:''),cuenta_emisora:(sent&&sent.cuenta)||'oficina',gmail_message_id:(sent&&sent.messageId)||'',por:por,histTipo:'notificacion_correo',histNota:'Oficio firmado notificado por correo ('+ofiLbl+') a '+destinos.join(', ')});
    }
    if(typeof _pqrsRenombrarDocsDriveWf==='function')await _pqrsRenombrarDocsDriveWf(getPqrsWorkflow(e),'atendido');
    setPqrsWorkflow(e,{fase:PQRS_WF.CERRADA,cerrado_por:por,cerrado_en:new Date().toISOString(),canal:PQRS_WF_CANAL.CORREO,cuerpo:cuerpo,email_to:toRaw,email_cc:ccRaw,email_bcc:bccRaw});
    if(typeof _pqrsAplicarCierrePqrsYLimpiarDocs==='function')
      await _pqrsAplicarCierrePqrsYLimpiarDocs(e,wf.fecha_respuesta||hoy(),'PQRSD cerrada — oficio notificado por correo');
    persistExpedienteGranular(e);
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    closeTaskModal();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof renderActividades==='function')renderActividades();
    notif('📬 Notificado por correo y PQRSD cerrada','ok');
    return true;
  }catch(err){
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('No se pudo enviar el correo: '+String(err.message||err).slice(0,100),'err');
    return false;
  }
}
window.tramiteAtajoEnviarCorreoDirecto=tramiteAtajoEnviarCorreoDirecto;
window.pqrsAtajoEnviarCorreoDirecto=pqrsAtajoEnviarCorreoDirecto;

/** Carga PDF firmado desde el panel del rail (Director / VITAL / encargado / oficinas). */
async function cargarFirmadoDesdeRail(expId,taskId,esPqrs,abrirNotif){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  const modoOtro=abrirNotif==='otro'||abrirNotif===2;
  abrirNotif=!!abrirNotif&&!modoOtro;
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  const refId=(t&&t.sinExpediente)?(t.codigo||expId):expId;
  const file=typeof tramiteAtajoFirmadoGetPdfBlob==='function'?tramiteAtajoFirmadoGetPdfBlob(refId,taskId):null;
  if(!file){notif('Seleccione el PDF firmado','err');return;}
  let datosOtro=null;
  if(modoOtro){
    const canal=String((document.getElementById('tramite-atajo-otro-canal')||{}).value||'presencial').trim();
    const fecha=String((document.getElementById('tramite-atajo-otro-fecha')||{}).value||'').trim();
    if(!fecha){notif('Indique la fecha de notificación','err');return;}
    datosOtro=atajoFirmadoPersistOtroMedioFields(esPqrs?expId:refId,taskId,!!esPqrs)||{canal:canal,fecha:fecha,obs:''};
  }else if(abrirNotif){
    const to=String((document.getElementById('tramite-atajo-email-to')||{}).value||'').trim();
    if(!to){notif('Indique al menos un correo en «Para»','err');return;}
    const cuerpo=String((document.getElementById('tramite-atajo-email-cuerpo')||{}).value||'').trim();
    if(!cuerpo){notif('Indique el cuerpo del correo','err');return;}
    atajoFirmadoPersistEmailFields(esPqrs?expId:refId,taskId,!!esPqrs);
  }else{
    const notifPor=String((document.getElementById('tramite-atajo-notif-por-sel')||{}).value||'').trim();
    if(!notifPor&&document.getElementById('tramite-atajo-notif-por-sel')){
      notif('Seleccione quién notificará','err');return;
    }
    atajoFirmadoPersistAsignarFields(esPqrs?expId:refId,taskId,!!esPqrs);
  }
  const btns=document.querySelectorAll('#task-atajo-firmado-post .btn.bp, #tramite-atajo-firmado-btn');
  btns.forEach(function(b){b.disabled=true;});
  const btn=document.getElementById('tramite-atajo-firmado-btn')||btns[0];
  if(btn)btn.textContent='Procesando…';
  try{
    if(esPqrs&&typeof pqrsDirectorConfirmarFirmado==='function'){
      window._directorSignedFile=file;
      const ok=await pqrsDirectorConfirmarFirmado(expId,true);
      if(ok===false){
        btns.forEach(function(b){b.disabled=false;});
        if(btn)btn.textContent=modoOtro?'✓ Cargar y dar por atendida':(abrirNotif?'📬 Cargar y notificar ahora':'📤 Cargar y pasar a Por notificar');
        return;
      }
      if(modoOtro){
        await atajoFirmadoCerrarComoAtendidaOtroMedio(expId,taskId,true,datosOtro);
        closeTaskModal();
        if(typeof renderActividades==='function')renderActividades();
        if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
        return;
      }
      if(abrirNotif){
        const okMail=typeof pqrsAtajoEnviarCorreoDirecto==='function'?await pqrsAtajoEnviarCorreoDirecto(expId):false;
        if(!okMail){
          btns.forEach(function(b){b.disabled=false;});
          if(btn)btn.textContent='📬 Cargar y notificar ahora';
        }
        return;
      }
      closeTaskModal();
      if(typeof renderActividades==='function')renderActividades();
      if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
      return;
    }
    if(modoOtro){
      await tramiteAtajoFirmadoConfirmar(refId,taskId,false,false,{keepOpen:true,cerrarOtroMedio:true,otroMedio:datosOtro});
      return;
    }
    await tramiteAtajoFirmadoConfirmar(refId,taskId,false,abrirNotif,{keepOpen:false});
  }catch(err){
    notif('Error: '+String(err.message||err).slice(0,100),'err');
    btns.forEach(function(b){b.disabled=false;});
    if(btn)btn.textContent=modoOtro?'✓ Cargar y dar por atendida':(abrirNotif?'📬 Cargar y notificar ahora':'📤 Cargar y pasar a Por notificar');
  }
}
window.cargarFirmadoDesdeRail=cargarFirmadoDesdeRail;
window.atajoFirmadoPersistEmailFields=atajoFirmadoPersistEmailFields;
window.atajoFirmadoPersistAsignarFields=atajoFirmadoPersistAsignarFields;
/** @deprecated use cargarFirmadoDesdeRail */
async function directorCargarFirmadoDesdeRail(expId,taskId,esPqrs){
  return cargarFirmadoDesdeRail(expId,taskId,esPqrs,false);
}
window.directorCargarFirmadoDesdeRail=directorCargarFirmadoDesdeRail;
function initTaskReviewAtajoFirmadoSide(expId,taskId,t,opts){
  opts=opts||{};
  const refId=t&&t.sinExpediente?(t.codigo||expId):expId;
  const ctxKey=typeof sstFileCtxKeyTramiteAtajoFirmado==='function'?sstFileCtxKeyTramiteAtajoFirmado(refId,taskId):('tramite-atajo-firmado:'+refId+':'+taskId);
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxKey);
  if(typeof sstFileInitPick==='function')sstFileInitPick('tramite-atajo-firmado-file');
  const listEl=document.getElementById('tramite-atajo-firmado-list');
  if(listEl)listEl.style.display='none';
  const syncPost=function(){
    const post=document.getElementById('task-atajo-firmado-post');
    const it=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
    const listo=!!(it&&(it.blob||it.blobUrl||it.state==='uploaded'||it.state==='uploading'||it.nombre));
    if(post){
      post.style.display=listo?'':'none';
      // Acordeones cerrados al cargar
      post.querySelectorAll('.task-decision-acc.is-open').forEach(function(el){el.classList.remove('is-open');});
    }
    if(typeof atajoFirmadoRefreshDocsBox==='function')atajoFirmadoRefreshDocsBox();
    if(listEl)listEl.style.display='none';
  };
  if(listEl){
    const obs=new MutationObserver(syncPost);
    obs.observe(listEl,{childList:true,subtree:true,characterData:true});
    window._taskReviewAtajoObs=obs;
  }
  syncPost();
  if(opts.autoPick&&typeof sstFilePickByInputId==='function'){
    setTimeout(function(){sstFilePickByInputId('tramite-atajo-firmado-file');},120);
  }
}
function tramiteAtajoFirmadoDesdeRevision(expId,taskId){
  if(typeof openCargarFirmadoPorFirmar==='function'){
    openCargarFirmadoPorFirmar(expId,taskId);
    return;
  }
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
              label:res.nombre||(file&&file.name)||staged.nombre||'Documento firmado',
              driveFileId:res.fileId||res.driveFileId,
              driveLink:res.driveLink||'',
              previewLink:res.previewLink||res.driveLink||'',
              url:res.driveLink||res.previewLink||'',
              preview:res.previewLink||res.driveLink||'',
              driveInstitutional:true,
              driveEstado:'por_notificar',
              activo:true,
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
    const wfPrev=getTaskFirmaWf(t);
    // Opción 1 (notificar por correo ahora): sin plazo. Opción 2 (asignar quién notificará): siempre con plazo 5 días y notificar_por, aunque sea el encargado/VITAL.
    const sinPlazo=!!abrirNotif;
    let vence='';
    if(!sinPlazo){
      if(typeof addDiasHabiles==='function')vence=addDiasHabiles(inicio,5);
      else if(typeof addDiasHabilesCO==='function')vence=addDiasHabilesCO(inicio,5);
      else{
        const d=new Date(inicio+'T12:00:00');d.setDate(d.getDate()+5);vence=d.toISOString().slice(0,10);
      }
    }
    const quienNotif=String(notifPor||wfPrev.notificar_por||wfPrev.notificar_por_propuesto||'').trim();
    const cerrarOtro=!!opts.cerrarOtroMedio;
    const otroDatos=opts.otroMedio||{};
    const canalOtro=String(otroDatos.canal||wfPrev.canal||'presencial').trim()||'presencial';
    const faseDest=cerrarOtro
      ?(typeof PQRS_WF!=='undefined'?PQRS_WF.CERRADA:'cerrada_atendida')
      :(typeof PQRS_WF!=='undefined'?PQRS_WF.PENDIENTE_NOTIF:'pendiente_notificacion');
    const ok=mutateTask(refId,taskId,function(tk){
      tk.requiereFirma=true;
      const prev=getTaskFirmaWf(tk);
      tk.firmaWf=Object.assign({},prev,{
        fase:faseDest,
        notificar_por:cerrarOtro||sinPlazo?'':quienNotif,
        notificar_por_propuesto:cerrarOtro?'':(quienNotif||prev.notificar_por_propuesto||''),
        canal:cerrarOtro?canalOtro:(sinPlazo?'correo':(prev.canal&&String(prev.canal).toLowerCase()!=='correo'?prev.canal:'')),
        notif_correo_entrega:cerrarOtro?false:!!sinPlazo,
        firma_fisica:{por:taskComentarioAutor(),en:new Date().toISOString(),atajo_revision:true},
        firma_director:{
          por:taskComentarioAutor(),
          en:new Date().toISOString(),
          modo:pdfLink?'digital':'fisico',
          pdfLink:pdfLink||'',
          atajo_desde_revision:true
        },
        notif_inicio:cerrarOtro?'':inicio,
        notif_vence:cerrarOtro?'':vence,
        notif_plazo_dias:cerrarOtro||sinPlazo?0:5,
        notif_sin_plazo:cerrarOtro?true:!!sinPlazo,
        enviado_firma_en:prev.enviado_firma_en||new Date().toISOString(),
        enviado_firma_por:prev.enviado_firma_por||(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')
      });
      if(cerrarOtro){
        const fechaC=String(otroDatos.fecha||inicio).trim()||inicio;
        tk.fechaAtendida=fechaC;
        tk.estado='Atendida';
        tk.verificadoPor=(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')+' · notificado otro medio';
        tk.firmaWf.notificacion={
          canal:canalOtro,
          fecha:fechaC,
          obs:String(otroDatos.obs||'').trim(),
          por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',
          en:new Date().toISOString(),
          atajo_otro_medio:true
        };
      }
      if(tk.estado==='Por verificar')tk.estado=cerrarOtro?'Atendida':'En ejecución';
      if(!Array.isArray(tk.historial))tk.historial=[];
      tk.historial.push({
        tipo:cerrarOtro?'atajo_firmado_otro_medio':'atajo_firmado_revision',
        fecha:inicio,
        por:taskComentarioAutor(),
        nota:cerrarOtro
          ?('Documento firmado · notificado por '+(typeof medioNotificacionRespLabel==='function'?medioNotificacionRespLabel(canalOtro):canalOtro)+' → Atendida')
          :(pdfLink
            ?('Documento firmado cargado → Por notificar'+(pdfLink?' · '+pdfLink:''))
            :'Ya firmado (sin PDF) → Por notificar')
      });
      if(!cerrarOtro&&typeof tramiteSincronizarParticipacionPostAprobacionFirma==='function')
        tramiteSincronizarParticipacionPostAprobacionFirma(tk);
    });
    if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading)sstCargaDone({holdMs:200});
    window._tramiteAtajoFirmadoFile=null;
    if(!ok){notif('No se pudo actualizar la actividad','err');return;}
    if(cerrarOtro){
      if(typeof driveRenombrarSoporteActivoExp==='function'){
        try{await driveRenombrarSoporteActivoExp(refId,taskId,'aprobado');}catch(errR2){console.warn(errR2);}
      }
      const ml=typeof medioNotificacionRespLabel==='function'?medioNotificacionRespLabel(canalOtro):canalOtro;
      notif('✅ Notificado por '+ml+' — actividad atendida','ok');
      closeTaskModal();
      if(typeof renderActividades==='function')renderActividades();
      if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
      return;
    }
    try{if(typeof setActFiltro==='function')setActFiltro('pornotif');}catch(eF){}
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(abrirNotif){
      const okMail=await tramiteAtajoEnviarCorreoDirecto(refId,taskId);
      if(!okMail&&btn){btn.disabled=false;btn.textContent='📬 Cargar y notificar ahora';}
    }else if(keepOpen&&typeof taskReviewRefreshModal==='function'){
      const ctxA=window._taskModalCtx||{};
      // Director: no reabrir el modal de actividad (biblioteca / co-ejecutores)
      if(ctxA.directorRevisarPorFirmar||(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())){
        closeTaskModal();
      }else if(ctxA.mode==='cargarFirmadoStandalone'){
        closeTaskModal();
      }else{
        taskReviewCloseSidePanel();
        taskReviewRefreshModal(refId,taskId,'doc');
      }
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

/** Modal oficinas: Documento/comunicado (ACT) o migrar/crear PQRSD con respuesta. */
function openEntregaOficinaFirmaModal(){
  if(!puedeEntregarOficinaParaFirma()){
    notif('Solo oficinas RN, OAP, Admin o Secretaría pueden registrar documentos / comunicados','err');
    return;
  }
  const ofi=typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():(typeof deptoActivo!=='undefined'?deptoActivo:'');
  const ofiLbl=typeof labelOficina==='function'?labelOficina(ofi):(ofi||'Oficina');
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Documento / comunicado · '+ofiLbl;
  if(modal){
    modal.classList.remove('task-modal-wide','task-modal-review','task-modal-resp-ver','task-modal-review-wa-side','task-modal-archivos','task-modal-chat');
    modal.classList.add('enviar-modal-only','task-modal-wide');
  }
  const notifDef=typeof pqrsDefaultNotificadorOficina==='function'?pqrsDefaultNotificadorOficina(ofi):'';
  const hoyStr=typeof hoy==='function'?hoy():'';
  const TIPO_MSG=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.MENSAJE:'mensaje';
  const TIPO_OFI=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado';
  const altaPqrsHtml=typeof htmlEntregaRespPqrsAltaBox==='function'?htmlEntregaRespPqrsAltaBox():'';
  body.innerHTML=
    '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ofi-doc-modo" id="ofi-doc-modo-libre" checked onchange="ofiDocModoChange()"> Documento / comunicado</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ofi-doc-modo" id="ofi-doc-modo-pqrs" onchange="ofiDocModoChange()"> PQRSD (buscar o crear)</label>'+
    '</div>'+
    '<div id="ofi-doc-libre-wrap">'+
    '<div style="margin-bottom:10px;padding:10px;background:var(--bll);border:1px solid var(--bl);border-radius:var(--r)">'+
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">📋 Tipo de salida</div>'+
      '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-bottom:10px" id="ofi-doc-tipo-btns">'+
        '<button type="button" class="btn bsm tipo-resp-btn" data-val="'+escAttr(TIPO_MSG)+'" onclick="ofiDocSetTipo(\''+jsStr(TIPO_MSG)+'\')">Mensaje simple</button>'+
        '<button type="button" class="btn bsm tipo-resp-btn" data-val="'+escAttr(TIPO_OFI)+'" onclick="ofiDocSetTipo(\''+jsStr(TIPO_OFI)+'\')">📄 Oficio firmado</button>'+
      '</div>'+
      '<input type="hidden" id="ofi-doc-tipo" value="">'+
      '<div id="ofi-doc-tipo-hint" style="font-size:12px;color:var(--tx2);margin-bottom:8px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">Seleccione el tipo de salida.</div>'+
      '<div id="ofi-doc-detalles" style="display:none">'+
        '<div class="fld" style="margin-bottom:8px"><label>Asunto / descripción <span style="color:var(--rd)">*</span></label>'+
          '<input type="text" id="ofi-doc-asunto" placeholder="Ej. Invitación, remisión a entidad, comunicado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);box-sizing:border-box"></div>'+
        '<div class="fg" style="margin-bottom:8px">'+
          '<div class="fld"><label>Fecha <span class="req-star">*</span></label><input type="date" id="ofi-doc-fecha" value="'+escAttr(hoyStr)+'"></div>'+
          '<div class="fld" id="ofi-doc-oficio-row" style="display:none"><label>N° de oficio <span class="req-star">*</span></label>'+
            '<input type="text" id="ofi-doc-oficio" placeholder="OFI-2026-…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);box-sizing:border-box"></div>'+
        '</div>'+
        '<div id="ofi-doc-destino-wrap" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
          '<div style="font-size:12px;font-weight:600;margin-bottom:6px">Destino del oficio</div>'+
          '<div class="fx" style="gap:5px;flex-wrap:wrap" id="ofi-doc-destino-btns">'+
            '<button type="button" class="btn bsm tipo-resp-btn on" data-val="firma" onclick="ofiDocSetDestino(\'firma\')">✍️ Enviar a firma del Director</button>'+
            '<button type="button" class="btn bsm tipo-resp-btn" data-val="listo" onclick="ofiDocSetDestino(\'listo\')">✓ Ya firmado / notificar ahora</button>'+
          '</div>'+
          '<input type="hidden" id="ofi-doc-destino" value="firma">'+
        '</div>'+
        '<div id="ofi-doc-notif-correo-wrap" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
          '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;font-weight:600;cursor:pointer;margin:0">'+
            '<input type="checkbox" id="ofi-doc-notif-correo" onchange="ofiDocRefreshUi()" style="margin-top:2px;width:15px;height:15px;accent-color:var(--bl);flex-shrink:0">'+
            '<span>Se notificará por correo electrónico</span></label>'+
        '</div>'+
        '<div id="ofi-doc-otro-medio-wrap" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
          '<div style="font-size:12px;font-weight:600;margin-bottom:4px">Notificado por otro medio</div>'+
          '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">No se enviará correo. La actividad quedará <strong>atendida</strong>.</div>'+
          '<div class="fx" style="gap:5px;flex-wrap:wrap;margin-bottom:8px" id="ofi-doc-canal-btns">'+
            '<button type="button" class="btn bsm canal-resp-btn on" data-val="presencial" onclick="ofiDocSetCanal(\'presencial\')">🤝 Presencial</button>'+
            '<button type="button" class="btn bsm canal-resp-btn" data-val="whatsapp" onclick="ofiDocSetCanal(\'whatsapp\')">💬 WhatsApp</button>'+
            '<button type="button" class="btn bsm canal-resp-btn" data-val="aviso" onclick="ofiDocSetCanal(\'aviso\')">📌 Por aviso</button>'+
          '</div>'+
          '<input type="hidden" id="ofi-doc-canal" value="presencial">'+
          '<div class="fld" style="margin-bottom:8px"><label>Fecha de notificación<span class="req-star">*</span></label>'+
            '<input type="date" id="ofi-doc-notif-fecha" value="'+escAttr(hoyStr)+'"></div>'+
          '<div class="fld" style="margin-bottom:0"><label>Observación <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
            '<textarea id="ofi-doc-notif-obs" placeholder="Ej. Entregado en ventanilla…" style="min-height:56px;width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;box-sizing:border-box"></textarea></div>'+
        '</div>'+
        '<div id="ofi-doc-email-compose" style="display:none;margin-bottom:10px;padding:8px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
          '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--bl)">📧 Destinatarios del correo</div>'+
          '<div class="fld" style="margin-bottom:8px"><label>Para <span class="req-star">*</span></label>'+
            '<input type="text" id="ofi-doc-email-to" class="sst-email-chips" placeholder="destinatario@ejemplo.com" style="width:100%;box-sizing:border-box"></div>'+
          '<div class="fld" style="margin-bottom:8px"><label>Con copia (Cc) <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
            '<input type="text" id="ofi-doc-email-cc" class="sst-email-chips" placeholder="copia@ejemplo.com" style="width:100%;box-sizing:border-box;margin-top:4px"></div>'+
          '<div class="fld" style="margin-bottom:8px"><label>Con copia oculta (Cco) <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
            '<input type="text" id="ofi-doc-email-bcc" class="sst-email-chips" placeholder="oculto@ejemplo.com" style="width:100%;box-sizing:border-box;margin-top:4px"></div>'+
          '<div class="fld" style="margin-bottom:8px"><label>Asunto</label>'+
            '<input type="text" id="ofi-doc-email-subject" placeholder="Asunto del correo" style="width:100%;box-sizing:border-box;margin-top:4px"></div>'+
        '</div>'+
        '<div class="fld" id="ofi-doc-cuerpo-wrap" style="margin-bottom:10px"><label id="ofi-doc-cuerpo-label" style="font-size:11px;font-weight:600">Mensaje <span class="req-star">*</span></label>'+
          '<textarea id="ofi-doc-cuerpo" placeholder="Texto del mensaje o cuerpo del correo…" style="min-height:140px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:13px;font-family:\'DM Sans\',sans-serif;width:100%;margin-top:4px;line-height:1.45;box-sizing:border-box"></textarea></div>'+
        '<div id="ofi-doc-adj-wrap" style="margin-bottom:10px">'+
          '<label style="font-size:11px;font-weight:600;color:var(--tx3)" id="ofi-doc-adj-label">Documentos</label>'+
          '<div class="sst-file-pick-row" style="margin-top:6px">'+
            '<button type="button" class="btn bsm" onclick="sstFilePickByInputId(\'entrega-ofi-firma-file\')">📎 Seleccionar archivo</button>'+
            '<button type="button" class="btn bsm" onclick="sstFilePickByInputId(\'entrega-ofi-firma-anexos\')">Anexos +</button>'+
            '<input type="file" id="entrega-ofi-firma-file" accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="sstFileOnPickByInputId(this)">'+
            '<input type="file" id="entrega-ofi-firma-anexos" multiple accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="sstFileOnPickByInputId(this)">'+
          '</div>'+
          '<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-top:6px;margin-bottom:2px" id="ofi-doc-main-lbl">Principal</div>'+
          '<div id="entrega-ofi-firma-file-list" class="sst-file-slot-list"></div>'+
          '<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-top:6px;margin-bottom:2px" id="ofi-doc-anexos-lbl">Anexos</div>'+
          '<div id="entrega-ofi-firma-anexos-list" class="sst-file-slot-list"></div>'+
        '</div>'+
        '<div class="fld" id="ofi-doc-notif-por-wrap" style="margin-bottom:12px;display:none"><label>Quién notificará <span style="font-weight:400;color:var(--tx3)">(tras firma)</span></label>'+
          '<input type="text" id="entrega-ofi-firma-notif" value="'+escAttr(notifDef)+'" placeholder="Encargado de la oficina" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);box-sizing:border-box"></div>'+
      '</div>'+
    '</div></div>'+
    '<div id="ofi-doc-pqrs-wrap" style="display:none">'+
      '<div class="fld" style="margin-bottom:8px"><label>Buscar PQRSD</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="ofi-doc-pqrs-exp" placeholder="Digite N° PQRSD o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="ofiDocPqrsExpInput(this)" onfocus="ofiDocPqrsFiltrarSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'ofi-doc-pqrs-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="ofi-doc-pqrs-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="ofi-doc-pqrs-hint" style="font-size:11px;color:var(--tx3);margin-top:4px">Si el número no existe, elija crear PQRSD en la lista.</div>'+
      '</div>'+
      '<div id="ofi-doc-pqrs-alta-box" style="display:none;margin-bottom:10px;padding:10px;border:1px solid #d4c7f0;border-radius:var(--r);background:#faf8ff">'+altaPqrsHtml+'</div>'+
      '<div id="ofi-doc-pqrs-entrega-host" style="display:none"></div>'+
      '<textarea id="enviar-cmt-opcional" placeholder="Comentario u observaciones (opcional)…" style="display:none;min-height:56px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;width:100%;margin-bottom:8px"></textarea>'+
    '</div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
      '<button type="button" class="btn bsm bp" id="entrega-ofi-firma-btn" onclick="submitEntregaOficinaFirmaOrPqrs()">📤 Registrar</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'entregaOficinaFirma',oficina:ofi};
  window._ofiDocPqrsCrear=false;
  window._ofiDocPqrsExpId='';
  window._entregaOfiFirmaCodigo=typeof genCodigoActOficinaFirma==='function'?genCodigoActOficinaFirma(ofi):('ACT-'+Date.now());
  const ctxKeyOfi='entrega-ofi-firma:'+ofi;
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxKeyOfi);
  const getCtx=typeof entregaOfiFirmaUploadCtx==='function'?entregaOfiFirmaUploadCtx:null;
  if(typeof sstFileRegisterPick==='function'){
    sstFileRegisterPick('entrega-ofi-firma-file',{ctxKey:ctxKeyOfi,listId:'entrega-ofi-firma-file-list',multi:false,getUploadCtx:getCtx});
    sstFileRegisterPick('entrega-ofi-firma-anexos',{ctxKey:ctxKeyOfi,listId:'entrega-ofi-firma-anexos-list',multi:true,getUploadCtx:getCtx});
  }
  if(typeof sstFileRegisterList==='function'){
    sstFileRegisterList('entrega-ofi-firma-file-list',ctxKeyOfi,'main');
    sstFileRegisterList('entrega-ofi-firma-anexos-list',ctxKeyOfi,'anexos');
  }
  if(typeof sstFileInitPick==='function'){
    sstFileInitPick('entrega-ofi-firma-file');
    sstFileInitPick('entrega-ofi-firma-anexos');
  }
  ofiDocRefreshUi();
  ofiDocModoChange();
  setTimeout(function(){const a=document.getElementById('ofi-doc-asunto');if(a)a.focus();},80);
}
function ofiDocModoChange(){
  const pqrs=!!((document.getElementById('ofi-doc-modo-pqrs')||{}).checked);
  const libreW=document.getElementById('ofi-doc-libre-wrap');
  const pqrsW=document.getElementById('ofi-doc-pqrs-wrap');
  const btn=document.getElementById('entrega-ofi-firma-btn');
  const cmt=document.getElementById('enviar-cmt-opcional');
  if(libreW)libreW.style.display=pqrs?'none':'';
  if(pqrsW)pqrsW.style.display=pqrs?'':'none';
  if(cmt)cmt.style.display=pqrs?'':'none';
  if(btn)btn.textContent=pqrs?'📤 Crear y atender PQRSD':'📤 Registrar';
  if(pqrs){
    ofiDocPqrsFijarOficinaActiva();
    if(typeof initEntregaRespPqrsAltaUi==='function')initEntregaRespPqrsAltaUi();
    ofiDocPqrsFijarOficinaActiva();
  }
}
function ofiDocPqrsExpInput(inp){
  window._ofiDocPqrsCrear=false;
  const alta=document.getElementById('ofi-doc-pqrs-alta-box');
  if(alta)alta.style.display='none';
  ofiDocPqrsFiltrarSug(inp);
}
function ofiDocPqrsFiltrarSug(inp){
  const portal=document.getElementById('ofi-doc-pqrs-sug');
  if(!portal||!inp)return;
  const q=String(inp.value||'').trim();
  const list=(typeof buscarExpedientesEntregaResp==='function'?buscarExpedientesEntregaResp(q,12):[]).filter(function(e){
    return e&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite)));
  });
  const ql=q.toLowerCase();
  const exact=q&&typeof getExpById==='function'?getExpById(q):null;
  const hasExact=!!(exact&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(exact))||(typeof esTramitePqrs==='function'&&esTramitePqrs(exact._tramite))))
    ||list.some(function(e){return String(e._exp||'').trim().toLowerCase()===ql;});
  let html=list.map(function(e){
    const nom=typeof getNom==='function'?getNom(e):'';
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();ofiDocPqrsPickExp(\''+
      String(e._exp||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+
      '<span style="color:#6d3fa8;font-weight:600">PQRSD</span> · <strong>'+escAttr(e._exp)+'</strong> · '+escAttr(nom)+'</button>';
  }).join('');
  if(q.length>=2&&!hasExact){
    const qEsc=String(q).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html+='<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();ofiDocPqrsPickCrear(\''+qEsc+'\')">'+
      '<span style="color:#6d3fa8;font-weight:600">✚ Crear PQRSD</span> · <strong>'+escAttr(q)+'</strong></button>';
  }
  if(!html){portal.style.display='none';portal.innerHTML='';return;}
  portal.innerHTML=html;
  portal.style.display='block';
}
function ofiDocPqrsPickExp(expNum){
  window._ofiDocPqrsCrear=false;
  window._ofiDocPqrsExpId=String(expNum||'').trim();
  const inp=document.getElementById('ofi-doc-pqrs-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('ofi-doc-pqrs-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const alta=document.getElementById('ofi-doc-pqrs-alta-box');
  if(alta)alta.style.display='none';
  const e=typeof getExpById==='function'?getExpById(expNum):null;
  const hint=document.getElementById('ofi-doc-pqrs-hint');
  if(hint&&e){
    hint.innerHTML='Seleccionada: <strong>'+escAttr(e._exp)+'</strong> · '+escAttr(typeof getNom==='function'?getNom(e):'');
  }
  ofiDocPqrsShowEntrega(e);
}
function ofiDocPqrsPickCrear(expNum){
  window._ofiDocPqrsCrear=true;
  window._ofiDocPqrsExpId=String(expNum||'').trim();
  const inp=document.getElementById('ofi-doc-pqrs-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('ofi-doc-pqrs-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const alta=document.getElementById('ofi-doc-pqrs-alta-box');
  if(alta)alta.style.display='';
  const numEl=document.getElementById('er-pqrs-exp');
  if(numEl)numEl.value=expNum;
  ofiDocPqrsFijarOficinaActiva();
  if(typeof initEntregaRespPqrsAltaUi==='function')initEntregaRespPqrsAltaUi();
  ofiDocPqrsFijarOficinaActiva();
  const hint=document.getElementById('ofi-doc-pqrs-hint');
  if(hint)hint.textContent='';
  ofiDocPqrsShowEntrega(null);
  ofiDocPqrsBindAltaCorreoPrefill();
}
function ofiDocPqrsCorreoDesdeAltaOExp(e){
  const ids=['er-pqrs-pn-correo','er-pqrs-pj-correo','er-pqrs-pj-ofi-correo','er-pqrs-anon-correo'];
  for(let i=0;i<ids.length;i++){
    const v=String((document.getElementById(ids[i])||{}).value||'').trim().toLowerCase();
    if(v&&v.includes('@'))return v;
  }
  if(e){
    const cands=[
      e._pn_correo,e._qd_correo,e._pj_correo,e._pj_ofi_correo,
      e._pqrs_anon_correo
    ];
    for(let j=0;j<cands.length;j++){
      const v=String(cands[j]||'').trim().toLowerCase();
      if(v&&v.includes('@'))return v;
    }
    if(typeof pqrsCorreoCiudadano==='function'){
      const c=String(pqrsCorreoCiudadano(e)||'').trim().toLowerCase();
      if(c&&c.includes('@'))return c;
    }
  }
  return'';
}
function ofiDocPqrsPrefillEmailTo(e,force){
  const toEl=document.getElementById('pqrs-entrega-email-to');
  if(!toEl)return;
  const cur=String(toEl.value||'').trim().toLowerCase();
  const mail=ofiDocPqrsCorreoDesdeAltaOExp(e);
  if(!mail)return;
  const prevAuto=String(window._ofiDocEmailPrefill||'').trim().toLowerCase();
  // Vacío, o sigue siendo el auto-precargado (usuario aún no lo cambió a otro)
  if(force||!cur||(prevAuto&&cur===prevAuto)){
    toEl.value=mail;
    window._ofiDocEmailPrefill=mail;
    if(typeof sstEmailChipsRefresh==='function')sstEmailChipsRefresh(toEl);
  }
}
function ofiDocPqrsBindAltaCorreoPrefill(){
  const ids=['er-pqrs-pn-correo','er-pqrs-pj-correo','er-pqrs-pj-ofi-correo','er-pqrs-anon-correo'];
  ids.forEach(function(id){
    const el=document.getElementById(id);
    if(!el||el._ofiPrefillBound)return;
    el._ofiPrefillBound=true;
    el.addEventListener('input',function(){
      ofiDocPqrsPrefillEmailTo(null,false);
    });
    el.addEventListener('change',function(){
      ofiDocPqrsPrefillEmailTo(null,false);
    });
  });
}
function ofiDocPqrsFijarOficinaActiva(){
  const ofi=typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():'';
  const ofiSel=document.getElementById('er-pqrs-oficina');
  if(ofiSel&&ofi)ofiSel.value=ofi;
  const fld=document.getElementById('er-pqrs-oficina-fld');
  if(fld)fld.style.display='none';
  else if(ofiSel){
    const wrap=ofiSel.closest?ofiSel.closest('.fld'):null;
    if(wrap)wrap.style.display='none';
  }
}
function ofiDocPqrsShowEntrega(e){
  const host=document.getElementById('ofi-doc-pqrs-entrega-host');
  if(!host)return;
  host.style.display='';
  const stub=e||{_exp:window._ofiDocPqrsExpId||'',_tipo_solicitud:'solicitud PQRSD'};
  // Precargar correo del alta en el stub para renderPqrsEntregaCamposHtml
  const mailPref=ofiDocPqrsCorreoDesdeAltaOExp(e);
  if(mailPref&&!stub._pn_correo&&!stub._qd_correo){
    stub._pn_correo=mailPref;
    stub._qd_correo=mailPref;
  }
  if(mailPref){
    stub._pqrs_workflow=stub._pqrs_workflow||{};
    try{
      const wf=typeof stub._pqrs_workflow==='string'?JSON.parse(stub._pqrs_workflow):(stub._pqrs_workflow||{});
      if(!wf.email_to)wf.email_to=mailPref;
      stub._pqrs_workflow=wf;
    }catch(errW){}
  }
  host.innerHTML=typeof renderPqrsEntregaCamposHtml==='function'?renderPqrsEntregaCamposHtml(stub):'';
  ofiDocPqrsPrefillEmailTo(e||stub,true);
  const ctxKey=typeof entregaRespFileCtxKey==='function'?entregaRespFileCtxKey():'entrega-resp';
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(ctxKey);
  // Si la PQRSD aún no existe (alta nueva), no subir a Drive hasta el submit
  const getCtx=function(){
    const id=String(window._ofiDocPqrsExpId||'').trim();
    const ex=(e&&e._exp)?e:(typeof getExpById==='function'?getExpById(id):null);
    if(!ex||(typeof esPqrsSecretaria==='function'&&!esPqrsSecretaria(ex)))return null;
    return{esPqrs:true,expId:String(ex._exp||id).trim(),e:ex,eDrive:ex,t:{id:'_staging_',actividad:'Respuesta PQRSD'},driveEstado:'cerrado'};
  };
  if(typeof sstFileRegisterPick==='function'){
    sstFileRegisterPick('enviar-adj-file',{ctxKey:ctxKey,listId:'pqrs-entrega-att-list',multi:false,getUploadCtx:getCtx});
    sstFileRegisterPick('enviar-anexos-file',{ctxKey:ctxKey,listId:'pqrs-entrega-anexos-list',multi:true,getUploadCtx:getCtx});
  }
  if(typeof sstFileRegisterList==='function'){
    sstFileRegisterList('pqrs-entrega-att-list',ctxKey,'main');
    sstFileRegisterList('pqrs-entrega-anexos-list',ctxKey,'anexos');
  }
  if(typeof pqrsEntregaRefreshUi==='function')pqrsEntregaRefreshUi();
  ofiDocPqrsPrefillEmailTo(e||stub,true);
  ofiDocPqrsBindAltaCorreoPrefill();
  if(typeof sstInitEmailChipsIn==='function')sstInitEmailChipsIn(host);
  ofiDocPqrsPrefillEmailTo(e||stub,true);
  // Al marcar «notificar por correo» / mensaje, volver a precargar si Para quedó vacío
  const notifCb=document.getElementById('pqrs-entrega-notif-correo');
  if(notifCb&&!notifCb._ofiPrefillBound){
    notifCb._ofiPrefillBound=true;
    notifCb.addEventListener('change',function(){
      setTimeout(function(){ofiDocPqrsPrefillEmailTo(e||stub,true);},30);
    });
  }
  document.querySelectorAll('#pqrs-resp-tipo-btns .tipo-resp-btn').forEach(function(b){
    if(b._ofiPrefillBound)return;
    b._ofiPrefillBound=true;
    b.addEventListener('click',function(){
      setTimeout(function(){ofiDocPqrsPrefillEmailTo(e||stub,true);},40);
    });
  });
}
function submitEntregaOficinaFirmaOrPqrs(){
  if(!!((document.getElementById('ofi-doc-modo-pqrs')||{}).checked))
    return submitEntregaOficinaPqrsMigracion();
  return submitEntregaOficinaFirma();
}
async function submitEntregaOficinaPqrsMigracion(){
  if(!puedeEntregarOficinaParaFirma()){notif('No autorizado','err');return;}
  const btn=document.getElementById('entrega-ofi-firma-btn');
  const btnLbl=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  const restoreBtn=function(){
    if(!btn||!document.getElementById('entrega-ofi-firma-btn'))return;
    btn.disabled=false;
    btn.textContent=btnLbl||'📤 Crear y atender PQRSD';
  };
  try{
    const ofi=typeof getPqrsOficinaActiva==='function'?getPqrsOficinaActiva():'';
    let crear=!!window._ofiDocPqrsCrear;
    let e=null;
    let expId=String(window._ofiDocPqrsExpId||(document.getElementById('ofi-doc-pqrs-exp')||{}).value||'').trim();

    if(crear){
      if(typeof collectEntregaRespPqrsAlta!=='function'||typeof validateEntregaRespPqrsAlta!=='function'||typeof crearStubPqrsEntregaResp!=='function'){
        notif('No se pudo cargar el formulario de alta PQRSD','err');restoreBtn();return;
      }
      const datos=collectEntregaRespPqrsAlta();
      if(!datos.oficina)datos.oficina=ofi;
      ofiDocPqrsFijarOficinaActiva();
      if(!datos.oficina)datos.oficina=String((document.getElementById('er-pqrs-oficina')||{}).value||ofi||'').trim();
      const err=validateEntregaRespPqrsAlta(datos);
      if(err){notif(err,'err');restoreBtn();return;}
      expId=String(datos.expId||expId).trim();

      // Precargar Para desde el alta y validar la respuesta ANTES de crear el expediente
      ofiDocPqrsPrefillEmailTo(null,true);
      const stubPrev={
        _exp:expId,
        _tipo_solicitud:datos.tipo||'Petición',
        _alta_por_oficina:true,
        _pn_correo:(datos.pn&&datos.pn.correo)||'',
        _qd_correo:(datos.pn&&datos.pn.correo)||(datos.pj&&(datos.pj.correo||datos.pj.ofiCorreo))||datos.anonCorreo||'',
        _pj_correo:(datos.pj&&datos.pj.correo)||'',
        _pj_ofi_correo:(datos.pj&&datos.pj.ofiCorreo)||''
      };
      const pqPrev=typeof collectPqrsEntregaDatos==='function'?collectPqrsEntregaDatos(expId,stubPrev):null;
      if(!pqPrev){restoreBtn();return;}

      // Si ya se creó en un intento anterior, reutilizar (evita «Ya existe…» al 2.º clic)
      const ya=typeof getExpById==='function'?getExpById(expId):null;
      if(ya&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(ya)){
        e=ya;
        crear=false;
        window._ofiDocPqrsCrear=false;
      }else{
        e=crearStubPqrsEntregaResp(datos,{
          origen:'oficina',
          skipRevisionAlta:true,
          por:typeof labelOficina==='function'?labelOficina(ofi):ofi
        });
        if(!e){restoreBtn();return;}
        expId=e._exp;
        window._ofiDocPqrsCrear=false;
        window._ofiDocPqrsExpId=expId;
      }
    }else{
      if(!expId){notif('Busque y seleccione una PQRSD, o créela','err');restoreBtn();return;}
      e=typeof getExpById==='function'?getExpById(expId):null;
      if(!e){notif('PQRSD no encontrada','err');restoreBtn();return;}
      if(typeof esPqrsSecretaria==='function'&&!esPqrsSecretaria(e)){notif('El registro seleccionado no es una PQRSD','err');restoreBtn();return;}
    }

    if(typeof pqrsEstaCerrada==='function'&&pqrsEstaCerrada(e)){
      notif('La PQRSD ya está atendida','err');restoreBtn();return;
    }

    // Validar respuesta (tras create, con expediente real)
    ofiDocPqrsPrefillEmailTo(e,true);
    const pq=typeof collectPqrsEntregaDatos==='function'?collectPqrsEntregaDatos(expId,e):null;
    if(!pq){restoreBtn();return;}

    try{
      if((ofi==='guaviare'||e._pqrs_oficina==='guaviare')&&typeof ensureTareaPqrsNca==='function')ensureTareaPqrsNca(e);
      else if(ofi&&typeof ensureTareaPqrsOficina==='function')ensureTareaPqrsOficina(e,ofi);
      else if(e._pqrs_oficina&&e._pqrs_oficina!=='guaviare'&&typeof ensureTareaPqrsOficina==='function')
        ensureTareaPqrsOficina(e,e._pqrs_oficina);
    }catch(errT){console.warn('ensure tarea pqrs migracion:',errT);}

    let t=typeof getPqrsAtencionTask==='function'?getPqrsAtencionTask(e):null;
    if(!t&&typeof getPqrsTaskActiva==='function')t=getPqrsTaskActiva(e);
    if(!t||!t.id){
      // Crear tarea mínima si ensure falló
      if(!Array.isArray(e.tasks))e.tasks=[];
      t={
        id:typeof genTaskId==='function'?genTaskId():('tk_'+Date.now()),
        actividad:typeof pqrsActividadNombreDefault==='function'?pqrsActividadNombreDefault():'Oficio de respuesta',
        desc:'Oficio de respuesta',
        responsable:typeof labelOficina==='function'?labelOficina(ofi||e._pqrs_oficina):'',
        responsables:[],
        estado:'En ejecución',
        comentarios:[],historial:[],soportes:[],notasDoc:[]
      };
      if(typeof normalizeTask==='function')t=normalizeTask(t);
      e.tasks.push(t);
    }
    if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);

    const cmt=String((document.getElementById('enviar-cmt-opcional')||{}).value||'').trim();
    const adj=typeof collectEnviarAdjuntos==='function'?collectEnviarAdjuntos():{links:[],files:[],anexos:[],preUploaded:[]};
    const allUpload=[].concat(adj.files||[],adj.anexos||[]);
    const preUploaded=adj.preUploaded||[];
    let driveArchivos=preUploaded.slice();

    if(allUpload.length){
      if(typeof sstSolicitarGmailParaAdjuntar==='function'){
        const okG=await sstSolicitarGmailParaAdjuntar();
        if(!okG){
          notif('Conecte Gmail/Drive para subir los documentos y complete el envío','err');
          restoreBtn();
          return;
        }
      }
      if(typeof sstCargaShow==='function'){
        sstCargaShow({
          title:'Crear y atender PQRSD',
          message:'Subiendo a carpeta PQRSD institucional…',
          pct:10,
          sub:allUpload[0]&&allUpload[0].nombre||expId
        });
      }
      try{
        let anexoSeq=0;
        for(let i=0;i<allUpload.length;i++){
          const f=allUpload[i];
          let pref=f.nombre;
          if(f.esAnexo){
            anexoSeq++;
            pref='anexo-'+anexoSeq+'-'+(f.nombre||'doc');
          }
          if(typeof sstCargaProgress==='function')
            sstCargaProgress(Math.round(10+((i/allUpload.length)*80)),'Subiendo «'+(f.nombre||'archivo')+'»…');
          if(typeof driveUploadPqrsExpediente!=='function')
            throw new Error('Subida Drive no disponible');
          const up=await driveUploadPqrsExpediente(f.blob,pref,f.tipo,e,{
            label:f.esAnexo?('Anexo '+anexoSeq):'Respuesta',
            uploadTarget:'respuesta'
          });
          if(up){
            if(!up.driveFileId&&up.fileId)up.driveFileId=up.fileId;
            up.esAnexo=!!f.esAnexo;
            if(f.esAnexo){
              up.tipo='anexo_respuesta';
              up.es_anexo=true;
              up.anexo_n=anexoSeq;
              up.nombre='Anexo '+anexoSeq;
            }else{
              up.nombre=up.nombre||(pq.tipo===(typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado')?'Oficio firmado':'Documento de respuesta');
            }
            up.driveEstado='cerrado';
            driveArchivos.push(up);
          }
        }
        if(typeof sstCargaProgress==='function')sstCargaProgress(95,'Registrando respuesta…');
      }catch(errUp){
        console.warn('submitEntregaOficinaPqrsMigracion upload:',errUp);
        if(typeof sstCargaHide==='function')sstCargaHide();
        if(typeof alertErrorDriveAdjunto==='function')alertErrorDriveAdjunto(errUp);
        else notif('No se pudo subir el archivo: '+String(errUp.message||errUp).slice(0,90),'err');
        restoreBtn();
        return;
      }
    }

    const adjDocumentos=(adj.links||[]).map(function(lnk){return{nombre:'Link Drive',driveLink:lnk,tipo:'link'};});
    driveArchivos.forEach(function(da){
      if(!da||!da.driveLink)return;
      if(adjDocumentos.find(function(x){return x.driveLink===da.driveLink;}))return;
      const esAnexo=!!(da.esAnexo||da.tipo==='anexo_respuesta');
      adjDocumentos.push({
        nombre:esAnexo?('Anexo '+(da.anexo_n||da.nombre||'')):(pq.tipo===(typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado')?'Oficio firmado':'Documento de respuesta'),
        driveLink:da.driveLink,
        previewLink:da.previewLink||da.driveLink||'',
        fileId:da.fileId||da.driveFileId||'',
        tipo:esAnexo?'anexo_respuesta':(pq.tipo===(typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado')?'oficio_firmado':'drive'),
        es_anexo:esAnexo,
        anexo_n:esAnexo?(da.anexo_n||null):null,
        driveFilename:da.driveFilename||da.nombre||'',
        driveEstado:'cerrado'
      });
    });

    // Mensaje / oficio con correo: notificar ANTES de cerrar
    const TIPO_MSG=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.MENSAJE:'mensaje';
    const TIPO_OFI_SEND=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado';
    const necesitaCorreo=(pq.tipo===TIPO_MSG)||(pq.tipo===TIPO_OFI_SEND&&typeof pqrsEsCanalCorreo==='function'&&pqrsEsCanalCorreo(pq.canal));
    if(necesitaCorreo){
      try{
        if(typeof sstCargaShow==='function'){
          sstCargaShow({title:'Notificando por correo',message:'Enviando respuesta al ciudadano…',pct:70,sub:expId});
        }
        if(typeof pqrsEntregaDirectaEnviarCorreoSiAplica!=='function')
          throw new Error('Envío de correo no disponible');
        await pqrsEntregaDirectaEnviarCorreoSiAplica(e,pq,adjDocumentos,{registrarHist:true});
      }catch(errMail){
        console.warn('submitEntregaOficinaPqrsMigracion correo:',errMail);
        if(typeof sstCargaHide==='function')sstCargaHide();
        notif('No se pudo enviar el correo: '+String(errMail.message||errMail).slice(0,110)+'. La PQRSD quedó en Por ejecutar; reintente la atención.','err');
        if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
        if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
        restoreBtn();
        return;
      }
    }

    if(typeof aplicarPqrsEntregaDirecta==='function')aplicarPqrsEntregaDirecta(e,pq,adjDocumentos,t.id,cmt);
    // Forzar estado atendida (por si ensureTarea dejó «asignado»)
    e._pqrs_estado_oficina='cerrado';
    e._estado='Atendido';
    if(typeof setPqrsWorkflow==='function'){
      const faseCerrada=typeof PQRS_WF!=='undefined'?PQRS_WF.CERRADA:'cerrada';
      setPqrsWorkflow(e,{fase:faseCerrada,fecha_respuesta:pq.fechaResp||(typeof hoy==='function'?hoy():'')});
    }
    if(typeof finalizarTareasPqrsAlCerrar==='function')
      finalizarTareasPqrsAlCerrar(e,'PQRSD cerrada — crear y atender oficina');

    try{
      if(typeof mutateTask==='function'){
        mutateTask(expId,t.id,function(tk){
          if(typeof normalizeTask==='function')normalizeTask(tk);
          const hoyStr=typeof hoy==='function'?hoy():'';
          tk.fechaReportada=hoyStr;
          tk.fechaAtendida=hoyStr;
          tk.estado='Atendida';
          tk.verificadoPor=(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')+' · crear y atender oficina';
          if(!Array.isArray(tk.historial))tk.historial=[];
          tk.historial.push({tipo:'entrega_directa_pqrs',fecha:hoyStr,ts:Date.now(),por:typeof taskComentarioAutor==='function'?taskComentarioAutor():'',nota:cmt||('Crear y atender · '+pq.tipo)});
        });
      }else{
        t.fechaAtendida=typeof hoy==='function'?hoy():'';
        t.estado='Atendida';
      }
    }catch(errM){console.warn('migracion task:',errM);}

    if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
    if(typeof sstCargaDone==='function')sstCargaDone({holdMs:200});
    else if(typeof sstCargaHide==='function')sstCargaHide();
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof renderSecretariaPqrs==='function')renderSecretariaPqrs();
    if(typeof renderActividades==='function')renderActividades();

    const TIPO_OFI=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado';
    const TIPO_INFO=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.INFORMATIVA:'informativa';
    let msgOk='✅ PQRSD '+expId+' atendida';
    if(pq.tipo===TIPO_INFO)msgOk='ℹ️ PQRSD '+expId+' informativa cerrada';
    else if(pq.tipo===TIPO_OFI){
      msgOk=(pq.canal&&typeof pqrsEsCanalCorreo==='function'&&pqrsEsCanalCorreo(pq.canal))
        ?('📬 Oficio notificado por correo — PQRSD '+expId+' atendida')
        :(pq.canal&&typeof pqrsEsCanalCorreo==='function'&&!pqrsEsCanalCorreo(pq.canal)
          ?('✅ Oficio notificado — PQRSD '+expId+' atendida')
          :('✅ Oficio registrado — PQRSD '+expId+' atendida'));
    }else if(pq.tipo===TIPO_MSG||necesitaCorreo){
      msgOk='📬 Mensaje enviado por correo — PQRSD '+expId+' atendida';
    }
    notif(msgOk,'ok');
    if(typeof closeTaskModal==='function')closeTaskModal();
  }catch(err){
    console.warn('submitEntregaOficinaPqrsMigracion:',err);
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('No se pudo completar: '+String(err.message||err).slice(0,120),'err');
    restoreBtn();
  }
}
window.ofiDocModoChange=ofiDocModoChange;
window.ofiDocPqrsExpInput=ofiDocPqrsExpInput;
window.ofiDocPqrsFiltrarSug=ofiDocPqrsFiltrarSug;
window.ofiDocPqrsPickExp=ofiDocPqrsPickExp;
window.ofiDocPqrsPickCrear=ofiDocPqrsPickCrear;
window.submitEntregaOficinaFirmaOrPqrs=submitEntregaOficinaFirmaOrPqrs;
window.submitEntregaOficinaPqrsMigracion=submitEntregaOficinaPqrsMigracion;
function ofiDocSetTipo(val){
  const hid=document.getElementById('ofi-doc-tipo');
  if(hid)hid.value=String(val||'');
  document.querySelectorAll('#ofi-doc-tipo-btns .tipo-resp-btn').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-val')===String(val||''));
  });
  ofiDocRefreshUi();
}
function ofiDocSetDestino(val){
  val=String(val||'firma').trim()==='listo'?'listo':'firma';
  const hid=document.getElementById('ofi-doc-destino');
  if(hid)hid.value=val;
  document.querySelectorAll('#ofi-doc-destino-btns .tipo-resp-btn').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-val')===val);
  });
  ofiDocRefreshUi();
}
function ofiDocSetCanal(val){
  val=String(val||'presencial').trim().toLowerCase();
  if(val!=='presencial'&&val!=='whatsapp'&&val!=='aviso')val='presencial';
  const hid=document.getElementById('ofi-doc-canal');
  if(hid)hid.value=val;
  document.querySelectorAll('#ofi-doc-canal-btns .canal-resp-btn').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-val')===val);
  });
}
function ofiDocRefreshUi(){
  const TIPO_MSG=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.MENSAJE:'mensaje';
  const TIPO_OFI=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado';
  const tipo=String((document.getElementById('ofi-doc-tipo')||{}).value||'').trim();
  const destino=String((document.getElementById('ofi-doc-destino')||{}).value||'firma').trim()||'firma';
  const notifCorreo=!!((document.getElementById('ofi-doc-notif-correo')||{}).checked);
  const detalles=document.getElementById('ofi-doc-detalles');
  const hint=document.getElementById('ofi-doc-tipo-hint');
  const isMsg=tipo===TIPO_MSG;
  const isOfi=tipo===TIPO_OFI;
  if(!tipo){
    if(detalles)detalles.style.display='none';
    if(hint)hint.style.display='';
    const btn0=document.getElementById('entrega-ofi-firma-btn');
    if(btn0)btn0.textContent='📤 Registrar';
    return;
  }
  if(hint)hint.style.display='none';
  if(detalles)detalles.style.display='';
  const oficioRow=document.getElementById('ofi-doc-oficio-row');
  const destWrap=document.getElementById('ofi-doc-destino-wrap');
  const notifCorreoWrap=document.getElementById('ofi-doc-notif-correo-wrap');
  const otroWrap=document.getElementById('ofi-doc-otro-medio-wrap');
  const emailCompose=document.getElementById('ofi-doc-email-compose');
  const cuerpoWrap=document.getElementById('ofi-doc-cuerpo-wrap');
  const cuerpoLbl=document.getElementById('ofi-doc-cuerpo-label');
  const adjLabel=document.getElementById('ofi-doc-adj-label');
  const notifPorWrap=document.getElementById('ofi-doc-notif-por-wrap');
  const btn=document.getElementById('entrega-ofi-firma-btn');
  if(oficioRow)oficioRow.style.display=isOfi?'':'none';
  if(destWrap)destWrap.style.display=isOfi?'':'none';
  const showListo=isOfi&&destino==='listo';
  const showFirma=isOfi&&destino==='firma';
  const showEmail=isMsg||(showListo&&notifCorreo);
  const showOtro=showListo&&!notifCorreo;
  if(notifCorreoWrap)notifCorreoWrap.style.display=showListo?'':'none';
  if(otroWrap)otroWrap.style.display=showOtro?'':'none';
  if(emailCompose)emailCompose.style.display=showEmail?'':'none';
  if(cuerpoWrap)cuerpoWrap.style.display=(isMsg||showEmail||showOtro)?'':'none';
  if(cuerpoLbl){
    if(showOtro)cuerpoLbl.innerHTML='Nota <span style="font-weight:400;color:var(--tx3)">(opcional)</span>';
    else if(showEmail||isMsg)cuerpoLbl.innerHTML='Mensaje / cuerpo del correo <span class="req-star">*</span>';
    else cuerpoLbl.innerHTML='Nota <span style="font-weight:400;color:var(--tx3)">(opcional)</span>';
  }
  if(adjLabel)adjLabel.textContent=isOfi?'Documento del oficio + anexos':'Documentos / anexos';
  const mainLbl=document.getElementById('ofi-doc-main-lbl');
  const anexosLbl=document.getElementById('ofi-doc-anexos-lbl');
  if(mainLbl)mainLbl.textContent=isOfi?'Principal (obligatorio)':'Principal (opcional)';
  if(anexosLbl)anexosLbl.textContent=isMsg?'Anexos (pueden ir solos)':'Anexos (opcional)';
  if(notifPorWrap)notifPorWrap.style.display=showFirma?'':'none';
  if(btn){
    if(isMsg)btn.textContent='📤 Enviar mensaje y atender';
    else if(showFirma)btn.textContent='✍️ Enviar a firma del Director';
    else if(showEmail)btn.textContent='📤 Notificar por correo y atender';
    else btn.textContent='✓ Dar por atendida';
  }
  // Asunto de correo por defecto
  const subjEl=document.getElementById('ofi-doc-email-subject');
  const asunto=String((document.getElementById('ofi-doc-asunto')||{}).value||'').trim();
  if(subjEl&&showEmail&&!String(subjEl.value||'').trim()&&asunto)subjEl.value=asunto;
}
window.ofiDocSetTipo=ofiDocSetTipo;
window.ofiDocSetDestino=ofiDocSetDestino;
window.ofiDocSetCanal=ofiDocSetCanal;
window.ofiDocRefreshUi=ofiDocRefreshUi;
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
  const t={id:'_staging_',actividad:'Documento / comunicado',codigo:cod,depto:'guaviare',oficina:ofi,sinExpediente:true};
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
  const TIPO_MSG=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.MENSAJE:'mensaje';
  const TIPO_OFI=typeof PQRS_WF_TIPO!=='undefined'?PQRS_WF_TIPO.OFICIO:'oficio_firmado';
  const tipo=String((document.getElementById('ofi-doc-tipo')||{}).value||'').trim();
  if(!tipo){notif('Seleccione el tipo de salida (mensaje simple u oficio firmado)','err');return;}
  const destino=String((document.getElementById('ofi-doc-destino')||{}).value||'firma').trim()||'firma';
  const notifCorreo=!!((document.getElementById('ofi-doc-notif-correo')||{}).checked);
  const asunto=String((document.getElementById('ofi-doc-asunto')||{}).value||'').trim();
  const fecha=String((document.getElementById('ofi-doc-fecha')||{}).value||'').trim()||(typeof hoy==='function'?hoy():'');
  const oficio=String((document.getElementById('ofi-doc-oficio')||{}).value||'').trim();
  const cuerpo=String((document.getElementById('ofi-doc-cuerpo')||{}).value||'').trim();
  let notifPor=String((document.getElementById('entrega-ofi-firma-notif')||{}).value||'').trim();
  const emailTo=String((document.getElementById('ofi-doc-email-to')||{}).value||'').trim();
  const emailCc=String((document.getElementById('ofi-doc-email-cc')||{}).value||'').trim();
  const emailBcc=String((document.getElementById('ofi-doc-email-bcc')||{}).value||'').trim();
  const emailSubject=String((document.getElementById('ofi-doc-email-subject')||{}).value||'').trim()||asunto;
  const canalOtro=String((document.getElementById('ofi-doc-canal')||{}).value||'presencial').trim()||'presencial';
  const notifFecha=String((document.getElementById('ofi-doc-notif-fecha')||{}).value||'').trim()||fecha;
  const notifObs=String((document.getElementById('ofi-doc-notif-obs')||{}).value||'').trim();
  const fileInp=document.getElementById('entrega-ofi-firma-file');
  const ctxKey='entrega-ofi-firma:'+ofi;
  const staged=typeof sstFileCollect==='function'?sstFileCollect(ctxKey):null;
  const itFile=typeof sstFileGetMainItem==='function'?sstFileGetMainItem(ctxKey):null;
  const file=(itFile&&itFile.blob)||(fileInp&&fileInp.files&&fileInp.files[0])
    ||(staged&&staged.files&&staged.files[0]&&staged.files[0].blob)||null;
  const anexosStaged=(staged&&staged.anexos)||[];
  const preUploaded=(staged&&staged.preUploaded)||[];
  const hasMain=!!(file||itFile||preUploaded.some(function(u){return u&&!u.esAnexo;}));
  if(!asunto){notif('Indique el asunto o descripción','err');return;}
  if(!fecha){notif('Indique la fecha','err');return;}
  const isMsg=tipo===TIPO_MSG;
  const isOfi=tipo===TIPO_OFI;
  const modoFirma=isOfi&&destino==='firma';
  const modoListo=isOfi&&destino==='listo';
  const modoEmail=isMsg||(modoListo&&notifCorreo);
  const modoOtro=modoListo&&!notifCorreo;
  if(isOfi&&!oficio){notif('Para oficio firmado debe diligenciar el N° de oficio','err');return;}
  if((modoFirma||modoListo)&&!hasMain){notif('Adjunte el documento principal del oficio','err');return;}
  // Mensaje simple: puede ir solo con anexos (sin principal)
  if(modoEmail){
    const toList=emailTo.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s&&s.includes('@');});
    if(!toList.length){notif('Indique al menos un correo en «Para»','err');return;}
    if(!cuerpo){notif('Escriba el mensaje / cuerpo del correo','err');return;}
  }
  if(modoOtro&&!notifFecha){notif('Indique la fecha de notificación','err');return;}
  if(!notifPor&&typeof pqrsDefaultNotificadorOficina==='function')notifPor=pqrsDefaultNotificadorOficina(ofi);
  const btn=document.getElementById('entrega-ofi-firma-btn');
  if(btn){btn.disabled=true;btn.textContent='Procesando…';}
  let createdId='';
  try{
    const cod=window._entregaOfiFirmaCodigo||genCodigoActOficinaFirma(ofi);
    const autor=typeof taskComentarioAutor==='function'?taskComentarioAutor():(typeof labelOficina==='function'?labelOficina(ofi):ofi);
    const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    const actNom=oficio?('Oficio '+oficio+' — '+asunto):asunto;
    const faseCerrada=typeof PQRS_WF!=='undefined'?PQRS_WF.CERRADA:'cerrada_atendida';
    const faseFirma=typeof PQRS_WF!=='undefined'?PQRS_WF.POR_FIRMAR:'por_firmar';
    const canalFinal=modoEmail?(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.CORREO:'correo')
      :(modoOtro?canalOtro:(typeof PQRS_WF_CANAL!=='undefined'?PQRS_WF_CANAL.CORREO:'correo'));
    if(typeof sstCargaShow==='function')sstCargaShow({
      title:'Documento / comunicado',
      message:modoFirma?'Subiendo y enviando a firma…':(modoEmail?'Preparando envío…':'Registrando…'),
      pct:15,sub:(file&&file.name)||asunto
    });
    let t={
      id:typeof genTaskId==='function'?genTaskId():('tk_'+Date.now()),
      actividad:actNom,
      detalle:oficio?('Oficio '+oficio):'',
      desc:actNom,
      responsable:autor,
      responsables:[autor],
      asignados:[{nombre:autor,fechaReportada:hoyStr,fechaAtendida:modoFirma?'':hoyStr,estado:modoFirma?'pendiente':'atendida'}],
      depto:'guaviare',
      oficina:ofi,
      codigo:cod,
      sinExpediente:true,
      origen:'oficina_firma',
      requiereFirma:!!modoFirma,
      fechaReportada:fecha||hoyStr,
      fechaAtendida:modoFirma?'':(notifFecha||hoyStr),
      estado:modoFirma?'En ejecución':'Atendida',
      comentarios:[],
      historial:[{
        tipo:'oficina_doc_comunicado',
        fecha:hoyStr,
        por:autor,
        nota:modoFirma
          ?'Documento enviado a firma del Director'
          :(modoEmail
            ?((isMsg?'Mensaje simple':'Oficio')+' notificado por correo')
            :('Notificado por '+(typeof medioNotificacionRespLabel==='function'?medioNotificacionRespLabel(canalOtro):canalOtro)+(notifObs?' · '+notifObs:'')))
      }],
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
    const driveEstado=modoFirma?'por_firmar':'cerrado';
    async function uploadOne(blobOrItem,nombre,tipoMime,esAnexo,anexoN){
      let up=null;
      const blob=blobOrItem&&blobOrItem.blob?blobOrItem.blob:blobOrItem;
      const nm=nombre||(blob&&blob.name)||(esAnexo?('Anexo '+(anexoN||'')):'Documento');
      const tp=tipoMime||(blob&&blob.type)||'application/pdf';
      if(blobOrItem&&blobOrItem.state==='uploaded'&&blobOrItem.uploaded)up=blobOrItem.uploaded;
      else if(blobOrItem&&blobOrItem.driveLink&&!blob)up=blobOrItem;
      else if(blob&&typeof driveUploadExpedienteActividad==='function')
        up=await driveUploadExpedienteActividad(blob,nm,tp,ctx,t,autor,driveEstado);
      const sop={
        id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        url:(up&&(up.driveLink||up.url))||'',
        preview:(up&&(up.previewLink||up.driveLink||up.url))||'',
        label:nm,
        nombre:nm,
        fecha:new Date().toISOString(),
        autor:autor,
        version:1,
        activo:true,
        local:!up,
        driveFileId:(up&&(up.driveFileId||up.fileId))||'',
        driveFilename:(up&&(up.driveFilename||up.nombre))||'',
        driveEstado:driveEstado,
        driveInstitutional:!!up,
        tipo:tp,
        es_anexo:!!esAnexo,
        esAnexo:!!esAnexo,
        anexo_n:esAnexo?(anexoN||null):null
      };
      if(!sop.url&&blob&&typeof FileReader!=='undefined'){
        await new Promise(function(resolve){
          const fr=new FileReader();
          fr.onload=function(){sop.url=fr.result;sop.preview=fr.result;sop.local=true;resolve();};
          fr.onerror=function(){resolve();};
          fr.readAsDataURL(blob);
        });
      }
      return sop;
    }
    const soportes=[];
    // Principal
    if(itFile||file){
      const sopMain=await uploadOne(itFile||file,(file&&file.name)||(itFile&&itFile.nombre)||'Documento',(file&&file.type)||(itFile&&itFile.tipo)||'',false,null);
      if(!sopMain.url&&(modoFirma||modoListo)){
        const ix=actividadesLibres.findIndex(function(x){return x&&x.id===t.id;});
        if(ix>=0)actividadesLibres.splice(ix,1);
        throw new Error('No se pudo adjuntar el documento principal. Conecte Gmail/Drive e intente de nuevo.');
      }
      if(sopMain.url)soportes.push(sopMain);
    }else{
      preUploaded.filter(function(u){return u&&!u.esAnexo;}).forEach(function(u){
        soportes.push({
          id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          url:u.driveLink||u.url||'',
          preview:u.previewLink||u.driveLink||u.url||'',
          label:u.nombre||u.driveFilename||'Documento',
          nombre:u.nombre||u.driveFilename||'Documento',
          fecha:new Date().toISOString(),
          autor:autor,version:1,activo:true,local:false,
          driveFileId:u.driveFileId||u.fileId||'',
          driveFilename:u.driveFilename||u.nombre||'',
          driveEstado:driveEstado,driveInstitutional:true,
          tipo:u.tipo||'',es_anexo:false,esAnexo:false
        });
      });
    }
    if(t._drive_folder_id||(ctx&&ctx._drive_folder_id)){
      t._drive_folder_id=t._drive_folder_id||ctx._drive_folder_id;
      t._drive_folder_link=t._drive_folder_link||ctx._drive_folder_link||'';
    }
    // Anexos
    let anexoIdx=0;
    for(let i=0;i<anexosStaged.length;i++){
      const an=anexosStaged[i];
      anexoIdx++;
      const sopAn=await uploadOne(an,an.nombre||('Anexo '+anexoIdx),an.tipo||'',true,anexoIdx);
      if(sopAn.url)soportes.push(sopAn);
    }
    preUploaded.filter(function(u){return u&&u.esAnexo;}).forEach(function(u){
      anexoIdx++;
      soportes.push({
        id:'sop_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        url:u.driveLink||u.url||'',
        preview:u.previewLink||u.driveLink||u.url||'',
        label:u.nombre||u.driveFilename||('Anexo '+anexoIdx),
        nombre:u.nombre||u.driveFilename||('Anexo '+anexoIdx),
        fecha:new Date().toISOString(),
        autor:autor,version:1,activo:true,local:false,
        driveFileId:u.driveFileId||u.fileId||'',
        driveFilename:u.driveFilename||u.nombre||'',
        driveEstado:driveEstado,driveInstitutional:true,
        tipo:u.tipo||'',es_anexo:true,esAnexo:true,anexo_n:anexoIdx
      });
    });
    t.soportes=soportes;
    if(modoFirma){
      t.firmaWf={
        fase:faseFirma,
        tipo:TIPO_OFI,
        notificar_por:notifPor||'',
        notificar_por_propuesto:notifPor||'',
        canal:'correo',
        oficio:oficio||'',
        cuerpo:cuerpo||'',
        enviado_firma_en:new Date().toISOString(),
        enviado_firma_por:autor,
        listo_firma:{por:autor,en:new Date().toISOString(),atajo_digital:true,oficina:ofi},
        documentos:(t.soportes||[]).map(function(sop){
          const esAn=!!(sop.es_anexo||sop.esAnexo);
          return{
            nombre:sop.nombre||(esAn?'Anexo':'Documento para firma'),
            driveLink:sop.url,
            previewLink:sop.preview||sop.url,
            fileId:sop.driveFileId||'',
            tipo:esAn?'anexo_respuesta':'oficio_firma',
            es_anexo:esAn,
            anexo_n:sop.anexo_n||null,
            driveEstado:'por_firmar'
          };
        })
      };
    }else{
      t.firmaWf={
        fase:faseCerrada,
        tipo:isMsg?TIPO_MSG:TIPO_OFI,
        canal:canalFinal,
        oficio:oficio||'',
        cuerpo:cuerpo||'',
        email_to:modoEmail?emailTo:'',
        email_cc:modoEmail?emailCc:'',
        email_bcc:modoEmail?emailBcc:'',
        email_subject:modoEmail?emailSubject:'',
        notif_correo_entrega:!!modoEmail,
        notificacion:{
          canal:canalFinal,
          fecha:notifFecha||fecha,
          obs:notifObs||'',
          por:autor,
          en:new Date().toISOString(),
          a:modoEmail?emailTo:''
        },
        cerrado_por:autor,
        cerrado_en:new Date().toISOString(),
        documentos:(t.soportes||[]).map(function(sop){
          const esAn=!!(sop.es_anexo||sop.esAnexo);
          return{
            nombre:sop.nombre||(esAn?'Anexo':'Documento'),
            driveLink:sop.url,
            previewLink:sop.preview||sop.url,
            fileId:sop.driveFileId||'',
            tipo:esAn?'anexo_respuesta':(isMsg?'mensaje':'oficio_firmado'),
            es_anexo:esAn,
            anexo_n:sop.anexo_n||null,
            driveEstado:'cerrado'
          };
        })
      };
      t.estado='Atendida';
      t.fechaAtendida=notifFecha||hoyStr;
      t.verificadoPor=autor+' · documento/comunicado oficina';
    }
    if(modoEmail&&typeof pqrsEnviarCorreoCiudadano==='function'){
      const destinos=emailTo.split(/[,;]+/).map(function(s){return s.trim().toLowerCase();}).filter(function(s){return s&&s.includes('@');});
      let htmlBody=(cuerpo||'').replace(/\n/g,'<br>');
      const docsMail=(t.soportes||[]).filter(function(s){return s&&(s.url||s.preview);}).map(function(s){
        return{nombre:s.nombre||s.label||'Documento',driveLink:s.url||s.preview,previewLink:s.preview||s.url,fileId:s.driveFileId||''};
      });
      if(docsMail.length){
        htmlBody+='<hr><p style="font-size:12px"><strong>Documentos:</strong></p><ul>';
        docsMail.forEach(function(d){
          htmlBody+='<li><a href="'+escAttr(d.driveLink)+'">'+escAttr(d.nombre)+'</a></li>';
        });
        htmlBody+='</ul>';
      }
      let adjuntos=[];
      if(typeof pqrsPrepararAdjuntosNotificacionCorreo==='function'&&docsMail.length){
        try{adjuntos=await pqrsPrepararAdjuntosNotificacionCorreo(docsMail,{});}catch(errAdj){console.warn('ofi-doc adjuntos:',errAdj);}
      }
      const sent=await pqrsEnviarCorreoCiudadano(destinos,emailSubject||asunto,htmlBody,true,adjuntos,{
        cc:emailCc,bcc:emailBcc,oficinaId:ofi
      });
      if(!sent)throw new Error('No se pudo enviar el correo. Verifique la cuenta de la oficina.');
    }
    if(typeof persistActividadesLibresFirestore==='function'){
      try{await persistActividadesLibresFirestore();}catch(errP){console.warn('persist act libre oficina:',errP);}
    }else if(typeof persistExpLocal==='function')persistExpLocal();
    else if(typeof saveLS==='function')saveLS();
    if(typeof sstCargaDone==='function')sstCargaDone({holdMs:200});
    closeTaskModal();
    if(modoFirma){
      notif('✍️ Documento '+cod+' enviado a «Por firmar» (Director)'+(notifPor?' · Notificará: '+notifPor:''),'ok');
      window._pqrsOfiFiltro='por_firmar';
    }else if(modoEmail){
      notif('✅ '+(isMsg?'Mensaje':'Oficio')+' enviado por correo — actividad '+cod+' atendida','ok');
    }else{
      const ml=typeof medioNotificacionRespLabel==='function'?medioNotificacionRespLabel(canalOtro):canalOtro;
      notif('✅ Notificado por '+ml+' — actividad '+cod+' atendida','ok');
    }
    if(typeof renderPqrsOficinaInbox==='function')renderPqrsOficinaInbox();
    if(typeof renderActividades==='function')renderActividades();
  }catch(err){
    if(createdId&&Array.isArray(actividadesLibres)){
      const ix=actividadesLibres.findIndex(function(x){return x&&x.id===createdId;});
      if(ix>=0)actividadesLibres.splice(ix,1);
    }
    if(typeof sstCargaHide==='function')sstCargaHide();
    notif('Error: '+String(err.message||err).slice(0,160),'err');
    if(btn){btn.disabled=false;ofiDocRefreshUi();}
  }
}

