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
function poblarSecOficinaSelect(){
  const sel=document.getElementById('sec-oficina');
  if(!sel)return;
  sel.innerHTML='<option value="">— Seleccione oficina —</option>'+OFICINAS_DEGUV.map(o=>'<option value="'+escAttr(o.id)+'">'+escAttr(o.nombre)+'</option>').join('');
  updateSecFechaRadicVisibility();
  initSecMedioNotificacion(true);
}
function toggleSecAnonimo(){
  const anon=!!(document.getElementById('sec-anonimo')&&document.getElementById('sec-anonimo').checked);
  ['sec-pn-nombre','sec-pn-identificacion','sec-pn-correo','sec-pn-telefono','sec-pj-empresa','sec-pj-nit','sec-pj-correo','sec-pj-telefono','sec-pj-ofi-nombre','sec-pj-ofi-identificacion','sec-pj-ofi-correo','sec-pj-ofi-telefono','sec-tipo-persona'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.disabled=anon;if(anon)el.value='';}
  });
  const tp=document.getElementById('sec-tipo-persona');if(tp&&anon)tp.value='natural';
  toggleSecPersona();
}
function toggleSecPersona(){
  const anon=!!(document.getElementById('sec-anonimo')&&document.getElementById('sec-anonimo').checked);
  const tp=(document.getElementById('sec-tipo-persona')||{}).value||'natural';
  const pn=document.getElementById('sec-pn-block');
  const pj=document.getElementById('sec-pj-block');
  if(pn)pn.style.display=(!anon&&tp==='natural')?'':'none';
  if(pj)pj.style.display=(!anon&&tp==='juridica')?'':'none';
}
function limpiarFormSecretaria(){
  // Ocultar tarjeta de referencia de correo si estaba visible
  const refCard=document.getElementById('gmail-ref-card');if(refCard)refCard.style.display='none';
  ['sec-exp','sec-asunto','sec-detalle','sec-link','sec-archivo','sec-fecha-termino','sec-fecha-solicitud','sec-pn-nombre','sec-pn-identificacion','sec-pn-correo','sec-pn-telefono','sec-pj-empresa','sec-pj-nit','sec-pj-correo','sec-pj-telefono','sec-pj-ofi-nombre','sec-pj-ofi-identificacion','sec-pj-ofi-correo','sec-pj-ofi-telefono'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const tp=document.getElementById('sec-tipo-persona');if(tp)tp.value='natural';
  const anon=document.getElementById('sec-anonimo');if(anon)anon.checked=false;
  const pri=document.getElementById('sec-prioritaria');if(pri)pri.checked=false;
  toggleSecAnonimo();
  poblarSecOficinaSelect();
  const hid=document.getElementById('sec-medio-notif');if(hid){hid.value='';delete hid.dataset.userSet;}
  initSecMedioNotificacion(true);
}
function guardarPqrsSecretaria(){
  const expId=String((document.getElementById('sec-exp')||{}).value||'').trim();
  const fecha=puedeEditarFechaRadicacionPqrs()?((document.getElementById('sec-fecha')||{}).value||hoy()):hoy();
  const fechaSol=String((document.getElementById('sec-fecha-solicitud')||{}).value||'').trim();
  const fechaTermino=String((document.getElementById('sec-fecha-termino')||{}).value||'').trim();
  const tipo=(document.getElementById('sec-tipo')||{}).value||'Petición';
  const medio=normMedioRecepcionPqrs((document.getElementById('sec-medio')||{}).value||'');
  const anon=!!((document.getElementById('sec-anonimo')||{}).checked);
  const tipoPersona=anon?'natural':((document.getElementById('sec-tipo-persona')||{}).value||'natural');
  let nombre='',ident='',correo='',tel='';
  const pjFields={};
  if(!anon){
    if(tipoPersona==='juridica'){
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
    }else{
      nombre=String((document.getElementById('sec-pn-nombre')||{}).value||'').trim();
      ident=String((document.getElementById('sec-pn-identificacion')||{}).value||'').trim();
      correo=String((document.getElementById('sec-pn-correo')||{}).value||'').trim();
      tel=String((document.getElementById('sec-pn-telefono')||{}).value||'').trim();
    }
  }
  const asunto=String((document.getElementById('sec-asunto')||{}).value||'').trim();
  const detalle=String((document.getElementById('sec-detalle')||{}).value||'').trim();
  const oficina=(document.getElementById('sec-oficina')||{}).value||'';
  const link=String((document.getElementById('sec-link')||{}).value||'').trim();
  const archivo=String((document.getElementById('sec-archivo')||{}).value||'').trim();
  const medioNotif=medioNotificacionNorm((document.getElementById('sec-medio-notif')||{}).value||'');
  const prioritaria=!!((document.getElementById('sec-prioritaria')||{}).checked);
  if(!expId){notif('Indique el número de PQRSD','err');return;}
  if(!fechaSol){notif('Indique la fecha de solicitud del ciudadano','err');return;}
  if(!asunto){notif('Indique el asunto de la solicitud','err');return;}
  if(!oficina){notif('Seleccione la oficina destino','err');return;}
  if(fechaTermino&&fechaTermino<fechaSol){notif('La fecha de término no puede ser anterior a la fecha de solicitud','err');return;}
  const dupPqrs=expNumeroDuplicado(expId);
  if(dupPqrs){alertRegistroDuplicado(expId,'pqrs',dupPqrs);return;}
  const tramId=getTramPqrsId('guaviare');
  const detNotas=detalle?JSON.stringify([{texto:detalle,autor:'Secretaría DEGUV',fecha:fecha}]):'[]';
  const hist=[{tipo:'radicacion',fecha:fecha,nota:'Radicado por Secretaría DEGUV',oficina:''}];
  if(oficina==='secretaria'){
    hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Asignado a Secretaría DEGUV para gestión directa',oficina:'secretaria',oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
  }else{
    hist.push({tipo:'traslado_oficina',fecha:hoy(),nota:'Traslado inicial a oficina competente',oficina:oficina,oficinaAnterior:'secretaria',por:'Secretaría DEGUV'});
  }
  // Sprint B: capturar Gmail message id si viene de un correo
  const gmailMsgId=window._gmailPendingMsgId||'';
  // Sprint C: capturar adjuntos subidos a Drive
  const gmailAtts=Array.isArray(window._gmailPendingAttachments)&&window._gmailPendingAttachments.length
    ?window._gmailPendingAttachments:null;
  // Si hay adjuntos de Drive y no se puso link manual, usar el primer link como principal
  // El campo _pqrs_gmail_attachments guarda todos los links para acceso completo
  const linkFinal=link||(gmailAtts&&gmailAtts[0]?gmailAtts[0].driveLink:'');
  // Responsable: encargado configurado para la oficina destino
  const encargadoOfi=typeof getEncargadoOficina==='function'?getEncargadoOficina(oficina):'';
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
    _radicado_secretaria:true,_pqrs_oficina:oficina,_pqrs_traslado_fecha:hoy(),_pqrs_traslado_por:'Secretaría DEGUV',
    _pqrs_estado_oficina:'pendiente',_pqrs_responsable_oficina:encargadoOfi,
    _pqrs_solicitud_link:linkFinal,_pqrs_solicitud_archivo:archivo,_pqrs_detalle:detalle,
    _pqrs_historial:hist,tasks:[],
    // Sprint B: trazabilidad del correo origen
    _gmail_message_id:gmailMsgId||undefined,
    // Sprint C: links de adjuntos subidos a Drive
    _pqrs_gmail_attachments:gmailAtts||undefined
  });
  exps.push(data);
  if(oficina==='guaviare')ensureTareaPqrsNca(data);
  else if(oficina!=='secretaria')ensureTareaPqrsOficina(data,oficina);
  upsertPersonaCatalog(data);
  logAudit('Creó PQRSD ['+expId+']','pqrsd',expId);
  persistExpedienteGranular(data,true);
  // Sprint D: reenviar correo a oficina si hay token Gmail y oficina tiene correo
  if(gmailMsgId&&typeof gmailIsTokenValid==='function'&&gmailIsTokenValid()&&typeof _gmailCurrentMsg!=='undefined'&&_gmailCurrentMsg&&_gmailCurrentMsg.id===gmailMsgId){
    reenviarEmailAOficina(_gmailCurrentMsg,oficina,expId);
    // Marcar como leído (quitar la N de no radicado)
    if(typeof gmailMarkAsRead==='function')gmailMarkAsRead(gmailMsgId);
  }
  // Limpiar datos Gmail pendientes
  window._gmailPendingMsgId=null;
  window._gmailPendingAttachments=null;
  renderBandejaDepto();
  notif('PQRSD '+expId+(oficina==='secretaria'?' radicado en Secretaría DEGUV':' radicado y trasladado a '+labelOficina(oficina)),'ok');
  limpiarFormSecretaria();
  renderSecretariaPqrs();
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
function renderSecretariaPqrs(){
  const all=getSecretariaPqrsAll();
  const asignadas=all.filter(e=>e._pqrs_oficina);
  const atendidas=all.filter(e=>pqrsEstaCerrada(e));
  const mets=document.getElementById('sec-pqrs-mets');
  if(mets)mets.innerHTML=
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+all.length+'</div><div class="l">Radicadas</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+asignadas.filter(e=>!pqrsEstaCerrada(e)).length+'</div><div class="l">En gestión</div></div>'+
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+atendidas.length+'</div><div class="l">Atendidas</div></div>';
  const tb=document.getElementById('tbl-sec-pqrs');
  if(tb){
    if(!asignadas.length)tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:16px">Sin PQRSD en seguimiento.</td></tr>';
    else tb.innerHTML=asignadas.map(e=>{
      const asunto=e.f_f1||e._pqrs_detalle||'—';
      return '<tr><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+escAttr(labelOficina(e._pqrs_oficina))+'</td><td>'+pqrsEstadoConsultaBadge(e)+'</td><td>'+fmtF(e._fecha)+'</td>'+
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
  let list=exps.filter(e=>esPqrsSecretaria(e)&&e._pqrs_oficina===oficinaId).map(normalizePqrsOficinaFields);
  if(filtro==='pend')list=list.filter(e=>!pqrsEstaCerrada(e)&&!pqrsEstaAtrasada(e));
  else if(filtro==='atras')list=list.filter(e=>pqrsEstaAtrasada(e));
  else if(filtro==='cerr')list=list.filter(e=>pqrsEstaCerrada(e));
  list=filterExpsPeriodo(list,'pqrs-ofi');
  return list.sort((a,b)=>String(b._pqrs_traslado_fecha||b._fecha||'').localeCompare(String(a._pqrs_traslado_fecha||a._fecha||'')));
}
function pqrsAccionesTablaHtml(e){
  const id=jsStr(e._exp);
  let h='<button type="button" class="btn bsm" onclick="event.stopPropagation();openPqrsSidePanel(\''+id+'\')">Ver</button> ';
  if(puedeTrasladarPqrs(e))h+='<button type="button" class="btn bsm" onclick="event.stopPropagation();openTrasladoPqrsInterOficinaModal(\''+id+'\')">Trasladar</button> ';
  if(puedeAsignarPqrsOficina(e))h+='<button type="button" class="btn bsm" onclick="event.stopPropagation();openAsignarPqrsOficinaModal(\''+id+'\')">Asignar</button> ';
  if(puedeMarcarPqrsRespondida(e))h+='<button type="button" class="btn bsm bp" onclick="event.stopPropagation();openPqrsRespuestaModal(\''+id+'\')">Responder</button> ';
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
  if(tit&&ofi)tit.textContent='PQRSD — '+ofi.nombre;
  if(ban)ban.style.display='none';
  const pr=document.getElementById('pqrs-ofi-periodo-resumen');
  const prLbl=labelPeriodo('pqrs-ofi');
  if(pr)pr.textContent=prLbl?('Filtro de fechas (radicación): '+prLbl):'';
  if(!tb)return;
  const listAll=getPqrsOficinaList(getPqrsOficinaActiva(),'all');
  const list=getPqrsOficinaList(getPqrsOficinaActiva(),filtro);
  if(mets){
    const pend=listAll.filter(e=>!pqrsEstaCerrada(e)&&!pqrsEstaAtrasada(e)).length;
    const atras=listAll.filter(e=>pqrsEstaAtrasada(e)).length;
    const cerr=listAll.filter(e=>pqrsEstaCerrada(e)).length;
    const onAll=filtro==='all'?'outline:2px solid var(--bl);':'';
    const onPend=filtro==='pend'?'outline:2px solid var(--or);':'';
    const onAtras=filtro==='atras'?'outline:2px solid var(--rd);':'';
    const onCerr=filtro==='cerr'?'outline:2px solid var(--gn);':'';
    mets.innerHTML=
      pqrsMetCard('all',onAll+'border-left:3px solid var(--bl)','<div class="v" style="color:var(--bl)">'+listAll.length+'</div><div class="l">Total</div>')+
      pqrsMetCard('pend',onPend+'border-left:3px solid var(--or)','<div class="v" style="color:var(--or)">'+pend+'</div><div class="l">Pendientes</div>')+
      pqrsMetCard('atras',onAtras+'border-left:3px solid var(--rd)','<div class="v" style="color:var(--rd)">'+atras+'</div><div class="l">Atrasados</div>')+
      pqrsMetCard('cerr',onCerr+'border-left:3px solid var(--gn)','<div class="v" style="color:var(--gn)">'+cerr+'</div><div class="l">Respondidas</div>');
  }
  if(!list.length){
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:16px">No hay PQRSD en este filtro.</td></tr>';
    if(detBox){detBox.style.display='none';detBox.innerHTML='';}
    window._pqrsOfiSelExp=null;
    return;
  }
  const sel=String(window._pqrsOfiSelExp||'').trim();
  if(!sel||!list.some(e=>String(e._exp||'').trim()===sel))window._pqrsOfiSelExp=String(list[0]._exp||'').trim();
  tb.innerHTML=list.map(e=>{
    const asunto=e.f_f1||e._pqrs_detalle||'—';
    const on=String(window._pqrsOfiSelExp||'').trim()===String(e._exp||'').trim();
    return '<tr class="'+(on?'pqrs-ofi-row-sel':'')+'" style="cursor:pointer" onclick="openPqrsSidePanel(\''+escAttr(e._exp)+'\')"><td><strong>'+escAttr(e._exp)+'</strong> '+pqrsPrioritariaBadge(e)+'</td><td>'+escAttr(e._tipo_solicitud||'PQRSD')+'</td><td>'+escAttr(asunto)+'</td><td>'+fmtF(e._fecha)+'</td><td>'+pqrsEstadoConsultaBadge(e)+' '+pqrsMedioNotificacionFlagHtml(e,true)+'</td><td>'+pqrsAccionesTablaHtml(e)+'</td></tr>';
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
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:10px"><input type="checkbox" id="pqrs-edit-anonimo"'+(anon?' checked':'')+' onchange="toggleEditPqrsAnonimo()"> Solicitud anónima</label>'+
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
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Link documento</label><input type="url" id="pqrs-edit-link" value="'+escAttr(e._pqrs_solicitud_link||'')+'"></div>'+
    '<div class="fld"><label>Referencia archivo</label><input type="text" id="pqrs-edit-archivo" value="'+escAttr(e._pqrs_solicitud_archivo||'')+'"></div>'+
    '</div>'+
    '<div class="fx" style="gap:8px"><button type="button" class="btn bsm bp" data-pqrs-edit-submit="'+escAttr(expId)+'">Guardar cambios</button><button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
    const btns=document.getElementById('pqrs-edit-medio-notif-btns');
    if(btns)btns.innerHTML=htmlMedioNotificacionBtns(rec._medio_notificacion||'','pqrs-edit','setEditPqrsMedioNotificacion');
    if(anon)toggleEditPqrsAnonimo();else toggleEditPqrsPersona();
    ov.classList.add('on');
  }catch(err){
    console.error('openEditPqrsSecretariaModal',err);
    cerrarPqrsModalPrep();
    notif('No se pudo abrir el editor: '+(err&&err.message?err.message:'revise los datos'),'err');
  }
}
function submitEditPqrsSecretaria(expId){
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
  const link=String((document.getElementById('pqrs-edit-link')||{}).value||'').trim();
  const archivo=String((document.getElementById('pqrs-edit-archivo')||{}).value||'').trim();
  const medioNotif=medioNotificacionNorm((document.getElementById('pqrs-edit-medio-notif')||{}).value||'');
  const prior=!!((document.getElementById('pqrs-edit-prior')||{}).checked);
  if(!asunto){notif('Indique el asunto','err');return;}
  if(!oficina){notif('Seleccione oficina','err');return;}
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
  e._pqrs_solicitud_link=link;e._pqrs_solicitud_archivo=archivo;
  if(anon){
    e._pn_nombre='';e._pn_identificacion='';e._pn_correo='';e._pn_telefono='';
    e._pj_empresa='';e._pj_nit='';e._pj_correo='';e._pj_telefono='';
    e._qd_nombre='';e._qd_identificacion='';e._qd_correo='';e._qd_telefono='';
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
  box.innerHTML='<div style="padding:14px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:12px">'+
    '<div style="font-size:16px;font-weight:700;margin-bottom:6px">'+escAttr(e._exp)+'</div>'+
    '<div style="font-size:13px;margin-bottom:4px">Trámite: <strong>'+escAttr(tram?tram.nombre:(esPqrs?'PQRSD':'—'))+'</strong></div>'+
    (esPqrs?('<div style="font-size:13px;margin-bottom:4px">Tipo: <strong>'+escAttr(e._tipo_solicitud||'PQRSD')+'</strong></div>'):'')+
    '<div style="font-size:13px;margin-bottom:4px">Estado actual: <strong>'+escAttr(est)+'</strong></div>'+
    (esPqrs&&e.f_f1?('<div style="font-size:12px;color:var(--tx2)">Asunto: '+escAttr(e.f_f1)+'</div>'):'')+
    '</div>'+
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