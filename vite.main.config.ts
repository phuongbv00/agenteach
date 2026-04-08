import { defineConfig } from "vite"

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        "@libsql/client",
        "@libsql/darwin-arm64",
        "@libsql/darwin-x64",
        "@libsql/linux-x64-gnu",
        "@libsql/linux-arm64-gnu",
        "@libsql/win32-x64-msvc",
      ],
    },
  },
})
