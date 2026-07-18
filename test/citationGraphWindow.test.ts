import { assert } from "chai";
import {
  buildGraphNodeFootprint,
  getGraphCollisionDisplacement,
  getGraphCollisionVelocity,
  GRAPH_INTERACTION_CONSTANTS,
  GRAPH_PHYSICS_FIELD_CONFIG,
  graphLabelVisibilityChanged,
  normalizeGraphWheelDelta,
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
});
