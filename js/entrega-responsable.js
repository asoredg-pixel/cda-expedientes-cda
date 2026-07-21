// =============================================================================
// entrega-responsable.js — Entrega / auto-asignación de actividad por responsable
// Grupo A: convive con la asignación del encargado. Si el responsable inicia,
// la actividad queda en el expediente (Registro/Consulta) y en Por verificar.
// =============================================================================

function puedeEntregarComoResponsable(){
  return !!(typeof esModoResponsable==='function'&&esModoResponsable()&&responsableActivo
    &&!(typeof esJurisdiccional==='function'&&esJurisdiccional()));
}

function buscarExpedientesEntregaResp(q,lim){
  const ql=String(q||'').trim().toLowerCase();
  if(ql.length<1)return[];
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const out=[];
  (exps||[]).forEach(function(e){
    if(!e||!e._exp)return;
    if(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite))return;
    if(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))return;
    const ed=String(e._depto||'').trim();
    if(ed&&depto&&ed!==depto&&ed!=='guaviare')return;
    const num=String(e._exp||'').trim();
    const nom=(typeof getNom==='function'?getNom(e):'').toLowerCase();
    const tramObj=typeof getTram==='function'?getTram(e._tramite,e):null;
    const tram=(tramObj&&tramObj.nombre?tramObj.nombre:'').toLowerCase();
    if(!num.toLowerCase().includes(ql)&&!nom.includes(ql)&&!tram.includes(ql))return;
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
    return '<button type="button" class="entrega-resp-sug-btn" onmousedown="event.preventDefault();pickExpEntregaResp(\''+
      String(e._exp||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')">'+
      '<strong>'+escAttr(e._exp)+'</strong> · '+escAttr(tramNom)+' · '+escAttr(nom)+'</button>';
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
      hint.innerHTML='Seleccionado: <strong>'+escAttr(e._exp)+'</strong> · '+
        escAttr(tram?tram.nombre:'Trámite')+' · '+escAttr(typeof getNom==='function'?getNom(e):'')+
        ' · '+escAttr(e._estado||'');
    }else hint.textContent='Expediente no encontrado en la app — puede crearlo como alta nueva abajo.';
  }
}

