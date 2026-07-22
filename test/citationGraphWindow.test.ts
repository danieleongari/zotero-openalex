import { assert } from "chai";
import {
  buildAuthorGraphData,
  buildCitationsPerYearLayout,
  buildCitationsPerYearOverlapOffsets,
  buildGraphNodeFootprint,
  filterCitationsPerYearEdges,
  getGraphCollisionDisplacement,
  getGraphCollisionVelocity,
  GRAPH_INTERACTION_CONSTANTS,
  GRAPH_PHYSICS_FIELD_CONFIG,
  graphLabelVisibilityChanged,
  getAuthorEdgeWidth,
  getAuthorMarkerRadius,
  normalizeGraphWheelDelta,
  renderCollectionCitationGraphWindow,
} from "../src/modules/citationGraphWindow";

describe("citation graph settings and geometry", function () {
  it("normalizes line and page wheel deltas to pixels", function () {
    assert.equal(
      normalizeGraphWheelDelta(3, GRAPH_INTERACTION_CONSTANTS.wheelDeltaModeLine, 800),
      48,
    );
    assert.equal(
      normalizeGraphWheelDelta(1, GRAPH_INTERACTION_CONSTANTS.wheelDeltaModePage, 120),
      120,
    );
  });

  it("caps unusually large wheel deltas", function () {
    assert.equal(
      normalizeGraphWheelDelta(10, GRAPH_INTERACTION_CONSTANTS.wheelDeltaModePage, 800),
      GRAPH_INTERACTION_CONSTANTS.wheelDeltaMaxPixels,
    );
    assert.equal(
      normalizeGraphWheelDelta(-10, GRAPH_INTERACTION_CONSTANTS.wheelDeltaModePage, 800),
      -GRAPH_INTERACTION_CONSTANTS.wheelDeltaMaxPixels,
    );
  });

  it("keeps zoom speed user-tunable with a more responsive default", function () {
    const zoomSetting = GRAPH_PHYSICS_FIELD_CONFIG.zoomWheelSensitivity;

    assert.equal(zoomSetting.prefSuffix, "graphZoomWheelSensitivity");
    assert.equal(zoomSetting.default, 0.004);
    assert.isBelow(zoomSetting.min, zoomSetting.default);
    assert.isAbove(zoomSetting.max, zoomSetting.default);
  });

  it("uses a circle-only footprint while the title is hidden", function () {
    assert.deepEqual(
      buildGraphNodeFootprint(10, 20, 5, { x: 0, y: -8, width: 60, height: 20 }, false, 2, -4, 2),
      {
        minX: 5,
        maxX: 15,
        minY: 15,
        maxY: 25,
      },
    );
  });

  it("extends a visible footprint through multiline title bounds and halo", function () {
    assert.deepEqual(
      buildGraphNodeFootprint(10, 20, 5, { x: 0, y: -8, width: 60, height: 20 }, true, 2, -4, 2),
      {
        minX: 5,
        maxX: 79,
        minY: 6,
        maxY: 30,
      },
    );
  });

  it("separates overlapping footprints along their least-overlap axis", function () {
    const horizontal = getGraphCollisionDisplacement(
      { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      { minX: 15, maxX: 30, minY: 0, maxY: 10 },
      0,
    );
    const vertical = getGraphCollisionDisplacement(
      { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      { minX: 0, maxX: 20, minY: 8, maxY: 18 },
      0,
    );

    assert.deepEqual(horizontal, { x: 5, y: 0 });
    assert.deepEqual(vertical, { x: 0, y: 2 });
  });

  it("does not move separated or exactly touching footprints", function () {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

    assert.isNull(getGraphCollisionDisplacement(a, { minX: 10, maxX: 20, minY: 0, maxY: 10 }, 0));
    assert.isNull(getGraphCollisionDisplacement(a, { minX: 11, maxX: 20, minY: 0, maxY: 10 }, 0));
  });

  it("uses a deterministic direction for coincident footprint centers", function () {
    const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

    assert.deepEqual(getGraphCollisionDisplacement(bounds, bounds, 0, 1), { x: 10, y: 0 });
    assert.deepEqual(getGraphCollisionDisplacement(bounds, bounds, 0, -1), { x: -10, y: 0 });
  });

  it("keeps anchored nodes stationary during collision resolution", function () {
    assert.deepEqual(getGraphCollisionVelocity({ x: 4, y: 0 }, 0.5, 1, true, false), {
      aX: 0,
      aY: 0,
      bX: 2,
      bY: 0,
    });
  });

  it("detects only actual title visibility transitions", function () {
    assert.isFalse(graphLabelVisibilityChanged(false, false));
    assert.isFalse(graphLabelVisibilityChanged(true, true));
    assert.isTrue(graphLabelVisibilityChanged(false, true));
    assert.isTrue(graphLabelVisibilityChanged(true, false));
  });

  it("plots only nodes with both a year and citation count on linear axes", function () {
    const layout = buildCitationsPerYearLayout(
      [
        { id: "a", year: 2000, citationCount: 0 },
        { id: "b", year: 2010, citationCount: 100 },
        { id: "missing-year", year: null, citationCount: 20 },
        { id: "missing-count", year: 2005, citationCount: null },
      ],
      800,
      600,
    );

    assert.deepEqual(
      layout.points.map((point) => point.id),
      ["a", "b"],
    );
    assert.equal(layout.points[0].anchorX, layout.plotLeft);
    assert.equal(layout.points[0].anchorY, layout.plotBottom);
    assert.equal(layout.points[1].anchorX, layout.plotRight);
    assert.equal(layout.points[1].anchorY, layout.plotTop);
  });

  it("centers a single year and keeps an all-zero citation domain on the baseline", function () {
    const layout = buildCitationsPerYearLayout(
      [
        { id: "a", year: 2024, citationCount: 0 },
        { id: "b", year: 2024, citationCount: 0 },
      ],
      640,
      480,
    );

    assert.equal(layout.minYear, 2024);
    assert.equal(layout.maxYear, 2024);
    assert.equal(layout.maxCitationCount, 0);
    assert.equal(layout.points[0].anchorX, (layout.plotLeft + layout.plotRight) / 2);
    assert.equal(layout.points[0].anchorY, layout.plotBottom);
  });

  it("reserves the requested right-side width for yearly marker details", function () {
    const layout = buildCitationsPerYearLayout(
      [{ id: "a", year: 2024, citationCount: 10 }],
      900,
      600,
      6,
      280,
    );

    assert.equal(layout.plotRight, 900 - 28 - 280);
  });

  it("uses deterministic distinct offsets for perfectly overlapping markers", function () {
    const offsets = buildCitationsPerYearOverlapOffsets(10, 6);
    const positions = new Set(
      offsets.map((offset) => `${offset.x.toFixed(4)},${offset.y.toFixed(4)}`),
    );

    assert.lengthOf(offsets, 10);
    assert.equal(positions.size, 10);
    assert.deepEqual(offsets, buildCitationsPerYearOverlapOffsets(10, 6));

    const forward = buildCitationsPerYearLayout(
      [
        { id: "b", year: 2020, citationCount: 4 },
        { id: "a", year: 2020, citationCount: 4 },
      ],
      500,
      400,
    );
    const reverse = buildCitationsPerYearLayout(
      [
        { id: "a", year: 2020, citationCount: 4 },
        { id: "b", year: 2020, citationCount: 4 },
      ],
      500,
      400,
    );
    assert.deepEqual(forward.points, reverse.points);
  });

  it("filters yearly edges with unavailable endpoints or matching publication years", function () {
    const nodes = [
      { id: "a", year: 2020, citationCount: 3 },
      { id: "b", year: 2020, citationCount: 5 },
      { id: "c", year: 2021, citationCount: 8 },
      { id: "d", year: null, citationCount: 2 },
    ];
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "c", target: "d" },
      { source: "missing", target: "c" },
    ];

    assert.deepEqual(filterCitationsPerYearEdges(nodes, edges), [{ source: "a", target: "c" }]);
  });

  it("aggregates recurring OpenAlex authors and weighted undirected coauthorships", function () {
    const graph = buildAuthorGraphData([
      {
        itemID: 1,
        workID: "W1",
        label: "First publication",
        year: 2020,
        authors: [
          { id: "A1", name: "Alice Author" },
          { id: "A1", name: "Alice Author" },
          { id: "A2", name: "Bob Author" },
          { id: "A3", name: "Single Appearance" },
        ],
      },
      {
        itemID: 2,
        workID: "W2",
        label: "Second publication",
        year: 2021,
        authors: [
          { id: "A1", name: "Alicia Author" },
          { id: "A2", name: "Bob Author" },
        ],
      },
      {
        itemID: 3,
        workID: "W3",
        label: "Newest publication",
        year: 2022,
        authors: [
          { id: "A1", name: "Alice Author" },
          { id: "A4", name: "Another Single" },
        ],
      },
      {
        itemID: 4,
        workID: "W4",
        label: "Undated publication",
        year: null,
        authors: [{ id: "A2", name: "Bob Author" }],
      },
    ]);

    assert.deepEqual(
      graph.nodes.map((node) => [node.id, node.name, node.itemCount]),
      [
        ["A1", "Alice Author", 3],
        ["A2", "Bob Author", 3],
      ],
    );
    assert.deepEqual(
      graph.nodes[0].publications.map((publication) => publication.itemID),
      [3, 2, 1],
    );
    assert.deepEqual(
      graph.edges.map((edge) => [edge.source, edge.target, edge.sharedItemCount]),
      [["A1", "A2", 2]],
    );
    assert.equal(graph.publicationCount, 4);
  });

  it("uses monotonic bounded author marker and coauthorship edge scaling", function () {
    assert.equal(getAuthorMarkerRadius(2), 9);
    assert.isAbove(getAuthorMarkerRadius(10), getAuthorMarkerRadius(2));
    assert.equal(getAuthorMarkerRadius(10_000), 24);
    assert.equal(getAuthorEdgeWidth(1), 2.5);
    assert.isAbove(getAuthorEdgeWidth(4), getAuthorEdgeWidth(1));
    assert.equal(getAuthorEdgeWidth(10_000), 9);
  });

  it("renders the three accessible view controls and dedicated empty view layers", function () {
    let html = "";
    const popup = {
      document: {
        open() {},
        write(chunk: string) {
          html += chunk;
        },
        close() {},
      },
    } as unknown as Window;

    renderCollectionCitationGraphWindow(popup, {
      collectionName: "Test collection",
      nodes: [],
      edges: [],
      skippedMissingWorkID: 0,
      fetchFailures: 0,
    });

    assert.include(html, ">Citation Graph</button>");
    assert.include(html, ">Citations vs Year</button>");
    assert.include(html, ">Co-Authors</button>");
    assert.include(html, 'id="view-graph-button" type="button" aria-pressed="true"');
    assert.include(html, 'id="yearly-view"');
    assert.include(html, 'id="authors-view"');
    assert.include(html, 'id="author-graph"');
    assert.include(html, 'class="author-details" id="author-details" aria-live="polite"></aside>');
    assert.include(html, 'lineEl.setAttribute("class", "edge author-edge")');
    assert.include(html, 'textEl.setAttribute("class", "node-label author-label")');
    assert.include(html, ".edge.author-edge");
    assert.include(html, ".edge.author-edge.hover-connected");
    assert.include(html, 'node.circleEl.classList.toggle("hover-coauthor", isCoauthor)');
    assert.include(html, 'node.circleEl.addEventListener("mouseenter"');
    assert.include(html, "left.componentIndex !== right.componentIndex");
    assert.include(html, "settings.charge * (separatesComponents ? 4 : 2)");
    assert.include(html, "Math.max(90, settings.linkDistance * 0.55)");
    assert.include(html, "Math.max(16, settings.collisionPadding)");
    assert.include(html, "if (!authorFittedAfterSettle)");
    assert.include(html, 'lineEl.setAttribute("class", "edge yearly-edge")');
    assert.include(html, ".tooltip.yearly-docked");
  });
});
