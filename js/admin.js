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

  // Gruppen
  const zeltGroesseInput   = document.getElementById('zelt-groesse');
  const calcGroupsBtn       = document.getElementById('calc-groups-btn');
  const groupsGrid          = document.getElementById('groups-grid');
  const exportGroupsBtn     = document.getElementById('export-groups-btn');

  // --- State ---
  let allEntries  = [];
  let lastGroups  = [];

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

  // ============================================
  // GRAPH
  // ============================================
  loadGraphBtn && loadGraphBtn.addEventListener('click', () => {
    if (allEntries.length === 0) {
      alert('Keine Daten zum Anzeigen vorhanden.');
      return;
    }
    renderGraph('graph-container', allEntries, lastGroups);
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

    lastGroups = calculateGroups(allEntries, size);
    renderGroups(lastGroups);

    // Graph auch aktualisieren wenn sichtbar
    if (document.getElementById('graph-svg')) {
      renderGraph('graph-container', allEntries, lastGroups);
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
