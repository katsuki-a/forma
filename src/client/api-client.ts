import { describe, translator } from "../localization/index.ts";
import { z } from "zod";
import type {
  Definition,
  Values,
  WorkflowInput,
  AnnouncementInput,
} from "../contracts/model.ts";
import {
  AppError,
  appSchema,
  errorSchema,
  announcementSchema,
} from "../contracts/model.ts";

// 通信は注入可能。サーバー実装・DB型・Honoの型に依存しない。
export function createClient(
  transport: typeof fetch = globalThis.fetch.bind(globalThis),
  base = "",
) {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await transport(`${base}/api${path}`, {
        method,
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AppError("network", describe("errors.network"));
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError("protocol", describe("errors.unreadableResponse"));
    }
    if (!response.ok) {
      const error = errorSchema.safeParse(payload);
      if (error.success)
        throw new AppError(
          error.data.code,
          { ...error.data, message: translator.message(error.data) },
          error.data.issues.map((issue) => ({
            ...issue,
            message: translator.message(issue),
          })),
        );
      throw new AppError("protocol", describe("errors.failedResponse"));
    }
    const result = schema.safeParse(payload);
    if (!result.success)
      throw new AppError("protocol", describe("errors.invalidResponse"));
    return result.data;
  }
  return {
    listAnnouncements: () =>
      request("/announcements", z.array(announcementSchema)),
    saveAnnouncement: (input: AnnouncementInput) =>
      request("/announcements", announcementSchema, "POST", input),
    deleteAnnouncement: (id: string, revision: number) =>
      request(
        `/announcements/${encodeURIComponent(id)}`,
        z.object({ ok: z.literal(true) }),
        "DELETE",
        { revision },
      ),
    updateWorkflow: (
      id: string,
      revision: number,
      recordId: string,
      input: WorkflowInput,
    ) =>
      request(
        `/apps/${encodeURIComponent(id)}/records/${encodeURIComponent(recordId)}/workflow`,
        appSchema,
        "POST",
        { revision, ...input },
      ),
    list: () => request("/apps", z.array(appSchema)),
    get: (id: string) => request(`/apps/${encodeURIComponent(id)}`, appSchema),
    create: (definition: Definition) =>
      request("/apps", appSchema, "POST", definition),
    saveDraft: (id: string, revision: number, definition: Definition) =>
      request(`/apps/${encodeURIComponent(id)}/draft`, appSchema, "PUT", {
        revision,
        definition,
      }),
    publish: (id: string, revision: number) =>
      request(`/apps/${encodeURIComponent(id)}/publish`, appSchema, "POST", {
        revision,
      }),
    saveRecord: (
      id: string,
      revision: number,
      values: Values,
      recordId?: string,
    ) =>
      request(`/apps/${encodeURIComponent(id)}/records`, appSchema, "POST", {
        revision,
        values,
        recordId,
      }),
    deleteRecords: (id: string, revision: number, ids: string[]) =>
      request(`/apps/${encodeURIComponent(id)}/records`, appSchema, "DELETE", {
        revision,
        ids,
      }),
  };
}
export type ApiClient = ReturnType<typeof createClient>;
