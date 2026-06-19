import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" — деплой независимо или в подпапку /miniapp/ на Pages
export default defineConfig({
  plugins: [react()],
  base: "./",
});
