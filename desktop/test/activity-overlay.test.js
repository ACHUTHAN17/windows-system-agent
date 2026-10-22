'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OVERLAY_HEIGHT, bottomEdgeBounds, activityOverlayHtml } = require('../lib/activity-overlay');

test('activity overlay is anchored to the physical display bottom, not the work area', () => {
  const bounds = bottomEdgeBounds({ x: -1920, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(bounds, { x: -1920, y: 1080 - OVERLAY_HEIGHT, width: 1920, height: OVERLAY_HEIGHT });
});

test('activity overlay uses one neutral glow color, not a rainbow gradient', () => {
  const html = activityOverlayHtml();
  assert.match(html, /#7667ff/i);
  assert.doesNotMatch(html, /linear-gradient|#00d4ff/i);
});
