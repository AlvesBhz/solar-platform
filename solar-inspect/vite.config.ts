import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O Design System fica em ../design-system e é consumido sem alteração.
// `npm run dev:celular` liga HTTPS (certificado local): câmera e GPS exigem conexão segura no celular.
export default defineConfig(({ mode }) => ({
  // `vite build --mode artifact`: arquivo único (navegação em memória, GPS simulado) para publicar como link.
  plugins: mode === 'celular' ? [react(), basicSsl()] : mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 } : undefined,
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi).
  server: { host: true, fs: { allow: ['..'] } },
  preview: { host: true },
}));
