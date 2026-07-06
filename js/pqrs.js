// =============================================================================
// pqrs.js — MODULO SECRETARIA / PQRS
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// GRÁFICAS CONSOLIDADO (panel lateral)
// ================================================================
window._consChartActive=null;
function consDrawBarChart(canvasId,entries,palette){
  const cv=document.getElementById(canvasId);
  if(!cv||!entries.length)return;
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(...entries.map(x=>Number(x[1])||0),1);
  const barW=Math.max(18,Math.min(48,(W-40)/entries.length-8));
  const base=H-36;
  entries.forEach(([lbl,v],i)=>{
    const h=Math.round((Number(v)||0)/max*(H-58));
    const x=20+i*(barW+10);
    ctx.fillStyle=(palette||PAL)[i%(palette||PAL).length];
    ctx.fillRect(x,base-h,barW,h);
    ctx.fillStyle='#333';
    ctx.font='11px DM Sans,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(String(v),x+barW/2,base-h-4);
    const short=String(lbl).length>10?String(lbl).slice(0,9)+'…':String(lbl);
    ctx.save();ctx.translate(x+barW/2,base+14);ctx.rotate(-0.45);
    ctx.fillText(short,0,0);ctx.restore();
  });
}
function openConsChartPanel(key){
  const ch=(window._consCharts||{})[key];
  if(!ch||!ch.entries||!ch.entries.length){notif('Sin datos para graficar en este corte','err');return;}
  window._consChartActive=key;
  const titEl=document.getElementById('cons-chart-tit');
  const subEl=document.getElementById('cons-chart-sub');
  if(titEl)titEl.textContent=ch.title||'Gráfica';
  if(subEl){
    const pr=labelPeriodo('cons');
    subEl.textContent=(pr||'Todo el historial')+' · '+(window._consExportList||[]).length+' expediente(s)';
  }
  const cid='cons-chart-cv';
  document.getElementById('cons-chart-body').innerHTML='<div class="cons-chart-wrap"><canvas id="'+cid+'" class="cons-canvas-chart" width="480" height="300"></canvas></div>';
  document.getElementById('cons-chart-overlay').classList.add('on');
  document.getElementById('cons-chart-panel').classList.add('on');
  setTimeout(()=>consDrawBarChart(cid,ch.entries,ch.palette||PAL),30);
}
function cerrarConsChartPanel(){
  const ov=document.getElementById('cons-chart-overlay');
  const panel=document.getElementById('cons-chart-panel');
  if(ov)ov.classList.remove('on');
  if(panel)panel.classList.remove('on');
  window._consChartActive=null;
}
function descargarConsChart(){
  const cv=document.querySelector('#cons-chart-body canvas');
  if(!cv){notif('No hay gráfica para descargar','err');return;}
  const ch=(window._consCharts||{})[window._consChartActive]||{};
  const name=String(ch.title||'grafica-consolidado').replace(/[^\w\s\-áéíóúÁÉÍÓÚñÑ]/g,'').trim().replace(/\s+/g,'-')||'grafica-consolidado';
  const a=document.createElement('a');
  a.download=name+'.png';
  a.href=cv.toDataURL('image/png');
  a.click();
}

