# Vistorias — Solar do Espinhaço

PWA para vistorias de chalés, quartos e unidades de hospedagem (presença por GPS/QR Code, checklist por ambiente, evidências fotográficas, ocorrências e modo offline).

Módulo isolado: consome o Design System em [`../design-system`](../design-system) sem alterá-lo.

## Documentação

- [Especificação técnica (Markdown)](./docs/ESPECIFICACAO.md) — fonte de verdade do que precisa ser feito.
- [Especificação técnica (PDF original)](./docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf)

## O que precisa ser feito — catálogo de telas

Use os IDs (T01–T34) em rotas, histórias, protótipos, testes e pull requests. Detalhes de cada tela na [seção 10 da especificação](./docs/ESPECIFICACAO.md#10-especificação-resumida-das-telas).

### Acesso
- [ ] T01 Inicialização
- [ ] T02 Login — `/login`
- [ ] T03 Permissão de localização
- [ ] T04 Acesso indisponível

### Assessor
- [ ] T05 Minhas unidades — `/app/unidades`
- [ ] T06 Detalhe da unidade — `/app/unidades/:id`
- [ ] T07 Tipo de vistoria — `/app/vistorias/nova/:unidadeId`
- [ ] T08 Validação de presença
- [ ] T09 Leitor QR
- [ ] T10 Checklist
- [ ] T11 Detalhe do item
- [ ] T12 Captura de evidência
- [ ] T13 Comparação entrada × saída
- [ ] T14 Ocorrência
- [ ] T15 Resumo
- [ ] T16 Assinatura
- [ ] T17 Confirmação
- [ ] T18 Sincronização — `/app/sincronizacao`
- [ ] T19 Meu histórico — `/app/historico`

### Gestão
- [ ] T20 Dashboard — `/gestao`
- [ ] T21 Gestão de unidades — `/gestao/unidades`
- [ ] T22 Detalhe da unidade
- [ ] T23 Lista de vistorias — `/gestao/vistorias`
- [ ] T24 Detalhe da vistoria
- [ ] T25 Lista de ocorrências — `/gestao/ocorrencias`
- [ ] T26 Tratamento da ocorrência
- [ ] T27 Relatório (PDF)

### Administração
- [ ] T28 Propriedades — `/admin/propriedades`
- [ ] T29 Formulário de propriedade
- [ ] T30 Ambientes e itens — `/admin/checklists`
- [ ] T31 Tipos de vistoria
- [ ] T32 Usuários e permissões — `/admin/usuarios`
- [ ] T33 Configuração GPS/QR — `/admin/presenca`
- [ ] T34 Auditoria — `/admin/auditoria`

## Stack

TypeScript · React · Vite · Tailwind CSS · React Router · Supabase (PostgreSQL, Auth, Storage, RLS, RPC, Edge Functions) · Dexie.js (IndexedDB) + Service Worker · html5-qrcode · Cloudflare Pages
