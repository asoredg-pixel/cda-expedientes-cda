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
  renderRecursosPanel();
}

function getRecursosRepoById(id) {
  return (bibliotecaRepos || []).find(function(r) { return r.id === id; }) || null;
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
  if (canEdit || canShare) {
    h += '<div class="rec-toolbar" style="margin:10px 0">';
    if (canEdit) {
      h += '<button type="button" class="btn bsm" onclick="recursosMostrarFormRepo(\'' + escAttr(r.id) + '\')">Editar datos</button>';
      h += '<label class="btn bsm" style="cursor:pointer" onclick="return recursosPreUploadDrive(event)">📤 Subir archivo<input type="file" style="display:none" multiple onclick="return recursosPreUploadDrive(event)" onchange="subirRecursosRepoArchivos(event,\'' + escAttr(r.id) + '\')"></label>';
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
  h += '<div id="rec-repo-files"><div class="rec-empty">Cargando archivos…</div></div>';
  h += '</div>';
  return h;
}

async function cargarRecursosRepoArchivos(pageToken) {
  const repoId = window._recursosRepoSel;
  const r = getRecursosRepoById(repoId);
  const el = document.getElementById('rec-repo-files');
  if (!r || !el) return;
  if (!recursosDriveConectado()) {
    el.innerHTML = '<div class="rec-info-banner warn">Conecte su correo en <a href="#" onclick="recursosIrACorreos();return false">Correos</a> para ver y adjuntar archivos. <button type="button" class="btn bsm" style="margin-left:8px" onclick="recursosModalCorreoRequerido(\'listar y adjuntar documentos en el repositorio\')">Más información</button></div>';
    return;
  }
  const s = getRepoScope(r);
  const canShare = puedeCompartirRecursosItem(r);
  const folderId = r.driveFolderId || parseDriveFolderId(r.driveFolderLink);
  if (!folderId) {
    el.innerHTML = '<div class="rec-empty">Sin carpeta Drive vinculada.</div>';
    return;
  }
  try {
    const data = await driveListFolderContents(folderId, pageToken || '');
    let h = '<div class="rec-files-list">';
    (data.files || []).forEach(function(f) {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const link = f.webViewLink || ('https://drive.google.com/' + (isFolder ? 'drive/folders/' : 'file/d/') + f.id + '/view');
      const archComp = (r.archivosCompartidos || []).find(function(a) { return a.fileId === f.id; });
      const archShareLbl = archComp ? labelRecursosCompartidoCon(archComp.compartidoCon) : '';
      h += '<div class="rec-file-row">';
      h += '<span>' + (isFolder ? '📁' : '📄') + ' ' + escAttr(f.name);
      if (archShareLbl) h += ' <span class="rec-tag rec-tag-share" title="Compartido">↗ ' + escAttr(archShareLbl) + '</span>';
      h += '</span>';
      h += '<a class="btn bsm" href="' + escAttr(link) + '" target="_blank" rel="noopener">Abrir</a>';
      if (!isFolder && canShare) {
        h += '<button type="button" class="btn bsm" onclick="recursosAbrirCompartir(\'archivo\',\'' + escAttr(r.id) + '\',\'' + escAttr(f.id) + '\',\'' + escAttr(f.name) + '\')">Compartir</button>';
      }
      if (!isFolder && typeof parseDrivePreviewUrl === 'function') {
        const prev = parseDrivePreviewUrl(link);
        if (prev.preview) {
          h += '<a class="btn bsm" href="' + escAttr(prev.preview) + '" target="_blank" rel="noopener">Vista previa</a>';
        }
      }
      h += '</div>';
    });
    h += '</div>';
    if (data.nextPageToken) {
      h += '<button type="button" class="btn bsm" style="margin-top:8px" onclick="cargarRecursosRepoArchivos(\'' + escAttr(data.nextPageToken) + '\')">Más archivos…</button>';
    }
    if (!(data.files || []).length) h = '<div class="rec-empty">Carpeta vacía.</div>';
    el.innerHTML = h;
  } catch (err) {
    const msg = String(err.message || 'Error al listar Drive');
    if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('correo')) {
      recursosModalCorreoRequerido('listar y adjuntar documentos en el repositorio');
    }
    el.innerHTML = '<div class="rec-info-banner warn">' + escAttr(msg) + '. <button type="button" class="btn bsm" onclick="recursosModalCorreoRequerido(\'usar la biblioteca Drive\')">Conectar correo</button></div>';
  }
}

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
  bibliotecaRepos = bibliotecaRepos.filter(function(x) { return x.id !== id; });
  const ok = await saveRecursosFirestore();
  if (ok) {
    window._recursosRepoSel = null;
    notif('Repositorio eliminado', 'ok');
    renderRecursosPanel();
    if (typeof renderListasCfg === 'function') renderListasCfg();
  }
}

async function subirRecursosRepoArchivos(ev, repoId) {
  if (!recursosDriveConectado()) {
    recursosModalCorreoRequerido('adjuntar documentos al repositorio');
    if (ev && ev.target) ev.target.value = '';
    return;
  }
  const r = getRecursosRepoById(repoId);
  const s = r ? getRepoScope(r) : {};
  if (!r || !puedeEditarBiblioteca(s.scope, s.scopeId)) return;
  const files = ev.target && ev.target.files;
  if (!files || !files.length) return;
  const folderId = r.driveFolderId || parseDriveFolderId(r.driveFolderLink);
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
  ev.target.value = '';
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
  ov.classList.add('on');
  ov.setAttribute('aria-hidden', 'false');
}

function recursosCerrarCompartir() {
  const ov = document.getElementById('rec-share-overlay');
  if (ov) {
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
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
