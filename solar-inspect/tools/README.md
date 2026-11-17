# Ferramentas

Scripts de apoio que **não entram no aplicativo** (não vão para o build).

| Script | Para que serve |
|---|---|
| `gerar-pdf.cjs` | Gera o PDF da especificação (`docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf`) a partir de `docs/ESPECIFICACAO.md`. |
| `gerar-der.py` | Gera o modelo de dados: `database/der.html` (diagrama e dicionário) e `database/dicionario-de-dados.md`, a partir de uma definição única. Uso: `python3 tools/gerar-der.py`. |
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
