// =============================================================================
// tareas.js — TAREAS
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// TAREAS
// ================================================================
function readTaskMeta(row){
  const inp=row?row.querySelector('.tk-meta'):null;
  try{return inp?JSON.parse(inp.value):{id:genTaskId(),comentarios:[],historial:[],soportes:[],notasDoc:[]};}
  catch(e){return{id:genTaskId(),comentarios:[],historial:[],soportes:[],notasDoc:[]};}
}
function writeTaskMeta(row,meta){
  const inp=row?row.querySelector('.tk-meta'):null;
  if(inp)inp.value=JSON.stringify(meta);
}
function taskMetaInput(data){
  const m=normalizeTask(data||{});
  return '<input type="hidden" class="tk-meta" value="'+escAttr(JSON.stringify({id:m.id,comentarios:m.comentarios||[],historial:m.historial||[],soportes:m.soportes||[],notasDoc:m.notasDoc||[],fechaReportada:m.fechaReportada||'',verificadoPor:m.verificadoPor||'',eliminada:!!m.eliminada,prioritaria:!!m.prioritaria,responsables:m.responsables||[],asignados:m.asignados||[],entregaModo:m.entregaModo||'individual'}))+'">';
}
function syncTaskPrioritariaRow(cb){
  const row=cb.closest('.tkr-wrap');
  if(!row)return;
  row.classList.toggle('prioritaria',cb.checked);
  const meta=readTaskMeta(row);
  meta.prioritaria=cb.checked;
  writeTaskMeta(row,meta);
}
function taskFormFootHtml(data){
  const m=normalizeTask(data||{});
  // Heal: devolución Director no debe verse Atendida/Aprobada en el formulario
  try{
    const expId=typeof editId!=='undefined'?editId:(window._conPanelActive||'');
    const eHeal=expId&&typeof getExpById==='function'?getExpById(expId):null;
    if(eHeal&&typeof taskEsAtenderPqrs==='function'&&taskEsAtenderPqrs(m,eHeal)&&typeof pqrsHealTaskTrasDevolucionDirector==='function'){
      const real=(eHeal.tasks||[]).find(function(x){return x&&String(x.id)===String(m.id);})||m;
      if(pqrsHealTaskTrasDevolucionDirector(eHeal,real))Object.assign(m,real);
    }
  }catch(e){}
  if(m.eliminada&&puedeRestaurarActividad()){
    return '<div class="tkr-foot"><span style="font-size:11px;color:var(--rd);font-weight:600">Eliminada — visible solo para administrador</span>'+
      '<button type="button" class="btn bsm bp" onclick="restaurarTaskFormRow(this)">↩ Restaurar</button></div>';
  }
  const est=estadoTask(m);
  const nc=(m.comentarios||[]).length;
  const ns=(m.soportes||[]).length;
  let h='<div class="tkr-foot">'+
    '<label style="font-size:11px;display:flex;align-items:center;gap:4px;margin-right:8px" title="Atender en el menor tiempo posible">'+
    '<input type="checkbox" class="tprior"'+(m.prioritaria?' checked':'')+' onchange="syncTaskPrioritariaRow(this)"> ⚡ Prioritaria</label>'+
    '<button type="button" class="btn bsm" onclick="openTaskCommentsFormRow(this)">'+chatWaIconHtml(14)+' <span class="tk-cmt-cnt">'+nc+'</span></button>';
  if(ns)h+='<span style="font-size:11px;color:var(--bl)">📎 '+ns+' soporte(s)</span>';
  if(canDeptVerificarCierre(m)){
    if(taskPendienteVerificacion(m))h+='<span class="verify-pill">Por revisar · reportada '+fmtF(m.fechaReportada)+'</span>';
    h+='<input type="date" class="tfv" value="'+hoy()+'" title="Fecha cierre">'+
      '<button type="button" class="btn bsm bp" onclick="verificarTaskFormRow(this)">✓ Cerrar actividad</button>';
    if(taskPendienteVerificacion(m)&&(m.soportes||[]).length)h+='<button type="button" class="btn bsm" onclick="openTaskCommentsModal(\''+escAttr(editId||'')+'\',\''+escAttr(m.id)+'\')">Ver soporte</button>';
  }else if(est==='Atendida'){
    h+='<span style="font-size:11px;color:var(--gn)">Verificada '+fmtF(m.fechaAtendida)+'</span>';
  }
  h+='<select class="tk-traslado-sel" style="display:none;max-width:190px;font-size:12px;padding:4px 6px" onchange="aplicarTrasladoTaskSel(this)"><option value="">— Traslado a —</option></select>'+
    '<button type="button" class="btn bsm" onclick="toggleTrasladoTaskSel(this)">↔ Traslado</button>'+
    '<button type="button" class="btn bsm" onclick="gestionarCoEjTask(this)" title="Añadir co-ejecutores y elegir entrega individual o unificada">👥 Co-ejecutores</button>'+
    (responsablePuedeEditarSec('actividades')||!esModoResponsable()?'<button type="button" class="btn bsm bd2" onclick="eliminarTaskFormRow(this)">🗑</button>':'')+'</div>';
  return h;
}
function toggleTrasladoTaskSel(btn){
  const row=btn.closest('.tkr-wrap');
  const foot=btn.closest('.tkr-foot');
  const sel=foot?foot.querySelector('.tk-traslado-sel'):null;
  if(!sel||!row)return;
  const actual=row.querySelector('.tr')?row.querySelector('.tr').value:'';
  const lista=getResponsablesForTrasladoActividad(editId||window._conPanelActive,readTaskMeta(row).id).filter(n=>n&&n!==actual);
  if(!lista.length){notif('No hay otros responsables configurados','err');return;}
  const show=sel.style.display==='none'||!sel.style.display;
  if(!show){sel.style.display='none';sel.value='';return;}
  sel.innerHTML='<option value="">— Seleccione responsable —</option>'+lista.map(n=>'<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>').join('');
  sel.style.display='';
  sel.focus();
}
function aplicarTrasladoTaskSel(sel){
  const val=sel.value;if(!val)return;
  const row=sel.closest('.tkr-wrap');
  const meta=readTaskMeta(row);
  const actual=row.querySelector('.tr')?row.querySelector('.tr').value:'';
  const expId=editId||window._conPanelActive;
  if(expId){
    trasladarTaskExp(expId,meta.id,val);
    refreshFormularioExp(expId);
  }else{
    row.querySelector('.tr').value=val;
    meta.historial.push({tipo:'traslado',fecha:hoy(),de:actual,a:val,por:taskComentarioAutor()});
    writeTaskMeta(row,meta);
    notif('Traslado registrado — guarde el expediente','ok');
  }
  sel.style.display='none';
  sel.value='';
}
function trasladarTaskFormRow(btn){toggleTrasladoTaskSel(btn);}
function openTaskCommentsFormRow(btn){
  const row=btn.closest('.tkr-wrap');
  const meta=readTaskMeta(row);
  const expId=editId||window._conPanelActive;
  if(!expId){notif('Guarde el expediente para comentarios persistentes','err');return;}
  openTaskCommentsModal(expId,meta.id,{chatOnly:true});
}
function verificarTaskFormRow(btn){
  const row=btn.closest('.tkr-wrap');
  const meta=readTaskMeta(row);
  const expId=editId||window._conPanelActive;
  if(!expId){notif('Guarde el expediente para verificar la actividad','err');return;}
  const fecha=row.querySelector('.tfv')?row.querySelector('.tfv').value:hoy();
  verificarTaskExp(expId,meta.id,fecha);
  refreshFormularioExp(expId);
}
function eliminarTaskFormRow(btn){
  const row=btn.closest('.tkr-wrap');
  const meta=readTaskMeta(row);
  const act=row.querySelector('.ta')?row.querySelector('.ta').value.trim():'';
  const expId=editId||window._conPanelActive;
  if(expId&&!puedeEliminarTaskPqrs(expId,meta.id)){notif('Solo Secretaría DEGUV puede eliminar actividades de PQRSD','err');return;}
  confirmPrecaucion({
    title:'⚠️ Eliminar actividad',
    message:'La actividad quedará marcada como eliminada y seguirá visible en consulta con registro histórico. ¿Confirma que desea eliminarla?',
    detail:act||'(sin título)',
    confirmLabel:'Sí, eliminar actividad'
  },function(){
    const expId=editId||window._conPanelActive;
    if(expId){
      eliminarTaskExp(expId,meta.id,'');
      if(puedeRestaurarActividad()){row.classList.add('tkr-deleted');row.style.display='';}
      else row.style.display='none';
      writeTaskMeta(row,{...readTaskMeta(row),eliminada:true});
      const foot=row.querySelector('.tkr-foot');
      if(foot&&puedeRestaurarActividad())foot.outerHTML=taskFormFootHtml({...readTaskMeta(row),eliminada:true});
    }else row.remove();
    notif('Actividad eliminada','ok');
  });
}
function restaurarTaskFormRow(btn){
  if(!puedeRestaurarActividad()){notif('Solo el Administrador puede restaurar actividades eliminadas','err');return;}
  const row=btn.closest('.tkr-wrap');
  const meta=readTaskMeta(row);
  const expId=editId||window._conPanelActive;
  if(expId){
    restaurarTaskExp(expId,meta.id);
    row.classList.remove('tkr-deleted');
    row.style.display='';
    writeTaskMeta(row,{...readTaskMeta(row),eliminada:false});
    const foot=row.querySelector('.tkr-foot');
    if(foot)foot.outerHTML=taskFormFootHtml({...readTaskMeta(row),eliminada:false});
    notif('Actividad restaurada','ok');
  }
}
function addTask(data){
  tkSeq++;
  const c=getTkCont();if(!c)return;
  data=normalizeTask(data||{});
  const wrap=document.createElement('div');
  wrap.className='tkr-wrap tkr'+(data.eliminada?' tkr-deleted':'')+(data.prioritaria?' prioritaria':'');
  if(data.eliminada&&!puedeRestaurarActividad())wrap.style.display='none';
  const iOpts=instructoresOptsHtml(getDeptoOperativo(),data&&data.responsable);
  const actividad=data?(data.actividad||data.desc||''):'';
  const detalle=data?(data.detalle||''):'';
  const plazo=data?(data.plazoDias||(data.vence?diffDias(data.vence):'')):'';
  const vence=data&&data.vence?data.vence:calcVence(plazo);
  let fechaAtendida=data?(data.fechaAtendida||''):'';
  if(data&&(data.estado==='Atendida'||data.estado==='Completada')&&!fechaAtendida)fechaAtendida=data.vence||hoy();
  const tfaDisabled=estadoTask(data)!=='Atendida'?' disabled':'';
  wrap.innerHTML='<div class="act-wrap"><input type="text" placeholder="Buscar actividad..." value="'+escAttr(actividad)+'" class="ta" oninput="filtrarActsPred(this)" onfocus="filtrarActsPred(this)" onblur="setTimeout(()=>hideActsPred(this),160)"></div>'+
    '<input type="text" placeholder="Detalles de la actividad" value="'+escAttr(detalle)+'" class="td">'+
    '<select class="tr" onchange="syncTkTrCoEj(this)"><option value="">-- Responsable --</option>'+iOpts+'</select>'+
    '<input type="number" step="1" placeholder="Días" value="'+plazo+'" class="tp" oninput="calcTaskVence(this)">'+
    '<input type="date" value="'+vence+'" class="tv" onchange="calcTaskDias(this);syncTaskEstado(this.closest(\'.tkr-wrap\'))">'+
    '<input type="date" value="'+fechaAtendida+'" class="tfa" title="Fecha verificada (cierre)"'+tfaDisabled+' onchange="syncTaskEstado(this.closest(\'.tkr-wrap\'))">'+
    '<span class="te-display"></span>'+
    '<div class="tk-asig-extra tk-asig-tags">'+renderTkAsigTags(data)+'</div>'+
    renderTkCoEjPanelHtml(data)+
    taskMetaInput(data)+taskFormFootHtml(data);
  c.appendChild(wrap);
  syncTaskEstado(wrap);
  writeTaskMeta(wrap,readTaskMeta(wrap));
}
function positionActSugPortal(inp){
  const portal=document.getElementById('act-sug-portal');if(!portal||!inp)return;
  const r=inp.getBoundingClientRect();
  portal.style.left=Math.max(8,r.left)+'px';
  portal.style.top=(r.bottom+4)+'px';
  portal.style.width=Math.max(r.width,320)+'px';
  portal.style.zIndex=portalZIndexFlotante();
}
function filtrarActsPred(inp){
  actSugInput=inp;
  const portal=document.getElementById('act-sug-portal');
  if(!portal)return;
  const q=inp.value.trim().toLowerCase();
  const words=q.split(/\s+/).filter(Boolean);
  const src=(inp.dataset&&inp.dataset.sugSrc)||'exp';
  let deptoId=getDeptoOperativo();
  const modalCtx=window._taskModalCtx;
  if(modalCtx&&modalCtx.mode==='crearActLibre')deptoId=deptoActivo;
  else if(modalCtx&&modalCtx.mode==='entregaResponsable')deptoId=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  else if(modalCtx&&(modalCtx.mode==='editarActTask'||modalCtx.mode==='editarActLibre')&&modalCtx.taskId){
    const t=getTaskAny(modalCtx.expId,modalCtx.taskId);
    if(t){
      if(t.depto)deptoId=t.depto;
      else{const ex=getExpById(modalCtx.expId);if(ex&&ex._depto)deptoId=ex._depto;}
    }
  }else if(window._conPanelEditMode&&editId){
    const ex=getExpById(editId);
    if(ex&&ex._depto)deptoId=ex._depto;
  }else if(editId){
    const ex=getExpById(editId);
    if(ex&&ex._depto)deptoId=ex._depto;
  }
  const cfgAct=getCfgActividadesPred(deptoId);
  const baseList=src==='cortas'?(cfgAct.actividadesCortasPred||[]):(cfgAct.actividadesPred||[]);
  const acts=baseList.filter(a=>{
    const s=String(a||'').toLowerCase();
    return !words.length||words.every(w=>s.includes(w));
  }).slice(0,12);
  portal.innerHTML=acts.map(a=>'<button type="button" onmousedown="pickActPred(null,\''+a.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+escAttr(a)+'</button>').join('');
  if(acts.length){positionActSugPortal(inp);portal.style.display='block';}else portal.style.display='none';
}
function pickActPred(btn,val){
  if(actSugInput)actSugInput.value=val;
  hideActSugPortal();
  if(window._taskModalCtx&&window._taskModalCtx.mode==='entregaResponsable'&&typeof syncEntregaRespRegistroUi==='function')
    syncEntregaRespRegistroUi();
}
function hideActsPred(inp){hideActSugPortal();}
function hideActSugPortal(){
  const portal=document.getElementById('act-sug-portal');
  if(portal)portal.style.display='none';
  actSugInput=null;
}
window.addEventListener('scroll',()=>{if(actSugInput)positionActSugPortal(actSugInput);if(personSugInput)positionPersonSugPortal(personSugInput);if(expAsocSugInput)positionExpAsocSugPortal(expAsocSugInput);},true);
window.addEventListener('resize',()=>{if(actSugInput)positionActSugPortal(actSugInput);if(personSugInput)positionPersonSugPortal(personSugInput);if(expAsocSugInput)positionExpAsocSugPortal(expAsocSugInput);});
function calcVence(plazo){
  if(plazo===''||plazo===null||plazo===undefined)return'';
  const n=Number(plazo);if(isNaN(n))return'';
  const d=new Date(hoy()+'T00:00:00');d.setDate(d.getDate()+n);
  return d.toISOString().split('T')[0];
}
// diffDias → js/utils.js
function calcTaskVence(inp){
  const row=inp.closest('.tkr-wrap')||inp.closest('.tkr');
  const tv=row.querySelector('.tv');
  tv.value=calcVence(inp.value);
  syncTaskEstado(row);
}
function calcTaskDias(inp){
  const row=inp.closest('.tkr-wrap')||inp.closest('.tkr');
  row.querySelector('.tp').value=diffDias(inp.value);
  syncTaskEstado(row);
}
function syncTaskEstado(row){
  const meta=readTaskMeta(row);
  const fa=row.querySelector('.tfa')?row.querySelector('.tfa').value:'';
  const fr=meta.fechaReportada||'';
  const vence=row.querySelector('.tv')?row.querySelector('.tv').value:'';
  const estEl=row.querySelector('.te-display');
  let est='En ejecución';
  if(meta.eliminada)est='Eliminada';
  else if(fa)est='Atendida';
  else if(fr)est='Por verificar';
  else if(vence&&vence<hoy())est='Vencida';
  if(estEl){
    const lbl=est==='En ejecución'?'Por ejecutar':est;
    estEl.textContent=lbl;
    estEl.className='te-display '+(est==='Atendida'?'te-ate':est==='Por verificar'?'te-pv':est==='Vencida'?'te-venc':'te-ejec');
  }
  return est;
}
function getTasks(){
  const cont=getTkCont();
  if(!cont)return [];
  return Array.from(cont.querySelectorAll('.tkr-wrap')).map(d=>{
    const ta=d.querySelector('.ta'),td=d.querySelector('.td'),tr=d.querySelector('.tr'),tp=d.querySelector('.tp'),tv=d.querySelector('.tv');
    if(!ta||!td||!tr)return null;
    const meta=readTaskMeta(d);
    if(!meta.id){meta.id=genTaskId();writeTaskMeta(d,meta);}
    const actividad=ta.value.trim();
    const detalle=td.value.trim();
    const plazoDias=tp?tp.value:'';
    const vence=(tv&&tv.value)||calcVence(plazoDias);
    const fechaAtendida=d.querySelector('.tfa')?d.querySelector('.tfa').value:'';
    const estado=syncTaskEstado(d);
    let responsables=(meta.responsables&&meta.responsables.length)?meta.responsables.slice():[];
    if(tr.value){
      if(!responsables.length)responsables=[tr.value];
      else if(!responsables.some(r=>agendaNorm(r)===agendaNorm(tr.value)))responsables.unshift(tr.value);
      else responsables[0]=tr.value;
    }
    return normalizeTask({
      id:meta.id,actividad,detalle,
      desc:actividad+(detalle?' - '+detalle:''),
      responsable:tr.value,
      responsables:responsables,
      asignados:meta.asignados||[],
      entregaModo:meta.entregaModo||'individual',
      plazoDias,vence,fechaAtendida,
      fechaReportada:meta.fechaReportada||'',
      verificadoPor:meta.verificadoPor||'',
      comentarios:meta.comentarios||[],
      historial:meta.historial||[],
      soportes:meta.soportes||[],
      notasDoc:meta.notasDoc||[],
      eliminada:!!meta.eliminada,
      prioritaria:!!(d.querySelector('.tprior')&&d.querySelector('.tprior').checked)||!!meta.prioritaria,
      estado
    });
  }).filter(Boolean).filter(t=>t.eliminada||t.actividad||t.detalle||t.responsable||t.vence);
}

// ================================================================