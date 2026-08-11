// =============================================================================
// constants.js — Constantes inmutables del sistema SST
// Cargar ANTES del script principal de la aplicación.
// =============================================================================

// Tipos de campos de formulario (r: render html, g: get value)
// Las arrow functions referencian gv y coordHtml que se definen en el script
// principal; como se invocan después de que todo carga, no hay dependencia rota.
const TIPOS={
  texto:{label:'Texto',r:(id,ph,v)=>'<input type="text" id="'+id+'" placeholder="'+(ph||'')+'" value="'+(v||'')+'">',g:(id)=>gv(id)},
  numero:{label:'Número',r:(id,ph,v)=>'<input type="number" id="'+id+'" placeholder="'+(ph||'0')+'" value="'+(v||'')+'" step="any">',g:(id)=>gv(id)},
  fecha:{label:'Fecha',r:(id,ph,v)=>'<input type="date" id="'+id+'" value="'+(v||'')+'">',g:(id)=>gv(id)},
  email:{label:'Correo',r:(id,ph,v)=>'<input type="email" id="'+id+'" placeholder="'+(ph||'correo@ejemplo.com')+'" value="'+(v||'')+'">',g:(id)=>gv(id)},
  tel:{label:'Teléfono',r:(id,ph,v)=>'<input type="tel" id="'+id+'" placeholder="'+(ph||'300 000 0000')+'" value="'+(v||'')+'">',g:(id)=>gv(id)},
  area:{label:'Texto largo',r:(id,ph,v)=>'<textarea id="'+id+'" placeholder="'+(ph||'')+'" style="min-height:60px">'+(v||'')+'</textarea>',g:(id)=>gv(id)},
  sino:{label:'Sí/No',r:(id,ph,v)=>'<select id="'+id+'"><option value="">-- Seleccionar --</option><option'+(v==='Sí'?' selected':'')+'>Sí</option><option'+(v==='No'?' selected':'')+'>No</option></select>',g:(id)=>gv(id)},
  lista:{label:'Lista (cfg)',r:(id,ph,v,opc)=>{const a=opc||[];return'<select id="'+id+'"><option value="">-- '+(ph||'Seleccionar')+' --</option>'+a.map(o=>'<option'+(v===o?' selected':'')+'>'+o+'</option>').join('')+'</select>';},g:(id)=>gv(id)},
  seleccion:{label:'Opciones',r:(id,ph,v,opc)=>{const a=(opc||'').split(',').map(s=>s.trim()).filter(s=>s);return'<select id="'+id+'"><option value="">-- '+(ph||'Sel.')+' --</option>'+a.map(o=>'<option'+(v===o?' selected':'')+'>'+o+'</option>').join('')+'</select>';},g:(id)=>gv(id)},
  checkbox:{label:'Casilla',r:(id,ph,v)=>'<label style="display:flex;align-items:center;gap:6px;margin-top:5px;cursor:pointer;font-size:13px"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+' style="width:15px;height:15px;accent-color:var(--bl)"> '+(ph||'')+'</label>',g:(id)=>{const e=document.getElementById(id);return e?e.checked:false;}},
  coordenadas:{label:'Coordenadas',r:(id,ph,v)=>coordHtml(id,v),g:(id)=>gv(id)},
};
const TIPO_KEYS=Object.keys(TIPOS);
const LISTA_FUENTES=['gravedades','cargos','instructores'];
const PAL=['#185FA5','#1a7a4a','#b87d0a','#a32d2d','#6d3fa8','#2196A8','#D85A30','#639922','#D4537E','#888780'];
const FINALS=['Sancionado','Archivado','Archivado o anulado','Ejecutoriado','Firmeza','Archivado'];
const ESTADOS=['Solicitud','En trámite','Atendido','Seguimiento','Archivado o anulado'];
const EST_CL={'Solicitud':'b-sol','En trámite':'b-tram','Atendido':'b-ate','Seguimiento':'b-seg','Archivado':'b-arch','Archivado o anulado':'b-arch'};
const UNIDAD_LABEL={dias:'días',habiles:'días hábiles',meses:'meses',anos:'años'};
const MUN_DEP={
  'Guaviare':['San José del Guaviare','Calamar','El Retorno','Miraflores'],
  'Guainía':['Inírida','Barrancominas','San Felipe','Puerto Colombia','La Guadalupe','Cacahual','Pana Pana','Morichal'],
  'Vaupés':['Mitú','Carurú','Taraira','Pacoa','Papunaua','Yavaraté']
};
const DEPTOS=[
  {id:'guaviare',nombre:'NCA DEGUV',munKey:'Guaviare'},
  {id:'guainia',nombre:'Guainía',munKey:'Guainía'},
  {id:'vaupes',nombre:'Vaupés',munKey:'Vaupés'}
];
const OFICINAS_DEGUV=[
  {id:'guaviare',nombre:'NCA DEGUV',codigo:'NCA',sinApoyo:false},
  {id:'oap_deguv',nombre:'OAP DEGUV',codigo:'OAP',sinApoyo:false},
  {id:'rn_deguv',nombre:'RN DEGUV',codigo:'RN',sinApoyo:false},
  {id:'admin_deguv',nombre:'ADMIN DEGUV',codigo:'ADMIN',sinApoyo:true},
  {id:'ds_deguv',nombre:'DS DEGUV',codigo:'DS',sinApoyo:true},
  {id:'secretaria',nombre:'Secretaría DEGUV',codigo:'SEC',sinApoyo:true}
];
const MODULOS_ESPECIALES=['secretaria','ciudadano','jurisdiccional','responsables'].concat(OFICINAS_DEGUV.map(o=>o.id));
const PQRS_EST_OFICINA={pendiente:'Pendiente',asignado:'Asignado',atendiendo:'En atención',cerrado:'Atendido'};
const DEPTO_CHART_COLORS={guaviare:'#185FA5',guainia:'#1a7a4a',vaupes:'#6d3fa8'};

// ================================================================
// DEFAULT CONFIG
// ================================================================
const DEF={
  gravedades:['Leve','Grave','Gravísima'],
  cargos:['Auxiliar administrativo','Profesional universitario','Técnico operativo','Secretaria','Conductor','Director','Subdirector','Asesor','Contratista'],
  instructores:[],
  actividadesPred:['Revisar documentación aportada','Solicitar información adicional','Programar visita técnica','Elaborar concepto técnico','Proyectar acto administrativo','Notificar decisión','Capacitación brigada forestal','Puesto de control','Visita de campo','Reunión de coordinación','Informe de gestión','Seguimiento operativo'],
  actividadesCortasPred:[],
  etapasPred:['Radicación','Revisión documental','Evaluación técnica','Visita de campo','Concepto técnico','Acto administrativo','Notificación','Archivo'],
  tiposFactura:['Evaluación','Publicación','Seguimiento','TCAF','Multa','Visita adicional','Tasa retributiva'],
  tiposActoAdmin:[
    {nombre:'Auto de inicio',tieneVencimiento:false},
    {nombre:'Auto de archivo',tieneVencimiento:false},
    {nombre:'Resolución que aprueba',tieneVencimiento:true,efecto:'aprueba',puedeTrasladoSan:true},
    {nombre:'Resolución que niega',tieneVencimiento:true},
    {nombre:'Resolución que revoca',tieneVencimiento:true},
    {nombre:'Resolución que impone medida preventiva',tieneVencimiento:true,efecto:'impone_mp',puedeTrasladoSan:true},
    {nombre:'Resolución que levanta medida preventiva',tieneVencimiento:false,efecto:'levanta_mp'},
    {nombre:'Resolución que suspende',tieneVencimiento:true,efecto:'suspende'},
    {nombre:'Resolución que levanta suspensión',tieneVencimiento:false,efecto:'levanta_susp'}
  ],
  infoTecnica:[],
  tiposSancionatorio:['Deforestación','Foco deforestación','Quema','Extracción ilegal de flora','Contaminación','Otro'],
  tramites:[
    {id:'t_pqrs',nombre:'PQRSD',desc:'Petición, queja, reclamo, denuncia y sugerencia',color:'#6d3fa8',
     plazo:15,alerta:80,unidad:'dias',
     etapas:[],
     etapasSeg:['Seguimiento de respuesta','Verificación de cumplimiento','Cierre'],
     campos:[
       {id:'f1',label:'Asunto / tema',tipo:'texto',seccion:'Detalle PQRS',requerido:false,enTabla:true},
       {id:'f2',label:'Medio de recepción',tipo:'seleccion',seccion:'Detalle PQRS',requerido:false,enTabla:false,opciones:'Ventanilla,Correo,Teléfono,Web'},
     ]},
    {id:'t_sanc',nombre:'Sancionatorio',desc:'Proceso sancionatorio ambiental (quejoso, infractor, apoderado y autorizado)',color:'#a32d2d',
     plazo:60,alerta:80,unidad:'dias',
     etapas:[],
     etapasSeg:['Seguimiento de cumplimiento','Verificación','Cierre'],
     campos:[]},
    {id:'t1',nombre:'Proceso sancionatorio',desc:'',color:'#185FA5',
     plazo:1825,alerta:80,unidad:'dias',
     etapas:['Indagación preliminar','Investigación disciplinaria','Pliego de cargos','Descargos','Alegatos de conclusión','Decisión de fondo','Sancionado','Archivado'],
     etapasSeg:['Notificación de sanción','Cumplimiento de sanción','Verificación de cumplimiento','Cierre del seguimiento'],
     campos:[
       {id:'f1',label:'Nombre del investigado',tipo:'texto',seccion:'Datos del investigado',requerido:true,enTabla:true,placeholder:'Nombre completo'},
       {id:'f2',label:'Tipo de identificación',tipo:'seleccion',seccion:'Datos del investigado',requerido:false,enTabla:false,opciones:'Cédula de ciudadanía,Cédula de extranjería,Pasaporte,Otro'},
       {id:'f3',label:'N° Identificación',tipo:'texto',seccion:'Datos del investigado',requerido:false,enTabla:true,placeholder:'123456789'},
       {id:'f4',label:'Cargo / Dependencia',tipo:'lista',seccion:'Datos del investigado',requerido:false,enTabla:false,listaFuente:'cargos'},
       {id:'f5',label:'Correo electrónico',tipo:'email',seccion:'Datos del investigado',requerido:false,enTabla:false},
       {id:'f6',label:'Teléfono',tipo:'tel',seccion:'Datos del investigado',requerido:false,enTabla:false},
       {id:'f7',label:'Conducta / Falta',tipo:'texto',seccion:'Información del proceso',requerido:false,enTabla:true,placeholder:'Descripción de la falta'},
       {id:'f8',label:'Gravedad',tipo:'lista',seccion:'Información del proceso',requerido:false,enTabla:true,listaFuente:'gravedades'},
       {id:'f9',label:'Descripción de hechos',tipo:'area',seccion:'Información del proceso',requerido:false,enTabla:false},
     ]},
    {id:'t2',nombre:'Permiso de vertimiento',desc:'',color:'#2196A8',
     plazo:60,alerta:80,unidad:'dias',
     etapas:['Radicación','Evaluación técnica','Visita de campo','Concepto técnico','Resolución de permiso','Notificación','Ejecutoriado'],
     etapasSeg:['Verificación condiciones','Reporte de monitoreo','Renovación o archivo'],
     campos:[
       {id:'f1',label:'Razón social / Nombre',tipo:'texto',seccion:'Datos del solicitante',requerido:true,enTabla:true},
       {id:'f2',label:'NIT / Identificación',tipo:'texto',seccion:'Datos del solicitante',requerido:false,enTabla:true},
       {id:'f3',label:'Correo',tipo:'email',seccion:'Datos del solicitante',requerido:false,enTabla:false},
       {id:'f4',label:'Teléfono',tipo:'tel',seccion:'Datos del solicitante',requerido:false,enTabla:false},
       {id:'f5',label:'Municipio',tipo:'texto',seccion:'Datos del solicitante',requerido:false,enTabla:false},
       {id:'f6',label:'Cuerpo hídrico receptor',tipo:'texto',seccion:'Información técnica',requerido:false,enTabla:false},
       {id:'f7',label:'Caudal de vertimiento (L/s)',tipo:'numero',seccion:'Información técnica',requerido:false,enTabla:true},
       {id:'f8',label:'Tipo de vertimiento',tipo:'seleccion',seccion:'Información técnica',requerido:false,enTabla:false,opciones:'Doméstico,Industrial,Agrícola,Minero'},
       {id:'f9',label:'Coordenadas',tipo:'texto',seccion:'Información técnica',requerido:false,enTabla:false},
       {id:'f10',label:'Vigencia del permiso (años)',tipo:'numero',seccion:'Información técnica',requerido:false,enTabla:true},
     ]},
    {id:'t3',nombre:'Concesión de aguas',desc:'',color:'#1a7a4a',
     plazo:90,alerta:80,unidad:'dias',
     etapas:['Radicación','Revisión documental','Evaluación técnica','Visita de campo','Resolución de concesión','Notificación','Firmeza'],
     etapasSeg:['Verificación de uso','Reporte de caudal','Renovación o archivo'],
     campos:[
       {id:'f1',label:'Razón social / Nombre',tipo:'texto',seccion:'Datos del solicitante',requerido:true,enTabla:true},
       {id:'f2',label:'NIT / Identificación',tipo:'texto',seccion:'Datos del solicitante',requerido:false,enTabla:true},
       {id:'f3',label:'Correo',tipo:'email',seccion:'Datos del solicitante',requerido:false,enTabla:false},
       {id:'f4',label:'Municipio',tipo:'texto',seccion:'Datos del solicitante',requerido:false,enTabla:false},
       {id:'f5',label:'Fuente hídrica',tipo:'texto',seccion:'Información técnica',requerido:false,enTabla:false},
       {id:'f6',label:'Caudal concesionado (L/s)',tipo:'numero',seccion:'Información técnica',requerido:false,enTabla:true},
       {id:'f7',label:'Uso del agua',tipo:'seleccion',seccion:'Información técnica',requerido:false,enTabla:false,opciones:'Doméstico,Agrícola,Industrial,Pecuario,Recreativo'},
       {id:'f8',label:'Duración de la concesión (años)',tipo:'numero',seccion:'Información técnica',requerido:false,enTabla:false},
     ]},
  ]
};

// Locks y auditoría
const CDA_LOCKS_KEY='cda_locks';
const CDA_LOCK_TTL_MS=5*60*1000;
const CDA_LOCK_RENEW_MS=2*60*1000;
const CDA_AUDIT_KEY='cda_audit_log';
const CDA_LOCK_UI_REFRESH_MS=15000;

// OAuth Client ID (también en firebase-init.js; aquí garantiza carga síncrona antes de gmail.js)
const GMAIL_OAUTH_CLIENT_ID='215089141263-gl6q8pkgkr7ul5epq75nbepjp60jseh0.apps.googleusercontent.com';
if(typeof window!=='undefined'&&!window._gmailClientId)window._gmailClientId=GMAIL_OAUTH_CLIENT_ID;

// Firebase / Firestore
const ADMIN_GMAIL='ncacdaguaviare@gmail.com';
const DEPTOS_FIRESTORE=['guaviare','guainia','vaupes'];

// Secciones editables del registro (responsables/contratistas)
const REG_EDIT_SECS={
  control:'Control del trámite',
  persona:'Datos del interesado',
  detalle:'Detalles / descripción',
  info_tec:'Información técnica',
  contable:'Información contable',
  normativa:'Normatividad / legal',
  seguimiento:'Seguimiento',
  actividades:'Actividades asignadas',
  campos:'Campos adicionales del trámite'
};

// Roles de instructores/responsables
const INST_ROLES={contratista:'Contratista',encargado_depto:'Encargado del departamento',encargado_oficina:'Encargado de oficina'};

// Trámite virtual PQRSD (no persiste en cfg, se usa como fallback)
const PQRS_TRAM_VIRTUAL={id:'t_pqrs',nombre:'PQRSD',color:'#6366f1',plazo:15,unidad:'dias',alerta:80,campos:[],etapas:[],etapasSeg:[]};

// Retención de mensajes de chat leídos
const RETENCION_LEIDOS_DIAS=30;
// Retención de adjuntos del chat en Drive institucional (días)
const CHAT_DRIVE_RETENTION_DIAS=30;
const CHAT_DRIVE_MAX_BYTES=25*1024*1024;
// Carpeta raíz chat interno (cdaguaviare1@gmail.com, retención 30 días)
const CHAT_DRIVE_FOLDER_ID='1xkB43Cay54_Qxu0EvJYcHiyHqJpF_bSU';
const CHAT_DRIVE_FOLDER_URL='https://drive.google.com/drive/folders/'+CHAT_DRIVE_FOLDER_ID;

// LocalStorage
const SST_LAST_EXPORT_KEY='sst_last_exportacion';
const SST_PRIMER_USO_KEY='sst_primer_uso';
const LS_CAPACITY_LIMIT_BYTES=5*1024*1024;
const LS_COMPRESS_PREFIX='LZ:';

// Tipos de acto administrativo por defecto
const TIPOS_ACTO_DEF=[
  {nombre:'Auto de inicio',tieneVencimiento:false},
  {nombre:'Auto de archivo',tieneVencimiento:false},
  {nombre:'Resolución que aprueba',tieneVencimiento:true,efecto:'aprueba',puedeTrasladoSan:true},
  {nombre:'Resolución que niega',tieneVencimiento:true},
  {nombre:'Resolución que revoca',tieneVencimiento:true},
  {nombre:'Resolución que impone medida preventiva',tieneVencimiento:true,efecto:'impone_mp',puedeTrasladoSan:true},
  {nombre:'Resolución que levanta medida preventiva',tieneVencimiento:false,efecto:'levanta_mp'},
  {nombre:'Resolución que suspende',tieneVencimiento:true,efecto:'suspende'},
  {nombre:'Resolución que levanta suspensión',tieneVencimiento:false,efecto:'levanta_susp'}
];

// URL pública de la app (consulta ciudadana en correos al solicitante)
const PUBLIC_APP_URL = 'https://asoredg-pixel.github.io/cda-expedientes-cda/';
// Identificador de build (visible en Radicación para confirmar despliegue)
const SST_BUILD_ID = '20260811f';

// Carpeta PQRSD institucional — matriz XLSX + Radicacion/año/mes/PQRSD-xxx (cdaguaviare1)
// https://drive.google.com/drive/folders/16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS
const DRIVE_ROOT_PQRSD_ID = '16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS';
const DRIVE_ROOT_PQRSD_URL = 'https://drive.google.com/drive/folders/' + DRIVE_ROOT_PQRSD_ID;

// Matriz oficial PQRSD — mismo directorio raíz que radicación
const PQRS_MATRIZ_SHEET_ID = '';
const PQRS_MATRIZ_LEGACY_EXCEL_IDS = ['1FaaTezSwWZmcDjlzEEu4FEgL5vLdaWau'];
const PQRS_MATRIZ_DATA_ROW = 16;
const PQRS_MATRIZ_DRIVE_FOLDER_ID = DRIVE_ROOT_PQRSD_ID;
const PQRS_MATRIZ_DRIVE_FOLDER_URL = DRIVE_ROOT_PQRSD_URL;
// Habilitar una sola vez en Google Cloud (proyecto Firebase cda-tramites)
const GOOGLE_CLOUD_PROJECT_NUMBER = '215089141263';
const GOOGLE_SHEETS_API_ENABLE_URL = 'https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=' + GOOGLE_CLOUD_PROJECT_NUMBER;

// ================================================================
// PQRS WORKFLOW — fases y tipos de respuesta
// ================================================================
// Fases del workflow de respuesta PQRSD:
const PQRS_WF = {
  // Encargado de oficina / NCA responde directo → cierre inmediato
  SIN_RESPUESTA:       'sin_respuesta',
  // Responsable entregó, esperando revisión NCA
  PENDIENTE_REVISION:  'pendiente_revision_nca',
  // NCA aprobó mensaje simple, listo para enviar
  LISTA_ENVIO:         'lista_para_envio',
  // NCA aprobó oficio → VITAL/encargado preparan para firma del Director
  PARA_FIRMA:          'para_firma',
  // Alias legacy (casos previos a para_firma); se trata igual que PARA_FIRMA
  VITAL_GESTION:       'pendiente_gestion_vital',
  // Director (DS DEGUV) debe firmar / cargar PDF firmado
  POR_FIRMAR:          'por_firmar',
  // PDF firmado listo; VITAL/responsable/encargado notifican
  PENDIENTE_NOTIF:     'pendiente_notificacion',
  // Notificación presencial/WhatsApp/aviso: 2ª revisión del encargado
  REVISION_FINAL:      'revision_final_nca',
  // PQRSD respondida y cerrada
  CERRADA:             'cerrada_atendida',
  // Devuelta al responsable por NCA
  RECHAZADA:           'rechazada'
};
const PQRS_WF_TIPO = { MENSAJE: 'mensaje', OFICIO: 'oficio_firmado', INFORMATIVA: 'informativa' };
const PQRS_WF_CANAL = {
  CORREO:     'correo',
  WHATSAPP:   'whatsapp',
  PRESENCIAL: 'presencial',
  FISICA:     'fisica',
  PAGINA:     'pagina',
  AVISO:      'aviso'
};
// Departamentos que usan Drive institucional (cdaguaviare1)
const DRIVE_INST_DEPTOS = new Set(['guaviare','secretaria','oap_deguv','rn_deguv','admin_deguv','ds_deguv']);

// Carpeta raíz Recursos / Biblioteca (Guaviare — cdaguaviare1@gmail.com):
// https://drive.google.com/drive/folders/18oV-qm2J4OX1lIoITcqhIs2WJ-iHFk29
const DRIVE_ROOT_RECURSOS_ID = '18oV-qm2J4OX1lIoITcqhIs2WJ-iHFk29';

// Claves que contienen JSON blobs (para sanitización XSS)
const XSS_JSON_BLOB_KEYS=new Set(['_fechas_estado','_actos_admin','_conceptos_seg','_detalle_notas','_facturas_extra','_info_tecnica_items','_expedientes_asociados','_pqrs_historial','_pqrs_respuesta_links','_pqrs_respuesta_soportes','_pqrs_workflow','_tasks','_presuntos_infractores']);

// Roles de personas en expedientes
const PERSONA_ROLES={interesado:'Interesado',peticionario:'Quejoso / peticionario',apoderado:'Apoderado',autorizado:'Autorizado',infractor:'Presunto infractor'};

// Paginación consulta
const CON_CONSULTA_PAGE=30;

// Paneles de configuración
const CFG_PANELS=[
  {key:'instructores',title:'Responsables',sub:''},
];

// Exportación
const SST_EXPORT_VERSION='8.0';
const SST_EXPORT_KEYS=['cfgByDepto','exps','personas','actividadesLibres','agendaEventos','chatMensajes','encargadosGlobal','bandejaLeidos','bandejaEliminados','deptoActivo','deptoCfg','responsableActivo'];

// Chat
const CHAT_LABEL_SUBDIRECCION='Subdirección';

// Roles de ingreso (pantalla de login)
const ROLES_INGRESO=[
  {id:'admin',titulo:'Administrador',desc:'Acceso total. Puede alternar entre roles desde el selector superior sin volver al inicio.',icon:'🔑',cls:'rol-admin'},
  {id:'guaviare',titulo:'NCA DEGUV',desc:'Registro, actividades, PQRSD, chat con oficinas DEGUV y configuración completa del NCA.',icon:'🏛️',cls:'rol-nca'},
  {id:'oap_deguv',titulo:'OAP DEGUV',desc:'PQRSD, consulta, traslados y gestión de solicitudes.',icon:'📌',cls:'rol-ofi'},
  {id:'rn_deguv',titulo:'RN DEGUV',desc:'Bandeja PQRSD y seguimiento de solicitudes trasladadas.',icon:'📌',cls:'rol-ofi'},
  {id:'admin_deguv',titulo:'ADMIN DEGUV',desc:'Bandeja PQRSD sin apoyo de actividades internas.',icon:'📌',cls:'rol-ofi'},
  {id:'ds_deguv',titulo:'DS DEGUV',desc:'Bandeja PQRSD y comunicación con otras oficinas.',icon:'📌',cls:'rol-ofi'},
  {id:'secretaria',titulo:'Secretaría DEGUV',desc:'Radicación y traslado de PQRSD a oficinas.',icon:'📥',cls:'rol-sec'},
  {id:'guainia',titulo:'Guainía',desc:'Departamento regional — registro, actividades y consulta.',icon:'🌿',cls:'rol-dep'},
  {id:'vaupes',titulo:'Vaupés',desc:'Departamento regional — registro, actividades y consulta.',icon:'🌿',cls:'rol-dep'},
  {id:'jurisdiccional',titulo:'Jurisdiccional',desc:'Consulta y consolidado de todos los departamentos.',icon:'⚖️',cls:'rol-juris'},
  {id:'responsables',titulo:'Responsables',desc:'Actividades asignadas, agenda y consulta.',icon:'👤',cls:'rol-resp'},
  {id:'contratista',titulo:'Contratista',desc:'Expedientes asignados como instructor o responsable.',icon:'👷',cls:'rol-resp'},
  {id:'ciudadano',titulo:'Consulta ciudadana',desc:'Consulta de trámites y PQRSD por número de expediente.',icon:'🔍',cls:'rol-ciu'}
];
