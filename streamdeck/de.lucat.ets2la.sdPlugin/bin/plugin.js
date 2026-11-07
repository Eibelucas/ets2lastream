'use strict';
const { BridgeClient } = require('./bridge-client');
const { Controller } = require('./controller');

function main(argv = process.argv.slice(2)) {
  const argument = name => argv[argv.indexOf(name) + 1];
  const port = Number(argument('-port'));
  const uuid = argument('-pluginUUID');
  const registerEvent = argument('-registerEvent');
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || !uuid || registerEvent !== 'registerPlugin')
    throw new Error('Dieses Plugin wird von der Stream-Deck-App gestartet.');
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const send = message => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); };
  const bridge = new BridgeClient();
  const controller = new Controller(send, bridge);
  socket.addEventListener('open', () => {
    send({ event: registerEvent, uuid });
    send({ event: 'getGlobalSettings', context: uuid });
    bridge.start();
  });
  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(String(event.data));
      if (message.event === 'didReceiveGlobalSettings') {
        const bridgePort = Number(message.payload?.settings?.port ?? 38120);
        bridge.setPort(bridgePort);
        controller.updateInspectors();
      } else if (message.event === 'sendToPlugin' && message.payload?.type === 'setPort') {
        const bridgePort = Number(message.payload.port);
        bridge.setPort(bridgePort);
        send({ event: 'setGlobalSettings', context: uuid, payload: { port: bridgePort } });
        controller.updateInspectors();
      } else {
        controller.handle(message).catch(error => send({ event: 'logMessage', payload: { message: error.message } }));
      }
    } catch (error) { controller.updateInspectors(error.message); }
  });
  const stop = () => { bridge.stop(); socket.close(); };
  socket.addEventListener('close', () => { bridge.stop(); process.exitCode = 0; });
  socket.addEventListener('error', stop);
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return { bridge, controller, socket, stop };
}
if (require.main === module) main();
module.exports = { main };
