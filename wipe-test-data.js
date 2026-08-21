#!/usr/bin/env node
/**
 * Limpieza de datos de prueba → producción (cda-tramites)
 *
 * BORRA:
 *  - departamentos/{depto}/expedientes/*  (trámites + PQRSD)
 *  - actividadesLibres (global + por departamento)
 *  - agendaEventos
 *  - personas (catálogo derivado de registros)
 *  - chats/{convId}/mensajes/* y docs de conversación
 *  - chat_drive_purge/*
 *  - bandejaLeidos / bandejaEliminados
 *  - vinculados de bibliotecaRepos (mantiene los temas/carpetas)
 *
 * CONSERVA:
 *  - usuarios/*
 *  - cfg por departamento (trámites, listas, instructores…)
 *  - encargadosGlobal / usuariosIndex
 *  - recursosEnlaces, bibliotecaRepos (sin vínculos), recursosConfig
 *  - mantenimiento, IDs de matriz PQRSD
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS (cuenta de servicio).
 * Uso: node wipe-test-data.js --confirm
 */
const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cda-tramites';
const DEPTOS = ['guaviare', 'guainia', 'vaupes'];
const CONFIRM = process.argv.includes('--confirm');
const DRY = process.argv.includes('--dry-run') || !CONFIRM;

async function deleteQueryBatch(db, query, label) {
  const snap = await query.get();
  if (!snap.size) {
    console.log(`  ${label}: 0`);
    return 0;
  }
  let n = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    if (!DRY) {
      const batch = db.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    n += chunk.length;
  }
  console.log(`  ${label}: ${n}${DRY ? ' (dry-run)' : ''}`);
  return n;
}

async function deleteCollection(db, collectionPath) {
  return deleteQueryBatch(db, db.collection(collectionPath), collectionPath);
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Error: defina GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON de cuenta de servicio.');
    process.exit(1);
  }
  if (!CONFIRM) {
    console.log('Modo dry-run (sin borrar). Para ejecutar: node wipe-test-data.js --confirm\n');
  } else {
    console.log('CONFIRMACIÓN: borrando datos de prueba…\n');
  }

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  let total = 0;

  // 1) Expedientes / PQRSD por departamento
  for (const depto of DEPTOS) {
    total += await deleteCollection(db, `departamentos/${depto}/expedientes`);
  }

  // 2) Chats
  const chatsSnap = await db.collection('chats').get();
  console.log(`  chats (conversaciones): ${chatsSnap.size}${DRY ? ' (dry-run)' : ''}`);
  for (const conv of chatsSnap.docs) {
    total += await deleteCollection(db, `chats/${conv.id}/mensajes`);
    if (!DRY) await conv.ref.delete();
    total += 1;
  }

  // 3) cola de purga Drive del chat
  total += await deleteCollection(db, 'chat_drive_purge');

  // 4) sistema/global — limpiar campos operativos, conservar config/usuarios
  const globalRef = db.doc('sistema/global');
  const globalSnap = await globalRef.get();
  if (globalSnap.exists) {
    const g = globalSnap.data() || {};
    const keep = {
      encargadosGlobal: g.encargadosGlobal || {},
      usuariosIndex: Array.isArray(g.usuariosIndex) ? g.usuariosIndex : [],
      recursosEnlaces: Array.isArray(g.recursosEnlaces) ? g.recursosEnlaces : [],
      recursosConfig: g.recursosConfig && typeof g.recursosConfig === 'object' ? g.recursosConfig : {},
      mantenimiento: g.mantenimiento || { activo: false },
      // conservar IDs de matriz si existen
      pqrsMatrizSheetId: g.pqrsMatrizSheetId || null,
      pqrsMatrizXlsxFileId: g.pqrsMatrizXlsxFileId || null,
      // actividades / agenda / personas / bandeja vacíos
      actividadesLibres: [],
      agendaEventos: [],
      personas: [],
      bandejaLeidos: [],
      bandejaEliminados: [],
      // biblioteca: mismos repos, sin casos vinculados
      bibliotecaRepos: Array.isArray(g.bibliotecaRepos)
        ? g.bibliotecaRepos.map((r) => Object.assign({}, r, { vinculados: [] }))
        : [],
    };
    // copiar otros campos de config conocidos si existen
    ['pqrsMatrizSheetUrl', 'pqrsMatrizLastSync'].forEach((k) => {
      if (g[k] != null) keep[k] = g[k];
    });
    if (!DRY) {
      await globalRef.set(keep, { merge: false });
    }
    console.log(`  sistema/global: limpio (conserva usuariosIndex=${(keep.usuariosIndex || []).length}, repos bib=${(keep.bibliotecaRepos || []).length})${DRY ? ' (dry-run)' : ''}`);
    total += 1;
  } else {
    console.log('  sistema/global: no existe');
  }

  // 5) departamentos/{id} — vaciar actividadesLibres, conservar cfg
  for (const depto of DEPTOS) {
    const ref = db.doc(`departamentos/${depto}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  departamentos/${depto}: no existe`);
      continue;
    }
    const data = snap.data() || {};
    const next = Object.assign({}, data, { actividadesLibres: [] });
    // por si quedó array legacy de expedientes embebidos
    if (Array.isArray(next.expedientes)) next.expedientes = [];
    if (Array.isArray(next.pqrsd)) next.pqrsd = [];
    if (!DRY) await ref.set(next, { merge: false });
    console.log(`  departamentos/${depto}: cfg conservada, actividadesLibres=[]${DRY ? ' (dry-run)' : ''}`);
    total += 1;
  }

  console.log(`\nListo. Documentos afectados (aprox): ${total}`);
  console.log('NO se tocaron: usuarios/*, roles embebidos en cfg, encargados.');
  console.log('NOTA: archivos en Google Drive NO se borran con este script (hay que limpiarlos en Drive o desde la app con correo conectado).');
  if (DRY) console.log('\nDry-run finalizado. Ejecute con --confirm para borrar de verdad.');
}

main().catch((err) => {
  console.error('Error wipe-test-data:', err);
  process.exit(1);
});
