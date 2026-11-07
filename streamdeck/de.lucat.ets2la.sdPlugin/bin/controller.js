'use strict';
const { actionFor, commandFor } = require('./catalog');
const { render, imageData } = require('./render');

class Controller {
  constructor(send, bridge) {
    this.send = send;
    this.bridge = bridge;
    this.contexts = new Map();
    this.inspectors = new Set();
    bridge.on('state', () => { this.renderAll(); this.updateInspectors(); });
  }

  renderAll() { for (const context of this.contexts.keys()) this.renderContext(context); }

  renderContext(context) {
    const item = this.contexts.get(context);
    if (!item) return;
    const svg = render(item.action.id, this.bridge.state, item.settings);
    if (svg === item.lastSvg) return;
    item.lastSvg = svg;
    this.send({ event: 'setImage', context, payload: { image: imageData(svg), target: 0 } });
    this.send({ event: 'setTitle', context, payload: { title: '', target: 0 } });
  }

  updateInspectors(error) {
    for (const context of this.inspectors) this.send({ event: 'sendToPropertyInspector', context,
      payload: { connected: this.bridge.state !== null, state: this.bridge.state, error: error || '', port: this.bridge.port } });
  }

  async handle(message) {
    const context = message.context;
    switch (message.event) {
      case 'willAppear': {
        const action = actionFor(message.action);
        if (action) { this.contexts.set(context, { action, settings: message.payload?.settings ?? {} }); this.renderContext(context); }
        break;
      }
      case 'willDisappear': this.contexts.delete(context); this.inspectors.delete(context); break;
      case 'didReceiveSettings': {
        const item = this.contexts.get(context);
        if (item) { item.settings = message.payload?.settings ?? {}; this.renderContext(context); }
        break;
      }
      case 'keyDown': {
        const item = this.contexts.get(context);
        if (!item) break;
        try {
          const command = commandFor(item.action, item.settings, this.bridge.state);
          if (command) await this.bridge.send(command.action, command.value);
        } catch (error) {
          this.send({ event: 'showAlert', context });
          this.send({ event: 'logMessage', payload: { message: `ETS2LA: ${error.message}` } });
          this.updateInspectors(error.message);
        }
        break;
      }
      case 'propertyInspectorDidAppear': this.inspectors.add(context); this.updateInspectors(); break;
      case 'propertyInspectorDidDisappear': this.inspectors.delete(context); break;
      case 'sendToPlugin':
        if (message.payload?.type === 'getStatus') { this.inspectors.add(context); this.updateInspectors(); }
        break;
      case 'systemDidWakeUp': this.bridge.stop(); this.bridge.start(); break;
    }
  }
}
module.exports = { Controller };
