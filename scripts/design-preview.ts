import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

// 配信するファイルを限定し、ローカル資料は公開しない。
const assets = new Map([
  ["/", { file: "preview.html", type: "text/html; charset=utf-8" }],
  ["/preview.html", { file: "preview.html", type: "text/html; charset=utf-8" }],
  [
    "/components.css",
    { file: "components.css", type: "text/css; charset=utf-8" },
  ],
  ["/tokens.css", { file: "tokens.css", type: "text/css; charset=utf-8" }],
]);
const root = new URL("../design/", import.meta.url);
async function serve(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const asset = assets.get((request.url ?? "/").split("?")[0]);
  if (!asset) {
    response
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(asset.file, root));
    response.writeHead(200, {
      "Content-Type": asset.type,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500).end("Unable to load preview");
  }
}
const server = createServer((request, response) => {
  void serve(request, response);
});
server.listen(3000, "127.0.0.1", () => {
  console.log("forma: http://127.0.0.1:3000/ (画面見本・情報は保存されません)");
});
