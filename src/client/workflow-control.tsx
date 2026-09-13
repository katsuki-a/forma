import { t } from "../localization/index.ts";
import { useState } from "react";
import type {
  AppRecord,
  Definition,
  WorkflowInput,
} from "../contracts/model.ts";
import { Button, FormField } from "./components.tsx";

export function WorkflowControl({
  definition,
  record,
  busy,
  onChange,
}: {
  definition: Definition;
  record: AppRecord;
  busy: boolean;
  onChange: (input: WorkflowInput) => Promise<void>;
}) {
  const [assignee, setAssignee] = useState(record.workflow?.assigneeId ?? "");
  const state = definition.workflow?.states.find(
    (state) => state.id === record.workflow?.stateId,
  );
  if (!state) return null;
  return (
    <section className="section" aria-label={t("workflow.title")}>
      <h3>{t("workflow.title")}</h3>
      <p>{t("workflow.current", { name: state.name })}</p>
      <FormField label={t("common.assignee")}>
        {(id) => (
          <select
            id={id}
            disabled={busy}
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">{t("common.unassigned")}</option>
            {state.assignees.map((userId) => (
              <option key={userId} value={userId}>
                {definition.directory?.users.find((user) => user.id === userId)
                  ?.name ?? userId}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <div className="button-row">
        <Button
          kind="secondary"
          disabled={busy}
          onClick={() => {
            void onChange({ assigneeId: assignee || null });
          }}
        >
          {t("workflow.saveAssignee")}
        </Button>
        {definition.workflow?.transitions
          .filter((item) => item.from === state.id)
          .map((transition) => (
            <Button
              key={transition.id}
              disabled={busy}
              onClick={() => {
                void onChange({ transitionId: transition.id });
              }}
            >
              {transition.name}
            </Button>
          ))}
      </div>
    </section>
  );
}
