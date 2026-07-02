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
 * @param {Object} overrides - Manuelle Verbindungs-Overrides { broken: [], added: [] }
 * @param {string} mode - Berechnungsmodus ('size' oder 'count')
 * @param {number} numTents - Feste Anzahl an Zelten (für Modus 'count')
 * @param {number} maxVar - Maximale Größenvariation (für Modus 'count')
 * @returns {Array} - Array von Zeltgruppen [{name, members: [{vorname, nachname}]}]
 */
window.calculateGroups = function (entries, zeltGroesse, overrides = { broken: [], added: [] }, mode = 'size', numTents = 10, maxVar = 1) {
  if (!entries || entries.length === 0) return [];

  const formatPartner = (v, n) => {
    if (!v && !n) return null;
    return `${v || ''} ${n || ''}`.trim();
  };

  // --- 1. Alle Kinder als Set sammeln ---
  const allChildren = new Map(); // key → {vorname, nachname, wishes}

  entries.forEach(e => {
    const key = makeKey(e.vorname, e.nachname);
    if (!allChildren.has(key)) {
      const wishes = [
        formatPartner(e.wunsch1_vorname, e.wunsch1_nachname),
        formatPartner(e.wunsch2_vorname, e.wunsch2_nachname),
        formatPartner(e.wunsch3_vorname, e.wunsch3_nachname),
      ].filter(Boolean);
      allChildren.set(key, { vorname: e.vorname, nachname: e.nachname, key, wishes });
    }
    // Wunschpartner auch aufnehmen (falls die keinen eigenen Eintrag haben)
    for (let i = 1; i <= 3; i++) {
      const wv = e[`wunsch${i}_vorname`];
      const wn = e[`wunsch${i}_nachname`];
      if (wv && wn) {
        const wKey = makeKey(wv, wn);
        if (!allChildren.has(wKey)) {
          allChildren.set(wKey, { vorname: wv, nachname: wn, key: wKey, wishes: [] });
        }
      }
    }
  });

  const childKeys = Array.from(allChildren.keys());
  const n = childKeys.length;
  if (n === 0) return [];

  // Zeltkapazität dynamisch je nach Modus berechnen
  const size = mode === 'size'
    ? Math.max(2, parseInt(zeltGroesse) || 5)
    : Math.ceil(n / (parseInt(numTents) || 10)) + Math.floor((parseInt(maxVar) || 1) / 2);

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
        const edgeKey = [fromKey, toKey].sort().join('||');
        
        // Gelöste Verbindungen im Algorithmus überspringen (nicht gruppieren)
        if ((overrides.broken || []).includes(edgeKey)) {
          continue;
        }

        union(fromKey, toKey);

        // Kantengewicht erhöhen
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) || 0) + 1);
      }
    }
  });

  // Manuelle (grüne) Verbindungen im Algorithmus erzwingen
  (overrides.added || []).forEach(edgeKey => {
    const [fromKey, toKey] = edgeKey.split('||');
    if (parent[fromKey] && parent[toKey]) {
      union(fromKey, toKey);
      // Sehr hohes Kantengewicht geben, damit sie beim Aufteilen zusammenbleiben
      edgeWeights.set(edgeKey, 10);
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

  // --- 6. Kleine Gruppen zusammenführen / Zeltanzahl ausbalancieren ---
  let finalGroups = [];

  if (mode === 'size') {
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
      while (smallGroups.length > 0) {
        const child = smallGroups.shift();
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
  } else {
    // Feste Zeltanzahl-Modus (count)
    const K = parseInt(numTents) || 10;
    const v = parseInt(maxVar) || 1;
    const avg = n / K;
    const sMin = Math.max(2, Math.floor(avg) - Math.ceil(v / 2));
    const sMax = Math.ceil(avg) + Math.floor(v / 2);

    // 1. Wenn mehr Gruppen als Zelte: kleinste zusammenführen
    while (groups.length > K) {
      groups.sort((a, b) => a.length - b.length);
      const smallest = groups.shift();
      groups[0].push(...smallest);
    }

    // 2. Wenn weniger Gruppen als Zelte: größte aufteilen
    while (groups.length < K) {
      groups.sort((a, b) => b.length - a.length);
      const largest = groups.shift();
      const half = Math.ceil(largest.length / 2);
      const g1 = largest.slice(0, half);
      const g2 = largest.slice(half);
      groups.push(g1, g2);
    }

    // 3. Ausbalancieren der Zeltgrößen gemäß sMin und sMax
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 150) {
      changed = false;
      iterations++;

      groups.sort((a, b) => b.length - a.length);
      const largest = groups[0];

      groups.sort((a, b) => a.length - b.length);
      const smallest = groups[0];

      if (largest.length > sMax || smallest.length < sMin) {
        if (largest.length <= sMin) break; // Kann nicht mehr weggenommen werden

        // Schwächstes Mitglied (geringste Verbindungsstärke zur Gruppe) verschieben
        let bestIndex = 0;
        let minStrength = Infinity;
        for (let i = 0; i < largest.length; i++) {
          let strength = 0;
          const child = largest[i];
          largest.forEach(other => {
            if (child.key !== other.key) {
              const edgeKey = [child.key, other.key].sort().join('||');
              strength += edgeWeights.get(edgeKey) || 0;
            }
          });
          if (strength < minStrength) {
            minStrength = strength;
            bestIndex = i;
          }
        }

        const childToMove = largest.splice(bestIndex, 1)[0];
        smallest.push(childToMove);
        changed = true;
      }
    }
    finalGroups = groups;
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
