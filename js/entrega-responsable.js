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
  const q=String(inp.value||'').trim();
  const list=buscarExpedientesEntregaResp(q,12);
  const ql=q.toLowerCase();
  const exact=q&&typeof getExpById==='function'?getExpById(q):null;
  const hasExact=!!exact||list.some(function(e){return String(e._exp||'').trim().toLowerCase()===ql;});
  let html=list.map(function(e){
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
  // Si digitan un N° que no está en la base → crear expediente o PQRSD (periodo de transición)
  if(q.length>=2&&!hasExact){
    const qEsc=String(q).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    html+='<button type="button" class="entrega-resp-sug-btn entrega-resp-sug-crear" onmousedown="event.preventDefault();pickCrearExpEntregaResp(\''+qEsc+'\')">'+
      '<span style="color:var(--gn);font-weight:600">✚ Crear expediente (1ª entrega)</span> · <strong>'+escAttr(q)+'</strong>'+
      '<div style="font-size:11px;color:var(--tx3);margin-top:2px;font-weight:400">No está en la base — complete datos de alta del trámite</div></button>';
    html+='<button type="button" class="entrega-resp-sug-btn entrega-resp-sug-crear-pqrs" onmousedown="event.preventDefault();pickCrearPqrsEntregaResp(\''+qEsc+'\')">'+
      '<span style="color:#6d3fa8;font-weight:600">✚ Crear PQRSD (1ª entrega)</span> · <strong>'+escAttr(q)+'</strong>'+
      '<div style="font-size:11px;color:var(--tx3);margin-top:2px;font-weight:400">Ya radicada fuera de la app — complete el formulario como Secretaría</div></button>';
  }
  if(!html){
    portal.style.display='none';
    portal.innerHTML='';
    return;
  }
  portal.innerHTML=html;
  portal.style.display='block';
}

function setEntregaRespModoNuevo(on,tipo){
  window._entregaRespCrearNuevo=!!on;
  window._entregaRespCrearTipo=on?(tipo==='pqrs'?'pqrs':'exp'):'';
  const el=document.getElementById('entrega-resp-modo-nuevo');
  if(el)el.checked=!!on;
  const elP=document.getElementById('entrega-resp-modo-pqrs');
  if(elP)elP.checked=!!(on&&tipo==='pqrs');
}
function isEntregaRespModoNuevo(){
  return !!window._entregaRespCrearNuevo||!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
}
function isEntregaRespModoPqrsNuevo(){
  if(!isEntregaRespModoNuevo())return false;
  return window._entregaRespCrearTipo==='pqrs'||!!((document.getElementById('entrega-resp-modo-pqrs')||{}).checked);
}
function onEntregaRespModoRadioChange(){
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  setEntregaRespModoNuevo(false);
  if(!libre){
    const hint=document.getElementById('entrega-resp-exp-hint');
    if(hint&&!String((document.getElementById('entrega-resp-exp')||{}).value||'').trim())
      hint.textContent='Si el número no existe, elija crear expediente o PQRSD en la lista.';
  }
  syncEntregaRespModoUi();
}
function onEntregaRespExpInput(inp){
  if(isEntregaRespModoNuevo()){
    setEntregaRespModoNuevo(false);
    const boxNuevo=document.getElementById('entrega-resp-alta-box');
    if(boxNuevo)boxNuevo.style.display='none';
    const boxPqrs=document.getElementById('entrega-resp-alta-pqrs-box');
    if(boxPqrs)boxPqrs.style.display='none';
    const hint=document.getElementById('entrega-resp-exp-hint');
    if(hint)hint.textContent='Si el número no existe, elija crear expediente o PQRSD en la lista.';
  }
  filtrarExpEntregaRespSug(inp);
}
window.onEntregaRespModoRadioChange=onEntregaRespModoRadioChange;
window.onEntregaRespExpInput=onEntregaRespExpInput;
window.setEntregaRespModoNuevo=setEntregaRespModoNuevo;
window.isEntregaRespModoPqrsNuevo=isEntregaRespModoPqrsNuevo;

function pickExpEntregaResp(expNum){
  const inp=document.getElementById('entrega-resp-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('entrega-resp-exp-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const e=typeof getExpById==='function'?getExpById(expNum):null;
  const modoExist=document.getElementById('entrega-resp-modo-existente');
  const modoLibre=document.getElementById('entrega-resp-modo-libre');
  if(modoLibre)modoLibre.checked=false;
  if(modoExist)modoExist.checked=true;
  setEntregaRespModoNuevo(false);
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
    }else hint.textContent='';
  }
  syncEntregaRespPqrsUi();
  if(typeof entregaRespRetryFileUpload==='function')entregaRespRetryFileUpload();
}

/** Al no existir el N° en la base: activa el formulario de 1ª entrega con ese número. */
function pickCrearExpEntregaResp(expNum){
  expNum=String(expNum||'').trim();
  const inp=document.getElementById('entrega-resp-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('entrega-resp-exp-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const modoLibre=document.getElementById('entrega-resp-modo-libre');
  const modoExist=document.getElementById('entrega-resp-modo-existente');
  if(modoLibre)modoLibre.checked=false;
  if(modoExist)modoExist.checked=true;
  setEntregaRespModoNuevo(true,'exp');
  const expNuevo=document.getElementById('entrega-resp-exp-nuevo');
  if(expNuevo)expNuevo.value=expNum;
  syncEntregaRespModoUi();
  const hint=document.getElementById('entrega-resp-exp-hint');
  if(hint)hint.textContent='';
  syncEntregaRespAltaFormPorTramite();
  syncEntregaRespInteresadoUi();
  setTimeout(function(){
    const sel=document.getElementById('entrega-resp-tramite');
    if(sel)sel.focus();
  },60);
}
window.pickCrearExpEntregaResp=pickCrearExpEntregaResp;

/** Alta PQRSD en 1ª entrega (transición: ya radicada fuera de la app). */
function pickCrearPqrsEntregaResp(expNum){
  expNum=String(expNum||'').trim();
  const inp=document.getElementById('entrega-resp-exp');
  if(inp)inp.value=expNum;
  const portal=document.getElementById('entrega-resp-exp-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  const modoLibre=document.getElementById('entrega-resp-modo-libre');
  const modoExist=document.getElementById('entrega-resp-modo-existente');
  if(modoLibre)modoLibre.checked=false;
  if(modoExist)modoExist.checked=true;
  setEntregaRespModoNuevo(true,'pqrs');
  syncEntregaRespModoUi();
  const numEl=document.getElementById('er-pqrs-exp');
  if(numEl)numEl.value=expNum;
  const hint=document.getElementById('entrega-resp-exp-hint');
  if(hint)hint.textContent='';
  initEntregaRespPqrsAltaUi();
  setTimeout(function(){
    const f=document.getElementById('er-pqrs-fecha-solicitud');
    if(f)f.focus();
  },60);
}
window.pickCrearPqrsEntregaResp=pickCrearPqrsEntregaResp;

function defaultOficinaEntregaRespPqrs(){
  const d=typeof getDeptoOperativo==='function'?getDeptoOperativo():(typeof deptoActivo!=='undefined'?deptoActivo:'guaviare');
  if(typeof OFICINAS_DEGUV!=='undefined'&&Array.isArray(OFICINAS_DEGUV)&&OFICINAS_DEGUV.some(function(o){return o&&o.id===d;}))
    return d;
  return 'guaviare';
}
function erPqrsOficinaOptsHtml(sel){
  sel=String(sel||defaultOficinaEntregaRespPqrs());
  if(typeof pqrsOficinasSelectOpts==='function')return pqrsOficinasSelectOpts(sel,true);
  const list=(typeof OFICINAS_DEGUV!=='undefined'&&Array.isArray(OFICINAS_DEGUV))?OFICINAS_DEGUV:[];
  return '<option value="">— Seleccione oficina —</option>'+list.map(function(o){
    return '<option value="'+escAttr(o.id)+'"'+(sel===o.id?' selected':'')+'>'+escAttr(o.nombre)+'</option>';
  }).join('');
}
function erPqrsRemitenteOptsHtml(sel){
  sel=String(sel||'');
  const list=(typeof PQRS_OFICINAS_REMITENTES_INTERNAS!=='undefined'&&Array.isArray(PQRS_OFICINAS_REMITENTES_INTERNAS))
    ?PQRS_OFICINAS_REMITENTES_INTERNAS
    :['Dirección General','Secretaría General','NCA DEGUV'];
  return '<option value="">— Seleccione oficina remitente —</option>'+list.map(function(n){
    return '<option value="'+escAttr(n)+'"'+(sel===n?' selected':'')+'>'+escAttr(n)+'</option>';
  }).join('');
}
function htmlEntregaRespPqrsAltaBox(){
  const hoyStr=typeof hoy==='function'?hoy():'';
  const ofiDef=defaultOficinaEntregaRespPqrs();
  const tipos=['Petición','Queja','Reclamo','Denuncia','Sugerencia','Reunión','Audiencia'];
  const tipoOpts='<option value="">— Seleccionar —</option>'+tipos.map(function(t){return '<option value="'+escAttr(t)+'">'+escAttr(t)+'</option>';}).join('');
  const medioOpts=typeof mediosRecepcionPqrsOptsHtml==='function'
    ?mediosRecepcionPqrsOptsHtml('')
    :'<option value="">— Seleccionar —</option><option>Ventanilla</option><option>Correo</option><option>Teléfono</option><option>Web</option>';
  return '<div style="font-size:12px;font-weight:600;color:#6d3fa8;margin:0 0 8px">✚ Crear PQRSD (1ª entrega)</div>'+
    '<div class="fg" style="margin-bottom:8px">'+
      '<div class="fld"><label>N° PQRSD <span style="color:var(--rd)">*</span></label>'+
        '<input type="text" id="er-pqrs-exp" placeholder="N° radicado (sistema actual)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Fecha de solicitud <span style="color:var(--rd)">*</span></label>'+
        '<input type="date" id="er-pqrs-fecha-solicitud" value="'+escAttr(hoyStr)+'" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Tipo de solicitud <span style="color:var(--rd)">*</span></label>'+
        '<select id="er-pqrs-tipo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+tipoOpts+'</select></div>'+
      '<div class="fld"><label>Medio de recepción <span style="color:var(--rd)">*</span></label>'+
        '<select id="er-pqrs-medio" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" onchange="onErPqrsMedioRecepcionChange()">'+medioOpts+'</select></div>'+
    '</div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="er-pqrs-interna" onchange="toggleErPqrsInterna()"> PQRSD interna</label>'+
    '<div id="er-pqrs-interna-block" style="display:none;margin-bottom:8px;padding:8px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd)">'+
      '<div class="fld"><label>Oficina remitente <span style="color:var(--rd)">*</span></label>'+
        '<select id="er-pqrs-oficina-remitente" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+erPqrsRemitenteOptsHtml()+'</select></div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:8px" id="er-pqrs-medio-notif-wrap">'+
      '<label>Medio de notificación de rta.</label>'+
      '<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:6px" id="er-pqrs-medio-notif-btns"></div>'+
      '<input type="hidden" id="er-pqrs-medio-notif" value="">'+
    '</div>'+
    '<div id="er-pqrs-solicitante-wrap">'+
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px"><input type="checkbox" id="er-pqrs-anonimo" onchange="toggleErPqrsAnonimo()"> Solicitud anónima</label>'+
      '<div id="er-pqrs-anon-contact-block" style="display:none;margin-bottom:8px;padding:8px;background:var(--sf2);border-radius:var(--r);border:1px solid var(--bd)">'+
        '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">Datos de contacto opcionales — solo para notificación (no identifican al solicitante)</div>'+
        '<div class="fg">'+
          '<div class="fld"><label>Correo (notificación)</label><input type="email" id="er-pqrs-anon-correo" placeholder="correo@ejemplo.com" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
          '<div class="fld"><label>Teléfono</label><input type="tel" id="er-pqrs-anon-tel" placeholder="3001234567" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '</div>'+
      '</div>'+
      '<div id="er-pqrs-persona-fields">'+
      '<div class="fg" style="margin-bottom:8px">'+
        '<div class="fld"><label>Tipo de persona <span style="color:var(--rd)">*</span></label>'+
          '<select id="er-pqrs-tipo-persona" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" onchange="toggleErPqrsPersona()">'+
            '<option value="">— Seleccionar —</option><option value="natural">Persona natural</option><option value="juridica">Persona jurídica</option>'+
          '</select></div>'+
      '</div>'+
      '<div id="er-pqrs-pn-block" style="display:none">'+
        '<div class="fg" style="margin-bottom:8px">'+
          '<div class="fld"><label>Nombre <span style="color:var(--rd)">*</span></label><input type="text" id="er-pqrs-pn-nombre" placeholder="Buscar por nombre…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pqrs-pn','nombre'):'')+'></div>'+
          '<div class="fld"><label>Identificación</label><input type="text" id="er-pqrs-pn-identificacion" placeholder="Buscar por identificación…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pqrs-pn','identificacion'):'')+'></div>'+
          '<div class="fld"><label>Correo</label><input type="email" id="er-pqrs-pn-correo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
          '<div class="fld"><label>Teléfono</label><input type="tel" id="er-pqrs-pn-telefono" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '</div>'+
      '</div>'+
      '<div id="er-pqrs-pj-block" style="display:none">'+
        '<div class="fg" style="margin-bottom:8px">'+
          '<div class="fld"><label>Razón social / entidad <span style="color:var(--rd)">*</span></label><input type="text" id="er-pqrs-pj-empresa" placeholder="Buscar por razón social…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pqrs-pj','empresa'):'')+'></div>'+
          '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField('er-pqrs-pj-nit',{sugTarget:'er-pqrs-pj',placeholder:'Buscar por NIT…',style:'width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)'}):'<input type="text" id="er-pqrs-pj-nit" placeholder="Buscar por NIT…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">')+'</div>'+
          '<div class="fld"><label>Correo entidad</label><input type="email" id="er-pqrs-pj-correo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
          '<div class="fld"><label>Teléfono entidad</label><input type="tel" id="er-pqrs-pj-telefono" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
          '<div class="fld"><label>Quien radica (nombre) <span style="color:var(--rd)">*</span></label><input type="text" id="er-pqrs-pj-ofi-nombre" placeholder="Buscar por nombre…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pqrs-ofi','nombre'):'')+'></div>'+
          '<div class="fld"><label>Identificación</label><input type="text" id="er-pqrs-pj-ofi-identificacion" placeholder="Buscar por identificación…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pqrs-ofi','identificacion'):'')+'></div>'+
          '<div class="fld"><label>Correo</label><input type="email" id="er-pqrs-pj-ofi-correo" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
          '<div class="fld"><label>Teléfono</label><input type="tel" id="er-pqrs-pj-ofi-telefono" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '</div>'+
      '</div>'+
      '</div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Asunto / tema <span style="color:var(--rd)">*</span></label>'+
      '<input type="text" id="er-pqrs-asunto" placeholder="Resumen de la solicitud" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label>'+
      '<textarea id="er-pqrs-detalle" placeholder="Descripción adicional…" style="width:100%;min-height:60px;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-family:\'DM Sans\',sans-serif"></textarea></div>'+
    '<div class="fld" style="margin-bottom:4px"><label>Oficina <span style="color:var(--rd)">*</span></label>'+
      '<select id="er-pqrs-oficina" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+erPqrsOficinaOptsHtml(ofiDef)+'</select></div>';
}
function setErPqrsMedioNotificacion(val,userPick){
  const hid=document.getElementById('er-pqrs-medio-notif');
  const norm=typeof medioNotificacionNorm==='function'?medioNotificacionNorm(val==='no_indica'?'':val):(val==='no_indica'?'':String(val||''));
  if(hid){
    hid.value=norm;
    if(userPick)hid.dataset.userSet='1';
    else delete hid.dataset.userSet;
  }
  document.querySelectorAll('#er-pqrs-medio-notif-btns .medio-notif-btn').forEach(function(b){
    const bv=b.getAttribute('data-val')||'';
    b.classList.toggle('on',(bv==='no_indica'&&!norm)||bv===norm);
  });
}
function onErPqrsMedioRecepcionChange(){
  const hid=document.getElementById('er-pqrs-medio-notif');
  const medio=(document.getElementById('er-pqrs-medio')||{}).value||'';
  if(!medio){
    if(hid){hid.value='';delete hid.dataset.userSet;}
    document.querySelectorAll('#er-pqrs-medio-notif-btns .medio-notif-btn').forEach(function(b){b.classList.remove('on');});
    return;
  }
  if(hid&&hid.dataset.userSet){
    setErPqrsMedioNotificacion('no_indica',false);
    delete hid.dataset.userSet;
  }else{
    const def=typeof defaultMedioNotifDesdeRecepcion==='function'?defaultMedioNotifDesdeRecepcion(medio):'';
    setErPqrsMedioNotificacion(def||'no_indica',false);
  }
}
function toggleErPqrsInterna(){
  const interna=!!((document.getElementById('er-pqrs-interna')||{}).checked);
  const intBlock=document.getElementById('er-pqrs-interna-block');
  if(intBlock)intBlock.style.display=interna?'':'none';
  const solWrap=document.getElementById('er-pqrs-solicitante-wrap');
  if(solWrap)solWrap.style.display=interna?'none':'';
  const medioNotif=document.getElementById('er-pqrs-medio-notif-wrap');
  if(medioNotif)medioNotif.style.display=interna?'none':'';
  if(interna){
    const anon=document.getElementById('er-pqrs-anonimo');
    if(anon)anon.checked=false;
    const tp=document.getElementById('er-pqrs-tipo-persona');if(tp)tp.value='';
    setErPqrsMedioNotificacion('no_indica',false);
  }
  toggleErPqrsAnonimo();
}
function toggleErPqrsAnonimo(){
  const interna=!!((document.getElementById('er-pqrs-interna')||{}).checked);
  const anon=interna?false:!!((document.getElementById('er-pqrs-anonimo')||{}).checked);
  const anonBlock=document.getElementById('er-pqrs-anon-contact-block');
  if(anonBlock)anonBlock.style.display=(!interna&&anon)?'':'none';
  const personaFields=document.getElementById('er-pqrs-persona-fields');
  if(personaFields)personaFields.style.display=(!interna&&!anon)?'':'none';
  const tp=document.getElementById('er-pqrs-tipo-persona');
  if(tp){
    tp.disabled=anon||interna;
    if(anon||interna)tp.value='';
  }
  if(anon){
    ['er-pqrs-pn-nombre','er-pqrs-pn-identificacion','er-pqrs-pn-correo','er-pqrs-pn-telefono',
     'er-pqrs-pj-empresa','er-pqrs-pj-nit','er-pqrs-pj-correo','er-pqrs-pj-telefono',
     'er-pqrs-pj-ofi-nombre','er-pqrs-pj-ofi-identificacion','er-pqrs-pj-ofi-correo','er-pqrs-pj-ofi-telefono'].forEach(function(id){
      if(typeof clearUiField==='function')clearUiField(id);
      else{const el=document.getElementById(id);if(el)el.value='';}
    });
  }else{
    const ac=document.getElementById('er-pqrs-anon-correo');if(ac)ac.value='';
    const at=document.getElementById('er-pqrs-anon-tel');if(at)at.value='';
  }
  toggleErPqrsPersona();
}
function toggleErPqrsPersona(){
  const interna=!!((document.getElementById('er-pqrs-interna')||{}).checked);
  const anon=interna?false:!!((document.getElementById('er-pqrs-anonimo')||{}).checked);
  const tp=String((document.getElementById('er-pqrs-tipo-persona')||{}).value||'');
  const pn=document.getElementById('er-pqrs-pn-block');
  const pj=document.getElementById('er-pqrs-pj-block');
  if(pn)pn.style.display=(!interna&&!anon&&tp==='natural')?'':'none';
  if(pj)pj.style.display=(!interna&&!anon&&tp==='juridica')?'':'none';
}
function initEntregaRespPqrsAltaUi(){
  const btns=document.getElementById('er-pqrs-medio-notif-btns');
  if(btns&&typeof htmlMedioNotificacionBtns==='function')
    btns.innerHTML=htmlMedioNotificacionBtns('','er-pqrs','setErPqrsMedioNotificacion');
  toggleErPqrsInterna();
  onErPqrsMedioRecepcionChange();
}
window.setErPqrsMedioNotificacion=setErPqrsMedioNotificacion;
window.onErPqrsMedioRecepcionChange=onErPqrsMedioRecepcionChange;
window.toggleErPqrsInterna=toggleErPqrsInterna;
window.toggleErPqrsAnonimo=toggleErPqrsAnonimo;
window.toggleErPqrsPersona=toggleErPqrsPersona;
window.initEntregaRespPqrsAltaUi=initEntregaRespPqrsAltaUi;
window.htmlEntregaRespPqrsAltaBox=htmlEntregaRespPqrsAltaBox;

