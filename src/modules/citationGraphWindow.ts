interface CollectionGraphNode {
  id: string;
  itemID: number;
  workID: string;
  label: string;
  citationCount: number | null;
  referencesCount: number | null;
  year: number | null;
  publisher: string | null;
  firstAuthor: string | null;
  lastAuthor: string | null;
  publicationDate: string | null;
  collectionPaths: string[];
}

interface CollectionGraphEdge {
  source: string;
  target: string;
}

interface CollectionGraphData {
  collectionName: string;
  nodes: CollectionGraphNode[];
  edges: CollectionGraphEdge[];
  skippedMissingWorkID: number;
  fetchFailures: number;
}

export function renderCollectionCitationGraphWindow(
  popup: Window,
  graphData: CollectionGraphData,
) {
  const payload = JSON.stringify(graphData).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OpenAlex Citation Graph</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fa;
      --panel: #ffffff;
      --text: #122333;
      --muted: #4f6475;
      --edge: #94a3b8;
      --node: #2563eb;
      --node-stroke: #1e3a8a;
    }

    body {
      margin: 0;
      font-family: "Segoe UI", "Noto Sans", sans-serif;
      background: radial-gradient(circle at top right, #dbeafe, var(--bg));
      color: var(--text);
      height: 100vh;
      display: grid;
      grid-template-rows: auto auto 1fr;
    }

    .bar,
    .summary {
      background: var(--panel);
      border-bottom: 1px solid #dbe3ee;
      padding: 10px 14px;
    }

    .bar {
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .summary {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .graph-shell {
      position: relative;
      margin: 8px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #d4deea;
      background: #ffffff;
    }

    svg {
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #ffffff, #f7fbff);
      cursor: grab;
      user-select: none;
    }

    svg:active {
      cursor: grabbing;
    }

    .edge {
      stroke: var(--edge);
      stroke-width: 1.4;
      stroke-opacity: 0.7;
      marker-end: url(#arrowhead);
    }

    .node {
      fill: var(--node);
      stroke: var(--node-stroke);
      stroke-width: 1.2;
    }

    .node-label {
      font-size: 10px;
      fill: #163048;
      pointer-events: none;
    }

    .hint {
      position: absolute;
      right: 10px;
      bottom: 10px;
      background: rgba(255, 255, 255, 0.93);
      border: 1px solid #d4deea;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      color: var(--muted);
    }

    .hover-card {
      position: absolute;
      left: 10px;
      top: 10px;
      min-width: 220px;
      max-width: 320px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d4deea;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.35;
      color: #304458;
      box-shadow: 0 4px 14px rgba(28, 55, 87, 0.12);
      pointer-events: none;
      display: none;
      z-index: 5;
    }

    .hover-card-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: #1f3347;
    }

    .hover-card-row {
      display: block;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="bar">
    <div>OpenAlex Citation Graph</div>
    <div id="collection-name"></div>
  </div>
  <div class="summary" id="summary"></div>
  <div class="graph-shell">
    <svg id="graph" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid meet">
      <g id="viewport">
        <g id="edges"></g>
        <g id="nodes"></g>
      </g>
    </svg>
    <div class="hover-card" id="node-hover-card"></div>
    <div class="hint">Wheel: zoom. Drag empty area: pan.</div>
  </div>

  <script>
    const data = ${payload};
    const width = 1400;
    const height = 900;
    const nodeRadius = 6;

    const collectionEl = document.getElementById("collection-name");
    const summaryEl = document.getElementById("summary");
    collectionEl.textContent = data.collectionName || "Collection";
    summaryEl.innerHTML = [
      "Nodes: <strong>" + data.nodes.length + "</strong>",
      "Edges: <strong>" + data.edges.length + "</strong>",
      "Skipped (missing work_id): <strong>" + data.skippedMissingWorkID + "</strong>",
      "Fetch failures: <strong>" + data.fetchFailures + "</strong>"
    ].join("<span>•</span>");

    const svg = document.getElementById("graph");
    const viewport = document.getElementById("viewport");
    const edgesLayer = document.getElementById("edges");
    const nodesLayer = document.getElementById("nodes");
    const graphShell = document.querySelector(".graph-shell");
    const hoverCard = document.getElementById("node-hover-card");

    const nodeByID = new Map();
    const nodePositions = [];
    const edgePairs = [];

    data.nodes.forEach((node, index) => {
      const angle = (index / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const radius = Math.max(120, Math.min(width, height) * 0.5 - 140);
      const jitter = ((index % 7) - 3) * 6;
      const x = width / 2 + Math.cos(angle) * (radius + jitter);
      const y = height / 2 + Math.sin(angle) * (radius + jitter);
      const entry = { ...node, x, y, vx: 0, vy: 0, ax: x, ay: y };
      nodeByID.set(node.id, entry);
      nodePositions.push(entry);
    });

    data.edges.forEach((edge) => {
      const source = nodeByID.get(edge.source);
      const target = nodeByID.get(edge.target);
      if (!source || !target) return;
      edgePairs.push({ source, target });
    });

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function runLayout() {
      if (nodePositions.length > 420) {
        return;
      }

      for (let tick = 0; tick < 240; tick++) {
        for (let i = 0; i < nodePositions.length; i++) {
          const a = nodePositions[i];
          for (let j = i + 1; j < nodePositions.length; j++) {
            const b = nodePositions[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distanceSq = dx * dx + dy * dy + 0.01;
            const force = 1100 / distanceSq;
            const fx = dx * force;
            const fy = dy * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }

        for (const node of nodePositions) {
          // Keep nodes near their initial ring so the overall circular canvas stays visible.
          node.vx += (node.ax - node.x) * 0.012;
          node.vy += (node.ay - node.y) * 0.012;
          node.vx += (width / 2 - node.x) * 0.0014;
          node.vy += (height / 2 - node.y) * 0.0014;
        }

        for (const edge of edgePairs) {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const desired = 120;
          const spring = (distance - desired) * 0.014;
          const fx = (dx / distance) * spring;
          const fy = (dy / distance) * spring;
          edge.source.vx += fx;
          edge.source.vy += fy;
          edge.target.vx -= fx;
          edge.target.vy -= fy;
        }

        for (const node of nodePositions) {
          node.vx *= 0.83;
          node.vy *= 0.83;
          node.x = clamp(node.x + node.vx, 70, width - 70);
          node.y = clamp(node.y + node.vy, 70, height - 70);
        }
      }
    }

    function ensureArrowMarker() {
      const ns = "http://www.w3.org/2000/svg";
      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(ns, "defs");
        svg.insertBefore(defs, svg.firstChild);
      }

      const existing = defs.querySelector("#arrowhead");
      if (existing) {
        return;
      }

      const marker = document.createElementNS(ns, "marker");
      marker.setAttribute("id", "arrowhead");
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "8");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "6");
      marker.setAttribute("markerHeight", "6");
      marker.setAttribute("orient", "auto-start-reverse");

      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      path.setAttribute("fill", "#7f91a6");

      marker.appendChild(path);
      defs.appendChild(marker);
    }

    function svgLine(sourceNode, targetNode) {
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / distance;
      const uy = dy / distance;

      // Start/end the segment at node borders so the arrow tip stays visible.
      const sourcePadding = nodeRadius + 1;
      const targetPadding = nodeRadius + 5;

      const x1 = sourceNode.x + ux * sourcePadding;
      const y1 = sourceNode.y + uy * sourcePadding;
      const x2 = targetNode.x - ux * targetPadding;
      const y2 = targetNode.y - uy * targetPadding;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("class", "edge");
      return line;
    }

    function svgCircle(cx, cy, r) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(cx));
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r", String(r));
      circle.setAttribute("class", "node");
      return circle;
    }

    function svgText(x, y, text) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(x));
      t.setAttribute("y", String(y));
      t.setAttribute("class", "node-label");

      const lines = splitLabelLines(text, 24, 3);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", String(x));
        tspan.setAttribute("dy", i === 0 ? "0" : "11");
        tspan.textContent = line;
        t.appendChild(tspan);
      }

      return t;
    }

    function splitLabelLines(text, maxChars, maxLines) {
      const safe = String(text || "").trim();
      if (!safe) return [""];

      const words = safe.split(/\\s+/).filter(Boolean);
      const lines = [];
      let current = "";

      let wordIndex = 0;
      while (wordIndex < words.length) {
        const word = words[wordIndex];
        const candidate = current ? current + " " + word : word;

        if (!current || candidate.length <= maxChars) {
          current = candidate;
          wordIndex++;
          continue;
        }

        lines.push(current);
        current = "";
        if (lines.length >= maxLines) {
          break;
        }
      }

      if (lines.length < maxLines && current) {
        lines.push(current);
      }

      if (lines.length > maxLines) {
        lines.length = maxLines;
      }

      const truncated = wordIndex < words.length;
      if (truncated && lines.length) {
        lines[lines.length - 1] = lines[lines.length - 1].trimEnd() + "...";
      }

      return lines;
    }

    function formatNodeDisplayLabel(node) {
      const rawLabel = String(node.label || "")
        .replaceAll("-", " ")
        .replaceAll("‐", " ")
        .replaceAll("‑", " ")
        .replaceAll("‒", " ")
        .replaceAll("–", " ")
        .replaceAll("—", " ")
        .replaceAll("―", " ")
        .replaceAll("−", " ")
        .replace(/ +/g, " ")
        .trim();
      if (typeof node.year === "number") {
        return "[" + node.year + "] " + rawLabel;
      }
      return rawLabel;
    }

    function showHoverCard(node, event) {
      if (!hoverCard || !graphShell) {
        return;
      }

      const publisher = String(node.publisher || "").trim() || "n/a";
      const firstAuthor = String(node.firstAuthor || "").trim() || "n/a";
      const lastAuthor = String(node.lastAuthor || "").trim() || "n/a";
      const publicationDate = String(node.publicationDate || "").trim() || "n/a";
      const citations =
        typeof node.citationCount === "number" ? String(node.citationCount) : "n/a";
      const references =
        typeof node.referencesCount === "number" ? String(node.referencesCount) : "n/a";
      const collectionPathText =
        Array.isArray(node.collectionPaths) && node.collectionPaths.length
          ? node.collectionPaths.join(" | ")
          : "n/a";

      hoverCard.innerHTML =
        '<div class="hover-card-title">' + escapeHTML(node.label) + '</div>' +
        '<span class="hover-card-row"><strong>Publisher:</strong> ' + escapeHTML(publisher) + '</span>' +
        '<span class="hover-card-row"><strong>First author:</strong> ' + escapeHTML(firstAuthor) + '</span>' +
        '<span class="hover-card-row"><strong>Last author:</strong> ' + escapeHTML(lastAuthor) + '</span>' +
        '<span class="hover-card-row"><strong>Publication date:</strong> ' + escapeHTML(publicationDate) + '</span>' +
        '<span class="hover-card-row"><strong>Citations:</strong> ' + escapeHTML(citations) + '</span>' +
        '<span class="hover-card-row"><strong>References:</strong> ' + escapeHTML(references) + '</span>' +
        '<span class="hover-card-row"><strong>Collection:</strong> ' + escapeHTML(collectionPathText) + '</span>';

      hoverCard.style.display = "block";
      moveHoverCard(event);
    }

    function moveHoverCard(event) {
      if (!hoverCard || !graphShell || hoverCard.style.display !== "block") {
        return;
      }

      const shellRect = graphShell.getBoundingClientRect();
      const cardRect = hoverCard.getBoundingClientRect();

      const preferredX = event.clientX - shellRect.left + 14;
      const preferredY = event.clientY - shellRect.top + 14;

      const maxX = Math.max(8, shellRect.width - cardRect.width - 8);
      const maxY = Math.max(8, shellRect.height - cardRect.height - 8);

      hoverCard.style.left = Math.max(8, Math.min(maxX, preferredX)) + "px";
      hoverCard.style.top = Math.max(8, Math.min(maxY, preferredY)) + "px";
    }

    function hideHoverCard() {
      if (!hoverCard) {
        return;
      }
      hoverCard.style.display = "none";
    }

    function escapeHTML(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function render() {
      edgesLayer.innerHTML = "";
      nodesLayer.innerHTML = "";

      for (const edge of edgePairs) {
        edgesLayer.appendChild(svgLine(edge.source, edge.target));
      }

      for (const node of nodePositions) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const circle = svgCircle(node.x, node.y, nodeRadius);
        const displayLabel = formatNodeDisplayLabel(node);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = displayLabel + "\\n" + node.workID;
        circle.appendChild(title);

        g.addEventListener("mouseenter", (event) => showHoverCard(node, event));
        g.addEventListener("mousemove", moveHoverCard);
        g.addEventListener("mouseleave", hideHoverCard);

        g.appendChild(circle);
        g.appendChild(svgText(node.x + 9, node.y - 9, displayLabel));
        nodesLayer.appendChild(g);
      }
    }

    let scale = 1;
    let panX = 0;
    let panY = 0;

    function applyTransform() {
      viewport.setAttribute("transform", "translate(" + panX + " " + panY + ") scale(" + scale + ")");
    }

    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const svgRect = svg.getBoundingClientRect();
      const pointerX = event.clientX - svgRect.left;
      const pointerY = event.clientY - svgRect.top;
      const worldX = (pointerX - panX) / scale;
      const worldY = (pointerY - panY) / scale;

      const step = event.deltaY < 0 ? 1.08 : 0.92;
      const newScale = clamp(scale * step, 0.3, 3.2);
      if (newScale === scale) {
        return;
      }

      scale = newScale;
      panX = pointerX - worldX * scale;
      panY = pointerY - worldY * scale;
      applyTransform();
    }, { passive: false });

    let panning = false;
    let startX = 0;
    let startY = 0;

    svg.addEventListener("mousedown", (event) => {
      panning = true;
      startX = event.clientX - panX;
      startY = event.clientY - panY;
    });

    window.addEventListener("mousemove", (event) => {
      if (!panning) return;
      panX = event.clientX - startX;
      panY = event.clientY - startY;
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      panning = false;
    });

    runLayout();
    ensureArrowMarker();
    render();
    applyTransform();
  </script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
