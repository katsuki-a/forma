import {
  AppError,
  type AppRecord,
  type Definition,
  type Issue,
  type WorkflowInput,
} from "../contracts/model.ts";

export function workflowIssues(
  definition: Definition,
  record: AppRecord,
): Issue[] {
  if (!record.workflow) return [];
  const state = definition.workflow?.states.find(
    (state) => state.id === record.workflow?.stateId,
  );
  if (
    !state ||
    (record.workflow.assigneeId !== null &&
      !state.assignees.includes(record.workflow.assigneeId))
  ) {
    return [
      {
        code: "workflow",
        message: `記録${record.number}の状態または担当者が新しい設定に含まれていません。`,
      },
    ];
  }
  return [];
}
export function changeWorkflow(
  definition: Definition,
  record: AppRecord,
  input: WorkflowInput,
) {
  const workflow = definition.workflow;
  if (!workflow || !record.workflow)
    throw new AppError("validation", "この記録には状態が設定されていません。");
  let stateId = record.workflow.stateId;
  let assigneeId = record.workflow.assigneeId;
  if (input.transitionId !== undefined) {
    const transition = workflow.transitions.find(
      (item) => item.id === input.transitionId && item.from === stateId,
    );
    if (!transition)
      throw new AppError(
        "validation",
        "現在の状態からはこの操作を実行できません。",
      );
    stateId = transition.to;
    const nextState = workflow.states.find((state) => state.id === stateId);
    if (assigneeId !== null && !nextState?.assignees.includes(assigneeId))
      assigneeId = null;
  }
  if (input.assigneeId !== undefined) assigneeId = input.assigneeId;
  const state = workflow.states.find((state) => state.id === stateId);
  if (!state || (assigneeId !== null && !state.assignees.includes(assigneeId)))
    throw new AppError("validation", "この状態の担当候補から選んでください。");
  record.workflow = { stateId, assigneeId };
}
