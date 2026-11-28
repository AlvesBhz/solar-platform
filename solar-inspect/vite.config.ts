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

const SUPABASE = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
/** CSP do app publicado: scripts só do próprio app; conexões só com o Supabase (e a checagem anônima de senha vazada).
 *  Fica fora do modo dev (o Vite usa scripts embutidos) e do link de demonstração em arquivo único. */
const csp = (funcoes?: string) => ({
  name: 'solar-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<!-- CSP:', `<meta http-equiv="Content-Security-Policy" content="${[
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob: ${SUPABASE}`, "font-src 'self' data:",
    `connect-src 'self' data: blob: ${SUPABASE} wss://tnjpyjbqcjrowzjfnuln.supabase.co https://api.pwnedpasswords.com${funcoes ? ' ' + new URL(funcoes, 'http://localhost').origin : ''}`,
    "media-src 'self' blob:", "worker-src 'self' blob:", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ')}" />\n    <!-- CSP:`),
});

/** Service worker gerado no build: guarda no aparelho o HTML e todos os arquivos do app (lista exata do build) e serve do cache
 *  quando falta sinal. Não toca em chamadas ao Supabase nem nas outras páginas do mesmo domínio (site e guia do hóspede). */
const sw = () => {
  let base = '/';
  return {
    name: 'solar-sw',
    apply: 'build' as const,
    configResolved(c: { base: string }) { base = c.base; },
    generateBundle(_: unknown, bundle: Record<string, unknown>) {
      const arquivos = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
      const versao = 'inspect-' + Date.now().toString(36);
      const codigo = `const V=${JSON.stringify(versao)},B=${JSON.stringify(base)},A=${JSON.stringify(arquivos)},FORA=['site/','guia-do-hospede/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll([B,...A.map(f=>B+f)])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x.startsWith('inspect-')).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(B)||FORA.some(p=>u.pathname.startsWith(B+p)))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(B)));return}
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});`;
      (this as unknown as { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }).emitFile({ type: 'asset', fileName: 'sw.js', source: codigo });
    },
  };
};

export default defineConfig(({ mode }) => ({
  // `vite build --mode artifact`: arquivo único (navegação em memória, GPS simulado) para publicar como link.
  plugins: mode === 'celular' ? [react(), basicSsl()] : mode === 'artifact' ? [react(), viteSingleFile()] : [react(), csp(process.env.VITE_FUNCOES_BASE), sw()],
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 }
    : mode === 'pages' ? { outDir: '../docs', emptyOutDir: true } : undefined,
  // `vite build --mode pages`: GitHub Pages em https://alvesbhz.github.io/solar-platform/ (origem aceita pelo login)
  base: mode === 'pages' ? '/solar-platform/' : '/',
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi).
  server: { host: true, fs: { allow: ['..'] }, proxy: mode === 'teste' ? repasseFuncoes : undefined },
  preview: { host: true, proxy: mode === 'teste' ? repasseFuncoes : undefined },
}));
