import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { HttpsProxyAgent } from 'https-proxy-agent';

// O Design System fica em ../design-system e é consumido sem alteração.
// `npm run dev:celular` liga HTTPS (certificado local): câmera e GPS exigem conexão segura no celular.
// `--mode teste`: o servidor de pré-visualização repassa /functions/v1 ao Supabase sem o cabeçalho Origin,
// para testar o login real fora do endereço publicado. Em produção o app chama o Supabase direto.
const repasseFuncoes = {
  '/functions/v1': {
    target: 'https://tnjpyjbqcjrowzjfnuln.supabase.co',
    changeOrigin: true,
    // em ambientes que só saem pela internet via proxy (HTTPS_PROXY), o repasse usa o mesmo proxy
    agent: process.env.HTTPS_PROXY ? new HttpsProxyAgent(process.env.HTTPS_PROXY) : undefined,
    headers: { origin: '', referer: '' },
  },
};

export default defineConfig(({ mode }) => ({
  // `vite build --mode artifact`: arquivo único (navegação em memória, GPS simulado) para publicar como link.
  plugins: mode === 'celular' ? [react(), basicSsl()] : mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 } : undefined,
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi).
  server: { host: true, fs: { allow: ['..'] }, proxy: mode === 'teste' ? repasseFuncoes : undefined },
  preview: { host: true, proxy: mode === 'teste' ? repasseFuncoes : undefined },
}));
