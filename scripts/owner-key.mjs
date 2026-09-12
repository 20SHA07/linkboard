import { readFile } from 'node:fs/promises';
try { console.log((await readFile(new URL('../.data/admin-key',import.meta.url),'utf8')).trim()); }
catch { console.error('Start Linkboard with npm start first. If you set ADMIN_KEY yourself, use that value to claim your earlier workspace.');process.exit(1); }
