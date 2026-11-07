'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const plugin = path.resolve(__dirname, '../streamdeck/de.lucat.ets2la.sdPlugin/bin');
const { ACTIONS, UUID, actionFor, commandFor } = require(path.join(plugin, 'catalog'));
const { render } = require(path.join(plugin, 'render'));
const { BridgeClient, validState } = require(path.join(plugin, 'bridge-client'));
const { Controller } = require(path.join(plugin, 'controller'));
const vm = require('node:vm');
const fs = require('node:fs');

const snapshot = () => ({ speedMode: 'road', manualSpeedKph: 90, game: {
  gameRunning: true, telemetryFresh: true, paused: false, assistsEnabled: true,
  drivingMode: 'full', accAvailable: true, laneAvailable: true,
  speedKph: 79, targetSpeedKph: 80, roadLimitKph: 80, displayUnit: 'km/h',
  followingDistance: 1, accelerationResponse: 1, steeringSensitivity: 1,
  collisionAvoidance: 3, speedLimitWarning: 1, trafficLightsEnabled: true, gatesEnabled: true, pauseWhenUnstable: true,
} });

class FakeSocket extends EventTarget {
  static sockets = [];
  constructor(url) { super(); this.url = url; this.readyState = 0; this.sent = []; FakeSocket.sockets.push(this); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(data) { this.dispatchEvent(new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) })); }
  send(data) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(JSON.parse(data)); }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.dispatchEvent(new Event('close')); }
}

test('catalog has unique native actions and rejects unknown action UUIDs', () => {
  assert.equal(new Set(ACTIONS.map(action => action.id)).size, 22);
  assert.equal(actionFor('another.plugin.acc'), undefined);
  for (const action of ACTIONS) assert.equal(actionFor(`${UUID}.${action.id}`), action);
});

test('speed settings convert mph to the km/h wire protocol', () => {
  assert.equal(commandFor(actionFor(`${UUID}.speed-up`), { unit: 'mph', step: 5 }, snapshot()).value, 8.04672);
  assert.equal(commandFor(actionFor(`${UUID}.speed-preset`), { speed: 90 }, snapshot()).value, 90);
  assert.equal(commandFor(actionFor(`${UUID}.speed-mode`), { manualSpeed: '' }, snapshot()).value, undefined);
  assert.equal(commandFor(actionFor(`${UUID}.speed-mode`), { manualSpeed: 85 }, snapshot()).value, 85);
  assert.throws(() => commandFor(actionFor(`${UUID}.speed-up`), { step: -1 }, snapshot()));
  assert.throws(() => commandFor(actionFor(`${UUID}.speed-preset`), { speed: 'bad' }, snapshot()));
  assert.equal(commandFor(actionFor(`${UUID}.speed`), {}, snapshot()), null);
});

test('road/manual icon follows the authoritative state and uses a real sign', () => {
  const deck = snapshot();
  const road = render('speed-mode', deck);
  assert.match(road, /STRASSENLIMIT/); assert.match(road, />80</); assert.match(road, /<circle/);
  deck.speedMode = 'manual'; deck.game.targetSpeedKph = 90;
  const manual = render('speed-mode', deck);
  assert.match(manual, /EIGENES TEMPO/); assert.match(manual, />90</); assert.match(manual, /STR 80/);
  deck.speedMode = 'road'; deck.game.roadLimitKph = null;
  assert.match(render('speed-mode', deck), />–</);
  assert.doesNotMatch(render('speed-mode', null), />80</);
  assert.match(render('speed-mode', null), /OFFLINE/);
});

test('all actions render complete icons without undefined or NaN', () => {
  for (const action of ACTIONS) {
    for (const deck of [snapshot(), null]) {
      const svg = render(action.id, deck);
      assert.match(svg, /^<svg/); assert.doesNotMatch(svg, /undefined|NaN|<script/);
    }
  }
  assert.match(render('speed', snapshot(), { unit: 'mph' }), />49</);
});

test('absent or paused game is not displayed as active driving', () => {
  const deck = snapshot(); deck.game.paused = true;
  assert.match(render('status', deck), /PAUSE/); assert.match(render('acc', deck), />PAUSE</);
  deck.game.telemetryFresh = false;
  assert.match(render('speed-mode', deck), /KEIN SPIEL/);
  deck.game.paused = false;
  assert.doesNotMatch(render('acc', deck), />EIN</);
});

