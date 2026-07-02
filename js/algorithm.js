// ============================================
// algorithm.js
// Greedy-Algorithmus zur Zeltgruppen-Bildung
// ============================================

/**
 * Berechnet optimale Zeltgruppen basierend auf Wunschverbindungen.
 *
 * Algorithmus:
 * 1. Erstelle ungerichteten Graphen aus allen Wunschverbindungen
 * 2. Finde zusammenhängende Komponenten (Union-Find)
 * 3. Teile Komponenten entsprechend der Zeltgröße auf
 * 4. Fülle kleine Gruppen mit Einzelkindern auf
 *
 * @param {Array} entries - Alle Firestore-Einträge
 * @param {number} zeltGroesse - Maximale Anzahl Kinder pro Zelt
 * @returns {Array} - Array von Zeltgruppen [{name, members: [{vorname, nachname}]}]
 */
window.calculateGroups = function (entries, zeltGroesse) {
  if (!entries || entries.length === 0) return [];

  const size = Math.max(2, parseInt(zeltGroesse) || 5);

  // --- 1. Alle Kinder als Set sammeln ---
  const allChildren = new Map(); // key → {vorname, nachname}

  entries.forEach(e => {
    const key = makeKey(e.vorname, e.nachname);
    if (!allChildren.has(key)) {
      allChildren.set(key, { vorname: e.vorname, nachname: e.nachname, key });
    }
    // Wunschpartner auch aufnehmen (falls die keinen eigenen Eintrag haben)
    for (let i = 1; i <= 3; i++) {
      const wv = e[`wunsch${i}_vorname`];
      const wn = e[`wunsch${i}_nachname`];
      if (wv && wn) {
        const wKey = makeKey(wv, wn);
        if (!allChildren.has(wKey)) {
          allChildren.set(wKey, { vorname: wv, nachname: wn, key: wKey });
        }
      }
    }
  });

  const childKeys = Array.from(allChildren.keys());
  const n = childKeys.length;
  if (n === 0) return [];

  // --- 2. Union-Find Datenstruktur ---
  const parent = {};
  const rank   = {};
  childKeys.forEach(k => { parent[k] = k; rank[k] = 0; });

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]); // Pfadkomprimierung
    return parent[x];
  }

  function union(x, y) {
    const rx = find(x), ry = find(y);
    if (rx === ry) return;
    if (rank[rx] < rank[ry]) { parent[rx] = ry; }
    else if (rank[rx] > rank[ry]) { parent[ry] = rx; }
    else { parent[ry] = rx; rank[rx]++; }
  }

  // --- 3. Verbindungen aus Wünschen erstellen ---
  // Gewichtete Kanten: gegenseitige Wünsche = stärkere Verbindung
  const edgeWeights = new Map(); // "keyA||keyB" → Gewicht

  entries.forEach(e => {
    const fromKey = makeKey(e.vorname, e.nachname);
    for (let i = 1; i <= 3; i++) {
      const wv = e[`wunsch${i}_vorname`];
      const wn = e[`wunsch${i}_nachname`];
      if (wv && wn) {
        const toKey = makeKey(wv, wn);
        union(fromKey, toKey);

        // Kantengewicht erhöhen
        const edgeKey = [fromKey, toKey].sort().join('||');
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) || 0) + 1);
      }
    }
  });

  // --- 4. Zusammenhängende Komponenten sammeln ---
  const components = new Map(); // root → [keys]
  childKeys.forEach(k => {
    const root = find(k);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(k);
  });

  const componentList = Array.from(components.values());

  // Sortiere Komponenten: größere Komponenten zuerst
  componentList.sort((a, b) => b.length - a.length);

  // --- 5. Gruppen bilden ---
  const groups = [];

  componentList.forEach(component => {
    if (component.length <= size) {
      // Komponente passt in ein Zelt
      groups.push(component.map(k => allChildren.get(k)));
    } else {
      // Komponente zu groß → aufteilen
      // Priorität: Kinder mit starken gegenseitigen Wünschen zusammenhalten
      const sorted = sortByConnectionStrength(component, edgeWeights);
      for (let i = 0; i < sorted.length; i += size) {
        const chunk = sorted.slice(i, i + size).map(k => allChildren.get(k));
        groups.push(chunk);
      }
    }
  });

  // --- 6. Kleine Gruppen zusammenführen ---
  const finalGroups = [];
  const smallGroups = [];

  groups.forEach(g => {
    if (g.length < Math.ceil(size / 2)) {
      smallGroups.push(...g);
    } else {
      finalGroups.push(g);
    }
  });

  // Kleine Gruppen/Einzelkinder auffüllen
  if (smallGroups.length > 0) {
    // Verteile auf bestehende Gruppen, die noch Platz haben
    let idx = 0;
    while (smallGroups.length > 0) {
      const child = smallGroups.shift();
      // Finde Gruppe mit Platz
      let placed = false;
      for (let i = 0; i < finalGroups.length; i++) {
        if (finalGroups[i].length < size) {
          finalGroups[i].push(child);
          placed = true;
          break;
        }
      }
      if (!placed) {
        finalGroups.push([child]);
      }
    }
  }

  // --- 7. Gruppen benennen und zurückgeben ---
  return finalGroups.map((members, i) => ({
    name:    `Zelt ${i + 1}`,
    number:  i + 1,
    members: members,
    size:    members.length,
  }));
};

/**
 * Sortiert Keys einer Komponente nach Verbindungsstärke (Greedy).
 */
function sortByConnectionStrength(keys, edgeWeights) {
  if (keys.length <= 1) return keys;

  const result  = [keys[0]];
  const remaining = new Set(keys.slice(1));

  while (remaining.size > 0) {
    const last = result[result.length - 1];
    let bestKey    = null;
    let bestWeight = -1;

    remaining.forEach(k => {
      const edgeKey = [last, k].sort().join('||');
      const weight  = edgeWeights.get(edgeKey) || 0;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestKey    = k;
      }
    });

    if (!bestKey) bestKey = Array.from(remaining)[0];
    result.push(bestKey);
    remaining.delete(bestKey);
  }

  return result;
}

/**
 * Normalisiert Vor- und Nachname zu einem eindeutigen Key.
 */
function makeKey(vorname, nachname) {
  const normalize = s =>
    (s || '')
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '_');
  return `${normalize(vorname)}_${normalize(nachname)}`;
}
