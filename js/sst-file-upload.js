// =============================================================================
// sst-file-upload.js — Carga a Drive con barra, vista previa y eliminación
// =============================================================================

window._sstFileStaging = window._sstFileStaging || {};

function sstFileStagingCtx(key) {
  key = String(key || 'default').trim() || 'default';
  if (!window._sstFileStaging[key]) {
    window._sstFileStaging[key] = { main: null, anexos: [] };
  }
  return window._sstFileStaging[key];
}

function sstFileStagingReset(key) {
  const ctx = key ? window._sstFileStaging[key] : null;
  if (ctx) {
    [ctx.main].concat(ctx.anexos || []).filter(Boolean).forEach(function (it) {
      if (it.blobUrl) try { URL.revokeObjectURL(it.blobUrl); } catch (e) {}
    });
    delete window._sstFileStaging[key];
    return;
  }
  Object.keys(window._sstFileStaging).forEach(function (k) { sstFileStagingReset(k); });
}

function sstFileNewItem(file, opts) {
  opts = opts || {};
  const blobUrl = (file && typeof URL !== 'undefined' && URL.createObjectURL)
    ? URL.createObjectURL(file)
    : '';
  return {
    id: 'sf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    nombre: file ? (file.name || 'archivo') : '',
    blob: file || null,
    blobUrl: blobUrl,
    tipo: file ? (file.type || '') : '',
    esAnexo: !!opts.esAnexo,
    state: 'local',
    pct: 0,
    driveFileId: '',
    driveLink: '',
    previewLink: '',
    driveFilename: '',
    error: ''
  };
}

function sstFileListEl(listId) {
  return listId ? document.getElementById(listId) : null;
}

function sstFileRenderList(listId, ctxKey) {
  const el = sstFileListEl(listId);
  if (!el) return;
  const ctx = sstFileStagingCtx(ctxKey);
  const items = [];
  if (ctx.main) items.push(ctx.main);
  (ctx.anexos || []).forEach(function (a) { items.push(a); });
  if (!items.length) {
    el.innerHTML = '<div class="sst-file-empty">Sin archivo seleccionado</div>';
    return;
  }
  el.innerHTML = items.map(function (it) {
    const st = it.state || 'local';
    const canPreview = !!(it.blobUrl || it.previewLink || it.driveLink);
    const prog = (st === 'uploading')
      ? ('<div class="sst-file-prog"><div class="sst-file-prog-fill" style="width:' + Math.max(4, it.pct || 0) + '%"></div></div>' +
        '<div class="sst-file-prog-txt">' + escAttr(it.pct != null ? (it.pct + '%') : '…') + ' · Subiendo a Drive…</div>')
      : (st === 'error'
        ? ('<div class="sst-file-err">' + escAttr(it.error || 'Error al subir') + '</div>')
        : (st === 'uploaded'
          ? '<div class="sst-file-ok">✓ En Drive</div>'
          : '<div class="sst-file-local">Se subirá al confirmar</div>'));
    return '<div class="sst-file-chip' + (st === 'error' ? ' is-err' : '') + '" data-sst-file-id="' + escAttr(it.id) + '">' +
      '<button type="button" class="sst-file-chip-name' + (canPreview ? ' can-preview' : '') + '" ' +
      (canPreview ? ('onclick="sstFilePreview(\'' + jsStr(ctxKey) + '\',\'' + jsStr(it.id) + '\')" title="Ver documento"') : '') + '>' +
      '📎 ' + escAttr(it.nombre) + '</button>' +
      prog +
      '<button type="button" class="sst-file-chip-del" onclick="sstFileRemove(\'' + jsStr(ctxKey) + '\',\'' + jsStr(it.id) + '\',\'' + jsStr(listId) + '\')" title="Quitar archivo">🗑️</button>' +
      '</div>';
  }).join('');
}

function sstFileFindItem(ctx, itemId) {
  if (!ctx) return null;
  if (ctx.main && ctx.main.id === itemId) return { item: ctx.main, slot: 'main', idx: -1 };
  const idx = (ctx.anexos || []).findIndex(function (a) { return a && a.id === itemId; });
  if (idx >= 0) return { item: ctx.anexos[idx], slot: 'anexos', idx: idx };
  return null;
}

