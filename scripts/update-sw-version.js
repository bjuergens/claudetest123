import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'deploy', 'sw.js');

// Read current sw.js
let swContent = readFileSync(swPath, 'utf-8');

// Generate version from timestamp
const version = Date.now().toString(36);

// Replace the version line
swContent = swContent.replace(
  /const CACHE_VERSION = '[^']*';/,
  `const CACHE_VERSION = '${version}';`
);

// Write back
writeFileSync(swPath, swContent);

console.log(`SW cache version updated to: ${version}`);
