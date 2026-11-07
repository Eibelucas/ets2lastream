'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { once } = require('node:events');
const { BridgeClient } = require('../streamdeck/de.lucat.ets2la.sdPlugin/bin/bridge-client');

test('real Node client ↔ compiled C# bridge: telemetry, commands, status and stop', { timeout: 15000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const portableDotnet = path.join(root, '.tools/dotnet', process.platform === 'win32' ? 'dotnet.exe' : 'dotnet');
  const dotnet = process.env.DOTNET_EXE || (fs.existsSync(portableDotnet) ? portableDotnet : 'dotnet');
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const child = spawn(dotnet, ['tests/Bridge.Tests/bin/Release/net10.0/Bridge.Tests.dll', '--serve', String(port)], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  let logs = '';
  await new Promise((resolve, reject) => {
    child.stdout.on('data', data => { logs += data; if (logs.includes('READY')) resolve(); });
    child.stderr.on('data', data => { logs += data; });
    child.on('error', reject); child.on('exit', code => reject(new Error(`Test bridge exited (${code}): ${logs}`)));
  });
  const client = new BridgeClient({ port }); t.after(() => client.stop());
  const next = once(client, 'state'); client.start();
  const [initial] = await next;
  assert.equal(initial.game.targetSpeedKph, 90);
  await client.send('speed.toggle');
  if (client.state.speedMode !== 'road') await once(client, 'state');
  assert.equal(client.state.speedMode, 'road'); assert.equal(client.state.game.targetSpeedKph, 80);
  await client.send('speed.toggle');
  if (client.state.speedMode !== 'manual') await once(client, 'state');
  assert.equal(client.state.game.targetSpeedKph, 90);
  await client.send('speed.increase', 5);
  if (client.state.game.targetSpeedKph !== 95) await once(client, 'state');
  assert.equal(client.state.game.targetSpeedKph, 95);
  await assert.rejects(client.send('unknown'), /Unbekannte Aktion/);
  await client.send('assist.resume');
  if (!client.state.game.assistsEnabled) await once(client, 'state');
  assert.equal(client.state.game.assistsEnabled, true);
  await client.send('acc.toggle');
  if (client.state.game.drivingMode !== 'lane') await once(client, 'state');
  assert.equal(client.state.game.drivingMode, 'lane');
  await client.send('assist.cancel');
  if (client.state.game.assistsEnabled) await once(client, 'state');
  assert.equal(client.state.game.assistsEnabled, false);
  const disconnected = once(client, 'state'); child.kill();
  await disconnected; assert.equal(client.state, null);
});