test('controller renders only changes and sends one command on keyDown', async () => {
  const bridge = new EventEmitter(); bridge.state = snapshot(); bridge.port = 38120;
  const commands = []; bridge.send = async (...args) => commands.push(args);
  const messages = []; const controller = new Controller(message => messages.push(message), bridge);
  await controller.handle({ event: 'willAppear', context: 'key1', action: `${UUID}.speed-up`, payload: { settings: { step: 5 } } });
  const initialCount = messages.length;
  bridge.emit('state', bridge.state); assert.equal(messages.length, initialCount);
  await controller.handle({ event: 'keyDown', context: 'key1' });
  await controller.handle({ event: 'keyUp', context: 'key1' });
  assert.deepEqual(commands, [['speed.increase', 5]]);
  await controller.handle({ event: 'didReceiveSettings', context: 'key1', payload: { settings: { step: 10 } } });
  await controller.handle({ event: 'keyDown', context: 'key1' });
  assert.deepEqual(commands.at(-1), ['speed.increase', 10]);
  bridge.state = null; bridge.emit('state', null); assert.ok(messages.length > initialCount);
  await controller.handle({ event: 'willDisappear', context: 'key1' });
  assert.equal(controller.contexts.size, 0);
});

test('live road limit, speed and target changes generate new image pixels, without a key press', async () => {
  const bridge = new EventEmitter(); bridge.state = snapshot();
  const messages = []; const controller = new Controller(message => messages.push(message), bridge);
  for (const id of ['speed-mode', 'speed', 'target'])
    await controller.handle({ event: 'willAppear', context: id, action: `${UUID}.${id}` });
  const lastImage = context => {
    const packet = messages.filter(message => message.event === 'setImage' && message.context === context).at(-1);
    return Buffer.from(packet.payload.image.split(',')[1], 'base64').toString();
  };
  assert.match(lastImage('speed-mode'), />80</);
  const previous = lastImage('speed-mode');
  bridge.state.game.roadLimitKph = 57;
  bridge.state.game.speedKph = 43;
  bridge.state.game.targetSpeedKph = 57;
  bridge.emit('state', bridge.state);
  assert.match(lastImage('speed-mode'), />57</);
  assert.match(lastImage('speed'), />43</);
  assert.match(lastImage('target'), />57</);
  assert.notEqual(lastImage('speed-mode'), previous);
  bridge.state.speedMode = 'manual'; bridge.state.game.targetSpeedKph = 103;
  bridge.emit('state', bridge.state);
  assert.match(lastImage('speed-mode'), />103</);
  assert.match(lastImage('speed-mode'), /STR 57/);
  bridge.state.game.targetSpeedKph = 104; bridge.emit('state', bridge.state);
  assert.match(lastImage('speed-mode'), />104</);
  assert.match(lastImage('target'), />104</);
  const count = messages.length; bridge.emit('state', bridge.state);
  assert.equal(messages.length, count, 'unchanged numbers do not flood Stream Deck with redundant images');
  bridge.state = null; bridge.emit('state', null);
  for (const id of ['speed-mode', 'speed', 'target']) {
    assert.match(lastImage(id), />–</);
    assert.doesNotMatch(lastImage(id), />57<|>43<|>103<|>104</);
  }
});

test('preset number redraws immediately when its configured value changes', async () => {
  const bridge = new EventEmitter(); bridge.state = snapshot();
  const messages = []; const controller = new Controller(message => messages.push(message), bridge);
  await controller.handle({ event: 'willAppear', context: 'preset', action: `${UUID}.speed-preset`, payload: { settings: { speed: 83 } } });
  await controller.handle({ event: 'didReceiveSettings', context: 'preset', payload: { settings: { speed: 97 } } });
  const images = messages.filter(message => message.event === 'setImage');
  assert.equal(images.length, 2);
  const svg = Buffer.from(images.at(-1).payload.image.split(',')[1], 'base64').toString();
  assert.match(svg, />97</); assert.doesNotMatch(svg, />83</);
});

