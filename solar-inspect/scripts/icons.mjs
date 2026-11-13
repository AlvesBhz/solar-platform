// Gera src/icons/solar-subset.json só com os ícones usados (funciona offline).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getIcons } from '@iconify/utils';
import { execSync } from 'node:child_process';
const used = [...new Set(execSync("grep -rhoE 'solar:[a-z0-9-]+' src --include=*.tsx").toString().trim().split('\n'))]
  .map((n) => n.replace('solar:', ''));
const full = JSON.parse(readFileSync('node_modules/@iconify-json/solar/icons.json', 'utf8'));
mkdirSync('src/icons', { recursive: true });
writeFileSync('src/icons/solar-subset.json', JSON.stringify(getIcons(full, used)));
console.log('ícones:', used.join(', '));
