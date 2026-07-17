// =============================================================================
// roles.js — Roles, permisos e instructor/encargado management
// Depende de: constants.js, state.js (runtime).
// Dependencias de runtime (getInstructoresCfg, syncCfgToStore, saveLS, etc.)
// se resuelven desde el scope global al momento de llamada.
// Cargar después de state.js y antes del script principal.
// =============================================================================
function esJurisdiccional(){return deptoActivo==='jurisdiccional';}
function esSecretaria(){return deptoActivo==='secretaria';}
function esModoCiudadano(){return deptoActivo==='ciudadano';}
function esModuloOficina(id){return OFICINAS_DEGUV.some(o=>o.id===(id||deptoActivo))&&deptoActivo!=='guaviare'&&deptoActivo!=='secretaria';}
function esVistaPqrsOficinaDeguv(){
  if(esModoOficinaDeguv())return true;
  if(esSecretaria())return true;
  return false;
}
function esOficinaPqrsBasica(){return esModoOficinaDeguv()||esSecretaria();}
function esOficinaPqrsNca(){return deptoActivo==='guaviare'&&!esModoOficinaDeguv()&&!esSecretaria()&&!esJurisdiccional()&&!esModoResponsable()&&!esModoCiudadano();}
function getResponsablesOficinaPqrs(oficinaId){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  let responsables=getInstructoresOficina(oficinaId).map(i=>i.nombre).filter(Boolean);
  const enc=getEncargadoOficina(oficinaId);
  if(enc&&!responsables.includes(enc))responsables.unshift(enc);
  return responsables;
}
function normMedioRecepcionPqrs(v){
  const s=String(v||'').trim();
  if(s==='Correo electrónico'||s==='Correo electronico')return 'Correo';
  return s;
}
function mediosRecepcionPqrsOptsHtml(val){
  const v=normMedioRecepcionPqrs(val||'Ventanilla');
  return ['Ventanilla','Correo','Teléfono','Web'].map(m=>'<option value="'+escAttr(m)+'"'+(v===m?' selected':'')+'>'+escAttr(m)+'</option>').join('');
}
function esAdminActuandoComoSecretaria(){return esAdministrador()&&esSecretaria();}
function puedeEditarFechaRadicacionPqrs(){return esAdminActuandoComoSecretaria();}
function updateSecFechaRadicVisibility(){
  const wrap=document.getElementById('sec-fecha-radic-wrap');
  if(!wrap)return;
  wrap.style.display=puedeEditarFechaRadicacionPqrs()?'':'none';
  const f=document.getElementById('sec-fecha');
  if(f&&puedeEditarFechaRadicacionPqrs()&&!f.value)f.value=hoy();
}
function getContratistasOficinaPqrs(oficinaId){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  if(oficinaId==='secretaria'||oficinaId==='admin_deguv')return [];
  if(oficinaId==='guaviare'){
    return getInstructoresActivos('guaviare').filter(contratistaEsAsignablePqrsGuaviare).map(i=>i.nombre).filter(Boolean);
  }
  return getInstructoresOficina(oficinaId).filter(i=>i.rol==='contratista').map(i=>i.nombre).filter(Boolean);
}
function contratistaEsAsignablePqrsGuaviare(ins){
  if(!ins||ins.activo===false||ins.rol!=='contratista')return false;
  const ofs=ins.oficinas||[];
  if(!ofs.length)return true;
  if(ofs.includes('guaviare'))return true;
  return instructorEsSoloNcaDeguv(ins);
}
function getAsignablesPqrsOficina(oficinaId){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  if(oficinaId==='guaviare')return getResponsablesNcaDeguv();
  return getContratistasOficinaPqrs(oficinaId);
}
function oficinaPuedeAsignarPqrs(oficinaId){
  return getAsignablesPqrsOficina(oficinaId).length>0;
}
function oficinaTieneResponsables(oficinaId){
  oficinaId=oficinaId||getPqrsOficinaActiva();
  if(oficinaId==='secretaria'||oficinaId==='admin_deguv')return false;
  if(oficinaId==='guaviare')return getResponsablesNcaDeguv().length>0;
  return getResponsablesOficinaPqrs(oficinaId).length>0;
}
function getPqrsOficinaActiva(){
  if(esModoOficinaDeguv())return deptoActivo;
  if(deptoActivo==='guaviare')return 'guaviare';
  if(esSecretaria())return 'secretaria';
  return deptoActivo;
}
function getOficinaActiva(){
  const oid=getPqrsOficinaActiva();
  return OFICINAS_DEGUV.find(o=>o.id===oid)||OFICINAS_DEGUV.find(o=>o.id===deptoActivo)||null;
}
function esModoOficinaDeguv(){return esModuloOficina(deptoActivo);}
function oficinaSinApoyo(id){const o=OFICINAS_DEGUV.find(x=>x.id===(id||deptoActivo));return !!(o&&o.sinApoyo);}
function labelOficina(id){const o=OFICINAS_DEGUV.find(x=>x.id===id);return o?o.nombre:(id||'');}
function esModuloEspecialActivo(){return esSecretaria()||esModoCiudadano()||esJurisdiccional()||esModoResponsable()||esModoOficinaDeguv();}
function esDeptoCfgRestringido(){
  const d=deptoCfg||getDeptoOperativo();
  return d==='guainia'||d==='vaupes'||d==='guaviare';
}
function cfgEsSoloLectura(){return esCfgDeptoSoloResponsablesPersonas();}
function esCfgDeptoSoloResponsablesPersonas(){
  if(esAdminModoGlobal())return false;
  if(esJurisdiccional())return false;
  if(esAdministrador())return false;
  return esDeptoCfgRestringido();
}
function cfgPuedeEditarResponsablesPersonas(){
  if(esJurisdiccional())return false;
  if(esAdminModoGlobal())return true;
  if(esAdministrador())return DEPTOS.some(d=>d.id===getRolEfectivo());
  return esDeptoCfgRestringido();
}
function cfgPuedeEditarPersonas(){return cfgPuedeEditarResponsablesPersonas();}
function esAdministrador(){return rolSesion==='admin';}
function esAdminFirestore(){return !!(window._usuarioActual&&window._usuarioActual.rol==='admin');}
function esEncargadoDepartamentalUsuarios(){
  if(!window._usuarioActual||esAdminFirestore()||esAdministrador())return false;
  const rol=String(window._usuarioActual.rol||'').trim();
  return DEPTOS.some(d=>d.id===rol);
}
function esVistaUsuariosAdminCompleta(){return esAdminFirestore()||esAdministrador();}
function puedeGestionarUsuariosAutorizados(){return esAdminFirestore()||esAdministrador()||esEncargadoDepartamentalUsuarios();}
function puedeEliminarUsuariosAutorizados(){return esAdminFirestore()||esAdministrador();}
function getDeptoGestionUsuariosAutorizados(){
  if(esEncargadoDepartamentalUsuarios())return String(window._usuarioActual.rol||'').trim();
  return '';
}
function usuariosAutorizadosVisibles(){
  const d=getDeptoGestionUsuariosAutorizados();
  if(!d)return _usuariosCache.slice();
  return _usuariosCache.filter(u=>u.rol==='responsables'&&usuarioEsResponsableDepto(u,d));
}
function usuarioEditablePorEncargado(u){
  const d=getDeptoGestionUsuariosAutorizados();
  if(!d)return true;
  return !!(u&&u.rol==='responsables'&&usuarioEsResponsableDepto(u,d));
}
function esModoContratista(){return rolSesion==='contratista';}
function esUsuarioContratista(){return !!(window._usuarioActual&&window._usuarioActual.rol==='contratista');}
function expInstructoresList(e){
  const raw=e&&e._instructores;
  if(Array.isArray(raw))return raw.map(String);
  if(typeof raw==='string'){
    try{const p=JSON.parse(raw);if(Array.isArray(p))return p.map(String);}catch(x){}
    return raw.split(/[,;|]/).map(s=>s.trim()).filter(Boolean);
  }
  return [];
}
function expVisibleParaContratista(e){
  if(!esUsuarioContratista())return true;
  const u=window._usuarioActual;
  if(!u)return false;
  const nom=String(u.nombre||'').trim().toLowerCase();
  const em=String(u.email||'').trim().toLowerCase();
  if(String(e._responsable||'').trim().toLowerCase()===em)return true;
  if(expInstructoresList(e).some(x=>{const s=String(x||'').trim().toLowerCase();return s===nom||s===em;}))return true;
  return (e.tasks||[]).some(t=>{
    const rs=[t.responsable,...(t.responsables||[]),...(t.asignados||[])].filter(Boolean);
    return rs.some(r=>{const s=String(r).trim().toLowerCase();return s===nom||s===em;});
  });
}
function getSelDeptoVal(){
  const sel=document.getElementById('sel-depto');
  if(!sel)return deptoActivo;
  return sel.value||deptoActivo;
}
function esAdminModoGlobal(){return rolSesion==='admin'&&getSelDeptoVal()==='admin';}
function getRolEfectivo(){
  if(rolSesion!=='admin')return rolSesion;
  return getSelDeptoVal();
}
function puedeEditarRegSecContratistaCfg(){return esAdminModoGlobal()||cfgPuedeEditarResponsablesPersonas();}
function esNcaDeguv(){return getRolEfectivo()==='guaviare'&&deptoActivo==='guaviare'&&!esJurisdiccional()&&!esModoResponsable()&&!esSecretaria()&&!esModoOficinaDeguv()&&!esModoCiudadano();}
function esAdminGuaviare(){return esAdministrador();}
function esAdminFull(){return esAdministrador();}
function puedeRestaurarActividad(){return esAdministrador();}
function guardCfgEditGeneral(){
  if(cfgEsSoloLectura()){notif('En Configuración solo puede modificar responsables y personas/usuarios de su departamento','err');return true;}
  return false;
}
function updateCfgTabsDepto(){
  ['info-tecnica','tramites'].forEach(id=>{
    const tab=document.getElementById('ctab-'+id);
    if(tab)tab.style.display='';
  });
  const nuevoTab=document.getElementById('ctab-nuevo');
  if(nuevoTab)nuevoTab.style.display=cfgEsSoloLectura()?'none':'';
  const listasTab=document.getElementById('ctab-listas');
  if(listasTab)listasTab.textContent=esCfgDeptoSoloResponsablesPersonas()&&!esAdminModoGlobal()?'Responsables y listas':'Configuración base';
}
function cfgRestringidoBannerHtml(){return'';}
function esRolDepartamentalCfg(){const r=getRolEfectivo();return r==='guaviare'||r==='guainia'||r==='vaupes';}
function puedeGestionarContratistasCfg(){return cfgPuedeEditarResponsablesPersonas();}
function puedeGestionarEncargadosCfg(){return esAdminModoGlobal();}
function esVistaEncargadosModuloCfg(){return esAdminModoGlobal();}
function muestraOficinasContratistaCfg(){return deptoCfg==='guaviare'&&(esAdminModoGlobal()||getRolEfectivo()==='guaviare');}
function muestraOficinasContratistaIns(deptoId){return deptoId==='guaviare'&&(esAdminModoGlobal()||getRolEfectivo()==='guaviare');}
// Nombres de ejemplo del DEF antiguo (sin email) — no deben persistir en cfg ni chat
const LEGACY_INSTRUCTOR_PLACEHOLDERS=new Set([
  'dr. ricardo leal','dra. patricia gómez','dr. carlos mora','dra. laura díaz'
]);
function esInstructorPlaceholderLegacy(ins){
  if(!ins)return false;
  if(String(ins.email||'').trim())return false;
  if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return false;
  const nom=String(ins.nombre||'').trim().toLowerCase();
  return LEGACY_INSTRUCTOR_PLACEHOLDERS.has(nom);
}
function purgeLegacyPlaceholderInstructores(c){
  if(!c||!Array.isArray(c.instructores))return false;
  const antes=c.instructores.length;
  c.instructores=c.instructores.filter(function(ins){return !esInstructorPlaceholderLegacy(ins);});
  return c.instructores.length!==antes;
}
function instructorEsVinculoReal(ins){
  if(!ins||ins.activo===false)return false;
  if(esInstructorPlaceholderLegacy(ins))return false;
  if(String(ins.email||'').trim())return true;
  if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return true;
  return false;
}
function getInstructoresContratistasDepto(deptoId){
  const c=cfgByDepto[deptoId]||{};
  return migrateInstructoresList(c.instructores||[]).map((ins,i)=>({ins,i})).filter(function(x){
    return x.ins.rol==='contratista'&&instructorEsVinculoReal(x.ins);
  });
}
function withCfgDepto(deptoId,fn){
  syncCfgToStore();
  const prev=deptoCfg;
  if(deptoId)setCfgPtr(deptoId);
  try{return fn();}
  finally{
    syncCfgToStore();
    if(prev&&prev!==deptoId)setCfgPtr(prev);
  }
}
function editInstructorDepto(deptoId,i,k,v){withCfgDepto(deptoId,()=>editInstructor(i,k,v));}
function delInstructorDepto(deptoId,i){
  withCfgDepto(deptoId,()=>{
    cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
    const ins=cfg.instructores[i];
    if(!ins)return;
    const esEnc=ins.rol==='encargado_depto'||ins.rol==='encargado_oficina';
    if(esEnc&&!puedeGestionarEncargadosCfg()){notif('Solo el administrador puede eliminar encargados','err');return;}
    if(!esEnc&&!instructorEditableContratista(ins)&&!esAdminModoGlobal()){notif('Solo puede eliminar responsables de su departamento','err');return;}
    const insId=ins.id;
    confirmEliminar({message:'¿Eliminar a '+escAttr(ins.nombre||'esta persona')+' de la lista?',detail:INST_ROLES[ins.rol]||''},()=>{
      withCfgDepto(deptoId,()=>{
        cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
        const idx=cfg.instructores.findIndex(x=>x.id===insId);
        if(idx<0){notif('No se encontró el responsable en '+labelDepartamento(deptoId),'err');return;}
        cfg.instructores.splice(idx,1);
        syncInstructoresToEncargadosGlobal();
        void persistCfgDepto(deptoId).then(function(ok){
          if(ok===false)notif('No se pudo guardar en Firestore','err');
        });
        renderListasCfg();poblarSelResponsable();
        if(typeof chatRefreshContactsIfOpen==='function')chatRefreshContactsIfOpen();
        notif('Eliminado de la lista','ok');
      });
    });
  });
}
function delInstructor(i){
  delInstructorDepto(deptoCfg||getDeptoOperativo(),i);
}
function toggleInstructorRegSecDepto(deptoId,i,key,checked){withCfgDepto(deptoId,()=>toggleInstructorRegSec(i,key,checked));}
function toggleInstructorOficinaDepto(deptoId,i,oficinaId,checked){withCfgDepto(deptoId,()=>toggleInstructorOficina(i,oficinaId,checked));}
function instructorEditableContratista(ins){
  if(!ins)return false;
  if(esAdminModoGlobal())return true;
  if(!esRolDepartamentalCfg())return false;
  if(ins.rol!=='contratista')return false;
  const miDepto=getRolEfectivo();
  return deptoCfg===miDepto;
}
function syncInstructoresToEncargadosGlobal(){
  if(!esAdministrador())return;
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  DEPTOS.forEach(d=>{
    const enc=getInstructoresCfg(d.id).find(i=>i.activo!==false&&i.rol==='encargado_depto');
    encargadosGlobal.departamentos[d.id]={nombre:enc?(enc.nombre||''):'',email:enc?(enc.email||'').toLowerCase().trim():''};
  });
  OFICINAS_DEGUV.forEach(o=>{
    if(o.id==='secretaria'||o.id==='guaviare')return;
    const enc=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_oficina'&&(i.oficinas||[]).includes(o.id));
    encargadosGlobal.oficinas[o.id]={nombre:enc?(enc.nombre||''):'',email:enc?(enc.email||'').toLowerCase().trim():''};
  });
  syncEncargadoNcaGlobalSlots(encargadosGlobal);
  const secEnc=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_oficina'&&(i.oficinas||[]).includes('secretaria'));
  encargadosGlobal.secretaria={nombre:secEnc?(secEnc.nombre||''):'',email:secEnc?(secEnc.email||'').toLowerCase().trim():''};
}
function enforceUniqueEncargadoDepto(idx){
  cfg.instructores.forEach((x,j)=>{if(j!==idx&&x.rol==='encargado_depto')x.rol='contratista';});
}
function enforceUniqueEncargadoOficina(idx,oficinaId){
  if(!oficinaId)return;
  cfg.instructores.forEach((x,j)=>{
    if(j===idx||x.rol!=='encargado_oficina')return;
    x.oficinas=(x.oficinas||[]).filter(id=>id!==oficinaId);
    if(!(x.oficinas||[]).length)x.rol='contratista';
  });
}
function esModoResponsable(){return deptoActivo==='responsables'||rolSesion==='responsables';}

