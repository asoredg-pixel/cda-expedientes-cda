// =============================================================================
// consolidado.js — CONSOLIDADO
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// CONSOLIDADO
// ================================================================
function barChart(entries,maxV,palette){
  if(!entries||!entries.length)return'<div style="font-size:12px;color:var(--tx3);padding:5px">Sin datos</div>';
  return entries.map(([k,v],i)=>'<div class="br"><div class="blbl" title="'+k+'">'+(k.length>17?k.substring(0,16)+'…':k)+'</div><div class="btrk"><div class="bfil" style="width:'+Math.round(v/maxV*100)+'%;background:'+palette[i%palette.length]+'">'+( v>0?v:'')+'</div></div><div class="bcnt">'+v+'</div></div>').join('');
}
function renderConsolidadoResponsable(){
  document.querySelectorAll('#pg-cons .cgr, #pg-cons > .card, #pg-cons #cons-juris-panel').forEach(el=>el.style.display='none');
  renderConsolidadoCortesPanel([],null);
  if(!responsableActivo){
    document.getElementById('mets').innerHTML='<div class="emp">Seleccione responsable en el selector superior.</div>';
    return;
  }
  const myTasks=[];
  exps.forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      if(t.responsable===responsableActivo)myTasks.push({...t,exp:e._exp,nombre:getNom(e),depto:e._depto});
    });
  });
  const pend=sortTasksByUrgency(myTasks.filter(t=>['En ejecución','Vencida','Por corregir'].includes(estadoTask(t))));
  const porver=myTasks.filter(t=>estadoTask(t)==='Por verificar').length;
  const porcorr=myTasks.filter(t=>estadoTask(t)==='Por corregir').length;
  const venc=pend.filter(t=>estadoTask(t)==='Vencida').length;
  const ejec=pend.filter(t=>estadoTask(t)==='En ejecución').length;
  const done=myTasks.filter(t=>estadoTask(t)==='Atendida').length;
  const expsU=new Set(myTasks.map(t=>t.exp)).size;
  document.getElementById('mets').innerHTML=
    '<div class="met" style="border-left:3px solid var(--pu)"><div class="v" style="color:var(--pu)">'+responsableActivo.split(' ')[0]+'</div><div class="l">Responsable</div></div>'+
    '<div class="met"><div class="v">'+expsU+'</div><div class="l">Expedientes</div></div>'+
    '<div class="met"><div class="v">'+ejec+'</div><div class="l">Por ejecutar</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+porcorr+'</div><div class="l">Por corregir</div></div>'+
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+porver+'</div><div class="l">Por verificar</div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="v" style="color:var(--rd)">'+venc+'</div><div class="l">Vencidas</div></div>'+
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+done+'</div><div class="l">Atendidas</div></div>';
  const cardActs=document.getElementById('tbl-acts')?document.getElementById('tbl-acts').closest('.card'):null;
  if(cardActs){
    cardActs.style.display='';
    const slbl=cardActs.querySelector('.slbl');if(slbl)slbl.textContent='Mis actividades — de más vencida a menos urgente';
    document.getElementById('tbl-acts').innerHTML=pend.map(t=>{
      const est=estadoTask(t),vencE=est==='Vencida';
      return '<tr><td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl)">'+t.exp+'</td><td>'+t.nombre+badgeDepto(t.depto)+'</td><td style="font-weight:500">'+t.desc+'</td><td>'+responsableActivo+'</td><td style="color:'+(vencE?'var(--rd)':'var(--tx)')+'">'+fmtF(t.vence)+'</td><td><span class="bdg" style="background:'+taskEstadoStyle(est).bg+';color:'+taskEstadoStyle(est).fg+'">'+estadoTaskLabel(t)+'</span></td></tr>';
    }).join('')||'<tr><td colspan="6" class="emp">Sin actividades pendientes.</td></tr>';
  }
  renderJurisConsolidadoStats([]);
}
function renderConsolidado(){
  document.querySelectorAll('#pg-cons .cgr, #pg-cons > .card, #pg-cons #cons-juris-panel').forEach(el=>{el.style.display='';});
  const rango=getPeriodoRango('cons');
  const baseAmb=filterExpsPeriodo(expsAmbito(),'cons');
  window._jurisConsListCache=baseAmb;
  const amb=esJurisdiccional()?filtrarJurisConsList(baseAmb):(esDeptoConsFiltroActivo()?filtrarDeptoConsList(baseAmb):baseAmb);
  renderConsolidadoCortesPanel(amb,rango);
  window._consExportList=amb;
  window._consCatLists={};
  const total=amb.length;
  const mp=amb.filter(e=>e._medida_prev).length;
  const sus=amb.filter(e=>e._suspendido).length;
  const san=amb.filter(e=>e._sancionatorio).length;
  const mora=amb.filter(e=>acctStatus(e).mora).length;
  const pers=amb.filter(e=>acctStatus(e).persuasivo).length;
  const coa=amb.filter(e=>acctStatus(e).coactivo).length;
  const acu=amb.filter(e=>acctStatus(e).acuerdo).length;
  const act=amb.filter(e=>!FINALS.includes(e._etapa)&&!isArchivadoEstado(e._estado)&&e._estado!=='Atendido'&&e._estado!=='Seguimiento').length;
  const seg=amb.filter(e=>e._estado==='Seguimiento').length;
  const fin=amb.filter(e=>isArchivadoEstado(e._estado)).length;
  const allTk=amb.flatMap(e=>(e.tasks||[]).map(t=>({...t,exp:e._exp,nombre:getNom(e)})));
  const pend=allTk.filter(t=>estadoTask(t)!=='Atendida').length;
  // términos stats
  const termStats={ok:0,warn:0,venc:0,'done-ok':0,'done-venc':0};
  amb.forEach(e=>{const ter=calcTerminos(e);if(ter)termStats[ter.estado]=(termStats[ter.estado]||0)+1;});
  const porCorrTk=allTk.filter(t=>estadoTask(t)==='Por corregir').length;
  const porVerTk=allTk.filter(t=>estadoTask(t)==='Por verificar').length;
  document.getElementById('mets').innerHTML=
    '<div class="met"><div class="v">'+total+'</div><div class="l">Total</div></div>'+
    '<div class="met"><div class="v">'+act+'</div><div class="l">En trámite</div></div>'+
    '<div class="met" style="border-left:3px solid var(--pu)"><div class="v" style="color:var(--pu)">'+seg+'</div><div class="l">Seguimiento</div></div>'+
    '<div class="met"><div class="v">'+fin+'</div><div class="l">Archivados</div></div>'+
    '<div class="met"><div class="v">'+pend+'</div><div class="l">Actividades pendientes</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+porCorrTk+'</div><div class="l">Por corregir</div></div>'+
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+porVerTk+'</div><div class="l">Por verificar</div></div>'+
    '<div class="met" style="border-left:3px solid var(--or)"><div class="v" style="color:var(--or)">'+mp+'</div><div class="l">Med. prev.</div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="v" style="color:var(--rd)">'+sus+'</div><div class="l">Suspendidos</div></div>'+
    '<div class="met" style="border-left:3px solid var(--pu)"><div class="v" style="color:var(--pu)">'+san+'</div><div class="l">Sancionatorios</div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="v" style="color:var(--rd)">'+mora+'</div><div class="l">En mora</div></div>'+
    '<div class="met" style="border-left:3px solid var(--bl)"><div class="v" style="color:var(--bl)">'+acu+'</div><div class="l">Acuerdo pago</div></div>';
  renderJurisConsolidadoStats(amb,baseAmb);
  document.getElementById('terms-grid').innerHTML=
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+termStats.ok+'</div><div class="l">En términos</div></div>'+
    '<div class="met" style="border-left:3px solid var(--am)"><div class="v" style="color:var(--am)">'+termStats.warn+'</div><div class="l">Próx. a vencer</div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="v" style="color:var(--rd)">'+termStats.venc+'</div><div class="l">Vencidos</div></div>'+
    '<div class="met" style="border-left:3px solid var(--gn)"><div class="v" style="color:var(--gn)">'+termStats['done-ok']+'</div><div class="l">Atendidos a tiempo</div></div>'+
    '<div class="met" style="border-left:3px solid var(--rd)"><div class="v" style="color:var(--rd)">'+termStats['done-venc']+'</div><div class="l">Atendidos vencidos</div></div>';
  const mkList=(arr,catKey,catLabel)=>{
    window._consCatLists=window._consCatLists||{};
    window._consCatLists[catKey]=arr.map(e=>String(e._exp||'').trim()).filter(Boolean);
    if(!arr.length)return'<div style="font-size:12px;color:var(--tx3);padding:5px">Ninguno</div>';
    const rows=arr.slice(0,2).map(e=>'<div style="padding:4px 0;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;font-size:13px"><span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--bl);cursor:pointer" data-con-exp-asoc="'+escAttr(e._exp)+'">'+e._exp+'</span><span style="flex:1;font-weight:600">'+getNom(e)+'</span><button type="button" class="btn bsm bic" data-con-exp-asoc="'+escAttr(e._exp)+'">Ver</button></div>').join('');
    const more=arr.length>2?'<button type="button" class="cons-exp-more" onclick="openConsExpModal(\''+catKey+'\',\''+escAttr(catLabel)+'\')">Ver todos ('+arr.length+')</button>':'';
    return rows+more;
  };
  document.getElementById('c-mp').innerHTML=mkList(amb.filter(e=>e._medida_prev),'mp','Con medida preventiva');
  document.getElementById('c-sus').innerHTML=mkList(amb.filter(e=>e._suspendido),'sus','Suspendidos');
  document.getElementById('c-san').innerHTML=mkList(amb.filter(e=>e._sancionatorio),'san','Trasladados a sancionatorio');
  document.getElementById('c-mora').innerHTML=mkList(amb.filter(e=>acctStatus(e).mora),'mora','En mora');
  document.getElementById('c-pers').innerHTML=mkList(amb.filter(e=>acctStatus(e).persuasivo),'pers','Persuasivo');
  document.getElementById('c-coa').innerHTML=mkList(amb.filter(e=>acctStatus(e).coactivo),'coa','Coactivo');
  document.getElementById('c-acu').innerHTML=mkList(amb.filter(e=>acctStatus(e).acuerdo),'acu','Acuerdo de pago');
  const ct={};
  amb.forEach(e=>{const t=getTram(e._tramite,e);if(t)ct[t.nombre]=(ct[t.nombre]||0)+1;});
  const ctE=Object.entries(ct).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const tramCols=tramitesFiltroConsulta().map(t=>t.color);
  document.getElementById('ch-tram').innerHTML=barChart(ctE,Math.max(...ctE.map(x=>x[1]),1),tramCols.length?tramCols:PAL);
  const cest={'Solicitud':0,'En trámite':0,'Atendido':0,'Seguimiento':0,'Archivado o anulado':0};
  amb.forEach(e=>{const k=isArchivadoEstado(e._estado)?'Archivado o anulado':(e._estado||'Solicitud');cest[k]=(cest[k]||0)+1;});
  const cestE=Object.entries(cest).filter(x=>x[1]>0);
  const ep={'Solicitud':'#185FA5','En trámite':'#b87d0a','Atendido':'#1a7a4a','Seguimiento':'#6d3fa8','Archivado o anulado':'#888780'};
  document.getElementById('ch-est').innerHTML=barChart(cestE,Math.max(...cestE.map(x=>x[1]),1),cestE.map(([k])=>ep[k]||PAL[0]));
  const ci={};amb.forEach(e=>(e.tasks||[]).forEach(t=>{const k=t.responsable||'Sin asignar';ci[k]=(ci[k]||0)+1;}));
  const ciE=Object.entries(ci).sort((a,b)=>b[1]-a[1]);
  document.getElementById('ch-inst').innerHTML=ciE.length?barChart(ciE,Math.max(...ciE.map(x=>x[1]),1),PAL.slice(3)):'<div class="emp">Sin actividades asignadas</div>';
  // tabla términos
  const sorted=[...amb].sort((a,b)=>dias(b._fecha)-dias(a._fecha));
  document.getElementById('tbl-terms').innerHTML=sorted.slice(0,15).map(e=>{
    const ter=calcTerminos(e);if(!ter)return'';
    const col=ter.estado==='ok'||ter.estado==='done-ok'?'var(--gn)':ter.estado==='warn'?'var(--am)':'var(--rd)';
    return '<tr>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl);font-weight:500">'+e._exp+'</td>'+
      '<td>'+badgeTram(e._tramite,e)+badgeDepto(e._depto)+'</td>'+
      '<td style="font-weight:600">'+escAttr(getNom(e))+'</td>'+
      '<td>'+badgeEst(e._estado)+'</td>'+
      '<td>'+ter.d+' '+(UNIDAD_LABEL[ter.unidad]||'días')+'</td>'+
      '<td>'+ter.plazo+' '+(UNIDAD_LABEL[ter.unidad]||'días')+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:var(--sf2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+ter.pct+'%;background:'+col+';border-radius:3px"></div></div><span style="font-size:11px;color:'+col+'">'+ter.pct+'%</span></div></td>'+
      '<td>'+termsBdg(ter)+'</td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="8" class="emp">Sin datos</td></tr>';
  // reporte por responsable de actividades
  const inD={};
  amb.forEach(e=>{
    (e.tasks||[]).forEach(t=>{
      const k=t.responsable||'Sin asignar';
      if(!inD[k])inD[k]={trams:new Set(),total:0,ejec:0,done:0,venc:0,correg:0,porver:0};
      const est=estadoTask(t);
      inD[k].trams.add(e._exp);
      inD[k].total++;
      if(est==='Atendida')inD[k].done++;
      else if(est==='Vencida')inD[k].venc++;
      else if(est==='Por corregir')inD[k].correg++;
      else if(est==='Por verificar')inD[k].porver++;
      else inD[k].ejec++;
    });
  });
  document.getElementById('tbl-inst').innerHTML=Object.entries(inD).sort((a,b)=>b[1].total-a[1].total).map(([k,v])=>'<tr>'+
    '<td style="font-weight:600">'+k+'</td>'+
    '<td><span class="bdg b-sol">'+v.trams.size+'</span></td>'+
    '<td>'+v.total+'</td>'+
    '<td><span class="bdg" style="background:var(--pul);color:var(--pu)">'+v.ejec+'</span></td>'+
    '<td><span class="bdg" style="background:var(--orl);color:var(--or)">'+v.correg+'</span></td>'+
    '<td><span class="bdg t-done-ok">'+v.done+'</span></td>'+
    '<td><span class="bdg '+(v.venc>0?'t-venc':'')+'">'+v.venc+'</span></td>'+
  '</tr>').join('')||'<tr><td colspan="7" class="emp">Sin datos</td></tr>';
  document.getElementById('tbl-dias').innerHTML=sorted.slice(0,10).map(e=>{
    const ter=calcTerminos(e);
    return '<tr>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl);font-weight:500">'+e._exp+'</td>'+
      '<td>'+badgeTram(e._tramite,e)+badgeDepto(e._depto)+'</td>'+
      '<td style="font-weight:600">'+escAttr(getNom(e))+'</td>'+
      '<td>'+badgeEst(e._estado)+'</td>'+
      '<td>'+daysBdg(dias(e._fecha))+'</td>'+
      '<td style="font-size:12px">'+(ter?ter.plazo+' '+(UNIDAD_LABEL[ter.unidad]||'d'):'-')+'</td>'+
      '<td>'+termsBdg(ter)+'</td>'+
      '<td>'+flagsHtml(e,true)+'</td>'+
      '<td><button class="btn bsm bic" data-exp-view="'+escAttr(e._exp)+'" onclick="verCon(this.getAttribute(\'data-exp-view\'))">🔍</button></td>'+
    '</tr>';
  }).join('')||'<tr><td colspan="9" class="emp">Sin datos</td></tr>';
  const today=hoy();
  const tkR=sortTasksByUrgency(allTk.filter(t=>estadoTask(t)!=='Atendida'));
  document.getElementById('tbl-acts').innerHTML=tkR.slice(0,20).map(t=>{
    const est=estadoTask(t),venc=est==='Vencida';
    return '<tr><td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--bl);font-weight:500">'+escAttr(t.exp)+'</td><td>'+escAttr(t.nombre)+'</td><td>'+escAttr(t.desc)+'</td><td style="color:var(--tx2)">'+(t.responsable?escAttr(t.responsable):'-')+'</td><td style="color:'+(venc?'var(--rd)':'var(--tx)')+'">'+fmtF(t.vence)+'</td><td><span class="bdg" style="background:'+taskEstadoStyle(est).bg+';color:'+taskEstadoStyle(est).fg+'">'+escAttr(estadoTaskLabel(t))+'</span></td></tr>';
  }).join('')||'<tr><td colspan="6" class="emp">Sin actividades pendientes</td></tr>';
  const termLbl={ok:'En términos',warn:'Próx. a vencer',venc:'Vencidos','done-ok':'Atendidos a tiempo','done-venc':'Atendidos vencidos'};
  const termEntries=Object.entries(termStats).filter(x=>x[1]>0).map(([k,v])=>[termLbl[k]||k,v]);
  const flagChart=(label,n)=>[['Con indicador',n],['Sin indicador',Math.max(0,total-n)]];
  const actsEst={};tkR.forEach(t=>{const e=estadoTask(t);actsEst[e]=(actsEst[e]||0)+1;});
  window._consCharts={
    terminos:{title:'Control de términos — semáforo global',entries:termEntries,palette:['#1a7a4a','#b87d0a','#c0392b','#2e7d32','#c0392b']},
    mp:{title:'Con medida preventiva',entries:flagChart('Medida preventiva',mp),palette:['#b87d0a','#ddd']},
    sus:{title:'Suspendidos',entries:flagChart('Suspendidos',sus),palette:['#c0392b','#ddd']},
    san:{title:'Trasladados a sancionatorio',entries:flagChart('Sancionatorio',san),palette:['#6d3fa8','#ddd']},
    mora:{title:'En mora',entries:flagChart('En mora',mora),palette:['#c0392b','#ddd']},
    pers:{title:'Persuasivo',entries:flagChart('Persuasivo',pers),palette:['#b87d0a','#ddd']},
    coa:{title:'Coactivo',entries:flagChart('Coactivo',coa),palette:['#6d3fa8','#ddd']},
    acu:{title:'Acuerdo de pago',entries:flagChart('Acuerdo de pago',acu),palette:['#185FA5','#ddd']},
    tram:{title:'Por tipo de trámite',entries:ctE,palette:tramCols.length?tramCols:PAL},
    est:{title:'Por estado',entries:cestE,palette:cestE.map(([k])=>ep[k]||PAL[0])},
    inst:{title:'Por responsable de actividad',entries:ciE,palette:PAL.slice(3)},
    'tbl-terms':{title:'Cumplimiento de términos de atención',entries:termEntries,palette:['#1a7a4a','#b87d0a','#c0392b','#2e7d32','#c0392b']},
    'tbl-inst':{title:'Actividades por responsable',entries:Object.entries(inD).sort((a,b)=>b[1].total-a[1].total).slice(0,12).map(([k,v])=>[k,v.total]),palette:PAL.slice(3)},
    'tbl-dias':{title:'Días en trámite (top 10)',entries:sorted.slice(0,10).map(e=>[String(e._exp||''),dias(getFechaEstado(e,'Solicitud')||e._fecha)]),palette:PAL},
    'tbl-acts':{title:'Actividades pendientes por estado',entries:Object.entries(actsEst).sort((a,b)=>b[1]-a[1]),palette:PAL.slice(1)}
  };
}

// ================================================================