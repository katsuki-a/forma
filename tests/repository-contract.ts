import { expect, test } from 'vitest';
import type { Repository } from '../src/domain/repository.ts';
import { templates } from '../src/contracts/model.ts';
import { createService } from '../src/domain/service.ts';

export function repositoryContract(factory: () => Promise<Repository>) {
  test('FRM-041 作成・取得・更新・削除で保存契約を維持する', async () => {
    const repository = await factory();
    const service = createService(repository, { id: () => crypto.randomUUID(), now: () => '2026-09-06T00:00:00Z', actor: 'test-user' });
    let app = await service.create(templates[0]);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, { title: '保存の確認' });
    expect(await repository.get(app.id)).toEqual(app);
    const detached = (await repository.get(app.id))!;
    detached.draft.name = '保存していない変更';
    expect((await repository.get(app.id))!.draft.name).toBe(templates[0].name);
    app = await service.deleteRecords(app.id, app.revision, [app.records[0].id]);
    expect((await repository.list())[0].records).toEqual([]);
  });
  test('FRM-041 同時更新では一方だけを原子的に保存する', async () => {
    const repository = await factory();
    const service = createService(repository, { id: () => crypto.randomUUID(), now: () => '2026-09-06T00:00:00Z', actor: 'test-user' });
    let app = await service.create(templates[0]);
    app = await service.publish(app.id, app.revision);
    const results = await Promise.allSettled([service.saveRecord(app.id, app.revision, { title: 'a' }), service.saveRecord(app.id, app.revision, { title: 'b' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await repository.get(app.id))!.records).toHaveLength(1);
  });
}
