/**
 * 🪄 Pulir cuerpo de correo (Gemini vía Cloud Function pulirCorreoTexto).
 * Solo cambia el textarea si el usuario elige «Usar texto pulido». No escribe Firestore.
 * CORREO_PULIR_UI_ACTIVO=false: oculta el botón (p. ej. sin crédito Gemini); el corrector del navegador sigue activo en los textareas.
 */
(function () {
  'use strict';

  var CORREO_PULIR_UI_ACTIVO = false;
  var CORREO_PULIR_MAX = 8000;
  var _correoPulirCtx = null;

  function esc(s) {
    if (typeof escAttr === 'function') return escAttr(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function aviso(msg, tipo) {
    if (typeof notif === 'function') notif(msg, tipo || 'err');
  }

  /** HTML del botón junto al label del cuerpo. */
  function htmlCorreoPulirBtn(textareaId) {
    if (!CORREO_PULIR_UI_ACTIVO) return '';
    var id = String(textareaId || '').trim();
    if (!id) return '';
    return (
      '<button type="button" class="btn bsm correo-pulir-btn" title="Mejorar ortografía y redacción" ' +
      'style="flex-shrink:0;font-size:11px;padding:3px 8px;white-space:nowrap" ' +
      'onclick="correoPulirAbrir(\'' +
      esc(id) +
      '\')">🪄 Pulir</button>'
    );
  }

  /** Fila label + botón (el label puede actualizarse sin borrar el botón). */
  function htmlCorreoPulirLabelRow(labelHtml, textareaId, labelId) {
    var lid = labelId ? ' id="' + esc(labelId) + '"' : '';
    var btn = htmlCorreoPulirBtn(textareaId);
    if (!btn) {
      return (
        '<label' +
        lid +
        ' style="font-size:11px;font-weight:600;display:block;margin:0 0 4px">' +
        labelHtml +
        '</label>'
      );
    }
    return (
      '<div class="correo-pulir-label-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">' +
      '<label' +
      lid +
      ' style="font-size:11px;font-weight:600;margin:0">' +
      labelHtml +
      '</label>' +
      btn +
      '</div>'
    );
  }

  function correoPulirValidarTexto(texto) {
    var t = String(texto == null ? '' : texto).trim();
    if (!t) return { ok: false, error: 'Escriba el cuerpo del correo antes de pulir.' };
    if (t.length > CORREO_PULIR_MAX) {
      return { ok: false, error: 'El texto supera ' + CORREO_PULIR_MAX + ' caracteres.' };
    }
    return { ok: true, texto: t };
  }

  function correoPulirCerrar() {
    var ov = document.getElementById('correo-pulir-overlay');
    if (ov) ov.classList.remove('on');
    _correoPulirCtx = null;
  }

  function correoPulirEnsureOverlay() {
    var ov = document.getElementById('correo-pulir-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'correo-pulir-overlay';
    ov.className = 'task-modal-overlay';
    ov.innerHTML =
      '<div class="task-modal" style="width:min(860px,96vw);max-height:90vh" onclick="event.stopPropagation()">' +
      '<div class="task-modal-hd" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd)">' +
      '<div style="font-weight:600;font-size:14px">🪄 Pulir redacción</div>' +
      '<button type="button" class="btn bsm" onclick="correoPulirCerrar()">✕</button>' +
      '</div>' +
      '<div class="task-modal-body" style="padding:12px 14px;overflow:auto">' +
      '<div id="correo-pulir-status" style="font-size:12px;color:var(--tx2);margin-bottom:10px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><div style="font-size:11px;font-weight:600;margin-bottom:4px">Original</div>' +
      '<textarea id="correo-pulir-orig" readonly style="min-height:220px;width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;line-height:1.45;box-sizing:border-box;white-space:pre-wrap;background:var(--sf2)"></textarea></div>' +
      '<div><div style="font-size:11px;font-weight:600;margin-bottom:4px">Pulido</div>' +
      '<textarea id="correo-pulir-nuevo" style="min-height:220px;width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--r);font-size:12px;font-family:\'DM Sans\',sans-serif;line-height:1.45;box-sizing:border-box;white-space:pre-wrap"></textarea></div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Revise el texto pulido. Nada se guarda hasta que elija «Usar texto pulido» y luego guarde/envíe como de costumbre.</div>' +
      '</div>' +
      '<div class="task-modal-ft" style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--bd)">' +
      '<button type="button" class="btn bsm bp" id="correo-pulir-usar" onclick="correoPulirUsar()">✓ Usar texto pulido</button>' +
      '<button type="button" class="btn bsm" onclick="correoPulirCerrar()">Conservar original</button>' +
      '<button type="button" class="btn bsm" id="correo-pulir-reintentar" onclick="correoPulirReintentar()">↻ Reintentar</button>' +
      '</div></div>';
    ov.addEventListener('click', function () {
      correoPulirCerrar();
    });
    document.body.appendChild(ov);
    return ov;
  }

  function setStatus(msg, loading) {
    var el = document.getElementById('correo-pulir-status');
    if (el) el.textContent = msg || '';
    var btn = document.getElementById('correo-pulir-usar');
    var re = document.getElementById('correo-pulir-reintentar');
    if (btn) btn.disabled = !!loading;
    if (re) re.disabled = !!loading;
  }

  async function correoPulirLlamarApi(texto) {
    var auth = window._firebaseAuth;
    if (!auth || !auth.currentUser) {
      throw new Error('Debe iniciar sesión para pulir el texto.');
    }
    var functions = window._firebaseFunctions;
    var httpsCallable = window._httpsCallable;
    if (!functions || typeof httpsCallable !== 'function') {
      throw new Error('Functions no está disponible. Publique la Cloud Function pulirCorreoTexto.');
    }
    var fn = httpsCallable(functions, 'pulirCorreoTexto');
    var res = await fn({ texto: texto });
    var pulido = res && res.data && res.data.pulido;
    pulido = String(pulido || '').trim();
    if (!pulido) throw new Error('No se obtuvo texto pulido.');
    return pulido;
  }

  async function correoPulirEjecutar() {
    if (!_correoPulirCtx) return;
    var v = correoPulirValidarTexto(_correoPulirCtx.original);
    if (!v.ok) {
      setStatus(v.error, false);
      aviso(v.error, 'err');
      return;
    }
    setStatus('Puliendo redacción…', true);
    var nuevoEl = document.getElementById('correo-pulir-nuevo');
    if (nuevoEl) nuevoEl.value = '';
    try {
      var pulido = await correoPulirLlamarApi(v.texto);
      if (nuevoEl) nuevoEl.value = pulido;
      _correoPulirCtx.pulido = pulido;
      setStatus('Compare ambos textos y elija cuál conservar.', false);
    } catch (err) {
      var msg =
        (err && err.message) ||
        (err && err.code ? String(err.code) : '') ||
        'No se pudo pulir el texto.';
      if (err && err.details) msg = String(err.details);
      if (err && err.code === 'functions/not-found') {
        msg = 'La función pulirCorreoTexto aún no está desplegada.';
      }
      setStatus(msg, false);
      aviso(msg, 'err');
    }
  }

  function correoPulirAbrir(textareaId) {
    if (!CORREO_PULIR_UI_ACTIVO) {
      aviso('Pulir está temporalmente desactivado. Use el corrector del navegador (subrayado rojo).', 'err');
      return;
    }
    var id = String(textareaId || '').trim();
    var ta = document.getElementById(id);
    if (!ta) {
      aviso('No se encontró el campo de cuerpo del correo.', 'err');
      return;
    }
    var original = String(ta.value || '');
    var v = correoPulirValidarTexto(original);
    if (!v.ok) {
      aviso(v.error, 'err');
      return;
    }
    _correoPulirCtx = { textareaId: id, original: original, pulido: '' };
    var ov = correoPulirEnsureOverlay();
    var o = document.getElementById('correo-pulir-orig');
    var n = document.getElementById('correo-pulir-nuevo');
    if (o) o.value = original;
    if (n) n.value = '';
    ov.classList.add('on');
    correoPulirEjecutar();
  }

  function correoPulirReintentar() {
    correoPulirEjecutar();
  }

  function correoPulirUsar() {
    if (!_correoPulirCtx) return;
    var id = _correoPulirCtx.textareaId;
    var n = document.getElementById('correo-pulir-nuevo');
    var pulido = String((n && n.value) || _correoPulirCtx.pulido || '').trim();
    if (!pulido) {
      aviso('Aún no hay texto pulido para usar.', 'err');
      return;
    }
    var ta = document.getElementById(id);
    if (!ta) {
      aviso('El campo de correo ya no está en pantalla.', 'err');
      correoPulirCerrar();
      return;
    }
    ta.value = pulido;
    try {
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* ignore */ }
    correoPulirCerrar();
    aviso('Texto pulido aplicado. Revise y guarde/envíe cuando corresponda.', 'ok');
  }

  /** Activa el corrector nativo (subrayado rojo). No forzar lang=es: sin diccionario español Chrome no marca nada. */
  var CORREO_SPELLCHECK_IDS = [
    'entrega-notif-email-cuerpo', 'rev-ent-email-cuerpo', 'pqrs-entrega-resp-cuerpo',
    'tramite-notif-cuerpo', 'tramite-atajo-email-cuerpo', 'ofi-doc-cuerpo',
    'pqrs-compose-body', 'pqrs-resp-cuerpo', 'nca-rev-cuerpo', 'pqrs-notif-cuerpo',
    'task-rev-notif-cuerpo', 'pqrs-mail-cuerpo'
  ];
  function correoActivarSpellcheckNativo(root) {
    var scope = root && root.querySelectorAll ? root : document;
    CORREO_SPELLCHECK_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('spellcheck', 'true');
      el.spellcheck = true;
      if (el.getAttribute('lang') === 'es' || el.getAttribute('lang') === 'es-CO') {
        el.removeAttribute('lang');
      }
    });
    try {
      scope.querySelectorAll('textarea[spellcheck="true"]').forEach(function (el) {
        el.spellcheck = true;
      });
    } catch (e) { /* ignore */ }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('focusin', function (ev) {
      var t = ev && ev.target;
      if (!t || !t.id || CORREO_SPELLCHECK_IDS.indexOf(t.id) < 0) return;
      correoActivarSpellcheckNativo();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { correoActivarSpellcheckNativo(); });
    } else {
      correoActivarSpellcheckNativo();
    }
  }

  window.htmlCorreoPulirBtn = htmlCorreoPulirBtn;
  window.htmlCorreoPulirLabelRow = htmlCorreoPulirLabelRow;
  window.correoPulirValidarTexto = correoPulirValidarTexto;
  window.correoPulirAbrir = correoPulirAbrir;
  window.correoPulirCerrar = correoPulirCerrar;
  window.correoPulirUsar = correoPulirUsar;
  window.correoPulirReintentar = correoPulirReintentar;
  window.correoActivarSpellcheckNativo = correoActivarSpellcheckNativo;
  window.CORREO_PULIR_MAX = CORREO_PULIR_MAX;
  window.CORREO_PULIR_UI_ACTIVO = CORREO_PULIR_UI_ACTIVO;
})();
