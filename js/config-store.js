// =============================================================================
// config-store.js — Puntero cfg activo y normalización de configuración
// Depende de: constants.js (DEF, DEPTOS), state.js (cfg, cfgByDepto, deptoCfg),
//             persistence.js (lsParseStoredJson), roles.js (migrateInstructoresList).
// Dependencias de runtime: ensureTiposActoAdminDefaults (main script).
// Cargar después de roles.js y antes del script principal.
// =============================================================================
function cfgFor(deptoOrExp){
  if(!deptoOrExp)return cfg;
  const id=typeof deptoOrExp==='string'?deptoOrExp:(deptoOrExp._depto||'');
  return (id&&cfgByDepto[id])?cfgByDepto[id]:cfg;
}
function normalizeCfgObj(c){
  if(!c||typeof c!=='object')c=JSON.parse(JSON.stringify(DEF));
  ['gravedades','cargos','instructores','actividadesPred','actividadesCortasPred','etapasPred','tiposFactura','tiposActoAdmin','infoTecnica','tiposSancionatorio','tramites'].forEach(k=>{if(!c[k])c[k]=JSON.parse(JSON.stringify(DEF[k]||[]));});
  // Migración: unificar lista «sin expediente» dentro de Actividades predeterminadas
  if(Array.isArray(c.actividadesCortasPred)&&c.actividadesCortasPred.length){
    if(!Array.isArray(c.actividadesPred))c.actividadesPred=[];
    const seen=new Set(c.actividadesPred.map(function(a){return String(a||'').trim().toLowerCase();}));
    c.actividadesCortasPred.forEach(function(a){
      const v=String(a||'').trim();
      if(!v)return;
      const k=v.toLowerCase();
      if(seen.has(k))return;
      seen.add(k);
      c.actividadesPred.push(v);
    });
    c.actividadesCortasPred=[];
  }
  if(!c.tramites.some(t=>t.id==='t_sanc')&&!c.tramites.some(t=>(t.nombre||'').toLowerCase().trim()==='sancionatorio')){
    const sn=DEF.tramites.find(t=>t.id==='t_sanc');
    if(sn)c.tramites.unshift(JSON.parse(JSON.stringify(sn)));
  }
  (c.tramites||[]).forEach(function(t){
    if(!t||typeof t!=='object')return;
    if(!Array.isArray(t.subclases))t.subclases=[];
    else t.subclases=t.subclases.map(function(s){return String(s||'').trim();}).filter(Boolean);
    if(!t.subclaseLabel)t.subclaseLabel='Clase / tipo';
  });
  const priIds=['t_sanc'];
  c.tramites.sort((a,b)=>{
    const ia=priIds.indexOf(a.id),ib=priIds.indexOf(b.id);
    if(ia>=0||ib>=0)return (ia<0?99:ia)-(ib<0?99:ib);
    return 0;
  });
  if(c.tiposActoAdmin&&c.tiposActoAdmin.length&&typeof c.tiposActoAdmin[0]==='string'){
    c.tiposActoAdmin=c.tiposActoAdmin.map(n=>({nombre:n,tieneVencimiento:true}));
  }
  if(c.instructores)c.instructores=migrateInstructoresList(c.instructores);
  purgeLegacyPlaceholderInstructores(c);
  if(!c.actRegistroMap||typeof c.actRegistroMap!=='object')c.actRegistroMap={};
  if(!c.actFirmaMap||typeof c.actFirmaMap!=='object')c.actFirmaMap={};
  if(!c.actPlazoMap||typeof c.actPlazoMap!=='object')c.actPlazoMap={};
  if(!c.actPlazoUnidadMap||typeof c.actPlazoUnidadMap!=='object')c.actPlazoUnidadMap={};
  // Semillas por defecto (solo si la actividad existe y aún no tiene mapeo)
  const seeds={
    'Elaborar concepto técnico':'concepto',
    'Proyectar acto administrativo':'acto',
    'Notificar decisión':'ninguno'
  };
  Object.keys(seeds).forEach(function(nom){
    if(c.actRegistroMap[nom]==null&&(c.actividadesPred||[]).indexOf(nom)>=0)c.actRegistroMap[nom]=seeds[nom];
  });
  // «Concepto de seguimiento»: Registro → concepto; no exige firma Director (se notifica al aprobar)
  (c.actividadesPred||[]).forEach(function(nom){
    if(!/concepto\s+de\s+seguimiento/i.test(String(nom||'')))return;
    if(c.actRegistroMap[nom]==null)c.actRegistroMap[nom]='concepto';
    if(c.actFirmaMap[nom]==null)c.actFirmaMap[nom]=false;
  });
  if((c.actividadesPred||[]).indexOf('Proyectar acto administrativo')>=0&&c.actFirmaMap['Proyectar acto administrativo']==null)
    c.actFirmaMap['Proyectar acto administrativo']=true;
  c.tramites.forEach(t=>{
    if(!t.campos)t.campos=[];
    if(!t.etapasSeg)t.etapasSeg=[];
    if(!t.plazo)t.plazo=60;
    if(!t.alerta)t.alerta=80;
    if(!t.unidad)t.unidad='dias';
  });
  return c;
}
function initCfgByDepto(){
  const stored=localStorage.getItem('sst_c_by_depto');
  if(stored){
    try{cfgByDepto=lsParseStoredJson(stored);}catch(e){cfgByDepto={};}
  }else{
    let base;
    try{
      const old=localStorage.getItem('sst_c');
      base=old?lsParseStoredJson(old):JSON.parse(JSON.stringify(DEF));
    }catch(e){base=JSON.parse(JSON.stringify(DEF));}
    cfgByDepto={};
    DEPTOS.forEach(d=>{cfgByDepto[d.id]=JSON.parse(JSON.stringify(base));});
  }
  DEPTOS.forEach(d=>{
    if(!cfgByDepto[d.id])cfgByDepto[d.id]=JSON.parse(JSON.stringify(DEF));
    cfgByDepto[d.id]=normalizeCfgObj(cfgByDepto[d.id]);
  });
}
function setCfgPtr(deptoId){
  deptoCfg=deptoId;
  cfg=cfgByDepto[deptoId]||cfg;
  ensureTiposActoAdminDefaults();
}
function syncCfgToStore(){
  if(deptoCfg&&cfgByDepto[deptoCfg])cfgByDepto[deptoCfg]=JSON.parse(JSON.stringify(cfg));
}