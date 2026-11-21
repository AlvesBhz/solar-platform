# Aplicar a migração das vistorias (para a sessão que tem o token do Supabase)

Cole o texto abaixo na sessão **Site** (ela tem o ambiente com o token `sbp_` e acesso ao projeto `tnjpyjbqcjrowzjfnuln`).
Tudo já está pronto no repositório, branch `claude/epic-edison-rcjlqp`; nada precisa ser escrito, só executado.

---

**Texto para colar:**

> Aplique a migração das vistorias do Solar Inspect no Supabase (projeto tnjpyjbqcjrowzjfnuln, schema "SE"). É a spec que você mesma escreveu, já implementada e testada pela sessão Inspect.
>
> 1. Sem mexer na sua branch de trabalho, traga os arquivos da branch do Inspect (só leitura):
>    `git fetch origin claude/epic-edison-rcjlqp` e `git worktree add /tmp/inspect origin/claude/epic-edison-rcjlqp`
> 2. Confira primeiro, só lendo: `python3 -I /tmp/inspect/solar-inspect/tools/aplicar-supabase.py --so-conferir` (deve dizer "AINDA NÃO APLICADA").
> 3. Aplique e verifique: `python3 -I /tmp/inspect/solar-inspect/tools/aplicar-supabase.py`
>    O script confere o ponto de partida, aplica `migracao_vistorias.sql` (uma transação), prova que nada das tabelas, funções e dados `SIT_` mudou e roda `verificar_aplicacao.sql` (15 itens, todos têm de dar ok). Ele usa a API de gerenciamento com o seu token. **Não rode `testes_vistorias.sql` no Supabase**: ele cria dados de teste.
> 4. Publique as Edge Functions: `bash /tmp/inspect/solar-inspect/tools/publicar-funcoes.sh` (best-effort; se a CLI não rodar aí, avise e diga o erro).
> 5. Me devolva: a saída completa do passo 3 e do passo 4. Se algum item falhar, **não tente consertar sozinha**: pare e me mostre a mensagem.
>
> Depois de aplicada, o contrato para a geração automática das vistorias está em `solar-inspect/database/README.md` (seção "Contrato com a geração automática de vistorias"): VST_VISTORIA com DT_AGENDADA e TP_STATUS AGENDADA, ENTRADA e SAIDA já cadastradas em VST_TIPO_VISTORIA, índice único (ID_RESERVA, ID_TIPO_VISTORIA), gatilho de coerência (na remarcação que troque de chalé, atualize ID_UNIDADE junto com ID_RESERVA). Pode seguir com a geração automática.

---

## O que o script faz e não faz

- **Faz:** só cria objetos novos (tabelas `VST_`, funções `vst_*`, políticas, gatilhos de auditoria, bucket `vistorias`). Não altera, renomeia nem apaga nada `SIT_`. Pode ser rodado de novo sem efeito.
- **Para sozinho** se faltar `schema.sql` do site, se qualquer tabela, função, gatilho ou linha `SIT_` mudar, ou se algum item da verificação não bater.
- **Não faz:** criar funcionários, redefinir senhas nem mexer no Auth. O primeiro ADMIN é criado à mão (ver `README.md`, passo 2 de "Como aplicar").

## Se preferir aplicar sem a sessão Site

No SQL Editor do Supabase: colar `migracao_vistorias.sql` e rodar; depois colar `verificar_aplicacao.sql` (só lê): todas as linhas devem ter `ok = true`.
