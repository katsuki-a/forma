import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/storage/**/*.test.ts"],
    environment: "node",
    hookTimeout: 30000,
  },
});
