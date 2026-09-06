import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'docs/'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
let ignored = false;
try {
  execFileSync('git', ['check-ignore', '--no-index', '-q', 'docs/.privacy-check'], { cwd, stdio: 'ignore' });
  ignored = true;
} catch { /* A missing ignore rule must fail the check. */ }
const ok = ignored && tracked.length === 0;
process.stdout.write(`${JSON.stringify({ ok, docsIgnored: ignored, trackedPrivateFiles: tracked.length })}\n`);
process.exitCode = ok ? 0 : 1;
