// Converte dist-artifact/index.html em fragmento (o host do link adiciona doctype/head/body).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync('dist-artifact/solar-inspect.html', head.replace('Solar Inspect · Vistorias', 'Solar Inspect').trim() + '\n' + body.trim() + '\n');
console.log('ok', (Buffer.byteLength(head + body) / 1024).toFixed(0) + ' KB');
