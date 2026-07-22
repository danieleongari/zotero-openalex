interface CollectionGraphAuthor {
  id: string;
  name: string;
}

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
  authors: CollectionGraphAuthor[];
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

export interface CitationsPerYearNodeInput {
  id: string;
  year: number | null;
  citationCount: number | null;
}

export interface CitationsPerYearEdgeInput {
  source: string;
  target: string;
}

export interface CitationsPerYearPoint extends CitationsPerYearNodeInput {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

export interface CitationsPerYearLayout {
  points: CitationsPerYearPoint[];
  minYear: number | null;
  maxYear: number | null;
  maxCitationCount: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
}

export interface AuthorGraphItemInput {
  itemID: number;
  workID: string;
  label: string;
  year: number | null;
  authors: CollectionGraphAuthor[];
}

export interface AuthorGraphPublication {
  itemID: number;
  workID: string;
  title: string;
  year: number | null;
}

export interface AuthorGraphNode {
  id: string;
  name: string;
  itemCount: number;
  radius: number;
  publications: AuthorGraphPublication[];
}

export interface AuthorGraphEdge {
  source: string;
  target: string;
  sharedItemCount: number;
  width: number;
}

export interface AuthorGraphData {
  nodes: AuthorGraphNode[];
  edges: AuthorGraphEdge[];
  publicationCount: number;
}

export function getAuthorMarkerRadius(itemCount: number) {
  const safeCount = Math.max(1, Number.isFinite(itemCount) ? itemCount : 1);
  return Math.max(9, Math.min(24, 6 + 3 * Math.sqrt(safeCount - 1)));
}

export function getAuthorEdgeWidth(sharedItemCount: number) {
  const safeCount = Math.max(1, Number.isFinite(sharedItemCount) ? sharedItemCount : 1);
  return Math.max(2.5, Math.min(9, 1 + 1.5 * Math.sqrt(safeCount)));
}

export function buildAuthorGraphData(items: AuthorGraphItemInput[]): AuthorGraphData {
  const authorStats = new Map<
    string,
    {
      names: Map<string, number>;
      publications: Map<number, AuthorGraphPublication>;
    }
  >();
  const authorsByItemID = new Map<number, Set<string>>();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !Number.isFinite(item.itemID)) continue;

    const publication: AuthorGraphPublication = {
      itemID: item.itemID,
      workID: String(item.workID || ""),
      title: String(item.label || "Untitled").trim() || "Untitled",
      year: typeof item.year === "number" && Number.isFinite(item.year) ? item.year : null,
    };
    const authorNameByID = new Map<string, string>();
    for (const author of Array.isArray(item.authors) ? item.authors : []) {
      const id = String(author?.id || "")
        .trim()
        .toUpperCase();
      if (!/^A\d+$/.test(id)) continue;
      const normalizedName = String(author?.name || "")
        .replace(/\s+/g, " ")
        .trim();
      const name = normalizedName || id;
      const existingName = authorNameByID.get(id);
      if (
        !existingName ||
        existingName === id ||
        (name !== id && name.localeCompare(existingName) < 0)
      ) {
        authorNameByID.set(id, name);
      }
    }

    authorsByItemID.set(item.itemID, new Set(authorNameByID.keys()));
    for (const [id, name] of authorNameByID) {
      const stats = authorStats.get(id) || {
        names: new Map<string, number>(),
        publications: new Map<number, AuthorGraphPublication>(),
      };
      stats.names.set(name, (stats.names.get(name) || 0) + 1);
      stats.publications.set(item.itemID, publication);
      authorStats.set(id, stats);
    }
  }

  const nodes: AuthorGraphNode[] = [];
  for (const [id, stats] of authorStats) {
    if (stats.publications.size < 2) continue;

    const rankedNames = [...stats.names.entries()]
      .filter(([name]) => name && name !== id)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const publications = [...stats.publications.values()].sort((left, right) => {
      const leftYear = typeof left.year === "number" ? left.year : -Infinity;
      const rightYear = typeof right.year === "number" ? right.year : -Infinity;
      return (
        rightYear - leftYear || left.title.localeCompare(right.title) || left.itemID - right.itemID
      );
    });
    nodes.push({
      id,
      name: rankedNames[0]?.[0] || id,
      itemCount: publications.length,
      radius: getAuthorMarkerRadius(publications.length),
      publications,
    });
  }
  nodes.sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );

  const retainedAuthorIDs = new Set(nodes.map((node) => node.id));
  const edgeItemIDs = new Map<string, Set<number>>();
  const contributingItemIDs = new Set<number>();
  for (const [itemID, itemAuthorIDs] of authorsByItemID) {
    const retainedIDs = [...itemAuthorIDs]
      .filter((id) => retainedAuthorIDs.has(id))
      .sort((left, right) => left.localeCompare(right));
    if (retainedIDs.length) contributingItemIDs.add(itemID);

    for (let leftIndex = 0; leftIndex < retainedIDs.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < retainedIDs.length; rightIndex++) {
        const key = `${retainedIDs[leftIndex]}|${retainedIDs[rightIndex]}`;
        const itemIDs = edgeItemIDs.get(key) || new Set<number>();
        itemIDs.add(itemID);
        edgeItemIDs.set(key, itemIDs);
      }
    }
  }

  const edges: AuthorGraphEdge[] = [...edgeItemIDs.entries()]
    .map(([key, itemIDs]) => {
      const [source, target] = key.split("|");
      return {
        source,
        target,
        sharedItemCount: itemIDs.size,
        width: getAuthorEdgeWidth(itemIDs.size),
      };
    })
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) || left.target.localeCompare(right.target),
    );

  return { nodes, edges, publicationCount: contributingItemIDs.size };
}

export function buildCitationsPerYearOverlapOffsets(count: number, markerRadius = 6) {
  const safeCount = Math.max(0, Math.floor(count));
  const offsets: Array<{ x: number; y: number }> = [];
  if (!safeCount) {
    return offsets;
  }

  offsets.push({ x: 0, y: 0 });
  const ringSpacing = Math.max(1, markerRadius * 2 + 2);
  let remainingIndex = 0;

  for (let index = 1; index < safeCount; index++) {
    let ring = 1;
    let capacity = 6;
    let position = remainingIndex;
    while (position >= capacity) {
      position -= capacity;
      ring += 1;
      capacity = 6 * ring;
    }

    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / capacity;
    const radius = ring * ringSpacing;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
    remainingIndex += 1;
  }

  return offsets;
}

export function filterCitationsPerYearEdges(
  nodes: CitationsPerYearNodeInput[],
  edges: CitationsPerYearEdgeInput[],
) {
  const eligibleYearByID = new Map<string, number>();
  for (const node of nodes) {
    if (
      typeof node.year === "number" &&
      Number.isFinite(node.year) &&
      typeof node.citationCount === "number" &&
      Number.isFinite(node.citationCount)
    ) {
      eligibleYearByID.set(String(node.id), node.year);
    }
  }

  return edges.filter((edge) => {
    const sourceYear = eligibleYearByID.get(String(edge.source));
    const targetYear = eligibleYearByID.get(String(edge.target));
    return sourceYear !== undefined && targetYear !== undefined && sourceYear !== targetYear;
  });
}