function syncEntregaRespModoUi(){
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  if(libre){
    const deptoLibre=typeof resolveDeptoActLibre==='function'?resolveDeptoActLibre():(typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare'));
    const deptoOk=(deptoLibre&&deptoLibre!=='responsables')?deptoLibre:'guaviare';
    window._entregaLibreCodigoPreview=typeof genCodigoActLibre==='function'?genCodigoActLibre(deptoOk):('ACT-'+Date.now());
  }else window._entregaLibreCodigoPreview='';
  if(typeof sstFileTryUpload==='function'){
    sstFileTryUpload(entregaRespFileCtxKey(),'entrega-resp-file-list',entregaRespFileUploadCtx);
    sstFileTryUpload(entregaRespFileCtxKey(),'entrega-resp-anexos-list',entregaRespFileUploadCtx);
  }
  const boxNuevo=document.getElementById('entrega-resp-alta-box');
  const boxPqrs=document.getElementById('entrega-resp-alta-pqrs-box');
  const boxExist=document.getElementById('entrega-resp-exist-box');
  const libreHint=document.getElementById('entrega-resp-libre-hint');
  const hint=document.getElementById('entrega-resp-exp-hint');
  if(boxExist)boxExist.style.display=libre?'none':'';
  if(boxNuevo)boxNuevo.style.display=(!libre&&nuevo&&!pqrsNuevo)?'':'none';
  if(boxPqrs)boxPqrs.style.display=(!libre&&pqrsNuevo)?'':'none';
  if(libreHint)libreHint.style.display=libre?'':'none';
  if(libre){
    if(hint)hint.textContent='';
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
    if(regHint)regHint.textContent='';
    if(typeof syncEntregaRespLibreUi==='function')syncEntregaRespLibreUi();
  }else{
    const libreBox=document.getElementById('entrega-resp-libre-box');
    if(libreBox)libreBox.style.display='none';
    syncEntregaRespPqrsUi();
    if(typeof syncEntregaRespRegistroUi==='function')syncEntregaRespRegistroUi();
  }
}

function entregaRespEsFlujoPqrs(){
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  if(pqrsNuevo)return true;
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  if(libre)return false;
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():false;
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const e=!nuevo&&!pqrsNuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  return !!(e&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
    ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))));
}

/** Muestra campos PQRSD (respuesta + Drive PQRSD) al crear o entregar sobre PQRSD. */
function syncEntregaRespPqrsUi(){
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const e=!nuevo&&!pqrsNuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  const esPqrsExistente=!!(e&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))
    ||(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))));
  const esPqrsFlujo=esPqrsExistente||pqrsNuevo;
  const box=document.getElementById('entrega-resp-pqrs-box');
  const tramFiles=document.getElementById('entrega-resp-tramite-files');
  const regBox=document.getElementById('entrega-resp-registro-box');
  if(tramFiles&&!tramFiles._tramiteFilesHtmlBackup)
    tramFiles._tramiteFilesHtmlBackup=tramFiles.innerHTML;
  if(box){
    if(esPqrsFlujo&&typeof renderPqrsEntregaCamposHtml==='function'){
      if(tramFiles){tramFiles.innerHTML='';tramFiles.style.display='none';}
      const eRender=esPqrsExistente?e:{_alta_por_responsable:true};
      box.innerHTML=renderPqrsEntregaCamposHtml(eRender);
      box.style.display='';
      if(regBox){regBox.style.display='none';regBox.innerHTML='';}
      setTimeout(function(){
        if(typeof initPqrsEntregaArchivosPick==='function')initPqrsEntregaArchivosPick();
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
  if(typeof syncEntregaRespNotifCorreoUi==='function')syncEntregaRespNotifCorreoUi();
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
    '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-apo-nombre" placeholder="Buscar por nombre…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-apo','nombre'):'')+'></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-apo-identificacion" placeholder="Buscar por identificación…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-apo','identificacion'):'')+'></div>'+
    '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-apo-correo" style="'+inpStyle+'"></div>'+
    '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-apo-telefono" style="'+inpStyle+'"></div>'+
    htmlEntregaRespDir('apo',ev)+
    '</div></div>'+
    '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:500;margin-top:10px"><input type="checkbox" id="entrega-int-autorizado" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--bl)"> Tiene autorizado</label>'+
    '<div id="entrega-int-aut-box" style="display:none;margin-top:8px"><div class="slbl" style="margin-bottom:6px;font-size:11px">Autorizado</div><div class="fg">'+
    '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-aut-nombre" placeholder="Buscar por nombre…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-aut','nombre'):'')+'></div>'+
    '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-aut-identificacion" placeholder="Buscar por identificación…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-aut','identificacion'):'')+'></div>'+
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
      '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField(pref+'-nit',{value:pi._pi_nit||'',placeholder:'NIT',style:inpStyle}):'<input type="text" id="'+pref+'-nit" value="'+escAttr(pi._pi_nit||'')+'" style="'+inpStyle+'">')+'</div>'+
      '<div class="fld"><label>Correo empresa</label><input type="email" id="'+pref+'-correo-emp" value="'+escAttr(pi._pi_correo_emp||'')+'" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono empresa</label><input type="tel" id="'+pref+'-telefono-emp" value="'+escAttr(pi._pi_telefono_emp||'')+'" style="'+inpStyle+'"></div>'+
      htmlEntregaRespDir('infemp'+idx,dirEmp)+
    '</div></div></div>';
}

function htmlEntregaRespInteresadoBox(tramiteId){
  const tid=String(tramiteId||(document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
  const esSanc=typeof esTramiteSancionatorio==='function'&&esTramiteSancionatorio(tid);
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  let h='<div style="margin-top:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf)">';
  h+='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos de Registro'+(tid?' · '+(typeof getTram==='function'&&getTram(tid)?escAttr(getTram(tid).nombre):escAttr(tid)):'')+'</div>';
  if(!tid){
    h+='<div style="font-size:12px;color:var(--tx3)">Seleccione el tipo de trámite para ver los campos a diligenciar (igual que en Registro).</div></div>';
    return h;
  }
  const tramObj=typeof getTram==='function'?getTram(tid):null;
  const subclases=(typeof getTramSubclases==='function')?getTramSubclases(tramObj):(tramObj&&Array.isArray(tramObj.subclases)?tramObj.subclases:[]);
  if(subclases.length){
    const lbl=(typeof getTramSubclaseLabel==='function')?getTramSubclaseLabel(tramObj):(tramObj&&tramObj.subclaseLabel)||'Clase / tipo';
    h+='<div class="fld" style="margin-bottom:8px"><label>'+escAttr(lbl)+' <span style="color:var(--rd)">*</span></label><select id="entrega-int-subclase" style="'+inpStyle+'">'+
      '<option value="">— Seleccione —</option>'+
      subclases.map(function(s){return '<option value="'+escAttr(s)+'">'+escAttr(s)+'</option>';}).join('')+
      '</select></div>';
  }
  if(esSanc){
    h+='<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:500;margin-bottom:8px"><input type="checkbox" id="entrega-int-qd-anonimo" onchange="syncEntregaRespInteresadoUi()" style="width:15px;height:15px;accent-color:var(--pu)"> Actúa como anónimo</label>';
    h+='<div id="entrega-int-qd-box"><div class="slbl" style="margin:.4rem 0 .35rem;font-size:11px">Quejoso / denunciante</div><div class="fg">'+
      '<div class="fld"><label>Nombre</label><input type="text" id="entrega-int-qd-nombre" placeholder="Buscar por nombre…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-qd','nombre'):'')+'></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-qd-identificacion" placeholder="Buscar por identificación…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-qd','identificacion'):'')+'></div>'+
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
      '<div class="fld"><label>Nombre <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-int-pn-nombre" placeholder="Buscar por nombre…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pn','nombre'):'')+'></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-pn-identificacion" placeholder="Buscar por identificación…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pn','identificacion'):'')+'></div>'+
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
      '<div class="fld"><label>Nombre representante</label><input type="text" id="entrega-int-pj-rep-nombre" placeholder="Buscar por nombre…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pj','rep_nombre'):'')+'></div>'+
      '<div class="fld"><label>Identificación</label><input type="text" id="entrega-int-pj-rep-identificacion" placeholder="Buscar por identificación…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pj','rep_identificacion'):'')+'></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-int-pj-rep-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-int-pj-rep-telefono" style="'+inpStyle+'"></div>'+
      '</div><div class="slbl" style="margin:.5rem 0 .35rem;font-size:11px">Empresa</div><div class="fg">'+
      '<div class="fld"><label>Nombre / razón social <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-int-pj-empresa" placeholder="Buscar por razón social…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pj','empresa'):'')+'></div>'+
      '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField('entrega-int-pj-nit',{sugTarget:'er-pj',placeholder:'Buscar por NIT…',style:inpStyle}):'<input type="text" id="entrega-int-pj-nit" placeholder="Buscar por NIT…" style="'+inpStyle+'"'+(typeof personSugAttrs==='function'?personSugAttrs('er-pj','nit'):'')+'>')+'</div>'+
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

function _personSugLibrePortalId(field){
  if(field==='empresa')return'entrega-libre-int-empresa-sug';
  if(field==='dirigido')return'entrega-libre-int-dirigido-sug';
  return'entrega-libre-int-nombre-sug';
}

