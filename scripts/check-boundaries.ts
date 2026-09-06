import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const root = fileURLToPath(new URL("../", import.meta.url));
const allowed: Record<string, string[]> = {
  contracts: ["contracts"],
  domain: ["domain", "contracts"],
  client: ["client", "contracts", "design"],
  server: ["server", "domain", "contracts"],
};
const packages: Record<string, string[]> = {
  contracts: ["zod"],
  domain: [],
  client: ["react", "react-dom", "zod"],
  server: ["hono", "zod", "@cloudflare/workers-types"],
};
export function checkDependencies(path: string, source: string): string[] {
  const layer = path.split("/")[1];
  const errors: string[] = [];
  const inspect = (specifier: string) => {
    if (specifier.startsWith(".")) {
      const target = relative(
        root,
        resolve(root, dirname(path), specifier),
      ).replaceAll("\\", "/");
      const area = target.startsWith("src/")
        ? target.split("/")[1]
        : target.split("/")[0];
      if (!allowed[layer]?.includes(area))
        errors.push(`${path}: forbidden dependency ${specifier}`);
    } else if (
      !packages[layer]?.some(
        (name) => specifier === name || specifier.startsWith(`${name}/`),
      )
    )
      errors.push(`${path}: forbidden package ${specifier}`);
  };
  const syntax = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    createImportExpressions: true,
  });
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
        "ImportExpression",
        "TSImportType",
      ].includes(String(node.type))
    ) {
      const target = (node.source ?? node.argument) as
        { type?: string; value?: string } | undefined;
      if (target?.type === "StringLiteral" && typeof target.value === "string")
        inspect(target.value);
      else if (node.type === "ImportExpression")
        errors.push(`${path}: nonliteral module dependency`);
    }
    if (
      node.type === "CallExpression" &&
      (node.callee as { name?: string })?.name === "require"
    ) {
      const target = (node.arguments as { type?: string; value?: string }[])[0];
      if (target?.type === "StringLiteral" && typeof target.value === "string")
        inspect(target.value);
      else errors.push(`${path}: nonliteral module dependency`);
    }
    Object.values(node).forEach(visit);
  }
  visit(syntax);
  return errors;
}
function scan(dir: string): string[] {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      return entry.isDirectory()
        ? scan(path)
        : /\.tsx?$/.test(path)
          ? checkDependencies(path, readFileSync(resolve(root, path), "utf8"))
          : [];
    },
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = scan("src");
  process.stdout.write(
    `${JSON.stringify({ ok: errors.length === 0, errors }, null, 2)}\n`,
  );
  process.exitCode = errors.length ? 1 : 0;
}
