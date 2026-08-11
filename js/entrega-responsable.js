// =============================================================================
// entrega-responsable.js — Entrega / auto-asignación de actividad por responsable
// Grupo A: convive con la asignación del encargado. Si el responsable inicia,
// la actividad queda en el expediente (Registro/Consulta) y en Por verificar.
// =============================================================================

function puedeEntregarComoResponsable(){
  if(typeof esJurisdiccional==='function'&&esJurisdiccional())return false;
  const modoResp=typeof esModoResponsable==='function'&&esModoResponsable();
  const modoCont=typeof esModoContratista==='function'&&esModoContratista();
  if(!modoResp&&!modoCont)return false;
  // Sesión Google vinculada: fijar nombre si aún no está en responsableActivo
  if(!String(responsableActivo||'').trim()
    &&typeof esResponsableIdentidadFija==='function'&&esResponsableIdentidadFija()
    &&typeof fijarResponsableSesion==='function'){
    fijarResponsableSesion();
  }
  return !!String(responsableActivo||'').trim();
}

function buscarExpedientesEntregaResp(q,lim){
  const ql=String(q||'').trim().toLowerCase();
  if(ql.length<1)return[];
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const out=[];
  (exps||[]).forEach(function(e){
    if(!e||!e._exp)return;
    const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
      ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
    const ed=String(e._depto||'').trim();
    const ofi=String(e._pqrs_oficina||'').trim();
    if(!esPqrs){
      if(ed&&depto&&ed!==depto&&ed!=='guaviare')return;
    }
    const num=String(e._exp||'').trim();
    const nom=(typeof getNom==='function'?getNom(e):'').toLowerCase();
    const tramObj=typeof getTram==='function'?getTram(e._tramite,e):null;
    const tram=(tramObj&&tramObj.nombre?tramObj.nombre:'').toLowerCase();
    const ofiLbl=ofi?(typeof labelOficina==='function'?labelOficina(ofi):ofi).toLowerCase():'';
    if(!num.toLowerCase().includes(ql)&&!nom.includes(ql)&&!tram.includes(ql)&&!ofiLbl.includes(ql))return;
    out.push(e);
  });
  return out.slice(0,lim||12);
}

function filtrarExpEntregaRespSug(inp){
  const portal=document.getElementById('entrega-resp-exp-sug');
  if(!portal||!inp)return;
  const list=buscarExpedientesEntregaResp(inp.value,12);
  if(!list.length){
    portal.style.display='none';
    portal.innerHTML='';
    return;
  }
  portal.innerHTML=list.map(function(e){
    const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
    const tramNom=tram?tram.nombre:'Trámite';
    const nom=typeof getNom==='function'?getNom(e):'';
    const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
      ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
    const tag=esPqrs?'<span style="color:#6d3fa8;font-weight:600">PQRSD</span> · ':'<span style="color:var(--bl)">Trámite</span> · ';
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();pickExpEntregaResp(\''+
      String(e._exp||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+
      tag+'<strong>'+escAttr(e._exp)+'</strong> · '+escAttr(tramNom)+' · '+escAttr(nom)+'</button>';
  }).join('');
  portal.style.display='block';
}

function pickExpEntregaResp(expNum){
  const inp=document.getElementById('entrega-resp-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('entrega-resp-exp-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const e=typeof getExpById==='function'?getExpById(expNum):null;
  const modoNuevo=document.getElementById('entrega-resp-modo-nuevo');
  const modoExist=document.getElementById('entrega-resp-modo-existente');
  if(e){
    if(modoExist)modoExist.checked=true;
    if(modoNuevo)modoNuevo.checked=false;
  }
  syncEntregaRespModoUi();
  const hint=document.getElementById('entrega-resp-exp-hint');
  if(hint){
    if(e){
      const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
      const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
        ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
      hint.innerHTML='Seleccionado: <strong>'+escAttr(e._exp)+'</strong> · '+
        (esPqrs?'<span style="color:#6d3fa8">PQRSD</span>':'Trámite')+' · '+
        escAttr(tram?tram.nombre:'')+' · '+escAttr(typeof getNom==='function'?getNom(e):'')+
        ' · '+escAttr(e._estado||'')+
        (esPqrs?'<br><span style="color:var(--tx3)">Los archivos irán a la carpeta PQRSD institucional (no a Expedientes).</span>':'');
    }else hint.textContent='Expediente no encontrado en la app — puede crearlo como alta nueva abajo (solo trámites).';
  }
  syncEntregaRespPqrsUi();
}

function syncEntregaRespModoUi(){
  const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const boxNuevo=document.getElementById('entrega-resp-alta-box');
  const boxExist=document.getElementById('entrega-resp-exist-box');
  const libreHint=document.getElementById('entrega-resp-libre-hint');
  const hint=document.getElementById('entrega-resp-exp-hint');
  if(boxNuevo)boxNuevo.style.display=nuevo?'':'none';
  if(boxExist)boxExist.style.display=(nuevo||libre)?'none':'';
  if(libreHint)libreHint.style.display=libre?'':'none';
  if(nuevo||libre){
    if(hint)hint.textContent='';
  }
  const driveHint=document.getElementById('entrega-resp-drive-hint');
  if(driveHint){
    if(libre)driveHint.textContent='Sin expediente: el archivo se guarda en carpeta ACT-… del Drive institucional.';
    else if(!document.getElementById('pqrs-entrega-campos'))
      driveHint.textContent='Se sube al Drive institucional del expediente (carpeta EXP-…).';
  }
  if(libre){
    const regBox=document.getElementById('entrega-resp-registro-box');
    if(regBox){regBox.style.display='none';regBox.innerHTML='';}
    const pqrsBox=document.getElementById('entrega-resp-pqrs-box');
    if(pqrsBox){pqrsBox.innerHTML='';pqrsBox.style.display='none';}
    const tramFiles=document.getElementById('entrega-resp-tramite-files');
    if(tramFiles){
      if(tramFiles._tramiteFilesHtmlBackup)tramFiles.innerHTML=tramFiles._tramiteFilesHtmlBackup;
      tramFiles.style.display='';
    }
    const regHint=document.getElementById('entrega-resp-reg-hint');
    if(regHint)regHint.textContent='Sin expediente: elija una actividad predeterminada (misma lista de Configuración).';
  }else{
    syncEntregaRespPqrsUi();
    if(typeof syncEntregaRespRegistroUi==='function')syncEntregaRespRegistroUi();
  }
}

/** Muestra campos PQRSD (respuesta + Drive PQRSD) cuando se selecciona una PQRSD existente. */
function syncEntregaRespPqrsUi(){
  const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const e=!nuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  const esPqrs=!!(e&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
    ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))));
  const box=document.getElementById('entrega-resp-pqrs-box');
  const tramFiles=document.getElementById('entrega-resp-tramite-files');
  const regBox=document.getElementById('entrega-resp-registro-box');
  const driveHint=document.getElementById('entrega-resp-drive-hint');
  if(tramFiles&&!tramFiles._tramiteFilesHtmlBackup)
    tramFiles._tramiteFilesHtmlBackup=tramFiles.innerHTML;
  if(box){
    if(esPqrs&&typeof renderPqrsEntregaCamposHtml==='function'){
      if(tramFiles){tramFiles.innerHTML='';tramFiles.style.display='none';}
      box.innerHTML=renderPqrsEntregaCamposHtml(e);
      box.style.display='';
      if(regBox){regBox.style.display='none';regBox.innerHTML='';}
      setTimeout(function(){
        if(typeof pqrsEntregaRefreshUi==='function')pqrsEntregaRefreshUi();
      },40);
    }else{
      box.innerHTML='';
      box.style.display='none';
      if(tramFiles){
        if(tramFiles._tramiteFilesHtmlBackup)tramFiles.innerHTML=tramFiles._tramiteFilesHtmlBackup;
        tramFiles.style.display='';
      }
    }
  }
  if(driveHint){
    driveHint.textContent=esPqrs
      ?'Los archivos se suben a la carpeta PQRSD institucional (no a Expedientes / EXP-).'
      :'Se sube al Drive institucional del expediente (carpeta EXP-…).';
  }
}

function entregaRespMunOptsHtml(dep,sel){
  if(typeof munOpts==='function')return munOpts(dep||(typeof nombreDeptoOperativo==='function'?nombreDeptoOperativo():''),sel||'');
  return '<option value="">— Municipio —</option>';
}

function htmlEntregaRespDir(prefix,ev){
  ev=ev||{};
  const depFijo=typeof nombreDeptoOperativo==='function'?nombreDeptoOperativo():'Guaviare';
  const mun=ev['_'+prefix+'_mun']||'';
  return '<input type="hidden" id="entrega-int-'+prefix+'-dep" value="'+escAttr(depFijo)+'">'+
    '<div class="fld"><label>Municipio</label><select id="entrega-int-'+prefix+'-mun" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)">'+entregaRespMunOptsHtml(depFijo,mun)+'</select></div>'+
    '<div class="fld"><label>Vereda</label><input type="text" id="entrega-int-'+prefix+'-vereda" value="'+escAttr(ev['_'+prefix+'_vereda']||'')+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Predio</label><input type="text" id="entrega-int-'+prefix+'-predio" value="'+escAttr(ev['_'+prefix+'_predio']||'')+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Barrio</label><input type="text" id="entrega-int-'+prefix+'-barrio" value="'+escAttr(ev['_'+prefix+'_barrio']||'')+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld"><label>Dirección</label><input type="text" id="entrega-int-'+prefix+'-direccion" value="'+escAttr(ev['_'+prefix+'_direccion']||'')+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>';
}

function syncEntregaRespAltaFormPorTramite(){
  const host=document.getElementById('entrega-resp-persona-host');
  if(!host)return;
  const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
  host.innerHTML=htmlEntregaRespInteresadoBox(tid);
  syncEntregaRespInteresadoUi();
  if(typeof syncEntregaRespInfractoresUi==='function')syncEntregaRespInfractoresUi();
}

function htmlEntregaRespApoAut(ev){
  ev=ev||{};
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  return '<div style="margin-top:10px">'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:500"><input type="checkbox" id="entrega-int-apoderado" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--pu)"> Tiene apoderado <span style="font-weight:400;color:var(--tx2)">(abogado)</span></label>'+
    '<div id="entrega-int-apo-box" style="display:none;margin-top:8px"><div class="slbl" style="margin-bottom:6px;font-size:11px">Apoderado</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-apo-nombre" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-apo-identificacion" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-apo-correo" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-apo-telefono" style="'+inpStyle+'"></div>'+
    htmlEntregaRespDir('apo',ev)+
    '</div></div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:500;margin-top:10px"><input type="checkbox" id="entrega-int-autorizado" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--bl)"> Tiene autorizado</label>'+
    '<div id="entrega-int-aut-box" style="display:none;margin-top:8px"><div class="slbl" style="margin-bottom:6px;font-size:11px">Autorizado</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-aut-nombre" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-aut-identificacion" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-aut-correo" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-aut-telefono" style="'+inpStyle+'"></div>'+
    htmlEntregaRespDir('aut',ev)+
    '</div></div></div>';
}

