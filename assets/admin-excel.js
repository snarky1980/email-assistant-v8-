// Assistant Excel: read .xlsx, normalize, validate, and export app-schema JSON
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const notice = $('#notice');
  const inpFile = $('#inp-xlsx');
  const inpClient = $('#inp-client');
  const inpGen = $('#inp-generate');
  const inpDefaultCat = $('#inp-default-cat');
  const btnParse = $('#btn-parse');
  const btnExport = $('#btn-export');
  const btnImportAdmin = $('#btn-import-admin');
  const btnReplaceRepo = $('#btn-replace-repo');
  const boxSummary = $('#summary');
  const boxWarn = $('#warnings');
  const boxErr = $('#errors');
  const rowsBox = $('#rows');
  const pv = $('#preview');
  const pvBody = $('#pv-body');
  const btnDlTpl = $('#btn-dl-template');

  const notify = (msg, type='info') => {
    if (!notice) return; notice.textContent = msg; notice.style.display='block';
    notice.style.background = (type==='warn') ? '#7c2d12' : '#111827';
    clearTimeout(notify._t); notify._t = setTimeout(()=>{ notice.style.display='none'; }, 2600);
  };

  const toAscii = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const idSanitize = (s) => toAscii(String(s||'').toLowerCase())
    .replace(/[^a-z0-9_\s-]+/g,'_')
    .replace(/[\s-]+/g,'_')
    .replace(/_+/g,'_')
    .slice(0,80)
    .replace(/[^A-Za-z0-9_]/g,'');
  function uniqueId(base, taken){ let id = base || 'modele'; let i=2; const lowTaken = new Set([...taken].map(x=>x.toLowerCase())); while(lowTaken.has(id.toLowerCase())) id = `${base}_${i++}`; return id; }

  const normKey = (s) => String(s||'').trim().toLowerCase().replace(/[_.:]/g,' ').replace(/\s+/g,' ');
  const H = new Map([
    ['id','id'],
    ['category fr','category_fr'], ['category en','category_en'], ['catégorie fr','category_fr'], ['catégorie en','category_en'], ['categorie fr','category_fr'], ['categorie en','category_en'],
    ['title fr','title_fr'], ['title en','title_en'], ['titre fr','title_fr'], ['titre en','title_en'],
    ['description fr','description_fr'], ['description en','description_en'], ['desc fr','description_fr'], ['desc en','description_en'],
    ['subject fr','subject_fr'], ['subject en','subject_en'], ['objet fr','subject_fr'], ['objet en','subject_en'],
    ['body fr','body_fr'], ['body en','body_en'], ['corps fr','body_fr'], ['corps en','body_en'],
    ['vars fr','vars_fr'], ['vars en','vars_en'], ['variables fr','vars_fr'], ['variables en','vars_en'],
    ['vars desc fr','vars_desc_fr'], ['vars desc en','vars_desc_en'], ['variables desc fr','vars_desc_fr'], ['variables desc en','vars_desc_en']
  ]);

  function readXlsx(file){
    return new Promise((resolve, reject) => {
      try { if (!XLSX) { reject(new Error('Librairie XLSX non chargée.')); return; } } catch { /* ignore */ }
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        try {
          const data = new Uint8Array(fr.result);
          const wb = XLSX.read(data, { type: 'array' });
          const first = wb.SheetNames && wb.SheetNames[0];
          if (!first) throw new Error('Aucune feuille trouvée dans le classeur.');
          const ws = wb.Sheets[first];
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false });
          resolve(rows);
        } catch(e){ reject(e); }
      };
      fr.readAsArrayBuffer(file);
    });
  }

  function rowsToObjects(rows){
    if (!rows?.length) return [];
    // Find first non-empty row as header (robust to leading blanks)
    let headIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c||'').trim() !== ''));
    if (headIdx < 0) return [];
    const header = rows[headIdx].map(h => H.get(normKey(h)) || normKey(h));
    const out = [];
    for (let i=headIdx+1;i<rows.length;i++){
      const r = rows[i]; if (!r || r.every(c => String(c||'').trim()==='')) continue;
      const obj = {}; for (let c=0;c<header.length;c++){ const k = header[c]; if (!k) continue; obj[k] = r[c] != null ? String(r[c]) : ''; }
      out.push(obj);
    }
    return out;
  }

  function extractPlaceholders(txt){
    const t = String(txt||''); const set = new Set([...(t.matchAll(/<<([^>]+)>>/g))].map(m=>m[1])); return Array.from(set);
  }
  function canonicalVar(name){
    const s = toAscii(String(name||'')).replace(/[^A-Za-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
    if (!s) return '';
    // camelCase
    const parts = s.split(' ');
    return parts.map((p,idx)=> idx===0 ? p.charAt(0).toUpperCase()+p.slice(1) : p.charAt(0).toUpperCase()+p.slice(1)).join('');
  }
  function inferFormat(n){
    if (/Montant|Nb|Nombre/i.test(n)) return 'number';
    if (/Heure/i.test(n)) return 'time';
    if (/Date|Délai|NouvelleDate|DateInitiale/i.test(n)) return 'date';
    return 'text';
  }
  function exampleFor(fmt){ return fmt==='number' ? '0' : fmt==='time' ? '17:00' : fmt==='date' ? '2025-01-01' : 'Exemple'; }

  function buildOutput(objs, options){
    const takenIds = new Set();
    const templates = [];
    const variables = {}; // global catalog
    const warnings = [];
    const errors = [];
    const addWarn = (m) => warnings.push(m);
    const addErr = (m) => errors.push(m);

    const normalizedRows = [];
    for (const row of objs){
      // titles
      let title_fr = row.title_fr || row.subject_fr || '';
      let title_en = row.title_en || row.subject_en || '';
      if (!title_fr && title_en) title_fr = translateTitleDeterministic(title_en, 'en_to_fr');
      if (!title_en && title_fr) title_en = translateTitleDeterministic(title_fr, 'fr_to_en');
      // id
      let id = String(row.id||'').trim();
      if (!id) {
        if (!title_fr) { addErr('Ligne sans ID et sans TITLE_FR/SUBJECT_FR.'); continue; }
        const base = idSanitize(title_fr); id = uniqueId(base || 'modele', takenIds); addWarn(`ID généré: ${id}`);
      } else {
        const norm = idSanitize(id); if (norm !== id){ addWarn(`ID normalisé: ${id} -> ${norm}`); id = norm; }
        id = uniqueId(id, takenIds);
      }
      takenIds.add(id);

      // categories: prefer FR then EN, else default
      let category = String(row.category_fr || row.category_en || options.defaultCategory || '').trim();
      if (!category) addWarn(`Catégorie vide pour ${id}`);

      // subjects/bodies
      const subj = { fr: row.subject_fr || '', en: row.subject_en || '' };
      const body = { fr: row.body_fr || '', en: row.body_en || '' };

      // descriptions
      let desc_fr = row.description_fr || '';
      let desc_en = row.description_en || '';
      if (!desc_fr) desc_fr = genShortDesc(title_fr || category);
      if (!desc_en) desc_en = translateDesc(desc_fr);

      // placeholders & canonical var lists
  const phFR = new Set([...extractPlaceholders(subj.fr), ...extractPlaceholders(body.fr)].map(canonicalVar).filter(Boolean));
  const phEN = new Set([...extractPlaceholders(subj.en), ...extractPlaceholders(body.en)].map(canonicalVar).filter(Boolean));
      // Vars columns
      const listedFR = (row.vars_fr||'').split(/[;,]/).map(s=>canonicalVar(s)).filter(Boolean);
      const listedEN = (row.vars_en||'').split(/[;,]/).map(s=>canonicalVar(s)).filter(Boolean);
      listedFR.forEach(v => phFR.add(v)); listedEN.forEach(v => phEN.add(v));
      const varsFr = Array.from(phFR).sort();
      const varsEn = Array.from(phEN).sort();

      // global variable catalog entries
      function ensureVar(key, lang){
        if (!key) return; if (!variables[key]) variables[key] = { description:{fr:'',en:''}, format:'text', example:'' };
        const fmt = inferFormat(key); variables[key].format = fmt; if (!variables[key].example) variables[key].example = exampleFor(fmt);
        // descriptions: try from rows vars_desc
        const descFR = (row.vars_desc_fr||''); const descEN = (row.vars_desc_en||'');
        if (descFR && !variables[key].description.fr) variables[key].description.fr = descFR;
        if (descEN && !variables[key].description.en) variables[key].description.en = descEN;
        if (!variables[key].description.fr) variables[key].description.fr = `Valeur pour ${key}`;
        if (!variables[key].description.en) variables[key].description.en = `Value for ${key}`;
        // Synonym hints between FR/EN canonical names
        const twin = synonymFor(key);
        if (twin) {
          variables[key].description.en = variables[key].description.en || `Equivalent in FR: ${twin}`;
          variables[key].description.fr = variables[key].description.fr || `Équivalent en EN: ${twin}`;
        }
      }
      varsFr.forEach(v => ensureVar(v,'fr')); varsEn.forEach(v => ensureVar(v,'en'));

      // build template object per app schema (variables as array; we also store bilingual arrays for export assistant needs)
      const t = {
        id,
        category,
        title: { fr: title_fr, en: title_en },
        description: { fr: desc_fr, en: desc_en },
        subject: subj,
        body: body,
        variables: Array.from(new Set([...varsFr, ...varsEn]))
      };

      // Validation: mandatory minimal content
      const hasAny = Boolean(t.subject.fr || t.subject.en || t.body.fr || t.body.en);
      if (!hasAny) { addErr(`Contenu vide pour ${id}`); continue; }
      templates.push(t);
      normalizedRows.push({ id, category, title_fr, title_en, subject_fr: subj.fr, subject_en: subj.en, body_fr: body.fr, body_en: body.en, varsFr, varsEn });
    }
    // Optional: suggestions generation when requested
    let suggestions = [];
    if (String((inpGen?.value||'no')) === 'yes') {
      suggestions = suggestMissingTemplates(templates);
    }
    return { templates, variables, warnings, errors, normalizedRows, suggestions };
  }

  // Deterministic helpers: simple bilingual description generator; no randomness
  function genShortDesc(seed){
    const base = String(seed||'').trim();
    if (!base) return 'Modèle de courriel prêt à l’envoi pour un usage courant.';
    return `Courriel prêt à l’emploi concernant « ${base} ».`;
  }
  function translateDesc(fr){
    // naive deterministic mapping; adjust for clarity
    return fr.replace('Courriel prêt à l’emploi concernant', 'Ready-to-send email regarding').replace('«','“').replace('»','”');
  }

  function translateTitleDeterministic(txt, dir){
    const mapFrEn = new Map([
      ['confirmation','Confirmation'], ['annulation','Cancellation'], ['rappel','Reminder'], ['devis','Quote'], ['facture','Invoice'], ['appel','Call'], ['réunion','Meeting'], ['urgence','Urgency'], ['retard','Delay'], ['suivi','Follow-up'], ['mise à jour','Update'], ['demande','Request'], ['réponse','Response'], ['approbation','Approval'], ['livraison','Delivery']
    ]);
    const s = String(txt||'').trim(); if (!s) return '';
    if (dir === 'fr_to_en') {
      let out = s; for (const [fr,en] of mapFrEn.entries()) out = out.replace(new RegExp(`\\b${fr}\\b`, 'gi'), en);
      return capitalize(out);
    } else {
      let out = s; for (const [fr,en] of mapFrEn.entries()) out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), fr.charAt(0).toUpperCase()+fr.slice(1));
      return capitalize(out);
    }
  }
  function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

  function synonymFor(key){
    const pairs = [ ['NumeroProjet','ProjectNumber'], ['NbJours','Days'], ['NbJoursUrgence','UrgentDays'], ['Montant','Amount'], ['DateInitiale','StartDate'], ['NouvelleDate','NewDate'] ];
    const lower = String(key||'');
    for (const [a,b] of pairs){ if (a===lower) return b; if (b===lower) return a; }
    return '';
  }

  function suggestMissingTemplates(existing){
    const haveCat = new Set(existing.map(t=>t.category||''));
    const catalog = [
      { category: 'Suivi', fr: { title:'Rappel – Information manquante', subject:'Rappel concernant <<NumeroProjet>>', body:'Bonjour,\n\nNous attendons toujours les informations manquantes pour <<NumeroProjet>>.\nMerci de nous les fournir d’ici le <<NouvelleDate>>.\n\nCordialement,' }, en: { title:'Reminder – Missing information', subject:'Reminder about <<ProjectNumber>>', body:'Hello,\n\nWe still need the missing information for <<ProjectNumber>>.\nPlease provide it by <<NewDate>>.\n\nRegards,' } },
      { category: 'Facturation', fr: { title:'Facture – Envoi de copie', subject:'Facture #<<NumeroProjet>>', body:'Bonjour,\n\nVeuillez trouver ci-joint une copie de la facture pour <<NumeroProjet>> (montant: <<Montant>>).\n\nCordialement,' }, en: { title:'Invoice – Copy sent', subject:'Invoice #<<ProjectNumber>>', body:'Hello,\n\nPlease find attached a copy of the invoice for <<ProjectNumber>> (amount: <<Amount>>).\n\nRegards,' } },
      { category: 'Planification', fr: { title:'Confirmation – Nouvelle date', subject:'Nouvelle date pour <<NumeroProjet>>', body:'Bonjour,\n\nLa nouvelle date proposée pour <<NumeroProjet>> est le <<NouvelleDate>>.\nMerci de confirmer la réception.\n\nCordialement,' }, en: { title:'Confirmation – New date', subject:'New date for <<ProjectNumber>>', body:'Hello,\n\nThe proposed new date for <<ProjectNumber>> is <<NewDate>>.\nPlease confirm receipt.\n\nRegards,' } }
    ];
    // Provide one suggestion per category missing from the sheet
    const out = [];
    const seen = new Set();
    for (const item of catalog){ if (!haveCat.has(item.category) && !seen.has(item.category)) { seen.add(item.category); out.push(item); } }
    // Convert to app-like items with generated IDs and variables
    return out.map(s => {
      const id = uniqueId(idSanitize(s.fr.title) || 'suggestion', new Set());
      const varsFr = Array.from(new Set([...extractPlaceholders(s.fr.subject), ...extractPlaceholders(s.fr.body)].map(canonicalVar)));
      const varsEn = Array.from(new Set([...extractPlaceholders(s.en.subject), ...extractPlaceholders(s.en.body)].map(canonicalVar)));
      return {
        suggestion: true,
        id,
        category: s.category,
        title: { fr: s.fr.title, en: s.en.title },
        description: { fr: genShortDesc(s.fr.title), en: translateDesc(genShortDesc(s.fr.title)) },
        subject: { fr: s.fr.subject, en: s.en.subject },
        body: { fr: s.fr.body, en: s.en.body },
        variables: Array.from(new Set([...varsFr, ...varsEn]))
      };
    });
  }

  async function parseAndValidate(){
    const f = inpFile?.files?.[0]; if (!f) { notify('Sélectionnez un fichier .xlsx', 'warn'); return; }
    const client = (inpClient?.value||'client').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'');
    const rows = await readXlsx(f); const objs = rowsToObjects(rows);
    if (!objs.length) {
      try {
        let headIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c||'').trim() !== ''));
        if (headIdx >= 0) {
          const rawHeader = rows[headIdx].map(c => String(c||''));
          const mapped = rawHeader.map(h => H.get(normKey(h)) || normKey(h));
          boxErr.style.display = 'block';
          boxErr.innerHTML = `<div><strong>Impossible de lire des lignes après l’entête</strong></div>
            <div class="hint" style="margin-top:6px;white-space:pre-wrap">Entêtes détectées:\n- ${escapeHtml(rawHeader.join(' | '))}\n\nCorrespondances internes:\n- ${escapeHtml(mapped.join(' | '))}\n\nColonnes acceptées: ID, CATEGORY_FR|CATEGORY_EN, TITLE_FR|TITLE_EN, DESCRIPTION_FR|DESCRIPTION_EN, SUBJECT_FR|SUBJECT_EN, BODY_FR|BODY_EN, VARS_FR|VARS_EN, VARS_DESC_FR|VARS_DESC_EN.</div>`;
        } else {
          boxErr.style.display = 'block';
          boxErr.innerHTML = `<div><strong>Aucune entête détectée</strong></div><div class="hint" style="margin-top:6px">Vérifiez que la première ligne non vide contient les noms de colonnes.</div>`;
        }
      } catch {}
      notify('Aucune ligne exploitable.', 'warn');
      return;
    }
    const { templates, variables, warnings, errors, normalizedRows, suggestions } = buildOutput(objs, { defaultCategory: inpDefaultCat?.value || '' });

    // Show summary
    boxSummary.style.display = 'block';
    boxSummary.innerHTML = `<div><strong>${templates.length}</strong> modèles prêts • <strong>${Object.keys(variables).length}</strong> variables au catalogue</div>`;
    boxWarn.style.display = warnings.length ? 'block' : 'none';
    boxWarn.innerHTML = warnings.length ? `<div><strong>Avertissements (${warnings.length})</strong></div><ul style="margin:6px 0 0 18px">${warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '';
    boxErr.style.display = errors.length ? 'block' : 'none';
    boxErr.innerHTML = errors.length ? `<div><strong>Erreurs (${errors.length})</strong> — corriger avant export</div><ul style="margin:6px 0 0 18px">${errors.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '';

    // Render rows list for inline preview
    rowsBox.innerHTML = normalizedRows.map((r, idx) => `<button data-row="${idx}" style="text-align:left;border:1px solid var(--border);background:#fff;padding:8px;border-radius:10px;cursor:pointer">${escapeHtml(r.id)} — ${escapeHtml(r.title_fr || r.title_en || '')}</button>`).join('');
    rowsBox.querySelectorAll('button[data-row]')?.forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.getAttribute('data-row'),10);
        const r = normalizedRows[i]; if (!r) return;
        pv.style.display = '';
        pvBody.innerHTML = `
          <div class="row">
            <div class="field"><label>Objet FR</label><input value="${escapeHtml(r.subject_fr||'')}" readonly /></div>
            <div class="field"><label>Subject EN</label><input value="${escapeHtml(r.subject_en||'')}" readonly /></div>
          </div>
          <div class="row">
            <div class="field"><label>Corps FR</label><textarea readonly>${escapeHtml(r.body_fr||'')}</textarea></div>
            <div class="field"><label>Body EN</label><textarea readonly>${escapeHtml(r.body_en||'')}</textarea></div>
          </div>
          <div class="chips" style="margin-top:8px"><span class="chip">Vars FR: ${escapeHtml((r.varsFr||[]).join(', '))}</span><span class="chip">Vars EN: ${escapeHtml((r.varsEn||[]).join(', '))}</span></div>
        `;
      };
    });

    // Render suggestions
    const sugBox = document.getElementById('suggestions');
    sugBox.innerHTML = (suggestions||[]).map((s, i) => `
      <div class="tile" style="border:1px solid var(--border);border-radius:12px;padding:10px;background:#fff;display:grid;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(s.title.fr)}</strong><span class="pill">${escapeHtml(s.category)}</span></div>
        <div class="chips"><span class="chip">${escapeHtml(s.variables.join(', '))}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-accept="${i}">Accepter</button>
          <button data-skip="${i}">Ignorer</button>
        </div>
      </div>
    `).join('');
    sugBox.querySelectorAll('button[data-accept]')?.forEach(b => b.onclick = () => {
      const idx = parseInt(b.getAttribute('data-accept'),10); const s = suggestions[idx]; if (!s) return; templates.push(s); b.closest('.tile')?.remove(); updateSummary();
    });
    sugBox.querySelectorAll('button[data-skip]')?.forEach(b => b.onclick = () => { b.closest('.tile')?.remove(); });

    function updateSummary(){ boxSummary.innerHTML = `<div><strong>${templates.length}</strong> modèles prêts • <strong>${Object.keys(variables).length}</strong> variables au catalogue</div>`; }

    // Save in memory for export
    window._excelAssistant = { templates, variables, client };
    btnExport.disabled = templates.length === 0;
    if (btnImportAdmin) btnImportAdmin.disabled = templates.length === 0;
    if (btnReplaceRepo) btnReplaceRepo.disabled = templates.length === 0;
    notify('Analyse terminée.');
  }

  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  function exportJson(){
    const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
    // Conform to app schema
    const out = {
      metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
      variables: st.variables,
      templates: st.templates
    };
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    const HH = String(now.getHours()).padStart(2,'0');
    const MM = String(now.getMinutes()).padStart(2,'0');
    const SS = String(now.getSeconds()).padStart(2,'0');
    const file = `templates_${st.client || 'client'}_${yyyy}${mm}${dd}_${HH}${MM}${SS}.json`;
    const blob = new Blob([JSON.stringify(out,null,2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); a.remove();
  }

  if (btnParse) btnParse.onclick = () => { parseAndValidate().catch(e => {
    console.error(e);
    try {
      boxErr.style.display = 'block';
      boxErr.innerHTML = `<div><strong>Erreur d’analyse</strong></div><div class="hint" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(e?.stack || e?.message || String(e))}</div>`;
    } catch {}
    notify('Échec de l’analyse', 'warn');
  }); };
  if (btnExport) btnExport.onclick = exportJson;
  if (btnImportAdmin) btnImportAdmin.onclick = () => {
    try {
      const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
      const obj = {
        metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
        variables: st.variables,
        templates: st.templates
      };
      localStorage.setItem('ea_admin_draft_v2', JSON.stringify(obj, null, 2));
      // go to admin console
      window.location.href = './admin.html';
    } catch (e) {
      console.error(e);
      notify('Impossible d’importer dans la console.', 'warn');
    }
  };
  if (btnReplaceRepo) btnReplaceRepo.onclick = async () => {
    try {
      const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
      const obj = {
        metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
        variables: st.variables,
        templates: st.templates
      };
      const resp = await fetch('/__replace_templates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(obj) });
      const json = await resp.json().catch(()=>({ ok:false, error:'Invalid server response' }));
      if (!resp.ok || !json.ok) { throw new Error(json.error || `HTTP ${resp.status}`); }
      notify('Fichier remplacé. Rechargement...');
      setTimeout(()=>location.reload(), 500);
    } catch (e) {
      console.error(e);
      notify('Échec du remplacement (mode dev uniquement). Ouvrir la console.', 'warn');
    }
  };
  if (btnDlTpl) btnDlTpl.onclick = () => {
    // Build a tiny starter Excel in-memory via CSV fallback for simplicity
    const csv = [
      ['ID','CATEGORY_FR','CATEGORY_EN','TITLE_FR','TITLE_EN','DESCRIPTION_FR','DESCRIPTION_EN','SUBJECT_FR','SUBJECT_EN','BODY_FR','BODY_EN','VARS_FR','VARS_EN','VARS_DESC_FR','VARS_DESC_EN'].join(','),
      ['','','','Confirmation de rendez-vous','Appointment confirmation','Confirme un rendez-vous planifié','Confirms a scheduled appointment','Confirmation pour <<NumeroProjet>>','Appointment confirmation for <<ProjectNumber>>','Bonjour...','Hello...','NumeroProjet;NouvelleDate','ProjectNumber;NewDate','Identifiant de projet et nouvelle date','Project identifier and new date'].map(v=>`"${v}"`).join(',')
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'assistant_excel_modele.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); a.remove();
  };
})();
