'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const plugin = path.join(root, 'streamdeck/de.lucat.ets2la.sdPlugin');
const { ACTIONS } = require(path.join(plugin, 'bin/catalog'));
const { render } = require(path.join(plugin, 'bin/render'));
const state = { speedMode: 'road', manualSpeedKph: 90, game: {
  gameRunning: true, telemetryFresh: true, paused: false, assistsEnabled: true,
  drivingMode: 'full', accAvailable: true, laneAvailable: true,
  speedKph: 78, targetSpeedKph: 80, roadLimitKph: 80, displayUnit: 'km/h',
  followingDistance: 1, accelerationResponse: 1, steeringSensitivity: 1,
  collisionAvoidance: 3, speedLimitWarning: 1, trafficLightsEnabled: true,
  gatesEnabled: true, pauseWhenUnstable: true,
} };
const manual = structuredClone(state); manual.speedMode = 'manual'; manual.game.targetSpeedKph = 90;
const variants = [['Straßenlimit', render('speed-mode', state)], ['Eigenes Tempo', render('speed-mode', manual)], ['Verbindung getrennt', render('speed-mode', null)]];
const items = ACTIONS.map(action => [action.name, render(action.id, state)]);
function grid(entries) { return entries.map(([name, svg]) => `<figure>${svg}<figcaption>${name}</figcaption></figure>`).join(''); }
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/Vorschau.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><title>ETS2LA · Stream Deck</title><style>body{margin:48px;background:#0c1219;color:#dbe4ed;font:15px system-ui,sans-serif}h1{font-size:30px}p{color:#98a9b9;max-width:760px;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,156px);gap:24px;margin:28px 0 48px}figure{margin:0}figure svg{width:144px;height:144px}figcaption{margin-top:10px;font-size:12px;color:#a8b6c5;min-height:36px;max-width:145px}h2{margin-top:36px;font-size:18px}small{color:#65dba9}</style><small>ETS2LA × STREAM DECK</small><h1>Alles im Blick. Direkt am Deck.</h1><p>22 belegbare Aktionen. Die Tasten spiegeln den aktuellen ETS2LA-Zustand. Beispielwerte in dieser Vorschau: Straßenlimit 80 km/h, eigenes Zieltempo 90 km/h.</p><h2>Eine Taste, zwei Tempomodi</h2><div class="grid">${grid(variants)}</div><h2>Alle Aktionen</h2><div class="grid">${grid(items)}</div><p>Plus/Minus und Tempo-Vorgaben wechseln in den manuellen Modus. Das Aktivieren der Assistenten bleibt eine eigene Aktion.</p></html>`);
const width = 960, cell = 180, height = 90 + Math.ceil((ACTIONS.length + variants.length) / 5) * 200;
const content = [...variants, ...items].map(([name, svg], i) => `<g transform="translate(${30 + i % 5 * cell},${80 + Math.floor(i / 5) * 200})">${svg.replace('<svg ', '<svg x="0" y="0" ')}<text x="72" y="164" text-anchor="middle" font-family="Arial" font-size="11" fill="#a8b6c5">${name.replace(/&/g, '&amp;')}</text></g>`).join('');
fs.writeFileSync(path.join(root, 'artifacts/Vorschau.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0c1219"/><text x="30" y="38" font-size="26" fill="#eef4fa" font-family="Arial">ETS2LA × Stream Deck</text>${content}</svg>`);
console.log('artifacts/Vorschau.html und Vorschau.svg erstellt.');
