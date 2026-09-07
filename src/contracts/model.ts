import {
  t,
  describe,
  describeValidation,
  messageKey,
  MessageError,
  translator,
  type LocalizedMessage,
  type MessageParams,
} from "../localization/index.ts";
import { z } from "zod";
import { evaluateFormula, parseFormula } from "./calculation.ts";

export const fieldTypes = [
  "text",
  "textarea",
  "number",
  "radio",
  "select",
  "checkbox",
  "multiselect",
  "date",
  "time",
  "datetime",
  "url",
  "tel",
  "email",
  "calculation",
  "user",
  "organization",
  "group",
] as const;
export const fieldLabels: Record<FieldType, string> = {
  text: t("fieldTypes.text"),
  textarea: t("fieldTypes.textarea"),
  number: t("fieldTypes.number"),
  radio: t("fieldTypes.radio"),
  select: t("fieldTypes.select"),
  checkbox: t("fieldTypes.checkbox"),
  multiselect: t("fieldTypes.multiselect"),
  date: t("fieldTypes.date"),
  time: t("fieldTypes.time"),
  datetime: t("fieldTypes.datetime"),
  url: t("fieldTypes.url"),
  tel: t("fieldTypes.tel"),
  email: t("fieldTypes.email"),
  calculation: t("fieldTypes.calculation"),
  user: t("fieldTypes.user"),
  organization: t("fieldTypes.organization"),
  group: t("fieldTypes.group"),
};
export const identifier = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));
export const uniqueFieldTypes: readonly FieldType[] = [
  "text",
  "number",
  "url",
  "tel",
  "email",
];
export const candidateSchema = z.strictObject({
  id: identifier,
  name: z.string().trim().min(1),
});
export const directorySchema = z.strictObject({
  users: z.array(candidateSchema),
  organizations: z.array(candidateSchema),
  groups: z.array(candidateSchema),
});
export const workflowSchema = z.strictObject({
  initialState: identifier,
  states: z
    .array(
      z.strictObject({
        id: identifier,
        name: z.string().trim().min(1),
        assignees: z.array(identifier),
      }),
    )
    .min(1),
  transitions: z.array(
    z.strictObject({
      id: identifier,
      name: z.string().trim().min(1),
      from: identifier,
      to: identifier,
    }),
  ),
});
export type Directory = z.infer<typeof directorySchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export const emptyDirectory = (): Directory => ({
  users: [],
  organizations: [],
  groups: [],
});
export const fieldSchema = z.strictObject({
  id: identifier,
  label: z.string().trim().min(1),
  type: z.enum(fieldTypes),
  options: z.array(z.string().trim().min(1)).optional(),
  unique: z.boolean().optional(),
  formula: z.string().optional(),
});
export const definitionSchema = z
  .strictObject({
    version: z.literal(1),
    name: z.string().trim().min(1, messageKey("errors.appName")),
    description: z.string(),
    icon: z.string(),
    theme: z.enum(["forest", "leaf", "moss"]),
    fields: z.array(fieldSchema),
    directory: directorySchema.optional(),
    workflow: workflowSchema.optional(),
  })
  .superRefine((definition, ctx) => {
    const ids = new Set<string>();
    definition.fields.forEach((field, index) => {
      if (ids.has(field.id))
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "id"],
          message: messageKey("errors.duplicateFieldId"),
        });
      ids.add(field.id);
      if (field.unique && !uniqueFieldTypes.includes(field.type))
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "unique"],
          message: messageKey("errors.unsupportedUnique"),
        });
      if (field.type === "calculation") {
        try {
          const formula = parseFormula(field.formula ?? "");
          if (
            formula.references.some(
              (id) =>
                definition.fields.find((candidate) => candidate.id === id)
                  ?.type !== "number",
            )
          )
            throw new MessageError(describe("errors.formulaReferences"));
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            path: ["fields", index, "formula"],
            message:
              error instanceof MessageError
                ? (error.messageKey ?? "errors.formula")
                : "errors.formula",
          });
        }
      }

      if (
        ["radio", "select", "checkbox", "multiselect"].includes(field.type) &&
        (!field.options?.length ||
          new Set(field.options).size !== field.options.length)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "options"],
          message: messageKey("errors.options"),
        });
      }
    });
    for (const [kind, candidates] of Object.entries(
      definition.directory ?? emptyDirectory(),
    )) {
      if (
        new Set(candidates.map((candidate) => candidate.id)).size !==
        candidates.length
      )
        ctx.addIssue({
          code: "custom",
          path: ["directory", kind],
          message: messageKey("errors.candidateId"),
        });
    }
    if (definition.workflow) {
      const workflow = definition.workflow;
      const states = new Set(workflow.states.map((state) => state.id));
      const users = new Set(definition.directory?.users.map((user) => user.id));
      if (
        states.size !== workflow.states.length ||
        !states.has(workflow.initialState)
      )
        ctx.addIssue({
          code: "custom",
          path: ["workflow"],
          message: messageKey("errors.states"),
        });
      if (
        workflow.states.some(
          (state) =>
            new Set(state.assignees).size !== state.assignees.length ||
            state.assignees.some((id) => !users.has(id)),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["workflow"],
          message: messageKey("errors.assignees"),
        });
      if (
        new Set(workflow.transitions.map((item) => item.id)).size !==
          workflow.transitions.length ||
        workflow.transitions.some(
          (item) => !states.has(item.from) || !states.has(item.to),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["workflow"],
          message: messageKey("errors.transitions"),
        });
    }
  });
