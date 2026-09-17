#!/usr/bin/env node
// Helper to control system-wide overlay: node overlay-control.js show|hide|click x y label
import fs from 'node:fs';
const file = 'C:/Users/HP/windows-system-agent/overlay-agent.json';
function write(o){ fs.writeFileSync(file, JSON.stringify(o)); console.log(JSON.stringify(o)); }
const cmd = process.argv[2];
if (cmd === 'show') {
  const text = process.argv[3] || 'WinAgent is working';
  const sub = process.argv[4] || ' • file access';
  write({ active:true, x:960, y:540, action:'file', target:'', text, sub, ripple:false });
} else if (cmd === 'hide') {
  write({ active:false, x:0, y:0, action:'', target:'', text:'WinAgent is working', sub:' • idle', ripple:false });
} else if (cmd === 'click') {
  const x = Number(process.argv[3]||960), y=Number(process.argv[4]||540);
  const label = process.argv[5]||'click';
  write({ active:true, x, y, action:'click', target:label, text:'WinAgent is working', sub:' • clicking', ripple:true });
  setTimeout(()=> write({ active:true, x, y, action:'click', target:label, text:'WinAgent is working', sub:' • clicking', ripple:false }), 500);
} else if (cmd === 'drag') {
  const x = Number(process.argv[3]||960), y=Number(process.argv[4]||540);
  write({ active:true, x, y, action:'drag', target:'', text:'WinAgent is working', sub:' • dragging', ripple:false });
} else if (cmd === 'type') {
  const x = Number(process.argv[3]||960), y=Number(process.argv[4]||540);
  write({ active:true, x, y, action:'type', target:'', text:'WinAgent is working', sub:' • typing', ripple:false });
} else {
  console.log('usage: node overlay-control.js show|hide|click x y [label]|drag x y|type x y');
}
