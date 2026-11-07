'use strict';
// Optional development helper. The shipped plugin itself has no dependencies.
const sharp = require(process.argv[2] || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const logo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="48" fill="#111b25"/><path d="M72 194 96 52m88 142L160 52M128 56v27m0 28v25m0 28v29" fill="none" stroke="#55e6ad" stroke-width="12" stroke-linecap="round"/></svg>');
Promise.all([
  sharp(fs.readFileSync(path.join(root, 'artifacts/Vorschau.svg'))).png().toFile(path.join(root, 'artifacts/Vorschau.png')),
  sharp(logo).png().toFile(path.join(root, 'streamdeck/de.lucat.ets2la.sdPlugin/imgs/plugin.png')),
  sharp(logo).resize(512, 512).png().toFile(path.join(root, 'streamdeck/de.lucat.ets2la.sdPlugin/imgs/plugin@2x.png')),
]).then(() => console.log('PNG-Vorschau und Plugin-Icons erstellt.')).catch(error => { console.error(error); process.exitCode = 1; });
