// =============================================================================
// recursos.js — Enlaces externos + Biblioteca (repositorio Drive por oficina)
// =============================================================================

window._recursosSubTab = 'enlaces';
window._recursosRepoSel = null;
window._recursosDrivePage = null;

function parseDriveFolderId(url) {
  const m = String(url || '').match(/\/folders\/([^/?#]+)/);
  return m ? m[1] : '';
}

function recursosDriveConectado() {
  return typeof _driveGetBestToken === 'function' && !!_driveGetBestToken();
}

function recursosModalCorreoRequerido(accion) {
  const ov = document.getElementById('rec-drive-overlay');
  const msg = document.getElementById('rec-drive-msg');
  const det = document.getElementById('rec-drive-detail');
  if (!ov) {
    notif('Conecte su correo en la pestaña Correos para ' + (accion || 'usar la biblioteca Drive') + '.', 'err');
    return;
  }
  const txt = accion || 'crear repositorios, adjuntar documentos y gestionar carpetas en Drive';
  if (msg) msg.textContent = 'Para ' + txt + ' debe conectar su cuenta de correo institucional.';
  if (det) det.textContent = 'Vaya a la pestaña Correos, inicie sesión con Google y autorice el acceso a Gmail y Drive. Sin conexión no es posible crear carpetas ni subir archivos.';
  ov.classList.add('on');
  ov.setAttribute('aria-hidden', 'false');
}

function recursosCerrarModalCorreo() {
  const ov = document.getElementById('rec-drive-overlay');
  if (ov) {
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
  }
}

function recursosIrACorreos() {
  recursosCerrarModalCorreo();
  if (typeof showTab === 'function') showTab('gmail-ofi');
}

function recursosPreUploadDrive(ev) {
  if (recursosDriveConectado()) return true;
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  recursosModalCorreoRequerido('adjuntar documentos al repositorio');
  return false;
}

function recursosRequiereDrive(accion, fn) {
  if (recursosDriveConectado()) {
    if (typeof fn === 'function') fn();
    return true;
  }
  recursosModalCorreoRequerido(accion);
  return false;
}

function recursosInitPanel() {
  if (!puedeVerRecursos()) return;
  reloadRecursosFirestore().then(function() {
    renderRecursosPanel();
  });
}

function setRecursosSubTab(tab) {
  window._recursosSubTab = tab === 'biblioteca' ? 'biblioteca' : 'enlaces';
  window._recursosRepoSel = null;
  renderRecursosPanel();
}

function getBibliotecaOficinaSesion() {
  return getRecursosOficinaActiva() || 'guaviare';
}

function getRepoScope(r) {
  const item = normalizeRecursosScopeItem(r || {});
  return { scope: item.scope || 'oficina', scopeId: item.scopeId || item.oficinaId || '' };
}

function enlacesVisiblesParaSesion() {
  return normalizeRecursosEnlacesList(recursosEnlaces).filter(function(l) {
    return recursosItemVisibleParaSesion(l);
  });
}

function enlacesVisiblesAdminTodos() {
  return normalizeRecursosEnlacesList(recursosEnlaces).filter(function(l) { return l.activo !== false; });
}

function reposBibliotecaVisibles() {
  return normalizeBibliotecaReposList(bibliotecaRepos).filter(function(r) {
    return recursosItemVisibleParaSesion(r);
  });
}

function archivosBibliotecaCompartidosVisibles() {
  const out = [];
  normalizeBibliotecaReposList(bibliotecaRepos).forEach(function(r) {
    if (r.activo === false) return;
    archivosRepoCompartidosConmigo(r).forEach(function(a) {
      if (recursosItemVisiblePorScope(r)) return;
      out.push({ repo: r, archivo: a });
    });
  });
  return out;
}

function labelScopeEnlace(l) {
  return labelRecursosScope(l.scope, l.scopeId);
}

function labelScopeRepo(r) {
  const s = getRepoScope(r);
  return labelRecursosScopeContexto(s.scope, s.scopeId);
}

function recursosContextoLabel() {
  const depto = labelDepartamento(getRecursosDeptoContext());
  const ofis = getRecursosOficinasVisiblesSesion().map(labelOficina);
  if (!ofis.length) return depto;
  if (ofis.length === 1) return depto + ' · ' + ofis[0];
  return depto + ' · ' + ofis.join(', ');
}

function renderRecursosPanel() {
  const root = document.getElementById('recursos-panel-root');
  if (!root) return;
  const sub = window._recursosSubTab;
  const depto = getRecursosDeptoContext();
  const bibOk = bibliotecaDriveDisponible(depto);
  const ofiSel = getBibliotecaOficinaSesion();
  const ctxLbl = recursosContextoLabel();

  let h = '<div class="rec-wrap">';
  h += '<div class="rec-hdr"><div><h2 class="rec-title">📚 Recursos</h2>';
  h += '<p class="rec-sub">Enlaces externos y biblioteca documental · <strong>' + escAttr(ctxLbl) + '</strong>.</p></div></div>';

  h += '<div class="rec-subtabs">';
  h += '<button type="button" class="rec-subtab' + (sub === 'enlaces' ? ' on' : '') + '" onclick="setRecursosSubTab(\'enlaces\')"><span class="rec-subtab-ico" aria-hidden="true">🔗</span><span>Enlaces</span></button>';
  h += '<button type="button" class="rec-subtab' + (sub === 'biblioteca' ? ' on' : '') + '" onclick="setRecursosSubTab(\'biblioteca\')"><span class="rec-subtab-ico" aria-hidden="true">📁</span><span>Biblioteca</span></button>';
  h += '</div>';

  if (sub === 'enlaces') {
    h += renderRecursosEnlacesPanel(depto);
  } else {
    h += renderRecursosBibliotecaPanel(depto, bibOk, ofiSel);
  }

  h += '</div>';
  root.innerHTML = h;
}

function renderRecursosEnlacesPanel(depto) {
  const lista = esAdministrador() ? enlacesVisiblesAdminTodos() : enlacesVisiblesParaSesion();
  const q = String(document.getElementById('rec-enlace-q') && document.getElementById('rec-enlace-q').value || window._recEnlaceQ || '').trim().toLowerCase();
  const fa = String(document.getElementById('rec-enlace-area') && document.getElementById('rec-enlace-area').value || window._recEnlaceArea || '').trim().toLowerCase();
  const ft = String(document.getElementById('rec-enlace-tem') && document.getElementById('rec-enlace-tem').value || window._recEnlaceTem || '').trim().toLowerCase();

  const filtrada = lista.filter(function(l) {
    if (q && !(l.titulo || '').toLowerCase().includes(q) && !(l.url || '').toLowerCase().includes(q) &&
        !(l.descripcion || '').toLowerCase().includes(q)) return false;
    if (fa && !(l.area || '').toLowerCase().includes(fa)) return false;
    if (ft && !(l.tematica || '').toLowerCase().includes(ft)) return false;
    return true;
  });

  const puedeCrear = getRecursosScopesCreablesSesion().length > 0;

  let h = '<div class="card rec-card">';
  h += '<div class="rec-toolbar">';
  h += '<input type="search" id="rec-enlace-q" class="rec-inp" placeholder="Buscar…" value="' + escAttr(window._recEnlaceQ || '') + '" oninput="window._recEnlaceQ=this.value;renderRecursosPanel()">';
  h += '<input type="text" id="rec-enlace-area" class="rec-inp" placeholder="Área" value="' + escAttr(window._recEnlaceArea || '') + '" oninput="window._recEnlaceArea=this.value;renderRecursosPanel()">';
  h += '<input type="text" id="rec-enlace-tem" class="rec-inp" placeholder="Temática" value="' + escAttr(window._recEnlaceTem || '') + '" oninput="window._recEnlaceTem=this.value;renderRecursosPanel()">';
  if (puedeCrear) {
    h += '<button type="button" class="btn bsm bp" onclick="recursosMostrarFormEnlace()">+ Enlace</button>';
  }
  h += '</div>';

  if (window._recursosEnlaceForm) {
    h += renderRecursosEnlaceForm(window._recursosEnlaceForm);
  }

  if (!filtrada.length) {
    h += '<div class="rec-empty">No hay enlaces para este contexto.</div>';
  } else {
    h += '<div class="rec-enlace-grid">';
    filtrada.forEach(function(l) {
      const canEdit = puedeEditarRecursosEnlaces(l.scope, l.scopeId);
      const canDel = puedeEliminarRecursosItem(l);
      const canShare = puedeCompartirRecursosItem(l);
      const compLbl = labelRecursosCompartidoCon(l.compartidoCon);
      h += '<div class="rec-enlace-item">';
      h += '<div class="rec-enlace-meta"><span class="rec-badge">' + escAttr(labelRecursosScopeContexto(l.scope, l.scopeId)) + '</span>';
      if (recursosItemCompartidoVisible(l) && !recursosItemVisiblePorScope(l)) h += '<span class="rec-tag rec-tag-share">Compartido</span>';
      if (compLbl) h += '<span class="rec-tag rec-tag-share" title="Compartido con">↗ ' + escAttr(compLbl) + '</span>';
      if (l.area) h += '<span class="rec-tag">' + escAttr(l.area) + '</span>';
      if (l.tematica) h += '<span class="rec-tag rec-tag-2">' + escAttr(l.tematica) + '</span>';
      h += '</div>';
      h += '<a class="rec-enlace-tit" href="' + escAttr(l.url) + '" target="_blank" rel="noopener noreferrer">' + escAttr(l.titulo || l.url) + '</a>';
      if (l.descripcion) h += '<div class="rec-enlace-desc">' + escAttr(l.descripcion) + '</div>';
      h += '<div class="rec-enlace-actions">';
      h += '<a class="btn bsm" href="' + escAttr(l.url) + '" target="_blank" rel="noopener">Abrir ↗</a>';
      if (canEdit) {
        h += '<button type="button" class="btn bsm" onclick="recursosMostrarFormEnlace(\'' + escAttr(l.id) + '\')">Editar</button>';
      }
      if (canShare) {
        h += '<button type="button" class="btn bsm" onclick="recursosAbrirCompartir(\'enlace\',\'' + escAttr(l.id) + '\')">Compartir</button>';
      }
      if (canDel) {
        h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosEnlace(\'' + escAttr(l.id) + '\')">Eliminar</button>';
      }
      h += '</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderRecursosBibliotecaPanel(depto, bibOk, ofiSel) {
  let h = '';

  if ((depto === 'guainia' || depto === 'vaupes') && !bibOk) {
    h += '<div class="rec-info-banner">La biblioteca para <strong>' + escAttr(labelDepartamento(depto)) + '</strong> estará disponible cuando el administrador configure el enlace de carpeta Drive regional.</div>';
    if (esAdministrador()) {
      h += '<div class="card rec-card" style="margin-top:12px"><div class="cft">Configuración Drive regional (admin)</div>';
      h += '<div class="fg"><div class="fld"><label>Guainía — carpeta Drive</label><input type="url" id="rec-cfg-guainia" value="' + escAttr(recursosConfig.guainiaDriveRoot || '') + '" placeholder="https://drive.google.com/drive/folders/…"></div>';
      h += '<div class="fld"><label>Vaupés — carpeta Drive</label><input type="url" id="rec-cfg-vaupes" value="' + escAttr(recursosConfig.vaupesDriveRoot || '') + '" placeholder="https://drive.google.com/drive/folders/…"></div></div>';
      h += '<button type="button" class="btn bsm bp" onclick="guardarRecursosConfigDrive()">Guardar configuración</button></div>';
    }
    return h;
  }

  if (!bibOk) {
    h += '<div class="rec-info-banner warn">Biblioteca no disponible en este contexto.</div>';
    return h;
  }

  h += '<div class="rec-toolbar" style="margin-bottom:12px">';
  if (getRecursosScopesCreablesSesion().length > 0) {
    h += '<button type="button" class="btn bsm bp" onclick="recursosMostrarFormRepo()">+ Repositorio</button>';
  }
  if (!recursosDriveConectado()) {
    h += '<span class="rec-drive-hint" style="font-size:12px;color:var(--tx2)">⚠️ Conecte correo en <a href="#" onclick="recursosIrACorreos();return false">Correos</a> para crear carpetas y subir archivos.</span>';
  } else {
    h += '<span class="rec-drive-hint" style="font-size:12px;color:var(--tx3)">Abra un repositorio para explorar carpetas y documentos.</span>';
  }
  h += '</div>';

  if (window._recursosRepoForm && !window._recursosRepoSel) {
    h += renderRecursosRepoForm(window._recursosRepoForm);
  }

  if (window._recursosRepoSel) {
    h += renderRecursosRepoDetalle(window._recursosRepoSel);
    return h;
  }

  const repos = reposBibliotecaVisibles();
  h += '<div class="card rec-card">';
  if (!repos.length) {
    h += '<div class="rec-empty">Sin repositorios para su contexto (<strong>' + escAttr(recursosContextoLabel()) + '</strong>).</div>';
  } else {
    h += '<div class="rec-repo-list">';
    repos.forEach(function(r) {
      const compLbl = labelRecursosCompartidoCon(r.compartidoCon);
      h += '<div class="rec-repo-row" onclick="abrirRecursosRepo(\'' + escAttr(r.id) + '\')">';
      h += '<div><span class="rec-badge">' + escAttr(labelScopeRepo(r)) + '</span>';
      if (recursosItemCompartidoVisible(r) && !recursosItemVisiblePorScope(r)) h += '<span class="rec-tag rec-tag-share">Compartido</span>';
      if (compLbl) h += '<span class="rec-tag rec-tag-share" title="Compartido con">↗ ' + escAttr(compLbl) + '</span>';
      h += ' <strong>' + escAttr(r.titulo) + '</strong>';
      if (r.tematica) h += ' <span class="rec-tag">' + escAttr(r.tematica) + '</span>';
      const nv = (r.vinculados || []).length;
      if (nv) h += ' <span class="rec-tag rec-tag-vinc" title="Casos asociados">' + nv + ' asociado' + (nv === 1 ? '' : 's') + '</span>';
      if (r.descripcion) h += '<div style="font-size:12px;color:var(--tx2);margin-top:4px">' + escAttr(r.descripcion) + '</div>';
      h += '</div>';
      h += '<span style="font-size:12px;color:var(--tx3)">Ver →</span></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  const compArch = archivosBibliotecaCompartidosVisibles();
  if (compArch.length) {
    h += '<div class="card rec-card" style="margin-top:12px"><div class="cft">Documentos compartidos con su oficina</div><div class="rec-files-list">';
    compArch.forEach(function(x) {
      const a = x.archivo;
      const link = a.driveLink || (a.fileId ? 'https://drive.google.com/file/d/' + a.fileId + '/view' : '#');
      h += '<div class="rec-file-row"><span>📄 ' + escAttr(a.fileName || 'Documento') + ' <span style="color:var(--tx3);font-size:11px">· ' + escAttr(x.repo.titulo) + '</span></span>';
      h += '<a class="btn bsm" href="' + escAttr(link) + '" target="_blank" rel="noopener">Abrir</a></div>';
    });
    h += '</div></div>';
  }
  return h;
}

function abrirRecursosRepo(repoId) {
  window._recursosRepoSel = repoId;
  window._recursosDrivePage = null;
  const r = getRecursosRepoById(repoId);
  const rootId = r ? (r.driveFolderId || parseDriveFolderId(r.driveFolderLink)) : '';
  window._recExplorer = {
    repoId: repoId,
    rootId: rootId,
    folderId: rootId,
    path: [{ id: rootId, name: (r && r.titulo) || 'Repositorio' }],
    view: (window._recExplorer && window._recExplorer.view) || 'details',
    selection: [],
    files: [],
    lastClickedId: null,
    dragIds: null
  };
  renderRecursosPanel();
  if (!recursosDriveConectado()) {
    const el = document.getElementById('rec-repo-files');
    if (el) {
      el.innerHTML = '<div class="rec-info-banner warn">Conecte su correo en la pestaña <a href="#" onclick="recursosIrACorreos();return false">Correos</a> para listar y adjuntar archivos del repositorio.</div>';
    }
    return;
  }
  cargarRecursosRepoArchivos();
}

function cerrarRecursosRepo() {
  window._recursosRepoSel = null;
  window._recursosDrivePage = null;
  window._recExplorer = null;
  recExpHideContextMenu();
  renderRecursosPanel();
}

function getRecursosRepoById(id) {
  return (bibliotecaRepos || []).find(function(r) { return r.id === id; }) || null;
}

function recExpState() {
  return window._recExplorer || null;
}

function recExpCanEdit() {
  const st = recExpState();
  const r = st ? getRecursosRepoById(st.repoId) : null;
  if (!r) return false;
  const s = getRepoScope(r);
  return !!puedeEditarBiblioteca(s.scope, s.scopeId);
}

function recExpCanShare() {
  const st = recExpState();
  const r = st ? getRecursosRepoById(st.repoId) : null;
  return !!(r && puedeCompartirRecursosItem(r));
}

function recExpCurrentFolderId() {
  const st = recExpState();
  return (st && st.folderId) || '';
}

function renderRecursosRepoDetalle(repoId) {
  const r = getRecursosRepoById(repoId);
  if (!r) return '<div class="rec-empty">Repositorio no encontrado.</div>';
  const s = getRepoScope(r);
  const canEdit = puedeEditarBiblioteca(s.scope, s.scopeId);
  const canDel = puedeEliminarRecursosItem(r);
  const canShare = puedeCompartirRecursosItem(r);
  const compLbl = labelRecursosCompartidoCon(r.compartidoCon);
  let h = '<div class="card rec-card">';
  h += '<div class="rec-repo-hdr"><button type="button" class="btn bsm" onclick="cerrarRecursosRepo()">← Volver</button>';
  h += '<div><strong>' + escAttr(r.titulo) + '</strong> · ' + escAttr(labelScopeRepo(r)) + '</div>';
  if (r.driveFolderLink) h += '<a class="btn bsm" href="' + escAttr(r.driveFolderLink) + '" target="_blank" rel="noopener">Drive ↗</a>';
  h += '</div>';
  if (r.descripcion) h += '<p style="font-size:13px;color:var(--tx2);margin:8px 0">' + escAttr(r.descripcion) + '</p>';
  if (compLbl) h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 8px">Compartido con: <strong>' + escAttr(compLbl) + '</strong></p>';
  if (canEdit || canShare || canDel) {
    h += '<div class="rec-toolbar" style="margin:10px 0">';
    if (canEdit) {
      h += '<button type="button" class="btn bsm" onclick="recursosMostrarFormRepo(\'' + escAttr(r.id) + '\')">Editar datos</button>';
    }
    if (canShare) {
      h += '<button type="button" class="btn bsm" onclick="recursosAbrirCompartir(\'repo\',\'' + escAttr(r.id) + '\')">Compartir repositorio</button>';
    }
    if (canDel) {
      h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosRepo(\'' + escAttr(r.id) + '\')">Eliminar repo</button>';
    }
    h += '</div>';
  }
  if (window._recursosRepoForm === r.id) {
    h += renderRecursosRepoForm(r.id);
  }
  h += renderRecursosRepoVinculosBlock(r, canEdit);
  h += '<div class="rec-exp-shell">';
  h += '<div class="cft" style="margin:8px 0 6px">Explorador de archivos</div>';
  h += '<div id="rec-repo-files"><div class="rec-empty">Cargando archivos…</div></div>';
  h += '</div>';
  h += '</div>';
  return h;
}

function recExpFmtSize(n) {
  const v = Number(n || 0);
  if (!v) return '—';
  if (v < 1024) return v + ' B';
  if (v < 1048576) return (v / 1024).toFixed(1) + ' KB';
  if (v < 1073741824) return (v / 1048576).toFixed(1) + ' MB';
  return (v / 1073741824).toFixed(1) + ' GB';
}

function recExpFmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) { return '—'; }
}

function recExpIsFolder(f) {
  return !!(f && f.mimeType === 'application/vnd.google-apps.folder');
}

function recExpItemById(id) {
  const st = recExpState();
  if (!st) return null;
  return (st.files || []).find(function(f) { return f && f.id === id; }) || null;
}

function recExpIcon(f) {
  if (recExpIsFolder(f)) return '📁';
  const n = String(f && f.name || '').toLowerCase();
  const m = String(f && f.mimeType || '');
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return '📕';
  if (/image|png|jpe?g|gif|webp/.test(m) || /\.(png|jpe?g|gif|webp)$/.test(n)) return '🖼️';
  if (/sheet|excel|spreadsheet/.test(m) || /\.(xlsx?|csv)$/.test(n)) return '📊';
  if (/word|document/.test(m) || /\.(docx?|odt)$/.test(n)) return '📝';
  if (/zip|rar|7z|compress/.test(m) || /\.(zip|rar|7z)$/.test(n)) return '🗜️';
  return '📄';
}

function recExpTypeLabel(f) {
  if (recExpIsFolder(f)) return 'Carpeta de archivos';
  const n = String(f && f.name || '');
  const ext = n.indexOf('.') >= 0 ? n.split('.').pop().toUpperCase() : '';
  if (ext) return 'Archivo ' + ext;
  return f && f.mimeType ? String(f.mimeType).split('/').pop() : 'Archivo';
}

function renderRecExpToolbar(canEdit) {
  const st = recExpState();
  const view = (st && st.view) || 'details';
  let h = '<div class="rec-exp-toolbar">';
  h += '<div class="rec-exp-toolbar-left">';
  if (canEdit) {
    h += '<button type="button" class="btn bsm bp" onclick="recExpNuevaCarpeta()">📁 Nueva carpeta</button>';
    if (typeof sstFilePickBlock === 'function') {
      h += sstFilePickBlock({
        inputId: 'rec-exp-upload-inp',
        listId: 'rec-exp-upload-list',
        ctxKey: 'rec-exp-upload',
        multi: true,
        label: 'Subir',
        btnClass: 'btn bsm',
        getUploadCtx: typeof sstFileUploadCtxForBiblioteca === 'function'
          ? sstFileUploadCtxForBiblioteca(function () { return recExpCurrentFolderId(); })
          : null
      });
    } else {
      h += '<label class="btn bsm" style="cursor:pointer">📤 Subir<input type="file" multiple style="display:none" onchange="recExpSubirDesdeInput(event)"></label>';
    }
    h += '<button type="button" class="btn bsm bd2" onclick="recExpEliminarSeleccion()">🗑 Eliminar</button>';
  }
  h += '<button type="button" class="btn bsm" onclick="cargarRecursosRepoArchivos()">↻ Actualizar</button>';
  h += '</div>';
  h += '<div class="rec-exp-views" role="group" aria-label="Vista">';
  h += '<button type="button" class="btn bsm' + (view === 'icons' ? ' bp' : '') + '" onclick="recExpSetView(\'icons\')" title="Iconos">▦</button>';
  h += '<button type="button" class="btn bsm' + (view === 'list' ? ' bp' : '') + '" onclick="recExpSetView(\'list\')" title="Lista">☰</button>';
  h += '<button type="button" class="btn bsm' + (view === 'details' ? ' bp' : '') + '" onclick="recExpSetView(\'details\')" title="Detalles">≣</button>';
  h += '</div></div>';
  return h;
}

function renderRecExpBreadcrumb() {
  const st = recExpState();
  if (!st || !(st.path || []).length) return '';
  let h = '<nav class="rec-exp-crumb" aria-label="Ruta">';
  (st.path || []).forEach(function(p, i) {
    if (i) h += '<span class="rec-exp-crumb-sep">›</span>';
    const isLast = i === st.path.length - 1;
    if (isLast) h += '<span class="rec-exp-crumb-cur">' + escAttr(p.name || 'Carpeta') + '</span>';
    else h += '<button type="button" class="rec-exp-crumb-btn" onclick="recExpNavigateToIndex(' + i + ')">' + escAttr(p.name || 'Carpeta') + '</button>';
  });
  h += '</nav>';
  return h;
}

function renderRecExpItemsHtml(files, canEdit, canShare, repo) {
  const st = recExpState();
  const view = (st && st.view) || 'details';
  const sel = new Set((st && st.selection) || []);
  if (!(files || []).length) {
    return '<div class="rec-exp-empty" data-rec-exp-pane="1">Carpeta vacía. ' +
      (canEdit ? 'Arrastre archivos aquí o use «Subir» / «Nueva carpeta».' : '') + '</div>';
  }
  if (view === 'icons') {
    let h = '<div class="rec-exp-icons" data-rec-exp-pane="1" tabindex="0">';
    files.forEach(function(f) {
      const isFolder = recExpIsFolder(f);
      const on = sel.has(f.id);
      h += '<div class="rec-exp-icon-item' + (on ? ' selected' : '') + '" draggable="' + (canEdit ? 'true' : 'false') + '" ' +
        'data-file-id="' + escAttr(f.id) + '" data-is-folder="' + (isFolder ? '1' : '0') + '" ' +
        'ondragstart="recExpDragStart(event)" ondragend="recExpDragEnd(event)" ' +
        (isFolder ? 'ondragover="recExpDragOverFolder(event)" ondragleave="recExpDragLeaveFolder(event)" ondrop="recExpDropOnFolder(event)" ' : '') +
        'onclick="recExpItemClick(event,\'' + escAttr(f.id) + '\')" ' +
        'ondblclick="recExpItemDblClick(event,\'' + escAttr(f.id) + '\')" ' +
        'oncontextmenu="recExpItemContextMenu(event,\'' + escAttr(f.id) + '\')">';
      h += '<div class="rec-exp-icon-glyph">' + recExpIcon(f) + '</div>';
      h += '<div class="rec-exp-icon-name" title="' + escAttr(f.name) + '">' + escAttr(f.name) + '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }
  if (view === 'list') {
    let h = '<div class="rec-exp-list" data-rec-exp-pane="1" tabindex="0">';
    files.forEach(function(f) {
      const isFolder = recExpIsFolder(f);
      const on = sel.has(f.id);
      h += '<div class="rec-exp-list-row' + (on ? ' selected' : '') + '" draggable="' + (canEdit ? 'true' : 'false') + '" ' +
        'data-file-id="' + escAttr(f.id) + '" data-is-folder="' + (isFolder ? '1' : '0') + '" ' +
        'ondragstart="recExpDragStart(event)" ondragend="recExpDragEnd(event)" ' +
        (isFolder ? 'ondragover="recExpDragOverFolder(event)" ondragleave="recExpDragLeaveFolder(event)" ondrop="recExpDropOnFolder(event)" ' : '') +
        'onclick="recExpItemClick(event,\'' + escAttr(f.id) + '\')" ' +
        'ondblclick="recExpItemDblClick(event,\'' + escAttr(f.id) + '\')" ' +
        'oncontextmenu="recExpItemContextMenu(event,\'' + escAttr(f.id) + '\')">';
      h += '<span class="rec-exp-ico">' + recExpIcon(f) + '</span><span class="rec-exp-name">' + escAttr(f.name) + '</span>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }
  // details
  let h = '<div class="rec-exp-details" data-rec-exp-pane="1" tabindex="0">';
  h += '<div class="rec-exp-details-head"><span>Nombre</span><span>Modificado</span><span>Tipo</span><span>Tamaño</span></div>';
  files.forEach(function(f) {
    const isFolder = recExpIsFolder(f);
    const on = sel.has(f.id);
    const archComp = (!isFolder && repo) ? (repo.archivosCompartidos || []).find(function(a) { return a.fileId === f.id; }) : null;
    const shareLbl = archComp ? labelRecursosCompartidoCon(archComp.compartidoCon) : '';
    h += '<div class="rec-exp-details-row' + (on ? ' selected' : '') + '" draggable="' + (canEdit ? 'true' : 'false') + '" ' +
      'data-file-id="' + escAttr(f.id) + '" data-is-folder="' + (isFolder ? '1' : '0') + '" ' +
      'ondragstart="recExpDragStart(event)" ondragend="recExpDragEnd(event)" ' +
      (isFolder ? 'ondragover="recExpDragOverFolder(event)" ondragleave="recExpDragLeaveFolder(event)" ondrop="recExpDropOnFolder(event)" ' : '') +
      'onclick="recExpItemClick(event,\'' + escAttr(f.id) + '\')" ' +
      'ondblclick="recExpItemDblClick(event,\'' + escAttr(f.id) + '\')" ' +
      'oncontextmenu="recExpItemContextMenu(event,\'' + escAttr(f.id) + '\')">';
    h += '<span class="rec-exp-col-name"><span class="rec-exp-ico">' + recExpIcon(f) + '</span> ' + escAttr(f.name);
    if (shareLbl) h += ' <span class="rec-tag rec-tag-share" title="Compartido">↗ ' + escAttr(shareLbl) + '</span>';
    h += '</span>';
    h += '<span class="rec-exp-col-date">' + escAttr(recExpFmtDate(f.modifiedTime)) + '</span>';
    h += '<span class="rec-exp-col-type">' + escAttr(recExpTypeLabel(f)) + '</span>';
    h += '<span class="rec-exp-col-size">' + escAttr(isFolder ? '—' : recExpFmtSize(f.size)) + '</span>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

async function cargarRecursosRepoArchivos(pageToken) {
  const st = recExpState();
  const repoId = (st && st.repoId) || window._recursosRepoSel;
  const r = getRecursosRepoById(repoId);
  const el = document.getElementById('rec-repo-files');
  if (!r || !el) return;
  if (!recursosDriveConectado()) {
    el.innerHTML = '<div class="rec-info-banner warn">Conecte su correo en <a href="#" onclick="recursosIrACorreos();return false">Correos</a> para ver y adjuntar archivos. <button type="button" class="btn bsm" style="margin-left:8px" onclick="recursosModalCorreoRequerido(\'listar y adjuntar documentos en el repositorio\')">Más información</button></div>';
    return;
  }
  const s = getRepoScope(r);
  const canEdit = puedeEditarBiblioteca(s.scope, s.scopeId);
  const canShare = puedeCompartirRecursosItem(r);
  const rootId = r.driveFolderId || parseDriveFolderId(r.driveFolderLink);
  if (!rootId) {
    el.innerHTML = '<div class="rec-empty">Sin carpeta Drive vinculada.</div>';
    return;
  }
  if (!st || st.repoId !== repoId) {
    window._recExplorer = {
      repoId: repoId,
      rootId: rootId,
      folderId: rootId,
      path: [{ id: rootId, name: r.titulo || 'Repositorio' }],
      view: (window._recExplorer && window._recExplorer.view) || 'details',
      selection: [],
      files: [],
      lastClickedId: null,
      dragIds: null
    };
  } else {
    st.rootId = rootId;
    if (!st.folderId) st.folderId = rootId;
    if (!(st.path || []).length) st.path = [{ id: rootId, name: r.titulo || 'Repositorio' }];
  }
  const cur = recExpState();
  const folderId = cur.folderId || rootId;
  try {
    let files = [];
    let token = pageToken || '';
    do {
      const data = await driveListFolderContents(folderId, token || '');
      files = files.concat(data.files || []);
      token = data.nextPageToken || '';
    } while (token);
    cur.files = files;
    cur.selection = (cur.selection || []).filter(function(id) {
      return files.some(function(f) { return f.id === id; });
    });
    let h = '<div class="rec-exp" id="rec-exp-root" tabindex="0" ' +
      'ondragover="recExpDragOverPane(event)" ondragleave="recExpDragLeavePane(event)" ondrop="recExpDropOnPane(event)" ' +
      'onkeydown="recExpKeyDown(event)" onclick="recExpPaneClick(event)" oncontextmenu="recExpPaneContextMenu(event)">';
    h += renderRecExpToolbar(canEdit);
    h += renderRecExpBreadcrumb();
    h += '<div class="rec-exp-body">' + renderRecExpItemsHtml(files, canEdit, canShare, r) + '</div>';
    h += '</div>';
    el.innerHTML = h;
    setTimeout(function() {
      const root = document.getElementById('rec-exp-root');
      if (root) try { root.focus({ preventScroll: true }); } catch (e) {}
    }, 30);
  } catch (err) {
    const msg = String(err.message || 'Error al listar Drive');
    if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('correo')) {
      recursosModalCorreoRequerido('listar y adjuntar documentos en el repositorio');
    }
    el.innerHTML = '<div class="rec-info-banner warn">' + escAttr(msg) + '. <button type="button" class="btn bsm" onclick="recursosModalCorreoRequerido(\'usar la biblioteca Drive\')">Conectar correo</button></div>';
  }
}

function recExpSetView(view) {
  const st = recExpState();
  if (!st) return;
  st.view = view === 'icons' || view === 'list' ? view : 'details';
  cargarRecursosRepoArchivos();
}

function recExpNavigateToIndex(idx) {
  const st = recExpState();
  if (!st || idx < 0 || idx >= (st.path || []).length) return;
  st.path = st.path.slice(0, idx + 1);
  st.folderId = st.path[st.path.length - 1].id;
  st.selection = [];
  st.lastClickedId = null;
  cargarRecursosRepoArchivos();
}

function recExpEnterFolder(fileId) {
  const st = recExpState();
  const f = recExpItemById(fileId);
  if (!st || !f || !recExpIsFolder(f)) return;
  if (st.path.some(function(p) { return p.id === f.id; })) return;
  st.path.push({ id: f.id, name: f.name || 'Carpeta' });
  st.folderId = f.id;
  st.selection = [];
  st.lastClickedId = null;
  cargarRecursosRepoArchivos();
}

function recExpOpenFile(fileId) {
  const f = recExpItemById(fileId);
  if (!f) return;
  if (recExpIsFolder(f)) { recExpEnterFolder(fileId); return; }
  const link = f.webViewLink || ('https://drive.google.com/file/d/' + f.id + '/view');
  if (typeof openDriveVentanaEmergente === 'function') openDriveVentanaEmergente(link);
  else window.open(link, '_blank', 'noopener,noreferrer');
}

function recExpPreviewFile(fileId) {
  const f = recExpItemById(fileId);
  if (!f || recExpIsFolder(f)) return;
  const link = f.webViewLink || ('https://drive.google.com/file/d/' + f.id + '/view');
  if (typeof parseDrivePreviewUrl === 'function') {
    const prev = parseDrivePreviewUrl(link);
    if (prev && prev.preview) {
      window.open(prev.preview, '_blank', 'noopener,noreferrer');
      return;
    }
  }
  recExpOpenFile(fileId);
}

function recExpItemClick(ev, fileId) {
  ev.stopPropagation();
  recExpHideContextMenu();
  const st = recExpState();
  if (!st) return;
  const files = st.files || [];
  const ids = files.map(function(f) { return f.id; });
  if (ev.ctrlKey || ev.metaKey) {
    const set = new Set(st.selection || []);
    if (set.has(fileId)) set.delete(fileId); else set.add(fileId);
    st.selection = Array.from(set);
  } else if (ev.shiftKey && st.lastClickedId) {
    const a = ids.indexOf(st.lastClickedId);
    const b = ids.indexOf(fileId);
    if (a >= 0 && b >= 0) {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      st.selection = ids.slice(lo, hi + 1);
    } else st.selection = [fileId];
  } else {
    st.selection = [fileId];
  }
  st.lastClickedId = fileId;
  recExpRefreshSelectionUi();
}

function recExpItemDblClick(ev, fileId) {
  ev.preventDefault();
  ev.stopPropagation();
  recExpHideContextMenu();
  const f = recExpItemById(fileId);
  if (!f) return;
  if (recExpIsFolder(f)) recExpEnterFolder(fileId);
  else recExpOpenFile(fileId);
}

function recExpPaneClick(ev) {
  if (ev.target && ev.target.closest && ev.target.closest('[data-file-id]')) return;
  const st = recExpState();
  if (!st) return;
  st.selection = [];
  recExpHideContextMenu();
  recExpRefreshSelectionUi();
}

function recExpRefreshSelectionUi() {
  const st = recExpState();
  if (!st) return;
  const sel = new Set(st.selection || []);
  document.querySelectorAll('#rec-repo-files [data-file-id]').forEach(function(el) {
    el.classList.toggle('selected', sel.has(el.getAttribute('data-file-id')));
  });
}

function recExpKeyDown(ev) {
  const st = recExpState();
  if (!st) return;
  const tag = (ev.target && ev.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const canEdit = recExpCanEdit();
  if (ev.key === 'Backspace') {
    ev.preventDefault();
    if ((st.path || []).length > 1) recExpNavigateToIndex(st.path.length - 2);
    return;
  }
  if (ev.key === 'Enter' && (st.selection || []).length === 1) {
    ev.preventDefault();
    const f = recExpItemById(st.selection[0]);
    if (!f) return;
    if (recExpIsFolder(f)) recExpEnterFolder(f.id);
    else recExpOpenFile(f.id);
    return;
  }
  if (ev.key === 'F2' && canEdit && (st.selection || []).length === 1) {
    ev.preventDefault();
    recExpRenombrar(st.selection[0]);
    return;
  }
  if ((ev.key === 'Delete' || ev.key === 'Del') && canEdit && (st.selection || []).length) {
    ev.preventDefault();
    recExpEliminarSeleccion();
  }
}

async function recExpNuevaCarpeta() {
  if (!recExpCanEdit()) return;
  if (!recursosDriveConectado()) { recursosModalCorreoRequerido('crear carpetas en el repositorio'); return; }
  const nom = prompt('Nombre de la nueva carpeta:');
  if (nom == null) return;
  const name = String(nom).trim();
  if (!name) { notif('Nombre inválido', 'err'); return; }
  const folderId = recExpCurrentFolderId();
  try {
    const fn = typeof driveCreateFolder === 'function' ? driveCreateFolder : window.driveCreateFolder;
    await fn(name, folderId);
    notif('Carpeta creada', 'ok');
    if (typeof logAudit === 'function') logAudit('Creó carpeta en biblioteca', 'recursos', null, name);
    cargarRecursosRepoArchivos();
  } catch (err) {
    notif(err.message || 'No se pudo crear la carpeta', 'err');
  }
}

async function recExpSubirDesdeInput(ev) {
  const files = ev && ev.target && ev.target.files;
  await recExpUploadFileList(files);
  if (ev && ev.target) ev.target.value = '';
}

async function recExpUploadFileList(fileList, destFolderId) {
  if (!recExpCanEdit()) return;
  if (!recursosDriveConectado()) { recursosModalCorreoRequerido('adjuntar documentos al repositorio'); return; }
  const files = fileList ? Array.from(fileList) : [];
  if (!files.length) return;
  const folderId = destFolderId || recExpCurrentFolderId();
  if (!folderId) { notif('Sin carpeta Drive', 'err'); return; }
  notif('Subiendo ' + files.length + ' archivo(s)…', 'info');
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      await driveUploadBiblioteca(files[i], files[i].name, files[i].type || 'application/octet-stream', folderId);
      ok++;
    } catch (err) {
      notif('Error: ' + (err.message || files[i].name), 'err');
    }
  }
  if (ok) {
    notif(ok + ' archivo(s) subido(s)', 'ok');
    cargarRecursosRepoArchivos();
  }
}

async function subirRecursosRepoArchivos(ev, repoId) {
  const st = recExpState();
  if (!st || st.repoId !== repoId) {
    window._recursosRepoSel = repoId;
  }
  await recExpSubirDesdeInput(ev);
}

async function recExpRenombrar(fileId) {
  if (!recExpCanEdit()) return;
  const f = recExpItemById(fileId);
  if (!f) return;
  const nom = prompt('Nuevo nombre:', f.name || '');
  if (nom == null) return;
  const name = String(nom).trim();
  if (!name || name === f.name) return;
  try {
    const fn = typeof driveRenameInstitutional === 'function' ? driveRenameInstitutional : window.driveRenameInstitutional;
    const ok = await fn(fileId, name);
    if (!ok) throw new Error('No se pudo renombrar');
    notif('Renombrado', 'ok');
    cargarRecursosRepoArchivos();
  } catch (err) {
    notif(err.message || 'Error al renombrar', 'err');
  }
}

async function recExpEliminarSeleccion() {
  if (!recExpCanEdit()) return;
  const st = recExpState();
  const ids = (st && st.selection) || [];
  if (!ids.length) { notif('Seleccione uno o más elementos', 'err'); return; }
  const items = ids.map(recExpItemById).filter(Boolean);
  if (!items.length) return;
  const msg = items.length === 1
    ? ('¿Eliminar «' + (items[0].name || '') + '» de Drive? Esta acción no se puede deshacer fácilmente.')
    : ('¿Eliminar ' + items.length + ' elementos de Drive?');
  if (!confirm(msg)) return;
  const delFn = typeof driveDeleteBibliotecaItem === 'function' ? driveDeleteBibliotecaItem : window.driveDeleteBibliotecaItem;
  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    try {
      if (await delFn(items[i].id, recExpIsFolder(items[i]))) ok++;
    } catch (err) {
      notif('Error eliminando ' + (items[i].name || ''), 'err');
    }
  }
  if (ok) {
    notif(ok + ' eliminado(s)', 'ok');
    st.selection = [];
    cargarRecursosRepoArchivos();
  }
}

function recExpHideContextMenu() {
  const m = document.getElementById('rec-exp-ctx');
  if (m) m.remove();
}

function recExpPaneContextMenu(ev) {
  if (ev.target && ev.target.closest && ev.target.closest('[data-file-id]')) return;
  ev.preventDefault();
  const canEdit = recExpCanEdit();
  if (!canEdit) return;
  const st = recExpState();
  if (st) st.selection = [];
  recExpRefreshSelectionUi();
  recExpHideContextMenu();
  const menu = document.createElement('div');
  menu.id = 'rec-exp-ctx';
  menu.className = 'rec-exp-ctx';
  menu.style.left = Math.min(ev.clientX, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(ev.clientY, window.innerHeight - 160) + 'px';
  const add = function(label, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rec-exp-ctx-item';
    b.textContent = label;
    b.onclick = function() { recExpHideContextMenu(); fn(); };
    menu.appendChild(b);
  };
  add('Nueva carpeta', function() { recExpNuevaCarpeta(); });
  add('Subir archivos…', function() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.onchange = function(e) { recExpSubirDesdeInput(e); };
    inp.click();
  });
  add('Actualizar', function() { cargarRecursosRepoArchivos(); });
  document.body.appendChild(menu);
  const closer = function(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'mousedown' && menu.contains(e.target)) return;
    recExpHideContextMenu();
    document.removeEventListener('mousedown', closer, true);
    document.removeEventListener('keydown', closer, true);
  };
  setTimeout(function() {
    document.addEventListener('mousedown', closer, true);
    document.addEventListener('keydown', closer, true);
  }, 0);
}

function recExpItemContextMenu(ev, fileId) {
  ev.preventDefault();
  ev.stopPropagation();
  const st = recExpState();
  if (!st) return;
  if (!(st.selection || []).includes(fileId)) {
    st.selection = [fileId];
    st.lastClickedId = fileId;
    recExpRefreshSelectionUi();
  }
  const f = recExpItemById(fileId);
  if (!f) return;
  const canEdit = recExpCanEdit();
  const canShare = recExpCanShare();
  const isFolder = recExpIsFolder(f);
  recExpHideContextMenu();
  const menu = document.createElement('div');
  menu.id = 'rec-exp-ctx';
  menu.className = 'rec-exp-ctx';
  menu.style.left = Math.min(ev.clientX, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(ev.clientY, window.innerHeight - 280) + 'px';
  const add = function(label, fn, danger) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rec-exp-ctx-item' + (danger ? ' danger' : '');
    b.textContent = label;
    b.onclick = function() { recExpHideContextMenu(); fn(); };
    menu.appendChild(b);
  };
  add(isFolder ? 'Abrir' : 'Abrir', function() {
    if (isFolder) recExpEnterFolder(fileId); else recExpOpenFile(fileId);
  });
  if (!isFolder) {
    add('Vista previa', function() { recExpPreviewFile(fileId); });
    add('Abrir en Drive', function() {
      const link = f.webViewLink || ('https://drive.google.com/file/d/' + f.id + '/view');
      window.open(link, '_blank', 'noopener,noreferrer');
    });
  } else {
    add('Abrir en Drive', function() {
      window.open('https://drive.google.com/drive/folders/' + f.id, '_blank', 'noopener,noreferrer');
    });
  }
  if (canEdit) {
    add('Renombrar', function() { recExpRenombrar(fileId); });
  }
  if (!isFolder && canShare) {
    add('Compartir…', function() {
      const st2 = recExpState();
      recursosAbrirCompartir('archivo', st2.repoId, fileId, f.name);
    });
  }
  if (canEdit) {
    const sep = document.createElement('div');
    sep.className = 'rec-exp-ctx-sep';
    menu.appendChild(sep);
    add('Nueva carpeta aquí', function() { recExpNuevaCarpeta(); });
    add('Subir aquí…', function() {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true;
      inp.onchange = function(e) { recExpSubirDesdeInput(e); };
      inp.click();
    });
    add('Eliminar', function() { recExpEliminarSeleccion(); }, true);
  }
  document.body.appendChild(menu);
  const closer = function(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'mousedown' && menu.contains(e.target)) return;
    recExpHideContextMenu();
    document.removeEventListener('mousedown', closer, true);
    document.removeEventListener('keydown', closer, true);
  };
  setTimeout(function() {
    document.addEventListener('mousedown', closer, true);
    document.addEventListener('keydown', closer, true);
  }, 0);
}

function recExpDragStart(ev) {
  if (!recExpCanEdit()) { ev.preventDefault(); return; }
  const st = recExpState();
  const id = ev.currentTarget && ev.currentTarget.getAttribute('data-file-id');
  if (!st || !id) return;
  let ids = (st.selection || []).slice();
  if (ids.indexOf(id) < 0) ids = [id];
  st.dragIds = ids;
  st.selection = ids;
  recExpRefreshSelectionUi();
  try {
    ev.dataTransfer.setData('application/x-rec-exp-ids', JSON.stringify(ids));
    ev.dataTransfer.setData('text/plain', ids.join(','));
    ev.dataTransfer.effectAllowed = 'move';
  } catch (e) {}
  ev.currentTarget.classList.add('dragging');
}

function recExpDragEnd(ev) {
  const st = recExpState();
  if (st) st.dragIds = null;
  document.querySelectorAll('#rec-repo-files .drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
  document.querySelectorAll('#rec-repo-files .dragging').forEach(function(el) { el.classList.remove('dragging'); });
  const root = document.getElementById('rec-exp-root');
  if (root) root.classList.remove('ext-drag-over');
}

function recExpDragOverFolder(ev) {
  if (!recExpCanEdit()) return;
  ev.preventDefault();
  ev.stopPropagation();
  try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
  const row = ev.currentTarget;
  if (row) row.classList.add('drag-over');
}

function recExpDragLeaveFolder(ev) {
  const row = ev.currentTarget;
  if (row) row.classList.remove('drag-over');
}

async function recExpDropOnFolder(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const targetId = ev.currentTarget && ev.currentTarget.getAttribute('data-file-id');
  if (ev.currentTarget) ev.currentTarget.classList.remove('drag-over');
  if (!recExpCanEdit() || !targetId) return;

  // External files from OS → upload into target folder
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) {
    await recExpUploadFileList(ev.dataTransfer.files, targetId);
    return;
  }

  const st = recExpState();
  let ids = (st && st.dragIds) || [];
  if (!ids.length && ev.dataTransfer) {
    try {
      const raw = ev.dataTransfer.getData('application/x-rec-exp-ids') || '[]';
      ids = JSON.parse(raw);
    } catch (e) { ids = []; }
  }
  ids = (ids || []).filter(function(id) { return id && id !== targetId; });
  if (!ids.length) return;
  // Prevent dropping folder into itself
  if (ids.indexOf(targetId) >= 0) return;
  await recExpMoveIdsToFolder(ids, targetId);
}

function recExpDragOverPane(ev) {
  if (!recExpCanEdit()) return;
  if (!(ev.dataTransfer && ev.dataTransfer.types)) return;
  const types = Array.from(ev.dataTransfer.types || []);
  if (types.indexOf('Files') >= 0 || types.indexOf('application/x-rec-exp-ids') >= 0) {
    ev.preventDefault();
    const root = document.getElementById('rec-exp-root');
    if (root) root.classList.add('ext-drag-over');
  }
}

function recExpDragLeavePane(ev) {
  const root = document.getElementById('rec-exp-root');
  if (!root) return;
  if (ev.relatedTarget && root.contains(ev.relatedTarget)) return;
  root.classList.remove('ext-drag-over');
}

async function recExpDropOnPane(ev) {
  const root = document.getElementById('rec-exp-root');
  if (root) root.classList.remove('ext-drag-over');
  if (!recExpCanEdit()) return;
  // If dropping on a folder row, folder handler already ran
  if (ev.target && ev.target.closest && ev.target.closest('[data-is-folder="1"]')) return;
  ev.preventDefault();
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) {
    await recExpUploadFileList(ev.dataTransfer.files);
  }
}

async function recExpMoveIdsToFolder(ids, destFolderId) {
  if (!ids || !ids.length || !destFolderId) return;
  const moveFn = typeof driveMoveFileToFolder === 'function' ? driveMoveFileToFolder : window.driveMoveFileToFolder;
  const parentId = recExpCurrentFolderId();
  let ok = 0;
  for (let i = 0; i < ids.length; i++) {
    try {
      if (await moveFn(ids[i], destFolderId, parentId)) ok++;
    } catch (err) {
      console.warn('recExpMoveIdsToFolder:', err);
    }
  }
  if (ok) {
    notif(ok + ' elemento(s) movido(s)', 'ok');
    const st = recExpState();
    if (st) st.selection = [];
    cargarRecursosRepoArchivos();
  } else notif('No se pudo mover', 'err');
}

window.recExpSetView = recExpSetView;
window.recExpNavigateToIndex = recExpNavigateToIndex;
window.recExpItemClick = recExpItemClick;
window.recExpItemDblClick = recExpItemDblClick;
window.recExpItemContextMenu = recExpItemContextMenu;
window.recExpNuevaCarpeta = recExpNuevaCarpeta;
window.recExpSubirDesdeInput = recExpSubirDesdeInput;
window.recExpEliminarSeleccion = recExpEliminarSeleccion;
window.recExpKeyDown = recExpKeyDown;
window.recExpPaneClick = recExpPaneClick;
window.recExpPaneContextMenu = recExpPaneContextMenu;
window.recExpDragStart = recExpDragStart;
window.recExpDragEnd = recExpDragEnd;
window.recExpDragOverFolder = recExpDragOverFolder;
window.recExpDragLeaveFolder = recExpDragLeaveFolder;
window.recExpDropOnFolder = recExpDropOnFolder;
window.recExpDragOverPane = recExpDragOverPane;
window.recExpDragLeavePane = recExpDragLeavePane;
window.recExpDropOnPane = recExpDropOnPane;

function recursosMostrarFormEnlace(editId) {
  window._recursosEnlaceForm = editId || '__new__';
  renderRecursosPanel();
}

function recursosOcultarFormEnlace() {
  window._recursosEnlaceForm = null;
  renderRecursosPanel();
}

function renderRecursosEnlaceForm(editId) {
  const existing = editId && editId !== '__new__' ? enlacesVisiblesAdminTodos().find(function(l) { return l.id === editId; }) : null;
  const auto = getRecursosScopeAutoSesion();
  const scope = existing ? existing.scope : auto.scope;
  const scopeId = existing ? existing.scopeId : auto.scopeId;

  let h = '<div class="card rec-card rec-form-card"><div class="cft">' + (existing ? 'Editar enlace' : 'Nuevo enlace externo') + '</div><div class="fg">';
  if (recursosMuestraSelectorAmbito()) {
    h += renderRecursosScopeFields(scope, scopeId, 'rec-enl');
  } else {
    h += '<input type="hidden" id="rec-enl-scope" value="' + escAttr(scope) + '">';
    h += '<input type="hidden" id="rec-enl-scope-id" value="' + escAttr(scopeId) + '">';
    if (!existing) {
      h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 8px">Para: <strong>' + escAttr(labelRecursosScopeContexto(scope, scopeId)) + '</strong> y sus responsables asignados.</p>';
    }
  }
  h += '<div class="fld"><label>Título</label><input type="text" id="rec-enl-titulo" value="' + escAttr(existing && existing.titulo || '') + '"></div>';
  h += '<div class="fld"><label>URL</label><input type="url" id="rec-enl-url" value="' + escAttr(existing && existing.url || '') + '" placeholder="https://…"></div>';
  h += '<div class="fld"><label>Área</label><input type="text" id="rec-enl-area" value="' + escAttr(existing && existing.area || '') + '" placeholder="Texto libre"></div>';
  h += '<div class="fld"><label>Temática</label><input type="text" id="rec-enl-tematica" value="' + escAttr(existing && existing.tematica || '') + '" placeholder="Texto libre"></div>';
  h += '<div class="fld"><label>Descripción (opcional)</label><textarea id="rec-enl-desc" rows="2">' + escTextarea(existing && existing.descripcion || '') + '</textarea></div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn bsm bp" onclick="guardarRecursosEnlace(\'' + escAttr(editId || '__new__') + '\')">Guardar</button>';
  h += '<button type="button" class="btn bsm" onclick="recursosOcultarFormEnlace()">Cancelar</button></div>';
  h += '</div></div>';
  return h;
}

function renderRecursosScopeFields(scope, scopeId, prefix) {
  let h = '<div class="fld"><label>Ámbito</label><select id="' + prefix + '-scope" onchange="recScopeFormChange(\'' + prefix + '\')">';
  h += '<option value="sistema"' + (scope === 'sistema' ? ' selected' : '') + '>Todo el sistema</option>';
  h += '<option value="departamento"' + (scope === 'departamento' ? ' selected' : '') + '>Departamento</option>';
  h += '<option value="oficina"' + (scope === 'oficina' ? ' selected' : '') + '>Oficina</option></select></div>';
  h += '<div class="fld" id="' + prefix + '-scope-id-wrap"' + (scope === 'sistema' ? ' style="display:none"' : '') + '>';
  h += '<label id="' + prefix + '-scope-lbl">' + (scope === 'oficina' ? 'Oficina' : 'Departamento') + '</label>';
  h += '<select id="' + prefix + '-scope-id">';
  if (scope !== 'sistema') {
    const list = scope === 'oficina' ? OFICINAS_DEGUV : DEPTOS;
    list.forEach(function(x) {
      h += '<option value="' + escAttr(x.id) + '"' + (x.id === scopeId ? ' selected' : '') + '>' + escAttr(x.nombre) + '</option>';
    });
  }
  h += '</select></div>';
  return h;
}

function recScopeFormChange(prefix) {
  const scope = document.getElementById(prefix + '-scope').value;
  const wrap = document.getElementById(prefix + '-scope-id-wrap');
  const sel = document.getElementById(prefix + '-scope-id');
  const lbl = document.getElementById(prefix + '-scope-lbl');
  if (!wrap || !sel) return;
  if (scope === 'sistema') {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  lbl.textContent = scope === 'oficina' ? 'Oficina' : 'Departamento';
  sel.innerHTML = '';
  const list = scope === 'oficina' ? OFICINAS_DEGUV : DEPTOS;
  list.forEach(function(x) {
    sel.insertAdjacentHTML('beforeend', '<option value="' + escAttr(x.id) + '">' + escAttr(x.nombre) + '</option>');
  });
}

function recEnlaceFormScopePickChange() {
  const pick = document.getElementById('rec-enl-scope-pick');
  const creables = getRecursosScopesCreablesSesion();
  const c = creables[Number(pick && pick.value) || 0];
  if (!c) return;
  document.getElementById('rec-enl-scope').value = c.scope;
  document.getElementById('rec-enl-scope-id').value = c.scopeId;
}

function recEnlaceFormScopeChange() {
  recScopeFormChange('rec-enl');
}

async function guardarRecursosEnlace(editId) {
  const scopeEl = document.getElementById('rec-enl-scope');
  const scopeIdEl = document.getElementById('rec-enl-scope-id');
  const scope = scopeEl ? scopeEl.value : 'departamento';
  const scopeId = scope === 'sistema' ? 'sistema' : (scopeIdEl ? scopeIdEl.value : '');
  const titulo = String(document.getElementById('rec-enl-titulo').value || '').trim();
  const url = String(document.getElementById('rec-enl-url').value || '').trim();
  const area = String(document.getElementById('rec-enl-area').value || '').trim();
  const tematica = String(document.getElementById('rec-enl-tematica').value || '').trim();
  const descripcion = String(document.getElementById('rec-enl-desc').value || '').trim();
  if (!titulo || !url) { notif('Título y URL son obligatorios', 'err'); return; }
  if (!puedeEditarRecursosEnlaces(scope, scopeId) && !esAdministrador()) {
    notif('No tiene permiso para editar enlaces de este ámbito', 'err');
    return;
  }
  const isNew = !editId || editId === '__new__';
  const email = getAuthEmailNorm() || (window._usuarioActual && window._usuarioActual.email) || '';
  const byAdmin = esAdministrador() || esAdminFirestore();
  if (!isNew) {
    const idx = recursosEnlaces.findIndex(function(l) { return l.id === editId; });
    if (idx < 0) return;
    recursosEnlaces[idx] = Object.assign({}, recursosEnlaces[idx], {
      titulo: titulo, url: url, area: area, tematica: tematica, descripcion: descripcion,
      scope: scope, scopeId: scopeId, updatedAt: new Date().toISOString(), updatedBy: email
    });
  } else {
    recursosEnlaces.push({
      id: 'enl' + Date.now(),
      titulo: titulo, url: url, area: area, tematica: tematica, descripcion: descripcion,
      scope: scope, scopeId: scopeId, activo: true, createdByAdmin: byAdmin, compartidoCon: [],
      createdAt: new Date().toISOString(), createdBy: email, updatedAt: new Date().toISOString()
    });
  }
  window._recursosEnlaceForm = null;
  window._recursosCfgForm = null;
  const ok = await saveRecursosFirestore();
  if (ok) {
    notif('Enlace guardado', 'ok');
    if (typeof logAudit === 'function') logAudit('Guardó enlace en Recursos', 'configuracion', null, titulo);
    renderRecursosPanel();
    if (typeof renderListasCfg === 'function') renderListasCfg();
  } else notif('Error al guardar en Firestore', 'err');
}

async function eliminarRecursosEnlace(id) {
  const l = (recursosEnlaces || []).find(function(x) { return x.id === id; });
  if (!l || !puedeEliminarRecursosItem(l)) {
    notif(l && recursosCreadoPorAdmin(l) ? 'Solo el administrador puede eliminar este enlace' : 'Sin permiso', 'err');
    return;
  }
  if (!confirm('¿Eliminar este enlace?')) return;
  recursosEnlaces = recursosEnlaces.filter(function(x) { return x.id !== id; });
  const ok = await saveRecursosFirestore();
  if (ok) { notif('Enlace eliminado', 'ok'); renderRecursosPanel(); if (typeof renderListasCfg === 'function') renderListasCfg(); }
}

function recursosMostrarFormRepo(editId) {
  window._recursosRepoForm = editId || '__new__';
  renderRecursosPanel();
}

function recursosOcultarFormRepo() {
  window._recursosRepoForm = null;
  renderRecursosPanel();
}

function renderRecursosRepoForm(editId) {
  const existing = editId && editId !== '__new__' ? getRecursosRepoById(editId) : null;
  const auto = getRecursosScopeAutoSesion();
  const s = existing ? getRepoScope(existing) : auto;
  const scope = s.scope;
  const scopeId = s.scopeId;
  let h = '<div class="card rec-card rec-form-card"><div class="cft">' + (existing ? 'Editar repositorio' : 'Nuevo repositorio') + '</div><div class="fg">';
  if (recursosMuestraSelectorAmbito()) {
    h += renderRecursosScopeFields(scope, scopeId, 'rec-repo');
  } else {
    h += '<input type="hidden" id="rec-repo-scope" value="' + escAttr(scope) + '">';
    h += '<input type="hidden" id="rec-repo-scope-id" value="' + escAttr(scopeId) + '">';
    if (!existing) {
      h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 8px">Para: <strong>' + escAttr(labelRecursosScopeContexto(scope, scopeId)) + '</strong> y sus responsables asignados.</p>';
    }
  }
  h += '<div class="fld"><label>Título</label><input type="text" id="rec-repo-titulo" value="' + escAttr(existing && existing.titulo || '') + '"></div>';
  h += '<div class="fld"><label>Temática</label><input type="text" id="rec-repo-tematica" value="' + escAttr(existing && existing.tematica || '') + '"></div>';
  h += '<div class="fld"><label>Descripción</label><textarea id="rec-repo-desc" rows="2">' + escTextarea(existing && existing.descripcion || '') + '</textarea></div>';
  if (!existing) {
    h += '<div class="fld"><label>Vincular carpeta Drive existente (opcional)</label><input type="url" id="rec-repo-drive-link" placeholder="https://drive.google.com/drive/folders/…"><span style="font-size:11px;color:var(--tx3)">Si se deja vacío, se crea carpeta en Drive institucional.</span></div>';
  }
  h += '<div style="display:flex;gap:8px"><button type="button" class="btn bsm bp" onclick="guardarRecursosRepo(\'' + escAttr(editId || '__new__') + '\')">Guardar</button>';
  h += '<button type="button" class="btn bsm" onclick="recursosOcultarFormRepo()">Cancelar</button></div>';
  h += '</div></div>';
  return h;
}

function recRepoFormScopePickChange() {
  const pick = document.getElementById('rec-repo-scope-pick');
  const creables = getRecursosScopesCreablesSesion();
  const c = creables[Number(pick && pick.value) || 0];
  if (!c) return;
  document.getElementById('rec-repo-scope').value = c.scope;
  document.getElementById('rec-repo-scope-id').value = c.scopeId;
}

async function guardarRecursosRepo(editId) {
  const scopeEl = document.getElementById('rec-repo-scope');
  const scopeIdEl = document.getElementById('rec-repo-scope-id');
  const scope = scopeEl ? scopeEl.value : 'oficina';
  const scopeId = scope === 'sistema' ? 'sistema' : (scopeIdEl ? scopeIdEl.value : '');
  if (!puedeEditarBiblioteca(scope, scopeId)) { notif('No tiene permiso para gestionar repositorios en este ámbito', 'err'); return; }
  const titulo = String(document.getElementById('rec-repo-titulo').value || '').trim();
  const tematica = String(document.getElementById('rec-repo-tematica').value || '').trim();
  const descripcion = String(document.getElementById('rec-repo-desc').value || '').trim();
  if (!titulo) { notif('El título es obligatorio', 'err'); return; }
  const isNew = !editId || editId === '__new__';
  const email = getAuthEmailNorm() || '';
  const byAdmin = esAdministrador() || esAdminFirestore();
  if (!isNew) {
    const idx = bibliotecaRepos.findIndex(function(r) { return r.id === editId; });
    if (idx < 0) return;
    bibliotecaRepos[idx] = Object.assign({}, bibliotecaRepos[idx], {
      titulo: titulo, tematica: tematica, descripcion: descripcion,
      scope: scope, scopeId: scopeId,
      oficinaId: scope === 'oficina' ? scopeId : '',
      updatedAt: new Date().toISOString(), updatedBy: email
    });
  } else {
    let driveFolderId = '';
    let driveFolderLink = '';
    const linkInp = document.getElementById('rec-repo-drive-link');
    const manualLink = linkInp ? String(linkInp.value || '').trim() : '';
    if (manualLink) {
      driveFolderId = parseDriveFolderId(manualLink);
      driveFolderLink = manualLink;
      if (!driveFolderId) { notif('Enlace de carpeta Drive no válido', 'err'); return; }
    } else {
      if (!recursosDriveConectado()) {
        recursosModalCorreoRequerido('crear carpetas en Drive y adjuntar documentos al repositorio');
        return;
      }
      const driveFn = typeof driveEnsureBibliotecaRepoFolder === 'function'
        ? driveEnsureBibliotecaRepoFolder
        : (typeof window.driveEnsureBibliotecaRepoFolder === 'function' ? window.driveEnsureBibliotecaRepoFolder : null);
      if (!driveFn) {
        notif('No se cargó el módulo Drive. Recargue la página (Ctrl+F5) y conecte correo en Correos.', 'err');
        return;
      }
      try {
        const created = await driveFn(scope, scopeId, titulo);
        driveFolderId = created.folderId;
        driveFolderLink = created.link;
      } catch (err) {
        notif(err.message || 'Error creando carpeta en Drive', 'err');
        return;
      }
    }
    bibliotecaRepos.push({
      id: 'repo' + Date.now(),
      titulo: titulo, tematica: tematica, descripcion: descripcion,
      scope: scope, scopeId: scopeId,
      oficinaId: scope === 'oficina' ? scopeId : '',
      driveFolderId: driveFolderId, driveFolderLink: driveFolderLink,
      activo: true, createdByAdmin: byAdmin,
      compartidoCon: [],
      archivosCompartidos: [],
      vinculados: [],
      createdAt: new Date().toISOString(), createdBy: email,
      updatedAt: new Date().toISOString()
    });
  }
  window._recursosRepoForm = null;
  window._recursosCfgForm = null;
  const ok = await saveRecursosFirestore();
  if (ok) {
    notif('Repositorio guardado', 'ok');
    if (typeof logAudit === 'function') logAudit('Guardó repositorio biblioteca', 'configuracion', null, titulo);
    renderRecursosPanel();
    if (typeof renderListasCfg === 'function') renderListasCfg();
  } else notif('Error al guardar', 'err');
}

async function eliminarRecursosRepo(id) {
  const r = getRecursosRepoById(id);
  if (!r || !puedeEliminarRecursosItem(r)) {
    notif(r && recursosCreadoPorAdmin(r) ? 'Solo el administrador puede eliminar este repositorio' : 'Sin permiso', 'err');
    return;
  }
  if (!confirm('¿Eliminar este repositorio de la biblioteca? (La carpeta en Drive no se borra)')) return;
  const vinc = bibNormalizeVinculosList(r.vinculados);
  bibliotecaRepos = bibliotecaRepos.filter(function(x) { return x.id !== id; });
  vinc.forEach(function(v) { bibRemoveRepoIdFromEntidad(v, id); });
  const ok = await saveRecursosFirestore();
  if (ok) {
    for (let i = 0; i < vinc.length; i++) {
      try { await bibPersistEntidadVinculo(vinc[i]); } catch (err) { console.warn('limpiar vínculo al eliminar repo:', err); }
    }
    window._recursosRepoSel = null;
    notif('Repositorio eliminado', 'ok');
    renderRecursosPanel();
    if (typeof renderListasCfg === 'function') renderListasCfg();
  }
}

function recursosAbrirCompartir(tipo, id, fileId, fileName) {
  window._recShareCtx = { tipo: tipo, id: id, fileId: fileId || '', fileName: fileName || '' };
  const ov = document.getElementById('rec-share-overlay');
  const body = document.getElementById('rec-share-body');
  if (!ov || !body) return;
  let item = null;
  let titulo = '';
  if (tipo === 'enlace') {
    item = (recursosEnlaces || []).find(function(l) { return l.id === id; });
    titulo = item ? (item.titulo || 'Enlace') : 'Enlace';
  } else if (tipo === 'repo') {
    item = getRecursosRepoById(id);
    titulo = item ? item.titulo : 'Repositorio';
  } else if (tipo === 'archivo') {
    item = getRecursosRepoById(id);
    const f = item && (item.archivosCompartidos || []).find(function(a) { return a.fileId === fileId; });
    titulo = f ? f.fileName : 'Documento';
  }
  if (!item || !puedeCompartirRecursosItem(item)) {
    notif('Sin permiso para compartir', 'err');
    return;
  }
  let sel = [];
  if (tipo === 'archivo') {
    const f = (item.archivosCompartidos || []).find(function(a) { return a.fileId === fileId; });
    sel = f ? (f.compartidoCon || []).slice() : [];
  } else {
    sel = (item.compartidoCon || []).slice();
  }
  const ofis = getRecursosOficinasParaCompartir(item);
  let h = '<p style="font-size:13px;color:var(--tx2);margin:0 0 12px">Seleccione las oficinas que podrán ver <strong>' + escAttr(titulo) + '</strong> en su pestaña Recursos.</p>';
  h += '<div class="rec-share-ofis">';
  ofis.forEach(function(o) {
    const checked = sel.includes(o.id);
    h += '<label class="rec-share-ofi-lbl"><input type="checkbox" value="' + escAttr(o.id) + '"' + (checked ? ' checked' : '') + '> ' + escAttr(o.nombre) + '</label>';
  });
  h += '</div>';
  if (!ofis.length) h += '<p style="font-size:12px;color:var(--tx3)">No hay otras oficinas disponibles para compartir.</p>';
  body.innerHTML = h;
  const titEl = document.getElementById('rec-share-title');
  if (titEl) titEl.textContent = tipo === 'archivo' ? 'Compartir documento' : (tipo === 'repo' ? 'Compartir repositorio' : 'Compartir enlace');
  if (typeof elevateOverlayAboveModals === 'function') elevateOverlayAboveModals(ov);
  ov.classList.add('on');
  ov.setAttribute('aria-hidden', 'false');
}

function recursosCerrarCompartir() {
  const ov = document.getElementById('rec-share-overlay');
  if (ov) {
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
    if (typeof resetOverlayElevation === 'function') resetOverlayElevation(ov);
  }
  window._recShareCtx = null;
}

async function recursosGuardarCompartir() {
  const ctx = window._recShareCtx;
  if (!ctx) return;
  const body = document.getElementById('rec-share-body');
  const checks = body ? body.querySelectorAll('input[type=checkbox]:checked') : [];
  const sel = Array.from(checks).map(function(c) { return c.value; });
  const email = getAuthEmailNorm() || '';
  if (ctx.tipo === 'enlace') {
    const idx = recursosEnlaces.findIndex(function(l) { return l.id === ctx.id; });
    if (idx < 0) return;
    recursosEnlaces[idx] = Object.assign({}, recursosEnlaces[idx], {
      compartidoCon: sel,
      updatedAt: new Date().toISOString(),
      updatedBy: email
    });
  } else if (ctx.tipo === 'repo') {
    const idx = bibliotecaRepos.findIndex(function(r) { return r.id === ctx.id; });
    if (idx < 0) return;
    bibliotecaRepos[idx] = Object.assign({}, bibliotecaRepos[idx], {
      compartidoCon: sel,
      updatedAt: new Date().toISOString(),
      updatedBy: email
    });
  } else if (ctx.tipo === 'archivo') {
    const idx = bibliotecaRepos.findIndex(function(r) { return r.id === ctx.id; });
    if (idx < 0) return;
    const repo = bibliotecaRepos[idx];
    if (!Array.isArray(repo.archivosCompartidos)) repo.archivosCompartidos = [];
    let arch = repo.archivosCompartidos.find(function(a) { return a.fileId === ctx.fileId; });
    if (!arch) {
      arch = {
        fileId: ctx.fileId,
        fileName: ctx.fileName || 'Documento',
        driveLink: 'https://drive.google.com/file/d/' + ctx.fileId + '/view',
        compartidoCon: []
      };
      repo.archivosCompartidos.push(arch);
    }
    arch.compartidoCon = sel;
    bibliotecaRepos[idx] = Object.assign({}, repo, {
      archivosCompartidos: repo.archivosCompartidos.slice(),
      updatedAt: new Date().toISOString(),
      updatedBy: email
    });
  }
  const ok = await saveRecursosFirestore();
  if (ok) {
    notif('Compartido actualizado', 'ok');
    recursosCerrarCompartir();
    renderRecursosPanel();
    if (window._recursosRepoSel && ctx.tipo === 'archivo') cargarRecursosRepoArchivos();
    if (typeof renderListasCfg === 'function') renderListasCfg();
  } else notif('Error al guardar', 'err');
}

async function guardarRecursosConfigDrive() {
  if (!esAdministrador()) { notif('Solo administrador', 'err'); return; }
  const g = document.getElementById('rec-cfg-guainia');
  const v = document.getElementById('rec-cfg-vaupes');
  recursosConfig = recursosConfig || {};
  if (g) recursosConfig.guainiaDriveRoot = String(g.value || '').trim();
  if (v) recursosConfig.vaupesDriveRoot = String(v.value || '').trim();
  const ok = await saveRecursosFirestore();
  if (ok) { notif('Configuración guardada', 'ok'); renderRecursosPanel(); if (typeof renderListasCfg === 'function') renderListasCfg(); }
  else notif('Error al guardar', 'err');
}

function recursosCfgCardBody() {
  if (!esAdministrador() && !esAdminFirestore()) return '';
  const enlaces = enlacesVisiblesAdminTodos();
  const repos = normalizeBibliotecaReposList(bibliotecaRepos).filter(function(r) { return r.activo !== false; });
  let h = '<div class="cfcard">';
  h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 12px">Gestione enlaces y repositorios por ámbito: <strong>todo el sistema</strong> (visible para todos los roles internos), <strong>departamento</strong> (Guaviare, Guainía o Vaupés) u <strong>oficina</strong> (compartido con responsables asignados a esa oficina).</p>';
  h += '<div class="fg" style="margin-bottom:14px"><div class="fld"><label>Guainía — carpeta Drive regional</label><input type="url" id="rec-cfg-guainia" value="' + escAttr(recursosConfig.guainiaDriveRoot || '') + '" placeholder="https://drive.google.com/drive/folders/…"></div>';
  h += '<div class="fld"><label>Vaupés — carpeta Drive regional</label><input type="url" id="rec-cfg-vaupes" value="' + escAttr(recursosConfig.vaupesDriveRoot || '') + '" placeholder="https://drive.google.com/drive/folders/…"></div></div>';
  h += '<button type="button" class="btn bsm bp" style="margin-bottom:14px" onclick="guardarRecursosConfigDrive()">Guardar carpetas regionales</button>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  h += '<button type="button" class="btn bsm bp" onclick="recursosCfgNuevoEnlace()">+ Enlace</button>';
  h += '<button type="button" class="btn bsm bp" onclick="recursosCfgNuevoRepo()">+ Repositorio</button>';
  h += '<button type="button" class="btn bsm" onclick="showTab(\'rec\')">Abrir pestaña Recursos</button>';
  h += '</div>';
  if (window._recursosCfgForm === 'enlace') h += renderRecursosEnlaceForm(window._recursosCfgEditId || '__new__');
  if (window._recursosCfgForm === 'repo') h += renderRecursosRepoForm(window._recursosCfgEditId || '__new__');
  h += '<div style="font-size:11px;font-weight:700;color:var(--tx2);margin:12px 0 6px">Enlaces (' + enlaces.length + ')</div>';
  if (!enlaces.length) h += '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">Sin enlaces registrados.</div>';
  else {
    h += '<ul class="cfl cfl-vertical" style="margin-bottom:14px">';
    enlaces.forEach(function(l) {
      h += '<li class="cfi" style="align-items:flex-start;gap:8px"><div style="flex:1;min-width:0">';
      h += '<span class="rec-badge" style="margin-right:6px">' + escAttr(labelScopeEnlace(l)) + '</span>';
      h += '<strong>' + escAttr(l.titulo || l.url) + '</strong>';
      if (l.area) h += ' <span class="rec-tag">' + escAttr(l.area) + '</span>';
      h += '</div><div class="fx" style="gap:4px;flex-shrink:0">';
      h += '<button type="button" class="btn bsm" onclick="recursosCfgEditarEnlace(\'' + escAttr(l.id) + '\')">Editar</button>';
      if (puedeEliminarRecursosItem(l)) {
        h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosEnlace(\'' + escAttr(l.id) + '\')">✕</button>';
      }
      h += '</div></li>';
    });
    h += '</ul>';
  }
  h += '<div style="font-size:11px;font-weight:700;color:var(--tx2);margin:12px 0 6px">Repositorios (' + repos.length + ')</div>';
  if (!repos.length) h += '<div style="font-size:12px;color:var(--tx3)">Sin repositorios registrados.</div>';
  else {
    h += '<ul class="cfl cfl-vertical">';
    repos.forEach(function(r) {
      h += '<li class="cfi" style="align-items:flex-start;gap:8px"><div style="flex:1;min-width:0">';
      h += '<span class="rec-badge" style="margin-right:6px">' + escAttr(labelScopeRepo(r)) + '</span>';
      h += '<strong>' + escAttr(r.titulo) + '</strong>';
      h += '</div><div class="fx" style="gap:4px;flex-shrink:0">';
      h += '<button type="button" class="btn bsm" onclick="recursosCfgEditarRepo(\'' + escAttr(r.id) + '\')">Editar</button>';
      h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosRepo(\'' + escAttr(r.id) + '\')">✕</button></div></li>';
    });
    h += '</ul>';
  }
  h += '</div>';
  return h;
}

function recursosCfgNuevoEnlace() {
  window._recursosCfgForm = 'enlace';
  window._recursosCfgEditId = '__new__';
  if (typeof renderListasCfg === 'function') renderListasCfg();
}

function recursosCfgNuevoRepo() {
  window._recursosCfgForm = 'repo';
  window._recursosCfgEditId = '__new__';
  if (typeof renderListasCfg === 'function') renderListasCfg();
}

function recursosCfgEditarEnlace(id) {
  window._recursosCfgForm = 'enlace';
  window._recursosCfgEditId = id;
  if (typeof renderListasCfg === 'function') renderListasCfg();
}

function recursosCfgEditarRepo(id) {
  window._recursosCfgForm = 'repo';
  window._recursosCfgEditId = id;
  if (typeof renderListasCfg === 'function') renderListasCfg();
}

// ── Asociación actividad / trámite / PQRSD ↔ repositorio Biblioteca ──────────

function bibVinculoKey(v) {
  if (!v) return '';
  return [v.tipo || '', v.id || '', v.taskId || ''].join('|');
}

function bibGetRepoIdsFromExp(e) {
  if (!e) return [];
  const raw = e._biblioteca_repo_ids;
  if (Array.isArray(raw)) return raw.map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a.map(function(x) { return String(x || '').trim(); }).filter(Boolean) : [];
    } catch (err) { return []; }
  }
  return [];
}

function bibGetRepoIdsFromTask(t) {
  if (!t) return [];
  const raw = t.bibliotecaRepoIds;
  if (Array.isArray(raw)) return raw.map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  return [];
}

function bibTipoLabel(tipo) {
  if (tipo === 'pqrsd') return 'PQRSD';
  if (tipo === 'actividad') return 'Actividad';
  return 'Trámite';
}

function bibResolveTaskRef(v) {
  if (!v || v.tipo !== 'actividad') return null;
  if (v.libre || (typeof isActLibreRef === 'function' && isActLibreRef(v.id, v.taskId))) {
    return (typeof getActLibreById === 'function' && getActLibreById(v.taskId))
      || (typeof getActLibreByCodigo === 'function' && getActLibreByCodigo(v.id))
      || null;
  }
  const e = typeof getExpById === 'function' ? getExpById(v.id) : null;
  if (!e) return null;
  return (e.tasks || []).find(function(x) { return x && String(x.id) === String(v.taskId); }) || null;
}

function bibAddRepoIdToEntidad(v, repoId) {
  if (!v || !repoId) return false;
  if (v.tipo === 'expediente' || v.tipo === 'pqrsd') {
    const e = typeof getExpById === 'function' ? getExpById(v.id) : null;
    if (!e) return false;
    const ids = bibGetRepoIdsFromExp(e);
    if (ids.indexOf(repoId) < 0) ids.push(repoId);
    e._biblioteca_repo_ids = ids;
    return true;
  }
  if (v.tipo === 'actividad') {
    const t = bibResolveTaskRef(v);
    if (!t) return false;
    if (!Array.isArray(t.bibliotecaRepoIds)) t.bibliotecaRepoIds = [];
    if (t.bibliotecaRepoIds.indexOf(repoId) < 0) t.bibliotecaRepoIds.push(repoId);
    return true;
  }
  return false;
}

function bibRemoveRepoIdFromEntidad(v, repoId) {
  if (!v || !repoId) return false;
  if (v.tipo === 'expediente' || v.tipo === 'pqrsd') {
    const e = typeof getExpById === 'function' ? getExpById(v.id) : null;
    if (!e) return false;
    e._biblioteca_repo_ids = bibGetRepoIdsFromExp(e).filter(function(id) { return id !== repoId; });
    return true;
  }
  if (v.tipo === 'actividad') {
    const t = bibResolveTaskRef(v);
    if (!t) return false;
    t.bibliotecaRepoIds = bibGetRepoIdsFromTask(t).filter(function(id) { return id !== repoId; });
    return true;
  }
  return false;
}

async function bibPersistEntidadVinculo(v) {
  if (!v) return false;
  if (v.tipo === 'expediente' || v.tipo === 'pqrsd') {
    const e = typeof getExpById === 'function' ? getExpById(v.id) : null;
    if (!e) return false;
    if (typeof persistExpedienteGranularAsync === 'function') return !!(await persistExpedienteGranularAsync(e, true));
    if (typeof persistExpedienteGranular === 'function') { persistExpedienteGranular(e, true); return true; }
    return false;
  }
  if (v.tipo === 'actividad') {
    if (v.libre || (typeof isActLibreRef === 'function' && isActLibreRef(v.id, v.taskId))) {
      if (typeof persistActividadesLibresFirestore === 'function') return !!(await persistActividadesLibresFirestore());
      return false;
    }
    const e = typeof getExpById === 'function' ? getExpById(v.id) : null;
    if (!e) return false;
    if (typeof persistExpedienteGranularAsync === 'function') return !!(await persistExpedienteGranularAsync(e, true));
    if (typeof persistExpedienteGranular === 'function') { persistExpedienteGranular(e, true); return true; }
  }
  return false;
}

function bibCandidatosAsociar(tipo, q) {
  const ql = String(q || '').trim().toLowerCase();
  const out = [];
  const pushExp = function(e, tipoForce) {
    if (!e || (typeof expEstaEnPapelera === 'function' && expEstaEnPapelera(e))) return;
    const esPqrs = typeof esPqrsSecretaria === 'function' && esPqrsSecretaria(e);
    const tip = tipoForce || (esPqrs ? 'pqrsd' : 'expediente');
    if (tipo === 'expediente' && tip !== 'expediente') return;
    if (tipo === 'pqrsd' && tip !== 'pqrsd') return;
    const id = String(e._exp || '').trim();
    if (!id) return;
    const nom = typeof getNom === 'function' ? getNom(e) : '';
    const hay = (id + ' ' + nom + ' ' + (e._tramite || '')).toLowerCase();
    if (ql && hay.indexOf(ql) < 0) return;
    out.push({
      tipo: tip,
      id: id,
      taskId: '',
      libre: false,
      depto: e._depto || '',
      label: id + ' · ' + (nom || tip)
    });
  };
  const pushAct = function(t, expId, libre) {
    if (!t || t.eliminada) return;
    const tid = String(t.id || '').trim();
    if (!tid) return;
    const ref = libre ? String(t.codigo || t.id || '') : String(expId || '');
    const act = String(t.actividad || t.desc || '').trim();
    const hay = (ref + ' ' + act + ' ' + (t.responsable || '')).toLowerCase();
    if (ql && hay.indexOf(ql) < 0) return;
    out.push({
      tipo: 'actividad',
      id: ref,
      taskId: tid,
      libre: !!libre,
      depto: t.depto || '',
      label: (libre ? 'Libre · ' : '') + ref + ' · ' + (act || 'Actividad')
    });
  };

  if (!tipo || tipo === 'expediente' || tipo === 'pqrsd') {
    (exps || []).forEach(function(e) { pushExp(e); });
  }
  if (!tipo || tipo === 'actividad') {
    (exps || []).forEach(function(e) {
      if (!e || (typeof expEstaEnPapelera === 'function' && expEstaEnPapelera(e))) return;
      (e.tasks || []).forEach(function(t) { pushAct(t, e._exp, false); });
    });
    (actividadesLibres || []).forEach(function(t) { pushAct(t, '', true); });
  }
  return out.slice(0, 40);
}

function renderRecursosRepoVinculosBlock(r, canEdit) {
  const list = bibNormalizeVinculosList(r && r.vinculados);
  let h = '<div class="rec-vinc-block">';
  h += '<div class="cft" style="margin:14px 0 8px">Casos asociados <span style="font-weight:400;color:var(--tx3);font-size:12px">(' + list.length + ')</span></div>';
  h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 10px">Vincule trámites, PQRSD o actividades que compartan el contexto de esta carpeta.</p>';

  if (canEdit) {
    h += '<div class="rec-vinc-form">';
    h += '<select id="rec-bib-vinc-tipo" class="rec-inp" onchange="bibRefreshBusquedaVinculos()">';
    h += '<option value="">Todos</option>';
    h += '<option value="expediente">Trámite / expediente</option>';
    h += '<option value="pqrsd">PQRSD</option>';
    h += '<option value="actividad">Actividad</option>';
    h += '</select>';
    h += '<input type="search" id="rec-bib-vinc-q" class="rec-inp" placeholder="Buscar por N°, nombre o actividad…" oninput="bibRefreshBusquedaVinculos()">';
    h += '</div>';
    h += '<div id="rec-bib-vinc-results" class="rec-vinc-results"></div>';
  }

  if (!list.length) {
    h += '<div class="rec-empty" style="padding:12px">Aún no hay casos asociados a esta carpeta.</div>';
  } else {
    h += '<div class="rec-vinc-list">';
    list.forEach(function(v) {
      h += '<div class="rec-vinc-row">';
      h += '<div><span class="rec-badge">' + escAttr(bibTipoLabel(v.tipo)) + '</span> ';
      h += '<strong>' + escAttr(v.label || v.id) + '</strong>';
      if (v.depto) h += ' <span style="font-size:11px;color:var(--tx3)">· ' + escAttr(typeof labelDepartamento === 'function' ? labelDepartamento(v.depto) : v.depto) + '</span>';
      h += '</div><div class="rec-vinc-acts">';
      h += '<button type="button" class="btn bsm" onclick="bibAbrirVinculo(\'' + escAttr(v.tipo) + '\',\'' + escAttr(v.id) + '\',\'' + escAttr(v.taskId || '') + '\')">Abrir</button>';
      if (canEdit) {
        h += '<button type="button" class="btn bsm bd2" onclick="bibDesasociarDeRepo(\'' + escAttr(r.id) + '\',\'' + escAttr(v.tipo) + '\',\'' + escAttr(v.id) + '\',\'' + escAttr(v.taskId || '') + '\')">Quitar</button>';
      }
      h += '</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  setTimeout(function() { if (canEdit) bibRefreshBusquedaVinculos(); }, 0);
  return h;
}

function bibRefreshBusquedaVinculos() {
  const el = document.getElementById('rec-bib-vinc-results');
  if (!el) return;
  const tipoEl = document.getElementById('rec-bib-vinc-tipo');
  const qEl = document.getElementById('rec-bib-vinc-q');
  const tipo = tipoEl ? tipoEl.value : '';
  const q = qEl ? qEl.value : '';
  const repoId = window._recursosRepoSel;
  const r = getRecursosRepoById(repoId);
  const existing = new Set(bibNormalizeVinculosList(r && r.vinculados).map(bibVinculoKey));
  if (!String(q || '').trim() || String(q).trim().length < 2) {
    el.innerHTML = '<div style="font-size:12px;color:var(--tx3);padding:6px 0">Escriba al menos 2 caracteres para buscar.</div>';
    return;
  }
  const cands = bibCandidatosAsociar(tipo, q).filter(function(c) { return !existing.has(bibVinculoKey(c)); });
  if (!cands.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--tx3);padding:6px 0">Sin resultados.</div>';
    return;
  }
  el.innerHTML = cands.map(function(c) {
    return '<div class="rec-vinc-cand">' +
      '<span><span class="rec-badge">' + escAttr(bibTipoLabel(c.tipo)) + '</span> ' + escAttr(c.label) + '</span>' +
      '<button type="button" class="btn bsm bp" onclick="bibAsociarARepo(\'' + escAttr(repoId) + '\',\'' + escAttr(c.tipo) + '\',\'' + escAttr(c.id) + '\',\'' + escAttr(c.taskId || '') + '\',' + (c.libre ? 'true' : 'false') + ')">🖇️ Asociar</button>' +
      '</div>';
  }).join('');
}

async function bibAsociarARepo(repoId, tipo, id, taskId, libre) {
  const r = getRecursosRepoById(repoId);
  if (!r) { notif('Repositorio no encontrado', 'err'); return; }
  const s = getRepoScope(r);
  if (!puedeEditarBiblioteca(s.scope, s.scopeId)) { notif('Sin permiso para asociar casos a esta carpeta', 'err'); return; }

  let label = id;
  let depto = '';
  let isLibre = !!libre;
  if (tipo === 'expediente' || tipo === 'pqrsd') {
    const e = typeof getExpById === 'function' ? getExpById(id) : null;
    if (!e) { notif('Expediente no encontrado', 'err'); return; }
    if (typeof esPqrsSecretaria === 'function' && esPqrsSecretaria(e)) tipo = 'pqrsd';
    else tipo = 'expediente';
    label = id + ' · ' + (typeof getNom === 'function' ? getNom(e) : '');
    depto = e._depto || '';
  } else if (tipo === 'actividad') {
    const vTmp = { tipo: 'actividad', id: id, taskId: taskId, libre: isLibre };
    const t = bibResolveTaskRef(vTmp);
    if (!t) { notif('Actividad no encontrada', 'err'); return; }
    isLibre = !!(t.sinExpediente || isLibre || (typeof isActLibreRef === 'function' && isActLibreRef(id, taskId)));
    label = (isLibre ? 'Libre · ' : '') + id + ' · ' + (t.actividad || t.desc || 'Actividad');
    depto = t.depto || '';
  } else {
    notif('Tipo no válido', 'err');
    return;
  }

  const vinc = {
    tipo: tipo,
    id: String(id || '').trim(),
    taskId: String(taskId || '').trim(),
    label: label,
    depto: depto,
    libre: isLibre,
    addedAt: new Date().toISOString(),
    addedBy: (typeof getAuthEmailNorm === 'function' ? getAuthEmailNorm() : '') || ''
  };
  if (!Array.isArray(r.vinculados)) r.vinculados = [];
  if (r.vinculados.some(function(x) { return bibVinculoKey(x) === bibVinculoKey(vinc); })) {
    notif('Ya está asociado a esta carpeta', 'err');
    return;
  }
  r.vinculados.push(vinc);
  bibAddRepoIdToEntidad(vinc, repoId);
  r.updatedAt = new Date().toISOString();

  const okRepo = await saveRecursosFirestore();
  const okEnt = await bibPersistEntidadVinculo(vinc);
  if (okRepo) {
    notif(okEnt ? 'Asociado a la carpeta' : 'Asociado en carpeta (revise sync del caso)', okEnt ? 'ok' : 'warn');
    if (typeof logAudit === 'function') logAudit('Asoció ' + bibTipoLabel(tipo) + ' a biblioteca', 'recursos', vinc.id, r.titulo);
    renderRecursosPanel();
  } else {
    r.vinculados = r.vinculados.filter(function(x) { return bibVinculoKey(x) !== bibVinculoKey(vinc); });
    bibRemoveRepoIdFromEntidad(vinc, repoId);
    notif('No se pudo guardar la asociación', 'err');
  }
}

async function bibDesasociarDeRepo(repoId, tipo, id, taskId) {
  const r = getRecursosRepoById(repoId);
  if (!r) return;
  const s = getRepoScope(r);
  if (!puedeEditarBiblioteca(s.scope, s.scopeId)) { notif('Sin permiso', 'err'); return; }
  const key = [tipo, id, taskId || ''].join('|');
  const found = bibNormalizeVinculosList(r.vinculados).find(function(v) { return bibVinculoKey(v) === key; });
  if (!found) return;
  if (!confirm('¿Quitar esta asociación de la carpeta?')) return;
  r.vinculados = bibNormalizeVinculosList(r.vinculados).filter(function(v) { return bibVinculoKey(v) !== key; });
  bibRemoveRepoIdFromEntidad(found, repoId);
  r.updatedAt = new Date().toISOString();
  const okRepo = await saveRecursosFirestore();
  const okEnt = await bibPersistEntidadVinculo(found);
  if (okRepo) {
    notif(okEnt ? 'Asociación eliminada' : 'Quitado de la carpeta (revise sync del caso)', okEnt ? 'ok' : 'warn');
    renderRecursosPanel();
  } else notif('No se pudo guardar', 'err');
}

function bibAbrirVinculo(tipo, id, taskId) {
  if (tipo === 'expediente' || tipo === 'pqrsd') {
    if (typeof showTab === 'function') showTab('con');
    if (typeof abrirConsultaExpPanel === 'function') abrirConsultaExpPanel(id, { allowSingle: true, edit: false });
    return;
  }
  if (tipo === 'actividad') {
    if (typeof isActLibreRef === 'function' && isActLibreRef(id, taskId)) {
      if (typeof showTab === 'function') showTab('act');
      if (typeof abrirPanelActLibre === 'function') abrirPanelActLibre(id, taskId);
      else if (typeof openEditarActTaskModal === 'function') openEditarActTaskModal(id, taskId);
      else if (typeof openTaskCommentsModal === 'function') openTaskCommentsModal(id, taskId);
      return;
    }
    if (typeof showTab === 'function') showTab('con');
    if (typeof abrirConsultaExpPanelDesdeAct === 'function') abrirConsultaExpPanelDesdeAct(id, taskId);
    else if (typeof abrirConsultaExpPanel === 'function') abrirConsultaExpPanel(id, { allowSingle: true, edit: false });
  }
}

function abrirBibliotecaRepoDesdeExp(repoId) {
  const id = String(repoId || '').trim();
  if (!id) return;
  window._recursosSubTab = 'biblioteca';
  window._recursosRepoSel = id;
  window._recursosDrivePage = null;
  if (typeof showTab === 'function') showTab('rec');
  if (typeof renderRecursosPanel === 'function') renderRecursosPanel();
  setTimeout(function() {
    if (typeof recursosDriveConectado === 'function' && recursosDriveConectado() && typeof cargarRecursosRepoArchivos === 'function') {
      cargarRecursosRepoArchivos();
    }
  }, 80);
}

function bibExpReposBadgeHtml(e, sh) {
  const ids = bibGetRepoIdsFromExp(e);
  if (!ids.length) return '';
  if (ids.length === 1) {
    const r = getRecursosRepoById(ids[0]);
    const tit = r && r.titulo ? r.titulo : 'Carpeta';
    return '<button type="button" class="flag flag-bib" title="Abrir carpeta en Biblioteca" onclick="event.stopPropagation();abrirBibliotecaRepoDesdeExp(\'' + escAttr(ids[0]) + '\')">📁' + (sh ? '' : ' ' + escAttr(tit)) + '</button>';
  }
  return '<button type="button" class="flag flag-bib" title="Ver carpetas asociadas" onclick="event.stopPropagation();bibAbrirReposExpModal(\'' + escAttr(e._exp || '') + '\')">📁' + (sh ? '' : ' Carpetas') + ' · ' + ids.length + '</button>';
}

function bibTaskReposBadgeHtml(t) {
  const ids = bibGetRepoIdsFromTask(t);
  if (!ids.length) return '';
  if (ids.length === 1) {
    const r = getRecursosRepoById(ids[0]);
    const tit = r && r.titulo ? r.titulo : 'Carpeta';
    return '<button type="button" class="bdg flag-bib" style="margin-left:4px;font-size:10px" title="Abrir carpeta en Biblioteca" onclick="event.stopPropagation();abrirBibliotecaRepoDesdeExp(\'' + escAttr(ids[0]) + '\')">📁 ' + escAttr(tit) + '</button>';
  }
  return '<button type="button" class="bdg flag-bib" style="margin-left:4px;font-size:10px" title="Carpetas asociadas" onclick="event.stopPropagation();bibAbrirReposTaskModal(\'' + escAttr(t.exp || t.codigo || '') + '\',\'' + escAttr(t.id || '') + '\')">📁 ' + ids.length + '</button>';
}

function bibAbrirReposExpModal(expId) {
  const e = typeof getExpById === 'function' ? getExpById(expId) : null;
  if (!e) return;
  const ids = bibGetRepoIdsFromExp(e);
  const ov = document.getElementById('task-modal-overlay');
  const tit = document.getElementById('task-modal-title');
  const body = document.getElementById('task-modal-body');
  if (!ov || !body) {
    if (ids[0]) abrirBibliotecaRepoDesdeExp(ids[0]);
    return;
  }
  if (tit) tit.textContent = 'Carpetas Biblioteca · ' + expId;
  body.innerHTML = ids.map(function(id) {
    const r = getRecursosRepoById(id);
    return '<div style="padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;gap:8px;align-items:center">' +
      '<span><strong>' + escAttr(r && r.titulo || id) + '</strong></span>' +
      '<button type="button" class="btn bsm bp" onclick="closeTaskModal();abrirBibliotecaRepoDesdeExp(\'' + escAttr(id) + '\')">Abrir</button></div>';
  }).join('') + '<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  ov.classList.add('on');
}

function bibAbrirReposTaskModal(expRef, taskId) {
  let t = null;
  if (typeof isActLibreRef === 'function' && isActLibreRef(expRef, taskId)) {
    t = (typeof getActLibreById === 'function' && getActLibreById(taskId)) || (typeof getActLibreByCodigo === 'function' && getActLibreByCodigo(expRef));
  } else {
    const e = typeof getExpById === 'function' ? getExpById(expRef) : null;
    t = e && (e.tasks || []).find(function(x) { return x && String(x.id) === String(taskId); });
  }
  const ids = bibGetRepoIdsFromTask(t);
  if (!ids.length) return;
  if (ids.length === 1) { abrirBibliotecaRepoDesdeExp(ids[0]); return; }
  const ov = document.getElementById('task-modal-overlay');
  const tit = document.getElementById('task-modal-title');
  const body = document.getElementById('task-modal-body');
  if (!ov || !body) { abrirBibliotecaRepoDesdeExp(ids[0]); return; }
  if (tit) tit.textContent = 'Carpetas Biblioteca · actividad';
  body.innerHTML = ids.map(function(id) {
    const r = getRecursosRepoById(id);
    return '<div style="padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;gap:8px;align-items:center">' +
      '<span><strong>' + escAttr(r && r.titulo || id) + '</strong></span>' +
      '<button type="button" class="btn bsm bp" onclick="closeTaskModal();abrirBibliotecaRepoDesdeExp(\'' + escAttr(id) + '\')">Abrir</button></div>';
  }).join('') + '<div style="margin-top:12px"><button type="button" class="btn bsm" onclick="closeTaskModal()">Cerrar</button></div>';
  ov.classList.add('on');
}

// ── Guardar en biblioteca (desde PQRSD / trámite / actividad) ─────────────────

function reposBibliotecaAsociables() {
  return reposBibliotecaVisibles().filter(function(r) {
    if (r.activo === false) return false;
    const s = getRepoScope(r);
    return typeof puedeEditarBiblioteca === 'function' && puedeEditarBiblioteca(s.scope, s.scopeId);
  });
}

function bibGuardarEnBibliotecaBtnHtml(opts) {
  opts = opts || {};
  const tipo = escAttr(opts.tipo || 'expediente');
  const id = escAttr(opts.id || '');
  const taskId = escAttr(opts.taskId || '');
  const libre = opts.libre ? 'true' : 'false';
  const label = escAttr(opts.label || id);
  return '<button type="button" class="btn bsm" onclick="openBibGuardarModal({tipo:\'' + tipo + '\',id:\'' + id + '\',taskId:\'' + taskId + '\',libre:' + libre + ',label:\'' + label + '\'})">📁 Guardar en biblioteca</button>';
}

function bibGuardarEnBibliotecaBarHtml(expId, taskId, t) {
  if (!t) return '';
  const ref = t.sinExpediente ? (t.codigo || expId) : expId;
  const ids = bibGetRepoIdsFromTask(t);
  const linked = ids.length ? ' · ' + ids.length + ' tema(s)' : '';
  let h = '<div style="margin-bottom:8px;padding:8px 10px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">';
  h += '<span style="font-size:12px"><strong>📚 Biblioteca</strong><span style="color:var(--tx3)">' + linked + '</span></span><div class="fx" style="gap:6px;flex-wrap:wrap">';
  h += bibGuardarEnBibliotecaBtnHtml({ tipo: 'actividad', id: ref, taskId: taskId, libre: !!t.sinExpediente, label: (t.actividad || t.desc || 'Actividad') });
  if (ids.length) h += '<button type="button" class="btn bsm" onclick="bibAbrirReposTaskModal(\'' + escAttr(ref) + '\',\'' + escAttr(taskId) + '\')">Ver temas</button>';
  h += '</div></div>';
  return h;
}

function bibGuardarLinkedExpHtml(e) {
  if (!e) return '';
  const ids = bibGetRepoIdsFromExp(e);
  if (!ids.length) return '';
  const names = ids.map(function(id) {
    const r = getRecursosRepoById(id);
    return r && r.titulo ? r.titulo : id;
  }).join(', ');
  return '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;padding:6px 8px;background:var(--sf2);border-radius:var(--r)">Ya en biblioteca: <strong>' + escAttr(names) + '</strong></div>';
}

function bibCollectAdjuntosPqrs() {
  const files = [];
  document.querySelectorAll('#pqrs-resp-adj-rows input[type=file]').forEach(function(inp) {
    if (inp.files) for (let i = 0; i < inp.files.length; i++) if (inp.files[i]) files.push(inp.files[i]);
  });
  const anex = document.getElementById('pqrs-resp-anexos-file');
  if (anex && anex.files) for (let i = 0; i < anex.files.length; i++) if (anex.files[i]) files.push(anex.files[i]);
  (window._pqrsComposeAttachments || []).forEach(function(a) {
    if (a && a.file) files.push(a.file);
  });
  return files;
}

async function bibCreateRepoQuick(titulo, tematica, descripcion) {
  const auto = typeof getRecursosScopeAutoSesion === 'function' ? getRecursosScopeAutoSesion() : { scope: 'departamento', scopeId: deptoActivo || 'guaviare' };
  const scope = auto.scope;
  const scopeId = auto.scopeId;
  if (!puedeEditarBiblioteca(scope, scopeId)) throw new Error('Sin permiso para crear temas en biblioteca');
  let driveFolderId = '';
  let driveFolderLink = '';
  if (!recursosDriveConectado()) {
    recursosModalCorreoRequerido('crear carpetas en Drive');
    throw new Error('Correo no conectado');
  }
  const driveFn = typeof driveEnsureBibliotecaRepoFolder === 'function' ? driveEnsureBibliotecaRepoFolder : window.driveEnsureBibliotecaRepoFolder;
  if (!driveFn) throw new Error('Módulo Drive no disponible');
  const created = await driveFn(scope, scopeId, titulo);
  driveFolderId = created.folderId;
  driveFolderLink = created.link;
  const email = typeof getAuthEmailNorm === 'function' ? getAuthEmailNorm() : '';
  const byAdmin = typeof esAdministrador === 'function' && esAdministrador();
  const repo = {
    id: 'repo' + Date.now(),
    titulo: titulo,
    tematica: tematica || '',
    descripcion: descripcion || '',
    scope: scope,
    scopeId: scopeId,
    oficinaId: scope === 'oficina' ? scopeId : '',
    driveFolderId: driveFolderId,
    driveFolderLink: driveFolderLink,
    activo: true,
    createdByAdmin: byAdmin,
    compartidoCon: [],
    archivosCompartidos: [],
    vinculados: [],
    createdAt: new Date().toISOString(),
    createdBy: email,
    updatedAt: new Date().toISOString()
  };
  bibliotecaRepos.push(repo);
  const ok = await saveRecursosFirestore();
  if (!ok) {
    bibliotecaRepos = bibliotecaRepos.filter(function(x) { return x.id !== repo.id; });
    throw new Error('No se pudo guardar el tema');
  }
  return repo;
}

function closeBibGuardarModal() {
  const ov = document.getElementById('bib-guardar-overlay');
  if (ov) {
    ov.classList.remove('on');
    if (typeof resetOverlayElevation === 'function') resetOverlayElevation(ov);
    else ov.style.zIndex = '';
    ov.setAttribute('aria-hidden', 'true');
  }
  window._bibGuardarCtx = null;
}

function openBibGuardarModal(opts) {
  opts = opts || {};
  const tipo = String(opts.tipo || 'expediente').trim();
  const id = String(opts.id || '').trim();
  const taskId = String(opts.taskId || '').trim();
  if (!id && tipo !== 'actividad') { notif('Sin referencia para guardar', 'err'); return; }
  if (tipo === 'actividad' && !taskId) { notif('Actividad no identificada', 'err'); return; }
  if (typeof taskModalIsReviewOpen === 'function' && taskModalIsReviewOpen() && typeof taskReviewToggleSidePanel === 'function') {
    window._bibGuardarCtx = {
      tipo: tipo,
      id: id,
      taskId: taskId,
      libre: !!opts.libre,
      label: opts.label || id,
      repoId: '',
      folderId: '',
      path: [],
      subirAdjuntos: false,
      showNuevo: false,
      onDone: typeof opts.onDone === 'function' ? opts.onDone : null
    };
    window._bibGuardarRenderTarget = '';
    window._bibGuardarRenderInline = false;
    taskReviewToggleSidePanel('biblioteca', id, taskId);
    return;
  }
  window._bibGuardarRenderTarget = '';
  window._bibGuardarRenderInline = false;
  window._bibGuardarCtx = {
    tipo: tipo,
    id: id,
    taskId: taskId,
    libre: !!opts.libre,
    label: opts.label || id,
    repoId: '',
    folderId: '',
    path: [],
    subirAdjuntos: false,
    showNuevo: false,
    onDone: typeof opts.onDone === 'function' ? opts.onDone : null
  };
  const ov = document.getElementById('bib-guardar-overlay');
  const tit = document.getElementById('bib-guardar-title');
  if (tit) tit.textContent = 'Guardar en biblioteca · ' + (opts.label || id);
  if (ov) {
    // Por encima de Registrar respuesta / task-modal (z-index 99999)
    if (typeof elevateOverlayAboveModals === 'function') elevateOverlayAboveModals(ov);
    else {
      ov.style.zIndex = '100050';
      document.body.appendChild(ov);
    }
    ov.classList.add('on');
    ov.setAttribute('aria-hidden', 'false');
  }
  bibGuardarRenderModal();
}

function bibGuardarRenderInto(containerId) {
  window._bibGuardarRenderTarget = containerId || 'task-review-bib-wrap';
  window._bibGuardarRenderInline = true;
  bibGuardarRenderModal();
}

function bibGuardarRenderModal() {
  const ctx = window._bibGuardarCtx;
  const inline = !!window._bibGuardarRenderInline;
  const bodyId = window._bibGuardarRenderTarget || 'bib-guardar-body';
  const body = document.getElementById(bodyId);
  const foot = inline ? null : document.getElementById('bib-guardar-foot');
  if (!ctx || !body) return;
  const repos = reposBibliotecaAsociables();
  const qEl = document.getElementById('bib-guardar-q');
  const q = qEl ? String(qEl.value || '').trim().toLowerCase() : '';
  let linkedHtml = '';
  if (ctx.tipo === 'actividad') {
    const t = bibResolveTaskRef({ tipo: 'actividad', id: ctx.id, taskId: ctx.taskId, libre: ctx.libre });
    if (t && bibGetRepoIdsFromTask(t).length) linkedHtml = '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Temas actuales: ' + bibGetRepoIdsFromTask(t).map(function(rid) {
      const r = getRecursosRepoById(rid);
      return escAttr(r && r.titulo || rid);
    }).join(', ') + '</div>';
  } else {
    const e = typeof getExpById === 'function' ? getExpById(ctx.id) : null;
    linkedHtml = bibGuardarLinkedExpHtml(e);
  }
  const adjFiles = ctx.tipo === 'pqrsd' ? bibCollectAdjuntosPqrs() : [];
  const filtrados = repos.filter(function(r) {
    if (!q) return true;
    const hay = ((r.titulo || '') + ' ' + (r.tematica || '') + ' ' + (r.descripcion || '')).toLowerCase();
    return hay.indexOf(q) >= 0;
  });
  let h = '';
  if (!inline) {
    h = '<p style="font-size:12px;color:var(--tx2);margin:0 0 10px">Organice este asunto en un <strong>tema</strong> de Biblioteca. Elija carpeta existente o cree una nueva; puede guardar dentro de subcarpetas.</p>';
  }
  h += linkedHtml;
  h += '<div class="bib-guardar-grid">';
  h += '<div class="bib-guardar-col"><div class="bib-guardar-col-hdr">Temas / carpetas</div><div class="bib-guardar-col-body">';
  h += '<input type="search" id="bib-guardar-q" class="rec-inp" placeholder="Buscar tema…" value="' + escAttr(q) + '" style="width:100%;margin-bottom:8px" oninput="bibGuardarRenderModal()">';
  if (!filtrados.length) {
    h += '<div class="rec-empty" style="padding:12px">No hay temas disponibles. Cree uno nuevo abajo.</div>';
  } else {
    filtrados.forEach(function(r) {
      const on = ctx.repoId === r.id;
      h += '<div class="bib-guardar-repo' + (on ? ' on' : '') + '" onclick="bibGuardarSelectRepo(\'' + escAttr(r.id) + '\')">';
      h += '<div><strong>' + escAttr(r.titulo || 'Sin título') + '</strong>';
      if (r.tematica) h += '<div style="font-size:11px;color:var(--tx3)">' + escAttr(r.tematica) + '</div>';
      h += '</div><span style="font-size:10px;color:var(--tx3)">' + ((r.vinculados || []).length) + ' casos</span></div>';
    });
  }
  h += '</div></div>';
  h += '<div class="bib-guardar-col"><div class="bib-guardar-col-hdr">Ubicación en Drive</div>';
  h += '<div id="bib-guardar-folders-wrap">' + bibGuardarFoldersHtml() + '</div></div>';
  h += '</div>';
  if (ctx.showNuevo) {
    h += '<div class="bib-guardar-nuevo" id="bib-guardar-nuevo-box">';
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Crear tema nuevo</div>';
    h += '<div class="fg"><div class="fld"><label>Título del tema</label><input type="text" id="bib-guardar-nuevo-titulo" class="rec-inp" placeholder="Ej. Quejas ambientales 2026"></div>';
    h += '<div class="fld"><label>Temática (opcional)</label><input type="text" id="bib-guardar-nuevo-tematica" class="rec-inp" placeholder="Ej. Deforestación"></div></div>';
    h += '<div class="fx" style="gap:6px;margin-top:8px"><button type="button" class="btn bsm bp" onclick="bibGuardarCrearTema()">Crear y seleccionar</button>';
    h += '<button type="button" class="btn bsm" onclick="bibGuardarToggleNuevo(false)">Cancelar</button></div></div>';
  } else {
    h += '<div style="margin-top:10px"><button type="button" class="btn bsm" onclick="bibGuardarToggleNuevo(true)">+ Crear tema nuevo</button></div>';
  }
  if (adjFiles.length) {
    h += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-top:10px;cursor:pointer"><input type="checkbox" id="bib-guardar-subir-adj"' + (ctx.subirAdjuntos ? ' checked' : '') + ' onchange="bibGuardarToggleSubirAdj()"> Subir ' + adjFiles.length + ' archivo(s) adjunto(s) a la carpeta seleccionada</label>';
  }
  body.innerHTML = h;
  if (foot) {
    foot.innerHTML = '<button type="button" class="btn bsm" onclick="closeBibGuardarModal()">Cancelar</button>' +
      (ctx.repoId ? '<button type="button" class="btn bsm" onclick="bibGuardarAbrirRepo()">Abrir en Biblioteca</button>' : '') +
      '<button type="button" class="btn bsm bp" onclick="bibGuardarConfirmar()" ' + (ctx.repoId ? '' : 'disabled') + '>Guardar aquí</button>';
  } else if (inline) {
    body.innerHTML += '<div class="fx bib-guardar-inline-foot" style="gap:6px;margin-top:12px;flex-wrap:wrap;position:sticky;bottom:0;background:var(--sf);padding-top:8px;border-top:1px solid var(--bd)">' +
      (ctx.repoId ? '<button type="button" class="btn bsm" onclick="bibGuardarAbrirRepo()">Abrir en Biblioteca</button>' : '') +
      '<button type="button" class="btn bsm bp" onclick="bibGuardarConfirmar()" ' + (ctx.repoId ? '' : 'disabled') + '>Guardar aquí</button></div>';
  }
}

function bibGuardarFoldersHtml() {
  const ctx = window._bibGuardarCtx;
  if (!ctx || !ctx.repoId) {
    return '<div class="bib-guardar-col-body" style="padding:12px;color:var(--tx3);font-size:12px">Seleccione un tema a la izquierda.</div>';
  }
  const r = getRecursosRepoById(ctx.repoId);
  if (!r) return '<div class="rec-empty">Tema no encontrado</div>';
  const rootId = r.driveFolderId || parseDriveFolderId(r.driveFolderLink);
  if (!rootId) return '<div class="rec-empty">Sin carpeta Drive vinculada</div>';
  if (!(ctx.path || []).length) {
    ctx.path = [{ id: rootId, name: r.titulo || 'Tema' }];
    ctx.folderId = rootId;
  }
  let h = '<div class="bib-guardar-crumb">';
  (ctx.path || []).forEach(function(p, i) {
    if (i > 0) h += '<span class="bib-guardar-crumb-sep">›</span>';
    h += '<button type="button" onclick="bibGuardarNavCrumb(' + i + ')">' + escAttr(p.name) + '</button>';
  });
  h += '</div><div class="bib-guardar-col-body" id="bib-guardar-folder-list">';
  h += '<div style="font-size:11px;color:var(--tx3);padding:6px 8px">Cargando subcarpetas…</div></div>';
  h += '<div style="padding:8px;border-top:1px solid var(--bd)"><button type="button" class="btn bsm" onclick="bibGuardarNuevaSubcarpeta()">+ Nueva subcarpeta</button></div>';
  setTimeout(function() { bibGuardarLoadFolders(); }, 0);
  return h;
}

async function bibGuardarLoadFolders() {
  const ctx = window._bibGuardarCtx;
  const el = document.getElementById('bib-guardar-folder-list');
  if (!ctx || !el || !ctx.folderId) return;
  if (!recursosDriveConectado()) {
    el.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--tx3)">Conecte correo en Correos para ver subcarpetas.</div>';
    return;
  }
  try {
    let files = [];
    let token = '';
    do {
      const data = await driveListFolderContents(ctx.folderId, token || '');
      files = files.concat(data.files || []);
      token = data.nextPageToken || '';
    } while (token);
    ctx._folderFiles = files;
    const folders = files.filter(function(f) { return f.mimeType === 'application/vnd.google-apps.folder'; });
    if (!folders.length) {
      el.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--tx3)">Sin subcarpetas — se guardará en esta ubicación.</div>';
      return;
    }
    el.innerHTML = folders.map(function(f) {
      return '<div class="bib-guardar-folder" ondblclick="bibGuardarEnterFolder(\'' + escAttr(f.id) + '\',\'' + escAttr(f.name) + '\')" onclick="bibGuardarEnterFolder(\'' + escAttr(f.id) + '\',\'' + escAttr(f.name) + '\')">' +
        '<span>📁</span><span>' + escAttr(f.name) + '</span></div>';
    }).join('');
  } catch (err) {
    el.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--rd)">' + escAttr(err.message || 'Error listando carpetas') + '</div>';
  }
}

function bibGuardarSelectRepo(repoId) {
  const ctx = window._bibGuardarCtx;
  if (!ctx) return;
  ctx.repoId = repoId;
  ctx.path = [];
  ctx.folderId = '';
  bibGuardarRenderModal();
}

function bibGuardarEnterFolder(folderId, name) {
  const ctx = window._bibGuardarCtx;
  if (!ctx) return;
  ctx.folderId = folderId;
  const path = ctx.path || [];
  const idx = path.findIndex(function(p) { return p.id === folderId; });
  if (idx >= 0) ctx.path = path.slice(0, idx + 1);
  else ctx.path = path.concat([{ id: folderId, name: name || 'Carpeta' }]);
  bibGuardarRenderModal();
}

function bibGuardarNavCrumb(idx) {
  const ctx = window._bibGuardarCtx;
  if (!ctx || !ctx.path || !ctx.path.length) return;
  ctx.path = ctx.path.slice(0, idx + 1);
  ctx.folderId = ctx.path[ctx.path.length - 1].id;
  bibGuardarRenderModal();
}

function bibGuardarToggleNuevo(show) {
  const ctx = window._bibGuardarCtx;
  if (!ctx) return;
  ctx.showNuevo = !!show;
  bibGuardarRenderModal();
}

function bibGuardarToggleSubirAdj() {
  const ctx = window._bibGuardarCtx;
  if (!ctx) return;
  const cb = document.getElementById('bib-guardar-subir-adj');
  ctx.subirAdjuntos = !!(cb && cb.checked);
}

async function bibGuardarCrearTema() {
  const titulo = String((document.getElementById('bib-guardar-nuevo-titulo') || {}).value || '').trim();
  const tematica = String((document.getElementById('bib-guardar-nuevo-tematica') || {}).value || '').trim();
  if (!titulo) { notif('Indique el título del tema', 'err'); return; }
  try {
    const repo = await bibCreateRepoQuick(titulo, tematica, '');
    notif('Tema creado: ' + titulo, 'ok');
    const ctx = window._bibGuardarCtx;
    if (ctx) {
      ctx.showNuevo = false;
      ctx.repoId = repo.id;
      ctx.path = [];
      ctx.folderId = '';
      bibGuardarRenderModal();
    }
  } catch (err) {
    if (err && err.message && err.message !== 'Correo no conectado') notif(err.message, 'err');
  }
}

async function bibGuardarNuevaSubcarpeta() {
  const ctx = window._bibGuardarCtx;
  if (!ctx || !ctx.folderId) return;
  if (!recursosDriveConectado()) { recursosModalCorreoRequerido('crear subcarpetas'); return; }
  const name = prompt('Nombre de la subcarpeta:');
  if (!name || !String(name).trim()) return;
  try {
    await driveCreateFolder(String(name).trim(), ctx.folderId);
    notif('Subcarpeta creada', 'ok');
    bibGuardarLoadFolders();
  } catch (err) {
    notif(err.message || 'Error creando subcarpeta', 'err');
  }
}

function bibGuardarAbrirRepo() {
  const ctx = window._bibGuardarCtx;
  if (!ctx || !ctx.repoId) return;
  closeBibGuardarModal();
  abrirBibliotecaRepoDesdeExp(ctx.repoId);
}

async function bibGuardarConfirmar() {
  const ctx = window._bibGuardarCtx;
  if (!ctx || !ctx.repoId) { notif('Seleccione un tema', 'err'); return; }
  const tipo = ctx.tipo === 'pqrsd' ? 'pqrsd' : (ctx.tipo === 'actividad' ? 'actividad' : 'expediente');
  await bibAsociarARepo(ctx.repoId, tipo, ctx.id, ctx.taskId || '', ctx.libre);
  if (ctx.subirAdjuntos && ctx.tipo === 'pqrsd' && ctx.folderId) {
    const files = bibCollectAdjuntosPqrs();
    const uploadFn = typeof driveUploadBiblioteca === 'function' ? driveUploadBiblioteca : window.driveUploadBiblioteca;
    if (uploadFn && files.length) {
      let ok = 0;
      for (let i = 0; i < files.length; i++) {
        try {
          await uploadFn(files[i], files[i].name, files[i].type || 'application/octet-stream', ctx.folderId);
          ok++;
        } catch (err) { console.warn('bib upload', err); }
      }
      if (ok) notif(ok + ' archivo(s) subidos a la carpeta', 'ok');
    }
  }
  if (ctx.onDone) try { ctx.onDone(ctx.repoId); } catch (err) { console.warn(err); }
  closeBibGuardarModal();
  if (typeof renderActividades === 'function' && document.getElementById('pg-act') && document.getElementById('pg-act').classList.contains('on')) renderActividades();
  if (typeof renderConsulta === 'function' && document.getElementById('pg-con') && document.getElementById('pg-con').classList.contains('on')) renderConsulta();
}

window.bibAsociarARepo = bibAsociarARepo;
window.bibDesasociarDeRepo = bibDesasociarDeRepo;
window.bibAbrirVinculo = bibAbrirVinculo;
window.abrirBibliotecaRepoDesdeExp = abrirBibliotecaRepoDesdeExp;
window.bibExpReposBadgeHtml = bibExpReposBadgeHtml;
window.bibTaskReposBadgeHtml = bibTaskReposBadgeHtml;
window.bibRefreshBusquedaVinculos = bibRefreshBusquedaVinculos;
window.bibAbrirReposExpModal = bibAbrirReposExpModal;
window.bibAbrirReposTaskModal = bibAbrirReposTaskModal;
window.openBibGuardarModal = openBibGuardarModal;
window.closeBibGuardarModal = closeBibGuardarModal;
window.bibGuardarEnBibliotecaBtnHtml = bibGuardarEnBibliotecaBtnHtml;
window.bibGuardarEnBibliotecaBarHtml = bibGuardarEnBibliotecaBarHtml;
window.bibGuardarSelectRepo = bibGuardarSelectRepo;
window.bibGuardarEnterFolder = bibGuardarEnterFolder;
window.bibGuardarNavCrumb = bibGuardarNavCrumb;
window.bibGuardarToggleNuevo = bibGuardarToggleNuevo;
window.bibGuardarCrearTema = bibGuardarCrearTema;
window.bibGuardarNuevaSubcarpeta = bibGuardarNuevaSubcarpeta;
window.bibGuardarConfirmar = bibGuardarConfirmar;
window.bibGuardarAbrirRepo = bibGuardarAbrirRepo;
window.bibGuardarRenderModal = bibGuardarRenderModal;
window.bibGuardarRenderInto = bibGuardarRenderInto;
window.bibGuardarToggleSubirAdj = bibGuardarToggleSubirAdj;
