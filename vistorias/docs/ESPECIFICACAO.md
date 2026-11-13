# Especificação Técnica — Aplicação de Vistorias Solar do Espinhaço

> Especificação funcional, técnica e catálogo de telas do MVP.
> Versão de 13 nov 2026. Original em PDF: [`Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf`](./Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf).

**Objetivo:** orientar diretamente o desenvolvimento da aplicação, sem cronograma, orçamento ou estimativas comerciais.

---

## 1. Visão e escopo

PWA mobile-first para vistorias de unidades de hospedagem, com validação de presença, checklist por ambiente, evidências fotográficas, comparação entrada × saída, ocorrências, operação offline e painel de gestão.

| Incluído no MVP | Fora do MVP |
|---|---|
| Autenticação, perfis e propriedades | Integrações com reservas, fechaduras e cobrança |
| GPS, QR Code e auditoria | Aplicativos nativos publicados nas lojas |
| Checklists, fotos, assinatura e envio | Visão computacional e automações não especificadas |
| Ocorrências, histórico, dashboard e PDF | Cronograma, preços e escopo comercial |

## 2. Perfis

| Perfil | Responsabilidade |
|---|---|
| Assessor | Executar vistorias, registrar respostas, fotos, observações e assinatura. |
| Gestor | Acompanhar unidades, vistorias, relatórios e ocorrências. |
| Administrador | Gerenciar cadastros, usuários, permissões e configurações de presença. |

## 3. Regras centrais

- Hierarquia: **Propriedade → Unidade → Ambiente → Item**.
- Estados da unidade: Em limpeza, Liberado, Ocupado, Bloqueado e Manutenção.
- Estados da vistoria: Rascunho, Pendente de sincronização, Enviada e Sinalizada.
- Vistoria enviada é imutável.
- Divergência exige foto e observação e gera ocorrência.
- Entrada sem pendência crítica libera a unidade; entrada crítica bloqueia.
- Saída sem divergência envia a unidade para Em limpeza; divergência com intervenção envia para Manutenção.

## 4. Tipos de vistoria

| Tipo | Respostas | Comportamento |
|---|---|---|
| Entrada | OK / Problema / N/A | Valida preparação e liberação. |
| Saída | Igual / Danificado / Faltando / Com defeito | Compara com a entrada vinculada. |
| Manutenção preventiva | OK / Precisa intervenção / N/A | Gera ocorrências e prazos. |
| Personalizada | Configurável | Usa checklist definido pelo administrador. |

## 5. Presença e evidências

- **GPS:** cálculo de distância no servidor, precisão aceitável inicial de até 50 m e raio configurável.
- **QR Code:** unidade + segredo rotacionável validados no servidor.
- **GPS + QR:** ambas as validações precisam ser aprovadas.
- Revalidar presença em fotos e no envio quando GPS estiver ativo.
- Fotos em bucket privado, com horário, unidade e coordenadas associadas.
- Falhas devem bloquear o checklist e gerar evento de auditoria.

## 6. Arquitetura

| Camada | Tecnologia |
|---|---|
| Front-end | TypeScript, React, Vite, Tailwind CSS e React Router |
| Back-end | Supabase: PostgreSQL, Auth, Storage, RLS, RPC e Edge Functions |
| Offline | IndexedDB com Dexie.js + Service Worker |
| QR Code | html5-qrcode |
| Hospedagem | Cloudflare Pages |

## 7. Dados principais

| Entidade | Finalidade |
|---|---|
| `usuarios` / `usuario_propriedades` | Perfis e escopo de acesso |
| `propriedades` / `unidades` | Estrutura e configuração de presença |
| `ambientes` / `itens` | Checklist físico reutilizável |
| `tipos_vistoria` / `tipo_vistoria_itens` | Composição do processo |
| `vistorias` / `respostas` / `fotos` | Registro operacional imutável |
| `ocorrencias` | Tratamento de divergências |
| `eventos_log` | Auditoria |

## 8. Requisitos de interface

- Assessor: mobile-first a partir de 320 px e alvos de toque mínimos de 44 × 44 px.
- Gestão: responsiva para desktop e tablet.
- Toda consulta prevê os estados **carregando, vazio, sucesso, erro e sem permissão**.
- Operação informa **online, offline, salvo localmente, sincronizando e falha**.
- Ações irreversíveis exigem confirmação.
- Validação ocorre no cliente e novamente no servidor.

