import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DB_DIR } from '../database/schema';

// Developer credentials live in a plain JSON file next to the JWT secret
// (NOT in the database), so they survive missing/corrupt/locked databases.

const DEV_FILE = path.join(DB_DIR, '.dev-credentials');

export const DEFAULT_DEV_USERNAME = 'dev-admin';

// There is deliberately no built-in default password. Set DEV_ADMIN_PASSWORD
// in backend/.env to choose one; otherwise a random one is generated for this
// install, written hashed to .dev-credentials, and printed to the server
// console exactly once at first boot. A constant here would be a credential
// shared by every copy of this repository.
function initialPassword(): { password: string; fromEnv: boolean } {
  const fromEnv = process.env.DEV_ADMIN_PASSWORD || '';
  if (fromEnv) return { password: fromEnv, fromEnv: true };
  return { password: crypto.randomBytes(18).toString('base64url'), fromEnv: false };
}

interface DevCredential {
  username: string;
  password_hash: string;
  default_password: boolean;
  updated_at?: string;
}

let cached: DevCredential | null = null;

function readFile(): DevCredential | null {
  try {
    if (fs.existsSync(DEV_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DEV_FILE, 'utf8'));
      if (parsed && typeof parsed.username === 'string' && typeof parsed.password_hash === 'string') {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function writeFile(cred: DevCredential): void {
  try {
    fs.mkdirSync(path.dirname(DEV_FILE), { recursive: true });
    fs.writeFileSync(DEV_FILE, JSON.stringify(cred, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('[dev-credentials] Could not write credentials file:', e);
  }
}

export function resetDevCredentialCache(): void {
  cached = null;
}

export function getDevCredential(): DevCredential {
  if (cached) return cached;
  const existing = readFile();
  let cred: DevCredential;
  if (existing) {
    cred = existing;
  } else {
    const initial = initialPassword();
    cred = {
      username: DEFAULT_DEV_USERNAME,
      password_hash: bcrypt.hashSync(initial.password, 10),
      default_password: true,
      updated_at: new Date().toISOString(),
    };
    writeFile(cred);
    console.log('[dev-credentials] Created developer login for this install.');
    console.log(`[dev-credentials] Username: ${cred.username}`);
    if (initial.fromEnv) {
      console.log('[dev-credentials] Password: taken from DEV_ADMIN_PASSWORD (not shown).');
    } else {
      console.log(`[dev-credentials] Password (shown once, save it now): ${initial.password}`);
    }
    console.log('[dev-credentials] Change this password as soon as possible from the Developer page (Dev Tools tab).');
  }
  cached = cred;
  return cred;
}

export function checkDevLogin(username: string, password: string): boolean {
  const cred = getDevCredential();
  return cred.username === username && bcrypt.compareSync(password, cred.password_hash);
}

export function changeDevPassword(username: string, newPassword: string): { username: string; default_password: boolean } {
  const cred = getDevCredential();
  const updated: DevCredential = {
    username: cred.username,
    password_hash: bcrypt.hashSync(newPassword, 10),
    default_password: false,
    updated_at: new Date().toISOString(),
  };
  writeFile(updated);
  cached = updated;
  return { username: updated.username, default_password: updated.default_password };
}