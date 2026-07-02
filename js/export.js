// ============================================
// export.js
// Export-Funktionen: XLSX und PNG
// ============================================

(function () {
  'use strict';

  /**
   * Exportiert die Einträge als XLSX-Datei.
   * Verwendet SheetJS (xlsx) Library.
   *
   * @param {Array} entries - Firestore-Einträge
   */
  window.exportXLSX = function (entries) {
    if (!entries || entries.length === 0) {
      alert('Keine Daten zum Exportieren vorhanden.');
      return;
    }

    // Daten für die Tabelle aufbereiten
    const rows = entries.map((e, idx) => ({
      '#':                    idx + 1,
      'E-Mail Eltern':        e.email || '',
      'Vorname Kind':         e.vorname || '',
      'Nachname Kind':        e.nachname || '',
      'Wunschpartner 1 Vorname': e.wunsch1_vorname  || '(kein)',
      'Wunschpartner 1 Nachname': e.wunsch1_nachname || '',
      'Wunschpartner 2 Vorname': e.wunsch2_vorname  || '(kein)',
      'Wunschpartner 2 Nachname': e.wunsch2_nachname || '',
      'Wunschpartner 3 Vorname': e.wunsch3_vorname  || '(kein)',
      'Wunschpartner 3 Nachname': e.wunsch3_nachname || '',
      'Eingegangen am': e.timestamp
        ? (e.timestamp.toDate ? e.timestamp.toDate().toLocaleString('de-DE') : new Date(e.timestamp).toLocaleString('de-DE'))
        : '',
    }));

    // Arbeitsblatt erstellen
    const ws = XLSX.utils.json_to_sheet(rows);

    // Spaltenbreiten setzen
    ws['!cols'] = [
      { wch: 4 },   // #
      { wch: 28 },  // E-Mail
      { wch: 16 },  // Vorname Kind
      { wch: 16 },  // Nachname Kind
      { wch: 22 },  // WP1 Vorname
      { wch: 22 },  // WP1 Nachname
      { wch: 22 },  // WP2 Vorname
      { wch: 22 },  // WP2 Nachname
      { wch: 22 },  // WP3 Vorname
      { wch: 22 },  // WP3 Nachname
      { wch: 20 },  // Zeitstempel
    ];

    // Arbeitsmappe erstellen
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wunschpartner');

    // Zusammenfassungsblatt
    const summaryData = [
      ['JULA 2026 – Zelteinteilung Jungs'],
      ['Exportiert am:', new Date().toLocaleString('de-DE')],
      ['Anzahl Einträge:', entries.length],
      [],
      ['Erstellt durch CVJM Mössingen Lagerleitung'],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Info');

    // Datei herunterladen
    const filename = `JULA2026_Zelteinteilung_${formatDate(new Date())}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  /**
   * Exportiert die Zeltgruppen als XLSX-Datei.
   *
   * @param {Array} groups - Berechnete Zeltgruppen
   */
  window.exportGroupsXLSX = function (groups) {
    if (!groups || groups.length === 0) {
      alert('Keine Gruppen zum Exportieren vorhanden.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Übersichtsblatt
    const overviewRows = [['Zelt', 'Nr.', 'Vorname', 'Nachname', 'Anzahl im Zelt']];
    groups.forEach(g => {
      g.members.forEach((m, idx) => {
        overviewRows.push([
          g.name,
          idx + 1,
          m.vorname,
          m.nachname,
          idx === 0 ? g.size : '',
        ]);
      });
      overviewRows.push([]); // Leerzeile zwischen Gruppen
    });

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
    wsOverview['!cols'] = [{ wch: 12 }, { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Zeltgruppen');

    const filename = `JULA2026_Zeltgruppen_${formatDate(new Date())}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  /**
   * Exportiert den D3.js-Graphen als PNG-Datei.
   * Konvertiert SVG → Canvas → PNG.
   */
  window.exportGraphPNG = function () {
    const svgElement = document.getElementById('graph-svg');
    if (!svgElement) {
      alert('Kein Graph zum Exportieren vorhanden. Bitte zuerst den Graphen laden.');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url     = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const canvas  = document.createElement('canvas');
      const scale   = 2; // 2x für höhere Auflösung
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Als PNG herunterladen
      const pngUrl  = canvas.toDataURL('image/png');
      const link    = document.createElement('a');
      link.download = `JULA2026_Wunschgraph_${formatDate(new Date())}.png`;
      link.href     = pngUrl;
      link.click();
    };

    img.onerror = function () {
      alert('Fehler beim Exportieren des Graphen. Bitte versuche es erneut.');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // --- Hilfsfunktionen ---
  function formatDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${y}${m}${d}`;
  }

})();
