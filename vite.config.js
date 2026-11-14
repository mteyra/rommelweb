import { defineConfig } from 'vite';
export default defineConfig({
  base: '/rommelweb/',
  build: { target: 'es2022', sourcemap: false },
});