function syncEntregaRespModoUi(){
  const nuevo=!!((document.getElementById('entrega-resp-modo-nuevo')||{}).checked);
  const boxNuevo=document.getElementById('entrega-resp-alta-box');
  const boxExist=document.getElementById('entrega-resp-exist-box');
  if(boxNuevo)boxNuevo.style.display=nuevo?'':'none';
  if(boxExist)boxExist.style.display=nuevo?'none':'';
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
  if(modal){modal.classList.remove('task-modal-wide');modal.classList.add('enviar-modal-only');}
  body.innerHTML=
    '<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+
      'Si el expediente ya existe, búsquelo. Si es la primera entrega, créelo aquí (queda en <strong>En trámite</strong>). '+
      'La actividad se autoasigna a usted, queda en <strong>Por verificar / Por revisar</strong> del departamento y se registra en <strong>Actividades asignadas</strong> (Registro y Consulta). '+
      'La asignación por el encargado sigue disponible como siempre.'+
    '</div>'+
    '<div class="fx" style="gap:14px;flex-wrap:wrap;margin-bottom:10px">'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-existente" checked onchange="syncEntregaRespModoUi()"> Expediente existente</label>'+
      '<label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="entrega-resp-modo" id="entrega-resp-modo-nuevo" onchange="syncEntregaRespModoUi()"> Crear expediente (1ª entrega)</label>'+
    '</div>'+
    '<div id="entrega-resp-exist-box">'+
      '<div class="fld" style="margin-bottom:8px"><label>Buscar expediente</label>'+
        '<div style="position:relative">'+
          '<input type="text" id="entrega-resp-exp" placeholder="N° expediente o interesado…" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)" '+
            'oninput="filtrarExpEntregaRespSug(this)" onfocus="filtrarExpEntregaRespSug(this)" onblur="setTimeout(function(){var p=document.getElementById(\'entrega-resp-exp-sug\');if(p)p.style.display=\'none\';},180)">'+
          '<div id="entrega-resp-exp-sug" class="entrega-resp-sug" style="display:none"></div>'+
        '</div>'+
        '<div id="entrega-resp-exp-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div>'+
      '</div>'+
    '</div>'+
    '<div id="entrega-resp-alta-box" style="display:none">'+
      '<div class="fld" style="margin-bottom:8px"><label>N° expediente <span style="color:var(--rd)">*</span></label>'+
        '<input type="text" id="entrega-resp-exp-nuevo" placeholder="Número del expediente (p. ej. el de VITAL)" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld" style="margin-bottom:8px"><label>Tipo de trámite <span style="color:var(--rd)">*</span></label>'+
        '<select id="entrega-resp-tramite" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)">'+tramitesEntregaRespOptsHtml()+'</select></div>'+
      '<div class="fld" style="margin-bottom:8px"><label>Interesado / nombre (opcional)</label>'+
        '<input type="text" id="entrega-resp-interesado" placeholder="Nombre del interesado" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '</div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Actividad predeterminada <span style="color:var(--rd)">*</span></label>'+
      '<div class="act-wrap"><input type="text" id="entrega-resp-actividad" data-sug-src="exp" placeholder="Buscar actividad…" '+
        'oninput="filtrarActsPred(this);syncEntregaRespRegistroUi()" onfocus="filtrarActsPred(this)" onblur="setTimeout(function(){hideActsPred(document.getElementById(\'entrega-resp-actividad\'));syncEntregaRespRegistroUi();},160)" '+
        'style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div id="entrega-resp-reg-hint" style="font-size:11px;color:var(--tx3);margin-top:4px"></div></div>'+
    '<div id="entrega-resp-registro-box" style="display:none;margin-bottom:10px;padding:10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--sf2)"></div>'+
    '<div class="fld" style="margin-bottom:8px"><label>Detalle (opcional)</label>'+
      '<input type="text" id="entrega-resp-detalle" placeholder="Detalles de la actividad" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
    '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600;color:var(--tx3)">Documento principal</label>'+
      '<input type="file" id="enviar-adj-file" accept=".pdf,.doc,.docx,image/*,video/*" style="font-size:12px;width:100%;margin-top:4px">'+
      '<div style="font-size:10px;color:var(--tx3);margin-top:2px">En Guaviare se sube al Drive institucional del expediente.</div></div>'+
    '<div style="margin-bottom:8px"><label style="font-size:11px;font-weight:600;color:var(--tx3)">Anexos (opcionales)</label>'+
      '<input type="file" id="enviar-anexos-file" multiple accept=".pdf,.doc,.docx,image/*,video/*" style="font-size:12px;width:100%;margin-top:4px"></div>'+
    '<div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:4px">Enlaces Google Drive (opcionales)</div>'+
    '<div id="enviar-adjuntos-rows"></div>'+
    '<div class="fx" style="gap:6px;margin-bottom:8px"><button type="button" class="btn bsm" onclick="addEnviarAdjuntoRow()">+ Link Drive</button></div>'+
    '<input type="hidden" id="enviar-requiere-link" value="0">'+
    '<input type="hidden" id="enviar-modo-nueva" value="0">'+
    '<input type="hidden" id="enviar-modo-traslado" value="0">'+
    '<textarea id="enviar-cmt-opcional" placeholder="Comentario sobre esta entrega (obligatorio si no adjunta archivo ni link)…" '+
      'style="min-height:72px;padding:6px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;margin-bottom:8px;width:100%"></textarea>'+
    '<div class="fx" style="gap:8px">'+
      '<button type="button" class="btn bsm bp" onclick="submitEntregaResponsable()">📤 Entregar a revisión</button>'+
      '<button type="button" class="btn bsm" onclick="closeTaskModal()">Cancelar</button>'+
    '</div>';
  ov.classList.add('on');
  window._taskModalCtx={mode:'entregaResponsable'};
  syncEntregaRespModoUi();
  syncEntregaRespRegistroUi();
  setTimeout(function(){
    const a=document.getElementById('entrega-resp-actividad');
    if(a)a.focus();
  },80);
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
  const tipo=resolveActividadRegistroTipo(act);
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():deptoActivo;
  const cfgAct=typeof cfgFor==='function'?cfgFor(depto):{};
  if(hint){
    if(!act)hint.textContent='';
    else if(tipo==='concepto')hint.textContent='Se diligenciará un concepto en Seguimiento / Registro.';
    else if(tipo==='factura')hint.textContent='Se diligenciará una factura en Información contable.';
    else if(tipo==='acto')hint.textContent='Se diligenciará un acto administrativo en Normatividad.';
    else if(tipo==='ninguno')hint.textContent='Solo actividad (sin datos de Registro asociados).';
    else hint.textContent='Sin mapeo a Registro — puede configurar el tipo en Configuración → Actividades predeterminadas.';
  }
  if(!box)return;
  if(!tipo||tipo==='ninguno'){box.style.display='none';box.innerHTML='';return;}
  box.style.display='';
  const hoyStr=typeof hoy==='function'?hoy():'';
  if(tipo==='concepto'){
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos de concepto (Registro)</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>N° concepto técnico</label><input type="text" id="entrega-reg-concepto" placeholder="N° concepto" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Fecha</label><input type="date" id="entrega-reg-concepto-fecha" value="'+hoyStr+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>¿Cumple?</label><select id="entrega-reg-concepto-cumple" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"><option value="si">Cumple</option><option value="no">No cumple</option></select></div>'+
      '<div class="fld" style="grid-column:1/-1"><label>Observaciones</label><textarea id="entrega-reg-concepto-obs" style="min-height:50px;width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></textarea></div>'+
      '</div>';
  }else if(tipo==='factura'){
    const tipos=(cfgAct.tiposFactura||[]).map(function(t){return '<option value="'+escAttr(t)+'">'+escAttr(t)+'</option>';}).join('');
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos de factura (Registro)</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>Tipo</label><select id="entrega-reg-fac-tipo" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"><option value="">— Seleccione —</option>'+tipos+'</select></div>'+
      '<div class="fld"><label>Valor</label><input type="number" id="entrega-reg-fac-valor" step="any" min="0" placeholder="0" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Referencia</label><input type="text" id="entrega-reg-fac-ref" placeholder="N° / ref." style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Vencimiento</label><input type="date" id="entrega-reg-fac-venc" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '</div>';
  }else if(tipo==='acto'){
    const actos=(cfgAct.tiposActoAdmin||[]).map(function(t){
      const n=t.nombre||t;
      return '<option value="'+escAttr(n)+'">'+escAttr(n)+'</option>';
    }).join('');
    box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--bl)">Datos de acto / resolución (Registro)</div>'+
      '<div class="fg">'+
      '<div class="fld"><label>Tipo de acto</label><select id="entrega-reg-acto-tipo" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"><option value="">— Seleccione —</option>'+actos+'</select></div>'+
      '<div class="fld"><label>N° acto</label><input type="text" id="entrega-reg-acto-num" placeholder="Número" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Fecha</label><input type="date" id="entrega-reg-acto-fecha" value="'+hoyStr+'" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '<div class="fld"><label>Vencimiento (si aplica)</label><input type="date" id="entrega-reg-acto-venc" style="width:100%;padding:7px;border:1px solid var(--bd);border-radius:var(--r)"></div>'+
      '</div>';
  }
}
function collectEntregaRespRegistroPayload(actividad){
  const tipo=resolveActividadRegistroTipo(actividad);
  if(!tipo||tipo==='ninguno')return null;
  if(tipo==='concepto'){
    return{tipo:'concepto',item:{
      fecha:String((document.getElementById('entrega-reg-concepto-fecha')||{}).value||(typeof hoy==='function'?hoy():'')),
      concepto:String((document.getElementById('entrega-reg-concepto')||{}).value||'').trim(),
      observaciones:String((document.getElementById('entrega-reg-concepto-obs')||{}).value||'').trim(),
      cumple:String((document.getElementById('entrega-reg-concepto-cumple')||{}).value||'si'),
      reqNum:'',reqNotif:'',reqDias:'',reqVence:'',reqCumplido:false,reqFechaCump:'',trasladoSan:false,expSan:''
    }};
  }
  if(tipo==='factura'){
    const valorRaw=String((document.getElementById('entrega-reg-fac-valor')||{}).value||'').trim();
    return{tipo:'factura',item:{
      tipo:String((document.getElementById('entrega-reg-fac-tipo')||{}).value||'').trim(),
      valor:valorRaw,
      ref:String((document.getElementById('entrega-reg-fac-ref')||{}).value||'').trim(),
      venc:String((document.getElementById('entrega-reg-fac-venc')||{}).value||''),
      pago:'',persVenc:'',coacFecha:'',acuerdoPago:false
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
    if(!item.concepto&&!item.observaciones)return false;
    arr.push(item);
    e._conceptos_seg=JSON.stringify(arr);
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
  const interesado=String(opts.interesado||'').trim();
  const depto=typeof getDeptoOperativo==='function'?getDeptoOperativo():(deptoActivo||'guaviare');
  const hoyStr=typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10);
  if(!expId){notif('Indique el número de expediente','err');return null;}
  if(!tid){notif('Seleccione el tipo de trámite','err');return null;}
  if(typeof esTramitePqrs==='function'&&esTramitePqrs(tid)){notif('PQRSD no se crea por esta vía','err');return null;}
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
    _pn_nombre:interesado,
    _pn_identificacion:'',
    _pn_correo:'',
    _pn_telefono:'',
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
  if(!responsableActivo){notif('Seleccione su nombre como responsable','err');return null;}

  let e=null;
  let createdStub=false;
  if(nuevo){
    const expNuevo=String((document.getElementById('entrega-resp-exp-nuevo')||{}).value||'').trim();
    const tid=String((document.getElementById('entrega-resp-tramite')||{}).value||'').trim();
    const interesado=String((document.getElementById('entrega-resp-interesado')||{}).value||'').trim();
    const existing=typeof getExpById==='function'?getExpById(expNuevo):null;
    if(existing){
      e=existing;
      notif('El expediente ya existía — se vinculará la entrega','warn');
    }else{
      e=crearStubExpedienteEntregaResp({expId:expNuevo,tramiteId:tid,interesado:interesado});
      if(!e)return null;
      createdStub=true;
    }
  }else{
    const expNum=String((document.getElementById('entrega-resp-exp')||{}).value||'').trim();
    if(!expNum){notif('Busque y seleccione el expediente','err');return null;}
    e=typeof getExpById==='function'?getExpById(expNum):null;
    if(!e){notif('Expediente no encontrado. Use «Crear expediente» si es la primera entrega.','err');return null;}
    if(typeof esTramitePqrs==='function'&&esTramitePqrs(e._tramite)){
      notif('Use el flujo PQRSD para ese radicado','err');
      return null;
    }
  }

  e.tasks=Array.isArray(e.tasks)?e.tasks:[];
  let t=findTaskEntregaRespDedupe(e,actividad,responsableActivo);
  let createdTask=false;
  if(!t){
    t=buildTaskEntregaResponsable(actividad,detalle,responsableActivo);
    e.tasks.push(t);
    createdTask=true;
  }else{
    if(detalle&&!t.detalle)t.detalle=detalle;
    t.autoAsignadaPorResponsable=!!(t.autoAsignadaPorResponsable||t.origen==='responsable');
    if(typeof ensureAsignado==='function')ensureAsignado(t,responsableActivo);
  }
  t.desc=(t.actividad||'')+(t.detalle?' - '+t.detalle:'');
  const regPayload=collectEntregaRespRegistroPayload(actividad);
  if(regPayload)appendRegistroDesdeEntrega(e,regPayload);
  if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(createdTask&&typeof isFormExpVisible==='function'&&isFormExpVisible(e._exp)&&typeof syncTkRowsFromExp==='function'){
    try{syncTkRowsFromExp(e._exp,t.id);}catch(err){}
  }
  return{e:e,t:t,expId:e._exp,taskId:t.id,createdStub:createdStub,createdTask:createdTask,registroTipo:regPayload?regPayload.tipo:''};
}

function submitEntregaResponsable(){
  if(!puedeEntregarComoResponsable()){notif('No puede entregar en esta sesión','err');return;}
  const adj=typeof collectEnviarAdjuntos==='function'?collectEnviarAdjuntos():{links:[],files:[],anexos:[]};
  const cmt=String((document.getElementById('enviar-cmt-opcional')||{}).value||'').trim();
  const hasAdj=(adj.links&&adj.links.length)||(adj.files&&adj.files.length)||(adj.anexos&&adj.anexos.length);
  if(!hasAdj&&!cmt){
    notif('Adjunte documento, anexo, link Drive y/o escriba un comentario','err');
    return;
  }
  const pack=ensureExpTaskEntregaResponsable();
  if(!pack)return;
  // Reutilizar el envío a verificación ya implementado (Drive + Por verificar)
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
  if(!bar)return;
  const show=puedeEntregarComoResponsable();
  bar.style.display=show?'flex':'none';
}

window.puedeEntregarComoResponsable=puedeEntregarComoResponsable;
window.openEntregaResponsableModal=openEntregaResponsableModal;
window.submitEntregaResponsable=submitEntregaResponsable;
window.filtrarExpEntregaRespSug=filtrarExpEntregaRespSug;
window.pickExpEntregaResp=pickExpEntregaResp;
window.syncEntregaRespModoUi=syncEntregaRespModoUi;
window.updateActRespActionsUi=updateActRespActionsUi;
window.syncEntregaRespRegistroUi=syncEntregaRespRegistroUi;
window.resolveActividadRegistroTipo=resolveActividadRegistroTipo;

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
  if(expPendienteRevisionAlta(e))
    return '<span class="bdg" style="background:#fff7ed;color:#c2410c;border:1px solid #fdba74;font-size:10px;margin-left:4px" title="Alta creada por responsable — pendiente de revisión del departamento">⏳ Alta por revisar</span>';
  return '<span class="bdg" style="background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;font-size:10px;margin-left:4px" title="Alta por responsable ya revisada'+(e._alta_revisada_por?' por '+e._alta_revisada_por:'')+'">✓ Alta revisada</span>';
}
function renderAltaResponsableBannerHtml(e,opts){
  opts=opts||{};
  if(!e||!e._alta_por_responsable)return'';
  const pend=expPendienteRevisionAlta(e);
  const por=escAttr(e._alta_por||'responsable');
  const fecha=escAttr(typeof fmtF==='function'?fmtF(e._alta_fecha||''):(e._alta_fecha||''));
  if(!pend){
    if(!opts.showDone)return'';
    return '<div class="alta-resp-banner alta-resp-banner-ok" style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:#ecfdf5;border:1px solid #6ee7b7;font-size:12px;color:#047857;line-height:1.45">'+
      '✓ Alta por responsable revisada'+(e._alta_revisada_por?' · '+escAttr(e._alta_revisada_por):'')+
      (e._alta_revisada_en?' · '+escAttr(typeof fmtF==='function'?fmtF(e._alta_revisada_en):e._alta_revisada_en):'')+
      '</div>';
  }
  const can=puedeRevisarAltaExpediente(e);
  let btns='';
  if(can&&opts.expId){
    const tid=opts.taskId?String(opts.taskId):'';
    btns='<div class="fx" style="gap:6px;flex-wrap:wrap;margin-top:8px">'+
      '<button type="button" class="btn bsm bp" onclick="abrirCorregirAltaDesdeRevision(\''+escAttr(opts.expId)+'\''+(tid?',\''+escAttr(tid)+'\'':'')+')">✏️ Corregir datos del expediente</button>'+
      '<button type="button" class="btn bsm" onclick="marcarAltaExpedienteRevisada(\''+escAttr(opts.expId)+'\')">✓ Marcar alta revisada</button>'+
      '</div>';
  }
  return '<div class="alta-resp-banner" style="padding:8px 10px;margin-bottom:10px;border-radius:var(--r);background:#fff7ed;border:1px solid #fdba74;font-size:12px;color:#9a3412;line-height:1.45">'+
    '<strong>⏳ Alta por responsable — pendiente de revisión</strong><br>'+
    'Creado por <strong>'+por+'</strong>'+(fecha?' el '+fecha:'')+'. El encargado puede corregir interesado, control u otras secciones si algo quedó mal.'+
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

window.expPendienteRevisionAlta=expPendienteRevisionAlta;
window.puedeRevisarAltaExpediente=puedeRevisarAltaExpediente;
window.expAltaResponsableBadgeHtml=expAltaResponsableBadgeHtml;
window.renderAltaResponsableBannerHtml=renderAltaResponsableBannerHtml;
window.marcarAltaExpedienteRevisada=marcarAltaExpedienteRevisada;
window.abrirCorregirAltaDesdeRevision=abrirCorregirAltaDesdeRevision;
window.maybeClearPendienteRevisionAltaOnSave=maybeClearPendienteRevisionAltaOnSave;
