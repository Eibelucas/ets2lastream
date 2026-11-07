'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const plugin = path.join(root, 'streamdeck/de.lucat.ets2la.sdPlugin');
const { UUID, ACTIONS } = require(path.join(plugin, 'bin/catalog'));
const { render } = require(path.join(plugin, 'bin/render'));

fs.mkdirSync(path.join(plugin, 'imgs'), { recursive: true });
const manifest = {
  $schema: 'https://schemas.elgato.com/streamdeck/plugins/manifest.json',
  UUID, Name: 'ETS2LA', Version: '0.1.1.0', Author: 'Lucat',
  Description: 'ETS2LA steuern und Live-Status anzeigen. Straßenlimit oder eigenes Tempo direkt am Stream Deck.',
  Category: 'ETS2LA', CategoryIcon: 'imgs/category', Icon: 'imgs/plugin',
  CodePath: 'bin/plugin.js', Nodejs: { Version: '24' }, SDKVersion: 2,
  OS: [{ Platform: 'windows', MinimumVersion: '10' }], Software: { MinimumVersion: '7.1' },
  PropertyInspectorPath: 'ui/settings.html',
  Actions: ACTIONS.map(action => ({
    UUID: `${UUID}.${action.id}`, Name: action.name, Icon: `imgs/${action.id}`,
    Tooltip: action.name, Controllers: ['Keypad'], DisableAutomaticStates: true,
    SupportedInMultiActions: false, UserTitleEnabled: false,
    States: [{ Image: `imgs/${action.id}`, ShowTitle: false }],
  })),
};
// Manifest images are placeholders. Live numbers are rendered by Controller.setImage.
for (const action of ACTIONS) fs.writeFileSync(path.join(plugin, `imgs/${action.id}.svg`), render(action.id, null));
fs.writeFileSync(path.join(plugin, 'imgs/category.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M6 24 10 4m12 20L18 4M14 4v4m0 6v4m0 5v1"/></g></svg>');
fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const destination = path.join(root, 'artifacts', `${UUID}.sdPlugin`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(plugin, destination, { recursive: true, filter: source => !source.includes(`${path.sep}logs`) });
console.log(`${ACTIONS.length} Aktionen gebaut: ${destination}`);
