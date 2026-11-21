# Ferramentas

Scripts de apoio que **não entram no aplicativo** (não vão para o build).

| Script | Para que serve |
|---|---|
| `gerar-pdf.cjs` | Gera o PDF da especificação (`docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf`) a partir de `docs/ESPECIFICACAO.md`. |
| `gerar-der.py` | Gera o DER das Vistorias: `database/der.html` e `database/dicionario-de-dados.md`. Lê as tabelas `SIT_` de `site/database/schema.sql`, os textos e exemplos do site, e confere as tabelas `VST_` contra `database/migracao_vistorias.sql`. Uso: `python3 -I tools/gerar-der.py`. |
| `testar-banco.sh` | Aplica a migração num PostgreSQL de teste (nunca no Supabase de produção), confere que nada do site mudou, roda `database/testes_vistorias.sql` e os testes das Edge Functions. Uso: `PGHOST=… PGPORT=… PGUSER=… tools/testar-banco.sh`. |
| `aplicar-supabase.py` | Aplica `migracao_vistorias.sql` no Supabase (API de gerenciamento, com o token do ambiente), prova que nada do site mudou e roda `verificar_aplicacao.sql`. `--so-conferir` só lê. Não roda os testes. |
| `publicar-funcoes.sh` | Publica as Edge Functions `login-vistoria` e `criar-usuario` pela CLI do Supabase. |
| `verificar-rolagem-lateral.cjs` | Percorre todas as telas em 280, 320 e 390 px e lista qualquer elemento que passe da borda da tela. |

Dependências só para estas ferramentas (não ficam no `package.json`):

```bash
npm install --no-save marked @fontsource/inter @fontsource/cormorant-garamond playwright
npx playwright install chromium
```

```bash
node tools/gerar-pdf.cjs
```

```bash
npm run build && npx vite preview --port 4173 &
node tools/verificar-rolagem-lateral.cjs
```
