import type { Application, Values, WorkflowInput } from "../contracts/model.ts";
import {
  AppError,
  parseDefinition,
  prepareValues,
  uniqueIssues,
} from "../contracts/model.ts";
import { changeWorkflow, workflowIssues } from "./workflow.ts";
import { announcementService } from "./announcements.ts";
import type { Repository } from "./repository.ts";

export function createService(
  repository: Repository,
  context: { id: () => string; now: () => string; actor: string },
) {
  const get = async (id: string) => {
    const app = await repository.get(id);
    if (!app)
      throw new AppError(
        "not_found",
        "アプリが見つかりません。入口から選び直してください。",
      );
    return app;
  };
  const change = async (
    id: string,
    revision: number,
    update: (app: Application) => void,
  ) => {
    const app = await get(id);
    if (app.revision !== revision)
      throw new AppError(
        "conflict",
        "別の操作で変更されています。最新の内容を読み直してください。",
      );
    update(app);
    if (app.published) {
      const issues = uniqueIssues(app.published, app.records);
      if (issues.length)
        throw new AppError(
          "validation",
          "重複している項目を修正してください。",
          issues,
        );
    }
    app.revision++;
    if (!(await repository.compareAndSwap(app, revision)))
      throw new AppError(
        "conflict",
        "別の操作で変更されています。最新の内容を読み直してください。",
      );
    return app;
  };
  return {
    ...announcementService(repository, context),
    list: () => repository.list(),
    get,
    async create(candidate: unknown) {
      const app: Application = {
        id: context.id(),
        revision: 0,
        draft: parseDefinition(candidate),
        published: null,
        records: [],
        nextNumber: 1,
      };
      if (!(await repository.compareAndSwap(app, null)))
        throw new AppError(
          "conflict",
          "作成が競合しました。もう一度お試しください。",
        );
      return app;
    },
    saveDraft: (id: string, revision: number, candidate: unknown) =>
      change(id, revision, (app) => {
        app.draft = parseDefinition(candidate);
      }),
    publish: (id: string, revision: number) =>
      change(id, revision, (app) => {
        const prepared = app.records.map((record) => ({
          record,
          ...prepareValues(app.draft, record.values),
        }));
        const issues = prepared.flatMap((item) => [
          ...item.issues.map((issue) => ({
            ...issue,
            message: `記録${item.record.number}: ${issue.message}`,
          })),
          ...workflowIssues(app.draft, item.record),
        ]);
        issues.push(
          ...uniqueIssues(
            app.draft,
            prepared.map((item) => ({ ...item.record, values: item.values })),
          ),
        );
        if (issues.length)
          throw new AppError(
            "incompatible_records",
            "新しい項目に適合しない記録があります。記録または下書きを修正してください。",
            issues,
          );
        app.published = structuredClone(app.draft);
        for (const item of prepared) {
          item.record.values = item.values;
          if (!item.record.workflow && app.draft.workflow)
            item.record.workflow = {
              stateId: app.draft.workflow.initialState,
              assigneeId: null,
            };
        }
      }),
    saveRecord: (
      id: string,
      revision: number,
      values: Values,
      recordId?: string,
    ) =>
      change(id, revision, (app) => {
        if (!app.published)
          throw new AppError(
            "not_published",
            "先にアプリの変更を反映してください。",
          );
        const prepared = prepareValues(app.published, values);
        const issues = prepared.issues;
        if (issues.length)
          throw new AppError(
            "validation",
            "入力内容を確認してください。",
            issues,
          );
        const existing = recordId
          ? app.records.find((r) => r.id === recordId)
          : undefined;
        if (recordId && !existing)
          throw new AppError(
            "not_found",
            "記録が見つかりません。最新の内容を読み直してください。",
          );
        if (existing)
          Object.assign(existing, {
            values: prepared.values,
            updatedAt: context.now(),
            updatedBy: context.actor,
          });
        else
          app.records.push({
            id: context.id(),
            number: app.nextNumber++,
            values: prepared.values,
            workflow: app.published.workflow
              ? {
                  stateId: app.published.workflow.initialState,
                  assigneeId: null,
                }
              : undefined,
            createdAt: context.now(),
            updatedAt: context.now(),
            createdBy: context.actor,
            updatedBy: context.actor,
          });
      }),
    updateWorkflow: (
      id: string,
      revision: number,
      recordId: string,
      input: WorkflowInput,
    ) =>
      change(id, revision, (app) => {
        if (!app.published)
          throw new AppError("not_published", "先にアプリを反映してください。");
        const record = app.records.find((record) => record.id === recordId);
        if (!record) throw new AppError("not_found", "記録が見つかりません。");
        changeWorkflow(app.published, record, input);
        record.updatedAt = context.now();
        record.updatedBy = context.actor;
      }),
    deleteRecords: (id: string, revision: number, ids: string[]) =>
      change(id, revision, (app) => {
        if (ids.some((recordId) => !app.records.some((r) => r.id === recordId)))
          throw new AppError(
            "not_found",
            "削除対象の記録が見つかりません。最新の内容を読み直してください。",
          );
        app.records = app.records.filter((record) => !ids.includes(record.id));
      }),
  };
}