function entregaLibreIntTipo(){
  const r=document.querySelector('input[name="entrega-libre-int-tipo"]:checked');
  return r&&r.value==='juridica'?'juridica':'natural';
}

function syncEntregaLibreInteresadoUi(){
  const jur=entregaLibreIntTipo()==='juridica';
  const natBox=document.getElementById('entrega-libre-nat-box');
  const jurBox=document.getElementById('entrega-libre-jur-box');
  if(natBox)natBox.style.display=jur?'none':'';
  if(jurBox)jurBox.style.display=jur?'':'none';
  hidePersonasSugLibre();
  if(window._entregaLibreTipoPrev&&window._entregaLibreTipoPrev!==entregaLibreIntTipo()){
    setEntregaLibrePersonaRef(null);
  }
  window._entregaLibreTipoPrev=entregaLibreIntTipo();
}

function setEntregaLibreIntTipo(tipo){
  const val=tipo==='juridica'?'juridica':'natural';
  const r=document.querySelector('input[name="entrega-libre-int-tipo"][value="'+val+'"]');
  if(r)r.checked=true;
  syncEntregaLibreInteresadoUi();
}

function hidePersonasSugLibre(field){
  if(field){
    const portal=document.getElementById(_personSugLibrePortalId(field));
    if(portal){portal.style.display='none';portal.innerHTML='';}
    return;
  }
  hidePersonasSugLibre('nombre');
  hidePersonasSugLibre('empresa');
  hidePersonasSugLibre('dirigido');
}

function setEntregaLibrePersonaRef(p){
  const id=p&&p.id?String(p.id):'';
  window._entregaLibrePersonaId=id;
  const hid=document.getElementById('entrega-libre-int-persona-id');
  if(hid)hid.value=id;
}

function onEntregaLibreNombreInput(inp){
  if(entregaLibreIntTipo()!=='natural')return;
  filtrarPersonasSugLibre(inp,'nombre','nat');
  const refId=window._entregaLibrePersonaId||_entregaLibreIntVal('entrega-libre-int-persona-id');
  if(!refId||typeof personas==='undefined'||!Array.isArray(personas))return;
  const p=personas.find(function(x){return x.id===refId;});
  if(!p){setEntregaLibrePersonaRef(null);return;}
  const typed=String(inp.value||'').trim().toLowerCase();
  const orig=String(typeof personaNombreNatural==='function'?personaNombreNatural(p):(p.pn_nombre||'')).trim().toLowerCase();
  if(typed&&orig&&typed!==orig)setEntregaLibrePersonaRef(null);
}

function onEntregaLibreNombreBlur(){
  if(entregaLibreIntTipo()!=='natural')return;
  hidePersonasSugLibre('nombre');
  const inp=document.getElementById('entrega-libre-int-nombre');
  if(!inp||typeof buscarPersonas!=='function'||typeof aplicarPersonaCatalog!=='function')return;
  const q=String(inp.value||'').trim();
  if(q.length<2)return;
  const ql=q.toLowerCase();
  const list=buscarPersonas(q,'libre-nat','nombre',12);
  const exact=list.filter(function(p){
    return String(typeof personaNombreNatural==='function'?personaNombreNatural(p):(p.pn_nombre||'')).trim().toLowerCase()===ql;
  });
  if(exact.length!==1)return;
  aplicarPersonaCatalog(exact[0],'libre-nat');
  setEntregaLibrePersonaRef(exact[0]);
}

function filtrarPersonasSugLibre(inp,field,mode){
  const portal=document.getElementById(_personSugLibrePortalId(field));
  if(!portal||!inp)return;
  const q=String(inp.value||'').trim();
  let list=[];
  if(mode==='jur-emp'||field==='empresa'){
    list=typeof buscarPersonas==='function'?buscarPersonas(q,'libre-jur','empresa',12):[];
  }else if(mode==='jur-rep'||field==='dirigido'){
    list=typeof buscarPersonas==='function'?buscarPersonas(q,'libre-jur','rep_nombre',12):[];
  }else{
    list=typeof buscarPersonas==='function'?buscarPersonas(q,'libre-nat','nombre',12):[];
  }
  window._personSugLibreList=list;
  window._personSugLibrePickMode=mode||field||'nat';
  if(!list.length){
    portal.style.display='none';
    portal.innerHTML='';
    return;
  }
  const sugField=field==='empresa'?'empresa':(field==='dirigido'?'rep_nombre':'nombre');
  portal.innerHTML=list.map(function(p,i){
    const lbl=typeof personaEtiquetaSugLibre==='function'?personaEtiquetaSugLibre(p,sugField):'';
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();pickPersonaEntregaLibre('+i+')"><strong>'+escAttr(lbl)+'</strong></button>';
  }).join('');
  portal.style.display='block';
}

function pickPersonaEntregaLibre(idx){
  const p=(window._personSugLibreList||[])[idx];
  if(!p||typeof aplicarPersonaCatalog!=='function')return;
  const mode=window._personSugLibrePickMode||'nat';
  if(mode==='jur-emp'||mode==='empresa')aplicarPersonaCatalog(p,'libre-jur-emp');
  else if(mode==='jur-rep'||mode==='dirigido')aplicarPersonaCatalog(p,'libre-jur-rep');
  else aplicarPersonaCatalog(p,'libre-nat');
  if(mode!=='jur-rep'&&mode!=='dirigido')setEntregaLibrePersonaRef(p);
  hidePersonasSugLibre();
}

function htmlEntregaLibreInteresadoBox(){
  const inpStyle='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  const sugNom=' oninput="onEntregaLibreNombreInput(this)" onfocus="filtrarPersonasSugLibre(this,\'nombre\',\'nat\')" onblur="setTimeout(function(){onEntregaLibreNombreBlur();},180)"';
  const sugEmp=' oninput="filtrarPersonasSugLibre(this,\'empresa\',\'jur-emp\')" onfocus="filtrarPersonasSugLibre(this,\'empresa\',\'jur-emp\')" onblur="setTimeout(function(){hidePersonasSugLibre(\'empresa\');},180)"';
  const sugDir=' oninput="filtrarPersonasSugLibre(this,\'dirigido\',\'jur-rep\')" onfocus="filtrarPersonasSugLibre(this,\'dirigido\',\'jur-rep\')" onblur="setTimeout(function(){hidePersonasSugLibre(\'dirigido\');},180)"';
  return '<div style="margin-top:4px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf)">'+
    '<input type="hidden" id="entrega-libre-int-persona-id" value="">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos del interesado (a quien se oficia)</div>'+
    '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-libre-int-tipo" value="natural" checked onchange="syncEntregaLibreInteresadoUi()"> Persona natural</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-libre-int-tipo" value="juridica" onchange="syncEntregaLibreInteresadoUi()"> Persona jurídica</label>'+
    '</div>'+
    '<div id="entrega-libre-nat-box"><div class="fg">'+
      '<div class="fld"><label>Nombre <span style="color:var(--rd)">*</span></label><div style="position:relative">'+
        '<input type="text" id="entrega-libre-int-nombre"'+sugNom+' placeholder="Buscar por nombre…" style="'+inpStyle+'">'+
        '<div id="entrega-libre-int-nombre-sug" class="entrega-resp-sug" style="display:none"></div></div></div>'+
      '<div class="fld"><label>Correo</label><input type="email" id="entrega-libre-int-correo" style="'+inpStyle+'"></div>'+
      '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-libre-int-telefono" style="'+inpStyle+'"></div>'+
    '</div></div>'+
    '<div id="entrega-libre-jur-box" style="display:none">'+
      '<div class="slbl" style="margin-bottom:6px">Entidad / empresa</div><div class="fg">'+
        '<div class="fld" style="grid-column:1/-1"><label>Razón social <span style="color:var(--rd)">*</span></label><div style="position:relative">'+
          '<input type="text" id="entrega-libre-int-empresa"'+sugEmp+' placeholder="Buscar entidad…" style="'+inpStyle+'">'+
          '<div id="entrega-libre-int-empresa-sug" class="entrega-resp-sug" style="display:none"></div></div></div>'+
        '<div class="fld"><label>NIT</label>'+(typeof htmlNitConDvField==='function'?htmlNitConDvField('entrega-libre-int-nit',{style:inpStyle,placeholder:'NIT'}):'<input type="text" id="entrega-libre-int-nit" style="'+inpStyle+'">')+'</div>'+
        '<div class="fld"><label>Correo</label><input type="email" id="entrega-libre-int-correo-j" style="'+inpStyle+'"></div>'+
        '<div class="fld"><label>Teléfono</label><input type="tel" id="entrega-libre-int-telefono-j" style="'+inpStyle+'"></div>'+
      '</div>'+
      '<div class="slbl" style="margin:10px 0 6px">Persona a quien va dirigido el oficio</div><div class="fg">'+
        '<div class="fld" style="grid-column:1/-1"><label>Nombre <span style="color:var(--rd)">*</span></label><div style="position:relative">'+
          '<input type="text" id="entrega-libre-int-dirigido"'+sugDir+' placeholder="Buscar por nombre…" style="'+inpStyle+'">'+
          '<div id="entrega-libre-int-dirigido-sug" class="entrega-resp-sug" style="display:none"></div></div></div>'+
      '</div></div>'+
    '</div></div>';
}

function _entregaLibreIntVal(id){
  const el=document.getElementById(id);
  return el?String(el.value||'').trim():'';
}

function collectEntregaLibreInteresado(){
  const personaId=_entregaLibreIntVal('entrega-libre-int-persona-id')||window._entregaLibrePersonaId||'';
  if(entregaLibreIntTipo()==='juridica'){
    const empresa=_entregaLibreIntVal('entrega-libre-int-empresa');
    const nit=_entregaLibreIntVal('entrega-libre-int-nit');
    const correo=_entregaLibreIntVal('entrega-libre-int-correo-j');
    const telefono=_entregaLibreIntVal('entrega-libre-int-telefono-j');
    const dirigido=_entregaLibreIntVal('entrega-libre-int-dirigido');
    return{
      _tipo_persona:'juridica',
      _pj_empresa:empresa,
      _pj_nit:typeof formatNitDisplay==='function'?formatNitDisplay(nit):nit,
      _pj_correo:correo,
      _pj_telefono:telefono,
      _pj_rep_nombre:dirigido,
      _persona_catalog_id:personaId
    };
  }
  const nombre=_entregaLibreIntVal('entrega-libre-int-nombre');
  const correo=_entregaLibreIntVal('entrega-libre-int-correo');
  const telefono=_entregaLibreIntVal('entrega-libre-int-telefono');
  return{
    _tipo_persona:'natural',
    _pn_nombre:nombre,
    _pn_correo:correo,
    _pn_telefono:telefono,
    _persona_catalog_id:personaId
  };
}

function validateEntregaLibreInteresado(datos){
  if(!datos)return'Indique los datos del interesado';
  if(datos._tipo_persona==='juridica'){
    if(!datos._pj_empresa)return'Indique la razón social de la entidad';
    if(!datos._pj_rep_nombre)return'Indique a quien va dirigido el oficio';
    return'';
  }
  if(!datos._pn_nombre)return'Indique el nombre del interesado';
  return'';
}

function applyEntregaLibreInteresadoToTask(t,datos){
  if(!t||!datos)return;
  Object.keys(datos).forEach(function(k){t[k]=datos[k];});
  if(datos._tipo_persona==='juridica'){
    const emp=String(datos._pj_empresa||'').trim();
    const rep=String(datos._pj_rep_nombre||'').trim();
    t.interesadoNombre=emp?(rep?(emp+' · '+rep):emp):rep;
    return;
  }
  t.interesadoNombre=String(datos._pn_nombre||'').trim();
}

function resolveActividadRequiereOficio(nombreAct,deptoId){
  const nom=String(nombreAct||'').trim();
  if(!nom)return false;
  const cfgAct=typeof getCfgActividadesPred==='function'?getCfgActividadesPred(deptoId):(typeof cfgFor==='function'?cfgFor(deptoId):null);
  return !!(cfgAct&&cfgAct.actOficioMap&&cfgAct.actOficioMap[nom]);
}

function entregaRespClearOficioError(){
  const err=document.getElementById('entrega-resp-oficio-err');
  if(err){err.style.display='none';err.textContent='';}
}

function entregaRespOnOficioBlur(){
  const oficio=String((document.getElementById('entrega-resp-oficio')||{}).value||'').trim();
  if(!oficio||oficio.length<3)return;
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const excl=libre?(window._entregaLibreCodigoPreview||''):String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  if(typeof validarNumeroOficioDisponible==='function')validarNumeroOficioDisponible(oficio,excl);
}

function validateEntregaRespOficioRequerido(actividad,excludeId){
  const pqrsTipoEl=document.getElementById('pqrs-resp-tipo');
  if(pqrsTipoEl){
    const tipo=String(pqrsTipoEl.value||'').trim();
    if(typeof PQRS_WF_TIPO!=='undefined'&&tipo!==PQRS_WF_TIPO.OFICIO)return true;
    if(tipo&&tipo!=='oficio')return true;
  }
  if(!resolveActividadRequiereOficio(actividad))return true;
  // Oficio de requerimiento: el N° va en su propio formulario
  if(esActividadOficioRequerimiento(actividad)&&document.getElementById('entrega-ofi-req-oficio'))return true;
  const pqrsOfi=document.getElementById('pqrs-entrega-resp-oficio');
  const oficio=pqrsOfi
    ?String(pqrsOfi.value||'').trim()
    :String((document.getElementById('entrega-resp-oficio')||{}).value||'').trim();
  if(!oficio){
    notif('Indique el N° de oficio','err');
    const el=document.getElementById('entrega-resp-oficio');
    if(el&&!pqrsOfi)el.focus();
    return false;
  }
  if(typeof validarNumeroOficioDisponible==='function'){
    return validarNumeroOficioDisponible(oficio,excludeId);
  }
  return true;
}

function applyEntregaRespOficioToTask(t,actividad){
  if(!t||!resolveActividadRequiereOficio(actividad))return;
  const pqrsOfi=document.getElementById('pqrs-entrega-resp-oficio');
  const oficio=pqrsOfi
    ?String(pqrsOfi.value||'').trim()
    :String((document.getElementById('entrega-resp-oficio')||{}).value||'').trim();
  if(oficio){
    t.oficio=oficio;
    t.nro_oficio=oficio;
    t._oficio=oficio;
  }
}

function syncEntregaRespOficioUi(){
  const wrap=document.getElementById('entrega-resp-oficio-wrap');
  if(!wrap)return;
  const act=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const esPqrs=!!document.getElementById('pqrs-entrega-resp-oficio');
  // Evitar duplicar N° oficio cuando el formulario de Oficio de requerimiento ya lo pide
  const show=resolveActividadRequiereOficio(act)&&!esPqrs&&!esActividadOficioRequerimiento(act);
  wrap.style.display=show?'':'none';
  const req=document.getElementById('entrega-resp-oficio-req');
  if(req)req.style.display=show?'':'none';
}

