// =============================================================================
// consulta.js — TABLA REGISTRO + CONSULTA
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// TABLA REGISTRO
// ================================================================
const REG_TABLA_PAGE=10;
const REG_TABLA_MAX=30;
function renderTabla(){
  poblarTramSelect();
  const q=(document.getElementById('sreg').value||'').toLowerCase();
  const ft=document.getElementById('freg-tr').value;
  const fe=document.getElementById('freg-est').value;
  const fter=document.getElementById('freg-ter').value;
  let list=expsAmbito().filter(e=>{
    const vals=Object.values(e).map(v=>String(v||'').toLowerCase()).join(' ');
    const m=!q||vals.includes(q);
    const ter=calcTerminos(e);
    const mter=!fter||(ter&&ter.estado===fter);
    return m&&(!ft||e._tramite===ft)&&(!fe||e._estado===fe)&&mter;
  });
  if(esUsuarioContratista())list=list.filter(expVisibleParaContratista);
  list=list.slice().sort((a,b)=>String(b._fecha||'').localeCompare(String(a._fecha||'')));
  const filterKey=q+'|'+ft+'|'+fe+'|'+fter;
  if(window._regTablaFilterKey!==filterKey){window._regTablaShown=REG_TABLA_PAGE;window._regTablaFilterKey=filterKey;}
  document.getElementById('cnt-bdg').textContent=expsAmbito().length;
  const tb=document.getElementById('tbl-reg');
  const moreBtn=document.getElementById('reg-tabla-more');
  const soloLec=esSoloLectura();
  if(!list.length){tb.innerHTML='<tr><td colspan="8" class="emp">Sin expedientes.</td></tr>';if(moreBtn)moreBtn.style.display='none';return;}
  if(window._regTablaShown==null)window._regTablaShown=REG_TABLA_PAGE;
  const lim=Math.min(window._regTablaShown,REG_TABLA_MAX,list.length);
  const slice=list.slice(0,lim);
  tb.innerHTML=slice.map(e=>{
    const ter=calcTerminos(e);
    const myPend=esModoResponsable()&&responsableActivo?(e.tasks||[]).filter(t=>t.responsable===responsableActivo&&estadoTask(t)!=='Atendida'):[];
    const pendHtml=myPend.length?'<div style="font-size:11px;color:var(--pu)">'+myPend.length+' actividad(es) suya(s) pendiente(s)</div>':'';
    const acts=soloLec||esUsuarioContratista()?'<button type="button" class="btn bsm bic" data-exp-view="'+escAttr(e._exp)+'" onclick="verCon(this.getAttribute(\'data-exp-view\'))" title="Ver">🔍</button>':
      expBtnEditHtml(e._exp,{title:'Editar expediente'})+
      '<button type="button" class="btn bsm bic" data-exp-view="'+escAttr(e._exp)+'" onclick="verCon(this.getAttribute(\'data-exp-view\'))" title="Ver">🔍</button>'+
      '<button type="button" class="btn bsm bic bd2" data-exp-del="'+escAttr(e._exp)+'" onclick="eliminarExp(this.getAttribute(\'data-exp-del\'))" title="Eliminar">🗑</button>';
    return '<tr>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:12px;font-weight:500;color:var(--bl)">'+escAttr(e._exp)+expLockIconHtml(e._exp)+'</td>'+
      '<td>'+badgeTram(e._tramite,e)+badgeDepto(e._depto)+'</td>'+
      '<td style="font-weight:600">'+escAttr(getNom(e))+pendHtml+'</td>'+
      '<td>'+badgeEst(e._estado)+'</td>'+
      '<td>'+termsBdg(ter)+'</td>'+
      '<td style="font-size:12px">'+( ter?ter.d+' / '+ter.plazo+' '+(UNIDAD_LABEL[ter.unidad]||'d'):'-')+'</td>'+
      '<td>'+flagsHtml(e,true)+'</td>'+
      '<td style="white-space:nowrap">'+acts+'</td></tr>';
  }).join('');
  if(moreBtn){
    const rest=Math.min(list.length,REG_TABLA_MAX)-lim;
    if(rest>0){
      moreBtn.style.display='';
      moreBtn.textContent='Ver 10 más ('+rest+' restantes, máx. '+REG_TABLA_MAX+') — anteriores en Consulta';
    }else{
      moreBtn.style.display='none';
    }
  }
}
function regTablaVerMas(){
  window._regTablaShown=Math.min((window._regTablaShown||REG_TABLA_PAGE)+REG_TABLA_PAGE,REG_TABLA_MAX);
  renderTabla();
}