export type FieldType = (typeof fieldTypes)[number];
export type Field = z.infer<typeof fieldSchema>;
export type Definition = z.infer<typeof definitionSchema>;
export const valueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.array(z.string()),
  z.null(),
]);
export const valuesSchema = z.record(identifier, valueSchema);
export type Values = z.infer<typeof valuesSchema>;
const messageDescriptorShape = {
  messageKey: z.string().optional(),
  messageParams: z
    .record(z.string(), z.union([z.string(), z.number().finite()]))
    .optional(),
  fieldLabel: z.string().optional(),
  recordNumber: z.number().optional(),
};
export const issueSchema = z.object({
  fieldId: z.string().optional(),
  code: z.string(),
  message: z.string(),
  ...messageDescriptorShape,
});
export type Issue = z.infer<typeof issueSchema>;
export const recordSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  values: valuesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  workflow: z
    .object({ stateId: identifier, assigneeId: identifier.nullable() })
    .nullable()
    .optional(),
});
export type AppRecord = z.infer<typeof recordSchema>;
export const appSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  draft: definitionSchema,
  published: definitionSchema.nullable(),
  records: z.array(recordSchema),
  nextNumber: z.number().int().positive(),
});
export type Application = z.infer<typeof appSchema>;
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  ...messageDescriptorShape,
  issues: z.array(issueSchema),
});
export class AppError extends Error {
  code: string;
  issues: Issue[];
  messageKey?: string;
  messageParams?: MessageParams;
  constructor(
    code: string,
    description: LocalizedMessage,
    issues: Issue[] = [],
  ) {
    super(description.message);
    this.messageKey = description.messageKey;
    this.messageParams = description.messageParams;
    this.code = code;
    this.issues = issues;
  }
}
export function parseDefinition(input: unknown): Definition {
  const result = definitionSchema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError(
    "validation",
    describe("errors.definition"),
    result.error.issues.map((issue) => ({
      code: issue.code,
      ...describeValidation(issue),
      fieldId:
        issue.path[0] === "fields" && typeof issue.path[1] === "number"
          ? (input as Definition)?.fields?.[issue.path[1]]?.id
          : undefined,
    })),
  );
}
function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}
export function validateValues(
  definition: Definition,
  input: unknown,
): Issue[] {
  const parsed = valuesSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({
      fieldId: String(i.path[0] ?? ""),
      code: "invalid_value",
      ...describe("errors.invalidValue"),
    }));
  const values = parsed.data;
  const issues: Issue[] = Object.keys(values)
    .filter((id) => !definition.fields.some((f) => f.id === id))
    .map((fieldId) => ({
      fieldId,
      code: "unknown_field",
      ...describe("errors.unknownField"),
    }));
  for (const field of definition.fields) {
    if (field.type === "calculation") continue;
    const value = values[field.id];
    if (value === undefined || value === null || value === "") continue;
    let valid: boolean;
    if (field.type === "number")
      valid = typeof value === "number" && Number.isFinite(value);
    else if (["user", "organization", "group"].includes(field.type))
      valid =
        Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every((id) =>
          fieldCandidates(definition, field.type).some(
            (candidate) => candidate.id === id,
          ),
        );
    else if (field.type === "checkbox" || field.type === "multiselect")
      valid =
        Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every((v) => field.options?.includes(v));
    else if (typeof value !== "string") valid = false;
    else {
      switch (field.type) {
        case "select":
        case "radio":
          valid = field.options?.includes(value) ?? false;
          break;
        case "date":
          valid = validDate(value);
          break;
        case "time":
          valid = validTime(value);
          break;
        case "datetime": {
          const parts = value.split("T");
          valid =
            parts.length === 2 && validDate(parts[0]) && validTime(parts[1]);
          break;
        }
        case "url": {
          try {
            valid = ["http:", "https:"].includes(new URL(value).protocol);
          } catch {
            valid = false;
          }
          break;
        }
        case "email":
          valid = z.email().safeParse(value).success;
          break;
        default:
          valid = true;
      }
    }
    if (!valid)
      issues.push({
        fieldId: field.id,
        code: "invalid_value",
        ...describe(`errors.fieldValue.${field.type}`, { label: field.label }),
      });
  }
  return issues;
}
export const templates: Definition[] = [
  {
    version: 1,
    name: t("templates.dailyName"),
    description: t("templates.dailyDescription"),
    icon: "tree",
    theme: "forest",
    fields: [
      { id: "title", label: t("templates.content"), type: "text" },
      { id: "note", label: t("templates.note"), type: "textarea" },
      { id: "date", label: t("fieldTypes.date"), type: "date" },
    ],
  },
];
export const emptyDefinition = (): Definition => ({
  version: 1,
  name: "",
  description: "",
  icon: "tree",
  theme: "forest",
  fields: [],
});

