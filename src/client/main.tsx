import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("画面の描画先が見つかりません。");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
