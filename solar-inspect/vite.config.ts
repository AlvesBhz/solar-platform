import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O Design System fica em ../design-system e é consumido sem alteração.
export default defineConfig({
  plugins: [react()],
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi).
  server: { host: true, fs: { allow: ['..'] } },
  preview: { host: true },
});
