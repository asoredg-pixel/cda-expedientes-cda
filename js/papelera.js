// =============================================================================
// papelera.js — Soft-delete / papelera de reciclaje (actividades y expedientes)
// Encargado de departamento: elimina → papelera (máx. 3 meses) → restaura o
// elimina definitivo. Drive: renombra al eliminar; restaura nombre al recuperar;
// borra archivos al purgar. PQRSD: permisos existentes no se alteran aquí.
// =============================================================================

var PAPELERA_DIAS_RETENCION=90;
var PAPELERA_PREFIX='ELIMINADO-';

function puedeUsarPapelera(){
  if(typeof esAdministrador==='function'&&esAdministrador())return true;
  if(typeof esSecretaria==='function'&&esSecretaria())return true;
  if(typeof esModoResponsable==='function'&&esModoResponsable())return false;
  if(typeof esJurisdiccional==='function'&&esJurisdiccional())return false;
  if(typeof esModoCiudadano==='function'&&esModoCiudadano())return false;
  if(typeof esVistaActividadesDepto==='function'&&esVistaActividadesDepto())return true;
  // Encargado en configuración del depto (sin estar en pestaña Actividades)
  if(typeof esRolDepartamentalCfg==='function'&&esRolDepartamentalCfg()&&typeof cfgPuedeEditarResponsablesPersonas==='function'&&cfgPuedeEditarResponsablesPersonas())return true;
  return false;
}

function expEstaEnPapelera(e){
  return !!(e&&(e._eliminado||e._eliminado_en));
}

function papeleraParseFecha(v){
  if(!v)return null;
  if(typeof v==='number'&&isFinite(v))return new Date(v);
  const s=String(v).trim();
  if(!s)return null;
  const d=new Date(s.length<=10?s+'T12:00:00':s);
  return isNaN(d.getTime())?null:d;
}

function papeleraDiasRestantes(fechaElim){
  const d=papeleraParseFecha(fechaElim);
  if(!d)return PAPELERA_DIAS_RETENCION;
  const lim=d.getTime()+PAPELERA_DIAS_RETENCION*24*60*60*1000;
  return Math.ceil((lim-Date.now())/(24*60*60*1000));
}

function papeleraExpirada(fechaElim){
  return papeleraDiasRestantes(fechaElim)<=0;
}

function papeleraAutor(){
  if(typeof taskComentarioAutor==='function')return taskComentarioAutor();
  return (typeof responsableActivo!=='undefined'&&responsableActivo)||'encargado';
}

function papeleraDriveTrashName(name){
  const n=String(name||'documento').trim()||'documento';
  if(n.toUpperCase().indexOf(PAPELERA_PREFIX)===0)return n;
  return PAPELERA_PREFIX+n;
}

function papeleraDriveRestoreName(trashName,prevName){
  if(prevName)return String(prevName);
  return String(trashName||'').replace(new RegExp('^'+PAPELERA_PREFIX,'i'),'')||'documento';
}

/** Renombra soportes institucionales a ELIMINADO-… y guarda mapa en la tarea. */
async function papeleraSoftTrashTaskDrive(t){
  if(!t)return[];
  const map=[];
  const soportes=Array.isArray(t.soportes)?t.soportes:[];
  for(let i=0;i<soportes.length;i++){
    const s=soportes[i];
    if(!s)continue;
    const fid=String(s.driveFileId||s.fileId||'').trim();
    if(!fid||s.driveInstitutional===false)continue;
    const prev=String(s.driveFilename||s.label||s.nombre||s.name||'documento').trim()||'documento';
    const trash=papeleraDriveTrashName(prev);
    let ok=true;
    if(typeof driveRenameInstitutional==='function'){
      try{ok=await driveRenameInstitutional(fid,trash);}catch(err){ok=false;console.warn('papelera softTrash rename:',err);}
    }
    if(ok){
      s._driveNamePrev=s._driveNamePrev||prev;
      s.driveFilename=trash;
      s.label=trash;
      if(s.nombre)s.nombre=trash;
      map.push({driveFileId:fid,prevName:prev,trashName:trash});
    }
  }
  // Carpeta propia de actividad libre
  if(t._drive_folder_id&&typeof driveRenameInstitutional==='function'){
    try{
      const meta=typeof driveGetFileMeta==='function'?await driveGetFileMeta(t._drive_folder_id):null;
      const prevF=(meta&&meta.name)||('ACT-'+(t.codigo||t.id||''));
      if(prevF.toUpperCase().indexOf(PAPELERA_PREFIX)!==0){
        const trashF=papeleraDriveTrashName(prevF);
        const okF=await driveRenameInstitutional(t._drive_folder_id,trashF);
        if(okF){
          t._drive_folder_name_prev=t._drive_folder_name_prev||prevF;
          map.push({driveFileId:t._drive_folder_id,prevName:prevF,trashName:trashF,esCarpeta:true});
        }
      }
    }catch(err){console.warn('papelera softTrash folder:',err);}
  }
  t._drive_trash=map;
  return map;
}