test('command rejection displays an alert and never changes status optimistically', async () => {
  const bridge = new EventEmitter(); bridge.state = snapshot();
  bridge.send = async () => { throw new Error('Spiel pausiert'); };
  const messages = []; const controller = new Controller(message => messages.push(message), bridge);
  await controller.handle({ event: 'willAppear', context: 'key1', action: `${UUID}.assist` });
  const oldSvg = controller.contexts.get('key1').lastSvg;
  await controller.handle({ event: 'keyDown', context: 'key1' });
  assert.ok(messages.some(message => message.event === 'showAlert'));
  assert.equal(controller.contexts.get('key1').lastSvg, oldSvg);
});

test('bridge requires a valid snapshot and acknowledges commands by ID', async t => {
  const bridge = new BridgeClient({ WebSocketClass: FakeSocket }); t.after(() => bridge.stop());
  bridge.start(); const socket = bridge.socket; socket.open();
  await assert.rejects(bridge.send('assist.toggle'), /nicht verbunden/);
  socket.message('{'); socket.message({ type: 'state', protocol: 2, state: snapshot() });
  assert.equal(bridge.state, null);
  socket.message({ type: 'state', protocol: 1, state: snapshot() });
  const promise = bridge.send('speed.set', 85);
  const packet = socket.sent.at(-1);
  assert.equal(packet.command.value, 85); assert.equal(packet.protocol, 1);
  socket.message({ type: 'result', protocol: 1, id: packet.command.id, ok: true });
  await promise; assert.equal(bridge.pending.size, 0);
  assert.equal(bridge.state.game.targetSpeedKph, 80, 'snapshot controls displayed target, not the sent command');
});

test('disconnect rejects in-flight commands and reconnect does not replay them', async t => {
  const bridge = new BridgeClient({ WebSocketClass: FakeSocket, reconnectMs: 5 }); t.after(() => bridge.stop());
  bridge.start(); const socket = bridge.socket; socket.open();
  socket.message({ type: 'state', protocol: 1, state: snapshot() });
  const pending = bridge.send('assist.toggle');
  const rejected = assert.rejects(pending, /unterbrochen/);
  socket.close(); await rejected;
  assert.equal(bridge.state, null);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.notEqual(bridge.socket, socket);
  bridge.socket.open(); bridge.socket.message({ type: 'state', protocol: 1, state: snapshot() });
  assert.equal(bridge.socket.sent.length, 0);
});

test('watchdog clears old status and reconnects a silent peer', async t => {
  const bridge = new BridgeClient({ WebSocketClass: FakeSocket, staleMs: 20, reconnectMs: 5 }); t.after(() => bridge.stop());
  bridge.start(); const socket = bridge.socket; socket.open();
  socket.message({ type: 'state', protocol: 1, state: snapshot() });
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(bridge.state, null); assert.equal(socket.readyState, 3);
});

test('snapshot schema rejects packets without required state fields', () => {
  assert.equal(Boolean(validState({})), false);
  assert.equal(Boolean(validState({ speedMode: 'road', game: {} })), false);
  assert.equal(Boolean(validState(snapshot())), true);
});

test('property inspector registers and saves settings with the required action/context', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', hidden: false, textContent: '', handlers: {},
      classList: { toggle() {} }, checkValidity: () => true, reportValidity: () => true,
      addEventListener(event, callback) { this.handlers[event] = callback; },
    });
    return elements.get(id);
  };
  const sandbox = { window: {}, document: { getElementById: element, activeElement: null },
    WebSocket: FakeSocket, JSON, Number, String };
  vm.runInNewContext(fs.readFileSync(path.join(plugin, '../ui/settings.js'), 'utf8'), sandbox);
  sandbox.window.connectElgatoStreamDeckSocket('12345', 'inspector-uuid', 'registerPropertyInspector', '{}', JSON.stringify({
    action: `${UUID}.speed-up`, context: 'action-context', payload: { settings: { step: 2 } },
  }));
  const socket = FakeSocket.sockets.at(-1); socket.open();
  assert.deepEqual(socket.sent[0], { event: 'registerPropertyInspector', uuid: 'inspector-uuid' });
  assert.equal(socket.sent[1].context, 'action-context');
  element('step').value = '5'; element('step').handlers.change();
  assert.deepEqual(socket.sent.at(-1), { event: 'setSettings', action: `${UUID}.speed-up`, context: 'action-context', payload: { step: 5 } });
  socket.message({ event: 'sendToPropertyInspector', payload: { connected: true, state: snapshot(), port: 38120 } });
  assert.match(element('status').textContent, /80 km\/h/);
  assert.equal(element('connection').textContent, 'Verbunden');
});
