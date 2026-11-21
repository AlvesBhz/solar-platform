// Gera src/icons/solar-subset.json só com os ícones usados (funciona offline).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getIcons } from '@iconify/utils';
import { execSync } from 'node:child_process';
const used = [...new Set(execSync("grep -rhoE 'solar:[a-z0-9-]+' src --include=*.tsx --include=*.ts").toString().trim().split('\n'))]
  .map((n) => n.replace('solar:', ''));
// Padronização: todo ícone usado tem de estar no catálogo oficial (brand/icons, design-system). Fora dele, o build para.
const catalogo = ['../brand/icons/index.html', '../design-system/Index.html'].filter((f) => existsSync(f));
if (catalogo.length) {
  const permitidos = new Set(catalogo.flatMap((f) => readFileSync(f, 'utf8').match(/solar:[a-z0-9-]+/g) ?? []).map((n) => n.replace('solar:', '')));
  const fora = used.filter((n) => !permitidos.has(n));
  if (fora.length) {
    console.error('Ícones fora do catálogo (brand/icons/index.html): ' + fora.join(', ') + '\nUse o ícone padronizado do conceito ou aprove a inclusão no catálogo antes.');
    process.exit(1);
  }
}
const full = JSON.parse(readFileSync('node_modules/@iconify-json/solar/icons.json', 'utf8'));
mkdirSync('src/icons', { recursive: true });
writeFileSync('src/icons/solar-subset.json', JSON.stringify(getIcons(full, used)));
console.log('ícones:', used.join(', '));
