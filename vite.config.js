import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Prevent esbuild prebundling of MediaPipe packages
    exclude: ['@mediapipe/hands', '@mediapipe/camera_utils', '@mediapipe/drawing_utils'],
  },
  build: {
    // If you still see weirdness with mixed ESM/CJS, this helps:
    commonjsOptions: { transformMixedEsModules: true },
  },
});
