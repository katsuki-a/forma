import { t } from "../localization/index.ts";
import type { Definition, Directory, Workflow } from "../contracts/model.ts";
import { emptyDirectory } from "../contracts/model.ts";
import { Button, FormField } from "./components.tsx";

const kinds = [
  { key: "users", name: t("fieldTypes.user") },
  { key: "organizations", name: t("fieldTypes.organization") },
  { key: "groups", name: t("fieldTypes.group") },
] as const;

export function DirectorySettings({
  value,
  onChange,
}: {
  value: Directory | undefined;
  onChange: (directory: Directory) => void;
}) {
  const directory = value ?? emptyDirectory();
  return (
    <details className="surface section">
      <summary>{t("directory.title")}</summary>
      <p className="subtle">{t("directory.description")}</p>
      {kinds.map(({ key, name }) => (
        <section
          className="section"
          key={key}
          aria-label={t(`directory.${key}.settings`)}
        >
          <div className="section-heading">
            <h3>{name}</h3>
            <Button
              kind="secondary"
              onClick={() =>
                onChange({
                  ...directory,
                  [key]: [
                    ...directory[key],
                    {
                      id: `candidate-${crypto.randomUUID()}`,
                      name: t(`directory.${key}.new`),
                    },
                  ],
                })
              }
            >
              {t(`directory.${key}.add`)}
            </Button>
          </div>
          {directory[key].length === 0 && (
            <p className="subtle">{t("directory.empty")}</p>
          )}
          {directory[key].map((candidate, index) => (
            <div className="sample-grid section" key={index}>
              <FormField
                label={t(`directory.${key}.id`, { position: index + 1 })}
              >
                {(id) => (
                  <input
                    id={id}
                    value={candidate.id}
                    onChange={(event) =>
                      onChange({
                        ...directory,
                        [key]: directory[key].map((item, i) =>
                          i === index
                            ? { ...item, id: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </FormField>
              <FormField
                label={t(`directory.${key}.name`, { position: index + 1 })}
              >
                {(id) => (
                  <input
                    id={id}
                    value={candidate.name}
                    onChange={(event) =>
                      onChange({
                        ...directory,
                        [key]: directory[key].map((item, i) =>
                          i === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </FormField>
              <Button
                kind="danger"
                aria-label={t(`directory.${key}.delete`, {
                  position: index + 1,
                })}
                onClick={() =>
                  onChange({
                    ...directory,
                    [key]: directory[key].filter((_, i) => i !== index),
                  })
                }
              >
                {t("directory.delete")}
              </Button>
            </div>
          ))}
        </section>
      ))}
    </details>
  );
}

export function WorkflowSettings({
  definition,
  onChange,
}: {
  definition: Definition;
  onChange: (workflow: Workflow | undefined) => void;
}) {
  const workflow = definition.workflow;
  const users = definition.directory?.users ?? [];
  const update = (patch: Partial<Workflow>) => {
    if (workflow) onChange({ ...workflow, ...patch });
  };
  return (
    <details className="surface section">
      <summary>{t("workflow.settings")}</summary>
      <label className="choice">
        <input
          type="checkbox"
          checked={!!workflow}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    initialState: "todo",
                    states: [
                      { id: "todo", name: t("workflow.todo"), assignees: [] },
                    ],
                    transitions: [],
                  }
                : undefined,
            )
          }
        />
        {t("workflow.enabled")}
      </label>
      {workflow && (
        <>
          <p className="subtle">{t("workflow.assigneesHint")}</p>
          <FormField label={t("workflow.initial")}>
            {(id) => (
              <select
                id={id}
                value={workflow.initialState}
                onChange={(event) =>
                  update({ initialState: event.target.value })
                }
              >
                {workflow.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {workflow.states.map((state, index) => (
            <section
              className="section"
              key={state.id}
              aria-label={t("workflow.stateSettings", { position: index + 1 })}
            >
              <FormField
                label={t("workflow.stateName", { position: index + 1 })}
              >
                {(id) => (
                  <input
                    id={id}
                    value={state.name}
                    onChange={(event) =>
                      update({
                        states: workflow.states.map((item) =>
                          item.id === state.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </FormField>
              <fieldset className="choice-field">
                <legend>
                  {t("workflow.stateAssignees", {
                    name:
                      state.name ||
                      t("workflow.stateFallback", { position: index + 1 }),
                  })}
                </legend>
                {users.map((user) => (
                  <label className="choice" key={user.id}>
                    <input
                      type="checkbox"
                      checked={state.assignees.includes(user.id)}
                      onChange={(event) =>
                        update({
                          states: workflow.states.map((item) =>
                            item.id === state.id
                              ? {
                                  ...item,
                                  assignees: event.target.checked
                                    ? [...item.assignees, user.id]
                                    : item.assignees.filter(
                                        (id) => id !== user.id,
                                      ),
                                }
                              : item,
                          ),
                        })
                      }
                    />
                    {user.name}
                  </label>
                ))}
                {users.length === 0 && (
                  <p className="subtle">{t("workflow.noUsers")}</p>
                )}
              </fieldset>
              <Button
                kind="danger"
                disabled={workflow.states.length === 1}
                aria-label={t("workflow.deleteStateNamed", {
                  position: index + 1,
                })}
                onClick={() => {
                  const states = workflow.states.filter(
                    (item) => item.id !== state.id,
                  );
                  update({
                    states,
                    initialState:
                      workflow.initialState === state.id
                        ? states[0].id
                        : workflow.initialState,
                    transitions: workflow.transitions.filter(
                      (item) => item.from !== state.id && item.to !== state.id,
                    ),
                  });
                }}
              >
                {t("workflow.deleteState")}
              </Button>
            </section>
          ))}
          <Button
            kind="secondary"
            className="section"
            onClick={() =>
              update({
                states: [
                  ...workflow.states,
                  {
                    id: `state-${crypto.randomUUID()}`,
                    name: t("workflow.newState"),
                    assignees: [],
                  },
                ],
              })
            }
          >
            {t("workflow.addState")}
          </Button>
          <h3 className="section">{t("workflow.transitions")}</h3>
          {workflow.transitions.map((transition, index) => (
            <div className="surface section" key={transition.id}>
              <FormField
                label={t("workflow.transitionName", { position: index + 1 })}
              >
                {(id) => (
                  <input
                    id={id}
                    value={transition.name}
                    onChange={(event) =>
                      update({
                        transitions: workflow.transitions.map((item) =>
                          item.id === transition.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                )}
              </FormField>
              <div className="sample-grid">
                {(["from", "to"] as const).map((direction) => (
                  <FormField
                    key={direction}
                    label={t(
                      direction === "from"
                        ? "workflow.transitionFrom"
                        : "workflow.transitionTo",
                      { position: index + 1 },
                    )}
                  >
                    {(id) => (
                      <select
                        id={id}
                        value={transition[direction]}
                        onChange={(event) =>
                          update({
                            transitions: workflow.transitions.map((item) =>
                              item.id === transition.id
                                ? { ...item, [direction]: event.target.value }
                                : item,
                            ),
                          })
                        }
                      >
                        {workflow.states.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                ))}
              </div>
              <Button
                kind="danger"
                aria-label={t("workflow.deleteTransitionNamed", {
                  position: index + 1,
                })}
                onClick={() =>
                  update({
                    transitions: workflow.transitions.filter(
                      (item) => item.id !== transition.id,
                    ),
                  })
                }
              >
                {t("workflow.deleteTransition")}
              </Button>
            </div>
          ))}
          <Button
            kind="secondary"
            className="section"
            onClick={() =>
              update({
                transitions: [
                  ...workflow.transitions,
                  {
                    id: `transition-${crypto.randomUUID()}`,
                    name: t("workflow.newTransition"),
                    from: workflow.initialState,
                    to: workflow.states[workflow.states.length - 1].id,
                  },
                ],
              })
            }
          >
            {t("workflow.addTransition")}
          </Button>
        </>
      )}
    </details>
  );
}