export function buildCitationsPerYearLayout(
  nodes: CitationsPerYearNodeInput[],
  width: number,
  height: number,
  markerRadius = 6,
  rightInset = 0,
): CitationsPerYearLayout {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeRightInset = Math.max(0, Number.isFinite(rightInset) ? rightInset : 0);
  const plotLeft = Math.min(64, Math.max(20, safeWidth * 0.22));
  const plotRight = Math.max(plotLeft + 1, safeWidth - 28 - safeRightInset);
  const plotTop = Math.min(28, Math.max(12, safeHeight * 0.12));
  const plotBottom = Math.max(plotTop + 1, safeHeight - 54);
  const eligibleNodes = nodes
    .filter(
      (node) =>
        typeof node.year === "number" &&
        Number.isFinite(node.year) &&
        typeof node.citationCount === "number" &&
        Number.isFinite(node.citationCount),
    )
    .map((node) => ({
      id: String(node.id),
      year: node.year as number,
      citationCount: Math.max(0, node.citationCount as number),
    }));

  if (!eligibleNodes.length) {
    return {
      points: [],
      minYear: null,
      maxYear: null,
      maxCitationCount: 0,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
    };
  }

  const years = eligibleNodes.map((node) => node.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const maxCitationCount = Math.max(...eligibleNodes.map((node) => node.citationCount));
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const groups = new Map<string, typeof eligibleNodes>();

  for (const node of eligibleNodes) {
    const key = `${node.year}\u0000${node.citationCount}`;
    const group = groups.get(key) || [];
    group.push(node);
    groups.set(key, group);
  }

  const points: CitationsPerYearPoint[] = [];
  for (const group of groups.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
    const offsets = buildCitationsPerYearOverlapOffsets(group.length, markerRadius);

    for (let index = 0; index < group.length; index++) {
      const node = group[index];
      const anchorX =
        minYear === maxYear
          ? plotLeft + plotWidth / 2
          : plotLeft + ((node.year - minYear) / (maxYear - minYear)) * plotWidth;
      const anchorY =
        maxCitationCount <= 0
          ? plotBottom
          : plotBottom - (node.citationCount / maxCitationCount) * plotHeight;
      points.push({
        ...node,
        anchorX,
        anchorY,
        x: anchorX + offsets[index].x,
        y: anchorY + offsets[index].y,
      });
    }
  }

  points.sort((left, right) => left.id.localeCompare(right.id));
  return {
    points,
    minYear,
    maxYear,
    maxCitationCount,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
  };
}

export interface GraphPhysicsSettings {
  charge: number;
  minRepulsionDistanceSq: number;
  maxRepulsionDistance: number;
  largeGraphNodeThreshold: number;
  largeGraphRepulsionDistanceFactor: number;
  linkDistance: number;
  springStrength: number;
  centerStrength: number;
  collisionPadding: number;
  collisionStrength: number;
  isolatedChargeBoost: number;
  leafChargeBoost: number;
  isolatedCenterFactor: number;
  isolatedRingStrengthInside: number;
  isolatedRingStrengthOutside: number;
  damping: number;
  alphaDecay: number;
  alphaStop: number;
  speedStop: number;
  nodeSizeMultiplier: number;
  nodeRadiusBase: number;
  nodeRadiusCitationFactor: number;
  nodeRadiusDegreeFactor: number;
  nodeRadiusMin: number;
  nodeRadiusMax: number;
  initialPlacementRadiusScale: number;
  isolatedRingBaseRadius: number;
  isolatedRingNodeCountScale: number;
  isolatedRingPhaseOffset: number;
  isolatedRingJitterAmplitude: number;
  topLabelCountMultiplier: number;
  topLabelCountMin: number;
  topLabelCountMax: number;
  hoverLabelNodeThreshold: number;
  alwaysShowLabelNodeThreshold: number;
  labelVisibilityZoomThreshold: number;
  edgeWidth: number;
  edgeOpacity: number;
  edgeHighlightWidth: number;
  edgeHighlightOpacity: number;
  nodeStrokeWidth: number;
  labelFontSize: number;
  labelStrokeWidth: number;
  labelLineHeight: number;
  labelMaxCharsPerLine: number;
  labelMaxLines: number;
  labelOffsetX: number;
  labelOffsetY: number;
  edgeSourcePadding: number;
  edgeTargetPadding: number;
  arrowRefX: number;
  arrowRefY: number;
  arrowMarkerWidth: number;
  arrowMarkerHeight: number;
  arrowOpacity: number;
  fitPadding: number;
  fitScaleMin: number;
  fitScaleMax: number;
  zoomMin: number;
  zoomMax: number;
  zoomWheelSensitivity: number;
  warmupTicksBeforeFit: number;
  initialAlpha: number;
  tooltipOffset: number;
  tooltipMargin: number;
  regenerateJitterRadiusIsolated: number;
  regenerateJitterRadiusConnected: number;
  regenerateJitterScaleBase: number;
  regenerateJitterScaleAmplitude: number;
  regenerateVelocityAmplitude: number;
  regenerateAlpha: number;
  dragAlpha: number;
  releaseAlpha: number;
}

interface CollectionGraphRenderOptions {
  physics?: Partial<GraphPhysicsSettings>;
  showTuningControls?: boolean;
}

type GraphPhysicsFieldKey = keyof GraphPhysicsSettings;

interface GraphPhysicsFieldConfig {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  default: number;
  prefSuffix: string;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GraphLabelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphCollisionDisplacement {
  x: number;
  y: number;
}

export interface GraphCollisionVelocity {
  aX: number;
  aY: number;
  bX: number;
  bY: number;
}

export function buildGraphNodeFootprint(
  x: number,
  y: number,
  radius: number,
  labelBounds: GraphLabelBounds | null,
  labelVisible: boolean,
  labelOffsetX: number,
  labelOffsetY: number,
  labelHaloWidth: number,
): GraphBounds {
  const footprint = {
    minX: x - radius,
    maxX: x + radius,
    minY: y - radius,
    maxY: y + radius,
  };

  if (!labelVisible || !labelBounds) {
    return footprint;
  }

  const halo = Math.max(0, labelHaloWidth);
  const labelX = x + radius + labelOffsetX;
  const labelY = y + labelOffsetY;
  footprint.minX = Math.min(footprint.minX, labelX + labelBounds.x - halo);
  footprint.maxX = Math.max(footprint.maxX, labelX + labelBounds.x + labelBounds.width + halo);
  footprint.minY = Math.min(footprint.minY, labelY + labelBounds.y - halo);
  footprint.maxY = Math.max(footprint.maxY, labelY + labelBounds.y + labelBounds.height + halo);

  return footprint;
}

export function getGraphCollisionDisplacement(
  a: GraphBounds,
  b: GraphBounds,
  padding: number,
  tieBreakDirection = 1,
): GraphCollisionDisplacement | null {
  const halfPadding = Math.max(0, padding) / 2;
  const overlapX =
    Math.min(a.maxX + halfPadding, b.maxX + halfPadding) -
    Math.max(a.minX - halfPadding, b.minX - halfPadding);
  const overlapY =
    Math.min(a.maxY + halfPadding, b.maxY + halfPadding) -
    Math.max(a.minY - halfPadding, b.minY - halfPadding);

  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  const aCenterX = (a.minX + a.maxX) / 2;
  const bCenterX = (b.minX + b.maxX) / 2;
  const aCenterY = (a.minY + a.maxY) / 2;
  const bCenterY = (b.minY + b.maxY) / 2;
  const fallbackSign = tieBreakDirection < 0 ? -1 : 1;

  if (overlapX <= overlapY) {
    const direction = bCenterX === aCenterX ? fallbackSign : bCenterX > aCenterX ? 1 : -1;
    return { x: direction * overlapX, y: 0 };
  }

  const direction = bCenterY === aCenterY ? fallbackSign : bCenterY > aCenterY ? 1 : -1;
  return { x: 0, y: direction * overlapY };
}

export function getGraphCollisionVelocity(
  displacement: GraphCollisionDisplacement,
  strength: number,
  alpha: number,
  aAnchored: boolean,
  bAnchored: boolean,
): GraphCollisionVelocity {
  const factor = strength * alpha;
  return {
    aX: aAnchored ? 0 : -displacement.x * factor,
    aY: aAnchored ? 0 : -displacement.y * factor,
    bX: bAnchored ? 0 : displacement.x * factor,
    bY: bAnchored ? 0 : displacement.y * factor,
  };
}

export function graphLabelVisibilityChanged(current: boolean, next: boolean) {
  return current !== next;
}

export const GRAPH_INTERACTION_CONSTANTS = {
  labelVisibilityAlpha: 1,
  wheelDeltaModeLine: 1,
  wheelDeltaModePage: 2,
  wheelDeltaLinePixels: 16,
  wheelDeltaMaxPixels: 240,
} as const;

export function normalizeGraphWheelDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
) {
  let deltaPixels = deltaY;

  if (deltaMode === GRAPH_INTERACTION_CONSTANTS.wheelDeltaModeLine) {
    deltaPixels *= GRAPH_INTERACTION_CONSTANTS.wheelDeltaLinePixels;
  } else if (deltaMode === GRAPH_INTERACTION_CONSTANTS.wheelDeltaModePage) {
    deltaPixels *= Math.max(1, viewportHeight);
  }

  return Math.max(
    -GRAPH_INTERACTION_CONSTANTS.wheelDeltaMaxPixels,
    Math.min(GRAPH_INTERACTION_CONSTANTS.wheelDeltaMaxPixels, deltaPixels),
  );
}

export const GRAPH_PHYSICS_FIELD_CONFIG: Record<GraphPhysicsFieldKey, GraphPhysicsFieldConfig> = {
  charge: {
    label: "Repulsion (charge)",
    description:
      "Sets the global electrostatic push between nodes. Increase to open dense regions and reduce node overlap; decrease to let clusters stay tighter.",
    min: 100,
    max: 5000,
    step: 100,
    decimals: 0,
    default: 3000,
    prefSuffix: "graphCharge",
  },
  minRepulsionDistanceSq: {
    label: "Repulsion floor (distance^2)",
    description:
      "Prevents repulsion from exploding at very small distances. Increase for a softer near-contact behavior; decrease for harder short-range pushes.",
    min: 4,
    max: 400,
    step: 1,
    decimals: 0,
    default: 64,
    prefSuffix: "graphMinRepulsionDistanceSq",
  },
  maxRepulsionDistance: {
    label: "Repulsion range",
    description:
      "Maximum distance where nodes still repel each other. Increase to enforce global spacing; decrease for more local, faster layout relaxation.",
    min: 100,
    max: 1200,
    step: 10,
    decimals: 0,
    default: 500,
    prefSuffix: "graphMaxRepulsionDistance",
  },
  largeGraphNodeThreshold: {
    label: "Large-graph threshold",
    description:
      "Node count above which large-graph heuristics activate. Lower values apply optimization behavior earlier; higher values keep full behavior longer.",
    min: 50,
    max: 2000,
    step: 10,
    decimals: 0,
    default: 250,
    prefSuffix: "graphLargeGraphNodeThreshold",
  },
  largeGraphRepulsionDistanceFactor: {
    label: "Large-graph repulsion factor",
    description:
      "Multiplier applied to repulsion range when the graph is large. Lower values speed up big layouts; higher values preserve long-range spacing.",
    min: 0.2,
    max: 1,
    step: 0.01,
    decimals: 3,
    default: 0.6,
    prefSuffix: "graphLargeGraphRepulsionDistanceFactor",
  },
  linkDistance: {
    label: "Spring distance",
    description:
      "Target edge length for spring constraints. Increase to spread the graph; decrease to compact linked nodes.",
    min: 100,
    max: 2000,
    step: 100,
    decimals: 0,
    default: 300,
    prefSuffix: "graphLinkDistance",
  },
  springStrength: {
    label: "Spring strength",
    description:
      "How strongly edges pull toward the target distance. Increase for stiffer, faster edge correction; decrease for softer, freer motion.",
    min: 0.001,
    max: 1,
    step: 0.001,
    decimals: 4,
    default: 0.025,
    prefSuffix: "graphSpringStrength",
  },
  centerStrength: {
    label: "Centering strength",
    description:
      "Force pulling nodes toward the viewport center. Increase to keep graph centered and bounded; decrease for wider, drifting layouts.",
    min: 0,
    max: 0.1,
    step: 0.001,
    decimals: 4,
    default: 0.006,
    prefSuffix: "graphCenterStrength",
  },
  collisionPadding: {
    label: "Collision padding",
    description:
      "Extra spacing around node circles and visible titles during collision resolution. Increase to add breathing room; decrease to pack the graph more tightly.",
    min: 0,
    max: 30,
    step: 0.5,
    decimals: 2,
    default: 4,
    prefSuffix: "graphCollisionPadding",
  },
  collisionStrength: {
    label: "Collision strength",
    description:
      "How strongly overlap correction pushes nodes apart. Increase for firmer anti-overlap response; decrease for gentler correction.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 3,
    default: 0.08,
    prefSuffix: "graphCollisionStrength",
  },
  isolatedChargeBoost: {
    label: "Lone-node charge boost",
    description:
      "Repulsion multiplier for disconnected nodes (degree 0). Increase to keep isolates farther from the core; decrease to let them drift inward.",
    min: 1,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 2.2,
    prefSuffix: "graphIsolatedChargeBoost",
  },
  leafChargeBoost: {
    label: "Leaf-node charge boost",
    description:
      "Repulsion multiplier for degree-1 nodes. Increase to reduce leaf crowding around hubs; decrease to keep leaves closer to their neighbors.",
    min: 1,
    max: 3,
    step: 0.01,
    decimals: 3,
    default: 1.35,
    prefSuffix: "graphLeafChargeBoost",
  },
  isolatedCenterFactor: {
    label: "Lone-node center factor",
    description:
      "Centering multiplier applied only to isolated nodes. Increase to pull isolates toward center; decrease to keep them in the peripheral ring.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 4,
    default: 0.18,
    prefSuffix: "graphIsolatedCenterFactor",
  },
  isolatedRingStrengthInside: {
    label: "Lone-node ring pull (inside)",
    description:
      "Ring-restoring force when isolates are inside their target radius. Increase to push isolates outward faster from the center region.",
    min: 0.001,
    max: 0.1,
    step: 0.001,
    decimals: 4,
    default: 0.03,
    prefSuffix: "graphIsolatedRingStrengthInside",
  },
  isolatedRingStrengthOutside: {
    label: "Lone-node ring pull (outside)",
    description:
      "Ring-restoring force when isolates are outside their target radius. Increase to pull isolates back inward more aggressively.",
    min: 0.001,
    max: 0.05,
    step: 0.001,
    decimals: 4,
    default: 0.008,
    prefSuffix: "graphIsolatedRingStrengthOutside",
  },
  damping: {
    label: "Damping",
    description:
      "Velocity retention per tick. Higher values preserve momentum and can oscillate longer; lower values dissipate motion faster.",
    min: 0.4,
    max: 0.99,
    step: 0.1,
    decimals: 2,
    default: 0.5,
    prefSuffix: "graphDamping",
  },
  alphaDecay: {
    label: "Alpha decay",
    description:
      "Cooling factor of the simulation energy. Higher values cool more slowly for longer exploration; lower values settle faster.",
    min: 0.9,
    max: 0.999,
    step: 0.001,
    decimals: 3,
    default: 0.95,
    prefSuffix: "graphAlphaDecay",
  },
  alphaStop: {
    label: "Alpha stop threshold",
    description:
      "Simulation stops when alpha drops below this value and speed is low. Increase for shorter runs; decrease for longer refinement.",
    min: 0.001,
    max: 0.2,
    step: 0.001,
    decimals: 4,
    default: 0.02,
    prefSuffix: "graphAlphaStop",
  },
  speedStop: {
    label: "Speed stop threshold",
    description:
      "Average velocity threshold used to stop ticking. Increase to stop earlier; decrease to continue relaxing micro-movements.",
    min: 0.001,
    max: 0.5,
    step: 0.001,
    decimals: 4,
    default: 0.03,
    prefSuffix: "graphSpeedStop",
  },
  nodeSizeMultiplier: {
    label: "Node size multiplier",
    description:
      "Global multiplier for node radius after citation/degree sizing. Increase to make all nodes larger; decrease for a lighter visual footprint.",
    min: 0.2,
    max: 4,
    step: 0.05,
    decimals: 3,
    default: 1,
    prefSuffix: "graphNodeSizeMultiplier",
  },
  nodeRadiusBase: {
    label: "Node radius base",
    description:
      "Base radius added to every node before scaling terms. Increase to enlarge low-signal nodes; decrease to shrink them.",
    min: 0,
    max: 30,
    step: 0.1,
    decimals: 3,
    default: 4,
    prefSuffix: "graphNodeRadiusBase",
  },
  nodeRadiusCitationFactor: {
    label: "Node radius citation factor",
    description:
      "Multiplier on log10(citations+1) in node radius formula. Increase to emphasize citation differences; decrease to flatten citation impact.",
    min: 0,
    max: 10,
    step: 0.1,
    decimals: 3,
    default: 2,
    prefSuffix: "graphNodeRadiusCitationFactor",
  },
  nodeRadiusDegreeFactor: {
    label: "Node radius degree factor",
    description:
      "Multiplier on sqrt(degree) in node radius formula. Increase to highlight connectivity hubs; decrease to reduce degree prominence.",
    min: 0,
    max: 10,
    step: 0.1,
    decimals: 3,
    default: 1.2,
    prefSuffix: "graphNodeRadiusDegreeFactor",
  },
  nodeRadiusMin: {
    label: "Node radius minimum",
    description:
      "Lower clamp for computed node radius. Increase to avoid tiny nodes; decrease to allow more extreme small nodes.",
    min: 0.5,
    max: 30,
    step: 0.1,
    decimals: 3,
    default: 4,
    prefSuffix: "graphNodeRadiusMin",
  },
  nodeRadiusMax: {
    label: "Node radius maximum",
    description:
      "Upper clamp for computed node radius. Increase for dramatic hub sizes; decrease for a more uniform node scale.",
    min: 1,
    max: 80,
    step: 0.5,
    decimals: 2,
    default: 18,
    prefSuffix: "graphNodeRadiusMax",
  },
  initialPlacementRadiusScale: {
    label: "Initial placement scale",
    description:
      "Controls radial spacing of initial golden-angle seed positions. Increase for wider initial spread; decrease for tighter initial cloud.",
    min: 1,
    max: 50,
    step: 0.5,
    decimals: 2,
    default: 12,
    prefSuffix: "graphInitialPlacementRadiusScale",
  },
  isolatedRingBaseRadius: {
    label: "Isolated ring base radius",
    description:
      "Base radius of the peripheral ring for disconnected nodes. Increase to keep isolates farther from connected components.",
    min: 20,
    max: 1000,
    step: 5,
    decimals: 0,
    default: 150,
    prefSuffix: "graphIsolatedRingBaseRadius",
  },
  isolatedRingNodeCountScale: {
    label: "Isolated ring size factor",
    description:
      "Adds ring radius as the graph grows (multiplied by sqrt(node_count)). Increase to expand ring for large collections.",
    min: 0,
    max: 100,
    step: 0.5,
    decimals: 2,
    default: 20,
    prefSuffix: "graphIsolatedRingNodeCountScale",
  },
  isolatedRingPhaseOffset: {
    label: "Isolated ring phase",
    description:
      "Angular offset applied when placing isolated nodes on the ring. Adjust to rotate the ring pattern and reduce visual alignment artifacts.",
    min: -3.1416,
    max: 3.1416,
    step: 0.01,
    decimals: 4,
    default: 0.31,
    prefSuffix: "graphIsolatedRingPhaseOffset",
  },
  isolatedRingJitterAmplitude: {
    label: "Isolated ring jitter",
    description:
      "Alternating radial jitter used for isolated node placement. Increase for a more irregular ring; decrease for a cleaner circular rim.",
    min: 0,
    max: 100,
    step: 0.5,
    decimals: 2,
    default: 9,
    prefSuffix: "graphIsolatedRingJitterAmplitude",
  },
  topLabelCountMultiplier: {
    label: "Top label count multiplier",
    description:
      "Multiplier in sqrt(node_count)*k that decides how many labels stay visible in auto mode. Increase to show more persistent labels.",
    min: 0,
    max: 20,
    step: 0.1,
    decimals: 2,
    default: 3,
    prefSuffix: "graphTopLabelCountMultiplier",
  },
  topLabelCountMin: {
    label: "Top label count minimum",
    description:
      "Minimum number of always-eligible labels in auto mode. Increase to guarantee more visible labels in small graphs.",
    min: 0,
    max: 500,
    step: 1,
    decimals: 0,
    default: 10,
    prefSuffix: "graphTopLabelCountMin",
  },
  topLabelCountMax: {
    label: "Top label count maximum",
    description:
      "Maximum number of always-eligible labels in auto mode. Increase to annotate more hubs; decrease for cleaner visuals.",
    min: 1,
    max: 1000,
    step: 1,
    decimals: 0,
    default: 36,
    prefSuffix: "graphTopLabelCountMax",
  },
  hoverLabelNodeThreshold: {
    label: "Hover-label threshold",
    description:
      "Above this node count, labels switch to hover-only mode for readability/performance. Increase to keep persistent labels in larger graphs.",
    min: 10,
    max: 5000,
    step: 10,
    decimals: 0,
    default: 250,
    prefSuffix: "graphHoverLabelNodeThreshold",
  },
  alwaysShowLabelNodeThreshold: {
    label: "Always-show label threshold",
    description:
      "When node count is below this threshold, labels are always shown in auto mode. Increase for more aggressive labeling in medium-size graphs.",
    min: 1,
    max: 5000,
    step: 1,
    decimals: 0,
    default: 80,
    prefSuffix: "graphAlwaysShowLabelNodeThreshold",
  },
  labelVisibilityZoomThreshold: {
    label: "Label zoom threshold",
    description:
      "Minimum zoom needed to show top labels in auto mode. Increase for cleaner low-zoom views; decrease to reveal labels earlier.",
    min: 0.1,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 0.7,
    prefSuffix: "graphLabelVisibilityZoomThreshold",
  },
  edgeWidth: {
    label: "Edge width",
    description:
      "Base stroke width of edges. Increase to make links more visible; decrease for a lighter, less dominant edge layer.",
    min: 0.1,
    max: 10,
    step: 0.05,
    decimals: 3,
    default: 1.25,
    prefSuffix: "graphEdgeWidth",
  },
  edgeOpacity: {
    label: "Edge opacity",
    description:
      "Base opacity of non-highlighted edges. Increase to emphasize global connectivity; decrease to prioritize node readability.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 3,
    default: 0.4,
    prefSuffix: "graphEdgeOpacity",
  },
  edgeHighlightWidth: {
    label: "Edge highlight width",
    description:
      "Stroke width of highlighted incident edges on hover. Increase for stronger path emphasis around hovered nodes.",
    min: 0.1,
    max: 12,
    step: 0.05,
    decimals: 3,
    default: 2,
    prefSuffix: "graphEdgeHighlightWidth",
  },
  edgeHighlightOpacity: {
    label: "Edge highlight opacity",
    description:
      "Opacity of highlighted edges. Increase for stronger focus contrast; decrease for subtler hover effects.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 3,
    default: 0.9,
    prefSuffix: "graphEdgeHighlightOpacity",
  },
  nodeStrokeWidth: {
    label: "Node stroke width",
    description:
      "Border width around nodes. Increase for stronger node outlines; decrease for flatter node appearance.",
    min: 0,
    max: 10,
    step: 0.05,
    decimals: 3,
    default: 1.1,
    prefSuffix: "graphNodeStrokeWidth",
  },
  labelFontSize: {
    label: "Label font size",
    description:
      "Font size of node labels in pixels. Increase for readability; decrease to reduce clutter in dense views.",
    min: 6,
    max: 36,
    step: 0.5,
    decimals: 2,
    default: 10,
    prefSuffix: "graphLabelFontSize",
  },
  labelStrokeWidth: {
    label: "Label halo width",
    description:
      "Stroke width of text halo behind labels. Increase for contrast over edges/nodes; decrease for crisper, thinner text outlines.",
    min: 0,
    max: 10,
    step: 0.1,
    decimals: 3,
    default: 2.8,
    prefSuffix: "graphLabelStrokeWidth",
  },
  labelLineHeight: {
    label: "Label line spacing",
    description:
      "Vertical spacing between wrapped label lines in pixels. Increase for airy multiline labels; decrease for compact stacks.",
    min: 6,
    max: 40,
    step: 0.5,
    decimals: 2,
    default: 11,
    prefSuffix: "graphLabelLineHeight",
  },
  labelMaxCharsPerLine: {
    label: "Label max chars/line",
    description:
      "Soft wrapping limit for each label line. Increase to reduce wrapping; decrease for narrower, taller labels.",
    min: 4,
    max: 120,
    step: 1,
    decimals: 0,
    default: 24,
    prefSuffix: "graphLabelMaxCharsPerLine",
  },
  labelMaxLines: {
    label: "Label max lines",
    description:
      "Maximum wrapped lines per label before truncation. Increase for fuller titles; decrease to limit visual noise.",
    min: 1,
    max: 10,
    step: 1,
    decimals: 0,
    default: 3,
    prefSuffix: "graphLabelMaxLines",
  },
  labelOffsetX: {
    label: "Label offset X",
    description:
      "Horizontal offset from node edge to label anchor. Increase to move labels farther right; decrease to bring labels closer.",
    min: -40,
    max: 80,
    step: 0.5,
    decimals: 2,
    default: 2,
    prefSuffix: "graphLabelOffsetX",
  },
  labelOffsetY: {
    label: "Label offset Y",
    description:
      "Vertical offset from node center to label anchor. Increase to move labels downward; decrease to move them upward.",
    min: -80,
    max: 80,
    step: 0.5,
    decimals: 2,
    default: -4,
    prefSuffix: "graphLabelOffsetY",
  },
  edgeSourcePadding: {
    label: "Edge source padding",
    description:
      "Extra offset from source node radius when drawing edge start. Increase to avoid touching source borders.",
    min: 0,
    max: 40,
    step: 0.5,
    decimals: 2,
    default: 1,
    prefSuffix: "graphEdgeSourcePadding",
  },
  edgeTargetPadding: {
    label: "Edge target padding",
    description:
      "Extra offset from target node radius so arrowheads stop before node fill. Increase to keep arrowheads clearer.",
    min: 0,
    max: 80,
    step: 0.5,
    decimals: 2,
    default: 7,
    prefSuffix: "graphEdgeTargetPadding",
  },
  arrowRefX: {
    label: "Arrow reference X",
    description:
      "Marker anchor X used to place arrowheads along the edge direction. Tune with marker width/target padding for clean attachment.",
    min: 0,
    max: 40,
    step: 0.1,
    decimals: 3,
    default: 8,
    prefSuffix: "graphArrowRefX",
  },
  arrowRefY: {
    label: "Arrow reference Y",
    description:
      "Marker anchor Y used to center arrowhead geometry. Usually paired with marker viewBox and path shape.",
    min: 0,
    max: 40,
    step: 0.1,
    decimals: 3,
    default: 5,
    prefSuffix: "graphArrowRefY",
  },
  arrowMarkerWidth: {
    label: "Arrow marker width",
    description:
      "Rendered width of arrowhead marker. Increase for more prominent direction cues; decrease for subtler arrows.",
    min: 0.5,
    max: 40,
    step: 0.1,
    decimals: 3,
    default: 5.6,
    prefSuffix: "graphArrowMarkerWidth",
  },
  arrowMarkerHeight: {
    label: "Arrow marker height",
    description:
      "Rendered height of arrowhead marker. Increase to thicken arrowheads; decrease to keep them slim.",
    min: 0.5,
    max: 40,
    step: 0.1,
    decimals: 3,
    default: 5.6,
    prefSuffix: "graphArrowMarkerHeight",
  },
  arrowOpacity: {
    label: "Arrow opacity",
    description:
      "Opacity of arrowhead fill. Increase for stronger direction visibility; decrease to reduce directional visual weight.",
    min: 0,
    max: 1,
    step: 0.01,
    decimals: 3,
    default: 0.7,
    prefSuffix: "graphArrowOpacity",
  },
  fitPadding: {
    label: "Fit padding",
    description:
      "Padding used when fitting graph into viewport. Increase to keep nodes away from borders; decrease to maximize occupied area.",
    min: 0,
    max: 400,
    step: 1,
    decimals: 0,
    default: 80,
    prefSuffix: "graphFitPadding",
  },
  fitScaleMin: {
    label: "Fit minimum scale",
    description:
      "Lower bound for fit-to-view zoom scale. Increase to avoid very zoomed-out fits on huge graphs.",
    min: 0.01,
    max: 10,
    step: 0.01,
    decimals: 3,
    default: 0.15,
    prefSuffix: "graphFitScaleMin",
  },
  fitScaleMax: {
    label: "Fit maximum scale",
    description:
      "Upper bound for fit-to-view zoom scale. Increase to zoom in more on compact graphs after fitting.",
    min: 0.1,
    max: 20,
    step: 0.1,
    decimals: 3,
    default: 2.5,
    prefSuffix: "graphFitScaleMax",
  },
  zoomMin: {
    label: "Zoom minimum",
    description:
      "Minimum user zoom level allowed by wheel interaction. Increase to prevent extreme zoom-out.",
    min: 0.01,
    max: 10,
    step: 0.01,
    decimals: 3,
    default: 0.15,
    prefSuffix: "graphZoomMin",
  },
  zoomMax: {
    label: "Zoom maximum",
    description:
      "Maximum user zoom level allowed by wheel interaction. Increase for deeper close-up inspection.",
    min: 0.5,
    max: 50,
    step: 0.1,
    decimals: 3,
    default: 5,
    prefSuffix: "graphZoomMax",
  },
  zoomWheelSensitivity: {
    label: "Wheel zoom sensitivity",
    description:
      "Exponential wheel-to-zoom conversion factor after normalizing mouse-wheel and trackpad input. Increase for faster zoom; decrease for finer control.",
    min: 0.0001,
    max: 0.02,
    step: 0.0001,
    decimals: 4,
    default: 0.004,
    prefSuffix: "graphZoomWheelSensitivity",
  },
  warmupTicksBeforeFit: {
    label: "Warmup ticks before fit",
    description:
      "Number of simulation ticks before auto-fit runs once. Increase to fit after more relaxation; decrease for faster initial framing.",
    min: 0,
    max: 500,
    step: 1,
    decimals: 0,
    default: 28,
    prefSuffix: "graphWarmupTicksBeforeFit",
  },
  initialAlpha: {
    label: "Initial alpha",
    description:
      "Alpha used for the first simulation run when opening the graph window. Increase for stronger initial movement before settling.",
    min: 0.01,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 1,
    prefSuffix: "graphInitialAlpha",
  },
  tooltipOffset: {
    label: "Tooltip cursor offset",
    description:
      "Pixel offset from cursor to tooltip anchor. Increase to keep tooltip farther from pointer and reduce overlap.",
    min: 0,
    max: 100,
    step: 1,
    decimals: 0,
    default: 14,
    prefSuffix: "graphTooltipOffset",
  },
  tooltipMargin: {
    label: "Tooltip edge margin",
    description:
      "Minimum pixel margin between tooltip and graph-shell boundaries. Increase to keep tooltip farther from edges.",
    min: 0,
    max: 100,
    step: 1,
    decimals: 0,
    default: 8,
    prefSuffix: "graphTooltipMargin",
  },
  regenerateJitterRadiusIsolated: {
    label: "Regenerate jitter radius (isolated)",
    description:
      "Base positional jitter applied to isolated nodes when regenerating. Increase to escape local minima more aggressively.",
    min: 0,
    max: 100,
    step: 0.5,
    decimals: 2,
    default: 14,
    prefSuffix: "graphRegenerateJitterRadiusIsolated",
  },
  regenerateJitterRadiusConnected: {
    label: "Regenerate jitter radius (connected)",
    description:
      "Base positional jitter for connected nodes on regenerate. Increase for stronger re-layout perturbation.",
    min: 0,
    max: 100,
    step: 0.5,
    decimals: 2,
    default: 8,
    prefSuffix: "graphRegenerateJitterRadiusConnected",
  },
  regenerateJitterScaleBase: {
    label: "Regenerate jitter base scale",
    description:
      "Base multiplier in regenerate jitter modulation. Increase to raise overall jitter floor across nodes.",
    min: 0,
    max: 3,
    step: 0.01,
    decimals: 3,
    default: 0.35,
    prefSuffix: "graphRegenerateJitterScaleBase",
  },
  regenerateJitterScaleAmplitude: {
    label: "Regenerate jitter scale amplitude",
    description:
      "Additional sinusoidal modulation amplitude for regenerate jitter. Increase to diversify node perturbation intensity.",
    min: 0,
    max: 3,
    step: 0.01,
    decimals: 3,
    default: 0.65,
    prefSuffix: "graphRegenerateJitterScaleAmplitude",
  },
  regenerateVelocityAmplitude: {
    label: "Regenerate velocity amplitude",
    description:
      "Initial velocity magnitude injected during regenerate. Increase to explore layouts farther; decrease for more conservative refresh.",
    min: 0,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 0.9,
    prefSuffix: "graphRegenerateVelocityAmplitude",
  },
  regenerateAlpha: {
    label: "Regenerate alpha",
    description:
      "Alpha value used when pressing Regenerate. Increase for stronger reheat and longer relaxation.",
    min: 0.01,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 1.1,
    prefSuffix: "graphRegenerateAlpha",
  },
  dragAlpha: {
    label: "Drag alpha",
    description:
      "Alpha reheating applied while starting a node drag. Increase to make neighborhood adapt quickly during dragging.",
    min: 0.01,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 0.35,
    prefSuffix: "graphDragAlpha",
  },
  releaseAlpha: {
    label: "Release alpha",
    description:
      "Alpha reheating applied when releasing a dragged node. Increase for stronger post-drag rebalancing.",
    min: 0.01,
    max: 5,
    step: 0.01,
    decimals: 3,
    default: 0.2,
    prefSuffix: "graphReleaseAlpha",
  },
};

export const GRAPH_PHYSICS_FIELD_KEYS = Object.keys(
  GRAPH_PHYSICS_FIELD_CONFIG,
) as GraphPhysicsFieldKey[];

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveGraphPhysicsSettings(
  overrides?: Partial<GraphPhysicsSettings>,
): GraphPhysicsSettings {
  const normalized = {} as GraphPhysicsSettings;

  for (let i = 0; i < GRAPH_PHYSICS_FIELD_KEYS.length; i++) {
    const key = GRAPH_PHYSICS_FIELD_KEYS[i];
    const config = GRAPH_PHYSICS_FIELD_CONFIG[key];
    const rawValue = overrides?.[key];
    const numericValue = Number(rawValue ?? config.default);
    normalized[key] = clampNumber(numericValue, config.min, config.max);
  }

  return normalized;
}

export function renderCollectionCitationGraphWindow(
  popup: Window,
  graphData: CollectionGraphData,
  options: CollectionGraphRenderOptions = {},
) {
  const resolvedPhysics = resolveGraphPhysicsSettings(options.physics);

  const payload = JSON.stringify(graphData).replace(/</g, "\\u003c");
  const physicsPayload = JSON.stringify(resolvedPhysics).replace(/</g, "\\u003c");
  const physicsFieldConfigPayload = JSON.stringify(GRAPH_PHYSICS_FIELD_CONFIG).replace(
    /</g,
    "\\u003c",
  );
  const graphInteractionConstantsPayload = JSON.stringify(GRAPH_INTERACTION_CONSTANTS);
  const buildGraphNodeFootprintPayload = buildGraphNodeFootprint.toString();
  const getGraphCollisionDisplacementPayload = getGraphCollisionDisplacement.toString();
  const getGraphCollisionVelocityPayload = getGraphCollisionVelocity.toString();
  const graphLabelVisibilityChangedPayload = graphLabelVisibilityChanged.toString();
  const buildCitationsPerYearOverlapOffsetsPayload = buildCitationsPerYearOverlapOffsets.toString();
  const filterCitationsPerYearEdgesPayload = filterCitationsPerYearEdges.toString();
  const buildCitationsPerYearLayoutPayload = buildCitationsPerYearLayout.toString();
  const getAuthorMarkerRadiusPayload = getAuthorMarkerRadius.toString();
  const getAuthorEdgeWidthPayload = getAuthorEdgeWidth.toString();
  const buildAuthorGraphDataPayload = buildAuthorGraphData.toString();
  const showTuningControlsPayload = JSON.stringify(Boolean(options.showTuningControls));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OpenAlex Citation Graph</title>
  <style>
    :root {
      color-scheme: dark;
      --bg-0: #0d121a;
      --bg-1: #131b27;
      --panel: rgba(17, 26, 38, 0.86);
      --border: #2b3d53;
      --text: #d6e4f2;
      --muted: #8ca3bb;
      --edge: #5f7692;
      --edge-active: #c7dbef;
      --node: #53a1ff;
      --node-stroke: #cbe6ff;
      --node-active: #f4cd78;
    }

    body {
      margin: 0;
      font-family: "Segoe UI", "Noto Sans", sans-serif;
      background:
        radial-gradient(1300px 700px at 110% -8%, rgba(58, 109, 171, 0.24), transparent 70%),
        radial-gradient(900px 600px at -20% 120%, rgba(88, 53, 131, 0.16), transparent 75%),
        linear-gradient(165deg, var(--bg-1), var(--bg-0));
      color: var(--text);
      height: 100vh;
      display: grid;
      grid-template-rows: auto auto 1fr;
    }

    .bar,
    .summary {
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      padding: 10px 14px;
      backdrop-filter: blur(3px);
    }

    .bar {
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
    }

    .bar-title {
      letter-spacing: 0.01em;
      font-size: 14px;
    }

    .bar-sub {
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
    }

    .view-switcher {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .view-button {
      border: 1px solid #354d68;
      border-radius: 6px;
      background: rgba(27, 43, 60, 0.82);
      color: #a9bed2;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .view-button:hover {
      border-color: #5c82ab;
      color: #e6f3ff;
    }

    .view-button[aria-pressed="true"] {
      border-color: #6ea8e5;
      background: linear-gradient(180deg, rgba(55, 102, 151, 0.96), rgba(33, 66, 101, 0.98));
      color: #f2f8ff;
      box-shadow: inset 0 0 0 1px rgba(177, 218, 255, 0.12);
    }

    .summary {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .summary-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      flex: 1 1 auto;
      min-width: 0;
    }

    .summary-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .summary-pill {
      padding: 3px 8px;
      border: 1px solid #2c3f56;
      border-radius: 999px;
      background: rgba(124, 164, 203, 0.08);
      line-height: 1.35;
    }

    .summary-pill strong {
      color: #dfefff;
      font-weight: 600;
      margin-left: 4px;
    }

    .graph-shell {
      position: relative;
      margin: 8px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      background:
        radial-gradient(circle at 20% 12%, rgba(48, 97, 150, 0.2), transparent 42%),
        radial-gradient(circle at 80% 90%, rgba(62, 35, 95, 0.18), transparent 44%),
        #0c141f;
    }

    .authors-view {
      position: absolute;
      inset: 0;
      display: none;
      grid-template-columns: minmax(0, 1fr) minmax(180px, min(32%, 320px));
      gap: 10px;
      padding: 10px;
      box-sizing: border-box;
    }

    .author-canvas {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .author-details {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      box-sizing: border-box;
    }

    .author-details.has-selection {
      border: 1px solid #30475f;
      border-radius: 8px;
      background: rgba(12, 21, 31, 0.95);
      box-shadow: 0 10px 28px rgba(3, 8, 13, 0.34);
      padding: 12px;
      backdrop-filter: blur(3px);
    }

    .author-details-title {
      color: #ecf6ff;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 4px;
    }

    .author-details-count {
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 10px;
    }

    .author-publications {
      margin: 0;
      padding-left: 20px;
      color: #bfd2e5;
      font-size: 11px;
      line-height: 1.4;
    }

    .author-publications li + li {
      margin-top: 6px;
    }

    .edge.author-edge {
      marker-end: none;
    }

    .author-label {
      display: block;
    }

    svg {
      width: 100%;
      height: 100%;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }

    svg:active {
      cursor: grabbing;
    }

    svg.fixed-view,
    svg.fixed-view:active {
      cursor: default;
    }

    .edge {
      stroke: var(--edge);
      stroke-width: var(--graph-edge-width, 1.25px);
      stroke-opacity: var(--graph-edge-opacity, 0.4);
      marker-end: url(#arrowhead);
      transition: opacity 100ms linear, stroke-width 100ms linear, stroke 100ms linear;
    }

    .edge.highlight {
      stroke: var(--edge-active);
      stroke-opacity: var(--graph-edge-highlight-opacity, 0.9);
      stroke-width: var(--graph-edge-highlight-width, 2px);
    }

    .edge.dimmed {
      stroke-opacity: 0.08;
    }

    .node {
      fill: var(--node);
      stroke: var(--node-stroke);
      stroke-width: var(--graph-node-stroke-width, 1.1px);
      transition: opacity 100ms linear, fill 100ms linear, stroke 100ms linear;
    }

    .node.highlight {
      fill: var(--node-active);
      stroke: #fff8d8;
    }

    .node.focus-hover {
      fill: #7de8ff;
      stroke: #e5fbff;
    }

    .node.focus-parent {
      fill: #a9efb2;
      stroke: #dffff0;
    }

    .node.focus-child {
      fill: #ffd29a;
      stroke: #ffefda;
    }

    .node.dimmed {
      opacity: 0.24;
    }

    .edge.author-edge.hover-connected {
      stroke: var(--edge-active);
      stroke-opacity: 1;
      filter: drop-shadow(0 0 2px rgba(199, 219, 239, 0.48));
    }

    .author-node.hover-focus {
      fill: #7de8ff;
      stroke: #e5fbff;
    }

    .author-node.hover-coauthor {
      fill: #a9efb2;
      stroke: #dffff0;
    }

    .author-node.selected {
      fill: var(--node-active);
      stroke: #fff8d8;
    }

    .author-label.hover-focus,
    .author-label.hover-coauthor {
      fill: #f3fbff;
      font-weight: 600;
    }

    .plot-axis,
    .plot-grid {
      fill: none;
      shape-rendering: crispEdges;
      pointer-events: none;
    }

    .plot-axis {
      stroke: #7890a8;
      stroke-width: 1;
    }

    .plot-grid {
      stroke: rgba(116, 145, 173, 0.18);
      stroke-width: 1;
    }

    .plot-tick-label,
    .plot-axis-title {
      fill: #9eb4c9;
      pointer-events: none;
      user-select: none;
    }

    .plot-tick-label {
      font-size: 10px;
    }

    .plot-axis-title {
      fill: #c3d5e6;
      font-size: 11px;
      font-weight: 600;
    }

    .edge.highlight-parent {
      stroke: #99f0ae;
      stroke-opacity: var(--graph-edge-highlight-opacity, 0.9);
      stroke-width: var(--graph-edge-highlight-width, 2px);
      marker-end: url(#arrowhead-parent);
    }

    .edge.highlight-child {
      stroke: #ffd4a6;
      stroke-opacity: var(--graph-edge-highlight-opacity, 0.9);
      stroke-width: var(--graph-edge-highlight-width, 2px);
      marker-end: url(#arrowhead-child);
    }

    .edge.yearly-edge,
    .edge.yearly-edge.highlight-parent,
    .edge.yearly-edge.highlight-child {
      marker-end: none;
    }

    .node-label {
      font-size: var(--graph-label-font-size, 10px);
      fill: #d9e8f6;
      pointer-events: none;
      paint-order: stroke;
      stroke: rgba(11, 19, 29, 0.75);
      stroke-width: var(--graph-label-stroke-width, 2.8px);
      stroke-linejoin: round;
      transition: opacity 100ms linear;
    }

    .node-label.dimmed {
      opacity: 0.08;
    }

    .tooltip,
    .empty-state {
      border: 1px solid #30475f;
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(3, 8, 13, 0.34);
      backdrop-filter: blur(3px);
    }

    .tooltip {
      position: absolute;
      left: 0;
      top: 0;
      min-width: 220px;
      max-width: 360px;
      background: rgba(12, 21, 31, 0.95);
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.33;
      color: #b9d1e6;
      pointer-events: none;
      display: none;
      z-index: 5;
    }

    .tooltip.yearly-docked {
      left: auto;
      right: 10px;
      top: 10px;
      width: var(--yearly-details-width, 280px);
      min-width: 0;
      max-width: none;
      max-height: calc(100% - 20px);
      box-sizing: border-box;
      overflow: auto;
    }

    .tooltip-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: #ecf6ff;
    }

    .tooltip-row {
      display: block;
      margin-top: 2px;
    }

    .empty-state {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(420px, calc(100% - 28px));
      text-align: center;
      background: rgba(13, 21, 31, 0.92);
      padding: 14px 16px;
      display: none;
      z-index: 6;
    }

    .empty-title {
      font-size: 14px;
      color: #dcecff;
      margin-bottom: 5px;
      font-weight: 600;
    }

    .empty-text {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }

    .tuning-panel {
      position: absolute;
      right: 10px;
      top: 10px;
      width: min(320px, calc(100% - 20px));
      max-height: calc(100% - 20px);
      overflow: auto;
      background: rgba(12, 21, 31, 0.94);
      border: 1px solid #30475f;
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(3, 8, 13, 0.34);
      padding: 10px;
      z-index: 7;
      backdrop-filter: blur(3px);
      display: none;
    }

    .tuning-title {
      font-size: 12px;
      font-weight: 600;
      color: #e8f4ff;
      margin-bottom: 8px;
    }

    .tuning-grid {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 6px 8px;
      align-items: center;
    }

    .tuning-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(17, 30, 44, 0.92);
      color: #dcecff;
      border: 1px solid #3a526c;
      border-radius: 5px;
      padding: 3px 6px;
      font-size: 11px;
      text-align: right;
    }

    .tuning-label {
      color: #9fb6cc;
      font-size: 11px;
      line-height: 1.2;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tuning-label-title {
      color: #d5e6f7;
      font-weight: 600;
    }

    .tuning-label-description {
      color: #8fa9c2;
      font-size: 10px;
      line-height: 1.3;
    }

    .tuning-btn {
      border: 1px solid #3e5a78;
      border-radius: 6px;
      background: linear-gradient(180deg, rgba(52, 78, 103, 0.95), rgba(32, 52, 72, 1));
      color: #e6f3ff;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
    }

    .tuning-btn:hover {
      border-color: #5c82ab;
    }
  </style>
</head>
<body>
  <div class="bar">
    <div>
      <div class="bar-title" id="collection-name"></div>
    </div>
    <div class="view-switcher" role="group" aria-label="Citation graph representation">
      <button class="view-button" id="view-graph-button" type="button" aria-pressed="true">Citation Graph</button>
      <button class="view-button" id="view-year-button" type="button" aria-pressed="false">Citations vs Year</button>
      <button class="view-button" id="view-authors-button" type="button" aria-pressed="false">Co-Authors</button>
    </div>
  </div>
  <div class="summary" id="summary-bar">
    <div class="summary-metrics" id="summary"></div>
    <div class="summary-actions">
      <button class="tuning-btn" id="regenerate-button" type="button">Regenerate</button>
    </div>
  </div>
  <div class="graph-shell">
    <svg id="graph" preserveAspectRatio="xMidYMid meet">
      <g id="viewport">
        <g id="edges"></g>
        <g id="nodes"></g>
        <g id="labels"></g>
      </g>
      <g id="yearly-view" style="display: none">
        <g id="yearly-axes"></g>
        <g id="yearly-edges"></g>
        <g id="yearly-nodes"></g>
      </g>
    </svg>
    <div class="authors-view" id="authors-view" aria-hidden="true">
      <div class="author-canvas" id="author-canvas">
        <svg id="author-graph" preserveAspectRatio="xMidYMid meet" aria-label="Author coauthorship graph">
          <g id="author-viewport">
            <g id="author-edges"></g>
            <g id="author-nodes"></g>
            <g id="author-labels"></g>
          </g>
        </svg>
        <div class="empty-state" id="author-empty-state">
          <div class="empty-title">No recurring authors to display</div>
          <div class="empty-text">No OpenAlex author is associated with at least two eligible items.</div>
        </div>
      </div>
      <aside class="author-details" id="author-details" aria-live="polite"></aside>
    </div>
    <div class="tuning-panel" id="tuning-panel"></div>
    <div class="tooltip" id="node-tooltip"></div>
    <div class="empty-state" id="empty-state">
      <div class="empty-title" id="empty-title">No nodes to display</div>
      <div class="empty-text" id="empty-text"></div>
    </div>
  </div>

  <script>
    const data = ${payload};
    const physicsSettings = ${physicsPayload};
    const physicsFieldConfig = ${physicsFieldConfigPayload};
    const graphInteractionConstants = ${graphInteractionConstantsPayload};
    const buildGraphNodeFootprint = ${buildGraphNodeFootprintPayload};
    const getGraphCollisionDisplacement = ${getGraphCollisionDisplacementPayload};
    const getGraphCollisionVelocity = ${getGraphCollisionVelocityPayload};
    const graphLabelVisibilityChanged = ${graphLabelVisibilityChangedPayload};
    const buildCitationsPerYearOverlapOffsets = ${buildCitationsPerYearOverlapOffsetsPayload};
    const filterCitationsPerYearEdges = ${filterCitationsPerYearEdgesPayload};
    const buildCitationsPerYearLayout = ${buildCitationsPerYearLayoutPayload};
    const getAuthorMarkerRadius = ${getAuthorMarkerRadiusPayload};
    const getAuthorEdgeWidth = ${getAuthorEdgeWidthPayload};
    const buildAuthorGraphData = ${buildAuthorGraphDataPayload};
    const physicsFieldKeys = Object.keys(physicsFieldConfig);
    const showTuningControls = ${showTuningControlsPayload};
    const YEARLY_MARKER_RADIUS = 6;
    const NS = "http://www.w3.org/2000/svg";
    const collectionEl = document.getElementById("collection-name");
    const summaryBarEl = document.getElementById("summary-bar");
    const summaryEl = document.getElementById("summary");
    const svg = document.getElementById("graph");
    const viewport = document.getElementById("viewport");
    const edgesLayer = document.getElementById("edges");
    const nodesLayer = document.getElementById("nodes");
    const labelsLayer = document.getElementById("labels");
    const yearlyView = document.getElementById("yearly-view");
    const yearlyAxesLayer = document.getElementById("yearly-axes");
    const yearlyEdgesLayer = document.getElementById("yearly-edges");
    const yearlyNodesLayer = document.getElementById("yearly-nodes");
    const authorsView = document.getElementById("authors-view");
    const authorSvg = document.getElementById("author-graph");
    const authorViewport = document.getElementById("author-viewport");
    const authorEdgesLayer = document.getElementById("author-edges");
    const authorNodesLayer = document.getElementById("author-nodes");
    const authorLabelsLayer = document.getElementById("author-labels");
    const authorEmptyStateEl = document.getElementById("author-empty-state");
    const authorDetailsEl = document.getElementById("author-details");
    const graphShell = document.querySelector(".graph-shell");
    const tooltipEl = document.getElementById("node-tooltip");
    const emptyStateEl = document.getElementById("empty-state");
    const emptyTitleEl = document.getElementById("empty-title");
    const emptyTextEl = document.getElementById("empty-text");
    const tuningPanelEl = document.getElementById("tuning-panel");
    const regenerateButtonEl = document.getElementById("regenerate-button");
    const graphViewButtonEl = document.getElementById("view-graph-button");
    const yearViewButtonEl = document.getElementById("view-year-button");
    const authorsViewButtonEl = document.getElementById("view-authors-button");

    const safeNodes = Array.isArray(data && data.nodes) ? data.nodes : [];
    const safeEdges = Array.isArray(data && data.edges) ? data.edges : [];
    const authorGraph = buildAuthorGraphData(safeNodes);

    const settings = { ...physicsSettings };

    let activeView = "graph";
    let labelMode = "auto";
    let effectiveMaxRepulsionDistance = settings.maxRepulsionDistance;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function normalizeWheelDelta(event) {
      let deltaPixels = event.deltaY;

      if (event.deltaMode === graphInteractionConstants.wheelDeltaModeLine) {
        deltaPixels *= graphInteractionConstants.wheelDeltaLinePixels;
      } else if (event.deltaMode === graphInteractionConstants.wheelDeltaModePage) {
        const viewportHeight =
          activeView === "authors" ? authorSvg.clientHeight : svg.clientHeight;
        deltaPixels *= Math.max(1, viewportHeight);
      }

      return clamp(
        deltaPixels,
        -graphInteractionConstants.wheelDeltaMaxPixels,
        graphInteractionConstants.wheelDeltaMaxPixels,
      );
    }

    function applyStyleSettings() {
      const root = document.documentElement;
      root.style.setProperty("--graph-edge-width", settings.edgeWidth + "px");
      root.style.setProperty("--graph-edge-opacity", String(settings.edgeOpacity));
      root.style.setProperty("--graph-edge-highlight-width", settings.edgeHighlightWidth + "px");
      root.style.setProperty(
        "--graph-edge-highlight-opacity",
        String(settings.edgeHighlightOpacity),
      );
      root.style.setProperty("--graph-node-stroke-width", settings.nodeStrokeWidth + "px");
      root.style.setProperty("--graph-label-font-size", settings.labelFontSize + "px");
      root.style.setProperty("--graph-label-stroke-width", settings.labelStrokeWidth + "px");
      ensureArrowMarker();
    }

    function applyPhysicsToSettings(nextPhysics) {
      for (let i = 0; i < physicsFieldKeys.length; i++) {
        const key = physicsFieldKeys[i];
        const config = physicsFieldConfig[key];
        const rawValue = Number(nextPhysics && nextPhysics[key]);
        const currentValue = Number(settings[key]);
        const safeValue = Number.isFinite(rawValue) ? rawValue : currentValue;
        settings[key] = clamp(safeValue, config.min, config.max);
      }

      const isLargeGraph = safeNodes.length >= Math.round(settings.largeGraphNodeThreshold);
      const distanceFactor = isLargeGraph ? settings.largeGraphRepulsionDistanceFactor : 1;
      effectiveMaxRepulsionDistance = settings.maxRepulsionDistance * distanceFactor;
      labelMode =
        safeNodes.length >= Math.round(settings.hoverLabelNodeThreshold) ? "hover" : "auto";

      applyStyleSettings();
    }

    applyPhysicsToSettings(physicsSettings);

    function formatInputNumber(value, decimals) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return "0";
      }
      const scale = Math.pow(10, decimals);
      const rounded = Math.round(numeric * scale) / scale;
      return decimals > 0 ? rounded.toFixed(decimals) : String(Math.round(rounded));
    }

    function readPhysicsFromTuningPanel() {
      const nextPhysics = {};
      for (let i = 0; i < physicsFieldKeys.length; i++) {
        const key = physicsFieldKeys[i];
        const config = physicsFieldConfig[key];
        const input = document.getElementById("tuning-" + key);
        const parsed = Number.parseFloat(String(input && input.value ? input.value : ""));
        const fallback = Number(settings[key]);
        const safe = Number.isFinite(parsed) ? parsed : fallback;
        const clamped = clamp(safe, config.min, config.max);
        nextPhysics[key] = clamped;
        if (input) {
          input.value = formatInputNumber(clamped, config.decimals);
        }
      }
      return nextPhysics;
    }

    function persistPhysicsToPrefs(physics) {
      if (!window.Zotero || !window.Zotero.Prefs || typeof window.Zotero.Prefs.set !== "function") {
        return;
      }

      for (let i = 0; i < physicsFieldKeys.length; i++) {
        const key = physicsFieldKeys[i];
        const config = physicsFieldConfig[key];
        window.Zotero.Prefs.set(
          "extensions.zotero-openalex." + config.prefSuffix,
          Number(physics[key]),
          true,
        );
      }
    }

    function regenerateGraph() {
      if (activeView !== "graph") {
        return;
      }
      const nextPhysics = readPhysicsFromTuningPanel();
      applyPhysicsToSettings(nextPhysics);
      persistPhysicsToPrefs(nextPhysics);

      for (let i = 0; i < simNodes.length; i++) {
        refreshNodeLabelGeometry(simNodes[i]);
      }

      hoveredNodeID = null;
      setTooltipNode(null, 0, 0);
      reseedNodesForRegeneration();
      updateVisualFocus(false);
      renderFrame();

      alpha = 1;
      tickCount = 0;
      fittedAfterWarmup = false;
      restartSimulation(settings.regenerateAlpha);
    }

    function buildTuningPanel() {
      if (!tuningPanelEl) {
        return;
      }

      if (!showTuningControls || activeView !== "graph") {
        tuningPanelEl.style.display = "none";
        return;
      }

      tuningPanelEl.style.display = "block";
      clearChildren(tuningPanelEl);

      const titleEl = document.createElement("div");
      titleEl.className = "tuning-title";
      titleEl.textContent = "Graph tuning";
      tuningPanelEl.appendChild(titleEl);

      const gridEl = document.createElement("div");
      gridEl.className = "tuning-grid";

      for (let i = 0; i < physicsFieldKeys.length; i++) {
        const key = physicsFieldKeys[i];
        const config = physicsFieldConfig[key];
        const input = document.createElement("input");
        input.className = "tuning-input";
        input.id = "tuning-" + key;
        input.type = "number";
        input.min = String(config.min);
        input.max = String(config.max);
        input.step = String(config.step);
        input.value = formatInputNumber(settings[key], config.decimals);

        const label = document.createElement("div");
        label.className = "tuning-label";
        const labelTitle = document.createElement("div");
        labelTitle.className = "tuning-label-title";
        labelTitle.textContent = config.label;
        const labelDescription = document.createElement("div");
        labelDescription.className = "tuning-label-description";
        labelDescription.textContent = config.description;
        label.appendChild(labelTitle);
        label.appendChild(labelDescription);

        gridEl.appendChild(input);
        gridEl.appendChild(label);
      }

      tuningPanelEl.appendChild(gridEl);
    }

    if (regenerateButtonEl) {
      regenerateButtonEl.style.display = showTuningControls ? "" : "none";
      regenerateButtonEl.addEventListener("click", () => {
        regenerateGraph();
      });
    }

    function toNumber(value) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }

    function formatCount(value) {
      return typeof value === "number" ? String(value) : "n/a";
    }

    function formatText(value) {
      const text = String(value || "").trim();
      return text || "n/a";
    }

    function normalizeLabel(value) {
      return String(value || "")
        .replace(/[-‐‑‒–—―−]+/g, " ")
        .replace(/ +/g, " ")
        .trim();
    }

    function formatNodeDisplayLabel(node) {
      const base = normalizeLabel(node.label);
      if (typeof node.year === "number") {
        return "[" + node.year + "] " + base;
      }
      return base || "Untitled";
    }

    function clearChildren(el) {
      if (!el) {
        return;
      }
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    function addSummaryPill(label, value) {
      if (!summaryEl) {
        return;
      }
      const span = document.createElement("span");
      span.className = "summary-pill";
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = String(value);
      span.appendChild(strong);
      summaryEl.appendChild(span);
    }

    if (collectionEl) {
      collectionEl.textContent = String((data && data.collectionName) || "Collection");
    }

    const nodeByID = new Map();
    const adjacency = new Map();
    const inDegreeByID = new Map();
    const outDegreeByID = new Map();
    const simNodes = [];
    const simEdges = [];

    for (let i = 0; i < safeNodes.length; i++) {
      const node = safeNodes[i];
      const simNode = {
        id: String(node.id),
        itemID: node.itemID,
        workID: String(node.workID || ""),
        label: String(node.label || ""),
        citationCount: toNumber(node.citationCount),
        referencesCount: toNumber(node.referencesCount),
        year: toNumber(node.year),
        publisher: node.publisher,
        firstAuthor: node.firstAuthor,
        lastAuthor: node.lastAuthor,
        publicationDate: node.publicationDate,
        collectionPaths: Array.isArray(node.collectionPaths) ? node.collectionPaths.slice() : [],
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 5,
        degree: 0,
        inDegree: 0,
        outDegree: 0,
        initialX: 0,
        initialY: 0,
        fixed: false,
        circleEl: null,
        yearlyCircleEl: null,
        yearlyX: 0,
        yearlyY: 0,
        labelEl: null,
        labelBounds: null,
        labelLines: [],
        labelVisible: false,
      };
      nodeByID.set(simNode.id, simNode);
      adjacency.set(simNode.id, new Set());
      inDegreeByID.set(simNode.id, 0);
      outDegreeByID.set(simNode.id, 0);
      simNodes.push(simNode);
    }

    for (let i = 0; i < safeEdges.length; i++) {
      const edge = safeEdges[i];
      const source = nodeByID.get(String(edge.source));
      const target = nodeByID.get(String(edge.target));
      if (!source || !target || source === target) {
        continue;
      }
      simEdges.push({
        source,
        target,
        lineEl: null,
      });
      adjacency.get(source.id).add(target.id);
      adjacency.get(target.id).add(source.id);
      outDegreeByID.set(source.id, outDegreeByID.get(source.id) + 1);
      inDegreeByID.set(target.id, inDegreeByID.get(target.id) + 1);
    }

    for (let i = 0; i < simNodes.length; i++) {
      const node = simNodes[i];
      node.inDegree = inDegreeByID.get(node.id) || 0;
      node.outDegree = outDegreeByID.get(node.id) || 0;
      node.degree = node.inDegree + node.outDegree;
      const citationScale = Math.log10((node.citationCount || 0) + 1);
      const degreeScale = Math.sqrt(node.degree || 0);
      node.radius = clamp(
        (
          settings.nodeRadiusBase +
          citationScale * settings.nodeRadiusCitationFactor +
          degreeScale * settings.nodeRadiusDegreeFactor
        ) * settings.nodeSizeMultiplier,
        settings.nodeRadiusMin,
        settings.nodeRadiusMax,
      );
    }

    const yearlyNodes = simNodes.filter(
      (node) =>
        typeof node.year === "number" &&
        Number.isFinite(node.year) &&
        typeof node.citationCount === "number" &&
        Number.isFinite(node.citationCount),
    );
    const yearlyEdgeInputs = filterCitationsPerYearEdges(safeNodes, safeEdges);
    const yearlyEdges = [];
    for (let i = 0; i < yearlyEdgeInputs.length; i++) {
      const edge = yearlyEdgeInputs[i];
      const source = nodeByID.get(String(edge.source));
      const target = nodeByID.get(String(edge.target));
      if (source && target && source !== target) {
        yearlyEdges.push({ source, target, lineEl: null });
      }
    }

    const authorNodeByID = new Map();
    const authorNodes = authorGraph.nodes.map((node, index) => {
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const placementRadius = 22 * Math.sqrt(index);
      const simNode = {
        ...node,
        x: Math.cos(angle) * placementRadius,
        y: Math.sin(angle) * placementRadius,
        vx: 0,
        vy: 0,
        fixed: false,
        circleEl: null,
        labelEl: null,
        labelBounds: null,
      };
      authorNodeByID.set(node.id, simNode);
      return simNode;
    });
    const authorEdges = authorGraph.edges
      .map((edge) => ({
        ...edge,
        source: authorNodeByID.get(edge.source),
        target: authorNodeByID.get(edge.target),
        lineEl: null,
      }))
      .filter((edge) => edge.source && edge.target && edge.source !== edge.target);
    const authorNeighborsByID = new Map();
    for (let i = 0; i < authorNodes.length; i++) {
      authorNeighborsByID.set(authorNodes[i].id, new Set());
    }
    for (let i = 0; i < authorEdges.length; i++) {
      const edge = authorEdges[i];
      authorNeighborsByID.get(edge.source.id).add(edge.target.id);
      authorNeighborsByID.get(edge.target.id).add(edge.source.id);
    }

    let authorComponentIndex = 0;
    for (let i = 0; i < authorNodes.length; i++) {
      const root = authorNodes[i];
      if (typeof root.componentIndex === "number") continue;
      const pendingAuthorIDs = [root.id];
      root.componentIndex = authorComponentIndex;
      while (pendingAuthorIDs.length) {
        const authorID = pendingAuthorIDs.pop();
        const neighborIDs = authorNeighborsByID.get(authorID) || new Set();
        for (const neighborID of neighborIDs) {
          const neighbor = authorNodeByID.get(neighborID);
          if (!neighbor || typeof neighbor.componentIndex === "number") continue;
          neighbor.componentIndex = authorComponentIndex;
          pendingAuthorIDs.push(neighbor.id);
        }
      }
      authorComponentIndex += 1;
    }

    function renderSummary() {
      if (!summaryBarEl) {
        return;
      }

      summaryBarEl.style.display = "";
      clearChildren(summaryEl);
      if (activeView === "authors") {
        addSummaryPill("Authors", authorNodes.length);
        addSummaryPill("Coauthor links", authorEdges.length);
        addSummaryPill("Publications", authorGraph.publicationCount);
      } else if (activeView === "year") {
        addSummaryPill("Markers", yearlyNodes.length);
        addSummaryPill("Visible edges", yearlyEdges.length);
        addSummaryPill("Omitted (missing plot data)", safeNodes.length - yearlyNodes.length);
      } else {
        addSummaryPill("Nodes", safeNodes.length);
        addSummaryPill("Edges", safeEdges.length);
      }
      addSummaryPill("Skipped (missing work_id)", (data && data.skippedMissingWorkID) || 0);
      addSummaryPill("Fetch failures", (data && data.fetchFailures) || 0);
    }

    function degreeChargeScale(node) {
      if (node.degree === 0) {
        return settings.isolatedChargeBoost;
      }
      if (node.degree === 1) {
        return settings.leafChargeBoost;
      }
      return 1;
    }

    function stableAngleFromID(id) {
      let hash = 2166136261;
      const text = String(id || "");
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return ((hash >>> 0) / 4294967295) * Math.PI * 2;
    }

    const isolatedNodes = simNodes.filter((node) => node.degree === 0);
    const hasConnectedNodes = simNodes.some((node) => node.degree > 0);
    const isolatedRingRadius =
      settings.isolatedRingBaseRadius +
      settings.isolatedRingNodeCountScale * Math.sqrt(Math.max(1, simNodes.length));

    const placementNodes = simNodes.slice().sort((a, b) => {
      if (b.degree !== a.degree) {
        return b.degree - a.degree;
      }
      const aCitation = typeof a.citationCount === "number" ? a.citationCount : -1;
      const bCitation = typeof b.citationCount === "number" ? b.citationCount : -1;
      if (bCitation !== aCitation) {
        return bCitation - aCitation;
      }
      const labelA = String(a.label || "");
      const labelB = String(b.label || "");
      return labelA.localeCompare(labelB);
    });

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < placementNodes.length; i++) {
      const node = placementNodes[i];
      const radius = settings.initialPlacementRadiusScale * Math.sqrt(i);
      const angle = i * goldenAngle;
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
    }

    if (isolatedNodes.length && hasConnectedNodes) {
      const orderedIsolated = isolatedNodes.slice().sort((a, b) => a.id.localeCompare(b.id));
      const ringCount = orderedIsolated.length;
      for (let i = 0; i < ringCount; i++) {
        const node = orderedIsolated[i];
        const angle =
          (Math.PI * 2 * i) / Math.max(1, ringCount) + settings.isolatedRingPhaseOffset;
        const jitter = ((i % 5) - 2) * settings.isolatedRingJitterAmplitude;
        const targetRadius = isolatedRingRadius + jitter;
        node.isolatedAngle = angle;
        node.isolatedTargetRadius = targetRadius;
        node.x = Math.cos(angle) * targetRadius;
        node.y = Math.sin(angle) * targetRadius;
        node.vx = 0;
        node.vy = 0;
      }
    }

    for (let i = 0; i < simNodes.length; i++) {
      simNodes[i].initialX = simNodes[i].x;
      simNodes[i].initialY = simNodes[i].y;
    }

    const topLabelNodeIDs = new Set();
    const topLabelCount = clamp(
      Math.round(Math.sqrt(simNodes.length) * settings.topLabelCountMultiplier),
      settings.topLabelCountMin,
      settings.topLabelCountMax,
    );
    for (let i = 0; i < placementNodes.length && i < topLabelCount; i++) {
      topLabelNodeIDs.add(placementNodes[i].id);
    }

    function ensureArrowMarker() {
      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(NS, "defs");
        svg.insertBefore(defs, svg.firstChild);
      }

      function ensureMarker(id, fillColor) {
        let marker = defs.querySelector("#" + id);
        if (!marker) {
          marker = document.createElementNS(NS, "marker");
          marker.setAttribute("id", id);
          defs.appendChild(marker);
        }
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", String(settings.arrowRefX));
        marker.setAttribute("refY", String(settings.arrowRefY));
        marker.setAttribute("markerWidth", String(settings.arrowMarkerWidth));
        marker.setAttribute("markerHeight", String(settings.arrowMarkerHeight));
        marker.setAttribute("orient", "auto");

        let path = marker.querySelector("path");
        if (!path) {
          path = document.createElementNS(NS, "path");
          marker.appendChild(path);
        }
        path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
        path.setAttribute("fill", fillColor);
        path.setAttribute("fill-opacity", String(settings.arrowOpacity));
      }

      ensureMarker("arrowhead", "#7f99b6");
      ensureMarker("arrowhead-parent", "#99f0ae");
      ensureMarker("arrowhead-child", "#ffd4a6");
    }

    function setTooltipNode(node, clientX, clientY) {
      if (!tooltipEl || !graphShell) {
        return;
      }

      const isYearlyTooltip = activeView === "year";
      tooltipEl.classList.toggle("yearly-docked", isYearlyTooltip);

      if (!node) {
        tooltipEl.style.display = "none";
        return;
      }

      clearChildren(tooltipEl);
      const title = document.createElement("div");
      title.className = "tooltip-title";
      title.textContent = formatNodeDisplayLabel(node);
      tooltipEl.appendChild(title);

      const rows = [
        "Citations: " + formatCount(node.citationCount),
        "References: " + formatCount(node.referencesCount),
        "In-degree: " + node.inDegree + " | Out-degree: " + node.outDegree,
        "First author: " + formatText(node.firstAuthor),
        "Last author: " + formatText(node.lastAuthor),
        "Publisher: " + formatText(node.publisher),
        "Publication date: " + formatText(node.publicationDate),
        "WorkID: " + formatText(node.workID),
      ];

      for (let i = 0; i < rows.length; i++) {
        const rowEl = document.createElement("div");
        rowEl.className = "tooltip-row";
        rowEl.textContent = rows[i];
        tooltipEl.appendChild(rowEl);
      }

      tooltipEl.style.display = "block";

      if (isYearlyTooltip) {
        tooltipEl.style.left = "auto";
        tooltipEl.style.right = "10px";
        tooltipEl.style.top = "10px";
        return;
      }

      tooltipEl.style.right = "";

      const shellRect = graphShell.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const targetX = clientX - shellRect.left + settings.tooltipOffset;
      const targetY = clientY - shellRect.top + settings.tooltipOffset;
      const clampedX = clamp(
        targetX,
        settings.tooltipMargin,
        Math.max(
          settings.tooltipMargin,
          shellRect.width - tooltipRect.width - settings.tooltipMargin,
        ),
      );
      const clampedY = clamp(
        targetY,
        settings.tooltipMargin,
        Math.max(
          settings.tooltipMargin,
          shellRect.height - tooltipRect.height - settings.tooltipMargin,
        ),
      );
      tooltipEl.style.left = clampedX + "px";
      tooltipEl.style.top = clampedY + "px";
    }

    function splitLabelLines(text, maxChars, maxLines) {
      const safe = String(text || "")
        .replace(/ +/g, " ")
        .trim();
      if (!safe) {
        return [""];
      }

      const words = safe.split(" ").filter(Boolean);
      const lines = [];
      let current = "";
      let index = 0;

      while (index < words.length) {
        const word = words[index];
        const candidate = current ? current + " " + word : word;
        if (!current || candidate.length <= maxChars) {
          current = candidate;
          index += 1;
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

      if (index < words.length && lines.length) {
        lines[lines.length - 1] = lines[lines.length - 1] + "...";
      }

      return lines;
    }

    function populateNodeLabel(node, textEl) {
      clearChildren(textEl);
      const lines = splitLabelLines(
        formatNodeDisplayLabel(node),
        Math.max(1, Math.round(settings.labelMaxCharsPerLine)),
        Math.max(1, Math.round(settings.labelMaxLines)),
      );
      node.labelLines = lines;

      for (let i = 0; i < lines.length; i++) {
        const tspan = document.createElementNS(NS, "tspan");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("dy", i === 0 ? "0" : String(settings.labelLineHeight));
        tspan.textContent = lines[i];
        textEl.appendChild(tspan);
      }
    }

    function createNodeLabel(node) {
      const textEl = document.createElementNS(NS, "text");
      textEl.setAttribute("class", "node-label");
      populateNodeLabel(node, textEl);

      return textEl;
    }

    function createAuthorLabel(node) {
      const textEl = document.createElementNS(NS, "text");
      textEl.setAttribute("class", "node-label author-label");
      const lines = splitLabelLines(node.name, 28, 2);
      node.labelLines = lines;
      for (let i = 0; i < lines.length; i++) {
        const tspan = document.createElementNS(NS, "tspan");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("dy", i === 0 ? "0" : String(settings.labelLineHeight));
        tspan.textContent = lines[i];
        textEl.appendChild(tspan);
      }
      return textEl;
    }

    function estimateNodeLabelBounds(node) {
      const lines = Array.isArray(node.labelLines) ? node.labelLines : [];
      let longestLineLength = 0;
      for (let i = 0; i < lines.length; i++) {
        longestLineLength = Math.max(longestLineLength, String(lines[i]).length);
      }

      const lineCount = Math.max(1, lines.length);
      const width = Math.max(1, longestLineLength * settings.labelFontSize * 0.6);
      const height =
        settings.labelFontSize + Math.max(0, lineCount - 1) * settings.labelLineHeight;
      return {
        x: 0,
        y: -settings.labelFontSize * 0.8,
        width,
        height,
      };
    }

    function measureNodeLabel(node) {
      if (!node.labelEl) {
        node.labelBounds = estimateNodeLabelBounds(node);
        return;
      }

      const previousDisplay = node.labelEl.style.display;
      const previousTransform = node.labelEl.getAttribute("transform");
      node.labelEl.style.display = "";
      node.labelEl.removeAttribute("transform");

      try {
        const bounds = node.labelEl.getBBox();
        if (
          Number.isFinite(bounds.x) &&
          Number.isFinite(bounds.y) &&
          Number.isFinite(bounds.width) &&
          Number.isFinite(bounds.height) &&
          bounds.width > 0 &&
          bounds.height > 0
        ) {
          node.labelBounds = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
        } else {
          node.labelBounds = estimateNodeLabelBounds(node);
        }
      } catch (_error) {
        node.labelBounds = estimateNodeLabelBounds(node);
      }

      if (previousTransform === null) {
        node.labelEl.removeAttribute("transform");
      } else {
        node.labelEl.setAttribute("transform", previousTransform);
      }
      node.labelEl.style.display = previousDisplay;
    }

    function refreshNodeLabelGeometry(node) {
      if (!node.labelEl) {
        return;
      }
      populateNodeLabel(node, node.labelEl);
      measureNodeLabel(node);
      updateNodeScreenPosition(node);
    }

    function nodeFootprint(node) {
      return buildGraphNodeFootprint(
        node.x,
        node.y,
        node.radius,
        node.labelBounds,
        node.labelVisible,
        settings.labelOffsetX,
        settings.labelOffsetY,
        settings.labelStrokeWidth / 2,
      );
    }

    function updateNodeScreenPosition(node) {
      if (node.circleEl) {
        node.circleEl.setAttribute("cx", String(node.x));
        node.circleEl.setAttribute("cy", String(node.y));
        node.circleEl.setAttribute("r", String(node.radius));
      }
      if (node.labelEl) {
        node.labelEl.setAttribute(
          "transform",
          "translate(" +
            (node.x + node.radius + settings.labelOffsetX) +
            " " +
            (node.y + settings.labelOffsetY) +
            ")",
        );
      }
    }

    function updateDirectedEdgeElement(
      lineEl,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePadding,
      targetPadding,
    ) {
      let dx = targetX - sourceX;
      let dy = targetY - sourceY;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (!dist) {
        dist = 1;
        dx = 1;
        dy = 0;
      }

      const ux = dx / dist;
      const uy = dy / dist;

      const x1 = sourceX + ux * sourcePadding;
      const y1 = sourceY + uy * sourcePadding;
      const x2 = targetX - ux * targetPadding;
      const y2 = targetY - uy * targetPadding;

      lineEl.setAttribute("x1", String(x1));
      lineEl.setAttribute("y1", String(y1));
      lineEl.setAttribute("x2", String(x2));
      lineEl.setAttribute("y2", String(y2));
    }

    function updateEdgeScreenPosition(edge) {
      updateDirectedEdgeElement(
        edge.lineEl,
        edge.source.x,
        edge.source.y,
        edge.target.x,
        edge.target.y,
        edge.source.radius + settings.edgeSourcePadding,
        edge.target.radius + settings.edgeTargetPadding,
      );
    }

    function updateYearlyEdgeScreenPosition(edge) {
      updateDirectedEdgeElement(
        edge.lineEl,
        edge.source.yearlyX,
        edge.source.yearlyY,
        edge.target.yearlyX,
        edge.target.yearlyY,
        0,
        0,
      );
    }

    function authorNodeFootprint(node) {
      return buildGraphNodeFootprint(
        node.x,
        node.y,
        node.radius,
        node.labelBounds,
        true,
        settings.labelOffsetX,
        settings.labelOffsetY,
        settings.labelStrokeWidth / 2,
      );
    }

    function updateAuthorNodeScreenPosition(node) {
      if (node.circleEl) {
        node.circleEl.setAttribute("cx", String(node.x));
        node.circleEl.setAttribute("cy", String(node.y));
        node.circleEl.setAttribute("r", String(node.radius));
      }
      if (node.labelEl) {
        node.labelEl.setAttribute(
          "transform",
          "translate(" +
            (node.x + node.radius + settings.labelOffsetX) +
            " " +
            (node.y + settings.labelOffsetY) +
            ")",
        );
      }
    }

    function updateAuthorEdgeScreenPosition(edge) {
      updateDirectedEdgeElement(
        edge.lineEl,
        edge.source.x,
        edge.source.y,
        edge.target.x,
        edge.target.y,
        0,
        0,
      );
    }

    ensureArrowMarker();
    clearChildren(edgesLayer);
    clearChildren(nodesLayer);
    clearChildren(labelsLayer);
    clearChildren(yearlyAxesLayer);
    clearChildren(yearlyEdgesLayer);
    clearChildren(yearlyNodesLayer);
    clearChildren(authorEdgesLayer);
    clearChildren(authorNodesLayer);
    clearChildren(authorLabelsLayer);

    for (let i = 0; i < simEdges.length; i++) {
      const edge = simEdges[i];
      const lineEl = document.createElementNS(NS, "line");
      lineEl.setAttribute("class", "edge");
      edge.lineEl = lineEl;
      edgesLayer.appendChild(lineEl);
    }

    for (let i = 0; i < simNodes.length; i++) {
      const node = simNodes[i];
      const circleEl = document.createElementNS(NS, "circle");
      circleEl.setAttribute("class", "node");
      circleEl.style.cursor = "pointer";
      const titleEl = document.createElementNS(NS, "title");
      titleEl.textContent = formatNodeDisplayLabel(node) + "\\n" + formatText(node.workID);
      circleEl.appendChild(titleEl);

      const labelEl = createNodeLabel(node);

      node.circleEl = circleEl;
      node.labelEl = labelEl;
      updateNodeScreenPosition(node);

      nodesLayer.appendChild(circleEl);
      labelsLayer.appendChild(labelEl);
      measureNodeLabel(node);
    }

    for (let i = 0; i < yearlyEdges.length; i++) {
      const edge = yearlyEdges[i];
      const lineEl = document.createElementNS(NS, "line");
      lineEl.setAttribute("class", "edge yearly-edge");
      edge.lineEl = lineEl;
      yearlyEdgesLayer.appendChild(lineEl);
    }

    for (let i = 0; i < yearlyNodes.length; i++) {
      const node = yearlyNodes[i];
      const circleEl = document.createElementNS(NS, "circle");
      circleEl.setAttribute("class", "node");
      circleEl.setAttribute("r", String(YEARLY_MARKER_RADIUS));
      circleEl.style.cursor = "pointer";
      const titleEl = document.createElementNS(NS, "title");
      titleEl.textContent = formatNodeDisplayLabel(node) + "\\n" + formatText(node.workID);
      circleEl.appendChild(titleEl);
      node.yearlyCircleEl = circleEl;
      yearlyNodesLayer.appendChild(circleEl);
    }

    for (let i = 0; i < authorEdges.length; i++) {
      const edge = authorEdges[i];
      const lineEl = document.createElementNS(NS, "line");
      lineEl.setAttribute("class", "edge author-edge");
      lineEl.style.strokeWidth = edge.width + "px";
      edge.lineEl = lineEl;
      authorEdgesLayer.appendChild(lineEl);
    }

    for (let i = 0; i < authorNodes.length; i++) {
      const node = authorNodes[i];
      const circleEl = document.createElementNS(NS, "circle");
      circleEl.setAttribute("class", "node author-node");
      circleEl.style.cursor = "pointer";
      const titleEl = document.createElementNS(NS, "title");
      titleEl.textContent = node.name + "\\n" + node.itemCount + " publications";
      circleEl.appendChild(titleEl);
      const labelEl = createAuthorLabel(node);
      node.circleEl = circleEl;
      node.labelEl = labelEl;
      updateAuthorNodeScreenPosition(node);
      authorNodesLayer.appendChild(circleEl);
      authorLabelsLayer.appendChild(labelEl);
      measureNodeLabel(node);
    }

    const transform = { x: 0, y: 0, k: 1 };

    function viewportSize() {
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
    }

    const authorTransform = { x: 0, y: 0, k: 1 };
    let authorTransformInitialized = false;
    let selectedAuthorID = null;
    let hoveredAuthorID = null;

    function authorViewportSize() {
      const rect = authorSvg.getBoundingClientRect();
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
    }

    function applyAuthorTransform() {
      authorViewport.setAttribute(
        "transform",
        "translate(" +
          authorTransform.x +
          " " +
          authorTransform.y +
          ") scale(" +
          authorTransform.k +
          ")",
      );
    }

    function renderAuthorFrame() {
      for (let i = 0; i < authorEdges.length; i++) {
        updateAuthorEdgeScreenPosition(authorEdges[i]);
      }
      for (let i = 0; i < authorNodes.length; i++) {
        updateAuthorNodeScreenPosition(authorNodes[i]);
      }
    }

    function fitAuthorGraph(padding) {
      const size = authorViewportSize();
      if (!authorNodes.length) {
        authorTransform.x = size.width / 2;
        authorTransform.y = size.height / 2;
        authorTransform.k = 1;
        authorTransformInitialized = true;
        applyAuthorTransform();
        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < authorNodes.length; i++) {
        const footprint = authorNodeFootprint(authorNodes[i]);
        minX = Math.min(minX, footprint.minX);
        maxX = Math.max(maxX, footprint.maxX);
        minY = Math.min(minY, footprint.minY);
        maxY = Math.max(maxY, footprint.maxY);
      }

      const safePadding = typeof padding === "number" ? padding : settings.fitPadding;
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const scale = clamp(
        Math.min(
          (size.width - safePadding * 2) / graphWidth,
          (size.height - safePadding * 2) / graphHeight,
        ),
        settings.fitScaleMin,
        settings.fitScaleMax,
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      authorTransform.k = scale;
      authorTransform.x = size.width / 2 - centerX * scale;
      authorTransform.y = size.height / 2 - centerY * scale;
      authorTransformInitialized = true;
      applyAuthorTransform();
    }

    function renderAuthorDetails() {
      clearChildren(authorDetailsEl);
      authorDetailsEl.classList.remove("has-selection");
      const node = selectedAuthorID ? authorNodeByID.get(selectedAuthorID) : null;
      if (!node) {
        return;
      }

      authorDetailsEl.classList.add("has-selection");
      const titleEl = document.createElement("div");
      titleEl.className = "author-details-title";
      titleEl.textContent = node.name;
      authorDetailsEl.appendChild(titleEl);

      const countEl = document.createElement("div");
      countEl.className = "author-details-count";
      countEl.textContent = node.itemCount + (node.itemCount === 1 ? " publication" : " publications");
      authorDetailsEl.appendChild(countEl);

      const listEl = document.createElement("ol");
      listEl.className = "author-publications";
      for (let i = 0; i < node.publications.length; i++) {
        const publication = node.publications[i];
        const itemEl = document.createElement("li");
        itemEl.textContent =
          (typeof publication.year === "number" ? "[" + publication.year + "] " : "") +
          publication.title;
        listEl.appendChild(itemEl);
      }
      authorDetailsEl.appendChild(listEl);
    }

    function selectAuthor(authorID) {
      selectedAuthorID = authorID && authorNodeByID.has(authorID) ? authorID : null;
      for (let i = 0; i < authorNodes.length; i++) {
        const node = authorNodes[i];
        if (node.circleEl) {
          node.circleEl.classList.toggle("selected", node.id === selectedAuthorID);
        }
      }
      renderAuthorDetails();
    }

    function updateAuthorVisualFocus() {
      const coauthorIDs = hoveredAuthorID
        ? authorNeighborsByID.get(hoveredAuthorID) || new Set()
        : new Set();
      for (let i = 0; i < authorEdges.length; i++) {
        const edge = authorEdges[i];
        const isConnected =
          !!hoveredAuthorID &&
          (edge.source.id === hoveredAuthorID || edge.target.id === hoveredAuthorID);
        if (edge.lineEl) {
          edge.lineEl.classList.toggle("hover-connected", isConnected);
        }
      }

      for (let i = 0; i < authorNodes.length; i++) {
        const node = authorNodes[i];
        const isFocus = node.id === hoveredAuthorID;
        const isCoauthor = !isFocus && coauthorIDs.has(node.id);
        if (node.circleEl) {
          node.circleEl.classList.toggle("hover-focus", isFocus);
          node.circleEl.classList.toggle("hover-coauthor", isCoauthor);
        }
        if (node.labelEl) {
          node.labelEl.classList.toggle("hover-focus", isFocus);
          node.labelEl.classList.toggle("hover-coauthor", isCoauthor);
        }
      }
    }

    function setHoveredAuthor(authorID) {
      hoveredAuthorID = authorID && authorNodeByID.has(authorID) ? authorID : null;
      updateAuthorVisualFocus();
    }

    function appendSvgLine(parent, className, x1, y1, x2, y2) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", className);
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      parent.appendChild(line);
      return line;
    }

    function appendSvgText(parent, className, text, x, y, anchor) {
      const textEl = document.createElementNS(NS, "text");
      textEl.setAttribute("class", className);
      textEl.setAttribute("x", String(x));
      textEl.setAttribute("y", String(y));
      textEl.setAttribute("text-anchor", anchor || "middle");
      textEl.textContent = String(text);
      parent.appendChild(textEl);
      return textEl;
    }

    function buildIntegerTicks(minValue, maxValue, targetCount) {
      if (minValue === maxValue) {
        return [Math.round(minValue)];
      }

      const count = Math.max(1, Math.floor(targetCount));
      const ticks = [];
      for (let i = 0; i <= count; i++) {
        const value = Math.round(minValue + ((maxValue - minValue) * i) / count);
        if (!ticks.length || ticks[ticks.length - 1] !== value) {
          ticks.push(value);
        }
      }
      return ticks;
    }

    function renderYearlyPlot() {
      const size = viewportSize();
      const detailsWidth = Math.min(
        320,
        Math.max(180, size.width * 0.3),
        size.width * 0.42,
      );
      graphShell.style.setProperty("--yearly-details-width", detailsWidth + "px");
      const layout = buildCitationsPerYearLayout(
        yearlyNodes,
        size.width,
        size.height,
        YEARLY_MARKER_RADIUS,
        detailsWidth,
      );
      const pointByID = new Map();
      for (let i = 0; i < layout.points.length; i++) {
        pointByID.set(layout.points[i].id, layout.points[i]);
      }

      for (let i = 0; i < yearlyNodes.length; i++) {
        const node = yearlyNodes[i];
        const point = pointByID.get(node.id);
        if (!point || !node.yearlyCircleEl) {
          continue;
        }
        node.yearlyX = point.x;
        node.yearlyY = point.y;
        node.yearlyCircleEl.setAttribute("cx", String(point.x));
        node.yearlyCircleEl.setAttribute("cy", String(point.y));
      }

      for (let i = 0; i < yearlyEdges.length; i++) {
        updateYearlyEdgeScreenPosition(yearlyEdges[i]);
      }

      clearChildren(yearlyAxesLayer);
      if (!layout.points.length) {
        return;
      }

      appendSvgLine(
        yearlyAxesLayer,
        "plot-axis",
        layout.plotLeft,
        layout.plotBottom,
        layout.plotRight,
        layout.plotBottom,
      );
      appendSvgLine(
        yearlyAxesLayer,
        "plot-axis",
        layout.plotLeft,
        layout.plotTop,
        layout.plotLeft,
        layout.plotBottom,
      );

      const yearTickCount = Math.max(1, Math.floor((layout.plotRight - layout.plotLeft) / 90));
      const yearTicks = buildIntegerTicks(layout.minYear, layout.maxYear, yearTickCount);
      for (let i = 0; i < yearTicks.length; i++) {
        const year = yearTicks[i];
        const x =
          layout.minYear === layout.maxYear
            ? (layout.plotLeft + layout.plotRight) / 2
            : layout.plotLeft +
              ((year - layout.minYear) / (layout.maxYear - layout.minYear)) *
                (layout.plotRight - layout.plotLeft);
        appendSvgLine(
          yearlyAxesLayer,
          "plot-grid",
          x,
          layout.plotTop,
          x,
          layout.plotBottom,
        );
        appendSvgText(
          yearlyAxesLayer,
          "plot-tick-label",
          year,
          x,
          layout.plotBottom + 17,
          "middle",
        );
      }

      const citationTickCount = Math.max(
        1,
        Math.floor((layout.plotBottom - layout.plotTop) / 58),
      );
      const citationTicks = buildIntegerTicks(0, layout.maxCitationCount, citationTickCount);
      for (let i = 0; i < citationTicks.length; i++) {
        const citationCount = citationTicks[i];
        const y =
          layout.maxCitationCount <= 0
            ? layout.plotBottom
            : layout.plotBottom -
              (citationCount / layout.maxCitationCount) *
                (layout.plotBottom - layout.plotTop);
        appendSvgLine(
          yearlyAxesLayer,
          "plot-grid",
          layout.plotLeft,
          y,
          layout.plotRight,
          y,
        );
        appendSvgText(
          yearlyAxesLayer,
          "plot-tick-label",
          citationCount,
          layout.plotLeft - 9,
          y + 3,
          "end",
        );
      }

      appendSvgText(
        yearlyAxesLayer,
        "plot-axis-title",
        "Year of publication",
        (layout.plotLeft + layout.plotRight) / 2,
        size.height - 13,
        "middle",
      );
      const yTitle = appendSvgText(
        yearlyAxesLayer,
        "plot-axis-title",
        "Number of citations",
        15,
        (layout.plotTop + layout.plotBottom) / 2,
        "middle",
      );
      yTitle.setAttribute(
        "transform",
        "rotate(-90 15 " + (layout.plotTop + layout.plotBottom) / 2 + ")",
      );
    }

    function applyTransform() {
      viewport.setAttribute(
        "transform",
        "translate(" + transform.x + " " + transform.y + ") scale(" + transform.k + ")",
      );
    }

    function resetView() {
      const size = viewportSize();
      transform.x = size.width / 2;
      transform.y = size.height / 2;
      transform.k = 1;
      applyTransform();
      updateLabelVisibility();
    }

    function fitGraph(padding) {
      const pad = typeof padding === "number" ? padding : settings.fitPadding;
      if (!simNodes.length) {
        resetView();
        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < simNodes.length; i++) {
        const footprint = nodeFootprint(simNodes[i]);
        minX = Math.min(minX, footprint.minX);
        maxX = Math.max(maxX, footprint.maxX);
        minY = Math.min(minY, footprint.minY);
        maxY = Math.max(maxY, footprint.maxY);
      }

      const size = viewportSize();
      const graphW = Math.max(1, maxX - minX);
      const graphH = Math.max(1, maxY - minY);
      const scaleX = (size.width - pad * 2) / graphW;
      const scaleY = (size.height - pad * 2) / graphH;
      const scale = clamp(Math.min(scaleX, scaleY), settings.fitScaleMin, settings.fitScaleMax);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      transform.k = scale;
      transform.x = size.width / 2 - centerX * scale;
      transform.y = size.height / 2 - centerY * scale;
      applyTransform();
      updateLabelVisibility();
    }

    function localPointToWorld(localX, localY) {
      return {
        x: (localX - transform.x) / transform.k,
        y: (localY - transform.y) / transform.k,
      };
    }

    function clientPointToLocal(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }

    let hoveredNodeID = null;
    let dragState = null;
    let panState = null;

    function activeFocusNodeID() {
      return hoveredNodeID;
    }

    function isNodeAnchored(node) {
      return node.fixed || hoveredNodeID === node.id;
    }

    function directionalNeighborSets(focusID) {
      const parentSet = new Set();
      const childSet = new Set();

      if (!focusID) {
        return { parentSet, childSet };
      }

      const focusEdges = activeView === "year" ? yearlyEdges : simEdges;
      for (let i = 0; i < focusEdges.length; i++) {
        const edge = focusEdges[i];
        if (edge.target.id === focusID) {
          parentSet.add(edge.source.id);
        }
        if (edge.source.id === focusID) {
          childSet.add(edge.target.id);
        }
      }

      return { parentSet, childSet };
    }

    function activeLabelSet() {
      const set = new Set();
      const focusID = activeFocusNodeID();
      if (focusID) {
        set.add(focusID);
        const { parentSet, childSet } = directionalNeighborSets(focusID);
        for (const parentID of parentSet) {
          set.add(parentID);
        }
        for (const childID of childSet) {
          set.add(childID);
        }
      }
      return set;
    }

    function updateLabelVisibility(reheatOnChange) {
      const labelsForFocus = activeLabelSet();
      const mode = labelMode;
      const alwaysShow =
        mode === "always" ||
        (mode === "auto" &&
          simNodes.length <= Math.round(settings.alwaysShowLabelNodeThreshold));
      let changed = false;

      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (!node.labelEl) {
          continue;
        }

        let visible = false;
        if (activeView !== "graph") {
          visible = false;
        } else if (alwaysShow) {
          visible = true;
        } else if (mode === "hover") {
          visible = labelsForFocus.has(node.id);
        } else {
          visible =
            labelsForFocus.has(node.id) ||
            (topLabelNodeIDs.has(node.id) && transform.k > settings.labelVisibilityZoomThreshold);
        }

        if (graphLabelVisibilityChanged(node.labelVisible, visible)) {
          node.labelVisible = visible;
          changed = true;
        }
        node.labelEl.style.display = visible ? "" : "none";
      }

      if (changed && reheatOnChange) {
        restartSimulation(graphInteractionConstants.labelVisibilityAlpha);
      }

      return changed;
    }

    function updateVisualFocus(reheatLabels = true) {
      const focusID = activeFocusNodeID();
      const { parentSet, childSet } = directionalNeighborSets(focusID);

      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (!node.circleEl || !node.labelEl) {
          continue;
        }

        const isFocus = focusID === node.id;
        const isParent = parentSet.has(node.id);
        const isChild = childSet.has(node.id);

        node.circleEl.classList.toggle("highlight", false);
        node.circleEl.classList.toggle("focus-hover", isFocus);
        node.circleEl.classList.toggle("focus-parent", !isFocus && isParent);
        node.circleEl.classList.toggle("focus-child", !isFocus && isChild);
        node.circleEl.classList.toggle("dimmed", false);
        node.labelEl.classList.toggle("dimmed", false);

        if (node.yearlyCircleEl) {
          node.yearlyCircleEl.classList.toggle("highlight", false);
          node.yearlyCircleEl.classList.toggle("focus-hover", isFocus);
          node.yearlyCircleEl.classList.toggle("focus-parent", !isFocus && isParent);
          node.yearlyCircleEl.classList.toggle("focus-child", !isFocus && isChild);
          node.yearlyCircleEl.classList.toggle("dimmed", false);
        }
      }

      for (let i = 0; i < simEdges.length; i++) {
        const edge = simEdges[i];
        const isParentEdge = !!focusID && edge.target.id === focusID;
        const isChildEdge = !!focusID && edge.source.id === focusID;
        edge.lineEl.classList.toggle("highlight", false);
        edge.lineEl.classList.toggle("highlight-parent", isParentEdge);
        edge.lineEl.classList.toggle("highlight-child", isChildEdge);
        edge.lineEl.classList.toggle("dimmed", false);
      }

      for (let i = 0; i < yearlyEdges.length; i++) {
        const edge = yearlyEdges[i];
        const isParentEdge = !!focusID && edge.target.id === focusID;
        const isChildEdge = !!focusID && edge.source.id === focusID;
        edge.lineEl.classList.toggle("highlight", false);
        edge.lineEl.classList.toggle("highlight-parent", isParentEdge);
        edge.lineEl.classList.toggle("highlight-child", isChildEdge);
        edge.lineEl.classList.toggle("dimmed", false);
      }

      updateLabelVisibility(reheatLabels);
    }

    function renderFrame() {
      for (let i = 0; i < simEdges.length; i++) {
        updateEdgeScreenPosition(simEdges[i]);
      }
      for (let i = 0; i < simNodes.length; i++) {
        updateNodeScreenPosition(simNodes[i]);
      }
    }

    function applyRepulsion(alpha) {
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];

          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist2 = dx * dx + dy * dy;
          if (dist2 < 0.01) {
            dx = 0.01 * (i + 1);
            dy = 0.01 * (j + 1);
            dist2 = dx * dx + dy * dy;
          }

          const dist = Math.sqrt(dist2);
          if (dist > effectiveMaxRepulsionDistance) {
            continue;
          }

          const chargeScale = degreeChargeScale(a) * degreeChargeScale(b);

          const force =
            (settings.charge * chargeScale * alpha) /
            Math.max(settings.minRepulsionDistanceSq, dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!isNodeAnchored(a)) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!isNodeAnchored(b)) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }
    }

    function applyIsolatedPeripheralForce(alpha) {
      if (!hasConnectedNodes || !isolatedNodes.length) {
        return;
      }

      for (let i = 0; i < isolatedNodes.length; i++) {
        const node = isolatedNodes[i];
        if (isNodeAnchored(node)) {
          continue;
        }

        let dx = node.x;
        let dy = node.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (!dist) {
          const angle =
            typeof node.isolatedAngle === "number" ? node.isolatedAngle : stableAngleFromID(node.id);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        const desiredRadius =
          typeof node.isolatedTargetRadius === "number"
            ? node.isolatedTargetRadius
            : isolatedRingRadius;
        const delta = desiredRadius - dist;
        const ringStrength =
          delta >= 0 ? settings.isolatedRingStrengthInside : settings.isolatedRingStrengthOutside;
        const force = delta * ringStrength * alpha;

        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }
    }

    function applySprings(alpha) {
      for (let i = 0; i < simEdges.length; i++) {
        const edge = simEdges[i];
        const a = edge.source;
        const b = edge.target;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const delta = dist - settings.linkDistance;
        const force = delta * settings.springStrength * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!isNodeAnchored(a)) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!isNodeAnchored(b)) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    function applyCentering(alpha) {
      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (isNodeAnchored(node)) {
          continue;
        }
        const centerFactor = node.degree === 0 ? settings.isolatedCenterFactor : 1;
        node.vx += -node.x * settings.centerStrength * centerFactor * alpha;
        node.vy += -node.y * settings.centerStrength * centerFactor * alpha;
      }
    }

    function applyCollision(alpha) {
      const footprints = [];
      for (let i = 0; i < simNodes.length; i++) {
        footprints.push(nodeFootprint(simNodes[i]));
      }

      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const displacement = getGraphCollisionDisplacement(
            footprints[i],
            footprints[j],
            settings.collisionPadding,
            (i + j) % 2 === 0 ? 1 : -1,
          );
          if (!displacement) {
            continue;
          }

          const velocity = getGraphCollisionVelocity(
            displacement,
            settings.collisionStrength,
            alpha,
            isNodeAnchored(a),
            isNodeAnchored(b),
          );
          a.vx += velocity.aX;
          a.vy += velocity.aY;
          b.vx += velocity.bX;
          b.vy += velocity.bY;
        }
      }
    }

    let running = false;
    let alpha = 1;
    let tickCount = 0;
    let fittedAfterWarmup = false;

    function reseedNodesForRegeneration() {
      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        const seedAngle = stableAngleFromID(node.id);
        const baseX = Number.isFinite(node.initialX) ? node.initialX : node.x;
        const baseY = Number.isFinite(node.initialY) ? node.initialY : node.y;
        const jitterRadius =
          node.degree === 0
            ? settings.regenerateJitterRadiusIsolated
            : settings.regenerateJitterRadiusConnected;
        const jitterScale =
          settings.regenerateJitterScaleBase +
          Math.abs(Math.sin(seedAngle * 2.3)) * settings.regenerateJitterScaleAmplitude;
        const jx = Math.cos(seedAngle) * jitterRadius * jitterScale;
        const jy = Math.sin(seedAngle) * jitterRadius * jitterScale;

        node.x = baseX + jx;
        node.y = baseY + jy;
        node.vx = Math.cos(seedAngle * 1.7) * settings.regenerateVelocityAmplitude;
        node.vy = Math.sin(seedAngle * 1.9) * settings.regenerateVelocityAmplitude;
        node.fixed = false;
      }
    }

    function tick() {
      if (!running || activeView !== "graph") {
        return;
      }

      applyRepulsion(alpha);
      applySprings(alpha);
      applyCentering(alpha);
      applyIsolatedPeripheralForce(alpha);
      applyCollision(alpha);

      let totalSpeed = 0;
      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (isNodeAnchored(node)) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx *= settings.damping;
        node.vy *= settings.damping;
        node.x += node.vx;
        node.y += node.vy;
        totalSpeed += Math.abs(node.vx) + Math.abs(node.vy);
      }

      alpha *= settings.alphaDecay;
      tickCount += 1;

      renderFrame();

      if (!fittedAfterWarmup && tickCount >= Math.round(settings.warmupTicksBeforeFit)) {
        fitGraph(settings.fitPadding);
        fittedAfterWarmup = true;
      }

      const averageSpeed = totalSpeed / Math.max(1, simNodes.length);

      if (alpha > settings.alphaStop || averageSpeed > settings.speedStop) {
        requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    function restartSimulation(newAlpha) {
      const nextAlpha = typeof newAlpha === "number" ? newAlpha : settings.initialAlpha;
      alpha = Math.max(alpha, nextAlpha);
      if (!running) {
        running = true;
        requestAnimationFrame(tick);
      }
    }

    let authorRunning = false;
    let authorAlpha = 1;
    let authorTickCount = 0;
    let authorFittedAfterWarmup = false;
    let authorFittedAfterSettle = false;
    let authorSimulationPaused = false;

    function authorNodeIsAnchored(node) {
      return node.fixed;
    }

    function applyAuthorRepulsion(alphaValue) {
      for (let leftIndex = 0; leftIndex < authorNodes.length; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < authorNodes.length; rightIndex++) {
          const left = authorNodes[leftIndex];
          const right = authorNodes[rightIndex];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < 0.01) {
            dx = 0.01 * (leftIndex + 1);
            dy = 0.01 * (rightIndex + 1);
            distanceSquared = dx * dx + dy * dy;
          }
          const distance = Math.sqrt(distanceSquared);
          const separatesComponents = left.componentIndex !== right.componentIndex;
          const repulsionRange = Math.max(
            effectiveMaxRepulsionDistance * (separatesComponents ? 2.5 : 1.5),
            settings.linkDistance * (separatesComponents ? 4 : 2),
          );
          if (distance > repulsionRange) continue;

          const force =
            (settings.charge * (separatesComponents ? 4 : 2) * alphaValue) /
            Math.max(settings.minRepulsionDistanceSq, distanceSquared);
          const forceX = (dx / distance) * force;
          const forceY = (dy / distance) * force;
          if (!authorNodeIsAnchored(left)) {
            left.vx -= forceX;
            left.vy -= forceY;
          }
          if (!authorNodeIsAnchored(right)) {
            right.vx += forceX;
            right.vy += forceY;
          }
        }
      }
    }

    function applyAuthorSprings(alphaValue) {
      for (let i = 0; i < authorEdges.length; i++) {
        const edge = authorEdges[i];
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const authorLinkDistance = Math.max(90, settings.linkDistance * 0.55);
        const delta = distance - authorLinkDistance;
        const weightFactor = 1 + Math.log2(Math.max(1, edge.sharedItemCount));
        const force = delta * settings.springStrength * weightFactor * alphaValue;
        const forceX = (dx / distance) * force;
        const forceY = (dy / distance) * force;
        if (!authorNodeIsAnchored(edge.source)) {
          edge.source.vx += forceX;
          edge.source.vy += forceY;
        }
        if (!authorNodeIsAnchored(edge.target)) {
          edge.target.vx -= forceX;
          edge.target.vy -= forceY;
        }
      }
    }

    function applyAuthorCentering(alphaValue) {
      for (let i = 0; i < authorNodes.length; i++) {
        const node = authorNodes[i];
        if (authorNodeIsAnchored(node)) continue;
        const authorCenterStrength = settings.centerStrength * 0.25;
        node.vx += -node.x * authorCenterStrength * alphaValue;
        node.vy += -node.y * authorCenterStrength * alphaValue;
      }
    }

    function applyAuthorCollision(alphaValue) {
      const footprints = authorNodes.map((node) => authorNodeFootprint(node));
      for (let leftIndex = 0; leftIndex < authorNodes.length; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < authorNodes.length; rightIndex++) {
          const left = authorNodes[leftIndex];
          const right = authorNodes[rightIndex];
          const displacement = getGraphCollisionDisplacement(
            footprints[leftIndex],
            footprints[rightIndex],
            Math.max(16, settings.collisionPadding),
            (leftIndex + rightIndex) % 2 === 0 ? 1 : -1,
          );
          if (!displacement) continue;
          const velocity = getGraphCollisionVelocity(
            displacement,
            Math.max(0.2, settings.collisionStrength),
            alphaValue,
            authorNodeIsAnchored(left),
            authorNodeIsAnchored(right),
          );
          left.vx += velocity.aX;
          left.vy += velocity.aY;
          right.vx += velocity.bX;
          right.vy += velocity.bY;
        }
      }
    }

    function authorTick() {
      if (!authorRunning || activeView !== "authors") return;

      applyAuthorRepulsion(authorAlpha);
      applyAuthorSprings(authorAlpha);
      applyAuthorCentering(authorAlpha);
      applyAuthorCollision(authorAlpha);

      let totalSpeed = 0;
      for (let i = 0; i < authorNodes.length; i++) {
        const node = authorNodes[i];
        if (authorNodeIsAnchored(node)) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx *= settings.damping;
        node.vy *= settings.damping;
        node.x += node.vx;
        node.y += node.vy;
        totalSpeed += Math.abs(node.vx) + Math.abs(node.vy);
      }

      authorAlpha *= settings.alphaDecay;
      authorTickCount += 1;
      renderAuthorFrame();

      if (
        !authorFittedAfterWarmup &&
        authorTickCount >= Math.round(settings.warmupTicksBeforeFit)
      ) {
        fitAuthorGraph(settings.fitPadding);
        authorFittedAfterWarmup = true;
      }

      const averageSpeed = totalSpeed / Math.max(1, authorNodes.length);
      if (authorAlpha > settings.alphaStop || averageSpeed > settings.speedStop) {
        requestAnimationFrame(authorTick);
      } else {
        authorRunning = false;
        if (!authorFittedAfterSettle) {
          fitAuthorGraph(settings.fitPadding);
          authorFittedAfterSettle = true;
        }
      }
    }

    function restartAuthorSimulation(newAlpha) {
      const nextAlpha = typeof newAlpha === "number" ? newAlpha : settings.initialAlpha;
      authorAlpha = Math.max(authorAlpha, nextAlpha);
      if (!authorRunning && authorNodes.length) {
        authorRunning = true;
        requestAnimationFrame(authorTick);
      }
    }

    let graphSimulationPaused = false;

    function updateEmptyState() {
      if (!emptyStateEl || !emptyTitleEl || !emptyTextEl) {
        return;
      }

      if (activeView === "authors") {
        emptyStateEl.style.display = "none";
        authorEmptyStateEl.style.display = authorNodes.length ? "none" : "block";
        return;
      }

      authorEmptyStateEl.style.display = "none";

      if (activeView === "year") {
        const hasYearlyNodes = yearlyNodes.length > 0;
        emptyStateEl.style.display = hasYearlyNodes ? "none" : "block";
        emptyTitleEl.textContent = "No markers to display";
        emptyTextEl.textContent =
          "No items have both a publication year and a citation count available.";
        return;
      }

      const hasGraphNodes = simNodes.length > 0;
      emptyStateEl.style.display = hasGraphNodes ? "none" : "block";
      emptyTitleEl.textContent = "No nodes to display";
      emptyTextEl.textContent =
        "The selected scope has no Zotero items with openalex.work_id in Extra. " +
        "Use Get OpenAlex-WorkID first, then regenerate the graph.";
    }

    function setActiveView(nextView, force) {
      if (
        nextView !== "graph" &&
        nextView !== "year" &&
        nextView !== "authors"
      ) {
        return;
      }
      if (!force && activeView === nextView) {
        return;
      }

      if (activeView === "graph" && nextView !== "graph") {
        graphSimulationPaused = running;
        running = false;
      }
      if (activeView === "authors" && nextView !== "authors") {
        authorSimulationPaused = authorRunning;
        authorRunning = false;
      }

      activeView = nextView;
      hoveredNodeID = null;
      setHoveredAuthor(null);
      dragState = null;
      panState = null;
      setTooltipNode(null, 0, 0);

      viewport.style.display = activeView === "graph" ? "" : "none";
      yearlyView.style.display = activeView === "year" ? "" : "none";
      authorsView.style.display = activeView === "authors" ? "grid" : "none";
      authorsView.setAttribute("aria-hidden", String(activeView !== "authors"));
      svg.style.display = activeView === "authors" ? "none" : "";
      svg.classList.toggle("fixed-view", activeView !== "graph");

      graphViewButtonEl.setAttribute("aria-pressed", String(activeView === "graph"));
      yearViewButtonEl.setAttribute("aria-pressed", String(activeView === "year"));
      authorsViewButtonEl.setAttribute("aria-pressed", String(activeView === "authors"));

      if (regenerateButtonEl) {
        regenerateButtonEl.style.display =
          showTuningControls && activeView === "graph" ? "" : "none";
      }
      buildTuningPanel();
      renderSummary();

      if (activeView === "year") {
        renderYearlyPlot();
      } else if (activeView === "authors") {
        renderAuthorFrame();
        if (!authorTransformInitialized) {
          fitAuthorGraph(settings.fitPadding);
        } else {
          applyAuthorTransform();
        }
      } else if (activeView === "graph") {
        applyTransform();
        renderFrame();
      }

      updateVisualFocus(false);
      updateEmptyState();

      if (activeView === "graph" && graphSimulationPaused && simNodes.length) {
        graphSimulationPaused = false;
        restartSimulation(alpha);
      }
      if (activeView === "authors" && authorNodes.length) {
        if (authorSimulationPaused) {
          authorSimulationPaused = false;
          restartAuthorSimulation(authorAlpha);
        } else if (authorTickCount === 0) {
          restartAuthorSimulation(settings.initialAlpha);
        }
      }
    }

    function beginPan(pointerID, clientX, clientY) {
      panState = {
        pointerID,
        startX: clientX,
        startY: clientY,
        originX: transform.x,
        originY: transform.y,
      };
    }

    function beginDrag(pointerID, node, clientX, clientY) {
      dragState = { pointerID, node };
      node.fixed = true;
      const local = clientPointToLocal(clientX, clientY);
      const world = localPointToWorld(local.x, local.y);
      node.x = world.x;
      node.y = world.y;
      node.vx = 0;
      node.vy = 0;
      renderFrame();
      restartSimulation(settings.dragAlpha);
    }

    function updatePointerMove(pointerID, clientX, clientY) {
      if (dragState && dragState.pointerID === pointerID) {
        const node = dragState.node;
        const local = clientPointToLocal(clientX, clientY);
        const world = localPointToWorld(local.x, local.y);
        node.x = world.x;
        node.y = world.y;
        node.vx = 0;
        node.vy = 0;
        renderFrame();
        return;
      }

      if (panState && panState.pointerID === pointerID) {
        transform.x = panState.originX + (clientX - panState.startX);
        transform.y = panState.originY + (clientY - panState.startY);
        applyTransform();
      }
    }

    function endPointer(pointerID) {
      if (dragState && dragState.pointerID === pointerID) {
        dragState.node.fixed = false;
        dragState = null;
        restartSimulation(settings.releaseAlpha);
      }
      if (panState && panState.pointerID === pointerID) {
        panState = null;
      }
    }

    function nodeByElement(target) {
      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (node.circleEl === target) {
          return node;
        }
      }
      return null;
    }

    function bindNodeEvents(node, el, draggable) {
      if (!el) {
        return;
      }

      el.addEventListener("mouseenter", (event) => {
        hoveredNodeID = node.id;
        setTooltipNode(node, event.clientX, event.clientY);
        updateVisualFocus();
      });

      el.addEventListener("mousemove", (event) => {
        if (hoveredNodeID === node.id) {
          setTooltipNode(node, event.clientX, event.clientY);
        }
      });

      el.addEventListener("mouseleave", () => {
        if (hoveredNodeID === node.id) {
          hoveredNodeID = null;
        }
        setTooltipNode(null, 0, 0);
        updateVisualFocus();
      });

      if (!draggable) {
        return;
      }

      if (typeof window.PointerEvent === "function") {
        el.addEventListener("pointerdown", (event) => {
          if (activeView !== "graph" || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          beginDrag(event.pointerId, node, event.clientX, event.clientY);
          if (el.setPointerCapture) {
            try {
              el.setPointerCapture(event.pointerId);
            } catch (_error) {
              // no-op
            }
          }
        });
      } else {
        el.addEventListener("mousedown", (event) => {
          if (activeView !== "graph" || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          beginDrag("mouse", node, event.clientX, event.clientY);
        });
      }
    }

    for (let i = 0; i < simNodes.length; i++) {
      bindNodeEvents(simNodes[i], simNodes[i].circleEl, true);
      bindNodeEvents(simNodes[i], simNodes[i].yearlyCircleEl, false);
    }

    let authorDragState = null;
    let authorPanState = null;

    function authorClientPointToLocal(clientX, clientY) {
      const rect = authorSvg.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function authorLocalPointToWorld(localX, localY) {
      return {
        x: (localX - authorTransform.x) / authorTransform.k,
        y: (localY - authorTransform.y) / authorTransform.k,
      };
    }

    function beginAuthorDrag(pointerID, node, clientX, clientY) {
      const local = authorClientPointToLocal(clientX, clientY);
      const world = authorLocalPointToWorld(local.x, local.y);
      authorDragState = {
        pointerID,
        node,
        startX: clientX,
        startY: clientY,
        offsetX: node.x - world.x,
        offsetY: node.y - world.y,
        moved: false,
      };
      node.fixed = true;
      restartAuthorSimulation(settings.dragAlpha);
    }

    function updateAuthorPointer(pointerID, clientX, clientY) {
      if (authorDragState && authorDragState.pointerID === pointerID) {
        const local = authorClientPointToLocal(clientX, clientY);
        const world = authorLocalPointToWorld(local.x, local.y);
        const distance = Math.hypot(
          clientX - authorDragState.startX,
          clientY - authorDragState.startY,
        );
        if (distance > 4) authorDragState.moved = true;
        authorDragState.node.x = world.x + authorDragState.offsetX;
        authorDragState.node.y = world.y + authorDragState.offsetY;
        authorDragState.node.vx = 0;
        authorDragState.node.vy = 0;
        renderAuthorFrame();
        return;
      }

      if (authorPanState && authorPanState.pointerID === pointerID) {
        const deltaX = clientX - authorPanState.startX;
        const deltaY = clientY - authorPanState.startY;
        if (Math.hypot(deltaX, deltaY) > 4) authorPanState.moved = true;
        authorTransform.x = authorPanState.originX + deltaX;
        authorTransform.y = authorPanState.originY + deltaY;
        applyAuthorTransform();
      }
    }

    function endAuthorPointer(pointerID) {
      if (authorDragState && authorDragState.pointerID === pointerID) {
        const draggedNode = authorDragState.node;
        const shouldSelect = !authorDragState.moved;
        draggedNode.fixed = false;
        authorDragState = null;
        if (shouldSelect) selectAuthor(draggedNode.id);
        restartAuthorSimulation(settings.releaseAlpha);
      }
      if (authorPanState && authorPanState.pointerID === pointerID) {
        const shouldClear = !authorPanState.moved;
        authorPanState = null;
        if (shouldClear) selectAuthor(null);
      }
    }

    for (let i = 0; i < authorNodes.length; i++) {
      const node = authorNodes[i];
      if (!node.circleEl) continue;
      node.circleEl.addEventListener("mouseenter", () => {
        if (activeView === "authors") {
          setHoveredAuthor(node.id);
        }
      });
      node.circleEl.addEventListener("mouseleave", () => {
        if (hoveredAuthorID === node.id) {
          setHoveredAuthor(null);
        }
      });
      node.circleEl.addEventListener("pointerdown", (event) => {
        if (activeView !== "authors" || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        beginAuthorDrag(event.pointerId, node, event.clientX, event.clientY);
        if (node.circleEl.setPointerCapture) {
          try {
            node.circleEl.setPointerCapture(event.pointerId);
          } catch (_error) {
            // no-op
          }
        }
      });
    }

    authorSvg.addEventListener(
      "wheel",
      (event) => {
        if (activeView !== "authors") return;
        event.preventDefault();
        const local = authorClientPointToLocal(event.clientX, event.clientY);
        const world = authorLocalPointToWorld(local.x, local.y);
        const wheelDelta = normalizeWheelDelta(event);
        const zoomFactor = Math.exp(-wheelDelta * settings.zoomWheelSensitivity);
        const nextScale = clamp(
          authorTransform.k * zoomFactor,
          settings.zoomMin,
          settings.zoomMax,
        );
        if (nextScale === authorTransform.k) return;
        authorTransform.k = nextScale;
        authorTransform.x = local.x - world.x * nextScale;
        authorTransform.y = local.y - world.y * nextScale;
        applyAuthorTransform();
      },
      { passive: false },
    );

    authorSvg.addEventListener("pointerdown", (event) => {
      if (activeView !== "authors" || event.button !== 0) return;
      authorPanState = {
        pointerID: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: authorTransform.x,
        originY: authorTransform.y,
        moved: false,
      };
      if (authorSvg.setPointerCapture) {
        try {
          authorSvg.setPointerCapture(event.pointerId);
        } catch (_error) {
          // no-op
        }
      }
    });

    window.addEventListener("pointermove", (event) => {
      if (activeView === "authors") {
        updateAuthorPointer(event.pointerId, event.clientX, event.clientY);
      }
    });
    window.addEventListener("pointerup", (event) => endAuthorPointer(event.pointerId));
    window.addEventListener("pointercancel", (event) => endAuthorPointer(event.pointerId));

    svg.addEventListener(
      "wheel",
      (event) => {
        if (activeView !== "graph") {
          return;
        }
        event.preventDefault();
        const local = clientPointToLocal(event.clientX, event.clientY);
        const world = localPointToWorld(local.x, local.y);
        const wheelDelta = normalizeWheelDelta(event);
        const zoomFactor = Math.exp(-wheelDelta * settings.zoomWheelSensitivity);
        const newScale = clamp(transform.k * zoomFactor, settings.zoomMin, settings.zoomMax);

        if (newScale === transform.k) {
          return;
        }

        transform.k = newScale;
        transform.x = local.x - world.x * newScale;
        transform.y = local.y - world.y * newScale;
        applyTransform();
        updateLabelVisibility(true);
      },
      { passive: false },
    );

    if (typeof window.PointerEvent === "function") {
      svg.addEventListener("pointerdown", (event) => {
        if (activeView !== "graph" || event.button !== 0) {
          return;
        }

        const targetNode = nodeByElement(event.target);
        if (targetNode) {
          return;
        }

        beginPan(event.pointerId, event.clientX, event.clientY);
        if (svg.setPointerCapture) {
          try {
            svg.setPointerCapture(event.pointerId);
          } catch (_error) {
            // no-op
          }
        }
      });

      window.addEventListener("pointermove", (event) => {
        updatePointerMove(event.pointerId, event.clientX, event.clientY);
      });

      window.addEventListener("pointerup", (event) => {
        endPointer(event.pointerId);
      });

      window.addEventListener("pointercancel", (event) => {
        endPointer(event.pointerId);
      });
    } else {
      svg.addEventListener("mousedown", (event) => {
        if (activeView !== "graph" || event.button !== 0) {
          return;
        }
        const targetNode = nodeByElement(event.target);
        if (targetNode) {
          return;
        }
        beginPan("mouse", event.clientX, event.clientY);
      });

      window.addEventListener("mousemove", (event) => {
        updatePointerMove("mouse", event.clientX, event.clientY);
      });

      window.addEventListener("mouseup", () => {
        endPointer("mouse");
      });
    }

    if (graphViewButtonEl) {
      graphViewButtonEl.addEventListener("click", () => setActiveView("graph", false));
    }
    if (yearViewButtonEl) {
      yearViewButtonEl.addEventListener("click", () => setActiveView("year", false));
    }
    if (authorsViewButtonEl) {
      authorsViewButtonEl.addEventListener("click", () => setActiveView("authors", false));
    }

    window.addEventListener("resize", () => {
      if (activeView === "year") {
        renderYearlyPlot();
        return;
      }
      if (activeView === "authors") {
        fitAuthorGraph(settings.fitPadding);
        return;
      }
      if (activeView === "graph") {
        if (!simNodes.length) {
          resetView();
          return;
        }
        fitGraph(settings.fitPadding);
      }
    });

    resetView();
    setActiveView("graph", true);

    if (simNodes.length) {
      restartSimulation(settings.initialAlpha);
    }
  </script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
