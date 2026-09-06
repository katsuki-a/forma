import { templates, type Definition } from "../../src/contracts/model.ts";

export const capabilityDefinition: Definition = {
  ...templates[0],
  name: "共有する用事",
  fields: [
    { id: "title", label: "内容", type: "text", unique: true },
    { id: "quantity", label: "数量", type: "number" },
    { id: "price", label: "単価", type: "number" },
    {
      id: "total",
      label: "合計",
      type: "calculation",
      formula: "[quantity] * [price]",
    },
    { id: "members", label: "共有する人", type: "user" },
    { id: "teams", label: "組織", type: "organization" },
    { id: "groups", label: "グループ", type: "group" },
  ],
  directory: {
    users: [
      { id: "aoi", name: "あおい" },
      { id: "sora", name: "そら" },
    ],
    organizations: [{ id: "home", name: "家族" }],
    groups: [{ id: "shopping", name: "買い物" }],
  },
  workflow: {
    initialState: "todo",
    states: [
      { id: "todo", name: "未着手", assignees: ["aoi"] },
      { id: "done", name: "完了", assignees: ["sora"] },
    ],
    transitions: [
      { id: "complete", name: "完了にする", from: "todo", to: "done" },
    ],
  },
};
