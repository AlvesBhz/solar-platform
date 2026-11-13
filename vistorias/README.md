# Vistorias — Solar do Espinhaço

PWA para vistorias de chalés, quartos e unidades de hospedagem (presença por GPS/QR Code, checklist por ambiente, evidências fotográficas, ocorrências e modo offline).

Módulo isolado: consome o Design System em [`../design-system`](../design-system) sem alterá-lo.

## Documentação

- [Especificação técnica (Markdown)](./docs/ESPECIFICACAO.md) — fonte de verdade do que precisa ser feito.
- [Especificação técnica (PDF original)](./docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf)

## O que precisa ser feito

Ordem técnica recomendada (seção 16 da especificação):

- [ ] 1. Schema, migrations, perfis, vínculos e RLS
- [ ] 2. Cadastros estruturais e tipos de vistoria
- [ ] 3. Autenticação e navegação protegida
- [ ] 4. Validação de presença e auditoria
- [ ] 5. Checklist, respostas, câmera e evidências
- [ ] 6. Envio imutável, ocorrências e atualização de estado
- [ ] 7. Modo offline e sincronização idempotente
- [ ] 8. Painel, histórico e relatório PDF
- [ ] 9. Testes automatizados de regras, RLS, sincronização e fluxos críticos

Antes de começar, resolver as **decisões pendentes** da [seção 15](./docs/ESPECIFICACAO.md#15-decisões-pendentes-antes-da-implementação) (estadia, liberação manual, retenção de fotos, raio/GPS indisponível, método de autenticação, assinatura, notificações).

## Stack

TypeScript · React · Vite · Tailwind CSS · React Router · Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions) · Dexie.js (IndexedDB) · html5-qrcode · Cloudflare Pages