async function papeleraRestoreTaskDrive(t){
  if(!t)return;
  const map=Array.isArray(t._drive_trash)?t._drive_trash:[];
  const byId={};
  map.forEach(function(m){if(m&&m.driveFileId)byId[m.driveFileId]=m;});
  const soportes=Array.isArray(t.soportes)?t.soportes:[];
  for(let i=0;i<soportes.length;i++){
    const s=soportes[i];
    if(!s)continue;
    const fid=String(s.driveFileId||s.fileId||'').trim();
    if(!fid)continue;
    const prev=s._driveNamePrev||(byId[fid]&&byId[fid].prevName)||papeleraDriveRestoreName(s.driveFilename||s.label,null);
    if(typeof driveRenameInstitutional==='function'){
      try{
        const ok=await driveRenameInstitutional(fid,prev);
        if(ok){
          s.driveFilename=prev;
          s.label=prev;
          if(s.nombre)s.nombre=prev;
          delete s._driveNamePrev;
        }
      }catch(err){console.warn('papelera restore rename:',err);}
    }
  }
  if(t._drive_folder_id&&t._drive_folder_name_prev&&typeof driveRenameInstitutional==='function'){
    try{
      await driveRenameInstitutional(t._drive_folder_id,t._drive_folder_name_prev);
      delete t._drive_folder_name_prev;
    }catch(err){console.warn('papelera restore folder:',err);}
  }
  delete t._drive_trash;
}

async function papeleraPurgeTaskDrive(t){
  if(!t)return;
  if(typeof drivePurgeTaskInstitutionalSoportes==='function'){
    try{await drivePurgeTaskInstitutionalSoportes(t);}catch(err){console.warn('papelera purge soportes:',err);}
  }
  if(t._drive_folder_id&&typeof driveDeleteFolderRecursive==='function'){
    try{await driveDeleteFolderRecursive(t._drive_folder_id);}catch(err){
      if(typeof driveDeleteInstitutional==='function'){
        try{await driveDeleteInstitutional(t._drive_folder_id);}catch(e2){}
      }
    }
    delete t._drive_folder_id;
    delete t._drive_folder_link;
  }else if(t._drive_folder_id&&typeof driveDeleteInstitutional==='function'){
    try{await driveDeleteInstitutional(t._drive_folder_id);}catch(err){}
    delete t._drive_folder_id;
    delete t._drive_folder_link;
  }
}

/** Soft-delete de actividad (cualquier estado). PQRSD: respeta puedeEliminarTaskPqrs. */
async function softDeleteActividad(expId,taskId,motivo,opts){
  opts=opts||{};
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t)return{ok:false,err:'no_encontrada'};
  if(t.eliminada)return{ok:true,already:true};
  if(!opts.skipPerm){
    if(typeof puedeEliminarTaskPqrs==='function'&&!puedeEliminarTaskPqrs(expId,taskId)){
      return{ok:false,err:'pqrs'};
    }
    const puede=
      (typeof puedeGestionarActividadesDepto==='function'&&puedeGestionarActividadesDepto())
      ||(typeof puedeUsarPapelera==='function'&&puedeUsarPapelera())
      ||(typeof esAdministrador==='function'&&esAdministrador())
      ||(
        !(typeof esModoResponsable==='function'&&esModoResponsable())
        &&!(typeof esJurisdiccional==='function'&&esJurisdiccional())
        &&!(typeof esModoCiudadano==='function'&&esModoCiudadano())
        &&!(typeof esSoloLectura==='function'&&esSoloLectura())
        &&!(typeof esUsuarioContratista==='function'&&esUsuarioContratista())
      );
    if(!puede)return{ok:false,err:'permiso'};
  }
  const nota=String(motivo||'').trim()||'Sin motivo indicado';
  const cuando=new Date().toISOString();
  const por=papeleraAutor();
  try{await papeleraSoftTrashTaskDrive(t);}catch(err){console.warn('softDelete drive:',err);}
  const ok=typeof mutateTask==='function'&&mutateTask(expId,taskId,function(tk){
    tk.eliminada=true;
    tk.eliminadaEn=cuando;
    tk.eliminadaPor=por;
    tk.eliminadaMotivo=nota;
    if(tk.firmaWf&&typeof tk.firmaWf==='object'){
      tk.firmaWf=Object.assign({},tk.firmaWf,{fase:'',cerrada_por_eliminacion:true});
    }
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'eliminacion',fecha:typeof hoy==='function'?hoy():cuando.slice(0,10),por:por,nota:nota,papelera:true});
    if(Array.isArray(t._drive_trash))tk._drive_trash=t._drive_trash.slice();
    if(t._drive_folder_name_prev)tk._drive_folder_name_prev=t._drive_folder_name_prev;
    // Reaplicar renombres en metadatos de soportes ya mutados en t
    if(Array.isArray(t.soportes)&&Array.isArray(tk.soportes)){
      t.soportes.forEach(function(s,i){
        if(tk.soportes[i]&&s){
          if(s.driveFilename)tk.soportes[i].driveFilename=s.driveFilename;
          if(s.label)tk.soportes[i].label=s.label;
          if(s._driveNamePrev)tk.soportes[i]._driveNamePrev=s._driveNamePrev;
        }
      });
    }
  });
  if(typeof logAudit==='function')logAudit('Papelera: eliminó actividad ['+(expId||'')+'/'+(taskId||'')+'] · '+nota,'papelera',expId||taskId);
  return{ok:!!ok};
}

