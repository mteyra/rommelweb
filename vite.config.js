import { defineConfig } from 'vite';
export default defineConfig({
  base: '/rommelweb/',
  build: {
    target: 'es2022',
    sourcemap: false,
    // Three.js alone is ~550 kB; warn only if a chunk grows past that.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Three.js gets its own file: it rarely changes, so browsers keep it
        // cached across deploys and re-download only the app code.
        manualChunks: id => id.includes('/node_modules/three/') ? 'three' : undefined,
      },
    },
  },
});
