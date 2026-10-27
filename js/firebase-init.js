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
import{getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,onSnapshot,getDocs,collection,collectionGroup,query,where,deleteDoc,deleteField,arrayUnion,arrayRemove,runTransaction}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithCredential,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
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
// Medidor de lecturas: documentos entregados por fuente, acumulados en el día aunque se recargue.
// Consola: sstLecturas() muestra el desglose; sstLecturas(true) lo reinicia.
const FS_LECT_KEY='sst_fs_lecturas';
let fsLect=null;
let fsLectTimer=null;
function fsLectHoy(){return new Date().toLocaleDateString('en-CA');}
function fsLectEstado(){
  const hoy=fsLectHoy();
  if(fsLect&&fsLect.dia===hoy)return fsLect;
  try{fsLect=JSON.parse(localStorage.getItem(FS_LECT_KEY)||'null');}catch(e){fsLect=null;}
  if(!fsLect||fsLect.dia!==hoy||!fsLect.por)fsLect={dia:hoy,total:0,cargas:0,por:{}};
  return fsLect;
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
function fsLectSnap(ref,snap){
  try{
    if(!snap||(snap.metadata&&snap.metadata.fromCache))return;
    if(typeof snap.docChanges==='function'){
      fsLectSumar('escucha',ref,snap.docChanges().filter(function(c){return !(c.doc&&c.doc.metadata&&c.doc.metadata.hasPendingWrites);}).length);
    }else if(!(snap.metadata&&snap.metadata.hasPendingWrites)){
      fsLectSumar('escucha',ref,1);
    }
  }catch(e){}
}
window.sstLecturas=function(reiniciar){
  const st=fsLectEstado();
  if(reiniciar){fsLect={dia:fsLectHoy(),total:0,cargas:0,por:{}};try{localStorage.removeItem(FS_LECT_KEY);}catch(e){}return'Medidor reiniciado';}
  const filas=Object.keys(st.por).map(function(k){return{fuente:k,lecturas:st.por[k].lecturas,veces:st.por[k].veces};})
    .sort(function(a,b){return b.lecturas-a.lecturas;});
  console.table(filas);
  return'Día '+st.dia+': '+st.total+' lecturas en este navegador, '+st.cargas+' apertura(s) de la página';
};
fsLectEstado().cargas++;
const db=getFirestore(app);
const auth=getAuth(app);
window._db=db;
window._firebaseAuth=auth;
window._fsDoc=doc;
window._fsGetDoc=function(ref){
  return getDoc.apply(null,arguments).then(function(s){
    if(!(s&&s.metadata&&s.metadata.fromCache))fsLectSumar('getDoc',ref,1);
    return s;
  });
};
window._fsSetDoc=vigilarEscritura(setDoc);
window._fsUpdateDoc=vigilarEscritura(updateDoc);
window._fsAddDoc=vigilarEscritura(addDoc);
window._fsOnSnapshot=function(ref,cb){
  if(typeof cb!=='function')return onSnapshot.apply(null,arguments);
  const args=Array.prototype.slice.call(arguments);
  args[1]=function(snap){fsLectSnap(ref,snap);return cb.apply(this,arguments);};
  return onSnapshot.apply(null,args);
};
window._fsCollection=collection;
window._fsCollectionGroup=collectionGroup;
window._fsQuery=query;
window._fsWhere=where;
window._fsGetDocs=function(ref){
  return getDocs.apply(null,arguments).then(function(s){
    if(!(s&&s.metadata&&s.metadata.fromCache))fsLectSumar('getDocs',ref,Math.max(1,(s&&s.size)||0));
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