export function fieldCandidates(definition: Definition, type: FieldType) {
  const directory = definition.directory ?? emptyDirectory();
  return type === "user"
    ? directory.users
    : type === "organization"
      ? directory.organizations
      : type === "group"
        ? directory.groups
        : [];
}
export function prepareValues(
  definition: Definition,
  input: unknown,
): { values: Values; issues: Issue[] } {
  const issues = validateValues(definition, input);
  const parsed = valuesSchema.safeParse(input);
  if (!parsed.success) return { values: {}, issues };
  const values = structuredClone(parsed.data);
  for (const field of definition.fields.filter(
    (field) => field.type === "calculation",
  )) {
    try {
      values[field.id] = evaluateFormula(field.formula ?? "", values);
    } catch (error) {
      values[field.id] = null;
      issues.push({
        fieldId: field.id,
        code: "calculation",
        ...describe("errors.calculation"),
        ...(error instanceof MessageError
          ? { messageKey: error.messageKey, messageParams: error.messageParams }
          : {}),
        fieldLabel: field.label,
      });
    }
  }
  return {
    values,
    issues: issues.map((issue) => ({
      ...issue,
      message: translator.message(issue),
    })),
  };
}
export function uniqueIssues(
  definition: Definition,
  records: Pick<AppRecord, "id" | "number" | "values">[],
): Issue[] {
  const issues: Issue[] = [];
  for (const field of definition.fields.filter((field) => field.unique)) {
    const seen = new Map<string | number, number>();
    for (const record of records) {
      const value = record.values[field.id];
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        Array.isArray(value)
      )
        continue;
      const previous = seen.get(value);
      if (previous !== undefined)
        issues.push({
          fieldId: field.id,
          code: "duplicate",
          ...describe("errors.duplicateValue", {
            label: field.label,
            previous,
            number: record.number,
          }),
        });
      else seen.set(value, record.number);
    }
  }
  return issues;
}
export const announcementInputSchema = z
  .strictObject({
    id: z.string().optional(),
    revision: z.number().int().nonnegative().optional(),
    title: z.string().trim().min(1, messageKey("errors.announcementTitle")),
    body: z.string(),
  })
  .refine(
    (input) => (input.id === undefined) === (input.revision === undefined),
    messageKey("errors.announcementRevision"),
  );
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export const announcementSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Announcement = z.infer<typeof announcementSchema>;
export const workflowInputSchema = z.strictObject({
  transitionId: identifier.optional(),
  assigneeId: identifier.nullable().optional(),
});
export type WorkflowInput = z.infer<typeof workflowInputSchema>;
