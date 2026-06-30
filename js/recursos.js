// =============================================================================
// recursos.js — Enlaces externos + Biblioteca (repositorio Drive por oficina)
// =============================================================================

window._recursosSubTab = 'enlaces';
window._recursosOficinaSel = '';
window._recursosRepoSel = null;
window._recursosDrivePage = null;

function parseDriveFolderId(url) {
  const m = String(url || '').match(/\/folders\/([^/?#]+)/);
  return m ? m[1] : '';
}

function recursosInitPanel() {
  if (!puedeVerRecursos()) return;
  reloadRecursosFirestore().then(function() {
    if (!window._recursosOficinaSel) {
      window._recursosOficinaSel = getRecursosOficinaActiva() || 'guaviare';
    }
    renderRecursosPanel();
  });
}

function setRecursosSubTab(tab) {
  window._recursosSubTab = tab === 'biblioteca' ? 'biblioteca' : 'enlaces';
  window._recursosRepoSel = null;
  renderRecursosPanel();
}

function setRecursosOficinaSel(id) {
  window._recursosOficinaSel = String(id || '').trim();
  window._recursosRepoSel = null;
  renderRecursosPanel();
}

function enlacesVisiblesParaSesion() {
  const depto = getRecursosDeptoContext();
  const ofiFijo = getRecursosOficinaActiva();
  const ofiFiltro = window._recursosEnlaceOfiFiltro || '';
  const ofiVer = ofiFijo || ofiFiltro;
  return (recursosEnlaces || []).filter(function(l) {
    if (l.activo === false) return false;
    if (l.scope === 'departamento') return l.scopeId === depto;
    if (l.scope === 'oficina') {
      if (ofiVer && l.scopeId === ofiVer) return true;
      if (!ofiVer && depto === 'guaviare') return true;
      if (!ofiVer && esAdministrador()) return true;
      return false;
    }
    return false;
  });
}

function enlacesVisiblesAdminTodos() {
  return (recursosEnlaces || []).filter(function(l) { return l.activo !== false; });
}

function reposBibliotecaVisibles(oficinaId) {
  const oid = oficinaId || window._recursosOficinaSel || getRecursosOficinaActiva() || 'guaviare';
  return (bibliotecaRepos || []).filter(function(r) {
    return r.activo !== false && r.oficinaId === oid;
  });
}

function labelScopeEnlace(l) {
  if (l.scope === 'departamento') {
    const d = DEPTOS.find(function(x) { return x.id === l.scopeId; });
    return 'Depto: ' + (d ? d.nombre : l.scopeId);
  }
  return 'Oficina: ' + labelOficina(l.scopeId);
}

function renderRecursosPanel() {
  const root = document.getElementById('recursos-panel-root');
  if (!root) return;
  const sub = window._recursosSubTab;
  const depto = getRecursosDeptoContext();
  const bibOk = bibliotecaDriveDisponible(depto);
  const oficinas = OFICINAS_DEGUV;
  const ofiSel = window._recursosOficinaSel || getRecursosOficinaActiva() || 'guaviare';

  let h = '<div class="rec-wrap">';
  h += '<div class="rec-hdr"><div><h2 class="rec-title">📚 Recursos</h2>';
  h += '<p class="rec-sub">Enlaces externos y biblioteca documental por oficina (Guaviare).</p></div></div>';

  h += '<div class="rec-subtabs">';
  h += '<button type="button" class="rec-subtab' + (sub === 'enlaces' ? ' on' : '') + '" onclick="setRecursosSubTab(\'enlaces\')">🔗 Enlaces</button>';
  h += '<button type="button" class="rec-subtab' + (sub === 'biblioteca' ? ' on' : '') + '" onclick="setRecursosSubTab(\'biblioteca\')">📁 Biblioteca</button>';
  h += '</div>';

  if (sub === 'enlaces') {
    h += renderRecursosEnlacesPanel(depto);
  } else {
    h += renderRecursosBibliotecaPanel(depto, bibOk, oficinas, ofiSel);
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

  const puedeDept = puedeEditarRecursosEnlaces('departamento', depto);
  const ofiAct = getRecursosOficinaActiva();
  const puedeOfi = ofiAct && puedeEditarRecursosEnlaces('oficina', ofiAct);

  let h = '<div class="card rec-card">';
  h += '<div class="rec-toolbar">';
  if (!getRecursosOficinaActiva()) {
    h += '<label style="font-size:12px">Oficina:</label><select class="depto-sel" onchange="window._recursosEnlaceOfiFiltro=this.value;renderRecursosPanel()">';
    h += '<option value="">— Depto + todas las oficinas —</option>';
    OFICINAS_DEGUV.forEach(function(o) {
      h += '<option value="' + escAttr(o.id) + '"' + ((window._recursosEnlaceOfiFiltro || '') === o.id ? ' selected' : '') + '>' + escAttr(o.nombre) + '</option>';
    });
    h += '</select>';
  }
  h += '<input type="search" id="rec-enlace-q" class="rec-inp" placeholder="Buscar…" value="' + escAttr(window._recEnlaceQ || '') + '" oninput="window._recEnlaceQ=this.value;renderRecursosPanel()">';
  h += '<input type="text" id="rec-enlace-area" class="rec-inp" placeholder="Área" value="' + escAttr(window._recEnlaceArea || '') + '" oninput="window._recEnlaceArea=this.value;renderRecursosPanel()">';
  h += '<input type="text" id="rec-enlace-tem" class="rec-inp" placeholder="Temática" value="' + escAttr(window._recEnlaceTem || '') + '" oninput="window._recEnlaceTem=this.value;renderRecursosPanel()">';
  if (puedeDept || puedeOfi || esAdministrador()) {
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
      h += '<div class="rec-enlace-item">';
      h += '<div class="rec-enlace-meta"><span class="rec-badge">' + escAttr(labelScopeEnlace(l)) + '</span>';
      if (l.area) h += '<span class="rec-tag">' + escAttr(l.area) + '</span>';
      if (l.tematica) h += '<span class="rec-tag rec-tag-2">' + escAttr(l.tematica) + '</span>';
      h += '</div>';
      h += '<a class="rec-enlace-tit" href="' + escAttr(l.url) + '" target="_blank" rel="noopener noreferrer">' + escAttr(l.titulo || l.url) + '</a>';
      if (l.descripcion) h += '<div class="rec-enlace-desc">' + escAttr(l.descripcion) + '</div>';
      h += '<div class="rec-enlace-actions">';
      h += '<a class="btn bsm" href="' + escAttr(l.url) + '" target="_blank" rel="noopener">Abrir ↗</a>';
      if (canEdit) {
        h += '<button type="button" class="btn bsm" onclick="recursosMostrarFormEnlace(\'' + escAttr(l.id) + '\')">Editar</button>';
        h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosEnlace(\'' + escAttr(l.id) + '\')">Eliminar</button>';
      }
      h += '</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderRecursosBibliotecaPanel(depto, bibOk, oficinas, ofiSel) {
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
  h += '<label style="font-size:13px;font-weight:600">Oficina:</label>';
  h += '<select class="depto-sel" onchange="setRecursosOficinaSel(this.value)">';
  oficinas.forEach(function(o) {
    h += '<option value="' + escAttr(o.id) + '"' + (o.id === ofiSel ? ' selected' : '') + '>' + escAttr(o.nombre) + '</option>';
  });
  h += '</select>';
  if (puedeEditarBiblioteca(ofiSel)) {
    h += '<button type="button" class="btn bsm bp" onclick="recursosMostrarFormRepo()">+ Repositorio</button>';
  }
  h += '</div>';

  if (window._recursosRepoForm && !window._recursosRepoSel) {
    h += renderRecursosRepoForm(window._recursosRepoForm, ofiSel);
  }

  if (window._recursosRepoSel) {
    h += renderRecursosRepoDetalle(window._recursosRepoSel);
    return h;
  }

  const repos = reposBibliotecaVisibles(ofiSel);
  h += '<div class="card rec-card">';
  if (!repos.length) {
    h += '<div class="rec-empty">Sin repositorios en <strong>' + escAttr(labelOficina(ofiSel)) + '</strong>.</div>';
  } else {
    h += '<div class="rec-repo-list">';
    repos.forEach(function(r) {
      h += '<div class="rec-repo-row" onclick="abrirRecursosRepo(\'' + escAttr(r.id) + '\')">';
      h += '<div><strong>' + escAttr(r.titulo) + '</strong>';
      if (r.tematica) h += ' <span class="rec-tag">' + escAttr(r.tematica) + '</span>';
      if (r.descripcion) h += '<div style="font-size:12px;color:var(--tx2);margin-top:4px">' + escAttr(r.descripcion) + '</div>';
      h += '</div>';
      h += '<span style="font-size:12px;color:var(--tx3)">Ver →</span></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function abrirRecursosRepo(repoId) {
  window._recursosRepoSel = repoId;
  window._recursosDrivePage = null;
  renderRecursosPanel();
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
  const canEdit = puedeEditarBiblioteca(r.oficinaId);
  let h = '<div class="card rec-card">';
  h += '<div class="rec-repo-hdr"><button type="button" class="btn bsm" onclick="cerrarRecursosRepo()">← Volver</button>';
  h += '<div><strong>' + escAttr(r.titulo) + '</strong> · ' + escAttr(labelOficina(r.oficinaId)) + '</div>';
  if (r.driveFolderLink) h += '<a class="btn bsm" href="' + escAttr(r.driveFolderLink) + '" target="_blank" rel="noopener">Drive ↗</a>';
  h += '</div>';
  if (r.descripcion) h += '<p style="font-size:13px;color:var(--tx2);margin:8px 0">' + escAttr(r.descripcion) + '</p>';
  if (canEdit) {
    h += '<div class="rec-toolbar" style="margin:10px 0">';
    h += '<button type="button" class="btn bsm" onclick="recursosMostrarFormRepo(\'' + escAttr(r.id) + '\')">Editar datos</button>';
    h += '<label class="btn bsm" style="cursor:pointer">📤 Subir archivo<input type="file" style="display:none" multiple onchange="subirRecursosRepoArchivos(event,\'' + escAttr(r.id) + '\')"></label>';
    h += '<button type="button" class="btn bsm bd2" onclick="eliminarRecursosRepo(\'' + escAttr(r.id) + '\')">Eliminar repo</button>';
    h += '</div>';
  }
  if (window._recursosRepoForm === r.id) {
    h += renderRecursosRepoForm(r.id, r.oficinaId);
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
      h += '<div class="rec-file-row">';
      h += '<span>' + (isFolder ? '📁' : '📄') + ' ' + escAttr(f.name) + '</span>';
      h += '<a class="btn bsm" href="' + escAttr(link) + '" target="_blank" rel="noopener">Abrir</a>';
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
    el.innerHTML = '<div class="rec-info-banner warn">' + escAttr(err.message || 'Error al listar Drive') + '. Conecte correo en la pestaña Correos.</div>';
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
  const existing = editId && editId !== '__new__' ? (recursosEnlaces || []).find(function(l) { return l.id === editId; }) : null;
  const depto = getRecursosDeptoContext();
  const ofi = getRecursosOficinaActiva();
  const scope = existing ? existing.scope : (ofi && puedeEditarRecursosEnlaces('oficina', ofi) && !esAdministrador() ? 'oficina' : 'departamento');
  const scopeId = existing ? existing.scopeId : (scope === 'oficina' ? (ofi || 'oap_deguv') : depto);

  let h = '<div class="card rec-card rec-form-card"><div class="cft">' + (existing ? 'Editar enlace' : 'Nuevo enlace externo') + '</div><div class="fg">';
  if (esAdministrador()) {
    h += '<div class="fld"><label>Ámbito</label><select id="rec-enl-scope" onchange="recEnlaceFormScopeChange()">';
    h += '<option value="departamento"' + (scope === 'departamento' ? ' selected' : '') + '>Departamento</option>';
    h += '<option value="oficina"' + (scope === 'oficina' ? ' selected' : '') + '>Oficina</option></select></div>';
    h += '<div class="fld" id="rec-enl-scope-id-wrap"><label id="rec-enl-scope-lbl">' + (scope === 'oficina' ? 'Oficina' : 'Departamento') + '</label><select id="rec-enl-scope-id">';
    const list = scope === 'oficina' ? OFICINAS_DEGUV : DEPTOS;
    list.forEach(function(x) {
      h += '<option value="' + escAttr(x.id) + '"' + (x.id === scopeId ? ' selected' : '') + '>' + escAttr(x.nombre) + '</option>';
    });
    h += '</select></div>';
  } else {
    h += '<input type="hidden" id="rec-enl-scope" value="' + escAttr(scope) + '">';
    h += '<input type="hidden" id="rec-enl-scope-id" value="' + escAttr(scopeId) + '">';
    h += '<p style="font-size:12px;color:var(--tx2);margin:0 0 8px">' + escAttr(scope === 'oficina' ? labelOficina(scopeId) : labelDepartamento(scopeId)) + '</p>';
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

function recEnlaceFormScopeChange() {
  recEnlaceModalScopeChange();
}

function recEnlaceModalScopeChange() {
  const scope = document.getElementById('rec-enl-scope').value;
  const wrap = document.getElementById('rec-enl-scope-id-wrap');
  const sel = document.getElementById('rec-enl-scope-id');
  const lbl = document.getElementById('rec-enl-scope-lbl');
  if (!wrap || !sel) return;
  lbl.textContent = scope === 'oficina' ? 'Oficina' : 'Departamento';
  sel.innerHTML = '';
  const list = scope === 'oficina' ? OFICINAS_DEGUV : DEPTOS;
  list.forEach(function(x) {
    sel.insertAdjacentHTML('beforeend', '<option value="' + escAttr(x.id) + '">' + escAttr(x.nombre) + '</option>');
  });
}

async function guardarRecursosEnlace(editId) {
  const scope = document.getElementById('rec-enl-scope').value;
  const scopeId = document.getElementById('rec-enl-scope-id').value;
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
      scope: scope, scopeId: scopeId, activo: true,
      createdAt: new Date().toISOString(), createdBy: email, updatedAt: new Date().toISOString()
    });
  }
  window._recursosEnlaceForm = null;
  const ok = await saveRecursosFirestore();
  if (ok) {
    notif('Enlace guardado', 'ok');
    if (typeof logAudit === 'function') logAudit('Guardó enlace en Recursos', 'configuracion', null, titulo);
    renderRecursosPanel();
  } else notif('Error al guardar en Firestore', 'err');
}

async function eliminarRecursosEnlace(id) {
  const l = (recursosEnlaces || []).find(function(x) { return x.id === id; });
  if (!l || !puedeEditarRecursosEnlaces(l.scope, l.scopeId)) { notif('Sin permiso', 'err'); return; }
  if (!confirm('¿Eliminar este enlace?')) return;
  recursosEnlaces = recursosEnlaces.filter(function(x) { return x.id !== id; });
  const ok = await saveRecursosFirestore();
  if (ok) { notif('Enlace eliminado', 'ok'); renderRecursosPanel(); }
}

function recursosMostrarFormRepo(editId) {
  window._recursosRepoForm = editId || '__new__';
  renderRecursosPanel();
}

function recursosOcultarFormRepo() {
  window._recursosRepoForm = null;
  renderRecursosPanel();
}

function renderRecursosRepoForm(editId, oficinaId) {
  const existing = editId && editId !== '__new__' ? getRecursosRepoById(editId) : null;
  const ofiSel = oficinaId || window._recursosOficinaSel || 'guaviare';
  let h = '<div class="card rec-card rec-form-card"><div class="cft">' + (existing ? 'Editar repositorio' : 'Nuevo repositorio — ' + labelOficina(ofiSel)) + '</div><div class="fg">';
  h += '<div class="fld"><label>Título</label><input type="text" id="rec-repo-titulo" value="' + escAttr(existing && existing.titulo || '') + '"></div>';
  h += '<div class="fld"><label>Temática</label><input type="text" id="rec-repo-tematica" value="' + escAttr(existing && existing.tematica || '') + '"></div>';
  h += '<div class="fld"><label>Descripción</label><textarea id="rec-repo-desc" rows="2">' + escTextarea(existing && existing.descripcion || '') + '</textarea></div>';
  if (!existing) {
    h += '<div class="fld"><label>Vincular carpeta Drive existente (opcional)</label><input type="url" id="rec-repo-drive-link" placeholder="https://drive.google.com/drive/folders/…"><span style="font-size:11px;color:var(--tx3)">Si se deja vacío, se crea carpeta en Drive institucional.</span></div>';
  }
  h += '<div style="display:flex;gap:8px"><button type="button" class="btn bsm bp" onclick="guardarRecursosRepo(\'' + escAttr(editId || '__new__') + '\',\'' + escAttr(ofiSel) + '\')">Guardar</button>';
  h += '<button type="button" class="btn bsm" onclick="recursosOcultarFormRepo()">Cancelar</button></div>';
  h += '</div></div>';
  return h;
}

async function guardarRecursosRepo(editId, oficinaId) {
  if (!puedeEditarBiblioteca(oficinaId)) { notif('Solo el encargado de la oficina puede gestionar la biblioteca', 'err'); return; }
  const titulo = String(document.getElementById('rec-repo-titulo').value || '').trim();
  const tematica = String(document.getElementById('rec-repo-tematica').value || '').trim();
  const descripcion = String(document.getElementById('rec-repo-desc').value || '').trim();
  if (!titulo) { notif('El título es obligatorio', 'err'); return; }
  const isNew = !editId || editId === '__new__';
  const email = getAuthEmailNorm() || '';
  if (!isNew) {
    const idx = bibliotecaRepos.findIndex(function(r) { return r.id === editId; });
    if (idx < 0) return;
    bibliotecaRepos[idx] = Object.assign({}, bibliotecaRepos[idx], {
      titulo: titulo, tematica: tematica, descripcion: descripcion,
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
      try {
        const created = await driveEnsureBibliotecaRepoFolder(oficinaId, titulo);
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
      oficinaId: oficinaId,
      driveFolderId: driveFolderId, driveFolderLink: driveFolderLink,
      activo: true,
      createdAt: new Date().toISOString(), createdBy: email,
      updatedAt: new Date().toISOString()
    });
  }
  window._recursosRepoForm = null;
  const ok = await saveRecursosFirestore();
  if (ok) {
    notif('Repositorio guardado', 'ok');
    if (typeof logAudit === 'function') logAudit('Guardó repositorio biblioteca', 'configuracion', null, titulo);
    renderRecursosPanel();
  } else notif('Error al guardar', 'err');
}

async function eliminarRecursosRepo(id) {
  const r = getRecursosRepoById(id);
  if (!r || !puedeEditarBiblioteca(r.oficinaId)) { notif('Sin permiso', 'err'); return; }
  if (!confirm('¿Eliminar este repositorio de la biblioteca? (La carpeta en Drive no se borra)')) return;
  bibliotecaRepos = bibliotecaRepos.filter(function(x) { return x.id !== id; });
  const ok = await saveRecursosFirestore();
  if (ok) {
    window._recursosRepoSel = null;
    notif('Repositorio eliminado', 'ok');
    renderRecursosPanel();
  }
}

async function subirRecursosRepoArchivos(ev, repoId) {
  const r = getRecursosRepoById(repoId);
  if (!r || !puedeEditarBiblioteca(r.oficinaId)) return;
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

async function guardarRecursosConfigDrive() {
  if (!esAdministrador()) { notif('Solo administrador', 'err'); return; }
  const g = document.getElementById('rec-cfg-guainia');
  const v = document.getElementById('rec-cfg-vaupes');
  recursosConfig = recursosConfig || {};
  if (g) recursosConfig.guainiaDriveRoot = String(g.value || '').trim();
  if (v) recursosConfig.vaupesDriveRoot = String(v.value || '').trim();
  const ok = await saveRecursosFirestore();
  if (ok) { notif('Configuración guardada', 'ok'); renderRecursosPanel(); }
  else notif('Error al guardar', 'err');
}
