// =============================================================================
// formulario.js — TABS + SELECTS + FORMULARIO DINAMICO
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// ================================================================
// TABS
// ================================================================
function showTab(t){
  // Recordar última pestaña elegida (evita saltos automáticos a Consulta)
  const wanted=t;
  const prevTab=window._sstTabActual||'';
  if(typeof puedeVerTabSesion==='function'&&!puedeVerTabSesion(t)){
    const vis=getTabsVisiblesSesion();
    // Si se pide act y el responsable puede verla, respetar (no caer a Correos/Consulta)
    if(t==='act'&&typeof esModoResponsable==='function'&&esModoResponsable()&&typeof puedeVerTabActividades==='function'&&puedeVerTabActividades()){
      /* keep act */
    }else if(typeof esModoResponsable==='function'&&esModoResponsable()&&vis.includes('act')){
      t='act';
    }else{
      t=vis.length?vis[0]:'con';
    }
  }
  if(esModoCiudadano()&&t!=='ciudadano')t='ciudadano';
  if(esSecretaria()&&t!=='sec'&&t!=='con'&&t!=='pqrs-ofi'&&t!=='gmail-ofi'&&t!=='rec')t='sec';
  if(esModoOficinaDeguv()&&(t==='reg'||t==='cfg'||t==='cons'))t=(t==='con'?'con':'pqrs-ofi');
  if(esJurisdiccional()&&t!=='con'&&t!=='cons')t='con';
  if((esModoResponsable()||esModoContratista())&&t==='reg'&&!responsablePuedeVerRegistro())t='act';
  if(esModoResponsable()&&t==='cons')t='act';
  if(esModoResponsable()&&t==='cfg')t='act';
  if(t==='rec'&&!puedeVerRecursos())t=esModoResponsable()?'act':'con';
  // secretary can switch between sec and gmail-ofi freely
  if(esSecretaria()&&t==='gmail-ofi')t='gmail-ofi';
  if(t==='act'&&!puedeVerTabActividades()){notif('Seleccione su nombre como encargado del departamento para ver actividades','err');t=esModoOficinaDeguv()?'pqrs-ofi':(esSecretaria()?'sec':'con');}
  if(t==='agenda'){if(typeof openMiDiaDesdeNav==='function')openMiDiaDesdeNav();return;}
  // No empujar a Consulta si el responsable ya está (o pidió) Actividades
  if(esModoResponsable()&&wanted==='act'&&puedeVerTabActividades())t='act';
  if(t!=='cfg'){/* cfg sync global durante toda la sesión */}
  window._sstTabActual=t;
  let pgTarget=document.getElementById('pg-'+t);
  if(!pgTarget){
    t=esModoResponsable()?'act':'con';
    window._sstTabActual=t;
    pgTarget=document.getElementById('pg-'+t);
  }
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.sst-nav-items .tab, .tabsi .tab').forEach(b=>{if(b.id!=='nav-tasks'){b.classList.remove('on');b.classList.remove('tab-selected');}});
  if(typeof setNavTasksActive==='function')setNavTasksActive(false);
  if(pgTarget)pgTarget.classList.add('on');
  const tabBtn=document.getElementById('tab-'+t);
  if(tabBtn){tabBtn.classList.add('on');tabBtn.classList.add('tab-selected');}
  if(t==='reg'){poblarTramSelect();renderTabla();}
  if (t==='sec'){
    poblarSecOficinaSelect();
    renderSecretariaPqrs();
    if(window._gmailPendingMsgId&&_gmailCurrentMsg&&typeof renderSecEmailPanel==='function'){
      renderSecEmailPanel(_gmailCurrentMsg);
    }
  }
  if(t==='pqrs-ofi'){
    if(prevTab!=='pqrs-ofi'&&!window._pqrsOfiFiltroSticky)window._pqrsOfiFiltro='pend';
    window._pqrsOfiFiltroSticky=false;
    initPeriodoFiltros('pqrs-ofi');
    renderPqrsOficinaInbox();
  }
  if(t==='gmail-ofi'){if(typeof gmailOfiInitPanel==='function')gmailOfiInitPanel();}
  if(t==='rec'){if(typeof recursosInitPanel==='function')recursosInitPanel();}
  if(t==='ciudadano'){
    if(typeof aplicarConsultaCiudadanaDesdeUrl==='function')aplicarConsultaCiudadanaDesdeUrl({buscar:false});
    const inp=document.getElementById('ciudadano-exp');
    if(inp&&!inp.value&&window._ciudadanoUltExp)inp.value=window._ciudadanoUltExp;
    if(inp&&String(inp.value||'').trim())buscarExpCiudadano();
  }
  if(t==='act'){
    if(prevTab!=='act'&&!window._actFiltroSticky){
      const sel=document.getElementById('f-act-est');
      if(sel)sel.value='pend';
    }
    window._actFiltroSticky=false;
    initPeriodoFiltros('act');
    renderActividades();
  }
  if(t==='con'){poblarFiltrosCon();initPeriodoFiltros('q');actualizarConsultaPqrsUI();renderConsulta();}
  if(t==='cons'){initPeriodoFiltros('cons');renderConsolidado();}
  if(t==='cfg'){
    updateDeptoUI();
    renderCfg();
    suscribirCfgSync(deptoCfg||deptoActivo);
    // Precargar usuarios autorizados al abrir Config (evita lista vacía en admin)
    if(typeof ensureUsuariosFirestoreCache==='function'){
      ensureUsuariosFirestoreCache(true).then(function(){
        if(typeof renderListasCfg==='function'&&document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on'))renderListasCfg();
      }).catch(function(){});
    }
    if(!_usuariosFsUnsub&&typeof startUsuariosFirestoreListener==='function'&&document.body.classList.contains('sesion-activa')){
      startUsuariosFirestoreListener();
    }
  }
  updateDeptoUI();
}
function showCfgTab(t){
  if(t==='auditoria'&&!esAdministrador()){notif('Solo administrador','err');t='listas';}
  if(t==='usuarios'&&!puedeGestionarUsuariosAutorizados()){notif('No tiene permiso','err');t='listas';}
  if(t==='nuevo'){
    if(cfgEsSoloLectura()){notif('No puede crear trámites en este departamento','err');t='listas';}
    else{
      t='tramites';
      window._openTramNuevoForm=true;
    }
  }
  document.querySelectorAll('.cfg-pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.cfg-tab').forEach(b=>b.classList.remove('on'));
  const pg=document.getElementById('cpg-'+t);
  const tab=document.getElementById('ctab-'+t);
  if(pg)pg.classList.add('on');
  if(tab)tab.classList.add('on');
  if(t==='usuarios'){
    prepararVistaAdminUsuariosAutorizados();
    renderUsuariosCfg(true);
    return;
  }
  if(t==='listas')renderListasCfg();
  if(t==='info-tecnica')renderInfoTecCfg();
  if(t==='tramites'){
    renderTramsCfg();
    if(typeof syncNtColorAuto==='function')syncNtColorAuto();
    if(typeof ntWriteSubclases==='function')ntWriteSubclases(typeof ntReadSubclases==='function'?ntReadSubclases():[]);
    if(window._openTramNuevoForm){
      window._openTramNuevoForm=false;
      if(typeof toggleTramNuevoForm==='function')toggleTramNuevoForm(true);
    }
  }
  if(t==='personas')renderPersonasCfg();
  if(t==='auditoria')renderAuditLogCfg();
  if(t==='papelera'){
    if(typeof puedeUsarPapelera==='function'&&!puedeUsarPapelera()){
      notif('Solo el encargado del departamento puede ver la papelera','err');
      t='listas';
      document.querySelectorAll('.cfg-pg').forEach(p=>p.classList.remove('on'));
      document.querySelectorAll('.cfg-tab').forEach(b=>b.classList.remove('on'));
      document.getElementById('cpg-listas').classList.add('on');
      document.getElementById('ctab-listas').classList.add('on');
      renderListasCfg();
      return;
    }
    if(typeof renderPapeleraCfg==='function')renderPapeleraCfg();
    if(typeof papeleraPurgeExpired==='function')papeleraPurgeExpired({silent:true}).then(function(){
      if(typeof renderPapeleraCfg==='function')renderPapeleraCfg();
    }).catch(function(){});
  }
}
function htmlSubclaseTramiteField(tram,ev){
  const list=(typeof getTramSubclases==='function')?getTramSubclases(tram):(tram&&Array.isArray(tram.subclases)?tram.subclases:[]);
  if(!list.length)return'';
  const lbl=(typeof getTramSubclaseLabel==='function')?getTramSubclaseLabel(tram):(tram.subclaseLabel||'Clase / tipo');
  const cur=String((ev&&ev._subclase)||'').trim();
  return '<div class="fld" style="margin-top:.65rem" id="fld-subclase-wrap"><label>'+escAttr(lbl)+'<span class="req-star">*</span></label>'+
    '<select id="fld__subclase" style="width:100%">'+
    '<option value="">— Seleccione —</option>'+
    list.map(function(s){return '<option value="'+escAttr(s)+'"'+(cur===s?' selected':'')+'>'+escAttr(s)+'</option>';}).join('')+
    '</select>'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:4px">Subsección del tipo de trámite configurada en Configuración → Tipos de trámite.</div></div>';
}
function htmlApoderadoAutorizado(ev){
  const apo=!!ev._apoderado;
  const aut=!!ev._autorizado;
  return '<div id="bloque-apoderado-autorizado" style="margin-top:.6rem">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500"><input type="checkbox" id="fld__apoderado" onchange="toggleApoderado()"'+(apo?' checked':'')+' style="width:15px;height:15px;accent-color:var(--pu)"> Tiene apoderado <span style="font-weight:400;color:var(--tx2)">(abogado)</span></label>'+
    '<div id="apoderado-box" style="margin-top:.5rem;'+(apo?'':'display:none')+'"><div class="slbl" style="margin-bottom:.5rem">Apoderado</div><div class="fg">'+
    '<div class="fld"><label>Nombre del apoderado</label><input type="text" id="fld__apo_nombre" value="'+(ev._apo_nombre||'')+'"'+personSugAttrs('apo','nombre')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__apo_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(ev._apo_identificacion||''):(ev._apo_identificacion||''))+'"'+personSugAttrs('apo','identificacion')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__apo_correo" value="'+(ev._apo_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__apo_telefono" value="'+(ev._apo_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml('apo',ev)+
    '</div></div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-top:.8rem"><input type="checkbox" id="fld__autorizado" onchange="toggleAutorizado()"'+(aut?' checked':'')+' style="width:15px;height:15px;accent-color:var(--bl)"> Tiene autorizado <span style="font-weight:400;color:var(--tx2)">(persona natural)</span></label>'+
    '<div id="autorizado-box" style="margin-top:.5rem;'+(aut?'':'display:none')+'"><div class="slbl" style="margin-bottom:.5rem">Autorizado</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="fld__aut_nombre" value="'+(ev._aut_nombre||'')+'"'+personSugAttrs('aut','nombre')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__aut_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(ev._aut_identificacion||''):(ev._aut_identificacion||''))+'"'+personSugAttrs('aut','identificacion')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__aut_correo" value="'+(ev._aut_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__aut_telefono" value="'+(ev._aut_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml('aut',ev)+
    '</div></div>'+htmlMedioNotificacion(ev)+'</div>';
}
function htmlMedioNotificacion(ev){
  const v=ev._medio_notificacion||'';
  return '<div class="fld" style="margin-top:.85rem"><label>Medio de notificación</label>'+
    '<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px" id="reg-medio-notif-btns">'+htmlMedioNotificacionBtns(v,'reg','setMedioNotificacion')+'</div>'+
    '<input type="hidden" id="fld__medio_notificacion" value="'+escAttr(medioNotificacionNorm(v))+'">'+
    '<div style="font-size:11px;color:var(--tx3);margin-top:4px">Indicador visible en consulta y registro (correo, física, WhatsApp, avisos, otro o no indica).</div></div>';
}

// ================================================================
// SELECTS
// ================================================================
function tramitesParaRegistroDept(){
  return (cfg.tramites||[]).filter(t=>!esTramitePqrs(t.id));
}
function poblarTramSelect(){
  ['r_tramite','freg-tr'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cv=el.value;
    const trams=id==='r_tramite'?tramitesParaRegistroDept():(cfg.tramites||[]).filter(t=>!esTramitePqrs(t.id));
    el.innerHTML=(id==='r_tramite'?'<option value="">— Seleccione el tipo de trámite —</option>':'<option value="">Todos los trámites</option>')+trams.map(t=>'<option value="'+escAttr(t.id)+'">'+escAttr(t.nombre)+'</option>').join('');
    if(cv&&trams.some(t=>t.id===cv))el.value=cv;else if(cv&&id==='r_tramite')el.value='';
  });
}
function tramitesFiltroConsulta(){
  if(esModoOficinaDeguv()||esSecretaria()){
    const trams=(cfgByDepto['guaviare']||cfg).tramites||[];
    const pq=trams.filter(t=>esTramitePqrs(t.id));
    return pq.length?pq:[ensureTramPqrsCfg('guaviare')];
  }
  if(!esJurisdiccional()&&!esModoResponsable())return cfg.tramites||[];
  const map=new Map();
  DEPTOS.forEach(d=>(cfgByDepto[d.id].tramites||[]).forEach(t=>{if(!map.has(t.id))map.set(t.id,t);}));
  return [...map.values()];
}
function poblarFiltrosCon(){
  actualizarConsultaPqrsUI();
  if(esModoOficinaDeguv()||esSecretaria())return;
  const trams=tramitesFiltroConsulta();
  const elT=document.getElementById('q-tram');
  if(elT){const cv=elT.value;elT.innerHTML='<option value="">Todos los trámites</option>'+trams.map(t=>'<option value="'+escAttr(t.id)+'">'+escAttr(t.nombre)+'</option>').join('');if(cv)elT.value=cv;}
  const insts=[...new Set(exps.flatMap(e=>(e.tasks||[]).map(t=>t.responsable)).filter(Boolean))].sort();
  const elI=document.getElementById('q-inst');
  if(elI){
    const cv=elI.value;
    elI.innerHTML='<option value="">Todos los responsables</option>'+insts.map(v=>'<option>'+escAttr(v)+'</option>').join('');
    if(cv)elI.value=cv;
    elI.disabled=false;
  }
}

