import { t, describe } from "../localization/index.ts";
import { useEffect, useState } from "react";
import type {
  Application,
  AppRecord,
  Definition,
  Values,
  WorkflowInput,
} from "../contracts/model.ts";
import { AppError, emptyDefinition, templates } from "../contracts/model.ts";
import type { ApiClient } from "./api-client.ts";
import { createClient } from "./api-client.ts";
import { Announcements } from "./announcements.tsx";
import { WorkflowControl } from "./workflow-control.tsx";
import { Button, RecordForm, TreeMark, displayValue } from "./components.tsx";
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
              : new AppError("unexpected", describe("errors.loadApps")),
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
  const editorDefinition =
    view.kind === "create"
      ? view.definition
      : view.kind === "edit"
        ? current?.draft
        : undefined;
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
          : new AppError("unexpected", describe("errors.unexpected")),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="shell" data-theme={visibleDefinition?.theme ?? "forest"}>
      <nav className="nav" aria-label={t("portal.structure")}>
        <div className="brand">
          <TreeMark />
          forma
        </div>
        <p className="nav-title">{t("portal.audience")}</p>
        <ul className="tree">
          <li>
            <button
              type="button"
              disabled={busy}
              aria-current={view.kind === "portal" ? "page" : undefined}
              onClick={() => navigate({ kind: "portal" })}
            >
              {t("portal.title")}
            </button>
          </li>
          {apps.map((app) => (
            <li key={app.id}>
              <button
                type="button"
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
        <p className="nav-note">{t("portal.tagline")}</p>
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
                  setMessage(t("portal.reloaded"));
                })
              }
            >
              {t("portal.reload")}
            </Button>
          </div>
        )}
        <p role="status" className="feedback">
          {busy ? t("common.processing") : message}
        </p>
        {view.kind === "portal" && (
          <>
            <header className="header">
              <div>
                <h1>{t("portal.title")}</h1>
                <p className="subtle">{t("portal.description")}</p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  navigate({ kind: "create", definition: emptyDefinition() })
                }
              >
                {t("portal.create")}
              </Button>
            </header>
            <section aria-labelledby="apps-heading">
              <div className="section-heading">
                <h2 id="apps-heading">{t("portal.apps")}</h2>
                <span className="subtle">
                  {t("portal.appCount", { count: apps.length })}
                </span>
              </div>
              {apps.length === 0 ? (
                <div className="empty">
                  <h3>{t("portal.emptyTitle")}</h3>
                  <p>{t("portal.emptyDescription")}</p>
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
                    {t("portal.fromTemplate")}
                  </Button>
                </div>
              ) : (
                <div className="surface">
                  <ul className="app-list">
                    {apps.map((app) => (
                      <li className="app-row" key={app.id}>
                        <div>
                          <button
                            type="button"
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
                              t("portal.noDescription")}
                          </p>
                        </div>
                        <span className="status">
                          {app.published
                            ? t("portal.recordCount", {
                                count: app.records.length,
                              })
                            : t("common.draft")}
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
                  {t("portal.fromTemplate")}
                </Button>
              </div>
            )}
            <Announcements client={client} />
          </>
        )}
        {editorDefinition && (
          <Editor
            key={
              view.kind === "create"
                ? "new"
                : `${current?.id}-${current?.revision}`
            }
            initial={editorDefinition}
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
                  publish ? t("editor.published") : t("editor.draftSaved"),
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
                  name: t("editor.copyName", { name: current.draft.name }),
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
                setMessage(t("records.saved"));
              })
            }
            onWorkflow={(recordId, input) =>
              run(async () => {
                update(
                  await client.updateWorkflow(
                    current.id,
                    current.revision,
                    recordId,
                    input,
                  ),
                );
                setMessage(t("workflow.saved"));
              })
            }
            onDelete={(ids) =>
              run(async () => {
                update(
                  await client.deleteRecords(current.id, current.revision, ids),
                );
                setMessage(t("records.deleted"));
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
  onWorkflow,
}: {
  app: Application;
  busy: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onSave: (values: Values, id?: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  onWorkflow: (recordId: string, input: WorkflowInput) => Promise<void>;
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
            {t("editor.title")}
          </Button>
          <Button kind="secondary" disabled={busy} onClick={onCopy}>
            {t("records.duplicateApp")}
          </Button>
        </div>
      </header>
      {!app.published ? (
        <div className="empty">
          <h2>{t("records.draftTitle")}</h2>
          <p>{t("records.draftDescription")}</p>
          <Button disabled={busy} onClick={onEdit}>
            {t("records.openDraft")}
          </Button>
        </div>
      ) : (
        <>
          <div className="section-heading">
            <h2>{t("records.title")}</h2>
            <Button
              disabled={busy}
              onClick={() => {
                setInitial({});
                setEditing("new");
              }}
            >
              {t("records.add")}
            </Button>
          </div>
          {app.records.length === 0 ? (
            <div className="empty">
              <p>{t("records.empty")}</p>
            </div>
          ) : (
            <div
              className="table-wrap"
              role="region"
              aria-label={t("records.table")}
              tabIndex={0}
            >
              <table>
                <caption>
                  {t("records.caption", { name: definition.name })}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("records.selection")}</th>
                    <th scope="col">{t("records.number")}</th>
                    {definition.fields.map((field) => (
                      <th scope="col" key={field.id}>
                        {field.label}
                      </th>
                    ))}
                    {definition.workflow && (
                      <>
                        <th scope="col">{t("common.state")}</th>
                        <th scope="col">{t("common.assignee")}</th>
                      </>
                    )}
                    <th scope="col">{t("records.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {app.records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={busy}
                          aria-label={t("records.selectNamed", {
                            number: record.number,
                          })}
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
                            ["number", "calculation"].includes(field.type)
                              ? "number"
                              : undefined
                          }
                        >
                          {displayValue(
                            definition,
                            field,
                            record.values[field.id],
                          )}
                        </td>
                      ))}
                      {definition.workflow && (
                        <>
                          <td>
                            {definition.workflow.states.find(
                              (state) => state.id === record.workflow?.stateId,
                            )?.name ?? t("common.unset")}
                          </td>
                          <td>
                            {definition.directory?.users.find(
                              (user) => user.id === record.workflow?.assigneeId,
                            )?.name ?? t("common.unassigned")}
                          </td>
                        </>
                      )}
                      <td>
                        <div className="button-row">
                          <Button
                            kind="secondary"
                            disabled={busy}
                            aria-label={t("records.openNamed", {
                              number: record.number,
                            })}
                            onClick={() => {
                              setInitial(record.values);
                              setEditing(record);
                            }}
                          >
                            {t("common.open")}
                          </Button>
                          <Button
                            kind="secondary"
                            disabled={busy}
                            aria-label={t("records.reuseNamed", {
                              number: record.number,
                            })}
                            onClick={() => {
                              setInitial(record.values);
                              setEditing("new");
                            }}
                          >
                            {t("common.reuse")}
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
                {t("records.deleteSelected", { count: selected.length })}
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
                {t("records.deleteConfirm", { count: selected.length })}
              </h2>
              <p>{t("records.deleteWarning")}</p>
              <div className="button-row">
                <Button
                  kind="danger"
                  disabled={busy}
                  onClick={() => {
                    void onDelete(selected);
                  }}
                >
                  {t("records.confirmDelete")}
                </Button>
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </section>
          )}
          {editing && (
            <section className="surface section" aria-label={t("records.edit")}>
              <div className="section-heading">
                <h2>
                  {editing === "new"
                    ? t("records.new")
                    : t("records.details", { number: editing.number })}
                </h2>
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  {t("common.close")}
                </Button>
              </div>
              {editing !== "new" && (
                <dl className="record-meta">
                  <dt>{t("records.createdBy")}</dt>
                  <dd>{editing.createdBy}</dd>
                  <dt>{t("records.updatedBy")}</dt>
                  <dd>{editing.updatedBy}</dd>
                  <dt>{t("records.createdAt")}</dt>
                  <dd>{editing.createdAt}</dd>
                  <dt>{t("records.updatedAt")}</dt>
                  <dd>{editing.updatedAt}</dd>
                </dl>
              )}
              {editing !== "new" && (
                <WorkflowControl
                  definition={definition}
                  record={editing}
                  busy={busy}
                  onChange={(input) => onWorkflow(editing.id, input)}
                />
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
