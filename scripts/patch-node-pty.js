const fs = require('fs');
const path = require('path');

// Fix node-pty's winpty.gyp hardcoded Spectre setting on Windows builds
const winptyGypPath = path.resolve(__dirname, '../node_modules/node-pty/deps/winpty/src/winpty.gyp');

if (fs.existsSync(winptyGypPath)) {
  try {
    let content = fs.readFileSync(winptyGypPath, 'utf8');
    if (content.includes("'SpectreMitigation': 'Spectre'")) {
      content = content.replace(/'SpectreMitigation': 'Spectre'/g, "'SpectreMitigation': 'false'");
      fs.writeFileSync(winptyGypPath, content, 'utf8');
      console.log('[patch-node-pty] Successfully patched winpty.gyp SpectreMitigation to false.');
    }
  } catch (err) {
    console.warn('[patch-node-pty] Could not patch winpty.gyp:', err.message);
  }
}
