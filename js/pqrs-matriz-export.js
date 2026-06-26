// =============================================================================
// pqrs-matriz-export.js — Matriz oficial PQRSD (plantilla AGJ-CP-9-PR-02-FR-02)
// Requiere: SheetJS (XLSX global), funciones PQRSD en core.js
// =============================================================================
const PQRS_MATRIZ_TEMPLATE_URL='assets/templates/matriz-pqrs-deguv.xlsx';
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
function xlsxWriteMatrizDataRow(ws,row0,rec){
  xlsxSetCell(ws,row0,2,rec.item,'n');
  xlsxSetCell(ws,row0,3,rec.fechaRecibo,'d');
  xlsxSetCell(ws,row0,4,rec.radicadoRecibo,'s');
  xlsxSetCell(ws,row0,5,rec.departamento,'s');
  xlsxSetCell(ws,row0,6,rec.tipo,'s');
  xlsxSetCell(ws,row0,7,rec.nombre,'s');
  xlsxSetCell(ws,row0,8,rec.asunto,'s');
  xlsxSetCell(ws,row0,9,rec.plazoDias,'n');
  xlsxSetCell(ws,row0,10,rec.responsable,'s');
  xlsxSetCell(ws,row0,11,rec.fechaVence,'d');
  xlsxSetCell(ws,row0,12,rec.estado,'s');
  if(rec.diasParaVencer!=='')xlsxSetCell(ws,row0,13,rec.diasParaVencer,'n');
  if(rec.fechaContestacion)xlsxSetCell(ws,row0,14,rec.fechaContestacion,'d');
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
async function exportarMatrizPqrsDesdePlantilla(list,suffix,periodLbl){
  if(typeof XLSX==='undefined')return false;
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
  const fname='matriz-pqrs-'+(suffix||'reporte')+'-'+hoy()+'.xlsx';
  pqrsMatrizDownloadWorkbook(wb,fname);
  notif('Matriz oficial PQRSD descargada ('+list.length+' solicitud(es))','ok');
  return true;
}
