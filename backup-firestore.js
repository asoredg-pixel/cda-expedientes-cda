#!/usr/bin/env node
/**
 * Respaldo de Firestore (Admin SDK) — proyecto cda-tramites
 * Colecciones: usuarios, sistema/global, departamentos
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de cuenta de servicio.
 */
const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cda-tramites';
const BACKUPS_DIR = path.join(__dirname, 'backups');

function timestampLabel(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    p(date.getMonth() + 1),
    p(date.getDate()),
  ].join('-') + '_' + [p(date.getHours()), p(date.getMinutes()), p(date.getSeconds())].join('');
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) {
    return {
      __type: 'Timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'DocumentReference', path: value.path };
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'GeoPoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

function docSnapshotToJson(doc) {
  return {
    id: doc.id,
    path: doc.ref.path,
    ...serializeValue(doc.data()),
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function exportCollection(db, collectionPath) {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.map(docSnapshotToJson);
}

async function exportDocument(db, docPath) {
  const snap = await db.doc(docPath).get();
  if (!snap.exists) return null;
  return docSnapshotToJson(snap);
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Error: defina GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON de cuenta de servicio.');
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const ts = timestampLabel();
  await fs.mkdir(BACKUPS_DIR, { recursive: true });

  const summary = [];

  // usuarios/{email}
  const usuarios = await exportCollection(db, 'usuarios');
  const usuariosFile = path.join(BACKUPS_DIR, `${ts}_usuarios.json`);
  await writeJson(usuariosFile, {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    collection: 'usuarios',
    count: usuarios.length,
    documents: usuarios,
  });
  summary.push({ collection: 'usuarios', count: usuarios.length, file: usuariosFile });

  // sistema/global
  const globalDoc = await exportDocument(db, 'sistema/global');
  const sistemaFile = path.join(BACKUPS_DIR, `${ts}_sistema.json`);
  await writeJson(sistemaFile, {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    collection: 'sistema',
    documentId: 'global',
    count: globalDoc ? 1 : 0,
    document: globalDoc,
  });
  summary.push({ collection: 'sistema/global', count: globalDoc ? 1 : 0, file: sistemaFile });

  // departamentos/{deptoId} — todos los documentos existentes
  const departamentos = await exportCollection(db, 'departamentos');
  const departamentosFile = path.join(BACKUPS_DIR, `${ts}_departamentos.json`);
  await writeJson(departamentosFile, {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    collection: 'departamentos',
    count: departamentos.length,
    documents: departamentos,
  });
  summary.push({ collection: 'departamentos', count: departamentos.length, file: departamentosFile });

  console.log('\nRespaldo Firestore completado (' + PROJECT_ID + ')\n');
  for (const row of summary) {
    console.log('  ' + row.collection + ': ' + row.count + ' documento(s) → ' + path.basename(row.file));
  }
  console.log('\nTotal: ' + summary.reduce((s, r) => s + r.count, 0) + ' documento(s)\n');
}

main().catch((err) => {
  console.error('Error en backup-firestore:', err);
  process.exit(1);
});
