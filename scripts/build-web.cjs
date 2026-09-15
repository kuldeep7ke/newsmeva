#!/usr/bin/env node
/**
 * Build script for News Meva Mini.
 * Copies static web assets into www/ for Capacitor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const MINIAPP = path.join(ROOT, 'miniapp');

const ASSETS = ['index.html', 'css', 'js', 'vendor', 'assets'];

// Clean www/
if (fs.existsSync(WWW)) fs.rmSync(WWW, { recursive: true });
fs.mkdirSync(WWW, { recursive: true });

// Copy assets
for (const asset of ASSETS) {
  const src = path.join(MINIAPP, asset);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(WWW, asset);
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    // Fallback: shell copy (Windows compat)
    const { execSync } = require('child_process');
    execSync(`xcopy /E /I /Y "${src}" "${dest}"`, { stdio: 'pipe' });
  }
}

console.log(`Build complete: ${ASSETS.join(', ')} → www/`);
