import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// O Design System fica em ../design-system e é consumido sem alteração.
// `npm run dev:celular` liga HTTPS (certificado local): câmera e GPS exigem conexão segura no celular.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'celular' ? [react(), basicSsl()] : [react()],
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi).
  server: { host: true, fs: { allow: ['..'] } },
  preview: { host: true },
}));
