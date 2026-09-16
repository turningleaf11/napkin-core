import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Consumers (both shells already ship their own React) provide these.
  external: ["react", "react-dom"],
});
