# Vistorias — Solar do Espinhaço

PWA para vistorias de chalés, quartos e unidades de hospedagem (presença por GPS/QR Code, checklist por ambiente, evidências fotográficas, ocorrências e modo offline).

Módulo isolado: consome o Design System em [`../design-system`](../design-system) sem alterá-lo.

## Documentação

- [Especificação técnica (Markdown)](./docs/ESPECIFICACAO.md) — fonte de verdade do que precisa ser feito.
- [Especificação técnica (PDF, versão 3)](./docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf)

## Estado

As 34 telas (T01–T34) estão prototipadas em [`../solar-inspect`](../solar-inspect) com dados fictícios e sem banco de dados. A [especificação v3](./docs/ESPECIFICACAO.md) descreve o comportamento atual, os critérios de aceite e o que ainda depende do Supabase (RLS, autenticação real, PDF no servidor, sincronização real).

Próximos passos (ordem técnica): schema e RLS, autenticação, cadastros, presença no servidor, fotos e armazenamento, envio imutável e ocorrências, fila offline, painel e PDF, testes. Antes, resolver as decisões em aberto da seção 13 da especificação.

## Stack

TypeScript · React · Vite · Tailwind CSS · React Router · Supabase (PostgreSQL, Auth, Storage, RLS, RPC, Edge Functions) · Dexie.js (IndexedDB) + Service Worker · html5-qrcode · Cloudflare Pages
