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
  const filtro=String((document.getElementById('entrega-resp-ambito')||{}).value||'todos');
  const out=[];
  (exps||[]).forEach(function(e){
    if(!e||!e._exp)return;
    const esPqrs=(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
      ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite));
    if(filtro==='tramite'&&esPqrs)return;
    if(filtro==='pqrsd'&&!esPqrs)return;
    const ed=String(e._depto||'').trim();
    const ofi=String(e._pqrs_oficina||'').trim();
    if(!esPqrs){
      if(ed&&depto&&ed!==depto&&ed!=='guaviare')return;
    }
    // PQRSD: visible para responsables (todas las oficinas / depto)
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
  const boxNuevo=document.getElementById('entrega-resp-alta-box');
  const boxExist=document.getElementById('entrega-resp-exist-box');
  if(boxNuevo)boxNuevo.style.display=nuevo?'':'none';
  if(boxExist)boxExist.style.display=nuevo?'none':'';
  if(nuevo){
    const hint=document.getElementById('entrega-resp-exp-hint');
    if(hint)hint.textContent='';
  }
  syncEntregaRespPqrsUi();
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

function htmlEntregaRespInteresadoBox(){
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  return '<div style="margin-top:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos del interesado (Registro)</div>'+
    '<div class="fg">'+
    '<div class="fld"><label>Tipo de persona</label><select id="entrega-int-tipo" onchange="syncEntregaRespInteresadoUi()" style="'+inpStyle+'"><option value="natural">Persona natural</option><option value="juridica">Persona jurídica</option></select></div>'+
    '</div>'+
    '<div id="entrega-int-natural">'+
      '<div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Persona natural</div><div class="fg">'+
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
      '</div></div>'+
    '</div>'+
    '<div id="entrega-int-juridica" style="display:none">'+
      '<div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Representante legal</div><div class="fg">'+
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
      '</div>'+
    '</div>'+
    '<div style="font-size:10px;color:var(--tx3);margin-top:6px">El encargado revisará estos datos junto con el documento. Puede corregirlos en Registro antes de marcar la alta como revisada.</div>'+
  '</div>';
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

function collectEntregaRespInteresado(){
  const tipo=_entregaIntVal('entrega-int-tipo')||'natural';
  const out={_tipo_persona:tipo,_est_com:false};
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
  return out;
}

function applyEntregaRespInteresadoToExp(e,datos){
  if(!e||!datos)return;
  Object.keys(datos).forEach(function(k){e[k]=datos[k];});
}

function validateEntregaRespInteresado(datos){
  if(!datos)return'Sin datos del interesado';
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
    '</div>'+
    '<div id="entrega-resp-exist-box">'+
      '<div class="fx" style="gap:10px;flex-wrap:wrap;margin-bottom:8px;align-items:center">'+
        '<span style="font-size:11px;font-weight:600;color:var(--tx2)">Buscar en:</span>'+
        '<select id="entrega-resp-ambito" onchange="filtrarExpEntregaRespSug(document.getElementById(\'entrega-resp-exp\'))" style="padding:6px 8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px">'+
          '<option value="todos">Trámites y PQRSD</option>'+
          '<option value="tramite">Solo trámites</option>'+
          '<option value="pqrsd">Solo PQRSD</option>'+
        '</select>'+
      '</div>'+
      '<div class="fld" style="margin-bottom:8px"><label>Buscar expediente / PQRSD</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="entrega-resp-exp" placeholder="N° expediente, PQRSD o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="filtrarExpEntregaRespSug(this)" onfocus="filtrarExpEntregaRespSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-exp-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="entrega-resp-exp-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="entrega-resp-exp-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div>'+
      '</div>'+
    '</div>'+
    '<div id="entrega-resp-alta-box" style="display:none">'+
      '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Alta nueva solo para <strong>trámites</strong>. Las <strong>PQRSD</strong> las radica Secretaría; aquí solo se vinculan existentes (busque arriba).</div>'+
      '<div class="fg" style="margin-bottom:4px">'+
        '<div class="fld"><label>N° expediente <span style="color:var(--rd)">*</span></label>'+
          '<input type="text" id="entrega-resp-exp-nuevo" placeholder="Número del expediente (p. ej. el de VITAL)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '<div class="fld"><label>Tipo de trámite <span style="color:var(--rd)">*</span></label>'+
          '<select id="entrega-resp-tramite" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+tramitesEntregaRespOptsHtml()+'</select></div>'+
      '</div>'+
      htmlEntregaRespInteresadoBox()+
    '</div>'+
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
  const cat=typeof getInfoTecCatalog==='function'?getInfoTecCatalog(e):[];
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
      nota:'Actividad creada por el responsable al entregar documento'
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
  const actividad=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const detalle=String((document.getElementById('entrega-resp-detalle')||{}).value||'').trim();
  if(!actividad){notif('Indique la actividad predeterminada','err');return null;}
  if(!actividadPredEntregaExiste(actividad)){
    notif(msgActividadPredNoExiste(),'err');
    return null;
  }
  if(!responsableActivo){notif('Seleccione su nombre como responsable','err');return null;}

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
    if(!e){notif('No encontrado. Use «Crear expediente» si es un trámite nuevo (no PQRSD).','err');return null;}
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
    // Reutilizar tarea Atender PQRSD abierta del mismo responsable
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
    appendRegistroDesdeEntrega(e,regPayload);
  }
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(createdTask&&typeof isFormExpVisible==='function'&&isFormExpVisible(e._exp)&&typeof syncTkRowsFromExp==='function'){
    try{syncTkRowsFromExp(e._exp,t.id);}catch(err){}
  }
  return{e:e,t:t,expId:e._exp,taskId:t.id,createdStub:createdStub,createdTask:createdTask,registroTipo:regPayload?regPayload.tipo:'',esPqrs:esPqrs};
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
    window._taskModalCtx={expId:pack.expId,taskId:pack.taskId,mode:'enviar',entregaResponsable:true};
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
  if(!e||!e._alta_por_responsable)return'';
  // Solo mientras esté pendiente; al aprobar alta/documento desaparece del flujo
  if(!expPendienteRevisionAlta(e))return'';
  return '<span class="bdg" style="background:#fff7ed;color:#c2410c;border:1px solid #fdba74;font-size:10px;margin-left:4px" title="Alta creada por responsable — pendiente de revisión del departamento">⏳ Alta por revisar</span>';
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
