'use strict';

const UUID = 'de.lucat.ets2la';
const ACTIONS = [
  { id: 'assist', name: 'Assistenten ein/aus', label: 'ASSIST', command: 'assist.toggle', icon: 'power' },
  { id: 'acc', name: 'ACC ein/aus', label: 'ACC', command: 'acc.toggle', icon: 'gauge' },
  { id: 'lane', name: 'Spurhalten ein/aus', label: 'SPUR', command: 'lane.toggle', icon: 'lane' },
  { id: 'mode', name: 'Fahrmodus wechseln', label: 'MODUS', command: 'mode.cycle', icon: 'lane' },
  { id: 'cancel', name: 'Assistenten ausschalten', label: 'CANCEL', command: 'assist.cancel', icon: 'cancel' },
  { id: 'resume', name: 'Assistenten fortsetzen', label: 'RESUME', command: 'assist.resume', icon: 'resume' },
  { id: 'speed-mode', name: 'Straßenlimit / eigenes Tempo', label: 'TEMPOLIMIT', command: 'speed.toggle', icon: 'gauge' },
  { id: 'speed-up', name: 'Zieltempo erhöhen', label: 'TEMPO +', command: 'speed.increase', icon: 'plus' },
  { id: 'speed-down', name: 'Zieltempo verringern', label: 'TEMPO −', command: 'speed.decrease', icon: 'minus' },
  { id: 'speed-preset', name: 'Eigenes Zieltempo setzen', label: 'VORGABE', command: 'speed.set', icon: 'gauge' },
  { id: 'speed-capture', name: 'Aktuelles Tempo übernehmen', label: 'SET', command: 'speed.capture', icon: 'gauge' },
  { id: 'speed', name: 'Geschwindigkeit anzeigen', label: 'TEMPO', icon: 'gauge' },
  { id: 'target', name: 'Zieltempo anzeigen', label: 'ZIELTEMPO', icon: 'gauge' },
  { id: 'status', name: 'Verbindung und Fahrstatus', label: 'ETS2LA', icon: 'dashboard' },
  { id: 'distance', name: 'Folgeabstand wechseln', label: 'ABSTAND', command: 'distance.cycle', icon: 'distance' },
  { id: 'response', name: 'ACC-Reaktion wechseln', label: 'ACC REAKTION', command: 'response.cycle', icon: 'wave' },
  { id: 'steering', name: 'Lenkempfindlichkeit wechseln', label: 'LENKUNG', command: 'steering.cycle', icon: 'lane' },
  { id: 'collision', name: 'Kollisionsvermeidung wechseln', label: 'KOLLISION', command: 'collision.cycle', icon: 'shield' },
  { id: 'warning', name: 'Tempolimit-Warnung wechseln', label: 'WARNUNG', command: 'warning.cycle', icon: 'speaker' },
  { id: 'traffic-lights', name: 'Ampeln beachten ein/aus', label: 'AMPELN', command: 'traffic-lights.toggle', icon: 'traffic' },
  { id: 'gates', name: 'Schranken beachten ein/aus', label: 'SCHRANKEN', command: 'gates.toggle', icon: 'gate' },
  { id: 'stability', name: 'Pause bei Instabilität ein/aus', label: 'STABILITÄT', command: 'stability.toggle', icon: 'shield' },
];

function actionFor(uuid) { return ACTIONS.find(action => `${UUID}.${action.id}` === uuid); }

function toKph(value, unit) { return unit === 'mph' ? value * 1.609344 : value; }

function commandFor(action, settings = {}, deck) {
  if (!action?.command) return null;
  const unit = settings.unit === 'mph' ? 'mph' : settings.unit === 'km/h' ? 'km/h' : deck?.game.displayUnit ?? 'km/h';
  let value;
  if (action.id === 'speed-up' || action.id === 'speed-down') {
    value = Number(settings.step ?? 1);
    if (!Number.isFinite(value) || value < 0.1 || value > 30) throw new Error('Schrittweite muss zwischen 0,1 und 30 liegen.');
    value = toKph(value, unit);
  }
  if (action.id === 'speed-preset') {
    value = Number(settings.speed ?? 80);
    if (!Number.isFinite(value) || value <= 0 || toKph(value, unit) > 300) throw new Error('Ungültiges Zieltempo.');
    value = toKph(value, unit);
  }
  if (action.id === 'speed-mode' && settings.manualSpeed !== undefined && settings.manualSpeed !== '') {
    value = Number(settings.manualSpeed);
    if (!Number.isFinite(value) || value <= 0 || toKph(value, unit) > 300) throw new Error('Ungültiges eigenes Tempo.');
    value = toKph(value, unit);
  }
  return { action: action.command, ...(value === undefined ? {} : { value }) };
}

module.exports = { UUID, ACTIONS, actionFor, commandFor };
