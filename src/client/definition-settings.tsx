import type { Definition, Directory, Workflow } from "../contracts/model.ts";
import { emptyDirectory } from "../contracts/model.ts";
import { Button, FormField } from "./components.tsx";

const kinds = [
  { key: "users", name: "ユーザー" },
  { key: "organizations", name: "組織" },
  { key: "groups", name: "グループ" },
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
      <summary>ユーザー・組織・グループの候補</summary>
      <p className="subtle">
        このアプリで選ぶ候補を登録します。IDは半角英字で始め、英数字・ハイフン・下線を使えます。
      </p>
      {kinds.map(({ key, name }) => (
        <section className="section" key={key} aria-label={`${name}の候補設定`}>
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
                      name: `新しい${name}`,
                    },
                  ],
                })
              }
            >
              {name}候補を追加
            </Button>
          </div>
          {directory[key].length === 0 && (
            <p className="subtle">候補はまだありません。</p>
          )}
          {directory[key].map((candidate, index) => (
            <div className="sample-grid section" key={index}>
              <FormField label={`${name}${index + 1}のID`}>
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
              <FormField label={`${name}${index + 1}の名前`}>
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
                aria-label={`${name}${index + 1}の候補を削除`}
                onClick={() =>
                  onChange({
                    ...directory,
                    [key]: directory[key].filter((_, i) => i !== index),
                  })
                }
              >
                候補を削除
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
      <summary>状態と担当者の設定</summary>
      <label className="choice">
        <input
          type="checkbox"
          checked={!!workflow}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    initialState: "todo",
                    states: [{ id: "todo", name: "未着手", assignees: [] }],
                    transitions: [],
                  }
                : undefined,
            )
          }
        />
        状態と担当者を使う
      </label>
      {workflow && (
        <>
          <p className="subtle">
            担当候補は「ユーザー・組織・グループの候補」に登録したユーザーから選びます。
          </p>
          <FormField label="初期状態">
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
              aria-label={`状態${index + 1}の設定`}
            >
              <FormField label={`状態${index + 1}の名前`}>
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
                <legend>{state.name || `状態${index + 1}`}の担当候補</legend>
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
                  <p className="subtle">
                    ユーザー候補を登録すると選択できます。
                  </p>
                )}
              </fieldset>
              <Button
                kind="danger"
                disabled={workflow.states.length === 1}
                aria-label={`状態${index + 1}を削除`}
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
                状態を削除
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
                    name: "新しい状態",
                    assignees: [],
                  },
                ],
              })
            }
          >
            状態を追加
          </Button>
          <h3 className="section">状態を変える操作</h3>
          {workflow.transitions.map((transition, index) => (
            <div className="surface section" key={transition.id}>
              <FormField label={`遷移${index + 1}の操作名`}>
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
                    label={`遷移${index + 1}の${direction === "from" ? "変更前" : "変更後"}`}
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
                aria-label={`遷移${index + 1}を削除`}
                onClick={() =>
                  update({
                    transitions: workflow.transitions.filter(
                      (item) => item.id !== transition.id,
                    ),
                  })
                }
              >
                操作を削除
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
                    name: "状態を変更",
                    from: workflow.initialState,
                    to: workflow.states[workflow.states.length - 1].id,
                  },
                ],
              })
            }
          >
            遷移を追加
          </Button>
        </>
      )}
    </details>
  );
}
