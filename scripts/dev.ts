import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const backend = spawn('npm', ['run', 'dev:api'], { stdio: 'inherit' });
const frontend = await createServer();
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend.kill('SIGTERM');
  await frontend.close();
  process.exitCode = code;
}
backend.once('exit', code => { if (!stopping) void stop(code ?? 1); });
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try { await frontend.listen(); frontend.printUrls(); }
catch (error) { console.error(error); await stop(1); }
