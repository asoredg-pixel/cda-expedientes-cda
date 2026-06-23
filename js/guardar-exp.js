// =============================================================================
// guardar-exp.js — GUARDAR EXPEDIENTE
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// GUARDAR EXPEDIENTE
// ================================================================
function mergeTasksForSave(formTasks,prevTasks){
  const prevMap={};
  (prevTasks||[]).map(normalizeTask).forEach(t=>{if(t.id)prevMap[t.id]=t;});
  const formIds=new Set();
  const merged=(formTasks||[]).map(ft=>{
    formIds.add(ft.id);
    const p=prevMap[ft.id];
    if(!p)return ft;
    return normalizeTask({
      ...p,...ft,
      responsables:(ft.responsables&&ft.responsables.length)?ft.responsables:(p.responsables||[]),
      asignados:(ft.asignados&&ft.asignados.length)?ft.asignados:(p.asignados||[]),
      entregaModo:ft.entregaModo||p.entregaModo||'individual',
      comentarios:(ft.comentarios&&ft.comentarios.length)?ft.comentarios:(p.comentarios||[]),
      historial:(ft.historial&&ft.historial.length)?ft.historial:(p.historial||[]),
      soportes:(ft.soportes&&ft.soportes.length)?ft.soportes:(p.soportes||[]),
      notasDoc:(ft.notasDoc&&ft.notasDoc.length)?ft.notasDoc:(p.notasDoc||[]),
      fechaReportada:p.fechaReportada||ft.fechaReportada,
      verificadoPor:p.verificadoPor||ft.verificadoPor
    });
  });
  (prevTasks||[]).map(normalizeTask).forEach(p=>{
    if(p.eliminada&&p.id&&!formIds.has(p.id))merged.push(p);
  });
  return merged;
}
function prevTasksForExp(expId){
  const prevExp=exps.find(x=>x._exp===expId);
  return prevExp&&prevExp.tasks?prevExp.tasks:[];
}
function getTasksSafe(prevTasks){
  const cont=getTkCont();
  const form=getTasks();
  const prev=(prevTasks||[]).map(normalizeTask).filter(t=>!t.eliminada||t.actividad||t.detalle);
  if(!form.length&&prev.length&&(!cont||!cont.querySelector('.tkr-wrap')))return prev;
  return form;
}
function getFormRootSel(){return window._conPanelEditMode?'#con-side-form-wrap':'#form-area';}
function getFormRootId(){return window._conPanelEditMode?'con-side-form-wrap':'form-area';}
function getTkCont(){
  const root=document.querySelector(getFormRootSel());
  if(root){
    const c=root.querySelector('.tk-cont');
    if(c)return c;
  }
  return document.querySelector('#con-side-form-wrap .tk-cont')||document.querySelector('#form-area .tk-cont')||document.querySelector('.tk-cont');
}
function forEachActiveTkRow(fn){
  const cont=getTkCont();
  if(!cont)return;
  cont.querySelectorAll('.tkr-wrap').forEach(fn);
}
function isFormExpVisible(expId){
  if(!expId)return false;
  if(editId===expId)return true;
  return !!(window._conPanelEditMode&&window._conPanelActive===expId&&document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'));
}
function syncTkRowsFromExp(expId,taskId){
  const e=getExpById(expId);
  if(!e||!isFormExpVisible(expId))return;
  forEachActiveTkRow(row=>{
    const m=readTaskMeta(row);
    if(taskId&&m.id!==taskId)return;
    const t=getTaskFromExp(e,m.id);
    if(t)persistTaskToRow(row,t);
  });
}
function refreshFormularioExp(expId){
  const e=getExpById(expId);
  if(!e||!isFormExpVisible(expId))return;
  setCfgPtr(e._depto||getDeptoOperativo());
  renderFormulario(e._tramite,e,getFormRootId());
}
function captureFormSectionState(){
  const container=document.querySelector(getFormRootSel());
  if(!container)return[];
  return Array.from(container.querySelectorAll('details.form-section')).filter(d=>d.open).map(d=>{
    const s=d.querySelector('summary');
    return s?s.textContent.replace(/\s+/g,' ').trim():'';
  }).filter(Boolean);
}
function restoreFormSectionState(labels){
  if(!labels||!labels.length)return;
  const container=document.querySelector(getFormRootSel());
  if(!container)return;
  container.querySelectorAll('details.form-section').forEach(d=>{
    const s=d.querySelector('summary');
    const lbl=s?s.textContent.replace(/\s+/g,' ').trim():'';
    if(labels.includes(lbl))d.open=true;
  });
}
function syncFormularioTrasGuardar(tid,expId,openSecs){
  editId=expId;
  const rootSel=getFormRootSel();
  const lbl=document.querySelector(rootSel+' > .slbl');
  if(lbl)lbl.textContent='Editando: '+expId;
  document.querySelectorAll(rootSel+' .section-save .btn').forEach(b=>{b.innerHTML='💾 Actualizar sección';});
  const mainBtn=document.querySelector(rootSel+' > .ar .btn.bp');
  if(mainBtn)mainBtn.innerHTML='💾 Actualizar';
  restoreFormSectionState(openSecs);
}
function guardarExpDesdePanel(){guardarExp(true);}
function puedeEditarExpPanel(){return !esSoloLectura()&&!esJurisdiccional();}
function abrirConsultaExpPanelDesdeAct(expId,taskId){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  if(!expId){notif('Indique el número de expediente','err');return;}
  window._conPanelTaskId=taskId||null;
  window._conPanelOpenArchivos=false;
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e){notif('Expediente «'+expId+'» no encontrado','err');return;}
  const t=taskId?getTaskAny(expId,taskId):null;
  const esPqrsNcaAct=e&&t&&taskEsAtenderPqrs(t,e)&&esOficinaPqrsNca();
  const pqrsRead=esPqrsSecretaria(e)&&(esModoResponsable()||esModoOficinaDeguv());
  window._conPanelPqrsNcaEdit=!!(esPqrsNcaAct&&!esVistaActividadesDepto());
  const editDept=esVistaActividadesDepto()&&puedeEditarExpPanel();
  const edit=!esModoResponsable()&&(editDept||(esPqrsNcaAct?puedeEditarExpPanel():false)||(!pqrsRead&&esVistaActividadesDepto()&&puedeEditarExpPanel()));
  abrirConsultaExpPanel(expId,{allowSingle:true,edit:!!edit});
}
function guardarExp(stayOnForm){
  try{guardarExpCore(stayOnForm);}
  catch(err){
    console.error('guardarExp',err);
    notif('Error al guardar: '+(err&&err.message?err.message:'revise los datos'),'err');
  }
}
function guardarExpCore(stayOnForm){
  if(esSoloLectura()){notif('En este modo no puede modificar expedientes','err');return;}
  let tid=(document.getElementById('r_tramite')||{}).value||'';
  if(!tid&&editId){const exT=exps.find(x=>x._exp===editId);if(exT)tid=exT._tramite||'';}
  if(!tid){notif('Seleccione un tipo de trámite','err');return;}
  const deptoSave=getDeptoOperativo();
  const prevEditRec=editId?exps.find(x=>x._exp===editId):null;
  if(esTramitePqrs(tid)&&!(prevEditRec&&esPqrsSecretaria(prevEditRec))){
    confirmPrecaucion({
      title:'PQRSD solo por Secretaría',
      message:'Las PQRSD se radican únicamente desde el módulo de Secretaría DEGUV, no desde el registro de trámites del departamento.',
      confirmLabel:'Entendido',
      tone:'warn'
    },function(){});
    return;
  }
  const t=getTram(tid,deptoSave);
  if(!t){notif('Tipo de trámite no encontrado en la configuración del departamento','err');return;}
  const expId=gv('fld__exp');
  if(!expId){notif('Complete N° Expediente','err');return;}
  const fechaCollect=collectFechasEstado();
  if(!fechaCollect._fecha&&stayOnForm){
    const prev=exps.find(x=>x._exp===(editId||expId));
    const vis=document.getElementById('fld__fecha_estado');
    fechaCollect._fecha=(prev&&prev._fecha)||(vis&&vis.value)||hoy();
    const feO=JSON.parse(fechaCollect._fechas_estado||'{}');
    if(!feO.Solicitud)feO.Solicitud=fechaCollect._fecha;
    fechaCollect._fechas_estado=JSON.stringify(feO);
  }
  const fecha=fechaCollect._fecha;
  if(!fecha){notif('Complete la fecha de Solicitud en Control del trámite','err');return;}
  syncExpAsociados();
  const prevRec=exps.find(x=>x._exp===(editId||expId));
  const prevAsoc=prevRec?getExpAsociadosDirectos(prevRec):[];
  if(document.getElementById('fld__usar_exp_asociados')&&document.getElementById('fld__usar_exp_asociados').checked){
    const asoc=expedientesAsociadosData(gv('fld__expedientes_asociados'));
    const bad=validarExpedientesAsociados(asoc,expId,deptoSave);
    if(bad.length){
      const msgExtra=!expAsocDeptoAceptaPqrsEnLista(deptoSave)?' Las PQRSD solo se asocian en expedientes de Guaviare.':'';
      notif('Solo puede asociar expedientes ya registrados en el sistema.'+msgExtra+' No válidos: '+bad.join(', '),'err');
      return;
    }
  }
  const esPqrs=esTramitePqrs(tid);
  const esSanc=esTramiteSancionatorio(tid);
  const esCaso=esPqrs||esSanc;
  if(!stayOnForm){
    if(responsablePuedeEditarSec('persona')){
      if(!esCaso){
        const tipoPersona=gv('fld__tipo_persona')||'natural';
        if(tipoPersona==='natural'&&!validarEmailCampo('fld__pn_correo','Correo de persona natural'))return;
        if(tipoPersona==='juridica'&&(!validarEmailCampo('fld__pj_rep_correo','Correo del representante legal')||!validarEmailCampo('fld__pj_correo','Correo de la empresa')))return;
        if(document.getElementById('fld__est_com')&&document.getElementById('fld__est_com').checked&&!validarEmailCampo('fld__pn_correo','Correo de persona natural'))return;
        if(document.getElementById('fld__apoderado')&&document.getElementById('fld__apoderado').checked&&!validarEmailCampo('fld__apo_correo','Correo del apoderado'))return;
      }else if(!(document.getElementById('fld__qd_anonimo')&&document.getElementById('fld__qd_anonimo').checked)&&!validarEmailCampo('fld__qd_correo','Correo del quejoso'))return;
    }
  }
  onContableChange();
  if(!stayOnForm&&responsablePuedeEditarSec('campos')){
    for(const c of (t.campos||[])){
      if(esSecSolicitante(c.seccion)||esSecInfoTecnica(c.seccion))continue;
      if(c.requerido){const el=document.getElementById('fld_'+c.id);if(!el||!el.value.trim()){notif('Campo requerido: '+c.label,'err');return;}}
    }
  }
  if(!stayOnForm&&responsablePuedeEditarSec('info_tec')&&!validarInfoTecnicaExp(deptoSave))return;
  const camposVals={};
  (t.campos||[]).forEach(c=>{
    if(esSecInfoTecnica(c.seccion))return;
    const el=document.getElementById('fld_'+c.id);
    if(el)camposVals['f_'+c.id]=c.tipo==='checkbox'?el.checked:el.value.trim();
  });
  const prevT=prevTasksForExp(expId);
  let data={
    _depto:deptoSave,_tramite:tid,_exp:expId,
    _usar_etapa:false,
    _etapa:'',_estado:gv('fld__estado')||'Solicitud',
    _instructor:'',...fechaCollect,
    _resolucion:gv('fld__resolucion'),
    _fecha_res:document.getElementById('fld__fecha_res')?document.getElementById('fld__fecha_res').value:'',
    _medida_prev:false,_suspendido:false,_sancionatorio:false,_exp_sancionatorio:'',
    _etapa_seg:'',
    _fecha_seg:getFechaEstado({...fechaCollect,_fechas_estado:fechaCollect._fechas_estado},'Seguimiento')||'',
    _obs_seg:'',
    ...collectDetalleNotas(),
    _es_pqrs:esCaso,_es_queja:esCaso,
    _tipo_solicitud:esPqrs?gv('fld__tipo_solicitud'):'',
    _tipo_sancionatorio:esSanc?gv('fld__tipo_sancionatorio'):'',
    _usar_exp_asociados:document.getElementById('fld__usar_exp_asociados')?document.getElementById('fld__usar_exp_asociados').checked:false,
    _expedientes_asociados:gv('fld__expedientes_asociados')||'[]',
    _qd_anonimo:document.getElementById('fld__qd_anonimo')?document.getElementById('fld__qd_anonimo').checked:false,
    _qd_nombre:gv('fld__qd_nombre'),_qd_identificacion:gv('fld__qd_identificacion'),_qd_correo:gv('fld__qd_correo'),_qd_telefono:gv('fld__qd_telefono'),...getDir('qd'),
    _pi_tipo_persona:gv('fld__pi_tipo_persona')||'natural',
    _pi_nombre:gv('fld__pi_nombre'),_pi_identificacion:gv('fld__pi_identificacion'),_pi_correo:gv('fld__pi_correo'),_pi_telefono:gv('fld__pi_telefono'),...getDir('pi'),
    _pi_rep_nombre:gv('fld__pi_rep_nombre'),_pi_rep_identificacion:gv('fld__pi_rep_identificacion'),_pi_rep_correo:gv('fld__pi_rep_correo'),_pi_rep_telefono:gv('fld__pi_rep_telefono'),
    _pi_empresa:gv('fld__pi_empresa'),_pi_nit:gv('fld__pi_nit'),_pi_correo_emp:gv('fld__pi_correo_emp'),_pi_telefono_emp:gv('fld__pi_telefono_emp'),...getDir('pi_emp'),
    _tipo_persona:gv('fld__tipo_persona')||'natural',
    _pn_nombre:gv('fld__pn_nombre'),_pn_identificacion:gv('fld__pn_identificacion'),_pn_correo:gv('fld__pn_correo'),_pn_telefono:gv('fld__pn_telefono'),
    ...getDir('pn'),
    _est_com:document.getElementById('fld__est_com')?document.getElementById('fld__est_com').checked:false,
    _ec_nombre:gv('fld__ec_nombre'),_ec_telefono:gv('fld__ec_telefono'),...getDir('ec'),
    _pj_rep_nombre:gv('fld__pj_rep_nombre'),_pj_rep_identificacion:gv('fld__pj_rep_identificacion'),_pj_rep_correo:gv('fld__pj_rep_correo'),_pj_rep_telefono:gv('fld__pj_rep_telefono'),
    _pj_empresa:gv('fld__pj_empresa'),_pj_nit:gv('fld__pj_nit'),_pj_correo:gv('fld__pj_correo'),_pj_telefono:gv('fld__pj_telefono'),...getDir('pj'),
    _apoderado:document.getElementById('fld__apoderado')?document.getElementById('fld__apoderado').checked:false,
    _apo_nombre:gv('fld__apo_nombre'),_apo_identificacion:gv('fld__apo_identificacion'),_apo_correo:gv('fld__apo_correo'),_apo_telefono:gv('fld__apo_telefono'),...getDir('apo'),
    _autorizado:document.getElementById('fld__autorizado')?document.getElementById('fld__autorizado').checked:false,
    _aut_nombre:gv('fld__aut_nombre'),_aut_identificacion:gv('fld__aut_identificacion'),_aut_correo:gv('fld__aut_correo'),_aut_telefono:gv('fld__aut_telefono'),...getDir('aut'),
    _medio_notificacion:gv('fld__medio_notificacion')||'',
    tasks:mergeTasksForSave(getTasksSafe(prevT),prevT),...collectContable(),...collectActosAdmin(),...collectConceptosSeg(),...collectInfoTecnicaExp(),...camposVals
  };
  if(stayOnForm){
    const prevRec=exps.find(x=>x._exp===(editId||expId));
    if(prevRec){
      data._depto=prevRec._depto||deptoSave;
    }
  }
  const actosArr=actosAdminData(data._actos_admin);
  const conceptosArr=conceptosSegData(data._conceptos_seg);
  if(!stayOnForm&&responsablePuedeEditarSec('seguimiento')){
    for(const c of conceptosArr){
      if(c.reqCumplido&&!c.reqFechaCump){notif('Indique la fecha de cumplimiento del requerimiento','err');return;}
    }
  }
  Object.assign(data,mergeExpedienteFlags(actosArr,conceptosArr));
  if(!stayOnForm)applyAutoEstadoFromActos(data,actosArr);
  syncFechasEstadoConEstado(data);
  if(!stayOnForm){
    if(esModoCasoEspecial(data)){
    data._tipo_persona='natural';
    data._pn_nombre='';data._pn_identificacion='';data._pn_correo='';data._pn_telefono='';limpiarDirData(data,'pn');
    data._est_com=false;data._ec_nombre='';data._ec_telefono='';limpiarDirData(data,'ec');
    data._pj_rep_nombre='';data._pj_rep_identificacion='';data._pj_rep_correo='';data._pj_rep_telefono='';
    data._pj_empresa='';data._pj_nit='';data._pj_correo='';data._pj_telefono='';limpiarDirData(data,'pj');
    if(!data._apoderado){data._apo_nombre='';data._apo_identificacion='';data._apo_correo='';data._apo_telefono='';limpiarDirData(data,'apo');}
    if(!data._autorizado){data._aut_nombre='';data._aut_identificacion='';data._aut_correo='';data._aut_telefono='';limpiarDirData(data,'aut');}
    if(data._qd_anonimo){
      data._qd_nombre='';data._qd_identificacion='';data._qd_correo='';data._qd_telefono='';limpiarDirData(data,'qd');
    }
    if(data._pi_tipo_persona==='juridica'){
      data._pi_nombre='';data._pi_identificacion='';data._pi_correo='';data._pi_telefono='';limpiarDirData(data,'pi');
    }else{
      data._pi_rep_nombre='';data._pi_rep_identificacion='';data._pi_rep_correo='';data._pi_rep_telefono='';
      data._pi_empresa='';data._pi_nit='';data._pi_correo_emp='';data._pi_telefono_emp='';limpiarDirData(data,'pi_emp');
    }
  }else{
    data._qd_anonimo=false;data._qd_nombre='';data._qd_identificacion='';data._qd_correo='';data._qd_telefono='';limpiarDirData(data,'qd');
    data._pi_tipo_persona='natural';data._pi_nombre='';data._pi_identificacion='';data._pi_correo='';data._pi_telefono='';limpiarDirData(data,'pi');
    data._pi_rep_nombre='';data._pi_rep_identificacion='';data._pi_rep_correo='';data._pi_rep_telefono='';
    data._pi_empresa='';data._pi_nit='';data._pi_correo_emp='';data._pi_telefono_emp='';limpiarDirData(data,'pi_emp');
    if(data._tipo_persona==='juridica'){
      data._pn_nombre='';data._pn_identificacion='';data._pn_correo='';data._pn_telefono='';limpiarDirData(data,'pn');
      data._est_com=false;data._ec_nombre='';data._ec_telefono='';limpiarDirData(data,'ec');
    }else{
      data._pj_rep_nombre='';data._pj_rep_identificacion='';data._pj_rep_correo='';data._pj_rep_telefono='';
      data._pj_empresa='';data._pj_nit='';data._pj_correo='';data._pj_telefono='';limpiarDirData(data,'pj');
    }
    if(!data._apoderado){data._apo_nombre='';data._apo_identificacion='';data._apo_correo='';data._apo_telefono='';limpiarDirData(data,'apo');}
    if(!data._autorizado){data._aut_nombre='';data._aut_identificacion='';data._aut_correo='';data._aut_telefono='';limpiarDirData(data,'aut');}
    if(!esTramitePqrs(data._tramite))data._tipo_solicitud='';
    if(!esTramiteSancionatorio(data._tramite))data._tipo_sancionatorio='';
    }
  }
  if(!data._sancionatorio)data._exp_sancionatorio='';
  let idx=editId?exps.findIndex(e=>e._exp===editId):-1;
  if(idx<0)idx=exps.findIndex(e=>e._exp===expId);
  if(esModoResponsable()&&responsableActivo){
    const secs=getRegSeccionesResponsableActivo();
    if(idx<0&&!secs.includes('control')){notif('No tiene permiso para crear nuevos expedientes','err');return;}
    if(idx>=0){
      const prevMerge=exps[idx]||{};
      data=mergeExpDataPorSecciones(data,prevMerge,secs);
    }
  }
  if(idx>=0){
    const prev=exps[idx]||{};
    const dup=expNumeroDuplicado(expId,{excludeExp:prev._exp});
    if(dup){alertRegistroDuplicado(expId,'expediente',dup);return;}
    data._depto=prev._depto||deptoSave;
    if(Array.isArray(prev._docs_tramite))data._docs_tramite=prev._docs_tramite;
    if(prev._pqrs_informativa)data._pqrs_informativa=prev._pqrs_informativa;
    const prevEstado=prev._estado||'';
    exps[idx]={...data,historial:rebuildHistorial(data,prev.historial)};
    editId=expId;
    const esPqrsExp=esPqrsSecretaria(data)||esTramitePqrs(data._tramite);
    if(esPqrsExp)logAudit('Editó PQRSD ['+expId+']','pqrsd',expId);
    else logAudit('Editó expediente ['+expId+']','expedientes',expId);
    if(prevEstado&&data._estado&&prevEstado!==data._estado){
      logAudit('Cambió estado de '+prevEstado+' a '+data._estado+' en ['+expId+']','expedientes',expId);
    }
  }else{
    const dup=expNumeroDuplicado(expId);
    if(dup){alertRegistroDuplicado(expId,'expediente',dup);return;}
    exps.push({...data,historial:rebuildHistorial(data,[])});
    editId=expId;
    const esPqrsExp=esPqrsSecretaria(data)||esTramitePqrs(data._tramite);
    if(esPqrsExp)logAudit('Creó PQRSD ['+expId+']','pqrsd',expId);
    else logAudit('Creó expediente ['+expId+']','expedientes',expId);
  }
  upsertPersonaCatalog(data);
  const nuevosAsoc=data._usar_exp_asociados?expedientesAsociadosData(data._expedientes_asociados):[];
  aplicarAsociadosBidireccional(expId,nuevosAsoc,prevAsoc);
  if(window._conPanelActive===expId||editId===expId){
    liberarExpLock(expId);
    detenerRenovacionExpLock();
  }
  const savedExp=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  try{
    _saveLSLocal();
    checkLocalStorageCapacityAfterSave();
  }catch(e){
    if(isQuotaExceededError(e)){
      showStorageFullBanner();
      console.error('QuotaExceededError: almacenamiento local lleno; los datos NO se guardaron.',e);
    }else{
      console.error('Error al guardar en localStorage:',e);
    }
    return;
  }
  if(savedExp){
    updateSyncIndicator('syncing');
    Promise.all([
      saveExpedienteDoc(deptoActivo,savedExp),
      saveGlobalFirestore()
    ]).then(function(results){
      updateSyncIndicator(results.every(r=>r!==false)?'synced':'error');
    }).catch(function(){
      updateSyncIndicator('error');
    });
  }
  renderTabla();
  if(document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
  if(stayOnForm){
    const openSecs=captureFormSectionState();
    notif('Cambios guardados exitosamente','ok');
    if(window._conPanelEditMode&&document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')){
      renderConSidePanel();
      if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    }else{
      syncFormularioTrasGuardar(tid,expId,openSecs);
    }
    renderBandejaDepto();
  }else{
    limpiarForm();
    notif('Expediente guardado','ok');
  }
}
function nuevoExp(){
  if(esSoloLectura()){notif('En este modo solo puede consultar','err');return;}
  if(esModoResponsable()&&!responsablePuedeEditarSec('control')){notif('No tiene permiso para crear nuevos expedientes','err');return;}
  limpiarForm();showTab('reg');window.scrollTo(0,0);
}
function limpiarForm(){
  editId=null;
  const el=document.getElementById('r_tramite');if(el)el.value='';
  document.getElementById('form-area').innerHTML='<div style="text-align:center;padding:2rem;color:var(--tx3);background:var(--sf);border:1px dashed var(--bd);border-radius:var(--rl)">Seleccione un tipo de trámite</div>';
  tkSeq=0;
}
function editarExp(expId){
  expId=String(expId||'').trim();
  if(!expId){notif('Indique el número de expediente','err');return;}
  if(abrirPqrsBasicoSiAplica(expId))return;
  if(esSoloLectura()){
    if(esModoResponsable()&&responsableActivo&&!responsablePuedeVerRegistro())verCon(expId);
    else if(esModoResponsable())notif('Seleccione su nombre y verifique que tenga secciones habilitadas en Configuración','err');
    else notif('En este modo no puede editar expedientes','err');
    return;
  }
  const e=exps.find(x=>String(x._exp||'').trim()===expId);
  if(!e){notif('Expediente «'+expId+'» no encontrado','err');return;}
  window._conPanelPqrsNcaEdit=!!(e&&esPqrsSecretaria(e)&&esOficinaPqrsNca()&&!esVistaActividadesDepto());
  abrirConsultaExpPanel(expId,{allowSingle:true,edit:true});
}
function eliminarExp(expId){
  const e=exps.find(x=>x._exp===expId);
  if(e&&esPqrsSecretaria(e)&&!esSecretaria()){notif('Solo Secretaría puede eliminar PQRSD','err');return;}
  if(esUsuarioContratista()){notif('No puede eliminar expedientes','err');return;}
  if(esSoloLectura()){notif('En este modo no puede eliminar expedientes','err');return;}
  confirmPrecaucion({
    title:'⚠️ Eliminar expediente',
    message:'Esta acción eliminará el expediente del registro activo. ¿Está seguro de que desea continuar?',
    detail:expId+(e?' · '+getNom(e):''),
    confirmLabel:'Sí, eliminar expediente'
  },function(){
    const esPqrsExp=e&&esPqrsSecretaria(e);
    const expRef=e||{_exp:expId,_depto:deptoActivo||'guaviare'};
    exps=exps.filter(x=>x._exp!==expId);
    if(esPqrsExp)logAudit('Eliminó PQRSD ['+expId+']','pqrsd',expId);
    else logAudit('Eliminó expediente ['+expId+']','expedientes',expId);
    if(editId===expId){editId=null;showTab('reg');}
    try{
      _saveLSLocal();
      checkLocalStorageCapacityAfterSave();
    }catch(err){
      if(isQuotaExceededError(err)){
        showStorageFullBanner();
        console.error('QuotaExceededError: almacenamiento local lleno; los datos NO se guardaron.',err);
      }else{
        console.error('Error al guardar en localStorage:',err);
      }
      return;
    }
    updateSyncIndicator('syncing');
    deleteExpedienteDoc(deptoActivo,expRef).then(function(ok){
      updateSyncIndicator(ok?'synced':'error');
    }).catch(function(){
      updateSyncIndicator('error');
    });
    renderTabla();notif('Expediente eliminado','ok');
  });
}
function verCon(expId){
  const id=String(expId||'').trim();
  if(abrirPqrsBasicoSiAplica(id))return;
  const e=exps.find(x=>String(x._exp||'').trim()===id);
  if(!e){notif('Expediente «'+id+'» no encontrado','err');showTab('con');return;}
  if(e._depto&&deptoActivo!=='jurisdiccional'&&deptoActivo!=='responsables'&&e._depto!==deptoActivo)cambiarDeptoActivo(e._depto);
  document.getElementById('q-txt').value=id;
  ['q-est','q-tram','q-inst','q-fl','q-act'].forEach(sid=>{const el=document.getElementById(sid);if(el)el.value='';});
  showTab('con');
}

// ================================================================