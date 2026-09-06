import { Hono } from "hono";
import { z } from "zod";
import {
  AppError,
  valuesSchema,
  announcementInputSchema,
  workflowInputSchema,
} from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";
import { createService } from "../domain/service.ts";

const revisionSchema = z.number().int().nonnegative();
const draftInput = z.strictObject({
  revision: revisionSchema,
  definition: z.unknown(),
});
const publishInput = z.strictObject({ revision: revisionSchema });
const recordInput = z.strictObject({
  revision: revisionSchema,
  values: valuesSchema,
  recordId: z.string().optional(),
});
const deleteInput = z.strictObject({
  revision: revisionSchema,
  ids: z.array(z.string()).min(1),
});
export function createApi(repository: Repository, actor = "local-user") {
  const service = createService(repository, {
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    actor,
  });
  const api = new Hono();
  api.use("/api/*", async (c, next) => {
    if (!["GET", "HEAD"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      const source = origin && URL.canParse(origin) ? new URL(origin) : null;
      if (
        origin &&
        (!source ||
          !["http:", "https:"].includes(source.protocol) ||
          !["127.0.0.1", "localhost", "[::1]"].includes(source.hostname))
      ) {
        return c.json(
          {
            code: "forbidden",
            message: "許可されていない接続元です。",
            issues: [],
          },
          403,
        );
      }
      if (!c.req.header("content-type")?.startsWith("application/json"))
        return c.json(
          {
            code: "validation",
            message: "JSON形式で送信してください。",
            issues: [],
          },
          415,
        );
    }
    c.header("Cache-Control", "no-store");
    await next();
  });
  api.onError((error, c) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json(
        {
          code: "validation",
          message: "送信内容の形式を確認してください。",
          issues: [],
        },
        400,
      );
    if (error instanceof AppError)
      return c.json(
        { code: error.code, message: error.message, issues: error.issues },
        error.code === "not_found"
          ? 404
          : ["conflict", "incompatible_records", "not_published"].includes(
                error.code,
              )
            ? 409
            : 400,
      );
    console.error("API operation failed", error);
    return c.json(
      {
        code: "internal",
        message: "保存先に接続できません。時間をおいて再試行してください。",
        issues: [],
      },
      500,
    );
  });
  api.get("/api/announcements", async (c) =>
    c.json(await service.listAnnouncements()),
  );
  api.post("/api/announcements", async (c) =>
    c.json(
      await service.saveAnnouncement(
        announcementInputSchema.parse(await c.req.json()),
      ),
      201,
    ),
  );
  api.delete("/api/announcements/:id", async (c) => {
    const body = publishInput.parse(await c.req.json());
    await service.deleteAnnouncement(c.req.param("id"), body.revision);
    return c.json({ ok: true });
  });
  api.post("/api/apps/:id/records/:recordId/workflow", async (c) => {
    const body = z
      .strictObject({ revision: revisionSchema, ...workflowInputSchema.shape })
      .parse(await c.req.json());
    return c.json(
      await service.updateWorkflow(
        c.req.param("id"),
        body.revision,
        c.req.param("recordId"),
        body,
      ),
    );
  });
  api.get("/api/apps", async (c) => c.json(await service.list()));
  api.post("/api/apps", async (c) =>
    c.json(await service.create(await c.req.json()), 201),
  );
  api.get("/api/apps/:id", async (c) =>
    c.json(await service.get(c.req.param("id"))),
  );
  api.put("/api/apps/:id/draft", async (c) => {
    const body = draftInput.parse(await c.req.json());
    return c.json(
      await service.saveDraft(
        c.req.param("id"),
        body.revision,
        body.definition,
      ),
    );
  });
  api.post("/api/apps/:id/publish", async (c) => {
    const body = publishInput.parse(await c.req.json());
    return c.json(await service.publish(c.req.param("id"), body.revision));
  });
  api.post("/api/apps/:id/records", async (c) => {
    const body = recordInput.parse(await c.req.json());
    return c.json(
      await service.saveRecord(
        c.req.param("id"),
        body.revision,
        body.values,
        body.recordId,
      ),
    );
  });
  api.delete("/api/apps/:id/records", async (c) => {
    const body = deleteInput.parse(await c.req.json());
    return c.json(
      await service.deleteRecords(c.req.param("id"), body.revision, body.ids),
    );
  });
  api.notFound((c) =>
    c.json(
      { code: "not_found", message: "操作先が見つかりません。", issues: [] },
      404,
    ),
  );
  return api;
}
