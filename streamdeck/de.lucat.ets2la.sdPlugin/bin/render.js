'use strict';

const { ACTIONS } = require('./catalog');
const COLORS = { green: '#55e6ad', amber: '#ffcc75', gray: '#82919f', red: '#f16c75', white: '#f2f6fb' };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const text = (value, y, size = 16, color = COLORS.white, extra = '') =>
  `<text x="72" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`;

function symbol(name, color) {
  const paths = {
    power: '<path d="M72 42v32m-17-23a29 29 0 1 0 34 0"/>',
    gauge: '<path d="M44 86a31 31 0 1 1 56 0M72 77l18-20M43 77h7m44 0h7M51 54l5 5m16-18v8"/><circle cx="72" cy="78" r="4"/>',
    lane: '<path d="M48 96l10-51m38 51L86 45M72 48v10m0 12v10m0 12v6"/><path d="M60 92h24l-3-16H63z"/>',
    cancel: '<circle cx="72" cy="72" r="28"/><path d="M61 61l22 22m0-22L61 83"/>',
    resume: '<path d="M59 48v48l35-24z"/>',
    plus: '<path d="M72 47v50M47 72h50"/>',
    minus: '<path d="M47 72h50"/>',
    distance: '<path d="M55 48h34v17H55zM55 85h34v17H55zM72 72v6M49 73h-7m53 0h7"/>',
    wave: '<path d="M40 76h13l10-25 15 44 12-25h14"/>',
    shield: '<path d="M72 42l27 10v22c0 18-27 30-27 30S45 92 45 74V52zM60 73l9 9 16-20"/>',
    speaker: '<path d="M44 64h13l17-15v46L57 80H44zM85 61q15 11 0 22m9-32q24 22 0 42"/>',
    traffic: '<rect x="57" y="40" width="30" height="65" rx="10"/><circle cx="72" cy="53" r="4"/><circle cx="72" cy="72" r="4"/><circle cx="72" cy="91" r="4"/>',
    gate: '<path d="M44 101V68h14v33M58 68l43-26m-35 20 5 8m8-15 5 8m8-15 5 8"/>',
    dashboard: '<rect x="43" y="47" width="58" height="47" rx="8"/><path d="M52 60h15m-15 10h23m-23 10h12m23-20h5m-5 12h5"/>',
  };
  return `<g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.gauge}</g>`;
}

