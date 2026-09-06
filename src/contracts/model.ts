import { z } from 'zod';

export const fieldTypes = ['text', 'textarea', 'number', 'radio', 'select', 'checkbox', 'multiselect', 'date', 'time', 'datetime', 'url', 'tel', 'email'] as const;
export const fieldLabels: Record<FieldType, string> = { text: '一行テキスト', textarea: '複数行テキスト', number: '数値', radio: 'ラジオボタン', select: 'ドロップダウン', checkbox: 'チェックボックス', multiselect: '複数選択', date: '日付', time: '時刻', datetime: '日時', url: 'URL', tel: '電話番号', email: 'メールアドレス' };
export const identifier = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/).refine(v => !['__proto__', 'constructor', 'prototype'].includes(v));
export const fieldSchema = z.strictObject({ id: identifier, label: z.string().trim().min(1), type: z.enum(fieldTypes), options: z.array(z.string().trim().min(1)).optional() });
export const definitionSchema = z.strictObject({
  version: z.literal(1), name: z.string().trim().min(1, 'アプリ名を入力してください。'), description: z.string(), icon: z.string(),
  theme: z.enum(['forest', 'leaf', 'moss']), fields: z.array(fieldSchema),
}).superRefine((definition, ctx) => {
  const ids = new Set<string>();
  definition.fields.forEach((field, index) => {
    if (ids.has(field.id)) ctx.addIssue({ code: 'custom', path: ['fields', index, 'id'], message: '項目IDが重複しています。' });
    ids.add(field.id);
    if (['radio', 'select', 'checkbox', 'multiselect'].includes(field.type) && (!field.options?.length || new Set(field.options).size !== field.options.length)) {
      ctx.addIssue({ code: 'custom', path: ['fields', index, 'options'], message: '重複しない選択肢を入力してください。' });
    }
  });
});
export type FieldType = typeof fieldTypes[number];
export type Field = z.infer<typeof fieldSchema>;
export type Definition = z.infer<typeof definitionSchema>;
export const valueSchema = z.union([z.string(), z.number().finite(), z.array(z.string()), z.null()]);
export const valuesSchema = z.record(identifier, valueSchema);
export type Values = z.infer<typeof valuesSchema>;
export const issueSchema = z.object({ fieldId: z.string().optional(), code: z.string(), message: z.string() });
export type Issue = z.infer<typeof issueSchema>;
export const recordSchema = z.object({ id: z.string(), number: z.number().int().positive(), values: valuesSchema, createdAt: z.string(), updatedAt: z.string(), createdBy: z.string(), updatedBy: z.string() });
export type AppRecord = z.infer<typeof recordSchema>;
export const appSchema = z.object({ id: z.string(), revision: z.number().int().nonnegative(), draft: definitionSchema, published: definitionSchema.nullable(), records: z.array(recordSchema), nextNumber: z.number().int().positive() });
export type Application = z.infer<typeof appSchema>;
export const errorSchema = z.object({ code: z.string(), message: z.string(), issues: z.array(issueSchema) });
export class AppError extends Error {
  code: string;
  issues: Issue[];
  constructor(code: string, message: string, issues: Issue[] = []) { super(message); this.code = code; this.issues = issues; }
}
export function parseDefinition(input: unknown): Definition {
  const result = definitionSchema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError('validation', 'アプリ名と項目の設定を確認してください。', result.error.issues.map(issue => ({
    code: issue.code, message: issue.message,
    fieldId: issue.path[0] === 'fields' && typeof issue.path[1] === 'number' ? (input as Definition)?.fields?.[issue.path[1]]?.id : undefined,
  })));
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value); }
export function validateValues(definition: Definition, input: unknown): Issue[] {
  const parsed = valuesSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(i => ({ fieldId: String(i.path[0] ?? ''), code: 'invalid_value', message: '項目の型に合う値を入力してください。' }));
  const values = parsed.data;
  const issues: Issue[] = Object.keys(values).filter(id => !definition.fields.some(f => f.id === id)).map(fieldId => ({ fieldId, code: 'unknown_field', message: '定義にない項目が含まれています。' }));
  for (const field of definition.fields) {
    const value = values[field.id];
    if (value === undefined || value === null || value === '') continue;
    let valid: boolean;
    if (field.type === 'number') valid = typeof value === 'number' && Number.isFinite(value);
    else if (field.type === 'checkbox' || field.type === 'multiselect') valid = Array.isArray(value) && new Set(value).size === value.length && value.every(v => field.options?.includes(v));
    else if (typeof value !== 'string') valid = false;
    else {
      switch (field.type) {
        case 'select': case 'radio': valid = field.options?.includes(value) ?? false; break;
        case 'date': valid = validDate(value); break;
        case 'time': valid = validTime(value); break;
        case 'datetime': { const parts = value.split('T'); valid = parts.length === 2 && validDate(parts[0]) && validTime(parts[1]); break; }
        case 'url': { try { valid = ['http:', 'https:'].includes(new URL(value).protocol); } catch { valid = false; } break; }
        case 'email': valid = z.email().safeParse(value).success; break;
        default: valid = true;
      }
    }
    if (!valid) issues.push({ fieldId: field.id, code: 'invalid_value', message: `${field.label}を${fieldLabels[field.type]}の形式で入力してください。` });
  }
  return issues;
}
export const templates: Definition[] = [{ version: 1, name: '暮らしの記録', description: '日々の用事や気づきをまとめます。', icon: 'tree', theme: 'forest', fields: [
  { id: 'title', label: '内容', type: 'text' }, { id: 'note', label: 'メモ', type: 'textarea' }, { id: 'date', label: '日付', type: 'date' },
] }];
export const emptyDefinition = (): Definition => ({ version: 1, name: '', description: '', icon: 'tree', theme: 'forest', fields: [] });