function htmlEntregaRespInfractorCard(idx,pi){
  pi=pi||{};
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  const tipo=pi._pi_tipo_persona||pi.tipo||'natural';
  const pref='entrega-inf-'+idx;
  const dirNat={}; const dirEmp={};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
    dirNat['_inf'+idx+'_'+k]=pi['_pi_'+k]||'';
    dirEmp['_infemp'+idx+'_'+k]=pi['_pi_emp_'+k]||'';
  });
  return '<div class="entrega-inf-card" data-inf-idx="'+idx+'" style="margin-top:10px;padding:10px;border:1px dashed var(--bd);border-radius:var(--r);background:var(--sf2)">'+
    '<div class="fx" style="justify-content:space-between;align-items:center;margin-bottom:6px">'+
      '<div class="slbl" style="margin:0;font-size:11px">Presunto infractor '+(idx+1)+'</div>'+
      (idx>0?'<button type="button" class="btn bsm bd2" onclick="entregaRespQuitarInfractor('+idx+')">Quitar</button>':'')+
    '</div>'+
    '<div class="fg"><div class="fld"><label>Tipo de persona</label><select id="'+pref+'-tipo" onchange="syncEntregaRespInfractorCard('+idx+')" style="'+inpStyle+'">'+
      '<option value="natural"'+(tipo==='natural'?' selected':'')+'>Persona natural</option>'+
      '<option value="juridica"'+(tipo==='juridica'?' selected':'')+'>Persona jurídica</option></select></div></div>'+
    '<div id="'+pref+'-natural" style="'+(tipo==='juridica'?'display:none':'')+'"><div class="fg">'+
      '<div class="fld"><label>Nombre</label><input type="text" id="'+pref+'-nombre" value="'+escAttr(pi._pi_nombre||pi.nombre||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="'+pref+'-identificacion" value="'+escAttr(pi._pi_identificacion||pi.identificacion||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="'+pref+'-correo" value="'+escAttr(pi._pi_correo||pi.correo||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="'+pref+'-telefono" value="'+escAttr(pi._pi_telefono||pi.telefono||'')+'" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('inf'+idx,dirNat)+
    '</div></div>'+
    '<div id="'+pref+'-juridica" style="'+(tipo==='juridica'?'':'display:none')+'">'+
      '<div class="slbl" style="margin:.4rem 0;font-size:11px">Representante legal</div><div class="fg">'+
      '<div class="fld"><label>Nombre representante</label><input type="text" id="'+pref+'-rep-nombre" value="'+escAttr(pi._pi_rep_nombre||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="'+pref+'-rep-identificacion" value="'+escAttr(pi._pi_rep_identificacion||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="'+pref+'-rep-correo" value="'+escAttr(pi._pi_rep_correo||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="'+pref+'-rep-telefono" value="'+escAttr(pi._pi_rep_telefono||'')+'" style="'+inpStyle+'"></div>'+
      '</div><div class="slbl" style="margin:.4rem 0;font-size:11px">Empresa / entidad</div><div class="fg">'+
      '<div class="fld"><label>Razón social</label><input type="text" id="'+pref+'-empresa" value="'+escAttr(pi._pi_empresa||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>NIT</label><input type="text" id="'+pref+'-nit" value="'+escAttr(pi._pi_nit||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo empresa</label><input type="email" id="'+pref+'-correo-emp" value="'+escAttr(pi._pi_correo_emp||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono empresa</label><input type="tel" id="'+pref+'-telefono-emp" value="'+escAttr(pi._pi_telefono_emp||'')+'" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('infemp'+idx,dirEmp)+
    '</div></div></div>';
}

function htmlEntregaRespInteresadoBox(tramiteId){
  const tid=String(tramiteId||(document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
  const esSanc=typeof esTramiteSancionatorio==='function'&&esTramiteSancionatorio(tid);
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgT=typeof cfgFor==='function'?cfgFor(depto):{};
  const tiposSanc=cfgT.tiposSancionatorio||['Deforestación'];
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  let h='<div style="margin-top:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf)">';
  h+='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos de Registro'+(tid?' · '+(typeof getTram==='function'&&getTram(tid)?escAttr(getTram(tid).nombre):escAttr(tid)):'')+'</div>';
  if(!tid){
    h+='<div style="font-size:12px;color:var(--tx3)">Seleccione el tipo de trámite para ver los campos a diligenciar (igual que en Registro).</div></div>';
    return h;
  }
  if(esSanc){
    h+='<div class="fld" style="margin-bottom:8px"><label>Tipo de conducta / caso</label><select id="entrega-int-tipo-sanc" style="'+inpStyle+'">'+
      tiposSanc.map(function(t){return '<option value="'+escAttr(t)+'">'+escAttr(t)+'</option>';}).join('')+
      '</select></div>';
    h+='<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:500;margin-bottom:8px"><input type="checkbox" id="entrega-int-qd-anonimo" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--pu)"> Actúa como anónimo</label>';
    h+='<div id="entrega-int-qd-box"><div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Quejoso / denunciante</div><div class="fg">'+
      '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-qd-nombre" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-qd-identificacion" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-qd-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-qd-telefono" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('qd',{})+
      '</div></div>';
    h+='<div id="entrega-int-infractores-wrap"><div class="fx" style="justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">'+
      '<div class="slbl" style="margin:0;font-size:11px">Presuntos infractores</div>'+
      '<button type="button" class="btn bsm bp" onclick="entregaRespAddInfractor()">+ Añadir infractor</button></div>'+
      '<div id="entrega-int-infractores-list">'+htmlEntregaRespInfractorCard(0,{})+'</div></div>';
  }else{
    h+='<div class="fg"><div class="fld"><label>Tipo de persona</label><select id="entrega-int-tipo" onchange="syncEntregaRespInteresadoUi()" style="'+inpStyle+'"><option value="natural">Persona natural</option><option value="juridica">Persona jurídica</option></select></div></div>';
    h+='<div id="entrega-int-natural"><div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Persona natural</div><div class="fg">'+
      '<div class="fld"><label>Nombre <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-int-pn-nombre" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-pn-identificacion" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-pn-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-pn-telefono" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('pn',{})+
      '</div>'+
      '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;margin-top:8px"><input type="checkbox" id="entrega-int-est-com" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--bl)"> Tiene establecimiento comercial</label>'+
      '<div id="entrega-int-ec" style="display:none;margin-top:8px"><div class="slbl" style="margin-bottom:6px;font-size:11px">Establecimiento comercial</div><div class="fg">'+
      '<div class="fld"><label>Nombre del negocio</label><input type="text" id="entrega-int-ec-nombre" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-ec-telefono" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-ec-correo" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('ec',{})+
      '</div></div></div>';
    h+='<div id="entrega-int-juridica" style="display:none"><div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Representante legal</div><div class="fg">'+
      '<div class="fld"><label>Nombre representante</label><input type="text" id="entrega-int-pj-rep-nombre" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-pj-rep-identificacion" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-pj-rep-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-pj-rep-telefono" style="'+inpStyle+'"></div>'+
      '</div><div class="slbl" style="margin:.5rem 0 .35rem;font-size:11px">Empresa</div><div class="fg">'+
      '<div class="fld"><label>Nombre / razón social <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-int-pj-empresa" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>NIT</label><input type="text" id="entrega-int-pj-nit" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-pj-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-pj-telefono" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('pj',{})+
      '</div></div>';
  }
  h+=htmlEntregaRespApoAut({});
  h+='<div class="fld" style="margin-top:10px"><label>Medio de notificación</label>'+
    '<select id="entrega-int-medio-notif" style="'+inpStyle+'">'+
    '<option value="">— No indica —</option>'+
    '<option value="correo">Correo</option>'+
    '<option value="fisica">Física / presencial</option>'+
    '<option value="whatsapp">WhatsApp</option>'+
    '<option value="aviso">Aviso</option>'+
    '<option value="otro">Otro</option></select></div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:8px">El encargado revisará y podrá corregir estos datos en Registro antes de confirmar el expediente.</div></div>';
  return h;
}

function syncEntregaRespInfractorCard(idx){
  const pref='entrega-inf-'+idx;
  const tipo=String((document.getElementById(pref+'-tipo')||{}).value||'natural');
  const nat=document.getElementById(pref+'-natural');
  const jur=document.getElementById(pref+'-juridica');
  if(nat)nat.style.display=tipo==='juridica'?'none':'';
  if(jur)jur.style.display=tipo==='juridica'?'':'none';
}
function syncEntregaRespInfractoresUi(){
  document.querySelectorAll('.entrega-inf-card').forEach(function(card){
    const idx=Number(card.getAttribute('data-inf-idx')||0);
    syncEntregaRespInfractorCard(idx);
  });
}
function entregaRespAddInfractor(){
  const list=document.getElementById('entrega-int-infractores-list');
  if(!list)return;
  const n=list.querySelectorAll('.entrega-inf-card').length;
  list.insertAdjacentHTML('beforeend',htmlEntregaRespInfractorCard(n,{}));
  syncEntregaRespInfractorCard(n);
}
function entregaRespQuitarInfractor(idx){
  const card=document.querySelector('.entrega-inf-card[data-inf-idx="'+idx+'"]');
  if(card)card.remove();
  // Reindex visually by rebuilding from collected data
  const datos=collectEntregaRespInfractores();
  const list=document.getElementById('entrega-int-infractores-list');
  if(!list)return;
  if(!datos.length)datos.push({});
  list.innerHTML=datos.map(function(pi,i){return htmlEntregaRespInfractorCard(i,pi);}).join('');
  syncEntregaRespInfractoresUi();
}

function syncEntregaRespInteresadoUi(){
  const tipo=String((document.getElementById('entrega-int-tipo')||{}).value||'natural');
  const nat=document.getElementById('entrega-int-natural');
  const jur=document.getElementById('entrega-int-juridica');
  if(nat)nat.style.display=tipo==='juridica'?'none':'';
  if(jur)jur.style.display=tipo==='juridica'?'':'none';
  const est=!!((document.getElementById('entrega-int-est-com')||{}).checked);
  const ec=document.getElementById('entrega-int-ec');
  if(ec)ec.style.display=(tipo!=='juridica'&&est)?'':'none';
  const apo=!!((document.getElementById('entrega-int-apoderado')||{}).checked);
  const apoBox=document.getElementById('entrega-int-apo-box');
  if(apoBox)apoBox.style.display=apo?'':'none';
  const aut=!!((document.getElementById('entrega-int-autorizado')||{}).checked);
  const autBox=document.getElementById('entrega-int-aut-box');
  if(autBox)autBox.style.display=aut?'':'none';
  const anon=!!((document.getElementById('entrega-int-qd-anonimo')||{}).checked);
  const qdBox=document.getElementById('entrega-int-qd-box');
  if(qdBox)qdBox.style.display=anon?'none':'';
  syncEntregaRespInfractoresUi();
}

function _entregaIntVal(id){
  return String((document.getElementById(id)||{}).value||'').trim();
}
function _entregaIntDir(prefix){
  const o={};
  ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
    o['_'+prefix+'_'+k]=_entregaIntVal('entrega-int-'+prefix+'-'+k);
  });
  return o;
}

function collectEntregaRespInfractores(){
  const cards=document.querySelectorAll('.entrega-inf-card');
  const out=[];
  cards.forEach(function(card){
    const idx=Number(card.getAttribute('data-inf-idx')||0);
    const pref='entrega-inf-'+idx;
    const tipo=_entregaIntVal(pref+'-tipo')||'natural';
    const row={_pi_tipo_persona:tipo};
    if(tipo==='juridica'){
      Object.assign(row,{
        _pi_rep_nombre:_entregaIntVal(pref+'-rep-nombre'),
        _pi_rep_identificacion:_entregaIntVal(pref+'-rep-identificacion'),
        _pi_rep_correo:_entregaIntVal(pref+'-rep-correo'),
        _pi_rep_telefono:_entregaIntVal(pref+'-rep-telefono'),
        _pi_empresa:_entregaIntVal(pref+'-empresa'),
        _pi_nit:_entregaIntVal(pref+'-nit'),
        _pi_correo_emp:_entregaIntVal(pref+'-correo-emp'),
        _pi_telefono_emp:_entregaIntVal(pref+'-telefono-emp')
      },_entregaIntDir('infemp'+idx));
      // map emp dir to _pi_emp_*
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
        row['_pi_emp_'+k]=row['_infemp'+idx+'_'+k]||'';
        delete row['_infemp'+idx+'_'+k];
      });
    }else{
      Object.assign(row,{
        _pi_nombre:_entregaIntVal(pref+'-nombre'),
        _pi_identificacion:_entregaIntVal(pref+'-identificacion'),
        _pi_correo:_entregaIntVal(pref+'-correo'),
        _pi_telefono:_entregaIntVal(pref+'-telefono')
      },_entregaIntDir('inf'+idx));
      ['dep','mun','vereda','predio','barrio','direccion'].forEach(function(k){
        row['_pi_'+k]=row['_inf'+idx+'_'+k]||'';
        delete row['_inf'+idx+'_'+k];
      });
    }
    const has=tipo==='juridica'?(row._pi_empresa||row._pi_nit||row._pi_rep_nombre):(row._pi_nombre||row._pi_identificacion);
    if(has||idx===0)out.push(row);
  });
  return out;
}

