// =============================================================================
// configuracion.js — CONFIGURACION
// Dependencias de runtime resueltas desde el scope global.
// Cargar antes del script principal de index.html.
// =============================================================================
// CONFIGURACIÓN
// ================================================================
// CFG_PANELS → js/constants.js
function instructoresPanelSub(){
  if(esAdminModoGlobal())return 'Encargados de módulo: se asignan en Usuarios autorizados (rol del departamento u oficina). Aquí solo vincule responsables/contratistas con permisos de registro — use «+» o «Registrar nuevo usuario».';
  if(esEncargadoDepartamentalUsuarios())return 'Seleccione responsables registrados en «Usuarios autorizados» para su departamento, o regístrelos allí antes de vincularlos aquí.';
  return 'Seleccione responsables previamente registrados para su departamento.';
}
function instructorUsuarioLinkRow(i,ins,deptoId){
  const dep=jsStr(deptoId);
  const cur=String(ins.email||'').trim().toLowerCase();
  const u=getUsuarioAutorizadoByEmail(cur);
  const nombreMostrar=u?(u.nombre||u.email):(ins.nombre||'—');
  let h='<div class="inst-usuario-link" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:1;min-width:280px">';
  h+='<select onchange="SST.onInstructorUsuarioEmailSelect(\''+dep+'\','+i+',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;min-width:220px;background:var(--sf);color:var(--tx)">'+usuariosAutorizadosSelectOptions(cur,'',deptoId)+'</select>';
  h+='<span class="inst-nombre-ro" style="font-weight:600;font-size:12px;padding:4px 0">'+escAttr(nombreMostrar)+'</span>';
  const alert=instructorUsuarioAlertHtml(cur,deptoId);
  if(alert)h+=alert;
  h+='</div>';
  return h;
}
function instructorRegSecBoxes(i,ins,deptoId){
  deptoId=deptoId||deptoCfg;
  if(ins.rol!=='contratista')return '';
  if(!puedeEditarRegSecContratistaCfg())return '';
  const secs=Array.isArray(ins.regSecciones)?ins.regSecciones:[];
  const dep=jsStr(deptoId);
  return '<div class="inst-secciones"><div style="font-size:11px;color:var(--tx2);margin-bottom:4px;font-weight:600">Secciones editables en Registro</div>'+
    Object.entries(REG_EDIT_SECS).map(([k,lbl])=>{
      const checked=secs.includes(k);
      return '<label style="display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;font-size:11px;cursor:pointer"><input type="checkbox"'+(checked?' checked':'')+' onchange="toggleInstructorRegSecDepto(\''+dep+'\','+i+',\''+k+'\',this.checked)"> '+lbl+'</label>';
    }).join('')+
  '</div>';
}
function instructorEncargadoMeta(i,ins){
  if(ins.rol==='encargado_depto'){
    const lbl=deptoCfg==='guaviare'?'NCA DEGUV — trámites ambientales y PQRSD Guaviare':labelDepto(deptoCfg);
    return '<div style="margin:4px 0 8px 32px;padding:8px 10px;background:var(--bll);border-radius:var(--r);border:1px solid var(--bl);font-size:11px;color:var(--tx2)">'+
      '<strong>Departamento a cargo:</strong> '+escAttr(lbl)+
      (esAdministrador()?' · Use el selector superior para cambiar de departamento u oficina.':'')+
    '</div>';
  }
  if(ins.rol==='encargado_oficina'){
    const ofs=ins.oficinas||[];
    const ofiLbl=ofs.length?ofs.map(labelOficina).join(', '):'— sin oficina —';
    return '<div style="margin:4px 0 8px 32px;padding:8px 10px;background:var(--bll);border-radius:var(--r);border:1px solid var(--bl);font-size:11px;color:var(--tx2)">'+
      '<strong>Oficina a cargo:</strong> '+escAttr(ofiLbl)+
    '</div>'+instructorOficinaEncargadoSelect(i,ins);
  }
  return '';
}
function instructorOficinaEncargadoSelect(i,ins){
  if(!puedeGestionarEncargadosCfg()||deptoCfg!=='guaviare')return '';
  const cur=(ins.oficinas||[])[0]||'';
  return '<div style="margin:0 0 8px 32px"><label style="font-size:11px;color:var(--tx2);font-weight:600">Oficina a cargo</label>'+
    '<select onchange="setEncargadoOficinaCargo('+i+',this.value)" style="display:block;margin-top:4px;border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;background:var(--sf);color:var(--tx);min-width:220px">'+
    '<option value="">— Seleccione oficina —</option>'+
    OFICINAS_DEGUV.filter(o=>o.id!=='guaviare').map(o=>'<option value="'+o.id+'"'+(cur===o.id?' selected':'')+'>'+escAttr(o.nombre)+'</option>').join('')+
    '</select></div>';
}
function setEncargadoOficinaCargo(i,oficinaId){
  if(!puedeGestionarEncargadosCfg()){notif('Solo el administrador puede asignar encargados de oficina','err');return;}
  cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
  const ins=cfg.instructores[i];if(!ins||ins.rol!=='encargado_oficina')return;
  oficinaId=String(oficinaId||'').trim();
  enforceUniqueEncargadoOficina(i,oficinaId);
  ins.oficinas=oficinaId?[oficinaId]:[];
  if(!oficinaId)ins.rol='contratista';
  syncInstructoresToEncargadosGlobal();
  saveLS();renderListasCfg();poblarSelResponsable();
}
function instructorRowReadonly(ins){
  const rolLbl=INST_ROLES[ins.rol]||ins.rol;
  let extra='';
  if(ins.rol==='encargado_depto')extra=' · '+labelDepto(deptoCfg);
  else if(ins.rol==='encargado_oficina'&&(ins.oficinas||[]).length)extra=' · '+(ins.oficinas||[]).map(labelOficina).join(', ');
  return '<div class="inst-row-wrap"><div class="inst-row readonly" style="opacity:.85">'+
    '<span style="font-weight:600;min-width:140px">'+escAttr(ins.nombre||'')+'</span>'+
    '<span style="font-size:11px;color:var(--tx2)">'+escAttr(rolLbl)+extra+'</span>'+
    '<span class="bdg" style="font-size:10px;background:var(--sf2);color:var(--tx3)">Solo administrador</span>'+
  '</div></div>';
}
function instructorRowEditable(i,ins,deptoId){
  deptoId=deptoId||deptoCfg||getDeptoOperativo();
  const dep=jsStr(deptoId);
  return '<div class="inst-row-wrap"><div class="inst-row'+(ins.activo===false?' inactive':'')+'">'+
    instructorUsuarioLinkRow(i,ins,deptoId)+
    '<select onchange="editInstructorDepto(\''+dep+'\','+i+',\'activo\',this.value===\'1\')" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;background:var(--sf);color:var(--tx)">'+
      '<option value="1"'+(ins.activo!==false?' selected':'')+'>Activo</option>'+
      '<option value="0"'+(ins.activo===false?' selected':'')+'>Inactivo</option>'+
    '</select>'+
    '<button class="btn bsm bic bd2" onclick="delInstructorDepto(\''+dep+'\','+i+')" title="Eliminar">✕</button>'+
  '</div>'+instructorRegSecBoxes(i,ins,deptoId)+instructorOficinasBoxes(i,ins,deptoId)+'</div>';
}
function instructoresCardBody(){
  let h='<div class="cfcard">';
  if(esVistaEncargadosModuloCfg()||esAdministrador()){
    DEPTOS.forEach(d=>{
      const rows=getInstructoresContratistasDepto(d.id);
      h+='<div style="font-size:11px;font-weight:700;color:var(--tx2);margin:'+(d.id===DEPTOS[0].id?'0':'14px')+' 0 8px">'+escAttr(labelDepartamento(d.id))+(d.id==='guaviare'?' · NCA DEGUV':'')+'</div>';
      if(rows.length){
        rows.forEach(({ins,i})=>{h+=instructorRowEditable(i,ins,d.id);});
      }else{
        h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">Sin responsables registrados.</div>';
      }
    });
  }else{
    cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
    h+=cfg.instructores.map((ins,i)=>{
      if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')return '';
      if(typeof instructorEsVinculoReal==='function'&&!instructorEsVinculoReal(ins))return '';
      if(instructorEditableContratista(ins))return instructorRowEditable(i,ins,deptoCfg);
      return '';
    }).filter(Boolean).join('');
  }
  if(puedeGestionarContratistasCfg()){
    h+='<div class="cfadd" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
    if(esAdministrador()||esAdminModoGlobal()){
      h+='<select id="cfi-instructores-depto" class="depto-sel" style="min-width:140px;padding:6px 8px;font-size:12px" title="Departamento del nuevo responsable" onchange="SST.refreshInstructoresEmailSelect()">'+
        DEPTOS.map(d=>'<option value="'+d.id+'">'+escAttr(labelDepto(d.id))+'</option>').join('')+
        '</select>';
    }
    h+='<select id="cfi-instructores-email" style="flex:1;min-width:220px;border:1px solid var(--bd);border-radius:5px;padding:6px 8px;font-size:12px;background:var(--sf);color:var(--tx)">'+usuariosAutorizadosSelectOptions('','',getDeptoResponsablesSelect())+'</select>'+
      '<button type="button" class="btn bsm bp" onclick="addInstructor()">+</button>';
    if(esAdminFirestore()){
      h+='<button type="button" class="btn bsm" onclick="SST.abrirPanelUsuariosAutorizados()">+ Registrar nuevo usuario</button>';
    }else if(esEncargadoDepartamentalUsuarios()){
      h+='<button type="button" class="btn bsm" onclick="SST.abrirPanelUsuariosAutorizados()">+ Registrar responsable autorizado</button>';
    }else{
      h+='<span style="font-size:11px;color:var(--tx2);width:100%">Para nuevos responsables, solicite al administrador o al encargado del departamento registrarlo en Responsables autorizados.</span>';
    }
    if(!_usuariosCache.filter(u=>usuarioEsResponsableDepto(u,getDeptoResponsablesSelect())).length)h+='<span style="font-size:11px;color:var(--or);width:100%">No hay responsables autorizados para este departamento.</span>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}
function addInstructor(){
  if(!puedeGestionarContratistasCfg()){notif('No tiene permiso para agregar personas','err');return;}
  const sel=document.getElementById('cfi-instructores-email');
  const email=sel?String(sel.value||'').trim().toLowerCase():'';
  if(!email){notif('Seleccione un usuario autorizado de la lista','err');return;}
  const u=getUsuarioAutorizadoByEmail(email);
  if(!u){notif('Solicite al administrador registrar este responsable en Usuarios autorizados','err');return;}
  if(u.rol!=='responsables'){notif('Solo usuarios con rol Responsables pueden agregarse','err');return;}
  let targetDepto=deptoCfg||getDeptoOperativo();
  const sd=document.getElementById('cfi-instructores-depto');
  if(esAdministrador()&&sd)targetDepto=sd.value||targetDepto;
  else if(esAdminModoGlobal()&&sd)targetDepto=sd.value||targetDepto;
  else targetDepto=getDeptoResponsablesSelect();
  if(!usuarioEsResponsableDepto(u,targetDepto)){notif('Este responsable está asignado a '+labelDepartamento(u.deptoResponsable||'otro departamento')+', no a '+labelDepartamento(targetDepto),'err');return;}
  withCfgDepto(targetDepto,()=>{
    cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
    if(cfg.instructores.some(i=>String(i.email||'').trim().toLowerCase()===email)){notif('Ese usuario ya está como responsable en '+labelDepto(targetDepto),'err');return;}
    cfg.instructores.push({id:'ins_'+Date.now(),nombre:u.nombre||email,email,rol:'contratista',activo:true,regSecciones:[],oficinas:[]});
  });
  if(sel)sel.value='';
  void persistCfgDepto(targetDepto).then(function(){
    renderListasCfg();poblarSelResponsable();
    if(typeof refreshViewsAfterRemoteDataChange==='function')refreshViewsAfterRemoteDataChange();
    notif('Responsable agregado en '+labelDepto(targetDepto),'ok');
  });
}
function toggleInstructorRegSec(i,key,checked){
  if(!puedeEditarRegSecContratistaCfg())return;
  cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
  const ins=cfg.instructores[i];if(!ins||ins.rol!=='contratista')return;
  if(!Array.isArray(ins.regSecciones))ins.regSecciones=[];
  if(checked){if(!ins.regSecciones.includes(key))ins.regSecciones.push(key);}
  else ins.regSecciones=ins.regSecciones.filter(k=>k!==key);
  saveLS();
}
function editInstructor(i,k,v){
  cfg.instructores=migrateInstructoresList(cfg.instructores||[]);
  const ins=cfg.instructores[i];if(!ins)return;
  const esEnc=ins.rol==='encargado_depto'||ins.rol==='encargado_oficina';
  if(esEnc&&!puedeGestionarEncargadosCfg()){notif('Solo el administrador puede editar encargados','err');renderListasCfg();return;}
  if(!esEnc&&!instructorEditableContratista(ins)&&!esAdminModoGlobal()){notif('Solo puede editar responsables de su departamento','err');renderListasCfg();return;}
  if(k==='nombre'){
    if(ins.rol==='contratista'){renderListasCfg();return;}
    const nv=String(v||'').trim();
    if(!nv){notif('El nombre no puede quedar vacío','err');return;}
    if(cfg.instructores.some((x,j)=>j!==i&&(x.nombre||'').toLowerCase()===nv.toLowerCase())){notif('Ya existe ese nombre','err');return;}
    ins.nombre=nv;
  }else if(k==='email'){
    const em=String(v||'').trim().toLowerCase();
    if(ins.rol==='contratista'){
      if(!em){notif('Seleccione un responsable autorizado de su departamento','err');renderListasCfg();return;}
      const u=getUsuarioAutorizadoByEmail(em);
      if(!u){notif('Solicite al administrador registrar este responsable en Usuarios autorizados','err');renderListasCfg();return;}
      if(u.rol!=='responsables'){notif('Solo usuarios con rol Responsables','err');renderListasCfg();return;}
      const deptEdit=deptoCfg||getDeptoOperativo();
      if(!usuarioEsResponsableDepto(u,deptEdit)){notif('Este responsable no pertenece a '+labelDepartamento(deptEdit),'err');renderListasCfg();return;}
      if(cfg.instructores.some((x,j)=>j!==i&&String(x.email||'').trim().toLowerCase()===em)){notif('Ese usuario ya está registrado como responsable','err');renderListasCfg();return;}
      ins.email=em;
      ins.nombre=u.nombre||em;
    }else{
      if(!esAdminModoGlobal()&&!esRolDepartamentalCfg())return;
      ins.email=em;
    }
  }else if(k==='rol'){
    notif('Los encargados se configuran en «Encargados por módulo»','err');
    renderListasCfg();
    return;
  }else if(k==='activo'){
    ins.activo=!!v;
    const em=String(ins.email||'').trim().toLowerCase();
    if(em&&ins.rol==='contratista'&&typeof setUsuarioFirestoreActivo==='function'){
      const dep=deptoCfg||getDeptoOperativo()||'';
      // Sincroniza el acceso real (usuarios/{email}.activo) para que no quede solo en cfg local.
      void setUsuarioFirestoreActivo(em,!!v,{fromInstructor:true,silent:false,deptoResponsable:dep,nombre:ins.nombre||''});
    }
  }
  if(ins.rol==='encargado_depto'||ins.rol==='encargado_oficina')syncInstructoresToEncargadosGlobal();
  saveLS();poblarSelResponsable();
  if(k==='activo'||k==='email'||esAdminModoGlobal())renderListasCfg();
}
function cfgSectionFold(title,sub,body,open){
  return '<details class="form-section cfg-fold"'+(open?' open':'')+'><summary class="form-section-hdr">'+title+'</summary><div class="form-section-body">'+
    (sub?'<div class="cfs" style="margin-top:0">'+sub+'</div>':'')+body+'</div></details>';
}
function cfgSimpleListBody(key){
  const arr=cfg[key]||[];
  if(cfgEsSoloLectura()){
    return '<div class="cfcard"><ul class="cfl">'+arr.map(v=>'<li class="cfi"><span>'+escAttr(v)+'</span></li>').join('')+'</ul></div>';
  }
  return '<div class="cfcard"><ul class="cfl">'+
    arr.map((v,i)=>'<li class="cfi"><span>'+v+'</span><div class="fx" style="gap:2px">'+
      (i>0?'<button class="btn bsm bic" onclick="mvItem(\''+key+'\','+i+',-1)">▲</button>':'<span style="width:24px"></span>')+
      (i<(arr.length-1)?'<button class="btn bsm bic" onclick="mvItem(\''+key+'\','+i+',1)">▼</button>':'<span style="width:24px"></span>')+
      '<button class="btn bsm bic bd2" onclick="delItem(\''+key+'\','+i+')">✕</button>'+
    '</div></li>').join('')+
  '</ul><div class="cfadd"><input type="text" id="cfi-'+key+'" placeholder="Agregar..." onkeydown="if(event.key===\'Enter\')addItem(\''+key+'\')"><button class="btn bsm bp" onclick="addItem(\''+key+'\')">+</button></div></div>';
}
function cfgCardReadonlyStrings(arr){
  return '<div class="cfcard"><ul class="cfl">'+arr.map(v=>'<li class="cfi"><span>'+escAttr(v)+'</span></li>').join('')+'</ul></div>';
}
function renderCfg(){
  updateDeptoUI();
  updateCfgTabsDepto();
  if(!puedeGestionarUsuariosAutorizados()){
    const uPg=document.getElementById('cpg-usuarios');
    if(uPg&&uPg.classList.contains('on'))showCfgTab('listas');
  }
  const cfgSub=document.querySelector('#pg-cfg > .ssub');
  if(cfgSub){
    cfgSub.textContent=esAdminModoGlobal()
      ?'Gestiona listas, trámites y responsables — vista global de administrador.'
      :esCfgDeptoSoloResponsablesPersonas()
        ?'Gestiona responsables y personas/usuarios de '+labelDepto(getRolEfectivo())+'.'
        :esRolDepartamentalCfg()
          ?'Gestiona listas, trámites y responsables de '+labelDepto(getRolEfectivo())+'.'
          :'Gestiona listas, trámites y responsables del departamento activo.';
  }
  const rb=document.getElementById('cfg-restrict-banner');
  if(rb)rb.innerHTML='';
  updateCfgTabsDepto();
  renderListasCfg();
  const tabAud=document.getElementById('ctab-auditoria');
  if(tabAud)tabAud.style.display=esAdministrador()?'':'none';
  const tabUsu=document.getElementById('ctab-usuarios');
  if(tabUsu){
    tabUsu.style.display=puedeGestionarUsuariosAutorizados()?'':'none';
    tabUsu.textContent=esEncargadoDepartamentalUsuarios()?'👥 Responsables autorizados':'👥 Usuarios autorizados';
  }
}
function saveCfgFoldState(){
  const open={};
  document.querySelectorAll('#cfg-panels details.cfg-fold').forEach((d,i)=>{
    if(d.open){
      const tit=d.querySelector('summary');
      open[tit?tit.textContent.trim():('idx'+i)]=true;
    }
  });
  return open;
}
function restoreCfgFoldState(open){
  if(!open)return;
  document.querySelectorAll('#cfg-panels details.cfg-fold').forEach((d,i)=>{
    const tit=d.querySelector('summary');
    const key=tit?tit.textContent.trim():('idx'+i);
    if(open[key])d.open=true;
  });
}
function encargadosGlobalCardBody(){
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  const nca=encargadosGlobal.departamentos.guaviare||{nombre:'',email:''};
  const mkView=(tit,data)=>{
    data=data||{nombre:'',email:''};
    return '<div class="encargado-slot"><div class="encargado-slot-k">'+escAttr(tit)+'</div>'+
      (encargadoSlotTieneData(data)?'<div style="font-size:13px;font-weight:600;margin-top:4px">'+escAttr(data.nombre)+'</div><div style="font-size:11px;color:var(--tx2);margin-top:2px">'+escAttr(data.email)+'</div>':'<div style="font-size:11px;color:var(--tx3);margin-top:4px">Sin encargado — registre un usuario autorizado con el rol de este módulo</div>')+
      '</div>';
  };
  let h='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px;padding:8px 10px;background:var(--bll);border-radius:var(--r);border:1px solid var(--bl)">Vista informativa. Los encargados se asignan en <strong>Usuarios autorizados</strong> al elegir el rol del módulo (Secretaría, NCA DEGUV, Guainía, Vaupés u oficinas DEGUV). No es necesario registrarlos aquí por separado.</div>';
  h+='<div style="margin-bottom:8px"><button type="button" class="btn bsm bp" onclick="SST.abrirPanelUsuariosAutorizados()">➕ Registrar usuario autorizado</button></div>';
  h+='<div style="font-size:11px;font-weight:700;color:var(--tx2);margin:8px 0 6px">NCA DEGUV — trámites ambientales y PQRSD Guaviare</div><div class="encargados-grid">';
  h+=mkView('NCA DEGUV',nca);
  h+='</div><div style="font-size:11px;font-weight:700;color:var(--tx2);margin:8px 0 6px">Departamentos regionales</div><div class="encargados-grid">';
  h+=mkView('Guainía',encargadosGlobal.departamentos.guainia);
  h+=mkView('Vaupés',encargadosGlobal.departamentos.vaupes);
  h+='</div><div style="font-size:11px;font-weight:700;color:var(--tx2);margin:8px 0 6px">Oficinas DEGUV</div><div class="encargados-grid">';
  OFICINAS_DEGUV.filter(o=>o.id!=='secretaria'&&o.id!=='guaviare').forEach(o=>{h+=mkView(o.nombre,encargadosGlobal.oficinas[o.id]);});
  h+='</div><div style="font-size:11px;font-weight:700;color:var(--tx2);margin:8px 0 6px">Secretaría</div><div class="encargados-grid">';
  h+=mkView('Secretaría DEGUV',encargadosGlobal.secretaria);
  h+='</div>';
  return h;
}
function setEncargadoGlobal(grupo,id,campo,val){
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  if((grupo==='departamentos'||grupo==='oficinas')&&id==='guaviare'){setEncargadoNcaUnificado(campo,val);return;}
  if(grupo==='secretaria'){
    if(!encargadosGlobal.secretaria)encargadosGlobal.secretaria={nombre:'',email:''};
    encargadosGlobal.secretaria[campo]=campo==='email'?String(val||'').toLowerCase().trim():String(val||'').trim();
    return;
  }
  if(!encargadosGlobal[grupo])encargadosGlobal[grupo]={};
  if(!encargadosGlobal[grupo][id])encargadosGlobal[grupo][id]={nombre:'',email:''};
  encargadosGlobal[grupo][id][campo]=campo==='email'?String(val||'').toLowerCase().trim():String(val||'').trim();
}
function limpiarEncargadoSlot(grupo,id){
  if(grupo==='secretaria'){
    encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
    encargadosGlobal.secretaria={nombre:'',email:''};
  }else if((grupo==='departamentos'||grupo==='oficinas')&&id==='guaviare'){
    setEncargadoNcaUnificado('nombre','');
    setEncargadoNcaUnificado('email','');
  }else{
    setEncargadoGlobal(grupo,id,'nombre','');
    setEncargadoGlobal(grupo,id,'email','');
  }
  guardarEncargadosGlobal();
}
async function guardarEncargadosGlobal(){
  if(!puedeGestionarEncargadosCfg()){notif('Solo el administrador puede guardar encargados','err');return;}
  encargadosGlobal=normalizeEncargadosGlobal(encargadosGlobal);
  syncEncargadosGlobalToInstructores();
  _saveLSLocal();
  if(window._db&&window._fsSetDoc){
    updateSyncIndicator('syncing');
    try{
      await saveFirestore();
      auditCfgChange('Encargados globales');
      renderListasCfg();
      notif('Encargados guardados','ok');
    }catch(err){
      console.error(err);
      updateSyncIndicator('error');
      notif('Error al guardar encargados en Firestore','err');
    }
  }else{
    auditCfgChange('Encargados globales');
    renderListasCfg();
    notif('Encargados guardados (local)','ok');
  }
}
function renderListasCfg(){
  const el=document.getElementById('cfg-panels');if(!el)return;
  const open=saveCfgFoldState();
  ensureUsuariosFirestoreCache().then(()=>{
    syncEncargadosDesdeUsuariosAutorizados();
    const ro=cfgEsSoloLectura();
    let html='';
    if(esVistaEncargadosModuloCfg())html+=cfgSectionFold('Encargados por módulo','Asignación automática según el rol en Usuarios autorizados (Secretaría, NCA, departamentos y oficinas DEGUV).',encargadosGlobalCardBody(),false)+
      cfgSectionFold('Migración a Firestore','Subir datos locales actuales a la nube (multi-usuario).', '<div class="cfcard"><p style="font-size:12px;color:var(--tx2);margin:0 0 10px">Use este botón una sola vez para migrar el contenido de localStorage a Firestore.</p><button type="button" class="btn bsm bp" onclick="migrarLocalStorageAFirestore()">☁ Migrar localStorage → Firestore</button></div>',false);
    if(esAdministrador()||esAdminFirestore())html+=cfgSectionFold('Modo mantenimiento','Congela la aplicación para ajustes: los funcionarios pueden entrar y consultar, pero no diligenciar ni adjuntar. Indique fecha y hora de restablecimiento.',mantenimientoCfgCardBody(),false);
    html+=CFG_PANELS.map(p=>cfgSectionFold(p.title,p.key==='instructores'?instructoresPanelSub():'',p.key==='instructores'?instructoresCardBody():cfgSimpleListBody(p.key),false)).join('');
    if(esAdministrador()||esAdminFirestore())html+=cfgSectionFold('Recursos (enlaces y biblioteca)','Enlaces externos y repositorios Drive por ámbito: sistema, departamento u oficina.',typeof recursosCfgCardBody==='function'?recursosCfgCardBody():'',false);
    html+=cfgSectionFold('Actividades predeterminadas','Opciones reutilizables al asignar o entregar actividades (con o sin expediente).',ro?cfgCardReadonlyStrings(cfg.actividadesPred||[]):actPredCardBody(),false)+
      cfgSectionFold('Tipos de factura','Opciones disponibles al añadir facturas en Información contable.',ro?cfgCardReadonlyStrings(cfg.tiposFactura||[]):tipoFacturaCardBody(),false)+
      cfgSectionFold('Tipos de actos administrativos','Actos registrables en Normatividad / legal.',ro?cfgCardReadonlyStrings((cfg.tiposActoAdmin||[]).map(t=>t.nombre||t)):tipoActoAdminCardBody(),false);
    el.innerHTML=html;
    restoreCfgFoldState(open);
    if(typeof chatRefreshContactsIfOpen==='function')chatRefreshContactsIfOpen();
  });
}
function _mantDtLocalValue(iso){
  const s=String(iso||'').trim();
  if(!s)return'';
  const d=new Date(s);
  if(isNaN(d.getTime()))return'';
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function mantenimientoCfgCardBody(){
  const m=typeof normalizeMantenimiento==='function'?normalizeMantenimiento(mantenimientoEstado): (mantenimientoEstado||{});
  const on=!!m.activo;
  return '<div class="cfcard">'+
    '<p style="font-size:12px;color:var(--tx2);margin:0 0 12px;line-height:1.45">Al activarlo, toda la app queda en <strong>solo consulta</strong> (sin adjuntar, diligenciar ni cambiar estados). Úselo cuando entre en operación o haya fallas/ajustes para evitar conflictos. Los usuarios verán un aviso con la fecha y hora de restablecimiento.</p>'+
    '<div class="fg" style="margin-bottom:10px">'+
    '<div class="fld"><label>Estado</label><label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:4px"><input type="checkbox" id="cfg-mant-activo" '+(on?'checked':'')+'> Activar modo mantenimiento</label></div>'+
    '<div class="fld"><label for="cfg-mant-restablece">Fecha y hora de restablecimiento</label><input type="datetime-local" id="cfg-mant-restablece" value="'+escAttr(_mantDtLocalValue(m.restableceAt))+'"></div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:12px"><label for="cfg-mant-msg">Mensaje opcional (visible en el aviso)</label><input type="text" id="cfg-mant-msg" maxlength="180" placeholder="Ej. Ajustes de sincronización Drive" value="'+escAttr(m.mensaje||'')+'"></div>'+
    (on?'<div style="font-size:12px;color:#7c2d12;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 10px;margin-bottom:12px">🛠️ Mantenimiento <strong>activo</strong>'+(m.restableceAt?' · Restablece: '+escAttr((typeof fmtMantenimientoRestablece==='function'?fmtMantenimientoRestablece(m.restableceAt):m.restableceAt)):'')+(m.por?' · Por: '+escAttr(m.por):'')+'</div>':'')+
    '<div class="fx" style="gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn bsm bp mant-ok" onclick="guardarModoMantenimientoCfg(true)">Activar / actualizar</button>'+
    '<button type="button" class="btn bsm mant-ok" onclick="guardarModoMantenimientoCfg(false)">Desactivar</button>'+
    '</div></div>';
}
async function guardarModoMantenimientoCfg(activar){
  if(!(esAdministrador()||esAdminFirestore())){notif('Solo el administrador puede cambiar el modo mantenimiento','err');return;}
  const chk=document.getElementById('cfg-mant-activo');
  const dtEl=document.getElementById('cfg-mant-restablece');
  const msgEl=document.getElementById('cfg-mant-msg');
  const wantOn=activar===true?true:(activar===false?false:!!(chk&&chk.checked));
  const dtLocal=dtEl?String(dtEl.value||'').trim():'';
  let restableceAt='';
  if(dtLocal){
    const d=new Date(dtLocal);
    if(isNaN(d.getTime())){notif('Fecha/hora de restablecimiento inválida','err');return;}
    restableceAt=d.toISOString();
  }
  if(wantOn&&!restableceAt){notif('Indique la fecha y hora estimada de restablecimiento','err');return;}
  const por=(window._usuarioActual&&(window._usuarioActual.nombre||window._usuarioActual.email))||responsableActivo||rolSesion||'admin';
  const payload={
    activo:wantOn,
    restableceAt:wantOn?restableceAt:'',
    mensaje:msgEl?String(msgEl.value||'').trim():'',
    por:String(por).trim(),
    desde:wantOn?(mantenimientoEstado&&mantenimientoEstado.activo&&mantenimientoEstado.desde?mantenimientoEstado.desde:new Date().toISOString()):''
  };
  if(typeof persistMantenimientoFirestore!=='function'){notif('No se pudo guardar (Firestore)','err');return;}
  const ok=await persistMantenimientoFirestore(payload);
  if(ok){
    notif(wantOn?'Modo mantenimiento activado — solo consulta hasta el restablecimiento':'Modo mantenimiento desactivado','ok');
    if(typeof updateDeptoUI==='function')updateDeptoUI();
    renderListasCfg();
  }
}
window.guardarModoMantenimientoCfg=guardarModoMantenimientoCfg;
function tipoActoAdminCardBody(){
  const tipos=cfg.tiposActoAdmin||[];
  return '<div class="cfcard"><ul class="cfl cfl-vertical">'+
    tipos.map((t,i)=>'<li class="cfi"><input type="text" value="'+(t.nombre||'')+'" onchange="editTipoActo('+i+',\'nombre\',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx);width:100%">'+
    '<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" '+(t.tieneVencimiento?'checked':'')+' onchange="editTipoActo('+i+',\'tieneVencimiento\',this.checked)"> Con vencimiento</label>'+
    '<div class="fx" style="justify-content:flex-end"><button class="btn bsm bic bd2" onclick="delTipoActo('+i+')">✕</button></div></li>').join('')+
  '</ul><div class="cfadd"><input type="text" id="tipoacto-new" placeholder="Nuevo tipo de acto..." onkeydown="if(event.key===\'Enter\')addTipoActo()"><button class="btn bsm bp" onclick="addTipoActo()">+</button></div></div>';
}
function tipoActoAdminCardHtml(){return cfgSectionFold('Tipos de actos administrativos','',tipoActoAdminCardBody(),false);}
function addTipoActo(){
  if(guardCfgEditGeneral())return;
  if(!cfg.tiposActoAdmin)cfg.tiposActoAdmin=[];
  const v=document.getElementById('tipoacto-new').value.trim();
  if(!v){notif('Escribe un tipo de acto','err');return;}
  if(cfg.tiposActoAdmin.some(t=>(t.nombre||t)===v)){notif('Ya existe','err');return;}
  cfg.tiposActoAdmin.push({nombre:v,tieneVencimiento:true});
  document.getElementById('tipoacto-new').value='';
  saveLS();renderListasCfg();notif('Tipo agregado','ok');
}
function editTipoActo(i,k,v){if(guardCfgEditGeneral())return;const t=cfg.tiposActoAdmin[i];if(!t)return;t[k]=v;saveLS();}
function delTipoActo(i){
  if(guardCfgEditGeneral())return;
  confirmEliminar({message:'¿Eliminar este tipo de acto administrativo?'},()=>{
    cfg.tiposActoAdmin.splice(i,1);saveLS();renderListasCfg();
  });
}
function tipoFacturaCardBody(){
  const tipos=cfg.tiposFactura||[];
  return '<div class="cfcard"><ul class="cfl">'+
    tipos.map((v,i)=>'<li class="cfi"><input type="text" value="'+v+'" onchange="editTipoFactura('+i+',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx);width:100%"><div class="fx" style="gap:2px">'+
      '<button class="btn bsm bic bd2" onclick="delTipoFactura('+i+')">✕</button></div></li>').join('')+
  '</ul><div class="cfadd"><input type="text" id="tipofac-new" placeholder="Nuevo tipo de factura..." onkeydown="if(event.key===\'Enter\')addTipoFactura()"><button class="btn bsm bp" onclick="addTipoFactura()">+</button></div></div>';
}
function tipoFacturaCardHtml(){return cfgSectionFold('Tipos de factura','',tipoFacturaCardBody(),false);}
function addTipoFactura(){if(guardCfgEditGeneral())return;if(!cfg.tiposFactura)cfg.tiposFactura=[];const inp=document.getElementById('tipofac-new');const v=inp.value.trim();if(!v){notif('Escribe un tipo de factura','err');return;}if(cfg.tiposFactura.includes(v)){notif('Ya existe','err');return;}cfg.tiposFactura.push(v);inp.value='';saveLS();renderListasCfg();}
function editTipoFactura(i,v){if(guardCfgEditGeneral())return;if(!cfg.tiposFactura)return;cfg.tiposFactura[i]=v.trim();saveLS();}
function delTipoFactura(i){
  if(guardCfgEditGeneral())return;
  confirmEliminar({message:'¿Eliminar este tipo de factura?'},()=>{
    if(!cfg.tiposFactura)return;cfg.tiposFactura.splice(i,1);saveLS();renderListasCfg();
  });
}
function actPredCardBody(){
  const acts=cfg.actividadesPred||[];
  if(!cfg.actRegistroMap||typeof cfg.actRegistroMap!=='object')cfg.actRegistroMap={};
  if(!cfg.actFirmaMap||typeof cfg.actFirmaMap!=='object')cfg.actFirmaMap={};
  if(!cfg.actOficioMap||typeof cfg.actOficioMap!=='object')cfg.actOficioMap={};
  if(!cfg.actPlazoMap||typeof cfg.actPlazoMap!=='object')cfg.actPlazoMap={};
  if(!cfg.actPlazoUnidadMap||typeof cfg.actPlazoUnidadMap!=='object')cfg.actPlazoUnidadMap={};
  const tipoOpts=function(sel){
    return [['','— Registro —'],['concepto','Concepto'],['factura','Factura'],['acto','Acto / resolución'],['ninguno','Solo actividad']].map(function(o){
      return '<option value="'+o[0]+'"'+(sel===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('');
  };
  const unidadOpts=function(sel){
    return [['habiles','Días hábiles'],['dias','Días calendario']].map(function(o){
      return '<option value="'+o[0]+'"'+(sel===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('');
  };
  return '<div class="cfcard"><div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Sirve para entregas <strong>con expediente/PQRSD</strong> y <strong>sin expediente</strong>. El tipo de <strong>Registro</strong> (solo con expediente) define qué datos se piden (concepto → Seguimiento, factura → Información contable, acto → Normatividad). «Firma Director» envía la actividad al flujo Por imprimir → Por firmar → Por notificar. «N° oficio» exige el consecutivo de documentación externa al entregar (mismo control que respuestas PQRSD). <strong>Plazo</strong>: días por defecto al asignar la actividad (el encargado puede ajustarlos).</div><ul class="cfl">'+
    acts.map((v,i)=>{
      const tipo=cfg.actRegistroMap[v]||'';
      const firma=!!cfg.actFirmaMap[v];
      const oficio=!!cfg.actOficioMap[v];
      const plazo=cfg.actPlazoMap[v]!=null?cfg.actPlazoMap[v]:'';
      const plazoU=cfg.actPlazoUnidadMap[v]||'habiles';
      return '<li class="cfi" style="flex-wrap:wrap;align-items:flex-start">'+
      '<input type="text" value="'+escAttr(v)+'" onchange="editActPred('+i+',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx);flex:1;min-width:140px">'+
      '<select onchange="editActPredRegistroTipo('+i+',this.value)" title="Destino en menú Registro" style="border:1px solid var(--bd);border-radius:5px;padding:4px 6px;font-size:11px;max-width:150px">'+tipoOpts(tipo)+'</select>'+
      '<input type="number" min="0" step="1" value="'+escAttr(plazo)+'" placeholder="Plazo" title="Días por defecto" onchange="editActPredPlazo('+i+',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 6px;font-size:11px;width:64px">'+
      '<select onchange="editActPredPlazoUnidad('+i+',this.value)" title="Tipo de días" style="border:1px solid var(--bd);border-radius:5px;padding:4px 6px;font-size:11px;max-width:120px">'+unidadOpts(plazoU)+'</select>'+
      '<label style="font-size:11px;display:flex;align-items:center;gap:4px;white-space:nowrap" title="Requiere firma del Director"><input type="checkbox" '+(firma?'checked ':'')+'onchange="editActPredRequiereFirma('+i+',this.checked)"> Firma</label>'+
      '<label style="font-size:11px;display:flex;align-items:center;gap:4px;white-space:nowrap" title="Exige N° de oficio al entregar"><input type="checkbox" '+(oficio?'checked ':'')+'onchange="editActPredRequiereOficio('+i+',this.checked)"> N° oficio</label>'+
      '<div class="fx" style="gap:2px">'+
      (i>0?'<button class="btn bsm bic" onclick="mvActPred('+i+',-1)">▲</button>':'<span style="width:24px"></span>')+
      (i<(acts.length-1)?'<button class="btn bsm bic" onclick="mvActPred('+i+',1)">▼</button>':'<span style="width:24px"></span>')+
      '<button class="btn bsm bic bd2" onclick="delActPred('+i+')">✕</button>'+
    '</div></li>';
    }).join('')+
  '</ul><div class="cfadd"><input type="text" id="actpred-new" placeholder="Nueva actividad predeterminada..." onkeydown="if(event.key===\'Enter\')addActPred()"><button class="btn bsm bp" onclick="addActPred()">+</button></div></div>';
}
function actPredCardHtml(){return cfgSectionFold('Actividades predeterminadas','',actPredCardBody(),false);}
function renderActsPredCfg(){
  const el=document.getElementById('cfg-acts-panel');if(el)el.innerHTML=actPredCardHtml();
}
function addActPred(){
  if(!cfg.actividadesPred)cfg.actividadesPred=[];
  const inp=document.getElementById('actpred-new');const v=inp.value.trim();
  if(!v){notif('Escribe una actividad','err');return;}
  if(cfg.actividadesPred.includes(v)){notif('Ya existe','err');return;}
  cfg.actividadesPred.push(v);inp.value='';saveLS();renderListasCfg();notif('Actividad agregada','ok');
}
function editActPred(i,v){
  if(!cfg.actividadesPred)return;
  const prev=cfg.actividadesPred[i];
  const nv=v.trim();
  cfg.actividadesPred[i]=nv;
  if(!cfg.actRegistroMap)cfg.actRegistroMap={};
  if(!cfg.actFirmaMap)cfg.actFirmaMap={};
  if(!cfg.actOficioMap)cfg.actOficioMap={};
  if(!cfg.actPlazoMap)cfg.actPlazoMap={};
  if(!cfg.actPlazoUnidadMap)cfg.actPlazoUnidadMap={};
  if(prev&&prev!==nv&&cfg.actRegistroMap[prev]!=null){
    cfg.actRegistroMap[nv]=cfg.actRegistroMap[prev];
    delete cfg.actRegistroMap[prev];
  }
  if(prev&&prev!==nv&&cfg.actFirmaMap[prev]!=null){
    cfg.actFirmaMap[nv]=cfg.actFirmaMap[prev];
    delete cfg.actFirmaMap[prev];
  }
  if(prev&&prev!==nv&&cfg.actOficioMap[prev]!=null){
    cfg.actOficioMap[nv]=cfg.actOficioMap[prev];
    delete cfg.actOficioMap[prev];
  }
  if(prev&&prev!==nv&&cfg.actPlazoMap[prev]!=null){
    cfg.actPlazoMap[nv]=cfg.actPlazoMap[prev];
    delete cfg.actPlazoMap[prev];
  }
  if(prev&&prev!==nv&&cfg.actPlazoUnidadMap[prev]!=null){
    cfg.actPlazoUnidadMap[nv]=cfg.actPlazoUnidadMap[prev];
    delete cfg.actPlazoUnidadMap[prev];
  }
  saveLS();
}
function editActPredRegistroTipo(i,tipo){
  if(!cfg.actividadesPred||!cfg.actividadesPred[i])return;
  if(!cfg.actRegistroMap)cfg.actRegistroMap={};
  const nom=cfg.actividadesPred[i];
  if(!tipo)delete cfg.actRegistroMap[nom];
  else cfg.actRegistroMap[nom]=tipo;
  saveLS();
}
function editActPredRequiereFirma(i,on){
  if(!cfg.actividadesPred||!cfg.actividadesPred[i])return;
  if(!cfg.actFirmaMap)cfg.actFirmaMap={};
  const nom=cfg.actividadesPred[i];
  if(on)cfg.actFirmaMap[nom]=true;
  else delete cfg.actFirmaMap[nom];
  saveLS();
}
function editActPredRequiereOficio(i,on){
  if(!cfg.actividadesPred||!cfg.actividadesPred[i])return;
  if(!cfg.actOficioMap)cfg.actOficioMap={};
  const nom=cfg.actividadesPred[i];
  if(on)cfg.actOficioMap[nom]=true;
  else delete cfg.actOficioMap[nom];
  saveLS();
}
function editActPredPlazo(i,val){
  if(!cfg.actividadesPred||!cfg.actividadesPred[i])return;
  if(!cfg.actPlazoMap)cfg.actPlazoMap={};
  const nom=cfg.actividadesPred[i];
  const n=Number(val);
  if(val===''||val===null||isNaN(n)||n<=0)delete cfg.actPlazoMap[nom];
  else cfg.actPlazoMap[nom]=n;
  saveLS();
}
function editActPredPlazoUnidad(i,val){
  if(!cfg.actividadesPred||!cfg.actividadesPred[i])return;
  if(!cfg.actPlazoUnidadMap)cfg.actPlazoUnidadMap={};
  const nom=cfg.actividadesPred[i];
  if(!val||val==='habiles')delete cfg.actPlazoUnidadMap[nom];
  else cfg.actPlazoUnidadMap[nom]=val;
  saveLS();
}
function delActPred(i){
  if(!cfg.actividadesPred)return;
  const nom=cfg.actividadesPred[i];
  cfg.actividadesPred.splice(i,1);
  if(cfg.actRegistroMap&&nom)delete cfg.actRegistroMap[nom];
  if(cfg.actFirmaMap&&nom)delete cfg.actFirmaMap[nom];
  if(cfg.actOficioMap&&nom)delete cfg.actOficioMap[nom];
  if(cfg.actPlazoMap&&nom)delete cfg.actPlazoMap[nom];
  if(cfg.actPlazoUnidadMap&&nom)delete cfg.actPlazoUnidadMap[nom];
  saveLS();renderListasCfg();notif('Eliminado','ok');
}
function mvActPred(i,d){const a=cfg.actividadesPred;if(!a)return;const n=i+d;if(n<0||n>=a.length)return;[a[i],a[n]]=[a[n],a[i]];saveLS();renderListasCfg();}
function etaPredCardBody(){
  const etas=cfg.etapasPred||[];
  return '<div class="cfcard"><ul class="cfl">'+
    etas.map((v,i)=>'<li class="cfi"><input type="text" value="'+v+'" onchange="editEtaPred('+i+',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx);width:100%"><div class="fx" style="gap:2px">'+
      (i>0?'<button class="btn bsm bic" onclick="mvEtaPred('+i+',-1)">▲</button>':'<span style="width:24px"></span>')+
      (i<(etas.length-1)?'<button class="btn bsm bic" onclick="mvEtaPred('+i+',1)">▼</button>':'<span style="width:24px"></span>')+
      '<button class="btn bsm bic bd2" onclick="delEtaPred('+i+')">✕</button>'+
    '</div></li>').join('')+
  '</ul><div class="cfadd"><input type="text" id="etapred-new" placeholder="Nueva etapa predeterminada..." onkeydown="if(event.key===\'Enter\')addEtaPred()"><button class="btn bsm bp" onclick="addEtaPred()">+</button></div></div>';
}
function etaPredCardHtml(){return cfgSectionFold('Etapas predeterminadas','',etaPredCardBody(),false);}
function renderEtapasPredCfg(){
  const el=document.getElementById('cfg-etas-panel');if(el)el.innerHTML=etaPredCardHtml();
}
function addEtaPred(){
  if(!cfg.etapasPred)cfg.etapasPred=[];
  const inp=document.getElementById('etapred-new');const v=inp.value.trim();
  if(!v){notif('Escribe una etapa','err');return;}
  if(cfg.etapasPred.includes(v)){notif('Ya existe','err');return;}
  cfg.etapasPred.push(v);inp.value='';saveLS();renderListasCfg();renderNtEtapasPred();notif('Etapa agregada','ok');
}
function editEtaPred(i,v){if(!cfg.etapasPred)return;cfg.etapasPred[i]=v.trim();saveLS();renderNtEtapasPred();}
function delEtaPred(i){if(!cfg.etapasPred)return;cfg.etapasPred.splice(i,1);saveLS();renderListasCfg();renderNtEtapasPred();notif('Eliminado','ok');}
function mvEtaPred(i,d){const a=cfg.etapasPred;if(!a)return;const n=i+d;if(n<0||n>=a.length)return;[a[i],a[n]]=[a[n],a[i]];saveLS();renderListasCfg();renderNtEtapasPred();}
function renderNtEtapasPred(){
  const box=document.getElementById('nt-etas-pred');if(!box)return;
  const etas=cfg.etapasPred||[];
  box.innerHTML=etas.length?etas.map((e,i)=>'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);padding:6px 8px"><input type="checkbox" class="nt-ep" value="'+e+'" data-ord="'+i+'"> '+e+'</label>').join(''):'<div style="font-size:12px;color:var(--tx3)">Sin etapas predeterminadas configuradas.</div>';
}
function infoTecCfgItemBody(c,i){
  const scope=String(c.tramitesScope||'all')==='selected'?'selected':'all';
  const ids=Array.isArray(c.tramitesIds)?c.tramitesIds.map(String):[];
  const trams=(cfg.tramites||[]).filter(function(t){
    return t&&t.id&&!(typeof esTramitePqrs==='function'&&esTramitePqrs(t.id));
  });
  const tramChecks=trams.length
    ?trams.map(function(t){
      const on=ids.indexOf(String(t.id))>=0;
      return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px 6px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r)">'+
        '<input type="checkbox" '+(on?'checked':'')+' '+(scope==='all'?'disabled':'')+' onchange="toggleInfoTecTramite('+i+',\''+String(t.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\',this.checked)"> '+
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(t.color||'#888')+';flex-shrink:0"></span> '+
        escAttr(t.nombre||t.id)+'</label>';
    }).join('')
    :'<div style="font-size:12px;color:var(--tx3)">No hay trámites configurados en este departamento.</div>';
  return '<div class="fg" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem">'+
    '<div class="fld"><label>Nombre</label><input type="text" value="'+(c.label||'')+'" onchange="editInfoTec('+i+',\'label\',this.value)"></div>'+
    '<div class="fld"><label>Tipo</label><select onchange="editInfoTec('+i+',\'tipo\',this.value);renderInfoTecCfg()">'+TIPO_KEYS.map(k=>'<option value="'+k+'"'+(c.tipo===k?' selected':'')+'>'+TIPOS[k].label+'</option>').join('')+'</select></div>'+
    '<div class="fld"><label>Placeholder</label><input type="text" value="'+(c.placeholder||'')+'" onchange="editInfoTec('+i+',\'placeholder\',this.value)"></div>'+
    '<div class="fld"><label>Requerido</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-top:6px"><input type="checkbox" '+(c.requerido?'checked':'')+' onchange="editInfoTec('+i+',\'requerido\',this.checked)"> Sí</label></div>'+
    '</div>'+
    (c.tipo==='seleccion'?'<div class="fld" style="margin-top:.4rem"><label>Opciones</label><input type="text" value="'+(c.opciones||'')+'" onchange="editInfoTec('+i+',\'opciones\',this.value)" placeholder="op1,op2,op3"></div>':'')+
    (c.tipo==='lista'?'<div class="fld" style="margin-top:.4rem"><label>Fuente lista</label><select onchange="editInfoTec('+i+',\'listaFuente\',this.value)">'+LISTA_FUENTES.map(f=>'<option value="'+f+'"'+(c.listaFuente===f?' selected':'')+'>'+f+'</option>').join('')+'</select></div>':'')+
    '<div style="margin-top:.65rem;padding:8px 10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
      '<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:4px">Aplica a trámites</div>'+
      '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Algunos datos técnicos solo corresponden a ciertos trámites. Elija todos o una selección.</div>'+
      '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:8px">'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="it-tram-scope-'+i+'" '+(scope==='all'?'checked':'')+' onchange="setInfoTecTramitesScope('+i+',\'all\')"> Todos los trámites</label>'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="it-tram-scope-'+i+'" '+(scope==='selected'?'checked':'')+' onchange="setInfoTecTramitesScope('+i+',\'selected\')"> Solo trámites seleccionados</label>'+
      '</div>'+
      (scope==='selected'
        ?('<div style="display:flex;flex-wrap:wrap;gap:6px;max-height:160px;overflow:auto">'+tramChecks+'</div>'+
          (ids.length?'':'<div style="font-size:11px;color:var(--or);margin-top:6px">Seleccione al menos un trámite; mientras tanto el campo se trata como «todos» al capturar.</div>'))
        :'<div style="font-size:11px;color:var(--tx3)">Disponible en cualquier trámite del departamento (excepto PQRSD).</div>')+
    '</div>'+
    '<div class="ar" style="margin-top:.4rem"><button class="btn bsm bd2" onclick="delInfoTec('+i+')">Eliminar</button></div>';
}
function infoTecCfgScopeLabel(c){
  const scope=String(c.tramitesScope||'all')==='selected'?'selected':'all';
  if(scope!=='selected')return'Todos los trámites';
  const ids=Array.isArray(c.tramitesIds)?c.tramitesIds.map(String):[];
  if(!ids.length)return'Selección (ninguno aún)';
  const names=(cfg.tramites||[]).filter(function(t){return t&&ids.indexOf(String(t.id))>=0;}).map(function(t){return t.nombre||t.id;});
  if(names.length<=2)return names.join(', ')||(ids.length+' trámite(s)');
  return names.slice(0,2).join(', ')+' +'+(names.length-2);
}
function renderInfoTecCfg(){
  if(!cfg.infoTecnica)cfg.infoTecnica=[];
  const ro=cfgEsSoloLectura();
  const items=cfg.infoTecnica.length?cfg.infoTecnica.map((c,i)=>{
    const tipoLbl=TIPOS[c.tipo]?TIPOS[c.tipo].label:c.tipo||'texto';
    const scopeLbl=infoTecCfgScopeLabel(c);
    const title=(c.label||'Campo '+(i+1))+' · '+tipoLbl+' · '+scopeLbl;
    const roBody='<div style="font-size:13px;padding:4px 0">'+escAttr(c.label)+' · '+escAttr(tipoLbl)+'<div style="font-size:11px;color:var(--tx3);margin-top:4px">'+escAttr(scopeLbl)+'</div></div>';
    return cfgSectionFold(title,'',ro?roBody:infoTecCfgItemBody(c,i),false);
  }).join(''):'<div style="font-size:12px;color:var(--tx3);padding:.8rem;border:1px dashed var(--bd);border-radius:var(--r)">Sin campos técnicos.</div>';
  document.getElementById('cfg-info-tecnica-panel').innerHTML=(ro?cfgRestringidoBannerHtml():'')+'<div class="card"><div class="cft">Información técnica'+(ro?' <span style="font-size:11px;color:var(--tx3)">(solo lectura)</span>':'')+'</div>'+
    '<div class="cfs">Campos reutilizables en expedientes (después de información contable). Puede asociar cada campo a <strong>todos</strong> los trámites o solo a los que aplique.</div>'+
    '<div id="it-list" style="display:flex;flex-direction:column;gap:.5rem;max-width:720px">'+items+'</div>'+
    (ro?'':'<div class="ar" style="margin-top:.8rem"><button class="btn bp" onclick="addInfoTec()">+ Crear campo técnico</button></div>')+'</div>';
}
function addInfoTec(){
  if(guardCfgEditGeneral())return;
  if(!cfg.infoTecnica)cfg.infoTecnica=[];
  cfg.infoTecnica.push({id:'it'+Date.now(),label:'Nuevo campo técnico',tipo:'texto',placeholder:'',requerido:false,tramitesScope:'all',tramitesIds:[]});
  saveLS();renderInfoTecCfg();
}
function editInfoTec(i,k,v){if(guardCfgEditGeneral())return;const c=cfg.infoTecnica&&cfg.infoTecnica[i];if(!c)return;c[k]=v;saveLS();}
function setInfoTecTramitesScope(i,scope){
  if(guardCfgEditGeneral())return;
  const c=cfg.infoTecnica&&cfg.infoTecnica[i];if(!c)return;
  scope=String(scope||'all')==='selected'?'selected':'all';
  c.tramitesScope=scope;
  if(!Array.isArray(c.tramitesIds))c.tramitesIds=[];
  if(scope==='all')c.tramitesIds=[];
  saveLS();renderInfoTecCfg();
}
function toggleInfoTecTramite(i,tramId,on){
  if(guardCfgEditGeneral())return;
  const c=cfg.infoTecnica&&cfg.infoTecnica[i];if(!c)return;
  c.tramitesScope='selected';
  if(!Array.isArray(c.tramitesIds))c.tramitesIds=[];
  const id=String(tramId||'').trim();
  if(!id)return;
  const ix=c.tramitesIds.map(String).indexOf(id);
  if(on&&ix<0)c.tramitesIds.push(id);
  if(!on&&ix>=0)c.tramitesIds.splice(ix,1);
  saveLS();
}
function delInfoTec(i){
  if(guardCfgEditGeneral())return;
  const c=cfg.infoTecnica&&cfg.infoTecnica[i];
  confirmEliminar({message:'¿Eliminar este campo técnico?',detail:c?c.label:''},()=>{
    cfg.infoTecnica.splice(i,1);saveLS();renderInfoTecCfg();
  });
}
function addItem(k){
  if(guardCfgEditGeneral())return;
  const inp=document.getElementById('cfi-'+k);const v=inp.value.trim();
  if(!v){notif('Escribe un valor','err');return;}
  if(cfg[k].includes(v)){notif('Ya existe','err');return;}
  cfg[k].push(v);inp.value='';saveLS();renderListasCfg();auditCfgChange('Lista: '+k);notif('Agregado','ok');
}
function delItem(k,i){
  if(guardCfgEditGeneral())return;
  if(cfg[k].length<=1){notif('Mínimo uno','err');return;}
  confirmEliminar({message:'¿Eliminar este elemento de la lista?'},()=>{
    cfg[k].splice(i,1);saveLS();renderListasCfg();auditCfgChange('Lista: '+k);notif('Eliminado','ok');
  });
}
function mvItem(k,i,d){if(guardCfgEditGeneral())return;const a=cfg[k];const n=i+d;if(n<0||n>=a.length)return;[a[i],a[n]]=[a[n],a[i]];saveLS();renderListasCfg();auditCfgChange('Lista: '+k);}

// ---- TIPOS DE TRÁMITE ----
function renderTramsCfg(){
  const ro=cfgEsSoloLectura();
  if(ro){
    document.getElementById('trams-list').innerHTML=cfgRestringidoBannerHtml()+cfg.tramites.map(t=>'<div class="trc"><div class="trh"><div class="fx" style="gap:8px"><div style="width:11px;height:11px;border-radius:50%;background:'+t.color+'"></div><div class="trn">'+escAttr(t.nombre)+'</div><span style="font-size:12px;color:var(--tx2)">'+(t.campos||[]).length+' campos · Plazo: '+t.plazo+' '+(UNIDAD_LABEL[t.unidad]||'días')+'</span></div></div></div>').join('');
    return;
  }
  document.getElementById('trams-list').innerHTML=cfg.tramites.map((t)=>{
    const campos=t.campos||[];
    const secs={};
    campos.forEach(c=>{if(!secs[c.seccion||'General'])secs[c.seccion||'General']=[];secs[c.seccion||'General'].push(c);});
    const secHtml=Object.entries(secs).map(([sec,cs])=>'<div style="margin-bottom:.5rem"><div style="font-size:11px;font-weight:600;color:var(--bl);margin-bottom:.3rem">'+sec+'</div>'+
      cs.map((c)=>'<div class="campo-row">'+
        '<div class="fx" style="gap:1px">'+
          (campos.indexOf(c)>0?'<button class="btn bsm bic" onclick="mvCampo(\''+t.id+'\','+campos.indexOf(c)+',-1)">▲</button>':'<span style="width:22px"></span>')+
          (campos.indexOf(c)<campos.length-1?'<button class="btn bsm bic" onclick="mvCampo(\''+t.id+'\','+campos.indexOf(c)+',1)">▼</button>':'<span style="width:22px"></span>')+
        '</div>'+
        '<input type="text" value="'+c.label+'" onchange="editCL(\''+t.id+'\',\''+c.id+'\',this.value)">'+
        '<select onchange="editCT(\''+t.id+'\',\''+c.id+'\',this.value)">'+TIPO_KEYS.map(k=>'<option value="'+k+'"'+(c.tipo===k?' selected':'')+'>'+TIPOS[k].label+'</option>').join('')+'</select>'+
        '<input type="text" value="'+(c.seccion||'General')+'" onchange="editCS(\''+t.id+'\',\''+c.id+'\',this.value)">'+
        '<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;justify-content:center"><input type="checkbox" '+(c.requerido?'checked':'')+' onchange="editCR(\''+t.id+'\',\''+c.id+'\',this.checked)"> Req.</label>'+
        '<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;justify-content:center"><input type="checkbox" '+(c.enTabla?'checked':'')+' onchange="editCTb(\''+t.id+'\',\''+c.id+'\',this.checked)"> Tabla</label>'+
        '<button class="btn bsm bic bd2" onclick="delCampo(\''+t.id+'\',\''+c.id+'\')">✕</button>'+
      '</div>'+
      ((c.tipo==='seleccion')?'<div style="margin-left:28px;font-size:12px;color:var(--tx2);margin-bottom:3px">Opciones: <input type="text" value="'+(c.opciones||'')+'" onchange="editCO(\''+t.id+'\',\''+c.id+'\',this.value)" placeholder="op1,op2,op3" style="border:1px solid var(--bd);border-radius:5px;padding:3px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;width:280px"></div>':'')+
      ((c.tipo==='lista')?'<div style="margin-left:28px;font-size:12px;color:var(--tx2);margin-bottom:3px">Fuente: <select onchange="editCF(\''+t.id+'\',\''+c.id+'\',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:3px 6px;font-size:12px;font-family:\'DM Sans\',sans-serif">'+LISTA_FUENTES.map(f=>'<option value="'+f+'"'+(c.listaFuente===f?' selected':'')+'>'+f+'</option>').join('')+'</select></div>':'')+
      ((c.tipo==='texto'||c.tipo==='numero'||c.tipo==='email'||c.tipo==='tel')?'<div style="margin-left:28px;font-size:12px;color:var(--tx2);margin-bottom:3px">Placeholder: <input type="text" value="'+(c.placeholder||'')+'" onchange="editCPh(\''+t.id+'\',\''+c.id+'\',this.value)" style="border:1px solid var(--bd);border-radius:5px;padding:3px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;width:250px"></div>':'')
      ).join('')+'</div>').join('');
    return '<div class="trc">'+
      '<div class="trh" onclick="toggleTr(\'trb-'+t.id+'\')">'+
        '<div class="fx" style="gap:8px">'+
          '<div style="width:11px;height:11px;border-radius:50%;background:'+t.color+';flex-shrink:0"></div>'+
          '<div class="trn">'+escAttr(t.nombre)+'</div>'+
          '<span style="font-size:12px;color:var(--tx2)">'+campos.length+' campos · Plazo: '+t.plazo+' '+(UNIDAD_LABEL[t.unidad]||'días')+((t.subclases||[]).length?' · '+(t.subclases||[]).length+' clase(s)':'')+'</span>'+
        '</div>'+
        '<div class="fx" style="gap:5px"><button class="btn bsm bd2" onclick="event.stopPropagation();delTram(\''+jsStr(t.id)+'\')">🗑 Eliminar</button><span>▼</span></div>'+
      '</div>'+
      '<div id="trb-'+t.id+'" class="trbody" style="display:none">'+
        '<div class="tr-section" style="margin-top:.8rem">'+
          '<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:.4rem">Identificación</div>'+
          '<div style="font-size:11px;color:var(--tx2);margin-bottom:.5rem">Puede corregir el nombre; los expedientes ya creados siguen vinculados por el id interno del tipo.</div>'+
          '<div class="fg">'+
            '<div class="fld"><label>Nombre *</label><input type="text" id="tram-nombre-'+t.id+'" value="'+escAttr(t.nombre||'')+'" placeholder="Nombre del tipo de trámite" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);width:100%"></div>'+
            '<div class="fld"><label>Descripción</label><input type="text" id="tram-desc-'+t.id+'" value="'+escAttr(t.desc||'')+'" placeholder="Descripción breve" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);width:100%"></div>'+
          '</div>'+
        '</div>'+
        // Términos
        '<div class="tr-section" style="margin-top:.8rem">'+
          '<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:.4rem">⏱ Términos de atención</div>'+
          '<div style="font-size:11px;color:var(--tx2);margin-bottom:.5rem">Plazo legal del trámite (solicitud + días configurados). Se refleja en el planeador por expediente.</div>'+
          '<div class="fg">'+
            '<div class="fld"><label>Plazo de atención</label><input type="number" id="tram-plazo-'+t.id+'" value="'+t.plazo+'" min="1" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);width:100%"></div>'+
            '<div class="fld"><label>Unidad</label><select id="tram-unidad-'+t.id+'" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf)">'+Object.entries(UNIDAD_LABEL).map(([k,v])=>'<option value="'+k+'"'+(t.unidad===k?' selected':'')+'>'+v+'</option>').join('')+'</select></div>'+
            '<div class="fld"><label>Alerta en % del plazo</label><input type="number" id="tram-alerta-'+t.id+'" value="'+t.alerta+'" min="1" max="100" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);width:100%"></div>'+
          '</div>'+
        '</div>'+
        htmlTramSubclasesEditor(t)+
        // Campos
        '<div style="margin-top:.6rem"><div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:.3rem">Campos del formulario</div>'+
        secHtml+
        '<div class="fx" style="gap:5px;margin-top:.4rem;flex-wrap:wrap">'+
          '<button class="btn bsm" onclick="addCampo(\''+t.id+'\',\'Datos del interesado\')">+ Interesado</button>'+
          '<button class="btn bsm" onclick="addCampo(\''+t.id+'\',\'Información principal\')">+ Principal</button>'+
          '<button class="btn bsm" onclick="addCampo(\''+t.id+'\',\'Información específica\')">+ Específico</button>'+
        '</div></div>'+
        '<div class="tram-save-bar">'+
          '<button type="button" class="btn bp" onclick="event.stopPropagation();guardarTramite(\''+jsStr(t.id)+'\')">💾 Guardar trámite</button>'+
          '<span style="font-size:11px;color:var(--tx3)">Nombre, términos y campos se guardan al pulsar este botón.</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  if(window._tramOpenId){
    const openEl=document.getElementById('trb-'+window._tramOpenId);
    if(openEl)openEl.style.display='';
  }
}
function toggleTr(id){const el=document.getElementById(id);if(!el)return;const opening=el.style.display==='none';el.style.display=opening?'':'none';if(id.startsWith('trb-'))window._tramOpenId=opening?id.slice(4):'';}
function getTram2(tid){return cfg.tramites.find(t=>t.id===tid);}
function getCampo(tid,cid){const t=getTram2(tid);return t&&t.campos?t.campos.find(c=>c.id===cid):null;}
function editCL(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.label=v;}
function editCT(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.tipo=v;renderTramsCfg();}
function editCS(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.seccion=v;}
function editCR(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.requerido=v;}
function editCTb(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.enTabla=v;}
function editCO(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.opciones=v;}
function editCF(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.listaFuente=v;}
function editCPh(tid,cid,v){if(guardCfgEditGeneral())return;const c=getCampo(tid,cid);if(c)c.placeholder=v;}
function guardarTramite(tid){
  if(guardCfgEditGeneral())return;
  const t=getTram2(tid);
  if(!t)return;
  const nomEl=document.getElementById('tram-nombre-'+tid);
  const descEl=document.getElementById('tram-desc-'+tid);
  const nom=String((nomEl&&nomEl.value)||'').trim();
  const desc=String((descEl&&descEl.value)||'').trim();
  if(!nom){notif('Indique el nombre del tipo de trámite','err');return;}
  const dup=(cfg.tramites||[]).some(function(x){
    return x&&x.id!==tid&&String(x.nombre||'').trim().toLowerCase()===nom.toLowerCase();
  });
  if(dup){notif('Ya existe otro tipo de trámite con ese nombre','err');return;}
  const plazoEl=document.getElementById('tram-plazo-'+tid);
  const unidadEl=document.getElementById('tram-unidad-'+tid);
  const alertaEl=document.getElementById('tram-alerta-'+tid);
  const plazo=Number(plazoEl&&plazoEl.value);
  const unidad=unidadEl?unidadEl.value:'dias';
  const alerta=Number(alertaEl&&alertaEl.value);
  if(!plazo||plazo<1){notif('Indique un plazo de atención válido (mínimo 1)','err');return;}
  if(!alerta||alerta<1||alerta>100){notif('La alerta debe estar entre 1 y 100 %','err');return;}
  const prevNom=t.nombre;
  t.nombre=nom;
  t.desc=desc;
  t.plazo=plazo;
  t.unidad=unidad;
  t.alerta=alerta;
  const lblEl=document.getElementById('tram-subclase-label-'+tid);
  t.subclaseLabel=String((lblEl&&lblEl.value)||'Clase / tipo').trim()||'Clase / tipo';
  t.subclases=readTramSubclasesFromUi(tid);
  saveLS();
  poblarTramSelect();
  window._tramOpenId=tid;
  renderTramsCfg();
  const el=document.getElementById('trb-'+tid);
  if(el)el.style.display='';
  const nSub=(t.subclases||[]).length;
  if(prevNom!==nom)auditCfgChange('Renombró trámite: «'+prevNom+'» → «'+nom+'»');
  notif('Trámite «'+t.nombre+'» guardado — '+plazo+' '+(UNIDAD_LABEL[unidad]||'días')+', alerta al '+alerta+'%'+(nSub?' · '+nSub+' clase(s)':''),'ok');
}
function addCampo(tid,sec){
  if(guardCfgEditGeneral())return;
  const t=getTram2(tid);if(!t)return;
  if(!t.campos)t.campos=[];
  t.campos.push({id:'f'+Date.now(),label:'Nuevo campo',tipo:'texto',seccion:sec||'General',requerido:false,enTabla:false,placeholder:''});
  window._tramOpenId=tid;
  renderTramsCfg();
  const el=document.getElementById('trb-'+tid);if(el)el.style.display='';
  notif('Campo agregado (pendiente de guardar)','ok');
}
function delCampo(tid,cid){
  if(guardCfgEditGeneral())return;
  confirmEliminar({message:'¿Eliminar este campo del formulario?'},()=>{
    const t=getTram2(tid);if(!t||!t.campos)return;t.campos=t.campos.filter(c=>c.id!==cid);window._tramOpenId=tid;renderTramsCfg();notif('Campo eliminado (pendiente de guardar)','ok');
  });
}
function mvCampo(tid,i,d){if(guardCfgEditGeneral())return;const t=getTram2(tid);if(!t||!t.campos)return;const n=i+d;if(n<0||n>=t.campos.length)return;[t.campos[i],t.campos[n]]=[t.campos[n],t.campos[i]];window._tramOpenId=tid;renderTramsCfg();}
function renderEtapasPredPicker(t){
  const pred=(cfg.etapasPred||[]).filter(e=>!(t.etapas||[]).includes(e));
  if(!pred.length)return'<div style="font-size:12px;color:var(--tx3);margin-top:.5rem">Todas las etapas de configuración base ya están en este trámite.</div>';
  return '<div style="font-size:12px;color:var(--tx2);margin-top:.6rem">Agregar etapas desde configuración base:</div>'+
    '<div class="eta-pick-grid">'+pred.map(e=>'<label><input type="checkbox" class="eta-pick-'+t.id+'" value="'+e+'"> '+e+'</label>').join('')+'</div>'+
    '<button class="btn bsm bp" type="button" onclick="addEtapasPredTram(\''+t.id+'\')">+ Agregar etapas seleccionadas</button>';
}
function addEtapasPredTram(tid){
  if(guardCfgEditGeneral())return;
  const t=getTram2(tid);if(!t)return;
  if(!t.etapas)t.etapas=[];
  let added=0;
  document.querySelectorAll('.eta-pick-'+tid+':checked').forEach(cb=>{
    const v=cb.value.trim();
    if(v&&!t.etapas.includes(v)){t.etapas.push(v);added++;}
  });
  if(!added){notif('Seleccione al menos una etapa','err');return;}
  window._tramOpenId=tid;renderTramsCfg();notif(added+' etapa(s) agregada(s) (pendiente de guardar)','ok');
}
function delEta(tid,i){
  if(guardCfgEditGeneral())return;
  const t=getTram2(tid);if(!t||t.etapas.length<=1){notif('Mínimo una etapa','err');return;}
  confirmEliminar({message:'¿Eliminar esta etapa del trámite?'},()=>{t.etapas.splice(i,1);window._tramOpenId=tid;renderTramsCfg();});
}
function mvEta(tid,i,d){if(guardCfgEditGeneral())return;const t=getTram2(tid);if(!t)return;const n=i+d;if(n<0||n>=t.etapas.length)return;[t.etapas[i],t.etapas[n]]=[t.etapas[n],t.etapas[i]];window._tramOpenId=tid;renderTramsCfg();}
function addSegEta(tid){if(guardCfgEditGeneral())return;const t=getTram2(tid);if(!t)return;if(!t.etapasSeg)t.etapasSeg=[];const inp=document.getElementById('segeta-'+tid);const v=inp.value.trim();if(!v)return;t.etapasSeg.push(v);inp.value='';window._tramOpenId=tid;renderTramsCfg();}
function delSegEta(tid,i){
  if(guardCfgEditGeneral())return;
  confirmEliminar({message:'¿Eliminar esta etapa de seguimiento?'},()=>{
    const t=getTram2(tid);if(!t||!t.etapasSeg)return;t.etapasSeg.splice(i,1);window._tramOpenId=tid;renderTramsCfg();
  });
}
function mvSegEta(tid,i,d){if(guardCfgEditGeneral())return;const t=getTram2(tid);if(!t||!t.etapasSeg)return;const n=i+d;if(n<0||n>=t.etapasSeg.length)return;[t.etapasSeg[i],t.etapasSeg[n]]=[t.etapasSeg[n],t.etapasSeg[i]];window._tramOpenId=tid;renderTramsCfg();}
function delTram(tid){
  const t=getTram2(tid);if(!t)return;
  if(guardCfgEditGeneral())return;
  confirmEliminar({message:'¿Eliminar el tipo de trámite «'+t.nombre+'»?',detail:'Esta acción no se puede deshacer.'},()=>{
    cfg.tramites=cfg.tramites.filter(x=>x.id!==tid);saveLS();renderTramsCfg();auditCfgChange('Eliminó trámite: '+t.nombre);notif('Eliminado','ok');
  });
}

// Nuevo trámite
function addNtEta(){
  const c=document.getElementById('nt-etas');
  const div=document.createElement('div');div.className='eta-row';
  div.innerHTML='<div class="eta-num" style="background:var(--bl)">'+(c.children.length+1)+'</div><input type="text" placeholder="Nombre de la etapa" class="na-e" style="flex:1;padding:5px 8px;border:1px solid var(--bd);border-radius:5px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx)"><button class="btn bsm bic bd2" onclick="this.closest(\'.eta-row\').remove()">✕</button>';
  c.appendChild(div);
}
function addNtSegEta(){
  const c=document.getElementById('nt-seg-etas');
  const div=document.createElement('div');div.className='eta-row';
  div.innerHTML='<div class="eta-num" style="background:var(--pu)">'+(c.children.length+1)+'</div><input type="text" placeholder="Etapa de seguimiento" class="na-se" style="flex:1;padding:5px 8px;border:1px solid var(--bd);border-radius:5px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);color:var(--tx)"><button class="btn bsm bic bd2" onclick="this.closest(\'.eta-row\').remove()">✕</button>';
  c.appendChild(div);
}
function addNtCampo(sec,tipoDef){
  const c=document.getElementById('nt-campos');
  const div=document.createElement('div');div.style.cssText='margin-bottom:5px';
  div.innerHTML='<div class="campo-row">'+
    '<div style="font-size:14px;color:var(--tx3);text-align:center">≡</div>'+
    '<input type="text" placeholder="Nombre del campo" class="nc-l" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif">'+
    '<select class="nc-t" onchange="toggleNcOpts(this)">'+TIPO_KEYS.map(k=>'<option value="'+k+'"'+(tipoDef===k?' selected':'')+'>'+TIPOS[k].label+'</option>').join('')+'</select>'+
    '<input type="text" class="nc-s" value="'+sec+'" style="border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif">'+
    '<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;justify-content:center"><input type="checkbox" class="nc-r"> Req.</label>'+
    '<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;justify-content:center"><input type="checkbox" class="nc-tb"> Tabla</label>'+
    '<button class="btn bsm bic bd2" onclick="this.closest(\'div\').parentElement.remove()">✕</button>'+
  '</div>'+
  '<div class="nc-opts" style="display:none;margin-left:34px;font-size:12px;color:var(--tx2);margin-bottom:3px">'+
    'Opciones: <input type="text" class="nc-o" placeholder="op1,op2,op3" style="border:1px solid var(--bd);border-radius:5px;padding:3px 7px;font-size:12px;font-family:\'DM Sans\',sans-serif;width:240px">'+
    ' Fuente lista: <select class="nc-f" style="border:1px solid var(--bd);border-radius:5px;padding:3px 6px;font-size:12px;font-family:\'DM Sans\',sans-serif">'+LISTA_FUENTES.map(f=>'<option>'+f+'</option>').join('')+'</select>'+
  '</div>';
  c.appendChild(div);
}
function toggleNcOpts(sel){const opts=sel.closest('div').parentElement.querySelector('.nc-opts');if(opts)opts.style.display=(sel.value==='seleccion'||sel.value==='lista')?'':'none';}
/** Paleta de colores de trámites (PAL) — evita repetir cuando hay disponibles. */
function coloresTramitePaleta(){
  return (typeof PAL!=='undefined'&&Array.isArray(PAL)&&PAL.length)
    ?PAL.slice()
    :['#185FA5','#1a7a4a','#b87d0a','#a32d2d','#6d3fa8','#2196A8','#D85A30','#639922','#D4537E','#888780'];
}
function coloresUsadosPorTramites(){
  const used={};
  ((typeof cfg!=='undefined'&&cfg&&cfg.tramites)||[]).forEach(function(t){
    const c=String(t&&t.color||'').trim().toLowerCase();
    if(c)used[c]=(used[c]||0)+1;
  });
  return used;
}
/** Elige un color libre; si todos están usados, el menos repetido. */
function pickTramiteColorLibre(){
  const pal=coloresTramitePaleta();
  const used=coloresUsadosPorTramites();
  for(let i=0;i<pal.length;i++){
    if(!used[String(pal[i]).toLowerCase()])return pal[i];
  }
  let best=pal[0],bestN=Infinity;
  pal.forEach(function(c){
    const n=used[String(c).toLowerCase()]||0;
    if(n<bestN){bestN=n;best=c;}
  });
  return best;
}
function syncNtColorAuto(){
  const c=pickTramiteColorLibre();
  const hid=document.getElementById('nt-color');
  if(hid)hid.value=c;
  const prev=document.getElementById('nt-color-prev');
  if(prev)prev.style.background=c;
}
function toggleTramNuevoForm(forceOpen){
  const body=document.getElementById('tram-nuevo-body');
  const btn=document.getElementById('tram-nuevo-toggle-btn');
  if(!body)return;
  const open=forceOpen===true?true:(forceOpen===false?false:body.style.display==='none');
  body.style.display=open?'':'none';
  if(btn)btn.textContent=open?'Cerrar formulario':'Abrir formulario';
  if(open){
    if(typeof syncNtColorAuto==='function')syncNtColorAuto();
    if(typeof ntWriteSubclases==='function')ntWriteSubclases(typeof ntReadSubclases==='function'?ntReadSubclases():[]);
    const nom=document.getElementById('nt-nom');
    if(nom)setTimeout(function(){nom.focus();},40);
  }
}
window.toggleTramNuevoForm=toggleTramNuevoForm;
function normalizeSubclasesList(arr){
  if(!Array.isArray(arr))return[];
  const out=[];
  const seen=new Set();
  arr.forEach(function(s){
    const v=String(s||'').trim();
    if(!v)return;
    const k=v.toLowerCase();
    if(seen.has(k))return;
    seen.add(k);
    out.push(v);
  });
  return out;
}
function getTramSubclases(t){
  if(!t)return[];
  return normalizeSubclasesList(t.subclases);
}
function getTramSubclaseLabel(t){
  return String((t&&t.subclaseLabel)||'Clase / tipo').trim()||'Clase / tipo';
}
function ntReadSubclases(){
  try{return normalizeSubclasesList(JSON.parse((document.getElementById('nt-subclases')||{}).value||'[]'));}
  catch(e){return[];}
}
function ntWriteSubclases(list){
  const arr=normalizeSubclasesList(list);
  const hid=document.getElementById('nt-subclases');
  if(hid)hid.value=JSON.stringify(arr);
  const el=document.getElementById('nt-subclases-list');
  if(!el)return;
  if(!arr.length){
    el.innerHTML='<span style="font-size:11px;color:var(--tx3)">Sin opciones aún. Agregue al menos una si el trámite tiene clases (Superficial, Persistente…).</span>';
    return;
  }
  el.innerHTML=arr.map(function(s,i){
    return '<span class="bdg" style="display:inline-flex;align-items:center;gap:4px;background:var(--sf2);border:1px solid var(--bd);color:var(--tx);padding:4px 8px">'+
      escAttr(s)+
      '<button type="button" class="btn bsm bic bd2" style="padding:0 4px;min-width:0;line-height:1.2" onclick="ntRemoveSubclase('+i+')" title="Quitar">✕</button></span>';
  }).join('');
}
function ntAddSubclase(){
  const inp=document.getElementById('nt-subclase-inp');
  const v=String((inp&&inp.value)||'').trim();
  if(!v){notif('Escriba el nombre de la clase / tipo','err');return;}
  const list=ntReadSubclases();
  if(list.some(function(x){return x.toLowerCase()===v.toLowerCase();})){notif('Esa opción ya está en la lista','err');return;}
  list.push(v);
  ntWriteSubclases(list);
  if(inp){inp.value='';inp.focus();}
}
function ntRemoveSubclase(i){
  const list=ntReadSubclases();
  list.splice(i,1);
  ntWriteSubclases(list);
}
function htmlTramSubclasesEditor(t){
  const list=getTramSubclases(t);
  const lbl=getTramSubclaseLabel(t);
  let h='<div class="tr-section" style="margin-top:.8rem">';
  h+='<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:.4rem">🏷️ Clase / tipo / modo</div>';
  h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:.5rem">Subsecciones que el encargado elige al crear el expediente (ej. Superficial / Subterránea).</div>';
  h+='<div class="fg">';
  h+='<div class="fld"><label>Nombre del selector</label><input type="text" id="tram-subclase-label-'+escAttr(t.id)+'" value="'+escAttr(lbl)+'" placeholder="Clase / tipo" style="border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--sf);width:100%"></div>';
  h+='<div class="fld" style="flex:2"><label>Agregar opción</label><div class="fx" style="gap:6px">';
  h+='<input type="text" id="tram-subclase-inp-'+escAttr(t.id)+'" placeholder="Ej. Superficial" style="flex:1;border:1px solid var(--bd);border-radius:var(--r);padding:6px 9px;font-size:13px;font-family:\'DM Sans\',sans-serif" onkeydown="if(event.key===\'Enter\'){event.preventDefault();tramAddSubclase(\''+jsStr(t.id)+'\');}">';
  h+='<button type="button" class="btn bsm bp" onclick="tramAddSubclase(\''+jsStr(t.id)+'\')">+</button></div></div></div>';
  h+='<div id="tram-subclases-list-'+escAttr(t.id)+'" class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px">';
  if(!list.length)h+='<span style="font-size:11px;color:var(--tx3)">Sin clases configuradas (el selector no aparecerá en Registro).</span>';
  else list.forEach(function(s,i){
    h+='<span class="bdg" style="display:inline-flex;align-items:center;gap:4px;background:var(--sf2);border:1px solid var(--bd);color:var(--tx);padding:4px 8px">'+
      escAttr(s)+
      '<button type="button" class="btn bsm bic bd2" style="padding:0 4px;min-width:0;line-height:1.2" onclick="tramRemoveSubclase(\''+jsStr(t.id)+'\','+i+')" title="Quitar">✕</button></span>';
  });
  h+='</div><input type="hidden" id="tram-subclases-'+escAttr(t.id)+'" value=\''+escAttr(JSON.stringify(list))+'\'>';
  h+='</div>';
  return h;
}
function readTramSubclasesFromUi(tid){
  try{return normalizeSubclasesList(JSON.parse((document.getElementById('tram-subclases-'+tid)||{}).value||'[]'));}
  catch(e){return[];}
}
function writeTramSubclasesUi(tid,list){
  const arr=normalizeSubclasesList(list);
  const hid=document.getElementById('tram-subclases-'+tid);
  if(hid)hid.value=JSON.stringify(arr);
  const el=document.getElementById('tram-subclases-list-'+tid);
  if(!el)return;
  if(!arr.length){
    el.innerHTML='<span style="font-size:11px;color:var(--tx3)">Sin clases configuradas (el selector no aparecerá en Registro).</span>';
    return;
  }
  el.innerHTML=arr.map(function(s,i){
    return '<span class="bdg" style="display:inline-flex;align-items:center;gap:4px;background:var(--sf2);border:1px solid var(--bd);color:var(--tx);padding:4px 8px">'+
      escAttr(s)+
      '<button type="button" class="btn bsm bic bd2" style="padding:0 4px;min-width:0;line-height:1.2" onclick="tramRemoveSubclase(\''+jsStr(tid)+'\','+i+')" title="Quitar">✕</button></span>';
  }).join('');
}
function tramAddSubclase(tid){
  if(guardCfgEditGeneral())return;
  const inp=document.getElementById('tram-subclase-inp-'+tid);
  const v=String((inp&&inp.value)||'').trim();
  if(!v){notif('Escriba el nombre de la clase / tipo','err');return;}
  const list=readTramSubclasesFromUi(tid);
  if(list.some(function(x){return x.toLowerCase()===v.toLowerCase();})){notif('Esa opción ya está en la lista','err');return;}
  list.push(v);
  writeTramSubclasesUi(tid,list);
  if(inp){inp.value='';inp.focus();}
}
function tramRemoveSubclase(tid,i){
  if(guardCfgEditGeneral())return;
  const list=readTramSubclasesFromUi(tid);
  list.splice(i,1);
  writeTramSubclasesUi(tid,list);
}
function crearTramite(){
  if(guardCfgEditGeneral())return;
  const nom=document.getElementById('nt-nom').value.trim();
  const desc=document.getElementById('nt-desc').value.trim();
  const color=pickTramiteColorLibre();
  const plazo=Number(document.getElementById('nt-plazo').value)||60;
  const alerta=Number(document.getElementById('nt-alerta').value)||80;
  const unidad=document.getElementById('nt-unidad').value;
  if(!nom){notif('Escribe el nombre','err');return;}
  const subclaseLabel=String((document.getElementById('nt-subclase-label')||{}).value||'Clase / tipo').trim()||'Clase / tipo';
  const subclases=ntReadSubclases();
  const campos=[];
  cfg.tramites.push({id:'t'+Date.now(),nombre:nom,desc,color,plazo,alerta,unidad,etapas:[],etapasSeg:[],campos,subclases,subclaseLabel});
  document.getElementById('nt-nom').value='';
  document.getElementById('nt-desc').value='';
  const hid=document.getElementById('nt-color');if(hid)hid.value=color;
  const lbl=document.getElementById('nt-subclase-label');if(lbl)lbl.value='Clase / tipo';
  ntWriteSubclases([]);
  saveLS();poblarTramSelect();auditCfgChange('Nuevo trámite: '+nom);notif('Trámite "'+nom+'" creado'+(subclases.length?' · '+subclases.length+' clase(s)':''),'ok');
  if(typeof toggleTramNuevoForm==='function')toggleTramNuevoForm(false);
  showCfgTab('tramites');
}
window.ntAddSubclase=ntAddSubclase;
window.ntRemoveSubclase=ntRemoveSubclase;
window.tramAddSubclase=tramAddSubclase;
window.tramRemoveSubclase=tramRemoveSubclase;
window.getTramSubclases=getTramSubclases;
window.getTramSubclaseLabel=getTramSubclaseLabel;

// ================================================================