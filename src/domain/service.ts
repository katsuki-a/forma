import { describe, translator } from "../localization/index.ts";
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
    if (!app) throw new AppError("not_found", describe("errors.appNotFound"));
    return app;
  };
  const change = async (
    id: string,
    revision: number,
    update: (app: Application) => void,
  ) => {
    const app = await get(id);
    if (app.revision !== revision)
      throw new AppError("conflict", describe("errors.conflict"));
    update(app);
    if (app.published) {
      const issues = uniqueIssues(app.published, app.records);
      if (issues.length)
        throw new AppError("validation", describe("errors.duplicates"), issues);
    }
    app.revision++;
    if (!(await repository.compareAndSwap(app, revision)))
      throw new AppError("conflict", describe("errors.conflict"));
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
        throw new AppError("conflict", describe("errors.createConflict"));
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
            recordNumber: item.record.number,
            message: translator.message({
              ...issue,
              recordNumber: item.record.number,
            }),
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
            describe("errors.incompatibleRecords"),
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
          throw new AppError("not_published", describe("errors.notPublished"));
        const prepared = prepareValues(app.published, values);
        const issues = prepared.issues;
        if (issues.length)
          throw new AppError("validation", describe("errors.input"), issues);
        const existing = recordId
          ? app.records.find((r) => r.id === recordId)
          : undefined;
        if (recordId && !existing)
          throw new AppError(
            "not_found",
            describe("errors.recordNotFoundReload"),
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
          throw new AppError("not_published", describe("errors.publishFirst"));
        const record = app.records.find((record) => record.id === recordId);
        if (!record)
          throw new AppError("not_found", describe("errors.recordNotFound"));
        changeWorkflow(app.published, record, input);
        record.updatedAt = context.now();
        record.updatedBy = context.actor;
      }),
    deleteRecords: (id: string, revision: number, ids: string[]) =>
      change(id, revision, (app) => {
        if (ids.some((recordId) => !app.records.some((r) => r.id === recordId)))
          throw new AppError(
            "not_found",
            describe("errors.deleteRecordNotFound"),
          );
        app.records = app.records.filter((record) => !ids.includes(record.id));
      }),
  };
}
