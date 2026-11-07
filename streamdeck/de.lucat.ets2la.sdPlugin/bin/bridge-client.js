'use strict';
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

class BridgeClient extends EventEmitter {
  constructor({ port = 38120, WebSocketClass = WebSocket, staleMs = 1600, reconnectMs = 1000 } = {}) {
    super();
    this.port = port;
    this.WebSocketClass = WebSocketClass;
    this.staleMs = staleMs;
    this.reconnectMs = reconnectMs;
    this.state = null;
    this.pending = new Map();
    this.stopped = true;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
    this.watchdog = setInterval(() => {
      if (this.socket && Date.now() - this.lastMessage > this.staleMs) {
        this.offline();
        this.socket.close();
      }
    }, 400);
  }

  setPort(port) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Ungültiger Port.');
    if (port === this.port) return;
    this.stop(); this.port = port; this.start();
  }

  connect() {
    if (this.stopped) return;
    const socket = new this.WebSocketClass(`ws://127.0.0.1:${this.port}/ets2la`);
    this.socket = socket;
    this.lastMessage = Date.now();
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return;
      try {
        const message = JSON.parse(String(event.data));
        if (message.protocol !== 1) return;
        if (message.type === 'state' && validState(message.state)) {
          this.lastMessage = Date.now();
          this.state = message.state;
          this.emit('state', this.state);
        } else if (message.type === 'result') {
          const pending = this.pending.get(message.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(message.id);
            if (message.ok === true) pending.resolve(message);
            else pending.reject(new Error(message.error || 'Befehl wurde abgelehnt.'));
          }
        }
      } catch { /* Ignore malformed or incompatible packets; watchdog detects a stale peer. */ }
    });
    socket.addEventListener('error', () => { if (this.socket === socket) socket.close(); });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.offline();
      if (!this.stopped) this.reconnect = setTimeout(() => this.connect(), this.reconnectMs);
    });
  }

  offline() {
    if (this.state !== null) { this.state = null; this.emit('state', null); }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Verbindung zu ETS2LA unterbrochen.'));
    }
    this.pending.clear();
  }

  send(action, value) {
    if (!this.state || Date.now() - this.lastMessage > this.staleMs || this.socket?.readyState !== 1)
      return Promise.reject(new Error('ETS2LA ist nicht verbunden.'));
    if (this.pending.size >= 16) return Promise.reject(new Error('Zu viele ausstehende Befehle.'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('ETS2LA hat den Befehl nicht rechtzeitig bestätigt.'));
      }, 2500);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ type: 'command', protocol: 1,
          command: { id, action, issuedAt: Date.now(), ...(value === undefined ? {} : { value }) } }));
      } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnect);
    clearInterval(this.watchdog);
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
    this.offline();
  }
}

function validState(state) {
  const game = state?.game;
  return game && ['road', 'manual'].includes(state.speedMode) &&
    typeof game.assistsEnabled === 'boolean' && typeof game.gameRunning === 'boolean' &&
    typeof game.telemetryFresh === 'boolean' && typeof game.paused === 'boolean' &&
    ['full', 'acc', 'lane'].includes(game.drivingMode) &&
    Number.isFinite(game.speedKph) && Number.isFinite(game.targetSpeedKph);
}
module.exports = { BridgeClient, validState };
