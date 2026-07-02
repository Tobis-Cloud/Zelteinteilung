// ============================================
// graph.js
// D3.js Force-directed Graph für Wunschverbindungen
// ============================================

(function () {
  'use strict';

  // Farbpalette für Gruppen (wird von außen gesetzt)
  const GROUP_COLORS = [
    '#E8001E', '#2563EB', '#16a34a', '#d97706', '#7c3aed',
    '#0891b2', '#be185d', '#059669', '#dc2626', '#4338ca',
  ];

  /**
   * Rendert den Force-directed Graph im angegebenen Container.
   *
   * @param {string} containerId - ID des SVG-Container-Elements
   * @param {Array}  entries     - Firestore-Einträge
   * @param {Array}  groups      - Berechnete Zeltgruppen (optional, für Farben)
   * @param {boolean} clusterActive - Ob Gruppen zentriert gebündelt werden sollen
   * @param {string} density - Dichte des Graphen ('normal', 'tight', 'super')
   */
  window.renderGraph = function (containerId, entries, groups = [], clusterActive = false, density = 'normal') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Vorherigen Graph löschen
    container.innerHTML = '';

    if (!entries || entries.length === 0) {
      container.innerHTML = `
        <div class="graph-empty">
          <span class="icon">🌐</span>
          <p>Noch keine Einträge vorhanden.</p>
        </div>`;
      return;
    }

    // --- Nodes & Links aus Einträgen aufbauen ---
    const nodeMap  = new Map(); // key → node
    const links    = [];

    // Gruppen-Zuordnung für Farben
    const groupAssignment = new Map(); // key → groupIndex
    groups.forEach((g, gi) => {
      g.members.forEach(m => {
        const k = makeKey(m.vorname, m.nachname);
        groupAssignment.set(k, gi);
      });
    });

    function getOrCreateNode(vorname, nachname) {
      const key = makeKey(vorname, nachname);
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id:       key,
          label:    `${vorname} ${nachname}`,
          vorname,
          nachname,
          group:    groupAssignment.has(key) ? groupAssignment.get(key) : -1,
        });
      }
      return nodeMap.get(key);
    }

    // Links-Set für gegenseitige Wünsche
    const linkSet = new Map(); // "keyA||keyB" → {source, target, mutual, count}

    entries.forEach(e => {
      const fromNode = getOrCreateNode(e.vorname, e.nachname);
      for (let i = 1; i <= 3; i++) {
        const wv = e[`wunsch${i}_vorname`];
        const wn = e[`wunsch${i}_nachname`];
        if (wv && wn) {
          getOrCreateNode(wv, wn);
          const fromKey = fromNode.id;
          const toKey   = makeKey(wv, wn);
          const edgeKey = [fromKey, toKey].sort().join('||');

          if (!linkSet.has(edgeKey)) {
            linkSet.set(edgeKey, {
              source:  fromKey,
              target:  toKey,
              count:   0,
              mutual:  false,
              fromKey,
              toKey,
            });
          }
          linkSet.get(edgeKey).count++;
          if (linkSet.get(edgeKey).count >= 2) {
            linkSet.get(edgeKey).mutual = true;
          }
        }
      }
    });

    const nodes = Array.from(nodeMap.values());
    const linksArr = Array.from(linkSet.values());

    // --- SVG-Dimensionen ---
    const rect   = container.getBoundingClientRect();
    const width  = rect.width  || 800;
    const height = Math.max(500, rect.height || 500);

    const svg = d3.select(container)
      .append('svg')
      .attr('width',  width)
      .attr('height', height)
      .attr('id', 'graph-svg')
      .style('background', '#fafafa');

    // Zoom-Verhalten
    const g = svg.append('g');
    svg.call(d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Pfeilspitzen (Marker)
    const defs = svg.append('defs');

    function addMarker(id, color) {
      defs.append('marker')
        .attr('id',           id)
        .attr('viewBox',      '0 -5 10 10')
        .attr('refX',         22)
        .attr('refY',         0)
        .attr('markerWidth',  6)
        .attr('markerHeight', 6)
        .attr('orient',       'auto')
        .append('path')
        .attr('fill', color)
        .attr('d',    'M0,-5L10,0L0,5');
    }

    addMarker('arrow-normal', '#aaaaaa');
    addMarker('arrow-mutual', '#E8001E');

    // Dichte-Einstellungen für Federkräfte berechnen
    let linkDistance = 120;
    let chargeStrength = -280;

    if (density === 'tight') {
      linkDistance = 65;
      chargeStrength = -150;
    } else if (density === 'super') {
      linkDistance = 35;
      chargeStrength = -80;
    }

    // --- Force Simulation ---
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(linksArr)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.6)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Falls Gruppen-Bündelung aktiv ist, berechne Anziehungskräfte zu den Gruppenzentren
    if (clusterActive && groups && groups.length > 0) {
      const numGroups = groups.length;
      const radius = Math.min(width, height) * 0.3;
      const groupCenters = groups.map((g, i) => {
        const angle = (i / numGroups) * 2 * Math.PI;
        return {
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle)
        };
      });

      simulation
        .force('x', d3.forceX(d => {
          if (d.group >= 0 && groupCenters[d.group]) {
            return groupCenters[d.group].x;
          }
          return width / 2;
        }).strength(0.85))
        .force('y', d3.forceY(d => {
          if (d.group >= 0 && groupCenters[d.group]) {
            return groupCenters[d.group].y;
          }
          return height / 2;
        }).strength(0.85));
    }

    // --- Links zeichnen ---
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksArr)
      .enter()
      .append('line')
      .attr('class',          d => `link ${d.mutual ? 'mutual' : ''}`)
      .attr('stroke',         d => d.mutual ? '#E8001E' : '#cccccc')
      .attr('stroke-width',   d => d.mutual ? 3 : 1.5)
      .attr('stroke-opacity', d => d.mutual ? 0.85 : 0.5)
      .attr('marker-end',     d => `url(#${d.mutual ? 'arrow-mutual' : 'arrow-normal'})`);

    // --- Nodes zeichnen ---
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag',  dragged)
        .on('end',   dragEnded)
      );

    // Kreis
    node.append('circle')
      .attr('r',           28)
      .attr('fill',        d => d.group >= 0 ? GROUP_COLORS[d.group % GROUP_COLORS.length] : '#e5e7eb')
      .attr('stroke',      d => d.group >= 0 ? darkenColor(GROUP_COLORS[d.group % GROUP_COLORS.length]) : '#9ca3af')
      .attr('stroke-width', 2.5)
      .append('title')
      .text(d => d.label);

    // Kürzel (Initialen im Kreis)
    node.append('text')
      .attr('dy',         '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill',        d => d.group >= 0 ? 'white' : '#374151')
      .attr('font-size',   '11px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter, sans-serif')
      .text(d => getInitials(d.vorname, d.nachname));

    // Name unter dem Kreis
    node.append('text')
      .attr('dy',          '46px')
      .attr('text-anchor', 'middle')
      .attr('fill',        '#374151')
      .attr('font-size',   '11px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, sans-serif')
      .text(d => d.label);

    // --- Simulation Tick ---
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // --- Drag Functions ---
    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // --- Legende ---
    const legendDiv = document.createElement('div');
    legendDiv.className = 'legend';
    legendDiv.innerHTML = `
      <div class="legend-item">
        <div class="legend-line" style="background:#cccccc; height:1.5px;"></div>
        <span>Einseitiger Wunsch</span>
      </div>
      <div class="legend-item">
        <div class="legend-line" style="background:#E8001E; height:3px;"></div>
        <span>Gegenseitiger Wunsch</span>
      </div>
      ${groups.length > 0 ? '<div class="legend-item" style="margin-top:8px;font-weight:600;font-size:0.7rem;color:#374151;">Farben = Zeltgruppen</div>' : ''}
    `;
    container.style.position = 'relative';
    container.appendChild(legendDiv);
  };

  // --- Hilfsfunktionen ---

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

  function getInitials(vorname, nachname) {
    const v = (vorname || '').charAt(0).toUpperCase();
    const n = (nachname || '').charAt(0).toUpperCase();
    return v + n;
  }

  function darkenColor(hex) {
    // Einfaches Abdunkeln
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 40);
    const g = Math.max(0, ((num >> 8) & 0xff) - 40);
    const b = Math.max(0, (num & 0xff) - 40);
    return `rgb(${r},${g},${b})`;
  }

})();
