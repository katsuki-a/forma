import { useEffect, useState } from "react";
import { AppError, emptyDefinition, templates } from "../contracts/model.ts";
import type {
  Application,
  AppRecord,
  Definition,
  Values,
} from "../contracts/model.ts";
import { createClient } from "./api-client.ts";
import type { ApiClient } from "./api-client.ts";
import { Button, RecordForm, TreeMark } from "./components.tsx";
import { Editor } from "./editor.tsx";
import "../../design/components.css";

const defaultClient = createClient();
const icons: Record<string, string> = { tree: "♧", home: "⌂", book: "▤" };
type View =
  | { kind: "portal" }
  | { kind: "create"; definition: Definition }
  | { kind: "records" | "edit"; id: string };
export function App({ client = defaultClient }: { client?: ApiClient }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [view, setView] = useState<View>({ kind: "portal" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    client
      .list()
      .then((result) => {
        if (active) setApps(result);
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof AppError
              ? error
              : new AppError(
                  "unexpected",
                  "読み込みに失敗しました。再試行してください。",
                ),
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [client]);
  const current =
    "id" in view ? apps.find((app) => app.id === view.id) : undefined;
  const visibleDefinition =
    current &&
    (view.kind === "edit"
      ? current.draft
      : (current.published ?? current.draft));
  const navigate = (next: View) => {
    setView(next);
    setError(null);
    setMessage("");
  };
  const update = (app: Application) =>
    setApps((previous) =>
      previous.some((item) => item.id === app.id)
        ? previous.map((item) => (item.id === app.id ? app : item))
        : [...previous, app],
    );
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setError(
        error instanceof AppError
          ? error
          : new AppError(
              "unexpected",
              "操作を完了できません。もう一度お試しください。",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="shell" data-theme={visibleDefinition?.theme ?? "forest"}>
      <nav className="nav" aria-label="アプリの構造">
        <div className="brand">
          <TreeMark />
          forma
        </div>
        <p className="nav-title">家族と、仲間と。</p>
        <ul className="tree">
          <li>
            <button
              disabled={busy}
              aria-current={view.kind === "portal" ? "page" : undefined}
              onClick={() => navigate({ kind: "portal" })}
            >
              情報共有の入口
            </button>
          </li>
          {apps.map((app) => (
            <li key={app.id}>
              <button
                disabled={busy}
                aria-current={current?.id === app.id ? "page" : undefined}
                onClick={() => navigate({ kind: "records", id: app.id })}
              >
                {icons[(app.published ?? app.draft).icon] ?? "♧"}{" "}
                {(app.published ?? app.draft).name}
              </button>
              {current?.id === app.id && (
                <ul>
                  {visibleDefinition?.fields.map((field) => (
                    <li className="tree-label" key={field.id}>
                      {field.label}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className="nav-note">
          情報にかたちを。
          <br />
          日々の記録を、ひとつの場所に。
        </p>
      </nav>
      <main className="main" aria-busy={busy}>
        {error && (
          <div role="alert" className="notice error">
            <p>{error.message}</p>
            {error.issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setApps(await client.list());
                  setMessage("最新の内容を読み込みました。");
                })
              }
            >
              最新の内容を読み直す
            </Button>
          </div>
        )}
        <p role="status" className="feedback">
          {busy ? "処理しています…" : message}
        </p>
        {view.kind === "portal" && (
          <>
            <header className="header">
              <div>
                <h1>情報共有の入口</h1>
                <p className="subtle">
                  暮らしの記録も、仲間とのメモも。必要な情報を一つの場所へ。
                </p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  navigate({ kind: "create", definition: emptyDefinition() })
                }
              >
                アプリを作る
              </Button>
            </header>
            <section aria-labelledby="apps-heading">
              <div className="section-heading">
                <h2 id="apps-heading">アプリ</h2>
                <span className="subtle">{apps.length}件</span>
              </div>
              {apps.length === 0 ? (
                <div className="empty">
                  <h3>最初のアプリを作りましょう</h3>
                  <p>
                    空のアプリから項目を選ぶか、暮らしの記録をひな形にできます。
                  </p>
                  <Button
                    kind="secondary"
                    disabled={busy}
                    onClick={() =>
                      navigate({
                        kind: "create",
                        definition: structuredClone(templates[0]),
                      })
                    }
                  >
                    テンプレートから作る
                  </Button>
                </div>
              ) : (
                <div className="surface">
                  <ul className="app-list">
                    {apps.map((app) => (
                      <li className="app-row" key={app.id}>
                        <div>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              navigate({ kind: "records", id: app.id })
                            }
                          >
                            {icons[(app.published ?? app.draft).icon]}{" "}
                            {(app.published ?? app.draft).name}
                          </button>
                          <p className="subtle">
                            {(app.published ?? app.draft).description ||
                              "説明はまだありません。"}
                          </p>
                        </div>
                        <span className="status">
                          {app.published
                            ? `${app.records.length}件の記録`
                            : "下書き"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            {apps.length > 0 && (
              <div className="section">
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() =>
                    navigate({
                      kind: "create",
                      definition: structuredClone(templates[0]),
                    })
                  }
                >
                  テンプレートから作る
                </Button>
              </div>
            )}
          </>
        )}
        {(view.kind === "create" || (view.kind === "edit" && current)) && (
          <Editor
            key={
              view.kind === "create"
                ? "new"
                : `${current!.id}-${current!.revision}`
            }
            initial={view.kind === "create" ? view.definition : current!.draft}
            existing={view.kind === "edit"}
            busy={busy}
            onCancel={() =>
              navigate(
                current
                  ? { kind: "records", id: current.id }
                  : { kind: "portal" },
              )
            }
            onSave={(definition, publish) =>
              run(async () => {
                let app = current
                  ? await client.saveDraft(
                      current.id,
                      current.revision,
                      definition,
                    )
                  : await client.create(definition);
                update(app);
                setView({ kind: "edit", id: app.id });
                if (publish) {
                  app = await client.publish(app.id, app.revision);
                  update(app);
                  setView({ kind: "records", id: app.id });
                }
                setMessage(
                  publish ? "変更を反映しました。" : "下書きを保存しました。",
                );
              })
            }
          />
        )}
        {view.kind === "records" && current && (
          <Records
            key={`${current.id}-${current.revision}`}
            app={current}
            busy={busy}
            onEdit={() => navigate({ kind: "edit", id: current.id })}
            onCopy={() =>
              navigate({
                kind: "create",
                definition: {
                  ...structuredClone(current.draft),
                  name: `${current.draft.name}のコピー`,
                },
              })
            }
            onSave={(values, recordId) =>
              run(async () => {
                update(
                  await client.saveRecord(
                    current.id,
                    current.revision,
                    values,
                    recordId,
                  ),
                );
                setMessage("記録を保存しました。");
              })
            }
            onDelete={(ids) =>
              run(async () => {
                update(
                  await client.deleteRecords(current.id, current.revision, ids),
                );
                setMessage("記録を削除しました。");
              })
            }
          />
        )}
      </main>
    </div>
  );
}
function Records({
  app,
  busy,
  onEdit,
  onCopy,
  onSave,
  onDelete,
}: {
  app: Application;
  busy: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onSave: (values: Values, id?: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<AppRecord | "new" | null>(null);
  const [initial, setInitial] = useState<Values>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const definition = app.published ?? app.draft;
  return (
    <>
      <header className="header">
        <div>
          <h1>
            {icons[definition.icon]} {definition.name}
          </h1>
          <p className="subtle">{definition.description}</p>
        </div>
        <div className="button-row">
          <Button kind="secondary" disabled={busy} onClick={onEdit}>
            項目を編集
          </Button>
          <Button kind="secondary" disabled={busy} onClick={onCopy}>
            アプリを複製
          </Button>
        </div>
      </header>
      {!app.published ? (
        <div className="empty">
          <h2>このアプリは下書きです</h2>
          <p>項目を動作確認し、「変更を反映」して記録を始めてください。</p>
          <Button disabled={busy} onClick={onEdit}>
            下書きを開く
          </Button>
        </div>
      ) : (
        <>
          <div className="section-heading">
            <h2>記録</h2>
            <Button
              disabled={busy}
              onClick={() => {
                setInitial({});
                setEditing("new");
              }}
            >
              記録を追加
            </Button>
          </div>
          {app.records.length === 0 ? (
            <div className="empty">
              <p>記録はまだありません。「記録を追加」から始めてください。</p>
            </div>
          ) : (
            <div
              className="table-wrap"
              role="region"
              aria-label="記録一覧"
              tabIndex={0}
            >
              <table>
                <caption>{definition.name}の記録</caption>
                <thead>
                  <tr>
                    <th scope="col">選択</th>
                    <th scope="col">番号</th>
                    {definition.fields.map((field) => (
                      <th scope="col" key={field.id}>
                        {field.label}
                      </th>
                    ))}
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {app.records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={busy}
                          aria-label={`記録${record.number}を選択`}
                          checked={selected.includes(record.id)}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, record.id]
                                : selected.filter((id) => id !== record.id),
                            )
                          }
                        />
                      </td>
                      <td className="number">{record.number}</td>
                      {definition.fields.map((field) => (
                        <td
                          key={field.id}
                          className={
                            field.type === "number" ? "number" : undefined
                          }
                        >
                          {Array.isArray(record.values[field.id])
                            ? (record.values[field.id] as string[]).join("、")
                            : String(record.values[field.id] ?? "")}
                        </td>
                      ))}
                      <td>
                        <div className="button-row">
                          <Button
                            kind="secondary"
                            disabled={busy}
                            aria-label={`記録${record.number}を開く`}
                            onClick={() => {
                              setInitial(record.values);
                              setEditing(record);
                            }}
                          >
                            開く
                          </Button>
                          <Button
                            kind="secondary"
                            disabled={busy}
                            aria-label={`記録${record.number}を再利用`}
                            onClick={() => {
                              setInitial(record.values);
                              setEditing("new");
                            }}
                          >
                            再利用
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selected.length > 0 && (
            <div className="section">
              <Button
                kind="danger"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                選んだ{selected.length}件を削除
              </Button>
            </div>
          )}
          {confirmDelete && (
            <section
              role="alertdialog"
              aria-labelledby="delete-title"
              className="surface section"
            >
              <h2 id="delete-title">
                選んだ{selected.length}件の記録を削除しますか？
              </h2>
              <p>削除した記録は元に戻せません。</p>
              <div className="button-row">
                <Button
                  kind="danger"
                  disabled={busy}
                  onClick={() => {
                    void onDelete(selected);
                  }}
                >
                  削除を確定
                </Button>
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  キャンセル
                </Button>
              </div>
            </section>
          )}
          {editing && (
            <section className="surface section" aria-label="記録の編集">
              <div className="section-heading">
                <h2>
                  {editing === "new"
                    ? "新しい記録"
                    : `記録${editing.number}の詳細・編集`}
                </h2>
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  閉じる
                </Button>
              </div>
              {editing !== "new" && (
                <dl className="record-meta">
                  <dt>作成者</dt>
                  <dd>{editing.createdBy}</dd>
                  <dt>更新者</dt>
                  <dd>{editing.updatedBy}</dd>
                  <dt>作成日時</dt>
                  <dd>{editing.createdAt}</dd>
                  <dt>更新日時</dt>
                  <dd>{editing.updatedAt}</dd>
                </dl>
              )}
              <RecordForm
                key={`${editing === "new" ? "new" : editing.id}-${JSON.stringify(initial)}`}
                definition={app.published}
                initial={initial}
                busy={busy}
                onSave={(values) =>
                  onSave(values, editing === "new" ? undefined : editing.id)
                }
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
