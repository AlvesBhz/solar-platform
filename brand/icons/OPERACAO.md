# Ícones · Categoria 08 · Operação

Aprovada em 21/11/2026. Vale para todas as aplicações (Solar Inspect, gestão, site e Guia). A referência visual está em `brand/icons/index.html`, seção "Operação".

## Regras

- Coleção única: Iconify **solar**, estilo **linear**. O estilo **bold** é só para ênfase (resposta marcada).
- Um ícone fixo por conceito. Não troque o ícone de um conceito nem use o ícone de um conceito para outro.
- Status sempre com **cor + ícone + texto**.
- Ação só de ícone sempre leva dica (`title`) e nome acessível (`aria-label`), com área de toque de 44 px.
- O build do Solar Inspect para (`scripts/icons.mjs`) se o código usar um ícone que não esteja no catálogo. Para incluir um ícone novo, aprove-o antes e acrescente-o a `brand/icons/index.html`.

## Navegação e ações

| Conceito | Ícone |
|---|---|
| Voltar (cabeçalho) | `solar:alt-arrow-left-linear` |
| Voltar (dentro de botão) | `solar:arrow-left-linear` |
| Subir (ordem) | `solar:alt-arrow-up-linear` |
| Editar / renomear | `solar:pen-linear` |
| Desativar / ocultar | `solar:eye-closed-linear` |
| Reativar | `solar:restart-linear` |
| Remover / limpar | `solar:trash-bin-minimalistic-linear` |
| Tentar de novo / gerar outro | `solar:refresh-linear` |
| Marcar tudo OK | `solar:check-read-linear` |
| Salvo no aparelho | `solar:diskette-linear` |
| Imprimir | `solar:printer-linear` |
| Baixar / exportar | `solar:download-linear` |

## Conta e acesso

| Conceito | Ícone |
|---|---|
| Entrar (login) | `solar:login-2-linear` |
| Sair da conta | `solar:logout-2-linear` |
| Senha | `solar:lock-keyhole-linear` |
| Usuário | `solar:user-rounded-linear` |
| Usuário inativo | `solar:user-block-linear` |
| Sem permissão | `solar:shield-cross-linear` |
| Painel de gestão | `solar:widget-2-linear` |

## Vistoria e presença

| Conceito | Ícone |
|---|---|
| Vistoria de entrada | `solar:login-3-linear` |
| Vistoria de saída | `solar:logout-3-linear` |
| Checklist / fazer vistoria | `solar:clipboard-list-linear` |
| Vistoria registrada | `solar:clipboard-check-linear` |
| Tipos de vistoria | `solar:settings-linear` |
| Localização GPS | `solar:gps-linear` |
| QR Code | `solar:qr-code-linear` |
| Quantidade | `solar:hashtag-linear` |
| Histórico | `solar:history-linear` |
| Sincronização | `solar:refresh-circle-linear` |
| Sem conexão | `solar:cloud-cross-linear` |
| Relatório | `solar:document-text-linear` |
| Pousada / propriedade | `solar:buildings-2-linear` |
| Assunto (auditoria) | `solar:folder-linear` |
| Registro final (somente leitura) | `solar:lock-linear` (exceção: no catálogo também é a fechadura digital; o sentido visual é o mesmo) |

## Status

| Conceito | Ícone | Cor (token) |
|---|---|---|
| Em limpeza | `solar:broom-linear` | `--c-pine` |
| Bloqueado | `solar:forbidden-circle-linear` | `--c-error` |
| Item crítico / atenção | `solar:danger-triangle-linear` | `--c-error` |
| Problema / erro | `solar:danger-circle-linear` | `--c-error` |
| Sinalizada | `solar:shield-warning-linear` | `--c-warning` |
| Resposta OK (ênfase) | `solar:check-circle-bold` | `--c-available` |
| Resposta problema (ênfase) | `solar:close-circle-bold` | `--c-error` |
