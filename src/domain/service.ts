import { AppError, parseDefinition, validateValues } from '../contracts/model.ts';
import type { Application, Values } from '../contracts/model.ts';
import type { Repository } from './repository.ts';

export function createService(repository: Repository, context: { id: () => string; now: () => string; actor: string }) {
  const get = async (id: string) => {
    const app = await repository.get(id);
    if (!app) throw new AppError('not_found', 'アプリが見つかりません。入口から選び直してください。');
    return app;
  };
  const change = async (id: string, revision: number, update: (app: Application) => void) => {
    const app = await get(id);
    if (app.revision !== revision) throw new AppError('conflict', '別の操作で変更されています。最新の内容を読み直してください。');
    update(app);
    app.revision++;
    if (!await repository.compareAndSwap(app, revision)) throw new AppError('conflict', '別の操作で変更されています。最新の内容を読み直してください。');
    return app;
  };
  return {
    list: () => repository.list(), get,
    async create(candidate: unknown) {
      const app: Application = { id: context.id(), revision: 0, draft: parseDefinition(candidate), published: null, records: [], nextNumber: 1 };
      if (!await repository.compareAndSwap(app, null)) throw new AppError('conflict', '作成が競合しました。もう一度お試しください。');
      return app;
    },
    saveDraft: (id: string, revision: number, candidate: unknown) => change(id, revision, app => { app.draft = parseDefinition(candidate); }),
    publish: (id: string, revision: number) => change(id, revision, app => {
      const issues = app.records.flatMap(record => validateValues(app.draft, record.values).map(issue => ({ ...issue, message: `記録${record.number}: ${issue.message}` })));
      if (issues.length) throw new AppError('incompatible_records', '新しい項目に適合しない記録があります。記録または下書きを修正してください。', issues);
      app.published = structuredClone(app.draft);
    }),
    saveRecord: (id: string, revision: number, values: Values, recordId?: string) => change(id, revision, app => {
      if (!app.published) throw new AppError('not_published', '先にアプリの変更を反映してください。');
      const issues = validateValues(app.published, values);
      if (issues.length) throw new AppError('validation', '入力内容を確認してください。', issues);
      const existing = recordId ? app.records.find(r => r.id === recordId) : undefined;
      if (recordId && !existing) throw new AppError('not_found', '記録が見つかりません。最新の内容を読み直してください。');
      if (existing) Object.assign(existing, { values: structuredClone(values), updatedAt: context.now(), updatedBy: context.actor });
      else app.records.push({ id: context.id(), number: app.nextNumber++, values: structuredClone(values), createdAt: context.now(), updatedAt: context.now(), createdBy: context.actor, updatedBy: context.actor });
    }),
    deleteRecords: (id: string, revision: number, ids: string[]) => change(id, revision, app => {
      if (ids.some(recordId => !app.records.some(r => r.id === recordId))) throw new AppError('not_found', '削除対象の記録が見つかりません。最新の内容を読み直してください。');
      app.records = app.records.filter(record => !ids.includes(record.id));
    }),
  };
}
