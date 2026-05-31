import { defineConfig } from 'vite'

// El cliente HTTP apunta directamente a VITE_API_URL (default http://localhost:8000).
// CORS está habilitado en el backend para localhost:5173, así que no necesitamos proxy.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
