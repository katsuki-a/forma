import type { D1Database } from "@cloudflare/workers-types";
import { createApi } from "./api.ts";
import { d1Repository } from "./d1-repository.ts";

// 認証方式が未決のため、ローカル起動で明示された場合だけ利用可能。
export default {
  async fetch(
    request: Request,
    env: { DB: D1Database; LOCAL_MODE?: string },
  ): Promise<Response> {
    if (env.LOCAL_MODE !== "true")
      return Response.json(
        {
          code: "unavailable",
          message: "この基本版はローカル検証用です。",
          issues: [],
        },
        { status: 503 },
      );
    return createApi(d1Repository(env.DB)).fetch(request);
  },
};
