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
  if(!c.tramites.some(t=>t.id==='t_sanc')&&!c.tramites.some(t=>(t.nombre||'').toLowerCase().trim()==='sancionatorio')){
    const sn=DEF.tramites.find(t=>t.id==='t_sanc');
    if(sn)c.tramites.unshift(JSON.parse(JSON.stringify(sn)));
  }
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