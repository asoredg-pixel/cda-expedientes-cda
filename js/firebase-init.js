// Firebase initialization — expone db, auth y todas las APIs de Firestore/Auth
// como propiedades de window._ para ser consumidas por scripts clásicos.
const firebaseConfig={
  apiKey:"AIzaSyD3IN1Nvx6qx3j6YoJxG4SbA1NgAQg_jMU",
  authDomain:"cda-tramites.firebaseapp.com",
  projectId:"cda-tramites",
  storageBucket:"cda-tramites.firebasestorage.app",
  messagingSenderId:"215089141263",
  appId:"1:215089141263:web:3eda6997d502150f16b57a"
};
import{initializeApp,onLog}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,onSnapshot,getDocs,collection,collectionGroup,query,where,orderBy,limit,deleteDoc,deleteField,arrayUnion,arrayRemove,runTransaction,increment}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithCredential,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import{getFunctions,httpsCallable}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
const app=initializeApp(firebaseConfig);
// Con la cuota diaria agotada, Firestore solo lo informa en su registro: las escrituras quedan en espera.
onLog(function(e){
  const txt=String((e&&e.message)||'')+' '+((e&&Array.isArray(e.args))?e.args.map(String).join(' '):'');
  if(!/resource-exhausted|quota exceeded/i.test(txt)||window._fsCuotaAgotada)return;
  window._fsCuotaAgotada=true;
  window.dispatchEvent(new Event('firestore-cuota-agotada'));
},{level:'error'});
// Sin cupo de escritura Firestore no da error: muestra el cambio en pantalla y lo pierde al recargar.
// Un guardado sin confirmar a tiempo pasa el sistema a solo consulta; se libera cuando todos confirman.
const FS_TOPE_CONFIRMACION_MS=10000;
let fsEscriturasPendientes=0;
function vigilarEscritura(fn){
  return function(){
    const p=fn.apply(null,arguments);
    fsEscriturasPendientes++;
    const t=setTimeout(function(){
      if(window._fsCuotaAgotada)return;
      window._fsCuotaAgotada=true;
      window.dispatchEvent(new Event('firestore-cuota-agotada'));
    },FS_TOPE_CONFIRMACION_MS);
    const fin=function(ok){
      clearTimeout(t);
      fsEscriturasPendientes--;
      if(!ok||!window._fsCuotaAgotada||fsEscriturasPendientes>0)return;
      window._fsCuotaAgotada=false;
      window.dispatchEvent(new Event('firestore-cuota-restablecida'));
    };
    Promise.resolve(p).then(function(){fin(true);},function(){fin(false);});
    return p;
  };
}
// Diagnóstico Blaze (solo consola / localStorage — no escribe en Firestore).
// Consola: sstLecturas() | sstDiagFs() | sstDiagFs(true) reinicia.
const FS_LECT_KEY='sst_fs_lecturas';
const FS_DIAG_KEY='sst_fs_diag';
const FS_ARR_CAMPOS=['historial','tasks','mensajes','comentarios','notas','actividadesLibres','agendaEventos','_pqrs_historial','_pqrs_comentarios','_detalle_notas','_tasks'];
let fsLect=null;
let fsLectTimer=null;
let fsDiag=null;
let fsDiagTimer=null;
const fsDiagAvisos=Object.create(null);
const fsDiagListenActivos=Object.create(null);
function fsLectHoy(){return new Date().toLocaleDateString('en-CA');}
function fsLectEstado(){
  const hoy=fsLectHoy();
  if(fsLect&&fsLect.dia===hoy)return fsLect;
  try{fsLect=JSON.parse(localStorage.getItem(FS_LECT_KEY)||'null');}catch(e){fsLect=null;}
  if(!fsLect||fsLect.dia!==hoy||!fsLect.por)fsLect={dia:hoy,total:0,cargas:0,por:{}};
  return fsLect;
}
function fsDiagEstado(){
  const hoy=fsLectHoy();
  if(fsDiag&&fsDiag.dia===hoy)return fsDiag;
  try{fsDiag=JSON.parse(localStorage.getItem(FS_DIAG_KEY)||'null');}catch(e){fsDiag=null;}
  if(!fsDiag||fsDiag.dia!==hoy||!fsDiag.por){
    fsDiag={dia:hoy,lecturas:0,bytes:0,por:{},avisos:[],topDocs:[]};
  }
  if(!Array.isArray(fsDiag.avisos))fsDiag.avisos=[];
  if(!Array.isArray(fsDiag.topDocs))fsDiag.topDocs=[];
  return fsDiag;
}
function fsLectRuta(ref){
  let p='';
  try{
    if(ref&&typeof ref.path==='string')p=ref.path;
    else if(ref&&ref._query){
      p=ref._query.collectionGroup?('*/'+ref._query.collectionGroup):ref._query.path.canonicalString();
      if(ref._query.filters&&ref._query.filters.length)p+=' (filtro)';
    }
  }catch(e){}
  if(!p)return'?';
  const seg=p.split('/');
  if(seg[0]==='sistema'||seg[0]==='departamentos')return seg.length<=2?p:seg.map(function(s,i){return i%2===1&&i>1?'*':s;}).join('/');
  return seg.map(function(s,i){return i%2===1?'*':s;}).join('/');
}
function fsDiagColeccion(ruta){
  const s=String(ruta||'');
  if(s.indexOf('expedientes')>=0)return'expedientes';
  if(s.indexOf('mensajes')>=0)return'mensajes';
  if(s.indexOf('personas')>=0)return'personas';
  if(s.indexOf('usuarios')>=0)return'usuarios';
  if(s.indexOf('chats')>=0)return'chats';
  if(s.indexOf('apoyo_uso')>=0)return'apoyo_uso';
  if(s.indexOf('sistema/')===0||s==='sistema')return'sistema';
  if(s.indexOf('departamentos')===0)return'departamentos';
  const p=s.split('/')[0];
  return p||'?';
}
function fsDiagUsuario(){
  try{
    const u=window._usuarioActual;
    if(u&&u.email)return String(u.email).toLowerCase();
    const a=window._firebaseAuth&&window._firebaseAuth.currentUser;
    if(a&&a.email)return String(a.email).toLowerCase();
  }catch(e){}
  return'(sin sesión)';
}
function fsDiagModulo(){
  try{
    const st=String((new Error()).stack||'');
    const re=/\/js\/([a-z0-9_-]+)\.js/gi;
    let m,ult=null;
    while((m=re.exec(st))){
      if(m[1]==='firebase-init')continue;
      ult=m[1];
    }
    return ult||'?';
  }catch(e){return'?';}
}
function fsDiagQueryMeta(ref){
  const meta={path:'',filtros:0,limit:0,esQuery:false,esDoc:false,collectionGroup:false};
  try{
    if(ref&&typeof ref.path==='string'&&!ref._query){
      meta.path=ref.path;
      meta.esDoc=ref.path.split('/').length%2===0;
      return meta;
    }
    if(ref&&ref._query){
      meta.esQuery=true;
      meta.collectionGroup=!!ref._query.collectionGroup;
      meta.path=meta.collectionGroup?('*/'+ref._query.collectionGroup):ref._query.path.canonicalString();
      meta.filtros=(ref._query.filters&&ref._query.filters.length)||0;
      const lim=ref._query.limit||ref._query.explicitLimit||null;
      if(typeof lim==='number')meta.limit=lim;
      else if(lim&&typeof lim.value==='number')meta.limit=lim.value;
    }
  }catch(e){}
  return meta;
}
function fsDiagBytesData(data){
  try{return JSON.stringify(data==null?{}:data).length;}catch(e){return 0;}
}
function fsDiagAviso(clave,msg){
  if(fsDiagAvisos[clave])return;
  fsDiagAvisos[clave]=true;
  const st=fsDiagEstado();
  st.avisos.push({t:new Date().toISOString(),msg:msg});
  if(st.avisos.length>80)st.avisos=st.avisos.slice(-80);
  try{console.warn('[sstDiagFs]',msg);}catch(e){}
}
function fsDiagArraysEnDoc(data,ruta){
  if(!data||typeof data!=='object')return;
  for(let i=0;i<FS_ARR_CAMPOS.length;i++){
    const k=FS_ARR_CAMPOS[i];
    const v=data[k];
    if(!Array.isArray(v)||v.length<30)continue;
    const b=fsDiagBytesData(v);
    if(v.length>=80||b>=20000){
      fsDiagAviso('arr:'+ruta+':'+k,'Arreglo grande '+k+' ('+v.length+' ítems, ~'+Math.round(b/1024)+' KB) en '+ruta);
    }
  }
  if(Array.isArray(data.tasks)){
    let hist=0;
    for(let t=0;t<data.tasks.length;t++){
      const tk=data.tasks[t];
      if(tk&&Array.isArray(tk.historial))hist+=tk.historial.length;
      if(tk&&Array.isArray(tk.comentarios))hist+=tk.comentarios.length;
    }
    if(hist>=80)fsDiagAviso('tasksHist:'+ruta,'tasks[] con ~'+hist+' historial/comentarios anidados en '+ruta);
  }
}
function fsDiagRegistrarTopDoc(ruta,bytes){
  if(!(bytes>8000))return;
  const st=fsDiagEstado();
  st.topDocs.push({ruta:ruta,bytes:bytes,t:Date.now()});
  st.topDocs.sort(function(a,b){return b.bytes-a.bytes;});
  const seen=Object.create(null),out=[];
  for(let i=0;i<st.topDocs.length&&out.length<15;i++){
    const d=st.topDocs[i];
    if(seen[d.ruta])continue;
    seen[d.ruta]=1;
    out.push(d);
  }
  st.topDocs=out;
}
function fsDiagPersist(){
  clearTimeout(fsDiagTimer);
  fsDiagTimer=setTimeout(function(){
    try{localStorage.setItem(FS_DIAG_KEY,JSON.stringify(fsDiagEstado()));}catch(e){}
  },2000);
}
function fsDiagSumar(tipo,ref,n,bytes,extras){
  if(!(n>0)&&!(bytes>0))return;
  const st=fsDiagEstado();
  const ruta=fsLectRuta(ref);
  const usuario=fsDiagUsuario();
  const modulo=(extras&&extras.modulo)||fsDiagModulo();
  const coleccion=fsDiagColeccion(ruta);
  const fase=(typeof document!=='undefined'&&document.body&&document.body.classList.contains('sesion-activa'))?'sesion':'pre-login';
  const k=[tipo,coleccion,ruta,modulo,usuario,fase].join('|');
  const r=st.por[k]||(st.por[k]={
    tipo:tipo,coleccion:coleccion,ruta:ruta,modulo:modulo,usuario:usuario,fase:fase,
    lecturas:0,veces:0,bytes:0
  });
  r.lecturas+=n|0;
  r.veces++;
  r.bytes+=bytes|0;
  st.lecturas+=n|0;
  st.bytes+=bytes|0;
  fsDiagPersist();
}
function fsLectSumar(tipo,ref,n){
  if(!(n>0))return;
  const st=fsLectEstado();
  const fase=(typeof document!=='undefined'&&document.body&&document.body.classList.contains('sesion-activa'))?'':' (antes de ingresar)';
  const k=tipo+' '+fsLectRuta(ref)+fase;
  const r=st.por[k]||(st.por[k]={lecturas:0,veces:0});
  r.lecturas+=n;
  r.veces++;
  st.total+=n;
  clearTimeout(fsLectTimer);
  fsLectTimer=setTimeout(function(){try{localStorage.setItem(FS_LECT_KEY,JSON.stringify(st));}catch(e){}},2000);
}
function fsDiagMedirSnapDocs(ref,snap,soloCambios){
  let n=0,bytes=0;
  const ruta=fsLectRuta(ref);
  try{
    if(soloCambios&&typeof snap.docChanges==='function'){
      const ch=snap.docChanges().filter(function(c){return !(c.doc&&c.doc.metadata&&c.doc.metadata.hasPendingWrites);});
      n=ch.length;
      for(let i=0;i<ch.length;i++){
        const data=ch[i].doc&&ch[i].doc.data?ch[i].doc.data():null;
        const b=fsDiagBytesData(data);
        bytes+=b;
        fsDiagArraysEnDoc(data,ruta);
        fsDiagRegistrarTopDoc(ruta+'#'+(ch[i].doc&&ch[i].doc.id),b);
      }
    }else if(snap&&snap.docs){
      n=snap.docs.length||snap.size||0;
      const tope=Math.min(n,40);
      let muestra=0;
      for(let i=0;i<tope;i++){
        const data=snap.docs[i].data?snap.docs[i].data():null;
        const b=fsDiagBytesData(data);
        muestra+=b;
        fsDiagArraysEnDoc(data,ruta);
        fsDiagRegistrarTopDoc(ruta+'#'+snap.docs[i].id,b);
      }
      bytes=n>tope&&tope?Math.round(muestra*(n/tope)):muestra;
    }else if(snap&&typeof snap.data==='function'){
      n=snap.exists&&snap.exists()?1:0;
      if(n){
        const data=snap.data();
        bytes=fsDiagBytesData(data);
        fsDiagArraysEnDoc(data,ruta);
        fsDiagRegistrarTopDoc(ruta,bytes);
      }
    }
  }catch(e){}
  return{n:n,bytes:bytes};
}
function fsDiagAvisarConsulta(tipo,ref){
  const meta=fsDiagQueryMeta(ref);
  if(meta.esDoc)return;
  const ruta=meta.path||fsLectRuta(ref);
  if(tipo==='onSnapshot'||tipo==='escucha'){
    const key='listen:'+ruta;
    fsDiagListenActivos[key]=(fsDiagListenActivos[key]|0)+1;
    if(fsDiagListenActivos[key]>=3){
      fsDiagAviso('resub:'+ruta,'Listener re-suscrito '+fsDiagListenActivos[key]+' veces en '+ruta+' (posible re-subscribe por render/init)');
    }
  }
  const sinFiltro=!meta.filtros;
  const sinLimit=!meta.limit;
  if(sinFiltro&&sinLimit&&/expedientes|mensajes|personas|usuarios|apoyo_uso|chat_drive/.test(ruta)){
    fsDiagAviso(tipo+':full:'+ruta,tipo+' SIN where/limit sobre '+ruta);
  }else if(sinLimit&&/expedientes|mensajes/.test(ruta)&&meta.filtros){
    fsDiagAviso(tipo+':nolimit:'+ruta,tipo+' con filtro pero SIN limit sobre '+ruta);
  }
}
function fsLectSnap(ref,snap){
  try{
    if(!snap||(snap.metadata&&snap.metadata.fromCache))return;
    const med=fsDiagMedirSnapDocs(ref,snap,typeof snap.docChanges==='function');
    if(typeof snap.docChanges==='function'){
      fsLectSumar('escucha',ref,med.n);
      fsDiagSumar('escucha',ref,med.n,med.bytes);
    }else if(!(snap.metadata&&snap.metadata.hasPendingWrites)){
      fsLectSumar('escucha',ref,1);
      fsDiagSumar('escucha',ref,med.n||1,med.bytes);
    }
  }catch(e){}
}
function fsDiagFmtBytes(n){
  n=Number(n)||0;
  if(n>=1048576)return(n/1048576).toFixed(2)+' MB';
  if(n>=1024)return(n/1024).toFixed(1)+' KB';
  return n+' B';
}
function fsDiagFilas(){
  const st=fsDiagEstado();
  return Object.keys(st.por).map(function(k){return st.por[k];});
}
window.sstLecturas=function(reiniciar){
  const st=fsLectEstado();
  if(reiniciar){
    fsLect={dia:fsLectHoy(),total:0,cargas:0,por:{}};
    fsDiag={dia:fsLectHoy(),lecturas:0,bytes:0,por:{},avisos:[],topDocs:[]};
    try{localStorage.removeItem(FS_LECT_KEY);localStorage.removeItem(FS_DIAG_KEY);}catch(e){}
    return'Medidor reiniciado';
  }
  const filas=Object.keys(st.por).map(function(k){return{fuente:k,lecturas:st.por[k].lecturas,veces:st.por[k].veces};})
    .sort(function(a,b){return b.lecturas-a.lecturas;});
  console.table(filas);
  return'Día '+st.dia+': '+st.total+' lecturas en este navegador, '+st.cargas+' apertura(s) de la página. Use sstDiagFs() para bytes/módulo/top10.';
};
window.sstDiagFs=function(reiniciar){
  if(reiniciar)return window.sstLecturas(true);
  const st=fsDiagEstado();
  const filas=fsDiagFilas();
  const topLect=filas.slice().sort(function(a,b){return b.lecturas-a.lecturas;}).slice(0,10).map(function(r){
    return{lecturas:r.lecturas,bytes:fsDiagFmtBytes(r.bytes),veces:r.veces,tipo:r.tipo,coleccion:r.coleccion,modulo:r.modulo,usuario:r.usuario,ruta:r.ruta};
  });
  const topBytes=filas.slice().sort(function(a,b){return b.bytes-a.bytes;}).slice(0,10).map(function(r){
    return{bytes:fsDiagFmtBytes(r.bytes),lecturas:r.lecturas,veces:r.veces,tipo:r.tipo,coleccion:r.coleccion,modulo:r.modulo,usuario:r.usuario,ruta:r.ruta};
  });
  const porUsuario={};
  filas.forEach(function(r){
    const u=r.usuario||'?';
    const x=porUsuario[u]||(porUsuario[u]={usuario:u,lecturas:0,bytes:0});
    x.lecturas+=r.lecturas;x.bytes+=r.bytes;
  });
  console.log('%c[sstDiagFs] Día '+st.dia+' · '+st.lecturas+' docs · '+fsDiagFmtBytes(st.bytes)+' (aprox JSON) — no escribe en Firestore','color:#0f766e;font-weight:bold');
  console.log('Top 10 por lecturas');
  console.table(topLect);
  console.log('Top 10 por bytes');
  console.table(topBytes);
  console.log('Por usuario');
  console.table(Object.keys(porUsuario).map(function(k){return{usuario:k,lecturas:porUsuario[k].lecturas,bytes:fsDiagFmtBytes(porUsuario[k].bytes)};}).sort(function(a,b){return b.lecturas-a.lecturas;}));
  if(st.topDocs.length){
    console.log('Documentos más pesados vistos');
    console.table(st.topDocs.map(function(d){return{ruta:d.ruta,bytes:fsDiagFmtBytes(d.bytes)};}));
  }
  if(st.avisos.length){
    console.log('Avisos (sin where/limit, arreglos grandes, re-subscribe)');
    console.table(st.avisos.slice(-30).map(function(a){return{cuando:a.t,aviso:a.msg};}));
  }else{
    console.log('Sin avisos aún en esta sesión.');
  }
  return{
    dia:st.dia,
    lecturas:st.lecturas,
    bytes:st.bytes,
    bytesFmt:fsDiagFmtBytes(st.bytes),
    topLecturas:topLect,
    topBytes:topBytes,
    avisos:st.avisos.slice(),
    nota:'Solo consola/localStorage. Bytes ≈ JSON.stringify del doc (aprox).'
  };
};
fsLectEstado().cargas++;
fsDiagEstado();
const db=getFirestore(app);
const auth=getAuth(app);
window._db=db;
window._firebaseAuth=auth;
window._firebaseFunctions=getFunctions(app,'us-central1');
window._httpsCallable=httpsCallable;
window._fsDoc=doc;
window._fsGetDoc=function(ref){
  const modulo=fsDiagModulo();
  return getDoc.apply(null,arguments).then(function(s){
    if(!(s&&s.metadata&&s.metadata.fromCache)){
      fsLectSumar('getDoc',ref,1);
      const med=fsDiagMedirSnapDocs(ref,s,false);
      fsDiagSumar('getDoc',ref,1,med.bytes,{modulo:modulo});
    }
    return s;
  });
};
window._fsSetDoc=vigilarEscritura(setDoc);
window._fsUpdateDoc=vigilarEscritura(updateDoc);
window._fsAddDoc=vigilarEscritura(addDoc);
/** Contador atómico: suma sin pisar el valor remoto (medidor apoyo / acumulados). */
window._fsIncrement=increment;
window._fsOnSnapshot=function(ref,cb){
  fsDiagAvisarConsulta('onSnapshot',ref);
  if(typeof cb!=='function')return onSnapshot.apply(null,arguments);
  const args=Array.prototype.slice.call(arguments);
  const modulo=fsDiagModulo();
  args[1]=function(snap){
    try{
      if(!(snap&&snap.metadata&&snap.metadata.fromCache)){
        const med=fsDiagMedirSnapDocs(ref,snap,typeof snap.docChanges==='function');
        if(typeof snap.docChanges==='function'){
          fsLectSumar('escucha',ref,med.n);
          fsDiagSumar('escucha',ref,med.n,med.bytes,{modulo:modulo});
        }else if(!(snap.metadata&&snap.metadata.hasPendingWrites)){
          fsLectSumar('escucha',ref,1);
          fsDiagSumar('escucha',ref,med.n||1,med.bytes,{modulo:modulo});
        }
      }
    }catch(e){}
    return cb.apply(this,arguments);
  };
  return onSnapshot.apply(null,args);
};
window._fsCollection=collection;
window._fsCollectionGroup=collectionGroup;
window._fsQuery=query;
window._fsWhere=where;
window._fsOrderBy=orderBy;
window._fsLimit=limit;
window._fsGetDocs=function(ref){
  fsDiagAvisarConsulta('getDocs',ref);
  const modulo=fsDiagModulo();
  return getDocs.apply(null,arguments).then(function(s){
    if(!(s&&s.metadata&&s.metadata.fromCache)){
      const med=fsDiagMedirSnapDocs(ref,s,false);
      const n=Math.max(1,med.n||(s&&s.size)||0);
      fsLectSumar('getDocs',ref,n);
      fsDiagSumar('getDocs',ref,n,med.bytes,{modulo:modulo});
    }
    return s;
  });
};
window._fsDeleteDoc=vigilarEscritura(deleteDoc);
window._fsDeleteField=deleteField;
window._fsArrayUnion=arrayUnion;
window._fsArrayRemove=arrayRemove;
window._fsRunTransaction=runTransaction;
window._googleProvider=new GoogleAuthProvider();
// Force account picker every time so users can switch accounts after logout
window._googleProvider.setCustomParameters({prompt:'select_account'});
window._authSignInGoogle=()=>signInWithPopup(auth,window._googleProvider);
// La ventanita de Firebase se cierra al elegir la cuenta y no devuelve la sesión.
// El aviso de Google del correo sí la devuelve: con ese token se registra en Auth.
window._authSignInWithAccessToken=(accessToken)=>signInWithCredential(auth,GoogleAuthProvider.credential(null,accessToken));
window._authSignOut=()=>signOut(auth);
window._authOnStateChanged=onAuthStateChanged;
window._firebaseReady=true;
window.dispatchEvent(new Event('firebase-ready'));
// OAuth 2.0 Client ID para Gmail API (Google Cloud Console → APIs → Credenciales → ID de cliente web)
// Formato: XXXXXXXXXX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
window._gmailClientId='215089141263-gl6q8pkgkr7ul5epq75nbepjp60jseh0.apps.googleusercontent.com';
