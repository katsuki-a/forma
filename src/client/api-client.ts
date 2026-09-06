import { z } from "zod";
import { AppError, appSchema, errorSchema } from "../contracts/model.ts";
import type { Definition, Values } from "../contracts/model.ts";

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
      throw new AppError(
        "network",
        "接続できません。入力を残したまま、もう一度お試しください。",
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError(
        "protocol",
        "応答を読み取れません。接続先を確認してください。",
      );
    }
    if (!response.ok) {
      const error = errorSchema.safeParse(payload);
      if (error.success)
        throw new AppError(
          error.data.code,
          error.data.message,
          error.data.issues,
        );
      throw new AppError(
        "protocol",
        "操作に失敗しました。接続先を確認してください。",
      );
    }
    const result = schema.safeParse(payload);
    if (!result.success)
      throw new AppError(
        "protocol",
        "応答の形式が一致しません。接続先を確認してください。",
      );
    return result.data;
  }
  return {
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