async function restaurarActividadPapelera(expId,taskId){
  if(!puedeUsarPapelera())return{ok:false,err:'permiso'};
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t||!t.eliminada)return{ok:false,err:'no_encontrada'};
  try{await papeleraRestoreTaskDrive(t);}catch(err){console.warn('restore drive:',err);}
  const ok=typeof mutateTask==='function'&&mutateTask(expId,taskId,function(tk){
    tk.eliminada=false;
    delete tk.eliminadaEn;
    delete tk.eliminadaPor;
    delete tk.eliminadaMotivo;
    delete tk._drive_trash;
    delete tk._drive_folder_name_prev;
    if(tk.firmaWf&&tk.firmaWf.cerrada_por_eliminacion){
      const fw=Object.assign({},tk.firmaWf);
      delete fw.cerrada_por_eliminacion;
      tk.firmaWf=fw;
    }
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'restauracion',fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10),por:papeleraAutor(),nota:'Restaurada desde papelera'});
    if(Array.isArray(t.soportes)&&Array.isArray(tk.soportes)){
      t.soportes.forEach(function(s,i){
        if(tk.soportes[i]&&s){
          if(s.driveFilename)tk.soportes[i].driveFilename=s.driveFilename;
          if(s.label)tk.soportes[i].label=s.label;
          delete tk.soportes[i]._driveNamePrev;
        }
      });
    }
  });
  if(typeof logAudit==='function')logAudit('Papelera: restauró actividad ['+(expId||'')+'/'+(taskId||'')+']','papelera',expId||taskId);
  return{ok:!!ok};
}

async function eliminarDefinitivoActividadPapelera(expId,taskId){
  if(!puedeUsarPapelera())return{ok:false,err:'permiso'};
  const t=typeof getTaskAny==='function'?getTaskAny(expId,taskId):null;
  if(!t)return{ok:false,err:'no_encontrada'};
  try{await papeleraPurgeTaskDrive(t);}catch(err){console.warn('purge drive:',err);}
  const eid=String(expId||'').trim();
  const tid=String(taskId||'').trim();
  const e=typeof getExpById==='function'?getExpById(eid):null;
  if(e&&Array.isArray(e.tasks)){
    e.tasks=e.tasks.filter(function(x){return String(x&&x.id||'')!==tid;});
    e._pending_fs_sync=true;
    if(typeof persistExpedienteGranular==='function')persistExpedienteGranular(e,false);
    else if(typeof persistExpLocal==='function')persistExpLocal();
  }else if(typeof actividadesLibres!=='undefined'&&Array.isArray(actividadesLibres)){
    const ix=actividadesLibres.findIndex(function(x){return x&&(String(x.id||'')===tid||String(x.codigo||'')===eid);});
    if(ix>=0)actividadesLibres.splice(ix,1);
    if(typeof persistExpLocal==='function')persistExpLocal();
    if(typeof persistActividadesLibresFirestore==='function')persistActividadesLibresFirestore();
    else if(typeof saveGlobalFirestore==='function')saveGlobalFirestore();
  }
  if(typeof logAudit==='function')logAudit('Papelera: eliminó definitivamente actividad ['+eid+'/'+tid+']','papelera',eid||tid);
  if(typeof refreshTaskViews==='function')refreshTaskViews();
  return{ok:true};
}

