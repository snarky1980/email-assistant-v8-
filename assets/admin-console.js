// Admin Console for Email Assistant v6
(function () {
  const JSON_PATH = './complete_email_templates.json';
  const DRAFT_KEY = 'ea_admin_draft_v2';

  // State
  let data = null;              // { metadata, variables, templates }
  let lang = 'fr';              // UI edit language toggle for localized fields
  let selectedTemplateId = null;
  let searchTerm = '';
  let filterCategory = 'all';

  // DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const kpiTemplates = $('#kpi-templates');
  const kpiVariables = $('#kpi-variables');
  const warningsEl = $('#warnings');

  const langSwitch = $('#lang-switch');
  const fileInput = $('#file-input');
  const btnImport = $('#btn-import');
  const btnExport = $('#btn-export');
  const btnReset = $('#btn-reset');
  const btnHelp = $('#btn-help');

  const btnNewTemplate = $('#btn-new-template');
  const searchInput = $('#search');
  const catFilterSel = $('#filter-category');
  const tplList = $('#template-list');

  const tabTemplates = $('#tab-templates');
  const tabVariables = $('#tab-variables');
  const tabMetadata = $('#tab-metadata');
  const viewTemplates = $('#view-templates');
  const viewVariables = $('#view-variables');
  const viewMetadata = $('#view-metadata');

  const btnDuplicate = $('#btn-duplicate');
  const btnDelete = $('#btn-delete');
  const btnSave = $('#btn-save');

  // Utils
  const debounce = (fn, ms = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const download = (filename, content) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    a.remove();
  };
  const saveDraft = debounce(() => {
    if (!data) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data, null, 2));
      notify('Brouillon enregistré localement.');
    } catch (e) {
      notify('Erreur lors de l’enregistrement du brouillon.', 'warn');
      console.error(e);
    }
  }, 400);

  const notify = (msg, type = 'info') => {
    warningsEl.style.display = 'block';
    warningsEl.className = 'warn';
    warningsEl.innerHTML = `<strong>${type === 'warn' ? 'Note' : 'Info'}:</strong> ${msg}`;
    setTimeout(() => {
      warningsEl.style.display = 'none';
    }, 3000);
  };

  function ensureSchema(obj) {
    if (!obj || typeof obj !== 'object') obj = {};
    obj.metadata = obj.metadata || { version: '1.0', totalTemplates: 0, languages: ['fr', 'en'], categories: [] };
    obj.variables = obj.variables || {};
    obj.templates = Array.isArray(obj.templates) ? obj.templates : [];
    return obj;
  }

  function loadFromDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    try {
      return ensureSchema(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async function loadInitial() {
    const draft = loadFromDraft();
    if (draft) {
      data = draft;
      afterDataLoad();
      return;
    }
    const resp = await fetch(JSON_PATH);
    const json = await resp.json();
    data = ensureSchema(json);
    afterDataLoad();
  }

  function afterDataLoad() {
    // Update computed metadata
    data.metadata.totalTemplates = data.templates.length;
    renderCategoryFilter();
    renderSidebar();
    renderMain();
    updateKpis();
    renderWarnings();
  }

  function updateKpis() {
    kpiTemplates.textContent = `${data.templates.length} templates`;
    kpiVariables.textContent = `${Object.keys(data.variables || {}).length} variables`;
  }

  function renderWarnings() {
    const issues = validateData();
    if (issues.length) {
      warningsEl.style.display = 'block';
      warningsEl.className = 'warn';
      warningsEl.innerHTML = `<strong>Avertissements (${issues.length})</strong><ul style="margin:6px 0 0 18px">${issues.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    } else {
      warningsEl.style.display = 'none';
    }
  }

  function renderCategoryFilter() {
    const cats = (data.metadata.categories || []);
    catFilterSel.innerHTML = `<option value="all">Toutes</option>` + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function renderSidebar() {
    const list = getFilteredTemplates();
    tplList.innerHTML = list.map(t => {
      const title = (t.title && t.title[lang]) || t.id;
      const cat = t.category || '-';
      const varsCount = (t.variables || []).length;
      return `
        <div class="tile" data-id="${escapeAttr(t.id)}" role="button" tabindex="0">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">
            <span class="pill">${escapeHtml(cat)}</span>
            <span class="badge">${varsCount} vars</span>
          </div>
        </div>
      `;
    }).join('');

    // selection handle
    $$('.tile', tplList).forEach(el => {
      el.onclick = () => {
        selectedTemplateId = el.dataset.id;
        renderMain();
      };
      el.onkeypress = (e) => { if (e.key === 'Enter') el.click(); };
    });
  }

  function getFilteredTemplates() {
    const term = (searchTerm || '').toLowerCase();
    const cat = filterCategory;
    return data.templates.filter(t => {
      const matchesCat = cat === 'all' || t.category === cat;
      if (!matchesCat) return false;
      if (!term) return true;
      const hay = [
        t.id,
        t.category,
        t.title?.fr, t.title?.en,
        t.description?.fr, t.description?.en,
        t.subject?.fr, t.subject?.en,
        t.body?.fr, t.body?.en,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }

  function renderMain() {
    // Tabs
    viewTemplates.style.display = tabTemplates.classList.contains('active') ? '' : 'none';
    viewVariables.style.display = tabVariables.classList.contains('active') ? '' : 'none';
    viewMetadata.style.display = tabMetadata.classList.contains('active') ? '' : 'none';

    if (viewTemplates.style.display !== 'none') renderTemplateEditor();
    if (viewVariables.style.display !== 'none') renderVariablesEditor();
    if (viewMetadata.style.display !== 'none') renderMetadataEditor();
  }

  function renderTemplateEditor() {
    const t = data.templates.find(x => x.id === selectedTemplateId) || data.templates[0];
    if (!t) {
      viewTemplates.innerHTML = `<div class="hint">Aucun modèle sélectionné. Cliquez sur “Nouveau” pour créer un template.</div>`;
      return;
    }
    selectedTemplateId = t.id;

    const cats = data.metadata.categories || [];
    const allVars = Object.keys(data.variables || {}).sort();

    viewTemplates.innerHTML = `
      <div class="row">
        <div class="field">
          <label>ID (unique, utilisé par l’application)</label>
          <input id="tpl-id" value="${escapeAttr(t.id)}" />
          <div class="hint">Utiliser des caractères simples (lettres, chiffres, _).</div>
        </div>
        <div class="field">
          <label>Catégorie</label>
          <select id="tpl-category">
            ${cats.map(c => `<option ${c===t.category?'selected':''} value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}
            ${!cats.includes(t.category||'') && t.category ? `<option selected value="${escapeAttr(t.category)}">${escapeHtml(t.category)} (custom)</option>` : ''}
          </select>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Titre (${lang.toUpperCase()})</label>
          <input id="tpl-title" value="${escapeAttr(t.title?.[lang]||'')}" />
        </div>
        <div class="field">
          <label>Description (${lang.toUpperCase()})</label>
          <input id="tpl-desc" value="${escapeAttr(t.description?.[lang]||'')}" />
        </div>
      </div>

      <div class="split">
        <div class="field">
          <label>Objet (${lang.toUpperCase()})</label>
          <input id="tpl-subject" value="${escapeAttr(t.subject?.[lang]||'')}" />
          <div class="hint">Utilisez les variables entre chevrons: &lt;&lt;NomVariable&gt;&gt;</div>
        </div>
        <div class="field">
          <label>Corps (${lang.toUpperCase()})</label>
          <textarea id="tpl-body">${escapeHtml(t.body?.[lang]||'')}</textarea>
        </div>
      </div>

      <div class="field">
        <label>Variables utilisées</label>
        <div id="vars-box" style="display:grid;grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap:8px; border:1px solid var(--border); padding:10px; border-radius:12px; max-height:220px; overflow:auto;">
          ${allVars.length ? allVars.map(v => `
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" value="${escapeAttr(v)}" ${Array.isArray(t.variables) && t.variables.includes(v) ? 'checked':''}>
              <span>${escapeHtml(v)}</span>
            </label>
          `).join('') : `<div class="hint">Aucune variable définie pour l’instant (onglet Variables).</div>`}
        </div>
      </div>

      <div class="hint">Astuce: changez la langue en haut (FR/EN) pour éditer l’autre version.</div>
    `;

    // Wire handlers
    $('#tpl-id').oninput = (e) => {
      const v = e.target.value.trim();
      if (!/^[a-zA-Z0-9_]+$/.test(v)) { e.target.style.borderColor = '#fecaca'; return; }
      e.target.style.borderColor = '';
      if (v !== t.id && data.templates.some(x => x.id === v)) {
        e.target.style.borderColor = '#fecaca';
        notify('Un template avec cet ID existe déjà.', 'warn');
        return;
      }
      t.id = v;
      selectedTemplateId = v;
      saveDraft();
      renderSidebar();
    };

    $('#tpl-category').onchange = (e) => {
      t.category = e.target.value;
      saveDraft();
      renderSidebar();
    };

    $('#tpl-title').oninput = (e) => {
      t.title = t.title || {};
      t.title[lang] = e.target.value;
      saveDraft();
      renderSidebar();
    };

    $('#tpl-desc').oninput = (e) => {
      t.description = t.description || {};
      t.description[lang] = e.target.value;
      saveDraft();
    };

    $('#tpl-subject').oninput = (e) => {
      t.subject = t.subject || {};
      t.subject[lang] = e.target.value;
      saveDraft();
    };

    $('#tpl-body').oninput = (e) => {
      t.body = t.body || {};
      t.body[lang] = e.target.value;
      saveDraft();
    };

    $$('#vars-box input[type="checkbox"]').forEach(cb => {
      cb.onchange = () => {
        t.variables = Array.isArray(t.variables) ? t.variables : [];
        if (cb.checked) {
          if (!t.variables.includes(cb.value)) t.variables.push(cb.value);
        } else {
          t.variables = t.variables.filter(x => x !== cb.value);
        }
        saveDraft();
        renderWarnings();
        renderSidebar();
      };
    });

    // Duplicate/Delete toolbar
    btnDuplicate.onclick = () => {
      const dup = structuredClone(t);
      dup.id = uniqueId(t.id + '_copy');
      data.templates.push(dup);
      selectedTemplateId = dup.id;
      saveDraft();
      afterDataLoad();
    };

    btnDelete.onclick = () => {
      if (!confirm('Supprimer ce template ?')) return;
      data.templates = data.templates.filter(x => x.id !== t.id);
      selectedTemplateId = data.templates[0]?.id || null;
      saveDraft();
      afterDataLoad();
    };
  }

  function uniqueId(base) {
    let i = 1;
    let id = base;
    while (data.templates.some(t => t.id === id)) {
      id = `${base}_${i++}`;
    }
    return id;
  }

  function renderVariablesEditor() {
    const vars = data.variables || {};
    const keys = Object.keys(vars).sort();

    viewVariables.innerHTML = `
      <div class="row-3">
        <div class="field"><label>Clé</label><input id="var-new-key" placeholder="e.g. NuméroProjet" /></div>
        <div class="field"><label>Format</label>
          <select id="var-new-format">
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="date">date</option>
            <option value="time">time</option>
          </select>
        </div>
        <div class="field"><label>Exemple</label><input id="var-new-example" placeholder="ex: 123-456456-789" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Description FR</label><input id="var-new-desc-fr" /></div>
        <div class="field"><label>Description EN</label><input id="var-new-desc-en" /></div>
      </div>
      <div><button id="btn-add-var" class="primary">Ajouter</button></div>

      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;"></div>

      <div style="display:grid;gap:10px;">
        ${keys.length ? keys.map(k => {
          const v = vars[k];
          return `
            <div class="tile" data-k="${escapeAttr(k)}" style="display:grid;gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div class="title">${escapeHtml(k)}</div>
                <div class="chips">
                  <span class="badge">${escapeHtml(v.format || 'text')}</span>
                  <span class="pill">ex: ${escapeHtml(v.example || '')}</span>
                </div>
              </div>
              <div class="row">
                <div class="field"><label>Description FR</label><input data-edit="fr" value="${escapeAttr(v.description?.fr || '')}" /></div>
                <div class="field"><label>Description EN</label><input data-edit="en" value="${escapeAttr(v.description?.en || '')}" /></div>
              </div>
              <div class="row-3">
                <div class="field"><label>Format</label>
                  <select data-edit="format">
                    ${['text','number','date','time'].map(opt => `<option ${opt===(v.format||'text')?'selected':''} value="${opt}">${opt}</option>`).join('')}
                  </select>
                </div>
                <div class="field"><label>Exemple</label><input data-edit="example" value="${escapeAttr(v.example || '')}" /></div>
                <div class="field"><label>&nbsp;</label><button data-action="delete" class="danger">Supprimer</button></div>
              </div>
            </div>
          `;
        }).join('') : `<div class="hint">Aucune variable pour l’instant.</div>`}
      </div>
    `;

    $('#btn-add-var').onclick = () => {
      const key = $('#var-new-key').value.trim();
      if (!key || !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_]+$/.test(key)) {
        notify('Clé invalide. Utilisez des lettres/chiffres/underscore.', 'warn'); return;
      }
      if (data.variables[key]) { notify('Cette clé existe déjà.', 'warn'); return; }
      const fmt = $('#var-new-format').value;
      const ex = $('#var-new-example').value.trim();
      const dfr = $('#var-new-desc-fr').value.trim();
      const den = $('#var-new-desc-en').value.trim();
      data.variables[key] = {
        description: { fr: dfr, en: den },
        format: fmt,
        example: ex
      };
      saveDraft();
      renderVariablesEditor();
      renderTemplateEditor();
      renderWarnings();
      updateKpis();
    };

    // edits
    $$('.tile[data-k]').forEach(tile => {
      const name = tile.dataset.k;
      tile.querySelector('[data-edit="fr"]').oninput = (e) => {
        data.variables[name].description = data.variables[name].description || {};
        data.variables[name].description.fr = e.target.value;
        saveDraft();
      };
      tile.querySelector('[data-edit="en"]').oninput = (e) => {
        data.variables[name].description = data.variables[name].description || {};
        data.variables[name].description.en = e.target.value;
        saveDraft();
      };
      tile.querySelector('[data-edit="format"]').onchange = (e) => {
        data.variables[name].format = e.target.value;
        saveDraft();
      };
      tile.querySelector('[data-edit="example"]').oninput = (e) => {
        data.variables[name].example = e.target.value;
        saveDraft();
      };
      tile.querySelector('[data-action="delete"]').onclick = () => {
        if (!confirm(`Supprimer la variable ${name} ?`)) return;
        // remove from templates
        data.templates.forEach(t => {
          if (Array.isArray(t.variables)) {
            t.variables = t.variables.filter(x => x !== name);
          }
        });
        delete data.variables[name];
        saveDraft();
        renderVariablesEditor();
        renderTemplateEditor();
        renderWarnings();
        updateKpis();
      };
    });
  }

  function renderMetadataEditor() {
    const m = data.metadata || {};
    const cats = m.categories || [];
    viewMetadata.innerHTML = `
      <div class="row">
        <div class="field">
          <label>Version</label>
          <input id="meta-version" value="${escapeAttr(m.version || '')}" />
        </div>
        <div class="field">
          <label>Langues</label>
          <input value="${escapeAttr((m.languages || ['fr','en']).join(', '))}" disabled />
          <div class="hint">Les langues fr/en sont fixées par l’application.</div>
        </div>
      </div>

      <div class="field">
        <label>Catégories</label>
        <div class="chips" id="cat-chips">
          ${cats.map(c => `<span class="chip">${escapeHtml(c)} <button title="Supprimer" data-cat="${escapeAttr(c)}">×</button></span>`).join('')}
        </div>
        <div class="row">
          <div class="field"><input id="cat-new" placeholder="Ajouter une catégorie…" /></div>
          <div class="field"><button id="cat-add" class="primary">Ajouter</button></div>
        </div>
        <div class="hint">Les catégories alimentent le filtre et la liste déroulante dans Templates.</div>
      </div>
    `;

    $('#meta-version').oninput = (e) => { m.version = e.target.value; saveDraft(); };

    $('#cat-add').onclick = () => {
      const v = $('#cat-new').value.trim();
      if (!v) return;
      if (!(m.categories||[]).includes(v)) {
        m.categories = m.categories || [];
        m.categories.push(v);
      }
      $('#cat-new').value = '';
      saveDraft();
      renderCategoryFilter();
      renderMetadataEditor();
      renderTemplateEditor();
    };

    $$('#cat-chips [data-cat]').forEach(btn => {
      btn.onclick = () => {
        const c = btn.dataset.cat;
        if (!confirm(`Supprimer la catégorie "${c}" ?`)) return;
        m.categories = (m.categories || []).filter(x => x !== c);
        // Unset category on templates that used it
        data.templates.forEach(t => { if (t.category === c) t.category = ''; });
        saveDraft();
        renderCategoryFilter();
        renderMetadataEditor();
        renderTemplateEditor();
      };
    });
  }

  function validateData() {
    const issues = [];
    // Unique IDs
    const ids = new Set();
    for (const t of data.templates) {
      if (!t.id) issues.push('Template sans ID.');
      else if (ids.has(t.id)) issues.push(`ID en double: ${t.id}`);
      else ids.add(t.id);

      // Category exists
      if (t.category && !(data.metadata.categories || []).includes(t.category)) {
        issues.push(`Catégorie inconnue pour ${t.id}: ${t.category}`);
      }

      // Variables referenced should exist
      for (const v of (t.variables || [])) {
        if (!data.variables[v]) issues.push(`Template ${t.id} référence une variable inexistante: ${v}`);
      }

      // Placeholders in subject/body consistent with variables
      (['fr', 'en']).forEach(L => {
        const subj = t.subject?.[L] || '';
        const body = t.body?.[L] || '';
        const placeholders = new Set([...subj.matchAll(/<<([^>]+)>>/g), ...body.matchAll(/<<([^>]+)>>/g)].map(m => m[1]));
        placeholders.forEach(ph => {
          if (!data.variables[ph]) issues.push(`Placeholder <<${ph}>> manquant dans variables (template ${t.id}, ${L}).`);
          if (!Array.isArray(t.variables) || !t.variables.includes(ph)) {
            issues.push(`Placeholder <<${ph}>> non listé dans variables du template ${t.id} (${L}).`);
          }
        });
      });
    }
    return issues;
  }

  // Import/Export/Reset/Help
  btnImport.onclick = () => fileInput.click();
  fileInput.onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const json = ensureSchema(JSON.parse(txt));
      data = json;
      selectedTemplateId = data.templates[0]?.id || null;
      saveDraft();
      afterDataLoad();
      notify('Fichier importé et brouillon mis à jour.');
    } catch (err) {
      notify('Fichier invalide.', 'warn');
      console.error(err);
    } finally {
      fileInput.value = '';
    }
  };

  btnExport.onclick = () => {
    data.metadata.totalTemplates = data.templates.length;
    const issues = validateData();
    if (issues.length) {
      if (!confirm(`Des avertissements existent (${issues.length}). Exporter quand même ?`)) return;
    }
    const pretty = JSON.stringify(data, null, 2);
    download('complete_email_templates.json', pretty);
  };

  btnReset.onclick = () => {
    if (!confirm('Effacer le brouillon local et recharger le fichier original ?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  };

  btnHelp.onclick = () => {
    alert(
`Conseils:
• Importer JSON: Charge un fichier local dans le brouillon (aucune modification serveur).
• Enregistrer le brouillon: Sauvegarde vos modifications dans votre navigateur.
• Exporter JSON: Télécharge un fichier complet que vous pourrez committer à la place de complete_email_templates.json.
• Les placeholders doivent être de la forme <<NomVariable>> et exister dans l’onglet Variables.
• Astuce: changez FR/EN pour éditer les champs localisés.`
    );
  };

  // Sidebar/search/filter
  btnNewTemplate.onclick = () => {
    const id = uniqueId('nouveau_modele');
    const t = {
      id,
      category: (data.metadata.categories || [])[0] || '',
      title: { fr: '', en: '' },
      description: { fr: '', en: '' },
      subject: { fr: '', en: '' },
      body: { fr: '', en: '' },
      variables: []
    };
    data.templates.unshift(t);
    selectedTemplateId = id;
    saveDraft();
    afterDataLoad();
  };

  searchInput.oninput = debounce((e) => {
    searchTerm = e.target.value;
    renderSidebar();
  }, 200);

  catFilterSel.onchange = (e) => {
    filterCategory = e.target.value;
    renderSidebar();
  };

  langSwitch.onchange = (e) => {
    lang = e.target.value;
    renderMain();
  };

  // Tabs
  function setTab(active) {
    [tabTemplates, tabVariables, tabMetadata].forEach(b => b.classList.remove('active'));
    active.classList.add('active');
    renderMain();
  }
  tabTemplates.onclick = () => setTab(tabTemplates);
  tabVariables.onclick = () => setTab(tabVariables);
  tabMetadata.onclick = () => setTab(tabMetadata);

  // Save
  btnSave.onclick = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data, null, 2));
      notify('Brouillon enregistré.');
    } catch (e) {
      notify('Erreur lors de l’enregistrement du brouillon.', 'warn');
    }
  };

  // Esc helpers
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // Init
  loadInitial().catch(err => {
    notify('Erreur de chargement du JSON.', 'warn');
    console.error(err);
  });
})();
