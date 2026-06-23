// =============================================================================
// export.js — EXPORT / IMPORT
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// EXPORT / IMPORT
// ================================================================
function importarDatos(){document.getElementById('imp-file').click();}
function leerImportFile(evt){
  const file=evt.target.files[0];if(!file)return;
  const name=(file.name||'').toLowerCase();
  if(name.endsWith('.json')){leerJSON(evt);return;}
  const r=new FileReader();
  r.onload=function(e){
    const txt=e.target.result||'';
    if(name.endsWith('.csv')){
      importarCSVTexto(txt);
      evt.target.value='';
      return;
    }
    if(name.endsWith('.xls')||name.endsWith('.html')||txt.trim().startsWith('<')){
      importarHTMLTabla(txt);
      evt.target.value='';
      return;
    }
    try{
      const data=sanitizeImportPayload(JSON.parse(txt));
      aplicarImportJSON(data);
    }catch(err){notif('Formato no reconocido. Para migrar entre equipos use respaldo .json (Exportar respaldo).','err');}
    evt.target.value='';
  };
  r.readAsText(file);
}
// EXPORT / IMPORT — respaldo completo en JSON (sincronizar SST_EXPORT_KEYS al añadir datos en saveLS)
// ================================================================
// SST_EXPORT_VERSION, SST_EXPORT_KEYS → js/constants.js
function fmtExportFecha(d){
  d=d||new Date();
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());
}
function buildExportBundle(){
  syncCfgToStore();
  const now=new Date();
  return {
    _schemaVersion:2,
    _exportadoPor:getAuditRolLabel(),
    _fechaExport:fmtExportFecha(now),
    version:SST_EXPORT_VERSION,
    app:'ProgramaRegistroExpedientes',
    exportadoEn:now.toISOString(),
    fecha:hoy(),
    deptoActivo,
    deptoCfg,
    responsableActivo,
    cfgByDepto:JSON.parse(JSON.stringify(cfgByDepto||{})),
    exps:JSON.parse(JSON.stringify(exps||[])),
    personas:JSON.parse(JSON.stringify(personas||[])),
    actividadesLibres:JSON.parse(JSON.stringify(actividadesLibres||[])),
    agendaEventos:JSON.parse(JSON.stringify(agendaEventos||[])),
    chatMensajes:JSON.parse(JSON.stringify(chatMensajes||[])),
    encargadosGlobal:JSON.parse(JSON.stringify(normalizeEncargadosGlobal(encargadosGlobal))),
    bandejaLeidos:getBandejaLeidos(),
    bandejaEliminados:getBandejaEliminados()
  };
}
function exportarRespaldoCompleto(){
  const data=buildExportBundle();
  if(!data.exps.length&&!Object.keys(data.cfgByDepto||{}).length){notif('Sin datos para exportar','err');return;}
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='sst-respaldo-completo-'+hoy()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  markExportRealizado();
  logAudit('Exportó datos del sistema','configuracion',null,data.exps.length+' expediente(s)');
  notif('Respaldo completo exportado ('+data.exps.length+' expediente(s)). Importe este .json en otro equipo.','ok');
}
function normalizarDatosTrasImport(){
  if(!Array.isArray(personas))personas=[];
  personas=personas.map(normalizePersonaRecord);
  if(!Array.isArray(actividadesLibres))actividadesLibres=[];
  if(!Array.isArray(agendaEventos))agendaEventos=[];
  if(!Array.isArray(chatMensajes))chatMensajes=[];
  exps.forEach(e=>{
    if(!e._depto)e._depto=getDeptoOperativo();
    if(!e._fechas_estado&&e._fecha){
      const est=isArchivadoEstado(e._estado)?'Archivado o anulado':(e._estado||'Solicitud');
      const o={Solicitud:e._fecha};o[est]=e._fecha;
      if(e._fecha_seg)o.Seguimiento=e._fecha_seg;
      e._fechas_estado=JSON.stringify(o);
    }
    if(!e._conceptos_seg||e._conceptos_seg==='[]')migrarSegLegacy(e);
    const actosM=actosAdminData(e._actos_admin);
    const csM=conceptosSegData(e._conceptos_seg);
    if(actosM.length||csM.some(c=>c.trasladoSan))Object.assign(e,mergeExpedienteFlags(actosM,csM));
    if(!e._actos_admin)e._actos_admin='[]';
    else{
      try{
        const actos=JSON.parse(e._actos_admin);
        if(Array.isArray(actos))e._actos_admin=JSON.stringify(actos.map(a=>cleanActoForStore(migrarActoProrroga(a))));
      }catch(x){}
    }
    syncFechasEstadoConEstado(e);
    e.historial=rebuildHistorial(e,e.historial);
    migrarInfoTecExpediente(e);
    if(Array.isArray(e.tasks))e.tasks=e.tasks.map(t=>{
      const nt=normalizeTask(t);
      if(!nt.actividad&&nt.desc){const p=String(nt.desc).split(' - ');nt.actividad=p[0]||'';nt.detalle=p.slice(1).join(' - ')||'';}
      return nt;
    });
  });
}
function buildExportExpBundle(expId){
  const e=getExpById(expId);
  if(!e)return null;
  syncCfgToStore();
  const dept=e._depto||getDeptoOperativo();
  const cfgSlice={};
  if(cfgByDepto&&cfgByDepto[dept])cfgSlice[dept]=JSON.parse(JSON.stringify(cfgByDepto[dept]));
  return{
    version:SST_EXPORT_VERSION,
    tipo:'expediente',
    app:'ProgramaRegistroExpedientes',
    exportadoEn:new Date().toISOString(),
    fecha:hoy(),
    deptoId:dept,
    exp:JSON.parse(JSON.stringify(e)),
    cfgByDepto:cfgSlice
  };
}
function exportarExpediente(expId){
  const data=buildExportExpBundle(expId);
  if(!data){notif('Expediente no encontrado','err');return;}
  const safe=String(expId||'exp').replace(/[^\w\-]+/g,'-');
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='sst-exp-'+safe+'-'+hoy()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
  notif('Expediente '+expId+' exportado. Importe el .json en otro equipo con «Importar».','ok');
}
function aplicarImportExpediente(data){
  if(!data||typeof data!=='object')throw new Error('Formato inválido');
  data=sanitizeImportPayload(data);
  const exp=data.exp||data.expediente;
  if(!exp||!exp._exp)throw new Error('Archivo sin datos de expediente');
  const expId=String(exp._exp).trim();
  const dept=exp._depto||data.deptoId||getDeptoOperativo();
  exp._depto=dept;
  const idx=exps.findIndex(x=>String(x._exp||'').trim().toLowerCase()===expId.toLowerCase());
  const dupDepto=idx>=0?(exps[idx]._depto||'guaviare'):dept;
  const accion=idx>=0?'reemplazar':'añadir';
  confirmPrecaucion({
    title:'Importar expediente',
    message:'¿'+accion.charAt(0).toUpperCase()+accion.slice(1)+' el expediente '+expId+(idx>=0?' (ya existe en '+labelDepto(dupDepto)+')':'')+' en este equipo?',
    detail:(exp.tasks||[]).length+' actividad(es) · trazabilidad y adjuntos incluidos',
    confirmLabel:'Sí, importar expediente'
  },()=>{
    if(data.cfgByDepto&&typeof data.cfgByDepto==='object'){
      Object.keys(data.cfgByDepto).forEach(d=>{
        if(!cfgByDepto[d])cfgByDepto[d]=JSON.parse(JSON.stringify(DEF));
        cfgByDepto[d]=normalizeCfgObj({...cfgByDepto[d],...data.cfgByDepto[d]});
      });
      setCfgPtr(getDeptoOperativo());
    }
    if(idx>=0)exps[idx]=exp;
    else exps.push(exp);
    normalizarDatosTrasImport();
    persistExpedienteGranular(exp,false);
    poblarTramSelect();
    renderTabla();
    renderBandejaDepto();
    if(document.getElementById('pg-con').classList.contains('on')){poblarFiltrosCon();renderConsulta();}
    if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
    if(document.getElementById('pg-act').classList.contains('on'))renderActividades();
    notif('Expediente '+expId+' importado ('+accion+' en '+labelDepto(dept)+')','ok');
  });
}
function aplicarImportJSON(data){
  if(!data||typeof data!=='object')throw new Error('Formato inválido');
  data=sanitizeImportPayload(data);
  if(data.tipo==='expediente'||(data.exp&&!data.exps&&!data.expedientes)){
    aplicarImportExpediente(data);
    return;
  }
  const arr=data.exps||data.expedientes;
  if(!Array.isArray(arr))throw new Error('Formato inválido — use un respaldo .json completo');
  const nExp=arr.length;
  confirmPrecaucion({
    title:'Confirmar importación',
    message:'¿Restaurar respaldo completo? Se reemplazarán expedientes, configuración, agenda y trazabilidad en este equipo.',
    detail:nExp+' expediente(s)',
    confirmLabel:'Sí, importar respaldo'
  },async ()=>{
    exps=arr;
    if(data.personas&&Array.isArray(data.personas))personas=data.personas;
    if(data.actividadesLibres&&Array.isArray(data.actividadesLibres))actividadesLibres=data.actividadesLibres;
    if(data.agendaEventos&&Array.isArray(data.agendaEventos))agendaEventos=data.agendaEventos;
    // chatMensajes ya no se importa desde JSON — los mensajes viven en chats/{convId}/mensajes en Firestore
    if(data.encargadosGlobal)encargadosGlobal=normalizeEncargadosGlobal(data.encargadosGlobal);
    if(data.cfgByDepto){
      cfgByDepto=data.cfgByDepto;
      DEPTOS.forEach(d=>{if(!cfgByDepto[d.id])cfgByDepto[d.id]=JSON.parse(JSON.stringify(DEF));cfgByDepto[d.id]=normalizeCfgObj(cfgByDepto[d.id]);});
      setCfgPtr(getDeptoOperativo());
    }else if(data.cfg){
      const merged={...JSON.parse(JSON.stringify(DEF)),...data.cfg};
      normalizeCfgObj(merged);
      DEPTOS.forEach(d=>{cfgByDepto[d.id]=JSON.parse(JSON.stringify(merged));});
      setCfgPtr(getDeptoOperativo());
    }
    if(data.deptoActivo&&DEPTOS.some(d=>d.id===data.deptoActivo))deptoActivo=data.deptoActivo;
    else if(data.deptoActivo==='jurisdiccional'||data.deptoActivo==='responsables')deptoActivo=data.deptoActivo;
    if(data.deptoCfg&&DEPTOS.some(d=>d.id===data.deptoCfg))deptoCfg=data.deptoCfg;
    if(data.responsableActivo!==undefined)responsableActivo=String(data.responsableActivo||'');
    if(Array.isArray(data.bandejaLeidos))try{localStorage.setItem('sst_bandeja_leidos',JSON.stringify(data.bandejaLeidos));}catch(e){}
    if(Array.isArray(data.bandejaEliminados))try{localStorage.setItem('sst_bandeja_eliminados',JSON.stringify(data.bandejaEliminados));}catch(e){}
    normalizarDatosTrasImport();
    logAudit('Importó datos al sistema','configuracion',null,nExp+' expediente(s)');
    // Persistir en localStorage
    try{persistExpLocal();}catch(e){console.error('aplicarImportJSON: localStorage error',e);}
    const sel=document.getElementById('sel-depto');if(sel)sel.value=deptoActivo;
    updateDeptoUI();
    poblarTramSelect();
    renderTabla();
    renderBandejaDepto();
    renderChatBadge();
    if(document.getElementById('pg-con').classList.contains('on')){poblarFiltrosCon();renderConsulta();}
    if(document.getElementById('pg-cons').classList.contains('on'))renderConsolidado();
    if(document.getElementById('pg-act').classList.contains('on'))renderActividades();
    notif('Respaldo importado: '+nExp+' expediente(s), configuración y trazabilidad — sincronizando con Firestore…','ok');
    // Escritura a Firestore: global + doc padre de cada depto + subcolección de cada expediente
    updateSyncIndicator('syncing');
    try{
      const writes=[saveGlobalFirestore()];
      DEPTOS.forEach(d=>{writes.push(saveFirestore(d.id));});
      exps.forEach(function(exp){
        if(exp&&exp._exp&&(exp._depto||deptoActivo))writes.push(saveExpedienteDoc(exp._depto||deptoActivo,exp));
      });
      await Promise.all(writes);
      updateSyncIndicator('synced');
      notif('Respaldo importado y sincronizado: '+nExp+' expediente(s)','ok');
    }catch(fsErr){
      console.error('aplicarImportJSON: error Firestore',fsErr);
      updateSyncIndicator('error');
      notif('Respaldo importado localmente — error al sincronizar con Firestore','err');
    }
  });
}
function leerJSON(evt){
  const file=evt.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=function(e){
    try{aplicarImportJSON(JSON.parse(e.target.result));}
    catch(err){notif('Error al leer JSON','err');}
    evt.target.value='';
  };
  r.readAsText(file);
}
function importarCSVTexto(txt){
  const lines=String(txt||'').split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2){notif('CSV vacío o sin datos','err');return;}
  const parseLine=line=>{
    const out=[];let cur='',inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
      else if(ch===','&&!inQ){out.push(cur);cur='';}
      else cur+=ch;
    }
    out.push(cur);return out.map(s=>s.trim());
  };
  const hdr=parseLine(lines[0]);
  const idxExp=hdr.findIndex(h=>/expediente/i.test(h));
  if(idxExp<0){notif('CSV debe incluir columna Expediente','err');return;}
  confirmPrecaucion({title:'Importar CSV',message:'El CSV es solo un informe tabular. Para restaurar todo el sistema en otro equipo use un archivo .json de «Exportar respaldo».',confirmLabel:'Entendido'},()=>{});
}
function importarHTMLTabla(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const tables=doc.querySelectorAll('table');
  if(!tables.length){notif('No se encontró tabla en el archivo Excel','err');return;}
  confirmPrecaucion({title:'Importar Excel',message:'El Excel exportado es un informe de lectura. Para cargar expedientes, chat, configuración y trazabilidad en otro equipo use «Exportar respaldo» (.json) e «Importar».',confirmLabel:'Entendido'},()=>{});
}
function exportarJSON(){exportarRespaldoCompleto();}
function exportarExpedientesCSV(list,suffix){
  const pack=buildExpedientesExportRows(list);
  if(!pack)return;
  const csv=[pack.hdr,...pack.rows].map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='sst-'+(suffix||'exp')+'-'+hoy()+'.csv';a.click();notif('CSV exportado ('+pack.rows.length+')','ok');
}
function exportarCSV(){exportarExpedientesExcel(expsAmbito(),'completo');}
function exportarConsultaCSV(){exportarConsultaExcel();}
function exportarConsolidadoCSV(){exportarConsolidadoExcel();}

// ================================================================