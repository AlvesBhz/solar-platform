# Solar Inspect — App de Vistorias (mockup)

Mockup inicial das telas **T01 Inicialização** e **T02 Login** da [especificação](../vistorias/docs/ESPECIFICACAO.md). Sem banco de dados: a autenticação é simulada em `src/mocks/auth.ts`.

**Stack:** TypeScript · React · Vite · Tailwind CSS · React Router · Iconify (coleção `solar`, empacotada localmente).
Os tokens vêm de `../design-system/colors_and_type.css`, importado sem alteração e espelhado em `tailwind.config.js`.

## Rodar

```bash
npm install
npm run dev
```

## Rotas

| Rota | Tela |
|---|---|
| `/` | T01 Inicialização (verifica sessão/sincronização → `/login`) |
| `/login` | T02 Login |

## Contas de teste (mock)

| E-mail | Resultado |
|---|---|
| `assessor@solar.dev` / `gestor@solar.dev` | Link de acesso enviado |
| `inativo@solar.dev` | Bloqueado (usuário inativo) |
| qualquer outro | E-mail não cadastrado |
