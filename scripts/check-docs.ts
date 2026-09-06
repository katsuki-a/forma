import { readdirSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Document = { path: string; body: string; meta: Record<string, string> };
export type CheckResult = { ok: boolean; documents: number; requirements: number; intentValidation: 'passed' | 'failed' | 'not-run'; errors: string[] };

// Deliberately supports only flat, single-line metadata and inline Markdown links.
export function checkDocuments(input: Map<string, string>, options: { local?: boolean } = {}): CheckResult {
  const files = new Map([...input].filter(([path]) => options.local || !path.startsWith('docs/')));
  const errors: string[] = [];
  const documents: Document[] = [];
  const ids = new Map<string, Document>();
  const requirements = new Set<string>();
  const paths = new Set(files.keys());
  for (const path of files.keys()) {
    let parent = posix.dirname(path);
    while (parent !== '.') {
      paths.add(parent);
      parent = posix.dirname(parent);
    }
  }
  for (const path of ['README.md', 'AGENTS.md', 'spec/README.md', 'adr/README.md', ...(options.local ? ['docs/README.md'] : [])]) {
    if (!files.has(path)) errors.push(`${path}: required document missing`);
  }

  for (const [path, raw] of files) {
    if (!path.endsWith('.md')) continue;
    const header = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const meta: Record<string, string> = {};
    for (const line of (header?.[1] ?? '').split('\n').filter(Boolean)) {
      const entry = line.match(/^([a-z-]+): (.+)$/);
      if (!entry || entry[1] in meta) errors.push(`${path}: invalid or repeated metadata`);
      else meta[entry[1]] = entry[2].trim();
    }
    const body = raw.slice(header?.[0].length ?? 0).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
    const doc = { path, body, meta };
    documents.push(doc);
    if (!/^# .+/m.test(body) && !path.startsWith('.github/')) errors.push(`${path}: title missing`);

    const area = path.split('/')[0];
    const managed = ['docs', 'spec', 'adr'].includes(area) && posix.basename(path) !== 'README.md';
    if (managed) {
      const prefix = { docs: 'INT', spec: 'SPEC', adr: 'ADR' }[area];
      if (!new RegExp(`^${prefix}-[0-9]{3,}$`).test(meta.id ?? '')) errors.push(`${path}: invalid document id`);
      if (!/^\d{4}-[a-z0-9-]+\.md$/.test(posix.basename(path))) errors.push(`${path}: invalid filename`);
      const states = area === 'spec' ? ['active'] : ['proposed', 'accepted', 'rejected', 'superseded'];
      if (!states.includes(meta.status)) errors.push(`${path}: invalid status`);
      if (area !== 'spec' && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date ?? '')) errors.push(`${path}: date missing`);
      if (area === 'docs' && meta.status === 'accepted' &&
          (meta['approved-by'] !== 'PdM' || !meta['approval-evidence'])) errors.push(`${path}: approval evidence missing`);
      if (meta.id) {
        if (ids.has(meta.id)) errors.push(`${path}: duplicate document id ${meta.id}`);
        else ids.set(meta.id, doc);
      }
    }

    if (!path.startsWith('docs/') && /kintone|キントーン|学習のため|勉強のため/i.test(raw)) {
      errors.push(`${path}: product comparison or personal motivation belongs in docs/`);
    }
    for (const link of body.replace(/`[^`\n]+`/g, '').matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const target = link[1].replace(/^<|>$/g, '');
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      let decoded: string;
      try { decoded = decodeURIComponent(target.split(/[?#]/)[0]); }
      catch { errors.push(`${path}: malformed link ${target}`); continue; }
      const dest = posix.normalize(posix.join(posix.dirname(path), decoded)).replace(/\/$/, '');
      if (posix.isAbsolute(decoded) || !paths.has(dest)) errors.push(`${path}: missing or non-relative link ${target}`);
    }
  }

  for (const doc of documents) {
    if (doc.meta.status === 'superseded') {
      const successor = ids.get(doc.meta['superseded-by']);
      if (!successor || successor === doc || successor.meta.id.split('-')[0] !== doc.meta.id?.split('-')[0]) {
        errors.push(`${doc.path}: valid successor missing`);
      }
    }
    if (!doc.path.startsWith('spec/') || posix.basename(doc.path) === 'README.md') continue;
    const sections = doc.body.split(/(?=^## )/m).filter(section => section.startsWith('## '));
    if (!sections.length) errors.push(`${doc.path}: requirements missing`);
    for (const section of sections) {
      const id = section.match(/^## (FRM-\d{3,}): .+/)?.[1];
      if (!id) { errors.push(`${doc.path}: invalid requirement heading`); continue; }
      if (requirements.has(id)) errors.push(`${doc.path}: duplicate requirement id ${id}`);
      requirements.add(id);
      if (!/^確認条件: \S.+/m.test(section)) errors.push(`${id}: acceptance criteria missing`);
      const sourceLine = section.match(/^根拠: (.+)$/m)?.[1] ?? '';
      if (!/^INT-\d{3,}(?:, INT-\d{3,})*$/.test(sourceLine)) {
        errors.push(`${id}: valid intent reference missing`);
        continue;
      }
      if (options.local) {
        for (const intentId of sourceLine.split(', ')) {
          const source = ids.get(intentId);
          if (!source || !source.path.startsWith('docs/') || source.meta.status !== 'accepted') {
            errors.push(`${id}: ${intentId} must reference an accepted intent`);
          }
        }
      }
    }
  }
  return { ok: errors.length === 0, documents: documents.length, requirements: requirements.size, intentValidation: options.local ? (errors.length ? 'failed' : 'passed') : 'not-run', errors };
}

function readRepository(root: string, local: boolean, dir = ''): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'coverage', '.wrangler', '.vitest', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const path = posix.join(dir, entry.name);
    if (path === 'docs' && !local) continue;
    if (entry.isDirectory()) {
      for (const [name, content] of readRepository(root, local, path)) files.set(name, content);
    } else if (entry.isFile()) {
      files.set(path, entry.name.endsWith('.md') ? readFileSync(resolve(root, path), 'utf8') : '');
    }
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const local = process.argv.includes('--local');
  const result = checkDocuments(readRepository(root, local), { local });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