function collectEntregaRespInteresado(){
  const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
  const esSanc=typeof esTramiteSancionatorio==='function'&&esTramiteSancionatorio(tid);
  const out={
    _apoderado:!!((document.getElementById('entrega-int-apoderado')||{}).checked),
    _autorizado:!!((document.getElementById('entrega-int-autorizado')||{}).checked),
    _medio_notificacion:_entregaIntVal('entrega-int-medio-notif')||''
  };
  if(out._apoderado){
    Object.assign(out,{
      _apo_nombre:_entregaIntVal('entrega-int-apo-nombre'),
      _apo_identificacion:_entregaIntVal('entrega-int-apo-identificacion'),
      _apo_correo:_entregaIntVal('entrega-int-apo-correo'),
      _apo_telefono:_entregaIntVal('entrega-int-apo-telefono')
    },_entregaIntDir('apo'));
  }
  if(out._autorizado){
    Object.assign(out,{
      _aut_nombre:_entregaIntVal('entrega-int-aut-nombre'),
      _aut_identificacion:_entregaIntVal('entrega-int-aut-identificacion'),
      _aut_correo:_entregaIntVal('entrega-int-aut-correo'),
      _aut_telefono:_entregaIntVal('entrega-int-aut-telefono')
    },_entregaIntDir('aut'));
  }
  if(esSanc){
    out._tipo_sancionatorio=_entregaIntVal('entrega-int-tipo-sanc')||'';
    out._qd_anonimo=!!((document.getElementById('entrega-int-qd-anonimo')||{}).checked);
    if(!out._qd_anonimo){
      Object.assign(out,{
        _qd_nombre:_entregaIntVal('entrega-int-qd-nombre'),
        _qd_identificacion:_entregaIntVal('entrega-int-qd-identificacion'),
        _qd_correo:_entregaIntVal('entrega-int-qd-correo'),
        _qd_telefono:_entregaIntVal('entrega-int-qd-telefono')
      },_entregaIntDir('qd'));
    }
    const infr=collectEntregaRespInfractores();
    out._presuntos_infractores=JSON.stringify(infr);
    if(infr[0])Object.assign(out,infr[0]);
    out._tipo_persona='natural';
    out._est_com=false;
  }else{
    const tipo=_entregaIntVal('entrega-int-tipo')||'natural';
    out._tipo_persona=tipo;
    out._est_com=false;
    if(tipo==='juridica'){
      Object.assign(out,{
        _pj_rep_nombre:_entregaIntVal('entrega-int-pj-rep-nombre'),
        _pj_rep_identificacion:_entregaIntVal('entrega-int-pj-rep-identificacion'),
        _pj_rep_correo:_entregaIntVal('entrega-int-pj-rep-correo'),
        _pj_rep_telefono:_entregaIntVal('entrega-int-pj-rep-telefono'),
        _pj_empresa:_entregaIntVal('entrega-int-pj-empresa'),
        _pj_nit:_entregaIntVal('entrega-int-pj-nit'),
        _pj_correo:_entregaIntVal('entrega-int-pj-correo'),
        _pj_telefono:_entregaIntVal('entrega-int-pj-telefono')
      },_entregaIntDir('pj'));
    }else{
      Object.assign(out,{
        _pn_nombre:_entregaIntVal('entrega-int-pn-nombre'),
        _pn_identificacion:_entregaIntVal('entrega-int-pn-identificacion'),
        _pn_correo:_entregaIntVal('entrega-int-pn-correo'),
        _pn_telefono:_entregaIntVal('entrega-int-pn-telefono'),
        _est_com:!!((document.getElementById('entrega-int-est-com')||{}).checked)
      },_entregaIntDir('pn'));
      if(out._est_com){
        Object.assign(out,{
          _ec_nombre:_entregaIntVal('entrega-int-ec-nombre'),
          _ec_telefono:_entregaIntVal('entrega-int-ec-telefono'),
          _ec_correo:_entregaIntVal('entrega-int-ec-correo')
        },_entregaIntDir('ec'));
      }
    }
  }
  return out;
}

function applyEntregaRespInteresadoToExp(e,datos){
  if(!e||!datos)return;
  Object.keys(datos).forEach(function(k){e[k]=datos[k];});
}

function validateEntregaRespInteresado(datos){
  if(!datos)return'Sin datos del interesado';
  const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
  const esSanc=typeof esTramiteSancionatorio==='function'&&esTramiteSancionatorio(tid);
  if(esSanc){
    if(!datos._qd_anonimo&&!datos._qd_nombre)return'Indique el nombre del quejoso / denunciante (o márquelo anónimo)';
    try{
      const arr=typeof datos._presuntos_infractores==='string'?JSON.parse(datos._presuntos_infractores||'[]'):(datos._presuntos_infractores||[]);
      const first=arr[0]||{};
      const ok=first._pi_tipo_persona==='juridica'?(first._pi_empresa||first._pi_rep_nombre):(first._pi_nombre);
      if(!ok)return'Indique al menos un presunto infractor';
    }catch(err){
      if(!datos._pi_nombre&&!datos._pi_empresa)return'Indique al menos un presunto infractor';
    }
    return'';
  }
  if(datos._tipo_persona==='juridica'){
    if(!datos._pj_empresa)return'Indique el nombre / razón social del interesado';
  }else if(!datos._pn_nombre){
    return'Indique el nombre del interesado';
  }
  return'';
}

function tramitesEntregaRespOptsHtml(){
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfg=typeof cfgFor==='function'?cfgFor(depto):{};
  const list=(cfg.tramites||[]).filter(function(t){
    if(!t||!t.id)return false;
    if(typeof esTramitePqrs==='function'&&esTramitePqrs(t.id))return false;
    return true;
  });
  if(!list.length)return '<option value="">— Sin trámites configurados —</option>';
  return '<option value="">— Seleccione trámite —</option>'+list.map(function(t){
    return '<option value="'+escAttr(t.id)+'">'+escAttr(t.nombre||t.id)+'</option>';
  }).join('');
}

function openEntregaResponsableModal(){
  if(!puedeEntregarComoResponsable()){
    notif('Seleccione su nombre como responsable para entregar un documento','err');
    return;
  }
  const ov=document.getElementById('task-modal-overlay');
  const tit=document.getElementById('task-modal-title');
  const body=document.getElementById('task-modal-body');
  const modal=ov?ov.querySelector('.task-modal'):null;
  if(!ov||!body)return;
  if(tit)tit.textContent='Entregar documento · '+responsableActivo;
  if(modal){
    modal.classList.add('task-modal-wide');
    modal.classList.add('enviar-modal-only');
  }
  body.innerHTML=
    '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-existente" checked onchange="syncEntregaRespModoUi()"> Expediente / PQRSD existente</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-nuevo" onchange="syncEntregaRespModoUi()"> Crear expediente (1ª entrega)</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-libre" onchange="syncEntregaRespModoUi()"> Sin expediente</label>'+
    '</div>'+
    '<div id="entrega-resp-exist-box">'+
      '<div class="fld" style="margin-bottom:8px"><label>Buscar expediente / PQRSD</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="entrega-resp-exp" placeholder="N° expediente, PQRSD o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="filtrarExpEntregaRespSug(this)" onfocus="filtrarExpEntregaRespSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-exp-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="entrega-resp-exp-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="entrega-resp-exp-hint" style="font-size:11px;color:var(--tx3);margin-top:4px">Busca en trámites y PQRSD.</div>'+
      '</div>'+
    '</div>'+
    '<div id="entrega-resp-alta-box" style="display:none">'+
      '<div class="fg" style="margin-bottom:4px">'+
        '<div class="fld"><label>N° expediente <span style="color:var(--rd)">*</span></label>'+
          '<input type="text" id="entrega-resp-exp-nuevo" placeholder="Número del expediente (p. ej. el de VITAL)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '<div class="fld"><label>Tipo de trámite <span style="color:var(--rd)">*</span></label>'+
          '<select id="entrega-resp-tramite" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" onchange="syncEntregaRespAltaFormPorTramite()">'+tramitesEntregaRespOptsHtml()+'</select></div>'+
      '</div>'+
      '<div id="entrega-resp-persona-host">'+htmlEntregaRespInteresadoBox()+'</div>'+
    '</div>'+
    '<div id="entrega-resp-libre-hint" style="display:none;font-size:11px;color:var(--tx3);margin-bottom:8px;padding:8px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r)">Misma vía que <strong>+ Actividad sin expediente</strong> del encargado: se crea la actividad, usted entrega y pasa a <strong>Por revisar</strong>. Si el encargado ya la asignó, ábrala desde Actividades y entregue allí.</div>'+
    '<div class="fld" style="margin-bottom:8px;margin-top:10px"><label>Actividad predeterminada <span style="color:var(--rd)">*</span></label>'+
      '<div style="position:relative">'+
        '<input type="text" id="entrega-resp-actividad" placeholder="Escriba para buscar y elija de la lista…" autocomplete="off" '+
          'oninput="filtrarActEntregaRespSug(this)" onfocus="filtrarActEntregaRespSug(this)" '+
          'onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-act-sug\');if(p)p.style.display=\'none\';},200)" '+
          'style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+
        '<div id="entrega-resp-act-sug" class="entrega-resp-sug" style="display:none"></div>'+
      '</div>'+
      '<div id="entrega-resp-reg-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div></div>'+
    '<div id="entrega-resp-registro-box" style="display:none;margin-bottom:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label>'+
      '<input type="text" id="entrega-resp-detalle" placeholder="Detalles de la actividad" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div id="entrega-resp-pqrs-box" style="display:none;margin-bottom:10px"></div>'+
    '<div id="entrega-resp-tramite-files">'+
    '<div class="fld" style="margin-bottom:10px"><label>Documento principal</label>'+
      '<div class="sst-file-pick">'+
        '<button type="button" class="btn bsm bp" onclick="document.getElementById(\'enviar-adj-file\').click()">📎 Seleccionar archivo</button>'+
        '<input type="file" id="enviar-adj-file" accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="syncEntregaRespFileLabel(this,\'entrega-resp-file-name\')">'+
        '<span id="entrega-resp-file-name" class="sst-file-pick-name">Sin archivo seleccionado</span>'+
      '</div>'+
      '<div id="entrega-resp-drive-hint" style="font-size:10px;color:var(--tx3);margin-top:4px">Se sube al Drive institucional del expediente (carpeta EXP-…).</div></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Anexos (opcionales)</label>'+
      '<div class="sst-file-pick">'+
        '<button type="button" class="btn bsm" onclick="document.getElementById(\'enviar-anexos-file\').click()">📎 Seleccionar anexos</button>'+
        '<input type="file" id="enviar-anexos-file" multiple accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="syncEntregaRespFileLabel(this,\'entrega-resp-anexos-name\',true)">'+
        '<span id="entrega-resp-anexos-name" class="sst-file-pick-name">Sin anexos</span>'+
      '</div></div>'+
    '</div>'+
    '<input type="hidden" id="enviar-requiere-link" value="0">'+
    '<input type="hidden" id="enviar-modo-nueva" value="0">'+
    '<input type="hidden" id="enviar-modo-traslado" value="0">'+
    '<div id="enviar-adjuntos-rows" style="display:none"></div>'+
    '<textarea id="enviar-cmt-opcional" placeholder="Comentario sobre esta entrega (obligatorio si no adjunta archivo)…" '+
      'style="min-height:72px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;margin-bottom:8px;width:100%"></textarea>'+
    '<div class="fx" style="gap:8px">'+
      '<button type="button" class="btn bsm bp" onclick="submitEntregaResponsable()">📤 Entregar a revisión</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'entregaResponsable'};
  syncEntregaRespModoUi();
  syncEntregaRespAltaFormPorTramite();
  syncEntregaRespInteresadoUi();
  syncEntregaRespRegistroUi();
  syncEntregaRespPqrsUi();
  setTimeout(function(){
    const a=document.getElementById('entrega-resp-actividad');
    if(a){a.focus();filtrarActEntregaRespSug(a);}
  },80);
}

