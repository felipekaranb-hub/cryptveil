/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build roda em qualquer pasta (Hostinger, fliperama, file server)
  base: './',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Phaser sozinho passa de 1 MB; o aviso padrão de 500 kB não ajuda aqui
    chunkSizeWarningLimit: 2000,
  },
  test: {
    // Testes só no core/, que não depende de navegador nem de Phaser
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
