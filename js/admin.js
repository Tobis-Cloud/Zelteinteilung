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

  // Tabelle
  const tableBody    = document.getElementById('entries-tbody');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');

  // Graph
  const loadGraphBtn  = document.getElementById('load-graph-btn');
  const exportPngBtn  = document.getElementById('export-png-btn');
  const graphContainer = document.getElementById('graph-container');

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

  // Redeclare group DOM selectors that were replaced in variables block
  const zeltGroesseInput = document.getElementById('zelt-groesse');
  const calcGroupsBtn = document.getElementById('calc-groups-btn');
  const groupsGrid = document.getElementById('groups-grid');
  const exportGroupsBtn = document.getElementById('export-groups-btn');

  // ============================================
  // GRAPH LOGIK & MANUELLE OVERRIDES
  // ============================================
  let clusterActive = false;
  let currentDensity = 'normal';

  const toggleClusterBtn = document.getElementById('toggle-cluster-btn');
  const densityNormalBtn = document.getElementById('density-normal-btn');
  const densityTightBtn  = document.getElementById('density-tight-btn');
  const densitySuperBtn  = document.getElementById('density-super-btn');

  // Overrides speichern
  function saveOverrides() {
    try {
      localStorage.setItem('jula2026_overrides', JSON.stringify(manualOverrides));
    } catch (e) {
      console.error('Fehler beim Speichern der Overrides:', e);
    }
  }

  // Gruppen stillschweigend neu berechnen, damit manuelle Klick-Änderungen sofort sichtbar sind
  function recalculateGroupsSilently() {
    if (allEntries.length === 0) return;
    const size = parseInt(zeltGroesseInput?.value) || 5;
    lastGroups = calculateGroups(allEntries, size, manualOverrides);
    renderGroups(lastGroups);
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
    saveOverrides();
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

    saveOverrides();
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

  // i-Info-Tooltip ein- und ausblenden
  infoTooltipBtn && infoTooltipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    infoTooltipContent.classList.toggle('hidden');
  });

  // Schließe den Tooltip bei Klick außerhalb
  document.addEventListener('click', (e) => {
    if (infoTooltipContent && !infoTooltipContent.classList.contains('hidden')) {
      if (!infoTooltipContent.contains(e.target) && e.target !== infoTooltipBtn) {
        infoTooltipContent.classList.add('hidden');
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
  // GRUPPEN BERECHNEN
  // ============================================
  calcGroupsBtn && calcGroupsBtn.addEventListener('click', () => {
    const size = parseInt(zeltGroesseInput?.value) || 5;

    if (allEntries.length === 0) {
      alert('Keine Daten für die Gruppenberechnung vorhanden.');
      return;
    }

    lastGroups = calculateGroups(allEntries, size, manualOverrides);
    renderGroups(lastGroups);

    // Bündeln-Button im Graph aktivieren und anzeigen
    if (toggleClusterBtn) {
      toggleClusterBtn.style.display = 'inline-flex';
    }

    // Graph automatisch aktualisieren, falls das SVG-Element existiert
    if (document.getElementById('graph-svg')) {
      autoLoadGraph();
    }

    // Export-Button aktivieren
    if (exportGroupsBtn) exportGroupsBtn.disabled = false;
  });

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
        const wishesText = m.wishes && m.wishes.length > 0
          ? m.wishes.map(w => `<span class="badge badge--red" style="margin:1px;font-size:0.65rem;padding:1px 6px;">${esc(w)}</span>`).join(' ')
          : `<span class="badge badge--gray" style="font-size:0.65rem;padding:1px 6px;">keine Wünsche</span>`;

        return `
          <li class="member-item">
            <div class="member-name-row">
              <span class="member-name">${esc(m.vorname)} ${esc(m.nachname)}</span>
              <span class="info-toggle-btn" title="Wünsche anzeigen/ausblenden">👁️</span>
            </div>
            <div class="member-wishes-detail hidden">
              <div class="wishes-title">Wunschpartner:</div>
              <div class="wishes-list">${wishesText}</div>
            </div>
          </li>
        `;
      }).join('');

      return `
        <div class="group-card">
          <div class="group-card__title">
            <div class="group-card__dot" style="background:${color};"></div>
            ${esc(g.name)}
            <span class="badge badge--gray" style="margin-left:auto;">${g.size} Kinder</span>
          </div>
          <ul class="group-card__members">
            ${membersHtml}
          </ul>
        </div>
      `;
    }).join('');
  }

  // Klick-Event Handler für Zeltgruppen-Mitglieder (Detail-Wünsche ein-/ausblenden)
  groupsGrid && groupsGrid.addEventListener('click', (e) => {
    const memberItem = e.target.closest('.member-item');
    if (!memberItem) return;

    const detail = memberItem.querySelector('.member-wishes-detail');
    if (detail) {
      detail.classList.toggle('hidden');
    }
  });

  // ============================================
  // HILFSFUNKTIONEN
  // ============================================
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
