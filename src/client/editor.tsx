import { t, describeValidation } from "../localization/index.ts";
import { useState } from "react";
import type { Definition, Field, FieldType } from "../contracts/model.ts";
import {
  definitionSchema,
  fieldLabels,
  fieldTypes,
  uniqueFieldTypes,
} from "../contracts/model.ts";
import { DirectorySettings, WorkflowSettings } from "./definition-settings.tsx";
import { Button, FormField, RecordForm } from "./components.tsx";

export function Editor({
  initial,
  existing,
  busy,
  onSave,
  onCancel,
}: {
  initial: Definition;
  existing: boolean;
  busy: boolean;
  onSave: (definition: Definition, publish: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [definition, setDefinition] = useState(() => structuredClone(initial));
  const [preview, setPreview] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const update = (patch: Partial<Definition>) => {
    setPreview(false);
    setDefinition({ ...definition, ...patch });
  };
  const updateField = (id: string, patch: Partial<Field>) =>
    update({
      fields: definition.fields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    });
  const move = (id: string, index: number) => {
    const fields = [...definition.fields];
    const previous = fields.findIndex((field) => field.id === id);
    if (previous < 0 || index < 0 || index >= fields.length) return;
    fields.splice(index, 0, fields.splice(previous, 1)[0]);
    update({ fields });
  };
  const validate = () => {
    const result = definitionSchema.safeParse(definition);
    setErrors(
      result.success
        ? []
        : result.error.issues.map((issue) => describeValidation(issue).message),
    );
    return result.success;
  };
  return (
    <>
      <div className="header">
        <div>
          <h1>{existing ? t("editor.title") : t("portal.create")}</h1>
          <p className="subtle">{t("editor.description")}</p>
        </div>
        <span className="status">{t("common.draft")}</span>
      </div>
      <div className="notice">{t("editor.draftNotice")}</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (validate()) void onSave(definition, false);
        }}
      >
        <fieldset disabled={busy} className="editor-fields">
          <div className="surface">
            <FormField label={t("editor.appName")}>
              {(id) => (
                <input
                  id={id}
                  value={definition.name}
                  required
                  onChange={(event) => update({ name: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={t("editor.descriptionLabel")}>
              {(id) => (
                <textarea
                  id={id}
                  value={definition.description}
                  onChange={(event) =>
                    update({ description: event.target.value })
                  }
                  rows={2}
                />
              )}
            </FormField>
            <div className="sample-grid">
              <FormField label={t("editor.icon")}>
                {(id) => (
                  <select
                    id={id}
                    value={definition.icon}
                    onChange={(event) => update({ icon: event.target.value })}
                  >
                    <option value="tree">{t("editor.iconTree")}</option>
                    <option value="book">{t("editor.iconBook")}</option>
                    <option value="home">{t("editor.iconHome")}</option>
                  </select>
                )}
              </FormField>
              <FormField label={t("editor.theme")}>
                {(id) => (
                  <select
                    id={id}
                    value={definition.theme}
                    onChange={(event) =>
                      update({
                        theme: event.target.value as Definition["theme"],
                      })
                    }
                  >
                    <option value="forest">{t("editor.themeForest")}</option>
                    <option value="leaf">{t("editor.themeLeaf")}</option>
                    <option value="moss">{t("editor.themeMoss")}</option>
                  </select>
                )}
              </FormField>
            </div>
          </div>
          <section className="section" aria-label={t("editor.fields")}>
            <div className="section-heading">
              <h2>
                {t("editor.fieldsTitle", {
                  name: definition.name || t("editor.newApp"),
                })}
              </h2>
              <Button
                kind="secondary"
                onClick={() =>
                  update({
                    fields: [
                      ...definition.fields,
                      {
                        id: `field-${crypto.randomUUID()}`,
                        label: t("editor.newField"),
                        type: "text",
                      },
                    ],
                  })
                }
              >
                {t("editor.addField")}
              </Button>
            </div>
            {definition.fields.length === 0 && (
              <div className="empty">
                <p>{t("editor.empty")}</p>
              </div>
            )}
            <ol className="field-list">
              {definition.fields.map((field, index) => (
                <li
                  className="surface field-editor"
                  key={field.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged) move(dragged, index);
                    setDragged(null);
                  }}
                >
                  <div className="section-heading">
                    <h3>{field.label || t("editor.unnamedField")}</h3>
                    <span
                      className="drag-handle"
                      draggable
                      onDragStart={() => setDragged(field.id)}
                      onDragEnd={() => setDragged(null)}
                      aria-label={t("editor.drag", { label: field.label })}
                    >
                      {t("editor.reorder")}
                    </span>
                  </div>
                  <div className="sample-grid">
                    <FormField
                      label={t("editor.fieldName", { position: index + 1 })}
                    >
                      {(id) => (
                        <input
                          id={id}
                          value={field.label}
                          required
                          onChange={(event) =>
                            updateField(field.id, { label: event.target.value })
                          }
                        />
                      )}
                    </FormField>
                    <FormField
                      label={t("editor.fieldType", { position: index + 1 })}
                    >
                      {(id) => (
                        <select
                          id={id}
                          value={field.type}
                          onChange={(event) => {
                            const type = event.target.value as FieldType;
                            updateField(field.id, {
                              type,
                              unique: uniqueFieldTypes.includes(type)
                                ? field.unique
                                : undefined,
                              formula:
                                type === "calculation"
                                  ? (field.formula ?? "")
                                  : undefined,
                              options: [
                                "radio",
                                "select",
                                "checkbox",
                                "multiselect",
                              ].includes(type)
                                ? (field.options ?? [
                                    t("editor.optionOne"),
                                    t("editor.optionTwo"),
                                  ])
                                : undefined,
                            });
                          }}
                        >
                          {fieldTypes.map((type) => (
                            <option value={type} key={type}>
                              {fieldLabels[type]}
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>
                  </div>
                  {["radio", "select", "checkbox", "multiselect"].includes(
                    field.type,
                  ) && (
                    <FormField
                      label={t("editor.fieldOptions", { position: index + 1 })}
                      hint={t("editor.optionsHint")}
                    >
                      {(id) => (
                        <textarea
                          id={id}
                          value={field.options?.join("\n") ?? ""}
                          onChange={(event) =>
                            updateField(field.id, {
                              options: event.target.value.split("\n"),
                            })
                          }
                          rows={3}
                        />
                      )}
                    </FormField>
                  )}
                  {uniqueFieldTypes.includes(field.type) && (
                    <label className="choice">
                      <input
                        type="checkbox"
                        aria-label={t("editor.uniqueNamed", {
                          label: field.label,
                        })}
                        checked={field.unique ?? false}
                        onChange={(event) =>
                          updateField(field.id, {
                            unique: event.target.checked,
                          })
                        }
                      />
                      {t("editor.unique")}
                    </label>
                  )}
                  {field.type === "calculation" && (
                    <div className="field">
                      <FormField
                        label={t("editor.fieldFormula", {
                          position: index + 1,
                        })}
                        hint={t("editor.formulaHint")}
                      >
                        {(id) => (
                          <input
                            id={id}
                            value={field.formula ?? ""}
                            onChange={(event) =>
                              updateField(field.id, {
                                formula: event.target.value,
                              })
                            }
                          />
                        )}
                      </FormField>
                      <div className="button-row">
                        {definition.fields
                          .filter((item) => item.type === "number")
                          .map((item) => (
                            <Button
                              key={item.id}
                              kind="secondary"
                              aria-label={t("editor.insertNamed", {
                                label: field.label,
                                reference: item.label,
                              })}
                              onClick={() =>
                                updateField(field.id, {
                                  formula: `${field.formula ?? ""}[${item.id}]`,
                                })
                              }
                            >
                              {t("editor.insert", { label: item.label })}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="button-row">
                    <Button
                      kind="secondary"
                      aria-label={t("editor.upNamed", { label: field.label })}
                      disabled={index === 0}
                      onClick={() => move(field.id, index - 1)}
                    >
                      {t("common.moveUp")}
                    </Button>
                    <Button
                      kind="secondary"
                      aria-label={t("editor.downNamed", { label: field.label })}
                      disabled={index === definition.fields.length - 1}
                      onClick={() => move(field.id, index + 1)}
                    >
                      {t("common.moveDown")}
                    </Button>
                    <Button
                      kind="danger"
                      aria-label={t("editor.deleteNamed", {
                        label: field.label,
                      })}
                      onClick={() =>
                        update({
                          fields: definition.fields.filter(
                            (f) => f.id !== field.id,
                          ),
                        })
                      }
                    >
                      {t("editor.deleteField")}
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <DirectorySettings
            value={definition.directory}
            onChange={(directory) => update({ directory })}
          />
          <WorkflowSettings
            definition={definition}
            onChange={(workflow) => update({ workflow })}
          />
          {errors.length > 0 && (
            <div role="alert" className="error">
              {errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          )}
          <div className="button-row section">
            <Button type="submit">
              {existing ? t("editor.saveDraft") : t("editor.create")}
            </Button>
            <Button
              kind="secondary"
              onClick={() => {
                if (validate()) setPreview(!preview);
              }}
            >
              {t("editor.preview")}
            </Button>
            {existing && (
              <Button
                onClick={() => {
                  if (validate()) void onSave(definition, true);
                }}
              >
                {t("editor.publish")}
              </Button>
            )}
            <Button kind="secondary" onClick={onCancel}>
              {t("common.back")}
            </Button>
          </div>
        </fieldset>
      </form>
      {preview && (
        <section
          className="section surface"
          aria-label={t("editor.previewTitle")}
        >
          <div className="section-heading">
            <h2>{t("editor.previewTitle")}</h2>
            <span className="status">{t("editor.notSaved")}</span>
          </div>
          <RecordForm definition={definition} busy={busy} preview />
        </section>
      )}
    </>
  );
}
