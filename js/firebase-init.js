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
const db=getFirestore(app);
const auth=getAuth(app);
window._db=db;
window._firebaseAuth=auth;
window._fsDoc=doc;
window._fsGetDoc=getDoc;
window._fsSetDoc=vigilarEscritura(setDoc);
window._fsUpdateDoc=vigilarEscritura(updateDoc);
window._fsAddDoc=vigilarEscritura(addDoc);
window._fsOnSnapshot=onSnapshot;
window._fsCollection=collection;
window._fsCollectionGroup=collectionGroup;
window._fsQuery=query;
window._fsWhere=where;
window._fsGetDocs=getDocs;
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
