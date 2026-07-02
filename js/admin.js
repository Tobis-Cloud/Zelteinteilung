// ============================================
// admin.js
// Admin-Bereich: Login, Datenliste, Graph-Trigger, Gruppenberechnung
// ============================================

(function () {
  'use strict';

  // Nur auf admin.html ausführen
  if (!document.getElementById('admin-page')) return;

  // --- DOM-Elemente ---
  const loginSection   = document.getElementById('login-section');
  const dashSection    = document.getElementById('dashboard-section');
  const loginForm      = document.getElementById('login-form');
  const loginEmail     = document.getElementById('login-email');
  const loginPassword  = document.getElementById('login-password');
  const loginAlert     = document.getElementById('login-alert');
  const loginBtn       = document.getElementById('login-btn');
  const logoutBtn      = document.getElementById('logout-btn');
  const adminEmailDisp = document.getElementById('admin-email-display');

  // Tabs
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Statistiken
  const statTotal    = document.getElementById('stat-total');
  const statWith     = document.getElementById('stat-with-wishes');
  const statWithout  = document.getElementById('stat-without-wishes');
  const statFulfillmentRate = document.getElementById('stat-fulfillment-rate');

  // Tabelle
  const tableBody    = document.getElementById('entries-tbody');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');

  // Graph
  const loadGraphBtn  = document.getElementById('load-graph-btn');
  const exportPngBtn  = document.getElementById('export-png-btn');
  const graphContainer = document.getElementById('graph-container');

  // Gruppen DOM-Elemente
  const zeltGroesseInput   = document.getElementById('zelt-groesse');
  const calcGroupsBtn       = document.getElementById('calc-groups-btn');
  const groupsGrid          = document.getElementById('groups-grid');
  const exportGroupsBtn     = document.getElementById('export-groups-btn');
  const fullscreenGroupsBtn = document.getElementById('fullscreen-groups-btn');

  // Graph Overrides & Tools
  const connSelect1 = document.getElementById('conn-select-1');
  const connSelect2 = document.getElementById('conn-select-2');
  const addConnBtn = document.getElementById('add-conn-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const infoTooltipBtn = document.getElementById('info-tooltip-btn');
  const infoTooltipContent = document.getElementById('info-tooltip-content');

  // --- State ---
  let allEntries  = [];
  let lastGroups  = [];
  let manualOverrides = { broken: [], added: [] };

  try {
    const stored = localStorage.getItem('jula2026_overrides');
    if (stored) manualOverrides = JSON.parse(stored);
  } catch (e) {
    console.warn('Fehler beim Laden der Overrides:', e);
  }

  // ============================================
  // AUTH
  // ============================================
  auth.onAuthStateChanged(user => {
    if (user) {
      showDashboard(user);
    } else {
      showLogin();
    }
  });

  function showLogin() {
    loginSection.classList.remove('hidden');
    dashSection.classList.add('hidden');
  }

  function showDashboard(user) {
    loginSection.classList.add('hidden');
    dashSection.classList.remove('hidden');
    if (adminEmailDisp) adminEmailDisp.textContent = user.email;
    loadEntries();
  }

  // Login
  loginForm && loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginAlert.classList.add('hidden');
    setLoginLoading(true);

    try {
      await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
    } catch (err) {
      let msg = 'Anmeldung fehlgeschlagen.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'E-Mail oder Passwort falsch.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Zu viele Anmeldeversuche. Bitte warte kurz.';
      }
      loginAlert.className = 'alert alert--error';
      loginAlert.innerHTML = `<span class="alert__icon">❌</span><div>${msg}</div>`;
      loginAlert.classList.remove('hidden');
    } finally {
      setLoginLoading(false);
    }
  });

  // Logout
  logoutBtn && logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
  });

  function setLoginLoading(loading) {
    if (!loginBtn) return;
    loginBtn.disabled = loading;
    loginBtn.classList.toggle('loading', loading);
  }

  // ============================================
  // TABS
  // ============================================
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`)?.classList.add('active');

      // Graph automatisch laden, sobald der Reiter geöffnet wird
      if (target === 'graph') {
        autoLoadGraph();
      }
    });
  });

  // ============================================
  // DATEN LADEN
  // ============================================
  async function loadEntries() {
    try {
      const snapshot = await db.collection('wuensche')
        .orderBy('timestamp', 'asc')
        .get();

      allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderStats();
      renderTable();
      populateConnDropdowns();
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" class="table-empty">⚠️ Fehler beim Laden der Daten.</td></tr>`;
      }
    }
  }

  // ============================================
  // STATISTIKEN
  // ============================================
  function renderStats() {
    const total    = allEntries.length;
    const withWish = allEntries.filter(e =>
      e.wunsch1_vorname || e.wunsch2_vorname || e.wunsch3_vorname
    ).length;
    const without  = total - withWish;

    if (statTotal)   statTotal.textContent   = total;
    if (statWith)    statWith.textContent    = withWish;
    if (statWithout) statWithout.textContent = without;

    if (statFulfillmentRate) {
      if (lastGroups && lastGroups.length > 0) {
        let totalWishes = 0;
        let fulfilledWishes = 0;

        lastGroups.forEach(g => {
          g.members.forEach(m => {
            const memberKey = makeKey(m.vorname, m.nachname);
            const entry = allEntries.find(e => makeKey(e.vorname, e.nachname) === memberKey);
            if (entry) {
              for (let w = 1; w <= 3; w++) {
                const wv = entry[`wunsch${w}_vorname`];
                const wn = entry[`wunsch${w}_nachname`];
                if (wv && wn) {
                  totalWishes++;
                  const wKey = makeKey(wv, wn);
                  const isFulfilled = g.members.some(other => makeKey(other.vorname, other.nachname) === wKey);
                  if (isFulfilled) fulfilledWishes++;
                }
              }
            }
          });
        });

        const rate = totalWishes > 0 ? Math.round((fulfilledWishes / totalWishes) * 100) : 100;
        statFulfillmentRate.textContent = `${rate}%`;
      } else {
        statFulfillmentRate.textContent = '–';
      }
    }
  }

  // ============================================
  // TABELLE
  // ============================================
  function renderTable() {
    if (!tableBody) return;

    if (allEntries.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="table-empty">📋 Noch keine Einträge vorhanden.</td></tr>`;
      return;
    }

    tableBody.innerHTML = allEntries.map((e, i) => {
      const wishes = [
        formatPartner(e.wunsch1_vorname, e.wunsch1_nachname),
        formatPartner(e.wunsch2_vorname, e.wunsch2_nachname),
        formatPartner(e.wunsch3_vorname, e.wunsch3_nachname),
      ].filter(Boolean);

      const wishHtml = wishes.length > 0
        ? wishes.map(w => `<span class="badge badge--red" style="margin:1px;">${w}</span>`).join(' ')
        : `<span class="badge badge--gray">kein Wunsch</span>`;

      const ts = e.timestamp?.toDate
        ? e.timestamp.toDate().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
        : '–';

      return `
        <tr>
          <td style="color:var(--gray-500);font-size:0.8rem;">${i + 1}</td>
          <td><strong>${esc(e.vorname)} ${esc(e.nachname)}</strong></td>
          <td style="font-size:0.8rem;color:var(--gray-500);">${esc(e.email || '–')}</td>
          <td>${wishHtml}</td>
          <td style="font-size:0.8rem;color:var(--gray-500);">${ts}</td>
        </tr>
      `;
    }).join('');
  }

  function formatPartner(vorname, nachname) {
    if (!vorname && !nachname) return null;
    return `${vorname || ''} ${nachname || ''}`.trim();
  }

  // ============================================
  // EXPORT
  // ============================================
  exportXlsxBtn && exportXlsxBtn.addEventListener('click', () => {
    exportXLSX(allEntries);
  });

  exportPngBtn && exportPngBtn.addEventListener('click', () => {
    exportGraphPNG();
  });

  exportGroupsBtn && exportGroupsBtn.addEventListener('click', () => {
    exportGroupsXLSX(lastGroups);
  });



  // ============================================
  // GRAPH LOGIK & MANUELLE OVERRIDES
  // ============================================
  let clusterActive = false;
  let currentDensity = 'normal';

  const toggleClusterBtn = document.getElementById('toggle-cluster-btn');
  const densityNormalBtn = document.getElementById('density-normal-btn');
  const densityTightBtn  = document.getElementById('density-tight-btn');
  const densitySuperBtn  = document.getElementById('density-super-btn');

  // Admin-Zustand in Firestore speichern (Synchronisierung für alle Admins)
  async function saveAdminState() {
    try {
      await db.collection('settings').doc('admin_state').set({
        manualOverrides,
        lastGroups,
        calcMode: calcMode?.value || 'size',
        zeltGroesse: parseInt(zeltGroesseInput?.value) || 5,
        zeltAnzahl: parseInt(document.getElementById('zelt-anzahl')?.value) || 10,
        zeltVariation: parseInt(document.getElementById('zelt-variation')?.value) || 1
      });
    } catch (e) {
      console.error('Fehler beim Speichern des Admin-Zustands:', e);
    }
  }

  // Admin-Zustand aus Firestore laden
  async function loadAdminState() {
    try {
      const doc = await db.collection('settings').doc('admin_state').get();
      if (doc.exists) {
        const data = doc.data();
        if (data.manualOverrides) manualOverrides = data.manualOverrides;
        if (data.lastGroups) {
          lastGroups = data.lastGroups;
          renderGroups(lastGroups);
          if (exportGroupsBtn) exportGroupsBtn.disabled = false;
          if (editModeBtn) editModeBtn.disabled = false;
        }
        if (data.calcMode && calcMode) {
          calcMode.value = data.calcMode;
          if (data.calcMode === 'size') {
            if (sizeModeInputs) sizeModeInputs.style.display = 'block';
            if (countModeInputs) countModeInputs.style.display = 'none';
          } else {
            if (sizeModeInputs) sizeModeInputs.style.display = 'none';
            if (countModeInputs) countModeInputs.style.display = 'flex';
          }
        }
        if (data.zeltGroesse && zeltGroesseInput) zeltGroesseInput.value = data.zeltGroesse;
        const za = document.getElementById('zelt-anzahl');
        if (data.zeltAnzahl && za) za.value = data.zeltAnzahl;
        const zv = document.getElementById('zelt-variation');
        if (data.zeltVariation && zv) zv.value = data.zeltVariation;
      }
    } catch (e) {
      console.warn('Fehler beim Laden des Admin-Zustands:', e);
    }
  }

  // Hilfsfunktion zum automatischen Laden des Graphen
  function autoLoadGraph() {
    if (allEntries.length === 0) return;

    // Bündeln-Button nur anzeigen, wenn Zeltgruppen bereits berechnet wurden
    if (lastGroups && lastGroups.length > 0) {
      if (toggleClusterBtn) toggleClusterBtn.style.display = 'inline-flex';
    } else {
      if (toggleClusterBtn) toggleClusterBtn.style.display = 'none';
    }

    renderGraph('graph-container', allEntries, lastGroups, clusterActive, currentDensity, manualOverrides);
  }

  // Callback für D3-Klick auf eine Verbindungslinie
  window.handleLinkClick = function (edgeKey, isManual) {
    if (isManual) {
      // Eine manuelle grüne Kante wurde angeklickt -> restlos löschen
      manualOverrides.added = manualOverrides.added.filter(k => k !== edgeKey);
    } else {
      // Eine Standard-Wunschkante wurde angeklickt -> zwischen gelöst (broken) und normal wechseln
      if (manualOverrides.broken.includes(edgeKey)) {
        manualOverrides.broken = manualOverrides.broken.filter(k => k !== edgeKey);
      } else {
        manualOverrides.broken.push(edgeKey);
      }
    }
    saveAdminState();
    autoLoadGraph();
    recalculateGroupsSilently();
  };

  //Dropdown-Menüs für manuelle Verbindungen befüllen
  function populateConnDropdowns() {
    if (!connSelect1 || !connSelect2) return;

    // Alle eindeutigen Kinder extrahieren
    const childrenMap = new Map();
    allEntries.forEach(e => {
      const key = makeKey(e.vorname, e.nachname);
      childrenMap.set(key, `${e.vorname} ${e.nachname}`);
      
      // Auch Wunschpartner sammeln, falls diese keinen eigenen Eintrag haben
      for (let i = 1; i <= 3; i++) {
        const wv = e[`wunsch${i}_vorname`];
        const wn = e[`wunsch${i}_nachname`];
        if (wv && wn) {
          const wKey = makeKey(wv, wn);
          if (!childrenMap.has(wKey)) {
            childrenMap.set(wKey, `${wv} ${wn}`);
          }
        }
      }
    });

    // Alphabetisch nach Namen sortieren
    const sorted = Array.from(childrenMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    const optionsHtml = '<option value="">-- Kind wählen --</option>' + 
      sorted.map(([key, name]) => `<option value="${key}">${esc(name)}</option>`).join('');

    connSelect1.innerHTML = optionsHtml;
    connSelect2.innerHTML = optionsHtml;
  }

  // Manuelle Verbindung hinzufügen
  addConnBtn && addConnBtn.addEventListener('click', () => {
    const k1 = connSelect1.value;
    const k2 = connSelect2.value;

    if (!k1 || !k2) {
      alert('Bitte wähle zwei Kinder aus.');
      return;
    }
    if (k1 === k2) {
      alert('Ein Kind kann nicht mit sich selbst verbunden werden!');
      return;
    }

    const edgeKey = [k1, k2].sort().join('||');
    
    // Falls Kante gelöst war, reaktivieren. Sonst neu hinzufügen.
    manualOverrides.broken = manualOverrides.broken.filter(k => k !== edgeKey);
    if (!manualOverrides.added.includes(edgeKey)) {
      manualOverrides.added.push(edgeKey);
    }

    saveAdminState();
    autoLoadGraph();
    recalculateGroupsSilently();

    // Select-Felder zurücksetzen
    connSelect1.value = "";
    connSelect2.value = "";
  });

  // Vollbildmodus umschalten
  fullscreenBtn && fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      graphContainer.requestFullscreen().catch(err => {
        console.error(`Fehler beim Vollbildmodus: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // Resize-Verhalten im Vollbildmodus
  document.addEventListener('fullscreenchange', () => {
    autoLoadGraph();
  });

  // Vollbildmodus für Zeltgruppen umschalten
  fullscreenGroupsBtn && fullscreenGroupsBtn.addEventListener('click', () => {
    const tabGroups = document.getElementById('tab-groups');
    if (tabGroups) {
      if (!document.fullscreenElement) {
        tabGroups.requestFullscreen().catch(err => {
          console.error(`Fehler beim Vollbildmodus für Zeltgruppen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  });

  // Dichte-Schalter binden
  function setDensity(density) {
    currentDensity = density;
    
    [densityNormalBtn, densityTightBtn, densitySuperBtn].forEach(btn => {
      if (btn) {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.boxShadow = 'none';
      }
    });

    let activeBtn;
    if (density === 'normal') activeBtn = densityNormalBtn;
    else if (density === 'tight') activeBtn = densityTightBtn;
    else if (density === 'super') activeBtn = densitySuperBtn;

    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = 'var(--white)';
      activeBtn.style.boxShadow = 'var(--shadow-sm)';
    }

    autoLoadGraph();
  }

  densityNormalBtn && densityNormalBtn.addEventListener('click', () => setDensity('normal'));
  densityTightBtn && densityTightBtn.addEventListener('click', () => setDensity('tight'));
  densitySuperBtn && densitySuperBtn.addEventListener('click', () => setDensity('super'));

  loadGraphBtn && loadGraphBtn.addEventListener('click', () => {
    if (allEntries.length === 0) {
      alert('Keine Daten zum Anzeigen vorhanden.');
      return;
    }
    autoLoadGraph();
  });

  toggleClusterBtn && toggleClusterBtn.addEventListener('click', () => {
    clusterActive = !clusterActive;
    if (clusterActive) {
      toggleClusterBtn.classList.remove('btn--outline');
      toggleClusterBtn.classList.add('btn--primary');
      toggleClusterBtn.innerHTML = '✨ Gruppen auflösen';
    } else {
      toggleClusterBtn.classList.remove('btn--primary');
      toggleClusterBtn.classList.add('btn--outline');
      toggleClusterBtn.innerHTML = '🔮 Gruppen bündeln';
    }
    autoLoadGraph();
  });

  // ============================================
  // GRUPPEN BERECHNEN & BEARBEITUNG
  // ============================================
  let isEditing = false;
  const calcMode = document.getElementById('calc-mode');
  const sizeModeInputs = document.getElementById('size-mode-inputs');
  const countModeInputs = document.getElementById('count-mode-inputs');
  const editModeBtn = document.getElementById('edit-mode-btn');

  // Modus umschalten
  calcMode && calcMode.addEventListener('change', () => {
    if (calcMode.value === 'size') {
      if (sizeModeInputs) sizeModeInputs.style.display = 'block';
      if (countModeInputs) countModeInputs.style.display = 'none';
    } else {
      if (sizeModeInputs) sizeModeInputs.style.display = 'none';
      if (countModeInputs) countModeInputs.style.display = 'flex';
    }
  });

  // Bearbeitungsmodus aktivieren / beenden
  editModeBtn && editModeBtn.addEventListener('click', () => {
    isEditing = !isEditing;
    if (isEditing) {
      editModeBtn.classList.remove('btn--outline');
      editModeBtn.classList.add('btn--primary');
      editModeBtn.innerHTML = '✅ Bearbeiten beenden';
    } else {
      editModeBtn.classList.remove('btn--primary');
      editModeBtn.classList.add('btn--outline');
      editModeBtn.innerHTML = '✏️ Bearbeiten';
    }
    renderGroups(lastGroups);
  });

  calcGroupsBtn && calcGroupsBtn.addEventListener('click', () => {
    if (allEntries.length === 0) {
      alert('Keine Daten für die Gruppenberechnung vorhanden.');
      return;
    }

    const mode = calcMode?.value || 'size';
    if (mode === 'size') {
      const size = parseInt(zeltGroesseInput?.value) || 5;
      lastGroups = calculateGroups(allEntries, size, manualOverrides, 'size');
    } else {
      const numTents = parseInt(document.getElementById('zelt-anzahl')?.value) || 10;
      const maxVar = parseInt(document.getElementById('zelt-variation')?.value) || 1;
      lastGroups = calculateGroups(allEntries, null, manualOverrides, 'count', numTents, maxVar);
    }

    renderGroups(lastGroups);

    // Bündeln-Button im Graph aktivieren und anzeigen
    if (toggleClusterBtn) {
      toggleClusterBtn.style.display = 'inline-flex';
    }

    // Graph automatisch aktualisieren, falls das SVG-Element existiert
    if (document.getElementById('graph-svg')) {
      autoLoadGraph();
    }

    // Export-Button & Bearbeitungsmodus aktivieren
    if (exportGroupsBtn) exportGroupsBtn.disabled = false;
    if (editModeBtn) editModeBtn.disabled = false;
    saveAdminState();
  });

  // Gruppen stillschweigend neu berechnen (für automatische Updates)
  function recalculateGroupsSilently() {
    if (allEntries.length === 0) return;
    const mode = calcMode?.value || 'size';
    if (mode === 'size') {
      const size = parseInt(zeltGroesseInput?.value) || 5;
      lastGroups = calculateGroups(allEntries, size, manualOverrides, 'size');
    } else {
      const numTents = parseInt(document.getElementById('zelt-anzahl')?.value) || 10;
      const maxVar = parseInt(document.getElementById('zelt-variation')?.value) || 1;
      lastGroups = calculateGroups(allEntries, null, manualOverrides, 'count', numTents, maxVar);
    }
    renderGroups(lastGroups);
  }

  function renderGroups(groups) {
    if (!groupsGrid) return;

    if (groups.length === 0) {
      groupsGrid.innerHTML = '<p style="color:var(--gray-500);font-size:0.9rem;">Keine Gruppen berechnet.</p>';
      return;
    }

    const colors = [
      '#E8001E','#2563EB','#16a34a','#d97706','#7c3aed',
      '#0891b2','#be185d','#059669','#dc2626','#4338ca',
    ];

    groupsGrid.innerHTML = groups.map((g, i) => {
      const color = colors[i % colors.length];
      const membersHtml = g.members.map(m => {
        const memberKey = makeKey(m.vorname, m.nachname);
        const entry = allEntries.find(e => makeKey(e.vorname, e.nachname) === memberKey);
        const wishesHtml = [];
        
        if (entry) {
          for (let w = 1; w <= 3; w++) {
            const wv = entry[`wunsch${w}_vorname`];
            const wn = entry[`wunsch${w}_nachname`];
            if (wv && wn) {
              const wKey = makeKey(wv, wn);
              // Prüfen, ob der Wunschpartner im selben Zelt sitzt
              const isFulfilled = g.members.some(other => makeKey(other.vorname, other.nachname) === wKey);
              
              const compactLastName = wn ? ` ${esc(wn[0])}.` : '';
              const symbol = isFulfilled ? '✓' : '✗';
              wishesHtml.push(`
                <span class="wish-badge" 
                      data-target-key="${wKey}" 
                      title="${esc(wv)} ${esc(wn)}"
                      style="cursor:pointer;display:inline-flex;align-items:center;gap:2px;font-size:0.58rem;padding:1px 4px;border-radius:4px;background:${isFulfilled ? '#dcfce7' : '#fee2e2'};color:${isFulfilled ? '#15803d' : '#b91c1c'};font-weight:500;border:1px solid ${isFulfilled ? '#bbf7d0' : '#fecaca'};">
                  ${symbol} ${esc(wv)}${compactLastName}
                </span>
              `);
            }
          }
        }

        const wishesText = wishesHtml.length > 0
          ? wishesHtml.join(' ')
          : `<span style="font-size:0.6rem;color:var(--gray-400);">keine Wünsche</span>`;

        return `
          <li class="member-item" 
              ${isEditing ? 'draggable="true"' : ''} 
              data-member-key="${memberKey}" 
              data-group-index="${i}"
              style="padding:3px 6px;margin:3px 0;border-radius:3px;background:var(--white);border:1px solid var(--gray-200);box-shadow:var(--shadow-xs);display:flex;align-items:center;justify-content:space-between;gap:4px;${isEditing ? 'cursor:move;border-style:dashed;border-color:var(--gray-400);' : ''}">
            <span class="member-name" style="font-weight:600;font-size:0.68rem;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:82px;" title="${esc(m.vorname)} ${esc(m.nachname)}">
              ${esc(m.vorname)} ${m.nachname ? esc(m.nachname[0]) + '.' : ''}
            </span>
            <div class="wishes-list" style="display:flex;gap:2px;flex-shrink:0;">
              ${wishesText}
            </div>
          </li>
        `;
      }).join('');

      const titleHtml = isEditing
        ? `<input type="text" class="group-name-input" data-group-index="${i}" value="${esc(g.name)}" style="font-size:0.8rem;font-weight:700;border:1px solid var(--gray-300);border-radius:4px;padding:2px 6px;width:110px;outline:none;background:var(--gray-50);color:var(--gray-900);" />`
        : esc(g.name);

      return `
        <div class="group-card" data-group-index="${i}">
          <div class="group-card__title">
            <div class="group-card__dot" style="background:${color};"></div>
            ${titleHtml}
            <span class="badge badge--gray" style="margin-left:auto;">${g.size} Jungs</span>
          </div>
          <ul class="group-card__members">
            ${membersHtml}
          </ul>
        </div>
      `;
    }).join('');
    renderStats(); // Wunscherfüllungsquote live aktualisieren!
  }

  // ============================================
  // DRAG & DROP FÜR MANUELLES SCHIEBEN
  // ============================================
  let draggedMemberKey = null;
  let draggedSourceGroupIndex = null;

  if (groupsGrid) {
    // Drag Start
    groupsGrid.addEventListener('dragstart', (e) => {
      if (!isEditing) return;
      const item = e.target.closest('.member-item');
      if (!item) return;
      
      draggedMemberKey = item.dataset.memberKey;
      draggedSourceGroupIndex = parseInt(item.dataset.groupIndex);
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.4';
    });

    groupsGrid.addEventListener('dragend', (e) => {
      const item = e.target.closest('.member-item');
      if (item) item.style.opacity = '1';
    });

    // Drag Over
    groupsGrid.addEventListener('dragover', (e) => {
      if (!isEditing) return;
      e.preventDefault();
      const groupCard = e.target.closest('.group-card');
      if (groupCard) {
        groupCard.style.borderColor = 'var(--primary-color)';
        groupCard.style.background = 'var(--gray-100)';
      }
    });

    groupsGrid.addEventListener('dragleave', (e) => {
      const groupCard = e.target.closest('.group-card');
      if (groupCard) {
        groupCard.style.borderColor = '';
        groupCard.style.background = '';
      }
    });

    // Drop
    groupsGrid.addEventListener('drop', (e) => {
      if (!isEditing) return;
      e.preventDefault();
      
      const groupCard = e.target.closest('.group-card');
      if (!groupCard) return;
      groupCard.style.borderColor = '';
      groupCard.style.background = '';

      const targetGroupIndex = parseInt(groupCard.dataset.groupIndex);
      if (draggedSourceGroupIndex === null || draggedSourceGroupIndex === targetGroupIndex) return;

      // Mitglied im Array von Quelle nach Ziel verschieben
      const sourceGroup = lastGroups[draggedSourceGroupIndex];
      const targetGroup = lastGroups[targetGroupIndex];

      const memberIndex = sourceGroup.members.findIndex(m => makeKey(m.vorname, m.nachname) === draggedMemberKey);
      if (memberIndex === -1) return;

      const [member] = sourceGroup.members.splice(memberIndex, 1);
      targetGroup.members.push(member);

      // Größen anpassen
      sourceGroup.size = sourceGroup.members.length;
      targetGroup.size = targetGroup.members.length;

      // Gruppen neu rendern & Graph-Knoten neu färben
      renderGroups(lastGroups);
      autoLoadGraph();
      saveAdminState();
    });
  }

  // ============================================
  // KLICK-HIGHLIGHTING FÜR WUNSCHPARTNER
  // ============================================
  if (groupsGrid) {
    groupsGrid.addEventListener('click', (e) => {
      const badge = e.target.closest('.wish-badge');
      
      // Vorherige Highlights immer entfernen
      document.querySelectorAll('.member-item.highlight-orange').forEach(item => {
        item.classList.remove('highlight-orange');
      });

      if (badge) {
        e.stopPropagation(); // Klick-Event stoppen, damit document-Klick es nicht sofort wieder löscht
        const targetKey = badge.dataset.targetKey;
        const targetItem = groupsGrid.querySelector(`.member-item[data-member-key="${targetKey}"]`);
        
        if (targetItem) {
          targetItem.classList.add('highlight-orange');
          // Sanft in Sichtweite scrollen, falls verdeckt
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });

    // Highlights entfernen, wenn man irgendwo anders hinklickt
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.wish-badge')) {
        document.querySelectorAll('.member-item.highlight-orange').forEach(item => {
          item.classList.remove('highlight-orange');
        });
      }
    });

    // Zeltnamen-Änderungen erfassen und in Firestore speichern
    groupsGrid.addEventListener('change', (e) => {
      if (e.target.classList.contains('group-name-input')) {
        const idx = parseInt(e.target.dataset.groupIndex);
        if (!isNaN(idx) && lastGroups[idx]) {
          lastGroups[idx].name = e.target.value;
          saveAdminState(); // Cloud-Synchronisierung!
        }
      }
    });
  }

  // ============================================
  // HILFSFUNKTIONEN
  // ============================================
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function makeKey(vorname, nachname) {
    const v = (vorname || '').toLowerCase().trim().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss');
    const n = (nachname || '').toLowerCase().trim().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss');
    return `${v}_${n}`.replace(/[^a-z0-9]/g, '_');
  }

})();
