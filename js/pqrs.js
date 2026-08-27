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
  poblarSecOficinaRemitenteSelect();
  updateSecFechaRadicVisibility();
  if(typeof resetSecRadicacionFormulario==='function'&&secFormularioPristine())resetSecRadicacionFormulario();
  else if(typeof initSecMedioNotificacion==='function')initSecMedioNotificacion(true);
  renderSecGmailBloqueoRadicacion();
  if(typeof aplicarSugerenciaNumeroPqrsSec==='function')aplicarSugerenciaNumeroPqrsSec();
  if(typeof toggleSecInterna==='function')toggleSecInterna();
}
function poblarSecOficinaRemitenteSelect(){
  const sel=document.getElementById('sec-oficina-remitente');
  if(!sel)return;
  const cur=String(sel.value||'').trim();
  const list=(typeof PQRS_OFICINAS_REMITENTES_INTERNAS!=='undefined'&&Array.isArray(PQRS_OFICINAS_REMITENTES_INTERNAS))
    ?PQRS_OFICINAS_REMITENTES_INTERNAS
    :['Dirección General','Secretaría General','Subdirección Normatización','Subdirección Recursos Naturales','Oficina Asesora de Planeación','Control Interno','Subdirección Administrativa y Financiera','Seccional Guainía','Seccional Vaupés','Contabilidad'];
  sel.innerHTML='<option value="">— Seleccione oficina remitente —</option>'+list.map(function(n){
    return '<option value="'+escAttr(n)+'"'+(cur===n?' selected':'')+'>'+escAttr(n)+'</option>';
  }).join('');
}
function esSecPqrsInternaUi(){
  return !!(document.getElementById('sec-interna')&&document.getElementById('sec-interna').checked);
}
function toggleSecInterna(){
  const interna=esSecPqrsInternaUi();
  const intBlock=document.getElementById('sec-interna-block');
  if(intBlock)intBlock.style.display=interna?'':'none';
  const solWrap=document.getElementById('sec-solicitante-wrap');
  if(solWrap)solWrap.style.display=interna?'none':'';
  const medioNotif=document.getElementById('sec-medio-notif-wrap');
  if(medioNotif)medioNotif.style.display=interna?'none':'';
  if(interna){
    const anon=document.getElementById('sec-anonimo');
    if(anon){anon.checked=false;}
    poblarSecOficinaRemitenteSelect();
    // Limpia datos de ciudadano al pasar a interna
    ['sec-pn-nombre','sec-pn-identificacion','sec-pn-correo','sec-pn-telefono','sec-pj-empresa','sec-pj-nit','sec-pj-correo','sec-pj-telefono','sec-pj-ofi-nombre','sec-pj-ofi-identificacion','sec-pj-ofi-correo','sec-pj-ofi-telefono','sec-anon-correo','sec-anon-tel'].forEach(function(id){
      const el=document.getElementById(id);if(el)el.value='';
    });
    const tp=document.getElementById('sec-tipo-persona');if(tp)tp.value='';
    const mn=document.getElementById('sec-medio-notif');if(mn)mn.value='';
  }else{
    const rem=document.getElementById('sec-oficina-remitente');if(rem)rem.value='';
  }
  if(typeof toggleSecAnonimo==='function')toggleSecAnonimo();
  else if(typeof toggleSecPersona==='function')toggleSecPersona();
}
function toggleSecAnonimo(){
  if(esSecPqrsInternaUi()){
    const anonBlock=document.getElementById('sec-anon-contact-block');
    if(anonBlock)anonBlock.style.display='none';
    toggleSecPersona();
    return;
  }
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
  (typeof sstSolicitarDriveParaPqrs==='function'?sstSolicitarDriveParaPqrs(null):(typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar({requireSecretaria:true,force:true}):Promise.resolve(true))).then(function(ok){
    if(!ok)return;
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
  });
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
  const interna=document.getElementById('sec-interna');if(interna)interna.checked=false;
  const rem=document.getElementById('sec-oficina-remitente');if(rem)rem.value='';
  window._secAnexoFiles=[];secAnexoRenderList();
  resetSecRadicacionFormulario();
  toggleSecInterna();
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
  if(typeof sstCargaShow==='function'){
    sstCargaShow({
      title:soloRadicar?'Radicando PQRSD':'Radicando y trasladando',
      message:'Generando soporte PDF y registrando la solicitud…',
      sub:'Espere mientras se completa la carga',
      pct:null
    });
    return;
  }
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
  if(typeof sstCargaDone==='function'&&window._confirmRadicacionLoading){
    sstCargaDone({title:opts.title||'PQRSD radicada',message:msg,autoCloseMs:typeof SST_MSG_AUTO_MS!=='undefined'?SST_MSG_AUTO_MS:1000,holdMs:220});
    return;
  }
  if(typeof confirmExito==='function'){
    confirmExito({
      title:opts.title||'PQRSD radicada',
      message:msg,
      tone:'radicacion',
      hideFooter:false,
      confirmLabel:'Entendido',
      autoCloseMs:typeof SST_MSG_AUTO_MS!=='undefined'?SST_MSG_AUTO_MS:1000
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
  const interna=!!((document.getElementById('sec-interna')||{}).checked);
  const oficinaRemitente=interna?String((document.getElementById('sec-oficina-remitente')||{}).value||'').trim():'';
  const anon=interna?false:!!((document.getElementById('sec-anonimo')||{}).checked);
  const tipoPersonaRaw=anon||interna?'':String((document.getElementById('sec-tipo-persona')||{}).value||'').trim();
  // Correo/tel para anónimo con datos de notificación (si los ingresó)
  const anonCorreo=anon?String((document.getElementById('sec-anon-correo')||{}).value||'').trim().toLowerCase():'';
  const anonTel=anon?String((document.getElementById('sec-anon-tel')||{}).value||'').trim():'';
  let nombre='',ident='',correo=anonCorreo,tel=anonTel;
  const pjFields={};
  if(interna){
    if(!oficinaRemitente){notif('Seleccione la oficina remitente','err');return;}
    nombre=oficinaRemitente;
  }else if(!anon){
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
  const medioNotif=interna?'':medioNotificacionNorm((document.getElementById('sec-medio-notif')||{}).value||'');
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
  if(!fechaSol){notif('Indique la fecha de solicitud','err');return;}
  if(!tipoRaw){notif('Seleccione el tipo de solicitud','err');return;}
  if(!medioRaw){notif('Seleccione el medio de recepción','err');return;}
  if(!interna&&!anon&&!tipoPersonaRaw){notif('Seleccione el tipo de persona','err');return;}
  if(!interna&&!anon){
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
  const tipoPersona=interna||anon?'natural':tipoPersonaRaw;
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
  const hist=[{tipo:'radicacion',fecha:fecha,nota:(interna?'Radicado interno (oficina remitente: '+oficinaRemitente+'). ':'')+(soloRadicar?'Radicado sin traslado — pendiente asignación de oficina':'Radicado por Secretaría DEGUV'),oficina:''}];
  if(!soloRadicar){
    if(oficina==='secretaria'){
      hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Asignado a Secretaría DEGUV para gestión directa',oficina:'secretaria',oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
    }else{
      hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Traslado inicial a oficina competente',oficina:oficina,oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
    }
  }
  const gmailMsgId=window._gmailPendingMsgId||'';
  const anexoFiles=Array.isArray(window._secAnexoFiles)&&window._secAnexoFiles.length?window._secAnexoFiles:[];
  let reenvioOficinaOk=false;
  let reenvioDsOk=false;
  // ── PASO 1: Guardar en Firestore primero (sin Drive) ────────────────────
  const gmailEmailData=(window._gmailPendingEmailData&&typeof window._gmailPendingEmailData==='object')
    ?window._gmailPendingEmailData:null;
  const tipoRadicacion=gmailMsgId?'radicacion_correo':(typeof tipoRadicacionDesdeMedioPqrs==='function'?tipoRadicacionDesdeMedioPqrs(medio):(medio==='Ventanilla'?'radicacion_ventanilla':'radicacion_otro'));
  const encargadoOfi=soloRadicar?'':(typeof getEncargadoOficina==='function'?getEncargadoOficina(oficina):'');
  const data=normalizePqrsOficinaFields({
    _depto:'guaviare',_tramite:tramId,_exp:expId,_estado:'En trámite',_fecha:fecha,_fecha_solicitud:fechaSol,_pqrs_fecha_termino:fechaTermino||'',
    _fechas_estado:JSON.stringify({Solicitud:fechaSol,'En trámite':fecha}),
    _es_pqrs:true,_es_queja:true,_tipo_solicitud:tipo,
    _tipo_persona:tipoPersona,
    _pqrs_interna:!!interna,
    _pqrs_oficina_remitente:interna?oficinaRemitente:'',
    _medio_notificacion:medioNotif,_pqrs_prioritaria:prioritaria,
    _qd_anonimo:anon,_qd_nombre:interna?oficinaRemitente:nombre,_qd_identificacion:interna?'':ident,_qd_correo:interna?'':correo,_qd_telefono:interna?'':tel,
    _pn_nombre:interna?oficinaRemitente:(tipoPersona==='natural'&&!anon?nombre:''),_pn_identificacion:tipoPersona==='natural'&&!anon&&!interna?ident:'',_pn_correo:tipoPersona==='natural'&&!anon&&!interna?correo:'',_pn_telefono:tipoPersona==='natural'&&!anon&&!interna?tel:'',
    ...pjFields,
    f_f1:asunto,f_f2:medio,
    _detalle_notas:detNotas,_detalle_general:detalle,
    _radicado_secretaria:true,_pqrs_oficina:oficina,
    _pqrs_pendiente_traslado:soloRadicar||undefined,
    _pqrs_traslado_fecha:soloRadicar?'':hoy(),_pqrs_traslado_por:soloRadicar?'':'Secretaría DEGUV',
    _pqrs_estado_oficina:'pendiente',_pqrs_responsable_oficina:encargadoOfi,
    _pqrs_solicitud_link:'',_pqrs_solicitud_archivo:'',_pqrs_detalle:detalle,
    _pqrs_drive_folder_link:'',_pqrs_drive_folder_id:'',
    _pqrs_drive_solicitud_folder_id:'',_pqrs_drive_respuesta_folder_id:'',_pqrs_drive_path_label:'',
    _pqrs_historial:hist,tasks:[],
    _gmail_message_id:gmailMsgId||null,
    _pqrs_gmail_attachments:null,
    _gmail_email_data:gmailEmailData,
    _pqrs_workflow:JSON.stringify({fase:typeof PQRS_WF!=='undefined'?PQRS_WF.SIN_RESPUESTA:'sin_respuesta',tipo_radicacion:tipoRadicacion})
  });
  exps.push(data);
  if(!soloRadicar){
    if(oficina==='guaviare')ensureTareaPqrsNca(data);
    else if(oficina!=='secretaria')ensureTareaPqrsOficina(data,oficina);
  }
  if(!interna)upsertPersonaCatalog(data);
  logAudit('Creó PQRSD ['+expId+']'+(soloRadicar?' (sin traslado)':''),'pqrsd',expId);
  // Guardado en Firestore (paso crítico — debe completarse antes de Drive)
  // Asegura que el registro (con tasks) quede en caché local inmediatamente.
  if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(data);
  const fsOk=await (typeof persistExpedienteGranularAsync==='function'
    ?persistExpedienteGranularAsync(data,true)
    :Promise.resolve(null));
  if(fsOk===false){
    // persistExpedienteGranular guardó backup local; avisamos y salimos de drive
    window._gmailPendingMsgId=null;
    window._gmailPendingAttachments=null;
    window._gmailPendingEmailData=null;
    limpiarFormSecretaria();
    renderBandejaDepto();
    renderSecretariaPqrs();
    if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
    return;
  }
  if(fsOk===undefined||fsOk===null){
    // Fallback si no existe la versión async: esperar el guardado sync.
    await persistExpedienteGranular(data,true);
    if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(data);
  }
  // Refresco inmediato: Actividades NCA / bandeja oficina / consulta
  // (antes solo se actualizaba al llegar el snapshot remoto, ~1–3 min).
  if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  else{
    if(typeof renderActividades==='function'&&document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    if(typeof renderPqrsOficinaInbox==='function'&&document.getElementById('pg-pqrs-ofi')&&document.getElementById('pg-pqrs-ofi').classList.contains('on'))renderPqrsOficinaInbox();
    if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  }
  // ── PASO 2: Reenviar correo a la oficina (solo si viene de Gmail) ────────
  let _msgParaReenvio=null;
  if(gmailMsgId){
    _msgParaReenvio=(typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId)?_gmailCurrentMsg:null;
    const _tokOk=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
    if(_tokOk&&!_msgParaReenvio&&typeof _gmailFetchMessageFull==='function'){
      _msgParaReenvio=await _gmailFetchMessageFull(gmailMsgId);
      if(_msgParaReenvio) _gmailCurrentMsg=_msgParaReenvio;
    }
    if(soloRadicar&&_msgParaReenvio&&typeof reenviarEmailAOficina==='function'){
      try{reenvioDsOk=await reenviarEmailAOficina(_msgParaReenvio,'ds_deguv',expId,{silent:true});}catch(err){console.warn('reenvio ds:',err);}
      if(!reenvioDsOk)notif('⚠️ PQRSD radicada, pero no se pudo reenviar el correo a DS DEGUV. Reenvíe manualmente desde Correos.','warn');
    }else if(!soloRadicar){
      const tmpRad={_gmail_message_id:gmailMsgId,f_f2:medio};
      reenvioOficinaOk=await reenviarCorreoRadicacionPqrsAOficina(tmpRad,oficina,expId,_msgParaReenvio||null);
      // Fallback: si el reenvío raw falló, enviar notificación estructurada al correo de la oficina
      if(!reenvioOficinaOk&&_tokOk&&typeof _pqrsEnviarNotifAsignacion==='function'){
        const _ofiData=(typeof encargadosGlobal!=='undefined'&&encargadosGlobal&&encargadosGlobal.oficinas&&encargadosGlobal.oficinas[oficina])||{};
        const _ofiEmail=(_ofiData.email||'').trim();
        if(_ofiEmail){
          try{
            reenvioOficinaOk=await _pqrsEnviarNotifAsignacion(data,[_ofiEmail],expId);
            if(reenvioOficinaOk)console.log('reenvio oficina: notificación de respaldo enviada a',oficina,_ofiEmail);
          }catch(_fe){console.warn('reenvio oficina fallback:',_fe);}
        }
      }
      if(!reenvioOficinaOk){
        if(!_tokOk){
          notif('⚠️ La PQRSD se radicó, pero NO se pudo reenviar el correo a '+labelOficina(oficina)+' porque la sesión Gmail expiró. Reconecte el correo y reenvíe manualmente con ↪ Reenviar.','warn');
        }else{
          notif('⚠️ La PQRSD se radicó, pero NO se pudo reenviar el correo a '+labelOficina(oficina)+'. Reenvíe manualmente desde Correos.','warn');
        }
      }
    }
  }
  // ── PASO 3: Subir PDF/anexos a Drive (solo si Firestore ya se guardó) ────
  let manualDriveAtts=null;
  let manualDriveFolderLink='';
  let driveFolderMeta={};
  let archivoFinal='';
  if(gmailMsgId&&typeof gmailAutoUploadPendingAttachments==='function'){
    try{await gmailAutoUploadPendingAttachments(expId,nombre);}catch(e){console.warn('auto-upload soporte:',e);}
  }
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
          notif('No se pudo subir algún anexo al Drive. La PQRSD ya quedó radicada — adjunte el archivo manualmente luego.','warn');
        }
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
      notif('No se pudo subir al Drive: '+(e.message||'revise la conexión Gmail')+'. La PQRSD ya quedó radicada — reintente adjuntar luego.','warn');
    }
  }
  // ── PASO 4: Actualizar expediente con metadatos Drive ───────────────────
  const gmailAtts=Array.isArray(window._gmailPendingAttachments)&&window._gmailPendingAttachments.length
    ?window._gmailPendingAttachments:(manualDriveAtts||null);
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
  const linkFinal=(gmailAtts&&gmailAtts[0]?gmailAtts[0].driveLink:'')||(manualDriveAtts&&manualDriveAtts[0]?manualDriveAtts[0].driveLink:'');
  const folderLinkFinal=manualDriveFolderLink||driveFolderMeta.pqrsFolderLink||(gmailAtts&&gmailAtts[0]&&gmailAtts[0].folderLink)||'';
  const hayMetadrive=!!(linkFinal||folderLinkFinal||driveFolderMeta.pqrsFolderId||(gmailAtts&&gmailAtts.length));
  if(hayMetadrive){
    data._pqrs_solicitud_link=linkFinal;
    data._pqrs_solicitud_archivo=archivoFinal;
    data._pqrs_drive_folder_link=folderLinkFinal;
    data._pqrs_drive_folder_id=driveFolderMeta.pqrsFolderId||'';
    data._pqrs_drive_solicitud_folder_id=driveFolderMeta.solicitudFolderId||'';
    data._pqrs_drive_respuesta_folder_id=driveFolderMeta.respuestaFolderId||'';
    data._pqrs_drive_path_label=driveFolderMeta.pathLabel||'';
    data._pqrs_gmail_attachments=gmailAtts||null;
    if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(data);
    // Sincroniza metadata Drive al registro ya guardado en Firestore
    await (typeof persistExpedienteGranularAsync==='function'
      ?persistExpedienteGranularAsync(data,false)
      :persistExpedienteGranular(data,false));
  }
  try{
    if(!data._pqrs_interna)await enviarNotificacionRadicacionPqrsAuto(data,{gmailMsgId:gmailMsgId,medio:medio,medioNotif:medioNotif});
  }catch(err){console.warn('notif radicacion auto:',err);}
  window._gmailPendingMsgId=null;
  window._gmailPendingAttachments=null;
  window._gmailPendingEmailData=null;
  renderBandejaDepto();
  const msgPrincipal='PQRSD '+expId+(soloRadicar?' radicada — pendiente traslado a oficina'+(reenvioDsOk?' · Correo reenviado a DS DEGUV':''):(oficina==='secretaria'?' radicado en Secretaría DEGUV':' radicado y trasladado a '+labelOficina(oficina)))+(reenvioOficinaOk?' · Correo reenviado a la oficina':'');
  notificarResultadoRadicacionPqrs({
    title:soloRadicar?'PQRSD radicada':(oficina==='secretaria'?'PQRSD radicada en Secretaría':'PQRSD radicada y trasladada'),
    message:msgPrincipal
  });
  limpiarFormSecretaria();
  renderSecretariaPqrs();
  // Refresco final tras Drive/metadatos para que anexos y tasks se vean al instante
  if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  else{
    if(typeof renderActividades==='function'&&document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    if(typeof renderPqrsOficinaInbox==='function'&&document.getElementById('pg-pqrs-ofi')&&document.getElementById('pg-pqrs-ofi').classList.contains('on'))renderPqrsOficinaInbox();
    if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
  }
  }catch(err){
    console.warn('guardarPqrsSecretaria:',err);
    if(typeof closeConfirmExito==='function')closeConfirmExito();
    notif('No se pudo completar la radicación: '+(err.message||'error inesperado'),'err');
  }finally{
    secRadicacionBusy(false);
  }
}
function pqrsFueRadicadaPorCorreo(e){
  if(!e)return false;
  if(typeof normMedioRecepcionPqrs==='function'&&normMedioRecepcionPqrs(e.f_f2||'')==='Correo')return true;
  if(e._gmail_message_id)return true;
  if(typeof getPqrsWorkflow==='function'){
    const wf=getPqrsWorkflow(e);
    if(wf&&String(wf.tipo_radicacion||'').indexOf('correo')>=0)return true;
  }
  return false;
}
async function reenviarCorreoRadicacionPqrsAOficina(e,oficina,expId,prefetchedMsg){
  if(!e||!oficina||!expId)return false;
  if(!pqrsFueRadicadaPorCorreo(e))return false;
  const gmailMsgId=e._gmail_message_id||'';
  if(!gmailMsgId)return false;
  const tokOk=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
  if(!tokOk)return false;
  let msg=prefetchedMsg||null;
  if(!msg&&(typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId))msg=_gmailCurrentMsg;
  if(!msg&&typeof _gmailFetchMessageFull==='function'){
    msg=await _gmailFetchMessageFull(gmailMsgId);
    if(msg)_gmailCurrentMsg=msg;
  }
  if(!msg&&typeof gmailApiCall==='function'&&typeof GMAIL_API_BASE!=='undefined'&&typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()){
    try{msg=await gmailApiCall('GET',GMAIL_API_BASE+'/messages/'+gmailMsgId+'?format=full');}catch(err){console.warn('fetch gmail msg:',err);}
  }
  // Fallback: buscar en bandeja OFI del usuario actual (ej. NCA ya recibió el reenvío de secretaria)
  if(!msg&&typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid()&&typeof _gmailOfiApi==='function'&&typeof GMAIL_API_BASE!=='undefined'){
    const eExpId=String(e._exp||expId||'').trim();
    if(eExpId){
      try{
        const q=encodeURIComponent('subject:"PQRSD #'+eExpId+'"');
        const sr=await _gmailOfiApi('GET',GMAIL_API_BASE+'/messages?q='+q+'&maxResults=3');
        if(sr&&sr.messages&&sr.messages.length){
          const found=await _gmailOfiApi('GET',GMAIL_API_BASE+'/messages/'+sr.messages[0].id+'?format=full');
          if(found){msg=found;console.log('reenvioOficina: mensaje encontrado en bandeja OFI para PQRSD',eExpId);}
        }
      }catch(err){console.warn('reenvioOficina búsqueda OFI:',err);}
    }
  }
  if(!msg||typeof reenviarEmailAOficina!=='function')return false;
  try{
    const ok=await reenviarEmailAOficina(msg,oficina,expId,{silent:true});
    if(ok&&typeof gmailMarkAsRead==='function')gmailMarkAsRead(gmailMsgId);
    return ok;
  }catch(err){
    console.warn('reenvio oficina:',err);
    return false;
  }
}
async function tryReenvioPqrsCorreoTraslado(e,oficina,expId){
  if(!e||!oficina)return;
  const tokOk=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
  if(!tokOk){
    notif('⚠️ PQRSD trasladada, pero NO se pudo reenviar el correo (sesión Gmail expirada). Reconecte la bandeja y reenvíe manualmente.','warn');
    return;
  }
  const ok=await reenviarCorreoRadicacionPqrsAOficina(e,oficina,expId);
  if(!ok&&pqrsFueRadicadaPorCorreo(e)&&(e._gmail_message_id||'')){
    notif('⚠️ Traslado registrado, pero falló el reenvío del correo a '+labelOficina(oficina)+'.','warn');
  }
}
function getEmailResponsablePqrs(nombre){
  const n=String(nombre||'').trim();
  if(!n)return'';
  if(typeof getUsuarioAutorizadoByNombre==='function'){
    const u=getUsuarioAutorizadoByNombre(n);
    if(u&&u.email)return String(u.email).trim();
  }
  if(typeof getInstructorByNombre==='function'){
    const ins=getInstructorByNombre(n);
    if(ins&&ins.email)return String(ins.email).trim();
  }
  return'';
}
function pqrsNombresPendientesReenvioCorreo(e,nombres){
  if(!e||!Array.isArray(nombres))return[];
  if(!Array.isArray(e._pqrs_correo_reenviado_a))e._pqrs_correo_reenviado_a=[];
  const ya=new Set(e._pqrs_correo_reenviado_a.map(function(x){return String(x||'').trim().toLowerCase();}));
  const out=[];
  const seenNom={};
  nombres.forEach(function(nom){
    const n=String(nom||'').trim();
    if(!n)return;
    const nk=typeof agendaNorm==='function'?agendaNorm(n):n.toLowerCase();
    if(seenNom[nk])return;
    seenNom[nk]=true;
    const em=getEmailResponsablePqrs(n);
    if(!em||ya.has(em.toLowerCase()))return;
    out.push({nombre:n,email:em});
  });
  return out;
}
function pqrsMarcarCorreosReenviados(e,emails){
  if(!e||!Array.isArray(emails))return;
  if(!Array.isArray(e._pqrs_correo_reenviado_a))e._pqrs_correo_reenviado_a=[];
  emails.forEach(function(em){
    const k=String(em||'').trim().toLowerCase();
    if(k&&!e._pqrs_correo_reenviado_a.some(function(x){return String(x).toLowerCase()===k;})){
      e._pqrs_correo_reenviado_a.push(em);
    }
  });
}
async function _pqrsFetchGmailMsgForReenvio(e,prefetchedMsg){
  const gmailMsgId=e._gmail_message_id||'';
  let msg=prefetchedMsg||null;
  // Intento 1: mensaje original por ID (requiere token de secretaria / cdaguaviare1)
  if(gmailMsgId){
    if(!msg&&(typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId))msg=_gmailCurrentMsg;
    if(!msg&&typeof _gmailFetchMessageFull==='function'){
      msg=await _gmailFetchMessageFull(gmailMsgId);
      if(msg)_gmailCurrentMsg=msg;
    }
    if(!msg&&typeof gmailApiCall==='function'&&typeof GMAIL_API_BASE!=='undefined'&&typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()){
      try{msg=await gmailApiCall('GET',GMAIL_API_BASE+'/messages/'+gmailMsgId+'?format=full');}catch(err){console.warn('fetch gmail msg (sec):',err);}
    }
  }
  // Intento 2: buscar en la bandeja OFI del usuario actual (ej. NCA ya recibió el reenvío de secretaria)
  // Esto permite que NCA reenvíe el correo que ÉL recibió, sin necesitar acceso a cdaguaviare1.
  if(!msg&&typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid()&&typeof _gmailOfiApi==='function'&&typeof GMAIL_API_BASE!=='undefined'){
    const expId=String(e._exp||'').trim();
    if(expId){
      try{
        const q=encodeURIComponent('subject:"PQRSD #'+expId+'"');
        const sr=await _gmailOfiApi('GET',GMAIL_API_BASE+'/messages?q='+q+'&maxResults=3');
        if(sr&&sr.messages&&sr.messages.length){
          const found=await _gmailOfiApi('GET',GMAIL_API_BASE+'/messages/'+sr.messages[0].id+'?format=full');
          if(found){
            msg=found;
            console.log('_pqrsFetchGmailMsgForReenvio: mensaje encontrado en bandeja OFI para PQRSD',expId);
          }
        }
      }catch(err){console.warn('_pqrsFetchGmailMsgForReenvio búsqueda OFI:',err);}
    }
  }
  return msg;
}
function _pqrsHtmlNotifAsignacion(e,expId,destinatarioNombre){
  const num=expId||e._exp||'';
  const asunto=e.f_f1||e._tipo_solicitud||'PQRSD';
  const fecha=e._fecha_solicitud||e._fecha||'';
  const solNombre=e._qd_nombre||e._pn_nombre||'Ciudadano';
  const detalle=e._pqrs_detalle||e._detalle_general||'';
  const oficina=typeof labelOficina==='function'?labelOficina(e._pqrs_oficina||''):e._pqrs_oficina||'';
  // Saludo personalizado por destinatario (evita cruzar nombres entre coejecutores)
  const responsable=String(destinatarioNombre||e._pqrs_responsable_oficina||'responsable').trim()||'responsable';
  const atts=Array.isArray(e._pqrs_gmail_attachments)?e._pqrs_gmail_attachments:[];
  const solLink=e._pqrs_solicitud_link||'';
  const folderLink=e._pqrs_drive_folder_link||'';
  let linksHtml='';
  if(solLink)linksHtml+='<li><a href="'+escAttr(solLink)+'">Solicitud / Soporte PDF</a></li>';
  atts.forEach(function(a){if(a&&a.driveLink)linksHtml+='<li><a href="'+escAttr(a.driveLink)+'">'+escAttr(a.nombre||a.name||'Adjunto')+'</a></li>';});
  if(folderLink&&!linksHtml)linksHtml='<li><a href="'+escAttr(folderLink)+'">Carpeta Drive de la PQRSD</a></li>';
  const adjuntosHtml=linksHtml
    ?('<p><strong>Documentos adjuntos en Drive:</strong></p><ul>'+linksHtml+'</ul>')
    :(folderLink?'<p><a href="'+escAttr(folderLink)+'">Abrir carpeta Drive de la PQRSD</a></p>':'<p><em>Sin adjuntos registrados. Revise la carpeta Drive si fue asignado recientemente.</em></p>');
  return '<p>Estimado/a <strong>'+escAttr(responsable)+'</strong>,</p>'+
    '<p>Se le ha asignado o notificado la siguiente PQRSD para su atención:</p>'+
    '<table style="border-collapse:collapse;font-size:13px;width:100%;max-width:520px">'+
    '<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">N° PQRSD</td><td style="padding:4px 8px">'+escAttr(num)+'</td></tr>'+
    '<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">Asunto</td><td style="padding:4px 8px">'+escAttr(asunto)+'</td></tr>'+
    '<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">Fecha solicitud</td><td style="padding:4px 8px">'+escAttr(fecha)+'</td></tr>'+
    '<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">Ciudadano</td><td style="padding:4px 8px">'+escAttr(solNombre)+'</td></tr>'+
    (detalle?'<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">Detalle</td><td style="padding:4px 8px">'+escAttr(detalle)+'</td></tr>':'')+
    (oficina?'<tr><td style="padding:4px 8px;font-weight:600;background:#f5f5f5">Oficina</td><td style="padding:4px 8px">'+escAttr(oficina)+'</td></tr>':'')+
    '</table>'+
    adjuntosHtml+
    '<hr><p style="font-size:11px;color:#888">Notificación automática del Sistema de Seguimiento de Trámites — CDA Delegación Guaviare. No responda a este correo.</p>';
}
/** destinatarios: array de emails O de {email,nombre}. Cada uno recibe saludo con su propio nombre. */
async function _pqrsEnviarNotifAsignacion(e,destinatarios,expId){
  if(!destinatarios||!destinatarios.length)return false;
  if(typeof _gmailApiBest!=='function'&&typeof gmailSend!=='function')return false;
  const num=expId||e._exp||'';
  const asunto='Fwd: PQRSD #'+num+' '+((e.f_f1||e._tipo_solicitud||'Solicitud').slice(0,80));
  const list=destinatarios.map(function(d){
    if(typeof d==='string')return{email:String(d||'').trim(),nombre:''};
    return{email:String(d&&d.email||'').trim(),nombre:String(d&&d.nombre||'').trim()};
  }).filter(function(d){return!!d.email;});
  let okCount=0;
  const okEmails=[];
  for(let i=0;i<list.length;i++){
    const dest=list[i];
    const body=_pqrsHtmlNotifAsignacion(e,num,dest.nombre||e._pqrs_responsable_oficina||'');
    try{
      const raw=typeof _buildMimeEmail==='function'?_buildMimeEmail(dest.email,asunto,body):null;
      if(raw){
        await _gmailApiBest('POST',GMAIL_API_BASE+'/messages/send',{raw:raw});
        okCount++;
        okEmails.push(dest.email);
      }else if(typeof gmailSend==='function'){
        await gmailSend(dest.email,asunto,body);
        okCount++;
        okEmails.push(dest.email);
      }
    }catch(err){
      console.warn('_pqrsEnviarNotifAsignacion:',dest.email,err.message);
    }
  }
  return okCount>0?okEmails:false;
}
async function reenviarCorreoRadicacionPqrsAResponsables(e,nombres,expId,prefetchedMsg){
  // Único correo al responsable por ahora: reenvío del radicado por correo (con anexos).
  // No usar este camino para aprobar documentos ni devolver por corregir.
  if(!e||!expId||!nombres||!nombres.length)return false;
  if(!pqrsFueRadicadaPorCorreo(e))return false;
  const pendientes=pqrsNombresPendientesReenvioCorreo(e,nombres);
  if(!pendientes.length)return true;
  const tokOk=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
  if(!tokOk)return false;
  // Preferir reenvío raw del correo de radicación (asunto: Fwd: PQRSD #id …).
  // La notificación estructurada solo se usa si no hay mensaje Gmail o falla el Fwd.
  let okEmails=[];
  const msg=await _pqrsFetchGmailMsgForReenvio(e,prefetchedMsg);
  if(msg&&typeof reenviarEmailRawARecipientes==='function'){
    const emails=pendientes.map(function(p){return p.email;});
    try{
      const rawOk=await reenviarEmailRawARecipientes(msg,emails,expId,{silent:true});
      if(rawOk)okEmails=emails.slice();
    }catch(err){console.warn('reenvio raw responsable:',err);}
  }
  const faltantes=pendientes.filter(function(p){
    return!okEmails.some(function(em){return String(em).toLowerCase()===String(p.email).toLowerCase();});
  });
  if(faltantes.length){
    try{
      const r=await _pqrsEnviarNotifAsignacion(e,faltantes,expId);
      if(Array.isArray(r))okEmails=okEmails.concat(r);
    }catch(err){console.warn('notif asignacion responsable:',err);}
  }
  if(okEmails.length){
    pqrsMarcarCorreosReenviados(e,okEmails);
    if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
    const enviados=pendientes.filter(function(p){
      return okEmails.some(function(em){return String(em).toLowerCase()===String(p.email).toLowerCase();});
    });
    e._pqrs_historial.push({
      tipo:'reenvio_correo_responsable',
      fecha:hoy(),
      nota:'Notificación de PQRSD enviada a responsable(s): '+enviados.map(function(p){return p.nombre;}).join(', ')
    });
    return true;
  }
  return false;
}
async function tryReenvioPqrsCorreoAResponsables(e,nombres,expId,opts){
  opts=opts||{};
  if(!e||!nombres||!nombres.length)return false;
  const pendientes=pqrsNombresPendientesReenvioCorreo(e,nombres);
  if(!pendientes.length)return true;
  if(!pqrsFueRadicadaPorCorreo(e)||!(e._gmail_message_id||''))return false;
  const tokOk=(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
  if(!tokOk){
    if(!opts.silent)notif('⚠️ PQRSD asignada, pero NO se pudo reenviar el correo (sesión Gmail expirada). Reconecte la bandeja.','warn');
    return false;
  }
  const ok=await reenviarCorreoRadicacionPqrsAResponsables(e,nombres,expId);
  if(!ok&&!opts.silent){
    const sinEmail=nombres.filter(function(n){return!getEmailResponsablePqrs(n);});
    if(sinEmail.length){
      notif('⚠️ Asignación registrada, pero falta correo de: '+sinEmail.join(', ')+'. Configure el email del usuario.','warn');
    }else{
      notif('⚠️ Asignación registrada, pero falló el reenvío del correo con anexos.','warn');
    }
  }else if(ok&&!opts.silent){
    notif('Correo de radicación reenviado a '+pendientes.map(function(p){return p.nombre;}).join(', '),'ok');
  }
  return ok;
}
async function pqrsTryReenvioCorreoNuevosResponsables(expId,nombres,opts){
  const e=exps.find(function(x){return String(x._exp||'').trim()===String(expId||'').trim();});
  if(!e||typeof esPqrsSecretaria!=='function'||!esPqrsSecretaria(e))return false;
  const noms=(Array.isArray(nombres)?nombres:[nombres]).map(function(n){return String(n||'').trim();}).filter(Boolean);
  if(!noms.length)return false;
  const ok=await tryReenvioPqrsCorreoAResponsables(e,noms,expId,opts);
  if(e._pqrs_correo_reenviado_a&&e._pqrs_correo_reenviado_a.length)persistExpedienteGranular(e);
  return ok;
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
  if(e&&e._pqrs_interna){
    const rem=String(e._pqrs_oficina_remitente||e._qd_nombre||e._pn_nombre||'').trim()||'—';
    return '<div class="pqrs-det-v"><span class="bdg" style="background:#185fa522;color:var(--bl);font-size:10px;margin-right:6px">Interna</span>Oficina remitente: <strong>'+escAttr(rem)+'</strong></div>';
  }
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
function pqrsSortByNumDesc(a,b){
  const na=parseInt(String(a._exp||'').replace(/\D/g,''),10)||0;
  const nb=parseInt(String(b._exp||'').replace(/\D/g,''),10)||0;
  return nb-na;
}
function getPqrsPendientesTrasladoList(skipPeriodo){
  let list=exps.filter(e=>esPqrsSecretaria(e)&&pqrsPendienteTraslado(e)).map(normalizePqrsOficinaFields);
  if(!skipPeriodo)list=filterExpsPeriodo(list,'pqrs-ofi');
  return list.sort((a,b)=>String(b._fecha||'').localeCompare(String(a._fecha||'')));
}
function renderSecretariaPqrs(){
  renderSecGmailBloqueoRadicacion();
  const all=getSecretariaPqrsAll();
  const pendientes=getPqrsPendientesTrasladoList(true).sort(pqrsSortByNumDesc);
  const asignadas=all.filter(e=>!pqrsPendienteTraslado(e)).sort(pqrsSortByNumDesc);
  const atendidas=all.filter(e=>pqrsEstaCerrada(e));
  const SEC_PQRS_PAGE=10;
  const SEC_PQRS_MAX=30;
  if(window._secPendTraslShown==null)window._secPendTraslShown=SEC_PQRS_PAGE;
  if(window._secAsignadasShown==null)window._secAsignadasShown=SEC_PQRS_PAGE;
  const mets=document.getElementById('sec-pqrs-mets');
  if(mets)mets.innerHTML=
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+all.length+'</div><div class="l">Radicadas</div></div>'+
    '<div class="met'+(puedeVerFiltroPorTrasladarOficina()?' met-click':'')+'" style="border-left:3px solid #7c5cbf"'+(puedeVerFiltroPorTrasladarOficina()?' onclick="setPqrsOfiFiltro(\'por_trasladar\');showTab(\'pqrs-ofi\')" title="Ver bandeja por trasladar"':'')+'><div class="v" style="color:#7c5cbf">'+pendientes.length+'</div><div class="l">Pend. traslado</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+asignadas.filter(e=>!pqrsEstaCerrada(e)).length+'</div><div class="l">En gestión</div></div>'+
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+atendidas.length+'</div><div class="l">Atendidas</div></div>';
  const pendWrap=document.getElementById('sec-pend-trasl-wrap');
  const pendTb=document.getElementById('tbl-sec-pend-trasl');
  const pendMore=document.getElementById('sec-pend-trasl-more');
  if(pendWrap&&pendTb){
    const showPend=puedeGestionarPendientesTraslado();
    pendWrap.style.display=showPend?'':'none';
    if(!showPend){
      pendTb.innerHTML='';
      if(pendMore)pendMore.style.display='none';
    }else if(!pendientes.length){
      pendTb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">No hay PQRSD pendientes de traslado.</td></tr>';
      if(pendMore)pendMore.style.display='none';
    }else{
      const lim=Math.min(window._secPendTraslShown,SEC_PQRS_MAX,pendientes.length);
      const slice=pendientes.slice(0,lim);
      pendTb.innerHTML=slice.map(e=>{
        const asunto=e.f_f1||e._pqrs_detalle||'—';
        return '<tr><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+pqrsEstadoConsultaBadge(e)+'</td><td>'+fmtF(e._fecha)+'</td><td>'+fmtF(e._fecha_solicitud||e._fecha)+'</td><td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
      }).join('');
      if(pendMore){
        const rest=Math.min(pendientes.length,SEC_PQRS_MAX)-lim;
        if(rest>0){
          pendMore.style.display='';
          pendMore.textContent='Ver 10 más ('+rest+' restantes, máx. '+SEC_PQRS_MAX+')';
        }else pendMore.style.display='none';
      }
    }
  }
  const tb=document.getElementById('tbl-sec-pqrs');
  const asigMore=document.getElementById('sec-asignadas-more');
  if(tb){
    if(!asignadas.length){
      tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">Sin PQRSD en seguimiento.</td></tr>';
      if(asigMore)asigMore.style.display='none';
    }else{
      const lim=Math.min(window._secAsignadasShown,SEC_PQRS_MAX,asignadas.length);
      const slice=asignadas.slice(0,lim);
      tb.innerHTML=slice.map(e=>{
        const asunto=e.f_f1||e._pqrs_detalle||'—';
        const ofiLbl=e._pqrs_oficina?labelOficina(e._pqrs_oficina):'Sin oficina (registro anterior)';
        return '<tr><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+escAttr(ofiLbl)+'</td><td>'+pqrsEstadoConsultaBadge(e)+'</td><td>'+fmtF(e._fecha)+'</td>'+
          '<td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
      }).join('');
      if(asigMore){
        const rest=Math.min(asignadas.length,SEC_PQRS_MAX)-lim;
        if(rest>0){
          asigMore.style.display='';
          asigMore.textContent='Ver 10 más ('+rest+' restantes, máx. '+SEC_PQRS_MAX+')';
        }else asigMore.style.display='none';
      }
    }
  }
  renderSecretariaPqrsDetalle();
}
function secPqrsVerMasPendientes(){
  window._secPendTraslShown=Math.min((window._secPendTraslShown||10)+10,30);
  renderSecretariaPqrs();
}
function secPqrsVerMasAsignadas(){
  window._secAsignadasShown=Math.min((window._secAsignadasShown||10)+10,30);
  renderSecretariaPqrs();
}
window.secPqrsVerMasPendientes=secPqrsVerMasPendientes;
window.secPqrsVerMasAsignadas=secPqrsVerMasAsignadas;
function pqrsOfiEstBadge(est){
  const lbl=PQRS_EST_OFICINA[est]||est||'—';
  const cls=est==='cerrado'?'cerr':est==='atendiendo'?'aten':est==='asignado'?'asig':'pend';
  return '<span class="pqrs-ofi-est '+cls+'">'+escAttr(lbl)+'</span>';
}
function getPqrsOficinaList(oficinaId,filtro){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  filtro=filtro||window._pqrsOfiFiltro||'all';
  if(filtro==='por_trasladar')return getPqrsPendientesTrasladoList();
  // «Por firmar»: Director (todas las oficinas) + NCA + oficinas DEGUV / Secretaría
  if(filtro==='por_firmar'){
    const puedeVerPorFirmar=typeof pqrsPuedeFlujoPorFirmarBandeja==='function'&&pqrsPuedeFlujoPorFirmarBandeja();
    if(!puedeVerPorFirmar)return[];
    const esDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
    let listF=exps.filter(e=>{
      if(!esPqrsSecretaria(e)||typeof pqrsWorkflowFase!=='function'||pqrsWorkflowFase(e)!==PQRS_WF.POR_FIRMAR)return false;
      // Firmados → paleta «Firmados» (todos los roles)
      if(typeof pqrsEsFirmadoPendienteGestion==='function'&&pqrsEsFirmadoPendienteGestion(e))return false;
      if(typeof pqrsEsFirmadoDirectorPendiente==='function'&&pqrsEsFirmadoDirectorPendiente(e))return false;
      return true;
    }).map(normalizePqrsOficinaFields);
    // NCA / oficinas: solo las de su oficina; Director: transversal
    if(!esDir){
      const ofiAct=oficinaId||getPqrsOficinaActiva();
      listF=listF.filter(e=>e._pqrs_oficina===ofiAct||(ofiAct==='guaviare'&&e._pqrs_oficina==='guaviare'));
    }
    // Trámites / oficios oficina en firma: misma paleta (filtrados por oficina)
    if(typeof getTramiteFirmaRowsParaPaletaDirector==='function'){
      let tramRows=getTramiteFirmaRowsParaPaletaDirector('por_firmar')||[];
      if(typeof filterTramiteFirmaRowsPorOficina==='function')
        tramRows=filterTramiteFirmaRowsPorOficina(tramRows,oficinaId||getPqrsOficinaActiva(),esDir);
      else if(!esDir){
        const ofiAct=oficinaId||getPqrsOficinaActiva();
        tramRows=tramRows.filter(function(r){return String(r._pqrs_oficina||'')===ofiAct;});
      }
      tramRows.forEach(function(r){listF.push(r);});
    }
    listF=filterExpsPeriodo(listF,'pqrs-ofi');
    return listF.sort((a,b)=>String(b._pqrs_traslado_fecha||b._fecha||'').localeCompare(String(a._pqrs_traslado_fecha||a._fecha||'')));
  }
  if(filtro==='firmados'){
    if(!(typeof pqrsPuedeVerPaletaFirmados==='function'?pqrsPuedeVerPaletaFirmados():(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())))return[];
    const esDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
    let listFd=exps.filter(e=>esPqrsSecretaria(e)&&(typeof pqrsEsFirmadoPendienteGestion==='function'?pqrsEsFirmadoPendienteGestion(e):(typeof pqrsEsFirmadoDirectorPendiente==='function'&&pqrsEsFirmadoDirectorPendiente(e)))).map(normalizePqrsOficinaFields);
    if(!esDir){
      const ofiAct=oficinaId||getPqrsOficinaActiva();
      listFd=listFd.filter(e=>e._pqrs_oficina===ofiAct||(ofiAct==='guaviare'&&e._pqrs_oficina==='guaviare'));
    }
    if(typeof getTramiteFirmaRowsParaPaletaDirector==='function'){
      let tramFd=getTramiteFirmaRowsParaPaletaDirector('firmados')||[];
      if(typeof filterTramiteFirmaRowsPorOficina==='function')
        tramFd=filterTramiteFirmaRowsPorOficina(tramFd,oficinaId||getPqrsOficinaActiva(),esDir);
      else if(!esDir){
        const ofiAct=oficinaId||getPqrsOficinaActiva();
        tramFd=tramFd.filter(function(r){return String(r._pqrs_oficina||'')===ofiAct;});
      }
      tramFd.forEach(function(r){listFd.push(r);});
    }
    listFd=filterExpsPeriodo(listFd,'pqrs-ofi');
    return listFd.sort((a,b)=>String(b._pqrs_traslado_fecha||b._fecha||'').localeCompare(String(a._pqrs_traslado_fecha||a._fecha||'')));
  }
  let list=exps.filter(e=>esPqrsSecretaria(e)&&e._pqrs_oficina===oficinaId&&!pqrsPendienteTraslado(e)).map(normalizePqrsOficinaFields);
  // «Por ejecutar»: solo pendientes de respuesta (sin mezclar Por firmar / Por notificar / revisión)
  if(filtro==='pend'){
    list=list.filter(function(e){
      if(pqrsEstaCerrada(e))return false;
      const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';
      if(f===PQRS_WF.POR_FIRMAR||f===PQRS_WF.PENDIENTE_NOTIF||f===PQRS_WF.LISTA_ENVIO)return false;
      if(f===PQRS_WF.PARA_FIRMA||f===PQRS_WF.VITAL_GESTION)return false;
      if(f===PQRS_WF.PENDIENTE_REVISION||f===PQRS_WF.REVISION_FINAL)return false;
      return f===PQRS_WF.SIN_RESPUESTA||f===PQRS_WF.RECHAZADA||!f;
    });
  }
  else if(filtro==='atras')list=list.filter(e=>pqrsEstaAtrasada(e));
  else if(filtro==='cerr')list=list.filter(e=>pqrsEstaCerrada(e));
  else if(filtro==='revision')list=list.filter(e=>{
    const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';
    return f===PQRS_WF.PENDIENTE_REVISION||f===PQRS_WF.REVISION_FINAL;
  });
  else if(filtro==='para_firma')list=list.filter(e=>typeof pqrsEnParaFirma==='function'&&pqrsEnParaFirma(e));
  else if(filtro==='por_notificar'){
    list=list.filter(e=>{const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';return f===PQRS_WF.PENDIENTE_NOTIF||f===PQRS_WF.LISTA_ENVIO;});
    if(typeof getTramiteFirmaRowsParaPaletaDirector==='function'){
      const esDirN=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
      let tramN=getTramiteFirmaRowsParaPaletaDirector('por_notificar')||[];
      if(typeof filterTramiteFirmaRowsPorOficina==='function')
        tramN=filterTramiteFirmaRowsPorOficina(tramN,oficinaId||getPqrsOficinaActiva(),esDirN);
      else if(!esDirN){
        const ofiAct=oficinaId||getPqrsOficinaActiva();
        tramN=tramN.filter(function(r){return String(r._pqrs_oficina||'')===ofiAct;});
      }
      tramN.forEach(function(r){list.push(r);});
    }
  }
  list=filterExpsPeriodo(list,'pqrs-ofi');
  return list.sort((a,b)=>String(b._pqrs_traslado_fecha||b._fecha||'').localeCompare(String(a._pqrs_traslado_fecha||a._fecha||'')));
}
/** Acciones exclusivas del Director (DS DEGUV) en paleta «Por firmar». */
function pqrsDirectorPorFirmarAccionesHtml(e){
  const id=jsStr(e&&e._exp);
  if(!id)return'';
  if(e&&e._tramite_firma_task&&e._taskId){
    const tid=jsStr(e._taskId);
    return '<button type="button" class="btn bsm act-ico" style="background:#185FA5;color:#fff;border-color:#185FA5" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'ver\')" title="Ver documento a firmar">👁</button> '+
      '<button type="button" class="btn bsm act-ico" style="background:#0f766e;color:#fff;border-color:#0f766e" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'cargar\')" title="Cargar documento ya firmado">⬆</button> '+
      '<button type="button" class="btn bsm act-ico" style="background:#15803d;color:#fff;border-color:#15803d" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'ya_firmado\')" title="Indicar que ya está firmado">✓</button> '+
      '<button type="button" class="btn bsm act-ico bd2" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'devolver\')" title="Devolver documento">↩</button>';
  }
  return '<button type="button" class="btn bsm act-ico" style="background:#185FA5;color:#fff;border-color:#185FA5" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\',\'ver\')" title="Ver documento a firmar">👁</button> '+
    '<button type="button" class="btn bsm act-ico" style="background:#0f766e;color:#fff;border-color:#0f766e" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\',\'cargar\')" title="Cargar documento ya firmado">⬆</button> '+
    '<button type="button" class="btn bsm act-ico" style="background:#15803d;color:#fff;border-color:#15803d" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\',\'ya_firmado\')" title="Indicar que ya está firmado">✓</button> '+
    '<button type="button" class="btn bsm act-ico bd2" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\',\'devolver\')" title="Devolver documento">↩</button>';
}
function pqrsAccionesTablaHtml(e){
  const id=jsStr(e._exp);
  const esDir=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
  // Trámite / oficio oficina en firma del Director (paleta unificada)
  if(e&&e._tramite_firma_task&&e._taskId){
    const tid=jsStr(e._taskId);
    const t=typeof getTaskAny==='function'?getTaskAny(e._exp,e._taskId):null;
    const firmFis=t&&typeof taskFirmaEsFirmadoPendiente==='function'&&taskFirmaEsFirmadoPendiente(t);
    const enNotif=t&&typeof taskFirmaEnPorNotificar==='function'&&taskFirmaEnPorNotificar(t);
    const ofiDueña=t&&typeof tramitePuedeGestionarComoOficina==='function'&&tramitePuedeGestionarComoOficina(t);
    if(esDir&&!firmFis&&!enNotif)return pqrsDirectorPorFirmarAccionesHtml(e);
    if(esDir&&firmFis)
      return '<button type="button" class="btn bsm act-ico" style="background:#185FA5;color:#fff;border-color:#185FA5" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'ver\')" title="Ver">👁</button> '+
        '<span class="btn bsm act-ico" style="background:#185fa522;color:var(--bl);cursor:default" title="Firmado — pendiente de notificación">📬</span> ';
    if(esDir&&enNotif)
      return '<button type="button" class="btn bsm act-ico" style="background:#185FA5;color:#fff;border-color:#185FA5" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'ver\')" title="Ver">👁</button> '+
        '<span class="btn bsm act-ico" style="background:#185fa522;color:var(--bl);cursor:default" title="En notificación">📬</span> ';
    let h='<button type="button" class="btn bsm" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\')">Ver</button> ';
    if(enNotif&&typeof tramitePuedeNotificar==='function'&&tramitePuedeNotificar(t))
      h+='<button type="button" class="btn bsm act-ico bp" onclick="event.stopPropagation();openTramiteNotificarModal(\''+id+'\',\''+tid+'\')" title="Notificar">📬</button> ';
    else if(firmFis&&!esDir)
      h+='<button type="button" class="btn bsm act-ico bp" onclick="event.stopPropagation();tramitePasarAPorNotificar(\''+id+'\',\''+tid+'\')" title="Pasar a por notificar">📬</button> ';
    else if(!firmFis&&ofiDueña){
      h+='<button type="button" class="btn bsm act-ico" style="background:#0f766e;color:#fff;border-color:#0f766e" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'cargar\')" title="Cargar firmado / pasar a notificar">⬆</button> ';
      h+='<button type="button" class="btn bsm act-ico" style="background:#15803d;color:#fff;border-color:#15803d" onclick="event.stopPropagation();openTramiteDirectorFirmarModal(\''+id+'\',\''+tid+'\',\'ya_firmado\')" title="Ya firmado">✓</button> ';
    }
    return h;
  }
  const fase=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):PQRS_WF.SIN_RESPUESTA;
  const filtroOfi=String(window._pqrsOfiFiltro||'');
  const enPaletaPorFirmar=filtroOfi==='por_firmar'||fase===PQRS_WF.POR_FIRMAR;
  // Director en «Por firmar»: solo Ver / Cargar firmado / Ya firmado / Devolver
  if(fase===PQRS_WF.POR_FIRMAR&&esDir){
    const wfDir=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
    if(!(wfDir.firma_fisica&&wfDir.firma_fisica.en))return pqrsDirectorPorFirmarAccionesHtml(e);
    return '<button type="button" class="btn bsm act-ico" style="background:#185FA5;color:#fff;border-color:#185FA5" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\',\'ver\')" title="Ver">👁</button> '+
      '<span class="btn bsm act-ico" style="background:#185fa522;color:var(--bl);cursor:default" title="Firmado — pendiente de notificación">📬</span> ';
  }
  let h='<span class="sst-act-toolbar">';
  // ✏️ / 🔍 abren paneles completos (no menús)
  if(esSecretaria()&&puedeEditarPqrsSecretaria(e))
    h+='<button type="button" class="btn bsm bic act-ico" title="Editar PQRSD" onclick="event.stopPropagation();openEditPqrsSecretariaModal(\''+id+'\')">✏️</button> ';
  else
    h+='<button type="button" class="btn bsm bic act-ico" title="Ver / editar" onclick="event.stopPropagation();openPqrsSidePanel(\''+id+'\')">✏️</button> ';
  h+='<button type="button" class="btn bsm bic act-ico" title="Revisar" onclick="event.stopPropagation();openPqrsSidePanel(\''+id+'\')">🔍</button> ';
  if(fase===PQRS_WF.PENDIENTE_REVISION&&(esNcaDeguv()||esOficinaPqrsNca()||esAdministrador()))
    h+='<button type="button" class="btn bsm act-ico" style="background:#6d3fa8;color:#fff" onclick="event.stopPropagation();openNcaRevisionModal(\''+id+'\')" title="Revisar entrega">⏳</button> ';
  if(fase===PQRS_WF.REVISION_FINAL&&(esNcaDeguv()||esOficinaPqrsNca()||esAdministrador()))
    h+='<button type="button" class="btn bsm act-ico" style="background:#6d3fa8;color:#fff" onclick="event.stopPropagation();ncaAprobarRevisionFinalNotif(\''+id+'\')" title="Aprobar notificación">✅</button> ';
  if((fase===PQRS_WF.SIN_RESPUESTA||fase===PQRS_WF.RECHAZADA)&&puedeMarcarPqrsRespondida(e)&&typeof pqrsPuedeAtajoParaFirma==='function'&&pqrsPuedeAtajoParaFirma())
    h+='<button type="button" class="btn bsm act-ico" style="background:#0d5c2e;color:#fff;border-color:#0d5c2e" onclick="event.stopPropagation();openPqrsRespuestaModal(\''+id+'\',{modo:\'firma\'})" title="Enviar a firma">🖊</button> ';
  h+='</span> ';
  // Iconos de fase
  if((fase===PQRS_WF.PARA_FIRMA||fase===PQRS_WF.VITAL_GESTION)&&(typeof pqrsPuedeMarcarParaFirma==='function'&&pqrsPuedeMarcarParaFirma(e))){
    const wfB=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
    const docsImp=((wfB.documentos)||[]).filter(d=>d&&(d.driveLink||d.previewLink));
    if(docsImp.length){
      const u0=docsImp[0].driveLink||docsImp[0].previewLink;
      const view=String(u0||'').replace(/\/preview(\?.*)?$/,'/view');
      h+='<a class="btn bsm act-ico" href="'+escAttr(view)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="background:#0f766e;color:#fff;border-color:#0f766e" title="Ver archivo">👁</a> ';
    }
    h+='<button type="button" class="btn bsm act-ico" style="background:#1a7a4a;color:#fff" onclick="event.stopPropagation();openPqrsParaFirmaModal(\''+id+'\')" title="Pasar a firma">🖊</button> ';
  }
  if(fase===PQRS_WF.POR_FIRMAR){
    const wfF=typeof getPqrsWorkflow==='function'?getPqrsWorkflow(e):{};
    const firmFis=!!(wfF.firma_fisica&&wfF.firma_fisica.en);
    if(firmFis&&typeof pqrsPuedeAsignarPorNotificar==='function'&&pqrsPuedeAsignarPorNotificar(e))
      h+='<button type="button" class="btn bsm act-ico bp" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\')" title="Gestionar firmado">📬</button> ';
    else if(!firmFis&&typeof pqrsPuedeMarcarFirmadoSinCargar==='function'&&pqrsPuedeMarcarFirmadoSinCargar(e))
      h+='<button type="button" class="btn bsm act-ico" style="background:#15803d;color:#fff" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\')" title="Ya firmado">✓</button> ';
  }
  if(filtroOfi==='firmados'){
    if(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())
      h+='<span class="btn bsm act-ico" style="background:#185fa522;color:var(--bl);cursor:default" title="Firmado">📬</span> ';
    else if(typeof pqrsPuedeAsignarPorNotificar==='function'&&pqrsPuedeAsignarPorNotificar(e))
      h+='<button type="button" class="btn bsm act-ico bp" onclick="event.stopPropagation();openPqrsDirectorFirmarModal(\''+id+'\')" title="Gestionar firmado">📬</button> ';
  }
  if((fase===PQRS_WF.PENDIENTE_NOTIF||fase===PQRS_WF.LISTA_ENVIO)){
    if(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv())
      h+='<span class="btn bsm act-ico" style="background:#185fa522;color:var(--bl);cursor:default" title="Por notificar">📬</span> ';
    else if(typeof pqrsPuedeNotificarOficio==='function'?pqrsPuedeNotificarOficio(e):(esNcaDeguv()||esOficinaPqrsNca()||typeof esCargoVital==='function'&&esCargoVital()||esAdministrador()))
      h+='<button type="button" class="btn bsm act-ico bp" onclick="event.stopPropagation();openPqrsNotificarOficioModal(\''+id+'\')" title="Notificar">📬</button> ';
  }
  return h;
}
function renderPqrsOficinaInbox(){
  const tb=document.getElementById('tbl-pqrs-ofi');
  const tit=document.getElementById('pqrs-ofi-titulo');
  const ban=document.getElementById('pqrs-ofi-banner');
  const mets=document.getElementById('pqrs-ofi-mets');
  const detBox=document.getElementById('pqrs-ofi-detalle');
  const ofi=getOficinaActiva();
  let filtro=window._pqrsOfiFiltro||'pend';
  // «Por trasladar» solo Director / Secretaría
  if(filtro==='por_trasladar'&&!(typeof puedeVerFiltroPorTrasladarOficina==='function'&&puedeVerFiltroPorTrasladarOficina())){
    filtro='pend';
    window._pqrsOfiFiltro='pend';
  }
  // «Por firmar»: NCA, Director, oficinas DEGUV y Secretaría (no resetear si tienen bandeja)
  if(filtro==='por_firmar'&&!(typeof pqrsPuedeFlujoPorFirmarBandeja==='function'&&pqrsPuedeFlujoPorFirmarBandeja())){
    filtro='pend';
    window._pqrsOfiFiltro='pend';
  }
  if(filtro==='firmados'&&!(typeof pqrsPuedeVerPaletaFirmados==='function'?pqrsPuedeVerPaletaFirmados():(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv()))){
    filtro='pend';
    window._pqrsOfiFiltro='pend';
  }
  const esPendTrasl=filtro==='por_trasladar';
  if(tit){
    if(esPendTrasl)tit.textContent='PQRSD — Pendientes por trasladar';
    else if(ofi)tit.textContent='PQRSD — '+ofi.nombre;
  }
  const btnOfiFirma=document.getElementById('btn-entrega-ofi-firma');
  if(btnOfiFirma){
    const showOfiFirma=typeof puedeEntregarOficinaParaFirma==='function'&&puedeEntregarOficinaParaFirma()&&!esPendTrasl;
    btnOfiFirma.style.display=showOfiFirma?'':'none';
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
  const showPorTrasl=typeof puedeVerFiltroPorTrasladarOficina==='function'&&puedeVerFiltroPorTrasladarOficina();
  if(mets){
    // Por ejecutar = pendientes de respuesta (no incluye Por firmar / Por notificar)
    const porEjec=getPqrsOficinaList(getPqrsOficinaActiva(),'pend').length;
    const vencidas=listAll.filter(e=>pqrsEstaAtrasada(e)).length;
    const cerr=listAll.filter(e=>pqrsEstaCerrada(e)).length;
    const showPorFirmarCard=typeof pqrsPuedeFlujoPorFirmarBandeja==='function'&&pqrsPuedeFlujoPorFirmarBandeja();
    const showParaImprimirCard=typeof pqrsPuedeFlujoPorImprimir==='function'&&pqrsPuedeFlujoPorImprimir();
    const esDirMets=typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv();
    const showFirmadosCard=typeof pqrsPuedeVerPaletaFirmados==='function'?pqrsPuedeVerPaletaFirmados():esDirMets;
    const esFirmadoFn=function(e){
      return typeof pqrsEsFirmadoPendienteGestion==='function'?pqrsEsFirmadoPendienteGestion(e):(typeof pqrsEsFirmadoDirectorPendiente==='function'&&pqrsEsFirmadoDirectorPendiente(e));
    };
    const ofiActMets=getPqrsOficinaActiva();
    const tramPorFirmarRows=(typeof getTramiteFirmaRowsParaPaletaDirector==='function'
      ?(typeof filterTramiteFirmaRowsPorOficina==='function'
        ?filterTramiteFirmaRowsPorOficina(getTramiteFirmaRowsParaPaletaDirector('por_firmar')||[],ofiActMets,esDirMets)
        :(getTramiteFirmaRowsParaPaletaDirector('por_firmar')||[]).filter(function(r){return esDirMets||String(r._pqrs_oficina||'')===ofiActMets;}))
      :[]);
    const tramFirmadosRows=(typeof getTramiteFirmaRowsParaPaletaDirector==='function'
      ?(typeof filterTramiteFirmaRowsPorOficina==='function'
        ?filterTramiteFirmaRowsPorOficina(getTramiteFirmaRowsParaPaletaDirector('firmados')||[],ofiActMets,esDirMets)
        :(getTramiteFirmaRowsParaPaletaDirector('firmados')||[]).filter(function(r){return esDirMets||String(r._pqrs_oficina||'')===ofiActMets;}))
      :[]);
    const tramPorNotifRows=(typeof getTramiteFirmaRowsParaPaletaDirector==='function'
      ?(typeof filterTramiteFirmaRowsPorOficina==='function'
        ?filterTramiteFirmaRowsPorOficina(getTramiteFirmaRowsParaPaletaDirector('por_notificar')||[],ofiActMets,esDirMets)
        :(getTramiteFirmaRowsParaPaletaDirector('por_notificar')||[]).filter(function(r){return esDirMets||String(r._pqrs_oficina||'')===ofiActMets;}))
      :[]);
    const porFirmar=showPorFirmarCard
      ?(esDirMets
        ?(exps.filter(e=>esPqrsSecretaria(e)&&typeof pqrsWorkflowFase==='function'&&pqrsWorkflowFase(e)===PQRS_WF.POR_FIRMAR&&!esFirmadoFn(e)).length
          +tramPorFirmarRows.length)
        :listAll.filter(e=>typeof pqrsWorkflowFase==='function'&&pqrsWorkflowFase(e)===PQRS_WF.POR_FIRMAR&&!esFirmadoFn(e)).length
          +tramPorFirmarRows.length)
      :0;
    const firmados=showFirmadosCard
      ?(esDirMets
        ?(exps.filter(e=>esPqrsSecretaria(e)&&esFirmadoFn(e)).length
          +tramFirmadosRows.length)
        :listAll.filter(e=>esFirmadoFn(e)).length
          +tramFirmadosRows.length)
      :0;
    const paraFirma=showParaImprimirCard?listAll.filter(e=>typeof pqrsEnParaFirma==='function'&&pqrsEnParaFirma(e)).length:0;
    const porNotif=listAll.filter(e=>{const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';return f===PQRS_WF.PENDIENTE_NOTIF||f===PQRS_WF.LISTA_ENVIO;}).length
      +(!esDirMets?tramPorNotifRows.length:0);
    const enRevision=listAll.filter(e=>{
      const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';
      return f===PQRS_WF.PENDIENTE_REVISION||f===PQRS_WF.REVISION_FINAL;
    }).length;
    const cardPorTrasl=showPorTrasl?pqrsMetCard('por_trasladar','border-left:3px solid #7c5cbf','<div class="v" style="color:#7c5cbf">'+pendTraslCount+'</div><div class="l">Por trasladar</div>','#7c5cbf'):'';
    mets.innerHTML=
      (showPorTrasl?cardPorTrasl:'')+
      pqrsMetCard('pend','border-left:3px solid var(--or)','<div class="v" style="color:var(--or)">'+porEjec+'</div><div class="l">Por ejecutar</div>','var(--or)')+
      pqrsMetCard('atras','border-left:3px solid var(--rd)','<div class="v" style="color:var(--rd)">'+vencidas+'</div><div class="l">Vencidas</div>','var(--rd)')+
      (enRevision?pqrsMetCard('revision','border-left:3px solid #6d3fa8','<div class="v" style="color:#6d3fa8">'+enRevision+'</div><div class="l">Por revisar</div>','#6d3fa8'):'')+
      (showParaImprimirCard&&paraFirma?pqrsMetCard('para_firma','border-left:3px solid #1a7a4a','<div class="v" style="color:#1a7a4a">'+paraFirma+'</div><div class="l">Por imprimir</div>','#1a7a4a'):'')+
      (showPorFirmarCard?pqrsMetCard('por_firmar','border-left:3px solid #0d5c2e','<div class="v" style="color:#0d5c2e">'+porFirmar+'</div><div class="l">Por firmar</div>','#0d5c2e'):'')+
      (showFirmadosCard?pqrsMetCard('firmados','border-left:3px solid #15803d','<div class="v" style="color:#15803d">'+firmados+'</div><div class="l">Firmados</div>','#15803d'):'')+
      (!esDirMets&&(porNotif||showPorFirmarCard)?pqrsMetCard('por_notificar','border-left:3px solid var(--bl)','<div class="v" style="color:var(--bl)">'+porNotif+'</div><div class="l">Por notificar</div>','var(--bl)'):'')+
      pqrsMetCard('cerr','border-left:3px solid var(--gn)','<div class="v" style="color:var(--gn)">'+cerr+'</div><div class="l">Respondidas</div>','var(--gn)');
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
    const on=String(window._pqrsOfiSelExp||'').trim()===String(e._exp||'').trim()+(e._tramite_firma_task?('#'+e._taskId):'');
    const wfBadge=e._tramite_firma_task
      ?(function(){
        const t=typeof getTaskAny==='function'?getTaskAny(e._exp,e._taskId):null;
        if(t&&typeof taskFirmaEnPorNotificar==='function'&&taskFirmaEnPorNotificar(t))
          return'<span class="bdg" style="background:#185FA522;color:#185FA5">📬 '+(e._oficina_firma?'Oficio':'Trámite')+' · Por notificar</span>';
        if(t&&typeof taskFirmaEsFirmadoPendiente==='function'&&taskFirmaEsFirmadoPendiente(t))
          return'<span class="bdg" style="background:#dcfce7;color:#15803d">✓ '+(e._oficina_firma?'Oficio':'Trámite')+' · Firmado</span>';
        return'<span class="bdg" style="background:#0d5c2e22;color:#0d5c2e">🖊 '+(e._oficina_firma?'Oficio':'Trámite')+' · Por firmar</span>';
      })()
      :(typeof htmlNcaRevisionBadge==='function'?htmlNcaRevisionBadge(e):'');
    const tipoLbl=e._tramite_firma_task
      ?((e._oficina_firma||e._tipo_solicitud==='Oficio oficina')?'Oficio':'Trámite')
      :(e._tipo_solicitud||'PQRSD');
    const clickFn=e._tramite_firma_task
      ?(typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv()
        ?('openTramiteDirectorFirmarModal(\''+escAttr(e._exp)+'\',\''+escAttr(e._taskId)+'\',\'ver\')')
        :('openTramiteDirectorFirmarModal(\''+escAttr(e._exp)+'\',\''+escAttr(e._taskId)+'\')'))
      :(filtro==='por_firmar'&&typeof esDirectorDsDeguv==='function'&&esDirectorDsDeguv()
        ?('openPqrsDirectorFirmarModal(\''+escAttr(e._exp)+'\',\'ver\')')
        :('openPqrsSidePanel(\''+escAttr(e._exp)+'\')'));
    return '<tr class="'+(on?'pqrs-ofi-row-sel':'')+'" style="cursor:pointer" onclick="'+clickFn+'"><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(tipoLbl)+'</td><td>'+escAttr(asunto)+'</td><td>'+fmtF(e._fecha)+'</td><td>'+(e._tramite_firma_task?'':pqrsEstadoConsultaBadge(e)+' ')+wfBadge+' '+(e._tramite_firma_task?'':pqrsMedioNotificacionFlagHtml(e,true))+'</td><td onclick="event.stopPropagation()">'+pqrsAccionesTablaHtml(e)+'</td></tr>';
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
    const tipos=['Petición','Queja','Reclamo','Denuncia','Sugerencia','Reunión','Audiencia'];
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
    if(usaDrive){
      const driveOk=typeof sstSolicitarDriveParaPqrs==='function'?await sstSolicitarDriveParaPqrs(e):false;
      if(!driveOk){notif('Conecte Drive institucional para subir anexos','warn');}
      else{
      const nombreCarpeta=e._qd_nombre||e._pn_nombre||e._pj_empresa||expId;
      const fechaRef=e._fecha||e._fecha_solicitud||'';
      for(const f of nuevosFiles){
        try{
          const up=await driveUploadInstitutional(f,'ANEXO PQRSD '+expId+' '+f.name,f.type||'application/octet-stream','radicacion_ventanilla',expId,nombreCarpeta,fechaRef,{expediente:e,uploadTarget:'solicitud'});
          attsRestantes.push({nombre:f.name,driveLink:up.driveLink,previewLink:up.previewLink||'',fileId:up.fileId||'',tipo:'archivo',mime:f.type||''});
        }catch(err){notif('No se pudo subir '+f.name+': '+String(err.message||err).slice(0,60),'warn');}
      }
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
function _pqrsNecesitaCorreoParaAsignar(e){
  if(!e)return false;
  if(!pqrsFueRadicadaPorCorreo(e))return false;
  if(!(e._gmail_message_id||''))return false;
  return true;
}
function _pqrsTokOk(){
  return (typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||
         (typeof _gmailOfiTokenValid==='function'&&_gmailOfiTokenValid());
}
function _pqrsHtmlBannerCorreoDesconectado(expId){
  return '<div id="pqrs-asig-gmail-warn" style="background:var(--warnl,#fff8e1);border:1px solid var(--warn,#f59e0b);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--tx)">'+
    '⚠️ Esta PQRSD fue radicada por correo. Para reenviar el correo original con sus anexos al responsable debe estar conectado a Gmail.<br>'+
    '<div class="fx" style="gap:8px;margin-top:8px">'+
    '<button type="button" class="btn bsm bp" id="pqrs-asig-gmail-conn-btn" onclick="_pqrsConectarCorreoYAsignar(\''+escAttr(expId)+'\')">📧 Conectar correo ahora</button>'+
    '<button type="button" class="btn bsm" onclick="_pqrsAsignarSinCorreo(\''+escAttr(expId)+'\')">Asignar sin reenviar correo</button>'+
    '</div></div>';
}
function _pqrsConectarCorreoYAsignar(expId){
  const btn=document.getElementById('pqrs-asig-gmail-conn-btn');
  if(btn){btn.disabled=true;btn.textContent='Conectando…';}
  const fn=typeof gmailOfiConnect==='function'?gmailOfiConnect:
            (typeof gmailConnect==='function'?gmailConnect:null);
  if(!fn){notif('Conexión Gmail no disponible','err');if(btn){btn.disabled=false;btn.textContent='📧 Conectar correo ahora';}return;}
  fn(function(){
    // Ya conectado → SOLO habilitar el botón Confirmar; NO asignar automáticamente.
    if(!_pqrsTokOk()){
      if(btn){btn.disabled=false;btn.textContent='📧 Conectar correo ahora';}
      notif('No se pudo conectar el correo. Intente de nuevo.','warn');
      return;
    }
    const warn=document.getElementById('pqrs-asig-gmail-warn');
    if(warn)warn.remove();
    const footer=document.getElementById('pqrs-asig-footer');
    if(footer)footer.innerHTML=
      '<button type="button" class="btn bsm bp" onclick="submitAsignarPqrsOficina(\''+escAttr(expId)+'\')">Confirmar asignación</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>';
    notif('✅ Correo conectado. Ahora confirme la asignación.','ok');
  });
}
function togglePqrsAsigModo(){
  const n=document.querySelectorAll('.pqrs-asig-resp-cb:checked').length;
  const w=document.getElementById('pqrs-asig-modo-wrap');
  if(w)w.style.display=n>1?'':'none';
}
function _pqrsAsignarSinCorreo(expId){
  window._pqrsAsignarForzarSinCorreo=true;
  submitAsignarPqrsOficina(expId);
}
function openAsignarPqrsOficinaModal(expId){
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  const oficina=e._pqrs_oficina||getPqrsOficinaActiva();
  if(!oficinaPuedeAsignarPqrs(oficina)){notif('Esta oficina no tiene contratistas de apoyo configurados para asignar','err');return;}
  abrirPqrsModalPrep();
  let responsables=getAsignablesPqrsOficina(oficina);
  if(!responsables.length){notif('No hay responsables configurados para esta oficina','err');return;}
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Asignar PQRSD · '+expId;
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  // Responsable(s) ya asignados previamente (para preseleccionar al reasignar)
  const yaAsig=[];
  if(e._pqrs_responsable_oficina)yaAsig.push(String(e._pqrs_responsable_oficina).trim());
  const existTk=(e.tasks||[]).find(t=>t&&!t.eliminada&&t.actividad&&String(t.actividad).startsWith('Atender PQRSD'));
  if(existTk){getTaskResponsables(existTk).forEach(n=>{if(n&&!yaAsig.some(x=>agendaNorm(x)===agendaNorm(n)))yaAsig.push(n);});}
  const respChecks=responsables.length
    ?responsables.map(n=>{
      const lbl=typeof labelAsignableConRol==='function'?labelAsignableConRol(n,oficina):n;
      return '<label class="act-libre-resp-row"><input type="checkbox" class="pqrs-asig-resp-cb" value="'+escAttr(n)+'"'+(yaAsig.some(r=>agendaNorm(r)===agendaNorm(n))?' checked':'')+' onchange="togglePqrsAsigModo()"><span class="act-libre-resp-nom">'+escAttr(lbl)+'</span></label>';
    }).join('')
    :'<div style="padding:10px;font-size:12px;color:var(--tx3)">No hay responsables configurados.</div>';
  const modoActual=existTk&&existTk.entregaModo==='unificada'?'unificada':'individual';
  const necesitaCorreo=_pqrsNecesitaCorreoParaAsignar(e);
  const tokOk=_pqrsTokOk();
  const bannerCorreo=(necesitaCorreo&&!tokOk)?_pqrsHtmlBannerCorreoDesconectado(expId):'';
  const obsPrev=String(e._pqrs_asig_observaciones||'').trim();
  body.innerHTML=bannerCorreo+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Oficina: <strong>'+escAttr(labelOficina(oficina))+'</strong></div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:.75rem">'+escAttr(e.f_f1||e._pqrs_detalle||'PQRSD')+'</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Responsable(s) que atenderá(n)<span class="req-star">*</span> <span style="font-weight:400;color:var(--tx3)">— incl. encargado; marque uno o varios</span></label>'+
    '<div id="pqrs-asig-resps" class="act-libre-resps-box">'+respChecks+'</div></div>'+
    '<div class="fld" id="pqrs-asig-modo-wrap" style="margin-bottom:8px;display:none"><label>Modo de entrega (varios responsables)</label>'+
    '<select id="pqrs-asig-modo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+
    '<option value="individual"'+(modoActual!=='unificada'?' selected':'')+'>Individual — cada uno entrega por aparte</option>'+
    '<option value="unificada"'+(modoActual==='unificada'?' selected':'')+'>Unificada — con una entrega se cierra para todos</option>'+
    '</select></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Observaciones para orientar la actividad <span style="font-weight:400;color:var(--tx3)">(opcional)</span></label>'+
    '<textarea id="pqrs-asig-obs" placeholder="Indicaciones para el/los responsable(s)…" style="width:100%;min-height:60px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif">'+escAttr(obsPrev)+'</textarea></div>'+
    htmlPqrsAdjuntosDrive(e)+
    (e._pqrs_solicitud_archivo?'<div style="font-size:12px;margin-bottom:8px;color:var(--tx2)">📄 Referencia: '+escAttr(e._pqrs_solicitud_archivo)+'</div>':'')+
    '<div class="fx" style="gap:8px" id="pqrs-asig-footer">'+
    (necesitaCorreo&&!tokOk?'':('<button type="button" class="btn bsm bp" onclick="submitAsignarPqrsOficina(\''+escAttr(expId)+'\')">Confirmar asignación</button>'))+
    (typeof bibGuardarEnBibliotecaBtnHtml==='function'?bibGuardarEnBibliotecaBtnHtml({tipo:'pqrsd',id:expId,label:expId}):'')+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'asignarPqrsOfi',expId};
  window._pqrsAsignarForzarSinCorreo=false;
  togglePqrsAsigModo();
}
async function submitAsignarPqrsOficina(expId){
  const responsables=[...document.querySelectorAll('.pqrs-asig-resp-cb:checked')].map(el=>el.value.trim()).filter(Boolean);
  if(!responsables.length){notif('Seleccione al menos un responsable','err');return;}
  const e=exps.find(x=>x._exp===expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  // Si viene de correo y no hay token: redirigir a conectar (a menos que el usuario eligió asignar sin correo)
  if(!window._pqrsAsignarForzarSinCorreo&&_pqrsNecesitaCorreoParaAsignar(e)&&!_pqrsTokOk()){
    notif('Conecte el correo para reenviar al responsable los anexos de la PQRSD, o use "Asignar sin reenviar correo".','warn');
    return;
  }
  window._pqrsAsignarForzarSinCorreo=false;
  const modoEl=document.getElementById('pqrs-asig-modo');
  const entregaModo=(modoEl&&responsables.length>1)?(modoEl.value==='unificada'?'unificada':'individual'):'individual';
  const obs=String((document.getElementById('pqrs-asig-obs')||{}).value||'').trim();
  const resp=responsables[0];
  const asignadosArr=responsables.map(n=>({nombre:n,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}));
  e._pqrs_responsable_oficina=resp;
  e._pqrs_estado_oficina='asignado';
  if(obs!==undefined)e._pqrs_asig_observaciones=obs;
  if(!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  const nomList=responsables.join(', ');
  e._pqrs_historial.push({tipo:'asignacion_oficina',fecha:hoy(),nota:'Asignado a '+nomList+(entregaModo==='unificada'?' (entrega unificada)':(responsables.length>1?' (entrega individual)':''))+(obs?' · Obs: '+obs:''),oficina:e._pqrs_oficina});
  const {vence,plazoDias}=pqrsPlazoTaskMeta(e);
  const prior=!!e._pqrs_prioritaria;
  const actNombre='Atender PQRSD';
  const detalle=obs||'';
  const tk=normalizeTask({
    id:genTaskId(),actividad:actNombre,detalle:detalle,desc:actNombre+(detalle?' — '+detalle:''),
    responsable:resp,responsables:responsables,asignados:asignadosArr,
    entregaModo:entregaModo,plazoDias:plazoDias,vence:vence,prioritaria:prior,
    comentarios:[],historial:[{tipo:'asignacion',fecha:hoy(),por:taskComentarioAutor(),nota:'PQRSD asignado desde oficina '+labelOficina(e._pqrs_oficina)+(obs?' · '+obs:'')}],soportes:[],notasDoc:[]
  });
  if(!Array.isArray(e.tasks))e.tasks=[];
  const existIdx=e.tasks.findIndex(t=>t&&!t.eliminada&&t.actividad&&String(t.actividad).startsWith('Atender PQRSD'));
  if(existIdx>=0)e.tasks[existIdx]=normalizeTask({...e.tasks[existIdx],responsable:resp,responsables:responsables,asignados:asignadosArr,entregaModo:entregaModo,detalle:detalle,desc:actNombre+(detalle?' — '+detalle:''),eliminada:false,prioritaria:prior,vence:vence,plazoDias:plazoDias});
  else e.tasks.push(tk);
  persistExpedienteGranular(e);
  closeTaskModal();
  notif('PQRSD asignado a '+nomList,'ok');
  // Reenviar correo a los responsables que aún no lo han recibido
  if(typeof tryReenvioPqrsCorreoAResponsables==='function'){
    await tryReenvioPqrsCorreoAResponsables(e,responsables,expId,{silent:false});
    if(e._pqrs_correo_reenviado_a&&e._pqrs_correo_reenviado_a.length)persistExpedienteGranular(e);
  }
  renderPqrsOficinaInbox();
  if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
  if(document.getElementById('pg-sec')&&document.getElementById('pg-sec').classList.contains('on'))renderSecretariaPqrs();
  refreshPqrsDetalleViews(expId);
  if(typeof isFormExpVisible==='function'&&isFormExpVisible(expId)&&typeof syncTkRowsFromExp==='function')syncTkRowsFromExp(expId,(existIdx>=0?e.tasks[existIdx].id:tk.id));
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
  const opts='<option value="">— Seleccionar oficina —</option>'+
    OFICINAS_DEGUV.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
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
  if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(e);
  await (typeof persistExpedienteGranularAsync==='function'?persistExpedienteGranularAsync(e,false):persistExpedienteGranular(e));
  closeTaskModal();
  notif('PQRSD trasladada a '+labelOficina(nuevaOfi),'ok');
  if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
  else{
    renderBandejaDepto();
    renderPqrsOficinaInbox();
    renderSecretariaPqrs();
    if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
    if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
  }
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
  const opts='<option value="">— Seleccionar oficina —</option>'+
    destinos.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
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
  tryReenvioPqrsCorreoTraslado(e,nuevaOfi,expId).then(async function(){
    if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(e);
    await (typeof persistExpedienteGranularAsync==='function'?persistExpedienteGranularAsync(e,false):persistExpedienteGranular(e));
    closeTaskModal();
    notif('PQRSD trasladado a '+labelOficina(nuevaOfi),'ok');
    if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
    else{
      renderBandejaDepto();
      renderPqrsOficinaInbox();
      renderSecretariaPqrs();
      if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
      if(document.getElementById('pg-act')&&document.getElementById('pg-act').classList.contains('on'))renderActividades();
      if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))renderConSidePanel();
    }
  });
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
  // Workflow interno (impresión, firma, asignación notificador): no visible al ciudadano
  if(h.tipo==='pasar_a_firma_director'||h.tipo==='firma_director'||h.tipo==='impreso_oficio'||
     h.tipo==='listo_firma'||h.tipo==='asignacion_notificador'||h.tipo==='vital_firma_completada'||
     h.tipo==='devuelto_director_firma'||h.tipo==='notif_pendiente_encargado'||
     h.tipo==='notif_reportada_revision'||h.tipo==='notificacion_personal_pendiente')return '';
  if(h.tipo==='entrega_respuesta_nca')return 'Respuesta en proceso de revisión interna';
  // Tras aprobación: un solo mensaje de proceso de notificación (sin detalle de imprimir/firmar)
  if(h.tipo==='revision_nca_aprobado_oficio'||h.tipo==='revision_nca_aprobado')return 'Respuesta aprobada — en proceso de notificación';
  if(h.tipo==='revision_nca_rechazado')return '';
  if(h.tipo==='notificacion_correo')return 'Respuesta notificada al ciudadano por correo';
  if(h.tipo==='notificacion_radicacion')return 'Radicación notificada al ciudadano por correo';
  if(h.tipo==='notificacion_excepcion')return 'Notificación por correo — excepción registrada';
  if(h.tipo==='revision_final_aprobada'||h.tipo==='revision_nca_canal_fisico')return 'Respuesta notificada — solicitud atendida';
  if(h.tipo==='recepcion_nca')return 'Recibido para trámite en NCA DEGUV';
  if(h.tipo==='informativa'||h.tipo==='informativa_aprobada')return 'Solicitud informativa — atendida';
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
  // En flujo de firma de trámite: solo tras publicar/notificar
  if(typeof taskEnFlujoFirmaTramite==='function'&&taskEnFlujoFirmaTramite(t))return false;
  if(t.publicado===false)return false;
  // Borradores internos (revisión / por firmar) no deben verse
  const hasDraft=(t.soportes||[]).some(function(s){
    const est=String(s.driveEstado||'').toLowerCase();
    return['revision','acorregir','por_firma','por_firmar','vital_gestion'].indexOf(est)>=0;
  });
  if(hasDraft&&!t.publicado)return false;
  return !!(t.publicado||t.verificadoPor||(t.historial||[]).some(h=>h.tipo==='verificacion'));
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
    foot.innerHTML='<span style="font-size:11px;color:var(--tx2);flex:1">Si la vista previa pide acceso, abra el documento en una ventana emergente.</span>'+
      (openUrl?'<button type="button" class="btn bsm bp" onclick="openDriveVentanaEmergente(\''+escAttr(openUrl)+'\')">↗ Abrir en ventana emergente</button>':'');
  }
  if(ov){
    if(typeof elevateOverlayAboveModals==='function')elevateOverlayAboveModals(ov);
    ov.classList.add('on');
    ov.setAttribute('aria-hidden','false');
  }
}
function closeCiudadanoDocViewer(){
  const ov=document.getElementById('ciudadano-doc-overlay');
  const ifr=document.getElementById('ciudadano-doc-iframe');
  const foot=document.getElementById('ciudadano-doc-foot');
  if(ov){
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden','true');
    if(typeof resetOverlayElevation==='function')resetOverlayElevation(ov);
  }
  if(ifr)ifr.src='';
  if(foot)foot.innerHTML='';
}
async function buscarExpCiudadano(){
  const q=String((document.getElementById('ciudadano-exp')||{}).value||'').trim();
  const box=document.getElementById('ciudadano-resultado');
  if(!box)return;
  if(!q){box.innerHTML='<div style="color:var(--tx3);font-size:12px">Ingrese el número de su trámite o PQRSD.</div>';return;}
  window._ciudadanoUltExp=q;
  let e=exps.find(x=>String(x._exp||'').trim().toLowerCase()===q.toLowerCase());
  if(!e){
    box.innerHTML='<div style="padding:12px;color:var(--tx2);font-size:13px">⏳ Buscando en el sistema…</div>';
    if(typeof fetchExpedientePorNumero==='function'){
      try{
        e=await fetchExpedientePorNumero(q);
        if(e){
          const idx=exps.findIndex(x=>String(x._exp||'').trim().toLowerCase()===String(e._exp||'').trim().toLowerCase());
          if(idx>=0)exps[idx]=e;else exps.push(e);
        }
      }catch(err){
        console.warn('buscarExpCiudadano fetch:',err);
      }
    }
  }
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
      if(!lbl)return;
      // Tras aprobación no mostrar detalle interno (quién firma / imprime / notifica)
      let notaRaw=h.nota||'';
      if(h.tipo==='revision_nca_aprobado'||h.tipo==='revision_nca_aprobado_oficio')notaRaw='';
      const nota=ciudadanoNotaPublica(h,notaRaw);
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
    else if((estT==='En ejecución'||estT==='Vencida'||estT==='Por corregir')&&!pqrsEstaCerrada(e))eventos.push({fecha:t.vence||'',html:'<div class="ciudadano-tl-item"><div class="tl-fecha">'+fmtF(t.vence||'')+'</div><div class="tl-nota">Actividad en gestión</div></div>'});
  });
  eventos.sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
  const tlHtml=eventos.length?eventos.map(ev=>ev.html).join(''):'<div style="font-size:12px;color:var(--tx3)">Sin movimientos registrados aún.</div>';
  const docsTask=(esPqrs&&typeof pqrsEstaCerrada==='function'&&pqrsEstaCerrada(e))?[]:getDocsAprobadosCiudadano(e);
  const docsPqrsSol=getDocsPqrsSolicitudCiudadano(e);
  const docsPqrs=getDocsPqrsRespuestaCiudadano(e);
  const docsTram=getDocsTramiteCiudadano(e);
  const docs=[...docsPqrsSol];
  docsPqrs.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  docsTram.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  docsTask.forEach(d=>{if(!docs.some(x=>(x.url||x.preview)===(d.url||d.preview)))docs.push(d);});
  // Documentos de PQRSD / expedientes vinculados (asociación bidireccional)
  if(typeof getExpAsociadosAll==='function'){
    getExpAsociadosAll(e).forEach(function(num){
      if(typeof expAsocMatchNum==='function'&&expAsocMatchNum(num,e._exp))return;
      const asoc=typeof findExpByNumPlain==='function'?findExpByNumPlain(num):null;
      if(!asoc)return;
      const tag=typeof expAsocEsRegistroPqrs==='function'&&expAsocEsRegistroPqrs(asoc)
        ?('PQRSD asociada · '+asoc._exp):('Exp. asociado · '+asoc._exp);
      const asocDocs=[].concat(
        getDocsPqrsSolicitudCiudadano(asoc),
        getDocsPqrsRespuestaCiudadano(asoc),
        getDocsTramiteCiudadano(asoc),
        getDocsAprobadosCiudadano(asoc)
      );
      asocDocs.forEach(function(d){
        if(!d||!(d.url||d.preview))return;
        if(docs.some(function(x){return (x.url||x.preview)===(d.url||d.preview);}))return;
        docs.push({url:d.url,preview:d.preview||d.url,label:d.label||'Documento',tipo:tag+' · '+(d.tipo||'Documento'),mime:d.mime||'',fecha:d.fecha||''});
      });
    });
  }
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
    if(e._pqrs_informativa){
      respuestaHtml='<div style="margin-bottom:12px;padding:12px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);border-left:4px solid var(--tx2)">'+
        '<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">ℹ Solicitud informativa — atendida</div>'+
        (fechaResp?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Fecha: <strong>'+fmtF(fechaResp)+'</strong></div>'):'')+
        (cuerpo?('<div style="font-size:12px;margin-top:8px;padding:8px;background:#fff;border-radius:var(--r);white-space:pre-wrap;color:var(--tx)">'+escAttr(cuerpo)+'</div>'):'')+
        '</div>';
    }else{
      respuestaHtml='<div style="margin-bottom:12px;padding:12px;background:var(--gnl);border:1px solid #b2dfdb;border-radius:var(--r);border-left:4px solid var(--gn)">'+
        '<div style="font-size:12px;font-weight:700;color:var(--gn);margin-bottom:6px">✅ Esta solicitud fue respondida</div>'+
        (fechaResp?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Fecha de respuesta: <strong>'+fmtF(fechaResp)+'</strong></div>'):'')+
        (oficio?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">N° de oficio: <strong>'+escAttr(oficio)+'</strong></div>'):'')+
        (canalLabel?('<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Canal de notificación: <strong>'+escAttr(canalLabel)+'</strong></div>'):'')+
        (cuerpo?('<div style="font-size:12px;margin-top:8px;padding:8px;background:#fff;border-radius:var(--r);white-space:pre-wrap;color:var(--tx)">'+escAttr(cuerpo)+'</div>'):'')+
        '</div>';
    }
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