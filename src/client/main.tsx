import { t } from "../localization/index.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

document.title = t("app.documentTitle");

const root = document.getElementById("root");
if (!root) throw new Error(t("errors.renderRoot"));

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