// ── VITAL (cargo especial sobre contratista de NCA) ──────────────────────────
// El cargo 'vital' se guarda en el campo 'cargo' del usuario autorizado.
function esCargoVital(){
  if(!esModoResponsable())return false;
  // Sesión: el doc usuarios/{email} trae cargo al login (independiente del índice global)
  if(String(window._usuarioActual&&window._usuarioActual.cargo||'').toLowerCase()==='vital')return true;
  // Preferir el usuario de la sesión (email) — evita fallar por nombre distinto al del select
  const email=String(window._usuarioActual&&window._usuarioActual.email||'').trim().toLowerCase();
  let u=null;
  if(email&&typeof getUsuarioAutorizadoByEmail==='function')u=getUsuarioAutorizadoByEmail(email);
  if(!u&&responsableActivo){
    u=typeof getUsuarioAutorizadoByNombre==='function'
      ? getUsuarioAutorizadoByNombre(responsableActivo)
      : (_usuariosCache||[]).find(x=>agendaNorm(x.nombre||'')===agendaNorm(responsableActivo));
  }
  return !!(u&&String(u.cargo||'').toLowerCase()==='vital');
}
// Retorna true si el usuario VITAL puede actuar sobre la PQRSD indicada
// (puede enviar correo aunque no tenga la PQRSD asignada)
function vitalPuedeActuar(e){
  if(!esCargoVital())return false;
  if(!e||!esPqrsSecretaria(e))return false;
  const f=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):(e._pqrs_workflow&&e._pqrs_workflow.fase)||'';
  return f===PQRS_WF.PARA_FIRMA||f===PQRS_WF.VITAL_GESTION||f===PQRS_WF.POR_FIRMAR||f===PQRS_WF.PENDIENTE_NOTIF||f===PQRS_WF.LISTA_ENVIO||f===PQRS_WF.REVISION_FINAL;
}
// Helper para buscar usuario por nombre
function getUsuarioAutorizadoByNombre(nombre){
  const n=agendaNorm(String(nombre||'').trim());
  return (_usuariosCache||[]).find(u=>agendaNorm(String(u.nombre||'').trim())===n)||null;
}
// REG_EDIT_SECS → js/constants.js
function getInstructorByNombre(nombre){
  const n=String(nombre||'').trim();
  if(!n)return null;
  for(const d of DEPTOS){
    const ins=getInstructoresCfg(d.id).find(i=>agendaNorm(i.nombre)===agendaNorm(n));
    if(ins)return {...ins,deptoRef:d.id};
  }
  return null;
}
function getRegSeccionesResponsableActivo(){
  if(!esModoResponsable()||!responsableActivo)return null;
  const ins=getInstructorByNombre(responsableActivo);
  if(!ins)return [];
  if(ins.rol==='encargado_depto')return Object.keys(REG_EDIT_SECS);
  return Array.isArray(ins.regSecciones)?ins.regSecciones.filter(Boolean):[];
}
function responsablePuedeVerRegistro(){
  if(!esModoResponsable())return true;
  return getRegSeccionesResponsableActivo().length>0;
}
function responsablePuedeEditarSec(key){
  if(esJurisdiccional())return false;
  if(!esModoResponsable())return true;
  return getRegSeccionesResponsableActivo().includes(key);
}
function regSecHtml(key,html){
  if(!html)return '';
  if(esModoResponsable()&&!responsablePuedeEditarSec(key))return '';
  return html;
}
function mergeExpDataPorSecciones(data,prev,secs){
  if(!prev||!Array.isArray(secs))return data;
  const out={...data};
  const has=k=>secs.includes(k);
  const copyKeys=(keys)=>keys.forEach(k=>{if(prev[k]!==undefined)out[k]=prev[k];});
  const copyDir=(prefix)=>Object.keys(prev).filter(k=>k.startsWith('_'+prefix+'_')).forEach(k=>{out[k]=prev[k];});
  const personaKeys=['_tipo_persona','_tipo_solicitud','_tipo_sancionatorio','_es_pqrs','_es_queja','_qd_anonimo','_medio_notificacion','_pn_nombre','_pn_identificacion','_pn_correo','_pn_telefono','_est_com','_ec_nombre','_ec_telefono','_pj_rep_nombre','_pj_rep_identificacion','_pj_rep_correo','_pj_rep_telefono','_pj_empresa','_pj_nit','_pj_correo','_pj_telefono','_qd_nombre','_qd_identificacion','_qd_correo','_qd_telefono','_pi_tipo_persona','_pi_nombre','_pi_identificacion','_pi_correo','_pi_telefono','_pi_rep_nombre','_pi_rep_identificacion','_pi_rep_correo','_pi_rep_telefono','_pi_empresa','_pi_nit','_pi_correo_emp','_pi_telefono_emp','_apoderado','_apo_nombre','_apo_identificacion','_apo_correo','_apo_telefono','_autorizado','_aut_nombre','_aut_identificacion','_aut_correo','_aut_telefono'];
  const controlKeys=['_fecha','_fechas_estado','_estado','_etapa','_usar_etapa','_resolucion','_fecha_res','_usar_exp_asociados','_expedientes_asociados','_medida_prev','_suspendido','_sancionatorio','_exp_sancionatorio'];
  const contableKeys=['_facturas_extra','_acuerdo_pago','_acuerdo_dia','_acuerdo_solicitud','_acuerdo_notificacion','_acuerdo_corte','_fac_sol_eval','_fac_sol_eval_ref','_fac_sol_pub','_fac_sol_pub_ref','_fac_sol_venc','_fac_sol_pago','_fac_tra_enabled','_fac_tra_res','_fac_tra_res_ref','_fac_tra_pub','_fac_tra_pub_ref','_fac_tra_venc','_fac_tra_pago','_persuasivo_fecha','_persuasivo_venc','_coactivo_traslado','_enviar_coactivo'];
  const segKeys=['_conceptos_seg','_etapa_seg','_fecha_seg','_obs_seg'];
  if(!has('control'))copyKeys(controlKeys);
  if(!has('persona')){copyKeys(personaKeys);['pn','pj','ec','qd','pi','pi_emp','apo','aut'].forEach(copyDir);}
  if(!has('detalle')){out._detalle_notas=prev._detalle_notas;out._detalle_general=prev._detalle_general;}
  if(!has('info_tec'))out._info_tecnica_items=prev._info_tecnica_items;
  if(!has('contable'))copyKeys(contableKeys);
  if(!has('normativa'))out._actos_admin=prev._actos_admin;
  if(!has('seguimiento'))copyKeys(segKeys);
  if(!has('actividades'))out.tasks=prev.tasks;
  if(!has('campos'))Object.keys(prev).filter(k=>k.startsWith('f_')).forEach(k=>{out[k]=prev[k];});
  return out;
}
function esSoloLectura(){
  if(typeof esMantenimientoActivo==='function'&&esMantenimientoActivo())return true;
  if(esModoCiudadano())return true;
  if(esJurisdiccional())return true;
  if(esModoContratista())return true;
  if(esModoResponsable())return !responsablePuedeVerRegistro();
  return false;
}
function esMantenimientoActivo(){
  return !!(typeof mantenimientoEstado!=='undefined'&&mantenimientoEstado&&mantenimientoEstado.activo);
}
/** Bloquea mutaciones cuando el modo mantenimiento está activo. Devuelve true si hay que abortar. */
function guardMantenimientoSoloConsulta(msg){
  if(!esMantenimientoActivo())return false;
  if(typeof notif==='function')notif(msg||'Modo mantenimiento: solo consulta. No se pueden modificar datos ni adjuntar archivos.','err');
  return true;
}
window.guardMantenimientoSoloConsulta=guardMantenimientoSoloConsulta;
function normalizeMantenimiento(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  return{
    activo:!!raw.activo,
    restableceAt:String(raw.restableceAt||raw.restablece||'').trim(),
    mensaje:String(raw.mensaje||'').trim(),
    por:String(raw.por||'').trim(),
    desde:String(raw.desde||'').trim()
  };
}
function fmtMantenimientoRestablece(iso){
  const s=String(iso||'').trim();
  if(!s)return'—';
  const d=new Date(s);
  if(isNaN(d.getTime()))return s.replace('T',' ').slice(0,16);
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());
}
function aplicarModoMantenimientoUI(){
  const on=esMantenimientoActivo();
  document.body.classList.toggle('modo-mantenimiento',on);
  const ban=document.getElementById('mant-banner');
  if(ban){
    if(on){
      const when=fmtMantenimientoRestablece(mantenimientoEstado.restableceAt);
      const extra=mantenimientoEstado.mensaje?(' · '+mantenimientoEstado.mensaje):'';
      ban.innerHTML='🛠️ <strong>Modo mantenimiento</strong> — solo consulta. Restablecimiento estimado: <strong>'+escAttr(when)+'</strong>'+escAttr(extra)+
        (typeof esAdministrador==='function'&&esAdministrador()?' <button type="button" class="btn bsm mant-ok" style="margin-left:10px;background:#fff;color:#7c2d12;border:none" onclick="showTab(\'cfg\');showCfgTab(\'listas\')">Configurar</button>':'');
    }else ban.innerHTML='';
  }
  if(document.body.classList.contains('sesion-activa')&&typeof aplicarVisibilidadTabsSesion==='function'){
    aplicarVisibilidadTabsSesion();
  }
  if(on&&document.body.classList.contains('sesion-activa')){
    const pg=document.querySelector('.pg.on');
    const cur=pg&&pg.id?pg.id.slice(3):'';
    const ok=esAdministrador()?(['con','cfg','cons','ciudadano'].includes(cur)):(['con','cons','ciudadano'].includes(cur));
    if(cur&&cur!=='login'&&!ok&&typeof showTab==='function')showTab(esModoCiudadano()?'ciudadano':'con');
  }
}
function setMantenimientoEstadoLocal(data){
  mantenimientoEstado=normalizeMantenimiento(data);
  aplicarModoMantenimientoUI();
}
function getDeptoOperativo(){
  if(esJurisdiccional())return deptoCfg||'guaviare';
  if(esModoResponsable())return deptoCfg||'guaviare';
  if(esSecretaria()||esModoOficinaDeguv()||esModoCiudadano())return 'guaviare';
  return deptoActivo;
}
function nombreDeptoOperativo(){const d=DEPTOS.find(x=>x.id===getDeptoOperativo());return d?d.munKey:'Guaviare';}
function labelDepartamento(id){
  const d=DEPTOS.find(x=>x.id===id);
  return d?d.munKey:(id||'');
}
function labelDepto(id){
  if(id==='admin')return 'Administrador';
  const of=OFICINAS_DEGUV.find(x=>x.id===id);
  if(of)return of.nombre;
  if(id==='secretaria')return 'Secretaría DEGUV';
  if(id==='ciudadano')return 'Consulta ciudadana';
  const d=DEPTOS.find(x=>x.id===id);
  return d?d.nombre:(id||'');
}
function getAllResponsables(){
  const set=new Set();
  const encargados=new Set();
  Object.values(cfgByDepto||{}).forEach(c=>migrateInstructoresList(c.instructores).forEach(i=>{
    if(i.nombre&&i.activo!==false){
      if(i.rol==='encargado_depto')encargados.add(i.nombre);
      else if(i.rol!=='encargado_oficina')set.add(i.nombre);
    }
  }));
  exps.forEach(e=>(e.tasks||[]).forEach(t=>{if(t.responsable&&!encargados.has(t.responsable))set.add(t.responsable);}));
  (actividadesLibres||[]).forEach(t=>{if(t.responsable&&!encargados.has(t.responsable))set.add(t.responsable);});
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function instructorEsAsignableActividad(ins){
  return !!(ins&&ins.activo!==false&&String(ins.nombre||'').trim()&&ins.rol!=='encargado_oficina'&&ins.rol!=='encargado_depto');
}
function getContratistasAsignables(deptoId){
  return getInstructoresActivos(deptoId||getDeptoOperativo()).filter(instructorEsAsignableActividad).map(i=>i.nombre).filter(Boolean);
}
function getContratistasAsignablesTodos(){
  const set=new Set();
  const encargados=new Set();
  Object.values(cfgByDepto||{}).forEach(c=>migrateInstructoresList(c.instructores).forEach(i=>{
    if(i.nombre&&i.activo!==false&&i.rol==='encargado_depto')encargados.add(i.nombre);
  }));
  DEPTOS.forEach(d=>getContratistasAsignables(d.id).forEach(n=>set.add(n)));
  exps.forEach(e=>(e.tasks||[]).forEach(t=>{if(t.responsable&&!encargados.has(t.responsable))set.add(t.responsable);}));
  (actividadesLibres||[]).forEach(t=>{if(t.responsable&&!encargados.has(t.responsable))set.add(t.responsable);});
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function getResponsablesForTrasladoActividad(expId,taskId){
  const e=getExpById(expId);
  const t=getTaskAny(expId,taskId);
  if(e&&t&&taskEsAtenderPqrs(t,e))return getResponsablesNcaDeguv();
  const depto=(t&&(t.depto||(e&&e._depto)))||deptoActivo;
  return getContratistasAsignables(depto);
}
function esTareaDelEncargado(t,deptoId){
  if(!t||!t.responsable)return false;
  const enc=getEncargadoDepto(deptoId||t.depto||deptoActivo);
  return !!enc&&t.responsable===enc;
}
function getActDeptRespFilter(){
  const sel=document.getElementById('act-dept-resp-sel');
  if(!sel||!esVistaActividadesDepto())return null;
  const v=sel.value;
  if(v==='__all__')return null;
  return v||getEncargadoDepto(deptoActivo)||null;
}
function ensureEncargadoActivo(){
  if(esModoResponsable()||esJurisdiccional())return;
  const enc=getEncargadoDepto(deptoActivo);
  if(enc){
    responsableActivo=enc;
    try{localStorage.setItem('sst_responsable',enc);}catch(e){}
  }
}
// INST_ROLES → js/constants.js
function migrateInstructoresList(arr){
  return (arr||[]).map((item,i)=>{
    if(typeof item==='string')return{id:'ins_'+String(i)+'_'+String(item).replace(/\W/g,'').slice(0,20),nombre:item,email:'',rol:'contratista',activo:true,regSecciones:[],oficinas:[]};
    const o={...item};
    if(!o.id)o.id='ins_'+(o.nombre||'x').replace(/\W/g,'').slice(0,16)+'_'+i;
    if(!o.email)o.email='';
    if(!o.rol)o.rol=o.rol==='responsable_depto'?'encargado_depto':(o.rol||'contratista');
    if(o.activo==null)o.activo=true;
    if(!Array.isArray(o.regSecciones))o.regSecciones=[];
    if(!Array.isArray(o.oficinas))o.oficinas=[];
    return o;
  });
}
function getDefaultEncargadosGlobal(){
  return{
    departamentos:{guaviare:{nombre:'',email:''},guainia:{nombre:'',email:''},vaupes:{nombre:'',email:''}},
    oficinas:{guaviare:{nombre:'',email:''},oap_deguv:{nombre:'',email:''},rn_deguv:{nombre:'',email:''},admin_deguv:{nombre:'',email:''},ds_deguv:{nombre:'',email:''}},
    secretaria:{nombre:'',email:''}
  };
}
function normalizeEncargadosGlobal(v){
  const d=getDefaultEncargadosGlobal();
  if(!v||typeof v!=='object')return d;
  ['departamentos','oficinas'].forEach(k=>{
    if(v[k])Object.keys(d[k]).forEach(id=>{
      if(v[k][id])d[k][id]={nombre:String(v[k][id].nombre||''),email:String(v[k][id].email||'').toLowerCase().trim()};
    });
  });
  if(v.secretaria)d.secretaria={nombre:String(v.secretaria.nombre||''),email:String(v.secretaria.email||'').toLowerCase().trim()};
  syncEncargadoNcaGlobalSlots(d);
  return d;
}
function syncEncargadoNcaGlobalSlots(eg){
  if(!eg||!eg.departamentos||!eg.oficinas)return;
  const dep=eg.departamentos.guaviare||{nombre:'',email:''};
  const ofi=eg.oficinas.guaviare||{nombre:'',email:''};
  const src=dep.nombre?dep:(ofi.nombre?ofi:{nombre:'',email:''});
  eg.departamentos.guaviare={nombre:src.nombre,email:src.email};
  eg.oficinas.guaviare={nombre:src.nombre,email:src.email};
}
function setEncargadoNcaUnificado(campo,val){
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  ['departamentos','oficinas'].forEach(grupo=>{
    if(!encargadosGlobal[grupo].guaviare)encargadosGlobal[grupo].guaviare={nombre:'',email:''};
    encargadosGlobal[grupo].guaviare[campo]=campo==='email'?String(val||'').toLowerCase().trim():String(val||'').trim();
  });
}
function upsertInstructorEncargado(deptoId,nombre,email,rol,oficinas){
  if(!deptoId||!nombre)return;
  const c=cfgByDepto[deptoId];
  if(!c)return;
  c.instructores=migrateInstructoresList(c.instructores||[]);
  email=String(email||'').toLowerCase().trim();
  let ins=c.instructores.find(i=>email&&String(i.email||'').toLowerCase()===email);
  if(!ins)ins=c.instructores.find(i=>agendaNorm(i.nombre)===agendaNorm(nombre));
  if(!ins){ins={id:'ins_'+Date.now(),nombre,email,rol,activo:true,regSecciones:[],oficinas:[]};c.instructores.push(ins);}
  else{ins.nombre=nombre;if(email)ins.email=email;ins.activo=true;}
  ins.rol=rol;
  if(rol==='encargado_depto')c.instructores.forEach((x,j)=>{if(x!==ins&&x.rol==='encargado_depto')x.rol='contratista';});
  if(Array.isArray(oficinas))ins.oficinas=oficinas.slice();
}
function removeEncargadoInstructorDepto(deptoId){
  const c=cfgByDepto[deptoId];
  if(!c)return;
  c.instructores=migrateInstructoresList(c.instructores||[]);
  c.instructores=c.instructores.filter(ins=>ins.rol!=='encargado_depto');
}
function removeEncargadoInstructorOficina(oficinaId){
  const c=cfgByDepto.guaviare;
  if(!c)return;
  c.instructores=migrateInstructoresList(c.instructores||[]);
  for(let i=c.instructores.length-1;i>=0;i--){
    const ins=c.instructores[i];
    if(ins.rol!=='encargado_oficina')continue;
    const ofs=ins.oficinas||[];
    if(!ofs.includes(oficinaId))continue;
    if(ofs.length<=1)c.instructores.splice(i,1);
    else ins.oficinas=ofs.filter(x=>x!==oficinaId);
  }
}
function encargadoSlotTieneData(data){
  return !!(data&&String(data.nombre||'').trim());
}
function syncEncargadosGlobalToInstructores(){
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  const nca=encargadosGlobal.departamentos.guaviare;
  if(encargadoSlotTieneData(nca)){
    upsertInstructorEncargado('guaviare',nca.nombre,nca.email,'encargado_depto',['guaviare']);
  }else{
    removeEncargadoInstructorDepto('guaviare');
  }
  Object.entries(encargadosGlobal.oficinas||{}).forEach(([ofiId,data])=>{
    if(ofiId==='guaviare'){
      if(encargadoSlotTieneData(data))upsertInstructorEncargado('guaviare',data.nombre,data.email,'encargado_depto',['guaviare']);
      return;
    }
    if(encargadoSlotTieneData(data))upsertInstructorEncargado('guaviare',data.nombre,data.email,'encargado_oficina',[ofiId]);
    else removeEncargadoInstructorOficina(ofiId);
  });
  ['guainia','vaupes'].forEach(deptoId=>{
    const data=encargadosGlobal.departamentos[deptoId];
    if(encargadoSlotTieneData(data))upsertInstructorEncargado(deptoId,data.nombre,data.email,'encargado_depto',[]);
    else removeEncargadoInstructorDepto(deptoId);
  });
  const sec=encargadosGlobal.secretaria;
  if(encargadoSlotTieneData(sec))upsertInstructorEncargado('guaviare',sec.nombre,sec.email,'encargado_oficina',['secretaria']);
  else removeEncargadoInstructorOficina('secretaria');
}
function rolEsEncargadoModulo(rol){
  rol=String(rol||'').trim();
  if(rol==='secretaria')return{type:'secretaria'};
  if(DEPTOS.some(d=>d.id===rol))return{type:'departamento',id:rol};
  if(OFICINAS_DEGUV.some(o=>o.id===rol&&o.id!=='guaviare'&&o.id!=='secretaria'))return{type:'oficina',id:rol};
  return null;
}
function syncEncargadosDesdeUsuariosAutorizados(){
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  const vacio={nombre:'',email:''};
  encargadosGlobal.secretaria={...vacio};
  DEPTOS.forEach(d=>{encargadosGlobal.departamentos[d.id]={...vacio};});
  Object.keys(encargadosGlobal.oficinas||{}).forEach(id=>{encargadosGlobal.oficinas[id]={...vacio};});
  (_usuariosCache||[]).filter(u=>u.activo!==false).forEach(u=>{
    const mod=rolEsEncargadoModulo(u.rol);
    if(!mod)return;
    const data={nombre:String(u.nombre||'').trim(),email:String(u.email||'').trim().toLowerCase()};
    if(!data.email)return;
    if(mod.type==='secretaria')encargadosGlobal.secretaria=data;
    else if(mod.type==='departamento')encargadosGlobal.departamentos[mod.id]=data;
    else if(mod.type==='oficina')encargadosGlobal.oficinas[mod.id]=data;
  });
  syncEncargadoNcaGlobalSlots(encargadosGlobal);
  syncEncargadosGlobalToInstructores();
}
function syncResponsablesDesdeUsuariosAutorizados(){
  (_usuariosCache||[]).filter(u=>u.rol==='responsables').forEach(u=>{
    const email=String(u.email||'').trim().toLowerCase();
    const nombre=String(u.nombre||'').trim();
    const deptoId=String(u.deptoResponsable||'').trim();
    if(!email||!deptoId||!cfgByDepto[deptoId])return;
    const c=cfgByDepto[deptoId];
    c.instructores=migrateInstructoresList(c.instructores||[]);
    const ins=c.instructores.find(i=>String(i.email||'').toLowerCase()===email);
    if(u.activo===false){
      if(ins&&ins.rol==='contratista')ins.activo=false;
      return;
    }
    if(!nombre||!ins)return;
    if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return;
    ins.nombre=nombre;
    ins.email=email;
    ins.activo=true;
  });
}
function upsertInstructorFromUsuario(u){
  if(!u||u.activo===false||u.rol!=='responsables')return false;
  const email=String(u.email||'').trim().toLowerCase();
  const nombre=String(u.nombre||'').trim();
  const deptoId=String(u.deptoResponsable||'').trim();
  if(!email||!nombre||!deptoId||!cfgByDepto[deptoId])return false;
  const c=cfgByDepto[deptoId];
  c.instructores=migrateInstructoresList(c.instructores||[]);
  let ins=c.instructores.find(i=>String(i.email||'').toLowerCase()===email);
  if(ins){
    if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return false;
    ins.nombre=nombre;
    ins.email=email;
    ins.activo=true;
    return true;
  }
  c.instructores.push({
    id:'ins_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    nombre,email,rol:'contratista',activo:true,regSecciones:[],oficinas:[]
  });
  return true;
}
function removeInstructorByEmail(email,deptoId){
  email=String(email||'').trim().toLowerCase();
  deptoId=String(deptoId||'').trim();
  if(!email||!deptoId||!cfgByDepto[deptoId])return false;
  const c=cfgByDepto[deptoId];
  c.instructores=migrateInstructoresList(c.instructores||[]);
  const antes=c.instructores.length;
  c.instructores=c.instructores.filter(i=>{
    if(i.rol==='encargado_depto'||i.rol==='encargado_oficina')return true;
    return String(i.email||'').trim().toLowerCase()!==email;
  });
  return c.instructores.length!==antes;
}
async function aplicarSyncUsuariosAutorizados(opts){
  opts=opts||{};
  syncEncargadosDesdeUsuariosAutorizados();
  syncResponsablesDesdeUsuariosAutorizados();
  syncCfgToStore();
  _saveLSLocal();
  if(!opts.skipSave&&window._db&&window._fsSetDoc){
    try{await saveFirestore();}catch(err){console.error('Error sincronizando encargados/responsables:',err);}
  }
  if(!opts.silent&&(document.getElementById('cpg-listas')&&document.getElementById('cpg-listas').classList.contains('on')))renderListasCfg();
  if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
}
function findInstructorByEmail(email){
  email=String(email||'').toLowerCase().trim();
  if(!email)return null;
  for(const deptoId of DEPTOS.map(d=>d.id)){
    const list=migrateInstructoresList((cfgByDepto[deptoId]||{}).instructores||[]);
    const hit=list.find(i=>String(i.email||'').toLowerCase()===email);
    if(hit)return{...hit,deptoId};
  }
  return null;
}
function resolveRolFromEmail(email){
  email=String(email||'').toLowerCase().trim();
  if(!email)return null;
  if(email===ADMIN_GMAIL.toLowerCase())return{rolId:'admin',responsable:''};
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  if(encargadosGlobal.secretaria.email===email)return{rolId:'secretaria',responsable:''};
  for(const [ofiId,data] of Object.entries(encargadosGlobal.oficinas||{})){
    if(data&&data.email===email)return{rolId:ofiId,responsable:''};
  }
  for(const [depId,data] of Object.entries(encargadosGlobal.departamentos||{})){
    if(data&&data.email===email)return{rolId:depId,responsable:''};
  }
  const ins=findInstructorByEmail(email);
  if(ins){
    if(ins.rol==='encargado_depto'&&DEPTOS.some(d=>d.id===ins.deptoId))return{rolId:ins.deptoId,responsable:''};
    if(ins.rol==='encargado_oficina'&&(ins.oficinas||[]).length)return{rolId:ins.oficinas[0],responsable:''};
    return{rolId:'responsables',responsable:ins.nombre||''};
  }
  return null;
}
function getInstructoresOficina(oficinaId){
  return getInstructoresActivos('guaviare').filter(i=>{
    const ofs=i.oficinas||[];
    return ofs.length&&ofs.includes(oficinaId)&&instructorEsAsignableActividad(i);
  });
}
function getEncargadoOficina(oficinaId){
  oficinaId=oficinaId||deptoActivo;
  const ins=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_oficina'&&(i.oficinas||[]).includes(oficinaId));
  if(ins)return ins.nombre;
  if(oficinaId==='guaviare'){
    const encDept=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_depto'&&String(i.nombre||'').trim());
    if(encDept)return encDept.nombre;
  }
  if(oficinaSinApoyo(oficinaId)){
    const solo=getInstructoresOficina(oficinaId)[0];
    if(solo)return solo.nombre;
  }
  return '';
}
function esPqrsSecretaria(e){
  return !!(e&&esTramitePqrs(e._tramite));
}
function pqrsPendienteTraslado(e){
  return !!(e&&e._pqrs_pendiente_traslado);
}
function esDirectorDsDeguv(){return deptoActivo==='ds_deguv';}
function puedeGestionarPendientesTraslado(){
  return esSecretaria()||esDirectorDsDeguv()||esAdministrador();
}
function puedeVerFiltroPorTrasladarOficina(){
  // Paleta «Por trasladar»: solo Director y Secretaría (no RN / OAP / Admin oficina)
  return esDirectorDsDeguv()||esSecretaria();
}
function puedeTrasladarPqrsInicial(e){
  if(!e||!esPqrsSecretaria(e)||!pqrsPendienteTraslado(e)||pqrsEstaCerrada(e))return false;
  return esSecretaria()||esDirectorDsDeguv()||esAdministrador();
}
function puedeMarcarPqrsPrioritariaDs(e){
  if(!e||!pqrsPendienteTraslado(e)||pqrsEstaCerrada(e))return false;
  return esSecretaria()||esDirectorDsDeguv()||esAdministrador();
}
function normalizePqrsOficinaFields(e){
  if(!e)return e;
  if(!e._pqrs_historial||!Array.isArray(e._pqrs_historial))e._pqrs_historial=[];
  if(!Array.isArray(e._pqrs_comentarios))e._pqrs_comentarios=[];
  if(!Array.isArray(e._pqrs_avisos_oficina))e._pqrs_avisos_oficina=[];
  if(!Array.isArray(e._pqrs_respuesta_soportes))e._pqrs_respuesta_soportes=[];
  if(e._pqrs_informativa===undefined)e._pqrs_informativa=false;
  if(pqrsPendienteTraslado(e)&&!e._pqrs_oficina)e._pqrs_oficina='secretaria';
  if(!e._pqrs_estado_oficina&&e._pqrs_oficina&&!pqrsPendienteTraslado(e))e._pqrs_estado_oficina='pendiente';
  if(e._pqrs_oficina&&esTramitePqrs(e._tramite)&&!e._radicado_secretaria)e._radicado_secretaria=true;
  if(e.f_f2)e.f_f2=normMedioRecepcionPqrs(e.f_f2);
  return e;
}

// ── Recursos (enlaces externos + biblioteca) ───────────────────────────────────
function getAuthEmailNorm(){
  const e=window._usuarioActual&&window._usuarioActual.email;
  return e?String(e).trim().toLowerCase():'';
}
function getEncargadoOficinaEmail(oficinaId){
  oficinaId=oficinaId||getRecursosOficinaActiva();
  const ins=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_oficina'&&(i.oficinas||[]).includes(oficinaId));
  if(ins&&ins.email)return String(ins.email).trim().toLowerCase();
  if(oficinaId==='guaviare'){
    const encDept=getInstructoresCfg('guaviare').find(i=>i.activo!==false&&i.rol==='encargado_depto'&&String(i.nombre||'').trim());
    if(encDept&&encDept.email)return String(encDept.email).trim().toLowerCase();
  }
  return '';
}
function esEncargadoOficinaUsuario(oficinaId){
  const email=getAuthEmailNorm();
  if(!email)return false;
  const enc=getEncargadoOficinaEmail(oficinaId);
  return !!(enc&&enc===email);
}
function esEncargadoDeptoUsuario(deptoId){
  if(esAdministrador()||esAdminFirestore())return true;
  const u=window._usuarioActual;
  if(!u)return false;
  const rol=String(u.rol||'').trim();
  return rol===deptoId&&DEPTOS.some(d=>d.id===deptoId);
}
function puedeVerRecursos(){
  if(esModoCiudadano()||esJurisdiccional())return false;
  return document.body.classList.contains('sesion-activa');
}
function getRecursosDeptoContext(){
  if(DEPTOS.some(d=>d.id===deptoActivo))return deptoActivo;
  if(esModoResponsable()||esModoContratista()){
    const d=window._usuarioActual&&window._usuarioActual.deptoResponsable;
    if(d&&DEPTOS.some(x=>x.id===d))return d;
    return 'guaviare';
  }
  if(esModoOficinaDeguv()||esSecretaria()||esNcaDeguv())return 'guaviare';
  if(rolSesion==='admin')return deptoActivo&&DEPTOS.some(d=>d.id===deptoActivo)?deptoActivo:'guaviare';
  return 'guaviare';
}
function getRecursosOficinaActiva(){
  if(esModoOficinaDeguv())return deptoActivo;
  if(esSecretaria())return 'secretaria';
  if(esAdministrador()){
    const sel=getSelDeptoVal();
    if(esModuloOficina(sel))return sel;
    if(sel==='secretaria')return 'secretaria';
    if(sel==='guaviare'||DEPTOS.some(d=>d.id===sel))return 'guaviare';
    return '';
  }
  if(esNcaDeguv()&&!esModoResponsable())return 'guaviare';
  if(esModoResponsable()||esModoContratista()){
    const email=getAuthEmailNorm();
    if(email){
      for(let i=0;i<DEPTOS.length;i++){
        const deptoId=DEPTOS[i].id;
        const ins=(getInstructoresActivos(deptoId)||[]).find(function(inst){
          if(inst.activo===false)return false;
          return String(inst.email||'').trim().toLowerCase()===email&&(inst.oficinas||[]).length>0;
        });
        if(ins&&ins.oficinas[0])return ins.oficinas[0];
      }
    }
    const dr=window._usuarioActual&&window._usuarioActual.deptoResponsable;
    if(!dr||dr==='guaviare')return 'guaviare';
    return '';
  }
  return '';
}
function oficinasBibliotecaVisibles(){
  return OFICINAS_DEGUV.filter(o=>o.id!=='guaviare'||true);
}
function normalizeRecursosScopeItem(item){
  if(!item||typeof item!=='object')return item;
  if(!item.scope&&item.oficinaId){
    item.scope='oficina';
    item.scopeId=item.oficinaId;
  }
  if(item.scope==='oficina'&&item.scopeId&&!item.oficinaId)item.oficinaId=item.scopeId;
  if(item.scope==='sistema'&&!item.scopeId)item.scopeId='sistema';
  return item;
}
function normalizeRecursosEnlacesList(arr){
  return(Array.isArray(arr)?arr:[]).map(normalizeRecursosScopeItem);
}
function normalizeBibliotecaReposList(arr){
  return(Array.isArray(arr)?arr:[]).map(normalizeRecursosScopeItem);
}
function getOficinasAsignadasSesion(){
  const set=new Set();
  const email=getAuthEmailNorm();
  if(email){
    for(let i=0;i<DEPTOS.length;i++){
      const deptoId=DEPTOS[i].id;
      const ins=(getInstructoresActivos(deptoId)||[]).find(function(inst){
        if(inst.activo===false)return false;
        return String(inst.email||'').trim().toLowerCase()===email;
      });
      if(ins&&(ins.oficinas||[]).length)(ins.oficinas||[]).forEach(function(o){set.add(o);});
    }
  }
  return Array.from(set);
}
function getRecursosOficinasVisiblesSesion(){
  const set=new Set();
  if(esModoOficinaDeguv())set.add(deptoActivo);
  if(esSecretaria())set.add('secretaria');
  if(esNcaDeguv())set.add('guaviare');
  if(esAdministrador()){
    const o=getRecursosOficinaActiva();
    if(o)set.add(o);
  }
  if(esModoResponsable()||esModoContratista()){
    getOficinasAsignadasSesion().forEach(function(o){set.add(o);});
    const dr=window._usuarioActual&&window._usuarioActual.deptoResponsable;
    if(!dr||dr==='guaviare')set.add('guaviare');
  }
  return Array.from(set);
}
function recursosScopeVisibleParaSesion(scope,scopeId){
  if(scope==='sistema')return true;
  if(scope==='departamento')return scopeId===getRecursosDeptoContext();
  if(scope==='oficina')return getRecursosOficinasVisiblesSesion().includes(scopeId);
  return false;
}
function recursosItemVisiblePorScope(item){
  if(!item)return false;
  const n=normalizeRecursosScopeItem(item);
  return recursosScopeVisibleParaSesion(n.scope,n.scopeId);
}
function recursosItemCompartidoVisible(item){
  const comp=Array.isArray(item&&item.compartidoCon)?item.compartidoCon:[];
  if(!comp.length)return false;
  const vis=getRecursosOficinasVisiblesSesion();
  return comp.some(function(id){return vis.includes(id);});
}
function recursosItemVisibleParaSesion(item){
  if(!item||item.activo===false)return false;
  if(recursosItemVisiblePorScope(item))return true;
  return recursosItemCompartidoVisible(item);
}
function getRecursosOficinasParaCompartir(item){
  const n=normalizeRecursosScopeItem(item||{});
  const ownerOfi=n.scope==='oficina'?n.scopeId:'';
  return OFICINAS_DEGUV.filter(function(o){return o.id!==ownerOfi;});
}
function labelRecursosCompartidoCon(ids){
  const arr=Array.isArray(ids)?ids:[];
  if(!arr.length)return '';
  return arr.map(labelOficina).join(', ');
}
function puedeCompartirRecursosItem(item){
  if(!item)return false;
  const n=normalizeRecursosScopeItem(item);
  return puedeEditarRecursosItem(n.scope,n.scopeId);
}
function archivosRepoCompartidosConmigo(repo){
  const vis=getRecursosOficinasVisiblesSesion();
  return (repo&&repo.archivosCompartidos||[]).filter(function(a){
    return (a.compartidoCon||[]).some(function(id){return vis.includes(id);});
  });
}
function getRecursosScopeAutoSesion(){
  if(esModoOficinaDeguv())return {scope:'oficina',scopeId:deptoActivo};
  if(esSecretaria())return {scope:'oficina',scopeId:'secretaria'};
  if(esNcaDeguv())return {scope:'oficina',scopeId:'guaviare'};
  if(deptoActivo==='guainia'||deptoActivo==='vaupes')return {scope:'departamento',scopeId:deptoActivo};
  if(DEPTOS.some(function(d){return d.id===deptoActivo;})&&deptoActivo!=='guaviare')return {scope:'departamento',scopeId:deptoActivo};
  const o=getRecursosOficinaActiva();
  if(o)return {scope:'oficina',scopeId:o};
  return {scope:'departamento',scopeId:getRecursosDeptoContext()};
}
function recursosMuestraSelectorAmbito(){
  return (esAdministrador()||esAdminFirestore())&&(esAdminModoGlobal()||!!window._recursosCfgForm);
}
function labelRecursosScopeContexto(scope,scopeId){
  if(scope==='oficina')return labelOficina(scopeId);
  if(scope==='departamento')return labelDepartamento(scopeId);
  return labelRecursosScope(scope,scopeId);
}
function puedeEditarRecursosItem(scope,scopeId){
  if(esAdministrador()||esAdminFirestore())return true;
  if(scope==='sistema')return false;
  if(scope==='departamento'){
    if(scopeId==='guaviare'&&esNcaDeguv())return true;
    return esEncargadoDeptoUsuario(scopeId);
  }
  if(scope==='oficina'){
    if(esEncargadoOficinaUsuario(scopeId))return true;
    if(scopeId==='guaviare'&&esEncargadoDeptoUsuario('guaviare'))return true;
    return false;
  }
  return false;
}
function puedeCrearRecursosEnScope(scope,scopeId){
  return puedeEditarRecursosItem(scope,scopeId);
}
function getRecursosScopesCreablesSesion(){
  if(recursosMuestraSelectorAmbito()){
    const out=[{scope:'sistema',scopeId:'sistema'}];
    DEPTOS.forEach(function(d){out.push({scope:'departamento',scopeId:d.id});});
    OFICINAS_DEGUV.forEach(function(o){out.push({scope:'oficina',scopeId:o.id});});
    return out;
  }
  const auto=getRecursosScopeAutoSesion();
  if(puedeEditarRecursosItem(auto.scope,auto.scopeId))return [auto];
  return [];
}
function labelRecursosScope(scope,scopeId){
  if(scope==='sistema')return 'Sistema (todos)';
  if(scope==='departamento')return 'Depto: '+labelDepartamento(scopeId);
  if(scope==='oficina')return 'Oficina: '+labelOficina(scopeId);
  return String(scope||'')+': '+String(scopeId||'');
}
function puedeEditarRecursosEnlaces(scope,scopeId){
  return puedeEditarRecursosItem(scope,scopeId);
}
function puedeEditarBiblioteca(scope,scopeId){
  return puedeEditarRecursosItem(scope,scopeId);
}
function puedeEditarBibliotecaLegacy(oficinaId){
  return puedeEditarBiblioteca('oficina',oficinaId);
}
function recursosCreadoPorAdmin(item){
  return !!(item&&item.createdByAdmin===true);
}
function puedeEliminarRecursosItem(item){
  if(!item)return false;
  if(esAdministrador()||esAdminFirestore())return true;
  if(recursosCreadoPorAdmin(item))return false;
  const scope=item.scope||'oficina';
  const scopeId=item.scopeId||(scope==='oficina'?item.oficinaId:'');
  return puedeEditarRecursosItem(scope,scopeId);
}
function bibliotecaDriveDisponible(deptoCtx){
  const d=deptoCtx||getRecursosDeptoContext();
  if(d==='guainia')return !!(recursosConfig&&String(recursosConfig.guainiaDriveRoot||'').trim());
  if(d==='vaupes')return !!(recursosConfig&&String(recursosConfig.vaupesDriveRoot||'').trim());
  return d==='guaviare'||esModoOficinaDeguv()||esSecretaria()||esNcaDeguv()||esModoResponsable()||esModoContratista();
}
function getBibliotecaDriveRootId(deptoCtx){
  const d=deptoCtx||getRecursosDeptoContext();
  const folderFromUrl=function(url){
    const m=String(url||'').match(/\/folders\/([^/?#]+)/);
    return m?m[1]:'';
  };
  if(d==='guainia'&&recursosConfig&&recursosConfig.guainiaDriveRoot){
    const id=folderFromUrl(recursosConfig.guainiaDriveRoot);
    if(id)return id;
  }
  if(d==='vaupes'&&recursosConfig&&recursosConfig.vaupesDriveRoot){
    const id=folderFromUrl(recursosConfig.vaupesDriveRoot);
    if(id)return id;
  }
  return typeof DRIVE_ROOT_RECURSOS_ID!=='undefined'?DRIVE_ROOT_RECURSOS_ID:'';
}

// Pestañas visibles por rol / módulo activo (menú principal)
function getTabsVisiblesSesion(){
  const G='gmail-ofi',S='sec',P='pqrs-ofi',R='reg',A='act',Gnd='agenda',C='con',Rec='rec',Co='cons',Cfg='cfg',Ciu='ciudadano';
  // Mantenimiento: solo consulta (admin también Config para apagar el modo)
  if(typeof esMantenimientoActivo==='function'&&esMantenimientoActivo()){
    if(esModoCiudadano())return[Ciu];
    if(esAdministrador())return[C,Co,Cfg];
    if(esJurisdiccional())return[C,Co];
    return[C];
  }
  const deptTabs=[G,R,A,Gnd,Rec,C,Co,Cfg];
  if(esModoCiudadano())return[Ciu];
  if(esJurisdiccional())return[C,Co];
  if(esSecretaria())return[G,S,P,C,Rec];
  if(esModoOficinaDeguv())return[G,P,C,Rec];
  if(esModoResponsable()||esModoContratista())return[G,A,C,Rec];
  if(esAdministrador()){
    const sel=getSelDeptoVal();
    if(sel==='secretaria')return[G,S,P,C,Rec];
    if(esModuloOficina(sel))return[G,P,C,Rec];
    if(sel==='jurisdiccional')return[C,Co];
    if(sel==='responsables')return[G,A,C,Rec];
    if(sel==='ciudadano')return[Ciu];
    if(sel==='admin')return[R,G,S,P,A,Gnd,C,Rec,Co,Cfg];
    if(DEPTOS.some(d=>d.id===sel))return deptTabs;
  }
  if(DEPTOS.some(d=>d.id===deptoActivo))return deptTabs;
  return[C];
}
function puedeVerTabSesion(tabId){
  return getTabsVisiblesSesion().includes(tabId);
}
function aplicarVisibilidadTabsSesion(){
  const visibles=new Set(getTabsVisiblesSesion());
  document.querySelectorAll('.tabsi .tab').forEach(el=>{
    const key=el.id?el.id.replace(/^tab-/,''):'';
    const show=visibles.has(key);
    el.classList.toggle('tab-sesion-on',show);
    el.classList.toggle('tab-sesion-off',!show);
    if(!show)el.classList.remove('on','tab-selected');
    el.style.display='';
  });
  const pgOn=document.querySelector('.pg.on');
  if(pgOn&&pgOn.id&&pgOn.id.startsWith('pg-')){
    const cur=pgOn.id.slice(3);
    if(cur!=='login'&&!visibles.has(cur)){
      // Preferir la pestaña "home" del rol (no el primer ítem del menú = Correos)
      let first='';
      if(typeof esModoResponsable==='function'&&esModoResponsable()&&visibles.has('act'))first='act';
      else if(typeof esSecretaria==='function'&&esSecretaria()&&visibles.has('sec'))first='sec';
      else if(typeof esModoOficinaDeguv==='function'&&esModoOficinaDeguv()&&visibles.has('pqrs-ofi'))first='pqrs-ofi';
      else if(typeof esModoCiudadano==='function'&&esModoCiudadano()&&visibles.has('ciudadano'))first='ciudadano';
      else first=Array.from(visibles)[0]||'con';
      if(typeof showTab==='function')showTab(first);
    }
  }
}