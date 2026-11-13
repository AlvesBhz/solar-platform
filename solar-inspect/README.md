# Solar Inspect — App de Vistorias (mockup)

Mockup inicial das telas **T01 Inicialização**, **T02 Login**, **T03 Permissão de localização** e **T04 Acesso indisponível** da [especificação](../vistorias/docs/ESPECIFICACAO.md). Sem banco de dados: a autenticação é simulada em `src/mocks/auth.ts`.

**Stack:** TypeScript · React · Vite · Tailwind CSS · React Router · Iconify (coleção `solar`, empacotada localmente).
Os tokens vêm de `../design-system/colors_and_type.css`, importado sem alteração e espelhado em `tailwind.config.js`.

## Rodar

```bash
npm install
npm run dev
```

## Testar no celular

Com o computador e o celular **no mesmo Wi-Fi**:

```bash
npm run dev
```

O terminal mostra um endereço `Network`, por exemplo `http://192.168.0.10:5173`. Abra no celular e acrescente a rota (ex.: `/login/a`).

Para publicar (Cloudflare Pages): comando de build `npm run build`, pasta de saída `dist`, diretório raiz `solar-inspect`. O arquivo `public/_redirects` garante que as rotas abram direto.

## Rotas

| Rota | Tela |
|---|---|
| `/` | T01 Inicialização (verifica sessão/sincronização → `/login`) |
| `/login` | T02 Login (cabeçalho atual: logo à esquerda) |
| `/login/a` | T02 · Proposta A — logo horizontal centralizado |
| `/login/b` | T02 · Proposta B — selo SE menor + "Vistorias" |
| `/permissao-localizacao` | T03 Permissão de localização (usa o GPS real do navegador, leitura única) |
| `/acesso-indisponivel?motivo=…` | T04 Acesso indisponível — `sem-permissao`, `inativo`, `sessao-expirada`, `offline`, `sem-localizacao` |

## Contas de teste (mock)

| E-mail | Resultado |
|---|---|
| `assessor@solar.dev` / `gestor@solar.dev` | Link de acesso enviado |
| `inativo@solar.dev` | Bloqueado (usuário inativo) |
| qualquer outro | E-mail não cadastrado |