// ================================================================
// MÓDULO SECRETARÍA / OFICINAS DEGUV / CONSULTA CIUDADANA PQRSD
// ================================================================
function secGmailRadicacionConectada(){
  return typeof gmailIsTokenValid==='function'&&gmailIsTokenValid();
}
function renderSecGmailBloqueoRadicacion(){
  if(typeof esSecretaria==='function'&&!esSecretaria())return;
  const ok=secGmailRadicacionConectada();
  const lock=document.getElementById('sec-form-lock');
  const btnTrasl=document.getElementById('sec-btn-radicar-trasl');
  const btnSolo=document.getElementById('sec-btn-radicar-solo');
  const connBtn=document.getElementById('sec-gmail-connect-btn');
  if(lock){
    lock.classList.toggle('on',!ok);
    lock.setAttribute('aria-hidden',ok?'true':'false');
  }
  if(btnTrasl)btnTrasl.disabled=!ok;
  if(btnSolo)btnSolo.disabled=!ok;
  if(connBtn){
    connBtn.disabled=false;
    connBtn.textContent='Conectar bandeja Gmail';
  }
}
function secGmailConnectParaRadicar(){
  if(typeof gmailConnect!=='function'){notif('Conexión Gmail no disponible','err');return;}
  const connBtn=document.getElementById('sec-gmail-connect-btn');
  if(connBtn){connBtn.disabled=true;connBtn.textContent='Conectando…';}
  gmailConnect(function(){
    renderSecGmailBloqueoRadicacion();
    if(typeof aplicarSugerenciaNumeroPqrsSec==='function')aplicarSugerenciaNumeroPqrsSec();
  });
}
function secAnexoFileLabel(inp){
  const lbl=document.getElementById('sec-anexo-label');
  if(!lbl)return;
  const files=inp&&inp.files&&inp.files.length?Array.from(inp.files):[];
  if(!files.length){lbl.textContent='Ningún archivo seleccionado';return;}
  lbl.textContent=files.length===1?files[0].name:(files.length+' archivos seleccionados');
}
function secEnsureSelectPlaceholder(selId,label){
  const sel=document.getElementById(selId);
  if(!sel)return null;
  if(!sel.querySelector('option[value=""]')){
    const o=document.createElement('option');
    o.value='';
    o.textContent=label||'— Seleccionar —';
    sel.insertBefore(o,sel.firstChild);
  }
  return sel;
}
function resetSecRadicacionFormulario(){
  const tipoSel=secEnsureSelectPlaceholder('sec-tipo');
  if(tipoSel)tipoSel.value='';
  const medioSel=secEnsureSelectPlaceholder('sec-medio');
  if(medioSel)medioSel.value='';
  const tpSel=secEnsureSelectPlaceholder('sec-tipo-persona');
  const anon=!!(document.getElementById('sec-anonimo')&&document.getElementById('sec-anonimo').checked);
  if(tpSel&&!anon)tpSel.value='';
  if(typeof onSecMedioRecepcionChange==='function')onSecMedioRecepcionChange();
  toggleSecPersona();
}
function secFormularioPristine(){
  const exp=String((document.getElementById('sec-exp')||{}).value||'').trim();
  const asu=String((document.getElementById('sec-asunto')||{}).value||'').trim();
  return !exp&&!asu;
}
function poblarSecOficinaSelect(){
  const sel=document.getElementById('sec-oficina');
  if(!sel)return;
  sel.innerHTML='<option value="">— Seleccione oficina —</option>'+OFICINAS_DEGUV.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
  updateSecFechaRadicVisibility();
  if(typeof resetSecRadicacionFormulario==='function'&&secFormularioPristine())resetSecRadicacionFormulario();
  else if(typeof initSecMedioNotificacion==='function')initSecMedioNotificacion(true);
  renderSecGmailBloqueoRadicacion();
  if(typeof aplicarSugerenciaNumeroPqrsSec==='function')aplicarSugerenciaNumeroPqrsSec();
}
function toggleSecAnonimo(){
  const anon=!!(document.getElementById('sec-anonimo')&&document.getElementById('sec-anonimo').checked);
  const tp=document.getElementById('sec-tipo-persona');
  ['sec-pn-nombre','sec-pn-identificacion','sec-pn-correo','sec-pn-telefono','sec-pj-empresa','sec-pj-nit','sec-pj-correo','sec-pj-telefono','sec-pj-ofi-nombre','sec-pj-ofi-identificacion','sec-pj-ofi-correo','sec-pj-ofi-telefono'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.disabled=anon;if(anon)el.value='';}
  });
  if(tp){
    tp.disabled=anon;
    if(anon)tp.value='';
    else secEnsureSelectPlaceholder('sec-tipo-persona');
  }
  // Mostrar bloque de contacto anónimo (correo/tel para notificación)
  const anonBlock=document.getElementById('sec-anon-contact-block');
  if(anonBlock)anonBlock.style.display=anon?'':'none';
  if(!anon){
    const ac=document.getElementById('sec-anon-correo');if(ac)ac.value='';
    const at=document.getElementById('sec-anon-tel');if(at)at.value='';
  }
  toggleSecPersona();
}
// ─── Gestión dinámica de anexos (radicación) ───────────────────────────────
if(typeof window!=='undefined'&&!window._secAnexoFiles)window._secAnexoFiles=[];
function secAnexoAdd(){
  const inp=document.createElement('input');
  inp.type='file';inp.multiple=true;
  inp.accept='.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip';
  inp.onchange=function(){
    if(!window._secAnexoFiles)window._secAnexoFiles=[];
    Array.from(inp.files||[]).forEach(f=>{
      if(!window._secAnexoFiles.some(x=>x.name===f.name&&x.size===f.size))
        window._secAnexoFiles.push(f);
    });
    secAnexoRenderList();
  };
  inp.click();
}
function secAnexoRemove(idx){
  if(!window._secAnexoFiles)return;
  window._secAnexoFiles.splice(idx,1);
  secAnexoRenderList();
}
function secAnexoRenderList(){
  const box=document.getElementById('sec-anexo-list');
  if(!box)return;
  const files=window._secAnexoFiles||[];
  if(!files.length){box.innerHTML='';return;}
  const esc=typeof escAttr==='function'?escAttr:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  box.innerHTML=files.map((f,i)=>{
    const icon=f.type&&f.type.includes('pdf')?'📄':f.type&&f.type.startsWith('image/')?'🖼️':'📎';
    return '<div class="fx" style="gap:6px;align-items:center;margin-bottom:4px;padding:5px 8px;background:var(--sf2);border-radius:var(--r);font-size:12px">'+
      icon+' <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name)+'</span>'+
      '<button type="button" class="btn bsm bd2" onclick="secAnexoRemove('+i+')" style="padding:2px 6px;font-size:11px" title="Quitar">✕</button>'+
      '</div>';
  }).join('');
}
// secAnexoFileLabel se mantiene en su definición original (línea ~100) para compatibilidad.
function toggleSecPersona(){
  const anon=!!(document.getElementById('sec-anonimo')&&document.getElementById('sec-anonimo').checked);
  const tp=String((document.getElementById('sec-tipo-persona')||{}).value||'').trim();
  const pn=document.getElementById('sec-pn-block');
  const pj=document.getElementById('sec-pj-block');
  if(pn)pn.style.display=(!anon&&tp==='natural')?'':'none';
  if(pj)pj.style.display=(!anon&&tp==='juridica')?'':'none';
}
function limpiarFormSecretaria(){
  // Cerrar vista paralela correo/formulario si estaba activa
  if(typeof cerrarSplitView==='function')cerrarSplitView();
  // Compatibilidad con ref-card legacy
  const refCard=document.getElementById('gmail-ref-card');if(refCard)refCard.style.display='none';
  ['sec-exp','sec-asunto','sec-detalle','sec-fecha-termino','sec-fecha-solicitud','sec-pn-nombre','sec-pn-identificacion','sec-pn-correo','sec-pn-telefono','sec-pj-empresa','sec-pj-nit','sec-pj-correo','sec-pj-telefono','sec-pj-ofi-nombre','sec-pj-ofi-identificacion','sec-pj-ofi-correo','sec-pj-ofi-telefono','sec-anon-correo','sec-anon-tel'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const anon=document.getElementById('sec-anonimo');if(anon)anon.checked=false;
  const pri=document.getElementById('sec-prioritaria');if(pri)pri.checked=false;
  window._secAnexoFiles=[];secAnexoRenderList();
  resetSecRadicacionFormulario();
  toggleSecAnonimo();
  poblarSecOficinaSelect();
}
function secRadicacionBusy(busy){
  ['sec-btn-radicar-trasl','sec-btn-radicar-solo'].forEach(function(id){
    const el=document.getElementById(id);
    if(!el)return;
    el.disabled=!!busy||!secGmailRadicacionConectada();
  });
}
function mostrarRadicacionPqrsProgreso(soloRadicar){
  if(typeof confirmExito!=='function')return;
  confirmExito({
    title:soloRadicar?'Radicando PQRSD':'Radicando y trasladando',
    message:'Generando soporte PDF y registrando la solicitud…',
    tone:'radicacion',
    loading:true,
    hideFooter:true
  });
}
function notificarResultadoRadicacionPqrs(opts){
  opts=opts||{};
  const msg=opts.message||'';
  if(!msg){if(typeof notif==='function')notif('Operación completada','ok');return;}
  if(typeof confirmExito==='function'){
    confirmExito({
      title:opts.title||'PQRSD radicada',
      message:msg,
      tone:'radicacion',
      hideFooter:true,
      autoCloseMs:1000
    });
  }else if(typeof notif==='function'){
    notif(msg,'ok');
  }
}
async function guardarPqrsSecretaria(modo){
  modo=modo||'trasladar';
  const soloRadicar=modo==='solo';
  const expId=String((document.getElementById('sec-exp')||{}).value||'').trim();
  const fecha=puedeEditarFechaRadicacionPqrs()?((document.getElementById('sec-fecha')||{}).value||hoy()):hoy();
  const fechaSol=String((document.getElementById('sec-fecha-solicitud')||{}).value||'').trim();
  const fechaTermino=String((document.getElementById('sec-fecha-termino')||{}).value||'').trim();
  const tipoRaw=String((document.getElementById('sec-tipo')||{}).value||'').trim();
  const medioRaw=String((document.getElementById('sec-medio')||{}).value||'').trim();
  const anon=!!((document.getElementById('sec-anonimo')||{}).checked);
  const tipoPersonaRaw=anon?'':String((document.getElementById('sec-tipo-persona')||{}).value||'').trim();
  // Correo/tel para anónimo con datos de notificación (si los ingresó)
  const anonCorreo=anon?String((document.getElementById('sec-anon-correo')||{}).value||'').trim().toLowerCase():'';
  const anonTel=anon?String((document.getElementById('sec-anon-tel')||{}).value||'').trim():'';
  let nombre='',ident='',correo=anonCorreo,tel=anonTel;
  const pjFields={};
  if(!anon){
    if(tipoPersonaRaw==='juridica'){
      pjFields._tipo_persona='juridica';
      pjFields._pj_empresa=String((document.getElementById('sec-pj-empresa')||{}).value||'').trim();
      pjFields._pj_nit=String((document.getElementById('sec-pj-nit')||{}).value||'').trim();
      pjFields._pj_correo=String((document.getElementById('sec-pj-correo')||{}).value||'').trim();
      pjFields._pj_telefono=String((document.getElementById('sec-pj-telefono')||{}).value||'').trim();
      const ofiNom=String((document.getElementById('sec-pj-ofi-nombre')||{}).value||'').trim();
      const ofiId=String((document.getElementById('sec-pj-ofi-identificacion')||{}).value||'').trim();
      const ofiCorreo=String((document.getElementById('sec-pj-ofi-correo')||{}).value||'').trim();
      const ofiTel=String((document.getElementById('sec-pj-ofi-telefono')||{}).value||'').trim();
      pjFields._qd_nombre=ofiNom;
      pjFields._qd_identificacion=ofiId;
      pjFields._qd_correo=ofiCorreo;
      pjFields._qd_telefono=ofiTel;
      nombre=pjFields._pj_empresa||ofiNom;
      ident=pjFields._pj_nit||ofiId;
      correo=pjFields._pj_correo||ofiCorreo;
      tel=pjFields._pj_telefono||ofiTel;
    }else if(tipoPersonaRaw==='natural'){
      nombre=String((document.getElementById('sec-pn-nombre')||{}).value||'').trim();
      ident=String((document.getElementById('sec-pn-identificacion')||{}).value||'').trim();
      correo=String((document.getElementById('sec-pn-correo')||{}).value||'').trim();
      tel=String((document.getElementById('sec-pn-telefono')||{}).value||'').trim();
    }
  }
  const asunto=String((document.getElementById('sec-asunto')||{}).value||'').trim();
  const detalle=String((document.getElementById('sec-detalle')||{}).value||'').trim();
  let oficina=(document.getElementById('sec-oficina')||{}).value||'';
  const medioNotif=medioNotificacionNorm((document.getElementById('sec-medio-notif')||{}).value||'');
  let prioritaria=!!((document.getElementById('sec-prioritaria')||{}).checked);
  if(!expId){notif('Indique el número de PQRSD','err');return;}
  if(typeof pqrsValidarNumeroRadicado==='function'){
    const valNum=pqrsValidarNumeroRadicado(expId,fecha);
    if(!valNum.ok){notif(valNum.msg,'err');return;}
  }
  if(!secGmailRadicacionConectada()){
    notif('Conecte la bandeja Gmail (cdaguaviare1) para radicar. Use el botón en el formulario.','err');
    renderSecGmailBloqueoRadicacion();
    return;
  }
  if(!fechaSol){notif('Indique la fecha de solicitud del ciudadano','err');return;}
  if(!tipoRaw){notif('Seleccione el tipo de solicitud','err');return;}
  if(!medioRaw){notif('Seleccione el medio de recepción','err');return;}
  if(!anon&&!tipoPersonaRaw){notif('Seleccione el tipo de persona','err');return;}
  if(!anon){
    if(tipoPersonaRaw==='natural'){
      const pnNom=String((document.getElementById('sec-pn-nombre')||{}).value||'').trim();
      if(!pnNom){notif('Indique el nombre del solicitante','err');return;}
    }else if(tipoPersonaRaw==='juridica'){
      const pjEmp=String((document.getElementById('sec-pj-empresa')||{}).value||'').trim();
      const ofiNom=String((document.getElementById('sec-pj-ofi-nombre')||{}).value||'').trim();
      if(!pjEmp){notif('Indique la razón social o entidad','err');return;}
      if(!ofiNom){notif('Indique el nombre de quien radica la solicitud','err');return;}
    }else{
      notif('Seleccione el tipo de persona','err');return;
    }
  }
  const tipoPersona=anon?'natural':tipoPersonaRaw;
  const tipo=tipoRaw;
  const medio=normMedioRecepcionPqrs(medioRaw);
  if(!asunto){notif('Indique el asunto de la solicitud','err');return;}
  if(!soloRadicar&&!oficina){notif('Seleccione la oficina destino','err');return;}
  if(soloRadicar){
    oficina='secretaria';
    prioritaria=false;
  }
  if(fechaTermino&&fechaTermino<fechaSol){notif('La fecha de término no puede ser anterior a la fecha de solicitud','err');return;}
  const dupPqrs=expNumeroDuplicado(expId);
  if(dupPqrs){alertRegistroDuplicado(expId,'pqrs',dupPqrs);return;}
  mostrarRadicacionPqrsProgreso(soloRadicar);
  secRadicacionBusy(true);
  try{
  const tramId=getTramPqrsId('guaviare');
  const detNotas=detalle?JSON.stringify([{texto:detalle,autor:'Secretaría DEGUV',fecha:fecha}]):'[]';
  const hist=[{tipo:'radicacion',fecha:fecha,nota:soloRadicar?'Radicado sin traslado — pendiente asignación de oficina':'Radicado por Secretaría DEGUV',oficina:''}];
  if(!soloRadicar){
    if(oficina==='secretaria'){
      hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Asignado a Secretaría DEGUV para gestión directa',oficina:'secretaria',oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
    }else{
      hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Traslado inicial a oficina competente',oficina:oficina,oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
    }
  }
  const gmailMsgId=window._gmailPendingMsgId||'';
  const anexoFiles=Array.isArray(window._secAnexoFiles)&&window._secAnexoFiles.length?window._secAnexoFiles:[];
  if(!soloRadicar&&gmailMsgId){
    const _msgParaReenvio=(typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId)?_gmailCurrentMsg:null;
    const _tokOk=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()&&_msgParaReenvio;
    if(_tokOk){
      if(oficina!=='secretaria'&&typeof reenviarEmailAOficina==='function'){
        try{await reenviarEmailAOficina(_msgParaReenvio,oficina,expId,{silent:true});}catch(err){console.warn('reenvio oficina:',err);}
      }
      if(typeof gmailMarkAsRead==='function')gmailMarkAsRead(gmailMsgId);
    }else if(oficina!=='secretaria'){
      notif('⚠️ La PQRSD se radicará, pero NO se pudo reenviar el correo a la oficina (sesión Gmail expirada). Reconecte la bandeja y use «Reenviar» o notifique manualmente.','warn');
    }
  }
  if(gmailMsgId&&typeof gmailAutoUploadPendingAttachments==='function'){
    try{await gmailAutoUploadPendingAttachments(expId,nombre);}catch(e){console.warn('auto-upload soporte:',e);}
  }
  let manualDriveAtts=null;
  let manualDriveFolderLink='';
  let driveFolderMeta={};
  let archivoFinal='';
  const tipoRadicacion=gmailMsgId?'radicacion_correo':(typeof tipoRadicacionDesdeMedioPqrs==='function'?tipoRadicacionDesdeMedioPqrs(medio):(medio==='Ventanilla'?'radicacion_ventanilla':'radicacion_otro'));
  if(!gmailMsgId&&typeof subirSoporteRadicacionManual==='function'){
    try{
      const manualRes=await subirSoporteRadicacionManual({
        expId,fecha,fechaSol,fechaTermino,tipo,medio,medioNotif,anon,nombre,ident,correo,tel,
        asunto,detalle,tipoPersona,
        pjEmpresa:pjFields._pj_empresa||'',pjNit:pjFields._pj_nit||'',
        tipoRadicacion,nombreCarpeta:nombre||asunto,anexosFiles:anexoFiles,
        silentNotif:true
      });
      if(anexoFiles.length){
        const subidos=(manualRes.anexos&&manualRes.anexos.length)||0;
        if(subidos<anexoFiles.length){
          if(typeof closeConfirmExito==='function')closeConfirmExito();
          notif('No se pudo subir el anexo al Drive. Revise la conexión Gmail e intente de nuevo.','err');
          return;
        }
      }
      if(!manualRes.soporte){
        if(typeof closeConfirmExito==='function')closeConfirmExito();
        notif('No se pudo generar el soporte PDF en Drive. Revise la conexión e intente de nuevo.','err');
        return;
      }
      if(manualRes.all&&manualRes.all.length)manualDriveAtts=manualRes.all;
      manualDriveFolderLink=manualRes.folderLink||manualRes.pqrsFolderLink||'';
      driveFolderMeta={
        pqrsFolderId:manualRes.pqrsFolderId||'',
        pqrsFolderLink:manualRes.folderLink||manualRes.pqrsFolderLink||'',
        solicitudFolderId:manualRes.solicitudFolderId||'',
        respuestaFolderId:manualRes.respuestaFolderId||'',
        pathLabel:manualRes.pathLabel||''
      };
      if(anexoFiles.length)archivoFinal=anexoFiles.map(f=>f.name).join('; ');
    }catch(e){
      console.warn('soporte manual drive:',e);
      if(anexoFiles.length){
        if(typeof closeConfirmExito==='function')closeConfirmExito();
        notif('No se pudo subir el anexo al Drive: '+(e.message||'revise la conexión Gmail'),'err');
        return;
      }
    }
  }
  const gmailAtts=Array.isArray(window._gmailPendingAttachments)&&window._gmailPendingAttachments.length
    ?window._gmailPendingAttachments:(manualDriveAtts||null);
  const gmailEmailData=(window._gmailPendingEmailData&&typeof window._gmailPendingEmailData==='object')
    ?window._gmailPendingEmailData:null;
  const linkFinal=(gmailAtts&&gmailAtts[0]?gmailAtts[0].driveLink:'')||(manualDriveAtts&&manualDriveAtts[0]?manualDriveAtts[0].driveLink:'');
  const gFolders=window._gmailPendingPqrsFolders;
  if(gFolders&&!driveFolderMeta.pqrsFolderId){
    driveFolderMeta={
      pqrsFolderId:gFolders.pqrsFolderId||'',
      pqrsFolderLink:gFolders.pqrsFolderLink||'',
      solicitudFolderId:gFolders.solicitudFolderId||'',
      respuestaFolderId:gFolders.respuestaFolderId||'',
      pathLabel:gFolders.pathLabel||''
    };
  }
  window._gmailPendingPqrsFolders=null;
  const folderLinkFinal=manualDriveFolderLink||driveFolderMeta.pqrsFolderLink||(gmailAtts&&gmailAtts[0]&&gmailAtts[0].folderLink)||'';
  const encargadoOfi=soloRadicar?'':(typeof getEncargadoOficina==='function'?getEncargadoOficina(oficina):'');
  const data=normalizePqrsOficinaFields({
    _depto:'guaviare',_tramite:tramId,_exp:expId,_estado:'En trámite',_fecha:fecha,_fecha_solicitud:fechaSol,_pqrs_fecha_termino:fechaTermino||'',
    _fechas_estado:JSON.stringify({Solicitud:fechaSol,'En trámite':fecha}),
    _es_pqrs:true,_es_queja:true,_tipo_solicitud:tipo,
    _tipo_persona:tipoPersona,
    _medio_notificacion:medioNotif,_pqrs_prioritaria:prioritaria,
    _qd_anonimo:anon,_qd_nombre:nombre,_qd_identificacion:ident,_qd_correo:correo,_qd_telefono:tel,
    _pn_nombre:tipoPersona==='natural'&&!anon?nombre:'',_pn_identificacion:tipoPersona==='natural'&&!anon?ident:'',_pn_correo:tipoPersona==='natural'&&!anon?correo:'',_pn_telefono:tipoPersona==='natural'&&!anon?tel:'',
    ...pjFields,
    f_f1:asunto,f_f2:medio,
    _detalle_notas:detNotas,_detalle_general:detalle,
    _radicado_secretaria:true,_pqrs_oficina:oficina,
    _pqrs_pendiente_traslado:soloRadicar||undefined,
    _pqrs_traslado_fecha:soloRadicar?'':hoy(),_pqrs_traslado_por:soloRadicar?'':'Secretaría DEGUV',
    _pqrs_estado_oficina:'pendiente',_pqrs_responsable_oficina:encargadoOfi,
    _pqrs_solicitud_link:linkFinal,_pqrs_solicitud_archivo:archivoFinal,_pqrs_detalle:detalle,
    _pqrs_drive_folder_link:folderLinkFinal,
    _pqrs_drive_folder_id:driveFolderMeta.pqrsFolderId||'',
    _pqrs_drive_solicitud_folder_id:driveFolderMeta.solicitudFolderId||'',
    _pqrs_drive_respuesta_folder_id:driveFolderMeta.respuestaFolderId||'',
    _pqrs_drive_path_label:driveFolderMeta.pathLabel||'',
    _pqrs_historial:hist,tasks:[],
    _gmail_message_id:gmailMsgId||null,
    _pqrs_gmail_attachments:gmailAtts||null,
    _gmail_email_data:gmailEmailData,
    _pqrs_workflow:JSON.stringify({fase:typeof PQRS_WF!=='undefined'?PQRS_WF.SIN_RESPUESTA:'sin_respuesta',tipo_radicacion:tipoRadicacion})
  });
  exps.push(data);
  if(!soloRadicar){
    if(oficina==='guaviare')ensureTareaPqrsNca(data);
    else if(oficina!=='secretaria')ensureTareaPqrsOficina(data,oficina);
  }
  upsertPersonaCatalog(data);
  logAudit('Creó PQRSD ['+expId+']'+(soloRadicar?' (sin traslado)':''),'pqrsd',expId);
  persistExpedienteGranular(data,true);
  try{
    await enviarNotificacionRadicacionPqrsAuto(data,{gmailMsgId:gmailMsgId,medio:medio,medioNotif:medioNotif});
  }catch(err){console.warn('notif radicacion auto:',err);}
  window._gmailPendingMsgId=null;
  window._gmailPendingAttachments=null;
  window._gmailPendingEmailData=null;
  renderBandejaDepto();
  const msgPrincipal='PQRSD '+expId+(soloRadicar?' radicada — pendiente traslado a oficina':(oficina==='secretaria'?' radicado en Secretaría DEGUV':' radicado y trasladado a '+labelOficina(oficina)));
  notificarResultadoRadicacionPqrs({
    title:soloRadicar?'PQRSD radicada':(oficina==='secretaria'?'PQRSD radicada en Secretaría':'PQRSD radicada y trasladada'),
    message:msgPrincipal
  });
  limpiarFormSecretaria();
  renderSecretariaPqrs();
  }catch(err){
    console.warn('guardarPqrsSecretaria:',err);
    if(typeof closeConfirmExito==='function')closeConfirmExito();
    notif('No se pudo completar la radicación: '+(err.message||'error inesperado'),'err');
  }finally{
    secRadicacionBusy(false);
  }
}
async function tryReenvioPqrsCorreoTraslado(e,oficina,expId){
  if(!e||oficina==='secretaria')return;
  if(normMedioRecepcionPqrs(e.f_f2||'')!=='Correo')return;
  const gmailMsgId=e._gmail_message_id||'';
  if(!gmailMsgId)return;
  const tokOk=typeof gmailIsTokenValid==='function'&&gmailIsTokenValid();
  if(!tokOk){
    notif('⚠️ PQRSD trasladada, pero NO se pudo reenviar el correo (sesión Gmail expirada). Reconecte la bandeja y reenvíe manualmente.','warn');
    return;
  }
  let msg=(typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId)?_gmailCurrentMsg:null;
  if(!msg&&typeof gmailApiCall==='function'&&typeof GMAIL_API_BASE!=='undefined'){
    try{msg=await gmailApiCall('GET',GMAIL_API_BASE+'/messages/'+gmailMsgId+'?format=full');}catch(err){console.warn('fetch gmail msg:',err);}
  }
  if(msg&&typeof reenviarEmailAOficina==='function'){
    try{await reenviarEmailAOficina(msg,oficina,expId);if(typeof gmailMarkAsRead==='function')gmailMarkAsRead(gmailMsgId);}catch(err){console.warn('reenvio oficina:',err);notif('⚠️ Traslado registrado, pero falló el reenvío del correo.','warn');}
  }else{
    notif('⚠️ PQRSD trasladada, pero no se pudo reenviar el correo a la oficina.','warn');
  }
}
// Genera HTML con TODOS los links de adjuntos Drive de una PQRSD
function htmlPqrsAdjuntosDrive(e){
  var links=[];
  if(e._pqrs_solicitud_link)links.push({url:e._pqrs_solicitud_link,label:'Documento principal'});
  if(Array.isArray(e._pqrs_gmail_attachments)){
    e._pqrs_gmail_attachments.forEach(function(att){
      if(att&&att.driveLink&&att.driveLink!==e._pqrs_solicitud_link)
        links.push({url:att.driveLink,label:att.nombre||'Adjunto'});
    });
  }
  if(!links.length)return '';
  return links.map(function(l){
    return '<div style="font-size:12px;margin-bottom:6px">📎 <a href="'+escAttr(l.url)+'" target="_blank" rel="noopener">'+escAttr(l.label)+'</a></div>';
  }).join('');
}
function htmlPqrsOficinaInteresado(e){
  if(e._qd_anonimo)return '<div class="pqrs-det-v">Solicitud anónima</div>';
  if(e._tipo_persona==='juridica'){
    let h='<div class="pqrs-det-v"><strong>'+escAttr(e._pj_empresa||'Entidad jurídica')+'</strong>';
    if(e._pj_nit)h+='<br>NIT: '+escAttr(e._pj_nit);
    if(e._pj_correo)h+='<br>Correo entidad: '+escAttr(e._pj_correo);
    if(e._pj_telefono)h+='<br>Tel. entidad: '+escAttr(e._pj_telefono);
    h+='</div>';
    if(e._qd_nombre&&e._qd_nombre!==e._pj_empresa){
      h+='<div class="pqrs-det-sec"><div class="pqrs-det-k">Persona que radica / oficia</div><div class="pqrs-det-v">'+escAttr(e._qd_nombre);
      if(e._qd_identificacion)h+='<br>ID: '+escAttr(e._qd_identificacion);
      if(e._qd_correo)h+='<br>Correo: '+escAttr(e._qd_correo);
      if(e._qd_telefono)h+='<br>Tel: '+escAttr(e._qd_telefono);
      h+='</div></div>';
    }
    return h;
  }
  let h='<div class="pqrs-det-v">'+escAttr(e._pn_nombre||e._qd_nombre||'—');
  if(e._pn_identificacion||e._qd_identificacion)h+='<br>ID: '+escAttr(e._pn_identificacion||e._qd_identificacion);
  if(e._pn_correo||e._qd_correo)h+='<br>Correo: '+escAttr(e._pn_correo||e._qd_correo);
  if(e._pn_telefono||e._qd_telefono)h+='<br>Tel: '+escAttr(e._pn_telefono||e._qd_telefono);
  return h+'</div>';
}
function htmlPqrsOficinaDetalle(e){
  return htmlPqrsOficinaDetalleCore(e,{});
}
function openPqrsOficinaDetalle(expId){
  expId=String(expId||'').trim();
  if(!expId)return;
  const pg=document.getElementById('pg-pqrs-ofi');
  if(pg&&!pg.classList.contains('on'))showTab('pqrs-ofi');
  openPqrsSidePanel(expId);
}
function renderPqrsOficinaDetallePanel(){
  const box=document.getElementById('pqrs-ofi-detalle');
  if(box){box.style.display='none';box.innerHTML='';}
}
function marcarPqrsRespondidaOficina(expId){
  openPqrsRespuestaModal(expId);
}
function getPqrsPendientesTrasladoList(skipPeriodo){
  let list=exps.filter(e=>esPqrsSecretaria(e)&&pqrsPendienteTraslado(e)).map(normalizePqrsOficinaFields);
  if(!skipPeriodo)list=filterExpsPeriodo(list,'pqrs-ofi');
  return list.sort((a,b)=>String(b._fecha||'').localeCompare(String(a._fecha||'')));
}
function renderSecretariaPqrs(){
  renderSecGmailBloqueoRadicacion();
  const all=getSecretariaPqrsAll();
  const pendientes=getPqrsPendientesTrasladoList(true);
  const asignadas=all.filter(e=>!pqrsPendienteTraslado(e));
  const atendidas=all.filter(e=>pqrsEstaCerrada(e));
  const mets=document.getElementById('sec-pqrs-mets');
  if(mets)mets.innerHTML=
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+all.length+'</div><div class="l">Radicadas</div></div>'+
    '<div class="met met-click" style="border-left:3px solid #7c5cbf" onclick="setPqrsOfiFiltro(\'por_trasladar\');showTab(\'pqrs-ofi\')" title="Ver bandeja por trasladar"><div class="v" style="color:#7c5cbf">'+pendientes.length+'</div><div class="l">Pend. traslado</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+asignadas.filter(e=>!pqrsEstaCerrada(e)).length+'</div><div class="l">En gestión</div></div>'+
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+atendidas.length+'</div><div class="l">Atendidas</div></div>';
  const pendWrap=document.getElementById('sec-pend-trasl-wrap');
  const pendTb=document.getElementById('tbl-sec-pend-trasl');
  if(pendWrap&&pendTb){
    const showPend=puedeGestionarPendientesTraslado();
    pendWrap.style.display=showPend?'':'none';
    if(!showPend)pendTb.innerHTML='';
    else if(!pendientes.length)pendTb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">No hay PQRSD pendientes de traslado.</td></tr>';
    else pendTb.innerHTML=pendientes.map(e=>{
      const asunto=e.f_f1||e._pqrs_detalle||'—';
      return '<tr><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+pqrsEstadoConsultaBadge(e)+'</td><td>'+fmtF(e._fecha)+'</td><td>'+fmtF(e._fecha_solicitud||e._fecha)+'</td><td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
    }).join('');
  }
  const tb=document.getElementById('tbl-sec-pqrs');
  if(tb){
    if(!asignadas.length)tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">Sin PQRSD en seguimiento.</td></tr>';
    else tb.innerHTML=asignadas.map(e=>{
      const asunto=e.f_f1||e._pqrs_detalle||'—';
      const ofiLbl=e._pqrs_oficina?labelOficina(e._pqrs_oficina):'Sin oficina (registro anterior)';
      return '<tr><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+escAttr(ofiLbl)+'</td><td>'+pqrsEstadoConsultaBadge(e)+'</td><td>'+fmtF(e._fecha)+'</td>'+
        '<td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
    }).join('');
  }
  renderSecretariaPqrsDetalle();
}
function pqrsOfiEstBadge(est){
  const lbl=PQRS_EST_OFICINA[est]||est||'—';
  const cls=est==='cerrado'?'cerr':est==='atendiendo'?'aten':est==='asignado'?'asig':'pend';
  return '<span class="pqrs-ofi-est '+cls+'">'+escAttr(lbl)+'</span>';
}
function getPqrsOficinaList(oficinaId,filtro){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  filtro=filtro||window._pqrsOfiFiltro||'all';
  if(filtro==='por_trasladar')return getPqrsPendientesTrasladoList();
  let list=exps.filter(e=>esPqrsSecretaria(e)&&e._pqrs_oficina===oficinaId&&!pqrsPendienteTraslado(e)).map(normalizePqrsOficinaFields);
  if(filtro==='pend')list=list.filter(e=>!pqrsEstaCerrada(e)&&!pqrsEstaAtrasada(e));
  else if(filtro==='atras')list=list.filter(e=>pqrsEstaAtrasada(e));
  else if(filtro==='cerr')list=list.filter(e=>pqrsEstaCerrada(e));
  else if(filtro==='revision')list=list.filter(e=>typeof pqrsWorkflowFase==='function'&&pqrsWorkflowFase(e)===PQRS_WF.PENDIENTE_REVISION);
  list=filterExpsPeriodo(list,'pqrs-ofi');
  return list.sort((a,b)=>String(b._pqrs_traslado_fecha||b._fecha||'').localeCompare(String(a._pqrs_traslado_fecha||a._fecha||'')));
}
function pqrsAccionesTablaHtml(e){
  const id=jsStr(e._exp);
  const fase=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):PQRS_WF.SIN_RESPUESTA;
  let h='<button type="button" class="btn bsm" onclick="event.stopPropagation();openPqrsSidePanel(\''+id+'\')">Ver</button> ';
  if(puedeTrasladarPqrsInicial(e))h+='<button type="button" class="btn bsm bp" onclick="event.stopPropagation();openTrasladoPqrsInicialModal(\''+id+'\')">Trasladar</button> ';
  if(puedeMarcarPqrsPrioritariaDs(e))h+='<button type="button" class="btn bsm" onclick="event.stopPropagation();togglePqrsPrioritariaDs(\''+id+'\')">'+(e._pqrs_prioritaria?'Quitar ⚡':'⚡ Prioritaria')+'</button> ';
  if(puedeTrasladarPqrs(e))h+='<button type="button" class="btn bsm" onclick="event.stopPropagation();openTrasladoPqrsInterOficinaModal(\''+id+'\')">Trasladar</button> ';
  if(puedeAsignarPqrsOficina(e))h+='<button type="button" class="btn bsm" onclick="event.stopPropagation();openAsignarPqrsOficinaModal(\''+id+'\')">Asignar</button> ';
  // NCA encargado revisión de responsable
  if(fase===PQRS_WF.PENDIENTE_REVISION&&(esNcaDeguv()||esOficinaPqrsNca()||esAdministrador()))
    h+='<button type="button" class="btn bsm" style="background:#6d3fa8;color:#fff" onclick="event.stopPropagation();openNcaRevisionModal(\''+id+'\')">⏳ Revisar</button> ';
  // VITAL gestión oficio firmado
  if(fase===PQRS_WF.VITAL_GESTION&&(typeof esCargoVital==='function'&&esCargoVital()||esAdministrador()))
    h+='<button type="button" class="btn bsm" style="background:#1a7a4a;color:#fff" onclick="event.stopPropagation();openVitalBandejaModal(\''+id+'\')">📄 VITAL</button> ';
  // Notificación pendiente (VITAL o encargado NCA puede notificar)
  if((fase===PQRS_WF.PENDIENTE_NOTIF||fase===PQRS_WF.LISTA_ENVIO)&&(esNcaDeguv()||esOficinaPqrsNca()||typeof esCargoVital==='function'&&esCargoVital()||esAdministrador()))
    h+='<button type="button" class="btn bsm bp" onclick="event.stopPropagation();abrirNotifPqrsExpId(\''+id+'\')">📧 Notificar</button> ';
  // Responder directo (offices + NCA encargado + secretary)
  if(fase===PQRS_WF.SIN_RESPUESTA||fase===PQRS_WF.RECHAZADA){
    if(puedeMarcarPqrsRespondida(e))h+='<button type="button" class="btn bsm bp" onclick="event.stopPropagation();openPqrsRespuestaModal(\''+id+'\')">Responder</button> ';
    // También ofrecer responder directamente por correo desde Correos
    if(puedeMarcarPqrsRespondida(e)&&(typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid()||typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()))
      h+='<button type="button" class="btn bsm" title="Abrir compose en el módulo Correos para responder al ciudadano" onclick="event.stopPropagation();gmailOfiAbrirComposeRespuestaPqrs(\''+id+'\')">📧 Enviar correo</button> ';
  }
  if(esSecretaria()&&puedeEditarPqrsSecretaria(e))h+=pqrsBtnEdit(e._exp,'Editar')+' ';
  if(esSecretaria()&&puedeEliminarPqrs(e))h+='<button type="button" class="btn bsm bd2" onclick="event.stopPropagation();eliminarPqrs(\''+id+'\')">Eliminar</button> ';
  return h;
}
function renderPqrsOficinaInbox(){
  const tb=document.getElementById('tbl-pqrs-ofi');
  const tit=document.getElementById('pqrs-ofi-titulo');
  const ban=document.getElementById('pqrs-ofi-banner');
  const mets=document.getElementById('pqrs-ofi-mets');
  const detBox=document.getElementById('pqrs-ofi-detalle');
  const ofi=getOficinaActiva();
  const filtro=window._pqrsOfiFiltro||'all';
  const esPendTrasl=filtro==='por_trasladar';
  if(tit){
    if(esPendTrasl)tit.textContent='PQRSD — Pendientes por trasladar';
    else if(ofi)tit.textContent='PQRSD — '+ofi.nombre;
  }
  if(ban){
    if(esPendTrasl){
      ban.style.display='';
      ban.textContent='📋 PQRSD radicadas sin oficina asignada — traslade a la oficina competente (Secretaría o DS DEGUV).';
    }else{
      ban.style.display='none';
    }
  }
  const pr=document.getElementById('pqrs-ofi-periodo-resumen');
  const prLbl=labelPeriodo('pqrs-ofi');
  if(pr)pr.textContent=prLbl?('Filtro de fechas (radicación): '+prLbl):'';
  if(!tb)return;
  const listAll=getPqrsOficinaList(getPqrsOficinaActiva(),'all');
  const list=getPqrsOficinaList(getPqrsOficinaActiva(),filtro);
  const pendTraslCount=getPqrsPendientesTrasladoList().length;
  const showPorTrasl=puedeGestionarPendientesTraslado();
  if(mets){
    const pend=listAll.filter(e=>!pqrsEstaCerrada(e)&&!pqrsEstaAtrasada(e)).length;
    const atras=listAll.filter(e=>pqrsEstaAtrasada(e)).length;
    const cerr=listAll.filter(e=>pqrsEstaCerrada(e)).length;
    const enRevision=listAll.filter(e=>typeof pqrsWorkflowFase==='function'&&pqrsWorkflowFase(e)===PQRS_WF.PENDIENTE_REVISION).length;
    const onAll=filtro==='all'?'outline:2px solid var(--bl);':'';
    const onPend=filtro==='pend'?'outline:2px solid var(--or);':'';
    const onAtras=filtro==='atras'?'outline:2px solid var(--rd);':'';
    const onCerr=filtro==='cerr'?'outline:2px solid var(--gn);':'';
    const onRev=filtro==='revision'?'outline:2px solid #6d3fa8;':'';
    const onPorTrasl=filtro==='por_trasladar'?'outline:2px solid #7c5cbf;':'';
    const cardPorTrasl=showPorTrasl?pqrsMetCard('por_trasladar',onPorTrasl+'border-left:3px solid #7c5cbf','<div class="v" style="color:#7c5cbf">'+pendTraslCount+'</div><div class="l">Por trasladar</div>'):'';
    mets.innerHTML=
      (showPorTrasl?cardPorTrasl:'')+
      pqrsMetCard('all',onAll+'border-left:3px solid var(--bl)','<div class="v" style="color:var(--bl)">'+listAll.length+'</div><div class="l">Total</div>')+
      pqrsMetCard('pend',onPend+'border-left:3px solid var(--or)','<div class="v" style="color:var(--or)">'+pend+'</div><div class="l">Pendientes</div>')+
      pqrsMetCard('atras',onAtras+'border-left:3px solid var(--rd)','<div class="v" style="color:var(--rd)">'+atras+'</div><div class="l">Atrasados</div>')+
      (enRevision?pqrsMetCard('revision',onRev+'border-left:3px solid #6d3fa8','<div class="v" style="color:#6d3fa8">'+enRevision+'</div><div class="l">Por revisar</div>'):'')+
      pqrsMetCard('cerr',onCerr+'border-left:3px solid var(--gn)','<div class="v" style="color:var(--gn)">'+cerr+'</div><div class="l">Respondidas</div>');
  }
  if(!list.length){
    const vacioMsg=esPendTrasl?'No hay PQRSD pendientes de traslado en este filtro de fechas.':'No hay PQRSD en este filtro.';
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:16px">'+vacioMsg+'</td></tr>';
    if(detBox){detBox.style.display='none';detBox.innerHTML='';}
    window._pqrsOfiSelExp=null;
    return;
  }
  const sel=String(window._pqrsOfiSelExp||'').trim();
  if(!sel||!list.some(e=>String(e._exp||'').trim()===sel))window._pqrsOfiSelExp=String(list[0]._exp||'').trim();
  tb.innerHTML=list.map(e=>{
    const asunto=e.f_f1||e._pqrs_detalle||'—';
    const on=String(window._pqrsOfiSelExp||'').trim()===String(e._exp||'').trim();
    const wfBadge=typeof htmlNcaRevisionBadge==='function'?htmlNcaRevisionBadge(e):'';
    return '<tr class="'+(on?'pqrs-ofi-row-sel':'')+'" style="cursor:pointer" onclick="openPqrsSidePanel(\''+escAttr(e._exp)+'\')"><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+fmtF(e._fecha)+'</td><td>'+pqrsEstadoConsultaBadge(e)+' '+wfBadge+' '+pqrsMedioNotificacionFlagHtml(e,true)+'</td><td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
  }).join('');
  renderPqrsOficinaDetallePanel();
}
function setEditPqrsMedioNotificacion(val,userPick){
  const hid=document.getElementById('pqrs-edit-medio-notif');
  const norm=medioNotificacionNorm(val==='no_indica'?'':val);
  if(hid){
    hid.value=norm;
    if(userPick)hid.dataset.userSet='1';
    else delete hid.dataset.userSet;
  }
  document.querySelectorAll('#pqrs-edit-medio-notif-btns .medio-notif-btn').forEach(b=>{
    const bv=b.getAttribute('data-val')||'';
    const on=(bv==='no_indica'&&!norm)||bv===norm;
    b.classList.toggle('on',on);
  });
}
function onEditPqrsMedioRecepcionChange(){
  const hid=document.getElementById('pqrs-edit-medio-notif');
  const medio=(document.getElementById('pqrs-edit-medio')||{}).value||'';
  if(hid&&hid.dataset.userSet){
    setEditPqrsMedioNotificacion('no_indica',false);
    delete hid.dataset.userSet;
  }else{
    setEditPqrsMedioNotificacion(defaultMedioNotifDesdeRecepcion(medio)||'no_indica',false);
  }
}
function toggleEditPqrsAnonimo(){
  const anon=!!(document.getElementById('pqrs-edit-anonimo')&&document.getElementById('pqrs-edit-anonimo').checked);
  ['pqrs-edit-pn-nombre','pqrs-edit-pn-identificacion','pqrs-edit-pn-correo','pqrs-edit-pn-telefono','pqrs-edit-pj-empresa','pqrs-edit-pj-nit','pqrs-edit-pj-correo','pqrs-edit-pj-telefono','pqrs-edit-pj-ofi-nombre','pqrs-edit-pj-ofi-identificacion','pqrs-edit-pj-ofi-correo','pqrs-edit-pj-ofi-telefono','pqrs-edit-tipo-persona'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.disabled=anon;if(anon)el.value='';}
  });
  const tp=document.getElementById('pqrs-edit-tipo-persona');if(tp&&anon)tp.value='natural';
  // Mostrar/ocultar bloque de contacto para anónimo
  const ab=document.getElementById('pqrs-edit-anon-contact-block');
  if(ab)ab.style.display=anon?'':'none';
  if(!anon){
    const ac=document.getElementById('pqrs-edit-anon-correo');if(ac)ac.value='';
    const at=document.getElementById('pqrs-edit-anon-tel');if(at)at.value='';
  }
  toggleEditPqrsPersona();
}
function toggleEditPqrsPersona(){
  const anon=!!(document.getElementById('pqrs-edit-anonimo')&&document.getElementById('pqrs-edit-anonimo').checked);
  const tp=(document.getElementById('pqrs-edit-tipo-persona')||{}).value||'natural';
  const pn=document.getElementById('pqrs-edit-pn-block');
  const pj=document.getElementById('pqrs-edit-pj-block');
  const gv2=function(id){const el=document.getElementById(id);return el?el.value:'';};
  const setv2=function(id,v){const el=document.getElementById(id);if(el&&!el.value)el.value=v;};
  // Migrar datos al cambiar de tipo para no "perder" la información ya ingresada
  if(tp==='juridica'&&pn&&pn.style.display!=='none'){
    // natural → jurídica: datos de la persona natural pasan al campo "oficial/quien radica"
    setv2('pqrs-edit-pj-ofi-nombre',gv2('pqrs-edit-pn-nombre'));
    setv2('pqrs-edit-pj-ofi-identificacion',gv2('pqrs-edit-pn-identificacion'));
    setv2('pqrs-edit-pj-ofi-correo',gv2('pqrs-edit-pn-correo'));
    setv2('pqrs-edit-pj-ofi-telefono',gv2('pqrs-edit-pn-telefono'));
  }else if(tp==='natural'&&pj&&pj.style.display!=='none'){
    // jurídica → natural: datos del oficial pasan a la persona natural
    setv2('pqrs-edit-pn-nombre',gv2('pqrs-edit-pj-ofi-nombre'));
    setv2('pqrs-edit-pn-identificacion',gv2('pqrs-edit-pj-ofi-identificacion'));
    setv2('pqrs-edit-pn-correo',gv2('pqrs-edit-pj-ofi-correo'));
    setv2('pqrs-edit-pn-telefono',gv2('pqrs-edit-pj-ofi-telefono'));
  }
  if(pn)pn.style.display=(!anon&&tp==='natural')?'':'none';
  if(pj)pj.style.display=(!anon&&tp==='juridica')?'':'none';
}
// ─── Anexos en modal de edición ──────────────────────────────────────────────
function _pqrsEditAnexosHtml(e){
  const atts=Array.isArray(e._pqrs_gmail_attachments)?e._pqrs_gmail_attachments:[];
  const esc=typeof escAttr==='function'?escAttr:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const existentes=atts.map((a,i)=>{
    const nom=a.nombre||a.name||a.filename||('Anexo '+(i+1));
    const link=a.driveLink||a.url||'';
    return '<div class="fx pqrs-edit-anx-row" data-anx-idx="'+i+'" style="gap:6px;align-items:center;margin-bottom:4px;padding:5px 8px;background:var(--sf2);border-radius:var(--r);font-size:12px">'+
      '📎 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(link?'<a href="'+esc(link)+'" target="_blank" style="color:var(--bl)">'+esc(nom)+'</a>':esc(nom))+'</span>'+
      '<button type="button" class="btn bsm bd2" onclick="pqrsEditAnexoEliminar('+i+')" style="padding:2px 6px;font-size:11px" title="Eliminar este anexo">✕</button>'+
      '</div>';
  }).join('');
  return '<div class="fld" style="margin-bottom:10px">'+
    '<label style="font-weight:600;font-size:12px">Anexos de la solicitud</label>'+
    (atts.length
      ?'<div id="pqrs-edit-anx-list" style="margin-top:6px">'+existentes+'</div>'
      :'<div id="pqrs-edit-anx-list" style="margin-top:6px;font-size:11px;color:var(--tx3)">Sin anexos registrados</div>')+
    '<div id="pqrs-edit-anx-nuevos" style="margin-top:6px"></div>'+
    '<button type="button" class="btn bsm" style="margin-top:6px" onclick="pqrsEditAnexoAdd()">📎 Agregar archivo</button>'+
    '</div>';
}
function pqrsEditAnexoEliminar(idx){
  if(!window._pqrsEditAnexosDel)window._pqrsEditAnexosDel=new Set();
  window._pqrsEditAnexosDel.add(idx);
  const row=document.querySelector('.pqrs-edit-anx-row[data-anx-idx="'+idx+'"]');
  if(row){row.style.opacity='0.4';row.style.textDecoration='line-through';const btn=row.querySelector('button');if(btn){btn.textContent='↩';btn.onclick=function(){pqrsEditAnexoRestaurar(idx);};};}
}
function pqrsEditAnexoRestaurar(idx){
  if(window._pqrsEditAnexosDel)window._pqrsEditAnexosDel.delete(idx);
  const row=document.querySelector('.pqrs-edit-anx-row[data-anx-idx="'+idx+'"]');
  if(row){row.style.opacity='';row.style.textDecoration='';const btn=row.querySelector('button');if(btn){btn.textContent='✕';btn.onclick=function(){pqrsEditAnexoEliminar(idx);};};}
}
function pqrsEditAnexoAdd(){
  const inp=document.createElement('input');
  inp.type='file';inp.multiple=true;inp.accept='.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip';
  inp.onchange=function(){
    if(!window._pqrsEditAnexosNew)window._pqrsEditAnexosNew=[];
    Array.from(inp.files||[]).forEach(f=>{
      if(!window._pqrsEditAnexosNew.some(x=>x.name===f.name&&x.size===f.size))
        window._pqrsEditAnexosNew.push(f);
    });
    _pqrsEditRenderNuevos();
  };
  inp.click();
}
function _pqrsEditAnexoRemoveNuevo(idx){
  if(window._pqrsEditAnexosNew)window._pqrsEditAnexosNew.splice(idx,1);
  _pqrsEditRenderNuevos();
}
function _pqrsEditRenderNuevos(){
  const box=document.getElementById('pqrs-edit-anx-nuevos');if(!box)return;
  const files=window._pqrsEditAnexosNew||[];
  const esc=typeof escAttr==='function'?escAttr:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  box.innerHTML=files.map((f,i)=>'<div class="fx" style="gap:6px;align-items:center;margin-bottom:4px;padding:5px 8px;background:var(--sf2);border-radius:var(--r);font-size:12px">'+
    '📎 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name)+'</span>'+
    '<button type="button" class="btn bsm bd2" onclick="_pqrsEditAnexoRemoveNuevo('+i+')" style="padding:2px 6px;font-size:11px">✕</button>'+
    '</div>').join('');
}
function openEditPqrsSecretariaModal(expId){
  try{
    expId=String(expId||'').trim();
    if(!expId){notif('PQRSD no indicado','err');return;}
    if(!esSecretaria()){notif('Solo Secretaría puede editar PQRSD','err');return;}
    const e=exps.find(x=>String(x._exp||'').trim()===expId);
    if(!e||!puedeEditarPqrsSecretaria(e)){notif('No puede editar esta PQRSD','err');return;}
    abrirPqrsModalPrep();
    const rec=normalizePqrsOficinaFields(e);
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body){notif('No se encontró el formulario de edición','err');return;}
  if(tit)tit.textContent='Editar PQRSD · '+expId;
  if(modal){modal.classList.add('task-modal-wide');modal.classList.remove('enviar-modal-only');}
    const tp=rec._tipo_persona||'natural';
    const anon=!!rec._qd_anonimo;
    const tipos=['Petición','Queja','Reclamo','Denuncia','Sugerencia'];
    const tipoOpts=tipos.map(t=>'<option value="'+escAttr(t)+'"'+(rec._tipo_solicitud===t?' selected':'')+'>'+escAttr(t)+'</option>').join('');
    const medioVal=normMedioRecepcionPqrs(rec.f_f2||'Ventanilla');
    const medioOpts=mediosRecepcionPqrsOptsHtml(medioVal);
    const ofOpts=pqrsOficinasSelectOpts(rec._pqrs_oficina||'',true);
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Puede modificar todos los datos de la solicitud. Si cambia la oficina destino se registrará un traslado.</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Fecha de solicitud (ciudadano)</label><input type="date" id="pqrs-edit-fecha-solicitud" value="'+escAttr(e._fecha_solicitud||e._fecha||hoy())+'"></div>'+
    '<div class="fld"><label>Fecha de término <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label><input type="date" id="pqrs-edit-fecha-termino" value="'+escAttr(e._pqrs_fecha_termino||'')+'" title="Si el oficio indica un plazo menor a 15 días"></div>'+
    (puedeEditarFechaRadicacionPqrs()?('<div class="fld"><label>Fecha de radicación <span style="font-weight:400;color:var(--tx3)">(admin)</span></label><input type="date" id="pqrs-edit-fecha" value="'+escAttr(e._fecha||hoy())+'"></div>'):'')+
    '<div class="fld"><label>Tipo de solicitud</label><select id="pqrs-edit-tipo">'+tipoOpts+'</select></div>'+
    '<div class="fld"><label>Medio de recepción</label><select id="pqrs-edit-medio" onchange="onEditPqrsMedioRecepcionChange()">'+medioOpts+'</select></div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Medio de notificación</label><div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px" id="pqrs-edit-medio-notif-btns"></div><input type="hidden" id="pqrs-edit-medio-notif" value="'+escAttr(e._medio_notificacion||'')+'"></div>'+
    '<div class="fg" style="margin-bottom:10px"><div class="fld"><label>Tipo de persona</label><select id="pqrs-edit-tipo-persona" onchange="toggleEditPqrsPersona()"><option value="natural"'+(tp==='natural'?' selected':'')+'>Persona natural</option><option value="juridica"'+(tp==='juridica'?' selected':'')+'>Persona jurídica</option></select></div></div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="pqrs-edit-anonimo"'+(anon?' checked':'')+' onchange="toggleEditPqrsAnonimo()"> Solicitud anónima</label>'+
    '<div id="pqrs-edit-anon-contact-block" style="'+(anon?'':'display:none;')+'margin-bottom:10px;padding:10px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd)">'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">Datos de contacto opcionales para notificación (no identifican al solicitante)</div>'+
    '<div class="fg">'+
    '<div class="fld"><label>Correo (notificación)</label><input type="email" id="pqrs-edit-anon-correo" value="'+escAttr(anon?e._qd_correo||'':'')+'" placeholder="correo@ejemplo.com"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="pqrs-edit-anon-tel" value="'+escAttr(anon?e._qd_telefono||'':'')+'" placeholder="3001234567"></div>'+
    '</div></div>'+
    '<div id="pqrs-edit-pn-block"'+(anon||tp!=='natural'?' style="display:none"':'')+'>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="pqrs-edit-pn-nombre" value="'+escAttr(e._pn_nombre||e._qd_nombre||'')+'"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="pqrs-edit-pn-identificacion" value="'+escAttr(e._pn_identificacion||e._qd_identificacion||'')+'"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="pqrs-edit-pn-correo" value="'+escAttr(e._pn_correo||e._qd_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="pqrs-edit-pn-telefono" value="'+escAttr(e._pn_telefono||e._qd_telefono||'')+'"></div>'+
    '</div></div>'+
    '<div id="pqrs-edit-pj-block"'+(anon||tp!=='juridica'?' style="display:none"':'')+'>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Razón social / entidad</label><input type="text" id="pqrs-edit-pj-empresa" value="'+escAttr(e._pj_empresa||'')+'"></div>'+
    '<div class="fld"><label>NIT</label><input type="text" id="pqrs-edit-pj-nit" value="'+escAttr(e._pj_nit||'')+'"></div>'+
    '<div class="fld"><label>Correo entidad</label><input type="email" id="pqrs-edit-pj-correo" value="'+escAttr(e._pj_correo||'')+'"></div>'+
    '<div class="fld"><label>Teléfono entidad</label><input type="tel" id="pqrs-edit-pj-telefono" value="'+escAttr(e._pj_telefono||'')+'"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Oficial / quien radica (nombre)</label><input type="text" id="pqrs-edit-pj-ofi-nombre" value="'+escAttr(e._qd_nombre&&e._qd_nombre!==e._pj_empresa?e._qd_nombre:'')+'"></div>'+
    '<div class="fld"><label>Identificación oficial</label><input type="text" id="pqrs-edit-pj-ofi-identificacion" value="'+escAttr(e._qd_identificacion&&e._qd_identificacion!==e._pj_nit?e._qd_identificacion:'')+'"></div>'+
    '<div class="fld"><label>Correo oficial</label><input type="email" id="pqrs-edit-pj-ofi-correo" value="'+escAttr(e._qd_correo&&e._qd_correo!==e._pj_correo?e._qd_correo:'')+'"></div>'+
    '<div class="fld"><label>Teléfono oficial</label><input type="tel" id="pqrs-edit-pj-ofi-telefono" value="'+escAttr(e._qd_telefono&&e._qd_telefono!==e._pj_telefono?e._qd_telefono:'')+'"></div>'+
    '</div></div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:10px"><input type="checkbox" id="pqrs-edit-prior"'+(e._pqrs_prioritaria?' checked':'')+'> ⚡ Prioritaria</label>'+
    '<div class="fld" style="margin-bottom:10px"><label>Asunto / tema</label><input type="text" id="pqrs-edit-asunto" value="'+escAttr(e.f_f1||'')+'"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Detalle</label><textarea id="pqrs-edit-detalle" style="width:100%;min-height:72px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif">'+escTextarea(e._pqrs_detalle||e._detalle_general||'')+'</textarea></div>'+
    '<div class="fg" style="margin-bottom:10px"><div class="fld"><label>Oficina destino</label><select id="pqrs-edit-oficina">'+ofOpts+'</select></div></div>'+
    // Sección de anexos: ver actuales + eliminar + añadir nuevos
    _pqrsEditAnexosHtml(rec)+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" data-pqrs-edit-submit="'+escAttr(expId)+'">Guardar cambios</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
    const btns=document.getElementById('pqrs-edit-medio-notif-btns');
    if(btns)btns.innerHTML=htmlMedioNotificacionBtns(rec._medio_notificacion||'','pqrs-edit','setEditPqrsMedioNotificacion');
    if(anon)toggleEditPqrsAnonimo();else toggleEditPqrsPersona();
    // Reiniciar estado de edición de anexos
    window._pqrsEditAnexosDel=new Set();
    window._pqrsEditAnexosNew=[];
    window._pqrsEditExpId=expId;
    ov.classList.add('on');
  }catch(err){
    console.error('openEditPqrsSecretariaModal',err);
    cerrarPqrsModalPrep();
    notif('No se pudo abrir el editor: '+(err&&err.message?err.message:'revise los datos'),'err');
  }
}
async function submitEditPqrsSecretaria(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e||!puedeEditarPqrsSecretaria(e)){notif('No puede editar esta PQRSD','err');return;}
  const fecha=puedeEditarFechaRadicacionPqrs()?((document.getElementById('pqrs-edit-fecha')||{}).value||e._fecha||hoy()):(e._fecha||hoy());
  const fechaSol=String((document.getElementById('pqrs-edit-fecha-solicitud')||{}).value||'').trim()||e._fecha_solicitud||fecha;
  const fechaTermino=String((document.getElementById('pqrs-edit-fecha-termino')||{}).value||'').trim();
  const tipo=(document.getElementById('pqrs-edit-tipo')||{}).value||e._tipo_solicitud||'Petición';
  const medio=normMedioRecepcionPqrs((document.getElementById('pqrs-edit-medio')||{}).value||'');
  const anon=!!((document.getElementById('pqrs-edit-anonimo')||{}).checked);
  const tipoPersona=anon?'natural':((document.getElementById('pqrs-edit-tipo-persona')||{}).value||'natural');
  const asunto=String((document.getElementById('pqrs-edit-asunto')||{}).value||'').trim();
  const oficina=(document.getElementById('pqrs-edit-oficina')||{}).value||'';
  const detalle=String((document.getElementById('pqrs-edit-detalle')||{}).value||'').trim();
  const medioNotif=medioNotificacionNorm((document.getElementById('pqrs-edit-medio-notif')||{}).value||'');
  const prior=!!((document.getElementById('pqrs-edit-prior')||{}).checked);
  if(!asunto){notif('Indique el asunto','err');return;}
  if(!oficina&&!pqrsPendienteTraslado(e)){notif('Seleccione oficina','err');return;}
  if(pqrsPendienteTraslado(e)&&oficina&&oficina!=='secretaria')e._pqrs_pendiente_traslado=false;
  if(fechaTermino&&fechaSol&&fechaTermino<fechaSol){notif('La fecha de término no puede ser anterior a la fecha de solicitud','err');return;}
  syncPqrsFechaSolicitud(e,fechaSol);
  e._pqrs_fecha_termino=fechaTermino||'';
  syncPqrsRadicacionFecha(e,fecha);
  e._tipo_solicitud=tipo;e.f_f2=medio;e._medio_notificacion=medioNotif;
  e._qd_anonimo=anon;e._tipo_persona=tipoPersona;e._pqrs_prioritaria=prior;
  (e.tasks||[]).forEach(t=>{
    if(t&&!t.eliminada&&taskEsAtenderPqrs(t,e))t.prioritaria=!!prior;
  });
  e.f_f1=asunto;e._pqrs_detalle=detalle;e._detalle_general=detalle;
  if(detalle)e._detalle_notas=JSON.stringify([{texto:detalle,autor:'Secretaría DEGUV',fecha:fecha}]);
  if(anon){
    const anonCorr=String((document.getElementById('pqrs-edit-anon-correo')||{}).value||'').trim().toLowerCase();
    const anonTel=String((document.getElementById('pqrs-edit-anon-tel')||{}).value||'').trim();
    e._pn_nombre='';e._pn_identificacion='';e._pn_correo='';e._pn_telefono='';
    e._pj_empresa='';e._pj_nit='';e._pj_correo='';e._pj_telefono='';
    e._qd_nombre='';e._qd_identificacion='';
    e._qd_correo=anonCorr;  // preservar correo anónimo para notificación
    e._qd_telefono=anonTel;
  }else if(tipoPersona==='juridica'){
    e._pj_empresa=String((document.getElementById('pqrs-edit-pj-empresa')||{}).value||'').trim();
    e._pj_nit=String((document.getElementById('pqrs-edit-pj-nit')||{}).value||'').trim();
    e._pj_correo=String((document.getElementById('pqrs-edit-pj-correo')||{}).value||'').trim();
    e._pj_telefono=String((document.getElementById('pqrs-edit-pj-telefono')||{}).value||'').trim();
    e._qd_nombre=String((document.getElementById('pqrs-edit-pj-ofi-nombre')||{}).value||'').trim();
    e._qd_identificacion=String((document.getElementById('pqrs-edit-pj-ofi-identificacion')||{}).value||'').trim();
    e._qd_correo=String((document.getElementById('pqrs-edit-pj-ofi-correo')||{}).value||'').trim();
    e._qd_telefono=String((document.getElementById('pqrs-edit-pj-ofi-telefono')||{}).value||'').trim();
    e._pn_nombre='';e._pn_identificacion='';e._pn_correo='';e._pn_telefono='';
  }else{
    e._pn_nombre=String((document.getElementById('pqrs-edit-pn-nombre')||{}).value||'').trim();
    e._pn_identificacion=String((document.getElementById('pqrs-edit-pn-identificacion')||{}).value||'').trim();
    e._pn_correo=String((document.getElementById('pqrs-edit-pn-correo')||{}).value||'').trim();
    e._pn_telefono=String((document.getElementById('pqrs-edit-pn-telefono')||{}).value||'').trim();
    e._qd_nombre=e._pn_nombre;e._qd_identificacion=e._pn_identificacion;e._qd_correo=e._pn_correo;e._qd_telefono=e._pn_telefono;
    e._pj_empresa='';e._pj_nit='';e._pj_correo='';e._pj_telefono='';
  }
  const ofiAnt=e._pqrs_oficina||'';
  if(oficina!==ofiAnt){
    e._pqrs_oficina=oficina;
    e._pqrs_traslado_fecha=hoy();
    e._pqrs_traslado_por='Secretaría DEGUV';
    if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
    e._pqrs_historial.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Corrección de oficina destino por Secretaría',oficina:oficina,oficinaAnterior:ofiAnt,por:'Secretaría DEGUV'});
    syncPqrsTareaTrasTraslado(e,oficina,'Corrección de oficina destino por Secretaría');
  }else if(e._pqrs_oficina==='guaviare')ensureTareaPqrsNca(e);
  else if(e._pqrs_oficina&&e._pqrs_oficina!=='secretaria')ensureTareaPqrsOficina(e,e._pqrs_oficina);
  // ── Procesamiento de anexos ──────────────────────────────────────────
  const delSet=window._pqrsEditAnexosDel||new Set();
  const nuevosFiles=window._pqrsEditAnexosNew||[];
  // Filtrar los anexos eliminados
  const attsActuales=Array.isArray(e._pqrs_gmail_attachments)?e._pqrs_gmail_attachments:[];
  const attsRestantes=attsActuales.filter((_,i)=>!delSet.has(i));
  // Subir nuevos archivos si hay token
  if(nuevosFiles.length&&typeof driveUploadInstitutional==='function'){
    const usaDrive=typeof DRIVE_INST_DEPTOS!=='undefined'&&DRIVE_INST_DEPTOS.has('guaviare');
    const hayTok=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid());
    if(usaDrive&&hayTok){
      const nombreCarpeta=e._qd_nombre||e._pn_nombre||e._pj_empresa||expId;
      const fechaRef=e._fecha||e._fecha_solicitud||'';
      for(const f of nuevosFiles){
        try{
          const up=await driveUploadInstitutional(f,'ANEXO PQRSD '+expId+' '+f.name,f.type||'application/octet-stream','radicacion_ventanilla',expId,nombreCarpeta,fechaRef,{expediente:e,uploadTarget:'solicitud'});
          attsRestantes.push({nombre:f.name,driveLink:up.driveLink,previewLink:up.previewLink||'',fileId:up.fileId||'',tipo:'archivo'});
        }catch(err){notif('No se pudo subir '+f.name+': '+String(err.message||err).slice(0,60),'warn');}
      }
    }else{
      notif('Para subir nuevos anexos conecte su correo (Gmail/Drive)','warn');
    }
  }
  if(attsRestantes.length!==attsActuales.length||nuevosFiles.length){
    e._pqrs_gmail_attachments=attsRestantes;
    if(attsRestantes.length){
      e._pqrs_solicitud_link=attsRestantes[0].driveLink||attsRestantes[0].url||'';
      e._pqrs_solicitud_archivo=attsRestantes.map(a=>a.nombre||a.name||'Anexo').join('; ');
    }else{
      e._pqrs_solicitud_link='';e._pqrs_solicitud_archivo='';
    }
  }
  window._pqrsEditAnexosDel=new Set();window._pqrsEditAnexosNew=[];
  // ────────────────────────────────────────────────────────────────────
  upsertPersonaCatalog(e);
  logAudit('Editó PQRSD ['+expId+']','pqrsd',expId);
  persistExpedienteGranular(e,true);
  closeTaskModal();
  notif('PQRSD actualizada','ok');
  renderBandejaDepto();
  refreshPqrsDetalleViews(expId);
  renderSecretariaPqrs();
  renderPqrsOficinaInbox();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
}
function openAsignarPqrsOficinaModal(expId){
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  const oficina=e._pqrs_oficina||getPqrsOficinaActiva();
  if(!oficinaPuedeAsignarPqrs(oficina)){notif('Esta oficina no tiene contratistas de apoyo configurados para asignar','err');return;}
  abrirPqrsModalPrep();
  let responsables=oficina==='guaviare'?getContratistasOficinaPqrs('guaviare'):getContratistasOficinaPqrs(oficina);
  if(!responsables.length){notif('No hay responsables configurados para esta oficina','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Asignar PQRSD · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const opts=responsables.map(n=>'<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>').join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Oficina: <strong>'+escAttr(labelOficina(oficina))+'</strong></div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(e.f_f1||e._pqrs_detalle||'PQRSD')+'</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Responsable que atenderá<span class="req-star">*</span></label>'+
    '<select id="pqrs-ofi-resp-sel" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+opts+'</select></div>'+
    htmlPqrsAdjuntosDrive(e)+
    (e._pqrs_solicitud_archivo?'<div style="font-size:12px;margin-bottom:8px;color:var(--tx2)">📄 Referencia: '+escAttr(e._pqrs_solicitud_archivo)+'</div>':'')+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitAsignarPqrsOficina(\''+escAttr(expId)+'\')">Confirmar asignación</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'asignarPqrsOfi',expId};
}
function submitAsignarPqrsOficina(expId){
  const sel=document.getElementById('pqrs-ofi-resp-sel');
  const resp=sel?sel.value:'';
  if(!resp){notif('Seleccione responsable','err');return;}
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  e._pqrs_responsable_oficina=resp;
  e._pqrs_estado_oficina='asignado';
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'asignacion_oficina',fecha:hoy(),nota:'Asignado a responsable de la oficina',oficina:e._pqrs_oficina});
  const {vence,plazoDias}=pqrsPlazoTaskMeta(e);
  const prior=!!e._pqrs_prioritaria;
  const actNombre='Atender PQRSD: '+(e.f_f1||e._tipo_solicitud||'Solicitud');
  const tk=normalizeTask({
    id:genTaskId(),actividad:actNombre,detalle:e._pqrs_detalle||'',desc:actNombre,
    responsable:resp,responsables:[resp],asignados:[{nombre:resp,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}],
    entregaModo:'individual',plazoDias:plazoDias,vence:vence,prioritaria:prior,
    comentarios:[],historial:[{tipo:'asignacion',fecha:hoy(),por:taskComentarioAutor(),nota:'PQRSD asignado desde oficina '+labelOficina(e._pqrs_oficina)}],soportes:[],notasDoc:[]
  });
  if(!Array.isArray(e.tasks))e.tasks=[];
  const existIdx=e.tasks.findIndex(t=>t&&!t.eliminada&&t.actividad&&String(t.actividad).startsWith('Atender PQRSD'));
  if(existIdx>=0)e.tasks[existIdx]=normalizeTask({...e.tasks[existIdx],responsable:resp,responsables:[resp],asignados:[{nombre:resp,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}],eliminada:false,prioritaria:prior,vence:vence,plazoDias:plazoDias});
  else e.tasks.push(tk);
  persistExpedienteGranular(e);
  closeTaskModal();
  notif('PQRSD asignado a '+resp,'ok');
  renderPqrsOficinaInbox();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('pg-sec')&&document.getElementById('pg-sec').classList.contains('on'))renderSecretariaPqrs();
}
function openTrasladoPqrsInicialModal(expId){
  const e=exps.find(x=>x._exp===expId);
  if(!e||!esPqrsSecretaria(e)){notif('PQRSD no encontrado','err');return;}
  if(!puedeTrasladarPqrsInicial(e)){notif('No puede trasladar esta PQRSD','err');return;}
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Traslado inicial · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const opts=OFICINAS_DEGUV.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Radicada sin oficina asignada. Seleccione la oficina competente.</div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(e.f_f1||e._pqrs_detalle||'PQRSD')+'</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Oficina destino<span class="req-star">*</span></label>'+
    '<select id="pqrs-trasl-ini-ofi-sel" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+opts+'</select></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Motivo (opcional)</label><input type="text" id="pqrs-trasl-ini-motivo" placeholder="Ej. Competencia de la oficina" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitTrasladoPqrsInicial(\''+escAttr(expId)+'\')">Confirmar traslado</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'trasladoPqrsIni',expId};
}
async function submitTrasladoPqrsInicial(expId){
  const sel=document.getElementById('pqrs-trasl-ini-ofi-sel');
  const nuevaOfi=sel?sel.value:'';
  const motivo=String((document.getElementById('pqrs-trasl-ini-motivo')||{}).value||'').trim();
  if(!nuevaOfi){notif('Seleccione oficina destino','err');return;}
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  if(!puedeTrasladarPqrsInicial(e)){notif('No puede trasladar esta PQRSD','err');return;}
  const por=esSecretaria()?'Secretaría DEGUV':(esDirectorDsDeguv()?'DS DEGUV':'Administrador');
  e._pqrs_pendiente_traslado=false;
  e._pqrs_oficina=nuevaOfi;
  e._pqrs_traslado_fecha=hoy();
  e._pqrs_traslado_por=por;
  e._pqrs_responsable_oficina=typeof getEncargadoOficina==='function'?getEncargadoOficina(nuevaOfi):'';
  e._pqrs_estado_oficina='pendiente';
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'traslado_oficina',fecha:hoy(),nota:motivo||'Traslado inicial a oficina competente',oficina:nuevaOfi,oficinaAnterior:'secretaria',por:por});
  syncPqrsTareaTrasTraslado(e,nuevaOfi,motivo);
  await tryReenvioPqrsCorreoTraslado(e,nuevaOfi,expId);
  persistExpedienteGranular(e);
  closeTaskModal();
  notif('PQRSD trasladada a '+labelOficina(nuevaOfi),'ok');
  renderBandejaDepto();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
  if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
}
function openTrasladoPqrsInterOficinaModal(expId){
  const e=exps.find(x=>x._exp===expId);
  if(!e||!esPqrsSecretaria(e)){notif('PQRSD no encontrado','err');return;}
  if(!puedeTrasladarPqrs(e)){notif('No puede trasladar este PQRSD. Solo la oficina que lo tiene asignado puede reasignarlo.','err');return;}
  abrirPqrsModalPrep();
  const actual=e._pqrs_oficina||'';
  const destinos=OFICINAS_DEGUV.filter(o=>o.id!==actual);
  if(!destinos.length){notif('No hay otra oficina disponible','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Trasladar PQRSD · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const opts=destinos.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
  body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Oficina actual: <strong>'+escAttr(labelOficina(actual))+'</strong></div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(e.f_f1||e._pqrs_detalle||'PQRSD')+'</div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Nueva oficina destino<span class="req-star">*</span></label>'+
    '<select id="pqrs-trasl-ofi-sel" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+opts+'</select></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Motivo (opcional)</label><input type="text" id="pqrs-trasl-motivo" placeholder="Ej. Reasignación por competencia" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" onclick="submitTrasladoPqrsInterOficina(\''+escAttr(expId)+'\')">Confirmar traslado</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'trasladoPqrsOfi',expId};
}
function submitTrasladoPqrsInterOficina(expId){
  const sel=document.getElementById('pqrs-trasl-ofi-sel');
  const nuevaOfi=sel?sel.value:'';
  const motivo=String((document.getElementById('pqrs-trasl-motivo')||{}).value||'').trim();
  if(!nuevaOfi){notif('Seleccione oficina destino','err');return;}
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  if(!puedeTrasladarPqrs(e)){notif('No puede trasladar este PQRSD. Solo la oficina que lo tiene asignado puede reasignarlo.','err');return;}
  const anterior=e._pqrs_oficina||'';
  if(nuevaOfi===anterior){notif('Seleccione una oficina diferente','err');return;}
  e._pqrs_oficina=nuevaOfi;
  e._pqrs_traslado_fecha=hoy();
  e._pqrs_traslado_por=esSecretaria()?'Secretaría DEGUV':(labelOficina(getPqrsOficinaActiva())||'Oficina');
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  e._pqrs_historial.push({tipo:'traslado_oficina',fecha:hoy(),nota:motivo||'Reasignación entre oficinas',oficina:nuevaOfi,oficinaAnterior:anterior,por:e._pqrs_traslado_por});
  syncPqrsTareaTrasTraslado(e,nuevaOfi,motivo);
  persistExpedienteGranular(e);
  closeTaskModal();
  notif('PQRSD trasladado a '+labelOficina(nuevaOfi),'ok');
  renderBandejaDepto();
  renderPqrsOficinaInbox();
  renderSecretariaPqrs();
  if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
}
function anonimizarParaCiudadano(txt){
  if(!txt)return txt;
  let s=String(txt);
  getAllResponsables().forEach(n=>{if(n)s=s.split(n).join('');});
  DEPTOS.forEach(d=>getInstructoresCfg(d.id).forEach(i=>{if(i.nombre)s=s.split(i.nombre).join('');}));
  s=s.replace(/\b(?:Traslado|Asignado|Aprobado|Por)\s*[:\-]?\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2}/gi,'');
  s=s.replace(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?/g,'');
  s=s.replace(/\s{2,}/g,' ').replace(/\s+([,.])/g,'$1').trim();
  return s;
}
function ciudadanoEventoLabel(h){
  if(!h)return'Actualización del trámite';
  if(h.tipo==='radicacion')return 'Radicación de la solicitud';
  if(h.tipo==='traslado_oficina'){
    const dest=labelOficina(h.oficina||'');
    return dest?'Traslado a '+dest:'Traslado a oficina competente';
  }
  if(h.tipo==='asignacion_oficina')return 'Asignación para atención';
  if(h.tipo==='respuesta_oficina')return 'Respuesta registrada';
  // Sprint 10: nuevos tipos workflow
  if(h.tipo==='entrega_respuesta_nca')return 'Respuesta en proceso de revisión interna';
  if(h.tipo==='revision_nca_aprobado')return 'Respuesta aprobada — en preparación para envío';
  if(h.tipo==='revision_nca_aprobado_oficio')return 'Respuesta aprobada — pendiente firma oficial';
  if(h.tipo==='revision_nca_rechazado')return ''; // not shown to citizen
  if(h.tipo==='vital_firma_completada')return 'Documento oficial firmado — pendiente notificación';
  if(h.tipo==='notificacion_correo')return 'Respuesta notificada al ciudadano por correo';
  if(h.tipo==='notificacion_radicacion')return 'Radicación notificada al ciudadano por correo';
  if(h.tipo==='notificacion_excepcion')return 'Notificación por correo — excepción registrada';
  if(h.tipo==='recepcion_nca')return 'Recibido para trámite en NCA DEGUV';
  if(h.tipo==='informativa')return 'Solicitud informativa — atendida';
  return 'Actualización del trámite';
}
function ciudadanoNotaPublica(h,nota){
  if(h&&h.tipo==='asignacion_oficina')return'';
  nota=anonimizarParaCiudadano(String(nota||'').trim());
  if(!nota)return'';
  if(h&&h.tipo==='traslado_oficina'){
    const m=nota.match(/(?:motivo|nota)\s*[:\-]?\s*(.+)$/i);
    return m?m[1].trim():(/motivo/i.test(nota)?nota:'');
  }
  if(/^(traslad|asign|aprob|recib|actividad)/i.test(nota)&&nota.length<90)return'';
  return nota;
}
function ciudadanoTaskEventoLabel(h){
  if(!h)return'';
  if(h.tipo==='traslado'||h.tipo==='asignacion_extra')return 'Actividad reasignada en el departamento';
  if(h.tipo==='asignacion')return 'Actividad asignada para gestión';
  if(h.tipo==='verificacion')return 'Respuesta verificada';
  if(h.tipo==='reporte'||h.tipo==='entrega')return 'Entrega reportada — en revisión';
  if(h.tipo==='solicitud_traslado')return 'Solicitud de reasignación en trámite';
  return'';
}
function taskDocAprobadoCiudadano(t){
  t=normalizeTask(t);
  if(t.eliminada||estadoTask(t)!=='Atendida')return false;
  return !!(t.verificadoPor||(t.historial||[]).some(h=>h.tipo==='verificacion'));
}
function getDocsAprobadosCiudadano(e){
  const docs=[];
  (e.tasks||[]).forEach(t=>{
    if(!taskDocAprobadoCiudadano(t))return;
    (t.soportes||[]).forEach(s=>{
      const u=s.preview||s.url||'';
      if(!u)return;
      docs.push({url:u,preview:s.preview||s.url,label:s.label||'Respuesta aprobada',tipo:(t.desc||t.actividad||'Entrega de actividad').substring(0,80),mime:s.mime||'',fecha:t.fechaAtendida||''});
    });
  });
  return docs;
}
function openCiudadanoDocViewer(url,label,externalUrl){
  const parsed=parseDrivePreviewUrl(url);
  const previewUrl=parsed.preview||parsed.url||url||'';
  const openUrl=externalUrl||parsed.url||url||'';
  const ov=document.getElementById('ciudadano-doc-overlay');
  const ifr=document.getElementById('ciudadano-doc-iframe');
  const tit=document.getElementById('ciudadano-doc-tit');
  const foot=document.getElementById('ciudadano-doc-foot');
  if(tit)tit.textContent=label||'Documento';
  if(ifr)ifr.src=previewUrl;
  if(foot){
    foot.innerHTML='<span style="font-size:11px;color:var(--tx2);flex:1">Si la vista previa pide acceso, abra el documento en una pestaña nueva.</span>'+
      (openUrl?'<button type="button" class="btn bsm bp" onclick="window.open(\''+escAttr(openUrl)+'\',\'_blank\',\'noopener\')">↗ Abrir documento directamente</button>':'');
  }
  if(ov)ov.classList.add('on');
}
function closeCiudadanoDocViewer(){
  const ov=document.getElementById('ciudadano-doc-overlay');
  const ifr=document.getElementById('ciudadano-doc-iframe');
  const foot=document.getElementById('ciudadano-doc-foot');
  if(ov)ov.classList.remove('on');
  if(ifr)ifr.src='';
  if(foot)foot.innerHTML='';
}
function buscarExpCiudadano(){
  const q=String((document.getElementById('ciudadano-exp')||{}).value||'').trim();
  const box=document.getElementById('ciudadano-resultado');
  if(!box)return;
  if(!q){box.innerHTML='<div style="color:var(--tx3);font-size:12px">Ingrese el número de su trámite o PQRSD.</div>';return;}
  window._ciudadanoUltExp=q;
  const e=exps.find(x=>String(x._exp||'').trim().toLowerCase()===q.toLowerCase());
  if(!e){box.innerHTML='<div style="padding:12px;background:var(--rdl);border:1px solid #e8a8a8;border-radius:var(--r);color:var(--rd);font-size:13px">No se encontró un trámite con el número «'+escAttr(q)+'».</div>';return;}
  const esPqrs=esPqrsSecretaria(e)||esTramitePqrs(e._tramite);
  if(esPqrs)normalizePqrsOficinaFields(e);
  const tram=getTram(e._tramite,e);
  const est=esPqrs?getPqrsEstadoDisplay(e):(e._estado||'Solicitud');
  const eventos=[];
  if(esPqrs){
    const fs=e._fecha_solicitud||'';
    const fr=e._fecha||'';
    if(fs)eventos.push({fecha:fs,html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(fs)+'</div><div class="tl-nota"><strong>Solicitud presentada por el ciudadano</strong></div></div>'});
    const hist=(e._pqrs_historial||[]).slice();
    if(!hist.some(h=>h.tipo==='radicacion')&&fr)hist.push({tipo:'radicacion',fecha:fr,nota:''});
    hist.sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
    hist.forEach(h=>{
      const lbl=ciudadanoEventoLabel(h);
      const nota=ciudadanoNotaPublica(h,h.nota||'');
      eventos.push({fecha:h.fecha||fr,html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(h.fecha||fr)+'</div><div class="tl-nota"><strong>'+escAttr(lbl)+'</strong>'+(nota?(': '+escAttr(nota)):'')+'</div></div>'});
    });
  }else{
    const fechas=JSON.parse(e._fechas_estado||'{}');
    Object.entries(fechas).forEach(([st,fc])=>{if(fc)eventos.push({fecha:fc,html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(fc)+'</div><div class="tl-nota">Estado: <strong>'+escAttr(st)+'</strong></div></div>'});});
  }
  (e.tasks||[]).forEach(t=>{
    t=normalizeTask(t);
    if(t.eliminada)return;
    (t.historial||[]).forEach(h=>{
      const lbl=ciudadanoTaskEventoLabel(h);
      if(!lbl)return;
      eventos.push({fecha:h.fecha||t.fechaReportada||'',html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(h.fecha||'')+'</div><div class="tl-nota">'+escAttr(lbl)+'</div></div>'});
    });
    const estT=estadoTask(t);
    if(estT==='Atendida'&&taskDocAprobadoCiudadano(t))eventos.push({fecha:t.fechaAtendida||t.fechaReportada||'',html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(t.fechaAtendida||t.fechaReportada||'')+'</div><div class="tl-nota"><strong>Respuesta aprobada y publicada</strong></div></div>'});
    else if(estT==='Por verificar')eventos.push({fecha:t.fechaReportada||'',html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(t.fechaReportada||'')+'</div><div class="tl-nota"><strong>Respuesta en revisión</strong></div></div>'});
    else if(estT==='En ejecución'||estT==='Vencida'||estT==='Por corregir')eventos.push({fecha:t.vence||'',html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(t.vence||'')+'</div><div class="tl-nota">Actividad en gestión</div></div>'});
  });
  eventos.sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
  const tlHtml=eventos.length?eventos.map(ev=>ev.html).join(''):'<div style="font-size:12px;color:var(--tx3)">Sin movimientos registrados aún.</div>';
  const docsTask=getDocsAprobadosCiudadano(e);
  const docsPqrsSol=getDocsPqrsSolicitudCiudadano(e);
  const docsPqrs=getDocsPqrsRespuestaCiudadano(e);
  const docsTram=getDocsTramiteCiudadano(e);
  const docs=[...docsPqrsSol];
  docsPqrs.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  docsTram.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  docsTask.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  const docsHtml=docs.length?docs.map(function(d){
    const ico=(d.mime||'').includes('pdf')||String(d.url||'').includes('pdf')?'📄':'📎';
    const nom=d.label||'Documento';
    const tipo=d.tipo||'Archivo adjunto';
    return '<button type="button" class="ciudadano-doc-card" onclick="openCiudadanoDocViewer(\''+escAttr(d.preview||d.url)+'\',\''+escAttr(nom)+'\')" title="'+escAttr(nom+' — '+tipo)+'">'+
      '<span class="ciudadano-doc-card-ico">'+ico+'</span>'+
      '<span class="ciudadano-doc-card-body">'+
      '<span class="ciudadano-doc-card-nom">'+escAttr(nom)+'</span>'+
      '<span class="ciudadano-doc-card-tipo">'+escAttr(tipo)+'</span>'+
      '</span></button>';
  }).join(''):'<div style="font-size:11px;color:var(--tx3);text-align:center;padding:8px">'+(pqrsEstaCerrada(e)&&esPqrs?'Sin documentos de respuesta adjuntos':'Sin documentos aprobados aún')+'</div>';
  // Sprint 10: response summary for closed PQRSDs
  let respuestaHtml='';
  if(esPqrs&&pqrsEstaCerrada(e)){
    const wf=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
    const cuerpo=wf.cuerpo||e._pqrs_respuesta_nota||'';
    const fechaResp=wf.fecha_respuesta||e._pqrs_respuesta_fecha||'';
    const oficio=wf.oficio||e._pqrs_respuesta_oficio||'';
    const canal=wf.canal||e._pqrs_respuesta_medio||'';
    const canalLabel={correo:'Correo electrónico',whatsapp:'WhatsApp',presencial:'Presencial/Ventanilla',fisica:'Correo físico',pagina:'Página web',aviso:'Por aviso'}[canal]||canal||'';
    respuestaHtml='<div style="margin-bottom:12px;padding:12px;background:var(--gnl);border:1px solid #b2dfdb;border-radius:var(--r);border-left:4px solid var(--gn)">'+
      '<div style="font-size:12px;font-weight:700;color:var(--gn);margin-bottom:6px">✅ Esta solicitud fue respondida</div>'+
      (fechaResp?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Fecha de respuesta: <strong>'+fmtF(fechaResp)+'</strong></div>'):'')+
      (oficio?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">N° de oficio: <strong>'+escAttr(oficio)+'</strong></div>'):'')+
      (canalLabel?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Canal de notificación: <strong>'+escAttr(canalLabel)+'</strong></div>'):'')+
      (cuerpo?('<div style="font-size:12px;margin-top:8px;padding:8px;background:#fff;border-radius:var(--r);white-space:pre-wrap;color:var(--tx)">'+escAttr(cuerpo)+'</div>'):'')+
      '</div>';
  }

  box.innerHTML='<div style="padding:14px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px">'+
    '<div style="font-size:16px;font-weight:700;margin-bottom:6px">'+escAttr(e._exp)+'</div>'+
    '<div style="font-size:13px;margin-bottom:4px">Trámite: <strong>'+escAttr(tram?tram.nombre:(esPqrs?'PQRSD':'—'))+'</strong></div>'+
    (esPqrs?('<div style="font-size:13px;margin-bottom:4px">Tipo: <strong>'+escAttr(e._tipo_solicitud||'PQRSD')+'</strong></div>'):'')+
    '<div style="font-size:13px;margin-bottom:4px">Estado actual: <strong>'+escAttr(est)+'</strong></div>'+
    (esPqrs&&e.f_f1?('<div style="font-size:12px;color:var(--tx2)">Asunto: '+escAttr(e.f_f1)+'</div>'):'')+
    '</div>'+
    respuestaHtml+
    '<div class="ciudadano-result-layout">'+
    '<div><div class="slbl" style="font-size:14px">Línea de tiempo</div><div class="ciudadano-timeline">'+tlHtml+'</div></div>'+
    '<div class="ciudadano-docs-col"><div class="slbl" style="font-size:12px;margin-bottom:6px">Documentos</div>'+docsHtml+'</div>'+
    '</div>';
}
function instructorOficinasBoxes(i,ins,deptoId){
  deptoId=deptoId||deptoCfg;
  if(ins.rol!=='contratista')return '';
  if(!muestraOficinasContratistaIns(deptoId))return '';
  const ofs=ins.oficinas||[];
  const dep=jsStr(deptoId);
  return '<div style="margin:4px 0 8px 32px;padding:8px 10px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd)">'+
    '<div style="font-size:10px;font-weight:600;color:var(--tx2);margin-bottom:4px">Oficinas DEGUV (PQRSD / asignación)</div>'+
    OFICINAS_DEGUV.filter(o=>o.id!=='secretaria'&&o.id!=='guaviare').map(o=>'<label style="display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;font-size:11px;cursor:pointer"><input type="checkbox"'+(ofs.includes(o.id)?' checked':'')+' onchange="toggleInstructorOficinaDepto(\''+dep+'\','+i+',\''+escAttr(o.id)+'\',this.checked)"> '+escAttr(o.nombre)+'</label>').join('')+
    '</div>';
}
function toggleInstructorOficina(i,oficinaId,checked){
  cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
  const ins=cfg.instructores[i];if(!ins||ins.rol!=='contratista')return;
  if(!instructorEditableContratista(ins)&&!esAdminModoGlobal()){notif('No puede modificar esta persona','err');return;}
  if(!Array.isArray(ins.oficinas))ins.oficinas=[];
  if(checked){if(!ins.oficinas.includes(oficinaId))ins.oficinas.push(oficinaId);}
  else ins.oficinas=ins.oficinas.filter(x=>x!==oficinaId);
  saveLS();
}

// ================================================================