function syncEntregaRespFileLabel(inp,labelId,multi){
  const nm=document.getElementById(labelId);
  if(!nm||!inp)return;
  const files=inp.files?Array.from(inp.files):[];
  if(!files.length){nm.textContent=multi?'Sin anexos':'Sin archivo seleccionado';return;}
  if(multi)nm.textContent=files.length===1?(files[0].name||'1 archivo'):(files.length+' archivos seleccionados');
  else nm.textContent=files[0].name||'Archivo seleccionado';
}

function listActividadesPredEntregaResp(){
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgAct=typeof getCfgActividadesPred==='function'?getCfgActividadesPred(depto):(typeof cfgFor==='function'?cfgFor(depto):null);
  return (cfgAct&&cfgAct.actividadesPred)||[];
}

function actividadPredEntregaExiste(nombre){
  const nom=String(nombre||'').trim().toLowerCase();
  if(!nom)return false;
  return listActividadesPredEntregaResp().some(function(a){return String(a||'').trim().toLowerCase()===nom;});
}

function msgActividadPredNoExiste(){
  return 'Esa actividad predeterminada no está configurada. Contacte al administrador para que la agregue en Configuración → Actividades predeterminadas.';
}

function filtrarActEntregaRespSug(inp){
  const portal=document.getElementById('entrega-resp-act-sug');
  if(!portal||!inp)return;
  const q=String(inp.value||'').trim().toLowerCase();
  const words=q.split(/\s+/).filter(Boolean);
  const base=listActividadesPredEntregaResp();
  if(!base.length){
    portal.style.display='block';
    portal.innerHTML='<div style="padding:8px 10px;font-size:12px;color:var(--or)">No hay actividades predeterminadas configuradas. Contacte al administrador.</div>';
    syncEntregaRespRegistroUi();
    return;
  }
  const acts=base.filter(function(a){
    const s=String(a||'').toLowerCase();
    return !words.length||words.every(function(w){return s.includes(w);});
  }).slice(0,20);
  if(!acts.length){
    portal.style.display=q?'block':'none';
    portal.innerHTML=q?'<div style="padding:8px 10px;font-size:12px;color:var(--or)">No hay coincidencias. Si la actividad no existe en la lista, contacte al administrador para que la configure.</div>':'';
    syncEntregaRespRegistroUi();
    return;
  }
  portal.innerHTML=acts.map(function(a){
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();pickActEntregaResp(\''+
      String(a).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+escAttr(a)+'</button>';
  }).join('');
  portal.style.display='block';
  syncEntregaRespRegistroUi();
}

function pickActEntregaResp(val){
  const inp=document.getElementById('entrega-resp-actividad');
  if(inp)inp.value=val||'';
  const portal=document.getElementById('entrega-resp-act-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  syncEntregaRespRegistroUi();
}

/** Tipo de Registro asociado a la actividad (concepto | factura | acto | ninguno | ''). */
function resolveActividadRegistroTipo(nombreAct,deptoId){
  const nom=String(nombreAct||'').trim();
  if(!nom)return'';
  const cfgAct=typeof getCfgActividadesPred==='function'?getCfgActividadesPred(deptoId):(typeof cfgFor==='function'?cfgFor(deptoId):null);
  const map=(cfgAct&&cfgAct.actRegistroMap)||{};
  if(map[nom]!=null&&map[nom]!=='')return String(map[nom]);
  const s=nom.toLowerCase();
  if(/concepto/.test(s))return'concepto';
  if(/factura|liquidaci[oó]n|tasa|multa|tcaf/.test(s))return'factura';
  if(/acto|resoluci[oó]n|auto de|proyectar acto/.test(s))return'acto';
  return'';
}
function syncEntregaRespRegistroUi(){
  const act=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const box=document.getElementById('entrega-resp-registro-box');
  const hint=document.getElementById('entrega-resp-reg-hint');
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  if(libre){
    if(hint)hint.textContent='Sin expediente: no aplica Registro (concepto/factura/acto).';
    if(box){box.style.display='none';box.innerHTML='';}
    return;
  }
  // PQRSD: no mini-form de Registro (concepto/factura/acto) — solo sobre PQRSD existente
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const eSel=!nuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  if(eSel&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(eSel))||(typeof esTramitePqrs==='function'&&esTramitePqrs(eSel._tramite)))){
    if(hint)hint.textContent='PQRSD existente: complete los datos de respuesta abajo. El archivo irá a la carpeta PQRSD.';
    if(box){box.style.display='none';box.innerHTML='';}
    return;
  }
  const tipo=resolveActividadRegistroTipo(act);
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgAct=typeof cfgFor==='function'?cfgFor(depto):{};
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  if(hint){
    if(!act)hint.textContent='';
    else if(!actividadPredEntregaExiste(act))hint.innerHTML='<span style="color:var(--or)">Esta actividad no está en la lista predeterminada. Contacte al administrador para configurarla.</span>';
    else if(tipo==='concepto')hint.textContent='Apartado Registro: Seguimiento / conceptos técnicos.';
    else if(tipo==='factura')hint.textContent='Apartado Registro: Información contable (Evaluación, TCAF, etc.).';
    else if(tipo==='acto')hint.textContent='Apartado Registro: Normatividad legal / actos administrativos.';
    else if(tipo==='ninguno')hint.textContent='Solo actividad (sin datos de Registro asociados).';
    else hint.textContent='Sin mapeo a Registro — el administrador puede configurarlo en Actividades predeterminadas.';
  }
  if(!box)return;
  if(!act||!actividadPredEntregaExiste(act)||!tipo||tipo==='ninguno'){box.style.display='none';box.innerHTML='';return;}
  box.style.display='';
  const hoyStr=typeof hoy==='function'?hoy():'';
  if(tipo==='concepto'){
    const coordBlock=typeof coordHtml==='function'
      ?('<div class="fld" style="grid-column:1/-1;margin-top:6px"><label>Coordenadas (opcional)</label>'+coordHtml('entrega-reg-concepto-coord','')+'</div>')
      :'';
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Seguimiento · Concepto técnico</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>N° concepto técnico</label><input type="text" id="entrega-reg-concepto" placeholder="N° concepto" style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha seguimiento</label><input type="date" id="entrega-reg-concepto-fecha" value="'+hoyStr+'" style="'+inp+'"></div>'+
      '<div class="fld"><label>¿Cumple?</label><select id="entrega-reg-concepto-cumple" onchange="syncEntregaRespConceptoCumpleUi()" style="'+inp+'"><option value="si">Cumple</option><option value="no">No cumple</option></select></div>'+
      '<div class="fld" style="grid-column:1/-1"><label>Observaciones / recomendaciones</label><textarea id="entrega-reg-concepto-obs" style="min-height:55px;'+inp+'"></textarea></div>'+
      coordBlock+
      '</div>'+
      '<div id="entrega-reg-concepto-req" style="display:none;margin-top:10px;padding:8px;border-left:3px solid var(--or);background:var(--sf)">'+
        '<div style="font-size:11px;font-weight:600;color:var(--or);margin-bottom:6px">Requerimiento por incumplimiento</div><div class="fg">'+
        '<div class="fld"><label>N° requerimiento</label><input type="text" id="entrega-reg-concepto-req-num" style="'+inp+'"></div>'+
        '<div class="fld"><label>Fecha notificación</label><input type="date" id="entrega-reg-concepto-req-notif" style="'+inp+'"></div>'+
        '<div class="fld"><label>Días para cumplir</label><input type="number" id="entrega-reg-concepto-req-dias" min="0" style="'+inp+'"></div>'+
      '</div></div>';
  }else if(tipo==='factura'){
    const tipos=(cfgAct.tiposFactura||['Evaluación','Publicación','Seguimiento','TCAF','Multa','Visita adicional','Tasa retributiva'])
      .map(function(t){return '<option value="'+escAttr(t)+'">'+escAttr(t)+'</option>';}).join('');
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Información contable · Factura</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>Tipo de factura <span style="color:var(--rd)">*</span></label><select id="entrega-reg-fac-tipo" style="'+inp+'"><option value="">— Seleccione (Evaluación, TCAF…) —</option>'+tipos+'</select></div>'+
      '<div class="fld"><label>Valor (pesos)</label><input type="number" id="entrega-reg-fac-valor" step="any" min="0" placeholder="0" style="'+inp+'"></div>'+
      '<div class="fld"><label>Referencia / N°</label><input type="text" id="entrega-reg-fac-ref" placeholder="N° / ref." style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha vencimiento</label><input type="date" id="entrega-reg-fac-venc" style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha pago (si ya pagó)</label><input type="date" id="entrega-reg-fac-pago" style="'+inp+'"></div>'+
      '</div>';
  }else if(tipo==='acto'){
    const actos=(cfgAct.tiposActoAdmin||[]).map(function(t){
      const n=t.nombre||t;
      return '<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>';
    }).join('');
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Normatividad legal · Acto / resolución</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>Tipo de acto <span style="color:var(--rd)">*</span></label><select id="entrega-reg-acto-tipo" onchange="syncEntregaRespActoVencUi()" style="'+inp+'"><option value="">— Seleccione —</option>'+actos+'</select></div>'+
      '<div class="fld"><label>N° acto administrativo</label><input type="text" id="entrega-reg-acto-num" placeholder="Número" style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha del acto</label><input type="date" id="entrega-reg-acto-fecha" value="'+hoyStr+'" style="'+inp+'"></div>'+
      '<div class="fld" id="entrega-reg-acto-venc-wrap"><label>Fecha de vencimiento</label><input type="date" id="entrega-reg-acto-venc" style="'+inp+'"></div>'+
      '</div>';
    setTimeout(syncEntregaRespActoVencUi,0);
  }
}
function syncEntregaRespConceptoCumpleUi(){
  const cumple=String((document.getElementById('entrega-reg-concepto-cumple')||{}).value||'si');
  const box=document.getElementById('entrega-reg-concepto-req');
  if(box)box.style.display=cumple==='no'?'':'none';
}
function syncEntregaRespActoVencUi(){
  const tipoNom=String((document.getElementById('entrega-reg-acto-tipo')||{}).value||'').trim();
  const wrap=document.getElementById('entrega-reg-acto-venc-wrap');
  if(!wrap)return;
  let show=true;
  if(typeof getTipoActo==='function'&&tipoNom){
    const t=getTipoActo(tipoNom);
    show=!!(t&&t.tieneVencimiento);
  }
  wrap.style.display=show?'':'none';
  if(!show){
    const v=document.getElementById('entrega-reg-acto-venc');
    if(v)v.value='';
  }
}
function collectEntregaRespRegistroPayload(actividad){
  const tipo=resolveActividadRegistroTipo(actividad);
  if(!tipo||tipo==='ninguno')return null;
  if(tipo==='concepto'){
    const cumple=String((document.getElementById('entrega-reg-concepto-cumple')||{}).value||'si');
    const coordEl=document.getElementById('entrega-reg-concepto-coord');
    if(coordEl&&typeof coordSync==='function'){
      try{coordSync('entrega-reg-concepto-coord',null,true);}catch(err){}
    }
    const coordenadas=coordEl?String(coordEl.value||'').trim():'';
    return{tipo:'concepto',item:{
      fecha:String((document.getElementById('entrega-reg-concepto-fecha')||{}).value||(typeof hoy==='function'?hoy():'')),
      concepto:String((document.getElementById('entrega-reg-concepto')||{}).value||'').trim(),
      observaciones:String((document.getElementById('entrega-reg-concepto-obs')||{}).value||'').trim(),
      cumple:cumple,
      coordenadas:coordenadas,
      reqNum:cumple==='no'?String((document.getElementById('entrega-reg-concepto-req-num')||{}).value||'').trim():'',
      reqNotif:cumple==='no'?String((document.getElementById('entrega-reg-concepto-req-notif')||{}).value||''):'',
      reqDias:cumple==='no'?String((document.getElementById('entrega-reg-concepto-req-dias')||{}).value||''):'',
      reqVence:cumple==='no'&&typeof calcReqVence==='function'
        ?calcReqVence((document.getElementById('entrega-reg-concepto-req-notif')||{}).value,(document.getElementById('entrega-reg-concepto-req-dias')||{}).value)
        :'',
      reqCumplido:false,reqFechaCump:'',trasladoSan:false,expSan:''
    }};
  }
  if(tipo==='factura'){
    const valorRaw=String((document.getElementById('entrega-reg-fac-valor')||{}).value||'').trim();
    return{tipo:'factura',item:{
      tipo:String((document.getElementById('entrega-reg-fac-tipo')||{}).value||'').trim(),
      valor:valorRaw,
      ref:String((document.getElementById('entrega-reg-fac-ref')||{}).value||'').trim(),
      venc:String((document.getElementById('entrega-reg-fac-venc')||{}).value||''),
      pago:String((document.getElementById('entrega-reg-fac-pago')||{}).value||''),
      persVenc:'',coacFecha:'',acuerdoPago:false
    }};
  }
  if(tipo==='acto'){
    return{tipo:'acto',item:{
      tipo:String((document.getElementById('entrega-reg-acto-tipo')||{}).value||'').trim(),
      numero:String((document.getElementById('entrega-reg-acto-num')||{}).value||'').trim(),
      fecha:String((document.getElementById('entrega-reg-acto-fecha')||{}).value||(typeof hoy==='function'?hoy():'')),
      vencimiento:String((document.getElementById('entrega-reg-acto-venc')||{}).value||''),
      prorrogas:[],trasladoSan:false,expSan:'',archivoNum:'',archivoFecha:''
    }};
  }
  return null;
}
function appendRegistroDesdeEntrega(e,payload){
  if(!e||!payload||!payload.item)return false;
  const item=payload.item;
  if(payload.tipo==='concepto'){
    const arr=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
    if(!item.concepto&&!item.observaciones&&!item.coordenadas)return false;
    arr.push(item);
    e._conceptos_seg=JSON.stringify(arr);
    if(item.coordenadas)appendCoordEntregaAInfoTecnica(e,item.coordenadas);
    return true;
  }
  if(payload.tipo==='factura'){
    const arr=typeof facturasData==='function'?facturasData(e._facturas_extra):[];
    if(!item.tipo&&!item.ref&&!item.valor)return false;
    arr.push(item);
    e._facturas_extra=JSON.stringify(arr);
    return true;
  }
  if(payload.tipo==='acto'){
    const arr=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
    const clean=typeof cleanActoForStore==='function'?cleanActoForStore(item):item;
    if(!clean.tipo&&!clean.numero)return false;
    arr.push(clean);
    e._actos_admin=JSON.stringify(arr);
    if(clean.numero&&!e._resolucion){e._resolucion=clean.numero;e._fecha_res=clean.fecha||'';}
    return true;
  }
  return false;
}

