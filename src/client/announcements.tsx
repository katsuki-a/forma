import { useEffect, useState } from "react";
import { AppError, type Announcement } from "../contracts/model.ts";
import type { ApiClient } from "./api-client.ts";
import { Button, FormField } from "./components.tsx";

export function Announcements({ client }: { client: ApiClient }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    client
      .listAnnouncements()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setError("お知らせを読み込めません。読み直してください。");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [client]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setError(
        error instanceof AppError
          ? error.message
          : "操作に失敗しました。再試行してください。",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section" aria-labelledby="announcements-heading">
      <div className="section-heading">
        <h2 id="announcements-heading">お知らせ</h2>
        <Button
          kind="secondary"
          disabled={busy}
          onClick={() => {
            setEditing("new");
            setTitle("");
            setBody("");
          }}
        >
          お知らせを追加
        </Button>
      </div>
      {error && (
        <div role="alert" className="notice error">
          <p>{error}</p>
          <Button
            disabled={busy}
            kind="secondary"
            onClick={() => {
              void run(async () => {
                setItems(await client.listAnnouncements());
              });
            }}
          >
            お知らせを読み直す
          </Button>
        </div>
      )}
      <p role="status" className="feedback">
        {busy ? "お知らせを読み込んでいます…" : message}
      </p>
      {!busy && items.length === 0 && (
        <p className="subtle">お知らせはまだありません。</p>
      )}
      {items.map((item) => (
        <article className="surface section" key={item.id}>
          <h3>{item.title}</h3>
          <p className="multiline">{item.body}</p>
          <div className="button-row">
            <Button
              kind="secondary"
              disabled={busy}
              aria-label={`${item.title}を編集`}
              onClick={() => {
                setEditing(item);
                setTitle(item.title);
                setBody(item.body);
              }}
            >
              編集
            </Button>
            <Button
              kind="danger"
              disabled={busy}
              aria-label={`${item.title}を削除`}
              onClick={() => setDeleting(item)}
            >
              削除
            </Button>
          </div>
        </article>
      ))}
      {editing && (
        <form
          className="surface section"
          aria-label="お知らせの編集"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const saved = await client.saveAnnouncement({
                ...(editing === "new"
                  ? {}
                  : { id: editing.id, revision: editing.revision }),
                title,
                body,
              });
              setItems((previous) =>
                previous.some((item) => item.id === saved.id)
                  ? previous.map((item) =>
                      item.id === saved.id ? saved : item,
                    )
                  : [...previous, saved],
              );
              setEditing(null);
              setMessage("お知らせを保存しました。");
            });
          }}
        >
          <FormField label="お知らせのタイトル">
            {(id) => (
              <input
                id={id}
                required
                disabled={busy}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="お知らせの本文">
            {(id) => (
              <textarea
                id={id}
                rows={4}
                disabled={busy}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </FormField>
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              お知らせを保存
            </Button>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
      {deleting && (
        <section
          role="alertdialog"
          aria-labelledby="announcement-delete-title"
          className="surface section"
        >
          <h3 id="announcement-delete-title">
            「{deleting.title}」を削除しますか？
          </h3>
          <div className="button-row">
            <Button
              kind="danger"
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  await client.deleteAnnouncement(
                    deleting.id,
                    deleting.revision,
                  );
                  setItems((previous) =>
                    previous.filter((item) => item.id !== deleting.id),
                  );
                  setDeleting(null);
                  if (editing !== "new" && editing?.id === deleting.id)
                    setEditing(null);
                  setMessage("お知らせを削除しました。");
                });
              }}
            >
              お知らせの削除を確定
            </Button>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              キャンセル
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
