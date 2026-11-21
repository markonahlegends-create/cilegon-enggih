/**
 * Minimal .env reader for local/self-host runs, avoiding a runtime dependency.
 * Existing process environment (e.g. hosting platform secrets) always wins.
 */
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  const source = fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '');
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      if (raw.includes('"')) value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    process.env[match[1]] = value;
  }
}
