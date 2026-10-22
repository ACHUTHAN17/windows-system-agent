'use strict';

const OVERLAY_HEIGHT = 6;

function bottomEdgeBounds(displayBounds, height = OVERLAY_HEIGHT) {
  const h = Math.max(1, Math.min(Number(height) || OVERLAY_HEIGHT, displayBounds.height));
  return { x: displayBounds.x, y: displayBounds.y + displayBounds.height - h, width: displayBounds.width, height: h };
}

function activityOverlayHtml() {
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none}
body:after{content:"";display:block;width:100%;height:2px;margin-top:2px;background:#7667ff;box-shadow:0 0 8px rgba(118,103,255,.95),0 0 22px rgba(118,103,255,.55);animation:winagent-active 1.25s ease-in-out infinite}
@keyframes winagent-active{0%,100%{opacity:.4;transform:scaleX(.72)}50%{opacity:1;transform:scaleX(1)}}
</style>`;
}

module.exports = { OVERLAY_HEIGHT, bottomEdgeBounds, activityOverlayHtml };