/** Guarda coordenadas de la entrega en información técnica (campo coordenadas del catálogo o g_coord_entrega). */
function appendCoordEntregaAInfoTecnica(e,coordJson){
  if(!e||!coordJson)return;
  const tramId=typeof resolveExpTramiteId==='function'?resolveExpTramiteId(e):(e._tramite||'');
  const cat=typeof getInfoTecCatalogForTramite==='function'
    ?getInfoTecCatalogForTramite(e,tramId)
    :(typeof getInfoTecCatalog==='function'?getInfoTecCatalog(e):[]);
  const def=(cat||[]).find(function(c){return c&&c.tipo==='coordenadas';});
  const campoId=def?def.id:'coord_entrega';
  const items=typeof infoTecnicaExpData==='function'?infoTecnicaExpData(e._info_tecnica_items):[];
  const idx=items.findIndex(function(it){return it&&it.campoId===campoId;});
  if(idx>=0)items[idx].valor=coordJson;
  else items.push({campoId:campoId,valor:coordJson});
  e._info_tecnica_items=JSON.stringify(items);
  e['g_'+campoId]=coordJson;
}

function findTaskEntregaRespDedupe(e,actividad,responsable){
  if(!e||!actividad||!responsable)return null;
  const actN=String(actividad).trim().toLowerCase();
  const respN=typeof agendaNorm==='function'?agendaNorm(responsable):String(responsable).toLowerCase();
  return (e.tasks||[]).map(function(t){return typeof normalizeTask==='function'?normalizeTask(t):t;}).find(function(t){
    if(!t||t.eliminada)return false;
    const est=typeof estadoTask==='function'?estadoTask(t):t.estado;
    if(est==='Atendida')return false;
    const sameAct=String(t.actividad||t.desc||'').trim().toLowerCase()===actN
      ||String(t.actividad||'').trim().toLowerCase()===actN;
    if(!sameAct)return false;
    if(typeof taskUsuarioEsAsignado==='function')return taskUsuarioEsAsignado(t,responsable);
    return (typeof agendaNorm==='function'?agendaNorm(t.responsable):String(t.responsable||'').toLowerCase())===respN;
  })||null;
}

function buildTaskEntregaResponsable(actividad,detalle,responsable){
  const id=typeof genTaskId==='function'?genTaskId():('tk_'+Date.now());
  const t={
    id:id,
    actividad:String(actividad||'').trim(),
    detalle:String(detalle||'').trim(),
    desc:'',
    responsable:responsable,
    responsables:[responsable],
    asignados:[{nombre:responsable,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}],
    entregaModo:'individual',
    plazoDias:'',
    vence:'',
    fechaAtendida:'',
    fechaReportada:'',
    estado:'En ejecución',
    prioritaria:false,
    eliminada:false,
    comentarios:[],
    historial:[{
      tipo:'autoasignacion_responsable',
      fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10),
      por:responsable,
      nota:'Actividad sin expediente creada por el responsable al entregar (mismo flujo que asignación del encargado)'
    }],
    soportes:[],
    notasDoc:[],
    autoAsignadaPorResponsable:true,
    origen:'responsable'
  };
  t.desc=t.actividad+(t.detalle?' - '+t.detalle:'');
  return typeof normalizeTask==='function'?normalizeTask(t):t;
}

