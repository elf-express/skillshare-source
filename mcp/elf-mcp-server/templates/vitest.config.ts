import { defineConfig } from "vitest/config";

// Team standard (elf-unit): colocated src/**/*.test.ts, line coverage >= 55% enforced.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"], // index.ts = transport bootstrap; covered by the stdio smoke step
      thresholds: { lines: 55 },
    },
  },
});
