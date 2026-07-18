import { assert } from "chai";
import {
  GRAPH_INTERACTION_CONSTANTS,
  GRAPH_PHYSICS_FIELD_CONFIG,
  normalizeGraphWheelDelta,
} from "../src/modules/citationGraphWindow";

describe("citation graph interaction settings", function () {
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
});