// ================================================================
// CONSULTA — LÍNEA DE TIEMPO COMPLETA
// ================================================================
function matchS(e,q){
  if(!q)return true;
  const ql=q.toLowerCase().trim();
  if(!ql)return true;
  if(String(e._exp||'').toLowerCase().trim()===ql)return true;
  if(Object.values(e).some(v=>{
    if(v==null||typeof v==='object')return false;
    return String(v).toLowerCase().includes(ql);
  }))return true;
  if(e._usar_exp_asociados&&expedientesAsociadosData(e._expedientes_asociados).some(n=>String(n||'').toLowerCase().includes(ql)))return true;
  // Cuerpo / asunto del correo de radicación (PQRSD por correo)
  const gd=e&&e._gmail_email_data;
  if(gd&&typeof gd==='object'){
    const plainHtml=String(gd.cuerpoHtml||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
    const blob=[gd.asunto,gd.cuerpoTxt,gd.from,gd.to,gd.cc,gd.snippet,plainHtml].join(' ').toLowerCase();
    if(blob.includes(ql))return true;
    if(Array.isArray(gd.adjuntosInfo)&&gd.adjuntosInfo.some(function(a){
      return String((a&&a.nombre)||'').toLowerCase().includes(ql);
    }))return true;
  }
  // Workflow PQRSD (cuerpo de respuesta, oficio, etc.)
  const wf=e&&e._pqrs_workflow;
  if(wf&&typeof wf==='object'){
    const wblob=[wf.cuerpo,wf.oficio,wf.email_subject,wf.email_to,wf.email_cc,wf.nota].join(' ').toLowerCase();
    if(wblob.includes(ql))return true;
  }
  return false;
}
function cambiarDeptoActivo(deptoId){
  syncCfgToStore();
  deptoActivo=deptoId;
  setCfgPtr(deptoId);
  const sel=document.getElementById('sel-depto');
  if(sel)sel.value=deptoId;
  updateDeptoUI();
  poblarTramSelect();
}
function contarPorDepto(list){
  const c={};
  DEPTOS.forEach(d=>c[d.id]=0);
  (list||[]).forEach(e=>{const d=e._depto||'guaviare';if(c[d]!==undefined)c[d]++;});
  return c;
}
function pieChartDeptoHtml(counts){
  const entries=DEPTOS.map(d=>({id:d.id,nombre:labelDepartamento(d.id),v:counts[d.id]||0})).filter(x=>x.v>0);
  const total=entries.reduce((s,x)=>s+x.v,0);
  if(!total)return'<div style="font-size:12px;color:var(--tx3)">Sin expedientes</div>';
  let acc=0;
  const stops=entries.map(ent=>{
    const pct=ent.v/total*100;
    const col=DEPTO_CHART_COLORS[ent.id]||'#888';
    const start=acc;
    acc+=pct;
    return col+' '+start+'% '+acc+'%';
  }).join(',');
  const legend=entries.map(ent=>'<div style="display:flex;align-items:center;gap:6px;font-size:12px"><span style="width:11px;height:11px;border-radius:3px;background:'+DEPTO_CHART_COLORS[ent.id]+';flex-shrink:0"></span><span>'+ent.nombre+': <strong>'+ent.v+'</strong> <span style="color:var(--tx3)">('+Math.round(ent.v/total*100)+'%)</span></span></div>').join('');
  return '<div class="juris-stats"><div class="pie-chart" style="background:conic-gradient('+stops+')" title="'+total+' expediente(s)"></div><div class="pie-legend">'+legend+'</div></div>';
}
function estadoExpNormalizado(e){
  return isArchivadoEstado(e._estado)?'Archivado o anulado':(e._estado||'Solicitud');
}
function expEnTramiteActivo(e){
  return !FINALS.includes(e._etapa)&&!isArchivadoEstado(e._estado)&&e._estado!=='Atendido'&&e._estado!=='Seguimiento';
}
function jurisTramiteOpciones(fullList){
  const map=new Map();
  (fullList||[]).forEach(e=>{
    const tid=e._tramite;
    if(!tid)return;
    const tr=getTram(tid,e);
    if(!map.has(tid))map.set(tid,tr&&tr.nombre?tr.nombre:tid);
  });
  return Array.from(map.entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
}
function filtrarJurisConsList(list){
  const fd=window._jurisFiltroDepto||'';
  const ft=window._jurisFiltroTram||'';
  return(list||[]).filter(e=>{
    if(fd&&String(e._depto||'guaviare')!==fd)return false;
    if(ft&&String(e._tramite||'')!==ft)return false;
    return true;
  });
}
function esDeptoConsFiltroActivo(){
  return !esJurisdiccional()&&!esModoResponsable()&&DEPTOS.some(d=>d.id===deptoActivo);
}
function filtrarDeptoConsList(list){
  const ft=window._deptoConsFiltroTram||'';
  if(!ft)return list||[];
  return(list||[]).filter(e=>String(e._tramite||'')===ft);
}
function onDeptoConsFiltroChange(){
  const tSel=document.getElementById('depto-f-tram');
  window._deptoConsFiltroTram=tSel?tSel.value:'';
  renderConsolidado();
}
function onJurisFiltroChange(){
  const dSel=document.getElementById('juris-f-depto');
  const tSel=document.getElementById('juris-f-tram');
  window._jurisFiltroDepto=dSel?dSel.value:'';
  window._jurisFiltroTram=tSel?tSel.value:'';
  renderConsolidado();
}
function renderJurisConsolidadoStats(list,fullList){
  const el=document.getElementById('cons-juris-panel');
  if(!el)return;
  const juris=esJurisdiccional();
  const deptoF=esDeptoConsFiltroActivo();
  if(!juris&&!deptoF){el.style.display='none';el.innerHTML='';return;}
  el.style.display='';
  fullList=fullList||window._jurisConsListCache||list||[];
  list=list||fullList;
  if(deptoF&&!juris){
    const ft=window._deptoConsFiltroTram||'';
    const tramOpts=jurisTramiteOpciones(fullList);
    const total=list.length;
    el.innerHTML='<div class="slbl">Filtros consolidado — '+escAttr(labelDepto(deptoActivo))+' ('+total+' expediente'+(total!==1?'s':'')+(ft?' · filtrado':'')+')</div>'+
      '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Filtre por tipo de trámite dentro del departamento.</div>'+
      '<div class="juris-filtros-bar">'+
      '<div class="fld"><label>Tipo de trámite</label><select id="depto-f-tram" onchange="onDeptoConsFiltroChange()">'+
      '<option value=""'+(ft===''?' selected':'')+'>Todos los trámites</option>'+
      tramOpts.map(([tid,nom])=>'<option value="'+escAttr(tid)+'"'+(ft===tid?' selected':'')+'>'+escAttr(nom)+'</option>').join('')+
      '</select></div>'+
      (ft?'<button type="button" class="btn bsm" onclick="window._deptoConsFiltroTram=\'\';renderConsolidado()">Limpiar filtro</button>':'')+
      '</div>';
    return;
  }
  const fd=window._jurisFiltroDepto||'';
  const ft=window._jurisFiltroTram||'';
  const tramOpts=jurisTramiteOpciones(fullList);
  const deptoRows=fd?DEPTOS.filter(d=>d.id===fd):DEPTOS;
  const total=list.length;
  const countsTotal=contarPorDepto(list);
  const countsTramite=contarPorDepto(list.filter(expEnTramiteActivo));
  const porEstado={};
  ESTADOS.forEach(est=>{porEstado[est]=contarPorDepto(list.filter(e=>estadoExpNormalizado(e)===est));});
  const filasDepto=deptoRows.map(d=>{
    const id=d.id;
    const t=countsTotal[id]||0;
    const tr=countsTramite[id]||0;
    const sol=porEstado['Solicitud'][id]||0;
    const et=porEstado['En trámite'][id]||0;
    const ate=porEstado['Atendido'][id]||0;
    const seg=porEstado['Seguimiento'][id]||0;
    const arch=porEstado['Archivado o anulado'][id]||0;
    return '<tr><td style="font-weight:600">'+labelDepartamento(d.id)+'</td><td style="text-align:center;font-weight:700">'+t+'</td><td style="text-align:center">'+tr+'</td>'+
      '<td style="text-align:center">'+sol+'</td><td style="text-align:center">'+et+'</td><td style="text-align:center">'+ate+'</td><td style="text-align:center">'+seg+'</td><td style="text-align:center">'+arch+'</td></tr>';
  }).join('');
  const sumCol=(fn)=>deptoRows.reduce((s,d)=>s+fn(d.id),0);
  const pie=pieChartDeptoHtml(countsTotal);
  const filtros='<div class="juris-filtros-bar">'+
    '<div class="fld"><label>Departamento</label><select id="juris-f-depto" onchange="onJurisFiltroChange()">'+
    '<option value=""'+(fd===''?' selected':'')+'>Todos los departamentos</option>'+
    DEPTOS.map(d=>'<option value="'+d.id+'"'+(fd===d.id?' selected':'')+'>'+labelDepartamento(d.id)+'</option>').join('')+
    '</select></div>'+
    '<div class="fld"><label>Tipo de trámite</label><select id="juris-f-tram" onchange="onJurisFiltroChange()">'+
    '<option value=""'+(ft===''?' selected':'')+'>Todos los trámites</option>'+
    tramOpts.map(([tid,nom])=>'<option value="'+escAttr(tid)+'"'+(ft===tid?' selected':'')+'>'+escAttr(nom)+'</option>').join('')+
    '</select></div>'+
    (fd||ft?'<button type="button" class="btn bsm" onclick="window._jurisFiltroDepto=\'\';window._jurisFiltroTram=\'\';renderConsolidado()">Limpiar filtros</button>':'')+
    '</div>';
  const filtrosLbl=(fd||ft)?' · filtrado':'';
  const tabla='<div style="margin-top:10px;overflow-x:auto"><table style="font-size:12px;width:100%"><thead><tr><th>Departamento</th><th>Total</th><th>Activos</th><th>Solicitud</th><th>En trámite</th><th>Atendido</th><th>Seguimiento</th><th>Archivados</th></tr></thead><tbody>'+
    filasDepto+
    (deptoRows.length>1?'<tr style="background:var(--sf2);font-weight:700"><td>Total jurisdicción</td>'+
    '<td style="text-align:center">'+sumCol(id=>countsTotal[id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>countsTramite[id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>porEstado['Solicitud'][id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>porEstado['En trámite'][id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>porEstado['Atendido'][id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>porEstado['Seguimiento'][id]||0)+'</td>'+
    '<td style="text-align:center">'+sumCol(id=>porEstado['Archivado o anulado'][id]||0)+'</td></tr>':'')+
    '</tbody></table></div>';
  el.innerHTML='<div class="slbl">Resumen jurisdiccional por departamento ('+total+' expediente'+(total!==1?'s':'')+filtrosLbl+')</div>'+
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Filtros aplicados a todo el consolidado. Desglose por Guaviare, Guainía y Vaupés.</div>'+
    filtros+pie+tabla;
}
function renderConceptosSegView(e){
  migrarSegLegacy(e);
  const cs=conceptosSegData(e._conceptos_seg);
  if(!cs.length)return'';
  return '<div><div class="slbl">Conceptos de seguimiento</div>'+cs.map(c=>{
    const st=estadoConceptoSeg(c);
    return '<div class="tkv" style="flex-direction:column;align-items:flex-start"><div class="fx" style="gap:6px;flex-wrap:wrap"><span style="font-weight:600">'+fmtF(c.fecha)+' · Concepto '+escAttr(c.concepto||'—')+'</span>'+
      (st.cumplido?'<span class="flag" style="background:var(--gnl);color:var(--gn);border:1px solid #9fe1cb">Requerimiento cumplido</span>':st.incumplio?'<span class="flag flag-incumple">Incumplió requerimiento</span>':st.noCumple?'<span class="flag flag-ncumple">No cumple</span>':'')+
      '</div>'+(c.observaciones?'<div style="font-size:12px;color:var(--tx2);margin-top:3px">'+escAttr(c.observaciones)+'</div>':'')+
      (c.reqNum?'<div style="font-size:11px;color:var(--tx3)">Req. '+escAttr(c.reqNum)+' · Notif. '+fmtF(c.reqNotif)+' · Límite '+fmtF(c.reqVence||calcReqVence(c.reqNotif,c.reqDias))+(c.reqFechaCump?' · Cumplió '+fmtF(c.reqFechaCump):'')+'</div>':'')+
      (c.trasladoSan?'<div style="font-size:11px;color:var(--pu);margin-top:3px">Traslado sancionatorio: '+escAttr(c.expSan||'sin N°')+'</div>':'')+
      '</div>';
  }).join('')+'</div>';
}
function renderQuejaView(e){
  if(!esModoCasoEspecial(e))return'';
  const tit=labelTipoCasoEspecial(e)||'Caso especial';
  let h='<div style="margin-top:.6rem"><div class="slbl">'+tit+'</div><div class="ig">';
  if(e._qd_anonimo)h+='<div class="ic"><div class="k">Quejoso</div><div class="v">Anónimo</div></div>';
  else{
    h+='<div class="ic"><div class="k">Quejoso</div><div class="v">'+(e._qd_nombre||'-')+'</div></div>';
    if(e._qd_identificacion)h+='<div class="ic"><div class="k">Identificación</div><div class="v">'+e._qd_identificacion+'</div></div>';
    if(e._qd_correo)h+='<div class="ic"><div class="k">Correo</div><div class="v">'+e._qd_correo+'</div></div>';
    if(e._qd_telefono)h+='<div class="ic"><div class="k">Teléfono</div><div class="v">'+e._qd_telefono+'</div></div>';
  }
  let infrList=[];
  try{
    if(typeof parsePresuntosInfractores==='function')infrList=parsePresuntosInfractores(e);
    else if(typeof e._presuntos_infractores==='string'&&e._presuntos_infractores.trim())infrList=JSON.parse(e._presuntos_infractores);
    else if(Array.isArray(e._presuntos_infractores))infrList=e._presuntos_infractores;
  }catch(err){infrList=[];}
  if(!infrList.length){
    if(e._pi_tipo_persona==='juridica'||e._pi_nombre||e._pi_empresa)infrList=[{
      _pi_tipo_persona:e._pi_tipo_persona||'natural',_pi_nombre:e._pi_nombre,_pi_identificacion:e._pi_identificacion,
      _pi_empresa:e._pi_empresa,_pi_nit:e._pi_nit,_pi_rep_nombre:e._pi_rep_nombre
    }];
  }
  infrList.forEach(function(pi,i){
    if(!pi)return;
    const lbl=infrList.length>1?('Presunto infractor '+(i+1)):'Presunto infractor';
    if(pi._pi_tipo_persona==='juridica'){
      if(!(pi._pi_empresa||pi._pi_rep_nombre||pi._pi_nit))return;
      h+='<div class="ic"><div class="k">'+lbl+'</div><div class="v">'+(pi._pi_empresa||pi._pi_rep_nombre||'-')+(pi._pi_nit?' · NIT '+pi._pi_nit:'')+'</div></div>';
    }else if(pi._pi_nombre){
      h+='<div class="ic"><div class="k">'+lbl+'</div><div class="v">'+pi._pi_nombre+(pi._pi_identificacion?' · '+pi._pi_identificacion:'')+'</div></div>';
    }
  });
  if(e._apoderado&&e._apo_nombre)h+='<div class="ic"><div class="k">Apoderado</div><div class="v">'+e._apo_nombre+'</div></div>';
  if(e._autorizado&&(e._aut_nombre||e._aut_identificacion))h+='<div class="ic"><div class="k">Autorizado</div><div class="v">'+(e._aut_nombre||'-')+(e._aut_identificacion?' · '+e._aut_identificacion:'')+'</div></div>';
  return h+'</div></div>';
}
function renderActosAdminView(e){
  const actos=actosAdminData(e._actos_admin);
  if(!actos.length)return'';
  return '<div><div class="slbl">Normatividad / actos administrativos</div>'+actos.map(a=>{
    a=normalizeActoProrrogas(a);
    const st=estadoActoAdmin(a);
    let b='';
    if(st.archivada)b='<span class="flag flag-arch-acto">Archivada</span>';
    else if(st.prorroga)b='<span class="flag flag-prorroga">Prórroga</span>';
    else if(st.vencida)b='<span class="flag flag-venc-acto">Resolución vencida</span>';
    const prs=(a.prorrogas||[]).filter(p=>p.numero||p.vencimiento);
    const prTxt=prs.length?prs.map((p,i)=>'<span style="font-size:11px;color:var(--tx2)"> · Prór. '+(i+1)+': '+(p.numero||'—')+' hasta '+fmtF(p.vencimiento)+'</span>').join(''):'';
    const archTxt=a.archivoNum||a.archivoFecha?'<span style="font-size:11px;color:var(--tx2)"> · Archivo '+(a.archivoNum||'—')+(a.archivoFecha?' '+fmtF(a.archivoFecha):'')+'</span>':'';
    const sanTxt=a.trasladoSan?'<span style="font-size:11px;color:var(--pu)"> · Sancionatorio '+(a.expSan||'—')+'</span>':'';
    const fecTxt=a.fecha?'<span style="font-size:11px;color:var(--tx2)"> · Acto: '+fmtF(a.fecha)+'</span>':'';
    return '<div class="tkv"><span style="font-weight:600">'+(a.tipo||'Acto')+(a.numero?' · '+a.numero:'')+'</span> '+b+fecTxt+
      actoVenceHtml(a)+prTxt+archTxt+sanTxt+'</div>';
  }).join('')+'</div>';
}
function renderFullTimeline(e){
  const tram=getTram(e._tramite,e);
  if(!tram)return'';
  const hist=rebuildHistorial(e,e.historial||[]);
  const fe=getFechasEstado(e);
  const col=tram.color;
  const tramEtapas=tram.etapas||[];
  const si=tramEtapas.indexOf(e._etapa);
  const isFin=FINALS.includes(e._etapa)||e._estado==='Atendido'||isArchivadoEstado(e._estado)||e._estado==='Seguimiento';
  let html='<div class="full-tl">';
  html+='<div class="phase-block '+(isFin?'ph-done':'ph-active')+'">';
  html+='<div class="phase-dot '+(isFin?'done':'active')+'">T</div>';
  html+='<div class="phase-label '+(isFin?'done':'active')+'">Trámite principal</div>';
  if(tramEtapas.length){
    tramEtapas.forEach((eta,i)=>{
      const hi=hist.find(h=>h.fase==='tramite'&&h.etapa===eta);
      const isAct=eta===e._etapa&&!isFin;
      const isDone=!!hi&&!isAct;
      const cls=isDone?'done':isAct?'act':'pnd';
      html+='<div class="tli '+cls+'"><div class="tls" style="color:'+(isDone||isAct?col:'var(--tx3)')+'">'+eta+'</div>'+(hi?'<div class="tldt">'+fmtF(hi.fecha)+'</div>':'')+'</div>';
    });
  }else{
    const hiSol=hist.find(h=>h.etapa==='Solicitud')||{fecha:fe.Solicitud||e._fecha};
    html+='<div class="tli '+(e._estado==='Solicitud'&&!isFin?'act':'done')+'"><div class="tls" style="color:'+col+'">Solicitud</div><div class="tldt">'+fmtF(hiSol.fecha)+'</div></div>';
    const hiTram=hist.find(h=>h.etapa==='En trámite');
    if(hiTram||e._estado==='En trámite')html+='<div class="tli '+(e._estado==='En trámite'&&!isFin?'act':'done')+'"><div class="tls" style="color:'+col+'">En trámite</div>'+(hiTram?'<div class="tldt">'+fmtF(hiTram.fecha)+'</div>':'')+'</div>';
  }
  html+='</div>';
  const ateHist=hist.find(h=>h.fase==='atencion');
  const fAte=fe.Atendido;
  const showAte=!!(ateHist||fAte);
  html+='<div class="phase-block '+(showAte?'ph-done':isFin?'ph-active':'ph-pend')+'">';
  html+='<div class="phase-dot '+(showAte?'done':'pnd')+'">A</div>';
  html+='<div class="phase-label '+(showAte?'done':'')+'">Atención / Decisión</div>';
  if(ateHist){html+='<div class="tli done"><div class="tls">'+ateHist.etapa+'</div><div class="tldt">'+fmtF(ateHist.fecha)+'</div>'+(ateHist.desc?'<div class="tldesc">'+ateHist.desc+'</div>':'')+'</div>';}
  else if(fAte){html+='<div class="tli done"><div class="tls">Atendido</div><div class="tldt">'+fmtF(fAte)+'</div>'+(e._resolucion?'<div class="tldesc">'+e._resolucion+'</div>':'')+'</div>';}
  else{html+='<div style="font-size:12px;color:var(--tx3);padding-left:12px;padding-bottom:4px">Pendiente</div>';}
  html+='</div>';
  const hasSeg=e._estado==='Seguimiento';
  const fSeg=fe.Seguimiento;
  html+='<div class="phase-block '+(hasSeg?'ph-seg':'ph-pend')+'">';
  html+='<div class="phase-dot '+(hasSeg?'seg':'pnd')+'">S</div>';
  html+='<div class="phase-label '+(hasSeg?'seg-lbl':'')+'">Seguimiento post-atención</div>';
  if(hasSeg){
    const hi=hist.find(h=>h.fase==='seguimiento')||{fecha:fSeg||e._fecha_seg};
    html+='<div class="tli seg-step"><div class="tls" style="color:var(--pu)">En seguimiento</div><div class="tldt">'+fmtF(hi.fecha||fSeg)+'</div></div>';
    conceptosSegData(e._conceptos_seg).forEach(c=>{
      html+='<div class="tli seg-step"><div class="tls" style="color:var(--pu)">Concepto '+escAttr(c.concepto||'—')+'</div><div class="tldt">'+fmtF(c.fecha)+'</div>'+(c.observaciones?'<div class="tldesc" style="border-left-color:var(--pu);background:var(--pul)">'+escAttr(c.observaciones)+'</div>':'')+'</div>';
    });
  }else{html+='<div style="font-size:12px;color:var(--tx3);padding-left:12px;padding-bottom:4px">No iniciado</div>';}
  html+='</div>';
  const fArch=fe['Archivado o anulado'];
  const showArch=isArchivadoEstado(e._estado)&&!!fArch;
  const archHist=showArch?hist.find(h=>h.fase==='archivo'):null;
  html+='<div class="phase-block '+(showArch?'ph-done':'ph-pend')+'">';
  html+='<div class="phase-dot '+(showArch?'done':'pnd')+'">F</div>';
  html+='<div class="phase-label '+(showArch?'done':'')+'">Archivo / Cierre</div>';
  if(archHist){html+='<div class="tli done"><div class="tls">'+archHist.etapa+'</div><div class="tldt">'+fmtF(archHist.fecha)+'</div>'+(archHist.desc?'<div class="tldesc">'+archHist.desc+'</div>':'')+'</div>';}
  else{html+='<div style="font-size:12px;color:var(--tx3);padding-left:12px;padding-bottom:4px">Pendiente</div>';}
  html+='</div></div>';
  return html;
}
function collectArchivosPqrsLinks(e){
  const items=[];
  if(!e||!esPqrsSecretaria(e))return items;
  const soloPublico=typeof esModoCiudadano==='function'&&esModoCiudadano();
  const seen=new Set();
  const push=(url,label,fecha,meta)=>{
    if(!url)return;
    if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(url))return;
    if(soloPublico&&meta&&typeof _pqrsDocEsVisibleCiudadano==='function'&&!_pqrsDocEsVisibleCiudadano(meta,e,{tipo:meta._tipoPub||'respuesta'}))return;
    const p=parseDrivePreviewUrl(url);
    const key=String(p.url||url||'').trim();
    if(!key||seen.has(key))return;
    seen.add(key);
    items.push({exp:e._exp,taskId:'',taskDesc:'PQRSD',label:label||'Documento PQRSD',url:p.url||url,local:false,mime:'',fecha:fecha||e._fecha_solicitud||e._fecha||'',version:''});
  };
  push(e._pqrs_solicitud_link,'Solicitud PQRSD',e._fecha_solicitud||e._fecha,{_tipoPub:'solicitud'});
  (e._pqrs_gmail_attachments||[]).forEach(function(att){
    if(!att||!att.driveLink||att.driveLink===e._pqrs_solicitud_link)return;
    if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(att.driveLink))return;
    push(att.driveLink,att.nombre||'Anexo PQRSD',e._fecha_solicitud||e._fecha,{_tipoPub:'solicitud'});
  });
  const tieneSoportesResp=Array.isArray(e._pqrs_respuesta_soportes)&&e._pqrs_respuesta_soportes.length>0;
  if(tieneSoportesResp){
    (e._pqrs_respuesta_soportes||[]).forEach((s,i)=>{
      if(soloPublico&&typeof _pqrsDocEsVisibleCiudadano==='function'&&!_pqrsDocEsVisibleCiudadano(s,e,{tipo:'respuesta'}))return;
      if(!soloPublico&&typeof _pqrsDocEsBorradorInterno==='function'&&typeof esUrlCarpetaDrive==='function'){
        // staff: still skip folder links only
        if(esUrlCarpetaDrive(s.url||s.preview))return;
      }
      const lbl=soloPublico?String(s.label||('Respuesta '+(i+1))).replace(/\s*·\s*(por corregir|entrega v\d+)/ig,'').trim():(s.label||('Respuesta '+(i+1)));
      push(s.url||s.preview,lbl||('Respuesta '+(i+1)),e._pqrs_respuesta_fecha,Object.assign({},s,{_tipoPub:'respuesta'}));
    });
  }else if(!soloPublico||(typeof pqrsEstaCerrada==='function'&&pqrsEstaCerrada(e))){
    if(!soloPublico||(e._pqrs_respuesta_link&&typeof _pqrsDocEsBorradorInterno==='function'&&!_pqrsDocEsBorradorInterno({url:e._pqrs_respuesta_link}))){
      push(e._pqrs_respuesta_link,'Respuesta PQRSD',e._pqrs_respuesta_fecha,{_tipoPub:'respuesta',url:e._pqrs_respuesta_link});
    }
    (e._pqrs_respuesta_links||[]).forEach((u,i)=>{
      if(soloPublico&&typeof _pqrsDocEsBorradorInterno==='function'&&_pqrsDocEsBorradorInterno({url:u}))return;
      push(u,'Respuesta PQRSD '+(i+1),e._pqrs_respuesta_fecha,{_tipoPub:'respuesta',url:u});
    });
  }
  // Workflow docs: solo para staff (comparar versiones); ciudadano no ve borradores de corrección/firma
  if(!soloPublico&&typeof getPqrsWorkflow==='function'){
    const wf=getPqrsWorkflow(e);
    (wf.documentos||[]).forEach(function(d,i){
      if(!d)return;
      const url=d.driveLink||d.previewLink||'';
      if(!url||(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(url)))return;
      const lbl=typeof _pqrsEtiquetaDocWf==='function'?_pqrsEtiquetaDocWf(d):(d.nombre||('Documento '+(i+1)));
      push(url,lbl,d.entregado_en||wf.fecha_respuesta||e._pqrs_respuesta_fecha,d);
    });
  }else if(soloPublico&&typeof getPqrsWorkflow==='function'&&typeof pqrsEstaCerrada==='function'&&pqrsEstaCerrada(e)){
    const wf=getPqrsWorkflow(e);
    (wf.documentos||[]).forEach(function(d,i){
      if(!d||typeof _pqrsDocEsVisibleCiudadano!=='function'||!_pqrsDocEsVisibleCiudadano(d,e,{tipo:'respuesta'}))return;
      const url=d.driveLink||d.previewLink||'';
      push(url,d.nombre||('Respuesta '+(i+1)),wf.fecha_respuesta||e._pqrs_respuesta_fecha,Object.assign({},d,{_tipoPub:'respuesta'}));
    });
  }
  return items;
}
function collectArchivosExp(e,taskIdFilter){
  const items=[];
  if(!e)return items;
  const soloPublico=typeof esModoCiudadano==='function'&&esModoCiudadano();
  (e.tasks||[]).map(normalizeTask).forEach(t=>{
    if(t.eliminada)return;
    if(taskIdFilter&&t.id!==taskIdFilter)return;
    const esPqrsAct=typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e);
    (t.soportes||[]).forEach(s=>{
      const url=s.url||s.preview||'';
      if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(url))return;
      // Ciudadano: no mostrar entregas de actividad PQRSD (borradores / correcciones / firma)
      if(soloPublico&&esPqrsAct)return;
      if(soloPublico&&typeof _pqrsDocEsBorradorInterno==='function'&&_pqrsDocEsBorradorInterno(s))return;
      items.push({
        exp:e._exp,taskId:t.id,taskDesc:t.desc||t.actividad||'Actividad',
        label:s.label||('Documento v'+(s.version||'?')),
        url,local:!!s.local,mime:s.mime||'',fecha:s.fecha||'',version:s.version||''
      });
    });
  });
  return items;
}
function collectArchivosActLibre(t){
  t=normalizeActLibre(t);
  return (t.soportes||[]).map(s=>({
    exp:t.codigo,taskId:t.id,taskDesc:t.desc||t.actividad||'Actividad',
    label:s.label||('Documento v'+(s.version||'?')),
    url:s.url||s.preview||'',local:!!s.local,mime:s.mime||'',fecha:s.fecha||'',version:s.version||''
  }));
}
function archivosItemFromRaw(raw){
  const r=raw||{};
  const src=String(r.url||r.preview||'').trim();
  if(!src&&!r.local)return null;
  const p=r.local?{url:src,preview:r.preview||src}:parseDrivePreviewUrl(src);
  const url=p.url||src;
  const preview=(r.preview&&!r.local)?r.preview:(r.local?(r.preview||src):(p.preview||p.url||src));
  const tipoDoc=r.tipoDoc||r.taskDesc||r.origen||'Documento';
  const descDoc=r.descDoc||r.label||r.titulo||'Archivo adjunto';
  return{
    exp:r.exp||'',taskId:r.taskId||'',taskDesc:tipoDoc,tipoDoc,descDoc,
    label:descDoc,
    url,preview,openUrl:url,
    local:!!r.local,mime:r.mime||'',fecha:r.fecha||'',version:r.version||''
  };
}
function pushArchivosExpedienteRaw(raws,e,taskIdFilter){
  if(!e||!Array.isArray(raws))return;
  const expId=e._exp||'';
  const soloPub=typeof esModoCiudadano==='function'&&esModoCiudadano();
  const seenPqrsUrls=new Set();
  collectArchivosPqrsLinks(e).forEach(function(it){
    const u=String(it.url||'').trim().toLowerCase();
    if(u)seenPqrsUrls.add(u);
    raws.push({exp:expId,taskId:it.taskId||'',taskDesc:it.taskDesc||'PQRSD',label:it.label,url:it.url,local:!!it.local,mime:it.mime||'',fecha:it.fecha||'',version:it.version||'',origen:'PQRSD',tipoDoc:'PQRSD',descDoc:it.label||'Documento PQRSD'});
  });
  docsTramiteData(e._docs_tramite).forEach(function(d){
    if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(d.url||d.preview))return;
    raws.push({exp:expId,label:d.label,tipoDoc:'Documento del trámite',descDoc:d.label||'Documento del trámite',url:d.url,preview:d.preview||d.url,origen:'Trámite',fecha:d.fecha||'',docTramiteId:d.id});
  });
  collectArchivosExp(e,taskIdFilter||null).forEach(function(it){
    raws.push({exp:expId,taskId:it.taskId||'',taskDesc:it.taskDesc||'Actividad',label:it.label,url:it.url,local:!!it.local,mime:it.mime||'',fecha:it.fecha||'',version:it.version||'',origen:'Entrega',tipoDoc:'Entrega de actividad',descDoc:it.label||('Documento v'+(it.version||'?'))});
  });
  collectEnlacesExpediente(e).forEach(function(l){
    if(l.tipo==='Actividad')return;
    if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(l.url))return;
    if(soloPub&&l.tipo==='PQRSD'){
      const u=String(l.url||'').trim().toLowerCase();
      if(u&&seenPqrsUrls.has(u))return;
      if(/respuesta|entrega|por corregir|firma|link drive/i.test(String(l.ref||'')))return;
    }
    if(l.tipo==='PQRSD'){
      const u=String(l.url||'').trim().toLowerCase();
      if(u&&seenPqrsUrls.has(u))return;
      if(u)seenPqrsUrls.add(u);
    }
    // Evitar etiquetas tipo "drive folder link"
    if(/folder\s*link|carpeta\s*drive|drive\s*folder/i.test(String(l.ref||l.tipo||'')))return;
    const lbl=[l.ref||'Enlace',l.version?'v'+l.version:''].filter(Boolean).join(' · ');
    raws.push({exp:expId,label:lbl,tipoDoc:l.tipo||'Trámite',descDoc:lbl,url:l.url,taskDesc:l.tipo||'Expediente',fecha:l.fecha||'',taskId:l.taskId||'',origen:'Trámite'});
  });
  (e.tasks||[]).forEach(function(t){
    if(t.eliminada)return;
    if(taskIdFilter&&t.id!==taskIdFilter)return;
    normalizeTask(t);
    const esPqrsAct=typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(t,e);
    if(soloPub&&esPqrsAct)return;
    (t.soportes||[]).forEach(function(s){
      const url=s.url||s.preview||'';
      if(!url&&!s.local)return;
      if(typeof esUrlCarpetaDrive==='function'&&esUrlCarpetaDrive(url))return;
      if(soloPub&&typeof _pqrsDocEsBorradorInterno==='function'&&_pqrsDocEsBorradorInterno(s))return;
      const actTit=t.desc||t.actividad||'Actividad';
      raws.push({
        exp:expId,taskId:t.id,taskDesc:'Entrega de actividad',tipoDoc:'Entrega · '+actTit,
        descDoc:s.label||('Entrega v'+(s.version||'?')),
        url:url,preview:s.preview||url,local:!!s.local,mime:s.mime||'',fecha:s.fecha||'',version:s.version||'',origen:'Entrega'
      });
    });
  });
}
function collectArchivosConsultaCompleto(e,taskIdFilter,opts){
  opts=opts||{};
  if(!e)return[];
  const items=[],seen=new Set(),raws=[];
  pushArchivosExpedienteRaw(raws,e,taskIdFilter);
  if(opts.incluirAsociados){
    getExpAsociadosAll(e).forEach(function(num){
      if(expAsocMatchNum(num,e._exp))return;
      const asoc=findExpByNumPlain(num);
      if(!asoc)return;
      const tag=expAsocEsRegistroPqrs(asoc)?'PQRSD asociada':'Exp. asociado';
      const asocRaws=[];
      pushArchivosExpedienteRaw(asocRaws,asoc,null);
      asocRaws.forEach(function(r){
        raws.push({
          exp:asoc._exp,asocDe:e._exp,
          taskId:r.taskId||'',taskDesc:r.taskDesc||'',label:r.label,url:r.url,preview:r.preview,
          local:!!r.local,mime:r.mime||'',fecha:r.fecha||'',version:r.version||'',origen:r.origen||'Asociado',
          tipoDoc:tag+' · '+asoc._exp,
          descDoc:(r.descDoc||r.label||'Documento')
        });
      });
    });
  }
  const addRaw=function(raw){
    const it=archivosItemFromRaw(raw);
    if(!it)return;
    const u=String(it.preview||it.url||'').trim().toLowerCase();
    if(!u&&!it.local)return;
    const key=u||('local:'+(it.label||''));
    if(seen.has(key))return;
    seen.add(key);
    it.exp=raw.exp||e._exp;
    it.asocDe=raw.asocDe||'';
    items.push(it);
  };
  raws.forEach(addRaw);
  return items.sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
}
function conArchivoItemBtnHtml(it,idx,previewFn,firstOn){
  previewFn=previewFn||'renderConsultaArchivoPreview';
  const icon=it.local?(String(it.mime||'').includes('pdf')?'📄':String(it.mime||'').startsWith('image/')?'🖼':'📎'):'🔗';
  const tit=it.descDoc||it.label||'Archivo';
  const sub=[it.tipoDoc||it.taskDesc||'Documento',fmtF((it.fecha||'').slice(0,10)),it.version?'v'+it.version:''].filter(Boolean).join(' · ');
  return '<button type="button" class="con-arch-item'+(firstOn?' on':'')+'" onclick="'+previewFn+'('+idx+')">'+
    '<span style="font-size:18px;flex-shrink:0">'+icon+'</span>'+
    '<span style="flex:1;min-width:0"><strong style="display:block;font-size:13px">'+escAttr(tit)+'</strong>'+
    '<span style="font-size:11px;color:var(--tx3);display:block;margin-top:2px">'+escAttr(sub)+'</span></span></button>';
}
function conArchivosListHtml(items,previewFn,mainExp){
  previewFn=previewFn||'renderConsultaArchivoPreview';
  mainExp=String(mainExp||'').trim();
  if(!items.length)return '<div style="font-size:12px;color:var(--tx3);padding:8px 0">Sin enlaces Drive ni adjuntos registrados en este expediente.</div>';
  const mainItems=[],asocMap=new Map();
  items.forEach(function(it,i){
    it._archIdx=i;
    if(it.asocDe){
      const key=String(it.exp||it.asocDe||'').trim()||'vinculado';
      if(!asocMap.has(key))asocMap.set(key,[]);
      asocMap.get(key).push(it);
    }else mainItems.push(it);
  });
  let html='',first=true;
  if(mainItems.length){
    const mainLbl=mainExp?('📂 Este registro · '+mainExp):'📂 Documentos del registro principal';
    html+='<div class="con-arch-grp"><div class="con-arch-grp-hd">'+escAttr(mainLbl)+'</div>'+
      mainItems.map(function(it){const h=conArchivoItemBtnHtml(it,it._archIdx,previewFn,first);first=false;return h;}).join('')+'</div>';
  }
  asocMap.forEach(function(grpItems,key){
    const sample=grpItems[0]||{};
    const tagRaw=String(sample.tipoDoc||'Vinculado').split('·')[0].trim();
    const tag=tagRaw||'Vinculado';
    html+='<div class="con-arch-grp con-arch-grp-asoc"><div class="con-arch-grp-hd">📎 '+escAttr(tag)+' · '+escAttr(key)+'</div>'+
      grpItems.map(function(it){const h=conArchivoItemBtnHtml(it,it._archIdx,previewFn,first);first=false;return h;}).join('')+'</div>';
  });
  return html;
}
function renderConsultaArchivoPreview(idx,opts){
  opts=opts||{};
  const items=window._conArchItems||[];
  const it=items[idx];
  const wrapId=opts.previewId||'con-arch-preview-wrap';
  const listSel=opts.listSel||'.con-arch-list-col';
  const wrap=document.getElementById(wrapId);
  let listCol=null;
  if(wrap){
    const split=wrap.closest('.con-arch-split');
    listCol=split?split.querySelector('.con-arch-list-col'):null;
  }
  if(!listCol)listCol=document.querySelector(listSel);
  if(listCol)listCol.querySelectorAll('.con-arch-item').forEach((el,i)=>el.classList.toggle('on',i===idx));
  if(!wrap)return;
  if(!it){
    wrap.innerHTML='<div style="padding:1rem;color:var(--tx3);font-size:12px">Seleccione un documento de la lista</div>';
    return;
  }
  const sop={preview:it.preview,url:it.openUrl||it.url,label:it.label,local:!!it.local,mime:it.mime||'',tipo:it.mime||''};
  if(soporteTieneVista(sop)){
    wrap.innerHTML='<div class="con-arch-embed">'+renderSoporteEmbedHtml(sop)+'</div>'+
      '<div style="padding:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--bd);background:var(--sf)">'+
      '<span style="font-size:11px;color:var(--tx2);flex:1"><strong>'+escAttr(it.descDoc||it.label)+'</strong><br><span style="color:var(--tx3)">'+escAttr(it.tipoDoc||it.taskDesc||'')+(it.exp&&it.exp!==window._conArchPanelExp?' · '+escAttr(it.exp):'')+'</span></span>'+
      (it.openUrl&&!it.local?'<button type="button" class="btn bsm bp" onclick="window.open(\''+escAttr(it.openUrl)+'\',\'_blank\',\'noopener\')">↗ Abrir en Drive</button>':'')+
      '</div>';
  }else{
    wrap.innerHTML='<div style="padding:1.2rem;text-align:center;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">'+
      '<div style="font-size:13px;font-weight:600">'+escAttr(it.descDoc||it.label)+'</div>'+
      '<div style="font-size:12px;color:var(--tx2)">'+escAttr(it.tipoDoc||it.taskDesc||'')+'</div>'+
      (it.openUrl?'<a class="btn bsm bp" href="'+escAttr(it.openUrl)+'" target="_blank" rel="noopener">Abrir documento</a>':'')+
      '</div>';
  }
}
function renderConPanelDocumentosBlock(e,taskIdFilter,open){
  if(!e)return '';
  const incluirAsoc=!!window._conPanelEditMode||getExpAsociadosAll(e).length>0;
  const items=collectArchivosConsultaCompleto(e,taskIdFilter||null,{incluirAsociados:incluirAsoc});
  window._conArchItems=items;
  window._conArchPanelExp=e._exp;
  const list=conArchivosListHtml(items,'renderConPanelArchivoPreview',e._exp);
  const canGestionar=window._conPanelEditMode&&puedeGestionarDocsTramite();
  const tramDocs=docsTramiteData(e._docs_tramite);
  const driveFolderHtml=e._drive_folder_link?('<div style="margin-bottom:8px"><a href="'+escAttr(e._drive_folder_link)+'" target="_blank" rel="noopener" class="btn bsm">📁 Carpeta Drive del expediente</a></div>'):'';
  const tramGestionHtml=canGestionar?(
    '<div style="margin-bottom:10px">'+
    '<button type="button" class="btn bsm bp" data-sst-action="openAnadirDocTramiteModal" data-sst-exp="'+escAttr(e._exp)+'" onclick="event.stopPropagation();SST.openAnadirDocTramiteModal(\''+jsStr(e._exp)+'\')">➕ Añadir documento</button>'+
    (tramDocs.length?('<div style="margin-top:8px">'+tramDocs.map(d=>'<div class="con-panel-doc-tram-row">'+
      '<span style="flex:1;min-width:0"><strong>'+escAttr(d.label||'Documento')+'</strong><br><span style="font-size:10px;color:var(--tx3)">'+escAttr(fmtF((d.fecha||'').slice(0,10))||'Sin fecha')+'</span></span>'+
      '<button type="button" class="btn bsm bd2" onclick="SST.eliminarDocTramiteExp(\''+jsStr(e._exp)+'\',\''+jsStr(d.id)+'\')" title="Quitar documento">🗑</button></div>').join('')+'</div>'):'')+
    '</div>'):'';
  const hintAsoc=getExpAsociadosAll(e).length?'<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Incluye documentos de PQRSD y expedientes vinculados.</div>':'';
  const body=items.length?
    (driveFolderHtml+tramGestionHtml+hintAsoc+'<div class="con-arch-split"><div class="con-arch-list-col">'+list+'</div><div class="con-arch-preview-col" id="con-panel-arch-preview"></div></div>'):
    (driveFolderHtml+tramGestionHtml+'');
  return '<details class="con-fold con-panel-archivos-wrap" id="con-panel-archivos-wrap"'+(open?' open':'')+'>'+
    '<summary>📁 Documentos / archivos ('+items.length+')</summary><div class="item-fold-body">'+body+'</div></details>';
}
function collectDocTramiteAdjFiles(){
  const files=[];
  document.querySelectorAll('#doc-tram-adj-rows .pqrs-adj-file-row').forEach(function(row){
    if(row._adjFile)files.push({file:row._adjFile,statusEl:row.querySelector('.adj-upload-status')});
  });
  return files;
}
function openAnadirDocTramiteModal(expId){
  expId=String(expId||'').trim();
  if(!expId||!puedeGestionarDocsTramite()){notif('No puede añadir documentos en este modo','err');return;}
  const e=getExpById(expId);
  const esPqrs=e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  const usaDriveInst=typeof DRIVE_INST_DEPTOS!=='undefined'&&DRIVE_INST_DEPTOS.has((typeof deptoActivo!=='undefined'?deptoActivo:'')||(typeof deptoCfg!=='undefined'?deptoCfg:'')||'');
  const hayToken=(typeof _driveGetBestToken==='function'&&!!_driveGetBestToken())||(typeof gmailIsTokenValid==='function'&&gmailIsTokenValid())||(typeof gmailOfiIsTokenValid==='function'&&gmailOfiIsTokenValid());
  const puedeSubirPqrs=esPqrs&&usaDriveInst&&hayToken;
  abrirPqrsModalPrep();
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body){cerrarPqrsModalPrep();return;}
  if(tit)tit.textContent=esPqrs?'Añadir documento a la PQRSD':'Añadir documento al trámite';
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  const adjInfo=puedeSubirPqrs
    ?'<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">El archivo se subirá a la carpeta Drive institucional de esta PQRSD (misma carpeta de radicación).</div>'
    :'';
  const uploadBtn=puedeSubirPqrs
    ?'<button type="button" class="btn bsm" onclick="addPqrsRespAdjFile(\'doc-tram-adj-rows\')">📎 Subir archivo</button>'
    :'';
  const linkReq=puedeSubirPqrs?'':'<span class="req-star">*</span>';
  const linkHint=puedeSubirPqrs?' <span style="font-weight:400;color:var(--tx3)">(opcional si sube archivo)</span>':'';
  body.innerHTML=
    '<div class="fld" style="margin-bottom:10px"><label>Nombre / tipo de documento<span class="req-star">*</span></label><input type="text" id="doc-tram-label" placeholder="Ej. Factura, Requerimiento, Resolución N° 123…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    (puedeSubirPqrs?('<div class="fld" style="margin-bottom:10px"><label>Archivo</label>'+adjInfo+
      '<div id="doc-tram-adj-rows" style="margin-top:6px"></div>'+
      '<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px">'+uploadBtn+'</div></div>'):'')+
    '<div class="fld" style="margin-bottom:12px"><label>Enlace Google Drive'+linkReq+linkHint+'</label><input type="url" id="doc-tram-url" placeholder="https://drive.google.com/file/d/…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fx" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn bsm bp" id="doc-tram-submit-btn" onclick="event.stopPropagation();SST.submitAnadirDocTramite(\''+jsStr(expId)+'\')">Guardar documento</button>'+
    '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button></div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'docTramite',expId:expId};
  setTimeout(function(){
    const inp=document.getElementById('doc-tram-label');
    if(inp)inp.focus();
  },80);
}
async function submitAnadirDocTramite(expId){
  expId=String(expId||'').trim();
  if(!puedeGestionarDocsTramite())return;
  const label=String((document.getElementById('doc-tram-label')||{}).value||'').trim();
  const urlRaw=String((document.getElementById('doc-tram-url')||{}).value||'').trim();
  const adjFiles=collectDocTramiteAdjFiles();
  if(!label){notif('Indique el nombre o tipo de documento','err');return;}
  const e=getExpById(expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  let url='';
  let preview='';
  const btn=document.getElementById('doc-tram-submit-btn');
  if(esPqrs&&adjFiles.length){
    if(typeof driveUploadPqrsExpediente!=='function'){notif('Módulo Drive no disponible. Recargue la página.','err');return;}
    if(btn){btn.disabled=true;btn.textContent='Subiendo al Drive…';}
    try{
      for(let i=0;i<adjFiles.length;i++){
        const item=adjFiles[i];
        const file=item.file;
        if(!file)continue;
        if(item.statusEl)item.statusEl.textContent='⬆ Subiendo…';
        const docLabel=adjFiles.length>1?(label+' · '+file.name):label;
        const res=await driveUploadPqrsExpediente(file,file.name,file.type||'application/octet-stream',e,{label:docLabel});
        if(!Array.isArray(e._docs_tramite))e._docs_tramite=[];
        e._docs_tramite.push({
          id:'dt_'+Date.now().toString(36)+'_'+i,
          label:docLabel,
          url:res.driveLink,
          preview:res.previewLink||res.driveLink,
          fecha:hoy(),
          por:taskComentarioAutor()
        });
        if(item.statusEl)item.statusEl.textContent='✅ Subido';
      }
    }catch(err){
      console.error('submitAnadirDocTramite drive:',err);
      notif('No se pudo subir el archivo: '+(err.message||'revise la conexión Gmail/Drive'),'err');
      if(btn){btn.disabled=false;btn.textContent='Guardar documento';}
      return;
    }
    if(btn){btn.disabled=false;btn.textContent='Guardar documento';}
    persistExpedienteGranular(e,false);
    closeTaskModal();
    notif('Documento(s) añadido(s) y guardado(s) en la carpeta Drive de la PQRSD','ok');
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')&&window._conPanelActive===expId){
      if(window._conPanelEditMode)renderConSidePanel();
      else refreshConPanelDocumentos(expId,null,false);
      if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
      if(document.getElementById('pg-reg')&&document.getElementById('pg-reg').classList.contains('on'))renderTabla();
    }
    return;
  }
  if(!url){
    if(!urlRaw){notif('Indique un enlace de Google Drive o suba un archivo','err');return;}
    url=normalizeDriveUrlInput(urlRaw);
    const p=parseDrivePreviewUrl(url);
    if(!p.valid){notif('Enlace no válido — pegue la URL completa de Google Drive (archivo, documento o enlace compartido)','err');return;}
    url=p.url||url;
    preview=p.preview||p.url||url;
  }
  if(!Array.isArray(e._docs_tramite))e._docs_tramite=[];
  e._docs_tramite.push({id:'dt_'+Date.now().toString(36),label,url:url,preview:preview||url,fecha:hoy(),por:taskComentarioAutor()});
  persistExpedienteGranular(e,false);
  closeTaskModal();
  notif(esPqrs?'Documento añadido y guardado en la carpeta Drive de la PQRSD':'Documento añadido al trámite','ok');
  if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')&&window._conPanelActive===expId){
    if(window._conPanelEditMode)renderConSidePanel();
    else refreshConPanelDocumentos(expId,null,false);
    if(document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
    if(document.getElementById('pg-reg')&&document.getElementById('pg-reg').classList.contains('on'))renderTabla();
  }
}
function eliminarDocTramiteExp(expId,docId){
  if(!puedeGestionarDocsTramite())return;
  confirmPrecaucion({
    title:'Quitar documento',
    message:'¿Eliminar este documento del trámite?',
    confirmLabel:'Sí, quitar'
  },function(){
    const e=getExpById(expId);
    if(!e)return;
    e._docs_tramite=docsTramiteData(e._docs_tramite).filter(d=>String(d.id||'')!==String(docId||''));
    persistExpedienteGranular(e,false);
    notif('Documento eliminado','ok');
    if(document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on')){
      refreshConPanelDocumentos(expId,null,false);
    }
  });
}
function abrirConPanelSeccionesRegistro(wrap,pqrsNca){
  if(!wrap)return;
  const abrir=function(sel){const d=wrap.querySelector(sel);if(d)d.open=true;};
  abrir('#sec-control');
  abrir('#sec-persona');
  if(pqrsNca){
    abrir('#sec-detalle');
    abrir('details.form-section.overflow-visible');
  }
}
function conPanelColapsarSeccionesRegistro(wrap){
  if(!wrap)return;
  wrap.querySelectorAll('details.form-section').forEach(function(d){d.open=false;});
}
function conPanelColapsarTodasSecciones(){
  const body=document.getElementById('con-side-body');
  if(body)body.querySelectorAll('details.con-fold, details.con-panel-archivos-wrap').forEach(function(d){d.open=false;});
  conPanelColapsarSeccionesRegistro(document.getElementById('con-side-form-wrap'));
}
function renderConPanelArchivoPreview(idx){renderConsultaArchivoPreview(idx,{previewId:'con-panel-arch-preview',listSel:'#con-panel-archivos-wrap .con-arch-list-col'});}
function initConPanelArchivosPreview(preferTaskId){
  if(!(window._conArchItems||[]).length)return;
  let idx=0;
  if(preferTaskId){
    const i=(window._conArchItems||[]).findIndex(it=>it.taskId===preferTaskId);
    if(i>=0)idx=i;
  }
  renderConPanelArchivoPreview(idx);
}
function refreshConPanelDocumentos(expId,taskId,open){
  const e=getExpById(expId);
  const wrap=document.getElementById('con-panel-archivos-wrap');
  if(!e||!wrap)return;
  const tmp=document.createElement('div');
  tmp.innerHTML=renderConPanelDocumentosBlock(e,null,open!==false);
  const neu=tmp.firstElementChild;
  if(neu)wrap.replaceWith(neu);
  initConPanelArchivosPreview(taskId||window._conPanelTaskId||null);
}
function scrollConPanelDocumentos(){
  const wrap=document.getElementById('con-panel-archivos-wrap');
  if(!wrap)return;
  wrap.open=true;
  wrap.scrollIntoView({behavior:'smooth',block:'nearest'});
  initConPanelArchivosPreview(window._conPanelTaskId||null);
}
function reviewAsocStackActive(){
  return !!(document.getElementById('review-asoc-panel')&&document.getElementById('review-asoc-panel').classList.contains('on'));
}
function taskModalZIndexApply(ov){
  if(!ov)return;
  if(reviewAsocStackActive()&&typeof reviewElevateTaskModal==='function'){
    reviewElevateTaskModal();
    return;
  }
  if(typeof taskModalIsReviewOpen==='function'&&taskModalIsReviewOpen()&&window._taskModalStack&&window._taskModalStack.length&&typeof reviewElevateTaskModal==='function'){
    reviewElevateTaskModal();
    return;
  }
  ov.classList.add('con-arch-modal-on');
  ov.style.zIndex='26000';
}
function renderTaskReviewArchivosSideHtml(expId,taskId,t,e){
  const libre=t&&t.sinExpediente;
  let items=[];
  if(e)items=collectArchivosConsultaCompleto(e,taskId||null,{incluirAsociados:getExpAsociadosAll(e).length>0});
  else if(t&&libre){
    items=collectArchivosActLibre(t).map(function(it){
      const p=parseDrivePreviewUrl(it.url);
      const cod=t.codigo||expId;
      return Object.assign({},it,{
        exp:cod,asocDe:'',
        tipoDoc:'Actividad sin expediente · '+cod,
        descDoc:it.label||it.descDoc||'Documento',
        preview:it.local?(it.url||it.preview):(p.preview||p.url||it.url),
        openUrl:it.local?(it.url||it.preview):(p.url||it.url||it.preview)
      });
    });
  }
  window._conArchItems=items;
  window._conArchPanelExp=expId;
  if(!items.length)return '<div style="font-size:12px;color:var(--tx3);padding:10px">No hay enlaces Drive ni adjuntos registrados.</div>';
  const list=conArchivosListHtml(items,'renderTaskReviewArchivoPreview',expId);
  const hasAsoc=e&&getExpAsociadosAll(e).length>0;
  return '<div class="task-review-archivos-side">'+
    '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">Seleccione un documento para abrirlo en Drive'+(hasAsoc?' (incluye asociados)':'')+'.</div>'+
    '<div class="task-review-arch-list-only con-arch-list-col">'+list+'</div>'+
    '<div id="task-review-arch-action" class="task-review-arch-action"></div></div>';
}
function renderTaskReviewArchivoPreview(idx){
  const items=window._conArchItems||[];
  const it=items[idx];
  const listCol=document.querySelector('.task-review-arch-list-only');
  if(listCol)listCol.querySelectorAll('.con-arch-item').forEach(function(el,i){el.classList.toggle('on',i===idx);});
  const wrap=document.getElementById('task-review-arch-action');
  if(!wrap)return;
  if(!it){wrap.innerHTML='';return;}
  const url=String(it.openUrl||it.url||it.preview||'').trim();
  const sub=[it.tipoDoc||it.taskDesc||'',fmtF((it.fecha||'').slice(0,10)),it.version?'v'+it.version:''].filter(Boolean).join(' · ');
  wrap.innerHTML='<div class="task-review-arch-action-inner">'+
    '<div class="task-review-arch-action-name"><strong>'+escAttr(it.descDoc||it.label||'Documento')+'</strong>'+
    (sub?'<div class="task-review-arch-action-sub">'+escAttr(sub)+'</div>':'')+'</div>'+
    (url?'<button type="button" class="btn bsm bp" onclick="openDriveVentanaEmergente(\''+escAttr(url)+'\')">↗ Abrir en Drive</button>':'<span style="font-size:11px;color:var(--tx3)">Sin enlace disponible</span>')+
    '</div>';
}
function initTaskReviewArchivosSide(taskId){
  if(!(window._conArchItems||[]).length)return;
  let idx=0;
  if(taskId){
    const i=(window._conArchItems||[]).findIndex(function(it){return it.taskId===taskId;});
    if(i>=0)idx=i;
  }
  renderTaskReviewArchivoPreview(idx);
}
function openConsultaArchivosModal(expId){
  expId=String(expId||'').trim();
  if(!expId){notif('Indique el número de expediente','err');return;}
  openConsultaArchivos(expId,null,{forceModal:true});
}
function openConsultaArchivos(expId,taskId,opts){
  opts=opts||{};
  const id=String(expId||'').trim();
  if(!id){notif('Indique el número de expediente','err');return;}
  const e=getExpById(id);
  const actLibre=!e&&(opts.libre||typeof isActLibreRef==='function'&&isActLibreRef(id,taskId));
  if(!e&&!actLibre){notif('Expediente «'+id+'» no encontrado','err');return;}
  const panel=document.getElementById('con-side-panel');
  const panelOpen=!opts.forceModal&&panel&&panel.classList.contains('on')&&String(window._conPanelActive||'').trim()===id;
  if(panelOpen&&e){
    refreshConPanelDocumentos(id,taskId||null,true);
    scrollConPanelDocumentos();
    initConPanelArchivosPreview(taskId||null);
    return;
  }
  let items=[];
  if(e)items=collectArchivosConsultaCompleto(e,taskId||null,{incluirAsociados:getExpAsociadosAll(e).length>0});
  else{
    const act=getActLibreByCodigo(id)||getActLibreById(taskId);
    if(act){
      const cod=act.codigo||id;
      items=collectArchivosActLibre(act).map(it=>{
        const p=parseDrivePreviewUrl(it.url);
        return {
          ...it,exp:cod,asocDe:'',
          tipoDoc:'Actividad sin expediente · '+cod,
          descDoc:it.label||it.descDoc||'Documento',
          preview:it.local?(it.url||it.preview):(p.preview||p.url||it.url),
          openUrl:it.local?(it.url||it.preview):(p.url||it.url||it.preview)
        };
      });
    }
  }
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Archivos · '+id;
  if(modal){
    modal.classList.toggle('task-modal-wide',items.length>0);
    modal.classList.add('enviar-modal-only');
    modal.classList.toggle('task-modal-archivos',items.length>0);
    modal.classList.remove('task-modal-review');
  }
  taskModalZIndexApply(ov);
  window._conArchItems=items;
  if(!items.length){
    body.innerHTML='<div style="font-size:13px;color:var(--tx2);margin-bottom:12px">No hay enlaces Drive ni adjuntos registrados'+(taskId?' en esta actividad':' en este expediente')+'.</div>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">'+taskModalCloseBtnLabel()+'</button>';
  }else{
    const list=conArchivosListHtml(items,'renderConsultaArchivoPreview',id);
    const hasAsocMdl=e&&getExpAsociadosAll(e).length>0;
    body.innerHTML='<div class="con-arch-modal-hint">Seleccione un documento. Los archivos se agrupan por registro: el principal y los vinculados (PQRSD o expediente asociado).'+(hasAsocMdl?' <span style="color:var(--tx3)">Incluye documentos de registros asociados.</span>':'')+'</div>'+
      '<div class="con-arch-split"><div class="con-arch-list-col">'+list+'</div><div class="con-arch-preview-col" id="con-arch-preview-wrap"></div></div>'+
      '<div class="con-arch-modal-foot"><button type="button" class="btn bsm" onclick="closeTaskModal()">'+taskModalCloseBtnLabel()+'</button></div>';
    const selIdx=taskId?Math.max(0,(items||[]).findIndex(it=>it.taskId===taskId)):0;
    renderConsultaArchivoPreview(selIdx>=0?selIdx:0);
  }
  ov.classList.add('on');
  window._taskModalCtx=Object.assign({},window._taskModalCtx||{},{mode:'archivos',panelExp:id});
  if(reviewAsocStackActive()||(typeof taskModalIsReviewOpen==='function'&&taskModalIsReviewOpen()&&window._taskModalStack&&window._taskModalStack.length)){
    if(typeof reviewStackEnsureTaskModalFront==='function')reviewStackEnsureTaskModalFront();
    else if(typeof reviewElevateTaskModal==='function')reviewElevateTaskModal();
  }
}
function matchActLibre(t,q){
  if(!q)return true;
  const ql=String(q||'').toLowerCase().trim();
  if(!ql)return true;
  const cod=String(t.codigo||'').toLowerCase().trim();
  if(cod===ql)return true;
  const parts=[t.actividad,t.desc,t.detalle,t.interesadoNombre,t.interesadoEmpresa,t.interesadoCorreo,t.interesadoTelefono];
  (t.comentarios||[]).forEach(function(c){parts.push(c.texto);});
  if(parts.some(function(v){return String(v||'').toLowerCase().includes(ql);}))return true;
  return false;
}
function collectReviewAsocCandidatos(q,ctx){
  ctx=ctx||{};
  const source=String(ctx.sourceExp||ctx.sourceCod||'').trim();
  const ql=String(q||'').trim();
  const items=[];
  let baseList=typeof expsAmbito==='function'?expsAmbito():(exps||[]);
  baseList=baseList.filter(function(e){return!(typeof expEstaEnPapelera==='function'?expEstaEnPapelera(e):e._eliminado);});
  if(!ql&&ctx.mode==='pqrs-pick'){
    if(ctx.pqrsModo==='tramite')baseList=baseList.filter(function(e){return!(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e));});
    else baseList=baseList.filter(function(e){return typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);});
  }
  if(source)baseList=baseList.filter(function(e){return!expAsocMatchNum(e._exp,source);});
  if(ql)baseList=baseList.filter(function(e){return matchS(e,ql);});
  baseList.forEach(function(e){items.push({tipo:'exp',e:e,id:e._exp});});
  const incluirActs=!!ql||ctx.mode==='act-libre'||ctx.mode==='exp-asoc';
  if(incluirActs){
    const acts=(typeof actividadesLibres!=='undefined'?actividadesLibres:[]).map(function(t){
      return typeof normalizeActLibre==='function'?normalizeActLibre(t):t;
    }).filter(function(t){
      return t&&!t.eliminada&&String(t.codigo||'').trim()&&String(t.codigo||'').trim()!==source;
    });
    acts.filter(function(t){return matchActLibre(t,ql);}).forEach(function(t){
      items.push({tipo:'act',t:t,id:t.codigo||t.id});
    });
  }
  return items.slice(0,80);
}
function reviewAsocPickCardHtml(item){
  const q=(window._reviewAsocCtx||{}).q||'';
  const ctx=window._reviewAsocCtx||{};
  if(item.tipo==='act'){
    const t=item.t;
    const nom=typeof actLibreInteresadoLabel==='function'?actLibreInteresadoLabel(t):(t.interesadoNombre||t.desc||t.actividad||'');
    const puedeAsocAct=ctx.mode!=='act-libre'&&(ctx.mode==='exp-asoc'||ctx.mode==='pqrs-pick');
    return '<div class="review-asoc-card review-asoc-card-act">'+
      '<div class="review-asoc-card-hd"><strong style="font-family:\'DM Mono\',monospace">'+hl(t.codigo||'',q)+'</strong> <span class="bdg" style="font-size:10px">Actividad</span></div>'+
      '<div class="review-asoc-card-nom">'+hl(t.actividad||t.desc||'',q)+'</div>'+
      '<div class="review-asoc-card-meta">'+hl(nom,q)+'</div>'+
      '<div class="fx" style="gap:6px;margin-top:8px;flex-wrap:wrap">'+
      '<button type="button" class="btn bsm" onclick="reviewAsocVerConsulta(\''+jsStr(t.codigo||'')+'\',\''+jsStr(t.id||'')+'\',\'act\')">🔍 Consultar</button>'+
      '<button type="button" class="btn bsm" onclick="reviewAsocVerArchivos(\''+jsStr(t.codigo||'')+'\',\''+jsStr(t.id||'')+'\',true)">📁 Archivos</button>'+
      (puedeAsocAct?'<button type="button" class="btn bsm bp" onclick="confirmReviewAsocPickAct(\''+jsStr(t.id||'')+'\')">🖇️ Asociar</button>':'')+
      (ctx.mode==='act-libre'&&!puedeAsocAct?'<span style="font-size:11px;color:var(--tx3)">Vincule con expediente o PQRSD</span>':'')+
      '</div></div>';
  }
  const e=item.e;
  const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
  const esP=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  const det=e.f_f1||e._pqrs_detalle||e._detalle_general||'';
  const puedeAsoc=ctx.mode!=='act-libre'||true;
  return '<div class="review-asoc-card">'+
    '<div class="review-asoc-card-hd"><strong style="font-family:\'DM Mono\',monospace">'+hl(e._exp,q)+'</strong> '+(esP?'<span class="bdg" style="font-size:10px">PQRSD</span>':'')+'</div>'+
    '<div class="review-asoc-card-nom">'+hl(typeof getNom==='function'?getNom(e):'',q)+'</div>'+
    '<div class="review-asoc-card-meta">'+(tram?escAttr(tram.nombre):'')+(e._depto?' · '+escAttr(typeof labelDepto==='function'?labelDepto(e._depto):e._depto):'')+'</div>'+
    (det?'<div class="review-asoc-card-det">'+hl(String(det).slice(0,180),q)+'</div>':'')+
    '<div class="fx" style="gap:6px;margin-top:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm" onclick="reviewAsocVerConsulta(\''+jsStr(e._exp)+'\',\'\',\'exp\')">🔍 Consultar</button>'+
    '<button type="button" class="btn bsm" onclick="reviewAsocVerArchivos(\''+jsStr(e._exp)+'\')">📁 Archivos</button>'+
    (puedeAsoc?'<button type="button" class="btn bsm bp" onclick="confirmReviewAsocPick(\''+jsStr(e._exp)+'\')">🖇️ Asociar</button>':'')+
    '</div></div>';
}
function renderReviewAsocPickPanel(panelId){
  const id=panelId||window._reviewAsocPanelId||'review-asoc-body';
  const body=document.getElementById(id);
  if(!body)return;
  window._reviewAsocPanelId=id;
  const ctx=window._reviewAsocCtx||{};
  const q=String(ctx.q||'').trim();
  let modoTabs='';
  if(ctx.mode==='pqrs-pick'&&ctx.allowTramite){
    const m=ctx.pqrsModo||'pqrs';
    modoTabs='<div class="fx" style="gap:6px;margin-bottom:10px;flex-wrap:wrap">'+
      '<button type="button" class="btn bsm'+(m!=='tramite'?' bp':'')+'" onclick="setReviewAsocPqrsModo(\'pqrs\')">PQRSD</button>'+
      '<button type="button" class="btn bsm'+(m==='tramite'?' bp':'')+'" onclick="setReviewAsocPqrsModo(\'tramite\')">Expediente</button></div>';
  }
  const list=collectReviewAsocCandidatos(q,ctx);
  const hint=ctx.mode==='act-libre'
    ?'Busque por número, nombre, correo del radicado, asunto o actividad sin expediente.'
    :'Busque por número, interesado, asunto, correo de radicación, actividad sin expediente u otros datos.';
  body.innerHTML=
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">'+hint+'</div>'+
    modoTabs+
    '<div class="fld" style="margin-bottom:10px"><input type="text" id="review-asoc-q" value="'+escAttr(q)+'" placeholder="Nombre, N° expediente, correo, asunto…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" oninput="onReviewAsocSearchInput(this)"></div>'+
    '<div id="review-asoc-list" class="review-asoc-list">'+
    (list.length?list.map(reviewAsocPickCardHtml).join(''):'<div style="font-size:12px;color:var(--tx3);padding:12px 4px">Sin coincidencias. Pruebe con otro término.</div>')+
    '</div>';
}
function onReviewAsocSearchInput(inp){
  const ctx=window._reviewAsocCtx||{};
  ctx.q=String((inp&&inp.value)||'').trim();
  window._reviewAsocCtx=ctx;
  const listEl=document.getElementById('review-asoc-list');
  if(!listEl)return;
  const list=collectReviewAsocCandidatos(ctx.q,ctx);
  listEl.innerHTML=list.length?list.map(reviewAsocPickCardHtml).join(''):'<div style="font-size:12px;color:var(--tx3);padding:12px 4px">Sin coincidencias. Pruebe con otro término.</div>';
}
function setReviewAsocPqrsModo(modo){
  const ctx=window._reviewAsocCtx||{};
  ctx.pqrsModo=modo==='tramite'?'tramite':'pqrs';
  window._reviewAsocCtx=ctx;
  renderReviewAsocPickPanel();
}
function openReviewAsocPickPanel(opts){
  opts=opts||{};
  const t=opts.task||null;
  const ref=String(opts.ref||'').trim();
  const taskId=String(opts.taskId||'').trim();
  let ctx={q:'',ref:ref,taskId:taskId};
  if(t&&t.sinExpediente){
    ctx.mode='act-libre';
    ctx.sourceCod=t.codigo||ref;
    ctx.taskId=t.id||taskId;
  }else{
    const expId=t?(t.exp||ref):ref;
    const e=typeof getExpById==='function'?getExpById(expId):null;
    ctx.sourceExp=expId;
    if(e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)&&typeof puedeGestionarPqrsAsociacion==='function'&&puedeGestionarPqrsAsociacion(e)){
      ctx.mode='pqrs-pick';
      ctx.pqrsModo='pqrs';
      ctx.allowTramite=typeof esPqrsAsocContextoNca==='function'&&esPqrsAsocContextoNca(e);
    }else{
      ctx.mode='exp-asoc';
    }
  }
  window._reviewAsocCtx=ctx;
  window._reviewAsocPanelId='review-asoc-body';
  if(typeof reviewPanelPrepOpen==='function')reviewPanelPrepOpen();
  const ov=document.getElementById('review-asoc-overlay');
  const panel=document.getElementById('review-asoc-panel');
  const tit=document.getElementById('review-asoc-tit');
  if(!ov||!panel){notif('No se pudo abrir el buscador de asociación','err');return;}
  if(tit)tit.textContent='🖇️ Buscar registro para asociar';
  renderReviewAsocPickPanel();
  ov.classList.add('on');
  panel.classList.add('on');
  if(typeof elevateOverlayAboveModals==='function'){
    elevateOverlayAboveModals(ov,100058);
    elevateOverlayAboveModals(panel,100059);
  }
  setTimeout(function(){const inp=document.getElementById('review-asoc-q');if(inp)inp.focus();},120);
}
function cerrarReviewAsocPanel(){
  const ov=document.getElementById('review-asoc-overlay');
  const panel=document.getElementById('review-asoc-panel');
  if(ov)ov.classList.remove('on');
  if(panel)panel.classList.remove('on');
  if(typeof resetOverlayElevation==='function'){
    resetOverlayElevation(ov);
    resetOverlayElevation(panel);
  }
  window._reviewAsocCtx=null;
}
function reviewAsocVerArchivos(expId,taskId,libre){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  if(!expId)return;
  if(typeof pushTaskModalLayer==='function')pushTaskModalLayer('archivos');
  if(typeof openConsultaArchivos==='function')openConsultaArchivos(expId,taskId||null,{forceModal:true,libre:!!libre});
  if(typeof reviewStackEnsureTaskModalFront==='function')reviewStackEnsureTaskModalFront();
  else if(typeof reviewElevateTaskModal==='function')reviewElevateTaskModal();
}
function renderReviewAsocActConsultaFull(expId,taskId,opts){
  opts=opts&&typeof opts==='object'?opts:{};
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  const compact=!!opts.compact;
  const t=(typeof getActLibreByCodigo==='function'?getActLibreByCodigo(expId):null)||(typeof getActLibreById==='function'?getActLibreById(taskId):null);
  if(!t)return '<div style="font-size:12px;color:var(--tx3)">Actividad no encontrada</div>';
  const tN=typeof normalizeActLibre==='function'?normalizeActLibre(t):t;
  const est=typeof estadoTask==='function'?estadoTask(tN):'';
  const lbl=typeof estadoTaskLabel==='function'?estadoTaskLabel(tN):est;
  const st=typeof taskEstadoStyle==='function'?taskEstadoStyle(est,tN):{bg:'var(--sf2)',fg:'var(--tx)'};
  const depto=tN.depto||(typeof deptoActivo!=='undefined'?deptoActivo:'');
  const ref=tN.codigo||expId;
  const vence=typeof taskVenceEfectivo==='function'?(taskVenceEfectivo(tN)||tN.vence):tN.vence;
  const ini=typeof taskFechaInicio==='function'?taskFechaInicio(tN):'';
  const toolbar='<div class="con-panel-toolbar" style="margin-bottom:10px">'+
    '<span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+escAttr(lbl)+'</span> '+
    '<span class="bdg" style="background:var(--pul);color:var(--pu)">Actividad</span> '+
    (typeof badgeDepto==='function'?badgeDepto(depto):'')+
    (tN.prioritaria?' <span class="bdg bdg-prior">⚡ Prioritaria</span>':'')+
    '</div>';
  const detalle='<div class="con-panel-form-wrap" style="margin-bottom:10px">'+
    (compact?'':'<div style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:600;margin-bottom:6px">'+escAttr(ref)+'</div>')+
    '<div class="slbl" style="margin-bottom:6px">'+escAttr(tN.actividad||tN.desc||'Actividad')+'</div>'+
    (tN.desc&&tN.desc!==tN.actividad?'<div style="font-size:13px;margin:0 0 10px;line-height:1.55;color:var(--tx2)">'+escAttr(tN.desc)+'</div>':'')+
    (tN.detalle?'<div style="font-size:13px;margin:0 0 10px;line-height:1.55;color:var(--tx2)">'+escAttr(tN.detalle)+'</div>':'')+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;font-size:12px">'+
    '<div><div style="color:var(--tx3);font-size:11px;margin-bottom:2px">Responsables</div><div>'+escAttr(typeof taskResponsablesLabel==='function'?taskResponsablesLabel(tN,true):(tN.responsable||'—'))+'</div></div>'+
    '<div><div style="color:var(--tx3);font-size:11px;margin-bottom:2px">Inicio</div><div>'+(typeof fmtF==='function'?fmtF(ini):escAttr(ini))+'</div></div>'+
    '<div><div style="color:var(--tx3);font-size:11px;margin-bottom:2px">Vence</div><div style="color:'+(typeof taskActividadVencida==='function'&&taskActividadVencida(tN)?'var(--rd)':'inherit')+'">'+(typeof fmtF==='function'?fmtF(vence):escAttr(vence))+'</div></div>'+
    (tN.fechaReportada?'<div><div style="color:var(--tx3);font-size:11px;margin-bottom:2px">Reportada</div><div>'+(typeof fmtF==='function'?fmtF(tN.fechaReportada):'')+'</div></div>':'')+
    (tN.fechaAtendida?'<div><div style="color:var(--tx3);font-size:11px;margin-bottom:2px">Cierre</div><div>'+(typeof fmtF==='function'?fmtF(tN.fechaAtendida):'')+'</div></div>':'')+
    '</div></div>';
  const hist=(tN.historial||[]).length
    ?('<details class="con-fold" open><summary>Trazabilidad</summary><div class="item-fold-body" style="font-size:12px;color:var(--tx2);line-height:1.55">'+(typeof renderTaskHistorialHtml==='function'?renderTaskHistorialHtml(tN):'')+'</div></details>')
    :'<div style="font-size:12px;color:var(--tx3)">Sin eventos de trazabilidad aún</div>';
  return toolbar+detalle+hist;
}
function renderReviewAsocConsultaPreview(expId,taskId,tipo){
  tipo=tipo||'exp';
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  if(tipo==='act')return renderReviewAsocActConsultaFull(expId,taskId);
  const e=typeof getExpById==='function'?getExpById(expId):null;
  if(!e)return '<div style="font-size:12px;color:var(--tx3)">Registro no encontrado</div>';
  if(typeof migrarInfoTecExpediente==='function')migrarInfoTecExpediente(e);
  const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
  const hdr='<div class="con-panel-toolbar" style="margin-bottom:10px">'+
    badgeEst(e._estado)+' '+badgeTram(e._tramite,e)+badgeDepto(e._depto)+' '+
    (typeof flagsHtmlCompact==='function'?flagsHtmlCompact(e):'')+
    (typeof pqrsPrioritariaBadge==='function'?(' '+pqrsPrioritariaBadge(e)):'')+
    (typeof pqrsInformativaBadge==='function'?(' '+pqrsInformativaBadge(e)):'')+
    '</div>'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:4px;font-family:\'DM Mono\',monospace">'+escAttr(e._exp)+'</div>'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:6px">'+escAttr(typeof getNom==='function'?getNom(e):'')+'</div>'+
    (tram?'<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+escAttr(tram.nombre)+(e._subclase?' · '+escAttr(e._subclase):'')+'</div>':'')+
    (typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)&&typeof renderConPanelPqrsExtras==='function'?renderConPanelPqrsExtras(e):'');
  return '<div class="review-asoc-consulta-full">'+hdr+renderConPanelExpContent(e,{foldOpen:true})+'</div>';
}
function reviewAsocVerConsulta(expId,taskId,tipo){
  expId=String(expId||'').trim();
  taskId=String(taskId||'').trim();
  if(!expId)return;
  if(typeof pushTaskModalLayer==='function')pushTaskModalLayer('consulta');
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='🔍 Consulta · '+expId;
  if(modal){modal.classList.add('task-modal-wide');modal.classList.add('enviar-modal-only');modal.classList.add('review-asoc-consulta-modal');}
  body.innerHTML='<div class="review-asoc-consulta-body">'+renderReviewAsocConsultaPreview(expId,taskId,tipo||'exp')+'</div>'+
    '<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">'+((typeof taskModalCloseBtnLabel==='function')?taskModalCloseBtnLabel():'Cerrar')+'</button></div>';
  ov.classList.add('on');
  if(typeof reviewStackEnsureTaskModalFront==='function')reviewStackEnsureTaskModalFront();
  else if(typeof reviewElevateTaskModal==='function')reviewElevateTaskModal();
}
function asociarExpedienteDesdeRevision(sourceExpId,targetExpNum){
  sourceExpId=String(sourceExpId||'').trim();
  targetExpNum=String(targetExpNum||'').trim();
  const e=typeof getExpById==='function'?getExpById(sourceExpId):null;
  if(!e||!targetExpNum){notif('Datos incompletos para asociar','err');return false;}
  if(expAsocMatchNum(targetExpNum,sourceExpId)){notif('No puede asociar el registro consigo mismo','err');return false;}
  const target=typeof findExpByNumPlain==='function'?findExpByNumPlain(targetExpNum):null;
  if(!target){notif('No se encontró «'+targetExpNum+'»','err');return false;}
  if(typeof expAsocVinculoPermitido==='function'&&!expAsocVinculoPermitido(target,e)){notif('No puede vincular con ese registro','err');return false;}
  const previos=typeof getExpAsociadosDirectos==='function'?getExpAsociadosDirectos(e):[];
  if(previos.some(function(n){return expAsocMatchNum(n,target._exp);})){notif('Este vínculo ya está registrado','ok');return true;}
  const nuevos=previos.concat([target._exp]);
  e._usar_exp_asociados=true;
  e._expedientes_asociados=JSON.stringify(nuevos);
  if(typeof aplicarAsociadosBidireccional==='function')aplicarAsociadosBidireccional(sourceExpId,nuevos,previos);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  if(target&&target._exp!==e._exp&&typeof persistExpedienteGranular==='function')persistExpedienteGranular(target,false);
  notif('Vinculado a '+target._exp,'ok');
  return true;
}
function confirmReviewAsocPickAct(actTaskId){
  actTaskId=String(actTaskId||'').trim();
  const ctx=window._reviewAsocCtx||{};
  if(!actTaskId){notif('Actividad no válida','err');return;}
  const sourceExp=String(ctx.sourceExp||'').trim();
  if(!sourceExp){notif('Registro origen no definido','err');return;}
  const target=typeof getExpById==='function'?getExpById(sourceExp):null;
  if(!target){notif('Registro origen no encontrado','err');return;}
  let ok=false;
  if(typeof vincularActLibreAExpediente==='function'){
    const pack=vincularActLibreAExpediente(actTaskId,target);
    ok=!!pack;
    if(ok)notif('Actividad vinculada a '+sourceExp,'ok');
  }
  if(ok){
    cerrarReviewAsocPanel();
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
    const parent=window._taskModalCtx||{};
    if(parent.isReviewDelivery&&parent.expId&&parent.taskId&&typeof openTaskCommentsModal==='function')
      openTaskCommentsModal(parent.expId,parent.taskId);
  }
}
function confirmReviewAsocPick(targetExpId){
  targetExpId=String(targetExpId||'').trim();
  const ctx=window._reviewAsocCtx||{};
  if(!targetExpId){notif('Seleccione un registro','err');return;}
  let ok=false;
  if(ctx.mode==='act-libre'){
    const tid=String(ctx.taskId||'').trim();
    const target=typeof getExpById==='function'?getExpById(targetExpId):null;
    if(!target){notif('Registro no encontrado','err');return;}
    if(typeof vincularActLibreAExpediente==='function'){
      const pack=vincularActLibreAExpediente(tid,target);
      ok=!!pack;
      if(ok){
        notif('Actividad vinculada a '+targetExpId,'ok');
        cerrarReviewAsocPanel();
        if(typeof renderActividades==='function')renderActividades();
        if(typeof openTaskCommentsModal==='function')openTaskCommentsModal(targetExpId,pack.taskId||tid);
      }
    }
    return;
  }
  if(ctx.mode==='pqrs-pick'){
    const modo=ctx.pqrsModo==='tramite'?'tramite':'pqrs';
    ok=typeof asociarVinculoAPqrs==='function'&&asociarVinculoAPqrs(ctx.sourceExp,targetExpId,modo);
  }else{
    ok=asociarExpedienteDesdeRevision(ctx.sourceExp,targetExpId);
  }
  if(ok){
    cerrarReviewAsocPanel();
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))renderConsulta();
    const parent=window._taskModalCtx||{};
    if(parent.isReviewDelivery&&parent.expId&&parent.taskId&&typeof openTaskCommentsModal==='function')
      openTaskCommentsModal(parent.expId,parent.taskId);
  }
}
function cerrarConsultaPanel(){
  const keepReview=!!window._reviewKeepOpen;
  liberarExpLock(window._conPanelActive);
  detenerRenovacionExpLock();
  window._conPanelLockMsg=null;
  const ov=document.getElementById('con-side-overlay');
  const panel=document.getElementById('con-side-panel');
  if(window._conPanelEditMode)editId=null;
  window._conPanelEditMode=false;
  if(panel)panel.classList.remove('con-panel-editing');
  if(ov)ov.classList.remove('on');
  if(panel)panel.classList.remove('on');
  window._conPanelExps=null;
  window._conPanelActive=null;
  window._conPanelTaskId=null;
  window._conPanelActLibre=null;
  window._conPanelActLibreReadOnly=false;
  window._conPanelPqrsNcaEdit=false;
  window._conPanelDesdeConsulta=false;
  restoreCfgDeptoUsuario();
  if(keepReview){
    reviewPanelResetConSide();
    return;
  }
}
function getConPanelExpGroup(expId){
  const e=exps.find(x=>String(x._exp||'').trim()===String(expId||'').trim());
  if(!e)return[];
  const ids=[String(e._exp||'').trim()];
  getExpAsociadosAll(e).forEach(n=>{if(n&&!ids.includes(n))ids.push(n);});
  return ids;
}
function renderConPanelPqrsActividadesResumen(e){
  const tasks=(e.tasks||[]).map(normalizeTask).filter(t=>!t.eliminada&&taskEsAtenderPqrs(t,e));
  if(!tasks.length)return '<details class="con-fold"><summary>Responsables asignados (0)</summary><div class="item-fold-body"><div style="font-size:12px;color:var(--tx3)">Sin responsables asignados aún</div></div></details>';
  const encGuaviare=getEncargadoDepto('guaviare');
  let rows='';
  tasks.forEach(t=>{
    getTaskResponsables(t).forEach(n=>{
      if(encGuaviare&&agendaNorm(n)===agendaNorm(encGuaviare))return;
      rows+='<div style="padding:4px 0;font-size:13px;display:flex;gap:8px;align-items:center"><strong>'+escAttr(n)+'</strong><span class="bdg" style="font-size:10px">'+escAttr(estadoTaskLabel(t))+'</span></div>';
    });
  });
  if(!rows)rows='<div style="font-size:12px;color:var(--tx3)">Sin contratistas asignados — use «Asignar responsable» arriba</div>';
  return '<details class="con-fold"><summary>Responsables asignados ('+tasks.length+')</summary><div class="item-fold-body">'+rows+'</div></details>';
}
function renderConPanelExpContent(e,opts){
  opts=opts||{};
  migrarInfoTecExpediente(e);
  const ter=calcTerminos(e);
  const tasks=sortTasksByUrgency((e.tasks||[]).map(normalizeTask).filter(t=>!t.eliminada));
  const actHtml=tasks.length?tasks.map(t=>renderTaskConsultaItem(e,t,'')).join(''):'<div style="font-size:12px;color:var(--tx3);padding:6px 0">Sin actividades</div>';
  const pendAct=tasks.filter(t=>estadoTask(t)!=='Atendida').length;
  const foldOpen=opts.foldOpen===true;
  const actBlock='<details class="con-fold con-act-fold"'+(foldOpen&&pendAct?' open':'')+'><summary>Actividades asignadas ('+tasks.length+')'+conActCoEjSummaryHtml(tasks)+'</summary><div class="item-fold-body">'+actHtml+'</div></details>';
  const docsPqrs=esPqrsSecretaria(e)?htmlPqrsDocumentoEnPanel(e).replace(' open','').replace('<details class="con-fold" open>','<details class="con-fold">'):'';
  return (ter?'<div style="margin-bottom:.65rem">'+termsBar(ter)+'</div>':'')+
    '<details class="con-fold"'+(foldOpen?' open':'')+'><summary>Línea de tiempo del trámite</summary><div class="item-fold-body">'+renderFullTimeline(e)+'</div></details>'+
    renderInteresadoView(e)+
    renderDetalleConsultaView(e)+
    docsPqrs+
    renderInfoTecConsultaView(e)+
    renderContableView(e)+
    (actosAdminData(e._actos_admin).length?'<details class="con-fold"><summary>Normatividad / actos administrativos</summary><div class="item-fold-body">'+renderActosAdminView(e).replace(/^<div><div class="slbl">[^<]+<\/div>/,'').replace(/<\/div>$/,'')+'</div></details>':'')+
    (conceptosSegData(e._conceptos_seg).length?'<details class="con-fold"><summary>Conceptos de seguimiento</summary><div class="item-fold-body">'+renderConceptosSegView(e).replace(/^<div><div class="slbl">[^<]+<\/div>/,'').replace(/<\/div>$/,'')+'</div></details>':'')+
    actBlock;
}
function renderConSidePanel(){
  if(window._conPanelActLibre&&typeof renderConSidePanelActLibre==='function'){
    renderConSidePanelActLibre();
    return;
  }
  const active=window._conPanelActive;
  const ids=window._conPanelExps||[];
  const e=exps.find(x=>String(x._exp||'').trim()===String(active||'').trim());
  if(e&&esOficinaPqrsBasica()&&esPqrsSecretaria(e)){cerrarConsultaPanel();return;}
  if(!e)return;
  syncCfgToStore();
  if(e._depto)setCfgPtr(e._depto);
  const tit=document.getElementById('con-side-tit');
  const sub=document.getElementById('con-side-sub');
  const body=document.getElementById('con-side-body');
  const panel=document.getElementById('con-side-panel');
  if(!body)return;
  const tram=getTram(e._tramite,e);
  const primary=ids[0]||e._exp;
  if(tit)tit.textContent=ids.length>1?('Expedientes vinculados ('+ids.length+')'):e._exp;
  if(sub)sub.textContent=getNom(e)+(tram?' · '+tram.nombre:'')+(e._subclase?' · '+e._subclase:'')+(window._conPanelEditMode?' · edición en '+uiEditorContenedorLbl():ids.length>1?' · Use las pestañas para cambiar':'');
  const tabs=ids.length>1?('<div class="con-panel-tabs">'+ids.map(id=>{
    const ex=exps.find(x=>String(x._exp||'').trim()===id);
    const isMain=id===primary;
    return '<button type="button" class="con-panel-tab'+(id===active?' on':'')+(isMain?'':' asoc')+'" data-sst-action="conPanelSelExp" data-sst-exp="'+escAttr(id)+'">'+escAttr(id)+(isMain?'':' ↗')+'</button>';
  }).join('')+'</div>'):'';
  const canEdit=puedeEditarExpPanel();
  const lockedByOther=!window._conPanelEditMode&&!!getExpLockVigente(e._exp)&&!poseeExpLock(e._exp);
  const lockBanner=window._conPanelLockMsg?('<div style="padding:10px 12px;margin-bottom:10px;border-radius:var(--r);background:var(--aml);border:1px solid #e8c97a;font-size:12px;color:#7a5500;line-height:1.45">'+escAttr(window._conPanelLockMsg)+'</div>'):'';
  const altaBanner=typeof renderAltaResponsableBannerHtml==='function'?renderAltaResponsableBannerHtml(e,{expId:e._exp,showDone:true}):'';
  const pqrsToolbarBtns=!window._conPanelEditMode&&esPqrsSecretaria(e)?(
    (puedeMarcarPqrsInformativa(e)?'<button type="button" class="btn bsm bic act-ico" title="Informativa" onclick="SST.openMarcarPqrsInformativaModal(\''+escAttr(e._exp)+'\')">ℹ️</button>':'')+
    (puedeTrasladarPqrsInicial(e)||puedeTrasladarPqrs(e)||puedeAsignarPqrsOficina(e)?'<button type="button" class="btn bsm bic act-ico" title="Trasladar" onclick="openTrasladarPqrsSmart(\''+escAttr(e._exp)+'\')">🔄</button>':'')+
    (puedeAsignarPqrsOficina(e)?'<button type="button" class="btn bsm bic act-ico" title="Asignar" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤</button>':'')+
    (puedeMarcarPqrsRespondida(e)?'<button type="button" class="btn bsm bic act-ico bp" title="Responder" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓</button>':'')
  ):'';
  const archToolbarBtn=window._conPanelEditMode?'':expBtnArchHtml(e._exp,{cls:'bp bic act-ico',label:'📁',title:'Documentos y enlaces Drive del expediente'});
  const asocPanelBtn=(!window._conPanelEditMode&&(canEdit||puedeGestionarPqrsAsociacion(e)))||window._conPanelEditMode&&canEdit?'<button type="button" class="btn bsm bic act-ico" title="Asociar expediente o PQRSD" onclick="conPanelAsociarExp()">🖇️</button>':'';
  const editToggleBtn=!window._conPanelEditMode&&canEdit&&!window._conPanelPqrsNcaEdit&&!lockedByOther?'<button type="button" class="btn bsm bic act-ico bp" data-sst-action="conPanelActivarEdicion" data-sst-exp="'+escAttr(e._exp)+'" title="Editar registro">✏️</button>':'';
  const toolbar='<div class="con-panel-toolbar">'+
    badgeEst(e._estado)+' '+badgeTram(e._tramite,e)+badgeDepto(e._depto)+flagsHtmlCompact(e)+' '+pqrsPrioritariaBadge(e)+' '+pqrsInformativaBadge(e)+
    (typeof expAltaResponsableBadgeHtml==='function'?expAltaResponsableBadgeHtml(e):'')+' '+
    pqrsToolbarBtns+
    asocPanelBtn+
    archToolbarBtn+
    '<button type="button" class="btn bsm bic btn-export-exp" onclick="exportarExpediente(\''+escAttr(e._exp)+'\')" title="Exportar expediente (.json)"><span class="export-ico">⬇</span></button>'+
    editToggleBtn+
    '</div>';
  if(panel)panel.classList.toggle('con-panel-editing',!!window._conPanelEditMode);
  const taskBar=renderConPanelTaskBarHtml(e._exp);
  const archOpen=!!window._conPanelOpenArchivos;
  const archivosBlock=renderConPanelDocumentosBlock(e,null,archOpen);
  if(window._conPanelEditMode&&canEdit){
    syncCfgToStore();
    setCfgPtr(e._depto||getDeptoOperativo());
    editId=e._exp;
    const pqrsExtras=esPqrsSecretaria(e)?renderConPanelPqrsExtras(e):'';
    body.innerHTML=tabs+lockBanner+altaBanner+toolbar+taskBar+archivosBlock+pqrsExtras+'<div id="con-side-form-wrap" class="con-panel-form-wrap"></div>';
    renderFormulario(e._tramite,e,'con-side-form-wrap');
    if((window._conArchItems||[]).length)setTimeout(()=>initConPanelArchivosPreview(window._conPanelTaskId||null),80);
    setTimeout(function(){
      conPanelColapsarTodasSecciones();
      if(window._conPanelFocusActividades){
        conPanelFocusActividadesAsignadas();
        window._conPanelFocusActividades=false;
      }
    },80);
    return;
  }
  body.innerHTML=tabs+lockBanner+altaBanner+toolbar+taskBar+archivosBlock+(esPqrsSecretaria(e)?renderConPanelPqrsExtras(e):'')+renderConPanelExpContent(e,{foldOpen:!!(esOficinaPqrsNca()&&esPqrsSecretaria(e))});
  if((window._conArchItems||[]).length)setTimeout(()=>initConPanelArchivosPreview(window._conPanelTaskId||null),80);
}
function conPanelFocusActividadesAsignadasIn(rootSel){
  const wrap=document.querySelector(rootSel||'#con-side-form-wrap');
  if(!wrap)return;
  let actSec=null;
  wrap.querySelectorAll('details.form-section').forEach(function(d){
    const s=d.querySelector('summary');
    const isAct=!!(s&&/Actividades asignadas/i.test(s.textContent||''));
    d.open=isAct;
    if(isAct)actSec=d;
  });
  if(actSec)actSec.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function conPanelFocusActividadesAsignadas(){
  conPanelFocusActividadesAsignadasIn('#con-side-form-wrap');
}
function conPanelFocusExpAsoc(){
  const cb=document.getElementById('fld__usar_exp_asociados');
  const box=document.getElementById('exp-asoc-box');
  if(cb&&!cb.checked){cb.checked=true;if(typeof toggleExpAsociados==='function')toggleExpAsociados();}
  const wrap=document.getElementById('con-side-form-wrap');
  if(wrap){
    wrap.querySelectorAll('details.form-section').forEach(function(d){
      if(box&&d.contains(box))d.open=true;
    });
  }
  if(box)box.scrollIntoView({behavior:'smooth',block:'nearest'});
  else if(typeof addExpAsoc==='function')addExpAsoc();
}
function conPanelAsociarExp(){
  const expId=String(window._conPanelActive||'').trim();
  const e=getExpById(expId);
  if(!e){notif('Expediente no encontrado','err');return;}
  if(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)&&typeof puedeGestionarPqrsAsociacion==='function'&&puedeGestionarPqrsAsociacion(e)){
    SST.openAsociarUnificadoModal(expId);
    return;
  }
  if(!window._conPanelEditMode&&typeof conPanelActivarEdicion==='function'){
    if(typeof resolverEdicionConBloqueo==='function'&&!resolverEdicionConBloqueo(expId,true)){
      if(window._conPanelLockMsg)notif(window._conPanelLockMsg,'err');
      return;
    }
    conPanelActivarEdicion(expId);
    setTimeout(conPanelFocusExpAsoc,180);
    return;
  }
  conPanelFocusExpAsoc();
}
function conPanelVerSoloLectura(){
  liberarExpLock(window._conPanelActive);
  detenerRenovacionExpLock();
  window._conPanelEditMode=false;
  renderConSidePanel();
}
function conPanelActivarEdicion(expId){
  expId=String(expId||window._conPanelActive||'').trim();
  if(!resolverEdicionConBloqueo(expId,true)){
    if(window._conPanelLockMsg)notif(window._conPanelLockMsg,'err');
    renderConSidePanel();
    return;
  }
  const pgCon=document.getElementById('pg-con');
  window._conPanelEditMode=true;
  window._conPanelOpenArchivos=false;
  window._conPanelDesdeConsulta=!!(pgCon&&pgCon.classList.contains('on'));
  window._conPanelActive=expId;
  renderConSidePanel();
}
function conPanelSelExp(expId){
  const prev=window._conPanelActive;
  const wasEdit=window._conPanelEditMode;
  if(wasEdit&&prev&&prev!==expId)liberarExpLock(prev);
  window._conPanelActive=String(expId||'').trim();
  if(wasEdit){
    window._conPanelEditMode=resolverEdicionConBloqueo(window._conPanelActive,true);
    if(!window._conPanelEditMode&&window._conPanelLockMsg)notif(window._conPanelLockMsg,'err');
  }
  renderConSidePanel();
}
function abrirConsultaExpPanel(expId,opts){
  opts=opts||{};
  const id=String(expId||'').trim();
  if(!id){notif('Indique el número de expediente','err');return;}
  if(abrirPqrsBasicoSiAplica(id,opts))return;
  const e=exps.find(x=>String(x._exp||'').trim()===id);
  if(!e){notif('Expediente «'+id+'» no encontrado','err');return;}
  const hasAsoc=getExpAsociadosAll(e).length>0;
  const allowSingle=opts.allowSingle!==false;
  if(!hasAsoc&&!allowSingle){notif('Expediente sin asociados','err');return;}
  const panel=document.getElementById('con-side-panel');
  const overlay=document.getElementById('con-side-overlay');
  if(!panel){notif('No se pudo abrir la ventana del expediente','err');return;}
  if(opts.soloExp)window._conPanelExps=[id];
  else window._conPanelExps=hasAsoc?getConPanelExpGroup(id):[id];
  window._conPanelActive=id;
  if(esPqrsSecretaria(e)&&(esModoResponsable()||esModoOficinaDeguv())&&!esVistaActividadesDepto())opts.edit=false;
  if(esVistaActividadesDepto())window._conPanelPqrsNcaEdit=false;
  const wantEdit=opts.edit!==false&&(opts.edit===true||puedeEditarExpPanel());
  if(wantEdit){
    window._conPanelEditMode=resolverEdicionConBloqueo(id,true);
    if(!window._conPanelEditMode&&window._conPanelLockMsg)notif(window._conPanelLockMsg,'err');
  }else{
    window._conPanelLockMsg=null;
    detenerRenovacionExpLock();
    window._conPanelEditMode=false;
  }
  const pgCon=document.getElementById('pg-con');
  window._conPanelDesdeConsulta=!!(opts.desdeConsulta||(pgCon&&pgCon.classList.contains('on')&&window._conPanelEditMode));
  if(window._conPanelEditMode&&!opts.openArchivos)window._conPanelOpenArchivos=false;
  renderConSidePanel();
  if(overlay)overlay.classList.add('on');
  panel.classList.add('on');
  requestAnimationFrame(function(){
    if(panel&&panel.classList.contains('on')){
      panel.scrollTop=0;
      try{panel.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){}
    }
  });
}
// CON_CONSULTA_PAGE → js/constants.js
let _conConsultaPag={list:[],shown:0,mode:'',qs:'',today:''};

