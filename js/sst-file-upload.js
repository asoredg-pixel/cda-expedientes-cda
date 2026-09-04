// =============================================================================
// sst-file-upload.js — Carga a Drive con barra, vista previa y eliminación
// =============================================================================

window._sstFileStaging = window._sstFileStaging || {};
window._sstFileListMeta = window._sstFileListMeta || {};

function sstFileRegisterList(listId, ctxKey, slot) {
  if (!listId) return;
  window._sstFileListMeta[listId] = { ctxKey: ctxKey, slot: slot || 'all' };
}

function sstFileListSlot(listId) {
  const meta = listId && window._sstFileListMeta[listId];
  return meta && meta.slot ? meta.slot : 'all';
}

function sstFileRefreshCtxLists(ctxKey, alsoListId) {
  const seen = {};
  Object.keys(window._sstFileListMeta || {}).forEach(function (listId) {
    const m = window._sstFileListMeta[listId];
    if (m && m.ctxKey === ctxKey) {
      sstFileRenderList(listId, ctxKey);
      seen[listId] = true;
    }
  });
  if (alsoListId && !seen[alsoListId]) sstFileRenderList(alsoListId, ctxKey);
}

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

function sstFileRenderItemRow(it, ctxKey, listId) {
  const st = it.state || 'local';
  const canPreview = !!(it.blobUrl || it.previewLink || it.driveLink);
  let statusHtml = '';
  if (st === 'uploading') {
    statusHtml = '<div class="sst-file-row-prog">' +
      '<div class="sst-file-prog"><div class="sst-file-prog-fill" style="width:' + Math.max(4, it.pct || 0) + '%"></div></div>' +
      '<span class="sst-file-row-prog-txt">' + escAttr(it.pct != null ? (it.pct + '%') : '…') + '</span></div>';
  } else if (st === 'error') {
    statusHtml = '<span class="sst-file-row-err" title="' + escAttr(it.error || 'Error al subir') + '">Error</span>';
  } else if (st === 'uploaded') {
    statusHtml = '<span class="sst-file-row-ok" title="En Drive">✓</span>';
  } else {
    statusHtml = '<span class="sst-file-row-ok" title="Cargado">✓</span>';
  }
  const previewBtn = canPreview
    ? '<button type="button" class="btn bsm bic act-ico" onclick="sstFilePreview(\'' + jsStr(ctxKey) + '\',\'' + jsStr(it.id) + '\')" title="Ver documento">🔍</button>'
    : '';
  const delBtn = '<button type="button" class="btn bsm bic act-ico bd2" onclick="sstFileRemove(\'' + jsStr(ctxKey) + '\',\'' + jsStr(it.id) + '\',\'' + jsStr(listId) + '\')" title="Quitar archivo">🗑</button>';
  return '<div class="sst-file-row' + (st === 'error' ? ' is-err' : '') + (st === 'uploading' ? ' is-uploading' : '') + '" data-sst-file-id="' + escAttr(it.id) + '">' +
    '<span class="sst-file-row-name" title="' + escAttr(it.nombre) + '">📎 ' + escAttr(it.nombre) + '</span>' +
    statusHtml +
    '<div class="sst-file-row-actions">' + previewBtn + delBtn + '</div>' +
    '</div>';
}

