'use strict';
let socket, context, action, settings = {};
const byId = id => document.getElementById(id);
const send = value => { if (socket?.readyState === 1) socket.send(JSON.stringify(value)); };
const pluginMessage = payload => send({ event: 'sendToPlugin', action, context, payload });
const descriptions = {
  'speed-mode': 'Drücken wechselt zwischen dem aktuellen Straßenlimit und deinem eigenen Zieltempo. Das Schild zeigt den ausgewählten Modus live an.',
  'speed-up': 'Erhöht das Zieltempo und wechselt auf eigenes Tempo. Schaltet die Assistenten nicht ein.',
  'speed-down': 'Verringert das Zieltempo und wechselt auf eigenes Tempo. Schaltet die Assistenten nicht ein.',
  'speed-preset': 'Übernimmt diese Tempo-Vorgabe im manuellen Modus. Du kannst mehrere Tasten mit unterschiedlichen Werten anlegen.',
  'speed-capture': 'Übernimmt die aktuelle Geschwindigkeit als eigenes Zieltempo. Schaltet die Assistenten nicht ein.',
  assist: 'Schaltet die Assistenten im ausgewählten Fahrmodus ein oder aus.',
  acc: 'Schaltet ACC separat hinzu oder ab. Ein bereits eingeschalteter Spurassistent bleibt erhalten.',
  lane: 'Schaltet Spurhalten separat hinzu oder ab. Ein bereits eingeschalteter ACC bleibt erhalten.',
  cancel: 'Schaltet alle ETS2LA-Fahrassistenten aus.',
  resume: 'Schaltet den ausgewählten Fahrmodus mit dem aktuellen Zieltempo ein.',
  mode: 'Wechselt zwischen ACC + Spurhalten, nur ACC und nur Spurhalten.',
  speed: 'Zeigt die aktuelle Geschwindigkeit aus der Spieltelemetrie an.',
  target: 'Zeigt das aktuelle ETS2LA-Zieltempo an, einschließlich Änderungen über Tastatur und Lenkrad.',
  status: 'Zeigt Verbindung, Spielpause und die Freigabe der Assistenten an.',
  distance: 'Wechselt den Folgeabstand: nah → normal → weit.',
  response: 'Wechselt die ACC-Reaktion: sanft → normal → schnell.',
  steering: 'Wechselt die Lenkempfindlichkeit: sanft → normal → schnell.',
  collision: 'Wechselt die Kollisionsvermeidung: aus → spät → mittel → früh.',
  warning: 'Wechselt die Tempolimit-Warnung: aus → visuell → mit Ton.',
  'traffic-lights': 'Schaltet das Beachten von Ampeln in ETS2LA ein oder aus.',
  gates: 'Schaltet das Beachten von Schranken in ETS2LA ein oder aus.',
  stability: 'Schaltet die automatische Assistenzpause bei Instabilität ein oder aus.',
};

function populate() {
  const id = action.split('.').at(-1);
  byId('description').textContent = descriptions[id] ?? 'ETS2LA-Aktion';
  byId('speed-mode').hidden = id !== 'speed-mode';
  byId('step-group').hidden = !['speed-up', 'speed-down'].includes(id);
  byId('preset-group').hidden = id !== 'speed-preset';
  byId('unit-group').hidden = !['speed-mode', 'speed-up', 'speed-down', 'speed-preset', 'speed-capture', 'speed', 'target'].includes(id);
  byId('manualSpeed').value = settings.manualSpeed ?? '';
  byId('step').value = settings.step ?? 1;
  byId('speed').value = settings.speed ?? 80;
  byId('unit').value = settings.unit ?? 'auto';
}

window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
  const item = JSON.parse(actionInfo);
  context = item.context || uuid;
  action = item.action;
  settings = item.payload?.settings ?? {};
  populate();
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.addEventListener('open', () => {
    send({ event, uuid });
    pluginMessage({ type: 'getStatus' });
  });
  socket.addEventListener('message', message => {
    let data;
    try { data = JSON.parse(message.data); } catch { return; }
    if (data.event === 'didReceiveSettings') { settings = data.payload.settings; populate(); }
    if (data.event !== 'sendToPropertyInspector') return;
    const payload = data.payload;
    byId('dot').classList.toggle('online', payload.connected);
    byId('connection').textContent = payload.connected ? 'Verbunden' : 'Nicht verbunden';
    if (document.activeElement !== byId('port')) byId('port').value = payload.port ?? 38120;
    byId('error').textContent = payload.error || '';
    if (!payload.connected || !payload.state) {
      byId('status').textContent = 'ETS2LA starten und „Stream Deck Bridge“ im Plugin-Manager einschalten.';
      return;
    }
    const game = payload.state.game;
    if (!game.gameRunning || !game.telemetryFresh) { byId('status').textContent = 'ETS2LA verbunden · warte auf aktuelle Spieldaten.'; return; }
    const format = value => value === null ? 'unbekannt' : `${Math.round(value)} km/h`;
    byId('status').textContent = `${game.paused ? 'Spiel pausiert' : 'Spiel verbunden'} · Assist ${game.assistsEnabled ? 'ein' : 'aus'}\n` +
      `Straßenlimit: ${format(game.roadLimitKph)}\nZieltempo: ${format(game.targetSpeedKph)} · ${payload.state.speedMode === 'road' ? 'Straße' : 'Eigenes Tempo'}\n` +
      `Gespeichert: ${format(payload.state.manualSpeedKph)}`;
  });
};

for (const id of ['manualSpeed', 'step', 'speed', 'unit']) {
  byId(id).addEventListener('change', () => {
    const input = byId(id);
    if (id !== 'unit' && !input.checkValidity()) { input.reportValidity(); return; }
    if (id === 'manualSpeed' && input.value === '') delete settings[id];
    else settings[id] = id === 'unit' ? input.value : Number(input.value);
    send({ event: 'setSettings', action, context, payload: settings });
  });
}
byId('save-port').addEventListener('click', () => {
  if (byId('port').reportValidity()) pluginMessage({ type: 'setPort', port: Number(byId('port').value) });
});