function sstFilePreview(ctxKey, itemId) {
  const ctx = sstFileStagingCtx(ctxKey);
  const hit = sstFileFindItem(ctx, itemId);
  if (!hit || !hit.item) return;
  const it = hit.item;
  const url = it.previewLink || it.driveLink || it.blobUrl;
  if (!url) return;
  if ((it.previewLink || it.driveLink) && typeof openPqrsDocViewer === 'function') {
    openPqrsDocViewer(it.previewLink || it.driveLink, it.nombre || 'Documento');
    return;
  }
  if (it.blobUrl && typeof openCiudadanoDocViewer === 'function') {
    openCiudadanoDocViewer(it.blobUrl, it.nombre || 'Vista previa', it.blobUrl);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

async function sstFileRemove(ctxKey, itemId, listId) {
  const ctx = sstFileStagingCtx(ctxKey);
  const hit = sstFileFindItem(ctx, itemId);
  if (!hit || !hit.item) return;
  const it = hit.item;
  if (it.driveFileId && typeof driveDeleteInstitutional === 'function') {
    try { await driveDeleteInstitutional(it.driveFileId); } catch (err) {
      console.warn('sstFileRemove drive:', err);
      if (typeof notif === 'function') notif('No se pudo eliminar del Drive', 'warn');
    }
  }
  if (it.blobUrl) try { URL.revokeObjectURL(it.blobUrl); } catch (e) {}
  if (hit.slot === 'main') ctx.main = null;
  else if (hit.idx >= 0) ctx.anexos.splice(hit.idx, 1);
  const inpMain = document.getElementById('enviar-adj-file');
  const inpAnex = document.getElementById('enviar-anexos-file');
  if (hit.slot === 'main' && inpMain) inpMain.value = '';
  if (hit.slot === 'anexos' && inpAnex) inpAnex.value = '';
  sstFileRenderList(listId, ctxKey);
}

async function sstFileUploadItem(it, uploadCtx, onPct) {
  if (!it || !it.blob) return null;
  const f = it.blob;
  const nombre = it.nombre || f.name || 'archivo';
  const tipo = it.tipo || f.type || '';
  const rep = (typeof responsableActivo !== 'undefined' && responsableActivo)
    || (typeof taskComentarioAutor === 'function' ? taskComentarioAutor() : '');
  if (onPct) onPct(8);
  if (uploadCtx.esPqrs && typeof driveUploadPqrsExpediente === 'function') {
    const up = await driveUploadPqrsExpediente(f, nombre, tipo, uploadCtx.e, {
      label: it.esAnexo ? 'Anexo' : 'Respuesta',
      uploadTarget: 'respuesta',
      driveName: undefined
    });
    if (onPct) onPct(100);
    return up;
  }
  const eDrive = uploadCtx.eDrive || uploadCtx.e;
  if (eDrive && typeof driveUploadExpedienteActividad === 'function') {
    const up = await driveUploadExpedienteActividad(f, nombre, tipo, eDrive, uploadCtx.t, rep, 'revision');
    if (onPct) onPct(100);
    return up;
  }
  throw new Error('No hay contexto de expediente para subir el archivo');
}

async function sstFileTryUpload(ctxKey, listId, getUploadCtx) {
  const ctx = sstFileStagingCtx(ctxKey);
  const uploadCtx = typeof getUploadCtx === 'function' ? getUploadCtx() : null;
  if (!uploadCtx) return;
  const items = [];
  if (ctx.main) items.push(ctx.main);
  (ctx.anexos || []).forEach(function (a) { items.push(a); });
  const okAuth = typeof sstSolicitarGmailParaAdjuntar === 'function'
    ? await sstSolicitarGmailParaAdjuntar()
    : true;
  if (!okAuth) return;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || it.state === 'uploaded' || !it.blob) continue;
    it.state = 'uploading';
    it.pct = 0;
    sstFileRenderList(listId, ctxKey);
    try {
      const up = await sstFileUploadItem(it, uploadCtx, function (p) {
        it.pct = p;
        sstFileRenderList(listId, ctxKey);
      });
      if (up) {
        it.driveFileId = up.driveFileId || up.fileId || '';
        it.driveLink = up.driveLink || '';
        it.previewLink = up.previewLink || up.driveLink || '';
        it.driveFilename = up.driveFilename || up.nombre || it.nombre;
        it.state = 'uploaded';
        it.pct = 100;
        it.uploaded = up;
      }
    } catch (err) {
      it.state = 'error';
      it.error = (err && err.message) ? err.message : 'Error al subir';
      if (typeof notif === 'function') notif('No se pudo subir «' + it.nombre + '»', 'err');
    }
    sstFileRenderList(listId, ctxKey);
  }
}