function sstFileRenderList(listId, ctxKey) {
  const el = sstFileListEl(listId);
  if (!el) return;
  const ctx = sstFileStagingCtx(ctxKey);
  const slot = sstFileListSlot(listId);
  const items = [];
  if (slot === 'main' || slot === 'all') { if (ctx.main) items.push(ctx.main); }
  if (slot === 'anexos' || slot === 'all') { (ctx.anexos || []).forEach(function (a) { items.push(a); }); }
  if (!items.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = items.map(function (it) { return sstFileRenderItemRow(it, ctxKey, listId); }).join('');
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
  if (window._sstFilePickRegistry) {
    Object.keys(window._sstFilePickRegistry).forEach(function (inpId) {
      const r = window._sstFilePickRegistry[inpId];
      if (r && r.ctxKey === ctxKey) {
        const inp = document.getElementById(inpId);
        if (inp) inp.value = '';
      }
    });
  }
  const inpMain = document.getElementById('enviar-adj-file');
  const inpAnex = document.getElementById('enviar-anexos-file');
  if (hit.slot === 'main' && inpMain) inpMain.value = '';
  if (hit.slot === 'anexos' && inpAnex) inpAnex.value = '';
  sstFileRefreshCtxLists(ctxKey, listId);
}

async function sstFileUploadItem(it, uploadCtx, onPct) {
  if (!it || !it.blob) return null;
  const f = it.blob;
  const nombre = it.nombre || f.name || 'archivo';
  const tipo = it.tipo || f.type || '';
  const rep = (typeof responsableActivo !== 'undefined' && responsableActivo)
    || (typeof taskComentarioAutor === 'function' ? taskComentarioAutor() : '');
  if (onPct) onPct(8);
  if (uploadCtx.biblioteca && typeof driveUploadBiblioteca === 'function') {
    if (onPct) onPct(12);
    const up = await driveUploadBiblioteca(f, nombre, tipo, uploadCtx.folderId);
    if (onPct) onPct(100);
    return {
      driveFileId: up.fileId || '',
      fileId: up.fileId || '',
      driveLink: up.driveLink || '',
      previewLink: up.previewLink || up.driveLink || '',
      driveFilename: up.nombre || nombre,
      nombre: up.nombre || nombre
    };
  }
  const driveEstado = uploadCtx.driveEstado || 'revision';
  if (uploadCtx.esPqrs && typeof driveUploadPqrsExpediente === 'function') {
    const up = await driveUploadPqrsExpediente(f, nombre, tipo, uploadCtx.e, {
      label: driveEstado === 'guia_correccion' ? 'Guía corrección' : (it.esAnexo ? 'Anexo' : 'Respuesta'),
      uploadTarget: 'respuesta',
      driveName: undefined
    });
    if (onPct) onPct(100);
    return Object.assign({}, up, { driveEstado: driveEstado });
  }
  const eDrive = uploadCtx.eDrive || uploadCtx.e;
  if (eDrive && typeof driveUploadExpedienteActividad === 'function') {
    const up = await driveUploadExpedienteActividad(f, nombre, tipo, eDrive, uploadCtx.t, rep, driveEstado);
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
  let bibliotecaUploaded = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || it.state === 'uploaded' || !it.blob) continue;
    it.state = 'uploading';
    it.pct = 0;
    sstFileRefreshCtxLists(ctxKey, listId);
    try {
      const up = await sstFileUploadItem(it, uploadCtx, function (p) {
        it.pct = p;
        sstFileRefreshCtxLists(ctxKey, listId);
      });
      if (up) {
        it.driveFileId = up.driveFileId || up.fileId || '';
        it.driveLink = up.driveLink || '';
        it.previewLink = up.previewLink || up.driveLink || '';
        it.driveFilename = up.driveFilename || up.nombre || it.nombre;
        it.state = 'uploaded';
        it.pct = 100;
        it.uploaded = up;
        if (uploadCtx.biblioteca) bibliotecaUploaded = true;
      }
    } catch (err) {
      it.state = 'error';
      it.error = (err && err.message) ? err.message : 'Error al subir';
      if (typeof notif === 'function') notif('No se pudo subir «' + it.nombre + '»', 'err');
    }
    sstFileRefreshCtxLists(ctxKey, listId);
  }
  if (bibliotecaUploaded && typeof cargarRecursosRepoArchivos === 'function') {
    cargarRecursosRepoArchivos();
  }
}

function sstFileOnMainPick(inputEl, opts) {
  opts = opts || {};
  const ctxKey = opts.ctxKey || 'entrega';
  const listId = opts.listId || 'entrega-resp-file-list';
  if (typeof sstFileRegisterList === 'function') sstFileRegisterList(listId, ctxKey, 'main');
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
    sstFileRefreshCtxLists(ctxKey, listId);
    return;
  }
  if (typeof archivoPermitidoEnviar === 'function' && !archivoPermitidoEnviar(f)) {
    if (typeof notif === 'function') notif('Tipo de archivo no permitido', 'err');
    inputEl.value = '';
    return;
  }
  ctx.main = sstFileNewItem(f, { esAnexo: false });
  sstFileRefreshCtxLists(ctxKey, listId);
  if (typeof opts.getUploadCtx === 'function') {
    sstFileTryUpload(ctxKey, listId, opts.getUploadCtx);
  }
}

