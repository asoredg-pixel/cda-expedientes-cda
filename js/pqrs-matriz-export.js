// =============================================================================
// pqrs-matriz-export.js — Matriz oficial PQRSD (plantilla AGJ-CP-9-PR-02-FR-02)
// Requiere: SheetJS (XLSX global), funciones PQRSD en core.js
// =============================================================================
const PQRS_MATRIZ_TEMPLATE_URL='assets/templates/matriz-pqrs-deguv.xlsx';
const PQRS_MATRIZ_XLSX_LS_KEY='sst_pqrs_matriz_xlsx_file_id';
const PQRS_MATRIZ_SHEET_CONS='CONSOLIDADO PQRSD';
const PQRS_MATRIZ_SHEET_SEG='SEGUIMIENTO';
const PQRS_MATRIZ_DATA_ROW_0=15;
const PQRS_MATRIZ_TEMPLATE_DATA_ROWS=6;
const PQRS_MATRIZ_FOOTER_ROW_0=21;
const PQRS_MATRIZ_DATA_COLS=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];

function pqrsMatrizFmtFechaLarga(iso){
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const f=String(iso||hoy()).split('-');
  if(f.length!==3)return '';
  const d=Number(f[2]),m=Number(f[1]),y=f[0];
  if(!d||!m||!y)return '';
  return d+' de '+meses[m-1]+' de '+y;
}
function pqrsMatrizTrimestreRomano(iso){
  const m=Number(String(iso||hoy()).split('-')[1])||1;
  return ['I','II','III','IV'][Math.floor((m-1)/3)]||'I';
}
function pqrsMatrizTipoSeguimientoCol(tipo){
  const t=String(tipo||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(t==='queja')return 2;
  if(t==='reclamo')return 3;
  if(t==='peticion')return 6;
  if(t==='sugerencia')return 5;
  if(t==='denuncia')return 8;
  return 6;
}
function buildPqrsMatrizRecord(e,item){
  e=normalizePqrsOficinaFields(e);
  const wf=getPqrsWorkflow(e);
  const p=getPqrsPlazoInfo(e);
  const plazo=p.plazo||getPqrsPlazoDias(e);
  const vence=p.vence||'';
  const cerrada=pqrsEstaCerrada(e);
  const resp=cerrada?(wf.fecha_respuesta||e._pqrs_respuesta_fecha||''):'';
  const oficio=cerrada?(wf.oficio||e._pqrs_respuesta_oficio||''):'';
  const diasVencer=pqrsMatrizDiasParaVencer(e);
  const diasResp=pqrsMatrizDiasRespuesta(e);
  return{
    item,
    fechaRecibo:e._fecha_solicitud||e._fecha||'',
    radicadoRecibo:e._exp||'',
    departamento:pqrsMatrizDepartamento(e),
    tipo:e._tipo_solicitud||'',
    nombre:String(e._qd_nombre||e._pn_nombre||e._nombre||'').trim(),
    asunto:String(e.f_f1||e._pqrs_detalle||'').trim(),
    plazoDias:plazo,
    responsable:pqrsMatrizOficinaResponsable(e),
    fechaVence:vence,
    estado:getPqrsEstadoDisplay(e),
    diasParaVencer:diasVencer===''?'':Number(diasVencer),
    fechaContestacion:resp,
    radicadoContestacion:oficio,
    diasRespuesta:diasResp===''?'':Number(diasResp),
    estadoFinal:pqrsMatrizEstadoFinal(e),
    observaciones:pqrsMatrizObservaciones(e)
  };
}
function xlsxDeleteCell(ws,addr){
  if(ws[addr])delete ws[addr];
}
function xlsxSetCell(ws,r,c,v,t){
  const addr=XLSX.utils.encode_cell({r:r,c:c});
  if(v==null||v===''){xlsxDeleteCell(ws,addr);return;}
  if(t==='d'){
    const p=String(v).split('-');
    if(p.length!==3)return;
    const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),12,0,0);
    ws[addr]={t:'d',v:d,z:'dd/mm/yyyy'};
    return;
  }
  if(t==='n'){
    ws[addr]={t:'n',v:Number(v)};
    return;
  }
  ws[addr]={t:'s',v:String(v)};
}
function xlsxShiftSheetRowsDown(ws,fromRow0,delta){
  if(!delta||!ws)return;
  const moved={};
  Object.keys(ws).forEach(addr=>{
    if(addr[0]==='!')return;
    const cell=ws[addr];
    const pos=XLSX.utils.decode_cell(addr);
    if(pos.r>=fromRow0){
      moved[XLSX.utils.encode_cell({r:pos.r+delta,c:pos.c})]=cell;
      delete ws[addr];
    }
  });
  Object.assign(ws,moved);
  if(ws['!merges']){
    ws['!merges']=ws['!merges'].map(m=>{
      if(m.s.r>=fromRow0)return{s:{r:m.s.r+delta,c:m.s.c},e:{r:m.e.r+delta,c:m.e.c}};
      if(m.e.r>=fromRow0)return{s:m.s,e:{r:m.e.r+delta,c:m.e.c}};
      return m;
    });
  }
  if(ws['!ref']){
    const range=XLSX.utils.decode_range(ws['!ref']);
    if(range.e.r>=fromRow0)range.e.r+=delta;
    ws['!ref']=XLSX.utils.encode_range(range);
  }
}
function xlsxClearMatrizDataRows(ws,startRow0,count){
  for(let r=0;r<count;r++){
    PQRS_MATRIZ_DATA_COLS.forEach(c=>xlsxDeleteCell(ws,XLSX.utils.encode_cell({r:startRow0+r,c:c})));
  }
}
function pqrsMatrizFmtFechaCeldaXlsx(iso){
  if(!iso)return'';
  if(typeof fmtF==='function'){
    const f=fmtF(iso);
    return f&&f!=='-'?f:'';
  }
  return String(iso);
}
function xlsxWriteMatrizDataRow(ws,row0,rec){
  xlsxSetCell(ws,row0,2,rec.item,'n');
  xlsxSetCell(ws,row0,3,pqrsMatrizFmtFechaCeldaXlsx(rec.fechaRecibo),'s');
  xlsxSetCell(ws,row0,4,rec.radicadoRecibo,'s');
  xlsxSetCell(ws,row0,5,rec.departamento,'s');
  xlsxSetCell(ws,row0,6,rec.tipo,'s');
  xlsxSetCell(ws,row0,7,rec.nombre,'s');
  xlsxSetCell(ws,row0,8,rec.asunto,'s');
  xlsxSetCell(ws,row0,9,rec.plazoDias,'n');
  xlsxSetCell(ws,row0,10,rec.responsable,'s');
  xlsxSetCell(ws,row0,11,pqrsMatrizFmtFechaCeldaXlsx(rec.fechaVence),'s');
  xlsxSetCell(ws,row0,12,rec.estado,'s');
  if(rec.diasParaVencer!=='')xlsxSetCell(ws,row0,13,rec.diasParaVencer,'n');
  if(rec.fechaContestacion)xlsxSetCell(ws,row0,14,pqrsMatrizFmtFechaCeldaXlsx(rec.fechaContestacion),'s');
  if(rec.radicadoContestacion)xlsxSetCell(ws,row0,15,rec.radicadoContestacion,'s');
  if(rec.diasRespuesta!=='')xlsxSetCell(ws,row0,16,rec.diasRespuesta,'n');
  if(rec.estadoFinal)xlsxSetCell(ws,row0,17,rec.estadoFinal,'s');
  if(rec.observaciones)xlsxSetCell(ws,row0,18,rec.observaciones,'s');
}
function xlsxFillMatrizConsolidado(ws,records,meta){
  const extra=Math.max(0,records.length-PQRS_MATRIZ_TEMPLATE_DATA_ROWS);
  if(extra>0)xlsxShiftSheetRowsDown(ws,PQRS_MATRIZ_FOOTER_ROW_0,extra);
  const clearCount=Math.max(records.length,PQRS_MATRIZ_TEMPLATE_DATA_ROWS);
  xlsxClearMatrizDataRows(ws,PQRS_MATRIZ_DATA_ROW_0,clearCount);
  records.forEach((rec,i)=>xlsxWriteMatrizDataRow(ws,PQRS_MATRIZ_DATA_ROW_0+i,rec));
  const corte=meta.fechaCorte||hoy();
  xlsxSetCell(ws,2,15,'FECHA:  '+pqrsMatrizFmtFechaLarga(corte),'s');
  xlsxSetCell(ws,10,7,corte,'d');
  xlsxSetCell(ws,11,7,pqrsMatrizTrimestreRomano(corte),'s');
}
function xlsxFillMatrizSeguimiento(ws,list,seg){
  const rowTot=3;
  xlsxSetCell(ws,rowTot,1,seg.total,'n');
  xlsxSetCell(ws,rowTot,2,seg.oportunas,'n');
  xlsxSetCell(ws,rowTot,3,seg.fuera,'n');
  xlsxSetCell(ws,rowTot,4,seg.sinResolver,'n');
  if(seg.promedio!=='')xlsxSetCell(ws,rowTot,5,seg.promedio,'n');
  else xlsxDeleteCell(ws,XLSX.utils.encode_cell({r:rowTot,c:5}));
  const counts={};
  for(let c=2;c<=8;c++)counts[c]=0;
  list.forEach(e=>{
    const col=pqrsMatrizTipoSeguimientoCol(e._tipo_solicitud);
    counts[col]=(counts[col]||0)+1;
  });
  const guaviareRow=8;
  for(let c=2;c<=8;c++){
    const v=counts[c]||0;
    if(v)xlsxSetCell(ws,guaviareRow,c,v,'n');
    else xlsxDeleteCell(ws,XLSX.utils.encode_cell({r:guaviareRow,c:c}));
  }
  xlsxSetCell(ws,guaviareRow,9,list.length,'n');
  const totalRow=10;
  for(let c=2;c<=8;c++){
    const v=counts[c]||0;
    if(v)xlsxSetCell(ws,totalRow,c,v,'n');
    else xlsxDeleteCell(ws,XLSX.utils.encode_cell({r:totalRow,c:c}));
  }
  xlsxSetCell(ws,totalRow,9,list.length,'n');
}
function pqrsMatrizSeguimientoStats(list){
  let oportunas=0,fuera=0,sinResolver=0,sumDias=0,cntDias=0;
  list.forEach(e=>{
    if(!pqrsEstaCerrada(e)){sinResolver++;return;}
    const d=pqrsMatrizDiasRespuesta(e);
    if(d!==''){sumDias+=Number(d);cntDias++;}
    if(e._pqrs_informativa||pqrsRespuestaEnTermino(e)!==false)oportunas++;
    else fuera++;
  });
  return{
    total:list.length,
    oportunas,
    fuera,
    sinResolver,
    promedio:cntDias?Math.round(sumDias/cntDias*10)/10:''
  };
}
function pqrsMatrizDownloadWorkbook(wb,filename){
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
  const blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function pqrsMatrizOfficialDriveFilename(year){
  return 'Matriz-oficial-PQRSD-DEGUV-'+(year||String(new Date().getFullYear()))+'.xlsx';
}
function pqrsMatrizGetStoredXlsxFileId(){
  try{return localStorage.getItem(PQRS_MATRIZ_XLSX_LS_KEY)||'';}catch(e){return '';}
}
function pqrsMatrizSetStoredXlsxFileId(id){
  id=String(id||'').trim();
  if(!id)return;
  try{localStorage.setItem(PQRS_MATRIZ_XLSX_LS_KEY,id);}catch(e){}
  pqrsMatrizPersistXlsxFileIdFirestore(id);
}
async function pqrsMatrizPersistXlsxFileIdFirestore(id){
  const db=window._db;
  if(!db||!window._fsSetDoc||!window._fsDoc)return false;
  try{
    await window._fsSetDoc(window._fsDoc(db,'sistema','global'),{
      pqrsMatrizXlsxFileId:String(id||'').trim(),
      updatedAt:new Date().toISOString()
    },{merge:true});
    return true;
  }catch(err){
    console.warn('pqrsMatrizPersistXlsxFileIdFirestore:',err);
    return false;
  }
}
function pqrsMatrizApplyXlsxFileIdFromGlobal(g){
  if(g&&g.pqrsMatrizXlsxFileId)pqrsMatrizSetStoredXlsxFileId(g.pqrsMatrizXlsxFileId);
}
async function _pqrsMatrizDriveFileExists(token,fileId){
  if(!token||!fileId)return false;
  const driveApi=typeof DRIVE_API_BASE!=='undefined'?DRIVE_API_BASE:'https://www.googleapis.com/drive/v3/files';
  try{
    const res=await fetch(driveApi+'/'+fileId+'?fields=id,trashed',{headers:{Authorization:'Bearer '+token}});
    if(!res.ok)return false;
    const meta=await res.json();
    return !!(meta&&meta.id&&!meta.trashed);
  }catch(err){return false;}
}
async function _pqrsMatrizDriveSearchFiles(token,q,pageSize){
  const driveApi=typeof DRIVE_API_BASE!=='undefined'?DRIVE_API_BASE:'https://www.googleapis.com/drive/v3/files';
  const res=await fetch(driveApi+'?q='+encodeURIComponent(q)+'&fields=files(id,name,createdTime)&orderBy=createdTime&pageSize='+(pageSize||10),{
    headers:{Authorization:'Bearer '+token}
  });
  const data=await res.json();
  if(!res.ok||!data.files)return [];
  return data.files;
}
function _pqrsMatrizPickBestMatrizFile(files){
  if(!files||!files.length)return '';
  const clean=files.filter(function(f){
    return f&&f.name&&!/\(\d+\)/.test(String(f.name));
  });
  const pick=(clean.length?clean:files)[0];
  return pick&&pick.id?pick.id:'';
}
async function pqrsMatrizDriveResolveXlsxFileId(){
  const token=typeof _driveGetBestToken==='function'?_driveGetBestToken():'';
  if(!token)return '';
  const folderId=typeof PQRS_MATRIZ_DRIVE_FOLDER_ID!=='undefined'?PQRS_MATRIZ_DRIVE_FOLDER_ID
    :(typeof DRIVE_ROOT_PQRSD_ID!=='undefined'?DRIVE_ROOT_PQRSD_ID:'16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS');
  const year=String(new Date().getFullYear());
  const exactName=pqrsMatrizOfficialDriveFilename(year);
  const basePrefix='Matriz-oficial-PQRSD-DEGUV-'+year;
  let id=pqrsMatrizGetStoredXlsxFileId();
  if(id&&await _pqrsMatrizDriveFileExists(token,id))return id;
  id='';
  const esc=function(s){return String(s||'').replace(/'/g,"\\'");};
  let files=await _pqrsMatrizDriveSearchFiles(token,'"'+folderId+'" in parents and trashed=false and (name=\''+esc(exactName)+'\' or name contains \''+esc(basePrefix)+'\')');
  id=_pqrsMatrizPickBestMatrizFile(files);
  if(id){pqrsMatrizSetStoredXlsxFileId(id);return id;}
  const radFolders=await _pqrsMatrizDriveSearchFiles(token,'"'+folderId+'" in parents and trashed=false and mimeType=\'application/vnd.google-apps.folder\' and name=\'Radicacion\'',3);
  if(radFolders[0]&&radFolders[0].id){
    files=await _pqrsMatrizDriveSearchFiles(token,'"'+radFolders[0].id+'" in parents and trashed=false and name contains \''+esc(basePrefix)+'\'');
    id=_pqrsMatrizPickBestMatrizFile(files);
    if(id){pqrsMatrizSetStoredXlsxFileId(id);return id;}
  }
  files=await _pqrsMatrizDriveSearchFiles(token,'trashed=false and name contains \''+esc(basePrefix)+'\'');
  id=_pqrsMatrizPickBestMatrizFile(files);
  if(id)pqrsMatrizSetStoredXlsxFileId(id);
  return id||'';
}
function pqrsMatrizWorkbookToBlob(wb){
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
  return new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function pqrsMatrizBuildWorkbookFromList(list,periodLbl){
  if(typeof XLSX==='undefined')throw new Error('SheetJS no disponible');
  const res=await fetch(PQRS_MATRIZ_TEMPLATE_URL);
  if(!res.ok)throw new Error('No se pudo cargar la plantilla oficial');
  const buf=await res.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array',cellDates:true,cellStyles:true});
  const wsCons=wb.Sheets[PQRS_MATRIZ_SHEET_CONS];
  const wsSeg=wb.Sheets[PQRS_MATRIZ_SHEET_SEG];
  if(!wsCons)throw new Error('Plantilla sin hoja CONSOLIDADO PQRSD');
  const records=list.map((e,i)=>buildPqrsMatrizRecord(e,i+1));
  const seg=pqrsMatrizSeguimientoStats(list);
  xlsxFillMatrizConsolidado(wsCons,records,{fechaCorte:hoy(),periodLbl:periodLbl||''});
  if(wsSeg)xlsxFillMatrizSeguimiento(wsSeg,list,seg);
  return wb;
}
async function pqrsMatrizDriveUpsertWorkbook(wb,filename,knownFileId){
  const token=typeof _driveGetBestToken==='function'?_driveGetBestToken():'';
  if(!token)return{ok:false,noToken:true};
  const folderId=typeof PQRS_MATRIZ_DRIVE_FOLDER_ID!=='undefined'?PQRS_MATRIZ_DRIVE_FOLDER_ID
    :(typeof DRIVE_ROOT_PQRSD_ID!=='undefined'?DRIVE_ROOT_PQRSD_ID:'16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS');
  const driveApi=typeof DRIVE_API_BASE!=='undefined'?DRIVE_API_BASE:'https://www.googleapis.com/drive/v3/files';
  const uploadUrl=typeof DRIVE_UPLOAD_URL!=='undefined'?DRIVE_UPLOAD_URL:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const blob=pqrsMatrizWorkbookToBlob(wb);
  const safeName=String(filename||pqrsMatrizOfficialDriveFilename(String(new Date().getFullYear())));
  let fileId=knownFileId||'';
  if(fileId&&!await _pqrsMatrizDriveFileExists(token,fileId))fileId='';
  if(!fileId)fileId=await pqrsMatrizDriveResolveXlsxFileId();
  const form=new FormData();
  const meta={name:safeName,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  if(!fileId)meta.parents=[folderId];
  form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
  form.append('file',blob,safeName);
  const url=fileId?(uploadUrl.replace('?uploadType=multipart','')+'/'+fileId+'?uploadType=multipart'):uploadUrl;
  const method=fileId?'PATCH':'POST';
  const upRes=await fetch(url,{method:method,headers:{Authorization:'Bearer '+token},body:form});
  const file=await upRes.json();
  if(!upRes.ok)throw new Error((file.error&&file.error.message)||('Drive upload '+upRes.status));
  if(file.id)pqrsMatrizSetStoredXlsxFileId(file.id);
  const folderUrl=typeof PQRS_MATRIZ_DRIVE_FOLDER_URL!=='undefined'?PQRS_MATRIZ_DRIVE_FOLDER_URL
    :('https://drive.google.com/drive/folders/'+folderId);
  return{
    ok:true,
    fileId:file.id,
    driveLink:'https://drive.google.com/file/d/'+file.id+'/view',
    folderUrl:folderUrl,
    nombre:safeName
  };
}
async function pqrsMatrizDriveUpdateExpedienteRow(e,opts){
  opts=opts||{};
  if(!e||!e._exp)return{skipped:true};
  const token=typeof _driveGetBestToken==='function'?_driveGetBestToken():'';
  if(!token)return{ok:false,noToken:true};
  if(typeof XLSX==='undefined')return{ok:false,error:new Error('SheetJS no disponible')};
  const fileId=await pqrsMatrizDriveResolveXlsxFileId();
  if(!fileId)return{ok:false,noFile:true};
  const driveApi=typeof DRIVE_API_BASE!=='undefined'?DRIVE_API_BASE:'https://www.googleapis.com/drive/v3/files';
  const buf=await fetch(driveApi+'/'+fileId+'?alt=media',{headers:{Authorization:'Bearer '+token}}).then(function(r){
    if(!r.ok)throw new Error('No se pudo leer la matriz PQRSD en Drive');
    return r.arrayBuffer();
  });
  const wb=XLSX.read(buf,{type:'array',cellDates:true,cellStyles:true});
  const ws=wb.Sheets[PQRS_MATRIZ_SHEET_CONS];
  if(!ws)return{ok:false,error:new Error('Matriz sin hoja CONSOLIDADO PQRSD')};
  const expDigits=String(e._exp||'').replace(/\D/g,'');
  let row0=-1;
  const maxScan=500;
  for(let r=PQRS_MATRIZ_DATA_ROW_0;r<PQRS_MATRIZ_DATA_ROW_0+maxScan;r++){
    const addr=XLSX.utils.encode_cell({r:r,c:3});
    const cell=ws[addr];
    if(!cell||cell.v==null||cell.v==='')break;
    const rad=String(cell.v).replace(/\D/g,'');
    if(rad===expDigits){row0=r;break;}
  }
  if(row0<0)return{ok:false,notFound:true};
  const item=row0-PQRS_MATRIZ_DATA_ROW_0+1;
  const rec=buildPqrsMatrizRecord(e,item);
  xlsxWriteMatrizDataRow(ws,row0,rec);
  const year=String(new Date().getFullYear());
  return pqrsMatrizDriveUpsertWorkbook(wb,pqrsMatrizOfficialDriveFilename(year),fileId);
}
window.pqrsMatrizDriveUpdateExpedienteRow=pqrsMatrizDriveUpdateExpedienteRow;
window.pqrsMatrizApplyXlsxFileIdFromGlobal=pqrsMatrizApplyXlsxFileIdFromGlobal;
async function pqrsMatrizPublicarEnDrive(list,periodLbl){
  list=(typeof ordenarListaMatrizPqrs==='function'?ordenarListaMatrizPqrs(list):list)||[];
  if(!list.length)return{ok:false,empty:true};
  const year=String(hoy()).slice(0,4);
  const wb=await pqrsMatrizBuildWorkbookFromList(list,periodLbl||'');
  return pqrsMatrizDriveUpsertWorkbook(wb,pqrsMatrizOfficialDriveFilename(year));
}
let _pqrsMatrizDrivePublishTimer=null;
let _pqrsMatrizDrivePublishOpts=null;
function pqrsMatrizPublicarEnDriveAsync(opts){
  opts=opts||{};
  _pqrsMatrizDrivePublishOpts=Object.assign(_pqrsMatrizDrivePublishOpts||{},opts);
  return new Promise(function(resolve){
    if(_pqrsMatrizDrivePublishTimer)clearTimeout(_pqrsMatrizDrivePublishTimer);
    _pqrsMatrizDrivePublishTimer=setTimeout(function(){
      _pqrsMatrizDrivePublishTimer=null;
      const runOpts=_pqrsMatrizDrivePublishOpts||{};
      _pqrsMatrizDrivePublishOpts=null;
      if(typeof getSecretariaPqrsAll!=='function'){resolve(null);return;}
      const list=getSecretariaPqrsAll();
      if(!list.length){resolve({ok:false,empty:true});return;}
      pqrsMatrizPublicarEnDrive(list,'').then(function(res){
        if(res&&res.ok&&runOpts.notify&&typeof notif==='function'){
          notif('Matriz oficial PQRSD actualizada en Drive ('+list.length+' solicitud(es)).','ok');
        }
        resolve(res);
      }).catch(function(err){
        console.warn('pqrsMatrizPublicarEnDriveAsync:',err);
        if((runOpts.notify||runOpts.notifyOnError)&&typeof notif==='function'){
          notif('No se pudo actualizar la matriz en Drive: '+String(err.message||err).slice(0,72),'warn');
        }
        resolve({ok:false,error:err});
      });
    },1200);
  });
}
async function exportarMatrizPqrsDesdePlantilla(list,suffix,periodLbl){
  if(typeof XLSX==='undefined')return false;
  const wb=await pqrsMatrizBuildWorkbookFromList(list,periodLbl||'');
  const fname='matriz-pqrs-'+(suffix||'reporte')+'-'+hoy()+'.xlsx';
  pqrsMatrizDownloadWorkbook(wb,fname);
  let driveMsg='';
  try{
    const year=String(hoy()).slice(0,4);
    const pub=await pqrsMatrizDriveUpsertWorkbook(wb,pqrsMatrizOfficialDriveFilename(year));
    if(pub&&pub.ok)driveMsg=' · Publicada en Drive';
    else if(pub&&pub.noToken)driveMsg=' · Conecte Gmail para publicar en Drive';
  }catch(err){
    console.warn('exportarMatrizPqrsDesdePlantilla drive:',err);
    driveMsg=' · No se pudo publicar en Drive';
  }
  notif('Matriz oficial PQRSD descargada ('+list.length+' solicitud(es))'+driveMsg,'ok');
  return true;
}
