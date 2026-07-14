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
      "Extra spacing added between node circles during collision resolution. Increase to add breathing room; decrease to pack nodes more tightly.",
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
      "Exponential wheel-to-zoom conversion factor. Increase for faster zoom per wheel tick; decrease for finer zoom control.",
    min: 0.0001,
    max: 0.02,
    step: 0.0001,
    decimals: 4,
    default: 0.0014,
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
  </div>
  <div class="summary">
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
    </svg>
    <div class="tuning-panel" id="tuning-panel"></div>
    <div class="tooltip" id="node-tooltip"></div>
    <div class="empty-state" id="empty-state">
      <div class="empty-title">No nodes to display</div>
      <div class="empty-text" id="empty-text"></div>
    </div>
  </div>

  <script>
    const data = ${payload};
    const physicsSettings = ${physicsPayload};
    const physicsFieldConfig = ${physicsFieldConfigPayload};
    const physicsFieldKeys = Object.keys(physicsFieldConfig);
    const showTuningControls = ${showTuningControlsPayload};
    const NS = "http://www.w3.org/2000/svg";
    const collectionEl = document.getElementById("collection-name");
    const summaryEl = document.getElementById("summary");
    const svg = document.getElementById("graph");
    const viewport = document.getElementById("viewport");
    const edgesLayer = document.getElementById("edges");
    const nodesLayer = document.getElementById("nodes");
    const labelsLayer = document.getElementById("labels");
    const graphShell = document.querySelector(".graph-shell");
    const tooltipEl = document.getElementById("node-tooltip");
    const emptyStateEl = document.getElementById("empty-state");
    const emptyTextEl = document.getElementById("empty-text");
    const tuningPanelEl = document.getElementById("tuning-panel");
    const regenerateButtonEl = document.getElementById("regenerate-button");

    const safeNodes = Array.isArray(data && data.nodes) ? data.nodes : [];
    const safeEdges = Array.isArray(data && data.edges) ? data.edges : [];

    const settings = { ...physicsSettings };

    let labelMode = "auto";
    let effectiveMaxRepulsionDistance = settings.maxRepulsionDistance;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
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
      const nextPhysics = readPhysicsFromTuningPanel();
      applyPhysicsToSettings(nextPhysics);
      persistPhysicsToPrefs(nextPhysics);

      hoveredNodeID = null;
      setTooltipNode(null, 0, 0);
      reseedNodesForRegeneration();
      updateVisualFocus();
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

      if (!showTuningControls) {
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
    clearChildren(summaryEl);
    addSummaryPill("Nodes", safeNodes.length);
    addSummaryPill("Edges", safeEdges.length);
    addSummaryPill("Skipped (missing work_id)", (data && data.skippedMissingWorkID) || 0);
    addSummaryPill("Fetch failures", (data && data.fetchFailures) || 0);

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
        labelEl: null,
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

    function createNodeLabel(node) {
      const textEl = document.createElementNS(NS, "text");
      textEl.setAttribute("class", "node-label");

      const lines = splitLabelLines(
        formatNodeDisplayLabel(node),
        Math.max(1, Math.round(settings.labelMaxCharsPerLine)),
        Math.max(1, Math.round(settings.labelMaxLines)),
      );
      for (let i = 0; i < lines.length; i++) {
        const tspan = document.createElementNS(NS, "tspan");
        tspan.setAttribute("x", "0");
        tspan.setAttribute("dy", i === 0 ? "0" : String(settings.labelLineHeight));
        tspan.textContent = lines[i];
        textEl.appendChild(tspan);
      }

      return textEl;
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

    function updateEdgeScreenPosition(edge) {
      const source = edge.source;
      const target = edge.target;

      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (!dist) {
        dist = 1;
        dx = 1;
        dy = 0;
      }

      const ux = dx / dist;
      const uy = dy / dist;
      const sourcePad = source.radius + settings.edgeSourcePadding;
      const targetPad = target.radius + settings.edgeTargetPadding;

      const x1 = source.x + ux * sourcePad;
      const y1 = source.y + uy * sourcePad;
      const x2 = target.x - ux * targetPad;
      const y2 = target.y - uy * targetPad;

      edge.lineEl.setAttribute("x1", String(x1));
      edge.lineEl.setAttribute("y1", String(y1));
      edge.lineEl.setAttribute("x2", String(x2));
      edge.lineEl.setAttribute("y2", String(y2));
    }

    ensureArrowMarker();
    clearChildren(edgesLayer);
    clearChildren(nodesLayer);
    clearChildren(labelsLayer);

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
    }

    const transform = { x: 0, y: 0, k: 1 };

    function viewportSize() {
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
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
        const node = simNodes[i];
        minX = Math.min(minX, node.x - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
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

    function directionalNeighborSets(focusID) {
      const parentSet = new Set();
      const childSet = new Set();

      if (!focusID) {
        return { parentSet, childSet };
      }

      for (let i = 0; i < simEdges.length; i++) {
        const edge = simEdges[i];
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

    function updateLabelVisibility() {
      const labelsForFocus = activeLabelSet();
      const mode = labelMode;
      const alwaysShow =
        mode === "always" ||
        (mode === "auto" &&
          simNodes.length <= Math.round(settings.alwaysShowLabelNodeThreshold));

      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (!node.labelEl) {
          continue;
        }

        let visible = false;
        if (alwaysShow) {
          visible = true;
        } else if (mode === "hover") {
          visible = labelsForFocus.has(node.id);
        } else {
          visible =
            labelsForFocus.has(node.id) ||
            (topLabelNodeIDs.has(node.id) && transform.k > settings.labelVisibilityZoomThreshold);
        }

        node.labelEl.style.display = visible ? "" : "none";
      }
    }

    function updateVisualFocus() {
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

      updateLabelVisibility();
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

          if (!a.fixed) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!b.fixed) {
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
        if (node.fixed) {
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

        if (!a.fixed) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    function applyCentering(alpha) {
      for (let i = 0; i < simNodes.length; i++) {
        const node = simNodes[i];
        if (node.fixed) {
          continue;
        }
        const centerFactor = node.degree === 0 ? settings.isolatedCenterFactor : 1;
        node.vx += -node.x * settings.centerStrength * centerFactor * alpha;
        node.vy += -node.y * settings.centerStrength * centerFactor * alpha;
      }
    }

    function applyCollision(alpha) {
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (!dist) {
            dist = 1;
            dx = 1;
            dy = 0;
          }

          const minDist = a.radius + b.radius + settings.collisionPadding;
          if (dist >= minDist) {
            continue;
          }

          const push = (minDist - dist) * settings.collisionStrength * alpha;
          const fx = (dx / dist) * push;
          const fy = (dy / dist) * push;

          if (!a.fixed) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!b.fixed) {
            b.vx += fx;
            b.vy += fy;
          }
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
      if (!running) {
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
        if (node.fixed) {
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

    function bindNodeEvents(node) {
      const el = node.circleEl;
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

      if (typeof window.PointerEvent === "function") {
        el.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) {
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
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          beginDrag("mouse", node, event.clientX, event.clientY);
        });
      }
    }

    for (let i = 0; i < simNodes.length; i++) {
      bindNodeEvents(simNodes[i]);
    }

    svg.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const local = clientPointToLocal(event.clientX, event.clientY);
        const world = localPointToWorld(local.x, local.y);
        const zoomFactor = Math.exp(-event.deltaY * settings.zoomWheelSensitivity);
        const newScale = clamp(transform.k * zoomFactor, settings.zoomMin, settings.zoomMax);

        if (newScale === transform.k) {
          return;
        }

        transform.k = newScale;
        transform.x = local.x - world.x * newScale;
        transform.y = local.y - world.y * newScale;
        applyTransform();
        updateLabelVisibility();
      },
      { passive: false },
    );

    if (typeof window.PointerEvent === "function") {
      svg.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
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
        if (event.button !== 0) {
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

    buildTuningPanel();

    window.addEventListener("resize", () => {
      if (!simNodes.length) {
        resetView();
        return;
      }
      fitGraph(settings.fitPadding);
    });

    updateVisualFocus();
    renderFrame();
    resetView();

    if (!simNodes.length) {
      if (emptyStateEl) {
        emptyStateEl.style.display = "block";
      }
      if (emptyTextEl) {
        emptyTextEl.textContent =
          "The selected scope has no Zotero items with openalex.work_id in Extra. " +
          "Use Get OpenAlex-WorkID first, then regenerate the graph.";
      }
    } else {
      restartSimulation(settings.initialAlpha);
    }
  </script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
