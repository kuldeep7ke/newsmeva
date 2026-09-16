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

const ASSETS = ['index.html', 'css', 'js', 'vendor', 'assets', 'robots.txt', 'sitemap.xml'];

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

// Version all module imports so stale browser/HTTP caches never serve a
// mismatched mix of old and new JS modules after a deploy.
function versionJsTree(dir, version) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return versionJsTree(full, version);
    if (e.name.endsWith('.js')) {
      let src = fs.readFileSync(full, 'utf8');
      src = src.replace(/(['"])(\.\/[^'"]*\.js)\1/g, `$1$2?v=${version}$1`);
      fs.writeFileSync(full, src);
    }
  });
}

const VERSION = Date.now();
versionJsTree(path.join(WWW, 'js'), VERSION);

const htmlPath = path.join(WWW, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('src="js/app.js"', `src="js/app.js?v=${VERSION}"`);
fs.writeFileSync(htmlPath, html);

console.log(`Build complete: ${ASSETS.join(', ')} → www/ (version ${VERSION})`);