function render(id, deck, settings = {}) {
  const action = ACTIONS.find(item => item.id === id) ?? ACTIONS[0];
  let color = COLORS.gray;
  let content;
  const game = deck?.game;
  const configuredUnit = settings.unit === 'mph' ? 'mph' : settings.unit === 'km/h' ? 'km/h' : game?.displayUnit ?? 'km/h';
  const number = value => Number.isFinite(value) ? String(Math.round(configuredUnit === 'mph' ? value / 1.609344 : value)) : '–';
  const available = game?.gameRunning && game.telemetryFresh;
  const driving = available && !game.paused;
  const enabled = driving && game.assistsEnabled;
  const acc = enabled && game.accAvailable && game.drivingMode !== 'lane';
  const lane = enabled && game.laneAvailable && game.drivingMode !== 'acc';
  const label = action.label;

  if (id === 'speed-mode') {
    const road = deck?.speedMode !== 'manual';
    color = !game ? COLORS.gray : road ? COLORS.green : COLORS.amber;
    const value = available ? number(road ? game.roadLimitKph : game.targetSpeedKph) : '–';
    content = text(!game ? label : road ? 'STRASSENLIMIT' : 'EIGENES TEMPO', 21, 13, color) +
      `<circle cx="72" cy="75" r="41" fill="#f6f5ee" stroke="${!game ? COLORS.gray : road ? '#dc3747' : '#e9ad43'}" stroke-width="8"/>` +
      text(value, 89, value.length > 2 ? 38 : 44, '#16202b') +
      text(!game ? 'OFFLINE' : available ? (road ? `AUTO · ${configuredUnit}` : `STR ${number(game.roadLimitKph)} · ${configuredUnit}`) : 'KEIN SPIEL', 132, 12, color);
  } else if (['speed', 'target', 'speed-preset'].includes(id)) {
    color = !game ? COLORS.gray : id === 'target' ? (deck.speedMode === 'road' ? COLORS.green : COLORS.amber) : COLORS.white;
    let value = id === 'speed' ? (available ? number(game.speedKph) : '–') :
      id === 'target' ? (available ? number(game.targetSpeedKph) : '–') : String(settings.speed ?? 80);
    content = text(label, 23, 14, COLORS.gray) + text(value, 91, 49, color) + text(!game && id !== 'speed-preset' ? 'OFFLINE' : configuredUnit, 124, 16, COLORS.gray);
  } else if (!game) {
    content = text(label, 23, label.length > 10 ? 12 : 15, COLORS.gray) + symbol(action.icon, color) + text('OFFLINE', 127, 16, color);
  } else {
    let footer = '';
    switch (id) {
      case 'assist': color = enabled ? COLORS.green : COLORS.gray; footer = enabled ? 'EIN' : 'AUS'; break;
      case 'acc': color = acc ? COLORS.green : COLORS.gray; footer = !game.accAvailable ? 'PLUGIN AUS' : acc ? 'EIN' : 'AUS'; break;
      case 'lane': color = lane ? COLORS.green : COLORS.gray; footer = !game.laneAvailable ? 'PLUGIN AUS' : lane ? 'EIN' : 'AUS'; break;
      case 'mode': color = COLORS.green; footer = { full: 'ACC + SPUR', acc: 'NUR ACC', lane: 'NUR SPUR' }[game.drivingMode]; break;
      case 'cancel': color = enabled ? COLORS.red : COLORS.gray; footer = 'ALLES AUS'; break;
      case 'resume': color = enabled ? COLORS.green : COLORS.gray; footer = enabled ? 'EIN' : 'FORTSETZEN'; break;
      case 'speed-up': case 'speed-down': color = COLORS.amber; footer = `${id === 'speed-up' ? '+' : '−'}${settings.step ?? 1} ${configuredUnit}`; break;
      case 'speed-capture': color = COLORS.amber; footer = available ? `${number(game.speedKph)} ${configuredUnit}` : '–'; break;
      case 'status': color = !available ? COLORS.gray : game.paused ? COLORS.amber : enabled ? COLORS.green : COLORS.gray;
        footer = !available ? 'KEIN SPIEL' : game.paused ? 'PAUSE' : enabled ? 'ASSIST EIN' : 'BEREIT'; break;
      case 'distance': color = COLORS.green; footer = ['NAH', 'NORMAL', 'WEIT'][game.followingDistance]; break;
      case 'response': color = COLORS.green; footer = ['SANFT', 'NORMAL', 'SCHNELL'][game.accelerationResponse]; break;
      case 'steering': color = COLORS.green; footer = ['SANFT', 'NORMAL', 'SCHNELL'][game.steeringSensitivity]; break;
      case 'collision': color = game.collisionAvoidance ? COLORS.green : COLORS.gray; footer = ['AUS', 'SPÄT', 'MITTEL', 'FRÜH'][game.collisionAvoidance]; break;
      case 'warning': color = game.speedLimitWarning ? COLORS.green : COLORS.gray; footer = ['AUS', 'VISUELL', 'MIT TON'][game.speedLimitWarning]; break;
      case 'traffic-lights': color = game.trafficLightsEnabled ? COLORS.green : COLORS.gray; footer = game.trafficLightsEnabled ? 'BEACHTEN' : 'IGNORIEREN'; break;
      case 'gates': color = game.gatesEnabled ? COLORS.green : COLORS.gray; footer = game.gatesEnabled ? 'BEACHTEN' : 'IGNORIEREN'; break;
      case 'stability': color = game.pauseWhenUnstable ? COLORS.green : COLORS.gray; footer = game.pauseWhenUnstable ? 'AUTO-PAUSE' : 'AUS'; break;
    }
    content = text(label, 23, label.length > 10 ? 12 : 15, COLORS.gray) + symbol(action.icon, color) + text(footer ?? '–', 128, 14, color);
    if (game.paused && ['assist', 'acc', 'lane'].includes(id)) content = content.replace('>AUS<', '>PAUSE<');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="16" fill="#111b25"/><rect x="3" y="3" width="138" height="138" rx="14" fill="none" stroke="#263543" stroke-width="2"/>${content}<rect x="49" y="137" width="46" height="3" rx="1.5" fill="${color}"/></svg>`;
}

function imageData(svg) { return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`; }
module.exports = { render, imageData };