/** Soft-delete expediente + renombrar docs Drive. PQRSD: no cambia quién puede. */
async function softDeleteExpediente(expId,motivo){
  const id=String(expId||'').trim();
  const e=typeof getExpById==='function'?getExpById(id):(exps||[]).find(function(x){return String(x._exp||'')===id;});
  if(!e)return{ok:false,err:'no_encontrada'};
  if(expEstaEnPapelera(e))return{ok:true,already:true};
  if(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e)&&typeof esSecretaria==='function'&&!esSecretaria()&&!(typeof esAdministrador==='function'&&esAdministrador())){
    return{ok:false,err:'pqrs'};
  }
  if(typeof esUsuarioContratista==='function'&&esUsuarioContratista())return{ok:false,err:'permiso'};
  if(typeof esSoloLectura==='function'&&esSoloLectura())return{ok:false,err:'permiso'};
  const nota=String(motivo||'').trim()||'Sin motivo indicado';
  const cuando=new Date().toISOString();
  const por=papeleraAutor();
  // Soft-delete tareas internas + Drive
  const tasks=Array.isArray(e.tasks)?e.tasks:[];
  for(let i=0;i<tasks.length;i++){
    const tk=typeof normalizeTask==='function'?normalizeTask(tasks[i]):tasks[i];
    if(!tk||tk.eliminada)continue;
    try{await papeleraSoftTrashTaskDrive(tk);}catch(err){}
    tk.eliminada=true;
    tk.eliminadaEn=cuando;
    tk.eliminadaPor=por;
    tk.eliminadaMotivo='Expediente a papelera: '+nota;
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'eliminacion',fecha:typeof hoy==='function'?hoy():cuando.slice(0,10),por:por,nota:'Por eliminación de expediente',papelera:true});
    tasks[i]=tk;
  }
  e.tasks=tasks;
  try{await papeleraSoftTrashExpedienteDrive(e);}catch(err){console.warn('softDelete exp drive:',err);}
  e._eliminado=true;
  e._eliminado_en=cuando;
  e._eliminado_por=por;
  e._eliminado_motivo=nota;
  e._pending_fs_sync=true;
  if(typeof persistExpedienteGranular==='function')await persistExpedienteGranular(e,false);
  else if(typeof persistExpLocal==='function')persistExpLocal();
  if(typeof logAudit==='function'){
    if(typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))logAudit('Papelera: eliminó PQRSD ['+id+'] · '+nota,'pqrsd',id);
    else logAudit('Papelera: eliminó expediente ['+id+'] · '+nota,'expedientes',id);
  }
  return{ok:true};
}

async function restaurarExpedientePapelera(expId){
  if(!puedeUsarPapelera())return{ok:false,err:'permiso'};
  const id=String(expId||'').trim();
  const e=typeof getExpById==='function'?getExpById(id):null;
  if(!e||!expEstaEnPapelera(e))return{ok:false,err:'no_encontrada'};
  try{await papeleraRestoreExpedienteDrive(e);}catch(err){console.warn('restore exp drive:',err);}
  const lote=e._eliminado_en||'';
  const tasks=Array.isArray(e.tasks)?e.tasks:[];
  for(let i=0;i<tasks.length;i++){
    const tk=tasks[i];
    if(!tk||!tk.eliminada)continue;
    const porExp=String(tk.eliminadaMotivo||'').indexOf('Expediente a papelera')===0
      ||(lote&&String(tk.eliminadaEn||'')===String(lote));
    if(!porExp)continue; // otras eliminaciones independientes siguen en papelera
    try{await papeleraRestoreTaskDrive(tk);}catch(err){}
    tk.eliminada=false;
    delete tk.eliminadaEn;
    delete tk.eliminadaPor;
    delete tk.eliminadaMotivo;
    delete tk._drive_trash;
    if(!Array.isArray(tk.historial))tk.historial=[];
    tk.historial.push({tipo:'restauracion',fecha:typeof hoy==='function'?hoy():new Date().toISOString().slice(0,10),por:papeleraAutor(),nota:'Restaurada con el expediente'});
  }
  e.tasks=tasks;
  e._eliminado=false;
  delete e._eliminado_en;
  delete e._eliminado_por;
  delete e._eliminado_motivo;
  delete e._drive_trash;
  delete e._drive_folder_name_prev;
  e._pending_fs_sync=true;
  if(typeof persistExpedienteGranular==='function')await persistExpedienteGranular(e,false);
  if(typeof logAudit==='function')logAudit('Papelera: restauró expediente ['+id+']','papelera',id);
  return{ok:true};
}