function syncEntregaRespLibreUi(){
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const box=document.getElementById('entrega-resp-libre-box');
  if(box)box.style.display=libre?'':'none';
  if(libre&&typeof syncEntregaLibreInteresadoUi==='function')syncEntregaLibreInteresadoUi();
  syncEntregaRespOficioUi();
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
    _medio_notificacion:_entregaIntVal('entrega-int-medio-notif')||'',
    _subclase:_entregaIntVal('entrega-int-subclase')||''
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
        _pj_rep_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(_entregaIntVal('entrega-int-pj-rep-identificacion')):_entregaIntVal('entrega-int-pj-rep-identificacion'),
        _pj_rep_correo:_entregaIntVal('entrega-int-pj-rep-correo'),
        _pj_rep_telefono:_entregaIntVal('entrega-int-pj-rep-telefono'),
        _pj_empresa:_entregaIntVal('entrega-int-pj-empresa'),
        _pj_nit:typeof formatNitDisplay==='function'?formatNitDisplay(_entregaIntVal('entrega-int-pj-nit')):_entregaIntVal('entrega-int-pj-nit'),
        _pj_correo:_entregaIntVal('entrega-int-pj-correo'),
        _pj_telefono:_entregaIntVal('entrega-int-pj-telefono')
      },_entregaIntDir('pj'));
    }else{
      Object.assign(out,{
        _pn_nombre:_entregaIntVal('entrega-int-pn-nombre'),
        _pn_identificacion:typeof formatIdentDisplay==='function'?formatIdentDisplay(_entregaIntVal('entrega-int-pn-identificacion')):_entregaIntVal('entrega-int-pn-identificacion'),
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
  const tramObj=typeof getTram==='function'?getTram(tid):null;
  const subclases=(typeof getTramSubclases==='function')?getTramSubclases(tramObj):(tramObj&&Array.isArray(tramObj.subclases)?tramObj.subclases:[]);
  if(subclases.length&&!String(datos._subclase||'').trim()){
    const lbl=(typeof getTramSubclaseLabel==='function')?getTramSubclaseLabel(tramObj):(tramObj&&tramObj.subclaseLabel)||'Clase / tipo';
    return'Seleccione '+lbl;
  }
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

function entregaRespFileCtxKey(){return'entrega-resp';}
function entregaRespFileUploadCtx(){return typeof resolveEntregaUploadContext==='function'?resolveEntregaUploadContext():null;}
function resolveEntregaUploadContext(){
  const actividad=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim()||'Entrega';
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  const stubTask={id:'_staging_',actividad:actividad,detalle:''};
  if(libre){
    const cod=String(window._entregaLibreCodigoPreview||'').trim();
    if(!cod)return null;
    const depto=typeof resolveDeptoActLibre==='function'?resolveDeptoActLibre():(typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare'));
    const deptoOk=(depto&&depto!=='responsables')?depto:'guaviare';
    const eDrive={
      _exp:cod,_fecha:typeof hoy==='function'?hoy():'',_depto:deptoOk,_sin_expediente:true,
      _pn_nombre:'Sin expediente',_drive_folder_id:'',_drive_folder_link:''
    };
  const t=Object.assign({},stubTask,{sinExpediente:true,codigo:cod,depto:deptoOk});
    return{esPqrs:false,esLibre:true,expId:cod,e:null,eDrive:eDrive,t:t};
  }
  if(nuevo&&pqrsNuevo){
    const expId=String((document.getElementById('er-pqrs-exp')||{}).value||(document.getElementById('entrega-resp-exp')||{}).value||'').trim();
    if(!expId)return null;
    let e=typeof getExpById==='function'?getExpById(expId):null;
    if(!e){
      const tramId=typeof getTramPqrsId==='function'?getTramPqrsId('guaviare'):'pqrs';
      e={_exp:expId,_tramite:tramId,_depto:'guaviare',_fecha:typeof hoy==='function'?hoy():'',_es_pqrs:true,_radicado_secretaria:true,_pqrs_oficina:String((document.getElementById('er-pqrs-oficina')||{}).value||defaultOficinaEntregaRespPqrs())};
    }
    return{esPqrs:true,expId:expId,e:e,eDrive:e,t:stubTask};
  }
  if(nuevo){
    const expId=String((document.getElementById('entrega-resp-exp-nuevo')||{}).value||'').trim();
    const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
    if(!expId||!tid)return null;
    let e=typeof getExpById==='function'?getExpById(expId):null;
    if(!e)e={_exp:expId,_tramite:tid,_depto:typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare'),_fecha:typeof hoy==='function'?hoy():''};
    return{esPqrs:false,expId:expId,e:e,eDrive:e,t:stubTask};
  }
  const expId=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  if(!expId)return null;
  const e=typeof getExpById==='function'?getExpById(expId):null;
  if(!e)return null;
  const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  return{esPqrs:!!esPqrs,expId:expId,e:e,eDrive:e,t:stubTask};
}
function entregaRespOnMainFileChange(inp){
  if(typeof sstFileOnMainPick!=='function'){syncEntregaRespFileLabel(inp,'entrega-resp-file-name');return;}
  sstFileOnMainPick(inp,{ctxKey:entregaRespFileCtxKey(),listId:'entrega-resp-file-list',getUploadCtx:entregaRespFileUploadCtx});
}
function entregaRespOnAnexosFileChange(inp){
  if(typeof sstFileOnAnexosPick!=='function'){syncEntregaRespFileLabel(inp,'entrega-resp-anexos-name',true);return;}
  sstFileOnAnexosPick(inp,{ctxKey:entregaRespFileCtxKey(),listId:'entrega-resp-anexos-list',getUploadCtx:entregaRespFileUploadCtx});
}
function entregaRespRetryFileUpload(){
  if(typeof sstFileTryUpload!=='function')return;
  sstFileTryUpload(entregaRespFileCtxKey(),'entrega-resp-file-list',entregaRespFileUploadCtx);
  sstFileTryUpload(entregaRespFileCtxKey(),'entrega-resp-anexos-list',entregaRespFileUploadCtx);
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
  window._entregaLibrePersonaId='';
  window._entregaRespCrearNuevo=false;
  window._entregaRespCrearTipo='';
  if(modal){
    modal.classList.add('task-modal-wide');
    modal.classList.add('enviar-modal-only');
  }
  body.innerHTML=
    '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-existente" checked onchange="onEntregaRespModoRadioChange()"> Expediente / PQRSD</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-libre" onchange="onEntregaRespModoRadioChange()"> Actividad sin expediente</label>'+
      '<input type="checkbox" id="entrega-resp-modo-nuevo" style="display:none" tabindex="-1" aria-hidden="true">'+
      '<input type="checkbox" id="entrega-resp-modo-pqrs" style="display:none" tabindex="-1" aria-hidden="true">'+
    '</div>'+
    '<div id="entrega-resp-exist-box">'+
      '<div class="fld" style="margin-bottom:8px"><label>Buscar expediente / PQRSD</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="entrega-resp-exp" placeholder="Digite N° expediente, PQRSD o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="onEntregaRespExpInput(this)" onfocus="filtrarExpEntregaRespSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-exp-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="entrega-resp-exp-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="entrega-resp-exp-hint" style="font-size:11px;color:var(--tx3);margin-top:4px">Si el número no existe, elija crear expediente o PQRSD en la lista.</div>'+
      '</div>'+
    '</div>'+
    '<div id="entrega-resp-alta-box" style="display:none">'+
      '<div style="font-size:12px;font-weight:600;color:var(--gn);margin:4px 0 8px">✚ Crear expediente (1ª entrega)</div>'+
      '<div class="fg" style="margin-bottom:4px">'+
        '<div class="fld"><label>N° expediente <span style="color:var(--rd)">*</span></label>'+
          '<input type="text" id="entrega-resp-exp-nuevo" placeholder="Número del expediente (p. ej. el de VITAL)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
        '<div class="fld"><label>Tipo de trámite <span style="color:var(--rd)">*</span></label>'+
          '<select id="entrega-resp-tramite" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" onchange="syncEntregaRespAltaFormPorTramite()">'+tramitesEntregaRespOptsHtml()+'</select></div>'+
      '</div>'+
      '<div id="entrega-resp-persona-host">'+htmlEntregaRespInteresadoBox()+'</div>'+
    '</div>'+
    '<div id="entrega-resp-alta-pqrs-box" style="display:none;margin-bottom:10px;padding:10px;border:1px solid #d4c7f0;border-radius:var(--r);background:#faf8ff">'+
      htmlEntregaRespPqrsAltaBox()+
    '</div>'+
    '<div id="entrega-resp-libre-hint" style="display:none"></div>'+
    '<div id="entrega-resp-libre-box" style="display:none;margin-bottom:10px">'+htmlEntregaLibreInteresadoBox()+'</div>'+
    '<div id="entrega-resp-actividad-wrap" class="fld" style="margin-bottom:8px;margin-top:10px"><label>Actividad predeterminada <span style="color:var(--rd)">*</span></label>'+
      '<div style="position:relative">'+
        '<input type="text" id="entrega-resp-actividad" placeholder="Escriba para buscar y elija de la lista…" autocomplete="off" '+
          'oninput="filtrarActEntregaRespSug(this)" onfocus="filtrarActEntregaRespSug(this)" '+
          'onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-act-sug\');if(p)p.style.display=\'none\';},200)" '+
          'style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+
        '<div id="entrega-resp-act-sug" class="entrega-resp-sug" style="display:none"></div>'+
      '</div>'+
      '<div id="entrega-resp-reg-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div></div>'+
    '<div id="entrega-resp-oficio-wrap" style="display:none;margin-bottom:10px">'+
      '<div class="fld"><label>N° de oficio <span id="entrega-resp-oficio-req" style="color:var(--rd)">*</span></label>'+
        '<input type="text" id="entrega-resp-oficio" placeholder="Ej. DSGV-E261485" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" oninput="entregaRespClearOficioError()" onblur="entregaRespOnOficioBlur()">'+
        '<div id="entrega-resp-oficio-err" style="display:none;font-size:11px;color:var(--rd);margin-top:4px"></div>'+
      '</div></div>'+
    '<div id="entrega-resp-registro-box" style="display:none;margin-bottom:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)"></div>'+
    '<div id="entrega-resp-notif-correo-box" style="display:none;margin-bottom:10px"></div>'+
    '<div id="entrega-resp-pqrs-box" style="display:none;margin-bottom:10px"></div>'+
    '<div id="entrega-resp-tramite-files">'+
    '<div class="fld" style="margin-bottom:10px">'+
      '<div class="sst-file-pick-row">'+
        '<button type="button" class="btn bsm" onclick="sstFilePickMainBtn()">📎 Seleccionar archivo</button>'+
        '<button type="button" class="btn bsm" onclick="sstFilePickAnexosBtn()">Anexos +</button>'+
        '<input type="file" id="enviar-adj-file" accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="entregaRespOnMainFileChange(this)">'+
        '<input type="file" id="enviar-anexos-file" multiple accept=".pdf,.doc,.docx,image/*,video/*" style="display:none" onchange="entregaRespOnAnexosFileChange(this)">'+
      '</div>'+
      '<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-top:6px;margin-bottom:2px">Principal</div>'+
      '<div id="entrega-resp-file-list" class="sst-file-slot-list"></div>'+
      '<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-top:6px;margin-bottom:2px">Anexos</div>'+
      '<div id="entrega-resp-anexos-list" class="sst-file-slot-list"></div>'+
    '</div></div>'+
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
  if(typeof sstFileStagingReset==='function')sstFileStagingReset(entregaRespFileCtxKey());
  if(typeof sstFileRegisterList==='function'){
    sstFileRegisterList('entrega-resp-file-list',entregaRespFileCtxKey(),'main');
    sstFileRegisterList('entrega-resp-anexos-list',entregaRespFileCtxKey(),'anexos');
  }
  syncEntregaRespModoUi();
  syncEntregaRespAltaFormPorTramite();
  syncEntregaRespInteresadoUi();
  syncEntregaRespRegistroUi();
  syncEntregaRespLibreUi();
  syncEntregaRespPqrsUi();
  if(typeof sstFileRenderList==='function'){
    sstFileRenderList('entrega-resp-file-list',entregaRespFileCtxKey());
    sstFileRenderList('entrega-resp-anexos-list',entregaRespFileCtxKey());
  }
  setTimeout(function(){
    const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
    const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
    const exp=document.getElementById('entrega-resp-exp');
    const nom=document.getElementById('entrega-libre-int-nombre');
    if(!libre&&!nuevo&&exp)exp.focus();
    else if(libre&&nom)nom.focus();
    const actSug=document.getElementById('entrega-resp-act-sug');
    if(actSug){actSug.style.display='none';actSug.innerHTML='';}
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
  if(!words.length){
    portal.style.display='none';
    portal.innerHTML='';
    syncEntregaRespRegistroUi();
    return;
  }
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
  syncEntregaRespLibreUi();
}

function pickActEntregaResp(val){
  const inp=document.getElementById('entrega-resp-actividad');
  if(inp)inp.value=val||'';
  const portal=document.getElementById('entrega-resp-act-sug');
  if(portal){portal.style.display='none';portal.innerHTML='';}
  syncEntregaRespRegistroUi();
  syncEntregaRespLibreUi();
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
function resolveActividadConceptoTipo(nombreAct,deptoId){
  const nom=String(nombreAct||'').trim();
  if(!nom)return'';
  const cfgAct=typeof cfgFor==='function'?cfgFor(deptoId||getDeptoOperativo()):{};
  const map=(cfgAct&&cfgAct.actConceptoTipoMap)||{};
  return map[nom]?String(map[nom]):'';
}
function syncEntregaRespNotifCorreoUi(){
  const box=document.getElementById('entrega-resp-notif-correo-box');
  if(!box)return;
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  const esPqrs=pqrsNuevo||(typeof entregaRespEsFlujoPqrs==='function'&&entregaRespEsFlujoPqrs());
  if(esPqrs){box.style.display='none';box.innerHTML='';return;}
  const act=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  if(typeof esActividadOficioRequerimiento==='function'&&esActividadOficioRequerimiento(act)){
    box.style.display='none';box.innerHTML='';
    return;
  }
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const eSel=!libre&&!nuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  const prevChecked=!!(document.getElementById('entrega-notif-correo')&&document.getElementById('entrega-notif-correo').checked);
  const prevTo=String((document.getElementById('entrega-notif-email-to')||{}).value||'');
  const prevCc=String((document.getElementById('entrega-notif-email-cc')||{}).value||'');
  const prevBcc=String((document.getElementById('entrega-notif-email-bcc')||{}).value||'');
  const prevSubj=String((document.getElementById('entrega-notif-email-subject')||{}).value||'');
  const prevCuerpo=String((document.getElementById('entrega-notif-email-cuerpo')||{}).value||'');
  const keep=!!document.getElementById('entrega-notif-email-compose');
  if(typeof htmlEntregaNotifCorreoCheck==='function'){
    box.innerHTML=htmlEntregaNotifCorreoCheck({
      id:'entrega-notif-correo',
      checked:keep?prevChecked:false,
      e:eSel,
      t:null,
      actividad:act,
      sinExpediente:libre,
      expId:libre?'':(nuevo?String((document.getElementById('entrega-resp-exp-nuevo')||{}).value||'').trim():expNum),
      emailTo:keep?prevTo:undefined,
      emailCc:keep?prevCc:undefined,
      emailBcc:keep?prevBcc:undefined,
      emailSubject:keep?prevSubj:undefined,
      cuerpo:keep?prevCuerpo:undefined
    });
  }else{
    box.innerHTML='<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;font-weight:600;cursor:pointer;margin:0"><input type="checkbox" id="entrega-notif-correo" style="margin-top:2px;width:15px;height:15px;accent-color:var(--bl);flex-shrink:0"><span>Se notificará por correo electrónico</span></label>';
  }
  box.style.display='';
}
function syncEntregaRespRegistroUi(){
  const act=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const box=document.getElementById('entrega-resp-registro-box');
  const hint=document.getElementById('entrega-resp-reg-hint');
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  if(libre){
    if(hint)hint.textContent='';
    if(box){box.style.display='none';box.innerHTML='';}
    syncEntregaRespOficioUi();
    syncEntregaRespNotifCorreoUi();
    return;
  }
  // PQRSD: no mini-form de Registro (concepto/factura/acto) — solo sobre PQRSD existente
  const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  if(pqrsNuevo||typeof entregaRespEsFlujoPqrs==='function'&&entregaRespEsFlujoPqrs()){
    if(hint)hint.textContent='';
    if(box){box.style.display='none';box.innerHTML='';}
    syncEntregaRespOficioUi();
    syncEntregaRespNotifCorreoUi();
    return;
  }
  const eSel=!nuevo&&expNum&&typeof getExpById==='function'?getExpById(expNum):null;
  if(eSel&&((typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(eSel))||(typeof esTramitePqrs==='function'&&esTramitePqrs(eSel._tramite)))){
    if(hint)hint.textContent='';
    if(box){box.style.display='none';box.innerHTML='';}
    syncEntregaRespNotifCorreoUi();
    return;
  }
  const tipo=resolveActividadRegistroTipo(act);
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgAct=typeof cfgFor==='function'?cfgFor(depto):{};
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  if(hint){
    if(!act)hint.textContent='';
    else if(!actividadPredEntregaExiste(act))hint.innerHTML='<span style="color:var(--or)">Esta actividad no está en la lista predeterminada. Contacte al administrador para configurarla.</span>';
    else if(esActividadOficioRequerimiento(act))hint.textContent='Oficio de requerimiento: N° oficio, N° requerimiento y días para cumplir.';
    else if(tipo==='concepto')hint.textContent='Apartado Registro: Información técnica / conceptos.';
    else if(tipo==='factura')hint.textContent='Apartado Registro: Información contable (Evaluación, TCAF, etc.).';
    else if(tipo==='acto')hint.textContent='Apartado Registro: Normatividad legal / actos administrativos.';
    else if(tipo==='ninguno')hint.textContent='Solo actividad (sin datos de Registro asociados).';
    else hint.textContent='Sin mapeo a Registro — el administrador puede configurarlo en Actividades predeterminadas.';
  }
  syncEntregaRespOficioUi();
  if(!box){syncEntregaRespNotifCorreoUi();return;}
  if(esActividadOficioRequerimiento(act)&&actividadPredEntregaExiste(act)){
    box.style.display='';
    const tExist=eSel?((eSel.tasks||[]).map(function(x){return typeof normalizeTask==='function'?normalizeTask(x):x;}).find(function(x){
      return x&&!x.eliminada&&esActividadOficioRequerimiento(x.actividad||'');
    })||{conceptoReqId:''}):{conceptoReqId:''};
    box.innerHTML=htmlEntregaOficioRequerimientoBlock(eSel,tExist);
    syncEntregaRespNotifCorreoUi();
    return;
  }
  if(!act||!actividadPredEntregaExiste(act)||!tipo||tipo==='ninguno'){
    box.style.display='none';box.innerHTML='';
    syncEntregaRespNotifCorreoUi();
    return;
  }
  box.style.display='';
  const hoyStr=typeof hoy==='function'?hoy():'';
  if(tipo==='concepto'){
    box.innerHTML=typeof htmlEntregaRegConceptoBlock==='function'?htmlEntregaRegConceptoBlock(eSel,{actividad:act}):'';
    setTimeout(function(){
      if(typeof coordSyncEntregaReview==='function')coordSyncEntregaReview('entrega-reg-concepto-coord');
    },0);
  }else if(tipo==='factura'){
    const tipos=(cfgAct.tiposFactura||['Evaluación','Publicación','Seguimiento','TCAF','Multa','Visita adicional','Tasa retributiva'])
      .map(function(t){return '<option value="'+escAttr(t)+'">'+escAttr(t)+'</option>';}).join('');
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Información contable · Factura</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>Tipo de factura <span style="color:var(--rd)">*</span></label><select id="entrega-reg-fac-tipo" style="'+inp+'"><option value="">— Seleccione (Evaluación, TCAF…) —</option>'+tipos+'</select></div>'+
      '<div class="fld"><label>Valor (pesos)</label>'+moneyInputHtml('entrega-reg-fac-valor','','','entrega-reg-fac-valor')+'</div>'+
      '<div class="fld"><label>Referencia / N°</label><input type="text" id="entrega-reg-fac-ref" placeholder="N° / ref." style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha vencimiento</label><input type="date" id="entrega-reg-fac-venc" style="'+inp+'"></div>'+
      '<div class="fld"><label>Fecha pago (si ya pagó)</label><input type="date" id="entrega-reg-fac-pago" style="'+inp+'"></div>'+
      '</div>';
  }else if(tipo==='acto'){
    box.innerHTML=typeof htmlEntregaRegActoBlock==='function'?htmlEntregaRegActoBlock():'';
  }
  syncEntregaRespNotifCorreoUi();
}
function htmlEntregaRegActoBlock(){
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  const hoyStr=typeof hoy==='function'?hoy():'';
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgAct=typeof cfgFor==='function'?cfgFor(depto):{};
  const actos=(cfgAct.tiposActoAdmin||[]).map(function(t){
    const n=t.nombre||t;
    return '<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>';
  }).join('');
  return '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Normatividad legal · Acto / resolución</div>'+
    '<div class="fg">'+
    '<div class="fld"><label>Tipo de acto <span style="color:var(--rd)">*</span></label><select id="entrega-reg-acto-tipo" style="'+inp+'"><option value="">— Seleccione —</option>'+actos+'</select></div>'+
    '<div class="fld"><label>N° acto administrativo</label><input type="text" id="entrega-reg-acto-num" placeholder="Número" style="'+inp+'"></div>'+
    '<div class="fld"><label>Fecha del acto</label><input type="date" id="entrega-reg-acto-fecha" value="'+hoyStr+'" style="'+inp+'"></div>'+
    '</div>';
}
function syncEntregaRespConceptoCumpleUi(){
  const cumple=String((document.getElementById('entrega-reg-concepto-cumple')||{}).value||'si');
  const aplicaWrap=document.getElementById('entrega-reg-concepto-aplica-wrap');
  if(aplicaWrap)aplicaWrap.style.display=cumple==='no'?'':'none';
  if(cumple!=='no'){
    const sel=document.getElementById('entrega-reg-concepto-aplica-req');
    if(sel)sel.value='si';
  }
  const hint=document.getElementById('entrega-reg-concepto-req-hint');
  if(hint){
    const aplica=String((document.getElementById('entrega-reg-concepto-aplica-req')||{}).value||'si');
    hint.style.display=(cumple==='no'&&aplica!=='no')?'':'none';
  }
}
function getExpCoordenadasGuardadas(e){
  if(!e)return '';
  const tramId=typeof resolveExpTramiteId==='function'?resolveExpTramiteId(e):(e._tramite||'');
  const cat=typeof getInfoTecCatalogForTramite==='function'?getInfoTecCatalogForTramite(e,tramId):[];
  const def=(cat||[]).find(function(c){return c&&c.tipo==='coordenadas';});
  const campoId=def?def.id:'coord_entrega';
  const items=typeof infoTecnicaExpData==='function'?infoTecnicaExpData(e._info_tecnica_items):[];
  const it=items.find(function(i){return i&&i.campoId===campoId;});
  if(it&&it.valor)return String(it.valor).trim();
  const g=e['g_'+campoId];
  if(g)return String(g).trim();
  return '';
}
function coordJsonEqual(a,b){
  if(!a&&!b)return true;
  if(!a||!b)return false;
  try{
    const da=typeof coordData==='function'?coordData(a):JSON.parse(a);
    const db=typeof coordData==='function'?coordData(b):JSON.parse(b);
    return JSON.stringify(da)===JSON.stringify(db);
  }catch(err){return String(a).trim()===String(b).trim();}
}
function renderEntregaConceptoCoordBlock(e,coordId){
  coordId=coordId||'entrega-reg-concepto-coord';
  const saved=e?getExpCoordenadasGuardadas(e):'';
  const hasSaved=!!saved;
  let h='';
  if(hasSaved){
    const fmt=typeof fmtCoord==='function'?fmtCoord(saved):saved;
    h+='<div id="entrega-coord-review-banner" class="entrega-coord-review-banner" style="grid-column:1/-1;margin-bottom:6px">'+
      '<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Coordenadas registradas — verifique si siguen siendo las mismas:</div>'+
      '<div style="font-size:12px;font-weight:500;color:var(--tx)">'+escAttr(fmt)+'</div></div>';
  }
  h+='<div class="fld entrega-coord-field" style="grid-column:1/-1;margin-top:6px">'+
    '<label>Coordenadas'+(hasSaved?' (verificar o actualizar)':' (opcional)')+'</label>'+
    (typeof coordHtml==='function'?coordHtml(coordId,hasSaved?saved:'',{compact:true}):'')+
    '</div>';
  if(hasSaved){
    h+='<div id="entrega-coord-cambio-wrap" class="fld" style="display:none;grid-column:1/-1;margin-top:6px">'+
      '<label>Nota de cambio de coordenadas <span style="color:var(--rd)">*</span></label>'+
      '<textarea id="entrega-coord-cambio-nota" rows="2" placeholder="Indique por qué cambian las coordenadas (obligatorio si modifica los valores registrados)…" style="width:100%;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px"></textarea></div>'+
      '<input type="hidden" id="entrega-coord-baseline" value=\''+escAttr(saved)+'\'>';
  }
  return h;
}
function htmlEntregaRegConceptoBlock(e,opts){
  opts=opts||{};
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  const hoyStr=typeof hoy==='function'?hoy():'';
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const tipos=typeof getTiposConceptoCfg==='function'?getTiposConceptoCfg(depto):['Concepto técnico','Informe técnico','Otro'];
  const defTipo=opts.tipoConcepto||resolveActividadConceptoTipo(opts.actividad||'',depto)||'';
  const tipoOpts=tipos.map(function(t){
    return '<option value="'+escAttr(t)+'"'+(defTipo===t?' selected':'')+'>'+escAttr(t)+'</option>';
  }).join('');
  const coordBlock=typeof renderEntregaConceptoCoordBlock==='function'?renderEntregaConceptoCoordBlock(e,'entrega-reg-concepto-coord'):'';
  return '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Información técnica · Concepto</div>'+
    '<div class="fg">'+
    '<div class="fld"><label>Tipo de concepto <span style="color:var(--rd)">*</span></label><select id="entrega-reg-concepto-tipo" style="'+inp+'"><option value="">— Seleccione —</option>'+tipoOpts+'</select></div>'+
    '<div class="fld"><label>N° concepto técnico</label><input type="text" id="entrega-reg-concepto" placeholder="N° concepto" style="'+inp+'"></div>'+
    '<div class="fld"><label>Fecha elaboración</label><input type="date" id="entrega-reg-concepto-fecha" value="'+hoyStr+'" style="'+inp+'"></div>'+
    '<div class="fld"><label>¿Cumple?</label><select id="entrega-reg-concepto-cumple" onchange="syncEntregaRespConceptoCumpleUi()" style="'+inp+'"><option value="si">Cumple</option><option value="no">No cumple</option><option value="na">No aplica</option></select></div>'+
    '<div class="fld" id="entrega-reg-concepto-aplica-wrap" style="display:none"><label>¿Aplica requerimiento?</label><select id="entrega-reg-concepto-aplica-req" onchange="syncEntregaRespConceptoCumpleUi()" style="'+inp+'"><option value="si">Sí</option><option value="no">No</option></select></div>'+
    '<div class="fld" style="grid-column:1/-1"><label>Observaciones / recomendaciones</label><textarea id="entrega-reg-concepto-obs" style="min-height:55px;'+inp+'"></textarea></div>'+
    coordBlock+
    '</div>'+
    '<div id="entrega-reg-concepto-req-hint" style="display:none"></div>';
}
function coordSyncEntregaReview(id){
  if(String(id||'')!=='entrega-reg-concepto-coord')return;
  const baseEl=document.getElementById('entrega-coord-baseline');
  const wrap=document.getElementById('entrega-coord-cambio-wrap');
  if(!baseEl||!wrap)return;
  const hid=document.getElementById(id);
  const cur=hid?String(hid.value||'').trim():'';
  const base=String(baseEl.value||'').trim();
  const changed=!!base&&(!cur||!coordJsonEqual(cur,base));
  wrap.style.display=changed?'':'none';
  if(!changed){
    const nota=document.getElementById('entrega-coord-cambio-nota');
    if(nota)nota.value='';
  }
}
function syncEntregaRespActoVencUi(){
  // La fecha de vencimiento del acto ya no se pide en la entrega a revisión;
  // se diligencia al notificar (correo / presencial / WhatsApp / aviso).
}
function collectEntregaRespRegistroPayload(actividad){
  const tipo=resolveActividadRegistroTipo(actividad);
  if(!tipo||tipo==='ninguno')return null;
  if(tipo==='concepto'){
    if(!document.getElementById('entrega-reg-concepto'))return null;
    const cumple=String((document.getElementById('entrega-reg-concepto-cumple')||{}).value||'si');
    const coordEl=document.getElementById('entrega-reg-concepto-coord');
    if(coordEl&&typeof coordSync==='function'){
      try{coordSync('entrega-reg-concepto-coord',null,true);}catch(err){}
    }
    const coordenadas=coordEl?String(coordEl.value||'').trim():'';
    const tipoConcepto=String((document.getElementById('entrega-reg-concepto-tipo')||{}).value||'').trim();
    if(!tipoConcepto){
      notif('Seleccione el tipo de concepto','err');
      return false;
    }
    const baseline=String((document.getElementById('entrega-coord-baseline')||{}).value||'').trim();
    let coordCambioNota='';
    let coordAnterior='';
    if(baseline&&(!coordenadas||!coordJsonEqual(coordenadas,baseline))){
      coordCambioNota=String((document.getElementById('entrega-coord-cambio-nota')||{}).value||'').trim();
      if(!coordCambioNota){
        notif('Indique el motivo del cambio de coordenadas','err');
        return false;
      }
      coordAnterior=baseline;
    }
    const aplicaReq=cumple==='no'&&String((document.getElementById('entrega-reg-concepto-aplica-req')||{}).value||'si')!=='no';
    const conceptoReqId=aplicaReq?('cr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)):'';
    return{tipo:'concepto',item:{
      tipoConcepto:tipoConcepto,
      fecha:String((document.getElementById('entrega-reg-concepto-fecha')||{}).value||(typeof hoy==='function'?hoy():'')),
      concepto:String((document.getElementById('entrega-reg-concepto')||{}).value||'').trim(),
      observaciones:String((document.getElementById('entrega-reg-concepto-obs')||{}).value||'').trim(),
      cumple:cumple,
      aplicaReq:aplicaReq,
      conceptoReqId:conceptoReqId,
      coordenadas:coordenadas,
      coordCambioNota:coordCambioNota,
      coordAnterior:coordAnterior,
      reqOficio:'',
      reqNum:'',
      reqNotif:'',
      reqDias:'',
      reqVence:'',
      reqMedio:'',
      reqCumplido:false,reqFechaCump:'',trasladoSan:false,expSan:''
    }};
  }
  if(tipo==='factura'){
    const valorRaw=typeof moneyRaw==='function'
      ?moneyRaw(String((document.getElementById('entrega-reg-fac-valor')||{}).value||''))
      :String((document.getElementById('entrega-reg-fac-valor')||{}).value||'').trim();
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
    if(!document.getElementById('entrega-reg-acto-tipo'))return null;
    return{tipo:'acto',item:{
      actoAdminId:'aa_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),
      tipo:String((document.getElementById('entrega-reg-acto-tipo')||{}).value||'').trim(),
      numero:String((document.getElementById('entrega-reg-acto-num')||{}).value||'').trim(),
      fecha:String((document.getElementById('entrega-reg-acto-fecha')||{}).value||(typeof hoy==='function'?hoy():'')),
      vencimiento:'',
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
    if(!item.concepto&&!item.observaciones&&!item.coordenadas&&!item.tipoConcepto)return false;
    arr.push(item);
    e._conceptos_seg=JSON.stringify(arr);
    if(item.coordenadas){
      const coordOpts={};
      if(item.coordCambioNota){
        coordOpts.notaCambio=item.coordCambioNota;
        coordOpts.coordAnterior=item.coordAnterior||'';
        coordOpts.coordAnteriorFmt=typeof fmtCoord==='function'?fmtCoord(item.coordAnterior):'';
      }
      appendCoordEntregaAInfoTecnica(e,item.coordenadas,coordOpts);
    }
    if(item.aplicaReq&&item.conceptoReqId){
      ensureOficioRequerimientoTask(e,item);
    }
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
    const clean=typeof cleanActoForStore==='function'?cleanActoForStore(item):Object.assign({},item);
    if(!clean.tipo&&!clean.numero)return false;
    if(!clean.actoAdminId)clean.actoAdminId='aa_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
    clean.vencimiento=clean.vencimiento||'';
    arr.push(clean);
    e._actos_admin=JSON.stringify(arr);
    if(clean.numero&&!e._resolucion){e._resolucion=clean.numero;e._fecha_res=clean.fecha||'';}
    // Vincular el acto a la tarea en entrega (para pedir vencimiento al notificar)
    try{
      const ctx=window._taskModalCtx||{};
      let t=null;
      if(ctx.taskId&&typeof getTaskFromExp==='function')t=getTaskFromExp(e,ctx.taskId);
      if(!t&&e.tasks&&e.tasks.length)t=e.tasks[e.tasks.length-1];
      if(t){
        t.actoAdminId=clean.actoAdminId;
        t.esActoAdmin=true;
      }
    }catch(errLink){}
    return true;
  }
  return false;
}

const ACT_OFICIO_REQUERIMIENTO='Oficio de requerimiento';
function esActividadOficioRequerimiento(nombreAct){
  return /^oficio\s+de\s+requerimiento$/i.test(String(nombreAct||'').trim());
}
function findConceptoByReqId(e,conceptoReqId){
  const id=String(conceptoReqId||'').trim();
  if(!e||!id)return null;
  const arr=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
  for(let i=0;i<arr.length;i++){
    if(arr[i]&&String(arr[i].conceptoReqId||'')===id)return{item:arr[i],index:i,arr:arr};
  }
  return null;
}
function ensureOficioRequerimientoTask(e,conceptoItem){
  if(!e||!conceptoItem||!conceptoItem.conceptoReqId)return null;
  e.tasks=Array.isArray(e.tasks)?e.tasks:[];
  const reqId=String(conceptoItem.conceptoReqId);
  const existing=e.tasks.map(function(t){return typeof normalizeTask==='function'?normalizeTask(t):t;}).find(function(t){
    return t&&!t.eliminada&&String(t.conceptoReqId||'')===reqId&&esActividadOficioRequerimiento(t.actividad||t.desc||'');
  });
  if(existing)return existing;
  const responsable=(typeof responsableActivo!=='undefined'&&responsableActivo)
    ||(typeof taskComentarioAutor==='function'?taskComentarioAutor():'')
    ||'';
  if(!responsable)return null;
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const vence=typeof calcVenceConUnidad==='function'?calcVenceConUnidad(hoyStr,1,'dias'):hoyStr;
  const detalle=conceptoItem.concepto?('Concepto '+conceptoItem.concepto):(conceptoItem.tipoConcepto||'');
  const t={
    id:typeof genTaskId==='function'?genTaskId():('tk_'+Date.now()),
    actividad:ACT_OFICIO_REQUERIMIENTO,
    detalle:detalle,
    desc:ACT_OFICIO_REQUERIMIENTO+(detalle?' — '+detalle:''),
    responsable:responsable,
    responsables:[responsable],
    asignados:[{nombre:responsable,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}],
    entregaModo:'individual',
    plazoDias:'1',
    plazoUnidad:'dias',
    vence:vence,
    fechaAtendida:'',
    fechaReportada:'',
    estado:'En ejecución',
    prioritaria:true,
    eliminada:false,
    comentarios:[],
    historial:[{
      tipo:'auto_oficio_requerimiento',
      fecha:hoyStr,
      por:responsable,
      nota:'Creada automáticamente al registrar concepto que no cumple y aplica requerimiento'
    }],
    soportes:[],
    notasDoc:[],
    conceptoReqId:reqId,
    esOficioRequerimiento:true,
    origen:'auto_concepto_req'
  };
  const nt=typeof normalizeTask==='function'?normalizeTask(t):t;
  e.tasks.push(nt);
  if(typeof logAudit==='function')logAudit('Oficio de requerimiento autoasignado ['+e._exp+'] a '+responsable,'expedientes',e._exp);
  return nt;
}
function htmlEntregaOficioRequerimientoBlock(e,t){
  const inp='width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)';
  const hit=e&&t?findConceptoByReqId(e,t.conceptoReqId):null;
  const c=hit?hit.item:{};
  const notifCorreo=String(c.reqMedio||'')==='correo'
    ||!!(t&&(t.notifCorreoEntrega||(t.firmaWf&&t.firmaWf.notif_correo_entrega)));
  const notifHtml=typeof htmlEntregaNotifCorreoCheck==='function'
    ?htmlEntregaNotifCorreoCheck({
      id:'entrega-notif-correo',
      checked:notifCorreo,
      e:e,
      t:t,
      actividad:String((t&&(t.actividad||t.desc))||'Oficio de requerimiento').trim()
    })
    :'<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;font-weight:600;cursor:pointer;margin:0"><input type="checkbox" id="entrega-notif-correo"'+(notifCorreo?' checked':'')+' onchange="entregaNotifCorreoToggleUi(\'entrega-notif-correo\')" style="margin-top:2px;width:15px;height:15px;accent-color:var(--bl);flex-shrink:0"><span>Se notificará por correo electrónico</span></label>';
  return '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--or)">Oficio de requerimiento</div>'+
    '<input type="hidden" id="entrega-ofi-req-concepto-id" value="'+escAttr(t&&t.conceptoReqId||c.conceptoReqId||'')+'">'+
    '<div class="fg">'+
    '<div class="fld"><label>N° de oficio <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-ofi-req-oficio" value="'+escAttr(c.reqOficio||'')+'" placeholder="Ej. DSGV-E261485" style="'+inp+'"></div>'+
    '<div class="fld"><label>N° requerimiento <span style="color:var(--rd)">*</span></label><input type="text" id="entrega-ofi-req-num" value="'+escAttr(c.reqNum||'')+'" placeholder="N° requerimiento" style="'+inp+'"></div>'+
    '<div class="fld"><label>Días para cumplir <span style="color:var(--rd)">*</span></label><input type="number" id="entrega-ofi-req-dias" min="1" value="'+escAttr(c.reqDias||'')+'" placeholder="Ej. 10" style="'+inp+'"></div>'+
    '</div>'+
    '<div style="margin-top:10px">'+notifHtml+'</div>';
}
function syncEntregaOfiReqMedioUi(){
  // Compat: el medio inmediato ya no se captura en la entrega (solo checkbox de correo).
}
function collectEntregaOficioRequerimientoPayload(){
  if(!document.getElementById('entrega-ofi-req-num')&&!document.getElementById('entrega-ofi-req-oficio'))return null;
  const oficio=String((document.getElementById('entrega-ofi-req-oficio')||{}).value||'').trim();
  const reqNum=String((document.getElementById('entrega-ofi-req-num')||{}).value||'').trim();
  const dias=String((document.getElementById('entrega-ofi-req-dias')||{}).value||'').trim();
  const notifCorreo=typeof entregaNotifCorreoCheckedFromUi==='function'
    ?!!entregaNotifCorreoCheckedFromUi()
    :!!(document.getElementById('entrega-notif-correo')&&document.getElementById('entrega-notif-correo').checked);
  const medio=notifCorreo?'correo':'';
  const conceptoReqId=String((document.getElementById('entrega-ofi-req-concepto-id')||{}).value||'').trim();
  if(!oficio){notif('Indique el N° de oficio','err');return false;}
  if(!reqNum){notif('Indique el N° de requerimiento','err');return false;}
  if(!dias||isNaN(Number(dias))||Number(dias)<1){notif('Indique los días para cumplir (mínimo 1)','err');return false;}
  return{
    tipo:'oficio_requerimiento',
    item:{
      conceptoReqId:conceptoReqId,
      reqOficio:oficio,
      reqNum:reqNum,
      reqDias:dias,
      reqMedio:medio,
      reqNotif:'',
      reqVence:''
    }
  };
}
function applyEntregaOficioRequerimiento(e,t,item){
  if(!e||!item)return false;
  const reqId=String(item.conceptoReqId||(t&&t.conceptoReqId)||'').trim();
  const hit=findConceptoByReqId(e,reqId);
  if(!hit){
    notif('No se encontró el concepto vinculado al requerimiento','err');
    return false;
  }
  if(typeof validarNumeroRequerimientoDisponible==='function'){
    if(!validarNumeroRequerimientoDisponible(item.reqNum,e._exp,hit.index))return false;
  }
  if(typeof validarNumeroOficioDisponible==='function'&&item.reqOficio){
    if(!validarNumeroOficioDisponible(item.reqOficio,e._exp))return false;
  }
  hit.item.reqOficio=item.reqOficio;
  hit.item.reqNum=item.reqNum;
  hit.item.reqDias=item.reqDias;
  hit.item.reqMedio=item.reqMedio||'';
  hit.item.aplicaReq=true;
  if(item.reqNotif){
    hit.item.reqNotif=item.reqNotif;
    hit.item.reqVence=item.reqVence||(typeof calcReqVence==='function'?calcReqVence(item.reqNotif,item.reqDias):'');
  }
  e._conceptos_seg=JSON.stringify(hit.arr);
  if(t){
    t.conceptoReqId=reqId;
    t.esOficioRequerimiento=true;
    if(item.reqOficio)t.oficioNumero=item.reqOficio;
  }
  return true;
}
function applyConceptoReqDesdeNotificacion(e,t,fechaNotif,canal){
  if(!e||!t||!esActividadOficioRequerimiento(t.actividad||t.desc||''))return false;
  const hit=findConceptoByReqId(e,t.conceptoReqId);
  if(!hit||!hit.item)return false;
  if(hit.item.reqNotif)return true;
  const fecha=String(fechaNotif||(typeof hoy==='function'?hoy():'')).trim();
  if(!fecha)return false;
  hit.item.reqNotif=fecha;
  hit.item.reqMedio=canal||hit.item.reqMedio||'correo';
  hit.item.reqVence=typeof calcReqVence==='function'?calcReqVence(fecha,hit.item.reqDias):'';
  e._conceptos_seg=JSON.stringify(hit.arr);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  return true;
}

function findActoByAdminId(e,actoAdminId){
  const id=String(actoAdminId||'').trim();
  if(!e||!id)return null;
  const arr=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
  for(let i=0;i<arr.length;i++){
    if(arr[i]&&String(arr[i].actoAdminId||'')===id)return{item:arr[i],index:i,arr:arr};
  }
  return null;
}
function taskTieneActoAdminPendienteVenc(e,t){
  if(!t)return false;
  if(t.actoAdminId||t.esActoAdmin)return true;
  const act=String(t.actividad||t.desc||'').trim();
  if(typeof resolveActividadRegistroTipo==='function'&&resolveActividadRegistroTipo(act)==='acto')return true;
  return false;
}
function resolveActoParaNotificacion(e,t){
  if(!e||!t)return null;
  let hit=findActoByAdminId(e,t.actoAdminId);
  if(hit)return hit;
  const arr=typeof actosAdminData==='function'?actosAdminData(e._actos_admin):[];
  if(!arr.length)return null;
  // Preferir el último acto sin vencimiento; si no, el último
  for(let i=arr.length-1;i>=0;i--){
    if(arr[i]&&!String(arr[i].vencimiento||'').trim())return{item:arr[i],index:i,arr:arr};
  }
  return{item:arr[arr.length-1],index:arr.length-1,arr:arr};
}
function htmlTramiteNotifActoVencBlock(e,t){
  if(!taskTieneActoAdminPendienteVenc(e,t))return'';
  const hit=resolveActoParaNotificacion(e,t);
  const a=hit?hit.item:{};
  const tieneCfg=typeof getTipoActo==='function'&&a.tipo?!!(getTipoActo(a.tipo)||{}).tieneVencimiento:true;
  const defSi=!!(a.vencimiento||tieneCfg);
  const venc=String(a.vencimiento||'');
  return '<div id="tramite-notif-acto-venc-box" style="margin-bottom:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf);border-left:3px solid var(--bl)">'+
    '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--bl)">Acto / resolución · Vencimiento</div>'+
    '<input type="hidden" id="tramite-notif-acto-id" value="'+escAttr(a.actoAdminId||t.actoAdminId||'')+'">'+
    '<div class="fld" style="margin-bottom:8px"><label>¿El acto administrativo cuenta con fecha de vencimiento? <span class="req-star">*</span></label>'+
    '<select id="tramite-notif-acto-tiene-venc" onchange="syncTramiteNotifActoVencUi()" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)">'+
    '<option value="si"'+(defSi?' selected':'')+'>Sí</option>'+
    '<option value="no"'+(defSi?'':' selected')+'>No</option>'+
    '</select></div>'+
    '<div class="fld" id="tramite-notif-acto-venc-wrap" style="'+(defSi?'':'display:none')+'"><label>Fecha de vencimiento <span class="req-star">*</span></label>'+
    '<input type="date" id="tramite-notif-acto-venc" value="'+escAttr(venc)+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)">'+
    '<div style="font-size:11px;color:var(--tx2);margin-top:4px">A partir de esta fecha se calcula la vigencia; si vence, el expediente mostrará el flag de resolución vencida. También puede modificarse en Registro → Normatividad.</div></div>'+
    '</div>';
}
function syncTramiteNotifActoVencUi(){
  const tiene=String((document.getElementById('tramite-notif-acto-tiene-venc')||{}).value||'no');
  const wrap=document.getElementById('tramite-notif-acto-venc-wrap');
  if(wrap)wrap.style.display=tiene==='si'?'':'none';
  if(tiene!=='si'){
    const f=document.getElementById('tramite-notif-acto-venc');
    if(f)f.value='';
  }
}
function collectTramiteNotifActoVencimiento(){
  if(!document.getElementById('tramite-notif-acto-tiene-venc'))return null;
  const tiene=String((document.getElementById('tramite-notif-acto-tiene-venc')||{}).value||'no');
  const actoAdminId=String((document.getElementById('tramite-notif-acto-id')||{}).value||'').trim();
  if(tiene!=='si')return{actoAdminId:actoAdminId,tieneVencimiento:false,vencimiento:''};
  const venc=String((document.getElementById('tramite-notif-acto-venc')||{}).value||'').trim();
  if(!venc){
    notif('Indique la fecha de vencimiento del acto administrativo','err');
    return false;
  }
  return{actoAdminId:actoAdminId,tieneVencimiento:true,vencimiento:venc};
}
function applyActoVencimientoDesdeNotificacion(e,t,payload){
  if(!e||payload===false)return false;
  if(!payload)return true;
  const hit=resolveActoParaNotificacion(e,t)||findActoByAdminId(e,payload.actoAdminId);
  if(!hit||!hit.item){
    if(payload.tieneVencimiento){notif('No se encontró el acto administrativo para guardar el vencimiento','err');return false;}
    return true;
  }
  if(payload.tieneVencimiento)hit.item.vencimiento=payload.vencimiento;
  else hit.item.vencimiento='';
  if(!hit.item.actoAdminId&&payload.actoAdminId)hit.item.actoAdminId=payload.actoAdminId;
  e._actos_admin=JSON.stringify(hit.arr);
  if(t){
    t.actoAdminId=hit.item.actoAdminId||t.actoAdminId||'';
    t.esActoAdmin=true;
  }
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  return true;
}

/** Guarda coordenadas de la entrega en información técnica (campo coordenadas del catálogo o g_coord_entrega). */
function appendCoordEntregaAInfoTecnica(e,coordJson,opts){
  opts=opts||{};
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
  if(opts.notaCambio){
    const autor=typeof responsableActivo!=='undefined'&&responsableActivo?responsableActivo:(typeof taskComentarioAutor==='function'?taskComentarioAutor():'');
    const fecha=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
    const txt='Cambio de coordenadas: '+opts.notaCambio+(opts.coordAnteriorFmt?' · Anterior: '+opts.coordAnteriorFmt:'');
    if(typeof detalleNotasData==='function'){
      const notas=detalleNotasData(e._detalle_notas);
      notas.push({texto:txt,autor:autor,fecha:fecha});
      e._detalle_notas=JSON.stringify(notas);
    }
    if(typeof logAudit==='function')logAudit('Coordenadas actualizadas ['+e._exp+']: '+opts.notaCambio,'expedientes',e._exp);
  }
}

function validateAndAppendEntregaRegistro(e,regPayload){
  if(!e||!regPayload||regPayload===false)return false;
  if(regPayload.tipo==='oficio_requerimiento'){
    return applyEntregaOficioRequerimiento(e,null,regPayload.item);
  }
  if(regPayload.tipo==='factura'&&!regPayload.item.tipo){
    notif('Seleccione el tipo de factura (Evaluación, TCAF, etc.)','err');
    return false;
  }
  if(regPayload.tipo==='acto'&&!regPayload.item.tipo){
    notif('Seleccione el tipo de acto / resolución','err');
    return false;
  }
  if(regPayload.tipo==='factura'&&regPayload.item.ref&&typeof validarNumeroFacturaDisponible==='function'){
    if(!validarNumeroFacturaDisponible(regPayload.item.ref,null,null))return false;
  }
  if(regPayload.tipo==='concepto'&&regPayload.item.concepto&&typeof validarNumeroConceptoDisponible==='function'){
    if(!validarNumeroConceptoDisponible(regPayload.item.concepto,null,null))return false;
  }
  if(regPayload.tipo==='acto'&&regPayload.item.numero&&typeof validarNumeroOficioDisponible==='function'){
    if(!validarNumeroOficioDisponible(regPayload.item.numero,e._exp))return false;
  }
  appendRegistroDesdeEntrega(e,regPayload);
  return true;
}

function trySaveEntregaRegistroFromPanel(e,actividad){
  if(!e||!actividad)return true;
  if(esActividadOficioRequerimiento(actividad)&&document.getElementById('entrega-ofi-req-oficio')){
    const payload=collectEntregaOficioRequerimientoPayload();
    if(payload===false)return false;
    if(!payload)return true;
    const ctx=window._taskModalCtx||{};
    let t=null;
    if(ctx.taskId&&typeof getTaskFromExp==='function')t=getTaskFromExp(e,ctx.taskId);
    if(!t){
      t=(e.tasks||[]).map(function(x){return typeof normalizeTask==='function'?normalizeTask(x):x;}).find(function(x){
        return x&&!x.eliminada&&esActividadOficioRequerimiento(x.actividad||'')&&
          (!payload.item.conceptoReqId||String(x.conceptoReqId||'')===String(payload.item.conceptoReqId||''));
      })||null;
    }
    return applyEntregaOficioRequerimiento(e,t,payload.item);
  }
  if(!document.getElementById('entrega-reg-concepto')&&!document.getElementById('entrega-reg-acto-tipo'))return true;
  const regPayload=collectEntregaRespRegistroPayload(actividad);
  if(regPayload===false)return false;
  if(!regPayload)return true;
  const ok=validateAndAppendEntregaRegistro(e,regPayload);
  if(ok&&regPayload.tipo==='acto'&&regPayload.item&&regPayload.item.actoAdminId){
    const ctx=window._taskModalCtx||{};
    let t=null;
    if(ctx.taskId&&typeof getTaskFromExp==='function')t=getTaskFromExp(e,ctx.taskId);
    if(t){t.actoAdminId=regPayload.item.actoAdminId;t.esActoAdmin=true;}
  }
  return ok;
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
  const plazoMeta=typeof getPlazoEntregaResponsable==='function'?getPlazoEntregaResponsable():{dias:5,unidad:'habiles',vence:''};
  const t={
    id:id,
    actividad:String(actividad||'').trim(),
    detalle:String(detalle||'').trim(),
    desc:'',
    responsable:responsable,
    responsables:[responsable],
    asignados:[{nombre:responsable,fechaReportada:'',fechaAtendida:'',estado:'pendiente'}],
    entregaModo:'individual',
    plazoDias:String(plazoMeta.dias||''),
    plazoUnidad:plazoMeta.unidad||'habiles',
    vence:plazoMeta.vence||'',
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

function collectEntregaRespPqrsAlta(){
  const gv=function(id){return String((document.getElementById(id)||{}).value||'').trim();};
  const interna=!!((document.getElementById('er-pqrs-interna')||{}).checked);
  const anon=interna?false:!!((document.getElementById('er-pqrs-anonimo')||{}).checked);
  const tipoPersonaRaw=(interna||anon)?'':gv('er-pqrs-tipo-persona');
  const data={
    expId:gv('er-pqrs-exp')||gv('entrega-resp-exp'),
    fechaSol:gv('er-pqrs-fecha-solicitud'),
    tipo:gv('er-pqrs-tipo'),
    medio:typeof normMedioRecepcionPqrs==='function'?normMedioRecepcionPqrs(gv('er-pqrs-medio')):gv('er-pqrs-medio'),
    interna:interna,
    anonimo:anon,
    anonCorreo:anon?gv('er-pqrs-anon-correo').toLowerCase():'',
    anonTel:anon?gv('er-pqrs-anon-tel'):'',
    oficinaRemitente:interna?gv('er-pqrs-oficina-remitente'):'',
    medioNotif:interna?'':(typeof medioNotificacionNorm==='function'?medioNotificacionNorm(gv('er-pqrs-medio-notif')):gv('er-pqrs-medio-notif')),
    tipoPersona:tipoPersonaRaw,
    asunto:gv('er-pqrs-asunto'),
    detalle:gv('er-pqrs-detalle'),
    oficina:gv('er-pqrs-oficina'),
    pn:{nombre:gv('er-pqrs-pn-nombre'),ident:gv('er-pqrs-pn-identificacion'),correo:gv('er-pqrs-pn-correo'),tel:gv('er-pqrs-pn-telefono')},
    pj:{
      empresa:gv('er-pqrs-pj-empresa'),nit:gv('er-pqrs-pj-nit'),correo:gv('er-pqrs-pj-correo'),tel:gv('er-pqrs-pj-telefono'),
      ofiNombre:gv('er-pqrs-pj-ofi-nombre'),ofiIdent:gv('er-pqrs-pj-ofi-identificacion'),ofiCorreo:gv('er-pqrs-pj-ofi-correo'),ofiTel:gv('er-pqrs-pj-ofi-telefono')
    }
  };
  return data;
}
function validateEntregaRespPqrsAlta(d){
  if(!d||!d.expId)return'Indique el número de PQRSD';
  if(String(d.expId).trim().length<2)return'Indique un número de PQRSD válido';
  if(!d.fechaSol)return'Indique la fecha de solicitud';
  if(!d.tipo)return'Seleccione el tipo de solicitud';
  if(!d.medio)return'Seleccione el medio de recepción';
  if(d.interna){
    if(!d.oficinaRemitente)return'Seleccione la oficina remitente';
  }else if(!d.anonimo){
    if(!d.tipoPersona)return'Seleccione el tipo de persona';
    if(d.tipoPersona==='natural'&&!d.pn.nombre)return'Indique el nombre del solicitante';
    if(d.tipoPersona==='juridica'){
      if(!d.pj.empresa)return'Indique la razón social o entidad';
      if(!d.pj.ofiNombre)return'Indique el nombre de quien radica la solicitud';
    }
  }
  if(!d.asunto)return'Indique el asunto / tema';
  if(!d.oficina)return'Seleccione la oficina';
  return'';
}
function crearStubPqrsEntregaResp(datos){
  datos=datos||{};
  const expId=String(datos.expId||'').trim();
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  const fechaSol=String(datos.fechaSol||hoyStr).trim()||hoyStr;
  const fecha=hoyStr;
  if(!expId){notif('Indique el número de PQRSD','err');return null;}
  if(typeof getExpById==='function'&&getExpById(expId)){notif('Ya existe un registro con ese número — use la búsqueda de existente','err');return null;}
  if(typeof expNumeroDuplicado==='function'&&expNumeroDuplicado(expId)){
    notif('Número de PQRSD duplicado','err');
    return null;
  }
  const tramId=typeof getTramPqrsId==='function'?getTramPqrsId('guaviare'):'pqrs';
  const interna=!!datos.interna;
  const anon=!!datos.anonimo&&!interna;
  const oficina=String(datos.oficina||defaultOficinaEntregaRespPqrs()).trim();
  const tipoPersona=(interna||anon)?'natural':(datos.tipoPersona||'natural');
  const medio=datos.medio||'Ventanilla';
  const tipo=datos.tipo||'Petición';
  const asunto=datos.asunto||'';
  const detalle=datos.detalle||'';
  let nombre='',ident='',correo='',tel='';
  const pjFields={};
  if(interna){
    nombre=datos.oficinaRemitente||'';
  }else if(anon){
    correo=String(datos.anonCorreo||'').trim().toLowerCase();
    tel=String(datos.anonTel||'').trim();
  }else if(tipoPersona==='juridica'){
    pjFields._tipo_persona='juridica';
    pjFields._pj_empresa=datos.pj&&datos.pj.empresa||'';
    pjFields._pj_nit=typeof formatNitDisplay==='function'?formatNitDisplay(datos.pj&&datos.pj.nit||''):(datos.pj&&datos.pj.nit||'');
    pjFields._pj_correo=datos.pj&&datos.pj.correo||'';
    pjFields._pj_telefono=datos.pj&&datos.pj.tel||'';
    pjFields._qd_nombre=datos.pj&&datos.pj.ofiNombre||'';
    pjFields._qd_identificacion=typeof formatIdentDisplay==='function'?formatIdentDisplay(datos.pj&&datos.pj.ofiIdent||''):(datos.pj&&datos.pj.ofiIdent||'');
    pjFields._qd_correo=datos.pj&&datos.pj.ofiCorreo||'';
    pjFields._qd_telefono=datos.pj&&datos.pj.ofiTel||'';
    nombre=pjFields._pj_empresa||pjFields._qd_nombre;
    ident=pjFields._pj_nit||pjFields._qd_identificacion;
    correo=pjFields._pj_correo||pjFields._qd_correo;
    tel=pjFields._pj_telefono||pjFields._qd_telefono;
  }else{
    nombre=datos.pn&&datos.pn.nombre||'';
    ident=typeof formatIdentDisplay==='function'?formatIdentDisplay(datos.pn&&datos.pn.ident||''):(datos.pn&&datos.pn.ident||'');
    correo=datos.pn&&datos.pn.correo||'';
    tel=datos.pn&&datos.pn.tel||'';
  }
  const por=responsableActivo||'Responsable';
  const detNotas=detalle?JSON.stringify([{texto:detalle,autor:por,fecha:fecha}]):'[]';
  const hist=[
    {tipo:'radicacion',fecha:fecha,nota:(interna?'Radicado interno (oficina remitente: '+(datos.oficinaRemitente||'')+'). ':(anon?'Solicitud anónima. ':''))+'Alta PQRSD por responsable ('+por+') — transición (ya radicada fuera de la app)',oficina:''},
    {tipo:'traslado_oficina',fecha:fecha,nota:'Asignada a oficina competente al crear desde entrega',oficina:oficina,oficinaAnterior:'secretaria',por:por}
  ];
  const tipoRadicacion=typeof tipoRadicacionDesdeMedioPqrs==='function'?tipoRadicacionDesdeMedioPqrs(medio):(medio==='Ventanilla'?'radicacion_ventanilla':'radicacion_otro');
  const raw={
    _depto:'guaviare',_tramite:tramId,_exp:expId,_estado:'En trámite',_fecha:fecha,_fecha_solicitud:fechaSol,_pqrs_fecha_termino:'',
    _fechas_estado:JSON.stringify({Solicitud:fechaSol,'En trámite':fecha}),
    _es_pqrs:true,_es_queja:true,_tipo_solicitud:tipo,
    _tipo_persona:tipoPersona,
    _pqrs_interna:!!interna,
    _pqrs_oficina_remitente:interna?(datos.oficinaRemitente||''):'',
    _medio_notificacion:datos.medioNotif||'',_pqrs_prioritaria:false,
    _qd_anonimo:!!anon,
    _qd_nombre:interna?(datos.oficinaRemitente||''):(anon?'':nombre),
    _qd_identificacion:interna||anon?'':ident,
    _qd_correo:interna?'':correo,
    _qd_telefono:interna?'':tel,
    _pn_nombre:interna?(datos.oficinaRemitente||''):(tipoPersona==='natural'&&!anon?nombre:''),
    _pn_identificacion:tipoPersona==='natural'&&!interna&&!anon?ident:'',
    _pn_correo:tipoPersona==='natural'&&!interna&&!anon?correo:'',
    _pn_telefono:tipoPersona==='natural'&&!interna&&!anon?tel:'',
    ...pjFields,
    f_f1:asunto,f_f2:medio,
    _detalle_notas:detNotas,_detalle_general:detalle,
    _radicado_secretaria:true,_pqrs_oficina:oficina,
    _pqrs_pendiente_traslado:false,
    _pqrs_traslado_fecha:fecha,_pqrs_traslado_por:por,
    _pqrs_estado_oficina:'asignado',_pqrs_responsable_oficina:por,
    _pqrs_solicitud_link:'',_pqrs_solicitud_archivo:'',_pqrs_detalle:detalle,
    _pqrs_drive_folder_link:'',_pqrs_drive_folder_id:'',
    _pqrs_drive_solicitud_folder_id:'',_pqrs_drive_respuesta_folder_id:'',_pqrs_drive_path_label:'',
    _pqrs_historial:hist,tasks:[],
    _gmail_message_id:null,_pqrs_gmail_attachments:null,_gmail_email_data:null,
    _pqrs_workflow:JSON.stringify({fase:typeof PQRS_WF!=='undefined'?PQRS_WF.SIN_RESPUESTA:'sin_respuesta',tipo_radicacion:tipoRadicacion}),
    _alta_por_responsable:true,
    _alta_por:por,
    _alta_fecha:fecha,
    _pendiente_revision_alta:true,
    _alta_revisada_en:'',
    _alta_revisada_por:''
  };
  const data=typeof normalizePqrsOficinaFields==='function'?normalizePqrsOficinaFields(raw):raw;
  if(!Array.isArray(exps))exps=[];
  exps.push(data);
  if(typeof mergeExpIntoExpsCache==='function')mergeExpIntoExpsCache(data);
  if(!interna&&!anon&&typeof upsertPersonaCatalog==='function')upsertPersonaCatalog(data);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(data,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(typeof logAudit==='function')logAudit('Alta PQRSD por responsable ['+expId+']','pqrsd',expId);
  return data;
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
  const nuevo=typeof isEntregaRespModoNuevo==='function'?isEntregaRespModoNuevo():!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const libre=!!((document.getElementById('entrega-resp-modo-libre')||{}).checked);
  const pqrsNuevo=typeof isEntregaRespModoPqrsNuevo==='function'?isEntregaRespModoPqrsNuevo():false;
  const actividad=String((document.getElementById('entrega-resp-actividad')||{}).value||'').trim();
  const detalle='';
  if(!actividad){notif('Indique la actividad predeterminada','err');return null;}
  if(!actividadPredEntregaExiste(actividad)){
    notif(msgActividadPredNoExiste(),'err');
    return null;
  }
  const actFinalCheck=actividad;
  if(!responsableActivo){notif('Seleccione su nombre como responsable','err');return null;}

  // Sin expediente: actividad libre autoasignada al responsable
  if(libre){
    const interesadoDatos=collectEntregaLibreInteresado();
    const errInt=validateEntregaLibreInteresado(interesadoDatos);
    if(errInt){notif(errInt,'err');return null;}
    const deptoLibre=typeof resolveDeptoActLibre==='function'
      ?resolveDeptoActLibre()
      :(typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare'));
    const deptoOk=(deptoLibre&&deptoLibre!=='responsables')?deptoLibre:'guaviare';
    const cod=typeof genCodigoActLibre==='function'?genCodigoActLibre(deptoOk):('ACT-'+Date.now());
    if(!validateEntregaRespOficioRequerido(actFinalCheck,cod))return null;
    let t=buildTaskEntregaResponsable(actFinalCheck,detalle,responsableActivo);
    t=typeof normalizeActLibre==='function'?normalizeActLibre(Object.assign(t,{
      depto:deptoOk,
      codigo:cod,
      sinExpediente:true,
      autoAsignadaPorResponsable:true,
      origen:'responsable'
    })):Object.assign(t,{depto:deptoOk,codigo:cod,sinExpediente:true});
    applyEntregaLibreInteresadoToTask(t,interesadoDatos);
    applyEntregaRespOficioToTask(t,actFinalCheck);
    if(typeof upsertPersonaEntregaLibre==='function')upsertPersonaEntregaLibre(interesadoDatos,cod,deptoOk);
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
  if(nuevo&&pqrsNuevo){
    const pqrsDatos=collectEntregaRespPqrsAlta();
    const errPqrs=validateEntregaRespPqrsAlta(pqrsDatos);
    if(errPqrs){notif(errPqrs,'err');return null;}
    const existing=typeof getExpById==='function'?getExpById(pqrsDatos.expId):null;
    if(existing){
      e=existing;
      if(!e._alta_por_responsable){
        e._alta_por_responsable=true;
        e._pendiente_revision_alta=true;
        e._alta_por=responsableActivo||'';
        e._alta_fecha=typeof hoy==='function'?hoy():'';
      }
      notif('La PQRSD ya existía — se vinculará la entrega','warn');
    }else{
      e=crearStubPqrsEntregaResp(pqrsDatos);
      if(!e)return null;
      createdStub=true;
    }
  }else if(nuevo){
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
    if(!e){notif('No encontrado. Digite el N° y elija crear expediente o PQRSD en la lista, o use «Actividad sin expediente».','err');return null;}
  }

  const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  let actFinal=actFinalCheck;
  if(esPqrs){
    const act=String(actFinal||'').trim();
    if(!act.startsWith('Atender PQRSD')&&!/^Oficio de respuesta\b/i.test(act))
      actFinal='Atender PQRSD'+(act?' — '+act:'');
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
  if(!validateEntregaRespOficioRequerido(actFinalCheck,e._exp))return null;
  applyEntregaRespOficioToTask(t,actFinalCheck);
  let regPayload=null;
  if(!esPqrs){
    if(esActividadOficioRequerimiento(actFinalCheck)){
      regPayload=collectEntregaOficioRequerimientoPayload();
    }else{
      regPayload=collectEntregaRespRegistroPayload(actFinalCheck);
    }
  }
  if(regPayload===false)return null;
  if(regPayload){
    if(regPayload.tipo==='oficio_requerimiento'){
      if(!applyEntregaOficioRequerimiento(e,t,regPayload.item))return null;
    }else if(!validateAndAppendEntregaRegistro(e,regPayload))return null;
    if(regPayload.tipo==='acto'&&regPayload.item&&regPayload.item.actoAdminId){
      t.actoAdminId=regPayload.item.actoAdminId;
      t.esActoAdmin=true;
    }
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
  const adj=typeof collectEnviarAdjuntos==='function'?collectEnviarAdjuntos():{links:[],files:[],anexos:[],preUploaded:[]};
  const cmt=String((document.getElementById('enviar-cmt-opcional')||{}).value||'').trim();
  const hasAdj=(adj.links&&adj.links.length)||(adj.files&&adj.files.length)||(adj.anexos&&adj.anexos.length)||(adj.preUploaded&&adj.preUploaded.length);
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
window.entregaRespEsFlujoPqrs=entregaRespEsFlujoPqrs;
window.syncEntregaRespPqrsUi=syncEntregaRespPqrsUi;
window.updateActRespActionsUi=updateActRespActionsUi;
window.syncEntregaRespRegistroUi=syncEntregaRespRegistroUi;
window.syncEntregaRespNotifCorreoUi=syncEntregaRespNotifCorreoUi;
window.syncEntregaRespConceptoCumpleUi=syncEntregaRespConceptoCumpleUi;
window.htmlEntregaRegConceptoBlock=htmlEntregaRegConceptoBlock;
window.htmlEntregaRegActoBlock=htmlEntregaRegActoBlock;
window.htmlEntregaOficioRequerimientoBlock=htmlEntregaOficioRequerimientoBlock;
window.syncEntregaOfiReqMedioUi=syncEntregaOfiReqMedioUi;
window.esActividadOficioRequerimiento=esActividadOficioRequerimiento;
window.applyConceptoReqDesdeNotificacion=applyConceptoReqDesdeNotificacion;
window.ensureOficioRequerimientoTask=ensureOficioRequerimientoTask;
window.htmlTramiteNotifActoVencBlock=htmlTramiteNotifActoVencBlock;
window.syncTramiteNotifActoVencUi=syncTramiteNotifActoVencUi;
window.collectTramiteNotifActoVencimiento=collectTramiteNotifActoVencimiento;
window.applyActoVencimientoDesdeNotificacion=applyActoVencimientoDesdeNotificacion;
window.coordSyncEntregaReview=coordSyncEntregaReview;
window.trySaveEntregaRegistroFromPanel=trySaveEntregaRegistroFromPanel;
window.resolveActividadRegistroTipo=resolveActividadRegistroTipo;
window.filtrarActEntregaRespSug=filtrarActEntregaRespSug;
window.pickActEntregaResp=pickActEntregaResp;
window.filtrarPersonasSugLibre=filtrarPersonasSugLibre;
window.pickPersonaEntregaLibre=pickPersonaEntregaLibre;
window.hidePersonasSugLibre=hidePersonasSugLibre;
window.setEntregaLibrePersonaRef=setEntregaLibrePersonaRef;
window.onEntregaLibreNombreInput=onEntregaLibreNombreInput;
window.onEntregaLibreNombreBlur=onEntregaLibreNombreBlur;
window.syncEntregaRespFileLabel=syncEntregaRespFileLabel;
window.entregaRespFileCtxKey=entregaRespFileCtxKey;
window.entregaRespFileUploadCtx=entregaRespFileUploadCtx;
window.resolveEntregaUploadContext=resolveEntregaUploadContext;
window.entregaRespOnMainFileChange=entregaRespOnMainFileChange;
window.entregaRespOnAnexosFileChange=entregaRespOnAnexosFileChange;
window.entregaRespRetryFileUpload=entregaRespRetryFileUpload;
window.syncEntregaRespInteresadoUi=syncEntregaRespInteresadoUi;
window.syncEntregaRespAltaFormPorTramite=syncEntregaRespAltaFormPorTramite;
window.syncEntregaRespLibreUi=syncEntregaRespLibreUi;
window.syncEntregaLibreInteresadoUi=syncEntregaLibreInteresadoUi;
window.setEntregaLibreIntTipo=setEntregaLibreIntTipo;
window.entregaLibreIntTipo=entregaLibreIntTipo;
window.syncEntregaRespOficioUi=syncEntregaRespOficioUi;
window.resolveActividadRequiereOficio=resolveActividadRequiereOficio;
window.entregaRespOnOficioBlur=entregaRespOnOficioBlur;
window.entregaRespClearOficioError=entregaRespClearOficioError;
window.syncEntregaRespInfractorCard=syncEntregaRespInfractorCard;
window.entregaRespAddInfractor=entregaRespAddInfractor;
window.entregaRespQuitarInfractor=entregaRespQuitarInfractor;
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
  if(e._tipo_persona==='juridica'&&e._pj_nit)bits.push('NIT '+escAttr(typeof formatNitDisplay==='function'?formatNitDisplay(e._pj_nit):e._pj_nit));
  else if(e._pn_identificacion)bits.push('ID '+escAttr(typeof formatIdentDisplay==='function'?formatIdentDisplay(e._pn_identificacion):e._pn_identificacion));
  if(e._pn_correo||e._pj_correo)bits.push(escAttr(e._pn_correo||e._pj_correo));
  try{
    const concepts=typeof conceptosSegData==='function'?conceptosSegData(e._conceptos_seg):[];
    if(concepts.length){
      const c=concepts[concepts.length-1];
      bits.push('<strong>Concepto:</strong> '+(c.concepto?escAttr(c.concepto):'—')+(c.cumple==='no'?' · No cumple':c.cumple==='na'?' · No aplica':''));
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
  const esPqrs=typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e);
  let btns='';
  if(can&&opts.expId){
    const tid=opts.taskId?String(opts.taskId):'';
    const editLbl=esPqrs?'✏️ Revisar / editar datos PQRSD':'✏️ Revisar / editar datos de Registro';
    btns='<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px">'+
      '<button type="button" class="btn bsm bp" onclick="abrirCorregirAltaDesdeRevision(\''+escAttr(opts.expId)+'\''+(tid?',\''+escAttr(tid)+'\'':'')+')">'+editLbl+'</button>'+
      '<button type="button" class="btn bsm" onclick="marcarAltaExpedienteRevisada(\''+escAttr(opts.expId)+'\')">✓ Marcar alta revisada</button>'+
      (esPqrs?'<button type="button" class="btn bsm bd2" onclick="eliminarPqrs(\''+escAttr(opts.expId)+'\')">🗑 Eliminar PQRSD</button>':'')+
      '</div>';
  }
  const tit=esPqrs
    ?'<strong>⏳ Alta PQRSD por responsable — revise datos y el documento</strong><br>'+
      'Creada por <strong>'+por+'</strong>'+(fecha?' el '+fecha:'')+'. Verifique solicitante, asunto, oficina y el soporte; puede editar o eliminar la PQRSD, y luego aprobar el documento.'
    :'<strong>⏳ Alta por responsable — revise datos de Registro y el documento</strong><br>'+
      'Creado por <strong>'+por+'</strong>'+(fecha?' el '+fecha:'')+'. Verifique interesado, concepto/factura/acto y el soporte; puede editar los campos en Registro y luego aprobar el documento.';
  return '<div class="alta-resp-banner" style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:#fff7ed;border:1px solid #fdba74;font-size:12px;color:#9a3412;line-height:1.45">'+
    tit+
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
  const e=typeof getExpById==='function'?getExpById(expId):null;
  if(e&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)&&typeof openEditPqrsSecretariaModal==='function'){
    if(typeof closeTaskModal==='function')closeTaskModal();
    openEditPqrsSecretariaModal(expId);
    notif('Corrija los datos de la PQRSD y guarde. Al guardar como encargado se marcará la alta como revisada.','ok');
    return;
  }
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
    '<div style="font-size:12px;font-weight:600;color:var(--bl);margin-bottom:6px">🖇️ Asociar a expediente / PQRSD</div>'+
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
        '<div id="act-libre-vinc-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div>'+
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
      '<button type="button" class="btn bsm bp" onclick="submitVincularActLibre(\''+tid+'\')">🖇️ Vincular actividad</button>'+
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
    if(act&&!act.startsWith('Atender PQRSD')&&!/^Oficio de respuesta\b/i.test(act))
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
