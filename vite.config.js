const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/media": "http://localhost:8080",
      "/spotify": "http://localhost:8080"
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
        music: "music.html"
      }
    }
  }
});
