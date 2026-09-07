import { MessageError, describe } from "../localization/index.ts";
// 許可した数値演算だけを解析する。eval/Functionやプロパティ参照は使わない。
type Expression =
  | { kind: "number"; value: number }
  | { kind: "field"; id: string }
  | { kind: "unary"; sign: number; value: Expression }
  | { kind: "binary"; operator: string; left: Expression; right: Expression };

export function parseFormula(source: string): {
  expression: Expression;
  references: string[];
} {
  const tokens =
    source.match(
      /\[[a-zA-Z][a-zA-Z0-9_-]*\]|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z][a-zA-Z0-9_]*|[()+*/-]|\S/g,
    ) ?? [];
  let index = 0;
  const references = new Set<string>();
  function primary(): Expression {
    const token = tokens[index++];
    if (token === "+" || token === "-")
      return { kind: "unary", sign: token === "-" ? -1 : 1, value: primary() };
    if (token === "(") {
      const value = expression(0);
      if (tokens[index++] !== ")")
        throw new MessageError(describe("calculation.parenthesis"));
      return value;
    }
    if (token && /^(?:\d|\.\d)/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value))
        throw new MessageError(describe("calculation.finite"));
      return { kind: "number", value };
    }
    if (token && /^(?:\[|[a-zA-Z])/.test(token)) {
      const id = token.startsWith("[") ? token.slice(1, -1) : token;
      references.add(id);
      return { kind: "field", id };
    }
    throw new MessageError(describe("calculation.syntax"));
  }
  function expression(minimum: number): Expression {
    let left = primary();
    while (index < tokens.length) {
      const operator = tokens[index];
      const priority =
        operator === "+" || operator === "-"
          ? 1
          : operator === "*" || operator === "/"
            ? 2
            : 0;
      if (priority <= minimum) break;
      index++;
      left = { kind: "binary", operator, left, right: expression(priority) };
    }
    return left;
  }
  const result = expression(0);
  if (index !== tokens.length)
    throw new MessageError(describe("calculation.characters"));
  return { expression: result, references: [...references] };
}

export function evaluateFormula(
  source: string,
  values: Record<string, unknown>,
): number | null {
  function evaluate(node: Expression): number | null {
    if (node.kind === "number") return node.value;
    if (node.kind === "field") {
      const value = values[node.id];
      if (value === undefined || value === null || value === "") return null;
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new MessageError(describe("calculation.number"));
      return value;
    }
    if (node.kind === "unary") {
      const value = evaluate(node.value);
      return value === null ? null : node.sign * value;
    }
    const left = evaluate(node.left);
    const right = evaluate(node.right);
    if (left === null || right === null) return null;
    if (node.operator === "/" && right === 0)
      throw new MessageError(describe("calculation.zero"));
    const result =
      node.operator === "+"
        ? left + right
        : node.operator === "-"
          ? left - right
          : node.operator === "*"
            ? left * right
            : left / right;
    if (!Number.isFinite(result))
      throw new MessageError(describe("calculation.range"));
    return result;
  }
  const formula = parseFormula(source);
  if (
    formula.references.some(
      (id) =>
        values[id] === undefined || values[id] === null || values[id] === "",
    )
  )
    return null;
  return evaluate(formula.expression);
}