function sstFileOnMainPick(inputEl, opts) {
  opts = opts || {};
  const ctxKey = opts.ctxKey || 'entrega';
  const listId = opts.listId || 'entrega-resp-file-list';
  const f = inputEl && inputEl.files && inputEl.files[0];
  const ctx = sstFileStagingCtx(ctxKey);
  if (ctx.main) {
    const old = ctx.main;
    if (old.driveFileId && typeof driveDeleteInstitutional === 'function') {
      driveDeleteInstitutional(old.driveFileId).catch(function () {});
    }
    if (old.blobUrl) try { URL.revokeObjectURL(old.blobUrl); } catch (e) {}
  }
  if (!f) {
    ctx.main = null;
    sstFileRenderList(listId, ctxKey);
    return;
  }
  if (typeof archivoPermitidoEnviar === 'function' && !archivoPermitidoEnviar(f)) {
    if (typeof notif === 'function') notif('Tipo de archivo no permitido', 'err');
    inputEl.value = '';
    return;
  }
  ctx.main = sstFileNewItem(f, { esAnexo: false });
  sstFileRenderList(listId, ctxKey);
  if (typeof opts.getUploadCtx === 'function') {
    sstFileTryUpload(ctxKey, listId, opts.getUploadCtx);
  }
}

function sstFileOnAnexosPick(inputEl, opts) {
  opts = opts || {};
  const ctxKey = opts.ctxKey || 'entrega';
  const listId = opts.listId || 'entrega-resp-anexos-list';
  const files = inputEl && inputEl.files ? Array.from(inputEl.files) : [];
  const ctx = sstFileStagingCtx(ctxKey);
  (ctx.anexos || []).forEach(function (old) {
    if (old && old.driveFileId && typeof driveDeleteInstitutional === 'function') {
      driveDeleteInstitutional(old.driveFileId).catch(function () {});
    }
    if (old && old.blobUrl) try { URL.revokeObjectURL(old.blobUrl); } catch (e) {}
  });
  ctx.anexos = [];
  files.forEach(function (f) {
    if (typeof archivoPermitidoEnviar === 'function' && !archivoPermitidoEnviar(f)) return;
    ctx.anexos.push(sstFileNewItem(f, { esAnexo: true }));
  });
  sstFileRenderList(listId, ctxKey);
  if (files.length && typeof opts.getUploadCtx === 'function') {
    sstFileTryUpload(ctxKey, listId, opts.getUploadCtx);
  }
}

function sstFileCollect(ctxKey) {
  const ctx = sstFileStagingCtx(ctxKey);
  const files = [];
  const anexos = [];
  const preUploaded = [];
  function pushItem(it, asAnexo) {
    if (!it) return;
    if (it.state === 'uploaded' && it.uploaded) {
      const up = Object.assign({}, it.uploaded);
      up.esAnexo = !!asAnexo;
      preUploaded.push(up);
      return;
    }
    if (!it.blob) return;
    const row = { blob: it.blob, nombre: it.nombre, tipo: it.tipo, esAnexo: !!asAnexo };
    if (asAnexo) anexos.push(row);
    else files.push(row);
  }
  pushItem(ctx.main, false);
  (ctx.anexos || []).forEach(function (a) { pushItem(a, true); });
  return { files: files, anexos: anexos, preUploaded: preUploaded };
}

function sstFilePickMainBtn(opts) {
  opts = opts || {};
  const run = function () {
    const inp = document.getElementById(opts.inputId || 'enviar-adj-file');
    if (inp) inp.click();
  };
  (typeof sstSolicitarGmailParaAdjuntar === 'function'
    ? sstSolicitarGmailParaAdjuntar()
    : Promise.resolve(true)
  ).then(function (ok) { if (ok) run(); });
}

function sstFilePickAnexosBtn(opts) {
  opts = opts || {};
  const run = function () {
    const inp = document.getElementById(opts.inputId || 'enviar-anexos-file');
    if (inp) inp.click();
  };
  (typeof sstSolicitarGmailParaAdjuntar === 'function'
    ? sstSolicitarGmailParaAdjuntar()
    : Promise.resolve(true)
  ).then(function (ok) { if (ok) run(); });
}

window.sstFileStagingReset = sstFileStagingReset;
window.sstFileOnMainPick = sstFileOnMainPick;
window.sstFileOnAnexosPick = sstFileOnAnexosPick;
window.sstFileRenderList = sstFileRenderList;
window.sstFilePreview = sstFilePreview;
window.sstFileRemove = sstFileRemove;
window.sstFileCollect = sstFileCollect;
window.sstFileTryUpload = sstFileTryUpload;
window.sstFilePickMainBtn = sstFilePickMainBtn;
window.sstFilePickAnexosBtn = sstFilePickAnexosBtn;
