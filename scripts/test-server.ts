import { serve } from '@hono/node-server';
import { createServer } from 'vite';
import { createApi } from '../src/server/api.ts';
import { memoryRepository } from '../src/server/memory-repository.ts';

const api = serve({ fetch: createApi(memoryRepository()).fetch, hostname: '127.0.0.1', port: 8788 });
const ui = await createServer({ server: { port: 3001, strictPort: true, proxy: { '/api/': 'http://127.0.0.1:8788' } } });
await ui.listen();
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await ui.close(); api.close(); }
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