function crearStubExpedienteEntregaResp(opts){
  opts=opts||{};
  const expId=String(opts.expId||'').trim();
  const tid=String(opts.tramiteId||'').trim();
  const interesadoDatos=opts.interesadoDatos||null;
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare');
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  if(!expId){notif('Indique el número de expediente','err');return null;}
  if(!tid){notif('Seleccione el tipo de trámite','err');return null;}
  if(typeof esTramitePqrs==='function'&&esTramitePqrs(tid)){
    notif('Las PQRSD solo las radica Secretaría. Busque una PQRSD existente para entregar el documento.','err');
    return null;
  }
  if(typeof getExpById==='function'&&getExpById(expId)){notif('Ya existe un expediente con ese número — use modo «existente»','err');return null;}
  if(typeof expNumeroDuplicado==='function'&&expNumeroDuplicado(expId)){
    notif('Número de expediente duplicado','err');
    return null;
  }
  const fe={Solicitud:hoyStr,'En trámite':hoyStr};
  const data={
    _depto:depto,
    _tramite:tid,
    _exp:expId,
    _estado:'En trámite',
    _fecha:hoyStr,
    _fechas_estado:JSON.stringify(fe),
    _usar_etapa:false,
    _etapa:'',
    _instructor:'',
    _alta_por_responsable:true,
    _alta_por:responsableActivo||'',
    _alta_fecha:hoyStr,
    _pendiente_revision_alta:true,
    _alta_revisada_en:'',
    _alta_revisada_por:'',
    _tipo_persona:'natural',
    _pn_nombre:'',
    _pn_identificacion:'',
    _pn_correo:'',
    _pn_telefono:'',
    _est_com:false,
    _facturas_extra:'[]',
    _actos_admin:'[]',
    _conceptos_seg:'[]',
    _expedientes_asociados:'[]',
    _info_tecnica_items:'[]',
    tasks:[],
    historial:[{
      estado:'En trámite',
      fecha:hoyStr,
      nota:'Alta por responsable ('+(responsableActivo||'')+') al entregar primera actividad'
    }]
  };
  if(interesadoDatos)applyEntregaRespInteresadoToExp(data,interesadoDatos);
  if(typeof syncFechasEstadoConEstado==='function')syncFechasEstadoConEstado(data);
  if(!Array.isArray(exps))exps=[];
  exps.push(data);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(data,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(typeof logAudit==='function')logAudit('Alta expediente por responsable ['+expId+']','expedientes',expId);
  return data;
}

function ensureExpTaskEntregaResponsable(){
  const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const actividad=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const detalle=String((document.getElementById('entrega-resp-detalle')||{}).value||'').trim();
  if(!actividad){notif('Indique la actividad predeterminada','err');return null;}
  if(!actividadPredEntregaExiste(actividad)){
    notif(msgActividadPredNoExiste(),'err');
    return null;
  }
  if(!responsableActivo){notif('Seleccione su nombre como responsable','err');return null;}

  // Sin expediente: actividad libre autoasignada al responsable
  if(libre){
    const deptoLibre=typeof resolveDeptoActLibre==='function'
      ?resolveDeptoActLibre()
      :(typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare'));
    const deptoOk=(deptoLibre&&deptoLibre!=='responsables')?deptoLibre:'guaviare';
    const cod=typeof genCodigoActLibre==='function'?genCodigoActLibre(deptoOk):('ACT-'+Date.now());
    let t=buildTaskEntregaResponsable(actividad,detalle,responsableActivo);
    t=typeof normalizeActLibre==='function'?normalizeActLibre(Object.assign(t,{
      depto:deptoOk,
      codigo:cod,
      sinExpediente:true,
      autoAsignadaPorResponsable:true,
      origen:'responsable'
    })):Object.assign(t,{depto:deptoOk,codigo:cod,sinExpediente:true});
    if(!Array.isArray(actividadesLibres))actividadesLibres=[];
    t._pending_fs_sync=true;
    t._pending_fs_at=Date.now();
    actividadesLibres.push(t);
    // Solo local aquí: el envío a verificación persistirá en Firestore.
    // Evita que un snapshot remoto antiguo pise la actividad antes de subir el archivo.
    if(typeof persistExpLocal==='function')persistExpLocal();
    window._pendingActLibreEntrega={id:t.id,codigo:t.codigo,t:t};
    return{e:null,t:t,expId:t.codigo,taskId:t.id,createdStub:false,createdTask:true,registroTipo:'',esPqrs:false,sinExpediente:true};
  }

  let e=null;
  let createdStub=false;
  let interesadoDatos=null;
  if(nuevo){
    const expNuevo=String((document.getElementById('entrega-resp-exp-nuevo')||{}).value||'').trim();
    const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
    interesadoDatos=collectEntregaRespInteresado();
    const errInt=validateEntregaRespInteresado(interesadoDatos);
    if(errInt){notif(errInt,'err');return null;}
    const existing=typeof getExpById==='function'?getExpById(expNuevo):null;
    if(existing){
      e=existing;
      applyEntregaRespInteresadoToExp(e,interesadoDatos);
      if(!e._alta_por_responsable){
        e._alta_por_responsable=true;
        e._pendiente_revision_alta=true;
        e._alta_por=responsableActivo||'';
        e._alta_fecha=typeof hoy==='function'?hoy():'';
      }
      notif('El expediente ya existía — se actualizarán datos del interesado y se vinculará la entrega','warn');
    }else{
      e=crearStubExpedienteEntregaResp({expId:expNuevo,tramiteId:tid,interesadoDatos:interesadoDatos});
      if(!e)return null;
      createdStub=true;
    }
  }else{
    const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
    if(!expNum){notif('Busque y seleccione el expediente o PQRSD','err');return null;}
    e=typeof getExpById==='function'?getExpById(expNum):null;
    if(!e){notif('No encontrado. Use «Crear expediente» si es un trámite nuevo (no PQRSD), o «Sin expediente» para oficios sin radicado.','err');return null;}
  }

  const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  // PQRSD: la actividad debe ser «Atender PQRSD…» para entrar al flujo y carpetas PQRSD
  let actFinal=actividad;
  if(esPqrs){
    if(!String(actFinal).startsWith('Atender PQRSD'))
      actFinal='Atender PQRSD'+(actividad?' — '+actividad:'');
  }

  e.tasks=Array.isArray(e.tasks)?e.tasks:[];
  let t=findTaskEntregaRespDedupe(e,actFinal,responsableActivo);
  if(!t&&esPqrs){
    t=(e.tasks||[]).map(function(x){return typeof normalizeTask==='function'?normalizeTask(x):x;}).find(function(x){
      if(!x||x.eliminada)return false;
      if(typeof taskEsAtenderPqrs==='function'&&!taskEsAtenderPqrs(x,e))return false;
      const est=typeof estadoTask==='function'?estadoTask(x):x.estado;
      if(est==='Atendida')return false;
      if(typeof taskUsuarioEsAsignado==='function')return taskUsuarioEsAsignado(x,responsableActivo);
      return true;
    })||null;
  }
  let createdTask=false;
  if(!t){
    t=buildTaskEntregaResponsable(actFinal,detalle,responsableActivo);
    e.tasks.push(t);
    createdTask=true;
  }else{
    if(detalle&&!t.detalle)t.detalle=detalle;
    t.autoAsignadaPorResponsable=!!(t.autoAsignadaPorResponsable||t.origen==='responsable');
    if(typeof ensureAsignado==='function')ensureAsignado(t,responsableActivo);
  }
  t.desc=(t.actividad||'')+(t.detalle?' - '+t.detalle:'');
  const regPayload=(!esPqrs)?collectEntregaRespRegistroPayload(actividad):null;
  if(regPayload){
    if(regPayload.tipo==='factura'&&!regPayload.item.tipo){
      notif('Seleccione el tipo de factura (Evaluación, TCAF, etc.)','err');
      return null;
    }
    if(regPayload.tipo==='acto'&&!regPayload.item.tipo){
      notif('Seleccione el tipo de acto / resolución','err');
      return null;
    }
    if(regPayload.tipo==='factura'&&regPayload.item.ref&&typeof validarNumeroFacturaDisponible==='function'){
      if(!validarNumeroFacturaDisponible(regPayload.item.ref,null,null))return null;
    }
    if(regPayload.tipo==='concepto'&&regPayload.item.concepto&&typeof validarNumeroConceptoDisponible==='function'){
      if(!validarNumeroConceptoDisponible(regPayload.item.concepto,null,null))return null;
    }
    appendRegistroDesdeEntrega(e,regPayload);
  }
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(createdTask&&typeof isFormExpVisible==='function'&&isFormExpVisible(e._exp)&&typeof syncTkRowsFromExp==='function'){
    try{syncTkRowsFromExp(e._exp,t.id);}catch(err){}
  }
  return{e:e,t:t,expId:e._exp,taskId:t.id,createdStub:createdStub,createdTask:createdTask,registroTipo:regPayload?regPayload.tipo:'',esPqrs:esPqrs,sinExpediente:false};
}

function submitEntregaResponsable(){
  if(!puedeEntregarComoResponsable()){notif('No puede entregar en esta sesión','err');return;}
  const adj=typeof collectEnviarAdjuntos==='function'?collectEnviarAdjuntos():{links:[],files:[],anexos:[]};
  const cmt=String((document.getElementById('enviar-cmt-opcional')||{}).value||'').trim();
  const hasAdj=(adj.links&&adj.links.length)||(adj.files&&adj.files.length)||(adj.anexos&&adj.anexos.length);
  // En PQRSD el cuerpo/oficio también cuentan como contenido de entrega
  const esPqrsUi=!!document.getElementById('pqrs-entrega-campos');
  if(!hasAdj&&!cmt&&!esPqrsUi){
    notif('Adjunte documento, anexo, link Drive y/o escriba un comentario','err');
    return;
  }
  const pack=ensureExpTaskEntregaResponsable();
  if(!pack)return;
  // Reutilizar el envío a verificación ya implementado (Drive + Por verificar / flujo PQRSD)
  if(typeof submitEnviarSoporteVerificacion==='function'){
    window._taskModalCtx={expId:pack.expId,taskId:pack.taskId,mode:'enviar',entregaResponsable:true,actLibre:!!pack.sinExpediente};
    if(pack.sinExpediente&&pack.t){
      window._pendingActLibreEntrega={id:pack.taskId,codigo:pack.expId,t:pack.t};
    }
    submitEnviarSoporteVerificacion(pack.expId,pack.taskId);
    if(typeof setActFiltro==='function'){
      try{setActFiltro('porver');}catch(err){}
    }
    return;
  }
  notif('No se pudo completar el envío a verificación','err');
}

function updateActRespActionsUi(){
  const bar=document.getElementById('act-resp-actions');
  const modoResp=(typeof esModoResponsable==='function'&&esModoResponsable())
    ||(typeof esModoContratista==='function'&&esModoContratista());
  const juris=typeof esJurisdiccional==='function'&&esJurisdiccional();
  const show=puedeEntregarComoResponsable();
  if(!bar)return;
  bar.style.display=(modoResp&&!juris)?'flex':'none';
  const hint=document.getElementById('act-resp-entrega-hint');
  if(hint)hint.style.display=show?'none':'';
  const btn=document.getElementById('btn-entrega-resp');
  if(btn)btn.style.display=show?'':'none';
}

window.puedeEntregarComoResponsable=puedeEntregarComoResponsable;
window.openEntregaResponsableModal=openEntregaResponsableModal;
window.submitEntregaResponsable=submitEntregaResponsable;
window.filtrarExpEntregaRespSug=filtrarExpEntregaRespSug;
window.pickExpEntregaResp=pickExpEntregaResp;
window.syncEntregaRespModoUi=syncEntregaRespModoUi;
window.syncEntregaRespPqrsUi=syncEntregaRespPqrsUi;
window.updateActRespActionsUi=updateActRespActionsUi;
window.syncEntregaRespRegistroUi=syncEntregaRespRegistroUi;
window.resolveActividadRegistroTipo=resolveActividadRegistroTipo;
window.filtrarActEntregaRespSug=filtrarActEntregaRespSug;
window.pickActEntregaResp=pickActEntregaResp;
window.syncEntregaRespFileLabel=syncEntregaRespFileLabel;
window.syncEntregaRespInteresadoUi=syncEntregaRespInteresadoUi;
window.syncEntregaRespAltaFormPorTramite=syncEntregaRespAltaFormPorTramite;
window.syncEntregaRespInfractorCard=syncEntregaRespInfractorCard;
window.entregaRespAddInfractor=entregaRespAddInfractor;
window.entregaRespQuitarInfractor=entregaRespQuitarInfractor;
window.syncEntregaRespConceptoCumpleUi=syncEntregaRespConceptoCumpleUi;
window.syncEntregaRespActoVencUi=syncEntregaRespActoVencUi;

/** Expediente creado por responsable y aún pendiente de revisión/corrección del encargado. */
function expPendienteRevisionAlta(e){
  if(!e)return false;
  if(e._pendiente_revision_alta===false)return false;
  if(e._pendiente_revision_alta===true)return true;
  return !!(e._alta_por_responsable&&!e._alta_revisada_en);
}
function puedeRevisarAltaExpediente(e){
  if(!e||!expPendienteRevisionAlta(e))return false;
  if(typeof esJurisdiccional==='function'&&esJurisdiccional())return false;
  if(typeof esModoResponsable==='function'&&esModoResponsable()&&!(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto()))return false;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())return true;
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(typeof esNcaDeguv==='function'&&esNcaDeguv())return true;
  return !(typeof esModoResponsable==='function'&&esModoResponsable());
}
function expAltaResponsableBadgeHtml(e){
  // Etiqueta «Alta por revisar» desactivada: no es necesaria en la UI
  return'';
}
function resumenAltaEntregaHtml(e){
  if(!e)return'';
  const bits=[];
  const nom=typeof getNom==='function'?getNom(e):'';
  if(nom)bits.push('<strong>Interesado:</strong> '+escAttr(nom));
  if(e._tipo_persona==='juridica'&&e._pj_nit)bits.push('NIT '+escAttr(e._pj_nit));
  else if(e._pn_identificacion)bits.push('ID '+escAttr(e._pn_identificacion));
  if(e._pn_correo||e._pj_correo)bits.push(escAttr(e._pn_correo||e._pj_correo));
  try{
    const concepts=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
    if(concepts.length){
      const c=concepts[concepts.length-1];
      bits.push('<strong>Concepto:</strong> '+(c.concepto?escAttr(c.concepto):'—')+(c.cumple==='no'?' · No cumple':''));
    }
    const facs=typeof facturasData==='function'?facturasData(e._facturas_extra):[];
    if(facs.length){
      const f=facs[facs.length-1];
      bits.push('<strong>Factura:</strong> '+escAttr(f.tipo||'—')+(f.ref?' · '+escAttr(f.ref):'')+(f.valor?' · $'+escAttr(String(f.valor)):''));
    }
    const actos=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
    if(actos.length){
      const a=actos[actos.length-1];
      bits.push('<strong>Acto:</strong> '+escAttr(a.tipo||'—')+(a.numero?' · '+escAttr(a.numero):''));
    }
  }catch(err){}
  if(!bits.length)return'';
  return '<div style="margin-top:6px;font-size:11px;color:#9a3412">'+bits.join(' · ')+'</div>';
}
function renderAltaResponsableBannerHtml(e,opts){
  opts=opts||{};
  if(!e||!e._alta_por_responsable)return'';
  const pend=expPendienteRevisionAlta(e);
  // Tras aprobar alta o documento: no seguir mostrando el aviso en el flujo
  if(!pend)return'';
  const por=escAttr(e._alta_por||'responsable');
  const fecha=escAttr(typeof fmtF==='function'?fmtF(e._alta_fecha||''):(e._alta_fecha||''));
  const can=puedeRevisarAltaExpediente(e);
  let btns='';
  if(can&&opts.expId){
    const tid=opts.taskId?String(opts.taskId):'';
    btns='<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px">'+
      '<button type="button" class="btn bsm bp" onclick="abrirCorregirAltaDesdeRevision(\''+escAttr(opts.expId)+'\''+(tid?',\''+escAttr(tid)+'\'':'')+')">✏️ Revisar / editar datos de Registro</button>'+
      '<button type="button" class="btn bsm" onclick="marcarAltaExpedienteRevisada(\''+escAttr(opts.expId)+'\')">✓ Marcar alta revisada</button>'+
      '</div>';
  }
  return '<div class="alta-resp-banner" style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:#fff7ed;border:1px solid #fdba74;font-size:12px;color:#9a3412;line-height:1.45">'+
    '<strong>⏳ Alta por responsable — revise datos de Registro y el documento</strong><br>'+
    'Creado por <strong>'+por+'</strong>'+(fecha?' el '+fecha:'')+'. Verifique interesado, concepto/factura/acto y el soporte; puede editar los campos en Registro y luego aprobar el documento.'+
    resumenAltaEntregaHtml(e)+
    btns+'</div>';
}
function marcarAltaExpedienteRevisada(expId,opts){
  opts=opts||{};
  expId=String(expId||'').trim();
  const e=typeof getExpById==='function'?getExpById(expId):null;
  if(!e){notif('Expediente no encontrado','err');return false;}
  if(!expPendienteRevisionAlta(e)){notif('La alta ya estaba revisada','ok');return true;}
  if(!puedeRevisarAltaExpediente(e)&&!opts.force){notif('Solo el encargado del departamento puede marcar la alta como revisada','err');return false;}
  const quien=opts.por||(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')||responsableActivo||'';
  const fecha=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  e._pendiente_revision_alta=false;
  e._alta_revisada_en=fecha;
  e._alta_revisada_por=quien;
  if(!Array.isArray(e.historial))e.historial=[];
  e.historial.push({estado:e._estado||'En trámite',fecha:fecha,nota:'Alta por responsable revisada / corregida por '+quien});
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(typeof refreshTaskViews==='function')refreshTaskViews();
  if(typeof renderConSidePanel==='function'&&document.getElementById('con-side-panel')&&document.getElementById('con-side-panel').classList.contains('on'))
    renderConSidePanel();
  if(!opts.silent)notif('✓ Alta del expediente marcada como revisada','ok');
  const ctx=window._taskModalCtx||{};
  if(ctx.expId&&String(ctx.expId)===expId&&typeof openTaskCommentsModal==='function'&&ctx.taskId)
    openTaskCommentsModal(ctx.expId,ctx.taskId);
  return true;
}
function abrirCorregirAltaDesdeRevision(expId,taskId){
  expId=String(expId||'').trim();
  if(!expId)return;
  if(typeof closeTaskModal==='function')closeTaskModal();
  if(typeof abrirConsultaExpPanel==='function'){
    abrirConsultaExpPanel(expId,{allowSingle:true,edit:true});
    notif('Corrija los datos del expediente y guarde. Al guardar como encargado se marcará la alta como revisada.','ok');
  }else if(typeof editarExp==='function'){
    editarExp(expId);
  }else{
    notif('No se pudo abrir la edición del expediente','err');
  }
}
function maybeClearPendienteRevisionAltaOnSave(exp,opts){
  opts=opts||{};
  if(!exp||!expPendienteRevisionAlta(exp))return false;
  // Solo encargado / depto / admin — no el responsable que creó el stub
  if(typeof esModoResponsable==='function'&&esModoResponsable()&&!(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto()))
    return false;
  const quien=opts.por||(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')||'';
  const fecha=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  exp._pendiente_revision_alta=false;
  exp._alta_revisada_en=fecha;
  exp._alta_revisada_por=quien;
  if(!Array.isArray(exp.historial))exp.historial=[];
  exp.historial.push({estado:exp._estado||'En trámite',fecha:fecha,nota:'Alta por responsable revisada al guardar correcciones · '+quien});
  return true;
}

/** Quita el flag de alta al aprobar el documento o la creación (encargado / flujo firma). */
function clearAltaResponsableAlAprobarDocumento(expId,opts){
  opts=opts||{};
  expId=String(expId||'').trim();
  if(!expId)return false;
  return marcarAltaExpedienteRevisada(expId,{silent:true,force:!!opts.force,por:opts.por});
}

window.expPendienteRevisionAlta=expPendienteRevisionAlta;
window.puedeRevisarAltaExpediente=puedeRevisarAltaExpediente;
window.expAltaResponsableBadgeHtml=expAltaResponsableBadgeHtml;
window.renderAltaResponsableBannerHtml=renderAltaResponsableBannerHtml;
window.marcarAltaExpedienteRevisada=marcarAltaExpedienteRevisada;
window.abrirCorregirAltaDesdeRevision=abrirCorregirAltaDesdeRevision;
window.maybeClearPendienteRevisionAltaOnSave=maybeClearPendienteRevisionAltaOnSave;
window.clearAltaResponsableAlAprobarDocumento=clearAltaResponsableAlAprobarDocumento;

// =============================================================================
// Vincular actividad sin expediente → expediente / PQRSD (revisión encargado)
// =============================================================================

function renderActLibreVincularHtml(expId,taskId){
  const tid=escAttr(taskId);
  return '<div id="act-libre-vinc-box" style="margin-bottom:10px;padding:10px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">'+
    '<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:6px">🔗 Asociar a expediente / PQRSD</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">La entrega queda vinculada al radicado. Los archivos en carpeta <strong>ACT-…</strong> se <strong>mueven</strong> a la carpeta Drive del expediente o PQRSD y la carpeta temporal se elimina. Puede asociar a un <strong>expediente o PQRSD existente</strong>, o <strong>crear un expediente</strong> (las PQRSD solo las radica Secretaría).</div>'+
    '<div class="fx" style="gap:12px;flex-wrap:wrap;margin-bottom:8px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="act-libre-vinc-modo" id="act-libre-vinc-existente" checked onchange="syncActLibreVincularUi()"> Existente</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="act-libre-vinc-modo" id="act-libre-vinc-nuevo" onchange="syncActLibreVincularUi()"> Crear expediente</label>'+
    '</div>'+
    '<div id="act-libre-vinc-exist-box">'+
      '<div class="fld" style="margin-bottom:6px"><label>Buscar expediente / PQRSD</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="act-libre-vinc-exp" placeholder="N° expediente, PQRSD o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="filtrarExpActLibreVincSug(this)" onfocus="filtrarExpActLibreVincSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'act-libre-vinc-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="act-libre-vinc-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="act-libre-vinc-hint" style="font-size:11px;color:var(--tx3);margin-top:4px">Busca en trámites y PQRSD.</div>'+
      '</div>'+
    '</div>'+
    '<div id="act-libre-vinc-nuevo-box" style="display:none">'+
      '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Alta de <strong>trámite</strong> únicamente. Para PQRSD use «Existente» (radicada por Secretaría).</div>'+
      '<div class="fg" style="margin-bottom:4px">'+
        '<div class="fld"><label>N° expediente <span style="color:var(--rd)">*</span></label>'+
          '<input type="text" id="act-libre-vinc-exp-nuevo" placeholder="Número del expediente" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '<div class="fld"><label>Tipo de trámite <span style="color:var(--rd)">*</span></label>'+
          '<select id="act-libre-vinc-tramite" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+tramitesEntregaRespOptsHtml()+'</select></div>'+
      '</div>'+
      htmlEntregaRespInteresadoBox()+
    '</div>'+
    '<div class="fx" style="gap:8px;margin-top:10px">'+
      '<button type="button" class="btn bsm bp" onclick="submitVincularActLibre(\''+tid+'\')">🔗 Vincular actividad</button>'+
    '</div>'+
  '</div>';
}

function syncActLibreVincularUi(){
  const nuevo=!!((document.getElementById('act-libre-vinc-nuevo')||{}).checked);
  const boxEx=document.getElementById('act-libre-vinc-exist-box');
  const boxNu=document.getElementById('act-libre-vinc-nuevo-box');
  if(boxEx)boxEx.style.display=nuevo?'none':'';
  if(boxNu)boxNu.style.display=nuevo?'':'none';
  if(nuevo&&typeof syncEntregaRespInteresadoUi==='function')syncEntregaRespInteresadoUi();
}

function filtrarExpActLibreVincSug(inp){
  const portal=document.getElementById('act-libre-vinc-sug');
  if(!portal||!inp)return;
  const list=typeof buscarExpedientesEntregaResp==='function'?buscarExpedientesEntregaResp(inp.value,12):[];
  if(!list.length){portal.style.display='none';portal.innerHTML='';return;}
  portal.innerHTML=list.map(function(e){
    const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
    const tramNom=tram?tram.nombre:'Trámite';
    const nom=typeof getNom==='function'?getNom(e):'';
    const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
      ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
    const tag=esPqrs?'<span style="color:#6d3fa8;font-weight:600">PQRSD</span> · ':'<span style="color:var(--bl)">Trámite</span> · ';
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();pickExpActLibreVinc(\''+
      String(e._exp||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+
      tag+'<strong>'+escAttr(e._exp)+'</strong> · '+escAttr(tramNom)+' · '+escAttr(nom)+'</button>';
  }).join('');
  portal.style.display='block';
}

function pickExpActLibreVinc(expNum){
  const inp=document.getElementById('act-libre-vinc-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('act-libre-vinc-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const hint=document.getElementById('act-libre-vinc-hint');
  const e=typeof getExpById==='function'?getExpById(expNum):null;
  if(hint){
    if(e){
      const tram=typeof getTram==='function'?getTram(e._tramite,e):null;
      const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
        ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
      hint.innerHTML='Seleccionado: <strong>'+escAttr(e._exp)+'</strong> · '+
        (esPqrs?'<span style="color:#6d3fa8">PQRSD</span>':'Trámite')+' · '+
        escAttr(tram?tram.nombre:'')+' · '+escAttr(typeof getNom==='function'?getNom(e):'');
    }else hint.textContent='No encontrado — cree un expediente abajo o verifique el número.';
  }
}

function crearStubExpedienteDesdeRevisionLibre(opts){
  opts=opts||{};
  const expId=String(opts.expId||'').trim();
  const tid=String(opts.tramiteId||'').trim();
  const interesadoDatos=opts.interesadoDatos||null;
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare');
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  if(!expId){notif('Indique el número de expediente','err');return null;}
  if(!tid){notif('Seleccione el tipo de trámite','err');return null;}
  if(typeof esTramitePqrs==='function'&&esTramitePqrs(tid)){
    notif('Las PQRSD solo las radica Secretaría. Asocie a una PQRSD existente.','err');
    return null;
  }
  if(typeof getExpById==='function'&&getExpById(expId)){notif('Ya existe un expediente con ese número — use «Existente»','err');return null;}
  if(typeof expNumeroDuplicado==='function'&&expNumeroDuplicado(expId)){
    notif('Número de expediente duplicado','err');
    return null;
  }
  const fe={Solicitud:hoyStr,'En trámite':hoyStr};
  const data={
    _depto:depto,
    _tramite:tid,
    _exp:expId,
    _estado:'En trámite',
    _fecha:hoyStr,
    _fechas_estado:JSON.stringify(fe),
    _usar_etapa:false,
    _etapa:'',
    _instructor:'',
    _alta_por_responsable:false,
    _pendiente_revision_alta:false,
    _tipo_persona:'natural',
    _pn_nombre:'',
    _pn_identificacion:'',
    _pn_correo:'',
    _pn_telefono:'',
    _est_com:false,
    _facturas_extra:'[]',
    _actos_admin:'[]',
    _conceptos_seg:'[]',
    _expedientes_asociados:'[]',
    _info_tecnica_items:'[]',
    tasks:[],
    historial:[{
      estado:'En trámite',
      fecha:hoyStr,
      nota:'Alta por encargado al vincular actividad sin expediente · '+(por||'')
    }]
  };
  if(interesadoDatos&&typeof applyEntregaRespInteresadoToExp==='function')
    applyEntregaRespInteresadoToExp(data,interesadoDatos);
  if(typeof syncFechasEstadoConEstado==='function')syncFechasEstadoConEstado(data);
  if(!Array.isArray(exps))exps=[];
  exps.push(data);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(data,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(typeof logAudit==='function')logAudit('Alta expediente al vincular act. libre ['+expId+']','expedientes',expId);
  return data;
}

/** Mueve la actividad libre al expediente (conserva soportes, estado, historial). */
function vincularActLibreAExpediente(taskId,e){
  if(!e||!e._exp)return null;
  const lib=typeof getActLibreById==='function'?getActLibreById(taskId):null;
  if(!lib||lib.eliminada){notif('Actividad sin expediente no encontrada','err');return null;}
  const codLibre=lib.codigo||'';
  const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
    ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
  const por=typeof taskComentarioAutor==='function'?taskComentarioAutor():'';
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);

  // Clonar tarea y limpiar flags de libre
  let t=typeof normalizeTask==='function'?normalizeTask(Object.assign({},lib)):Object.assign({},lib);
  t.sinExpediente=false;
  t.codigoLibreOrigen=codLibre;
  delete t.codigo;
  delete t.depto; // el depto queda en el expediente
  if(!Array.isArray(t.historial))t.historial=[];
  t.historial.push({
    tipo:'vinculo_expediente',
    fecha:hoyStr,
    por:por,
    nota:'Vinculada a '+(esPqrs?'PQRSD':'expediente')+' '+e._exp+(codLibre?' (antes '+codLibre+')':'')
  });

  if(esPqrs){
    const act=String(t.actividad||'').trim();
    if(!act.startsWith('Atender PQRSD'))
      t.actividad='Atender PQRSD'+(act?' — '+act:'');
    t.desc=(t.actividad||'')+(t.detalle?' - '+t.detalle:'');
  }

  e.tasks=Array.isArray(e.tasks)?e.tasks:[];
  // Evitar id duplicado
  if(e.tasks.some(function(x){return x&&x.id===t.id;})){
    t.id=(typeof genTaskId==='function'?genTaskId():('tk_'+Date.now()));
  }
  e.tasks.push(t);

  // Si la PQRSD aún no está en revisión/firma/notif, pasar a revisión NCA (hay entrega pendiente)
  if(esPqrs&&typeof setPqrsWorkflow==='function'&&typeof PQRS_WF!=='undefined'){
    const est=typeof estadoTask==='function'?estadoTask(t):t.estado;
    const fase=typeof pqrsWorkflowFase==='function'?pqrsWorkflowFase(e):'';
    const avanzadas=[PQRS_WF.PARA_FIRMA,PQRS_WF.POR_FIRMAR,PQRS_WF.PENDIENTE_NOTIF,PQRS_WF.LISTA_ENVIO,PQRS_WF.REVISION_FINAL,PQRS_WF.CERRADA];
    if(est==='Por verificar'&&avanzadas.indexOf(fase)<0){
      const sop=typeof getSoporteActivo==='function'?getSoporteActivo(t):null;
      const docs=[];
      if(sop&&(sop.url||sop.preview||sop.driveLink)){
        docs.push({
          nombre:sop.nombre||sop.label||'Proyección de respuesta',
          driveLink:sop.url||sop.driveLink||'',
          previewLink:sop.preview||sop.url||'',
          fileId:sop.driveFileId||sop.fileId||'',
          tipo:'drive'
        });
      }
      const patch={fase:PQRS_WF.PENDIENTE_REVISION,entregado_por:t.responsable||por};
      if(docs.length)patch.documentos=docs;
      setPqrsWorkflow(e,patch);
    }
  }

  // Quitar de actividades libres
  if(Array.isArray(actividadesLibres)){
    const ix=actividadesLibres.findIndex(function(x){return x&&x.id===taskId;});
    if(ix>=0)actividadesLibres.splice(ix,1);
  }

  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  if(typeof saveLS==='function')saveLS();
  else if(typeof persistExpLocal==='function')persistExpLocal();

  if(typeof logAudit==='function')
    logAudit('Actividad libre vinculada a '+e._exp+(codLibre?' ← '+codLibre:''),'actividades',e._exp);

  return{e:e,t:t,expId:e._exp,taskId:t.id,esPqrs:esPqrs};
}

function submitVincularActLibre(taskId){
  if(typeof puedeGestionarActividadesDepto==='function'&&!puedeGestionarActividadesDepto()){
    notif('Solo el encargado del departamento puede vincular la actividad','err');
    return;
  }
  taskId=String(taskId||'').trim();
  if(!taskId){notif('Actividad no indicada','err');return;}
  const lib=typeof getActLibreById==='function'?getActLibreById(taskId):null;
  if(!lib){notif('Actividad sin expediente no encontrada','err');return;}

  const nuevo=!!((document.getElementById('act-libre-vinc-nuevo')||{}).checked);
  let e=null;
  if(nuevo){
    const expNuevo=String((document.getElementById('act-libre-vinc-exp-nuevo')||{}).value||'').trim();
    const tid=String((document.getElementById('act-libre-vinc-tramite')||{}).value||'').trim();
    const interesadoDatos=typeof collectEntregaRespInteresado==='function'?collectEntregaRespInteresado():null;
    if(typeof validateEntregaRespInteresado==='function'){
      const errInt=validateEntregaRespInteresado(interesadoDatos);
      if(errInt){notif(errInt,'err');return;}
    }
    e=crearStubExpedienteDesdeRevisionLibre({expId:expNuevo,tramiteId:tid,interesadoDatos:interesadoDatos});
    if(!e)return;
  }else{
    const expNum=String((document.getElementById('act-libre-vinc-exp')||{}).value||'').trim();
    if(!expNum){notif('Busque y seleccione el expediente o PQRSD','err');return;}
    e=typeof getExpById==='function'?getExpById(expNum):null;
    if(!e){notif('No encontrado. Use «Crear expediente» si es un trámite nuevo (no PQRSD).','err');return;}
  }

  const pack=vincularActLibreAExpediente(taskId,e);
  if(!pack)return;

  const finUi=function(migMsg){
    notif('Actividad vinculada a '+(pack.esPqrs?'PQRSD':'expediente')+' '+pack.expId+(migMsg?' · '+migMsg:''),'ok');
    if(typeof renderActividades==='function')renderActividades();
    if(typeof renderConsulta==='function'&&document.getElementById('pg-con')&&document.getElementById('pg-con').classList.contains('on'))
      renderConsulta();
    if(typeof openTaskCommentsModal==='function')
      openTaskCommentsModal(pack.expId,pack.taskId);
  };

  // Mover archivos ACT-… → carpeta del expediente/PQRSD y eliminar carpeta temporal
  const hasDrive=!!(pack.t&&(pack.t._drive_folder_id||(pack.t.soportes||[]).some(function(s){return s&&(s.driveFileId||s.fileId);})));
  if(hasDrive&&typeof driveMigrateActLibreSoportesAlVincular==='function'){
    (typeof sstSolicitarGmailParaAdjuntar==='function'?sstSolicitarGmailParaAdjuntar():Promise.resolve(true)).then(function(okG){
      if(!okG){finUi('archivos quedan en carpeta ACT (sin Gmail)');return;}
      if(typeof sstCargaShow==='function'){
        sstCargaShow({
          title:'Moviendo documentos',
          message:pack.esPqrs?'Trasladando a carpeta PQRSD…':'Trasladando a carpeta del expediente…',
          sub:'Se eliminará la carpeta temporal ACT si queda vacía',
          pct:20
        });
      }
      driveMigrateActLibreSoportesAlVincular(pack.t,pack.e).then(function(mig){
        if(typeof sstCargaProgress==='function')sstCargaProgress(90,'Guardando…');
        // Persistir task ya sin _drive_folder ACT + carpeta destino en expediente
        const eLive=typeof getExpById==='function'?getExpById(pack.expId):pack.e;
        if(eLive){
          if(mig&&mig.destFolderId&&!pack.esPqrs){
            eLive._drive_folder_id=eLive._drive_folder_id||mig.destFolderId;
            eLive._drive_folder_link=eLive._drive_folder_link||mig.folderLink||'';
          }
          const tk=(eLive.tasks||[]).find(function(x){return x&&x.id===pack.taskId;});
          if(tk){
            if(mig&&(mig.deletedFolder||mig.moved)){
              delete tk._drive_folder_id;
              delete tk._drive_folder_link;
            }
            if(Array.isArray(pack.t.soportes))tk.soportes=pack.t.soportes;
          }
          if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(eLive,false);
          else if(typeof persistExpLocal==='function')persistExpLocal();
        }
        if(typeof sstCargaDone==='function')sstCargaDone({holdMs:200});
        let migMsg='';
        if(mig&&mig.moved)migMsg=mig.moved+' archivo(s) movido(s)'+(mig.deletedFolder?' · carpeta ACT eliminada':'');
        else if(mig&&mig.skipped)migMsg='sin archivos Drive que mover';
        else migMsg='vínculo listo (revise Drive si no se movieron archivos)';
        finUi(migMsg);
      }).catch(function(err){
        console.warn('migrate act libre drive:',err);
        if(typeof sstCargaHide==='function')sstCargaHide();
        finUi('vinculada; no se pudieron mover archivos Drive: '+String(err&&err.message||err).slice(0,60));
      });
    });
    return;
  }
  finUi('');
}

window.renderActLibreVincularHtml=renderActLibreVincularHtml;
window.syncActLibreVincularUi=syncActLibreVincularUi;
window.filtrarExpActLibreVincSug=filtrarExpActLibreVincSug;
window.pickExpActLibreVinc=pickExpActLibreVinc;
window.submitVincularActLibre=submitVincularActLibre;
window.vincularActLibreAExpediente=vincularActLibreAExpediente;
