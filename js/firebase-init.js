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
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,onSnapshot,getDocs,collection,deleteDoc,deleteField,arrayUnion,arrayRemove}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const auth=getAuth(app);
window._db=db;
window._firebaseAuth=auth;
window._fsDoc=doc;
window._fsGetDoc=getDoc;
window._fsSetDoc=setDoc;
window._fsUpdateDoc=updateDoc;
window._fsAddDoc=addDoc;
window._fsOnSnapshot=onSnapshot;
window._fsCollection=collection;
window._fsGetDocs=getDocs;
window._fsDeleteDoc=deleteDoc;
window._fsDeleteField=deleteField;
window._fsArrayUnion=arrayUnion;
window._fsArrayRemove=arrayRemove;
window._googleProvider=new GoogleAuthProvider();
window._authSignInGoogle=()=>signInWithPopup(auth,window._googleProvider);
window._authSignOut=()=>signOut(auth);
window._authOnStateChanged=onAuthStateChanged;
window._firebaseReady=true;
window.dispatchEvent(new Event('firebase-ready'));
// OAuth 2.0 Client ID para Gmail API (Google Cloud Console → APIs → Credenciales → ID de cliente web)
// Formato: XXXXXXXXXX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
window._gmailClientId='215089141263-gl6q8pkgkr7ul5epq75nbepjp60jseh0.apps.googleusercontent.com';
