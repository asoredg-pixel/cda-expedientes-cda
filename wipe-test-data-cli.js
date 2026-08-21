#!/usr/bin/env node
/**
 * Completa la limpieza operativa vía Firebase CLI auth (sin service account).
 * Conserva usuarios, cfg, encargados, recursos/biblioteca (sin vínculos).
 *
 * Uso: node wipe-test-data-cli.js
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const PROJECT_ID = 'cda-tramites';
const DEPTOS = ['guaviare', 'guainia', 'vaupes'];

function findFirebaseTools() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'firebase-tools'),
    path.join(process.cwd(), 'node_modules', 'firebase-tools'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json'))) return c;
  }
  return null;
}

async function getAccessToken() {
  // Prefer gcloud ADC if present (not expected)
  try {
    const req = createRequire(import.meta.url);
    const { GoogleAuth } = req('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore'],
    });
    const client = await auth.getClient();
    const tok = await client.getAccessToken();
    if (tok && tok.token) return tok.token;
  } catch (_) {}

  // firebase-tools logged-in user
  const toolsPath = findFirebaseTools();
  if (!toolsPath) throw new Error('No se encontró firebase-tools ni ADC');
  const req = createRequire(path.join(toolsPath, 'package.json'));
  // firebase-tools v13+ auth helpers
  let token = null;
  try {
    const auth = req('./lib/auth');
    if (typeof auth.getAccessToken === 'function') {
      token = await auth.getAccessToken(true, []);
    } else if (auth.loggedIn && typeof auth.loggedIn === 'function') {
      const user = auth.loggedIn();
      if (user && user.tokens && user.tokens.access_token) token = user.tokens.access_token;
    }
  } catch (e) {
    // fallback configstore
  }
  if (!token) {
    try {
      const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
      const alt = path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json');
      const p = fs.existsSync(configPath) ? configPath : (fs.existsSync(alt) ? alt : null);
      if (!p) throw new Error('Sin config de firebase-tools');
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      const tokens = (cfg.tokens || cfg.user && cfg.user.tokens) || {};
      token = tokens.access_token || null;
      if (!token && tokens.refresh_token) {
        // refresh via google-auth if available in firebase-tools deps
        const { GoogleToken } = req('gtoken');
        // skip complex refresh — use firebase CLI to force refresh by calling a lightweight command
      }
    } catch (e) {
      throw new Error('No se pudo obtener token de Firebase CLI: ' + e.message);
    }
  }
  if (!token) {
    // Force refresh by invoking firebase (side-effect updates tokens file)
    spawnSync('firebase', ['projects:list', '--project', PROJECT_ID], { stdio: 'ignore', shell: true });
    const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    const alt = path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json');
    const p = fs.existsSync(configPath) ? configPath : (fs.existsSync(alt) ? alt : null);
    if (p) {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      token = (cfg.tokens && cfg.tokens.access_token) || null;
    }
  }
  if (!token) throw new Error('Token de acceso no disponible. Ejecute: firebase login');
  return token;
}

async function fsGet(token, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('GET ' + docPath + ' → ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function fsPatch(token, docPath, fields, maskFields) {
  const qs = maskFields.map((f) => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${qs}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error('PATCH ' + docPath + ' → ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

function emptyArrayValue() {
  return { arrayValue: { values: [] } };
}

function cloneFirestoreValue(v) {
  return JSON.parse(JSON.stringify(v));
}

function stripVinculadosFromBiblioteca(fields) {
  const arr = fields && fields.bibliotecaRepos && fields.bibliotecaRepos.arrayValue
    ? (fields.bibliotecaRepos.arrayValue.values || [])
    : [];
  const cleaned = arr.map((item) => {
    if (!item.mapValue || !item.mapValue.fields) return item;
    const f = Object.assign({}, item.mapValue.fields);
    f.vinculados = emptyArrayValue();
    return { mapValue: { fields: f } };
  });
  return { arrayValue: { values: cleaned } };
}

async function main() {
  console.log('Obteniendo acceso Firebase CLI…');
  const token = await getAccessToken();
  console.log('OK (token no se muestra)\n');

  // Contar expedientes residuales
  for (const depto of DEPTOS) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/departamentos/${depto}/expedientes?pageSize=1`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) {
      console.log(`expedientes/${depto}: status ${res.status}`);
      continue;
    }
    const data = await res.json();
    const n = (data.documents || []).length;
    console.log(`expedientes/${depto}: ${n === 0 ? 'vacío' : 'aún hay documentos (página muestra ' + n + '+' + (data.nextPageToken ? '+' : '') + ')'}`);
  }

  const chatsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats?pageSize=1`;
  const chatsRes = await fetch(chatsUrl, { headers: { Authorization: 'Bearer ' + token } });
  if (chatsRes.ok) {
    const d = await chatsRes.json();
    console.log(`chats: ${(d.documents || []).length === 0 ? 'vacío' : 'aún hay conversaciones'}`);
  }

  // Limpiar sistema/global
  const globalDoc = await fsGet(token, 'sistema/global');
  if (!globalDoc || !globalDoc.fields) {
    console.log('sistema/global: no existe');
  } else {
    const f = globalDoc.fields;
    const patch = {
      actividadesLibres: emptyArrayValue(),
      agendaEventos: emptyArrayValue(),
      personas: emptyArrayValue(),
      bandejaLeidos: emptyArrayValue(),
      bandejaEliminados: emptyArrayValue(),
      bibliotecaRepos: stripVinculadosFromBiblioteca(f),
    };
    // Conservar: encargadosGlobal, usuariosIndex, recursos*, mantenimiento, cfg-like fields
    await fsPatch(token, 'sistema/global', patch, Object.keys(patch));
    const uIdx = f.usuariosIndex && f.usuariosIndex.arrayValue ? (f.usuariosIndex.arrayValue.values || []).length : 0;
    console.log(`sistema/global: limpio (usuariosIndex conservado ≈ ${uIdx})`);
  }

  // Limpiar actividadesLibres embebidas en departamentos/{id}
  for (const depto of DEPTOS) {
    const doc = await fsGet(token, `departamentos/${depto}`);
    if (!doc) {
      console.log(`departamentos/${depto}: no existe`);
      continue;
    }
    const patch = {
      actividadesLibres: emptyArrayValue(),
    };
    // limpiar arrays legacy si existen
    if (doc.fields && doc.fields.expedientes) patch.expedientes = emptyArrayValue();
    if (doc.fields && doc.fields.pqrsd) patch.pqrsd = emptyArrayValue();
    await fsPatch(token, `departamentos/${depto}`, patch, Object.keys(patch));
    const hasCfg = !!(doc.fields && doc.fields.cfg);
    console.log(`departamentos/${depto}: actividadesLibres=[] (cfg ${hasCfg ? 'conservada' : 'ausente'})`);
  }

  console.log('\nListo. Usuarios/roles/cfg no se modificaron.');
  console.log('Drive: no se borró automáticamente; limpie carpetas de prueba en Drive si aún quedan.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