## 9. Catálogo de telas a desenvolver

As telas T01 a T34 fazem parte do escopo do MVP e devem ser usadas como referência em rotas, histórias, protótipos, testes e pull requests.

| Grupo | Telas |
|---|---|
| Acesso | T01–T04 |
| Assessor | T05–T19 |
| Gestão | T20–T27 |
| Administração | T28–T34 |

| ID | Tela | Perfil | Objetivo |
|---|---|---|---|
| T01 | Inicialização | Todos | Validar sessão e sincronizações |
| T02 | Login | Todos | Autenticar |
| T03 | Permissão de localização | Assessor | Solicitar GPS com contexto |
| T04 | Acesso indisponível | Todos | Tratar falta de acesso |
| T05 | Minhas unidades | Assessor | Listar unidades permitidas |
| T06 | Detalhe da unidade | Assessor | Mostrar situação e ações |
| T07 | Tipo de vistoria | Assessor | Selecionar tipo aplicável |
| T08 | Validação de presença | Assessor | Validar GPS/QR |
| T09 | Leitor QR | Assessor | Ler código da unidade |
| T10 | Checklist | Assessor | Executar por ambiente |
| T11 | Detalhe do item | Assessor | Registrar resposta |
| T12 | Captura de evidência | Assessor | Capturar e revisar foto |
| T13 | Comparação entrada × saída | Assessor | Comparar estados |
| T14 | Ocorrência | Assessor | Detalhar divergência |
| T15 | Resumo | Assessor | Revisar pendências |
| T16 | Assinatura | Assessor | Coletar assinatura |
| T17 | Confirmação | Assessor | Enviar definitivamente |
| T18 | Sincronização | Assessor | Controlar fila offline |
| T19 | Meu histórico | Assessor | Consultar execuções |
| T20 | Dashboard | Gestor/Admin | Visão operacional |
| T21 | Gestão de unidades | Gestor/Admin | Pesquisar unidades |
| T22 | Detalhe da unidade | Gestor/Admin | Centralizar histórico |
| T23 | Lista de vistorias | Gestor/Admin | Localizar registros |
| T24 | Detalhe da vistoria | Gestor/Admin | Consultar registro final |
| T25 | Lista de ocorrências | Gestor/Admin | Priorizar pendências |
| T26 | Tratamento da ocorrência | Gestor/Admin | Atribuir e resolver |
| T27 | Relatório | Gestor/Admin | Gerar PDF da vistoria |
| T28 | Propriedades | Admin | Listar cadastros |
| T29 | Formulário de propriedade | Admin | Criar/editar |
| T30 | Ambientes e itens | Admin | Montar estrutura e checklist |
| T31 | Tipos de vistoria | Admin | Configurar composição |
| T32 | Usuários e permissões | Admin | Gerenciar acessos |
| T33 | Configuração GPS/QR | Admin | Configurar presença |
| T34 | Auditoria | Admin | Consultar eventos |

## 10. Especificação resumida das telas