async function eliminarDefinitivoExpedientePapelera(expId){
  if(!puedeUsarPapelera())return{ok:false,err:'permiso'};
  const id=String(expId||'').trim();
  const e=typeof getExpById==='function'?getExpById(id):null;
  if(!e)return{ok:false,err:'no_encontrada'};
  // Borrar Drive (carpeta + archivos)
  if(e._drive_folder_id){
    if(typeof driveDeleteFolderRecursive==='function'){
      try{await driveDeleteFolderRecursive(e._drive_folder_id);}catch(err){console.warn('delete folder recursive:',err);}
    }else if(typeof driveDeleteInstitutional==='function'){
      try{await driveDeleteInstitutional(e._drive_folder_id);}catch(err){}
    }
  }
  const tasks=Array.isArray(e.tasks)?e.tasks:[];
  for(let i=0;i<tasks.length;i++){
    try{await papeleraPurgeTaskDrive(tasks[i]);}catch(err){}
  }
  if(typeof persistExpedienteDelete==='function'){
    const res=await persistExpedienteDelete(e);
    if(!res||!res.ok)return{ok:false,err:'firebase',detail:res};
  }
  if(typeof exps!=='undefined'&&Array.isArray(exps)){
    exps=exps.filter(function(x){return String(x._exp||'').trim()!==id;});
  }
  if(typeof editId!=='undefined'&&editId===id){
    editId=null;
    if(typeof showTab==='function')showTab('reg');
  }
  if(typeof logAudit==='function')logAudit('Papelera: eliminó definitivamente expediente ['+id+']','papelera',id);
  return{ok:true};
}

async function papeleraSoftTrashExpedienteDrive(e){
  if(!e)return;
  const map=Array.isArray(e._drive_trash)?e._drive_trash.slice():[];
  if(e._drive_folder_id&&typeof driveRenameInstitutional==='function'){
    try{
      const meta=typeof driveGetFileMeta==='function'?await driveGetFileMeta(e._drive_folder_id):null;
      const prev=(meta&&meta.name)||('EXP-'+String(e._exp||'').replace(/\s/g,''));
      if(prev.toUpperCase().indexOf(PAPELERA_PREFIX)!==0){
        const trash=papeleraDriveTrashName(prev);
        const ok=await driveRenameInstitutional(e._drive_folder_id,trash);
        if(ok){
          e._drive_folder_name_prev=prev;
          map.push({driveFileId:e._drive_folder_id,prevName:prev,trashName:trash,esCarpeta:true});
        }
      }
    }catch(err){console.warn('softTrash exp folder:',err);}
  }
  if(e._drive_folder_id&&typeof driveListFolderAllRecursive==='function'){
    try{
      const files=await driveListFolderAllRecursive(e._drive_folder_id);
      for(let i=0;i<(files||[]).length;i++){
        const f=files[i];
        if(!f||!f.id||f.esCarpeta)continue;
        const prev=f.name||'documento';
        if(String(prev).toUpperCase().indexOf(PAPELERA_PREFIX)===0)continue;
        const trash=papeleraDriveTrashName(prev);
        if(typeof driveRenameInstitutional==='function'){
          const ok=await driveRenameInstitutional(f.id,trash);
          if(ok)map.push({driveFileId:f.id,prevName:prev,trashName:trash});
        }
      }
    }catch(err){console.warn('softTrash exp files:',err);}
  }
  e._drive_trash=map;
}

async function papeleraRestoreExpedienteDrive(e){
  if(!e)return;
  const map=Array.isArray(e._drive_trash)?e._drive_trash:[];
  for(let i=0;i<map.length;i++){
    const m=map[i];
    if(!m||!m.driveFileId||!m.prevName)continue;
    if(typeof driveRenameInstitutional==='function'){
      try{await driveRenameInstitutional(m.driveFileId,m.prevName);}catch(err){}
    }
  }
  if(e._drive_folder_id&&e._drive_folder_name_prev&&typeof driveRenameInstitutional==='function'){
    try{await driveRenameInstitutional(e._drive_folder_id,e._drive_folder_name_prev);}catch(err){}
  }
  delete e._drive_trash;
  delete e._drive_folder_name_prev;
}

