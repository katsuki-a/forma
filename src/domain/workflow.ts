import { describe } from "../localization/index.ts";
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
        ...describe("errors.recordWorkflow", { number: record.number }),
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
    throw new AppError("validation", describe("errors.workflowMissing"));
  let stateId = record.workflow.stateId;
  let assigneeId = record.workflow.assigneeId;
  if (input.transitionId !== undefined) {
    const transition = workflow.transitions.find(
      (item) => item.id === input.transitionId && item.from === stateId,
    );
    if (!transition)
      throw new AppError(
        "validation",
        describe("errors.transitionUnavailable"),
      );
    stateId = transition.to;
    const nextState = workflow.states.find((state) => state.id === stateId);
    if (assigneeId !== null && !nextState?.assignees.includes(assigneeId))
      assigneeId = null;
  }
  if (input.assigneeId !== undefined) assigneeId = input.assigneeId;
  const state = workflow.states.find((state) => state.id === stateId);
  if (!state || (assigneeId !== null && !state.assignees.includes(assigneeId)))
    throw new AppError("validation", describe("errors.assigneeUnavailable"));
  record.workflow = { stateId, assigneeId };
}