| ID | Tela | Perfil | Componentes | Regras e navegação |
|---|---|---|---|---|
| T01 | Inicialização | Todos | Logo, carregamento, versão. | Login, unidades ou fila. |
| T02 | Login | Todos | E-mail, autenticação, erros. | Bloquear inativo. |
| T03 | Permissão de localização | Assessor | Explicação e ação permitir. | Sem coleta em segundo plano. |
| T04 | Acesso indisponível | Todos | Motivo e recuperação. | Não mostrar dados. |
| T05 | Minhas unidades | Assessor | Busca, filtros, cartões, offline. | Abrir T06. |
| T06 | Detalhe da unidade | Assessor | Estado, ocorrências, última vistoria. | Iniciar T07. |
| T07 | Tipo de vistoria | Assessor | Tipos ativos e descrição. | Seguir T08. |
| T08 | Validação de presença | Assessor | Precisão, distância, QR, retry. | Liberar só após sucesso. |
| T09 | Leitor QR | Assessor | Câmera, enquadramento, erro. | Validar no servidor. |
| T10 | Checklist | Assessor | Progresso, ambientes, itens. | Salvar incrementalmente. |
| T11 | Detalhe do item | Assessor | Referência, resposta, observação. | Divergência exige evidência. |
| T12 | Captura de evidência | Assessor | Câmera, referência, prévia. | Associar local e hora. |
| T13 | Comparação entrada × saída | Assessor | Foto anterior/atual, status. | Exige entrada vinculada. |
| T14 | Ocorrência | Assessor | Descrição, gravidade, fotos. | Criar sem duplicidade. |
| T15 | Resumo | Assessor | Contagens, problemas, duração. | Voltar ao pendente. |
| T16 | Assinatura | Assessor | Área, limpar, confirmar. | Conforme tipo. |
| T17 | Confirmação | Assessor | Resumo e aviso imutável. | Revalidar presença. |
| T18 | Sincronização | Assessor | Pendentes, tentativas, erro. | Envio idempotente. |
| T19 | Meu histórico | Assessor | Filtros, unidade, tipo, status. | Restringir por perfil. |
| T20 | Dashboard | Gestor/Admin | Indicadores, estados, críticas. | Filtros por propriedade. |
| T21 | Gestão de unidades | Gestor/Admin | Tabela/cartões e filtros. | Abrir T22. |
| T22 | Detalhe da unidade | Gestor/Admin | Cadastro, estado, vistorias, ocorrências. | Mudança exige justificativa. |
| T23 | Lista de vistorias | Gestor/Admin | Filtros e exportação. | Paginação e RLS. |
| T24 | Detalhe da vistoria | Gestor/Admin | Metadados, respostas, fotos, assinatura. | Somente leitura. |
| T25 | Lista de ocorrências | Gestor/Admin | Gravidade, status, prazo, responsável. | Destacar críticas. |
| T26 | Tratamento da ocorrência | Gestor/Admin | Responsável, prazo, comentários, status. | Histórico completo. |
| T27 | Relatório | Gestor/Admin | Respostas, fotos, assinatura, ocorrências. | Refletir registro enviado. |
| T28 | Propriedades | Admin | Busca, status, unidades. | Desativar sem apagar. |
| T29 | Formulário de propriedade | Admin | Nome, tipo, GPS, raio, validação. | Validar configuração. |
| T30 | Ambientes e itens | Admin | Árvore, ordem, criticidade, referência. | Preservar histórico. |
| T31 | Tipos de vistoria | Admin | Nome, periodicidade, itens, ordem. | Validar antes de ativar. |
| T32 | Usuários e permissões | Admin | Usuário, perfil, propriedades, status. | Menor privilégio e RLS. |
| T33 | Configuração GPS/QR | Admin | Modo, coordenadas, raio, segredo. | Rotação invalida anterior. |
| T34 | Auditoria | Admin | Usuário, ação, entidade, período. | Somente leitura. |

## 11. Rotas iniciais sugeridas

| Rota | Tela |
|---|---|
| `/login` | T02 |
| `/app/unidades` | T05 |
| `/app/unidades/:id` | T06 |
| `/app/vistorias/nova/:unidadeId` | T07–T17 |
| `/app/sincronizacao` | T18 |
| `/app/historico` | T19 |
| `/gestao` | T20 |
| `/gestao/unidades` | T21–T22 |
| `/gestao/vistorias` | T23–T24 |
| `/gestao/ocorrencias` | T25–T26 |
| `/admin/propriedades` | T28–T29 |
| `/admin/checklists` | T30–T31 |
| `/admin/usuarios` | T32 |
| `/admin/presenca` | T33 |
| `/admin/auditoria` | T34 |

## 12. Critérios de aceite essenciais

- Usuário sem acesso não lista nem consulta a propriedade.
- Checklist não abre quando presença falha.
- Obrigatórios e fotos pendentes impedem envio.
- Divergência gera ocorrência com foto e observação.
- Registro enviado não pode ser alterado ou excluído.
- Vistoria offline sobrevive ao fechamento e sincroniza sem duplicidade.
- Saída mostra evidência da entrada quando disponível.
- Relatório contém identificação, respostas, fotos, assinatura e ocorrências.