/** Stub de consulta para actividades sin expediente (misma lista que expedientes). */
function actLibreAsConsultaStub(t){
  t=typeof normalizeActLibre==='function'?normalizeActLibre(t):t;
  const fecha=String(t.fechaCreacion||t.fechaAsignacion||t.fechaReportada||t.fechaAtendida||'').slice(0,10);
  return {
    _consulta_act_libre:true,
    _exp:String(t.codigo||t.id||'').trim(),
    _act_id:String(t.id||'').trim(),
    _fecha:fecha,
    _estado:typeof estadoTask==='function'?estadoTask(t):(t.estado||''),
    _depto:typeof deptoEfectivoActLibre==='function'?deptoEfectivoActLibre(t):(t.depto||''),
    _tramite:'',
    f_f1:t.actividad||t.desc||'',
    tasks:[t],
    _act_libre_task:t
  };
}
function shouldIncludeActLibresEnConsulta(){
  if(typeof esOficinaPqrsBasica==='function'&&esOficinaPqrsBasica())return false;
  if(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv())return false;
  if(typeof esSecretaria==='function'&&esSecretaria())return false;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return false;
  return true;
}
function actLibresAmbitoConsulta(){
  const raw=(typeof actividadesLibres!=='undefined'&&Array.isArray(actividadesLibres))?actividadesLibres:[];
  let acts=raw.map(function(t){return typeof normalizeActLibre==='function'?normalizeActLibre(t):t;})
    .filter(function(t){return t&&!t.eliminada&&String(t.codigo||'').trim();});
  if(typeof esJurisdiccional==='function'&&esJurisdiccional())return acts;
  if(typeof esModoResponsable==='function'&&esModoResponsable())return acts;
  const d=typeof deptoActivo!=='undefined'?deptoActivo:'';
  if(!d||d==='responsables')return acts;
  return acts.filter(function(t){
    return typeof deptoEfectivoActLibre==='function'?deptoEfectivoActLibre(t)===d:String(t.depto||'')===d;
  });
}
function collectConsultaActLibres(q,qt,qe,qi,qact,qf){
  if(!shouldIncludeActLibresEnConsulta())return[];
  // Filtros propios de expediente/PQRSD: no mezclar stubs libres
  if(qt||qe||qf)return[];
  return actLibresAmbitoConsulta().filter(function(t){
    if(typeof matchActLibre==='function'&&!matchActLibre(t,q))return false;
    if(qi){
      const ok=typeof taskUsuarioEsAsignado==='function'?taskUsuarioEsAsignado(t,qi)
        :(String(t.responsable||'')===qi||(Array.isArray(t.asignados)&&t.asignados.indexOf(qi)>=0));
      if(!ok)return false;
    }
    if(qact){
      const stub={tasks:[t]};
      if(typeof matchActividadFiltro==='function'&&!matchActividadFiltro(stub,qact))return false;
    }
    return true;
  }).map(actLibreAsConsultaStub);
}
function conConsultaActLibreCard(stub){
  const t=stub._act_libre_task||(stub.tasks&&stub.tasks[0]);
  if(!t)return'';
  const qs=_conConsultaPag.qs||'';
  const cod=String(stub._exp||t.codigo||'').trim();
  const tid=String(stub._act_id||t.id||'').trim();
  const nom=typeof actLibreInteresadoLabel==='function'?actLibreInteresadoLabel(t):(t.interesadoNombre||'—');
  const est=typeof estadoTask==='function'?estadoTask(t):(t.estado||'');
  const lbl=typeof estadoTaskLabel==='function'?estadoTaskLabel(t):est;
  const st=typeof taskEstadoStyle==='function'?taskEstadoStyle(est,t):{bg:'var(--sf2)',fg:'var(--tx)'};
  const depto=stub._depto||t.depto||'';
  const actNom=t.actividad||t.desc||'Actividad';
  const abrirFn="event.stopPropagation();reviewAsocVerConsulta('"+jsStr(cod)+"','"+jsStr(tid)+"','act')";
  const archFn="event.stopPropagation();openConsultaArchivos('"+jsStr(cod)+"','"+jsStr(tid)+"',{forceModal:true,libre:true})";
  const tkHtml=typeof renderTaskConsultaItem==='function'
    ?renderTaskConsultaItem({_exp:cod,_act_libre:true,sinExpediente:true},t,qs)
    :'<div style="font-size:12px;padding:5px">'+escAttr(actNom)+'</div>';
  return '<details class="ec-fold">'+
    '<summary class="ec">'+
    '<div class="ech">'+
      '<div class="ech-left">'+
        '<div class="eid"><span class="ec-fold-ico"></span>'+
          '<span class="bdg" style="font-family:\'DM Mono\',monospace;font-size:12px;background:var(--pul);color:var(--pu);padding:2px 8px;border-radius:4px">'+hl(cod,qs)+'</span>'+
          ' <span class="bdg" style="font-size:10px;background:var(--pul);color:var(--pu)">Sin expediente</span>'+
        '</div>'+
        '<div class="enm">'+hl(nom||'—',qs)+'</div>'+
        '<div class="emta">'+hl(actNom,qs)+(typeof badgeDepto==='function'?badgeDepto(depto):'')+'</div>'+
      '</div>'+
      '<div class="ech-right">'+
        '<div class="fx" style="flex-wrap:wrap;gap:4px">'+
          '<span class="bdg" style="background:'+st.bg+';color:'+st.fg+'">'+escAttr(lbl)+'</span> '+
          '<button type="button" class="btn bsm" onclick="'+abrirFn+'">Abrir</button> '+
          '<button type="button" class="btn bsm" onclick="'+archFn+'" title="Ver adjuntos">📁</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '</summary>'+
    '<div class="ecb">'+
      '<div class="tc"><div>'+
        '<details class="con-fold con-act-fold" open>'+
        '<summary class="slbl" style="cursor:pointer;margin-bottom:0">Actividad sin expediente</summary>'+
        '<div class="item-fold-body" style="padding-top:.5rem">'+tkHtml+'</div></details>'+
      '</div></div>'+
    '</div>'+
  '</details>';
}
function conConsultaOneCard(e){
  if(e&&e._consulta_act_libre)return conConsultaActLibreCard(e);
  if(_conConsultaPag.mode==='pqrs'){
    e=normalizePqrsOficinaFields(e);
    const asunto=e.f_f1||'—';
    const detalle=e._pqrs_detalle||e._detalle_general||'';
    const btnResp=puedeMarcarPqrsRespondida(e)?'<button type="button" class="btn bsm bp" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓ Indicar respuesta dada</button>':'';
    const btnAsig=puedeAsignarPqrsOficina(e)?'<button type="button" class="btn bsm" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤 Asignar</button>':'';
    const btnTrasIni=puedeTrasladarPqrsInicial(e)&&!pqrsEstaCerrada(e)?'<button type="button" class="btn bsm bp" onclick="openTrasladoPqrsInicialModal(\''+jsStr(e._exp)+'\')">↪ Trasladar a oficina</button>':'';
    const btnTras=puedeTrasladarPqrs(e)&&!pqrsEstaCerrada(e)?'<button type="button" class="btn bsm" onclick="openTrasladoPqrsInterOficinaModal(\''+jsStr(e._exp)+'\')">↪ Trasladar</button>':'';
    const btnEdit=(esSecretaria()&&puedeEditarPqrsSecretaria(e))?pqrsBtnEdit(e._exp,'✏ Editar'):'';
    const btnDel=puedeEliminarPqrs(e)?'<button type="button" class="btn bsm bd2" onclick="eliminarPqrs(\''+escAttr(e._exp)+'\')">🗑 Eliminar</button>':'';
    const docBtn=htmlPqrsDocumentoBtns(e);
    // Abrir panel lateral sin cambiar de pestaña (permanecer en Consulta)
    const abrirFn="event.stopPropagation();openPqrsSidePanel('"+escAttr(e._exp)+"')";
    return '<details class="ec-fold">'+
      '<summary class="ec">'+
      '<div class="ech"><div class="ech-left">'+
        '<div class="eid"><span class="ec-fold-ico"></span><strong style="font-family:\'DM Mono\',monospace">'+hl(e._exp,_conConsultaPag.qs)+'</strong> '+pqrsEstadoConsultaBadge(e)+'</div>'+
        '<div class="enm">'+hl(e._tipo_solicitud||'PQRSD',_conConsultaPag.qs)+' · Radicado '+fmtF(e._fecha)+(e._pqrs_oficina?' · '+escAttr(labelOficina(e._pqrs_oficina)):'')+' '+pqrsMedioNotificacionFlagHtml(e,true)+'</div>'+
      '</div>'+
      '<div class="ech-right"><button type="button" class="btn bsm" onclick="'+abrirFn+'">Abrir</button></div></div>'+
      '</summary>'+
      '<div class="ecb">'+
        renderPqrsPlazoBarHtml(e)+
        '<div class="pqrs-det-sec"><div class="pqrs-det-k">Interesado</div>'+htmlPqrsOficinaInteresado(e)+'</div>'+
        '<div class="pqrs-det-sec"><div class="pqrs-det-k">Asunto / descripción</div><div class="pqrs-det-v">'+hl(asunto,_conConsultaPag.qs)+(detalle&&detalle!==asunto?('<br><span style="color:var(--tx2)">'+hl(detalle,_conConsultaPag.qs)+'</span>'):'')+'</div></div>'+
        (docBtn?('<div class="fx" style="gap:6px;margin-top:8px">'+docBtn+'</div>'):'')+
        renderPqrsTrazabilidadHtml(e)+
        htmlPqrsRespuestaRegistrada(e)+
        htmlPqrsNotasInternasHtml(e)+
        '<div class="fx" style="gap:8px;flex-wrap:wrap;margin-top:12px">'+btnResp+btnAsig+btnTrasIni+btnTras+btnEdit+btnDel+'</div>'+
      '</div></details>';
  }
  const today=_conConsultaPag.today;
  migrarInfoTecExpediente(e);
  const tram=getTram(e._tramite,e);
  const ter=calcTerminos(e);
  const tasks=(e.tasks||[]).map(normalizeTask);
  const porVerT=tasks.filter(t=>!t.eliminada&&estadoTask(t)==='Por verificar').length;
  const doneT=tasks.filter(t=>!t.eliminada&&estadoTask(t)==='Atendida').length;
  const porEjecT=tasks.filter(t=>!t.eliminada&&estadoTask(t)==='En ejecución').length;
  const porCorrT=tasks.filter(t=>!t.eliminada&&estadoTask(t)==='Por corregir').length;
  const vencT=tasks.filter(t=>!t.eliminada&&estadoTask(t)==='Vencida').length;
  const d=dias(getFechaEstado(e,'Solicitud')||e._fecha);
  const tkHtml=tasks.length?tasks.map(t=>renderTaskConsultaItem(e,t,_conConsultaPag.qs)).join(''):'<div style="font-size:12px;color:var(--tx3);padding:5px">Sin actividades</div>';
  const pendAct=tasks.filter(t=>!t.eliminada&&estadoTask(t)!=='Atendida').length;
  const asocList=getExpAsociadosAll(e);
  const hasAsoc=asocList.length>0;
  const pqrsDoc=esPqrsSecretaria(e)?htmlPqrsDocumentoConsulta(e):'';
  const expIdHtml=esSoloLectura()?
    '<span class="bdg" style="font-family:\'DM Mono\',monospace;font-size:12px;background:var(--bll);color:var(--bl);padding:2px 8px;border-radius:4px">'+hl(e._exp,_conConsultaPag.qs)+'</span>':
    '<button type="button" class="con-exp-link bdg" style="font-family:\'DM Mono\',monospace;font-size:12px;background:var(--bll);color:var(--bl);padding:2px 8px;border-radius:4px" data-sst-action="editarExp" data-sst-exp="'+escAttr(e._exp)+'" title="Editar expediente en '+uiEditorContenedorLbl()+'">'+hl(e._exp,_conConsultaPag.qs)+'</button>';
  const actFoldSummary=esModoCiudadano()?
    'Actividades ('+tasks.filter(t=>!t.eliminada).length+')'+conActCoEjSummaryHtml(tasks):
    'Actividades asignadas ('+tasks.filter(t=>!t.eliminada).length+')'+conActCoEjSummaryHtml(tasks)+' <span style="font-size:11px;font-weight:400;color:var(--tx3)">— chat · historial</span>';
  return '<details class="ec-fold">'+
    '<summary class="ec">'+
    '<div class="ech">'+
      '<div class="ech-left">'+
        '<div class="eid"><span class="ec-fold-ico"></span>'+expIdHtml+(e._resolucion?' · <span style="color:var(--tx2);font-size:11px">'+hl(e._resolucion,_conConsultaPag.qs)+'</span>':'')+(typeof expAltaResponsableBadgeHtml==='function'?expAltaResponsableBadgeHtml(e):'')+'</div>'+
        '<div class="enm">'+hl(getNom(e),_conConsultaPag.qs)+'</div>'+
        '<div class="emta">'+(tram?tram.nombre:'')+badgeDepto(e._depto)+'</div>'+
        '<div style="margin-top:4px">'+flagsHtmlCompact(e)+'</div>'+
        (hasAsoc?renderExpAsociadosView(e,true):'')+
      '</div>'+
      '<div class="ech-right">'+
        '<div class="fx" style="flex-wrap:wrap;gap:4px">'+badgeTram(e._tramite,e)+' '+badgeEst(e._estado)+
        expBtnArchHtml(e._exp,{title:'Ver todos los adjuntos'})+
          (esSoloLectura()?'':expBtnEditHtml(e._exp,{bic:false,label:'✏️',suffix:' Editar',title:'Editar en '+uiEditorContenedorLbl()}))+'</div>'+
        renderConsultaHdrMeta(e,ter,porVerT,doneT,porEjecT,vencT,porCorrT,d)+
      '</div>'+
    '</div>'+
    '</summary>'+
    '<div class="ecb">'+
      '<div class="tc">'+
        '<div class="con-col-left">'+
          '<div><div class="slbl">Línea de tiempo del trámite</div>'+renderFullTimeline(e)+'</div>'+
          renderInteresadoView(e)+
          renderDetalleConsultaView(e)+
          pqrsDoc+
          renderInfoTecConsultaView(e)+
          renderContableView(e)+
          renderActosAdminView(e)+
          renderConceptosSegView(e)+
        '</div>'+
        '<div>'+
          '<details class="con-fold con-act-fold"'+(pendAct?' open':'')+'>'+
          '<summary class="slbl" style="cursor:pointer;margin-bottom:0">'+actFoldSummary+'</summary>'+
          '<div class="item-fold-body" style="padding-top:.5rem">'+tkHtml+'</div></details>'+
          (esModoCiudadano()?'':('<div class="con-export-exp-wrap">'+
          '<button type="button" class="btn bsm bic btn-export-exp" onclick="exportarExpediente(\''+escAttr(e._exp)+'\')" title="Exportar expediente (.json) para importar en otro equipo"><span class="export-ico">⬇</span></button>'+
          '</div>'))+
        '</div>'+
      '</div>'+
    '</div>'+
  '</details>';
}
function conConsultaAppendMore(){
  const st=_conConsultaPag;
  const batch=st.list.slice(st.shown,st.shown+CON_CONSULTA_PAGE);
  if(!batch.length)return;
  const btn=document.getElementById('con-list-more');
  const html=batch.map(conConsultaOneCard).join('');
  if(btn)btn.insertAdjacentHTML('beforebegin',html);
  st.shown+=batch.length;
  const rest=st.list.length-st.shown;
  if(rest<=0){if(btn)btn.remove();}
  else if(btn)btn.textContent='Cargar '+CON_CONSULTA_PAGE+' más (quedan '+rest+')';
}
function renderConsulta(){
  actualizarConsultaPqrsUI();
  const sl=document.querySelector('#pg-con .card > .slbl');
  if(sl)sl.textContent=esModoCiudadano()?'Consulta de trámites y PQRSD — busque por número de expediente o solicitud':esModoOficinaDeguv()?'Consulta PQRSD — todas las solicitudes radicadas':esSecretaria()?'Consulta PQRSD — radicaciones y seguimiento':esModoResponsable()?'Consulta — interesado, contacto, información contable y actividades':'Búsqueda avanzada — línea de tiempo completa';
  const q=(document.getElementById('q-txt').value||'').trim();
  const qt=document.getElementById('q-tram').value;
  const qe=document.getElementById('q-est').value;
  const qi=document.getElementById('q-inst').value;
  const qf=document.getElementById('q-fl').value;
  const qact=document.getElementById('q-act')?document.getElementById('q-act').value:'';
  const basPqrs=esModoOficinaDeguv()||esSecretaria();
  // Oficinas: en Consulta ven todas las PQRSD radicadas (no solo las asignadas a su oficina)
  let baseList=esModoOficinaDeguv()
    ?exps.filter(function(e){return esPqrsSecretaria(e)&&!(typeof expEstaEnPapelera==='function'?expEstaEnPapelera(e):e._eliminado);})
    :expsAmbito();
  if(esModoOficinaDeguv()&&typeof esUsuarioContratista==='function'&&esUsuarioContratista()&&typeof expVisibleParaContratista==='function'){
    baseList=baseList.filter(expVisibleParaContratista);
  }
  const listExps=filterExpsPeriodo(baseList.filter(e=>{
    if(basPqrs&&!esPqrsSecretaria(e))return false;
    const ac=acctStatus(e);
    const mf=basPqrs?true:(!qf||(qf==='mp'&&e._medida_prev)||(qf==='sus'&&e._suspendido)||(qf==='san'&&e._sancionatorio)||(qf==='mora'&&ac.mora)||(qf==='pers'&&ac.persuasivo)||(qf==='coa'&&ac.coactivo)||(qf==='acu'&&ac.acuerdo)||(qf==='seg'&&e._estado==='Seguimiento'));
    const mEst=basPqrs?matchPqrsEstadoConsulta(e,qe):(!qe||e._estado===qe);
    return matchS(e,q)&&(basPqrs||!qt||e._tramite===qt)&&mEst&&(!qi||(e.tasks||[]).some(t=>t.responsable===qi))&&(basPqrs||matchActividadFiltro(e,qact))&&mf;
  }),'q');
  const listLibres=basPqrs?[]:filterExpsPeriodo(collectConsultaActLibres(q,qt,qe,qi,qact,qf),'q');
  const list=listExps.concat(listLibres);
  const ambitoLbl=esJurisdiccional()?' (jurisdiccional)':esModoResponsable()?' (consulta general — todos los expedientes)':esModoOficinaDeguv()?' — todas las PQRSD radicadas':esSecretaria()?' — PQRSD radicadas':' — '+labelDepto(deptoActivo);
  const prLbl=labelPeriodo('q');
  const qPr=document.getElementById('q-periodo-resumen');
  if(qPr)qPr.textContent=prLbl?('Filtro de fechas (solicitud / estados): '+prLbl):'';
  const nLib=listLibres.length;
  const cntBase=listExps.length?(esOficinaPqrsBasica()?listExps.length+' solicitud(es) PQRSD'+ambitoLbl:listExps.length+' expediente(s)'+ambitoLbl):'';
  const cntLib=nLib?(nLib+' actividad(es) sin expediente'):'';
  document.getElementById('q-cnt').textContent=list.length?([cntBase,cntLib].filter(Boolean).join(' · ')+(prLbl?' · '+prLbl:'')):"";
  window._conExportList=listExps;
  const c=document.getElementById('con-list');
  if(!list.length){
    const nAmb=baseList.length;
    const nLibAmb=shouldIncludeActLibresEnConsulta()?actLibresAmbitoConsulta().length:0;
    let msg='Sin resultados con los filtros actuales.';
    if(!nAmb&&!nLibAmb)msg=esJurisdiccional()?'No hay expedientes registrados en ningún departamento.':esOficinaPqrsBasica()?'No hay PQRSD radicadas.':'No hay expedientes en '+labelDepto(deptoActivo)+'. Verifique el departamento seleccionado arriba.';
    else if(q.trim()&&exps.some(x=>String(x._exp||'').trim()===q.trim()&&x._depto&&x._depto!==deptoActivo&&!esJurisdiccional()&&!esModoOficinaDeguv()&&!esSecretaria()))msg='El expediente existe en otro departamento. Cambie el selector superior o use vista Jurisdiccional.';
    c.innerHTML='<div class="emp">'+msg+'</div>';
    return;
  }
  const qs=q.length>=2?q:'';
  _conConsultaPag={list,shown:0,mode:esOficinaPqrsBasica()?'pqrs':'general',qs,today:hoy()};
  const first=list.slice(0,CON_CONSULTA_PAGE);
  _conConsultaPag.shown=first.length;
  c.innerHTML=first.map(conConsultaOneCard).join('');
  if(list.length>CON_CONSULTA_PAGE){
    const rest=list.length-first.length;
    c.insertAdjacentHTML('beforeend','<button type="button" id="con-list-more" class="btn bsm" style="margin:12px auto;display:block" onclick="conConsultaAppendMore()">Cargar '+CON_CONSULTA_PAGE+' más (quedan '+rest+')</button>');
  }
}

// ================================================================