function collectPapeleraItems(deptoId){
  const depto=String(deptoId||(typeof deptoActivo!=='undefined'?deptoActivo:'')||'').trim();
  const acts=[];
  const expsList=[];
  const lista=(typeof exps!=='undefined'&&Array.isArray(exps))?exps:[];
  lista.forEach(function(e){
    if(!e)return;
    const ed=String(e._depto||'guaviare');
    // Admin global ve todos; encargado solo su depto; Secretaría ve PQRSD
    let visible=false;
    if(typeof esAdministrador==='function'&&esAdministrador()&&typeof esAdminModoGlobal==='function'&&esAdminModoGlobal())visible=true;
    else if(typeof esSecretaria==='function'&&esSecretaria()&&typeof esPqrsSecretaria==='function'&&esPqrsSecretaria(e))visible=true;
    else if(depto&&ed===depto)visible=true;
    if(!visible)return;
    if(expEstaEnPapelera(e)){
      expsList.push({
        tipo:'expediente',
        expId:e._exp,
        depto:ed,
        nombre:typeof getNom==='function'?getNom(e):(e._pn_nombre||e._qd_nombre||''),
        motivo:e._eliminado_motivo||'',
        por:e._eliminado_por||'',
        fecha:e._eliminado_en||'',
        dias:papeleraDiasRestantes(e._eliminado_en)
      });
    }
    (e.tasks||[]).forEach(function(t){
      if(!t||!t.eliminada)return;
      // Si el expediente entero está en papelera, no listar tareas sueltas (se restauran con el exp)
      if(expEstaEnPapelera(e))return;
      acts.push({
        tipo:'actividad',
        expId:e._exp,
        taskId:t.id,
        sinExpediente:false,
        desc:t.desc||t.actividad||'',
        estado:typeof estadoTaskLabel==='function'?estadoTaskLabel(t):(t.estado||''),
        motivo:t.eliminadaMotivo||'',
        por:t.eliminadaPor||'',
        fecha:t.eliminadaEn||'',
        dias:papeleraDiasRestantes(t.eliminadaEn),
        depto:ed
      });
    });
  });
  (typeof actividadesLibres!=='undefined'&&Array.isArray(actividadesLibres)?actividadesLibres:[]).forEach(function(t){
    if(!t||!t.eliminada)return;
    const td=typeof resolveDeptoActLibre==='function'?resolveDeptoActLibre(t.depto):(t.depto||'guaviare');
    let visible=false;
    if(typeof esAdministrador==='function'&&esAdministrador()&&typeof esAdminModoGlobal==='function'&&esAdminModoGlobal())visible=true;
    else if(depto&&td===depto)visible=true;
    if(!visible)return;
    acts.push({
      tipo:'actividad',
      expId:t.codigo||t.id,
      taskId:t.id,
      sinExpediente:true,
      desc:t.desc||t.actividad||'',
      estado:typeof estadoTaskLabel==='function'?estadoTaskLabel(t):(t.estado||''),
      motivo:t.eliminadaMotivo||'',
      por:t.eliminadaPor||'',
      fecha:t.eliminadaEn||'',
      dias:papeleraDiasRestantes(t.eliminadaEn),
      depto:td
    });
  });
  acts.sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
  expsList.sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
  return{actividades:acts,expedientes:expsList};
}

