// =============================================================================
// consulta.js — TABLA REGISTRO + CONSULTA
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// TABLA REGISTRO
// ================================================================
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
  document.getElementById('cnt-bdg').textContent=expsAmbito().length;
  const tb=document.getElementById('tbl-reg');
  const soloLec=esSoloLectura();
  if(!list.length){tb.innerHTML='<tr><td colspan="8" class="emp">Sin expedientes.</td></tr>';return;}
  tb.innerHTML=list.map(e=>{
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
}

// ================================================================
// CONSULTA — LÍNEA DE TIEMPO COMPLETA
// ================================================================
function matchS(e,q){
  if(!q)return true;
  const ql=q.toLowerCase().trim();
  if(String(e._exp||'').toLowerCase().trim()===ql)return true;
  if(Object.values(e).some(v=>String(v||'').toLowerCase().includes(ql)))return true;
  if(e._usar_exp_asociados&&expedientesAsociadosData(e._expedientes_asociados).some(n=>String(n||'').toLowerCase().includes(ql)))return true;
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
  const estInf=e._estado||'';
  if(e._pi_tipo_persona==='juridica'){
    h+='<div class="ic"><div class="k">Presunto infractor</div><div class="v">'+(e._pi_empresa||e._pi_rep_nombre||'-')+(e._pi_nit?' · NIT '+e._pi_nit:'')+'</div></div>';
  }else if(e._pi_nombre){
    h+='<div class="ic"><div class="k">Presunto infractor</div><div class="v">'+e._pi_nombre+(e._pi_identificacion?' · '+e._pi_identificacion:'')+'</div></div>';
  }
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
  const push=(url,label,fecha)=>{
    if(!url)return;
    const p=parseDrivePreviewUrl(url);
    items.push({exp:e._exp,taskId:'',taskDesc:'PQRSD',label:label||'Documento PQRSD',url:p.url||url,local:false,mime:'',fecha:fecha||e._fecha_solicitud||e._fecha||'',version:''});
  };
  push(e._pqrs_solicitud_link,'Solicitud PQRSD',e._fecha_solicitud||e._fecha);
  (e._pqrs_gmail_attachments||[]).forEach(function(att){
    if(!att||!att.driveLink||att.driveLink===e._pqrs_solicitud_link)return;
    push(att.driveLink,att.nombre||'Anexo PQRSD',e._fecha_solicitud||e._fecha);
  });
  push(e._pqrs_respuesta_link,'Respuesta PQRSD',e._pqrs_respuesta_fecha);
  (e._pqrs_respuesta_links||[]).forEach((u,i)=>push(u,'Respuesta PQRSD '+(i+1),e._pqrs_respuesta_fecha));
  (e._pqrs_respuesta_soportes||[]).forEach((s,i)=>push(s.url||s.preview,s.label||('Respuesta '+(i+1)),e._pqrs_respuesta_fecha));
  return items;
}
function collectArchivosExp(e,taskIdFilter){
  const items=[];
  if(!e)return items;
  if(!taskIdFilter)collectArchivosPqrsLinks(e).forEach(it=>items.push(it));
  (e.tasks||[]).map(normalizeTask).forEach(t=>{
    if(t.eliminada)return;
    if(taskIdFilter&&t.id!==taskIdFilter)return;
    (t.soportes||[]).forEach(s=>{
      const url=s.url||s.preview||'';
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
  collectArchivosPqrsLinks(e).forEach(function(it){
    raws.push({exp:expId,taskId:it.taskId||'',taskDesc:it.taskDesc||'PQRSD',label:it.label,url:it.url,local:!!it.local,mime:it.mime||'',fecha:it.fecha||'',version:it.version||'',origen:'PQRSD',tipoDoc:'PQRSD',descDoc:it.label||'Documento PQRSD'});
  });
  docsTramiteData(e._docs_tramite).forEach(function(d){
    raws.push({exp:expId,label:d.label,tipoDoc:'Documento del trámite',descDoc:d.label||'Documento del trámite',url:d.url,preview:d.preview||d.url,origen:'Trámite',fecha:d.fecha||'',docTramiteId:d.id});
  });
  collectArchivosExp(e,taskIdFilter||null).forEach(function(it){
    raws.push({exp:expId,taskId:it.taskId||'',taskDesc:it.taskDesc||'Actividad',label:it.label,url:it.url,local:!!it.local,mime:it.mime||'',fecha:it.fecha||'',version:it.version||'',origen:'Entrega',tipoDoc:'Entrega de actividad',descDoc:it.label||('Documento v'+(it.version||'?'))});
  });
  collectEnlacesExpediente(e).forEach(function(l){
    if(l.tipo==='Actividad')return;
    const lbl=[l.ref||'Enlace',l.version?'v'+l.version:''].filter(Boolean).join(' · ');
    raws.push({exp:expId,label:lbl,tipoDoc:l.tipo||'Trámite',descDoc:lbl,url:l.url,taskDesc:l.tipo||'Expediente',fecha:l.fecha||'',taskId:l.taskId||'',origen:'Trámite'});
  });
  (e.tasks||[]).forEach(function(t){
    if(t.eliminada)return;
    if(taskIdFilter&&t.id!==taskIdFilter)return;
    normalizeTask(t);
    (t.soportes||[]).forEach(function(s){
      const url=s.url||s.preview||'';
      if(!url&&!s.local)return;
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
    const key=(u||('local:'+(it.label||'')))+'|'+(it.label||'')+'|'+(raw.exp||e._exp);
    if(seen.has(key))return;
    seen.add(key);
    it.exp=raw.exp||e._exp;
    it.asocDe=raw.asocDe||'';
    items.push(it);
  };
  raws.forEach(addRaw);
  return items.sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
}
function conArchivosListHtml(items,previewFn){
  previewFn=previewFn||'renderConsultaArchivoPreview';
  if(!items.length)return '<div style="font-size:12px;color:var(--tx3);padding:8px 0">Sin enlaces Drive ni adjuntos registrados en este expediente.</div>';
  return items.map((it,i)=>{
    const icon=it.local?(String(it.mime||'').includes('pdf')?'📄':String(it.mime||'').startsWith('image/')?'🖼':'📎'):'🔗';
    const tit=it.descDoc||it.label||'Archivo';
    const sub=[it.tipoDoc||it.taskDesc||'Documento',fmtF((it.fecha||'').slice(0,10)),it.version?'v'+it.version:''].filter(Boolean).join(' · ');
    return '<button type="button" class="con-arch-item'+(i===0?' on':'')+'" onclick="'+previewFn+'('+i+')">'+
      '<span style="font-size:18px;flex-shrink:0">'+icon+'</span>'+
      '<span style="flex:1;min-width:0"><strong style="display:block;font-size:13px">'+escAttr(tit)+'</strong>'+
      '<span style="font-size:11px;color:var(--tx3);display:block;margin-top:2px">'+escAttr(sub)+'</span></span></button>';
  }).join('');
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
  const incluirAsoc=!!window._conPanelEditMode;
  const items=collectArchivosConsultaCompleto(e,taskIdFilter||null,{incluirAsociados:incluirAsoc});
  window._conArchItems=items;
  window._conArchPanelExp=e._exp;
  const list=conArchivosListHtml(items,'renderConPanelArchivoPreview');
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
  const hintAsoc=(incluirAsoc&&getExpAsociadosAll(e).length)?'<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Incluye documentos de PQRSD y expedientes vinculados.</div>':'';
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
function taskModalZIndexApply(ov){
  if(!ov)return;
  ov.classList.add('con-arch-modal-on');
  ov.style.zIndex='26000';
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
  if(!e){notif('Expediente «'+id+'» no encontrado','err');return;}
  const panel=document.getElementById('con-side-panel');
  const panelOpen=!opts.forceModal&&panel&&panel.classList.contains('on')&&String(window._conPanelActive||'').trim()===id;
  if(panelOpen&&e){
    refreshConPanelDocumentos(id,null,true);
    scrollConPanelDocumentos();
    initConPanelArchivosPreview(taskId||null);
    return;
  }
  let items=[];
  if(e)items=collectArchivosConsultaCompleto(e,null);
  else{
    const act=getActLibreByCodigo(id)||getActLibreById(taskId);
    if(act){
      items=collectArchivosActLibre(act).map(it=>{
        const p=parseDrivePreviewUrl(it.url);
        return {...it,preview:it.local?(it.url||it.preview):(p.preview||p.url||it.url),openUrl:it.local?(it.url||it.preview):(p.url||it.url||it.preview)};
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
  }
  taskModalZIndexApply(ov);
  window._conArchItems=items;
  if(!items.length){
    body.innerHTML='<div style="font-size:13px;color:var(--tx2);margin-bottom:12px">No hay enlaces Drive ni adjuntos registrados'+(taskId?' en esta actividad':' en este expediente')+'.</div>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button>';
  }else{
    const list=conArchivosListHtml(items,'renderConsultaArchivoPreview');
    body.innerHTML='<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">Seleccione un documento — enlaces Drive del expediente, actividades y PQRSD.</div>'+
      '<div class="con-arch-split"><div class="con-arch-list-col">'+list+'</div><div class="con-arch-preview-col" id="con-arch-preview-wrap"></div></div>'+
      '<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
    const selIdx=taskId?Math.max(0,(items||[]).findIndex(it=>it.taskId===taskId)):0;
    renderConsultaArchivoPreview(selIdx>=0?selIdx:0);
  }
  ov.classList.add('on');
  window._taskModalCtx={mode:'archivos',panelExp:id};
}
function cerrarConsultaPanel(){
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
  window._conPanelPqrsNcaEdit=false;
  window._conPanelDesdeConsulta=false;
  restoreCfgDeptoUsuario();
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
  if(sub)sub.textContent=getNom(e)+(tram?' · '+tram.nombre:'')+(window._conPanelEditMode?' · edición en '+uiEditorContenedorLbl():ids.length>1?' · Use las pestañas para cambiar':'');
  const tabs=ids.length>1?('<div class="con-panel-tabs">'+ids.map(id=>{
    const ex=exps.find(x=>String(x._exp||'').trim()===id);
    const isMain=id===primary;
    return '<button type="button" class="con-panel-tab'+(id===active?' on':'')+(isMain?'':' asoc')+'" data-sst-action="conPanelSelExp" data-sst-exp="'+escAttr(id)+'">'+escAttr(id)+(isMain?'':' ↗')+'</button>';
  }).join('')+'</div>'):'';
  const canEdit=puedeEditarExpPanel();
  const lockedByOther=!window._conPanelEditMode&&!!getExpLockVigente(e._exp)&&!poseeExpLock(e._exp);
  const lockBanner=window._conPanelLockMsg?('<div style="padding:10px 12px;margin-bottom:10px;border-radius:var(--r);background:var(--aml);border:1px solid #e8c97a;font-size:12px;color:#7a5500;line-height:1.45">'+escAttr(window._conPanelLockMsg)+'</div>'):'';
  const pqrsToolbarBtns=!window._conPanelEditMode&&esPqrsSecretaria(e)?(
    pqrsAsocToolbarBtnHtml(e)+
    (puedeMarcarPqrsInformativa(e)?'<button type="button" class="btn bsm" onclick="SST.openMarcarPqrsInformativaModal(\''+escAttr(e._exp)+'\')">ℹ Informativa</button>':'')+
    (puedeTrasladarPqrsInicial(e)?'<button type="button" class="btn bsm bp" onclick="openTrasladoPqrsInicialModal(\''+escAttr(e._exp)+'\')">↪ Trasladar a oficina</button>':'')+
    (puedeTrasladarPqrs(e)?'<button type="button" class="btn bsm" onclick="openTrasladoPqrsInterOficinaModal(\''+escAttr(e._exp)+'\')">↪ Trasladar</button>':'')+
    (puedeAsignarPqrsOficina(e)?'<button type="button" class="btn bsm" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤 Asignar</button>':'')+
    (puedeMarcarPqrsRespondida(e)?'<button type="button" class="btn bsm bp" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓ Respuesta</button>':'')
  ):'';
  const archToolbarBtn=window._conPanelEditMode?'':expBtnArchHtml(e._exp,{cls:'bp',title:'Documentos y enlaces Drive del expediente'});
  const editToggleBtn=!window._conPanelEditMode&&canEdit&&!window._conPanelPqrsNcaEdit&&!lockedByOther?'<button type="button" class="btn bsm bp" data-sst-action="conPanelActivarEdicion" data-sst-exp="'+escAttr(e._exp)+'">✏️ Editar</button>':'';
  const toolbar='<div class="con-panel-toolbar">'+
    badgeEst(e._estado)+' '+badgeTram(e._tramite,e)+badgeDepto(e._depto)+flagsHtmlCompact(e)+' '+pqrsPrioritariaBadge(e)+' '+pqrsInformativaBadge(e)+
    pqrsToolbarBtns+
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
    body.innerHTML=tabs+lockBanner+toolbar+taskBar+archivosBlock+pqrsExtras+'<div id="con-side-form-wrap" class="con-panel-form-wrap"></div>';
    renderFormulario(e._tramite,e,'con-side-form-wrap');
    if((window._conArchItems||[]).length)setTimeout(()=>initConPanelArchivosPreview(window._conPanelTaskId||null),80);
    setTimeout(function(){conPanelColapsarTodasSecciones();},80);
    return;
  }
  body.innerHTML=tabs+lockBanner+toolbar+taskBar+archivosBlock+(esPqrsSecretaria(e)?renderConPanelPqrsExtras(e):'')+renderConPanelExpContent(e,{foldOpen:!!(esOficinaPqrsNca()&&esPqrsSecretaria(e))});
  if((window._conArchItems||[]).length)setTimeout(()=>initConPanelArchivosPreview(window._conPanelTaskId||null),80);
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
function conConsultaOneCard(e){
  if(_conConsultaPag.mode==='pqrs'){
    e=normalizePqrsOficinaFields(e);
    const asunto=e.f_f1||'—';
    const detalle=e._pqrs_detalle||e._detalle_general||'';
    const btnResp=puedeMarcarPqrsRespondida(e)?'<button type="button" class="btn bsm bp" onclick="openPqrsRespuestaModal(\''+escAttr(e._exp)+'\')">✓ Indicar respuesta dada</button>':'';
    const btnAsig=puedeAsignarPqrsOficina(e)?'<button type="button" class="btn bsm" onclick="openAsignarPqrsOficinaModal(\''+escAttr(e._exp)+'\')">👤 Asignar</button>':'';
    const btnTrasIni=puedeTrasladarPqrsInicial(e)&&!pqrsEstaCerrada(e)?'<button type="button" class="btn bsm bp" onclick="openTrasladoPqrsInicialModal(\''+jsStr(e._exp)+'\')">↪ Trasladar a oficina</button>':'';
    const btnTras=puedeTrasladarPqrs(e)&&!pqrsEstaCerrada(e)?'<button type="button" class="btn bsm" onclick="openTrasladoPqrsInterOficinaModal(\''+jsStr(e._exp)+'\')">↪ Trasladar</button>':'';
    const btnEdit=(esSecretaria()&&puedeEditarPqrsSecretaria(e))?pqrsBtnEdit(e._exp,'✏ Editar'):'';
    const docBtn=htmlPqrsDocumentoBtns(e);
    const abrirFn=esSecretaria()?"openPqrsSidePanel('"+escAttr(e._exp)+"');showTab('sec')":"openPqrsSidePanel('"+escAttr(e._exp)+"');showTab('pqrs-ofi')";
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
        '<div class="fx" style="gap:8px;flex-wrap:wrap;margin-top:12px">'+btnResp+btnAsig+btnTrasIni+btnTras+btnEdit+'</div>'+
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
        '<div class="eid"><span class="ec-fold-ico"></span>'+expIdHtml+(e._resolucion?' · <span style="color:var(--tx2);font-size:11px">'+hl(e._resolucion,_conConsultaPag.qs)+'</span>':'')+'</div>'+
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
  if(sl)sl.textContent=esModoCiudadano()?'Consulta de trámites y PQRSD — busque por número de expediente o solicitud':esModoOficinaDeguv()?'Consulta PQRSD — solo solicitudes trasladadas a su oficina':esSecretaria()?'Consulta PQRSD — radicaciones y seguimiento':esModoResponsable()?'Consulta — interesado, contacto, información contable y actividades':'Búsqueda avanzada — línea de tiempo completa';
  const q=(document.getElementById('q-txt').value||'').trim();
  const qt=document.getElementById('q-tram').value;
  const qe=document.getElementById('q-est').value;
  const qi=document.getElementById('q-inst').value;
  const qf=document.getElementById('q-fl').value;
  const qact=document.getElementById('q-act')?document.getElementById('q-act').value:'';
  const basPqrs=esModoOficinaDeguv()||esSecretaria();
  const list=filterExpsPeriodo(expsAmbito().filter(e=>{
    if(basPqrs&&!esPqrsSecretaria(e))return false;
    const ac=acctStatus(e);
    const mf=basPqrs?true:(!qf||(qf==='mp'&&e._medida_prev)||(qf==='sus'&&e._suspendido)||(qf==='san'&&e._sancionatorio)||(qf==='mora'&&ac.mora)||(qf==='pers'&&ac.persuasivo)||(qf==='coa'&&ac.coactivo)||(qf==='acu'&&ac.acuerdo)||(qf==='seg'&&e._estado==='Seguimiento'));
    const mEst=basPqrs?matchPqrsEstadoConsulta(e,qe):(!qe||e._estado===qe);
    return matchS(e,q)&&(basPqrs||!qt||e._tramite===qt)&&mEst&&(!qi||(e.tasks||[]).some(t=>t.responsable===qi))&&(basPqrs||matchActividadFiltro(e,qact))&&mf;
  }),'q');
  const ambitoLbl=esJurisdiccional()?' (jurisdiccional)':esModoResponsable()?' (consulta general — todos los expedientes)':esModoOficinaDeguv()?' — PQRSD de '+labelOficina(deptoActivo):' — '+labelDepto(deptoActivo);
  const prLbl=labelPeriodo('q');
  const qPr=document.getElementById('q-periodo-resumen');
  if(qPr)qPr.textContent=prLbl?('Filtro de fechas (solicitud / estados): '+prLbl):'';
  document.getElementById('q-cnt').textContent=list.length?(esOficinaPqrsBasica()?list.length+' solicitud(es) PQRSD'+ambitoLbl:list.length+' expediente(s)'+ambitoLbl)+(prLbl?' · '+prLbl:''):"";
  window._conExportList=list;
  const c=document.getElementById('con-list');
  if(!list.length){
    const nAmb=expsAmbito().length;
    let msg='Sin resultados con los filtros actuales.';
    if(!nAmb)msg=esJurisdiccional()?'No hay expedientes registrados en ningún departamento.':esOficinaPqrsBasica()?'No hay PQRSD asignados a su oficina.':'No hay expedientes en '+labelDepto(deptoActivo)+'. Verifique el departamento seleccionado arriba.';
    else if(q.trim()&&exps.some(x=>String(x._exp||'').trim()===q.trim()&&x._depto&&x._depto!==deptoActivo&&!esJurisdiccional()))msg='El expediente existe en otro departamento. Cambie el selector superior o use vista Jurisdiccional.';
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