function sstFileOnAnexosPick(inputEl, opts) {
  opts = opts || {};
  const ctxKey = opts.ctxKey || 'entrega';
  const listId = opts.listId || 'entrega-resp-anexos-list';
  if (typeof sstFileRegisterList === 'function') sstFileRegisterList(listId, ctxKey, 'anexos');
  const files = inputEl && inputEl.files ? Array.from(inputEl.files) : [];
  const ctx = sstFileStagingCtx(ctxKey);
  if (!ctx.anexos) ctx.anexos = [];
  if (opts.replace) {
    (ctx.anexos || []).forEach(function (old) {
      if (old && old.driveFileId && typeof driveDeleteInstitutional === 'function') {
        driveDeleteInstitutional(old.driveFileId).catch(function () {});
      }
      if (old && old.blobUrl) try { URL.revokeObjectURL(old.blobUrl); } catch (e) {}
    });
    ctx.anexos = [];
  }
  files.forEach(function (f) {
    if (typeof archivoPermitidoEnviar === 'function' && !archivoPermitidoEnviar(f)) return;
    ctx.anexos.push(sstFileNewItem(f, { esAnexo: true }));
  });
  if (inputEl) inputEl.value = '';
  sstFileRefreshCtxLists(ctxKey, listId);
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

window._sstFilePickRegistry = window._sstFilePickRegistry || {};

/** HTML reutilizable: botón + input oculto + lista con barra / preview / eliminar. */
function sstFilePickBlock(opts) {
  opts = opts || {};
  const inputId = opts.inputId || ('sst-file-inp-' + Date.now());
  const listId = opts.listId || (inputId + '-list');
  const ctxKey = opts.ctxKey || inputId;
  const multi = !!opts.multi;
  const accept = opts.accept || '.pdf,.doc,.docx,image/*,video/*';
  const label = opts.label || (multi ? 'Seleccionar anexos' : 'Seleccionar archivo');
  const btnCls = opts.btnClass || (multi ? 'btn bsm' : 'btn bsm bp');
  sstFileRegisterPick(inputId, { ctxKey: ctxKey, listId: listId, multi: multi, getUploadCtx: opts.getUploadCtx || null });
  if (typeof sstFileRegisterList === 'function') sstFileRegisterList(listId, ctxKey, multi ? 'anexos' : 'main');
  return '<div class="sst-file-pick">' +
    '<button type="button" class="' + btnCls + '" onclick="sstFilePickByInputId(\'' + jsStr(inputId) + '\')">📎 ' + escAttr(label) + '</button>' +
    '<input type="file" id="' + escAttr(inputId) + '"' + (multi ? ' multiple' : '') + ' accept="' + escAttr(accept) + '" style="display:none" onchange="sstFileOnPickByInputId(this)">' +
    '</div>' +
    '<div id="' + escAttr(listId) + '" class="sst-file-slot-list"></div>';
}

function sstFileRegisterPick(inputId, opts) {
  window._sstFilePickRegistry[inputId] = opts || {};
}

function sstFileInitPick(inputId) {
  const reg = window._sstFilePickRegistry[inputId];
  if (!reg) return;
  sstFileRenderList(reg.listId, reg.ctxKey);
}

function sstFilePickByInputId(inputId) {
  (typeof sstSolicitarGmailParaAdjuntar === 'function' ? sstSolicitarGmailParaAdjuntar() : Promise.resolve(true))
    .then(function (ok) {
      if (!ok) return;
      const inp = document.getElementById(inputId);
      if (inp) inp.click();
    });
}

function sstFileOnPickByInputId(inp) {
  const reg = inp && inp.id && window._sstFilePickRegistry[inp.id];
  if (!reg) return;
  const opts = { ctxKey: reg.ctxKey, listId: reg.listId, getUploadCtx: reg.getUploadCtx };
  if (reg.multi) sstFileOnAnexosPick(inp, opts);
  else sstFileOnMainPick(inp, opts);
}

function sstFileGetMainItem(ctxKey) {
  const ctx = window._sstFileStaging && window._sstFileStaging[ctxKey];
  return ctx && ctx.main ? ctx.main : null;
}

function sstFileGetMainBlob(ctxKey) {
  const it = sstFileGetMainItem(ctxKey);
  return it && it.blob ? it.blob : null;
}

function sstFileHasMain(ctxKey) {
  return !!sstFileGetMainItem(ctxKey);
}

function sstFileEnviarCtxKey(expId, taskId) {
  return 'enviar-soporte:' + String(expId || '').trim() + ':' + String(taskId || '').trim();
}

function sstFileChatGuiaCtxKey(expId, taskId) {
  return 'chat-guia:' + String(expId || '').trim() + ':' + String(taskId || '').trim();
}

function sstFileUploadCtxForExpTask(expId, taskId) {
  return function () {
    expId = String(expId || '').trim();
    taskId = String(taskId || '').trim();
    let e = typeof getExpById === 'function' ? getExpById(expId) : null;
    let t = e && taskId && typeof getTaskFromExp === 'function' ? getTaskFromExp(e, taskId) : null;
    if (!t && typeof getActLibreById === 'function') t = getActLibreById(taskId);
    if (!t && typeof getActLibreByCodigo === 'function') t = getActLibreByCodigo(expId);
    if (t && t.sinExpediente) {
      const cod = t.codigo || expId;
      const depto = t.depto || (typeof getDeptoOperativo === 'function' ? getDeptoOperativo() : 'guaviare');
      return {
        esPqrs: false,
        expId: cod,
        e: null,
        eDrive: {
          _exp: cod,
          _fecha: typeof hoy === 'function' ? hoy() : '',
          _depto: depto,
          _sin_expediente: true,
          _pn_nombre: 'Sin expediente',
          _drive_folder_id: t._drive_folder_id || '',
          _drive_folder_link: t._drive_folder_link || ''
        },
        t: t
      };
    }
    if (!e) return null;
    const esPqrs = typeof esPqrsSecretaria === 'function' && esPqrsSecretaria(e);
    if (!t) t = { id: taskId || '_staging_', actividad: 'Entrega' };
    return { esPqrs: !!esPqrs, expId: e._exp, e: e, eDrive: e, t: t };
  };
}

function sstFileUploadCtxForPqrsExp(expId) {
  expId = String(expId || '').trim();
  return function () {
    const e = typeof getExpById === 'function' ? getExpById(expId) : null;
    if (!e) return null;
    const t = { id: '_staging_', actividad: 'Notificación PQRSD' };
    return { esPqrs: true, expId: expId, e: e, eDrive: e, t: t };
  };
}

function sstFileUploadCtxForBiblioteca(getFolderId) {
  return function () {
    const folderId = typeof getFolderId === 'function' ? getFolderId() : '';
    if (!folderId) return null;
    return { biblioteca: true, folderId: folderId };
  };
}

function sstFileCollectRawFiles(ctxKey) {
  const col = typeof sstFileCollect === 'function' ? sstFileCollect(ctxKey) : { files: [], anexos: [] };
  const out = [];
  (col.files || []).forEach(function (r) { if (r && r.blob) out.push(r.blob); });
  (col.anexos || []).forEach(function (r) { if (r && r.blob) out.push(r.blob); });
  return out;
}

function sstFileCtxKeySecRadicacion() {
  return 'sec-radicacion-anexos';
}

function sstFileCtxKeyPqrsRespAdj(expId) {
  return 'pqrs-resp-adj:' + String(expId || '').trim();
}

function sstFileCtxKeyPqrsRespAnexos(expId) {
  return 'pqrs-resp-anexos:' + String(expId || '').trim();
}

function sstFileCtxKeyDirectorPdf(expId) {
  return 'director-pdf:' + String(expId || '').trim();
}

function sstFileCtxKeyTramiteDirectorPdf(refId, taskId) {
  return 'tramite-director-pdf:' + String(refId || '').trim() + ':' + String(taskId || '').trim();
}

function sstFileCtxKeyTramiteAtajoFirmado(refId, taskId) {
  return 'tramite-atajo-firmado:' + String(refId || '').trim() + ':' + String(taskId || '').trim();
}

window.sstFileRegisterList = sstFileRegisterList;
window.sstFileRefreshCtxLists = sstFileRefreshCtxLists;
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
window.sstFilePickBlock = sstFilePickBlock;
window.sstFileRegisterPick = sstFileRegisterPick;
window.sstFileInitPick = sstFileInitPick;
window.sstFilePickByInputId = sstFilePickByInputId;
window.sstFileOnPickByInputId = sstFileOnPickByInputId;
window.sstFileGetMainItem = sstFileGetMainItem;
window.sstFileGetMainBlob = sstFileGetMainBlob;
window.sstFileHasMain = sstFileHasMain;
window.sstFileEnviarCtxKey = sstFileEnviarCtxKey;
window.sstFileChatGuiaCtxKey = sstFileChatGuiaCtxKey;
window.sstFileUploadCtxForExpTask = sstFileUploadCtxForExpTask;
window.sstFileUploadCtxForPqrsExp = sstFileUploadCtxForPqrsExp;
window.sstFileUploadCtxForBiblioteca = sstFileUploadCtxForBiblioteca;
window.sstFileCollectRawFiles = sstFileCollectRawFiles;
window.sstFileCtxKeySecRadicacion = sstFileCtxKeySecRadicacion;
window.sstFileCtxKeyPqrsRespAdj = sstFileCtxKeyPqrsRespAdj;
window.sstFileCtxKeyPqrsRespAnexos = sstFileCtxKeyPqrsRespAnexos;
window.sstFileCtxKeyDirectorPdf = sstFileCtxKeyDirectorPdf;
window.sstFileCtxKeyTramiteDirectorPdf = sstFileCtxKeyTramiteDirectorPdf;
window.sstFileCtxKeyTramiteAtajoFirmado = sstFileCtxKeyTramiteAtajoFirmado;