function renderPapeleraCfg(){
  const panel=document.getElementById('cfg-papelera-panel');
  if(!panel)return;
  if(!puedeUsarPapelera()){
    panel.innerHTML='<div class="card" style="padding:16px;color:var(--tx2)">Solo el encargado del departamento (o el administrador) puede gestionar la papelera.</div>';
    return;
  }
  const data=collectPapeleraItems(typeof deptoCfg!=='undefined'?deptoCfg:deptoActivo);
  const fmt=function(f){
    if(!f)return'—';
    if(typeof fmtF==='function'&&String(f).length>=10)return fmtF(String(f).slice(0,10))+(String(f).length>10?' · '+String(f).slice(11,16):'');
    return String(f);
  };
  const diasBdg=function(d){
    if(d==null)return'';
    const n=Number(d);
    const col=n<=7?'#a32d2d':(n<=30?'#b87d0a':'#1a7a4a');
    return '<span class="bdg" style="background:'+col+'22;color:'+col+';border:1px solid '+col+'">'+n+' d</span>';
  };
  let h='<div class="card" style="margin-bottom:12px;padding:12px 14px">'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:4px">🗑 Papelera de reciclaje</div>'+
    '<div style="font-size:12px;color:var(--tx2);line-height:1.45">Actividades y expedientes eliminados se conservan hasta <strong>'+PAPELERA_DIAS_RETENCION+' días</strong>. Puede restaurarlos o eliminarlos definitivamente (también borra documentos en Drive). Tras ese plazo la app los elimina sola.</div>'+
    '</div>';
  h+='<div class="card" style="margin-bottom:12px;padding:12px 14px">'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Actividades ('+data.actividades.length+')</div>';
  if(!data.actividades.length)h+='<div class="emp" style="padding:8px 0;color:var(--tx3)">No hay actividades en papelera.</div>';
  else{
    h+='<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr>'+
      '<th>Actividad</th><th>Exp. / código</th><th>Motivo</th><th>Eliminó</th><th>Quedan</th><th></th></tr></thead><tbody>';
    data.actividades.forEach(function(it){
      const eid=typeof escAttr==='function'?escAttr(it.expId):it.expId;
      const tid=typeof escAttr==='function'?escAttr(it.taskId):it.taskId;
      h+='<tr>'+
        '<td><strong>'+(typeof escAttr==='function'?escAttr(it.desc):it.desc)+'</strong>'+(it.sinExpediente?' <span class="bdg" style="font-size:10px">Sin exp.</span>':'')+'</td>'+
        '<td style="font-family:DM Mono,monospace">'+eid+'</td>'+
        '<td style="color:var(--tx2)">'+(typeof escAttr==='function'?escAttr(it.motivo||'—'):(it.motivo||'—'))+'</td>'+
        '<td>'+(typeof escAttr==='function'?escAttr(it.por||'—'):(it.por||'—'))+'<br><span style="font-size:10px;color:var(--tx3)">'+fmt(it.fecha)+'</span></td>'+
        '<td>'+diasBdg(it.dias)+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button type="button" class="btn bsm bp" onclick="papeleraUiRestaurarAct(\''+eid+'\',\''+tid+'\')">↩ Restaurar</button> '+
          '<button type="button" class="btn bsm bd2" onclick="papeleraUiEliminarAct(\''+eid+'\',\''+tid+'\')">Eliminar definitivo</button>'+
        '</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';
  h+='<div class="card" style="padding:12px 14px">'+
    '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Expedientes ('+data.expedientes.length+')</div>';
  if(!data.expedientes.length)h+='<div class="emp" style="padding:8px 0;color:var(--tx3)">No hay expedientes en papelera.</div>';
  else{
    h+='<div style="overflow:auto"><table class="tbl" style="width:100%;font-size:12px"><thead><tr>'+
      '<th>Expediente</th><th>Interesado</th><th>Motivo</th><th>Eliminó</th><th>Quedan</th><th></th></tr></thead><tbody>';
    data.expedientes.forEach(function(it){
      const eid=typeof escAttr==='function'?escAttr(it.expId):it.expId;
      h+='<tr>'+
        '<td style="font-family:DM Mono,monospace;font-weight:600">'+eid+'</td>'+
        '<td>'+(typeof escAttr==='function'?escAttr(it.nombre||'—'):(it.nombre||'—'))+'</td>'+
        '<td style="color:var(--tx2)">'+(typeof escAttr==='function'?escAttr(it.motivo||'—'):(it.motivo||'—'))+'</td>'+
        '<td>'+(typeof escAttr==='function'?escAttr(it.por||'—'):(it.por||'—'))+'<br><span style="font-size:10px;color:var(--tx3)">'+fmt(it.fecha)+'</span></td>'+
        '<td>'+diasBdg(it.dias)+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button type="button" class="btn bsm bp" onclick="papeleraUiRestaurarExp(\''+eid+'\')">↩ Restaurar</button> '+
          '<button type="button" class="btn bsm bd2" onclick="papeleraUiEliminarExp(\''+eid+'\')">Eliminar definitivo</button>'+
        '</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>';
  panel.innerHTML=h;
}

function papeleraUiRestaurarAct(expId,taskId){
  if(typeof confirmPrecaucion==='function'){
    confirmPrecaucion({
      title:'Restaurar actividad',
      message:'¿Restaurar esta actividad y los nombres de sus documentos en Drive?',
      detail:expId+' · '+taskId,
      confirmLabel:'Sí, restaurar',
      tone:'warn'
    },function(){
      restaurarActividadPapelera(expId,taskId).then(function(r){
        if(r&&r.ok){if(typeof notif==='function')notif('Actividad restaurada','ok');renderPapeleraCfg();if(typeof renderActividades==='function')renderActividades();}
        else if(typeof notif==='function')notif('No se pudo restaurar','err');
      });
    });
  }
}
function papeleraUiEliminarAct(expId,taskId){
  if(typeof confirmEliminar==='function'){
    confirmEliminar({
      title:'Eliminar definitivamente',
      message:'Se borrará la actividad y sus documentos en Drive. No se puede deshacer.',
      detail:expId+' · '+taskId,
      confirmLabel:'Sí, eliminar definitivo'
    },function(){
      eliminarDefinitivoActividadPapelera(expId,taskId).then(function(r){
        if(r&&r.ok){if(typeof notif==='function')notif('Actividad eliminada definitivamente','ok');renderPapeleraCfg();}
        else if(typeof notif==='function')notif('No se pudo eliminar','err');
      });
    });
  }
}
function papeleraUiRestaurarExp(expId){
  if(typeof confirmPrecaucion==='function'){
    confirmPrecaucion({
      title:'Restaurar expediente',
      message:'¿Restaurar el expediente, sus actividades y los nombres de documentos en Drive?',
      detail:expId,
      confirmLabel:'Sí, restaurar',
      tone:'warn'
    },function(){
      restaurarExpedientePapelera(expId).then(function(r){
        if(r&&r.ok){
          if(typeof notif==='function')notif('Expediente restaurado','ok');
          renderPapeleraCfg();
          if(typeof renderTabla==='function')renderTabla();
          if(typeof renderActividades==='function')renderActividades();
        }else if(typeof notif==='function')notif('No se pudo restaurar','err');
      });
    });
  }
}
function papeleraUiEliminarExp(expId){
  if(typeof confirmEliminar==='function'){
    confirmEliminar({
      title:'Eliminar expediente definitivamente',
      message:'Se borrará el expediente, subcarpetas y documentos en Drive. No se puede deshacer.',
      detail:expId,
      confirmLabel:'Sí, eliminar definitivo'
    },function(){
      eliminarDefinitivoExpedientePapelera(expId).then(function(r){
        if(r&&r.ok){
          if(typeof notif==='function')notif('Expediente eliminado definitivamente','ok');
          renderPapeleraCfg();
          if(typeof renderTabla==='function')renderTabla();
        }else if(typeof notif==='function')notif('No se pudo eliminar','err');
      });
    });
  }
}

/** Purga automática (> 3 meses). Idempotente; se llama al abrir papelera / al sincronizar. */
async function papeleraPurgeExpired(opts){
  opts=opts||{};
  if(window._papeleraPurging)return{ok:true,busy:true};
  window._papeleraPurging=true;
  let nAct=0,nExp=0;
  try{
    const data=collectPapeleraItems(opts.depto||(typeof deptoActivo!=='undefined'?deptoActivo:''));
    for(let i=0;i<data.actividades.length;i++){
      const it=data.actividades[i];
      if(!papeleraExpirada(it.fecha))continue;
      const r=await eliminarDefinitivoActividadPapelera(it.expId,it.taskId);
      if(r&&r.ok)nAct++;
    }
    for(let j=0;j<data.expedientes.length;j++){
      const it=data.expedientes[j];
      if(!papeleraExpirada(it.fecha))continue;
      const r=await eliminarDefinitivoExpedientePapelera(it.expId);
      if(r&&r.ok)nExp++;
    }
    if((nAct||nExp)&&typeof logAudit==='function'){
      logAudit('Papelera: purga automática ('+nAct+' act., '+nExp+' exp.)','papelera','auto');
    }
  }catch(err){console.warn('papeleraPurgeExpired:',err);}
  window._papeleraPurging=false;
  return{ok:true,actividades:nAct,expedientes:nExp};
}

function papeleraSchedulePurge(){
  if(window._papeleraPurgeTimer)return;
  window._papeleraPurgeTimer=setTimeout(function(){
    window._papeleraPurgeTimer=null;
    papeleraPurgeExpired({silent:true}).catch(function(){});
  },8000);
}

window.puedeUsarPapelera=puedeUsarPapelera;
window.expEstaEnPapelera=expEstaEnPapelera;
window.softDeleteActividad=softDeleteActividad;
window.restaurarActividadPapelera=restaurarActividadPapelera;
window.eliminarDefinitivoActividadPapelera=eliminarDefinitivoActividadPapelera;
window.softDeleteExpediente=softDeleteExpediente;
window.restaurarExpedientePapelera=restaurarExpedientePapelera;
window.eliminarDefinitivoExpedientePapelera=eliminarDefinitivoExpedientePapelera;
window.collectPapeleraItems=collectPapeleraItems;
window.renderPapeleraCfg=renderPapeleraCfg;
window.papeleraUiRestaurarAct=papeleraUiRestaurarAct;
window.papeleraUiEliminarAct=papeleraUiEliminarAct;
window.papeleraUiRestaurarExp=papeleraUiRestaurarExp;
window.papeleraUiEliminarExp=papeleraUiEliminarExp;
window.papeleraPurgeExpired=papeleraPurgeExpired;
window.papeleraSchedulePurge=papeleraSchedulePurge;
