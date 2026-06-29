import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/interactive-home-walkthrough/",
  plugins: [react()],
});