// ================================================================
// FORMULARIO DINÁMICO
// ================================================================
function onTramiteChange(){
  if(esModoResponsable()){notif('En modo responsable no puede crear ni editar expedientes','err');return;}
  const tid=document.getElementById('r_tramite').value;
  if(!tid){document.getElementById('form-area').innerHTML='<div style="text-align:center;padding:2rem;color:var(--tx3);background:var(--sf);border:1px dashed var(--bd);border-radius:var(--rl)">Seleccione un tipo de trámite</div>';return;}
  renderFormulario(tid,null);
}
function renderFormulario(tid,ed,targetId){
  targetId=targetId||'form-area';
  const panelMode=targetId!=='form-area';
  let t=getTram(tid,ed);
  if(!t&&esTramitePqrs(tid))t=ensureTramPqrsCfg((ed&&ed._depto)||getDeptoOperativo());
  if(!t)return;
  const ev=ed||{};
  // Agrupar campos por sección
  const secs={};
  t.campos.forEach(c=>{if(!secs[c.seccion||'General'])secs[c.seccion||'General']=[];secs[c.seccion||'General'].push(c);});
  let camposHtml='';
  let detalleProcesoHtml='';
  Object.entries(secs).forEach(([sec,campos])=>{
    if(esSecSolicitante(sec)||esSecInfoTecnica(sec))return;
    const buildCampo=function(c){
      const elId='fld_'+c.id;
      const val=ev['f_'+c.id]||'';
      const opc=c.tipo==='lista'?getListaOpts(c.listaFuente||[]):c.opciones;
      const esLink=/link|enlace|drive|documento|url/i.test(String(c.label||'')+(c.placeholder||''));
      if(esLink&&(!c.tipo||c.tipo==='texto'||c.tipo==='area'))
        return '<div class="fld"><label>'+c.label+(c.requerido?'<span class="req-star">*</span>':'')+'</label><input type="url" id="'+elId+'" value="'+escAttr(val)+'" placeholder="https://drive.google.com/file/d/…"></div>';
      const inp=TIPOS[c.tipo]?TIPOS[c.tipo].r(elId,c.placeholder||c.label,val,opc):'<input type="text" id="'+elId+'" value="'+escAttr(val)+'">';
      return '<div class="fld"><label>'+c.label+(c.requerido?'<span class="req-star">*</span>':'')+'</label>'+inp+'</div>';
    };
    const fh=campos.map(buildCampo).join('');
    if(esSecDetalleProceso(sec)){
      detalleProcesoHtml+='<details class="form-section"><summary class="form-section-hdr">'+sec+'</summary><div class="form-section-body">'+
        '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Registre enlaces Google Drive de documentos del trámite. Aparecerán en <strong>Documentos / archivos</strong> al consultar el expediente.</div>'+
        '<div class="fg">'+fh+'</div>'+btnGuardarSeccion()+'</div></details>';
      return;
    }
    camposHtml+='<details class="form-section"><summary class="form-section-hdr">'+sec+'</summary><div class="form-section-body"><div class="fg">'+fh+'</div>'+btnGuardarSeccion()+'</div></details>';
  });
  migrarInfoTecExpediente(ev);
  const inclConceptosInfoTec=!esModoResponsable()&&!esModoContratista()||typeof responsablePuedeEditarSec==='function'&&responsablePuedeEditarSec('info_tec');
  const inclConceptosSeg=!inclConceptosInfoTec&&(!esModoResponsable()&&!esModoContratista()||typeof responsablePuedeEditarSec==='function'&&responsablePuedeEditarSec('seguimiento'));
  const infoTecExpSection=infoTecnicaExpHtml(ev,{includeConceptos:inclConceptosInfoTec});
  const estadoActual=isArchivadoEstado(ev._estado)?'Archivado o anulado':(ev._estado||'Solicitud');
  const estOpts=ESTADOS.map(v=>'<option'+(estadoActual===v?' selected':'')+'>'+v+'</option>').join('');
  const ter=ed?calcTerminos(ed):null;
  const terHtml=ter?('<div style="margin-top:.5rem">'+termsBdg(ter)+'</div>'+termsBar(ter)):'';
  const fechasEv=getFechasEstado(ev);
  const fechaEstadoVal=fechasEv[estadoActual]||fechasEv.Solicitud||ev._fecha||'';
  // Evitar banner duplicado: en panel/ventana de consulta ya se muestra una sola vez arriba (consulta.js)
  const skipAltaBanner=panelMode;
  const ctrlHtml=((!skipAltaBanner&&typeof renderAltaResponsableBannerHtml==='function')?renderAltaResponsableBannerHtml(ev,{expId:ev._exp||'',showDone:true}):'')+
    '<details class="form-section" id="sec-control"><summary class="form-section-hdr" style="background:var(--bll);border-bottom-color:var(--bl);color:var(--bld)">Control del trámite</summary><div class="form-section-body">'+
    fechasEstadoStoreHtml(ev)+
    '<input type="hidden" id="fld__fecha" value="'+(fechasEv.Solicitud||ev._fecha||'')+'">'+
    '<div class="fg ctrl-top-row">'+
    '<div class="fld"><label>N° Expediente<span class="req-star">*</span></label><input type="text" id="fld__exp" value="'+(ev._exp||'')+'" placeholder="EXP-2026-001"></div>'+
    '<div class="fld"><label>Estado del trámite</label><select id="fld__estado" onchange="onEstadoChange()">'+estOpts+'</select></div>'+
    '<div class="fld"><label id="lbl-fecha-estado">Fecha del estado</label><input type="date" id="fld__fecha_estado" value="'+fechaEstadoVal+'" onchange="onFechaEstadoVisibleChange()"></div>'+
    '</div>'+
    htmlSubclaseTramiteField(t,ev)+
    '<div style="font-size:11px;color:var(--tx2);margin-top:4px">La fecha de Solicitud es la radicación. Al cambiar de estado, registre la fecha en el calendario al lado.</div>'+terHtml+
    expedientesAsociadosHtml(ev)+
    '<input type="hidden" id="fld__expedientes_asociados" value=\''+escAttr(ev._expedientes_asociados||'[]')+'\'>'+
    btnGuardarSeccion()+'</div></details>';
  const segHtml=seguimientoHtml({...ev,_estado:estadoActual},{includeConceptos:inclConceptosSeg});
  const normativaSection=normativaHtml(ev);
  const tipoPersona=ev._tipo_persona||'natural';
  const esPqrs=esTramitePqrs(tid);
  const esSanc=esTramiteSancionatorio(tid);
  const esCaso=esPqrs||esSanc;
  const tipoSol=ev._tipo_solicitud||'PQRS';
  const tipoSanc=ev._tipo_sancionatorio||((cfg.tiposSancionatorio||[])[0]||'Deforestación');
  const qdAnon=!!ev._qd_anonimo;
  const esQuejaDen=esPqrs&&(tipoSol==='Queja'||tipoSol==='Denuncia');
  const personaHtml='<details class="form-section" id="sec-persona"><summary class="form-section-hdr">Datos del interesado</summary><div class="form-section-body">'+
    '<div id="pqrs-tipo-box" style="'+(esPqrs?'':'display:none')+';margin-bottom:.7rem"><div class="fld"><label>Tipo de solicitud</label><select id="fld__tipo_solicitud" onchange="toggleCasoEspecialMode()">'+
    ['PQRS','Petición','Queja','Denuncia','Reclamo','Sugerencia','Reunión','Audiencia'].map(t=>'<option'+(tipoSol===t?' selected':'')+'>'+t+'</option>').join('')+
    '</select></div></div>'+
    '<div id="sanc-tipo-box" style="'+(esSanc?'':'display:none')+';margin-bottom:.7rem"><div class="fld"><label>Tipo de conducta / caso</label><select id="fld__tipo_sancionatorio" onchange="toggleCasoEspecialMode()">'+
    (cfg.tiposSancionatorio||['Deforestación']).map(t=>'<option'+(tipoSanc===t?' selected':'')+'>'+t+'</option>').join('')+
    '</select></div></div>'+
    '<div id="bloque-interesado" style="'+(esCaso?'display:none':'')+'">'+
    '<div class="fg">'+
    '<div class="fld"><label>Tipo de persona</label><select id="fld__tipo_persona" onchange="togglePersona()"><option value="natural"'+(tipoPersona==='natural'?' selected':'')+'>Persona natural</option><option value="juridica"'+(tipoPersona==='juridica'?' selected':'')+'>Persona jurídica</option></select></div>'+
    '</div>'+
    '<div id="persona-natural" style="'+(tipoPersona==='juridica'?'display:none':'')+'">'+
    '<div class="slbl" style="margin:.5rem 0">Persona natural</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="fld__pn_nombre" value="'+(ev._pn_nombre||'')+'"'+personSugAttrs('pn','nombre')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__pn_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(ev._pn_identificacion||''):(ev._pn_identificacion||''))+'"'+personSugAttrs('pn','identificacion')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__pn_correo" value="'+(ev._pn_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__pn_telefono" value="'+(ev._pn_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml('pn',ev)+
    '</div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-top:.6rem"><input type="checkbox" id="fld__est_com" onchange="toggleEstCom()"'+(ev._est_com?' checked':'')+' style="width:15px;height:15px;accent-color:var(--bl)"> Tiene establecimiento comercial</label>'+
    '<div id="est-comercial" style="margin-top:.5rem;'+(ev._est_com?'':'display:none')+'"><div class="slbl" style="margin-bottom:.5rem">Establecimiento comercial</div><div class="fg">'+
    '<div class="fld"><label>Nombre del negocio</label><input type="text" id="fld__ec_nombre" value="'+(ev._ec_nombre||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__ec_telefono" value="'+(ev._ec_telefono||'')+'"'+numAttrs()+'></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__ec_correo" value="'+(ev._ec_correo||'')+'" placeholder="correo@negocio.com"></div>'+
    dirHtml('ec',ev)+
    '</div></div></div>'+
    '<div id="persona-juridica" style="'+(tipoPersona==='juridica'?'':'display:none')+'">'+
    '<div class="slbl" style="margin:.5rem 0">Representante legal</div><div class="fg">'+
    '<div class="fld"><label>Nombre representante legal</label><input type="text" id="fld__pj_rep_nombre" value="'+(ev._pj_rep_nombre||'')+'"'+personSugAttrs('pj','rep_nombre')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación representante</label><input type="text" id="fld__pj_rep_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(ev._pj_rep_identificacion||''):(ev._pj_rep_identificacion||''))+'"'+personSugAttrs('pj','rep_identificacion')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__pj_rep_correo" value="'+(ev._pj_rep_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__pj_rep_telefono" value="'+(ev._pj_rep_telefono||'')+'"'+numAttrs()+'></div>'+
    '</div><div class="slbl" style="margin:.5rem 0">Empresa</div><div class="fg">'+
    '<div class="fld"><label>Nombre de la empresa</label><input type="text" id="fld__pj_empresa" value="'+(ev._pj_empresa||'')+'"'+personSugAttrs('pj','empresa')+' placeholder="Buscar por razón social…"></div>'+
    '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField('fld__pj_nit',{value:ev._pj_nit||'',sugTarget:'pj',placeholder:'Buscar por NIT…'}):('<input type="text" id="fld__pj_nit" value="'+(ev._pj_nit||'')+'"'+personSugAttrs('pj','nit')+' placeholder="Buscar por NIT…">'))+'</div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__pj_correo" value="'+(ev._pj_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__pj_telefono" value="'+(ev._pj_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml('pj',ev)+
    '</div></div>'+
    '</div>'+
    '<div id="bloque-queja" style="'+(esCaso?'':'display:none')+'">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;font-weight:500;margin-bottom:.6rem"><input type="checkbox" id="fld__qd_anonimo" onchange="toggleQuejaAnonimo()"'+(qdAnon?' checked':'')+' style="width:15px;height:15px;accent-color:var(--pu)"> Actúa como anónimo</label>'+
    '<div id="queja-identificado" style="'+(qdAnon?'display:none':'')+'">'+
    '<div class="slbl" id="lbl-solicitante-pqrs">'+(esQuejaDen?'Quejoso / denunciante':'Peticionario / solicitante')+'</div><div class="fg">'+
    '<div class="fld"><label id="lbl-qd-nombre">Nombre</label><input type="text" id="fld__qd_nombre" value="'+(ev._qd_nombre||'')+'"'+personSugAttrs('qd','nombre')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__qd_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(ev._qd_identificacion||''):(ev._qd_identificacion||''))+'"'+personSugAttrs('qd','identificacion')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__qd_correo" value="'+(ev._qd_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__qd_telefono" value="'+(ev._qd_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml('qd',ev)+
    '</div></div>'+
    htmlInfractoresBlock(ev,{esSanc:esSanc,esQuejaDen:esQuejaDen})+
    '</div>'+
    htmlApoderadoAutorizado(ev)+
    btnGuardarSeccion()+
    '</div></details>';
  const detalleHtml=(function(){
    migrarDetalleNotas(ev);
    const notas=detalleNotasData(ev._detalle_notas);
    return '<details class="form-section" id="sec-detalle"><summary class="form-section-hdr">Detalles / descripción</summary><div class="form-section-body">'+
      '<input type="hidden" id="fld__detalle_notas" value=\''+escAttr(typeof ev._detalle_notas==='string'?ev._detalle_notas:JSON.stringify(notas))+'\'>'+
      '<div id="detalle-notas-list">'+detalleNotasListHtml(notas)+'</div>'+
      '<div class="fld" style="margin-top:.65rem"><label>Añadir comentario</label><textarea id="fld__detalle_nuevo" style="min-height:70px" placeholder="Nuevo comentario sobre el trámite"></textarea></div>'+
      '<button type="button" class="btn bsm" onclick="addDetalleNota()">+ Añadir comentario</button>'+
      btnGuardarSeccion()+'</div></details>';
  })();
  const contableSection=contableHtml(ev);
  const actHtml='<details class="form-section"><summary class="form-section-hdr">Actividades asignadas</summary><div class="form-section-body form-section-body-act">'+
    '<datalist id="acts-pred-list">'+(cfg.actividadesPred||[]).map(a=>'<option value="'+a+'"></option>').join('')+'</datalist>'+
    '<div class="tk-act-grid-hdr">'+
    '<span>Actividad</span><span>Detalles</span><span>Responsable</span><span>Días</span><span>Vence</span><span>F. cierre</span><span>Estado</span><span></span></div>'+
    '<div class="tk-cont"></div>'+
    '<div class="fx" style="gap:5px;margin-top:5px">'+
    '<button class="btn bsm" onclick="addTask()">+ Actividad</button>'+
    '</div>'+btnGuardarSeccion()+'</div></details>';
  const formFooter=panelMode
    ?'<div class="ar"><button type="button" class="btn bp" onclick="guardarExpDesdePanel()">💾 '+(editId?'Actualizar expediente':'Guardar')+'</button></div>'
    :'<div class="ar"><button class="btn" onclick="limpiarForm()">Cancelar</button><button class="btn bp" onclick="guardarExp()">💾 '+(editId?'Actualizar':'Guardar')+'</button></div>';
  const formHost=document.getElementById(targetId);
  if(!formHost)return;
  formHost.innerHTML=
    '<div class="slbl" style="margin-bottom:.6rem">'+(editId?'Editando: '+editId:'Nuevo — '+t.nombre)+(panelMode?' <span style="font-size:11px;font-weight:400;color:var(--tx3)">— '+uiEditorContenedorLbl()+'</span>':'')+'</div>'+
    regSecHtml('control',ctrlHtml)+regSecHtml('persona',personaHtml)+regSecHtml('detalle',detalleHtml)+regSecHtml('contable',contableSection)+regSecHtml('info_tec',infoTecExpSection)+regSecHtml('normativa',normativaSection)+regSecHtml('campos',detalleProcesoHtml+camposHtml)+regSecHtml('seguimiento',segHtml)+regSecHtml('actividades',actHtml)+
    formFooter;
  tkSeq=0;(ev.tasks||[]).forEach(tk=>addTask(tk));
  syncFechaEstadoVisible();
  if(!editId){
    const vis=document.getElementById('fld__fecha_estado');
    if(vis&&!vis.value)vis.value=hoy();
    persistFechaEstadoVisible();
  }
  toggleCasoEspecialMode();
  syncSeguimientoUi();
}
function onEstadoChange(){
  persistFechaEstadoVisible();
  syncFechaEstadoVisible();
  syncSeguimientoUi();
  onContableChange();
}
function toggleCasoEspecialMode(){
  let tid=document.getElementById('r_tramite')?document.getElementById('r_tramite').value:'';
  if(!tid&&editId){const ex=exps.find(x=>x._exp===editId);if(ex)tid=ex._tramite||'';}
  const esP=esTramitePqrs(tid);
  const esS=esTramiteSancionatorio(tid);
  const es=esP||esS;
  const bi=document.getElementById('bloque-interesado');
  const bq=document.getElementById('bloque-queja');
  const tb=document.getElementById('pqrs-tipo-box');
  const ts=document.getElementById('sanc-tipo-box');
  if(bi)bi.style.display=es?'none':'';
  if(bq)bq.style.display=es?'':'none';
  if(tb)tb.style.display=esP?'':'none';
  if(ts)ts.style.display=esS?'':'none';
  const tipo=document.getElementById('fld__tipo_solicitud')?document.getElementById('fld__tipo_solicitud').value:'PQRS';
  const esQD=esP&&(tipo==='Queja'||tipo==='Denuncia');
  const ls=document.getElementById('lbl-solicitante-pqrs');
  if(ls)ls.textContent=esQD||esS?'Quejoso / denunciante':'Peticionario / solicitante';
  const bit=document.getElementById('bloque-infractor-tit');
  if(bit)bit.textContent=(esS?'Presuntos infractores':('Presunto infractor'+(esQD?'':' (opcional)')));
  const addBtn=document.getElementById('btn-add-infractor');
  if(addBtn){
    addBtn.style.display=esS?'':'none';
    if(esS)addBtn.removeAttribute('hidden');else addBtn.setAttribute('hidden','');
  }
  if(es)toggleQuejaAnonimo();
  toggleInfractor();
}
function togglePqrsMode(){toggleCasoEspecialMode();}
function toggleQueja(){toggleCasoEspecialMode();}
function toggleQuejaAnonimo(){
  const anon=document.getElementById('fld__qd_anonimo')&&document.getElementById('fld__qd_anonimo').checked;
  const qi=document.getElementById('queja-identificado');
  if(qi)qi.style.display=anon?'none':'';
}
function parsePresuntosInfractores(ev){
  ev=ev||{};
  let arr=[];
  try{
    if(typeof ev._presuntos_infractores==='string'&&ev._presuntos_infractores.trim())
      arr=JSON.parse(ev._presuntos_infractores);
    else if(Array.isArray(ev._presuntos_infractores))arr=ev._presuntos_infractores.slice();
  }catch(err){arr=[];}
  if(!Array.isArray(arr))arr=[];
  arr=arr.filter(function(x){return x&&typeof x==='object';});
  if(!arr.length&&(ev._pi_nombre||ev._pi_empresa||ev._pi_identificacion||ev._pi_nit||ev._pi_rep_nombre||ev._pi_tipo_persona)){
    const one={_pi_tipo_persona:ev._pi_tipo_persona||'natural'};
    ['_pi_nombre','_pi_identificacion','_pi_correo','_pi_telefono','_pi_rep_nombre','_pi_rep_identificacion','_pi_rep_correo','_pi_rep_telefono','_pi_empresa','_pi_nit','_pi_correo_emp','_pi_telefono_emp'].forEach(function(k){one[k]=ev[k]||'';});
    ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
      one['_pi_'+k]=ev['_pi_'+k]||'';
      one['_pi_emp_'+k]=ev['_pi_emp_'+k]||'';
    });
    arr=[one];
  }
  if(!arr.length)arr=[{_pi_tipo_persona:'natural'}];
  return arr;
}
function infractorFieldBase(idx){return idx===0?'pi':('pi'+idx);}
function infractorEmpBase(idx){return idx===0?'pi_emp':('pi'+idx+'_emp');}
function htmlInfractorCard(idx,pi){
  pi=pi||{};
  const tipo=pi._pi_tipo_persona||'natural';
  const base=infractorFieldBase(idx);
  const baseEmp=infractorEmpBase(idx);
  const dirEv={};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
    dirEv['_'+base+'_'+k]=pi['_pi_'+k]||'';
    dirEv['_'+baseEmp+'_'+k]=pi['_pi_emp_'+k]||'';
  });
  const sug=idx===0;
  return '<div class="infractor-card" data-inf-idx="'+idx+'" style="margin-top:10px;padding:10px;border:1px dashed var(--bd);border-radius:var(--r);background:var(--sf2)">'+
    '<div class="fx" style="justify-content:space-between;align-items:center;margin-bottom:6px">'+
      '<div class="slbl" style="margin:0;font-size:11px">Presunto infractor '+(idx+1)+'</div>'+
      (idx>0?'<button type="button" class="btn bsm bd2" onclick="quitarInfractorCard('+idx+')">Quitar</button>':'')+
    '</div>'+
    '<div class="fg"><div class="fld"><label>Tipo de persona</label><select id="fld__'+base+'_tipo_persona" onchange="toggleInfractor('+idx+')"><option value="natural"'+(tipo==='natural'?' selected':'')+'>Persona natural</option><option value="juridica"'+(tipo==='juridica'?' selected':'')+'>Persona jurídica</option></select></div></div>'+
    '<div id="infractor-natural-'+idx+'" style="'+(tipo==='juridica'?'display:none':'')+'"><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="fld__'+base+'_nombre" value="'+escAttr(pi._pi_nombre||'')+'"'+(sug?personSugAttrs('pi','nombre'):'')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__'+base+'_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(pi._pi_identificacion||''):(pi._pi_identificacion||''))+'"'+(sug?personSugAttrs('pi','identificacion'):'')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__'+base+'_correo" value="'+escAttr(pi._pi_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__'+base+'_telefono" value="'+escAttr(pi._pi_telefono||'')+'"'+numAttrs()+'></div>'+
    dirHtml(base,dirEv)+
    '</div></div>'+
    '<div id="infractor-juridica-'+idx+'" style="'+(tipo==='juridica'?'':'display:none')+'">'+
    '<div class="slbl" style="margin:.4rem 0">Representante legal</div><div class="fg">'+
    '<div class="fld"><label>Nombre representante</label><input type="text" id="fld__'+base+'_rep_nombre" value="'+escAttr(pi._pi_rep_nombre||'')+'"'+(sug?personSugAttrs('pi','rep_nombre'):'')+' placeholder="Buscar por nombre…"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="fld__'+base+'_rep_identificacion" value="'+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(pi._pi_rep_identificacion||''):(pi._pi_rep_identificacion||''))+'"'+(sug?personSugAttrs('pi','rep_identificacion'):'')+' placeholder="Buscar por identificación…"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="fld__'+base+'_rep_correo" value="'+escAttr(pi._pi_rep_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="fld__'+base+'_rep_telefono" value="'+escAttr(pi._pi_rep_telefono||'')+'"'+numAttrs()+'></div>'+
    '</div><div class="slbl" style="margin:.4rem 0">Empresa / entidad</div><div class="fg">'+
    '<div class="fld"><label>Nombre o razón social</label><input type="text" id="fld__'+base+'_empresa" value="'+escAttr(pi._pi_empresa||'')+'"'+(sug?personSugAttrs('pi','empresa'):'')+' placeholder="Buscar por razón social…"></div>'+
    '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField('fld__'+base+'_nit',{value:pi._pi_nit||'',sugTarget:sug?'pi':'',placeholder:'Buscar por NIT…'}):('<input type="text" id="fld__'+base+'_nit" value="'+escAttr(pi._pi_nit||'')+'"'+(sug?personSugAttrs('pi','nit'):'')+' placeholder="Buscar por NIT…">'))+'</div>'+
    '<div class="fld"><label>Correo empresa</label><input type="email" id="fld__'+base+'_correo_emp" value="'+escAttr(pi._pi_correo_emp||'')+'"></div>'+
    '<div class="fld"><label>Teléfono empresa</label><input type="tel" id="fld__'+base+'_telefono_emp" value="'+escAttr(pi._pi_telefono_emp||'')+'"'+numAttrs()+'></div>'+
    dirHtml(baseEmp,dirEv)+
    '</div></div></div>';
}
function htmlInfractoresBlock(ev,opts){
  opts=opts||{};
  const arr=parsePresuntosInfractores(ev);
  const showAdd=!!opts.esSanc;
  const tit=showAdd?'Presuntos infractores':('Presunto infractor'+(opts.esQuejaDen?'':' (opcional)'));
  return '<div id="bloque-infractores-wrap">'+
    '<div class="fx" style="justify-content:space-between;align-items:center;gap:8px;margin-top:.8rem;flex-wrap:wrap">'+
    '<div class="slbl" style="margin:0" id="bloque-infractor-tit">'+tit+'</div>'+
    '<button type="button" class="btn bsm bp" id="btn-add-infractor" onclick="addInfractorCard()" '+(showAdd?'':'hidden ')+'style="'+(showAdd?'':'display:none')+'">+ Añadir infractor</button>'+
    '</div>'+
    '<div id="infractores-list">'+arr.map(function(pi,i){return htmlInfractorCard(i,pi);}).join('')+'</div></div>';
}
function collectPresuntosInfractores(){
  const cards=document.querySelectorAll('#infractores-list .infractor-card');
  if(!cards.length){
    const tipo=gv('fld__pi_tipo_persona')||'natural';
    const row={_pi_tipo_persona:tipo};
    if(tipo==='juridica'){
      Object.assign(row,{
        _pi_rep_nombre:gv('fld__pi_rep_nombre'),_pi_rep_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(gv('fld__pi_rep_identificacion')):gv('fld__pi_rep_identificacion'),
        _pi_rep_correo:gv('fld__pi_rep_correo'),_pi_rep_telefono:gv('fld__pi_rep_telefono'),
        _pi_empresa:gv('fld__pi_empresa'),_pi_nit:typeof formatNitDisplay==='function'?formatNitDisplay(gv('fld__pi_nit')):gv('fld__pi_nit'),
        _pi_correo_emp:gv('fld__pi_correo_emp'),_pi_telefono_emp:gv('fld__pi_telefono_emp')
      },getDir('pi_emp'));
    }else{
      Object.assign(row,{
        _pi_nombre:gv('fld__pi_nombre'),_pi_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(gv('fld__pi_identificacion')):gv('fld__pi_identificacion'),
        _pi_correo:gv('fld__pi_correo'),_pi_telefono:gv('fld__pi_telefono')
      },getDir('pi'));
    }
    return [row];
  }
  const out=[];
  cards.forEach(function(card){
    const idx=Number(card.getAttribute('data-inf-idx')||0);
    const base=infractorFieldBase(idx);
    const baseEmp=infractorEmpBase(idx);
    const tipo=gv('fld__'+base+'_tipo_persona')||'natural';
    const row={_pi_tipo_persona:tipo};
    if(tipo==='juridica'){
      Object.assign(row,{
        _pi_rep_nombre:gv('fld__'+base+'_rep_nombre'),_pi_rep_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(gv('fld__'+base+'_rep_identificacion')):gv('fld__'+base+'_rep_identificacion'),
        _pi_rep_correo:gv('fld__'+base+'_rep_correo'),_pi_rep_telefono:gv('fld__'+base+'_rep_telefono'),
        _pi_empresa:gv('fld__'+base+'_empresa'),_pi_nit:typeof formatNitDisplay==='function'?formatNitDisplay(gv('fld__'+base+'_nit')):gv('fld__'+base+'_nit'),
        _pi_correo_emp:gv('fld__'+base+'_correo_emp'),_pi_telefono_emp:gv('fld__'+base+'_telefono_emp')
      },getDir(baseEmp));
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
        row['_pi_emp_'+k]=row['_'+baseEmp+'_'+k]||'';
        if(baseEmp!=='pi_emp')delete row['_'+baseEmp+'_'+k];
      });
    }else{
      Object.assign(row,{
        _pi_nombre:gv('fld__'+base+'_nombre'),_pi_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(gv('fld__'+base+'_identificacion')):gv('fld__'+base+'_identificacion'),
        _pi_correo:gv('fld__'+base+'_correo'),_pi_telefono:gv('fld__'+base+'_telefono')
      },getDir(base));
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
        row['_pi_'+k]=row['_'+base+'_'+k]||'';
        if(base!=='pi')delete row['_'+base+'_'+k];
      });
    }
    const has=tipo==='juridica'?(row._pi_empresa||row._pi_nit||row._pi_rep_nombre):(row._pi_nombre||row._pi_identificacion);
    if(has||idx===0)out.push(row);
  });
  return out.length?out:[{_pi_tipo_persona:'natural'}];
}
function addInfractorCard(){
  const list=document.getElementById('infractores-list');
  if(!list)return;
  const n=list.querySelectorAll('.infractor-card').length;
  list.insertAdjacentHTML('beforeend',htmlInfractorCard(n,{}));
  toggleInfractor(n);
}
function quitarInfractorCard(idx){
  const card=document.querySelector('#infractores-list .infractor-card[data-inf-idx="'+idx+'"]');
  if(card)card.remove();
  const datos=collectPresuntosInfractores();
  const list=document.getElementById('infractores-list');
  if(!list)return;
  if(!datos.length)datos.push({_pi_tipo_persona:'natural'});
  list.innerHTML=datos.map(function(pi,i){return htmlInfractorCard(i,pi);}).join('');
  toggleInfractor();
}
function toggleInfractor(idx){
  if(idx==null||idx===''){
    document.querySelectorAll('#infractores-list .infractor-card').forEach(function(c){
      toggleInfractor(Number(c.getAttribute('data-inf-idx')||0));
    });
    // legacy ids
    const v=gv('fld__pi_tipo_persona');
    const pn=document.getElementById('infractor-natural');
    const pj=document.getElementById('infractor-juridica');
    if(pn)pn.style.display=v==='juridica'?'none':'';
    if(pj)pj.style.display=v==='juridica'?'':'none';
    return;
  }
  const base=infractorFieldBase(idx);
  const v=gv('fld__'+base+'_tipo_persona');
  const pn=document.getElementById('infractor-natural-'+idx);
  const pj=document.getElementById('infractor-juridica-'+idx);
  if(pn)pn.style.display=v==='juridica'?'none':'';
  if(pj)pj.style.display=v==='juridica'?'':'none';
}
window.parsePresuntosInfractores=parsePresuntosInfractores;
window.collectPresuntosInfractores=collectPresuntosInfractores;
window.addInfractorCard=addInfractorCard;
window.quitarInfractorCard=quitarInfractorCard;
window.toggleInfractor=toggleInfractor;
function updMun(prefix){
  const dep=gv('fld__'+prefix+'_dep')||nombreDeptoOperativo();
  const mun=document.getElementById('fld__'+prefix+'_mun');
  if(mun)mun.innerHTML=munOpts(dep,'');
}
function togglePersona(){
  const v=gv('fld__tipo_persona');
  const pn=document.getElementById('persona-natural');
  const pj=document.getElementById('persona-juridica');
  if(pn)pn.style.display=v==='juridica'?'none':'';
  if(pj)pj.style.display=v==='juridica'?'':'none';
}
function toggleEstCom(){const b=document.getElementById('est-comercial');if(b)b.style.display=document.getElementById('fld__est_com').checked?'':'none';}
function toggleApoderado(){const b=document.getElementById('apoderado-box');if(b)b.style.display=document.getElementById('fld__apoderado').checked?'':'none';}
function toggleAutorizado(){const b=document.getElementById('autorizado-box');if(b)b.style.display=document.getElementById('fld__autorizado').checked?'':'none';}
function toggleSancionatorio(){const b=document.getElementById('sancionatorio-box');if(b)b.style.display=document.getElementById('fld__sancionatorio').checked?'':'none';}
function toggleEtapaTramite(){const b=document.getElementById('etapa-box');if(b)b.style.display=document.getElementById('fld__usar_etapa').checked?'':'none';}
function onContableChange(){
  document.querySelectorAll('#facturas-extra .factura-extra').forEach(updateFacturaCobro);
  syncFacturasExtra();
}
function updateFacturaCobro(row){
  if(!row)return;
  const venc=row.querySelector('.fx-venc')?row.querySelector('.fx-venc').value:'';
  const pago=row.querySelector('.fx-pago')?row.querySelector('.fx-pago').value:'';
  const pers=row.querySelector('.fx-pers-venc')?row.querySelector('.fx-pers-venc').value:'';
  const enMora=!!(venc&&venc<hoy()&&!pago);
  const cobro=row.querySelector('.factura-cobro');
  const acuerdo=row.querySelector('.factura-acuerdo');
  const coac=row.querySelector('.factura-coactivo');
  const acuChk=row.querySelector('.fx-acuerdo');
  const showAcuerdo=enMora||(acuChk&&acuChk.checked);
  if(cobro)cobro.style.display=enMora?'':'none';
  if(acuerdo)acuerdo.style.display=showAcuerdo?'':'none';
  if(coac)coac.style.display=enMora&&pers&&pers<hoy()?'':'none';
}
function syncFacturasExtra(){
  const rows=Array.from(document.querySelectorAll('#facturas-extra .factura-extra'));
  const arr=rows.map(r=>({
    tipo:r.querySelector('.fx-tipo').value,
    valor:moneyRaw(r.querySelector('.fx-valor').value),
    ref:r.querySelector('.fx-ref').value,
    venc:r.querySelector('.fx-venc').value,
    pago:r.querySelector('.fx-pago').value,
    persVenc:r.querySelector('.fx-pers-venc')?r.querySelector('.fx-pers-venc').value:'',
    coacFecha:r.querySelector('.fx-coac-fecha')?r.querySelector('.fx-coac-fecha').value:'',
    acuerdoPago:!!(r.querySelector('.fx-acuerdo')&&r.querySelector('.fx-acuerdo').checked),
    acuerdoDia:!!(r.querySelector('.fx-acuerdo-dia')&&r.querySelector('.fx-acuerdo-dia').checked),
    acuerdoNumCuotas:r.querySelector('.fx-acu-num')?r.querySelector('.fx-acu-num').value:'',
    acuerdoInicio:r.querySelector('.fx-acu-inicio')?r.querySelector('.fx-acu-inicio').value:'',
    acuerdoCuotas:readAcuerdoCuotasFromRow(r)
  }));
  const hid=document.getElementById('fld__facturas_extra');if(hid)hid.value=JSON.stringify(arr);
}
function addFacturaExtra(){const c=document.getElementById('facturas-extra');c.insertAdjacentHTML('beforeend',facturaRowHtml({tipo:''},c.children.length));syncFacturasExtra();}
function delFacturaExtra(btn){
  confirmEliminar({message:'¿Eliminar esta factura del expediente?'},()=>{
    btn.closest('.factura-extra').remove();syncFacturasExtra();onContableChange();
  });
}
function collectContable(){
  syncFacturasExtra();
  const extras=facturasData(gv('fld__facturas_extra'));
  return {
    _facturas_extra:gv('fld__facturas_extra'),
    _acuerdo_pago:extras.some(f=>f.acuerdoPago),
    _acuerdo_dia:extras.some(f=>f.acuerdoPago&&f.acuerdoDia),
    _acuerdo_solicitud:'',_acuerdo_notificacion:'',_acuerdo_corte:'',
    _fac_sol_eval:'',_fac_sol_eval_ref:'',_fac_sol_pub:'',_fac_sol_pub_ref:'',_fac_sol_venc:'',_fac_sol_pago:'',
    _fac_tra_enabled:false,_fac_tra_res:'',_fac_tra_res_ref:'',_fac_tra_pub:'',_fac_tra_pub_ref:'',_fac_tra_venc:'',_fac_tra_pago:'',
    _persuasivo_fecha:'',_persuasivo_venc:'',_coactivo_traslado:'',_enviar_coactivo:false
  };
}
function migrarAcuerdoGlobal(ev){
  if(!ev._acuerdo_pago)return;
  const extras=facturasData(ev._facturas_extra);
  let changed=false;
  extras.forEach(f=>{
    if(f.venc&&f.venc<hoy()&&!f.pago&&!f.acuerdoPago){
      f.acuerdoPago=true;
      f.acuerdoDia=!!(ev._acuerdo_dia||ev._acuerdo_cumplido);
      changed=true;
    }
  });
  if(changed)ev._facturas_extra=JSON.stringify(extras);
}
// ================================================================